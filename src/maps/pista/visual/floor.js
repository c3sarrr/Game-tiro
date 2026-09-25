// Chão da pista de testes (item 11 do moodboard: PKG3/PKG6 compensado da base, DFL1/DFL5/LDB15 lotes e fitas, LDB9
// quadriculado, TMA12 kraft): o compensado da base com as chapas, o chão do estúdio, os tapetes de corte dos lotes, os
// papéis (quadriculado da estação 1 no lote das medidas, kraft da bhop e das pegadas) e todas as fitas crepe num lote
// só — contornos dos lotes, folhas presas, emendas da cerca, largada e chegada, pés das paredes soltas — com as
// etiquetas escritas à mão (atlas de etiquetas do mapa, lido pela fita por atributo).

import * as THREE from 'three';
import { RNG } from '../../../core/rng.js';
import { createNoise3 } from '../../../clay/kit/cpuNoise.js';
import { tapeStrip } from '../../../clay/set/propGeometry.js';
import { bakeLabelAtlas } from '../../../clay/set/labelAtlas.js';
import { tapeMaterial } from '../../../clay/set/paperMaterials.js';
import { basisMatrix } from '../pieces.js';
import { constantAttribute, placeMesh } from './common.js';

/**
 * Folha deitada no quadro da peça (caixa [w, h, d] centrada): topo em grade com ondulação para baixo (nunca acima do
 * topo da colisão) e a saia da borda até o fundo. uv em u a partir do canto sudoeste (x a leste, y a norte).
 */
function sheetGeometry(w, h, d, { seed, wave = 0.12, step = 40 }) {
  const noise = createNoise3(new RNG(`folha:${seed}`).nextU32());
  const nx = Math.max(2, Math.ceil(w / step));
  const nz = Math.max(2, Math.ceil(d / step));
  const top = h / 2;
  const y = (x, z) => top - wave * (0.5 + 0.5 * noise.noise(x * 0.004, z * 0.004, 3.3)) - wave * 0.4 * Math.max(0, noise.noise(x * 0.02, z * 0.02, 9.1));
  const pos = [];
  const uv = [];
  const index = [];
  for (let j = 0; j <= nz; j++) {
    for (let i = 0; i <= nx; i++) {
      const x = -w / 2 + (w * i) / nx;
      const z = -d / 2 + (d * j) / nz;
      pos.push(x, y(x, z), z);
      uv.push(x + w / 2, d / 2 - z);
    }
  }
  for (let j = 0; j < nz; j++) {
    for (let i = 0; i < nx; i++) {
      const a = j * (nx + 1) + i;
      // Normal +Y: (a, a + nx + 1, a + 1) gira de +X para +Z visto de cima.
      index.push(a, a + nx + 1, a + 1, a + 1, a + nx + 1, a + nx + 2);
    }
  }
  // Saia: da borda do topo até o fundo, com a normal para fora.
  const ring = [];
  for (let i = 0; i <= nx; i++) ring.push([-w / 2 + (w * i) / nx, -d / 2]);
  for (let j = 1; j <= nz; j++) ring.push([w / 2, -d / 2 + (d * j) / nz]);
  for (let i = nx - 1; i >= 0; i--) ring.push([-w / 2 + (w * i) / nx, d / 2]);
  for (let j = nz - 1; j >= 1; j--) ring.push([-w / 2, -d / 2 + (d * j) / nz]);
  const base = pos.length / 3;
  for (const [x, z] of ring) {
    pos.push(x, y(x, z), z, x, -h / 2, z);
    uv.push(x + w / 2, d / 2 - z, x + w / 2, d / 2 - z);
  }
  for (let k = 0; k < ring.length; k++) {
    const a = base + k * 2;
    const b = base + ((k + 1) % ring.length) * 2;
    // Contorno anti-horário visto de cima (−Z → +X → +Z): a direita do trecho é o lado de fora.
    index.push(a, b, a + 1, b, b + 1, a + 1);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(index);
  geo.computeVertexNormals();
  return geo;
}

/** Tapete de corte (caixa [w, 3, d]) com uv 0..1 no topo a partir do canto sudoeste; nas laterais, a margem lisa. */
function matGeometry(w, h, d) {
  const geo = new THREE.BoxGeometry(w, h, d);
  const p = geo.attributes.position;
  const n = geo.attributes.normal;
  const uv = geo.attributes.uv;
  for (let i = 0; i < p.count; i++) {
    if (n.getY(i) > 0.5) uv.setXY(i, (p.getX(i) + w / 2) / w, (d / 2 - p.getZ(i)) / d);
    else uv.setXY(i, 0.002, 0.002);
  }
  return geo;
}

/** Fita com os atributos da fita da pista (etiqueta: célula do texto; sem etiqueta, zeros). */
function tapeGeometry(length, width, { seed, lift = 0, rect = null, margin = 0, textHeight = 0 }) {
  const step = Math.max(4, Math.min(40, length / 30));
  const geo = tapeStrip(length, width, { seed, lift, step });
  constantAttribute(geo, 'aTapeLabel', rect ?? [0, 0, 0, 0]);
  constantAttribute(geo, 'aTapeBox', [length, width, margin, textHeight]);
  return geo;
}

/**
 * Fita dobrada no pé de uma parede solta: `fold` u sobem pela face (x = 0 é a face, +X para fora, +Y para cima, Z ao
 * longo da parede) e o resto deita no chão, com a dobra arredondada.
 */
function footTapeGeometry(length, width, fold, seed) {
  const geo = tapeGeometry(length, width, { seed });
  const p = geo.attributes.position;
  const r = 1.4;
  const vertical = fold - r;
  const arc = (Math.PI / 2) * r;
  for (let i = 0; i < p.count; i++) {
    const s = p.getX(i) + length / 2;
    const q = -p.getY(i); // através invertido: a face da tira fica para fora
    const off = 0.12 + Math.max(p.getZ(i), 0);
    let x;
    let y;
    if (s <= vertical) {
      x = off;
      y = fold - s;
    } else if (s <= vertical + arc) {
      const a = Math.PI + ((s - vertical) / arc) * (Math.PI / 2);
      x = r + Math.cos(a) * (r - off);
      y = r + Math.sin(a) * (r - off);
    } else {
      x = r + (s - vertical - arc);
      y = off;
    }
    p.setXYZ(i, x, y, q);
  }
  geo.computeVertexNormals();
  return geo;
}

export function buildFloor(ctx) {
  const { layout, data, set, batches, group, disposers, anisotropy } = ctx;
  const look = data.look;
  const byId = new Map(layout.pieces.map((p) => [p.id, p]));

  // Compensado da base: chapas, emendas, parafusos e riscos (plywoodMaterial com `sheets`).
  const base = byId.get('base');
  const [bw, bh, bd] = base.size;
  const baseMat = set.plywood({ sheets: [...base.look.sheet], origin: [...base.look.origin], name: 'compensado-base' });
  group.add(placeMesh(new THREE.Mesh(new THREE.BoxGeometry(bw, bh, bd), baseMat), base.matrix, { castShadow: false, name: 'base-compensado' }));
  const floor = byId.get('chao-estudio');
  const [fw, fh, fd] = floor.size;
  group.add(placeMesh(new THREE.Mesh(new THREE.BoxGeometry(fw, fh, fd), set.floorPaint({ color: floor.look.color })), floor.matrix, {
    castShadow: false, name: 'chao-estudio',
  }));

  // Tapetes de corte dos lotes (cada um com o tamanho dele na grade impressa).
  for (const p of layout.pieces) {
    if (p.look.kind !== 'mat') continue;
    const [w, h, d] = p.size;
    const mat = set.cuttingMat({ size: [w, d], name: `tapete-${p.station}` });
    group.add(placeMesh(new THREE.Mesh(matGeometry(w, h, d), mat), p.matrix, { castShadow: false, name: p.id }));
  }

  // Papéis: quadriculado (lote das medidas, modo 4) e kraft (lote dos papéis).
  for (const p of layout.pieces) {
    const [w, h, d] = p.size;
    if (p.look.kind === 'gridPaper') {
      const geo = constantAttribute(sheetGeometry(w, h, d, { seed: p.id, wave: 0.08 }), 'aMeasure', [4, w, d, h]);
      batches.add('measure', geo, p.matrix, p.look.color);
    } else if (p.look.kind === 'paper') {
      batches.add('paper', sheetGeometry(w, h, d, { seed: p.id, wave: 0.12 }), p.matrix, p.look.color);
    }
  }

  // Etiquetas: um atlas com todos os textos; cada etiqueta é uma tira do comprimento do texto.
  const T = look.tape;
  const labels = layout.decor.filter((d) => d.kind === 'label');
  const atlas = bakeLabelAtlas(labels.map((d) => d.text), {
    width: T.atlas.width, cellHeight: T.atlas.cellHeight, columns: T.atlas.columns, font: T.font, seed: 'pista-etiquetas', anisotropy,
  });
  disposers.push(() => atlas.dispose());
  const tapeMat = set.adopt('pista-fitas', tapeMaterial(set.textures, { color: '#FFFFFF', atlas: atlas.texture, ink: T.ink, name: 'fitas-pista' }));
  batches.define('tape', { material: tapeMat, castShadow: false, receiveShadow: true });
  const rng = new RNG(`${data.seed}:fitas`);
  labels.forEach((d, i) => {
    const info = atlas.labels[i];
    const length = T.margin * 2 + T.textHeight * info.aspect;
    const geo = tapeGeometry(length, T.labelWidth, { seed: d.id, lift: rng.bool(0.2) ? 1.1 : 0, rect: info.rect, margin: T.margin, textHeight: T.textHeight });
    batches.add('tape', geo, d.matrix, T.color);
  });
  for (const d of layout.decor) {
    if (d.kind !== 'tape') continue;
    const geo = tapeGeometry(d.length, d.width, { seed: d.seed ?? d.id, lift: rng.bool(0.25) ? rng.float(0.6, 1.6) : 0 });
    batches.add('tape', geo, d.matrix, d.color ?? T.color);
  }
  // Pés das paredes soltas (papelão de uma face e de parede dupla): fita dobrada da face para o chão, dos dois lados.
  const F = T.feet;
  for (const p of layout.pieces) {
    if (p.look.kind !== 'panel' || p.look.wall === 'regular') continue;
    const [len, h, t] = p.size;
    const count = Math.max(1, Math.round(len / F.every));
    for (const side of [1, -1]) {
      for (let k = 0; k < count; k++) {
        const a = -len / 2 + (len * (k + 0.5)) / count + rng.float(-0.12, 0.12) * (len / count);
        const local = basisMatrix([a, -h / 2, (side * t) / 2], [0, 0, side], [0, 1, 0]);
        const geo = footTapeGeometry(F.length * rng.float(0.85, 1.15), T.labelWidth, F.fold, `${p.id}:pe:${side}:${k}`);
        batches.add('tape', geo, p.matrix.clone().multiply(local), T.color);
      }
    }
  }
}
