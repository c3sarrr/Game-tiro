// Painel de fita crepe da vitrine (Tab solta o mouse; o MatchState chama open/close pelo `map.panel`).
// Tudo ao vivo: iluminância e Kelvin de cada luz da montagem, rebote (hemisférica), ambiente (reflexo das
// softboxes), multiplicadores de umidade/boil/digitais sobre cada massinha, diagnóstico "massa preta",
// contexto de câmera do pós, foco (automático na mira ou fixo), exposição, presets e a varredura automática
// com a tabela comparativa. Navegável por controle/teclado (FocusNavigator) como o resto da UI.

import { h, clear } from '../ui/dom.js';
import { settingRow } from '../ui/settingControls.js';
import { RIG_LIMITS } from '../data/studioRigs.js';
import { SHOWCASE_PANEL, PRESET_SWEEP, CLAY_BLACK_PROBE } from '../data/showcase.js';
import { PRESET_IDS, PRESET_LABELS } from '../data/qualityPresets.js';
import { POST_CONTEXTS } from '../data/postFx.js';
import { kelvinToColor } from '../render/colorTemperature.js';

let uid = 0;

/** Régua deslizante com rótulo e valor. `onInput` a cada movimento; `onCommit` ao soltar (mudanças caras). */
function slider({ label, min, max, step, value, format, onInput, onCommit = null }) {
  const id = `vt-${++uid}`;
  const input = h('input.clay-range', { id, type: 'range', min, max, step });
  const out = h('output.vt-value', { for: id });
  const paint = (v) => {
    input.value = String(v);
    input.style.setProperty('--fill', `${((v - min) / (max - min)) * 100}%`);
    out.textContent = format(v);
  };
  input.addEventListener('input', () => {
    const v = Number(input.value);
    paint(v);
    onInput(v);
  });
  if (onCommit) input.addEventListener('change', () => onCommit(Number(input.value)));
  paint(value);
  const el = h('div.vt-row', null, h('label.vt-label', { for: id }, label), input, out);
  return { el, set: paint };
}

function section(title, ...children) {
  return h('section.vt-card', null, h('h3.tape-label.vt-tape', null, title), ...children);
}

const fx = (d) => (v) => v.toFixed(d);

/**
 * @param {object} s serviços do jogo
 * @param {{rig:import('../render/studio/studioRig.js').StudioRig, bench:import('./showcase.js').ShowcaseBench,
 *          sweep:import('./presetSweep.js').PresetSweep, onClose:Function}} deps
 */
export function createShowcasePanel(s, { rig, bench, sweep, onClose }) {
  const disposers = [];
  const post = () => s.render.post;

  // ---- luzes
  const lightRows = rig.lights.map((e) => {
    const swatch = h('i.vt-swatch');
    const paintSwatch = (kelvin) => {
      swatch.style.background = `#${kelvinToColor(kelvin).getHexString()}`;
    };
    const lux = slider({
      label: 'Iluminância', min: RIG_LIMITS.illuminance[0], max: RIG_LIMITS.illuminance[1], step: 0.05, value: e.illuminance,
      format: (v) => `${v.toFixed(2)} lx`, onInput: (v) => rig.setIlluminance(e.def.id, v),
    });
    const kel = slider({
      label: 'Temperatura', min: RIG_LIMITS.kelvin[0], max: RIG_LIMITS.kelvin[1], step: 50, value: e.kelvin,
      format: (v) => `${Math.round(v)} K`,
      onInput: (v) => {
        rig.setKelvin(e.def.id, v);
        paintSwatch(v);
      },
      onCommit: () => rig.commit(),
    });
    paintSwatch(e.kelvin);
    const el = h('div.vt-light', null, h('div.vt-light-name', null, swatch, h('strong', null, e.def.label)), lux.el, kel.el);
    return {
      el,
      sync: () => {
        lux.set(e.illuminance);
        kel.set(e.kelvin);
        paintSwatch(e.kelvin);
      },
    };
  });
  const hemi = slider({
    label: 'Rebote (hemisférica)', min: RIG_LIMITS.hemi[0], max: RIG_LIMITS.hemi[1], step: 0.01, value: rig.hemi.intensity,
    format: fx(2), onInput: (v) => rig.setHemi(v),
  });
  const env = slider({
    label: 'Ambiente (reflexo das softboxes)', min: RIG_LIMITS.environment[0], max: RIG_LIMITS.environment[1], step: 0.01,
    value: rig.envIntensity, format: fx(2), onInput: (v) => rig.setEnvironment(v),
  });
  const resetLights = h('button.btn-clay.is-small', { type: 'button' }, 'Restaurar luz');
  resetLights.addEventListener('click', () => {
    for (const e of rig.lights) {
      rig.setIlluminance(e.def.id, e.def.illuminance);
      rig.setKelvin(e.def.id, e.def.kelvin);
    }
    rig.setHemi(rig.def.hemi.intensity);
    rig.setEnvironment(rig.def.environment.intensity);
    rig.commit();
    syncAll();
  });

  // ---- massinha
  const P = SHOWCASE_PANEL;
  const wet = slider({ label: 'Umidade (× de cada massa)', ...P.wetness, value: bench.multipliers.wetness, format: (v) => `×${v.toFixed(2)}`, onInput: (v) => bench.setClayMultipliers({ wetness: v }) });
  const boil = slider({ label: 'Boil de stop-motion (×)', ...P.boil, value: bench.multipliers.boil, format: (v) => `×${v.toFixed(2)}`, onInput: (v) => bench.setClayMultipliers({ boil: v }) });
  const prints = slider({ label: 'Digitais e ferramenta (×)', ...P.fingerprints, value: bench.multipliers.fingerprints, format: (v) => `×${v.toFixed(2)}`, onInput: (v) => bench.setClayMultipliers({ fingerprints: v }) });
  const probeId = `vt-${++uid}`;
  const probe = h('input.clay-switch', { id: probeId, type: 'checkbox', role: 'switch' });
  probe.addEventListener('change', () => s.clay.setBlackProbe(probe.checked, { threshold: CLAY_BLACK_PROBE.threshold, color: CLAY_BLACK_PROBE.color }));
  const probeRow = h('div.vt-row.vt-inline', null, probe, h('label.vt-label', { for: probeId }, 'Destacar massa que ficaria preta (magenta)'));
  const resetClay = h('button.btn-clay.is-small', { type: 'button' }, 'Restaurar massinha');
  resetClay.addEventListener('click', () => {
    bench.setClayMultipliers({ wetness: 1, boil: 1, fingerprints: 1 });
    syncAll();
  });

  // ---- câmera e lente
  const ctxButtons = P.contexts.map((id) => {
    const b = h('button.seg', { type: 'button', role: 'radio', dataset: { ctx: id } }, POST_CONTEXTS[id].label);
    b.addEventListener('click', () => {
      post()?.setContext(id);
      syncAll();
    });
    return b;
  });
  const autoId = `vt-${++uid}`;
  const autoFocus = h('input.clay-switch', { id: autoId, type: 'checkbox', role: 'switch' });
  const focus = slider({
    label: 'Foco fixo', ...P.focus, value: 300, format: (v) => `${Math.round(v)} u (${(v / 10).toFixed(1)} cm)`,
    onInput: (v) => {
      autoFocus.checked = false;
      post()?.setFocus(v);
    },
  });
  autoFocus.addEventListener('change', () => post()?.setFocus(autoFocus.checked ? null : Number(focus.el.querySelector('input').value)));
  const exposure = settingRow(s.config, 'graphics.exposure');
  disposers.push(exposure.dispose);

  // ---- qualidade e varredura
  const presetButtons = PRESET_IDS.map((id) => {
    const b = h('button.seg', { type: 'button', role: 'radio', dataset: { preset: id } }, PRESET_LABELS[id]);
    b.addEventListener('click', () => {
      if (sweep.running) return;
      s.quality.applyPreset(id);
    });
    return b;
  });
  const presetNow = h('span.vt-note');
  const sweepBtn = h('button.btn-clay.is-primary.is-small', { type: 'button' }, 'Varredura automática');
  const sweepStatus = h('p.vt-note', { role: 'status' }, `Mede ${PRESET_SWEEP.presets.length} presets com a câmera parada (${PRESET_SWEEP.warmupS}s de aquecimento + ${PRESET_SWEEP.measureS}s de medição cada, resolução travada).`);
  const tableHost = h('div.vt-table-host');
  sweepBtn.addEventListener('click', async () => {
    if (sweep.running) {
      sweep.cancel();
      return;
    }
    sweepBtn.textContent = 'Cancelar varredura';
    clear(tableHost);
    try {
      const rows = await sweep.run();
      renderTable(rows);
      sweepStatus.textContent = rows.length ? 'Varredura concluída (tudo voltou ao que estava).' : 'Varredura cancelada.';
    } catch (err) {
      sweepStatus.textContent = `Varredura falhou: ${err?.message ?? err}`;
    } finally {
      sweepBtn.textContent = 'Varredura automática';
      syncAll();
    }
  });
  sweep.onProgress = ({ index, total, label, phase, row }) => {
    const what = phase === 'aquecer' ? 'aquecendo' : phase === 'medir' ? 'medindo' : 'pronto';
    sweepStatus.textContent = `${label} (${index + 1}/${total}): ${what}…`;
    if (row) renderTable(sweep.results);
    syncPresets();
  };

  const cell = (v, d, unit = '') => (v === null || v === undefined || Number.isNaN(v) ? 'n/d' : `${v.toFixed(d)}${unit}`);
  function renderTable(rows) {
    clear(tableHost);
    if (!rows.length) return;
    const factor = PRESET_SWEEP.integratedFactor;
    const table = h('table.vt-table', null,
      h('thead', null, h('tr', null, ...['Preset', 'FPS', '1% low', 'GPU', 'GPU p95', 'CPU', 'Draws', 'Resolução', `GPU×${factor}`].map((t) => h('th', null, t)))),
      h('tbody', null, ...rows.map((r) => {
        const est = r.gpuMs === null ? null : r.gpuMs * factor;
        const fits = est !== null && est <= PRESET_SWEEP.budgetMs;
        return h(`tr${est === null ? '' : fits ? '.is-ok' : '.is-bad'}`, null,
          h('th', null, r.label), h('td', null, cell(r.fps, 0)), h('td', null, cell(r.low1Fps, 0)),
          h('td', null, cell(r.gpuMs, 2, ' ms')), h('td', null, cell(r.gpuP95, 2, ' ms')), h('td', null, cell(r.cpuMs, 2, ' ms')),
          h('td', null, String(r.calls)), h('td', null, `${r.width}×${r.height}`), h('td', null, cell(est, 1, ' ms')));
      })),
    );
    const hz = rows[0]?.refreshHz;
    tableHost.append(table, h('p.vt-note', null,
      `FPS limitado pelo monitor${hz ? ` (${Math.round(hz)} Hz)` : ''}: compare pela GPU. GPU×${factor} estima uma GPU integrada recente ` +
      `(Iris Xe); verde = cabe em ${PRESET_SWEEP.budgetMs.toFixed(1)} ms (60 FPS).`));
  }

  // ---- montagem
  const close = h('button.btn-clay.is-small', { type: 'button' }, 'Voltar à câmera (Tab)');
  close.addEventListener('click', () => onClose());
  const root = h('aside.vt-panel', { hidden: true, 'aria-label': 'Painel da vitrine' },
    h('header.vt-head', null, h('h2.vt-title', null, 'Vitrine'), h('p.vt-note', null, 'Luz, massinha e lente ao vivo. Clique na cena ou Tab/Esc para voltar à câmera.'), close),
    section('Luzes da montagem', ...lightRows.map((r) => r.el), hemi.el, env.el, resetLights),
    section('Massinha', wet.el, boil.el, prints.el, probeRow, resetClay),
    section('Câmera e lente', h('div.segmented.vt-ctx', { role: 'radiogroup', 'aria-label': 'Contexto de câmera' }, ...ctxButtons),
      h('div.vt-row.vt-inline', null, autoFocus, h('label.vt-label', { for: autoId }, 'Foco automático na mira')), focus.el, exposure.el),
    section('Qualidade', h('div.segmented', { role: 'radiogroup', 'aria-label': 'Preset gráfico' }, ...presetButtons), presetNow, sweepBtn, sweepStatus, tableHost),
  );
  // Tab alterna (abre pelo MatchState, fecha aqui): no painel o Tab não serve para navegar entre controles.
  root.addEventListener('keydown', (e) => {
    if (e.code === 'Tab') {
      e.preventDefault();
      onClose();
    }
  });
  s.uiRoot.append(root);

  function syncPresets() {
    const cur = s.config.get('graphics.preset');
    for (const b of presetButtons) {
      const on = b.dataset.preset === cur;
      b.classList.toggle('is-on', on);
      b.setAttribute('aria-checked', on ? 'true' : 'false');
    }
    presetNow.textContent = `Atual: ${PRESET_LABELS[cur] ?? cur}`;
  }
  function syncAll() {
    for (const r of lightRows) r.sync();
    hemi.set(rig.hemi.intensity);
    env.set(rig.envIntensity);
    wet.set(bench.multipliers.wetness);
    boil.set(bench.multipliers.boil);
    prints.set(bench.multipliers.fingerprints);
    const p = post();
    for (const b of ctxButtons) {
      const on = p?.context === b.dataset.ctx;
      b.classList.toggle('is-on', on);
      b.setAttribute('aria-checked', on ? 'true' : 'false');
    }
    const manual = p?.dof.manualFocus ?? 0;
    autoFocus.checked = !(manual > 0);
    if (manual > 0) focus.set(manual);
    syncPresets();
  }
  disposers.push(s.config.watch('graphics.preset', syncPresets));

  return {
    root,
    open() {
      syncAll();
      root.hidden = false;
    },
    close() {
      root.hidden = true;
    },
    refresh: syncAll,
    dispose() {
      if (sweep.running) sweep.cancel();
      sweep.onProgress = null;
      s.clay.setBlackProbe(false);
      for (const d of disposers) d();
      root.remove();
    },
  };
}
