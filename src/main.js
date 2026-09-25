// MASSACRE — raiz de composição: cria os serviços, registra os estados e liga o loop.
// Ordem: eventos/log → IndexedDB → config → renderer → entrada → estados → loop → boot.

import { EventBus, EV } from './core/events.js';
import { Logger } from './core/log.js';
import { Store } from './core/store.js';
import { Config } from './core/config.js';
import { FixedStepLoop } from './core/loop.js';
import { StopMotionClock, clock } from './core/time.js';
import { RNG } from './core/rng.js';
import { StateMachine, STATES } from './core/stateMachine.js';
import { BootState } from './core/bootState.js';
import { CONFIG_SCHEMA } from './data/configSchema.js';
import { RenderSystem } from './render/renderSystem.js';
import { QualityManager } from './render/quality.js';
import { ClaySystem } from './clay/claySystem.js';
import { SetLibrary } from './clay/set/index.js';
import { SdfMesher } from './clay/sdf/sdfMesher.js';
import { InputManager } from './input/inputManager.js';
import { Rebinder } from './input/rebind.js';
import { Cheats } from './debug/cheats.js';
import { DebugOverlay } from './debug/overlay.js';
import { DebugConsole } from './debug/console.js';
import { registerCommands } from './debug/commands.js';
import { TouchGuides } from './debug/touchGuides.js';
import { Roster } from './modes/roster.js';
import { Loadout } from './player/loadout.js';
import { createSvVars } from './player/movementVars.js';
import { MatchState } from './modes/matchState.js';
import { MenuState } from './ui/menuState.js';
import { LobbyState } from './ui/lobbyState.js';
import { ResultState } from './ui/resultState.js';
import { FocusNavigator } from './ui/focusNav.js';
import { Toasts } from './ui/toast.js';
import { paintFavicon } from './ui/favicon.js';
import { h } from './ui/dom.js';

const PAD_NAMES = { playstation: 'PlayStation', xbox: 'Xbox', switch: 'Switch', generico: 'genérico' };

function fatal(uiRoot, title, detail) {
  uiRoot.replaceChildren(h('section.screen.fatal', null,
    h('div.fatal-card', null, h('h2.card-title', null, title), h('p', null, detail))));
}

async function main() {
  const $ = (id) => document.getElementById(id);
  const canvas = $('view');
  const uiRoot = $('ui');
  const debugRoot = $('debug');
  const touchLayer = $('touch-layer');
  paintFavicon();

  let log = null;
  const events = new EventBus({
    onError: (err, type) => (log ? log.error(`ouvinte de "${type}" falhou:`, err) : console.error(err)),
  });
  log = new Logger({ events });
  const store = await Store.open({ log });
  const config = new Config(CONFIG_SCHEMA, { events, store, log });
  await config.load();

  const render = new RenderSystem({ canvas, config, events, log });
  try {
    render.init();
  } catch (err) {
    fatal(uiRoot, 'Sem WebGL 2', 'Este navegador ou placa de vídeo não oferece WebGL 2, necessário para o MASSACRE. ' +
      'Atualize o navegador ou ative a aceleração por hardware.');
    throw err;
  }
  // Massinha: uniforms globais (pose, atlas de digitais/ferramenta) antes de qualquer cena ser montada.
  const clay = new ClaySystem({ events, config, log });
  clay.init(render.renderer, render.anisotropy);
  // Materiais do set (papelão, fita, metal, balsa, plástico, tapete): texturas assadas uma vez.
  const set = new SetLibrary({ events, log });
  set.init(render.renderer, render.anisotropy);
  // Peças orgânicas de massinha por SDF + marching cubes em Workers, com cache em IndexedDB.
  const sdf = new SdfMesher({ store, log });
  config.watch('graphics.anisotropy', () => {
    clay.setAnisotropy(render.anisotropy);
    set.setAnisotropy(render.anisotropy);
  });
  const quality = new QualityManager({ config, events, store, log });
  const input = new InputManager({ events, config, log, canvas, touchLayer });
  input.init();
  const rebinder = new Rebinder({ input, config, events });
  const loop = new FixedStepLoop({ hz: 64 });
  const stopMotion = new StopMotionClock({ fps: 12 });
  const states = new StateMachine({ events, log });
  const rng = new RNG();
  const cheats = new Cheats(events);
  const roster = new Roster({ events, rng });
  const localLoadout = new Loadout();
  const sv = createSvVars(); // variáveis sv_* de movimento (valores do CS:GO; o console troca)
  const focusNav = new FocusNavigator({ input });
  const toasts = new Toasts(uiRoot);

  const services = {
    events, log, store, config, render, clay, set, sdf, quality, input, rebinder, loop, states, rng, cheats, roster,
    localLoadout, sv, focusNav, toasts, uiRoot, debugRoot, touchLayer,
  };
  services.overlay = new DebugOverlay(services);
  services.console = new DebugConsole(services);
  registerCommands(services.console, services);
  const touchGuides = new TouchGuides(services);

  states
    .register(STATES.BOOT, new BootState(services))
    .register(STATES.MENU, new MenuState(services))
    .register(STATES.LOBBY, new LobbyState(services))
    .register(STATES.MATCH, new MatchState(services))
    .register(STATES.RESULT, new ResultState(services));

  // Ações de interface globais (valem em qualquer tela).
  events.on(EV.INPUT_ACTION, ({ action, phase }) => {
    if (phase !== 'press') return;
    if (action === 'console') services.console.toggle();
    else if (action === 'debugOverlay') services.overlay.toggle();
  });
  events.on(EV.INPUT_GAMEPAD, ({ connected, type }) =>
    toasts.show(connected ? `Controle conectado: ${PAD_NAMES[type] ?? type}` : 'Controle desconectado'));
  events.on(EV.RENDER_CONTEXT, ({ lost }) =>
    toasts.show(lost ? 'A placa de vídeo reiniciou — recuperando…' : 'Gráficos recuperados', { kind: lost ? 'warn' : 'info' }));
  loop.fpsCap = config.get('graphics.fpsCap');
  config.watch('graphics.fpsCap', (e) => (loop.fpsCap = e.value));

  loop.onFrameStart = (dt) => input.frameStart(dt);
  loop.onTick = (dt, tick) => {
    clock.tick = tick;
    clock.simTime = loop.simTime;
    input.sampleTick();
    states.tick(dt, tick);
  };
  loop.onFrame = (alpha, dt, now) => {
    clock.realTime = now / 1000;
    clock.frame++;
    clock.frameDt = dt;
    clock.alpha = alpha;
    clock.poseChanged = stopMotion.update(dt);
    clock.pose = stopMotion.pose;
    clock.posePhase = stopMotion.phase;
    if (clock.poseChanged) events.emit(EV.POSE, { pose: clock.pose });
    clay.update(dt);
    focusNav.update(dt);
    states.frame(alpha, dt, now);
    render.render(dt * 1000, dt, now);
    services.overlay.frame(now);
    touchGuides.frame();
  };
  loop.start();
  window.addEventListener('pagehide', () => config.flush());

  // Acesso de depuração pelo console do navegador (ex.: massacre.states.name).
  globalThis.massacre = services;
  await states.go(STATES.BOOT);
}

main().catch((err) => {
  console.error('[MASSACRE] falha ao iniciar:', err);
});
