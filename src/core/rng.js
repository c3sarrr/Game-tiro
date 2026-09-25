// Gerador de números aleatórios com seed (determinístico): sfc32 semeado por cyrb128.
// Usado para spread das armas, eventos de rodada, IA e tudo que precisa se repetir em replay/rede.
// O estado cabe em 4 inteiros de 32 bits (getState/setState) e viaja em snapshots.

/** Hash de 128 bits (cyrb128) de uma string → 4 inteiros de 32 bits. */
export function hash128(str) {
  let h1 = 1779033703;
  let h2 = 3144134277;
  let h3 = 1013904242;
  let h4 = 2773480762;
  for (let i = 0, k; i < str.length; i++) {
    k = str.charCodeAt(i);
    h1 = h2 ^ Math.imul(h1 ^ k, 597399067);
    h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
    h3 = h4 ^ Math.imul(h3 ^ k, 951274213);
    h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
  }
  h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067);
  h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
  h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213);
  h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);
  h1 ^= h2 ^ h3 ^ h4;
  h2 ^= h1;
  h3 ^= h1;
  h4 ^= h1;
  return [h1 >>> 0, h2 >>> 0, h3 >>> 0, h4 >>> 0];
}

/** Hash de 32 bits de uma string (ex.: seed de objeto a partir do nome). */
export function hashString(str) {
  return hash128(String(str))[0];
}

/** Seed aleatória vinda do gerador criptográfico do navegador (ou Math.random em último caso). */
export function randomSeed() {
  if (globalThis.crypto?.getRandomValues) return globalThis.crypto.getRandomValues(new Uint32Array(1))[0];
  return (Math.random() * 4294967296) >>> 0;
}

export class RNG {
  constructor(seed = randomSeed()) {
    this.a = 0;
    this.b = 0;
    this.c = 0;
    this.d = 0;
    this.reseed(seed);
  }

  reseed(seed) {
    const [a, b, c, d] = hash128(typeof seed === 'number' ? `n:${seed}` : `s:${seed}`);
    this.a = a;
    this.b = b;
    this.c = c;
    this.d = d;
    // Aquece o gerador para descorrelacionar seeds parecidas.
    for (let i = 0; i < 12; i++) this.nextU32();
    return this;
  }

  /** Próximo inteiro sem sinal de 32 bits (sfc32). */
  nextU32() {
    let { a, b, c, d } = this;
    const t = (((a + b) | 0) + d) | 0;
    d = (d + 1) | 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) | 0;
    c = (c << 21) | (c >>> 11);
    c = (c + t) | 0;
    this.a = a;
    this.b = b;
    this.c = c;
    this.d = d;
    return t >>> 0;
  }

  /** [0, 1) */
  next() {
    return this.nextU32() / 4294967296;
  }

  float(min = 0, max = 1) {
    return min + (max - min) * this.next();
  }

  /** Inteiro em [min, max] (inclusivo). */
  int(min, max) {
    return min + Math.floor(this.next() * (max - min + 1));
  }

  bool(p = 0.5) {
    return this.next() < p;
  }

  sign() {
    return this.next() < 0.5 ? -1 : 1;
  }

  pick(arr) {
    return arr[Math.floor(this.next() * arr.length)];
  }

  /** Embaralha no lugar (Fisher–Yates) e devolve o próprio array. */
  shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      const tmp = arr[i];
      arr[i] = arr[j];
      arr[j] = tmp;
    }
    return arr;
  }

  /** Normal (Box–Muller). */
  gaussian(mean = 0, sd = 1) {
    let u = 0;
    while (u <= Number.EPSILON) u = this.next();
    const v = this.next();
    return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }

  /** Ponto uniforme no disco unitário. */
  inUnitCircle(out = { x: 0, y: 0 }) {
    const r = Math.sqrt(this.next());
    const t = this.next() * Math.PI * 2;
    out.x = r * Math.cos(t);
    out.y = r * Math.sin(t);
    return out;
  }

  /** Direção uniforme na esfera unitária. */
  onUnitSphere(out = { x: 0, y: 0, z: 0 }) {
    const z = this.next() * 2 - 1;
    const t = this.next() * Math.PI * 2;
    const r = Math.sqrt(1 - z * z);
    out.x = r * Math.cos(t);
    out.y = r * Math.sin(t);
    out.z = z;
    return out;
  }

  getState() {
    return [this.a >>> 0, this.b >>> 0, this.c >>> 0, this.d >>> 0];
  }

  setState(state) {
    [this.a, this.b, this.c, this.d] = state.map((v) => v | 0);
    return this;
  }

  clone() {
    return new RNG(0).setState(this.getState());
  }

  /** Gera um RNG filho determinístico (ex.: fork('spread') e fork('round') da mesma seed de partida). */
  fork(label) {
    return new RNG(`${this.getState().join(':')}|${label}`);
  }
}
