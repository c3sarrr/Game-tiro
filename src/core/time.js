// Relógios globais do jogo.
// - `clock`: estado de tempo compartilhado (tick da simulação, tempo real, alpha de interpolação, pose stop-motion).
//   É lido por shaders (uniforms), animação e debug. Atualizado apenas pelo loop em main.js.
// - `StopMotionClock`: gera o "passo" de animação stop-motion a 12 poses/s (animar "em dois").
//   Personagens, viewmodel e o boil da massinha só mudam de forma quando a pose muda;
//   câmera e input continuam a 60+ FPS.

export const clock = {
  tick: 0, // ticks de simulação (64 Hz) desde o boot
  simTime: 0, // segundos simulados
  realTime: 0, // segundos reais desde o boot (performance.now)
  frame: 0, // quadros renderizados
  frameDt: 0, // duração do último quadro (s)
  alpha: 0, // fração entre o tick anterior e o próximo (interpolação do render)
  pose: 0, // índice da pose stop-motion atual
  poseChanged: false, // a pose mudou neste quadro?
  posePhase: 0, // 0..1 dentro da pose atual
};

export class StopMotionClock {
  constructor({ fps = 12 } = {}) {
    this.fps = fps;
    this.pose = 0;
    this.accumulator = 0;
    this.enabled = true;
  }

  /** Avança pelo tempo real do quadro. Devolve true se a pose mudou. */
  update(dt) {
    if (!this.enabled) return false;
    this.accumulator += dt;
    const step = 1 / this.fps;
    let changed = false;
    // Após travadas longas não gera dezenas de poses: no máximo uma troca por quadro.
    if (this.accumulator >= step) {
      this.accumulator %= step;
      this.pose++;
      changed = true;
    }
    return changed;
  }

  get phase() {
    return Math.min(1, this.accumulator * this.fps);
  }
}
