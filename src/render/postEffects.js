// Diretor do pós-processamento de estúdio (seção 0.13 "Pós-processamento" + seção 0.16 presets): monta os passes
// no PostPipeline, liga cada um às chaves da config e aplica o CONTEXTO de câmera (jogo, vitrine, menu, killcam)
// definido em src/data/postFx.js. Também conduz o que muda por pose stop-motion (12/s): semente do grão e
// flicker de exposição (multiplicador antes do tone mapping, sutil e desligável).
//
// Ordem no pipeline:  cena → [AO → DOF] → camadas → [bloom] → tone mapping → [SMAA → lente] → tela.

import { EV } from '../core/events.js';
import { RNG } from '../core/rng.js';
import { AO, BLOOM, FLICKER, LENS, POST_CONTEXTS, POST_VIEWS } from '../data/postFx.js';
import { AOPass } from './passes/aoPass.js';
import { BloomPass } from './passes/bloomPass.js';
import { DofPass } from './passes/dofPass.js';
import { StudioSMAAPass } from './passes/smaaPass.js';
import { LensPass } from './passes/lensPass.js';

export class PostEffects {
  /**
   * @param {{renderer:import('three').WebGLRenderer, pipeline:import('./postPipeline.js').PostPipeline,
   *   config:import('../core/config.js').Config, events:import('../core/events.js').EventBus, log?:object}} deps
   */
  constructor({ renderer, pipeline, config, events, log = null }) {
    this.renderer = renderer;
    this.pipeline = pipeline;
    this.config = config;
    this.events = events;
    this.log = log;
    this.context = 'jogo';
    this.view = 'final';
    this.sceneExposure = 1;
    this.flickerValue = 0;
    this.flickerFactor = 1;
    this.rng = new RNG('flicker');
    this._offs = [];

    const ctx = pipeline.ctx;
    this.ao = new AOPass(ctx);
    this.ao.name = 'ao';
    this.dof = new DofPass(ctx);
    this.dof.name = 'dof';
    this.bloom = new BloomPass();
    this.bloom.name = 'bloom';
    this.smaa = new StudioSMAAPass();
    this.smaa.name = 'smaa';
    this.lens = new LensPass();
    this.lens.name = 'lente';
    pipeline.addScenePass(this.ao);
    pipeline.addScenePass(this.dof);
    pipeline.addHdrPass(this.bloom);
    pipeline.addLdrPass(this.smaa);
    pipeline.addLdrPass(this.lens);

    this._offs.push(config.watch('graphics.', (e) => this.#onConfig(e.key)));
    this._offs.push(config.watch('accessibility.reduceMotion', () => this.#applyFlicker()));
    this._offs.push(events.on(EV.POSE, ({ pose }) => this.#onPose(pose)));
    this._offs.push(events.on(EV.RENDER_CONTEXT, ({ lost }) => {
      // Contexto recuperado: o histórico do autofoco (textura 1×1) se perdeu com a GPU.
      if (!lost) this.dof.resetFocus();
    }));
    this.applyAll();
  }

  /** Reaplica todas as chaves (inicialização e troca de preset). */
  applyAll() {
    this.#applyAO();
    this.#applyBloom();
    this.#applyDof();
    this.#applySmaa();
    this.#applyLens();
    this.#applyFlicker();
  }

  #onConfig(key) {
    switch (key) {
      case 'graphics.ao':
        this.#applyAO();
        break;
      case 'graphics.bloom':
        this.#applyBloom();
        break;
      case 'graphics.dof':
        this.#applyDof();
        break;
      case 'graphics.smaa':
        this.#applySmaa();
        break;
      case 'graphics.grain':
      case 'graphics.vignette':
        this.#applyLens();
        break;
      case 'graphics.flicker':
        this.#applyFlicker();
        break;
      default:
        break;
    }
  }

  get contextDef() {
    return POST_CONTEXTS[this.context];
  }

  /**
   * Contexto de câmera do que está na tela (jogo, vitrine, menu, killcam) e exposição da cena (montagem de luz).
   * @param {{context?:string, exposure?:number}} opts
   */
  configure({ context, exposure } = {}) {
    if (context !== undefined) this.setContext(context);
    if (exposure !== undefined) this.sceneExposure = exposure;
  }

  setContext(id) {
    if (!POST_CONTEXTS[id]) throw new Error(`contexto de pós desconhecido: ${id} (use ${Object.keys(POST_CONTEXTS).join(', ')})`);
    if (id === this.context) return;
    this.context = id;
    this.dof.resetFocus();
    this.#applyBloom();
    this.#applyDof();
    this.#applyLens();
  }

  /** Foco manual em u (distância da câmera) ou null para o autofoco na mira. */
  setFocus(distance) {
    this.dof.setManualFocus(distance ?? 0);
    this.dof.resetFocus();
  }

  /** Vista de diagnóstico: 'final' (normal), 'ao', 'coc' ou 'bloom'. */
  setView(view) {
    if (!POST_VIEWS.includes(view)) throw new Error(`vista desconhecida: ${view} (use ${POST_VIEWS.join(', ')})`);
    this.view = view;
    this.ao.setView(view === 'ao');
    this.dof.setView(view === 'coc');
    this.bloom.setView(view === 'bloom');
    this.applyAll();
  }

  #applyAO() {
    const level = this.config.get('graphics.ao');
    const forced = this.view === 'ao';
    const on = forced || level !== 'desligado';
    if (on) this.ao.setLevel(AO.levels[level] ? level : 'meia');
    // Nas vistas de DOF/bloom o AO continua (faz parte da imagem que eles recebem).
    this.ao.enabled = on;
  }

  #applyBloom() {
    const forced = this.view === 'bloom';
    this.bloom.enabled = forced || (this.config.get('graphics.bloom') && this.view !== 'ao' && this.view !== 'coc');
    this.bloom.setIntensityScale(this.contextDef.bloom);
  }

  #applyDof() {
    const level = this.config.get('graphics.dof');
    const forced = this.view === 'coc';
    const def = this.contextDef.dof[level === 'desligado' ? 'sutil' : level];
    this.dof.setProfile(def);
    this.dof.setFocusTime(this.contextDef.focusTime);
    this.dof.enabled = forced || (level !== 'desligado' && this.view === 'final' && def.maxBlur > 0 && def.aperture > 0);
  }

  #applySmaa() {
    this.smaa.enabled = !!this.config.get('graphics.smaa');
  }

  #applyLens() {
    const c = this.contextDef;
    const diagnostic = this.view !== 'final';
    // Nas vistas de diagnóstico a lente não mexe na imagem (sem grão, vinheta, aberração nem grade).
    this.lens.enabled = !diagnostic;
    this.lens.setParams({
      aberration: LENS.aberration * c.aberration,
      vignette: LENS.vignette.maxAmount * this.config.get('graphics.vignette') * c.vignette,
      grain: LENS.grain.maxAmount * this.config.get('graphics.grain') * c.grain,
    });
  }

  #applyFlicker() {
    this.flickerOn = this.config.get('graphics.flicker') && !this.config.get('accessibility.reduceMotion');
    if (!this.flickerOn) {
      this.flickerValue = 0;
      this.flickerFactor = 1;
    }
  }

  #onPose(pose) {
    this.lens.setSeed(pose % 1024);
    if (!this.flickerOn) return;
    // Passeio aleatório curto: cada foto varia um pouco, herdando parte da anterior (tungstênio, obturador).
    const s = FLICKER.smoothing;
    this.flickerValue = this.flickerValue * s + this.rng.float(-1, 1) * (1 - s);
    this.flickerFactor = 1 + FLICKER.amplitude * this.flickerValue;
  }

  /** Antes de cada quadro: exposição final = config × cena × flicker (lida pelo OutputPass). */
  beforeRender() {
    this.renderer.toneMappingExposure = this.config.get('graphics.exposure') * this.sceneExposure * this.flickerFactor;
  }

  /** Resumo para o console (`post`). */
  describe() {
    const on = (p) => (p.enabled ? 'ligado' : 'desligado');
    const p = this.dof.profile;
    const lu = this.lens.material.uniforms;
    return [
      `contexto: ${this.context} (${this.contextDef.label}) · vista: ${this.view}`,
      `AO: ${on(this.ao)}${this.ao.enabled ? ` (${this.ao.level}, raio ${AO.radius} u)` : ''}`,
      `DOF: ${on(this.dof)} · abertura ${p.aperture} · desfoque máx ${p.maxBlur} px@1080 · tilt ${p.tilt}` +
        ` · foco ${this.dof.manualFocus > 0 ? `${this.dof.manualFocus} u (manual)` : 'automático na mira'}`,
      `bloom: ${on(this.bloom)} · limiar ${BLOOM.threshold} · intensidade ${(BLOOM.intensity * this.contextDef.bloom).toFixed(3)}`,
      `SMAA: ${on(this.smaa)} · lente: ${on(this.lens)} · grão ${lu.uGrain.value.toFixed(3)} · vinheta ${lu.uVignette.value.toFixed(2)}` +
        ` · aberração ${lu.uAberration.value.toFixed(4)}`,
      `exposição ${this.renderer.toneMappingExposure.toFixed(3)} (cena ${this.sceneExposure}, flicker ${this.flickerOn ? `±${(FLICKER.amplitude * 100).toFixed(1)}%` : 'desligado'})`,
    ].join('\n');
  }

  dispose() {
    for (const off of this._offs) off();
    this._offs = [];
    for (const pass of [this.ao, this.dof, this.bloom, this.smaa, this.lens]) this.pipeline.removePass(pass);
    for (const pass of [this.ao, this.dof, this.bloom, this.smaa, this.lens]) pass.dispose();
  }
}
