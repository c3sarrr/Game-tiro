// Estação 7 da pista de testes: a torre de queda. Tubo de papelão grosso com uma escada em espiral de 78 livros
// encaixados nele (BAS1/BAS4/BAS9), um por degrau, 18° à frente do de baixo no sentido horário, em cinco trechos de
// espessura própria para que cada marca de queda caia exata; pranchas de compensado apoiadas nos livros das marcas,
// giradas para trás; alvos pintados no chão; tábua de crescimento com as alturas e o dano de queda de cada uma
// (WRG1/WRG4/WRG11). Puro: só dados.

import * as THREE from 'three';
import { basisMatrix, floorDecalMatrix, headingDir, wallDecalMatrix, yawMatrix } from './pieces.js';
import { bookLook } from './layoutGround.js';

/** Ponto [x, z] a `r` do eixo no rumo `h`. */
function polar(axis, r, h) {
  const [dx, dz] = headingDir(h);
  return [axis[0] + dx * r, axis[1] + dz * r];
}

/**
 * Espiral: livro k no rumo firstHeading + stepDeg·k, de y0 a y1 (espessura do trecho). O último livro de cada trecho
 * fecha exatamente no topo do trecho. Devolve os livros e as marcas (topo do trecho + prancha).
 */
export function spiralBooks(T) {
  const books = [];
  const marks = [];
  let start = 0;
  let k = 0;
  for (const seg of T.segments) {
    const t = (seg.top - start) / seg.books;
    for (let i = 0; i < seg.books; i++, k++) {
      const y0 = start + i * t;
      const y1 = i === seg.books - 1 ? seg.top : start + (i + 1) * t;
      books.push({ index: k, heading: (T.firstHeading + T.stepDeg * k) % 360, y0, y1 });
    }
    const last = books[books.length - 1];
    marks.push({
      book: last.index, bookTop: seg.top, height: seg.top + T.plank.thickness,
      heading: (last.heading - T.plank.backDeg + 360) % 360,
    });
    start = seg.top;
  }
  return { books, marks };
}

export function layoutTower({ data, L, rng }) {
  const T = data.tower;
  const n = 7;
  const axis = T.axis;
  L.add({
    id: 'torre-tubo', station: n, shape: 'cylinder', size: [T.tube.radius, T.tube.height], surface: 'papelao',
    matrix: new THREE.Matrix4().makeTranslation(axis[0], 0, axis[1]),
    look: { kind: 'tube', radius: T.tube.radius, wall: T.tube.wall, height: T.tube.height },
  });
  const { books, marks } = spiralBooks(T);
  const rc = T.book.inner + T.book.length / 2;
  const r = rng('torre-livros');
  for (const b of books) {
    const [cx, cz] = polar(axis, rc, b.heading);
    // Livro deitado com o comprimento no raio e a lombada no lado anti-horário (o espelho do degrau para quem sobe):
    // no quadro canônico do livro a lombada fica em +Z, e o yaw de rumo + 90 põe o +Z no rumo − 90.
    L.add({
      id: `torre-livro-${b.index}`, station: n, shape: 'box', size: [T.book.length, b.y1 - b.y0, T.book.width],
      matrix: yawMatrix(cx, (b.y0 + b.y1) / 2, cz, b.heading + 90), surface: 'papelao', look: bookLook(data, r),
    });
  }
  const P = T.plank;
  const plankLen = P.to - P.from;
  for (const m of marks) {
    const [cx, cz] = polar(axis, (P.from + P.to) / 2, m.heading);
    L.add({
      id: `torre-prancha-${m.height}`, station: n, shape: 'box', size: [P.width, P.thickness, plankLen],
      matrix: yawMatrix(cx, m.bookTop + P.thickness / 2, cz, m.heading), surface: 'madeira', look: { kind: 'plywood' },
    });
    const [tx, tz] = polar(axis, T.target.at, m.heading);
    L.addDecor({
      id: `torre-alvo-${m.height}`, station: n, kind: 'ink', cell: `alvo-${m.height}`,
      size: [T.target.radius * 2, T.target.radius * 2], matrix: floorDecalMatrix(tx, 0.05, tz, m.heading),
    });
  }
  // Tábua de crescimento em pé, voltada para fora: numerais a cada 100 u e traços a cada 10 u (measureMaterials) e, em
  // cada anotação, o risco a lápis atravessado e o texto à mão escrito ao longo da tábua (de baixo para cima, terminando
  // no risco; com `up`, começando nele), na metade direita — a tábua é estreita como uma régua de parede.
  const G = T.growth;
  const [gx, gz] = polar(axis, G.at, G.heading);
  L.add({
    id: 'torre-regua', station: n, shape: 'box', size: G.size, surface: 'madeira',
    matrix: yawMatrix(gx, G.size[1] / 2, gz, G.heading + 180), look: { kind: 'growth', size: G.size },
  });
  const [nx, nz] = headingDir(G.heading);
  // À direita de quem olha a tábua de fora (olhando para o rumo + 180°). A nota tem X local para cima e Y local para a
  // esquerda dessa pessoa: a normal (X × Y) sai para fora, como a do risco, e o texto lê de baixo para cima.
  const [rx, rz] = headingDir(G.heading - 90);
  const front = G.size[2] / 2 + 0.08;
  const fx = gx + nx * front;
  const fz = gz + nz * front;
  for (const { at: y, text, up = false } of G.notes) {
    L.addDecor({
      id: `torre-risco-${y}`, station: n, kind: 'ink', cell: 'risco', size: [G.size[0] + 6, 3],
      matrix: wallDecalMatrix(fx, y, fz, G.heading),
    });
    const len = G.noteHeight * 0.62 * text.length + 8;
    const side = G.size[0] * 0.22;
    L.addDecor({
      id: `torre-nota-${y}`, station: n, kind: 'ink', cell: `nota-${y}`, text, size: [len, G.noteHeight],
      matrix: basisMatrix([fx + rx * side + nx * 0.02, up ? y + 4 + len / 2 : y - 4 - len / 2, fz + rz * side + nz * 0.02], [0, 1, 0], [-rx, 0, -rz]),
    });
  }
  return {
    axis, books, marks,
    /** Ponto de teleporte na prancha de altura `height` (olhando para fora, para o alvo). */
    plankSpot(height) {
      const m = marks.find((mk) => mk.height === height);
      if (!m) throw new Error(`prancha desconhecida na torre: ${height}`);
      const [x, z] = polar(axis, T.spot.at, m.heading);
      return { x, z, heading: m.heading, pitch: T.spot.pitch, below: height + 60 };
    },
    /** Pé da espiral: antes do primeiro livro, olhando no sentido da subida (horário). */
    spiralSpot() {
      const h = T.firstHeading - T.spot.spiralBefore;
      const [x, z] = polar(axis, T.spot.spiralAt, h);
      return { x, z, heading: (h + 90) % 360, pitch: -4 };
    },
  };
}
