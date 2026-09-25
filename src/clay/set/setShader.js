// Construtor comum dos materiais do set (seção 0.13 "Materiais do set"): cada material tem o seu shader
// (trechos GLSL próprios de albedo, rugosidade, metal, relevo e emissão), mas todos passam pela mesma luz
// suave de estúdio (src/render/glsl/studioLight.js) e pelo mesmo encanamento de espaço do objeto.
//
// Variáveis disponíveis nos trechos de fragment (depois de <color_fragment>):
//   setP     posição no espaço do objeto (vec3)       setN     normal geométrica do objeto (vec3, normalizada)
//   setUv    uv da geometria (vec2; 0 se não houver)  setObjN  normal perturbada no espaço do objeto (escrever)
//   setRough ajuste somado à rugosidade (float)       setMetal ajuste somado ao metal (float)
//   setEmit  emissão somada (vec3)                    setCoat  multiplicador do clearcoat (float, 1)
// Os trechos de rugosidade/metal/emissão podem ser só atribuições a essas variáveis no trecho de albedo.

import * as THREE from 'three';
import { NOISE_GLSL } from '../glsl/noise.js';
import { objectSpaceVaryings, objectSpaceVertex, objectToViewNormal, TRIPLANAR_GLSL } from '../../render/glsl/objectSpace.js';
import { createStudioLightUniforms, patchStudioLight } from '../../render/glsl/studioLight.js';
import { hashString } from '../../core/rng.js';

const materials = new Set();

// Funções comuns a todos os materiais do set.
const SET_COMMON_GLSL = /* glsl */ `
// Base tangente no espaço do objeto a partir das derivadas de tela de uma coordenada (Schüler 2013):
// relevo por UV sem atributo de tangente.
mat3 setCotangentFrame(vec3 N, vec3 p, vec2 uv) {
  vec3 dp1 = dFdx(p);
  vec3 dp2 = dFdy(p);
  vec2 duv1 = dFdx(uv);
  vec2 duv2 = dFdy(uv);
  vec3 dp2perp = cross(dp2, N);
  vec3 dp1perp = cross(N, dp1);
  vec3 T = dp2perp * duv1.x + dp1perp * duv2.x;
  vec3 B = dp2perp * duv1.y + dp1perp * duv2.y;
  float invmax = inversesqrt(max(max(dot(T, T), dot(B, B)), 1e-20));
  return mat3(T * invmax, B * invmax, N);
}
// Triplanar com correção de sinal (Ben Golus): uv X = zy, Y = xz, Z = xy; U segue o eixo X do objeto nas
// projeções Y e Z (escovado de metal e veio de madeira correm ao longo de X).
struct SetTri { vec2 uvX; vec2 uvY; vec2 uvZ; vec3 w; vec3 s; };
SetTri setTriSetup(vec3 p, vec3 n, float scale) {
  SetTri t;
  t.s = vec3(n.x < 0.0 ? -1.0 : 1.0, n.y < 0.0 ? -1.0 : 1.0, n.z < 0.0 ? -1.0 : 1.0);
  vec3 q = p / scale;
  t.uvX = vec2(q.z * t.s.x, q.y);
  t.uvY = vec2(q.x * t.s.y, q.z);
  t.uvZ = vec2(-q.x * t.s.z, q.y);
  t.w = osTriWeights(n);
  return t;
}
vec4 setTriSample(sampler2D tex, SetTri t) {
  return texture(tex, t.uvX) * t.w.x + texture(tex, t.uvY) * t.w.y + texture(tex, t.uvZ) * t.w.z;
}
// Normal do objeto a partir das três amostras (xy já decodificados em -1..1, escalados pela força).
vec3 setTriNormal(SetTri t, vec3 n, vec2 dX, vec2 dY, vec2 dZ) {
  vec3 tX = vec3(dX.x * t.s.x, dX.y, 1.0);
  vec3 tY = vec3(dY.x * t.s.y, dY.y, 1.0);
  vec3 tZ = vec3(dZ.x * -t.s.z, dZ.y, 1.0);
  tX = vec3(tX.xy + n.zy, abs(tX.z) * n.x);
  tY = vec3(tY.xy + n.xz, abs(tY.z) * n.y);
  tZ = vec3(tZ.xy + n.xy, abs(tZ.z) * n.z);
  return normalize(tX.zyx * t.w.x + tY.xzy * t.w.y + tZ.xyz * t.w.z);
}
// Relevo triplanar direto de uma textura "normal xy" (RG), com força.
vec3 setTriBump(sampler2D tex, SetTri t, vec3 n, float strength) {
  vec2 dX = (texture(tex, t.uvX).rg * 2.0 - 1.0) * strength;
  vec2 dY = (texture(tex, t.uvY).rg * 2.0 - 1.0) * strength;
  vec2 dZ = (texture(tex, t.uvZ).rg * 2.0 - 1.0) * strength;
  return setTriNormal(t, n, dX, dY, dZ);
}
// Linha de grade anti-serrilhada em unidades de mundo: cobre ao menos meio pixel (com intensidade
// compensada) e, de longe, vira a cobertura média — sem moiré no tapete de corte.
float setGridLine(float coord, float spacing, float halfWidth) {
  float fw = max(fwidth(coord), 1e-5);
  float d = abs(fract(coord / spacing + 0.5) - 0.5) * spacing;
  float w = max(halfWidth, fw * 0.5);
  float cov = clamp((w - d) / fw + 0.5, 0.0, 1.0) * (halfWidth / w);
  float avg = 2.0 * halfWidth / spacing;
  return mix(cov, avg, smoothstep(0.25, 0.6, fw / spacing));
}
`;

/** Materiais do set vivos (para ajustes globais, ex.: anisotropia). */
export function liveSetMaterials() {
  return materials;
}

/**
 * @param {object} def
 * @param {string} def.name nome do material (aparece no inspetor e na chave de cache)
 * @param {boolean} [def.physical] MeshPhysicalMaterial (clearcoat/anisotropia) em vez de MeshStandardMaterial
 * @param {object} [def.params] parâmetros do material do three (color, roughness, metalness, side...)
 * @param {object} [def.uniforms] uniforms extras (texturas, parâmetros ajustáveis)
 * @param {string} [def.vertexPars] declarações extras do vertex (atributos, varyings)
 * @param {string} [def.vertex] código extra do vertex (depois do encanamento; pode ler atributos)
 * @param {string} [def.fragPars] declarações/funções do fragment
 * @param {string} [def.surface] trecho que escreve diffuseColor, setObjN, setRough, setMetal, setEmit
 * @param {{wrap?:number, lift?:number, translucency?:number}} [def.light] luz suave de estúdio
 */
export function createSetMaterial({
  name,
  physical = false,
  params = {},
  uniforms = {},
  vertexPars = '',
  vertex = '',
  fragPars = '',
  surface = '',
  light = {},
}) {
  const Base = physical ? THREE.MeshPhysicalMaterial : THREE.MeshStandardMaterial;
  const material = new Base(params);
  material.name = `massacre.set.${name}`;
  material.isSetMaterial = true;
  material.setUniforms = uniforms;
  material.lightUniforms = createStudioLightUniforms(light);
  // Mesmo GLSL → mesmo programa (dois papelões de cores diferentes compartilham o shader).
  const programKey = `set:${hashString(vertexPars + vertex + fragPars + surface)}`;
  material.customProgramCacheKey = () => programKey;
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    patchStudioLight(shader, material.lightUniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${objectSpaceVaryings('Set')}\nvarying vec2 vSetUv;\n${vertexPars}`)
      // O prefixo do three sempre declara `attribute vec2 uv` (vale (0,0) se a geometria não tiver uv).
      .replace('#include <defaultnormal_vertex>', objectSpaceVertex('Set', `vSetUv = uv;\n  ${vertex}`));
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${objectSpaceVaryings('Set')}\nvarying vec2 vSetUv;\n${NOISE_GLSL}\n${TRIPLANAR_GLSL}\n${SET_COMMON_GLSL}\n${fragPars}`)
      .replace('#include <color_fragment>', `#include <color_fragment>
vec3 setP = vSetPos;
vec3 setN = normalize(vSetNrm);
vec2 setUv = vSetUv;
vec3 setObjN = setN;
float setRough = 0.0;
float setMetal = 0.0;
float setCoat = 1.0;
vec3 setEmit = vec3(0.0);
{
${surface}
}`)
      .replace('#include <lights_physical_fragment>', `#include <lights_physical_fragment>
#ifdef USE_CLEARCOAT
  material.clearcoat *= setCoat;
#endif`)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = clamp(roughnessFactor + setRough, 0.04, 1.0);')
      .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\nmetalnessFactor = clamp(metalnessFactor + setMetal, 0.0, 1.0);')
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
normal = ${objectToViewNormal('Set', 'setObjN')};
#ifdef DOUBLE_SIDED
  normal *= faceDirection;
#endif`)
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += setEmit;');
  };
  const dispose = material.dispose.bind(material);
  material.dispose = () => {
    materials.delete(material);
    dispose();
  };
  materials.add(material);
  return material;
}
