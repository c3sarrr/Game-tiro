// Jogador local no modo "andar": estado de movimento, item na mão (troca e luneta), precisão da arma, vida (subfase
// 3.4), comando do tick e câmera. Cada tick segue a ordem do RunCommand do Source: troca de item → playerMove →
// precisão (pouso e penalidade) → luneta (vale a partir do tick seguinte) → eventos (o pouso aplica o dano de queda). O
// render interpola pés, altura do olho, o tombo da câmera do morto e o FOV da luneta entre os ticks e suaviza degraus e a
// troca de cápsula no ar. Em terceira pessoa (debug) a câmera recua atrás do jogador e se recolhe ao encostar em parede.
// Morto, o comando do tick fica vazio (o olhar continua livre); quem chama respawn() é o estado da partida.

import * as THREE from 'three';
import { EV } from '../core/events.js';
import { VIEW } from '../data/movement.js';
import { DEATH_CAUSES, VITALS } from '../data/vitals.js';
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
import { BTN, SELECT, createMoveCmd, readMoveCmd } from './moveCmd.js';
import { MOVETYPE, copyMoveState, createMoveState, eyeHeight, interruptMoves, playerMove } from './movement.js';
import { TFLAG, Telemetry } from './telemetry.js';
import { applyDamage, createVitals, killVitals, respawnVitals } from './vitals.js';

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
    // Interrupções fora da ordem do tick (teleporte, morte, volta): os eventos saem por aqui.
    this._aside = { sv, events: [] };
    this.telemetry = new Telemetry();
    this.vitals = createVitals();
    this.god = false; // god do tick (o cheat): o dano não sai da vida
    this._hurt = { taken: 0, killed: false };
    this.deathEye = 0; // altura do olho quando morreu (a câmera do morto desce dali)
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
    this.roll = 0; // tombo da câmera do morto (rad) no tick e no anterior (interpolado no quadro)
    this.prevRoll = 0;
    this.lastLanding = null;
    this.lastStep = null;
    this.lastSlide = null; // último fim de slide (evento)
    this.lastWallJump = null;
    this.lastHurt = null; // { taken, amount, kind, tick }
    this._wallJumped = false; // wall-jump neste tick (marca da telemetria)
    this.stats = { distance: 0, topSpeed: 0, ticks: 0, jumps: 0, steps: 0, slides: 0, wallJumps: 0 };
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

  /**
   * Um tick: lê a entrada (morto, o comando fica vazio), troca de item, move, atualiza precisão e luneta, suaviza a
   * câmera e publica os eventos. `god`: o cheat (sem dano); `reduceMotion`: a câmera do morto só desce, sem tombar.
   */
  tick(dt, input, { noclip = false, tick = 0, god = false, reduceMotion = false } = {}) {
    const s = this.state;
    const v = this.vitals;
    this.prevOrigin.copy(s.origin);
    this.prevEyeOffset = this.eyeOffset;
    this.prevRoll = this.roll;
    this.god = god;
    s.moveType = noclip ? MOVETYPE.NOCLIP : MOVETYPE.WALK;
    const cmd = readMoveCmd(this.cmd, input, tick, this.yaw, this.pitch);
    if (!cmd.select && this.pendingSelect) cmd.select = this.pendingSelect;
    this.pendingSelect = 0;
    if (!v.alive) {
      // Morto: sem movimento, pulo, agachar nem troca; o corpo só assenta com o atrito e a gravidade.
      v.deadTime += dt;
      cmd.forward = 0;
      cmd.side = 0;
      cmd.buttons = 0;
      cmd.select = SELECT.NONE;
    }
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
    if (v.alive) {
      this.eyeOffset = eyeHeight(s) + this.smooth;
      this.roll = 0;
    } else this.#deathCamera(reduceMotion);
    const events = this.env.events;
    this._wallJumped = false;
    for (let i = 0; i < events.length; i++) this.#onEvent(events[i], tick);
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
    if (s.sliding) flags |= TFLAG.SLIDE;
    if (this._wallJumped) flags |= TFLAG.WALLJUMP;
    this.telemetry.record(
      Math.hypot(s.velocity.x, s.velocity.z), s.maxSpeed, this.held.speed, precisionThreshold(this.held.speed),
      this.inaccuracy.total, -sy * cmd.forward + cy * cmd.side, -cy * cmd.forward - sy * cmd.side,
      s.velocity.x, s.velocity.z, flags,
    );
  }

  /** Evento do movimento: contagens, o dano do pouso e o barramento (EV.PLAYER_*). */
  #onEvent(e, tick = 0) {
    const bus = this.bus;
    switch (e.type) {
      case 'jump':
        this.stats.jumps++;
        bus?.emit(EV.PLAYER_JUMP, e);
        break;
      case 'land':
        this.lastLanding = e;
        bus?.emit(EV.PLAYER_LAND, e);
        if (e.damage > 0) this.hurt(e.damage, 'queda', { tick });
        break;
      case 'step':
        this.lastStep = e;
        this.stats.steps++;
        bus?.emit(EV.PLAYER_STEP, e);
        break;
      case 'slide':
        if (e.phase === 'start') this.stats.slides++;
        else this.lastSlide = e;
        bus?.emit(EV.PLAYER_SLIDE, e);
        break;
      case 'walljump':
        this.stats.wallJumps++;
        this.lastWallJump = e;
        this._wallJumped = true;
        bus?.emit(EV.PLAYER_WALLJUMP, e);
        break;
      default: // duck, unduck
        bus?.emit(EV.PLAYER_DUCK, { ducked: e.type === 'duck' });
    }
  }

  /**
   * Dano no jogador (`kind`: tipo em src/data/vitals.js): com `god` (padrão: o do tick) nada sai; a vida perde a parte
   * inteira e a fração vai para o acumulador. Publica EV.PLAYER_HURT e, se matou, a morte com `cause` (padrão: o tipo).
   */
  hurt(amount, kind, { god = this.god, cause = kind, tick = 0 } = {}) {
    const v = this.vitals;
    const r = applyDamage(v, amount, kind, { god, cause }, this._hurt);
    if (r.taken > 0) {
      this.lastHurt = { taken: r.taken, amount, kind, tick };
      this.bus?.emit(EV.PLAYER_HURT, { damage: r.taken, amount, kind, health: v.health, armor: this.loadout.armor });
    }
    if (r.killed) this.#die(cause, kind);
    return r;
  }

  /** Morte na hora (kill do console, cair para fora do set). false se já estava morto. */
  kill(cause, kind = 'mundo') {
    if (!killVitals(this.vitals, cause)) return false;
    this.#die(cause, kind);
    return true;
  }

  /** A morte: o slide e o voo são interrompidos e a câmera do morto começa da altura do olho de agora. */
  #die(cause, kind) {
    this.deathEye = this.eyeOffset;
    this.#interrupt();
    this.bus?.emit(EV.PLAYER_DEATH, { cause, kind, text: DEATH_CAUSES[cause] ?? cause });
  }

  /** Câmera do morto: o olho desce até VITALS.deathCam.eye acima dos pés e tomba (sem tombo com "reduzir movimento"). */
  #deathCamera(reduceMotion) {
    const c = VITALS.deathCam;
    const k = Math.min(1, this.vitals.deadTime / c.time);
    const e = 1 - (1 - k) * (1 - k); // desacelera no fim
    this.eyeOffset = this.deathEye + (c.eye - this.deathEye) * e;
    this.roll = reduceMotion ? 0 : c.rollDeg * DEG * e;
  }

  /** Slide e voo interrompidos fora da ordem do tick; o fim do slide (se havia) sai pelo barramento. */
  #interrupt() {
    const aside = this._aside;
    aside.events.length = 0;
    interruptMoves(this.state, aside);
    for (let i = 0; i < aside.events.length; i++) this.#onEvent(aside.events[i]);
    aside.events.length = 0;
  }

  /**
   * Volta ao jogo em `position`: vida cheia, estado de movimento novo (velocidade, stamina, agachar, slide, recarga e
   * paredes usadas), precisão zerada, luneta fechada e câmera do morto desfeita. Publica EV.PLAYER_SPAWN.
   */
  respawn(position, yaw = this.yaw, pitch = this.pitch) {
    respawnVitals(this.vitals);
    copyMoveState(createMoveState({ position }), this.state);
    resetAccuracy(this.accuracy);
    const zoomed = this.hands.zoom !== 0;
    this.hands.zoom = 0;
    this.hands.zoomCooldown = 0;
    this.#updateHeld();
    const f = this.fov;
    f.deg = f.from = f.to = SCOPE.referenceFov;
    f.time = f.duration = 0;
    f.prev = f.now = 1;
    this.roll = 0;
    this.prevRoll = 0;
    this.teleport(position, yaw, pitch);
    if (!this.bus) return;
    if (zoomed) this.bus.emit(EV.PLAYER_ZOOM, { level: 0, fov: null });
    this.bus.emit(EV.PLAYER_SPAWN, { position: this.state.origin.clone() });
  }

  /**
   * Câmera: pés, olho, tombo do morto e FOV da luneta interpolados entre ticks; rotação do olhar do último quadro
   * (resposta imediata).
   */
  updateCamera(camera, alpha) {
    camera.position.lerpVectors(this.prevOrigin, this.state.origin, alpha);
    camera.position.y += this.prevEyeOffset + (this.eyeOffset - this.prevEyeOffset) * alpha;
    camera.rotation.set(this.pitch, this.yaw, this.prevRoll + (this.roll - this.prevRoll) * alpha, 'YXZ');
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

  /**
   * Teleporte (setpos, estacao, respawn): interrompe o slide e o voo (paredes usadas zeradas), zera velocidade e
   * interpolação e procura o chão.
   */
  teleport(position, yaw = this.yaw, pitch = this.pitch) {
    const s = this.state;
    this.#interrupt();
    s.origin.copy(position);
    s.velocity.set(0, 0, 0);
    s.fallVelocity = 0;
    this.yaw = yaw;
    this.pitch = pitch;
    this.controller.categorizePosition(s);
    this.prevOrigin.copy(s.origin);
    this.smooth = 0;
    if (this.vitals.alive) this.eyeOffset = eyeHeight(s);
    this.prevEyeOffset = this.eyeOffset;
  }
}
