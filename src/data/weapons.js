// Arsenal (seção 0.7) — valores base de balanceamento, ajustáveis aqui.
// Campos:
//   slot: 'primary' | 'secondary' | 'melee'        category: rótulo da loja
//   price, damage, armorPen (0..1), rpm, mag, reserve, killReward
//   pellets: bagos por disparo (shotguns)          moveSpeed: velocidade máxima com a arma (u/s, seção 0.6)
//   scopedSpeed: velocidade com luneta              team: 'tr' | 'ct' | null (ambos)
//   rangeModifier: fração do dano mantida a cada 500 u (queda por distância, modelo CS)
//   range: alcance máximo do hitscan (u)            penetration: poder de atravessar materiais (wallbang)
//   modes: modos de disparo ('auto' | 'semi' | 'burst')   burst: {count, rpm} quando houver rajada
//   scope: níveis de zoom (multiplicador de FOV)    silencer: 'removable' quando tem silenciador removível
//   helmetBypass: ignora capacete (AWP)             heavyArmorPen: penetração alta que atravessa capacete
// Recoil, spread e padrões de spray entram na Fase 4 (src/data/sprayPatterns.js e src/data/inaccuracy.js).

const W = (o) => Object.freeze(o);

export const WEAPONS = Object.freeze({
  knife: W({
    id: 'knife', name: 'Faca', slot: 'melee', category: 'Corpo a corpo', price: 0,
    damage: 40, damageHeavy: 65, armorPen: 0.85, rpm: 0, mag: 0, reserve: 0, killReward: 1500,
    moveSpeed: 250, team: null, rangeModifier: 1, range: 64, penetration: 0, modes: ['semi'],
  }),
  goldenKnife: W({
    id: 'goldenKnife', name: 'Faca de Ouro', slot: 'melee', category: 'Corpo a corpo', price: 0,
    damage: 40, damageHeavy: 65, armorPen: 0.85, rpm: 0, mag: 0, reserve: 0, killReward: 1500,
    moveSpeed: 250, team: null, rangeModifier: 1, range: 64, penetration: 0, modes: ['semi'], gunGameOnly: true,
  }),

  glock: W({
    id: 'glock', name: 'Glock-18', slot: 'secondary', category: 'Pistola', price: 200,
    damage: 30, armorPen: 0.47, rpm: 400, mag: 20, reserve: 120, killReward: 300,
    moveSpeed: 240, team: 'tr', rangeModifier: 0.85, range: 4096, penetration: 1, modes: ['semi', 'burst'],
    burst: { count: 3, rpm: 1200 },
  }),
  usps: W({
    id: 'usps', name: 'USP-S', slot: 'secondary', category: 'Pistola', price: 200,
    damage: 35, armorPen: 0.505, rpm: 352, mag: 12, reserve: 24, killReward: 300,
    moveSpeed: 240, team: 'ct', rangeModifier: 0.91, range: 4096, penetration: 1, modes: ['semi'], silencer: 'removable',
  }),
  p250: W({
    id: 'p250', name: 'P250', slot: 'secondary', category: 'Pistola', price: 300,
    damage: 38, armorPen: 0.64, rpm: 400, mag: 13, reserve: 26, killReward: 300,
    moveSpeed: 240, team: null, rangeModifier: 0.85, range: 4096, penetration: 1, modes: ['semi'],
  }),
  fiveseven: W({
    id: 'fiveseven', name: 'Five-SeveN', slot: 'secondary', category: 'Pistola', price: 500,
    damage: 32, armorPen: 0.91, rpm: 400, mag: 20, reserve: 100, killReward: 300,
    moveSpeed: 240, team: null, rangeModifier: 0.85, range: 4096, penetration: 1, modes: ['semi'],
  }),
  deagle: W({
    id: 'deagle', name: 'Desert Eagle', slot: 'secondary', category: 'Pistola', price: 700,
    damage: 53, armorPen: 0.93, rpm: 267, mag: 7, reserve: 35, killReward: 300,
    moveSpeed: 230, team: null, rangeModifier: 0.81, range: 4096, penetration: 2, modes: ['semi'],
  }),

  mac10: W({
    id: 'mac10', name: 'MAC-10', slot: 'primary', category: 'SMG', price: 1050,
    damage: 29, armorPen: 0.575, rpm: 800, mag: 30, reserve: 100, killReward: 600,
    moveSpeed: 240, team: 'tr', rangeModifier: 0.8, range: 4096, penetration: 1, modes: ['auto'],
  }),
  mp9: W({
    id: 'mp9', name: 'MP9', slot: 'primary', category: 'SMG', price: 1250,
    damage: 29, armorPen: 0.6, rpm: 857, mag: 30, reserve: 120, killReward: 600,
    moveSpeed: 240, team: 'ct', rangeModifier: 0.87, range: 4096, penetration: 1, modes: ['auto'],
  }),
  ump45: W({
    id: 'ump45', name: 'UMP-45', slot: 'primary', category: 'SMG', price: 1200,
    damage: 35, armorPen: 0.65, rpm: 666, mag: 25, reserve: 100, killReward: 600,
    moveSpeed: 230, team: null, rangeModifier: 0.85, range: 4096, penetration: 1, modes: ['auto'],
  }),
  p90: W({
    id: 'p90', name: 'P90', slot: 'primary', category: 'SMG', price: 2350,
    damage: 26, armorPen: 0.69, rpm: 857, mag: 50, reserve: 100, killReward: 300,
    moveSpeed: 230, team: null, rangeModifier: 0.86, range: 4096, penetration: 1, modes: ['auto'],
  }),

  nova: W({
    id: 'nova', name: 'Nova', slot: 'primary', category: 'Shotgun', price: 1050,
    damage: 26, pellets: 9, armorPen: 0.5, rpm: 68, mag: 8, reserve: 32, killReward: 900,
    moveSpeed: 220, team: null, rangeModifier: 0.7, range: 3000, penetration: 1, modes: ['semi'], shellReload: true,
  }),
  xm1014: W({
    id: 'xm1014', name: 'XM1014', slot: 'primary', category: 'Shotgun', price: 2000,
    damage: 20, pellets: 6, armorPen: 0.8, rpm: 171, mag: 7, reserve: 32, killReward: 600,
    moveSpeed: 215, team: null, rangeModifier: 0.7, range: 3000, penetration: 1, modes: ['semi'], shellReload: true,
  }),

  galil: W({
    id: 'galil', name: 'Galil AR', slot: 'primary', category: 'Rifle', price: 1800,
    damage: 30, armorPen: 0.775, rpm: 666, mag: 35, reserve: 90, killReward: 300,
    moveSpeed: 215, team: 'tr', rangeModifier: 0.98, range: 8192, penetration: 2, modes: ['auto'],
  }),
  famas: W({
    id: 'famas', name: 'FAMAS', slot: 'primary', category: 'Rifle', price: 2050,
    damage: 30, armorPen: 0.7, rpm: 666, mag: 25, reserve: 90, killReward: 300,
    moveSpeed: 220, team: 'ct', rangeModifier: 0.96, range: 8192, penetration: 2, modes: ['auto', 'burst'],
    burst: { count: 3, rpm: 1100 },
  }),
  ak47: W({
    id: 'ak47', name: 'AK-47', slot: 'primary', category: 'Rifle', price: 2700,
    damage: 36, armorPen: 0.775, rpm: 600, mag: 30, reserve: 90, killReward: 300,
    moveSpeed: 215, team: 'tr', rangeModifier: 0.98, range: 8192, penetration: 2, modes: ['auto'],
  }),
  m4a4: W({
    id: 'm4a4', name: 'M4A4', slot: 'primary', category: 'Rifle', price: 3000,
    damage: 33, armorPen: 0.7, rpm: 666, mag: 30, reserve: 90, killReward: 300,
    moveSpeed: 225, team: 'ct', rangeModifier: 0.97, range: 8192, penetration: 2, modes: ['auto'],
  }),
  m4a1s: W({
    id: 'm4a1s', name: 'M4A1-S', slot: 'primary', category: 'Rifle', price: 2900,
    damage: 38, armorPen: 0.7, rpm: 600, mag: 20, reserve: 80, killReward: 300,
    moveSpeed: 225, team: 'ct', rangeModifier: 0.99, range: 8192, penetration: 2, modes: ['auto'], silencer: 'removable',
  }),
  aug: W({
    id: 'aug', name: 'AUG', slot: 'primary', category: 'Rifle (mira)', price: 3300,
    damage: 28, armorPen: 0.9, rpm: 666, mag: 30, reserve: 90, killReward: 300,
    moveSpeed: 220, scopedSpeed: 150, team: 'ct', rangeModifier: 0.98, range: 8192, penetration: 2, modes: ['auto'],
    scope: [0.55],
  }),
  sg553: W({
    id: 'sg553', name: 'SG 553', slot: 'primary', category: 'Rifle (mira)', price: 3000,
    damage: 30, armorPen: 1, rpm: 545, mag: 30, reserve: 90, killReward: 300,
    moveSpeed: 210, scopedSpeed: 150, team: 'tr', rangeModifier: 0.98, range: 8192, penetration: 2, modes: ['auto'],
    scope: [0.55], heavyArmorPen: true,
  }),

  ssg08: W({
    id: 'ssg08', name: 'SSG 08 (Scout)', slot: 'primary', category: 'Sniper', price: 1700,
    damage: 88, armorPen: 0.85, rpm: 48, mag: 10, reserve: 90, killReward: 300,
    moveSpeed: 230, scopedSpeed: 230, team: null, rangeModifier: 0.98, range: 8192, penetration: 2.5, modes: ['semi'],
    scope: [0.4, 0.15],
  }),
  awp: W({
    id: 'awp', name: 'AWP', slot: 'primary', category: 'Sniper', price: 4750,
    damage: 115, armorPen: 0.975, rpm: 41, mag: 5, reserve: 30, killReward: 100,
    moveSpeed: 200, scopedSpeed: 100, team: null, rangeModifier: 0.99, range: 8192, penetration: 2.5, modes: ['semi'],
    scope: [0.4, 0.1], helmetBypass: true, heavyArmorPen: true,
  }),
  scar20: W({
    id: 'scar20', name: 'SCAR-20', slot: 'primary', category: 'Sniper auto', price: 5000,
    damage: 80, armorPen: 0.825, rpm: 240, mag: 20, reserve: 90, killReward: 300,
    moveSpeed: 215, scopedSpeed: 120, team: 'ct', rangeModifier: 0.98, range: 8192, penetration: 2.5, modes: ['semi'],
    scope: [0.4, 0.15],
  }),
  g3sg1: W({
    id: 'g3sg1', name: 'G3SG1', slot: 'primary', category: 'Sniper auto', price: 5000,
    damage: 80, armorPen: 0.825, rpm: 240, mag: 20, reserve: 90, killReward: 300,
    moveSpeed: 215, scopedSpeed: 120, team: 'tr', rangeModifier: 0.98, range: 8192, penetration: 2.5, modes: ['semi'],
    scope: [0.4, 0.15],
  }),

  negev: W({
    id: 'negev', name: 'Negev', slot: 'primary', category: 'Metralhadora', price: 1700,
    damage: 35, armorPen: 0.71, rpm: 800, mag: 150, reserve: 300, killReward: 300,
    moveSpeed: 195, team: null, rangeModifier: 0.97, range: 8192, penetration: 2, modes: ['auto'],
  }),
  m249: W({
    id: 'm249', name: 'M249', slot: 'primary', category: 'Metralhadora', price: 5200,
    damage: 32, armorPen: 0.8, rpm: 750, mag: 100, reserve: 200, killReward: 300,
    moveSpeed: 195, team: null, rangeModifier: 0.97, range: 8192, penetration: 2, modes: ['auto'],
  }),
});

/** Apelidos aceitos no console (`give ak`, `give usp`, `give scout`...). */
export const WEAPON_ALIASES = Object.freeze({
  ak: 'ak47', 'ak-47': 'ak47', m4: 'm4a4', m4a1: 'm4a1s', 'm4a1-s': 'm4a1s', usp: 'usps', 'usp-s': 'usps',
  glock18: 'glock', 'glock-18': 'glock', deserteagle: 'deagle', de: 'deagle', '57': 'fiveseven', 'five-seven': 'fiveseven',
  mac: 'mac10', 'mac-10': 'mac10', ump: 'ump45', 'ump-45': 'ump45', galilar: 'galil', sg: 'sg553', 'sg-553': 'sg553',
  scout: 'ssg08', ssg: 'ssg08', scar: 'scar20', g3: 'g3sg1', faca: 'knife', facadeouro: 'goldenKnife', xm: 'xm1014',
});

// ids têm maiúsculas (goldenKnife): a busca do console é feita em minúsculas.
const WEAPON_BY_LOWER = Object.freeze(Object.fromEntries(Object.keys(WEAPONS).map((k) => [k.toLowerCase(), k])));

/** Resolve id, apelido ou nome de exibição de uma arma, sem diferenciar maiúsculas. */
export function resolveWeaponId(name) {
  if (!name) return null;
  const key = String(name).toLowerCase().replace(/\s+/g, '');
  if (WEAPON_BY_LOWER[key]) return WEAPON_BY_LOWER[key];
  if (WEAPON_ALIASES[key]) return WEAPON_ALIASES[key];
  const byName = Object.values(WEAPONS).find((w) => w.name.toLowerCase().replace(/\s+/g, '') === key);
  return byName ? byName.id : null;
}

/** Dano a uma distância (u), modelo CS: damage * rangeModifier^(dist/500). */
export function damageAtDistance(weapon, distance) {
  return weapon.damage * Math.pow(weapon.rangeModifier, distance / 500);
}

/** Intervalo entre disparos em segundos. */
export function fireInterval(weapon) {
  return weapon.rpm > 0 ? 60 / weapon.rpm : 0;
}
