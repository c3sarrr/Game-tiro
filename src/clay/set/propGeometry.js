// Geometria dos objetos do set feitos de material não-massa (docs/art/moodboard.md item 4):
// fita crepe (tira rasgada e rolo), arame de armadura (liso e torcido), ripa de balsa, ferramentas de
// modelar, estilete, pote de massinha e tubo de papelão. Tudo gerado por código, com irregularidade de
// "feito à mão" onde a peça real teria (rasgo da fita, corte da balsa), e precisão de peça industrial onde
// ela é industrial (estilete, pote).
// Convenções: medidas em u (10 u = 1 cm). Ferramentas e ripas ao longo de +X (eixo do veio/escovado).

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { RNG } from '../../core/rng.js';
import { createNoise3 } from '../kit/cpuNoise.js';

// ------------------------------------------------------------------ fita crepe

/**
 * Tira de fita crepe no plano XY (normal +Z), centrada. uv em u: x ao longo (0..length), y através (0..width).
 * Pontas rasgadas (serrilhado irregular) e, opcionalmente, pontas descolando da superfície.
 */
export function tapeStrip(length, width = 46, { seed = 'fita', tornEnds = true, lift = 0, step = 4 } = {}) {
  const rng = new RNG(`fita:${seed}`);
  const noise = createNoise3(rng.nextU32());
  const nL = Math.max(2, Math.ceil(length / step));
  const nW = 6;
  const pos = [];
  const uv = [];
  const index = [];
  // Rasgo: cada linha através da fita tem seu recuo, com dentes pequenos (fibras do crepe).
  const tear = (side, j) => {
    if (!tornEnds) return 0;
    const v = j / nW;
    return side * (Math.sin(v * 9.0 + rng.float(0, 6)) * 1.1 + noise.noise(v * 7.0, side * 3.3, 1.7) * 2.2 + rng.float(-0.6, 0.6));
  };
  const startTear = Array.from({ length: nW + 1 }, (_, j) => tear(1, j));
  const endTear = Array.from({ length: nW + 1 }, (_, j) => tear(-1, j));
  for (let j = 0; j <= nW; j++) {
    for (let i = 0; i <= nL; i++) {
      let x = (length * i) / nL;
      if (i === 0) x += Math.max(0, startTear[j]);
      if (i === nL) x += Math.min(0, endTear[j]);
      const y = (width * j) / nW;
      // Pontas descolando: sobem suavemente nos últimos ~2 cm.
      const endDist = Math.min(x, length - x);
      const z = lift * Math.max(0, 1 - endDist / 20) ** 2 + noise.noise(x * 0.02, y * 0.02, 5.5) * 0.25;
      pos.push(x - length / 2, y - width / 2, z);
      uv.push(x, y);
    }
  }
  for (let j = 0; j < nW; j++) {
    for (let i = 0; i < nL; i++) {
      const a = j * (nL + 1) + i;
      const b = a + 1;
      const c = a + nL + 2;
      const d = a + nL + 1;
      index.push(a, b, c, a, c, d);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(index);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Rolo de fita crepe deitado (eixo Y): superfície externa da fita, laterais (anéis de camadas) e o miolo de
 * papelão. Devolve { tape, sides, core } para materiais diferentes.
 */
export function tapeRoll({ outer = 48, inner = 38, width = 46, coreThickness = 4, seed = 'rolo' } = {}) {
  const radial = 64;
  // Superfície externa: cilindro aberto com uv em u (arco × largura) e a ponta solta levemente saliente.
  const tape = new THREE.CylinderGeometry(outer, outer, width, radial, 4, true);
  const uv = tape.attributes.uv;
  const p = tape.attributes.position;
  const rng = new RNG(`rolo:${seed}`);
  const tailAngle = rng.float(0, Math.PI * 2);
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const z = p.getZ(i);
    const a = Math.atan2(z, x);
    // Degrau da última volta (onde a ponta termina): 0,3 mm de espessura da fita.
    const rel = ((a - tailAngle + Math.PI * 4) % (Math.PI * 2)) / (Math.PI * 2);
    const bump = rel < 0.02 ? 0 : 0.3;
    const r = outer + bump;
    p.setXYZ(i, Math.cos(a) * r, p.getY(i), Math.sin(a) * r);
    uv.setXY(i, uv.getX(i) * Math.PI * 2 * outer, (p.getY(i) + width / 2));
  }
  tape.computeVertexNormals();
  // Laterais: anéis entre o miolo e a superfície externa (o shader desenha as camadas pelo raio).
  const ringInner = inner + coreThickness;
  const top = new THREE.RingGeometry(ringInner, outer, radial, 2).rotateX(-Math.PI / 2).translate(0, width / 2, 0);
  const bottom = new THREE.RingGeometry(ringInner, outer, radial, 2).rotateX(Math.PI / 2).translate(0, -width / 2, 0);
  const sides = mergeGeometries([top, bottom], false);
  top.dispose();
  bottom.dispose();
  const core = cardboardTube(inner, width + 0.6, coreThickness, { radial });
  return { tape, sides, core };
}

/**
 * Tubo de papelão (miolo de rolo) com atributos aBoard: faces interna/externa (tipo 0, sem flautas úteis) e
 * bordas (tipo 2: camadas de papel enrolado).
 */
export function cardboardTube(radius, height, thickness, { radial = 48 } = {}) {
  const pos = [];
  const nrm = [];
  const uv = [];
  const board = [];
  const size = [];
  const index = [];
  const circ = Math.PI * 2 * radius;
  const push = (x, y, z, n, b, s) => {
    pos.push(x, y, z);
    nrm.push(...n);
    uv.push(b[0] / circ, (y + height / 2) / height);
    board.push(...b);
    size.push(...s);
    return pos.length / 3 - 1;
  };
  const surface = (r, sign) => {
    const base = pos.length / 3;
    for (let j = 0; j <= 1; j++) {
      for (let i = 0; i <= radial; i++) {
        const a = (i / radial) * Math.PI * 2;
        const y = (j - 0.5) * height;
        push(Math.cos(a) * r, y, Math.sin(a) * r, [Math.cos(a) * sign, 0, Math.sin(a) * sign],
          [a * radius, y + height / 2, 0, 0], [circ, height]);
      }
    }
    for (let i = 0; i < radial; i++) {
      const a = base + i;
      const b = a + 1;
      const c = a + radial + 2;
      const d = a + radial + 1;
      if (sign > 0) index.push(a, d, c, a, c, b);
      else index.push(a, c, d, a, b, c);
    }
  };
  surface(radius + thickness, 1);
  surface(radius, -1);
  for (const side of [1, -1]) {
    const base = pos.length / 3;
    const y = (side * height) / 2;
    for (let i = 0; i <= radial; i++) {
      const a = (i / radial) * Math.PI * 2;
      push(Math.cos(a) * radius, y, Math.sin(a) * radius, [0, side, 0], [a * radius, 0, 2, 0], [thickness, circ]);
      push(Math.cos(a) * (radius + thickness), y, Math.sin(a) * (radius + thickness), [0, side, 0], [a * radius, 0, 2, 1], [thickness, circ]);
    }
    for (let i = 0; i < radial; i++) {
      const a = base + i * 2;
      const b = a + 1;
      const c = a + 3;
      const d = a + 2;
      if (side > 0) index.push(a, b, c, a, c, d);
      else index.push(a, c, b, a, d, c);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setAttribute('aBoard', new THREE.Float32BufferAttribute(board, 4));
  geo.setAttribute('aBoardSize', new THREE.Float32BufferAttribute(size, 2));
  geo.setIndex(index);
  return geo;
}

// ------------------------------------------------------------------ arame

/** Tubo ao longo de uma curva com uv.x = comprimento em u (estrias de trefilação em escala certa). */
export function wireGeometry(curve, radius = 0.8, { tubularSegments = null, radialSegments = 8, closed = false } = {}) {
  const length = curve.getLength();
  const segs = tubularSegments ?? Math.max(8, Math.ceil(length / 2.5));
  const geo = new THREE.TubeGeometry(curve, segs, radius, radialSegments, closed);
  const uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setX(i, uv.getX(i) * length);
  return geo;
}

/**
 * Par de arames torcidos (armadura de boneco): duas hélices em volta da curva guia.
 * @param {THREE.Curve} curve guia · @param {number} radius raio de cada fio · @param {number} pitch passo da torção (u)
 */
export function twistedWire(curve, radius = 0.7, pitch = 9) {
  const length = curve.getLength();
  const samples = Math.max(16, Math.ceil(length / 1.2));
  const frames = curve.computeFrenetFrames(samples, false);
  const strands = [];
  for (const phase of [0, Math.PI]) {
    const pts = [];
    for (let i = 0; i <= samples; i++) {
      const t = i / samples;
      const p = curve.getPointAt(t);
      const a = phase + (t * length / pitch) * Math.PI * 2;
      const off = frames.normals[i].clone().multiplyScalar(Math.cos(a) * radius * 1.02)
        .add(frames.binormals[i].clone().multiplyScalar(Math.sin(a) * radius * 1.02));
      pts.push(p.add(off));
    }
    strands.push(wireGeometry(new THREE.CatmullRomCurve3(pts), radius, { radialSegments: 7 }));
  }
  const geo = mergeGeometries(strands, false);
  for (const s of strands) s.dispose();
  return geo;
}

// ------------------------------------------------------------------ balsa

/** Ripa de balsa ao longo de X: quinas levemente amaciadas, pontas cortadas à mão, leve empeno. */
export function balsaStick(length, width = 10, height = 6, { seed = 'balsa' } = {}) {
  const geo = new RoundedBoxGeometry(length, height, width, 2, Math.min(width, height) * 0.06);
  const rng = new RNG(`balsa:${seed}`);
  const cutA = rng.float(-0.12, 0.12);
  const cutB = rng.float(-0.12, 0.12);
  const bow = rng.float(-0.8, 0.8);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i);
    const y = p.getY(i);
    const z = p.getZ(i);
    // Corte de estilete meio torto nas pontas (inclinação em Z) + empeno ao longo do comprimento.
    if (x > length / 2 - 1) x += z * cutA;
    if (x < -length / 2 + 1) x += z * cutB;
    const t = x / length;
    p.setXYZ(i, x, y + bow * (1 - 4 * t * t), z);
  }
  geo.computeVertexNormals();
  return geo;
}

// ------------------------------------------------------------------ ferramentas

// Perfil de revolução em volta de X: lista de [x, raio].
function latheX(profile, segments = 24) {
  const pts = profile.map(([x, r]) => new THREE.Vector2(Math.max(r, 0.001), x));
  const geo = new THREE.LatheGeometry(pts, segments);
  // Lathe gira em volta de Y: leva o eixo para X.
  geo.rotateZ(-Math.PI / 2);
  return geo;
}

/**
 * Ferramenta de modelar: cabo de madeira + ponta de metal, ao longo de +X, comprimento total `length`.
 * kind: 'espatula' | 'laco' | 'agulha' | 'bolinha'. Devolve { handle, metal }.
 */
export function sculptTool(kind, { length = 160 } = {}) {
  const handleLen = length * 0.58;
  const h0 = -length / 2;
  const handle = latheX([
    [h0, 0], [h0 + 0.8, 3.2], [h0 + 4, 3.8], [h0 + handleLen * 0.45, 4.3], [h0 + handleLen * 0.85, 3.6],
    [h0 + handleLen - 3, 3.2], [h0 + handleLen - 1, 3.4], [h0 + handleLen, 0],
  ]);
  const x0 = h0 + handleLen - 2;
  const ferrule = latheX([[x0, 0], [x0, 3.5], [x0 + 7, 3.4], [x0 + 9, 2.2], [x0 + 12, 1.4], [x0 + 12.5, 0]]);
  const neckEnd = x0 + (length / 2 - x0) * (kind === 'espatula' ? 0.45 : 0.62);
  const neck = new THREE.CylinderGeometry(1.2, 1.4, neckEnd - (x0 + 12), 12).rotateZ(-Math.PI / 2)
    .translate((neckEnd + x0 + 12) / 2, 0, 0);
  const tip = [];
  const tipLen = length / 2 - neckEnd;
  if (kind === 'espatula') {
    // Lâmina chata, cantos arredondados, afinando para a ponta.
    const shape = new THREE.Shape();
    const w0 = 3.2;
    const w1 = 7.5;
    shape.moveTo(0, -w0 / 2);
    shape.lineTo(tipLen * 0.8, -w1 / 2);
    shape.quadraticCurveTo(tipLen, -w1 / 2, tipLen, 0);
    shape.quadraticCurveTo(tipLen, w1 / 2, tipLen * 0.8, w1 / 2);
    shape.lineTo(0, w0 / 2);
    shape.lineTo(0, -w0 / 2);
    const blade = new THREE.ExtrudeGeometry(shape, { depth: 0.6, bevelEnabled: true, bevelThickness: 0.2, bevelSize: 0.25, bevelSegments: 2, curveSegments: 10 });
    blade.rotateX(Math.PI / 2).translate(neckEnd, 0.3, 0);
    tip.push(blade);
  } else if (kind === 'laco') {
    // Laço de fita metálica em gota.
    const pts = [];
    for (let i = 0; i <= 40; i++) {
      const a = (i / 40) * Math.PI * 2;
      pts.push(new THREE.Vector3(neckEnd + (1 - Math.cos(a)) * tipLen * 0.5, Math.sin(a) * 6 * (0.6 + 0.4 * Math.sin(a / 2)), 0));
    }
    tip.push(wireGeometry(new THREE.CatmullRomCurve3(pts, true), 0.55, { radialSegments: 6, closed: true }));
  } else if (kind === 'agulha') {
    tip.push(new THREE.ConeGeometry(1.1, tipLen, 12).rotateZ(-Math.PI / 2).translate(neckEnd + tipLen / 2, 0, 0));
  } else {
    tip.push(new THREE.CylinderGeometry(0.9, 1.1, tipLen - 3, 10).rotateZ(-Math.PI / 2).translate(neckEnd + (tipLen - 3) / 2, 0, 0));
    tip.push(new THREE.SphereGeometry(3, 16, 12).translate(length / 2 - 3, 0, 0));
  }
  const metalParts = [ferrule, neck, ...tip].map((g) => (g.index ? g.toNonIndexed() : g));
  for (const g of metalParts) {
    g.deleteAttribute('uv');
    if (!g.attributes.normal) g.computeVertexNormals();
  }
  const metal = mergeGeometries(metalParts, false);
  handle.deleteAttribute('uv');
  return { handle, metal };
}

/** Estilete de precisão: cabo de alumínio recartilhado, mandril cromado e lâmina triangular. { handle, collet, blade } */
export function craftKnife({ length = 140 } = {}) {
  const x0 = -length / 2;
  const prof = [[x0, 0], [x0 + 0.5, 3.6]];
  // Recartilhado: anéis finos alternados no cabo.
  for (let i = 0; i < 26; i++) {
    const x = x0 + 4 + i * 3;
    prof.push([x, 4.2], [x + 1.5, 4.0]);
  }
  prof.push([x0 + 84, 4.2], [x0 + 86, 3.6], [x0 + 87, 0]);
  const handle = latheX(prof, 20);
  const collet = latheX([[x0 + 86, 0], [x0 + 86, 4.4], [x0 + 96, 4.2], [x0 + 104, 3.0], [x0 + 110, 1.8], [x0 + 110.5, 0]], 20);
  const shape = new THREE.Shape();
  const bl = length / 2 - (x0 + 108);
  shape.moveTo(0, -2.2);
  shape.lineTo(bl, 1.6);
  shape.lineTo(bl * 0.12, 2.4);
  shape.lineTo(0, 2.4);
  shape.lineTo(0, -2.2);
  const blade = new THREE.ExtrudeGeometry(shape, { depth: 0.25, bevelEnabled: false }).rotateX(Math.PI / 2).translate(x0 + 108, 0.12, 0);
  handle.deleteAttribute('uv');
  collet.deleteAttribute('uv');
  blade.deleteAttribute('uv');
  return { handle, collet, blade };
}

// ------------------------------------------------------------------ pote de massinha

/**
 * Pote plástico de massinha (tipo massa de modelar escolar): corpo com parede, borda e fundo arredondado;
 * tampa com leve abaulado e saia. Origem no centro do fundo. { tub, lid, moldY }
 */
export function clayPot({ radius = 55, height = 62, wall = 2.4, lidHeight = 14 } = {}) {
  const r = radius;
  const tubProfile = [
    [0, 0], [r * 0.82, 0], [r * 0.94, 1.2], [r, 6], [r, height - 6], [r + 1.6, height - 5], [r + 1.6, height - 1],
    [r - 0.4, height], [r - wall, height], [r - wall, 6 + wall], [r * 0.82 - wall, wall], [0, wall],
  ];
  const tub = new THREE.LatheGeometry(tubProfile.map(([x, y]) => new THREE.Vector2(x, y)), 64);
  const lr = r + 2.6;
  // O Lathe gera a normal para fora quando a superfície externa é percorrida subindo: por isso a tampa começa
  // por dentro (centro de baixo), desce a saia por dentro, sobe por fora e termina no centro de cima.
  const lidProfile = [
    [0, lidHeight - 1.2], [lr * 0.88, lidHeight - 1.6], [lr - 1.6, lidHeight - 3.2], [lr - 1.6, 0], [lr, 0],
    [lr, lidHeight - 2.5], [lr * 0.9, lidHeight], [lr * 0.5, lidHeight + 1.4], [0, lidHeight + 1.8],
  ];
  const lid = new THREE.LatheGeometry(lidProfile.map(([x, y]) => new THREE.Vector2(x, y)), 64);
  for (const g of [tub, lid]) {
    g.deleteAttribute('uv');
    g.computeVertexNormals();
  }
  return { tub, lid, moldY: height * 0.5 };
}
