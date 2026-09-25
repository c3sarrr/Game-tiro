// Montagem de objetos de massinha a partir do kit: posiciona peças, costura as que se encostam e funde
// as geometrias por material (uma draw call por cor de massa). Para objetos estáticos e props;
// bonecos animados (Fase 5) mantêm peças separadas por osso.

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { markSeam } from './seams.js';

const _c1 = new THREE.Vector3();
const _c2 = new THREE.Vector3();

export class ClayAssembly {
  constructor(name = 'massinha') {
    this.name = name;
    this.pieces = [];
  }

  /**
   * @param {{geometry, radius, distance}} shape resultado de uma primitiva do kit (a geometria é copiada)
   * @param {{material:THREE.Material, position?:number[], rotation?:number[], scale?:number|number[], seams?:boolean, name?:string}} opts
   */
  add(shape, { material, position = [0, 0, 0], rotation = [0, 0, 0], scale = 1, seams = true, name = '' }) {
    if (!material) throw new Error('peça sem material');
    const s = Array.isArray(scale) ? scale : [scale, scale, scale];
    const matrix = new THREE.Matrix4().compose(
      new THREE.Vector3(...position),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(...rotation)),
      new THREE.Vector3(...s),
    );
    this.pieces.push({
      geometry: shape.geometry.clone(),
      distance: shape.distance,
      radius: shape.radius * Math.max(...s),
      matrix,
      material,
      seams,
      name,
    });
    return this;
  }

  /** Costura, funde e devolve um THREE.Group pronto para a cena. */
  build({ merge = true, castShadow = true, receiveShadow = true, seamWidth = 3 } = {}) {
    const n = this.pieces.length;
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const a = this.pieces[i];
        const b = this.pieces[j];
        if (!a.seams || !b.seams) continue;
        _c1.setFromMatrixPosition(a.matrix);
        _c2.setFromMatrixPosition(b.matrix);
        if (_c1.distanceTo(_c2) > a.radius + b.radius + seamWidth) continue;
        const width = seamWidth * (a.material === b.material ? 0.6 : 1);
        markSeam(a, b, { width, groove: a.material === b.material ? 0.5 : 0.9 });
        markSeam(b, a, { width, groove: a.material === b.material ? 0.5 : 0.9 });
      }
    }
    const group = new THREE.Group();
    group.name = this.name;
    const byMaterial = new Map();
    for (const p of this.pieces) {
      const g = p.geometry.applyMatrix4(p.matrix);
      if (!byMaterial.has(p.material)) byMaterial.set(p.material, []);
      byMaterial.get(p.material).push(g);
    }
    for (const [material, list] of byMaterial) {
      let geometry;
      if (merge && list.length > 1) {
        geometry = mergeGeometries(list, false);
        if (!geometry) throw new Error(`não foi possível fundir as peças de ${this.name}`);
        for (const g of list) g.dispose();
      } else {
        geometry = list[0];
        for (let k = 1; k < list.length; k++) {
          const extra = new THREE.Mesh(list[k], material);
          extra.castShadow = castShadow;
          extra.receiveShadow = receiveShadow;
          group.add(extra);
        }
      }
      geometry.computeBoundingSphere();
      const mesh = new THREE.Mesh(geometry, material);
      mesh.castShadow = castShadow;
      mesh.receiveShadow = receiveShadow;
      group.add(mesh);
    }
    const box = new THREE.Box3().setFromObject(group);
    const radius = box.getBoundingSphere(new THREE.Sphere()).radius;
    for (const material of byMaterial.keys()) material.setObjectSize?.(radius);
    this.pieces = [];
    return group;
  }
}
