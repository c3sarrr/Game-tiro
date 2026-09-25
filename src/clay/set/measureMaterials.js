// Coisas de medir do set (pista de testes; PRU1, PRU15, TMA2, TMA6, TMA12, WRG1, WRG4, WRG11, LDB9 no item 11 do
// moodboard): um material, num lote só, com cinco aparências escolhidas pelo atributo aMeasure = (modo, comprimento,
// largura, espessura) e a cor de cada peça vinda da cor da peça (BatchedMesh.setColorAt). uv em u:
//   0 régua escolar de madeira: veio claro envernizado, escala impressa a partir da borda do bisel (uv.y = 0 no bisel):
//     traços de 1 mm, 5 mm e 1 cm e os números dos centímetros;
//   1 régua de aço: aço escovado ao longo do comprimento, escala gravada e preenchida de preto;
//   2 lâmina da trena: aço laqueado amarelo, traços de milímetro nas duas bordas, número a cada 1 cm (10 u) e vermelho
//     a cada 10 cm (100 u); no metro, o número em branco sobre o retângulo vermelho;
//   3 tábua de crescimento: tinta escura, traço a cada 10 u, maior a cada 50 u, linha inteira e numeral branco a cada
//     100 u (uv.x = altura a partir do chão);
//   4 papel quadriculado de plotter: linha fina a cada 20 u e forte a cada 100 u, metros numerados nas bordas sul e
//     oeste (uv = a partir do canto sudoeste).
// Números com o atlas de dígitos do set (o mesmo do tapete de corte), até quatro dígitos.

import * as THREE from 'three';
import { createSetMaterial } from './setShader.js';

const linear = (hex) => new THREE.Color(hex);

const MEASURE_GLSL = /* glsl */ `
uniform sampler2D uDigits;
uniform sampler2D uWood;
uniform sampler2D uBrushed;
uniform sampler2D uPaperTex;
uniform vec3 uInk;
uniform vec3 uRed;
uniform vec3 uWhite;
uniform vec3 uGridInk;
varying vec4 vMeasure;
// Número inteiro de até 4 dígitos no espaço da letra (x para a direita, y para cima): centrado em x = 0, base em y = 0;
// gh = altura, gw = avanço por dígito (u). A amostra usa o gradiente da coordenada contínua (sem costura de mipmap entre
// dígitos) e acontece sempre — fora do número a máscara zera.
float msNumber(vec2 q, float value, float gh, float gw) {
  float v = floor(value + 0.5);
  float nd = v >= 1000.0 ? 4.0 : (v >= 100.0 ? 3.0 : (v >= 10.0 ? 2.0 : 1.0));
  vec2 g = vec2((q.x + nd * gw * 0.5) / gw, q.y / gh);
  vec2 cont = vec2(g.x * 0.082, g.y);
  float inside = step(0.0, g.x) * step(g.x, nd - 1e-4) * step(0.0, g.y) * step(g.y, 1.0);
  float idx = clamp(floor(g.x), 0.0, nd - 1.0);
  float digit = mod(floor(v / pow(10.0, nd - 1.0 - idx) + 1e-3), 10.0);
  vec2 uv = vec2((digit + 0.09 + fract(g.x) * 0.82) / 10.0, clamp(g.y, 0.0, 1.0));
  return textureGrad(uDigits, uv, dFdx(cont), dFdy(cont)).a * inside;
}
// Traços de escala a partir de uma borda: d = distância até a borda; comprimentos de 1, 5 e 10 u.
float msTicks(float along, float d, float l1, float l5, float l10) {
  float mm = setGridLine(along, 1.0, 0.07) * step(d, l1);
  float mm5 = setGridLine(along, 5.0, 0.09) * step(d, l5);
  float cm = setGridLine(along, 10.0, 0.11) * step(d, l10);
  return max(max(mm * 0.8, mm5 * 0.9), cm);
}
`;

export function measureMaterial(tex, {
  ink = '#15130F', red = '#C8261E', white = '#F2EEE6', grid = '#5E93BF', name = 'medidas',
} = {}) {
  return createSetMaterial({
    name,
    params: {
      color: 0xffffff, roughness: 0.5, metalness: 0, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2,
    },
    uniforms: {
      uDigits: { value: tex.digits },
      uWood: { value: tex.wood },
      uBrushed: { value: tex.brushed },
      uPaperTex: { value: tex.paper },
      uInk: { value: linear(ink) },
      uRed: { value: linear(red) },
      uWhite: { value: linear(white) },
      uGridInk: { value: linear(grid) },
    },
    light: { wrap: 0.3, lift: 0.07 },
    vertexPars: 'attribute vec4 aMeasure;\nvarying vec4 vMeasure;',
    vertex: 'vMeasure = aMeasure;',
    fragPars: MEASURE_GLSL,
    surface: /* glsl */ `
float mode = floor(vMeasure.x + 0.5);
float L = vMeasure.y;
float W = vMeasure.z;
vec2 p = setUv;
vec3 base = diffuseColor.rgb;
vec3 col = base;
vec3 inkCol = uInk;
float ink = 0.0;
mat3 tbn = setCotangentFrame(setN, setP, p);
vec4 wd = texture(uWood, vec2(p.x / 180.0, p.y / 55.0));
vec4 bru = texture(uBrushed, vec2(p.x / 90.0, p.y / 14.0));
vec4 pp = texture(uPaperTex, p / 150.0);
if (mode < 0.5) {
  // Régua escolar: o zero 4 u depois da ponta; números dos centímetros acima dos traços.
  float along = p.x - 4.0;
  float on = step(0.0, along + 0.2) * step(along, L - 7.8) * step(0.3, setN.y);
  ink = msTicks(along, p.y, 3.0, 4.6, 6.6) * on;
  float k = floor(along / 10.0 + 0.5);
  ink = max(ink, msNumber(vec2(along - k * 10.0, p.y - 7.6), k, 3.6, 2.3) * on * step(-0.5, k));
  col = base * (0.84 + 0.26 * wd.b) * (1.0 - wd.a * 0.2);
  setRough += -0.07 + wd.a * 0.1 - ink * 0.05;
  setObjN = normalize(tbn * vec3((wd.rg * 2.0 - 1.0) * 0.25, 1.0));
} else if (mode < 1.5) {
  // Régua de aço: gravação preenchida de preto; o aço escovado reflete o estúdio.
  float along = p.x - 3.0;
  float on = step(0.0, along + 0.2) * step(along, L - 6.0) * step(0.5, setN.y);
  ink = msTicks(along, p.y, 2.6, 4.0, 6.0) * on;
  float k = floor(along / 10.0 + 0.5);
  ink = max(ink, msNumber(vec2(along - k * 10.0, p.y - 7.0), k, 3.2, 2.1) * on * step(-0.5, k));
  col = base * (0.9 + 0.12 * bru.b);
  inkCol = vec3(0.03);
  setMetal += 1.0 - ink;
  setRough += -0.2 + bru.b * 0.12 + bru.a * 0.08 + ink * 0.4;
  setObjN = normalize(tbn * vec3((bru.rg * 2.0 - 1.0) * 0.5, 1.0));
} else if (mode < 2.5) {
  // Trena: traços nas duas bordas; centímetros numerados (menores com 3 dígitos); vermelho a cada 10 cm; no metro o
  // número em branco num retângulo vermelho.
  float along = p.x;
  float top = W - p.y;
  ink = max(msTicks(along, top, 2.8, 4.4, 6.8), msTicks(along, p.y, 2.0, 3.2, 5.0) * 0.9);
  float k = floor(along / 10.0 + 0.5);
  float big = k < 100.0 ? 1.0 : 0.0;
  float gh = mix(5.0, 6.4, big);
  float gw = mix(2.75, 3.4, big);
  float num = msNumber(vec2(along - k * 10.0, p.y - W * 0.5 + gh * 0.5 - 0.6), k, gh, gw) * step(0.5, k);
  float tenth = 1.0 - step(0.5, abs(mod(k, 10.0)));
  float meter = 1.0 - step(0.5, abs(mod(k, 100.0)));
  vec2 box = abs(vec2(along - k * 10.0, p.y - W * 0.5)) - vec2(8.5, 5.2);
  float plate = meter * step(0.5, k) * (1.0 - step(0.0, max(box.x, box.y)));
  col = base * (0.94 + 0.08 * (bru.b - 0.5));
  col = mix(col, uRed, plate);
  vec3 numCol = mix(mix(uInk, uRed, tenth), uWhite, meter);
  col = mix(col, uInk, ink * (1.0 - plate));
  col = mix(col, numCol, num);
  ink = 0.0; // já composto acima (traço preto, número na cor dele)
  setRough += -0.15 + bru.a * 0.05;
  setMetal += 0.05;
  setObjN = normalize(tbn * vec3((bru.rg * 2.0 - 1.0) * 0.12, 1.0));
} else if (mode < 3.5) {
  // Tábua de crescimento: pinceladas na tinta escura; escala branca na borda esquerda de quem olha (uv.y = 0).
  float h = p.x;
  float on = step(0.5, setN.z);
  float t10 = setGridLine(h, 10.0, 0.4) * step(p.y, 9.0);
  float t50 = setGridLine(h, 50.0, 0.5) * step(p.y, 16.0);
  float t100 = setGridLine(h, 100.0, 0.7);
  float k = floor(h / 100.0 + 0.5);
  // Numeral entre os traços da esquerda e as anotações a lápis da direita (layoutTower: 22% da largura à direita).
  float num = msNumber(vec2(p.y - W * 0.39, h - k * 100.0 - 4.0), k * 100.0, 9.0, 5.6) * step(0.5, k);
  ink = max(max(max(t10, t50), t100), num) * on;
  float stroke = clayNoise3(vec3(p.x * 0.012, p.y * 0.3, 2.0)) * 0.5 + 0.5;
  col = base * (0.88 + 0.22 * stroke) * (0.95 + 0.1 * (pp.b - 0.5));
  inkCol = uWhite * (0.94 + 0.06 * (pp.b - 0.5));
  setRough += 0.1 - ink * 0.08;
  setObjN = normalize(tbn * vec3((stroke - 0.5) * 0.12, (pp.g - 0.5) * 0.2, 1.0));
} else {
  // Quadriculado de plotter: linhas finas e fortes; metros na borda sul (0–16) e na oeste (0–10), lidos do sul.
  float fine = max(setGridLine(p.x, 20.0, 0.16), setGridLine(p.y, 20.0, 0.16));
  float strong = max(setGridLine(p.x, 100.0, 0.42), setGridLine(p.y, 100.0, 0.42));
  float kx = floor(p.x / 100.0 + 0.5);
  float ky = floor(p.y / 100.0 + 0.5);
  float south = msNumber(vec2(p.x - kx * 100.0 - 7.0, p.y - 6.0), kx, 9.0, 5.6) * step(p.y, 20.0);
  float west = msNumber(vec2(p.x - 12.0, p.y - ky * 100.0 - 5.0), ky, 9.0, 5.6) * step(p.x, 30.0) * step(0.5, ky);
  ink = max(max(fine * 0.55, strong), max(south, west)) * step(0.5, setN.y);
  inkCol = uGridInk;
  col = base * (0.95 + 0.08 * (pp.b - 0.5)) * (0.97 + 0.05 * pp.a);
  setRough += 0.4;
  setObjN = normalize(tbn * vec3((pp.rg * 2.0 - 1.0) * 0.12, 1.0));
}
diffuseColor.rgb = mix(col, inkCol, clamp(ink, 0.0, 1.0) * 0.95);
`,
  });
}
