// Marching cubes esparso para árvores SDF compiladas (src/clay/sdf/nodes.js) → malha indexada de massinha.
// JS puro, sem three nem DOM: roda no Worker (sdfWorker.js), na thread principal (fallback) e nos testes.
//
// Etapas:
//  1. Grade: `resolution` células no eixo mais longo da caixa + 1 célula de margem em cada lado; se o total passar
//     de `maxCells`, o passo cresce até caber (a peça nunca é cortada, só fica mais grossa).
//  2. Poda hierárquica (octree implícita de blocos 2ⁿ): cada bloco pede ao campo o intervalo GARANTIDO de d na bola
//     que o envolve (compiled.range). Se o intervalo não contém 0, nenhuma célula do bloco tem superfície e o bloco
//     é pulado sem amostrar. Só blocos de 2³ células colados na superfície amostram a grade (faixa estreita).
//  3. Célula: índice do cubo pelas tabelas clássicas (mcTables.js; bit = canto FORA da massa, d > 0, então os
//     triângulos saem anti-horários vistos de fora = face da frente do three.js). Um vértice por aresta cortada,
//     soldado por chave global de aresta (amostra inicial × 3 + eixo) → malha fechada, sem vértices repetidos.
//     Posição: interpolação linear + 1 passo de regula falsi na própria aresta (mais fiel e sem dobras).
//  4. Vértice: amostra de material (mat, costura), gradiente por diferenças centrais (normal suave do campo, não da
//     face) e laplaciano (curvatura média H → toque = 1 − e^(−H·touchRadius): alto em quinas convexas finas, zero
//     em planos e côncavos — alimenta a intensidade das digitais no ClayMaterial). O toque passa por 2 médias com
//     os vizinhos na malha (tira o serrilhado de quinas estreitas, sem novas amostras do campo).
//  5. Fronteiras de cor cortadas no lugar exato (materialSplit.js: busca binária do material ao longo da aresta)
//     e triângulos agrupados por material (counting sort estável) → grupos contíguos para geometry.addGroup().
//
// Complexidade: O(A + V) avaliações do campo, com A ≈ área da superfície medida em células (faixa de blocos 2³ perto
// dela) e V = vértices (8 avaliações cada: 1 refinamento + 1 material + 6 do gradiente/laplaciano); a poda custa
// O(A·log n) avaliações de intervalo. O volume vazio não é amostrado. Memória: 16 bytes por amostra da grade
// (campo Float32 + mapa de arestas Int32 × 3), reaproveitada entre chamadas (~2,7 MB em 160 mil células).
// Limites: detalhes menores que ~1 célula somem ou viram ilhas; se a superfície encostar na borda da grade (caixa
// apertada demais) a caixa cresce e a peça é refeita (até 3 vezes, stats.retries); campos sem `range` (ou com a
// poda desligada) voltam ao custo denso O(células).

import { edgeTable, triTable } from './mcTables.js';
import { splitMaterialBoundaries } from './materialSplit.js';

export const DEFAULT_RESOLUTION = 64;
export const DEFAULT_MAX_CELLS = 160000;
/** Raio de referência (unidades de mundo) do "toque": curvatura média 1/touchRadius → toque ≈ 0,63. */
export const DEFAULT_TOUCH_RADIUS = 2;

const LEAF_CELLS = 2;
const MAX_RETRIES = 3;
const MIN_T = 1e-4;

// Arestas do cubo: canto inicial (menor coordenada), canto final e eixo (0 = x, 1 = y, 2 = z).
const EDGE_START = new Uint8Array([0, 1, 3, 0, 4, 5, 7, 4, 0, 1, 2, 3]);
const EDGE_END = new Uint8Array([1, 2, 2, 3, 5, 6, 6, 7, 4, 5, 6, 7]);
const EDGE_AXIS = new Uint8Array([0, 1, 0, 1, 0, 1, 0, 1, 2, 2, 2, 2]);
const CORNER_X = new Uint8Array([0, 1, 1, 0, 0, 1, 1, 0]);
const CORNER_Y = new Uint8Array([0, 0, 1, 1, 0, 0, 1, 1]);
const CORNER_Z = new Uint8Array([0, 0, 0, 0, 1, 1, 1, 1]);

const now = () => (globalThis.performance?.now ? globalThis.performance.now() : Date.now());

// Buffers de trabalho reaproveitados (o Worker gera várias peças seguidas).
let fieldBuf = new Float32Array(0);
let edgeBuf = new Int32Array(0);

function isEmptyBox(b) {
  return !(b.min[0] <= b.max[0] && b.min[1] <= b.max[1] && b.min[2] <= b.max[2]);
}

/**
 * Planeja a grade: passo h, células por eixo (com 1 de margem de cada lado) e origem centrada na caixa.
 * @returns {{cx:number, cy:number, cz:number, nx:number, ny:number, nz:number, h:number, ox:number, oy:number, oz:number}}
 */
export function planGrid(box, resolution = DEFAULT_RESOLUTION, maxCells = DEFAULT_MAX_CELLS) {
  const res = Math.max(2, Math.round(resolution));
  const cap = Math.max(27, Math.floor(maxCells));
  const ex = box.max[0] - box.min[0];
  const ey = box.max[1] - box.min[1];
  const ez = box.max[2] - box.min[2];
  let h = Math.max(ex, ey, ez, 1e-6) / res;
  let cx = 0;
  let cy = 0;
  let cz = 0;
  for (let guard = 0; guard < 64; guard++) {
    cx = Math.max(1, Math.ceil(ex / h - 1e-9)) + 2;
    cy = Math.max(1, Math.ceil(ey / h - 1e-9)) + 2;
    cz = Math.max(1, Math.ceil(ez / h - 1e-9)) + 2;
    const cells = cx * cy * cz;
    if (cells <= cap) break;
    h *= Math.max(1.0005, Math.cbrt(cells / cap));
  }
  return {
    cx, cy, cz,
    nx: cx + 1, ny: cy + 1, nz: cz + 1,
    h,
    ox: (box.min[0] + box.max[0]) * 0.5 - cx * h * 0.5,
    oy: (box.min[1] + box.max[1]) * 0.5 - cy * h * 0.5,
    oz: (box.min[2] + box.max[2]) * 0.5 - cz * h * 0.5,
  };
}

// Extrai a superfície de uma grade: posições e índices (ainda na ordem de visita).
function march(sdf, grid, refine, sparse) {
  const { cx, cy, cz, nx, ny, h, ox, oy, oz } = grid;
  const nxy = nx * ny;
  const count = nxy * grid.nz;
  if (fieldBuf.length < count) fieldBuf = new Float32Array(count);
  if (edgeBuf.length < count * 3) edgeBuf = new Int32Array(count * 3);
  const field = fieldBuf;
  const edges = edgeBuf;
  field.fill(NaN, 0, count);
  edges.fill(-1, 0, count * 3);
  const distance = sdf.distance;
  const range = sparse && typeof sdf.range === 'function' ? sdf.range : null;

  let pos = new Float32Array(3 * Math.max(1024, 2 * (nx * ny + ny * grid.nz + nx * grid.nz)));
  let vCount = 0;
  let idx = new Uint32Array(pos.length * 2);
  let iCount = 0;
  let evals = 0;
  let visited = 0;
  let skipped = 0;
  let clipped = false;
  const CI = new Int32Array(8);
  const CV = new Float64Array(8);
  const EV = new Int32Array(12);
  const rg = { lo: 0, hi: 0 };
  const eps = 1e-6 * h;
  let ci = 0;
  let cj = 0;
  let ck = 0;

  const value = (s, i, j, k) => {
    let v = field[s];
    if (v !== v) {
      const x = ox + i * h;
      const y = oy + j * h;
      const z = oz + k * h;
      field[s] = distance(x, y, z);
      v = field[s];
      evals++;
      if (v !== v) throw new Error(`SDF: o campo devolveu NaN em (${x}, ${y}, ${z})`);
      // Massa na borda da grade = superfície cortada pela caixa (caixa apertada demais).
      if (v <= 0 && (i === 0 || j === 0 || k === 0 || i === cx || j === cy || k === cz)) clipped = true;
    }
    return v;
  };

  const edgeVertex = (e) => {
    const sc = EDGE_START[e];
    const axis = EDGE_AXIS[e];
    const key = CI[sc] * 3 + axis;
    const found = edges[key];
    if (found >= 0) return found;
    const va = CV[sc];
    const vb = CV[EDGE_END[e]];
    const x0 = ox + (ci + CORNER_X[sc]) * h;
    const y0 = oy + (cj + CORNER_Y[sc]) * h;
    const z0 = oz + (ck + CORNER_Z[sc]) * h;
    let t = va / (va - vb);
    if (refine) {
      const f = distance(x0 + (axis === 0 ? t * h : 0), y0 + (axis === 1 ? t * h : 0), z0 + (axis === 2 ? t * h : 0));
      evals++;
      if (f !== 0 && f === f) {
        if (f > 0 === va > 0) t += ((1 - t) * f) / (f - vb);
        else t = (t * va) / (va - f);
      }
    }
    // Longe dos cantos: vértices de arestas vizinhas nunca coincidem (sem triângulos degenerados).
    if (!(t >= MIN_T)) t = MIN_T;
    else if (t > 1 - MIN_T) t = 1 - MIN_T;
    if ((vCount + 1) * 3 > pos.length) {
      const grown = new Float32Array(pos.length * 2);
      grown.set(pos);
      pos = grown;
    }
    const o = vCount * 3;
    pos[o] = x0 + (axis === 0 ? t * h : 0);
    pos[o + 1] = y0 + (axis === 1 ? t * h : 0);
    pos[o + 2] = z0 + (axis === 2 ? t * h : 0);
    edges[key] = vCount;
    return vCount++;
  };

  const cell = (i, j, k) => {
    const s0 = i + j * nx + k * nxy;
    CI[0] = s0;
    CI[1] = s0 + 1;
    CI[2] = s0 + 1 + nx;
    CI[3] = s0 + nx;
    CI[4] = s0 + nxy;
    CI[5] = s0 + 1 + nxy;
    CI[6] = s0 + 1 + nx + nxy;
    CI[7] = s0 + nx + nxy;
    let cube = 0;
    for (let c = 0; c < 8; c++) {
      const v = value(CI[c], i + CORNER_X[c], j + CORNER_Y[c], k + CORNER_Z[c]);
      CV[c] = v;
      if (v > 0) cube |= 1 << c;
    }
    const mask = edgeTable[cube];
    if (mask === 0) return;
    ci = i;
    cj = j;
    ck = k;
    for (let e = 0; e < 12; e++) if (mask & (1 << e)) EV[e] = edgeVertex(e);
    for (let t = cube << 4; triTable[t] !== -1; t += 3) {
      if (iCount + 3 > idx.length) {
        const grown = new Uint32Array(idx.length * 2);
        grown.set(idx);
        idx = grown;
      }
      idx[iCount++] = EV[triTable[t]];
      idx[iCount++] = EV[triTable[t + 1]];
      idx[iCount++] = EV[triTable[t + 2]];
    }
  };

  const block = (i0, j0, k0, i1, j1, k1) => {
    for (let k = k0; k < k1; k++) for (let j = j0; j < j1; j++) for (let i = i0; i < i1; i++) cell(i, j, k);
  };

  const visit = (i0, j0, k0, size) => {
    const i1 = i0 + size < cx ? i0 + size : cx;
    const j1 = j0 + size < cy ? j0 + size : cy;
    const k1 = k0 + size < cz ? k0 + size : cz;
    if (i0 >= i1 || j0 >= j1 || k0 >= k1) return;
    const sx = i1 - i0;
    const sy = j1 - j0;
    const sz = k1 - k0;
    // A bola circunscrita contém todas as amostras do bloco fechado (inclusive as da face compartilhada).
    const R = 0.5 * h * Math.sqrt(sx * sx + sy * sy + sz * sz) * (1 + 1e-7);
    range(ox + (i0 + 0.5 * sx) * h, oy + (j0 + 0.5 * sy) * h, oz + (k0 + 0.5 * sz) * h, R, rg);
    visited++;
    if (rg.lo > eps || rg.hi < -eps) {
      skipped++;
      if (rg.hi < -eps && (i0 === 0 || j0 === 0 || k0 === 0 || i1 === cx || j1 === cy || k1 === cz)) clipped = true;
      return;
    }
    if (size <= LEAF_CELLS) {
      block(i0, j0, k0, i1, j1, k1);
      return;
    }
    const half = size >> 1;
    visit(i0, j0, k0, half);
    visit(i0 + half, j0, k0, half);
    visit(i0, j0 + half, k0, half);
    visit(i0 + half, j0 + half, k0, half);
    visit(i0, j0, k0 + half, half);
    visit(i0 + half, j0, k0 + half, half);
    visit(i0, j0 + half, k0 + half, half);
    visit(i0 + half, j0 + half, k0 + half, half);
  };

  if (range) {
    let size = LEAF_CELLS;
    while (size < cx || size < cy || size < cz) size <<= 1;
    visit(0, 0, 0, size);
  } else {
    block(0, 0, 0, cx, cy, cz);
  }
  return { positions: pos.slice(0, vCount * 3), indices: idx.slice(0, iCount), evals, visited, skipped, clipped };
}

// Normais por faces vizinhas (ponderadas pela área) só onde o gradiente do campo zerou (pontos de sela exatos).
function fallbackNormals(positions, indices, normals, flagged) {
  const acc = new Float64Array(normals.length);
  for (let t = 0; t < indices.length; t += 3) {
    const a = indices[t] * 3;
    const b = indices[t + 1] * 3;
    const c = indices[t + 2] * 3;
    if (!flagged[a / 3] && !flagged[b / 3] && !flagged[c / 3]) continue;
    const ux = positions[b] - positions[a];
    const uy = positions[b + 1] - positions[a + 1];
    const uz = positions[b + 2] - positions[a + 2];
    const vx = positions[c] - positions[a];
    const vy = positions[c + 1] - positions[a + 1];
    const vz = positions[c + 2] - positions[a + 2];
    const nx = uy * vz - uz * vy;
    const ny = uz * vx - ux * vz;
    const nz = ux * vy - uy * vx;
    for (const o of [a, b, c]) {
      acc[o] += nx;
      acc[o + 1] += ny;
      acc[o + 2] += nz;
    }
  }
  for (let v = 0; v < flagged.length; v++) {
    if (!flagged[v]) continue;
    const o = v * 3;
    const l = Math.hypot(acc[o], acc[o + 1], acc[o + 2]);
    normals[o] = l > 0 ? acc[o] / l : 0;
    normals[o + 1] = l > 0 ? acc[o + 1] / l : 1;
    normals[o + 2] = l > 0 ? acc[o + 2] / l : 0;
  }
}

// Atributos por vértice a partir do campo: material, costura, normal (gradiente) e toque (curvatura média).
function vertexAttributes(sdf, positions, indices, step, touchRadius) {
  const count = positions.length / 3;
  const normals = new Float32Array(count * 3);
  const mat = new Float32Array(count);
  const seam = new Float32Array(count);
  const touch = new Float32Array(count);
  const distance = sdf.distance;
  const sample = sdf.sample;
  const out = { d: 0, mat: 0, seam: 0 };
  const inv2e = 1 / (2 * step);
  const invE2 = 1 / (step * step);
  let flagged = null;
  for (let v = 0; v < count; v++) {
    const o = v * 3;
    const x = positions[o];
    const y = positions[o + 1];
    const z = positions[o + 2];
    sample(x, y, z, out);
    const xp = distance(x + step, y, z);
    const xm = distance(x - step, y, z);
    const yp = distance(x, y + step, z);
    const ym = distance(x, y - step, z);
    const zp = distance(x, y, z + step);
    const zm = distance(x, y, z - step);
    const gx = (xp - xm) * inv2e;
    const gy = (yp - ym) * inv2e;
    const gz = (zp - zm) * inv2e;
    const gl = Math.sqrt(gx * gx + gy * gy + gz * gz);
    if (gl > 1e-12) {
      normals[o] = gx / gl;
      normals[o + 1] = gy / gl;
      normals[o + 2] = gz / gl;
      // Laplaciano de um SDF = κ1 + κ2 (soma das curvaturas principais); dividir por |∇d| corrige campos
      // esticados (displace, bend, twist).
      const H = ((xp + xm + yp + ym + zp + zm - 6 * out.d) * invE2) / gl;
      touch[v] = H > 0 ? 1 - Math.exp(-H * touchRadius) : 0;
    } else {
      flagged ??= new Uint8Array(count);
      flagged[v] = 1;
    }
    mat[v] = out.mat;
    seam[v] = out.seam;
  }
  if (flagged) fallbackNormals(positions, indices, normals, flagged);
  return { normals, mat, seam, touch, evals: count * 7 };
}

/**
 * Suaviza um atributo escalar por vértice na própria malha (média com os vizinhos de aresta, `iterations` vezes,
 * peso `lambda`). Tira o serrilhado de sinais estreitos (curvatura de quinas de ~1 célula) sem novas amostras.
 * @param {Uint32Array} indices
 * @param {Float32Array} values alterado no lugar
 */
export function smoothVertexScalar(indices, values, iterations = 2, lambda = 0.5) {
  const count = values.length;
  if (iterations <= 0 || count === 0) return values;
  const sum = new Float64Array(count);
  const deg = new Uint32Array(count);
  for (let it = 0; it < iterations; it++) {
    sum.fill(0);
    deg.fill(0);
    // Cada aresta interna aparece em dois triângulos: todo vizinho pesa igual (conta dobrada para todos).
    for (let t = 0; t < indices.length; t += 3) {
      const a = indices[t];
      const b = indices[t + 1];
      const c = indices[t + 2];
      sum[a] += values[b] + values[c];
      sum[b] += values[a] + values[c];
      sum[c] += values[a] + values[b];
      deg[a] += 2;
      deg[b] += 2;
      deg[c] += 2;
    }
    for (let v = 0; v < count; v++) {
      if (deg[v] > 0) values[v] += lambda * (sum[v] / deg[v] - values[v]);
    }
  }
  return values;
}

/**
 * Reordena os triângulos por material com counting sort estável. O material de cada triângulo vem de `triangleMat`
 * (fronteiras já cortadas) ou, sem ele, da maioria dos 3 vértices (empate total → menor id).
 * @param {Uint32Array} indices
 * @param {Float32Array} mat material por vértice (inteiros 0..255)
 * @param {Uint8Array} [triangleMat] material por triângulo
 * @returns {{indices:Uint32Array, groups:{start:number, count:number, materialIndex:number}[]}} start/count em índices
 */
export function sortTrianglesByMaterial(indices, mat, triangleMat) {
  const triangles = (indices.length / 3) | 0;
  const triMat = new Uint8Array(triangles);
  const counts = new Uint32Array(256);
  for (let t = 0; t < triangles; t++) {
    if (triangleMat) {
      triMat[t] = triangleMat[t];
    } else {
      const a = mat[indices[t * 3]];
      const b = mat[indices[t * 3 + 1]];
      const c = mat[indices[t * 3 + 2]];
      triMat[t] = a === b || a === c ? a : b === c ? b : Math.min(a, b, c);
    }
    counts[triMat[t]]++;
  }
  const offsets = new Uint32Array(256);
  const groups = [];
  let acc = 0;
  for (let m = 0; m < 256; m++) {
    offsets[m] = acc;
    if (counts[m] > 0) groups.push({ start: acc * 3, count: counts[m] * 3, materialIndex: m });
    acc += counts[m];
  }
  const sorted = new Uint32Array(triangles * 3);
  for (let t = 0; t < triangles; t++) {
    const dst = offsets[triMat[t]]++ * 3;
    sorted[dst] = indices[t * 3];
    sorted[dst + 1] = indices[t * 3 + 1];
    sorted[dst + 2] = indices[t * 3 + 2];
  }
  return { indices: sorted, groups };
}

function emptyMesh(t0) {
  return {
    positions: new Float32Array(0),
    normals: new Float32Array(0),
    indices: new Uint32Array(0),
    mat: new Float32Array(0),
    seam: new Float32Array(0),
    touch: new Float32Array(0),
    groups: [],
    stats: {
      cells: 0, grid: [0, 0, 0], cellSize: 0, vertices: 0, triangles: 0, boundarySplits: 0, samples: 0, blocks: 0,
      blocksSkipped: 0, retries: 0, clipped: false, ms: now() - t0,
    },
  };
}

/**
 * Poligoniza um campo SDF compilado dentro de uma caixa.
 * @param {{distance:Function, sample:Function, range?:Function}} sdf resultado de compile(node)
 * @param {{min:number[], max:number[]}} box caixa que contém a superfície (bounds(node))
 * @param {{resolution?:number, maxCells?:number, touchRadius?:number, sparse?:boolean, refine?:boolean,
 *          gradientStep?:number, touchSmoothing?:number}} [options] gradientStep em células (passo das diferenças
 *          centrais); touchSmoothing = passadas de média do toque na malha
 * @returns {{positions:Float32Array, normals:Float32Array, indices:Uint32Array, mat:Float32Array,
 *            seam:Float32Array, touch:Float32Array, groups:{start:number,count:number,materialIndex:number}[],
 *            stats:{cells:number, vertices:number, triangles:number, boundarySplits:number, ms:number,
 *                   grid:number[], cellSize:number, samples:number, blocks:number, blocksSkipped:number,
 *                   retries:number, clipped:boolean}}}
 */
export function polygonize(sdf, box, options = {}) {
  const t0 = now();
  if (!sdf || typeof sdf.distance !== 'function' || typeof sdf.sample !== 'function') {
    throw new TypeError('polygonize: esperado o resultado de compile(node) ({distance, sample, range})');
  }
  const {
    resolution = DEFAULT_RESOLUTION,
    maxCells = DEFAULT_MAX_CELLS,
    touchRadius = DEFAULT_TOUCH_RADIUS,
    sparse = true,
    refine = true,
    gradientStep = 0.5,
    touchSmoothing = 2,
  } = options;
  if (!box || isEmptyBox(box)) return emptyMesh(t0);
  let current = { min: [...box.min], max: [...box.max] };
  let grid;
  let result;
  let retries = 0;
  let evals = 0;
  for (;;) {
    grid = planGrid(current, resolution, maxCells);
    result = march(sdf, grid, refine, sparse);
    evals += result.evals;
    if (!result.clipped || retries >= MAX_RETRIES) break;
    // A superfície encostou na borda: caixa apertada demais (campo aproximado ou caixa manual) → cresce e refaz.
    const grow = 0.25 * Math.max(current.max[0] - current.min[0], current.max[1] - current.min[1], current.max[2] - current.min[2]) + 2 * grid.h;
    current = { min: current.min.map((v) => v - grow), max: current.max.map((v) => v + grow) };
    retries++;
  }
  const attrs = vertexAttributes(sdf, result.positions, result.indices, Math.max(1e-6, gradientStep) * grid.h, touchRadius);
  smoothVertexScalar(result.indices, attrs.touch, touchSmoothing);
  const cut = splitMaterialBoundaries({ positions: result.positions, indices: result.indices, ...attrs }, sdf.sample);
  const sorted = sortTrianglesByMaterial(cut.indices, cut.mat, cut.triMat);
  return {
    positions: cut.positions,
    normals: cut.normals,
    indices: sorted.indices,
    mat: cut.mat,
    seam: cut.seam,
    touch: cut.touch,
    groups: sorted.groups,
    stats: {
      cells: grid.cx * grid.cy * grid.cz,
      grid: [grid.nx, grid.ny, grid.nz],
      cellSize: grid.h,
      vertices: cut.positions.length / 3,
      triangles: sorted.indices.length / 3,
      boundarySplits: cut.split,
      samples: evals + attrs.evals + cut.evals,
      blocks: result.visited,
      blocksSkipped: result.skipped,
      retries,
      clipped: result.clipped,
      ms: now() - t0,
    },
  };
}
