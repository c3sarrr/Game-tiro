// Sistema de configuração com esquema, defaults, validação e persistência em IndexedDB.
// - O esquema (src/data/configSchema.js) define tipo, faixa, opções, rótulo e default de cada chave.
// - set() valida/ajusta (clamp, step, enum) e emite EV.CONFIG_CHANGE; valores inválidos são rejeitados.
// - Salvar é "debounced" (várias mudanças seguidas = 1 escrita) e flush() força a gravação.

import { EV } from './events.js';

const deepClone = (v) => (v === undefined || v === null || typeof v !== 'object' ? v : structuredClone(v));

function roundStep(n, step, base) {
  const k = Math.round((n - base) / step);
  return Number((base + k * step).toFixed(6));
}

/** Converte/valida um valor segundo a especificação. Devolve `undefined` se for inválido. */
export function coerce(spec, value) {
  switch (spec.type) {
    case 'bool':
      if (typeof value === 'boolean') return value;
      if (value === 'true' || value === 1 || value === '1' || value === 'on') return true;
      if (value === 'false' || value === 0 || value === '0' || value === 'off') return false;
      return undefined;
    case 'number': {
      let n = typeof value === 'string' ? Number(value.replace(',', '.')) : Number(value);
      if (!Number.isFinite(n)) return undefined;
      if (spec.min !== undefined && n < spec.min) n = spec.min;
      if (spec.max !== undefined && n > spec.max) n = spec.max;
      if (spec.step) n = roundStep(n, spec.step, spec.min ?? 0);
      if (spec.integer) n = Math.round(n);
      return n;
    }
    case 'enum':
      return spec.options.includes(value) ? value : undefined;
    case 'string': {
      if (typeof value !== 'string') return undefined;
      const s = value.slice(0, spec.maxLength ?? 256);
      if (spec.pattern && !spec.pattern.test(s)) return undefined;
      return s;
    }
    case 'object':
    case 'array': {
      if (value === null || typeof value !== 'object') return undefined;
      if (spec.type === 'array' && !Array.isArray(value)) return undefined;
      const copy = deepClone(value);
      return spec.validate ? spec.validate(copy) : copy;
    }
    default:
      throw new Error(`tipo de config desconhecido: ${spec.type}`);
  }
}

const defaultOf = (spec) => deepClone(typeof spec.default === 'function' ? spec.default() : spec.default);

const equal = (a, b) => {
  if (a === b) return true;
  if (a && b && typeof a === 'object' && typeof b === 'object') return JSON.stringify(a) === JSON.stringify(b);
  return false;
};

export class Config {
  #schema;
  #values = new Map();
  #events;
  #store;
  #storeKey;
  #saveDelay;
  #saveTimer = null;
  #log;

  constructor(schema, { events = null, store = null, storeKey = 'user', saveDelayMs = 300, log = null } = {}) {
    this.#schema = schema;
    this.#events = events;
    this.#store = store;
    this.#storeKey = storeKey;
    this.#saveDelay = saveDelayMs;
    this.#log = log;
    for (const [key, spec] of Object.entries(schema)) this.#values.set(key, defaultOf(spec));
  }

  /** Carrega valores salvos por cima dos defaults (ignorando chaves antigas/invalidas). */
  async load() {
    if (!this.#store) return this;
    let saved = null;
    try {
      saved = await this.#store.get('config', this.#storeKey);
    } catch (err) {
      this.#log?.warn('não foi possível ler a config salva:', err?.message ?? err);
    }
    if (saved && typeof saved === 'object') {
      for (const [key, raw] of Object.entries(saved)) {
        const spec = this.#schema[key];
        if (!spec) continue;
        const v = coerce(spec, raw);
        if (v !== undefined) this.#values.set(key, v);
      }
    }
    this.#events?.emit(EV.CONFIG_LOADED, { values: this.snapshot() });
    return this;
  }

  has(key) {
    return key in this.#schema;
  }

  spec(key) {
    return this.#schema[key];
  }

  get(key) {
    if (!this.#values.has(key)) throw new Error(`config desconhecida: ${key}`);
    return this.#values.get(key);
  }

  /** Define um valor. Devolve o valor final (ajustado) ou `undefined` se foi rejeitado. */
  set(key, value, { persist = true, source = 'user' } = {}) {
    const spec = this.#schema[key];
    if (!spec) throw new Error(`config desconhecida: ${key}`);
    const v = coerce(spec, value);
    if (v === undefined) {
      this.#log?.warn(`valor inválido para ${key}:`, value);
      return undefined;
    }
    const prev = this.#values.get(key);
    if (equal(prev, v)) return v;
    this.#values.set(key, v);
    this.#events?.emit(EV.CONFIG_CHANGE, { key, value: v, prev, source });
    if (persist && !spec.transient) this.#scheduleSave();
    return v;
  }

  setMany(obj, opts) {
    const out = {};
    for (const [k, v] of Object.entries(obj)) out[k] = this.set(k, v, opts);
    return out;
  }

  reset(key, opts) {
    return this.set(key, defaultOf(this.#schema[key]), opts);
  }

  resetPrefix(prefix, opts) {
    for (const key of this.keys(prefix)) this.reset(key, opts);
  }

  isDefault(key) {
    return equal(this.#values.get(key), defaultOf(this.#schema[key]));
  }

  keys(prefix = '') {
    return Object.keys(this.#schema).filter((k) => k.startsWith(prefix));
  }

  snapshot() {
    const out = {};
    for (const [k, v] of this.#values) out[k] = deepClone(v);
    return out;
  }

  /** Assina mudanças de chaves com um prefixo (ex.: 'graphics.'). Devolve o cancelamento. */
  watch(prefix, fn) {
    if (!this.#events) throw new Error('Config sem barramento de eventos');
    return this.#events.on(EV.CONFIG_CHANGE, (e) => {
      if (e.key.startsWith(prefix)) fn(e);
    });
  }

  #scheduleSave() {
    if (!this.#store) return;
    clearTimeout(this.#saveTimer);
    this.#saveTimer = setTimeout(() => this.flush(), this.#saveDelay);
  }

  /** Grava agora. Só salva chaves persistentes que diferem do default (config enxuta e à prova de mudanças de default). */
  async flush() {
    clearTimeout(this.#saveTimer);
    this.#saveTimer = null;
    if (!this.#store) return;
    const out = {};
    for (const [key, spec] of Object.entries(this.#schema)) {
      if (spec.transient) continue;
      if (!this.isDefault(key)) out[key] = deepClone(this.#values.get(key));
    }
    try {
      await this.#store.put('config', this.#storeKey, out);
    } catch (err) {
      this.#log?.warn('falha ao salvar config:', err?.message ?? err);
    }
  }
}
