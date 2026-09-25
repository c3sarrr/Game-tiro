// Testes do medidor de salto e queda (subfases 3.3 e 3.4): sequências sintéticas (pulo, queda de beirada, teleporte,
// noclip, série de bhop que quebra com 2 ticks no chão, wall-jumps do voo, dano do pouso e o recorde de wall-jumps
// seguidos) e o jogador do jogo simulado — pulo parado, pulo correndo, série de bhop perfeita, a queda de 900 u com o
// dano e um voo de dois wall-jumps entre duas paredes.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { AIR_KIND, JumpMeter } from '../src/debug/jumpMeter.js';
import { MOVE } from '../src/data/movement.js';
import { BTN } from '../src/player/moveCmd.js';
import { floor, worldOf } from './worldTestUtils.js';
import { DT, forward, idle, makePlayer, run } from './playerTestUtils.js';

const near = (a, b, eps, msg) => assert.ok(Math.abs(a - b) <= eps, `${msg}: ${a} ≠ ${b}`);

/** Estado sintético: pés em (x, y, z), velocidade no plano (vx, vz), no chão ou não. */
const st = (x, y, z, onGround, vx = 0, vz = 0, moveType = 'andar') => ({
  origin: new THREE.Vector3(x, y, z), velocity: new THREE.Vector3(vx, 0, vz), onGround, moveType,
});

test('pulo sintético: distância no plano, ápice, tempo, queda e pouso', () => {
  const m = new JumpMeter();
  m.update(st(0, 0, 0, true), []);
  m.update(st(4, 10, 0, false, 250), [{ type: 'jump' }]);
  m.update(st(8, 30, 3, false, 250), []);
  assert.equal(m.air.kind, AIR_KIND.JUMP);
  m.update(st(12, 20, 3, false, 250), []);
  m.update(st(16, 5, 3, true, 250), [{ type: 'land', speed: 180 }]);
  assert.equal(m.air, null);
  assert.equal(m.last.kind, AIR_KIND.JUMP);
  near(m.last.distance, Math.hypot(16, 3), 1e-12, 'distância');
  assert.equal(m.last.apex, 30);
  assert.equal(m.last.drop, 25);
  assert.equal(m.last.landSpeed, 180);
  near(m.last.time, 4 * DT, 1e-12, 'tempo');
  assert.equal(m.best.distance, m.last.distance);
});

test('queda de beirada sem pulo, teleporte e noclip descartam', () => {
  const m = new JumpMeter();
  m.update(st(0, 100, 0, true), []);
  m.update(st(3, 99, 0, false), []);
  assert.equal(m.air.kind, AIR_KIND.FALL);
  m.update(st(4.5, 50, 0, false), []); // quedas rápidas andam até ~55 u por tick (3500 u/s): não é teleporte
  m.update(st(6, 0, 0, true), [{ type: 'land', speed: 400 }]);
  assert.equal(m.last.kind, AIR_KIND.FALL);
  assert.equal(m.last.drop, 100);
  assert.equal(m.last.apex, 0);
  m.update(st(6, 0, 0, true), []);
  m.update(st(6, 10, 0, false), [{ type: 'jump' }]);
  m.update(st(500, 10, 0, false), []); // teleporte no meio do pulo
  assert.equal(m.air, null);
  m.update(st(500, 5, 0, true), [{ type: 'land', speed: 100 }]);
  assert.equal(m.last.kind, AIR_KIND.FALL, 'o pulo interrompido não conta');
  m.update(st(500, 50, 0, false, 0, 0, 'noclip'), []);
  assert.equal(m.air, null);
  m.reset();
  assert.equal(m.last, null);
  assert.equal(m.best.distance, 0);
});

test('wall-jumps do voo, dano do pouso e o recorde de wall-jumps seguidos (3.4)', () => {
  const m = new JumpMeter();
  m.update(st(0, 0, 0, true), []);
  m.update(st(4, 10, 0, false, 250), [{ type: 'jump' }]);
  m.update(st(8, 50, 0, false, 250), [{ type: 'walljump' }]);
  assert.equal(m.air.walls, 1);
  m.update(st(12, 90, 0, false, 250), [{ type: 'walljump' }]);
  m.update(st(16, 40, 0, false, 250), []);
  m.update(st(20, 0, 0, true, 250), [{ type: 'land', speed: 900, damage: 13.5 }]);
  assert.equal(m.last.walls, 2);
  assert.equal(m.last.damage, 13.5);
  assert.equal(m.best.walls, 2);
  m.update(st(24, 10, 0, false, 250), [{ type: 'jump' }]);
  m.update(st(28, 50, 0, false, 250), [{ type: 'walljump' }]);
  m.update(st(32, 0, 0, true, 250), [{ type: 'land', speed: 300, damage: 0 }]);
  assert.equal(m.last.walls, 1);
  assert.equal(m.best.walls, 2, 'o recorde fica');
  // Wall-jump num voo que o medidor não viu começar (teleporte no ar): o voo começa ali.
  m.interrupt();
  m.update(st(500, 300, 0, false), [{ type: 'walljump' }]);
  assert.equal(m.air.walls, 1);
  assert.equal(m.air.kind, AIR_KIND.FALL);
  m.reset();
  assert.equal(m.best.walls, 0);
});

test('interrupt (teleporte de perto): descarta o voo, fecha a série e guarda o último voo e os recordes', () => {
  const m = new JumpMeter();
  m.update(st(0, 0, 0, true), []);
  m.update(st(5, 10, 0, false, 250), [{ type: 'jump' }]);
  m.update(st(10, 0, 0, true, 250), [{ type: 'land', speed: 100 }]);
  m.update(st(15, 10, 0, false, 250), [{ type: 'jump' }]); // segundo pulo da série, ainda no ar
  const first = m.last.distance;
  m.interrupt();
  assert.equal(m.air, null);
  assert.equal(m.series, null);
  assert.equal(m.lastSeries.jumps, 2);
  assert.equal(m.last.distance, first);
  assert.equal(m.best.distance, first);
  // O teleporte levou 30 u (abaixo do limiar de 64 u por tick) e pôs no chão: não vira pouso nem voo.
  m.update(st(45, 0, 0, true), []);
  assert.equal(m.air, null);
  assert.equal(m.last.distance, first);
  m.update(st(46, 0, 0, false), []); // sai de uma beirada depois: voo novo normal
  assert.equal(m.air.kind, AIR_KIND.FALL);
});

test('série de bhop: pulos com até 1 tick no chão entre eles; 2 ticks fecham a série', () => {
  const m = new JumpMeter();
  let x = 0;
  const hop = (groundTicks) => {
    for (let g = 0; g < groundTicks; g++) m.update(st(x, 0, 0, true, 280), []);
    x += 5;
    m.update(st(x, 5, 0, false, 280), [{ type: 'jump' }]);
    for (let i = 0; i < 3; i++) {
      x += 5;
      m.update(st(x, 10, 0, false, 284), []);
    }
    x += 5;
    m.update(st(x, 0, 0, true, 286), [{ type: 'land', speed: 200 }]);
  };
  m.update(st(0, 0, 0, true), []);
  hop(0);
  hop(0);
  hop(0);
  assert.equal(m.series.jumps, 3);
  const shown = m.shownSeries;
  assert.equal(shown.running, true);
  near(shown.distance, 75, 1e-9, 'distância da série (3 pulos de 25 u)');
  assert.equal(shown.maxSpeed, 286);
  hop(1); // 2 ticks no chão (o do pouso e mais um): série nova
  assert.equal(m.series.jumps, 1);
  assert.equal(m.lastSeries.jumps, 3);
  near(m.lastSeries.time, (3 * 5 + 2) * DT, 1e-12, 'tempo: 5 ticks no ar por pulo + 1 no chão entre eles');
  near(m.lastSeries.avgSpeed, 75 / m.lastSeries.time, 1e-9, 'média');
  assert.equal(m.best.series, 3);
});

/** Um tick do jogador do jogo com o medidor alimentado depois (como o matchState faz). */
function stepper(p, m) {
  return (drive) => {
    run(p, 1, drive);
    m.update(p.state, p.env.events);
  };
}

test('simulado: pulo parado sobe 57 u e fica 48 ticks no ar; correndo cobre ~188 u; pouso a 285,5 u/s', () => {
  const ground = worldOf((b) => floor(b));
  const p = makePlayer(ground, [0, 0, 0]);
  const m = new JumpMeter();
  const step = stepper(p, m);
  for (let i = 0; i < 4; i++) step(idle);
  step((c) => {
    idle(c);
    c.buttons = BTN.JUMP;
  });
  for (let i = 0; i < 60; i++) step(idle);
  assert.equal(m.last.kind, AIR_KIND.JUMP);
  near(m.last.apex, 57, 0.01, 'ápice');
  assert.equal(Math.round(m.last.time / DT), 48, 'ticks no ar');
  near(m.last.landSpeed, 285.506623, 1e-5, 'pouso');
  near(m.last.distance, 0, 1e-9, 'parado');
  // Correndo a 250 u/s (faca): a mesma parábola levada a 250 u/s.
  const q = makePlayer(ground, [0, 0, 0]);
  const mq = new JumpMeter();
  const stepQ = stepper(q, mq);
  for (let i = 0; i < 60; i++) stepQ(forward);
  stepQ((c) => {
    forward(c);
    c.buttons = BTN.JUMP;
  });
  for (let i = 0; i < 60; i++) stepQ(forward);
  assert.ok(mq.last.distance > 180 && mq.last.distance < 195, `distância correndo ${mq.last.distance}`);
});

test('simulado: série de bhop perfeita (pulo no tick seguinte ao pouso) com teto de 286 u/s', () => {
  const ground = worldOf((b) => floor(b));
  const p = makePlayer(ground, [0, 0, 0]);
  const m = new JumpMeter();
  p.state.velocity.set(250, 0, 0);
  p.cmd.yaw = -Math.PI / 2; // olhando para +X
  let landed = true;
  for (let i = 0; i < 400; i++) {
    run(p, 1, (c) => {
      forward(c);
      c.buttons = landed ? BTN.JUMP : 0;
    });
    landed = p.env.events.some((e) => e.type === 'land');
    m.update(p.state, p.env.events);
    if (m.series?.jumps === 6 && landed) break;
  }
  const s = m.shownSeries;
  assert.equal(s.jumps, 6);
  assert.ok(s.maxSpeed <= MOVE.bunnyJumpFactor * MOVE.runSpeed + 1e-6, `máxima ${s.maxSpeed}`);
  assert.ok(s.avgSpeed > 200 && s.avgSpeed <= s.maxSpeed, `média ${s.avgSpeed}`);
  assert.ok(s.distance > 5 * 150, `distância ${s.distance}`);
});

test('simulado: queda de 900 u de uma plataforma — queda 900, pouso a ~1200 u/s', () => {
  const world = worldOf((b) => {
    floor(b);
    b.box(200, 20, 200, { center: [0, 890, 0] });
  });
  const p = makePlayer(world, [0, 900, 0]);
  p.cmd.yaw = -Math.PI / 2;
  const m = new JumpMeter();
  for (let i = 0; i < 200 && !(m.last && m.last.kind === AIR_KIND.FALL); i++) {
    run(p, 1, (c) => forward(c));
    m.update(p.state, p.env.events);
  }
  assert.equal(m.last.kind, AIR_KIND.FALL);
  near(m.last.drop, 900, 0.1, 'queda');
  near(m.last.landSpeed, Math.sqrt(2 * 800 * 900), 15, 'velocidade de pouso');
  assert.ok(m.last.damage > 55 && m.last.damage < 70, `dano do pouso ${m.last.damage}`);
  assert.equal(m.best.drop, m.last.drop);
});

test('simulado: pulo entre duas paredes com dois wall-jumps no mesmo voo (3.4)', () => {
  // Corredor de 128 u entre duas paredes altas (faces em x = ±64).
  const world = worldOf((b) => {
    floor(b);
    b.box(8, 1000, 600, { center: [68, 500, 0] });
    b.box(8, 1000, 600, { center: [-68, 500, 0] });
  });
  const p = makePlayer(world, [64 - 16 - 2, 0, 0]); // a 2 u da parede de +x
  const m = new JumpMeter();
  const step = stepper(p, m);
  for (let i = 0; i < 4; i++) step(idle);
  step((c) => {
    idle(c);
    c.buttons = BTN.JUMP;
  });
  // No ar: olhando para −x (yaw 90°), aperta o pulo a cada 2 ticks — encostado na parede de +x chuta para −x, e na de
  // −x (olhando para ela, de frente) sai pela normal, de volta para +x.
  for (let i = 0; i < 120 && !(m.last && m.last.walls); i++) {
    step((c) => {
      idle(c);
      c.yaw = Math.PI / 2;
      c.buttons = i % 2 ? BTN.JUMP : 0;
    });
  }
  assert.ok(m.last, 'pousou');
  assert.equal(m.last.walls, 2, 'duas paredes, um wall-jump em cada');
  assert.equal(m.best.walls, 2);
  assert.ok(m.last.apex > 57 + 40, `ápice ${m.last.apex}: bem acima do pulo do chão (57 u) com os dois chutes`);
});
