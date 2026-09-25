// Medidor de salto e queda (subfase 3.3), para a pista de testes e o cl_showpos. Por voo — pulo ou queda de uma beirada
// —: distância no plano da saída ao pouso, ápice acima da saída, tempo no ar, queda (ápice − pouso) e velocidade de
// pouso (a do evento `land` do movimento). Por série de bhop — pulos com até 1 tick no chão entre eles —: número de
// pulos, distância total, velocidade média (distância ÷ tempo da série) e máxima no plano. Teleporte (mais que 64 u num
// tick) e noclip descartam o voo e a série; o matchState também chama `interrupt()` em todo teleporte (estacao, setpos,
// respawn), perto ou longe. Na 3.4 cada voo conta os wall-jumps e o pouso guarda o dano de queda; o recorde de wall-jumps
// seguidos (num voo só) entra nos recordes. Puro: o matchState chama `update(estado, eventos)` a cada tick, como o
// medidor de counter-strafe, e o cl_showpos lê `air`, `last`, `shownSeries` e `best`.

export const AIR_KIND = Object.freeze({ JUMP: 'pulo', FALL: 'queda' });

const TELEPORT = 64; // u num tick (3500 u/s é o teto por eixo: 54,7 u por tick)
const BHOP_GROUND = 1; // ticks no chão entre dois pulos da mesma série

export class JumpMeter {
  /** @param {number} dt duração do tick (s). */
  constructor(dt = 1 / 64) {
    this.dt = dt;
    this.reset();
  }

  /** Zera tudo (cl_salto_reset). */
  reset() {
    this.air = null; // voo em andamento: { kind, x, y, z, apex, ticks, maxSpeed, walls }
    this.last = null; // último voo: { kind, distance, apex, time, drop, landSpeed, damage, walls, maxSpeed }
    this.series = null; // série de bhop em andamento: { jumps, distance, ticks, maxSpeed }
    this.lastSeries = null; // última série terminada com 2 ou mais pulos
    this.best = { distance: 0, drop: 0, series: 0, walls: 0 }; // recordes desde o reset
    this.prev = null; // pés e chão no fim do tick anterior
    this.ground = 0; // ticks seguidos terminados no chão
  }

  /** Teleporte: descarta o voo em andamento e fecha a série (os recordes e o último voo ficam). */
  interrupt() {
    this.air = null;
    this.#endSeries();
    this.prev = null;
    this.ground = 0;
  }

  /**
   * Um tick. `s`: estado de movimento depois do playerMove (origin, velocity, onGround, moveType); `events`: eventos do
   * tick (usa 'jump', 'walljump' e 'land').
   */
  update(s, events) {
    const o = s.origin;
    const prev = this.prev;
    if (s.moveType === 'noclip' || (prev && Math.hypot(o.x - prev.x, o.y - prev.y, o.z - prev.z) > TELEPORT)) {
      this.air = null;
      this.#endSeries();
      this.#remember(s);
      return this;
    }
    let jumped = false;
    let walls = 0;
    let land = null;
    for (const e of events) {
      if (e.type === 'jump') jumped = true;
      else if (e.type === 'walljump') walls++;
      else if (e.type === 'land') land = e;
    }
    const speed = Math.hypot(s.velocity.x, s.velocity.z);
    if (!this.air && (jumped || (!s.onGround && prev?.onGround))) {
      const from = prev ?? o;
      if (jumped) {
        if (!this.series || this.ground > BHOP_GROUND) {
          this.#endSeries();
          this.series = { jumps: 0, distance: 0, ticks: 0, maxSpeed: 0 };
        } else this.series.ticks += this.ground;
        this.series.jumps++;
      } else this.#endSeries();
      this.air = {
        kind: jumped ? AIR_KIND.JUMP : AIR_KIND.FALL, x: from.x, y: from.y, z: from.z, apex: from.y, ticks: 0, maxSpeed: 0,
        walls: 0,
      };
    }
    if (!this.air && walls) {
      // Wall-jump num voo que o medidor não viu começar (teleporte no ar): o voo conta daqui.
      this.air = { kind: AIR_KIND.FALL, x: o.x, y: o.y, z: o.z, apex: o.y, ticks: 0, maxSpeed: 0, walls: 0 };
    }
    if (this.air) {
      const a = this.air;
      a.ticks++;
      a.walls += walls;
      a.apex = Math.max(a.apex, o.y);
      a.maxSpeed = Math.max(a.maxSpeed, speed);
      if (a.kind === AIR_KIND.JUMP && this.series) this.series.maxSpeed = Math.max(this.series.maxSpeed, speed);
      if (s.onGround) this.#land(s, land);
    }
    if (s.onGround) {
      this.ground++;
      if (this.series && this.ground > BHOP_GROUND) this.#endSeries();
    } else this.ground = 0;
    this.#remember(s);
    return this;
  }

  #land(s, land) {
    const a = this.air;
    const o = s.origin;
    const distance = Math.hypot(o.x - a.x, o.z - a.z);
    this.last = {
      kind: a.kind, distance, apex: a.apex - a.y, time: a.ticks * this.dt, drop: a.apex - o.y,
      landSpeed: land ? land.speed : 0, damage: land?.damage ?? 0, walls: a.walls, maxSpeed: a.maxSpeed,
    };
    this.best.distance = Math.max(this.best.distance, distance);
    this.best.drop = Math.max(this.best.drop, this.last.drop);
    this.best.walls = Math.max(this.best.walls, a.walls);
    if (a.kind === AIR_KIND.JUMP && this.series) {
      this.series.distance += distance;
      this.series.ticks += a.ticks;
    }
    this.air = null;
  }

  /** Fecha a série em andamento; com 2 ou mais pulos ela vira a última série. */
  #endSeries() {
    const sr = this.series;
    this.series = null;
    if (!sr || sr.jumps < 2) return;
    this.lastSeries = { ...sr, time: sr.ticks * this.dt, avgSpeed: sr.ticks ? sr.distance / (sr.ticks * this.dt) : 0 };
    this.best.series = Math.max(this.best.series, sr.jumps);
  }

  #remember(s) {
    const o = s.origin;
    if (!this.prev) this.prev = { x: 0, y: 0, z: 0, onGround: false };
    this.prev.x = o.x;
    this.prev.y = o.y;
    this.prev.z = o.z;
    this.prev.onGround = s.onGround;
  }

  /** Série para mostrar: a em andamento (com velocidade média até agora) ou a última terminada. */
  get shownSeries() {
    const sr = this.series;
    if (sr && sr.jumps >= 2) {
      const ticks = sr.ticks + (this.air ? this.air.ticks : 0);
      return { ...sr, running: true, time: ticks * this.dt, avgSpeed: sr.ticks ? sr.distance / (sr.ticks * this.dt) : 0 };
    }
    return this.lastSeries ? { ...this.lastSeries, running: false } : null;
  }
}
