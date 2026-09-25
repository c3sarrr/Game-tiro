// Navegação de menus sem mouse: direcional/analógico do controle e setas do teclado movem o foco
// espacialmente entre os elementos focáveis da camada de UI do topo; ✕/A confirma; ○/B, Options e Esc voltam.
// Sliders e seletores respondem a ←/→ quando focados (ajuste fino por controle).
// Mantém a pilha de camadas (tela → modal): só a camada do topo recebe foco e "voltar".

const FOCUSABLE = 'button:not([disabled]), [data-nav]:not([disabled]), input:not([disabled]), select:not([disabled]), a[href]';
const REPEAT_DELAY = 0.38;
const REPEAT_RATE = 0.09;
const PAD = { A: 0, B: 1, START: 9, UP: 12, DOWN: 13, LEFT: 14, RIGHT: 15 };

export class FocusNavigator {
  constructor({ input }) {
    this.input = input;
    this.stack = []; // {root, onBack, opener}
    this.prev = { a: 0, b: 0, start: 0 };
    this.held = null;
    this.holdTime = 0;
    this.wasCapturing = false;
    this._onKey = (e) => this.#key(e);
    // Fase de captura: roda antes do teclado do jogo (Esc cancela a captura de tecla antes de virar "pausar").
    window.addEventListener('keydown', this._onKey, true);
    // Anel de foco: aparece ao navegar por controle/setas, some ao usar o mouse/toque.
    this._onPointer = () => document.documentElement.classList.remove('nav-keys');
    window.addEventListener('pointerdown', this._onPointer, true);
    window.addEventListener('mousemove', this._onPointer, { passive: true });
  }

  /** Empilha uma camada: o foco fica preso nela até ser removida. Devolve a função de remoção. */
  push(root, { onBack = null, autofocus = true } = {}) {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    // Camadas de baixo ficam inertes: Tab/cliques não escapam do modal.
    for (const layer of this.stack) layer.root.inert = true;
    this.stack.push({ root, onBack, opener });
    // O botão que abriu esta camada (✕/○/Options) só vale de novo depois de solto.
    this.prev.a = 1;
    this.prev.b = 1;
    this.prev.start = 1;
    if (autofocus) setTimeout(() => this.focusFirst(), 0);
    return () => this.pop(root);
  }

  pop(root) {
    const i = this.stack.findIndex((s) => s.root === root);
    if (i < 0) return;
    const [layer] = this.stack.splice(i, 1);
    const top = this.top;
    if (top) {
      top.root.inert = false;
      // Devolve o foco a quem abriu a camada (se ainda existir), senão ao primeiro focável.
      setTimeout(() => {
        if (layer.opener?.isConnected && top.root.contains(layer.opener)) layer.opener.focus();
        else this.focusFirst(true);
      }, 0);
    }
  }

  /** Remove todas as camadas (troca de estado): nenhuma fica presa por baixo da próxima tela. */
  clear() {
    for (const layer of this.stack) layer.root.inert = false;
    this.stack = [];
  }

  get top() {
    return this.stack[this.stack.length - 1] ?? null;
  }

  get empty() {
    return this.stack.length === 0;
  }

  #candidates() {
    const top = this.top;
    if (!top || !top.root.isConnected) return [];
    return [...top.root.querySelectorAll(FOCUSABLE)].filter((el) => el.offsetParent !== null && !el.closest('[inert]'));
  }

  focusFirst(keepIfInside = false) {
    const list = this.#candidates();
    if (keepIfInside && list.includes(document.activeElement)) return;
    const preferred = list.find((el) => el.hasAttribute('data-autofocus')) ?? list[0];
    preferred?.focus({ preventScroll: false });
  }

  /** Move o foco na direção (dx, dy): candidato mais próximo dentro de um cone. */
  move(dx, dy) {
    const list = this.#candidates();
    if (!list.length) return;
    const current = list.includes(document.activeElement) ? document.activeElement : null;
    if (!current) {
      this.focusFirst();
      return;
    }
    const a = current.getBoundingClientRect();
    const ax = a.left + a.width / 2;
    const ay = a.top + a.height / 2;
    let best = null;
    let bestScore = Infinity;
    for (const el of list) {
      if (el === current) continue;
      const b = el.getBoundingClientRect();
      const vx = b.left + b.width / 2 - ax;
      const vy = b.top + b.height / 2 - ay;
      const along = vx * dx + vy * dy;
      if (along <= 4) continue;
      const across = Math.abs(vx * dy - vy * dx);
      const score = along + across * 2.2;
      if (score < bestScore) {
        bestScore = score;
        best = el;
      }
    }
    if (best) {
      best.focus();
      best.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
    }
  }

  #adjust(el, dir) {
    if (el?.tagName === 'INPUT' && el.type === 'range') {
      const step = Number(el.step) || 1;
      el.value = String(Math.min(Number(el.max), Math.max(Number(el.min), Number(el.value) + dir * step)));
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    }
    if (el?.tagName === 'SELECT') {
      el.selectedIndex = Math.min(el.options.length - 1, Math.max(0, el.selectedIndex + dir));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    }
    return false;
  }

  back() {
    if (this.input.capture) {
      this.input.cancelCapture();
      return true;
    }
    const top = this.top;
    if (top?.onBack) {
      top.onBack();
      return true;
    }
    return false;
  }

  #key(e) {
    if (!this.top) return;
    const active = document.activeElement;
    const tag = active?.tagName;
    const typing = (tag === 'INPUT' && !['range', 'checkbox'].includes(active.type)) || tag === 'TEXTAREA';
    // Digitando (console, chat): as teclas são do campo de texto, inclusive o Esc.
    if (typing) return;
    if (e.key === 'Escape') {
      // Durante a captura de tecla, o próprio Esc é o "cancelar" da captura (tratado pelo InputManager).
      if (this.input.capture) return;
      e.preventDefault();
      this.back();
      return;
    }
    const dirs = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] };
    const d = dirs[e.key];
    if (!d) {
      if (e.key === 'Tab') document.documentElement.classList.add('nav-keys');
      return;
    }
    e.preventDefault();
    document.documentElement.classList.add('nav-keys');
    if (d[0] !== 0 && this.#adjust(active, d[0])) return;
    this.move(d[0], d[1]);
  }

  /** A cada quadro: lê o controle diretamente (independe dos binds de jogo). */
  update(dt) {
    const pad = this.input.pad;
    const connected = pad.connected;
    let sx = 0;
    let sy = 0;
    if (connected) {
      const s = pad.stick('left', 0.35);
      sx = s.x;
      sy = s.y;
    }
    const nowA = connected && pad.isButtonDown(PAD.A) ? 1 : 0;
    const nowB = connected && pad.isButtonDown(PAD.B) ? 1 : 0;
    const nowStart = connected && pad.isButtonDown(PAD.START) ? 1 : 0;
    let dir = null;
    if (connected) {
      if (pad.isButtonDown(PAD.UP) || sy < -0.6) dir = 'up';
      else if (pad.isButtonDown(PAD.DOWN) || sy > 0.6) dir = 'down';
      else if (pad.isButtonDown(PAD.LEFT) || sx < -0.6) dir = 'left';
      else if (pad.isButtonDown(PAD.RIGHT) || sx > 0.6) dir = 'right';
    }

    // Fim de uma captura de botão (remapeamento): o botão capturado não pode virar "voltar/confirmar".
    const capturing = !!this.input.capture;
    if (this.wasCapturing && !capturing) {
      this.prev.a = 1;
      this.prev.b = 1;
      this.prev.start = 1;
    }
    this.wasCapturing = capturing;
    if (connected && (dir || nowA || nowB)) document.documentElement.classList.add('nav-keys');

    // O estado anterior é sempre atualizado (mesmo sem camada), para o botão que ABRIU um menu
    // não ser lido como "voltar" no mesmo quadro.
    if (this.top && !capturing) {
      if (dir !== this.held) {
        this.holdTime = 0;
        if (dir) this.#dir(dir);
      } else if (dir) {
        this.holdTime += dt;
        if (this.holdTime > REPEAT_DELAY) {
          this.holdTime -= REPEAT_RATE;
          this.#dir(dir);
        }
      }
      if (nowA && !this.prev.a) this.#confirm();
      if ((nowB && !this.prev.b) || (nowStart && !this.prev.start)) this.back();
    }
    this.held = dir;
    // Um "1" pendente (camada recém-aberta) só zera quando o botão for solto de fato.
    this.prev.a = this.prev.a && nowA ? 1 : nowA;
    this.prev.b = this.prev.b && nowB ? 1 : nowB;
    this.prev.start = this.prev.start && nowStart ? 1 : nowStart;
  }

  #confirm() {
    const el = document.activeElement;
    if (!el || !this.#candidates().includes(el)) {
      this.focusFirst();
      return;
    }
    if (el.tagName === 'INPUT' && el.type === 'checkbox') {
      el.checked = !el.checked;
      el.dispatchEvent(new Event('change', { bubbles: true }));
    } else {
      el.click();
    }
  }

  #dir(d) {
    const v = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[d];
    if (v[0] !== 0 && this.#adjust(document.activeElement, v[0])) return;
    this.move(v[0], v[1]);
  }

  dispose() {
    window.removeEventListener('keydown', this._onKey, true);
    window.removeEventListener('pointerdown', this._onPointer, true);
    window.removeEventListener('mousemove', this._onPointer);
    this.clear();
  }
}
