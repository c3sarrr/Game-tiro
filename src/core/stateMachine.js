// Gerenciador de estados do jogo: boot → menu → lobby → partida → resultado.
// - Transições permitidas são explícitas (tabela abaixo); uma transição inválida é erro de programação.
// - enter/exit podem ser assíncronos (carregar mapa, gerar geometria). Enquanto uma transição roda,
//   novas chamadas a go() entram numa fila e são aplicadas em ordem.
// - O estado ativo recebe tick(dt) do passo fixo e frame(alpha, dt) do render.

import { EV } from './events.js';

export const STATES = Object.freeze({
  BOOT: 'boot',
  MENU: 'menu',
  LOBBY: 'lobby',
  MATCH: 'match',
  RESULT: 'result',
});

// menu → partida direto é usado por modos locais (sala de testes, vitrine, Ondas solo).
export const TRANSITIONS = Object.freeze({
  boot: ['menu'],
  menu: ['lobby', 'match'],
  lobby: ['menu', 'match'],
  match: ['result', 'menu', 'lobby', 'match'],
  result: ['menu', 'lobby', 'match'],
});

export class StateMachine {
  #states = new Map();
  #current = null;
  #currentName = null;
  #queue = [];
  #busy = false;
  #events;
  #log;
  #transitions;

  constructor({ events = null, log = null, transitions = TRANSITIONS } = {}) {
    this.#events = events;
    this.#log = log;
    this.#transitions = transitions;
  }

  register(name, state) {
    if (this.#states.has(name)) throw new Error(`estado já registrado: ${name}`);
    this.#states.set(name, state);
    return this;
  }

  get name() {
    return this.#currentName;
  }

  get current() {
    return this.#current;
  }

  get busy() {
    return this.#busy;
  }

  canGo(to) {
    if (this.#currentName === null) return to === STATES.BOOT;
    return (this.#transitions[this.#currentName] ?? []).includes(to);
  }

  /** Solicita uma transição. Resolve quando ela (e as anteriores na fila) terminarem. */
  go(to, params = {}) {
    return new Promise((resolve, reject) => {
      this.#queue.push({ to, params, resolve, reject });
      if (!this.#busy) this.#drain();
    });
  }

  async #drain() {
    this.#busy = true;
    while (this.#queue.length) {
      const job = this.#queue.shift();
      try {
        await this.#transition(job.to, job.params);
        job.resolve();
      } catch (err) {
        this.#log?.error(`falha na transição para "${job.to}":`, err);
        job.reject(err);
      }
    }
    this.#busy = false;
  }

  async #transition(to, params) {
    const next = this.#states.get(to);
    if (!next) throw new Error(`estado não registrado: ${to}`);
    const from = this.#currentName;
    if (!this.canGo(to)) throw new Error(`transição proibida: ${from ?? '(início)'} → ${to}`);
    const prev = this.#current;
    this.#current = null; // durante a troca nada recebe tick/frame
    if (prev?.exit) await prev.exit(to);
    this.#currentName = to;
    if (next.enter) await next.enter(params, from);
    this.#current = next;
    this.#events?.emit(EV.STATE_CHANGE, { from, to, params });
  }

  tick(dt, tickIndex) {
    this.#current?.tick?.(dt, tickIndex);
  }

  frame(alpha, dt, now) {
    this.#current?.frame?.(alpha, dt, now);
  }
}
