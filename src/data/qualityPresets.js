// Presets gráficos Leve / Médio / Alto / Ultra (seção 0.16).
// Cada preset é um conjunto de valores para as chaves `graphics.*` da config.
// Escolher um preset grava todos os valores; mexer em qualquer ajuste individual troca o preset para "personalizado".
// Metas (seção 0.4): 60 FPS no Alto em desktop médio (GPU integrada recente); 30+ FPS no Leve em celular intermediário.

export const PRESET_IDS = Object.freeze(['leve', 'medio', 'alto', 'ultra']);

export const PRESET_LABELS = Object.freeze({
  leve: 'Leve',
  medio: 'Médio',
  alto: 'Alto',
  ultra: 'Ultra',
  personalizado: 'Personalizado',
});

export const QUALITY_PRESETS = Object.freeze({
  leve: Object.freeze({
    'graphics.resolutionScale': 0.75,
    'graphics.maxPixelRatio': 1,
    'graphics.adaptiveResolution': true,
    'graphics.targetFps': 30,
    'graphics.shadows': 'baixa',
    'graphics.msaa': 0,
    'graphics.anisotropy': 1,
    'graphics.clayFingerprints': false,
    'graphics.clayBoil': true,
    'graphics.clayAtlas': 512,
    'graphics.ao': 'desligado',
    'graphics.bloom': false,
    'graphics.dof': 'desligado',
    'graphics.smaa': true,
    'graphics.grain': 0.25,
    'graphics.vignette': 0.4,
    'graphics.flicker': true,
    'graphics.particles': 0.3,
    'graphics.detailDistance': 0.6,
  }),
  medio: Object.freeze({
    'graphics.resolutionScale': 0.9,
    'graphics.maxPixelRatio': 1.25,
    'graphics.adaptiveResolution': true,
    'graphics.targetFps': 60,
    'graphics.shadows': 'media',
    'graphics.msaa': 2,
    'graphics.anisotropy': 4,
    'graphics.clayFingerprints': true,
    'graphics.clayBoil': true,
    'graphics.clayAtlas': 1024,
    'graphics.ao': 'meia',
    'graphics.bloom': true,
    'graphics.dof': 'sutil',
    'graphics.smaa': true,
    'graphics.grain': 0.35,
    'graphics.vignette': 0.5,
    'graphics.flicker': true,
    'graphics.particles': 0.6,
    'graphics.detailDistance': 0.85,
  }),
  alto: Object.freeze({
    'graphics.resolutionScale': 1,
    'graphics.maxPixelRatio': 1.5,
    'graphics.adaptiveResolution': true,
    'graphics.targetFps': 60,
    'graphics.shadows': 'alta',
    'graphics.msaa': 4,
    'graphics.anisotropy': 8,
    'graphics.clayFingerprints': true,
    'graphics.clayBoil': true,
    'graphics.clayAtlas': 1024,
    'graphics.ao': 'meia',
    'graphics.bloom': true,
    'graphics.dof': 'sutil',
    'graphics.smaa': true,
    'graphics.grain': 0.35,
    'graphics.vignette': 0.5,
    'graphics.flicker': true,
    'graphics.particles': 0.8,
    'graphics.detailDistance': 1,
  }),
  ultra: Object.freeze({
    'graphics.resolutionScale': 1,
    'graphics.maxPixelRatio': 2,
    'graphics.adaptiveResolution': false,
    'graphics.targetFps': 60,
    'graphics.shadows': 'ultra',
    'graphics.msaa': 4,
    'graphics.anisotropy': 16,
    'graphics.clayFingerprints': true,
    'graphics.clayBoil': true,
    'graphics.clayAtlas': 2048,
    'graphics.ao': 'cheia',
    'graphics.bloom': true,
    'graphics.dof': 'sutil',
    'graphics.smaa': true,
    'graphics.grain': 0.35,
    'graphics.vignette': 0.5,
    'graphics.flicker': true,
    'graphics.particles': 1,
    'graphics.detailDistance': 1.3,
  }),
});

/** Qualidade de sombra → tamanho do shadow map e raio do filtro (PCF com disco de Vogel no r186). */
export const SHADOW_LEVELS = Object.freeze({
  desligada: { mapSize: 0, radius: 0 },
  baixa: { mapSize: 1024, radius: 2 },
  media: { mapSize: 2048, radius: 3 },
  alta: { mapSize: 2048, radius: 4 },
  ultra: { mapSize: 4096, radius: 5 },
});

/** Teto do lado do mapa de sombra (px): luzes com `shadowScale` > 1 (a key da pista) não passam disto nem do máximo da GPU. */
export const SHADOW_MAX_SIZE = 4096;

/** Controle de resolução dinâmica (graphics.adaptiveResolution). */
export const ADAPTIVE_RESOLUTION = Object.freeze({
  minScale: 0.5, // nunca abaixo de 50% da resolução do preset
  maxScale: 1,
  stepDown: 0.1,
  stepUp: 0.05,
  // Quadros avaliados antes de decidir (evita oscilar); descer é mais rápido que subir.
  windowDown: 45,
  windowUp: 180,
  // Sobe só se sobrar folga: tempo médio < alvo * headroom.
  headroom: 0.75,
  cooldownMs: 1200,
});

/** Chaves da config controladas pelos presets (qualquer mudança manual nelas vira "personalizado"). */
export const PRESET_KEYS = Object.freeze(Object.keys(QUALITY_PRESETS.alto));
