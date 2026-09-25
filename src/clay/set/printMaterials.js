// Papel e desenhos do set (pista de testes; LDB9, TMA12, WRG4, COC4, CFO19 no item 11 do moodboard):
//  - paper: folhas no chão (papel kraft das faixas de bhop e das pegadas): fibras, manchas de tom, a cor de cada folha
//    vinda da cor da peça; uv em u. Deitado sobre o compensado: desloca a profundidade para não brigar com ele.
//  - decal: desenhos de um atlas RGBA do mapa (cor + cobertura), recortados por teste de alfa (sem transparência: AO
//    e profundidade de campo continuam certos; com MSAA, o alfa vira cobertura e a borda sai lisa). O atributo
//    aDecalKind escolhe o acabamento: 0 tinta (estêncil, faixas, alvos, estampas, marcador), 1 papel impresso
//    (transferidor, bandeirinha, planta, etiqueta), 2 grafite (anotações e riscos a lápis). aDecalRect = célula no atlas;
//    uv = 0..1 na célula. O atlas é DataTexture sem pré-multiplicação: a cor continua certa onde a cobertura é zero
//    (mipmaps sem franja escura).

import { createSetMaterial } from './setShader.js';

export function paperMaterial(tex, { name = 'papel' } = {}) {
  return createSetMaterial({
    name,
    params: { color: 0xffffff, roughness: 0.9, metalness: 0, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 },
    uniforms: { uPaperTex: { value: tex.paper }, uCrepe: { value: tex.crepe } },
    light: { wrap: 0.35, lift: 0.07, translucency: 0.2 },
    fragPars: 'uniform sampler2D uPaperTex;\nuniform sampler2D uCrepe;',
    surface: /* glsl */ `
vec4 pt = texture(uPaperTex, setUv / 170.0);
vec4 pt2 = texture(uPaperTex, setUv / 41.0 + 0.37);
float mottle = clayNoise3(vec3(setUv * 0.0035, 2.0)) * 0.5 + 0.5;
// Kraft de rolo: faixas largas de tom ao longo do comprimento (a bobina) e as fibras longas.
float band = clayNoise3(vec3(setUv.y * 0.012, 5.0, setUv.x * 0.0004)) * 0.5 + 0.5;
vec3 col = diffuseColor.rgb * (0.88 + 0.16 * mottle) * (0.96 + 0.08 * band);
col *= 1.0 + (pt.b - 0.5) * 0.4 + (pt2.b - 0.5) * 0.15;
col *= 0.96 + 0.08 * pt.a;
diffuseColor.rgb = col;
setRough += (pt.a - 0.5) * 0.08;
mat3 tbn = setCotangentFrame(setN, setP, setUv / 170.0);
setObjN = normalize(tbn * vec3((pt.rg * 2.0 - 1.0) * 0.35 + (pt2.rg * 2.0 - 1.0) * 0.12, 1.0));
`,
  });
}

export function decalMaterial(tex, { atlas, name = 'desenhos' }) {
  return createSetMaterial({
    name,
    params: {
      color: 0xffffff, roughness: 0.7, metalness: 0, alphaTest: 0.5, alphaToCoverage: true,
      polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -4,
    },
    uniforms: { uDecalAtlas: { value: atlas }, uPaperTex: { value: tex.paper } },
    light: { wrap: 0.3, lift: 0.07 },
    vertexPars: 'attribute vec4 aDecalRect;\nattribute float aDecalKind;\nvarying vec4 vDecalRect;\nvarying float vDecalKind;',
    vertex: 'vDecalRect = aDecalRect;\n  vDecalKind = aDecalKind;',
    fragPars: 'uniform sampler2D uDecalAtlas;\nuniform sampler2D uPaperTex;\nvarying vec4 vDecalRect;\nvarying float vDecalKind;',
    surface: /* glsl */ `
vec4 t = texture(uDecalAtlas, vDecalRect.xy + clamp(setUv, 0.0, 1.0) * vDecalRect.zw);
float kind = floor(vDecalKind + 0.5);
vec3 col = t.rgb;
vec4 pt = texture(uPaperTex, setP.xy / 60.0);
if (kind < 0.5) {
  // Tinta: camada fosca e fina sobre a superfície (o relevo de baixo quase não aparece por ela).
  col *= 0.97 + 0.06 * (pt.b - 0.5);
  setRough += 0.1 + (pt.a - 0.5) * 0.1;
} else if (kind < 1.5) {
  // Papel impresso: fibras no papel e a tinta de impressão um pouco mais lisa.
  float printed = 1.0 - smoothstep(0.55, 0.8, dot(col, vec3(0.3333)));
  col *= 0.95 + 0.1 * (pt.b - 0.5);
  setRough += 0.2 - printed * 0.15;
  mat3 tbn = setCotangentFrame(setN, setP, setP.xy / 60.0);
  setObjN = normalize(tbn * vec3((pt.rg * 2.0 - 1.0) * 0.3, 1.0));
} else {
  // Grafite: o traço brilha de leve contra a luz (metálico e liso).
  setMetal += 0.35;
  setRough += -0.3;
}
diffuseColor.rgb = col;
diffuseColor.a = t.a;
`,
  });
}
