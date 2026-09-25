// Encanamento de espaço do objeto para shaders de material (massinha e set): posição e normal do objeto
// chegam ao fragment (padrões procedurais que "grudam" na peça, triplanar), junto com os eixos X/Y/Z do
// objeto levados ao espaço de visão pelo mesmo caminho das normais do three (pele → batching → instância →
// normalMatrix). Com eles, uma normal perturbada no espaço do objeto vira normal de visão sem tangentes.
// `prefix` evita colisão de nomes entre sistemas (vClayPos, vSetPos...).

/** Declarações de varyings (vertex e fragment). */
export function objectSpaceVaryings(prefix) {
  return /* glsl */ `
varying vec3 v${prefix}Pos;
varying vec3 v${prefix}Nrm;
varying vec3 v${prefix}Ax;
varying vec3 v${prefix}Ay;
varying vec3 v${prefix}Az;
`;
}

/** Substitui `#include <defaultnormal_vertex>`: mantém o chunk e preenche os varyings. `extra` roda no fim. */
export function objectSpaceVertex(prefix, extra = '') {
  return /* glsl */ `
#include <defaultnormal_vertex>
{
  vec3 osAx = vec3(1.0, 0.0, 0.0);
  vec3 osAy = vec3(0.0, 1.0, 0.0);
  vec3 osAz = vec3(0.0, 0.0, 1.0);
  #ifdef USE_SKINNING
    osAx = (skinMatrix * vec4(osAx, 0.0)).xyz;
    osAy = (skinMatrix * vec4(osAy, 0.0)).xyz;
    osAz = (skinMatrix * vec4(osAz, 0.0)).xyz;
  #endif
  #ifdef USE_BATCHING
    mat3 osBm = mat3(batchingMatrix);
    vec3 osBs = vec3(dot(osBm[0], osBm[0]), dot(osBm[1], osBm[1]), dot(osBm[2], osBm[2]));
    osAx = osBm * (osAx / osBs); osAy = osBm * (osAy / osBs); osAz = osBm * (osAz / osBs);
  #endif
  #ifdef USE_INSTANCING
    mat3 osIm = mat3(instanceMatrix);
    vec3 osIs = vec3(dot(osIm[0], osIm[0]), dot(osIm[1], osIm[1]), dot(osIm[2], osIm[2]));
    osAx = osIm * (osAx / osIs); osAy = osIm * (osAy / osIs); osAz = osIm * (osAz / osIs);
  #endif
  #ifdef FLIP_SIDED
    osAx = -osAx; osAy = -osAy; osAz = -osAz;
  #endif
  v${prefix}Ax = normalMatrix * osAx;
  v${prefix}Ay = normalMatrix * osAy;
  v${prefix}Az = normalMatrix * osAz;
  v${prefix}Pos = position;
  v${prefix}Nrm = normal;
  ${extra}
}
`;
}

/** Expressão GLSL que leva a normal `n` (espaço do objeto) para o espaço de visão. */
export function objectToViewNormal(prefix, n) {
  return `normalize(v${prefix}Ax * (${n}).x + v${prefix}Ay * (${n}).y + v${prefix}Az * (${n}).z)`;
}

/** Pesos triplanares (expoente 4: transição curta entre as projeções). */
export const TRIPLANAR_GLSL = /* glsl */ `
vec3 osTriWeights(vec3 n) {
  vec3 w = pow(abs(n), vec3(4.0));
  return w / max(w.x + w.y + w.z, 1e-5);
}
`;
