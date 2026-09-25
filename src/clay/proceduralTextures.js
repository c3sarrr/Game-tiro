// "Forno" de texturas procedurais na GPU: renderiza um shader de tela cheia num render target e usa a
// textura resultante (com mipmaps, repetível). Nada de imagem baixada: tudo nasce de código no carregamento.
// Passes intermediários (ex.: campo de altura antes das normais) usam alvo HalfFloat sem mipmaps.

import * as THREE from 'three';

const VERTEX = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = position.xy * 0.5 + 0.5;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

let triangle = null;
function fullscreenTriangle() {
  if (!triangle) {
    triangle = new THREE.BufferGeometry();
    // Um triângulo que cobre a tela inteira (menos custo que um quad).
    triangle.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
  }
  return triangle;
}

const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

/**
 * Assa uma textura (quadrada por padrão).
 * @param {THREE.WebGLRenderer} renderer
 * @param {{size:number, height?:number, fragmentShader:string, uniforms?:object, mipmaps?:boolean, name?:string,
 *          colorSpace?:string, anisotropy?:number, wrap?:number, type?:number, filter?:number}} opts
 * @returns {THREE.WebGLRenderTarget} alvo cuja `.texture` é a textura pronta (liberar com .dispose())
 */
export function bakeTexture(renderer, {
  size,
  height = size,
  fragmentShader,
  uniforms = {},
  mipmaps = true,
  name = 'massacre.procedural',
  colorSpace = THREE.NoColorSpace,
  anisotropy = 1,
  wrap = THREE.RepeatWrapping,
  type = THREE.UnsignedByteType,
  filter = THREE.LinearFilter,
}) {
  const rt = new THREE.WebGLRenderTarget(size, height, {
    type,
    format: THREE.RGBAFormat,
    depthBuffer: false,
    stencilBuffer: false,
    generateMipmaps: mipmaps,
    minFilter: mipmaps ? THREE.LinearMipmapLinearFilter : filter,
    magFilter: filter,
    wrapS: wrap,
    wrapT: wrap,
    colorSpace,
  });
  rt.texture.name = name;
  rt.texture.anisotropy = anisotropy;
  const material = new THREE.ShaderMaterial({
    vertexShader: VERTEX,
    fragmentShader,
    uniforms: { uResolution: { value: new THREE.Vector2(size, height) }, ...uniforms },
    depthTest: false,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(fullscreenTriangle(), material);
  mesh.frustumCulled = false;
  const prevTarget = renderer.getRenderTarget();
  const prevAutoClear = renderer.autoClear;
  renderer.autoClear = true;
  renderer.setRenderTarget(rt);
  renderer.render(mesh, camera);
  renderer.setRenderTarget(prevTarget);
  renderer.autoClear = prevAutoClear;
  material.dispose();
  return rt;
}

/**
 * Forno em dois passes: o primeiro gera um campo (altura, máscaras) em HalfFloat; o segundo lê esse campo
 * (uniform `uField`) e produz a textura final. O alvo intermediário é liberado ao final.
 */
export function bakeTwoPass(renderer, { size, fieldShader, fieldUniforms = {}, finalShader, finalUniforms = {}, ...opts }) {
  const field = bakeTexture(renderer, {
    size,
    fragmentShader: fieldShader,
    uniforms: fieldUniforms,
    mipmaps: false,
    name: `${opts.name ?? 'massacre.procedural'}.field`,
    type: THREE.HalfFloatType,
    filter: THREE.NearestFilter,
  });
  const out = bakeTexture(renderer, {
    size,
    fragmentShader: finalShader,
    uniforms: { uField: { value: field.texture }, ...finalUniforms },
    ...opts,
  });
  field.dispose();
  return out;
}

/** Lê uma textura assada de volta para a CPU (testes e diagnóstico no console). */
export function readBack(renderer, rt) {
  const { width, height } = rt;
  const out = new Uint8Array(width * height * 4);
  renderer.readRenderTargetPixels(rt, 0, 0, width, height, out);
  return out;
}
