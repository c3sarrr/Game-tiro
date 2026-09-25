// Tela de carregamento (estado boot): título de massinha, barra de "massa sendo esticada" e status.

import { h } from './dom.js';
import { deskBackdrop, clayTitle } from './screens.js';

export function createBootScreen(root) {
  const bar = h('div.boot-bar-fill');
  const status = h('p.boot-status', { role: 'status' }, 'Abrindo o estúdio…');
  const el = h('section.screen.boot', null,
    deskBackdrop(),
    h('div.boot-center', null,
      clayTitle('MASSACRE'),
      h('div.boot-bar', { role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': 100 }, bar),
      status,
    ),
  );
  root.append(el);
  return {
    el,
    set(progress, text) {
      const p = Math.max(0, Math.min(1, progress));
      bar.style.setProperty('--p', String(p));
      el.querySelector('.boot-bar').setAttribute('aria-valuenow', String(Math.round(p * 100)));
      if (text) status.textContent = text;
    },
    remove() {
      el.classList.add('is-leaving');
      setTimeout(() => el.remove(), 260);
    },
  };
}
