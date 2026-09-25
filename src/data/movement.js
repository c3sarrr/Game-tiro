// Movimento do jogador (seção 0.6): cápsula, constantes do controlador e variáveis sv_* no modelo do CS:GO.
// Unidades: 1 u = 1 cm na escala do boneco (72 u de altura) — as mesmas do CS, então os números batem com os dele.
// As sv_* mudam em tempo de execução pelo console (`sv_gravity 600`); na partida online o host as replica.
// Fonte dos números da Fase 3.2 (andar, agachar, stamina, bhop, passos): código do CS:GO e dados finais do jogo —
// docs/research/csgo-movement-notes.md; decisões em docs/phases/phase-3.md (seção 3.2). Os da 3.4 (slide, wall-jump,
// dano de queda) vêm do Doodle District (src/player.js da referência, convertido para a escala do CS) e do código do
// CS:GO (CheckFalling, FlPlayerFallDamage); decisões em docs/phases/phase-3.md (seção 3.4).

/** Jogador: cápsula para colidir e base chata (disco dos pés) para o chão. A origem fica nos pés (centro da base). */
export const HULL = Object.freeze({
  radius: 16, // hull de 32 × 32 do CS (o corpo do boneco de referência tem raio ~15)
  standHeight: 72,
  duckHeight: 54,
  standEye: 64, // VEC_VIEW
  duckEye: 46, // VEC_DUCK_VIEW
  airDuckLift: 9, // agachar no ar: pés sobem 9 u e a cabeça desce 9 u (pulo agachado ≈ 66 u, alcança caixa de 64)
  footRadius: 16, // disco dos pés: fica de pé em qualquer chão andável que ele cubra (o fundo reto da caixa do CS)
});

/** Variáveis de servidor com os valores do CS:GO. A chave é o nome do console sem o prefixo `sv_`. */
export const SV_DEFAULTS = Object.freeze({
  gravity: 800,
  maxspeed: 320, // teto do desejo de movimento
  maxvelocity: 3500, // teto por eixo
  accelerate: 5.5,
  airaccelerate: 12,
  air_max_wishspeed: 30,
  friction: 5.2,
  stopspeed: 80,
  stepsize: 18,
  jump_impulse: 301.993377, // √(2·800·57): ápice de 57 u
  bounce: 0,
  staminamax: 80,
  staminajumpcost: 0.08, // por u/s de impulso do pulo
  staminalandcost: 0.05, // por u/s de queda no pouso
  staminarecoveryrate: 60, // por segundo
  enablebunnyhopping: 0, // 0: velocidade cortada em 1,1 × 260 ao pular
  autobunnyhopping: 0, // 0: precisa soltar o pulo entre dois pulos
  timebetweenducks: 0.4, // s: sem estar agachado, agachar de novo antes disso (do último agachar completo) é ignorado
  accelerate_use_weapon_speed: 1, // aceleração no chão pela velocidade do item na mão
  slide: 1, // 1: correr + agachar desliza (seção 0.6)
  slide_speed: 1.2, // impulso do slide: no mínimo isto × a velocidade do item (12,8 ÷ 10,6 da referência)
  slide_time: 0.6, // s: duração máxima do slide
  slide_cooldown: 1, // s: recarga, contada do fim do slide
  slide_friction: 0.12, // atrito do slide: fração do sv_friction
  walljump: 1, // 1: pulo no ar encostado numa parede é wall-jump (seção 0.6)
  walljump_up: 301.993377 * (9.2 / 9.6), // 289,41 u/s: 0,958 do pulo (a razão da referência), +52,35 u de ápice
  walljump_maxspeed: 286, // teto da velocidade no plano do chute (o do bhop: 1,1 × 260)
  falldamage_scale: 1, // escala do dano de queda (0 desliga)
});

/** Faixa aceita e ajuda de cada sv_* no console. `int`: 0/1 (arredonda). */
export const SV_VARS = Object.freeze([
  Object.freeze({ key: 'gravity', min: 0, max: 4000, help: 'gravidade (u/s²)' }),
  Object.freeze({ key: 'maxspeed', min: 1, max: 2000, help: 'teto do desejo de movimento (u/s)' }),
  Object.freeze({ key: 'maxvelocity', min: 100, max: 10000, help: 'velocidade máxima por eixo (u/s)' }),
  Object.freeze({ key: 'accelerate', min: 0, max: 100, help: 'aceleração no chão' }),
  Object.freeze({ key: 'airaccelerate', min: 0, max: 1000, help: 'aceleração no ar' }),
  Object.freeze({ key: 'air_max_wishspeed', min: 0, max: 1000, help: 'desejo máximo de velocidade no ar (u/s)' }),
  Object.freeze({ key: 'friction', min: 0, max: 100, help: 'atrito no chão' }),
  Object.freeze({ key: 'stopspeed', min: 0, max: 1000, help: 'velocidade de parada do atrito (u/s)' }),
  Object.freeze({ key: 'stepsize', min: 0, max: 64, help: 'altura máxima de degrau (u)' }),
  Object.freeze({ key: 'jump_impulse', min: 0, max: 2000, help: 'velocidade vertical do pulo (u/s)' }),
  Object.freeze({ key: 'bounce', min: 0, max: 2, help: 'quique nas paredes no ar' }),
  Object.freeze({ key: 'staminamax', min: 0, max: 100, help: 'teto da stamina (penalidade de pulo e pouso)' }),
  Object.freeze({ key: 'staminajumpcost', min: 0, max: 1, help: 'stamina por u/s de impulso do pulo' }),
  Object.freeze({ key: 'staminalandcost', min: 0, max: 1, help: 'stamina por u/s de queda no pouso' }),
  Object.freeze({ key: 'staminarecoveryrate', min: 0, max: 1000, help: 'recuperação da stamina (por segundo)' }),
  Object.freeze({ key: 'enablebunnyhopping', min: 0, max: 1, int: true, help: '1 = sem teto de velocidade ao pular' }),
  Object.freeze({ key: 'autobunnyhopping', min: 0, max: 1, int: true, help: '1 = pula de novo segurando o botão' }),
  Object.freeze({ key: 'timebetweenducks', min: 0, max: 2, help: 'espera (s) para agachar de novo após completar' }),
  Object.freeze({
    key: 'accelerate_use_weapon_speed', min: 0, max: 1, int: true, help: '1 = aceleração pela velocidade da arma',
  }),
  Object.freeze({ key: 'slide', min: 0, max: 1, int: true, help: '1 = correr + agachar desliza' }),
  Object.freeze({ key: 'slide_speed', min: 0, max: 3, help: 'impulso do slide (× velocidade do item)' }),
  Object.freeze({ key: 'slide_time', min: 0, max: 5, help: 'duração máxima do slide (s)' }),
  Object.freeze({ key: 'slide_cooldown', min: 0, max: 10, help: 'recarga do slide (s, contada do fim)' }),
  Object.freeze({ key: 'slide_friction', min: 0, max: 1, help: 'atrito do slide (fração do sv_friction)' }),
  Object.freeze({ key: 'walljump', min: 0, max: 1, int: true, help: '1 = pulo no ar encostado numa parede é wall-jump' }),
  Object.freeze({ key: 'walljump_up', min: 0, max: 2000, help: 'velocidade vertical do wall-jump (u/s)' }),
  Object.freeze({ key: 'walljump_maxspeed', min: 0, max: 3500, help: 'teto da velocidade no plano do wall-jump (u/s)' }),
  Object.freeze({ key: 'falldamage_scale', min: 0, max: 10, help: 'escala do dano de queda (0 desliga)' }),
]);

/** Constantes do controlador (gamemovement.cpp do Source). */
export const CONTROLLER = Object.freeze({
  skin: 0.03125, // DIST_EPSILON: a cápsula para a esta distância das superfícies
  groundProbe: 2, // chão até esta distância abaixo dos pés ainda segura o jogador (ele encosta nele)
  walkableNormalY: 0.7, // chão andável até ~45,6°
  supportTolerance: 0.05, // folga (u) ao comparar alturas do chão da base chata
  edgeContactDot: 0.9999, // normal de contato × normal da face abaixo disto: contato de aresta ou vértice
  nonJumpVelocity: 140, // subindo mais rápido que isso não gruda no chão
  maxBumps: 4,
  maxClipPlanes: 5,
  minSpeed: 1, // abaixo disso (u/s) a velocidade no chão zera
  steepSlideFriction: 0.25, // atrito da superfície subindo em rampa íngreme
  snapMin: 0.015625, // ajuste mínimo (u) para grudar no chão (meia COORD_RESOLUTION)
  depenetrateIterations: 8,
  penetrationTolerance: 0.01, // penetração real (u) abaixo disso não conta como preso
  unstuckRadii: Object.freeze([4, 8, 16, 24, 32, 48, 64]), // anéis da busca por espaço livre
  unstuckPreferGround: 8, // empurrão maior que isto (u) para um lugar sem chão: procura antes um lugar livre com chão
  unstuckGroundDepth: 128, // "com chão": chão da base chata até esta distância (u) abaixo dos pés
  discreteStepTolerance: 0.25, // variação de altura além da inclinação do chão (u) que a câmera trata como degrau
});

/** Teto e modificadores de velocidade do CS:GO (cs_shareddefs.cpp, cs_gamemovement.cpp). */
export const MOVE = Object.freeze({
  runSpeed: 260, // CS_PLAYER_SPEED_RUN: teto de qualquer item e base do teto do bhop
  walkModifier: 0.52, // CS_PLAYER_SPEED_WALK_MODIFIER (Shift)
  walkCapMargin: 25, // o andar só engata com a velocidade abaixo de teto × 0,52 + 25
  walkDampWindow: 5, // u/s: andando, a aceleração some nos últimos 5 u/s antes da meta
  accelerateReference: 250, // escala mínima da aceleração no chão (o flMaxSpeed do CCSGameMovement::Accelerate)
  slowSniperWalkSpeed: 110, // luneta de 2+ níveis, com zoom e velocidade × 0,52 abaixo disto: "sniper lenta"
  bunnyJumpFactor: 1.1, // BUNNYJUMP_MAX_SPEED_FACTOR: teto do bhop = 1,1 × runSpeed
  staminaRange: 100, // STAMINA_RANGE: divisor dos efeitos da stamina (não é o sv_staminamax)
  jumpSoundSpeed: 126, // pulo com velocidade 3D acima disto é ouvido pelos outros
});

/** Agachar (CS:GO, CCSGameMovement::CheckParameters/Duck). */
export const DUCK = Object.freeze({
  speed: 8, // CS_PLAYER_DUCK_SPEED_IDEAL: velocidade cheia do agachar (fração da transição por segundo)
  downFactor: 0.8, // descer é mais lento que levantar: 0,8 × velocidade
  speedMultiplier: 0.34, // CS_PLAYER_SPEED_DUCK_MODIFIER: velocidade agachado
  spamPenalty: 2, // cada mudança da tecla (apertar e soltar) tira isto da velocidade do agachar
  minEnabled: 1.5, // abaixo disto a tecla de agachar é ignorada
  recovery: 3, // recuperação da velocidade do agachar (por segundo)
  recoveryAway: 6, // mais esta, todo em pé ou agachado e longe de onde a velocidade estava cheia
  recoveryAwayDistance: 64, // "longe" (u, no plano)
  minUnduck: 1.5, // levantar nunca é mais lento que isto
  flagClear: 0.75, // levantando, o FL_DUCKING cai quando o quanto agachou fica abaixo disto
  sinceMax: 60, // teto (s) do "tempo desde o último agachar completo"
});

/**
 * Slide (seção 0.6; referência: o slide do Doodle District na escala do CS). Começa com o Ctrl apertado correndo no
 * chão; impulso, duração, recarga e atrito são sv_* (sv_slide_speed, sv_slide_time, sv_slide_cooldown,
 * sv_slide_friction). Velocidades em fração da velocidade do item na mão no modo atual.
 */
export const SLIDE = Object.freeze({
  minSpeed: 0.8, // velocidade no plano mínima para começar (a referência: 6,3 m/s com sprint de 10,6 e andar de 6,6)
  steer: 6 / 10.6, // controle lateral: o desejo empurra isto × a velocidade do item por segundo (6 m/s² da referência)
  airTime: 0.35, // s no ar que o slide aguenta (a referência); pousando antes disso ele continua
  endSpeed: DUCK.speedMultiplier, // abaixo disto o slide acaba: a velocidade do agachado (a referência: 3,5 m/s)
});

/**
 * Wall-jump (seção 0.6; referência: o wall-jump do Doodle District). No ar, encostado numa parede, um aperto do pulo
 * chuta para onde o jogador olha; a mesma parede só volta a valer depois do chão. Vertical e teto do chute são sv_*
 * (sv_walljump_up, sv_walljump_maxspeed); o piso do chute é a velocidade do item na mão.
 */
export const WALLJUMP = Object.freeze({
  reach: 4, // u além do raio da cápsula em que a sonda acha a parede
  maxNormalY: 0.34, // parede: normal de contato a no máximo ~20° da horizontal (chão, teto e rampas não contam)
  grace: 0.12, // s: o contato vale até isto depois de soltar a parede (a referência)
  buffer: 0.15, // s: um aperto do pulo no ar fica armado isto (a referência)
  cooldown: 0.35, // s entre dois wall-jumps (a referência)
  maxRise: 7 / 9.6, // subindo mais rápido que isto × sv_jump_impulse não vale (7 m/s com pulo de 9,6 na referência)
  minAway: 30, // graus: o chute sai pelo menos isto para fora da parede
  sameWall: 45, // graus: mesma peça de colisão com a direção a até isto de uma já usada é a mesma parede
  maxUsed: 16, // paredes usadas guardadas por voo (anel)
  ageMax: 60, // teto (s) da idade do contato de parede: sem contato
});

/**
 * Dano de queda (CS:GO: CheckFalling + FlPlayerFallDamage) com o limite seguro da seção 0.6: sem dano até a queda de
 * ~420 u; depois, linear na velocidade de queda do pouso até o fatal, na razão do CS:GO
 * (CS_PLAYER_FATAL_FALL_SPEED 1000 ÷ CS_PLAYER_MAX_SAFE_FALL_SPEED 580). Escala: sv_falldamage_scale.
 */
export const FALL = Object.freeze({
  safeSpeed: Math.sqrt(2 * 800 * 420), // 819,756 u/s: queda de 420 u com a gravidade do CS (sv_gravity 800)
  fatalSpeed: Math.sqrt(2 * 800 * 420) * (1000 / 580), // 1413,373 u/s
  fatalDamage: 100, // dano no fatal (o "100" do CS: a vida inteira)
});

/** Passos (CCSPlayer::UpdateStepSound + CBasePlayer::UpdateStepSound): relógio em ms e velocidades em u/s. */
export const STEPS = Object.freeze({
  audibleSpeed: 135.2, // 260 × 0,52: abaixo disto, ou andando (Shift), o passo é silencioso
  stoppedSpeedSq: 10, // |v|² abaixo disto: parado, o relógio recomeça
  fastInterval: 300,
  slowInterval: 400,
  frequency: 0.97, // sv_footstep_sound_frequency: multiplica o intervalo
  duckExtra: 100, // com FL_DUCKING o passo demora mais
  walkSpeed: 90, // velocidade mínima para dar passo
  runSpeed: 220, // abaixo disto o passo é da classe lenta (cadência 400, volume menor)
  duckWalkSpeed: 60, // o mesmo com FL_DUCKING
  duckRunSpeed: 80,
  duckVolume: 0.65,
  landAudibleSpeed: 270, // pouso ouvido pelos outros (velocidade de queda)
  roughLandSpeed: 350, // pouso pesado: atrasa o próximo passo
  roughLandDelay: 400,
  transmitDistance: 1250, // passos não chegam a quem está mais longe que isto (audição dos bots, Fase 7)
});

/** Câmera do jogador: suavização de degrau e de troca de cápsula no ar; terceira pessoa (debug). */
export const VIEW = Object.freeze({
  smoothTime: 0.06, // constante de tempo (s) do decaimento da suavização
  smoothMax: 24, // teto do deslocamento suavizado (u)
  thirdPersonDistance: 120,
  thirdPersonHeight: 12,
  thirdPersonProbe: 6, // raio da esfera que recolhe a câmera ao bater em parede
});
