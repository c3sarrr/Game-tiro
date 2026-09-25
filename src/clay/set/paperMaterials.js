// Papelão ondulado e fita crepe (docs/art/moodboard.md item 4: SSD4, SSD8, CSD16 / SSD2, SSD14).
//
// Papelão: a geometria (boardGeometry.js) manda o atributo aBoard = (x, y, tipo, através) e aBoardSize:
//   tipo 0 = face (x/y em u na placa)  · tipo 1 = corte transversal às flautas (mostra a onda do miolo)
//   tipo 2 = corte paralelo às flautas (lateral de um tubo). "através" vai de 0 a 1 de um forro ao outro.
// Face: fibras do kraft, pintas de reciclado, manchas, nervuras das flautas marcando o forro por baixo e
// borda gasta/escurecida pelo manuseio. Corte: forros claros, miolo ondulado e vãos escuros.
//
// Fita crepe: uv em unidades de mundo (x ao longo, y através de 0 a largura). Rugas do crepe, poeira grudada
// na cola das bordas, leve translucidez (material fino) e rugosidade alta.
// Lateral do rolo (TRL1, TRL4, TRL10): anéis de camadas pelo raio (a espessura do papel, 0,13 mm, some em
// sub-pixel e vira faixas de tensão do enrolamento), rolo levemente excêntrico, borda externa mais clara, cola
// amarelada e poeira grudada na cola exposta, relevo das camadas que "telescoparam".
// Etiqueta (SSD2, SSD14): a mesma fita com texto de caneta vindo de um atlas em canvas (src/clay/set/labelAtlas.js).

import * as THREE from 'three';
import { PALETTE } from '../../data/palette.js';
import { createSetMaterial } from './setShader.js';

const linear = (hex) => new THREE.Color(hex);

export function cardboardMaterial(tex, { color = PALETTE.cardboard, dark = '#3B2616', flutePitch = 4.2, name = 'papelao' } = {}) {
  const uniforms = {
    uPaper: { value: tex.paper },
    uKraft: { value: linear(color) },
    uKraftDark: { value: linear(dark) },
    uFlutePitch: { value: flutePitch },
    uPaperScale: { value: 120 },
  };
  return createSetMaterial({
    name,
    params: { color: 0xffffff, roughness: 0.86, metalness: 0 },
    uniforms,
    light: { wrap: 0.32, lift: 0.07 },
    vertexPars: 'attribute vec4 aBoard;\nattribute vec2 aBoardSize;\nvarying vec4 vBoard;\nvarying vec2 vBoardSize;',
    vertex: 'vBoard = aBoard;\n  vBoardSize = aBoardSize;',
    fragPars: /* glsl */ `
uniform sampler2D uPaper;
uniform vec3 uKraft;
uniform vec3 uKraftDark;
uniform float uFlutePitch;
uniform float uPaperScale;
varying vec4 vBoard;
varying vec2 vBoardSize;
`,
    surface: /* glsl */ `
float kind = vBoard.z;
vec3 col = uKraft;
if (kind < 0.5) {
  vec2 pc = vBoard.xy / uPaperScale;
  vec4 pt = texture(uPaper, pc);
  float fleck = pt.b - 0.5;
  col *= 0.88 + 0.22 * pt.a;
  col *= 1.0 + fleck * 0.45;
  float phase = 6.2831853 * vBoard.x / uFlutePitch;
  // O forro afunda entre as cristas do miolo; poeira fica nos vales.
  col *= 1.0 - 0.04 * (0.5 + 0.5 * cos(phase));
  float e = min(min(vBoard.x, vBoardSize.x - vBoard.x), min(vBoard.y, vBoardSize.y - vBoard.y));
  float worn = 1.0 - smoothstep(0.0, 7.0, e);
  col = mix(col, col * 0.74, worn * 0.55);
  setRough += worn * 0.08;
  vec2 d = (pt.rg * 2.0 - 1.0) * 0.55 + vec2(sin(phase) * 0.07, 0.0);
  mat3 tbn = setCotangentFrame(setN, setP, vBoard.xy);
  setObjN = normalize(tbn * vec3(d, 1.0));
} else {
  float a = vBoard.w;
  float s = vBoard.x;
  float thick = max(vBoardSize.x, 0.5);
  float liner = 0.11;
  float linerMask = 1.0 - step(liner, a) * step(a, 1.0 - liner);
  vec4 pt = texture(uPaper, vec2(s, a * thick) / uPaperScale);
  if (kind < 1.5) {
    // Corte transversal: onda do miolo entre os forros.
    float wave = 0.5 + 0.34 * sin(6.2831853 * s / uFlutePitch);
    float dm = abs(a - wave) * thick;
    float medium = smoothstep(0.42, 0.18, dm);
    float paper = max(medium, linerMask);
    vec3 voidCol = uKraftDark * (0.45 + 0.9 * clamp(abs(a - wave), 0.0, 0.5));
    col = mix(voidCol, uKraft * (0.98 + 0.12 * (pt.b - 0.5)), paper);
    setRough += (1.0 - paper) * 0.12;
    float slope = cos(6.2831853 * s / uFlutePitch) * 0.34 * 6.2831853 / uFlutePitch * thick;
    vec3 tn = normalize(vec3(medium * slope * 0.25 * sign(a - wave), 0.0, 1.0));
    mat3 tbn = setCotangentFrame(setN, setP, vec2(s, a * thick));
    setObjN = normalize(tbn * tn);
  } else {
    // Corte paralelo: lateral curva de um tubo do miolo entre os forros.
    float tube = sin(3.14159265 * clamp((a - liner) / (1.0 - 2.0 * liner), 0.0, 1.0));
    col = mix(uKraftDark * (0.5 + 0.6 * tube), uKraft * (0.97 + 0.1 * (pt.b - 0.5)), linerMask);
    setRough += (1.0 - linerMask) * 0.1;
  }
}
diffuseColor.rgb = col;
`,
  });
}

export function tapeMaterial(tex, { color = PALETTE.maskingTape, width = 46, name = 'fita-crepe' } = {}) {
  const uniforms = {
    uCrepe: { value: tex.crepe },
    uTapeColor: { value: linear(color) },
    uTapeWidth: { value: width },
  };
  return createSetMaterial({
    name,
    params: { color: 0xffffff, roughness: 0.74, metalness: 0, side: THREE.DoubleSide },
    uniforms,
    light: { wrap: 0.45, lift: 0.08, translucency: 0.4 },
    fragPars: /* glsl */ `
uniform sampler2D uCrepe;
uniform vec3 uTapeColor;
uniform float uTapeWidth;
`,
    surface: /* glsl */ `
vec4 cr = texture(uCrepe, setUv / 30.0);
vec3 col = uTapeColor * (0.95 + 0.1 * (cr.b - 0.5) + 0.04 * (cr.a - 0.5));
float edge = min(setUv.y, uTapeWidth - setUv.y);
col *= 1.0 - 0.2 * (1.0 - smoothstep(0.0, 1.4, edge)); // poeira grudada na cola da borda
diffuseColor.rgb = col;
setRough += (cr.b - 0.5) * 0.12;
mat3 tbn = setCotangentFrame(setN, setP, setUv);
setObjN = normalize(tbn * vec3((cr.rg * 2.0 - 1.0) * 0.9, 1.0));
`,
  });
}

/**
 * Laterais de um rolo de fita (anéis de tapeRoll().sides, eixo Y no espaço do objeto).
 * @param {{inner:number, outer:number}} opts raio interno (onde a fita começa, fora do miolo) e externo, em u
 */
export function tapeSideMaterial(tex, { color = PALETTE.maskingTape, inner = 42, outer = 48, layer = 0.13, name = 'fita-lateral' } = {}) {
  const uniforms = {
    uCrepe: { value: tex.crepe },
    uPaper: { value: tex.paper },
    uTapeColor: { value: linear(color) },
    uRollInner: { value: inner },
    uRollOuter: { value: outer },
    uLayer: { value: layer },
  };
  return createSetMaterial({
    name,
    params: { color: 0xffffff, roughness: 0.8, metalness: 0 },
    uniforms,
    light: { wrap: 0.4, lift: 0.08 },
    fragPars: /* glsl */ `
uniform sampler2D uCrepe;
uniform sampler2D uPaper;
uniform vec3 uTapeColor;
uniform float uRollInner;
uniform float uRollOuter;
uniform float uLayer;
`,
    surface: /* glsl */ `
float ang = atan(setP.z, setP.x);
// Rolo levemente excêntrico (enrolado sob tensão variável): o raio "de camada" oscila com o ângulo.
float rr = length(setP.xz) + 0.35 * cos(ang - 1.3) + 0.12 * sin(2.0 * ang + 0.4);
float t = clamp((rr - uRollInner) / max(uRollOuter - uRollInner, 1e-3), 0.0, 1.0);
// Camadas individuais (0,13 mm): só aparecem de muito perto; somem suavemente quando ficam menores que o pixel.
float fwl = fwidth(rr) / uLayer;
float layers = (0.5 + 0.5 * cos(6.2831853 * rr / uLayer)) * (1.0 - smoothstep(0.25, 0.7, fwl));
// Faixas de tensão do enrolamento: grupos de camadas mais claros/escuros, concêntricos com leve variação angular.
float bands = clayNoise3(vec3(rr * 0.85, cos(ang) * 0.6, sin(ang) * 0.6)) * 0.6
            + clayNoise3(vec3(rr * 2.3, cos(ang) * 1.4, sin(ang) * 1.4 + 3.0)) * 0.4;
vec3 col = uTapeColor * vec3(0.92, 0.88, 0.8); // lateral: papel comprimido + cola amarelada
col *= 1.0 + bands * 0.07 - layers * 0.035;
// Primeiras voltas (junto do miolo) mais escuras e a última volta (borda de fora) mais clara e limpa.
col *= mix(0.86, 1.0, smoothstep(0.0, 0.12, t));
col = mix(col, uTapeColor * 1.04, smoothstep(0.93, 0.995, t) * 0.7);
// Poeira grudada na cola exposta: pontinhos e fiapos escuros (pintas do atlas de papel), mais densos para a
// borda de fora; a última volta, recém-desenrolada, está limpa.
vec4 cr = texture(uCrepe, setP.xz / 22.0 + vec2(0.37, 0.11));
vec4 pt = texture(uPaper, setP.xz / 30.0 + vec2(0.71, 0.53));
float dust = smoothstep(0.42, 0.18, pt.b) * (0.35 + 0.65 * t) * (1.0 - smoothstep(0.96, 1.0, t));
col *= 1.0 - dust * 0.45;
col *= 0.97 + 0.06 * (cr.b - 0.5);
diffuseColor.rgb = col;
setRough += dust * 0.08 - smoothstep(0.93, 0.995, t) * 0.06;
// Relevo das camadas que escorregaram (telescopagem): a normal inclina no sentido radial com a derivada das faixas.
vec2 radial = normalize(setP.xz + vec2(1e-4));
float slope = clayNoise3(vec3(rr * 0.85 + 0.05, cos(ang) * 0.6, sin(ang) * 0.6))
            - clayNoise3(vec3(rr * 0.85 - 0.05, cos(ang) * 0.6, sin(ang) * 0.6));
vec3 tilt = vec3(radial.x, 0.0, radial.y) * slope * 3.2;
setObjN = normalize(setN + tilt * sign(setN.y) + vec3((cr.r - 0.5) * 0.08, 0.0, (cr.g - 0.5) * 0.08));
`,
  });
}

/**
 * Etiqueta de fita crepe escrita a caneta. O texto vem de um atlas em canvas (labelAtlas.js); `rect` é a
 * célula da etiqueta no atlas (u0, v0, largura, altura em 0..1) e `length`/`width` o tamanho da tira em u.
 * O texto ocupa a tira inteira menos `margin` nas pontas, centrado na largura.
 */
export function tapeLabelMaterial(tex, {
  atlas, rect, length, width = 19, margin = 7, textHeight = 10.5, color = PALETTE.maskingTape, ink = '#1C2238', name = 'etiqueta',
}) {
  const uniforms = {
    uCrepe: { value: tex.crepe },
    uLabelAtlas: { value: atlas },
    uLabelRect: { value: new THREE.Vector4(rect[0], rect[1], rect[2], rect[3]) },
    uLabelSize: { value: new THREE.Vector4(length, width, margin, textHeight) },
    uTapeColor: { value: linear(color) },
    uInk: { value: linear(ink) },
  };
  return createSetMaterial({
    name,
    params: { color: 0xffffff, roughness: 0.74, metalness: 0, side: THREE.DoubleSide },
    uniforms,
    light: { wrap: 0.45, lift: 0.08, translucency: 0.4 },
    fragPars: /* glsl */ `
uniform sampler2D uCrepe;
uniform sampler2D uLabelAtlas;
uniform vec4 uLabelRect;
uniform vec4 uLabelSize;
uniform vec3 uTapeColor;
uniform vec3 uInk;
`,
    surface: /* glsl */ `
vec4 cr = texture(uCrepe, setUv / 30.0);
vec3 col = uTapeColor * (0.95 + 0.1 * (cr.b - 0.5) + 0.04 * (cr.a - 0.5));
float edge = min(setUv.y, uLabelSize.y - setUv.y);
col *= 1.0 - 0.2 * (1.0 - smoothstep(0.0, 1.4, edge));
// Texto: faixa central da tira com a altura do texto; fora dela, só fita.
vec2 box = vec2(uLabelSize.x - 2.0 * uLabelSize.z, uLabelSize.w);
vec2 q = vec2((setUv.x - uLabelSize.z) / box.x, (setUv.y - (uLabelSize.y - box.y) * 0.5) / box.y);
float ink = 0.0;
if (q.x > 0.0 && q.x < 1.0 && q.y > 0.0 && q.y < 1.0) {
  vec2 auv = uLabelRect.xy + q * uLabelRect.zw;
  ink = texture(uLabelAtlas, auv).a;
}
// A tinta assenta nas cristas do crepe e falha um pouco nos vales; a caneta deixa o traço mais escuro e liso.
ink = clamp(ink * 1.35, 0.0, 1.0) * (0.86 + 0.14 * smoothstep(0.3, 0.7, cr.b));
col = mix(col, uInk, ink * 0.96);
diffuseColor.rgb = col;
setRough += (cr.b - 0.5) * 0.12 - ink * 0.12;
mat3 tbn = setCotangentFrame(setN, setP, setUv);
setObjN = normalize(tbn * vec3((cr.rg * 2.0 - 1.0) * 0.9 * (1.0 - ink * 0.5), 1.0));
`,
  });
}
