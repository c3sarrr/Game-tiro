// Bloom só nas luzes (seção 0.13: "bloom leve só nas luzes"; moodboard item 9, SMA9/SMA6/TSH11/TSH14).
// Cadeia de mips em HDR (Jimenez 2014, "Next Generation Post Processing in Call of Duty: Advanced Warfare"):
//  1. Pré-filtro 1/2: filtro de 13 amostras com média de Karis por grupo (mata vaga-lumes de brilho de
//     clearcoat e flocos de glitter) + limiar suave com joelho: painéis de softbox/lâmpadas (radiância 3–14)
//     passam, massinha iluminada (~1) não.
//  2. Descida 1/4 … 1/64 com o mesmo filtro de 13 amostras.
//  3. Subida com tenda 3×3 somada (mistura aditiva) ao mip de cima: halo largo e macio.
//  4. Composição: cena + halo × intensidade × tinta âmbar (halação de filme em volta do tungstênio).

import * as THREE from 'three';
import { Pass } from 'three/addons/postprocessing/Pass.js';
import { BLOOM } from '../../data/postFx.js';
import { FullScreenQuad, drawQuad, linearColorVec, makeTarget, postMaterial } from './common.js';

const DOWN_FRAG = /* glsl */ `
uniform sampler2D tSrc;
uniform vec2 uTexel; // 1 / tamanho da fonte
uniform float uThreshold;
uniform float uKnee;
uniform float uMax;
varying vec2 vUv;
vec3 tap(vec2 o) {
  return min(texture(tSrc, vUv + o * uTexel).rgb, vec3(uMax));
}
float karis(vec3 c) {
  return 1.0 / (1.0 + postLuma(c));
}
void main() {
  vec3 a = tap(vec2(-2.0, 2.0));
  vec3 b = tap(vec2(0.0, 2.0));
  vec3 c = tap(vec2(2.0, 2.0));
  vec3 d = tap(vec2(-2.0, 0.0));
  vec3 e = tap(vec2(0.0, 0.0));
  vec3 f = tap(vec2(2.0, 0.0));
  vec3 g = tap(vec2(-2.0, -2.0));
  vec3 h = tap(vec2(0.0, -2.0));
  vec3 i = tap(vec2(2.0, -2.0));
  vec3 j = tap(vec2(-1.0, 1.0));
  vec3 k = tap(vec2(1.0, 1.0));
  vec3 l = tap(vec2(-1.0, -1.0));
  vec3 m = tap(vec2(1.0, -1.0));
#ifdef PREFILTER
  // Média de Karis: cada grupo 2×2 pesa pelo inverso da própria luminância.
  vec3 g0 = (j + k + l + m) * 0.25;
  vec3 g1 = (a + b + d + e) * 0.25;
  vec3 g2 = (b + c + e + f) * 0.25;
  vec3 g3 = (d + e + g + h) * 0.25;
  vec3 g4 = (e + f + h + i) * 0.25;
  float w0 = karis(g0) * 0.5;
  float w1 = karis(g1) * 0.125;
  float w2 = karis(g2) * 0.125;
  float w3 = karis(g3) * 0.125;
  float w4 = karis(g4) * 0.125;
  vec3 col = (g0 * w0 + g1 * w1 + g2 * w2 + g3 * w3 + g4 * w4) / (w0 + w1 + w2 + w3 + w4);
  // Limiar suave (curva quadrática no joelho): só a parte acima do limiar vira halo.
  float br = max(col.r, max(col.g, col.b));
  float soft = clamp(br - uThreshold + uKnee, 0.0, 2.0 * uKnee);
  soft = soft * soft / (4.0 * uKnee + 1e-4);
  float contrib = max(soft, br - uThreshold) / max(br, 1e-4);
  gl_FragColor = vec4(col * contrib, 1.0);
#else
  vec3 col = e * 0.125 + (a + c + g + i) * 0.03125 + (b + d + f + h) * 0.0625 + (j + k + l + m) * 0.125;
  gl_FragColor = vec4(col, 1.0);
#endif
}
`;

// Tenda 3×3 lendo o mip menor; a mistura aditiva soma o resultado ao mip de cima.
const UP_FRAG = /* glsl */ `
uniform sampler2D tSrc;
uniform vec2 uTexel;
uniform float uScatter;
varying vec2 vUv;
vec3 tap(vec2 o) {
  return texture(tSrc, vUv + o * uTexel).rgb;
}
void main() {
  vec3 col = tap(vec2(0.0)) * 4.0;
  col += (tap(vec2(0.0, 1.0)) + tap(vec2(-1.0, 0.0)) + tap(vec2(1.0, 0.0)) + tap(vec2(0.0, -1.0))) * 2.0;
  col += tap(vec2(-1.0, 1.0)) + tap(vec2(1.0, 1.0)) + tap(vec2(-1.0, -1.0)) + tap(vec2(1.0, -1.0));
  gl_FragColor = vec4(col * (uScatter / 16.0), 1.0);
}
`;

const COMPOSITE_FRAG = /* glsl */ `
uniform sampler2D tDiffuse;
uniform sampler2D tBloom;
uniform vec2 uBloomTexel;
uniform vec3 uTint;
uniform float uIntensity;
uniform int uView;
varying vec2 vUv;
vec3 tap(vec2 o) {
  return texture(tBloom, vUv + o * uBloomTexel).rgb;
}
void main() {
  // Tenda na meia resolução ao subir para a tela: sem blocos de bilinear no halo.
  vec3 halo = tap(vec2(0.0)) * 4.0;
  halo += (tap(vec2(0.0, 1.0)) + tap(vec2(-1.0, 0.0)) + tap(vec2(1.0, 0.0)) + tap(vec2(0.0, -1.0))) * 2.0;
  halo += tap(vec2(-1.0, 1.0)) + tap(vec2(1.0, 1.0)) + tap(vec2(-1.0, -1.0)) + tap(vec2(1.0, -1.0));
  halo *= uIntensity / 16.0;
  halo *= uTint;
  if (uView == 1) {
    gl_FragColor = vec4(halo, 1.0);
    return;
  }
  vec4 scene = texture(tDiffuse, vUv);
  gl_FragColor = vec4(scene.rgb + halo, scene.a);
}
`;

export class BloomPass extends Pass {
  constructor() {
    super();
    this.needsSwap = true;
    this.width = 1;
    this.height = 1;
    this.intensityScale = 1;
    this.view = 0;
    this.mips = [];
    this.levels = 0;
    this.prefilter = postMaterial({
      name: 'bloom-prefilter',
      defines: { PREFILTER: '' },
      uniforms: {
        tSrc: { value: null },
        uTexel: { value: new THREE.Vector2() },
        uThreshold: { value: BLOOM.threshold },
        uKnee: { value: BLOOM.knee },
        uMax: { value: BLOOM.maxBrightness },
      },
      fragmentShader: DOWN_FRAG,
    });
    this.down = postMaterial({
      name: 'bloom-down',
      uniforms: {
        tSrc: { value: null },
        uTexel: { value: new THREE.Vector2() },
        uThreshold: { value: 0 },
        uKnee: { value: 1 },
        uMax: { value: 1e4 },
      },
      fragmentShader: DOWN_FRAG,
    });
    this.up = postMaterial({
      name: 'bloom-up',
      uniforms: {
        tSrc: { value: null },
        uTexel: { value: new THREE.Vector2() },
        uScatter: { value: BLOOM.scatter },
      },
      fragmentShader: UP_FRAG,
      blending: THREE.AdditiveBlending,
    });
    // Aditiva pura (ONE, ONE): o three com AdditiveBlending multiplicaria a fonte pelo alfa.
    this.up.blending = THREE.CustomBlending;
    this.up.blendEquation = THREE.AddEquation;
    this.up.blendSrc = THREE.OneFactor;
    this.up.blendDst = THREE.OneFactor;
    this.composite = postMaterial({
      name: 'bloom-composite',
      uniforms: {
        tDiffuse: { value: null },
        tBloom: { value: null },
        uBloomTexel: { value: new THREE.Vector2() },
        uTint: { value: linearColorVec(BLOOM.tint) },
        uIntensity: { value: BLOOM.intensity },
        uView: { value: 0 },
      },
      fragmentShader: COMPOSITE_FRAG,
    });
    this.quad = new FullScreenQuad(null);
  }

  /** Multiplicador de intensidade do contexto de câmera (jogo/menu/killcam/vitrine). */
  setIntensityScale(k) {
    this.intensityScale = k;
  }

  setView(showBloom) {
    this.view = showBloom ? 1 : 0;
  }

  setSize(width, height) {
    this.width = width;
    this.height = height;
    // Quantos mips cabem: o menor precisa ter ao menos ~8 px no lado curto.
    const maxLevels = Math.max(1, Math.floor(Math.log2(Math.max(1, Math.min(width, height)))) - 3);
    const levels = Math.min(BLOOM.levels, maxLevels);
    while (this.mips.length < levels) this.mips.push(makeTarget(1, 1, { name: `massacre.bloom.${this.mips.length}` }));
    while (this.mips.length > levels) this.mips.pop().dispose();
    this.levels = levels;
    for (let i = 0; i < levels; i++) {
      const s = 2 ** (i + 1);
      this.mips[i].setSize(Math.max(1, Math.floor(width / s)), Math.max(1, Math.floor(height / s)));
    }
  }

  render(renderer, writeBuffer, readBuffer) {
    const q = this.quad;
    // Descida: cena → mip 0 (pré-filtro) → mip 1 → … → mip n-1.
    this.prefilter.uniforms.tSrc.value = readBuffer.texture;
    this.prefilter.uniforms.uTexel.value.set(1 / readBuffer.width, 1 / readBuffer.height);
    drawQuad(renderer, q, this.prefilter, this.mips[0]);
    for (let i = 1; i < this.levels; i++) {
      const src = this.mips[i - 1];
      this.down.uniforms.tSrc.value = src.texture;
      this.down.uniforms.uTexel.value.set(1 / src.width, 1 / src.height);
      drawQuad(renderer, q, this.down, this.mips[i]);
    }
    // Subida: soma a tenda do mip menor no de cima (o alvo não é limpo: a mistura aditiva guarda a descida).
    const autoClear = renderer.autoClear;
    renderer.autoClear = false;
    for (let i = this.levels - 1; i > 0; i--) {
      const src = this.mips[i];
      this.up.uniforms.tSrc.value = src.texture;
      this.up.uniforms.uTexel.value.set(1 / src.width, 1 / src.height);
      drawQuad(renderer, q, this.up, this.mips[i - 1]);
    }
    renderer.autoClear = autoClear;

    const c = this.composite.uniforms;
    c.tDiffuse.value = readBuffer.texture;
    c.tBloom.value = this.mips[0].texture;
    c.uBloomTexel.value.set(1 / this.mips[0].width, 1 / this.mips[0].height);
    c.uIntensity.value = BLOOM.intensity * this.intensityScale;
    c.uView.value = this.view;
    drawQuad(renderer, q, this.composite, this.renderToScreen ? null : writeBuffer);
  }

  dispose() {
    for (const rt of this.mips) rt.dispose();
    this.mips = [];
    this.prefilter.dispose();
    this.down.dispose();
    this.up.dispose();
    this.composite.dispose();
    this.quad.dispose();
  }
}
