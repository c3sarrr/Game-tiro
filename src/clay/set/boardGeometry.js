// Geometria de papelão ondulado cortado à mão (docs/art/moodboard.md: SSD4, SSD8, CSD16).
// Placa no plano XY (espessura em Z), com:
//  - faces subdivididas para o empeno leve (papelão nunca é plano) e bordas de corte com tremor de estilete;
//  - atributos para o shader (paperMaterials.js): aBoard = (x, y, tipo, através), aBoardSize = (w, h) nas
//    faces ou (espessura, comprimento) nos cortes. Flautas correm ao longo de Y (fluteAxis 'y') ou X.
// cardboardBox monta uma caixa aberta com abas a partir de placas; cardboardPolygon recorta uma placa de qualquer
// contorno, com furos (laterais triangulares das cunhas, tetos furados e paredes com respiro do túnel, tampa do tubo).

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RNG } from '../../core/rng.js';
import { createNoise3 } from '../kit/cpuNoise.js';

/**
 * @param {number} width largura (X, u)
 * @param {number} height altura (Y, u)
 * @param {number} [thickness] espessura (Z, u); papelão de caixa ≈ 3–4 mm = 3–4 u
 * @param {{fluteAxis?:'x'|'y', seed?:string|number, step?:number, jitter?:number, warp?:number}} [opts]
 */
export function cardboardPanel(width, height, thickness = 3.5, {
  fluteAxis = 'y',
  seed = 'papelao',
  step = 12,
  jitter = 0.45,
  warp = 1.1,
} = {}) {
  const rng = new RNG(`placa:${seed}`);
  const noise = createNoise3(rng.nextU32());
  const nx = Math.max(2, Math.ceil(width / step));
  const ny = Math.max(2, Math.ceil(height / step));
  const hw = width / 2;
  const hh = height / 2;
  const ht = thickness / 2;
  const phase = rng.float(0, 100);

  // Grade de pontos (x, y) com tremor só na borda (corte à mão) e empeno em Z (mesmo nas duas faces).
  const gx = [];
  const gy = [];
  const gz = [];
  for (let j = 0; j <= ny; j++) {
    for (let i = 0; i <= nx; i++) {
      let x = -hw + (width * i) / nx;
      let y = -hh + (height * j) / ny;
      const border = i === 0 || i === nx || j === 0 || j === ny;
      if (border) {
        const n = noise.noise(x * 0.05 + phase, y * 0.05, 0.5) * jitter + noise.noise(x * 0.3, y * 0.3, 2.1) * jitter * 0.4;
        if (i === 0 || i === nx) x += n;
        if (j === 0 || j === ny) y += n;
      }
      const bend = noise.noise(x * 0.004 + phase, y * 0.004, 7.7) * warp;
      gx.push(x);
      gy.push(y);
      gz.push(bend);
    }
  }
  const idx = (i, j) => j * (nx + 1) + i;

  const pos = [];
  const nrm = [];
  const uv = [];
  const board = [];
  const size = [];
  const index = [];
  const push = (x, y, z, n, u, v, b, s) => {
    pos.push(x, y, z);
    nrm.push(n[0], n[1], n[2]);
    uv.push(u, v);
    board.push(b[0], b[1], b[2], b[3]);
    size.push(s[0], s[1]);
    return pos.length / 3 - 1;
  };
  const faceBoard = (x, y) => (fluteAxis === 'y' ? [x + hw, y + hh, 0, 0] : [y + hh, x + hw, 0, 0]);
  const faceSize = fluteAxis === 'y' ? [width, height] : [height, width];

  // Faces frente (+Z) e verso (−Z). Normais aproximadas (o empeno é suave).
  for (const side of [1, -1]) {
    const base = pos.length / 3;
    for (let j = 0; j <= ny; j++) {
      for (let i = 0; i <= nx; i++) {
        const k = idx(i, j);
        push(gx[k], gy[k], gz[k] + side * ht, [0, 0, side], (gx[k] + hw) / width, (gy[k] + hh) / height,
          faceBoard(gx[k], gy[k]), faceSize);
      }
    }
    for (let j = 0; j < ny; j++) {
      for (let i = 0; i < nx; i++) {
        const a = base + idx(i, j);
        const b = base + idx(i + 1, j);
        const c = base + idx(i + 1, j + 1);
        const d = base + idx(i, j + 1);
        if (side > 0) index.push(a, b, c, a, c, d);
        else index.push(a, c, b, a, d, c);
      }
    }
  }

  // Cortes: faixas ligando frente e verso ao longo de cada borda.
  const edge = (points, outward, kind, lengthTotal) => {
    const base = pos.length / 3;
    let along = 0;
    for (let s = 0; s < points.length; s++) {
      const k = points[s];
      if (s > 0) {
        const p = points[s - 1];
        along += Math.hypot(gx[k] - gx[p], gy[k] - gy[p]);
      }
      const n = [outward[0], outward[1], 0];
      push(gx[k], gy[k], gz[k] - ht, n, along / lengthTotal, 0, [along, 0, kind, 0], [thickness, lengthTotal]);
      push(gx[k], gy[k], gz[k] + ht, n, along / lengthTotal, 1, [along, 0, kind, 1], [thickness, lengthTotal]);
    }
    for (let s = 0; s < points.length - 1; s++) {
      const a = base + s * 2;
      const b = base + s * 2 + 1;
      const c = base + s * 2 + 3;
      const d = base + s * 2 + 2;
      index.push(a, d, c, a, c, b);
    }
  };
  const row = (j) => Array.from({ length: nx + 1 }, (_, i) => idx(i, j));
  const col = (i) => Array.from({ length: ny + 1 }, (_, j) => idx(i, j));
  // Bordas horizontais (ao longo de X): transversais às flautas se elas correm em Y.
  const kindX = fluteAxis === 'y' ? 1 : 2;
  const kindY = fluteAxis === 'y' ? 2 : 1;
  edge(row(0), [0, -1], kindX, width);
  edge(row(ny).reverse(), [0, 1], kindX, width);
  edge(col(nx), [1, 0], kindY, height);
  edge(col(0).reverse(), [-1, 0], kindY, height);

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setAttribute('aBoard', new THREE.Float32BufferAttribute(board, 4));
  geo.setAttribute('aBoardSize', new THREE.Float32BufferAttribute(size, 2));
  geo.setIndex(index);
  // Normais das faces com o empeno (os cortes já têm a normal para fora da borda).
  geo.computeVertexNormals();
  geo.computeBoundingSphere();
  return geo;
}

/**
 * Caixa de papelão aberta em cima, com abas levemente abertas. Origem no centro do fundo. `step` = passo da grade das
 * placas (caixas grandes, como as da cerca da pista, usam um passo maior: o empeno é de baixa frequência).
 * `flaps` = [comprimento das abas das paredes largas (X), das paredes estreitas (Z)]; o padrão fecha a caixa (cada par
 * encontra o outro no meio). `bottom: false` omite o fundo (caixa apoiada que ninguém vê por baixo).
 * @param {number} w X · @param {number} h Y · @param {number} d Z
 */
export function cardboardBox(w, h, d, {
  thickness = 3.5, flapOpen = 0.35, seed = 'caixa', step = 12, flaps = null, bottom = true,
} = {}) {
  const parts = [];
  const place = (geo, matrix) => {
    geo.applyMatrix4(matrix);
    parts.push(geo);
  };
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const compose = (x, y, z, rx, ry, rz) => m.compose(new THREE.Vector3(x, y, z), q.setFromEuler(e.set(rx, ry, rz)), new THREE.Vector3(1, 1, 1)).clone();
  const t = thickness;
  // Laterais (flautas na vertical), fundo.
  place(cardboardPanel(w, h, t, { seed: `${seed}:f`, fluteAxis: 'y', step }), compose(0, h / 2, d / 2 - t / 2, 0, 0, 0));
  place(cardboardPanel(w, h, t, { seed: `${seed}:t`, fluteAxis: 'y', step }), compose(0, h / 2, -d / 2 + t / 2, 0, Math.PI, 0));
  place(cardboardPanel(d - 2 * t, h, t, { seed: `${seed}:l`, fluteAxis: 'y', step }), compose(-w / 2 + t / 2, h / 2, 0, 0, -Math.PI / 2, 0));
  place(cardboardPanel(d - 2 * t, h, t, { seed: `${seed}:r`, fluteAxis: 'y', step }), compose(w / 2 - t / 2, h / 2, 0, 0, Math.PI / 2, 0));
  if (bottom) place(cardboardPanel(w - 2 * t, d - 2 * t, t, { seed: `${seed}:b`, fluteAxis: 'x', step }), compose(0, t / 2, 0, -Math.PI / 2, 0, 0));
  // Abas: dobradas para fora pela linha do vinco, cada uma num ângulo um pouco diferente.
  const rng = new RNG(`abas:${seed}`);
  const flap = (len, width, x, z, ry) => {
    const g = cardboardPanel(width, len, t, { seed: `${seed}:aba${parts.length}`, fluteAxis: 'y', step });
    g.translate(0, len / 2, 0);
    // Rotação positiva em X inclina a aba para +Z local, que após `ry` é o lado de fora daquela parede.
    const open = flapOpen * rng.float(0.7, 1.3);
    g.applyMatrix4(new THREE.Matrix4().makeRotationX(open * Math.PI / 2));
    g.applyMatrix4(compose(x, h, z, 0, ry, 0));
    parts.push(g);
  };
  const [wide, narrow] = flaps ?? [d * 0.48, w * 0.42];
  flap(wide, w, 0, d / 2 - t / 2, 0);
  flap(wide, w, 0, -d / 2 + t / 2, Math.PI);
  flap(narrow, d - 2 * t, -w / 2 + t / 2, 0, -Math.PI / 2);
  flap(narrow, d - 2 * t, w / 2 - t / 2, 0, Math.PI / 2);
  const geo = mergeGeometries(parts, false);
  for (const p of parts) p.dispose();
  geo.computeBoundingSphere();
  return geo;
}

/** Reamostra um contorno fechado a cada ~`step` u, tremendo os pontos novos ao longo da normal (corte de estilete). */
function resampleOutline(points, step, jitter, noise) {
  const closed = points.length > 1 && points[0].equals(points[points.length - 1]) ? points.slice(0, -1) : points.slice();
  const out = [];
  for (let i = 0; i < closed.length; i++) {
    const a = closed[i];
    const b = closed[(i + 1) % closed.length];
    const len = a.distanceTo(b);
    if (len < 1e-6) continue;
    const n = Math.max(1, Math.ceil(len / step));
    const nx = (b.y - a.y) / len;
    const ny = -(b.x - a.x) / len;
    for (let k = 0; k < n; k++) {
      const t = k / n;
      const x = a.x + (b.x - a.x) * t;
      const y = a.y + (b.y - a.y) * t;
      // Os cantos do desenho ficam no lugar; só os pontos do meio das bordas tremem.
      const j = k === 0 ? 0 : (noise.noise(x * 0.09, y * 0.09, 1.7) + noise.noise(x * 0.4, y * 0.4, 5.3) * 0.35) * jitter;
      out.push(new THREE.Vector2(x + nx * j, y + ny * j));
    }
  }
  return out;
}

/** Distância de p ao contorno fechado `loop` (lista de Vector2). */
function outlineDistance(p, loop) {
  let best = Infinity;
  for (let i = 0; i < loop.length; i++) {
    const a = loop[i];
    const b = loop[(i + 1) % loop.length];
    const abx = b.x - a.x;
    const aby = b.y - a.y;
    const t = Math.max(0, Math.min(1, ((p.x - a.x) * abx + (p.y - a.y) * aby) / (abx * abx + aby * aby || 1)));
    best = Math.min(best, Math.hypot(p.x - a.x - abx * t, p.y - a.y - aby * t));
  }
  return best;
}

/**
 * Placa de papelão de qualquer contorno no plano XY (espessura em Z), recortada à mão: faces trianguladas do contorno
 * com os furos e subdivididas (triângulos de no máximo `step` u, para o empeno e para o gasto da borda), cortes em
 * todas as bordas (o tipo do corte segue o ângulo da borda com as flautas) e tremor de estilete no contorno.
 * Mesmos atributos do cardboardPanel; nas faces, aBoardSize = (−1, −1) avisa o shader que a distância até a borda de
 * fora (onde o manuseio escurece o papelão) vem pronta em aBoard.w — os furos são cortes novos, sem gasto.
 * @param {THREE.Shape} shape contorno em u (furos em shape.holes)
 * @param {number} [thickness] espessura (Z, u)
 */
export function cardboardPolygon(shape, thickness = 3.5, {
  fluteAxis = 'y', seed = 'recorte', jitter = 0.3, edgeStep = 8, step = 40, warp = 0.6, curveSegments = 12,
} = {}) {
  const rng = new RNG(`recorte:${seed}`);
  const noise = createNoise3(rng.nextU32());
  const phase = rng.float(0, 100);
  const ht = thickness / 2;
  const { shape: rawOuter, holes: rawHoles } = shape.extractPoints(curveSegments);
  const outer = resampleOutline(rawOuter, edgeStep, jitter, noise);
  if (THREE.ShapeUtils.isClockWise(outer)) outer.reverse();
  const holes = rawHoles.map((h) => {
    const loop = resampleOutline(h, edgeStep, jitter, noise);
    if (!THREE.ShapeUtils.isClockWise(loop)) loop.reverse();
    return loop;
  });
  const verts = [...outer, ...holes.flat()];
  // Subdivisão pela aresta mais longa (o ponto médio de uma aresta é o mesmo para os dois triângulos que a dividem).
  const mids = new Map();
  const midpoint = (a, b) => {
    const key = a < b ? `${a}:${b}` : `${b}:${a}`;
    let m = mids.get(key);
    if (m === undefined) {
      m = verts.length;
      verts.push(new THREE.Vector2((verts[a].x + verts[b].x) / 2, (verts[a].y + verts[b].y) / 2));
      mids.set(key, m);
    }
    return m;
  };
  const stack = THREE.ShapeUtils.triangulateShape(outer.slice(), holes.map((h) => h.slice())).map((t) => [...t]);
  const tris = [];
  const step2 = step * step;
  while (stack.length) {
    const [a, b, c] = stack.pop();
    const ab = verts[a].distanceToSquared(verts[b]);
    const bc = verts[b].distanceToSquared(verts[c]);
    const ca = verts[c].distanceToSquared(verts[a]);
    const longest = Math.max(ab, bc, ca);
    if (longest <= step2) {
      tris.push([a, b, c]);
      continue;
    }
    if (longest === ab) {
      const m = midpoint(a, b);
      stack.push([a, m, c], [m, b, c]);
    } else if (longest === bc) {
      const m = midpoint(b, c);
      stack.push([a, b, m], [a, m, c]);
    } else {
      const m = midpoint(c, a);
      stack.push([a, b, m], [m, b, c]);
    }
  }
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of verts) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  const w = Math.max(maxX - minX, 1e-3);
  const h = Math.max(maxY - minY, 1e-3);
  // Empeno (a mesma função nas duas faces) e a normal dele por diferença central.
  const bend = (x, y) => noise.noise(x * 0.004 + phase, y * 0.004, 7.7) * warp;
  const pos = [];
  const nrm = [];
  const uv = [];
  const board = [];
  const size = [];
  const index = [];
  const push = (x, y, z, n, u, v, b, s) => {
    pos.push(x, y, z);
    nrm.push(n[0], n[1], n[2]);
    uv.push(u, v);
    board.push(b[0], b[1], b[2], b[3]);
    size.push(s[0], s[1]);
    return pos.length / 3 - 1;
  };
  const wear = verts.map((p) => outlineDistance(p, outer));
  const faceBoard = (p, e) => (fluteAxis === 'y' ? [p.x - minX, p.y - minY, 0, e] : [p.y - minY, p.x - minX, 0, e]);
  for (const side of [1, -1]) {
    const base = pos.length / 3;
    verts.forEach((p, i) => {
      const z = bend(p.x, p.y);
      const gx = bend(p.x + 0.5, p.y) - bend(p.x - 0.5, p.y);
      const gy = bend(p.x, p.y + 0.5) - bend(p.x, p.y - 0.5);
      const l = Math.hypot(gx, gy, 1);
      push(p.x, p.y, z + side * ht, [(-gx / l) * side, (-gy / l) * side, side / l], (p.x - minX) / w, (p.y - minY) / h,
        faceBoard(p, wear[i]), [-1, -1]);
    });
    for (const [a, b, c] of tris) {
      const pa = verts[a];
      const cross = (verts[b].x - pa.x) * (verts[c].y - pa.y) - (verts[b].y - pa.y) * (verts[c].x - pa.x);
      if ((cross > 0) === (side > 0)) index.push(base + a, base + b, base + c);
      else index.push(base + a, base + c, base + b);
    }
  }
  // Cortes: um quadrilátero por trecho de cada contorno, com a normal para fora do material (contorno de fora no
  // sentido anti-horário e furos no horário: a direita do trecho é o lado de fora).
  const flute = fluteAxis === 'y' ? [0, 1] : [1, 0];
  for (const loop of [outer, ...holes]) {
    let total = 0;
    for (let i = 0; i < loop.length; i++) total += loop[i].distanceTo(loop[(i + 1) % loop.length]);
    let along = 0;
    for (let i = 0; i < loop.length; i++) {
      const a = loop[i];
      const b = loop[(i + 1) % loop.length];
      const len = a.distanceTo(b);
      if (len < 1e-6) continue;
      const dx = (b.x - a.x) / len;
      const dy = (b.y - a.y) / len;
      const n = [dy, -dx, 0];
      const kind = Math.abs(dx * flute[0] + dy * flute[1]) < 0.5 ? 1 : 2;
      const s = [thickness, total];
      const za = bend(a.x, a.y);
      const zb = bend(b.x, b.y);
      const v0 = push(a.x, a.y, za - ht, n, along / total, 0, [along, 0, kind, 0], s);
      const v1 = push(a.x, a.y, za + ht, n, along / total, 1, [along, 0, kind, 1], s);
      const v2 = push(b.x, b.y, zb - ht, n, (along + len) / total, 0, [along + len, 0, kind, 0], s);
      const v3 = push(b.x, b.y, zb + ht, n, (along + len) / total, 1, [along + len, 0, kind, 1], s);
      index.push(v0, v2, v1, v1, v2, v3);
      along += len;
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setAttribute('aBoard', new THREE.Float32BufferAttribute(board, 4));
  geo.setAttribute('aBoardSize', new THREE.Float32BufferAttribute(size, 2));
  geo.setIndex(index);
  geo.computeBoundingSphere();
  return geo;
}

/**
 * Tubo de papelão enrolado em espiral (tubo de forma, tubo de postal grande): superfícies de fora e de dentro com a
 * emenda helicoidal (tipo 3 no shader: aBoard = (arco, altura, 3, distância até a borda), aBoardSize = (circunferência,
 * passo da hélice)) e linhas de vértices perto das bordas para o gasto; bordas de cima e de baixo com as camadas de
 * papel (tipo 2). Eixo Y, de y = 0 a `height`; `radius` é o raio de dentro.
 */
export function woundTube(radius, height, wall, { pitch = 240, radial = 64, rowStep = 120 } = {}) {
  const rows = [0, 2, 5, 9, 14];
  for (let y = rowStep; y < height - 14; y += rowStep) rows.push(y);
  rows.push(height - 14, height - 9, height - 5, height - 2, height);
  rows.sort((a, b) => a - b);
  const pos = [];
  const nrm = [];
  const uv = [];
  const board = [];
  const size = [];
  const index = [];
  const push = (x, y, z, n, u, v, b, s) => {
    pos.push(x, y, z);
    nrm.push(n[0], n[1], n[2]);
    uv.push(u, v);
    board.push(b[0], b[1], b[2], b[3]);
    size.push(s[0], s[1]);
    return pos.length / 3 - 1;
  };
  const surface = (r, sign) => {
    const circ = Math.PI * 2 * r;
    const base = pos.length / 3;
    for (const y of rows) {
      for (let i = 0; i <= radial; i++) {
        const a = (i / radial) * Math.PI * 2;
        push(Math.cos(a) * r, y, Math.sin(a) * r, [Math.cos(a) * sign, 0, Math.sin(a) * sign], i / radial, y / height,
          [a * r, y, 3, Math.min(y, height - y)], [circ, pitch]);
      }
    }
    for (let j = 0; j + 1 < rows.length; j++) {
      for (let i = 0; i < radial; i++) {
        const a = base + j * (radial + 1) + i;
        const b = a + 1;
        const c = a + radial + 2;
        const d = a + radial + 1;
        if (sign > 0) index.push(a, d, c, a, c, b);
        else index.push(a, c, d, a, b, c);
      }
    }
  };
  surface(radius + wall, 1);
  surface(radius, -1);
  const circ = Math.PI * 2 * radius;
  for (const side of [1, -1]) {
    const base = pos.length / 3;
    const y = side > 0 ? height : 0;
    for (let i = 0; i <= radial; i++) {
      const a = (i / radial) * Math.PI * 2;
      push(Math.cos(a) * radius, y, Math.sin(a) * radius, [0, side, 0], i / radial, 0, [a * radius, 0, 2, 0], [wall, circ]);
      push(Math.cos(a) * (radius + wall), y, Math.sin(a) * (radius + wall), [0, side, 0], i / radial, 1, [a * radius, 0, 2, 1], [wall, circ]);
    }
    for (let i = 0; i < radial; i++) {
      const a = base + i * 2;
      const b = a + 1;
      const c = a + 3;
      const d = a + 2;
      // Borda de cima (side > 0) com a normal +Y: (dentro i, fora i+1, fora i) no sentido anti-horário visto de cima.
      if (side > 0) index.push(a, c, b, a, d, c);
      else index.push(a, b, c, a, c, d);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setAttribute('aBoard', new THREE.Float32BufferAttribute(board, 4));
  geo.setAttribute('aBoardSize', new THREE.Float32BufferAttribute(size, 2));
  geo.setIndex(index);
  geo.computeBoundingSphere();
  return geo;
}
