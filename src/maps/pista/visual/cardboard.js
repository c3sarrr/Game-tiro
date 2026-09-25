// Papelão da pista de testes (item 11 do moodboard: COC4/CBT15 caixas da cerca, CFO8/CFR7 cunhas, CBT12/COC15 papelão
// de uma face, COC2/COC25/CBT6/CBT13 túnel, BAS9 tubo da torre, DFL5 plaquinhas, COC30 cavalete): caixas abertas da
// cerca (parede dupla), caixa de arquivo das rampas com tampa e alças, cunhas fechadas dos lados, painéis (parede
// dupla do zigue-zague, uma face das paredes finas, cartão nas mais finas), caixas do túnel com furos e respiros e as
// abas das bocas, o tubo enrolado da torre com a tampa, as plaquinhas em "A" e o cavalete com a prancheta. Três lotes
// (papelão comum, parede dupla, uma face), cada peça com o seu tom.

import * as THREE from 'three';
import { RNG } from '../../../core/rng.js';
import { cardboardBox, cardboardPanel, cardboardPolygon, woundTube } from '../../../clay/set/boardGeometry.js';
import { basisMatrix, DEG } from '../pieces.js';
import { cardboardTone, offset, tentFaces } from './common.js';

/** Retângulo centrado em (cx, cy). */
function rectShape(w, h, cx = 0, cy = 0) {
  return new THREE.Shape([
    new THREE.Vector2(cx - w / 2, cy - h / 2), new THREE.Vector2(cx + w / 2, cy - h / 2),
    new THREE.Vector2(cx + w / 2, cy + h / 2), new THREE.Vector2(cx - w / 2, cy + h / 2),
  ]);
}

/** Furo em estádio (retângulo de pontas redondas) centrado em (cx, cy): alças e respiros. */
function slotPath(w, h, cx, cy) {
  const r = h / 2;
  const p = new THREE.Path();
  p.moveTo(cx - w / 2 + r, cy - r);
  p.lineTo(cx + w / 2 - r, cy - r);
  p.absarc(cx + w / 2 - r, cy, r, -Math.PI / 2, Math.PI / 2, false);
  p.lineTo(cx - w / 2 + r, cy + r);
  p.absarc(cx - w / 2 + r, cy, r, Math.PI / 2, (Math.PI * 3) / 2, false);
  return p;
}

/** Caixa aberta da cerca: parede dupla, abas curtas abertas para fora, sem fundo (ninguém vê); origem no pé. */
function fence(add, p) {
  const [w, h, d] = p.size;
  const L = p.look;
  const geo = cardboardBox(w, h, d, { thickness: L.wall, flapOpen: L.flapOpen, seed: L.seed, step: 40, flaps: [d * 0.48, d * 0.48], bottom: false });
  add('cardboardDouble', geo, offset(0, -h / 2, 0));
}

/** Caixa de arquivo: tampa com saia rente à colisão, paredes por dentro da saia e alças nas laterais. */
function archiveBox(add, p, A) {
  const [w, h, d] = p.size;
  const t = A.wall;
  const skirt = A.lid;
  const flat = (cx, cy, cz) => basisMatrix([cx, cy, cz], [1, 0, 0], [0, 0, -1]); // placa deitada, frente para cima
  add('cardboard', cardboardPanel(w, d, t, { seed: `${p.id}:tampa`, fluteAxis: 'x', step: 24 }), flat(0, h / 2 - t / 2, 0));
  const yS = h / 2 - skirt / 2;
  add('cardboard', cardboardPanel(w, skirt, t, { seed: `${p.id}:saia-s`, step: 24 }), basisMatrix([0, yS, d / 2 - t / 2], [1, 0, 0], [0, 1, 0]));
  add('cardboard', cardboardPanel(w, skirt, t, { seed: `${p.id}:saia-n`, step: 24 }), basisMatrix([0, yS, -d / 2 + t / 2], [-1, 0, 0], [0, 1, 0]));
  add('cardboard', cardboardPanel(d - 2 * t, skirt, t, { seed: `${p.id}:saia-l`, step: 24 }), basisMatrix([w / 2 - t / 2, yS, 0], [0, 0, -1], [0, 1, 0]));
  add('cardboard', cardboardPanel(d - 2 * t, skirt, t, { seed: `${p.id}:saia-o`, step: 24 }), basisMatrix([-w / 2 + t / 2, yS, 0], [0, 0, 1], [0, 1, 0]));
  // Paredes: da base até a tampa, por dentro da saia.
  const wh = h - t;
  const yW = -h / 2 + wh / 2;
  add('cardboard', cardboardPanel(w - 2 * t, wh, t, { seed: `${p.id}:frente`, step: 24 }), basisMatrix([0, yW, d / 2 - 1.5 * t], [1, 0, 0], [0, 1, 0]));
  add('cardboard', cardboardPanel(w - 2 * t, wh, t, { seed: `${p.id}:fundo`, step: 24 }), basisMatrix([0, yW, -d / 2 + 1.5 * t], [-1, 0, 0], [0, 1, 0]));
  for (const side of [1, -1]) {
    const sw = d - 4 * t;
    const shape = rectShape(sw, wh);
    shape.holes.push(slotPath(A.handle[0], A.handle[1], 0, wh / 2 - skirt - A.handle[1]));
    const geo = cardboardPolygon(shape, t, { seed: `${p.id}:alca-${side}` });
    add('cardboard', geo, basisMatrix([side * (w / 2 - 1.5 * t), yW, 0], [0, 0, -side], [0, 1, 0]));
  }
}

/** Cunha fechada dos lados: tampa inclinada rente à rampa da colisão, laterais triangulares e o fundo encostado. */
function wedge(add, p, t) {
  const [w, h, l] = p.size;
  const len = Math.hypot(h, l);
  const up = new THREE.Vector3(0, h, l).divideScalar(len);
  const n = new THREE.Vector3(0, l, -h).divideScalar(len);
  const mid = new THREE.Vector3(0, h / 2, l / 2).addScaledVector(n, -t / 2);
  add('cardboard', cardboardPanel(w, len, t, { seed: `${p.id}:tampo`, fluteAxis: 'x', step: 16 }), basisMatrix(mid.toArray(), [-1, 0, 0], up.toArray()));
  // Laterais: o triângulo abaixo da tampa (hipotenusa recuada a espessura da tampa).
  const z0 = (t * len) / h;
  const top = h - (t * len) / l;
  const tri = new THREE.Shape([new THREE.Vector2(z0, 0), new THREE.Vector2(l, 0), new THREE.Vector2(l, top)]);
  for (const side of [1, -1]) {
    add('cardboard', cardboardPolygon(tri, t, { seed: `${p.id}:lado-${side}` }), basisMatrix([side * (w / 2 - t / 2), 0, 0], [0, 0, 1], [0, 1, 0]));
  }
  add('cardboard', cardboardPanel(w - 2 * t, top, t, { seed: `${p.id}:fundo`, step: 16 }), basisMatrix([0, top / 2, l - t / 2], [1, 0, 0], [0, 1, 0]));
}

/** Placa de papelão comum, de parede dupla ou de uma face (as mais finas que 1,5 u são cartão). */
function panel(add, p) {
  const [w, h, t] = p.size;
  const wall = p.look.wall;
  const key = wall === 'double' ? 'cardboardDouble' : wall === 'single' && t >= 1.5 ? 'cardboardSingle' : 'cardboard';
  add(key, cardboardPanel(w, h, t, { seed: p.id, fluteAxis: 'y', step: 16, warp: t < 3 ? 1.4 : 1.1 }), new THREE.Matrix4());
}

/** Caixas do túnel: paredes (a caixa alta com fendas de respiro) e tetos (os baixos com três furos). */
function tunnelPart(add, p, T) {
  const [w, h, t] = p.size;
  const L = p.look;
  const shape = rectShape(w, h);
  if (L.part === 'teto' && L.low) {
    for (let k = 0; k < T.holes.perBox; k++) {
      const hole = new THREE.Path();
      hole.absarc(-w / 2 + (w * (k + 0.5)) / T.holes.perBox, 0, T.holes.diameter / 2, 0, Math.PI * 2, true);
      shape.holes.push(hole);
    }
  } else if (L.part !== 'teto' && !L.low) {
    const [vw, vh] = T.vents.size;
    for (let k = 0; k < T.vents.perSide; k++) shape.holes.push(slotPath(vw, vh, -w / 2 + (w * (k + 0.5)) / T.vents.perSide, h / 2 - 24));
  }
  add('cardboard', cardboardPolygon(shape, t, { seed: p.id, fluteAxis: L.part === 'teto' ? 'x' : 'y', step: 30 }), new THREE.Matrix4());
}

/** Abas de uma boca do túnel: a de cima aberta para fora e para cima, as dos lados abertas em leque. */
function tunnelFlaps(addWorld, d, F, t, rng) {
  const o = d.outward;
  const [z0, z1] = d.z;
  const zc = (z0 + z1) / 2;
  const up = F.openDeg * DEG * rng.float(0.8, 1.2);
  const dir = [o * Math.cos(up), Math.sin(up), 0];
  const hinge = new THREE.Vector3(d.x, d.height - t / 2, zc);
  const topCenter = hinge.clone().add(new THREE.Vector3(...dir).multiplyScalar(F.top / 2));
  addWorld('cardboard', cardboardPanel(z1 - z0, F.top, t, { seed: `${d.id}:cima`, fluteAxis: 'x', step: 16 }), basisMatrix(topCenter.toArray(), [0, 0, o], dir));
  for (const side of [1, -1]) {
    const splay = F.splayDeg * DEG * rng.float(0.8, 1.2);
    const along = [o * Math.cos(splay), 0, side * Math.sin(splay)];
    const zEdge = side > 0 ? z1 - t / 2 : z0 + t / 2;
    const fh = d.height - 6;
    const c = new THREE.Vector3(d.x, fh / 2 + 1, zEdge).add(new THREE.Vector3(...along).multiplyScalar(F.side / 2));
    addWorld('cardboard', cardboardPanel(F.side, fh, t, { seed: `${d.id}:lado-${side}`, step: 16 }), basisMatrix(c.toArray(), along, [0, 1, 0]));
  }
}

/** Tubo da torre: enrolado em espiral, com a tampa encaixada rente à boca de cima. */
function tube(add, p, pitch) {
  const [r, height] = p.size;
  const wall = p.look.wall;
  add('cardboard', woundTube(r - wall, height, wall, { pitch }), new THREE.Matrix4());
  const disc = new THREE.Shape().absarc(0, 0, r - wall, 0, Math.PI * 2, false);
  add('cardboard', cardboardPolygon(disc, 4, { seed: `${p.id}:tampa`, curveSegments: 40 }), basisMatrix([0, height - 2, 0], [1, 0, 0], [0, 0, -1]));
}

/** Plaquinha em "A": dois cartões com a face de fora na rampa da colisão. */
function tentCard(add, p, t) {
  for (const f of tentFaces(p.size)) {
    add('cardboard', cardboardPanel(f.width, f.slope, t, { seed: `${p.id}:${f.side}`, fluteAxis: 'x', step: 24 }), f.matrix.clone().multiply(offset(0, 0, -t / 2)));
  }
}

/**
 * Cavalete de papelão com a prancheta: laterais em "A" com a borda da frente no plano de trás da prancheta, a
 * prateleira que segura a prancheta, a travessa de trás, a prancheta (chapa dura escura) e o prendedor de metal.
 */
function easel(add, p, look, frameInv) {
  const L = p.look;
  const [bw, bh, bt] = L.board;
  const s = Math.sin(L.tilt * DEG);
  const c = Math.cos(L.tilt * DEG);
  const F = L.frame;
  // No quadro do cavalete (o add da peça multiplica pela matriz da peça: desfaz com a inversa e usa o quadro).
  const inFrame = (m) => frameInv.clone().multiply(F).multiply(m);
  const up = [0, s, c];
  const center = new THREE.Vector3(0, L.bottom, 0).addScaledVector(new THREE.Vector3(...up), bh / 2);
  add('cardboard', cardboardPanel(bw, bh, bt, { seed: `${p.id}:prancheta`, step: 24, warp: 0.4 }), inFrame(basisMatrix(center.toArray(), [-1, 0, 0], up)), look.clipboard);
  // Prendedor: chapa curva no alto da prancheta, rolo da mola e a alavanca de arame.
  const clipAt = new THREE.Vector3(0, L.bottom, 0).addScaledVector(new THREE.Vector3(...up), bh - 16).addScaledVector(new THREE.Vector3(0, c, -s), bt / 2 + 0.8);
  const plate = new THREE.BoxGeometry(100, 26, 1.4).translate(0, 0, 0);
  const roll = new THREE.CylinderGeometry(3, 3, 104, 16).rotateZ(Math.PI / 2).translate(0, 11, 2.5);
  const lever = new THREE.TorusGeometry(14, 1.1, 8, 24, Math.PI).rotateX(-Math.PI / 2).translate(0, 11, 6);
  const clipFrame = inFrame(basisMatrix(clipAt.toArray(), [-1, 0, 0], up));
  for (const g of [plate, roll, lever]) add('chrome', g, clipFrame, look.clip);
  // Laterais: triângulos com a borda da frente no plano de trás da prancheta, da base até o alto dela.
  const back = { z: s * bt / 2, y: L.bottom - c * bt / 2 };
  const kFoot = -back.y / s;
  const kTop = bh * 0.94;
  const foot = [back.z + c * kFoot, 0];
  const apex = [back.z + c * kTop, back.y + s * kTop];
  const rear = [apex[0] + 50, 0];
  const tri = new THREE.Shape([new THREE.Vector2(...foot), new THREE.Vector2(...rear), new THREE.Vector2(...apex)]);
  for (const side of [1, -1]) {
    add('cardboard', cardboardPolygon(tri, 4, { seed: `${p.id}:lado-${side}` }), inFrame(basisMatrix([side * (bw / 2 + 6), 0, 0], [0, 0, 1], [0, 1, 0])));
  }
  // Prateleira sob a borda de baixo da prancheta e o friso da frente.
  add('cardboard', cardboardPanel(bw + 16, 30, 4, { seed: `${p.id}:prateleira`, fluteAxis: 'x' }), inFrame(basisMatrix([0, L.bottom - 2, 2], [1, 0, 0], [0, 0, -1])));
  add('cardboard', cardboardPanel(bw + 16, 14, 4, { seed: `${p.id}:friso` }), inFrame(basisMatrix([0, L.bottom + 5, -13], [-1, 0, 0], [0, 1, 0])));
  // Travessa de trás entre as laterais, baixa.
  add('cardboard', cardboardPanel(bw + 8, 34, 4, { seed: `${p.id}:travessa` }), inFrame(basisMatrix([0, 46, rear[0] - 36], [1, 0, 0], [0, 1, 0])));
}

export function buildCardboard(ctx) {
  const { layout, data, batches } = ctx;
  const look = data.look;
  const rng = new RNG(`${data.seed}:papelao`);
  let count = 0;
  for (const p of layout.pieces) {
    const k = p.look.kind;
    const tone = cardboardTone(rng, look.cardboardTint);
    const add = (key, geo, local, color = tone) => {
      batches.add(key, geo, p.matrix.clone().multiply(local), color);
      count++;
    };
    if (k === 'fenceBox') fence(add, p);
    else if (k === 'archiveBox') archiveBox(add, p, look.archive);
    else if (k === 'wedge') wedge(add, p, look.wedgeWall);
    else if (k === 'panel') panel(add, p);
    else if (k === 'tunnel') tunnelPart(add, p, data.tunnel);
    else if (k === 'tube') tube(add, p, look.tubePitch);
    else if (k === 'tentCard') tentCard(add, p, look.tentWall);
    else if (k === 'easel') easel(add, p, look, p.matrix.clone().invert());
  }
  const addWorld = (key, geo, matrix) => {
    batches.add(key, geo, matrix, cardboardTone(rng, look.cardboardTint));
    count++;
  };
  for (const d of layout.decor) {
    if (d.kind === 'tunnelFlaps') tunnelFlaps(addWorld, d, look.flap, data.tunnel.wall, rng);
  }
  return { cardboard: count };
}
