// Mapeamento padrão de teclas/botões (estilo Counter-Strike no teclado; layout de console no controle).
// Formato de binding (string):
//   'key:<KeyboardEvent.code>'   ex.: 'key:KeyW', 'key:Space' (posição física → funciona em ABNT2/AZERTY)
//   'mouse:<botão>'              0 esquerdo, 1 meio, 2 direito, 3 voltar, 4 avançar
//   'wheel:up' | 'wheel:down'
//   'pad:button:<índice>'        mapeamento "standard" da Gamepad API
//   'pad:axis:<índice><+|->'     meia-direção de um eixo (ex.: 'pad:axis:1-' = analógico esquerdo para cima)
// Cada ação tem duas listas: kbm (teclado+mouse) e pad (controle). O touch usa src/data/touchLayout.js.

export const PAD = Object.freeze({
  // Índices do mapeamento standard (W3C Gamepad).
  A: 0, B: 1, X: 2, Y: 3, // Cruz, Círculo, Quadrado, Triângulo no PlayStation
  LB: 4, RB: 5, LT: 6, RT: 7, // L1, R1, L2, R2
  BACK: 8, START: 9, // Create/Share/View, Options/Menu
  L3: 10, R3: 11,
  UP: 12, DOWN: 13, LEFT: 14, RIGHT: 15,
  HOME: 16, TOUCHPAD: 17,
  AXIS_LX: 0, AXIS_LY: 1, AXIS_RX: 2, AXIS_RY: 3,
});

export const DEFAULT_BINDINGS = Object.freeze({
  moveForward: { kbm: ['key:KeyW'], pad: ['pad:axis:1-'] },
  moveBack: { kbm: ['key:KeyS'], pad: ['pad:axis:1+'] },
  moveLeft: { kbm: ['key:KeyA'], pad: ['pad:axis:0-'] },
  moveRight: { kbm: ['key:KeyD'], pad: ['pad:axis:0+'] },
  jump: { kbm: ['key:Space'], pad: [`pad:button:${PAD.A}`] },
  crouch: { kbm: ['key:ControlLeft', 'key:KeyC'], pad: [`pad:button:${PAD.B}`] },
  walk: { kbm: ['key:ShiftLeft'], pad: [`pad:button:${PAD.L3}`] },

  fire: { kbm: ['mouse:0'], pad: [`pad:button:${PAD.RT}`] },
  aim: { kbm: ['mouse:2'], pad: [`pad:button:${PAD.LT}`] },
  reload: { kbm: ['key:KeyR'], pad: [`pad:button:${PAD.X}`] },
  use: { kbm: ['key:KeyE'], pad: [`pad:button:${PAD.RB}`] },
  inspect: { kbm: ['key:KeyF'], pad: [`pad:button:${PAD.DOWN}`] },

  slot1: { kbm: ['key:Digit1'], pad: [] },
  slot2: { kbm: ['key:Digit2'], pad: [] },
  slot3: { kbm: ['key:Digit3'], pad: [`pad:button:${PAD.R3}`] },
  slot4: { kbm: ['key:Digit4'], pad: [`pad:button:${PAD.LB}`] },
  slot5: { kbm: ['key:Digit5'], pad: [] },
  nextWeapon: { kbm: ['wheel:down'], pad: [`pad:button:${PAD.Y}`] },
  prevWeapon: { kbm: ['wheel:up'], pad: [] },
  lastWeapon: { kbm: ['key:KeyQ'], pad: [`pad:button:${PAD.RIGHT}`] },
  drop: { kbm: ['key:KeyG'], pad: [`pad:button:${PAD.LEFT}`] },

  buyMenu: { kbm: ['key:KeyB'], pad: [`pad:button:${PAD.UP}`] },
  scoreboard: { kbm: ['key:Tab'], pad: [`pad:button:${PAD.BACK}`, `pad:button:${PAD.TOUCHPAD}`] },
  chatAll: { kbm: ['key:KeyY'], pad: [] },
  chatTeam: { kbm: ['key:KeyU'], pad: [] },
  voice: { kbm: ['key:KeyV'], pad: [] },
  pause: { kbm: ['key:Escape', 'key:KeyP'], pad: [`pad:button:${PAD.START}`] },

  console: { kbm: ['key:Backquote', 'key:F1'], pad: [] },
  debugOverlay: { kbm: ['key:F3'], pad: [] },
});

/** Cópia profunda editável dos binds padrão (usada como default da config). */
export function defaultBindings() {
  return structuredClone(DEFAULT_BINDINGS);
}
