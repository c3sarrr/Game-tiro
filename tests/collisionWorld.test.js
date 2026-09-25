// Testes do mundo de colisão (Fase 3.1): formas do ColliderBuilder, corpo com BVH, varredura igual à força bruta,
// corpo transformado igual ao assado, chão da base chata, começo penetrando, desempenetração (inclusive furando), espaço
// livre e raio.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { RNG } from '../src/core/rng.js';
import { SURFACE_INDEX } from '../src/data/surfaces.js';
import { CONTROLLER, HULL } from '../src/data/movement.js';
import { TRI_STRIDE } from '../src/physics/geometryQueries.js';
import { createSweepHit, sweepCapsuleTriangle } from '../src/physics/capsuleSweep.js';
import { ColliderBuilder } from '../src/physics/colliders.js';
import { CollisionBody } from '../src/physics/collisionBody.js';
import { CollisionWorld, createRayHit, createTrace } from '../src/physics/collisionWorld.js';
import { floor, worldOf } from './worldTestUtils.js';

const R = 16;
const H = 72;
const SKIN = CONTROLLER.skin;

test('ColliderBuilder: triângulos por forma, degenerados descartados e superfícies', () => {
  const b = new ColliderBuilder();
  b.box(10, 10, 10, { surface: 'papelao' });
  assert.equal(b.triangleCount, 12);
  b.cylinder(5, 10, { segments: 16, surface: 'plastico' });
  assert.equal(b.triangleCount, 12 + 64);
  b.ramp(10, 20, 5, { surface: 'madeira' });
  assert.equal(b.triangleCount, 76 + 8);
  b.stairs(10, 4, 6, 3);
  assert.equal(b.triangleCount, 84 + 36);
  const v = new THREE.Vector3(1, 2, 3);
  b.triangle(v, v, new THREE.Vector3(4, 5, 6));
  assert.equal(b.skipped, 1);
  assert.throws(() => b.box(1, 1, 1, { surface: 'lava' }), /desconhecida/);
  assert.equal(b.triangleCount, 120, 'erro de superfície não deixa triângulo pela metade');
  const data = b.build();
  assert.equal(data.positions.length, data.surfaces.length * 9);
  assert.equal(data.surfaces[0], SURFACE_INDEX.papelao);
  assert.equal(data.surfaces[12], SURFACE_INDEX.plastico);
});

test('ColliderBuilder.object: malhas do objeto nas matrizes de mundo, polos degenerados descartados', () => {
  const group = new THREE.Group();
  group.position.set(100, 0, 0);
  const profile = [new THREE.Vector2(0, 0), new THREE.Vector2(10, 0), new THREE.Vector2(10, 20), new THREE.Vector2(0, 20)];
  const lathe = new THREE.Mesh(new THREE.LatheGeometry(profile, 8));
  lathe.position.set(0, 5, 0);
  group.add(lathe, new THREE.Mesh(new THREE.BoxGeometry(4, 4, 4)));
  const b = new ColliderBuilder();
  b.object(group, { surface: 'plastico' });
  // Torno: 3 trechos × 8 fatias × 2 triângulos = 48; nos dois polos (raio 0) um triângulo por fatia é degenerado.
  assert.equal(b.skipped, 16);
  assert.equal(b.triangleCount, 48 - 16 + 12);
  const data = b.build();
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (let i = 0; i < data.positions.length; i += 3) {
    minX = Math.min(minX, data.positions[i]);
    maxX = Math.max(maxX, data.positions[i]);
    minY = Math.min(minY, data.positions[i + 1]);
    maxY = Math.max(maxY, data.positions[i + 1]);
  }
  assert.ok(Math.abs(minX - 90) < 1e-9 && Math.abs(maxX - 110) < 1e-9, `x de ${minX} a ${maxX}`);
  assert.ok(Math.abs(minY + 2) < 1e-9 && Math.abs(maxY - 25) < 1e-9, `y de ${minY} a ${maxY}`);
  assert.ok(data.surfaces.every((s) => s === SURFACE_INDEX.plastico));
});

test('CollisionBody: triângulos na ordem do BVH com normal unitária e a superfície certa', () => {
  const b = new ColliderBuilder();
  b.box(100, 10, 100, { center: [0, -5, 0], surface: 'tapete' });
  b.cylinder(20, 50, { center: [30, 0, 30], surface: 'plastico' });
  const body = new CollisionBody(b.build(), { name: 'teste' });
  assert.equal(body.triangleCount, 12 + 128);
  let tapete = 0;
  let plastico = 0;
  for (let i = 0; i < body.triangleCount; i++) {
    const o = i * TRI_STRIDE;
    assert.ok(Math.abs(Math.hypot(body.tris[o + 9], body.tris[o + 10], body.tris[o + 11]) - 1) < 1e-12);
    if (body.surface[i] === SURFACE_INDEX.tapete) {
      tapete++;
      for (let k = 0; k < 3; k++) assert.ok(body.tris[o + k * 3 + 1] <= 0, 'vértice da laje fora dela');
    }
    if (body.surface[i] === SURFACE_INDEX.plastico) plastico++;
  }
  assert.equal(tapete, 12);
  assert.equal(plastico, 128);
  body.dispose();
});

/** Menor t de contato varrendo todos os triângulos, sem BVH. */
function bruteSweep(world, o, d) {
  const hit = createSweepHit();
  let best = 1;
  let found = false;
  for (const body of world.bodies) {
    for (let i = 0; i < body.triangleCount; i++) {
      if (sweepCapsuleTriangle(o[0], o[1] + R, o[2], o[0], o[1] + H - R, o[2], d[0], d[1], d[2],
        body.tris, i * TRI_STRIDE, R + SKIN, best, hit)) {
        best = hit.t;
        found = true;
      }
    }
  }
  return { found, best };
}

test('varredura do mundo = força bruta sobre todos os triângulos (300 varreduras)', () => {
  const rng = new RNG('mundo');
  const world = worldOf((b) => {
    floor(b, 2000);
    for (let i = 0; i < 6; i++) {
      b.box(rng.float(20, 120), rng.float(20, 200), rng.float(20, 120), {
        center: [rng.float(-400, 400), rng.float(0, 100), rng.float(-400, 400)], surface: 'papelao',
      });
    }
    b.cylinder(30, 120, { center: [100, 0, -100], surface: 'plastico' });
    b.cylinder(12, 60, { segments: 12, center: [-150, 0, 200] });
    b.ramp(100, 200, 80, { center: [0, 0, 250], surface: 'madeira' });
  });
  const tr = createTrace();
  let hits = 0;
  for (let n = 0; n < 300; n++) {
    const o = [rng.float(-500, 500), rng.float(1, 300), rng.float(-500, 500)];
    const d = [rng.float(-400, 400), rng.float(-300, 300), rng.float(-400, 400)];
    world.sweepCapsule(...o, ...d, R, H, tr);
    const ref = bruteSweep(world, o, d);
    assert.equal(tr.hit, ref.found, `varredura ${n}`);
    if (ref.found) {
      hits++;
      assert.ok(Math.abs(tr.fraction - ref.best) < 1e-12, `varredura ${n}: ${tr.fraction} × ${ref.best}`);
      assert.ok(Math.abs(tr.normal.length() - 1) < 1e-9);
      assert.ok(tr.faceNormal.dot(tr.normal) >= 0);
    } else {
      assert.equal(tr.fraction, 1);
    }
    assert.ok(Math.abs(tr.endpos.x - (o[0] + d[0] * tr.fraction)) < 1e-9);
  }
  assert.ok(hits > 60, `poucos contatos (${hits})`);
});

test('corpo com matriz rígida responde igual ao mesmo corpo assado no mundo', () => {
  const m = new THREE.Matrix4().makeRotationY(0.6).setPosition(120, 10, -80);
  const moving = new CollisionWorld();
  const body = moving.addBody(new CollisionBody(new ColliderBuilder().box(80, 60, 30, { surface: 'metal' }).build(), { name: 'movel', matrix: m }));
  const fixed = CollisionWorld.fromBuilder(new ColliderBuilder().box(80, 60, 30, { matrix: m, surface: 'metal' }), 'assado');
  assert.ok(body.transformed);
  const rng = new RNG('corpo-movel');
  const a = createTrace();
  const b = createTrace();
  for (let n = 0; n < 200; n++) {
    const o = [rng.float(-100, 300), rng.float(-60, 80), rng.float(-250, 100)];
    const d = [rng.float(-300, 300), rng.float(-100, 100), rng.float(-300, 300)];
    moving.sweepCapsule(...o, ...d, R, H, a);
    fixed.sweepCapsule(...o, ...d, R, H, b);
    assert.equal(a.hit, b.hit, `varredura ${n}`);
    assert.ok(Math.abs(a.fraction - b.fraction) < 1e-6, `varredura ${n}: ${a.fraction} × ${b.fraction}`);
    if (a.hit) {
      assert.ok(a.normal.distanceTo(b.normal) < 1e-4, `varredura ${n}: normal`);
      // Aresta vertical ou parede, paralelas ao eixo da cápsula: o ponto de contato não é único ao longo de Y.
      // (A normal da face também não: numa aresta é a de qualquer das faces — o chão tem consulta própria, a base chata.)
      assert.ok(Math.hypot(a.point.x - b.point.x, a.point.z - b.point.z) < 1e-3, `varredura ${n}: ponto`);
      if (Math.abs(a.point.y - b.point.y) > 1e-3) assert.ok(Math.abs(a.normal.y) < 1e-6, `varredura ${n}: Y só varia de lado`);
    }
  }
  body.setMatrix(new THREE.Matrix4().makeTranslation(0, 1000, 0));
  moving.sweepCapsule(120, 0, -300, 0, 0, 400, R, H, a);
  assert.equal(a.hit, false, 'o corpo saiu do caminho');
});

test('chão da base chata: face andável mais alta sob o disco dos pés (corpo parado e girado)', () => {
  const DEG = Math.PI / 180;
  const FOOT = HULL.footRadius;
  const out = { height: 0, normal: new THREE.Vector3(), surface: -1 };
  for (const matrix of [null, new THREE.Matrix4().makeRotationY(0.7).setPosition(30, 0, -20)]) {
    const b = new ColliderBuilder();
    b.box(800, 8, 800, { center: [0, -4, 0], surface: 'tapete' }); // chão em y = 0
    b.box(100, 40, 100, { center: [0, 20, 0], surface: 'madeira' }); // caixa: topo em 40, bordas em x, z = ±50
    b.ramp(100, 100, 100 * Math.tan(30 * DEG), { center: [200, 0, 0], surface: 'papelao' }); // 30°, sobe em +Z
    b.ramp(100, 40, 40 * Math.tan(60 * DEG), { center: [-200, 0, 0], surface: 'metal' }); // 60°: não é chão
    b.box(60, 10, 60, { center: [0, 105, 300], surface: 'metal' }); // prateleira: fundo em 100, topo em 110
    const world = new CollisionWorld();
    world.addBody(new CollisionBody(b.build(), { name: 'chao', matrix }));
    const query = (x, z, minY = -20, maxY = 200) => {
      const p = new THREE.Vector3(x, 0, z);
      if (matrix) p.applyMatrix4(matrix);
      return world.supportBelow(p.x, p.z, FOOT, minY, maxY, CONTROLLER.walkableNormalY, out);
    };
    assert.ok(query(0, 0) && Math.abs(out.height - 40) < 1e-9 && out.normal.y > 0.999, 'topo da caixa');
    assert.equal(out.surface, SURFACE_INDEX.madeira);
    assert.ok(query(50 + FOOT - 0.1, 0) && Math.abs(out.height - 40) < 1e-9, 'o disco ainda cobre a borda por 0,1 u');
    assert.ok(query(50 + FOOT + 0.1, 0) && Math.abs(out.height) < 1e-9, 'passou do raio: chão');
    assert.equal(out.surface, SURFACE_INDEX.tapete);
    assert.ok(query(50 + FOOT - 0.1, 50 + FOOT - 0.1) && Math.abs(out.height) < 1e-9, 'quina: o disco não chega nela');
    assert.ok(query(0, 0, -20, 30) && out.height <= 30, 'fora do intervalo pedido não conta');
    // Rampa de 30° no meio: a borda do disco morro acima segura (tan 30° × 16 u acima do ponto sob o eixo).
    assert.ok(query(200, 50), 'rampa');
    assert.ok(Math.abs(out.height - (50 + FOOT) * Math.tan(30 * DEG)) < 1e-9, `altura na rampa ${out.height}`);
    assert.ok(Math.abs(out.normal.y - Math.cos(30 * DEG)) < 1e-9 && out.surface === SURFACE_INDEX.papelao);
    // A mesma rampa com o teto do intervalo abaixo da borda de cima: ela sobe além dele dentro do disco — é obstáculo
    // acima da base, não chão (senão a base "pousaria" cortada no teto do intervalo).
    assert.ok(query(200, 50, -20, 30) && Math.abs(out.height) < 1e-9, `rampa acima do intervalo: ${out.height}`);
    // Rampa de 60°: íngreme, não segura — vale o chão por baixo dela.
    assert.ok(query(-200, 20) && Math.abs(out.height) < 1e-9, 'rampa íngreme');
    // Fundo da prateleira (virado para baixo) no intervalo: o sólido está por cima dele — não segura a base.
    assert.equal(query(0, 300, 90, 105), false, 'fundo de prateleira não é chão');
    assert.ok(query(0, 300, 90, 120) && Math.abs(out.height - 110) < 1e-9, 'topo da prateleira');
    assert.equal(query(1000, 1000), false, 'fora do mapa');
  }
});

test('varredura: startSolid ao começar penetrando e entrando mais; de fora para a raio + folga', () => {
  const world = worldOf((b) => b.box(200, 200, 200, { center: [0, 100, -100] })); // face em z = 0
  const tr = createTrace();
  world.sweepCapsule(0, 50, 10, 0, 0, -10, R, H, tr);
  assert.ok(tr.hit && tr.startSolid && tr.fraction === 0);
  world.sweepCapsule(0, 50, 10, 0, 0, 10, R, H, tr);
  assert.equal(tr.hit, false, 'saindo passa');
  world.sweepCapsule(0, 50, 100, 0, 0, -200, R, H, tr);
  assert.ok(tr.hit && !tr.startSolid);
  assert.ok(Math.abs(tr.endpos.z - (R + SKIN)) < 2e-3, `z ${tr.endpos.z}`);
  assert.ok(tr.normal.z > 0.999);
  assert.ok(world.stats.sweeps >= 3 && world.stats.triangles > 0);
});

test('desempenetração: sai de lado até raio + folga e sai por cima quando a laje fura a cápsula', () => {
  const world = worldOf((b) => b.box(200, 200, 200, { center: [0, 100, -100] })); // face em z = 0
  const pos = new THREE.Vector3(0, 50, 11); // eixo a 11 u da face: 5 u para dentro
  assert.equal(world.canOccupy(pos.x, pos.y, pos.z, R, H), false);
  assert.ok(world.depenetrate(pos, R, H));
  assert.ok(Math.abs(pos.z - (R + SKIN)) < 1e-3, `z ${pos.z}`);
  assert.ok(Math.abs(pos.x) < 1e-9 && Math.abs(pos.y - 50) < 1e-9);
  assert.ok(world.canOccupy(pos.x, pos.y, pos.z, R, H));

  const slab = worldOf((b) => b.box(400, 1, 400, { center: [0, 30, 0] })); // laje de y 29,5 a 30,5
  const p2 = new THREE.Vector3(0, 0, 0); // o meio do segmento (y = 36) está acima: sai por cima
  assert.ok(slab.depenetrate(p2, R, H));
  assert.ok(p2.y >= 30.5 + SKIN - 1e-3, `y ${p2.y}`);
  assert.ok(slab.canOccupy(p2.x, p2.y, p2.z, R, H));
});

test('espaço livre: espremido num vão de 20 u, sai para o lado livre mais próximo', () => {
  const world = worldOf((b) => {
    floor(b, 1000);
    b.box(2, 60, 400, { center: [11, 30, 0] });
    b.box(2, 60, 400, { center: [-11, 30, 0] });
  });
  const start = new THREE.Vector3(0, SKIN, 0);
  assert.equal(world.depenetrate(start.clone(), R, H), false, 'não cabe no vão');
  const pos = start.clone();
  assert.ok(world.findFreeSpot(pos, R, H));
  assert.ok(world.canOccupy(pos.x, pos.y, pos.z, R, H));
  assert.ok(Math.abs(pos.x) >= 12 + R, `continua no vão (x ${pos.x})`);
  assert.ok(pos.distanceTo(start) <= 64 * Math.SQRT2 + 1);
});

test('raio: face mais próxima, normal contra o raio, superfície, dos dois lados e falta', () => {
  const world = worldOf((b) => {
    b.box(100, 100, 100, { center: [0, 50, 0], surface: 'papelao' });
    b.box(100, 100, 100, { center: [0, 50, 300], surface: 'metal' });
  });
  const hit = createRayHit();
  assert.ok(world.raycast(0, 50, -300, 0, 0, 1, 1000, hit));
  assert.ok(Math.abs(hit.distance - 250) < 1e-9);
  assert.ok(hit.normal.distanceTo(new THREE.Vector3(0, 0, -1)) < 1e-9);
  assert.equal(hit.surface, SURFACE_INDEX.papelao);
  assert.ok(Math.abs(hit.point.z + 50) < 1e-9);
  assert.ok(world.raycast(0, 50, 0, 0, 0, 1, 1000, hit), 'de dentro bate na face de trás');
  assert.ok(Math.abs(hit.distance - 50) < 1e-9);
  assert.equal(world.raycast(0, 500, 0, 0, 0, 1, 1000, hit), false);
  assert.equal(hit.distance, 1000);
  assert.equal(world.raycast(0, 50, -300, 0, 0, 1, 100, hit), false, 'além do alcance');
  assert.ok(world.stats.rays >= 4);
});
