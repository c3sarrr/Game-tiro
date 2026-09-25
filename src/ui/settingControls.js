// Controles de configuração gerados a partir do esquema (bool → interruptor de massinha, enum → botões
// segmentados ou lista, number → régua deslizante com valor). Cada controle acompanha mudanças externas
// (ex.: aplicar um preset atualiza os sliders) e devolve uma função para se desinscrever.

import { h } from './dom.js';

const ENUM_LABELS = Object.freeze({
  agx: 'AgX', aces: 'ACES', neutral: 'Neutro',
  desligada: 'Desligada', baixa: 'Baixa', media: 'Média', alta: 'Alta', ultra: 'Ultra',
  linear: 'Linear', exponencial: 'Exponencial', dinamica: 'Dinâmica',
  auto: 'Automático', playstation: 'PlayStation', xbox: 'Xbox', generico: 'Genérico',
  off: 'Desligado', compacto: 'Compacto', completo: 'Completo',
  leve: 'Leve', medio: 'Médio', personalizado: 'Personalizado',
  desligado: 'Desligado', meia: 'Meia resolução', cheia: 'Resolução cheia', sutil: 'Sutil', forte: 'Forte',
});

const KEY_FORMATS = Object.freeze({
  'graphics.msaa': (v) => (v === 0 ? 'Desligado' : `${v}x`),
  'graphics.fpsCap': (v) => (v === 0 ? 'Vsync' : `${v}`),
  'graphics.anisotropy': (v) => `${v}x`,
  'graphics.targetFps': (v) => `${v} FPS`,
  'graphics.resolutionScale': (v) => `${Math.round(v * 100)}%`,
  'graphics.maxPixelRatio': (v) => `${v.toFixed(2)}x`,
  'graphics.fov': (v) => `${v}°`,
  'graphics.exposure': (v) => v.toFixed(2),
  'controls.mouseSensitivity': (v) => v.toFixed(2),
  'controls.zoomSensitivity': (v) => v.toFixed(2),
  'controls.pad.lookSpeed': (v) => `${v}°/s`,
  'controls.pad.lookSpeedY': (v) => `${Math.round(v * 100)}%`,
  'controls.pad.deadzoneLeft': (v) => `${Math.round(v * 100)}%`,
  'controls.pad.deadzoneRight': (v) => `${Math.round(v * 100)}%`,
  'controls.pad.triggerThreshold': (v) => `${Math.round(v * 100)}%`,
  'controls.pad.curveExponent': (v) => v.toFixed(1),
  'controls.touch.lookSensitivity': (v) => v.toFixed(2),
  'controls.touch.gyroSensitivity': (v) => v.toFixed(2),
  'graphics.clayAtlas': (v) => `${v} px`,
  'graphics.grain': (v) => `${Math.round(v * 100)}%`,
  'graphics.vignette': (v) => `${Math.round(v * 100)}%`,
  'graphics.particles': (v) => `${Math.round(v * 100)}%`,
});

export function formatValue(key, value) {
  const f = KEY_FORMATS[key];
  if (f) return f(value);
  if (typeof value === 'boolean') return value ? 'Ligado' : 'Desligado';
  return ENUM_LABELS[value] ?? String(value);
}

let uid = 0;

/**
 * Linha de configuração para uma chave do esquema.
 * @returns {{el: HTMLElement, dispose: () => void}}
 */
export function settingRow(config, key, { onChange = null, hint = null } = {}) {
  const spec = config.spec(key);
  const id = `cfg-${++uid}`;
  const valueEl = h('output.xs-value', { for: id });
  let control;
  let sync;

  if (spec.type === 'bool') {
    control = h('input.clay-switch', { id, type: 'checkbox', role: 'switch' });
    control.addEventListener('change', () => {
      config.set(key, control.checked);
      onChange?.(control.checked);
    });
    sync = (v) => {
      control.checked = v;
      valueEl.textContent = v ? 'Ligado' : 'Desligado';
    };
  } else if (spec.type === 'enum' && spec.options.length <= 5) {
    control = h('div.segmented', { id, role: 'radiogroup', 'aria-label': spec.label });
    const buttons = spec.options.map((opt) => {
      const b = h('button.seg', { type: 'button', role: 'radio', dataset: { value: String(opt) } }, formatValue(key, opt));
      b.addEventListener('click', () => {
        config.set(key, opt);
        onChange?.(opt);
      });
      return b;
    });
    control.append(...buttons);
    sync = (v) => {
      for (const b of buttons) {
        const on = b.dataset.value === String(v);
        b.classList.toggle('is-on', on);
        b.setAttribute('aria-checked', on ? 'true' : 'false');
      }
      valueEl.textContent = '';
    };
  } else if (spec.type === 'enum') {
    control = h('select.clay-select', { id });
    for (const opt of spec.options) control.append(h('option', { value: String(opt) }, formatValue(key, opt)));
    control.addEventListener('change', () => {
      const raw = control.value;
      const opt = spec.options.find((o) => String(o) === raw);
      config.set(key, opt);
      onChange?.(opt);
    });
    sync = (v) => {
      control.value = String(v);
      valueEl.textContent = '';
    };
  } else if (spec.type === 'number') {
    control = h('input.clay-range', { id, type: 'range', min: spec.min, max: spec.max, step: spec.step ?? 'any' });
    const apply = () => {
      const v = config.set(key, Number(control.value));
      if (v !== undefined) onChange?.(v);
    };
    control.addEventListener('input', apply);
    sync = (v) => {
      control.value = String(v);
      control.style.setProperty('--fill', `${((v - spec.min) / (spec.max - spec.min)) * 100}%`);
      valueEl.textContent = formatValue(key, v);
    };
  } else {
    throw new Error(`sem controle de UI para o tipo ${spec.type} (${key})`);
  }

  const row = h('div.xs-row', null,
    h('label.xs-label', { for: id }, spec.label, hint ? h('small.xs-hint', null, hint) : null),
    h('div.xs-control', null, control),
    valueEl,
  );
  sync(config.get(key));
  const unwatch = config.watch(key, (e) => {
    if (e.key === key) sync(e.value);
  });
  return { el: row, dispose: unwatch };
}
