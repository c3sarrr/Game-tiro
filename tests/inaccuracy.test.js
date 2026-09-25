// Testes da inaccuracy do CS:GO (Fase 3.2): os vetores da pesquisa (docs/research/csgo-inaccuracy-notes.md, §9),
// recuperação pelo índice de recuo, disparo, sacar zera, limiar de precisão, o ápice da Deagle e o teto de 1.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SV_DEFAULTS } from '../src/data/movement.js';
import { WEAPONS, fireInterval } from '../src/data/weapons.js';
import {
  accuracyData, basePenalty, createAccuracyState, fireAccuracy, inaccuracyOf, landAccuracy, modeValue,
  precisionThreshold, recoveryTime, resetAccuracy, updateAccuracy,
} from '../src/player/inaccuracy.js';

const DT = 1 / 64;
const J = SV_DEFAULTS.jump_impulse; // 301,99 u/s, a velocidade vertical da saída do pulo
const AK = accuracyData('ak47');
const AWP = accuracyData('awp');
const DEAGLE = accuracyData('deagle');
const AK_CYCLE = fireInterval(WEAPONS.ak47);

/** Jogador para a precisão (padrão: AK parado no chão). */
const player = (o = {}) => ({
  onGround: true, ducking: false, walking: false, speed2d: 0, vy: 0, weaponSpeed: 215, ...o,
});
const parts = () => ({ base: 0, move: 0, air: 0, total: 0 });
const near = (actual, expected, msg = '') => {
  assert.ok(Math.abs(actual - expected) < 1e-6, `${msg} ${actual} ≠ ${expected}`);
};

/** Penalidade assentada no estado `p` (10 s nele) e a inaccuracy total ali. */
function settled(data, alt, p, cycle = AK_CYCLE) {
  const acc = createAccuracyState();
  for (let i = 0; i < 640; i++) updateAccuracy(acc, data, alt, p, cycle, DT);
  const out = parts();
  inaccuracyOf(acc, data, alt, p, J, out);
  return { acc, out, total: out.total };
}

test('vetores da pesquisa: AK parado, agachado, correndo, andando e no limiar de precisão', () => {
  near(settled(AK, false, player()).total, 0.00641, 'parado');
  near(settled(AK, false, player({ ducking: true })).total, 0.00481, 'agachado');
  const run = settled(AK, false, player({ speed2d: 215 }));
  near(run.total, 0.18147, 'correndo a 215');
  near(run.out.base, 0.00641, 'parte base');
  near(run.out.move, 0.17506, 'parte movimento');
  assert.equal(run.out.air, 0);
  near(settled(AK, false, player({ speed2d: 111.8, walking: true })).total, 0.058067, 'andando a 111,8');
  near(settled(AK, false, player({ speed2d: 111.8 })).total, 0.135435, '111,8 sem andar');
  near(precisionThreshold(215), 73.1, 'limiar da AK');
  near(settled(AK, false, player({ speed2d: 73.1 })).total, 0.00641, 'no limiar o movimento não pesa');
});

test('vetores da pesquisa: no ar (saída, ápice, caindo a 600) e o pouso plano até assentar', () => {
  const air = (vy) => settled(AK, false, player({ onGround: false, vy }));
  near(air(J).total, 0.24811, 'saída do pulo');
  near(air(0).total, 0.14717, 'ápice');
  near(air(-600).total, 0.303228, 'caindo a 600 u/s');
  // Pouso: com a penalidade do ar assentada, + pouso × queda; depois ela cai para a base em pé.
  const { acc } = air(0);
  landAccuracy(acc, AK, false, J);
  const out = parts();
  near(inaccuracyOf(acc, AK, false, player(), J, out), 0.220252, 'logo após o pouso');
  const after = { 1: 0.200335, 8: 0.104228, 16: 0.051155, 24: 0.026878, 32: 0.015773, 64: 0.00682 };
  for (let tick = 1; tick <= 64; tick++) {
    updateAccuracy(acc, AK, false, player(), AK_CYCLE, DT);
    if (after[tick] === undefined) continue;
    near(inaccuracyOf(acc, AK, false, player(), J, out), after[tick], `${tick} ticks depois`);
  }
});

test('vetores da pesquisa: AWP com e sem luneta; Deagle no ápice (termo do ápice de 2020) e na saída', () => {
  near(settled(AWP, true, player({ weaponSpeed: 100 })).total, 0.002, 'AWP com luneta parada');
  near(settled(AWP, false, player({ weaponSpeed: 200 })).total, 0.0808, 'AWP sem luneta parada');
  near(settled(AWP, true, player({ weaponSpeed: 100, speed2d: 100 })).total, 0.17848, 'AWP com luneta a 100 u/s');
  const deagle = (vy) => settled(DEAGLE, false, player({ onGround: false, vy, weaponSpeed: 230 })).total;
  near(deagle(0), 0.3763, 'Deagle no ápice');
  near(deagle(J), 0.59357, 'Deagle na saída do pulo');
  // Nas outras armas o ápice é 0: a fórmula volta à do código de 2017 (termo do ar zero no topo).
  assert.equal(settled(AK, false, player({ onGround: false, vy: 0 })).out.air, 0);
});

test('disparo: +disparo e índice de recuo +1; o índice decai 10× a cada 0,5 s depois de 1,1 × o intervalo', () => {
  const acc = settled(AK, false, player()).acc;
  fireAccuracy(acc, AK, false);
  const out = parts();
  near(inaccuracyOf(acc, AK, false, player(), J, out), 0.01421, 'logo após 1 tiro');
  assert.equal(acc.recoilIndex, 1);
  assert.equal(acc.sinceShot, 0);
  const after = { 1: [0.013484, 1], 12: [0.008823, 0.698], 24: [0.007157, 0.294], 32: [0.006752, 0.165] };
  for (let tick = 1; tick <= 32; tick++) {
    updateAccuracy(acc, AK, false, player(), AK_CYCLE, DT);
    const want = after[tick];
    if (!want) continue;
    near(inaccuracyOf(acc, AK, false, player(), J, out), want[0], `${tick} ticks depois`);
    assert.ok(Math.abs(acc.recoilIndex - want[1]) < 5e-4, `índice ${acc.recoilIndex} ≠ ${want[1]}`);
  }
  // Antes de 1,1 × o intervalo (0,11 s = 7 ticks) o índice não cai.
  const fresh = createAccuracyState();
  fireAccuracy(fresh, AK, false);
  for (let tick = 0; tick < 7; tick++) updateAccuracy(fresh, AK, false, player(), AK_CYCLE, DT);
  assert.equal(fresh.recoilIndex, 1);
});

test('recuperação: do tempo inicial ao final entre as balas de transição; no ar, 4 × o agachado', () => {
  const acc = createAccuracyState();
  const at = (index, p = player()) => {
    acc.recoilIndex = index;
    return recoveryTime(AK, acc, p);
  };
  near(at(0), 0.368);
  near(at(2.9), 0.368, 'conta a bala inteira (2 = início da transição)');
  near(at(3), 0.368 + (0.506 - 0.368) / 3);
  near(at(5), 0.506);
  near(at(9), 0.506);
  near(at(0, player({ ducking: true })), 0.305257);
  near(at(9, player({ ducking: true })), 0.419728);
  near(at(9, player({ onGround: false })), 0.305257 * 4, 'no ar');
  near(recoveryTime(AWP, acc, player()), 0.34539, 'sem valores finais: sempre o inicial');
  // A penalidade sobe na hora até a base e, acima dela, cai 10× a cada tempo de recuperação.
  const rise = createAccuracyState();
  updateAccuracy(rise, AK, false, player({ onGround: false }), AK_CYCLE, DT);
  near(rise.penalty, basePenalty(AK, false, player({ onGround: false })), 'subida instantânea');
  const fall = createAccuracyState();
  fall.penalty = 0.1 + 0.00641;
  for (let i = 0; i < Math.round(0.368 * 64); i++) updateAccuracy(fall, AK, false, player(), AK_CYCLE, DT);
  assert.ok(Math.abs(fall.penalty - 0.00641 - 0.01) < 5e-4, `um tempo de recuperação: ${fall.penalty}`);
});

test('sacar zera; faca, granadas e bomba sem inaccuracy; modo alt; total no máximo 1', () => {
  const acc = settled(AK, false, player({ onGround: false })).acc;
  fireAccuracy(acc, AK, false);
  resetAccuracy(acc);
  assert.deepEqual(acc, createAccuracyState());
  for (const id of ['knife', 'flash', 'he', 'c4', null]) {
    const r = settled(accuracyData(id), false, player({ speed2d: 250, onGround: false, vy: J, weaponSpeed: 250 }));
    assert.equal(r.total, 0, `${id}`);
  }
  assert.equal(modeValue(AWP, true, 'stand'), 2, 'luneta usa o valor alt');
  assert.equal(modeValue(AWP, true, 'jumpInitial'), 172.86, 'sem valor alt: o normal');
  assert.equal(modeValue(AWP, false, 'stand'), 80.8);
  near(basePenalty(AWP, true, player({ ducking: true })), 0.0015);
  const capped = createAccuracyState();
  capped.penalty = 0.95;
  const out = parts();
  assert.equal(inaccuracyOf(capped, AK, false, player({ speed2d: 215 }), J, out), 1);
  near(out.base + out.move, 0.95 + 0.17506, 'as partes continuam inteiras');
});
