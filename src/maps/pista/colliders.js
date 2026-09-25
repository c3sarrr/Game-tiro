// Formas de colisão da pista de testes a partir das peças do layout (pieces.js): caixas, cunhas, cilindros e as
// plaquinhas em "A" (duas cunhas de costas). O relevo visual (empeno do papelão, cantos arredondados da faia, lombada
// do livro, calombos da massinha) não entra: colisão lisa com as medidas exatas das estações. Cada peça é uma peça do
// ColliderBuilder (uma parede para o wall-jump); a `part` da peça junta várias numa só. Puro.

import * as THREE from 'three';
import { ColliderBuilder } from '../../physics/colliders.js';

const _m = new THREE.Matrix4();
const _local = new THREE.Matrix4();

/** Plaquinha dobrada em "A": duas rampas de costas (uma peça só), subindo das bordas da base até a cumeeira em z = 0. */
function tent(b, [w, h, d], matrix, surface, part) {
  const half = d / 2;
  // Metade da frente: sobe de z = −d/2 (y = 0) até z = 0 (y = h).
  b.ramp(w, half, h, { matrix: _m.multiplyMatrices(matrix, _local.makeTranslation(0, 0, -half)), surface, part });
  // Metade de trás: a mesma rampa girada 180° em Y, subindo de z = +d/2.
  _local.makeRotationY(Math.PI).setPosition(0, 0, half);
  b.ramp(w, half, h, { matrix: _m.multiplyMatrices(matrix, _local), surface, part });
}

/** ColliderBuilder com todas as peças que colidem. */
export function buildPistaColliders(layout) {
  const b = new ColliderBuilder();
  for (const p of layout.pieces) {
    if (!p.collide) continue;
    const [a, c, d] = p.size;
    const { matrix, surface, part } = p;
    if (p.shape === 'box') b.box(a, c, d, { matrix, surface, part });
    else if (p.shape === 'ramp') b.ramp(a, d, c, { matrix, surface, part });
    else if (p.shape === 'cylinder') b.cylinder(a, c, { segments: 32, matrix, surface, part });
    else if (p.shape === 'tent') tent(b, p.size, matrix, surface, part ?? p.id);
    else throw new Error(`forma de colisão desconhecida na pista: ${p.shape} (${p.id})`);
  }
  return b;
}
