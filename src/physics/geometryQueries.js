// Consultas geométricas puras e sem alocação: ponto–triângulo, segmento–segmento, segmento–triângulo, raio–caixa e
// alcance de altura de um triângulo dentro de um cilindro vertical (chão da base chata). Base da varredura de cápsula
// (capsuleSweep.js) e das consultas do mundo de colisão. Algoritmos de Ericson,
// "Real-Time Collision Detection": 5.1.5 (ponto–triângulo), 5.1.9 (segmento–segmento), 5.3.3 (raio–caixa).
// Triângulos ficam num Float64Array com passo TRI_STRIDE: a(3) b(3) c(3) normal unitária(3), com a normal
// coerente com a ordem a → b → c.

export const TRI_STRIDE = 12;

const EPS = 1e-12;
const PARALLEL_EPS = 1e-10;

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

/** Resultado reutilizável: ponto no triângulo (x, y, z) e ponto no segmento (sx, sy, sz). */
export function createClosest() {
  return { x: 0, y: 0, z: 0, sx: 0, sy: 0, sz: 0 };
}

/** Resultado reutilizável do segmento–segmento: parâmetros s e t e os pontos em P (px…) e em Q (qx…). */
export function createSegmentPair() {
  return { s: 0, t: 0, px: 0, py: 0, pz: 0, qx: 0, qy: 0, qz: 0 };
}

/** Ponto do triângulo `o` de T mais próximo de P (Ericson 5.1.5). Escreve em out.x/y/z; devolve a distância². */
export function closestPointTriangle(px, py, pz, T, o, out) {
  const ax = T[o], ay = T[o + 1], az = T[o + 2];
  const bx = T[o + 3], by = T[o + 4], bz = T[o + 5];
  const cx = T[o + 6], cy = T[o + 7], cz = T[o + 8];
  const abx = bx - ax, aby = by - ay, abz = bz - az;
  const acx = cx - ax, acy = cy - ay, acz = cz - az;
  const apx = px - ax, apy = py - ay, apz = pz - az;
  const d1 = abx * apx + aby * apy + abz * apz;
  const d2 = acx * apx + acy * apy + acz * apz;
  let qx;
  let qy;
  let qz;
  if (d1 <= 0 && d2 <= 0) {
    qx = ax; qy = ay; qz = az;
  } else {
    const bpx = px - bx, bpy = py - by, bpz = pz - bz;
    const d3 = abx * bpx + aby * bpy + abz * bpz;
    const d4 = acx * bpx + acy * bpy + acz * bpz;
    const vc = d1 * d4 - d3 * d2;
    if (d3 >= 0 && d4 <= d3) {
      qx = bx; qy = by; qz = bz;
    } else if (vc <= 0 && d1 >= 0 && d3 <= 0) {
      const v = d1 / (d1 - d3);
      qx = ax + v * abx; qy = ay + v * aby; qz = az + v * abz;
    } else {
      const cpx = px - cx, cpy = py - cy, cpz = pz - cz;
      const d5 = abx * cpx + aby * cpy + abz * cpz;
      const d6 = acx * cpx + acy * cpy + acz * cpz;
      const vb = d5 * d2 - d1 * d6;
      const va = d3 * d6 - d5 * d4;
      if (d6 >= 0 && d5 <= d6) {
        qx = cx; qy = cy; qz = cz;
      } else if (vb <= 0 && d2 >= 0 && d6 <= 0) {
        const w = d2 / (d2 - d6);
        qx = ax + w * acx; qy = ay + w * acy; qz = az + w * acz;
      } else if (va <= 0 && d4 - d3 >= 0 && d5 - d6 >= 0) {
        const w = (d4 - d3) / (d4 - d3 + (d5 - d6));
        qx = bx + w * (cx - bx); qy = by + w * (cy - by); qz = bz + w * (cz - bz);
      } else {
        const denom = 1 / (va + vb + vc);
        const v = vb * denom;
        const w = vc * denom;
        qx = ax + abx * v + acx * w; qy = ay + aby * v + acy * w; qz = az + abz * v + acz * w;
      }
    }
  }
  out.x = qx;
  out.y = qy;
  out.z = qz;
  const dx = px - qx, dy = py - qy, dz = pz - qz;
  return dx * dx + dy * dy + dz * dz;
}

/** Pontos mais próximos entre os segmentos P0P1 e Q0Q1 (Ericson 5.1.9). Escreve em `out`; devolve a distância². */
export function closestSegmentSegment(p0x, p0y, p0z, p1x, p1y, p1z, q0x, q0y, q0z, q1x, q1y, q1z, out) {
  const d1x = p1x - p0x, d1y = p1y - p0y, d1z = p1z - p0z;
  const d2x = q1x - q0x, d2y = q1y - q0y, d2z = q1z - q0z;
  const rx = p0x - q0x, ry = p0y - q0y, rz = p0z - q0z;
  const a = d1x * d1x + d1y * d1y + d1z * d1z;
  const e = d2x * d2x + d2y * d2y + d2z * d2z;
  const f = d2x * rx + d2y * ry + d2z * rz;
  let s;
  let t;
  if (a <= EPS && e <= EPS) {
    s = 0;
    t = 0;
  } else if (a <= EPS) {
    s = 0;
    t = clamp01(f / e);
  } else {
    const c = d1x * rx + d1y * ry + d1z * rz;
    if (e <= EPS) {
      t = 0;
      s = clamp01(-c / a);
    } else {
      const b = d1x * d2x + d1y * d2y + d1z * d2z;
      const denom = a * e - b * b;
      // Quase paralelos: qualquer s serve; s = 0 e o ajuste de t abaixo acham o par certo.
      s = denom > PARALLEL_EPS * a * e ? clamp01((b * f - c * e) / denom) : 0;
      t = (b * s + f) / e;
      if (t < 0) {
        t = 0;
        s = clamp01(-c / a);
      } else if (t > 1) {
        t = 1;
        s = clamp01((b - c) / a);
      }
    }
  }
  out.s = s;
  out.t = t;
  out.px = p0x + d1x * s;
  out.py = p0y + d1y * s;
  out.pz = p0z + d1z * s;
  out.qx = q0x + d2x * t;
  out.qy = q0y + d2y * t;
  out.qz = q0z + d2z * t;
  const dx = out.px - out.qx, dy = out.py - out.qy, dz = out.pz - out.qz;
  return dx * dx + dy * dy + dz * dz;
}

/** P (já no plano do triângulo) está dentro dele? Usa a normal guardada, coerente com a ordem a → b → c. */
function insideTriangle(px, py, pz, T, o) {
  const nx = T[o + 9], ny = T[o + 10], nz = T[o + 11];
  for (let e = 0; e < 3; e++) {
    const i0 = o + e * 3;
    const i1 = o + ((e + 1) % 3) * 3;
    const ex = T[i1] - T[i0], ey = T[i1 + 1] - T[i0 + 1], ez = T[i1 + 2] - T[i0 + 2];
    const wx = px - T[i0], wy = py - T[i0 + 1], wz = pz - T[i0 + 2];
    if ((ey * wz - ez * wy) * nx + (ez * wx - ex * wz) * ny + (ex * wy - ey * wx) * nz < 0) return false;
  }
  return true;
}

const _pair = createSegmentPair();

/**
 * Pontos mais próximos entre o segmento P0P1 e o triângulo `o` de T. Escreve em `out` o ponto no triângulo (x, y, z)
 * e o ponto no segmento (sx, sy, sz); devolve a distância² (0 quando o segmento fura o triângulo).
 * Candidatos (Ericson 5.1): furo no plano dentro do triângulo; senão as duas pontas contra o triângulo e o
 * segmento contra as três arestas (um par de mais próximos sempre envolve um desses).
 */
export function closestSegmentTriangle(p0x, p0y, p0z, p1x, p1y, p1z, T, o, out) {
  const ax = T[o], ay = T[o + 1], az = T[o + 2];
  const nx = T[o + 9], ny = T[o + 10], nz = T[o + 11];
  const e0 = (p0x - ax) * nx + (p0y - ay) * ny + (p0z - az) * nz;
  const e1 = (p1x - ax) * nx + (p1y - ay) * ny + (p1z - az) * nz;
  if ((e0 <= 0 && e1 >= 0) || (e0 >= 0 && e1 <= 0)) {
    const den = e0 - e1;
    if (den !== 0) {
      const t = e0 / den;
      const ix = p0x + (p1x - p0x) * t;
      const iy = p0y + (p1y - p0y) * t;
      const iz = p0z + (p1z - p0z) * t;
      if (insideTriangle(ix, iy, iz, T, o)) {
        out.x = ix;
        out.y = iy;
        out.z = iz;
        out.sx = ix;
        out.sy = iy;
        out.sz = iz;
        return 0;
      }
    }
  }
  let best = closestPointTriangle(p0x, p0y, p0z, T, o, out);
  let bx = out.x, by = out.y, bz = out.z;
  let sx = p0x, sy = p0y, sz = p0z;
  const d = closestPointTriangle(p1x, p1y, p1z, T, o, out);
  if (d < best) {
    best = d;
    bx = out.x; by = out.y; bz = out.z;
    sx = p1x; sy = p1y; sz = p1z;
  }
  for (let e = 0; e < 3; e++) {
    const i0 = o + e * 3;
    const i1 = o + ((e + 1) % 3) * 3;
    const de = closestSegmentSegment(p0x, p0y, p0z, p1x, p1y, p1z, T[i0], T[i0 + 1], T[i0 + 2], T[i1], T[i1 + 1], T[i1 + 2], _pair);
    if (de < best) {
      best = de;
      bx = _pair.qx; by = _pair.qy; bz = _pair.qz;
      sx = _pair.px; sy = _pair.py; sz = _pair.pz;
    }
  }
  out.x = bx;
  out.y = by;
  out.z = bz;
  out.sx = sx;
  out.sy = sy;
  out.sz = sz;
  return best;
}

/**
 * Tempo de entrada do raio O + t·D, t ∈ [0, tMax], na caixa [min, max] (lajes, Ericson 5.3.3).
 * 0 se O já está dentro; Infinity se o raio não entra na caixa nesse intervalo.
 */
export function rayBoxEntry(ox, oy, oz, dx, dy, dz, minX, minY, minZ, maxX, maxY, maxZ, tMax) {
  let t0 = 0;
  let t1 = tMax;
  if (dx > -EPS && dx < EPS) {
    if (ox < minX || ox > maxX) return Infinity;
  } else {
    const inv = 1 / dx;
    let a = (minX - ox) * inv;
    let b = (maxX - ox) * inv;
    if (a > b) { const tmp = a; a = b; b = tmp; }
    if (a > t0) t0 = a;
    if (b < t1) t1 = b;
    if (t0 > t1) return Infinity;
  }
  if (dy > -EPS && dy < EPS) {
    if (oy < minY || oy > maxY) return Infinity;
  } else {
    const inv = 1 / dy;
    let a = (minY - oy) * inv;
    let b = (maxY - oy) * inv;
    if (a > b) { const tmp = a; a = b; b = tmp; }
    if (a > t0) t0 = a;
    if (b < t1) t1 = b;
    if (t0 > t1) return Infinity;
  }
  if (dz > -EPS && dz < EPS) {
    if (oz < minZ || oz > maxZ) return Infinity;
  } else {
    const inv = 1 / dz;
    let a = (minZ - oz) * inv;
    let b = (maxZ - oz) * inv;
    if (a > b) { const tmp = a; a = b; b = tmp; }
    if (a > t0) t0 = a;
    if (b < t1) t1 = b;
    if (t0 > t1) return Infinity;
  }
  return t0;
}

/** Altura do plano do triângulo P (normal n, não vertical) no ponto (x, z). */
function planeY(P, nx, ny, nz, x, z) {
  return P[1] - (nx * (x - P[0]) + nz * (z - P[2])) / ny;
}

/** (x, z) dentro da projeção XZ do triângulo P (qualquer orientação, borda inclusa)? */
function insideXZ(P, x, z) {
  const d0 = (P[3] - P[0]) * (z - P[2]) - (P[5] - P[2]) * (x - P[0]);
  const d1 = (P[6] - P[3]) * (z - P[5]) - (P[8] - P[5]) * (x - P[3]);
  const d2 = (P[0] - P[6]) * (z - P[8]) - (P[2] - P[8]) * (x - P[6]);
  const eps = 1e-9;
  return (d0 >= -eps && d1 >= -eps && d2 >= -eps) || (d0 <= eps && d1 <= eps && d2 <= eps);
}

/**
 * Alcance de altura do triângulo P (9 números, mundo, não vertical) dentro do cilindro vertical de raio r em (cx, cz).
 * A altura é afim sobre a projeção XZ, então os extremos em triângulo ∩ disco ficam em vértices dentro do disco,
 * cruzamentos das arestas com o círculo ou nos pontos do círculo na direção de subida/descida do plano (o centro,
 * se o plano é horizontal). false se o triângulo não chega ao disco.
 */
export function triangleDiscRange(P, nx, ny, nz, cx, cz, r, out) {
  const r2 = r * r;
  let min = Infinity;
  let max = -Infinity;
  for (let k = 0; k < 9; k += 3) {
    const dx = P[k] - cx, dz = P[k + 2] - cz;
    if (dx * dx + dz * dz <= r2) {
      if (P[k + 1] < min) min = P[k + 1];
      if (P[k + 1] > max) max = P[k + 1];
    }
  }
  for (let k = 0; k < 9; k += 3) {
    const b = (k + 3) % 9;
    const ex = P[b] - P[k], ez = P[b + 2] - P[k + 2];
    const A = ex * ex + ez * ez;
    if (A < 1e-18) continue;
    const fx = P[k] - cx, fz = P[k + 2] - cz;
    const B = fx * ex + fz * ez;
    const disc = B * B - A * (fx * fx + fz * fz - r2);
    if (disc < 0) continue;
    const sq = Math.sqrt(disc);
    for (let s = -1; s <= 1; s += 2) {
      const t = (-B + s * sq) / A;
      if (t < 0 || t > 1) continue;
      const y = P[k + 1] + t * (P[b + 1] - P[k + 1]);
      if (y < min) min = y;
      if (y > max) max = y;
    }
  }
  const gx = -nx / ny, gz = -nz / ny; // subida da altura por unidade em X e em Z
  const g = Math.hypot(gx, gz);
  if (g < 1e-12) {
    if (insideXZ(P, cx, cz)) {
      const y = planeY(P, nx, ny, nz, cx, cz);
      if (y < min) min = y;
      if (y > max) max = y;
    }
  } else {
    const ux = (gx / g) * r, uz = (gz / g) * r;
    for (let s = -1; s <= 1; s += 2) {
      const x = cx + s * ux, z = cz + s * uz;
      if (!insideXZ(P, x, z)) continue;
      const y = planeY(P, nx, ny, nz, x, z);
      if (y < min) min = y;
      if (y > max) max = y;
    }
  }
  if (min > max) return false;
  out.min = min;
  out.max = max;
  return true;
}
