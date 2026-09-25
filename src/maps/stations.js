// Estações de mapa (MapInstance.stations; a pista de testes da 3.3 declara as suas e os mapas da Fase 6 podem declarar
// as deles): [{ number, id, label, aliases, spots: [{ id, label, position, yaw, pitch }] }]. Aqui: a altura dos pés de
// cada ponto (raio de cima para baixo no mundo de colisão), a lista para o console e a busca de `estacao [n|nome]
// [ponto]` — sem acento e sem diferenciar maiúsculas. Puro (o console e os testes usam).

import * as THREE from 'three';
import { createRayHit } from '../physics/collisionWorld.js';

const DEG = Math.PI / 180;

/** Texto de busca: minúsculo e sem acento ("Túnel" → "tunel"). */
export function searchKey(text) {
  return String(text ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

/**
 * Altura do chão em (x, z): a primeira superfície de um raio de cima para baixo a partir de `below` (y), ou null sem
 * chão até 200 u abaixo de 0.
 */
export function groundAt(world, x, z, below = 3000, hit = createRayHit()) {
  world.raycast(x, below, z, 0, -1, 0, below + 200, hit);
  return hit.hit ? hit.point.y : null;
}

/**
 * Estações prontas para o jogo: cada ponto { id, label, x, z, heading, pitch, below } vira posição com a altura do chão
 * embaixo dele (groundAt a partir de `below`) e yaw/pitch em radianos (yaw = −rumo).
 */
export function resolveStations(defs, world) {
  const hit = createRayHit();
  return defs.map((s) => ({
    number: s.number,
    id: s.id,
    label: s.label,
    aliases: [...(s.aliases ?? [])],
    spots: s.spots.map((sp) => {
      const y = groundAt(world, sp.x, sp.z, sp.below ?? 3000, hit);
      if (y === null) throw new Error(`ponto sem chão: estação ${s.id}, ${sp.id}`);
      return {
        id: sp.id,
        label: sp.label ?? sp.id,
        position: new THREE.Vector3(sp.x, y, sp.z),
        yaw: -sp.heading * DEG,
        pitch: (sp.pitch ?? 0) * DEG,
      };
    }),
  }));
}

/** Lista para o console: uma linha por estação com os pontos. */
export function describeStations(stations) {
  return stations.map((s) => {
    const spots = s.spots.map((p) => p.id).join(', ');
    return `${String(s.number).padStart(2)} ${s.id.padEnd(10)} ${s.label} — pontos: ${spots}`;
  }).join('\n');
}

/**
 * Busca de `estacao [n|nome] [ponto]`: a estação por número, id ou apelido; sem estação que case, um ponto de nome
 * único em todas (ex.: `gabarito`). Sem ponto, o primeiro da estação. Erro com as opções quando não acha.
 * @returns {{station: object, spot: object}}
 */
export function findStationSpot(stations, args) {
  const [first, second] = args.map(searchKey);
  if (!first) throw new Error('diga a estação (número ou nome)');
  const station = stations.find((s) => String(s.number) === first || searchKey(s.id) === first
    || s.aliases.some((a) => searchKey(a) === first));
  if (station) {
    if (!second) return { station, spot: station.spots[0] };
    const spot = station.spots.find((p) => searchKey(p.id) === second);
    if (!spot) throw new Error(`ponto desconhecido em ${station.id}: ${args[1]}. Pontos: ${station.spots.map((p) => p.id).join(', ')}`);
    return { station, spot };
  }
  const matches = stations.flatMap((s) => s.spots.filter((p) => searchKey(p.id) === first).map((spot) => ({ station: s, spot })));
  if (matches.length === 1 && !second) return matches[0];
  if (matches.length > 1) {
    throw new Error(`"${args[0]}" é ponto de mais de uma estação (${matches.map((m) => m.station.id).join(', ')}): use estacao <estação> ${args[0]}`);
  }
  throw new Error(`estação desconhecida: ${args[0]}. Estações: ${stations.map((s) => `${s.number} ${s.id}`).join(', ')}`);
}
