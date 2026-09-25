// Remapeamento de teclas/botões: captura o próximo input do dispositivo, resolve conflitos e grava na config.

import { EV } from '../core/events.js';
import { assignBinding, clearBinding } from './bindings.js';
import { defaultBindings } from '../data/bindings.js';

export class Rebinder {
  constructor({ input, config, events }) {
    this.input = input;
    this.config = config;
    this.events = events;
  }

  /**
   * Espera o jogador apertar algo e liga à ação.
   * @param {'kbm'|'pad'} device
   * @returns {Promise<{status:'bound'|'cleared'|'cancelled', binding?:string, displaced?:string[]}>}
   */
  async rebind(action, device, slot = 0) {
    const result = await this.input.captureNext(device);
    if (result === null) return { status: 'cancelled' };
    if (result === 'clear') {
      this.clear(action, device, slot);
      return { status: 'cleared' };
    }
    const { bindings, displaced } = assignBinding(this.config.get('controls.bindings'), action, result, slot);
    this.config.set('controls.bindings', bindings);
    this.events.emit(EV.INPUT_REBIND, { action, device, bindings: bindings[action][device], displaced });
    return { status: 'bound', binding: result, displaced };
  }

  /** Liga diretamente (console: `bind`), acrescentando como principal sem tirar as outras teclas da ação. */
  bind(action, binding, slot = 0) {
    const { bindings, displaced } = assignBinding(this.config.get('controls.bindings'), action, binding, slot, 'insert');
    this.config.set('controls.bindings', bindings);
    this.events.emit(EV.INPUT_REBIND, { action, device: binding.startsWith('pad:') ? 'pad' : 'kbm', bindings: bindings[action], displaced });
    return displaced;
  }

  clear(action, device, slot = null) {
    const bindings = clearBinding(this.config.get('controls.bindings'), action, device, slot);
    this.config.set('controls.bindings', bindings);
    this.events.emit(EV.INPUT_REBIND, { action, device, bindings: bindings[action][device], displaced: [] });
  }

  /** Volta ao padrão (de um dispositivo ou de tudo). */
  reset(device = null) {
    const defaults = defaultBindings();
    if (!device) {
      this.config.set('controls.bindings', defaults);
      return;
    }
    const current = structuredClone(this.config.get('controls.bindings'));
    for (const action of Object.keys(defaults)) current[action][device] = defaults[action][device];
    this.config.set('controls.bindings', current);
  }
}
