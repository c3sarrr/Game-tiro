// Persistência local em IndexedDB (sem conta, sem servidor).
// Stores: config, profile, stats, replays, presets (bonecos), loadouts, cache (geometria SDF, benchmark), meta.
// Se o IndexedDB não existir ou falhar (aba privada do Safari/Firefox, Node nos testes), cai para memória
// com a mesma API — o jogo funciona, só não guarda entre sessões (store.persistent === false).

export const DB_NAME = 'massacre';
export const DB_VERSION = 1;
export const STORES = Object.freeze(['config', 'profile', 'stats', 'replays', 'presets', 'loadouts', 'cache', 'meta']);

function promisify(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

const clone = (v) => (v === undefined ? undefined : structuredClone(v));

class MemoryBackend {
  constructor(stores) {
    this.maps = new Map(stores.map((s) => [s, new Map()]));
  }
  #map(store) {
    const m = this.maps.get(store);
    if (!m) throw new Error(`store desconhecido: ${store}`);
    return m;
  }
  async get(store, key) { return clone(this.#map(store).get(key)); }
  async put(store, key, value) { this.#map(store).set(key, clone(value)); }
  async delete(store, key) { this.#map(store).delete(key); }
  async keys(store) { return [...this.#map(store).keys()]; }
  async getAll(store) { return [...this.#map(store)].map(([key, value]) => ({ key, value: clone(value) })); }
  async clear(store) { this.#map(store).clear(); }
  close() {}
}

class IDBBackend {
  constructor(db) {
    this.db = db;
  }
  #tx(store, mode) {
    return this.db.transaction(store, mode).objectStore(store);
  }
  get(store, key) { return promisify(this.#tx(store, 'readonly').get(key)); }
  put(store, key, value) { return promisify(this.#tx(store, 'readwrite').put(value, key)).then(() => undefined); }
  delete(store, key) { return promisify(this.#tx(store, 'readwrite').delete(key)).then(() => undefined); }
  keys(store) { return promisify(this.#tx(store, 'readonly').getAllKeys()); }
  async getAll(store) {
    const os = this.#tx(store, 'readonly');
    const [keys, values] = await Promise.all([promisify(os.getAllKeys()), promisify(os.getAll())]);
    return keys.map((key, i) => ({ key, value: values[i] }));
  }
  clear(store) { return promisify(this.#tx(store, 'readwrite').clear()).then(() => undefined); }
  close() { this.db.close(); }
}

function openIDB(idb, name, version, stores) {
  return new Promise((resolve, reject) => {
    let req;
    try {
      req = idb.open(name, version);
    } catch (err) {
      reject(err);
      return;
    }
    req.onupgradeneeded = () => {
      const db = req.result;
      for (const s of stores) if (!db.objectStoreNames.contains(s)) db.createObjectStore(s);
    };
    req.onsuccess = () => {
      const db = req.result;
      // Outra aba abriu uma versão mais nova: fecha para não bloquear a atualização dela.
      db.onversionchange = () => db.close();
      resolve(db);
    };
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error('IndexedDB bloqueado por outra aba com versão antiga aberta'));
  });
}

export class Store {
  #backend;
  #persistent;

  constructor(backend, persistent) {
    this.#backend = backend;
    this.#persistent = persistent;
  }

  /** Abre o banco; nunca rejeita — em falha devolve um Store em memória e informa o motivo. */
  static async open({ name = DB_NAME, version = DB_VERSION, stores = STORES, indexedDB = globalThis.indexedDB, log } = {}) {
    if (indexedDB) {
      try {
        const db = await openIDB(indexedDB, name, version, stores);
        return new Store(new IDBBackend(db), true);
      } catch (err) {
        log?.warn('IndexedDB indisponível, usando memória:', err?.message ?? err);
      }
    }
    return new Store(new MemoryBackend(stores), false);
  }

  get persistent() {
    return this.#persistent;
  }

  get(store, key) { return this.#backend.get(store, key); }
  put(store, key, value) { return this.#backend.put(store, key, value); }
  delete(store, key) { return this.#backend.delete(store, key); }
  keys(store) { return this.#backend.keys(store); }
  getAll(store) { return this.#backend.getAll(store); }
  clear(store) { return this.#backend.clear(store); }
  close() { this.#backend.close(); }

  /** Pede ao navegador para não apagar os dados sob pressão de espaço (progresso do jogador). */
  async requestPersistence() {
    try {
      return (await globalThis.navigator?.storage?.persist?.()) ?? false;
    } catch {
      return false;
    }
  }

  async estimate() {
    try {
      return (await globalThis.navigator?.storage?.estimate?.()) ?? null;
    } catch {
      return null;
    }
  }
}
