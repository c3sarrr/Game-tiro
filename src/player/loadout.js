// Inventário do jogador (regras do CS): 1 primária, 1 pistola, faca, até 4 granadas (máx. 2 flashes, 1 de cada
// outra), colete/capacete, kit de desarme (CT) e a bomba (TR). A loja (Fase 8), o `give` do console e o
// Gun Game usam estas mesmas regras. O item na mão fica em src/player/hands.js (Fase 3.2); munição e estado de cada
// arma ficam no sistema de armas (Fase 4).

import { BOMB, WEAPONS } from '../data/weapons.js';
import { UTILITIES, GRENADE_LIMITS } from '../data/economy.js';

export class Loadout {
  constructor({ team = null } = {}) {
    this.team = team;
    this.primary = null;
    this.secondary = null;
    this.melee = 'knife';
    this.grenades = []; // ordem de compra (a roda de granadas segue essa ordem)
    this.armor = 0; // 0..100
    this.helmet = false;
    this.defuseKit = false;
    this.bomb = false;
  }

  /** Pode carregar esta arma? `ignoreTeam` para cheats/Gun Game. */
  canCarry(weaponId, { ignoreTeam = false } = {}) {
    const w = WEAPONS[weaponId];
    if (!w) return { ok: false, reason: `arma desconhecida: ${weaponId}` };
    if (!ignoreTeam && w.team && this.team && w.team !== this.team) {
      return { ok: false, reason: `${w.name} é exclusiva do outro time` };
    }
    return { ok: true };
  }

  /**
   * Coloca a arma no slot dela. Se já houver uma arma no slot, ela é devolvida em `dropped`
   * (o jogo a larga no chão).
   */
  give(weaponId, { ignoreTeam = false } = {}) {
    const check = this.canCarry(weaponId, { ignoreTeam });
    if (!check.ok) return check;
    const w = WEAPONS[weaponId];
    const slot = w.slot;
    const dropped = slot === 'melee' ? null : this[slot];
    this[slot] = weaponId;
    return { ok: true, slot, dropped: dropped && dropped !== weaponId ? dropped : null };
  }

  /** Granadas e equipamentos (colete, capacete, kit). */
  giveUtility(utilId) {
    const u = UTILITIES[utilId];
    if (!u) return { ok: false, reason: `item desconhecido: ${utilId}` };
    if (u.team && this.team && u.team !== this.team) return { ok: false, reason: `${u.name} é do outro time` };
    if (u.kind === 'grenade') {
      if (this.grenades.length >= GRENADE_LIMITS.total) return { ok: false, reason: 'limite de 4 granadas' };
      const count = this.grenades.filter((g) => g === utilId).length;
      if (count >= (GRENADE_LIMITS.perType[utilId] ?? 1)) return { ok: false, reason: `limite de ${u.name}` };
      this.grenades.push(utilId);
      return { ok: true, slot: 'grenade' };
    }
    switch (utilId) {
      case 'kevlar':
        if (this.armor >= 100) return { ok: false, reason: 'colete já está inteiro' };
        this.armor = 100;
        return { ok: true, slot: 'armor' };
      case 'kevlarHelmet':
        if (this.armor >= 100 && this.helmet) return { ok: false, reason: 'já tem colete e capacete' };
        this.armor = 100;
        this.helmet = true;
        return { ok: true, slot: 'armor' };
      case 'defuseKit':
        if (this.defuseKit) return { ok: false, reason: 'já tem kit' };
        this.defuseKit = true;
        return { ok: true, slot: 'kit' };
      default:
        return { ok: false, reason: `item sem regra: ${utilId}` };
    }
  }

  /** A bomba (C4) do TR: uma só. `ignoreTeam` para cheats. */
  giveBomb({ ignoreTeam = false } = {}) {
    if (!ignoreTeam && this.team && this.team !== BOMB.team) return { ok: false, reason: 'a bomba é do TR' };
    if (this.bomb) return { ok: false, reason: 'já está com a bomba' };
    this.bomb = true;
    return { ok: true, slot: 'c4' };
  }

  /** Tipos de granada na ordem em que entraram (a tecla 4 e a roda de troca seguem esta ordem). */
  grenadeTypes() {
    return [...new Set(this.grenades)];
  }

  removeGrenade(utilId) {
    const i = this.grenades.indexOf(utilId);
    if (i >= 0) this.grenades.splice(i, 1);
    return i >= 0;
  }

  /** Remove a arma do slot e devolve o id (para largar no chão). A faca não sai. */
  drop(slot) {
    if (slot === 'melee') return null;
    const id = this[slot];
    this[slot] = null;
    return id;
  }

  /** Estado padrão de nascimento no Competitivo: faca + pistola do time. */
  resetForRound() {
    this.primary = null;
    this.secondary = this.team === 'ct' ? 'usps' : this.team === 'tr' ? 'glock' : 'p250';
    this.melee = 'knife';
    this.grenades = [];
    this.armor = 0;
    this.helmet = false;
    this.defuseKit = false;
    this.bomb = false;
  }

  toJSON() {
    return {
      team: this.team, primary: this.primary, secondary: this.secondary, melee: this.melee,
      grenades: [...this.grenades], armor: this.armor, helmet: this.helmet, defuseKit: this.defuseKit, bomb: this.bomb,
    };
  }

  static fromJSON(data) {
    const l = new Loadout({ team: data.team ?? null });
    Object.assign(l, {
      primary: data.primary ?? null, secondary: data.secondary ?? null, melee: data.melee ?? 'knife',
      grenades: [...(data.grenades ?? [])], armor: data.armor ?? 0, helmet: !!data.helmet,
      defuseKit: !!data.defuseKit, bomb: !!data.bomb,
    });
    return l;
  }

  describe() {
    const name = (id) => (id ? WEAPONS[id]?.name ?? id : '—');
    const nades = this.grenades.map((g) => UTILITIES[g]?.name ?? g).join(', ') || '—';
    return `primária: ${name(this.primary)} · pistola: ${name(this.secondary)} · faca: ${name(this.melee)}` +
      ` · granadas: ${nades} · colete: ${this.armor}${this.helmet ? ' + capacete' : ''}` +
      `${this.bomb ? ' · bomba' : ''}`;
  }
}
