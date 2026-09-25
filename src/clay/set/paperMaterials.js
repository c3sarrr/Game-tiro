// Papelão ondulado e fita crepe (docs/art/moodboard.md item 4: SSD4, SSD8, CSD16 / SSD2, SSD14).
//
// Papelão (simples, de parede dupla ou de uma face): a geometria (boardGeometry.js) manda o atributo aBoard =
// (x, y, tipo, através) e aBoardSize:
//   tipo 0 = face (x/y em u na placa)  · tipo 1 = corte transversal às flautas (mostra a onda do miolo)
//   tipo 2 = corte paralelo às flautas (lateral de um tubo). "através" vai de 0 a 1 de um forro ao outro.
//   tipo 3 = face de tubo enrolado em espiral (boardGeometry.woundTube): x = arco, y = altura, w = distância até a
//   borda; aBoardSize = (circunferência, passo da hélice).
// Face: fibras do kraft, pintas de reciclado, manchas, nervuras das flautas marcando o forro por baixo e
// borda gasta/escurecida pelo manuseio (placas recortadas mandam a distância até a borda pronta em aBoard.w, com
// aBoardSize negativo). Corte: forros claros, miolo ondulado e vãos escuros. A cor da peça tinge (lote do BatchedMesh).
//
// Fita crepe: uv em unidades de mundo (x ao longo, y através de 0 a largura). Rugas do crepe, poeira grudada
// na cola das bordas, leve translucidez (material fino) e rugosidade alta. Com `atlas` (a fita da pista, num lote só),
// a cor de cada tira vem da cor da peça e o texto de caneta das etiquetas vem por atributo (aTapeLabel = célula no
// atlas, aTapeBox = comprimento, largura, margem e altura do texto) — fitas e etiquetas no mesmo desenho.
// Lateral do rolo (TRL1, TRL4, TRL10): anéis de camadas pelo raio (a espessura do papel, 0,13 mm, some em
// sub-pixel e vira faixas de tensão do enrolamento), rolo levemente excêntrico, borda externa mais clara, cola
// amarelada e poeira grudada na cola exposta, relevo das camadas que "telescoparam".
// Etiqueta (SSD2, SSD14): a mesma fita com texto de caneta vindo de um atlas em canvas (src/clay/set/labelAtlas.js).

import * as THREE from 'three';
import { PALETTE } from '../../data/palette.js';
import { createSetMaterial } from './setShader.js';

const linear = (hex) => new THREE.Color(hex);

/**
 * Papelão ondulado. `double`: parede dupla (duas ondas e o forro do meio no corte — caixas grandes da cerca e painéis do
 * zigue-zague, COC4/CBT15). `singleFace`: papelão de uma face (CBT12, COC15) — o lado −Z da placa é o miolo ondulado
 * sem forro, com as ondas à mostra; no corte só o forro da frente.
 */
export function cardboardMaterial(tex, {
  color = PALETTE.cardboard, dark = '#3B2616', flutePitch = 4.2, double = false, singleFace = false, name = 'papelao',
} = {}) {
  const uniforms = {
    uPaper: { value: tex.paper },
    uKraft: { value: linear(color) },
    uKraftDark: { value: linear(dark) },
    uFlutePitch: { value: flutePitch },
    uPaperScale: { value: 120 },
    uDoubleWall: { value: double ? 1 : 0 },
    uSingleFace: { value: singleFace ? 1 : 0 },
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
uniform float uDoubleWall;
uniform float uSingleFace;
varying vec4 vBoard;
varying vec2 vBoardSize;
`,
    surface: /* glsl */ `
float kind = vBoard.z;
vec3 col = uKraft;
// Ondas de 4 u somem suavemente quando ficam menores que uns 4 px na tela (de longe viram moiré). Derivada fora dos
// ramos: o tipo muda de face para face.
float flutesAA = 1.0 - smoothstep(0.8, 2.2, fwidth(6.2831853 * vBoard.x / uFlutePitch));
if (kind < 0.5 || kind > 2.5) {
  // Face. Tipo 3 = tubo enrolado em espiral (woundTube): sem flautas, com a emenda helicoidal da tira de papel.
  bool wound = kind > 2.5;
  vec2 pc = vBoard.xy / uPaperScale;
  vec4 pt = texture(uPaper, pc);
  float fleck = pt.b - 0.5;
  float phase = 6.2831853 * vBoard.x / uFlutePitch;
  float ribs = wound ? 0.0 : flutesAA;
  mat3 tbn = setCotangentFrame(setN, setP, vBoard.xy);
  if (!wound && uSingleFace > 0.5 && setN.z < -0.5) {
    // Miolo à mostra: ondas altas, vales escuros (a luz não entra), papel do miolo mais cinza que o forro.
    float crest = mix(0.5, 0.5 + 0.5 * cos(phase), flutesAA);
    col = uKraft * vec3(0.92, 0.88, 0.82) * (0.58 + 0.42 * crest) * (0.92 + 0.18 * fleck);
    setRough += 0.05;
    setObjN = normalize(tbn * vec3(sin(phase) * 1.15 * flutesAA + (pt.r - 0.5) * 0.4, (pt.g - 0.5) * 0.4, 1.0));
  } else {
    col *= 0.88 + 0.22 * pt.a;
    col *= 1.0 + fleck * 0.45;
    // O forro afunda entre as cristas do miolo; poeira fica nos vales.
    col *= 1.0 - 0.04 * ribs * (0.5 + 0.5 * cos(phase));
    // Distância até a borda gasta: pelo retângulo da placa ou pronta no atributo (recortes e tubo: aBoardSize < 0).
    float e = (wound || vBoardSize.x < 0.0) ? vBoard.w
      : min(min(vBoard.x, vBoardSize.x - vBoard.x), min(vBoard.y, vBoardSize.y - vBoard.y));
    float worn = 1.0 - smoothstep(0.0, 7.0, e);
    col = mix(col, col * 0.74, worn * 0.55);
    setRough += worn * 0.08;
    vec2 d = (pt.rg * 2.0 - 1.0) * 0.55 + vec2(sin(phase) * 0.07 * ribs, 0.0);
    if (wound) {
      // Emenda: a borda da tira de cima assenta sobre a de baixo (degrau fino e um pouco mais escuro); cada volta de
      // papel com o seu tom (lotes de papel).
      float s = (vBoard.y - vBoard.x * vBoardSize.y / vBoardSize.x) / vBoardSize.y;
      float fs = fract(s);
      float gap = min(fs, 1.0 - fs) * vBoardSize.y;
      float fw = max(fwidth(gap), 1e-3);
      float seam = 1.0 - smoothstep(0.0, 0.7 + fw, gap);
      col *= (1.0 - seam * 0.25) * (1.0 + (clayHash12(vec2(floor(s + 0.5), 3.0)) - 0.5) * 0.07);
      d.y += seam * 0.7 * (fs < 0.5 ? 1.0 : -1.0);
      setRough += seam * 0.05;
    }
    setObjN = normalize(tbn * vec3(d, 1.0));
  }
} else {
  float a = vBoard.w;
  float s = vBoard.x;
  float thick = max(vBoardSize.x, 0.5);
  // Parede dupla: duas camadas de miolo (a de cima com a onda defasada) e o forro do meio.
  float cells = uDoubleWall > 0.5 ? 2.0 : 1.0;
  float aa = fract(a * cells - 1e-4);
  float layer = floor(a * cells - 1e-4);
  float liner = 0.11 * cells;
  float front = 1.0 - step(liner, aa) * step(aa, 1.0 - liner);
  // Uma face: só o forro da frente (através = 1); o de trás não existe.
  float linerMask = uSingleFace > 0.5 ? step(1.0 - liner, a) : front;
  vec4 pt = texture(uPaper, vec2(s, a * thick) / uPaperScale);
  if (kind < 1.5) {
    // Corte transversal: onda do miolo entre os forros.
    float wave = 0.5 + 0.34 * sin(6.2831853 * s / uFlutePitch + layer * 3.14159265);
    float dm = abs(aa - wave) * thick / cells;
    float medium = smoothstep(0.42, 0.18, dm);
    float paper = max(medium, linerMask);
    vec3 voidCol = uKraftDark * (0.45 + 0.9 * clamp(abs(aa - wave), 0.0, 0.5));
    col = mix(voidCol, uKraft * (0.98 + 0.12 * (pt.b - 0.5)), paper);
    setRough += (1.0 - paper) * 0.12;
    float slope = cos(6.2831853 * s / uFlutePitch + layer * 3.14159265) * 0.34 * 6.2831853 / uFlutePitch * thick / cells;
    vec3 tn = normalize(vec3(medium * slope * 0.25 * sign(aa - wave), 0.0, 1.0));
    mat3 tbn = setCotangentFrame(setN, setP, vec2(s, a * thick));
    setObjN = normalize(tbn * tn);
  } else {
    // Corte paralelo: lateral curva de um tubo do miolo entre os forros.
    float tube = sin(3.14159265 * clamp((aa - liner) / (1.0 - 2.0 * liner), 0.0, 1.0));
    col = mix(uKraftDark * (0.5 + 0.6 * tube), uKraft * (0.97 + 0.1 * (pt.b - 0.5)), linerMask);
    setRough += (1.0 - linerMask) * 0.1;
  }
}
// A cor da peça (branco sem lote; no BatchedMesh, o tom de cada caixa) tinge o papelão.
diffuseColor.rgb = col * diffuseColor.rgb;
`,
  });
}

const TAPE_SURFACE = /* glsl */ `
vec4 cr = texture(uCrepe, setUv / 30.0);
vec3 col = uTapeColor * (0.95 + 0.1 * (cr.b - 0.5) + 0.04 * (cr.a - 0.5));
float edge = min(setUv.y, uTapeWidth - setUv.y);
col *= 1.0 - 0.2 * (1.0 - smoothstep(0.0, 1.4, edge)); // poeira grudada na cola da borda
diffuseColor.rgb = col * diffuseColor.rgb;
setRough += (cr.b - 0.5) * 0.12;
mat3 tbn = setCotangentFrame(setN, setP, setUv);
setObjN = normalize(tbn * vec3((cr.rg * 2.0 - 1.0) * 0.9, 1.0));
`;

// Fita da pista (num lote só): largura, etiqueta e cor por tira. A amostra do atlas fica fora de desvio (derivadas
// do mipmap valem em todo o quadrado de pixels) e só conta dentro da caixa do texto.
const LABELED_TAPE_SURFACE = /* glsl */ `
vec4 cr = texture(uCrepe, setUv / 30.0);
vec3 col = uTapeColor * (0.95 + 0.1 * (cr.b - 0.5) + 0.04 * (cr.a - 0.5));
float edge = min(setUv.y, vTapeBox.y - setUv.y);
col *= 1.0 - 0.2 * (1.0 - smoothstep(0.0, 1.4, edge));
col *= diffuseColor.rgb;
vec2 box = vec2(max(vTapeBox.x - 2.0 * vTapeBox.z, 1e-3), max(vTapeBox.w, 1e-3));
vec2 q = vec2((setUv.x - vTapeBox.z) / box.x, (setUv.y - (vTapeBox.y - box.y) * 0.5) / box.y);
vec2 inside = step(vec2(0.0), q) * step(q, vec2(1.0));
float ink = texture(uLabelAtlas, vTapeLabel.xy + clamp(q, 0.0, 1.0) * vTapeLabel.zw).a;
ink *= inside.x * inside.y * step(1e-6, vTapeLabel.z);
// A tinta assenta nas cristas do crepe e falha um pouco nos vales; a caneta deixa o traço mais escuro e liso.
ink = clamp(ink * 1.35, 0.0, 1.0) * (0.86 + 0.14 * smoothstep(0.3, 0.7, cr.b));
diffuseColor.rgb = mix(col, uInk, ink * 0.96);
setRough += (cr.b - 0.5) * 0.12 - ink * 0.12;
mat3 tbn = setCotangentFrame(setN, setP, setUv);
setObjN = normalize(tbn * vec3((cr.rg * 2.0 - 1.0) * 0.9 * (1.0 - ink * 0.5), 1.0));
`;

/**
 * Fita crepe. Sem `atlas`: uma cor (`color`) e uma largura (`width`) para o material inteiro. Com `atlas` (o atlas de
 * etiquetas do mapa, labelAtlas.js): cor, largura e etiqueta por tira — a geometria traz aTapeLabel (célula do texto no
 * atlas, zeros = só fita) e aTapeBox (comprimento, largura, margem nas pontas, altura do texto) e a cor da peça pinta
 * a tira (`color` fica branco). Deitada sobre outras superfícies: desloca a profundidade para não brigar com elas.
 */
export function tapeMaterial(tex, { color = PALETTE.maskingTape, width = 46, atlas = null, ink = '#1C2238', name = 'fita-crepe' } = {}) {
  const uniforms = {
    uCrepe: { value: tex.crepe },
    uTapeColor: { value: linear(color) },
    uTapeWidth: { value: width },
  };
  const params = { color: 0xffffff, roughness: 0.74, metalness: 0, side: THREE.DoubleSide };
  if (atlas) {
    uniforms.uLabelAtlas = { value: atlas };
    uniforms.uInk = { value: linear(ink) };
    Object.assign(params, { polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -4 });
  }
  return createSetMaterial({
    name,
    params,
    uniforms,
    light: { wrap: 0.45, lift: 0.08, translucency: 0.4 },
    vertexPars: atlas ? 'attribute vec4 aTapeLabel;\nattribute vec4 aTapeBox;\nvarying vec4 vTapeLabel;\nvarying vec4 vTapeBox;' : '',
    vertex: atlas ? 'vTapeLabel = aTapeLabel;\n  vTapeBox = aTapeBox;' : '',
    fragPars: /* glsl */ `
uniform sampler2D uCrepe;
uniform vec3 uTapeColor;
uniform float uTapeWidth;
${atlas ? 'uniform sampler2D uLabelAtlas;\nuniform vec3 uInk;\nvarying vec4 vTapeLabel;\nvarying vec4 vTapeBox;' : ''}
`,
    surface: atlas ? LABELED_TAPE_SURFACE : TAPE_SURFACE,
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
