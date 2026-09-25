// Mundo de colisão: corpos com BVH e as consultas do controlador de personagem, do hitscan e da câmera — varredura de
// cápsula (o "trace" do Source), contato mais fundo, desempenetração, busca de espaço livre, chão da base chata e
// raio. Nenhuma consulta aloca: os callbacks do BVH são criados uma vez e leem os parâmetros de campos da instância.
// A cápsula é dada pelos pés (origem), raio e altura; o segmento interno vai de y + raio a y + altura − raio.

import * as THREE from 'three';
import { INTERSECTED, NOT_INTERSECTED } from 'three-mesh-bvh';
import { CONTROLLER } from '../data/movement.js';
import { TRI_STRIDE, closestSegmentTriangle, createClosest, rayBoxEntry, triangleDiscRange } from './geometryQueries.js';
import { SWEEP_TOLERANCE, createSweepHit, sweepCapsuleTriangle } from './capsuleSweep.js';
import { CollisionBody } from './collisionBody.js';

/** Resultado reutilizável de uma varredura (o trace_t do Source). */
export function createTrace() {
  return {
    fraction: 1,
    hit: false,
    startSolid: false,
    endpos: new THREE.Vector3(),
    normal: new THREE.Vector3(), // normal de contato: do obstáculo para a cápsula
    faceNormal: new THREE.Vector3(), // normal da face tocada, virada para a cápsula (numa aresta, a de uma das faces)
    point: new THREE.Vector3(), // ponto de contato no obstáculo
    surface: 0,
    body: null,
    triangle: -1,
    part: -1, // peça do ColliderBuilder
  };
}

export function copyTrace(src, dst) {
  if (src === dst) return dst;
  dst.fraction = src.fraction;
  dst.hit = src.hit;
  dst.startSolid = src.startSolid;
  dst.endpos.copy(src.endpos);
  dst.normal.copy(src.normal);
  dst.faceNormal.copy(src.faceNormal);
  dst.point.copy(src.point);
  dst.surface = src.surface;
  dst.body = src.body;
  dst.triangle = src.triangle;
  dst.part = src.part;
  return dst;
}

/** Resultado reutilizável de um raio. */
export function createRayHit() {
  return { hit: false, distance: Infinity, point: new THREE.Vector3(), normal: new THREE.Vector3(), surface: 0, body: null, triangle: -1 };
}

/** Contato mais fundo (desempenetração): distância, normal de empurrão e, se o segmento fura, quanto falta sair. */
export function createContact() {
  return { distance: 0, normal: new THREE.Vector3(), pierced: false, pierceDepth: 0, surface: 0, body: null };
}

const _hit = createSweepHit();
const _c = createClosest();
const _contact = createContact();
const _free = new THREE.Vector3();

function toWorldDir(body, x, y, z, out) {
  if (!body.transformed) return out.set(x, y, z);
  const e = body.matrix.elements;
  return out.set(e[0] * x + e[4] * y + e[8] * z, e[1] * x + e[5] * y + e[9] * z, e[2] * x + e[6] * y + e[10] * z);
}

function toWorldPoint(body, x, y, z, out) {
  if (!body.transformed) return out.set(x, y, z);
  const e = body.matrix.elements;
  return out.set(
    e[0] * x + e[4] * y + e[8] * z + e[12], e[1] * x + e[5] * y + e[9] * z + e[13], e[2] * x + e[6] * y + e[10] * z + e[14],
  );
}

const _sp = new Float64Array(9); // vértices (mundo) do triângulo em teste no chão da base chata
const _range = { min: 0, max: 0 };

export class CollisionWorld {
  constructor({ skin = CONTROLLER.skin } = {}) {
    this.skin = skin;
    this.bodies = [];
    this.stats = { sweeps: 0, overlaps: 0, rays: 0, triangles: 0 };
    this._nextKey = 1; // chave dos corpos neste mundo (addBody)
    // Consulta em andamento, no espaço do corpo atual.
    this._tris = null;
    this._s0x = 0; this._s0y = 0; this._s0z = 0;
    this._s1x = 0; this._s1y = 0; this._s1z = 0;
    this._dx = 0; this._dy = 0; this._dz = 0;
    this._cx = 0; this._cy = 0; this._cz = 0;
    this._ex = 0; this._ey = 0; this._ez = 0;
    this._minX = 0; this._minY = 0; this._minZ = 0;
    this._maxX = 0; this._maxY = 0; this._maxZ = 0;
    this._target = 0;
    this._best = 1;
    this._bestVn = 0;
    this._limit = 0;
    this._found = false;
    this._stop = false;
    this._tri = -1;
    this._hnx = 0; this._hny = 0; this._hnz = 0;
    this._hpx = 0; this._hpy = 0; this._hpz = 0;
    this._startDist = Infinity;
    this._pierced = false;
    this._pierceDepth = 0;
    // Consulta do chão da base chata (supportBelow).
    this._qBody = null;
    this._sx = 0; this._sz = 0; this._sr = 0;
    this._sMinY = 0; this._sMaxY = 0; this._sMinNy = 0;
    this._sBest = -Infinity; this._sBestNy = 0;
    this._snx = 0; this._sny = 1; this._snz = 0;
    this._sweepCb = {
      boundsTraverseOrder: (box) => rayBoxEntry(
        this._cx, this._cy, this._cz, this._dx, this._dy, this._dz,
        box.min.x - this._ex, box.min.y - this._ey, box.min.z - this._ez,
        box.max.x + this._ex, box.max.y + this._ey, box.max.z + this._ez, this._best,
      ),
      intersectsBounds: (box, isLeaf, score) => (score <= this._best ? INTERSECTED : NOT_INTERSECTED),
      intersectsRange: (offset, count) => this.#sweepRange(offset, count),
    };
    this._overlapCb = {
      intersectsBounds: (box) => (box.min.x <= this._maxX && box.max.x >= this._minX && box.min.y <= this._maxY
        && box.max.y >= this._minY && box.min.z <= this._maxZ && box.max.z >= this._minZ ? INTERSECTED : NOT_INTERSECTED),
      intersectsRange: (offset, count) => this.#overlapRange(offset, count),
    };
    this._supportCb = {
      intersectsBounds: this._overlapCb.intersectsBounds,
      intersectsRange: (offset, count) => this.#supportRange(offset, count),
    };
    this._rayCb = {
      boundsTraverseOrder: (box) => rayBoxEntry(
        this._s0x, this._s0y, this._s0z, this._dx, this._dy, this._dz,
        box.min.x, box.min.y, box.min.z, box.max.x, box.max.y, box.max.z, this._best,
      ),
      intersectsBounds: (box, isLeaf, score) => (score <= this._best ? INTERSECTED : NOT_INTERSECTED),
      intersectsRange: (offset, count) => this.#rayRange(offset, count),
    };
  }

  /** Mundo com um único corpo estático montado pelo ColliderBuilder. */
  static fromBuilder(builder, name = 'mapa') {
    const world = new CollisionWorld();
    world.addBody(new CollisionBody(builder.build(), { name }));
    return world;
  }

  /** Põe o corpo no mundo com a chave seguinte: mundos montados na mesma ordem dão as mesmas chaves. */
  addBody(body) {
    body.key = this._nextKey++;
    this.bodies.push(body);
    return body;
  }

  removeBody(body) {
    const i = this.bodies.indexOf(body);
    if (i >= 0) this.bodies.splice(i, 1);
    return i >= 0;
  }

  get triangleCount() {
    let n = 0;
    for (const body of this.bodies) n += body.triangleCount;
    return n;
  }

  /** Leva o segmento AB e o deslocamento D para o espaço do corpo e prepara os triângulos dele. */
  #setQuery(body, ax, ay, az, bx, by, bz, dx, dy, dz) {
    this._tris = body.tris;
    if (!body.transformed) {
      this._s0x = ax; this._s0y = ay; this._s0z = az;
      this._s1x = bx; this._s1y = by; this._s1z = bz;
      this._dx = dx; this._dy = dy; this._dz = dz;
      return;
    }
    const e = body.inverse.elements;
    this._s0x = e[0] * ax + e[4] * ay + e[8] * az + e[12];
    this._s0y = e[1] * ax + e[5] * ay + e[9] * az + e[13];
    this._s0z = e[2] * ax + e[6] * ay + e[10] * az + e[14];
    this._s1x = e[0] * bx + e[4] * by + e[8] * bz + e[12];
    this._s1y = e[1] * bx + e[5] * by + e[9] * bz + e[13];
    this._s1z = e[2] * bx + e[6] * by + e[10] * bz + e[14];
    this._dx = e[0] * dx + e[4] * dy + e[8] * dz;
    this._dy = e[1] * dx + e[5] * dy + e[9] * dz;
    this._dz = e[2] * dx + e[6] * dy + e[10] * dz;
  }

  /**
   * Varre a cápsula (pés em O, raio, altura) pelo deslocamento D e para no primeiro contato a `raio + folga`.
   * `out` recebe a fração percorrida, a posição final dos pés e o contato (normal, face, ponto, superfície, corpo).
   * startSolid: começou penetrando (além da tolerância) e se aprofundando.
   */
  sweepCapsule(ox, oy, oz, dx, dy, dz, radius, height, out, skin = this.skin) {
    this.stats.sweeps++;
    const half = height * 0.5;
    const y0 = oy + Math.min(radius, half);
    const y1 = oy + Math.max(height - radius, half);
    const target = radius + skin;
    const margin = target + SWEEP_TOLERANCE;
    out.hit = false;
    out.startSolid = false;
    out.body = null;
    out.triangle = -1;
    out.part = -1;
    out.surface = 0;
    out.normal.set(0, 0, 0);
    out.faceNormal.set(0, 0, 0);
    let best = 1;
    for (let b = 0; b < this.bodies.length; b++) {
      const body = this.bodies[b];
      this.#setQuery(body, ox, y0, oz, ox, y1, oz, dx, dy, dz);
      this._ex = Math.abs(this._s1x - this._s0x) * 0.5 + margin;
      this._ey = Math.abs(this._s1y - this._s0y) * 0.5 + margin;
      this._ez = Math.abs(this._s1z - this._s0z) * 0.5 + margin;
      this._cx = (this._s0x + this._s1x) * 0.5;
      this._cy = (this._s0y + this._s1y) * 0.5;
      this._cz = (this._s0z + this._s1z) * 0.5;
      const lb = body.localBounds;
      if (rayBoxEntry(this._cx, this._cy, this._cz, this._dx, this._dy, this._dz,
        lb.min.x - this._ex, lb.min.y - this._ey, lb.min.z - this._ez,
        lb.max.x + this._ex, lb.max.y + this._ey, lb.max.z + this._ez, best) === Infinity) continue;
      this._target = target;
      this._best = best;
      this._found = false;
      body.bvh.shapecast(this._sweepCb);
      if (!this._found) continue;
      best = this._best;
      out.hit = true;
      out.body = body;
      out.triangle = this._tri;
      out.surface = body.surface[this._tri];
      out.part = body.part[this._tri];
      toWorldDir(body, this._hnx, this._hny, this._hnz, out.normal);
      toWorldPoint(body, this._hpx, this._hpy, this._hpz, out.point);
      const o = this._tri * TRI_STRIDE;
      toWorldDir(body, body.tris[o + 9], body.tris[o + 10], body.tris[o + 11], out.faceNormal);
      if (out.faceNormal.dot(out.normal) < 0) out.faceNormal.negate();
      out.startSolid = best === 0 && this._startDist < radius - CONTROLLER.penetrationTolerance;
    }
    out.fraction = best;
    out.endpos.set(ox + dx * best, oy + dy * best, oz + dz * best);
    return out;
  }

  #sweepRange(offset, count) {
    const T = this._tris;
    const s0x = this._s0x, s0y = this._s0y, s0z = this._s0z;
    const s1x = this._s1x, s1y = this._s1y, s1z = this._s1z;
    const dx = this._dx, dy = this._dy, dz = this._dz;
    const target = this._target;
    const lim = target + SWEEP_TOLERANCE;
    this.stats.triangles += count;
    for (let i = offset, end = offset + count; i < end; i++) {
      const o = i * TRI_STRIDE;
      // Rejeição pelo plano: as pontas do segmento, no começo e no fim, do mesmo lado e além do alcance.
      const nx = T[o + 9], ny = T[o + 10], nz = T[o + 11];
      const e0 = (s0x - T[o]) * nx + (s0y - T[o + 1]) * ny + (s0z - T[o + 2]) * nz;
      const e1 = (s1x - T[o]) * nx + (s1y - T[o + 1]) * ny + (s1z - T[o + 2]) * nz;
      const dn = (dx * nx + dy * ny + dz * nz) * this._best;
      const e2 = e0 + dn;
      const e3 = e1 + dn;
      if (e0 > lim && e1 > lim && e2 > lim && e3 > lim) continue;
      if (e0 < -lim && e1 < -lim && e2 < -lim && e3 < -lim) continue;
      if (!sweepCapsuleTriangle(s0x, s0y, s0z, s1x, s1y, s1z, dx, dy, dz, T, o, target, this._best, _hit)) continue;
      const vn = dx * _hit.nx + dy * _hit.ny + dz * _hit.nz;
      if (this._found) {
        // Empate no mesmo t (quina tocada no começo): fica com o plano que mais se opõe ao movimento.
        if (_hit.t > this._best + 1e-12) continue;
        if (_hit.t > this._best - 1e-12 && vn >= this._bestVn) continue;
      }
      this._found = true;
      this._best = _hit.t;
      this._bestVn = vn;
      this._tri = i;
      this._hnx = _hit.nx; this._hny = _hit.ny; this._hnz = _hit.nz;
      this._hpx = _hit.px; this._hpy = _hit.py; this._hpz = _hit.pz;
      this._startDist = _hit.startDist;
    }
    return false;
  }

  /**
   * Contato mais fundo da cápsula: o triângulo mais próximo do segmento abaixo de `limit`. Escreve em `out` a
   * distância, a normal de empurrão (mundo) e, quando o segmento fura o triângulo, quanto falta para sair.
   * `firstOnly`: para no primeiro contato (teste "cabe aqui?").
   */
  deepestContact(ox, oy, oz, radius, height, limit, out, firstOnly = false) {
    this.stats.overlaps++;
    const half = height * 0.5;
    const y0 = oy + Math.min(radius, half);
    const y1 = oy + Math.max(height - radius, half);
    let found = false;
    this._limit = limit;
    for (let b = 0; b < this.bodies.length; b++) {
      const body = this.bodies[b];
      this.#setQuery(body, ox, y0, oz, ox, y1, oz, 0, 0, 0);
      const l = this._limit;
      this._minX = Math.min(this._s0x, this._s1x) - l;
      this._minY = Math.min(this._s0y, this._s1y) - l;
      this._minZ = Math.min(this._s0z, this._s1z) - l;
      this._maxX = Math.max(this._s0x, this._s1x) + l;
      this._maxY = Math.max(this._s0y, this._s1y) + l;
      this._maxZ = Math.max(this._s0z, this._s1z) + l;
      const lb = body.localBounds;
      if (lb.min.x > this._maxX || lb.max.x < this._minX || lb.min.y > this._maxY || lb.max.y < this._minY
        || lb.min.z > this._maxZ || lb.max.z < this._minZ) continue;
      this._found = false;
      this._stop = firstOnly;
      body.bvh.shapecast(this._overlapCb);
      if (!this._found) continue;
      found = true;
      out.distance = this._limit;
      out.pierced = this._pierced;
      out.pierceDepth = this._pierceDepth;
      out.body = body;
      out.surface = body.surface[this._tri];
      toWorldDir(body, this._hnx, this._hny, this._hnz, out.normal);
      if (firstOnly) break;
    }
    return found;
  }

  /**
   * Chão da base chata (o fundo reto da caixa do Source): a maior altura de face andável virada para cima
   * (normal.y ≥ minNormalY) dentro do cilindro vertical de raio `radius` em volta de (x, z), entre `minY` e `maxY`;
   * face que passa de `maxY` dentro do disco é obstáculo acima da base, não chão. A cápsula colide com o redondo, mas
   * o jogador fica de pé em tudo o que o disco dos pés cobre — beirada, degrau, topo de rampa — e só alcança o que o
   * pulo alcança. Escreve em `out` ({height, normal, surface}); false se não há chão.
   */
  supportBelow(x, z, radius, minY, maxY, minNormalY, out) {
    this.stats.overlaps++;
    this._sx = x;
    this._sz = z;
    this._sr = radius;
    this._sMinY = minY;
    this._sMaxY = maxY;
    this._sMinNy = minNormalY;
    this._sBest = -Infinity;
    this._sBestNy = 0;
    let found = false;
    for (let b = 0; b < this.bodies.length; b++) {
      const body = this.bodies[b];
      if (!this.#setBoxQuery(body, x - radius, minY, z - radius, x + radius, maxY, z + radius)) continue;
      this._tris = body.tris;
      this._qBody = body;
      this._found = false;
      body.bvh.shapecast(this._supportCb);
      if (!this._found) continue;
      found = true;
      out.height = this._sBest;
      out.surface = body.surface[this._tri];
      out.normal.set(this._snx, this._sny, this._snz);
    }
    return found;
  }

  /** Caixa de mundo levada ao espaço do corpo (conservadora se ele gira); false se nem encosta nos limites dele. */
  #setBoxQuery(body, x0, y0, z0, x1, y1, z1) {
    if (!body.transformed) {
      this._minX = x0; this._minY = y0; this._minZ = z0;
      this._maxX = x1; this._maxY = y1; this._maxZ = z1;
    } else {
      const e = body.inverse.elements;
      let ax = Infinity, ay = Infinity, az = Infinity, bx = -Infinity, by = -Infinity, bz = -Infinity;
      for (let k = 0; k < 8; k++) {
        const px = k & 1 ? x1 : x0, py = k & 2 ? y1 : y0, pz = k & 4 ? z1 : z0;
        const lx = e[0] * px + e[4] * py + e[8] * pz + e[12];
        const ly = e[1] * px + e[5] * py + e[9] * pz + e[13];
        const lz = e[2] * px + e[6] * py + e[10] * pz + e[14];
        if (lx < ax) ax = lx;
        if (ly < ay) ay = ly;
        if (lz < az) az = lz;
        if (lx > bx) bx = lx;
        if (ly > by) by = ly;
        if (lz > bz) bz = lz;
      }
      this._minX = ax; this._minY = ay; this._minZ = az;
      this._maxX = bx; this._maxY = by; this._maxZ = bz;
    }
    const lb = body.localBounds;
    return !(lb.min.x > this._maxX || lb.max.x < this._minX || lb.min.y > this._maxY || lb.max.y < this._minY
      || lb.min.z > this._maxZ || lb.max.z < this._minZ);
  }

  #supportRange(offset, count) {
    const T = this._tris;
    const body = this._qBody;
    const e = body.transformed ? body.matrix.elements : null;
    const lo = this._sMinY, hi = this._sMaxY;
    this.stats.triangles += count;
    for (let i = offset, end = offset + count; i < end; i++) {
      const o = i * TRI_STRIDE;
      let nx = T[o + 9], ny = T[o + 10], nz = T[o + 11];
      if (e) {
        const wx = e[0] * nx + e[4] * ny + e[8] * nz;
        const wy = e[1] * nx + e[5] * ny + e[9] * nz;
        const wz = e[2] * nx + e[6] * ny + e[10] * nz;
        nx = wx; ny = wy; nz = wz;
      }
      // Só face virada para cima segura a base: a de baixo de uma aba (normal para baixo) tem o sólido por cima.
      if (ny < this._sMinNy) continue;
      for (let k = 0; k < 9; k += 3) {
        const x = T[o + k], y = T[o + k + 1], z = T[o + k + 2];
        if (e) {
          _sp[k] = e[0] * x + e[4] * y + e[8] * z + e[12];
          _sp[k + 1] = e[1] * x + e[5] * y + e[9] * z + e[13];
          _sp[k + 2] = e[2] * x + e[6] * y + e[10] * z + e[14];
        } else {
          _sp[k] = x; _sp[k + 1] = y; _sp[k + 2] = z;
        }
      }
      if (!triangleDiscRange(_sp, nx, ny, nz, this._sx, this._sz, this._sr, _range)) continue;
      // Face que passa de maxY dentro do disco é obstáculo acima da base (o redondo da cápsula chegou perto dela
      // por baixo), não chão.
      if (_range.max > hi || _range.max < lo) continue;
      const h = _range.max;
      // Mais alto ganha; na mesma altura (aresta de duas faces), a face mais plana.
      if (h < this._sBest - 1e-9 || (h <= this._sBest + 1e-9 && ny <= this._sBestNy)) continue;
      this._sBest = h;
      this._sBestNy = ny;
      this._found = true;
      this._tri = i;
      this._snx = nx; this._sny = ny; this._snz = nz;
    }
    return false;
  }

  #overlapRange(offset, count) {
    const T = this._tris;
    const s0x = this._s0x, s0y = this._s0y, s0z = this._s0z;
    const s1x = this._s1x, s1y = this._s1y, s1z = this._s1z;
    this.stats.triangles += count;
    for (let i = offset, end = offset + count; i < end; i++) {
      const o = i * TRI_STRIDE;
      const lim = this._limit;
      const nx = T[o + 9], ny = T[o + 10], nz = T[o + 11];
      const e0 = (s0x - T[o]) * nx + (s0y - T[o + 1]) * ny + (s0z - T[o + 2]) * nz;
      const e1 = (s1x - T[o]) * nx + (s1y - T[o + 1]) * ny + (s1z - T[o + 2]) * nz;
      if ((e0 >= lim && e1 >= lim) || (e0 <= -lim && e1 <= -lim)) continue;
      const distSq = closestSegmentTriangle(s0x, s0y, s0z, s1x, s1y, s1z, T, o, _c);
      if (distSq >= lim * lim) continue;
      const dist = Math.sqrt(distSq);
      this._found = true;
      this._limit = dist;
      this._tri = i;
      if (dist > 1e-9) {
        const inv = 1 / dist;
        this._hnx = (_c.sx - _c.x) * inv;
        this._hny = (_c.sy - _c.y) * inv;
        this._hnz = (_c.sz - _c.z) * inv;
        this._pierced = false;
        this._pierceDepth = 0;
      } else {
        // O segmento fura o triângulo: sai pelo lado do meio do segmento (para cima, se o meio estiver no plano).
        let side = e0 + e1;
        if (side === 0) side = ny >= 0 ? 1 : -1;
        const sign = side > 0 ? 1 : -1;
        this._hnx = nx * sign;
        this._hny = ny * sign;
        this._hnz = nz * sign;
        this._pierced = true;
        this._pierceDepth = -Math.min(e0 * sign, e1 * sign);
      }
      if (this._stop) return true;
    }
    return false;
  }

  /**
   * Empurra a cápsula (pés em `pos`, alterado no lugar) para fora dos contatos até ficar a `raio + folga` de tudo,
   * resolvendo o mais fundo a cada iteração. Contatos só um pouco dentro da folga ficam como estão (repouso).
   * Devolve true se terminou sem penetração real. Com o segmento inteiro dentro de um sólido fechado a distância
   * aponta para dentro — nesse caso devolve false e quem chama recorre ao findFreeSpot a partir da posição original.
   */
  depenetrate(pos, radius, height, skin = this.skin) {
    const target = radius + skin;
    const keep = target - skin * 0.25;
    for (let i = 0; i < CONTROLLER.depenetrateIterations; i++) {
      if (!this.deepestContact(pos.x, pos.y, pos.z, radius, height, keep, _contact)) return true;
      const push = (_contact.pierced ? target + _contact.pierceDepth : target - _contact.distance) + 1e-4;
      pos.addScaledVector(_contact.normal, push);
    }
    return this.canOccupy(pos.x, pos.y, pos.z, radius, height);
  }

  /** A cápsula cabe aqui (nenhum triângulo mais perto do segmento que raio − tolerância)? */
  canOccupy(x, y, z, radius, height, tolerance = CONTROLLER.penetrationTolerance) {
    return !this.deepestContact(x, y, z, radius, height, radius - tolerance, _contact, true);
  }

  /**
   * Procura, em anéis cada vez maiores (primeiro para cima, depois em 8 direções no mesmo nível e acima, por último
   * para baixo), um lugar onde a cápsula caiba; move `pos` para lá. Para quem ficou espremido ou saiu do noclip
   * dentro de algo. `accept(pos)` opcional recusa lugares livres que não servem (sem chão, por exemplo).
   */
  findFreeSpot(pos, radius, height, skin = this.skin, accept = null) {
    const x = pos.x, y = pos.y, z = pos.z;
    for (const r of CONTROLLER.unstuckRadii) {
      if (this.#tryAt(pos, x, y + r, z, radius, height, skin, accept)) return true;
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2;
        const ox = Math.cos(a) * r;
        const oz = Math.sin(a) * r;
        if (this.#tryAt(pos, x + ox, y, z + oz, radius, height, skin, accept)) return true;
        if (this.#tryAt(pos, x + ox, y + r, z + oz, radius, height, skin, accept)) return true;
      }
      if (this.#tryAt(pos, x, y - r, z, radius, height, skin, accept)) return true;
    }
    return false;
  }

  #tryAt(pos, x, y, z, radius, height, skin, accept) {
    if (!this.canOccupy(x, y, z, radius, height)) return false;
    _free.set(x, y, z);
    this.depenetrate(_free, radius, height, skin);
    if (accept && !accept(_free)) return false;
    pos.copy(_free);
    return true;
  }

  /** Primeiro triângulo (dos dois lados) no raio O + t·D, t ∈ [0, maxDist], com D unitário. */
  raycast(ox, oy, oz, dx, dy, dz, maxDist, out) {
    this.stats.rays++;
    out.hit = false;
    out.body = null;
    out.triangle = -1;
    let best = maxDist;
    for (let b = 0; b < this.bodies.length; b++) {
      const body = this.bodies[b];
      this.#setQuery(body, ox, oy, oz, ox, oy, oz, dx, dy, dz);
      const lb = body.localBounds;
      if (rayBoxEntry(this._s0x, this._s0y, this._s0z, this._dx, this._dy, this._dz,
        lb.min.x, lb.min.y, lb.min.z, lb.max.x, lb.max.y, lb.max.z, best) === Infinity) continue;
      this._best = best;
      this._found = false;
      body.bvh.shapecast(this._rayCb);
      if (!this._found) continue;
      best = this._best;
      out.hit = true;
      out.body = body;
      out.triangle = this._tri;
      out.surface = body.surface[this._tri];
      toWorldDir(body, this._hnx, this._hny, this._hnz, out.normal);
    }
    out.distance = out.hit ? best : maxDist;
    out.point.set(ox + dx * out.distance, oy + dy * out.distance, oz + dz * out.distance);
    return out.hit;
  }

  /** Möller–Trumbore dos dois lados em cada triângulo da folha. */
  #rayRange(offset, count) {
    const T = this._tris;
    const ox = this._s0x, oy = this._s0y, oz = this._s0z;
    const dx = this._dx, dy = this._dy, dz = this._dz;
    this.stats.triangles += count;
    for (let i = offset, end = offset + count; i < end; i++) {
      const o = i * TRI_STRIDE;
      const e1x = T[o + 3] - T[o], e1y = T[o + 4] - T[o + 1], e1z = T[o + 5] - T[o + 2];
      const e2x = T[o + 6] - T[o], e2y = T[o + 7] - T[o + 1], e2z = T[o + 8] - T[o + 2];
      const px = dy * e2z - dz * e2y, py = dz * e2x - dx * e2z, pz = dx * e2y - dy * e2x;
      const det = e1x * px + e1y * py + e1z * pz;
      if (det > -1e-12 && det < 1e-12) continue;
      const inv = 1 / det;
      const sx = ox - T[o], sy = oy - T[o + 1], sz = oz - T[o + 2];
      const u = (sx * px + sy * py + sz * pz) * inv;
      if (u < 0 || u > 1) continue;
      const qx = sy * e1z - sz * e1y, qy = sz * e1x - sx * e1z, qz = sx * e1y - sy * e1x;
      const v = (dx * qx + dy * qy + dz * qz) * inv;
      if (v < 0 || u + v > 1) continue;
      const t = (e2x * qx + e2y * qy + e2z * qz) * inv;
      if (t < 0 || t > this._best) continue;
      this._best = t;
      this._found = true;
      this._tri = i;
      // Normal da face virada contra o raio (o triângulo vale dos dois lados).
      const nx = T[o + 9], ny = T[o + 10], nz = T[o + 11];
      const s = nx * dx + ny * dy + nz * dz > 0 ? -1 : 1;
      this._hnx = nx * s;
      this._hny = ny * s;
      this._hnz = nz * s;
    }
    return false;
  }

  dispose() {
    for (const body of this.bodies) body.dispose();
    this.bodies.length = 0;
  }
}
