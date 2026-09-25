// cl_showpos (Fases 3.1 a 3.4): pés, ângulos, velocidade, chão e cápsula do jogador; item na mão e luneta; o teto do
// tick com os fatores (andar, stamina, agachar); stamina; agachar; a inaccuracy com as partes; último passo e pouso;
// vida, slide e contato de parede (3.4); o placar do counter-strafe, o medidor de salto e queda (último voo com os
// wall-jumps e o dano, série de bhop e recordes; src/debug/jumpMeter.js) e o gráfico dos últimos 4 s
// (src/debug/speedGraph.js). Painel no canto, atualizado 15 vezes por segundo (texto, sem custo de layout a cada quadro).

import { h } from '../ui/dom.js';
import { WALLJUMP } from '../data/movement.js';
import { SURFACES } from '../data/surfaces.js';
import { DEATH_CAUSES, VITALS } from '../data/vitals.js';
import { WEAPONS } from '../data/weapons.js';
import { itemName, zoomFov, zoomLevels } from '../player/hands.js';
import { precisionThreshold } from '../player/inaccuracy.js';
import { MOVETYPE } from '../player/movement.js';
import { SpeedGraph } from './speedGraph.js';
import { STRAFE_KIND } from './strafeMeter.js';

const DEG = 180 / Math.PI;
const f1 = (v) => v.toFixed(1).padStart(8);
const f2 = (v) => v.toFixed(2);
const f5 = (v) => v.toFixed(5);
const yesNo = (v) => (v ? 'sim' : 'não');

/** Nome do modo alt da arma na mão (luneta, silenciador ou rajada). */
function altLabel(itemId) {
  const w = WEAPONS[itemId];
  if (w?.scope) return 'luneta';
  return w?.silencer ? 'silenciador' : 'rajada';
}

/** Linha do item na mão: nome, velocidade no modo atual, luneta e modo. */
function heldLine(pawn) {
  const { hands, held } = pawn;
  const levels = zoomLevels(hands.item);
  let zoom = '';
  if (levels) {
    const fov = hands.zoom ? ` (${zoomFov(hands.item, hands.zoom)}°)` : '';
    zoom = ` · luneta ${hands.zoom}/${levels}${fov}`;
  }
  const alt = held.alt && !WEAPONS[hands.item]?.scope ? ` · ${altLabel(hands.item)}` : '';
  return `mão   ${itemName(hands.item)} · ${held.speed} u/s${zoom}${alt}${held.slowSniper ? ' · sniper lenta' : ''}`;
}

/** Placar de um tipo de medida do counter-strafe. */
function strafeLine(meter, kind) {
  const s = meter.scores[kind];
  const active = meter.kind === kind ? ' · medindo…' : '';
  if (!s.count) return `${kind.padEnd(6)} —${active}`;
  return `${kind.padEnd(6)} ${s.lastTicks} ticks · ${s.last.toFixed(0)} ms · melhor ${s.best.toFixed(0)} · média ` +
    `${s.avg.toFixed(0)} (${s.recent.length})${active}`;
}

/** Vida (3.4): vida, colete, acumulado do dano, último dano e mortes; morto, a causa e a volta. */
function vitalsLine(pawn) {
  const v = pawn.vitals;
  const hurt = pawn.lastHurt;
  const last = hurt ? ` · último −${hurt.taken} (${hurt.amount.toFixed(2)}, ${hurt.kind})` : '';
  const dead = v.alive ? '' : ` · MORTO: ${DEATH_CAUSES[v.cause] ?? v.cause}, volta em `
    + `${Math.max(0, VITALS.respawnDelay - v.deadTime).toFixed(1)} s`;
  return `vida  ${v.health} · colete ${pawn.loadout.armor} · acumulado ${f2(v.accumulator)}${last}`
    + ` · mortes ${v.deaths}${dead}`;
}

/** Slide (3.4): estado e tempo, recarga, saída e o último slide (distância, tempo, entrada → saída, motivo). */
function slideLine(pawn) {
  const s = pawn.state;
  const now = s.sliding ? `deslizando ${s.slideTime.toFixed(2)} s${s.slideAir > 0 ? ` (no ar ${s.slideAir.toFixed(2)} s)` : ''}` : 'parado';
  const cool = s.slideCooldown > 0 ? ` · recarga ${s.slideCooldown.toFixed(2)} s` : '';
  const exit = s.slideExit ? ' · saída freando' : '';
  const e = pawn.lastSlide;
  const last = e
    ? ` · último: ${e.distance.toFixed(1)} u em ${e.time.toFixed(2)} s, ${e.entrySpeed.toFixed(0)} → `
      + `${e.exitSpeed.toFixed(0)} u/s, ${e.reason}`
    : '';
  return `slide ${now}${cool}${exit}${last} · ${pawn.stats.slides} slides`;
}

/** Parede (3.4): último contato (direção e idade em ticks), paredes usadas no voo, buffer do pulo e espera. */
function wallLine(pawn, dt) {
  const s = pawn.state;
  const contact = s.wallTime < WALLJUMP.ageMax
    ? `normal ${f2(s.wallNx)} ${f2(s.wallNz)} · peça ${s.wallPart} · há ${Math.round(s.wallTime / dt)} ticks`
    : 'sem contato';
  const buffer = s.jumpBuffer > 0 ? ` · buffer ${s.jumpBuffer.toFixed(2)} s` : '';
  const wait = s.wallJumpCooldown > 0 ? ` · espera ${s.wallJumpCooldown.toFixed(2)} s` : '';
  return `pared. ${contact} · usadas ${Math.min(s.usedCount, WALLJUMP.maxUsed)} · wall-jumps no voo ${s.wallJumps}`
    + `${buffer}${wait} · ${pawn.stats.wallJumps} no total`;
}

/** Linhas do medidor de salto e queda: último voo (e o em andamento), recordes e a série de bhop. */
function jumpLines(m) {
  const last = m.last;
  const walls = (n) => (n ? ` · ${n} wall-jump${n > 1 ? 's' : ''}` : '');
  const lastText = last
    ? `${last.kind} ${last.distance.toFixed(1)} u · ápice ${last.apex.toFixed(1)} · ${last.time.toFixed(2)} s`
      + ` · queda ${last.drop.toFixed(1)} · pouso ${last.landSpeed.toFixed(0)} u/s`
      + `${last.damage > 0 ? ` · dano ${last.damage.toFixed(2)}` : ''}${walls(last.walls)}`
    : '—';
  const air = m.air
    ? ` · no ar: ${m.air.kind} ${(m.air.ticks * m.dt).toFixed(2)} s, ápice ${(m.air.apex - m.air.y).toFixed(1)}${walls(m.air.walls)}`
    : '';
  const sr = m.shownSeries;
  const seriesText = sr
    ? `${sr.jumps} pulos · ${sr.distance.toFixed(0)} u em ${sr.time.toFixed(2)} s · média ${sr.avgSpeed.toFixed(0)} u/s`
      + ` · máx. ${sr.maxSpeed.toFixed(0)} u/s${sr.running ? ' · em andamento' : ''}`
    : '—';
  return [
    `salto ${lastText}${air}`,
    `      recordes: distância ${m.best.distance.toFixed(1)} u · queda ${m.best.drop.toFixed(1)} u · série ${m.best.series}`
      + ` pulos · ${m.best.walls} wall-jumps seguidos`,
    `bhop  ${seriesText}`,
  ];
}

export class ShowPosPanel {
  constructor(root) {
    this.text = h('pre.dbg-showpos-text');
    this.canvas = h('canvas.dbg-showpos-graph', { width: 480, height: 96 });
    this.legend = h('div.dbg-showpos-legend', null,
      h('span.is-speed', null, 'velocidade'), h('span.is-cap', null, 'teto'), h('span.is-threshold', null, 'limiar'),
      h('span.is-inaccuracy', null, 'inaccuracy'), h('span.is-air', null, 'no ar'), h('span.is-slide', null, 'slide'),
      h('span.is-walljump', null, 'wall-jump'));
    this.el = h('div.dbg-showpos', { hidden: true, 'aria-hidden': 'true' }, this.text, this.canvas, this.legend);
    root.append(this.el);
    this.graph = new SpeedGraph(this.canvas);
    this.visible = false;
    this.last = 0;
  }

  setVisible(visible) {
    this.visible = visible;
    this.el.hidden = !visible;
    this.last = 0;
  }

  /**
   * @param {import('../player/playerPawn.js').PlayerPawn} pawn
   * @param {{strafe?: import('./strafeMeter.js').StrafeMeter, jump?: import('./jumpMeter.js').JumpMeter}} [meters]
   *   placar e marcas do counter-strafe; medidor de salto e queda
   */
  update(pawn, { strafe: meter = null, jump = null } = {}, now = performance.now()) {
    if (!this.visible || now - this.last < 66) return;
    this.last = now;
    const s = pawn.state;
    const o = s.origin;
    const v = s.velocity;
    let where = 'ar';
    if (s.moveType === MOVETYPE.NOCLIP) where = 'noclip';
    else if (s.onGround) {
      const n = s.groundNormal;
      where = `chão · ${SURFACES[s.groundSurface].label} · normal ${f2(n.x)} ${f2(n.y)} ${f2(n.z)}`;
    }
    const acc = pawn.inaccuracy;
    const step = pawn.lastStep;
    const land = pawn.lastLanding;
    const stepText = step
      ? `${step.foot ? 'dir.' : 'esq.'} · ${SURFACES[step.surface].label} · vol. ${f2(step.volume)} · `
        + `${step.speed.toFixed(0)} u/s · ${step.audible ? 'audível' : 'silencioso'}`
      : '—';
    const landText = land
      ? `${land.speed.toFixed(0)} u/s${land.audible ? ' · audível' : ''}${land.heavy ? ' · pesado' : ''}`
        + `${land.damage > 0 ? ` · dano ${land.damage.toFixed(2)}` : ''}`
      : '—';
    const lines = [
      `pos   ${f1(o.x)} ${f1(o.y)} ${f1(o.z)}  (pés)`,
      `ang   yaw ${(pawn.yaw * DEG).toFixed(1)}°  pitch ${(pawn.pitch * DEG).toFixed(1)}°`,
      `vel   ${f1(v.x)} ${f1(v.y)} ${f1(v.z)}`,
      `plano ${Math.hypot(v.x, v.z).toFixed(1)} u/s · pico ${pawn.stats.topSpeed.toFixed(1)} u/s`,
      `onde  ${where}`,
      `cáps. ${s.ducked ? 'agachada' : 'em pé'} (${s.height} u) · agachar ${f2(s.duckAmount)}` +
        ` · vel. agachar ${f2(s.duckSpeed)}${s.stuck ? ' · PRESO' : ''}`,
      `agach FL_DUCKING ${yesNo(s.duckFlag)} · descendo/subindo ${yesNo(s.ducking)} · valendo ${yesNo(s.duckHeld)}`,
      heldLine(pawn),
      `teto  ${s.maxSpeed.toFixed(1)} u/s = ${s.baseSpeed.toFixed(0)} × andar ${f2(s.walkFactor)}` +
        ` × stamina ${f2(s.staminaFactor)} × agachar ${f2(s.duckFactor)}`,
      `stam. ${s.stamina.toFixed(1)} · pulo × ${f2(Math.max(0, 1 - s.stamina / 100))}` +
        ` · andando ${yesNo(s.walking)}`,
      `prec. ${f5(acc.total)} = base ${f5(acc.base)} + mov. ${f5(acc.move)} + ar ${f5(acc.air)}` +
        ` · limiar ${precisionThreshold(pawn.held.speed).toFixed(1)}`,
      `passo ${stepText} · ${pawn.stats.steps} passos`,
      `pouso ${landText} · pulos ${pawn.stats.jumps}`,
      vitalsLine(pawn),
      slideLine(pawn),
      wallLine(pawn, pawn.env.dt),
    ];
    if (meter) {
      lines.push(
        `strafe ${strafeLine(meter, STRAFE_KIND.COUNTER)}`,
        `       ${strafeLine(meter, STRAFE_KIND.RELEASE)}`,
      );
    }
    if (jump) lines.push(...jumpLines(jump));
    this.text.textContent = lines.join('\n');
    this.graph.draw(pawn.telemetry, meter);
  }

  dispose() {
    this.el.remove();
  }
}
