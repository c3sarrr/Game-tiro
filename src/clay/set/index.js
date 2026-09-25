// Biblioteca de materiais do set: assa as texturas procedurais uma vez por renderer, entrega materiais em
// cache (mesma chave = mesmo material, menos programas e trocas de estado) e acompanha a anisotropia da config
// e a perda/recuperação do contexto WebGL (as texturas assadas precisam ser refeitas).
// Mapas pedem materiais aqui: set.cardboard(), set.tape({ width }), set.cuttingMat({ size }), ...
// Materiais que leem um atlas do próprio mapa (livros, desenhos, fita com etiquetas) são criados pelo mapa com as
// fábricas de bookMaterial.js, printMaterials.js e paperMaterials.js e entram na biblioteca por adopt().

import { EV } from '../../core/events.js';
import { bakeSetTextures } from './setTextures.js';
import { cardboardMaterial, tapeMaterial, tapeSideMaterial } from './paperMaterials.js';
import { toolMetalMaterial, wireMaterial, chromeMaterial, blackMetalMaterial } from './metalMaterials.js';
import { balsaMaterial, beechMaterial, benchWoodMaterial, plywoodMaterial } from './woodMaterials.js';
import { cuttingMatMaterial, plasticMaterial, fabricMaterial, diffuserMaterial } from './surfaceMaterials.js';
import { measureMaterial } from './measureMaterials.js';
import { paperMaterial } from './printMaterials.js';
import { paintMaterial, floorPaintMaterial } from './paintMaterials.js';

const FACTORIES = Object.freeze({
  cardboard: cardboardMaterial,
  tape: tapeMaterial,
  tapeSide: tapeSideMaterial,
  toolMetal: toolMetalMaterial,
  wire: wireMaterial,
  chrome: chromeMaterial,
  blackMetal: blackMetalMaterial,
  balsa: balsaMaterial,
  beech: beechMaterial,
  plywood: plywoodMaterial,
  benchWood: benchWoodMaterial,
  cuttingMat: cuttingMatMaterial,
  plastic: plasticMaterial,
  fabric: fabricMaterial,
  diffuser: diffuserMaterial,
  measure: measureMaterial,
  paper: paperMaterial,
  paint: paintMaterial,
  floorPaint: floorPaintMaterial,
});

export class SetLibrary {
  constructor({ events, log }) {
    this.events = events;
    this.log = log;
    this.renderer = null;
    this.textures = null;
    this.cache = new Map();
    this._offs = [];
    for (const kind of Object.keys(FACTORIES)) {
      this[kind] = (opts = {}) => this.get(kind, opts);
    }
  }

  init(renderer, anisotropy = 8) {
    this.renderer = renderer;
    this.anisotropy = anisotropy;
    this.#bake();
    this._offs.push(this.events.on(EV.RENDER_CONTEXT, ({ lost }) => {
      if (!lost) this.#bake();
    }));
  }

  #bake() {
    const t0 = performance.now();
    const old = this.textures;
    this.textures = bakeSetTextures(this.renderer, { anisotropy: this.anisotropy });
    // Materiais já criados passam a apontar para as texturas novas.
    for (const mat of this.cache.values()) {
      for (const u of Object.values(mat.setUniforms)) {
        if (u.value?.isTexture) {
          const key = Object.keys(old ?? {}).find((k) => old[k] === u.value);
          if (key && this.textures[key]) u.value = this.textures[key];
        }
      }
    }
    old?.dispose();
    this.log?.debug(`texturas do set assadas em ${(performance.now() - t0).toFixed(1)} ms`);
  }

  /** Material em cache para (tipo, opções). Opções iguais → mesma instância. */
  get(kind, opts = {}) {
    const factory = FACTORIES[kind];
    if (!factory) throw new Error(`material de set desconhecido: ${kind}`);
    const key = `${kind}:${JSON.stringify(opts)}`;
    let mat = this.cache.get(key);
    if (!mat) {
      const suffix = Object.keys(opts).length ? `-${this.cache.size}` : '';
      mat = factory(this.textures, { ...opts, name: opts.name ?? `${kind}${suffix}` });
      this.cache.set(key, mat);
    }
    return mat;
  }

  /**
   * Adota um material do set criado fora da fábrica (ex.: etiqueta com um atlas de texto do mapa): passa a
   * acompanhar a troca de texturas quando o contexto WebGL volta e sai junto em releaseMaterials(). Texturas
   * próprias do material (o atlas) continuam sendo do chamador.
   */
  adopt(key, material) {
    const k = `adotado:${key}`;
    if (this.cache.has(k)) throw new Error(`material de set já adotado: ${key}`);
    this.cache.set(k, material);
    return material;
  }

  setAnisotropy(a) {
    this.anisotropy = a;
    this.textures?.setAnisotropy(a);
  }

  /** Libera os materiais criados para um mapa (as texturas ficam para o próximo). */
  releaseMaterials() {
    for (const mat of this.cache.values()) mat.dispose();
    this.cache.clear();
  }

  dispose() {
    for (const off of this._offs) off();
    this._offs = [];
    this.releaseMaterials();
    this.textures?.dispose();
    this.textures = null;
  }
}
