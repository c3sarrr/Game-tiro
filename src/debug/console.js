// Console de comandos (` ou F1): registro de comandos com ajuda e autocompletar, histórico persistido,
// e espelho do log do jogo (avisos e erros aparecem aqui também).

import { h } from '../ui/dom.js';
import { EV } from '../core/events.js';

const MAX_LINES = 400;

/** Divide respeitando aspas: set a "b c" → ['set','a','b c']. */
export function tokenize(line) {
  const out = [];
  const re = /"([^"]*)"|'([^']*)'|(\S+)/g;
  let m;
  while ((m = re.exec(line))) out.push(m[1] ?? m[2] ?? m[3]);
  return out;
}

export class DebugConsole {
  constructor(services) {
    this.s = services;
    this.commands = new Map();
    this.history = [...services.config.get('debug.consoleHistory')];
    this.cursor = this.history.length;
    this.isOpen = false;
    this.log = h('div.console-log', { role: 'log', 'aria-live': 'polite' });
    this.input = h('input.console-input', {
      type: 'text', spellcheck: false, autocomplete: 'off', 'aria-label': 'Comando',
      placeholder: 'digite um comando (help lista todos)',
    });
    this.hintEl = h('div.console-hint');
    this.root = h('section.console', { hidden: true, 'aria-label': 'Console de comandos' },
      h('header.console-head', null, h('span.tape-label', null, 'Console'), h('span.console-tip', null, 'Tab completa · ↑↓ histórico · Esc fecha')),
      this.log,
      h('div.console-line', null, h('span.console-prompt', null, '>'), this.input),
      this.hintEl,
    );
    services.debugRoot.append(this.root);
    this.input.addEventListener('keydown', (e) => this.#key(e));
    this.input.addEventListener('input', () => this.#hint());
    this.offLog = services.events.on(EV.LOG, (entry) => {
      if (entry.level !== 'debug') this.print(entry.text, entry.level);
    });
  }

  register(def) {
    if (!def.name || typeof def.run !== 'function') throw new Error('comando inválido');
    this.commands.set(def.name, { usage: '', help: '', ...def });
    for (const alias of def.aliases ?? []) this.commands.set(alias, { ...this.commands.get(def.name), alias: def.name });
  }

  print(text, level = 'info') {
    const line = h(`div.console-row.is-${level}`, null, text);
    this.log.append(line);
    while (this.log.childElementCount > MAX_LINES) this.log.firstChild.remove();
    if (this.isOpen) this.log.scrollTop = this.log.scrollHeight;
  }

  open() {
    if (this.isOpen) return;
    this.isOpen = true;
    this.root.hidden = false;
    this.log.scrollTop = this.log.scrollHeight;
    requestAnimationFrame(() => this.input.focus());
  }

  close() {
    if (!this.isOpen) return;
    this.isOpen = false;
    this.root.hidden = true;
    this.input.blur();
  }

  toggle() {
    if (this.isOpen) this.close();
    else this.open();
  }

  /** Executa uma linha. Devolve true se o comando existia e rodou sem erro. */
  execute(line) {
    const trimmed = line.trim();
    if (!trimmed) return false;
    this.print(`> ${trimmed}`, 'cmd');
    const [name, ...args] = tokenize(trimmed);
    const cmd = this.commands.get(name.toLowerCase());
    if (!cmd) {
      const near = [...this.commands.keys()].filter((k) => k.startsWith(name.slice(0, 2).toLowerCase())).slice(0, 5);
      this.print(`comando desconhecido: ${name}${near.length ? ` (quis dizer: ${near.join(', ')}?)` : ''}`, 'warn');
      return false;
    }
    try {
      const out = cmd.run(args, trimmed);
      if (out instanceof Promise) {
        out.then((r) => r && this.print(String(r))).catch((err) => this.print(`erro: ${err?.message ?? err}`, 'error'));
      } else if (out !== undefined && out !== null && out !== '') {
        this.print(String(out));
      }
      return true;
    } catch (err) {
      this.print(`erro: ${err?.message ?? err}${cmd.usage ? `\nuso: ${cmd.alias ?? cmd.name} ${cmd.usage}` : ''}`, 'error');
      return false;
    }
  }

  #pushHistory(line) {
    if (this.history[this.history.length - 1] !== line) this.history.push(line);
    if (this.history.length > 50) this.history.splice(0, this.history.length - 50);
    this.cursor = this.history.length;
    this.s.config.set('debug.consoleHistory', this.history);
  }

  #key(e) {
    e.stopPropagation();
    if (e.key === 'Enter') {
      const line = this.input.value;
      this.input.value = '';
      this.#hint();
      if (line.trim()) this.#pushHistory(line.trim());
      this.execute(line);
    } else if (e.key === 'Escape' || e.code === 'Backquote' || e.key === 'F1') {
      e.preventDefault();
      this.close();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (this.cursor > 0) this.input.value = this.history[--this.cursor] ?? '';
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      this.cursor = Math.min(this.history.length, this.cursor + 1);
      this.input.value = this.history[this.cursor] ?? '';
    } else if (e.key === 'Tab') {
      e.preventDefault();
      this.#complete();
    }
  }

  #candidates(value) {
    const tokens = tokenize(value);
    const endsWithSpace = /\s$/.test(value);
    if (tokens.length <= 1 && !endsWithSpace) {
      const p = (tokens[0] ?? '').toLowerCase();
      return { index: 0, list: [...this.commands.keys()].filter((k) => k.startsWith(p)).sort() };
    }
    const cmd = this.commands.get(tokens[0].toLowerCase());
    if (!cmd?.complete) return { index: -1, list: [] };
    const argIndex = endsWithSpace ? tokens.length - 1 : tokens.length - 2;
    const partial = endsWithSpace ? '' : tokens[tokens.length - 1];
    return { index: argIndex + 1, list: cmd.complete(argIndex, partial.toLowerCase()).filter((c) => c.toLowerCase().startsWith(partial.toLowerCase())) };
  }

  #complete() {
    const value = this.input.value;
    const { index, list } = this.#candidates(value);
    if (!list.length) return;
    const tokens = tokenize(value);
    if (/\s$/.test(value)) tokens.push('');
    if (list.length === 1) {
      tokens[index] = list[0];
      this.input.value = `${tokens.join(' ')} `;
    } else {
      // Completa o prefixo comum e mostra as opções.
      let prefix = list[0];
      for (const c of list) while (!c.startsWith(prefix)) prefix = prefix.slice(0, -1);
      tokens[index] = prefix;
      this.input.value = tokens.join(' ');
      this.print(list.join('   '), 'hint');
    }
    this.#hint();
  }

  #hint() {
    const tokens = tokenize(this.input.value);
    const cmd = tokens[0] && this.commands.get(tokens[0].toLowerCase());
    this.hintEl.textContent = cmd ? `${cmd.alias ?? cmd.name} ${cmd.usage} — ${cmd.help}` : '';
  }

  dispose() {
    this.offLog();
    this.root.remove();
  }
}
