// Testes da camada de entrada (partes puras): bindings, conflitos, rótulos, controle.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseBinding, assignBinding, clearBinding, findConflicts, buildReverseMap } from '../src/input/bindings.js';
import { bindingLabel, keyLabel, padStyle } from '../src/input/labels.js';
import { detectPadType, radialDeadzone, responseCurve } from '../src/input/gamepad.js';
import { defaultBindings } from '../src/data/bindings.js';
import { validateBindings } from '../src/data/configSchema.js';
import { ACTION_IDS } from '../src/data/actions.js';

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
