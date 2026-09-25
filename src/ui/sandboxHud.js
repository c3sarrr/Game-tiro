// HUD do modo livre: mira simples, etiqueta de status (cheats), aviso "clique para jogar" no PC e a dica de controles
// que some sozinha — de andar (mapa com colisão) ou de voar (vitrine); em mapa com estações (pista de testes) a dica do
// teclado cita o `estacao` do console. Andando, mostra o item na mão e a vida com o colete (etiquetas de fita crepe;
// ao tomar dano a vida pisca e "−26" aparece por um instante), "ANDANDO" sob a mira com o andar silencioso ligado e, morto,
// a etiqueta da causa acima da mira com a contagem da volta (subfase 3.4). O HUD completo de massinha chega na Fase 10.

import { h } from './dom.js';
import { EV } from '../core/events.js';
import { DEATH_CAUSES, VITALS } from '../data/vitals.js';

const HINTS = Object.freeze({
  andar: Object.freeze({
    kbm: 'WASD anda · Shift silencioso · Espaço pula (no ar, perto da parede: wall-jump) · Ctrl agacha (correndo:'
      + ' slide) · 1–5, roda e Q trocam · botão direito: luneta · ` console (noclip voa) · F3 desempenho',
    gamepad: 'Analógico E anda · Analógico D olha · A/✕ pula (no ar, perto da parede: wall-jump) · B/○ agacha'
      + ' (correndo: slide) · L3 liga/desliga o andar · Y/△ troca · LT/L2 luneta · Options pausa',
    touch: 'Joystick à esquerda anda · arraste à direita para olhar · botões pulam (no ar, perto da parede:'
      + ' wall-jump), agacham (correndo: slide), trocam de arma e ligam o andar silencioso',
  }),
  voo: Object.freeze({
    kbm: 'WASD mover · Espaço/Ctrl subir/descer · Shift devagar · botão direito acelera · ` console · F3 desempenho',
    gamepad: 'Analógico E mover · Analógico D olhar · A/✕ sobe · B/○ desce · L3 devagar · LT/L2 acelera · Options pausa',
    touch: 'Joystick à esquerda · arraste à direita para olhar · pular/agachar sobem e descem',
  }),
});

// O console só existe no teclado: a dica das estações entra na linha do teclado.
const STATIONS_HINT = ' · estacao no console lista as estações e teleporta (estacao 7 900)';

/** @param {{title: string, mode?: 'andar'|'voo', stations?: boolean}} opts */
export function createSandboxHud(services, { title, mode = 'voo', stations = false }) {
  const { events, cheats, input, uiRoot } = services;
  const base = HINTS[mode] ?? HINTS.voo;
  const hints = stations ? { ...base, kbm: base.kbm + STATIONS_HINT } : base;
  const status = h('span.hud-status');
  const held = h('span.tape-label.hud-held', { hidden: true });
  const vitals = h('span.tape-label.hud-vitals', { hidden: true });
  const hurt = h('span.hud-hurt', { hidden: true, 'aria-hidden': 'true' });
  const walk = h('span.hud-walk', { hidden: true }, 'ANDANDO');
  const deathCause = h('span.tape-label.hud-death-cause');
  const deathTimer = h('span.hud-death-timer');
  const death = h('div.hud-death', { hidden: true, role: 'status' }, deathCause, deathTimer);
  const hint = h('p.hud-hint');
  const prompt = h('button.hud-prompt', { type: 'button', hidden: true }, 'Clique para jogar');
  const root = h('div.hud', null,
    h('div.crosshair', { 'aria-hidden': 'true' }, h('i.ch-dot'), h('i.ch-l'), h('i.ch-r'), h('i.ch-t'), h('i.ch-b')),
    h('div.hud-top', null, h('span.tape-label.hud-title', null, title), held, vitals, hurt, status),
    walk,
    prompt,
    death,
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
  let hurtTimer = 0;
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
    /** Vida e colete (etiqueta de fita ao lado do item na mão). */
    setVitals(health, armor) {
      const text = `vida ${health} · colete ${armor}`;
      vitals.hidden = false;
      if (vitals.textContent !== text) vitals.textContent = text;
    },
    /** Dano recebido: a etiqueta da vida pisca e "−n" aparece ao lado por VITALS.damageFlash s. */
    flashDamage(amount) {
      hurt.textContent = `−${amount}`;
      hurt.hidden = false;
      vitals.classList.remove('is-hit');
      void vitals.offsetWidth; // recomeça a animação a cada dano
      vitals.classList.add('is-hit');
      clearTimeout(hurtTimer);
      hurtTimer = setTimeout(() => {
        hurt.hidden = true;
        vitals.classList.remove('is-hit');
      }, VITALS.damageFlash * 1000);
    },
    /**
     * Morte (a cada quadro: só mexe no DOM quando muda): a causa (src/data/vitals.js, DEATH_CAUSES) e os segundos até
     * voltar, acima da mira; `cause` null esconde.
     */
    setDeath(cause, left = 0) {
      if (!cause) {
        if (!death.hidden) death.hidden = true;
        return;
      }
      const text = DEATH_CAUSES[cause] ?? cause;
      const timer = `volta em ${Math.max(1, Math.ceil(left - 1e-6))} s`;
      if (deathCause.textContent !== text) deathCause.textContent = text;
      if (deathTimer.textContent !== timer) deathTimer.textContent = timer;
      if (death.hidden) death.hidden = false;
    },
    dispose() {
      clearTimeout(hintTimer);
      clearTimeout(hurtTimer);
      for (const off of offs) off();
      root.remove();
    },
  };
}
