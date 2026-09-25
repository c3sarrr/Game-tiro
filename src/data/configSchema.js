// Esquema de todas as opções persistidas (tipo, faixa, default, rótulo).
// Cada fase acrescenta aqui as chaves que passa a consumir. Chaves `transient` não são salvas.

import { defaultBindings } from './bindings.js';
import { ACTION_IDS, TOGGLE_MODE, TOGGLE_MODES } from './actions.js';
import { PRESET_IDS } from './qualityPresets.js';
import { DEFAULT_TOUCH_BUTTONS, TOUCH_BUTTONS_SINCE, TOUCH_LAYOUT_VERSION, defaultTouchLayout } from './touchLayout.js';

export const BINDING_RE = /^(key:[A-Za-z0-9]+|mouse:[0-4]|wheel:(up|down)|pad:button:\d{1,2}|pad:axis:\d[+-])$/;

/** Valida o objeto de binds: só ações conhecidas, só strings no formato certo, sem duplicatas. */
export function validateBindings(value) {
  const out = defaultBindings();
  for (const action of ACTION_IDS) {
    const entry = value?.[action];
    if (!entry) continue;
    for (const dev of ['kbm', 'pad']) {
      if (!Array.isArray(entry[dev])) continue;
      out[action][dev] = [...new Set(entry[dev].filter((b) => typeof b === 'string' && BINDING_RE.test(b)))].slice(0, 4);
    }
  }
  return out;
}

/**
 * Valida o layout de toque salvo. Um layout de versão antiga ganha os botões padrão criados depois dela (os que ainda
 * não tiver); os botões que o jogador já tem ficam como estão.
 */
export function validateTouchLayout(value) {
  if (!value || !Array.isArray(value.buttons)) return undefined;
  const clamp01 = (n) => Math.min(1, Math.max(0, Number(n) || 0));
  const buttons = value.buttons
    .filter((b) => b && typeof b.id === 'string' && ACTION_IDS.includes(b.action))
    .slice(0, 32)
    .map((b) => ({
      id: b.id.slice(0, 32),
      action: b.action,
      x: clamp01(b.x),
      y: clamp01(b.y),
      r: Math.min(0.2, Math.max(0.025, Number(b.r) || 0.05)),
      opacity: Math.min(1, Math.max(0.15, Number(b.opacity) || 0.7)),
    }));
  const version = Number.isInteger(value.version) && value.version > 0 ? value.version : 1;
  for (const [since, ids] of Object.entries(TOUCH_BUTTONS_SINCE)) {
    if (version >= Number(since)) continue;
    for (const id of ids) {
      if (buttons.length >= 32 || buttons.some((b) => b.id === id)) continue;
      buttons.push({ ...DEFAULT_TOUCH_BUTTONS.find((b) => b.id === id) });
    }
  }
  return { version: TOUCH_LAYOUT_VERSION, buttons };
}

export const CONFIG_SCHEMA = Object.freeze({
  // ---------------- Gráficos ----------------
  'graphics.preset': {
    type: 'enum', options: [...PRESET_IDS, 'personalizado'], default: 'alto', label: 'Qualidade gráfica', group: 'graphics',
  },
  'graphics.autoDetected': { type: 'bool', default: false, label: 'Hardware já detectado', group: 'internal' },
  'graphics.resolutionScale': {
    type: 'number', min: 0.5, max: 1, step: 0.05, default: 1, label: 'Escala de resolução', group: 'graphics',
  },
  'graphics.maxPixelRatio': {
    type: 'number', min: 0.75, max: 3, step: 0.25, default: 1.5, label: 'Densidade máxima de pixels', group: 'graphics',
  },
  'graphics.adaptiveResolution': { type: 'bool', default: true, label: 'Resolução dinâmica', group: 'graphics' },
  'graphics.targetFps': {
    type: 'enum', options: [30, 60, 90, 120, 144], default: 60, label: 'FPS alvo da resolução dinâmica', group: 'graphics',
  },
  'graphics.shadows': {
    type: 'enum', options: ['desligada', 'baixa', 'media', 'alta', 'ultra'], default: 'alta', label: 'Sombras', group: 'graphics',
  },
  'graphics.msaa': { type: 'enum', options: [0, 2, 4, 8], default: 4, label: 'Antisserrilhado (MSAA)', group: 'graphics' },
  'graphics.anisotropy': { type: 'enum', options: [1, 2, 4, 8, 16], default: 8, label: 'Filtro anisotrópico', group: 'graphics' },
  'graphics.fov': {
    type: 'number', min: 70, max: 120, step: 1, default: 100, label: 'Campo de visão (horizontal em 16:9)', group: 'graphics',
  },
  'graphics.fpsCap': {
    type: 'enum', options: [0, 30, 60, 90, 120, 144, 240], default: 0, label: 'Limite de FPS (0 = vsync)', group: 'graphics',
  },
  'graphics.toneMapping': {
    type: 'enum', options: ['agx', 'aces', 'neutral'], default: 'agx', label: 'Tone mapping', group: 'graphics',
  },
  'graphics.exposure': { type: 'number', min: 0.4, max: 2.5, step: 0.05, default: 1, label: 'Exposição', group: 'graphics' },

  // ---------------- Gráficos: massinha e pós (Fase 2) ----------------
  'graphics.clayFingerprints': { type: 'bool', default: true, label: 'Digitais e marcas na massa', group: 'graphics' },
  'graphics.clayBoil': { type: 'bool', default: true, label: 'Boil de stop-motion', group: 'graphics' },
  'graphics.clayAtlas': {
    type: 'enum', options: [512, 1024, 2048], default: 1024, label: 'Resolução das digitais', group: 'graphics',
  },
  'graphics.ao': {
    type: 'enum', options: ['desligado', 'meia', 'cheia'], default: 'meia', label: 'Oclusão de ambiente (AO)', group: 'graphics',
  },
  'graphics.bloom': { type: 'bool', default: true, label: 'Bloom nas luzes', group: 'graphics' },
  'graphics.dof': {
    type: 'enum', options: ['desligado', 'sutil', 'forte'], default: 'sutil', label: 'Profundidade de campo (tilt-shift)', group: 'graphics',
  },
  'graphics.smaa': { type: 'bool', default: true, label: 'Antisserrilhado SMAA', group: 'graphics' },
  'graphics.grain': { type: 'number', min: 0, max: 1, step: 0.05, default: 0.35, label: 'Grão de filme', group: 'graphics' },
  'graphics.vignette': { type: 'number', min: 0, max: 1, step: 0.05, default: 0.5, label: 'Vinheta', group: 'graphics' },
  'graphics.flicker': { type: 'bool', default: true, label: 'Flicker de exposição (stop-motion)', group: 'graphics' },
  'graphics.particles': { type: 'number', min: 0, max: 1, step: 0.05, default: 0.8, label: 'Densidade de partículas', group: 'graphics' },
  'graphics.detailDistance': {
    type: 'number', min: 0.5, max: 1.5, step: 0.05, default: 1, label: 'Distância de detalhe', group: 'graphics',
  },

  // ---------------- Acessibilidade ----------------
  'accessibility.reduceMotion': {
    type: 'bool', default: false, label: 'Reduzir movimento (sem flicker/boil)', group: 'accessibility',
  },

  // ---------------- Controles: mouse ----------------
  'controls.mouseSensitivity': {
    type: 'number', min: 0.05, max: 10, step: 0.01, default: 2, label: 'Sensibilidade do mouse (escala CS)', group: 'controls',
  },
  'controls.zoomSensitivity': {
    type: 'number', min: 0.2, max: 3, step: 0.05, default: 1, label: 'Sensibilidade com zoom (proporção)', group: 'controls',
  },
  'controls.invertY': { type: 'bool', default: false, label: 'Inverter eixo Y (mouse)', group: 'controls' },
  'controls.rawInput': { type: 'bool', default: true, label: 'Entrada bruta do mouse', group: 'controls' },
  'controls.walkMode': {
    type: 'enum', options: TOGGLE_MODES, default: TOGGLE_MODE.HOLD, label: 'Andar silencioso (teclado)', group: 'controls',
  },

  // ---------------- Controles: controle (gamepad) ----------------
  'controls.pad.lookSpeed': {
    type: 'number', min: 60, max: 600, step: 5, default: 240, label: 'Velocidade de mira (graus/s)', group: 'pad',
  },
  'controls.pad.lookSpeedY': {
    type: 'number', min: 0.3, max: 1.5, step: 0.05, default: 0.75, label: 'Proporção vertical da mira', group: 'pad',
  },
  'controls.pad.deadzoneLeft': {
    type: 'number', min: 0, max: 0.4, step: 0.01, default: 0.12, label: 'Zona morta do analógico esquerdo', group: 'pad',
  },
  'controls.pad.deadzoneRight': {
    type: 'number', min: 0, max: 0.4, step: 0.01, default: 0.1, label: 'Zona morta do analógico direito', group: 'pad',
  },
  'controls.pad.curve': {
    type: 'enum', options: ['linear', 'exponencial', 'dinamica'], default: 'dinamica', label: 'Curva de resposta', group: 'pad',
  },
  'controls.pad.curveExponent': {
    type: 'number', min: 1, max: 4, step: 0.1, default: 2.2, label: 'Expoente da curva', group: 'pad',
  },
  'controls.pad.invertY': { type: 'bool', default: false, label: 'Inverter eixo Y (controle)', group: 'pad' },
  'controls.pad.triggerThreshold': {
    type: 'number', min: 0.05, max: 0.95, step: 0.05, default: 0.35, label: 'Ponto de acionamento dos gatilhos', group: 'pad',
  },
  'controls.pad.vibration': { type: 'bool', default: true, label: 'Vibração', group: 'pad' },
  'controls.pad.icons': {
    type: 'enum', options: ['auto', 'playstation', 'xbox', 'generico'], default: 'auto', label: 'Ícones de botão', group: 'pad',
  },
  'controls.pad.walkMode': {
    type: 'enum', options: TOGGLE_MODES, default: TOGGLE_MODE.TOGGLE, label: 'Andar silencioso (controle)', group: 'pad',
  },

  // ---------------- Controles: toque ----------------
  'controls.touch.lookSensitivity': {
    type: 'number', min: 0.1, max: 3, step: 0.05, default: 1, label: 'Sensibilidade do olhar (toque)', group: 'touch',
  },
  'controls.touch.autoFire': { type: 'bool', default: false, label: 'Tiro automático', group: 'touch' },
  'controls.touch.walkMode': {
    type: 'enum', options: TOGGLE_MODES, default: TOGGLE_MODE.TOGGLE, label: 'Andar silencioso (toque)', group: 'touch',
  },
  'controls.touch.gyro': { type: 'bool', default: false, label: 'Giroscópio para mirar', group: 'touch' },
  'controls.touch.gyroSensitivity': {
    type: 'number', min: 0.1, max: 3, step: 0.05, default: 1, label: 'Sensibilidade do giroscópio', group: 'touch',
  },
  'controls.touch.layout': {
    type: 'object', default: defaultTouchLayout, validate: validateTouchLayout, label: 'Layout dos botões de toque', group: 'touch',
  },

  // ---------------- Teclas ----------------
  'controls.bindings': {
    type: 'object', default: defaultBindings, validate: validateBindings, label: 'Teclas e botões', group: 'bindings',
  },

  // ---------------- Debug ----------------
  'debug.overlay': {
    type: 'enum', options: ['off', 'compacto', 'completo'], default: 'off', label: 'Overlay de desempenho', group: 'debug',
  },
  'debug.touchGuides': { type: 'bool', default: false, label: 'Mostrar zonas e botões de toque', group: 'debug' },
  'debug.collision': { type: 'bool', default: false, transient: true, label: 'Mostrar a colisão (r_colisao)', group: 'debug' },
  'debug.showPos': { type: 'bool', default: false, transient: true, label: 'Posição e velocidade (cl_showpos)', group: 'debug' },
  'debug.thirdPerson': { type: 'bool', default: false, transient: true, label: 'Câmera em terceira pessoa', group: 'debug' },
  'debug.consoleHistory': {
    type: 'array', default: () => [], label: 'Histórico do console', group: 'internal',
    validate: (v) => v.filter((s) => typeof s === 'string').slice(-50),
  },
});
