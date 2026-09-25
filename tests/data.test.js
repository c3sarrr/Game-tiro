// Conformidade dos dados de balanceamento com o PROMPT 0 (seções 0.7, 0.8 e 0.11) + regras de inventário/roster.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WEAPONS, resolveWeaponId, damageAtDistance, fireInterval } from '../src/data/weapons.js';
import { ECONOMY, UTILITIES, GRENADE_LIMITS, lossBonusFor, clampMoney, resolveUtilityId } from '../src/data/economy.js';
import { getBotLevel } from '../src/data/botLevels.js';
import { Loadout } from '../src/player/loadout.js';
import { Roster } from '../src/modes/roster.js';
import { EventBus } from '../src/core/events.js';
import { RNG } from '../src/core/rng.js';

// Tabela da seção 0.7: preço, dano, pen. colete, RPM, pente, reserva, recompensa.
const TABLE = {
  glock: [200, 30, 0.47, 400, 20, 120, 300], usps: [200, 35, 0.505, 352, 12, 24, 300], p250: [300, 38, 0.64, 400, 13, 26, 300],
  fiveseven: [500, 32, 0.91, 400, 20, 100, 300], deagle: [700, 53, 0.93, 267, 7, 35, 300],
  mac10: [1050, 29, 0.575, 800, 30, 100, 600], mp9: [1250, 29, 0.6, 857, 30, 120, 600], ump45: [1200, 35, 0.65, 666, 25, 100, 600],
  p90: [2350, 26, 0.69, 857, 50, 100, 300], nova: [1050, 26, 0.5, 68, 8, 32, 900], xm1014: [2000, 20, 0.8, 171, 7, 32, 600],
  galil: [1800, 30, 0.775, 666, 35, 90, 300], famas: [2050, 30, 0.7, 666, 25, 90, 300], ak47: [2700, 36, 0.775, 600, 30, 90, 300],
  m4a4: [3000, 33, 0.7, 666, 30, 90, 300], m4a1s: [2900, 38, 0.7, 600, 20, 80, 300], aug: [3300, 28, 0.9, 666, 30, 90, 300],
  sg553: [3000, 30, 1, 545, 30, 90, 300], ssg08: [1700, 88, 0.85, 48, 10, 90, 300], awp: [4750, 115, 0.975, 41, 5, 30, 100],
  scar20: [5000, 80, 0.825, 240, 20, 90, 300], g3sg1: [5000, 80, 0.825, 240, 20, 90, 300],
  negev: [1700, 35, 0.71, 800, 150, 300, 300], m249: [5200, 32, 0.8, 750, 100, 200, 300],
};

test('armas: cada linha da tabela 0.7 está em src/data/weapons.js', () => {
  for (const [id, [price, damage, pen, rpm, mag, reserve, reward]] of Object.entries(TABLE)) {
    const w = WEAPONS[id];
    assert.ok(w, `falta ${id}`);
    assert.deepEqual([w.price, w.damage, w.armorPen, w.rpm, w.mag, w.reserve, w.killReward], [price, damage, pen, rpm, mag, reserve, reward], id);
  }
  assert.equal(WEAPONS.nova.pellets, 9);
  assert.equal(WEAPONS.xm1014.pellets, 6);
  assert.deepEqual([WEAPONS.knife.damage, WEAPONS.knife.damageHeavy, WEAPONS.knife.armorPen, WEAPONS.knife.killReward], [40, 65, 0.85, 1500]);
  assert.ok(WEAPONS.famas.modes.includes('burst'));
  assert.equal(WEAPONS.usps.silencer, 'removable');
  assert.equal(WEAPONS.m4a1s.silencer, 'removable');
  for (const id of ['awp', 'ssg08', 'aug', 'sg553']) assert.ok(WEAPONS[id].scope, `${id} tem luneta`);
});

test('armas: velocidades da seção 0.6 e utilidades', () => {
  assert.equal(WEAPONS.knife.moveSpeed, 250);
  assert.equal(WEAPONS.awp.moveSpeed, 200);
  assert.equal(WEAPONS.awp.scopedSpeed, 100);
  for (const id of ['glock', 'usps', 'p250', 'fiveseven']) assert.equal(WEAPONS[id].moveSpeed, 240);
  for (const id of ['ak47', 'm4a4', 'm4a1s', 'galil', 'famas']) assert.ok(WEAPONS[id].moveSpeed >= 215 && WEAPONS[id].moveSpeed <= 225);
  for (const id of ['negev', 'm249']) assert.equal(WEAPONS[id].moveSpeed, 195);
  assert.equal(resolveWeaponId('AK'), 'ak47');
  assert.equal(resolveWeaponId('scout'), 'ssg08');
  assert.equal(resolveWeaponId('Desert Eagle'), 'deagle');
  assert.equal(resolveWeaponId('bazuca'), null);
  // ids com maiúsculas (goldenKnife) em qualquer caixa, apelido e nome de exibição.
  assert.equal(resolveWeaponId('goldenKnife'), 'goldenKnife');
  assert.equal(resolveWeaponId('GOLDENKNIFE'), 'goldenKnife');
  assert.equal(resolveWeaponId('Faca de Ouro'), 'goldenKnife');
  assert.equal(resolveUtilityId('kevlarhelmet'), 'kevlarHelmet');
  assert.equal(resolveUtilityId('KevlarHelmet'), 'kevlarHelmet');
  assert.equal(resolveUtilityId('Colete + Capacete'), 'kevlarHelmet');
  assert.equal(resolveUtilityId('HE'), 'he');
  assert.equal(resolveUtilityId('fumaça'), 'smoke');
  assert.equal(resolveUtilityId('defuse_kit'), 'defuseKit');
  assert.equal(resolveUtilityId('bazuca'), null);
  assert.equal(damageAtDistance(WEAPONS.ak47, 0), 36);
  assert.ok(Math.abs(damageAtDistance(WEAPONS.ak47, 500) - 36 * 0.98) < 1e-9);
  assert.ok(Math.abs(fireInterval(WEAPONS.ak47) - 0.1) < 1e-9);
});

test('economia: valores da seção 0.7', () => {
  assert.equal(ECONOMY.startMoney, 800);
  assert.equal(ECONOMY.maxMoney, 16000);
  assert.equal(ECONOMY.winElimination, 3250);
  assert.equal(ECONOMY.winBomb, 3500);
  assert.deepEqual([1, 2, 3, 4, 5, 6, 9].map(lossBonusFor), [1400, 1900, 2400, 2900, 3400, 3400, 3400]);
  assert.equal(ECONOMY.plantReward, 300);
  assert.equal(ECONOMY.plantTeamBonusOnLoss, 800);
  assert.equal(ECONOMY.buyTimeSeconds, 20);
  assert.equal(clampMoney(17000), 16000);
  assert.equal(clampMoney(-5), 0);
  const prices = Object.fromEntries(Object.values(UTILITIES).map((u) => [u.id, u.price]));
  assert.deepEqual(prices, { kevlar: 650, kevlarHelmet: 1000, defuseKit: 400, he: 300, flash: 200, smoke: 300, molotov: 400, incendiary: 600, decoy: 50 });
  assert.equal(UTILITIES.defuseKit.team, 'ct');
  assert.equal(UTILITIES.molotov.team, 'tr');
  assert.equal(UTILITIES.incendiary.team, 'ct');
  assert.equal(GRENADE_LIMITS.total, 4);
  assert.equal(GRENADE_LIMITS.perType.flash, 2);
});

test('níveis de bot: âncoras da tabela 0.11 e escala monotônica 1→10', () => {
  const anchors = { 1: 900, 3: 600, 5: 400, 7: 280, 9: 190, 10: 150 };
  for (const [lv, ms] of Object.entries(anchors)) assert.equal(getBotLevel(Number(lv)).reactionMs, ms);
  assert.equal(getBotLevel(1).name, 'Massinha Mole');
  assert.equal(getBotLevel(10).name, 'Lenda da Massinha');
  assert.equal(getBotLevel(4).reactionMs, 500);
  for (let lv = 2; lv <= 10; lv++) {
    const a = getBotLevel(lv - 1);
    const b = getBotLevel(lv);
    assert.ok(b.reactionMs < a.reactionMs && b.aimErrorDeg < a.aimErrorDeg, `nível ${lv} melhora reação e mira`);
    assert.ok(b.sprayControl >= a.sprayControl && b.utilityUse >= a.utilityUse);
  }
  assert.equal(getBotLevel(0).level, 1);
  assert.equal(getBotLevel(99).level, 10);
  assert.ok(getBotLevel(10).tactics.includes('leSom'));
  assert.ok(!getBotLevel(1).tactics.includes('flash'));
});

test('loadout: slots, troca devolvendo a arma, time e limites de granada', () => {
  const l = new Loadout({ team: 'tr' });
  assert.equal(l.give('ak47').ok, true);
  const swap = l.give('galil');
  assert.equal(swap.dropped, 'ak47');
  assert.equal(l.primary, 'galil');
  assert.equal(l.give('m4a4').ok, false, 'M4A4 é do CT');
  assert.equal(l.give('m4a4', { ignoreTeam: true }).ok, true);
  assert.equal(l.giveUtility('defuseKit').ok, false, 'kit é do CT');
  assert.equal(l.giveUtility('incendiary').ok, false);
  assert.equal(l.giveUtility('molotov').ok, true);
  assert.equal(l.giveUtility('flash').ok, true);
  assert.equal(l.giveUtility('flash').ok, true);
  assert.equal(l.giveUtility('flash').ok, false, 'máx. 2 flashes');
  assert.equal(l.giveUtility('he').ok, true);
  assert.equal(l.giveUtility('smoke').ok, false, 'máx. 4 granadas');
  assert.equal(l.giveUtility('kevlarHelmet').ok, true);
  assert.deepEqual([l.armor, l.helmet], [100, true]);
  assert.equal(l.drop('primary'), 'm4a4');
  assert.equal(l.drop('melee'), null);
  const copy = Loadout.fromJSON(l.toJSON());
  assert.deepEqual(copy.toJSON(), l.toJSON());
  l.resetForRound();
  assert.equal(l.secondary, 'glock');
});

test('roster: máximo de 10, nomes únicos, níveis e remoção', () => {
  const r = new Roster({ events: new EventBus(), rng: new RNG('roster') });
  r.addHuman({ name: 'Você', local: true });
  const bots = r.addBots(20, { level: 3 });
  assert.equal(bots.length, 9);
  assert.equal(r.size, 10);
  assert.equal(new Set(r.participants.map((p) => p.name)).size, 10);
  assert.throws(() => r.addHuman({ name: 'extra' }), /cheia/);
  const target = bots[0].name;
  assert.deepEqual(r.setBotLevel(8, target), { level: 8, affected: 1 });
  assert.equal(r.setBotLevel(8, 'ninguem').affected, 0);
  assert.equal(r.levelOf(bots[0]), 8);
  assert.equal(r.removeBots(target), 1);
  assert.equal(r.removeBots('all'), 8);
  assert.equal(r.size, 1);
});
