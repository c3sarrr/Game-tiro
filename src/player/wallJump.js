// Wall-jump (subfase 3.4; seção 0.6: "1 por contato de parede, reseta ao tocar o chão"). No ar, a sonda de parede
// (src/physics/wallProbe.js) guarda o último contato; um aperto do pulo no ar, com o contato recente de uma parede
// ainda não usada no voo, chuta o jogador para onde ele olha com a vertical de um pulo um pouco mais baixo. Tolerância,
// buffer, espera e subida máxima da referência (o wall-jump do Doodle District); números em src/data/movement.js
// (WALLJUMP e as sv_walljump_*); desenho em docs/phases/phase-3.md, seção 3.4. Funções puras sobre o estado de
// movimento (src/player/movement.js), chamadas pelo playerMove na ordem do tick. "A mesma parede" = a mesma peça do
// ColliderBuilder no mesmo corpo com a direção no plano a até WALLJUMP.sameWall de uma já usada.

import { HULL, MOVE, WALLJUMP } from '../data/movement.js';
import { BTN } from './moveCmd.js';

const DEG = Math.PI / 180;
const MIN_AWAY_SIN = Math.sin(WALLJUMP.minAway * DEG);
const MIN_AWAY_COS = Math.cos(WALLJUMP.minAway * DEG);
const SAME_WALL_COS = Math.cos(WALLJUMP.sameWall * DEG);

/** Relógios do passo 2: buffer do pulo e espera entre wall-jumps (a idade do contato anda na sonda, passo 14). */
export function wallJumpClocks(s, dt) {
  s.jumpBuffer = Math.max(0, s.jumpBuffer - dt);
  s.wallJumpCooldown = Math.max(0, s.wallJumpCooldown - dt);
}

/** Esquece o voo: paredes usadas, contato, buffer e a contagem de wall-jumps (chão, teleporte, volta e noclip). */
export function resetWalls(s) {
  s.usedCount = 0;
  s.wallJumps = 0;
  s.wallTime = WALLJUMP.ageMax;
  s.jumpBuffer = 0;
}

/** A parede (corpo, peça e direção no plano) já foi usada neste voo? */
export function wallUsed(s, body, part, nx, nz) {
  const n = Math.min(s.usedCount, WALLJUMP.maxUsed);
  for (let i = 0; i < n; i++) {
    if (s.usedBody[i] === body && s.usedPart[i] === part && s.usedNx[i] * nx + s.usedNz[i] * nz >= SAME_WALL_COS) {
      return true;
    }
  }
  return false;
}

/** A parede do último contato entra no anel das usadas. */
function markUsed(s) {
  const i = s.usedCount % WALLJUMP.maxUsed;
  s.usedBody[i] = s.wallBody;
  s.usedPart[i] = s.wallPart;
  s.usedNx[i] = s.wallNx;
  s.usedNz[i] = s.wallNz;
  s.usedCount++;
}

/**
 * Direção do chute no plano para o olhar `yaw` e a normal da parede (nx, nz), escrita em `out` ({x, z}): a horizontal
 * do olhar; olhando para dentro da parede, espelhada no plano dela (de frente, sai reto pela normal); e sempre pelo
 * menos WALLJUMP.minAway para fora (olhando ao longo da parede, sai nesse ângulo).
 */
export function kickDirection(yaw, nx, nz, out) {
  let dx = -Math.sin(yaw);
  let dz = -Math.cos(yaw);
  let away = dx * nx + dz * nz;
  if (away < 0) {
    dx -= 2 * away * nx;
    dz -= 2 * away * nz;
    away = -away;
  }
  if (away < MIN_AWAY_SIN) {
    const tx = dx - away * nx;
    const tz = dz - away * nz;
    const len = Math.hypot(tx, tz);
    if (len < 1e-9) {
      dx = nx;
      dz = nz;
    } else {
      dx = (tx / len) * MIN_AWAY_COS + nx * MIN_AWAY_SIN;
      dz = (tz / len) * MIN_AWAY_COS + nz * MIN_AWAY_SIN;
    }
  }
  out.x = dx;
  out.z = dz;
  return out;
}

const _dir = { x: 0, z: 0 };

/**
 * O chute: velocidade no plano para a direção do kickDirection, com o módulo atual entre a velocidade do item
 * (s.baseSpeed, o piso) e sv_walljump_maxspeed (o teto); vertical sv_walljump_up × (1 − stamina/100) menos a meia
 * gravidade do tick (a parábola exata, como o pulo); a stamina soma o custo de um pulo. A parede vira usada, o buffer é
 * consumido e a espera recomeça.
 */
function kick(s, cmd, env) {
  const { sv, dt } = env;
  const v = s.velocity;
  kickDirection(cmd.yaw, s.wallNx, s.wallNz, _dir);
  const speed = Math.min(sv.walljump_maxspeed, Math.max(s.baseSpeed, Math.hypot(v.x, v.z)));
  v.x = _dir.x * speed;
  v.z = _dir.z * speed;
  let impulse = sv.walljump_up;
  if (s.stamina > 0) impulse *= Math.max(0, Math.min(1, 1 - s.stamina / MOVE.staminaRange));
  v.y = impulse - sv.gravity * 0.5 * dt;
  s.stamina = Math.min(sv.staminamax, Math.max(0, s.stamina + sv.staminajumpcost * impulse));
  markUsed(s);
  s.jumpBuffer = 0;
  s.wallJumpCooldown = WALLJUMP.cooldown;
  s.wallJumps++;
  env.events.push({
    type: 'walljump', nx: s.wallNx, nz: s.wallNz, surface: s.wallSurface, speed, count: s.wallJumps,
    body: s.wallBody, part: s.wallPart,
  });
}

/**
 * Passo 9, no ar: um aperto do pulo (o bit subiu) arma o buffer por WALLJUMP.buffer; com o buffer armado, um contato de
 * parede de até WALLJUMP.grace atrás, essa parede ainda não usada no voo, a subida até WALLJUMP.maxRise × o pulo e a
 * espera vencida, chuta. Com sv_walljump 0 não há wall-jump. Devolve true se chutou.
 */
export function checkWallJump(s, cmd, env) {
  const { sv } = env;
  if ((cmd.buttons & BTN.JUMP) && !(s.oldButtons & BTN.JUMP)) s.jumpBuffer = WALLJUMP.buffer;
  if (!sv.walljump || s.jumpBuffer <= 1e-9 || s.wallJumpCooldown > 1e-9) return false;
  if (s.wallTime > WALLJUMP.grace + 1e-9) return false;
  if (s.velocity.y > WALLJUMP.maxRise * sv.jump_impulse) return false;
  if (wallUsed(s, s.wallBody, s.wallPart, s.wallNx, s.wallNz)) return false;
  kick(s, cmd, env);
  return true;
}

/**
 * Passo 14: no chão, esquece o voo; no ar (com sv_walljump 1), a sonda procura a parede mais próxima a até
 * WALLJUMP.reach da cápsula e guarda o contato para os próximos ticks (idade 0, medida no começo do próximo tick);
 * sem parede, a idade do último contato anda um tick.
 */
export function updateWallContact(s, env) {
  if (s.onGround) {
    resetWalls(s);
    return;
  }
  const ctl = env.controller;
  const o = s.origin;
  const w = ctl.wallHit;
  if (!env.sv.walljump
    || !ctl.walls.probe(o.x, o.y, o.z, HULL.radius, s.height, WALLJUMP.reach, WALLJUMP.maxNormalY, w)) {
    s.wallTime = Math.min(WALLJUMP.ageMax, s.wallTime + env.dt);
    return;
  }
  s.wallTime = 0;
  s.wallNx = w.nx;
  s.wallNz = w.nz;
  s.wallPx = w.px;
  s.wallPy = w.py;
  s.wallPz = w.pz;
  s.wallBody = w.body.key;
  s.wallPart = w.part;
  s.wallSurface = w.surface;
}
