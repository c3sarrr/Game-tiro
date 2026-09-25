// Geometria de papelão ondulado cortado à mão (docs/art/moodboard.md: SSD4, SSD8, CSD16).
// Placa no plano XY (espessura em Z), com:
//  - faces subdivididas para o empeno leve (papelão nunca é plano) e bordas de corte com tremor de estilete;
//  - atributos para o shader (paperMaterials.js): aBoard = (x, y, tipo, através), aBoardSize = (w, h) nas
//    faces ou (espessura, comprimento) nos cortes. Flautas correm ao longo de Y (fluteAxis 'y') ou X.
// cardboardBox monta uma caixa aberta com abas a partir de placas.

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
 * Caixa de papelão aberta em cima, com abas levemente abertas. Origem no centro do fundo.
 * @param {number} w X · @param {number} h Y · @param {number} d Z
 */
export function cardboardBox(w, h, d, { thickness = 3.5, flapOpen = 0.35, seed = 'caixa' } = {}) {
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
  place(cardboardPanel(w, h, t, { seed: `${seed}:f`, fluteAxis: 'y' }), compose(0, h / 2, d / 2 - t / 2, 0, 0, 0));
  place(cardboardPanel(w, h, t, { seed: `${seed}:t`, fluteAxis: 'y' }), compose(0, h / 2, -d / 2 + t / 2, 0, Math.PI, 0));
  place(cardboardPanel(d - 2 * t, h, t, { seed: `${seed}:l`, fluteAxis: 'y' }), compose(-w / 2 + t / 2, h / 2, 0, 0, -Math.PI / 2, 0));
  place(cardboardPanel(d - 2 * t, h, t, { seed: `${seed}:r`, fluteAxis: 'y' }), compose(w / 2 - t / 2, h / 2, 0, 0, Math.PI / 2, 0));
  place(cardboardPanel(w - 2 * t, d - 2 * t, t, { seed: `${seed}:b`, fluteAxis: 'x' }), compose(0, t / 2, 0, -Math.PI / 2, 0, 0));
  // Abas: dobradas para fora pela linha do vinco, cada uma num ângulo um pouco diferente.
  const rng = new RNG(`abas:${seed}`);
  const flap = (len, width, x, z, ry) => {
    const g = cardboardPanel(width, len, t, { seed: `${seed}:aba${parts.length}`, fluteAxis: 'y' });
    g.translate(0, len / 2, 0);
    // Rotação positiva em X inclina a aba para +Z local, que após `ry` é o lado de fora daquela parede.
    const open = flapOpen * rng.float(0.7, 1.3);
    g.applyMatrix4(new THREE.Matrix4().makeRotationX(open * Math.PI / 2));
    g.applyMatrix4(compose(x, h, z, 0, ry, 0));
    parts.push(g);
  };
  flap(d * 0.48, w, 0, d / 2 - t / 2, 0);
  flap(d * 0.48, w, 0, -d / 2 + t / 2, Math.PI);
  flap(w * 0.42, d - 2 * t, -w / 2 + t / 2, 0, -Math.PI / 2);
  flap(w * 0.42, d - 2 * t, w / 2 - t / 2, 0, Math.PI / 2);
  const geo = mergeGeometries(parts, false);
  for (const p of parts) p.dispose();
  geo.computeBoundingSphere();
  return geo;
}
