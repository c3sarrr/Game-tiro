// Testes do movimento tático do CS:GO (Fase 3.2) a 64 tick: curvas de aceleração e parada por item, Shift correndo,
// teto duro, counter-strafe, agachar (tempos, spam, recuperação, sv_timebetweenducks, no ar, FL_DUCKING, sem espaço,
// duckbug e jumpbug), stamina, bunny hop, os pulos da 3.1 e as sv_* novas.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DUCK, HULL, MOVE } from '../src/data/movement.js';
import { BTN } from '../src/player/moveCmd.js';
import { createSvVars } from '../src/player/movementVars.js';
import { eyeHeight } from '../src/player/movement.js';
import { floor, worldOf } from './worldTestUtils.js';
import { DT, forward, idle, makePlayer, run, speed2d } from './playerTestUtils.js';

const ground = () => worldOf((b) => floor(b));
const near = (a, b, eps, msg = '') => assert.ok(Math.abs(a - b) <= eps, `${msg} ${a} ≠ ${b}`);

/** Ticks correndo para a frente (com `buttons`) até a velocidade no plano chegar a `target`. */
function ticksTo(target, { item = 'knife', zoom = 0, buttons = 0, sv, limit = 400 } = {}) {
  const p = makePlayer(ground(), [0, 0, 0], { item, zoom, sv });
  let top = 0;
  for (let i = 1; i <= limit; i++) {
    run(p, 1, (c) => {
      forward(c);
      c.buttons = buttons;
    });
    top = Math.max(top, speed2d(p.state));
    if (speed2d(p.state) >= target - 1e-9) return { ticks: i, p, top };
  }
  return { ticks: Infinity, p, top };
}

/** Ticks até a velocidade no plano ficar abaixo de `below` (ou zerar), com o comando `drive`. */
function ticksUntil(p, drive, below) {
  for (let i = 1; i <= 200; i++) {
    run(p, 1, drive);
    if (below === 0 ? speed2d(p.state) === 0 : speed2d(p.state) < below) return i;
  }
  return Infinity;
}

const withButtons = (buttons, base = idle) => (c) => {
  base(c);
  c.buttons = buttons;
};

test('aceleração do CS:GO pelo item na mão, correndo, andando e agachado', () => {
  assert.equal(ticksTo(250).ticks, 35, 'faca 0 → 250');
  assert.equal(ticksTo(215, { item: 'ak47' }).ticks, 36, 'AK 0 → 215');
  const walk = ticksTo(130, { buttons: BTN.WALK });
  assert.equal(walk.ticks, 40, 'faca andando 0 → 130');
  run(walk.p, 64, withButtons(BTN.WALK, forward));
  assert.ok(Math.abs(speed2d(walk.p.state) - 130) < 1e-9, 'andando não passa de 130');
  assert.equal(ticksTo(215 * MOVE.walkModifier, { item: 'ak47', buttons: BTN.WALK }).ticks, 26, 'AK andando 0 → 111,8');
  assert.equal(ticksTo(250 * DUCK.speedMultiplier, { buttons: BTN.DUCK }).ticks, 100, 'faca agachada 0 → 85');
  assert.equal(ticksTo(100, { item: 'awp', zoom: 1 }).ticks, 53, 'AWP com zoom 0 → 100 (sniper lenta)');
  assert.equal(ticksTo(52, { item: 'awp', zoom: 1, buttons: BTN.WALK }).ticks, 22, 'AWP com zoom andando 0 → 52');
});

test('parada: faca a 250 soltando tudo zera em 26 ticks; Shift correndo trava em 130 no 7º tick', () => {
  const stop = ticksTo(250).p;
  assert.equal(ticksUntil(stop, idle, 0), 26);
  const shift = ticksTo(250).p;
  const speeds = [];
  for (let i = 0; i < 7; i++) {
    run(shift, 1, withButtons(BTN.WALK, forward));
    speeds.push(speed2d(shift.state));
  }
  assert.ok(speeds.slice(0, 6).every((v) => v > 130 && v > 155 - 20), `freia pelo atrito: ${speeds}`);
  assert.equal(speeds[6], 130, 'abaixo de 155 o andar engata e o teto duro trava');
  assert.equal(shift.state.walking, true);
});

test('teto duro: agachando a velocidade segue o teto até 85; o primeiro tick depois do pouso já freia', () => {
  // O agachar do CS correndo: sem o slide da 3.4 (sv_slide 0), que tomaria o aperto do Ctrl a 250 u/s.
  const sv = createSvVars();
  sv.slide = 0;
  const p = ticksTo(250, { sv }).p;
  const s = p.state;
  run(p, 1, withButtons(BTN.DUCK, forward));
  near(s.duckFactor, 1 + (DUCK.speedMultiplier - 1) * s.duckAmount, 1e-12);
  assert.ok(s.maxSpeed < 250 && speed2d(s) <= s.maxSpeed, 'o teto cai já no primeiro tick');
  for (let tick = 2; tick <= 13; tick++) {
    run(p, 1, withButtons(BTN.DUCK, forward));
    near(speed2d(s), s.maxSpeed, 1e-9, `tick ${tick}: cortada no teto do tick`);
  }
  assert.equal(s.ducked, true);
  near(speed2d(s), 250 * DUCK.speedMultiplier, 1e-9, 'agachado de todo: 85');
  // Correndo a 250 e pulando: o pouso soma stamina e o tick seguinte no chão fica no teto × (1 − s/100)².
  const q = ticksTo(250).p;
  run(q, 1, withButtons(BTN.JUMP, forward));
  let landed = false;
  for (let i = 0; i < 80 && !landed; i++) landed = run(q, 1, forward).some((e) => e.type === 'land');
  assert.ok(landed);
  assert.ok(q.state.stamina > 10, `stamina ${q.state.stamina}`);
  run(q, 1, forward);
  assert.ok(q.state.staminaFactor < 0.8);
  near(speed2d(q.state), 250 * q.state.staminaFactor, 1e-9, 'pouso freia no primeiro tick no chão');
});

test('counter-strafe da AK (limiar 73,1): contra 5 ticks × soltar 13', () => {
  const strafing = () => {
    const p = makePlayer(ground(), [0, 0, 0], { item: 'ak47' });
    run(p, 100, (c) => {
      idle(c);
      c.side = 1;
    });
    near(speed2d(p.state), 215, 1e-9);
    return p;
  };
  const threshold = 215 * 0.34;
  assert.equal(ticksUntil(strafing(), (c) => {
    idle(c);
    c.side = -1;
  }, threshold), 5);
  assert.equal(ticksUntil(strafing(), idle, threshold), 13);
});

test('agachar: descer em 13 ticks e levantar em 11; cada mudança da tecla custa 2 da velocidade do agachar', () => {
  const p = makePlayer(ground(), [0, 0, 0]);
  run(p, 4, idle);
  const s = p.state;
  const events = run(p, 1, withButtons(BTN.DUCK));
  near(s.duckSpeed, DUCK.speed - DUCK.spamPenalty + DUCK.recovery * DT, 1e-12, 'aperto: 8 − 2 + recuperação do tick');
  assert.equal(s.ducking, true);
  assert.equal(events.length, 0);
  let ticks = 1;
  while (!s.ducked && ticks < 60) {
    run(p, 1, withButtons(BTN.DUCK));
    ticks++;
  }
  assert.equal(ticks, 13, 'descer');
  assert.equal(s.duckFlag, true);
  assert.equal(s.height, HULL.duckHeight);
  assert.equal(s.sinceDuck, 0);
  run(p, 30, withButtons(BTN.DUCK)); // a velocidade do agachar enche de novo
  assert.equal(s.duckSpeed, DUCK.speed);
  const unduck = run(p, 1, idle);
  assert.ok(unduck.some((e) => e.type === 'unduck'), 'a cápsula em pé entra no primeiro tick');
  assert.equal(s.height, HULL.standHeight);
  ticks = 1;
  while (s.duckAmount > 0 && ticks < 60) {
    run(p, 1, idle);
    ticks++;
  }
  assert.equal(ticks, 11, 'levantar');
  assert.equal(s.ducking, false);
  near(eyeHeight(s), HULL.standEye, 1e-12);
});

test('spam do agachar: abaixo de 1,5 a tecla é ignorada; recupera 3/s e +6/s longe da âncora', () => {
  const p = makePlayer(ground(), [0, 0, 0]);
  const s = p.state;
  for (let i = 0; i < 8; i++) run(p, 1, withButtons(i % 2 === 0 ? BTN.DUCK : 0)); // 4 apertos e 4 soltas seguidos
  assert.ok(s.duckSpeed < DUCK.minEnabled, `velocidade do agachar ${s.duckSpeed}`);
  run(p, 1, withButtons(BTN.DUCK));
  assert.equal(s.duckHeld, false, 'travado: a tecla é ignorada');
  // Parado e em pé: +3/s.
  const before = s.duckSpeed;
  run(p, 64, withButtons(BTN.DUCK));
  near(s.duckSpeed, before + DUCK.recovery, 1e-9, 'um segundo parado');
  assert.equal(s.duckHeld, true, 'destravou acima de 1,5');
  // Longe (> 64 u) de onde a velocidade estava cheia, todo em pé: +3 +6 por segundo.
  const q = makePlayer(ground(), [0, 0, 0]);
  q.state.duckSpeed = 2;
  q.state.duckAnchorX = 200;
  run(q, 32, idle);
  near(q.state.duckSpeed, 2 + (DUCK.recovery + DUCK.recoveryAway) * 0.5, 1e-9, 'meio segundo longe da âncora');
});

test('sv_timebetweenducks: agachar de novo antes de 0,4 s do último agachar completo é ignorado', () => {
  const p = makePlayer(ground(), [0, 0, 0]);
  const s = p.state;
  run(p, 13, withButtons(BTN.DUCK));
  assert.equal(s.ducked, true, 'agachou de todo no 13º tick');
  let since = 0; // ticks desde o agachar completo
  while ((s.duckAmount > 0 || s.ducking) && since < 64) {
    run(p, 1, idle);
    since++;
  }
  assert.equal(s.duckFlag, false, 'levantou de todo');
  let ignored = 0;
  while (!s.duckHeld && since < 64) {
    run(p, 1, withButtons(BTN.DUCK));
    since++;
    if (!s.duckHeld) ignored++;
  }
  assert.ok(ignored > 0, 'o aperto logo depois de levantar é ignorado');
  assert.equal(s.ducking, true, 'quando vale, começa a descer no mesmo tick');
  // Vale no primeiro tick com 0,4 s desde o agachar completo: 26 ticks (25/64 = 0,39 s ainda não).
  assert.equal(since, 26);
  assert.equal(s.sinceDuck, 26 / 64);
  assert.equal(createSvVars().timebetweenducks, 0.4);
  // Com FL_DUCKING ainda ligado (levantando há pouco), agachar de novo vale na hora.
  const q = makePlayer(ground(), [0, 0, 0]);
  run(q, 14, withButtons(BTN.DUCK));
  run(q, 2, idle);
  assert.equal(q.state.duckFlag, true);
  run(q, 1, withButtons(BTN.DUCK));
  assert.equal(q.state.duckHeld, true);
});

test('no ar: agachar e levantar são na hora, com os pés ±9 u e a câmera suavizando o olho', () => {
  const jumpers = () => {
    const pair = [makePlayer(ground(), [0, 0, 0]), makePlayer(ground(), [0, 0, 0])];
    for (const p of pair) {
      run(p, 2, idle);
      run(p, 1, withButtons(BTN.JUMP));
      run(p, 6, idle);
    }
    return pair;
  };
  const [ducker, stander] = jumpers();
  run(ducker, 1, withButtons(BTN.DUCK));
  run(stander, 1, idle);
  const d = ducker.state;
  assert.equal(d.ducked, true);
  assert.equal(d.duckAmount, 1, 'na hora');
  near(d.origin.y - stander.state.origin.y, HULL.airDuckLift, 1e-9, 'pés 9 u acima');
  near(d.viewOffset, -(HULL.airDuckLift + HULL.duckEye - HULL.standEye), 1e-9, 'a câmera absorve o salto do olho');
  run(ducker, 1, idle);
  run(stander, 1, idle);
  assert.equal(d.ducked, false);
  assert.equal(d.duckAmount, 0);
  near(d.origin.y, stander.state.origin.y, 1e-9, 'pés 9 u abaixo de novo');
});

test('FL_DUCKING liga ao completar e desliga levantando ao passar de 25%', () => {
  const p = makePlayer(ground(), [0, 0, 0]);
  run(p, 14, withButtons(BTN.DUCK));
  run(p, 30, withButtons(BTN.DUCK));
  const s = p.state;
  const seen = [];
  for (let i = 0; i < 12; i++) {
    run(p, 1, idle);
    seen.push([s.duckAmount, s.duckFlag]);
  }
  for (const [amount, flag] of seen) assert.equal(flag, amount > DUCK.flagClear, `quanto agachou ${amount}`);
  assert.ok(seen.some(([a]) => a > DUCK.flagClear) && seen.some(([a]) => a <= DUCK.flagClear));
});

test('no ar sem espaço para descer 9 u: continua agachado até pousar e então levanta', () => {
  const p = makePlayer(ground(), [0, 5, 0]);
  const s = p.state;
  Object.assign(s, { ducked: true, duckFlag: true, duckAmount: 1, height: HULL.duckHeight, oldButtons: BTN.DUCK });
  assert.equal(s.onGround, false);
  run(p, 1, idle);
  assert.equal(s.ducked, true, 'a cápsula em pé cruzaria o chão');
  assert.equal(s.duckAmount, 1);
  let ticks = 0;
  while (s.ducked && ticks < 64) {
    run(p, 1, idle);
    ticks++;
  }
  assert.ok(s.onGround && !s.ducked, 'levantou no chão');
});

test('duckbug: levantar no ar rente ao chão pousa sem evento nem stamina; jumpbug pula no mesmo tick', () => {
  const falling = () => {
    const p = makePlayer(ground(), [0, 10, 0]);
    const s = p.state;
    Object.assign(s, { ducked: true, duckFlag: true, duckAmount: 1, height: HULL.duckHeight, oldButtons: BTN.DUCK });
    s.velocity.set(0, -300, 0);
    return p;
  };
  const duckbug = falling();
  const events = run(duckbug, 1, idle);
  assert.ok(duckbug.state.onGround, 'pousou pelo levantar');
  assert.ok(events.some((e) => e.type === 'unduck'));
  assert.ok(!events.some((e) => e.type === 'land'), 'sem evento de pouso');
  assert.equal(duckbug.state.stamina, 0, 'sem stamina de pouso');
  const jumpbug = falling();
  const jb = run(jumpbug, 1, withButtons(BTN.JUMP));
  assert.ok(jb.some((e) => e.type === 'jump'), 'pulou no tick em que o levantar encostou no chão');
  assert.ok(!jb.some((e) => e.type === 'land'));
  assert.equal(jumpbug.state.onGround, false);
  near(jumpbug.state.velocity.y, 301.993377 - 800 * DT, 1e-6, 'impulso cheio (sem stamina) menos a gravidade do tick');
});

test('stamina: 24,16 no pulo, 14,28 no pouso plano, teto × 0,735 no primeiro tick e recuperação a 60/s', () => {
  const p = makePlayer(ground(), [0, 0, 0]);
  const s = p.state;
  run(p, 4, idle);
  run(p, 1, withButtons(BTN.JUMP));
  near(s.stamina, 0.08 * 301.993377, 1e-6, 'pulo');
  let land = null;
  let air = 0;
  while (!land && air < 80) {
    land = run(p, 1, idle).find((e) => e.type === 'land') ?? null;
    air++;
  }
  assert.equal(air, 47, 'ticks no ar de um pulo plano');
  near(land.speed, 285.506623, 1e-5, 'queda no pouso');
  near(s.stamina, 0.05 * land.speed, 1e-9, 'a stamina do pulo já tinha zerado no ar');
  run(p, 1, forward);
  near(s.staminaFactor, (1 - (0.05 * land.speed) / 100) ** 2, 1e-12, 'fator com o valor de antes da recuperação');
  near(s.maxSpeed, 183.718, 1e-3);
  let ticks = 1;
  while (s.stamina > 0 && ticks < 64) {
    run(p, 1, idle);
    ticks++;
  }
  assert.equal(ticks, 16, 'zera em 16 ticks a 60/s');
});

test('pulos seguidos saem mais baixos (stamina); pulo em pé 57 u e pulo + Ctrl 66 u mantidos', () => {
  const apex = (buttons) => {
    const p = makePlayer(ground(), [0, 0, 0]);
    run(p, 2, idle);
    const y0 = p.state.origin.y;
    run(p, 1, withButtons(BTN.JUMP | buttons));
    let top = y0;
    for (let i = 0; i < 80; i++) {
      run(p, 1, withButtons(buttons));
      top = Math.max(top, p.state.origin.y);
    }
    return top - y0;
  };
  near(apex(0), 57, 0.01, 'em pé');
  near(apex(BTN.DUCK), 66, 0.01, 'pulo + Ctrl');
  // Segundo pulo no tick seguinte ao pouso: a stamina do pouso corta o impulso.
  const p = makePlayer(ground(), [0, 0, 0]);
  run(p, 2, idle);
  run(p, 1, withButtons(BTN.JUMP));
  let landed = false;
  while (!landed) landed = run(p, 1, idle).some((e) => e.type === 'land');
  const y0 = p.state.origin.y;
  run(p, 1, withButtons(BTN.JUMP));
  let top = y0;
  for (let i = 0; i < 60; i++) {
    run(p, 1, idle);
    top = Math.max(top, p.state.origin.y);
  }
  assert.ok(top - y0 < 57 * 0.8, `o segundo pulo subiu ${top - y0} u`);
});

test('bunny hop: teto de 286 u/s ao sair do chão; pular no tick do pouso mantém o embalo, perder o tick perde', () => {
  const p = makePlayer(ground(), [0, 0, 0]);
  p.state.velocity.set(400, 0, 0);
  run(p, 1, withButtons(BTN.JUMP));
  // O corte é na velocidade 3D, que no pulo já tem a meia gravidade do tick (−6,25 u/s), como no CS:GO.
  const halfGravity = 800 * 0.5 * DT;
  const capped = (MOVE.bunnyJumpFactor * MOVE.runSpeed * 400) / Math.hypot(400, halfGravity);
  near(speed2d(p.state), capped, 1e-9, '286 em 3D');
  const hop = (perfect) => {
    const q = ticksTo(250).p;
    run(q, 1, withButtons(BTN.JUMP, forward));
    let landed = false;
    while (!landed) landed = run(q, 1, forward).some((e) => e.type === 'land');
    const before = speed2d(q.state);
    run(q, 1, perfect ? withButtons(BTN.JUMP, forward) : forward);
    return { before, after: speed2d(q.state), air: !q.state.onGround };
  };
  const perf = hop(true);
  assert.ok(perf.air && perf.after >= perf.before - 1e-9, `perf: ${perf.before} → ${perf.after}`);
  const late = hop(false);
  assert.ok(late.after < 200, `sem o perf o atrito e a stamina levam para ${late.after}`);
  // Segurar o pulo não repete (sv_autobunnyhopping 0): precisa soltar entre um pulo e outro.
  const held = makePlayer(ground(), [0, 0, 0]);
  const jumps = run(held, 200, withButtons(BTN.JUMP)).filter((e) => e.type === 'jump').length;
  assert.equal(jumps, 1);
});

test('sv_enablebunnyhopping, sv_autobunnyhopping e sv_accelerate_use_weapon_speed', () => {
  const free = makePlayer(ground(), [0, 0, 0], { sv: Object.assign(createSvVars(), { enablebunnyhopping: 1 }) });
  free.state.velocity.set(400, 0, 0);
  run(free, 1, withButtons(BTN.JUMP));
  near(speed2d(free.state), 400, 1e-9, 'sem teto');
  const auto = makePlayer(ground(), [0, 0, 0], { sv: Object.assign(createSvVars(), { autobunnyhopping: 1 }) });
  const jumps = run(auto, 200, withButtons(BTN.JUMP)).filter((e) => e.type === 'jump').length;
  assert.ok(jumps >= 4, `segurando o pulo: ${jumps} pulos`);
  // Sem a velocidade da arma na aceleração (o Source puro), a AK acelera como a faca até o teto dela.
  const source = createSvVars();
  source.accelerate_use_weapon_speed = 0;
  const ak = ticksTo(215, { item: 'ak47', sv: source }).ticks;
  assert.ok(ak < 36, `AK sem a razão da arma: ${ak} ticks`);
  assert.equal(ticksTo(250, { sv: source }).ticks, 35, 'a faca não muda (razão 1)');
  const awp = ticksTo(100, { item: 'awp', zoom: 1, sv: source }).ticks;
  assert.ok(awp < 53, `AWP com zoom sem a regra da sniper lenta: ${awp} ticks`);
});
