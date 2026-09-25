// Varredura automática de presets (Fase 2, vitrine): aplica Leve/Médio/Alto/Ultra um de cada vez com a câmera
// parada numa pose fixa, espera os shaders e o timer de GPU assentarem e mede FPS, 1% low, tempo de quadro,
// CPU e GPU por quadro. A resolução fica travada durante a medição (a dinâmica esconderia o custo baixando
// pixels). No fim devolve tudo como estava e entrega a tabela comparativa (painel e console).
// Aquecimento: a troca de preset recompila os materiais (defines de digitais/boil, atlas, passes do pós). A cena
// é compilada em paralelo (compileAsync, KHR_parallel_shader_compile) e a medição só começa depois de `warmupS`
// de quadros CALMOS seguidos — um quadro de compilação (> SPIKE_S) zera a contagem —, então nenhum travamento de
// shader cai dentro da janela medida (com teto de MAX_WARMUP_S para máquinas muito lentas).
// A estatística é pura (summarizeFrames, formatSweepTable) e tem testes em tests/showcase.test.js.

import { PRESET_SWEEP } from '../data/showcase.js';
import { PRESET_KEYS, PRESET_LABELS } from '../data/qualityPresets.js';

const DEG = Math.PI / 180;
const SPIKE_S = 0.1; // quadro mais longo que isso durante o aquecimento = compilação: recomeça a contar
const MAX_WARMUP_S = 45; // teto do aquecimento (tempo de relógio)

const mean = (arr) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null);

function percentile(sortedAsc, p) {
  if (!sortedAsc.length) return null;
  const idx = Math.min(sortedAsc.length - 1, Math.max(0, Math.ceil((p / 100) * sortedAsc.length) - 1));
  return sortedAsc[idx];
}

/**
 * Resume as amostras de uma janela de medição.
 * @param {Array<{dtMs:number, gpuMs:number|null, cpuMs:number}>} frames
 * @returns {{frames:number, fps:number|null, frameMs:number|null, low1Fps:number|null, p95Ms:number|null,
 *            gpuMs:number|null, gpuP95:number|null, cpuMs:number|null}}
 *   `low1Fps` = FPS médio do 1% de quadros mais lentos (mesma definição do overlay).
 */
export function summarizeFrames(frames) {
  const dts = frames.map((f) => f.dtMs).filter((v) => v > 0);
  const gpus = frames.map((f) => f.gpuMs).filter((v) => typeof v === 'number' && v > 0);
  const cpus = frames.map((f) => f.cpuMs).filter((v) => typeof v === 'number' && v >= 0);
  const total = dts.reduce((a, b) => a + b, 0);
  const sorted = [...dts].sort((a, b) => a - b);
  const worst = [...dts].sort((a, b) => b - a).slice(0, Math.max(1, Math.ceil(dts.length * 0.01)));
  const gpuSorted = [...gpus].sort((a, b) => a - b);
  return {
    frames: dts.length,
    fps: total > 0 ? (dts.length * 1000) / total : null,
    frameMs: mean(dts),
    low1Fps: worst.length && dts.length ? 1000 / mean(worst) : null,
    p95Ms: percentile(sorted, 95),
    gpuMs: mean(gpus),
    gpuP95: percentile(gpuSorted, 95),
    cpuMs: mean(cpus),
  };
}

const f = (v, d = 1) => (v === null || v === undefined || Number.isNaN(v) ? 'n/d' : v.toFixed(d));
const ms = (v, d = 2) => (v === null || v === undefined || Number.isNaN(v) ? 'n/d' : `${v.toFixed(d)}ms`);

/** Tabela de texto (console/log) a partir das linhas de resultado. */
export function formatSweepTable(rows, { budgetMs = PRESET_SWEEP.budgetMs, factor = PRESET_SWEEP.integratedFactor } = {}) {
  const head = `${'preset'.padEnd(8)} ${'FPS'.padStart(6)} ${'1% low'.padStart(7)} ${'quadro'.padStart(8)} ${'GPU'.padStart(8)} ${'GPU p95'.padStart(8)} ${'CPU'.padStart(7)} ${'draws'.padStart(6)} ${'resolução'.padStart(11)} ${`GPU×${factor}`.padStart(8)}  60 FPS?`;
  const lines = rows.map((r) => {
    const est = r.gpuMs === null ? null : r.gpuMs * factor;
    const fits = est === null ? 'n/d' : est <= budgetMs ? 'sim' : 'não';
    return `${r.label.padEnd(8)} ${f(r.fps, 0).padStart(6)} ${f(r.low1Fps, 0).padStart(7)} ${ms(r.frameMs).padStart(8)} ` +
      `${ms(r.gpuMs).padStart(8)} ${ms(r.gpuP95).padStart(8)} ${ms(r.cpuMs).padStart(7)} ${String(r.calls).padStart(6)} ` +
      `${`${r.width}×${r.height}`.padStart(11)} ${ms(est, 1).padStart(8)}  ${fits}`;
  });
  return [head, ...lines].join('\n');
}

export class PresetSweep {
  /**
   * @param {object} services serviços do jogo (config, quality, render, loop, states, log)
   * @param {{pose?:{x:number,y:number,z:number,yawDeg:number,pitchDeg:number}|null, onProgress?:Function}} [opts]
   */
  constructor(services, { pose = null, onProgress = null } = {}) {
    this.s = services;
    this.pose = pose;
    this.onProgress = onProgress;
    this.running = false;
    this.results = [];
    this._phase = null; // { kind: 'aquecer'|'medir', elapsed, duration, resolve, samples }
    this._cancel = false;
  }

  /** Chamado a cada quadro pelo mapa (dt em segundos). */
  frame(dt) {
    const ph = this._phase;
    if (!ph) return;
    ph.total += dt;
    if (ph.kind === 'aquecer' && dt > SPIKE_S) ph.elapsed = 0;
    else ph.elapsed += dt;
    if (ph.kind === 'aquecer' && ph.total >= MAX_WARMUP_S) ph.elapsed = ph.duration;
    if (ph.kind === 'medir') {
      const timer = this.s.render.gpuTimer;
      ph.samples.push({ dtMs: dt * 1000, gpuMs: timer?.supported ? timer.ms : null, cpuMs: this.s.loop.stats.cpuFrameMs });
    }
    if (ph.elapsed >= ph.duration || this._cancel) {
      this._phase = null;
      ph.resolve(ph.samples);
    }
  }

  #wait(kind, duration) {
    return new Promise((resolve) => {
      this._phase = { kind, elapsed: 0, total: 0, duration, resolve, samples: [] };
    });
  }

  cancel() {
    this._cancel = true;
  }

  /**
   * Roda a varredura. Devolve as linhas da tabela (uma por preset).
   * @param {{presets?:string[], warmupS?:number, measureS?:number}} [opts]
   */
  async run({ presets = PRESET_SWEEP.presets, warmupS = PRESET_SWEEP.warmupS, measureS = PRESET_SWEEP.measureS } = {}) {
    if (this.running) throw new Error('a varredura já está rodando');
    const { config, quality, states, render, log } = this.s;
    const match = states.current;
    if (!match?.player) throw new Error('a varredura precisa de um mapa aberto');
    this.running = true;
    this._cancel = false;
    this.results = [];
    const saved = {};
    for (const k of [...PRESET_KEYS, 'graphics.preset']) saved[k] = config.get(k);
    const savedPose = { pos: match.player.pos.clone(), yaw: match.player.yaw, pitch: match.player.pitch };
    try {
      if (this.pose) {
        const p = this.pose;
        match.teleport(savedPose.pos.clone().set(p.x, p.y, p.z), p.yawDeg * DEG, p.pitchDeg * DEG);
      }
      for (let i = 0; i < presets.length; i++) {
        if (this._cancel) break;
        const id = presets[i];
        const label = PRESET_LABELS[id] ?? id;
        quality.applyPreset(id);
        if (PRESET_SWEEP.lockResolution) config.set('graphics.adaptiveResolution', false);
        this.onProgress?.({ index: i, total: presets.length, preset: id, label, phase: 'aquecer' });
        try {
          await render.renderer.compileAsync(match.map.scene, match.camera);
        } catch (err) {
          log?.debug(`varredura: compilação paralela indisponível (${err?.message ?? err})`);
        }
        await this.#wait('aquecer', warmupS);
        if (this._cancel) break;
        this.onProgress?.({ index: i, total: presets.length, preset: id, label, phase: 'medir' });
        const samples = await this.#wait('medir', measureS);
        const st = render.stats();
        const row = {
          preset: id, label, ...summarizeFrames(samples), calls: st.calls, triangles: st.triangles,
          width: st.width, height: st.height, refreshHz: st.refreshHz,
        };
        this.results.push(row);
        this.onProgress?.({ index: i, total: presets.length, preset: id, label, phase: 'pronto', row });
      }
    } finally {
      // Volta exatamente ao que estava (valores de cada chave e o preset), e a câmera para onde estava.
      config.setMany(Object.fromEntries(PRESET_KEYS.map((k) => [k, saved[k]])));
      config.set('graphics.preset', saved['graphics.preset']);
      if (states.current === match && match.player) match.teleport(savedPose.pos, savedPose.yaw, savedPose.pitch);
      this._phase = null;
      this.running = false;
    }
    if (this.results.length) log?.info(`varredura de presets:\n${formatSweepTable(this.results)}`);
    return this.results;
  }
}
