// Estações 1–4 da pista de testes (movimento no chão): counter-strafe no papel quadriculado, escadas de livros,
// rampas de papelão e caixas de faia nos limites do pulo. Números em src/data/pista.js; referências no item 11 do
// moodboard (COC5/PKC12 estações, LDB9 grade, BAS7/BAS11/BAS15 livros como degraus, CFO8/CFR7 cunhas, AWB1/AWB17
// blocos de faia). Puro: só dados (peças e enfeites).

import { DEG, floorDecalMatrix, floorStripMatrix, wallDecalMatrix, yawMatrix } from './pieces.js';

/** Fitas crepe prendendo uma folha retangular: diagonais nos cantos e atravessadas no meio das bordas. */
export function sheetTapes(L, id, station, [x0, x1], [z0, z1], y, { length = 90, width = 19 } = {}) {
  const corners = [[x0, z0, 315], [x1, z0, 45], [x1, z1, 135], [x0, z1, 225]];
  corners.forEach(([x, z, h], i) => {
    L.addDecor({ id: `${id}-fita-canto-${i}`, station, kind: 'tape', matrix: floorStripMatrix(x, y, z, h), length, width });
  });
  const mids = [[(x0 + x1) / 2, z0, 0], [x1, (z0 + z1) / 2, 90], [(x0 + x1) / 2, z1, 180], [x0, (z0 + z1) / 2, 270]];
  mids.forEach(([x, z, h], i) => {
    L.addDecor({ id: `${id}-fita-meio-${i}`, station, kind: 'tape', matrix: floorStripMatrix(x, y + 0.05, z, h), length, width });
  });
}

/** 1 · Counter-strafe: folha de plotter com grade de 20/100 u, linha de strafe e dois pilares de peek. */
function strafe({ data, L, rng }) {
  const S = data.strafe;
  const g = data.floors.grade;
  const n = 1;
  L.bounds('strafe-papel', S.paper.x, [0, g.thickness], S.paper.z, {
    station: n, surface: g.surface,
    look: { kind: 'gridPaper', fine: S.fine, strong: S.strong, color: g.color, size: [S.paper.x[1] - S.paper.x[0], S.paper.z[1] - S.paper.z[0]] },
  });
  sheetTapes(L, 'strafe-papel', n, S.paper.x, S.paper.z, g.thickness + 0.1);
  const len = S.paper.x[1] - S.paper.x[0] - 60;
  L.addDecor({
    id: 'strafe-linha', station: n, kind: 'tape', matrix: floorStripMatrix(0, g.thickness + 0.2, S.line.z, 90),
    length: len, width: S.line.width, color: S.line.color,
  });
  const r = rng('strafe-pilares');
  S.pillars.forEach(({ at: [px, pz] }, i) => {
    for (let k = 0; k < S.pillarLayers; k++) {
      L.standing(`strafe-pilar-${i}-${k}`, px, k * S.pillarBlock[1], pz, S.pillarBlock, r.float(-1.2, 1.2), {
        station: n, surface: 'madeira', look: { kind: 'beech', radius: 3, tint: beechTint(r) },
      });
    }
  });
}

/** Variação de tom de um bloco de faia (multiplica o albedo da madeira). */
export function beechTint(r) {
  const v = r.float(0.9, 1.05);
  const w = r.float(-0.035, 0.035);
  return [v + w, v, v - w * 1.4];
}

/** Aparência de um livro: capa, título e o texto extra da lombada (altura do degrau). */
export function bookLook(data, r, text = '') {
  return { kind: 'book', color: r.pick(data.bookColors), title: r.pick(data.bookTitles), text };
}

/** 2 · Escadas: livro k da pilha com fundo 350 − 40k e largura 260 − 20k, costas alinhadas, lombada para o sul. */
function stairs({ data, L, rng, floorTop }) {
  const S = data.stairs;
  const n = 2;
  const y0 = floorTop(n);
  for (const p of S.piles) {
    const r = rng(`escadas-${p.step}`);
    for (let k = 0; k < S.books; k++) {
      const depth = S.depth0 - S.depthStep * k;
      const width = S.width0 - S.widthStep * k;
      const yb = y0 + k * p.step;
      L.bounds(`escadas-${p.step}-${k}`, [p.x - width / 2, p.x + width / 2], [yb, yb + p.step], [p.back, p.back + depth], {
        station: n, surface: 'papelao', look: bookLook(data, r, `${p.step} u`),
      });
    }
    if (p.note) {
      L.add({
        id: `escadas-${p.step}-placa`, station: n, shape: 'tent', size: [110, 50, 40], surface: 'papelao',
        matrix: yawMatrix(p.x - 70, y0, p.front + 55, 0), look: { kind: 'tentCard', text: p.note },
      });
    }
  }
}

/** 3 · Rampas: caixa de arquivo e cunhas que sobem para o norte até a frente dela (L = altura / tg θ). */
function ramps({ data, L, floorTop, lot }) {
  const R = data.ramps;
  const B = R.box;
  const n = 3;
  const y0 = floorTop(n);
  L.bounds('rampas-caixa', B.x, [y0, y0 + B.height], B.z, {
    station: n, surface: 'papelao', look: { kind: 'archiveBox', size: [B.x[1] - B.x[0], B.height, B.z[1] - B.z[0]] },
  });
  for (const w of R.wedges) {
    const len = B.height / Math.tan(w.deg * DEG);
    const foot = B.z[1] + len;
    // Rampa do ColliderBuilder girada 180° em Y: o +Z local (a subida) aponta para o norte; origem no pé.
    L.add({
      id: `rampas-${w.deg}`, station: n, shape: 'ramp', size: [R.width, B.height, len], surface: 'papelao',
      matrix: yawMatrix(w.x, y0, foot, 180), look: { kind: 'wedge', deg: w.deg },
    });
    // Transferidor de papel colado na lateral leste, com o centro no pé da cunha.
    L.addDecor({
      id: `rampas-${w.deg}-transferidor`, station: n, kind: 'protractor', deg: w.deg, length: len, height: B.height,
      matrix: wallDecalMatrix(w.x + R.width / 2 + 0.35, y0, foot, 90),
    });
    L.addDecor({
      id: `rampas-${w.deg}-etiqueta`, station: n, kind: 'label', text: w.note,
      matrix: floorDecalMatrix(w.x, y0 + 0.1, Math.min(foot + 30, lot(n).z[1] - 18), 0),
    });
  }
}

/** 4 · Caixas: blocos de faia de 128 × 128 com a altura em estêncil na face sul. */
function boxes({ data, L, rng, floorTop }) {
  const B = data.boxes;
  const n = 4;
  const y0 = floorTop(n);
  const r = rng('caixas');
  for (const row of B.rows) {
    row.heights.forEach((h, c) => {
      const [x0, x1] = B.columns[c];
      L.bounds(`caixas-${h}`, [x0, x1], [y0, y0 + h], row.z, {
        station: n, surface: 'madeira', look: { kind: 'beech', radius: B.radius, tint: beechTint(r) },
      });
      L.addDecor({
        id: `caixas-${h}-estencil`, station: n, kind: 'ink', cell: `estencil-${h}`, size: [78, 44],
        matrix: wallDecalMatrix((x0 + x1) / 2, y0 + h / 2, row.z[1] + 0.06, 180),
      });
    });
  }
}

export function layoutGroundStations(ctx) {
  strafe(ctx);
  stairs(ctx);
  ramps(ctx);
  boxes(ctx);
}
