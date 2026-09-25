// Texturas procedurais dos materiais do set (assadas na GPU no carregamento, tileáveis; referências no
// docs/art/moodboard.md item 4). Todas em dois passes: campo (altura + dois canais) → normais + empacotamento.
// RGBA de cada uma = normal xy (0..1) | canal B | canal A:
//  - paper   (papelão SSD4/SSD8/CSD16): fibras do papel kraft · B = pintas de fibra (claro/escuro) · A = manchas
//  - crepe   (fita crepe SSD2/SSD14): rugas finas atravessando a fita · B = rugas · A = fibras
//  - brushed (metal de ferramenta CSD19/SMD3): escovado ao longo de U · B = riscos · A = manchas de dedo
//  - wood    (balsa/bancada CSD16): veio ao longo de U · B = linhas do veio · A = poros
//  - mat     (tapete de corte SMD3): cortes de estilete · B = cortes · A = manchas de uso
//  - weave   (tecido preto das softboxes): trama tafetá · B = variação do fio · A = —
// Mais um atlas de dígitos (0–9) em canvas para a régua numerada do tapete de corte.

import * as THREE from 'three';
import { NOISE_GLSL, NOISE2_PERIODIC_GLSL } from '../glsl/noise.js';
import { bakeTwoPass } from '../proceduralTextures.js';

const COMMON = /* glsl */ `
uniform vec2 uResolution;
uniform float uSeed;
varying vec2 vUv;
${NOISE_GLSL}
${NOISE2_PERIODIC_GLSL}
float setSegDist(vec2 p, vec2 a, vec2 b) {
  vec2 pa = p - a;
  vec2 ba = b - a;
  float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  return length(pa - ba * h);
}
// Segmentos aleatórios tileáveis numa grade n×n (riscos, cortes). Devolve a máscara 0..1 da linha mais forte.
float setScratches(vec2 uv, float n, float prob, float minLen, float maxLen, float width, float seed) {
  vec2 p = uv * n;
  vec2 c = floor(p);
  float best = 0.0;
  for (int j = -1; j <= 1; j++) {
    for (int i = -1; i <= 1; i++) {
      vec2 g = vec2(float(i), float(j));
      vec2 cell = mod(c + g, vec2(n));
      if (clayHash12(cell + seed) > prob) continue;
      vec2 o = clayHash22(cell + seed + 1.0);
      float ang = clayHash12(cell + seed + 2.0) * 3.14159265;
      float len = mix(minLen, maxLen, clayHash12(cell + seed + 3.0));
      vec2 dir = vec2(cos(ang), sin(ang)) * len * 0.5;
      vec2 ctr = c + g + o;
      float d = setSegDist(p, ctr - dir, ctr + dir);
      float w = width * (0.6 + 0.8 * clayHash12(cell + seed + 4.0));
      float along = clamp(dot(p - ctr, normalize(dir)) / (len * 0.5), -1.0, 1.0);
      float taper = 1.0 - along * along; // a lâmina entra e sai: o corte afina nas pontas
      best = max(best, smoothstep(w, w * 0.3, d) * taper * (0.5 + 0.5 * clayHash12(cell + seed + 5.0)));
    }
  }
  return best;
}
`;

const PAPER_FIELD = /* glsl */ `
${COMMON}
void main() {
  vec2 uv = vUv;
  // Fibras alinhadas (o papel kraft tem direção de máquina) em duas escalas.
  float f1 = clayNoise2P(uv * vec2(24.0, 190.0), vec2(24.0, 190.0), uSeed);
  float f2 = clayNoise2P(uv * vec2(60.0, 420.0), vec2(60.0, 420.0), uSeed + 3.0);
  float grain = clayFbm2P(uv * 64.0, vec2(64.0), uSeed + 5.0, 3);
  float h = f1 * 0.5 + f2 * 0.3 + grain * 0.25;
  // Pintas de fibra: fiapos curtos mais claros ou mais escuros (reciclado).
  vec2 gp = uv * vec2(48.0, 192.0);
  vec2 gc = floor(gp);
  float fl = clayHash12(mod(gc, vec2(48.0, 192.0)) + uSeed + 7.0);
  float flecks = 0.5;
  if (fl > 0.93) {
    vec2 f = fract(gp) - 0.5;
    float streak = smoothstep(0.5, 0.2, abs(f.y)) * smoothstep(0.45, 0.2, abs(f.x) * 0.6);
    flecks = fl > 0.965 ? 0.5 + 0.5 * streak : 0.5 - 0.45 * streak;
  }
  float mottle = clayFbm2P(uv * 3.0, vec2(3.0), uSeed + 9.0, 4) * 0.5 + 0.5;
  gl_FragColor = vec4(h, flecks, mottle, 1.0);
}
`;

const CREPE_FIELD = /* glsl */ `
${COMMON}
void main() {
  vec2 uv = vUv;
  // U = comprimento da fita. Rugas atravessando a largura: variam rápido em U, devagar em V, com ondulação.
  float bend = clayNoise2P(uv * vec2(3.0, 5.0), vec2(3.0, 5.0), uSeed) * 0.6;
  float w1 = clayNoise2P(vec2(uv.x * 110.0 + bend * 8.0, uv.y * 4.0), vec2(110.0, 4.0), uSeed + 2.0);
  float w2 = clayNoise2P(vec2(uv.x * 260.0 + bend * 14.0, uv.y * 9.0), vec2(260.0, 9.0), uSeed + 4.0);
  float wrinkles = w1 * 0.7 + w2 * 0.35;
  float fibers = clayNoise2P(uv * vec2(160.0, 40.0), vec2(160.0, 40.0), uSeed + 6.0) * 0.12;
  gl_FragColor = vec4(wrinkles + fibers, wrinkles * 0.5 + 0.5, fibers * 4.0 + 0.5, 1.0);
}
`;

const BRUSHED_FIELD = /* glsl */ `
${COMMON}
void main() {
  vec2 uv = vUv;
  // Escovado: estrias longas ao longo de U.
  float s1 = clayNoise2P(uv * vec2(3.0, 320.0), vec2(3.0, 320.0), uSeed);
  float s2 = clayNoise2P(uv * vec2(8.0, 900.0), vec2(8.0, 900.0), uSeed + 2.0);
  float h = s1 * 0.35 + s2 * 0.2;
  // Riscos de uso em ângulos aleatórios (sulcos finos).
  float scr = setScratches(uv, 10.0, 0.45, 0.4, 2.2, 0.035, uSeed + 11.0);
  h -= scr * 0.9;
  // Manchas de dedo/gordura (mudam a rugosidade, não o relevo).
  float smudge = smoothstep(0.1, 0.45, clayFbm2P(uv * 4.0, vec2(4.0), uSeed + 13.0, 4));
  gl_FragColor = vec4(h, scr, smudge, 1.0);
}
`;

const WOOD_FIELD = /* glsl */ `
${COMMON}
void main() {
  vec2 uv = vUv;
  // Veio ao longo de U: anéis de crescimento vistos de lado, ondulando devagar.
  float warp = clayFbm2P(uv * vec2(2.0, 6.0), vec2(2.0, 6.0), uSeed, 3) * 1.6;
  float rings = uv.y * 26.0 + warp;
  float line = pow(0.5 + 0.5 * cos(6.2831853 * rings), 6.0);
  float fine = clayNoise2P(uv * vec2(6.0, 380.0), vec2(6.0, 380.0), uSeed + 3.0) * 0.5 + 0.5;
  // Poros: traços curtos escuros alinhados ao veio.
  vec2 pp = uv * vec2(40.0, 260.0);
  vec2 pc = floor(pp);
  float pore = 0.0;
  if (clayHash12(mod(pc, vec2(40.0, 260.0)) + uSeed + 5.0) > 0.86) {
    vec2 f = fract(pp) - 0.5;
    pore = smoothstep(0.45, 0.1, abs(f.y)) * smoothstep(0.5, 0.25, abs(f.x));
  }
  float h = line * 0.35 + fine * 0.15 - pore * 0.4;
  gl_FragColor = vec4(h, clamp(line * 0.8 + fine * 0.2, 0.0, 1.0), pore, 1.0);
}
`;

const MAT_FIELD = /* glsl */ `
${COMMON}
void main() {
  vec2 uv = vUv;
  // Cortes de estilete (a superfície "cicatriza" e fica um sulco fino mais claro).
  float cuts = setScratches(uv, 16.0, 0.3, 0.3, 3.2, 0.028, uSeed);
  float nicks = setScratches(uv, 40.0, 0.12, 0.1, 0.5, 0.05, uSeed + 20.0) * 0.6;
  float c = max(cuts, nicks);
  // Casca de laranja do PVC + manchas de uso (cola, tinta, sujeira).
  float peel = clayNoise2P(uv * 180.0, vec2(180.0), uSeed + 3.0) * 0.15;
  float wear = clayFbm2P(uv * 4.0, vec2(4.0), uSeed + 7.0, 4) * 0.5 + 0.5;
  gl_FragColor = vec4(peel - c * 0.8, c, wear, 1.0);
}
`;

const WEAVE_FIELD = /* glsl */ `
${COMMON}
uniform float uThreads;
void main() {
  vec2 p = vUv * uThreads;
  vec2 c = floor(p);
  vec2 f = fract(p);
  float over = mod(c.x + c.y, 2.0);
  // Tafetá: urdume (ao longo de U) por cima nas casas pares, trama (ao longo de V) nas ímpares.
  float warpH = sin(f.y * 3.14159265) * mix(1.0, 0.45, over);
  float weftH = sin(f.x * 3.14159265) * mix(0.45, 1.0, over);
  float h = max(warpH, weftH);
  float fiber = clayNoise2P(vUv * uThreads * 6.0, vec2(uThreads * 6.0), uSeed) * 0.5 + 0.5;
  gl_FragColor = vec4(h * 0.8 + fiber * 0.1, mix(0.45, 0.55, fiber) + (over - 0.5) * 0.08, 0.5, 1.0);
}
`;

const NORMALS = /* glsl */ `
uniform vec2 uResolution;
uniform sampler2D uField;
uniform float uStrength;
varying vec2 vUv;
void main() {
  vec2 t = 1.0 / uResolution;
  vec4 c = texture2D(uField, vUv);
  float hl = texture2D(uField, vUv - vec2(t.x, 0.0)).r;
  float hr = texture2D(uField, vUv + vec2(t.x, 0.0)).r;
  float hd = texture2D(uField, vUv - vec2(0.0, t.y)).r;
  float hu = texture2D(uField, vUv + vec2(0.0, t.y)).r;
  vec2 d = vec2(hr - hl, hu - hd) * uStrength * (uResolution.x / 512.0);
  vec3 n = normalize(vec3(-d, 1.0));
  gl_FragColor = vec4(n.xy * 0.5 + 0.5, clamp(c.g, 0.0, 1.0), clamp(c.b, 0.0, 1.0));
}
`;

const SPECS = Object.freeze({
  paper: { size: 512, field: PAPER_FIELD, strength: 2.2, seed: 3.1 },
  crepe: { size: 256, field: CREPE_FIELD, strength: 1.6, seed: 5.7 },
  brushed: { size: 512, field: BRUSHED_FIELD, strength: 3.0, seed: 8.3 },
  wood: { size: 512, field: WOOD_FIELD, strength: 2.4, seed: 2.9 },
  mat: { size: 1024, field: MAT_FIELD, strength: 3.2, seed: 6.1 },
  weave: { size: 256, field: WEAVE_FIELD, strength: 1.4, seed: 4.4, uniforms: { uThreads: { value: 64 } } },
});

/** Atlas 10×1 dos dígitos 0–9 (branco sobre transparente) desenhado em canvas com a fonte do sistema. */
function digitAtlas(anisotropy) {
  const cell = 64;
  const canvas = document.createElement('canvas');
  canvas.width = cell * 10;
  canvas.height = cell;
  const g = canvas.getContext('2d');
  g.clearRect(0, 0, canvas.width, canvas.height);
  g.fillStyle = '#ffffff';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.font = `700 ${Math.round(cell * 0.78)}px "Nunito", "Segoe UI", "Helvetica Neue", Arial, sans-serif`;
  for (let d = 0; d < 10; d++) g.fillText(String(d), d * cell + cell / 2, cell / 2 + 2);
  const tex = new THREE.CanvasTexture(canvas);
  tex.name = 'massacre.set.digits';
  tex.colorSpace = THREE.NoColorSpace;
  tex.anisotropy = anisotropy;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  return tex;
}

/**
 * Assa todas as texturas do set. Devolve { paper, crepe, brushed, wood, mat, weave, digits } (THREE.Texture)
 * e dispose().
 */
export function bakeSetTextures(renderer, { anisotropy = 8 } = {}) {
  const targets = {};
  for (const [name, spec] of Object.entries(SPECS)) {
    targets[name] = bakeTwoPass(renderer, {
      size: spec.size,
      name: `massacre.set.${name}`,
      anisotropy,
      fieldShader: spec.field,
      fieldUniforms: { uSeed: { value: spec.seed }, ...(spec.uniforms ?? {}) },
      finalShader: NORMALS,
      finalUniforms: { uStrength: { value: spec.strength } },
    });
  }
  const textures = Object.fromEntries(Object.entries(targets).map(([k, rt]) => [k, rt.texture]));
  textures.digits = digitAtlas(anisotropy);
  return {
    ...textures,
    targets,
    setAnisotropy(a) {
      for (const tex of Object.values(textures)) {
        tex.anisotropy = a;
        tex.needsUpdate = true;
      }
    },
    dispose() {
      for (const rt of Object.values(targets)) rt.dispose();
      textures.digits.dispose();
    },
  };
}
