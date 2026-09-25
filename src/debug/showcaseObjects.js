// Construtores dos objetos da vitrine (dados em src/data/showcase.js; referências em docs/art/moodboard.md
// item 10). Cada construtor recebe a definição e o contexto { set, sdf } e devolve um THREE.Group com a base
// em y = 0 (apoiado no tapete), de frente para +Z (para a câmera). Massinha pelo kit (src/clay/kit) e por SDF
// (src/clay/sdf); o resto com os materiais do set (src/clay/set).

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { PALETTE } from '../data/palette.js';
import { ClayMaterial } from '../clay/ClayMaterial.js';
import { ClayAssembly } from '../clay/kit/assembly.js';
import { clayBall, clayCapsule, clayCylinder, claySlab, claySnake, clayDrop, clayTorus } from '../clay/kit/shapes.js';
import { scaleMarker } from '../clay/kit/scaleMarker.js';
import {
  tapeRoll, tapeStrip, cardboardTube, twistedWire, wireGeometry, balsaStick, sculptTool, craftKnife, clayPot,
} from '../clay/set/propGeometry.js';
import { cardboardBox } from '../clay/set/boardGeometry.js';
import { hashString } from '../core/rng.js';

const DEG = Math.PI / 180;
const Y_AXIS = new THREE.Vector3(0, 1, 0);

const seedOf = (text) => (hashString(text) % 997) + 1;

function shadowAll(root) {
  root.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });
  return root;
}

function group(name, ...children) {
  const g = new THREE.Group();
  g.name = name;
  for (const c of children) g.add(c);
  return g;
}

/** Euler [x, y, z] que leva o eixo +Y até `dir` (peças do kit são modeladas ao longo de Y). */
function eulerAlong(dir) {
  const q = new THREE.Quaternion().setFromUnitVectors(Y_AXIS, dir.clone().normalize());
  const e = new THREE.Euler().setFromQuaternion(q);
  return [e.x, e.y, e.z];
}

/** Malha SDF com um ClayMaterial por id de material da árvore; o boil acompanha o tamanho da peça. */
async function sdfMesh(ctx, tree, materials, { resolution, maxCells, name }) {
  const geometry = await ctx.sdf.build(tree, { resolution, maxCells });
  const mesh = new THREE.Mesh(geometry, materials);
  mesh.name = name;
  const r = geometry.boundingSphere.radius;
  for (const m of materials) m.setObjectSize(r);
  return mesh;
}

// ------------------------------------------------------------------ massinha pelo kit

/** Bolota apoiada na mesa (massa fresca × seca): a base afunda um pouco, como massa que achatou no apoio. */
function ball(def) {
  const [sx, sy, sz] = def.squash;
  const mat = new ClayMaterial({
    color: def.color, wetness: def.wetness, lint: def.lint, roughness: def.roughness ?? 0.72, seed: def.id,
  });
  const asm = new ClayAssembly(def.id);
  asm.add(clayBall({ radius: def.radius, squash: [sx, sy, sz], segments: 24, lumpiness: 0.055, dents: 4, seed: seedOf(def.id) }), {
    material: mat, position: [0, def.radius * sy * 0.92, 0],
  });
  return asm.build();
}

/** Bolota com skin (marmorizado, glitter). */
function skinBall(def) {
  const [sx, sy, sz] = def.squash;
  const mat = new ClayMaterial({
    color: def.color, colorB: def.colorB, colorC: def.colorC, skin: def.skin, wetness: 0.4, seed: def.id,
  });
  const asm = new ClayAssembly(def.id);
  asm.add(clayBall({ radius: def.radius, squash: [sx, sy, sz], segments: 26, lumpiness: 0.045, dents: 3, seed: seedOf(def.id) }), {
    material: mat, position: [0, def.radius * sy * 0.93, 0],
  });
  return asm.build();
}

/** Placa creme muito tocada, para olhar as digitais de perto com luz rasante (FPC9, FPC14, CLT1). */
function printSlab(def) {
  const [w, h, d] = def.size;
  const mat = new ClayMaterial({
    color: def.color, touched: true, fingerprints: def.fingerprints, toolMarks: 0.35, wetness: 0.3, lint: 0.25, seed: def.id,
  });
  const asm = new ClayAssembly(def.id);
  asm.add(claySlab({ width: w, height: h, depth: d, bevel: 5.5, segments: 12, lumpiness: 0.018, dents: 5, seed: seedOf(def.id) }), {
    material: mat, position: [0, h / 2 - 0.4, 0],
  });
  return asm.build();
}

/** Pilha de bolachas de massa escolar desbotada (GPD1, PDH10), cada uma de uma cor, com costura entre elas. */
function discStack(def) {
  const asm = new ClayAssembly(def.id);
  let y = 0;
  def.colors.forEach((color, i) => {
    const mat = new ClayMaterial({ color, skin: 'escolar', wetness: 0.15, lint: 0.5, seed: `${def.id}-${i}` });
    const r = def.radius * (1 - i * 0.07);
    const h = def.height * (1 - i * 0.05);
    asm.add(clayCylinder({ radius: r, height: h, bevel: 4.6, radialSegments: 44, lumpiness: 0.04, dents: 3, seed: seedOf(`${def.id}${i}`) }), {
      material: mat,
      position: [(i - 1) * 1.6, y + h / 2, (i % 2 ? -1 : 1) * 1.2],
      rotation: [(i - 1) * 2 * DEG, i * 40 * DEG, (1 - i) * 1.5 * DEG],
    });
    y += h * 0.9; // cada bolacha afunda um pouco na de baixo (massa mole)
  });
  return asm.build();
}

/**
 * Corda torcida de três cores + bola já amassada pela criança (MPC6, MPC12, PLI11). A skin torce as cores em
 * volta do eixo X do objeto: a corda é modelada com o eixo sobre X e cada peça tem a própria massa (o próprio
 * espaço de objeto), deslocada depois pelo grupo.
 */
function mixedRope(def) {
  const [a, b, c] = def.colors;
  const skin = { color: a, colorB: b, colorC: c, skin: 'misturada', wetness: 0.45, touched: true };
  const rope = new ClayAssembly(`${def.id}-corda`);
  const pts = [];
  for (let i = 0; i <= 12; i++) {
    const t = i / 12;
    pts.push([-50 + t * 92, Math.sin(t * Math.PI) * 1.2, Math.sin(t * Math.PI * 1.6) * 2.6]);
  }
  rope.add(claySnake({ points: pts, radius: 6.2, radiusFn: (t) => 6.2 * (0.86 + 0.14 * Math.sin(t * Math.PI)), tubularSegments: 90, radialSegments: 18, lumpiness: 0.06, seed: seedOf(def.id) }), {
    material: new ClayMaterial({ ...skin, seed: `${def.id}-corda` }),
  });
  const ropeGroup = rope.build();
  ropeGroup.position.y = 6.2 * 0.95;
  const ball = new ClayAssembly(`${def.id}-bola`);
  ball.add(clayBall({ radius: 14, squash: [1.05, 0.88, 1], segments: 20, lumpiness: 0.07, dents: 4, seed: seedOf(`${def.id}-bola`) }), {
    material: new ClayMaterial({ ...skin, seed: `${def.id}-bola` }),
  });
  const ballGroup = ball.build();
  ballGroup.position.set(34, 14 * 0.88 * 0.94, 24);
  ballGroup.rotation.set(0.4, 0.9, 0.2);
  return group(def.id, ropeGroup, ballGroup);
}

/** Toco de "madeira" de massinha: cilindro deitado, anéis nas pontas e veio ao longo (skin madeira). */
function log(def) {
  const mat = new ClayMaterial({ color: def.color, skin: 'madeira', wetness: 0.25, seed: def.id });
  const asm = new ClayAssembly(def.id);
  // Montado em pé (eixo Y = eixo dos anéis no espaço do objeto) e deitado pela rotação do grupo.
  asm.add(clayCylinder({ radius: def.radius, height: def.length, bevel: 5, radialSegments: 40, lumpiness: 0.035, dents: 4, seed: seedOf(def.id) }), {
    material: mat,
  });
  asm.add(clayBall({ radius: 4.2, squash: [1, 0.55, 1], segments: 10, lumpiness: 0.06, dents: 1, seed: seedOf(`${def.id}-no`) }), {
    material: mat, position: [def.radius * 0.88, def.length * 0.18, 2], rotation: [0, 0, -Math.PI / 2],
  });
  const g = asm.build();
  g.rotation.z = Math.PI / 2;
  g.position.y = def.radius - 0.8;
  return group(def.id, g);
}

/** Capacete de massinha camuflado: domo afundado no apoio + aba em rosca achatada. */
function helmet(def) {
  const mat = new ClayMaterial({ color: def.color, skin: 'camuflagem', wetness: 0.3, touched: true, seed: def.id });
  const R = def.radius;
  const asm = new ClayAssembly(def.id);
  asm.add(clayBall({ radius: R, squash: [1, 0.82, 1.08], segments: 26, lumpiness: 0.04, dents: 4, seed: seedOf(def.id) }), {
    material: mat, position: [0, R * 0.08, 0],
  });
  asm.add(clayTorus({ R: R * 1.02, r: 3.4, radialSegments: 14, tubularSegments: 64, lumpiness: 0.05, seed: seedOf(`${def.id}-aba`) }), {
    material: mat, position: [0, 2.6, 0], scale: [1, 0.72, 1.07],
  });
  return asm.build();
}

/** Faca de ouro (Gun Game): espátula de modelar afiada em massa dourada — lâmina chata que afina, virola e cabo. */
function goldKnife(def) {
  const mat = new ClayMaterial({ skin: 'ouro', wetness: 0.2, touched: true, seed: def.id });
  const L = def.length;
  const bladeLen = L * 0.6;
  const blade = claySlab({ width: bladeLen, height: 3.4, depth: 16, bevel: 1.6, segments: 10, lumpiness: 0.012, dents: 2, seed: seedOf(def.id) });
  // Afina a lâmina para a ponta (e o fio fica mais fino que o dorso).
  const p = blade.geometry.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const t = (x + bladeLen / 2) / bladeLen;
    const taper = 1 - 0.78 * THREE.MathUtils.smoothstep(t, 0.45, 1);
    const z = p.getZ(i) * taper;
    const edge = 1 - 0.45 * Math.max(0, -z / 8);
    p.setXYZ(i, x, p.getY(i) * edge, z);
  }
  p.needsUpdate = true;
  blade.geometry.computeVertexNormals();
  const handleLen = L - bladeLen - 6;
  const asm = new ClayAssembly(def.id);
  asm.add(blade, { material: mat, position: [L / 2 - bladeLen / 2, 2.2, 0] });
  asm.add(clayCylinder({ radius: 5.2, height: 7, bevel: 2.2, radialSegments: 28, lumpiness: 0.02, dents: 1, seed: seedOf(`${def.id}-virola`) }), {
    material: mat, position: [L / 2 - bladeLen - 2.5, 5.2, 0], rotation: [0, 0, Math.PI / 2],
  });
  asm.add(clayCapsule({ radius: 4.6, length: handleLen - 9, radialSegments: 22, lumpiness: 0.035, dents: 2, seed: seedOf(`${def.id}-cabo`) }), {
    material: mat, position: [-L / 2 + handleLen / 2, 4.6, 0], rotation: [0, 0, Math.PI / 2],
  });
  return asm.build();
}

/**
 * Rolinho de massa (item de colete do modo Ondas): folha de duas massas enrolada como rocambole, deitada com a
 * espiral virada para a câmera (MFP3; voltas apertadas como os rolinhos de MFP15). SDF: duas folhas em espiral
 * de Arquimedes encostadas volta a volta (a de fora começa uma espessura depois), unidas sem vinco — o sulco
 * entre as camadas nasce das bordas arredondadas de cada folha. A ponta da folha de fora fica embaixo (o rolo
 * descansa sobre a emenda para não desenrolar), o canal no eixo é o começo enrolado à mão, a base achata no
 * apoio e um displace leve tira a perfeição de máquina.
 */
async function jellyRoll(def, ctx) {
  const t = def.thickness / 2;
  const pitch = def.thickness * 2; // uma volta passa as duas folhas
  const r0 = def.thickness * 0.55;
  const outer = r0 + def.thickness + pitch * def.turns + t;
  const cy = outer * 0.965;
  const sheet = { turns: def.turns, pitch, t, h: def.length / 2, round: t * 0.8 };
  const tree = {
    type: 'intersect',
    a: {
      type: 'displace', amp: 0.35, freq: 0.09, seed: def.id, octaves: 2, child: {
        type: 'transform', pos: [0, cy, 0], rot: [Math.PI / 2, def.endDeg * DEG, 0], child: {
          type: 'smoothUnion', k: 0.6, seamWidth: 0.8, children: [
            { type: 'spiral', r0, ...sheet, mat: 0 },
            { type: 'spiral', r0: r0 + def.thickness, ...sheet, mat: 1 },
          ],
        },
      },
    },
    b: { type: 'roundBox', size: [outer * 2, outer * 1.5, def.length], pos: [0, outer * 1.5, 0], r: 0 },
  };
  const materials = [
    new ClayMaterial({ color: def.colorA, wetness: 0.5, touched: true, seed: `${def.id}-a` }),
    new ClayMaterial({ color: def.colorB, wetness: 0.5, touched: true, seed: `${def.id}-b` }),
  ];
  // Resolução 84 (~0,7 u por célula): ~6 células na espessura da folha, sulco entre camadas bem amostrado.
  const roll = await sdfMesh(ctx, tree, materials, { resolution: 84, maxCells: 600000, name: `${def.id}-sdf` });
  return group(def.id, roll);
}

/** Fantasminha de massa neon dentro de um túnel de papelão (GDC2, GDC5, GDC17). */
function neonGhost(def, ctx) {
  const glow = new ClayMaterial({ color: def.color, skin: 'neon', wetness: 0.35, sss: 0.95, rim: 0.7, touched: true, seed: def.id });
  const black = new ClayMaterial({ color: '#1C1917', wetness: 0.7, roughness: 0.5, seed: `${def.id}-olho` });
  const { radius, length, thickness } = def.tunnel;
  const floorY = thickness + 0.2;
  const asm = new ClayAssembly(`${def.id}-corpo`);
  asm.add(clayDrop({ radius: 15, height: 30, radialSegments: 36, lumpiness: 0.05, dents: 2, seed: seedOf(def.id) }), {
    material: glow, position: [0, floorY + 15 * 0.92, 0],
  });
  for (const side of [-1, 1]) {
    asm.add(clayBall({ radius: 2.3, squash: [1, 1.25, 0.7], segments: 8, lumpiness: 0.03, dents: 0, seed: seedOf(`${def.id}${side}`) }), {
      material: black, position: [side * 4.6, floorY + 21, 12.4], seams: false,
    });
  }
  asm.add(clayBall({ radius: 1.8, squash: [1.5, 0.8, 0.6], segments: 8, lumpiness: 0.03, dents: 0, seed: seedOf(`${def.id}-boca`) }), {
    material: black, position: [0, floorY + 14.5, 13.8], seams: false,
  });
  const ghost = asm.build();
  // Túnel: tubo de papelão deitado, boca virada para a câmera.
  const tubeGeo = cardboardTube(radius, length, thickness, { radial: 56 });
  const tunnel = new THREE.Mesh(tubeGeo, ctx.set.cardboard());
  tunnel.name = 'tunel-papelao';
  tunnel.rotation.x = Math.PI / 2;
  tunnel.position.set(0, radius + thickness, 0);
  return group(def.id, tunnel, ghost);
}

/** Pote de massinha escolar com a massa guardando a forma do pote e a tampa encostada (PDH8, PDH13). */
function pot(def, ctx) {
  const { tub, lid, moldY } = clayPot({ radius: def.radius, height: def.height, lidHeight: 12 });
  const tubMesh = new THREE.Mesh(tub, ctx.set.plastic({ color: def.tub, moldY, name: 'pote-amarelo' }));
  const lidMesh = new THREE.Mesh(lid, ctx.set.plastic({ color: def.lid, moldY: 1e4, name: 'tampa-azul' }));
  const lr = def.radius + 2.6;
  lidMesh.rotation.set(0, 0, 80 * DEG);
  lidMesh.position.set(-(def.radius + 11), lr * Math.sin(80 * DEG), 0);
  const clay = new ClayMaterial({ color: def.clay, wetness: 0.85, touched: true, fingerprints: 0.8, seed: def.id });
  const asm = new ClayAssembly(`${def.id}-massa`);
  const inner = def.radius - 2.4 - 0.5;
  asm.add(clayCylinder({ radius: inner, height: def.height * 0.78, bevel: 7, radialSegments: 48, lumpiness: 0.03, dents: 3, seed: seedOf(def.id) }), {
    material: clay, position: [0, 2.4 + def.height * 0.39, 0],
  });
  // Um bloco já tirado do pote, deitado ao lado: ainda com o formato do pote (PDH8).
  asm.add(clayCylinder({ radius: inner * 0.62, height: 26, bevel: 6, radialSegments: 40, lumpiness: 0.05, dents: 4, seed: seedOf(`${def.id}-bloco`) }), {
    material: clay, position: [def.radius + 20, inner * 0.6, 12], rotation: [0.5, 0, Math.PI / 2], seams: false,
  });
  return group(def.id, tubMesh, lidMesh, asm.build());
}

// ------------------------------------------------------------------ SDF

/** Cabeça esculpida sobre pedestal (CLF3, CLF14, AAC3). */
async function sdfHead(def, ctx) {
  const tree = {
    type: 'union', seamWidth: 0.7, children: [
      {
        type: 'displace', amp: 0.32, freq: 0.24, seed: def.id, octaves: 2, child: {
          type: 'smoothSubtract', k: 1.6,
          a: {
            type: 'smoothUnionCrease', k: 2.4, depth: 0.32, width: 0.9, children: [
              { type: 'ellipsoid', radii: [12.6, 15.2, 12.2], pos: [0, 0, 0] },
              { type: 'ellipsoid', radii: [4.1, 5.2, 6.2], pos: [0, -1.6, 11.3], rot: [-0.28, 0, 0] },
              { type: 'capsule', a: [-6.2, 5.4, 9.4], b: [6.2, 5.4, 9.4], r: 2.1 },
              { type: 'ellipsoid', radii: [2.3, 4.6, 3.5], pos: [-12.4, 0.4, 0.6], rot: [0, 0.25, 0] },
              { type: 'ellipsoid', radii: [2.3, 4.6, 3.5], pos: [12.4, 0.4, 0.6], rot: [0, -0.25, 0] },
              { type: 'capsule', a: [0, -13, -1.2], b: [0, -21, -1.4], r: 6.4 },
            ],
          },
          b: {
            type: 'union', children: [
              { type: 'sphere', r: 3.7, pos: [-4.7, 2.1, 11.4] },
              { type: 'sphere', r: 3.7, pos: [4.7, 2.1, 11.4] },
              { type: 'capsule', a: [-4.2, -7.3, 11.4], b: [4.2, -7.1, 11.6], r: 1.05 },
            ],
          },
        },
      },
      { type: 'sphere', r: 2.95, pos: [-4.7, 2.2, 10.3], mat: 1 },
      { type: 'sphere', r: 2.95, pos: [4.7, 2.2, 10.3], mat: 1 },
      { type: 'sphere', r: 1.2, pos: [-4.5, 2.4, 12.9], mat: 2 },
      { type: 'sphere', r: 1.2, pos: [4.5, 2.4, 12.9], mat: 2 },
    ],
  };
  const materials = [
    new ClayMaterial({ color: def.skin, touched: true, wetness: 0.35, sss: 0.7, seed: `${def.id}-pele` }),
    new ClayMaterial({ color: PALETTE.clayWhite, touched: true, wetness: 0.5, seed: `${def.id}-olho` }),
    new ClayMaterial({ color: '#1E1A18', touched: true, wetness: 0.7, roughness: 0.5, seed: `${def.id}-pupila` }),
  ];
  const head = await sdfMesh(ctx, tree, materials, { resolution: 104, maxCells: 700000, name: `${def.id}-sdf` });
  const plinthMat = new ClayMaterial({ color: def.plinth, wetness: 0.2, seed: `${def.id}-base` });
  const asm = new ClayAssembly(`${def.id}-pedestal`);
  asm.add(clayCylinder({ radius: 15, height: 10, bevel: 3.2, radialSegments: 40, lumpiness: 0.03, dents: 3, seed: seedOf(def.id) }), {
    material: plinthMat, position: [0, 5, 0],
  });
  head.position.y = 10 + 21 + 6.4 - 1.2; // ponta do pescoço (y = −27,4) apoiada no pedestal
  return group(def.id, asm.build(), head);
}

/** Duas massas apertadas (vinco de costura) com três dedadas, base achatada no apoio (CLT3, CLT12, CLF17). */
async function sdfLump(def, ctx) {
  const tree = {
    type: 'intersect',
    a: {
      type: 'displace', amp: 0.5, freq: 0.15, seed: def.id, octaves: 3, child: {
        type: 'smoothSubtract', k: 2.6,
        a: {
          type: 'smoothUnionCrease', k: 5, depth: 0.7, width: 1.3, seamWidth: 0.9, children: [
            { type: 'ellipsoid', radii: [17, 13.5, 15], pos: [-7, 11, 0], mat: 0 },
            { type: 'ellipsoid', radii: [14, 11, 13], pos: [10.5, 9, 3], rot: [0.2, 0.4, -0.3], mat: 1 },
          ],
        },
        b: {
          type: 'union', children: [
            { type: 'ellipsoid', radii: [7.2, 7.2, 3.3], pos: [-8.5, 24.2, 3], rot: [1.25, 0, 0.2] },
            { type: 'ellipsoid', radii: [6.2, 6.2, 3.1], pos: [-22.4, 12, 6], rot: [0, 1.1, 0] },
            { type: 'ellipsoid', radii: [5.6, 5.6, 2.9], pos: [17.5, 15.5, 13], rot: [0.55, -0.75, 0] },
          ],
        },
      },
    },
    b: { type: 'roundBox', size: [60, 30, 60], pos: [0, 30, 0], r: 0 },
  };
  const materials = [
    new ClayMaterial({ color: def.colorA, touched: true, wetness: 0.55, seed: `${def.id}-a` }),
    new ClayMaterial({ color: def.colorB, touched: true, wetness: 0.55, seed: `${def.id}-b` }),
  ];
  const lump = await sdfMesh(ctx, tree, materials, { resolution: 96, maxCells: 600000, name: `${def.id}-sdf` });
  return group(def.id, lump);
}

// ------------------------------------------------------------------ set

function scaleMarkerObject(def) {
  return group(def.id, scaleMarker(def.height));
}

/** Caixa de papelão aberta (SSD4, SSD8, CSD16). */
function box(def, ctx) {
  const [w, h, d] = def.size;
  const mesh = new THREE.Mesh(cardboardBox(w, h, d, { thickness: 3.5, flapOpen: def.flapOpen, seed: def.id }), ctx.set.cardboard());
  mesh.name = 'caixa-papelao';
  return group(def.id, mesh);
}

/** Rolo de fita crepe em pé com a ponta solta estendida na mesa (TRL1, TRL5, TRL10). */
function tapeRollObject(def, ctx) {
  const core = 4;
  const roll = tapeRoll({ outer: def.outer, inner: def.inner, width: def.width, coreThickness: core, seed: def.id });
  const rollGroup = group('rolo',
    new THREE.Mesh(roll.tape, ctx.set.tape({ width: def.width })),
    new THREE.Mesh(roll.sides, ctx.set.tapeSide({ inner: def.inner + core, outer: def.outer })),
    new THREE.Mesh(roll.core, ctx.set.cardboard()),
  );
  // Em pé sobre a borda: eixo do rolo ao longo de X.
  rollGroup.rotation.z = Math.PI / 2;
  rollGroup.position.set(0, def.outer + 0.3, 0);
  const tail = new THREE.Mesh(tapeStrip(def.tail, def.width, { seed: `${def.id}-ponta`, lift: 1.2 }), ctx.set.tape({ width: def.width }));
  tail.name = 'ponta-solta';
  // Deitada na mesa (normal +Y), comprimento ao longo de +Z, saindo de baixo do rolo.
  tail.rotation.set(-Math.PI / 2, 0, -Math.PI / 2);
  tail.position.set(0, 0.25, def.outer * 0.35 + def.tail / 2);
  return group(def.id, rollGroup, tail);
}

/** Armadura de arame: arame torcido, "ossos" de massa epóxi, balsa no peito/quadril, porcas nos pés (ARM5, ARM12, ARM15, ARM18). */
function armature(def, ctx) {
  const s = def.height / 72;
  const v = (x, y, z) => new THREE.Vector3(x * s, y * s, z * s);
  const wireMat = ctx.set.wire({ color: def.wire });
  const putty = new ClayMaterial({ color: def.putty, wetness: 0.08, fingerprints: 0.35, toolMarks: 0.55, lint: 0.5, touched: true, seed: def.id });
  const parts = [];
  const curve = (...pts) => new THREE.CatmullRomCurve3(pts);
  const joints = {
    pelvis: v(0, 33, 0), chest: v(0, 50, 0.5), neck: v(0, 61, 0.4),
    shL: v(-11, 56.5, 0), elL: v(-15.5, 44, 2.4), wrL: v(-17.5, 32.5, 4.2),
    shR: v(11, 56.5, 0), elR: v(18, 46.5, -1), wrR: v(23.5, 37, 3.5),
    hipL: v(-6, 33, 0), knL: v(-7, 17.5, 1.8), anL: v(-7.4, 3.6, 0),
    hipR: v(6, 33, 0), knR: v(8, 17.8, -0.6), anR: v(8.8, 3.6, 0.6),
  };
  const j = joints;
  parts.push(twistedWire(curve(v(0, 30, 0), j.pelvis, v(0, 42, 0.9), j.chest, j.neck, v(0, 63, 0.3)), 0.62 * s, 8 * s));
  parts.push(twistedWire(curve(j.shL, v(-4, 57, 0.4), v(4, 57, 0.4), j.shR), 0.58 * s, 8 * s));
  parts.push(twistedWire(curve(j.hipL, v(0, 33.6, 0.3), j.hipR), 0.58 * s, 8 * s));
  for (const [a, b, c] of [[j.shL, j.elL, j.wrL], [j.shR, j.elR, j.wrR], [j.hipL, j.knL, j.anL], [j.hipR, j.knR, j.anR]]) {
    parts.push(twistedWire(curve(a, a.clone().lerp(b, 0.5).add(v(0, 0, 0.6)), b, b.clone().lerp(c, 0.5).add(v(0, 0, 0.5)), c), 0.58 * s, 7.5 * s));
  }
  // Dedos: arames simples abertos em leque saindo do punho.
  for (const [wr, el, side] of [[j.wrL, j.elL, -1], [j.wrR, j.elR, 1]]) {
    const dir = new THREE.Vector3().subVectors(wr, el).normalize();
    const side3 = new THREE.Vector3(side, 0, 0);
    for (let k = 0; k < 4; k++) {
      const spread = (k - 1.5) * 0.36;
      const tip = wr.clone().addScaledVector(dir, 5.2 * s).addScaledVector(side3, spread * 5 * s).add(v(0, 0, (k - 1.5) * 0.9));
      const mid = wr.clone().lerp(tip, 0.55).add(v(0, 0.3, 0.4));
      parts.push(wireGeometry(curve(wr.clone(), mid, tip), 0.36 * s, { radialSegments: 6 }));
    }
  }
  const wireGeo = mergeParts(parts);
  const wires = new THREE.Mesh(wireGeo, wireMat);
  wires.name = 'arame-torcido';
  // Ossos de epóxi nos segmentos longos (a junta fica de fora: é onde a armadura dobra).
  const asm = new ClayAssembly(`${def.id}-ossos`);
  const bone = (a, b, r, k) => {
    const dir = new THREE.Vector3().subVectors(b, a);
    const len = dir.length();
    const gap = 2.2 * s;
    const mid = a.clone().add(b).multiplyScalar(0.5);
    asm.add(clayCapsule({ radius: r, length: Math.max(1, len - 2 * gap - 2 * r), radialSegments: 14, capSegments: 6, lumpiness: 0.08, dents: 2, seed: seedOf(`${def.id}${k}`) }), {
      material: putty, position: [mid.x, mid.y, mid.z], rotation: eulerAlong(dir), seams: false,
    });
  };
  bone(j.shL, j.elL, 2.3 * s, 1);
  bone(j.elL, j.wrL, 2.0 * s, 2);
  bone(j.shR, j.elR, 2.3 * s, 3);
  bone(j.elR, j.wrR, 2.0 * s, 4);
  bone(j.hipL, j.knL, 2.7 * s, 5);
  bone(j.knL, j.anL, 2.3 * s, 6);
  bone(j.hipR, j.knR, 2.7 * s, 7);
  bone(j.knR, j.anR, 2.3 * s, 8);
  asm.add(clayBall({ radius: 6.4 * s, squash: [0.92, 1.08, 0.95], segments: 16, lumpiness: 0.07, dents: 3, seed: seedOf(`${def.id}-cabeca`) }), {
    material: putty, position: [0, 67.5 * s, 0.4 * s], seams: false,
  });
  const bones = asm.build();
  // Balsa: bloco do peito e do quadril (ARM18), furados pelo arame.
  const balsa = ctx.set.balsa();
  const chest = new THREE.Mesh(balsaStick(15 * s, 7.5 * s, 12 * s, { seed: `${def.id}-peito` }), balsa);
  chest.position.copy(j.chest).add(v(0, 1.5, 0));
  const hip = new THREE.Mesh(balsaStick(13 * s, 6.5 * s, 6.5 * s, { seed: `${def.id}-quadril` }), balsa);
  hip.position.copy(j.pelvis).add(v(0, 0.4, 0));
  // Pés: plaquinhas de balsa com porca sextavada (tie-down) por cima.
  const feet = [];
  for (const an of [j.anL, j.anR]) {
    const foot = new THREE.Mesh(balsaStick(8 * s, 12 * s, 3.2 * s, { seed: `${def.id}-pe${feet.length}` }), balsa);
    foot.rotation.y = Math.PI / 2;
    foot.position.set(an.x, 1.6 * s, an.z + 2.2 * s);
    const nut = new THREE.Mesh(new THREE.CylinderGeometry(2.6 * s, 2.6 * s, 2 * s, 6), ctx.set.chrome());
    nut.position.set(an.x, 4.2 * s, an.z + 0.4 * s);
    nut.rotation.y = 0.3;
    feet.push(foot, nut);
  }
  return group(def.id, wires, bones, chest, hip, ...feet);
}

function mergeParts(parts) {
  const clean = parts.map((g) => {
    const n = g.index ? g.toNonIndexed() : g;
    if (n !== g) g.dispose();
    for (const name of Object.keys(n.attributes)) if (name !== 'position' && name !== 'normal' && name !== 'uv') n.deleteAttribute(name);
    return n;
  });
  const merged = mergeGeometries(clean, false);
  for (const g of clean) g.dispose();
  return merged;
}

/** Ferramentas de modelar e estilete deitados sobre duas ripas de balsa (CSD19, SMD3, CSD16). */
function tools(def, ctx) {
  const balsa = ctx.set.balsa();
  const out = [];
  for (const x of [-36, 36]) {
    const stick = new THREE.Mesh(balsaStick(74, 9, 6, { seed: `${def.id}-ripa${x}` }), balsa);
    stick.rotation.y = Math.PI / 2;
    stick.position.set(x, 3, 0);
    out.push(stick);
  }
  const wood = ctx.set.benchWood();
  const metal = ctx.set.toolMetal({ length: def.toolLength });
  const kinds = ['espatula', 'laco', 'bolinha'];
  kinds.forEach((kind, i) => {
    const t = sculptTool(kind, { length: def.toolLength });
    const g = group(`ferramenta-${kind}`, new THREE.Mesh(t.handle, wood), new THREE.Mesh(t.metal, metal));
    g.position.set((i - 1) * 4, 6 + 4.3, -24 + i * 15);
    g.rotation.set(0, (i - 1) * 7 * DEG, (i % 2 ? 1 : -1) * 3 * DEG);
    out.push(g);
  });
  const knife = craftKnife({ length: def.knifeLength });
  const knifeGroup = group('estilete',
    new THREE.Mesh(knife.handle, ctx.set.toolMetal({ color: '#B9BEC3', residue: '#9AA0A6', residueFrom: 2, length: def.knifeLength, name: 'aluminio-cabo' })),
    new THREE.Mesh(knife.collet, ctx.set.chrome()),
    new THREE.Mesh(knife.blade, ctx.set.toolMetal({ color: '#CDD1D5', residue: '#CDD1D5', residueFrom: 2, length: def.knifeLength, name: 'lamina' })),
  );
  knifeGroup.position.set(6, 6 + 4.4, 24);
  knifeGroup.rotation.set(0, -9 * DEG, 0);
  out.push(knifeGroup);
  return group(def.id, ...out);
}

const BUILDERS = Object.freeze({
  ball, skinBall, printSlab, discStack, mixedRope, log, helmet, goldKnife, jellyRoll, neonGhost, pot,
  sdfHead, sdfLump, scaleMarker: scaleMarkerObject, box, tapeRoll: tapeRollObject, armature, tools,
});

/** Tipos de objeto conhecidos (os dados são validados contra isto nos testes). */
export const SHOWCASE_KINDS = Object.freeze(Object.keys(BUILDERS));

/**
 * Constrói um objeto da vitrine.
 * @param {object} def entrada de SHOWCASE_OBJECTS
 * @param {{set:import('../clay/set/index.js').SetLibrary, sdf:import('../clay/sdf/sdfMesher.js').SdfMesher}} ctx
 * @returns {Promise<THREE.Group>}
 */
export async function buildShowcaseObject(def, ctx) {
  const builder = BUILDERS[def.kind];
  if (!builder) throw new Error(`objeto de vitrine sem construtor: ${def.kind}`);
  const obj = await builder(def, ctx);
  obj.name = def.id;
  return shadowAll(obj);
}
