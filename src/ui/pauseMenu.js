// Menu de pausa da partida (Esc / Options / botão de pausa no toque).
// No PC, "Continuar" precisa de um clique ou Enter para o navegador devolver o pointer lock.
// "Tela cheia" liga também o Keyboard Lock (Chromium): Ctrl+W, Ctrl+T etc. passam a chegar ao jogo.

import { h } from './dom.js';

export function createPauseMenu(services, { onResume, onSettings, onEnd, onQuit }) {
  const { input } = services;
  const fsSupported = !!document.fullscreenEnabled;
  const fsButton = fsSupported
    ? h('button.btn-clay', {
      type: 'button',
      onclick: async () => {
        if (input.fullscreen) await input.exitFullscreen();
        else await input.enterFullscreen();
        syncFs();
      },
    })
    : null;
  const syncFs = () => {
    if (fsButton) fsButton.textContent = input.fullscreen ? 'Sair da tela cheia' : 'Tela cheia';
  };
  syncFs();
  document.addEventListener('fullscreenchange', syncFs);

  const root = h('div.pause', { role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Pausado', hidden: true },
    h('div.pause-card', null,
      h('span.tape.is-tl', { 'aria-hidden': 'true' }),
      h('h2.card-title', null, 'Pausado'),
      h('div.pause-buttons', null,
        h('button.btn-clay.is-primary.is-big', { type: 'button', 'data-autofocus': true, onclick: () => onResume() }, 'Continuar'),
        fsButton,
        h('button.btn-clay', { type: 'button', onclick: () => onSettings() }, 'Configurações'),
        h('button.btn-clay', { type: 'button', onclick: () => onEnd() }, 'Encerrar sessão'),
        h('button.btn-clay.is-danger', { type: 'button', onclick: () => onQuit() }, 'Menu principal'),
      ),
    ),
  );
  services.uiRoot.append(root);
  let popNav = null;

  return {
    root,
    get visible() {
      return !root.hidden;
    },
    show() {
      if (!root.hidden) return;
      syncFs();
      root.hidden = false;
      popNav = services.focusNav.push(root, { onBack: () => onResume() });
    },
    hide() {
      if (root.hidden) return;
      root.hidden = true;
      popNav?.();
      popNav = null;
    },
    dispose() {
      document.removeEventListener('fullscreenchange', syncFs);
      popNav?.();
      popNav = null;
      root.remove();
    },
  };
}
