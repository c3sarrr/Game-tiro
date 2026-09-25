// Funções puras sobre bindings (sem DOM): interpretar strings, mapa reverso e atribuição com conflito.
// Regra de conflito (igual ao CS): um botão/tecla aciona uma única ação por dispositivo; atribuir um bind já usado
// remove-o da ação anterior e informa quem perdeu (a UI mostra "W saiu de Frente").

import { ACTION_IDS } from '../data/actions.js';

const RE_KEY = /^key:([A-Za-z0-9]+)$/;
const RE_MOUSE = /^mouse:([0-4])$/;
const RE_WHEEL = /^wheel:(up|down)$/;
const RE_BUTTON = /^pad:button:(\d{1,2})$/;
const RE_AXIS = /^pad:axis:(\d)([+-])$/;

/** @returns {null | {device:'kbm'|'pad', kind:string, code?:string, button?:number, dir?:string, index?:number, sign?:number}} */
export function parseBinding(binding) {
  if (typeof binding !== 'string') return null;
  let m;
  if ((m = RE_KEY.exec(binding))) return { device: 'kbm', kind: 'key', code: m[1] };
  if ((m = RE_MOUSE.exec(binding))) return { device: 'kbm', kind: 'mouse', button: Number(m[1]) };
  if ((m = RE_WHEEL.exec(binding))) return { device: 'kbm', kind: 'wheel', dir: m[1] };
  if ((m = RE_BUTTON.exec(binding))) return { device: 'pad', kind: 'button', index: Number(m[1]) };
  if ((m = RE_AXIS.exec(binding))) return { device: 'pad', kind: 'axis', index: Number(m[1]), sign: m[2] === '+' ? 1 : -1 };
  return null;
}

export function deviceOf(binding) {
  return parseBinding(binding)?.device ?? null;
}

/** Mapa reverso binding → ações (lookup O(1) no processamento de entrada). */
export function buildReverseMap(bindings) {
  const map = new Map();
  for (const action of ACTION_IDS) {
    const entry = bindings[action];
    if (!entry) continue;
    for (const dev of ['kbm', 'pad']) {
      for (const b of entry[dev] ?? []) {
        const list = map.get(b);
        if (list) list.push(action);
        else map.set(b, [action]);
      }
    }
  }
  return map;
}

/** Ações que usam o binding. */
export function actionsForBinding(bindings, binding) {
  return ACTION_IDS.filter((a) => bindings[a]?.kbm?.includes(binding) || bindings[a]?.pad?.includes(binding));
}

/**
 * Atribui `binding` à `action` na posição `slot` (0 = principal). Remove o mesmo binding das outras ações.
 * mode 'replace' (UI: clicar numa posição troca o que estava nela) | 'insert' (console `bind`: acrescenta,
 * como no CS, sem tirar as outras teclas da ação). Não altera o objeto recebido.
 * @returns {{bindings: object, displaced: string[]}}
 */
export function assignBinding(bindings, action, binding, slot = 0, mode = 'replace') {
  const parsed = parseBinding(binding);
  if (!parsed) throw new Error(`binding inválido: ${binding}`);
  if (!ACTION_IDS.includes(action)) throw new Error(`ação desconhecida: ${action}`);
  const dev = parsed.device;
  const out = structuredClone(bindings);
  const displaced = [];
  for (const other of ACTION_IDS) {
    if (other === action) continue;
    const list = out[other]?.[dev];
    if (list?.includes(binding)) {
      out[other][dev] = list.filter((b) => b !== binding);
      displaced.push(other);
    }
  }
  const current = out[action][dev] ?? [];
  const index = Math.max(0, slot);
  let list;
  if (mode === 'insert') {
    list = current.filter((b) => b !== binding);
    list.splice(Math.min(index, list.length), 0, binding);
  } else {
    // Troca a posição; se o mesmo binding estava em outra posição da ação, ele sai de lá.
    list = current.map((b, i) => (b === binding && i !== index ? null : b));
    if (index < list.length) list[index] = binding;
    else list.push(binding);
    list = list.filter((b) => b !== null);
  }
  out[action][dev] = list.slice(0, 4);
  return { bindings: out, displaced };
}

/** Remove o binding do slot (ou todos os do dispositivo, se slot for null). */
export function clearBinding(bindings, action, device, slot = null) {
  const out = structuredClone(bindings);
  const list = out[action]?.[device];
  if (!list) return out;
  out[action][device] = slot === null ? [] : list.filter((_, i) => i !== slot);
  return out;
}

/** Bindings usados por mais de uma ação (não deveria acontecer; usado em teste e na validação da UI). */
export function findConflicts(bindings) {
  const seen = new Map();
  const conflicts = [];
  for (const action of ACTION_IDS) {
    for (const dev of ['kbm', 'pad']) {
      for (const b of bindings[action]?.[dev] ?? []) {
        if (seen.has(b)) conflicts.push({ binding: b, actions: [seen.get(b), action] });
        else seen.set(b, action);
      }
    }
  }
  return conflicts;
}
