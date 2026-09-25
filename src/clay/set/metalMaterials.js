// Metais do set (docs/art/moodboard.md item 4: CSD19, SMD3; armaduras de arame dos bonecos).
//  - toolMetal: aço escovado de ferramenta de modelar/estilete (estrias ao longo do eixo X da peça, riscos,
//    manchas de dedo que mudam a rugosidade) com restos de massinha grudados perto da ponta de trabalho.
//  - wire: arame de armadura (alumínio), uv.x = comprimento em u; estrias de trefilação e pontos de oxidação.
//  - chrome: articulações de tripé C-stand e grampos (cromado com riscos finos).
//  - blackMetal: tubos e corpo das luzes (tinta preta semifosca com arranhões mostrando metal).

import * as THREE from 'three';
import { PALETTE } from '../../data/palette.js';
import { createSetMaterial } from './setShader.js';

const linear = (hex) => new THREE.Color(hex);

export function toolMetalMaterial(tex, {
  color = '#A3A9AF',
  residue = PALETTE.terracotta,
  residueFrom = 0.55, // fração do comprimento (eixo X) a partir da qual há massinha grudada
  length = 160,
  name = 'metal-ferramenta',
} = {}) {
  const uniforms = {
    uBrushed: { value: tex.brushed },
    uMetal: { value: linear(color) },
    uResidue: { value: linear(residue) },
    uResidueFrom: { value: residueFrom },
    uToolLength: { value: length },
  };
  return createSetMaterial({
    name,
    physical: true,
    params: { color: 0xffffff, roughness: 0.34, metalness: 1, anisotropy: 0.55, anisotropyRotation: 0 },
    uniforms,
    light: { wrap: 0.1, lift: 0.04 },
    fragPars: /* glsl */ `
uniform sampler2D uBrushed;
uniform vec3 uMetal;
uniform vec3 uResidue;
uniform float uResidueFrom;
uniform float uToolLength;
`,
    surface: /* glsl */ `
SetTri t = setTriSetup(setP, setN, 48.0);
vec4 b = setTriSample(uBrushed, t);
float scratch = b.b;
float smudge = b.a;
vec3 col = uMetal * (0.92 + 0.12 * scratch);
setRough += scratch * 0.12 - smudge * 0.08;
vec3 bump = setTriBump(uBrushed, t, setN, 0.7);
// Massinha grudada: poucas manchas arrastadas perto da ponta de trabalho (fração do comprimento em X),
// alongadas no sentido do uso (ruído esticado em X) e mais cheias bem na ponta.
float along = setP.x / uToolLength + 0.5;
vec3 rp = setP * vec3(0.05, 0.22, 0.22);
float blob = clayNoise3(rp) * 0.6 + clayNoise3(rp * 2.3 + 4.1) * 0.25;
float reach = smoothstep(uResidueFrom, 1.0, along);
float residue = smoothstep(0.02, 0.12, blob + reach * 0.55 - 0.42) * step(uResidueFrom, along);
col = mix(col, uResidue, residue);
setMetal -= residue;
setRough += residue * 0.45;
setObjN = normalize(mix(bump, normalize(setN + vec3(clayNoise3(setP * 0.9) * 0.25)), residue));
diffuseColor.rgb = col;
`,
  });
}

export function wireMaterial(tex, { color = '#B7BCC2', name = 'arame' } = {}) {
  const uniforms = { uBrushed: { value: tex.brushed }, uWire: { value: linear(color) } };
  return createSetMaterial({
    name,
    physical: true,
    params: { color: 0xffffff, roughness: 0.3, metalness: 1, anisotropy: 0.7 },
    uniforms,
    light: { wrap: 0.1, lift: 0.04 },
    fragPars: 'uniform sampler2D uBrushed;\nuniform vec3 uWire;',
    surface: /* glsl */ `
vec2 wuv = vec2(setUv.x / 40.0, setUv.y * 0.25);
vec4 b = texture(uBrushed, wuv);
float oxid = smoothstep(0.35, 0.7, clayNoise3(vec3(setUv.x * 0.08, setUv.y * 3.0, 1.7)) * 0.5 + 0.5);
vec3 col = uWire * (0.94 + 0.1 * b.b) * mix(1.0, 0.72, oxid * 0.5);
setRough += oxid * 0.18 + b.b * 0.06;
mat3 tbn = setCotangentFrame(setN, setP, setUv * vec2(1.0, 6.2831853));
setObjN = normalize(tbn * vec3((b.rg * 2.0 - 1.0) * 0.6, 1.0));
diffuseColor.rgb = col;
`,
  });
}

export function chromeMaterial(tex, { name = 'cromado' } = {}) {
  return createSetMaterial({
    name,
    params: { color: '#CDD1D6', roughness: 0.16, metalness: 1 },
    uniforms: { uBrushed: { value: tex.brushed } },
    light: { wrap: 0.05, lift: 0.03 },
    fragPars: 'uniform sampler2D uBrushed;',
    surface: /* glsl */ `
SetTri t = setTriSetup(setP, setN, 30.0);
vec4 b = setTriSample(uBrushed, t);
setRough += b.b * 0.18 + b.a * 0.06;
setObjN = setTriBump(uBrushed, t, setN, 0.25);
`,
  });
}

export function blackMetalMaterial(tex, { color = '#1D1B1A', name = 'metal-preto' } = {}) {
  return createSetMaterial({
    name,
    params: { color: 0xffffff, roughness: 0.52, metalness: 0.35 },
    uniforms: { uBrushed: { value: tex.brushed }, uPaint: { value: linear(color) } },
    light: { wrap: 0.2, lift: 0.05 },
    fragPars: 'uniform sampler2D uBrushed;\nuniform vec3 uPaint;',
    surface: /* glsl */ `
SetTri t = setTriSetup(setP, setN, 40.0);
vec4 b = setTriSample(uBrushed, t);
// Tinta lascada nos riscos: aparece o metal por baixo (mais claro, metálico e liso).
float chip = smoothstep(0.35, 0.75, b.b);
vec3 col = mix(uPaint * (0.9 + 0.2 * b.a), vec3(0.55, 0.56, 0.58), chip);
setMetal += chip * 0.6;
setRough += -chip * 0.2 + b.a * 0.06;
setObjN = setTriBump(uBrushed, t, setN, 0.3);
diffuseColor.rgb = col;
`,
  });
}
