// Testes do wall-jump (subfase 3.4) a 64 tick: o chute (para onde olha, no mínimo 30° para fora, espelhado olhando para
// a parede; piso na velocidade do item e teto de 286; 289,41 × stamina na vertical e o custo de um pulo), buffer de
// 0,15 s, tolerância de 0,12 s, subida máxima, espera de 0,35 s, a mesma parede só depois do chão (grupo, faces de uma
// caixa, painéis no mesmo plano, facetas do tubo dentro de 45°), sv_walljump 0 e o pulo do CS no chão.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HULL, WALLJUMP } from '../src/data/movement.js';
import { BTN } from '../src/player/moveCmd.js';
import { createSvVars } from '../src/player/movementVars.js';
import { kickDirection } from '../src/player/wallJump.js';
import { floor, worldOf } from './worldTestUtils.js';
import { DT, idle, makePlayer, run, speed2d } from './playerTestUtils.js';

const R = HULL.radius;
const DEG = Math.PI / 180;
const near = (a, b, eps, msg = '') => assert.ok(Math.abs(a - b) <= eps, `${msg} ${a} ≠ ${b}`);
const jump = (c) => {
  idle(c);
  c.buttons = BTN.JUMP;
};
const kicks = (events) => events.filter((e) => e.type === 'walljump');

// Parede alta com a face em x = 100 (normal −x).
const wallWorld = (extra = null) => worldOf((b) => {
  floor(b);
  b.box(8, 2000, 400, { center: [104, 1000, 0], surface: 'madeira' });
  extra?.(b);
});

/**
 * Jogador parado no ar (sv_gravity 0: não cai) com os pés em (x, y, z) e o olhar `yaw`; `v` = velocidade no plano
 * inicial [vx, vz].
 */
function hover(world, [x, y, z], { yaw = 0, item = 'knife', v = [0, 0], gravity = 0 } = {}) {
  const sv = createSvVars();
  sv.gravity = gravity;
  const p = makePlayer(world, [x, y, z], { yaw, item, sv });
  p.state.velocity.set(v[0], 0, v[1]);
  return p;
}

test('o chute: olhando ao longo da parede sai a 30° dela com a velocidade da faca; vertical 289,41 e a stamina de um pulo', () => {
  const p = hover(wallWorld(), [100 - R - 2, 300, 0], { gravity: 800 });
  run(p, 1, idle); // a sonda acha a parede no fim do tick
  assert.equal(p.state.wallTime, 0);
  const ev = kicks(run(p, 1, jump));
  assert.equal(ev.length, 1);
  const e = ev[0];
  near(e.nx, -1, 1e-9, 'normal da parede');
  near(e.speed, 250, 1e-9, 'piso: a velocidade da faca');
  assert.equal(e.count, 1);
  const v = p.state.velocity;
  near(v.x, -250 * Math.sin(30 * DEG), 1e-9, 'para fora da parede');
  near(v.z, -250 * Math.cos(30 * DEG), 1e-9, 'ao longo do olhar');
  near(v.y, p.sv.walljump_up - p.sv.gravity * DT, 1e-9, 'impulso − a gravidade do tick');
  near(p.sv.walljump_up, 301.993377 * (9.2 / 9.6), 1e-9, '0,958 do pulo');
  near(p.state.stamina, p.sv.staminajumpcost * p.sv.walljump_up, 1e-9, 'stamina de um pulo');
  // Com stamina, o impulso cai como o do pulo.
  const q = hover(wallWorld(), [100 - R - 2, 300, 0]);
  run(q, 1, idle);
  q.state.stamina = 50;
  run(q, 1, jump);
  near(q.state.velocity.y, q.sv.walljump_up * (1 - (50 - q.sv.staminarecoveryrate * DT) / 100), 1e-9, 'impulso × (1 − stamina/100)');
});

test('direção: de frente para a parede sai pela normal; ao longo, a 30°; para fora, como olha; em diagonal, espelhada', () => {
  const out = { x: 0, z: 0 };
  const dir = (yawDeg) => kickDirection(yawDeg * DEG, -1, 0, out); // parede com a normal −x (olhar = (−sen yaw, −cos yaw))
  dir(-90); // olhando para +x: de frente para a parede
  near(out.x, -1, 1e-9, 'de frente: pela normal');
  near(out.z, 0, 1e-9, 'de frente: pela normal');
  dir(0); // olhando para −z: ao longo
  near(out.x, -Math.sin(30 * DEG), 1e-9, 'ao longo: 30° para fora');
  near(out.z, -Math.cos(30 * DEG), 1e-9, 'ao longo: 30° para fora');
  dir(60); // olhando 60° para fora da parede (componente para fora sen 60° ≥ sen 30°)
  near(out.x, -Math.sin(60 * DEG), 1e-9, 'para fora: como olha');
  near(out.z, -Math.cos(60 * DEG), 1e-9, 'para fora: como olha');
  dir(-45); // 45° para dentro da parede: espelhado, sai 45° para fora
  near(out.x, -Math.sin(45 * DEG), 1e-9, 'espelhado');
  near(out.z, -Math.cos(45 * DEG), 1e-9, 'espelhado');
  dir(-10); // 10° para dentro: espelhado vira 10° para fora, abaixo do mínimo: 30°
  near(out.x, -Math.sin(30 * DEG), 1e-9, 'mínimo de 30°');
});

test('velocidade no plano: a atual, com piso na do item (faca 250, AK 215) e teto de 286', () => {
  const speedOf = (item, v) => {
    const p = hover(wallWorld(), [100 - R - 2, 300, 0], { item, v: [0, -v] });
    run(p, 1, idle);
    return kicks(run(p, 1, jump))[0].speed;
  };
  near(speedOf('knife', 0), 250, 1e-9, 'faca parada');
  near(speedOf('ak47', 0), 215, 1e-9, 'AK parada');
  near(speedOf('knife', 270), 270, 1e-9, 'mais rápido que o item');
  near(speedOf('knife', 400), 286, 1e-9, 'teto (sv_walljump_maxspeed)');
});

test('buffer de 0,15 s: um aperto no ar vale até 9 ticks depois; tolerância de 0,12 s depois de sair da parede', () => {
  // Aperta longe da parede; k ticks depois o contato aparece (a sonda o acha no fim do tick k − 1).
  const buffered = (k) => {
    const p = hover(wallWorld(), [0, 300, 0]);
    run(p, 1, jump);
    run(p, k - 2, idle);
    p.state.origin.x = 100 - R - 2;
    run(p, 1, idle);
    return kicks(run(p, 1, idle)).length === 1;
  };
  assert.equal(buffered(9), true, 'contato 9 ticks depois do aperto (0,14 s)');
  assert.equal(buffered(10), false, '10 ticks (0,156 s)');
  // Encostado no tick 0, longe a partir do 1; o aperto no tick k vale se a idade do contato (k − 1 ticks) ≤ 0,12 s.
  const grace = (k) => {
    const p = hover(wallWorld(), [100 - R - 2, 300, 0]);
    run(p, 1, idle);
    p.state.origin.x = 0;
    run(p, k - 1, idle);
    return kicks(run(p, 1, jump)).length === 1;
  };
  assert.equal(grace(8), true, 'contato de 7 ticks atrás (0,109 s)');
  assert.equal(grace(9), false, 'contato de 8 ticks atrás (0,125 s)');
});

test('subida máxima: logo depois do pulo do chão não vale; abaixo de 220,2 u/s vale', () => {
  const p = makePlayer(wallWorld(), [100 - R - 0.5, 0, 0]);
  run(p, 2, idle);
  run(p, 1, jump); // pulo do CS, colado na parede
  assert.equal(p.state.onGround, false);
  let kickVy = null;
  for (let i = 0; i < 20 && kickVy === null; i++) {
    const vy = p.state.velocity.y;
    if (kicks(run(p, 1, i % 2 ? jump : idle)).length) kickVy = vy - p.sv.gravity * 0.5 * DT;
  }
  assert.ok(kickVy !== null, 'houve wall-jump');
  assert.ok(kickVy <= WALLJUMP.maxRise * p.sv.jump_impulse && kickVy > WALLJUMP.maxRise * p.sv.jump_impulse - 13,
    `subida no chute ${kickVy}`);
});

test('espera de 0,35 s entre wall-jumps; a mesma parede só depois do chão', () => {
  // Duas paredes: a face em x = 100 e outra em x = −100 (normal +x).
  const world = wallWorld((b) => b.box(8, 2000, 400, { center: [-104, 1000, 0] }));
  const p = hover(world, [100 - R - 2, 300, 0]);
  run(p, 1, idle);
  assert.equal(kicks(run(p, 1, jump)).length, 1);
  const kicked = p.cmd.tick;
  p.state.origin.x = -100 + R + 2; // encostado na outra parede
  p.state.velocity.set(0, 0, 0);
  let second = null;
  for (let i = 0; i < 40 && second === null; i++) {
    if (kicks(run(p, 1, i % 2 ? idle : jump)).length) second = p.cmd.tick - kicked;
  }
  assert.ok(second >= Math.ceil(WALLJUMP.cooldown / DT) && second <= Math.ceil(WALLJUMP.cooldown / DT) + 1,
    `segundo wall-jump ${second} ticks depois (espera de 0,35 s = 22,4 ticks)`);
  // De volta à primeira: já usada neste voo.
  p.state.origin.x = 100 - R - 2;
  p.state.velocity.set(0, 0, 0);
  let again = 0;
  for (let i = 0; i < 60; i++) again += kicks(run(p, 1, i % 2 ? idle : jump)).length;
  assert.equal(again, 0, 'a mesma parede no mesmo voo');
  assert.equal(p.state.wallJumps, 2);
  // No chão a lista zera: pulando de novo, a primeira volta a valer.
  p.sv.gravity = 800;
  for (let i = 0; i < 200 && !p.state.onGround; i++) run(p, 1, idle);
  assert.equal(p.state.onGround, true);
  assert.equal(p.state.usedCount, 0);
  assert.equal(p.state.wallJumps, 0);
  run(p, 1, jump);
  let ok = 0;
  for (let i = 0; i < 40; i++) ok += kicks(run(p, 1, i % 2 ? jump : idle)).length;
  assert.equal(ok, 1, 'depois do chão, de novo');
});

/** Chuta de uma parede em (x, z) com a normal (nx, nz) e depois tenta outra; true se o segundo chute saiu. */
function secondKick(world, first, other) {
  const p = hover(world, first, { yaw: 0 });
  run(p, 1, idle);
  assert.equal(kicks(run(p, 1, jump)).length, 1, 'primeiro chute');
  p.state.wallJumpCooldown = 0; // só a regra da parede usada importa aqui
  p.state.origin.set(other[0], other[1], other[2]);
  p.state.velocity.set(0, 0, 0);
  run(p, 1, idle);
  return kicks(run(p, 1, jump)).length === 1;
}

test('"a mesma parede": grupo = uma; faces de uma caixa e painéis separados no mesmo plano = diferentes; tubo dentro de 45°', () => {
  const y = 300;
  const x = 100 - R - 2;
  const group = worldOf((b) => {
    floor(b);
    b.box(8, 2000, 200, { center: [104, 1000, -100], part: 'g' });
    b.box(8, 2000, 200, { center: [104, 1000, 100], part: 'g' });
  });
  assert.equal(secondKick(group, [x, y, -100], [x, y, 100]), false, 'grupo: uma parede só');
  const panels = worldOf((b) => {
    floor(b);
    b.box(8, 2000, 200, { center: [104, 1000, -100] });
    b.box(8, 2000, 200, { center: [104, 1000, 100] });
  });
  assert.equal(secondKick(panels, [x, y, -100], [x, y, 100]), true, 'painéis separados no mesmo plano');
  // Pilar 200 × 200: a face oeste (normal −x) e a face sul (normal +z) são paredes diferentes da mesma peça.
  const pillar = worldOf((b) => {
    floor(b);
    b.box(200, 2000, 200, { center: [200, 1000, 0] });
  });
  assert.equal(secondKick(pillar, [100 - R - 2, y, 0], [200, y, 100 + R + 2]), true, 'faces da caixa');
  // Tubo de raio 200 (32 facetas): 30° adiante é a mesma parede, 60° adiante não.
  const tube = () => worldOf((b) => {
    floor(b);
    b.cylinder(200, 2000, { segments: 32 });
  });
  const around = (deg) => [Math.cos(deg * DEG) * (200 + R + 2), y, -Math.sin(deg * DEG) * (200 + R + 2)];
  assert.equal(secondKick(tube(), around(0), around(30)), false, 'tubo: 30° adiante');
  assert.equal(secondKick(tube(), around(0), around(60)), true, 'tubo: 60° adiante');
});

test('sv_walljump 0 não chuta; no chão, colado na parede, o Espaço é o pulo do CS', () => {
  const p = hover(wallWorld(), [100 - R - 2, 300, 0]);
  p.sv.walljump = 0;
  run(p, 1, idle);
  assert.equal(kicks(run(p, 4, (c, i) => (i % 2 ? idle(c) : jump(c)))).length, 0);
  const g = makePlayer(wallWorld(), [100 - R - 0.5, 0, 0]);
  run(g, 2, idle);
  const ev = run(g, 1, jump);
  assert.equal(ev.filter((e) => e.type === 'jump').length, 1);
  assert.equal(kicks(ev).length, 0);
  assert.ok(speed2d(g.state) < 1e-9, 'o pulo do chão não empurra para fora da parede');
});
