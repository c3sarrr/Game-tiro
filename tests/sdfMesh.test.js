// Testes das malhas do kit SDF (src/clay/sdf): marching cubes (estanque, orientação CCW vista de fora, normais
// para fora, gênero), fronteiras de material cortadas no lugar exato (duas e três massas), tabelas, e o SdfMesher
// no Node (sem Worker → thread principal; Store em memória; Workers falsos para o pool). Nada de navegador nem WebGL.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { bounds, compile, hashNode } from '../src/clay/sdf/nodes.js';
import { polygonize, sortTrianglesByMaterial } from '../src/clay/sdf/marchingCubes.js';
import { edgeTable, triTable } from '../src/clay/sdf/mcTables.js';
import { SDF_CACHE_VERSION, SdfMesher, isMeshData } from '../src/clay/sdf/sdfMesher.js';
import { Store } from '../src/core/store.js';
import { meshReport } from './sdfTestUtils.js';

const near = (actual, expected, eps = 1e-9, msg = '') => assert.ok(Math.abs(actual - expected) <= eps, `${msg} esperado ${expected}, veio ${actual}`);

test('marching cubes: esfera estanque, CCW vista de fora, normais para fora, vértices no raio', () => {
  const tree = { type: 'sphere', r: 10 };
  const mesh = polygonize(compile(tree), bounds(tree), { resolution: 48 });
  const rep = meshReport(mesh);
  assert.ok(rep.V > 1000, `vértices: ${rep.V}`);
  assert.equal(rep.open, 0, 'toda aresta em exatamente dois triângulos, com orientações opostas');
  assert.equal(rep.chi, 2, 'esfera: V − A + F = 2');
  assert.equal(rep.badWinding, 0, 'enrolamento anti-horário concorda com a normal do gradiente');
  const h = mesh.stats.cellSize;
  const P = mesh.positions;
  const N = mesh.normals;
  for (let i = 0; i < P.length; i += 3) {
    const r = Math.hypot(P[i], P[i + 1], P[i + 2]);
    assert.ok(Math.abs(r - 10) < 0.05 * h, `vértice fora do raio: ${r}`);
    const dot = (N[i] * P[i] + N[i + 1] * P[i + 1] + N[i + 2] * P[i + 2]) / r;
    assert.ok(dot > 0.999, `normal não aponta para fora: ${dot}`);
    near(Math.hypot(N[i], N[i + 1], N[i + 2]), 1, 1e-5);
  }
  assert.equal(mesh.stats.vertices, rep.V);
  assert.equal(mesh.stats.triangles, rep.F);
  assert.deepEqual(mesh.groups, [{ start: 0, count: mesh.indices.length, materialIndex: 0 }]);
  // Toque: esfera convexa de raio 10 → H = 2/10 → 1 − e^(−0,4) com o raio de toque padrão (2).
  const expected = 1 - Math.exp(-0.2 * 2);
  for (const t of mesh.touch) near(t, expected, 0.02);
});

test('marching cubes: união suave estanque, toro com gênero 1, poda igual à grade densa', () => {
  const blob = { type: 'smoothUnion', k: 3, children: [{ type: 'sphere', r: 6, pos: [-4, 0, 0] }, { type: 'sphere', r: 5, pos: [5, 1, 0] }] };
  const sdf = compile(blob);
  const sparse = polygonize(sdf, bounds(blob), { resolution: 40 });
  const rep = meshReport(sparse);
  assert.equal(rep.open, 0);
  assert.equal(rep.chi, 2);
  assert.equal(rep.badWinding, 0);
  const dense = polygonize(sdf, bounds(blob), { resolution: 40, sparse: false });
  assert.equal(dense.stats.vertices, sparse.stats.vertices);
  assert.equal(dense.stats.triangles, sparse.stats.triangles);
  const key = (m) => {
    const out = [];
    for (let i = 0; i < m.positions.length; i += 3) out.push(`${m.positions[i]},${m.positions[i + 1]},${m.positions[i + 2]}`);
    return out.sort().join(';');
  };
  assert.equal(key(sparse), key(dense), 'mesmos vértices com e sem poda');
  assert.ok(sparse.stats.samples < dense.stats.samples * 0.8, 'a poda economiza avaliações');
  const torus = { type: 'torus', R: 8, r: 2.5, rot: [0.5, 0, 0.3] };
  const t = meshReport(polygonize(compile(torus), bounds(torus), { resolution: 40 }));
  assert.equal(t.open, 0);
  assert.equal(t.chi, 0, 'toro: V − A + F = 0');
  assert.equal(t.badWinding, 0);
});

test('duas massas de materiais diferentes: fronteira cortada no lugar exato, costura nela, grupos contíguos', () => {
  const tree = { type: 'smoothUnion', k: 1, seamWidth: 1.5, children: [
    { type: 'sphere', r: 6, pos: [-4, 0, 0], mat: 0 },
    { type: 'sphere', r: 6, pos: [4, 0, 0], mat: 1 },
  ] };
  const mesh = polygonize(compile(tree), bounds(tree), { resolution: 48 });
  const P = mesh.positions;
  let nearCount = 0;
  let farCount = 0;
  for (let v = 0; v < P.length / 3; v++) {
    const x = P[v * 3];
    if (Math.abs(x) < 0.2) {
      nearCount++;
      assert.ok(mesh.seam[v] > 0.5, `costura fraca perto do plano: ${mesh.seam[v]} em x = ${x}`);
    } else if (Math.abs(x) > 3) {
      farCount++;
      assert.ok(mesh.seam[v] < 0.2, `costura longe do plano: ${mesh.seam[v]} em x = ${x}`);
    }
    if (x < -0.5) assert.equal(mesh.mat[v], 0);
    if (x > 0.5) assert.equal(mesh.mat[v], 1);
  }
  assert.ok(nearCount > 10 && farCount > 100);
  assert.equal(mesh.groups.length, 2);
  assert.deepEqual(mesh.groups.map((g) => g.materialIndex), [0, 1]);
  assert.equal(mesh.groups[0].start, 0);
  assert.equal(mesh.groups[1].start, mesh.groups[0].count);
  assert.equal(mesh.groups[0].count + mesh.groups[1].count, mesh.indices.length);
  // Fronteira exata: as duas esferas iguais dividem as cores no plano x = 0. Cada triângulo fica inteiro do seu
  // lado — só os vértices do corte encostam no plano (erro de interpolação linear, bem abaixo de uma célula).
  const tol = 0.05 * mesh.stats.cellSize;
  let onPlane = 0;
  for (const g of mesh.groups) {
    const side = g.materialIndex === 0 ? -1 : 1;
    for (let i = g.start; i < g.start + g.count; i++) {
      const x = P[mesh.indices[i] * 3];
      assert.ok(x * side >= -tol, `triângulo do material ${g.materialIndex} passa do plano: x = ${x}`);
      if (Math.abs(x) <= tol) onPlane++;
    }
  }
  assert.ok(onPlane > 20, 'a fronteira tem vértices de corte');
  assert.ok(mesh.stats.boundarySplits > 10);
  const rep = meshReport(mesh);
  assert.equal(rep.open, 0, 'o corte não abre a malha');
  assert.equal(rep.badWinding, 0, 'o corte mantém a orientação');
  const sorted = sortTrianglesByMaterial(new Uint32Array([0, 1, 2, 1, 2, 3]), new Float32Array([2, 2, 5, 5]));
  assert.deepEqual(Array.from(sorted.indices), [0, 1, 2, 1, 2, 3]);
  assert.deepEqual(sorted.groups, [{ start: 0, count: 3, materialIndex: 2 }, { start: 3, count: 3, materialIndex: 5 }]);
  const byTri = sortTrianglesByMaterial(new Uint32Array([0, 1, 2, 1, 2, 3]), new Float32Array([2, 2, 5, 5]), new Uint8Array([7, 3]));
  assert.deepEqual(Array.from(byTri.indices), [1, 2, 3, 0, 1, 2]);
  assert.deepEqual(byTri.groups, [{ start: 0, count: 3, materialIndex: 3 }, { start: 3, count: 3, materialIndex: 7 }]);
});

test('três massas numa junção: cortes nas três fronteiras, malha fechada e orientada', () => {
  const tree = { type: 'union', seamWidth: 1, children: [
    { type: 'sphere', r: 6, pos: [-3.5, -2, 0], mat: 0 },
    { type: 'sphere', r: 6, pos: [3.5, -2, 0], mat: 1 },
    { type: 'sphere', r: 6, pos: [0, 4, 0], mat: 2 },
  ] };
  const mesh = polygonize(compile(tree), bounds(tree), { resolution: 56 });
  const rep = meshReport(mesh);
  assert.equal(rep.open, 0);
  assert.equal(rep.badWinding, 0);
  assert.equal(rep.chi, 2);
  assert.deepEqual(mesh.groups.map((g) => g.materialIndex), [0, 1, 2]);
  // Cada triângulo fica na região de Voronoi do seu centro (a fronteira da união dura é a de Voronoi).
  const C = [[-3.5, -2, 0], [3.5, -2, 0], [0, 4, 0]];
  const tol = 0.05 * mesh.stats.cellSize;
  for (const g of mesh.groups) {
    for (let i = g.start; i < g.start + g.count; i++) {
      const o = mesh.indices[i] * 3;
      const p = [mesh.positions[o], mesh.positions[o + 1], mesh.positions[o + 2]];
      const dm = Math.hypot(p[0] - C[g.materialIndex][0], p[1] - C[g.materialIndex][1], p[2] - C[g.materialIndex][2]);
      for (let m = 0; m < 3; m++) {
        const d = Math.hypot(p[0] - C[m][0], p[1] - C[m][1], p[2] - C[m][2]);
        assert.ok(dm <= d + tol, `vértice do material ${g.materialIndex} mais perto do centro ${m}`);
      }
    }
  }
});

test('caixa apertada demais cresce e refaz; árvore vazia dá malha vazia; tabelas coerentes', () => {
  const tree = { type: 'sphere', r: 5 };
  const mesh = polygonize(compile(tree), { min: [-3, -3, -3], max: [3, 3, 3] }, { resolution: 24 });
  assert.ok(mesh.stats.retries >= 1);
  assert.equal(mesh.stats.clipped, false);
  assert.equal(meshReport(mesh).open, 0);
  const empty = { type: 'intersect', a: { type: 'sphere', r: 1 }, b: { type: 'sphere', r: 1, pos: [5, 0, 0] } };
  const none = polygonize(compile(empty), bounds(empty));
  assert.equal(none.positions.length, 0);
  assert.equal(none.indices.length, 0);
  assert.equal(edgeTable.length, 256);
  assert.equal(triTable.length, 4096);
  assert.equal(edgeTable[0], 0);
  assert.equal(edgeTable[255], 0);
});

test('SdfMesher (thread principal no Node): geometria, grupos, deduplicação, LRU e cache persistente', async () => {
  const store = await Store.open({ indexedDB: null });
  const tree = { type: 'smoothUnion', k: 1, children: [
    { type: 'sphere', r: 5, pos: [-3, 0, 0] },
    { type: 'sphere', r: 4, pos: [3, 0, 0], mat: 1 },
  ] };
  const mesher = new SdfMesher({ store, workers: 0 });
  assert.equal(mesher.workerCount, 0);
  const [g1, g2] = await Promise.all([mesher.build(tree, { resolution: 32 }), mesher.build(tree, { resolution: 32 })]);
  assert.equal(mesher.stats.localBuilds, 1, 'pedidos iguais simultâneos geram uma vez só');
  assert.equal(mesher.stats.sharedHits, 1);
  assert.ok(g1 instanceof THREE.BufferGeometry && g1 !== g2);
  for (const [name, size] of [['position', 3], ['normal', 3], ['aMat', 1], ['aSeam', 1], ['aTouch', 1]]) {
    assert.equal(g1.getAttribute(name).itemSize, size, name);
  }
  assert.ok(g1.index.array instanceof Uint16Array, 'índice de 16 bits quando cabe');
  assert.deepEqual(g1.groups.map((g) => g.materialIndex), [0, 1]);
  assert.equal(g1.groups.reduce((n, g) => n + g.count, 0), g1.index.count);
  assert.ok(g1.boundingSphere.radius > 5 && g1.boundingSphere.radius < 9);
  g1.getAttribute('position').array[0] = 999; // cada geometria tem cópia própria
  assert.notEqual(g2.getAttribute('position').array[0], 999);
  const g3 = await mesher.build(tree, { resolution: 32 });
  assert.equal(mesher.stats.memoryHits, 1);
  assert.deepEqual(g3.getAttribute('normal').array, g2.getAttribute('normal').array);
  const key = mesher.keyFor(tree, { resolution: 32 });
  assert.equal(key, `sdf:${hashNode(tree, `32:160000:${SDF_CACHE_VERSION}`)}`);
  await new Promise((resolve) => setTimeout(resolve, 20)); // gravação no IndexedDB é assíncrona
  const stored = await store.get('cache', key);
  assert.ok(isMeshData(stored, true), 'entrada persistente com os arrays tipados');
  await mesher.dispose();
  await assert.rejects(() => mesher.build(tree), /descartado/);
  const again = new SdfMesher({ store, workers: 0 });
  const g4 = await again.build(tree, { resolution: 32 });
  assert.equal(again.stats.storeHits, 1);
  assert.equal(again.stats.localBuilds, 0);
  assert.deepEqual(g4.getAttribute('position').array, g2.getAttribute('position').array);
  assert.equal(g4.userData.sdf.stats.source, 'store');
  await assert.rejects(() => again.build({ type: 'nada' }), /desconhecido/);
  assert.equal(await again.clearCache({ persistent: true }) >= 1, true);
  await again.dispose();
});

test('sdfWorker: responde com os 6 buffers transferidos, ou com {id, error} para árvore inválida', async () => {
  const posted = [];
  const listeners = {};
  globalThis.self = {
    addEventListener: (type, fn) => { listeners[type] = fn; },
    postMessage: (msg, transfer = []) => posted.push({ msg, transfer }),
  };
  try {
    await import('../src/clay/sdf/sdfWorker.js');
    listeners.message({ data: { id: 7, tree: { type: 'sphere', r: 4, mat: 3 }, resolution: 24, maxCells: 160000 } });
    listeners.message({ data: { id: 8, tree: { type: 'nada' }, resolution: 24, maxCells: 160000 } });
    listeners.messageerror({});
  } finally {
    delete globalThis.self;
  }
  const [ok, bad, unreadable] = posted;
  assert.equal(ok.msg.id, 7);
  assert.ok(isMeshData(ok.msg, true), 'mesmo formato que o SdfMesher valida');
  assert.deepEqual(ok.msg.groups, [{ start: 0, count: ok.msg.indices.length, materialIndex: 3 }]);
  assert.ok(ok.msg.stats.triangles > 0 && ok.msg.stats.ms >= 0);
  const buffers = ['positions', 'normals', 'indices', 'mat', 'seam', 'touch'].map((k) => ok.msg[k].buffer);
  assert.equal(new Set(ok.transfer).size, 6);
  for (const b of buffers) assert.ok(ok.transfer.includes(b), 'buffer transferido, sem cópia');
  assert.equal(bad.msg.id, 8);
  assert.match(bad.msg.error, /desconhecido/);
  assert.equal(bad.transfer.length, 0);
  assert.equal(unreadable.msg.id, null);
  assert.match(unreadable.msg.error, /não pôde ser lida/);
});

test('SdfMesher: cache persistente limitado por LRU próprio e limpeza completa', async () => {
  const store = await Store.open({ indexedDB: null });
  const mesher = new SdfMesher({ store, workers: 0, storeEntries: 2 });
  const trees = [3, 4, 5].map((r) => ({ type: 'sphere', r }));
  for (const t of trees) await mesher.build(t, { resolution: 16 });
  await new Promise((resolve) => setTimeout(resolve, 20));
  await mesher.dispose();
  const meshKeys = async () => (await store.keys('cache')).filter((k) => k.startsWith('sdf:') && k !== 'sdf:index').sort();
  const kept = await meshKeys();
  assert.equal(kept.length, 2);
  assert.ok(!kept.includes(mesher.keyFor(trees[0], { resolution: 16 })), 'a entrada mais antiga saiu');
  const index = await store.get('cache', 'sdf:index');
  assert.deepEqual(index.entries.map(([k]) => k).sort(), kept, 'índice gravado no dispose');
  const other = new SdfMesher({ store, workers: 0 });
  assert.equal(await other.clearCache({ persistent: true }), 3, 'duas malhas + índice');
  await other.dispose();
  assert.deepEqual(await store.keys('cache'), [], 'nada de sdf:* sobrando (índice vazio não é regravado)');
});

// Workers falsos (o Node não tem Worker de módulo): um que falha ao carregar e um que responde como o sdfWorker.
class FailingWorker extends EventTarget {
  constructor() {
    super();
    setTimeout(() => this.dispatchEvent(Object.assign(new Event('error'), { message: 'módulo não carregou' })), 0);
  }
  postMessage() {}
  terminate() {}
}

class InProcessWorker extends EventTarget {
  static created = 0;
  static jobsPerWorker = [];
  constructor(url, options) {
    super();
    assert.equal(options.type, 'module');
    assert.ok(String(url).endsWith('/sdfWorker.js'));
    this.n = InProcessWorker.created++;
    InProcessWorker.jobsPerWorker[this.n] = 0;
  }
  postMessage(msg) {
    InProcessWorker.jobsPerWorker[this.n]++;
    setTimeout(() => {
      const mesh = polygonize(compile(msg.tree), bounds(msg.tree), msg);
      this.dispatchEvent(Object.assign(new Event('message'), { data: { id: msg.id, ...mesh } }));
    }, 5);
  }
  terminate() {}
}

test('SdfMesher: pool distribui pedidos entre Workers e cai para a thread principal se o Worker não carrega', async () => {
  const original = globalThis.Worker;
  try {
    globalThis.Worker = InProcessWorker;
    const pool = new SdfMesher({ workers: 2 });
    const trees = [2, 3, 4, 5].map((r) => ({ type: 'sphere', r }));
    const geos = await Promise.all(trees.map((t) => pool.build(t, { resolution: 12 })));
    assert.equal(pool.stats.workerBuilds, 4);
    assert.equal(InProcessWorker.created, 2, 'Workers criados sob demanda, um por vaga');
    assert.deepEqual(InProcessWorker.jobsPerWorker, [2, 2], 'dois pedidos por Worker');
    assert.ok(geos.every((g) => g.userData.sdf.stats.thread === 'worker' && g.index.count > 0));
    await pool.dispose();

    globalThis.Worker = FailingWorker;
    const broken = new SdfMesher({ workers: 3 });
    assert.equal(broken.workerCount, 3);
    const g = await broken.build({ type: 'sphere', r: 2 }, { resolution: 12 });
    assert.equal(g.userData.sdf.stats.thread, 'main');
    assert.equal(broken.workerCount, 0, 'pool desligado depois da falha de carga');
    assert.equal(broken.stats.localBuilds, 1);
    await broken.dispose();
  } finally {
    if (original === undefined) delete globalThis.Worker;
    else globalThis.Worker = original;
  }
});
