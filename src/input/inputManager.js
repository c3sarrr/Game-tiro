// Gerenciador de entrada: junta teclado+mouse, controle e toque num único mapa de ações remapeável.
// - Contexto 'ui' (menus) × 'game' (partida). Ações de jogo só valem em 'game' com o jogo "capturando" a entrada
//   (pointer lock no PC; controle e toque não precisam).
// - Olhar (mouse/analógico/arrasto/giroscópio) é aplicado por QUADRO (resposta imediata);
//   ações e movimento são amostrados por TICK (64 Hz) com latches, prontos para virar comandos de rede.
// - Eventos imediatos (EV.INPUT_ACTION) para UI: pausar, console, overlay, loja, chat...

import { EV } from '../core/events.js';
import { ACTIONS, ACTION_IDS, ACTION_BY_ID } from '../data/actions.js';
import { KeyboardMouse } from './keyboardMouse.js';
import { GamepadInput, responseCurve } from './gamepad.js';
import { TouchInput } from './touch.js';
import { parseBinding, buildReverseMap } from './bindings.js';
import { bindingLabel, padStyle } from './labels.js';

export const CONTEXT = Object.freeze({ UI: 'ui', GAME: 'game' });

const DEG = Math.PI / 180;
const MOUSE_DEG_PER_COUNT = 0.022; // m_yaw/m_pitch do CS
const TOUCH_DEG_PER_PX = 0.26;
// Teclas que o navegador usaria para outra coisa (busca rápida, foco, rolagem) quando estão ligadas a ações.
const BROWSER_KEYS = new Set(['key:Tab', 'key:Space', 'key:F1', 'key:F3', 'key:Backquote', 'key:Quote', 'key:Slash',
  'key:ArrowUp', 'key:ArrowDown', 'key:ArrowLeft', 'key:ArrowRight', 'key:Backspace']);
// Controles de formulário que não recebem texto: com eles focados as teclas continuam sendo do jogo/atalhos.
const NON_TEXT_INPUTS = new Set(['range', 'checkbox', 'radio', 'button', 'submit', 'reset', 'color', 'file']);

export class InputManager {
  constructor({ events, config, log, canvas, touchLayer }) {
    this.events = events;
    this.config = config;
    this.log = log;
    this.kbm = new KeyboardMouse({ element: canvas });
    this.pad = new GamepadInput();
    this.touch = new TouchInput({ layer: touchLayer });
    this.context = CONTEXT.UI;
    this.device = 'kbm';
    this.lookScale = 1; // multiplicador de sensibilidade (luneta/zoom), controlado pela jogabilidade
    // Tiro automático do toque: a jogabilidade marca true enquanto a mira estiver sobre um alvo válido.
    this.autoFireTarget = false;
    this.layoutMap = null;
    this.capture = null;
    this.state = new Map(ACTION_IDS.map((id) => [id, { down: false, value: 0, pressed: false, released: false }]));
    this.moveVec = { x: 0, y: 0 };
    this.look = { yaw: 0, pitch: 0 };
    this._lookOut = { yaw: 0, pitch: 0 };
    this._evalValue = 0;
    this._evalPressed = false;
    this._bindings = null;
    this._parsed = new Map();
    this._reverse = new Map();
    this._offs = [];
  }

  init() {
    this.#loadBindings();
    this.touch.setLayout(this.config.get('controls.touch.layout'));
    this.#applyPadSettings();
    this._offs.push(this.config.watch('controls.', (e) => {
      if (e.key === 'controls.bindings') this.#loadBindings();
      else if (e.key === 'controls.touch.layout') this.touch.setLayout(e.value);
      else if (e.key.startsWith('controls.pad.')) this.#applyPadSettings();
      else if (e.key === 'controls.touch.gyro' && !e.value) this.touch.disableGyro();
      else if (e.key === 'controls.touch.gyroSensitivity') this.touch.gyro.sensitivity = e.value;
    }));
    // Giroscópio já ligado numa sessão anterior: tenta religar agora; se o navegador exigir permissão por
    // gesto (iOS), tenta de novo no primeiro toque/clique.
    if (this.config.get('controls.touch.gyro')) {
      this.touch.enableGyro(this.config.get('controls.touch.gyroSensitivity')).then((ok) => {
        if (ok) return;
        const retry = () => {
          window.removeEventListener('pointerup', retry, true);
          if (this.config.get('controls.touch.gyro')) this.touch.enableGyro(this.config.get('controls.touch.gyroSensitivity'));
        };
        window.addEventListener('pointerup', retry, true);
        this._offs.push(() => window.removeEventListener('pointerup', retry, true));
      });
    }
    const onFs = () => {
      if (!document.fullscreenElement) navigator.keyboard?.unlock?.();
    };
    document.addEventListener('fullscreenchange', onFs);
    this._offs.push(() => document.removeEventListener('fullscreenchange', onFs));

    this.kbm.attach({
      onPress: (b, e) => this.#press(b, 'kbm', e),
      onRelease: (b) => this.#release(b, 'kbm'),
      onActivity: () => this.#setDevice('kbm'),
      shouldPrevent: (b) => this.#shouldPrevent(b),
      onLockChange: (locked) => this.events.emit(EV.INPUT_POINTER_LOCK, { locked }),
      isTextFocus: () => this.#textFocus(),
    });
    this.pad.attach({
      onPress: (b) => this.#press(b, 'gamepad'),
      onRelease: (b) => this.#release(b, 'gamepad'),
      onActivity: () => this.#setDevice('gamepad'),
      onConnect: (info) => {
        this.log?.info(`controle conectado: ${info.id} (${info.type})`);
        this.events.emit(EV.INPUT_GAMEPAD, { connected: true, ...info });
      },
      onDisconnect: (info) => {
        this.log?.info(`controle desconectado: ${info.id}`);
        this.events.emit(EV.INPUT_GAMEPAD, { connected: false, ...info });
      },
    });
    this.touch.attach({
      onTouchMode: () => this.log?.info('toque detectado: controles de toque habilitados'),
      onActivity: () => this.#setDevice('touch'),
      onPress: (action) => this.#emitAction(action, 'touch', 'press'),
      onRelease: (action) => this.#emitAction(action, 'touch', 'release'),
    });

    navigator.keyboard?.getLayoutMap?.()
      .then((map) => (this.layoutMap = map))
      .catch(() => {});
  }

  // ------------------------------------------------------------------ contexto

  setContext(ctx) {
    if (this.context === ctx) return;
    this.context = ctx;
    this.touch.setActive(ctx === CONTEXT.GAME && this.touch.available);
    if (ctx !== CONTEXT.GAME) {
      for (const s of this.state.values()) {
        s.down = false;
        s.value = 0;
      }
      this.moveVec.x = 0;
      this.moveVec.y = 0;
      this.look.yaw = 0;
      this.look.pitch = 0;
    }
  }

  /** O jogo está recebendo comandos agora? (PC precisa do pointer lock) */
  get gameActive() {
    if (this.context !== CONTEXT.GAME) return false;
    if (this.device === 'kbm') return this.kbm.pointerLocked;
    return true;
  }

  requestPointerLock() {
    return this.kbm.requestPointerLock(this.config.get('controls.rawInput'));
  }

  exitPointerLock() {
    this.kbm.exitPointerLock();
  }

  get pointerLocked() {
    return this.kbm.pointerLocked;
  }

  // ------------------------------------------------------------------ por quadro

  /** Chamado no início de cada quadro, antes dos ticks: lê o controle e acumula o olhar. */
  frameStart(dt) {
    this.pad.poll();
    if (this.touch.available && this.context === CONTEXT.GAME && !this.touch.active) this.touch.setActive(true);
    const cfg = this.config;
    const active = this.gameActive;

    const mouse = this.kbm.consumeMouse();
    const touchLook = this.touch.consumeLook();
    if (!active) return;

    const scale = this.lookScale;
    // Mouse: convenção do CS (graus = contagens × sensibilidade × 0,022).
    const k = cfg.get('controls.mouseSensitivity') * MOUSE_DEG_PER_COUNT * DEG * scale;
    this.look.yaw -= mouse.dx * k;
    this.look.pitch -= mouse.dy * k * (cfg.get('controls.invertY') ? -1 : 1);

    // Analógico direito: velocidade angular com curva de resposta.
    if (this.pad.connected) {
      const s = this.pad.stick('right', cfg.get('controls.pad.deadzoneRight'));
      if (s.mag > 0) {
        const curved = responseCurve(s.mag, cfg.get('controls.pad.curve'), cfg.get('controls.pad.curveExponent'));
        const speed = cfg.get('controls.pad.lookSpeed') * DEG * scale * dt * (curved / s.mag);
        this.look.yaw -= s.x * speed;
        this.look.pitch -= s.y * speed * cfg.get('controls.pad.lookSpeedY') * (cfg.get('controls.pad.invertY') ? -1 : 1);
      }
    }

    // Toque: arrastar "puxa" a visão; giroscópio soma a rotação real do aparelho.
    const tk = cfg.get('controls.touch.lookSensitivity') * TOUCH_DEG_PER_PX * DEG * scale;
    this.look.yaw -= touchLook.dx * tk;
    this.look.pitch -= touchLook.dy * tk;
    this.look.yaw += touchLook.gyroYaw * DEG * scale;
    this.look.pitch += touchLook.gyroPitch * DEG * scale;
  }

  /**
   * Rotação acumulada (radianos) desde a última leitura — aplicar na câmera a cada quadro.
   * Devolve um objeto reutilizado (copiar os valores se precisar guardá-los).
   */
  consumeLook() {
    const out = this._lookOut;
    out.yaw = this.look.yaw;
    out.pitch = this.look.pitch;
    this.look.yaw = 0;
    this.look.pitch = 0;
    return out;
  }

  // ------------------------------------------------------------------ tela cheia

  /**
   * Tela cheia + Keyboard Lock (Chromium): com o teclado travado, atalhos como Ctrl+W (agachar + andar)
   * chegam ao jogo em vez de fechar a aba; o Esc passa a exigir ser segurado para sair.
   * Precisa ser chamado dentro de um gesto do usuário (clique/tecla).
   */
  async enterFullscreen() {
    const el = document.documentElement;
    if (!document.fullscreenElement) {
      try {
        await el.requestFullscreen({ navigationUI: 'hide' });
      } catch (err) {
        this.log?.warn('tela cheia recusada pelo navegador:', err?.message ?? err);
        return false;
      }
    }
    try {
      await navigator.keyboard?.lock?.();
    } catch (err) {
      this.log?.debug('Keyboard Lock indisponível:', err?.message ?? err);
    }
    return true;
  }

  async exitFullscreen() {
    navigator.keyboard?.unlock?.();
    if (document.fullscreenElement) await document.exitFullscreen().catch(() => {});
  }

  get fullscreen() {
    return !!document.fullscreenElement;
  }

  // ------------------------------------------------------------------ por tick

  /** Amostra o estado das ações para um tick e limpa os latches dos dispositivos. */
  sampleTick() {
    const active = this.gameActive;
    for (const id of ACTION_IDS) {
      const s = this.state.get(id);
      const wasDown = s.down;
      let value = 0;
      let pressed = false;
      if (active || ACTION_BY_ID[id].ui) {
        this.#evaluate(id);
        value = this._evalValue;
        pressed = this._evalPressed;
      }
      s.value = value;
      s.down = value > 0 || pressed;
      s.pressed = pressed || (s.down && !wasDown);
      s.released = wasDown && !s.down;
    }
    // Movimento: digital (WASD) ou analógico (controle), normalizado; o joystick de toque tem prioridade.
    let x = this.state.get('moveRight').value - this.state.get('moveLeft').value;
    let y = this.state.get('moveForward').value - this.state.get('moveBack').value;
    const tm = this.touch.move();
    if (active && tm.active) {
      x = tm.x;
      y = tm.y;
    }
    const len = Math.hypot(x, y);
    if (len > 1) {
      x /= len;
      y /= len;
    }
    this.moveVec.x = active ? x : 0;
    this.moveVec.y = active ? y : 0;
    this.kbm.clearLatches();
    this.pad.clearLatches();
    this.touch.clearLatches();
    return this;
  }

  isDown(action) {
    return this.state.get(action).down;
  }

  pressed(action) {
    return this.state.get(action).pressed;
  }

  released(action) {
    return this.state.get(action).released;
  }

  value(action) {
    return this.state.get(action).value;
  }

  get move() {
    return this.moveVec;
  }

  /** Resultado em this._evalValue/_evalPressed (sem alocar: roda ~30 ações × 64 ticks/s). */
  #evaluate(action) {
    let value = 0;
    let pressed = false;
    const entry = this._bindings[action];
    for (const b of entry.kbm) {
      const p = this._parsed.get(b);
      if (!p) continue;
      if (p.kind === 'wheel') {
        if (this.kbm.wheelCount(p.dir) > 0) {
          value = 1;
          pressed = true;
        }
      } else if (this.kbm.isDown(b)) {
        value = 1;
        if (this.kbm.wasPressed(b)) pressed = true;
      }
    }
    if (this.pad.connected) {
      for (const b of entry.pad) {
        const p = this._parsed.get(b);
        if (!p) continue;
        let v = 0;
        if (p.kind === 'button') v = this.pad.button(p.index) >= (p.index === 6 || p.index === 7 ? this.pad.triggerThreshold : 0.5) ? this.pad.button(p.index) : 0;
        else if (p.kind === 'axis') v = this.#padAxisValue(p.index, p.sign);
        if (v > value) value = v;
        if (this.pad.wasPressed(b)) pressed = true;
      }
    }
    if (this.touch.isHeld(action)) {
      value = 1;
      if (this.touch.wasPressed(action)) pressed = true;
    }
    if (action === 'fire' && this.device === 'touch' && this.config.get('controls.touch.autoFire')) {
      // Tiro automático no toque: a jogabilidade liga `autoFireTarget` quando a mira está sobre um inimigo.
      if (this.autoFireTarget) value = 1;
    }
    this._evalValue = value;
    this._evalPressed = pressed;
  }

  /** Meia-direção de eixo do controle com zona morta radial do analógico correspondente. */
  #padAxisValue(index, sign) {
    if (index <= 3) {
      const left = index <= 1;
      const s = this.pad.stick(left ? 'left' : 'right', this.config.get(left ? 'controls.pad.deadzoneLeft' : 'controls.pad.deadzoneRight'));
      const comp = index % 2 === 0 ? s.x : s.y;
      return Math.max(0, comp * sign);
    }
    const raw = this.pad.axes[index] * sign;
    return raw > 0.15 ? (raw - 0.15) / 0.85 : 0;
  }

  // ------------------------------------------------------------------ eventos imediatos

  #press(binding, device, event) {
    if (this.capture) {
      if (this.#captureInput(binding, device)) return;
    }
    const actions = this._reverse.get(binding);
    if (!actions) return;
    for (const action of actions) this.#emitAction(action, device, 'press', event);
  }

  #release(binding, device) {
    const actions = this._reverse.get(binding);
    if (!actions) return;
    for (const action of actions) this.#emitAction(action, device, 'release');
  }

  #emitAction(action, device, phase, event) {
    const def = ACTION_BY_ID[action];
    if (!def) return;
    if (this.context !== CONTEXT.GAME && !def.ui) return;
    this.events.emit(EV.INPUT_ACTION, { action, device, phase, event });
  }

  #shouldPrevent(binding) {
    if (this.capture) return true;
    const actions = this._reverse.get(binding);
    if (!actions) return false;
    if (this.context === CONTEXT.GAME && this.kbm.pointerLocked) return true;
    // Fora do jogo, só impede o padrão do navegador para teclas de atalho ligadas a ações de UI (F1, F3, `).
    return BROWSER_KEYS.has(binding) && actions.some((a) => ACTION_BY_ID[a].ui);
  }

  #textFocus() {
    const el = document.activeElement;
    if (!el) return false;
    if (el.tagName === 'INPUT') return !NON_TEXT_INPUTS.has(el.type);
    return el.tagName === 'TEXTAREA' || el.isContentEditable;
  }

  #setDevice(device) {
    if (this.device === device) return;
    const previous = this.device;
    this.device = device;
    this.events.emit(EV.INPUT_DEVICE, { device, previous });
  }

  // ------------------------------------------------------------------ bindings

  #loadBindings() {
    this._bindings = this.config.get('controls.bindings');
    this._parsed.clear();
    for (const id of ACTION_IDS) {
      for (const dev of ['kbm', 'pad']) for (const b of this._bindings[id][dev]) this._parsed.set(b, parseBinding(b));
    }
    this._reverse = buildReverseMap(this._bindings);
  }

  #applyPadSettings() {
    this.pad.triggerThreshold = this.config.get('controls.pad.triggerThreshold');
  }

  get bindings() {
    return this._bindings;
  }

  /** Estilo de ícone de controle efetivo (config ou detectado). */
  get padIconStyle() {
    return padStyle(this.config.get('controls.pad.icons'), this.pad.type);
  }

  labelFor(binding) {
    return bindingLabel(binding, { padType: this.padIconStyle, layoutMap: this.layoutMap });
  }

  /** Rótulos da ação no dispositivo (ex.: ['W'] ou ['Analógico E ↑']). */
  actionLabels(action, device = this.device === 'gamepad' ? 'pad' : 'kbm') {
    return (this._bindings[action]?.[device] ?? []).map((b) => this.labelFor(b));
  }

  // ------------------------------------------------------------------ captura (remapeamento)

  /**
   * Espera o próximo botão/tecla do dispositivo. Esc cancela (null); Delete limpa ('clear').
   * @param {'kbm'|'pad'} device
   * @returns {Promise<string|null>}
   */
  captureNext(device, timeoutMs = 10000) {
    this.cancelCapture();
    return new Promise((resolve) => {
      const timer = setTimeout(() => this.#finishCapture(null), timeoutMs);
      this.capture = { device, resolve, timer, armedAt: performance.now() };
    });
  }

  cancelCapture() {
    if (this.capture) this.#finishCapture(null);
  }

  #captureInput(binding, device) {
    const c = this.capture;
    // Ignora o clique/tecla que abriu a captura (mesmo quadro).
    if (performance.now() - c.armedAt < 120) return true;
    const dev = device === 'gamepad' ? 'pad' : device;
    if (binding === 'key:Escape') {
      this.#finishCapture(null);
      return true;
    }
    if (binding === 'key:Delete') {
      this.#finishCapture('clear');
      return true;
    }
    if (dev !== c.device) return true;
    this.#finishCapture(binding);
    return true;
  }

  #finishCapture(result) {
    const c = this.capture;
    if (!c) return;
    clearTimeout(c.timer);
    this.capture = null;
    c.resolve(result);
  }

  rumble(strong, weak, ms) {
    if (!this.config.get('controls.pad.vibration')) return false;
    return this.pad.rumble(strong, weak, ms);
  }

  get actions() {
    return ACTIONS;
  }

  dispose() {
    for (const off of this._offs) off();
    this._offs = [];
    this.cancelCapture();
    this.kbm.detach();
    this.pad.detach();
    this.touch.detach();
  }
}
