// Estado "partida". Até os modos de jogo (Fase 8) roda o modo "livre" no mapa escolhido: em mapa com colisão o jogador
// anda com a cápsula (PlayerPawn, Fase 3) e o inventário local; sem colisão (vitrine) voa com a câmera livre.
// Responsável por: montar/desmontar o mapa (sem vazar GPU), jogador e câmera, contexto de entrada, pointer lock,
// pausa, a vida no HUD de teste, a morte e a volta em 2 s (subfase 3.4: no ponto de volta — o último teleporte do
// console que se sustentou, senão o spawn —; cair do set mata, com god volta ao spawn), sensibilidade da luneta,
// trincos do andar, ferramentas de debug da física e do movimento (medidores de counter-strafe e de salto e queda), o
// teleporte das estações (`estacao`, pista de testes) e o resumo que vai para a tela de resultado.

import { EV, Subscriptions } from '../core/events.js';
import { SANDBOX } from '../data/sandbox.js';
import { VITALS } from '../data/vitals.js';
import { getMapDef } from '../maps/index.js';
import { ReturnPoint } from './returnPoint.js';
import { createFpsCamera } from '../render/camera.js';
import { disposeObject3D } from '../render/dispose.js';
import { FreeCamera } from '../player/freeCamera.js';
import { PlayerPawn } from '../player/playerPawn.js';
import { itemName, zoomLevels } from '../player/hands.js';
import { readyToRespawn } from '../player/vitals.js';
import { PhysicsDebugView } from '../debug/physicsDebug.js';
import { ShowPosPanel } from '../debug/showPos.js';
import { StrafeMeter } from '../debug/strafeMeter.js';
import { JumpMeter } from '../debug/jumpMeter.js';
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
    this.physicsDebug = null;
    this.showPos = null;
    this.strafe = null; // medidor de counter-strafe (cl_showpos)
    this.jump = null; // medidor de salto e queda (cl_showpos)
    this.hud = null;
    this.pause = null;
    this.paused = false;
    this.params = null;
    this.devices = new Set();
    this.startedAt = 0;
    this.pausedMs = 0;
    this.pauseStart = 0;
    this.returnPoint = new ReturnPoint(); // ponto de volta: o último teleporte do console neste mapa (senão o spawn)
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
    if (this.map.collision) {
      this.player = new PlayerPawn({
        world: this.map.collision, sv: s.sv, loadout: s.localLoadout, events: s.events,
        position: sp.position, yaw: sp.yaw, pitch: sp.pitch,
      });
      this.physicsDebug = new PhysicsDebugView({ scene: this.map.scene, world: this.map.collision });
      this.showPos = new ShowPosPanel(s.debugRoot);
      this.strafe = new StrafeMeter(s.loop.stepDt);
      this.jump = new JumpMeter(s.loop.stepDt);
      this.#applyDebugView();
      this.subs.add(s.config.watch('debug.', () => this.#applyDebugView()));
    } else {
      this.player = new FreeCamera({
        position: sp.position, yaw: sp.yaw, pitch: sp.pitch, bounds: this.map.bounds, speedScale: this.map.move?.speedScale ?? 1,
      });
    }
    this.player.updateCamera(this.camera, 1);
    s.render.setView(this.map.scene, this.camera, { staticShadows: this.map.staticShadows ?? false });
    // Contexto do pós (jogo, vitrine...) e exposição da montagem de luz do mapa.
    s.render.post?.configure(this.map.post ?? { context: 'jogo', exposure: 1 });

    if (!s.roster.humans.some((p) => p.local)) s.roster.addHuman({ name: 'Você', local: true });

    this.hud = createSandboxHud(s, {
      title: def.label, mode: this.map.collision ? 'andar' : 'voo', stations: Boolean(this.map.stations?.length),
    });
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
    if (this.player instanceof PlayerPawn) {
      // Arma recebida (give, loja): troca automática se for melhor que a da mão.
      this.subs.on(s.events, EV.LOADOUT, ({ owner, received }) => {
        if (owner === 'local') this.player?.onLoadout(received);
      });
      this.subs.on(s.events, EV.PLAYER_WEAPON, () => this.#syncHeld());
      this.subs.on(s.events, EV.PLAYER_ZOOM, () => this.#syncHeld());
      this.#syncHeld();
      // Vida no HUD de teste: dano (pisca e mostra quanto saiu), morte (etiqueta com a causa) e volta.
      this.subs.on(s.events, EV.LOADOUT, () => this.#syncVitals());
      this.subs.on(s.events, EV.PLAYER_HURT, ({ damage }) => {
        this.#syncVitals();
        this.hud.flashDamage(damage);
      });
      this.subs.on(s.events, EV.PLAYER_DEATH, ({ cause }) => {
        this.returnPoint.failed(cause);
        this.#syncVitals();
      });
      this.subs.on(s.events, EV.PLAYER_SPAWN, () => {
        this.#syncVitals();
        this.hud.setDeath(null);
      });
      this.#syncVitals();
    }

    this.devices = new Set([s.input.device]);
    this.startedAt = performance.now();
    this.pausedMs = 0;
    this.paused = false;
    s.input.resetToggles();
    s.input.setContext(CONTEXT.GAME);
    s.events.emit(EV.MAP_LOADED, { id: this.map.id });
    if (s.input.device === 'kbm') {
      // O clique que abriu a partida ainda vale como gesto do usuário na maioria dos navegadores.
      const ok = await s.input.requestPointerLock();
      this.hud.setPromptVisible(!ok);
    }
  }

  /** r_colisao, cl_showpos e terceira pessoa seguem as chaves de debug da config. */
  #applyDebugView() {
    const cfg = this.s.config;
    this.physicsDebug?.setVisible(cfg.get('debug.collision'));
    this.showPos?.setVisible(cfg.get('debug.showPos'));
    if (this.player instanceof PlayerPawn) this.player.thirdPerson = cfg.get('debug.thirdPerson');
  }

  /** Etiqueta "na mão" do HUD de teste: item, velocidade no modo atual e nível da luneta. */
  #syncHeld() {
    const p = this.player;
    if (!(p instanceof PlayerPawn)) return;
    const levels = zoomLevels(p.hands.item);
    const zoom = levels ? ` · luneta ${p.hands.zoom}/${levels}` : '';
    this.hud.setHeld(`na mão: ${itemName(p.hands.item)} · ${p.held.speed} u/s${zoom}`);
  }

  /** Etiqueta de vida do HUD de teste: vida do jogador e colete do inventário. */
  #syncVitals() {
    const p = this.player;
    if (!(p instanceof PlayerPawn)) return;
    this.hud.setVitals(p.vitals.health, p.loadout.armor);
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

  tick(dt, tickIndex) {
    if (this.paused || !this.player) return;
    // O olhar acumulado no quadro entra antes do tick: o comando do tick usa o yaw mais recente.
    this.player.applyLook(this.s.input.consumeLook());
    this.player.tick(dt, this.s.input, {
      noclip: this.s.cheats.noclip, tick: tickIndex, god: this.s.cheats.god,
      reduceMotion: this.s.config.get('accessibility.reduceMotion'),
    });
    if (this.player instanceof PlayerPawn) {
      this.returnPoint.update(this.player.vitals.alive, this.player.state.onGround);
      this.strafe.updateFrom(this.player.telemetry);
      this.jump.update(this.player.state, this.player.env.events);
      // Luneta: a sensibilidade do olhar do próximo quadro segue o nível de zoom deste tick.
      this.s.input.lookScale = this.player.lookScale(this.s.config.get('controls.zoomSensitivity'));
    }
    this.#checkFellOut();
    if (this.player instanceof PlayerPawn && readyToRespawn(this.player.vitals)) this.#respawn();
    this.map.tick?.(dt);
  }

  /**
   * Fora do set (noclip desligado lá fora, ou um buraco): bem abaixo do mapa o jogador morre ("Caiu do set"); com god,
   * volta ao spawn com o aviso. Nos dois casos, um ponto de volta em que ele ainda não tinha pisado sai (ReturnPoint).
   */
  #checkFellOut() {
    const p = this.player;
    if (!(p instanceof PlayerPawn) || p.state.origin.y > this.map.bounds.min.y - SANDBOX.fallOutDepth) return;
    if (!p.vitals.alive) return;
    if (!this.s.cheats.god) {
      p.kill('fora');
      return;
    }
    this.returnPoint.failed('fora');
    const sp = this.map.spawn;
    this.#place(sp.position, sp.yaw, sp.pitch);
    this.s.toasts.show('Caiu para fora do set: de volta ao spawn');
  }

  /** Volta ao jogo no ponto de volta (o último teleporte do console neste mapa que se sustentou, senão o spawn). */
  #respawn() {
    const point = this.returnPoint.pick(this.map.spawn);
    this.player.respawn(point.position, point.yaw, point.pitch);
    this.returnPoint.placed();
    this.jump?.interrupt();
  }

  frame(alpha, dt) {
    if (!this.player) return;
    const look = this.s.input.consumeLook();
    if (!this.paused) this.player.applyLook(look);
    const a = this.paused ? 1 : alpha;
    this.player.updateCamera(this.camera, a);
    this.physicsDebug?.update(this.player, a);
    this.showPos?.update(this.player, { strafe: this.strafe, jump: this.jump });
    if (this.player instanceof PlayerPawn) {
      const v = this.player.vitals;
      this.hud.setWalking(v.alive && !this.s.cheats.noclip && this.s.input.isDown('walk'));
      this.hud.setDeath(v.alive ? null : v.cause, Math.max(0, VITALS.respawnDelay - v.deadTime));
    }
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
    s.input.resetToggles();
    s.input.lookScale = 1;
    this._popCursorNav?.();
    this._popCursorNav = null;
    this.cursorMode = false;
    this.subs?.dispose();
    this.pause?.dispose();
    this.hud?.dispose();
    this.physicsDebug?.dispose();
    this.showPos?.dispose();
    s.render.clearView();
    s.render.post?.configure({ context: 'jogo', exposure: 1 });
    if (this.map) {
      const id = this.map.id;
      this.map.dispose?.();
      this.map.collision?.dispose();
      disposeObject3D(this.map.scene);
      // Materiais do set em cache eram deste mapa (a GPU já foi liberada acima): o próximo mapa cria os seus.
      s.set?.releaseMaterials();
      s.events.emit(EV.MAP_UNLOADED, { id });
    }
    this.map = null;
    this.player = null;
    this.physicsDebug = null;
    this.showPos = null;
    this.strafe = null;
    this.jump = null;
    this.camera = null;
    this.pause = null;
    this.hud = null;
    this.paused = false;
    this.returnPoint.clear();
  }

  /**
   * Teleporte do console (setpos, estacao): vira o ponto de volta depois de morrer neste mapa (morrer da prancha de
   * 1310 devolve à prancha); um ponto em que o mundo mata o jogador antes de ele pisar no chão (o vazio, o alto) sai
   * (ReturnPoint).
   */
  teleport(position, yaw = this.player?.yaw ?? 0, pitch = this.player?.pitch ?? 0) {
    this.returnPoint.set(position, yaw, pitch);
    this.#place(position, yaw, pitch);
  }

  /** Leva o jogador ao ponto: o voo em andamento não conta no medidor de salto. */
  #place(position, yaw, pitch) {
    this.player?.teleport(position, yaw, pitch);
    this.jump?.interrupt();
  }
}
