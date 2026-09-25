// Layout padrão dos controles de toque (celular/tablet). Coordenadas normalizadas (0..1) da tela;
// raio em fração do menor lado da tela. O editor de layout (Fase 10) grava a versão do jogador em
// config `controls.touch.layout`; aqui ficam os padrões e as zonas. Cada botão padrão novo entra em
// TOUCH_BUTTONS_SINCE com a versão que o trouxe: layouts salvos antes dela o ganham ao carregar.

export const TOUCH_ZONES = Object.freeze({
  // Joystick flutuante: nasce onde o dedo tocar dentro desta área.
  joystick: Object.freeze({ x0: 0, y0: 0.25, x1: 0.42, y1: 1 }),
});

export const TOUCH_JOYSTICK = Object.freeze({
  radius: 0.11, // raio do curso do polegar (fração do menor lado da tela)
  deadzone: 0.12,
});

export const DEFAULT_TOUCH_BUTTONS = Object.freeze([
  Object.freeze({ id: 'fire', action: 'fire', x: 0.86, y: 0.62, r: 0.085, opacity: 0.8 }),
  Object.freeze({ id: 'fireLeft', action: 'fire', x: 0.08, y: 0.32, r: 0.06, opacity: 0.6 }),
  Object.freeze({ id: 'aim', action: 'aim', x: 0.94, y: 0.44, r: 0.055, opacity: 0.7 }),
  Object.freeze({ id: 'jump', action: 'jump', x: 0.93, y: 0.82, r: 0.065, opacity: 0.75 }),
  Object.freeze({ id: 'crouch', action: 'crouch', x: 0.79, y: 0.88, r: 0.055, opacity: 0.7 }),
  Object.freeze({ id: 'walk', action: 'walk', x: 0.705, y: 0.9, r: 0.04, opacity: 0.65 }),
  Object.freeze({ id: 'reload', action: 'reload', x: 0.72, y: 0.72, r: 0.05, opacity: 0.7 }),
  Object.freeze({ id: 'use', action: 'use', x: 0.66, y: 0.55, r: 0.045, opacity: 0.65 }),
  Object.freeze({ id: 'nextWeapon', action: 'nextWeapon', x: 0.62, y: 0.9, r: 0.05, opacity: 0.65 }),
  Object.freeze({ id: 'slot4', action: 'slot4', x: 0.53, y: 0.9, r: 0.045, opacity: 0.6 }),
  Object.freeze({ id: 'slot3', action: 'slot3', x: 0.44, y: 0.9, r: 0.045, opacity: 0.6 }),
  Object.freeze({ id: 'buyMenu', action: 'buyMenu', x: 0.06, y: 0.1, r: 0.04, opacity: 0.6 }),
  Object.freeze({ id: 'scoreboard', action: 'scoreboard', x: 0.5, y: 0.06, r: 0.04, opacity: 0.55 }),
  Object.freeze({ id: 'pause', action: 'pause', x: 0.95, y: 0.07, r: 0.04, opacity: 0.6 }),
]);

/** Versão do layout padrão (2: botão de andar silencioso, Fase 3.2). */
export const TOUCH_LAYOUT_VERSION = 2;

/** Botões padrão acrescentados em cada versão (ids de DEFAULT_TOUCH_BUTTONS). */
export const TOUCH_BUTTONS_SINCE = Object.freeze({ 2: Object.freeze(['walk']) });

export function defaultTouchLayout() {
  return { version: TOUCH_LAYOUT_VERSION, buttons: DEFAULT_TOUCH_BUTTONS.map((b) => ({ ...b })) };
}
