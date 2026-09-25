// Montagem de luz de estúdio a partir de src/data/studioRigs.js (seção 0.13 "Iluminação de estúdio").
// Cria as luzes com unidades físicas (intensidade = iluminância no alvo × distância², decaimento 2), o
// equipamento visível (softbox, fresnel, tripés, luminária de mesa), a poeira no feixe da key, a hemisférica
// de rebote e o mapa de ambiente com os painéis das luzes. Ajustes ao vivo (vitrine): iluminância, Kelvin,
// hemisférica e ambiente — o difusor visível e o reflexo no ambiente acompanham a luz.

import * as THREE from 'three';
import { kelvinToColor } from '../colorTemperature.js';
import { studioGlobals } from '../studioGlobals.js';
import { bakeStudioEnvironment } from './environment.js';
import { buildSoftbox, buildFresnel, buildCStand, buildDeskLamp } from './fixtures.js';
import { DustMotes } from './dust.js';

const v3 = (a) => new THREE.Vector3(a[0], a[1], a[2]);

export class StudioRig {
  /**
   * @param {object} opts
   * @param {object} opts.def montagem (STUDIO_RIGS[id])
   * @param {import('../../clay/set/index.js').SetLibrary} opts.set biblioteca de materiais do set
   * @param {THREE.WebGLRenderer} opts.renderer
   * @param {number} [opts.tableY] altura do tampo (a luminária de mesa se apoia nele)
   * @param {number|null} [opts.floorY] chão do estúdio (base dos tripés); null = luzes penduradas
   * @param {THREE.Vector3} [opts.center] centro da cena (de onde o ambiente é assado)
   */
  constructor({ def, set, renderer, tableY = 0, floorY = null, center = new THREE.Vector3() }) {
    this.def = def;
    this.set = set;
    this.renderer = renderer;
    this.tableY = tableY;
    this.floorY = floorY;
    this.center = center.clone();
    this.group = new THREE.Group();
    this.group.name = 'estudio';
    this.entries = [];
    this.geometries = [];
    this.hemi = null;
    this.dust = null;
    this.env = null;
    this.envIntensity = def.environment.intensity;
    this.scene = null;
    this._envDirty = false;
  }

  build(scene) {
    this.scene = scene;
    scene.add(this.group);
    for (const ld of this.def.lights) this.entries.push(this.#makeLight(ld));
    const h = this.def.hemi;
    this.hemi = new THREE.HemisphereLight(new THREE.Color(h.sky), new THREE.Color(h.ground), h.intensity);
    this.hemi.name = 'rebote';
    this.group.add(this.hemi);
    this.group.updateMatrixWorld(true);

    const key = this.entries.find((e) => e.def.id === this.def.dust?.light);
    if (key && key.light.isSpotLight) {
      const d = this.def.dust;
      this.dust = new DustMotes({ light: key.light, count: d.count, size: d.size, drift: d.drift, seed: this.def.dust.light, box: d.box ?? null });
      this.dust.setColor(key.color, 3.2);
      this.group.add(this.dust.points);
    }
    this.#updateSourceAngle();
    scene.background = new THREE.Color(this.def.environment.background);
    this.bakeEnvironment();
    return this;
  }

  #makeLight(ld) {
    const position = v3(ld.position);
    const target = v3(ld.target);
    const distance = position.distanceTo(target);
    const color = kelvinToColor(ld.kelvin);
    let light;
    if (ld.kind === 'spot') {
      light = new THREE.SpotLight(color, 0, ld.distance ?? 0, THREE.MathUtils.degToRad(ld.angleDeg), ld.penumbra, 2);
      light.target.position.copy(target);
      this.group.add(light.target);
    } else {
      light = new THREE.PointLight(color, 0, ld.distance ?? 0, 2);
    }
    light.name = ld.id;
    light.position.copy(position);
    light.intensity = ld.illuminance * distance * distance;
    if (ld.shadow) {
      light.castShadow = true;
      light.shadow.bias = ld.shadow.bias;
      light.shadow.normalBias = ld.shadow.normalBias;
      light.shadow.camera.near = ld.shadow.near;
      light.shadow.camera.far = ld.shadow.far;
      light.userData.shadowSoftness = ld.shadow.softness;
      light.userData.shadowScale = ld.shadow.scale;
      // Frustum da sombra da spot apertado dentro do cone (mais texels no que importa; a borda do cone quase não tem luz).
      if (ld.shadow.focus !== undefined && light.isSpotLight) light.shadow.focus = ld.shadow.focus;
    }
    this.group.add(light);
    const entry = { def: ld, light, position, target, distance, color: color.clone(), illuminance: ld.illuminance, kelvin: ld.kelvin, diffusers: [] };
    this.#buildFixture(entry);
    return entry;
  }

  /** Radiância do difusor visível: a luz espalhada pela área da fonte, contida numa faixa fotográfica. */
  #panelEmission(entry) {
    const f = entry.def.fixture ?? {};
    let area = 400;
    if (f.kind === 'softbox') area = f.width * f.height;
    else if (f.kind === 'fresnel') area = Math.PI * f.radius * f.radius;
    else if (f.kind === 'deskLamp') area = 4 * Math.PI * 49;
    const intensity = entry.illuminance * entry.distance * entry.distance;
    return THREE.MathUtils.clamp(intensity / area, 3, 14);
  }

  #buildFixture(entry) {
    const f = entry.def.fixture;
    if (!f) return;
    const emission = this.#panelEmission(entry);
    const colorHex = `#${entry.color.clone().multiplyScalar(1 / Math.max(entry.color.r, entry.color.g, entry.color.b)).getHexString()}`;
    let built = null;
    if (f.kind === 'softbox') built = buildSoftbox(this.set, { width: f.width, height: f.height, depth: f.depth, emission, color: colorHex });
    else if (f.kind === 'fresnel') built = buildFresnel(this.set, { radius: f.radius, length: f.length, emission, color: colorHex });
    if (built) {
      built.group.position.copy(entry.position);
      built.group.lookAt(entry.target);
      this.group.add(built.group);
      this.geometries.push(...built.geometries);
      built.group.traverse((o) => {
        if (o.isMesh && (o.name === 'difusor' || o.name === 'lente')) entry.diffusers.push(o);
      });
      built.group.updateMatrixWorld(true);
      const mountWorld = built.group.localToWorld(built.mount.clone());
      const away = new THREE.Vector3().subVectors(entry.position, entry.target);
      if (f.stand && this.floorY !== null) {
        const stand = buildCStand(this.set, { mountWorld, awayDir: away, floorY: this.floorY });
        this.group.add(stand.group);
        this.geometries.push(...stand.geometries);
      } else {
        // Pendurada na grelha do teto: tubo vertical do encaixe para cima.
        const len = 600;
        const pipe = new THREE.CylinderGeometry(2.4, 2.4, len, 10).translate(mountWorld.x, mountWorld.y + len / 2, mountWorld.z);
        this.geometries.push(pipe);
        const mesh = new THREE.Mesh(pipe, this.set.blackMetal());
        mesh.castShadow = true;
        this.group.add(mesh);
      }
    } else if (f.kind === 'deskLamp') {
      const lamp = buildDeskLamp(this.set, { bulb: entry.position, target: entry.target, tableY: this.tableY, reach: f.reach, emission, color: colorHex });
      this.group.add(lamp.group);
      this.geometries.push(...lamp.geometries);
      lamp.group.traverse((o) => {
        if (o.isMesh && o.material?.setUniforms?.uEmit) entry.diffusers.push(o);
      });
    }
  }

  #updateSourceAngle() {
    const key = this.entries.find((e) => e.def.id === 'key') ?? this.entries[0];
    if (!key) return;
    studioGlobals.uStudioSourceAngle.value = THREE.MathUtils.clamp((key.def.sourceRadius ?? 60) / key.distance, 0.02, 0.4);
  }

  /** (Re)assa o mapa de ambiente com os painéis nas cores/intensidades atuais. */
  bakeEnvironment() {
    const lights = this.entries.map((e) => ({ id: e.def.id, position: e.position, target: e.target, color: e.color, fixture: e.def.fixture }));
    const old = this.env;
    this.env = bakeStudioEnvironment(this.renderer, this.def.environment, lights, this.center);
    this.scene.environment = this.env.texture;
    this.scene.environmentIntensity = this.envIntensity;
    old?.dispose();
    this._envDirty = false;
  }

  get lights() {
    return this.entries;
  }

  entry(id) {
    return this.entries.find((e) => e.def.id === id) ?? null;
  }

  /** Iluminância no alvo (lux do three). O difusor visível acompanha. */
  setIlluminance(id, value) {
    const e = this.entry(id);
    if (!e) return;
    e.illuminance = value;
    e.light.intensity = value * e.distance * e.distance;
    this.#syncDiffusers(e);
    if (e.def.id === this.def.dust?.light && this.dust) this.dust.setColor(e.color, 3.2 * (value / e.def.illuminance));
  }

  /** Temperatura de cor (K): luz, difusor e (no próximo assar) o ambiente. */
  setKelvin(id, kelvin) {
    const e = this.entry(id);
    if (!e) return;
    e.kelvin = kelvin;
    kelvinToColor(kelvin, e.color);
    e.light.color.copy(e.color);
    this.#syncDiffusers(e);
    if (e.def.id === this.def.dust?.light && this.dust) this.dust.setColor(e.color, 3.2 * (e.illuminance / e.def.illuminance));
    this._envDirty = true;
  }

  #syncDiffusers(e) {
    const emission = this.#panelEmission(e);
    const norm = e.color.clone().multiplyScalar(1 / Math.max(e.color.r, e.color.g, e.color.b));
    for (const mesh of e.diffusers) mesh.material.setUniforms.uEmit.value.copy(norm).multiplyScalar(emission);
  }

  setHemi(intensity) {
    this.hemi.intensity = intensity;
  }

  setEnvironment(intensity) {
    this.envIntensity = intensity;
    if (this.scene) this.scene.environmentIntensity = intensity;
  }

  /** Aplica mudanças pendentes que custam mais (ambiente) — chamar ao soltar um controle. */
  commit() {
    if (this._envDirty) this.bakeEnvironment();
  }

  setDustDensity(fraction) {
    this.dust?.setDensity(fraction);
  }

  onPose(pose) {
    this.dust?.step(pose);
  }

  /** Por quadro: escala de pixel da poeira (depende da resolução e do FOV da câmera). */
  frame(camera, drawingHeight) {
    if (this.dust && camera?.isPerspectiveCamera) {
      this.dust.setPixelScale(drawingHeight / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2)));
    }
  }

  dispose() {
    this.dust?.dispose();
    this.env?.dispose();
    if (this.scene?.environment === this.env?.texture) this.scene.environment = null;
    for (const g of this.geometries) g.dispose();
    this.geometries = [];
    this.group.removeFromParent();
    for (const e of this.entries) e.light.dispose?.();
    this.entries = [];
  }
}
