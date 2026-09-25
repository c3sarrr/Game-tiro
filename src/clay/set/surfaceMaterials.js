// Superfícies do set (docs/art/moodboard.md item 4):
//  - cuttingMat: tapete de corte verde (SMD3; prova de escala PLA2/PLA14). Grade impressa de 1 cm com linha
//    reforçada a cada 5 cm, régua em milímetros e números por centímetro nas margens, guias de 30°/45°/60°
//    a partir da origem, casca de laranja do PVC e cortes de estilete "cicatrizados" (mais claros).
//    Tudo analítico no shader (sem textura esticada): nítido de perto e sem moiré de longe.
//  - plastic: pote de massinha (plástico injetado: marcas de fluxo na tampa, linha de molde, riscos, borda
//    translúcida).
//  - fabric: tecido preto das softboxes (trama, "sheen" de tecido).
//  - diffuser: frente da softbox / lente do fresnel / lâmpada (emissivo com ponto quente no centro e costura).

import * as THREE from 'three';
import { PALETTE } from '../../data/palette.js';
import { createSetMaterial } from './setShader.js';

const linear = (hex) => new THREE.Color(hex);

/**
 * @param {object} tex texturas do set
 * @param {{size:[number,number], margin?:number}} opts tamanho do tapete em u (10 u = 1 cm); a geometria é um
 *   plano com uv 0..1 (origem da régua no canto uv = (0,0))
 */
export function cuttingMatMaterial(tex, { size, margin = 18, color = PALETTE.cuttingMat, name = 'tapete-de-corte' } = {}) {
  const uniforms = {
    uMatWear: { value: tex.mat },
    uDigits: { value: tex.digits },
    uMatColor: { value: linear(color) },
    uLineColor: { value: linear('#D6EEDC') },
    uCutColor: { value: linear('#6FA487') },
    uMatSize: { value: new THREE.Vector2(size[0], size[1]) },
    uMargin: { value: margin },
  };
  return createSetMaterial({
    name,
    params: { color: 0xffffff, roughness: 0.76, metalness: 0 },
    uniforms,
    light: { wrap: 0.25, lift: 0.06 },
    fragPars: /* glsl */ `
uniform sampler2D uMatWear;
uniform sampler2D uDigits;
uniform vec3 uMatColor;
uniform vec3 uLineColor;
uniform vec3 uCutColor;
uniform vec2 uMatSize;
uniform float uMargin;

// Um número inteiro (1–3 dígitos) desenhado a partir do atlas 0–9: centrado em q.x = 0, base em q.y = 0,
// "para cima" = +v do tapete (lido de quem está na borda de baixo). q em u; altura gh, largura por dígito gw.
// Amostragem com gradientes das coordenadas contínuas (sem costura de mip entre dígitos).
float matNumber(vec2 q, float value, float gh, float gw) {
  float nd = value >= 100.0 ? 3.0 : (value >= 10.0 ? 2.0 : 1.0);
  vec2 g = vec2((q.x + nd * gw * 0.5) / gw, q.y / gh);
  if (g.x < 0.0 || g.x >= nd || g.y < 0.0 || g.y > 1.0) return 0.0;
  float idx = floor(g.x);
  float digit = mod(floor(value / pow(10.0, nd - 1.0 - idx) + 1e-3), 10.0);
  vec2 cont = vec2(g.x * 0.082, g.y);
  // CanvasTexture vem com flipY: a base do glifo fica em v = 0.
  vec2 uv = vec2((digit + 0.09 + fract(g.x) * 0.82) / 10.0, g.y);
  return textureGrad(uDigits, uv, dFdx(cont), dFdy(cont)).a;
}
`,
    surface: /* glsl */ `
vec2 m = setUv * uMatSize;                  // posição no tapete (u); 10 u = 1 cm
vec2 gp = m - vec2(uMargin);                // origem da grade no canto interno
vec4 wear = texture(uMatWear, m / 400.0);   // 40 cm por repetição
vec3 col = uMatColor * (0.9 + 0.16 * wear.a);
float ink = 0.0;
bool inGrid = gp.x >= 0.0 && gp.y >= 0.0 && m.x <= uMatSize.x - uMargin * 0.4 && m.y <= uMatSize.y - uMargin * 0.4;
if (inGrid) {
  float thin = max(setGridLine(gp.x, 10.0, 0.16), setGridLine(gp.y, 10.0, 0.16));
  float bold = max(setGridLine(gp.x, 50.0, 0.42), setGridLine(gp.y, 50.0, 0.42));
  ink = max(thin * 0.75, bold);
  // Guias de ângulo saindo da origem (30°, 45°, 60°), finas e tracejadas a cada 1 cm.
  float r = length(gp);
  float dash = step(0.35, fract(r / 10.0));
  for (int k = 0; k < 3; k++) {
    float a = radians(30.0 + 15.0 * float(k));
    float d = abs(dot(gp, vec2(-sin(a), cos(a))));
    float fw = max(fwidth(d), 1e-4);
    ink = max(ink, clamp((0.14 - d) / fw + 0.5, 0.0, 1.0) * 0.6 * dash);
  }
} else {
  // Margem: régua em milímetros (traço de 1 mm, 5 mm e 1 cm) e números a cada centímetro.
  if (gp.y < 0.0 && gp.x >= 0.0) {
    // Borda de baixo: traços descendo da grade, número embaixo de cada centímetro.
    float mm = setGridLine(gp.x, 1.0, 0.06) * step(-3.0, gp.y);
    float mm5 = setGridLine(gp.x, 5.0, 0.08) * step(-5.0, gp.y);
    float cm = setGridLine(gp.x, 10.0, 0.12) * step(-7.0, gp.y);
    ink = max(max(mm * 0.7, mm5 * 0.85), cm);
    float k = floor(gp.x / 10.0 + 0.5);
    if (k >= 1.0) ink = max(ink, matNumber(vec2(gp.x - k * 10.0, gp.y + 13.0), k, 4.2, 2.6));
  } else if (gp.x < 0.0 && gp.y >= 0.0) {
    // Borda esquerda: traços saindo da grade para a esquerda, número em pé ao lado de cada centímetro.
    float mm = setGridLine(gp.y, 1.0, 0.06) * step(-3.0, gp.x);
    float mm5 = setGridLine(gp.y, 5.0, 0.08) * step(-5.0, gp.x);
    float cm = setGridLine(gp.y, 10.0, 0.12) * step(-7.0, gp.x);
    ink = max(max(mm * 0.7, mm5 * 0.85), cm);
    float k = floor(gp.y / 10.0 + 0.5);
    if (k >= 1.0) ink = max(ink, matNumber(vec2(gp.x + 12.5, gp.y - k * 10.0 + 2.1), k, 4.2, 2.6));
  }
}
col = mix(col, uLineColor, ink * 0.82);
// Cortes cicatrizados: o PVC abre um sulco claro; tinta da grade some onde cortou.
float cut = wear.b;
col = mix(col, uCutColor, cut * 0.75);
setRough += cut * 0.12 - ink * 0.06;
mat3 tbn = setCotangentFrame(setN, setP, m / 400.0);
setObjN = normalize(tbn * vec3((wear.rg * 2.0 - 1.0) * 0.35, 1.0));
diffuseColor.rgb = col;
`,
  });
}

export function plasticMaterial(tex, { color = PALETTE.clayYellow, moldY = 0, name = 'plastico' } = {}) {
  return createSetMaterial({
    name: `${name}`,
    physical: true,
    params: { color: 0xffffff, roughness: 0.3, metalness: 0, specularIntensity: 0.75, clearcoat: 0.15, clearcoatRoughness: 0.2 },
    uniforms: {
      uBrushed: { value: tex.brushed },
      uPlastic: { value: linear(color) },
      uMoldY: { value: moldY },
    },
    light: { wrap: 0.35, lift: 0.08, translucency: 0.3 },
    fragPars: 'uniform sampler2D uBrushed;\nuniform vec3 uPlastic;\nuniform float uMoldY;',
    surface: /* glsl */ `
vec3 col = uPlastic * (0.96 + 0.06 * clayNoise3(setP * 0.05));
// Marcas de fluxo da injeção: anéis tênues em volta do ponto de injeção no centro da tampa.
float top = smoothstep(0.7, 0.95, setN.y);
float r = length(setP.xz);
float flow = sin(r * 1.4 + clayNoise3(vec3(setP.xz * 0.05, 1.0)) * 3.0) * 0.5 + 0.5;
col *= 1.0 - top * flow * 0.05;
setRough += top * flow * 0.05;
// Linha de molde: fio fino e saliente na altura uMoldY (normal inclina para cima acima dela e para baixo
// abaixo, como uma crista).
float mold = 1.0 - smoothstep(0.0, 0.3, abs(setP.y - uMoldY));
col *= 1.0 - mold * 0.08;
// Riscos de uso: só a máscara de riscos (rugosidade) e um relevo bem fraco — plástico não é escovado.
SetTri t = setTriSetup(setP, setN, 36.0);
vec4 b = setTriSample(uBrushed, t);
setRough += b.b * 0.25;
vec3 bump = setTriBump(uBrushed, t, setN, 0.12);
setObjN = normalize(bump + vec3(0.0, sign(setP.y - uMoldY) * mold * 0.4, 0.0));
diffuseColor.rgb = col;
`,
  });
}

export function fabricMaterial(tex, { color = '#171514', name = 'tecido-preto' } = {}) {
  // Dupla face: tecido de softbox/cortina é visto por dentro e por fora.
  return createSetMaterial({
    name,
    physical: true,
    params: {
      color: 0xffffff, roughness: 0.92, metalness: 0, sheen: 0.6, sheenRoughness: 0.55,
      sheenColor: new THREE.Color('#4a4644'), side: THREE.DoubleSide,
    },
    uniforms: { uWeave: { value: tex.weave }, uFabric: { value: linear(color) } },
    light: { wrap: 0.4, lift: 0.1 },
    fragPars: 'uniform sampler2D uWeave;\nuniform vec3 uFabric;',
    surface: /* glsl */ `
SetTri t = setTriSetup(setP, setN, 14.0);
vec4 w = setTriSample(uWeave, t);
diffuseColor.rgb = uFabric * (0.85 + 0.3 * (w.b - 0.5) * 2.0);
setObjN = setTriBump(uWeave, t, setN, 0.8);
`,
  });
}

/**
 * Superfície emissiva de luz (difusor de softbox, lente de fresnel, lâmpada). `emission` em radiância linear
 * (a montagem de luz calcula a partir da iluminância da luz); `hotspot` = quanto o centro é mais forte.
 */
export function diffuserMaterial(tex, {
  color = '#FFF4E6',
  emission = 6,
  hotspot = 0.35,
  seam = true,
  rings = false,
  name = 'difusor',
} = {}) {
  const emit = linear(color).multiplyScalar(emission);
  return createSetMaterial({
    name,
    params: { color: 0x000000, roughness: 0.9, metalness: 0 },
    uniforms: {
      uWeave: { value: tex.weave },
      uEmit: { value: emit },
      uHotspot: { value: hotspot },
      uSeam: { value: seam ? 1 : 0 },
      uRings: { value: rings ? 1 : 0 },
    },
    light: { wrap: 0, lift: 0 },
    fragPars: 'uniform sampler2D uWeave;\nuniform vec3 uEmit;\nuniform float uHotspot;\nuniform float uSeam;\nuniform float uRings;',
    surface: /* glsl */ `
vec2 c = setUv - 0.5;
float r2 = dot(c, c) * 4.0;
float hot = 1.0 - uHotspot * r2;
float weave = texture(uWeave, setUv * 18.0).b;
float edge = min(min(setUv.x, 1.0 - setUv.x), min(setUv.y, 1.0 - setUv.y));
float seamDark = uSeam * (1.0 - smoothstep(0.015, 0.035, edge)) * 0.55;
// Lente de Fresnel: degraus concêntricos alternando claro/escuro.
float ringMod = mix(1.0, 0.8 + 0.2 * sin(sqrt(r2) * 6.2831853 * 7.0), uRings);
setEmit = uEmit * max(hot, 0.0) * (0.94 + 0.12 * (weave - 0.5)) * (1.0 - seamDark) * ringMod;
diffuseColor.rgb = vec3(0.02);
`,
  });
}
