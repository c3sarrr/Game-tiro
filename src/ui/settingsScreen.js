// Configurações em forma de "folha de exposição" (X-sheet) de animação: colunas numeradas, papel creme e
// abas de fita crepe. Abre por cima de qualquer tela (menu, pausa) e prende o foco (mouse, teclado, controle).

import { h, clear } from './dom.js';
import { settingRow } from './settingControls.js';
import { bindingsPanel } from './bindingsPanel.js';
import { EV } from '../core/events.js';
import { PRESET_IDS, PRESET_LABELS } from '../data/qualityPresets.js';

const TABS = Object.freeze([
  { id: 'graficos', label: 'Gráficos' },
  { id: 'mouse', label: 'Mouse' },
  { id: 'controle', label: 'Controle' },
  { id: 'toque', label: 'Toque' },
  { id: 'teclas', label: 'Teclas' },
]);

const GRAPHICS_KEYS = [
  'graphics.resolutionScale', 'graphics.maxPixelRatio', 'graphics.adaptiveResolution', 'graphics.targetFps',
  'graphics.shadows', 'graphics.msaa', 'graphics.anisotropy', 'graphics.fov', 'graphics.fpsCap',
  'graphics.toneMapping', 'graphics.exposure',
];
// Fase 2: massinha e look de estúdio (seções 0.13 e 0.16). "Distância de detalhe" entra quando os mapas
// tiverem LOD (Fase 6) — nenhum ajuste aparece antes de ter efeito.
const CLAY_KEYS = ['graphics.clayFingerprints', 'graphics.clayBoil', 'graphics.clayAtlas'];
const POST_KEYS = [
  'graphics.ao', 'graphics.bloom', 'graphics.dof', 'graphics.smaa', 'graphics.grain', 'graphics.vignette',
  'graphics.flicker', 'graphics.particles',
];
const POST_HINTS = Object.freeze({
  'graphics.ao': 'assenta a massa na mesa; "cheia" custa ~4× mais',
  'graphics.dof': 'no jogo é mínimo; menus e killcam usam tilt-shift',
  'graphics.flicker': 'variação de exposição entre as poses, como nas fotos de stop-motion',
  'graphics.particles': 'poeira nos feixes de luz',
});
const COMFORT_KEYS = ['accessibility.reduceMotion'];
const MOUSE_KEYS = ['controls.mouseSensitivity', 'controls.zoomSensitivity', 'controls.invertY', 'controls.rawInput'];
const PAD_KEYS = [
  'controls.pad.lookSpeed', 'controls.pad.lookSpeedY', 'controls.pad.deadzoneLeft', 'controls.pad.deadzoneRight',
  'controls.pad.curve', 'controls.pad.curveExponent', 'controls.pad.invertY', 'controls.pad.triggerThreshold',
  'controls.pad.walkMode', 'controls.pad.vibration', 'controls.pad.icons',
];
// Toque: as opções antes e depois do giroscópio (que tem linha própria, com o pedido de permissão).
const TOUCH_KEYS = ['controls.touch.lookSensitivity', 'controls.touch.autoFire', 'controls.touch.walkMode'];
const TOUCH_AFTER_GYRO_KEYS = ['controls.touch.gyroSensitivity', 'debug.touchGuides'];
const WALK_HINT = 'alternar: cada aperto liga ou desliga';

export function openSettings(services, { tab = 'graficos', onClose = null } = {}) {
  const { config, quality, input, rebinder, events, toasts, focusNav, render } = services;
  let disposers = [];
  let current = null;

  const content = h('div.xsheet-body');
  const tabButtons = TABS.map((t) =>
    h('button.tape-tab', { type: 'button', role: 'tab', dataset: { tab: t.id }, onclick: () => showTab(t.id) }, t.label),
  );
  const sheet = h('section.xsheet', null,
    h('header.xsheet-head', null,
      h('div.xsheet-title', null, h('span.xsheet-kicker', null, 'Folha de exposição'), h('h2', null, 'Configurações')),
      h('div.xsheet-tabs', { role: 'tablist' }, tabButtons),
    ),
    content,
    h('footer.xsheet-foot', null,
      h('span.xsheet-note', null, 'Tudo é salvo automaticamente neste navegador.'),
      h('button.btn-clay.is-primary', { type: 'button', onclick: () => close(), 'data-autofocus': true }, 'Fechar'),
    ),
  );
  const overlay = h('div.modal', { role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Configurações' }, sheet);
  services.uiRoot.append(overlay);

  function track(result) {
    disposers.push(result.dispose);
    return result.el;
  }

  function section(title, ...rows) {
    return h('div.xs-section', null, h('h3.xs-section-title', null, title), ...rows);
  }

  function graficos() {
    const presetButtons = PRESET_IDS.map((id) =>
      h('button.btn-clay.is-small.preset', { type: 'button', dataset: { preset: id }, onclick: () => quality.applyPreset(id) }, PRESET_LABELS[id]),
    );
    const presetState = h('span.tape-label.preset-state');
    const syncPreset = () => {
      const p = config.get('graphics.preset');
      for (const b of presetButtons) b.classList.toggle('is-on', b.dataset.preset === p);
      presetState.textContent = `Atual: ${PRESET_LABELS[p]}`;
    };
    syncPreset();
    disposers.push(config.watch('graphics.preset', syncPreset));
    const hw = quality.hardware;
    const bench = quality.benchmark;
    const hwLine = h('p.xs-info', null,
      hw ? `GPU: ${hw.name} · classe ${hw.cls} · benchmark ${bench ? `${bench.ms.toFixed(2)} ms/quadro (${bench.mode === 'gpu' ? 'tempo de GPU' : 'tempo de relógio'})` : 'n/d'}` : 'Hardware ainda não detectado.',
    );
    const redetect = h('button.btn-clay.is-small', {
      type: 'button',
      onclick: async () => {
        redetect.disabled = true;
        config.set('graphics.autoDetected', false);
        const r = await quality.autoDetect(render.renderer);
        toasts.show(`Preset recomendado: ${PRESET_LABELS[r.preset]}`);
        // A tela pode ter sido fechada (ou trocada de aba) enquanto o benchmark rodava.
        if (!closed && current === 'graficos') showTab('graficos');
      },
    }, 'Detectar hardware de novo');
    return [
      section('Preset', h('div.preset-row', null, presetButtons, presetState), hwLine, redetect),
      section('Ajustes individuais', ...GRAPHICS_KEYS.map((k) => track(settingRow(config, k)))),
      section('Massinha', ...CLAY_KEYS.map((k) => track(settingRow(config, k)))),
      section('Lente e luz de estúdio', ...POST_KEYS.map((k) => track(settingRow(config, k, { hint: POST_HINTS[k] ?? null })))),
      section('Conforto', ...COMFORT_KEYS.map((k) => track(settingRow(config, k)))),
    ];
  }

  function mouse() {
    return [section('Mouse', ...MOUSE_KEYS.map((k) => track(settingRow(config, k, {
      hint: k === 'controls.mouseSensitivity' ? 'mesma escala do CS (0,022° por contagem)' : null,
    }))))];
  }

  function controle() {
    const status = h('p.xs-info');
    const syncStatus = () => {
      status.textContent = input.pad.connected
        ? `Conectado: ${input.pad.id} (${input.pad.type})`
        : 'Nenhum controle conectado — aperte qualquer botão do controle.';
    };
    syncStatus();
    disposers.push(events.on(EV.INPUT_GAMEPAD, syncStatus));
    const test = h('button.btn-clay.is-small', {
      type: 'button',
      onclick: () => {
        if (!input.rumble(0.8, 0.4, 350)) toasts.show('Vibração indisponível neste controle/navegador', { kind: 'warn' });
      },
    }, 'Testar vibração');
    return [section('Controle', status, ...PAD_KEYS.map((k) => track(settingRow(config, k, {
      hint: k === 'controls.pad.walkMode' ? WALK_HINT : null,
    }))), test)];
  }

  function toque() {
    const gyro = track(settingRow(config, 'controls.touch.gyro', {
      hint: 'no iPhone o navegador pede permissão',
      onChange: async (on) => {
        if (!on) return;
        const ok = await input.touch.enableGyro(config.get('controls.touch.gyroSensitivity'));
        if (!ok) {
          config.set('controls.touch.gyro', false);
          toasts.show('Giroscópio indisponível ou permissão negada', { kind: 'warn' });
        }
      },
    }));
    const info = h('p.xs-info', null, input.touch.available
      ? 'Toque detectado neste aparelho. O editor de posição dos botões fica na Fase 10 (menus).'
      : 'Nenhum toque detectado ainda. Os controles de toque ligam sozinhos ao tocar na tela.');
    return [section('Toque', info, ...TOUCH_KEYS.map((k) => track(settingRow(config, k, {
      hint: k === 'controls.touch.walkMode' ? WALK_HINT : null,
    }))), gyro, ...TOUCH_AFTER_GYRO_KEYS.map((k) => track(settingRow(config, k))))];
  }

  function teclas() {
    return [
      section('Teclado', track(settingRow(config, 'controls.walkMode', { hint: WALK_HINT }))),
      track(bindingsPanel({ input, rebinder, events, toasts })),
    ];
  }

  const BUILDERS = { graficos, mouse, controle, toque, teclas };

  function showTab(id) {
    for (const d of disposers) d();
    disposers = [];
    current = id;
    for (const b of tabButtons) {
      const on = b.dataset.tab === id;
      b.classList.toggle('is-on', on);
      b.setAttribute('aria-selected', on ? 'true' : 'false');
    }
    clear(content);
    content.append(...BUILDERS[id]());
    content.scrollTop = 0;
  }

  let closed = false;
  // Se o estado do jogo mudar com a folha aberta (console, fim de partida), ela fecha junto.
  const offState = events.on(EV.STATE_CHANGE, () => close());
  function close() {
    if (closed) return;
    closed = true;
    offState();
    for (const d of disposers) d();
    disposers = [];
    input.cancelCapture();
    popNav();
    overlay.classList.add('is-leaving');
    setTimeout(() => overlay.remove(), 220);
    onClose?.();
  }

  showTab(TABS.some((t) => t.id === tab) ? tab : 'graficos');
  const popNav = focusNav.push(overlay, { onBack: () => (input.capture ? input.cancelCapture() : close()) });
  return { close, get tab() { return current; } };
}
