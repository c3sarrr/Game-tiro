// Formas de colisão dos mapas, separadas da malha visual: o boil e as digitais da massinha são deformação de
// shader (não podem virar tropeço) e malha densa deixaria cada varredura cara. Cada mapa monta as suas formas com o
// ColliderBuilder e entrega o resultado ao CollisionBody. Cada triângulo guarda o material de superfície
// (src/data/surfaces.js), usado no atrito, no pulo, nos passos e nas pegadas, e a peça de onde veio (subfase 3.4): cada
// forma (box, cylinder, ramp, stairs, geometry, object, triângulo ou quadrilátero solto) é uma peça nova, e a opção
// `part` (um nome) junta formas numa peça só — o wall-jump conta cada peça como uma parede.

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
  #nextPart = 0;
  #named = new Map();

  constructor() {
    this.positions = [];
    this.surfaces = [];
    this.parts = [];
    this.skipped = 0;
  }

  get triangleCount() {
    return this.surfaces.length;
  }

  /** Quantas peças já foram criadas (ids de 0 a partCount − 1). */
  get partCount() {
    return this.#nextPart;
  }

  /** Id da peça: `part` (nome) junta formas numa peça só; sem nome, cada forma é uma peça nova. */
  #partId(part) {
    if (part === null || part === undefined) return this.#nextPart++;
    let id = this.#named.get(part);
    if (id === undefined) {
      id = this.#nextPart++;
      this.#named.set(part, id);
    }
    return id;
  }

  /** Triângulo já com material e peça resolvidos. */
  #push(a, b, c, sid, pid) {
    const abx = b.x - a.x, aby = b.y - a.y, abz = b.z - a.z;
    const acx = c.x - a.x, acy = c.y - a.y, acz = c.z - a.z;
    const cx = aby * acz - abz * acy;
    const cy = abz * acx - abx * acz;
    const cz = abx * acy - aby * acx;
    if (cx * cx + cy * cy + cz * cz < MIN_CROSS_SQ) {
      this.skipped++;
      return;
    }
    this.positions.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
    this.surfaces.push(sid);
    this.parts.push(pid);
  }

  #quad(a, b, c, d, sid, pid) {
    this.#push(a, b, c, sid, pid);
    this.#push(a, c, d, sid, pid);
  }

  /** Triângulo em espaço de mundo; `surface` é o id do material (ou o índice já resolvido); `part` junta peças. */
  triangle(a, b, c, surface = 'padrao', part = null) {
    this.#push(a, b, c, surfaceIndex(surface), this.#partId(part));
    return this;
  }

  /** Quadrilátero a-b-c-d em ordem (triângulos abc e acd), uma peça só. */
  quad(a, b, c, d, surface = 'padrao', part = null) {
    this.#quad(a, b, c, d, surfaceIndex(surface), this.#partId(part));
    return this;
  }

  /** Malha qualquer (indexada ou não) levada ao mundo por `matrix` — para malhas já simples (chão, placas, props). */
  geometry(geometry, { matrix = null, surface = 'padrao', part = null } = {}) {
    return this.#geometry(geometry, matrix, surfaceIndex(surface), this.#partId(part));
  }

  #geometry(geometry, matrix, sid, pid) {
    const pos = geometry.attributes.position;
    const index = geometry.index;
    const count = index ? index.count : pos.count;
    for (let i = 0; i + 2 < count; i += 3) {
      _a.fromBufferAttribute(pos, index ? index.getX(i) : i);
      _b.fromBufferAttribute(pos, index ? index.getX(i + 1) : i + 1);
      _c.fromBufferAttribute(pos, index ? index.getX(i + 2) : i + 2);
      if (matrix) {
        _a.applyMatrix4(matrix);
        _b.applyMatrix4(matrix);
        _c.applyMatrix4(matrix);
      }
      this.#push(_a, _b, _c, sid, pid);
    }
    return this;
  }

  /**
   * Todas as malhas de um objeto (e dos filhos) nas matrizes de mundo atuais, numa peça só: props que colidem com a
   * própria forma visual (pote, ferramenta, boneco). Paredes e chão com relevo visual usam caixas.
   */
  object(root, { surface = 'padrao', part = null } = {}) {
    const sid = surfaceIndex(surface);
    const pid = this.#partId(part);
    root.updateWorldMatrix(true, true);
    root.traverse((o) => {
      if (o.isMesh) this.#geometry(o.geometry, o.matrixWorld, sid, pid);
    });
    return this;
  }

  /** Caixa w × h × d centrada na origem do objeto, posta no mundo por `matrix` ou `center`. */
  box(w, h, d, { matrix = null, center = null, surface = 'padrao', part = null } = {}) {
    return this.#box(w, h, d, placement(matrix, center), surfaceIndex(surface), this.#partId(part));
  }

  #box(w, h, d, m, sid, pid) {
    const x0 = -w / 2, x1 = w / 2, y0 = -h / 2, y1 = h / 2, z0 = -d / 2, z1 = d / 2;
    const p = (x, y, z) => new THREE.Vector3(x, y, z).applyMatrix4(m);
    const c000 = p(x0, y0, z0), c100 = p(x1, y0, z0), c010 = p(x0, y1, z0), c110 = p(x1, y1, z0);
    const c001 = p(x0, y0, z1), c101 = p(x1, y0, z1), c011 = p(x0, y1, z1), c111 = p(x1, y1, z1);
    this.#quad(c101, c100, c110, c111, sid, pid); // +X
    this.#quad(c000, c001, c011, c010, sid, pid); // −X
    this.#quad(c011, c111, c110, c010, sid, pid); // +Y
    this.#quad(c000, c100, c101, c001, sid, pid); // −Y
    this.#quad(c001, c101, c111, c011, sid, pid); // +Z
    this.#quad(c100, c000, c010, c110, sid, pid); // −Z
    return this;
  }

  /** Cilindro vertical com base em y = 0 e topo em y = h (no objeto); polígono circunscrito ao círculo de raio r. */
  cylinder(r, h, { segments = 32, matrix = null, center = null, surface = 'padrao', part = null } = {}) {
    const m = placement(matrix, center);
    const sid = surfaceIndex(surface);
    const pid = this.#partId(part);
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
      this.#quad(bottom[i], bottom[j], top[j], top[i], sid, pid);
      this.#push(ct, top[i], top[j], sid, pid);
      this.#push(cb, bottom[j], bottom[i], sid, pid);
    }
    return this;
  }

  /** Rampa (cunha) de largura w em X que sobe de y = 0 em z = 0 até y = h em z = l (no objeto). */
  ramp(w, l, h, { matrix = null, center = null, surface = 'padrao', part = null } = {}) {
    const m = placement(matrix, center);
    const sid = surfaceIndex(surface);
    const pid = this.#partId(part);
    const p = (x, y, z) => new THREE.Vector3(x, y, z).applyMatrix4(m);
    const hw = w / 2;
    const b0 = p(-hw, 0, 0), b1 = p(hw, 0, 0), b2 = p(hw, 0, l), b3 = p(-hw, 0, l);
    const t2 = p(hw, h, l), t3 = p(-hw, h, l);
    this.#quad(b0, t3, t2, b1, sid, pid); // rampa
    this.#quad(b3, b2, t2, t3, sid, pid); // costas
    this.#quad(b0, b1, b2, b3, sid, pid); // fundo
    this.#push(b0, b3, t3, sid, pid); // lado −X
    this.#push(b1, t2, b2, sid, pid); // lado +X
    return this;
  }

  /** Escada maciça de `count` degraus (uma peça): cada um sobe `rise` e avança `run` em +Z; largura w em X. */
  stairs(w, rise, run, count, { matrix = null, center = null, surface = 'padrao', part = null } = {}) {
    const base = placement(matrix, center);
    const sid = surfaceIndex(surface);
    const pid = this.#partId(part);
    for (let i = 0; i < count; i++) {
      const h = (i + 1) * rise;
      const local = new THREE.Matrix4().makeTranslation(0, h / 2, i * run + run / 2);
      this.#box(w, h, run, new THREE.Matrix4().multiplyMatrices(base, local), sid, pid);
    }
    return this;
  }

  /** Triângulos prontos para o CollisionBody. */
  build() {
    return {
      positions: Float64Array.from(this.positions),
      surfaces: Uint8Array.from(this.surfaces),
      parts: Uint32Array.from(this.parts),
    };
  }
}
