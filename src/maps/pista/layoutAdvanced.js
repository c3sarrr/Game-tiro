// Estações 5 e 6 da pista de testes (números da 3.4): o poço de wall-jump de compensado com a saída por prancha até a
// torre de blocos (as três peças da parede sul formam uma parede só), o zigue-zague de painéis entre duas plataformas,
// a faixa de slide — linha de largada, marcas de distância e as traves de objetos de verdade (régua, lápis, régua de
// aço, espeto de bambu) juntas logo depois da linha, sobre apoios da altura exata — e o gabarito de portais com verga de
// régua. Referências: PKG3/PKG6/PKG11/PKC14 (poço e paredes numeradas), PKG19 (blocos), PRU1/PRU3/PRU15 (traves),
// CFO19 (palitos e etiquetas). Puro: só dados.

import * as THREE from 'three';
import { floorDecalMatrix, floorStripMatrix, wallDecalMatrix, yawMatrix, DEG } from './pieces.js';
import { beechTint, bookLook } from './layoutGround.js';

/** Pilha de blocos de faia que preenche a caixa [x0, x1] × [0, h] × [z0, z1] em `layers` camadas de nx × nz blocos. */
export function blockStack(L, id, station, [x0, x1], [z0, z1], y0, height, { layers, nx, nz, r, jitter = 1.5 }) {
  const bw = (x1 - x0) / nx;
  const bd = (z1 - z0) / nz;
  const bh = height / layers;
  for (let k = 0; k < layers; k++) {
    for (let i = 0; i < nx; i++) {
      for (let j = 0; j < nz; j++) {
        // Empilhado à mão: cada bloco um pouco fora do lugar e girado (dentro da caixa de colisão da pilha).
        const cx = x0 + bw * (i + 0.5) + r.float(-jitter, jitter) * 0.5;
        const cz = z0 + bd * (j + 0.5) + r.float(-jitter, jitter) * 0.5;
        L.standing(`${id}-bloco-${k}-${i}-${j}`, cx, y0 + k * bh, cz, [bw - jitter, bh, bd - jitter], r.float(-0.8, 0.8), {
          station, collide: false, look: { kind: 'beech', radius: 3, tint: beechTint(r) },
        });
      }
    }
  }
  return L.bounds(`${id}-colisao`, [x0, x1], [y0, y0 + height], [z0, z1], { station, surface: 'madeira' });
}

/**
 * 5 · Poço: quatro paredes de compensado de 8 u, porta na sul (as três peças da parede sul no grupo `W.part`: uma
 * parede só para o wall-jump), faixas numeradas por dentro, prancha até a torre.
 */
function well({ data, L, rng }) {
  const W = data.wallJump.well;
  const E = data.wallJump.exit;
  const n = 5;
  const t = W.wall;
  const H = W.height;
  const [ix0, ix1] = W.x;
  const [iz0, iz1] = W.z;
  const [ox0, ox1, oz0, oz1] = [ix0 - t, ix1 + t, iz0 - t, iz1 + t];
  const ply = (id, xr, yr, zr, axis, part = null) => L.board(id, xr, yr, zr, axis, {
    station: n, surface: 'madeira', part, look: { kind: 'plywood' },
  });
  ply('poco-norte', [ox0, ox1], [0, H], [oz0, iz0], 'z');
  ply('poco-sul-oeste', [ox0, W.door.x[0]], [0, H], [iz1, oz1], 'z', W.part);
  ply('poco-sul-leste', [W.door.x[1], ox1], [0, H], [iz1, oz1], 'z', W.part);
  ply('poco-sul-verga', W.door.x, [W.door.height, H], [iz1, oz1], 'z', W.part);
  ply('poco-leste', [ix1, ox1], [0, H], [iz0, iz1], 'x');
  ply('poco-oeste', [ox0, ix0], [0, H], [iz0, iz1], 'x');
  // Faixa de cor com o número em cada face de dentro (acima da porta), como as paredes numeradas do parkour.
  const cx = (ix0 + ix1) / 2;
  const cz = (iz0 + iz1) / 2;
  const faces = {
    norte: [cx, iz0 + 0.06, 180], sul: [cx, iz1 - 0.06, 0], leste: [ix1 - 0.06, cz, 270], oeste: [ix0 + 0.06, cz, 90],
  };
  for (const s of W.stripes) {
    const [x, z, facing] = faces[s.side];
    L.addDecor({
      id: `poco-faixa-${s.number}`, station: n, kind: 'ink', cell: `faixa-${s.number}`, size: [ix1 - ix0 - 6, 64],
      matrix: wallDecalMatrix(x, W.stripeY, z, facing),
    });
  }
  // Saída: prancha do topo da parede leste até a torre de blocos (apoiada 20 u nela).
  const T = E.tower;
  ply('poco-prancha', [ix1, T.x[0] + 20], [H, H + E.plankThickness], [cz - E.plankWidth / 2, cz + E.plankWidth / 2], 'y');
  blockStack(L, 'poco-torre', n, T.x, T.z, 0, T.height, { layers: T.layers, nx: 2, nz: 2, r: rng('poco-torre') });
}

/** 5 · Zigue-zague: plataformas A e B de blocos, painéis de papelão de parede dupla alternados e rampa de 30°. */
function zigzag({ data, L, rng }) {
  const Z = data.wallJump.zigzag;
  const n = 5;
  const r = rng('ziguezague');
  const opts = { layers: Z.layers, nx: 2, nz: 2, r };
  blockStack(L, 'zigue-a', n, Z.x, Z.platformA, 0, Z.platformHeight, opts);
  blockStack(L, 'zigue-b', n, Z.x, Z.platformB, 0, Z.platformHeight, opts);
  const P = Z.panel;
  const panel = (id, xr, zr) => L.panel(id, xr, [0, P.height], zr, 'x', {
    station: n, surface: 'papelao', look: { kind: 'panel', wall: 'double', thickness: P.thickness },
  });
  Z.west.forEach((zr, i) => panel(`zigue-oeste-${i}`, [Z.x[0] - P.thickness, Z.x[0]], zr));
  Z.east.forEach((zr, i) => panel(`zigue-leste-${i}`, [Z.x[1], Z.x[1] + P.thickness], zr));
  // Rampa de papelão subindo do leste até a borda leste da plataforma A.
  const len = Z.platformHeight / Math.tan(Z.ramp.deg * DEG);
  const zc = (Z.platformA[0] + Z.platformA[1]) / 2;
  L.add({
    id: 'zigue-rampa', station: n, shape: 'ramp', size: [Z.ramp.width, Z.platformHeight, len], surface: 'papelao',
    matrix: yawMatrix(Z.x[1] + len, 0, zc, 90), look: { kind: 'wedge', deg: Z.ramp.deg },
  });
}

/**
 * 6 · Faixa de slide: fitas nas bordas, linha de largada atravessada, marcas de distância a cada `marks.every` u com o
 * número ao sul da faixa e as traves atravessadas logo depois da linha, com a face de baixo exata sobre apoios estreitos
 * de bloco e caderninhos e a etiqueta da altura ao norte.
 */
function slide({ data, L, rng }) {
  const S = data.slide;
  const n = 6;
  const [lx0, lx1] = S.lane.x;
  const [lz0, lz1] = S.lane.z;
  const zc = (lz0 + lz1) / 2;
  S.lane.z.forEach((z, i) => {
    L.addDecor({ id: `slide-fita-${i}`, station: n, kind: 'tape', matrix: floorStripMatrix((lx0 + lx1) / 2, 0.1, z, 90), length: lx1 - lx0, width: 19 });
  });
  // Linha de largada (fita crepe atravessada) e as marcas de distância, fitas finas por cima das das bordas.
  L.addDecor({ id: 'slide-largada', station: n, kind: 'tape', matrix: floorStripMatrix(S.line, 0.2, zc, 180), length: lz1 - lz0 + 19, width: 19 });
  L.addDecor({
    id: 'slide-largada-etiqueta', station: n, kind: 'label', text: 'largada', matrix: floorDecalMatrix(S.line, 0.3, S.marks.labelZ, 90),
  });
  const M = S.marks;
  for (let d = M.every; d <= M.to; d += M.every) {
    L.addDecor({
      id: `slide-marca-${d}`, station: n, kind: 'tape', matrix: floorStripMatrix(S.line + d, 0.2, zc, 180), length: lz1 - lz0 + 19, width: M.width,
    });
    L.addDecor({
      id: `slide-marca-${d}-etiqueta`, station: n, kind: 'label', text: `${d} u`, matrix: floorDecalMatrix(S.line + d, 0.3, M.labelZ, 90),
    });
  }
  const r = rng('slide');
  const half = S.support / 2;
  for (const b of S.bars) {
    const [bw, bt, bl] = b.size;
    const x = S.line + b.at;
    S.supportZ.forEach((z, j) => {
      let y = 0;
      b.stack.forEach((h, k) => {
        const id = `slide-${b.under}-apoio-${j}-${k}`;
        const look = k === 0 ? { kind: 'beech', radius: 2, tint: beechTint(r) } : bookLook(data, r);
        // Caderninhos com a lombada virada para quem vem correndo (oeste).
        L.standing(id, x, y, z, [S.support, h, S.support], k === 0 ? 0 : 90 + r.float(-3, 3), {
          station: n, surface: k === 0 ? 'madeira' : 'papelao', look,
        });
        y += h;
      });
      L.addDecor({
        id: `slide-${b.under}-bolota-${j}`, station: n, kind: 'clayLump', seed: `slide-${b.under}-${j}`,
        color: data.prints.colors[(j + b.under) % data.prints.colors.length],
        matrix: new THREE.Matrix4().makeTranslation(x, b.under + bt, z + (j ? -half * 0.2 : half * 0.2)),
      });
    });
    const surface = b.kind === 'aco' ? 'metal' : 'madeira';
    L.standing(`slide-${b.under}-trave`, x, b.under, zc, [bw, bt, bl], 0, { station: n, surface, look: { kind: b.kind, size: b.size } });
    L.addDecor({
      id: `slide-${b.under}-etiqueta`, station: n, kind: 'label', text: `${b.under} u`,
      matrix: floorDecalMatrix(x, 0.3, S.labelZ, 90),
    });
  }
}

/** 6 · Gabarito: quatro portais de colunas de faia com verga de régua de 15 cm, vão livre exato. */
function gauge({ data, L, rng }) {
  const G = data.gauge;
  const n = 6;
  const r = rng('gabarito');
  const off = G.opening / 2 + G.column / 2;
  for (const p of G.portals) {
    [-1, 1].forEach((s, i) => {
      L.standing(`gabarito-${p.clear}-coluna-${i}`, p.x + s * off, 0, G.z, [G.column, p.clear, G.depth], 0, {
        station: n, surface: 'madeira', look: { kind: 'beech', radius: 2, tint: beechTint(r) },
      });
    });
    L.standing(`gabarito-${p.clear}-verga`, p.x, p.clear, G.z, G.lintel, 0, {
      station: n, surface: 'madeira', look: { kind: 'regua', size: G.lintel },
    });
    L.addDecor({
      id: `gabarito-${p.clear}-etiqueta`, station: n, kind: 'label', text: p.note,
      matrix: floorDecalMatrix(p.x, 0.1, G.z - G.depth / 2 - 42, 180),
    });
  }
}

export function layoutAdvancedStations(ctx) {
  well(ctx);
  zigzag(ctx);
  slide(ctx);
  gauge(ctx);
}
