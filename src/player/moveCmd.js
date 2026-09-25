// Comando de movimento de um tick (o "usercmd" do Source): o que o jogador quer fazer, sem estado. Sai da entrada
// local, da IA dos bots (Fase 7) ou da rede (Fase 9) e alimenta o playerMove e a troca de item na mão.

export const BTN = Object.freeze({
  JUMP: 1 << 0,
  DUCK: 1 << 1,
  WALK: 1 << 2,
  ATTACK: 1 << 3,
  ATTACK2: 1 << 4,
  RELOAD: 1 << 5,
  USE: 1 << 6,
  INSPECT: 1 << 7,
});

/** Troca de item pedida no tick (o `weaponselect` do Source): slots 1–5, próximo/anterior (roda) e último (Q). */
export const SELECT = Object.freeze({
  NONE: 0, SLOT1: 1, SLOT2: 2, SLOT3: 3, SLOT4: 4, SLOT5: 5, NEXT: 6, PREV: 7, LAST: 8,
});

/** Ação da entrada (src/data/actions.js) → bit do comando. */
const BUTTON_ACTIONS = Object.freeze([
  ['jump', BTN.JUMP],
  ['crouch', BTN.DUCK],
  ['walk', BTN.WALK],
  ['fire', BTN.ATTACK],
  ['aim', BTN.ATTACK2],
  ['reload', BTN.RELOAD],
  ['use', BTN.USE],
  ['inspect', BTN.INSPECT],
]);

/** Ação da entrada → troca de item; vale a primeira desta ordem apertada no tick. */
const SELECT_ACTIONS = Object.freeze([
  ['slot1', SELECT.SLOT1],
  ['slot2', SELECT.SLOT2],
  ['slot3', SELECT.SLOT3],
  ['slot4', SELECT.SLOT4],
  ['slot5', SELECT.SLOT5],
  ['nextWeapon', SELECT.NEXT],
  ['prevWeapon', SELECT.PREV],
  ['lastWeapon', SELECT.LAST],
]);

export function createMoveCmd() {
  return { tick: 0, forward: 0, side: 0, buttons: 0, yaw: 0, pitch: 0, select: SELECT.NONE };
}

/**
 * Preenche o comando com a entrada amostrada neste tick (InputManager.sampleTick já rodou): movimento analógico
 * (−1..1, já normalizado), bits dos botões, a troca de item e os ângulos da visão. Entrada sem `pressed` (bots e
 * testes que só dirigem o movimento) não troca de item.
 */
export function readMoveCmd(cmd, input, tick, yaw, pitch) {
  cmd.tick = tick;
  cmd.forward = input.move.y;
  cmd.side = input.move.x;
  let buttons = 0;
  for (let i = 0; i < BUTTON_ACTIONS.length; i++) {
    if (input.isDown(BUTTON_ACTIONS[i][0])) buttons |= BUTTON_ACTIONS[i][1];
  }
  cmd.buttons = buttons;
  let select = SELECT.NONE;
  if (input.pressed) {
    for (let i = 0; i < SELECT_ACTIONS.length; i++) {
      if (input.pressed(SELECT_ACTIONS[i][0])) {
        select = SELECT_ACTIONS[i][1];
        break;
      }
    }
  }
  cmd.select = select;
  cmd.yaw = yaw;
  cmd.pitch = pitch;
  return cmd;
}
