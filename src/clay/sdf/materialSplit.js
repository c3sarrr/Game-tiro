// Corte exato das fronteiras de cor na malha do marching cubes (src/clay/sdf/marchingCubes.js).
// Sem isto o material é decidido por triângulo inteiro (maioria dos 3 vértices) e a fronteira entre duas massas
// segue a grade: um serrilhado de uma célula que aparece de perto (rocambole, olho na cabeça, duas massas
// apertadas). Em cada aresta cujos vértices têm materiais diferentes, o ponto onde o material do campo
// (sample().mat, o do filho mais próximo) troca é achado por busca binária na própria aresta (1/1024 dela) — vale
// para qualquer número de massas. Cada triângulo de duas cores vira um triângulo de uma cor e um quadrilátero (dois
// triângulos) da outra, com o vértice novo da aresta compartilhado pelos dois triângulos vizinhos: a malha continua
// fechada, orientada e sem vértices repetidos. Triângulo de três cores (junção tripla): as três arestas são
// cortadas e um vértice no meio dos três cortes fecha as três regiões — sem junção em T com os vizinhos.

// Margem mínima do corte ao longo da aresta: evita triângulos degenerados quando a fronteira passa rente a um
// vértice (erro de posição ≤ 2% da aresta).
const T_MIN = 0.02;
// Passos da busca binária do corte (2⁻¹⁰ da aresta).
const BISECT_STEPS = 10;

/**
 * Corta os triângulos de duas ou três cores pela fronteira exata e devolve o material de cada triângulo.
 * @param {{positions:Float32Array, normals:Float32Array, indices:Uint32Array, mat:Float32Array, seam:Float32Array,
 *          touch:Float32Array}} mesh atributos por vértice
 * @param {(x:number, y:number, z:number, out:object) => void} sample amostra do campo (material e costura)
 * @returns {{positions:Float32Array, normals:Float32Array, indices:Uint32Array, mat:Float32Array,
 *            seam:Float32Array, touch:Float32Array, triMat:Uint8Array, split:number, evals:number}}
 */
export function splitMaterialBoundaries(mesh, sample) {
  const { positions, normals, indices, mat, seam, touch } = mesh;
  const baseCount = positions.length / 3;
  const triCount = (indices.length / 3) | 0;
  // Vértices novos (listas que crescem; viram typed arrays no fim).
  const extraPos = [];
  const extraNrm = [];
  const extraMat = [];
  const extraSeam = [];
  const extraTouch = [];
  const edgeVertex = new Map();
  const out = { d: 0, mat: 0, seam: 0 };
  let evals = 0;
  const attr = (arr, extra, v, k) => (v < baseCount ? arr[v * 3 + k] : extra[(v - baseCount) * 3 + k]);

  const vertexOnEdge = (i, j) => {
    const key = i < j ? i * baseCount + j : j * baseCount + i;
    const found = edgeVertex.get(key);
    if (found !== undefined) return found;
    // Busca binária sempre partindo do vértice de menor índice: o mesmo corte venha de qual triângulo vier.
    const u = i < j ? i : j;
    const w = i < j ? j : i;
    const ux = positions[u * 3];
    const uy = positions[u * 3 + 1];
    const uz = positions[u * 3 + 2];
    const ex = positions[w * 3] - ux;
    const ey = positions[w * 3 + 1] - uy;
    const ez = positions[w * 3 + 2] - uz;
    let tu = switchAlong(ux, uy, uz, ex, ey, ez, mat[u]) - 0.5 ** (BISECT_STEPS + 1);
    tu = tu < T_MIN ? T_MIN : tu > 1 - T_MIN ? 1 - T_MIN : tu;
    const t = u === i ? tu : 1 - tu; // parâmetro medido a partir de i
    const x = ux + ex * tu;
    const y = uy + ey * tu;
    const z = uz + ez * tu;
    let nx = normals[i * 3] + (normals[j * 3] - normals[i * 3]) * t;
    let ny = normals[i * 3 + 1] + (normals[j * 3 + 1] - normals[i * 3 + 1]) * t;
    let nz = normals[i * 3 + 2] + (normals[j * 3 + 2] - normals[i * 3 + 2]) * t;
    const nl = Math.hypot(nx, ny, nz);
    if (nl > 1e-12) {
      nx /= nl;
      ny /= nl;
      nz /= nl;
    } else {
      nx = normals[i * 3];
      ny = normals[i * 3 + 1];
      nz = normals[i * 3 + 2];
    }
    sample(x, y, z, out);
    evals++;
    extraPos.push(x, y, z);
    extraNrm.push(nx, ny, nz);
    extraMat.push(Math.min(mat[i], mat[j]));
    extraSeam.push(out.seam);
    extraTouch.push(touch[i] + (touch[j] - touch[i]) * t);
    const v = baseCount + extraMat.length - 1;
    edgeVertex.set(key, v);
    return v;
  };

  // Ponto da troca de material no segmento (sx..sx+e), a partir do material `m0` na origem: busca binária.
  const switchAlong = (sx, sy, sz, ex, ey, ez, m0) => {
    let lo = 0;
    let hi = 1;
    for (let k = 0; k < BISECT_STEPS; k++) {
      const mid = (lo + hi) * 0.5;
      sample(sx + ex * mid, sy + ey * mid, sz + ez * mid, out);
      if (out.mat === m0) lo = mid;
      else hi = mid;
    }
    evals += BISECT_STEPS;
    return hi;
  };

  // Vértice da junção tripla, no plano do triângulo: parte da média dos três cortes e anda por projeções
  // alternadas — do ponto atual (na região da massa m) até a troca de material no caminho para o corte das OUTRAS
  // duas massas; cada passo cai numa fronteira mais perto do encontro das três.
  const centerVertex = (p, q, r, cuts) => {
    const at = (list, v, k) => list[(v - baseCount) * 3 + k];
    const avg = (list, k) => (at(list, p, k) + at(list, q, k) + at(list, r, k)) / 3;
    let x = avg(extraPos, 0);
    let y = avg(extraPos, 1);
    let z = avg(extraPos, 2);
    for (let round = 0; round < 4; round++) {
      sample(x, y, z, out);
      evals++;
      const target = cuts.find((c) => c.m !== out.mat && c.n !== out.mat);
      if (!target) break;
      const tx = at(extraPos, target.v, 0) - x;
      const ty = at(extraPos, target.v, 1) - y;
      const tz = at(extraPos, target.v, 2) - z;
      const f = switchAlong(x, y, z, tx, ty, tz, out.mat);
      x += tx * f;
      y += ty * f;
      z += tz * f;
    }
    let nx = avg(extraNrm, 0);
    let ny = avg(extraNrm, 1);
    let nz = avg(extraNrm, 2);
    const nl = Math.hypot(nx, ny, nz) || 1;
    nx /= nl;
    ny /= nl;
    nz /= nl;
    sample(x, y, z, out);
    evals++;
    extraPos.push(x, y, z);
    extraNrm.push(nx, ny, nz);
    extraMat.push(Math.min(extraMat[p - baseCount], extraMat[q - baseCount], extraMat[r - baseCount]));
    extraSeam.push(out.seam);
    extraTouch.push((extraTouch[p - baseCount] + extraTouch[q - baseCount] + extraTouch[r - baseCount]) / 3);
    return baseCount + extraMat.length - 1;
  };

  const dist2 = (u, v) => {
    const dx = attr(positions, extraPos, u, 0) - attr(positions, extraPos, v, 0);
    const dy = attr(positions, extraPos, u, 1) - attr(positions, extraPos, v, 1);
    const dz = attr(positions, extraPos, u, 2) - attr(positions, extraPos, v, 2);
    return dx * dx + dy * dy + dz * dz;
  };

  const outIdx = [];
  const outMat = [];
  let split = 0;
  for (let tri = 0; tri < triCount; tri++) {
    const a = indices[tri * 3];
    const b = indices[tri * 3 + 1];
    const c = indices[tri * 3 + 2];
    const ma = mat[a];
    const mb = mat[b];
    const mc = mat[c];
    if (ma === mb && mb === mc) {
      outIdx.push(a, b, c);
      outMat.push(ma);
      continue;
    }
    if (ma !== mb && mb !== mc && ma !== mc) {
      // Junção tripla: polígonos a → Pab → O → Pca, b → Pbc → O → Pab, c → Pca → O → Pbc (anti-horários).
      const pab = vertexOnEdge(a, b);
      const pbc = vertexOnEdge(b, c);
      const pca = vertexOnEdge(c, a);
      const o = centerVertex(pab, pbc, pca, [{ v: pab, m: ma, n: mb }, { v: pbc, m: mb, n: mc }, { v: pca, m: mc, n: ma }]);
      outIdx.push(a, pab, o, a, o, pca);
      outIdx.push(b, pbc, o, b, o, pab);
      outIdx.push(c, pca, o, c, o, pbc);
      outMat.push(ma, ma, mb, mb, mc, mc);
      split++;
      continue;
    }
    // Vértice solitário primeiro, mantendo a ordem cíclica (anti-horária vista de fora).
    let L;
    let M;
    let N;
    if (mb === mc) [L, M, N] = [a, b, c];
    else if (ma === mc) [L, M, N] = [b, c, a];
    else [L, M, N] = [c, a, b];
    const P = vertexOnEdge(L, M);
    const Q = vertexOnEdge(L, N);
    outIdx.push(L, P, Q);
    outMat.push(mat[L]);
    // Quadrilátero P → M → N → Q: fica a diagonal mais curta.
    if (dist2(P, N) <= dist2(M, Q)) outIdx.push(P, M, N, P, N, Q);
    else outIdx.push(P, M, Q, M, N, Q);
    outMat.push(mat[M], mat[M]);
    split++;
  }

  const total = baseCount + extraMat.length;
  const P3 = new Float32Array(total * 3);
  const N3 = new Float32Array(total * 3);
  const matOut = new Float32Array(total);
  const seamOut = new Float32Array(total);
  const touchOut = new Float32Array(total);
  P3.set(positions);
  P3.set(extraPos, baseCount * 3);
  N3.set(normals);
  N3.set(extraNrm, baseCount * 3);
  matOut.set(mat);
  matOut.set(extraMat, baseCount);
  seamOut.set(seam);
  seamOut.set(extraSeam, baseCount);
  touchOut.set(touch);
  touchOut.set(extraTouch, baseCount);
  return {
    positions: P3,
    normals: N3,
    indices: Uint32Array.from(outIdx),
    mat: matOut,
    seam: seamOut,
    touch: touchOut,
    triMat: Uint8Array.from(outMat),
    split,
    evals,
  };
}
