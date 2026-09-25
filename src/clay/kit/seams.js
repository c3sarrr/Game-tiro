// Costuras entre massas (moodboard PLA17, PLA13, CSD7): onde uma peça encosta na outra a massa foi apertada —
// fica um vinco no meio da faixa e um lábio logo ao lado, e a troca de cor é limpa. Marca o atributo aSeam
// (o ClayMaterial escurece/satura o sulco e deixa mais áspero) e esculpe o vinco na geometria.

import * as THREE from 'three';

const _p = new THREE.Vector3();
const _inv = new THREE.Matrix4();
const _toB = new THREE.Matrix4();

/**
 * Marca e esculpe a costura da peça A onde ela encosta na peça B.
 * @param {{geometry:THREE.BufferGeometry, matrix:THREE.Matrix4, distance:(p:THREE.Vector3)=>number}} a
 * @param {{geometry:THREE.BufferGeometry, matrix:THREE.Matrix4, distance:(p:THREE.Vector3)=>number}} b
 * @returns {number} vértices afetados
 */
export function markSeam(a, b, { width = 3, groove = 0.9, lip = 0.35 } = {}) {
  const pos = a.geometry.attributes.position;
  const nrm = a.geometry.attributes.normal;
  const seam = a.geometry.attributes.aSeam;
  if (!seam) throw new Error('geometria sem aSeam: use finalizeClayGeometry()');
  _inv.copy(b.matrix).invert();
  _toB.multiplyMatrices(_inv, a.matrix);
  const scaleB = b.matrix.getMaxScaleOnAxis();
  const scaleA = a.matrix.getMaxScaleOnAxis();
  const w2 = width * width;
  let touched = 0;
  for (let i = 0; i < pos.count; i++) {
    _p.fromBufferAttribute(pos, i).applyMatrix4(_toB);
    const d = b.distance(_p) * scaleB;
    if (d > width || d < -width) continue;
    const s = 1 - Math.abs(d) / width;
    if (s <= 0) continue;
    if (s > seam.getX(i)) seam.setX(i, s);
    const g = -groove * Math.exp(-(d * d) / (w2 * 0.18));
    const l = lip * Math.exp(-((d - width * 0.55) ** 2) / (w2 * 0.08));
    const disp = (g + l) / scaleA;
    pos.setXYZ(i, pos.getX(i) + nrm.getX(i) * disp, pos.getY(i) + nrm.getY(i) * disp, pos.getZ(i) + nrm.getZ(i) * disp);
    touched++;
  }
  if (touched) {
    pos.needsUpdate = true;
    seam.needsUpdate = true;
    a.geometry.computeVertexNormals();
  }
  return touched;
}
