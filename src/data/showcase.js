// Vitrine da Fase 2 (mapa `vitrine`, src/maps/vitrine.js): mesa do animador com tapete de corte e 20 objetos lado a
// lado — massinha em todas as skins, peças SDF orgânicas e os materiais do set —, cada um com etiqueta de fita
// crepe escrita a caneta. Serve de banco de prova do look de estúdio (aceite da Fase 2) e de bancada de medição
// (varredura de presets). Referências de cada escolha em docs/art/moodboard.md, item 10.
//
// Unidades: 10 u = 1 cm na miniatura (o boneco tem 72 u). O tampo da mesa fica em y = 0; o tapete por cima.

import { PALETTE } from './palette.js';

/** Mesa, tapete, câmera e limites. */
export const SHOWCASE_SET = Object.freeze({
  floorY: -760, // chão do estúdio: mesa de 76 cm (os tripés das luzes apoiam nele)
  desk: Object.freeze({ width: 1500, depth: 920, thickness: 44, legSize: 64, legInset: 70 }),
  // Tapete A1 (90 × 60 cm, SMD3) um pouco à frente do centro da mesa.
  mat: Object.freeze({ width: 900, depth: 620, thickness: 2.2, x: 0, z: 20, margin: 18 }),
  // Grade de 5 colunas × 4 linhas sobre o tapete (linha 0 = fundo, linha 3 = frente).
  grid: Object.freeze({ cols: 5, rows: 4, pitchX: 176, pitchZ: 146, originZ: 20 }),
  // Etiqueta: tira de fita crepe de 19 mm à frente de cada objeto (docs: SSD2/SSD14, TRL1).
  label: Object.freeze({
    tapeWidth: 19, textHeight: 10.5, margin: 7, forward: 58, lift: 0.3, tiltDeg: 5,
    ink: '#1C2238', // caneta permanente azul-escura
    font: '700 {px}px "Segoe Print", "Bradley Hand", "Comic Sans MS", "Chalkboard SE", "Baloo 2", cursive',
    atlas: Object.freeze({ width: 1024, cellHeight: 96, columns: 2 }),
  }),
  // Câmera de fotógrafo de produto: alta e inclinada sobre o tapete (MFP7, MFP9), a mesa inteira no quadro.
  spawn: Object.freeze({ x: 0, y: 300, z: 520, yawDeg: 0, pitchDeg: -35 }),
  // Pose fixa da câmera durante a varredura (toda a mesa no quadro, sempre igual entre presets).
  sweepPose: Object.freeze({ x: 0, y: 300, z: 520, yawDeg: 0, pitchDeg: -35 }),
  bounds: Object.freeze({ min: Object.freeze([-1400, -700, -1100]), max: Object.freeze([1400, 1100, 1200]) }),
  // A 420 u/s a câmera livre atravessa a mesa num piscar: mais devagar para olhar digitais de perto.
  speedScale: 0.42,
  // Chão do estúdio: tecido preto (molleton) — a mesa é uma ilha de luz no escuro (SSD1, CSD14).
  floorColor: '#1A1614',
});

/**
 * Os 20 objetos. `cell` = [coluna, linha]. `kind` escolhe o construtor em src/debug/showcaseObjects.js; o resto
 * são os parâmetros visuais dele. `yawDeg` gira o objeto sobre a mesa. Referências entre parênteses.
 */
export const SHOWCASE_OBJECTS = Object.freeze([
  // ---- linha 0 (fundo): peças altas
  Object.freeze({
    id: 'armadura', label: 'Armadura de arame', cell: [0, 0], kind: 'armature', yawDeg: 18,
    // Arame torcido de alumínio, "ossos" de massa epóxi cinza, blocos de balsa no peito/quadril e porcas de
    // fixação nos pés (ARM5, ARM12, ARM15, ARM18).
    height: 72, putty: '#8E918C', wire: '#B9BEC4',
  }),
  Object.freeze({ id: 'escala', label: 'Boneco 72 u', cell: [1, 0], kind: 'scaleMarker', yawDeg: -8, height: 72 }),
  Object.freeze({
    id: 'pote', label: 'Pote de massinha', cell: [2, 0], kind: 'pot', yawDeg: 25,
    // Pote escolar amarelo, tampa azul encostada e a massa guardando a forma do pote (PDH8, PDH13).
    radius: 44, height: 50, tub: PALETTE.clayYellow, lid: PALETTE.blue, clay: '#3E86D6',
  }),
  Object.freeze({
    id: 'papelao', label: 'Papelão', cell: [3, 0], kind: 'box', yawDeg: -22,
    size: Object.freeze([96, 58, 72]), flapOpen: 0.42,
  }),
  Object.freeze({
    id: 'neon', label: 'Neon no escuro', cell: [4, 0], kind: 'neonGhost', yawDeg: -30,
    // Massa que brilha no escuro: pastel sob a luz, verde-limão na sombra (GDC2, GDC5, GDC17). Fica dentro de
    // um túnel de papelão para ter onde brilhar.
    color: '#A6FF6E', tunnel: Object.freeze({ radius: 40, length: 96, thickness: 3.5 }),
  }),
  // ---- linha 1
  Object.freeze({
    id: 'sdf-cabeca', label: 'Cabeça SDF', cell: [0, 1], kind: 'sdfHead', yawDeg: 20,
    // Cabeça esculpida sobre um pedestal de massa (CLF3, CLF14, AAC3): nariz, sobrancelha e orelhas soldados
    // com vinco, órbitas por subtração suave, olhos de massinha com pupila.
    skin: '#E2A57F', plinth: '#5E7B8C',
  }),
  Object.freeze({
    id: 'camuflagem', label: 'Camuflagem', cell: [1, 1], kind: 'helmet', yawDeg: 0,
    color: '#6C7A44', radius: 30,
  }),
  Object.freeze({
    id: 'madeira', label: 'Madeira falsa', cell: [2, 1], kind: 'log', yawDeg: 12,
    color: '#8C5A3C', radius: 17, length: 92,
  }),
  Object.freeze({
    id: 'fita', label: 'Fita crepe', cell: [3, 1], kind: 'tapeRoll', yawDeg: 36,
    // Rolo em pé com a ponta solta na mesa: laterais com as camadas pelo raio e poeira na cola (TRL1, TRL5, TRL10).
    outer: 44, inner: 34, width: 36, tail: 30,
  }),
  Object.freeze({
    id: 'rolinho', label: 'Rolinho (colete)', cell: [4, 1], kind: 'jellyRoll', yawDeg: 0,
    // Rocambole de duas massas deitado, espiral para a câmera (MFP3, MFP15) — o item de colete do modo Ondas.
    // Folha de 4,6 u (~4,6 mm) com 2,2 voltas: ~59 u de diâmetro × 34 u de comprimento. endDeg gira a espiral no
    // próprio plano: a ponta da folha (θ = 2,2 voltas = 792°) fica no ângulo endDeg − 792° ≡ −80° da face, embaixo e
    // um pouco à direita (o rolo descansa sobre a emenda).
    colorA: PALETTE.blue, colorB: PALETTE.clayWhite, turns: 2.2, thickness: 4.6, length: 34, endDeg: -8,
  }),
  // ---- linha 2
  Object.freeze({
    id: 'ouro', label: 'Faca de ouro', cell: [0, 2], kind: 'goldKnife', yawDeg: -28,
    length: 118,
  }),
  Object.freeze({
    id: 'misturada', label: 'Massa misturada', cell: [1, 2], kind: 'mixedRope', yawDeg: 14,
    // Cobrinhas de três cores torcidas juntas + uma bola já amassada pela criança (MPC6, MPC12, PLI11).
    colors: Object.freeze([PALETTE.orange, PALETTE.teal, PALETTE.clayYellow]),
  }),
  Object.freeze({
    id: 'escolar', label: 'Escolar desbotada', cell: [2, 2], kind: 'discStack', yawDeg: 0,
    // Pilha de bolachas de massa de escola (GPD1, PDH10): cores lavadas e pó.
    colors: Object.freeze(['#E86A8A', '#4A9BD8', '#F2C94C']), radius: 27, height: 11,
  }),
  Object.freeze({
    id: 'sdf-amassada', label: 'Amassado SDF', cell: [3, 2], kind: 'sdfLump', yawDeg: -15,
    // Duas massas apertadas uma na outra (vinco de costura) com dedadas por subtração suave (CLT3, CLF17).
    colorA: PALETTE.orange, colorB: PALETTE.teal,
  }),
  Object.freeze({
    id: 'ferramentas', label: 'Ferramentas + balsa', cell: [4, 2], kind: 'tools', yawDeg: -6,
    toolLength: 118, knifeLength: 108,
  }),
  // ---- linha 3 (frente): superfícies para olhar de perto
  Object.freeze({
    id: 'fresca', label: 'Massa fresca', cell: [0, 3], kind: 'ball', yawDeg: 0,
    color: PALETTE.terracotta, radius: 25, wetness: 1, lint: 0.15, squash: Object.freeze([1.08, 0.86, 1.02]),
  }),
  Object.freeze({
    id: 'seca', label: 'Massa seca', cell: [1, 3], kind: 'ball', yawDeg: 40,
    color: PALETTE.terracotta, radius: 25, wetness: 0, lint: 0.75, roughness: 0.84, squash: Object.freeze([1.04, 0.9, 1.06]),
  }),
  Object.freeze({
    id: 'digitais', label: 'Digitais', cell: [2, 3], kind: 'printSlab', yawDeg: -10,
    // Placa creme muito tocada: as digitais só aparecem de perto e com luz rasante (FPC9, FPC14, CLT1).
    color: '#E9DCC4', size: Object.freeze([104, 13, 74]), fingerprints: 1.7,
  }),
  Object.freeze({
    id: 'marmorizado', label: 'Marmorizado', cell: [3, 3], kind: 'skinBall', yawDeg: 30, skin: 'marmorizado',
    // Ameixa + creme com veio escuro (MPC11, MPC15, MPC17).
    color: '#6E2D55', colorB: PALETTE.clayWhite, colorC: '#2A2320', radius: 24, squash: Object.freeze([0.92, 1.18, 0.92]),
  }),
  Object.freeze({
    id: 'glitter', label: 'Glitter', cell: [4, 3], kind: 'skinBall', yawDeg: 0, skin: 'glitter',
    color: '#7C52B8', radius: 26, squash: Object.freeze([1.1, 0.8, 1.1]),
  }),
]);

/** Varredura automática de presets (tabela comparativa no painel e no console). */
export const PRESET_SWEEP = Object.freeze({
  presets: Object.freeze(['leve', 'medio', 'alto', 'ultra']),
  warmupS: 2.2, // compila shaders novos, assa atlas, estabiliza o timer de GPU
  measureS: 4, // janela de medição por preset
  // Resolução fixa durante a medição: mede o custo real do preset (a dinâmica esconderia o custo baixando pixels).
  lockResolution: true,
  budgetMs: 1000 / 60,
  // RTX 2070 → GPU integrada recente (Iris Xe): ~5× mais lenta em shading (docs/PROGRESS.md, convenções).
  integratedFactor: 5,
});

/** Faixas dos controles de massinha do painel (multiplicadores sobre o valor de cada objeto). */
export const SHOWCASE_PANEL = Object.freeze({
  wetness: Object.freeze({ min: 0, max: 2, step: 0.05 }),
  boil: Object.freeze({ min: 0, max: 3, step: 0.05 }),
  fingerprints: Object.freeze({ min: 0, max: 3, step: 0.05 }),
  focus: Object.freeze({ min: 60, max: 1600, step: 10 }),
  contexts: Object.freeze(['vitrine', 'jogo', 'menu', 'killcam']),
});

/** Diagnóstico "massa preta" (aceite: nada preto nas sombras). Radiância linear antes da exposição. */
export const CLAY_BLACK_PROBE = Object.freeze({
  threshold: 0.0045, // abaixo disso a massa apareceria preta depois do tone mapping (AgX, exposição 1)
  color: '#FF00D4', // magenta: impossível confundir com qualquer massa
});
