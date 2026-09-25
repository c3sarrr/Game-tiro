// Atlas de texto das etiquetas de fita crepe (vitrine, depois placas e letreiros de mapa): cada etiqueta é uma
// linha escrita "à mão" com caneta — letra a letra, com leve giro, variação de linha de base e de tamanho, como
// no rótulo feito com fita e marcador na bancada do animador (SSD2, SSD14). Gerado em canvas no carregamento
// (fonte do sistema como base; nada é baixado). O material que lê o atlas é tapeLabelMaterial (paperMaterials.js).

import * as THREE from 'three';
import { RNG } from '../../core/rng.js';

/**
 * Layout puro (sem DOM): células de altura fixa em `columns` colunas, linha a linha, dentro de `width` px.
 * @param {number} count número de etiquetas
 * @param {{width:number, cellHeight:number, columns:number}} opts
 * @returns {{width:number, height:number, cells:Array<{x:number, y:number, w:number, h:number}>}} altura em
 *   potência de dois (mipmaps completos) e células em px com a origem no canto de cima do canvas
 */
export function layoutLabelCells(count, { width, cellHeight, columns }) {
  if (!(count >= 0 && Number.isInteger(count))) throw new Error(`número de etiquetas inválido: ${count}`);
  if (!(columns >= 1 && width >= columns && cellHeight >= 1)) throw new Error('layout de etiquetas inválido');
  const cellW = Math.floor(width / columns);
  const rows = Math.max(1, Math.ceil(count / columns));
  const needed = rows * cellHeight;
  const height = 2 ** Math.ceil(Math.log2(Math.max(needed, 1)));
  const cells = [];
  for (let i = 0; i < count; i++) {
    const col = i % columns;
    const row = Math.floor(i / columns);
    cells.push({ x: col * cellW, y: row * cellHeight, w: cellW, h: cellHeight });
  }
  return { width, height, cells };
}

/**
 * Retângulo da parte escrita de uma célula em coordenadas de textura (0..1, com flipY do CanvasTexture: v = 0
 * embaixo). `textWidth` em px (a largura realmente ocupada pelo texto, a partir da borda esquerda da célula).
 * @returns {[number, number, number, number]} u0, v0, largura, altura
 */
export function labelRect(cell, textWidth, atlasWidth, atlasHeight) {
  const w = Math.min(textWidth, cell.w);
  return [cell.x / atlasWidth, 1 - (cell.y + cell.h) / atlasHeight, w / atlasWidth, cell.h / atlasHeight];
}

/**
 * Escreve `text` "à mão" num contexto 2D: letra a letra, com giro, variação de linha de base, de tamanho e de
 * espaçamento, e o traço engrossado de caneta de ponta redonda (contorno + preenchimento). `font` com "{px}" no lugar
 * do tamanho. Usa a cor/estilo atuais do contexto. Devolve o x depois da última letra.
 * @param {CanvasRenderingContext2D} g
 * @param {{x:number, baseline:number, size:number, font:string, rng:RNG, stroke?:number, wobble?:number}} opts
 */
export function drawHandwriting(g, text, { x, baseline, size, font, rng, stroke = 0.085, wobble = 1 }) {
  let cx = x;
  g.save();
  g.textAlign = 'left';
  g.textBaseline = 'alphabetic';
  g.lineJoin = 'round';
  g.lineCap = 'round';
  for (const ch of text) {
    const s = size * rng.float(1 - 0.07 * wobble, 1 + 0.07 * wobble);
    g.font = font.replace('{px}', String(Math.round(s)));
    const adv = g.measureText(ch).width;
    g.save();
    g.translate(cx + adv / 2, baseline + rng.float(-0.035, 0.035) * wobble * size);
    g.rotate(rng.float(-0.06, 0.06) * wobble);
    g.globalAlpha = rng.float(0.9, 1);
    g.lineWidth = s * stroke;
    if (stroke > 0) g.strokeText(ch, -adv / 2, 0);
    g.fillText(ch, -adv / 2, 0);
    g.restore();
    cx += adv * rng.float(0.98, 1.04);
  }
  g.restore();
  return cx;
}

/** Largura natural (sem tremor) de `text` na fonte `font` de tamanho `px`, com folga de 4%. */
export function handwritingWidth(g, text, font, px) {
  g.font = font.replace('{px}', String(px));
  return [...text].reduce((w, ch) => w + g.measureText(ch).width, 0) * 1.04;
}

/**
 * Desenha as etiquetas e devolve o atlas.
 * @param {string[]} texts
 * @param {{width:number, cellHeight:number, columns:number, font:string, seed?:string, anisotropy?:number}} opts
 *   `font` com "{px}" no lugar do tamanho (ex.: '700 {px}px "Segoe Print", cursive')
 * @returns {{texture: THREE.CanvasTexture, labels: Array<{text:string, rect:number[], aspect:number}>, dispose(): void}}
 *   `aspect` = largura/altura da parte escrita (a tira da etiqueta usa para calcular o comprimento)
 */
export function bakeLabelAtlas(texts, { width, cellHeight, columns, font, seed = 'etiquetas', anisotropy = 8 }) {
  const layout = layoutLabelCells(texts.length, { width, cellHeight, columns });
  const canvas = document.createElement('canvas');
  canvas.width = layout.width;
  canvas.height = layout.height;
  const g = canvas.getContext('2d');
  g.clearRect(0, 0, canvas.width, canvas.height);
  g.fillStyle = '#ffffff';
  g.strokeStyle = '#ffffff';
  g.lineJoin = 'round';
  g.lineCap = 'round';
  g.textBaseline = 'alphabetic';
  const px = Math.round(cellHeight * 0.66);
  const baseFont = font.replace('{px}', String(px));
  g.font = baseFont;
  const labels = texts.map((text, i) => {
    const cell = layout.cells[i];
    const rng = new RNG(`${seed}:${i}:${text}`);
    // Medida sem jitter para decidir a escala (texto longo encolhe para caber na célula, com folga de 4%).
    const natural = handwritingWidth(g, text, font, px) + px * 0.2;
    const fit = Math.min(1, (cell.w - 8) / Math.max(natural, 1));
    const size = Math.max(10, Math.round(px * fit));
    const baseline = cell.y + cell.h * 0.74;
    // Caneta permanente de ponta redonda: o traço da fonte engrossa com um contorno redondo (a tinta espalha no crepe)
    // e a pressão varia um pouco de letra para letra.
    const x = drawHandwriting(g, text, { x: cell.x + size * 0.12, baseline, size, font, rng });
    const textWidth = Math.min(cell.w, x - cell.x + size * 0.12);
    return { text, rect: labelRect(cell, textWidth, layout.width, layout.height), aspect: textWidth / cell.h };
  });
  const texture = new THREE.CanvasTexture(canvas);
  texture.name = 'massacre.set.etiquetas';
  texture.colorSpace = THREE.NoColorSpace; // só o alfa (cobertura da tinta) é lido
  texture.anisotropy = anisotropy;
  texture.generateMipmaps = true;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.needsUpdate = true;
  return {
    texture,
    labels,
    dispose() {
      texture.dispose();
      canvas.width = canvas.height = 0;
    },
  };
}
