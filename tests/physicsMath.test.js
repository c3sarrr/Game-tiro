// Testes das consultas geométricas (Fase 3.1) contra força bruta: ponto–triângulo, segmento–segmento,
// segmento–triângulo, raio–caixa e altura de triângulo dentro de cilindro vertical (chão da base chata).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RNG } from '../src/core/rng.js';
import {
  closestPointTriangle, closestSegmentSegment, closestSegmentTriangle, createClosest, createSegmentPair, rayBoxEntry,
  triangleDiscRange,
} from '../src/physics/geometryQueries.js';
import { randomTriangle, triangleArray } from './physicsTestUtils.js';

const dist2 = (ax, ay, az, bx, by, bz) => (ax - bx) ** 2 + (ay - by) ** 2 + (az - bz) ** 2;

/** Coordenadas baricêntricas de P (no plano do triângulo). */
function barycentric(T, px, py, pz) {
  const v0 = [T[3] - T[0], T[4] - T[1], T[5] - T[2]];
  const v1 = [T[6] - T[0], T[7] - T[1], T[8] - T[2]];
  const v2 = [px - T[0], py - T[1], pz - T[2]];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const d00 = dot(v0, v0), d01 = dot(v0, v1), d11 = dot(v1, v1), d20 = dot(v2, v0), d21 = dot(v2, v1);
  const den = d00 * d11 - d01 * d01;
  const v = (d11 * d20 - d01 * d21) / den;
  const w = (d00 * d21 - d01 * d20) / den;
  return [1 - v - w, v, w];
}

function assertOnTriangle(T, x, y, z, msg) {
  const planeDist = (x - T[0]) * T[9] + (y - T[1]) * T[10] + (z - T[2]) * T[11];
  assert.ok(Math.abs(planeDist) < 1e-6, `${msg}: fora do plano (${planeDist})`);
  for (const b of barycentric(T, x, y, z)) assert.ok(b > -1e-7, `${msg}: fora do triângulo (${b})`);
}

/** Menor distância² de P a uma grade baricêntrica densa do triângulo. */
function bruteTriangle(T, px, py, pz, n = 60) {
  let best = Infinity;
  for (let i = 0; i <= n; i++) {
    for (let j = 0; i + j <= n; j++) {
      const u = i / n, v = j / n;
      const x = T[0] + u * (T[3] - T[0]) + v * (T[6] - T[0]);
      const y = T[1] + u * (T[4] - T[1]) + v * (T[7] - T[1]);
      const z = T[2] + u * (T[5] - T[2]) + v * (T[8] - T[2]);
      best = Math.min(best, dist2(px, py, pz, x, y, z));
    }
  }
  return best;
}

test('ponto–triângulo: o ponto devolvido está no triângulo e é o mais próximo (400 casos)', () => {
  const rng = new RNG('ponto-triangulo');
  const out = createClosest();
  for (let n = 0; n < 400; n++) {
    const T = randomTriangle(rng, 80);
    const px = rng.float(-150, 150), py = rng.float(-150, 150), pz = rng.float(-150, 150);
    const d = closestPointTriangle(px, py, pz, T, 0, out);
    assertOnTriangle(T, out.x, out.y, out.z, `caso ${n}`);
    assert.ok(Math.abs(d - dist2(px, py, pz, out.x, out.y, out.z)) < 1e-6);
    assert.ok(d <= bruteTriangle(T, px, py, pz) + 1e-9, `caso ${n}: não é o mínimo`);
  }
});

test('ponto–triângulo: regiões de vértice, aresta e face', () => {
  const T = triangleArray([0, 0, 0, 10, 0, 0, 0, 10, 0]);
  const out = createClosest();
  assert.equal(closestPointTriangle(-5, -5, 3, T, 0, out), 59);
  assert.deepEqual([out.x, out.y, out.z], [0, 0, 0]);
  closestPointTriangle(5, -4, 0, T, 0, out);
  assert.deepEqual([out.x, out.y, out.z], [5, 0, 0]);
  assert.equal(closestPointTriangle(2, 3, 7, T, 0, out), 49);
  assert.deepEqual([out.x, out.y, out.z], [2, 3, 0]);
});

test('segmento–segmento: parâmetros em [0, 1] e mínimo contra grade densa (300 casos)', () => {
  const rng = new RNG('segmento-segmento');
  const out = createSegmentPair();
  for (let n = 0; n < 300; n++) {
    const p = Array.from({ length: 12 }, () => rng.float(-100, 100));
    // um em cada cinco casos com segmentos paralelos (o caso difícil do algoritmo)
    if (n % 5 === 0) {
      p[9] = p[6] + (p[3] - p[0]) * 0.7;
      p[10] = p[7] + (p[4] - p[1]) * 0.7;
      p[11] = p[8] + (p[5] - p[2]) * 0.7;
    }
    const d = closestSegmentSegment(...p, out);
    assert.ok(out.s >= 0 && out.s <= 1 && out.t >= 0 && out.t <= 1);
    assert.ok(Math.abs(out.px - (p[0] + (p[3] - p[0]) * out.s)) < 1e-9);
    assert.ok(Math.abs(out.qz - (p[8] + (p[11] - p[8]) * out.t)) < 1e-9);
    let brute = Infinity;
    for (let i = 0; i <= 120; i++) {
      for (let j = 0; j <= 120; j++) {
        const s = i / 120, t = j / 120;
        brute = Math.min(brute, dist2(
          p[0] + (p[3] - p[0]) * s, p[1] + (p[4] - p[1]) * s, p[2] + (p[5] - p[2]) * s,
          p[6] + (p[9] - p[6]) * t, p[7] + (p[10] - p[7]) * t, p[8] + (p[11] - p[8]) * t,
        ));
      }
    }
    assert.ok(d <= brute + 1e-9, `caso ${n}: ${d} > ${brute}`);
  }
});

test('segmento–triângulo: pontos válidos, mínimo contra amostragem e zero quando fura (300 casos)', () => {
  const rng = new RNG('segmento-triangulo');
  const out = createClosest();
  const tmp = createClosest();
  for (let n = 0; n < 300; n++) {
    const T = randomTriangle(rng, 70);
    const p = Array.from({ length: 6 }, () => rng.float(-120, 120));
    const d = closestSegmentTriangle(...p, T, 0, out);
    assertOnTriangle(T, out.x, out.y, out.z, `caso ${n}`);
    assert.ok(Math.abs(d - dist2(out.x, out.y, out.z, out.sx, out.sy, out.sz)) < 1e-6);
    let brute = Infinity;
    for (let k = 0; k <= 300; k++) {
      const s = k / 300;
      brute = Math.min(brute, closestPointTriangle(
        p[0] + (p[3] - p[0]) * s, p[1] + (p[4] - p[1]) * s, p[2] + (p[5] - p[2]) * s, T, 0, tmp,
      ));
    }
    assert.ok(d <= brute + 1e-9, `caso ${n}: ${d} > ${brute}`);
  }
  // Segmento vertical furando o miolo do triângulo horizontal.
  const flat = triangleArray([-10, 0, -10, 10, 0, -10, 0, 0, 10]);
  assert.equal(closestSegmentTriangle(1, -5, 0, 1, 5, 0, flat, 0, out), 0);
  assert.deepEqual([out.x, out.y, out.z], [1, 0, 0]);
});

test('raio–caixa: entrada, dentro, falta, paralelo e limite de tempo', () => {
  const box = [-1, -1, -1, 1, 1, 1];
  assert.equal(rayBoxEntry(-5, 0, 0, 10, 0, 0, ...box, 1), 0.4);
  assert.equal(rayBoxEntry(0, 0, 0, 10, 0, 0, ...box, 1), 0);
  assert.equal(rayBoxEntry(-5, 3, 0, 10, 0, 0, ...box, 1), Infinity);
  assert.equal(rayBoxEntry(-5, 0, 0, 0, 0, 0, ...box, 1), Infinity);
  assert.equal(rayBoxEntry(-5, 0, 0, 10, 0, 0, ...box, 0.3), Infinity);
  assert.equal(rayBoxEntry(5, 0, 0, -10, 0, 0, ...box, 1), 0.4);
});

test('triângulo × cilindro vertical: alcance de altura contém e acompanha a amostragem densa (300 casos)', () => {
  const rng = new RNG('disco');
  const out = { min: 0, max: 0 };
  const N = 160;
  let hits = 0;
  for (let n = 0; n < 300; n++) {
    let T;
    do T = randomTriangle(rng, 60);
    while (Math.abs(T[10]) < 0.5); // até ~60°: a altura é afim sobre XZ
    const sign = T[10] >= 0 ? 1 : -1;
    const nx = T[9] * sign, ny = T[10] * sign, nz = T[11] * sign;
    const cx = rng.float(-60, 60), cz = rng.float(-60, 60), r = rng.float(2, 30);
    const found = triangleDiscRange(T, nx, ny, nz, cx, cz, r, out);
    let min = Infinity;
    let max = -Infinity;
    for (let i = 0; i <= N; i++) {
      for (let j = 0; j <= N - i; j++) {
        const u = i / N, v = j / N;
        const x = T[0] + (T[3] - T[0]) * u + (T[6] - T[0]) * v;
        const z = T[2] + (T[5] - T[2]) * u + (T[8] - T[2]) * v;
        if ((x - cx) ** 2 + (z - cz) ** 2 > r * r) continue;
        const y = T[1] + (T[4] - T[1]) * u + (T[7] - T[1]) * v;
        if (y < min) min = y;
        if (y > max) max = y;
      }
    }
    if (min > max) continue; // interseção pequena demais para a grade: só o lado exato vê
    hits++;
    assert.ok(found, `caso ${n}: amostras dentro do disco, mas sem alcance`);
    assert.ok(out.min <= min + 1e-9 && out.max >= max - 1e-9, `caso ${n}: alcance [${out.min}, ${out.max}] não cobre [${min}, ${max}]`);
    // A grade anda no máximo ~170/N u entre amostras; a altura muda no máximo inclinação × isso.
    const tol = (170 / N) * (Math.hypot(nx, nz) / ny) + 1e-6;
    assert.ok(out.min >= min - tol && out.max <= max + tol, `caso ${n}: alcance [${out.min}, ${out.max}] longe de [${min}, ${max}]`);
  }
  assert.ok(hits > 100, `poucos casos com interseção (${hits})`);
});
