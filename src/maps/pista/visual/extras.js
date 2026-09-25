// Objetos de mesa da pista de testes (item 11 do moodboard: TMA2/TMA6/TMA12 trena, PRU1/PRU3/PRU15 traves do slide,
// BWM10 alfinetes, CFO19 palitos, COC2/CBT14 pisca-pisca): a trena esticada na faixa de bhop (lâmina, gancho e estojo),
// as traves do slide e a verga do gabarito (régua de madeira, lápis, régua de aço, espeto de bambu), os alfinetes das
// vigas, o palito da bandeirinha e o pisca-pisca do túnel. Cada parte no lote do seu material.

import * as THREE from 'three';
import { RNG } from '../../../core/rng.js';
import { wireGeometry } from '../../../clay/set/propGeometry.js';
import {
  flagGeometry, pencilGeometry, pinGeometry, rulerGeometry, skewerGeometry, steelRulerGeometry, tapeBladeGeometry, tapeCaseGeometry,
} from '../../../clay/set/stationeryGeometry.js';
import { constantAttribute, placeMesh, turnY } from './common.js';

/** Peça comprida ao longo de Z no quadro dela: a geometria (ao longo de X) gira −90° em Y (X → +Z). */
const ALONG_Z = new THREE.Matrix4().makeRotationY(-Math.PI / 2);

/** Pisca-pisca: fio verde com barriga entre os pontos presos e uma lampadinha no meio de cada vão. */
function fairyLights(batches, d, F) {
  const pts = [];
  for (let i = 0; i < d.anchors.length; i++) {
    const a = new THREE.Vector3(...d.anchors[i]);
    pts.push(a);
    if (i + 1 < d.anchors.length) {
      const b = new THREE.Vector3(...d.anchors[i + 1]);
      pts.push(a.clone().lerp(b, 0.5).add(new THREE.Vector3(0, -d.sag, 0)));
    }
  }
  const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
  const wire = constantAttribute(wireGeometry(curve, 0.55, { radialSegments: 6 }), 'aPaint', [3]);
  batches.add('paint', wire, d.matrix, F.wire);
  const bulb = new THREE.SphereGeometry(F.bulbRadius, 12, 10).scale(1, 1.4, 1);
  const socket = constantAttribute(new THREE.CylinderGeometry(1.5, 1.8, 3.2, 10), 'aPaint', [3]);
  for (let i = 0; i + 1 < d.anchors.length; i++) {
    const mid = pts[i * 2 + 1];
    const m = new THREE.Matrix4().makeTranslation(mid.x, mid.y - 2.2, mid.z);
    batches.add('paint', socket, d.matrix.clone().multiply(m), F.wire);
    batches.add('bulbs', bulb, d.matrix.clone().multiply(m).multiply(new THREE.Matrix4().makeTranslation(0, -F.bulbRadius * 1.4 - 1.2, 0)));
  }
}

export function buildExtras(ctx) {
  const { layout, data, set, batches, group } = ctx;
  const look = data.look;
  let count = 0;
  for (const p of layout.pieces) {
    const k = p.look.kind;
    const along = p.size[2] > p.size[0];
    const frame = along ? p.matrix.clone().multiply(ALONG_Z) : p.matrix;
    if (['regua', 'aco', 'lapis', 'espeto', 'trenaCase'].includes(k)) count++;
    if (k === 'regua') {
      const [a, t, b] = p.size;
      const [len, width] = along ? [b, a] : [a, b];
      // Verga do gabarito: o bisel e a escala viram para o norte (quem chega da praça vê a escala).
      const m = along ? frame : p.matrix.clone().multiply(turnY(Math.PI));
      batches.add('measure', rulerGeometry(len, t, width), m, look.ruler);
    } else if (k === 'aco') {
      batches.add('measure', steelRulerGeometry(p.size[2], p.size[1], p.size[0]), frame, look.steel);
    } else if (k === 'lapis') {
      const pen = pencilGeometry({ length: p.size[2], across: p.size[0], seed: p.id });
      batches.add('paint', pen.paint, frame, look.pencil.body);
      batches.add('paint', pen.eraser, frame, look.pencil.eraser);
      batches.add('balsa', pen.wood, frame, look.pencil.wood);
      batches.add('chrome', pen.metal, frame, look.pencil.ferrule);
    } else if (k === 'espeto') {
      batches.add('balsa', skewerGeometry(p.size[2], p.size[0] / 2, { seed: p.id }), frame, look.bamboo);
    } else if (k === 'trenaCase') {
      const parts = tapeCaseGeometry(p.size);
      const shell = set.plastic({ color: p.look.color, moldY: 0, name: 'estojo-trena' });
      group.add(placeMesh(new THREE.Mesh(parts.shell, shell), p.matrix, { name: 'estojo-trena' }));
      batches.add('paint', parts.rubber, p.matrix, look.trenaCase.rubber);
      batches.add('chrome', parts.metal, p.matrix, look.trenaCase.metal);
    }
  }
  for (const d of layout.decor) {
    if (['trena', 'pin', 'flag', 'fairyLights'].includes(d.kind)) count++;
    if (d.kind === 'trena') {
      const { blade, hook } = tapeBladeGeometry(d.length, d.width);
      batches.add('measure', blade, d.matrix, d.color);
      batches.add('chrome', hook, d.matrix, look.trenaCase.metal);
    } else if (d.kind === 'pin') {
      const r = new RNG(`alfinete:${d.seed}`);
      const { shaft, head } = pinGeometry();
      // Espetado à mão: cada um inclinado para um lado.
      const tilt = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(r.float(-0.25, 0.25), r.float(0, Math.PI * 2), r.float(-0.25, 0.25), 'YXZ'));
      const m = d.matrix.clone().multiply(tilt);
      batches.add('chrome', shaft, m, look.pinShaft);
      batches.add('paint', head, m, d.color);
    } else if (d.kind === 'flag') {
      batches.add('balsa', flagGeometry({ stick: d.stick, seed: d.seed }).stick, d.matrix, look.toothpick);
    } else if (d.kind === 'fairyLights') {
      fairyLights(batches, d, look.fairy);
    }
  }
  return { extras: count };
}
