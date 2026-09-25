// Variáveis sv_* de movimento em tempo de execução: um objeto simples que o controlador lê a cada tick
// (acesso direto por propriedade). O console troca os valores; `resetSvVars` volta aos do CS:GO.

import { SV_DEFAULTS, SV_VARS } from '../data/movement.js';

const BY_KEY = Object.freeze(Object.fromEntries(SV_VARS.map((v) => [v.key, v])));

export function createSvVars() {
  return { ...SV_DEFAULTS };
}

/**
 * Troca uma variável (limitada à faixa do console; as de 0/1 arredondam). Devolve o valor aplicado; erro para chave
 * ou valor inválido.
 */
export function setSvVar(vars, key, value) {
  const spec = BY_KEY[key];
  if (!spec) throw new Error(`variável desconhecida: sv_${key}`);
  const n = typeof value === 'string' ? Number(value.replace(',', '.')) : Number(value);
  if (!Number.isFinite(n)) throw new Error(`valor inválido para sv_${key}: ${value}`);
  const v = Math.min(spec.max, Math.max(spec.min, n));
  vars[key] = spec.int ? Math.round(v) : v;
  return vars[key];
}

export function resetSvVars(vars) {
  return Object.assign(vars, SV_DEFAULTS);
}
