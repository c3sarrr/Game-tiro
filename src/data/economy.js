// Economia e utilitários (seção 0.7). Valores de balanceamento centralizados: nada disso deve aparecer
// "hardcoded" no código dos modos.

export const ECONOMY = Object.freeze({
  startMoney: 800,
  maxMoney: 16000,
  winElimination: 3250,
  winBomb: 3500, // explosão da bomba (TR) ou desarme (CT)
  winTime: 3250, // tempo esgotado (CT)
  lossBonus: Object.freeze([1400, 1900, 2400, 2900, 3400]),
  plantReward: 300, // para quem plantou
  plantTeamBonusOnLoss: 800, // o time TR recebe mesmo perdendo a rodada
  defuseReward: 300,
  buyTimeSeconds: 20,
});

export const GRENADE_LIMITS = Object.freeze({
  total: 4,
  perType: Object.freeze({ he: 1, flash: 2, smoke: 1, molotov: 1, incendiary: 1, decoy: 1 }),
});

/** Utilitários da loja (equipamento e granadas). `team`: null = ambos. */
export const UTILITIES = Object.freeze({
  kevlar: Object.freeze({ id: 'kevlar', name: 'Colete', price: 650, kind: 'equipment', team: null }),
  kevlarHelmet: Object.freeze({ id: 'kevlarHelmet', name: 'Colete + Capacete', price: 1000, kind: 'equipment', team: null }),
  defuseKit: Object.freeze({ id: 'defuseKit', name: 'Kit de desarme', price: 400, kind: 'equipment', team: 'ct' }),
  he: Object.freeze({ id: 'he', name: 'Granada HE', price: 300, kind: 'grenade', team: null }),
  flash: Object.freeze({ id: 'flash', name: 'Flash', price: 200, kind: 'grenade', team: null }),
  smoke: Object.freeze({ id: 'smoke', name: 'Smoke', price: 300, kind: 'grenade', team: null }),
  molotov: Object.freeze({ id: 'molotov', name: 'Molotov', price: 400, kind: 'grenade', team: 'tr' }),
  incendiary: Object.freeze({ id: 'incendiary', name: 'Incendiária', price: 600, kind: 'grenade', team: 'ct' }),
  decoy: Object.freeze({ id: 'decoy', name: 'Decoy', price: 50, kind: 'grenade', team: null }),
});

/** Apelidos aceitos no console e em comandos de texto (`give colete`, `give hegrenade`, `give kit`...). */
export const UTILITY_ALIASES = Object.freeze({
  colete: 'kevlar', vest: 'kevlar', armor: 'kevlar',
  capacete: 'kevlarHelmet', helmet: 'kevlarHelmet', vesthelm: 'kevlarHelmet', coletecapacete: 'kevlarHelmet',
  kit: 'defuseKit', defuser: 'defuseKit', desarme: 'defuseKit',
  hegrenade: 'he', granada: 'he', explosiva: 'he',
  flashbang: 'flash', cegante: 'flash',
  fumaca: 'smoke', 'fumaça': 'smoke', smokegrenade: 'smoke',
  molly: 'molotov',
  incendiaria: 'incendiary', 'incendiária': 'incendiary', incgrenade: 'incendiary', inc: 'incendiary',
  isca: 'decoy',
});

const UTILITY_BY_LOWER = Object.freeze(Object.fromEntries(Object.keys(UTILITIES).map((k) => [k.toLowerCase(), k])));

/** Resolve id, apelido ou nome de exibição de um utilitário, sem diferenciar maiúsculas. */
export function resolveUtilityId(name) {
  if (!name) return null;
  const key = String(name).toLowerCase().replace(/[\s_+-]+/g, '');
  if (UTILITY_BY_LOWER[key]) return UTILITY_BY_LOWER[key];
  if (UTILITY_ALIASES[key]) return UTILITY_ALIASES[key];
  const byName = Object.values(UTILITIES).find((u) => u.name.toLowerCase().replace(/[\s_+-]+/g, '') === key);
  return byName ? byName.id : null;
}

/** Bônus de derrota para a sequência atual de derrotas (1 = primeira derrota). */
export function lossBonusFor(consecutiveLosses) {
  const table = ECONOMY.lossBonus;
  const i = Math.min(Math.max(consecutiveLosses, 1), table.length) - 1;
  return table[i];
}

export function clampMoney(value) {
  return Math.max(0, Math.min(ECONOMY.maxMoney, Math.round(value)));
}
