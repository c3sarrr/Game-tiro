// Testes da subfase 2.5 (pós-processamento de estúdio): cronômetro de GPU por etapa (com um WebGL simulado),
// sanidade dos dados de src/data/postFx.js e o registro de ouvintes de 'dispose' usado na recuperação de contexto.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { GpuTimer } from '../src/render/gpuTimer.js';
import { AO, BLOOM, DOF, LENS, FLICKER, POST_CONTEXTS, POST_CONTEXT_IDS, POST_VIEWS } from '../src/data/postFx.js';
import { QUALITY_PRESETS } from '../src/data/qualityPresets.js';
import { CONFIG_SCHEMA } from '../src/data/configSchema.js';
import { installDisposeTracker, purgeStaleDisposeListeners, compactDisposeTracker } from '../src/render/contextRestore.js';

/** WebGL2 mínimo com EXT_disjoint_timer_query_webgl2: cada consulta termina com a duração programada. */
function fakeGl({ supported = true } = {}) {
  let nextId = 1;
  const ext = { TIME_ELAPSED_EXT: 0x88bf, GPU_DISJOINT_EXT: 0x8fbb };
  const gl = {
    QUERY_RESULT_AVAILABLE: 0x8867,
    QUERY_RESULT: 0x8866,
    disjoint: false,
    active: null,
    queries: new Map(),
    durations: [], // ns a atribuir às próximas consultas encerradas, em ordem
    ready: true,
    log: [],
    getExtension: (name) => (supported && name === 'EXT_disjoint_timer_query_webgl2' ? ext : null),
    createQuery() {
      const q = { id: nextId++ };
      gl.queries.set(q, { ns: 0, done: false });
      return q;
    },
    deleteQuery(q) {
      gl.queries.delete(q);
    },
    beginQuery(target, q) {
      if (gl.active) throw new Error('INVALID_OPERATION: consulta aninhada');
      gl.active = q;
      gl.log.push(`begin#${q.id}`);
    },
    endQuery() {
      if (!gl.active) throw new Error('INVALID_OPERATION: nenhuma consulta ativa');
      const st = gl.queries.get(gl.active);
      st.ns = gl.durations.shift() ?? 1e6;
      st.done = true;
      gl.log.push(`end#${gl.active.id}`);
      gl.active = null;
    },
    getQueryParameter(q, pname) {
      const st = gl.queries.get(q);
      if (pname === gl.QUERY_RESULT_AVAILABLE) return gl.ready && st.done;
      return st.ns;
    },
    getParameter: (p) => (p === ext.GPU_DISJOINT_EXT ? gl.disjoint : null),
  };
  return gl;
}

test('GpuTimer: etapas sequenciais nunca se aninham e somam o tempo do quadro', () => {
  const gl = fakeGl();
  const t = new GpuTimer(gl);
  gl.durations.push(2e6, 0.5e6, 0.25e6);
  t.begin('cena');
  t.section('ao');
  t.section('ao'); // repetir a etapa ativa não abre outra consulta
  t.section('lente');
  t.end();
  assert.equal(gl.active, null);
  assert.deepEqual(gl.log.filter((l) => l.startsWith('begin')).length, 3);
  assert.ok(Math.abs(t.ms - 2.75) < 1e-9, `total ${t.ms}`);
  assert.deepEqual(t.sectionList().map((s) => s.name), ['cena', 'ao', 'lente']);
  assert.ok(Math.abs(t.sectionList()[1].ms - 0.5) < 1e-9);
});

test('GpuTimer: média móvel por etapa, etapas desligadas somem e a ordem segue o último quadro', () => {
  const gl = fakeGl();
  const t = new GpuTimer(gl);
  gl.durations.push(1e6, 1e6);
  t.begin('cena');
  t.section('bloom');
  t.end();
  gl.durations.push(3e6, 2e6, 1e6);
  t.begin('cena');
  t.section('ao');
  t.section('saida');
  t.end();
  const list = t.sectionList();
  assert.deepEqual(list.map((s) => s.name), ['cena', 'ao', 'saida'], 'bloom saiu, ordem do último quadro');
  // cena: 1 → 3 com EMA 0,1 = 1,2
  assert.ok(Math.abs(list[0].avgMs - 1.2) < 1e-9, `média ${list[0].avgMs}`);
  assert.ok(Math.abs(t.ms - 6) < 1e-9);
});

test('GpuTimer: espera resultados atrasados, descarta quadros disjuntos e limita a fila', () => {
  const gl = fakeGl();
  const t = new GpuTimer(gl);
  gl.ready = false;
  for (let i = 0; i < 10; i++) {
    t.begin('cena');
    t.end();
  }
  assert.equal(t.ms, null, 'nada pronto ainda');
  assert.ok(t.pending.length <= 6, `fila limitada (${t.pending.length})`);
  gl.ready = true;
  gl.disjoint = true;
  t.begin('cena');
  t.end();
  assert.equal(t.ms, null, 'quadro disjunto não vira medida');
  assert.equal(t.pending.length, 0);
  gl.disjoint = false;
  gl.durations.push(4e6);
  t.begin('cena');
  t.end();
  assert.ok(Math.abs(t.ms - 4) < 1e-9);
  // Consultas voltam para o pool em vez de vazar.
  const live = gl.queries.size;
  t.begin('cena');
  t.end();
  assert.equal(gl.queries.size, live, 'reaproveita consultas');
});

test('GpuTimer: sem a extensão fica inerte, e perder o contexto zera tudo sem chamar o GL', () => {
  const none = new GpuTimer(fakeGl({ supported: false }));
  none.begin('cena');
  none.section('ao');
  none.end();
  assert.equal(none.supported, false);
  assert.equal(none.ms, null);
  const gl = fakeGl();
  const t = new GpuTimer(gl);
  t.begin('cena');
  t.lose();
  assert.equal(t.frame, null);
  assert.equal(t.supported, false);
  t.restore();
  assert.equal(t.supported, true);
  gl.active = null; // o contexto novo não tem consulta pendurada
  gl.durations.push(1e6);
  t.begin('cena');
  t.end();
  assert.ok(Math.abs(t.ms - 1) < 1e-9);
});

test('dados de pós: contextos completos, perfis de DOF válidos e vistas de diagnóstico', () => {
  assert.deepEqual([...POST_CONTEXT_IDS].sort(), ['jogo', 'killcam', 'menu', 'vitrine']);
  for (const id of POST_CONTEXT_IDS) {
    const c = POST_CONTEXTS[id];
    assert.equal(typeof c.label, 'string');
    for (const level of ['sutil', 'forte']) {
      const p = c.dof[level];
      assert.ok(p.aperture > 0 && p.aperture <= 5, `${id}.${level} abertura`);
      assert.ok(p.maxBlur > 0 && p.maxBlur <= 32, `${id}.${level} desfoque`);
      assert.ok(p.nearScale > 0 && p.nearScale <= 1, `${id}.${level} perto`);
      assert.ok(p.tilt >= 0 && p.tilt <= 1, `${id}.${level} tilt`);
      if (p.tilt > 0) assert.ok(p.tiltWidth > 0 && p.tiltFeather > 0 && p.tiltCenter > 0 && p.tiltCenter < 1);
    }
    // "forte" é mais forte que "sutil" em todo contexto.
    assert.ok(c.dof.forte.maxBlur >= c.dof.sutil.maxBlur && c.dof.forte.aperture >= c.dof.sutil.aperture, id);
    for (const k of ['aberration', 'grain', 'vignette', 'bloom', 'focusTime']) assert.ok(c[k] >= 0, `${id}.${k}`);
  }
  // Seção 0.13: DOF mínimo no jogo, mais forte em menus e killcam; aberração só fora do jogo.
  const j = POST_CONTEXTS.jogo.dof.sutil;
  for (const id of ['menu', 'killcam']) {
    assert.ok(POST_CONTEXTS[id].dof.sutil.maxBlur > j.maxBlur * 2, `${id} mais forte que o jogo`);
    assert.ok(POST_CONTEXTS[id].aberration > 0);
  }
  assert.equal(POST_CONTEXTS.jogo.aberration, 0);
  assert.ok(POST_VIEWS.includes('final') && POST_VIEWS.includes('ao') && POST_VIEWS.includes('coc') && POST_VIEWS.includes('bloom'));
});

test('dados de pós: faixas físicas coerentes (AO de contato, bloom só nas luzes, grão fino, flicker sutil)', () => {
  assert.ok(AO.levels.meia.scale === 0.5 && AO.levels.cheia.scale === 1);
  assert.ok(AO.levels.meia.samples < AO.levels.cheia.samples);
  assert.ok(AO.radius >= 10 && AO.radius <= 60, 'contato de 1 a 6 cm');
  assert.ok(AO.protect[0] < AO.protect[1]);
  assert.ok(AO.saturation > 0, 'oclusão colorida');
  // Massa sob a key chega a ~2 de radiância; painéis de luz a 3–14 (src/render/studio/studioRig.js).
  assert.ok(BLOOM.threshold >= 2 && BLOOM.threshold < 3);
  assert.ok(BLOOM.intensity > 0 && BLOOM.intensity < 0.2, 'bloom leve');
  assert.ok(BLOOM.scatter > 0 && BLOOM.scatter < 1);
  assert.ok(DOF.maxSamples >= 64 && DOF.radiusStep > 0);
  assert.ok(LENS.grain.maxAmount * 0.35 < 0.05, 'grão fino no preset');
  assert.ok(FLICKER.amplitude > 0 && FLICKER.amplitude <= 0.03, 'flicker sutil');
  assert.ok(FLICKER.smoothing >= 0 && FLICKER.smoothing < 1);
});

test('presets: toda chave de pós existe no esquema e aceita o valor do preset', () => {
  for (const [id, values] of Object.entries(QUALITY_PRESETS)) {
    for (const key of ['graphics.ao', 'graphics.bloom', 'graphics.dof', 'graphics.smaa', 'graphics.grain', 'graphics.vignette', 'graphics.flicker']) {
      const spec = CONFIG_SCHEMA[key];
      assert.ok(spec, `${key} no esquema`);
      const v = values[key];
      if (spec.type === 'enum') assert.ok(spec.options.includes(v), `${id}: ${key}=${v}`);
      if (spec.type === 'number') assert.ok(v >= spec.min && v <= spec.max, `${id}: ${key}=${v}`);
      if (spec.type === 'bool') assert.equal(typeof v, 'boolean');
    }
    if (values['graphics.ao'] !== 'desligado') assert.ok(AO.levels[values['graphics.ao']], `${id}: nível de AO`);
  }
  // Leve (celular) não paga AO, bloom nem DOF; Ultra tem AO em resolução cheia.
  assert.equal(QUALITY_PRESETS.leve['graphics.ao'], 'desligado');
  assert.equal(QUALITY_PRESETS.leve['graphics.dof'], 'desligado');
  assert.equal(QUALITY_PRESETS.ultra['graphics.ao'], 'cheia');
});

test('recuperação de contexto: ouvintes de dispose antigos saem e novos voltam a funcionar', () => {
  installDisposeTracker();
  installDisposeTracker(); // idempotente
  const geo = new THREE.BufferGeometry();
  const tex = new THREE.Texture();
  let oldCalls = 0;
  let newCalls = 0;
  const oldListener = () => oldCalls++;
  geo.addEventListener('dispose', oldListener);
  tex.addEventListener('dispose', oldListener);
  // Ouvintes de outros eventos não são tocados.
  let changed = 0;
  tex.addEventListener('change', () => changed++);
  const purged = purgeStaleDisposeListeners();
  assert.ok(purged >= 2, `limpou ${purged}`);
  geo.dispose();
  tex.dispose();
  assert.equal(oldCalls, 0, 'o ouvinte do contexto morto não roda');
  tex.dispatchEvent({ type: 'change' });
  assert.equal(changed, 1);
  // Depois da recuperação o three registra ouvintes novos: esses funcionam normalmente.
  geo.addEventListener('dispose', () => newCalls++);
  geo.dispose();
  assert.equal(newCalls, 1);
  assert.ok(compactDisposeTracker() >= 1, 'o objeto voltou a ser registrado');
});
