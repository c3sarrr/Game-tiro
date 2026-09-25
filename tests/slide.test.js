// Testes do slide (subfase 3.4) a 64 tick: condições de começo (80% da velocidade do item, Shift, no ar, recarga, spam,
// sv_slide 0, Ctrl + Espaço juntos), impulso de 1,2×, cápsula agachada na hora, 0,6 s com a curva do atrito, soltar
// encerra (levanta se couber), controle lateral sem ganhar velocidade, rampa, saída sem parada seca, pulo com o teto do
// bhop (agachado com o Ctrl seguro), sem passos, recarga de 1 s e os eventos com cada motivo.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DUCK, HULL, MOVE, SLIDE } from '../src/data/movement.js';
import { BTN } from '../src/player/moveCmd.js';
import { MOVETYPE } from '../src/player/movement.js';
import { SLIDE_END } from '../src/player/slide.js';
import { createSvVars } from '../src/player/movementVars.js';
import { floor, worldOf } from './worldTestUtils.js';
import { DT, forward, idle, makePlayer, run, speed2d } from './playerTestUtils.js';

const DEG = Math.PI / 180;
const near = (a, b, eps, msg = '') => assert.ok(Math.abs(a - b) <= eps, `${msg} ${a} ≠ ${b}`);
const ground = () => worldOf((b) => floor(b));

/** Jogador no chão com a velocidade `v` no plano para −z (para onde olha com yaw 0). */
function moving(v, { item = 'knife', sv = createSvVars(), world = ground(), at = [0, 0, 0] } = {}) {
  const p = makePlayer(world, at, { item, sv });
  run(p, 2, idle);
  p.state.velocity.set(0, 0, -v);
  return p;
}

/** Comando: para a frente com os botões dados. */
const hold = (buttons) => (c) => {
  forward(c);
  c.buttons = buttons;
};

const slideEvents = (events, phase) => events.filter((e) => e.type === 'slide' && e.phase === phase);

test('começo: Ctrl apertado correndo a ≥ 80% da velocidade do item no chão; não com Shift, no ar, spam, sv_slide 0 ou pulo', () => {
  const starts = (p, buttons = BTN.DUCK) => slideEvents(run(p, 1, hold(buttons)), 'start').length === 1;
  assert.equal(starts(moving(SLIDE.minSpeed * 250)), true, 'faca a 200 u/s');
  assert.equal(starts(moving(SLIDE.minSpeed * 250 - 0.1)), false, 'faca a 199,9 u/s');
  assert.equal(starts(moving(172, { item: 'ak47' })), true, 'AK a 172 u/s');
  assert.equal(starts(moving(171.9, { item: 'ak47' })), false, 'AK a 171,9 u/s');
  assert.equal(starts(moving(250), BTN.DUCK | BTN.WALK), false, 'com o botão do andar');
  assert.equal(starts(moving(250), BTN.DUCK | BTN.JUMP), false, 'Ctrl + Espaço juntos: o pulo agachado do CS');
  const off = createSvVars();
  off.slide = 0;
  assert.equal(starts(moving(250, { sv: off })), false, 'sv_slide 0');
  const spam = moving(250);
  spam.state.duckSpeed = DUCK.minEnabled + 1; // o aperto tira 2: fica abaixo de 1,5 e o portão ignora
  assert.equal(starts(spam), false, 'agachar travado pelo spam');
  const air = moving(250);
  air.state.velocity.y = 200;
  air.state.onGround = false;
  assert.equal(starts(air), false, 'no ar');
  const held = moving(250);
  run(held, 1, hold(0));
  held.state.oldButtons = BTN.DUCK; // o Ctrl já vinha seguro (pouso com o Ctrl seguro)
  assert.equal(starts(held), false, 'sem o aperto neste tick');
});

test('impulso de 1,2 × o item (faca 300, AK 258); mais rápido fica; cápsula agachada na hora, olho na suavização', () => {
  const p = moving(250);
  const ev = run(p, 1, hold(BTN.DUCK));
  const start = slideEvents(ev, 'start')[0];
  near(start.speed, 300, 1e-9, 'faca');
  near(start.from, 250, 1e-9, 'velocidade antes');
  const s = p.state;
  assert.equal(s.sliding, true);
  assert.equal(s.height, HULL.duckHeight);
  assert.equal(s.ducked && s.duckFlag, true);
  assert.equal(s.duckAmount, 1);
  near(s.viewOffset, HULL.standEye - HULL.duckEye, 1e-9, 'queda do olho (18 u) na suavização');
  assert.ok(ev.some((e) => e.type === 'duck'), 'evento de agachar');
  near(slideEvents(run(moving(215, { item: 'ak47' }), 1, hold(BTN.DUCK)), 'start')[0].speed, 258, 1e-9, 'AK');
  near(slideEvents(run(moving(320), 1, hold(BTN.DUCK)), 'start')[0].speed, 320, 1e-9, 'já mais rápido que 300');
});

test('0,6 s: faca 300 → ~205 u/s em ~151 u; AK 258 → ~176 u/s em ~130 u; acaba no tempo, agachado', () => {
  for (const [item, v0, v1, dist] of [['knife', 250, 204.7, 151.2], ['ak47', 215, 176.1, 130.0]]) {
    const p = moving(v0, { item });
    const ev = run(p, 45, hold(BTN.DUCK));
    const end = slideEvents(ev, 'end')[0];
    assert.equal(end.reason, SLIDE_END.TIME, item);
    near(end.time, 39 * DT, 1e-9, `${item}: 39 ticks (0,609 s)`);
    near(end.exitSpeed, v1, 0.1, `${item}: velocidade de saída`);
    near(end.distance, dist, 0.1, `${item}: distância`);
    near(end.entrySpeed, v0 * 1.2, 1e-9, `${item}: entrada`);
    assert.equal(p.state.sliding, false);
    assert.equal(p.state.ducked, true, 'com o Ctrl seguro, continua agachado');
  }
});

test('soltar o Ctrl encerra; levanta se couber e sob uma trave continua agachado', () => {
  const p = moving(250);
  run(p, 10, hold(BTN.DUCK));
  const ev = run(p, 1, hold(0));
  const end = slideEvents(ev, 'end')[0];
  assert.equal(end.reason, SLIDE_END.RELEASE);
  near(end.time, 10 * DT, 1e-9, 'tempo até soltar');
  assert.equal(p.state.ducked, false, 'cápsula em pé de novo');
  assert.equal(p.state.height, HULL.standHeight);
  // Sob uma laje a 60 u: soltar encerra, mas não levanta.
  const low = worldOf((b) => {
    floor(b);
    b.box(400, 10, 400, { center: [0, 65, -300] });
  });
  const q = moving(250, { world: low });
  run(q, 30, hold(BTN.DUCK));
  assert.equal(q.state.sliding, true);
  assert.ok(q.state.origin.z < -100 - HULL.radius, `deslizou para baixo da laje: ${q.state.origin.z}`);
  run(q, 1, hold(0));
  assert.equal(q.state.sliding, false);
  assert.equal(q.state.ducked, true, 'sob a laje continua agachado');
});

test('controle lateral: vira sem ganhar velocidade (~27°/s a 300 u/s); rampa acelera na descida e freia na subida', () => {
  const straight = moving(250);
  const turning = moving(250);
  run(straight, 1, hold(BTN.DUCK));
  run(turning, 1, hold(BTN.DUCK));
  for (let i = 0; i < 20; i++) {
    run(straight, 1, hold(BTN.DUCK));
    run(turning, 1, (c) => {
      c.forward = 0;
      c.side = 1;
      c.buttons = BTN.DUCK;
    });
    near(speed2d(turning.state), speed2d(straight.state), 1e-9, `tick ${i}: mesmo módulo`);
  }
  const v = turning.state.velocity;
  const turned = Math.atan2(v.x, -v.z) / DEG;
  assert.ok(turned > 7 && turned < 11, `virou ${turned}° em 20 ticks`);
  // Rampa de 20° descendo para −z (sobe em +z): deslizando para −z desce; para +z sobe.
  const ramp = () => worldOf((b) => {
    floor(b);
    b.ramp(400, 1200, 1200 * Math.tan(20 * DEG), { center: [0, 0, -600] });
  });
  const speedAfter = (world, [x, y, z], yaw) => {
    const p = makePlayer(world, [x, y + 10, z], { yaw });
    run(p, 30, idle); // pousa na rampa e assenta
    assert.equal(p.state.onGround, true);
    p.state.velocity.set(-Math.sin(yaw) * 250, 0, -Math.cos(yaw) * 250);
    run(p, 20, hold(BTN.DUCK));
    assert.equal(p.state.sliding, true);
    return speed2d(p.state);
  };
  const y = 900 * Math.tan(20 * DEG);
  const down = speedAfter(ramp(), [0, y, 300], 0);
  const flat = speedAfter(ground(), [0, 0, 0], 0);
  const up = speedAfter(ramp(), [0, 300 * Math.tan(20 * DEG), -300], 180 * DEG);
  assert.ok(down > flat + 50 && up < flat - 50, `descida ${down}, plano ${flat}, subida ${up}`);
});

test('saída sem parada seca: o atrito freia até caber no teto; depois o teto duro volta', () => {
  const p = moving(250);
  const speeds = [];
  let endTick = -1;
  for (let i = 0; i < 60; i++) {
    if (slideEvents(run(p, 1, hold(BTN.DUCK)), 'end').length) endTick = i;
    speeds.push(speed2d(p.state));
  }
  assert.ok(endTick > 0);
  const after = speeds.slice(endTick + 1);
  assert.ok(after[0] > 180, `logo depois do fim: ${after[0]}`);
  for (let i = 1; i < after.length; i++) assert.ok(after[i] <= after[i - 1] + 1e-9, 'só cai');
  const capped = after.findIndex((v) => Math.abs(v - 250 * DUCK.speedMultiplier) < 1e-9);
  assert.ok(capped >= 8 && capped <= 13, `cabe no teto de 85 em ${capped} ticks`);
  assert.equal(p.state.slideExit, false);
});

test('pulo no slide: teto de 286 do bhop, stamina de um pulo, fim do slide; com o Ctrl seguro, pés +9 (pulo agachado)', () => {
  const p = moving(250);
  run(p, 3, hold(BTN.DUCK));
  const before = speed2d(p.state);
  const ev = run(p, 1, hold(BTN.DUCK | BTN.JUMP));
  assert.ok(ev.some((e) => e.type === 'jump'));
  assert.equal(slideEvents(ev, 'end')[0].reason, SLIDE_END.JUMP);
  // O teto do bhop corta a velocidade 3D, com a meia gravidade do tick já na vertical (como no CS).
  const cap = MOVE.bunnyJumpFactor * MOVE.runSpeed;
  near(speed2d(p.state), (cap * before) / Math.hypot(before, p.sv.gravity * 0.5 * DT), 1e-6, 'teto do bhop');
  near(p.state.stamina, 0.08 * p.sv.jump_impulse, 1e-9, 'stamina de um pulo');
  let apex = 0;
  run(p, 40, (c) => {
    hold(BTN.DUCK)(c);
    apex = Math.max(apex, p.state.origin.y);
  });
  assert.ok(apex > 57 + HULL.airDuckLift - 1 && apex < 57 + HULL.airDuckLift + 1, `ápice ${apex}: o do pulo agachado`);
});

test('sem passos no slide (o relógio para e segue depois); recarga de 1 s contada do fim', () => {
  const p = moving(250);
  run(p, 1, hold(BTN.DUCK));
  const timer = p.state.stepTimer;
  const ev = run(p, 30, hold(BTN.DUCK));
  assert.equal(ev.filter((e) => e.type === 'step').length, 0);
  assert.equal(p.state.stepTimer, timer, 'relógio parado');
  // Fim por soltar; a recarga começa a contar dali.
  run(p, 1, hold(0));
  assert.equal(p.state.sliding, false);
  near(p.state.slideCooldown, 1, 1e-9, 'recarga cheia no fim');
  const again = () => {
    p.state.velocity.set(0, 0, -250);
    return slideEvents(run(p, 1, hold(BTN.DUCK)), 'start').length === 1;
  };
  run(p, 30, hold(0));
  assert.equal(again(), false, 'antes de 1 s');
  run(p, 1, hold(0));
  for (let i = 0; i < 40 && p.state.slideCooldown > 0; i++) run(p, 1, hold(0));
  assert.equal(again(), true, 'depois de 1 s');
});

test('fim por parar (parede), por ar demais (beirada alta), interrompido (sv_slide 0, noclip); ar curto continua', () => {
  const wall = worldOf((b) => {
    floor(b);
    b.box(400, 200, 20, { center: [0, 100, -60] });
  });
  const w = moving(250, { world: wall });
  assert.equal(slideEvents(run(w, 20, hold(BTN.DUCK)), 'end')[0].reason, SLIDE_END.STOP, 'bateu na parede');
  // Plataforma de 128 u: deslizando para fora dela, cai mais de 0,35 s.
  const ledge = worldOf((b) => {
    floor(b);
    b.box(400, 128, 400, { center: [0, 64, 0] });
  });
  const l = moving(250, { world: ledge, at: [0, 128, -150] });
  assert.equal(slideEvents(run(l, 40, hold(BTN.DUCK)), 'end')[0].reason, SLIDE_END.AIR, 'caiu da plataforma');
  // Degrau de 20 u para baixo (além do que o chão acompanha): ar curto, o slide segue ao pousar.
  const step = worldOf((b) => {
    floor(b);
    b.box(400, 20, 400, { center: [0, 10, 0] });
  });
  const st = moving(250, { world: step, at: [0, 20, -150] });
  let wasAir = false;
  run(st, 20, (c) => {
    hold(BTN.DUCK)(c);
    if (!st.state.onGround && st.state.sliding) wasAir = true;
  });
  assert.equal(wasAir, true, 'passou pelo ar deslizando');
  assert.equal(st.state.sliding, true, 'continua depois de pousar');
  const sv = createSvVars();
  const off = moving(250, { sv });
  run(off, 3, hold(BTN.DUCK));
  sv.slide = 0;
  assert.equal(slideEvents(run(off, 1, hold(BTN.DUCK)), 'end')[0].reason, SLIDE_END.INTERRUPT, 'sv_slide 0');
  const nc = moving(250);
  run(nc, 3, hold(BTN.DUCK));
  nc.state.moveType = MOVETYPE.NOCLIP;
  assert.equal(slideEvents(run(nc, 1, hold(BTN.DUCK)), 'end')[0].reason, SLIDE_END.INTERRUPT, 'noclip');
});
