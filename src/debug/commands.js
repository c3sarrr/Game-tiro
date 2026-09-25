// Comandos do console de desenvolvimento. Cada comando fala com o sistema real que controla
// (cheats, inventário, lista de participantes, mapas, config, binds, render), nunca com dados falsos.

import * as THREE from 'three';
import { EV } from '../core/events.js';
import { WEAPONS, resolveWeaponId } from '../data/weapons.js';
import { UTILITIES, resolveUtilityId } from '../data/economy.js';
import { ACTION_IDS } from '../data/actions.js';
import { PRESET_IDS } from '../data/qualityPresets.js';
import { BOT_LEVEL_MIN, BOT_LEVEL_MAX, getBotLevel } from '../data/botLevels.js';
import { listMaps, getMapDef } from '../maps/index.js';
import { parseBinding } from '../input/bindings.js';
import { registerPostCommands } from './postCommands.js';
import { registerShowcaseCommands } from './showcaseCommands.js';

const DEG = Math.PI / 180;

const FRIENDLY_KEYS = Object.freeze({
  space: 'key:Space', espaco: 'key:Space', ctrl: 'key:ControlLeft', rctrl: 'key:ControlRight', shift: 'key:ShiftLeft',
  rshift: 'key:ShiftRight', alt: 'key:AltLeft', tab: 'key:Tab', esc: 'key:Escape', escape: 'key:Escape',
  enter: 'key:Enter', backspace: 'key:Backspace', capslock: 'key:CapsLock', up: 'key:ArrowUp', down: 'key:ArrowDown',
  left: 'key:ArrowLeft', right: 'key:ArrowRight', mwheelup: 'wheel:up', mwheeldown: 'wheel:down',
  mouse1: 'mouse:0', mouse2: 'mouse:2', mouse3: 'mouse:1', mouse4: 'mouse:3', mouse5: 'mouse:4',
});

/** Aceita binding bruto ('key:KeyW', 'pad:button:0') ou nomes amigáveis ('w', '4', 'space', 'mouse1', 'f5'). */
export function parseKeyName(name) {
  const raw = String(name);
  if (parseBinding(raw)) return raw;
  const k = raw.toLowerCase();
  if (FRIENDLY_KEYS[k]) return FRIENDLY_KEYS[k];
  if (/^[a-z]$/.test(k)) return `key:Key${k.toUpperCase()}`;
  if (/^[0-9]$/.test(k)) return `key:Digit${k}`;
  if (/^f([1-9]|1[0-2])$/.test(k)) return `key:F${k.slice(1)}`;
  return null;
}

const onOff = (arg, current) => {
  if (arg === undefined) return !current;
  if (['1', 'on', 'sim', 'true', 'ligado'].includes(String(arg).toLowerCase())) return true;
  if (['0', 'off', 'nao', 'não', 'false', 'desligado'].includes(String(arg).toLowerCase())) return false;
  throw new Error(`esperava 0/1, recebi "${arg}"`);
};

export function registerCommands(con, s) {
  const reg = (def) => con.register(def);
  const matchState = () => (s.states.name === 'match' ? s.states.current : null);
  // Troca de estado pedida pelo console: valida antes (boot/transição em andamento) e mostra a falha no
  // próprio console em vez de virar uma rejeição de promessa solta.
  const goState = (to, params) => {
    if (s.states.busy) throw new Error('aguarde: uma troca de tela já está em andamento');
    if (!s.states.canGo(to)) throw new Error(`não dá para ir de "${s.states.name}" para "${to}" agora`);
    con.close();
    s.states.go(to, params).catch((err) => {
      s.log?.warn(`console: falha ao ir para "${to}":`, err?.message ?? err);
      s.toasts?.show(`Falha ao carregar: ${err?.message ?? err}`, { kind: 'warn' });
    });
  };

  reg({
    name: 'help', usage: '[comando]', help: 'lista os comandos ou explica um',
    complete: () => [...con.commands.keys()],
    run: ([name]) => {
      if (name) {
        const c = con.commands.get(name.toLowerCase());
        if (!c) throw new Error(`não existe: ${name}`);
        return `${c.alias ?? c.name} ${c.usage}\n  ${c.help}`;
      }
      const names = [...new Set([...con.commands.values()].map((c) => c.alias ?? c.name))].sort();
      return names.map((n) => {
        const c = con.commands.get(n);
        return `${n.padEnd(14)} ${c.help}`;
      }).join('\n');
    },
  });
  reg({ name: 'clear', aliases: ['cls'], help: 'limpa o console', run: () => { con.log.replaceChildren(); } });
  reg({ name: 'echo', usage: '<texto>', help: 'repete o texto', run: (args) => args.join(' ') });

  reg({
    name: 'god', usage: '[0|1]', help: 'imortalidade do jogador local',
    run: ([v]) => `god ${s.cheats.set('god', onOff(v, s.cheats.god)) ? 'LIGADO' : 'desligado'}`,
  });
  reg({
    name: 'noclip', usage: '[0|1]', help: 'voar atravessando paredes',
    run: ([v]) => `noclip ${s.cheats.set('noclip', onOff(v, s.cheats.noclip)) ? 'LIGADO' : 'desligado'}`,
  });

  reg({
    name: 'give', usage: '<arma|item>', help: 'dá uma arma (ak47, awp, deagle...) ou item (he, flash, kevlarHelmet...)',
    complete: () => [...Object.keys(WEAPONS), ...Object.keys(UTILITIES)],
    run: ([name]) => {
      if (!name) throw new Error('qual arma? ex.: give ak47');
      const loadout = s.localLoadout;
      const wid = resolveWeaponId(name);
      const uid = wid ? null : resolveUtilityId(name);
      let res;
      let label;
      if (wid) {
        res = loadout.give(wid, { ignoreTeam: true });
        label = WEAPONS[wid].name;
      } else if (uid) {
        res = loadout.giveUtility(uid);
        label = UTILITIES[uid].name;
      } else {
        throw new Error(`não conheço "${name}"`);
      }
      if (!res.ok) throw new Error(res.reason);
      s.events.emit(EV.LOADOUT, { owner: 'local', loadout: loadout.toJSON() });
      return `recebeu ${label}${res.dropped ? ` (largou ${WEAPONS[res.dropped].name})` : ''}\n${loadout.describe()}`;
    },
  });
  reg({ name: 'loadout', help: 'mostra o inventário do jogador local', run: () => s.localLoadout.describe() });

  reg({
    name: 'bot_add', usage: '[quantidade=1] [nível 1-10]', help: 'adiciona bots à partida (máx. 10 participantes)',
    run: ([count = '1', level]) => {
      const n = Number(count);
      if (!Number.isFinite(n) || n < 1) throw new Error('quantidade inválida');
      const added = s.roster.addBots(n, { level: level === undefined ? null : Number(level) });
      if (!added.length) return `sala cheia (${s.roster.size}/${s.roster.max})`;
      const lv = (b) => getBotLevel(s.roster.levelOf(b));
      return `${added.length} bot(s): ${added.map((b) => `${b.name} [${lv(b).name}, ${b.profile}]`).join(', ')}` +
        ` · participantes ${s.roster.size}/${s.roster.max}`;
    },
  });
  reg({
    name: 'bot_kick', usage: '[nome|all]', help: 'remove bots',
    complete: () => ['all', ...s.roster.bots.map((b) => b.name)],
    run: ([which = 'all']) => `${s.roster.removeBots(which)} bot(s) removido(s)`,
  });
  reg({
    name: 'bot_level', usage: `<${BOT_LEVEL_MIN}-${BOT_LEVEL_MAX}> [nome]`, help: 'nível de IA global ou de um bot',
    run: ([level, who]) => {
      if (level === undefined) return `nível global: ${s.roster.globalBotLevel} (${getBotLevel(s.roster.globalBotLevel).name})`;
      const { level: lv, affected } = s.roster.setBotLevel(level, who ?? null);
      if (who && affected === 0) throw new Error(`nenhum bot chamado "${who}" (veja: bots)`);
      return `${who ? who : `global (${affected} bot(s) seguem o global)`} → nível ${lv} (${getBotLevel(lv).name})`;
    },
  });
  reg({
    name: 'bots', help: 'lista os participantes',
    run: () => s.roster.participants.map((p) => `#${p.id} ${p.name} · ${p.kind}${p.kind === 'bot' ? ` · nível ${s.roster.levelOf(p)} · ${p.profile}` : ''}`).join('\n') || 'sala vazia',
  });

  reg({
    name: 'map', usage: '[id]', help: 'lista mapas ou carrega um',
    complete: () => listMaps().flatMap((m) => [m.id, ...m.aliases]),
    run: ([id]) => {
      if (!id) return listMaps().map((m) => `${m.id.padEnd(12)} ${m.label} — ${m.description}`).join('\n');
      const def = getMapDef(id);
      if (!def) throw new Error(`mapa desconhecido: ${id}. Disponíveis: ${listMaps().map((m) => m.id).join(', ')}`);
      goState('match', { map: def.id, mode: 'livre' });
      return `carregando ${def.label}…`;
    },
  });
  reg({
    name: 'quit', aliases: ['disconnect'], help: 'volta ao menu principal',
    run: () => {
      if (s.states.name === 'menu') return 'já está no menu';
      goState('menu');
      return 'voltando ao menu…';
    },
  });
  reg({ name: 'state', help: 'estado atual do jogo', run: () => `estado: ${s.states.name}` });

  reg({
    name: 'setpos', usage: '<x> <y> <z> [yaw°] [pitch°]', help: 'teleporta o jogador local',
    run: ([x, y, z, yaw, pitch]) => {
      const m = matchState();
      if (!m) throw new Error('só funciona dentro de uma partida');
      const v = [x, y, z].map(Number);
      if (v.some((n) => !Number.isFinite(n))) throw new Error('coordenadas inválidas');
      m.teleport(new THREE.Vector3(...v), yaw !== undefined ? Number(yaw) * DEG : undefined, pitch !== undefined ? Number(pitch) * DEG : undefined);
      return `posição ${v.join(' ')}`;
    },
  });
  reg({
    name: 'getpos', help: 'posição e ângulos do jogador local',
    run: () => {
      const m = matchState();
      if (!m?.player) throw new Error('só funciona dentro de uma partida');
      const p = m.player.pos;
      return `setpos ${p.x.toFixed(1)} ${p.y.toFixed(1)} ${p.z.toFixed(1)} ${(m.player.yaw / DEG).toFixed(1)} ${(m.player.pitch / DEG).toFixed(1)}`;
    },
  });

  reg({
    name: 'timescale', usage: '[fator 0.05-4]', help: 'câmera lenta / acelerada da simulação',
    run: ([v]) => {
      if (v === undefined) return `timescale ${s.loop.timeScale}`;
      const f = Number(v);
      if (!(f >= 0.05 && f <= 4)) throw new Error('entre 0.05 e 4');
      s.loop.timeScale = f;
      return `timescale ${f}`;
    },
  });

  const cfgSet = (key, value) => {
    const spec = s.config.spec(key);
    const parsed = spec.type === 'enum' && typeof spec.options[0] === 'number' ? Number(value) : value;
    const out = s.config.set(key, parsed);
    if (out === undefined) throw new Error(`valor inválido para ${key}${spec.options ? ` (${spec.options.join(', ')})` : ''}`);
    return out;
  };
  reg({ name: 'fps_max', usage: '[0|30|60|90|120|144|240]', help: 'limite de FPS (0 = vsync)', run: ([v]) => (v === undefined ? `fps_max ${s.config.get('graphics.fpsCap')}` : `fps_max ${cfgSet('graphics.fpsCap', v)}`) });
  reg({
    name: 'r_preset', usage: `[${PRESET_IDS.join('|')}]`, help: 'aplica um preset gráfico', complete: () => [...PRESET_IDS],
    run: ([v]) => {
      if (!v) return `preset ${s.config.get('graphics.preset')}`;
      s.quality.applyPreset(v);
      return `preset ${v} aplicado`;
    },
  });
  reg({ name: 'r_scale', usage: '[0.5-1]', help: 'escala de resolução', run: ([v]) => (v === undefined ? `r_scale ${s.config.get('graphics.resolutionScale')}` : `r_scale ${cfgSet('graphics.resolutionScale', v)}`) });
  reg({
    name: 'overlay', aliases: ['cl_showfps'], usage: '[off|compacto|completo]', help: 'overlay de desempenho',
    complete: () => ['off', 'compacto', 'completo'],
    run: ([v]) => {
      if (v === undefined) {
        s.overlay.toggle();
        return `overlay ${s.config.get('debug.overlay')}`;
      }
      return `overlay ${cfgSet('debug.overlay', v)}`;
    },
  });
  reg({ name: 'sens', usage: '[valor]', help: 'sensibilidade do mouse (escala CS)', run: ([v]) => (v === undefined ? `sens ${s.config.get('controls.mouseSensitivity')}` : `sens ${cfgSet('controls.mouseSensitivity', v)}`) });

  reg({
    name: 'cvars', usage: '[prefixo]', help: 'lista as configurações', complete: () => ['graphics.', 'controls.', 'debug.'],
    run: ([prefix = '']) => s.config.keys(prefix).map((k) => `${k} = ${JSON.stringify(s.config.get(k)).slice(0, 80)}`).join('\n'),
  });
  reg({
    name: 'get', usage: '<chave>', help: 'lê uma configuração', complete: () => s.config.keys(),
    run: ([key]) => {
      if (!s.config.has(key)) throw new Error(`não existe: ${key}`);
      return `${key} = ${JSON.stringify(s.config.get(key))}`;
    },
  });
  reg({
    name: 'set', usage: '<chave> <valor>', help: 'altera uma configuração', complete: (i) => (i === 0 ? s.config.keys() : []),
    run: ([key, value]) => {
      if (!s.config.has(key)) throw new Error(`não existe: ${key}`);
      if (value === undefined) throw new Error('falta o valor');
      return `${key} = ${JSON.stringify(cfgSet(key, value))}`;
    },
  });
  reg({
    name: 'reset', usage: '<chave>', help: 'volta uma configuração ao padrão', complete: () => s.config.keys(),
    run: ([key]) => {
      if (!s.config.has(key)) throw new Error(`não existe: ${key}`);
      s.config.reset(key);
      return `${key} = ${JSON.stringify(s.config.get(key))}`;
    },
  });
  reg({
    name: 'config_reset', usage: 'sim', help: 'restaura TODAS as configurações (confirme com "sim")',
    run: ([confirm]) => {
      if (confirm !== 'sim') return 'digite: config_reset sim';
      s.config.resetPrefix('');
      s.config.set('graphics.autoDetected', true);
      s.quality.applyPreset(s.quality.hardware?.recommended ?? 'alto');
      return 'configurações restauradas';
    },
  });

  reg({
    name: 'bind', usage: '<ação> <tecla>', help: 'liga tecla/botão a uma ação (ex.: bind jump mwheeldown)',
    complete: (i) => (i === 0 ? [...ACTION_IDS] : Object.keys(FRIENDLY_KEYS)),
    run: ([action, key]) => {
      if (!ACTION_IDS.includes(action)) throw new Error(`ação desconhecida: ${action}`);
      const binding = parseKeyName(key);
      if (!binding) throw new Error(`tecla não reconhecida: ${key}`);
      const displaced = s.rebinder.bind(action, binding);
      return `${action} ← ${s.input.labelFor(binding)}${displaced.length ? ` (removida de: ${displaced.join(', ')})` : ''}`;
    },
  });
  reg({
    name: 'unbind', usage: '<ação> [kbm|pad]', help: 'remove os binds de uma ação', complete: (i) => (i === 0 ? [...ACTION_IDS] : ['kbm', 'pad']),
    run: ([action, device = 'kbm']) => {
      if (!ACTION_IDS.includes(action)) throw new Error(`ação desconhecida: ${action}`);
      s.rebinder.clear(action, device);
      return `${action}: binds de ${device} removidos`;
    },
  });
  reg({
    name: 'binds', usage: '[ação]', help: 'mostra os binds', complete: () => [...ACTION_IDS],
    run: ([action]) => {
      const list = action ? [action] : ACTION_IDS;
      return list.map((a) => {
        const b = s.input.bindings[a];
        if (!b) throw new Error(`ação desconhecida: ${a}`);
        return `${a.padEnd(12)} teclado: ${b.kbm.map((x) => s.input.labelFor(x)).join(', ') || '—'} · controle: ${b.pad.map((x) => s.input.labelFor(x)).join(', ') || '—'}`;
      }).join('\n');
    },
  });

  reg({
    name: 'touch_buttons', help: 'lista os botões de toque e as ações ligadas',
    run: () => s.config.get('controls.touch.layout').buttons
      .map((b) => `${b.id.padEnd(11)} → ${b.action.padEnd(11)} (x ${b.x.toFixed(2)}, y ${b.y.toFixed(2)}, raio ${b.r.toFixed(3)})`).join('\n'),
  });
  reg({
    name: 'touch_bind', usage: '<botão> <ação>', help: 'troca a ação de um botão de toque (o editor visual chega na Fase 10)',
    complete: (i) => (i === 0 ? s.config.get('controls.touch.layout').buttons.map((b) => b.id) : [...ACTION_IDS]),
    run: ([id, action]) => {
      const layout = structuredClone(s.config.get('controls.touch.layout'));
      const btn = layout.buttons.find((b) => b.id === id);
      if (!btn) throw new Error(`botão desconhecido: ${id} (veja: touch_buttons)`);
      if (!ACTION_IDS.includes(action)) throw new Error(`ação desconhecida: ${action}`);
      btn.action = action;
      s.config.set('controls.touch.layout', layout);
      return `botão ${id} → ${action}`;
    },
  });

  reg({
    name: 'input', help: 'dispositivos de entrada detectados',
    run: () => [
      `dispositivo ativo: ${s.input.device} · contexto ${s.input.context} · mouse capturado: ${s.input.pointerLocked ? 'sim' : 'não'}${s.input.kbm.rawActive ? ' (entrada bruta)' : ''}`,
      `controle: ${s.input.pad.connected ? `${s.input.pad.id} · tipo ${s.input.pad.type} · mapeamento ${s.input.pad.mapping || 'não-standard'}` : 'nenhum'}`,
      `toque: ${s.input.touch.available ? 'detectado' : 'não detectado'} · giroscópio ${s.input.touch.gyro.enabled ? 'ligado' : 'desligado'}`,
    ].join('\n'),
  });
  reg({ name: 'rumble', help: 'testa a vibração do controle', run: () => (s.input.rumble(0.9, 0.5, 400) ? 'vibrando' : 'sem vibração disponível') });

  reg({
    name: 'mem', help: 'memória de GPU e JS',
    run: () => {
      const r = s.render.stats();
      const m = performance.memory;
      return `geometrias ${r.geometries} · texturas ${r.textures} · programas ${r.programs}` +
        (m ? ` · heap JS ${(m.usedJSHeapSize / 1048576).toFixed(1)} MB` : ' · heap JS n/d');
    },
  });
  reg({
    name: 'hardware', help: 'GPU detectada, benchmark e preset recomendado',
    run: () => {
      const hw = s.quality.hardware;
      if (!hw) return 'detecção ainda não rodou';
      const b = s.quality.benchmark;
      return `${hw.name}\n${hw.renderer} (${hw.vendor})\nclasse ${hw.cls} · tier ${hw.tier} · ${hw.mobile ? 'celular/tablet' : 'desktop'} · núcleos ${hw.cores}` +
        ` · memória ${hw.memoryGB ?? '?'} GB · DPR ${hw.dpr}\nMSAA máx. ${hw.maxSamples} · timer de GPU ${hw.timerQuery ? 'sim' : 'não'}` +
        `\nbenchmark ${b ? `${b.ms.toFixed(2)} ms/quadro (${b.mode === 'gpu' ? 'GPU' : 'relógio'}) → ${b.preset}` : 'n/d'} · recomendado ${hw.recommended}`;
    },
  });

  // Look de estúdio (Fase 2): pós-processamento, foco, vistas de diagnóstico e GPU por etapa.
  registerPostCommands(con, s);
  // Vitrine e aceite da Fase 2: varredura de presets, luzes da montagem, massinha, diagnóstico "massa preta".
  registerShowcaseCommands(con, s, { goState, matchState });
}
