// Ruído de gradiente 3D na CPU (com seed), para esculpir geometria de massinha no carregamento.
// Mesmo espírito do clayNoise3 do shader: hash por vértice da rede, interpolação quíntica, saída ≈ [-1, 1].

import { RNG } from '../../core/rng.js';

const PERM_SIZE = 256;

export function createNoise3(seed = 1) {
  const rng = new RNG(`noise3:${seed}`);
  const perm = new Uint8Array(PERM_SIZE * 2);
  const p = Array.from({ length: PERM_SIZE }, (_, i) => i);
  rng.shuffle(p);
  for (let i = 0; i < PERM_SIZE * 2; i++) perm[i] = p[i & 255];
  // 16 gradientes para as arestas de um cubo (Ken Perlin, "Improving Noise").
  const G = [
    [1, 1, 0], [-1, 1, 0], [1, -1, 0], [-1, -1, 0], [1, 0, 1], [-1, 0, 1], [1, 0, -1], [-1, 0, -1],
    [0, 1, 1], [0, -1, 1], [0, 1, -1], [0, -1, -1], [1, 1, 0], [0, -1, 1], [-1, 1, 0], [0, -1, -1],
  ];
  const grad = (h, x, y, z) => {
    const g = G[h & 15];
    return g[0] * x + g[1] * y + g[2] * z;
  };
  const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);
  const lerp = (a, b, t) => a + (b - a) * t;

  function noise(x, y, z) {
    const X = Math.floor(x);
    const Y = Math.floor(y);
    const Z = Math.floor(z);
    const xf = x - X;
    const yf = y - Y;
    const zf = z - Z;
    const xi = X & 255;
    const yi = Y & 255;
    const zi = Z & 255;
    const u = fade(xf);
    const v = fade(yf);
    const w = fade(zf);
    const a = perm[xi] + yi;
    const aa = perm[a] + zi;
    const ab = perm[a + 1] + zi;
    const b = perm[xi + 1] + yi;
    const ba = perm[b] + zi;
    const bb = perm[b + 1] + zi;
    return lerp(
      lerp(
        lerp(grad(perm[aa], xf, yf, zf), grad(perm[ba], xf - 1, yf, zf), u),
        lerp(grad(perm[ab], xf, yf - 1, zf), grad(perm[bb], xf - 1, yf - 1, zf), u),
        v,
      ),
      lerp(
        lerp(grad(perm[aa + 1], xf, yf, zf - 1), grad(perm[ba + 1], xf - 1, yf, zf - 1), u),
        lerp(grad(perm[ab + 1], xf, yf - 1, zf - 1), grad(perm[bb + 1], xf - 1, yf - 1, zf - 1), u),
        v,
      ),
      w,
    );
  }

  function fbm(x, y, z, octaves = 3) {
    let sum = 0;
    let amp = 0.5;
    let norm = 0;
    let f = 1;
    for (let i = 0; i < octaves; i++) {
      sum += amp * noise(x * f + i * 17.1, y * f + i * 5.3, z * f + i * 11.7);
      norm += amp;
      f *= 2.03;
      amp *= 0.5;
    }
    return sum / norm;
  }

  return { noise, fbm };
}
