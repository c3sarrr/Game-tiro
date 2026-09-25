// Aceite "nenhum atravessamento de parede em 10 min" automatizado (Fases 3.1 e 3.2): 38.400 ticks de entrada
// aleatória — com andar, spam de agachar, pulos (stamina) e troca do item na mão (velocidades de 100 a 250, sniper
// lenta) —, empurrões de até 3500 u/s, paredes de 0,5 a 2 u dividindo a sala em células e um painel em movimento. A
// célula do jogador nunca muda, ele nunca fica penetrando nada nem preso. Depois, a mesma seed repetida dá o mesmo
// estado inteiro, bit a bit.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { RNG } from '../src/core/rng.js';
import { HULL } from '../src/data/movement.js';
import { ColliderBuilder } from '../src/physics/colliders.js';
import { CollisionBody } from '../src/physics/collisionBody.js';
import { CollisionWorld } from '../src/physics/collisionWorld.js';
import { BTN } from '../src/player/moveCmd.js';
import { playerMove } from '../src/player/movement.js';
import { DT, itemEnv, makePlayer } from './playerTestUtils.js';

const ROOM = 600; // meia largura da sala: x e z de −600 a 600
const CEILING = 300;
const WALLS = [-200, 200]; // planos das paredes finas, em x e em z
const THICK = { x: [0.5, 1], z: [2, 1] }; // espessura de cada parede fina
const R = HULL.radius;
const TEN_MINUTES = 10 * 60 * 64;
// Itens sorteados para a mão: [id, nível de zoom].
const ITEMS = [['knife', 0], ['ak47', 0], ['awp', 1], ['awp', 2], ['aug', 1], ['negev', 0], ['c4', 0], ['flash', 0]];

function buildWorld() {
  const b = new ColliderBuilder();
  const span = 2 * ROOM + 80;
  b.box(span, 20, span, { center: [0, -10, 0], surface: 'tapete' });
  b.box(span, 20, span, { center: [0, CEILING + 10, 0] });
  for (const s of [-1, 1]) {
    b.box(40, CEILING, span, { center: [s * (ROOM + 20), CEILING / 2, 0] });
    b.box(span, CEILING, 40, { center: [0, CEILING / 2, s * (ROOM + 20)] });
  }
  WALLS.forEach((w, i) => {
    b.box(THICK.x[i], CEILING, 2 * ROOM, { center: [w, CEILING / 2, 0], surface: 'papelao' });
    b.box(2 * ROOM, CEILING, THICK.z[i], { center: [0, CEILING / 2, w], surface: 'papelao' });
  });
  // Obstáculos da célula do meio: escada, rampa, pilar, laje baixa (túnel) e bloco solto.
  b.stairs(80, 16, 24, 4, { center: [-150, 0, -150] });
  b.ramp(80, 120, 60, { center: [120, 0, -180] });
  b.cylinder(20, CEILING, { center: [60, 0, -40], surface: 'plastico' });
  b.box(90, 10, 90, { center: [140, 65, 140] });
  b.box(60, 30, 60, { center: [-120, 15, 60] });
  const world = new CollisionWorld();
  world.addBody(new CollisionBody(b.build(), { name: 'celulas' }));
  // Painel que vai e volta em x (1,5 u por tick no máximo), sem espremer ninguém contra nada.
  const panel = world.addBody(new CollisionBody(new ColliderBuilder().box(60, 100, 8, { surface: 'papelao' }).build(), { name: 'painel' }));
  return { world, panel };
}

/** Célula 0..8 da grade 3 × 3 formada pelas paredes finas. */
function cellOf(v) {
  const c = (a) => (a < WALLS[0] ? 0 : a > WALLS[1] ? 2 : 1);
  return c(v.x) * 3 + c(v.z);
}

function simulate(seed, ticks, { check }) {
  const { world, panel } = buildWorld();
  const p = makePlayer(world, [0, 0, 0]);
  const rng = new RNG(seed);
  const m = new THREE.Matrix4();
  const dir = { x: 0, y: 0, z: 0 };
  const stats = {
    maxSpeed: 0, jumps: 0, kicks: 0, groundTicks: 0, duckTicks: 0, walkTicks: 0, blockedDucks: 0, items: new Set(),
    maxStamina: 0,
  };
  const startCell = cellOf(p.state.origin);
  let phase = 0;
  let turn = 0;
  let jumpRate = 0;
  let duckRate = 0;
  let walkRate = 0;
  for (let i = 0; i < ticks; i++) {
    panel.setMatrix(m.makeTranslation(-30 + 60 * Math.sin((2 * Math.PI * i * DT) / 4), 50, 150));
    if (phase-- <= 0) {
      phase = rng.int(16, 64);
      let f = rng.bool(0.3) ? rng.float(-1, 1) : rng.pick([-1, 0, 1]);
      let sd = rng.bool(0.3) ? rng.float(-1, 1) : rng.pick([-1, 0, 1]);
      const len = Math.hypot(f, sd);
      if (len > 1) {
        f /= len;
        sd /= len;
      }
      p.cmd.forward = f;
      p.cmd.side = sd;
      turn = rng.float(-6, 6); // rad/s
      jumpRate = rng.pick([0, 0.05, 0.3]);
      duckRate = rng.pick([0, 0, 0.5, 1]); // 0,5: aperta e solta a cada tick (spam)
      walkRate = rng.pick([0, 0, 1]);
      const [item, zoom] = rng.pick(ITEMS);
      p.env.item = itemEnv(item, zoom);
      stats.items.add(`${item}:${zoom}`);
    }
    p.cmd.yaw += turn * DT;
    p.cmd.buttons = (rng.bool(jumpRate) ? BTN.JUMP : 0) | (rng.bool(duckRate) ? BTN.DUCK : 0)
      | (rng.bool(walkRate) ? BTN.WALK : 0);
    // Empurrão (explosão, lançamento): até 3500 u/s em qualquer direção, inclusive direto contra as paredes.
    if (i % 200 === 199) {
      rng.onUnitSphere(dir);
      const v = rng.float(500, 3500);
      p.state.velocity.set(dir.x * v, dir.y * v, dir.z * v);
      p.state.onGround = false;
      stats.kicks++;
    }
    p.cmd.tick = i;
    playerMove(p.state, p.cmd, p.env);
    const s = p.state;
    stats.maxSpeed = Math.max(stats.maxSpeed, s.velocity.length());
    if (s.onGround) stats.groundTicks++;
    if (s.ducked) stats.duckTicks++;
    if (s.walking) stats.walkTicks++;
    if ((p.cmd.buttons & BTN.DUCK) && !s.duckHeld) stats.blockedDucks++;
    stats.maxStamina = Math.max(stats.maxStamina, s.stamina);
    for (const e of p.env.events) if (e.type === 'jump') stats.jumps++;
    if (!check) continue;
    if (cellOf(s.origin) !== startCell) assert.fail(`tick ${i}: atravessou para outra célula (${s.origin.toArray()})`);
    if (!(s.origin.y > -0.01 && s.origin.y + s.height < CEILING + 0.01)) assert.fail(`tick ${i}: saiu entre chão e teto (y ${s.origin.y})`);
    if (!world.canOccupy(s.origin.x, s.origin.y, s.origin.z, R, s.height, 0.05)) assert.fail(`tick ${i}: penetrando`);
    if (s.stuck) assert.fail(`tick ${i}: preso`);
  }
  return { state: p.state, stats };
}

test('10 min simulados com entrada aleatória e empurrões de até 3500 u/s: nenhuma parede atravessada', () => {
  const { stats } = simulate('dez-minutos', TEN_MINUTES, { check: true });
  // A simulação exercitou de fato o que se pede: altas velocidades, pulos, agachar, chão.
  assert.ok(stats.maxSpeed > 3000, `velocidade máxima ${stats.maxSpeed}`);
  assert.equal(stats.kicks, TEN_MINUTES / 200);
  assert.ok(stats.jumps > 50, `pulos ${stats.jumps}`);
  assert.ok(stats.duckTicks > 1000 && stats.groundTicks > 1000, `agachado ${stats.duckTicks}, chão ${stats.groundTicks}`);
  assert.ok(stats.walkTicks > 1000, `andando ${stats.walkTicks}`);
  assert.ok(stats.blockedDucks > 1000, `agachar travado pelo spam ${stats.blockedDucks}`);
  assert.ok(stats.maxStamina > 20, `stamina ${stats.maxStamina}`);
  assert.equal(stats.items.size, ITEMS.length, 'todos os itens passaram pela mão');
});

/** Estado inteiro como texto: números com a representação exata do double (igual ⇔ bit a bit). */
function snapshot(s) {
  return JSON.stringify({
    ...s, origin: s.origin.toArray(), velocity: s.velocity.toArray(), groundNormal: s.groundNormal.toArray(),
  });
}

test('a mesma seed dá o mesmo estado inteiro, bit a bit (2 min)', () => {
  const a = simulate('repetivel', 2 * 60 * 64, { check: false }).state;
  const b = simulate('repetivel', 2 * 60 * 64, { check: false }).state;
  assert.equal(snapshot(a), snapshot(b));
  for (const key of ['duckSpeed', 'stamina', 'stepTimer', 'sinceDuck', 'walkFactor', 'staminaFactor', 'duckFactor']) {
    assert.ok(key in a, `o estado tem ${key}`);
  }
});
