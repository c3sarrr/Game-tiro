// Peças comuns dos passes de pós-processamento (src/render/passes/*): alvos de renderização, material de
// tela cheia e trechos GLSL (luminância, profundidade linear, hash sem seno). Os passes seguem a interface
// Pass de three/addons (render(renderer, writeBuffer, readBuffer, deltaTime)) e leem o contexto do quadro
// (câmera, textura de profundidade da cena, pose stop-motion) do objeto `ctx` do PostPipeline.

import * as THREE from 'three';
import { FullScreenQuad } from 'three/addons/postprocessing/Pass.js';

/** Vértice de tela cheia (o FullScreenQuad do three já está em espaço de recorte com câmera ortográfica). */
export const FULLSCREEN_VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

/**
 * GLSL compartilhado. Depende de <common> (saturate, PI) — incluído nos materiais via `#include <common>`.
 * (O chunk <packing> fica de fora: nenhum passe usa empacotamento e o compilador HLSL do ANGLE avisa sobre as
 * constantes 255/256 dele em todo programa que o inclui.)
 */
export const POST_GLSL = /* glsl */ `
const vec3 POST_LUMA = vec3(0.2126, 0.7152, 0.0722);
float postLuma(vec3 c) { return dot(c, POST_LUMA); }
// Distância ao longo do eixo da câmera (positiva) a partir do valor do depth buffer (projeção perspectiva).
float postLinearDepth(float d, float near, float far) {
  return near * far / (far - d * (far - near));
}
// Hash sem seno (Dave Hoskins): estável em todas as GPUs, sem padrões de precisão.
float postHash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
// Ruído de gradiente intercalado (Jimenez 2014, "Next Generation Post Processing in Call of Duty: AW"): cada
// vizinhança 3×3 cobre o intervalo quase por igual, então um filtro 3×3 depois dele cancela o padrão.
float postIGN(vec2 p) {
  return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715))));
}
vec3 postHash32(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
  p3 += dot(p3, p3.yxz + 33.33);
  return fract((p3.xxy + p3.yzz) * p3.zyx);
}
`;

/**
 * Alvo de renderização dos passes (sem profundidade, sem mipmaps).
 * @param {number} w @param {number} h
 * @param {{type?:THREE.TextureDataType, filter?:THREE.MagnificationTextureFilter, name?:string}} [opts]
 */
export function makeTarget(w, h, { type = THREE.HalfFloatType, filter = THREE.LinearFilter, name = 'massacre.post' } = {}) {
  const rt = new THREE.WebGLRenderTarget(Math.max(1, w), Math.max(1, h), {
    type,
    format: THREE.RGBAFormat,
    minFilter: filter,
    magFilter: filter,
    depthBuffer: false,
    stencilBuffer: false,
    generateMipmaps: false,
  });
  rt.texture.name = name;
  return rt;
}

/**
 * Material de tela cheia: sem profundidade, sem mistura (a não ser que peça), com <common> e o GLSL comum.
 * @param {{name:string, uniforms?:object, defines?:object, fragmentShader:string, blending?:THREE.Blending,
 *   vertexShader?:string}} def
 */
export function postMaterial({ name, uniforms = {}, defines = {}, fragmentShader, blending = THREE.NoBlending, vertexShader = FULLSCREEN_VERT }) {
  const material = new THREE.ShaderMaterial({
    name: `massacre.post.${name}`,
    uniforms,
    defines,
    vertexShader,
    fragmentShader: `#include <common>\n${POST_GLSL}\n${fragmentShader}`,
    blending,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
  });
  return material;
}

/** Desenha um quad de tela cheia com `material` em `target` (null = tela). */
export function drawQuad(renderer, quad, material, target) {
  renderer.setRenderTarget(target);
  quad.material = material;
  quad.render(renderer);
}

export { FullScreenQuad };

/** Tamanho de meia/quarta resolução sem zerar. */
export function scaledSize(width, height, scale) {
  return [Math.max(1, Math.round(width * scale)), Math.max(1, Math.round(height * scale))];
}

/** Cor hex (sRGB) → Vector3 linear, para tintas aplicadas em HDR (antes do tone mapping). */
export function linearColorVec(hex, out = new THREE.Vector3()) {
  const c = new THREE.Color(hex);
  return out.set(c.r, c.g, c.b);
}

const _rgb = { r: 0, g: 0, b: 0 };

/** Cor hex → Vector3 em espaço de exibição (sRGB), para tintas aplicadas depois do tone mapping. */
export function displayColorVec(hex, out = new THREE.Vector3()) {
  new THREE.Color(hex).getRGB(_rgb, THREE.SRGBColorSpace);
  return out.set(_rgb.r, _rgb.g, _rgb.b);
}
