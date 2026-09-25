// Teclado + mouse: estado de teclas (por KeyboardEvent.code = posição física), botões, roda e movimento com
// pointer lock (com "entrada bruta" — unadjustedMovement — quando o navegador suporta).
// Latches: um toque mais curto que um tick (1/64 s) ainda conta como "pressionado" no próximo tick.

const SPIKE_LIMIT = 900; // contagens: picos espúrios de movementX do Chrome sem entrada bruta

export class KeyboardMouse {
  constructor({ element }) {
    this.element = element;
    this.down = new Set();
    this.pressed = new Set();
    this.released = new Set();
    this.wheelUp = 0;
    this.wheelDown = 0;
    this.dx = 0;
    this.dy = 0;
    this.pointerLocked = false;
    this.rawActive = false;
    this.rawSupported = true;
    this.listener = null;
    this._offs = [];
  }

  /**
   * @param {{onPress(b:string,e:Event):boolean, onRelease(b:string):void, onActivity():void,
   *          shouldPrevent(b:string,e:Event):boolean, onLockChange(locked:boolean):void, isTextFocus():boolean}} listener
   */
  attach(listener) {
    this.listener = listener;
    const on = (target, type, fn, opts) => {
      target.addEventListener(type, fn, opts);
      this._offs.push(() => target.removeEventListener(type, fn, opts));
    };
    on(window, 'keydown', (e) => this.#keyDown(e));
    on(window, 'keyup', (e) => this.#keyUp(e));
    on(window, 'mousedown', (e) => this.#mouseDown(e));
    on(window, 'mouseup', (e) => this.#mouseUp(e));
    on(window, 'mousemove', (e) => this.#mouseMove(e));
    on(window, 'wheel', (e) => this.#wheel(e), { passive: false });
    on(window, 'blur', () => this.releaseAll());
    on(this.element, 'contextmenu', (e) => e.preventDefault());
    on(document, 'pointerlockchange', () => this.#lockChange());
    on(document, 'pointerlockerror', () => this.#lockChange());
  }

  detach() {
    for (const off of this._offs) off();
    this._offs = [];
    this.listener = null;
  }

  #binding(code) {
    return `key:${code}`;
  }

  #keyDown(e) {
    if (!e.code || !this.listener) return;
    if (this.listener.isTextFocus()) return; // digitando no console/chat
    const b = this.#binding(e.code);
    if (this.listener.shouldPrevent(b, e)) e.preventDefault();
    this.listener.onActivity();
    if (e.repeat || this.down.has(b)) return;
    this.down.add(b);
    this.pressed.add(b);
    this.listener.onPress(b, e);
  }

  #keyUp(e) {
    if (!e.code || !this.listener) return;
    const b = this.#binding(e.code);
    if (!this.down.has(b)) return;
    this.down.delete(b);
    this.released.add(b);
    this.listener.onRelease(b);
  }

  #mouseDown(e) {
    if (!this.listener) return;
    const b = `mouse:${e.button}`;
    this.listener.onActivity();
    // Botões 4/5 (voltar/avançar): o navegador sairia da página; eles são teclas de jogo.
    if (e.button > 2 || (this.pointerLocked && this.listener.shouldPrevent(b, e))) e.preventDefault();
    if (this.down.has(b)) return;
    this.down.add(b);
    this.pressed.add(b);
    this.listener.onPress(b, e);
  }

  #mouseUp(e) {
    if (!this.listener) return;
    const b = `mouse:${e.button}`;
    // Chrome/Edge navegam no histórico ao SOLTAR os botões 4/5 — cancelar aqui.
    if (e.button > 2) e.preventDefault();
    if (!this.down.has(b)) return;
    this.down.delete(b);
    this.released.add(b);
    this.listener.onRelease(b);
  }

  #mouseMove(e) {
    if (!this.pointerLocked) {
      if (Math.abs(e.movementX) + Math.abs(e.movementY) > 2) this.listener?.onActivity();
      return;
    }
    const mx = e.movementX || 0;
    const my = e.movementY || 0;
    if (!this.rawActive && (Math.abs(mx) > SPIKE_LIMIT || Math.abs(my) > SPIKE_LIMIT)) return;
    this.dx += mx;
    this.dy += my;
    if (mx || my) this.listener?.onActivity();
  }

  #wheel(e) {
    if (!this.listener || this.listener.isTextFocus()) return;
    if (e.deltaY === 0) return;
    const b = e.deltaY < 0 ? 'wheel:up' : 'wheel:down';
    if (this.pointerLocked) e.preventDefault();
    if (b === 'wheel:up') this.wheelUp++;
    else this.wheelDown++;
    this.listener.onActivity();
    this.listener.onPress(b, e);
    this.listener.onRelease(b);
  }

  #lockChange() {
    const locked = document.pointerLockElement === this.element;
    if (locked === this.pointerLocked) return;
    this.pointerLocked = locked;
    if (!locked) {
      this.rawActive = false;
      this.dx = 0;
      this.dy = 0;
    }
    this.listener?.onLockChange(locked);
  }

  /** Pede pointer lock (tenta entrada bruta primeiro). Resolve true/false; nunca rejeita. */
  async requestPointerLock(raw = true) {
    const el = this.element;
    if (document.pointerLockElement === el) return true;
    if (!el.requestPointerLock) return false;
    const attempt = async (opts) => {
      const p = opts ? el.requestPointerLock(opts) : el.requestPointerLock();
      if (p && typeof p.then === 'function') await p;
    };
    try {
      if (raw && this.rawSupported) {
        await attempt({ unadjustedMovement: true });
        this.rawActive = true;
      } else {
        await attempt();
        this.rawActive = false;
      }
      return true;
    } catch (err) {
      if (raw && err?.name === 'NotSupportedError') {
        this.rawSupported = false;
        try {
          await attempt();
          this.rawActive = false;
          return true;
        } catch {
          return false;
        }
      }
      // SecurityError/WrongDocumentError: o usuário saiu do lock há pouco — o navegador exige um novo clique.
      return false;
    }
  }

  exitPointerLock() {
    if (document.pointerLockElement === this.element) document.exitPointerLock();
  }

  /** Pressionado agora OU tocado desde o último tick. */
  isDown(binding) {
    return this.down.has(binding) || this.pressed.has(binding);
  }

  wasPressed(binding) {
    return this.pressed.has(binding);
  }

  wasReleased(binding) {
    return this.released.has(binding);
  }

  wheelCount(dir) {
    return dir === 'up' ? this.wheelUp : this.wheelDown;
  }

  consumeMouse() {
    const out = { dx: this.dx, dy: this.dy };
    this.dx = 0;
    this.dy = 0;
    return out;
  }

  clearLatches() {
    this.pressed.clear();
    this.released.clear();
    this.wheelUp = 0;
    this.wheelDown = 0;
  }

  /** Solta tudo (janela perdeu o foco): evita tecla "presa" andando sozinha. */
  releaseAll() {
    for (const b of this.down) {
      this.released.add(b);
      this.listener?.onRelease(b);
    }
    this.down.clear();
  }
}
