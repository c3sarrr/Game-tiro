// Utilitários dos testes de movimento: jogador simulado sobre um mundo de colisão, sem navegador.
import * as THREE from 'three';
import { CharacterController } from '../src/physics/characterController.js';
import { createMoveState, playerMove } from '../src/player/movement.js';
import { createMoveCmd } from '../src/player/moveCmd.js';
import { createSvVars } from '../src/player/movementVars.js';
import { isSlowSniper, itemSpeed, weaponAlt } from '../src/player/hands.js';

export const DT = 1 / 64;

/** Item na mão do ambiente de movimento (velocidade no modo atual e sniper lenta), como o PlayerPawn monta. */
export function itemEnv(item = 'knife', zoom = 0) {
  const alt = weaponAlt(item, zoom);
  return { speed: itemSpeed(item, alt), slowSniper: isSlowSniper(item, zoom, alt) };
}

/** Jogador com o item na mão (faca), pés em [x, y, z], já classificado no chão (ou no ar). */
export function makePlayer(world, [x, y, z], { yaw = 0, sv = createSvVars(), item = 'knife', zoom = 0 } = {}) {
  const controller = new CharacterController(world, sv);
  const state = createMoveState({ position: new THREE.Vector3(x, y, z) });
  const env = { controller, sv, dt: DT, item: itemEnv(item, zoom), events: [] };
  const cmd = createMoveCmd();
  cmd.yaw = yaw;
  controller.categorizePosition(state);
  return { world, controller, state, env, cmd, sv };
}

/** Roda `ticks` ticks; `drive(cmd, i, p)` monta o comando antes de cada um. Devolve os eventos de todos os ticks. */
export function run(p, ticks, drive = null) {
  const events = [];
  for (let i = 0; i < ticks; i++) {
    if (drive) drive(p.cmd, i, p);
    p.cmd.tick += 1;
    playerMove(p.state, p.cmd, p.env);
    for (const e of p.env.events) events.push(e);
  }
  return events;
}

/** Comando parado (sem movimento nem botões). */
export function idle(cmd) {
  cmd.forward = 0;
  cmd.side = 0;
  cmd.buttons = 0;
}

/** Correndo para a frente, sem botões. */
export function forward(cmd) {
  cmd.forward = 1;
  cmd.side = 0;
  cmd.buttons = 0;
}

export const speed2d = (s) => Math.hypot(s.velocity.x, s.velocity.z);
