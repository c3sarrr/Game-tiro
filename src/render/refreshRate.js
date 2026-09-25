// Estimativa do intervalo de atualização do monitor (vsync) pela cadência do requestAnimationFrame.
// Só recebe amostras de quadros "leves" (sem cena 3D: menus e telas), quando o tempo entre quadros é o
// próprio vsync. Serve de piso para o orçamento da resolução dinâmica: num monitor de 60 Hz não adianta
// perseguir 144 FPS derrubando a resolução, e com limite de FPS o orçamento é o do limite.

const WINDOW = 90;
const MIN_SAMPLES = 20;

export class RefreshEstimator {
  constructor() {
    this.samples = new Float32Array(WINDOW);
    this.sorted = new Float32Array(WINDOW);
    this.count = 0;
    this.index = 0;
    this.intervalMs = 0; // 0 = ainda desconhecido
  }

  /** Registra a duração de um quadro leve (ms). Quadros travados (> 100 ms) ou duplicados são ignorados. */
  sample(frameMs) {
    if (!(frameMs > 2 && frameMs < 100)) return;
    this.samples[this.index] = frameMs;
    this.index = (this.index + 1) % WINDOW;
    if (this.count < WINDOW) this.count++;
    if (this.count >= MIN_SAMPLES && this.index % 10 === 0) this.#estimate();
  }

  #estimate() {
    const n = this.count;
    const view = this.sorted.subarray(0, n);
    view.set(n === WINDOW ? this.samples : this.samples.subarray(0, n));
    view.sort();
    // Mediana: robusta a quadros perdidos (que dobram o intervalo) e a rajadas curtas.
    const mid = n >> 1;
    this.intervalMs = n % 2 ? view[mid] : (view[mid - 1] + view[mid]) / 2;
  }

  get hz() {
    return this.intervalMs > 0 ? 1000 / this.intervalMs : 0;
  }

  reset() {
    this.count = 0;
    this.index = 0;
    this.intervalMs = 0;
  }
}
