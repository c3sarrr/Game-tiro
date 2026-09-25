// Estações 8–12 da pista de testes: faixa de bhop com a trena esticada no kraft (TMA2/TMA6/TMA12, WRG15), vigas de
// balsa entre plataformas de faia (BWM1/BWM10/BWM14, COC1), paredes finas de papelão de uma face (CBT12, COC15,
// PKG12), túnel baixo de caixas rasas com pisca-pisca (COC2/COC25, CBT6/CBT7/CBT13/CBT14) e as placas de massinha
// das pegadas (CFP1/CFP7/CFP10, CIM1/CIM5/CIM8). Puro: só dados.

import * as THREE from 'three';
import { DEG, basisMatrix, floorDecalMatrix, floorStripMatrix, headingDir, headingOf, yawMatrix } from './pieces.js';
import { sheetTapes } from './layoutGround.js';
import { blockStack } from './layoutAdvanced.js';

/** 8 · Bhop: kraft com fita nas bordas, trena do zero na largada até a chegada, etiquetas a cada 500 u e bandeira. */
function bhop({ data, L }) {
  const B = data.bhop;
  const k = data.floors.kraft;
  const n = 8;
  L.bounds('bhop-kraft', B.paper.x, [0, k.thickness], B.paper.z, { station: n, surface: k.surface, look: { kind: 'paper', color: k.color } });
  const [x0, x1] = B.paper.x;
  const [z0, z1] = B.paper.z;
  const y = k.thickness + 0.1;
  [z0, z1].forEach((z, i) => {
    L.addDecor({ id: `bhop-fita-borda-${i}`, station: n, kind: 'tape', matrix: floorStripMatrix((x0 + x1) / 2, y, z, 90), length: x1 - x0 + 30, width: 19 });
  });
  [x0, x1].forEach((x, i) => {
    L.addDecor({ id: `bhop-fita-ponta-${i}`, station: n, kind: 'tape', matrix: floorStripMatrix(x, y + 0.1, (z0 + z1) / 2, 0), length: z1 - z0 + 30, width: 19 });
  });
  const finish = B.start + B.length;
  L.addDecor({
    id: 'bhop-largada', station: n, kind: 'tape', color: '#F4EDE1', length: z1 - z0 - 40, width: 19,
    matrix: floorStripMatrix(B.start, y + 0.2, (z0 + z1) / 2, 0),
  });
  L.addDecor({
    id: 'bhop-chegada', station: n, kind: 'tape', color: '#D1362F', length: z1 - z0 - 40, width: 19,
    matrix: floorStripMatrix(finish, y + 0.2, (z0 + z1) / 2, 0),
  });
  // Lâmina da trena deitada no kraft, do gancho (zero) na largada até o estojo na chegada.
  L.addDecor({
    id: 'bhop-trena', station: n, kind: 'trena', length: B.length, width: B.trena.width, color: B.trena.color,
    matrix: floorStripMatrix(B.start + B.length / 2, y + 0.3, B.trena.z, 90),
  });
  const [cw, ch, cd] = B.case.size;
  L.standing('bhop-estojo', finish + cw / 2, k.thickness, B.case.z, [cw, ch, cd], 0, {
    station: n, surface: 'plastico', look: { kind: 'trenaCase', size: B.case.size, color: B.trena.color },
  });
  for (let d = B.labelEvery; d < B.length; d += B.labelEvery) {
    L.addDecor({
      id: `bhop-etiqueta-${d}`, station: n, kind: 'label', text: `${d / 100} m · ${d} u`,
      matrix: floorDecalMatrix(B.start + d, y + 0.3, B.labelZ, 90),
    });
  }
  L.addDecor({
    id: 'bhop-bandeira', station: n, kind: 'flag', stick: B.flag.stick, seed: 'bandeira-bhop',
    matrix: new THREE.Matrix4().makeTranslation(B.flag.at[0], k.thickness, B.flag.at[1]),
  });
}

/** 9 · Vigas de balsa: plataformas de faia, quatro ripas de larguras diferentes, alfinetes e ripa inclinada. */
function beams({ data, L, rng, floorTop }) {
  const V = data.beams;
  const n = 9;
  const y0 = floorTop(n);
  const r = rng('vigas');
  V.platforms.forEach((xr, i) => {
    blockStack(L, `vigas-plataforma-${i}`, n, xr, V.z, y0, V.height, { layers: V.layers, nx: 2, nz: 4, r });
  });
  const top = y0 + V.height;
  const { from, to, thickness } = V.beam;
  for (const b of V.widths) {
    L.standing(`vigas-${b.width}`, (from + to) / 2, top, b.z, [to - from, thickness, b.width], 0, {
      station: n, surface: 'madeira', look: { kind: 'balsa', seed: `viga-${b.width}` },
    });
    [from + 9, to - 9].forEach((x, j) => {
      L.addDecor({
        id: `vigas-${b.width}-alfinete-${j}`, station: n, kind: 'pin', seed: `alfinete-${b.width}-${j}`,
        color: data.prints.colors[(j * 3 + b.width) % data.prints.colors.length],
        matrix: new THREE.Matrix4().makeTranslation(x, top + thickness, b.z + r.float(-b.width * 0.2, b.width * 0.2)),
      });
    });
    L.addDecor({
      id: `vigas-${b.width}-etiqueta`, station: n, kind: 'label', text: `${b.width} u`,
      matrix: floorDecalMatrix(V.platforms[0][1] - 60, top + 0.1, b.z + b.width / 2 + 20, 90),
    });
  }
  // Ripa inclinada: a face de cima vai do chão (pé) até a borda sul da primeira plataforma, na altura do topo dela.
  const I = V.incline;
  const run = V.height / Math.tan(I.deg * DEG);
  const zTop = V.z[1];
  const a = new THREE.Vector3(I.x, y0, zTop + run);
  const b = new THREE.Vector3(I.x, top, zTop);
  const down = new THREE.Vector3().subVectors(a, b).normalize();
  const up = new THREE.Vector3(0, down.z, -down.y); // perpendicular à descida, para cima
  const len = a.distanceTo(b);
  const center = a.clone().add(b).multiplyScalar(0.5).addScaledVector(up, -I.thickness / 2);
  L.add({
    id: 'vigas-rampa', station: n, shape: 'box', size: [len, I.thickness, I.width], surface: 'madeira',
    matrix: basisMatrix(center.toArray(), down.toArray(), up.toArray()), look: { kind: 'balsa', seed: 'viga-inclinada' },
  });
}

/** Linhas deslocadas de um trecho de reta, com junta em meia-esquadria nos vértices internos. */
function offsetPolyline(points, offset) {
  const segs = [];
  for (let i = 0; i + 1 < points.length; i++) {
    const [ax, az] = points[i];
    const [bx, bz] = points[i + 1];
    const len = Math.hypot(bx - ax, bz - az);
    const d = [(bx - ax) / len, (bz - az) / len];
    const nrm = [-d[1], d[0]];
    segs.push({ p: [ax + nrm[0] * offset, az + nrm[1] * offset], d, len });
  }
  const meet = (s, t) => {
    // s.p + u·s.d = t.p + v·t.d
    const det = s.d[0] * -t.d[1] - s.d[1] * -t.d[0];
    const rx = t.p[0] - s.p[0];
    const rz = t.p[1] - s.p[1];
    const u = (rx * -t.d[1] - rz * -t.d[0]) / det;
    return [s.p[0] + s.d[0] * u, s.p[1] + s.d[1] * u];
  };
  return segs.map((s, i) => [
    i === 0 ? s.p : meet(segs[i - 1], s),
    i === segs.length - 1 ? [s.p[0] + s.d[0] * s.len, s.p[1] + s.d[1] * s.len] : meet(s, segs[i + 1]),
  ]);
}

/** Parede fina de papelão de uma face entre dois pontos do chão (a espessura para os dois lados da linha). */
function thinWall(L, id, station, [ax, az], [bx, bz], y0, height, thickness, extend = 0) {
  const len = Math.hypot(bx - ax, bz - az) + extend * 2;
  const heading = headingOf(bx - ax, bz - az);
  // O +X local fica à direita do rumo: com yaw no rumo − 90 ele aponta ao longo da parede (de a para b).
  return L.add({
    id, station, shape: 'box', size: [len, height, thickness], surface: 'papelao',
    matrix: yawMatrix((ax + bx) / 2, y0 + height / 2, (az + bz) / 2, heading - 90),
    look: { kind: 'panel', wall: 'single', thickness },
  });
}

/** 10 · Paredes finas: fileira de espessuras, muro com vãos de 33 e 31 u, corredor em zigue-zague, quina e curva. */
function walls({ data, L, floorTop }) {
  const W = data.walls;
  const n = 10;
  const y0 = floorTop(n);
  const H = W.height;
  const t = W.thickness;
  for (const p of W.row.panels) {
    const half = W.row.length / 2;
    thinWall(L, `paredes-espessura-${p.t}`, n, [p.x - half, W.row.z], [p.x + half, W.row.z], y0, H, p.t);
    L.addDecor({
      id: `paredes-espessura-${p.t}-etiqueta`, station: n, kind: 'label', text: `${String(p.t).replace('.', ',')} u`,
      matrix: floorDecalMatrix(p.x, y0 + 0.1, W.row.z + 40, 0),
    });
  }
  // Muro com dois vãos.
  const G = W.gapWall;
  let x = G.x[0];
  G.gaps.forEach((g, i) => {
    const gx0 = g.x - g.width / 2;
    thinWall(L, `paredes-muro-${i}`, n, [x, G.z], [gx0, G.z], y0, H, t);
    x = g.x + g.width / 2;
    L.addDecor({
      id: `paredes-vao-${g.width}-etiqueta`, station: n, kind: 'label', text: g.note,
      matrix: floorDecalMatrix(g.x, y0 + 0.1, G.z + 46, 0),
    });
  });
  thinWall(L, `paredes-muro-${G.gaps.length}`, n, [x, G.z], [G.x[1], G.z], y0, H, t);
  // Corredor em zigue-zague: linha central por trechos, paredes deslocadas de meia largura + meia espessura.
  const Z = W.zigzag;
  const pts = [Z.start];
  for (const h of Z.headings) {
    const [dx, dz] = headingDir(h);
    const [px, pz] = pts[pts.length - 1];
    pts.push([px + dx * Z.segment, pz + dz * Z.segment]);
  }
  [-1, 1].forEach((s) => {
    offsetPolyline(pts, s * (Z.width / 2 + t / 2)).forEach(([a, b], i) => {
      thinWall(L, `paredes-corredor-${s < 0 ? 'e' : 'd'}-${i}`, n, a, b, y0, H, t, t * 0.6);
    });
  });
  // Quina aguda aberta para o sul: as faces de dentro se encontram no vértice.
  const C = W.corner;
  [180 - C.deg / 2, 180 + C.deg / 2].forEach((h, i) => {
    const [dx, dz] = headingDir(h);
    const inward = i === 0 ? [-dz, dx] : [dz, -dx]; // normal que aponta para dentro da quina
    const ox = -inward[0] * (t / 2);
    const oz = -inward[1] * (t / 2);
    const a = [C.apex[0] + ox, C.apex[1] + oz];
    const b = [C.apex[0] + dx * C.length + ox, C.apex[1] + dz * C.length + oz];
    thinWall(L, `paredes-quina-${i}`, n, a, b, y0, H, t);
  });
  // Parede curva: arco de 90° em trechos retos.
  const R = W.curve;
  for (let i = 0; i < R.segments; i++) {
    const h0 = R.from + ((R.to - R.from) * i) / R.segments;
    const h1 = R.from + ((R.to - R.from) * (i + 1)) / R.segments;
    const [ax, az] = headingDir(h0);
    const [bx, bz] = headingDir(h1);
    thinWall(L, `paredes-curva-${i}`, n,
      [R.center[0] + ax * R.radius, R.center[1] + az * R.radius],
      [R.center[0] + bx * R.radius, R.center[1] + bz * R.radius], y0, H, t, t * 0.4);
  }
}

/** 11 · Túnel: três caixas rasas sem fundo, degrau fechado entre os tetos, abas nas bocas, furos, respiros e luzes. */
function tunnel({ data, L }) {
  const T = data.tunnel;
  const n = 11;
  const t = T.wall;
  const [iz0, iz1] = T.z;
  const [oz0, oz1] = [iz0 - t, iz1 + t];
  const boxes = T.boxes;
  const tall = Math.max(...boxes.map((b) => b.height));
  boxes.forEach((b, i) => {
    const low = b.height < tall;
    const look = (part) => ({ kind: 'tunnel', part, box: i, low, size: [b.x[1] - b.x[0], b.height] });
    L.panel(`tunel-${i}-norte`, b.x, [0, b.height], [iz1, oz1], 'z', { station: n, surface: 'papelao', look: look('norte') });
    L.panel(`tunel-${i}-sul`, b.x, [0, b.height], [oz0, iz0], 'z', { station: n, surface: 'papelao', look: look('sul') });
    L.panel(`tunel-${i}-teto`, b.x, [b.height - t, b.height], [oz0, oz1], 'y', { station: n, surface: 'papelao', look: look('teto') });
  });
  // Degrau entre os tetos: a parede da ponta da caixa alta, da face de baixo do teto baixo até o teto alto.
  for (let i = 0; i + 1 < boxes.length; i++) {
    const a = boxes[i];
    const b = boxes[i + 1];
    const xs = a.x[1];
    const lowH = Math.min(a.height, b.height);
    L.panel(`tunel-degrau-${i}`, [xs - t / 2, xs + t / 2], [lowH - t, Math.max(a.height, b.height)], [oz0, oz1], 'x', {
      station: n, surface: 'papelao', look: { kind: 'panel', wall: 'regular', thickness: t },
    });
    // Fita larga atravessada no teto da caixa alta, perto da emenda.
    const into = a.height > b.height ? -1 : 1;
    L.addDecor({
      id: `tunel-fita-${i}`, station: n, kind: 'tape', width: 48, length: oz1 - oz0 + 24,
      matrix: floorStripMatrix(xs + into * 30, Math.max(a.height, b.height) + 0.15, (oz0 + oz1) / 2, 180),
    });
  }
  const first = boxes[0];
  const last = boxes[boxes.length - 1];
  L.addDecor({ id: 'tunel-abas-oeste', station: n, kind: 'tunnelFlaps', x: first.x[0], outward: -1, height: first.height, z: [oz0, oz1] });
  L.addDecor({ id: 'tunel-abas-leste', station: n, kind: 'tunnelFlaps', x: last.x[1], outward: 1, height: last.height, z: [oz0, oz1] });
  // Pisca-pisca: fio preso sob o teto do lado norte, 12 lampadinhas quentes.
  const anchors = [];
  const count = T.bulbs + 1;
  const x0 = first.x[0] + 16;
  const x1 = last.x[1] - 16;
  for (let i = 0; i < count; i++) {
    const x = x0 + ((x1 - x0) * i) / (count - 1);
    const box = boxes.find((b) => x >= b.x[0] && x <= b.x[1]) ?? last;
    anchors.push([x, box.height - t - 2, iz1 - 16]);
  }
  L.addDecor({ id: 'tunel-pisca', station: n, kind: 'fairyLights', anchors, sag: 7, matrix: new THREE.Matrix4() });
}

/** 12 · Pegadas: tira de kraft com as sete placas de massinha (P-E-G-A-D-A-S) giradas ±4°. */
function prints({ data, L, rng }) {
  const P = data.prints;
  const k = data.floors.kraft;
  const n = 12;
  L.bounds('pegadas-kraft', P.paper.x, [0, k.thickness], P.paper.z, { station: n, surface: k.surface, look: { kind: 'paper', color: k.color } });
  sheetTapes(L, 'pegadas-kraft', n, P.paper.x, P.paper.z, k.thickness + 0.1, { length: 70 });
  const r = rng('pegadas');
  [...P.letters].forEach((letter, i) => {
    L.standing(`pegadas-${i}`, P.from + P.step * i, k.thickness, P.z, P.plate, r.float(-P.turnDeg, P.turnDeg), {
      station: n, surface: 'massinha', look: { kind: 'clayPlate', color: P.colors[i], letter, seed: `placa-${i}` },
    });
  });
}

export function layoutCourse(ctx) {
  bhop(ctx);
  beams(ctx);
  walls(ctx);
  tunnel(ctx);
  prints(ctx);
}
