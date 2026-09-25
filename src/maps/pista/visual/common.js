// Ajudantes comuns dos visuais da pista: matrizes locais sobre a matriz da peça, malhas soltas fixas, atributos
// constantes e o tom de cada peça de papelão.

import * as THREE from 'three';

const _m = new THREE.Matrix4();

/** Matriz da peça × matriz local (a geometria montada no quadro canônico do visual). */
export function withLocal(pieceMatrix, local) {
  return pieceMatrix.clone().multiply(local);
}

/** Translação local. */
export function offset(x, y, z) {
  return new THREE.Matrix4().makeTranslation(x, y, z);
}

/** Giro local em Y (radianos) seguido de translação. */
export function turnY(angle, x = 0, y = 0, z = 0) {
  return _m.makeRotationY(angle).setPosition(x, y, z).clone();
}

/** Malha estática com a matriz dada (sem recalcular posição/rotação a cada quadro). */
export function placeMesh(mesh, matrix, { castShadow = true, receiveShadow = true, name = '' } = {}) {
  mesh.matrixAutoUpdate = false;
  mesh.matrix.copy(matrix);
  mesh.castShadow = castShadow;
  mesh.receiveShadow = receiveShadow;
  if (name) mesh.name = name;
  return mesh;
}

/** Atributo constante em todos os vértices (em lotes, o valor da peça inteira). */
export function constantAttribute(geo, name, values) {
  const n = geo.attributes.position.count;
  const arr = new Float32Array(n * values.length);
  for (let i = 0; i < n; i++) arr.set(values, i * values.length);
  geo.setAttribute(name, new THREE.BufferAttribute(arr, values.length));
  return geo;
}

/**
 * Faces de fora da plaquinha em "A" [w, h, d] (cumeeira em z = 0, base de −d/2 a d/2), no quadro da peça: para cada
 * lado, a matriz do centro da face (X para a direita de quem olha a face, Y subindo até a cumeeira, Z para fora), o
 * comprimento da rampa e o lado (−1 frente, +1 trás).
 */
export function tentFaces([w, h, d]) {
  const half = d / 2;
  const slope = Math.hypot(half, h);
  return [-1, 1].map((side) => {
    const up = new THREE.Vector3(0, h, -side * half).normalize();
    const out = new THREE.Vector3(0, half, side * h).normalize();
    const right = new THREE.Vector3().crossVectors(up, out);
    const center = new THREE.Vector3(0, h / 2, (side * half) / 2);
    const matrix = new THREE.Matrix4().makeBasis(right, up, out).setPosition(center);
    return { matrix, width: w, slope, side, out };
  });
}

/** Tom de uma peça de papelão (cinza levemente quente ou frio, entre os limites do dado). */
export function cardboardTone(rng, [lo, hi]) {
  const v = rng.float(lo, hi);
  const w = rng.float(-0.025, 0.025);
  return [v + w, v, v - w * 1.2];
}
