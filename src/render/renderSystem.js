// Sistema de renderização: WebGLRenderer + pipeline de pós, tamanho/pixel ratio, resolução dinâmica,
// sombras e tone mapping ligados à config, tempo de GPU e recuperação de contexto perdido.
// Estados do jogo chamam setView(scene, camera); o loop chama render() uma vez por quadro.
// Sombras estáticas (setView com staticShadows): o passe de sombra usa a profundidade padrão do three (sem o
// boil da massinha), então numa cena parada o mapa é igual quadro a quadro — só é refeito quando algo pede
// (troca de cena, qualidade de sombra, contexto recuperado, invalidateShadows()). Na vitrine isso tira ~1,4 ms
// de GPU por quadro (RTX 2070, preset Leve).

import * as THREE from 'three';
import { EV } from '../core/events.js';
import { PostPipeline } from './postPipeline.js';
import { PostEffects } from './postEffects.js';
import { GpuTimer } from './gpuTimer.js';
import { AdaptiveResolution, frameBudgetMs } from './adaptiveResolution.js';
import { RefreshEstimator } from './refreshRate.js';
import { SHADOW_LEVELS, SHADOW_MAX_SIZE } from '../data/qualityPresets.js';
import { setCameraAspect, setCameraFov } from './camera.js';
import { installDisposeTracker, purgeStaleDisposeListeners, compactDisposeTracker } from './contextRestore.js';

const TONE_MAPPING = Object.freeze({
  agx: THREE.AgXToneMapping,
  aces: THREE.ACESFilmicToneMapping,
  neutral: THREE.NeutralToneMapping,
});

export class RenderSystem {
  constructor({ canvas, config, events, log }) {
    this.canvas = canvas;
    this.config = config;
    this.events = events;
    this.log = log;
    this.renderer = null;
    this.pipeline = null;
    this.post = null;
    this.gpuTimer = null;
    this.adaptive = new AdaptiveResolution();
    this.refresh = new RefreshEstimator();
    this.scene = null;
    this.camera = null;
    this.staticShadows = false;
    this.cssWidth = 1;
    this.cssHeight = 1;
    this.pixelRatio = 1;
    this.contextLost = false;
    this._dirtySize = true;
    this._offs = [];
  }

  init() {
    // Antes de qualquer recurso de GPU: registra os ouvintes de 'dispose' do three (recuperação de contexto limpa).
    installDisposeTracker();
    const renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: false, // o MSAA fica no alvo HDR do pipeline
      alpha: false,
      depth: true,
      stencil: false,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: false,
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.info.autoReset = false; // várias passadas por quadro: zeramos manualmente
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.setClearColor(0x15100e, 1);
    this.renderer = renderer;
    const gl = renderer.getContext();
    this.maxSamples = gl.getParameter(gl.MAX_SAMPLES);
    this.gpuTimer = new GpuTimer(gl);
    this.pipeline = new PostPipeline(renderer, { samples: this.#samples(), timer: this.gpuTimer });
    // AO, DOF/tilt-shift, bloom, SMAA e lente (grão, vinheta, aberração, grade) ligados à config.
    this.post = new PostEffects({ renderer, pipeline: this.pipeline, config: this.config, events: this.events, log: this.log });

    const container = this.canvas.parentElement;
    this.resizeObserver = new ResizeObserver(() => (this._dirtySize = true));
    this.resizeObserver.observe(container);
    this.#watchDpr();

    const onLost = (e) => {
      e.preventDefault();
      this.contextLost = true;
      this.gpuTimer.lose();
      this.log?.warn('contexto WebGL perdido — aguardando recuperação');
      this.events.emit(EV.RENDER_CONTEXT, { lost: true });
    };
    const onRestored = () => {
      this.contextLost = false;
      // Os ouvintes de 'dispose' do contexto morto sairiam apagando objetos que não existem mais: antes de
      // qualquer sistema reassar texturas ou liberar recursos, eles são removidos (o three põe novos ao realocar).
      const purged = purgeStaleDisposeListeners();
      this.gpuTimer.restore();
      this.adaptive.reset();
      this.invalidateShadows(); // os mapas de sombra se perderam com a GPU
      this._dirtySize = true;
      this.log?.info(`contexto WebGL recuperado (${purged} recursos serão realocados sob demanda)`);
      this.events.emit(EV.RENDER_CONTEXT, { lost: false });
    };
    this.canvas.addEventListener('webglcontextlost', onLost);
    this.canvas.addEventListener('webglcontextrestored', onRestored);
    this._offs.push(() => this.canvas.removeEventListener('webglcontextlost', onLost));
    this._offs.push(() => this.canvas.removeEventListener('webglcontextrestored', onRestored));
    this._offs.push(this.config.watch('graphics.', (e) => this.#onConfig(e)));
    this._offs.push(this.events.on(EV.MAP_UNLOADED, () => compactDisposeTracker()));

    this.#applyToneMapping();
    this.#applySize();
    return renderer;
  }

  get maxAnisotropy() {
    return this.renderer.capabilities.getMaxAnisotropy();
  }

  /** Anisotropia efetiva (config limitada pelo hardware) para texturas criadas pelas cenas. */
  get anisotropy() {
    return Math.min(this.config.get('graphics.anisotropy'), this.maxAnisotropy);
  }

  get shadowLevel() {
    return SHADOW_LEVELS[this.config.get('graphics.shadows')];
  }

  get drawingWidth() {
    return Math.max(1, Math.floor(this.cssWidth * this.pixelRatio));
  }

  get drawingHeight() {
    return Math.max(1, Math.floor(this.cssHeight * this.pixelRatio));
  }

  /**
   * @param {THREE.Scene} scene
   * @param {THREE.Camera} camera
   * @param {{staticShadows?:boolean}} [opts] staticShadows: nada que projeta sombra se move sozinho (vitrine)
   */
  setView(scene, camera, { staticShadows = false } = {}) {
    this.scene = scene;
    this.camera = camera;
    this.staticShadows = staticShadows;
    this.renderer.shadowMap.autoUpdate = !staticShadows;
    this.adaptive.reset();
    this.applyShadowSettings();
    this.applyAnisotropy();
    this._dirtySize = true;
  }

  clearView() {
    this.scene = null;
    this.camera = null;
    this.staticShadows = false;
    this.renderer.shadowMap.autoUpdate = true;
  }

  /** Refaz os mapas de sombra no próximo quadro (cena com sombras estáticas: algo que projeta sombra mudou). */
  invalidateShadows() {
    if (this.renderer) this.renderer.shadowMap.needsUpdate = true;
  }

  /** Um quadro. `frameMs`: duração do último quadro; `dt`: segundos (para passes animados). */
  render(frameMs, dt, now) {
    if (this.contextLost) return;
    if (this._dirtySize) this.#applySize();
    this.renderer.info.reset();
    if (!this.scene || !this.camera) {
      // Telas sem cena 3D: o intervalo entre quadros é o próprio vsync (piso do orçamento da resolução dinâmica).
      this.refresh.sample(frameMs);
      return;
    }
    this.gpuTimer.begin('cena');
    this.post.beforeRender();
    this.pipeline.render(this.scene, this.camera, dt);
    this.gpuTimer.end();
    // Com timer de GPU disponível, espera o primeiro resultado (sai alguns quadros depois) antes de decidir:
    // o tempo de relógio dos primeiros quadros inclui compilação de shaders e derrubaria a resolução à toa.
    const timerPending = this.gpuTimer.supported && this.gpuTimer.ms === null;
    if (this.config.get('graphics.adaptiveResolution') && !timerPending) {
      const gpu = this.gpuTimer.supported ? this.gpuTimer.ms : null;
      const budget = frameBudgetMs({
        targetFps: this.config.get('graphics.targetFps'),
        fpsCap: this.config.get('graphics.fpsCap'),
        refreshMs: this.refresh.intervalMs,
      });
      if (this.adaptive.update(frameMs, gpu, budget, now)) {
        this._dirtySize = true;
        this.log?.debug(`resolução dinâmica → ${Math.round(this.adaptive.scale * 100)}%`);
      }
    }
  }

  /** Aplica tamanho/qualidade de sombra às luzes da cena ativa (luzes podem pedir fração via userData.shadowScale). */
  applyShadowSettings(scene = this.scene) {
    const level = this.shadowLevel;
    const enabled = level.mapSize > 0;
    const changedType = this.renderer.shadowMap.enabled !== enabled;
    this.renderer.shadowMap.enabled = enabled;
    if (!scene) return;
    scene.traverse((obj) => {
      if (obj.isLight && obj.shadow && obj.castShadow) {
        const cap = Math.min(SHADOW_MAX_SIZE, this.renderer.capabilities.maxTextureSize);
        const size = Math.min(cap, Math.max(256, Math.round(level.mapSize * (obj.userData.shadowScale ?? 1))));
        if (obj.shadow.mapSize.x !== size) {
          obj.shadow.mapSize.set(size, size);
          obj.shadow.map?.dispose();
          obj.shadow.map = null;
        }
        obj.shadow.radius = level.radius * (obj.userData.shadowSoftness ?? 1);
      }
      if (changedType && obj.material) {
        for (const m of Array.isArray(obj.material) ? obj.material : [obj.material]) m.needsUpdate = true;
      }
    });
    this.invalidateShadows();
  }

  applyAnisotropy(scene = this.scene) {
    if (!scene) return;
    const a = this.anisotropy;
    const seen = new Set();
    scene.traverse((obj) => {
      if (!obj.material) return;
      for (const m of Array.isArray(obj.material) ? obj.material : [obj.material]) {
        for (const key of ['map', 'normalMap', 'roughnessMap', 'bumpMap', 'aoMap', 'metalnessMap', 'emissiveMap']) {
          const tex = m[key];
          if (tex && !seen.has(tex) && tex.anisotropy !== a) {
            seen.add(tex);
            tex.anisotropy = a;
            tex.needsUpdate = true;
          }
        }
      }
    });
  }

  #samples() {
    return Math.min(this.config.get('graphics.msaa'), this.maxSamples ?? 4);
  }

  #onConfig(e) {
    switch (e.key) {
      case 'graphics.resolutionScale':
      case 'graphics.maxPixelRatio':
        this._dirtySize = true;
        break;
      case 'graphics.adaptiveResolution':
        this.adaptive.reset();
        this._dirtySize = true;
        break;
      case 'graphics.msaa':
        this.pipeline.setSamples(this.#samples());
        this._dirtySize = true;
        break;
      case 'graphics.shadows':
        this.applyShadowSettings();
        break;
      case 'graphics.anisotropy':
        this.applyAnisotropy();
        break;
      case 'graphics.toneMapping':
      case 'graphics.exposure':
        this.#applyToneMapping();
        break;
      case 'graphics.fov':
        if (this.camera) setCameraFov(this.camera, e.value);
        break;
      default:
        break;
    }
  }

  #applyToneMapping() {
    this.renderer.toneMapping = TONE_MAPPING[this.config.get('graphics.toneMapping')];
    // A exposição final (config × cena × flicker por pose) é aplicada a cada quadro por PostEffects.beforeRender.
    this.post?.beforeRender();
  }

  #applySize() {
    this._dirtySize = false;
    const rect = this.canvas.parentElement.getBoundingClientRect();
    this.cssWidth = Math.max(1, Math.round(rect.width));
    this.cssHeight = Math.max(1, Math.round(rect.height));
    const dpr = globalThis.devicePixelRatio || 1;
    const base = Math.min(dpr, this.config.get('graphics.maxPixelRatio'));
    const adaptive = this.config.get('graphics.adaptiveResolution') ? this.adaptive.scale : 1;
    this.pixelRatio = Math.max(0.25, base * this.config.get('graphics.resolutionScale') * adaptive);
    this.renderer.setPixelRatio(this.pixelRatio);
    this.renderer.setSize(this.cssWidth, this.cssHeight, false);
    this.pipeline.setSize(this.drawingWidth, this.drawingHeight);
    if (this.camera) setCameraAspect(this.camera, this.cssWidth / this.cssHeight);
    this.events.emit(EV.RENDER_RESIZE, {
      width: this.cssWidth,
      height: this.cssHeight,
      pixelRatio: this.pixelRatio,
      drawingWidth: this.drawingWidth,
      drawingHeight: this.drawingHeight,
    });
  }

  #watchDpr() {
    // Mudar de monitor ou dar zoom no navegador altera o devicePixelRatio.
    const listen = () => {
      const mq = matchMedia(`(resolution: ${globalThis.devicePixelRatio}dppx)`);
      const onChange = () => {
        this._dirtySize = true;
        mq.removeEventListener('change', onChange);
        listen();
      };
      mq.addEventListener('change', onChange);
      this._dprOff = () => mq.removeEventListener('change', onChange);
    };
    listen();
  }

  stats() {
    const info = this.renderer.info;
    return {
      calls: info.render.calls,
      triangles: info.render.triangles,
      points: info.render.points,
      lines: info.render.lines,
      geometries: info.memory.geometries,
      textures: info.memory.textures,
      programs: info.programs?.length ?? 0,
      gpuMs: this.gpuTimer?.avgMs ?? null,
      gpuSupported: !!this.gpuTimer?.supported,
      gpuSections: this.gpuTimer?.sectionList() ?? [],
      width: this.drawingWidth,
      height: this.drawingHeight,
      pixelRatio: this.pixelRatio,
      adaptiveScale: this.adaptive.scale,
      refreshHz: this.refresh.hz,
    };
  }

  dispose() {
    for (const off of this._offs) off();
    this._dprOff?.();
    this.resizeObserver?.disconnect();
    this.gpuTimer?.dispose();
    this.post?.dispose();
    this.pipeline?.dispose();
    this.renderer?.dispose();
  }
}
