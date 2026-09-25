// Estado "lobby": montagem local da sala (mapa e participantes). Na Fase 9 ganha salas online
// (jogo rápido, pública, privada, código e convite) sobre esta mesma tela.

import { h, clear } from './dom.js';
import { deskBackdrop, deviceChip } from './screens.js';
import { listMaps } from '../maps/index.js';
import { EV } from '../core/events.js';
import { CONTEXT } from '../input/inputManager.js';

export class LobbyState {
  constructor(services) {
    this.s = services;
    this.root = null;
    this.offs = [];
    this.selected = null;
  }

  enter(params = {}) {
    const s = this.s;
    s.input.setContext(CONTEXT.UI);
    const maps = listMaps();
    this.selected = params.map ?? this.selected ?? maps[0]?.id ?? null;
    const chip = deviceChip(s);
    this.offs.push(chip.dispose);

    const mapList = h('div.map-list', { role: 'radiogroup', 'aria-label': 'Mapa' });
    const cards = maps.map((m) => {
      const card = h('button.map-card', {
        type: 'button', role: 'radio', dataset: { map: m.id },
        onclick: () => {
          this.selected = m.id;
          syncMaps();
        },
      },
      h('span.map-card-kind', null, m.kind),
      h('strong.map-card-name', null, m.label),
      h('span.map-card-desc', null, m.description));
      mapList.append(card);
      return card;
    });
    // Só alterna classes: recriar os botões tiraria o foco de quem navega por controle/teclado.
    const syncMaps = () => {
      for (const card of cards) {
        const on = card.dataset.map === this.selected;
        card.classList.toggle('is-on', on);
        card.setAttribute('aria-checked', on ? 'true' : 'false');
      }
    };
    syncMaps();

    // O jogador local entra na lista antes do primeiro desenho (e antes de assinar EV.ROSTER).
    if (!s.roster.humans.some((p) => p.local)) s.roster.addHuman({ name: 'Você', local: true });
    const people = h('ul.roster-list');
    const renderRoster = () => {
      clear(people);
      for (const p of s.roster.participants) {
        people.append(h(`li.roster-item.is-${p.kind}`, null,
          h('span.roster-name', null, p.name),
          h('span.roster-tag', null, p.kind === 'bot' ? `bot · nível ${s.roster.levelOf(p)} · ${p.profile}` : p.local ? 'você' : 'jogador'),
        ));
      }
    };
    renderRoster();
    this.offs.push(s.events.on(EV.ROSTER, renderRoster));

    this.root = h('section.screen.lobby', null,
      deskBackdrop(),
      h('div.lobby-card', null,
        h('span.tape.is-tl', { 'aria-hidden': 'true' }),
        h('h2.card-title', null, 'Montar a sala'),
        h('div.lobby-grid', null,
          h('div.lobby-col', null, h('h3.col-title', null, 'Mapa'), mapList),
          h('div.lobby-col', null,
            h('h3.col-title', null, `Participantes (máx. ${s.roster.max})`),
            people,
            h('p.lobby-note', null, 'Bots entram pelo console (bot_add) e ganham corpo e IA nas próximas fases.'),
          ),
        ),
        h('div.lobby-actions', null,
          h('button.btn-clay', { type: 'button', onclick: () => s.states.go('menu') }, 'Voltar'),
          h('button.btn-clay.is-primary.is-big', {
            type: 'button', 'data-autofocus': true,
            onclick: () => this.selected && s.states.go('match', { map: this.selected, mode: 'livre' }),
          }, 'Começar'),
        ),
      ),
      h('footer.menu-foot', null, chip.el),
    );
    s.uiRoot.append(this.root);
    this.offs.push(s.focusNav.push(this.root, { onBack: () => s.states.go('menu') }));
  }

  exit() {
    for (const off of this.offs) off();
    this.offs = [];
    this.root?.remove();
    this.root = null;
  }
}
