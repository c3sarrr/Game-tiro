// Fábrica de malhas de massinha a partir de árvores SDF: build(tree) → THREE.BufferGeometry com position, normal,
// aMat, aSeam, aTouch (itemSize 1), índice (Uint16 quando cabe) e grupos por material (addGroup), pronta para o
// ClayMaterial (lê aTouch/aSeam e espera normais suaves) — materialIndex do grupo = `mat` da árvore.
// Camadas, da mais barata para a mais cara:
//   1. LRU em memória com os dados crus (cada build devolve geometria NOVA com cópias próprias: pode ser amassada
//      por tiros ou descartada sem afetar outras instâncias);
//   2. pedidos iguais em andamento compartilham a mesma promessa (um só cálculo por chave);
//   3. cache persistente no IndexedDB via Store (store 'cache', chave 'sdf:' + hashNode(árvore,
//      `${resolution}:${maxCells}:${SDF_CACHE_VERSION}`)), com índice LRU próprio ('sdf:index') para não crescer;
//   4. pool de Workers de módulo (1 a 3). Sem Worker de módulo (navegador antigo, arquivo que não carregou), a
//      mesma rotina roda na thread principal, um pedido por vez, cedendo o laço de eventos entre eles.

import * as THREE from 'three';
import { bounds, compile, hashNode } from './nodes.js';
import { DEFAULT_MAX_CELLS, DEFAULT_RESOLUTION, DEFAULT_TOUCH_RADIUS, polygonize } from './marchingCubes.js';

/**
 * Versão do formato/algoritmo: mudar invalida o cache persistente antigo (as entradas velhas saem pelo LRU).
 * v2 (Fase 2.6): fronteiras de cor cortadas no lugar exato (materialSplit.js) e forma `spiral`.
 */
export const SDF_CACHE_VERSION = 'v2';

const CACHE_STORE = 'cache';
const INDEX_KEY = 'sdf:index';
const INDEX_SAVE_DELAY_MS = 1500;

const now = () => (globalThis.performance?.now ? globalThis.performance.now() : Date.now());

function yieldToEventLoop() {
  if (typeof globalThis.scheduler?.yield === 'function') return globalThis.scheduler.yield();
  return new Promise((resolve) => setTimeout(resolve, 0));
}

/** Workers padrão: núcleos lógicos − 1 (sobra um para o jogo), entre 1 e 3. */
export function defaultWorkerCount() {
  const cores = globalThis.navigator?.hardwareConcurrency || 2;
  return Math.max(1, Math.min(3, cores - 1));
}

function normalizeOptions({ resolution = DEFAULT_RESOLUTION, maxCells = DEFAULT_MAX_CELLS, touchRadius = DEFAULT_TOUCH_RADIUS } = {}) {
  const res = Math.round(Number(resolution));
  const cells = Math.floor(Number(maxCells));
  const touch = Number(touchRadius);
  if (!(res >= 2 && res <= 1024)) throw new TypeError(`SdfMesher: resolution inválida (${resolution})`);
  if (!(cells >= 27 && cells <= 64e6)) throw new TypeError(`SdfMesher: maxCells inválido (${maxCells})`);
  if (!(touch > 0 && Number.isFinite(touch))) throw new TypeError(`SdfMesher: touchRadius inválido (${touchRadius})`);
  return { resolution: res, maxCells: cells, touchRadius: touch };
}

const ARRAYS = [['positions', Float32Array], ['normals', Float32Array], ['indices', Uint32Array], ['mat', Float32Array], ['seam', Float32Array], ['touch', Float32Array]];

/** Confere forma e coerência dos dados de malha (resposta do Worker ou entrada do IndexedDB). */
export function isMeshData(v, checkIndices = false) {
  if (!v || typeof v !== 'object' || !Array.isArray(v.groups)) return false;
  if (!ARRAYS.every(([key, Type]) => v[key] instanceof Type)) return false;
  const vertices = v.positions.length / 3;
  if (!Number.isInteger(vertices) || v.normals.length !== v.positions.length || v.indices.length % 3 !== 0) return false;
  if (v.mat.length !== vertices || v.seam.length !== vertices || v.touch.length !== vertices) return false;
  let covered = 0;
  for (const g of v.groups) {
    if (!(Number.isInteger(g?.start) && Number.isInteger(g?.count) && Number.isInteger(g?.materialIndex))) return false;
    if (g.start !== covered || g.count % 3 !== 0) return false;
    covered += g.count;
  }
  if (covered !== v.indices.length) return false;
  if (checkIndices) for (let i = 0; i < v.indices.length; i++) if (v.indices[i] >= vertices) return false;
  return true;
}

function meshBytes(d) {
  return d.positions.byteLength + d.normals.byteLength + d.indices.byteLength + d.mat.byteLength + d.seam.byteLength + d.touch.byteLength;
}

/**
 * Converte dados de malha (polygonize / Worker / cache) em BufferGeometry com cópias próprias dos arrays.
 * @param {object} data {positions, normals, indices, mat, seam, touch, groups, stats}
 * @param {string} [name]
 * @returns {THREE.BufferGeometry}
 */
export function meshToGeometry(data, name = 'sdf') {
  const geometry = new THREE.BufferGeometry();
  geometry.name = name;
  const vertexCount = data.positions.length / 3;
  geometry.setAttribute('position', new THREE.BufferAttribute(data.positions.slice(), 3));
  geometry.setAttribute('normal', new THREE.BufferAttribute(data.normals.slice(), 3));
  geometry.setAttribute('aMat', new THREE.BufferAttribute(data.mat.slice(), 1));
  geometry.setAttribute('aSeam', new THREE.BufferAttribute(data.seam.slice(), 1));
  geometry.setAttribute('aTouch', new THREE.BufferAttribute(data.touch.slice(), 1));
  // Índice 0xFFFF é reiniciador de primitiva no WebGL2: Uint16 só com até 65535 vértices (índices ≤ 65534).
  const index = vertexCount <= 65535 ? Uint16Array.from(data.indices) : data.indices.slice();
  geometry.setIndex(new THREE.BufferAttribute(index, 1));
  for (const g of data.groups) geometry.addGroup(g.start, g.count, g.materialIndex);
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  geometry.userData.sdf = { key: name, stats: { ...data.stats } };
  return geometry;
}

export class SdfMesher {
  #store;
  #log;
  #workerCount;
  #cacheEntries;
  #cacheBytes;
  #storeEntries;
  #slots = [];
  #queue = [];
  #nextJob = 1;
  #poolBroken = false;
  #poolProven = false;
  #lru = new Map();
  #lruBytes = 0;
  #inflight = new Map();
  #localChain = Promise.resolve();
  #index = null;
  #indexLoading = null;
  #indexTimer = null;
  #indexDirty = false;
  #disposed = false;

  /**
   * @param {{store?:import('../../core/store.js').Store|null, log?:object|null, workers?:number, cacheEntries?:number,
   *          cacheBytes?:number, storeEntries?:number}} [options] workers = 0 força a thread principal
   */
  constructor({ store = null, log = null, workers = defaultWorkerCount(), cacheEntries = 48, cacheBytes = 64 * 1024 * 1024, storeEntries = 256 } = {}) {
    this.#store = store;
    this.#log = log;
    this.#workerCount = typeof globalThis.Worker === 'function' ? Math.max(0, Math.min(3, Math.floor(workers) || 0)) : 0;
    this.#cacheEntries = Math.max(1, Math.floor(cacheEntries));
    this.#cacheBytes = Math.max(1, cacheBytes);
    this.#storeEntries = Math.max(1, Math.floor(storeEntries));
    /** Contadores para o overlay/console de debug. */
    this.stats = { requests: 0, memoryHits: 0, sharedHits: 0, storeHits: 0, workerBuilds: 0, localBuilds: 0, failures: 0 };
  }

  /** Workers realmente em uso (0 = thread principal). */
  get workerCount() {
    return this.#poolBroken ? 0 : this.#workerCount;
  }

  /** Chave de cache de uma árvore com estas opções (a mesma usada no IndexedDB). */
  keyFor(tree, options = {}) {
    const { resolution, maxCells, touchRadius } = normalizeOptions(options);
    let extra = `${resolution}:${maxCells}:${SDF_CACHE_VERSION}`;
    if (touchRadius !== DEFAULT_TOUCH_RADIUS) extra += `:t${touchRadius}`;
    return `sdf:${hashNode(tree, extra)}`;
  }

  /**
   * Gera (ou busca no cache) a malha de uma árvore SDF.
   * @param {object} tree árvore SDF (JSON, ver src/clay/sdf/nodes.js)
   * @param {{resolution?:number, maxCells?:number, touchRadius?:number}} [options]
   * @returns {Promise<THREE.BufferGeometry>} geometria nova (quem recebe é dono e faz dispose())
   */
  async build(tree, options = {}) {
    if (this.#disposed) throw new Error('SdfMesher: já foi descartado');
    const opts = normalizeOptions(options);
    const key = this.keyFor(tree, opts);
    this.stats.requests++;
    const data = await this.#meshData(key, tree, opts);
    return meshToGeometry(data, key);
  }

  #meshData(key, tree, opts) {
    const cached = this.#lruGet(key);
    if (cached) {
      this.stats.memoryHits++;
      return Promise.resolve(cached);
    }
    let pending = this.#inflight.get(key);
    if (pending) {
      this.stats.sharedHits++;
      return pending;
    }
    pending = this.#load(key, tree, opts).finally(() => this.#inflight.delete(key));
    this.#inflight.set(key, pending);
    return pending;
  }

  async #load(key, tree, opts) {
    const stored = await this.#readStore(key);
    if (stored) {
      this.stats.storeHits++;
      this.#lruSet(key, stored);
      return stored;
    }
    let data;
    try {
      data = await (this.#workerCount > 0 && !this.#poolBroken ? this.#runInWorker(tree, opts) : this.#runLocal(tree, opts));
    } catch (err) {
      this.stats.failures++;
      throw err;
    }
    if (this.#disposed) return data;
    this.#lruSet(key, data);
    this.#writeStore(key, data);
    const s = data.stats;
    this.#log?.debug(`malha SDF ${key.slice(4, 12)}: ${s.vertices} vértices, ${s.triangles} triângulos, ${s.ms.toFixed(1)} ms (${s.thread})`);
    return data;
  }

  // ---- pool de Workers ----

  #runInWorker(tree, opts) {
    return new Promise((resolve, reject) => {
      this.#queue.push({ id: this.#nextJob++, tree, opts, resolve, reject });
      this.#ensurePool();
      this.#pump();
    });
  }

  #ensurePool() {
    if (this.#slots.length > 0 || this.#poolBroken) return;
    try {
      for (let i = 0; i < this.#workerCount; i++) this.#slots.push(this.#spawn(i));
    } catch (err) {
      this.#breakPool(err);
    }
  }

  #spawn(index) {
    const worker = new Worker(new URL('./sdfWorker.js', import.meta.url), { type: 'module', name: `massacre-sdf-${index}` });
    const slot = { worker, job: null, index };
    worker.addEventListener('message', (e) => this.#onWorkerMessage(slot, e.data));
    worker.addEventListener('error', (e) => {
      e.preventDefault();
      this.#onWorkerError(slot, e);
    });
    worker.addEventListener('messageerror', () => {
      this.#onWorkerMessage(slot, { id: slot.job?.id ?? null, error: 'a resposta do Worker de SDF não pôde ser lida' });
    });
    return slot;
  }

  #pump() {
    if (this.#poolBroken) return;
    for (const slot of this.#slots) {
      while (!slot.job && this.#queue.length > 0) {
        const job = this.#queue.shift();
        slot.job = job;
        try {
          const { resolution, maxCells, touchRadius } = job.opts;
          slot.worker.postMessage({ id: job.id, tree: job.tree, resolution, maxCells, touchRadius });
        } catch (err) {
          // DataCloneError: a árvore tem algo que não é JSON (função, símbolo...).
          slot.job = null;
          job.reject(new Error(`SDF: a árvore não pode ir para o Worker (${err?.message ?? err})`));
        }
      }
    }
  }

  #onWorkerMessage(slot, msg) {
    const job = slot.job;
    if (!job) return;
    if (msg && msg.id !== null && msg.id !== undefined && msg.id !== job.id) return;
    slot.job = null;
    this.#poolProven = true;
    if (!msg || msg.error) {
      job.reject(new Error(`SDF: ${msg?.error ?? 'resposta vazia do Worker'}`));
    } else {
      const data = {
        positions: msg.positions, normals: msg.normals, indices: msg.indices,
        mat: msg.mat, seam: msg.seam, touch: msg.touch, groups: msg.groups,
        stats: { ...msg.stats, thread: 'worker' },
      };
      if (isMeshData(data)) {
        this.stats.workerBuilds++;
        job.resolve(data);
      } else {
        job.reject(new Error('SDF: resposta do Worker em formato inesperado'));
      }
    }
    this.#pump();
  }

  #onWorkerError(slot, event) {
    const reason = event?.message || 'falha ao carregar ou executar o Worker de SDF';
    if (!this.#poolProven) {
      // Nenhum Worker respondeu ainda: Worker de módulo indisponível → tudo na thread principal.
      this.#breakPool(new Error(reason));
      return;
    }
    // Um Worker que já funcionava caiu no meio de um pedido (ex.: memória): troca a vaga e falha só esse pedido.
    const i = this.#slots.indexOf(slot);
    if (i < 0) return; // segundo erro do mesmo Worker, que já foi substituído
    const job = slot.job;
    slot.job = null;
    slot.worker.terminate();
    try {
      this.#slots[i] = this.#spawn(slot.index);
    } catch {
      this.#slots.splice(i, 1);
    }
    if (job) job.reject(new Error(`SDF: o Worker caiu durante a geração (${reason})`));
    if (this.#slots.length === 0) this.#breakPool(new Error(reason));
    else this.#pump();
  }

  #breakPool(err) {
    if (this.#poolBroken) return;
    this.#poolBroken = true;
    this.#log?.warn('SDF: Workers de módulo indisponíveis, malhas serão geradas na thread principal:', err?.message ?? err);
    const pending = [];
    for (const slot of this.#slots) {
      if (slot.job) pending.push(slot.job);
      slot.worker.terminate();
    }
    this.#slots = [];
    pending.push(...this.#queue.splice(0));
    for (const job of pending) this.#runLocal(job.tree, job.opts).then(job.resolve, job.reject);
  }

  // ---- fallback na thread principal (um pedido por vez, cedendo o laço entre eles) ----

  #runLocal(tree, opts) {
    const run = async () => {
      await yieldToEventLoop();
      if (this.#disposed) throw new Error('SdfMesher: descartado antes de gerar a malha');
      const t0 = now();
      const mesh = polygonize(compile(tree), bounds(tree), opts);
      mesh.stats.ms = now() - t0;
      mesh.stats.thread = 'main';
      this.stats.localBuilds++;
      return mesh;
    };
    const result = this.#localChain.then(run, run);
    this.#localChain = result.catch(() => {});
    return result;
  }

  // ---- LRU em memória ----

  #lruGet(key) {
    const v = this.#lru.get(key);
    if (!v) return null;
    this.#lru.delete(key);
    this.#lru.set(key, v);
    return v;
  }

  #lruSet(key, data) {
    if (this.#disposed) return;
    const old = this.#lru.get(key);
    if (old) {
      this.#lru.delete(key);
      this.#lruBytes -= meshBytes(old);
    }
    const bytes = meshBytes(data);
    if (bytes > this.#cacheBytes) return;
    this.#lru.set(key, data);
    this.#lruBytes += bytes;
    for (const [k, v] of this.#lru) {
      if (this.#lru.size <= this.#cacheEntries && this.#lruBytes <= this.#cacheBytes) break;
      this.#lru.delete(k);
      this.#lruBytes -= meshBytes(v);
    }
  }

  // ---- cache persistente (IndexedDB via Store) ----

  async #readStore(key) {
    if (!this.#store) return null;
    try {
      const value = await this.#store.get(CACHE_STORE, key);
      if (value === undefined || value === null) return null;
      if (!isMeshData(value, true)) {
        this.#log?.warn(`SDF: entrada de cache inválida descartada (${key})`);
        await this.#store.delete(CACHE_STORE, key);
        return null;
      }
      this.#touchIndex(key).catch(() => {});
      return { ...value, stats: { ...value.stats, source: 'store' } };
    } catch (err) {
      this.#log?.warn('SDF: falha ao ler o cache persistente:', err?.message ?? err);
      return null;
    }
  }

  #writeStore(key, data) {
    if (!this.#store) return;
    const { positions, normals, indices, mat, seam, touch, groups, stats } = data;
    this.#store.put(CACHE_STORE, key, { v: 1, positions, normals, indices, mat, seam, touch, groups, stats })
      .then(() => this.#touchIndex(key))
      .catch((err) => this.#log?.warn('SDF: falha ao gravar o cache persistente:', err?.message ?? err));
  }

  #loadIndex() {
    if (this.#index) return Promise.resolve(this.#index);
    this.#indexLoading ??= (async () => {
      let entries = [];
      let keys = [];
      try {
        const saved = await this.#store.get(CACHE_STORE, INDEX_KEY);
        if (Array.isArray(saved?.entries)) entries = saved.entries;
        keys = await this.#store.keys(CACHE_STORE);
      } catch (err) {
        this.#log?.warn('SDF: índice do cache persistente ilegível, recomeçando:', err?.message ?? err);
      }
      const index = new Map();
      // Entradas gravadas sem chegar ao índice (sessão fechada antes de salvar) entram como as mais antigas.
      const known = new Set(entries.map((e) => e?.[0]));
      for (const k of keys) if (typeof k === 'string' && k.startsWith('sdf:') && k !== INDEX_KEY && !known.has(k)) index.set(k, 0);
      entries
        .filter((e) => Array.isArray(e) && typeof e[0] === 'string' && Number.isFinite(e[1]))
        .sort((a, b) => a[1] - b[1])
        .forEach(([k, t]) => index.set(k, t));
      this.#index = index;
      return index;
    })();
    return this.#indexLoading;
  }

  async #touchIndex(key) {
    if (!this.#store || this.#disposed) return;
    const index = await this.#loadIndex();
    index.delete(key);
    index.set(key, Date.now());
    this.#indexDirty = true;
    while (index.size > this.#storeEntries) {
      const oldest = index.keys().next().value;
      index.delete(oldest);
      this.#store.delete(CACHE_STORE, oldest).catch(() => {});
    }
    if (this.#indexTimer === null && !this.#disposed) {
      this.#indexTimer = setTimeout(() => {
        this.#indexTimer = null;
        this.#saveIndex();
      }, INDEX_SAVE_DELAY_MS);
    }
  }

  #saveIndex() {
    if (!this.#store || !this.#index || !this.#indexDirty) return Promise.resolve();
    this.#indexDirty = false;
    return this.#store.put(CACHE_STORE, INDEX_KEY, { v: 1, entries: [...this.#index] })
      .catch((err) => this.#log?.warn('SDF: falha ao salvar o índice do cache:', err?.message ?? err));
  }

  /**
   * Esvazia o LRU em memória e, com persistent: true, apaga todas as malhas SDF do IndexedDB.
   * @returns {Promise<number>} quantas entradas persistentes foram apagadas
   */
  async clearCache({ persistent = false } = {}) {
    this.#lru.clear();
    this.#lruBytes = 0;
    if (!persistent || !this.#store) return 0;
    const keys = (await this.#store.keys(CACHE_STORE)).filter((k) => typeof k === 'string' && k.startsWith('sdf:'));
    await Promise.all(keys.map((k) => this.#store.delete(CACHE_STORE, k)));
    this.#index = new Map();
    this.#indexLoading = Promise.resolve(this.#index);
    this.#indexDirty = false;
    if (this.#indexTimer !== null) {
      clearTimeout(this.#indexTimer);
      this.#indexTimer = null;
    }
    return keys.length;
  }

  /**
   * Encerra os Workers, rejeita pedidos pendentes e grava o índice do cache.
   * @returns {Promise<void>}
   */
  dispose() {
    if (this.#disposed) return Promise.resolve();
    this.#disposed = true;
    if (this.#indexTimer !== null) {
      clearTimeout(this.#indexTimer);
      this.#indexTimer = null;
    }
    const err = new Error('SdfMesher: descartado');
    for (const slot of this.#slots) {
      if (slot.job) slot.job.reject(err);
      slot.worker.terminate();
    }
    this.#slots = [];
    for (const job of this.#queue.splice(0)) job.reject(err);
    this.#lru.clear();
    this.#lruBytes = 0;
    this.#inflight.clear();
    return this.#saveIndex().then(() => undefined);
  }
}
