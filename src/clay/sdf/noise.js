// Ruído de gradiente 3D determinístico para o nó `displace` das árvores SDF (a irregularidade da massa amassada
// à mão). Algoritmo: ruído de Perlin "melhorado" (Ken Perlin, 2002) — hash por tabela de permutação de 256
// entradas, 12 gradientes de aresta de cubo (16 casos) e interpolação quíntica — com a tabela embaralhada por uma
// seed (sfc32 de src/core/rng.js): a mesma seed dá o mesmo relevo no Worker, na thread principal e no teste.
// Desempenho: por seed, os gradientes já saem resolvidos em tabelas (gx/gy/gz por entrada da permutação), então
// cada canto é um produto escalar sem desvio condicional (o `grad()` original erra metade das previsões de desvio).
// Faixa medida: |noise3| ≤ 0,9956 em 2 milhões de amostras (preso em [-1, 1] para o limite ser estrito).
// Gradiente medido: |∇noise3| ≤ 3,18 → NOISE_GRAD_BOUND = 4 com margem (usado na poda de blocos da malha).

import { RNG } from '../../core/rng.js';

/** Limite superior de |∇noise3| por unidade de frequência (medido 3,18; margem de ~25%). */
export const NOISE_GRAD_BOUND = 4;

/** Máximo de oitavas aceito pelo fBm (cada uma custa um noise3). */
export const MAX_OCTAVES = 8;

// Os 16 gradientes do ruído melhorado (12 arestas do cubo, 4 repetidas), na ordem do `grad(hash & 15)` original:
// u = h < 8 ? x : y; v = h < 4 ? y : (h = 12 ou 14 ? x : z); resultado = ±u ± v (bits 0 e 1 de h).
const GRAD_X = [1, -1, 1, -1, 1, -1, 1, -1, 0, 0, 0, 0, 1, 0, -1, 0];
const GRAD_Y = [1, 1, -1, -1, 0, 0, 0, 0, 1, -1, 1, -1, 1, -1, 1, -1];
const GRAD_Z = [0, 0, 0, 0, 1, 1, -1, -1, 1, 1, -1, -1, 0, 1, 0, -1];

const tableCache = new Map();

/**
 * Tabelas do ruído para uma seed (número ou texto), cacheadas: `perm` (0..255 embaralhado e repetido, 512
 * entradas) e os gradientes já resolvidos por entrada (gx/gy/gz[i] = gradiente de perm[i] & 15).
 * @returns {{perm:Int32Array, gx:Float64Array, gy:Float64Array, gz:Float64Array}}
 */
export function noisePerm(seed = 0) {
  const key = String(seed);
  let table = tableCache.get(key);
  if (!table) {
    const order = new RNG(`sdf-ruido:${key}`).shuffle(Array.from({ length: 256 }, (_, i) => i));
    const perm = new Int32Array(512);
    const gx = new Float64Array(512);
    const gy = new Float64Array(512);
    const gz = new Float64Array(512);
    for (let i = 0; i < 512; i++) {
      perm[i] = order[i & 255];
      const h = perm[i] & 15;
      gx[i] = GRAD_X[h];
      gy[i] = GRAD_Y[h];
      gz[i] = GRAD_Z[h];
    }
    table = { perm, gx, gy, gz };
    tableCache.set(key, table);
  }
  return table;
}

/**
 * Ruído de gradiente 3D em [-1, 1] (zero nos nós inteiros da rede).
 * @param {{perm:Int32Array, gx:Float64Array, gy:Float64Array, gz:Float64Array}} table de noisePerm()
 */
export function noise3(table, x, y, z) {
  const { perm, gx, gy, gz } = table;
  const fx = Math.floor(x);
  const fy = Math.floor(y);
  const fz = Math.floor(z);
  const X = fx & 255;
  const Y = fy & 255;
  const Z = fz & 255;
  x -= fx;
  y -= fy;
  z -= fz;
  const u = x * x * x * (x * (x * 6 - 15) + 10);
  const v = y * y * y * (y * (y * 6 - 15) + 10);
  const w = z * z * z * (z * (z * 6 - 15) + 10);
  const A = perm[X] + Y;
  const AA = perm[A] + Z;
  const AB = perm[A + 1] + Z;
  const B = perm[X + 1] + Y;
  const BA = perm[B] + Z;
  const BB = perm[B + 1] + Z;
  const x1 = x - 1;
  const y1 = y - 1;
  const z1 = z - 1;
  const g000 = gx[AA] * x + gy[AA] * y + gz[AA] * z;
  const g100 = gx[BA] * x1 + gy[BA] * y + gz[BA] * z;
  const g010 = gx[AB] * x + gy[AB] * y1 + gz[AB] * z;
  const g110 = gx[BB] * x1 + gy[BB] * y1 + gz[BB] * z;
  const g001 = gx[AA + 1] * x + gy[AA + 1] * y + gz[AA + 1] * z1;
  const g101 = gx[BA + 1] * x1 + gy[BA + 1] * y + gz[BA + 1] * z1;
  const g011 = gx[AB + 1] * x + gy[AB + 1] * y1 + gz[AB + 1] * z1;
  const g111 = gx[BB + 1] * x1 + gy[BB + 1] * y1 + gz[BB + 1] * z1;
  const a0 = g000 + u * (g100 - g000);
  const a1 = g010 + u * (g110 - g010);
  const a2 = g001 + u * (g101 - g001);
  const a3 = g011 + u * (g111 - g011);
  const b0 = a0 + v * (a1 - a0);
  const b1 = a2 + v * (a3 - a2);
  const n = b0 + w * (b1 - b0);
  return n > 1 ? 1 : n < -1 ? -1 : n;
}

/**
 * fBm normalizado em [-1, 1]: oitavas com lacunaridade 2 e ganho 0,5; cada oitava gira o domínio por uma rotação
 * ortonormal fixa e desloca a origem (tira o alinhamento da rede e o zero comum na origem).
 * @param {object} table de noisePerm()
 * @param {number} octaves inteiro 1..MAX_OCTAVES
 */
export function fbm3(table, x, y, z, octaves) {
  let sum = noise3(table, x, y, z);
  if (octaves <= 1) return sum;
  let amp = 1;
  let norm = 1;
  for (let o = 1; o < octaves; o++) {
    const nx = (-0.8 * y - 0.6 * z) * 2 + 19.19;
    const ny = (0.8 * x + 0.36 * y - 0.48 * z) * 2 + 7.31;
    const nz = (0.6 * x - 0.48 * y + 0.64 * z) * 2 + 3.77;
    x = nx;
    y = ny;
    z = nz;
    amp *= 0.5;
    norm += amp;
    sum += amp * noise3(table, x, y, z);
  }
  return sum / norm;
}

/**
 * Limite de |∇fbm3| por unidade de frequência: cada oitava contribui ganho^o × lacunaridade^o = 1 vez o limite
 * do noise3 (rotações preservam a norma), dividido pela normalização.
 * @param {number} octaves
 */
export function fbmGradBound(octaves) {
  let norm = 0;
  let amp = 1;
  for (let o = 0; o < octaves; o++) {
    norm += amp;
    amp *= 0.5;
  }
  return (NOISE_GRAD_BOUND * octaves) / norm;
}
