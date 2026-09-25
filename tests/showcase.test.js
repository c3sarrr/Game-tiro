// Testes da vitrine de massinha (Fase 2.6): estatística da varredura de presets, tabela comparativa, layout do
// atlas de etiquetas, grade da bancada e validação dos 20 objetos (ids, células, construtores, rótulos, dados
// de cada tipo). Lógica pura — nada de navegador nem WebGL.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { summarizeFrames, formatSweepTable } from '../src/debug/presetSweep.js';
import { layoutLabelCells, labelRect } from '../src/clay/set/labelAtlas.js';
import { showcaseCellCenter, labelLength } from '../src/debug/showcase.js';
import { SHOWCASE_KINDS } from '../src/debug/showcaseObjects.js';
import { SHOWCASE_OBJECTS, SHOWCASE_SET, PRESET_SWEEP, SHOWCASE_PANEL, CLAY_BLACK_PROBE } from '../src/data/showcase.js';
import { CLAY_SKINS } from '../src/data/claySkins.js';
import { PRESET_IDS } from '../src/data/qualityPresets.js';
import { POST_CONTEXT_IDS } from '../src/data/postFx.js';

const near = (actual, expected, eps = 1e-9, msg = '') => assert.ok(Math.abs(actual - expected) <= eps, `${msg} esperado ${expected}, veio ${actual}`);

test('summarizeFrames: FPS pelo tempo total, 1% low = média do 1% mais lento, p95 e médias de GPU/CPU', () => {
  // 99 quadros de 10 ms + 1 de 50 ms: FPS = 100 quadros / 1,04 s; o 1% mais lento é o de 50 ms.
  const frames = [];
  for (let i = 0; i < 99; i++) frames.push({ dtMs: 10, gpuMs: 4 + (i % 2), cpuMs: 1 });
  frames.push({ dtMs: 50, gpuMs: 12, cpuMs: 3 });
  const s = summarizeFrames(frames);
  assert.equal(s.frames, 100);
  near(s.fps, 100 / 1.04, 1e-9);
  near(s.frameMs, 10.4, 1e-9);
  near(s.low1Fps, 20, 1e-9);
  assert.equal(s.p95Ms, 10);
  near(s.gpuMs, (50 * 4 + 49 * 5 + 12) / 100, 1e-9); // i par → 4 ms (50 quadros), ímpar → 5 ms (49)
  assert.equal(s.gpuP95, 5);
  near(s.cpuMs, (99 + 3) / 100, 1e-9);
  // Sem timer de GPU (null) a média fica null; quadros com dt ≤ 0 não contam.
  const noGpu = summarizeFrames([{ dtMs: 16, gpuMs: null, cpuMs: 2 }, { dtMs: 0, gpuMs: null, cpuMs: 2 }]);
  assert.equal(noGpu.frames, 1);
  assert.equal(noGpu.gpuMs, null);
  assert.equal(noGpu.gpuP95, null);
  const empty = summarizeFrames([]);
  assert.equal(empty.frames, 0);
  assert.equal(empty.fps, null);
  assert.equal(empty.low1Fps, null);
});

test('formatSweepTable: estimativa da GPU integrada (×fator) contra o orçamento de 60 FPS', () => {
  const rows = [
    { label: 'Leve', fps: 144, low1Fps: 120, frameMs: 6.9, gpuMs: 1.5, gpuP95: 1.9, cpuMs: 1.2, calls: 80, width: 1600, height: 900 },
    { label: 'Ultra', fps: 90, low1Fps: 70, frameMs: 11.1, gpuMs: 6, gpuP95: 7, cpuMs: 1.4, calls: 140, width: 2400, height: 1350 },
    { label: 'Médio', fps: 120, low1Fps: 100, frameMs: 8.3, gpuMs: null, gpuP95: null, cpuMs: 1.3, calls: 100, width: 1920, height: 1080 },
  ];
  const text = formatSweepTable(rows, { budgetMs: 1000 / 60, factor: 5 });
  const lines = text.split('\n');
  assert.equal(lines.length, 4);
  assert.match(lines[0], /GPU×5/);
  assert.match(lines[1], /^Leve/);
  assert.match(lines[1], /7\.5ms\s+sim$/, 'Leve: 1,5 ms × 5 = 7,5 ms cabe em 16,7 ms');
  assert.match(lines[2], /30\.0ms\s+não$/, 'Ultra: 6 ms × 5 = 30 ms não cabe');
  assert.match(lines[3], /n\/d\s+n\/d$/, 'sem timer de GPU: sem estimativa');
  assert.match(lines[2], /2400×1350/);
});

test('layoutLabelCells/labelRect: células por linha, altura em potência de 2, retângulo com flipY', () => {
  const layout = layoutLabelCells(20, { width: 2048, cellHeight: 96, columns: 4 });
  assert.equal(layout.cells.length, 20);
  assert.equal(layout.width, 2048);
  assert.equal(layout.height, 512, '5 linhas × 96 px = 480 → 512');
  assert.deepEqual(layout.cells[0], { x: 0, y: 0, w: 512, h: 96 });
  assert.deepEqual(layout.cells[5], { x: 512, y: 96, w: 512, h: 96 });
  assert.deepEqual(layout.cells[19], { x: 1536, y: 384, w: 512, h: 96 });
  for (const c of layout.cells) {
    assert.ok(c.x + c.w <= layout.width && c.y + c.h <= layout.height, 'célula dentro do atlas');
  }
  const [u, v, w, h] = labelRect(layout.cells[5], 300, layout.width, layout.height);
  near(u, 512 / 2048);
  near(v, 1 - (96 + 96) / 512, 1e-12, 'v conta de baixo (CanvasTexture com flipY)');
  near(w, 300 / 2048);
  near(h, 96 / 512);
  const clipped = labelRect(layout.cells[0], 9999, layout.width, layout.height);
  near(clipped[2], 512 / 2048, 1e-12, 'texto maior que a célula é cortado na célula');
  assert.equal(layoutLabelCells(0, { width: 256, cellHeight: 64, columns: 2 }).height, 64);
  assert.throws(() => layoutLabelCells(-1, { width: 256, cellHeight: 64, columns: 2 }));
  assert.throws(() => layoutLabelCells(3, { width: 1, cellHeight: 64, columns: 2 }));
});

test('grade da bancada: centros simétricos no tapete, etiqueta com comprimento mínimo', () => {
  const { cols, rows, pitchX, pitchZ } = SHOWCASE_SET.grid;
  const a = showcaseCellCenter(0, 0);
  const b = showcaseCellCenter(cols - 1, rows - 1);
  near(a.x + b.x, 2 * SHOWCASE_SET.mat.x, 1e-9, 'colunas simétricas em volta do tapete');
  near(b.x - a.x, (cols - 1) * pitchX);
  near(b.z - a.z, (rows - 1) * pitchZ);
  // Toda célula (com a etiqueta na frente) cabe no tapete.
  const halfW = SHOWCASE_SET.mat.width / 2;
  const halfD = SHOWCASE_SET.mat.depth / 2;
  for (let c = 0; c < cols; c++) {
    for (let r = 0; r < rows; r++) {
      const p = showcaseCellCenter(c, r);
      assert.ok(Math.abs(p.x - SHOWCASE_SET.mat.x) + pitchX / 2 <= halfW + 1e-9, `coluna ${c} cabe no tapete`);
      assert.ok(Math.abs(p.z - SHOWCASE_SET.mat.z) + pitchZ / 2 <= halfD + 1e-9, `linha ${r} cabe no tapete`);
    }
  }
  const L = SHOWCASE_SET.label;
  near(labelLength(0.1), L.tapeWidth * 2.2, 1e-12, 'texto curto: tira mínima');
  near(labelLength(10), 10 * L.textHeight + L.margin * 2, 1e-12);
  assert.ok(labelLength(10) < pitchX, 'a etiqueta mais longa esperada ainda cabe na célula');
});

test('20 objetos: ids únicos, células únicas na grade 5×4, construtor existente, rótulo e dados coerentes', () => {
  assert.equal(SHOWCASE_OBJECTS.length, 20);
  const ids = new Set();
  const cells = new Set();
  const { cols, rows } = SHOWCASE_SET.grid;
  for (const def of SHOWCASE_OBJECTS) {
    assert.ok(!ids.has(def.id), `id repetido: ${def.id}`);
    ids.add(def.id);
    const [c, r] = def.cell;
    assert.ok(Number.isInteger(c) && c >= 0 && c < cols && Number.isInteger(r) && r >= 0 && r < rows, `${def.id}: célula fora da grade`);
    const key = `${c},${r}`;
    assert.ok(!cells.has(key), `${def.id}: célula ${key} ocupada`);
    cells.add(key);
    assert.ok(SHOWCASE_KINDS.includes(def.kind), `${def.id}: tipo sem construtor (${def.kind})`);
    assert.equal(typeof def.label, 'string');
    assert.ok(def.label.trim().length >= 3, `${def.id}: rótulo vazio`);
    assert.ok(Number.isFinite(def.yawDeg ?? 0), `${def.id}: yawDeg`);
    if (def.kind === 'skinBall') assert.ok(CLAY_SKINS[def.skin], `${def.id}: skin desconhecida ${def.skin}`);
    if (def.kind === 'jellyRoll') {
      assert.ok(def.thickness > 0 && def.turns > 0 && def.length > 0, 'rolinho: espessura, voltas e comprimento');
      const outer = def.thickness * 0.55 + def.thickness + def.thickness * 2 * def.turns + def.thickness / 2;
      assert.ok(outer * 2 < SHOWCASE_SET.grid.pitchX, 'o rocambole cabe na célula');
    }
  }
  // Todos os tipos de construtor são usados (nada de construtor morto).
  for (const kind of SHOWCASE_KINDS) assert.ok(SHOWCASE_OBJECTS.some((d) => d.kind === kind), `construtor sem objeto: ${kind}`);
});

test('dados da varredura, do painel e do diagnóstico de massa preta', () => {
  assert.deepEqual([...PRESET_SWEEP.presets].sort(), [...PRESET_IDS].sort(), 'a varredura cobre todos os presets');
  assert.ok(PRESET_SWEEP.warmupS > 0 && PRESET_SWEEP.measureS >= 2);
  near(PRESET_SWEEP.budgetMs, 1000 / 60, 1e-12);
  assert.ok(PRESET_SWEEP.integratedFactor > 1);
  for (const key of ['wetness', 'boil', 'fingerprints', 'focus']) {
    const r = SHOWCASE_PANEL[key];
    assert.ok(r.min < r.max && r.step > 0 && r.step <= r.max - r.min, `faixa do painel ${key}`);
  }
  assert.deepEqual([...SHOWCASE_PANEL.contexts].sort(), [...POST_CONTEXT_IDS].sort(), 'botões de contexto = contextos do pós');
  assert.ok(SHOWCASE_PANEL.fingerprints.min <= 1 && SHOWCASE_PANEL.fingerprints.max >= 1, '×1 (como modelado) está na faixa');
  assert.ok(CLAY_BLACK_PROBE.threshold > 0 && CLAY_BLACK_PROBE.threshold < 0.05);
  assert.match(CLAY_BLACK_PROBE.color, /^#[0-9a-f]{6}$/i);
});
