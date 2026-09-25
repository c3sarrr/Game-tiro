// Escultura de geometria de massinha na CPU: soldar vértices, calombos de baixa frequência (a massa nunca é
// perfeita), amassados de polegar (depressões suaves — PLA4/PLA15), e o atributo aTouch (convexidade: bordas e
// pontas são onde o animador mais encosta, então é onde o shader põe mais digitais).

import * as THREE from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { createNoise3 } from './cpuNoise.js';
import { RNG } from '../../core/rng.js';

/** Solda vértices por posição (remove UVs/normais antigas) e recalcula normais suaves. */
export function weld(geometry, tolerance = 1e-3) {
  const g = geometry.index ? geometry.toNonIndexed() : geometry.clone();
  for (const name of Object.keys(g.attributes)) if (name !== 'position') g.deleteAttribute(name);
  const merged = mergeVertices(g, tolerance);
  merged.computeVertexNormals();
  g.dispose();
  if (merged !== geometry) geometry.dispose();
  return merged;
}

/**
 * Calombos + amassados. `radius`: tamanho de referência (raio do objeto).
 * @returns {THREE.BufferGeometry} a mesma geometria, modificada
 */
export function sculpt(geometry, {
  seed = 1,
  radius = null,
  lumpiness = 0.045,
  lumpFreq = 1.4,
  dents = 3,
  dentDepth = 0.07,
  dentRadius = 0.32,
} = {}) {
  geometry.computeBoundingSphere();
  const R = radius ?? geometry.boundingSphere.radius;
  const pos = geometry.attributes.position;
  const nrm = geometry.attributes.normal;
  const n = pos.count;
  const noise = createNoise3(seed);
  const rng = new RNG(`sculpt:${seed}`);
  const f = lumpFreq / R;

  if (lumpiness > 0) {
    for (let i = 0; i < n; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      const z = pos.getZ(i);
      const d = noise.fbm(x * f, y * f, z * f, 3) * lumpiness * R;
      pos.setXYZ(i, x + nrm.getX(i) * d, y + nrm.getY(i) * d, z + nrm.getZ(i) * d);
    }
  }

  for (let k = 0; k < dents; k++) {
    const c = rng.int(0, n - 1);
    const cx = pos.getX(c);
    const cy = pos.getY(c);
    const cz = pos.getZ(c);
    const nx = nrm.getX(c);
    const ny = nrm.getY(c);
    const nz = nrm.getZ(c);
    const rad = dentRadius * R * rng.float(0.7, 1.3);
    const depth = dentDepth * R * rng.float(0.6, 1.2);
    const lim = (rad * 1.9) ** 2;
    const inv = 1 / (rad * rad * 0.5);
    for (let i = 0; i < n; i++) {
      const dx = pos.getX(i) - cx;
      const dy = pos.getY(i) - cy;
      const dz = pos.getZ(i) - cz;
      const d2 = dx * dx + dy * dy + dz * dz;
      if (d2 > lim) continue;
      const w = Math.exp(-d2 * inv) * depth;
      pos.setXYZ(i, pos.getX(i) - nx * w, pos.getY(i) - ny * w, pos.getZ(i) - nz * w);
    }
  }
  pos.needsUpdate = true;
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

/**
 * aTouch = convexidade normalizada (0..1). Curvatura média aproximada pelos vizinhos:
 * k = média de dot(n_i, p_i - p_j) / |p_i - p_j|² (positiva em regiões convexas).
 */
export function computeTouch(geometry, { base = 0.12, gain = 0.85 } = {}) {
  const pos = geometry.attributes.position;
  const nrm = geometry.attributes.normal;
  const index = geometry.index;
  const n = pos.count;
  const k = new Float32Array(n);
  const cnt = new Uint16Array(n);
  const accum = (a, b) => {
    const dx = pos.getX(a) - pos.getX(b);
    const dy = pos.getY(a) - pos.getY(b);
    const dz = pos.getZ(a) - pos.getZ(b);
    const l2 = dx * dx + dy * dy + dz * dz;
    if (l2 < 1e-10) return;
    k[a] += (nrm.getX(a) * dx + nrm.getY(a) * dy + nrm.getZ(a) * dz) / l2;
    cnt[a]++;
  };
  const tri = index ? index.array : null;
  const triCount = index ? tri.length / 3 : n / 3;
  for (let t = 0; t < triCount; t++) {
    const a = tri ? tri[t * 3] : t * 3;
    const b = tri ? tri[t * 3 + 1] : t * 3 + 1;
    const c = tri ? tri[t * 3 + 2] : t * 3 + 2;
    accum(a, b); accum(a, c); accum(b, a); accum(b, c); accum(c, a); accum(c, b);
  }
  const vals = [];
  for (let i = 0; i < n; i++) {
    k[i] = cnt[i] ? k[i] / cnt[i] : 0;
    if (k[i] > 0) vals.push(k[i]);
  }
  vals.sort((a, b) => a - b);
  const p95 = vals.length ? vals[Math.floor(vals.length * 0.95)] : 1;
  const touch = new Float32Array(n);
  for (let i = 0; i < n; i++) touch[i] = Math.min(1, base + gain * Math.max(0, k[i]) / (p95 || 1));
  geometry.setAttribute('aTouch', new THREE.BufferAttribute(touch, 1));
  return geometry;
}

/** Atributos finais que o ClayMaterial espera (aTouch, aSeam) + bounds. */
export function finalizeClayGeometry(geometry, { touch = true } = {}) {
  const n = geometry.attributes.position.count;
  if (touch && !geometry.attributes.aTouch) computeTouch(geometry);
  if (!geometry.attributes.aTouch) geometry.setAttribute('aTouch', new THREE.BufferAttribute(new Float32Array(n), 1));
  if (!geometry.attributes.aSeam) geometry.setAttribute('aSeam', new THREE.BufferAttribute(new Float32Array(n), 1));
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}
