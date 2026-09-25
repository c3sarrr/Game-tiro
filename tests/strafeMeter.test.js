// Testes do medidor de counter-strafe (Fase 3.2): sequências sintéticas na telemetria (soltar, contra, cancelar, sair
// do chão, média, melhor, janela) e o counter-strafe real da AK simulado pelo PlayerPawn (contra 5 × soltar 13 ticks).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { STRAFE_KIND, StrafeMeter } from '../src/debug/strafeMeter.js';
import { Loadout } from '../src/player/loadout.js';
import { PlayerPawn } from '../src/player/playerPawn.js';
import { createSvVars } from '../src/player/movementVars.js';
import { TELEMETRY_SIZE, TFLAG, Telemetry } from '../src/player/telemetry.js';
import { floor, worldOf } from './worldTestUtils.js';

const THRESHOLD = 73.1; // AK: 215 × 0,34
const TICK_MS = 1000 / 64;

/** Uma amostra: velocidade em +x, desejo em (wx, wz), no chão (ou não). */
function sample(t, speed, [wx, wz], { ground = true, vx = speed } = {}) {
  t.record(speed, 215, 215, THRESHOLD, 0, wx, wz, vx, 0, ground ? TFLAG.GROUND : 0);
}

/** Telemetria com `n` ticks correndo em +x a 215 (desejo junto da velocidade). */
function running(n = 3) {
  const t = new Telemetry();
  for (let i = 0; i < n; i++) sample(t, 215, [1, 0]);
  return t;
}

test('soltar: do tick em que largou até o primeiro abaixo do limiar', () => {
  const t = running();
  const meter = new StrafeMeter().updateFrom(t);
  for (const v of [180, 150, 120, 90]) sample(t, v, [0, 0]);
  meter.updateFrom(t);
  assert.equal(meter.kind, STRAFE_KIND.RELEASE, 'medindo');
  sample(t, 70, [0, 0]);
  meter.updateFrom(t);
  const s = meter.scores[STRAFE_KIND.RELEASE];
  assert.equal(meter.kind, null);
  assert.equal(s.count, 1);
  assert.equal(s.lastTicks, 5);
  assert.equal(s.last, 5 * TICK_MS);
  assert.equal(s.best, s.last);
  assert.equal(s.avg, s.last);
  assert.deepEqual(meter.marks, [{ kind: STRAFE_KIND.RELEASE, ticks: 5, ms: 5 * TICK_MS, end: t.count - 1 }]);
});

test('contra: desejo contra a velocidade (cosseno < −0,5); de lado não conta', () => {
  const t = running();
  const meter = new StrafeMeter();
  sample(t, 150, [-1, 0]);
  sample(t, 100, [-1, 0]);
  sample(t, 60, [-1, 0]);
  meter.updateFrom(t);
  assert.equal(meter.scores[STRAFE_KIND.COUNTER].lastTicks, 3);
  assert.equal(meter.scores[STRAFE_KIND.RELEASE].count, 0);
  const side = running();
  const other = new StrafeMeter();
  sample(side, 200, [0, 1]); // desejo de lado (cosseno 0): nem soltou nem contra
  sample(side, 60, [0, 1]);
  other.updateFrom(side);
  assert.equal(other.scores[STRAFE_KIND.COUNTER].count + other.scores[STRAFE_KIND.RELEASE].count, 0);
  const diagonal = running();
  const back = new StrafeMeter();
  sample(diagonal, 150, [-Math.SQRT1_2, Math.SQRT1_2]); // cosseno −0,707: ainda é contra
  sample(diagonal, 60, [-Math.SQRT1_2, Math.SQRT1_2]);
  back.updateFrom(diagonal);
  assert.equal(back.scores[STRAFE_KIND.COUNTER].lastTicks, 2);
});

test('cancela se o desejo voltar para o lado do movimento ou se sair do chão; e recomeça depois', () => {
  const t = running();
  const meter = new StrafeMeter();
  sample(t, 180, [0, 0]);
  sample(t, 190, [1, 0]); // voltou a correr: cancela
  meter.updateFrom(t);
  assert.equal(meter.kind, null);
  assert.equal(meter.canceled, 1);
  sample(t, 180, [0, 0]); // soltou de novo: nova medida
  sample(t, 150, [0, 0], { ground: false }); // pulou: cancela
  meter.updateFrom(t);
  assert.equal(meter.canceled, 2);
  assert.equal(meter.scores[STRAFE_KIND.RELEASE].count, 0);
  // Abaixo do limiar ou sem vir correndo: não começa.
  const slow = new Telemetry();
  for (let i = 0; i < 3; i++) sample(slow, 60, [1, 0]);
  sample(slow, 40, [0, 0]);
  const idle = new StrafeMeter().updateFrom(slow);
  assert.equal(idle.kind, null);
  assert.equal(idle.canceled, 0);
});

test('placar: última, melhor e média das 10 últimas de cada tipo; marcas somem com a janela; reset', () => {
  const t = running();
  const meter = new StrafeMeter();
  const counter = (ticks) => {
    for (let i = 0; i < 3; i++) sample(t, 215, [1, 0]);
    for (let i = 1; i < ticks; i++) sample(t, 150, [-1, 0]);
    sample(t, 50, [-1, 0]);
    meter.updateFrom(t);
  };
  for (const n of [3, 5, 4]) counter(n);
  const s = meter.scores[STRAFE_KIND.COUNTER];
  assert.equal(s.count, 3);
  assert.equal(s.last, 4 * TICK_MS);
  assert.equal(s.best, 3 * TICK_MS);
  assert.equal(s.avg, 4 * TICK_MS);
  for (let i = 0; i < 10; i++) counter(6);
  assert.equal(s.count, 13);
  assert.equal(s.recent.length, 10);
  assert.equal(s.avg, 6 * TICK_MS, 'as 3 primeiras saíram da média');
  assert.equal(s.best, 3 * TICK_MS, 'a melhor fica');
  assert.ok(meter.marks.length > 0);
  for (let i = 0; i < TELEMETRY_SIZE; i++) sample(t, 0, [0, 0]);
  meter.updateFrom(t);
  assert.equal(meter.marks.length, 0, 'fora da janela de 4 s');
  meter.reset();
  assert.equal(meter.scores[STRAFE_KIND.COUNTER].count, 0);
  assert.equal(meter.canceled, 0);
  // Telemetria zerada: o medidor recomeça junto.
  t.reset();
  for (let i = 0; i < 3; i++) sample(t, 215, [1, 0]);
  sample(t, 60, [0, 0]);
  meter.updateFrom(t);
  assert.equal(meter.scores[STRAFE_KIND.RELEASE].lastTicks, 1);
});

test('counter-strafe real da AK no PlayerPawn: contra 5 ticks (78 ms) × soltar 13 (203 ms)', () => {
  const loadout = new Loadout();
  loadout.give('ak47');
  const pawn = new PlayerPawn({
    world: worldOf((b) => floor(b)), sv: createSvVars(), loadout, position: new THREE.Vector3(0, 0, 0),
  });
  assert.equal(pawn.hands.item, 'ak47');
  const input = { move: { x: 0, y: 0 }, isDown: () => false };
  const meter = new StrafeMeter();
  let tick = 0;
  const hold = (x, ticks) => {
    input.move.x = x;
    for (let i = 0; i < ticks; i++) {
      pawn.tick(1 / 64, input, { tick: tick++ });
      meter.updateFrom(pawn.telemetry);
    }
  };
  hold(1, 100);
  hold(-1, 10);
  hold(0, 40);
  hold(1, 100);
  hold(0, 30);
  const counter = meter.scores[STRAFE_KIND.COUNTER];
  const release = meter.scores[STRAFE_KIND.RELEASE];
  assert.equal(counter.count, 1);
  assert.equal(counter.lastTicks, 5);
  assert.ok(Math.abs(counter.last - 78.125) < 1e-9);
  assert.equal(release.count, 1);
  assert.equal(release.lastTicks, 13);
  assert.ok(Math.abs(release.last - 203.125) < 1e-9);
});
