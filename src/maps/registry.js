// Registro de mapas/cenas jogáveis. Cada definição:
//   { id, label, description, kind: 'teste'|'competitivo', aliases?: string[], build(ctx) → Promise<MapInstance> }
// MapInstance: { id, scene, spawn:{position, yaw, pitch}, bounds: Box3|null, frame?(dt, camera), tick?(dt), dispose(),
//   post?: {context, exposure}, move?: {speedScale}, panel?: {root, open(), close()} (Tab solta o mouse para ele),
//   staticShadows?: boolean (nada que projeta sombra se move: o mapa de sombra só é refeito quando algo pede),
//   collision?: CollisionWorld (mapa andável: o jogador anda com a cápsula; sem ela, voa com a câmera livre),
//   stations?: [{ number, id, label, aliases, spots: [{ id, label, position, yaw, pitch }] }] (console `estacao`;
//   src/maps/stations.js) }
// O console (`map <id>`), o lobby e o menu listam o que estiver registrado aqui.

const MAPS = new Map();

export function registerMap(def) {
  if (!def?.id || typeof def.build !== 'function') throw new Error('definição de mapa inválida');
  if (MAPS.has(def.id)) throw new Error(`mapa já registrado: ${def.id}`);
  MAPS.set(def.id, Object.freeze({ aliases: [], ...def }));
}

export function getMapDef(idOrAlias) {
  const key = String(idOrAlias ?? '').toLowerCase();
  if (MAPS.has(key)) return MAPS.get(key);
  for (const def of MAPS.values()) if (def.aliases.includes(key)) return def;
  return null;
}

export function listMaps() {
  return [...MAPS.values()];
}
