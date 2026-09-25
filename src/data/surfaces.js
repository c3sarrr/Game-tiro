// Materiais de superfície da colisão. Cada triângulo de colisão guarda o índice do seu material
// (src/physics/colliders.js). Campos:
//   friction: multiplica o sv_friction e a aceleração no chão (o competitivo usa 1 em tudo, como os mapas do CS)
//   jumpFactor: multiplica o impulso do pulo
//   imprint: aceita pegadas (massinha)
//   stepSlow, stepFast: volume do passo nas classes lenta e rápida do CS:GO (áudio da Fase 12 e audição dos bots da
//     Fase 7). Duros como o concreto do CS (0,2/0,5); papelão e plástico um pouco mais; metal e arame como os dutos
//     do CS (0,4/0,7); massinha e tecido abaixo de tudo — o CS não tem superfícies moles, é escolha nossa.

const S = (o) => Object.freeze(o);

export const SURFACES = Object.freeze([
  S({
    id: 'padrao', label: 'Padrão', friction: 1, jumpFactor: 1, imprint: false,
    stepSlow: 0.2, stepFast: 0.5,
  }),
  S({
    id: 'tapete', label: 'Tapete de corte', friction: 1, jumpFactor: 1, imprint: false,
    stepSlow: 0.2, stepFast: 0.5,
  }),
  S({
    id: 'papelao', label: 'Papelão', friction: 1, jumpFactor: 1, imprint: false,
    stepSlow: 0.25, stepFast: 0.55,
  }),
  S({
    id: 'massinha', label: 'Massinha', friction: 1, jumpFactor: 1, imprint: true,
    stepSlow: 0.15, stepFast: 0.4,
  }),
  S({
    id: 'madeira', label: 'Madeira', friction: 1, jumpFactor: 1, imprint: false,
    stepSlow: 0.2, stepFast: 0.5,
  }),
  S({
    id: 'metal', label: 'Metal de ferramenta', friction: 1, jumpFactor: 1, imprint: false,
    stepSlow: 0.4, stepFast: 0.7,
  }),
  S({
    id: 'plastico', label: 'Plástico de pote', friction: 1, jumpFactor: 1, imprint: false,
    stepSlow: 0.25, stepFast: 0.55,
  }),
  S({
    id: 'fita', label: 'Fita crepe', friction: 1, jumpFactor: 1, imprint: false,
    stepSlow: 0.2, stepFast: 0.5,
  }),
  S({
    id: 'arame', label: 'Arame', friction: 1, jumpFactor: 1, imprint: false,
    stepSlow: 0.4, stepFast: 0.7,
  }),
  S({
    id: 'tecido', label: 'Tecido (molleton)', friction: 1, jumpFactor: 1, imprint: false,
    stepSlow: 0.1, stepFast: 0.3,
  }),
]);

export const SURFACE_INDEX = Object.freeze(Object.fromEntries(SURFACES.map((s, i) => [s.id, i])));

/** Índice do material (aceita id ou índice); erro para material desconhecido — pega erro de digitação no mapa. */
export function surfaceIndex(id) {
  if (typeof id === 'number') {
    if (Number.isInteger(id) && id >= 0 && id < SURFACES.length) return id;
    throw new Error(`superfície desconhecida: ${id}`);
  }
  const i = SURFACE_INDEX[id];
  if (i === undefined) throw new Error(`superfície desconhecida: ${id}`);
  return i;
}
