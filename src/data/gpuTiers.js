// Classificação de GPU por texto do renderizador (WEBGL_debug_renderer_info) → preset recomendado.
// Ordem importa: a primeira regra que casar vence. O micro-benchmark do primeiro acesso pode ajustar o resultado.

export const GPU_RULES = Object.freeze([
  // Celulares e tablets
  { match: /adreno.*(7[3-9]\d|8\d\d)/i, cls: 'mobile', tier: 2 },
  { match: /adreno/i, cls: 'mobile', tier: 1 },
  { match: /mali-g(7[1-9]|[89]\d|\d{3})|immortalis/i, cls: 'mobile', tier: 2 },
  { match: /mali|powervr|videocore|tegra/i, cls: 'mobile', tier: 1 },
  { match: /apple gpu/i, cls: 'apple', tier: 2 }, // Safari esconde o modelo (iPhone ou Mac)
  // Apple Silicon (Chrome/Firefox mostram o modelo)
  { match: /apple m\d (max|ultra)/i, cls: 'apple', tier: 3 },
  { match: /apple m\d/i, cls: 'apple', tier: 2 },
  // Dedicadas
  { match: /rtx\s?[2-5]0[6-9]0|rtx\s?a\d000|radeon rx\s?[67-9][6-9]\d\d|rx\s?[7-9][89]\d\d|arc a7/i, cls: 'discrete', tier: 3 },
  { match: /rtx|gtx\s?16|gtx\s?10[6-8]0|radeon rx\s?[5-9]\d\d\d|rx\s?[5-7]\d\d\b|arc a[3-5]|quadro/i, cls: 'discrete', tier: 2 },
  { match: /geforce|gtx|radeon (r9|r7|hd)|firepro/i, cls: 'discrete', tier: 1 },
  // Integradas recentes (meta de 60 FPS no Alto)
  { match: /radeon\s?(7[68]0m|8[0-9]0m|680m|890m)|iris\s?xe|arc(\(tm\))? graphics|intel.*arc/i, cls: 'integrated', tier: 2 },
  { match: /radeon.*(vega|graphics)|iris/i, cls: 'integrated', tier: 1 },
  { match: /uhd|hd graphics/i, cls: 'integrated', tier: 1 },
  // Renderização por software (sem aceleração)
  { match: /swiftshader|llvmpipe|software|microsoft basic render/i, cls: 'software', tier: 0 },
]);

/** tier → preset recomendado, separado por classe de dispositivo. */
export const TIER_TO_PRESET = Object.freeze({
  mobile: ['leve', 'leve', 'medio', 'medio'],
  apple: ['leve', 'medio', 'alto', 'ultra'],
  discrete: ['medio', 'alto', 'alto', 'ultra'],
  integrated: ['leve', 'medio', 'alto', 'alto'],
  software: ['leve', 'leve', 'leve', 'leve'],
  unknown: ['medio', 'medio', 'alto', 'alto'],
});

/**
 * Micro-benchmark do primeiro acesso (cena de estresse em 1280×720) → preset.
 * `gpu`: tempo de GPU medido por timer query (sem sincronizar CPU e GPU).
 * `wall`: tempo de relógio com readPixels a cada quadro (fallback sem timer query; inclui a latência da sincronização).
 */
export const BENCHMARK_THRESHOLDS = Object.freeze({
  gpu: Object.freeze([
    { maxMs: 2.5, preset: 'ultra' },
    { maxMs: 6, preset: 'alto' },
    { maxMs: 12, preset: 'medio' },
    { maxMs: Infinity, preset: 'leve' },
  ]),
  wall: Object.freeze([
    { maxMs: 7, preset: 'ultra' },
    { maxMs: 16, preset: 'alto' },
    { maxMs: 30, preset: 'medio' },
    { maxMs: Infinity, preset: 'leve' },
  ]),
});
