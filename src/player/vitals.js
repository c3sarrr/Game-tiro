// Vida do jogador (subfase 3.4): vida inteira com o acumulador de dano fracionário do Source
// (CBaseCombatCharacter::OnTakeDamage_Alive: a parte inteira sai agora e a fração junta até completar 1), dano por tipo
// (src/data/vitals.js: nenhum dos da 3.4 passa pelo colete), morte com causa, volta ao jogo e o dano de queda do CS:GO
// (CheckFalling + FlPlayerFallDamage) com o limite seguro de ~420 u da seção 0.6. Puro: o PlayerPawn aplica e publica
// os eventos. O dano das armas e a fórmula do colete entram na Fase 4.

import { FALL } from '../data/movement.js';
import { DAMAGE, VITALS } from '../data/vitals.js';

/** Estado da vida: dados simples (a rede serializa, a predição copia). */
export function createVitals() {
  return {
    health: VITALS.maxHealth,
    alive: true,
    accumulator: 0, // fração de dano guardada (m_flDamageAccumulator)
    lastAmount: 0, // último dano como veio (antes do acumulador)
    lastKind: null, // tipo do último dano
    lastTaken: 0, // vida que o último dano tirou
    deaths: 0,
    cause: null, // causa da última morte (src/data/vitals.js, DEATH_CAUSES)
    deadTime: 0, // s desde a morte
  };
}

/**
 * Dano de queda do CS:GO para a velocidade de queda do pouso (u/s): nada até o limite seguro (FALL.safeSpeed, a queda
 * de 420 u); depois linear, com o dano cheio (FALL.fatalDamage) em FALL.fatalSpeed, × sv_falldamage_scale.
 */
export function fallDamage(speed, sv) {
  if (!(speed > FALL.safeSpeed)) return 0;
  const k = (speed - FALL.safeSpeed) / (FALL.fatalSpeed - FALL.safeSpeed);
  return k * FALL.fatalDamage * sv.falldamage_scale;
}

/** Morte na hora (kill do console, cair para fora do set): vida 0 e a causa. false se já estava morto. */
export function killVitals(v, cause) {
  if (!v.alive) return false;
  v.health = 0;
  v.alive = false;
  v.cause = cause;
  v.deadTime = 0;
  v.deaths++;
  return true;
}

/**
 * Aplica `amount` de dano do tipo `kind`. Com `god`, morto ou sem dano, nada. A parte inteira sai da vida agora; a fração
 * vai para o acumulador e, ao completar 1, sai 1 a mais. Vida ≤ 0 mata com `cause` (padrão: o tipo). Escreve em `out`
 * { taken: vida que saiu, killed } e o devolve.
 */
export function applyDamage(v, amount, kind, { god = false, cause = kind } = {}, out = { taken: 0, killed: false }) {
  if (!DAMAGE[kind]) throw new Error(`tipo de dano desconhecido: ${kind}`);
  out.taken = 0;
  out.killed = false;
  if (!v.alive || god || !(amount > 0)) return out;
  const whole = Math.floor(amount);
  let taken = whole;
  v.accumulator += amount - whole;
  if (v.accumulator >= 1) {
    taken += 1;
    v.accumulator -= 1;
  }
  v.lastAmount = amount;
  v.lastKind = kind;
  v.lastTaken = taken;
  if (taken <= 0) return out;
  v.health -= taken;
  out.taken = taken;
  if (v.health <= 0) out.killed = killVitals(v, cause);
  return out;
}

/** Volta ao jogo: vida cheia e acumulador zerado (o último dano e as mortes ficam para o debug). */
export function respawnVitals(v) {
  v.health = VITALS.maxHealth;
  v.alive = true;
  v.accumulator = 0;
  v.cause = null;
  v.deadTime = 0;
  return v;
}

/** Morto há tempo suficiente para voltar (VITALS.respawnDelay)? */
export function readyToRespawn(v) {
  return !v.alive && v.deadTime >= VITALS.respawnDelay - 1e-9;
}
