// Livros do set (bookGeometry.js; BAS1, BAS4, BAS7, BAS9, BAS11, BAS15 no item 11 do moodboard): um material para
// todos os livros de um mapa, num lote só.
//  - Pano da capa (buckram): trama fina, a cor de cada livro vem da cor da peça (BatchedMesh.setColorAt); gasto de
//    manuseio nas bordas das pastas, quinas batidas mostrando o papelão cinza e as pontas da lombada puídas.
//  - Lombada: título estampado (dourado em capa escura, preto em capa clara, levemente afundado) e, nos livros das
//    escadas, a etiqueta de biblioteca com a altura escrita à mão — do atlas das lombadas do mapa.
//  - Borda das folhas: papel creme com as folhas (de muito perto), os cadernos costurados (grupos de folhas), pontinhos
//    de mofo e a borda um pouco mais escura rente às capas.
//  - Guarda: papel de dentro da capa, só na fresta.
// O atlas das lombadas (bakeSpineAtlas) é do mapa: RGBA = título · papel da etiqueta · escrita da etiqueta · 1.

import * as THREE from 'three';
import { RNG } from '../../core/rng.js';
import { createSetMaterial } from './setShader.js';

const linear = (hex) => new THREE.Color(hex);

/**
 * @param {object} tex texturas do set
 * @param {{atlas:THREE.Texture, paper?:string, endpaper?:string, board?:string, foil?:string, ink?:string, name?:string}} opts
 */
export function bookMaterial(tex, {
  atlas, paper = '#EFE5CF', endpaper = '#E6DAC0', board = '#8D8578', foil = '#C8A24A', ink = '#1B1714',
  sticker = '#F3EFE4', pen = '#23272F', name = 'livros',
}) {
  return createSetMaterial({
    name,
    physical: true,
    params: { color: 0xffffff, roughness: 0.78, metalness: 0, clearcoat: 0, sheen: 0.35, sheenRoughness: 0.7, sheenColor: new THREE.Color('#6d6259') },
    uniforms: {
      uWeave: { value: tex.weave },
      uPaperTex: { value: tex.paper },
      uSpineAtlas: { value: atlas },
      uPagePaper: { value: linear(paper) },
      uEndpaper: { value: linear(endpaper) },
      uBoardGrey: { value: linear(board) },
      uFoil: { value: linear(foil) },
      uPrintInk: { value: linear(ink) },
      uSticker: { value: linear(sticker) },
      uPen: { value: linear(pen) },
    },
    light: { wrap: 0.3, lift: 0.07 },
    vertexPars: /* glsl */ `
attribute float aBookPart;
attribute vec2 aBookUv;
attribute vec3 aBookDims;
attribute vec4 aSpineRect;
varying float vBookPart;
varying vec2 vBookUv;
varying vec3 vBookDims;
varying vec4 vSpineRect;
`,
    vertex: 'vBookPart = aBookPart;\n  vBookUv = aBookUv;\n  vBookDims = aBookDims;\n  vSpineRect = aSpineRect;',
    fragPars: /* glsl */ `
uniform sampler2D uWeave;
uniform sampler2D uPaperTex;
uniform sampler2D uSpineAtlas;
uniform vec3 uPagePaper;
uniform vec3 uEndpaper;
uniform vec3 uBoardGrey;
uniform vec3 uFoil;
uniform vec3 uPrintInk;
uniform vec3 uSticker;
uniform vec3 uPen;
varying float vBookPart;
varying vec2 vBookUv;
varying vec3 vBookDims;
varying vec4 vSpineRect;
`,
    surface: /* glsl */ `
vec3 cover = diffuseColor.rgb;
float part = vBookPart;
vec2 uv = vBookUv;
vec3 col;
// Amostras fora de desvio (mipmap com derivadas válidas em todo o quadrado de pixels).
vec4 wv = texture(uWeave, uv / 32.0);
vec4 pp = texture(uPaperTex, vec2(uv.x / 140.0, setP.y / 9.0));
// Lombada: (ao longo ÷ comprimento, 1 − arco ÷ arco total) na célula do atlas; mais duas amostras de cada lado para o
// relevo (título afundado, etiqueta colada por cima). Em partes sem lombada, vSpineRect.z = 0 zera tudo.
vec2 suv = vec2(uv.x / max(vBookDims.x, 1e-3), 1.0 - uv.y / max(vBookDims.z, 1e-3));
vec2 se = vec2(0.35 / max(vBookDims.x, 1e-3), 0.35 / max(vBookDims.z, 1e-3));
vec4 sp = texture(uSpineAtlas, vSpineRect.xy + clamp(suv, 0.0, 1.0) * vSpineRect.zw);
vec4 sx1 = texture(uSpineAtlas, vSpineRect.xy + clamp(suv + vec2(se.x, 0.0), 0.0, 1.0) * vSpineRect.zw);
vec4 sx0 = texture(uSpineAtlas, vSpineRect.xy + clamp(suv - vec2(se.x, 0.0), 0.0, 1.0) * vSpineRect.zw);
vec4 sy1 = texture(uSpineAtlas, vSpineRect.xy + clamp(suv - vec2(0.0, se.y), 0.0, 1.0) * vSpineRect.zw);
vec4 sy0 = texture(uSpineAtlas, vSpineRect.xy + clamp(suv + vec2(0.0, se.y), 0.0, 1.0) * vSpineRect.zw);
float hasSpine = step(1e-6, vSpineRect.z) * step(2.5, part);
mat3 tbn = setCotangentFrame(setN, setP, uv);
if (part < 0.5 || part > 2.5) {
  // Pano: trama em cruz e fios mais claros/escuros; o gasto clareia e acinzenta o pano (fibras quebradas) e, nas quinas
  // batidas, some e mostra o papelão cinza da pasta.
  col = cover * (0.9 + 0.2 * (wv.b - 0.5) * 2.0);
  float dEnd = min(uv.x, vBookDims.x - uv.x);
  float dFore = part > 2.5 ? 1e4 : uv.y;
  float d = min(dEnd, dFore);
  float corner = (1.0 - smoothstep(0.0, 9.0, dEnd)) * (1.0 - smoothstep(0.0, 9.0, dFore));
  float n = clayNoise3(vec3(uv * 0.35, part * 7.0)) * 0.5 + 0.5;
  float worn = (1.0 - smoothstep(0.0, 4.0 + n * 5.0, d)) * (0.55 + 0.45 * n);
  worn = max(worn, corner * 0.8);
  col = mix(col, mix(col, vec3(dot(col, vec3(0.3333))) * 1.35 + 0.04, 0.6), worn * 0.7);
  col = mix(col, uBoardGrey * (0.85 + 0.2 * n), smoothstep(0.55, 0.95, corner * n * 1.6) * step(part, 0.5));
  // Título e etiqueta da lombada.
  float lum = dot(cover, vec3(0.2126, 0.7152, 0.0722));
  float dark = 1.0 - step(0.12, lum);
  vec3 inkCol = mix(uPrintInk, uFoil, dark);
  float title = clamp(sp.r * 1.25, 0.0, 1.0) * hasSpine * (1.0 - worn * 0.5);
  float label = sp.g * hasSpine;
  float pen = sp.b * hasSpine;
  col = mix(col, inkCol, title);
  col = mix(col, uSticker * (0.94 + 0.08 * (pp.a - 0.5)), label);
  col = mix(col, uPen, pen * 0.95);
  // Relevo: título afundado (a normal cai para dentro na borda das letras) e etiqueta colada por cima, lisa.
  vec2 gt = vec2(sx1.r - sx0.r, sy1.r - sy0.r) / 0.7 * hasSpine;
  vec2 gl = vec2(sx1.g - sx0.g, sy1.g - sy0.g) / 0.7 * hasSpine;
  vec2 dn = (wv.rg * 2.0 - 1.0) * 0.8 * (1.0 - label) + gt * 0.3 - gl * 0.25;
  setObjN = normalize(tbn * vec3(dn, 1.0));
  float foil = title * dark;
  setMetal += foil * 0.75;
  setRough += worn * 0.15 - foil * 0.5 - title * 0.1 - label * 0.1;
} else if (part < 1.5) {
  col = uEndpaper * (0.94 + 0.12 * (pp.b - 0.5));
  setRough += 0.1;
} else {
  // Borda das folhas: folha a folha (0,1 u) só de muito perto; os cadernos (16 folhas) em sulcos mais escuros.
  // Aqui vBookDims.z é a espessura do miolo.
  float y = uv.y;
  float fw = max(fwidth(y), 1e-4);
  float leaf = (0.5 + 0.5 * cos(6.2831853 * y / 0.1)) * (1.0 - smoothstep(0.02, 0.06, fw));
  float sig = abs(fract(y / 1.6 + clayHash12(vec2(floor(y / 1.6), 1.0)) * 0.2) - 0.5) * 1.6;
  float gap = (1.0 - smoothstep(0.0, 0.12 + fw, sig)) * (1.0 - smoothstep(0.3, 0.9, fw));
  col = uPagePaper * (0.93 + 0.1 * (pp.b - 0.5)) * (1.0 - leaf * 0.06) * (1.0 - gap * 0.25);
  // Rente às capas o papel pegou mais poeira e luz; pontinhos de mofo aqui e ali.
  float nearCover = 1.0 - smoothstep(0.0, 2.2, min(y, vBookDims.z - y));
  float spots = smoothstep(0.78, 0.9, clayNoise3(vec3(uv.x * 0.6, y * 0.6, 3.1)) * 0.5 + 0.5);
  col *= (1.0 - nearCover * 0.1) * (1.0 - spots * 0.15);
  // Folhas não ficam perfeitamente alinhadas: a normal oscila em grupos ao longo da espessura.
  float wob = clayNoise3(vec3(uv.x * 0.08, y * 1.4, 5.5));
  setObjN = normalize(tbn * vec3(0.0, wob * 0.25 + gap * 0.2, 1.0));
  setRough += 0.08;
}
diffuseColor.rgb = col;
`,
  });
}

/**
 * Atlas das lombadas: uma célula por texto diferente, com a largura proporcional à lombada (texto sem esticar),
 * empacotadas em prateleiras. RGBA = título impresso · papel da etiqueta · escrita da etiqueta · 1.
 * @param {Array<{title:string, label?:string, aspect:number}>} spines `aspect` = comprimento ÷ arco da lombada
 * @returns {{texture:THREE.CanvasTexture, rects:number[][], dispose():void}} rects[i] = [u0, v0, largura, altura]
 */
export function bakeSpineAtlas(spines, { width = 2048, cellHeight = 40, seed = 'lombadas', anisotropy = 8 } = {}) {
  const pad = 2;
  const cells = [];
  let x = 0;
  let y = 0;
  for (const s of spines) {
    const w = Math.min(width - 2 * pad, Math.max(24, Math.round(cellHeight * s.aspect)));
    if (x + w + pad > width) {
      x = 0;
      y += cellHeight + pad;
    }
    cells.push({ x, y, w, h: cellHeight });
    x += w + pad;
  }
  const height = 2 ** Math.ceil(Math.log2(Math.max(y + cellHeight, 1)));
  const layer = () => {
    const c = document.createElement('canvas');
    c.width = width;
    c.height = height;
    const g = c.getContext('2d');
    g.fillStyle = '#ffffff';
    g.strokeStyle = '#ffffff';
    g.textBaseline = 'middle';
    return { c, g };
  };
  const title = layer();
  const sticker = layer();
  const pen = layer();
  spines.forEach((s, i) => {
    const cell = cells[i];
    const rng = new RNG(`${seed}:${i}:${s.title}`);
    const hasLabel = !!s.label;
    const stickerW = hasLabel ? Math.min(cell.w * 0.3, cell.h * 1.7) : 0;
    const room = cell.w - stickerW - cell.h * 0.6;
    // Título em versaletes espaçados, centrado no espaço livre (a etiqueta fica perto da ponta direita).
    let px = Math.round(cell.h * 0.52);
    title.g.font = `600 ${px}px Georgia, "Times New Roman", serif`;
    const text = s.title.toUpperCase();
    const spacing = px * 0.08;
    const measure = () => [...text].reduce((wsum, ch) => wsum + title.g.measureText(ch).width + spacing, 0);
    let tw = measure();
    if (tw > room) {
      px = Math.max(8, Math.floor(px * (room / tw)));
      title.g.font = `600 ${px}px Georgia, "Times New Roman", serif`;
      tw = measure();
    }
    let cx = cell.x + cell.h * 0.3 + Math.max(0, (room - tw) / 2);
    const cy = cell.y + cell.h / 2 + rng.float(-0.4, 0.4);
    for (const ch of text) {
      title.g.fillText(ch, cx, cy);
      cx += title.g.measureText(ch).width + spacing;
    }
    if (hasLabel) {
      // Etiqueta de biblioteca: retângulo de papel de cantos redondos, um pouco torto, com a altura escrita à mão.
      const sx = cell.x + cell.w - stickerW - cell.h * 0.25;
      const sh = cell.h * 0.78;
      const sy = cell.y + (cell.h - sh) / 2;
      sticker.g.save();
      sticker.g.translate(sx + stickerW / 2, sy + sh / 2);
      sticker.g.rotate(rng.float(-0.025, 0.025));
      sticker.g.beginPath();
      sticker.g.roundRect(-stickerW / 2, -sh / 2, stickerW, sh, sh * 0.16);
      sticker.g.fill();
      sticker.g.restore();
      const hp = Math.round(sh * 0.62);
      pen.g.lineJoin = 'round';
      pen.g.lineCap = 'round';
      let lx = sx + stickerW * 0.12;
      const chars = [...s.label];
      pen.g.font = `700 ${hp}px "Segoe Print", "Bradley Hand", "Comic Sans MS", cursive`;
      const natural = chars.reduce((wsum, ch) => wsum + pen.g.measureText(ch).width, 0);
      const fit = Math.min(1, (stickerW * 0.8) / Math.max(natural, 1));
      lx = sx + (stickerW - natural * fit) / 2;
      for (const ch of chars) {
        const size = hp * fit * rng.float(0.93, 1.07);
        pen.g.font = `700 ${Math.round(size)}px "Segoe Print", "Bradley Hand", "Comic Sans MS", cursive`;
        const adv = pen.g.measureText(ch).width;
        pen.g.save();
        pen.g.translate(lx + adv / 2, sy + sh / 2 + rng.float(-0.05, 0.05) * size);
        pen.g.rotate(rng.float(-0.07, 0.07));
        pen.g.lineWidth = size * 0.07;
        pen.g.strokeText(ch, -adv / 2, 0);
        pen.g.fillText(ch, -adv / 2, 0);
        pen.g.restore();
        lx += adv * rng.float(0.97, 1.03);
      }
    }
  });
  const out = document.createElement('canvas');
  out.width = width;
  out.height = height;
  const og = out.getContext('2d');
  const img = og.createImageData(width, height);
  const t = title.g.getImageData(0, 0, width, height).data;
  const st = sticker.g.getImageData(0, 0, width, height).data;
  const pn = pen.g.getImageData(0, 0, width, height).data;
  for (let i = 0; i < img.data.length; i += 4) {
    img.data[i] = t[i + 3];
    img.data[i + 1] = st[i + 3];
    img.data[i + 2] = pn[i + 3];
    img.data[i + 3] = 255;
  }
  og.putImageData(img, 0, 0);
  for (const l of [title, sticker, pen]) l.c.width = l.c.height = 0;
  const texture = new THREE.CanvasTexture(out);
  texture.name = 'massacre.set.lombadas';
  texture.colorSpace = THREE.NoColorSpace;
  texture.anisotropy = anisotropy;
  texture.generateMipmaps = true;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.needsUpdate = true;
  const rects = cells.map((c) => [c.x / width, 1 - (c.y + c.h) / height, c.w / width, c.h / height]);
  return {
    texture,
    rects,
    dispose() {
      texture.dispose();
      out.width = out.height = 0;
    },
  };
}
