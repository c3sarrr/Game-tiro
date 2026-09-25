// Oclusão de ambiente de estúdio (seção 0.13: "AO para assentar a massa"; moodboard item 9, SML5/BTS2/PLA15).
//  1. GTAO (Jimenez et al. 2016, shader de three/addons) na resolução do nível (meia/cheia), a partir da
//     profundidade da própria cena — sem segunda passada de normais (o boil da massinha desloca vértices e só
//     a profundidade real bate com ele). Saída RG = (oclusão, distância linear).
//  2. Desruído bilateral separável (horizontal + vertical) respeitando a profundidade.
//  3. Composição em resolução cheia com upsample conjunto (bilateral pelos 4 texels vizinhos) e oclusão
//     COLORIDA: escurece e satura a própria cor (massinha nunca fica cinza). Pixels muito brilhantes (painéis
//     de softbox, lâmpadas) são poupados.
// O GTAOPass do three não serve aqui: com profundidade externa ele acessa um alvo de normais inexistente.

import * as THREE from 'three';
import { Pass } from 'three/addons/postprocessing/Pass.js';
import { GTAOShader, generateMagicSquareNoise } from 'three/addons/shaders/GTAOShader.js';
import { AO } from '../../data/postFx.js';
import { FullScreenQuad, drawQuad, makeTarget, postMaterial, scaledSize } from './common.js';

// O shader original descarta o fundo (profundidade 1): aqui ele escreve "sem oclusão, muito longe", para o
// desruído e o upsample terem um valor definido em todo texel.
const DISCARD_RE = /if\s*\(\s*depth\s*>=\s*1\.0\s*\)\s*\{\s*discard;\s*return;\s*\}/;

function gtaoFragment() {
  const src = GTAOShader.fragmentShader;
  if (!DISCARD_RE.test(src)) throw new Error('GTAOShader mudou: trecho de descarte do fundo não encontrado');
  return src.replace(DISCARD_RE, 'if (depth >= 1.0) { gl_FragColor = vec4(1.0, cameraFar, 0.0, 1.0); return; }');
}

const BLUR_FRAG = /* glsl */ `
uniform sampler2D tAO;
uniform ivec2 uDir;
uniform float uDepthTol;
uniform float uWeights[BLUR_RADIUS + 1];
varying vec2 vUv;
void main() {
  ivec2 size = textureSize(tAO, 0);
  ivec2 p = ivec2(vUv * vec2(size));
  vec4 c = texelFetch(tAO, p, 0);
  float z0 = c.y;
  float sum = c.x * uWeights[0];
  float wsum = uWeights[0];
  float tol = max(uDepthTol * z0, 0.5);
  for (int i = 1; i <= BLUR_RADIUS; i++) {
    for (int s = -1; s <= 1; s += 2) {
      ivec2 q = clamp(p + uDir * (i * s), ivec2(0), size - 1);
      vec2 t = texelFetch(tAO, q, 0).xy;
      float dz = (t.y - z0) / tol;
      float w = uWeights[i] * exp(-dz * dz);
      sum += t.x * w;
      wsum += w;
    }
  }
  gl_FragColor = vec4(sum / wsum, z0, 0.0, 1.0);
}
`;

const COMPOSITE_FRAG = /* glsl */ `
uniform sampler2D tDiffuse;
uniform sampler2D tAO;
uniform highp sampler2D tDepth;
uniform float uNear;
uniform float uFar;
uniform float uPower;
uniform float uStrength;
uniform float uSaturation;
uniform float uUpTol;
uniform vec2 uProtect;
uniform int uView;
varying vec2 vUv;
void main() {
  vec4 scene = texture(tDiffuse, vUv);
  float d = textureLod(tDepth, vUv, 0.0).x;
  if (d >= 1.0) {
    gl_FragColor = uView == 1 ? vec4(1.0) : scene;
    return;
  }
  float z = postLinearDepth(d, uNear, uFar);
  // Upsample conjunto: os 4 texels do AO em volta, pesados pela distância bilinear e pela semelhança de
  // profundidade (a oclusão de um objeto não vaza para o fundo nem vice-versa).
  ivec2 lowSize = textureSize(tAO, 0);
  vec2 lp = vUv * vec2(lowSize) - 0.5;
  vec2 f = fract(lp);
  ivec2 i0 = ivec2(floor(lp));
  float tol = max(uUpTol * z, 0.5);
  float aoSum = 0.0;
  float wSum = 0.0;
  for (int k = 0; k < 4; k++) {
    ivec2 o = ivec2(k & 1, k >> 1);
    vec2 s = texelFetch(tAO, clamp(i0 + o, ivec2(0), lowSize - 1), 0).xy;
    float bw = (o.x == 1 ? f.x : 1.0 - f.x) * (o.y == 1 ? f.y : 1.0 - f.y);
    float dz = (s.y - z) / tol;
    float w = bw * exp(-dz * dz) + 1e-5 * bw;
    aoSum += s.x * w;
    wSum += w;
  }
  float ao = wSum > 0.0 ? aoSum / wSum : 1.0;
  // Painel de luz, lâmpada, reflexo estourado: não escurece o que emite.
  ao = mix(ao, 1.0, smoothstep(uProtect.x, uProtect.y, postLuma(scene.rgb)));
  float a = pow(clamp(ao, 0.0, 1.0), uPower);
  if (uView == 1) {
    gl_FragColor = vec4(vec3(a), 1.0);
    return;
  }
  float occ = 1.0 - a;
  vec3 dark = scene.rgb * a;
  float l = postLuma(dark);
  dark = max(mix(vec3(l), dark, 1.0 + occ * uSaturation), vec3(0.0));
  gl_FragColor = vec4(mix(scene.rgb, dark, uStrength), scene.a);
}
`;

export class AOPass extends Pass {
  /** @param {{camera:THREE.Camera|null, depthTexture:THREE.DepthTexture|null}} ctx contexto do quadro (PostPipeline) */
  constructor(ctx) {
    super();
    this.ctx = ctx;
    this.needsSwap = true;
    this.width = 1;
    this.height = 1;
    this.level = 'meia';
    this.view = 0;
    this.noise = generateMagicSquareNoise();
    this.aoA = makeTarget(1, 1, { filter: THREE.NearestFilter, name: 'massacre.ao.a' });
    this.aoB = makeTarget(1, 1, { filter: THREE.NearestFilter, name: 'massacre.ao.b' });
    this.gtao = new THREE.ShaderMaterial({
      name: 'massacre.post.gtao',
      defines: {
        ...GTAOShader.defines,
        NORMAL_VECTOR_TYPE: 0, // normais reconstruídas da profundidade
        DEPTH_SWIZZLING: 'x',
        SAMPLES: AO.levels.meia.samples,
        FRAGMENT_OUTPUT: 'vec4(ao, -viewPos.z, 0.0, 1.0)',
      },
      uniforms: THREE.UniformsUtils.clone(GTAOShader.uniforms),
      vertexShader: GTAOShader.vertexShader,
      fragmentShader: gtaoFragment(),
      blending: THREE.NoBlending,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
    });
    const g = this.gtao.uniforms;
    g.tNoise.value = this.noise;
    g.radius.value = AO.radius;
    g.thickness.value = AO.thickness;
    g.distanceExponent.value = AO.distanceExponent;
    g.distanceFallOff.value = AO.distanceFallOff;
    g.scale.value = 1;

    const weights = [];
    for (let i = 0; i <= AO.blurRadius; i++) weights.push(Math.exp(-(i * i) / (2 * AO.blurSigma * AO.blurSigma)));
    this.blur = postMaterial({
      name: 'ao-blur',
      defines: { BLUR_RADIUS: AO.blurRadius },
      uniforms: {
        tAO: { value: null },
        uDir: { value: new THREE.Vector2(1, 0) },
        uDepthTol: { value: AO.blurDepth },
        uWeights: { value: weights },
      },
      fragmentShader: BLUR_FRAG,
    });
    this.composite = postMaterial({
      name: 'ao-composite',
      uniforms: {
        tDiffuse: { value: null },
        tAO: { value: null },
        tDepth: { value: null },
        uNear: { value: 1 },
        uFar: { value: 1000 },
        uPower: { value: AO.power },
        uStrength: { value: AO.strength },
        uSaturation: { value: AO.saturation },
        uUpTol: { value: AO.upsampleDepth },
        uProtect: { value: new THREE.Vector2(AO.protect[0], AO.protect[1]) },
        uView: { value: 0 },
      },
      fragmentShader: COMPOSITE_FRAG,
    });
    this.quad = new FullScreenQuad(null);
  }

  /** 'meia' (1/2 resolução, 12 amostras) ou 'cheia' (resolução inteira, 16 amostras). */
  setLevel(level) {
    const def = AO.levels[level];
    if (!def) throw new Error(`nível de AO desconhecido: ${level}`);
    this.level = level;
    if (this.gtao.defines.SAMPLES !== def.samples) {
      this.gtao.defines.SAMPLES = def.samples;
      this.gtao.needsUpdate = true;
    }
    this.setSize(this.width, this.height);
  }

  /** Vista de diagnóstico: true mostra só o AO (post_view ao). */
  setView(showAO) {
    this.view = showAO ? 1 : 0;
  }

  setSize(width, height) {
    this.width = width;
    this.height = height;
    const [w, h] = scaledSize(width, height, AO.levels[this.level].scale);
    this.aoA.setSize(w, h);
    this.aoB.setSize(w, h);
    this.gtao.uniforms.resolution.value.set(w, h);
  }

  render(renderer, writeBuffer, readBuffer) {
    const camera = this.ctx.camera;
    const depth = this.ctx.depthTexture;
    const g = this.gtao.uniforms;
    g.tDepth.value = depth;
    g.cameraNear.value = camera.near;
    g.cameraFar.value = camera.far;
    g.cameraProjectionMatrix.value.copy(camera.projectionMatrix);
    g.cameraProjectionMatrixInverse.value.copy(camera.projectionMatrixInverse);
    g.cameraWorldMatrix.value.copy(camera.matrixWorld);
    drawQuad(renderer, this.quad, this.gtao, this.aoA);

    const b = this.blur.uniforms;
    b.tAO.value = this.aoA.texture;
    b.uDir.value.set(1, 0);
    drawQuad(renderer, this.quad, this.blur, this.aoB);
    b.tAO.value = this.aoB.texture;
    b.uDir.value.set(0, 1);
    drawQuad(renderer, this.quad, this.blur, this.aoA);

    const c = this.composite.uniforms;
    c.tDiffuse.value = readBuffer.texture;
    c.tAO.value = this.aoA.texture;
    c.tDepth.value = depth;
    c.uNear.value = camera.near;
    c.uFar.value = camera.far;
    c.uView.value = this.view;
    drawQuad(renderer, this.quad, this.composite, this.renderToScreen ? null : writeBuffer);
  }

  dispose() {
    this.aoA.dispose();
    this.aoB.dispose();
    this.noise.dispose();
    this.gtao.dispose();
    this.blur.dispose();
    this.composite.dispose();
    this.quad.dispose();
  }
}
