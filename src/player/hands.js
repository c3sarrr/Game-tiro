// Item na mão (seções 0.6 e 0.7): qual item do Loadout está sacado, a troca pelo comando do tick (slots 1–5, roda e Q,
// o `weaponselect` do Source), a troca automática ao receber arma melhor (cl_autowepswitch) e a luneta (níveis de zoom,
// FOV, sensibilidade e o modo "alt" que muda velocidade e precisão). Funções puras sobre um estado simples, ao lado do
// Loadout (que continua sendo só as regras de inventário): o jogador local, a predição (Fase 9) e os bots (Fase 7) usam
// as mesmas, gerando `cmd.select` e o botão de mirar.

import { MOVE } from '../data/movement.js';
import { UTILITIES } from '../data/economy.js';
import { BOMB, SCOPE, WEAPONS } from '../data/weapons.js';
import { SELECT } from './moveCmd.js';

const DEG = Math.PI / 180;

/** Posto de cada slot: o melhor item e a troca automática seguem esta ordem (primária melhor). */
const SLOT_RANK = Object.freeze({ primary: 0, secondary: 1, melee: 2, grenade: 3, c4: 4 });
const SLOT_OF_SELECT = Object.freeze([null, 'primary', 'secondary', 'melee', 'grenade', 'c4']);

/** Estado da mão: slot ativo, granada na mão, anteriores (Q), item resolvido no tick e luneta. */
export function createHands() {
  return { slot: 'melee', grenade: null, lastSlot: null, lastGrenade: null, item: null, zoom: 0, zoomCooldown: 0 };
}

/** Item do slot (id da arma, tipo de granada ou 'c4'), ou null se o slot está vazio. */
export function itemAt(loadout, slot, grenade) {
  switch (slot) {
    case 'primary':
      return loadout.primary;
    case 'secondary':
      return loadout.secondary;
    case 'melee':
      return loadout.melee;
    case 'grenade':
      return grenade && loadout.grenades.includes(grenade) ? grenade : null;
    case 'c4':
      return loadout.bomb ? BOMB.id : null;
    default:
      return null;
  }
}

/** Itens que o jogador tem, na ordem do CS: primária → pistola → faca → granadas (ordem de entrada) → bomba. */
export function carriedItems(loadout) {
  const list = [];
  if (loadout.primary) list.push({ slot: 'primary', grenade: null });
  if (loadout.secondary) list.push({ slot: 'secondary', grenade: null });
  if (loadout.melee) list.push({ slot: 'melee', grenade: null });
  for (const g of loadout.grenadeTypes()) list.push({ slot: 'grenade', grenade: g });
  if (loadout.bomb) list.push({ slot: 'c4', grenade: null });
  return list;
}

/** Vai para o slot/granada pedido, guardando o anterior para o Q. false se já estava nele. */
function switchTo(h, slot, grenade) {
  const g = slot === 'grenade' ? grenade : null;
  if (slot === h.slot && g === h.grenade) return false;
  h.lastSlot = h.slot;
  h.lastGrenade = h.grenade;
  h.slot = slot;
  h.grenade = g;
  return true;
}

/**
 * Aplica o pedido de troca do tick (`cmd.select`). 1, 2, 3 e 5 vão para o slot se houver item nele; 4 pega o primeiro
 * tipo de granada ou, já com granada, o próximo; a roda anda na ordem dos itens dando a volta; Q volta ao anterior se
 * ele ainda existir. Devolve true se o slot mudou.
 */
export function applySelect(h, loadout, select) {
  if (select >= SELECT.SLOT1 && select <= SELECT.SLOT5) {
    const slot = SLOT_OF_SELECT[select];
    if (slot === 'grenade') {
      const types = loadout.grenadeTypes();
      if (!types.length) return false;
      const next = h.slot === 'grenade' ? types[(types.indexOf(h.grenade) + 1) % types.length] : types[0];
      return switchTo(h, 'grenade', next);
    }
    return itemAt(loadout, slot, null) ? switchTo(h, slot, null) : false;
  }
  if (select === SELECT.NEXT || select === SELECT.PREV) {
    const list = carriedItems(loadout);
    if (list.length < 2) return false;
    const i = list.findIndex((e) => e.slot === h.slot && e.grenade === h.grenade);
    const j = (i + (select === SELECT.NEXT ? 1 : -1) + list.length) % list.length;
    return switchTo(h, list[j].slot, list[j].grenade);
  }
  if (select === SELECT.LAST) {
    if (!h.lastSlot || !itemAt(loadout, h.lastSlot, h.lastGrenade)) return false;
    return switchTo(h, h.lastSlot, h.lastGrenade);
  }
  return false;
}

/** Melhor item que o jogador tem (primária > pistola > faca > granadas > bomba), direto na mão. */
function selectBest(h, loadout) {
  if (loadout.primary) h.slot = 'primary';
  else if (loadout.secondary) h.slot = 'secondary';
  else if (loadout.melee) h.slot = 'melee';
  else if (loadout.grenades.length) h.slot = 'grenade';
  else if (loadout.bomb) h.slot = 'c4';
  h.grenade = h.slot === 'grenade' ? loadout.grenades[0] : null;
}

/**
 * Mantém a mão coerente com o inventário a cada tick: na primeira vez (ao nascer) saca o melhor item; depois, se o item
 * da mão sumiu (o `give` trocou a arma do slot, a granada acabou), vai para o melhor item. Devolve true se o item na
 * mão mudou — "sacou": a luneta volta ao nível 0 e o chamador zera a precisão.
 */
export function syncHands(h, loadout) {
  let id = h.item === null ? null : itemAt(loadout, h.slot, h.grenade);
  if (!id) {
    selectBest(h, loadout);
    id = itemAt(loadout, h.slot, h.grenade);
  }
  if (id === h.item) return false;
  h.item = id;
  h.zoom = 0;
  h.zoomCooldown = 0;
  return true;
}

/**
 * Troca automática ao receber uma arma (o cl_autowepswitch 1 do CS): pede o slot dela se ele for de posto melhor que o
 * da mão. Granadas e bomba nunca trocam sozinhas.
 */
export function autoSwitchSelect(h, slot) {
  if (slot !== 'primary' && slot !== 'secondary' && slot !== 'melee') return SELECT.NONE;
  if (SLOT_RANK[slot] >= SLOT_RANK[h.slot]) return SELECT.NONE;
  return slot === 'primary' ? SELECT.SLOT1 : slot === 'secondary' ? SELECT.SLOT2 : SELECT.SLOT3;
}

/** Níveis de zoom da arma (0 = sem luneta). */
export function zoomLevels(itemId) {
  return WEAPONS[itemId]?.scope?.length ?? 0;
}

/** FOV do nível de zoom, na referência de 90° do CS (null sem zoom). */
export function zoomFov(itemId, level) {
  return level > 0 ? WEAPONS[itemId].scope[level - 1] : null;
}

/** Multiplicador da tangente do FOV do jogador no nível (1 sem zoom): a ampliação do CS sobre o FOV escolhido. */
export function zoomFactor(itemId, level) {
  if (level <= 0) return 1;
  return Math.tan((zoomFov(itemId, level) / 2) * DEG) / Math.tan((SCOPE.referenceFov / 2) * DEG);
}

/** Duração (s) da transição do FOV para o nível (índice 0 = sair do zoom). */
export function zoomTime(itemId, level) {
  return WEAPONS[itemId]?.zoomTime?.[level] ?? 0;
}

/** Sensibilidade com zoom: controls.zoomSensitivity × fov/90 (o zoom_sensitivity_ratio_mouse do CS:GO); 1 sem zoom. */
export function zoomLookScale(itemId, level, zoomSensitivity) {
  return level > 0 ? (zoomSensitivity * zoomFov(itemId, level)) / SCOPE.referenceFov : 1;
}

/**
 * Luneta (o SecondaryAttack do CS): com o botão de mirar segurado e o tempo zerado, sobe um nível (depois do último
 * volta ao 0) e espera SCOPE.cycleCooldown — segurar cicla. `enabled` false (noclip) só desconta o tempo. Devolve true
 * se o nível mudou.
 */
export function updateZoom(h, aimDown, dt, enabled = true) {
  h.zoomCooldown = Math.max(0, h.zoomCooldown - dt);
  const levels = zoomLevels(h.item);
  if (!enabled || !aimDown || levels === 0 || h.zoomCooldown > 0) return false;
  h.zoom = (h.zoom + 1) % (levels + 1);
  h.zoomCooldown = SCOPE.cycleCooldown;
  return true;
}

/**
 * Modo "alt" da arma (o Secondary_Mode do CS), que troca velocidade e precisão: com zoom nas armas com luneta; com o
 * silenciador colocado na USP-S e na M4A1-S (o padrão; tirar é da Fase 4); em rajada na Glock e na FAMAS (liga na Fase
 * 4). Silenciador e rajada são entradas explícitas.
 */
export function weaponAlt(itemId, zoom, silencerOn = true, burst = false) {
  const w = WEAPONS[itemId];
  if (!w) return false;
  if (w.scope) return zoom > 0;
  if (w.silencer) return silencerOn;
  if (w.burst) return burst;
  return false;
}

/** Velocidade máxima com o item na mão (u/s), no modo atual; teto de CS_PLAYER_SPEED_RUN (260). */
export function itemSpeed(itemId, alt) {
  const w = WEAPONS[itemId];
  let v;
  if (w) v = alt && w.scopedSpeed ? w.scopedSpeed : w.moveSpeed;
  else if (itemId === BOMB.id) v = BOMB.moveSpeed;
  else v = UTILITIES[itemId]?.moveSpeed ?? MOVE.runSpeed;
  return Math.min(v, MOVE.runSpeed);
}

/**
 * "Sniper lenta" com luneta (regra da aceleração do CS:GO): arma de 2+ níveis de zoom, com zoom, e velocidade no modo
 * atual × 0,52 abaixo de 110 — AWP, SCAR-20 e G3SG1 com zoom.
 */
export function isSlowSniper(itemId, zoom, alt) {
  return zoom > 0 && zoomLevels(itemId) > 1 && itemSpeed(itemId, alt) * MOVE.walkModifier < MOVE.slowSniperWalkSpeed;
}

/** Nome de exibição do item. */
export function itemName(itemId) {
  if (WEAPONS[itemId]) return WEAPONS[itemId].name;
  if (itemId === BOMB.id) return BOMB.name;
  return UTILITIES[itemId]?.name ?? '—';
}
