// Movimento do jogador — porte do PlayerMove/FullWalkMove do CS:GO (cs_gamemovement.cpp sobre o gamemovement.cpp do
// Source) para Y para cima, com os números do CS:GO (src/data/movement.js). Uma função sobre dados simples,
// playerMove(estado, comando, ambiente): o mesmo código move o jogador local, a predição do cliente (Fase 9) e os bots
// (Fase 7) — só o comando muda. O agachar fica em duck.js e os passos em footsteps.js. Única diferença intencional do
// CS:GO: o pulo mantém a parábola exata da 3.1 (impulso definido, ápice de 57 u em pé; o CS:GO a 64 tick dá 54,65 u).

import * as THREE from 'three';
import { CONTROLLER, DUCK, HULL, MOVE, STEPS } from '../data/movement.js';
import { FREE_CAMERA } from '../data/sandbox.js';
import { SURFACES } from '../data/surfaces.js';
import { duck, duckGate } from './duck.js';
import { firstStepDelay, updateSteps } from './footsteps.js';
import { BTN } from './moveCmd.js';

export { eyeHeight } from './duck.js';

export const MOVETYPE = Object.freeze({ WALK: 'andar', NOCLIP: 'noclip' });

const _wishVel = new THREE.Vector3();
const _wishDir = new THREE.Vector3();
const _dest = new THREE.Vector3();
const _start = new THREE.Vector3();
const _fwd = new THREE.Vector3();
const _right = new THREE.Vector3();

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

/** Estado de movimento de um jogador: dados simples (a rede serializa, a predição copia). */
export function createMoveState({ position = null } = {}) {
  return {
    origin: position ? position.clone() : new THREE.Vector3(), // pés
    velocity: new THREE.Vector3(),
    height: HULL.standHeight, // altura atual da cápsula
    ducked: false, // cápsula agachada (m_bDucked)
    ducking: false, // transição do agachar em andamento (m_bDucking)
    duckFlag: false, // FL_DUCKING: agachado para a precisão, os passos e o andar
    duckHeld: false, // agachar valendo neste tick (depois do portão do spam)
    duckAmount: 0, // 0 em pé … 1 agachado (olho e velocidade)
    duckSpeed: DUCK.speed, // velocidade do agachar (cai com o spam, recupera com o tempo)
    duckAnchorX: position ? position.x : 0, // onde a velocidade do agachar estava cheia (recuperação extra longe dali)
    duckAnchorZ: position ? position.z : 0,
    sinceDuck: DUCK.sinceMax, // s desde o último agachar completo (sv_timebetweenducks)
    walking: false, // m_bIsWalking: andar (Shift) engatado
    stamina: 0,
    baseSpeed: 0, // teto do item na mão no tick (com 260 e sv_maxspeed), antes de andar, stamina e agachar
    maxSpeed: 0, // teto do tick = baseSpeed × walkFactor × staminaFactor × duckFactor
    walkFactor: 1, // fatores do teto do tick (o cl_showpos mostra a conta)
    staminaFactor: 1,
    duckFactor: 1,
    onGround: false,
    groundNormal: new THREE.Vector3(0, 1, 0),
    groundSurface: 0,
    surfaceFriction: 1,
    moveType: MOVETYPE.WALK,
    oldButtons: 0,
    fallVelocity: 0, // velocidade de queda no começo do tick (para o pouso)
    viewOffset: 0, // subida/descida brusca deste tick que a câmera suaviza (degrau, troca de cápsula no ar)
    stepTimer: firstStepDelay(false), // relógio dos passos (ms)
    stepFoot: 0, // pé do próximo passo (0 esquerdo, 1 direito)
    stuck: false,
  };
}

/** Copia um estado de movimento (predição e reconciliação da rede, testes de determinismo). */
export function copyMoveState(src, dst) {
  dst.origin.copy(src.origin);
  dst.velocity.copy(src.velocity);
  dst.height = src.height;
  dst.ducked = src.ducked;
  dst.ducking = src.ducking;
  dst.duckFlag = src.duckFlag;
  dst.duckHeld = src.duckHeld;
  dst.duckAmount = src.duckAmount;
  dst.duckSpeed = src.duckSpeed;
  dst.duckAnchorX = src.duckAnchorX;
  dst.duckAnchorZ = src.duckAnchorZ;
  dst.sinceDuck = src.sinceDuck;
  dst.walking = src.walking;
  dst.stamina = src.stamina;
  dst.baseSpeed = src.baseSpeed;
  dst.maxSpeed = src.maxSpeed;
  dst.walkFactor = src.walkFactor;
  dst.staminaFactor = src.staminaFactor;
  dst.duckFactor = src.duckFactor;
  dst.onGround = src.onGround;
  dst.groundNormal.copy(src.groundNormal);
  dst.groundSurface = src.groundSurface;
  dst.surfaceFriction = src.surfaceFriction;
  dst.moveType = src.moveType;
  dst.oldButtons = src.oldButtons;
  dst.fallVelocity = src.fallVelocity;
  dst.viewOffset = src.viewOffset;
  dst.stepTimer = src.stepTimer;
  dst.stepFoot = src.stepFoot;
  dst.stuck = src.stuck;
  return dst;
}

/** Teto do item na mão: mín(260, sv_maxspeed, velocidade do item no modo atual). */
function baseSpeedOf(env) {
  return Math.min(MOVE.runSpeed, env.sv.maxspeed, env.item.speed);
}

/**
 * CheckParameters do CS:GO: teto do tick pelo item na mão, portão do agachar (spam), andar (Shift: ignorado em qualquer
 * estado de agachar; engata só abaixo de teto × 0,52 + 25) e o fator da stamina com o valor de antes da recuperação.
 */
function checkParameters(s, cmd, env) {
  let max = baseSpeedOf(env);
  s.baseSpeed = max;
  s.walkFactor = 1;
  s.staminaFactor = 1;
  duckGate(s, cmd, env.sv);
  const walkButton = (cmd.buttons & BTN.WALK) !== 0 && !(s.duckHeld || s.ducking || s.duckFlag);
  if (walkButton) {
    if (s.velocity.length() < max * MOVE.walkModifier + MOVE.walkCapMargin) {
      s.walkFactor = MOVE.walkModifier;
      max *= MOVE.walkModifier;
      s.walking = true;
    }
  } else {
    s.walking = false;
  }
  if (s.stamina > 0) {
    const k = clamp01(1 - s.stamina / MOVE.staminaRange);
    s.staminaFactor = k * k; // ao quadrado: casa com a penalidade do pulo
    max *= s.staminaFactor;
  }
  s.maxSpeed = max;
}

/** ReduceTimers: a stamina recupera sv_staminarecoveryrate por segundo. */
function reduceStamina(s, sv, dt) {
  if (s.stamina > 0) s.stamina = Math.max(0, s.stamina - sv.staminarecoveryrate * dt);
}

/** Friction do Source: abaixo de sv_stopspeed o freio é o de sv_stopspeed (o jogador para de vez). */
export function friction(s, sv, dt) {
  const v = s.velocity;
  const speed = v.length();
  if (speed < 0.1) return;
  const control = speed < sv.stopspeed ? sv.stopspeed : speed;
  const drop = control * sv.friction * s.surfaceFriction * dt;
  v.multiplyScalar(Math.max(speed - drop, 0) / speed);
}

/**
 * Accelerate do CS:GO (CCSGameMovement::Accelerate), no chão. Escala e meta partem de máx(250, desejo); com
 * sv_accelerate_use_weapon_speed a meta segue a velocidade do item e a escala também, mas só correndo (ou na sniper
 * lenta com zoom); agachado e andando multiplicam por 0,34 e 0,52 (a escala não, na sniper lenta); andando, a
 * aceleração some nos últimos 5 u/s antes da meta. Ganho = mín(sv_accelerate × dt × escala × atrito, desejo − atual).
 */
export function accelerate(s, wishDir, wishSpeed, cmd, env) {
  const current = s.velocity.dot(wishDir);
  const add = wishSpeed - current;
  if (add <= 0) return;
  const cur = Math.max(0, current);
  const ducking = s.duckHeld || s.ducking || s.duckFlag;
  const walking = (cmd.buttons & BTN.WALK) !== 0 && !ducking;
  let scale = Math.max(MOVE.accelerateReference, wishSpeed);
  let goal = scale;
  let slowSniper = false;
  if (env.sv.accelerate_use_weapon_speed) {
    slowSniper = env.item.slowSniper;
    const ratio = Math.min(1, env.item.speed / MOVE.accelerateReference);
    goal *= ratio;
    if ((!ducking && !walking) || ((walking || ducking) && slowSniper)) scale *= ratio;
  }
  if (ducking) {
    if (!slowSniper) scale *= DUCK.speedMultiplier;
    goal *= DUCK.speedMultiplier;
  }
  if (walking) {
    if (!slowSniper) scale *= MOVE.walkModifier;
    goal *= MOVE.walkModifier;
  }
  let accel = env.sv.accelerate;
  if (walking && cur > goal - MOVE.walkDampWindow) accel *= clamp01((goal - cur) / MOVE.walkDampWindow);
  s.velocity.addScaledVector(wishDir, Math.min(accel * env.dt * scale * s.surfaceFriction, add));
}

/** AirAccelerate do Source: o desejo vale só até `maxWish` (30 u/s), mas a taxa usa o desejo inteiro — air-strafe. */
export function airAccelerate(s, wishDir, wishSpeed, accel, maxWish, dt) {
  const add = Math.min(wishSpeed, maxWish) - s.velocity.dot(wishDir);
  if (add <= 0) return;
  s.velocity.addScaledVector(wishDir, Math.min(accel * wishSpeed * dt * s.surfaceFriction, add));
}

/** Desejo de movimento no plano pelo yaw do comando, em u/s, limitado ao teto do tick (analógico = fração dele). */
function wishVelocity(s, cmd, out) {
  _fwd.set(-Math.sin(cmd.yaw), 0, -Math.cos(cmd.yaw));
  _right.set(Math.cos(cmd.yaw), 0, -Math.sin(cmd.yaw));
  const max = s.maxSpeed;
  out.set(0, 0, 0).addScaledVector(_fwd, cmd.forward * max).addScaledVector(_right, cmd.side * max);
  const speed = out.length();
  if (speed > max) out.multiplyScalar(max / speed);
  return out;
}

/** Direção do desejo em _wishDir; devolve o módulo. */
function wishDirection(vel) {
  const speed = vel.length();
  if (speed > 0) _wishDir.copy(vel).divideScalar(speed);
  else _wishDir.set(0, 0, 0);
  return speed;
}

/**
 * WalkMove: acelera no plano (Accelerate do CS:GO), corta a velocidade no teto do tick — o teto duro do CS:GO, que faz
 * andar, agachar e pousar frearem na hora —, desliza (ou sobe o degrau) e gruda no chão.
 */
function walkMove(s, cmd, env) {
  const { controller: ctl, dt } = env;
  const wishSpeed = wishDirection(wishVelocity(s, cmd, _wishVel));
  s.velocity.y = 0;
  accelerate(s, _wishDir, wishSpeed, cmd, env);
  s.velocity.y = 0;
  const speed = s.velocity.length();
  if (speed > s.maxSpeed) s.velocity.multiplyScalar(s.maxSpeed / speed);
  if (s.velocity.length() < CONTROLLER.minSpeed) {
    s.velocity.set(0, 0, 0);
    return;
  }
  _start.copy(s.origin);
  _dest.copy(s.origin).addScaledVector(s.velocity, dt);
  const tr = ctl.trace(s.origin, _dest, s, ctl.trFirst);
  if (tr.fraction === 1) s.origin.copy(tr.endpos);
  else ctl.stepMove(s, dt, _dest, tr);
  ctl.stayOnGround(s, Math.hypot(s.origin.x - _start.x, s.origin.z - _start.z));
}

/** AirMove: no ar só o air-accelerate controla (desejo pelo teto do tick) e a cápsula desliza pelas superfícies. */
function airMove(s, cmd, env) {
  const { controller: ctl, sv, dt } = env;
  const wishSpeed = wishDirection(wishVelocity(s, cmd, _wishVel));
  airAccelerate(s, _wishDir, wishSpeed, sv.airaccelerate, sv.air_max_wishspeed, dt);
  ctl.tryPlayerMove(s, dt);
}

/**
 * CheckJumpButton: pula do chão, com o botão solto no tick anterior (ou sv_autobunnyhopping). Sem
 * sv_enablebunnyhopping, a velocidade 3D acima de 1,1 × 260 é cortada antes de sair do chão. Impulso definido (a
 * parábola exata da 3.1) × fator da superfície × (1 − stamina/100) e a meia gravidade do tick; a stamina soma
 * sv_staminajumpcost × impulso.
 */
function checkJumpButton(s, env) {
  const { sv, dt } = env;
  if (!s.onGround) return;
  if ((s.oldButtons & BTN.JUMP) && !sv.autobunnyhopping) return;
  if (!sv.enablebunnyhopping) {
    const cap = MOVE.bunnyJumpFactor * MOVE.runSpeed;
    const spd = s.velocity.length();
    if (spd > cap) s.velocity.multiplyScalar(cap / spd);
  }
  const surface = s.groundSurface;
  env.controller.setGround(s, null);
  const speed = s.velocity.length();
  let impulse = sv.jump_impulse * SURFACES[surface].jumpFactor;
  if (s.stamina > 0) impulse *= clamp01(1 - s.stamina / MOVE.staminaRange);
  s.velocity.y = impulse - sv.gravity * 0.5 * dt;
  s.stamina = Math.min(sv.staminamax, Math.max(0, s.stamina + sv.staminajumpcost * impulse));
  env.events.push({ type: 'jump', surface, speed, audible: speed > MOVE.jumpSoundSpeed });
}

/**
 * CheckFalling: pouso do tick — no chão com velocidade de queda (do começo do tick) positiva. Quem pousou de dentro do
 * agachar (duckbug) já zerou a queda no passo do atrito e não conta. Soma a stamina do pouso; pouso pesado atrasa o
 * próximo passo.
 */
function checkFalling(s, env) {
  if (!s.onGround || s.fallVelocity <= 0) return;
  const fall = s.fallVelocity;
  const { sv } = env;
  s.stamina = Math.min(sv.staminamax, Math.max(0, s.stamina + sv.staminalandcost * fall));
  if (fall >= STEPS.roughLandSpeed) s.stepTimer = STEPS.roughLandDelay;
  env.events.push({
    type: 'land', speed: fall, surface: s.groundSurface,
    audible: fall > STEPS.landAudibleSpeed, heavy: fall >= STEPS.roughLandSpeed,
  });
  s.fallVelocity = 0;
}

/** Noclip: voo com a aceleração e o atrito da câmera livre (FREE_CAMERA), atravessando tudo. */
function noclipMove(s, cmd, dt) {
  const P = FREE_CAMERA;
  const cp = Math.cos(cmd.pitch);
  _fwd.set(-Math.sin(cmd.yaw) * cp, Math.sin(cmd.pitch), -Math.cos(cmd.yaw) * cp);
  _right.set(Math.cos(cmd.yaw), 0, -Math.sin(cmd.yaw));
  const up = (cmd.buttons & BTN.JUMP ? 1 : 0) - (cmd.buttons & BTN.DUCK ? 1 : 0);
  let speed = P.speed;
  if (cmd.buttons & BTN.WALK) speed *= P.walkFactor;
  if (cmd.buttons & BTN.ATTACK2) speed *= P.boostFactor;
  _wishVel.set(0, 0, 0).addScaledVector(_fwd, cmd.forward).addScaledVector(_right, cmd.side);
  const planar = _wishVel.length();
  if (planar > 1) _wishVel.divideScalar(planar);
  _wishVel.multiplyScalar(speed);
  _wishVel.y += up * P.verticalSpeed * (speed / P.speed);
  const wishSpeed = wishDirection(_wishVel);
  const v = s.velocity;
  const current = v.length();
  if (current > 0) {
    const drop = Math.max(current, P.stopSpeed) * P.friction * dt;
    v.multiplyScalar(Math.max(current - drop, 0) / current);
  }
  if (wishSpeed > 0) {
    const add = wishSpeed - v.dot(_wishDir);
    if (add > 0) v.addScaledVector(_wishDir, Math.min(P.accelerate * wishSpeed * dt, add));
  }
  s.origin.addScaledVector(v, dt);
}

/**
 * Um tick de movimento (PlayerMove + FullWalkMove do CS:GO). `env`: { controller, sv, dt, item: {speed, slowSniper}
 * (velocidade do item na mão no modo atual e se é sniper lenta com zoom), events: [] }. Eventos do tick em env.events:
 * step {foot, x, y, z, surface, volume, speed, audible}, jump {surface, speed, audible}, land {speed, surface, audible,
 * heavy}, duck, unduck.
 */
export function playerMove(s, cmd, env) {
  const { controller: ctl, sv, dt, events } = env;
  events.length = 0;
  s.viewOffset = 0;
  s.sinceDuck = Math.min(DUCK.sinceMax, s.sinceDuck + dt);
  if (s.moveType === MOVETYPE.NOCLIP) {
    s.baseSpeed = s.maxSpeed = baseSpeedOf(env);
    s.walkFactor = s.staminaFactor = s.duckFactor = 1;
    reduceStamina(s, sv, dt);
    noclipMove(s, cmd, dt);
    s.onGround = false;
    s.fallVelocity = 0;
    s.stuck = false;
    s.oldButtons = cmd.buttons;
    return;
  }
  checkParameters(s, cmd, env);
  reduceStamina(s, sv, dt);
  s.stuck = !ctl.resolvePenetration(s);
  if (!s.onGround) s.fallVelocity = -s.velocity.y;
  updateSteps(s, env);
  duck(s, env);
  const startY = s.origin.y; // pés no começo do movimento: pouso na beirada que a base atravessar descendo
  // Meia gravidade antes e meia depois do movimento: a posição segue a parábola exata.
  s.velocity.y -= sv.gravity * 0.5 * dt;
  // O pulo vem antes do atrito: pular no tick seguinte ao pouso não perde velocidade (bunny hop).
  if (cmd.buttons & BTN.JUMP) checkJumpButton(s, env);
  if (s.onGround) {
    s.velocity.y = 0;
    s.fallVelocity = 0;
    friction(s, sv, dt);
  }
  ctl.checkVelocity(s);
  if (s.onGround) walkMove(s, cmd, env);
  else airMove(s, cmd, env);
  ctl.categorizePosition(s, startY);
  ctl.checkVelocity(s);
  s.velocity.y -= sv.gravity * 0.5 * dt;
  if (s.onGround) s.velocity.y = 0;
  checkFalling(s, env);
  s.oldButtons = cmd.buttons;
}
