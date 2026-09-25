// Recuperação limpa de contexto WebGL perdido (GPU reiniciou, driver trocou, aba ficou muito tempo em segundo plano).
// Ao recuperar, o WebGLRenderer do three (r186) recria o próprio estado e realoca texturas, alvos, geometrias e
// programas sob demanda — mas os ouvintes de 'dispose' do contexto ANTIGO continuam presos a cada objeto. Liberar
// depois qualquer recurso criado antes da perda (trocar de mapa, redimensionar um alvo, reassar um atlas) faria o
// three apagar objetos do contexto morto: rajada de INVALID_OPERATION ("object does not belong to this context").
// Este módulo registra quais objetos do three receberam ouvintes de 'dispose' e, na recuperação, remove os
// ouvintes antigos antes de qualquer reuso: o three põe ouvintes novos quando realoca o recurso.
// (O código do jogo não usa ouvintes de 'dispose' — só o three —, então limpar todos é seguro.)

import * as THREE from 'three';

/** @type {Set<WeakRef<THREE.EventDispatcher>>} */
const tracked = new Set();
let installed = false;

/** Instala o registro (uma vez, antes do primeiro recurso de GPU). */
export function installDisposeTracker() {
  if (installed) return;
  installed = true;
  const proto = THREE.EventDispatcher.prototype;
  const add = proto.addEventListener;
  proto.addEventListener = function addEventListenerTracked(type, listener) {
    if (type === 'dispose' && !this.__massacreTracked) {
      Object.defineProperty(this, '__massacreTracked', { value: true, writable: true, enumerable: false });
      tracked.add(new WeakRef(this));
    }
    return add.call(this, type, listener);
  };
}

/** Na recuperação do contexto: tira os ouvintes de 'dispose' do contexto antigo. Devolve quantos objetos. */
export function purgeStaleDisposeListeners() {
  let count = 0;
  for (const ref of tracked) {
    const obj = ref.deref();
    tracked.delete(ref);
    if (!obj) continue;
    obj.__massacreTracked = false;
    const list = obj._listeners?.dispose;
    if (list && list.length) {
      list.length = 0;
      count++;
    }
  }
  return count;
}

/** Remove do registro os objetos já coletados (chamado ao descarregar um mapa). */
export function compactDisposeTracker() {
  for (const ref of tracked) if (!ref.deref()) tracked.delete(ref);
  return tracked.size;
}
