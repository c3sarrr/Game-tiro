// Barramento de eventos síncrono (pub/sub) usado por todos os sistemas.
// - `on` devolve a função de cancelamento; `Subscriptions` agrupa várias e desmonta tudo de uma vez
//   (cada estado do jogo cria as suas e chama dispose() ao sair — evita vazamento entre partidas).
// - A lista de ouvintes é copy-on-write: emitir não aloca e é seguro cancelar dentro de um ouvinte.
// - Um ouvinte que lança erro não impede os demais; o erro vai para `onError`.

export class EventBus {
  /** @type {Map<string, Function[]>} */
  #listeners = new Map();
  #onError;

  constructor({ onError } = {}) {
    this.#onError = onError ?? ((err, type) => console.error(`[eventos] ouvinte de "${type}" falhou`, err));
  }

  on(type, fn) {
    if (typeof fn !== 'function') throw new TypeError(`ouvinte inválido para "${type}"`);
    const list = this.#listeners.get(type);
    this.#listeners.set(type, list ? [...list, fn] : [fn]);
    return () => this.off(type, fn);
  }

  once(type, fn) {
    const off = this.on(type, (payload, t) => {
      off();
      fn(payload, t);
    });
    return off;
  }

  off(type, fn) {
    const list = this.#listeners.get(type);
    if (!list) return;
    const i = list.indexOf(fn);
    if (i < 0) return;
    if (list.length === 1) this.#listeners.delete(type);
    else this.#listeners.set(type, list.slice(0, i).concat(list.slice(i + 1)));
  }

  /** Emite para os ouvintes do tipo e para os curingas ('*'). Devolve quantos ouvintes do tipo foram chamados. */
  emit(type, payload) {
    const list = this.#listeners.get(type);
    if (list) {
      for (let i = 0; i < list.length; i++) {
        try {
          list[i](payload, type);
        } catch (err) {
          this.#onError(err, type);
        }
      }
    }
    if (type !== '*') {
      const any = this.#listeners.get('*');
      if (any) {
        for (let i = 0; i < any.length; i++) {
          try {
            any[i](payload, type);
          } catch (err) {
            this.#onError(err, '*');
          }
        }
      }
    }
    return list ? list.length : 0;
  }

  count(type) {
    return this.#listeners.get(type)?.length ?? 0;
  }

  clear() {
    this.#listeners.clear();
  }
}

/** Coleção de cancelamentos (eventos do barramento e do DOM) para desmontar em bloco. */
export class Subscriptions {
  #offs = [];

  add(off) {
    this.#offs.push(off);
    return off;
  }

  on(bus, type, fn) {
    return this.add(bus.on(type, fn));
  }

  listen(target, type, fn, options) {
    target.addEventListener(type, fn, options);
    return this.add(() => target.removeEventListener(type, fn, options));
  }

  get size() {
    return this.#offs.length;
  }

  dispose() {
    const offs = this.#offs;
    this.#offs = [];
    for (let i = offs.length - 1; i >= 0; i--) offs[i]();
  }
}

/** Nomes de eventos compartilhados. Usar sempre as constantes para evitar erro de digitação. */
export const EV = Object.freeze({
  STATE_CHANGE: 'state:change', // {from, to, params}
  CONFIG_LOADED: 'config:loaded', // {values}
  CONFIG_CHANGE: 'config:change', // {key, value, prev, source}
  INPUT_DEVICE: 'input:device', // {device, previous}
  INPUT_GAMEPAD: 'input:gamepad', // {connected, index, id, type}
  INPUT_POINTER_LOCK: 'input:pointerlock', // {locked}
  INPUT_REBIND: 'input:rebind', // {action, device, bindings}
  INPUT_ACTION: 'input:action', // {action, device} — ação discreta pressionada (qualquer contexto)
  RENDER_RESIZE: 'render:resize', // {width, height, pixelRatio, drawingWidth, drawingHeight}
  RENDER_QUALITY: 'render:quality', // {preset, settings}
  RENDER_CONTEXT: 'render:context', // {lost}
  POSE: 'stopmotion:pose', // {pose} — troca de pose a 12 poses/s
  LOG: 'log', // {level, text, time}
  CHEAT: 'cheat:change', // {name, value}
  ROSTER: 'roster:change', // {participants}
  MAP_LOADED: 'map:loaded', // {id}
  MAP_UNLOADED: 'map:unloaded', // {id}
  LOADOUT: 'loadout:change', // {owner, loadout}
});
