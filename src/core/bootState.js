// Estado "boot": detecção de hardware (primeiro acesso), aplicação do preset e passagem para o menu.
// A config já foi carregada do IndexedDB em main.js (o renderer precisa dela para nascer).

import { createBootScreen } from '../ui/bootScreen.js';
import { PRESET_LABELS } from '../data/qualityPresets.js';
import { nextFrame, wait } from './frame.js';

export class BootState {
  constructor(services) {
    this.s = services;
    this.screen = null;
  }

  async enter() {
    const s = this.s;
    this.screen = createBootScreen(s.uiRoot);
    this.screen.set(0.15, 'Abrindo o estúdio…');
    await nextFrame();
    this.screen.set(0.35, 'Conferindo a placa de vídeo…');
    await nextFrame();
    const r = await s.quality.autoDetect(s.render.renderer);
    const gpu = r.hardware.name;
    this.screen.set(0.75, r.changed
      ? `Primeiro acesso: preset ${PRESET_LABELS[r.preset]} para ${gpu}`
      : `Preset ${PRESET_LABELS[s.config.get('graphics.preset')]} · ${gpu}`);
    if (!s.store.persistent) {
      s.log.warn('armazenamento local indisponível (aba privada?): configurações valem só nesta sessão');
    }
    await wait(420);
    this.screen.set(1, 'Pronto!');
    await wait(260);
    s.states.go('menu');
  }

  exit() {
    this.screen?.remove();
    this.screen = null;
  }
}
