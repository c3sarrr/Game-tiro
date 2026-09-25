// Sonda de parede do wall-jump (subfase 3.4): a face de parede mais próxima da cápsula a até `reach` além do raio. O
// segmento interno da cápsula (de y + raio a y + altura − raio) é comparado com os triângulos do mundo pelo par de pontos
// mais próximos (closestSegmentTriangle), no mesmo esquema das consultas do CollisionWorld: callbacks do BVH criados uma
// vez, parâmetros em campos da instância, nada aloca por consulta. Parede = normal de contato (do triângulo para a
// cápsula) quase horizontal, |n.y| ≤ maxNormalY: o chão, o teto, a aresta de cima de uma parede (o contato sai
// inclinado) e as rampas não contam. Arquivo próprio: o collisionWorld.js já tem ~580 linhas.

import { INTERSECTED, NOT_INTERSECTED } from 'three-mesh-bvh';
import { TRI_STRIDE, closestSegmentTriangle, createClosest } from './geometryQueries.js';

/** Resultado reutilizável da sonda. */
export function createWallHit() {
  return {
    hit: false,
    distance: 0, // do segmento da cápsula até a parede (u); encostada, fica em raio + folga
    nx: 0, // normal no plano (unitária), da parede para a cápsula
    nz: 0,
    ny: 0, // componente vertical da normal de contato (antes de ir para o plano)
    px: 0, // ponto de contato na parede (mundo)
    py: 0,
    pz: 0,
    body: null,
    part: -1, // peça do ColliderBuilder
    triangle: -1,
    surface: 0,
  };
}

const _c = createClosest();

export class WallProbe {
  /** @param {import('./collisionWorld.js').CollisionWorld} world */
  constructor(world) {
    this.world = world;
    this._tris = null;
    this._m = null; // elementos da matriz corpo → mundo (null se o corpo não gira)
    this._s0x = 0; this._s0y = 0; this._s0z = 0;
    this._s1x = 0; this._s1y = 0; this._s1z = 0;
    this._minX = 0; this._minY = 0; this._minZ = 0;
    this._maxX = 0; this._maxY = 0; this._maxZ = 0;
    this._limit = 0;
    this._maxNy = 0;
    this._found = false;
    this._tri = -1;
    this._nx = 0; this._ny = 0; this._nz = 0; // normal de contato (espaço do corpo)
    this._px = 0; this._py = 0; this._pz = 0; // ponto na parede (espaço do corpo)
    this._cb = {
      intersectsBounds: (box) => (box.min.x <= this._maxX && box.max.x >= this._minX && box.min.y <= this._maxY
        && box.max.y >= this._minY && box.min.z <= this._maxZ && box.max.z >= this._minZ ? INTERSECTED : NOT_INTERSECTED),
      intersectsRange: (offset, count) => this.#range(offset, count),
    };
  }

  /**
   * Parede mais próxima da cápsula (pés em O, raio, altura) a até raio + `reach`, com |n.y| da normal de contato até
   * `maxNormalY`. Escreve em `out`; false se não há.
   */
  probe(ox, oy, oz, radius, height, reach, maxNormalY, out) {
    const world = this.world;
    world.stats.overlaps++;
    const half = height * 0.5;
    const y0 = oy + Math.min(radius, half);
    const y1 = oy + Math.max(height - radius, half);
    out.hit = false;
    out.body = null;
    out.part = -1;
    out.triangle = -1;
    out.surface = 0;
    let best = radius + reach;
    this._maxNy = maxNormalY;
    for (let b = 0; b < world.bodies.length; b++) {
      const body = world.bodies[b];
      this.#setQuery(body, ox, y0, oz, ox, y1, oz);
      const l = best;
      this._minX = Math.min(this._s0x, this._s1x) - l;
      this._minY = Math.min(this._s0y, this._s1y) - l;
      this._minZ = Math.min(this._s0z, this._s1z) - l;
      this._maxX = Math.max(this._s0x, this._s1x) + l;
      this._maxY = Math.max(this._s0y, this._s1y) + l;
      this._maxZ = Math.max(this._s0z, this._s1z) + l;
      const lb = body.localBounds;
      if (lb.min.x > this._maxX || lb.max.x < this._minX || lb.min.y > this._maxY || lb.max.y < this._minY
        || lb.min.z > this._maxZ || lb.max.z < this._minZ) continue;
      this._limit = best;
      this._found = false;
      body.bvh.shapecast(this._cb);
      if (!this._found) continue;
      best = this._limit;
      this.#write(body, out);
      out.distance = best;
    }
    return out.hit;
  }

  /** Segmento da cápsula no espaço do corpo. */
  #setQuery(body, ax, ay, az, bx, by, bz) {
    this._tris = body.tris;
    if (!body.transformed) {
      this._m = null;
      this._s0x = ax; this._s0y = ay; this._s0z = az;
      this._s1x = bx; this._s1y = by; this._s1z = bz;
      return;
    }
    this._m = body.matrix.elements;
    const e = body.inverse.elements;
    this._s0x = e[0] * ax + e[4] * ay + e[8] * az + e[12];
    this._s0y = e[1] * ax + e[5] * ay + e[9] * az + e[13];
    this._s0z = e[2] * ax + e[6] * ay + e[10] * az + e[14];
    this._s1x = e[0] * bx + e[4] * by + e[8] * bz + e[12];
    this._s1y = e[1] * bx + e[5] * by + e[9] * bz + e[13];
    this._s1z = e[2] * bx + e[6] * by + e[10] * bz + e[14];
  }

  /** Contato achado no corpo → resultado em mundo. */
  #write(body, out) {
    const m = this._m;
    let nx = this._nx, ny = this._ny, nz = this._nz;
    let px = this._px, py = this._py, pz = this._pz;
    if (m) {
      const wx = m[0] * nx + m[4] * ny + m[8] * nz;
      const wy = m[1] * nx + m[5] * ny + m[9] * nz;
      const wz = m[2] * nx + m[6] * ny + m[10] * nz;
      nx = wx; ny = wy; nz = wz;
      const qx = m[0] * px + m[4] * py + m[8] * pz + m[12];
      const qy = m[1] * px + m[5] * py + m[9] * pz + m[13];
      const qz = m[2] * px + m[6] * py + m[10] * pz + m[14];
      px = qx; py = qy; pz = qz;
    }
    const h = Math.hypot(nx, nz);
    out.hit = true;
    out.nx = nx / h;
    out.nz = nz / h;
    out.ny = ny;
    out.px = px;
    out.py = py;
    out.pz = pz;
    out.body = body;
    out.triangle = this._tri;
    out.part = body.part[this._tri];
    out.surface = body.surface[this._tri];
  }

  #range(offset, count) {
    const T = this._tris;
    const m = this._m;
    const s0x = this._s0x, s0y = this._s0y, s0z = this._s0z;
    const s1x = this._s1x, s1y = this._s1y, s1z = this._s1z;
    this.world.stats.triangles += count;
    for (let i = offset, end = offset + count; i < end; i++) {
      const o = i * TRI_STRIDE;
      const lim = this._limit;
      // Rejeição pelo plano: as duas pontas do segmento do mesmo lado e além do alcance.
      const fx = T[o + 9], fy = T[o + 10], fz = T[o + 11];
      const e0 = (s0x - T[o]) * fx + (s0y - T[o + 1]) * fy + (s0z - T[o + 2]) * fz;
      const e1 = (s1x - T[o]) * fx + (s1y - T[o + 1]) * fy + (s1z - T[o + 2]) * fz;
      if ((e0 >= lim && e1 >= lim) || (e0 <= -lim && e1 <= -lim)) continue;
      const distSq = closestSegmentTriangle(s0x, s0y, s0z, s1x, s1y, s1z, T, o, _c);
      if (distSq >= lim * lim) continue;
      const dist = Math.sqrt(distSq);
      // Segmento encostado no triângulo (penetração): a normal é ambígua; o controlador desprende no próximo tick.
      if (dist < 1e-6) continue;
      const inv = 1 / dist;
      const nx = (_c.sx - _c.x) * inv, ny = (_c.sy - _c.y) * inv, nz = (_c.sz - _c.z) * inv;
      const wy = m ? m[1] * nx + m[5] * ny + m[9] * nz : ny;
      if (Math.abs(wy) > this._maxNy) continue;
      this._found = true;
      this._limit = dist;
      this._tri = i;
      this._nx = nx; this._ny = ny; this._nz = nz;
      this._px = _c.x; this._py = _c.y; this._pz = _c.z;
    }
    return false;
  }
}
