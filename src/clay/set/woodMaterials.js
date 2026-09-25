// Madeiras do set (docs/art/moodboard.md item 4: CSD16; pista de testes no item 11).
//  - balsa: palitos e ripas claras de maquete, veio fino ao longo do eixo X da peça, pontas com o topo da
//    madeira (anéis e poros) e fibras levantadas (rugosa, macia). A cor da peça (lote do BatchedMesh) tinge: bambu do
//    espeto e cedro do lápis saem do mesmo material (BWM1, BWM14, PRU3).
//  - benchWood: tampo da bancada do animador (madeira mais escura, verniz gasto = clearcoat irregular,
//    manchas de uso e arranhões).
//  - beech: blocos de faia de brinquedo (AWB1, AWB4, AWB12, AWB17) — o shader da balsa com a cor, a escala e o acabamento
//    encerado da faia; cada bloco tingido pela cor da peça (tons variados de uma caixa de blocos).
//  - plywood: compensado de bétula (PKG3, PKG6, CFO11, CFR6): lâmina da face com veio largo e remendos ovais
//    ("barquinhos" de reparo da lâmina), lâminas alternadas nas bordas ao longo do Y local da peça (a espessura), linhas
//    de cola; na base da pista (`sheets`), as chapas de 2440 × 1220 com emendas, parafusos nas linhas dos caibros e
//    riscos de lápis de marcação.

import * as THREE from 'three';
import { PALETTE } from '../../data/palette.js';
import { createSetMaterial } from './setShader.js';

const linear = (hex) => new THREE.Color(hex);

const WOOD_GLSL = /* glsl */ `
uniform sampler2D uWood;
uniform vec3 uWoodLight;
uniform vec3 uWoodDark;
uniform float uWoodScale;
uniform float uRingFreq;
// Albedo e relevo da madeira: lateral (veio ao longo de X) nas projeções Y/Z, topo (anéis) na projeção X.
vec3 woodSurface(vec3 p, vec3 n, out vec3 objN, out float roughAdd) {
  SetTri t = setTriSetup(p, n, uWoodScale);
  vec4 side = texture(uWood, t.uvY) * t.w.y + texture(uWood, t.uvZ) * t.w.z;
  float sideW = t.w.y + t.w.z;
  side /= max(sideW, 1e-4);
  vec3 sideCol = mix(uWoodLight, uWoodDark, side.b * 0.75);
  sideCol *= 1.0 - side.a * 0.35;
  // Topo: anéis concêntricos em volta de um centro fora da peça (tábua serrada) + poros.
  vec2 e = p.zy + vec2(37.0, -21.0);
  float r = length(e) * uRingFreq + clayNoise3(vec3(p.zy * 0.08, 3.0)) * 1.4;
  float ring = pow(0.5 + 0.5 * cos(6.2831853 * r), 5.0);
  float pores = step(0.8, clayHash12(floor(p.zy * 1.8)));
  vec3 endCol = mix(uWoodLight * 0.92, uWoodDark, ring * 0.8) * (1.0 - pores * 0.25);
  vec3 col = mix(sideCol, endCol, t.w.x);
  roughAdd = t.w.x * 0.12 + side.a * 0.05;
  objN = setTriBump(uWood, t, n, 0.6);
  return col;
}
`;

// A cor da peça (material branco × cor do lote no BatchedMesh) tinge a madeira.
const TINTED_WOOD_SURFACE = /* glsl */ `
float ra;
vec3 bn;
diffuseColor.rgb = woodSurface(setP, setN, bn, ra) * diffuseColor.rgb;
setObjN = bn;
setRough += ra;
`;

export function balsaMaterial(tex, { light = '#E0CBA4', dark = '#BFA173', name = 'balsa' } = {}) {
  return createSetMaterial({
    name,
    params: { color: 0xffffff, roughness: 0.8, metalness: 0 },
    uniforms: {
      uWood: { value: tex.wood },
      uWoodLight: { value: linear(light) },
      uWoodDark: { value: linear(dark) },
      uWoodScale: { value: 70 },
      uRingFreq: { value: 0.35 },
    },
    light: { wrap: 0.35, lift: 0.07 },
    fragPars: WOOD_GLSL,
    surface: TINTED_WOOD_SURFACE,
  });
}

export function beechMaterial(tex, { light = '#E8CFA6', dark = '#C29A68', name = 'faia' } = {}) {
  return createSetMaterial({
    name,
    physical: true,
    params: { color: 0xffffff, roughness: 0.6, metalness: 0, clearcoat: 0.12, clearcoatRoughness: 0.55 },
    uniforms: {
      uWood: { value: tex.wood },
      uWoodLight: { value: linear(light) },
      uWoodDark: { value: linear(dark) },
      uWoodScale: { value: 110 },
      uRingFreq: { value: 0.22 },
    },
    light: { wrap: 0.3, lift: 0.07 },
    fragPars: WOOD_GLSL,
    surface: TINTED_WOOD_SURFACE,
  });
}

export function benchWoodMaterial(tex, { light = '#9C6A47', dark = PALETTE.wood, name = 'bancada' } = {}) {
  return createSetMaterial({
    name,
    physical: true,
    params: { color: 0xffffff, roughness: 0.58, metalness: 0, clearcoat: 0.35, clearcoatRoughness: 0.35 },
    uniforms: {
      uWood: { value: tex.wood },
      uWoodLight: { value: linear(light) },
      uWoodDark: { value: linear(dark) },
      uWoodScale: { value: 220 },
      uRingFreq: { value: 0.12 },
      uMatWear: { value: tex.mat },
    },
    light: { wrap: 0.25, lift: 0.06 },
    fragPars: `${WOOD_GLSL}\nuniform sampler2D uMatWear;`,
    surface: /* glsl */ `
float ra;
vec3 bn;
vec3 col = woodSurface(setP, setN, bn, ra);
// Verniz gasto: onde o tampo é mais usado o brilho some e a madeira escurece; arranhões claros.
vec4 wear = texture(uMatWear, setP.xz / 900.0);
float used = smoothstep(0.35, 0.8, wear.a);
col *= 1.0 - used * 0.12;
col = mix(col, col * 1.25, wear.b * 0.5);
diffuseColor.rgb = col;
setObjN = bn;
setRough += ra + used * 0.15 + wear.b * 0.1;
setCoat = 1.0 - used * 0.75 - wear.b * 0.5;
`,
  });
}

const PLYWOOD_GLSL = /* glsl */ `
uniform sampler2D uWood;
uniform vec3 uPlyLight;
uniform vec3 uPlyDark;
uniform vec3 uPlyCore;
uniform vec3 uPlyGlue;
uniform vec3 uPencil;
uniform float uPlyPitch;
uniform vec4 uSheet;      // largura e altura da chapa, origem (x, z) da primeira chapa
uniform float uSheetMode; // 1 = base: chapas, emendas, parafusos e riscos
uniform vec3 uJoist;      // espaçamento dos caibros, dos parafusos e o recuo da borda (u)
float plyLine(vec2 p, vec2 a, vec2 b, float w) {
  vec2 pa = p - a;
  vec2 ba = b - a;
  float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  float d = length(pa - ba * h);
  float fw = max(fwidth(d), 1e-4);
  return clamp((w - d) / fw + 0.5, 0.0, 1.0);
}
`;

/**
 * Compensado de bétula. `sheets` = [largura, altura] das chapas (só na base da pista, com `origin` = canto [x, z] da
 * primeira chapa no espaço da peça): liga emendas, tom por chapa, parafusos e riscos de lápis.
 */
export function plywoodMaterial(tex, {
  light = '#D9BC8F', dark = '#B48B5C', core = '#CDAE80', glue = '#8A6A45', pitch = 1.6, sheets = null, origin = [0, 0],
  name = 'compensado',
} = {}) {
  return createSetMaterial({
    name,
    params: { color: 0xffffff, roughness: 0.72, metalness: 0 },
    uniforms: {
      uWood: { value: tex.wood },
      uPlyLight: { value: linear(light) },
      uPlyDark: { value: linear(dark) },
      uPlyCore: { value: linear(core) },
      uPlyGlue: { value: linear(glue) },
      uPencil: { value: linear('#55575C') },
      uPlyPitch: { value: pitch },
      uSheet: { value: new THREE.Vector4(sheets?.[0] ?? 2440, sheets?.[1] ?? 1220, origin[0], origin[1]) },
      uSheetMode: { value: sheets ? 1 : 0 },
      uJoist: { value: new THREE.Vector3(406.4, 152.4, 12) },
    },
    light: { wrap: 0.3, lift: 0.07 },
    fragPars: PLYWOOD_GLSL,
    surface: /* glsl */ `
vec3 n = setN;
vec3 col;
if (abs(n.y) > 0.5) {
  // Face da lâmina: veio largo ao longo do X local; nas chapas da base, cada chapa com o seu começo de veio e tom.
  vec2 q = setP.xz;
  vec2 f = q;
  float seam = 0.0;
  float tone = 0.0;
  if (uSheetMode > 0.5) {
    vec2 g = (q - uSheet.zw) / uSheet.xy;
    vec2 cell = floor(g);
    f = fract(g) * uSheet.xy;
    vec2 edge = min(f, uSheet.xy - f);
    seam = 1.0 - smoothstep(0.35, 1.3, min(edge.x, edge.y));
    tone = clayHash12(cell + 7.0) - 0.5;
    q = f + cell * vec2(97.0, 57.0);
  }
  float warp = clayNoise3(vec3(q * vec2(0.0019, 0.007), 1.3)) * 2.4;
  vec4 w = texture(uWood, vec2(q.x / 540.0, q.y / 160.0 + warp * 0.06));
  float figure = clayNoise3(vec3(q.x * 0.0016, q.y * 0.021 + warp, 4.1)) * 0.5 + 0.5;
  col = mix(uPlyLight, uPlyDark, clamp(w.b * 0.55 + figure * 0.3, 0.0, 1.0));
  col *= (1.0 + tone * 0.1) * (1.0 - w.a * 0.12);
  // Remendos ovais da lâmina: elipse de tom um pouco diferente com o contorno fino do corte.
  vec2 pc = q / vec2(430.0, 170.0);
  vec2 pcell = floor(pc);
  float has = step(0.74, clayHash12(pcell + 3.1));
  vec2 pctr = (pcell + 0.3 + clayHash22(pcell) * 0.4) * vec2(430.0, 170.0);
  float pr = length((q - pctr) / vec2(36.0, 11.0));
  float inside = has * (1.0 - smoothstep(0.96, 1.0, pr));
  float outline = has * smoothstep(0.9, 0.97, pr) * (1.0 - smoothstep(1.0, 1.07, pr));
  col = mix(col, col * vec3(1.05, 1.02, 0.96), inside);
  col *= 1.0 - outline * 0.25;
  float graphite = 0.0;
  float screw = 0.0;
  if (uSheetMode > 0.5) {
    col *= 1.0 - seam * 0.6;
    // Parafusos: nas linhas dos caibros e a um recuo das bordas de cada chapa, um a cada uJoist.y.
    float jx = floor((f.x - uJoist.z) / uJoist.x + 0.5) * uJoist.x + uJoist.z;
    jx = clamp(jx, uJoist.z, uSheet.x - uJoist.z);
    float sz = (fract((f.y - uJoist.z) / uJoist.y + 0.5) - 0.5) * uJoist.y;
    vec2 sd = vec2(f.x - jx, sz);
    float sr = length(sd);
    screw = 1.0 - smoothstep(2.1, 2.5, sr);
    float slot = screw * (1.0 - smoothstep(0.25, 0.45, min(abs(sd.x), abs(sd.y)))) * step(sr, 1.8);
    float sink = smoothstep(2.1, 2.5, sr) * (1.0 - smoothstep(2.5, 3.1, sr));
    col = mix(col, vec3(0.34, 0.33, 0.31) * (0.9 + 0.2 * clayHash12(floor(f / 7.0))), screw);
    col *= 1.0 - slot * 0.6 - sink * 0.18;
    // Riscos de lápis: linha de cada caibro marcada a 9 u do parafuso e alguns "X" de marcação.
    graphite = max(graphite, plyLine(f, vec2(jx - 9.0, 20.0), vec2(jx - 9.0, uSheet.y - 20.0), 0.32)
      * step(0.35, clayHash12(vec2(floor(q.x / uJoist.x), 5.0))));
    vec2 xc = floor(f / 300.0);
    vec2 xo = (xc + 0.2 + clayHash22(xc + 11.0) * 0.6) * 300.0;
    float xmark = step(0.8, clayHash12(xc + 13.0));
    graphite = max(graphite, xmark * max(plyLine(f, xo - 7.0, xo + 7.0, 0.3), plyLine(f, xo + vec2(-7.0, 7.0), xo + vec2(7.0, -7.0), 0.3)));
    col = mix(col, uPencil, graphite * 0.7);
  }
  setRough += w.a * 0.06 - graphite * 0.3 - screw * 0.3;
  setMetal += screw * 0.6;
  mat3 tbn = setCotangentFrame(n, setP, q / 540.0);
  setObjN = normalize(tbn * vec3((w.rg * 2.0 - 1.0) * 0.35, 1.0));
} else {
  // Borda: lâminas alternadas (veio ao comprido e de topo) ao longo do Y local, com as linhas de cola.
  float yy = setP.y / uPlyPitch;
  float layer = floor(yy);
  float within = fract(yy);
  float crossed = mod(layer, 2.0);
  float along = dot(setP.xz, vec2(abs(n.z), abs(n.x)));
  float streak = clayNoise3(vec3(along * 0.09, layer * 3.1, 2.0)) * 0.5 + 0.5;
  float pore = step(0.8, clayHash12(floor(vec2(along * 1.3, yy * 3.0)) + layer));
  col = mix(uPlyCore * (0.9 + 0.16 * streak), uPlyCore * 0.8 * (1.0 - pore * 0.3), crossed);
  float glue = 1.0 - smoothstep(0.0, 0.1, min(within, 1.0 - within));
  col = mix(col, uPlyGlue, glue * 0.55);
  setRough += crossed * 0.1;
  setObjN = normalize(n + vec3(0.0, (streak - 0.5) * 0.15 * (1.0 - crossed), 0.0));
}
diffuseColor.rgb = col * diffuseColor.rgb;
`,
  });
}
