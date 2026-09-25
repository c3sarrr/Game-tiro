// Formas de colisão dos mapas, separadas da malha visual: o boil e as digitais da massinha são deformação de
// shader (não podem virar tropeço) e malha densa deixaria cada varredura cara. Cada mapa monta as suas formas com o
// ColliderBuilder e entrega o resultado ao CollisionBody. Cada triângulo guarda o material de superfície
// (src/data/surfaces.js), usado no atrito, no pulo, nos passos e nas pegadas.

import * as THREE from 'three';
import { surfaceIndex } from '../data/surfaces.js';

const MIN_CROSS_SQ = 1e-10; // |(b − a) × (c − a)|² menor que isto: triângulo degenerado (descartado)
const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const _c = new THREE.Vector3();

/** Matriz objeto → mundo de uma forma: `matrix`, ou translação para `center` ([x, y, z] ou {x, y, z}). */
function placement(matrix, center) {
  const m = new THREE.Matrix4();
  if (matrix) return m.copy(matrix);
  if (center) m.makeTranslation(center.x ?? center[0], center.y ?? center[1], center.z ?? center[2]);
  return m;
}

export class ColliderBuilder {
  constructor() {
    this.positions = [];
    this.surfaces = [];
    this.skipped = 0;
  }

  get triangleCount() {
    return this.surfaces.length;
  }

  /** Triângulo em espaço de mundo; `surface` é o id do material (ou o índice já resolvido). */
  triangle(a, b, c, surface = 'padrao') {
    const sid = surfaceIndex(surface);
    const abx = b.x - a.x, aby = b.y - a.y, abz = b.z - a.z;
    const acx = c.x - a.x, acy = c.y - a.y, acz = c.z - a.z;
    const cx = aby * acz - abz * acy;
    const cy = abz * acx - abx * acz;
    const cz = abx * acy - aby * acx;
    if (cx * cx + cy * cy + cz * cz < MIN_CROSS_SQ) {
      this.skipped++;
      return this;
    }
    this.positions.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
    this.surfaces.push(sid);
    return this;
  }

  /** Quadrilátero a-b-c-d em ordem (triângulos abc e acd). */
  quad(a, b, c, d, surface = 'padrao') {
    return this.triangle(a, b, c, surface).triangle(a, c, d, surface);
  }

  /** Malha qualquer (indexada ou não) levada ao mundo por `matrix` — para malhas já simples (chão, placas, props). */
  geometry(geometry, { matrix = null, surface = 'padrao' } = {}) {
    const pos = geometry.attributes.position;
    const index = geometry.index;
    const count = index ? index.count : pos.count;
    const sid = surfaceIndex(surface);
    for (let i = 0; i + 2 < count; i += 3) {
      _a.fromBufferAttribute(pos, index ? index.getX(i) : i);
      _b.fromBufferAttribute(pos, index ? index.getX(i + 1) : i + 1);
      _c.fromBufferAttribute(pos, index ? index.getX(i + 2) : i + 2);
      if (matrix) {
        _a.applyMatrix4(matrix);
        _b.applyMatrix4(matrix);
        _c.applyMatrix4(matrix);
      }
      this.triangle(_a, _b, _c, sid);
    }
    return this;
  }

  /**
   * Todas as malhas de um objeto (e dos filhos) nas matrizes de mundo atuais: props que colidem com a própria forma
   * visual (pote, ferramenta, boneco). Paredes e chão com relevo visual usam caixas.
   */
  object(root, { surface = 'padrao' } = {}) {
    root.updateWorldMatrix(true, true);
    root.traverse((o) => {
      if (o.isMesh) this.geometry(o.geometry, { matrix: o.matrixWorld, surface });
    });
    return this;
  }

  /** Caixa w × h × d centrada na origem do objeto, posta no mundo por `matrix` ou `center`. */
  box(w, h, d, { matrix = null, center = null, surface = 'padrao' } = {}) {
    const m = placement(matrix, center);
    const x0 = -w / 2, x1 = w / 2, y0 = -h / 2, y1 = h / 2, z0 = -d / 2, z1 = d / 2;
    const p = (x, y, z) => new THREE.Vector3(x, y, z).applyMatrix4(m);
    const c000 = p(x0, y0, z0), c100 = p(x1, y0, z0), c010 = p(x0, y1, z0), c110 = p(x1, y1, z0);
    const c001 = p(x0, y0, z1), c101 = p(x1, y0, z1), c011 = p(x0, y1, z1), c111 = p(x1, y1, z1);
    this.quad(c101, c100, c110, c111, surface); // +X
    this.quad(c000, c001, c011, c010, surface); // −X
    this.quad(c011, c111, c110, c010, surface); // +Y
    this.quad(c000, c100, c101, c001, surface); // −Y
    this.quad(c001, c101, c111, c011, surface); // +Z
    this.quad(c100, c000, c010, c110, surface); // −Z
    return this;
  }

  /** Cilindro vertical com base em y = 0 e topo em y = h (no objeto); polígono circunscrito ao círculo de raio r. */
  cylinder(r, h, { segments = 32, matrix = null, center = null, surface = 'padrao' } = {}) {
    const m = placement(matrix, center);
    const R = r / Math.cos(Math.PI / segments);
    const ring = (y) => Array.from({ length: segments }, (_, i) => {
      const a = (i / segments) * Math.PI * 2;
      return new THREE.Vector3(Math.cos(a) * R, y, -Math.sin(a) * R).applyMatrix4(m);
    });
    const bottom = ring(0);
    const top = ring(h);
    const cb = new THREE.Vector3(0, 0, 0).applyMatrix4(m);
    const ct = new THREE.Vector3(0, h, 0).applyMatrix4(m);
    for (let i = 0; i < segments; i++) {
      const j = (i + 1) % segments;
      this.quad(bottom[i], bottom[j], top[j], top[i], surface);
      this.triangle(ct, top[i], top[j], surface);
      this.triangle(cb, bottom[j], bottom[i], surface);
    }
    return this;
  }

  /** Rampa (cunha) de largura w em X que sobe de y = 0 em z = 0 até y = h em z = l (no objeto). */
  ramp(w, l, h, { matrix = null, center = null, surface = 'padrao' } = {}) {
    const m = placement(matrix, center);
    const p = (x, y, z) => new THREE.Vector3(x, y, z).applyMatrix4(m);
    const hw = w / 2;
    const b0 = p(-hw, 0, 0), b1 = p(hw, 0, 0), b2 = p(hw, 0, l), b3 = p(-hw, 0, l);
    const t2 = p(hw, h, l), t3 = p(-hw, h, l);
    this.quad(b0, t3, t2, b1, surface); // rampa
    this.quad(b3, b2, t2, t3, surface); // costas
    this.quad(b0, b1, b2, b3, surface); // fundo
    this.triangle(b0, b3, t3, surface); // lado −X
    this.triangle(b1, t2, b2, surface); // lado +X
    return this;
  }

  /** Escada maciça de `count` degraus: cada um sobe `rise` e avança `run` em +Z; largura w em X (no objeto). */
  stairs(w, rise, run, count, { matrix = null, center = null, surface = 'padrao' } = {}) {
    const base = placement(matrix, center);
    for (let i = 0; i < count; i++) {
      const h = (i + 1) * rise;
      const local = new THREE.Matrix4().makeTranslation(0, h / 2, i * run + run / 2);
      this.box(w, h, run, { matrix: new THREE.Matrix4().multiplyMatrices(base, local), surface });
    }
    return this;
  }

  /** Triângulos prontos para o CollisionBody. */
  build() {
    return { positions: Float64Array.from(this.positions), surfaces: Uint8Array.from(this.surfaces) };
  }
}
