// Boneco de referência de massinha com a altura do jogador (72 u = a medida do mundo): corpo em cápsula, cabeça,
// olhos de massinha com pupila. Usado na sala de testes e na vitrine para conferir a escala de tudo em volta
// (PLA2/PLA14: a mesa e os objetos do dia a dia provam o tamanho do boneco).

import { PALETTE } from '../../data/palette.js';
import { ClayMaterial } from '../ClayMaterial.js';
import { ClayAssembly } from './assembly.js';
import { clayBall, clayCapsule } from './shapes.js';

/**
 * @param {number} height altura total (u)
 * @param {{color?:string, seed?:string}} [opts]
 * @returns {import('three').Group}
 */
export function scaleMarker(height, { color = PALETTE.terracotta, seed = 'marcador' } = {}) {
  const body = new ClayMaterial({ color, touched: true, wetness: 0.3, seed: `${seed}-corpo` });
  const white = new ClayMaterial({ color: PALETTE.clayWhite, touched: true, wetness: 0.45, seed: `${seed}-olho` });
  const black = new ClayMaterial({ color: '#1E1A18', touched: true, wetness: 0.6, roughness: 0.55, seed: `${seed}-pupila` });
  const headR = height * 0.14;
  const bodyR = height * 0.21;
  const bodyTop = height - headR * 1.6;
  const bodyLen = Math.max(4, bodyTop - bodyR * 2);
  const headY = height - headR;
  const eyeR = headR * 0.26;
  const eyeZ = headR * 0.84;
  const asm = new ClayAssembly(`${seed}-escala-${height}u`);
  asm.add(clayCapsule({ radius: bodyR, length: bodyLen, seed: 11 }), { material: body, position: [0, bodyR + bodyLen / 2, 0] });
  asm.add(clayBall({ radius: headR, squash: [1, 0.94, 1], seed: 12 }), { material: body, position: [0, headY, 0] });
  for (const side of [-1, 1]) {
    asm.add(clayBall({ radius: eyeR, segments: 8, lumpiness: 0.03, dents: 1, seed: 13 + side }), {
      material: white, position: [side * headR * 0.36, headY + headR * 0.08, eyeZ],
    });
    asm.add(clayBall({ radius: eyeR * 0.45, segments: 6, lumpiness: 0.02, dents: 0, seed: 15 + side }), {
      material: black, position: [side * headR * 0.34, headY + headR * 0.1, eyeZ + eyeR * 0.72], seams: false,
    });
  }
  return asm.build();
}
