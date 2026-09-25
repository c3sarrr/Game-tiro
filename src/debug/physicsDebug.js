// r_colisao (Fase 3): arame das formas de colisão de cada corpo, a cápsula do jogador (em pé ou agachada, visível em
// terceira pessoa e no noclip), a normal do chão e a normal do último contato que cortou a velocidade. Linhas sem luz,
// sem névoa e por cima de tudo (visão de raio X: o arame das peças coincide com a malha visual e brigaria com ela no
// depth); corpos que se mexem acompanham a matriz.

import * as THREE from 'three';
import { HULL } from '../data/movement.js';
import { TRI_STRIDE } from '../physics/geometryQueries.js';
import { MOVETYPE } from '../player/movement.js';

const COLORS = Object.freeze({ edges: 0xffd23f, capsule: 0x3fb8af, normal: 0xe4572e, contact: 0xf4ede1 });
const NORMAL_LENGTH = 28;

/** Segmento de duas pontas com posição atualizável (normais). */
function segmentLine(material) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
  const line = new THREE.LineSegments(g, material);
  line.frustumCulled = false;
  return line;
}

function setSegment(line, x, y, z, n) {
  const pos = line.geometry.attributes.position;
  pos.setXYZ(0, x, y, z);
  pos.setXYZ(1, x + n.x * NORMAL_LENGTH, y + n.y * NORMAL_LENGTH, z + n.z * NORMAL_LENGTH);
  pos.needsUpdate = true;
}

/** As 3 arestas de cada triângulo do corpo, no espaço dele. */
function edgesGeometry(body) {
  const T = body.tris;
  const n = body.triangleCount;
  const pos = new Float32Array(n * 18);
  for (let i = 0; i < n; i++) {
    const o = i * TRI_STRIDE;
    for (let e = 0; e < 3; e++) {
      const a = o + e * 3;
      const b = o + ((e + 1) % 3) * 3;
      const w = i * 18 + e * 6;
      pos[w] = T[a];
      pos[w + 1] = T[a + 1];
      pos[w + 2] = T[a + 2];
      pos[w + 3] = T[b];
      pos[w + 4] = T[b + 1];
      pos[w + 5] = T[b + 2];
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  return g;
}

/** Cápsula em arame com os pés na origem: anéis no equador das semiesferas e quatro meridianos. */
function capsuleGeometry(radius, height, segments = 24) {
  const pts = [];
  const push = (ax, ay, az, bx, by, bz) => pts.push(ax, ay, az, bx, by, bz);
  const lo = radius;
  const hi = height - radius;
  for (const y of [lo, hi]) {
    for (let i = 0; i < segments; i++) {
      const a0 = (i / segments) * Math.PI * 2;
      const a1 = ((i + 1) / segments) * Math.PI * 2;
      push(Math.cos(a0) * radius, y, Math.sin(a0) * radius, Math.cos(a1) * radius, y, Math.sin(a1) * radius);
    }
  }
  const quarter = segments / 4;
  for (let k = 0; k < 4; k++) {
    const phi = (k / 4) * Math.PI * 2;
    const cx = Math.cos(phi);
    const cz = Math.sin(phi);
    for (let i = 0; i < quarter; i++) {
      const t0 = -Math.PI / 2 + (i / quarter) * (Math.PI / 2);
      const t1 = -Math.PI / 2 + ((i + 1) / quarter) * (Math.PI / 2);
      // semiesfera de baixo (do polo ao equador) e a de cima, espelhada
      push(Math.cos(t0) * radius * cx, lo + Math.sin(t0) * radius, Math.cos(t0) * radius * cz,
        Math.cos(t1) * radius * cx, lo + Math.sin(t1) * radius, Math.cos(t1) * radius * cz);
      push(Math.cos(t0) * radius * cx, hi - Math.sin(t0) * radius, Math.cos(t0) * radius * cz,
        Math.cos(t1) * radius * cx, hi - Math.sin(t1) * radius, Math.cos(t1) * radius * cz);
    }
    push(radius * cx, lo, radius * cz, radius * cx, hi, radius * cz);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  return g;
}

export class PhysicsDebugView {
  /** @param {{scene: THREE.Scene, world: import('../physics/collisionWorld.js').CollisionWorld}} opts */
  constructor({ scene, world }) {
    this.group = new THREE.Group();
    this.group.name = 'debug-colisao';
    this.group.visible = false;
    const lineMaterial = (color, opacity = 1) => new THREE.LineBasicMaterial({
      color, transparent: true, opacity, depthTest: false, depthWrite: false, fog: false, toneMapped: false,
    });
    this.materials = [
      lineMaterial(COLORS.edges, 0.5), lineMaterial(COLORS.capsule, 0.9), lineMaterial(COLORS.normal), lineMaterial(COLORS.contact),
    ];
    const [edgeMat, capsuleMat, normalMat, contactMat] = this.materials;
    this.bodies = world.bodies.map((body) => {
      const lines = new THREE.LineSegments(edgesGeometry(body), edgeMat);
      lines.matrixAutoUpdate = false;
      lines.matrix.copy(body.matrix);
      lines.name = `colisao-${body.name}`;
      this.group.add(lines);
      return { body, lines };
    });
    this.stand = new THREE.LineSegments(capsuleGeometry(HULL.radius, HULL.standHeight), capsuleMat);
    this.duck = new THREE.LineSegments(capsuleGeometry(HULL.radius, HULL.duckHeight), capsuleMat);
    this.normal = segmentLine(normalMat);
    this.contact = segmentLine(contactMat);
    this.group.add(this.stand, this.duck, this.normal, this.contact);
    // Depois da cena (transparentes em ordem): o arame fica sempre por cima.
    this.group.traverse((o) => {
      o.renderOrder = 1000;
    });
    scene.add(this.group);
  }

  setVisible(visible) {
    this.group.visible = visible;
  }

  /** Acompanha corpos que se mexem, a cápsula (pés interpolados) e a normal do chão. */
  update(pawn, alpha) {
    if (!this.group.visible) return;
    for (const { body, lines } of this.bodies) if (body.transformed) lines.matrix.copy(body.matrix);
    const s = pawn.state;
    const p = pawn.prevOrigin;
    const x = p.x + (s.origin.x - p.x) * alpha;
    const y = p.y + (s.origin.y - p.y) * alpha;
    const z = p.z + (s.origin.z - p.z) * alpha;
    // A cápsula só aparece com a câmera fora dela (terceira pessoa ou noclip).
    const showCapsule = pawn.thirdPerson || s.moveType === MOVETYPE.NOCLIP;
    this.stand.visible = showCapsule && !s.ducked;
    this.duck.visible = showCapsule && s.ducked;
    this.stand.position.set(x, y, z);
    this.duck.position.set(x, y, z);
    this.normal.visible = s.onGround;
    if (s.onGround) setSegment(this.normal, x, y, z, s.groundNormal);
    const c = pawn.controller.lastContact;
    this.contact.visible = c.valid;
    if (c.valid) setSegment(this.contact, c.point.x, c.point.y, c.point.z, c.normal);
  }

  dispose() {
    this.group.removeFromParent();
    this.group.traverse((o) => o.geometry?.dispose());
    for (const m of this.materials) m.dispose();
  }
}
