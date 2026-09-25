// Estado "partida". Na Fase 1 roda o modo "livre": câmera FPS livre no mapa escolhido.
// Responsável por: montar/desmontar o mapa (sem vazar GPU), câmera, contexto de entrada, pointer lock,
// pausa e o resumo que vai para a tela de resultado. Os modos de jogo (Fase 8) se penduram aqui.

import { EV, Subscriptions } from '../core/events.js';
import { getMapDef } from '../maps/index.js';
import { createFpsCamera } from '../render/camera.js';
import { disposeObject3D } from '../render/dispose.js';
import { FreeCamera } from '../player/freeCamera.js';
import { CONTEXT } from '../input/inputManager.js';
import { createSandboxHud } from '../ui/sandboxHud.js';
import { createPauseMenu } from '../ui/pauseMenu.js';
import { openSettings } from '../ui/settingsScreen.js';
import { h } from '../ui/dom.js';

export class MatchState {
  constructor(services) {
    this.s = services;
    this.subs = null;
    this.map = null;
    this.camera = null;
    this.player = null;
    this.hud = null;
    this.pause = null;
    this.paused = false;
    this.params = null;
    this.devices = new Set();
    this.startedAt = 0;
    this.pausedMs = 0;
    this.pauseStart = 0;
  }

  async enter(params = {}) {
    const s = this.s;
    this.params = { map: 'testroom', mode: 'livre', ...params };
    const def = getMapDef(this.params.map);
    if (!def) throw new Error(`mapa desconhecido: ${this.params.map}`);
    this.subs = new Subscriptions();

    const loading = h('div.loading', { role: 'status' }, h('span.tape-label', null, `Montando o set: ${def.label}…`));
    s.uiRoot.append(loading);
    try {
      this.map = await def.build({ render: s.render, config: s.config, rng: s.rng, services: s });
    } finally {
      loading.remove();
    }
    this.cursorMode = false;

    this.camera = createFpsCamera({ hfov: s.config.get('graphics.fov'), aspect: s.render.cssWidth / s.render.cssHeight });
    const sp = this.map.spawn;
    this.player = new FreeCamera({
      position: sp.position, yaw: sp.yaw, pitch: sp.pitch, bounds: this.map.bounds, speedScale: this.map.move?.speedScale ?? 1,
    });
    this.player.updateCamera(this.camera, 1);
    s.render.setView(this.map.scene, this.camera, { staticShadows: this.map.staticShadows ?? false });
    // Contexto do pós (jogo, vitrine...) e exposição da montagem de luz do mapa.
    s.render.post?.configure(this.map.post ?? { context: 'jogo', exposure: 1 });

    if (!s.roster.humans.some((p) => p.local)) s.roster.addHuman({ name: 'Você', local: true });

    this.hud = createSandboxHud(s, { title: def.label });
    this.pause = createPauseMenu(s, {
      onResume: () => this.resume(),
      onSettings: () => openSettings(s),
      onEnd: () => s.states.go('result', { summary: this.summary() }),
      onQuit: () => s.states.go('menu'),
    });
    // Agachar (Ctrl) + andar (W) = Ctrl+W, que fecha a aba. Durante a partida o navegador pergunta antes
    // de sair; em tela cheia no Chromium o Keyboard Lock (botão "Tela cheia" da pausa) evita até a pergunta.
    this.subs.listen(window, 'beforeunload', (e) => {
      e.preventDefault();
      e.returnValue = '';
    });
    this.subs.listen(this.hud.prompt, 'click', () => this.#lock());
    this.subs.listen(s.render.canvas, 'click', () => {
      if (this.cursorMode) {
        this.setCursorMode(false);
        return;
      }
      if (!this.paused && s.input.device === 'kbm' && !s.input.pointerLocked) this.#lock();
    });
    this.subs.on(s.events, EV.INPUT_POINTER_LOCK, ({ locked }) => {
      this.hud.setPromptVisible(!locked && !this.paused && !this.cursorMode && s.input.device === 'kbm');
      if (!locked && !this.paused && !this.cursorMode && s.input.device === 'kbm') this.openPause();
    });
    this.subs.on(s.events, EV.INPUT_ACTION, ({ action, phase }) => {
      if (action === 'pause' && phase === 'press' && !this.paused && s.focusNav.empty) this.openPause();
      // Mapas com painel interativo (vitrine): Tab solta o mouse para usar o painel, sem pausar.
      if (action === 'scoreboard' && phase === 'press' && this.map?.panel && !this.paused) this.setCursorMode(true);
    });
    this.subs.on(s.events, EV.INPUT_DEVICE, ({ device }) => {
      this.devices.add(device);
      this.hud.setPromptVisible(device === 'kbm' && !s.input.pointerLocked && !this.paused);
    });

    this.devices = new Set([s.input.device]);
    this.startedAt = performance.now();
    this.pausedMs = 0;
    this.paused = false;
    s.input.setContext(CONTEXT.GAME);
    s.events.emit(EV.MAP_LOADED, { id: this.map.id });
    if (s.input.device === 'kbm') {
      // O clique que abriu a partida ainda vale como gesto do usuário na maioria dos navegadores.
      const ok = await s.input.requestPointerLock();
      this.hud.setPromptVisible(!ok);
    }
  }

  async #lock() {
    const ok = await this.s.input.requestPointerLock();
    if (ok) this.hud.setPromptVisible(false);
    return ok;
  }

  /**
   * Modo cursor (só em mapas com `panel`): o mouse fica livre para o painel do mapa e o jogo não pausa.
   * Sai com Esc/B (navegação por foco), pelo botão do painel ou clicando na cena.
   */
  setCursorMode(on) {
    const s = this.s;
    const panel = this.map?.panel;
    if (!panel || on === this.cursorMode || this.paused) return;
    this.cursorMode = on;
    if (on) {
      s.input.exitPointerLock();
      s.input.setContext(CONTEXT.UI);
      this.hud.setPromptVisible(false);
      panel.open();
      this._popCursorNav = s.focusNav.push(panel.root, { onBack: () => this.setCursorMode(false) });
    } else {
      this._popCursorNav?.();
      this._popCursorNav = null;
      panel.close();
      s.input.setContext(CONTEXT.GAME);
      if (s.input.device === 'kbm') this.#lock();
    }
  }

  openPause() {
    if (this.paused) return;
    this.paused = true;
    this.pauseStart = performance.now();
    // Pausa aberta pelo controle, pelo toque ou pelo Esc com Keyboard Lock: o cursor precisa voltar.
    this.s.input.exitPointerLock();
    this.s.input.setContext(CONTEXT.UI);
    this.hud.setPromptVisible(false);
    this.pause.show();
  }

  async resume() {
    if (!this.paused) return;
    const s = this.s;
    if (s.input.device === 'kbm') {
      // Sem pointer lock não há como mirar no PC: continua pausado até o navegador aceitar.
      const ok = await s.input.requestPointerLock();
      if (!ok) {
        s.toasts.show('Clique em "Continuar" de novo para capturar o mouse');
        return;
      }
    }
    this.paused = false;
    this.pausedMs += performance.now() - this.pauseStart;
    this.pause.hide();
    s.input.setContext(CONTEXT.GAME);
  }

  tick(dt) {
    if (this.paused || !this.player) return;
    this.player.tick(dt, this.s.input, { noclip: this.s.cheats.noclip });
    this.map.tick?.(dt);
  }

  frame(alpha, dt) {
    if (!this.player) return;
    const look = this.s.input.consumeLook();
    if (!this.paused) this.player.applyLook(look);
    this.player.updateCamera(this.camera, this.paused ? 1 : alpha);
    this.map.frame?.(dt, this.camera);
  }

  summary() {
    const now = performance.now();
    const pausedNow = this.paused ? now - this.pauseStart : 0;
    return {
      map: this.params.map,
      mode: this.params.mode,
      durationS: (now - this.startedAt - this.pausedMs - pausedNow) / 1000,
      distance: this.player?.stats.distance ?? 0,
      topSpeed: this.player?.stats.topSpeed ?? 0,
      ticks: this.player?.stats.ticks ?? 0,
      devices: [...this.devices],
    };
  }

  async exit() {
    const s = this.s;
    s.input.exitPointerLock();
    s.input.setContext(CONTEXT.UI);
    this._popCursorNav?.();
    this._popCursorNav = null;
    this.cursorMode = false;
    this.subs?.dispose();
    this.pause?.dispose();
    this.hud?.dispose();
    s.render.clearView();
    s.render.post?.configure({ context: 'jogo', exposure: 1 });
    if (this.map) {
      const id = this.map.id;
      this.map.dispose?.();
      disposeObject3D(this.map.scene);
      // Materiais do set em cache eram deste mapa (a GPU já foi liberada acima): o próximo mapa cria os seus.
      s.set?.releaseMaterials();
      s.events.emit(EV.MAP_UNLOADED, { id });
    }
    this.map = null;
    this.player = null;
    this.camera = null;
    this.pause = null;
    this.hud = null;
    this.paused = false;
  }

  /** Teleporte do console (setpos) e respawn. */
  teleport(position, yaw, pitch) {
    this.player?.teleport(position, yaw, pitch);
  }
}
