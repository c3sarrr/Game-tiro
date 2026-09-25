// Testes do ponto de volta do respawn (subfase 3.4): o último teleporte do console neste mapa vale até o mundo matar o
// jogador (queda fatal, cair do set; ou cair do set com god) antes de ele ficar de pé, vivo, no chão desde que chegou
// nele — teleporte para o vazio ou para o alto —; aí o ponto sai e a volta é no spawn, em vez de repetir a mesma morte a
// cada 2 s. Morte pelo console (kill, hurtme) não julga o ponto. Com o PlayerPawn de verdade: o teleporte para 1310 u
// acima do chão morre no pouso e perde o ponto; de pé no ponto antes de morrer, ele fica.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { EV, EventBus } from '../src/core/events.js';
import { ReturnPoint } from '../src/modes/returnPoint.js';
import { Loadout } from '../src/player/loadout.js';
import { createSvVars } from '../src/player/movementVars.js';
import { PlayerPawn } from '../src/player/playerPawn.js';
import { floor, worldOf } from './worldTestUtils.js';
import { DT } from './playerTestUtils.js';

const SPAWN = { position: new THREE.Vector3(0, 0, 0), yaw: 0, pitch: 0 };

test('ponto de volta: sem teleporte é o spawn; o teleporte vira o ponto (cópia da posição); clear volta ao spawn', () => {
  const rp = new ReturnPoint();
  assert.equal(rp.pick(SPAWN), SPAWN);
  const at = new THREE.Vector3(10, 20, 30);
  rp.set(at, 1, 0.5);
  at.x = 99;
  const p = rp.pick(SPAWN);
  assert.deepEqual([p.position.x, p.position.y, p.position.z, p.yaw, p.pitch], [10, 20, 30, 1, 0.5]);
  rp.clear();
  assert.equal(rp.pick(SPAWN), SPAWN);
  rp.failed('fora');
  assert.equal(rp.pick(SPAWN), SPAWN, 'sem ponto, falhar não muda nada');
});

test('ponto de volta: fica se o jogador pisou vivo no chão; sai se o mundo o matou antes (no ar, no próprio pouso)', () => {
  const rp = new ReturnPoint();
  rp.set(new THREE.Vector3(0, 900, 0), 0, 0);
  rp.update(true, false); // caindo
  rp.failed('fora');
  assert.equal(rp.pick(SPAWN), SPAWN, 'caiu do set sem pisar: o ponto sai');
  rp.set(new THREE.Vector3(0, 600, 0), 0, 0);
  rp.update(true, true);
  rp.failed('queda');
  assert.notEqual(rp.pick(SPAWN), SPAWN, 'ficou de pé: o ponto fica');
  rp.placed(); // a volta coloca o jogador de novo no ponto
  rp.update(false, true); // morto no chão não conta
  rp.failed('queda');
  assert.equal(rp.pick(SPAWN), SPAWN, 'depois de cada colocação precisa pisar vivo de novo');
  rp.set(new THREE.Vector3(0, 300, 0), 0, 0);
  rp.update(true, true);
  rp.set(new THREE.Vector3(0, -5000, 0), 0, 0); // teleporte novo: o chão do ponto anterior não vale para este
  rp.failed('fora');
  assert.equal(rp.pick(SPAWN), SPAWN);
});

test('ponto de volta: morte pelo console (kill, hurtme) não julga o ponto, nem antes de pisar no chão', () => {
  const rp = new ReturnPoint();
  rp.set(new THREE.Vector3(100, 0, 100), 0, 0);
  rp.failed('kill'); // setpos e kill no mesmo instante, sem tick entre eles
  rp.failed('mundo'); // hurtme
  const back = rp.pick(SPAWN);
  assert.notEqual(back, SPAWN, 'o ponto fica');
  assert.deepEqual([back.position.x, back.position.z], [100, 100]);
  rp.failed('queda');
  assert.equal(rp.pick(SPAWN), SPAWN, 'a queda sem ter pisado tira');
});

test('com o PlayerPawn: o teleporte para 1310 u acima do chão morre no pouso e o ponto sai; de pé no ponto, ele fica', () => {
  const world = worldOf((b) => floor(b));
  const bus = new EventBus();
  const rp = new ReturnPoint();
  bus.on(EV.PLAYER_DEATH, ({ cause }) => rp.failed(cause));
  const pawn = new PlayerPawn({
    world, sv: createSvVars(), loadout: new Loadout(), events: bus, position: new THREE.Vector3(0, 0, 0),
  });
  const input = { move: { x: 0, y: 0 }, isDown: () => false };
  // Como no MatchState: o tick do jogador e, logo depois, o chão visto vivo.
  const ticks = (n) => {
    for (let i = 0; i < n; i++) {
      pawn.tick(DT, input, { tick: i });
      rp.update(pawn.vitals.alive, pawn.state.onGround);
    }
  };
  const high = new THREE.Vector3(0, 1310, 0);
  rp.set(high, 0, 0);
  pawn.teleport(high);
  ticks(200);
  assert.equal(pawn.vitals.alive, false, 'a queda de 1310 mata no pouso');
  assert.equal(pawn.vitals.cause, 'queda');
  assert.equal(rp.pick(SPAWN), SPAWN, 'o ponto que não se sustenta saiu: a volta é no spawn');
  pawn.respawn(SPAWN.position);
  rp.placed();
  const spot = new THREE.Vector3(200, 0, 0);
  rp.set(spot, 0, 0);
  pawn.teleport(spot);
  ticks(10);
  assert.ok(pawn.state.onGround);
  pawn.kill('kill');
  const back = rp.pick(SPAWN);
  assert.notEqual(back, SPAWN, 'de pé no ponto antes de morrer: o ponto fica');
  assert.ok(back.position.distanceTo(spot) < 1e-9);
});
