// Inaccuracy das armas (seção 0.7; o CWeaponCSBase do CS:GO) — valores do items_game.txt final do CS:GO (maio de
// 2023), nas unidades do CS: × 0,001 ≈ radianos. Fonte e conferência (269 de 275 valores iguais a uma planilha
// independente): docs/research/csgo-inaccuracy-notes.md e docs/research/csgo-weapon-accuracy.json.
// Campos de cada arma (`alt` traz os que mudam no modo alt — luneta, silenciador colocado ou rajada):
//   stand, crouch: base em pé e agachada (FL_DUCKING)      move: termo de movimento cheio (a 95% da velocidade)
//   jumpInitial: termo do ar com vy = impulso do pulo       jumpApex: o mesmo no ápice (só a Deagle; 0 nas outras)
//   jump: somado à base em pé enquanto está no ar           land: por u/s de queda no pouso
//   fire: por disparo (a Fase 4 chama)
//   recoveryStand, recoveryCrouch: tempo (s) em que o excesso de penalidade cai 10×; com recoveryStandFinal e
//     recoveryCrouchFinal o tempo vai do inicial ao final entre as balas transitionStart e transitionEnd
// Faca, granadas e bomba não têm inaccuracy (NO_INACCURACY). A Fase 4 acrescenta spread e recoil neste arquivo.

const A = (o) => Object.freeze(o);

/** Multiplicador das unidades do CS (os números abaixo × 0,001 ≈ radianos). */
export const INACCURACY_UNIT = 0.001;

/** Constantes do CWeaponCSBase (GetInaccuracy, UpdateAccuracyPenalty, GetRecoveryTime). */
export const ACCURACY = Object.freeze({
  moveFloor: 0.34, // abaixo de 34% da velocidade da arma o movimento não pesa (CS_PLAYER_SPEED_DUCK_MODIFIER)
  moveCeil: 0.95, // a 95% o termo de movimento é cheio
  moveExponent: 0.25, // MOVEMENT_CURVE01_EXPONENT (andando com Shift a rampa é linear)
  airScale: 1, // weapon_air_spread_scale
  airFloorFraction: 0.25, // o termo do ar começa em 0,25 × √impulso do pulo
  airMaxFactor: 2, // teto do termo do ar: 2 × jumpInitial
  airRecoveryFactor: 4, // no ar a recuperação é a do agachado × 4
  recoilDecayThreshold: 1.1, // o índice de recuo só decai depois de 1,1 × o intervalo entre tiros sem atirar
  recoilDecayCoefficient: 2, // weapon_recoil_decay_coefficient: o índice cai 10× a cada 1/2 s
  sinceShotMax: 60, // teto (s) do tempo desde o último tiro
  max: 1, // teto da inaccuracy do tiro
});

/** Item sem inaccuracy (faca, granadas, bomba). */
export const NO_INACCURACY = A({
  stand: 0, crouch: 0, move: 0, jumpInitial: 0, jump: 0, land: 0, fire: 0, recoveryStand: 1, recoveryCrouch: 1,
});

export const INACCURACY = Object.freeze({
  glock: A({
    stand: 5.6, crouch: 4.2, move: 10, jumpInitial: 96.62, jump: 87.87, land: 0.185, fire: 56, recoveryStand: 0.2,
    recoveryCrouch: 0.2, recoveryStandFinal: 0.33, recoveryCrouchFinal: 0.33, transitionStart: 0, transitionEnd: 5,
    // alt = rajada
    alt: A({ stand: 5.6, crouch: 3, move: 12.95, jump: 87.87, land: 0.185, fire: 45 }),
  }),
  usps: A({
    stand: 4.9, crouch: 3.68, move: 13.87, jumpInitial: 96.6, jump: 94.48, land: 0.191, fire: 71,
    recoveryStand: 0.349532, recoveryCrouch: 0.291277,
    // alt = silenciador colocado (o padrão)
    alt: A({ stand: 4.9, crouch: 3.68, move: 13.87, jump: 94.48, land: 0.198, fire: 52 }),
  }),
  p250: A({
    stand: 9.1, crouch: 6.83, move: 20, jumpInitial: 96.62, jump: 92.96, land: 0.19, fire: 52.45,
    recoveryStand: 0.345388, recoveryCrouch: 0.287823,
  }),
  fiveseven: A({
    stand: 9.1, crouch: 6.83, move: 40, jumpInitial: 99.88, jump: 89.7, land: 0.19, fire: 25, recoveryStand: 0.2,
    recoveryCrouch: 0.2, recoveryStandFinal: 0.5, recoveryCrouchFinal: 0.5, transitionStart: 0, transitionEnd: 5,
  }),
  deagle: A({
    stand: 4.2, crouch: 2.18, move: 48.1, jumpInitial: 548.82, jumpApex: 331.55, jump: 40.55, land: 0.043,
    fire: 72.23, recoveryStand: 0.8112, recoveryCrouch: 0.449927,
  }),
  mac10: A({
    stand: 13.3, crouch: 9.98, move: 13.99, jumpInitial: 34.99, jump: 33.3, land: 0.069, fire: 4.76,
    recoveryStand: 0.399729, recoveryCrouch: 0.285521,
  }),
  mp9: A({
    stand: 9, crouch: 5.5, move: 29.04, jumpInitial: 37.28, jump: 18.43, land: 0.056, fire: 3.7,
    recoveryStand: 0.25789, recoveryCrouch: 0.184207,
  }),
  ump45: A({
    stand: 13.43, crouch: 10.07, move: 28.76, jumpInitial: 47.21, jump: 37.25, land: 0.085, fire: 3.42,
    recoveryStand: 0.349993, recoveryCrouch: 0.249995,
  }),
  p90: A({
    stand: 13.65, crouch: 10.24, move: 31, jumpInitial: 104.6, jump: 90.08, land: 0.082, fire: 2.85,
    recoveryStand: 0.372098, recoveryCrouch: 0.265784,
  }),
  nova: A({
    stand: 7, crouch: 5.25, move: 36.75, jumpInitial: 109.7, jump: 126.31, land: 0.236, fire: 9.72,
    recoveryStand: 0.460517, recoveryCrouch: 0.328941,
  }),
  xm1014: A({
    stand: 7, crouch: 5.25, move: 36.03, jumpInitial: 100.38, jump: 130.83, land: 0.232, fire: 8.83,
    recoveryStand: 0.506569, recoveryCrouch: 0.361835,
  }),
  galil: A({
    stand: 8.77, crouch: 6.58, move: 123.56, jumpInitial: 105.39, jump: 149.78, land: 0.256, fire: 7,
    recoveryStand: 0.3, recoveryCrouch: 0.15, recoveryStandFinal: 0.5, recoveryCrouchFinal: 0.47, transitionStart: 2,
    transitionEnd: 5,
  }),
  famas: A({
    stand: 9.85, crouch: 7.39, move: 99.34, jumpInitial: 94.77, jump: 110.39, land: 0.205, fire: 6.05,
    recoveryStand: 0.25, recoveryCrouch: 0.12, recoveryStandFinal: 0.5, recoveryCrouchFinal: 0.48, transitionStart: 2,
    transitionEnd: 5,
    // alt = rajada
    alt: A({ stand: 3.69, crouch: 3.25, move: 99.34, jump: 110.39, land: 0.205, fire: 3.35 }),
  }),
  ak47: A({
    stand: 6.41, crouch: 4.81, move: 175.06, jumpInitial: 100.94, jump: 140.76, land: 0.242, fire: 7.8,
    recoveryStand: 0.368, recoveryCrouch: 0.305257, recoveryStandFinal: 0.506, recoveryCrouchFinal: 0.419728,
    transitionStart: 2, transitionEnd: 5,
  }),
  m4a4: A({
    stand: 4.9, crouch: 4.1, move: 137.88, jumpInitial: 94.41, jump: 97.27, land: 0.192, fire: 7,
    recoveryStand: 0.338941, recoveryCrouch: 0.2421, recoveryStandFinal: 0.466044, recoveryCrouchFinal: 0.332888,
    transitionStart: 2, transitionEnd: 5,
  }),
  m4a1s: A({
    stand: 4.9, crouch: 4.1, move: 92.88, jumpInitial: 96.77, jump: 99.7, land: 0.197, fire: 12,
    recoveryStand: 0.338941, recoveryCrouch: 0.2421, recoveryStandFinal: 0.466044, recoveryCrouchFinal: 0.332888,
    transitionStart: 2, transitionEnd: 5,
    // alt = silenciador colocado (o padrão)
    alt: A({ stand: 4.9, crouch: 4.1, move: 122, jump: 99.7, land: 0.197, fire: 7 }),
  }),
  aug: A({
    stand: 4.9, crouch: 3.68, move: 135.45, jumpInitial: 101.56, jump: 105.99, land: 0.208, fire: 7.29,
    recoveryStand: 0.429727, recoveryCrouch: 0.30552,
    // alt = com luneta
    alt: A({ stand: 3.68, crouch: 3.11, move: 105.45, jump: 105.99, land: 0.208, fire: 7.29 }),
  }),
  sg553: A({
    stand: 5.81, crouch: 3.81, move: 136.01, jumpInitial: 78.79, jump: 109, land: 0.188, fire: 7.95,
    recoveryStand: 0.452886, recoveryCrouch: 0.379204,
    // alt = com luneta
    alt: A({ stand: 3.81, crouch: 3.05, move: 136.01, jump: 109, land: 0.188, fire: 9.2 }),
  }),
  ssg08: A({
    stand: 31.7, crouch: 23.78, move: 123.45, jumpInitial: 208.72, jump: 5.72, land: 0.215, fire: 22.92,
    recoveryStand: 0.142096, recoveryCrouch: 0.055783,
    // alt = com luneta
    alt: A({ stand: 3, crouch: 2.8, move: 123.45, jump: 5.72, land: 0.215, fire: 22.92 }),
  }),
  awp: A({
    stand: 80.8, crouch: 60.6, move: 176.48, jumpInitial: 172.86, jump: 133.83, land: 0.307, fire: 53.85,
    recoveryStand: 0.34539, recoveryCrouch: 0.24671,
    // alt = com luneta
    alt: A({ stand: 2, crouch: 1.5, move: 176.48, jump: 133.83, land: 0.1, fire: 53.85 }),
  }),
  scar20: A({
    stand: 25.8, crouch: 19.35, move: 150.48, jumpInitial: 107.69, jump: 153.77, land: 0.262, fire: 18.61,
    recoveryStand: 0.544331, recoveryCrouch: 0.388808,
    // alt = com luneta
    alt: A({ stand: 2, crouch: 1.5, move: 150.48, jump: 153.77, land: 0.262, fire: 18.61 }),
  }),
  g3sg1: A({
    stand: 25.8, crouch: 19.35, move: 150.48, jumpInitial: 107.69, jump: 153.77, land: 0.262, fire: 18.61,
    recoveryStand: 0.544331, recoveryCrouch: 0.388808,
    // alt = com luneta
    alt: A({ stand: 2, crouch: 1.5, move: 150.48, jump: 153.77, land: 0.262, fire: 18.61 }),
  }),
  negev: A({
    stand: 10.17, crouch: 7.63, move: 159.14, jumpInitial: 116.29, jump: 292.23, land: 0.409, fire: 30,
    recoveryStand: 0.3, recoveryCrouch: 0.25, recoveryStandFinal: 0.1, recoveryCrouchFinal: 0.08, transitionStart: 9,
    transitionEnd: 12,
  }),
  m249: A({
    stand: 7.7, crouch: 5.34, move: 156.25, jumpInitial: 118.27, jump: 279.47, land: 0.398, fire: 3.56,
    recoveryStand: 0.828931, recoveryCrouch: 0.592093,
  }),
});
