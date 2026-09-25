// Comandos do console da vitrine e do aceite da Fase 2: abrir a vitrine, rodar/cancelar a varredura de
// presets, mexer nas luzes da montagem do mapa aberto, nos multiplicadores de massinha e ligar o diagnóstico
// "massa preta". Falam com os mesmos objetos que o painel de fita crepe usa.

import { RIG_LIMITS } from '../data/studioRigs.js';
import { CLAY_BLACK_PROBE, SHOWCASE_PANEL } from '../data/showcase.js';
import { formatSweepTable } from './presetSweep.js';

const clampTo = (v, [min, max]) => Math.min(max, Math.max(min, v));

export function registerShowcaseCommands(con, s, { goState, matchState }) {
  const reg = (def) => con.register(def);
  const map = () => matchState()?.map ?? null;
  const vitrine = () => {
    const m = map();
    if (m?.id !== 'vitrine') throw new Error('abra a vitrine primeiro (comando "vitrine")');
    return m;
  };

  reg({
    name: 'vitrine', aliases: ['showcase'], help: 'abre a vitrine de massinha (20 objetos, painel de luz com Tab, varredura)',
    run: () => {
      goState('match', { map: 'vitrine', mode: 'livre' });
      return 'montando a vitrine…';
    },
  });

  reg({
    name: 'varredura', aliases: ['sweep'], usage: '[cancelar]', help: 'mede Leve/Médio/Alto/Ultra com a câmera parada (vitrine) e mostra a tabela',
    complete: () => ['cancelar'],
    run: async ([arg]) => {
      const m = vitrine();
      if (arg === 'cancelar') {
        if (!m.sweep.running) return 'nenhuma varredura rodando';
        m.sweep.cancel();
        return 'varredura cancelada (os ajustes voltam ao que estavam)';
      }
      con.print('varredura iniciada: aquecimento + medição por preset, com a câmera parada…');
      const rows = await m.sweep.run();
      m.panel?.refresh();
      return rows.length ? formatSweepTable(rows) : 'varredura cancelada';
    },
  });

  reg({
    name: 'luz', aliases: ['light'], usage: '[id] [lux] [kelvin]', help: 'lista ou ajusta as luzes da montagem do mapa (iluminância em lx, cor em K)',
    complete: () => map()?.rig?.lights.map((e) => e.def.id) ?? [],
    run: ([id, lux, kelvin]) => {
      const rig = map()?.rig;
      if (!rig) throw new Error('o mapa aberto não tem montagem de luz');
      if (!id) {
        return rig.lights.map((e) => `${e.def.id.padEnd(10)} ${e.def.label.padEnd(20)} ${e.illuminance.toFixed(2)} lx · ${Math.round(e.kelvin)} K`)
          .concat(`rebote ${rig.hemi.intensity.toFixed(2)} · ambiente ${rig.envIntensity.toFixed(2)}`).join('\n');
      }
      const e = rig.entry(id);
      if (!e) throw new Error(`luz desconhecida: ${id} (use ${rig.lights.map((x) => x.def.id).join(', ')})`);
      if (lux !== undefined) {
        const v = Number(lux);
        if (!Number.isFinite(v)) throw new Error('iluminância precisa ser um número');
        rig.setIlluminance(id, clampTo(v, RIG_LIMITS.illuminance));
      }
      if (kelvin !== undefined) {
        const k = Number(kelvin);
        if (!Number.isFinite(k)) throw new Error('temperatura precisa ser um número (K)');
        rig.setKelvin(id, clampTo(k, RIG_LIMITS.kelvin));
        rig.commit();
      }
      map().panel?.refresh();
      return `${e.def.label}: ${e.illuminance.toFixed(2)} lx · ${Math.round(e.kelvin)} K`;
    },
  });

  reg({
    name: 'massinha', usage: '[umidade|boil|digitais] [×]', help: 'multiplicadores da massinha da vitrine (1 = como foi modelada)',
    complete: () => ['umidade', 'boil', 'digitais'],
    run: ([what, value]) => {
      const bench = vitrine().bench;
      const m = bench.multipliers;
      if (!what) return `umidade ×${m.wetness.toFixed(2)} · boil ×${m.boil.toFixed(2)} · digitais ×${m.fingerprints.toFixed(2)}`;
      const key = { umidade: 'wetness', boil: 'boil', digitais: 'fingerprints' }[what];
      if (!key) throw new Error('use umidade, boil ou digitais');
      const v = Number(value);
      if (!Number.isFinite(v)) throw new Error('valor precisa ser um número');
      const r = SHOWCASE_PANEL[key];
      bench.setClayMultipliers({ [key]: clampTo(v, [r.min, r.max]) });
      map().panel?.refresh();
      return `${what} ×${bench.multipliers[key].toFixed(2)}`;
    },
  });

  reg({
    name: 'r_massa_preta', usage: '[0|1]', help: 'diagnóstico do aceite: pinta de magenta a massinha que ficaria preta na tela',
    complete: () => ['0', '1'],
    run: ([v]) => {
      const on = v === undefined ? true : ['1', 'on', 'sim', 'true', 'ligado'].includes(String(v).toLowerCase());
      s.clay.setBlackProbe(on, { threshold: CLAY_BLACK_PROBE.threshold, color: CLAY_BLACK_PROBE.color });
      return `massa preta em destaque: ${on ? `ligado (limiar ${CLAY_BLACK_PROBE.threshold})` : 'desligado'}`;
    },
  });
}
