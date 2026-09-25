// Trinco de ação por dispositivo (Fase 3.2): "segurar" vale enquanto o botão está apertado; "alternar" liga e desliga a
// cada aperto. As ações que podem alternar (o andar silencioso: `toggle` em src/data/actions.js) têm um trinco por
// dispositivo, cada um no modo escolhido para ele, e valem se qualquer um estiver ligado. Só o aperto registrado pelo
// dispositivo (o latch) troca o alternado: segurar o botão durante uma troca de contexto não liga nada sozinho. Funções
// puras: o InputManager passa o estado de cada dispositivo a cada tick.

import { TOGGLE_MODE } from '../data/actions.js';

/** Dispositivos com trinco próprio (os nomes do InputManager.device). */
export const TOGGLE_DEVICES = Object.freeze(['kbm', 'gamepad', 'touch']);

export function createToggle() {
  return { on: false };
}

/**
 * Um tick do trinco. `down`: o botão vale neste tick (apertado agora ou tocado desde o último tick); `pressed`: apertou
 * desde o último tick. Devolve se a ação está ligada.
 */
export function stepToggle(t, down, pressed, mode) {
  if (mode === TOGGLE_MODE.TOGGLE) {
    if (pressed) t.on = !t.on;
  } else {
    t.on = down;
  }
  return t.on;
}

export function resetToggle(t) {
  t.on = false;
  return t;
}

/** Trincos de uma ação nos três dispositivos. */
export function createToggleSet() {
  return { kbm: createToggle(), gamepad: createToggle(), touch: createToggle() };
}

/**
 * Um tick da ação nos três dispositivos. `input[device]`: {value, pressed} daquele dispositivo; `modes[device]`: o modo
 * dele. Devolve se a ação vale (algum trinco ligado).
 */
export function stepToggleSet(set, input, modes) {
  let on = false;
  for (const d of TOGGLE_DEVICES) {
    const i = input[d];
    if (stepToggle(set[d], i.value > 0 || i.pressed, i.pressed, modes[d])) on = true;
  }
  return on;
}

/** Trocou de dispositivo: o alternado dos outros desliga (não fica andando por um controle largado). */
export function keepToggleDevice(set, device) {
  for (const d of TOGGLE_DEVICES) if (d !== device) resetToggle(set[d]);
  return set;
}

export function resetToggleSet(set) {
  for (const d of TOGGLE_DEVICES) resetToggle(set[d]);
  return set;
}
