// Cenários do controlador e do movimento (Fase 3.1), sem navegador: números do Source, repouso no chão, aceleração
// do CS, parede, quina aguda, degraus, rampas, descer escada grudado, teto, pulo (57 u), pulo agachado (64 × 72),
// beirada, túnel baixo, noclip, pouso e determinismo.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { RNG } from '../src/core/rng.js';
import { CONTROLLER, HULL, SV_DEFAULTS } from '../src/data/movement.js';
import { SURFACE_INDEX } from '../src/data/surfaces.js';
import { BTN, createMoveCmd } from '../src/player/moveCmd.js';
import { MOVETYPE, accelerate, airAccelerate, copyMoveState, createMoveState, friction } from '../src/player/movement.js';
import { clipVelocity } from '../src/physics/characterController.js';
import { floor, worldOf } from './worldTestUtils.js';
import { DT, forward, idle, itemEnv, makePlayer, run, speed2d } from './playerTestUtils.js';

const SKIN = CONTROLLER.skin;
const R = HULL.radius;
const DEG = Math.PI / 180;

test('números do Source: corte contra plano, atrito, aceleração e aceleração no ar', () => {
  const out = new THREE.Vector3();
  clipVelocity(new THREE.Vector3(3, -4, 0), new THREE.Vector3(0, 1, 0), out, 1);
  assert.ok(out.distanceTo(new THREE.Vector3(3, 0, 0)) < 1e-12);
  const s = createMoveState();
  s.velocity.set(250, 0, 0);
  friction(s, SV_DEFAULTS, DT);
  assert.ok(Math.abs(s.velocity.x - 250 * (1 - 5.2 / 64)) < 1e-9);
  s.velocity.set(50, 0, 0);
  friction(s, SV_DEFAULTS, DT);
  assert.ok(Math.abs(s.velocity.x - (50 - (80 * 5.2) / 64)) < 1e-9, 'abaixo do stopspeed freia pelo stopspeed');
  s.velocity.set(0, 0, 0);
  // Correndo com a faca, o Accelerate do CS:GO dá o mesmo ganho do Source: sv_accelerate × dt × 250.
  const env = { sv: SV_DEFAULTS, dt: DT, item: itemEnv('knife') };
  accelerate(s, new THREE.Vector3(1, 0, 0), 250, createMoveCmd(), env);
  assert.ok(Math.abs(s.velocity.x - (5.5 * 250) / 64) < 1e-9);
  s.velocity.set(0, 0, 0);
  airAccelerate(s, new THREE.Vector3(0, 0, 1), 250, 12, 30, DT);
  assert.ok(Math.abs(s.velocity.z - 30) < 1e-9, 'no ar o desejo fica em 30 u/s');
});

test('repouso: pousa no chão exatamente na folga e para', () => {
  const p = makePlayer(worldOf((b) => floor(b)), [0, 30, 0]);
  const events = run(p, 64, idle);
  assert.ok(p.state.onGround);
  assert.ok(Math.abs(p.state.origin.y - SKIN) < 2e-3, `y ${p.state.origin.y}`);
  assert.ok(p.state.velocity.length() < 1e-9);
  assert.equal(events.filter((e) => e.type === 'land').length, 1);
});

test('chão: acelera até a velocidade da faca (250 u/s) e para sozinho pelo atrito', () => {
  const p = makePlayer(worldOf((b) => floor(b)), [0, 0, 0]);
  run(p, 128, forward);
  assert.ok(Math.abs(speed2d(p.state) - 250) < 1e-6, `velocidade ${speed2d(p.state)}`);
  assert.ok(p.state.velocity.z < 0, 'yaw 0 anda para −Z');
  let ticks = 0;
  while (speed2d(p.state) > 0 && ticks < 128) {
    run(p, 1, idle);
    ticks++;
  }
  assert.ok(ticks > 5 && ticks < 64, `parou em ${ticks} ticks`);
});

test('parede: deslizando na diagonal nunca entra e continua andando ao longo dela', () => {
  const p = makePlayer(worldOf((b) => {
    floor(b);
    b.box(2000, 200, 20, { center: [0, 100, -110] }); // face em z = −100
  }), [0, 0, 0]);
  let minZ = Infinity;
  run(p, 192, (cmd, i, q) => {
    cmd.forward = Math.SQRT1_2;
    cmd.side = Math.SQRT1_2;
    cmd.buttons = 0;
    minZ = Math.min(minZ, q.state.origin.z);
  });
  minZ = Math.min(minZ, p.state.origin.z);
  assert.ok(minZ >= -100 + R + SKIN - 2e-3, `entrou na parede (z ${minZ})`);
  assert.ok(p.state.origin.x > 400, `não deslizou (x ${p.state.origin.x})`);
});

test('quina aguda (40°): para no vértice sem tremer e sem penetrar', () => {
  const half = 20 * DEG;
  const apex = new THREE.Vector3(0, 0, -300);
  const world = worldOf((b) => {
    floor(b);
    for (const side of [-1, 1]) {
      const far = new THREE.Vector3(apex.x + side * Math.sin(half) * 400, 0, apex.z + Math.cos(half) * 400);
      b.quad(apex, far, far.clone().setY(200), apex.clone().setY(200), 'papelao');
    }
  });
  const p = makePlayer(world, [0, 0, 0]);
  const positions = [];
  run(p, 256, (cmd, i, q) => {
    forward(cmd);
    const o = q.state.origin;
    if (!world.canOccupy(o.x, o.y, o.z, R, q.state.height)) assert.fail(`penetrou no tick ${i}`);
    positions.push(o.clone());
  });
  const last = positions.slice(-32);
  const drift = last[0].distanceTo(last[last.length - 1]);
  assert.ok(drift < 0.05, `tremendo na quina (${drift})`);
  assert.ok(p.state.origin.z > apex.z, 'passou da quina');
});

test('degraus: sobe escada de 16 u, sobe o limite de 18 u e barra o de 20 u', () => {
  const stairs = worldOf((b) => {
    floor(b);
    b.stairs(200, 16, 32, 8, { center: [0, 0, 100] });
    b.box(200, 128, 2000, { center: [0, 64, 356 + 1000] }); // platô no topo
  });
  const p = makePlayer(stairs, [0, 0, 0], { yaw: Math.PI }); // yaw π anda para +Z
  run(p, 256, forward);
  assert.ok(Math.abs(p.state.origin.y - (8 * 16 + SKIN)) < 2e-3, `topo da escada: y ${p.state.origin.y}`);
  assert.ok(p.state.onGround);
  // Agachado (85 u/s) e partindo parado, encostado no espelho: com qualquer avanço a base chata pousa no degrau.
  const slow = makePlayer(stairs, [0, 0, 100 - R - SKIN], { yaw: Math.PI });
  run(slow, 512, (cmd) => {
    forward(cmd);
    cmd.buttons = BTN.DUCK;
  });
  assert.ok(Math.abs(slow.state.origin.y - (8 * 16 + SKIN)) < 2e-3, `agachado, topo da escada: y ${slow.state.origin.y}`);
  for (const [rise, climbs] of [[18, true], [20, false]]) {
    const world = worldOf((b) => {
      floor(b);
      b.box(200, rise, 2000, { center: [0, rise / 2, 1050] });
    });
    const q = makePlayer(world, [0, 0, 0], { yaw: Math.PI });
    run(q, 128, forward);
    assert.equal(q.state.origin.y > rise - 1, climbs, `degrau de ${rise} u: y ${q.state.origin.y}`);
  }
});

test('rampas: sobe 30° até o topo, não sobe 50° e escorrega parado nela', () => {
  const ramp = (deg) => worldOf((b) => {
    floor(b);
    const h = 200 * Math.tan(deg * DEG);
    b.ramp(300, 200, h, { center: [0, 0, 60] });
    b.box(300, h, 2000, { center: [0, h / 2, 260 + 1000] }); // platô no topo
  });
  const up = makePlayer(ramp(30), [0, 0, 0], { yaw: Math.PI });
  run(up, 192, forward);
  const top30 = 200 * Math.tan(30 * DEG);
  assert.ok(Math.abs(up.state.origin.y - (top30 + SKIN)) < 0.05 && up.state.onGround, `rampa de 30°: y ${up.state.origin.y}`);
  const steep = makePlayer(ramp(50), [0, 0, 0], { yaw: Math.PI });
  let maxY = 0;
  run(steep, 192, (cmd, i, q) => {
    forward(cmd);
    maxY = Math.max(maxY, q.state.origin.y);
  });
  assert.ok(maxY < 40, `subiu a rampa de 50° (y máx ${maxY})`);
  const slide = makePlayer(ramp(50), [0, 100 * Math.tan(50 * DEG) + 5, 160]);
  run(slide, 128, idle);
  assert.ok(slide.state.origin.y < 5, `não escorregou (y ${slide.state.origin.y})`);
  assert.ok(slide.state.origin.z < 60, 'escorregou para a base da rampa');
});

test('descendo escada correndo fica no chão em todos os ticks', () => {
  const world = worldOf((b) => {
    floor(b);
    b.stairs(200, 16, 32, 8, { center: [0, 0, 100] });
    b.box(200, 128, 400, { center: [0, 64, 356 + 200] });
  });
  const p = makePlayer(world, [0, 128 + SKIN, 500]); // no platô, olhando para −Z (desce)
  let airborne = 0;
  run(p, 160, (cmd, i, q) => {
    forward(cmd);
    if (i > 2 && !q.state.onGround) airborne++;
  });
  assert.ok(p.state.origin.y < 1 && p.state.origin.z < 90, `não desceu (y ${p.state.origin.y}, z ${p.state.origin.z})`);
  assert.equal(airborne, 0, 'saiu do chão na descida');
});

test('teto: o pulo bate a cabeça e volta a cair', () => {
  const world = worldOf((b) => {
    floor(b);
    b.box(1000, 20, 1000, { center: [0, 110, 0] }); // teto em y = 100
  });
  const p = makePlayer(world, [0, 0, 0]);
  run(p, 4, idle);
  let top = 0;
  run(p, 64, (cmd, i, q) => {
    idle(cmd);
    if (i === 0) cmd.buttons = BTN.JUMP;
    top = Math.max(top, q.state.origin.y + q.state.height);
  });
  assert.ok(top <= 100 - SKIN + 2e-3, `atravessou o teto (${top})`);
  assert.ok(top > 99, 'deveria ter encostado no teto');
  assert.ok(p.state.onGround);
});

test('pulo: ápice de ~57 u e ~0,755 s no ar', () => {
  const p = makePlayer(worldOf((b) => floor(b)), [0, 0, 0]);
  run(p, 4, idle);
  let maxY = 0;
  let airTicks = 0;
  const events = run(p, 96, (cmd, i, q) => {
    idle(cmd);
    if (i === 0) cmd.buttons = BTN.JUMP;
    maxY = Math.max(maxY, q.state.origin.y);
    if (!q.state.onGround) airTicks++;
  });
  assert.ok(maxY > 56 && maxY <= 57 + SKIN + 1e-6, `ápice ${maxY}`);
  assert.ok(airTicks >= 47 && airTicks <= 50, `ticks no ar ${airTicks}`);
  assert.equal(events.filter((e) => e.type === 'jump').length, 1);
  assert.equal(events.filter((e) => e.type === 'land').length, 1);
});

/**
 * Corre até a caixa, pula a 95 u dela e (opcional) segura o agachar. Devolve o estado final e os pés mais altos com o
 * eixo já sobre a caixa (quem não alcança escorrega da quina e cai: a janela de 4 s cobre a queda).
 */
function jumpOntoBox(boxHeight, { duck = true } = {}) {
  const faceZ = -200;
  const world = worldOf((b) => {
    floor(b);
    b.box(400, boxHeight, 2000, { center: [0, boxHeight / 2, faceZ - 1000] });
  });
  const p = makePlayer(world, [0, 0, 400]);
  let jumpTick = -1;
  let topY = -Infinity;
  run(p, 256, (cmd, i, q) => {
    cmd.forward = 1;
    cmd.side = 0;
    if (jumpTick < 0 && q.state.onGround && q.state.origin.z - R - faceZ <= 95) jumpTick = i;
    cmd.buttons = (i === jumpTick ? BTN.JUMP : 0) | (duck && jumpTick >= 0 ? BTN.DUCK : 0);
    if (q.state.origin.z < faceZ) topY = Math.max(topY, q.state.origin.y);
  });
  return { state: p.state, topY };
}

test('pulo agachado alcança caixa de 64 u; pulo em pé não; 72 u nem agachado', () => {
  const crouched = jumpOntoBox(64).state;
  assert.ok(Math.abs(crouched.origin.y - (64 + SKIN)) < 2e-3, `agachado na caixa de 64: y ${crouched.origin.y}`);
  const standing = jumpOntoBox(64, { duck: false });
  assert.ok(standing.state.origin.y < 1 && standing.topY < 64, `em pé não alcança 64 (y ${standing.state.origin.y}, topo ${standing.topY})`);
  const high = jumpOntoBox(72);
  assert.ok(high.state.origin.y < 1 && high.topY < 72, `agachado não alcança 72 (y ${high.state.origin.y}, topo ${high.topY})`);
});

test('beirada: a base chata segura em pé no topo com o eixo até 16 u fora da borda, sem afundar, e cai além', () => {
  const world = worldOf((b) => {
    floor(b);
    b.box(100, 40, 100, { center: [0, 20, 0] }); // borda em x = 50, topo em y = 40
  });
  const hold = makePlayer(world, [50 + 15.9, 40 + SKIN, 0]);
  run(hold, 64, (cmd, i, q) => {
    idle(cmd);
    if (!q.state.onGround) assert.fail(`caiu da beirada no tick ${i}`);
  });
  const o = hold.state.origin;
  assert.ok(Math.abs(o.y - (40 + SKIN)) < 2e-3 && Math.abs(o.x - (50 + 15.9)) < 1e-6, `afundou ou escorregou: ${o.toArray()}`);
  const fall = makePlayer(world, [50 + 16.1, 40 + SKIN, 0]);
  run(fall, 64, idle);
  assert.ok(fall.state.origin.y < 1, `não caiu (y ${fall.state.origin.y})`);
});

test('túnel de 60 u: entra agachado, não levanta lá dentro e levanta ao sair', () => {
  const world = worldOf((b) => {
    floor(b);
    b.box(400, 20, 300, { center: [0, 70, -250] }); // teto do túnel em y = 60, de z = −100 a z = −400
  });
  const standing = makePlayer(world, [0, 0, 0]);
  run(standing, 128, forward);
  // Em pé para quando o hemisfério de cima encosta na quina do teto (y = 60): o eixo fica a √(16,03² − 4²) dela.
  const stopZ = -100 + Math.sqrt((R + SKIN) ** 2 - (60 - (HULL.standHeight - R)) ** 2);
  assert.ok(Math.abs(standing.state.origin.z - stopZ) < 0.01, `em pé parou em z ${standing.state.origin.z} (esperado ${stopZ})`);
  const p = makePlayer(world, [0, 0, 0]);
  run(p, 256, (cmd) => {
    forward(cmd);
    cmd.buttons = BTN.DUCK;
  });
  assert.ok(p.state.origin.z < -150 && p.state.ducked, `agachado entra (z ${p.state.origin.z})`);
  run(p, 16, idle);
  assert.ok(p.state.ducked && p.state.height === HULL.duckHeight, 'levantou dentro do túnel');
  // Preso agachado (FL_DUCKING): a aceleração é a de agachado do CS:GO, ~1,5 s para chegar a 85 u/s partindo parado.
  run(p, 192, forward);
  assert.ok(p.state.origin.z < -400 - R && !p.state.ducked, `não levantou ao sair (z ${p.state.origin.z})`);
});

test('noclip atravessa parede; ao desligar dentro dela o jogador é tirado para fora, pelo lado do chão', () => {
  const world = worldOf((b) => {
    floor(b);
    b.box(1000, 300, 60, { center: [0, 150, -200] }); // parede de z = −230 a z = −170
  });
  const p = makePlayer(world, [0, 0, 0]);
  p.state.moveType = MOVETYPE.NOCLIP;
  run(p, 64, forward);
  assert.ok(p.state.origin.z < -230, `noclip não atravessou (z ${p.state.origin.z})`);
  // Eixo 10 u dentro da parede: a desempenetração não resolve (o segmento está dentro do sólido) e a busca por
  // espaço livre acha a face mais perto.
  p.state.origin.set(0, SKIN, -180);
  p.state.velocity.set(0, 0, 0);
  p.state.moveType = MOVETYPE.WALK;
  run(p, 1, idle);
  const s = p.state;
  assert.ok(world.canOccupy(s.origin.x, s.origin.y, s.origin.z, R, s.height), 'continua preso na parede');
  assert.equal(s.stuck, false);
  // Parede fina na borda do set (a parede norte da sala de teste), com chão só de um lado. Com o eixo dentro dela cada
  // face empurra para o seu lado; daqui o empurrão direto sai do set, e o controlador prefere um lugar livre com chão.
  const edge = worldOf((b) => {
    b.box(1600, 8, 1600, { center: [0, -4, 0] }); // chão de z = −800 a z = 800
    b.box(1600, 520, 6.4, { center: [0, 260, -800] }); // parede de z = −803,2 a z = −796,8
  });
  const direct = new THREE.Vector3(0, 40, -799);
  edge.depenetrate(direct, R, HULL.standHeight, SKIN);
  assert.ok(direct.z < -803.2 - R, `o cenário não exercita a preferência por chão (empurrão direto em z ${direct.z})`);
  const q = makePlayer(edge, [0, 40, -799]);
  run(q, 64, idle);
  const e = q.state.origin;
  assert.ok(e.z > -796.8 + R && edge.canOccupy(e.x, e.y, e.z, R, q.state.height), `saiu pelo lado sem chão (z ${e.z})`);
  assert.ok(q.state.onGround && !q.state.stuck, 'não ficou de pé no chão');
});

test('pouso: evento com a velocidade de queda (~565 u/s de 200 u) e a superfície', () => {
  const p = makePlayer(worldOf((b) => floor(b)), [0, 200, 0]);
  const events = run(p, 96, idle);
  const land = events.find((e) => e.type === 'land');
  assert.ok(land, 'sem evento de pouso');
  assert.ok(land.speed > 550 && land.speed < 570, `velocidade ${land.speed}`);
  assert.equal(land.surface, SURFACE_INDEX.tapete);
});

test('determinismo: a mesma sequência de comandos dá o mesmo estado, bit a bit', () => {
  const build = () => worldOf((b) => {
    floor(b);
    b.stairs(200, 16, 32, 6, { center: [100, 0, -200] });
    b.cylinder(30, 100, { center: [-120, 0, -150] });
  });
  const script = (seed) => {
    const rng = new RNG(seed);
    return (cmd) => {
      cmd.forward = rng.float(-1, 1);
      cmd.side = rng.float(-1, 1);
      cmd.buttons = (rng.bool(0.1) ? BTN.JUMP : 0) | (rng.bool(0.2) ? BTN.DUCK : 0);
      cmd.yaw += rng.float(-0.1, 0.1);
    };
  };
  const a = makePlayer(build(), [0, 0, 0]);
  const b = makePlayer(build(), [0, 0, 0]);
  run(a, 640, script('determinismo'));
  run(b, 640, script('determinismo'));
  assert.deepEqual(a.state.origin.toArray(), b.state.origin.toArray());
  assert.deepEqual(a.state.velocity.toArray(), b.state.velocity.toArray());
  const c = copyMoveState(a.state, createMoveState());
  assert.deepEqual(c.origin.toArray(), a.state.origin.toArray());
  assert.equal(c.duckAmount, a.state.duckAmount);
  assert.equal(c.onGround, a.state.onGround);
});
