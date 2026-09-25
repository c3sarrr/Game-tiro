// Testes do item na mão (Fase 3.2): ordem dos itens, troca por slot, roda e Q, sincronização com o inventário, troca
// automática no give, luneta (níveis, 0,3 s, FOV, sensibilidade), modo alt, velocidade do item e sniper lenta.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SCOPE } from '../src/data/weapons.js';
import {
  applySelect, autoSwitchSelect, carriedItems, createHands, isSlowSniper, itemAt, itemName, itemSpeed, syncHands,
  updateZoom, weaponAlt, zoomFactor, zoomFov, zoomLevels, zoomLookScale, zoomTime,
} from '../src/player/hands.js';
import { Loadout } from '../src/player/loadout.js';
import { SELECT } from '../src/player/moveCmd.js';

const DT = 1 / 64;

/** Inventário cheio: AK, Glock, faca, flash + HE + flash e a bomba. */
function fullLoadout() {
  const l = new Loadout({ team: 'tr' });
  l.give('ak47');
  l.give('glock');
  l.giveUtility('flash');
  l.giveUtility('he');
  l.giveUtility('flash');
  l.giveBomb();
  return l;
}

/** Mão já sincronizada com o inventário (sacou o melhor item). */
function handsFor(loadout) {
  const h = createHands();
  syncHands(h, loadout);
  return h;
}

const where = (h) => (h.slot === 'grenade' ? `grenade:${h.grenade}` : h.slot);

test('ordem dos itens: primária → pistola → faca → granadas (tipos na ordem de entrada) → bomba', () => {
  const l = fullLoadout();
  assert.deepEqual(carriedItems(l).map((e) => (e.grenade ? `grenade:${e.grenade}` : e.slot)),
    ['primary', 'secondary', 'melee', 'grenade:flash', 'grenade:he', 'c4']);
  assert.equal(itemAt(l, 'primary'), 'ak47');
  assert.equal(itemAt(l, 'grenade', 'he'), 'he');
  assert.equal(itemAt(l, 'grenade', 'smoke'), null, 'granada que não tem');
  assert.equal(itemAt(l, 'c4'), 'c4');
  const h = handsFor(l);
  assert.equal(h.slot, 'primary', 'sacou o melhor item');
  assert.equal(h.item, 'ak47');
});

test('slots 1–5: vazio não troca, 4 cicla os tipos de granada, 5 pega a bomba', () => {
  const l = new Loadout({ team: 'tr' });
  l.giveUtility('flash');
  l.giveUtility('smoke');
  const h = handsFor(l);
  assert.equal(h.slot, 'melee', 'só faca e granadas: a faca vem antes');
  assert.equal(applySelect(h, l, SELECT.SLOT1), false, 'sem primária');
  assert.equal(applySelect(h, l, SELECT.SLOT2), false, 'sem pistola');
  assert.equal(applySelect(h, l, SELECT.SLOT5), false, 'sem bomba');
  assert.equal(applySelect(h, l, SELECT.SLOT3), false, 'já está na faca');
  assert.equal(applySelect(h, l, SELECT.SLOT4), true);
  assert.equal(where(h), 'grenade:flash');
  applySelect(h, l, SELECT.SLOT4);
  assert.equal(where(h), 'grenade:smoke');
  applySelect(h, l, SELECT.SLOT4);
  assert.equal(where(h), 'grenade:flash', 'volta ao primeiro tipo');
  l.giveBomb();
  assert.equal(applySelect(h, l, SELECT.SLOT5), true);
  assert.equal(h.slot, 'c4');
  syncHands(h, l);
  assert.equal(h.item, 'c4');
});

test('roda dá a volta nos itens; Q volta ao anterior enquanto ele existir', () => {
  const l = fullLoadout();
  const h = handsFor(l);
  const seq = [];
  for (let i = 0; i < 6; i++) {
    applySelect(h, l, SELECT.NEXT);
    seq.push(where(h));
  }
  assert.deepEqual(seq, ['secondary', 'melee', 'grenade:flash', 'grenade:he', 'c4', 'primary']);
  applySelect(h, l, SELECT.PREV);
  assert.equal(h.slot, 'c4', 'anterior a partir da primária dá a volta para a bomba');
  applySelect(h, l, SELECT.SLOT2);
  assert.equal(applySelect(h, l, SELECT.LAST), true);
  assert.equal(h.slot, 'c4');
  assert.equal(applySelect(h, l, SELECT.LAST), true);
  assert.equal(h.slot, 'secondary', 'Q alterna entre os dois últimos');
  l.secondary = null; // a pistola sumiu (largada)
  applySelect(h, l, SELECT.SLOT3);
  assert.equal(applySelect(h, l, SELECT.LAST), false, 'o anterior não existe mais');
  assert.equal(h.slot, 'melee');
  assert.equal(applySelect(h, l, SELECT.NONE), false, 'nenhum pedido');
});

test('sincronização: item que some leva ao melhor que sobrou; arma trocada no slot conta como sacar', () => {
  const l = fullLoadout();
  const h = handsFor(l);
  h.zoom = 1;
  assert.equal(syncHands(h, l), false, 'nada mudou');
  l.give('m4a4', { ignoreTeam: true }); // a M4 entra no lugar da AK
  assert.equal(syncHands(h, l), true);
  assert.equal(h.item, 'm4a4');
  assert.equal(h.zoom, 0, 'sacar tira o zoom');
  applySelect(h, l, SELECT.SLOT4);
  syncHands(h, l);
  assert.equal(h.item, 'flash');
  l.grenades = ['he']; // as flashes acabaram
  assert.equal(syncHands(h, l), true);
  assert.equal(h.slot, 'primary', 'item da mão sumiu: vai para o melhor (a primária)');
  l.primary = null;
  l.secondary = null;
  syncHands(h, l);
  assert.equal(h.item, 'knife');
});

test('troca automática no give: só arma de posto melhor que a da mão', () => {
  const h = createHands(); // faca na mão
  assert.equal(autoSwitchSelect(h, 'primary'), SELECT.SLOT1);
  assert.equal(autoSwitchSelect(h, 'secondary'), SELECT.SLOT2);
  assert.equal(autoSwitchSelect(h, 'melee'), SELECT.NONE, 'mesmo posto');
  assert.equal(autoSwitchSelect(h, 'grenade'), SELECT.NONE, 'granada nunca troca sozinha');
  assert.equal(autoSwitchSelect(h, 'c4'), SELECT.NONE, 'bomba nunca troca sozinha');
  h.slot = 'primary';
  assert.equal(autoSwitchSelect(h, 'secondary'), SELECT.NONE);
  assert.equal(autoSwitchSelect(h, 'primary'), SELECT.NONE);
  h.slot = 'grenade';
  assert.equal(autoSwitchSelect(h, 'melee'), SELECT.SLOT3);
});

test('luneta: níveis por arma; segurar cicla a cada 0,3 s; sem luneta e no noclip não mexe', () => {
  assert.deepEqual(['awp', 'ssg08', 'scar20', 'g3sg1', 'aug', 'sg553', 'ak47', 'knife'].map(zoomLevels),
    [2, 2, 2, 2, 1, 1, 0, 0]);
  const h = handsFor(Object.assign(new Loadout(), { primary: 'awp' }));
  const levels = [];
  for (let i = 0; i < 64; i++) {
    if (updateZoom(h, true, DT)) levels.push(`${i}:${h.zoom}`);
  }
  // 0,3 s = 19,2 ticks: o próximo clique vale no 20º tick.
  assert.deepEqual(levels, ['0:1', '20:2', '40:0', '60:1']);
  assert.equal(updateZoom(h, false, DT), false, 'soltou: nada');
  h.zoomCooldown = 0;
  assert.equal(updateZoom(h, true, DT, false), false, 'noclip não mexe no zoom');
  assert.equal(h.zoom, 1);
  h.zoomCooldown = 0.1;
  updateZoom(h, false, 0.05, false);
  assert.ok(Math.abs(h.zoomCooldown - 0.05) < 1e-12, 'o tempo desconta mesmo sem mexer');
  const knife = handsFor(new Loadout());
  assert.equal(updateZoom(knife, true, DT), false, 'faca não tem luneta');
  assert.equal(SCOPE.cycleCooldown, 0.3);
});

test('luneta: FOV, multiplicador da tangente, tempo de transição e sensibilidade', () => {
  assert.equal(zoomFov('awp', 0), null);
  assert.equal(zoomFov('awp', 1), 40);
  assert.equal(zoomFov('awp', 2), 10);
  assert.equal(zoomFov('ssg08', 2), 15);
  assert.equal(zoomFov('aug', 1), 45);
  assert.equal(zoomFactor('ak47', 0), 1);
  assert.ok(Math.abs(zoomFactor('awp', 1) - Math.tan((20 * Math.PI) / 180)) < 1e-12);
  assert.ok(Math.abs(zoomFactor('awp', 2) - Math.tan((5 * Math.PI) / 180)) < 1e-12);
  assert.ok(Math.abs(zoomFactor('sg553', 1) - Math.tan((22.5 * Math.PI) / 180)) < 1e-12);
  assert.equal(zoomTime('awp', 1), 0.05);
  assert.equal(zoomTime('aug', 1), 0.1, 'AUG entra em 0,1 s');
  assert.equal(zoomTime('aug', 0), 0.06, 'e sai em 0,06 s');
  assert.equal(zoomTime('ak47', 1), 0);
  assert.equal(zoomLookScale('awp', 0, 1), 1);
  assert.ok(Math.abs(zoomLookScale('awp', 1, 1) - 40 / 90) < 1e-12);
  assert.ok(Math.abs(zoomLookScale('awp', 2, 1.5) - (1.5 * 10) / 90) < 1e-12);
});

test('modo alt, velocidade do item e sniper lenta', () => {
  assert.equal(weaponAlt('awp', 0), false);
  assert.equal(weaponAlt('awp', 1), true);
  assert.equal(weaponAlt('usps', 0), true, 'silenciador colocado é o padrão');
  assert.equal(weaponAlt('m4a1s', 0, false), false, 'sem silenciador');
  assert.equal(weaponAlt('glock', 0), false, 'rajada liga na Fase 4');
  assert.equal(weaponAlt('famas', 0, true, true), true);
  assert.equal(weaponAlt('ak47', 0), false);
  assert.equal(weaponAlt('flash', 0), false);
  assert.equal(itemSpeed('knife', false), 250);
  assert.equal(itemSpeed('ak47', false), 215);
  assert.equal(itemSpeed('m4a4', false), 225);
  assert.equal(itemSpeed('awp', false), 200);
  assert.equal(itemSpeed('awp', true), 100);
  assert.equal(itemSpeed('aug', true), 150);
  assert.equal(itemSpeed('ssg08', true), 230);
  assert.equal(itemSpeed('negev', false), 195);
  assert.equal(itemSpeed('c4', false), 250);
  assert.equal(itemSpeed('he', false), 245);
  assert.equal(itemSpeed('molotov', false), 245);
  assert.equal(isSlowSniper('awp', 1, true), true);
  assert.equal(isSlowSniper('scar20', 2, true), true);
  assert.equal(isSlowSniper('g3sg1', 1, true), true);
  assert.equal(isSlowSniper('awp', 0, false), false, 'sem zoom não');
  assert.equal(isSlowSniper('ssg08', 1, true), false, 'Scout com zoom anda a 230');
  assert.equal(isSlowSniper('aug', 1, true), false, 'um nível só');
  assert.equal(itemName('ak47'), 'AK-47');
  assert.equal(itemName('c4'), 'Bomba');
  assert.equal(itemName(null), '—');
});
