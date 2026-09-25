// Parâmetros do pós-processamento de estúdio (seção 0.13 "Pós-processamento"; decisões e referências em
// docs/art/moodboard.md, itens 8 e 9). Os ajustes do jogador (graphics.ao, bloom, dof, smaa, grain, vignette,
// flicker) ligam/desligam e escalam; aqui fica o "como" de cada efeito.
//
// Unidades: 10 u = 1 cm na miniatura (o boneco tem 72 u). Distâncias de foco e raios de AO em u; tamanhos em
// pixels referem-se a uma tela de 1080 linhas e escalam com a resolução real.

/** GTAO (Jimenez et al. 2016) a partir da profundidade da cena, composto "colorido" (massinha nunca fica cinza). */
export const AO = Object.freeze({
  levels: Object.freeze({
    // meia: metade da resolução, 12 amostras (3 direções × 4 passos) — preset Médio/Alto.
    meia: Object.freeze({ scale: 0.5, samples: 12 }),
    // cheia: resolução inteira, 16 amostras — preset Ultra.
    cheia: Object.freeze({ scale: 1, samples: 16 }),
  }),
  radius: 30, // alcance do contato (3 cm): assenta a massa na mesa sem escurecer o cenário inteiro
  thickness: 20, // amostras mais à frente que isso não ocluem (sem halo atrás das silhuetas)
  distanceExponent: 1.5, // concentra os passos perto do pixel (contato definido, PLA15)
  distanceFallOff: 1,
  power: 1.4, // contraste da oclusão
  strength: 0.9, // mistura final
  saturation: 0.6, // saturação extra onde oclui (sombra puxa para a própria cor, PLA15/PLA2)
  protect: Object.freeze([1.4, 3.5]), // luminância HDR a partir da qual a oclusão some (painéis de luz)
  blurRadius: 4, // desruído bilateral separável (texels da resolução do AO)
  blurSigma: 2.2,
  blurDepth: 0.05, // tolerância relativa de profundidade no desruído
  upsampleDepth: 0.035, // tolerância relativa no upsample conjunto (bordas nítidas)
});

/** Bloom só nas luzes (Jimenez 2014, "Next Generation Post Processing in Call of Duty: AW"). */
export const BLOOM = Object.freeze({
  threshold: 2.4, // radiância linear antes da exposição: painéis de softbox (3–14) passam, plástico/massa sob a key (até ~2) não
  knee: 1.0, // joelho suave do limiar (sem borda dura entre o que brilha e o que não brilha)
  maxBrightness: 64, // teto antes do filtro (vaga-lumes de clearcoat não viram estrelas)
  levels: 6, // mips da cadeia (1/2 … 1/64)
  scatter: 0.72, // quanto cada mip mais largo soma no de cima (largura do halo)
  intensity: 0.065,
  tint: '#FFD8B5', // halação de filme: halo âmbar em volta do tungstênio (SMA9, SMA6)
});

/** Profundidade de campo: CoC = abertura·(1 − foco/z), disco em meia resolução (Gustafsson 2018). */
export const DOF = Object.freeze({
  radiusStep: 0.55, // densidade da espiral de amostras (menor = mais amostras)
  maxSamples: 180, // limite de amostras por pixel (perfil "forte" em telas grandes)
  minFocus: 24, // não foca mais perto que 2,4 cm (a lente da câmera do set)
  // Autofoco na mira: mistura o centro com o mais próximo da cruz (foca no boneco, não no vão atrás dele).
  autofocus: Object.freeze({ spread: Object.freeze([0.02, 0.03]), nearBias: 0.35 }),
});

/** Lente e filme (passe final em LDR): aberração, grade de cor, vinheta, grão e dithering. */
export const LENS = Object.freeze({
  grain: Object.freeze({
    maxAmount: 0.11, // amplitude com graphics.grain = 1 (o preset usa 0,35)
    size: 1.45, // px por grão numa tela de 1080 linhas
    chroma: 0.22, // cor do grão (0 = monocromático)
    shadowFloor: 0.35, // resposta mínima fora dos meios-tons (grão ainda aparece nas sombras)
  }),
  vignette: Object.freeze({
    maxAmount: 0.62, // escurecimento no canto com graphics.vignette = 1 (o preset usa 0,5)
    inner: 0.45, // raio onde começa (0 = centro, 1 = canto)
    outer: 1.15,
    color: '#3A2418', // cantos puxam para marrom-quente, nunca preto azulado (SMA8, SMA10)
  }),
  aberration: 0.006, // deslocamento radial no canto (fração da tela) com o contexto em 1
  grade: Object.freeze({
    vibrance: 0.14, // satura mais o que está menos saturado (cara de brinquedo, TSH2/TSH4)
    contrast: 0.08, // S suave em espaço de exibição
    warmth: 0.025, // leve aquecimento (tungstênio)
  }),
  dither: true, // ±½ LSB no 8 bits: sem faixas em gradientes escuros
});

/** Flicker de exposição por pose (Terry Ibele: tungstênio/obturador), sutil e desligável. */
export const FLICKER = Object.freeze({
  amplitude: 0.014, // ±1,4% de exposição por foto
  smoothing: 0.35, // parte da variação que herda da pose anterior (não é ruído branco puro)
});

/**
 * Contextos de câmera: o mesmo pós com intensidades diferentes. `dof[nível]` segue graphics.dof (sutil/forte).
 *  - aperture: ganho da CoC (maior = foco mais raso) · maxBlur: raio máximo em px (tela de 1080 linhas)
 *  - nearScale: fração do desfoque para o que está na frente do foco
 *  - tilt: força da faixa de foco na tela (plano focal inclinado); tiltCenter/Width/Feather em fração da altura
 *  - focusTime: constante de tempo do autofoco (s) · aberration/grain/vignette/bloom: multiplicadores
 */
export const POST_CONTEXTS = Object.freeze({
  // Jogo: foco profundo (legibilidade competitiva); só o fundo distante amolece.
  jogo: Object.freeze({
    label: 'Jogo',
    dof: Object.freeze({
      sutil: Object.freeze({ aperture: 0.6, maxBlur: 3.5, nearScale: 0.35, tilt: 0 }),
      forte: Object.freeze({ aperture: 1.0, maxBlur: 7, nearScale: 0.6, tilt: 0 }),
    }),
    focusTime: 0.18,
    aberration: 0,
    grain: 1,
    vignette: 1,
    bloom: 1,
  }),
  // Vitrine (Fase 2): foto de produto de massinha na mesa, foco médio.
  vitrine: Object.freeze({
    label: 'Vitrine',
    dof: Object.freeze({
      sutil: Object.freeze({ aperture: 1.6, maxBlur: 9, nearScale: 0.8, tilt: 0 }),
      forte: Object.freeze({ aperture: 2.4, maxBlur: 14, nearScale: 1, tilt: 0 }),
    }),
    focusTime: 0.35,
    aberration: 0.35,
    grain: 1,
    vignette: 1.1,
    bloom: 1.1,
  }),
  // Menu na bancada: miniatura de tilt-shift (faixa de foco + profundidade).
  menu: Object.freeze({
    label: 'Menu',
    dof: Object.freeze({
      sutil: Object.freeze({ aperture: 2.2, maxBlur: 12, nearScale: 1, tilt: 0.55, tiltCenter: 0.46, tiltWidth: 0.1, tiltFeather: 0.34 }),
      forte: Object.freeze({ aperture: 3.0, maxBlur: 18, nearScale: 1, tilt: 0.8, tiltCenter: 0.46, tiltWidth: 0.08, tiltFeather: 0.3 }),
    }),
    focusTime: 0.6,
    aberration: 0.5,
    grain: 1.15,
    vignette: 1.25,
    bloom: 1.15,
  }),
  // Killcam em stop-motion: lente de câmera barata, foco raso, franja colorida.
  killcam: Object.freeze({
    label: 'Killcam',
    dof: Object.freeze({
      sutil: Object.freeze({ aperture: 2.6, maxBlur: 14, nearScale: 1, tilt: 0.35, tiltCenter: 0.5, tiltWidth: 0.14, tiltFeather: 0.36 }),
      forte: Object.freeze({ aperture: 3.4, maxBlur: 20, nearScale: 1, tilt: 0.6, tiltCenter: 0.5, tiltWidth: 0.1, tiltFeather: 0.32 }),
    }),
    focusTime: 0.12,
    aberration: 1,
    grain: 1.4,
    vignette: 1.3,
    bloom: 1.2,
  }),
});

export const POST_CONTEXT_IDS = Object.freeze(Object.keys(POST_CONTEXTS));

/** Vistas de diagnóstico do console (`post_view`). */
export const POST_VIEWS = Object.freeze(['final', 'ao', 'coc', 'bloom']);
