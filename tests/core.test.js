// Testes do núcleo: RNG, eventos, loop de passo fixo, máquina de estados, store e config.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RNG, hash128, hashString } from '../src/core/rng.js';
import { EventBus, Subscriptions } from '../src/core/events.js';
import { planSteps, FixedStepLoop, FramePacer } from '../src/core/loop.js';
import { StateMachine } from '../src/core/stateMachine.js';
import { Store } from '../src/core/store.js';
import { Config, coerce } from '../src/core/config.js';
import { StopMotionClock } from '../src/core/time.js';
import { CONFIG_SCHEMA } from '../src/data/configSchema.js';

test('RNG: mesma seed → mesma sequência; seeds diferentes divergem', () => {
  const a = new RNG('partida-42');
  const b = new RNG('partida-42');
  const c = new RNG('partida-43');
  const seqA = Array.from({ length: 50 }, () => a.nextU32());
  const seqB = Array.from({ length: 50 }, () => b.nextU32());
  const seqC = Array.from({ length: 50 }, () => c.nextU32());
  assert.deepEqual(seqA, seqB);
  assert.notDeepEqual(seqA, seqC);
});

test('RNG: faixas, estado salvo/restaurado e fork determinístico', () => {
  const r = new RNG(7);
  for (let i = 0; i < 2000; i++) {
    const f = r.next();
    assert.ok(f >= 0 && f < 1);
    const n = r.int(-3, 5);
    assert.ok(Number.isInteger(n) && n >= -3 && n <= 5);
  }
  const state = r.getState();
  const next = [r.next(), r.next(), r.next()];
  r.setState(state);
  assert.deepEqual([r.next(), r.next(), r.next()], next);
  const f1 = new RNG('x').fork('spread');
  const f2 = new RNG('x').fork('spread');
  assert.equal(f1.next(), f2.next());
  assert.notEqual(new RNG('x').fork('spread').next(), new RNG('x').fork('round').next());
});

test('RNG: distribuição aproximadamente uniforme e gaussiana centrada', () => {
  const r = new RNG('dist');
  const buckets = new Array(10).fill(0);
  for (let i = 0; i < 100000; i++) buckets[Math.floor(r.next() * 10)]++;
  for (const b of buckets) assert.ok(Math.abs(b - 10000) < 500, `balde fora: ${b}`);
  let sum = 0;
  for (let i = 0; i < 20000; i++) sum += r.gaussian();
  assert.ok(Math.abs(sum / 20000) < 0.05);
  assert.equal(hash128('a').length, 4);
  assert.equal(hashString('abc'), hashString('abc'));
});

test('EventBus: on/once/off, erros isolados e cancelamento durante o emit', () => {
  const errors = [];
  const bus = new EventBus({ onError: (e) => errors.push(e.message) });
  const calls = [];
  const offA = bus.on('x', (p) => calls.push(`a${p}`));
  bus.on('x', () => {
    throw new Error('boom');
  });
  bus.once('x', (p) => calls.push(`once${p}`));
  bus.on('x', () => offA()); // cancelar no meio do emit não quebra a iteração atual
  bus.on('*', (p, type) => calls.push(`any:${type}`));
  bus.emit('x', 1);
  bus.emit('x', 2);
  assert.deepEqual(calls, ['a1', 'once1', 'any:x', 'any:x']);
  assert.deepEqual(errors, ['boom', 'boom']);
  const subs = new Subscriptions();
  let n = 0;
  subs.on(bus, 'y', () => n++);
  subs.on(bus, 'y', () => n++);
  bus.emit('y');
  subs.dispose();
  bus.emit('y');
  assert.equal(n, 2);
  assert.equal(bus.count('y'), 0);
});

test('planSteps: 64 Hz, acumulador, alpha e descarte além do limite', () => {
  const dt = 1 / 64;
  let p = planSteps(0, 1 / 60, dt, 8);
  assert.equal(p.steps, 1);
  assert.ok(p.alpha > 0 && p.alpha < 1);
  p = planSteps(0, 0.25, dt, 8);
  assert.equal(p.steps, 8);
  assert.equal(p.dropped, 8);
  assert.ok(p.accumulator < dt);
  // 10 s de quadros a 60 Hz → 640 ticks (±1: o último pode cair no quadro seguinte por arredondamento).
  let acc = 0;
  let total = 0;
  for (let i = 0; i < 600; i++) {
    const r = planSteps(acc, 1 / 60, dt, 8);
    acc = r.accumulator;
    total += r.steps;
  }
  assert.ok(total === 640 || total === 639, `ticks ${total}`);
  // Quadros a 144 Hz também convergem para 64 ticks/s.
  acc = 0;
  total = 0;
  for (let i = 0; i < 1440; i++) {
    const r = planSteps(acc, 1 / 144, dt, 8);
    acc = r.accumulator;
    total += r.steps;
  }
  assert.ok(total === 640 || total === 639, `ticks a 144 Hz ${total}`);
});

test('FixedStepLoop.frame: ticks, timescale e ordem frameStart → ticks → frame', () => {
  let t = 1000;
  const order = [];
  const loop = new FixedStepLoop({
    hz: 64,
    now: () => t,
    onTick: () => order.push('tick'),
    onFrame: () => order.push('frame'),
  });
  loop.onFrameStart = () => order.push('start');
  loop._last = t;
  t += 1000 / 32; // 2 ticks
  loop.frame(t);
  assert.deepEqual(order, ['start', 'tick', 'tick', 'frame']);
  loop.timeScale = 0.5;
  order.length = 0;
  t += 1000 / 32; // meia velocidade → 1 tick
  loop.frame(t);
  assert.deepEqual(order, ['start', 'tick', 'frame']);
  assert.equal(loop.tick, 3);
});

test('FramePacer: limite de FPS sem deriva e resistente a jitter do vsync', () => {
  const run = (refreshHz, cap, frames, jitter = 0) => {
    const p = new FramePacer();
    let shown = 0;
    for (let i = 0; i < frames; i++) {
      // rAF chegando até `jitter` ms antes/depois do vsync ideal.
      const t = (i * 1000) / refreshHz + (i % 2 ? -jitter : jitter);
      if (p.shouldPresent(t, cap)) shown++;
    }
    return shown;
  };
  assert.equal(run(60, 0, 120), 120, 'sem limite: todos');
  const c30 = run(60, 30, 120, 0.4);
  assert.ok(c30 >= 59 && c30 <= 61, `30 em 60 Hz com jitter: ${c30}`);
  const c50 = run(60, 50, 120);
  assert.ok(c50 >= 99 && c50 <= 101, `50 em 60 Hz fica em 50 (não cai para 30): ${c50}`);
  const c60 = run(144, 60, 288, 0.3);
  assert.ok(c60 >= 118 && c60 <= 122, `60 em 144 Hz: ${c60}`);
  assert.equal(run(60, 144, 120), 120, 'limite acima da taxa do monitor não descarta quadros');
});

test('StopMotionClock: 12 poses por segundo e no máximo uma troca por quadro', () => {
  const c = new StopMotionClock({ fps: 12 });
  let changes = 0;
  for (let i = 0; i < 60; i++) if (c.update(1 / 60)) changes++;
  assert.ok(changes >= 11 && changes <= 12);
  assert.equal(c.update(2), true); // travada longa: 1 troca só
  assert.ok(c.phase >= 0 && c.phase <= 1);
});

test('StateMachine: transições permitidas, proibidas e fila em ordem', async () => {
  const log = [];
  const sm = new StateMachine();
  const mk = (name) => ({
    enter: async () => log.push(`enter:${name}`),
    exit: async () => log.push(`exit:${name}`),
  });
  for (const n of ['boot', 'menu', 'lobby', 'match', 'result']) sm.register(n, mk(n));
  await sm.go('boot');
  const p1 = sm.go('menu');
  const p2 = sm.go('lobby');
  await Promise.all([p1, p2]);
  assert.equal(sm.name, 'lobby');
  await assert.rejects(() => sm.go('result'), /proibida/);
  await sm.go('match');
  await sm.go('result');
  assert.deepEqual(log, [
    'enter:boot', 'exit:boot', 'enter:menu', 'exit:menu', 'enter:lobby', 'exit:lobby', 'enter:match', 'exit:match', 'enter:result',
  ]);
});

test('Store em memória (fallback do IndexedDB): cópia estruturada e isolamento', async () => {
  const store = await Store.open({ indexedDB: null });
  assert.equal(store.persistent, false);
  const obj = { a: [1, 2], b: { c: 3 } };
  await store.put('config', 'k', obj);
  obj.a.push(99);
  assert.deepEqual(await store.get('config', 'k'), { a: [1, 2], b: { c: 3 } });
  await store.put('stats', 'k', 1);
  assert.deepEqual(await store.keys('config'), ['k']);
  await store.clear('config');
  assert.equal(await store.get('config', 'k'), undefined);
  assert.equal(await store.get('stats', 'k'), 1);
});

test('coerce: bool/number/enum/string/object', () => {
  assert.equal(coerce({ type: 'bool' }, 'on'), true);
  assert.equal(coerce({ type: 'bool' }, 'talvez'), undefined);
  assert.equal(coerce({ type: 'number', min: 0, max: 1, step: 0.05 }, 0.123), 0.1);
  assert.equal(coerce({ type: 'number', min: 0, max: 1 }, 7), 1);
  assert.equal(coerce({ type: 'number', min: 0, max: 10 }, '2,5'), 2.5);
  assert.equal(coerce({ type: 'number' }, 'abc'), undefined);
  assert.equal(coerce({ type: 'enum', options: [0, 2, 4] }, 2), 2);
  assert.equal(coerce({ type: 'enum', options: [0, 2, 4] }, 3), undefined);
  assert.equal(coerce({ type: 'string', maxLength: 3 }, 'abcdef'), 'abc');
});

test('Config: defaults, validação, eventos e persistência só do que difere do padrão', async () => {
  const store = await Store.open({ indexedDB: null });
  const events = new EventBus();
  const seen = [];
  events.on('config:change', (e) => seen.push(e.key));
  const cfg = new Config(CONFIG_SCHEMA, { events, store, saveDelayMs: 1 });
  await cfg.load();
  assert.equal(cfg.get('graphics.fov'), 100);
  assert.equal(cfg.set('graphics.fov', 300), 120); // clamp
  assert.equal(cfg.set('graphics.msaa', 3), undefined); // enum inválido
  assert.equal(cfg.get('graphics.msaa'), 4);
  cfg.set('controls.mouseSensitivity', 1.25);
  await cfg.flush();
  const saved = await store.get('config', 'user');
  assert.deepEqual(Object.keys(saved).sort(), ['controls.mouseSensitivity', 'graphics.fov']);
  const cfg2 = new Config(CONFIG_SCHEMA, { store });
  await cfg2.load();
  assert.equal(cfg2.get('controls.mouseSensitivity'), 1.25);
  assert.equal(cfg2.get('graphics.fov'), 120);
  assert.deepEqual(seen, ['graphics.fov', 'controls.mouseSensitivity']);
  assert.throws(() => cfg.get('nao.existe'));
});
