// Níveis de inteligência dos bots (seção 0.11). Âncoras da tabela do PROMPT 0 (níveis 1, 3, 5, 7, 9, 10);
// os níveis intermediários interpolam linearmente os parâmetros numéricos.
// O bot nunca recebe "wallhack": estes números só afetam a execução do que ele percebeu.

const ANCHORS = Object.freeze([
  Object.freeze({
    level: 1, name: 'Massinha Mole',
    reactionMs: 900, aimErrorDeg: 9, sprayControl: 0, trackingDegPerSec: 90, headAimBias: 0.05,
    crosshairPlacement: 0.05, counterStrafe: 0, utilityUse: 0, aggression: 0.15, economyDiscipline: 0,
    tactics: Object.freeze(['linhaReta']),
  }),
  Object.freeze({
    level: 3, name: 'Aprendiz',
    reactionMs: 600, aimErrorDeg: 6, sprayControl: 0.2, trackingDegPerSec: 150, headAimBias: 0.15,
    crosshairPlacement: 0.25, counterStrafe: 0.15, utilityUse: 0.1, aggression: 0.3, economyDiscipline: 0.2,
    tactics: Object.freeze(['coberturaAsVezes']),
  }),
  Object.freeze({
    level: 5, name: 'Modelador',
    reactionMs: 400, aimErrorDeg: 3.5, sprayControl: 0.5, trackingDegPerSec: 230, headAimBias: 0.35,
    crosshairPlacement: 0.5, counterStrafe: 0.45, utilityUse: 0.45, aggression: 0.5, economyDiscipline: 0.5,
    tactics: Object.freeze(['cobertura', 'flanco', 'granadaHE', 'flash']),
  }),
  Object.freeze({
    level: 7, name: 'Escultor',
    reactionMs: 280, aimErrorDeg: 1.8, sprayControl: 0.75, trackingDegPerSec: 320, headAimBias: 0.55,
    crosshairPlacement: 0.75, counterStrafe: 0.7, utilityUse: 0.7, aggression: 0.6, economyDiscipline: 0.75,
    tactics: Object.freeze(['cobertura', 'flanco', 'granadaHE', 'flash', 'preMira', 'trade', 'smokeLineup']),
  }),
  Object.freeze({
    level: 9, name: 'Mestre do Stop-Motion',
    reactionMs: 190, aimErrorDeg: 0.9, sprayControl: 0.93, trackingDegPerSec: 420, headAimBias: 0.72,
    crosshairPlacement: 0.9, counterStrafe: 0.88, utilityUse: 0.88, aggression: 0.65, economyDiscipline: 0.92,
    tactics: Object.freeze(['cobertura', 'flanco', 'granadaHE', 'flash', 'preMira', 'trade', 'smokeLineup', 'rotacao', 'economiaTime', 'fakes']),
  }),
  Object.freeze({
    level: 10, name: 'Lenda da Massinha',
    reactionMs: 150, aimErrorDeg: 0.55, sprayControl: 1, trackingDegPerSec: 480, headAimBias: 0.8,
    crosshairPlacement: 0.97, counterStrafe: 0.95, utilityUse: 0.95, aggression: 0.7, economyDiscipline: 1,
    tactics: Object.freeze([
      'cobertura', 'flanco', 'granadaHE', 'flash', 'preMira', 'trade', 'smokeLineup', 'rotacao', 'economiaTime',
      'fakes', 'leSom', 'equipeCoordenada',
    ]),
  }),
]);

const NUMERIC = Object.freeze([
  'reactionMs', 'aimErrorDeg', 'sprayControl', 'trackingDegPerSec', 'headAimBias',
  'crosshairPlacement', 'counterStrafe', 'utilityUse', 'aggression', 'economyDiscipline',
]);

export const BOT_LEVEL_MIN = 1;
export const BOT_LEVEL_MAX = 10;
export const BOT_LEVEL_ANCHORS = ANCHORS;

const NAMES = Object.freeze({
  1: 'Massinha Mole', 2: 'Massinha Mole+', 3: 'Aprendiz', 4: 'Aprendiz+', 5: 'Modelador',
  6: 'Modelador+', 7: 'Escultor', 8: 'Escultor+', 9: 'Mestre do Stop-Motion', 10: 'Lenda da Massinha',
});

/** Parâmetros completos do nível 1..10 (inteiro), interpolando entre as âncoras da tabela. */
export function getBotLevel(level) {
  const n = Math.min(BOT_LEVEL_MAX, Math.max(BOT_LEVEL_MIN, Math.round(Number(level) || BOT_LEVEL_MIN)));
  let lo = ANCHORS[0];
  let hi = ANCHORS[ANCHORS.length - 1];
  for (let i = 0; i < ANCHORS.length - 1; i++) {
    if (n >= ANCHORS[i].level && n <= ANCHORS[i + 1].level) {
      lo = ANCHORS[i];
      hi = ANCHORS[i + 1];
      break;
    }
  }
  const t = hi.level === lo.level ? 0 : (n - lo.level) / (hi.level - lo.level);
  const out = { level: n, name: NAMES[n], tactics: [...(t >= 1 ? hi.tactics : lo.tactics)] };
  for (const key of NUMERIC) out[key] = lo[key] + (hi[key] - lo[key]) * t;
  return Object.freeze(out);
}
