// Pipeline de pós-processamento próprio (compatível com os Pass de three/addons).
//   cena → alvo HDR multisample (HalfFloat + textura de profundidade resolvida)
//   → passes de CENA (usam a profundidade da cena: AO, DOF)
//   → camadas por cima (ex.: arma em primeira pessoa) num alvo próprio com profundidade, compostas "sobre"
//     (a arma não recebe o AO nem o desfoque da cena, e o bloom do tiro ainda pega nela)
//   → passes HDR de LUZ (bloom) em ping-pong sem MSAA
//   → OutputPass (tone mapping AgX/ACES + sRGB)
//   → passes LDR (SMAA, lente: grão, vinheta, aberração, grade) → tela.
// Motivo de não usar EffectComposer: ele multiplica o MSAA em todos os alvos do ping-pong, e o pipeline
// embutido do WebGLRenderer (r186) não permite passes depois do tone mapping, que a seção 0.13 exige.
// Cada passe ativo abre uma etapa no cronômetro de GPU (nome = pass.name), exibida no overlay de debug.

import * as THREE from 'three';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { FullScreenQuad, drawQuad, postMaterial } from './passes/common.js';

function makeTarget(w, h, { samples = 0, type = THREE.HalfFloatType, depth = false, name = 'massacre.post' } = {}) {
  const rt = new THREE.WebGLRenderTarget(w, h, {
    type,
    samples,
    depthBuffer: depth,
    stencilBuffer: false,
  });
  if (depth) {
    rt.depthTexture = new THREE.DepthTexture(w, h, THREE.UnsignedIntType);
    rt.depthTexture.format = THREE.DepthFormat;
  }
  rt.texture.name = name;
  return rt;
}

// Composição "sobre" pré-multiplicada: a camada limpa em alfa 0 e opaca em alfa 1; nas bordas o MSAA resolve
// alfa fracionário, que vira antisserrilhado contra a cena.
const LAYER_FRAG = /* glsl */ `
uniform sampler2D tDiffuse;
uniform sampler2D tLayer;
varying vec2 vUv;
void main() {
  vec4 scene = texture(tDiffuse, vUv);
  vec4 layer = texture(tLayer, vUv);
  gl_FragColor = vec4(scene.rgb * (1.0 - layer.a) + layer.rgb, scene.a);
}
`;

const _clear = new THREE.Color();

export class PostPipeline {
  /**
   * @param {THREE.WebGLRenderer} renderer
   * @param {{samples?:number, timer?:import('./gpuTimer.js').GpuTimer|null}} [opts]
   */
  constructor(renderer, { samples = 4, timer = null } = {}) {
    this.renderer = renderer;
    this.timer = timer;
    this.width = 1;
    this.height = 1;
    this.samples = samples;
    /** Passes que leem a profundidade da cena (rodam antes das camadas). */
    this.scenePasses = [];
    /** Passes HDR depois das camadas (luz: bloom). */
    this.hdrPasses = [];
    /** Passes depois do tone mapping (exibição). */
    this.ldrPasses = [];
    /** Camadas renderizadas por cima da cena com profundidade própria (ex.: arma em primeira pessoa). */
    this.layers = [];
    /** Contexto do quadro lido pelos passes (câmera, profundidade da cena, dt). */
    this.ctx = { camera: null, depthTexture: null, width: 1, height: 1, deltaTime: 0 };
    this.output = new OutputPass();
    this.output.name = 'saida';
    this.sceneTarget = makeTarget(1, 1, { samples, depth: true, name: 'massacre.scene' });
    this.layerTarget = null;
    this.hdrA = makeTarget(1, 1, { name: 'massacre.hdr.a' });
    this.hdrB = makeTarget(1, 1, { name: 'massacre.hdr.b' });
    this.ldrA = makeTarget(1, 1, { type: THREE.UnsignedByteType, name: 'massacre.ldr.a' });
    this.ldrB = makeTarget(1, 1, { type: THREE.UnsignedByteType, name: 'massacre.ldr.b' });
    this.layerMaterial = postMaterial({
      name: 'layer-over',
      uniforms: { tDiffuse: { value: null }, tLayer: { value: null } },
      fragmentShader: LAYER_FRAG,
    });
    this.quad = new FullScreenQuad(null);
  }

  /** Textura de profundidade da cena (para AO, DOF e efeitos que precisam de distância). */
  get depthTexture() {
    return this.sceneTarget.depthTexture;
  }

  setSamples(samples) {
    if (samples === this.samples) return;
    this.samples = samples;
    this.sceneTarget.depthTexture?.dispose();
    this.sceneTarget.dispose();
    this.sceneTarget = makeTarget(this.width, this.height, { samples, depth: true, name: 'massacre.scene' });
    if (this.layerTarget) {
      this.layerTarget.depthTexture?.dispose();
      this.layerTarget.dispose();
      this.layerTarget = null;
    }
  }

  setSize(width, height) {
    this.width = width;
    this.height = height;
    this.ctx.width = width;
    this.ctx.height = height;
    this.sceneTarget.setSize(width, height);
    this.layerTarget?.setSize(width, height);
    this.hdrA.setSize(width, height);
    this.hdrB.setSize(width, height);
    this.ldrA.setSize(width, height);
    this.ldrB.setSize(width, height);
    for (const pass of this.#allPasses()) pass.setSize?.(width, height);
  }

  #allPasses() {
    return [...this.scenePasses, ...this.hdrPasses, ...this.ldrPasses, this.output];
  }

  #add(list, pass, index) {
    list.splice(index ?? list.length, 0, pass);
    pass.setSize?.(this.width, this.height);
    return pass;
  }

  /** Passe que lê a profundidade da cena (antes das camadas). */
  addScenePass(pass, index) {
    return this.#add(this.scenePasses, pass, index);
  }

  /** Passe HDR depois das camadas (ex.: bloom). */
  addHdrPass(pass, index) {
    return this.#add(this.hdrPasses, pass, index);
  }

  /** Passe em espaço de exibição, depois do tone mapping. */
  addLdrPass(pass, index) {
    return this.#add(this.ldrPasses, pass, index);
  }

  removePass(pass) {
    for (const list of [this.scenePasses, this.hdrPasses, this.ldrPasses]) {
      const i = list.indexOf(pass);
      if (i >= 0) list.splice(i, 1);
    }
  }

  addLayer(layer) {
    this.layers.push(layer);
    return () => {
      const i = this.layers.indexOf(layer);
      if (i >= 0) this.layers.splice(i, 1);
    };
  }

  #section(name) {
    this.timer?.section(name);
  }

  /** Ping-pong HDR: escreve sempre no alvo que não está sendo lido (o da cena nunca é escrito aqui). */
  #runList(list, read, deltaTime) {
    for (const pass of list) {
      if (!pass.enabled) continue;
      const write = read === this.hdrA ? this.hdrB : this.hdrA;
      this.#section(pass.name ?? 'passe');
      pass.renderToScreen = false;
      pass.render(this.renderer, write, read, deltaTime, false);
      if (pass.needsSwap) read = write;
    }
    return read;
  }

  #renderLayers(read) {
    const r = this.renderer;
    let visible = false;
    for (let i = 0; i < this.layers.length; i++) if (this.layers[i].visible !== false) visible = true;
    if (!visible) return read;
    if (!this.layerTarget) {
      this.layerTarget = makeTarget(this.width, this.height, { samples: this.samples, depth: true, name: 'massacre.layer' });
    }
    this.#section('camada');
    r.getClearColor(_clear);
    const clearAlpha = r.getClearAlpha();
    const autoClear = r.autoClear;
    r.autoClear = false;
    try {
      r.setRenderTarget(this.layerTarget);
      r.setClearColor(0x000000, 0);
      r.clear(true, true, false);
      for (let i = 0; i < this.layers.length; i++) {
        const layer = this.layers[i];
        if (layer.visible === false) continue;
        r.clearDepth();
        r.render(layer.scene, layer.camera);
      }
    } finally {
      r.setClearColor(_clear, clearAlpha);
      r.autoClear = autoClear;
    }
    const write = read === this.hdrA ? this.hdrB : this.hdrA;
    this.layerMaterial.uniforms.tDiffuse.value = read.texture;
    this.layerMaterial.uniforms.tLayer.value = this.layerTarget.texture;
    drawQuad(r, this.quad, this.layerMaterial, write);
    return write;
  }

  render(scene, camera, deltaTime) {
    const r = this.renderer;
    // Com autoClear ligado, cada r.render() apagaria a cor. Os passes de three/addons contam com o autoClear
    // padrão, então ele só fica desligado aqui.
    const autoClear = r.autoClear;
    r.autoClear = false;
    try {
      r.setRenderTarget(this.sceneTarget);
      r.clear(true, true, false);
      r.render(scene, camera);
    } finally {
      r.autoClear = autoClear;
    }
    const ctx = this.ctx;
    ctx.camera = camera;
    ctx.depthTexture = this.sceneTarget.depthTexture;
    ctx.deltaTime = deltaTime;

    // HDR: o alvo da cena fica fora da rotação (só ele tem MSAA); ping-pong entre hdrA/hdrB.
    let read = this.#runList(this.scenePasses, this.sceneTarget, deltaTime);
    read = this.#renderLayers(read);
    read = this.#runList(this.hdrPasses, read, deltaTime);

    // Último passe LDR ativo (sem criar arrays por quadro).
    const ldrPasses = this.ldrPasses;
    let lastLdr = -1;
    for (let i = 0; i < ldrPasses.length; i++) if (ldrPasses[i].enabled) lastLdr = i;
    // Tone mapping + sRGB: direto na tela, ou num alvo LDR se ainda houver passes depois.
    this.#section('saida');
    this.output.renderToScreen = lastLdr < 0;
    this.output.render(r, this.ldrA, read, deltaTime, false);
    if (lastLdr < 0) return;

    read = this.ldrA;
    let write = this.ldrB;
    for (let i = 0; i <= lastLdr; i++) {
      const pass = ldrPasses[i];
      if (!pass.enabled) continue;
      this.#section(pass.name ?? 'passe');
      const last = i === lastLdr;
      pass.renderToScreen = last;
      pass.render(r, write, read, deltaTime, false);
      if (!last && pass.needsSwap) {
        read = write;
        write = write === this.ldrA ? this.ldrB : this.ldrA;
      }
    }
  }

  dispose() {
    for (const rt of [this.sceneTarget, this.layerTarget, this.hdrA, this.hdrB, this.ldrA, this.ldrB]) {
      if (!rt) continue;
      rt.depthTexture?.dispose();
      rt.dispose();
    }
    this.layerTarget = null;
    for (const pass of this.#allPasses()) pass.dispose?.();
    this.layerMaterial.dispose();
    this.quad.dispose();
    this.scenePasses.length = 0;
    this.hdrPasses.length = 0;
    this.ldrPasses.length = 0;
    this.layers.length = 0;
  }
}
