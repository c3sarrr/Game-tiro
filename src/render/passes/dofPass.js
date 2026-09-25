// Profundidade de campo / tilt-shift (seção 0.13: "tilt-shift/profundidade de campo sutil para vender a escala
// de miniatura, mais forte nos menus e killcam, mínimo durante o jogo"; moodboard item 9, TSH1–TSH15, SMA7).
//  - CoC por profundidade: n = abertura·(1 − foco/z) (lente fina, a menos de uma constante), negativa na frente
//    do foco. Em menus/killcam soma-se uma faixa na tela (plano focal inclinado, "miniature faking").
//  - Autofoco na mira calculado na GPU (textura 1×1 com histórico), com transição suave em dioptrias (1/z):
//    nada de ler a profundidade de volta na CPU.
//  - Pré-filtro para 1/2 (cor + CoC com prioridade para o "perto"), gather em disco com espiral de ângulo dourado
//    (Gustafsson 2018, "Bokeh depth of field in a single pass"): pontos brilhantes viram discos e amostras de trás
//    não vazam sobre o que está na frente; o "perto" desfocado cobre o nítido.
//  - A espiral começa num ângulo por pixel dado por ruído de gradiente intercalado e um pós-filtro em tenda 3×3
//    na meia resolução cancela esse padrão (Jimenez 2014): sem o desenho da espiral no bokeh e sem o "pelo" que
//    uma rotação aleatória por pixel deixava nas silhuetas desfocadas (vitrine: rolos de fita, caixa de papelão).
//  - Composição em resolução cheia com a CoC exata do pixel (bordas do que está em foco continuam nítidas).

import * as THREE from 'three';
import { Pass } from 'three/addons/postprocessing/Pass.js';
import { DOF } from '../../data/postFx.js';
import { FullScreenQuad, drawQuad, makeTarget, postMaterial, scaledSize } from './common.js';

const COC_GLSL = /* glsl */ `
uniform highp sampler2D tDepth;
uniform sampler2D tFocus;
uniform float uNear;
uniform float uFar;
uniform float uAperture;
uniform float uMaxRadius; // px na meia resolução
uniform float uNearScale;
uniform vec4 uTilt; // força, centro, meia largura, transição (fração da altura)
float dofFocus() {
  return texelFetch(tFocus, ivec2(0), 0).r;
}
// CoC com sinal em px da meia resolução (negativo = na frente do foco).
float dofCoc(float z, float focus, vec2 uv) {
  float n = clamp(uAperture * (1.0 - focus / max(z, 1e-3)), -1.0, 1.0);
  if (uTilt.x > 0.0) {
    float band = smoothstep(uTilt.z, uTilt.z + uTilt.w, abs(uv.y - uTilt.y)) * uTilt.x;
    // Dentro do plano de foco o sinal vem da tela: em cima costuma ser longe, embaixo, perto.
    float s = abs(n) > 0.02 ? sign(n) : (uv.y > uTilt.y ? 1.0 : -1.0);
    n = s * max(abs(n), band);
  }
  return n * uMaxRadius * (n < 0.0 ? uNearScale : 1.0);
}
float dofDepthAt(vec2 uv) {
  return postLinearDepth(textureLod(tDepth, uv, 0.0).x, uNear, uFar);
}
`;

const FOCUS_FRAG = /* glsl */ `
uniform highp sampler2D tDepth;
uniform sampler2D tPrev;
uniform float uNear;
uniform float uFar;
uniform float uBlend;
uniform float uManual;
uniform vec2 uSpread;
uniform float uNearBias;
uniform float uMinFocus;
float lin(vec2 uv) {
  return postLinearDepth(textureLod(tDepth, uv, 0.0).x, uNear, uFar);
}
void main() {
  float target;
  if (uManual > 0.0) {
    target = uManual;
  } else {
    // Cruz em volta da mira: o centro puxado para o mais próximo (foca no boneco, não no vão atrás dele).
    float zc = lin(vec2(0.5));
    float zmin = zc;
    zmin = min(zmin, lin(vec2(0.5 - uSpread.x, 0.5)));
    zmin = min(zmin, lin(vec2(0.5 + uSpread.x, 0.5)));
    zmin = min(zmin, lin(vec2(0.5, 0.5 - uSpread.y)));
    zmin = min(zmin, lin(vec2(0.5, 0.5 + uSpread.y)));
    target = zc >= uFar * 0.98 ? uFar * 0.5 : mix(zc, zmin, uNearBias);
  }
  target = clamp(target, uMinFocus, uFar * 0.5);
  float prev = texelFetch(tPrev, ivec2(0), 0).r;
  // Transição em dioptrias: a lente "anda" igual para perto e para longe. Histórico inválido (primeiro quadro,
  // alvo recém-criado) ou reinício pedido: foca direto.
  bool fresh = !(prev > 0.0) || uBlend >= 1.0;
  float f = fresh ? target : 1.0 / mix(1.0 / prev, 1.0 / target, uBlend);
  gl_FragColor = vec4(f, target, 0.0, 1.0);
}
`;

const PREFILTER_FRAG = /* glsl */ `
uniform sampler2D tDiffuse;
uniform vec2 uFullTexel;
varying vec2 vUv;
${COC_GLSL}
void main() {
  float focus = dofFocus();
  vec2 o = uFullTexel * 0.5;
  vec3 col = vec3(0.0);
  float wsum = 0.0;
  float cmin = 1e9;
  float cmax = -1e9;
  for (int i = 0; i < 4; i++) {
    vec2 uv = vUv + vec2((i & 1) == 0 ? -o.x : o.x, (i & 2) == 0 ? -o.y : o.y);
    vec3 c = textureLod(tDiffuse, uv, 0.0).rgb;
    float coc = dofCoc(dofDepthAt(uv), focus, uv);
    // O que está desfocado pesa mais: o nítido não vaza cor para dentro do halo do fundo.
    float w = 0.15 + abs(coc) / max(uMaxRadius, 1.0);
    col += c * w;
    wsum += w;
    cmin = min(cmin, coc);
    cmax = max(cmax, coc);
  }
  // O "perto" desfocado ganha: ele precisa se espalhar por cima do que está atrás.
  float coc = cmin < -0.5 ? cmin : cmax;
  gl_FragColor = vec4(col / wsum, coc);
}
`;

const GATHER_FRAG = /* glsl */ `
uniform sampler2D tHalf;
uniform vec2 uTexel;
uniform float uMaxRadius;
uniform float uStep;
varying vec2 vUv;
const float GOLDEN_ANGLE = 2.39996323;
void main() {
  vec4 center = textureLod(tHalf, vUv, 0.0);
  float cc = center.a;
  float cs = abs(cc);
  vec3 acc = center.rgb;
  float tot = 1.0;
  float nearCover = 0.0;
  // Rotação por pixel em ruído intercalado: o pós-filtro 3×3 seguinte cancela o padrão (sem espiral visível).
  float ang = postIGN(gl_FragCoord.xy) * 6.28318531;
  float r = uStep;
  for (int i = 0; i < MAX_SAMPLES; i++) {
    if (r >= uMaxRadius) break;
    vec2 tc = vUv + vec2(cos(ang), sin(ang)) * r * uTexel;
    vec4 s = textureLod(tHalf, tc, 0.0);
    float ss = abs(s.a);
    // Amostra atrás do centro só se espalha até 2× o desfoque do centro (não borra o que está na frente).
    if (s.a > cc) ss = min(ss, cs * 2.0);
    float m = smoothstep(r - 0.5, r + 0.5, ss);
    acc += mix(acc / tot, s.rgb, m);
    tot += 1.0;
    if (s.a < 0.0) nearCover = max(nearCover, m * smoothstep(0.5, 1.5, ss));
    ang += GOLDEN_ANGLE;
    r += uStep / r;
  }
  gl_FragColor = vec4(acc / tot, nearCover);
}
`;

// Pós-filtro do gather: tenda 3×3 (pesos 1-2-1 separáveis) em 4 leituras bilineares nos cantos dos texels.
const POSTFILTER_FRAG = /* glsl */ `
uniform sampler2D tBlur;
uniform vec2 uTexel;
varying vec2 vUv;
void main() {
  vec2 o = uTexel * 0.5;
  vec4 a = textureLod(tBlur, vUv + vec2(-o.x, -o.y), 0.0);
  vec4 b = textureLod(tBlur, vUv + vec2(o.x, -o.y), 0.0);
  vec4 c = textureLod(tBlur, vUv + vec2(-o.x, o.y), 0.0);
  vec4 d = textureLod(tBlur, vUv + vec2(o.x, o.y), 0.0);
  gl_FragColor = (a + b + c + d) * 0.25;
}
`;

const COMPOSITE_FRAG = /* glsl */ `
uniform sampler2D tDiffuse;
uniform sampler2D tBlur;
uniform int uView;
varying vec2 vUv;
${COC_GLSL}
void main() {
  vec4 sharp = texture(tDiffuse, vUv);
  float coc = dofCoc(dofDepthAt(vUv), dofFocus(), vUv);
  vec4 blur = texture(tBlur, vUv);
  float a = max(smoothstep(0.35, 1.1, abs(coc)), blur.a);
  if (uView == 1) {
    // Mapa de CoC: laranja = perto, azul = longe, cinza = em foco.
    float l = postLuma(sharp.rgb) / (1.0 + postLuma(sharp.rgb));
    vec3 tint = coc < 0.0 ? vec3(1.0, 0.42, 0.08) : vec3(0.12, 0.38, 1.0);
    float k = clamp(abs(coc) / max(uMaxRadius, 1.0), 0.0, 1.0);
    gl_FragColor = vec4(mix(vec3(l), tint, k), 1.0);
    return;
  }
  gl_FragColor = vec4(mix(sharp.rgb, blur.rgb, a), sharp.a);
}
`;

const DEFAULT_PROFILE = Object.freeze({ aperture: 1, maxBlur: 6, nearScale: 1, tilt: 0, tiltCenter: 0.5, tiltWidth: 0.12, tiltFeather: 0.3 });

export class DofPass extends Pass {
  /** @param {{camera:THREE.Camera|null, depthTexture:THREE.DepthTexture|null}} ctx contexto do quadro */
  constructor(ctx) {
    super();
    this.ctx = ctx;
    this.needsSwap = true;
    this.width = 1;
    this.height = 1;
    this.profile = { ...DEFAULT_PROFILE };
    this.focusTime = 0.25;
    this.manualFocus = 0;
    this.view = 0;
    this._resetFocus = true;
    this._focusIndex = 0;
    this.focusRT = [
      makeTarget(1, 1, { filter: THREE.NearestFilter, name: 'massacre.dof.focus.a' }),
      makeTarget(1, 1, { filter: THREE.NearestFilter, name: 'massacre.dof.focus.b' }),
    ];
    this.halfA = makeTarget(1, 1, { name: 'massacre.dof.half' });
    this.halfB = makeTarget(1, 1, { name: 'massacre.dof.blur' });

    const cocUniforms = () => ({
      tDepth: { value: null },
      tFocus: { value: null },
      uNear: { value: 1 },
      uFar: { value: 1000 },
      uAperture: { value: 1 },
      uMaxRadius: { value: 1 },
      uNearScale: { value: 1 },
      uTilt: { value: new THREE.Vector4(0, 0.5, 0.12, 0.3) },
    });
    this.focusMat = postMaterial({
      name: 'dof-focus',
      uniforms: {
        tDepth: { value: null },
        tPrev: { value: null },
        uNear: { value: 1 },
        uFar: { value: 1000 },
        uBlend: { value: 1 },
        uManual: { value: 0 },
        uSpread: { value: new THREE.Vector2(DOF.autofocus.spread[0], DOF.autofocus.spread[1]) },
        uNearBias: { value: DOF.autofocus.nearBias },
        uMinFocus: { value: DOF.minFocus },
      },
      fragmentShader: FOCUS_FRAG,
    });
    this.prefilter = postMaterial({
      name: 'dof-prefilter',
      uniforms: { ...cocUniforms(), tDiffuse: { value: null }, uFullTexel: { value: new THREE.Vector2() } },
      fragmentShader: PREFILTER_FRAG,
    });
    this.gather = postMaterial({
      name: 'dof-gather',
      defines: { MAX_SAMPLES: DOF.maxSamples },
      uniforms: {
        tHalf: { value: null },
        uTexel: { value: new THREE.Vector2() },
        uMaxRadius: { value: 1 },
        uStep: { value: DOF.radiusStep },
      },
      fragmentShader: GATHER_FRAG,
    });
    this.postfilter = postMaterial({
      name: 'dof-postfilter',
      uniforms: { tBlur: { value: null }, uTexel: { value: new THREE.Vector2() } },
      fragmentShader: POSTFILTER_FRAG,
    });
    this.composite = postMaterial({
      name: 'dof-composite',
      uniforms: { ...cocUniforms(), tDiffuse: { value: null }, tBlur: { value: null }, uView: { value: 0 } },
      fragmentShader: COMPOSITE_FRAG,
    });
    this.quad = new FullScreenQuad(null);
  }

  /**
   * Perfil do contexto (data/postFx.js POST_CONTEXTS[ctx].dof[nível]).
   * @param {{aperture:number, maxBlur:number, nearScale?:number, tilt?:number, tiltCenter?:number,
   *   tiltWidth?:number, tiltFeather?:number}} profile
   */
  setProfile(profile) {
    this.profile = { ...DEFAULT_PROFILE, ...profile };
  }

  /** Constante de tempo do autofoco (s). */
  setFocusTime(seconds) {
    this.focusTime = Math.max(0.01, seconds);
  }

  /** Foco fixo em u (distância da câmera); null/0 volta ao autofoco na mira. */
  setManualFocus(distance) {
    this.manualFocus = distance > 0 ? distance : 0;
  }

  /** Próximo quadro foca direto no alvo (troca de câmera/contexto: sem "caçar" o foco). */
  resetFocus() {
    this._resetFocus = true;
  }

  setView(showCoc) {
    this.view = showCoc ? 1 : 0;
  }

  /** Raio máximo em px da meia resolução para a altura atual. */
  get maxRadius() {
    return (this.profile.maxBlur * (this.height / 1080)) * 0.5;
  }

  setSize(width, height) {
    this.width = width;
    this.height = height;
    const [w, h] = scaledSize(width, height, 0.5);
    this.halfA.setSize(w, h);
    this.halfB.setSize(w, h);
  }

  #applyCoc(u, camera, depth, focusTex) {
    const p = this.profile;
    u.tDepth.value = depth;
    u.tFocus.value = focusTex;
    u.uNear.value = camera.near;
    u.uFar.value = camera.far;
    u.uAperture.value = p.aperture;
    u.uMaxRadius.value = this.maxRadius;
    u.uNearScale.value = p.nearScale;
    u.uTilt.value.set(p.tilt, p.tiltCenter, p.tiltWidth, p.tiltFeather);
  }

  render(renderer, writeBuffer, readBuffer, deltaTime = 1 / 60) {
    const camera = this.ctx.camera;
    const depth = this.ctx.depthTexture;
    const q = this.quad;

    // Autofoco (1×1 com histórico).
    const prev = this.focusRT[this._focusIndex];
    this._focusIndex ^= 1;
    const next = this.focusRT[this._focusIndex];
    const f = this.focusMat.uniforms;
    f.tDepth.value = depth;
    f.tPrev.value = prev.texture;
    f.uNear.value = camera.near;
    f.uFar.value = camera.far;
    f.uManual.value = this.manualFocus;
    f.uBlend.value = this._resetFocus ? 1 : 1 - Math.exp(-Math.max(0, deltaTime) / this.focusTime);
    this._resetFocus = false;
    drawQuad(renderer, q, this.focusMat, next);

    // Pré-filtro 1/2 (cor + CoC).
    const pf = this.prefilter.uniforms;
    this.#applyCoc(pf, camera, depth, next.texture);
    pf.tDiffuse.value = readBuffer.texture;
    pf.uFullTexel.value.set(1 / readBuffer.width, 1 / readBuffer.height);
    drawQuad(renderer, q, this.prefilter, this.halfA);

    // Disco (gather).
    const g = this.gather.uniforms;
    g.tHalf.value = this.halfA.texture;
    g.uTexel.value.set(1 / this.halfA.width, 1 / this.halfA.height);
    g.uMaxRadius.value = this.maxRadius;
    drawQuad(renderer, q, this.gather, this.halfB);

    // Pós-filtro 3×3 (o pré-filtro já foi consumido: a meia resolução A recebe o resultado limpo).
    const pf2 = this.postfilter.uniforms;
    pf2.tBlur.value = this.halfB.texture;
    pf2.uTexel.value.set(1 / this.halfB.width, 1 / this.halfB.height);
    drawQuad(renderer, q, this.postfilter, this.halfA);

    // Composição.
    const c = this.composite.uniforms;
    this.#applyCoc(c, camera, depth, next.texture);
    c.tDiffuse.value = readBuffer.texture;
    c.tBlur.value = this.halfA.texture;
    c.uView.value = this.view;
    drawQuad(renderer, q, this.composite, this.renderToScreen ? null : writeBuffer);
  }

  dispose() {
    for (const rt of [...this.focusRT, this.halfA, this.halfB]) rt.dispose();
    this.focusMat.dispose();
    this.prefilter.dispose();
    this.gather.dispose();
    this.postfilter.dispose();
    this.composite.dispose();
    this.quad.dispose();
  }
}
