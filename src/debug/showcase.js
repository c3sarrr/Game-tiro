// Bancada da vitrine (Fase 2): mesa do animador no meio do estúdio escuro, tapete de corte A1, os 20 objetos de
// src/data/showcase.js numa grade e uma etiqueta de fita crepe escrita a caneta na frente de cada um.
// Também guarda os valores de cada massinha para o painel aplicar multiplicadores (umidade, boil, digitais) sem
// perder a diferença entre os objetos (a massa seca continua seca).
// Referências: docs/art/moodboard.md item 10 (MFP7/MFP9/PLI2: foto de produto de miniatura; SSD1/CSD14: ilha de
// luz no escuro; SMD3: bancada com tapete verde).

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { SHOWCASE_SET, SHOWCASE_OBJECTS } from '../data/showcase.js';
import { buildShowcaseObject } from './showcaseObjects.js';
import { tapeStrip } from '../clay/set/propGeometry.js';
import { bakeLabelAtlas } from '../clay/set/labelAtlas.js';
import { tapeLabelMaterial } from '../clay/set/paperMaterials.js';
import { RNG } from '../core/rng.js';

const DEG = Math.PI / 180;

/** Centro (x, z) de uma célula da grade sobre o tapete. */
export function showcaseCellCenter(col, row, set = SHOWCASE_SET) {
  const { cols, rows, pitchX, pitchZ, originZ } = set.grid;
  return {
    x: set.mat.x + (col - (cols - 1) / 2) * pitchX,
    z: originZ + (row - (rows - 1) / 2) * pitchZ,
  };
}

/** Comprimento (u) da tira de uma etiqueta para um texto com a proporção `aspect` (largura/altura da escrita). */
export function labelLength(aspect, label = SHOWCASE_SET.label) {
  return Math.max(label.tapeWidth * 2.2, aspect * label.textHeight + label.margin * 2);
}

export class ShowcaseBench {
  /**
   * @param {{set:import('../clay/set/index.js').SetLibrary, sdf:import('../clay/sdf/sdfMesher.js').SdfMesher,
   *          anisotropy?:number, log?:object}} ctx
   */
  constructor({ set, sdf, anisotropy = 8, log = null }) {
    this.set = set;
    this.sdf = sdf;
    this.anisotropy = anisotropy;
    this.log = log;
    this.root = new THREE.Group();
    this.root.name = 'vitrine';
    this.objects = new Map(); // id → { def, group, center }
    this.clay = []; // { material, wetness, boil, fingerprints }
    this.labelAtlas = null;
    this.multipliers = { wetness: 1, boil: 1, fingerprints: 1 };
    this.matTop = SHOWCASE_SET.mat.thickness;
  }

  /** Monta tudo na cena. Os objetos SDF saem dos Workers em paralelo com os do kit. */
  async build(scene) {
    const t0 = performance.now();
    scene.add(this.root);
    this.#buildDesk();
    const built = await Promise.all(SHOWCASE_OBJECTS.map(async (def) => {
      const group = await buildShowcaseObject(def, { set: this.set, sdf: this.sdf });
      return { def, group };
    }));
    for (const { def, group } of built) {
      const c = showcaseCellCenter(def.cell[0], def.cell[1]);
      group.position.set(c.x, this.matTop, c.z);
      group.rotation.y = (def.yawDeg ?? 0) * DEG;
      this.root.add(group);
      this.objects.set(def.id, { def, group, center: new THREE.Vector3(c.x, this.matTop, c.z) });
    }
    this.#buildLabels();
    this.#collectClay();
    this.log?.info(`vitrine montada: ${this.objects.size} objetos, ${this.clay.length} massinhas em ${(performance.now() - t0).toFixed(0)} ms`);
    return this;
  }

  #buildDesk() {
    const { desk, mat, floorY, floorColor } = SHOWCASE_SET;
    const wood = this.set.benchWood();
    const top = new THREE.Mesh(new RoundedBoxGeometry(desk.width, desk.thickness, desk.depth, 3, 4), wood);
    top.position.y = -desk.thickness / 2;
    top.name = 'tampo-bancada';
    const legH = -floorY - desk.thickness;
    const legGeo = new RoundedBoxGeometry(desk.legSize, legH, desk.legSize, 2, 5);
    const legs = [];
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const leg = new THREE.Mesh(legGeo, wood);
        leg.position.set(sx * (desk.width / 2 - desk.legInset), floorY + legH / 2, sz * (desk.depth / 2 - desk.legInset));
        leg.name = 'perna-bancada';
        legs.push(leg);
      }
    }
    // Tapete: placa fina de PVC (lateral) + face de cima com o material do tapete de corte (uv 0..1).
    const slab = new THREE.Mesh(new THREE.BoxGeometry(mat.width, mat.thickness, mat.depth), this.set.plastic({ color: '#23553C', moldY: -1e4, name: 'pvc-tapete' }));
    slab.position.set(mat.x, mat.thickness / 2 - 0.05, mat.z);
    const face = new THREE.Mesh(new THREE.PlaneGeometry(mat.width, mat.depth), this.set.cuttingMat({ size: [mat.width, mat.depth], margin: mat.margin }));
    face.rotation.x = -Math.PI / 2;
    face.position.set(mat.x, mat.thickness, mat.z);
    face.name = 'tapete-de-corte';
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(7000, 7000), this.set.fabric({ color: floorColor, name: 'molleton-chao' }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = floorY;
    floor.name = 'chao-estudio';
    for (const m of [top, ...legs, slab, face, floor]) {
      m.castShadow = m !== floor && m !== face;
      m.receiveShadow = true;
      this.root.add(m);
    }
  }

  #buildLabels() {
    const L = SHOWCASE_SET.label;
    const texts = SHOWCASE_OBJECTS.map((d) => d.label);
    this.labelAtlas = bakeLabelAtlas(texts, {
      width: L.atlas.width, cellHeight: L.atlas.cellHeight, columns: L.atlas.columns, font: L.font, anisotropy: this.anisotropy,
    });
    const rng = new RNG('etiquetas-vitrine');
    SHOWCASE_OBJECTS.forEach((def, i) => {
      const info = this.labelAtlas.labels[i];
      const length = labelLength(info.aspect, L);
      const material = this.set.adopt(`etiqueta-${def.id}`, tapeLabelMaterial(this.set.textures, {
        atlas: this.labelAtlas.texture, rect: info.rect, length, width: L.tapeWidth, margin: L.margin, textHeight: L.textHeight,
        ink: L.ink, name: `etiqueta-${def.id}`,
      }));
      const strip = new THREE.Mesh(tapeStrip(length, L.tapeWidth, { seed: `etiqueta-${def.id}`, lift: rng.bool(0.3) ? 1.4 : 0 }), material);
      const c = this.objects.get(def.id).center;
      strip.rotation.set(-Math.PI / 2, 0, rng.float(-L.tiltDeg, L.tiltDeg) * DEG);
      strip.position.set(c.x + rng.float(-6, 6), this.matTop + L.lift, c.z + L.forward + rng.float(-3, 3));
      strip.receiveShadow = true;
      strip.name = `etiqueta-${def.id}`;
      this.root.add(strip);
    });
  }

  #collectClay() {
    const seen = new Set();
    this.root.traverse((o) => {
      if (!o.isMesh) return;
      for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
        if (!m?.isClayMaterial || seen.has(m)) continue;
        seen.add(m);
        this.clay.push({ material: m, wetness: m.clay.wetness, boil: m.clay.boil, fingerprints: m.clay.fingerprints });
      }
    });
  }

  /** Multiplicadores do painel sobre o valor de cada massinha (1 = como foi modelada). */
  setClayMultipliers({ wetness = this.multipliers.wetness, boil = this.multipliers.boil, fingerprints = this.multipliers.fingerprints } = {}) {
    this.multipliers = { wetness, boil, fingerprints };
    for (const c of this.clay) {
      c.material.setWetness(Math.min(1, c.wetness * wetness));
      c.material.setBoil(c.boil * boil);
      c.material.setFingerprints(c.fingerprints * fingerprints);
    }
  }

  /** Objeto mais próximo de um ponto no plano da mesa (foco manual "no objeto" do painel e do console). */
  nearest(point) {
    let best = null;
    let bestD = Infinity;
    for (const o of this.objects.values()) {
      const d = Math.hypot(o.center.x - point.x, o.center.z - point.z);
      if (d < bestD) {
        bestD = d;
        best = o;
      }
    }
    return best;
  }

  dispose() {
    this.labelAtlas?.dispose();
    this.labelAtlas = null;
    this.objects.clear();
    this.clay = [];
  }
}
