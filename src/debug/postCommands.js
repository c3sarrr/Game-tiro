// Comandos do console para o look de estúdio da Fase 2: pós-processamento (AO, DOF/tilt-shift, bloom, SMAA,
// lente), contexto de câmera, foco, vistas de diagnóstico e tempo de GPU por etapa. Falam com o PostEffects e a
// config reais (os mesmos ajustes do menu de configurações).

import { POST_CONTEXT_IDS, POST_VIEWS } from '../data/postFx.js';

export function registerPostCommands(con, s) {
  const reg = (def) => con.register(def);
  const post = () => {
    if (!s.render.post) throw new Error('pós-processamento indisponível (sem WebGL 2)');
    return s.render.post;
  };
  const cfgSet = (key, value) => {
    const spec = s.config.spec(key);
    let parsed = value;
    if (spec.type === 'bool') parsed = ['1', 'on', 'sim', 'true', 'ligado'].includes(String(value).toLowerCase());
    else if (spec.type === 'number') parsed = Number(value);
    const out = s.config.set(key, parsed);
    if (out === undefined) throw new Error(`valor inválido para ${key}${spec.options ? ` (${spec.options.join(', ')})` : ''}`);
    return out;
  };
  const cfgCommand = (name, key, help, complete) => reg({
    name,
    usage: complete ? `[${complete.join('|')}]` : '[valor]',
    help,
    complete: complete ? () => [...complete] : undefined,
    run: ([v]) => `${name} ${v === undefined ? s.config.get(key) : cfgSet(key, v)}`,
  });

  reg({ name: 'post', help: 'estado do pós-processamento (contexto, passes, foco, grão, exposição)', run: () => post().describe() });
  reg({
    name: 'post_view', usage: `<${POST_VIEWS.join('|')}>`, help: 'vista de diagnóstico: AO, mapa de CoC do DOF, só o bloom ou a imagem final',
    complete: () => [...POST_VIEWS],
    run: ([v]) => {
      if (!v) return `post_view ${post().view}`;
      post().setView(v);
      return `post_view ${v}`;
    },
  });
  reg({
    name: 'post_ctx', usage: `<${POST_CONTEXT_IDS.join('|')}>`, help: 'contexto de câmera do pós (DOF, aberração, grão, vinheta)',
    complete: () => [...POST_CONTEXT_IDS],
    run: ([v]) => {
      if (!v) return `post_ctx ${post().context}`;
      post().setContext(v);
      return `post_ctx ${v}`;
    },
  });
  reg({
    name: 'foco', aliases: ['focus'], usage: '[auto|distância em u]', help: 'foco da lente: automático na mira ou fixo (10 u = 1 cm)',
    complete: () => ['auto'],
    run: ([v]) => {
      if (v === undefined) {
        const d = post().dof.manualFocus;
        return `foco ${d > 0 ? `${d} u` : 'auto'}`;
      }
      if (v === 'auto') {
        post().setFocus(null);
        return 'foco automático na mira';
      }
      const d = Number(v);
      if (!(d > 0)) throw new Error('use "auto" ou uma distância positiva em u');
      post().setFocus(d);
      return `foco fixo em ${d} u (${(d / 10).toFixed(1)} cm na miniatura)`;
    },
  });
  cfgCommand('r_ao', 'graphics.ao', 'oclusão de ambiente (GTAO)', ['desligado', 'meia', 'cheia']);
  cfgCommand('r_dof', 'graphics.dof', 'profundidade de campo / tilt-shift', ['desligado', 'sutil', 'forte']);
  cfgCommand('r_bloom', 'graphics.bloom', 'bloom nas luzes', ['0', '1']);
  cfgCommand('r_smaa', 'graphics.smaa', 'antisserrilhado SMAA', ['0', '1']);
  cfgCommand('r_grain', 'graphics.grain', 'grão de filme (0–1)');
  cfgCommand('r_vignette', 'graphics.vignette', 'vinheta (0–1)');
  cfgCommand('r_flicker', 'graphics.flicker', 'flicker de exposição por pose', ['0', '1']);
  reg({
    name: 'gpu', help: 'tempo de GPU por etapa do quadro (média móvel)',
    run: () => {
      const st = s.render.stats();
      if (!st.gpuSupported) return 'timer de GPU indisponível neste navegador';
      if (!st.gpuSections.length) return 'sem medições ainda (abra uma cena 3D)';
      const lines = st.gpuSections.map((x) => `${x.name.padEnd(8)} ${x.avgMs.toFixed(2)} ms`);
      return `${lines.join('\n')}\ntotal    ${st.gpuMs?.toFixed(2) ?? 'n/d'} ms · ${st.width}×${st.height}`;
    },
  });
}
