// Estado "resultado": resumo da sessão/partida. Na Fase 8 recebe MVP, placar, estatísticas e XP.

import { h } from './dom.js';
import { deskBackdrop } from './screens.js';
import { getMapDef } from '../maps/index.js';
import { CONTEXT } from '../input/inputManager.js';

const DEVICE_LABELS = { kbm: 'teclado e mouse', gamepad: 'controle', touch: 'toque' };

function formatDuration(s) {
  const m = Math.floor(s / 60);
  const r = Math.floor(s % 60);
  return `${m}:${String(r).padStart(2, '0')}`;
}

export class ResultState {
  constructor(services) {
    this.s = services;
    this.root = null;
    this.offs = [];
  }

  enter(params = {}) {
    const s = this.s;
    s.input.setContext(CONTEXT.UI);
    const sum = params.summary ?? {};
    const map = getMapDef(sum.map);
    const stat = (label, value) => h('div.stat', null, h('span.stat-label', null, label), h('strong.stat-value', null, value));
    const devices = (sum.devices ?? []).map((d) => DEVICE_LABELS[d] ?? d).join(', ') || '—';

    this.root = h('section.screen.result', null,
      deskBackdrop(),
      h('div.result-card', null,
        h('span.tape.is-tr', { 'aria-hidden': 'true' }),
        h('h2.card-title', null, 'Fim da sessão'),
        h('p.result-sub', null, map ? map.label : sum.map ?? ''),
        h('div.stats', null,
          stat('Tempo', formatDuration(sum.durationS ?? 0)),
          stat('Distância percorrida', `${((sum.distance ?? 0) / 100).toFixed(1)} m de boneco`),
          stat('Velocidade máxima', `${Math.round(sum.topSpeed ?? 0)} u/s`),
          stat('Ticks simulados', String(sum.ticks ?? 0)),
          stat('Entradas usadas', devices),
        ),
        h('div.result-actions', null,
          h('button.btn-clay', { type: 'button', onclick: () => s.states.go('menu') }, 'Menu'),
          h('button.btn-clay', { type: 'button', onclick: () => s.states.go('lobby', { map: sum.map }) }, 'Lobby'),
          h('button.btn-clay.is-primary', {
            type: 'button', 'data-autofocus': true,
            onclick: () => s.states.go('match', { map: sum.map ?? 'testroom', mode: sum.mode ?? 'livre' }),
          }, 'Jogar de novo'),
        ),
      ),
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
