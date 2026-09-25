// Logger com níveis, buffer circular (para o console de debug) e espelhamento no console do navegador.
// info/debug NÃO vão para o console do navegador por padrão (evita ruído); warn/error vão sempre.

import { EV } from './events.js';

export const LOG_LEVELS = Object.freeze({ debug: 10, info: 20, warn: 30, error: 40 });

function stringify(part) {
  if (part instanceof Error) return part.stack || `${part.name}: ${part.message}`;
  if (typeof part === 'string') return part;
  try {
    return JSON.stringify(part);
  } catch {
    return String(part);
  }
}

export class Logger {
  #events;
  #buffer;
  #head = 0;
  #size = 0;
  #prefix;

  constructor({ events = null, capacity = 500, echoInfo = false, prefix = '' } = {}) {
    this.#events = events;
    this.#buffer = new Array(capacity);
    this.echoInfo = echoInfo;
    this.#prefix = prefix;
    this.minLevel = LOG_LEVELS.debug;
  }

  #push(level, parts) {
    if (LOG_LEVELS[level] < this.minLevel) return;
    const text = (this.#prefix ? `[${this.#prefix}] ` : '') + parts.map(stringify).join(' ');
    const entry = { level, text, time: typeof performance !== 'undefined' ? performance.now() : Date.now() };
    this.#buffer[this.#head] = entry;
    this.#head = (this.#head + 1) % this.#buffer.length;
    this.#size = Math.min(this.#size + 1, this.#buffer.length);
    if (level === 'error') console.error(text);
    else if (level === 'warn') console.warn(text);
    else if (this.echoInfo) console.info(text);
    this.#events?.emit(EV.LOG, entry);
  }

  debug(...parts) { this.#push('debug', parts); }
  info(...parts) { this.#push('info', parts); }
  warn(...parts) { this.#push('warn', parts); }
  error(...parts) { this.#push('error', parts); }

  /** Entradas em ordem cronológica. */
  entries() {
    const out = [];
    const cap = this.#buffer.length;
    const start = (this.#head - this.#size + cap) % cap;
    for (let i = 0; i < this.#size; i++) out.push(this.#buffer[(start + i) % cap]);
    return out;
  }

  /** Logger filho que compartilha buffer/eventos e acrescenta um prefixo. */
  scope(name) {
    const parent = this;
    const prefix = this.#prefix ? `${this.#prefix}/${name}` : name;
    return {
      debug: (...p) => parent.#push('debug', [`[${prefix}]`, ...p]),
      info: (...p) => parent.#push('info', [`[${prefix}]`, ...p]),
      warn: (...p) => parent.#push('warn', [`[${prefix}]`, ...p]),
      error: (...p) => parent.#push('error', [`[${prefix}]`, ...p]),
    };
  }
}
