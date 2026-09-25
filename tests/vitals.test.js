// Testes da vida e do dano de queda (subfase 3.4): a curva do CS:GO sobre o limite seguro de 420 u (e as quedas do
// repouso no controlador real), sv_falldamage_scale, o acumulador de dano fracionário, god, colete ignorado, duckbug
// sem dano; no PlayerPawn, a morte (comando vazio, câmera do morto, "reduzir movimento"), a volta com o estado zerado e
// os eventos no barramento; no console, kill e hurtme.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { EV, EventBus } from '../src/core/events.js';
import { FALL, HULL, WALLJUMP } from '../src/data/movement.js';
import { VITALS } from '../src/data/vitals.js';
import { registerVitalsCommands } from '../src/debug/vitalsCommands.js';
import { Loadout } from '../src/player/loadout.js';
import { BTN } from '../src/player/moveCmd.js';
import { createSvVars } from '../src/player/movementVars.js';
import { PlayerPawn } from '../src/player/playerPawn.js';
import {
  applyDamage, createVitals, fallDamage, killVitals, readyToRespawn, respawnVitals,
} from '../src/player/vitals.js';
import { floor, worldOf } from './worldTestUtils.js';
import { DT, idle, makePlayer, run } from './playerTestUtils.js';

const DEG = Math.PI / 180;
const near = (a, b, eps, msg = '') => assert.ok(Math.abs(a - b) <= eps, `${msg} ${a} ≠ ${b}`);
const ground = () => worldOf((b) => floor(b));

test('dano de queda: nada até 819,756 u/s (420 u); linear até 1413,373 u/s na razão do CS:GO; × sv_falldamage_scale', () => {
  const sv = createSvVars();
  near(FALL.safeSpeed, Math.sqrt(2 * 800 * 420), 1e-12, 'limite seguro');
  near(FALL.fatalSpeed / FALL.safeSpeed, 1000 / 580, 1e-12, 'razão do CS:GO');
  assert.equal(fallDamage(FALL.safeSpeed, sv), 0);
  assert.equal(fallDamage(500, sv), 0);
  near(fallDamage(FALL.fatalSpeed, sv), 100, 1e-9, 'fatal');
  near(fallDamage((FALL.safeSpeed + FALL.fatalSpeed) / 2, sv), 50, 1e-9, 'meio do caminho');
  near(fallDamage(FALL.safeSpeed + 1, sv), 100 / (FALL.fatalSpeed - FALL.safeSpeed), 1e-12, '0,1685 por u/s');
  sv.falldamage_scale = 0;
  assert.equal(fallDamage(1300, sv), 0, 'escala 0 desliga');
  sv.falldamage_scale = 2;
  near(fallDamage(FALL.fatalSpeed, sv), 200, 1e-9, 'escala 2');
});

test('quedas do repouso no chão plano: 200 → 0, 420 → 0, 430 → 0,88, 600 → 26,15, 900 → 61,95, 1250 → 99,85, 1310 → 104,06', () => {
  const world = ground();
  const expected = [[200, 0], [420, 0], [430, 0.88], [600, 26.15], [900, 61.95], [1200, 93.54], [1250, 99.85], [1310, 104.06]];
  for (const [h, dmg] of expected) {
    const p = makePlayer(world, [0, h, 0]);
    const land = run(p, 200, idle).find((e) => e.type === 'land');
    assert.ok(land, `pouso da queda de ${h}`);
    near(land.damage, dmg, 0.005, `queda de ${h} u (pouso a ${land.speed} u/s)`);
  }
});

test('acumulador: a parte inteira sai agora e a fração junta até completar 1; god, morto e tipo desconhecido', () => {
  const v = createVitals();
  const r = applyDamage(v, 0.88, 'queda');
  assert.equal(r.taken, 0);
  assert.equal(v.health, 100);
  near(v.accumulator, 0.88, 1e-12, 'guardou a fração');
  assert.equal(applyDamage(v, 26.15, 'queda').taken, 27, '26 + a fração que completou 1');
  near(v.accumulator, 0.03, 1e-9, 'sobra');
  assert.equal(v.health, 73);
  assert.equal(v.lastKind, 'queda');
  assert.equal(applyDamage(v, 50, 'mundo', { god: true }).taken, 0, 'god');
  assert.equal(v.health, 73);
  const dead = applyDamage(v, 80, 'mundo', { cause: 'mundo' });
  assert.equal(dead.killed, true);
  assert.equal(v.alive, false);
  assert.equal(v.health, 0, 'vida nunca abaixo de 0');
  assert.equal(v.cause, 'mundo');
  assert.equal(v.deaths, 1);
  assert.equal(applyDamage(v, 10, 'queda').taken, 0, 'morto não toma dano');
  assert.equal(killVitals(v, 'kill'), false, 'já estava morto');
  assert.throws(() => applyDamage(v, 1, 'lava'), /desconhecido/);
  assert.equal(readyToRespawn(v), false);
  v.deadTime = VITALS.respawnDelay;
  assert.equal(readyToRespawn(v), true);
  respawnVitals(v);
  assert.deepEqual([v.health, v.alive, v.accumulator, v.cause, v.deaths], [100, true, 0, null, 1]);
});

test('duckbug: o pouso de dentro do agachar não passa pelo pouso — sem dano, como no CS', () => {
  const p = makePlayer(ground(), [0, 10, 0]);
  const s = p.state;
  Object.assign(s, { ducked: true, duckFlag: true, duckAmount: 1, height: HULL.duckHeight, oldButtons: BTN.DUCK });
  s.velocity.set(0, -1300, 0);
  const events = run(p, 1, idle);
  assert.ok(s.onGround, 'pousou pelo levantar');
  assert.ok(!events.some((e) => e.type === 'land'), 'sem pouso, sem dano');
});

/** Entrada do PlayerPawn (move, isDown) sem navegador. */
function testInput() {
  return {
    move: { x: 0, y: 0 },
    down: new Set(),
    isDown(action) {
      return this.down.has(action);
    },
  };
}

function pawnAt(y, { events = null, loadout = new Loadout(), world = ground() } = {}) {
  return new PlayerPawn({ world, sv: createSvVars(), loadout, events, position: new THREE.Vector3(0, y, 0) });
}

function ticks(pawn, input, n, opts = {}) {
  for (let i = 0; i < n; i++) pawn.tick(DT, input, { tick: i, ...opts });
}

test('pawn: a queda de 1310 mata ("queda"); morto, o comando fica vazio e a câmera desce e tomba em 0,5 s', () => {
  const bus = new EventBus();
  const seen = [];
  for (const type of [EV.PLAYER_LAND, EV.PLAYER_HURT, EV.PLAYER_DEATH, EV.PLAYER_SPAWN]) bus.on(type, (e) => seen.push({ type, e }));
  const pawn = pawnAt(1310, { events: bus });
  const input = testInput();
  ticks(pawn, input, 200);
  const v = pawn.vitals;
  assert.equal(v.alive, false);
  assert.equal(v.cause, 'queda');
  assert.deepEqual(seen.map((x) => x.type), [EV.PLAYER_LAND, EV.PLAYER_HURT, EV.PLAYER_DEATH], 'pouso, dano e morte');
  near(seen[0].e.damage, 104.06, 0.005, 'dano do pouso');
  assert.equal(seen[1].e.kind, 'queda');
  assert.equal(seen[2].e.cause, 'queda');
  assert.equal(seen[2].e.text, 'Você se esborrachou');
  // A câmera terminou de descer (12 u acima dos pés) e de tombar (35°).
  near(pawn.eyeOffset, VITALS.deathCam.eye, 1e-9, 'olho do morto');
  near(pawn.roll, VITALS.deathCam.rollDeg * DEG, 1e-9, 'tombo');
  // Comando vazio: andar, pular e agachar não fazem nada; o olhar continua.
  const before = pawn.pos.clone();
  input.move.y = 1;
  input.down.add('jump');
  input.down.add('crouch');
  ticks(pawn, input, 30);
  assert.ok(pawn.pos.distanceTo(before) < 1e-6, 'não anda nem pula');
  assert.equal(pawn.state.ducked, false, 'não agacha');
  pawn.applyLook({ yaw: 0.5, pitch: 0 });
  near(pawn.yaw, 0.5, 1e-12, 'o olhar continua livre');
  // "Reduzir movimento": só desce.
  const calm = pawnAt(1310);
  ticks(calm, testInput(), 200, { reduceMotion: true });
  assert.equal(calm.vitals.alive, false);
  assert.equal(calm.roll, 0);
  near(calm.eyeOffset, VITALS.deathCam.eye, 1e-9, 'desce igual');
});

test('pawn: a volta zera vida, movimento, slide, recarga e paredes usadas, e publica o spawn', () => {
  const bus = new EventBus();
  let spawned = null;
  bus.on(EV.PLAYER_SPAWN, (e) => {
    spawned = e;
  });
  const pawn = pawnAt(0, { events: bus });
  const s = pawn.state;
  Object.assign(s, { stamina: 40, slideCooldown: 0.7, usedCount: 3, wallJumps: 3, ducked: true, height: HULL.duckHeight });
  s.velocity.set(300, 0, 0);
  pawn.kill('kill');
  assert.equal(pawn.vitals.alive, false);
  const where = new THREE.Vector3(50, 0, 50);
  pawn.respawn(where, 1, 0);
  const v = pawn.vitals;
  assert.deepEqual([v.health, v.alive, v.accumulator], [100, true, 0]);
  assert.deepEqual([s.stamina, s.slideCooldown, s.usedCount, s.wallJumps, s.sliding, s.ducked], [0, 0, 0, 0, false, false]);
  assert.equal(s.velocity.length(), 0);
  assert.equal(s.wallTime, WALLJUMP.ageMax);
  assert.ok(pawn.pos.distanceTo(where) < 0.1, 'no ponto de volta');
  assert.equal(pawn.yaw, 1);
  assert.equal(pawn.roll, 0);
  near(pawn.eyeOffset, HULL.standEye, 1e-9, 'olho em pé');
  assert.ok(spawned && spawned.position.distanceTo(where) < 0.1, 'EV.PLAYER_SPAWN');
});

test('pawn: colete não reduz a queda; god não toma dano; hurt do tipo mundo com o acumulador', () => {
  const armored = new Loadout();
  armored.giveUtility('kevlarHelmet');
  assert.equal(armored.armor, 100);
  const a = pawnAt(600, { loadout: armored });
  ticks(a, testInput(), 120);
  assert.equal(a.vitals.health, 100 - 26, 'com colete: os mesmos 26');
  const g = pawnAt(1310);
  ticks(g, testInput(), 200, { god: true });
  assert.equal(g.vitals.alive, true, 'god');
  assert.equal(g.vitals.health, 100);
  const p = pawnAt(0);
  assert.equal(p.hurt(10.5, 'mundo').taken, 10);
  assert.equal(p.hurt(10.5, 'mundo').taken, 11, 'a fração completou 1');
  assert.equal(p.vitals.health, 79);
  assert.equal(p.hurt(10, 'mundo', { god: true }).taken, 0, 'god pelo parâmetro');
  assert.equal(p.lastHurt.kind, 'mundo');
});

test('console: kill mata na hora ("Desistiu"); hurtme tira vida do tipo mundo e god segura', () => {
  const commands = new Map();
  const con = { register: (def) => commands.set(def.name, def) };
  const cheats = { god: false };
  let match = null;
  registerVitalsCommands(con, { matchState: () => match, cheats });
  assert.throws(() => commands.get('kill').run([]), /só numa partida andando/);
  const bus = new EventBus();
  let death = null;
  bus.on(EV.PLAYER_DEATH, (e) => {
    death = e;
  });
  match = { player: pawnAt(0, { events: bus }) };
  const hurtme = commands.get('hurtme');
  assert.equal(hurtme.run(['26']), 'dano 26 → vida 74');
  assert.throws(() => hurtme.run(['zero']), /dano inválido/);
  cheats.god = true;
  assert.equal(hurtme.run(['50']), 'god ligado: nenhum dano');
  assert.equal(match.player.vitals.health, 74);
  cheats.god = false;
  assert.equal(hurtme.run(['80']), 'dano 80: morreu');
  assert.equal(death.cause, 'mundo');
  assert.equal(death.text, 'Amassado pelo console');
  assert.equal(hurtme.run(['1']), 'já está morto');
  match.player.respawn(new THREE.Vector3(0, 0, 0));
  assert.equal(commands.get('kill').run([]), 'você desistiu');
  assert.equal(death.cause, 'kill');
  assert.equal(death.text, 'Desistiu');
  assert.equal(commands.get('kill').run([]), 'já está morto');
});
