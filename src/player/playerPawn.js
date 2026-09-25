// Jogador local no modo "andar": estado de movimento, item na mão (troca e luneta), precisão da arma, comando do tick e
// câmera. Cada tick segue a ordem do RunCommand do Source: troca de item → playerMove → precisão (pouso e penalidade) →
// luneta (vale a partir do tick seguinte). O render interpola pés, altura do olho e o FOV da luneta entre os ticks e
// suaviza degraus e a troca de cápsula no ar. Em terceira pessoa (debug) a câmera recua atrás do jogador e se recolhe
// ao encostar em parede.

import * as THREE from 'three';
import { EV } from '../core/events.js';
import { VIEW } from '../data/movement.js';
import { SCOPE, WEAPONS, fireInterval } from '../data/weapons.js';
import { CharacterController } from '../physics/characterController.js';
import { createTrace } from '../physics/collisionWorld.js';
import { setCameraFov } from '../render/camera.js';
import {
  applySelect, autoSwitchSelect, createHands, isSlowSniper, itemSpeed, syncHands, updateZoom, weaponAlt, zoomFov,
  zoomLookScale, zoomTime,
} from './hands.js';
import {
  accuracyData, createAccuracyState, inaccuracyOf, landAccuracy, precisionThreshold, resetAccuracy, updateAccuracy,
} from './inaccuracy.js';
import { Loadout } from './loadout.js';
import { BTN, createMoveCmd, readMoveCmd } from './moveCmd.js';
import { MOVETYPE, createMoveState, eyeHeight, playerMove } from './movement.js';
import { TFLAG, Telemetry } from './telemetry.js';

const DEG = Math.PI / 180;
const PITCH_LIMIT = 89 * DEG;
// Média móvel do custo da física por tick: o relógio do navegador é grosso (5–100 µs), um tick sozinho não diz nada.
const US_SMOOTHING = 0.05;

/** Multiplicador da tangente do FOV para um FOV na referência de 90° do CS. */
const fovFactor = (deg) => Math.tan((deg / 2) * DEG) / Math.tan((SCOPE.referenceFov / 2) * DEG);

export class PlayerPawn {
  /**
   * @param {{world, sv, loadout?, events?, position: THREE.Vector3, yaw?: number, pitch?: number}} opts
   *   `world`: CollisionWorld do mapa; `sv`: variáveis de movimento; `loadout`: inventário (o item na mão sai dele);
   *   `events`: barramento para EV.PLAYER_*.
   */
  constructor({ world, sv, loadout = new Loadout(), events = null, position, yaw = 0, pitch = 0 }) {
    this.world = world;
    this.bus = events;
    this.loadout = loadout;
    this.controller = new CharacterController(world, sv);
    this.state = createMoveState({ position });
    this.cmd = createMoveCmd();
    this.hands = createHands();
    this.accuracy = createAccuracyState();
    this.inaccuracy = { base: 0, move: 0, air: 0, total: 0 };
    // Item na mão no modo atual: o playerMove lê `speed` e `slowSniper`; a precisão lê o resto.
    this.held = { id: null, alt: false, speed: 0, slowSniper: false, data: accuracyData(null), cycleTime: 0 };
    this.env = { controller: this.controller, sv, dt: 1 / 64, item: this.held, events: [] };
    this.telemetry = new Telemetry();
    this.pendingSelect = 0; // troca automática pedida pelo inventário (entra no próximo comando)
    // FOV da luneta (só visual): transição linear em graus na referência de 90°, avançada por tick e interpolada no
    // quadro (`prev`/`now`: multiplicador da tangente nos dois últimos ticks).
    const fov = SCOPE.referenceFov;
    this.fov = { deg: fov, from: fov, to: fov, time: 0, duration: 0, prev: 1, now: 1 };
    this.yaw = yaw;
    this.pitch = pitch;
    this.thirdPerson = false;
    this.prevOrigin = new THREE.Vector3();
    this.smooth = 0; // deslocamento da câmera ainda por suavizar (u)
    this.eyeOffset = 0;
    this.prevEyeOffset = 0;
    this.lastLanding = null;
    this.lastStep = null;
    this.stats = { distance: 0, topSpeed: 0, ticks: 0, jumps: 0, steps: 0 };
    // Custo da física do jogador: µs por tick (média móvel) e as consultas do último tick.
    this.physicsStats = { us: 0, sweeps: 0, overlaps: 0, triangles: 0 };
    this._camTrace = createTrace();
    this._before = { sweeps: 0, overlaps: 0, triangles: 0 };
    this._acc = { onGround: false, ducking: false, walking: false, speed2d: 0, vy: 0, weaponSpeed: 0 };
    syncHands(this.hands, this.loadout);
    this.#updateHeld();
    this.teleport(position, yaw, pitch);
  }

  /** Pés do jogador (console: getpos/setpos). */
  get pos() {
    return this.state.origin;
  }

  applyLook({ yaw, pitch }) {
    this.yaw += yaw;
    this.pitch = Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, this.pitch + pitch));
  }

  /** Multiplicador da sensibilidade do olhar: com luneta, zoomSensitivity × fov/90. */
  lookScale(zoomSensitivity) {
    return zoomLookScale(this.hands.item, this.hands.zoom, zoomSensitivity);
  }

  /** O inventário recebeu algo (give, loja): arma de posto melhor que a da mão é sacada no próximo tick. */
  onLoadout(received) {
    if (received?.kind !== 'weapon') return;
    const select = autoSwitchSelect(this.hands, received.slot);
    if (select) this.pendingSelect = select;
  }

  /** Um tick: lê a entrada, troca de item, move, atualiza precisão e luneta, suaviza a câmera e publica os eventos. */
  tick(dt, input, { noclip = false, tick = 0 } = {}) {
    const s = this.state;
    this.prevOrigin.copy(s.origin);
    this.prevEyeOffset = this.eyeOffset;
    s.moveType = noclip ? MOVETYPE.NOCLIP : MOVETYPE.WALK;
    const cmd = readMoveCmd(this.cmd, input, tick, this.yaw, this.pitch);
    if (!cmd.select && this.pendingSelect) cmd.select = this.pendingSelect;
    this.pendingSelect = 0;
    this.env.dt = dt;
    // 1) Item na mão antes do movimento: a velocidade deste tick já é a do item novo.
    applySelect(this.hands, this.loadout, cmd.select);
    this.#syncHands();
    // 2) Movimento, com o custo medido.
    const w = this.world.stats;
    const before = this._before;
    before.sweeps = w.sweeps;
    before.overlaps = w.overlaps;
    before.triangles = w.triangles;
    const t0 = performance.now();
    playerMove(s, cmd, this.env);
    const us = (performance.now() - t0) * 1000;
    const ps = this.physicsStats;
    ps.us += (us - ps.us) * US_SMOOTHING;
    ps.sweeps = w.sweeps - before.sweeps;
    ps.overlaps = w.overlaps - before.overlaps;
    ps.triangles = w.triangles - before.triangles;
    // 3) Precisão (ItemPostFrame): o pouso do tick soma, depois a penalidade anda.
    this.#updateAccuracy(dt);
    // 4) Luneta: o nível novo muda velocidade e precisão a partir do próximo tick.
    const zoomBefore = this.hands.zoom;
    if (updateZoom(this.hands, (cmd.buttons & BTN.ATTACK2) !== 0, dt, !noclip)) this.#onZoom(zoomBefore);
    this.#advanceFov(dt);
    // Câmera: o que o tick subiu/desceu de uma vez entra na suavização, que decai para zero.
    this.smooth = Math.max(-VIEW.smoothMax, Math.min(VIEW.smoothMax, this.smooth + s.viewOffset));
    this.smooth *= Math.exp(-dt / VIEW.smoothTime);
    this.eyeOffset = eyeHeight(s) + this.smooth;
    const events = this.env.events;
    for (let i = 0; i < events.length; i++) this.#onEvent(events[i]);
    this.#record(cmd);
    const st = this.stats;
    st.distance += s.origin.distanceTo(this.prevOrigin);
    st.topSpeed = Math.max(st.topSpeed, Math.hypot(s.velocity.x, s.velocity.z));
    st.ticks++;
  }

  /** Item resolvido no tick: se mudou (sacou), zera a precisão, volta o FOV na hora e avisa. */
  #syncHands() {
    const h = this.hands;
    const previous = h.item;
    const wasZoomed = this.fov.to !== SCOPE.referenceFov;
    if (!syncHands(h, this.loadout)) return;
    resetAccuracy(this.accuracy);
    this.#updateHeld();
    const f = this.fov;
    f.deg = f.from = f.to = SCOPE.referenceFov;
    f.time = f.duration = 0;
    f.prev = f.now = 1;
    if (!this.bus) return;
    this.bus.emit(EV.PLAYER_WEAPON, { item: h.item, previous, slot: h.slot });
    if (wasZoomed) this.bus.emit(EV.PLAYER_ZOOM, { level: 0, fov: null });
  }

  /** Velocidade, modo, sniper lenta e dados de precisão do item na mão (depois de troca ou de mudar o zoom). */
  #updateHeld() {
    const h = this.hands;
    const held = this.held;
    held.id = h.item;
    held.alt = weaponAlt(h.item, h.zoom);
    held.speed = itemSpeed(h.item, held.alt);
    held.slowSniper = isSlowSniper(h.item, h.zoom, held.alt);
    held.data = accuracyData(h.item);
    held.cycleTime = WEAPONS[h.item] ? fireInterval(WEAPONS[h.item]) : 0;
  }

  /** Nível de zoom mudou: modo da arma, transição do FOV e aviso. */
  #onZoom(previous) {
    const h = this.hands;
    this.#updateHeld();
    const f = this.fov;
    f.from = f.deg;
    f.to = zoomFov(h.item, h.zoom) ?? SCOPE.referenceFov;
    f.time = 0;
    f.duration = zoomTime(h.item, h.zoom);
    if (this.bus && h.zoom !== previous) this.bus.emit(EV.PLAYER_ZOOM, { level: h.zoom, fov: zoomFov(h.item, h.zoom) });
  }

  /** Avança a transição do FOV da luneta um tick (a câmera interpola entre `prev` e `now`). */
  #advanceFov(dt) {
    const f = this.fov;
    f.prev = f.now;
    f.time = Math.min(f.duration, f.time + dt);
    f.deg = f.from + (f.to - f.from) * (f.duration > 0 ? f.time / f.duration : 1);
    f.now = fovFactor(f.deg);
  }

  /** Precisão do tick com o jogador depois do movimento: pouso, penalidade e o total (com as partes). */
  #updateAccuracy(dt) {
    const s = this.state;
    const held = this.held;
    const acc = this.accuracy;
    const events = this.env.events;
    for (let i = 0; i < events.length; i++) {
      if (events[i].type === 'land') landAccuracy(acc, held.data, held.alt, events[i].speed);
    }
    const p = this._acc;
    p.onGround = s.onGround;
    p.ducking = s.duckFlag;
    p.walking = s.walking;
    p.speed2d = Math.hypot(s.velocity.x, s.velocity.z);
    p.vy = s.velocity.y;
    p.weaponSpeed = held.speed;
    updateAccuracy(acc, held.data, held.alt, p, held.cycleTime, dt);
    inaccuracyOf(acc, held.data, held.alt, p, this.env.sv.jump_impulse, this.inaccuracy);
  }

  /** Amostra do tick na telemetria (gráfico do cl_showpos e medidor de counter-strafe). */
  #record(cmd) {
    const s = this.state;
    const sy = Math.sin(cmd.yaw);
    const cy = Math.cos(cmd.yaw);
    let flags = 0;
    if (s.onGround) flags |= TFLAG.GROUND;
    if (s.walking) flags |= TFLAG.WALK;
    if (s.duckFlag) flags |= TFLAG.DUCK;
    this.telemetry.record(
      Math.hypot(s.velocity.x, s.velocity.z), s.maxSpeed, this.held.speed, precisionThreshold(this.held.speed),
      this.inaccuracy.total, -sy * cmd.forward + cy * cmd.side, -cy * cmd.forward - sy * cmd.side,
      s.velocity.x, s.velocity.z, flags,
    );
  }

  #onEvent(e) {
    if (e.type === 'jump') this.stats.jumps++;
    else if (e.type === 'land') this.lastLanding = e;
    else if (e.type === 'step') {
      this.lastStep = e;
      this.stats.steps++;
    }
    if (!this.bus) return;
    if (e.type === 'jump') this.bus.emit(EV.PLAYER_JUMP, e);
    else if (e.type === 'land') this.bus.emit(EV.PLAYER_LAND, e);
    else if (e.type === 'step') this.bus.emit(EV.PLAYER_STEP, e);
    else this.bus.emit(EV.PLAYER_DUCK, { ducked: e.type === 'duck' });
  }

  /** Câmera: pés, olho e FOV da luneta interpolados entre ticks; rotação do último quadro (resposta imediata). */
  updateCamera(camera, alpha) {
    camera.position.lerpVectors(this.prevOrigin, this.state.origin, alpha);
    camera.position.y += this.prevEyeOffset + (this.eyeOffset - this.prevEyeOffset) * alpha;
    camera.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
    const zoom = this.fov.prev + (this.fov.now - this.fov.prev) * alpha;
    if (camera.userData.zoom !== zoom) setCameraFov(camera, camera.userData.hfov, zoom);
    if (this.thirdPerson) this.#pullBack(camera);
  }

  /** Terceira pessoa (debug): recua atrás do olho e se recolhe ao encostar em algo (varredura de esfera). */
  #pullBack(camera) {
    const cp = Math.cos(this.pitch);
    const d = VIEW.thirdPersonDistance;
    const dx = Math.sin(this.yaw) * cp * d;
    const dy = -Math.sin(this.pitch) * d + VIEW.thirdPersonHeight;
    const dz = Math.cos(this.yaw) * cp * d;
    const eye = camera.position;
    const r = VIEW.thirdPersonProbe;
    const tr = this.world.sweepCapsule(eye.x, eye.y - r, eye.z, dx, dy, dz, r, r * 2, this._camTrace);
    eye.set(eye.x + dx * tr.fraction, eye.y + dy * tr.fraction, eye.z + dz * tr.fraction);
  }

  /** Teleporte (setpos, respawn): zera velocidade e interpolação e procura o chão. */
  teleport(position, yaw = this.yaw, pitch = this.pitch) {
    const s = this.state;
    s.origin.copy(position);
    s.velocity.set(0, 0, 0);
    s.fallVelocity = 0;
    this.yaw = yaw;
    this.pitch = pitch;
    this.controller.categorizePosition(s);
    this.prevOrigin.copy(s.origin);
    this.smooth = 0;
    this.eyeOffset = eyeHeight(s);
    this.prevEyeOffset = this.eyeOffset;
  }
}
