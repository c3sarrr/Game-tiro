// Comandos do console da Fase 3: variáveis sv_* de movimento (valores do CS:GO), colisão visível, posição/velocidade
// do jogador, medidas de counter-strafe e de salto e queda, e câmera em terceira pessoa. Falam com as mesmas variáveis,
// chaves de config e os mesmos medidores que o jogo usa.

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
  toggle('cl_showpos', 'debug.showPos', 'jogador, item na mão, teto, precisão, passos, counter-strafe (com gráfico) e salto');
  /** Medidor da partida andando (strafe ou jump do matchState). */
  const meterOf = (key) => {
    const meter = s.states.name === 'match' ? s.states.current?.[key] : null;
    if (!meter) throw new Error('só numa partida andando (mapa com colisão)');
    return meter;
  };
  reg({
    name: 'cl_strafe_reset',
    help: 'zera as medidas de counter-strafe do cl_showpos',
    run: () => {
      meterOf('strafe').reset();
      return 'medidas de counter-strafe zeradas';
    },
  });
  reg({
    name: 'cl_salto_reset',
    help: 'zera o medidor de salto e queda do cl_showpos (último voo, série de bhop e recordes)',
    run: () => {
      meterOf('jump').reset();
      return 'medidor de salto e queda zerado';
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
