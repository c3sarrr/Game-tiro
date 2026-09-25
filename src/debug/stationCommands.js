// Comando `estacao` (subfase 3.3): sem argumento lista as estações do mapa (MapInstance.stations) com os pontos; com
// argumento teleporta para uma estação ou ponto — `estacao 7 900`, `estacao bhop`, `estacao gabarito`. O teleporte é
// o do jogador (zera a velocidade e procura o chão) e interrompe o voo do medidor de salto. A busca (número, id,
// apelido ou ponto de nome único; sem acento) fica em src/maps/stations.js.

import { describeStations, findStationSpot } from '../maps/stations.js';

/** @param {{matchState: () => object|null}} ctx */
export function registerStationCommands(con, { matchState }) {
  const current = () => {
    const m = matchState();
    if (!m?.map) throw new Error('só funciona dentro de uma partida');
    const stations = m.map.stations;
    if (!stations?.length) throw new Error(`o mapa ${m.map.id} não tem estações (a pista de testes tem: map pista)`);
    return { m, stations };
  };
  con.register({
    name: 'estacao',
    aliases: ['estação', 'estacoes', 'estações'],
    usage: '[n|nome] [ponto]',
    help: 'lista as estações do mapa ou teleporta para uma (ex.: estacao 7 900, estacao bhop, estacao gabarito)',
    complete: (index) => {
      const m = matchState();
      const stations = m?.map?.stations ?? [];
      if (index === 0) {
        return [...new Set(stations.flatMap((st) => [String(st.number), st.id, ...st.aliases, ...st.spots.map((p) => p.id)]))];
      }
      return index === 1 ? [...new Set(stations.flatMap((st) => st.spots.map((p) => p.id)))] : [];
    },
    run: (args) => {
      const { m, stations } = current();
      if (!args.length) return describeStations(stations);
      const { station, spot } = findStationSpot(stations, args);
      m.teleport(spot.position, spot.yaw, spot.pitch);
      return `estação ${station.number} · ${station.label} — ${spot.label}`;
    },
  });
}
