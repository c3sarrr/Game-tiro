// Lente e filme da câmera de stop-motion (último passe, em espaço de exibição; moodboard itens 8 e 9):
//  - aberração cromática radial (lente barata; killcam forte, menu sutil, jogo 0 — SMA12, SML3);
//  - grade "massinha": vibrance, contraste em S suave e leve aquecimento (cara de brinquedo — TSH2, TSH4, SMA2);
//  - vinheta que puxa para marrom-quente, nunca preto azulado (SMA8, SMA10, BTS1);
//  - grão de filme por POSE (cada fotograma tem o seu, 12/s), resposta de filme (máximo nos meios-tons) e
//    leve cor (SMA7, SMA9, SMA11, SML4). O grão vem de uma textura de ruído assada uma vez (256², quatro
//    campos independentes), lida em duas oitavas com deslocamento sorteado por pose: 2 leituras por pixel
//    em vez de ~20 hashes — a lente roda em todos os presets, inclusive no celular;
//  - dithering de ½ LSB para o 8 bits não criar faixas nos gradientes escuros.

import * as THREE from 'three';
import { Pass } from 'three/addons/postprocessing/Pass.js';
import { LENS } from '../../data/postFx.js';
import { RNG } from '../../core/rng.js';
import { FullScreenQuad, displayColorVec, drawQuad, postMaterial } from './common.js';

const GRAIN_SIZE = 256;

/**
 * Textura de grão tileável: quatro campos de ruído branco independentes (R = luminância, GBA = cor), com o
 * bilinear fazendo o papel do ruído de valor (grãos de borda macia). Determinística (mesma semente sempre).
 */
function bakeGrainTexture() {
  const rng = new RNG('grao-de-filme');
  const data = new Uint8Array(GRAIN_SIZE * GRAIN_SIZE * 4);
  for (let i = 0; i < data.length; i++) data[i] = Math.floor(rng.next() * 256);
  const tex = new THREE.DataTexture(data, GRAIN_SIZE, GRAIN_SIZE, THREE.RGBAFormat);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearFilter;
  tex.generateMipmaps = false;
  tex.colorSpace = THREE.NoColorSpace;
  tex.name = 'massacre.lens.grain';
  tex.needsUpdate = true;
  return tex;
}

const LENS_FRAG = /* glsl */ `
uniform sampler2D tDiffuse;
uniform sampler2D tGrain;
uniform vec2 uGrainOffset;
uniform vec2 uResolution;
uniform float uAberration;
uniform float uVibrance;
uniform float uContrast;
uniform float uWarmth;
uniform float uVignette;
uniform float uVigInner;
uniform float uVigOuter;
uniform vec3 uVigColor;
uniform float uGrain;
uniform float uGrainSize;
uniform float uGrainChroma;
uniform float uShadowFloor;
uniform float uSeed;
uniform float uDither;
varying vec2 vUv;

void main() {
  vec2 uv = vUv;
  vec2 dc = uv - 0.5;
  float aspect = uResolution.x / uResolution.y;
  vec3 col;
  if (uAberration > 0.0) {
    // Deslocamento radial crescendo com r²: nulo no centro, uAberration (fração da tela) no canto.
    vec2 q = dc * vec2(aspect, 1.0);
    float r2 = dot(q, q) / (0.25 * (aspect * aspect + 1.0));
    vec2 off = dc * (2.0 * uAberration * r2);
    col.r = texture(tDiffuse, uv - off).r;
    col.g = texture(tDiffuse, uv).g;
    col.b = texture(tDiffuse, uv + off).b;
  } else {
    col = texture(tDiffuse, uv).rgb;
  }

  // Grade: vibrance (satura mais o que está menos saturado), S suave e tungstênio.
  float l = postLuma(col);
  float sat = max(col.r, max(col.g, col.b)) - min(col.r, min(col.g, col.b));
  col = clamp(mix(vec3(l), col, 1.0 + uVibrance * (1.0 - sat)), 0.0, 1.0);
  col = mix(col, col * col * (3.0 - 2.0 * col), uContrast);
  col *= vec3(1.0 + uWarmth, 1.0, 1.0 - uWarmth);

  // Vinheta proporcional à tela (canto = 1), puxando para a tinta marrom.
  vec2 vq = dc * vec2(aspect, 1.0) / (0.5 * length(vec2(aspect, 1.0)));
  float v = smoothstep(uVigInner, uVigOuter, length(vq)) * uVignette;
  col = mix(col, col * uVigColor, v);

  // Grão por pose: o deslocamento na textura muda a cada fotograma (12/s); duas oitavas + um pouco de cor.
  if (uGrain > 0.0) {
    vec2 gp = gl_FragCoord.xy / (uGrainSize * 256.0);
    vec4 g1 = texture(tGrain, gp + uGrainOffset);
    float g2 = texture(tGrain, gp * 2.07 + uGrainOffset.yx + 0.37).r;
    float n = (g1.r + 0.5 * g2) * (2.0 / 1.5) - 1.0;
    vec3 cn = g1.gba * 2.0 - 1.0;
    vec3 g = mix(vec3(n), cn, uGrainChroma);
    float lg = postLuma(col);
    float resp = mix(uShadowFloor, 1.0, clamp(4.0 * lg * (1.0 - lg), 0.0, 1.0));
    col += g * (uGrain * resp);
  }

  col += (postHash32(gl_FragCoord.xy + uSeed * 3.7) - 0.5) * (uDither / 255.0);
  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
`;

export class LensPass extends Pass {
  constructor() {
    super();
    this.needsSwap = true;
    this.grain = bakeGrainTexture();
    this.material = postMaterial({
      name: 'lens',
      uniforms: {
        tDiffuse: { value: null },
        tGrain: { value: this.grain },
        uGrainOffset: { value: new THREE.Vector2() },
        uResolution: { value: new THREE.Vector2(1, 1) },
        uAberration: { value: 0 },
        uVibrance: { value: LENS.grade.vibrance },
        uContrast: { value: LENS.grade.contrast },
        uWarmth: { value: LENS.grade.warmth },
        uVignette: { value: 0 },
        uVigInner: { value: LENS.vignette.inner },
        uVigOuter: { value: LENS.vignette.outer },
        uVigColor: { value: displayColorVec(LENS.vignette.color) },
        uGrain: { value: 0 },
        uGrainSize: { value: LENS.grain.size },
        uGrainChroma: { value: LENS.grain.chroma },
        uShadowFloor: { value: LENS.grain.shadowFloor },
        uSeed: { value: 0 },
        uDither: { value: LENS.dither ? 1 : 0 },
      },
      fragmentShader: LENS_FRAG,
    });
    this.quad = new FullScreenQuad(this.material);
  }

  /**
   * @param {{aberration?:number, vignette?:number, grain?:number}} p valores finais (config × contexto × dados)
   */
  setParams({ aberration, vignette, grain }) {
    const u = this.material.uniforms;
    if (aberration !== undefined) u.uAberration.value = aberration;
    if (vignette !== undefined) u.uVignette.value = vignette;
    if (grain !== undefined) u.uGrain.value = grain;
  }

  /** Semente do grão (troca a cada pose stop-motion): desloca a textura pela sequência R2 (sem repetir padrão). */
  setSeed(seed) {
    const u = this.material.uniforms;
    u.uSeed.value = seed;
    u.uGrainOffset.value.set((seed * 0.7548776662) % 1, (seed * 0.569840291) % 1);
  }

  setSize(width, height) {
    this.material.uniforms.uResolution.value.set(width, height);
    // Grão em px de uma tela de 1080 linhas: o mesmo "filme" em qualquer resolução.
    this.material.uniforms.uGrainSize.value = Math.max(1, LENS.grain.size * (height / 1080));
  }

  render(renderer, writeBuffer, readBuffer) {
    this.material.uniforms.tDiffuse.value = readBuffer.texture;
    drawQuad(renderer, this.quad, this.material, this.renderToScreen ? null : writeBuffer);
  }

  dispose() {
    this.grain.dispose();
    this.material.dispose();
    this.quad.dispose();
  }
}
