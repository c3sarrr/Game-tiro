// Presets de qualidade: aplicar um preset grava todas as chaves dele na config; mexer num ajuste individual
// marca "personalizado" (a não ser que a combinação volte a bater com algum preset).
// Também conduz a detecção automática de hardware no primeiro acesso.

import { EV } from '../core/events.js';
import { QUALITY_PRESETS, PRESET_KEYS, PRESET_IDS } from '../data/qualityPresets.js';
import { detectHardware, runBenchmark, choosePreset } from './hardware.js';

export class QualityManager {
  #applying = false;

  constructor({ config, events, store, log }) {
    this.config = config;
    this.events = events;
    this.store = store;
    this.log = log;
    this.hardware = null;
    this.benchmark = null;
    this.unwatch = config.watch('graphics.', (e) => this.#onChange(e));
  }

  applyPreset(id) {
    const values = QUALITY_PRESETS[id];
    if (!values) throw new Error(`preset desconhecido: ${id}`);
    this.#applying = true;
    try {
      this.config.setMany(values, { source: 'preset' });
      this.config.set('graphics.preset', id, { source: 'preset' });
    } finally {
      this.#applying = false;
    }
    this.events.emit(EV.RENDER_QUALITY, { preset: id, settings: { ...values } });
  }

  /** Preset cujos valores batem exatamente com a config atual (ou 'personalizado'). */
  matchPreset() {
    for (const id of PRESET_IDS) {
      const values = QUALITY_PRESETS[id];
      if (PRESET_KEYS.every((k) => this.config.get(k) === values[k])) return id;
    }
    return 'personalizado';
  }

  #onChange(e) {
    if (this.#applying) return;
    if (e.key === 'graphics.preset') {
      if (e.value !== 'personalizado' && e.source !== 'preset') this.applyPreset(e.value);
      return;
    }
    if (PRESET_KEYS.includes(e.key)) {
      const match = this.matchPreset();
      if (match !== this.config.get('graphics.preset')) {
        this.#applying = true;
        this.config.set('graphics.preset', match, { source: 'preset' });
        this.#applying = false;
      }
    }
  }

  /**
   * Primeiro acesso (ou GPU trocada): detecta, mede e aplica o preset recomendado.
   * @returns {Promise<{hardware, benchmark, preset, changed:boolean}>}
   */
  async autoDetect(renderer) {
    const hw = detectHardware(renderer.getContext());
    this.hardware = hw;
    let saved = null;
    try {
      saved = await this.store.get('meta', 'hardwareProfile');
    } catch {
      saved = null;
    }
    const sameGpu = saved && saved.renderer === hw.renderer;
    if (this.config.get('graphics.autoDetected') && sameGpu) {
      this.benchmark = saved.benchmark ?? null;
      return { hardware: hw, benchmark: this.benchmark, preset: this.config.get('graphics.preset'), changed: false };
    }
    let bench = null;
    try {
      bench = await runBenchmark(renderer);
    } catch (err) {
      this.log?.warn('benchmark falhou, usando só a classificação da GPU:', err?.message ?? err);
    }
    this.benchmark = bench;
    const preset = choosePreset(hw, bench);
    this.applyPreset(preset);
    this.config.set('graphics.autoDetected', true);
    try {
      await this.store.put('meta', 'hardwareProfile', { renderer: hw.renderer, cls: hw.cls, tier: hw.tier, benchmark: bench, preset, at: Date.now() });
    } catch (err) {
      this.log?.warn('não foi possível salvar o perfil de hardware:', err?.message ?? err);
    }
    this.log?.info(`hardware: ${hw.name} (${hw.cls}, tier ${hw.tier}) · benchmark ${bench ? `${bench.ms.toFixed(2)} ms (${bench.mode === 'gpu' ? 'GPU' : 'relógio'})` : 'n/d'} → preset ${preset}`);
    return { hardware: hw, benchmark: bench, preset, changed: true };
  }

  dispose() {
    this.unwatch();
  }
}
