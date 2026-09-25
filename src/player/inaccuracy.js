// Inaccuracy de arma do CS:GO (CWeaponCSBase: GetInaccuracy, UpdateAccuracyPenalty, GetRecoveryTime, OnLand e o
// disparo) em funções puras sobre dados simples. O PlayerPawn atualiza a penalidade a cada tick depois do movimento; a
// Fase 4 usa o total no tiro e chama o disparo. Unidades do CS: os dados de src/data/inaccuracy.js × 0,001 ≈ radianos.
// `alt` é o modo da arma (luneta, silenciador colocado ou rajada — src/player/hands.js, weaponAlt).

import { ACCURACY, INACCURACY, INACCURACY_UNIT, NO_INACCURACY } from '../data/inaccuracy.js';

const LN10 = Math.log(10);

/** RemapVal do Source, sem limitar (com a = b devolve c ou d, como o RemapValClamped). */
function remap(v, a, b, c, d) {
  if (a === b) return v >= b ? d : c;
  return c + ((d - c) * (v - a)) / (b - a);
}

/** RemapValClamped do Source. */
function remapClamped(v, a, b, c, d) {
  if (a === b) return v >= b ? d : c;
  const t = Math.min(1, Math.max(0, (v - a) / (b - a)));
  return c + (d - c) * t;
}

/** Dados de inaccuracy do item na mão (faca, granadas e bomba: nenhuma). */
export function accuracyData(itemId) {
  return INACCURACY[itemId] ?? NO_INACCURACY;
}

/** Valor do campo no modo atual: o bloco `alt` quando a arma está nele e tem o campo. */
export function modeValue(data, alt, key) {
  return alt && data.alt && data.alt[key] !== undefined ? data.alt[key] : data[key];
}

/** Estado de precisão da arma na mão (a Fase 4 guarda um por arma). */
export function createAccuracyState() {
  return { penalty: 0, recoilIndex: 0, sinceShot: ACCURACY.sinceShotMax };
}

/** Sacou a arma (Deploy do CS:GO): penalidade e índice de recuo zerados. */
export function resetAccuracy(acc) {
  acc.penalty = 0;
  acc.recoilIndex = 0;
  acc.sinceShot = ACCURACY.sinceShotMax;
  return acc;
}

/** Limiar de precisão: abaixo de 34% da velocidade da arma (no modo atual) o movimento não pesa. */
export function precisionThreshold(weaponSpeed) {
  return weaponSpeed * ACCURACY.moveFloor;
}

/**
 * Base do tick (a penalidade nunca fica abaixo dela), em radianos: no ar, em pé + pulo; com FL_DUCKING, agachado;
 * senão, em pé. `p`: {onGround, ducking}.
 */
export function basePenalty(data, alt, p) {
  let v;
  if (!p.onGround) v = modeValue(data, alt, 'stand') + modeValue(data, alt, 'jump') * ACCURACY.airScale;
  else if (p.ducking) v = modeValue(data, alt, 'crouch');
  else v = modeValue(data, alt, 'stand');
  return v * INACCURACY_UNIT;
}

/**
 * Tempo (s) em que o excesso de penalidade cai 10× (GetRecoveryTime): no ar, o agachado × 4; no chão, o de em pé ou
 * agachado, indo do inicial ao final entre as balas de transição pelo índice de recuo.
 */
export function recoveryTime(data, acc, p) {
  if (!p.onGround) return data.recoveryCrouch * ACCURACY.airRecoveryFactor;
  const initial = p.ducking ? data.recoveryCrouch : data.recoveryStand;
  const final = p.ducking ? data.recoveryCrouchFinal : data.recoveryStandFinal;
  if (final === undefined) return initial;
  return remapClamped(Math.trunc(acc.recoilIndex), data.transitionStart, data.transitionEnd, initial, final);
}

/**
 * Um tick de precisão (UpdateAccuracyPenalty), com o jogador depois do movimento: a penalidade sobe na hora até a
 * base e, acima dela, cai 10× a cada tempo de recuperação; o índice de recuo decai 10× a cada 1/2 s depois de 1,1 × o
 * intervalo entre tiros (`cycleTime`) sem atirar. `p`: {onGround, ducking}.
 */
export function updateAccuracy(acc, data, alt, p, cycleTime, dt) {
  const base = basePenalty(data, alt, p);
  if (base > acc.penalty) acc.penalty = base;
  else acc.penalty = base + (acc.penalty - base) * Math.exp((-dt * LN10) / recoveryTime(data, acc, p));
  acc.sinceShot = Math.min(ACCURACY.sinceShotMax, acc.sinceShot + dt);
  if (acc.sinceShot > cycleTime * ACCURACY.recoilDecayThreshold) {
    acc.recoilIndex *= Math.exp(-dt * LN10 * ACCURACY.recoilDecayCoefficient);
  }
  return acc;
}

/** Pouso (OnLand): + pouso × velocidade de queda (crua, em u/s). */
export function landAccuracy(acc, data, alt, fallSpeed) {
  acc.penalty += modeValue(data, alt, 'land') * INACCURACY_UNIT * fallSpeed;
  return acc;
}

/** Disparo (para a Fase 4 chamar depois do tiro): + disparo; índice de recuo +1. */
export function fireAccuracy(acc, data, alt) {
  acc.penalty += modeValue(data, alt, 'fire') * INACCURACY_UNIT;
  acc.recoilIndex += 1;
  acc.sinceShot = 0;
  return acc;
}

/**
 * Inaccuracy do tiro (GetInaccuracy): penalidade + movimento + ar, no máximo 1 (radianos). Movimento: a velocidade no
 * plano entre 34% e 95% da velocidade da arma (no modo atual) vira 0…1, elevada a 0,25 (andando com Shift, linear), ×
 * movimento. Ar: a raiz de |vy| entre 0,25·√impulso e √impulso vai do ápice ao ar inicial, limitada a [ápice,
 * 2 × ar inicial] (o ápice só existe na Deagle; nas outras é 0). Escreve as partes em `out` ({base, move, air, total}).
 * `p`: {onGround, walking, speed2d, vy, weaponSpeed}.
 */
export function inaccuracyOf(acc, data, alt, p, jumpImpulse, out) {
  let move = remapClamped(p.speed2d, p.weaponSpeed * ACCURACY.moveFloor, p.weaponSpeed * ACCURACY.moveCeil, 0, 1);
  if (move > 0) {
    if (!p.walking) move = Math.pow(move, ACCURACY.moveExponent);
    move *= modeValue(data, alt, 'move') * INACCURACY_UNIT;
  }
  let air = 0;
  if (!p.onGround) {
    const initial = data.jumpInitial * INACCURACY_UNIT * ACCURACY.airScale;
    const apex = (data.jumpApex ?? 0) * INACCURACY_UNIT * ACCURACY.airScale;
    const root = Math.sqrt(jumpImpulse);
    air = remap(Math.sqrt(Math.abs(p.vy)), ACCURACY.airFloorFraction * root, root, apex, initial);
    air = Math.min(Math.max(air, apex), ACCURACY.airMaxFactor * initial);
  }
  out.base = acc.penalty;
  out.move = move;
  out.air = air;
  out.total = Math.min(ACCURACY.max, acc.penalty + move + air);
  return out.total;
}
