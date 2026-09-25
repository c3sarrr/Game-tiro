// Rótulos legíveis para bindings: teclas no layout real do jogador (Keyboard Layout Map quando disponível,
// ex.: ABNT2 mostra "Ç"), botões de controle com os ícones corretos (PlayStation ✕○□△ / Xbox A B X Y / Switch).

import { parseBinding } from './bindings.js';

const KEY_LABELS = Object.freeze({
  Space: 'Espaço', ControlLeft: 'Ctrl esq.', ControlRight: 'Ctrl dir.', ShiftLeft: 'Shift esq.', ShiftRight: 'Shift dir.',
  AltLeft: 'Alt', AltRight: 'AltGr', MetaLeft: 'Win/Cmd', MetaRight: 'Win/Cmd dir.', Tab: 'Tab', Escape: 'Esc',
  Enter: 'Enter', NumpadEnter: 'Enter (num)', Backspace: 'Backspace', CapsLock: 'Caps Lock', ArrowUp: '↑',
  ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→', Insert: 'Insert', Delete: 'Delete', Home: 'Home', End: 'End',
  PageUp: 'Page Up', PageDown: 'Page Down', ContextMenu: 'Menu', Backquote: '`', Minus: '-', Equal: '=',
  BracketLeft: '[', BracketRight: ']', Backslash: '\\', Semicolon: ';', Quote: "'", Comma: ',', Period: '.',
  Slash: '/', IntlBackslash: '\\', IntlRo: '/', NumpadAdd: 'Num +', NumpadSubtract: 'Num -',
  NumpadMultiply: 'Num *', NumpadDivide: 'Num /', NumpadDecimal: 'Num ,',
});

const MOUSE_LABELS = Object.freeze(['Botão esquerdo', 'Botão do meio', 'Botão direito', 'Mouse 4 (voltar)', 'Mouse 5 (avançar)']);

export const PAD_BUTTON_LABELS = Object.freeze({
  playstation: Object.freeze(['✕', '○', '□', '△', 'L1', 'R1', 'L2', 'R2', 'Create', 'Options', 'L3', 'R3', '↑', '↓', '←', '→', 'PS', 'Touchpad']),
  xbox: Object.freeze(['A', 'B', 'X', 'Y', 'LB', 'RB', 'LT', 'RT', 'View', 'Menu', 'LS', 'RS', '↑', '↓', '←', '→', 'Xbox', 'Share']),
  switch: Object.freeze(['B', 'A', 'Y', 'X', 'L', 'R', 'ZL', 'ZR', '−', '+', 'L3', 'R3', '↑', '↓', '←', '→', 'Home', 'Captura']),
});

// Eixos: [negativo, positivo] por eixo; nomes curtos dos analógicos por fabricante.
const AXIS_ARROWS = Object.freeze({ 0: ['←', '→'], 1: ['↑', '↓'], 2: ['←', '→'], 3: ['↑', '↓'] });
const STICK_NAMES = Object.freeze({
  playstation: ['L', 'R'],
  xbox: ['LS', 'RS'],
  switch: ['L', 'R'],
  generico: ['Anal. E', 'Anal. D'],
});

/** Estilo de ícones efetivo: a escolha do jogador ou o tipo detectado do controle conectado. */
export function padStyle(configured, detected) {
  if (configured && configured !== 'auto') return configured;
  return detected && detected !== 'generico' ? detected : 'xbox';
}

// Teclas cujo caractere muda com o layout (ABNT2, AZERTY...): o mapa do navegador sabe o caractere real.
const LAYOUT_DEPENDENT = new Set([
  'Backquote', 'Minus', 'Equal', 'BracketLeft', 'BracketRight', 'Backslash', 'Semicolon', 'Quote', 'Comma',
  'Period', 'Slash', 'IntlBackslash', 'IntlRo',
]);

export function keyLabel(code, layoutMap = null) {
  const fromLayout = layoutMap?.get?.(code);
  if (fromLayout && LAYOUT_DEPENDENT.has(code)) return fromLayout.toUpperCase();
  if (KEY_LABELS[code]) return KEY_LABELS[code];
  if (fromLayout) return fromLayout.toUpperCase();
  let m;
  if ((m = /^Key([A-Z])$/.exec(code))) return m[1];
  if ((m = /^Digit(\d)$/.exec(code))) return m[1];
  if ((m = /^Numpad(\d)$/.exec(code))) return `Num ${m[1]}`;
  return code;
}

/** Texto curto para exibir um binding. */
export function bindingLabel(binding, { padType = 'xbox', layoutMap = null } = {}) {
  const p = parseBinding(binding);
  if (!p) return '—';
  switch (p.kind) {
    case 'key':
      return keyLabel(p.code, layoutMap);
    case 'mouse':
      return MOUSE_LABELS[p.button] ?? `Mouse ${p.button + 1}`;
    case 'wheel':
      return p.dir === 'up' ? 'Roda ↑' : 'Roda ↓';
    case 'button': {
      const names = PAD_BUTTON_LABELS[padType];
      return names?.[p.index] ?? `Botão ${p.index}`;
    }
    case 'axis': {
      const arrows = AXIS_ARROWS[p.index];
      if (!arrows) return `Eixo ${p.index}${p.sign > 0 ? '+' : '−'}`;
      const stick = (STICK_NAMES[padType] ?? STICK_NAMES.generico)[p.index < 2 ? 0 : 1];
      return `${stick} ${arrows[p.sign > 0 ? 1 : 0]}`;
    }
    default:
      return binding;
  }
}
