// Biblioteca GLSL de ruído usada pela massinha e pelas texturas procedurais (strings para injetar em shaders).
// - Hash sem seno (Dave Hoskins): estável em GPUs de celular (sin() com argumentos grandes perde precisão).
// - Ruído de gradiente 3D com interpolação quíntica (boil de vértice, padrões de skin).
// - Versões periódicas 2D (tileáveis) para os atlas assados na GPU.
// Todas as funções têm prefixo "clay" para não colidir com os chunks do three.

export const NOISE_GLSL = /* glsl */ `
float clayHash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
vec2 clayHash22(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.xx + p3.yz) * p3.zy);
}
float clayHash13(vec3 p3) {
  p3 = fract(p3 * 0.1031);
  p3 += dot(p3, p3.zyx + 31.32);
  return fract((p3.x + p3.y) * p3.z);
}
vec3 clayHash33(vec3 p3) {
  p3 = fract(p3 * vec3(0.1031, 0.1030, 0.0973));
  p3 += dot(p3, p3.yxz + 33.33);
  return fract((p3.xxy + p3.yxx) * p3.zyx);
}

// Ruído de gradiente 3D, saída aproximadamente em [-1, 1].
float clayNoise3(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  vec3 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  float n000 = dot(clayHash33(i + vec3(0.0, 0.0, 0.0)) * 2.0 - 1.0, f - vec3(0.0, 0.0, 0.0));
  float n100 = dot(clayHash33(i + vec3(1.0, 0.0, 0.0)) * 2.0 - 1.0, f - vec3(1.0, 0.0, 0.0));
  float n010 = dot(clayHash33(i + vec3(0.0, 1.0, 0.0)) * 2.0 - 1.0, f - vec3(0.0, 1.0, 0.0));
  float n110 = dot(clayHash33(i + vec3(1.0, 1.0, 0.0)) * 2.0 - 1.0, f - vec3(1.0, 1.0, 0.0));
  float n001 = dot(clayHash33(i + vec3(0.0, 0.0, 1.0)) * 2.0 - 1.0, f - vec3(0.0, 0.0, 1.0));
  float n101 = dot(clayHash33(i + vec3(1.0, 0.0, 1.0)) * 2.0 - 1.0, f - vec3(1.0, 0.0, 1.0));
  float n011 = dot(clayHash33(i + vec3(0.0, 1.0, 1.0)) * 2.0 - 1.0, f - vec3(0.0, 1.0, 1.0));
  float n111 = dot(clayHash33(i + vec3(1.0, 1.0, 1.0)) * 2.0 - 1.0, f - vec3(1.0, 1.0, 1.0));
  return 1.6 * mix(
    mix(mix(n000, n100, u.x), mix(n010, n110, u.x), u.y),
    mix(mix(n001, n101, u.x), mix(n011, n111, u.x), u.y),
    u.z);
}

float clayFbm3(vec3 p, int octaves) {
  float sum = 0.0;
  float amp = 0.5;
  float norm = 0.0;
  for (int i = 0; i < 6; i++) {
    if (i >= octaves) break;
    sum += amp * clayNoise3(p);
    norm += amp;
    p = p * 2.03 + vec3(17.1, 5.3, 11.7);
    amp *= 0.5;
  }
  return sum / norm;
}
`;

// Ruído 2D periódico (tileável): o período é em células de rede; usado só nos "fornos" de textura.
export const NOISE2_PERIODIC_GLSL = /* glsl */ `
float clayNoise2P(vec2 p, vec2 period, float seed) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  vec2 i00 = mod(i, period);
  vec2 i10 = mod(i + vec2(1.0, 0.0), period);
  vec2 i01 = mod(i + vec2(0.0, 1.0), period);
  vec2 i11 = mod(i + vec2(1.0, 1.0), period);
  vec2 g00 = clayHash22(i00 + seed) * 2.0 - 1.0;
  vec2 g10 = clayHash22(i10 + seed) * 2.0 - 1.0;
  vec2 g01 = clayHash22(i01 + seed) * 2.0 - 1.0;
  vec2 g11 = clayHash22(i11 + seed) * 2.0 - 1.0;
  float n00 = dot(g00, f);
  float n10 = dot(g10, f - vec2(1.0, 0.0));
  float n01 = dot(g01, f - vec2(0.0, 1.0));
  float n11 = dot(g11, f - vec2(1.0, 1.0));
  return 1.4 * mix(mix(n00, n10, u.x), mix(n01, n11, u.x), u.y);
}

float clayFbm2P(vec2 p, vec2 period, float seed, int octaves) {
  float sum = 0.0;
  float amp = 0.5;
  float norm = 0.0;
  for (int i = 0; i < 6; i++) {
    if (i >= octaves) break;
    sum += amp * clayNoise2P(p, period, seed + float(i) * 13.7);
    norm += amp;
    p *= 2.0;
    period *= 2.0;
    amp *= 0.5;
  }
  return sum / norm;
}

// Voronoi 2D periódico: devolve (distância F1, vetor do pixel ao centro .yz, id da célula em .w).
vec4 clayVoronoiP(vec2 x, float period, float seed, float jitter) {
  vec2 n = floor(x);
  vec2 f = fract(x);
  float md = 8.0;
  vec2 mr = vec2(0.0);
  vec2 mg = vec2(0.0);
  for (int j = -1; j <= 1; j++) {
    for (int i = -1; i <= 1; i++) {
      vec2 g = vec2(float(i), float(j));
      vec2 cell = mod(n + g, vec2(period));
      vec2 o = 0.5 + (clayHash22(cell + seed) - 0.5) * jitter;
      vec2 r = g + o - f;
      float d = dot(r, r);
      if (d < md) {
        md = d;
        mr = r;
        mg = cell;
      }
    }
  }
  return vec4(sqrt(md), mr, clayHash12(mg + seed * 1.37));
}

// Voronoi 2D periódico com distância exata até a borda da célula (método de Inigo Quilez em dois passes).
// Devolve (distância à borda, vetor do pixel ao centro .yz, id da célula em .w).
vec4 clayVoronoiBorderP(vec2 x, float period, float seed, float jitter) {
  vec2 n = floor(x);
  vec2 f = fract(x);
  vec2 mg = vec2(0.0);
  vec2 mr = vec2(0.0);
  float md = 8.0;
  for (int j = -1; j <= 1; j++) {
    for (int i = -1; i <= 1; i++) {
      vec2 g = vec2(float(i), float(j));
      vec2 o = 0.5 + (clayHash22(mod(n + g, vec2(period)) + seed) - 0.5) * jitter;
      vec2 r = g + o - f;
      float d = dot(r, r);
      if (d < md) {
        md = d;
        mr = r;
        mg = g;
      }
    }
  }
  float bd = 8.0;
  for (int j = -2; j <= 2; j++) {
    for (int i = -2; i <= 2; i++) {
      vec2 g = mg + vec2(float(i), float(j));
      vec2 o = 0.5 + (clayHash22(mod(n + g, vec2(period)) + seed) - 0.5) * jitter;
      vec2 r = g + o - f;
      if (dot(mr - r, mr - r) > 1e-5) bd = min(bd, dot(0.5 * (mr + r), normalize(r - mr)));
    }
  }
  return vec4(bd, mr, clayHash12(mod(n + mg, vec2(period)) + seed * 1.37));
}
`;
