// Testes da montagem de luz `pista` e da poeira em caixa (subfase 3.3), sem WebGL: a key alcança a base inteira dentro
// do cone e do frustum da sombra (planos perto e longe) e é a única com sombra, o mapa ×2 dela tem teto, as luzes
// práticas ficam onde os dados da pista dizem e têm alcance, a sala do ambiente assado contém todas as luzes (senão o
// reflexo da softbox some) e a poeira nasce e continua só dentro da caixa e do cone.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { STUDIO_RIGS } from '../src/data/studioRigs.js';
import { PISTA } from '../src/data/pista.js';
import { SHADOW_LEVELS, SHADOW_MAX_SIZE } from '../src/data/qualityPresets.js';
import { DustMotes } from '../src/render/studio/dust.js';

const DEG = Math.PI / 180;
const RIG = STUDIO_RIGS.pista;
const light = (id) => RIG.lights.find((l) => l.id === id);

/** O que a key precisa alcançar: cantos da base no tampo e no alto da cerca, e o topo da torre. */
function targets() {
  const B = PISTA.base;
  const pts = [];
  for (const x of [B.minX, B.maxX]) {
    for (const z of [B.minZ, B.maxZ]) pts.push(new THREE.Vector3(x, 0, z), new THREE.Vector3(x, PISTA.fence.height, z));
  }
  const [tx, tz] = PISTA.tower.axis;
  pts.push(new THREE.Vector3(tx, PISTA.tower.tube.height, tz));
  return pts;
}

test('montagem pista: a key alcança a base inteira (cone, frustum da sombra, perto e longe) e é a única com sombra', () => {
  assert.deepEqual(RIG.lights.map((l) => l.id), ['key', 'fill', 'rim', 'practical', 'tunnel']);
  const key = light('key');
  const pos = new THREE.Vector3(...key.position);
  const axis = new THREE.Vector3(...key.target).sub(pos).normalize();
  for (const p of targets()) {
    const d = p.clone().sub(pos);
    // O frustum da sombra é a pirâmide de meio ângulo `angle × focus`: dentro do cone inscrito, dentro dela.
    const angle = Math.acos(d.clone().normalize().dot(axis)) / DEG;
    assert.ok(angle < key.angleDeg * key.shadow.focus, `${p.toArray()}: ${angle.toFixed(1)}° do eixo`);
    const len = d.length();
    assert.ok(len > key.shadow.near && len < key.shadow.far, `${p.toArray()}: ${len.toFixed(0)} u fora de [perto, longe]`);
  }
  for (const l of RIG.lights) if (l.id !== 'key') assert.equal(l.shadow, null, `${l.id} sem sombra`);
  // Mapa ×2 da key com teto: no Alto chega a 4096 e no Ultra não passa disso.
  assert.equal(key.shadow.scale, 2);
  assert.equal(SHADOW_MAX_SIZE, 4096);
  assert.equal(Math.min(SHADOW_MAX_SIZE, SHADOW_LEVELS.alta.mapSize * key.shadow.scale), 4096);
  assert.equal(Math.min(SHADOW_MAX_SIZE, SHADOW_LEVELS.ultra.mapSize * key.shadow.scale), 4096);
});

test('montagem pista: luzes práticas nos pontos da pista e com alcance; a sala do ambiente contém todas as luzes', () => {
  const lamp = light('practical');
  assert.deepEqual(lamp.position, [...PISTA.plaza.lamp.bulb]);
  assert.deepEqual(lamp.target, [...PISTA.plaza.lamp.target]);
  assert.equal(lamp.fixture.kind, 'deskLamp');
  assert.equal(lamp.fixture.reach, PISTA.plaza.lamp.reach);
  assert.ok(lamp.distance > 0, 'luminária com alcance');
  const tunnel = light('tunnel');
  assert.deepEqual(tunnel.position, [...PISTA.tunnel.light.at]);
  assert.equal(tunnel.distance, PISTA.tunnel.light.reach);
  assert.equal(tunnel.fixture, null, 'o pisca-pisca é a fonte visível');
  // A luz do túnel fica dentro da caixa alta, abaixo do teto de dentro.
  const tall = PISTA.tunnel.boxes.find((b) => b.height > 72);
  const [x, y, z] = tunnel.position;
  assert.ok(x > tall.x[0] && x < tall.x[1] && z > PISTA.tunnel.z[0] && z < PISTA.tunnel.z[1] && y > 0 && y < tall.height);
  // O mapa assa o ambiente de (0, 60, 0); environment.js sobe a sala 1/3 da altura.
  const [rw, rh, rd] = RIG.environment.room;
  const center = new THREE.Vector3(0, 60 + rh / 3, 0);
  for (const l of RIG.lights) {
    const p = new THREE.Vector3(...l.position).sub(center);
    assert.ok(Math.abs(p.x) < rw / 2 && Math.abs(p.y) < rh / 2 && Math.abs(p.z) < rd / 2, `${l.id} fora da sala`);
  }
});

test('poeira em caixa: nasce e continua só dentro da caixa e do cone da key', () => {
  const key = light('key');
  const spot = new THREE.SpotLight(0xffffff, 1, 0, key.angleDeg * DEG, key.penumbra);
  spot.position.set(...key.position);
  spot.target.position.set(...key.target);
  spot.updateMatrixWorld(true);
  spot.target.updateMatrixWorld(true);
  const count = 300;
  const box = RIG.dust.box;
  const dust = new DustMotes({ light: spot, count, size: RIG.dust.size, drift: RIG.dust.drift, seed: 'teste', box });
  const b = new THREE.Box3(new THREE.Vector3(...box.min), new THREE.Vector3(...box.max));
  // A caixa é o ar baixo da base.
  const B = PISTA.base;
  assert.ok(box.min[0] >= B.minX && box.max[0] <= B.maxX && box.min[2] >= B.minZ && box.max[2] <= B.maxZ);
  assert.ok(box.min[1] > 0 && box.max[1] <= PISTA.fence.height + 50);
  const axis = spot.target.position.clone().sub(spot.position).normalize();
  const p = new THREE.Vector3();
  const check = (when) => {
    for (let i = 0; i < count; i++) {
      p.fromArray(dust.positions, i * 3);
      assert.ok(b.containsPoint(p), `${when}: grão ${i} fora da caixa`);
      assert.ok(p.clone().sub(spot.position).normalize().dot(axis) >= Math.cos(spot.angle), `${when}: grão ${i} fora do cone`);
    }
  };
  check('ao nascer');
  for (let pose = 1; pose <= 240; pose++) dust.step(pose);
  check('depois de 20 s de poses');
  dust.dispose();
});
