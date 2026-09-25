// Telemetria do jogador para o debug (Fase 3.2): os últimos 256 ticks (4 s a 64 Hz) em arrays fixos — velocidade no
// plano, teto do tick, velocidade da arma no modo atual, limiar de precisão, inaccuracy, desejo e velocidade no plano e
// as marcas (chão, andando, FL_DUCKING; slide e wall-jump na 3.4). O gráfico do cl_showpos e o medidor de
// counter-strafe leem daqui; gravar não aloca.

export const TELEMETRY_SIZE = 256;

/** Marcas de cada amostra. */
export const TFLAG = Object.freeze({ GROUND: 1, WALK: 2, DUCK: 4, SLIDE: 8, WALLJUMP: 16 });

export class Telemetry {
  constructor(size = TELEMETRY_SIZE) {
    this.size = size;
    this.count = 0; // amostras gravadas desde o começo; a última é a de índice count − 1
    this.speed = new Float32Array(size);
    this.cap = new Float32Array(size);
    this.weaponSpeed = new Float32Array(size);
    this.threshold = new Float32Array(size);
    this.inaccuracy = new Float32Array(size);
    this.wishX = new Float32Array(size);
    this.wishZ = new Float32Array(size);
    this.velX = new Float32Array(size);
    this.velZ = new Float32Array(size);
    this.flags = new Uint8Array(size);
  }

  /** Posição no anel da amostra de índice absoluto `i`. */
  slot(i) {
    return ((i % this.size) + this.size) % this.size;
  }

  /** Grava a amostra do tick (sempre a próxima). */
  record(speed, cap, weaponSpeed, threshold, inaccuracy, wishX, wishZ, velX, velZ, flags) {
    const j = this.slot(this.count);
    this.speed[j] = speed;
    this.cap[j] = cap;
    this.weaponSpeed[j] = weaponSpeed;
    this.threshold[j] = threshold;
    this.inaccuracy[j] = inaccuracy;
    this.wishX[j] = wishX;
    this.wishZ[j] = wishZ;
    this.velX[j] = velX;
    this.velZ[j] = velZ;
    this.flags[j] = flags;
    this.count++;
  }

  /** Quantas amostras estão guardadas (até o tamanho do anel). */
  get length() {
    return Math.min(this.count, this.size);
  }

  reset() {
    this.count = 0;
  }
}
