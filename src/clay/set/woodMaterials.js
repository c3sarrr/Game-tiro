// Madeiras do set (docs/art/moodboard.md item 4: CSD16).
//  - balsa: palitos e ripas claras de maquete, veio fino ao longo do eixo X da peça, pontas com o topo da
//    madeira (anéis e poros) e fibras levantadas (rugosa, macia).
//  - benchWood: tampo da bancada do animador (madeira mais escura, verniz gasto = clearcoat irregular,
//    manchas de uso e arranhões).

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
    surface: /* glsl */ `
float ra;
vec3 bn;
diffuseColor.rgb = woodSurface(setP, setN, bn, ra);
setObjN = bn;
setRough += ra;
`,
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
