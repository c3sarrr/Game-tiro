// Equipamento de luz visível no set (seção 0.13: "luzes de softbox visíveis como formas"; referências
// SSD14, CSD14, SMD13 e a luminária de mesa SMD3 em docs/art/moodboard.md item 2):
//  - softbox: corpo de tecido preto em tronco de pirâmide levemente estufado, difusor emissivo recuado com
//    costura, anel de encaixe e cabeça da luz atrás;
//  - fresnel: corpo metálico com aletas, lente emissiva com anéis, bandeiras (barn doors) abertas e garfo;
//  - tripé C-stand: base "tartaruga" de três pernas em alturas diferentes, coluna, cabeça de engate cromada e
//    braço até a luz;
//  - luminária de mesa (prática): base pesada, dois braços com molas, cúpula esmaltada e lâmpada.
// Tudo em espaço local com a frente em +Z; a montagem de luz posiciona e aponta (lookAt) para o alvo.

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { wireGeometry } from '../../clay/set/propGeometry.js';

const Z_AXIS = new THREE.Vector3(0, 0, 1);

/** Grade de um quadrilátero (cantos a,b,c,d em ordem) com estufado ao longo de `bulgeDir`. */
function bulgedQuad(a, b, c, d, bulgeDir, bulge, seg = 6) {
  const pos = [];
  const index = [];
  const p = new THREE.Vector3();
  const top = new THREE.Vector3();
  const bottom = new THREE.Vector3();
  for (let j = 0; j <= seg; j++) {
    const v = j / seg;
    for (let i = 0; i <= seg; i++) {
      const u = i / seg;
      bottom.lerpVectors(a, b, u);
      top.lerpVectors(d, c, u);
      p.lerpVectors(bottom, top, v).addScaledVector(bulgeDir, bulge * Math.sin(Math.PI * u) * Math.sin(Math.PI * v));
      pos.push(p.x, p.y, p.z);
    }
  }
  for (let j = 0; j < seg; j++) {
    for (let i = 0; i < seg; i++) {
      const k = j * (seg + 1) + i;
      index.push(k, k + 1, k + seg + 2, k, k + seg + 2, k + seg + 1);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(index);
  geo.computeVertexNormals();
  return geo;
}

function alongZ(geo) {
  return geo.rotateX(Math.PI / 2);
}

function finish(parts) {
  const clean = parts.map((g) => {
    const n = g.index ? g.toNonIndexed() : g;
    if (n !== g) g.dispose();
    if (n.attributes.uv) n.deleteAttribute('uv');
    if (!n.attributes.normal) n.computeVertexNormals();
    return n;
  });
  const geo = mergeGeometries(clean, false);
  for (const g of clean) g.dispose();
  return geo;
}

/**
 * Softbox com a frente em z = 0 olhando para +Z.
 * @returns {{group:THREE.Group, mount:THREE.Vector3, geometries:THREE.BufferGeometry[]}} mount = ponto de
 *   encaixe do braço (espaço local, embaixo da cabeça da luz)
 */
export function buildSoftbox(set, { width, height, depth, emission, color }) {
  const hw = width / 2;
  const hh = height / 2;
  const r = Math.min(width, height) * 0.13;
  const z1 = -depth;
  const out = new THREE.Vector3();
  const faces = [];
  const corners = [
    [new THREE.Vector3(-hw, -hh, 0), new THREE.Vector3(hw, -hh, 0), new THREE.Vector3(r, -r, z1), new THREE.Vector3(-r, -r, z1)],
    [new THREE.Vector3(hw, -hh, 0), new THREE.Vector3(hw, hh, 0), new THREE.Vector3(r, r, z1), new THREE.Vector3(r, -r, z1)],
    [new THREE.Vector3(hw, hh, 0), new THREE.Vector3(-hw, hh, 0), new THREE.Vector3(-r, r, z1), new THREE.Vector3(r, r, z1)],
    [new THREE.Vector3(-hw, hh, 0), new THREE.Vector3(-hw, -hh, 0), new THREE.Vector3(-r, -r, z1), new THREE.Vector3(-r, r, z1)],
  ];
  for (const [a, b, c, d] of corners) {
    const mid = new THREE.Vector3().add(a).add(b).add(c).add(d).multiplyScalar(0.25);
    out.set(mid.x, mid.y, 0).normalize();
    faces.push(bulgedQuad(a, b, c, d, out.clone(), Math.min(width, height) * 0.035));
  }
  // Fundo do corpo (tampa traseira) em volta do anel.
  faces.push(new THREE.PlaneGeometry(r * 2, r * 2).rotateY(Math.PI).translate(0, 0, z1));
  const body = finish(faces);
  // Tecido é de dupla face (o material vem com DoubleSide): as faces do tronco apontam para dentro.
  const bodyMesh = new THREE.Mesh(body, set.fabric());

  const diffuserGeo = new THREE.PlaneGeometry(width - 8, height - 8).translate(0, 0, -3);
  const diffuser = new THREE.Mesh(diffuserGeo, set.diffuser({ color, emission, hotspot: 0.3 }));
  diffuser.name = 'difusor';

  const ringR = r * 0.95;
  const ring = alongZ(new THREE.CylinderGeometry(ringR, ringR, 6, 28)).translate(0, 0, z1 - 3);
  const headLen = depth * 0.42;
  const head = alongZ(new THREE.CylinderGeometry(r * 0.62, r * 0.7, headLen, 24)).translate(0, 0, z1 - 6 - headLen / 2);
  const fan = alongZ(new THREE.CylinderGeometry(r * 0.5, r * 0.5, 4, 24)).translate(0, 0, z1 - 8 - headLen);
  const spigot = new THREE.CylinderGeometry(3, 3, 26, 12).translate(0, -r * 0.62 - 13, z1 - 6 - headLen * 0.5);
  const metal = new THREE.Mesh(finish([ring, head, fan, spigot]), set.blackMetal());

  const group = new THREE.Group();
  group.name = 'softbox';
  group.add(bodyMesh, diffuser, metal);
  for (const o of group.children) {
    o.castShadow = o !== diffuser;
    o.receiveShadow = true;
  }
  return {
    group,
    mount: new THREE.Vector3(0, -r * 0.62 - 26, z1 - 6 - headLen * 0.5),
    geometries: [body, diffuserGeo, metal.geometry],
  };
}

/** Fresnel com a lente em z = 0 olhando para +Z. */
export function buildFresnel(set, { radius, length, emission, color }) {
  const R = radius;
  const L = length;
  const parts = [];
  parts.push(alongZ(new THREE.CylinderGeometry(R, R * 1.05, L, 32, 1, true)).translate(0, 0, -L / 2));
  parts.push(new THREE.CircleGeometry(R * 1.05, 32).rotateY(Math.PI).translate(0, 0, -L));
  // Aletas de ventilação ao longo do corpo e aro da frente.
  for (let i = 1; i <= 5; i++) {
    parts.push(new THREE.TorusGeometry(R + 0.9, 0.9, 6, 32).translate(0, 0, -L * (0.3 + i * 0.11)));
  }
  parts.push(new THREE.TorusGeometry(R, 2, 8, 32).translate(0, 0, -0.5));
  // Bandeiras: quatro abas presas no aro, abertas em ângulos diferentes.
  const flap = (w, len, rot, openDeg) => {
    const g = new THREE.BoxGeometry(w, 0.8, len).translate(0, 0, len / 2);
    g.applyMatrix4(new THREE.Matrix4().makeRotationX(-THREE.MathUtils.degToRad(openDeg)));
    g.translate(0, R + 1.5, 0);
    g.applyMatrix4(new THREE.Matrix4().makeRotationZ(rot));
    return g;
  };
  parts.push(flap(R * 2, R * 1.1, 0, 38), flap(R * 2, R * 1.1, Math.PI, 44));
  parts.push(flap(R * 1.6, R * 0.9, Math.PI / 2, 52), flap(R * 1.6, R * 0.9, -Math.PI / 2, 47));
  // Garfo (U) dos lados do corpo até o pino de baixo.
  const yokeW = R + 4;
  parts.push(new THREE.BoxGeometry(2.4, R * 1.3, 6).translate(yokeW, -R * 0.35, -L * 0.45));
  parts.push(new THREE.BoxGeometry(2.4, R * 1.3, 6).translate(-yokeW, -R * 0.35, -L * 0.45));
  parts.push(new THREE.BoxGeometry(yokeW * 2 + 2.4, 2.4, 6).translate(0, -R - 0.4, -L * 0.45));
  parts.push(new THREE.CylinderGeometry(3, 3, 24, 12).translate(0, -R - 12, -L * 0.45));
  const body = new THREE.Mesh(finish(parts), set.blackMetal());
  const lensGeo = new THREE.CircleGeometry(R * 0.86, 40).translate(0, 0, 0.4);
  // uv do círculo vai de 0 a 1: o difusor desenha os anéis da lente de Fresnel pelo raio.
  const lens = new THREE.Mesh(lensGeo, set.diffuser({ color, emission, hotspot: 0.55, seam: false, rings: true }));
  lens.name = 'lente';
  const group = new THREE.Group();
  group.name = 'fresnel';
  group.add(body, lens);
  body.castShadow = true;
  body.receiveShadow = true;
  return { group, mount: new THREE.Vector3(0, -R - 24, -L * 0.45), geometries: [body.geometry, lensGeo] };
}

/**
 * Tripé C-stand em espaço de mundo: da base no chão (floorY) até o ponto de encaixe `mountWorld`.
 * A coluna fica deslocada para trás (longe do alvo) e um braço horizontal vai até a luz.
 */
export function buildCStand(set, { mountWorld, awayDir, floorY }) {
  const away = awayDir.clone().setY(0).normalize();
  const columnPos = mountWorld.clone().addScaledVector(away, 70).setY(floorY);
  const top = mountWorld.y;
  const metalParts = [];
  const chromeParts = [];
  const tube = (from, to, r) => {
    const dir = new THREE.Vector3().subVectors(to, from);
    const len = dir.length();
    const g = new THREE.CylinderGeometry(r, r, len, 12);
    g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize()));
    g.translate((from.x + to.x) / 2, (from.y + to.y) / 2, (from.z + to.z) / 2);
    return g;
  };
  // Base "tartaruga": três pernas em alturas diferentes (encaixam uma sobre a outra no tripé real).
  const hub = columnPos.clone().setY(floorY + 42);
  for (let k = 0; k < 3; k++) {
    const a = (k / 3) * Math.PI * 2 + Math.atan2(away.z, away.x);
    const foot = columnPos.clone().add(new THREE.Vector3(Math.cos(a) * 95, 3, Math.sin(a) * 95));
    const knee = hub.clone().setY(floorY + 42 - k * 9);
    metalParts.push(tube(knee, foot, 2.2));
    const pad = new THREE.CylinderGeometry(3.5, 4, 5, 12).translate(foot.x, floorY + 2.5, foot.z);
    metalParts.push(pad);
  }
  // Coluna em duas seções (a de cima mais fina) com os anéis de trava cromados.
  const mid = columnPos.clone().setY((floorY + 42 + top) / 2);
  const colTop = columnPos.clone().setY(top + 6);
  metalParts.push(tube(hub, mid, 2.8), tube(mid, colTop, 2.2));
  chromeParts.push(new THREE.CylinderGeometry(4.2, 4.2, 8, 16).translate(mid.x, mid.y, mid.z));
  chromeParts.push(new THREE.CylinderGeometry(3.6, 3.6, 7, 16).translate(hub.x, hub.y, hub.z));
  // Cabeça de engate (dois discos cromados + manípulo) e braço até a luz.
  chromeParts.push(new THREE.CylinderGeometry(5, 5, 6, 18).rotateX(Math.PI / 2).translate(colTop.x, top, colTop.z));
  chromeParts.push(new THREE.SphereGeometry(3.2, 12, 8).translate(colTop.x + 7, top, colTop.z));
  const armEnd = mountWorld.clone();
  metalParts.push(tube(new THREE.Vector3(colTop.x, top, colTop.z), armEnd, 2));
  chromeParts.push(new THREE.CylinderGeometry(3.4, 3.4, 8, 14).translate(armEnd.x, armEnd.y, armEnd.z));
  const group = new THREE.Group();
  group.name = 'c-stand';
  const metal = new THREE.Mesh(finish(metalParts), set.blackMetal());
  const chrome = new THREE.Mesh(finish(chromeParts), set.chrome());
  metal.castShadow = chrome.castShadow = true;
  metal.receiveShadow = chrome.receiveShadow = true;
  group.add(metal, chrome);
  return { group, geometries: [metal.geometry, chrome.geometry] };
}

/**
 * Centro da base da luminária de mesa no tampo (a colisão da base no mapa usa o mesmo ponto): recuada da lâmpada
 * para trás da direção em que ela aponta.
 */
export function deskLampBase(bulb, target, reach = 230, tableY = 0) {
  const aim = new THREE.Vector3().subVectors(target, bulb).normalize();
  const back = aim.setY(0).normalize().multiplyScalar(-1);
  return new THREE.Vector3().copy(bulb).addScaledVector(back, reach * 0.55).setY(tableY);
}

/**
 * Luminária de mesa articulada (luz prática) em espaço de mundo: lâmpada em `bulb`, apontando para `target`,
 * base sobre a mesa (y = tableY).
 */
export function buildDeskLamp(set, { bulb, target, tableY = 0, reach = 230, emission, color }) {
  const aim = new THREE.Vector3().subVectors(target, bulb).normalize();
  const back = aim.clone().setY(0).normalize().multiplyScalar(-1);
  const base = deskLampBase(bulb, target, reach, tableY);
  const elbow = base.clone().add(new THREE.Vector3(0, (bulb.y - tableY) * 1.05, 0)).addScaledVector(back, reach * 0.25);
  const headBack = bulb.clone().addScaledVector(aim, -16);
  const group = new THREE.Group();
  group.name = 'luminaria';
  const geos = [];
  // Base pesada de metal preto.
  const baseGeo = new THREE.CylinderGeometry(34, 38, 10, 36).translate(base.x, tableY + 5, base.z);
  // Braços (dois tubos paralelos por segmento, como a luminária de arquiteto) e molas.
  const armParts = [baseGeo];
  const side = new THREE.Vector3().crossVectors(aim, new THREE.Vector3(0, 1, 0)).normalize();
  const segs = [[base.clone().setY(tableY + 10), elbow], [elbow, headBack]];
  const springParts = [];
  for (const [from, to] of segs) {
    for (const s of [-1, 1]) {
      const a = from.clone().addScaledVector(side, s * 3.5);
      const b = to.clone().addScaledVector(side, s * 3.5);
      armParts.push(wireGeometry(new THREE.LineCurve3(a, b), 1.6, { radialSegments: 8 }));
    }
    // Mola helicoidal ao lado do braço.
    const pts = [];
    const dir = new THREE.Vector3().subVectors(to, from);
    const n = dir.clone().normalize();
    const u = new THREE.Vector3().crossVectors(n, side).normalize();
    for (let i = 0; i <= 240; i++) {
      const t = 0.2 + (i / 240) * 0.45;
      const a = i * 0.6;
      pts.push(from.clone().addScaledVector(dir, t).addScaledVector(side, 8 + Math.cos(a) * 2.2).addScaledVector(u, Math.sin(a) * 2.2));
    }
    springParts.push(wireGeometry(new THREE.CatmullRomCurve3(pts), 0.45, { radialSegments: 5 }));
  }
  const arms = new THREE.Mesh(finish(armParts), set.blackMetal());
  const springs = new THREE.Mesh(finish(springParts), set.chrome());
  // Cúpula esmaltada (cone aberto) com lâmpada dentro.
  const shadeProfile = [[5, -16], [7, -12], [12, -8], [26, 4], [34, 14], [35, 15.5], [33.4, 15.5], [24.6, 5], [10.6, -6.8], [5.6, -10.5], [4, -14]];
  const shadeGeo = new THREE.LatheGeometry(shadeProfile.map(([r, y]) => new THREE.Vector2(r, y)), 40);
  shadeGeo.deleteAttribute('uv');
  shadeGeo.rotateX(Math.PI / 2); // eixo Y do lathe → +Z (abertura para a frente)
  const shade = new THREE.Mesh(shadeGeo, set.plastic({ color: '#E7DDC4', moldY: 1e4, name: 'esmalte-cupula' }));
  shade.position.copy(bulb);
  shade.quaternion.setFromUnitVectors(Z_AXIS, aim);
  const bulbGeo = new THREE.SphereGeometry(7, 20, 14);
  const lamp = new THREE.Mesh(bulbGeo, set.diffuser({ color, emission, hotspot: 0, seam: false }));
  lamp.position.copy(bulb).addScaledVector(aim, 2);
  for (const m of [arms, springs, shade]) {
    m.castShadow = true;
    m.receiveShadow = true;
  }
  group.add(arms, springs, shade, lamp);
  geos.push(arms.geometry, springs.geometry, shadeGeo, bulbGeo);
  return { group, geometries: geos };
}
