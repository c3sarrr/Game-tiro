// SMAA (Jimenez et al. 2012) do three/addons, em espaço de exibição depois do tone mapping.
// O SMAAPass original conta com o autoClear do EffectComposer e com a cor de limpeza preta: os alvos de bordas
// e pesos só são escritos onde há borda (o resto é descartado e precisa valer 0). O renderer do MASSACRE limpa
// com o marrom do estúdio, então este passe troca a cor de limpeza durante as suas três etapas e devolve depois.

import * as THREE from 'three';
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js';

const _clear = new THREE.Color();

export class StudioSMAAPass extends SMAAPass {
  render(renderer, writeBuffer, readBuffer, deltaTime, maskActive) {
    renderer.getClearColor(_clear);
    const alpha = renderer.getClearAlpha();
    const autoClear = renderer.autoClear;
    renderer.setClearColor(0x000000, 0);
    renderer.autoClear = true;
    try {
      super.render(renderer, writeBuffer, readBuffer, deltaTime, maskActive);
    } finally {
      renderer.setClearColor(_clear, alpha);
      renderer.autoClear = autoClear;
    }
  }
}
