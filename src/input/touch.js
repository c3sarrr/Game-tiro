// Camada de entrada de toque (celular/tablet): joystick flutuante à esquerda, área de olhar à direita,
// botões virtuais (posições do layout em config) e giroscópio opcional para mirar.
// Aqui fica só a ENTRADA: o desenho dos controles e o editor de layout chegam na Fase 10.
// Multi-toque via Pointer Events (cada dedo = um pointerId com captura).

import { TOUCH_ZONES, TOUCH_JOYSTICK } from '../data/touchLayout.js';

export class TouchInput {
  constructor({ layer }) {
    this.layer = layer;
    this.available = false; // o aparelho já usou toque nesta sessão
    this.active = false; // aceitando toques de jogo (contexto de partida)
    this.buttons = [];
    this.pointers = new Map(); // pointerId → {role, buttonId?, action?, lastX, lastY}
    this.joy = { active: false, id: -1, ox: 0, oy: 0, x: 0, y: 0 };
    this.lookDX = 0;
    this.lookDY = 0;
    this.held = new Map(); // action → nº de dedos segurando
    this.pressed = new Set();
    this.released = new Set();
    this.gyro = { enabled: false, yawDeg: 0, pitchDeg: 0, handler: null, sensitivity: 1 };
    this.listener = null;
    this._offs = [];
    this._moveOut = { x: 0, y: 0, active: false };
    this._lookOut = { dx: 0, dy: 0, gyroYaw: 0, gyroPitch: 0 };
  }

  /** @param {{onTouchMode():void, onActivity():void, onPress(action):void, onRelease(action):void}} listener */
  attach(listener) {
    this.listener = listener;
    const on = (target, type, fn, opts) => {
      target.addEventListener(type, fn, opts);
      this._offs.push(() => target.removeEventListener(type, fn, opts));
    };
    // Detecção do modo toque em qualquer lugar da página (inclusive menus).
    on(window, 'pointerdown', (e) => {
      if (e.pointerType === 'touch') {
        this.listener?.onActivity();
        if (!this.available) {
          this.available = true;
          this.listener?.onTouchMode();
        }
      }
    }, { capture: true, passive: true });
    on(this.layer, 'pointerdown', (e) => this.#down(e));
    on(this.layer, 'pointermove', (e) => this.#move(e));
    on(this.layer, 'pointerup', (e) => this.#up(e));
    on(this.layer, 'pointercancel', (e) => this.#up(e));
    on(this.layer, 'lostpointercapture', (e) => this.#up(e));
  }

  detach() {
    for (const off of this._offs) off();
    this._offs = [];
    this.disableGyro();
    this.listener = null;
  }

  setLayout(layout) {
    this.buttons = (layout?.buttons ?? []).map((b) => ({ ...b }));
  }

  setActive(active) {
    this.active = active;
    this.layer.classList.toggle('is-active', active);
    if (!active) this.releaseAll();
  }

  #metrics() {
    const r = this.layer.getBoundingClientRect();
    return { left: r.left, top: r.top, w: Math.max(1, r.width), h: Math.max(1, r.height), min: Math.max(1, Math.min(r.width, r.height)) };
  }

  /** Botão sob o ponto (coordenadas de tela), com 15% de tolerância para dedos grossos. */
  hitButton(clientX, clientY) {
    const m = this.#metrics();
    let best = null;
    let bestD = Infinity;
    for (const b of this.buttons) {
      const cx = m.left + b.x * m.w;
      const cy = m.top + b.y * m.h;
      const d = Math.hypot(clientX - cx, clientY - cy);
      if (d <= b.r * m.min * 1.15 && d < bestD) {
        best = b;
        bestD = d;
      }
    }
    return best;
  }

  #down(e) {
    if (e.pointerType !== 'touch' || !this.active) return;
    e.preventDefault();
    try {
      // Captura: o dedo continua sendo deste controle mesmo se sair de cima da camada.
      this.layer.setPointerCapture(e.pointerId);
    } catch {
      // Ponteiro já encerrado pelo navegador (ou sintético): segue sem captura.
    }
    const m = this.#metrics();
    const nx = (e.clientX - m.left) / m.w;
    const ny = (e.clientY - m.top) / m.h;
    const btn = this.hitButton(e.clientX, e.clientY);
    if (btn) {
      this.pointers.set(e.pointerId, { role: 'button', buttonId: btn.id, action: btn.action, lastX: e.clientX, lastY: e.clientY });
      const n = (this.held.get(btn.action) ?? 0) + 1;
      this.held.set(btn.action, n);
      if (n === 1) {
        this.pressed.add(btn.action);
        this.listener?.onPress(btn.action);
      }
      return;
    }
    const z = TOUCH_ZONES.joystick;
    if (!this.joy.active && nx >= z.x0 && nx <= z.x1 && ny >= z.y0 && ny <= z.y1) {
      this.joy = { active: true, id: e.pointerId, ox: e.clientX, oy: e.clientY, x: 0, y: 0 };
      this.pointers.set(e.pointerId, { role: 'joystick', lastX: e.clientX, lastY: e.clientY });
      return;
    }
    this.pointers.set(e.pointerId, { role: 'look', lastX: e.clientX, lastY: e.clientY });
  }

  #move(e) {
    const p = this.pointers.get(e.pointerId);
    if (!p) return;
    e.preventDefault();
    if (p.role === 'joystick') {
      const m = this.#metrics();
      const radius = TOUCH_JOYSTICK.radius * m.min;
      let dx = (e.clientX - this.joy.ox) / radius;
      let dy = (e.clientY - this.joy.oy) / radius;
      const mag = Math.hypot(dx, dy);
      if (mag > 1) {
        // Joystick "arrastável": a base segue o dedo quando ele passa do limite.
        this.joy.ox += (dx / mag) * (mag - 1) * radius;
        this.joy.oy += (dy / mag) * (mag - 1) * radius;
        dx /= mag;
        dy /= mag;
      }
      const dz = TOUCH_JOYSTICK.deadzone;
      const m2 = Math.hypot(dx, dy);
      const k = m2 <= dz ? 0 : (m2 - dz) / (1 - dz) / m2;
      this.joy.x = dx * k;
      this.joy.y = -dy * k; // para cima na tela = para frente
    } else if (p.role === 'look') {
      this.lookDX += e.clientX - p.lastX;
      this.lookDY += e.clientY - p.lastY;
    }
    p.lastX = e.clientX;
    p.lastY = e.clientY;
    this.listener?.onActivity();
  }

  #up(e) {
    const p = this.pointers.get(e.pointerId);
    if (!p) return;
    this.pointers.delete(e.pointerId);
    if (p.role === 'joystick') {
      this.joy = { active: false, id: -1, ox: 0, oy: 0, x: 0, y: 0 };
    } else if (p.role === 'button') {
      const n = (this.held.get(p.action) ?? 1) - 1;
      if (n <= 0) {
        this.held.delete(p.action);
        this.released.add(p.action);
        this.listener?.onRelease(p.action);
      } else {
        this.held.set(p.action, n);
      }
    }
  }

  isHeld(action) {
    return this.held.has(action) || this.pressed.has(action);
  }

  wasPressed(action) {
    return this.pressed.has(action);
  }

  /** Vetor do joystick (objeto reutilizado: não guardar a referência). */
  move() {
    const out = this._moveOut;
    out.x = this.joy.x;
    out.y = this.joy.y;
    out.active = this.joy.active;
    return out;
  }

  /** Arrasto de olhar (px) e giroscópio (graus) acumulados desde a última leitura (objeto reutilizado). */
  consumeLook() {
    const out = this._lookOut;
    out.dx = this.lookDX;
    out.dy = this.lookDY;
    out.gyroYaw = this.gyro.yawDeg;
    out.gyroPitch = this.gyro.pitchDeg;
    this.lookDX = 0;
    this.lookDY = 0;
    this.gyro.yawDeg = 0;
    this.gyro.pitchDeg = 0;
    return out;
  }

  clearLatches() {
    this.pressed.clear();
    this.released.clear();
  }

  releaseAll() {
    for (const action of this.held.keys()) {
      this.released.add(action);
      this.listener?.onRelease(action);
    }
    this.held.clear();
    this.pointers.clear();
    this.joy = { active: false, id: -1, ox: 0, oy: 0, x: 0, y: 0 };
  }

  /**
   * Liga o giroscópio. No iOS precisa de permissão pedida DENTRO de um gesto do usuário (toque no botão da config).
   * @returns {Promise<boolean>}
   */
  async enableGyro(sensitivity = 1) {
    if (this.gyro.enabled) {
      this.gyro.sensitivity = sensitivity;
      return true;
    }
    const DME = globalThis.DeviceMotionEvent;
    if (!DME) return false;
    if (typeof DME.requestPermission === 'function') {
      try {
        if ((await DME.requestPermission()) !== 'granted') return false;
      } catch {
        return false;
      }
    }
    this.gyro.sensitivity = sensitivity;
    let last = 0;
    this.gyro.handler = (e) => {
      const rr = e.rotationRate;
      if (!rr) return;
      const now = e.timeStamp || performance.now();
      const dt = last ? Math.min(0.1, (now - last) / 1000) : (e.interval ?? 16) / 1000;
      last = now;
      const angle = (screen.orientation?.angle ?? globalThis.orientation ?? 0) | 0;
      // Eixos do aparelho → yaw/pitch do mundo conforme a orientação da tela (paisagem é o uso normal).
      // alpha (giro em torno da normal da tela) seria "roll" da câmera e é ignorado.
      const beta = rr.beta ?? 0;
      const gamma = rr.gamma ?? 0;
      let yaw;
      let pitch;
      switch (((angle % 360) + 360) % 360) {
        case 90: yaw = beta; pitch = -gamma; break;
        case 180: yaw = -gamma; pitch = -beta; break;
        case 270: yaw = -beta; pitch = gamma; break;
        default: yaw = gamma; pitch = beta; break;
      }
      this.gyro.yawDeg += yaw * dt * this.gyro.sensitivity;
      this.gyro.pitchDeg += pitch * dt * this.gyro.sensitivity;
    };
    window.addEventListener('devicemotion', this.gyro.handler);
    this.gyro.enabled = true;
    return true;
  }

  disableGyro() {
    if (this.gyro.handler) window.removeEventListener('devicemotion', this.gyro.handler);
    this.gyro.handler = null;
    this.gyro.enabled = false;
    this.gyro.yawDeg = 0;
    this.gyro.pitchDeg = 0;
  }
}
