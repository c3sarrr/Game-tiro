// Poeira nos feixes de luz (seção 0.13 "Poeira e fiapos"; referências CSD8, SSD16): pontinhos que só aparecem
// dentro do cone da key e brilham mais olhando contra a luz (espalhamento para a frente, Henyey–Greenstein).
// Como tudo no mundo stop-motion, a poeira muda de lugar a cada POSE (12/s), não a cada quadro: cada foto
// pega a poeira num lugar novo, flutuando devagar com a convecção do calor da lâmpada.
// Com `box`, a poeira só ocupa a parte do cone dentro da caixa (a pista: o ar da base, onde o boneco anda — a key fica
// a 10 m e o cone inteiro espalharia os grãos longe da câmera).

import * as THREE from 'three';
import { RNG } from '../../core/rng.js';

const _p = new THREE.Vector3();

const VERT = /* glsl */ `
attribute float aSize;
attribute float aTwinkle;
uniform vec3 uLightPos;
uniform vec3 uLightDir;
uniform float uCosOuter;
uniform float uCosInner;
uniform float uRange;
uniform float uSize;
uniform float uPixelScale;
uniform float uPose;
varying float vBright;
void main() {
  vec4 world = modelMatrix * vec4(position, 1.0);
  vec3 toP = world.xyz - uLightPos;
  float dist = length(toP);
  vec3 dirL = toP / max(dist, 1e-4);
  float cone = smoothstep(uCosOuter, uCosInner, dot(dirL, uLightDir));
  // Queda com a distância normalizada pelo alcance do feixe (evita estourar perto da lâmpada).
  float fall = 1.0 / (1.0 + pow(dist / uRange, 2.0) * 1.5);
  // Espalhamento para a frente (g = 0,6): contra a luz a poeira acende.
  vec3 toCam = normalize(cameraPosition - world.xyz);
  float cosT = dot(-toCam, -dirL);
  float g = 0.6;
  float hg = (1.0 - g * g) / pow(1.0 + g * g - 2.0 * g * cosT, 1.5) * 0.25;
  // Cintilar por pose: cada grão vira um pouco para a luz ou não naquela foto.
  float tw = 0.55 + 0.45 * fract(sin(aTwinkle * 91.7 + uPose * 12.9898) * 43758.5453);
  vBright = cone * fall * hg * tw;
  vec4 mv = viewMatrix * world;
  gl_Position = projectionMatrix * mv;
  gl_PointSize = max(1.0, uSize * aSize * uPixelScale / max(-mv.z, 1.0));
}
`;

const FRAG = /* glsl */ `
uniform vec3 uColor;
varying float vBright;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float r2 = dot(c, c) * 4.0;
  float a = exp(-r2 * 3.0) * (1.0 - smoothstep(0.7, 1.0, r2));
  if (a * vBright < 0.002) discard;
  gl_FragColor = vec4(uColor * vBright * a, 1.0);
}
`;

export class DustMotes {
  /**
   * @param {{light: THREE.SpotLight, count:number, size:number, drift:number, seed?:string,
   *   box?: {min:number[], max:number[]}|null}} opts
   */
  constructor({ light, count, size = 1.6, drift = 6, seed = 'poeira', box = null }) {
    this.light = light;
    this.capacity = count;
    this.drift = drift;
    this.box = box ? new THREE.Box3(new THREE.Vector3(...box.min), new THREE.Vector3(...box.max)) : null;
    this.rng = new RNG(`poeira:${seed}`);
    this.positions = new Float32Array(count * 3);
    this.velocity = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    const twinkle = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      this.#spawn(i);
      sizes[i] = this.rng.float(0.5, 1.6);
      twinkle[i] = this.rng.float(0, 100);
    }
    this.geometry = new THREE.BufferGeometry();
    this.posAttr = new THREE.BufferAttribute(this.positions, 3);
    this.posAttr.setUsage(THREE.DynamicDrawUsage);
    this.geometry.setAttribute('position', this.posAttr);
    this.geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
    this.geometry.setAttribute('aTwinkle', new THREE.BufferAttribute(twinkle, 1));
    this.material = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms: {
        uLightPos: { value: new THREE.Vector3() },
        uLightDir: { value: new THREE.Vector3(0, -1, 0) },
        uCosOuter: { value: 0.8 },
        uCosInner: { value: 0.9 },
        uRange: { value: 1000 },
        uSize: { value: size },
        uPixelScale: { value: 800 },
        uPose: { value: 0 },
        uColor: { value: new THREE.Color(1, 1, 1) },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.points = new THREE.Points(this.geometry, this.material);
    this.points.name = 'poeira';
    this.points.frustumCulled = false;
    this.points.renderOrder = 10;
    this.syncLight();
  }

  #coneFrame() {
    const l = this.light;
    const pos = l.getWorldPosition(new THREE.Vector3());
    const tgt = l.target.getWorldPosition(new THREE.Vector3());
    const axis = tgt.clone().sub(pos);
    const range = axis.length();
    axis.normalize();
    const u = new THREE.Vector3().crossVectors(axis, Math.abs(axis.y) > 0.9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0)).normalize();
    const v = new THREE.Vector3().crossVectors(axis, u);
    return { pos, axis, u, v, range };
  }

  /** Com caixa: um ponto sorteado na caixa que esteja dentro do cone (até 48 tentativas; senão, o sorteio do cone). */
  #spawnInBox(i, f) {
    const b = this.box;
    const cosOuter = Math.cos(this.light.angle) + 0.004;
    for (let k = 0; k < 48; k++) {
      const x = this.rng.float(b.min.x, b.max.x);
      const y = this.rng.float(b.min.y, b.max.y);
      const z = this.rng.float(b.min.z, b.max.z);
      const dx = x - f.pos.x;
      const dy = y - f.pos.y;
      const dz = z - f.pos.z;
      if ((dx * f.axis.x + dy * f.axis.y + dz * f.axis.z) / Math.hypot(dx, dy, dz) < cosOuter) continue;
      this.positions[i * 3] = x;
      this.positions[i * 3 + 1] = y;
      this.positions[i * 3 + 2] = z;
      return true;
    }
    return false;
  }

  #spawn(i) {
    const f = this._frame ?? (this._frame = this.#coneFrame());
    if (this.box && this.#spawnInBox(i, f)) {
      this.velocity[i * 3] = this.rng.float(-1, 1);
      this.velocity[i * 3 + 1] = this.rng.float(0, 1);
      this.velocity[i * 3 + 2] = this.rng.float(-1, 1);
      return;
    }
    const t = this.rng.float(0.2, 1.15) * f.range;
    const radius = Math.tan(this.light.angle) * t * Math.sqrt(this.rng.next()) * 0.95;
    const a = this.rng.float(0, Math.PI * 2);
    const x = f.pos.x + f.axis.x * t + (f.u.x * Math.cos(a) + f.v.x * Math.sin(a)) * radius;
    const y = f.pos.y + f.axis.y * t + (f.u.y * Math.cos(a) + f.v.y * Math.sin(a)) * radius;
    const z = f.pos.z + f.axis.z * t + (f.u.z * Math.cos(a) + f.v.z * Math.sin(a)) * radius;
    this.positions[i * 3] = x;
    this.positions[i * 3 + 1] = y;
    this.positions[i * 3 + 2] = z;
    this.velocity[i * 3] = this.rng.float(-1, 1);
    this.velocity[i * 3 + 1] = this.rng.float(0, 1);
    this.velocity[i * 3 + 2] = this.rng.float(-1, 1);
  }

  /** Luz mudou (posição/alvo/ângulo): atualiza o cone do shader e redistribui a poeira. */
  syncLight() {
    this._frame = this.#coneFrame();
    const u = this.material.uniforms;
    u.uLightPos.value.copy(this._frame.pos);
    u.uLightDir.value.copy(this._frame.axis);
    u.uCosOuter.value = Math.cos(this.light.angle);
    u.uCosInner.value = Math.cos(this.light.angle * (1 - this.light.penumbra * 0.6));
    u.uRange.value = this._frame.range;
  }

  /** Cor/intensidade do brilho (radiância HDR) a partir da cor da luz. */
  setColor(color, strength) {
    this.material.uniforms.uColor.value.copy(color).multiplyScalar(strength);
  }

  /** Quantos grãos desenhar (graphics.particles). */
  setDensity(fraction) {
    this.geometry.setDrawRange(0, Math.round(this.capacity * Math.max(0, Math.min(1, fraction))));
  }

  /** Um passo por pose: caminhada aleatória + subida lenta (convecção); quem sai do feixe renasce nele. */
  step(pose) {
    this.material.uniforms.uPose.value = pose;
    const f = this._frame;
    const p = this.positions;
    const vel = this.velocity;
    const d = this.drift / 12;
    const cosOuter = Math.cos(this.light.angle);
    for (let i = 0; i < this.capacity; i++) {
      const k = i * 3;
      vel[k] = vel[k] * 0.8 + this.rng.float(-1, 1) * 0.2;
      vel[k + 1] = vel[k + 1] * 0.8 + (this.rng.float(-1, 1) * 0.2 + 0.06);
      vel[k + 2] = vel[k + 2] * 0.8 + this.rng.float(-1, 1) * 0.2;
      p[k] += vel[k] * d;
      p[k + 1] += vel[k + 1] * d;
      p[k + 2] += vel[k + 2] * d;
      const dx = p[k] - f.pos.x;
      const dy = p[k + 1] - f.pos.y;
      const dz = p[k + 2] - f.pos.z;
      const along = dx * f.axis.x + dy * f.axis.y + dz * f.axis.z;
      const len = Math.hypot(dx, dy, dz);
      const outside = this.box
        ? !this.box.containsPoint(_p.set(p[k], p[k + 1], p[k + 2]))
        : along < f.range * 0.15 || along > f.range * 1.2;
      if (outside || along / Math.max(len, 1e-4) < cosOuter) this.#spawn(i);
    }
    this.posAttr.needsUpdate = true;
  }

  /** Escala de pixel do ponto (altura do buffer / (2·tan(fov/2))). */
  setPixelScale(scale) {
    this.material.uniforms.uPixelScale.value = scale;
  }

  dispose() {
    this.points.removeFromParent();
    this.geometry.dispose();
    this.material.dispose();
  }
}
