// Estado "menu": menu principal na bancada do animador (versão DOM até a Fase 10 trazer a bancada 3D).

import { h } from './dom.js';
import { deskBackdrop, clayTitle, deviceChip, BUILD_LABEL } from './screens.js';
import { openSettings } from './settingsScreen.js';
import { CONTEXT } from '../input/inputManager.js';

export class MenuState {
  constructor(services) {
    this.s = services;
    this.root = null;
    this.offs = [];
  }

  enter() {
    const s = this.s;
    s.input.setContext(CONTEXT.UI);
    const chip = deviceChip(s);
    this.offs.push(chip.dispose);
    const btn = (label, onclick, extra = '') =>
      h(`button.btn-clay${extra}`, { type: 'button', onclick }, label);

    this.root = h('section.screen.menu', null,
      deskBackdrop(),
      h('div.menu-card', null,
        h('span.tape.is-tl', { 'aria-hidden': 'true' }),
        h('span.tape.is-tr', { 'aria-hidden': 'true' }),
        clayTitle('MASSACRE'),
        h('p.menu-tagline', null, 'Tiroteio de massinha num set de stop-motion'),
        h('nav.menu-buttons', { 'aria-label': 'Menu principal' },
          h('button.btn-clay.is-primary.is-big', { type: 'button', 'data-autofocus': true, onclick: () => s.states.go('lobby') }, 'Jogar'),
          btn('Sala de testes', () => s.states.go('match', { map: 'testroom', mode: 'livre' })),
          // Parque de estações da Fase 3 (3.3): os números do movimento com objetos de verdade; `estacao` teleporta.
          btn('Pista de testes', () => s.states.go('match', { map: 'pista', mode: 'livre' })),
          // Bancada de prova do look de massinha (Fase 2): 20 objetos, painel de luz no Tab, varredura de presets.
          btn('Vitrine de massinha', () => s.states.go('match', { map: 'vitrine', mode: 'livre' })),
          btn('Configurações', () => openSettings(s)),
          btn('Controles', () => openSettings(s, { tab: 'teclas' })),
        ),
      ),
      h('footer.menu-foot', null,
        chip.el,
        h('span.menu-hint', null, 'Console: tecla ` ou F1 · Desempenho: F3'),
        h('span.menu-build', null, BUILD_LABEL),
      ),
    );
    s.uiRoot.append(this.root);
    this.offs.push(s.focusNav.push(this.root));
  }

  exit() {
    for (const off of this.offs) off();
    this.offs = [];
    this.root?.remove();
    this.root = null;
  }
}
