// Comandos da vida do jogador local (subfase 3.4): `kill` (o do CS: morte na hora, volta em 2 s) e `hurtme <n>` (o
// cheat do Source: dano do tipo mundo, que o colete não reduz; `god` segura). Falam com o PlayerPawn da partida andando.

/** @param {{matchState: () => object|null, cheats: {god: boolean}}} ctx */
export function registerVitalsCommands(con, { matchState, cheats }) {
  /** Jogador andando da partida (tem vida); erro fora dela. */
  const pawn = () => {
    const p = matchState()?.player;
    if (!p?.vitals) throw new Error('só numa partida andando (mapa com colisão)');
    return p;
  };
  con.register({
    name: 'kill',
    help: 'morte na hora do jogador local (volta em 2 s)',
    run: () => (pawn().kill('kill') ? 'você desistiu' : 'já está morto'),
  });
  con.register({
    name: 'hurtme',
    usage: '<dano>',
    help: 'dano do tipo mundo no jogador local (god segura)',
    run: ([n]) => {
      const p = pawn();
      const amount = Number(n);
      if (!(amount > 0)) throw new Error('dano inválido: use um número maior que 0 (ex.: hurtme 26)');
      if (!p.vitals.alive) return 'já está morto';
      if (cheats.god) return 'god ligado: nenhum dano';
      const r = p.hurt(amount, 'mundo', { god: false });
      return r.killed ? `dano ${amount}: morreu` : `dano ${amount} → vida ${p.vitals.health}`;
    },
  });
}
