// Loop principal: simulação em passo fixo (64 Hz, tick estilo CS) desacoplada do render.
// - A cada quadro (requestAnimationFrame) o tempo real alimenta um acumulador; rodam N ticks de 1/64 s
//   e o render recebe `alpha` (0..1) para interpolar entre o estado anterior e o atual.
// - Limites contra a "espiral da morte": quadro máximo de 250 ms e no máximo 8 ticks por quadro
//   (o excedente é descartado e contado em stats.droppedTicks).
// - Aba em segundo plano: o navegador congela o rAF. Com `keepAliveWhenHidden` (host de partida online),
//   um Worker de timer mantém os ticks rodando sem render, para a partida não parar para os outros.

/**
 * Planeja quantos ticks rodar dado o acumulador e o tempo do quadro. Função pura (testada em /tests).
 * @returns {{steps:number, accumulator:number, dropped:number, alpha:number}}
 */
export function planSteps(accumulator, frameDt, stepDt, maxSteps) {
  let acc = accumulator + frameDt;
  let steps = 0;
  while (acc >= stepDt && steps < maxSteps) {
    acc -= stepDt;
    steps++;
  }
  let dropped = 0;
  if (acc >= stepDt) {
    dropped = Math.floor(acc / stepDt);
    acc -= dropped * stepDt;
  }
  return { steps, accumulator: acc, dropped, alpha: acc / stepDt };
}

/**
 * Limite de FPS sem deriva. Os quadros apresentados seguem uma grade ideal (0, 1/cap, 2/cap...) em vez de
 * "agora + intervalo": com limite 50 num monitor de 60 Hz a média fica em 50 (e não cai para 30), e o
 * jitter do vsync não faz quadros extras escaparem do limite.
 */
export class FramePacer {
  constructor() {
    this.next = -Infinity; // horário ideal (ms) do próximo quadro apresentado
  }

  reset() {
    this.next = -Infinity;
  }

  /** true se o quadro do rAF em `nowMs` deve rodar com o limite `fpsCap` (0 = sem limite). */
  shouldPresent(nowMs, fpsCap) {
    if (!(fpsCap > 0)) {
      this.next = -Infinity;
      return true;
    }
    const interval = 1000 / fpsCap;
    // 0,5 ms de folga para o quadro não escapar por jitter do vsync.
    if (nowMs < this.next - 0.5) return false;
    this.next += interval;
    // Atrasado mais de um intervalo (travada, limite acima da taxa do monitor, primeiro quadro): realinha.
    if (this.next < nowMs) this.next = nowMs + interval;
    return true;
  }
}

const FRAME_HISTORY = 240;

export class FixedStepLoop {
  constructor({
    hz = 64,
    maxFrameSeconds = 0.25,
    maxSteps = 8,
    onTick,
    onFrame,
    now = () => performance.now(),
  } = {}) {
    this.hz = hz;
    this.stepDt = 1 / hz;
    this.maxFrameSeconds = maxFrameSeconds;
    this.maxSteps = maxSteps;
    this.onTick = onTick;
    this.onFrame = onFrame;
    this.now = now;

    this.timeScale = 1; // câmera lenta/rápida (comando `timescale`)
    this.fpsCap = 0; // 0 = sem limite (vsync)
    this.keepAliveWhenHidden = false;

    this.tick = 0;
    this.simTime = 0;
    this.accumulator = 0;
    this.running = false;

    this.stats = {
      fps: 0,
      frameMs: 0,
      low1Fps: 0, // "1% low" dos últimos quadros
      cpuTickMs: 0,
      cpuFrameMs: 0,
      stepsLastFrame: 0,
      droppedTicks: 0,
      ticksPerSecond: 0,
      frameTimes: new Float32Array(FRAME_HISTORY),
      frameIndex: 0,
    };

    this._raf = 0;
    this._last = 0;
    this.pacer = new FramePacer();
    this._secondStart = 0;
    this._secondFrames = 0;
    this._secondTicks = 0;
    this._worker = null;
    this._workerUrl = null;
    this._lastRaf = 0;
    this._watchdog = 0;
    this._fallback = 0;
    this._onVisibility = () => this.#handleVisibility();
    this._rafCb = (t) => this.#rafFrame(t);
  }

  start() {
    if (this.running) return;
    this.running = true;
    this._last = this.now();
    this._lastRaf = this._last;
    this._secondStart = this._last;
    this._raf = requestAnimationFrame(this._rafCb);
    document.addEventListener('visibilitychange', this._onVisibility);
    // Watchdog: algumas webviews embutidas param o rAF com a página "visível" (sem pintar).
    // Nesse caso o loop segue por setTimeout (~60 Hz) até o rAF voltar. Em navegadores comuns nunca dispara.
    this._watchdog = setInterval(() => this.#checkStall(), 250);
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this._raf);
    clearInterval(this._watchdog);
    clearTimeout(this._fallback);
    this._fallback = 0;
    this.#stopWorker();
    document.removeEventListener('visibilitychange', this._onVisibility);
  }

  /** true enquanto o loop está sendo movido pelo fallback de setTimeout. */
  get usingFallback() {
    return this._fallback !== 0;
  }

  #checkStall() {
    if (!this.running || document.hidden || this._fallback) return;
    if (this.now() - this._lastRaf > 400) this.#fallbackFrame();
  }

  #fallbackFrame() {
    this._fallback = 0;
    if (!this.running || document.hidden) return;
    if (this.now() - this._lastRaf <= 400) return; // o rAF voltou
    this.frame(this.now(), true);
    this._fallback = setTimeout(() => this.#fallbackFrame(), 16);
  }

  /** Executa um quadro completo com um timestamp explícito (ms). Usado pelo rAF e por testes. */
  frame(nowMs, render = true) {
    let frameDt = (nowMs - this._last) / 1000;
    this._last = nowMs;
    if (!(frameDt > 0)) frameDt = 0;
    if (frameDt > this.maxFrameSeconds) frameDt = this.maxFrameSeconds;

    // Antes dos ticks: leitura de dispositivos (controle) e olhar acumulado do quadro.
    this.onFrameStart?.(frameDt, nowMs);

    const plan = planSteps(this.accumulator, frameDt * this.timeScale, this.stepDt, this.maxSteps);
    this.accumulator = plan.accumulator;
    this.stats.droppedTicks += plan.dropped;

    const t0 = this.now();
    for (let i = 0; i < plan.steps; i++) {
      this.onTick?.(this.stepDt, this.tick);
      this.tick++;
      this.simTime += this.stepDt;
    }
    const t1 = this.now();
    this.stats.cpuTickMs = t1 - t0;
    this.stats.stepsLastFrame = plan.steps;
    this._secondTicks += plan.steps;

    if (render) {
      this.onFrame?.(plan.alpha, frameDt, nowMs);
      this.stats.cpuFrameMs = this.now() - t1;
      this.#recordFrame(frameDt, nowMs);
    }
    return plan;
  }

  #rafFrame(t) {
    if (!this.running) return;
    this._raf = requestAnimationFrame(this._rafCb);
    const nowMs = this.now();
    this._lastRaf = nowMs;
    if (this._fallback) {
      clearTimeout(this._fallback);
      this._fallback = 0;
    }
    if (!this.pacer.shouldPresent(nowMs, this.fpsCap)) return;
    this.frame(nowMs, true);
  }

  #recordFrame(frameDt, nowMs) {
    const s = this.stats;
    s.frameMs = frameDt * 1000;
    s.frameTimes[s.frameIndex] = s.frameMs;
    s.frameIndex = (s.frameIndex + 1) % FRAME_HISTORY;
    this._secondFrames++;
    const elapsed = nowMs - this._secondStart;
    if (elapsed >= 500) {
      s.fps = (this._secondFrames * 1000) / elapsed;
      s.ticksPerSecond = (this._secondTicks * 1000) / elapsed;
      this._secondFrames = 0;
      this._secondTicks = 0;
      this._secondStart = nowMs;
      // 1% low: média do pior 1% dos quadros do histórico.
      const sorted = Array.from(s.frameTimes).filter((v) => v > 0).sort((a, b) => b - a);
      if (sorted.length) {
        const n = Math.max(1, Math.floor(sorted.length * 0.01));
        let sum = 0;
        for (let i = 0; i < n; i++) sum += sorted[i];
        s.low1Fps = 1000 / (sum / n);
      }
    }
  }

  #handleVisibility() {
    if (document.hidden) {
      if (this.keepAliveWhenHidden) this.#startWorker();
    } else {
      this.#stopWorker();
      // Evita um "salto" enorme ao voltar: descarta o tempo parado.
      this._last = this.now();
      this.accumulator = 0;
    }
  }

  #startWorker() {
    if (this._worker || typeof Worker === 'undefined') return;
    const src = `setInterval(() => postMessage(0), ${(1000 / this.hz).toFixed(3)});`;
    this._workerUrl = URL.createObjectURL(new Blob([src], { type: 'text/javascript' }));
    this._worker = new Worker(this._workerUrl);
    this._last = this.now();
    this._worker.onmessage = () => {
      if (this.running && document.hidden) this.frame(this.now(), false);
    };
  }

  #stopWorker() {
    if (!this._worker) return;
    this._worker.terminate();
    URL.revokeObjectURL(this._workerUrl);
    this._worker = null;
    this._workerUrl = null;
  }
}
