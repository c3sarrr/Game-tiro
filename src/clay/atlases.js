// Atlas procedurais da massinha (assados na GPU no carregamento, repetíveis/tileáveis), em dois passes:
// campo de altura/máscaras em HalfFloat → normais por diferença central + empacotamento RGBA8 com mipmaps.
//  - Digitais (docs/art/moodboard.md: PLA4, PLA17, CIL17; revisão da 2.6: FPC9, FPC14, CLT1, CLF17): almofadas
//    ovais do dedo do animador — do tamanho real de uma ponta de dedo num boneco de 7,2 cm (13–19 u) — com
//    sulcos em laço, verticilo ou arco. A digital é antes de tudo uma BACIA RASA (o dedo afundou a massa) com um
//    lábio de massa empurrada na borda; os sulcos (~0,5 u, baixos) só existem onde houve pressão. De longe os
//    sulcos somem nos mipmaps e fica só o amassado raso, como nas fotos; de perto aparecem os sulcos.
//    O campo de fase é a distância a uma "espinha" (semirreta do laço, segmento curto do verticilo), então os
//    sulcos têm espaçamento constante como na pele de verdade; ruído de fase cria bifurcações e sulcos que
//    terminam (minúcias). As digitais se agrupam (onde a peça foi segurada) e deixam áreas lisas entre os
//    grupos — nada de padrão regular que leia como trama de tecido. Algumas são parciais (dedo que deslizou)
//    e as vizinhas se sobrepõem sem costura (a mais "recente" por cima).
//    RGBA = normal xy (0..1) | sulco (cavidade) | máscara da digital.
//  - Ferramenta (CIL16, PLA15, PLA17): facetas achatadas por espátula (plano levemente inclinado com um lábio
//    de massa empurrada numa das bordas), poucos riscos finos no sentido do golpe, amassados de polegar,
//    irregularidade geral, fiapos de tecido curvos e pontinhos de poeira.
//    RGBA = normal xy (0..1) | massa alisada/fresca (0..1) | fiapo (≈1) ou poeira (≈0,5).

import { NOISE_GLSL, NOISE2_PERIODIC_GLSL } from './glsl/noise.js';
import { bakeTwoPass } from './proceduralTextures.js';

const SEG_DIST = /* glsl */ `
float claySegDist(vec2 p, vec2 a, vec2 b) {
  vec2 pa = p - a;
  vec2 ba = b - a;
  float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  return length(pa - ba * h);
}
mat2 clayRot(float a) {
  float c = cos(a);
  float s = sin(a);
  return mat2(c, -s, s, c);
}
`;

// ---------------------------------------------------------------- digitais: passo 1 (campo)
const FINGERPRINT_FIELD = /* glsl */ `
uniform vec2 uResolution;
uniform float uCells;
uniform float uRidges;
uniform float uSeed;
uniform float uPresence;
uniform float uDent;
uniform float uRidgeAmp;
varying vec2 vUv;
${NOISE_GLSL}
${NOISE2_PERIODIC_GLSL}
${SEG_DIST}

// Fase dos sulcos (em raios da digital) conforme o tipo de padrão.
float ridgePhase(vec2 q, float kind, float id) {
  if (kind < 0.35) {
    // Verticilo: anéis ovais em volta de um núcleo curto; metade deles vira espiral (um sulco contínuo).
    float core = 0.04 + 0.1 * fract(id * 3.1);
    float d = claySegDist(q, vec2(-core, 0.0), vec2(core, 0.0));
    float spiral = step(0.5, fract(id * 5.3)) * (atan(q.y, q.x) / 6.2831853) / uRidges;
    return d + spiral;
  }
  if (kind < 0.9) {
    // Laço: distância a uma semirreta que sai do núcleo — sulcos paralelos dos dois lados que dão a volta
    // por cima do núcleo e saem pelo mesmo lado.
    vec2 dir = normalize(vec2(0.45 * (fract(id * 9.1) - 0.5), -1.0));
    vec2 core = vec2(0.0, 0.12 + 0.12 * fract(id * 4.3));
    return claySegDist(q, core, core + dir * 4.0);
  }
  // Arco: ondas que atravessam a almofada subindo no meio (sem núcleo).
  return q.y + 2.0 - 0.3 * exp(-q.x * q.x * 4.0);
}

// Uma digital centrada em d (unidade: células). Devolve a altura; escreve máscara e sulco.
// cluster (0..1, baixa frequência) decide se a digital existe: toques se agrupam onde a peça foi segurada.
float printAt(vec2 d, vec2 p, vec2 warp, float id, float cluster, out float mask, out float groove) {
  vec2 q = clayRot(id * 6.2831853) * d;
  float radius = 0.4 + 0.18 * fract(id * 17.3);
  q /= radius;
  q.y /= 1.3; // a almofada do dedo é oval
  float e = length(q);
  vec2 qw = q + warp * 0.12;
  float kind = fract(id * 13.37);
  float phase = ridgePhase(qw, kind, id);
  float pn = clayFbm2P(p * 4.0, vec2(uCells * 4.0), uSeed + 2.2 + id, 2);
  float ridge = 0.5 + 0.5 * cos(6.2831853 * (phase * uRidges + pn * 0.45));
  ridge = pow(ridge, 0.75); // cristas largas, sulcos estreitos: a pele empurra a massa
  float br = clayNoise2P(p * 11.0, vec2(uCells * 11.0), uSeed + 3.3);
  float keep = smoothstep(-0.6, -0.32, br);
  // Pressão do dedo: máxima no centro, some na borda da almofada (é onde os sulcos marcam).
  float press = 1.0 - smoothstep(0.35, 1.0, e);
  float pad = smoothstep(1.14, 0.9, e); // área afetada inclui o lábio
  float partialCut = 1.0;
  if (fract(id * 29.7) < 0.45) {
    vec2 cutDir = vec2(cos(id * 40.0), sin(id * 40.0));
    partialCut = smoothstep(-0.2, 0.4, dot(q, cutDir) + (fract(id * 7.7) - 0.5) * 0.7);
  }
  float present = step(1.0 - uPresence * (0.25 + 1.25 * cluster), fract(id * 91.7));
  float strength = 0.45 + 0.55 * fract(id * 37.1);
  mask = pad * partialCut * present * strength;
  groove = (1.0 - ridge) * keep * press;
  // Bacia rasa (o dedo afundou a massa) + lábio na borda (massa empurrada) + sulcos onde houve pressão.
  float s = max(1.0 - e * e, 0.0);
  float bowl = -uDent * s * s;
  float lip = uDent * 0.28 * exp(-pow((e - 1.02) / 0.1, 2.0));
  return bowl + lip + (ridge - 0.5) * keep * press * uRidgeAmp;
}

void main() {
  vec2 p = vUv * uCells;
  vec2 n = floor(p);
  vec2 f = fract(p);
  vec2 warp = vec2(
    clayFbm2P(p * 1.5, vec2(uCells * 1.5), uSeed, 3),
    clayFbm2P(p * 1.5 + 7.0, vec2(uCells * 1.5), uSeed + 5.1, 3)
  );
  float h = 0.0;
  float g = 0.0;
  float m = 0.0;
  // Vizinhança 3×3: digitais maiores que a célula não são cortadas; a ordem (j, i) é a mesma em todo o
  // plano, então quando duas se sobrepõem a mesma fica por cima nos dois lados (sem costura).
  for (int j = -1; j <= 1; j++) {
    for (int i = -1; i <= 1; i++) {
      vec2 gc = vec2(float(i), float(j));
      vec2 cell = mod(n + gc, vec2(uCells));
      vec2 o = 0.5 + (clayHash22(cell + uSeed) - 0.5) * 0.8;
      float id = clayHash12(cell + uSeed * 1.37);
      // Agrupamento dos toques: ruído periódico de baixa frequência no centro da célula (tile = 1).
      vec2 cuv = (cell + o) / uCells;
      float cluster = clamp(clayFbm2P(cuv * 2.0, vec2(2.0), uSeed + 8.0, 2) * 0.9 + 0.5, 0.0, 1.0);
      float mi;
      float gi;
      float hi = printAt(f - (gc + o), p, warp, id, cluster, mi, gi);
      h = mix(h, hi, mi);
      g = mix(g, gi, mi);
      m = max(m, mi);
    }
  }
  gl_FragColor = vec4(h, g * m, m, 1.0);
}
`;

// ---------------------------------------------------------------- ferramenta: passo 1 (campo)
const TOOL_FIELD = /* glsl */ `
uniform vec2 uResolution;
uniform float uSeed;
uniform float uFacets;
uniform float uFibers;
varying vec2 vUv;
${NOISE_GLSL}
${NOISE2_PERIODIC_GLSL}
${SEG_DIST}

// Distância a um arco de circunferência (centro c, raio r, ângulo inicial a0, abertura span).
float arcDist(vec2 p, vec2 c, float r, float a0, float span) {
  vec2 d = p - c;
  float a = atan(d.y, d.x) - a0;
  a = mod(a + 6.2831853, 6.2831853);
  if (a <= span) return abs(length(d) - r);
  vec2 e0 = c + r * vec2(cos(a0), sin(a0));
  vec2 e1 = c + r * vec2(cos(a0 + span), sin(a0 + span));
  return min(length(p - e0), length(p - e1));
}

void main() {
  vec2 uv = vUv;
  // Irregularidade geral da massa (baixa frequência) — o "amassado" de fundo (~7° de inclinação).
  float lumpy = clayFbm2P(uv * 5.0, vec2(5.0), uSeed + 7.0, 4) * 2.2;
  float h = lumpy;
  float fresh = 0.0;

  // Golpes de espátula: faixas alongadas (cápsulas) onde a massa foi alisada num plano levemente
  // inclinado que parte da altura local (sem degrau), com um lábio de massa empurrada no fim do golpe e
  // riscos finos no sentido dele. Vizinhança 3×3 para golpes maiores que a célula não serem cortados.
  vec2 sp = uv * uFacets;
  vec2 sn = floor(sp);
  vec2 sf = fract(sp);
  for (int j = -1; j <= 1; j++) {
    for (int i = -1; i <= 1; i++) {
      vec2 gc = vec2(float(i), float(j));
      vec2 cell = mod(sn + gc, vec2(uFacets));
      float id = clayHash12(cell + uSeed * 1.37);
      if (fract(id * 3.3) > 0.6) continue;
      vec2 o = 0.5 + (clayHash22(cell + uSeed) - 0.5) * 0.85;
      vec2 rel = sf - (gc + o); // pixel relativo ao centro do golpe (células)
      float ang = id * 6.2831853;
      vec2 dir = vec2(cos(ang), sin(ang));
      vec2 perp = vec2(-dir.y, dir.x);
      vec2 local = vec2(dot(rel, dir), dot(rel, perp)); // (ao longo, através)
      float len = 0.26 + 0.16 * fract(id * 7.7);
      float wid = 0.1 + 0.08 * fract(id * 5.9);
      float sd = length(vec2(max(abs(local.x) - len, 0.0), local.y)) - wid;
      float inside = smoothstep(0.1, -0.1, sd);
      if (sd > 0.16) continue;
      vec2 centerUv = (sn + gc + o) / uFacets;
      float base = clayFbm2P(centerUv * 5.0, vec2(5.0), uSeed + 7.0, 4) * 2.2;
      float plane = base + local.y * (0.6 + 0.9 * fract(id * 7.1)) + local.x * 0.25;
      h = mix(h, plane, inside * 0.7);
      // Lábio só no fim do golpe (onde a espátula parou e empurrou a massa).
      float lip = exp(-pow((sd - 0.03) / 0.035, 2.0)) * smoothstep(0.35 * len, len + wid, local.x);
      h += lip * 0.36;
      // Riscos: poucas linhas finas ao longo do golpe, cada uma com início e fim próprios.
      float s = local.y * (70.0 + 40.0 * fract(id * 5.7));
      float li = floor(s);
      float lf = fract(s) - 0.5;
      float gate = step(0.72, clayHash12(vec2(li, id * 97.0)));
      float a0 = -len + len * 0.8 * clayHash12(vec2(li, id * 31.0));
      float a1 = a0 + len * (0.5 + 1.0 * clayHash12(vec2(li, id * 53.0)));
      float span = smoothstep(a0, a0 + 0.03, local.x) * smoothstep(a1, a1 - 0.05, local.x);
      float wob = clayNoise2P(uv * 40.0, vec2(40.0), uSeed + li) * 0.12;
      float profile = exp(-pow((lf + wob) / 0.1, 2.0));
      h -= profile * gate * span * inside * 0.12;
      fresh = max(fresh, inside * 0.65);
    }
  }

  // Amassados de polegar: depressões suaves (algumas alongadas = massa arrastada) que alisam a superfície.
  // Soma dos vizinhos 3×3: a cauda de cada amassado não é cortada na borda da célula (sem costura reta).
  vec2 dp3 = uv * 3.0;
  vec2 dn3 = floor(dp3);
  vec2 df3 = fract(dp3);
  for (int j = -1; j <= 1; j++) {
    for (int i = -1; i <= 1; i++) {
      vec2 gc = vec2(float(i), float(j));
      vec2 cell = mod(dn3 + gc, vec2(3.0));
      float id = clayHash12(cell + (uSeed + 4.0) * 1.37);
      if (fract(id * 11.0) > 0.6) continue;
      vec2 o = 0.5 + (clayHash22(cell + uSeed + 4.0) - 0.5) * 0.9;
      vec2 rel = df3 - (gc + o);
      vec2 stretch = clayRot(id * 12.0) * rel * vec2(1.0, 1.0 + 1.3 * fract(id * 23.0));
      float dent = exp(-dot(stretch, stretch) * 9.0);
      h -= dent * (1.4 + 1.6 * fract(id * 41.0)); // ~8–14° nas encostas do amassado
      fresh = max(fresh, dent);
    }
  }

  // Fiapos de tecido: arcos finos e esparsos (≈1) — e poeira em pontinhos (≈0,5).
  float lint = 0.0;
  vec2 fp = uv * uFibers;
  vec2 fn = floor(fp);
  vec2 ff = fract(fp);
  for (int j = -1; j <= 1; j++) {
    for (int i = -1; i <= 1; i++) {
      vec2 g = vec2(float(i), float(j));
      vec2 cell = mod(fn + g, vec2(uFibers));
      float hh = clayHash12(cell + uSeed + 40.0);
      if (hh < 0.9) continue;
      vec2 c = g + clayHash22(cell + uSeed + 41.0);
      float r = 0.18 + 0.3 * clayHash12(cell + uSeed + 42.0);
      float a0 = clayHash12(cell + uSeed + 43.0) * 6.2831853;
      float spanA = 0.7 + 1.6 * clayHash12(cell + uSeed + 44.0);
      float wob = clayNoise2P(fp * 3.0, vec2(uFibers * 3.0), uSeed + 45.0) * 0.03;
      float dist = arcDist(ff, c, r + wob, a0, spanA);
      float thick = 0.006 + 0.006 * clayHash12(cell + uSeed + 46.0);
      lint = max(lint, smoothstep(thick * 2.2, thick * 0.6, dist));
    }
  }
  vec2 dp = uv * 44.0;
  vec2 dn = floor(dp);
  vec2 df = fract(dp);
  float dh = clayHash12(mod(dn, vec2(44.0)) + uSeed + 60.0);
  if (dh > 0.972 && lint < 0.5) {
    vec2 c = clayHash22(mod(dn, vec2(44.0)) + uSeed + 61.0) * 0.6 + 0.2;
    float r = 0.05 + 0.07 * clayHash12(mod(dn, vec2(44.0)) + uSeed + 62.0);
    lint = max(lint, 0.5 * smoothstep(r, r * 0.45, length(df - c)));
  }
  gl_FragColor = vec4(h, fresh, lint, 1.0);
}
`;

// ---------------------------------------------------------------- passo 2 comum: normais + empacotamento
// Campo (altura, canal B, canal A) → RGBA = normal xy | B | A.
// Digitais: B = sulco, A = máscara · Ferramenta: B = massa alisada, A = fiapo/poeira.
const NORMALS_FINAL = /* glsl */ `
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
  // Inclinação independente da resolução: mais texels por unidade → diferença menor por texel.
  vec2 d = vec2(hr - hl, hu - hd) * uStrength * (uResolution.x / 1024.0);
  vec3 n = normalize(vec3(-d, 1.0));
  gl_FragColor = vec4(n.xy * 0.5 + 0.5, clamp(c.g, 0.0, 1.0), clamp(c.b, 0.0, 1.0));
}
`;

/**
 * Assa os dois atlas. `size` 512/1024/2048 conforme a qualidade.
 * @returns {{fingerprint: THREE.WebGLRenderTarget, tool: THREE.WebGLRenderTarget}}
 */
export function bakeClayAtlases(renderer, { size = 1024, seed = 7.31, anisotropy = 8 } = {}) {
  const fingerprint = bakeTwoPass(renderer, {
    size,
    name: 'massacre.clay.fingerprints',
    anisotropy,
    fieldShader: FINGERPRINT_FIELD,
    fieldUniforms: {
      // 6×6 células em 96 u: almofadas de 13–19 u; 15 sulcos por raio → ~0,45–0,6 u entre sulcos.
      uCells: { value: 6 },
      uRidges: { value: 15 },
      uSeed: { value: seed },
      uPresence: { value: 0.62 },
      // Dedo em massa mole: a almofada afunda ~0,6–0,9 mm num raio de ~7 mm → encostas de até ~13° (antes 4 →
      // ~6°: a digital só existia com a key sozinha; qualquer contraluz a apagava).
      uDent: { value: 8.5 },
      // Sulcos com ~0,06 mm de relevo a cada 0,5 mm → até ~30° (somem nos mipmaps de longe, ficam de perto).
      uRidgeAmp: { value: 0.66 },
    },
    finalShader: NORMALS_FINAL,
    finalUniforms: { uStrength: { value: 0.8 } },
  });
  const tool = bakeTwoPass(renderer, {
    size,
    name: 'massacre.clay.tool',
    anisotropy,
    fieldShader: TOOL_FIELD,
    fieldUniforms: {
      uSeed: { value: seed * 1.7 + 3.0 },
      uFacets: { value: 4 },
      uFibers: { value: 10 },
    },
    finalShader: NORMALS_FINAL,
    finalUniforms: { uStrength: { value: 5.5 } },
  });
  return { fingerprint, tool };
}
