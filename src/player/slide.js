// Slide (subfase 3.4; seção 0.6: "correr + agachar, dura ~0,6 s, com cooldown"). Começa com o Ctrl apertado correndo
// no chão; desliza agachado com atrito baixo, controle lateral leve e a gravidade das rampas; acaba ao soltar o Ctrl,
// no tempo, abaixo da velocidade do agachado, no pulo ou com tempo demais no ar. Números da referência (o slide do
// Doodle District) na escala do CS em src/data/movement.js (SLIDE e as sv_slide_*); desenho em docs/phases/phase-3.md,
// seção 3.4. Funções puras sobre o estado de movimento (src/player/movement.js), chamadas pelo playerMove na ordem do
// tick. "Velocidade do item" = s.baseSpeed: a do item na mão no modo atual, com o teto de 260 e do sv_maxspeed.

import { HULL, SLIDE } from '../data/movement.js';
import { snapDuck } from './duck.js';
import { BTN } from './moveCmd.js';

/** Motivos do fim do slide (evento `slide`, fase `end`). */
export const SLIDE_END = Object.freeze({
  RELEASE: 'soltou', TIME: 'tempo', STOP: 'parou', JUMP: 'pulo', AIR: 'ar', INTERRUPT: 'interrompido',
});

/**
 * Pode começar neste tick (passo 6)? No chão, parado de deslizar, com a recarga vencida e sv_slide 1; o Ctrl apertado
 * agora (o bit cru subiu) e aceito pelo portão do spam; sem o andar (Shift) e sem o pulo — Ctrl + Espaço juntos é o
 * pulo agachado do CS —; e a velocidade no plano ≥ SLIDE.minSpeed × a velocidade do item.
 */
export function canStartSlide(s, cmd, env) {
  if (!env.sv.slide || s.sliding || !s.onGround || s.slideCooldown > 0) return false;
  const b = cmd.buttons;
  if (!(b & BTN.DUCK) || (s.oldButtons & BTN.DUCK) || !s.duckHeld) return false;
  if ((b & BTN.JUMP) || (b & BTN.WALK) || s.walking) return false;
  const speed = Math.hypot(s.velocity.x, s.velocity.z);
  return speed > 0 && speed >= SLIDE.minSpeed * s.baseSpeed;
}

/** Começo: a velocidade no plano sobe para no mínimo sv_slide_speed × a do item e a cápsula agacha na hora. */
export function startSlide(s, env) {
  const v = s.velocity;
  const from = Math.hypot(v.x, v.z);
  const boost = env.sv.slide_speed * s.baseSpeed;
  if (from < boost) {
    const k = boost / from;
    v.x *= k;
    v.z *= k;
  }
  s.sliding = true;
  s.slideTime = 0;
  s.slideAir = 0;
  s.slideDistance = 0;
  s.slideExit = false;
  s.slideStartSpeed = Math.hypot(v.x, v.z);
  snapDuck(s, env);
  env.events.push({ type: 'slide', phase: 'start', speed: s.slideStartSpeed, from, surface: s.groundSurface });
}

/**
 * Fim do slide com o motivo: a recarga (sv_slide_cooldown) começa a contar; no chão começa a saída sem parada seca (o
 * atrito do CS freia até a velocidade caber no teto do tick, no lugar do corte duro).
 */
export function endSlide(s, env, reason) {
  if (!s.sliding) return;
  s.sliding = false;
  s.slideCooldown = env.sv.slide_cooldown;
  s.slideExit = s.onGround;
  s.slideAir = 0;
  env.events.push({
    type: 'slide', phase: 'end', reason, time: s.slideTime, distance: s.slideDistance,
    entrySpeed: s.slideStartSpeed, exitSpeed: Math.hypot(s.velocity.x, s.velocity.z),
  });
}

/** Passo 6: deslizando, soltar o Ctrl encerra (o agachar do passo 7 levanta se couber); senão, tenta começar. */
export function checkSlideButton(s, cmd, env) {
  if (s.sliding) {
    if (!s.duckHeld) endSlide(s, env, SLIDE_END.RELEASE);
    return;
  }
  if (canStartSlide(s, cmd, env)) startSlide(s, env);
}

/**
 * Atrito do slide (passo 10, no chão): o do CS com sv_slide_friction × sv_friction × atrito da superfície e sem o piso
 * do sv_stopspeed — a velocidade cai na mesma proporção a cada tick.
 */
export function slideFriction(s, sv, dt) {
  const v = s.velocity;
  const speed = v.length();
  if (speed < 0.1) return;
  const drop = speed * sv.slide_friction * sv.friction * s.surfaceFriction * dt;
  v.multiplyScalar(Math.max(speed - drop, 0) / speed);
}

/**
 * Movimento no chão durante o slide (passo 11), no lugar da aceleração e do teto duro do CS: o desejo (`wishDir`, com
 * a fração do analógico `amount`) empurra até SLIDE.steer × a velocidade do item por segundo e a velocidade volta ao
 * módulo de antes — girar não acelera —; a gravidade no plano da rampa acelera na descida e freia na subida; o
 * deslocamento é o do andar (varredura, degrau e grudar no chão).
 */
export function slideMove(s, wishDir, amount, env) {
  const { controller: ctl, sv, dt } = env;
  const v = s.velocity;
  v.y = 0;
  const speed = Math.hypot(v.x, v.z);
  if (amount > 0 && speed > 0) {
    const push = SLIDE.steer * s.baseSpeed * amount * dt;
    v.x += wishDir.x * push;
    v.z += wishDir.z * push;
    const len = Math.hypot(v.x, v.z);
    if (len > 1e-6) {
      v.x *= speed / len;
      v.z *= speed / len;
    }
  }
  const n = s.groundNormal;
  const g = sv.gravity * n.y * dt;
  v.x += n.x * g;
  v.z += n.z * g;
  const x0 = s.origin.x;
  const z0 = s.origin.z;
  ctl.groundMove(s, dt);
  s.slideDistance += Math.hypot(s.origin.x - x0, s.origin.z - z0);
}

/**
 * Pulo no slide (passo 9, logo depois do pulo do CS, que já cortou o embalo no teto do bhop): o slide acaba e, com o
 * Ctrl seguro, os pés sobem HULL.airDuckLift na hora — o pulo agachado do CS (agachar no ar levanta os pés 9 u), que a
 * cápsula já agachada do slide não faria sozinha. A subida vai para a suavização da câmera.
 */
export function slideJump(s, cmd, env) {
  if ((cmd.buttons & BTN.DUCK) && s.ducked) s.viewOffset -= env.controller.raise(s, HULL.airDuckLift);
  endSlide(s, env, SLIDE_END.JUMP);
}

/**
 * Passo 13: o tempo do slide anda e ele acaba com sv_slide 0 (`interrompido`), abaixo da velocidade do agachado
 * (`parou`), com mais de SLIDE.airTime seguidos no ar (`ar`) ou no sv_slide_time (`tempo`). Fora do slide, a saída sem
 * parada seca acaba ao sair do chão.
 */
export function updateSlide(s, env) {
  if (!s.sliding) {
    if (!s.onGround) s.slideExit = false;
    return;
  }
  const { sv, dt } = env;
  s.slideTime += dt;
  s.slideAir = s.onGround ? 0 : s.slideAir + dt;
  const speed = Math.hypot(s.velocity.x, s.velocity.z);
  if (!sv.slide) endSlide(s, env, SLIDE_END.INTERRUPT);
  else if (speed < SLIDE.endSpeed * s.baseSpeed) endSlide(s, env, SLIDE_END.STOP);
  else if (s.slideAir > SLIDE.airTime + 1e-9) endSlide(s, env, SLIDE_END.AIR);
  else if (s.slideTime >= sv.slide_time - 1e-9) endSlide(s, env, SLIDE_END.TIME);
}
