// Papelaria e ferramentas de medir do set (pista de testes; PRU1, PRU3, PRU15, TMA2, TMA6, TMA12, BWM10, CFO19 no
// item 11 do moodboard), na medida de verdade (1 u = 1 mm): lápis sextavado apontado, régua escolar com bisel, régua
// de aço, lâmina e gancho da trena, estojo da trena, espeto de bambu, alfinete de cabeça e bandeirinha de papel.
// Cada função devolve as geometrias por família de material — o mapa junta cada família num lote:
//   paint  → paintMaterials.paintMaterial (aPaint: 0 laca, 1 grafite, 2 borracha, 3 plástico brilhante)
//   measure→ measureMaterials.measureMaterial (uv em u; aMeasure = modo, comprimento, largura, espessura)
//   wood   → balsa tingida (veio ao longo do X local) · metal → cromado tingido · shell → plástico do estojo
// Convenção: objetos compridos ao longo de +X, centrados; o mapa gira para o eixo da peça.

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RNG } from '../../core/rng.js';

const TAU = Math.PI * 2;

/** Atributo constante em todos os vértices. */
function constant(geo, name, values) {
  const n = geo.attributes.position.count;
  const arr = new Float32Array(n * values.length);
  for (let i = 0; i < n; i++) arr.set(values, i * values.length);
  geo.setAttribute(name, new THREE.BufferAttribute(arr, values.length));
  return geo;
}

/** Sólido de revolução em volta de X a partir de [x, raio], com as normais do perfil. */
function latheX(profile, segments = 24) {
  const geo = new THREE.LatheGeometry(profile.map(([x, r]) => new THREE.Vector2(Math.max(r, 1e-4), x)), segments);
  geo.rotateZ(-Math.PI / 2);
  geo.deleteAttribute('uv');
  return geo;
}

/** Junta partes (todas com ou todas sem índice viram indexadas) sem uv. */
function join(parts) {
  const clean = parts.map((g) => {
    if (g.attributes.uv) g.deleteAttribute('uv');
    if (!g.index) {
      const idx = Array.from({ length: g.attributes.position.count }, (_, i) => i);
      g.setIndex(idx);
    }
    return g;
  });
  const geo = mergeGeometries(clean, false);
  for (const g of clean) g.dispose();
  return geo;
}

/**
 * Lápis preto sextavado (Ø7 entre faces, 175 u) ao longo de +X com a ponta em +X: corpo laqueado (face plana
 * embaixo), madeira do apontado com as "conchinhas" onde o cone corta as faces, grafite, virola de alumínio com os
 * frisos e borracha rosa gasta. A borracha sai à parte (é outra peça no lote de tinta, com a cor dela).
 * @returns {{paint:THREE.BufferGeometry, eraser:THREE.BufferGeometry, wood:THREE.BufferGeometry, metal:THREE.BufferGeometry}}
 */
export function pencilGeometry({ length = 175, across = 7, sharpen = 26, lead = 2.2, ferrule = 12, eraser = 8, seed = 'lapis' } = {}) {
  const rng = new RNG(`lapis:${seed}`);
  const x0 = -length / 2;
  const x1 = length / 2;
  const ap = across / 2;
  const round = ap * 1.1; // quinas levemente arredondadas (o sextavado de verdade tem o canto quebrado)
  const cols = 48;
  // Raio do sextavado no ângulo a (faces com normal em 0°, 60°, ...; a de 180° fica embaixo: y = r·cos a).
  const hexR = (a) => {
    const d = ((((a + Math.PI / 6) % (Math.PI / 3)) + Math.PI / 3) % (Math.PI / 3)) - Math.PI / 6;
    return Math.min(ap / Math.cos(d), round);
  };
  const hexN = (a) => {
    const d = ((((a + Math.PI / 6) % (Math.PI / 3)) + Math.PI / 3) % (Math.PI / 3)) - Math.PI / 6;
    return ap / Math.cos(d) < round ? a - d : a;
  };
  const xCone = x1 - sharpen;
  const slope = round / (sharpen + 0.9); // o cone termina num ponto rombudo (0,9 u além da ponta)
  const coneR = (x) => Math.max((x1 + 0.9 - x) * slope, 0);
  const xLead = x1 + 0.9 - lead / 2 / slope;
  const xBody0 = x0 + eraser + ferrule - 1.5;
  const pos = { paint: [], wood: [] };
  const nrm = { paint: [], wood: [] };
  const idx = { paint: [], wood: [] };
  const paintKind = { paint: [], wood: [] };
  // Grade (colunas em volta × linhas ao longo) de um trecho; `radius(x, a)` e `normal(x, a)`.
  const grid = (key, rows, radius, normal, kind = 0) => {
    const base = pos[key].length / 3;
    for (let r = 0; r < rows.length; r++) {
      for (let c = 0; c <= cols; c++) {
        const a = (c / cols) * TAU;
        const x = rows[r](a);
        const rr = radius(x, a);
        const n = normal(x, a);
        pos[key].push(x, Math.cos(a) * rr, Math.sin(a) * rr);
        nrm[key].push(n[0], n[1], n[2]);
        paintKind[key].push(kind);
      }
    }
    for (let r = 0; r + 1 < rows.length; r++) {
      for (let c = 0; c < cols; c++) {
        const a = base + r * (cols + 1) + c;
        const b = a + 1;
        const cc = a + cols + 2;
        const d = a + cols + 1;
        idx[key].push(a, b, cc, a, cc, d);
      }
    }
  };
  // Corpo laqueado: do fim da virola até a borda da madeira (que avança nas faces e recua nas quinas).
  const boundary = (a) => xCone + (round - hexR(a)) / slope;
  grid('paint', [() => xBody0, boundary], (x, a) => hexR(a), (x, a) => {
    const na = hexN(a);
    return [0, Math.cos(na), Math.sin(na)];
  });
  // Cone de madeira e grafite: raio do cone; normal com a componente ao longo do eixo.
  const coneNormal = (x, a) => {
    const l = Math.hypot(1, slope);
    return [slope / l, Math.cos(a) / l, Math.sin(a) / l];
  };
  const woodRows = [boundary];
  for (let k = 1; k <= 4; k++) woodRows.push((a) => boundary(a) + ((xLead - boundary(a)) * k) / 4);
  grid('wood', woodRows, (x) => coneR(x), coneNormal);
  const leadRows = [];
  for (let k = 0; k <= 4; k++) leadRows.push(() => xLead + ((x1 - 0.35 - xLead) * k) / 4);
  grid('paint', leadRows, (x) => coneR(x), coneNormal, 1);
  // Ponta rombuda do grafite.
  const turns = 24; // peças de revolução pequenas: 24 lados bastam
  const tip = latheX([[x1 - 0.35, coneR(x1 - 0.35)], [x1 - 0.12, 0.2], [x1, 0]], turns);
  // Virola: frisos apertados e duas cintas de crimpagem; borracha com a ponta gasta (achatada e torta).
  const fx0 = x0 + eraser - 2;
  const fr = ap * 1.04;
  const ferruleProfile = [[fx0, 0], [fx0, fr - 0.3], [fx0 + 0.4, fr]];
  for (let k = 0; k < 5; k++) {
    const xx = fx0 + 1.5 + k * 1.1;
    ferruleProfile.push([xx, fr], [xx + 0.35, fr + 0.18], [xx + 0.7, fr]);
  }
  ferruleProfile.push([fx0 + ferrule - 3, fr], [fx0 + ferrule - 2.4, fr - 0.28], [fx0 + ferrule - 1.8, fr], [fx0 + ferrule, fr - 0.1], [fx0 + ferrule + 0.2, ap * 0.9]);
  const metal = latheX(ferruleProfile, turns);
  const er = ap * 0.92;
  const wear = rng.float(0.8, 1.6);
  const eraserGeo = latheX([[x0 + wear * 0.25, 0], [x0 + 0.2 + wear * 0.2, er * 0.45], [x0 + 0.9, er * 0.86], [x0 + 2.2, er], [x0 + eraser, er]], turns);
  eraserGeo.applyMatrix4(new THREE.Matrix4().makeShear(0, 0, 0, 0, rng.float(-0.04, 0.04), 0));
  const build = (key) => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos[key], 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm[key], 3));
    g.setAttribute('aPaint', new THREE.Float32BufferAttribute(paintKind[key], 1));
    g.setIndex(idx[key]);
    return g;
  };
  constant(tip, 'aPaint', [1]);
  constant(eraserGeo, 'aPaint', [2]);
  const paint = join([build('paint'), tip]);
  const eraserPart = join([eraserGeo]);
  const wood = build('wood');
  wood.deleteAttribute('aPaint');
  return { paint, eraser: eraserPart, wood, metal };
}

/**
 * Régua escolar de madeira ao longo de +X (comprimento × espessura × largura), com o bisel da escala na borda +Z.
 * uv = (ao longo a partir da ponta −X, através a partir da borda do bisel) em u; aMeasure = (0, comprimento, largura,
 * espessura).
 */
export function rulerGeometry(length, thickness, width, { bevel = 7, edge = 1.1 } = {}) {
  const hz = width / 2;
  const top = thickness / 2;
  const bottom = -thickness / 2;
  // Perfil em (z, y) no sentido anti-horário visto de +X: fundo, borda do bisel, bisel, topo, costas.
  const prof = [
    { z: -hz, y: bottom }, { z: hz, y: bottom }, { z: hz, y: bottom + edge }, { z: hz - bevel, y: top }, { z: -hz, y: top },
  ];
  const pos = [];
  const nrm = [];
  const uv = [];
  const index = [];
  const hl = length / 2;
  // Coordenada "através" medida da borda do bisel pela superfície de cima (bisel + topo).
  const bevelLen = Math.hypot(bevel, top - bottom - edge);
  const across = (p) => {
    if (p.y <= bottom + edge && p.z >= hz - 1e-6) return 0;
    if (Math.abs(p.y - top) < 1e-6) return bevelLen + (hz - bevel - p.z);
    return 0;
  };
  for (let i = 0; i < prof.length; i++) {
    const a = prof[i];
    const b = prof[(i + 1) % prof.length];
    const dy = b.y - a.y;
    const dz = b.z - a.z;
    const l = Math.hypot(dy, dz);
    const n = [0, -dz / l, dy / l]; // perfil anti-horário em (z, y): a normal para fora fica à direita
    const base = pos.length / 3;
    for (const p of [a, b]) {
      for (const x of [-hl, hl]) {
        pos.push(x, p.y, p.z);
        nrm.push(n[0], n[1], n[2]);
        uv.push(x + hl, across(p));
      }
    }
    index.push(base, base + 1, base + 2, base + 1, base + 3, base + 2);
  }
  const ring = prof.map((p) => new THREE.Vector2(p.z, p.y));
  const tris = THREE.ShapeUtils.triangulateShape(ring.slice(), []);
  for (const side of [1, -1]) {
    const base = pos.length / 3;
    for (const p of prof) {
      pos.push(side * hl, p.y, p.z);
      nrm.push(side, 0, 0);
      uv.push(side > 0 ? length : 0, across(p));
    }
    for (const [a, b, c] of tris) {
      const pa = ring[a];
      const cross = (ring[b].x - pa.x) * (ring[c].y - pa.y) - (ring[b].y - pa.y) * (ring[c].x - pa.x);
      if ((cross > 0) === (side < 0)) index.push(base + a, base + b, base + c);
      else index.push(base + a, base + c, base + b);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(index);
  return constant(geo, 'aMeasure', [0, length, width, thickness]);
}

/** Régua de aço (chapa com os cantos arredondados) ao longo de +X; escala gravada a partir da borda +Z (aMeasure modo 1). */
export function steelRulerGeometry(length, thickness, width, { corner = 1.5 } = {}) {
  const hl = length / 2;
  const hw = width / 2;
  const s = new THREE.Shape();
  s.moveTo(-hl + corner, -hw);
  s.lineTo(hl - corner, -hw);
  s.quadraticCurveTo(hl, -hw, hl, -hw + corner);
  s.lineTo(hl, hw - corner);
  s.quadraticCurveTo(hl, hw, hl - corner, hw);
  s.lineTo(-hl + corner, hw);
  s.quadraticCurveTo(-hl, hw, -hl, hw - corner);
  s.lineTo(-hl, -hw + corner);
  s.quadraticCurveTo(-hl, -hw, -hl + corner, -hw);
  const geo = new THREE.ExtrudeGeometry(s, { depth: thickness, bevelEnabled: false, curveSegments: 4 });
  // Forma no plano XY com a espessura em Z → espessura em Y (Z da forma vira −Y), centrada.
  geo.rotateX(Math.PI / 2);
  geo.translate(0, thickness / 2, 0);
  const p = geo.attributes.position;
  const uv = geo.attributes.uv;
  for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) + hl, hw - p.getZ(i));
  return constant(geo, 'aMeasure', [1, length, width, thickness]);
}

/**
 * Lâmina da trena no plano XY (normal +Z, como a fita crepe deitada), do gancho (x = 0 no zero) até `length`:
 * seção em calha (as bordas levantam `cup`) e o começo erguido pelo gancho apoiado no chão. uv = (ao longo, através
 * a partir da borda −Y); aMeasure = (2, comprimento, largura, 0). Devolve também o gancho (metal) e os rebites.
 */
export function tapeBladeGeometry(length, width, { cup = 1.1, hook = 5, lift = 44, segment = 100 } = {}) {
  const across = 6;
  const along = [0];
  for (let x = 4; x < lift; x += 4) along.push(x);
  for (let x = lift; x < length; x += segment) along.push(x);
  along.push(length);
  const pos = [];
  const uv = [];
  const index = [];
  const hw = width / 2;
  const z = (x, y) => {
    const t = THREE.MathUtils.clamp(1 - x / lift, 0, 1);
    return cup * (y / hw) ** 2 + hook * t * t * (3 - 2 * t);
  };
  for (const x of along) {
    for (let j = 0; j <= across; j++) {
      const y = -hw + (width * j) / across;
      pos.push(x - length / 2, y, z(x, y));
      uv.push(x, y + hw);
    }
  }
  for (let i = 0; i + 1 < along.length; i++) {
    for (let j = 0; j < across; j++) {
      const a = i * (across + 1) + j;
      index.push(a, a + across + 1, a + 1, a + 1, a + across + 1, a + across + 2);
    }
  }
  const blade = new THREE.BufferGeometry();
  blade.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  blade.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  blade.setIndex(index);
  blade.computeVertexNormals();
  constant(blade, 'aMeasure', [2, length, width, 0]);
  // Gancho: chapinha rebitada por cima da lâmina e a aba dobrada para baixo até o chão, na ponta do zero.
  const x0 = -length / 2;
  const plate = new THREE.BoxGeometry(11, width + 1, 0.6).translate(x0 + 5.5, 0, hook + 0.45);
  const tab = new THREE.BoxGeometry(0.8, width + 1, hook + 0.9).translate(x0 - 0.4, 0, (hook + 0.9) / 2 - 0.3);
  const parts = [plate, tab];
  for (const y of [-width * 0.22, width * 0.22]) {
    parts.push(new THREE.SphereGeometry(1.1, 10, 6, 0, TAU, 0, Math.PI / 2).rotateX(Math.PI / 2).translate(x0 + 6.5, y, hook + 0.75));
  }
  return { blade, hook: join(parts) };
}

/**
 * Estojo da trena (tamanho [x, y, z], centrado): casca de plástico amarelo de cantos redondos com a boca da lâmina
 * embaixo na frente (−X), laterais de borracha com o rebaixo redondo, trava em cima, clipe de cinto de aço num lado e
 * parafusos. { shell, rubber (aPaint 2), metal }
 */
export function tapeCaseGeometry([w, h, d]) {
  // A casca é extrudada com chanfro arredondado: o contorno encolhe o tamanho do chanfro para a caixa final caber em
  // [w, h, d]; as laterais de borracha (1,8 u de saliência) entram na profundidade.
  const bevel = 3;
  const bs = bevel * 0.8;
  const hw = w / 2 - bs;
  const hh = h / 2 - bs;
  const r = Math.min(w, h) * 0.2;
  const mouth = 4;
  const shellDepth = d - 3.6;
  const s = new THREE.Shape();
  s.moveTo(-hw + mouth, -hh);
  s.lineTo(hw - r, -hh);
  s.quadraticCurveTo(hw, -hh, hw, -hh + r);
  s.lineTo(hw, hh - r);
  s.quadraticCurveTo(hw, hh, hw - r, hh);
  s.lineTo(-hw + r, hh);
  s.quadraticCurveTo(-hw, hh, -hw, hh - r);
  s.lineTo(-hw, -hh + mouth);
  s.lineTo(-hw + mouth, -hh);
  const shell = new THREE.ExtrudeGeometry(s, {
    depth: shellDepth - 2 * bevel, bevelEnabled: true, bevelThickness: bevel, bevelSize: bs, bevelSegments: 3, curveSegments: 6,
  }).translate(0, 0, -(shellDepth - 2 * bevel) / 2);
  shell.deleteAttribute('uv');
  // Laterais de borracha: placa arredondada levemente saliente com o rebaixo redondo do emblema.
  const side = new THREE.Shape();
  const sr = r * 0.8;
  const sw = hw * 0.78;
  const sh = hh * 0.78;
  side.moveTo(-sw + sr, -sh);
  side.lineTo(sw - sr, -sh);
  side.quadraticCurveTo(sw, -sh, sw, -sh + sr);
  side.lineTo(sw, sh - sr);
  side.quadraticCurveTo(sw, sh, sw - sr, sh);
  side.lineTo(-sw + sr, sh);
  side.quadraticCurveTo(-sw, sh, -sw, sh - sr);
  side.lineTo(-sw, -sh + sr);
  side.quadraticCurveTo(-sw, -sh, -sw + sr, -sh);
  side.holes.push(new THREE.Path().absarc(0, 0, sh * 0.42, 0, TAU, true));
  const rubberParts = [];
  for (const sgn of [1, -1]) {
    const g = new THREE.ExtrudeGeometry(side, { depth: 1.6, bevelEnabled: true, bevelThickness: 0.6, bevelSize: 0.6, bevelSegments: 2, curveSegments: 8 });
    if (sgn < 0) g.rotateY(Math.PI);
    g.translate(0, 0, sgn * (shellDepth / 2 - 0.4));
    rubberParts.push(g);
    const emblem = new THREE.CylinderGeometry(sh * 0.42, sh * 0.42, 0.8, 32).rotateX(Math.PI / 2).translate(0, 0, sgn * (shellDepth / 2 + 0.6));
    rubberParts.push(emblem);
  }
  // Trava: botão de borracha em cima, perto da frente.
  rubberParts.push(new THREE.BoxGeometry(18, 5, 12, 2, 1, 2).translate(-hw * 0.35, h / 2 + 1.5, 0));
  const rubber = constant(join(rubberParts), 'aPaint', [2]);
  // Clipe de cinto: chapa dobrada presa no lado −Z, com dois parafusos.
  const clip = new THREE.BoxGeometry(12, h * 0.72, 1.2).translate(hw * 0.25, -h * 0.06, -d / 2 - 1.4);
  const clipTop = new THREE.BoxGeometry(12, 1.2, 2.6).translate(hw * 0.25, h * 0.3, -d / 2 - 0.5);
  // Parafusos nos cantos da casca, fora da placa de borracha.
  const screws = [];
  for (const [x, y] of [[-hw + 6, -hh + 6], [hw - 6, hh - 6], [-hw + 6, hh - 6]]) {
    screws.push(new THREE.CylinderGeometry(1.6, 1.6, 0.6, 12).rotateX(Math.PI / 2).translate(x, y, shellDepth / 2 + 0.3));
  }
  return { shell, rubber, metal: join([clip, clipTop, ...screws]) };
}

/** Espeto de bambu ao longo de +X (Ø = 2·radius), ponta afiada em +X e a outra ponta cortada com o canto quebrado. */
export function skewerGeometry(length, radius, { point = 14, seed = 'espeto' } = {}) {
  const rng = new RNG(`espeto:${seed}`);
  const x0 = -length / 2;
  const x1 = length / 2;
  const prof = [[x0, 0], [x0, radius * 0.8], [x0 + 0.4, radius]];
  const bend = rng.float(-0.3, 0.3);
  for (let k = 1; k < 8; k++) prof.push([x0 + ((x1 - point - x0) * k) / 8, radius * (1 + bend * 0.01 * Math.sin(k))]);
  prof.push([x1 - point, radius], [x1 - point * 0.35, radius * 0.4], [x1 - 0.2, 0.15], [x1, 0]);
  return latheX(prof, 12);
}

/**
 * Alfinete de cabeça: haste de aço de `length` descendo de y = 0 (a ponta enterrada na madeira) e a bolinha de plástico
 * em cima. { shaft (metal), head (aPaint 3) } com a origem no ponto onde a haste entra na superfície.
 */
export function pinGeometry({ length = 30, buried = 11, head = 3.8 } = {}) {
  const above = length - buried;
  const shaft = new THREE.CylinderGeometry(0.32, 0.32, length - 0.8, 8).translate(0, above - (length - 0.8) / 2, 0);
  const point = new THREE.ConeGeometry(0.32, 0.8, 8).rotateX(Math.PI).translate(0, -buried + 0.4, 0);
  const ball = new THREE.SphereGeometry(head / 2, 16, 12).translate(0, above + head / 2 - 0.4, 0);
  ball.deleteAttribute('uv');
  return { shaft: join([shaft, point]), head: constant(ball, 'aPaint', [3]) };
}

/**
 * Bandeirinha de largada: palito de dente (Ø2, pontas afinadas) em pé a partir de y = 0 e a bandeira de papel colada
 * em volta do palito perto do topo, com uma leve ondulação. A bandeira tem frente e verso (uv 0..1 da célula, verso
 * espelhado). { stick (madeira), paper (uv) }
 */
export function flagGeometry({ stick = 95, width = 42, height = 28, wave = 2.2, seed = 'bandeira' } = {}) {
  const rng = new RNG(`bandeira:${seed}`);
  const stickGeo = latheX([[0, 0], [0.2, 0.35], [2.5, 1], [stick - 2.5, 1], [stick - 0.2, 0.35], [stick, 0]], 10).rotateZ(Math.PI / 2);
  const cols = 12;
  const rows = 4;
  const top = stick - 6;
  const pos = [];
  const uv = [];
  const nrm = [];
  const index = [];
  const phase = rng.float(0, TAU);
  // A folha sai colada no palito e ondula mais para a ponta solta.
  const at = (u, v) => [1.05 + u * width, top - height + v * height, Math.sin(u * 5.2 + phase) * wave * u];
  for (const side of [1, -1]) {
    const base = pos.length / 3;
    for (let r = 0; r <= rows; r++) {
      for (let c = 0; c <= cols; c++) {
        const u = c / cols;
        const v = r / rows;
        const [x, y, zz] = at(u, v);
        const dz = Math.cos(u * 5.2 + phase) * 5.2 * wave * u / width + Math.sin(u * 5.2 + phase) * wave / width;
        const l = Math.hypot(dz, 1);
        pos.push(x, y, zz + side * 0.06);
        nrm.push((-dz / l) * side, 0, (1 / l) * side);
        uv.push(side > 0 ? u : 1 - u, v);
      }
    }
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const a = base + r * (cols + 1) + c;
        if (side > 0) index.push(a, a + 1, a + cols + 2, a, a + cols + 2, a + cols + 1);
        else index.push(a, a + cols + 2, a + 1, a, a + cols + 1, a + cols + 2);
      }
    }
  }
  const paper = new THREE.BufferGeometry();
  paper.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  paper.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  paper.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  paper.setIndex(index);
  return { stick: stickGeo, paper };
}
