// Peças visuais reutilizadas pelas telas (fundo de bancada, título de massinha, chip de dispositivo).
// Até a Fase 10 (menu 3D na bancada real) os menus são DOM desenhado com a mesma linguagem visual:
// tapete de corte, papel creme, fita crepe e botões de massinha.

import { h, clayLetters } from './dom.js';
import { EV } from '../core/events.js';

export function deskBackdrop() {
  return h('div.desk', { 'aria-hidden': 'true' },
    h('div.desk-mat'),
    h('div.desk-lamp'),
    h('div.desk-blob.is-a'),
    h('div.desk-blob.is-b'),
    h('div.desk-blob.is-c'),
    h('div.desk-vignette'),
  );
}

export function clayTitle(word = 'MASSACRE') {
  return h('h1.clay-title', { 'aria-label': word }, clayLetters(word));
}

const DEVICE_LABELS = { kbm: 'Teclado e mouse', gamepad: 'Controle', touch: 'Toque' };

/** Etiqueta que mostra o dispositivo em uso e acompanha as trocas. */
export function deviceChip(services) {
  const { input, events } = services;
  const el = h('span.device-chip');
  const sync = () => {
    const d = input.device;
    el.dataset.device = d;
    el.textContent = d === 'gamepad' && input.pad.connected
      ? `${DEVICE_LABELS[d]} · ${input.pad.type === 'playstation' ? 'PlayStation' : input.pad.type === 'xbox' ? 'Xbox' : input.pad.type === 'switch' ? 'Switch' : 'genérico'}`
      : DEVICE_LABELS[d];
  };
  sync();
  const offs = [events.on(EV.INPUT_DEVICE, sync), events.on(EV.INPUT_GAMEPAD, sync)];
  return { el, dispose: () => offs.forEach((off) => off()) };
}

export const BUILD_LABEL = 'v0.1 · Fase 1 — fundação do motor';
