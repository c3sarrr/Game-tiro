// Testes da sonda de parede do wall-jump (subfase 3.4): acha a face de parede ao alcance (raio + 4 u) e não além;
// ignora chão, teto, a aresta de cima de uma parede baixa e rampas até 70°; devolve a normal no plano, o ponto, a peça
// do ColliderBuilder (formas separadas, grupo por nome) e o material; corpo girado devolve a normal no mundo.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { SURFACE_INDEX } from '../src/data/surfaces.js';
import { HULL, WALLJUMP } from '../src/data/movement.js';
import { ColliderBuilder } from '../src/physics/colliders.js';
import { CollisionBody } from '../src/physics/collisionBody.js';
import { CollisionWorld } from '../src/physics/collisionWorld.js';
import { WallProbe, createWallHit } from '../src/physics/wallProbe.js';
import { floor, worldOf } from './worldTestUtils.js';

const R = HULL.radius;
const H = HULL.standHeight;
const DEG = Math.PI / 180;
const near = (a, b, eps, msg) => assert.ok(Math.abs(a - b) <= eps, `${msg}: ${a} ≠ ${b}`);

/** Sonda com os números do wall-jump para a cápsula em pé com os pés em (x, y, z). */
function probeAt(world, x, y, z, height = H) {
  const hit = createWallHit();
  new WallProbe(world).probe(x, y, z, R, height, WALLJUMP.reach, WALLJUMP.maxNormalY, hit);
  return hit;
}

// Parede de madeira: caixa de x = 100 a 108, face de dentro em x = 100 voltada para −x.
const wallWorld = () => worldOf((b) => {
  floor(b);
  b.box(8, 200, 200, { center: [104, 100, 0], surface: 'madeira' });
});

test('acha a parede ao alcance e não além: normal no plano, distância, ponto, material', () => {
  const world = wallWorld();
  const hit = probeAt(world, 100 - R - 3, 0, 0);
  assert.equal(hit.hit, true);
  near(hit.nx, -1, 1e-9, 'normal x');
  near(hit.nz, 0, 1e-9, 'normal z');
  near(hit.ny, 0, 1e-9, 'contato na horizontal');
  near(hit.distance, R + 3, 1e-9, 'distância do segmento');
  near(hit.px, 100, 1e-9, 'ponto na face');
  assert.equal(hit.surface, SURFACE_INDEX.madeira);
  assert.equal(hit.body, world.bodies[0]);
  assert.ok(hit.part >= 0 && hit.triangle >= 0);
  assert.equal(probeAt(world, 100 - R - WALLJUMP.reach + 0.1, 0, 0).hit, true, 'no limite do alcance');
  assert.equal(probeAt(world, 100 - R - WALLJUMP.reach - 0.1, 0, 0).hit, false, 'além do alcance');
  assert.ok(world.stats.overlaps > 0 && world.stats.triangles > 0, 'conta a consulta nas estatísticas');
});

test('ignora chão, teto, a aresta de cima de uma parede baixa e rampas até 70°', () => {
  assert.equal(probeAt(worldOf((b) => floor(b)), 0, 0.03, 0).hit, false, 'de pé no chão');
  const ceiling = worldOf((b) => {
    floor(b);
    b.box(400, 10, 400, { center: [0, H + 2 + 5, 0] });
  });
  assert.equal(probeAt(ceiling, 0, 0.03, 0).hit, false, 'teto 2 u acima da cabeça');
  const low = worldOf((b) => {
    floor(b);
    b.box(8, 60, 200, { center: [104, 30, 0] });
  });
  assert.equal(probeAt(low, 100 - R - 2, 0.03, 0).hit, true, 'ao lado da parede baixa ela conta');
  // Pés em 52 (segmento de 68 a 108), 10 u antes da face: só a aresta de cima (100, 60) está ao alcance, e inclinada.
  assert.equal(probeAt(low, 90, 52, 0).hit, false, 'acima dela, o contato com a aresta sai inclinado');
  // Rampas subindo em +z de z = 0 até y = 200: a de 60° (|n.y| = 0,5) não é parede; a de 75° (|n.y| = 0,26) é. A
  // cápsula fica no ar diante da face, com a ponta de baixo do segmento a raio + 2 u dela.
  for (const [deg, wall] of [[60, false], [75, true]]) {
    const h = 200;
    const len = h / Math.tan(deg * DEG);
    const norm = Math.hypot(len, h);
    const w = worldOf((b) => {
      floor(b);
      b.ramp(200, len, h, { center: [0, 0, 0] });
    });
    const feet = 36;
    const y0 = feet + R; // ponta de baixo do segmento da cápsula
    const z = (len * y0 - (R + 2) * norm) / h; // distância (len·y − h·z)/norm = raio + 2 à face
    const hit = probeAt(w, 0, feet, z);
    assert.equal(hit.hit, wall, `rampa de ${deg}°`);
    if (wall) {
      near(hit.ny, len / norm, 1e-9, 'normal de contato = a da face');
      near(hit.distance, R + 2, 1e-9, 'distância');
    }
  }
});

test('peças: formas separadas são peças diferentes; o grupo por nome é uma peça só; a mais próxima vence', () => {
  const world = worldOf((b) => {
    floor(b);
    b.box(8, 200, 100, { center: [104, 100, -50] }); // painel A (z de −100 a 0)
    b.box(8, 200, 100, { center: [104, 100, 50] }); // painel B, no mesmo plano (z de 0 a 100)
    b.box(8, 200, 100, { center: [-104, 100, -50], part: 'grupo' });
    b.box(8, 200, 100, { center: [-104, 100, 50], part: 'grupo' });
  });
  const a = probeAt(world, 100 - R - 2, 0.03, -50);
  const b = probeAt(world, 100 - R - 2, 0.03, 50);
  assert.ok(a.hit && b.hit);
  assert.notEqual(a.part, b.part, 'painéis separados no mesmo plano');
  const g0 = probeAt(world, -100 + R + 2, 0.03, -50);
  const g1 = probeAt(world, -100 + R + 2, 0.03, 50);
  assert.equal(g0.part, g1.part, 'o grupo é uma parede só');
  near(g0.nx, 1, 1e-9, 'normal para dentro');
  // Entre duas paredes a 18 e a 19 u do segmento: a mais próxima vence.
  const w = worldOf((bb) => {
    floor(bb);
    bb.box(8, 200, 200, { center: [104, 100, 0] }); // face em x = 100 (normal −x)
    bb.box(8, 200, 200, { center: [59, 100, 0] }); // face em x = 63 (normal +x)
  });
  const hit = probeAt(w, 82, 0.03, 0);
  assert.ok(hit.hit);
  near(hit.distance, 18, 1e-9, 'a mais próxima');
  near(hit.nx, -1, 1e-9, 'a da direita');
});

test('corpo girado: a normal e o ponto saem no mundo, a peça no corpo', () => {
  const b = new ColliderBuilder();
  b.box(8, 200, 200, { center: [104, 100, 0] });
  const world = new CollisionWorld();
  // Girado 90° em Y: a face de x = 100 (normal −x) vira a face de z = −100, com a normal para +z.
  const m = new THREE.Matrix4().makeRotationY(90 * DEG);
  world.addBody(new CollisionBody(b.build(), { name: 'girado', matrix: m }));
  const face = new THREE.Vector3(100, 50, 0).applyMatrix4(m);
  const n = new THREE.Vector3(-1, 0, 0).transformDirection(m);
  const hit = probeAt(world, face.x + n.x * (R + 2), 0, face.z + n.z * (R + 2));
  assert.ok(hit.hit);
  near(hit.nx, n.x, 1e-9, 'normal x no mundo');
  near(hit.nz, n.z, 1e-9, 'normal z no mundo');
  near(hit.px, face.x, 1e-9, 'ponto x no mundo');
  near(hit.pz, face.z, 1e-9, 'ponto z no mundo');
  assert.equal(hit.body.key, 1, 'chave do corpo no mundo');
});
