// Testes da camada de entrada (partes puras): bindings, conflitos, rótulos, controle; na Fase 3.2, o trinco
// segurar/alternar do andar por dispositivo, os modos na config e a migração do layout de toque.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseBinding, assignBinding, clearBinding, findConflicts, buildReverseMap } from '../src/input/bindings.js';
import { bindingLabel, keyLabel, padStyle } from '../src/input/labels.js';
import { detectPadType, radialDeadzone, responseCurve } from '../src/input/gamepad.js';
import { defaultBindings } from '../src/data/bindings.js';
import { CONFIG_SCHEMA, validateBindings, validateTouchLayout } from '../src/data/configSchema.js';
import { ACTION_BY_ID, ACTION_IDS, TOGGLE_MODE, TOGGLE_MODES } from '../src/data/actions.js';
import {
  DEFAULT_TOUCH_BUTTONS, TOUCH_BUTTONS_SINCE, TOUCH_LAYOUT_VERSION, defaultTouchLayout,
} from '../src/data/touchLayout.js';
import {
  TOGGLE_DEVICES, createToggle, createToggleSet, keepToggleDevice, resetToggleSet, stepToggle, stepToggleSet,
} from '../src/input/actionToggles.js';

test('parseBinding: todos os formatos', () => {
  assert.deepEqual(parseBinding('key:KeyW'), { device: 'kbm', kind: 'key', code: 'KeyW' });
  assert.deepEqual(parseBinding('mouse:2'), { device: 'kbm', kind: 'mouse', button: 2 });
  assert.deepEqual(parseBinding('wheel:down'), { device: 'kbm', kind: 'wheel', dir: 'down' });
  assert.deepEqual(parseBinding('pad:button:7'), { device: 'pad', kind: 'button', index: 7 });
  assert.deepEqual(parseBinding('pad:axis:1-'), { device: 'pad', kind: 'axis', index: 1, sign: -1 });
  assert.equal(parseBinding('key:'), null);
  assert.equal(parseBinding('pad:axis:1'), null);
});

test('binds padrão: toda ação existe e nenhum botão aciona duas ações', () => {
  const b = defaultBindings();
  assert.deepEqual(Object.keys(b).sort(), [...ACTION_IDS].sort());
  assert.deepEqual(findConflicts(b), []);
  // Estilo CS pedido na seção 0.14
  assert.deepEqual(b.buyMenu.kbm, ['key:KeyB']);
  assert.deepEqual(b.drop.kbm, ['key:KeyG']);
  assert.deepEqual(b.inspect.kbm, ['key:KeyF']);
  assert.deepEqual(b.use.kbm, ['key:KeyE']);
  assert.deepEqual(b.lastWeapon.kbm, ['key:KeyQ']);
  assert.deepEqual(b.scoreboard.kbm, ['key:Tab']);
  assert.deepEqual(b.chatAll.kbm, ['key:KeyY']);
  assert.deepEqual(b.chatTeam.kbm, ['key:KeyU']);
  for (let i = 1; i <= 5; i++) assert.deepEqual(b[`slot${i}`].kbm, [`key:Digit${i}`]);
});

test('assignBinding: substitui a posição, resolve conflito e informa quem perdeu', () => {
  const b = defaultBindings();
  const r1 = assignBinding(b, 'moveForward', 'key:KeyI', 0);
  assert.deepEqual(r1.bindings.moveForward.kbm, ['key:KeyI']);
  assert.deepEqual(r1.displaced, []);
  assert.deepEqual(b.moveForward.kbm, ['key:KeyW'], 'não muta o original');
  const r2 = assignBinding(r1.bindings, 'moveForward', 'key:Space', 1);
  assert.deepEqual(r2.bindings.moveForward.kbm, ['key:KeyI', 'key:Space']);
  assert.deepEqual(r2.bindings.jump.kbm, []);
  assert.deepEqual(r2.displaced, ['jump']);
  const r3 = assignBinding(b, 'jump', 'wheel:down', 0, 'insert');
  assert.deepEqual(r3.bindings.jump.kbm, ['wheel:down', 'key:Space']);
  assert.deepEqual(r3.displaced, ['nextWeapon']);
  assert.deepEqual(findConflicts(r3.bindings), []);
  const cleared = clearBinding(r3.bindings, 'jump', 'kbm', 0);
  assert.deepEqual(cleared.jump.kbm, ['key:Space']);
  assert.throws(() => assignBinding(b, 'naoexiste', 'key:KeyW'));
  const rev = buildReverseMap(b);
  assert.deepEqual(rev.get('key:KeyW'), ['moveForward']);
});

test('validateBindings: limpa lixo e preenche ações faltantes com o padrão', () => {
  const v = validateBindings({ jump: { kbm: ['key:KeyJ', 'lixo', 'key:KeyJ'], pad: 'x' }, inexistente: { kbm: [] } });
  assert.deepEqual(v.jump.kbm, ['key:KeyJ']);
  assert.deepEqual(v.jump.pad, defaultBindings().jump.pad);
  assert.deepEqual(v.fire, defaultBindings().fire);
  assert.equal('inexistente' in v, false);
});

test('rótulos: teclas, mouse, roda e controles por fabricante', () => {
  assert.equal(bindingLabel('key:KeyW'), 'W');
  assert.equal(bindingLabel('key:Space'), 'Espaço');
  assert.equal(bindingLabel('mouse:0'), 'Botão esquerdo');
  assert.equal(bindingLabel('wheel:up'), 'Roda ↑');
  assert.equal(bindingLabel('pad:button:0', { padType: 'playstation' }), '✕');
  assert.equal(bindingLabel('pad:button:0', { padType: 'xbox' }), 'A');
  assert.equal(bindingLabel('pad:button:7', { padType: 'playstation' }), 'R2');
  assert.equal(bindingLabel('pad:button:3', { padType: 'generico' }), 'Botão 3');
  assert.equal(bindingLabel('pad:axis:1-'), 'LS ↑');
  assert.equal(bindingLabel('pad:axis:2+', { padType: 'playstation' }), 'R →');
  assert.equal(bindingLabel('pad:axis:0-', { padType: 'generico' }), 'Anal. E ←');
  // Layout ABNT2: a tecla da posição de ";" mostra "Ç"
  const abnt2 = new Map([['Semicolon', 'ç'], ['KeyW', 'w']]);
  assert.equal(keyLabel('Semicolon', abnt2), 'Ç');
  assert.equal(keyLabel('KeyW', abnt2), 'W');
  assert.equal(padStyle('auto', 'playstation'), 'playstation');
  assert.equal(padStyle('xbox', 'playstation'), 'xbox');
});

test('controle: tipo pelo id, zona morta radial e curvas de resposta', () => {
  assert.equal(detectPadType('DualSense Wireless Controller (STANDARD GAMEPAD Vendor: 054c Product: 0ce6)'), 'playstation');
  assert.equal(detectPadType('054c-0ce6-DualSense Wireless Controller'), 'playstation');
  assert.equal(detectPadType('Xbox 360 Controller (XInput STANDARD GAMEPAD)'), 'xbox');
  assert.equal(detectPadType('057e-2009-Pro Controller'), 'switch');
  assert.equal(detectPadType('USB Joystick'), 'generico');
  assert.deepEqual(radialDeadzone(0.05, 0.05, 0.12), { x: 0, y: 0, mag: 0 });
  const full = radialDeadzone(1, 0, 0.12);
  assert.ok(Math.abs(full.mag - 1) < 1e-9 && Math.abs(full.x - 1) < 1e-9);
  const justOut = radialDeadzone(0.13, 0, 0.12);
  assert.ok(justOut.mag > 0 && justOut.mag < 0.02, 'sem degrau na borda da zona morta');
  for (const curve of ['linear', 'exponencial', 'dinamica']) {
    let prev = -1;
    for (let m = 0; m <= 1.0001; m += 0.05) {
      const v = responseCurve(Math.min(1, m), curve, 2.2);
      assert.ok(v >= prev - 1e-9 && v >= 0 && v <= 1.000001, `${curve} monotônica em [0,1]`);
      prev = v;
    }
    assert.ok(Math.abs(responseCurve(1, curve, 2.2) - 1) < 1e-9);
  }
});

test('trinco do andar: segurar vale com o botão; alternar troca a cada aperto (o latch, não o botão parado)', () => {
  const hold = createToggle();
  assert.equal(stepToggle(hold, true, true, TOGGLE_MODE.HOLD), true);
  assert.equal(stepToggle(hold, true, false, TOGGLE_MODE.HOLD), true);
  assert.equal(stepToggle(hold, false, false, TOGGLE_MODE.HOLD), false);
  const t = createToggle();
  const seq = [[true, true], [true, false], [false, false], [true, true], [false, false], [true, false]];
  assert.deepEqual(seq.map(([down, pressed]) => stepToggle(t, down, pressed, TOGGLE_MODE.TOGGLE)),
    [true, true, true, false, false, false], 'segurar parado não troca; o 2º aperto desliga');
  assert.equal(stepToggle(t, true, true, TOGGLE_MODE.TOGGLE), true, 'toque mais curto que um tick também liga');
});

test('trinco por dispositivo: cada um no seu modo, a ação vale se algum ligar; trocar de dispositivo e zerar', () => {
  const set = createToggleSet();
  const modes = { kbm: TOGGLE_MODE.HOLD, gamepad: TOGGLE_MODE.TOGGLE, touch: TOGGLE_MODE.TOGGLE };
  const input = (kbm = [0, false], gamepad = [0, false], touch = [0, false]) => {
    const one = ([value, pressed]) => ({ value, pressed });
    return { kbm: one(kbm), gamepad: one(gamepad), touch: one(touch) };
  };
  assert.equal(stepToggleSet(set, input(undefined, [1, true]), modes), true, 'L3 liga');
  assert.equal(stepToggleSet(set, input(), modes), true, 'e fica ligado solto');
  assert.equal(stepToggleSet(set, input([1, true]), modes), true, 'Shift segurado também vale');
  assert.equal(stepToggleSet(set, input([1, false], [1, true]), modes), true, 'L3 desliga, mas o Shift segue apertado');
  assert.equal(stepToggleSet(set, input(), modes), false);
  stepToggleSet(set, input(undefined, undefined, [1, true]), modes);
  assert.equal(set.touch.on, true);
  keepToggleDevice(set, 'kbm');
  assert.equal(set.touch.on, false, 'trocou para o teclado: o alternado do toque desliga');
  stepToggleSet(set, input(undefined, [1, true]), modes);
  keepToggleDevice(set, 'gamepad');
  assert.equal(set.gamepad.on, true, 'o do dispositivo novo fica');
  resetToggleSet(set);
  assert.ok(TOGGLE_DEVICES.every((d) => !set[d].on));
});

test('config: modo do andar por dispositivo (teclado segura; controle e toque alternam)', () => {
  const walk = ACTION_BY_ID.walk.toggle;
  assert.deepEqual(Object.keys(walk).sort(), [...TOGGLE_DEVICES].sort());
  const expected = { kbm: TOGGLE_MODE.HOLD, gamepad: TOGGLE_MODE.TOGGLE, touch: TOGGLE_MODE.TOGGLE };
  for (const [device, key] of Object.entries(walk)) {
    const spec = CONFIG_SCHEMA[key];
    assert.ok(spec, key);
    assert.equal(spec.type, 'enum');
    assert.deepEqual([...spec.options], [...TOGGLE_MODES]);
    assert.equal(spec.default, expected[device], key);
  }
  assert.deepEqual(ACTION_IDS.filter((id) => ACTION_BY_ID[id].toggle), ['walk'], 'só o andar alterna por enquanto');
});

test('layout de toque v2: botão Andar; layouts v1 ganham só o que falta; as áreas de toque não se sobrepõem', () => {
  assert.equal(TOUCH_LAYOUT_VERSION, 2);
  assert.equal(defaultTouchLayout().version, 2);
  const walk = DEFAULT_TOUCH_BUTTONS.find((b) => b.id === 'walk');
  assert.equal(walk.action, 'walk');
  for (const ids of Object.values(TOUCH_BUTTONS_SINCE)) {
    for (const id of ids) assert.ok(DEFAULT_TOUCH_BUTTONS.some((b) => b.id === id), id);
  }
  // Layout salvo na v1, com o tiro movido pelo jogador: ganha o Andar e o tiro continua onde ele pôs.
  const v1 = { version: 1, buttons: [{ id: 'fire', action: 'fire', x: 0.5, y: 0.5, r: 0.1, opacity: 1 }] };
  const migrated = validateTouchLayout(v1);
  assert.equal(migrated.version, 2);
  assert.deepEqual(migrated.buttons.map((b) => b.id), ['fire', 'walk']);
  assert.deepEqual(migrated.buttons[0], v1.buttons[0]);
  assert.deepEqual(migrated.buttons[1], { ...walk });
  const noVersion = validateTouchLayout({ buttons: [] });
  assert.deepEqual(noVersion.buttons.map((b) => b.id), ['walk'], 'sem versão conta como v1');
  const already = validateTouchLayout({ version: 1, buttons: [{ ...walk, x: 0.2 }] });
  assert.equal(already.buttons.length, 1, 'já tinha o botão: não duplica');
  assert.equal(already.buttons[0].x, 0.2);
  assert.deepEqual(validateTouchLayout({ version: 2, buttons: [] }).buttons, [], 'v2 sem o botão: o jogador tirou');
  // Área de toque = raio × 1,15 (tolerância do TouchInput.hitButton), em fração do menor lado da tela.
  for (const [w, h] of [[1920, 1080], [2400, 1080], [1024, 768]]) {
    const min = Math.min(w, h);
    const B = DEFAULT_TOUCH_BUTTONS;
    for (let i = 0; i < B.length; i++) {
      for (let j = i + 1; j < B.length; j++) {
        const d = Math.hypot((B[i].x - B[j].x) * w, (B[i].y - B[j].y) * h);
        assert.ok(d >= (B[i].r + B[j].r) * min * 1.15, `${B[i].id} × ${B[j].id} em ${w}×${h}`);
      }
    }
  }
});
