// Pista de testes (subfase 3.3; desenho em docs/phases/phase-3.md, seção 3.3; pesquisa no item 11 do moodboard).
// Parque de estações num compensado de 5,6 × 4 m, cada módulo isolado num lote, com os números que o movimento do
// jogo promete (src/data/movement.js) construídos com objetos de verdade na escala do boneco.
// Unidades: 1 u = 1 cm na escala do boneco = 1 mm real (o boneco de 72 u tem 7,2 cm). Origem no centro do tampo do
// compensado (y = 0); norte = −Z, leste = +X. Rumo = graus no sentido horário a partir do norte (a direção do rumo h é
// (sen h, −cos h) no plano XZ); o yaw do jogador é −rumo. Alturas das estações contam do chão do próprio lote (o tapete
// de corte tem 3 u, os papéis décimos de u); a torre, sobre o compensado nu, mede do tampo.
// Números das estações 5 e 6 (wall-jump e slide) e as anotações da torre saem da simulação da subfase 3.4 com o
// movimento pronto (docs/phases/phase-3.md, seção 3.4); os testes da pista os fixam.

const F = Object.freeze;
const list = (...items) => F(items.map((i) => F(i)));

export const PISTA = F({
  seed: 'pista-de-testes',
  base: F({ minX: -2800, maxX: 2800, minZ: -2000, maxZ: 2000, thickness: 18, sheet: F([2440, 1220]) }),
  // Chão do estúdio em volta (18 u abaixo do tampo, sob o compensado) e o ar do estúdio.
  studioFloor: F({ size: 16000, color: '#171210' }),
  fog: F({ color: '#1B1411', density: 0.00005 }),
  // Cerca de caixas de papelão de parede dupla, abertas e em pé; colisão de 8,4 u (papelão de 6 u + empeno).
  fence: F({
    innerX: 2760, innerZ: 1960, height: 200, wall: 6, collider: 8.4, depth: 40, boxesX: 8, boxesZ: 6, tape: 48,
    flapOpen: 0.28, stamps: F(['ESTE LADO PARA CIMA', 'FRÁGIL', 'MANTER SECO']),
  }),
  // Chãos dos lotes: tapete de corte (3 mm) cobre o lote inteiro; papéis são folhas próprias das estações.
  floors: F({
    tapete: F({ thickness: 3, surface: 'tapete' }),
    kraft: F({ thickness: 0.3, surface: 'papelao', color: '#B08560' }),
    grade: F({ thickness: 0.2, surface: 'papelao', color: '#F2EEE2' }),
    compensado: F({ thickness: 0, surface: 'madeira' }),
  }),
  lotTape: F({ width: 19, offset: 12 }), // fita crepe de 19 mm em volta de cada lote, 12 u para fora da borda
  lots: list(
    { number: 1, x: [-850, 850], z: [-600, 600], floor: 'compensado', card: [-780, 560, 0] },
    { number: 2, x: [1450, 2500], z: [-1500, -550], floor: 'tapete', card: [2440, -520, 180] },
    { number: 3, x: [1450, 2600], z: [-450, 400], floor: 'tapete', card: [2130, 370, 0] },
    { number: 4, x: [1500, 2300], z: [550, 1100], floor: 'tapete', card: [2220, 1060, 0] },
    { number: 5, x: [-2750, -1400], z: [-200, 950], floor: 'compensado', card: [-1470, 920, 0] },
    { number: 6, x: [-2750, -950], z: [1100, 1900], floor: 'compensado', card: [-1020, 1080, 180] },
    { number: 7, x: [-2750, -1420], z: [-1520, -230], floor: 'compensado', card: [-1490, -300, 0] },
    { number: 8, x: [-2560, 2400], z: [-1900, -1540], floor: 'compensado', card: [2340, -1520, 180] },
    { number: 9, x: [-1400, -300], z: [-1460, -700], floor: 'tapete', card: [-360, -680, 180] },
    { number: 10, x: [250, 1250], z: [-1450, -650], floor: 'tapete', card: [310, -630, 180] },
    { number: 11, x: [1300, 2400], z: [1350, 1560], floor: 'compensado', card: [1360, 1330, 180] },
    { number: 12, x: [-800, 800], z: [1450, 1700], floor: 'compensado', card: [-740, 1430, 180] },
  ),
  plaza: F({
    x: F([-600, 600]), z: F([700, 1300]),
    // Prancheta com a planta da pista num cavalete de papelão, voltada para o spawn; luminária de mesa ao lado.
    easel: F({ at: F([-250, 800]), heading: 130, board: F([420, 300, 4]), tilt: 72, bottom: 40 }),
    // Luminária de mesa acesa sobre a prancheta (luz prática da montagem `pista`); a base colide. Baixa o bastante
    // para caber inteira na vista do spawn (cúpula e cotovelo abaixo da borda de cima da tela).
    lamp: F({ bulb: F([-110, 290, 690]), target: F([-250, 180, 800]), reach: 230, baseRadius: 38, baseHeight: 10 }),
  }),
  // Spawn no fundo da praça: a prancheta, a luminária e a quadra de strafe entram inteiras na primeira vista.
  spawn: F({ at: F([0, 0, 1200]), heading: 0, pitch: -2 }),

  // 1 · Counter-strafe: papel quadriculado de plotter, linhas a cada 20 u e fortes a cada 100 u.
  strafe: F({
    paper: F({ x: F([-800, 800]), z: F([-450, 550]) }),
    fine: 20, strong: 100,
    line: F({ z: 50, width: 20, color: '#D1362F' }),
    pillars: list({ at: [-450, -540] }, { at: [450, -540] }),
    pillarBlock: F([96, 100, 96]), pillarLayers: 2,
  }),

  // 2 · Escadas de livros: seis pilhas de seis livros da espessura do degrau; a frente de cada livro recua 40 u.
  stairs: F({
    books: 6, depth0: 350, depthStep: 40, width0: 260, widthStep: 20,
    piles: list(
      { step: 8, x: 1580, front: -600, back: -950 },
      { step: 12, x: 1920, front: -600, back: -950 },
      { step: 16, x: 2260, front: -600, back: -950 },
      { step: 18, x: 1580, front: -1100, back: -1450, note: '18 u · o limite' },
      { step: 20, x: 1920, front: -1100, back: -1450, note: '20 u · só pulando' },
      { step: 24, x: 2260, front: -1100, back: -1450, note: '24 u · só pulando' },
    ),
  }),

  // 3 · Rampas: caixa de arquivo (plataforma) e cinco cunhas de papelão fechadas dos lados.
  ramps: F({
    box: F({ x: F([1500, 2540]), z: F([-400, -100]), height: 120 }),
    width: 160,
    wedges: list(
      { deg: 15, x: 1580, note: '15° · sobe' }, { deg: 30, x: 1800, note: '30° · sobe' },
      { deg: 44, x: 2020, note: '44° · sobe' }, { deg: 46, x: 2240, note: '46° · escorrega' },
      { deg: 60, x: 2460, note: '60° · escorrega' },
    ),
  }),

  // 4 · Caixas: blocos de faia de 128 × 128 com a altura em estêncil na face sul.
  boxes: F({
    size: 128, radius: 3,
    rows: list({ z: [900, 1028], heights: [57, 58, 64] }, { z: [600, 728], heights: [66, 67, 72] }),
    columns: F([F([1550, 1678]), F([1758, 1886]), F([1966, 2094])]),
  }),

  // 5 · Wall-jump: poço de compensado de 144 × 144 u por dentro e 224 u de altura — com o movimento pronto, 3 paredes
  // sobem até ~205 u e 4 saem até ~248 u — e zigue-zague de painéis de 136 u num corredor de 144 u: o vão entre as
  // plataformas (4 painéis, 544 u) é maior que qualquer pulo correndo ou bhop (~210 u); a faca e a AK passam.
  wallJump: F({
    well: F({
      x: F([-2522, -2378]), z: F([78, 222]), wall: 8, height: 224,
      door: F({ x: F([-2482, -2418]), height: 88 }),
      part: 'poco-sul', // as três peças da parede sul (a da porta) são uma parede só para o wall-jump
      stripeY: 152, // centro das faixas numeradas (acima da porta)
      stripes: list( // parede: faixa de cor e número na face de dentro
        { side: 'norte', number: 1, color: '#D1362F' }, { side: 'leste', number: 2, color: '#F4C542' },
        { side: 'sul', number: 3, color: '#5BA55B' }, { side: 'oeste', number: 4, color: '#2F6DB5' },
      ),
    }),
    exit: F({ plankWidth: 64, plankThickness: 6, tower: F({ x: F([-2300, -2120]), z: F([60, 240]), height: 224, layers: 4 }) }),
    zigzag: F({
      x: F([-1822, -1678]), platformA: F([700, 900]), platformB: F([-44, 156]), platformHeight: 128, layers: 2,
      panel: F({ thickness: 8, length: 136, height: 320 }),
      west: F([F([564, 700]), F([292, 428])]),
      east: F([F([428, 564]), F([156, 292])]),
      ramp: F({ deg: 30, width: 144 }),
    }),
  }),

  // 6 · Faixa de slide e gabarito de portais. Corrida de ~500 u até a linha de largada; as quatro traves na ordem do
  // limbo logo depois dela (`at`: u da linha), dentro do alcance de um slide da AK (~129 u); marcas de fita a cada 50 u
  // da linha para ler a distância do slide. Em pé bate na primeira; deslizando passa pelas quatro.
  slide: F({
    lane: F({ x: F([-2600, -1500]), z: F([1195, 1345]) }),
    line: -2080,
    marks: F({ every: 50, to: 400, width: 6, labelZ: 1400 }),
    supportZ: F([1175, 1365]), support: 20, labelZ: 1140,
    bars: list(
      { at: 32, kind: 'regua', under: 70, stack: [48, 11, 11], size: [30, 3, 300] },
      { at: 60, kind: 'lapis', under: 64, stack: [48, 8, 8], size: [7, 7, 175] },
      { at: 88, kind: 'aco', under: 58, stack: [48, 10], size: [25, 1, 300] },
      { at: 116, kind: 'espeto', under: 55, stack: [48, 7], size: [4, 4, 300] },
    ),
  }),
  gauge: F({
    z: 1650, depth: 40, column: 30, opening: 64, lintel: F([150, 3, 30]),
    portals: list(
      { x: -2520, clear: 73, note: '73 u · em pé passa' }, { x: -2360, clear: 72, note: '72 u · em pé não passa' },
      { x: -2200, clear: 55, note: '55 u · agachado passa' }, { x: -2040, clear: 54, note: '54 u · agachado não' },
    ),
  }),

  // 7 · Torre de queda: tubo de papelão com espiral de livros e pranchas nas alturas de queda.
  tower: F({
    axis: F([-2100, -900]),
    tube: F({ radius: 90, wall: 6, height: 1310 }),
    book: F({ inner: 70, length: 200, width: 130 }),
    stepDeg: 18, firstHeading: 270,
    segments: list(
      { books: 12, top: 192 }, { books: 13, top: 412 }, { books: 11, top: 592 }, { books: 18, top: 892 },
      { books: 24, top: 1302 },
    ),
    plank: F({ width: 96, thickness: 8, from: 250, to: 520, backDeg: 10 }),
    target: F({ at: 580, radius: 90, rings: 3 }),
    spot: F({ at: 400, pitch: -25, spiralAt: 200, spiralBefore: 30 }), // teleporte: na prancha olhando o alvo
    // Tábua de crescimento: as anotações são o dano de queda (3.4) de cada prancha, arredondado (saindo andando varia
    // ±1 com o tick do pouso), e o risco onde a queda do repouso passa a matar; a de 1310 fica acima do risco (`up`).
    growth: F({
      at: 330, heading: 116, size: F([60, 1460, 12]), noteHeight: 15,
      notes: list(
        { at: 200, text: '200 · sem dano' }, { at: 420, text: '420 · o limite seguro' }, { at: 600, text: '600 · −26' },
        { at: 900, text: '900 · −62' }, { at: 1280, text: 'daqui para cima, fatal' },
        { at: 1310, text: '1310 · fatal', up: true },
      ),
    }),
  }),

  // 8 · Faixa de bhop: kraft, trena de aço esticada do zero na largada até a chegada.
  bhop: F({
    paper: F({ x: F([-2500, 2300]), z: F([-1880, -1560]) }),
    start: -2100, length: 4400, labelEvery: 500,
    trena: F({ width: 25, z: -1582, color: '#F2C230' }),
    labelZ: -1850,
    case: F({ size: F([70, 70, 40]), z: -1582 }),
    flag: F({ at: F([2300, -1846]), stick: 95 }),
  }),

  // 9 · Vigas de balsa entre duas plataformas de faia.
  beams: F({
    platforms: F([F([-1350, -1150]), F([-510, -310])]), z: F([-1440, -980]), height: 96, layers: 2,
    beam: F({ from: -1170, to: -490, thickness: 6 }),
    widths: list({ width: 32, z: -1400 }, { width: 16, z: -1300 }, { width: 8, z: -1200 }, { width: 4, z: -1100 }),
    incline: F({ x: -1250, deg: 20, width: 16, thickness: 6 }),
  }),

  // 10 · Paredes finas de papelão de uma face.
  walls: F({
    height: 180, thickness: 2,
    row: F({ z: -1400, length: 160, panels: list({ x: 380, t: 0.5 }, { x: 580, t: 1 }, { x: 780, t: 2 }, { x: 980, t: 4 }) }),
    gapWall: F({ z: -1220, x: F([280, 1220]), gaps: list({ x: 520, width: 33, note: '33 u · passa' }, { x: 880, width: 31, note: '31 u · não passa' }) }),
    zigzag: F({ start: F([460, -794]), width: 64, segment: 120, headings: F([330, 30, 330]) }),
    corner: F({ apex: F([760, -1050]), deg: 20, length: 250 }),
    curve: F({ center: F([1050, -880]), radius: 160, from: 0, to: 90, segments: 12 }),
  }),

  // 11 · Túnel baixo: três caixas rasas sem fundo emendadas ao longo de X.
  tunnel: F({
    z: F([1386, 1514]), wall: 4,
    boxes: list({ x: [1350, 1650], height: 60 }, { x: [1650, 1950], height: 96 }, { x: [1950, 2250], height: 60 }),
    holes: F({ diameter: 24, perBox: 3 }),
    vents: F({ perSide: 3, size: F([46, 6]) }),
    bulbs: 12,
    // Luz prática sem sombra na caixa do meio (montagem `pista`): a meia altura, para não estourar o teto de perto.
    light: F({ at: F([1800, 58, 1450]), reach: 320, illuminance: 0.9 }),
  }),

  // 12 · Pegadas: placas de massinha sobre kraft (aceitam pegadas na 3.5). A palavra se lê de quem vem da praça,
  // olhando para o sul: a primeira letra fica a leste (x = 600) e as outras seguem para o oeste.
  prints: F({
    paper: F({ x: F([-760, 760]), z: F([1480, 1680]) }),
    plate: F([180, 5, 130]), z: 1580, from: 600, step: -200, turnDeg: 4,
    colors: F(['#C8553D', '#F28F3B', '#F4C542', '#5BA55B', '#2F6DB5', '#E88AA8', '#F4EDE1']),
    letters: 'PEGADAS',
  }),

  // Capas dos livros (tecido sobre papelão) e títulos inventados das lombadas.
  bookColors: F(['#8E2B25', '#22375C', '#2E5339', '#C9962E', '#2C6E6A', '#6B2338', '#B7652C', '#5B6E83', '#D9CDB4', '#3A3430', '#6E6B34']),
  bookTitles: F([
    'Massa e Forma', 'O Boneco de Arame', 'Luz de Estúdio', 'Doze Poses', 'Papelão Ondulado', 'A Mão do Animador',
    'Cenários de Mesa', 'Quadro a Quadro', 'Cor e Plasticina', 'Sombra Suave', 'Poeira no Feixe', 'O Tripé',
    'Miniaturas', 'Tapete Verde', 'Fita Crepe', 'Relatos de Bancada', 'Grão e Vinheta', 'Espátulas', 'Arame e Espuma',
    'Pequenas Cenas',
  ]),

  // Aparência (src/maps/pista/visual/): cores, tons e medidas que só o desenho usa. Tons em [r, g, b] multiplicam o
  // material (madeira clara da balsa vira cedro, bambu, palito); hex é a cor da peça.
  look: F({
    tape: F({
      color: '#E8D9A8', ink: '#1C2238', labelWidth: 19, textHeight: 10.5, margin: 7,
      font: '700 {px}px "Segoe Print", "Bradley Hand", "Comic Sans MS", "Chalkboard SE", "Baloo 2", cursive',
      atlas: F({ width: 2048, cellHeight: 72, columns: 4 }),
      feet: F({ length: 46, fold: 16, every: 160 }), // fita dobrada no pé das paredes soltas, a cada 160 u de parede
    }),
    cardboardTint: F([0.9, 1.05]), // tom de cada caixa e painel (lotes de papelão diferentes)
    // Caixa de arquivo das rampas: parede, saia da tampa (por fora, rente à colisão), alças e etiqueta na frente.
    archive: F({ wall: 4, lid: 22, handle: F([70, 20]), label: F([150, 90]) }),
    wedgeWall: 4, tentWall: 2.2, tubePitch: 260, flap: F({ top: 34, side: 30, openDeg: 20, splayDeg: 25 }),
    ruler: '#E4C38D', steel: '#B8BDC3', growth: '#27313C',
    pencil: F({ body: '#E7B722', wood: F([1.0, 0.82, 0.66]), ferrule: '#D3B45C', eraser: '#E7909F' }),
    bamboo: F([1.0, 0.92, 0.72]), toothpick: F([1.02, 0.97, 0.84]),
    trenaCase: F({ rubber: '#1E1D1C', metal: '#A7ADB3' }),
    pinShaft: '#C9CDD2',
    fairy: F({ wire: '#2F5A33', bulb: '#FFC88A', emission: 8, bulbRadius: 2.6 }),
    clipboard: F([0.46, 0.34, 0.25]), clip: '#C3C7CB',
    lump: 8.5, // raio das bolotas de massinha que seguram as traves e a bandeirinha
    imprint: F({ depth: 4.5, lip: 1.1, roller: 0.3 }), // relevo das letras, furinhos e marcas do rolo nas placas (u)
  }),

  // Estações (console `estacao`): número, id, nome, apelidos e pontos de teleporte — `at` = [x, z] no chão do lugar,
  // `plank` = altura da prancha da torre (em cima dela, olhando para fora) ou `spiral` (pé da espiral); rumo e pitch
  // em graus. A altura dos pés sai do chão embaixo do ponto (raio de cima para baixo a partir de `below`, padrão 3000).
  stations: list(
    { number: 1, id: 'strafe', label: 'Counter-strafe', aliases: ['counter', 'contra', 'parar'], spots: [
      { id: 'grade', label: 'linha de strafe', at: [-760, 50], heading: 90 },
      { id: 'pilares', label: 'pilares de peek', at: [0, -300], heading: 0 },
    ] },
    { number: 2, id: 'escadas', label: 'Escadas de livros', aliases: ['escada', 'livros', 'degraus'], spots: [
      { id: '8', at: [1580, -500], heading: 0 }, { id: '12', at: [1920, -500], heading: 0 },
      { id: '16', at: [2260, -500], heading: 0 }, { id: '18', at: [1640, -1030], heading: 0 },
      { id: '20', at: [1980, -1030], heading: 0 }, { id: '24', at: [2320, -1030], heading: 0 },
    ] },
    { number: 3, id: 'rampas', label: 'Rampas', aliases: ['rampa', 'inclinacao'], spots: [
      { id: '15', at: [1580, 385], heading: 0 }, { id: '30', at: [1800, 385], heading: 0 },
      { id: '44', at: [2020, 385], heading: 0 }, { id: '46', at: [2240, 385], heading: 0 },
      { id: '60', at: [2460, 385], heading: 0 },
    ] },
    { number: 4, id: 'caixas', label: 'Caixas', aliases: ['caixa', 'blocos', 'altura'], spots: [
      { id: '57', at: [1614, 1085], heading: 0 }, { id: '58', at: [1822, 1085], heading: 0 },
      { id: '64', at: [2030, 1085], heading: 0 }, { id: '66', at: [1614, 830], heading: 0 },
      { id: '67', at: [1822, 830], heading: 0 }, { id: '72', at: [2030, 830], heading: 0 },
    ] },
    { number: 5, id: 'walljump', label: 'Wall-jump', aliases: ['wall', 'poco'], spots: [
      { id: 'poco', label: 'porta do poço', at: [-2450, 420], heading: 0 },
      { id: 'ziguezague', label: 'plataforma A', at: [-1750, 860], heading: 0 },
    ] },
    { number: 6, id: 'slide', label: 'Vãos de slide e gabarito', aliases: ['vaos', 'deslizar', 'agachar'], spots: [
      { id: 'faixa', label: 'início da corrida', at: [-2580, 1270], heading: 90 },
      { id: 'traves', label: 'linha de largada', at: [-2104, 1270], heading: 90 },
      { id: 'gabarito', label: 'portais', at: [-2280, 1540], heading: 180 },
    ] },
    { number: 7, id: 'torre', label: 'Torre de queda', aliases: ['queda', 'espiral'], spots: [
      { id: 'base', label: 'pé da espiral', spiral: true, below: 60 },
      { id: '200', plank: 200 }, { id: '420', plank: 420 }, { id: '600', plank: 600 },
      { id: '900', plank: 900 }, { id: '1310', plank: 1310 },
    ] },
    { number: 8, id: 'bhop', label: 'Faixa de bhop', aliases: ['trena', 'corrida', 'bunny'], spots: [
      { id: 'largada', label: '400 u antes da largada', at: [-2480, -1720], heading: 90 },
      { id: 'chegada', at: [2200, -1720], heading: 270 },
    ] },
    { number: 9, id: 'vigas', label: 'Vigas de balsa', aliases: ['viga', 'balsa', 'equilibrio'], spots: [
      { id: '32', at: [-1200, -1400], heading: 90 }, { id: '16', at: [-1200, -1300], heading: 90 },
      { id: '8', at: [-1200, -1200], heading: 90 }, { id: '4', at: [-1200, -1100], heading: 90 },
      { id: 'rampa', label: 'pé da ripa inclinada', at: [-1250, -680], heading: 0 },
    ] },
    { number: 10, id: 'paredes', label: 'Paredes finas', aliases: ['parede', 'finas'], spots: [
      { id: 'espessuras', at: [680, -1300], heading: 0 }, { id: 'fendas', at: [700, -1140], heading: 0 },
      { id: 'corredor', at: [460, -760], heading: 0 }, { id: 'quina', at: [760, -760], heading: 0 },
      { id: 'curva', at: [980, -800], heading: 45 },
    ] },
    { number: 11, id: 'tunel', label: 'Túnel baixo', aliases: ['caixas-baixas'], spots: [
      { id: 'entrada', label: 'boca oeste', at: [1250, 1450], heading: 90 },
      { id: 'meio', label: 'caixa alta', at: [1800, 1450], heading: 90, below: 50 },
    ] },
    { number: 12, id: 'pegadas', label: 'Pegadas', aliases: ['pegada', 'massinha'], spots: [
      { id: 'placas', at: [0, 1380], heading: 180 },
    ] },
  ),
});

/** Montagem de desempenho medida no preset Alto (para o aceite): teto de draws e triângulos da cena. */
export const PISTA_BUDGET = F({ draws: 120, triangles: 400000, collisionTriangles: 4500 });
