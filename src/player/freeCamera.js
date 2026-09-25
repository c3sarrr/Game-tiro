// Câmera FPS livre (sala de testes / espectador / noclip). Movimento com aceleração e atrito no modelo do CS
// (sv_accelerate/sv_friction), simulado a 64 Hz e interpolado no render. O olhar é aplicado por quadro.

import * as THREE from 'three';
import { FREE_CAMERA as P } from '../data/sandbox.js';

const PITCH_LIMIT = (89 * Math.PI) / 180;
const _wish = new THREE.Vector3();
const _fwd = new THREE.Vector3();
const _right = new THREE.Vector3();

export class FreeCamera {
  /** `speedScale`: mapas pequenos (vitrine) pedem voo mais lento para olhar a massinha de perto. */
  constructor({ position, yaw = 0, pitch = 0, bounds = null, speedScale = 1 }) {
    this.pos = position.clone();
    this.prevPos = position.clone();
    this.vel = new THREE.Vector3();
    this.yaw = yaw;
    this.pitch = pitch;
    this.bounds = bounds;
    this.speedScale = speedScale;
    this.stats = { distance: 0, topSpeed: 0, ticks: 0 };
  }

  applyLook({ yaw, pitch }) {
    this.yaw += yaw;
    this.pitch = Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, this.pitch + pitch));
  }

  /** Um tick de simulação. `input`: InputManager já amostrado neste tick. */
  tick(dt, input, { noclip = false } = {}) {
    this.prevPos.copy(this.pos);
    const cp = Math.cos(this.pitch);
    _fwd.set(-Math.sin(this.yaw) * cp, Math.sin(this.pitch), -Math.cos(this.yaw) * cp);
    _right.set(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    const move = input.move;
    const up = (input.isDown('jump') ? 1 : 0) - (input.isDown('crouch') ? 1 : 0);
    let speed = P.speed * this.speedScale;
    if (input.isDown('walk')) speed *= P.walkFactor;
    if (input.isDown('aim')) speed *= P.boostFactor;

    _wish.set(0, 0, 0).addScaledVector(_fwd, move.y).addScaledVector(_right, move.x);
    const planar = _wish.length();
    if (planar > 1) _wish.divideScalar(planar);
    _wish.multiplyScalar(speed);
    _wish.y += up * P.verticalSpeed * (speed / P.speed);
    const wishSpeed = _wish.length();

    // Atrito (sempre, como no chão do CS).
    const v = this.vel.length();
    if (v > 0) {
      const control = Math.max(v, P.stopSpeed);
      const drop = control * P.friction * dt;
      this.vel.multiplyScalar(Math.max(v - drop, 0) / v);
    }
    // Aceleração em direção ao desejo.
    if (wishSpeed > 0) {
      _wish.divideScalar(wishSpeed);
      const current = this.vel.dot(_wish);
      const add = wishSpeed - current;
      if (add > 0) this.vel.addScaledVector(_wish, Math.min(P.accelerate * wishSpeed * dt, add));
    }

    this.pos.addScaledVector(this.vel, dt);
    if (!noclip && this.bounds) this.#collide();

    this.stats.distance += this.pos.distanceTo(this.prevPos);
    this.stats.topSpeed = Math.max(this.stats.topSpeed, this.vel.length());
    this.stats.ticks++;
  }

  #collide() {
    const r = P.radius;
    const b = this.bounds;
    const axes = ['x', 'y', 'z'];
    for (const a of axes) {
      const min = b.min[a] + (a === 'y' ? 8 : r);
      const max = b.max[a] - r;
      if (this.pos[a] < min) {
        this.pos[a] = min;
        if (this.vel[a] < 0) this.vel[a] = 0;
      } else if (this.pos[a] > max) {
        this.pos[a] = max;
        if (this.vel[a] > 0) this.vel[a] = 0;
      }
    }
  }

  /** Posiciona a câmera: posição interpolada entre ticks, rotação do último quadro (resposta imediata). */
  updateCamera(camera, alpha) {
    camera.position.lerpVectors(this.prevPos, this.pos, alpha);
    camera.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
  }

  teleport(position, yaw = this.yaw, pitch = this.pitch) {
    this.pos.copy(position);
    this.prevPos.copy(position);
    this.vel.set(0, 0, 0);
    this.yaw = yaw;
    this.pitch = pitch;
  }
}
