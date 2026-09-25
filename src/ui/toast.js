// Avisos curtos na tela, em etiquetas de fita crepe (ex.: "Controle conectado: DualSense").

import { h } from './dom.js';

export class Toasts {
  constructor(root) {
    this.root = h('div.toasts', { role: 'status', 'aria-live': 'polite' });
    root.append(this.root);
  }

  show(message, { kind = 'info', ms = 3200 } = {}) {
    const el = h(`div.toast.toast--${kind}`, null, message);
    el.style.setProperty('--tilt', `${(Math.random() * 4 - 2).toFixed(2)}deg`);
    this.root.append(el);
    const remove = () => {
      el.classList.add('is-out');
      setTimeout(() => el.remove(), 350);
    };
    setTimeout(remove, ms);
    while (this.root.children.length > 4) this.root.firstChild.remove();
    return remove;
  }
}
