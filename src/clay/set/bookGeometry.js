// Livro deitado (pista de testes: degraus das escadas, espiral da torre, caderninhos dos apoios do slide; BAS1, BAS4,
// BAS7, BAS9, BAS11, BAS15 no item 11 do moodboard). Quadro canônico: tamanho [comprimento (X), espessura (Y),
// profundidade (Z)], centrado na origem, lombada em +Z e boca (corte da frente) em −Z.
//  - Capa dura: capa inteiriça em "C" (duas pastas + lombada arredondada, com o vinco da dobradiça), maior que o miolo
//    (a "esquadria" de 1–3 u na cabeça, no pé e na boca); o miolo tem a boca levemente côncava (lombada arredondada).
//  - Brochura (caderninho): capa fina rente ao miolo, lombada quase reta.
// Atributos para o bookMaterial.js (todos os livros de um mapa num lote só, então todos com o mesmo conjunto):
//   aBookPart  0 = pano da capa · 1 = guarda (papel de dentro da capa) · 2 = borda das folhas · 3 = lombada
//   aBookUv    posição em u na parte (capa: x a partir do pé, z a partir da boca; lombada: x, arco a partir da
//              dobradiça de cima; folhas: ao longo, através da espessura; bordas das pastas e tampas: 0 = gasto máximo)
//   aBookDims  (comprimento, profundidade, arco da lombada) — o shader mede o gasto e mapeia o título; nas bordas
//              das folhas o terceiro valor é a espessura do miolo
//   aSpineRect célula do texto da lombada no atlas do mapa (u0, v0, largura, altura; zeros = sem texto)

import * as THREE from 'three';
import { RNG } from '../../core/rng.js';

/** Pontos do arco que passa pelas duas dobradiças (y = ±h, z = zh) e pelo ponto mais saliente (zs, 0), de cima para baixo. */
function arcPoints(zc, R, h, segments, sign) {
  const half = Math.asin(Math.min(1, h / R));
  const pts = [];
  for (let i = 0; i <= segments; i++) {
    const a = half - (2 * half * i) / segments;
    pts.push({ z: zc + Math.cos(a) * R, y: Math.sin(a) * R, n: [0, Math.sin(a) * sign, Math.cos(a) * sign] });
  }
  return { pts, half };
}

/** Quanto a lombada sai da dobradiça (capa dura arredondada, brochura quase reta). */
function spineBulge(T, hard) {
  return hard ? T * 0.28 : Math.max(0.15, T * 0.05);
}

/** Comprimento do arco da lombada de um livro de espessura T (o atlas das lombadas usa para não esticar o texto). */
export function spineArcLength(T, hard = true) {
  const j = spineBulge(T, hard);
  const h = T / 2;
  const R = (j * j + h * h) / (2 * j);
  return 2 * Math.asin(Math.min(1, h / R)) * R;
}

/**
 * @param {[number, number, number]} size [comprimento, espessura, profundidade] em u
 * @param {{hard?:boolean, spineRect?:number[], seed?:string}} [opts] `hard` = capa dura (padrão) ou brochura
 */
export function bookGeometry([L, T, D], { hard = true, spineRect = [0, 0, 0, 0], seed = 'livro' } = {}) {
  const rng = new RNG(`livro:${seed}`);
  const c = hard ? THREE.MathUtils.clamp(T * 0.12, 0.9, 2.4) : Math.min(0.45, T * 0.06);
  const sq = hard ? THREE.MathUtils.clamp(Math.min(L, D) * 0.012, 1.2, 3) : 0;
  const j = spineBulge(T, hard);
  const h = T / 2;
  const hl = L / 2;
  const zs = D / 2;
  const zh = zs - j;
  const R = (j * j + h * h) / (2 * j);
  const zc = zs - R;
  const arcSegs = hard ? 8 : 4;
  const outerArc = arcPoints(zc, R, h, arcSegs, 1);
  const arcLen = 2 * outerArc.half * R;
  const dims = [L, D, arcLen];

  const pos = [];
  const nrm = [];
  const part = [];
  const buv = [];
  const bdims = [];
  const rect = [];
  const index = [];
  const push = (x, y, z, n, p, u, v) => {
    pos.push(x, y, z);
    nrm.push(n[0], n[1], n[2]);
    part.push(p);
    buv.push(u, v);
    bdims.push(dims[0], dims[1], dims[2]);
    rect.push(spineRect[0], spineRect[1], spineRect[2], spineRect[3]);
    return pos.length / 3 - 1;
  };
  /**
   * Faixa ao longo de X (de −x a +x) entre dois pontos do perfil em YZ, cada um com a sua normal; o sentido dos
   * triângulos sai da normal pedida. `u` em cada ponta = coordenada da parte ao longo do perfil.
   */
  const strip = (a, b, x, p, uA, uB) => {
    const v0 = push(-x, a.y, a.z, a.n, p, hl - x, uA);
    const v1 = push(x, a.y, a.z, a.n, p, hl + x, uA);
    const v2 = push(-x, b.y, b.z, b.n, p, hl - x, uB);
    const v3 = push(x, b.y, b.z, b.n, p, hl + x, uB);
    // Triângulo (v0, v2, v1) tem normal ∝ (0, Δz, −Δy).
    const dy = b.y - a.y;
    const dz = b.z - a.z;
    const out = (a.n[1] + b.n[1]) * dz - (a.n[2] + b.n[2]) * dy;
    if (out > 0) index.push(v0, v2, v1, v1, v2, v3);
    else index.push(v0, v1, v2, v1, v3, v2);
  };
  /** Normal plana de um trecho do perfil, virada para o lado de `sign` em Y (pastas) ou pedida. */
  const flat = (a, b, want) => {
    const dy = b.y - a.y;
    const dz = b.z - a.z;
    const l = Math.hypot(dy, dz);
    let n = [0, dz / l, -dy / l];
    if (n[1] * want[1] + n[2] * want[2] < 0) n = [0, -n[1], -n[2]];
    return n;
  };
  const polyline = (pts, p, want, uOf) => {
    for (let i = 0; i + 1 < pts.length; i++) {
      const n = flat(pts[i], pts[i + 1], want);
      strip({ ...pts[i], n }, { ...pts[i + 1], n }, hl, p, uOf(pts[i]), uOf(pts[i + 1]));
    }
  };

  // Pastas de fora: da boca até a dobradiça, com o vinco (duas rampas rasas) perto da lombada.
  const board = (y) => {
    const pts = [{ z: -zs, y }];
    if (hard) {
      const gz = zh - Math.max(2.4, T * 0.18);
      const gw = Math.min(1.4, T * 0.08);
      const gd = Math.min(0.45, c * 0.3);
      pts.push({ z: gz - gw, y }, { z: gz, y: y - Math.sign(y) * gd }, { z: gz + gw, y });
    }
    pts.push({ z: zh, y });
    return pts;
  };
  const fromFore = (pt) => pt.z + zs;
  polyline(board(h), 0, [0, 1, 0], fromFore);
  polyline(board(-h), 0, [0, -1, 0], fromFore);
  // Lombada: normais do arco (sombreado liso), uv = arco a partir da dobradiça de cima.
  for (let i = 0; i < arcSegs; i++) {
    strip(outerArc.pts[i], outerArc.pts[i + 1], hl, 3, (arcLen * i) / arcSegs, (arcLen * (i + 1)) / arcSegs);
  }

  // Guarda (papel de dentro), a espessura da pasta para dentro; só aparece na fresta entre a capa e o miolo.
  const hi = h - c;
  const Ri = R - c;
  const innerHinge = zc + Math.sqrt(Math.max(Ri * Ri - hi * hi, 0));
  const innerArc = arcPoints(zc, Ri, hi, arcSegs, -1);
  polyline([{ z: -zs, y: hi }, { z: innerHinge, y: hi }], 1, [0, -1, 0], () => 0);
  polyline([{ z: -zs, y: -hi }, { z: innerHinge, y: -hi }], 1, [0, 1, 0], () => 0);
  for (let i = 0; i < arcSegs; i++) strip(innerArc.pts[i], innerArc.pts[i + 1], hl, 1, 0, 0);

  // Bordas das pastas na boca (pano dobrado por cima do papelão: gasto máximo).
  polyline([{ z: -zs, y: h }, { z: -zs, y: hi }], 0, [0, 0, -1], () => 0);
  polyline([{ z: -zs, y: -hi }, { z: -zs, y: -h }], 0, [0, 0, -1], () => 0);

  // Tampas na cabeça e no pé: o "C" da capa triangulado, normal ±X, gasto máximo (é a quina que roça em tudo).
  const ring = [
    ...board(h),
    ...outerArc.pts.slice(1, -1),
    ...board(-h).reverse(),
    { z: -zs, y: -hi },
    { z: innerHinge, y: -hi },
    ...innerArc.pts.slice(1, -1).reverse(),
    { z: innerHinge, y: hi },
    { z: -zs, y: hi },
  ];
  const cap = (poly2, x, p, uvOf) => {
    const tris = THREE.ShapeUtils.triangulateShape(poly2.slice(), []);
    for (const side of [1, -1]) {
      const base = pos.length / 3;
      for (const q of poly2) {
        const [u, v] = uvOf(q);
        push(side * x, q.y, q.x, [side, 0, 0], p, u, v);
      }
      for (const [a, b, cc] of tris) {
        const pa = poly2[a];
        // Em (z, y): z → x do Vector2. A normal em X do triângulo é −(produto vetorial 2D).
        const cross = (poly2[b].x - pa.x) * (poly2[cc].y - pa.y) - (poly2[b].y - pa.y) * (poly2[cc].x - pa.x);
        if ((cross > 0) === (side < 0)) index.push(base + a, base + b, base + cc);
        else index.push(base + a, base + cc, base + b);
      }
    }
  };
  cap(ring.map((q) => new THREE.Vector2(q.z, q.y)), hl, 0, () => [0, 0]);

  // Miolo: cabeça, pé e boca à mostra; na capa dura a boca é côncava (a lombada arredondada empurra as folhas).
  const tp = T - 2 * c;
  const hp = tp / 2 - 0.02;
  const xs = hl - sq;
  const zb = -zs + sq;
  const zBack = innerHinge + 0.2;
  const cup = hard ? Math.min(1.6, tp * 0.12) * rng.float(0.8, 1.2) : 0;
  dims[2] = 2 * hp;
  const rows = hard ? 6 : 2;
  const fore = [];
  for (let r = 0; r <= rows; r++) {
    const y = -hp + (2 * hp * r) / rows;
    const t = y / hp;
    // Normal da boca côncava: z = zb + cup·(1 − t²) → dz/dy = −2·cup·t/hp → n ∝ (0, dz/dy, −1).
    const dz = (-2 * cup * t) / hp;
    const l = Math.hypot(dz, 1);
    fore.push({ y, z: zb + cup * (1 - t * t), n: [0, dz / l, -1 / l] });
  }
  for (let r = 0; r < rows; r++) strip(fore[r], fore[r + 1], xs, 2, fore[r].y + hp, fore[r + 1].y + hp);
  const block = [...fore.map((q) => new THREE.Vector2(q.z, q.y)), new THREE.Vector2(zBack, hp), new THREE.Vector2(zBack, -hp)];
  cap(block, xs, 2, (q) => [q.x - zb, q.y + hp]);

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  geo.setAttribute('aBookPart', new THREE.Float32BufferAttribute(part, 1));
  geo.setAttribute('aBookUv', new THREE.Float32BufferAttribute(buv, 2));
  geo.setAttribute('aBookDims', new THREE.Float32BufferAttribute(bdims, 3));
  geo.setAttribute('aSpineRect', new THREE.Float32BufferAttribute(rect, 4));
  geo.setIndex(index);
  geo.computeBoundingSphere();
  return geo;
}
