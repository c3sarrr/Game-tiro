// Testes dos dados de movimento (Fases 3.1, 3.2 e 3.4): sv_* do CS:GO, faixas do console, constantes do movimento
// tático, do slide, do wall-jump e do dano de queda, a vida e os materiais de superfície.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  HULL, SV_DEFAULTS, SV_VARS, CONTROLLER, DUCK, FALL, MOVE, SLIDE, STEPS, VIEW, WALLJUMP,
} from '../src/data/movement.js';
import { DAMAGE, DEATH_CAUSES, VITALS } from '../src/data/vitals.js';
import { SURFACES, SURFACE_INDEX, surfaceIndex } from '../src/data/surfaces.js';
import { createSvVars, setSvVar, resetSvVars } from '../src/player/movementVars.js';

test('movimento: pulo do CS:GO chega a 57 u e as medidas da cápsula são coerentes', () => {
  const apex = SV_DEFAULTS.jump_impulse ** 2 / (2 * SV_DEFAULTS.gravity);
  assert.ok(Math.abs(apex - 57) < 1e-3, `ápice ${apex}`);
  assert.ok(HULL.duckHeight < HULL.standHeight);
  assert.ok(HULL.duckEye < HULL.standEye && HULL.standEye < HULL.standHeight && HULL.duckEye < HULL.duckHeight);
  assert.ok(HULL.footRadius > 0 && HULL.footRadius <= HULL.radius);
  assert.equal(HULL.airDuckLift * 2, HULL.standHeight - HULL.duckHeight);
  assert.ok(CONTROLLER.walkableNormalY > 0 && CONTROLLER.walkableNormalY < 1);
  assert.ok(CONTROLLER.skin > 0 && CONTROLLER.skin < 0.1);
  assert.ok(DUCK.speedMultiplier > 0 && DUCK.speedMultiplier < 1 && DUCK.speed > 0);
  assert.ok(VIEW.smoothTime > 0 && VIEW.smoothMax >= SV_DEFAULTS.stepsize);
});

test('sv_*: toda variável tem faixa no console e o padrão cabe nela', () => {
  assert.deepEqual(SV_VARS.map((v) => v.key).sort(), Object.keys(SV_DEFAULTS).sort());
  for (const v of SV_VARS) {
    assert.ok(v.min <= SV_DEFAULTS[v.key] && SV_DEFAULTS[v.key] <= v.max, v.key);
    assert.ok(v.help.length > 3, v.key);
  }
});

test('sv_*: troca limitada à faixa, rejeita lixo e volta ao CS:GO', () => {
  const vars = createSvVars();
  assert.equal(setSvVar(vars, 'gravity', '600'), 600);
  assert.equal(vars.gravity, 600);
  assert.equal(setSvVar(vars, 'stepsize', 999), 64);
  assert.equal(setSvVar(vars, 'friction', '4,5'), 4.5);
  assert.throws(() => setSvVar(vars, 'gravidade', 1), /desconhecida/);
  assert.throws(() => setSvVar(vars, 'gravity', 'abc'), /inválido/);
  resetSvVars(vars);
  assert.deepEqual(vars, { ...SV_DEFAULTS });
});

test('superfícies: ids únicos, índice e erro para id desconhecido', () => {
  const ids = SURFACES.map((s) => s.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.ok(SURFACES.length < 256, 'o índice precisa caber em Uint8');
  ids.forEach((id, i) => assert.equal(SURFACE_INDEX[id], i));
  assert.equal(surfaceIndex('massinha'), SURFACE_INDEX.massinha);
  assert.equal(surfaceIndex(3), 3);
  assert.ok(SURFACES[SURFACE_INDEX.massinha].imprint);
  for (const s of SURFACES) {
    assert.ok(s.friction > 0 && s.jumpFactor > 0, s.id);
    assert.ok(s.stepSlow > 0 && s.stepSlow < s.stepFast && s.stepFast <= 1, s.id);
  }
  assert.throws(() => surfaceIndex('lava'), /desconhecida/);
  assert.throws(() => surfaceIndex(999), /desconhecida/);
});

test('movimento tático (3.2): constantes do CS:GO coerentes entre si', () => {
  assert.equal(MOVE.runSpeed, 260);
  assert.ok(MOVE.walkModifier > 0 && MOVE.walkModifier < 1);
  // Andar a 0,52 da faca (250) dá 130 u/s, abaixo do limiar dos passos audíveis (135,2): Shift é silencioso.
  assert.ok(250 * MOVE.walkModifier < STEPS.audibleSpeed);
  assert.ok(MOVE.bunnyJumpFactor > 1);
  assert.ok(DUCK.downFactor > 0 && DUCK.downFactor < 1);
  assert.ok(DUCK.minEnabled < DUCK.speed && DUCK.spamPenalty > 0);
  assert.ok(DUCK.flagClear > 0 && DUCK.flagClear < 1);
  assert.ok(DUCK.recoveryAway > DUCK.recovery);
  assert.ok(STEPS.walkSpeed < STEPS.runSpeed && STEPS.duckWalkSpeed < STEPS.duckRunSpeed);
  assert.ok(STEPS.fastInterval < STEPS.slowInterval && STEPS.frequency > 0 && STEPS.frequency <= 1);
  assert.ok(STEPS.landAudibleSpeed < STEPS.roughLandSpeed);
  assert.ok(SV_DEFAULTS.staminamax <= SV_VARS.find((v) => v.key === 'staminamax').max);
});

test('sv_*: variáveis liga/desliga do console são inteiras', () => {
  const vars = createSvVars();
  assert.equal(setSvVar(vars, 'enablebunnyhopping', '0,7'), 1);
  assert.equal(setSvVar(vars, 'autobunnyhopping', 5), 1);
  assert.equal(setSvVar(vars, 'accelerate_use_weapon_speed', 0.2), 0);
  assert.equal(setSvVar(vars, 'timebetweenducks', '0,25'), 0.25);
  assert.equal(setSvVar(vars, 'slide', 0.4), 0);
  assert.equal(setSvVar(vars, 'walljump', '1'), 1);
  assert.equal(setSvVar(vars, 'slide_time', '0,8'), 0.8);
});

test('slide, wall-jump e queda (3.4): números da referência na escala do CS e o limite seguro de 420 u', () => {
  // Slide: impulso 12,8 ÷ 10,6 da referência, 0,6 s, recarga 1 s; entra a 80% e acaba na velocidade do agachado.
  assert.ok(Math.abs(SV_DEFAULTS.slide_speed - 12.8 / 10.6) < 0.01);
  assert.equal(SV_DEFAULTS.slide_time, 0.6);
  assert.equal(SV_DEFAULTS.slide_cooldown, 1);
  assert.ok(SLIDE.endSpeed < SLIDE.minSpeed && SLIDE.minSpeed < SV_DEFAULTS.slide_speed);
  assert.equal(SLIDE.endSpeed, DUCK.speedMultiplier);
  assert.ok(Math.abs(SLIDE.steer * 10.6 - 6) < 1e-12, 'controle lateral de 6 m/s² da referência');
  // Atrito do slide: faca 300 → ~205 u/s em 0,6 s (decaimento contínuo e^(−0,12 · 5,2 · 0,6)).
  const decay = Math.exp(-SV_DEFAULTS.slide_friction * SV_DEFAULTS.friction * SV_DEFAULTS.slide_time);
  assert.ok(300 * decay > 200 && 300 * decay < 210, `${300 * decay}`);
  // Wall-jump: 0,958 do pulo (+52,35 u de ápice), subida máxima 7 ÷ 9,6 do pulo, teto do bhop.
  assert.ok(Math.abs(SV_DEFAULTS.walljump_up ** 2 / (2 * SV_DEFAULTS.gravity) - 52.35) < 0.01);
  assert.ok(Math.abs(WALLJUMP.maxRise * SV_DEFAULTS.jump_impulse - 220.2) < 0.05);
  assert.equal(SV_DEFAULTS.walljump_maxspeed, MOVE.bunnyJumpFactor * MOVE.runSpeed);
  assert.ok(WALLJUMP.grace < WALLJUMP.buffer && WALLJUMP.buffer < WALLJUMP.cooldown);
  const wallDeg = Math.acos(WALLJUMP.maxNormalY) / (Math.PI / 180);
  assert.ok(wallDeg > 69 && wallDeg < 71, `parede: normal a até ~20° da horizontal (rampas até 70° não contam): ${wallDeg}`);
  assert.ok(WALLJUMP.minAway > 0 && WALLJUMP.minAway < 90 && WALLJUMP.sameWall > 0 && WALLJUMP.sameWall < 90);
  assert.ok(WALLJUMP.maxUsed >= 4 && WALLJUMP.ageMax > WALLJUMP.grace);
  // Queda: sem dano até a de 420 u; fatal na razão 1000/580 do CS:GO.
  assert.ok(Math.abs(FALL.safeSpeed - 819.756) < 0.001);
  assert.ok(Math.abs(FALL.fatalSpeed - 1413.373) < 0.001);
  assert.equal(FALL.fatalDamage, VITALS.maxHealth);
});

test('vida (3.4): tipos de dano sem colete, causas com texto, volta em 2 s e a câmera do morto', () => {
  for (const kind of Object.values(DAMAGE)) assert.equal(kind.armor, false, 'queda e mundo não passam pelo colete');
  for (const cause of ['queda', 'fora', 'kill', 'mundo']) assert.ok(DEATH_CAUSES[cause]?.length > 3, cause);
  assert.equal(VITALS.maxHealth, 100);
  assert.equal(VITALS.respawnDelay, 2);
  assert.ok(VITALS.deathCam.eye > 0 && VITALS.deathCam.eye < HULL.duckEye);
  assert.ok(VITALS.deathCam.rollDeg > 0 && VITALS.deathCam.time > 0 && VITALS.damageFlash > 0);
});
