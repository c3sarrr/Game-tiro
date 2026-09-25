// Iluminação "suave de estúdio" compartilhada pelos materiais do set (papelão, fita, balsa, metal, plástico,
// tapete) — seção 0.13: "cada um com shader próprio, todos com a mesma iluminação suave".
//  - Difuso com wrap (a luz "abraça" a forma como sob softbox grande, SSD14/CSD14).
//  - Especular GGX com alargamento por tamanho de fonte (luz de área aproximada, Karis 2013): reflexo de
//    softbox, não de lâmpada nua. Vale também para o clearcoat.
//  - Piso de sombra: nada fica preto; as sombras puxam para um tom mais escuro e saturado da própria cor.
// Uso: patchStudioLight(shader, { wrap, lift }) dentro do onBeforeCompile de um MeshStandard/MeshPhysical.

import { studioGlobals } from '../studioGlobals.js';

export const STUDIO_BRDF_GLSL = /* glsl */ `
uniform float uStudioSourceAngle;
// GGX com lóbulo alargado pelo tamanho angular da fonte e normalização de energia (α/α')².
vec3 studioGGX(const in vec3 L, const in vec3 V, const in vec3 N, const in vec3 f0, const in float f90, const in float roughness) {
  float alpha = pow2(roughness);
  float alphaW = saturate(alpha + uStudioSourceAngle * 0.5);
  vec3 H = normalize(L + V);
  float dotNL = saturate(dot(N, L));
  float dotNV = saturate(dot(N, V));
  float dotNH = saturate(dot(N, H));
  float dotVH = saturate(dot(V, H));
  vec3 F = F_Schlick(f0, f90, dotVH);
  float Vis = V_GGX_SmithCorrelated(alpha, dotNL, dotNV);
  float D = D_GGX(alphaW, dotNH) * pow2(alpha / alphaW);
  return F * (Vis * D);
}
`;

const SOFT_PARS = /* glsl */ `
#include <lights_physical_pars_fragment>
${STUDIO_BRDF_GLSL}
uniform float uSoftWrap;
uniform float uSoftTranslucency;
void RE_Direct_Soft(const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal,
    const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material,
    inout ReflectedLight reflectedLight) {
  float NL = dot(geometryNormal, directLight.direction);
  float dotNL = saturate(NL);
  float wrapNL = saturate((NL + uSoftWrap) / (1.0 + uSoftWrap));
  vec3 irradiance = dotNL * directLight.color;
  // Material fino (fita crepe, borda de pote plástico): luz que atravessa vinda de trás + brilho de contraluz
  // na silhueta, na cor da própria superfície.
  if (uSoftTranslucency > 0.0) {
    float through = saturate(-NL) * 0.6;
    float backRim = pow(saturate(dot(geometryViewDir, -directLight.direction)), 4.0)
      * pow(1.0 - saturate(dot(geometryNormal, geometryViewDir)), 2.0);
    reflectedLight.directDiffuse += (through + backRim) * uSoftTranslucency * directLight.color
      * BRDF_Lambert(material.diffuseContribution);
  }
  #ifdef USE_CLEARCOAT
    float dotNLcc = saturate(dot(geometryClearcoatNormal, directLight.direction));
    clearcoatSpecularDirect += dotNLcc * directLight.color * studioGGX(directLight.direction, geometryViewDir,
      geometryClearcoatNormal, material.clearcoatF0, material.clearcoatF90, material.clearcoatRoughness);
  #endif
  float energy = 1.0;
  #ifdef USE_SHEEN
    // Tecido (softbox): brilho aveludado de fibra, com a mesma compensação de energia do three.
    sheenSpecularDirect += irradiance * BRDF_Sheen(directLight.direction, geometryViewDir, geometryNormal,
      material.sheenColor, material.sheenRoughness);
    float sheenAlbedoV = IBLSheenBRDF(geometryNormal, geometryViewDir, material.sheenRoughness);
    float sheenAlbedoL = IBLSheenBRDF(geometryNormal, directLight.direction, material.sheenRoughness);
    energy = 1.0 - max3(material.sheenColor) * max(sheenAlbedoV, sheenAlbedoL);
    irradiance *= energy;
  #endif
  reflectedLight.directSpecular += irradiance * studioGGX(directLight.direction, geometryViewDir, geometryNormal,
    material.specularColorBlended, material.specularF90, material.roughness) * material.multiScatteringCompensation;
  vec3 halfDir = normalize(directLight.direction + geometryViewDir);
  vec3 F = F_Schlick(material.specularColor, material.specularF90, saturate(dot(geometryViewDir, halfDir)));
  reflectedLight.directDiffuse += wrapNL * energy * directLight.color * BRDF_Lambert(material.diffuseContribution) * (1.0 - F);
}
#undef RE_Direct
#define RE_Direct RE_Direct_Soft
`;

const SHADOW_FLOOR = /* glsl */ `
{
  // Piso de sombra: tom escuro e saturado da própria cor (o set nunca fica preto).
  vec3 softDeep = pow(max(diffuseColor.rgb, vec3(1e-4)), vec3(1.6));
  outgoingLight = max(outgoingLight, softDeep * uSoftLift);
  float softL = dot(outgoingLight, vec3(0.2126, 0.7152, 0.0722));
  float softDark = 1.0 - smoothstep(0.0, 0.3, softL);
  outgoingLight = max(mix(vec3(softL), outgoingLight, 1.0 + 0.3 * softDark), vec3(0.0));
}
#include <opaque_fragment>
`;

/**
 * Uniforms da luz suave de um material (criados uma vez e reaproveitados a cada recompilação, para que ajustes
 * ao vivo não se percam quando o three recompila o programa).
 * @param {{wrap?:number, lift?:number, translucency?:number}} opts wrap do difuso (0 = Lambert), piso de sombra
 *   (fração do albedo) e translucidez de material fino
 */
export function createStudioLightUniforms({ wrap = 0.3, lift = 0.05, translucency = 0 } = {}) {
  return {
    uSoftWrap: { value: wrap },
    uSoftLift: { value: lift },
    uSoftTranslucency: { value: translucency },
  };
}

/**
 * Aplica a luz suave de estúdio a um shader do three (MeshStandard/MeshPhysical) no onBeforeCompile.
 * @param {object} shader parâmetro do onBeforeCompile
 * @param {ReturnType<typeof createStudioLightUniforms>} uniforms uniforms do material
 */
export function patchStudioLight(shader, uniforms) {
  Object.assign(shader.uniforms, uniforms, studioGlobals);
  shader.fragmentShader = shader.fragmentShader
    .replace('#include <common>', '#include <common>\nuniform float uSoftLift;')
    .replace('#include <lights_physical_pars_fragment>', SOFT_PARS)
    .replace('#include <opaque_fragment>', SHADOW_FLOOR);
}
