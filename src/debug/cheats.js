// Estado dos cheats de desenvolvimento (console). Só o host pode ativá-los numa partida online (Fase 9).
//   god    — imortal: o sistema de dano ignora dano recebido pelo jogador local
//   noclip — atravessa geometria e voa (controlador de personagem/câmera ignora colisão e gravidade)

import { EV } from '../core/events.js';

export class Cheats {
  constructor(events) {
    this.events = events;
    this.god = false;
    this.noclip = false;
  }

  set(name, value) {
    if (!(name in this) || typeof this[name] !== 'boolean') throw new Error(`cheat desconhecido: ${name}`);
    this[name] = Boolean(value);
    this.events.emit(EV.CHEAT, { name, value: this[name] });
    return this[name];
  }

  toggle(name) {
    return this.set(name, !this[name]);
  }

  reset() {
    this.set('god', false);
    this.set('noclip', false);
  }
}
