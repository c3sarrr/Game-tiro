// Controle via Gamepad API (mapeamento "standard"): leitura por quadro, bordas de botão/eixo (latches),
// zona morta radial com reescala, curvas de resposta, identificação PS5/PS4/Xbox/Switch e vibração.

// Ordem importa: IDs de fabricante primeiro (045e Microsoft, 054c Sony, 057e Nintendo); depois nomes, com
// "Xbox" antes do genérico "Wireless Controller" (que o DualShock 4 usa, mas o "Xbox Wireless Controller" também).
const VENDORS = [
  { type: 'xbox', re: /045e/i },
  { type: 'playstation', re: /054c/i },
  { type: 'switch', re: /057e/i },
];
const NAMES = [
  { type: 'xbox', re: /xbox|xinput/i },
  { type: 'playstation', re: /dualsense|dualshock|playstation|^wireless controller/i },
  { type: 'switch', re: /nintendo|pro controller|joy-con/i },
];

export function detectPadType(id = '') {
  for (const t of VENDORS) if (t.re.test(id)) return t.type;
  for (const t of NAMES) if (t.re.test(id)) return t.type;
  return 'generico';
}

/**
 * Zona morta radial com reescala (sem "degrau" na borda da zona morta) e zona externa.
 * `out` opcional evita alocação no laço de jogo.
 */
export function radialDeadzone(x, y, inner, outer = 0.97, out = { x: 0, y: 0, mag: 0 }) {
  const mag = Math.hypot(x, y);
  if (mag <= inner) {
    out.x = 0;
    out.y = 0;
    out.mag = 0;
    return out;
  }
  const scaled = Math.min(1, (mag - inner) / Math.max(1e-6, outer - inner));
  out.x = (x / mag) * scaled;
  out.y = (y / mag) * scaled;
  out.mag = scaled;
  return out;
}

/** Curvas de resposta da mira: linear, exponencial, ou "dinâmica" (precisa no centro, linear na borda). */
export function responseCurve(mag, curve, exponent) {
  switch (curve) {
    case 'linear':
      return mag;
    case 'exponencial':
      return Math.pow(mag, exponent);
    case 'dinamica':
    default: {
      const knee = 0.8;
      if (mag <= knee) return Math.pow(mag / knee, exponent) * 0.62;
      return 0.62 + ((mag - knee) / (1 - knee)) * 0.38;
    }
  }
}

const BUTTONS = 20;
const AXES = 8;
const TRIGGERS = new Set([6, 7]);

export class GamepadInput {
  constructor() {
    this.index = -1;
    this.id = '';
    this.type = 'generico';
    this.mapping = '';
    this.buttons = new Float32Array(BUTTONS);
    this.axes = new Float32Array(AXES);
    this.btnDown = new Uint8Array(BUTTONS);
    this.axisDown = new Int8Array(AXES); // -1, 0, +1: meia-direção ativa (para binds e captura)
    this.pressed = new Set();
    this.released = new Set();
    this.triggerThreshold = 0.35;
    this.axisThreshold = 0.5;
    this.listener = null;
    this._offs = [];
    this._leftOut = { x: 0, y: 0, mag: 0 };
    this._rightOut = { x: 0, y: 0, mag: 0 };
  }

  /** @param {{onPress(b:string):void, onRelease(b:string):void, onActivity():void, onConnect(info):void, onDisconnect(info):void}} listener */
  attach(listener) {
    this.listener = listener;
    const onConnect = (e) => {
      const info = { index: e.gamepad.index, id: e.gamepad.id, type: detectPadType(e.gamepad.id), mapping: e.gamepad.mapping };
      if (this.index < 0) this.#select(e.gamepad);
      this.listener?.onConnect(info);
    };
    const onDisconnect = (e) => {
      const info = { index: e.gamepad.index, id: e.gamepad.id, type: detectPadType(e.gamepad.id) };
      if (e.gamepad.index === this.index) this.#reset();
      this.listener?.onDisconnect(info);
    };
    window.addEventListener('gamepadconnected', onConnect);
    window.addEventListener('gamepaddisconnected', onDisconnect);
    this._offs.push(() => window.removeEventListener('gamepadconnected', onConnect));
    this._offs.push(() => window.removeEventListener('gamepaddisconnected', onDisconnect));
  }

  detach() {
    for (const off of this._offs) off();
    this._offs = [];
    this.listener = null;
  }

  get connected() {
    return this.index >= 0;
  }

  #select(gp) {
    this.index = gp.index;
    this.id = gp.id;
    this.type = detectPadType(gp.id);
    this.mapping = gp.mapping;
  }

  #reset() {
    for (let i = 0; i < BUTTONS; i++) {
      if (this.btnDown[i]) {
        this.released.add(`pad:button:${i}`);
        this.listener?.onRelease(`pad:button:${i}`);
      }
    }
    this.index = -1;
    this.id = '';
    this.type = 'generico';
    this.buttons.fill(0);
    this.axes.fill(0);
    this.btnDown.fill(0);
    this.axisDown.fill(0);
  }

  #active(gp) {
    for (const b of gp.buttons) if (b.value > 0.5 || b.pressed) return true;
    for (const a of gp.axes) if (Math.abs(a) > 0.45) return true;
    return false;
  }

  /** Lê o estado do controle ativo. Troca para outro controle se ele for usado. */
  poll() {
    const pads = typeof navigator !== 'undefined' && navigator.getGamepads ? navigator.getGamepads() : [];
    let gp = this.index >= 0 ? pads[this.index] : null;
    if (!gp || !gp.connected) {
      if (this.index >= 0) this.#reset();
      gp = null;
    }
    for (const other of pads) {
      if (other && other.connected && other.index !== this.index && this.#active(other)) {
        if (gp) this.#reset();
        this.#select(other);
        gp = other;
        break;
      }
    }
    if (!gp) return;

    let activity = false;
    const nb = Math.min(BUTTONS, gp.buttons.length);
    for (let i = 0; i < nb; i++) {
      const v = gp.buttons[i].value || (gp.buttons[i].pressed ? 1 : 0);
      this.buttons[i] = v;
      const threshold = TRIGGERS.has(i) ? this.triggerThreshold : 0.5;
      const down = v >= threshold ? 1 : 0;
      if (down !== this.btnDown[i]) {
        this.btnDown[i] = down;
        const b = `pad:button:${i}`;
        if (down) {
          this.pressed.add(b);
          this.listener?.onPress(b);
          activity = true;
        } else {
          this.released.add(b);
          this.listener?.onRelease(b);
        }
      }
    }
    const na = Math.min(AXES, gp.axes.length);
    for (let i = 0; i < na; i++) {
      const v = gp.axes[i];
      this.axes[i] = v;
      const dir = v > this.axisThreshold ? 1 : v < -this.axisThreshold ? -1 : 0;
      if (dir !== this.axisDown[i]) {
        const prev = this.axisDown[i];
        this.axisDown[i] = dir;
        if (prev !== 0) {
          const b = `pad:axis:${i}${prev > 0 ? '+' : '-'}`;
          this.released.add(b);
          this.listener?.onRelease(b);
        }
        if (dir !== 0) {
          const b = `pad:axis:${i}${dir > 0 ? '+' : '-'}`;
          this.pressed.add(b);
          this.listener?.onPress(b);
          activity = true;
        }
      }
      if (Math.abs(v) > 0.3) activity = true;
    }
    if (activity) this.listener?.onActivity();
  }

  /**
   * Analógico processado ('left' | 'right') com zona morta radial.
   * Devolve um objeto reutilizado por analógico (não guardar a referência entre quadros).
   */
  stick(which, deadzone) {
    const left = which === 'left';
    const ix = left ? 0 : 2;
    return radialDeadzone(this.axes[ix], this.axes[ix + 1], deadzone, 0.97, left ? this._leftOut : this._rightOut);
  }

  button(i) {
    return this.buttons[i] ?? 0;
  }

  isButtonDown(i) {
    return this.btnDown[i] === 1;
  }

  wasPressed(binding) {
    return this.pressed.has(binding);
  }

  clearLatches() {
    this.pressed.clear();
    this.released.clear();
  }

  /** Vibração (dual-rumble). strong/weak 0..1, duração em ms. */
  rumble(strong, weak, durationMs) {
    if (this.index < 0) return false;
    const gp = navigator.getGamepads?.()[this.index];
    const act = gp?.vibrationActuator;
    if (act?.playEffect) {
      act.playEffect('dual-rumble', {
        startDelay: 0,
        duration: Math.max(1, Math.round(durationMs)),
        strongMagnitude: Math.min(1, Math.max(0, strong)),
        weakMagnitude: Math.min(1, Math.max(0, weak)),
      }).catch(() => {});
      return true;
    }
    const haptic = gp?.hapticActuators?.[0];
    if (haptic?.pulse) {
      haptic.pulse(Math.max(strong, weak), durationMs).catch?.(() => {});
      return true;
    }
    return false;
  }
}
