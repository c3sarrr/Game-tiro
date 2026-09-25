// Testes dos passos, do pulo e do pouso audíveis (Fase 3.2): cadências do CS:GO a 64 tick, primeiro passo, velocidade
// mínima, audível × silencioso por item e estado, volumes por superfície e agachado, pé alternado e o pouso pesado.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { STEPS } from '../src/data/movement.js';
import { SURFACE_INDEX } from '../src/data/surfaces.js';
import { firstStepDelay, updateSteps } from '../src/player/footsteps.js';
import { BTN } from '../src/player/moveCmd.js';
import { createMoveState } from '../src/player/movement.js';
import { floor, worldOf } from './worldTestUtils.js';
import { DT, forward, idle, makePlayer, run } from './playerTestUtils.js';

const ground = () => worldOf((b) => floor(b));

/** Passos de um jogador correndo para a frente por `ticks` ticks: [{tick, ...evento}]. */
function stepsOf(item, { ticks = 300, zoom = 0, buttons = 0 } = {}) {
  const p = makePlayer(ground(), [0, 0, 0], { item, zoom });
  const steps = [];
  for (let i = 0; i < ticks; i++) {
    for (const e of run(p, 1, (c) => {
      forward(c);
      c.buttons |= buttons;
    })) if (e.type === 'step') steps.push({ tick: i, ...e });
  }
  return steps;
}

const gaps = (steps) => steps.slice(1).map((s, i) => s.tick - steps[i].tick);

/** Estado no chão andando em +x a `speed`, com o relógio zerado (o próximo tick decide o passo). */
function moving(speed, { duckFlag = false, walking = false, surface = 'tapete' } = {}) {
  const s = createMoveState();
  s.velocity.set(speed, 0, 0);
  s.onGround = true;
  s.duckFlag = duckFlag;
  s.walking = walking;
  s.groundSurface = SURFACE_INDEX[surface];
  s.stepTimer = 0;
  return s;
}

function stepOnce(s) {
  const env = { dt: DT, events: [] };
  updateSteps(s, env);
  return env.events[0] ?? null;
}

test('cadência: faca correndo a cada 19 ticks, AK a cada 25; o primeiro passo 19 ticks depois de sair do lugar', () => {
  const knife = stepsOf('knife');
  assert.equal(knife[0].tick, 19, 'relógio de 291 ms ao sair do lugar');
  assert.ok(gaps(knife).slice(2).every((g) => g === 19), `faca: ${gaps(knife)}`);
  const ak = stepsOf('ak47');
  assert.ok(gaps(ak).slice(2).every((g) => g === 25), `AK (215 < 220, classe lenta): ${gaps(ak)}`);
  assert.equal(firstStepDelay(false), 300 * 0.97);
  assert.equal(firstStepDelay(true), 300 * 0.97 + 100);
});

test('audível × silencioso: correndo faz barulho; andar, agachar e AWP com zoom não; AUG com zoom sim', () => {
  const steady = (steps) => steps.slice(3);
  assert.ok(steady(stepsOf('knife')).every((s) => s.audible), 'faca correndo');
  assert.ok(steady(stepsOf('ak47')).every((s) => s.audible), 'AK correndo');
  const walking = stepsOf('knife', { buttons: BTN.WALK });
  assert.ok(walking.length > 5 && walking.every((s) => !s.audible), 'andando (130 u/s) não');
  assert.ok(gaps(walking).slice(2).every((g) => g === 25), 'andando: classe lenta');
  const ducked = stepsOf('knife', { buttons: BTN.DUCK });
  assert.ok(ducked.length > 3 && ducked.every((s) => !s.audible), 'agachado não');
  assert.ok(gaps(ducked).slice(1).every((g) => g === 26), 'agachado: +100 ms');
  const awp = stepsOf('awp', { zoom: 1 });
  assert.ok(awp.length > 5 && awp.every((s) => !s.audible), 'AWP com zoom (100 u/s) não');
  assert.ok(steady(stepsOf('aug', { zoom: 1 })).every((s) => s.audible), 'AUG com zoom (150 u/s) sim');
});

test('velocidade mínima: abaixo de 90 (60 agachado) não há passo; parado, o relógio volta ao primeiro passo', () => {
  assert.equal(stepOnce(moving(85)), null);
  assert.ok(stepOnce(moving(95)));
  assert.equal(stepOnce(moving(55, { duckFlag: true })), null);
  const slow = moving(65, { duckFlag: true });
  assert.ok(stepOnce(slow));
  assert.equal(slow.stepTimer, 400 * 0.97 + 100, 'agachado abaixo de 80: classe lenta + 100 ms');
  const stopped = moving(3);
  stopped.stepTimer = 12;
  assert.equal(stepOnce(stopped), null);
  assert.equal(stopped.stepTimer, 291);
  const air = moving(250);
  air.onGround = false;
  assert.equal(stepOnce(air), null, 'no ar não');
  const vertical = moving(0);
  vertical.velocity.set(0, 200, 0);
  assert.equal(stepOnce(vertical), null, 'só velocidade vertical não');
  assert.ok(Math.abs(STEPS.audibleSpeed - 260 * 0.52) < 1e-9, 'audível a partir da velocidade de andar do CS');
});

test('volume por superfície e classe, × 0,65 agachado; pé alternado; posição, superfície e velocidade', () => {
  const volume = (speed, opts) => stepOnce(moving(speed, opts)).volume;
  assert.equal(volume(250, { surface: 'metal' }), 0.7);
  assert.equal(volume(150, { surface: 'metal' }), 0.4);
  assert.equal(volume(250, { surface: 'massinha' }), 0.4);
  assert.equal(volume(150, { surface: 'tecido' }), 0.1);
  assert.ok(Math.abs(volume(85, { surface: 'metal', duckFlag: true }) - 0.7 * 0.65) < 1e-12, 'agachado a 85: rápida');
  assert.ok(Math.abs(volume(70, { surface: 'metal', duckFlag: true }) - 0.4 * 0.65) < 1e-12, 'agachado a 70: lenta');
  const s = moving(250, { surface: 'papelao' });
  s.origin.set(10, 20, 30);
  const feet = [];
  for (let i = 0; i < 3; i++) {
    s.stepTimer = 0;
    const e = stepOnce(s);
    feet.push(e.foot);
    assert.deepEqual([e.x, e.y, e.z, e.surface, e.speed], [10, 20, 30, SURFACE_INDEX.papelao, 250]);
    assert.equal(e.audible, true);
  }
  assert.deepEqual(feet, [0, 1, 0]);
  assert.equal(stepOnce(Object.assign(moving(250), { walking: true })).audible, false, 'engatado no andar: silencioso');
});

test('pulo audível acima de 126 u/s; pouso audível acima de 270 e pesado a partir de 350, que atrasa o passo', () => {
  const still = makePlayer(ground(), [0, 0, 0]);
  run(still, 4, idle);
  const quiet = run(still, 1, (c) => {
    idle(c);
    c.buttons = BTN.JUMP;
  }).find((e) => e.type === 'jump');
  assert.equal(quiet.audible, false, 'pulo parado');
  assert.equal(quiet.surface, SURFACE_INDEX.tapete);
  const runner = makePlayer(ground(), [0, 0, 0]);
  run(runner, 60, forward);
  const loud = run(runner, 1, (c) => {
    forward(c);
    c.buttons = BTN.JUMP;
  }).find((e) => e.type === 'jump');
  assert.ok(loud.audible && loud.speed > 240, `pulo correndo a ${loud.speed}`);
  // Pulo plano: pouso a ~285,5 u/s, audível e leve.
  const flat = run(still, 80, idle).find((e) => e.type === 'land');
  assert.ok(flat.audible && !flat.heavy, `pouso plano a ${flat.speed}`);
  // Queda de 200 u: ~565 u/s, pesado; o próximo passo espera 400 ms.
  const faller = makePlayer(ground(), [0, 200, 0]);
  let land = null;
  for (let i = 0; i < 64 && !land; i++) land = run(faller, 1, idle).find((e) => e.type === 'land') ?? null;
  assert.ok(land && land.heavy && land.audible, `queda a ${land?.speed}`);
  assert.equal(faller.state.stepTimer, STEPS.roughLandDelay);
  // Queda de 30 u (~219 u/s): silenciosa.
  const hop = makePlayer(ground(), [0, 30, 0]);
  const soft = run(hop, 40, idle).find((e) => e.type === 'land');
  assert.ok(soft && !soft.audible && !soft.heavy, `queda baixa a ${soft?.speed}`);
});
