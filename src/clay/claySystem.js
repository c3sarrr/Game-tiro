// Estado global da massinha: uniforms compartilhados por todos os ClayMaterial (pose stop-motion, atlas,
// tempo), registro dos materiais vivos e chaves de qualidade (digitais on/off, boil on/off, resolução do atlas).
// A pose muda a 12/s (EV.POSE): cada troca sorteia um vetor novo que "congela" o boil e o tremor das digitais
// até a próxima pose — como a massa que o animador tocou entre duas fotos.

import * as THREE from 'three';
import { EV } from '../core/events.js';
import { RNG } from '../core/rng.js';
import { bakeClayAtlases } from './atlases.js';

function neutralTexture(r, g, b, a) {
  const tex = new THREE.DataTexture(new Uint8Array([r, g, b, a]), 1, 1, THREE.RGBAFormat);
  tex.needsUpdate = true;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

/** Uniforms compartilhados (mesmo objeto em todos os materiais: atualizar .value vale para todos). */
export const clayGlobals = Object.freeze({
  uClayPose: { value: 0 },
  uClayPoseRand: { value: new THREE.Vector4(0.5, 0.5, 0.5, 0.5) },
  uClayTime: { value: 0 },
  uClayFpAtlas: { value: neutralTexture(128, 128, 0, 0) },
  uClayToolAtlas: { value: neutralTexture(128, 128, 0, 0) },
  // Diagnóstico "massa preta" (rgb = cor de destaque, w = limiar de radiância linear).
  uClayProbe: { value: new THREE.Vector4(1, 0, 0.83, 0.0045) },
});

/** Chaves de compilação (defines) atuais — lidas por cada material ao compilar. */
export const clayFlags = { fingerprints: true, boil: true, blackProbe: false };

const registry = new Set();

export function registerClayMaterial(material) {
  registry.add(material);
}

export function unregisterClayMaterial(material) {
  registry.delete(material);
}

export function clayMaterialCount() {
  return registry.size;
}

export class ClaySystem {
  constructor({ events, config, log }) {
    this.events = events;
    this.config = config;
    this.log = log;
    this.rng = new RNG('boil');
    this.atlases = null;
    this.renderer = null;
    this._offs = [];
  }

  init(renderer, anisotropy = 8) {
    this.renderer = renderer;
    this.anisotropy = anisotropy;
    this.#applyFlags();
    this.bake();
    this._offs.push(this.events.on(EV.POSE, ({ pose }) => this.#onPose(pose)));
    this._offs.push(this.config.watch('graphics.clay', (e) => {
      if (e.key === 'graphics.clayAtlas') this.bake();
      else this.#applyFlags();
    }));
    this._offs.push(this.config.watch('accessibility.reduceMotion', () => this.#applyFlags()));
    // Contexto WebGL recuperado: o conteúdo dos alvos assados se perdeu com a GPU — assa de novo.
    this._offs.push(this.events.on(EV.RENDER_CONTEXT, ({ lost }) => {
      if (!lost) this.bake();
    }));
  }

  /** (Re)assa os atlas na resolução da config. */
  bake() {
    const size = this.config.get('graphics.clayAtlas');
    const t0 = performance.now();
    const atlases = bakeClayAtlases(this.renderer, { size, anisotropy: this.anisotropy });
    const old = this.atlases;
    this.atlases = atlases;
    clayGlobals.uClayFpAtlas.value = atlases.fingerprint.texture;
    clayGlobals.uClayToolAtlas.value = atlases.tool.texture;
    old?.fingerprint.dispose();
    old?.tool.dispose();
    this.log?.debug(`atlas de massinha ${size}px assados em ${(performance.now() - t0).toFixed(1)} ms`);
  }

  setAnisotropy(a) {
    this.anisotropy = a;
    if (!this.atlases) return;
    for (const rt of [this.atlases.fingerprint, this.atlases.tool]) {
      rt.texture.anisotropy = a;
      rt.texture.needsUpdate = true;
    }
  }

  /**
   * Diagnóstico do aceite da Fase 2 ("nada preto nas sombras"): pinta com `color` toda massinha cuja radiância
   * final (antes da exposição e do tone mapping) fique abaixo de `threshold`. Só para depuração (vitrine e
   * console `r_massa_preta`); recompila os materiais de massinha ao ligar/desligar.
   */
  setBlackProbe(on, { threshold, color } = {}) {
    const probe = clayGlobals.uClayProbe.value;
    if (typeof threshold === 'number') probe.w = threshold;
    if (color) {
      const c = new THREE.Color(color);
      probe.set(c.r, c.g, c.b, probe.w);
    }
    if (!!on === clayFlags.blackProbe) return;
    clayFlags.blackProbe = !!on;
    for (const m of registry) m.needsUpdate = true;
  }

  #onPose(pose) {
    clayGlobals.uClayPose.value = pose;
    clayGlobals.uClayPoseRand.value.set(this.rng.next(), this.rng.next(), this.rng.next(), this.rng.next());
  }

  #applyFlags() {
    const fp = this.config.get('graphics.clayFingerprints');
    const boil = this.config.get('graphics.clayBoil') && !this.config.get('accessibility.reduceMotion');
    if (fp === clayFlags.fingerprints && boil === clayFlags.boil) return;
    clayFlags.fingerprints = fp;
    clayFlags.boil = boil;
    for (const m of registry) m.needsUpdate = true;
  }

  update(dt) {
    clayGlobals.uClayTime.value += dt;
  }

  dispose() {
    for (const off of this._offs) off();
    this._offs = [];
    this.atlases?.fingerprint.dispose();
    this.atlases?.tool.dispose();
    this.atlases = null;
  }
}
