// Tintas e acabamentos do set (pista de testes; PRU3, TMA6, BWM10 no item 11 do moodboard):
//  - paint: um material para as peças pequenas pintadas de um mapa, num lote só; o atributo aPaint escolhe o acabamento
//    e a cor de cada peça vem da cor da peça (BatchedMesh.setColorAt):
//      0 laca (corpo do lápis): tinta grossa e brilhante com casca de laranja e filme de verniz (clearcoat);
//      1 grafite (ponta do lápis): cinza-chumbo meio metálico com os riscos do apontador;
//      2 borracha (borracha do lápis, laterais e trava da trena): fosca, porosa, com o brilho do uso nas partes gastas;
//      3 plástico brilhante (cabeça dos alfinetes): liso, reflexo firme, leve translucidez.
//  - floorPaint: chão do estúdio em volta da mesa (piso pintado escuro): marcas de arrasto, restos de fita e poeira.

import * as THREE from 'three';
import { createSetMaterial } from './setShader.js';

const linear = (hex) => new THREE.Color(hex);

export function paintMaterial(tex, { graphite = '#2E2E31', name = 'tintas' } = {}) {
  return createSetMaterial({
    name,
    physical: true,
    params: { color: 0xffffff, roughness: 0.5, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.12 },
    uniforms: {
      uBrushed: { value: tex.brushed },
      uPaperTex: { value: tex.paper },
      uGraphite: { value: linear(graphite) },
    },
    light: { wrap: 0.25, lift: 0.06, translucency: 0.15 },
    vertexPars: 'attribute float aPaint;\nvarying float vPaint;',
    vertex: 'vPaint = aPaint;',
    fragPars: 'uniform sampler2D uBrushed;\nuniform sampler2D uPaperTex;\nuniform vec3 uGraphite;\nvarying float vPaint;',
    surface: /* glsl */ `
float mode = floor(vPaint + 0.5);
vec3 base = diffuseColor.rgb;
vec3 col = base;
SetTri t = setTriSetup(setP, setN, 24.0);
vec4 br = setTriSample(uBrushed, t);
float n1 = clayNoise3(setP * 1.7);
float n2 = clayNoise3(setP * 0.35 + 4.0);
if (mode < 0.5) {
  // Laca: casca de laranja (ondinhas de ~1 u) e escorrido suave; a tinta junta nas quinas (um pouco mais escura).
  col = base * (0.96 + 0.06 * n2);
  setObjN = normalize(setN + vec3(clayNoise3(setP * 2.3), clayNoise3(setP * 2.3 + 7.0), clayNoise3(setP * 2.3 + 13.0)) * 0.05);
  setRough += -0.15 + br.b * 0.1;
  setCoat = 1.0 - br.a * 0.3;
} else if (mode < 1.5) {
  // Grafite: riscos do apontador ao longo do eixo (X local) e brilho metálico fraco.
  float streak = clayNoise3(vec3(setP.x * 0.4, setP.y * 9.0, setP.z * 9.0)) * 0.5 + 0.5;
  col = uGraphite * (0.85 + 0.3 * streak);
  setMetal += 0.45;
  setRough += -0.08 + streak * 0.12;
  setCoat = 0.0;
  setObjN = normalize(setN + vec3(0.0, (streak - 0.5) * 0.3, 0.0));
} else if (mode < 2.5) {
  // Borracha: poros e grão fino, fosca; onde gasta (ruído largo) fica mais lisa e brilha um pouco.
  vec4 pp = texture(uPaperTex, setP.xy / 18.0 + setP.zx / 23.0);
  float worn = smoothstep(0.35, 0.8, n2 * 0.5 + 0.5);
  col = base * (0.9 + 0.12 * (pp.b - 0.5)) * (1.0 - worn * 0.06);
  setRough += 0.38 - worn * 0.25;
  setCoat = 0.0;
  setObjN = normalize(setN + vec3(pp.r - 0.5, pp.g - 0.5, n1 * 0.3) * 0.25 * (1.0 - worn));
} else {
  // Plástico brilhante (cabeça de alfinete): quase liso, clearcoat fraco, reflexo firme.
  col = base * (0.97 + 0.04 * n2);
  setRough += -0.32;
  setCoat = 0.4;
}
diffuseColor.rgb = col;
`,
  });
}

/**
 * Chão do estúdio: tinta de piso escura (fosca, gasta) com marcas de arrasto em arcos, restos de fita crepe velha e
 * poeira clara nos cantos (pelo ruído). `color` = a tinta.
 */
export function floorPaintMaterial(tex, { color = '#171210', residue = '#8C7D5A', name = 'chao-estudio' } = {}) {
  return createSetMaterial({
    name,
    params: { color: 0xffffff, roughness: 0.82, metalness: 0 },
    uniforms: {
      uMatWear: { value: tex.mat },
      uPaperTex: { value: tex.paper },
      uPaint: { value: linear(color) },
      uResidue: { value: linear(residue) },
    },
    light: { wrap: 0.2, lift: 0.04 },
    fragPars: 'uniform sampler2D uMatWear;\nuniform sampler2D uPaperTex;\nuniform vec3 uPaint;\nuniform vec3 uResidue;',
    surface: /* glsl */ `
vec2 q = setP.xz;
vec4 w = texture(uMatWear, q / 1400.0);
vec4 pp = texture(uPaperTex, q / 600.0);
float mottle = clayNoise3(vec3(q * 0.0011, 1.0)) * 0.5 + 0.5;
vec3 col = uPaint * (0.8 + 0.4 * mottle) * (0.92 + 0.16 * (pp.a - 0.5));
// Arrasto: arcos claros de cadeira e tripé (cortes do atlas do tapete, bem esticados).
float scuff = w.b * (0.5 + 0.5 * mottle);
col = mix(col, col * 1.9 + 0.012, scuff * 0.6);
// Restos de fita velha: retalhos retangulares amarelados aqui e ali.
vec2 cell = floor(q / 520.0);
vec2 f = q - (cell + 0.5) * 520.0;
float has = step(0.86, clayHash12(cell + 17.0));
float ang = clayHash12(cell + 23.0) * 3.14159;
vec2 rq = vec2(cos(ang) * f.x + sin(ang) * f.y, -sin(ang) * f.x + cos(ang) * f.y);
float tape = has * (1.0 - smoothstep(0.0, 1.5, max(abs(rq.x) - 60.0, abs(rq.y) - 19.0)));
col = mix(col, uResidue * (0.6 + 0.3 * pp.b), tape * 0.55);
// Poeira fina clara nas partes pouco pisadas.
float dust = smoothstep(0.55, 0.9, clayNoise3(vec3(q * 0.0045, 7.0)) * 0.5 + 0.5);
col = mix(col, vec3(0.08, 0.07, 0.06), dust * 0.35);
diffuseColor.rgb = col * diffuseColor.rgb;
setRough += dust * 0.1 - scuff * 0.15 - tape * 0.05;
mat3 tbn = setCotangentFrame(setN, setP, q / 1400.0);
setObjN = normalize(tbn * vec3((w.rg * 2.0 - 1.0) * 0.25, 1.0));
`,
  });
}
