// Testes da varredura de cápsula (Fase 3.1): contato exato de face, começo encostado, vértice rasante e 400 casos
// aleatórios conferidos por amostragem do caminho (nenhum contato antes do t devolvido).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RNG } from '../src/core/rng.js';
import { closestSegmentTriangle, createClosest } from '../src/physics/geometryQueries.js';
import { SWEEP_TOLERANCE, createSweepHit, sweepCapsuleTriangle } from '../src/physics/capsuleSweep.js';
import { randomTriangle, triangleArray } from './physicsTestUtils.js';

const TARGET = 16 + 0.03125;
const FLOOR = triangleArray([-1000, 0, 1000, 1000, 0, 1000, 0, 0, -1000]); // normal +Y
const c = createClosest();

/** Distância segmento–triângulo com o segmento s (6 números) deslocado por t·d. */
function distAt(T, s, d, t) {
  return Math.sqrt(closestSegmentTriangle(
    s[0] + d[0] * t, s[1] + d[1] * t, s[2] + d[2] * t, s[3] + d[0] * t, s[4] + d[1] * t, s[5] + d[2] * t, T, 0, c,
  ));
}

test('varredura: contato de face para exatamente a raio + folga', () => {
  const hit = createSweepHit();
  assert.ok(sweepCapsuleTriangle(0, 66, 0, 0, 106, 0, 0, -100, 0, FLOOR, 0, TARGET, 1, hit));
  assert.ok(Math.abs(hit.t - (66 - TARGET) / 100) < 1e-9, `t ${hit.t}`);
  assert.ok(Math.abs(hit.ny - 1) < 1e-12 && Math.abs(hit.py) < 1e-12);
  assert.equal(hit.startDist, 66);
  assert.equal(sweepCapsuleTriangle(0, 66, 0, 0, 106, 0, 0, -40, 0, FLOOR, 0, TARGET, 1, hit), false, 'para antes do chão');
  assert.equal(sweepCapsuleTriangle(0, 66, 0, 0, 106, 0, 0, -100, 0, FLOOR, 0, TARGET, 0.4, hit), false, 'além do tMax');
});

test('varredura: começando encostado só bloqueia se estiver se aproximando', () => {
  const hit = createSweepHit();
  assert.equal(sweepCapsuleTriangle(0, TARGET, 0, 0, TARGET + 40, 0, 50, 0, 0, FLOOR, 0, TARGET, 1, hit), false, 'deslizando rente');
  assert.equal(sweepCapsuleTriangle(0, TARGET, 0, 0, TARGET + 40, 0, 0, 10, 0, FLOOR, 0, TARGET, 1, hit), false, 'saindo');
  assert.equal(sweepCapsuleTriangle(0, TARGET, 0, 0, TARGET + 40, 0, 10, -1, 0, FLOOR, 0, TARGET, 1, hit), true, 'entrando');
  assert.equal(hit.t, 0);
  assert.ok(hit.ny > 0.999);
});

test('varredura: vértice rasante passa quando sobra folga e bate onde a geometria manda quando falta', () => {
  const wall = triangleArray([-50, -100, 0, 50, -100, 0, 0, 0, 0]); // triângulo em pé no plano z = 0, topo em (0, 0, 0)
  const hit = createSweepHit();
  const above = TARGET + 0.01;
  assert.equal(sweepCapsuleTriangle(0, above, -100, 0, above, -100, 0, 0, 200, wall, 0, TARGET, 1, hit), false);
  const below = TARGET - 0.5;
  assert.ok(sweepCapsuleTriangle(0, below, -100, 0, below, -100, 0, 0, 200, wall, 0, TARGET, 1, hit));
  const zHit = -100 + 200 * hit.t;
  const expected = -Math.sqrt(TARGET * TARGET - below * below);
  assert.ok(Math.abs(zHit - expected) < 0.01, `z ${zHit} × ${expected}`);
  assert.ok(Math.hypot(hit.px, hit.py, hit.pz) < 1e-6, 'contato no vértice do topo');
});

test('varredura: nenhum contato antes do t devolvido e distância = alvo no contato (400 casos)', () => {
  const rng = new RNG('varredura');
  const hit = createSweepHit();
  const axis = { x: 0, y: 0, z: 0 };
  const dir = { x: 0, y: 0, z: 0 };
  let hits = 0;
  let misses = 0;
  for (let n = 0; n < 400; n++) {
    const T = randomTriangle(rng, 60);
    rng.onUnitSphere(axis);
    rng.onUnitSphere(dir);
    const len = rng.float(0, 60);
    const b = [rng.float(-120, 120), rng.float(-120, 120), rng.float(-120, 120)];
    const s = [b[0], b[1], b[2], b[0] + axis.x * len, b[1] + axis.y * len, b[2] + axis.z * len];
    let d;
    if (n % 2 === 0) {
      // Metade dos casos mira um ponto do triângulo (sorteando só a direção, quase tudo passa longe); o alcance
      // varia, então parte para antes — faltas rentes ao contato também são conferidas.
      let u = rng.next();
      let v = rng.next();
      if (u + v > 1) {
        u = 1 - u;
        v = 1 - v;
      }
      const reach = rng.float(0.5, 2);
      const p = [0, 1, 2].map((k) => T[k] + (T[3 + k] - T[k]) * u + (T[6 + k] - T[k]) * v);
      const m = [0, 1, 2].map((k) => (s[k] + s[3 + k]) / 2);
      d = [(p[0] - m[0]) * reach + dir.x * 20, (p[1] - m[1]) * reach + dir.y * 20, (p[2] - m[2]) * reach + dir.z * 20];
    } else {
      const v = rng.float(1, 300);
      d = [dir.x * v, dir.y * v, dir.z * v];
    }
    const speed = Math.hypot(d[0], d[1], d[2]);
    if (distAt(T, s, d, 0) <= TARGET + 0.01) continue; // começar encostado tem teste próprio
    const ok = sweepCapsuleTriangle(...s, ...d, T, 0, TARGET, 1, hit);
    const tEnd = ok ? hit.t : 1;
    const N = 400;
    for (let k = 0; k < N; k++) {
      const t = (tEnd * k) / N;
      if (distAt(T, s, d, t) < TARGET - (speed * tEnd) / N - 1e-6) assert.fail(`caso ${n}: contato antes do t (${t})`);
    }
    if (!ok) {
      misses++;
      continue;
    }
    hits++;
    const at = distAt(T, s, d, hit.t);
    assert.ok(at >= TARGET - 1e-6 && at <= TARGET + SWEEP_TOLERANCE + 1e-6, `caso ${n}: distância no contato ${at}`);
    assert.ok(Math.abs(Math.hypot(hit.nx, hit.ny, hit.nz) - 1) < 1e-9);
    const nx = (c.sx - c.x) / at, ny = (c.sy - c.y) / at, nz = (c.sz - c.z) / at;
    assert.ok(nx * hit.nx + ny * hit.ny + nz * hit.nz > 0.999, `caso ${n}: normal não aponta do triângulo para a cápsula`);
  }
  assert.ok(hits > 50 && misses > 50, `cobertura: ${hits} contatos, ${misses} faltas`);
});
