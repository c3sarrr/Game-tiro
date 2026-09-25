// Testes do jogador local (Fases 3.1 e 3.2): comando do tick a partir da entrada, andar, interpolação da câmera,
// suavização do degrau, noclip pelo tick, teleporte; troca de item pelo comando e automática, luneta (FOV interpolado,
// sensibilidade, velocidade), precisão no tick, telemetria e os eventos no barramento.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { EV, EventBus } from '../src/core/events.js';
import { CONTROLLER, HULL } from '../src/data/movement.js';
import { createFpsCamera } from '../src/render/camera.js';
import { Loadout } from '../src/player/loadout.js';
import { BTN, SELECT, createMoveCmd, readMoveCmd } from '../src/player/moveCmd.js';
import { PlayerPawn } from '../src/player/playerPawn.js';
import { createSvVars } from '../src/player/movementVars.js';
import { TFLAG } from '../src/player/telemetry.js';
import { floor, worldOf } from './worldTestUtils.js';

const SKIN = CONTROLLER.skin;

/** Entrada com a mesma interface que o PlayerPawn usa do InputManager (move, isDown e pressed do tick). */
function testInput() {
  return {
    move: { x: 0, y: 0 },
    down: new Set(),
    hits: new Set(), // ações apertadas neste tick (o pressed do InputManager)
    isDown(action) {
      return this.down.has(action);
    },
    pressed(action) {
      return this.hits.has(action);
    },
  };
}

const pawnOn = (world, position = [0, 0, 0], opts = {}) => new PlayerPawn({
  world, sv: createSvVars(), position: new THREE.Vector3(...position), ...opts,
});

/** Inventário com as armas dadas (a primeira de cada slot fica). */
function loadoutWith(...weapons) {
  const l = new Loadout();
  for (const w of weapons) l.give(w, { ignoreTeam: true });
  return l;
}

/** Roda `n` ticks; `hit` é apertada só no primeiro. */
function ticks(pawn, input, n, { hit = null, noclip = false, start = 0 } = {}) {
  for (let i = 0; i < n; i++) {
    input.hits.clear();
    if (hit && i === 0) input.hits.add(hit);
    pawn.tick(1 / 64, input, { tick: start + i, noclip });
  }
  input.hits.clear();
}

test('comando do tick: movimento, bits dos botões e ângulos', () => {
  const input = testInput();
  input.move.x = 0.5;
  input.move.y = -1;
  input.down.add('jump').add('crouch').add('aim');
  const cmd = readMoveCmd(createMoveCmd(), input, 42, 1.5, -0.2);
  assert.equal(cmd.tick, 42);
  assert.equal(cmd.side, 0.5);
  assert.equal(cmd.forward, -1);
  assert.equal(cmd.buttons, BTN.JUMP | BTN.DUCK | BTN.ATTACK2);
  assert.equal(cmd.yaw, 1.5);
  assert.equal(cmd.pitch, -0.2);
  assert.equal(cmd.select, SELECT.NONE, 'entrada sem pressed (3.1) não troca de item');
  const withHits = testInput();
  withHits.hits.add('slot2').add('lastWeapon');
  assert.equal(readMoveCmd(createMoveCmd(), withHits, 1, 0, 0).select, SELECT.SLOT2, 'vale a primeira da ordem');
  withHits.hits.clear();
  withHits.hits.add('prevWeapon');
  assert.equal(readMoveCmd(createMoveCmd(), withHits, 1, 0, 0).select, SELECT.PREV);
});

test('pawn: anda para onde olha e a câmera interpola pés + olho entre os ticks', () => {
  const pawn = pawnOn(worldOf((b) => floor(b)));
  const input = testInput();
  input.move.y = 1;
  for (let i = 0; i < 64; i++) pawn.tick(1 / 64, input, { tick: i });
  assert.ok(pawn.state.origin.z < -100, `andou ${pawn.state.origin.z}`);
  assert.ok(pawn.stats.distance > 100 && pawn.stats.topSpeed > 200);
  assert.ok(pawn.physicsStats.sweeps > 0 && pawn.physicsStats.us >= 0);
  const cam = new THREE.PerspectiveCamera();
  pawn.updateCamera(cam, 0);
  const a = cam.position.clone();
  pawn.updateCamera(cam, 1);
  const b = cam.position.clone();
  pawn.updateCamera(cam, 0.5);
  assert.ok(cam.position.distanceTo(a.clone().lerp(b, 0.5)) < 1e-9);
  assert.ok(Math.abs(b.y - (pawn.state.origin.y + HULL.standEye)) < 1e-6);
  assert.ok(b.z < a.z, 'o quadro seguinte está à frente');
});

test('pawn: ao subir um degrau de 16 u o olho sobe suave e alcança a altura certa', () => {
  const world = worldOf((b) => {
    floor(b);
    b.box(400, 16, 2000, { center: [0, 8, -1050] }); // degrau com a frente em z = −50
  });
  const pawn = pawnOn(world);
  const input = testInput();
  input.move.y = 1;
  const cam = new THREE.PerspectiveCamera();
  let stepped = false;
  for (let i = 0; i < 64 && !stepped; i++) {
    const before = pawn.state.origin.y;
    pawn.tick(1 / 64, input, { tick: i });
    stepped = pawn.state.origin.y - before > 10;
  }
  assert.ok(stepped, 'não subiu o degrau');
  pawn.updateCamera(cam, 1);
  const eyeJump = cam.position.y - (pawn.prevOrigin.y + pawn.prevEyeOffset);
  assert.ok(eyeJump < 12, `a câmera pulou ${eyeJump} u de uma vez`);
  for (let i = 0; i < 32; i++) pawn.tick(1 / 64, input, { tick: 100 + i });
  pawn.updateCamera(cam, 1);
  assert.ok(Math.abs(cam.position.y - (16 + SKIN + HULL.standEye)) < 0.05, `olho ${cam.position.y}`);
});

test('pawn: noclip pelo tick atravessa parede e, desligado dentro dela, o jogador sai', () => {
  const world = worldOf((b) => {
    floor(b);
    b.box(1000, 300, 40, { center: [0, 150, -100] }); // parede de z = −120 a z = −80
  });
  const pawn = pawnOn(world);
  const input = testInput();
  input.move.y = 1;
  for (let i = 0; i < 48; i++) pawn.tick(1 / 64, input, { noclip: true, tick: i });
  assert.ok(pawn.state.origin.z < -120, `noclip ficou na parede (z ${pawn.state.origin.z})`);
  pawn.teleport(new THREE.Vector3(0, 0, -100)); // dentro da parede
  input.move.y = 0;
  pawn.tick(1 / 64, input, { tick: 99 });
  const s = pawn.state;
  assert.ok(world.canOccupy(s.origin.x, s.origin.y, s.origin.z, HULL.radius, s.height), 'continua dentro da parede');
  assert.equal(s.stuck, false);
});

test('pawn: teleporte zera velocidade e interpolação e acha o chão', () => {
  const pawn = pawnOn(worldOf((b) => floor(b)));
  pawn.state.velocity.set(100, 0, 0);
  pawn.teleport(new THREE.Vector3(50, 1, 50), 1, 0);
  assert.equal(pawn.state.velocity.length(), 0);
  assert.ok(pawn.state.onGround && Math.abs(pawn.state.origin.y - SKIN) < 2e-3);
  assert.ok(pawn.prevOrigin.equals(pawn.state.origin));
  assert.equal(pawn.yaw, 1);
  assert.equal(pawn.pos, pawn.state.origin);
});

test('pawn (3.2): troca pelo comando do tick muda o teto já nesse tick, zera a precisão e avisa', () => {
  const bus = new EventBus();
  const got = [];
  bus.on(EV.PLAYER_WEAPON, (e) => got.push(e));
  const pawn = pawnOn(worldOf((b) => floor(b)), [0, 0, 0], { loadout: loadoutWith('ak47', 'glock'), events: bus });
  assert.equal(pawn.hands.item, 'ak47', 'nasce com o melhor item');
  assert.equal(pawn.held.speed, 215);
  const input = testInput();
  input.move.y = 1;
  ticks(pawn, input, 80);
  assert.ok(Math.abs(Math.hypot(pawn.state.velocity.x, pawn.state.velocity.z) - 215) < 1e-9);
  assert.ok(pawn.accuracy.penalty > 0);
  ticks(pawn, input, 1, { hit: 'slot2', start: 80 });
  assert.equal(pawn.hands.item, 'glock');
  assert.equal(pawn.held.speed, 240);
  assert.equal(pawn.state.maxSpeed, 240, 'o tick da troca já usa a velocidade da pistola');
  assert.deepEqual(got, [{ item: 'glock', previous: 'ak47', slot: 'secondary' }]);
  ticks(pawn, input, 1, { hit: 'lastWeapon', start: 81 });
  assert.equal(pawn.hands.item, 'ak47', 'Q volta');
  assert.equal(got.length, 2);
});

test('pawn (3.2): arma melhor recebida vira troca automática no próximo tick', () => {
  const loadout = new Loadout();
  const pawn = pawnOn(worldOf((b) => floor(b)), [0, 0, 0], { loadout });
  const input = testInput();
  assert.equal(pawn.hands.item, 'knife');
  const res = loadout.give('deagle');
  pawn.onLoadout({ kind: 'weapon', id: 'deagle', slot: res.slot });
  ticks(pawn, input, 1);
  assert.equal(pawn.hands.item, 'deagle');
  loadout.giveUtility('he');
  pawn.onLoadout({ kind: 'utility', id: 'he', slot: 'grenade' });
  ticks(pawn, input, 1, { start: 1 });
  assert.equal(pawn.hands.item, 'deagle', 'granada não troca sozinha');
});

test('pawn (3.2): luneta — ATTACK2 sobe o nível, FOV interpolado entre ticks, sensibilidade e velocidade', () => {
  const bus = new EventBus();
  const zooms = [];
  bus.on(EV.PLAYER_ZOOM, (e) => zooms.push(e));
  const pawn = pawnOn(worldOf((b) => floor(b)), [0, 0, 0], { loadout: loadoutWith('awp'), events: bus });
  const input = testInput();
  const cam = createFpsCamera({ hfov: 90, aspect: 16 / 9 });
  input.down.add('aim');
  ticks(pawn, input, 1);
  input.down.delete('aim');
  assert.equal(pawn.hands.zoom, 1);
  assert.deepEqual(zooms, [{ level: 1, fov: 40 }]);
  assert.equal(pawn.held.speed, 100, 'velocidade com luneta');
  assert.equal(pawn.held.slowSniper, true);
  assert.ok(Math.abs(pawn.lookScale(1) - 40 / 90) < 1e-12);
  // 0,05 s de transição (3,2 ticks) em graus: o multiplicador anda entre os ticks e o quadro interpola.
  const target = Math.tan((20 * Math.PI) / 180);
  assert.ok(pawn.fov.now < 1 && pawn.fov.now > target, 'meio da transição');
  pawn.updateCamera(cam, 0.5);
  const mid = (pawn.fov.prev + pawn.fov.now) / 2;
  assert.ok(Math.abs(cam.userData.zoom - mid) < 1e-12, 'o quadro interpola o FOV');
  ticks(pawn, input, 4, { start: 1 });
  assert.ok(Math.abs(pawn.fov.now - target) < 1e-12, 'chegou ao FOV de 40°');
  pawn.updateCamera(cam, 1);
  assert.ok(Math.abs(cam.userData.zoom - target) < 1e-12);
  // No noclip o botão de mirar é o turbo do voo: o zoom não mexe.
  input.down.add('aim');
  ticks(pawn, input, 40, { start: 5, noclip: true });
  assert.equal(pawn.hands.zoom, 1);
  // Trocar de item tira o zoom e o FOV volta na hora.
  pawn.loadout.give('ak47', { ignoreTeam: true });
  input.down.delete('aim');
  ticks(pawn, input, 1, { start: 45 });
  assert.equal(pawn.hands.item, 'ak47');
  assert.equal(pawn.hands.zoom, 0);
  assert.equal(pawn.fov.now, 1);
  assert.equal(pawn.lookScale(1), 1);
  assert.deepEqual(zooms.at(-1), { level: 0, fov: null });
});

test('pawn (3.2): precisão e telemetria do tick', () => {
  const pawn = pawnOn(worldOf((b) => floor(b)), [0, 0, 0], { loadout: loadoutWith('ak47') });
  const input = testInput();
  input.move.y = 1;
  ticks(pawn, input, 80);
  assert.ok(Math.abs(pawn.inaccuracy.total - 0.18147) < 1e-6, `correndo a 215: ${pawn.inaccuracy.total}`);
  assert.ok(Math.abs(pawn.inaccuracy.move - 0.17506) < 1e-6);
  const t = pawn.telemetry;
  const j = t.slot(t.count - 1);
  assert.equal(t.count, 80);
  assert.ok(Math.abs(t.speed[j] - 215) < 1e-3);
  assert.equal(t.cap[j], 215);
  assert.equal(t.weaponSpeed[j], 215);
  assert.ok(Math.abs(t.threshold[j] - 73.1) < 1e-4);
  assert.ok(Math.abs(t.inaccuracy[j] - 0.18147) < 1e-6);
  assert.equal(t.flags[j], TFLAG.GROUND);
  assert.ok(Math.abs(t.wishZ[j] + 1) < 1e-6, 'desejo para a frente (−z)');
  assert.ok(Math.abs(t.velZ[j] + 215) < 1e-3, 'velocidade para a frente (−z)');
  input.move.y = 0;
  input.down.add('walk');
  input.down.add('crouch');
  ticks(pawn, input, 30, { start: 80 });
  assert.equal(t.flags[t.slot(t.count - 1)], TFLAG.GROUND | TFLAG.DUCK, 'agachado ignora o andar');
});

test('pawn (3.2): passos, pulo e pouso no barramento, com contagem', () => {
  const bus = new EventBus();
  const seen = { step: 0, jump: 0, land: 0, duck: 0 };
  bus.on(EV.PLAYER_STEP, (e) => {
    seen.step++;
    assert.equal(typeof e.audible, 'boolean');
  });
  bus.on(EV.PLAYER_JUMP, () => seen.jump++);
  bus.on(EV.PLAYER_LAND, (e) => {
    seen.land++;
    assert.ok(e.speed > 250 && e.audible && !e.heavy);
  });
  bus.on(EV.PLAYER_DUCK, () => seen.duck++);
  const pawn = pawnOn(worldOf((b) => floor(b)), [0, 0, 0], { events: bus });
  const input = testInput();
  input.move.y = 1;
  ticks(pawn, input, 100);
  assert.equal(seen.step, pawn.stats.steps);
  assert.ok(seen.step >= 4, `${seen.step} passos`);
  assert.equal(pawn.lastStep.audible, true);
  input.down.add('jump');
  ticks(pawn, input, 1, { start: 100 });
  input.down.delete('jump');
  ticks(pawn, input, 60, { start: 101 });
  assert.deepEqual([seen.jump, seen.land], [1, 1]);
  assert.equal(pawn.lastLanding.type, 'land');
  input.down.add('crouch');
  ticks(pawn, input, 20, { start: 161 });
  assert.equal(seen.duck, 1);
});
