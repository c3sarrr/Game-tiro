// Corpo de colisão: os triângulos de um ColliderBuilder com um BVH (three-mesh-bvh, divisão SAH) e uma matriz rígida
// opcional (props que se mexem, paredes que surgem). Depois do build, os triângulos são copiados na ordem final do
// BVH para arrays planos em precisão dupla: a fase estreita lê deles direto, sem objetos por triângulo.

import * as THREE from 'three';
import { MeshBVH, SAH } from 'three-mesh-bvh';
import { TRI_STRIDE } from './geometryQueries.js';

const IDENTITY = new THREE.Matrix4();
let nextId = 1;

export class CollisionBody {
  /**
   * @param {{positions: Float64Array, surfaces: Uint8Array}} data triângulos no espaço do corpo (ColliderBuilder.build())
   * @param {{name?: string, matrix?: THREE.Matrix4}} [opts] `matrix`: corpo → mundo, rígida (escala vem assada)
   */
  constructor(data, { name = 'corpo', matrix = null } = {}) {
    const count = data.surfaces.length;
    if (!count) throw new Error(`corpo de colisão vazio: ${name}`);
    this.id = nextId++;
    this.name = name;
    this.triangleCount = count;
    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute('position', new THREE.BufferAttribute(Float32Array.from(data.positions), 3));
    this.bvh = new MeshBVH(this.geometry, { strategy: SAH, targetLeafSize: 4 });
    // Entrada não indexada: o BVH criou o índice 0..n−1 e reordenou os triângulos em blocos de 3, então o
    // triângulo i do BVH é o triângulo index[3i] / 3 do builder.
    const index = this.geometry.index.array;
    const P = data.positions;
    this.tris = new Float64Array(count * TRI_STRIDE);
    this.surface = new Uint8Array(count);
    for (let i = 0; i < count; i++) {
      const src = index[i * 3] / 3;
      const s = src * 9;
      const o = i * TRI_STRIDE;
      for (let k = 0; k < 9; k++) this.tris[o + k] = P[s + k];
      const abx = P[s + 3] - P[s], aby = P[s + 4] - P[s + 1], abz = P[s + 5] - P[s + 2];
      const acx = P[s + 6] - P[s], acy = P[s + 7] - P[s + 1], acz = P[s + 8] - P[s + 2];
      const nx = aby * acz - abz * acy;
      const ny = abz * acx - abx * acz;
      const nz = abx * acy - aby * acx;
      const len = Math.hypot(nx, ny, nz);
      this.tris[o + 9] = nx / len;
      this.tris[o + 10] = ny / len;
      this.tris[o + 11] = nz / len;
      this.surface[i] = data.surfaces[src];
    }
    this.geometry.computeBoundingBox();
    this.localBounds = this.geometry.boundingBox.clone();
    this.matrix = new THREE.Matrix4();
    this.inverse = new THREE.Matrix4();
    this.transformed = false;
    if (matrix) this.setMatrix(matrix);
  }

  /** Posição/rotação do corpo no mundo (rígida). */
  setMatrix(matrix) {
    this.matrix.copy(matrix);
    this.inverse.copy(matrix).invert();
    this.transformed = !matrix.equals(IDENTITY);
    return this;
  }

  dispose() {
    this.geometry.dispose();
    this.bvh = null;
    this.tris = null;
  }
}
