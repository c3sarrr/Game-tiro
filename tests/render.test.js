// Testes das partes puras do render: FOV Hor+, resolução dinâmica, taxa do monitor, nome de GPU e preset.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { verticalFovFromHorizontal, horizontalFovFromVertical } from '../src/render/camera.js';
import { AdaptiveResolution, frameBudgetMs } from '../src/render/adaptiveResolution.js';
import { RefreshEstimator } from '../src/render/refreshRate.js';
import { prettyGpuName, choosePreset } from '../src/render/hardware.js';
import { ADAPTIVE_RESOLUTION } from '../src/data/qualityPresets.js';

test('FOV: 100° horizontal em 16:9 e Hor+ em telas mais largas', () => {
  const v = verticalFovFromHorizontal(100);
  // 2·atan(tan(50°) / (16/9)) = 67,67°
  assert.ok(Math.abs(v - 67.67) < 0.05, `vertical ${v}`);
  assert.ok(Math.abs(horizontalFovFromVertical(v, 16 / 9) - 100) < 1e-6);
  assert.ok(horizontalFovFromVertical(v, 21 / 9) > 110, 'ultrawide ganha visão lateral');
});

test('orçamento por quadro: alvo, limite de FPS e taxa do monitor', () => {
  assert.ok(Math.abs(frameBudgetMs({ targetFps: 60 }) - 16.667) < 0.01);
  // Alvo 144 num monitor de 60 Hz: não adianta perseguir mais que o vsync.
  assert.ok(Math.abs(frameBudgetMs({ targetFps: 144, refreshMs: 16.667 }) - 16.667) < 0.01);
  // Limite de 30 FPS: o orçamento é o do limite.
  assert.ok(Math.abs(frameBudgetMs({ targetFps: 60, fpsCap: 30 }) - 33.333) < 0.01);
  // Monitor de 144 Hz com alvo 60: continua 60.
  assert.ok(Math.abs(frameBudgetMs({ targetFps: 60, refreshMs: 6.94 }) - 16.667) < 0.01);
});

test('resolução dinâmica: desce com GPU acima do orçamento e sobe com folga', () => {
  const a = new AdaptiveResolution(ADAPTIVE_RESOLUTION);
  const budget = frameBudgetMs({ targetFps: 60 });
  let now = 0;
  let changed = false;
  for (let i = 0; i < 120 && !changed; i++) changed = a.update(16.7, 22, budget, (now += 16.7));
  assert.ok(changed && a.scale < 1, 'baixou a escala');
  const low = a.scale;
  changed = false;
  for (let i = 0; i < 2000 && !changed; i++) changed = a.update(16.7, 5, budget, (now += 16.7));
  assert.ok(a.scale > low, 'subiu com folga');
  assert.ok(a.scale <= ADAPTIVE_RESOLUTION.maxScale && a.scale >= ADAPTIVE_RESOLUTION.minScale);
});

test('resolução dinâmica sem timer de GPU não desce por quadros no orçamento', () => {
  const a = new AdaptiveResolution(ADAPTIVE_RESOLUTION);
  let now = 0;
  for (let i = 0; i < 600; i++) a.update(16.7, null, frameBudgetMs({ targetFps: 60 }), (now += 16.7));
  assert.equal(a.scale, 1);
});

test('resolução dinâmica: limite de 30 FPS não derruba a resolução sem timer de GPU', () => {
  const a = new AdaptiveResolution(ADAPTIVE_RESOLUTION);
  const budget = frameBudgetMs({ targetFps: 60, fpsCap: 30 });
  let now = 0;
  for (let i = 0; i < 600; i++) a.update(33.4, null, budget, (now += 33.4));
  assert.equal(a.scale, 1);
});

test('taxa do monitor: mediana robusta a quadros perdidos', () => {
  const r = new RefreshEstimator();
  assert.equal(r.intervalMs, 0);
  for (let i = 0; i < 90; i++) r.sample(i % 15 === 0 ? 33.4 : 6.94 + (i % 3) * 0.01); // 144 Hz com perdas
  assert.ok(Math.abs(r.intervalMs - 6.95) < 0.05, `intervalo ${r.intervalMs}`);
  assert.ok(Math.abs(r.hz - 144) < 1.5);
  r.sample(500); // travada: ignorada
  r.sample(0); // quadro duplicado: ignorado
  assert.ok(Math.abs(r.intervalMs - 6.95) < 0.05);
  r.reset();
  assert.equal(r.hz, 0);
});

test('nome da GPU: ANGLE D3D11, Metal, Vulkan, Mesa e Firefox', () => {
  assert.equal(prettyGpuName('ANGLE (Intel, Intel(R) Iris(R) Xe Graphics (0x0000A7A1) Direct3D11 vs_5_0 ps_5_0, D3D11)'), 'Intel Iris Xe Graphics');
  assert.equal(prettyGpuName('ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 (0x00002503) Direct3D11 vs_5_0 ps_5_0, D3D11)'), 'NVIDIA GeForce RTX 3060');
  assert.equal(prettyGpuName('ANGLE (Apple, ANGLE Metal Renderer: Apple M1 Pro, Unspecified Version)'), 'Apple M1 Pro');
  assert.equal(prettyGpuName('ANGLE Metal Renderer: Apple M2'), 'Apple M2');
  assert.equal(prettyGpuName('ANGLE (NVIDIA, Vulkan 1.3.242 (NVIDIA GeForce RTX 3060 (0x00002503)), NVIDIA)'), 'NVIDIA GeForce RTX 3060');
  assert.equal(prettyGpuName('ANGLE (Intel, Mesa Intel(R) Xe Graphics (TGL GT2), OpenGL 4.6)'), 'Intel Xe Graphics (TGL GT2)');
  assert.equal(prettyGpuName('NVIDIA GeForce GTX 980, or similar'), 'NVIDIA GeForce GTX 980');
  assert.equal(prettyGpuName('Apple GPU'), 'Apple GPU');
  assert.equal(prettyGpuName(''), 'GPU desconhecida');
});

test('escolha conservadora de preset', () => {
  assert.equal(choosePreset({ cls: 'integrated', recommended: 'alto' }, { preset: 'ultra' }), 'alto');
  assert.equal(choosePreset({ cls: 'integrated', recommended: 'alto' }, { preset: 'medio' }), 'medio');
  assert.equal(choosePreset({ cls: 'unknown', recommended: 'medio' }, { preset: 'ultra' }), 'ultra');
  assert.equal(choosePreset({ cls: 'discrete', recommended: 'ultra' }, null), 'ultra');
});
