// HUD do modo livre: mira simples, etiqueta de status (cheats), aviso "clique para jogar" no PC e a dica de controles
// que some sozinha — de andar (mapa com colisão) ou de voar (vitrine). Andando, mostra o item na mão (etiqueta de fita
// crepe) e "ANDANDO" sob a mira com o andar silencioso ligado. O HUD completo de massinha chega na Fase 10.

import { h } from './dom.js';
import { EV } from '../core/events.js';

const HINTS = Object.freeze({
  andar: Object.freeze({
    kbm: 'WASD anda · Shift silencioso · Espaço pula · Ctrl agacha · 1–5, roda e Q trocam · botão direito: luneta'
      + ' · ` console (noclip voa) · F3 desempenho',
    gamepad: 'Analógico E anda · Analógico D olha · A/✕ pula · B/○ agacha · L3 liga/desliga o andar · Y/△ troca'
      + ' · LT/L2 luneta · Options pausa',
    touch: 'Joystick à esquerda anda · arraste à direita para olhar · botões pulam, agacham, trocam de arma e ligam'
      + ' o andar silencioso',
  }),
  voo: Object.freeze({
    kbm: 'WASD mover · Espaço/Ctrl subir/descer · Shift devagar · botão direito acelera · ` console · F3 desempenho',
    gamepad: 'Analógico E mover · Analógico D olhar · A/✕ sobe · B/○ desce · L3 devagar · LT/L2 acelera · Options pausa',
    touch: 'Joystick à esquerda · arraste à direita para olhar · pular/agachar sobem e descem',
  }),
});

/** @param {{title: string, mode?: 'andar'|'voo'}} opts */
export function createSandboxHud(services, { title, mode = 'voo' }) {
  const { events, cheats, input, uiRoot } = services;
  const hints = HINTS[mode] ?? HINTS.voo;
  const status = h('span.hud-status');
  const held = h('span.tape-label.hud-held', { hidden: true });
  const walk = h('span.hud-walk', { hidden: true }, 'ANDANDO');
  const hint = h('p.hud-hint');
  const prompt = h('button.hud-prompt', { type: 'button', hidden: true }, 'Clique para jogar');
  const root = h('div.hud', null,
    h('div.crosshair', { 'aria-hidden': 'true' }, h('i.ch-dot'), h('i.ch-l'), h('i.ch-r'), h('i.ch-t'), h('i.ch-b')),
    h('div.hud-top', null, h('span.tape-label.hud-title', null, title), held, status),
    walk,
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
    hint.textContent = hints[input.device] ?? hints.kbm;
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
    /** Item na mão (texto da etiqueta; null esconde). */
    setHeld(text) {
      held.hidden = !text;
      if (text && held.textContent !== text) held.textContent = text;
    },
    /** Andar silencioso ligado (a cada quadro: só mexe no DOM quando muda). */
    setWalking(on) {
      if (walk.hidden === on) walk.hidden = !on;
    },
    dispose() {
      clearTimeout(hintTimer);
      for (const off of offs) off();
      root.remove();
    },
  };
}
