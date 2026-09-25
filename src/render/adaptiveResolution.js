// Resolução dinâmica: ajusta uma escala (0,5..1) sobre a resolução do preset para manter o FPS alvo.
// - Com tempo de GPU disponível decide pelo custo real da GPU (quadros limitados por CPU não derrubam a resolução).
// - Sem tempo de GPU (Safari/Firefox): só desce quando os quadros passam do orçamento e sobe "sondando" devagar;
//   se uma subida causar queda, aquela escala vira teto temporário (evita oscilar).

import { ADAPTIVE_RESOLUTION as P } from '../data/qualityPresets.js';

const CEILING_MS = 30000;

/**
 * Orçamento de tempo por quadro (ms): o FPS alvo, mas nunca menor que o intervalo do limite de FPS nem que o
 * intervalo de atualização do monitor — acima deles o jogo não mostra mais quadros, então baixar a
 * resolução para "alcançar" o alvo só piora a imagem.
 */
export function frameBudgetMs({ targetFps, fpsCap = 0, refreshMs = 0 }) {
  return Math.max(1000 / targetFps, fpsCap > 0 ? 1000 / fpsCap : 0, refreshMs > 0 ? refreshMs : 0);
}

export class AdaptiveResolution {
  constructor(params = P) {
    this.p = params;
    this.scale = params.maxScale;
    this.samples = [];
    this.lastChange = -Infinity;
    this.ceiling = params.maxScale;
    this.ceilingUntil = 0;
    this.lastRaise = -Infinity;
  }

  reset() {
    this.scale = this.p.maxScale;
    this.samples.length = 0;
    this.ceiling = this.p.maxScale;
    this.ceilingUntil = 0;
  }

  /**
   * @param {number} frameMs duração do quadro (CPU + espera)
   * @param {number|null} gpuMs tempo de GPU medido (ou null)
   * @param {number} budget orçamento por quadro em ms (ver frameBudgetMs)
   * @param {number} now ms
   * @returns {boolean} true se a escala mudou
   */
  update(frameMs, gpuMs, budget, now) {
    const p = this.p;
    const hasGpu = gpuMs !== null && gpuMs !== undefined;
    const cost = hasGpu ? gpuMs : frameMs;
    this.samples.push(cost);
    if (this.samples.length > p.windowUp) this.samples.shift();
    if (now >= this.ceilingUntil) this.ceiling = p.maxScale;
    if (now - this.lastChange < p.cooldownMs) return false;

    const n = this.samples.length;
    if (n >= p.windowDown) {
      let sum = 0;
      for (let i = n - p.windowDown; i < n; i++) sum += this.samples[i];
      const recent = sum / p.windowDown;
      const over = hasGpu ? recent > budget * 0.95 : recent > budget * 1.18;
      if (over && this.scale > p.minScale) {
        // Uma subida recente causou a queda: memoriza o teto.
        if (now - this.lastRaise < p.cooldownMs * 4) {
          this.ceiling = this.scale - p.stepUp;
          this.ceilingUntil = now + CEILING_MS;
        }
        return this.#set(Math.max(p.minScale, this.scale - p.stepDown), now);
      }
    }
    if (n >= p.windowUp && this.scale < Math.min(p.maxScale, this.ceiling)) {
      let sum = 0;
      for (let i = 0; i < n; i++) sum += this.samples[i];
      const avg = sum / n;
      const room = hasGpu ? avg < budget * p.headroom : avg <= budget * 1.04;
      const probeWait = hasGpu ? 0 : p.cooldownMs * 6; // sem GPU timer, sonda com muita calma
      if (room && now - this.lastChange > probeWait) {
        this.lastRaise = now;
        return this.#set(Math.min(p.maxScale, this.ceiling, this.scale + p.stepUp), now);
      }
    }
    return false;
  }

  #set(scale, now) {
    const rounded = Math.round(scale * 100) / 100;
    if (rounded === this.scale) return false;
    this.scale = rounded;
    this.samples.length = 0;
    this.lastChange = now;
    return true;
  }
}
