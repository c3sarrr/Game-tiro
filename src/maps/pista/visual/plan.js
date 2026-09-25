// Planta da pista desenhada a lápis na prancheta do spawn (item 11 do moodboard: COC5, COC30, PKC12), feita a partir
// dos próprios dados do layout: contorno da base e da cerca, cada lote com o número e o nome, as peças principais em
// traço leve, a rota tracejada passando pelas estações em ordem, "você está aqui" no spawn, rosa dos ventos, escala e
// o título. Papel inteiro na textura (opaca), decalque de papel impresso (lote `plan`).

import * as THREE from 'three';
import { RNG } from '../../../core/rng.js';
import { drawHandwriting } from '../../../clay/set/labelAtlas.js';
import { pieceBox } from '../pieces.js';

const HAND = '700 {px}px "Segoe Print", "Bradley Hand", "Comic Sans MS", "Chalkboard SE", cursive';
const THIN = '400 {px}px "Segoe Print", "Bradley Hand", "Comic Sans MS", cursive';
const GRAPHITE = '#57585D';

/** Linha de lápis levemente trêmula entre dois pontos (px). */
function pencilLine(g, x0, y0, x1, y1, rng, width = 1.6) {
  const n = Math.max(2, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 18));
  g.lineWidth = width * rng.float(0.85, 1.15);
  g.beginPath();
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const jitter = i === 0 || i === n ? 0 : rng.float(-0.8, 0.8);
    const dx = y1 - y0;
    const dy = -(x1 - x0);
    const l = Math.hypot(dx, dy) || 1;
    g.lineTo(x0 + (x1 - x0) * t + (dx / l) * jitter, y0 + (y1 - y0) * t + (dy / l) * jitter);
  }
  g.stroke();
}

/** Retângulo a lápis (os cantos passam um pouco, como no traço à mão). */
function pencilRect(g, x0, y0, x1, y1, rng, width) {
  const o = 3;
  pencilLine(g, x0 - o, y0, x1 + o, y0, rng, width);
  pencilLine(g, x1, y0 - o, x1, y1 + o, rng, width);
  pencilLine(g, x1 + o, y1, x0 - o, y1, rng, width);
  pencilLine(g, x0, y1 + o, x0, y0 - o, rng, width);
}

/**
 * Desenha a planta e devolve a textura (CanvasTexture opaca; o papel inteiro está nela).
 * @param {{pieces, stations, spawn}} layout
 */
export function bakePlan(layout, data, { width = 1536, height = 1011, anisotropy = 8 } = {}) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const g = canvas.getContext('2d');
  const rng = new RNG(`${data.seed}:planta`);
  // Papel: branco levemente amarelado, com a sombra de manuseio nas bordas.
  g.fillStyle = '#F1ECE0';
  g.fillRect(0, 0, width, height);
  const grad = g.createRadialGradient(width / 2, height / 2, height * 0.3, width / 2, height / 2, width * 0.72);
  grad.addColorStop(0, 'rgba(0,0,0,0)');
  grad.addColorStop(1, 'rgba(90,70,40,0.16)');
  g.fillStyle = grad;
  g.fillRect(0, 0, width, height);
  const B = data.base;
  const margin = { left: 70, right: 70, top: 120, bottom: 90 };
  const sx = (width - margin.left - margin.right) / (B.maxX - B.minX);
  const sz = (height - margin.top - margin.bottom) / (B.maxZ - B.minZ);
  const s = Math.min(sx, sz);
  const ox = (width - (B.maxX - B.minX) * s) / 2;
  const oy = margin.top;
  const px = (x) => ox + (x - B.minX) * s;
  const pz = (z) => oy + (z - B.minZ) * s;
  g.strokeStyle = GRAPHITE;
  g.fillStyle = GRAPHITE;
  g.lineCap = 'round';
  g.lineJoin = 'round';
  // Base e cerca.
  pencilRect(g, px(B.minX), pz(B.minZ), px(B.maxX), pz(B.maxZ), rng, 2.4);
  const F = data.fence;
  pencilRect(g, px(-F.innerX), pz(-F.innerZ), px(F.innerX), pz(F.innerZ), rng, 1.2);
  // Peças principais em traço leve (a projeção de cada peça no chão), sem as da base, cerca e lotes.
  g.globalAlpha = 0.55;
  for (const p of layout.pieces) {
    if (p.station === 0 || p.id.includes('-chao') || p.id.includes('-placa') || p.look.kind === 'none') continue;
    if (p.look.kind === 'paper' || p.look.kind === 'gridPaper' || p.look.kind === 'mat') continue;
    const b = pieceBox(p);
    g.lineWidth = 0.9;
    g.strokeRect(px(b.min.x), pz(b.min.z), (b.max.x - b.min.x) * s, (b.max.z - b.min.z) * s);
  }
  g.globalAlpha = 1;
  // Lotes: contorno firme, número num círculo e o nome.
  const centers = [];
  for (const lot of data.lots) {
    const x0 = px(lot.x[0]);
    const x1 = px(lot.x[1]);
    const y0 = pz(lot.z[0]);
    const y1 = pz(lot.z[1]);
    pencilRect(g, x0, y0, x1, y1, rng, 1.8);
    const station = data.stations.find((st) => st.number === lot.number);
    const cx = (x0 + x1) / 2;
    const cy = (y0 + y1) / 2;
    centers.push([cx, cy]);
    g.lineWidth = 1.6;
    g.beginPath();
    g.arc(x0 + 20, y0 + 20, 13, 0, Math.PI * 2);
    g.stroke();
    drawHandwriting(g, String(lot.number), { x: x0 + (lot.number >= 10 ? 9 : 14), baseline: y0 + 27, size: 18, font: HAND, rng, stroke: 0.03 });
    const label = station.label;
    const size = Math.min(22, ((x1 - x0) * 0.9) / Math.max(label.length * 0.55, 1));
    drawHandwriting(g, label, { x: x0 + 38, baseline: y0 + 27, size: Math.max(12, size), font: THIN, rng, stroke: 0.02 });
  }
  // Rota tracejada em lápis vermelho pelos lotes em ordem, a partir do spawn.
  const [sxp, szp] = [px(layout.spawn.x), pz(layout.spawn.z)];
  g.strokeStyle = '#B03A2E';
  g.setLineDash([10, 9]);
  g.lineWidth = 2.2;
  g.beginPath();
  g.moveTo(sxp, szp);
  for (const [cx, cy] of centers) g.lineTo(cx + rng.float(-6, 6), cy + rng.float(-6, 6));
  g.stroke();
  g.setLineDash([]);
  // Você está aqui: estrela no spawn com a seta e o texto.
  g.fillStyle = '#B03A2E';
  g.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const r = i % 2 === 0 ? 14 : 6;
    g.lineTo(sxp + Math.cos(a) * r, szp + Math.sin(a) * r);
  }
  g.closePath();
  g.fill();
  drawHandwriting(g, 'você está aqui', { x: sxp + 20, baseline: szp + 34, size: 22, font: HAND, rng, stroke: 0.04 });
  // Rosa dos ventos e escala.
  g.strokeStyle = GRAPHITE;
  g.fillStyle = GRAPHITE;
  const rx = width - 90;
  const ry = 72;
  pencilLine(g, rx, ry + 34, rx, ry - 34, rng, 1.8);
  pencilLine(g, rx - 26, ry, rx + 26, ry, rng, 1.2);
  g.beginPath();
  g.moveTo(rx, ry - 42);
  g.lineTo(rx - 8, ry - 22);
  g.lineTo(rx + 8, ry - 22);
  g.closePath();
  g.fill();
  drawHandwriting(g, 'N', { x: rx - 8, baseline: ry - 48, size: 22, font: HAND, rng, stroke: 0.03 });
  const barX = 80;
  const barY = height - 40;
  const meter = 100 * s;
  for (let k = 0; k < 5; k++) {
    g.fillStyle = k % 2 === 0 ? GRAPHITE : 'rgba(0,0,0,0)';
    g.fillRect(barX + k * meter, barY - 5, meter, 10);
    g.strokeRect(barX + k * meter, barY - 5, meter, 10);
  }
  g.fillStyle = GRAPHITE;
  drawHandwriting(g, '5 m = 500 u', { x: barX + 5 * meter + 14, baseline: barY + 8, size: 20, font: THIN, rng, stroke: 0.02 });
  // Título.
  drawHandwriting(g, 'Pista de testes — planta', { x: 70, baseline: 70, size: 44, font: HAND, rng, stroke: 0.05 });
  const texture = new THREE.CanvasTexture(canvas);
  texture.name = 'massacre.pista.planta';
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = anisotropy;
  texture.generateMipmaps = true;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.needsUpdate = true;
  return {
    texture,
    dispose() {
      texture.dispose();
      canvas.width = canvas.height = 0;
    },
  };
}
