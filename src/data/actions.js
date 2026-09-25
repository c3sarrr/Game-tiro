// Ações de jogo (o que o jogador quer fazer), independentes do dispositivo.
// Cada ação é ligada a teclas/botões em src/data/bindings.js e pode ser remapeada nas configurações.
// `analog`: ação que também tem intensidade 0..1 (gatilhos, eixos). `ui`: dispara mesmo fora da partida.
// `toggle`: a ação pode alternar (cada aperto liga/desliga) em vez de valer só segurando; o modo de cada dispositivo
// vem da chave de config indicada (um dos TOGGLE_MODES; o trinco fica em src/input/actionToggles.js).

/** Modos das ações que podem alternar: segurar (vale com o botão apertado) ou alternar (cada aperto troca). */
export const TOGGLE_MODE = Object.freeze({ HOLD: 'segurar', TOGGLE: 'alternar' });
export const TOGGLE_MODES = Object.freeze([TOGGLE_MODE.HOLD, TOGGLE_MODE.TOGGLE]);

export const ACTION_GROUPS = Object.freeze([
  { id: 'movimento', label: 'Movimento' },
  { id: 'combate', label: 'Combate' },
  { id: 'armas', label: 'Armas' },
  { id: 'interface', label: 'Interface' },
  { id: 'dev', label: 'Desenvolvedor' },
]);

export const ACTIONS = Object.freeze([
  { id: 'moveForward', group: 'movimento', label: 'Frente', analog: true },
  { id: 'moveBack', group: 'movimento', label: 'Trás', analog: true },
  { id: 'moveLeft', group: 'movimento', label: 'Esquerda', analog: true },
  { id: 'moveRight', group: 'movimento', label: 'Direita', analog: true },
  { id: 'jump', group: 'movimento', label: 'Pular / wall-jump' },
  { id: 'crouch', group: 'movimento', label: 'Agachar / slide (correndo)' },
  {
    id: 'walk', group: 'movimento', label: 'Andar silencioso',
    toggle: { kbm: 'controls.walkMode', gamepad: 'controls.pad.walkMode', touch: 'controls.touch.walkMode' },
  },

  { id: 'fire', group: 'combate', label: 'Atirar / golpe leve', analog: true },
  { id: 'aim', group: 'combate', label: 'Mirar / luneta / bloquear (faca)', analog: true },
  { id: 'reload', group: 'combate', label: 'Recarregar' },
  { id: 'use', group: 'combate', label: 'Usar / plantar / desarmar' },
  { id: 'inspect', group: 'combate', label: 'Inspecionar arma' },

  { id: 'slot1', group: 'armas', label: 'Arma primária' },
  { id: 'slot2', group: 'armas', label: 'Pistola' },
  { id: 'slot3', group: 'armas', label: 'Faca' },
  { id: 'slot4', group: 'armas', label: 'Granadas' },
  { id: 'slot5', group: 'armas', label: 'Bomba' },
  { id: 'nextWeapon', group: 'armas', label: 'Próxima arma' },
  { id: 'prevWeapon', group: 'armas', label: 'Arma anterior' },
  { id: 'lastWeapon', group: 'armas', label: 'Última arma usada' },
  { id: 'drop', group: 'armas', label: 'Largar arma' },

  { id: 'buyMenu', group: 'interface', label: 'Loja', ui: true },
  { id: 'scoreboard', group: 'interface', label: 'Placar' },
  { id: 'chatAll', group: 'interface', label: 'Chat geral', ui: true },
  { id: 'chatTeam', group: 'interface', label: 'Chat do time', ui: true },
  { id: 'voice', group: 'interface', label: 'Falar (voz por proximidade)' },
  { id: 'pause', group: 'interface', label: 'Menu / pausar', ui: true },

  { id: 'console', group: 'dev', label: 'Console de comandos', ui: true },
  { id: 'debugOverlay', group: 'dev', label: 'Overlay de desempenho', ui: true },
]);

export const ACTION_IDS = Object.freeze(ACTIONS.map((a) => a.id));
export const ACTION_BY_ID = Object.freeze(Object.fromEntries(ACTIONS.map((a) => [a.id, a])));
