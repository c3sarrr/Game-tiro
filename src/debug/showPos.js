// cl_showpos (Fases 3.1 e 3.2): pés, ângulos, velocidade, chão e cápsula do jogador; item na mão e luneta; o teto do
// tick com os fatores (andar, stamina, agachar); stamina; agachar; a inaccuracy com as partes; último passo e pouso; o
// placar do counter-strafe e o gráfico dos últimos 4 s (src/debug/speedGraph.js). Painel no canto, atualizado 15 vezes
// por segundo (texto, sem custo de layout a cada quadro).

import { h } from '../ui/dom.js';
import { SURFACES } from '../data/surfaces.js';
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

export class ShowPosPanel {
  constructor(root) {
    this.text = h('pre.dbg-showpos-text');
    this.canvas = h('canvas.dbg-showpos-graph', { width: 480, height: 96 });
    this.legend = h('div.dbg-showpos-legend', null,
      h('span.is-speed', null, 'velocidade'), h('span.is-cap', null, 'teto'), h('span.is-threshold', null, 'limiar'),
      h('span.is-inaccuracy', null, 'inaccuracy'), h('span.is-air', null, 'no ar'));
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
   * @param {import('./strafeMeter.js').StrafeMeter} [meter] placar e marcas do counter-strafe
   */
  update(pawn, meter = null, now = performance.now()) {
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
    ];
    if (meter) {
      lines.push(
        `strafe ${strafeLine(meter, STRAFE_KIND.COUNTER)}`,
        `       ${strafeLine(meter, STRAFE_KIND.RELEASE)}`,
      );
    }
    this.text.textContent = lines.join('\n');
    this.graph.draw(pawn.telemetry, meter);
  }

  dispose() {
    this.el.remove();
  }
}
