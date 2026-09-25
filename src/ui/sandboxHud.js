// HUD da sala de testes: mira simples, etiqueta de status (cheats, dispositivo), aviso "clique para jogar"
// no PC e dica de controles que some sozinha. O HUD completo de massinha chega na Fase 10.

import { h } from './dom.js';
import { EV } from '../core/events.js';

const HINTS = {
  kbm: 'WASD mover · Espaço/Ctrl subir/descer · Shift devagar · botão direito acelera · ` console · F3 desempenho',
  gamepad: 'Analógico E mover · Analógico D olhar · A/✕ sobe · B/○ desce · L3 devagar · LT/L2 acelera · Options pausa',
  touch: 'Joystick à esquerda · arraste à direita para olhar · pular/agachar sobem e descem',
};

export function createSandboxHud(services, { title }) {
  const { events, cheats, input, uiRoot } = services;
  const status = h('span.hud-status');
  const hint = h('p.hud-hint');
  const prompt = h('button.hud-prompt', { type: 'button', hidden: true }, 'Clique para jogar');
  const root = h('div.hud', null,
    h('div.crosshair', { 'aria-hidden': 'true' }, h('i.ch-dot'), h('i.ch-l'), h('i.ch-r'), h('i.ch-t'), h('i.ch-b')),
    h('div.hud-top', null, h('span.tape-label.hud-title', null, title), status),
    prompt,
    hint,
  );
  uiRoot.append(root);

  const syncStatus = () => {
    const flags = [];
    if (cheats.noclip) flags.push('noclip');
    if (cheats.god) flags.push('god');
    status.textContent = flags.length ? `cheats: ${flags.join(' · ')}` : '';
    status.hidden = !flags.length;
  };
  let hintTimer = 0;
  const syncHint = () => {
    hint.textContent = HINTS[input.device] ?? HINTS.kbm;
    hint.classList.remove('is-faded');
    clearTimeout(hintTimer);
    hintTimer = setTimeout(() => hint.classList.add('is-faded'), 7000);
  };
  syncStatus();
  syncHint();
  const offs = [events.on(EV.CHEAT, syncStatus), events.on(EV.INPUT_DEVICE, syncHint)];

  return {
    root,
    prompt,
    setPromptVisible(v) {
      prompt.hidden = !v;
    },
    setVisible(v) {
      root.hidden = !v;
    },
    dispose() {
      clearTimeout(hintTimer);
      for (const off of offs) off();
      root.remove();
    },
  };
}
