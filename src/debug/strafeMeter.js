// Medidor de counter-strafe (Fase 3.2), sobre a telemetria do jogador (src/player/telemetry.js): quanto tempo leva, a
// partir do tick em que o jogador para de correr, até a velocidade ficar abaixo do limiar de precisão da arma na mão.
// Dois tipos: "soltar" (largou o movimento) e "contra" (o desejo passou a apontar contra a velocidade, cosseno < −0,5 —
// o counter-strafe). Começa com o jogador no chão, acima do limiar, vindo de um tick em que corria na direção da
// velocidade; termina no primeiro tick abaixo do limiar; cancela se o desejo voltar para o lado do movimento ou se o
// jogador sair do chão. Puro: o matchState chama `updateFrom` a cada tick e o cl_showpos lê o placar e as marcas.

import { TFLAG } from '../player/telemetry.js';

export const STRAFE_KIND = Object.freeze({ RELEASE: 'soltar', COUNTER: 'contra' });

const COUNTER_COS = -0.5; // desejo contra a velocidade
const RUNNING_COS = 0.5; // correndo na direção da velocidade (tick anterior ao começo)
const RECENT = 10; // a média usa as 10 últimas medidas de cada tipo
const EPS = 1e-6;

function createScore() {
  return { count: 0, lastTicks: 0, last: null, best: null, avg: null, recent: [] };
}

/** Cosseno entre (ax, az) e (bx, bz); 0 se algum for nulo. */
function cosine(ax, az, bx, bz) {
  const la = Math.hypot(ax, az);
  const lb = Math.hypot(bx, bz);
  return la > EPS && lb > EPS ? (ax * bx + az * bz) / (la * lb) : 0;
}

export class StrafeMeter {
  /** @param {number} dt duração do tick (s), para converter ticks em ms. */
  constructor(dt = 1 / 64) {
    this.dt = dt;
    this.cursor = 0; // próxima amostra da telemetria a processar
    this.kind = null; // medida em andamento (STRAFE_KIND) ou null
    this.start = 0; // amostra do tick em que ela começou
    this.canceled = 0;
    this.scores = { [STRAFE_KIND.RELEASE]: createScore(), [STRAFE_KIND.COUNTER]: createScore() };
    this.marks = []; // medidas ainda dentro da janela da telemetria: {kind, ticks, ms, end}
  }

  /** Processa as amostras novas da telemetria (normalmente uma por tick). */
  updateFrom(telemetry) {
    const t = telemetry;
    if (t.count < this.cursor) this.#restart(); // a telemetria foi zerada: tudo o que ela tem agora é novo
    // Atrasado mais que o anel: começa pela amostra mais antiga que ainda tem a anterior guardada.
    const oldest = Math.max(1, t.count - t.size + 1);
    if (this.cursor < oldest) {
      this.kind = null;
      this.cursor = oldest;
    }
    for (; this.cursor < t.count; this.cursor++) this.#step(t, this.cursor);
    const floor = t.count - t.size;
    while (this.marks.length && this.marks[0].end < floor) this.marks.shift();
    return this;
  }

  /** Zera o placar e as marcas (cl_strafe_reset); a telemetria continua de onde está. */
  reset() {
    this.kind = null;
    this.canceled = 0;
    this.scores = { [STRAFE_KIND.RELEASE]: createScore(), [STRAFE_KIND.COUNTER]: createScore() };
    this.marks = [];
  }

  #restart() {
    this.kind = null;
    this.cursor = 0;
    this.marks = [];
  }

  #step(t, i) {
    if (i === 0) return;
    const a = t.slot(i - 1);
    const b = t.slot(i);
    const onGround = (t.flags[b] & TFLAG.GROUND) !== 0;
    const wx = t.wishX[b];
    const wz = t.wishZ[b];
    const wishing = Math.hypot(wx, wz) > EPS;
    // Desejo deste tick contra a velocidade com que ele começou (a do fim do tick anterior).
    const cos = cosine(wx, wz, t.velX[a], t.velZ[a]);
    if (this.kind) {
      if (!onGround || (wishing && cos > 0)) {
        this.kind = null;
        this.canceled++;
        return;
      }
    } else {
      const wasRunning = (t.flags[a] & TFLAG.GROUND) !== 0 && t.speed[a] > t.threshold[a]
        && cosine(t.wishX[a], t.wishZ[a], t.velX[a], t.velZ[a]) > RUNNING_COS;
      if (!onGround || !wasRunning) return;
      if (!wishing) this.kind = STRAFE_KIND.RELEASE;
      else if (cos < COUNTER_COS) this.kind = STRAFE_KIND.COUNTER;
      else return;
      this.start = i;
    }
    if (t.speed[b] < t.threshold[b]) this.#finish(i);
  }

  #finish(i) {
    const ticks = i - this.start + 1;
    const ms = ticks * this.dt * 1000;
    const s = this.scores[this.kind];
    s.count++;
    s.lastTicks = ticks;
    s.last = ms;
    s.best = s.best === null ? ms : Math.min(s.best, ms);
    s.recent.push(ms);
    if (s.recent.length > RECENT) s.recent.shift();
    s.avg = s.recent.reduce((sum, v) => sum + v, 0) / s.recent.length;
    this.marks.push({ kind: this.kind, ticks, ms, end: i });
    this.kind = null;
  }
}
