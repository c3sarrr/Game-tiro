// Overlay de desempenho (F3): FPS médio e 1% low, tempo de quadro, CPU (simulação e render), GPU
// (timer query), draw calls, triângulos, memória, ticks, pose stop-motion, entrada e estado.
// O texto atualiza 4x por segundo (sem custo de layout a cada quadro); o gráfico de quadros, a cada quadro.

import { h } from '../ui/dom.js';
import { clock } from '../core/time.js';
import { ACTION_IDS } from '../data/actions.js';
import { PRESET_LABELS } from '../data/qualityPresets.js';
import { MOVETYPE } from '../player/movement.js';

const MODES = ['off', 'compacto', 'completo'];
const GRAPH_W = 180;
const GRAPH_H = 46;

const fmt = (v, d = 1) => (v === null || v === undefined || Number.isNaN(v) ? 'n/d' : v.toFixed(d));
const mb = (bytes) => `${(bytes / 1048576).toFixed(0)} MB`;
const kfmt = (n) => (n >= 1e6 ? `${(n / 1e6).toFixed(2)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(1)}k` : String(n));

/** Linha da física do jogador (Fase 3): custo médio por tick e as consultas do último tick. */
function physicsLine(player) {
  if (!player) return 'física: — (fora da partida)';
  const p = player.physicsStats;
  if (!p) return 'física: câmera livre (mapa sem colisão)';
  const s = player.state;
  const where = s.moveType === MOVETYPE.NOCLIP ? 'noclip' : s.onGround ? 'chão' : 'ar';
  return `física: ${fmt(p.us, 0)} µs/tick · varreduras ${p.sweeps} · sobreposições ${p.overlaps} · triângulos ${p.triangles} · ${where}`;
}

export class DebugOverlay {
  constructor(services) {
    this.s = services;
    this.text = h('pre.dbg-text');
    this.canvas = h('canvas.dbg-graph', { width: GRAPH_W, height: GRAPH_H });
    this.g = this.canvas.getContext('2d');
    this.root = h('div.dbg-overlay', { hidden: true, 'aria-hidden': 'true' }, this.text, this.canvas);
    services.debugRoot.append(this.root);
    this.lastText = 0;
    this.mode = services.config.get('debug.overlay');
    this.#apply();
    this.off = services.config.watch('debug.overlay', (e) => {
      this.mode = e.value;
      this.#apply();
    });
  }

  toggle() {
    const next = MODES[(MODES.indexOf(this.mode) + 1) % MODES.length];
    this.s.config.set('debug.overlay', next);
  }

  #apply() {
    this.root.hidden = this.mode === 'off';
    this.root.dataset.mode = this.mode;
    this.canvas.hidden = this.mode !== 'completo';
  }

  frame(now) {
    if (this.mode === 'off') return;
    if (this.mode === 'completo') this.#graph();
    if (now - this.lastText < 250) return;
    this.lastText = now;
    this.text.textContent = this.mode === 'completo' ? this.#full() : this.#compact();
  }

  #compact() {
    const { loop, render } = this.s;
    const st = loop.stats;
    const r = render.stats();
    return `${fmt(st.fps, 0)} FPS · ${fmt(st.frameMs)} ms · GPU ${r.gpuSupported ? fmt(r.gpuMs, 2) + ' ms' : 'n/d'} · ${r.calls} draws`;
  }

  #full() {
    const { loop, render, input, config, states, roster, cheats } = this.s;
    const st = loop.stats;
    const r = render.stats();
    const mem = performance.memory;
    const heap = mem ? `${mb(mem.usedJSHeapSize)} / ${mb(mem.jsHeapSizeLimit)}` : 'n/d (só Chromium expõe)';
    const down = ACTION_IDS.filter((a) => input.isDown(a));
    const pad = input.pad.connected ? `${input.pad.type} (${input.pad.id.slice(0, 38)})` : 'nenhum';
    const preset = PRESET_LABELS[config.get('graphics.preset')];
    const lines = [
      `MASSACRE dev · preset ${preset} · ${r.width}×${r.height} @${fmt(r.pixelRatio, 2)}x · res. dinâmica ${Math.round(r.adaptiveScale * 100)}%`,
      `FPS ${fmt(st.fps, 0)} (1% low ${fmt(st.low1Fps, 0)}) · quadro ${fmt(st.frameMs, 2)} ms`,
      `CPU simulação ${fmt(st.cpuTickMs, 2)} ms · render/JS ${fmt(st.cpuFrameMs, 2)} ms · GPU ${r.gpuSupported ? fmt(r.gpuMs, 2) + ' ms' : 'n/d (sem timer query)'}`,
      `GPU por etapa: ${r.gpuSections.length ? r.gpuSections.map((s) => `${s.name} ${fmt(s.avgMs, 2)}`).join(' · ') : 'n/d'}`,
      `draw calls ${r.calls} · triângulos ${kfmt(r.triangles)} · linhas ${r.lines} · pontos ${r.points}`,
      `memória GPU: geometrias ${r.geometries} · texturas ${r.textures} · programas ${r.programs} · heap JS ${heap}`,
      `tick ${fmt(st.ticksPerSecond, 1)}/s (alvo ${loop.hz}) · passos no quadro ${st.stepsLastFrame} · descartados ${st.droppedTicks} · timescale ${loop.timeScale}`,
      `stop-motion: pose #${clock.pose} (12/s) · tick #${clock.tick}`,
      `entrada: ${input.device}${input.pointerLocked ? ' (mouse capturado)' : ''} · contexto ${input.context} · controle ${pad} · toque ${input.touch.available ? 'sim' : 'não'}`,
      `movimento (${fmt(input.move.x, 2)}, ${fmt(input.move.y, 2)}) · ações: ${down.length ? down.join(', ') : '—'}`,
      `estado: ${states.name ?? '—'} · participantes ${roster.size}/${roster.max} · cheats ${[cheats.god && 'god', cheats.noclip && 'noclip'].filter(Boolean).join(', ') || '—'}`,
      physicsLine(states.name === 'match' ? states.current?.player : null),
    ];
    return lines.join('\n');
  }

  #graph() {
    const g = this.g;
    const st = this.s.loop.stats;
    const times = st.frameTimes;
    const n = times.length;
    g.clearRect(0, 0, GRAPH_W, GRAPH_H);
    g.fillStyle = 'rgba(42,35,32,0.72)';
    g.fillRect(0, 0, GRAPH_W, GRAPH_H);
    const scale = GRAPH_H / 50; // 50 ms no topo
    for (let i = 0; i < GRAPH_W; i++) {
      const idx = (st.frameIndex - GRAPH_W + i + n) % n;
      const ms = times[idx];
      if (!ms) continue;
      g.fillStyle = ms <= 17.5 ? '#3FB8AF' : ms <= 34 ? '#FFD23F' : '#E4572E';
      const hgt = Math.min(GRAPH_H, ms * scale);
      g.fillRect(i, GRAPH_H - hgt, 1, hgt);
    }
    g.fillStyle = 'rgba(246,240,228,0.5)';
    g.fillRect(0, GRAPH_H - 16.67 * scale, GRAPH_W, 1);
    g.fillRect(0, GRAPH_H - 33.3 * scale, GRAPH_W, 1);
  }

  dispose() {
    this.off();
    this.root.remove();
  }
}
