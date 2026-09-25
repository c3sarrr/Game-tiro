// Madeira da pista de testes (item 11 do moodboard: AWB1/AWB4/AWB12/AWB17 blocos de faia, PKG3/PKG6/PKG11 compensado,
// BWM1/BWM10/BWM14 balsa, WRG1/WRG4/WRG11 tábua de crescimento): blocos de faia de cantos arredondados (pilares,
// caixas, pilhas, colunas do gabarito, apoios), placas de compensado (poço, pranchas da torre, prancha de saída), ripas
// de balsa (vigas e a ripa inclinada) e a tábua de crescimento da torre (escala pintada no lote das medidas).

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { balsaStick } from '../../../clay/set/propGeometry.js';
import { constantAttribute } from './common.js';

/** Tábua de crescimento [w, h, t] com a escala na face da frente (+Z): uv = (altura a partir do pé, a partir da esquerda). */
function growthGeometry([w, h, t]) {
  const geo = new THREE.BoxGeometry(w, h, t);
  const p = geo.attributes.position;
  const n = geo.attributes.normal;
  const uv = geo.attributes.uv;
  for (let i = 0; i < p.count; i++) {
    if (n.getZ(i) > 0.5) uv.setXY(i, p.getY(i) + h / 2, p.getX(i) + w / 2);
    else uv.setXY(i, 0, 0);
  }
  return constantAttribute(geo, 'aMeasure', [3, h, w, t]);
}

export function buildWood(ctx) {
  const { layout, data, batches } = ctx;
  const blocks = new Map();
  let beech = 0;
  for (const p of layout.pieces) {
    const k = p.look.kind;
    if (k === 'beech') {
      const [w, h, d] = p.size;
      const r = p.look.radius ?? 3;
      const key = `${w.toFixed(2)}:${h.toFixed(2)}:${d.toFixed(2)}:${r}`;
      if (!blocks.has(key)) blocks.set(key, new RoundedBoxGeometry(w, h, d, 2, Math.min(r, h / 2 - 0.01, w / 2 - 0.01, d / 2 - 0.01)));
      batches.add('beech', blocks.get(key), p.matrix, p.look.tint ?? [1, 1, 1]);
      beech++;
    } else if (k === 'plywood') {
      batches.add('plywood', new THREE.BoxGeometry(...p.size), p.matrix);
    } else if (k === 'balsa') {
      const [len, thick, width] = p.size;
      // As vigas compridas cedem um pouco no meio (apoiadas só nas pontas); a ripa inclinada fica reta.
      const bow = len > 400 ? -0.45 : 0;
      batches.add('balsa', balsaStick(len, width, thick, { seed: p.look.seed ?? p.id, bow }), p.matrix);
    } else if (k === 'growth') {
      batches.add('measure', growthGeometry(p.size), p.matrix, data.look.growth);
    }
  }
  return { beech };
}
