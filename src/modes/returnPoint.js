// Ponto de volta do respawn (subfase 3.4): o último teleporte do console neste mapa (`estacao`, `setpos`); sem ele, o
// spawn. Um ponto que não se sustenta — o mundo mata o jogador (queda fatal, cair do set; ou ele cai do set com god)
// antes de ele ficar de pé, vivo, no chão desde que chegou nele: teleporte para o vazio ou para o alto — sai na hora:
// senão cada volta repetiria a mesma morte a cada 2 s. Morte pelo console (kill, hurtme) não diz nada sobre o ponto.
// Quem usa (MatchState): `set` no teleporte, `placed` depois da volta, `update` depois de cada tick do jogador e
// `failed` na morte e na queda para fora do set.

/** Causas de morte (src/data/vitals.js) que julgam o ponto: as do mundo, não as do console. */
const WORLD_CAUSES = new Set(['queda', 'fora']);

export class ReturnPoint {
  constructor() {
    this.point = null; // {position, yaw, pitch} ou null (o spawn)
    this.grounded = false; // ficou de pé, vivo, no chão desde a última colocação no ponto
  }

  /** Teleporte do console: vira o ponto de volta (cópia da posição) e ainda precisa do chão para valer. */
  set(position, yaw, pitch) {
    this.point = { position: position.clone(), yaw, pitch };
    this.grounded = false;
  }

  /** O jogador voltou para o ponto (respawn): precisa pisar vivo no chão de novo. */
  placed() {
    this.grounded = false;
  }

  /** Depois de cada tick do jogador: de pé no chão, vivo, o ponto se sustenta. */
  update(alive, onGround) {
    if (alive && onGround) this.grounded = true;
  }

  /**
   * Morte (a causa) ou queda para fora do set com god ('fora'): se o mundo matou o jogador antes de ele pisar no chão
   * desde que chegou, o ponto sai.
   */
  failed(cause) {
    if (!this.grounded && WORLD_CAUSES.has(cause)) this.point = null;
  }

  /** Onde voltar: o ponto de volta ou o spawn do mapa. */
  pick(spawn) {
    return this.point ?? spawn;
  }

  /** Saída do mapa: nada de ponto para a próxima partida. */
  clear() {
    this.point = null;
    this.grounded = false;
  }
}
