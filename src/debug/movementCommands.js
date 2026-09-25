// Comandos do console da Fase 3: variáveis sv_* de movimento (valores do CS:GO), colisão visível, posição/velocidade
// do jogador, medidas de counter-strafe e câmera em terceira pessoa. Falam com as mesmas variáveis, chaves de config e
// o mesmo medidor que o jogo usa.

import { SV_VARS } from '../data/movement.js';
import { resetSvVars, setSvVar } from '../player/movementVars.js';
import { onOff } from './consoleArgs.js';

export function registerMovementCommands(con, s) {
  const reg = (def) => con.register(def);
  for (const v of SV_VARS) {
    reg({
      name: `sv_${v.key}`,
      usage: `[${v.min}-${v.max}]`,
      help: v.help,
      run: ([value]) => `sv_${v.key} ${value === undefined ? s.sv[v.key] : setSvVar(s.sv, v.key, value)}`,
    });
  }
  reg({
    name: 'sv_reset',
    help: 'volta as variáveis de movimento aos valores do CS:GO',
    run: () => {
      resetSvVars(s.sv);
      return 'variáveis de movimento restauradas (CS:GO)';
    },
  });
  const toggle = (name, key, help) => reg({
    name,
    usage: '[0|1]',
    help,
    run: ([v]) => `${name} ${s.config.set(key, onOff(v, s.config.get(key))) ? 1 : 0}`,
  });
  toggle('r_colisao', 'debug.collision', 'arame das formas de colisão, a cápsula e a normal do chão');
  toggle('cl_showpos', 'debug.showPos', 'jogador, item na mão, teto, precisão, passos e counter-strafe (com gráfico)');
  reg({
    name: 'cl_strafe_reset',
    help: 'zera as medidas de counter-strafe do cl_showpos',
    run: () => {
      const meter = s.states.name === 'match' ? s.states.current?.strafe : null;
      if (!meter) throw new Error('só numa partida andando (mapa com colisão)');
      meter.reset();
      return 'medidas de counter-strafe zeradas';
    },
  });
  reg({
    name: 'thirdperson',
    help: 'câmera atrás do jogador (debug)',
    run: () => {
      s.config.set('debug.thirdPerson', true);
      return 'terceira pessoa';
    },
  });
  reg({
    name: 'firstperson',
    help: 'volta à câmera em primeira pessoa',
    run: () => {
      s.config.set('debug.thirdPerson', false);
      return 'primeira pessoa';
    },
  });
}
