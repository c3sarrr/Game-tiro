// Participantes da partida (humanos + bots), até 10 (seção 0.8). O host é a autoridade sobre esta lista.
// Bots recebem nome de massinha, perfil de personalidade e nível de IA (global ou individual, 1..10).

import { EV } from '../core/events.js';
import { BOT_NAMES, BOT_PROFILES } from '../data/botNames.js';
import { BOT_LEVEL_MIN, BOT_LEVEL_MAX } from '../data/botLevels.js';

export const MAX_PARTICIPANTS = 10;

let nextId = 1;

export class Roster {
  constructor({ events, rng, max = MAX_PARTICIPANTS }) {
    this.events = events;
    this.rng = rng;
    this.max = max;
    this.participants = [];
    this.globalBotLevel = 5;
  }

  get size() {
    return this.participants.length;
  }

  get bots() {
    return this.participants.filter((p) => p.kind === 'bot');
  }

  get humans() {
    return this.participants.filter((p) => p.kind === 'human');
  }

  get free() {
    return this.max - this.participants.length;
  }

  #emit() {
    this.events.emit(EV.ROSTER, { participants: this.participants.map((p) => ({ ...p })) });
  }

  addHuman({ name, local = false, peerId = null, team = null }) {
    if (this.free <= 0) throw new Error('sala cheia (10 participantes)');
    const p = { id: nextId++, kind: 'human', name: String(name).slice(0, 24), local, peerId, team };
    this.participants.push(p);
    this.#emit();
    return p;
  }

  /**
   * Adiciona até `count` bots (limitado às vagas). `level` null = segue o nível global.
   * @returns {object[]} bots criados
   */
  addBots(count = 1, { level = null, team = null, profile = null } = {}) {
    const n = Math.max(0, Math.min(Math.floor(count), this.free));
    const used = new Set(this.participants.map((p) => p.name));
    const pool = this.rng.shuffle(BOT_NAMES.filter((name) => !used.has(name)));
    const added = [];
    for (let i = 0; i < n; i++) {
      const name = pool[i] ?? `Bolota ${nextId}`;
      const bot = {
        id: nextId++,
        kind: 'bot',
        name,
        team,
        level: level === null ? null : clampLevel(level),
        profile: profile ?? this.rng.pick(BOT_PROFILES).id,
      };
      this.participants.push(bot);
      added.push(bot);
    }
    if (added.length) this.#emit();
    return added;
  }

  /** Remove bots por id/nome, ou todos com 'all'. Devolve quantos saíram. */
  removeBots(which = 'all') {
    const before = this.participants.length;
    const key = String(which).toLowerCase();
    this.participants = this.participants.filter((p) => {
      if (p.kind !== 'bot') return true;
      if (key === 'all' || key === 'todos') return false;
      return String(p.id) !== key && p.name.toLowerCase() !== key;
    });
    const removed = before - this.participants.length;
    if (removed) this.#emit();
    return removed;
  }

  removeParticipant(id) {
    const before = this.participants.length;
    this.participants = this.participants.filter((p) => p.id !== id);
    if (before !== this.participants.length) this.#emit();
  }

  /**
   * Nível de IA: global (todos que seguem o global) ou de um bot específico (id ou nome).
   * @returns {{level:number, affected:number}} `affected` = bots alterados (no global: os que seguem o global)
   */
  setBotLevel(level, which = null) {
    const lv = clampLevel(level);
    let affected = 0;
    if (which === null) {
      this.globalBotLevel = lv;
      affected = this.bots.filter((b) => b.level === null).length;
    } else {
      const key = String(which).toLowerCase();
      for (const p of this.participants) {
        if (p.kind === 'bot' && (String(p.id) === key || p.name.toLowerCase() === key)) {
          p.level = lv;
          affected++;
        }
      }
    }
    if (which === null || affected > 0) this.#emit();
    return { level: lv, affected };
  }

  levelOf(p) {
    return p.level ?? this.globalBotLevel;
  }

  clear() {
    this.participants = [];
    this.#emit();
  }
}

function clampLevel(level) {
  const n = Math.round(Number(level));
  if (!Number.isFinite(n)) return 5;
  return Math.min(BOT_LEVEL_MAX, Math.max(BOT_LEVEL_MIN, n));
}
