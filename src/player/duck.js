// Agachar do CS:GO (CCSGameMovement: DuckingEnabled/CheckParameters, Duck, CanUnduck, FinishDuck, FinishUnDuck e
// HandleDuckingSpeedCrop): penalidade de spam, transição com velocidade própria, troca de cápsula (no ar na hora, com
// os pés ±9), o FL_DUCKING (`duckFlag`: vale como agachado para a precisão, os passos e o andar) e o corte do teto de
// velocidade. Opera sobre o estado de movimento (src/player/movement.js) com as consultas do CharacterController.

import { CONTROLLER, DUCK, HULL } from '../data/movement.js';
import { BTN } from './moveCmd.js';

/** SimpleSpline do Source (smoothstep): o olho no meio da transição. */
export function duckEase(t) {
  return t * t * (3 - 2 * t);
}

/** Altura do olho sobre os pés (sem a suavização da câmera). */
export function eyeHeight(s) {
  return HULL.standEye + (HULL.duckEye - HULL.standEye) * duckEase(s.duckAmount);
}

/**
 * Portão do agachar (CheckParameters + DuckingEnabled). Cada mudança da tecla crua (apertar e soltar) tira
 * DUCK.spamPenalty da velocidade do agachar; abaixo de DUCK.minEnabled a tecla é ignorada, e sem FL_DUCKING também
 * antes de sv_timebetweenducks do último agachar completo. Grava em `s.duckHeld` se o agachar vale neste tick.
 */
export function duckGate(s, cmd, sv) {
  const raw = (cmd.buttons & BTN.DUCK) !== 0;
  if (raw !== ((s.oldButtons & BTN.DUCK) !== 0)) s.duckSpeed = Math.max(0, s.duckSpeed - DUCK.spamPenalty);
  s.duckHeld = raw && s.duckSpeed >= DUCK.minEnabled && (s.duckFlag || s.sinceDuck >= sv.timebetweenducks);
  return s.duckHeld;
}

/**
 * CanUnduck: com a cápsula agachada no ar, a em pé precisa caber 9 u abaixo sem a base atravessar chão (o CS varre a
 * caixa em pé até lá); no chão, ou com a cápsula já em pé, basta caber onde está.
 */
function canUnduck(s, ctl) {
  const o = s.origin;
  if (s.onGround || !s.ducked) return ctl.fits(o.x, o.y, o.z, HULL.standHeight);
  const low = o.y - HULL.airDuckLift;
  return ctl.fits(o.x, low, o.z, HULL.standHeight) && !ctl.support(o.x, o.z, low, o.y + CONTROLLER.supportTolerance);
}

/** FinishDuck: cápsula agachada; no ar os pés sobem 9 (a cabeça desce 9). Recategoriza o chão. */
function finishDuck(s, env) {
  if (!s.onGround) s.origin.y += HULL.airDuckLift;
  s.ducking = false;
  s.ducked = true;
  s.height = HULL.duckHeight;
  s.duckFlag = true;
  s.duckAmount = 1;
  s.sinceDuck = 0;
  env.controller.categorizePosition(s);
  env.events.push({ type: 'duck' });
}

/** FinishUnDuck: transição encerrada em pé. Recategoriza: levantar no ar pode pousar ali mesmo (o duckbug do CS:GO). */
function finishUnduck(s, env) {
  s.ducking = false;
  s.duckFlag = false;
  s.duckAmount = 0;
  env.controller.categorizePosition(s);
}

/**
 * Duck do CS:GO (depois dos passos, antes da gravidade): recupera a velocidade do agachar, anda a transição, troca a
 * cápsula e corta o teto do tick (`s.maxSpeed`) pelo quanto agachou. Trocas de cápsula no ar mudam pés e olho de uma
 * vez: a diferença vai para `s.viewOffset` e a câmera suaviza.
 */
export function duck(s, env) {
  const { controller: ctl, dt, events } = env;
  const o = s.origin;
  const y0 = o.y;
  const eye0 = eyeHeight(s);
  let snapped = false;
  // Recuperação do spam: +3/s sempre; +6/s todo em pé ou todo agachado e longe de onde a velocidade estava cheia.
  s.duckSpeed = Math.min(DUCK.speed, s.duckSpeed + DUCK.recovery * dt);
  if (s.duckSpeed >= DUCK.speed) {
    s.duckAnchorX = o.x;
    s.duckAnchorZ = o.z;
  } else if ((s.duckAmount <= 0 || s.duckAmount >= 1)
    && (o.x - s.duckAnchorX) ** 2 + (o.z - s.duckAnchorZ) ** 2 > DUCK.recoveryAwayDistance ** 2) {
    s.duckSpeed = Math.min(DUCK.speed, s.duckSpeed + DUCK.recoveryAway * dt);
  }
  const held = s.duckHeld;
  if ((!held && s.duckAmount > 0) || (held && s.duckAmount < 1)) s.ducking = true;
  if (held && s.ducking) {
    // Descer: 0,8 × velocidade do agachar; a cápsula só troca no fim (no ar, na hora).
    s.duckAmount = Math.min(1, s.duckAmount + s.duckSpeed * DUCK.downFactor * dt);
    if (s.duckAmount >= 1 || !s.onGround) {
      snapped = !s.onGround;
      finishDuck(s, env);
    }
  }
  if (!held && s.ducking) {
    if (canUnduck(s, ctl)) {
      // Levantar: a cápsula em pé entra na hora (no ar, com os pés 9 u abaixo) e o olho sobe a máx(1,5; velocidade).
      const inAir = !s.onGround;
      s.duckAmount = Math.max(0, s.duckAmount - Math.max(DUCK.minUnduck, s.duckSpeed) * dt);
      if (s.ducked) {
        if (inAir) o.y -= HULL.airDuckLift;
        s.ducked = false;
        s.height = HULL.standHeight;
        events.push({ type: 'unduck' });
      }
      if (s.duckAmount <= 0 || inAir) {
        snapped = snapped || inAir;
        finishUnduck(s, env);
      }
      if (s.duckAmount <= DUCK.flagClear) s.duckFlag = false;
    } else {
      // Sob algo que não deixa levantar: fica agachado de todo e tenta de novo nos próximos ticks.
      snapped = s.duckAmount < 1;
      s.duckAmount = 1;
      s.ducked = true;
      s.height = HULL.duckHeight;
      s.ducking = false;
      s.duckFlag = true;
    }
  }
  if (snapped) s.viewOffset -= o.y - y0 + eyeHeight(s) - eye0;
  // HandleDuckingSpeedCrop: com qualquer estado de agachar, o teto do tick cai pelo quanto agachou (também no ar).
  s.duckFactor = held || s.ducking || s.duckFlag ? 1 + (DUCK.speedMultiplier - 1) * s.duckAmount : 1;
  s.maxSpeed *= s.duckFactor;
}
