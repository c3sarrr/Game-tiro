// Peças da pista de testes em dados simples (sem WebGL): cada peça tem forma de colisão, matriz de mundo, tamanho,
// superfície e aparência; cada enfeite (fita, etiqueta, tinta, trena...) só aparência. O layout (layout.js) monta as
// listas; colliders.js e os visuais (visual/) leem delas — a mesma fonte para o que colide e o que se vê.
//
// Formas (tamanho no espaço da peça):
//   box      [w, h, d] centrada na origem da matriz
//   ramp     [w, h, l] cunha que sobe de y = 0 em z = 0 até y = h em z = l (ColliderBuilder.ramp)
//   cylinder [r, h]    cilindro vertical de y = 0 a y = h
//   tent     [w, h, d] plaquinha dobrada em "A": duas rampas de costas, cumeeira em z = 0, base de −d/2 a d/2
// Convenções de rumo em src/data/pista.js: a direção do rumo h é (sen h, −cos h); yawMatrix põe o −Z local no rumo.

import * as THREE from 'three';

export const DEG = Math.PI / 180;

const _x = new THREE.Vector3();
const _y = new THREE.Vector3();
const _z = new THREE.Vector3();

/** Direção [x, z] do rumo `h` (graus). */
export function headingDir(h) {
  return [Math.sin(h * DEG), -Math.cos(h * DEG)];
}

/** Rumo (graus, 0–360) da direção (x, z). */
export function headingOf(x, z) {
  const h = Math.atan2(x, -z) / DEG;
  return (h + 360) % 360;
}

/** Matriz com origem em (x, y, z) e o −Z local apontando para o rumo `heading` (o +X local fica à direita). */
export function yawMatrix(x, y, z, heading = 0) {
  return new THREE.Matrix4().makeRotationY(-heading * DEG).setPosition(x, y, z);
}

/** Matriz a partir da origem e de dois eixos (o terceiro sai do produto vetorial, base ortonormal destra). */
export function basisMatrix([ox, oy, oz], xAxis, yAxis) {
  _x.set(xAxis[0], xAxis[1], xAxis[2]).normalize();
  _y.set(yAxis[0], yAxis[1], yAxis[2]).normalize();
  _z.crossVectors(_x, _y).normalize();
  _y.crossVectors(_z, _x);
  return new THREE.Matrix4().makeBasis(_x, _y, _z).setPosition(ox, oy, oz);
}

/**
 * Matriz de tira deitada no chão (fita, etiqueta, trena): X local ao longo do rumo `heading`, Z local para cima (a
 * normal da tira do propGeometry.tapeStrip), origem no centro.
 */
export function floorStripMatrix(x, y, z, heading) {
  const [dx, dz] = headingDir(heading);
  return basisMatrix([x, y, z], [dx, 0, dz], [dz, 0, -dx]);
}

/**
 * Matriz de enfeite colado numa face vertical voltada para o rumo `facing`: X local para a direita de quem olha a face,
 * Y local para cima, Z local saindo da face.
 */
export function wallDecalMatrix(x, y, z, facing) {
  const [nx, nz] = headingDir(facing);
  return basisMatrix([x, y, z], [nz, 0, -nx], [0, 1, 0]);
}

/** Matriz de enfeite deitado no chão, lido por quem olha para o rumo `heading` (Y local = para a frente dele). */
export function floorDecalMatrix(x, y, z, heading) {
  const [dx, dz] = headingDir(heading);
  return basisMatrix([x, y, z], [-dz, 0, dx], [dx, 0, dz]);
}

export class PieceList {
  constructor() {
    this.pieces = [];
    this.decor = [];
    this.ids = new Set();
  }

  #claim(id) {
    if (this.ids.has(id)) throw new Error(`peça repetida na pista: ${id}`);
    this.ids.add(id);
  }

  /**
   * Peça sólida. `station`: número da estação (0 = base, cerca, praça). `look`: aparência ({ kind, ... }); kind
   * 'none' = só colisão. `part`: nome que junta peças numa parede só para o wall-jump (ColliderBuilder); sem nome, cada
   * peça é uma parede.
   */
  add({
    id, station = 0, shape = 'box', size, matrix, surface = 'padrao', collide = true, look = { kind: 'none' }, part = null,
  }) {
    this.#claim(id);
    const p = { id, station, shape, size: Object.freeze([...size]), matrix, surface, collide, look, part };
    this.pieces.push(p);
    return p;
  }

  /** Caixa alinhada aos eixos pelos limites. */
  bounds(id, [x0, x1], [y0, y1], [z0, z1], opts = {}) {
    return this.add({
      ...opts, id, shape: 'box', size: [x1 - x0, y1 - y0, z1 - z0],
      matrix: new THREE.Matrix4().makeTranslation((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2),
    });
  }

  /** Caixa de tamanho [w, h, d] com a base em y0, centrada em (x, z) e girada para o rumo `heading`. */
  standing(id, x, y0, z, [w, h, d], heading = 0, opts = {}) {
    return this.add({ ...opts, id, shape: 'box', size: [w, h, d], matrix: yawMatrix(x, y0 + h / 2, z, heading) });
  }

  /**
   * Placa de compensado pelos limites, com a espessura no Y local (as lâminas do material seguem o Y da peça):
   * `axis` = eixo do mundo da espessura ('x', 'y' ou 'z').
   */
  board(id, xr, yr, zr, axis, opts = {}) {
    return this.#slab(id, xr, yr, zr, axis, 'y', opts);
  }

  /** Placa de papelão pelos limites, com a espessura no Z local (como boardGeometry.cardboardPanel). */
  panel(id, xr, yr, zr, axis, opts = {}) {
    return this.#slab(id, xr, yr, zr, axis, 'z', opts);
  }

  #slab(id, [x0, x1], [y0, y1], [z0, z1], axis, local, opts) {
    const ext = { x: x1 - x0, y: y1 - y0, z: z1 - z0 };
    const m = new THREE.Matrix4();
    let size;
    if (local === 'y') {
      // Y local = eixo da espessura; X local = X do mundo (ou −Y quando a espessura é X).
      if (axis === 'y') size = [ext.x, ext.y, ext.z];
      else if (axis === 'z') {
        m.makeRotationX(Math.PI / 2); // Y → +Z, Z → −Y
        size = [ext.x, ext.z, ext.y];
      } else {
        m.makeRotationZ(-Math.PI / 2); // Y → +X, X → −Y
        size = [ext.y, ext.x, ext.z];
      }
    } else if (axis === 'z') size = [ext.x, ext.y, ext.z];
    else if (axis === 'x') {
      m.makeRotationY(Math.PI / 2); // Z → +X, X → −Z
      size = [ext.z, ext.y, ext.x];
    } else {
      m.makeRotationX(-Math.PI / 2); // Z → +Y, Y → −Z
      size = [ext.x, ext.z, ext.y];
    }
    m.setPosition((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
    return this.add({ ...opts, id, shape: 'box', size, matrix: m });
  }

  /** Enfeite (só aparência). */
  addDecor({ id, station = 0, kind, matrix, ...params }) {
    this.#claim(id);
    const d = { id, station, kind, matrix, ...params };
    this.decor.push(d);
    return d;
  }
}

/** Pontos de um retângulo [x0, x1] × [z0, z1] dentro de outro (com folga `eps`). */
export function rectInside([ax0, ax1], [az0, az1], [bx0, bx1], [bz0, bz1], eps = 1e-6) {
  return ax0 >= bx0 - eps && ax1 <= bx1 + eps && az0 >= bz0 - eps && az1 <= bz1 + eps;
}

/** Os retângulos se sobrepõem (área positiva)? */
export function rectsOverlap([ax0, ax1], [az0, az1], [bx0, bx1], [bz0, bz1]) {
  return ax0 < bx1 && bx0 < ax1 && az0 < bz1 && bz0 < az1;
}

/** Cantos da forma de uma peça no mundo (para medir limites e sobreposições nos testes e na planta). */
export function pieceCorners(p) {
  const pts = [];
  const push = (x, y, z) => pts.push(new THREE.Vector3(x, y, z).applyMatrix4(p.matrix));
  const [a, b, c] = p.size;
  if (p.shape === 'box' || p.shape === 'tent') {
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) {
      push((sx * a) / 2, p.shape === 'tent' ? (sy < 0 ? 0 : b) : (sy * b) / 2, (sz * c) / 2);
    }
  } else if (p.shape === 'ramp') {
    for (const sx of [-1, 1]) {
      push((sx * a) / 2, 0, 0);
      push((sx * a) / 2, 0, c);
      push((sx * a) / 2, b, c);
    }
  } else if (p.shape === 'cylinder') {
    for (let i = 0; i < 16; i++) {
      const t = (i / 16) * Math.PI * 2;
      push(Math.cos(t) * a, 0, Math.sin(t) * a);
      push(Math.cos(t) * a, b, Math.sin(t) * a);
    }
  }
  return pts;
}

/** Caixa envolvente [min, max] (THREE.Box3) de uma peça no mundo. */
export function pieceBox(p) {
  return new THREE.Box3().setFromPoints(pieceCorners(p));
}
