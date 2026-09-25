// Gráfico do cl_showpos (Fase 3.2): os últimos 4 s da telemetria do jogador num canvas — a faixa preciso × impreciso
// (abaixo e acima do limiar de precisão da arma na mão), o teto do tick, o limiar tracejado, a velocidade no plano, a
// inaccuracy por cima, os ticks no ar numa tira embaixo, os ticks de slide numa tira em cima e um risco em cada wall-jump
// (3.4), e a marca de cada medida do counter-strafe com o tempo em ms. O tick mais novo fica na borda direita.
// Redesenhado a cada atualização do painel (15 Hz).

import { TFLAG } from '../player/telemetry.js';
import { STRAFE_KIND } from './strafeMeter.js';

// Cores da paleta do projeto (tokens de UI e dos times), com a transparência do painel.
const COLOR = Object.freeze({
  precise: 'rgba(63, 184, 175, 0.2)',
  imprecise: 'rgba(228, 87, 46, 0.13)',
  grid: 'rgba(246, 240, 228, 0.1)',
  cap: 'rgba(246, 240, 228, 0.6)',
  threshold: '#3FB8AF',
  speed: '#FFD23F',
  inaccuracy: '#E4572E',
  air: '#2F6DB5',
  slide: '#F28F3B',
  walljump: '#E88AA8',
  text: '#F6F0E4',
  [STRAFE_KIND.COUNTER]: '#FFD23F',
  [STRAFE_KIND.RELEASE]: '#F6F0E4',
});
const SPEED_TOP = 300; // u/s no topo da escala (o teto do bhop, 286, cabe); cresce de 50 em 50 se a janela passar
const SPEED_STEP = 50;
const INACCURACY_TOP = 0.3; // rad no topo da curva de inaccuracy
const AIR_STRIP = 3; // px da tira dos ticks no ar
const SLIDE_STRIP = 3; // px da tira dos ticks de slide (em cima)
const FONT = '600 10px ui-monospace, "Cascadia Mono", Consolas, "SF Mono", "Courier New", monospace'; // --font-mono

export class SpeedGraph {
  constructor(canvas, { width = 480, height = 96 } = {}) {
    this.canvas = canvas;
    this.width = width;
    this.height = height;
    this.ctx = canvas.getContext('2d');
    this.dpr = 0;
  }

  /** Resolução do canvas pela densidade da tela (no máximo 2×); a largura em CSS é fixa e encolhe com o painel. */
  #fit() {
    const dpr = Math.min(2, globalThis.devicePixelRatio || 1);
    if (dpr === this.dpr) return;
    this.dpr = dpr;
    this.canvas.width = Math.round(this.width * dpr);
    this.canvas.height = Math.round(this.height * dpr);
    this.canvas.style.width = `${this.width}px`;
  }

  /** Desenha a janela da telemetria `t` e as marcas do medidor (opcional). */
  draw(t, meter = null) {
    this.#fit();
    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    const n = t.length;
    if (n < 2) return;
    const first = t.count - n;
    let top = SPEED_TOP;
    for (let i = first; i < t.count; i++) {
      const j = t.slot(i);
      top = Math.max(top, t.speed[j], t.cap[j]);
    }
    top = Math.ceil(top / SPEED_STEP) * SPEED_STEP;
    const plotH = h - AIR_STRIP - 1;
    const dx = w / (t.size - 1);
    const xOf = (i) => w - (t.count - 1 - i) * dx;
    const yOf = (v) => plotH - (Math.min(v, top) / top) * plotH;

    // Faixas: preciso abaixo do limiar, impreciso acima; tira azul nos ticks no ar.
    for (let i = first; i < t.count; i++) {
      const j = t.slot(i);
      const x0 = xOf(i) - dx / 2;
      const yt = yOf(t.threshold[j]);
      ctx.fillStyle = COLOR.imprecise;
      ctx.fillRect(x0, 0, dx, yt);
      ctx.fillStyle = COLOR.precise;
      ctx.fillRect(x0, yt, dx, plotH - yt);
      if (!(t.flags[j] & TFLAG.GROUND)) {
        ctx.fillStyle = COLOR.air;
        ctx.fillRect(x0, h - AIR_STRIP, dx, AIR_STRIP);
      }
      if (t.flags[j] & TFLAG.SLIDE) {
        ctx.fillStyle = COLOR.slide;
        ctx.fillRect(x0, 0, dx, SLIDE_STRIP);
      }
    }
    ctx.strokeStyle = COLOR.grid;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let v = SPEED_STEP; v < top; v += SPEED_STEP) {
      const y = Math.round(yOf(v)) + 0.5;
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
    }
    ctx.stroke();

    this.#line(t, first, xOf, (j) => yOf(t.cap[j]), COLOR.cap, 1, false);
    this.#line(t, first, xOf, (j) => yOf(t.threshold[j]), COLOR.threshold, 1, true);
    const yAcc = (j) => plotH - Math.min(1, t.inaccuracy[j] / INACCURACY_TOP) * plotH;
    this.#line(t, first, xOf, yAcc, COLOR.inaccuracy, 1, false);
    this.#line(t, first, xOf, (j) => yOf(t.speed[j]), COLOR.speed, 1.6, false);
    // Wall-jumps: um risco de cima a baixo no tick do chute.
    ctx.strokeStyle = COLOR.walljump;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let i = first; i < t.count; i++) {
      if (!(t.flags[t.slot(i)] & TFLAG.WALLJUMP)) continue;
      const x = Math.round(xOf(i)) + 0.5;
      ctx.moveTo(x, SLIDE_STRIP);
      ctx.lineTo(x, plotH);
    }
    ctx.stroke();

    ctx.font = FONT;
    ctx.textBaseline = 'top';
    ctx.fillStyle = COLOR.text;
    ctx.textAlign = 'left';
    ctx.fillText(`${top} u/s`, 3, 2);
    if (!meter) return;
    for (const m of meter.marks) {
      if (m.end < first) continue;
      const x = Math.round(xOf(m.end)) + 0.5;
      ctx.strokeStyle = COLOR[m.kind];
      ctx.beginPath();
      ctx.moveTo(x, 12);
      ctx.lineTo(x, plotH);
      ctx.stroke();
      ctx.fillStyle = COLOR[m.kind];
      ctx.textAlign = x > w - 44 ? 'right' : 'left';
      ctx.fillText(`${Math.round(m.ms)} ms`, x + (x > w - 44 ? -3 : 3), 12);
    }
  }

  /** Uma série da telemetria como linha (`dashed`: tracejada). */
  #line(t, first, xOf, yOf, color, width, dashed) {
    const ctx = this.ctx;
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.setLineDash(dashed ? [4, 3] : []);
    ctx.beginPath();
    for (let i = first; i < t.count; i++) {
      const x = xOf(i);
      const y = yOf(t.slot(i));
      if (i === first) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.setLineDash([]);
  }
}
