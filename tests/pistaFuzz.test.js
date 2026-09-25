// 10 minutos simulados na colisão da pista de testes (subfases 3.3 e 3.4; a parte automática do aceite da 3.5,
// adiantada): entrada aleatória com andar, spam de agachar, pulos, slides, wall-jumps e troca do item na mão, partindo
// de cada estação (50 s em cada uma, do primeiro ponto de teleporte), com empurrões de até 1500 u/s — nenhuma
// penetração além da folga, nunca preso, nunca abaixo do chão do estúdio. Depois, a mesma seed repetida dá o mesmo
// estado inteiro, bit a bit.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RNG } from '../src/core/rng.js';
import { HULL } from '../src/data/movement.js';
import { PISTA } from '../src/data/pista.js';
import { buildPistaLayout } from '../src/maps/pista/layout.js';
import { buildPistaColliders } from '../src/maps/pista/colliders.js';
import { CollisionWorld } from '../src/physics/collisionWorld.js';
import { resolveStations } from '../src/maps/stations.js';
import { BTN } from '../src/player/moveCmd.js';
import { playerMove } from '../src/player/movement.js';
import { DT, itemEnv, makePlayer } from './playerTestUtils.js';

const layout = buildPistaLayout();
const world = CollisionWorld.fromBuilder(buildPistaColliders(layout), 'pista');
const stations = resolveStations(layout.stations, world);
const TEN_MINUTES = 10 * 60 * 64;
const ITEMS = [['knife', 0], ['ak47', 0], ['awp', 1], ['negev', 0], ['c4', 0]];
const FLOOR = -PISTA.base.thickness; // chão do estúdio

function simulate(seed, ticks, { check }) {
  const rng = new RNG(seed);
  const per = Math.ceil(ticks / stations.length);
  const stats = { jumps: 0, ducks: 0, kicks: 0, maxY: -Infinity, stations: 0, slides: 0, wallJumps: 0 };
  let p = null;
  let phase = 0;
  let turn = 0;
  let rates = { jump: 0, duck: 0, walk: 0 };
  for (let i = 0; i < ticks; i++) {
    if (i % per === 0) {
      const st = stations[Math.floor(i / per)];
      const s = st.spots[0].position;
      p = makePlayer(world, [s.x, s.y, s.z], { yaw: st.spots[0].yaw });
      stats.stations++;
    }
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
      turn = rng.float(-5, 5);
      rates = { jump: rng.pick([0, 0.05, 0.3]), duck: rng.pick([0, 0, 0.5, 1]), walk: rng.pick([0, 0, 1]) };
      const [item, zoom] = rng.pick(ITEMS);
      p.env.item = itemEnv(item, zoom);
    }
    p.cmd.yaw += turn * DT;
    p.cmd.buttons = (rng.bool(rates.jump) ? BTN.JUMP : 0) | (rng.bool(rates.duck) ? BTN.DUCK : 0) | (rng.bool(rates.walk) ? BTN.WALK : 0);
    if (i % 400 === 399) {
      const dir = rng.onUnitSphere();
      const v = rng.float(300, 1500);
      p.state.velocity.set(dir.x * v, Math.abs(dir.y) * v, dir.z * v);
      p.state.onGround = false;
      stats.kicks++;
    }
    p.cmd.tick = i;
    playerMove(p.state, p.cmd, p.env);
    const s = p.state;
    for (const e of p.env.events) {
      if (e.type === 'jump') stats.jumps++;
      if (e.type === 'duck') stats.ducks++;
      if (e.type === 'slide' && e.phase === 'start') stats.slides++;
      if (e.type === 'walljump') stats.wallJumps++;
    }
    stats.maxY = Math.max(stats.maxY, s.origin.y);
    if (!check) continue;
    const o = s.origin;
    if (!world.canOccupy(o.x, o.y, o.z, HULL.radius, s.height, 0.05)) assert.fail(`tick ${i}: penetrando em ${o.toArray()}`);
    if (s.stuck) assert.fail(`tick ${i}: preso em ${o.toArray()}`);
    if (o.y < FLOOR - 0.01) assert.fail(`tick ${i}: abaixo do chão do estúdio (${o.y})`);
  }
  return { state: p.state, stats };
}

test('10 min simulados na pista, partindo de cada estação: nenhuma penetração, nunca preso', () => {
  const { stats } = simulate('pista-dez-minutos', TEN_MINUTES, { check: true });
  assert.equal(stats.stations, 12);
  assert.ok(stats.jumps > 100, `pulos ${stats.jumps}`);
  assert.ok(stats.ducks > 100, `agachadas ${stats.ducks}`);
  assert.equal(stats.kicks, TEN_MINUTES / 400);
  assert.ok(stats.maxY > 200, `subiu em alguma coisa (${stats.maxY})`);
  assert.ok(stats.slides > 20, `slides ${stats.slides}`);
  assert.ok(stats.wallJumps > 20, `wall-jumps ${stats.wallJumps}`);
});

/** Estado inteiro como texto: números com a representação exata do double (igual ⇔ bit a bit). */
function snapshot(s) {
  return JSON.stringify({
    ...s, origin: s.origin.toArray(), velocity: s.velocity.toArray(), groundNormal: s.groundNormal.toArray(),
  });
}

test('a mesma seed dá o mesmo estado inteiro na pista, bit a bit (2 min)', () => {
  const a = simulate('pista-repetivel', 2 * 60 * 64, { check: false }).state;
  const b = simulate('pista-repetivel', 2 * 60 * 64, { check: false }).state;
  assert.equal(snapshot(a), snapshot(b));
});
