// Passos do CS:GO (CCSPlayer::UpdateStepSound sobre o CBasePlayer::UpdateStepSound): um relógio em ms, com a
// velocidade do começo do tick. Quando zera, com o jogador no chão, andando no plano e acima da velocidade mínima, dá
// um passo e recomeça na cadência da classe (lenta abaixo de 220 u/s). Audível só com ≥ 135,2 u/s e sem o andar (Shift)
// engatado; os passos silenciosos também saem, marcados, para as pegadas da 3.5. Diferença do CS: lá o relógio para
// enquanto o passo é silencioso; aqui continua contando. No slide (subfase 3.4) não há passo: o relógio fica parado e
// segue de onde estava depois. Eventos no `env.events` do playerMove.

import { STEPS } from '../data/movement.js';
import { SURFACES } from '../data/surfaces.js';

/** Relógio ao parar (e ao nascer): o primeiro passo sai ~0,29 s depois de começar a andar. */
export function firstStepDelay(duckFlag) {
  return STEPS.fastInterval * STEPS.frequency + (duckFlag ? STEPS.duckExtra : 0);
}

/** Um tick do relógio dos passos. Estado em `s.stepTimer` (ms) e `s.stepFoot` (0 esquerdo, 1 direito). */
export function updateSteps(s, env) {
  if (s.sliding) return;
  const v = s.velocity;
  const speedSq = v.lengthSq();
  if (speedSq < STEPS.stoppedSpeedSq) {
    s.stepTimer = firstStepDelay(s.duckFlag);
    return;
  }
  s.stepTimer = Math.max(0, s.stepTimer - env.dt * 1000);
  if (s.stepTimer > 0 || !s.onGround || Math.hypot(v.x, v.z) <= 1e-4) return;
  const speed = Math.sqrt(speedSq);
  const ducked = s.duckFlag;
  if (speed < (ducked ? STEPS.duckWalkSpeed : STEPS.walkSpeed)) return;
  const fast = speed >= (ducked ? STEPS.duckRunSpeed : STEPS.runSpeed);
  s.stepTimer = (fast ? STEPS.fastInterval : STEPS.slowInterval) * STEPS.frequency + (ducked ? STEPS.duckExtra : 0);
  const surface = SURFACES[s.groundSurface];
  const volume = (fast ? surface.stepFast : surface.stepSlow) * (ducked ? STEPS.duckVolume : 1);
  const foot = s.stepFoot;
  s.stepFoot = 1 - foot;
  env.events.push({
    type: 'step', foot, x: s.origin.x, y: s.origin.y, z: s.origin.z, surface: s.groundSurface, volume, speed,
    audible: speed >= STEPS.audibleSpeed && !s.walking,
  });
}
