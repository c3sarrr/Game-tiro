// Massinha da pista de testes (item 11 do moodboard: CFP1/CFP7/CFP10 placas abertas no rolo, CIM1/CIM5/CIM8 letras
// carimbadas e borda de furinhos): as sete placas das pegadas, cada uma com a letra carimbada, a borda de furinhos e as
// marcas do rolo numa textura de impressão própria (o ClayMaterial desloca a normal por ela; a 3.5 põe as pegadas pelo
// mesmo caminho), e as bolotas que seguram as pontas das traves do slide e o palito da bandeirinha, numa malha só com
// a cor por vértice.

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RNG } from '../../../core/rng.js';
import { createNoise3 } from '../../../clay/kit/cpuNoise.js';
import { clayBall, claySlab } from '../../../clay/kit/shapes.js';
import { ClayMaterial } from '../../../clay/ClayMaterial.js';
import { placeMesh } from './common.js';

const STAMP_FONT = '900 {px}px "Arial Black", "Impact", "Helvetica Neue", sans-serif';

/** Desfoque em caixa separável (raio em px) de um campo de floats w × h, `passes` vezes (≈ gaussiano). */
function boxBlur(src, w, h, radius, passes = 2) {
  let a = src;
  let b = new Float32Array(src.length);
  const r = Math.max(1, Math.round(radius));
  const norm = 1 / (2 * r + 1);
  for (let pass = 0; pass < passes; pass++) {
    for (let y = 0; y < h; y++) {
      let acc = 0;
      for (let k = -r; k <= r; k++) acc += a[y * w + Math.min(w - 1, Math.max(0, k))];
      for (let x = 0; x < w; x++) {
        b[y * w + x] = acc * norm;
        acc += a[y * w + Math.min(w - 1, x + r + 1)] - a[y * w + Math.max(0, x - r)];
      }
    }
    [a, b] = [b, a];
    for (let x = 0; x < w; x++) {
      let acc = 0;
      for (let k = -r; k <= r; k++) acc += a[Math.min(h - 1, Math.max(0, k)) * w + x];
      for (let y = 0; y < h; y++) {
        b[y * w + x] = acc * norm;
        acc += a[Math.min(h - 1, y + r + 1) * w + x] - a[Math.max(0, y - r) * w + x];
      }
    }
    [a, b] = [b, a];
  }
  return a;
}

/**
 * Textura de impressão de uma placa [w × d u]: R = fundo (letra carimbada e furinhos, paredes suaves), G = lábio de
 * massa empurrada em volta, B = marcas do rolo. Desenhada de pé (a letra lida de cima para baixo do canvas) e
 * guardada com as linhas invertidas (v = 0 embaixo, a base da letra).
 */
function imprintTexture(letter, [w, d], seed, { density = 2.9, border = 9, dot = 1.7, pitch = 9 } = {}) {
  const W = Math.round(w * density);
  const H = Math.round(d * density);
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const g = canvas.getContext('2d');
  const rng = new RNG(`carimbo:${seed}`);
  g.fillStyle = '#000';
  g.fillRect(0, 0, W, H);
  g.fillStyle = '#fff';
  // Letra: carimbo de borracha levemente torto e fora do centro.
  g.save();
  g.translate(W / 2 + rng.float(-0.04, 0.04) * W, H / 2 + rng.float(-0.03, 0.03) * H);
  g.rotate(rng.float(-0.08, 0.08));
  g.font = STAMP_FONT.replace('{px}', String(Math.round(H * 0.62)));
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(letter, 0, H * 0.03);
  g.restore();
  // Borda de furinhos: a ponta de um lápis a cada `pitch` u, `border` u para dentro da borda.
  const step = pitch * density;
  const inset = border * density;
  const along = (x0, y0, x1, y1) => {
    const len = Math.hypot(x1 - x0, y1 - y0);
    const n = Math.max(1, Math.round(len / step));
    for (let i = 0; i < n; i++) {
      const t = i / n;
      g.beginPath();
      g.arc(x0 + (x1 - x0) * t + rng.float(-0.6, 0.6), y0 + (y1 - y0) * t + rng.float(-0.6, 0.6), dot * density * rng.float(0.85, 1.15), 0, Math.PI * 2);
      g.fill();
    }
  };
  along(inset, inset, W - inset, inset);
  along(W - inset, inset, W - inset, H - inset);
  along(W - inset, H - inset, inset, H - inset);
  along(inset, H - inset, inset, inset);
  const px = g.getImageData(0, 0, W, H).data;
  const mask = new Float32Array(W * H);
  for (let i = 0; i < W * H; i++) mask[i] = px[i * 4] / 255;
  canvas.width = canvas.height = 0;
  const depth = boxBlur(mask, W, H, density * 0.45, 2);
  const wide = boxBlur(mask, W, H, density * 1.6, 2);
  const noise = createNoise3(rng.nextU32());
  // Rolo: faixas largas ao longo da placa com uma leve irregularidade (a massa não abre igual). O ruído é de baixa
  // frequência: calculado numa grade de 8 px e interpolado (um ruído por pixel custava ~40 ms por placa).
  const G = 8;
  const gw = Math.ceil(W / G) + 1;
  const gh = Math.ceil(H / G) + 1;
  const warp = new Float32Array(gw * gh);
  const swell = new Float32Array(gw * gh);
  for (let gy = 0; gy < gh; gy++) {
    for (let gx = 0; gx < gw; gx++) {
      const u = (gx * G) / W;
      const v = (gy * G) / H;
      warp[gy * gw + gx] = noise.noise(u * 3, v * 3, 1.3) * 2.4;
      swell[gy * gw + gx] = 0.6 + 0.4 * noise.noise(u * 9, v * 2, 4.1);
    }
  }
  const lerpGrid = (grid, x, y) => {
    const fx = x / G;
    const fy = y / G;
    const x0 = Math.floor(fx);
    const y0 = Math.floor(fy);
    const tx = fx - x0;
    const ty = fy - y0;
    const a = grid[y0 * gw + x0] + (grid[y0 * gw + x0 + 1] - grid[y0 * gw + x0]) * tx;
    const b = grid[(y0 + 1) * gw + x0] + (grid[(y0 + 1) * gw + x0 + 1] - grid[(y0 + 1) * gw + x0]) * tx;
    return a + (b - a) * ty;
  };
  const data = new Uint8Array(W * H * 4);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      const o = ((H - 1 - y) * W + x) * 4;
      const lip = Math.max(0, wide[i] - depth[i]) * 2.2 * (1 - depth[i]);
      const roll = 0.5 + 0.5 * Math.sin((y / H) * 38 + lerpGrid(warp, x, y)) * lerpGrid(swell, x, y);
      data[o] = Math.round(Math.min(1, depth[i]) * 255);
      data[o + 1] = Math.round(Math.min(1, lip) * 255);
      data[o + 2] = Math.round(Math.min(1, Math.max(0, roll)) * 255);
      data[o + 3] = 255;
    }
  }
  const texture = new THREE.DataTexture(data, W, H, THREE.RGBAFormat, THREE.UnsignedByteType);
  texture.name = `massacre.pista.impressao-${letter}`;
  texture.colorSpace = THREE.NoColorSpace;
  texture.generateMipmaps = true;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

/** Placa aberta no rolo e cortada à mão: a borda treme (deslocamento suave em XZ); o topo continua plano. */
function plateGeometry([w, h, d], seed) {
  const slab = claySlab({ width: w, height: h, depth: d, bevel: 1.6, segments: 10, lumpiness: 0.012, dents: 2, seed: `placa:${seed}` });
  const geo = slab.geometry;
  const noise = createNoise3(new RNG(`recorte-placa:${seed}`).nextU32());
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const z = p.getZ(i);
    const edge = Math.max(Math.abs(x) / (w / 2), Math.abs(z) / (d / 2));
    const k = THREE.MathUtils.smoothstep(edge, 0.7, 1) * 1.3;
    p.setX(i, x + noise.noise(z * 0.03, 1.1, x * 0.004) * k);
    p.setZ(i, z + noise.noise(x * 0.03, 2.7, z * 0.004) * k);
  }
  geo.computeVertexNormals();
  geo.computeBoundingSphere();
  return geo;
}

export function buildClay(ctx) {
  const { layout, data, group, disposers } = ctx;
  let plates = 0;
  for (const p of layout.pieces) {
    if (p.look.kind !== 'clayPlate') continue;
    const [w, , d] = p.size;
    const map = imprintTexture(p.look.letter, [w, d], p.look.seed);
    disposers.push(() => map.dispose());
    // Retângulo espelhado em X: quem vem da praça (olhando para o sul) lê a letra de pé. O relevo é exagerado em
    // relação ao carimbo de verdade (≈1,5 mm), como a luz rasante de macro o mostra nas fotos (CIM5, CIM8).
    const material = new ClayMaterial({
      color: p.look.color, roughness: 0.74, wetness: 0.22, fingerprints: 0.9, touched: false, seed: p.look.seed,
      imprint: { map, rect: [w / 2, -d / 2, -w, d], ...data.look.imprint },
    });
    material.setObjectSize(Math.hypot(w, d) / 2);
    group.add(placeMesh(new THREE.Mesh(plateGeometry(p.size, p.look.seed), material), p.matrix, { name: p.id }));
    plates++;
  }
  // Bolotas: nas pontas das traves e no pé do palito da bandeirinha; uma malha com a cor de cada uma nos vértices.
  const r = data.look.lump;
  const parts = [];
  const color = new THREE.Color();
  for (const d of layout.decor) {
    if (d.kind !== 'clayLump' && d.kind !== 'flag') continue;
    const rng = new RNG(`bolota:${d.id}`);
    // Bolota de 8,5 u: 8 divisões do icosaedro bastam (o padrão de 18 é para peças do tamanho do boneco).
    const ball = clayBall({
      radius: r * rng.float(0.85, 1.15), segments: 8, squash: [rng.float(1, 1.2), rng.float(0.62, 0.78), rng.float(0.95, 1.1)],
      lumpiness: 0.09, dents: 3, seed: rng.int(1, 9999),
    });
    const geo = ball.geometry;
    geo.applyMatrix4(new THREE.Matrix4().makeRotationY(rng.float(0, Math.PI * 2)).setPosition(0, r * 0.42, 0));
    geo.applyMatrix4(d.matrix);
    color.set(d.color ?? data.prints.colors[0]);
    const n = geo.attributes.position.count;
    const col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) col.set([color.r, color.g, color.b], i * 3);
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    parts.push(geo);
  }
  if (parts.length) {
    const merged = mergeGeometries(parts, false);
    for (const g of parts) g.dispose();
    merged.computeBoundingSphere();
    const material = new ClayMaterial({ color: '#FFFFFF', vertexColors: true, roughness: 0.7, wetness: 0.35, seed: 'bolotas-pista' });
    material.setObjectSize(r);
    group.add(placeMesh(new THREE.Mesh(merged, material), new THREE.Matrix4(), { name: 'bolotas' }));
  }
  return { plates, lumps: parts.length };
}
