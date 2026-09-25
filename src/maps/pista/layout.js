// Layout da pista de testes (subfase 3.3): expande src/data/pista.js numa lista de peças (forma de colisão, matriz,
// superfície e aparência) e de enfeites, e nas estações com os pontos de teleporte. Determinístico (seed nas pequenas
// tortices de "feito à mão") e puro, sem WebGL: os testes do Node leem o mesmo layout que o mapa monta.
// Base, cerca, lotes e praça ficam aqui; as estações em layoutGround (1–4), layoutAdvanced (5–6), layoutTower (7) e
// layoutCourse (8–12). Referências do moodboard no item 11 (COC5/COC30/PKC12 planta de estações, DFL1/DFL5/LDB15
// lotes e fitas, COC4/CBT15 caixas da cerca).

import * as THREE from 'three';
import { PISTA } from '../../data/pista.js';
import { RNG } from '../../core/rng.js';
import { deskLampBase } from '../../render/studio/fixtures.js';
import { PieceList, basisMatrix, floorStripMatrix, headingDir, wallDecalMatrix, yawMatrix, DEG } from './pieces.js';
import { layoutGroundStations } from './layoutGround.js';
import { layoutAdvancedStations } from './layoutAdvanced.js';
import { layoutTower } from './layoutTower.js';
import { layoutCourse } from './layoutCourse.js';

/** Fitas do contorno de um lote: 12 u para fora da borda; camadas separadas por lote (sem briga de profundidade). */
function lotTapes(L, lot, { width, offset }) {
  const [x0, x1] = lot.x;
  const [z0, z1] = lot.z;
  const n = lot.number;
  const y = 0.1 * (1 + (n % 4));
  const long = x1 - x0 + 2 * offset + width;
  const tall = z1 - z0 + 2 * offset;
  const strip = (id, x, yy, z, heading, length) => L.addDecor({
    id: `lote-${n}-fita-${id}`, station: n, kind: 'tape', matrix: floorStripMatrix(x, yy, z, heading), length, width,
  });
  strip('norte', (x0 + x1) / 2, y, z0 - offset, 90, long);
  strip('sul', (x0 + x1) / 2, y, z1 + offset, 90, long);
  strip('oeste', x0 - offset, y + 0.05, (z0 + z1) / 2, 180, tall);
  strip('leste', x1 + offset, y + 0.05, (z0 + z1) / 2, 180, tall);
}

/** Base de compensado, chão do estúdio e a cerca de caixas de papelão. */
function baseAndFence({ data, L, rng }) {
  const B = data.base;
  L.bounds('base', [B.minX, B.maxX], [-B.thickness, 0], [B.minZ, B.maxZ], {
    surface: 'madeira', look: { kind: 'base', sheet: B.sheet, origin: [B.minX, B.minZ] },
  });
  const S = data.studioFloor.size;
  L.bounds('chao-estudio', [-S / 2, S / 2], [-B.thickness - 20, -B.thickness], [-S / 2, S / 2], {
    surface: 'padrao', look: { kind: 'studioFloor', color: data.studioFloor.color },
  });
  const Fc = data.fence;
  const { innerX: ix, innerZ: iz, height: h, wall, collider, depth } = Fc;
  // Colisão: uma caixa por lado centrada no painel de dentro (papelão + empeno).
  const mid = wall / 2;
  L.bounds('cerca-norte', [B.minX, B.maxX], [0, h], [-iz - mid - collider / 2, -iz - mid + collider / 2], { surface: 'papelao' });
  L.bounds('cerca-sul', [B.minX, B.maxX], [0, h], [iz + mid - collider / 2, iz + mid + collider / 2], { surface: 'papelao' });
  L.bounds('cerca-oeste', [-ix - mid - collider / 2, -ix - mid + collider / 2], [0, h], [B.minZ, B.maxZ], { surface: 'papelao' });
  L.bounds('cerca-leste', [ix + mid - collider / 2, ix + mid + collider / 2], [0, h], [B.minZ, B.maxZ], { surface: 'papelao' });
  // Aparência: caixas abertas em pé (a frente de cada uma é a face de dentro da cerca), estampas e fita nas emendas.
  const r = rng('cerca');
  const sides = [
    { id: 'norte', count: Fc.boxesX, span: 2 * ix, facing: 180, at: (s) => [s, -iz - depth / 2] },
    { id: 'sul', count: Fc.boxesX, span: 2 * ix, facing: 0, at: (s) => [-s, iz + depth / 2] },
    { id: 'oeste', count: Fc.boxesZ, span: 2 * iz, facing: 90, at: (s) => [-ix - depth / 2, -s] },
    { id: 'leste', count: Fc.boxesZ, span: 2 * iz, facing: 270, at: (s) => [ix + depth / 2, s] },
  ];
  let stamp = 0;
  for (const side of sides) {
    const len = side.span / side.count;
    const [fx, fz] = headingDir(side.facing);
    for (let i = 0; i < side.count; i++) {
      const s = -side.span / 2 + len * (i + 0.5);
      const [x, z] = side.at(s);
      // yaw no rumo oposto ao da face: o +Z local (frente da caixa) aponta para dentro da cerca.
      L.add({
        id: `cerca-${side.id}-${i}`, shape: 'box', size: [len - 1, h, depth], collide: false,
        matrix: yawMatrix(x, h / 2, z, side.facing + 180),
        look: { kind: 'fenceBox', size: [len - 1, h, depth], wall, flapOpen: Fc.flapOpen * r.float(0.7, 1.3), seed: `cerca-${side.id}-${i}` },
      });
      const face = [x + fx * (depth / 2 + 0.1), z + fz * (depth / 2 + 0.1)];
      const [rx, rz] = headingDir(side.facing + 90);
      const shift = r.float(-0.25, 0.25) * len;
      L.addDecor({
        id: `cerca-${side.id}-${i}-estampa`, kind: 'ink', cell: `estampa-${stamp % Fc.stamps.length}`, size: [150, 75],
        matrix: wallDecalMatrix(face[0] - rx * shift, r.float(95, 135), face[1] - rz * shift, side.facing),
      });
      stamp++;
      if (i > 0) {
        // Emenda com a caixa anterior: meia caixa para a direita de quem olha a face (a ordem de `at` segue esse lado).
        const jx = x + rx * (len / 2);
        const jz = z + rz * (len / 2);
        L.addDecor({
          id: `cerca-${side.id}-${i}-fita`, kind: 'tape', width: Fc.tape, length: h + 30, seed: `cerca-fita-${side.id}-${i}`,
          matrix: basisMatrix([jx + fx * (depth / 2 + 0.2), h / 2 - 6, jz + fz * (depth / 2 + 0.2)], [0, 1, 0], [-fz, 0, fx]),
        });
      }
    }
  }
}

/** Chão dos lotes (tapete de corte no lote inteiro), fitas do contorno e a plaquinha em "A" de cada estação. */
function lots({ data, L }) {
  for (const lot of data.lots) {
    const cover = data.floors[lot.floor];
    if (cover.thickness > 0) {
      L.bounds(`lote-${lot.number}-chao`, lot.x, [0, cover.thickness], lot.z, {
        station: lot.number, surface: cover.surface,
        look: { kind: 'mat', size: [lot.x[1] - lot.x[0], lot.z[1] - lot.z[0]] },
      });
    }
    lotTapes(L, lot, data.lotTape);
    const [cx, cz, heading] = lot.card;
    const onLot = cx >= lot.x[0] && cx <= lot.x[1] && cz >= lot.z[0] && cz <= lot.z[1];
    const station = data.stations.find((s) => s.number === lot.number);
    L.add({
      id: `lote-${lot.number}-placa`, station: lot.number, shape: 'tent', size: [140, 70, 56], surface: 'papelao',
      matrix: yawMatrix(cx, onLot ? cover.thickness : 0, cz, heading),
      look: { kind: 'tentCard', number: lot.number, text: `${lot.number} · ${station.label}` },
    });
  }
}

/** Praça do spawn: cavalete de papelão com a prancheta da planta e a base da luminária de mesa. */
function plaza({ data, L }) {
  const E = data.plaza.easel;
  const frame = yawMatrix(E.at[0], 0, E.at[1], E.heading);
  const [bw, bh, bt] = E.board;
  const reach = bh * Math.cos(E.tilt * DEG); // a prancheta deita para trás do cavalete
  const top = E.bottom + bh * Math.sin(E.tilt * DEG);
  const box = new THREE.Matrix4().makeTranslation(0, top / 2 + 4, reach / 2 + 24);
  L.add({
    id: 'praca-cavalete', shape: 'box', size: [bw + 20, top + 8, reach + 64], surface: 'papelao',
    matrix: frame.clone().multiply(box), look: { kind: 'easel', frame, board: E.board, tilt: E.tilt, bottom: E.bottom },
  });
  // Planta desenhada a lápis sobre a prancheta (frente = −Z local do cavalete, inclinada; quem olha de frente tem a
  // direita no −X local).
  const up = new THREE.Vector3(0, Math.sin(E.tilt * DEG), Math.cos(E.tilt * DEG));
  const normal = new THREE.Vector3(0, Math.cos(E.tilt * DEG), -Math.sin(E.tilt * DEG));
  const center = new THREE.Vector3(0, E.bottom, 0).addScaledVector(up, bh / 2).addScaledVector(normal, bt / 2 + 0.15);
  const m = basisMatrix(center.toArray(), [-1, 0, 0], up.toArray());
  L.addDecor({ id: 'praca-planta', kind: 'print', cell: 'planta', size: [bw - 40, bh - 50], matrix: frame.clone().multiply(m) });
  const lamp = data.plaza.lamp;
  const base = deskLampBase(new THREE.Vector3(...lamp.bulb), new THREE.Vector3(...lamp.target), lamp.reach, 0);
  L.add({
    id: 'praca-luminaria', shape: 'cylinder', size: [lamp.baseRadius, lamp.baseHeight], surface: 'metal',
    matrix: new THREE.Matrix4().makeTranslation(base.x, 0, base.z),
  });
}

/** Estações com os pontos ainda sem a altura dos pés (sai de um raio no mundo de colisão: src/maps/stations.js). */
function stationDefs({ data }, tower) {
  return data.stations.map((s) => ({
    number: s.number, id: s.id, label: s.label, aliases: [...s.aliases],
    spots: s.spots.map((sp) => {
      if (sp.plank) return { id: sp.id, label: sp.label ?? `prancha de ${sp.plank} u`, ...tower.plankSpot(sp.plank) };
      if (sp.spiral) return { id: sp.id, label: sp.label, below: sp.below, ...tower.spiralSpot() };
      return {
        id: sp.id, label: sp.label ?? sp.id, x: sp.at[0], z: sp.at[1], heading: sp.heading, pitch: sp.pitch ?? -4,
        below: sp.below ?? 3000,
      };
    }),
  }));
}

/**
 * Monta a pista. Devolve `{ pieces, decor, stations, tower, spawn }` — `stations` com os pontos em (x, z, rumo, pitch,
 * `below`); `tower` com os livros da espiral e as marcas das pranchas (testes e planta).
 */
export function buildPistaLayout(data = PISTA) {
  const L = new PieceList();
  const lotOf = new Map(data.lots.map((l) => [l.number, l]));
  const ctx = {
    data,
    L,
    rng: (label) => new RNG(`${data.seed}:${label}`),
    lot: (n) => lotOf.get(n),
    floorTop: (n) => data.floors[lotOf.get(n).floor].thickness,
  };
  baseAndFence(ctx);
  lots(ctx);
  plaza(ctx);
  layoutGroundStations(ctx);
  layoutAdvancedStations(ctx);
  const tower = layoutTower(ctx);
  layoutCourse(ctx);
  const [sx, sy, sz] = data.spawn.at;
  return {
    pieces: L.pieces,
    decor: L.decor,
    stations: stationDefs(ctx, tower),
    tower,
    spawn: { x: sx, y: sy, z: sz, heading: data.spawn.heading, pitch: data.spawn.pitch },
  };
}
