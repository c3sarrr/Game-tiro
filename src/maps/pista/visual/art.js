// Arte em canvas da pista de testes (item 11 do moodboard: COC4/CBT15 estampas de caixa, AWB17 estêncil, PKG11/PKC14
// paredes numeradas, WRG4/WRG11 anotações a lápis, CFO8 transferidor, TMA12 bandeirinha, DFL5 plaquinhas, COC30
// etiqueta de arquivo): um atlas RGBA por mapa com todas as células, e os decalques que as usam (lote `decal`).
// Cada célula desenha duas camadas: a cor (opaca na célula inteira — a cor continua certa onde a cobertura é zero, sem
// franja escura nos mipmaps) e a cobertura (alfa, recortada no shader por teste de alfa). O atlas vai como DataTexture
// sem pré-multiplicação, com as linhas invertidas para v = 0 embaixo (como as CanvasTexture do resto do set).

import * as THREE from 'three';
import { RNG } from '../../../core/rng.js';
import { drawHandwriting, handwritingWidth } from '../../../clay/set/labelAtlas.js';
import { flagGeometry } from '../../../clay/set/stationeryGeometry.js';
import { decalMaterial } from '../../../clay/set/printMaterials.js';
import { DEG } from '../pieces.js';
import { constantAttribute, offset, tentFaces } from './common.js';

const HAND = '700 {px}px "Segoe Print", "Bradley Hand", "Comic Sans MS", "Chalkboard SE", cursive';
const PENCIL = '400 {px}px "Segoe Print", "Bradley Hand", "Comic Sans MS", cursive';
const STAMP = '900 {px}px "Arial Black", "Impact", "Helvetica Neue", sans-serif';
const PRINT = '700 {px}px "Helvetica Neue", Arial, sans-serif';
const KIND = Object.freeze({ ink: 0, paper: 1, graphite: 2 });

/** Salpica furinhos transparentes (tinta que falhou) na cobertura. */
function distress(g, x, y, w, h, rng, count, size) {
  g.save();
  g.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < count; i++) {
    g.globalAlpha = rng.float(0.4, 1);
    g.beginPath();
    g.arc(x + rng.float(0, w), y + rng.float(0, h), rng.float(0.3, 1) * size, 0, Math.PI * 2);
    g.fill();
  }
  g.restore();
}

/** Ícones das estampas de caixa (setas "para cima", taça "frágil", guarda-chuva "manter seco"), em branco na cobertura. */
function stampIcon(g, kind, cx, cy, s) {
  g.lineWidth = s * 0.12;
  g.lineCap = 'round';
  g.lineJoin = 'round';
  if (kind === 0) {
    for (const dx of [-0.32, 0.32]) {
      g.beginPath();
      g.moveTo(cx + dx * s, cy + 0.5 * s);
      g.lineTo(cx + dx * s, cy - 0.3 * s);
      g.stroke();
      g.beginPath();
      g.moveTo(cx + dx * s - 0.22 * s, cy - 0.12 * s);
      g.lineTo(cx + dx * s, cy - 0.5 * s);
      g.lineTo(cx + dx * s + 0.22 * s, cy - 0.12 * s);
      g.closePath();
      g.fill();
    }
  } else if (kind === 1) {
    g.beginPath();
    g.moveTo(cx - 0.3 * s, cy - 0.5 * s);
    g.lineTo(cx + 0.3 * s, cy - 0.5 * s);
    g.quadraticCurveTo(cx + 0.3 * s, cy - 0.02 * s, cx, cy + 0.05 * s);
    g.quadraticCurveTo(cx - 0.3 * s, cy - 0.02 * s, cx - 0.3 * s, cy - 0.5 * s);
    g.fill();
    g.beginPath();
    g.moveTo(cx, cy + 0.05 * s);
    g.lineTo(cx, cy + 0.42 * s);
    g.moveTo(cx - 0.18 * s, cy + 0.45 * s);
    g.lineTo(cx + 0.18 * s, cy + 0.45 * s);
    g.stroke();
  } else {
    g.beginPath();
    g.arc(cx, cy - 0.05 * s, 0.42 * s, Math.PI, 0);
    g.closePath();
    g.fill();
    g.beginPath();
    g.moveTo(cx, cy - 0.05 * s);
    g.lineTo(cx, cy + 0.38 * s);
    g.arc(cx - 0.08 * s, cy + 0.38 * s, 0.08 * s, 0, Math.PI);
    g.stroke();
    for (const [dx, dy] of [[-0.45, -0.62], [0.05, -0.72], [0.42, -0.6]]) {
      g.beginPath();
      g.moveTo(cx + dx * s, cy + dy * s);
      g.lineTo(cx + (dx - 0.05) * s, cy + (dy + 0.12) * s);
      g.stroke();
    }
  }
}

/** Texto centrado em (cx, cy) que cabe em `maxW`. */
function fitText(g, text, font, px, cx, cy, maxW) {
  g.font = font.replace('{px}', String(px));
  const w = g.measureText(text).width;
  const k = Math.min(1, maxW / Math.max(w, 1));
  g.font = font.replace('{px}', String(Math.max(6, Math.floor(px * k))));
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text, cx, cy);
}

/** Tamanho do transferidor de uma cunha: raio (até 82% da cunha, no máximo 110 u) e altura do papel. */
function protractorSize(d) {
  const radius = Math.min(d.length * 0.82, 110);
  return { radius, height: radius * Math.sin(Math.min(d.deg + 4, 88) * DEG) + 4 };
}

/**
 * Receitas das células: `size` em u (o decalque), densidade em px/u, tipo de acabamento e o desenho em (cor, cobertura)
 * no retângulo (x, y, w, h) em px.
 */
function recipes(layout, data) {
  const cells = new Map();
  const add = (name, size, density, kind, draw) => {
    if (!cells.has(name)) cells.set(name, { name, size, density, kind, draw });
  };
  const stripes = new Map(data.wallJump.well.stripes.map((s) => [s.number, s]));
  for (const d of layout.decor) {
    if (d.kind !== 'ink') continue;
    const [kindName, arg] = [d.cell.split('-')[0], d.cell.split('-').slice(1).join('-')];
    if (kindName === 'estampa') {
      const k = Number(arg);
      add(d.cell, d.size, 2.4, KIND.ink, (col, cov, x, y, w, h, rng) => {
        col.fillStyle = '#5B2A22';
        col.fillRect(x, y, w, h);
        cov.fillStyle = '#fff';
        cov.strokeStyle = '#fff';
        cov.lineWidth = h * 0.035;
        cov.strokeRect(x + h * 0.05, y + h * 0.05, w - h * 0.1, h - h * 0.1);
        stampIcon(cov, k, x + h * 0.55, y + h * 0.5, h * 0.62);
        cov.textAlign = 'left';
        const text = data.fence.stamps[k];
        const words = text.split(' ');
        const lines = words.length > 2 ? [words.slice(0, 2).join(' '), words.slice(2).join(' ')] : [text];
        lines.forEach((line, i) => {
          const px = Math.round(h * (lines.length > 1 ? 0.26 : 0.36));
          cov.font = STAMP.replace('{px}', String(px));
          const lw = cov.measureText(line).width;
          const room = w - h * 1.15;
          const sx = Math.min(1, room / lw);
          cov.save();
          cov.translate(x + h * 1.02, y + h * (lines.length > 1 ? 0.37 + i * 0.3 : 0.52));
          cov.scale(sx, 1);
          cov.textBaseline = 'middle';
          cov.fillText(line, 0, 0);
          cov.restore();
        });
        distress(cov, x, y, w, h, rng, 520, h * 0.02);
      });
    } else if (kindName === 'estencil') {
      add(d.cell, d.size, 3.2, KIND.ink, (col, cov, x, y, w, h, rng) => {
        col.fillStyle = '#1D1A18';
        col.fillRect(x, y, w, h);
        cov.fillStyle = '#fff';
        const px = Math.round(h * 0.9);
        cov.font = STAMP.replace('{px}', String(px));
        cov.textAlign = 'center';
        cov.textBaseline = 'middle';
        const cx = x + w / 2;
        const cy = y + h / 2 + h * 0.04;
        cov.fillText(arg, cx, cy);
        // Pontes do estêncil: fendas verticais no meio de cada algarismo (em cima e embaixo).
        const tw = cov.measureText(arg).width;
        cov.save();
        cov.globalCompositeOperation = 'destination-out';
        [...arg].forEach((_, i) => {
          const gx = cx - tw / 2 + (tw / arg.length) * (i + 0.5);
          cov.fillRect(gx - px * 0.035, cy - px * 0.34, px * 0.07, px * 0.22);
          cov.fillRect(gx - px * 0.035, cy + px * 0.12, px * 0.07, px * 0.22);
        });
        cov.restore();
        // Névoa do spray em volta das letras.
        cov.globalAlpha = 1;
        for (let i = 0; i < 700; i++) {
          const a = rng.float(0, Math.PI * 2);
          const r = rng.float(0.28, 0.62) * w;
          cov.beginPath();
          cov.arc(cx + Math.cos(a) * r * 0.9, cy + Math.sin(a) * r * 0.45, rng.float(0.4, 1.1), 0, Math.PI * 2);
          if (rng.bool(0.35)) cov.fill();
        }
        distress(cov, x, y, w, h, rng, 120, h * 0.015);
      });
    } else if (kindName === 'faixa') {
      const s = stripes.get(Number(arg));
      add(d.cell, d.size, 2.5, KIND.ink, (col, cov, x, y, w, h, rng) => {
        col.fillStyle = s.color;
        col.fillRect(x, y, w, h);
        // Pinceladas: faixa com as bordas irregulares do rolinho.
        cov.fillStyle = '#fff';
        cov.beginPath();
        cov.moveTo(x + 4, y + h * 0.1);
        for (let i = 0; i <= 24; i++) cov.lineTo(x + 4 + ((w - 8) * i) / 24, y + h * 0.08 + rng.float(-1, 1) * h * 0.04);
        for (let i = 24; i >= 0; i--) cov.lineTo(x + 4 + ((w - 8) * i) / 24, y + h * 0.92 + rng.float(-1, 1) * h * 0.04);
        cov.closePath();
        cov.fill();
        distress(cov, x, y, w, h, rng, 60, h * 0.015);
        const light = s.color.toUpperCase() === '#F4C542';
        col.fillStyle = light ? '#1D1A18' : '#F4EDE1';
        col.font = STAMP.replace('{px}', String(Math.round(h * 0.7)));
        col.textAlign = 'center';
        col.textBaseline = 'middle';
        col.fillText(String(s.number), x + w / 2, y + h / 2 + h * 0.03);
      });
    } else if (kindName === 'alvo') {
      add(d.cell, d.size, 1.8, KIND.ink, (col, cov, x, y, w, h, rng) => {
        const cx = x + w / 2;
        const cy = y + h / 2;
        const R = w / 2 - 1;
        const rings = data.tower.target.rings;
        for (let i = 0; i <= rings; i++) {
          col.fillStyle = i % 2 === 0 ? '#C8261E' : '#EFE6D2';
          col.beginPath();
          col.arc(cx, cy, R * (1 - i / (rings + 1)), 0, Math.PI * 2);
          col.fill();
        }
        col.fillStyle = '#1D1A18';
        col.strokeStyle = '#EFE6D2';
        col.lineWidth = w * 0.02;
        col.font = STAMP.replace('{px}', String(Math.round(w * 0.16)));
        col.textAlign = 'center';
        col.textBaseline = 'middle';
        col.strokeText(arg, cx, cy);
        col.fillText(arg, cx, cy);
        cov.fillStyle = '#fff';
        cov.beginPath();
        for (let i = 0; i <= 64; i++) {
          const a = (i / 64) * Math.PI * 2;
          const r = R * (1 + rng.float(-0.012, 0.012));
          cov.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
        }
        cov.fill();
        distress(cov, x, y, w, h, rng, 90, w * 0.006);
      });
    } else if (kindName === 'nota') {
      add(d.cell, d.size, 5, KIND.graphite, (col, cov, x, y, w, h, rng) => {
        col.fillStyle = '#44454A';
        col.fillRect(x, y, w, h);
        cov.fillStyle = '#fff';
        cov.strokeStyle = '#fff';
        const size = h * 0.78;
        const nat = handwritingWidth(cov, d.text, PENCIL, Math.round(size));
        const fit = Math.min(1, (w - h * 0.4) / Math.max(nat, 1));
        drawHandwriting(cov, d.text, { x: x + h * 0.2, baseline: y + h * 0.78, size: size * fit, font: PENCIL, rng, stroke: 0.02 });
        distress(cov, x, y, w, h, rng, Math.round(w * 0.6), h * 0.03);
      });
    } else if (kindName === 'risco') {
      add(d.cell, d.size, 5, KIND.graphite, (col, cov, x, y, w, h, rng) => {
        col.fillStyle = '#44454A';
        col.fillRect(x, y, w, h);
        cov.strokeStyle = '#fff';
        cov.lineCap = 'round';
        cov.beginPath();
        for (let i = 0; i <= 20; i++) cov.lineTo(x + 3 + ((w - 6) * i) / 20, y + h / 2 + rng.float(-0.12, 0.12) * h);
        cov.lineWidth = h * 0.55;
        cov.stroke();
        distress(cov, x, y, w, h, rng, Math.round(w * 0.4), h * 0.12);
      });
    }
  }
  // Transferidores de papel colados nas cunhas: setor até pouco abaixo da rampa, escala em graus e o ângulo a lápis.
  for (const d of layout.decor) {
    if (d.kind !== 'protractor') continue;
    const { radius: R, height: H } = protractorSize(d);
    add(`transferidor-${d.deg}`, [R, H], 3, KIND.paper, (col, cov, x, y, w, h, rng) => {
      const s = w / R;
      const ox = x + 2;
      const oy = y + h - 2;
      col.fillStyle = '#F2EEE3';
      col.fillRect(x, y, w, h);
      const rr = (R - 3) * s;
      col.strokeStyle = '#2F4C74';
      col.fillStyle = '#2F4C74';
      col.lineWidth = s * 0.35;
      col.beginPath();
      col.arc(ox, oy, rr, -d.deg * DEG, 0);
      col.stroke();
      for (let a = 0; a <= d.deg; a++) {
        const len = a % 10 === 0 ? 9 : a % 5 === 0 ? 6 : 3.5;
        const c = Math.cos(a * DEG);
        const sn = Math.sin(a * DEG);
        col.beginPath();
        col.moveTo(ox + c * rr, oy - sn * rr);
        col.lineTo(ox + c * (rr - len * s), oy - sn * (rr - len * s));
        col.stroke();
        if (a % 10 === 0 && a > 0) {
          col.font = PRINT.replace('{px}', String(Math.round(5 * s)));
          col.textAlign = 'center';
          col.textBaseline = 'middle';
          col.fillText(String(a), ox + c * (rr - 15 * s), oy - sn * (rr - 15 * s));
        }
      }
      // A lápis: a linha da rampa desde o centro, o arco do ângulo e o número.
      col.strokeStyle = '#4B4C50';
      col.lineWidth = s * 0.6;
      col.beginPath();
      col.moveTo(ox, oy);
      col.lineTo(ox + Math.cos(d.deg * DEG) * rr, oy - Math.sin(d.deg * DEG) * rr);
      col.stroke();
      col.beginPath();
      col.arc(ox, oy, rr * 0.34, -d.deg * DEG, 0);
      col.stroke();
      col.fillStyle = '#4B4C50';
      drawHandwriting(col, `${d.deg}°`, { x: ox + rr * 0.38, baseline: oy - rr * 0.05 - 3 * s, size: 9 * s, font: PENCIL, rng, stroke: 0.02 });
      // Papel recortado à mão: setor um pouco abaixo da rampa.
      cov.fillStyle = '#fff';
      cov.beginPath();
      cov.moveTo(ox - 2, oy + 2);
      const top = Math.max(d.deg - 1.2, 1);
      for (let i = 0; i <= 32; i++) {
        const a = (i / 32) * top * DEG;
        const r = R * s * (1 + rng.float(-0.006, 0.006));
        cov.lineTo(ox + Math.cos(a) * r, oy - Math.sin(a) * r);
      }
      cov.closePath();
      cov.fill();
    });
  }
  const flag = layout.decor.find((d) => d.kind === 'flag');
  if (flag) {
    add('bandeira', [42, 28], 6, KIND.paper, (col, cov, x, y, w, h) => {
      col.fillStyle = '#F4F1E8';
      col.fillRect(x, y, w, h);
      col.fillStyle = '#18171A';
      const n = 6;
      const m = 4;
      for (let i = 0; i < n; i++) for (let j = 0; j < m; j++) if ((i + j) % 2 === 0) col.fillRect(x + (w * i) / n, y + (h * j) / m, w / n, h / m);
      cov.fillStyle = '#fff';
      cov.fillRect(x, y, w, h);
    });
  }
  // Plaquinhas em "A": marcador no cartão (número grande e o nome do lote; ou a nota em duas linhas).
  for (const p of layout.pieces) {
    if (p.look.kind !== 'tentCard') continue;
    const [first, rest] = p.look.number ? [String(p.look.number), p.look.text.split(' · ').slice(1).join(' · ')] : p.look.text.split(' · ');
    const face = tentFaces(p.size)[0];
    const size = [face.width - 16, face.slope - 12];
    add(`placa-${p.id}`, size, 3, KIND.ink, (col, cov, x, y, w, h, rng) => {
      col.fillStyle = '#1C2238';
      col.fillRect(x, y, w, h);
      cov.fillStyle = '#fff';
      cov.strokeStyle = '#fff';
      const big = h * 0.5;
      const bw = handwritingWidth(cov, first, HAND, Math.round(big));
      drawHandwriting(cov, first, { x: x + (w - Math.min(bw, w * 0.9)) / 2, baseline: y + h * 0.52, size: big * Math.min(1, (w * 0.9) / bw), font: HAND, rng });
      if (rest) {
        const small = h * 0.3;
        const sw = handwritingWidth(cov, rest, HAND, Math.round(small));
        const k = Math.min(1, (w * 0.94) / sw);
        drawHandwriting(cov, rest, { x: x + (w - sw * k) / 2, baseline: y + h * 0.9, size: small * k, font: HAND, rng });
      }
    });
  }
  // Etiqueta impressa da caixa de arquivo, preenchida à mão.
  const archive = layout.pieces.find((p) => p.look.kind === 'archiveBox');
  if (archive) {
    add('arquivo', data.look.archive.label, 3, KIND.paper, (col, cov, x, y, w, h, rng) => {
      col.fillStyle = '#EFE9DC';
      col.fillRect(x, y, w, h);
      col.fillStyle = '#1D1A18';
      col.strokeStyle = '#1D1A18';
      col.lineWidth = h * 0.012;
      col.strokeRect(x + h * 0.05, y + h * 0.05, w - h * 0.1, h - h * 0.1);
      fitText(col, 'ARQUIVO', PRINT, Math.round(h * 0.16), x + w / 2, y + h * 0.18, w * 0.8);
      for (let i = 0; i < 3; i++) {
        col.beginPath();
        col.moveTo(x + w * 0.1, y + h * (0.48 + i * 0.18));
        col.lineTo(x + w * 0.9, y + h * (0.48 + i * 0.18));
        col.stroke();
      }
      col.fillStyle = '#23336B';
      drawHandwriting(col, 'rampas', { x: x + w * 0.12, baseline: y + h * 0.45, size: h * 0.15, font: HAND, rng, stroke: 0.05 });
      const degs = data.ramps.wedges.map((wd) => `${wd.deg}°`).join(' · ');
      drawHandwriting(col, degs, { x: x + w * 0.12, baseline: y + h * 0.63, size: h * 0.11, font: HAND, rng, stroke: 0.05 });
      cov.fillStyle = '#fff';
      cov.fillRect(x + 1, y + 1, w - 2, h - 2);
    });
  }
  return [...cells.values()];
}

/** Desenha e empacota as células em prateleiras; devolve a textura e o retângulo (u0, v0, largura, altura) de cada uma. */
function bakeAtlas(cells, { width = 2048, anisotropy = 8, seed = 'pista-arte' } = {}) {
  const pad = 4;
  const sized = cells.map((c) => ({ ...c, w: Math.ceil(c.size[0] * c.density), h: Math.ceil(c.size[1] * c.density) }));
  const order = [...sized.keys()].sort((a, b) => sized[b].h - sized[a].h);
  let x = pad;
  let y = pad;
  let rowH = 0;
  for (const i of order) {
    const c = sized[i];
    if (c.w > width - 2 * pad) throw new Error(`célula larga demais no atlas da pista: ${c.name}`);
    if (x + c.w + pad > width) {
      x = pad;
      y += rowH + pad;
      rowH = 0;
    }
    c.x = x;
    c.y = y;
    x += c.w + pad;
    rowH = Math.max(rowH, c.h);
  }
  const height = 2 ** Math.ceil(Math.log2(y + rowH + pad));
  const canvas = (fill) => {
    const cv = document.createElement('canvas');
    cv.width = width;
    cv.height = height;
    const g = cv.getContext('2d');
    if (fill) {
      g.fillStyle = fill;
      g.fillRect(0, 0, width, height);
    }
    return { cv, g };
  };
  const color = canvas('#808080');
  const cover = canvas(null);
  for (const c of sized) {
    const rng = new RNG(`${seed}:${c.name}`);
    for (const g of [color.g, cover.g]) {
      g.save();
      g.beginPath();
      g.rect(c.x, c.y, c.w, c.h);
      g.clip();
    }
    c.draw(color.g, cover.g, c.x, c.y, c.w, c.h, rng);
    color.g.restore();
    cover.g.restore();
  }
  const rgb = color.g.getImageData(0, 0, width, height).data;
  const alpha = cover.g.getImageData(0, 0, width, height).data;
  const data = new Uint8Array(width * height * 4);
  for (let row = 0; row < height; row++) {
    const src = row * width * 4;
    const dst = (height - 1 - row) * width * 4;
    for (let i = 0; i < width * 4; i += 4) {
      data[dst + i] = rgb[src + i];
      data[dst + i + 1] = rgb[src + i + 1];
      data[dst + i + 2] = rgb[src + i + 2];
      data[dst + i + 3] = alpha[src + i + 3];
    }
  }
  color.cv.width = color.cv.height = 0;
  cover.cv.width = cover.cv.height = 0;
  const texture = new THREE.DataTexture(data, width, height, THREE.RGBAFormat, THREE.UnsignedByteType);
  texture.name = 'massacre.pista.arte';
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.generateMipmaps = true;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.anisotropy = anisotropy;
  texture.needsUpdate = true;
  const rects = new Map(sized.map((c) => [c.name, { rect: [c.x / width, 1 - (c.y + c.h) / height, c.w / width, c.h / height], kind: c.kind }]));
  return { texture, rects };
}

/** Quadrado de decalque [w, h] no plano XY (normal +Z) com os atributos da célula. */
function decalQuad(w, h, cell, cx = 0, cy = 0) {
  const geo = new THREE.PlaneGeometry(w, h).translate(cx, cy, 0);
  constantAttribute(geo, 'aDecalRect', cell.rect);
  return constantAttribute(geo, 'aDecalKind', [cell.kind]);
}

/** Monta o atlas da arte, o lote `decal` (material adotado pela biblioteca do set) e os decalques. */
export function buildArt(ctx) {
  const { layout, data, set, batches, disposers, anisotropy } = ctx;
  const { texture, rects } = bakeAtlas(recipes(layout, data), { anisotropy });
  disposers.push(() => texture.dispose());
  batches.define('decal', { material: set.adopt('pista-arte', decalMaterial(set.textures, { atlas: texture, name: 'arte-pista' })), castShadow: false });
  const cell = (name) => {
    const c = rects.get(name);
    if (!c) throw new Error(`célula de arte desconhecida na pista: ${name}`);
    return c;
  };
  let count = 0;
  const put = (geo, matrix) => {
    batches.add('decal', geo, matrix);
    count++;
  };
  for (const d of layout.decor) {
    if (d.kind === 'ink') put(decalQuad(d.size[0], d.size[1], cell(d.cell)), d.matrix);
    else if (d.kind === 'protractor') {
      const { radius, height } = protractorSize(d);
      put(decalQuad(radius, height, cell(`transferidor-${d.deg}`), radius / 2, height / 2), d.matrix);
    }
    else if (d.kind === 'flag') {
      const paper = flagGeometry({ stick: d.stick, seed: d.seed }).paper;
      const c = cell('bandeira');
      constantAttribute(paper, 'aDecalRect', c.rect);
      put(constantAttribute(paper, 'aDecalKind', [c.kind]), d.matrix);
    }
  }
  for (const p of layout.pieces) {
    if (p.look.kind === 'tentCard') {
      const c = cell(`placa-${p.id}`);
      for (const f of tentFaces(p.size)) {
        put(decalQuad(f.width - 16, f.slope - 12, c, 0, -1), p.matrix.clone().multiply(f.matrix).multiply(offset(0, 0, 0.06)));
      }
    } else if (p.look.kind === 'archiveBox') {
      const [, , d] = p.size;
      const A = data.look.archive;
      const local = offset(-p.size[0] * 0.22, -8, d / 2 - A.wall + 0.08);
      put(decalQuad(A.label[0], A.label[1], cell('arquivo')), p.matrix.clone().multiply(local));
    }
  }
  return { count };
}
