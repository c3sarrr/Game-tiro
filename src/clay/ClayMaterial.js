// ClayMaterial — o shader da massinha (seção 0.13; decisões e referências em docs/art/moodboard.md, item 1).
// MeshPhysicalMaterial + onBeforeCompile:
//  - Boil de stop-motion: deslocamento de vértice por ruído 3D cuja seed muda a cada pose (1/12 s).
//  - Digitais e marcas de ferramenta: atlas procedurais em triplanar no espaço do objeto (grudam na peça),
//    mais fortes em áreas "tocadas" (atributo aTouch); em objetos tocados (bonecos) tremem por pose.
//  - Especular em duas camadas: base fosca + clearcoat como filme úmido (massa seca ↔ fresca).
//  - Subsurface falso: wrap lighting + faixa de terminador na cor saturada da própria massa + translucidez
//    de borda em contraluz. "Piso" de sombra saturado: massinha nunca fica preta.
//  - Costuras (aSeam) e sulcos escurecem puxando para o tom saturado; fiapos/pontinhos opcionais.
//  - Skins procedurais (src/data/claySkins.js) por define.
//  - Impressão (opcional, define CLAY_IMPRINT): textura de relevo na face de cima — R = fundo da marca, G = lábio de
//    massa empurrada, B = marcas do rolo — mapeada pelo XZ do objeto; desloca a normal (4 amostras) e escurece e alisa o
//    fundo. Letras carimbadas e furinhos das placas da pista (3.3); as pegadas da 3.5 vêm pelo mesmo caminho.

import * as THREE from 'three';
import { NOISE_GLSL } from './glsl/noise.js';
import { SKINS_GLSL } from './glsl/skins.js';
import { clayGlobals, clayFlags, registerClayMaterial, unregisterClayMaterial } from './claySystem.js';
import { CLAY_SKINS } from '../data/claySkins.js';
import { hashString } from '../core/rng.js';
import { studioGlobals } from '../render/studioGlobals.js';
import { STUDIO_BRDF_GLSL } from '../render/glsl/studioLight.js';
import { objectSpaceVaryings, objectSpaceVertex, TRIPLANAR_GLSL } from '../render/glsl/objectSpace.js';

let autoSeed = 0;

/**
 * Unidades de mundo por repetição dos atlas (10 u = 1 cm na miniatura). O atlas de digitais tem 6×6 células:
 * com 96 u por repetição cada almofada fica com 13–19 u (a ponta do dedo do animador num boneco de 7,2 cm —
 * FPC14, CLF17) e os sulcos com ~0,45–0,6 u. Golpes de espátula: 4×4 células em 96 u → 13–20 u de comprimento.
 */
export const FINGERPRINT_TILE = 96;
export const TOOL_TILE = 96;

const VERT_PARS = /* glsl */ `
uniform float uClayBoilAmp;
uniform float uClayBoilFreq;
uniform float uClaySeed;
uniform vec4 uClayPoseRand;
attribute float aTouch;
attribute float aSeam;
${objectSpaceVaryings('Clay')}
varying float vClayTouch;
varying float vClaySeam;
${NOISE_GLSL}
`;

const VERT_BOIL = /* glsl */ `
#include <begin_vertex>
#ifdef CLAY_BOIL
{
  vec3 bp = position * uClayBoilFreq + uClayPoseRand.xyz * 97.0 + vec3(uClaySeed);
  #ifdef USE_INSTANCING
    bp += instanceMatrix[3].xyz * 0.0173;
  #endif
  float b = clayNoise3(bp) * 0.7 + clayNoise3(bp * 2.31 + 11.0) * 0.3;
  transformed += normal * (b * uClayBoilAmp);
}
#endif
`;

// Eixos do objeto no espaço de visão (converte a normal triplanar do objeto em normal de visão) + atributos
// de toque e costura do kit (src/render/glsl/objectSpace.js).
const VERT_AXES = objectSpaceVertex('Clay', 'vClayTouch = aTouch;\n  vClaySeam = aSeam;');

const FRAG_PARS = /* glsl */ `
uniform sampler2D uClayFpAtlas;
uniform sampler2D uClayToolAtlas;
uniform float uClayFpStrength;
uniform float uClayFpScale;
uniform float uClayToolStrength;
uniform float uClayToolScale;
uniform float uClayTouched;
uniform float uClaySeed;
uniform float uClayLint;
uniform vec3 uClayLintColor;
uniform vec4 uClayPoseRand;
uniform float uClayWrap;
uniform float uClaySSS;
uniform vec3 uClaySSSTint;
uniform float uClayRim;
uniform float uClayShadowLift;
uniform vec3 uClayColorB;
uniform vec3 uClayColorC;
uniform vec4 uClaySkinParams;
uniform vec4 uClayProbe;
#ifdef CLAY_IMPRINT
uniform sampler2D uClayImprint;
uniform vec4 uClayImprintRect;
uniform vec3 uClayImprintDepth;
uniform vec2 uClayImprintTexel;
#endif
float clayImprintMask = 0.0;
${objectSpaceVaryings('Clay')}
varying float vClayTouch;
varying float vClaySeam;
// Normal da FORMA (vértice, sem digitais/marcas), em espaço de visão: o wrap e o subsurface falso usam ela.
vec3 clayGeomN = vec3(0.0, 0.0, 1.0);
${NOISE_GLSL}
${SKINS_GLSL}
${TRIPLANAR_GLSL}
vec2 clayDecode(vec2 rg) {
  return rg * 2.0 - 1.0;
}
vec3 clayScatterColor(vec3 albedo) {
  return claySaturate(albedo, 1.55) * uClaySSSTint;
}
`;

// Amostragem triplanar + albedo (skin, cavidade, fiapos). Roda logo após <color_fragment>.
const FRAG_SAMPLE = /* glsl */ `
#include <color_fragment>
vec3 clayN = normalize(vClayNrm);
vec3 clayObjN = clayN;
vec4 clayFp = vec4(0.5, 0.5, 0.0, 0.0);
vec4 clayTool = vec4(0.5, 0.5, 0.0, 0.0);
float clayFpAmt = 0.0;
vec3 clayEmission = vec3(0.0);
#ifdef CLAY_FINGERPRINTS
{
  vec3 w = osTriWeights(clayN);
  vec3 sgn = vec3(clayN.x < 0.0 ? -1.0 : 1.0, clayN.y < 0.0 ? -1.0 : 1.0, clayN.z < 0.0 ? -1.0 : 1.0);
  // Objeto tocado: o padrão desliza ~0,5 u por pose (cerca de um sulco) — a textura "ferve" como massa que o
  // animador remodelou entre duas fotos, sem piscar (slamatron).
  vec2 jit = (uClayPoseRand.xy - 0.5) * 0.006 * uClayTouched;
  vec3 pf = vClayPos * uClayFpScale + uClaySeed * 0.37;
  vec2 uvX = vec2(pf.z * sgn.x, pf.y);
  vec2 uvY = vec2(pf.x * sgn.y, pf.z);
  vec2 uvZ = vec2(-pf.x * sgn.z, pf.y);
  vec4 fx = texture(uClayFpAtlas, uvX + jit);
  vec4 fy = texture(uClayFpAtlas, uvY + jit);
  vec4 fz = texture(uClayFpAtlas, uvZ + jit);
  if (uClayTouched > 0.5) {
    // Peça muito manuseada (bonecos, armas, a placa da vitrine): segunda camada de toques — o mesmo atlas girado
    // 90° e deslocado, por cima da primeira onde a máscara dela existe (digitais sobrepostas, CLT1, FPC9).
    // Mesma normal do atlas: o giro de 90° troca os eixos e o sinal da inclinação (x' = -y, y' = x).
    vec4 gx = texture(uClayFpAtlas, vec2(-uvX.y, uvX.x) + 0.41 + jit);
    vec4 gy = texture(uClayFpAtlas, vec2(-uvY.y, uvY.x) + 0.41 + jit);
    vec4 gz = texture(uClayFpAtlas, vec2(-uvZ.y, uvZ.x) + 0.41 + jit);
    gx.rg = vec2(gx.g, 1.0 - gx.r);
    gy.rg = vec2(gy.g, 1.0 - gy.r);
    gz.rg = vec2(gz.g, 1.0 - gz.r);
    fx = mix(fx, gx, gx.a);
    fy = mix(fy, gy, gy.a);
    fz = mix(fz, gz, gz.a);
  }
  vec3 pt = vClayPos * uClayToolScale + uClaySeed * 0.61;
  vec4 tx = texture(uClayToolAtlas, vec2(pt.z * sgn.x, pt.y));
  vec4 ty = texture(uClayToolAtlas, vec2(pt.x * sgn.y, pt.z));
  vec4 tz = texture(uClayToolAtlas, vec2(-pt.x * sgn.z, pt.y));
  clayFp = fx * w.x + fy * w.y + fz * w.z;
  clayTool = tx * w.x + ty * w.y + tz * w.z;
  clayFpAmt = uClayFpStrength * (0.55 + 0.45 * clamp(vClayTouch, 0.0, 1.0));
  vec3 tnX = vec3(clayDecode(fx.rg) * clayFpAmt + clayDecode(tx.rg) * uClayToolStrength, 1.0);
  vec3 tnY = vec3(clayDecode(fy.rg) * clayFpAmt + clayDecode(ty.rg) * uClayToolStrength, 1.0);
  vec3 tnZ = vec3(clayDecode(fz.rg) * clayFpAmt + clayDecode(tz.rg) * uClayToolStrength, 1.0);
  tnX.x *= sgn.x;
  tnY.x *= sgn.y;
  tnZ.x *= -sgn.z;
  // Mistura "whiteout" (Ben Golus) no espaço do objeto.
  tnX = vec3(tnX.xy + clayN.zy, abs(tnX.z) * clayN.x);
  tnY = vec3(tnY.xy + clayN.xz, abs(tnY.z) * clayN.y);
  tnZ = vec3(tnZ.xy + clayN.xy, abs(tnZ.z) * clayN.z);
  clayObjN = normalize(tnX.zyx * w.x + tnY.xzy * w.y + tnZ.xyz * w.z);
}
#endif
diffuseColor.rgb = claySkinColor(vClayPos, diffuseColor.rgb, uClayColorB, uClayColorC, uClaySkinParams, clayEmission, uClayPoseRand.w);
#if CLAY_SKIN == 2
  // Floco de glitter: micro-espelho deitado na massa (amassar alinha os flocos com a superfície: inclinação
  // típica ~15°, até ~25°); a luz decide onde ele cintila.
  clayObjN = normalize(mix(clayObjN, normalize(clayObjN + claySkinFlakeN * 0.3), claySkinFlake));
#endif
{
  float cav = clamp(clayFp.b * clayFpAmt * 0.9 + vClaySeam * 0.85, 0.0, 1.0);
  diffuseColor.rgb = mix(diffuseColor.rgb, clayDeepen(diffuseColor.rgb), cav * 0.42);
  // Micro-oclusão dos sulcos da digital (~0,06 mm de fundo a cada 0,5 mm): recebem menos luz de todas as
  // direções, então o desenho aparece até sob luz cruzada; de longe o mipmap vira um leve escurecido do toque.
  diffuseColor.rgb *= 1.0 - clamp(clayFp.b * clayFpAmt, 0.0, 1.0) * 0.16;
  // Atlas de ferramenta, canal A: fiapo de tecido (≈1, claro) ou poeira (≈0,5, escura).
  float fiber = smoothstep(0.62, 0.9, clayTool.a);
  float dust = smoothstep(0.2, 0.42, clayTool.a) * (1.0 - smoothstep(0.55, 0.62, clayTool.a));
  diffuseColor.rgb = mix(diffuseColor.rgb, uClayLintColor, fiber * uClayLint);
  diffuseColor.rgb *= 1.0 - dust * uClayLint * 0.6;
}
#ifdef CLAY_IMPRINT
{
  // uv da impressão pelo XZ do objeto (retângulo com largura negativa = espelhado); só a face de cima recebe.
  vec2 iuv = (vClayPos.xz - uClayImprintRect.xy) / uClayImprintRect.zw;
  float top = smoothstep(0.6, 0.9, clayN.y) * step(0.0, iuv.x) * step(iuv.x, 1.0) * step(0.0, iuv.y) * step(iuv.y, 1.0);
  vec3 hw = vec3(-uClayImprintDepth.x, uClayImprintDepth.y, uClayImprintDepth.z);
  vec2 tx = uClayImprintTexel;
  vec4 c0 = texture(uClayImprint, iuv);
  float hL = dot(texture(uClayImprint, iuv - vec2(tx.x, 0.0)).rgb, hw);
  float hR = dot(texture(uClayImprint, iuv + vec2(tx.x, 0.0)).rgb, hw);
  float hD = dot(texture(uClayImprint, iuv - vec2(0.0, tx.y)).rgb, hw);
  float hU = dot(texture(uClayImprint, iuv + vec2(0.0, tx.y)).rgb, hw);
  // Diferença central em u do objeto (o sinal do retângulo cuida do espelhamento).
  float dhdx = (hR - hL) / (2.0 * uClayImprintRect.z * tx.x);
  float dhdz = (hU - hD) / (2.0 * uClayImprintRect.w * tx.y);
  clayObjN = normalize(clayObjN + vec3(-dhdx, 0.0, -dhdz) * top);
  // Fundo da marca: massa comprimida, mais escura e mais lisa (o carimbo alisa); o lábio pega mais luz.
  clayImprintMask = c0.r * top;
  diffuseColor.rgb = mix(diffuseColor.rgb, clayDeepen(diffuseColor.rgb), clayImprintMask * 0.35);
  diffuseColor.rgb *= 1.0 + c0.g * top * 0.04;
}
#endif
`;

const FRAG_ROUGHNESS = /* glsl */ `
#include <roughnessmap_fragment>
roughnessFactor = clamp(roughnessFactor + clayFp.b * clayFpAmt * 0.12 - clayTool.b * 0.08 + vClaySeam * 0.1, 0.25, 1.0);
roughnessFactor = mix(roughnessFactor, 0.16, claySkinFlake);
roughnessFactor = clamp(roughnessFactor - clayImprintMask * 0.18, 0.2, 1.0);
`;

const FRAG_METALNESS = /* glsl */ `
#include <metalnessmap_fragment>
// Floco holográfico: meio espelho, meio pigmento (o pontinho aparece também sob luz difusa, GPD1).
metalnessFactor = mix(metalnessFactor, 0.6, claySkinFlake);
`;

const FRAG_NORMAL = /* glsl */ `
#include <normal_fragment_maps>
clayGeomN = normal;
#if defined(CLAY_FINGERPRINTS) || CLAY_SKIN == 2 || defined(CLAY_IMPRINT)
  normal = normalize(vClayAx * clayObjN.x + vClayAy * clayObjN.y + vClayAz * clayObjN.z);
  #ifdef DOUBLE_SIDED
    normal *= faceDirection;
  #endif
#endif
`;

const FRAG_CLEARCOAT_NORMAL = /* glsl */ `
#include <clearcoat_normal_fragment_maps>
#ifdef USE_CLEARCOAT
  clearcoatNormal = normalize(mix(clearcoatNormal, normal, 0.6));
#endif
`;

const FRAG_EMISSIVE = /* glsl */ `
#include <emissivemap_fragment>
totalEmissiveRadiance += clayEmission;
`;

const FRAG_MATERIAL = /* glsl */ `
#include <lights_physical_fragment>
#ifdef USE_CLEARCOAT
  material.clearcoat *= 0.55 + 0.45 * clayTool.b;
#endif
`;

// Luz direta da massinha: difuso com wrap, especular GGX normal, clearcoat úmido, subsurface falso.
// O espalhamento dentro da plasticina tem alcance curto (fração de milímetro): ele amolece o terminador da FORMA
// (wrap e faixa saturada pela normal geométrica), mas não apaga o relevo fino. Digitais e marcas de ferramenta
// entram como diferença de Lambert sobre o wrap — com o wrap aplicado nelas, metade do contraste sumia e
// qualquer luz cruzada apagava as digitais (FPC9, FPC14, CLT1).
const FRAG_LIGHTING = /* glsl */ `
#include <lights_physical_pars_fragment>
${STUDIO_BRDF_GLSL}
void RE_Direct_Clay(const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal,
    const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material,
    inout ReflectedLight reflectedLight) {
  float NL = dot(geometryNormal, directLight.direction);
  float dotNL = saturate(NL);
  float NLg = dot(clayGeomN, directLight.direction);
  float dotNLg = saturate(NLg);
  float wrapNLg = saturate((NLg + uClayWrap) / (1.0 + uClayWrap));
  float wrapNL = max(wrapNLg + dotNL - dotNLg, 0.0);
  vec3 irradiance = dotNL * directLight.color;
  #ifdef USE_CLEARCOAT
    // Filme úmido: lóbulo alargado pelo tamanho da softbox (reflexo largo e suave, não ponto de lâmpada).
    float dotNLcc = saturate(dot(geometryClearcoatNormal, directLight.direction));
    clearcoatSpecularDirect += dotNLcc * directLight.color * studioGGX(directLight.direction, geometryViewDir,
      geometryClearcoatNormal, material.clearcoatF0, material.clearcoatF90, material.clearcoatRoughness);
  #endif
  vec3 specularBRDF = studioGGX(directLight.direction, geometryViewDir, geometryNormal,
    material.specularColorBlended, material.specularF90, material.roughness);
  reflectedLight.directSpecular += irradiance * specularBRDF * material.multiScatteringCompensation;
  vec3 halfDir = normalize(directLight.direction + geometryViewDir);
  float dotVH = saturate(dot(geometryViewDir, halfDir));
  vec3 F = F_Schlick(material.specularColor, material.specularF90, dotVH);
  vec3 lambert = BRDF_Lambert(material.diffuseContribution);
  reflectedLight.directDiffuse += wrapNL * directLight.color * lambert * (1.0 - F);
  vec3 scatter = clayScatterColor(material.diffuseColor);
  float band = max(wrapNLg - dotNLg, 0.0);
  reflectedLight.directDiffuse += band * uClaySSS * scatter * directLight.color * RECIPROCAL_PI;
  float back = pow(saturate(dot(geometryViewDir, -directLight.direction)), 3.0);
  float edge = pow(1.0 - saturate(dot(clayGeomN, geometryViewDir)), 2.5);
  reflectedLight.directDiffuse += back * edge * uClayRim * scatter * directLight.color * RECIPROCAL_PI;
  #if CLAY_SKIN == 2
    // Glitter holográfico (GPD4). O reflexo de espelho (GGX acima, floco liso e meio metálico) só acerta ~1% dos
    // flocos com uma softbox de ~13°. A película do floco é uma grade de difração de ~1 µm: a 1ª ordem sai num
    // anel a ~15–40° do espelho, com a cor girando com o ângulo (azul perto, vermelho longe). A película comercial
    // tem grade cruzada (difrata ao longo de dois eixos perpendiculares, orientação sorteada por floco), então
    // cada floco acende numa boa fração dos azimutes. É isso que faz o lado iluminado inteiro cintilar em pontos
    // coloridos. Eficiência ~40% concentrada em ~0,25 sr → radiância ~1,6·E na cor daquele ângulo.
    if (claySkinFlake > 0.0) {
      vec3 R = reflect(-directLight.direction, geometryNormal);
      float c = clamp(dot(R, geometryViewDir), -1.0, 1.0);
      float ang = acos(c);
      float ring = smoothstep(0.24, 0.32, ang) * (1.0 - smoothstep(0.62, 0.72, ang));
      vec3 g = vClayAx * claySkinFlakeG.x + vClayAy * claySkinFlakeG.y + vClayAz * claySkinFlakeG.z;
      g = normalize(g - geometryNormal * dot(g, geometryNormal) + vec3(1e-5));
      vec3 g2 = cross(geometryNormal, g);
      vec3 across = normalize(geometryViewDir - R * c + vec3(1e-5));
      float az = max(abs(dot(across, g)), abs(dot(across, g2)));
      float grating = smoothstep(0.86, 0.97, az);
      float phase = (ang - 0.26) * 2.2 + claySkinFlakeHue * 0.35; // passo da grade varia um pouco por floco
      vec3 rainbow = 0.5 + 0.5 * cos(6.2831853 * (phase + vec3(0.0, 0.33, 0.67)));
      reflectedLight.directSpecular += claySkinFlake * ring * grating * rainbow * directLight.color * dotNL * 1.6;
    }
  #endif
}
#undef RE_Direct
#define RE_Direct RE_Direct_Clay
`;

const FRAG_SHADOW_FLOOR = /* glsl */ `
{
  // Massinha nunca fica preta: piso na cor saturada da própria massa e saturação extra nas zonas escuras.
  vec3 floorColor = clayDeepen(diffuseColor.rgb) * uClayShadowLift;
  outgoingLight = max(outgoingLight, floorColor);
  float l = dot(outgoingLight, vec3(0.2126, 0.7152, 0.0722));
  float dark = 1.0 - smoothstep(0.0, 0.35, l);
  outgoingLight = max(mix(vec3(l), outgoingLight, 1.0 + 0.45 * dark), vec3(0.0));
}
#ifdef CLAY_BLACK_PROBE
  // Diagnóstico do aceite: massa que ficaria preta na tela aparece em magenta.
  if (dot(outgoingLight, vec3(0.2126, 0.7152, 0.0722)) < uClayProbe.w) outgoingLight = uClayProbe.rgb * 3.0;
#endif
#include <opaque_fragment>
`;

const DEFAULTS = Object.freeze({
  color: '#C8553D',
  colorB: null,
  colorC: null,
  skin: 'liso',
  roughness: 0.72,
  wetness: 0.35,
  fingerprints: 1,
  fingerprintScale: 1,
  toolMarks: 0.6,
  boil: 0.0045,
  size: 36,
  touched: false,
  wrap: 0.5,
  sss: 0.55,
  sssTint: '#ffffff',
  rim: 0.35,
  shadowLift: 0.06,
  lint: 0.35,
  lintColor: '#DCD6CB',
  seed: null,
  // { map: Texture, rect: [x0, z0, largura, profundidade] no XZ do objeto, depth, lip, roller (u) } ou null
  imprint: null,
});

const PARAM_KEYS = Object.keys(DEFAULTS);

export class ClayMaterial extends THREE.MeshPhysicalMaterial {
  constructor(params = {}) {
    const clayParams = {};
    const rest = {};
    for (const [k, v] of Object.entries(params)) {
      if (PARAM_KEYS.includes(k)) clayParams[k] = v;
      else rest[k] = v;
    }
    const p = { ...DEFAULTS, ...clayParams };
    const skin = CLAY_SKINS[p.skin] ?? CLAY_SKINS.liso;
    super({
      color: skin.color ?? p.color,
      roughness: skin.roughness ?? p.roughness,
      metalness: skin.metalness ?? 0,
      ior: 1.45,
      specularIntensity: 0.55,
      clearcoat: Math.max(0, Math.min(1, p.wetness)) * 0.45,
      clearcoatRoughness: 0.42 - Math.max(0, Math.min(1, p.wetness)) * 0.14,
      ...rest,
    });
    // `type` continua 'MeshPhysicalMaterial': o three escolhe o shader-base (e os uniforms) por ele.
    this.isClayMaterial = true;
    this.clay = p;
    this.skinId = skin.id;
    // Atributos opcionais: se a geometria não tiver aTouch/aSeam, valem 0.
    this.defaultAttributeValues = { aTouch: [0], aSeam: [0] };
    // Seed determinística (ordem de criação) quando a peça não traz a sua: a mesma cena sempre ferve igual.
    const seed = typeof p.seed === 'number' ? p.seed
      : (hashString(p.seed ?? `clay#${autoSeed++}`) % 997) / 7;
    const colorB = new THREE.Color(p.colorB ?? skin.colorB ?? p.color);
    const colorC = new THREE.Color(p.colorC ?? skin.colorC ?? p.color);
    this.clayUniforms = {
      uClayFpStrength: { value: p.fingerprints },
      uClayFpScale: { value: p.fingerprintScale / FINGERPRINT_TILE },
      uClayToolStrength: { value: p.toolMarks },
      uClayToolScale: { value: 1 / TOOL_TILE },
      uClayBoilAmp: { value: p.boil * p.size },
      uClayBoilFreq: { value: 2.2 / Math.max(1, p.size) },
      uClayTouched: { value: p.touched ? 1 : 0 },
      uClaySeed: { value: seed },
      uClayLint: { value: p.lint },
      uClayLintColor: { value: new THREE.Color(p.lintColor) },
      uClayWrap: { value: p.wrap },
      uClaySSS: { value: p.sss },
      uClaySSSTint: { value: new THREE.Color(p.sssTint) },
      uClayRim: { value: p.rim },
      uClayShadowLift: { value: p.shadowLift },
      uClayColorB: { value: colorB },
      uClayColorC: { value: colorC },
      uClaySkinParams: { value: new THREE.Vector4(...skin.params) },
    };
    this.clayImprint = false;
    if (p.imprint) this.setImprint(p.imprint);
    this.customProgramCacheKey = () =>
      `clay:${this.skinId}:${clayFlags.fingerprints ? 1 : 0}:${clayFlags.boil ? 1 : 0}:${clayFlags.blackProbe ? 1 : 0}:${this.clayImprint ? 1 : 0}`;
    this.onBeforeCompile = (shader) => this.#patch(shader);
    registerClayMaterial(this);
  }

  #patch(shader) {
    Object.assign(shader.uniforms, this.clayUniforms, clayGlobals, studioGlobals);
    shader.defines = shader.defines ?? {};
    shader.defines.CLAY_SKIN = this.skinId;
    if (clayFlags.fingerprints) shader.defines.CLAY_FINGERPRINTS = '';
    if (clayFlags.boil) shader.defines.CLAY_BOIL = '';
    if (clayFlags.blackProbe) shader.defines.CLAY_BLACK_PROBE = '';
    if (this.clayImprint) shader.defines.CLAY_IMPRINT = '';
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${VERT_PARS}`)
      .replace('#include <begin_vertex>', VERT_BOIL)
      .replace('#include <defaultnormal_vertex>', VERT_AXES);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${FRAG_PARS}`)
      .replace('#include <lights_physical_pars_fragment>', FRAG_LIGHTING)
      .replace('#include <color_fragment>', FRAG_SAMPLE)
      .replace('#include <roughnessmap_fragment>', FRAG_ROUGHNESS)
      .replace('#include <metalnessmap_fragment>', FRAG_METALNESS)
      .replace('#include <normal_fragment_maps>', FRAG_NORMAL)
      .replace('#include <clearcoat_normal_fragment_maps>', FRAG_CLEARCOAT_NORMAL)
      .replace('#include <emissivemap_fragment>', FRAG_EMISSIVE)
      .replace('#include <lights_physical_fragment>', FRAG_MATERIAL)
      .replace('#include <opaque_fragment>', FRAG_SHADOW_FLOOR);
  }

  /** Tamanho do objeto (raio em unidades do objeto): o boil fica em ~0,3–0,6% dele. */
  setObjectSize(radius) {
    const r = Math.max(1, radius);
    this.clay.size = r;
    this.clayUniforms.uClayBoilAmp.value = this.clay.boil * r;
    this.clayUniforms.uClayBoilFreq.value = 2.2 / r;
    return this;
  }

  /**
   * Liga (ou troca) a impressão: `map` com R = fundo, G = lábio, B = rolo; `rect` = [x0, z0, largura, profundidade] no XZ
   * do objeto (largura negativa espelha); `depth`/`lip`/`roller` em u. A textura é de quem chama (o mapa a libera).
   */
  setImprint({ map, rect, depth = 1.6, lip = 0.35, roller = 0.08 }) {
    const had = this.clayImprint;
    const u = this.clayUniforms;
    // Os objetos de uniform são os mesmos que o programa compilado lê: troca só o valor.
    if (!u.uClayImprint) {
      u.uClayImprint = { value: null };
      u.uClayImprintRect = { value: new THREE.Vector4() };
      u.uClayImprintDepth = { value: new THREE.Vector3() };
      u.uClayImprintTexel = { value: new THREE.Vector2() };
    }
    const img = map.image;
    u.uClayImprint.value = map;
    u.uClayImprintRect.value.set(rect[0], rect[1], rect[2], rect[3]);
    u.uClayImprintDepth.value.set(depth, lip, roller);
    u.uClayImprintTexel.value.set(1 / (img?.width ?? 512), 1 / (img?.height ?? 512));
    this.clay.imprint = { map, rect: [...rect], depth, lip, roller };
    this.clayImprint = true;
    if (!had) this.needsUpdate = true;
    return this;
  }

  /** 0 = massa seca e fosca · 1 = massa fresca e úmida (clearcoat). */
  setWetness(w) {
    const v = Math.max(0, Math.min(1, w));
    this.clay.wetness = v;
    const had = this.clearcoat > 0;
    this.clearcoat = v * 0.45;
    this.clearcoatRoughness = 0.42 - v * 0.14;
    if (had !== this.clearcoat > 0) this.needsUpdate = true;
    return this;
  }

  setFingerprints(strength) {
    this.clay.fingerprints = strength;
    this.clayUniforms.uClayFpStrength.value = strength;
    return this;
  }

  setBoil(fraction) {
    this.clay.boil = fraction;
    this.clayUniforms.uClayBoilAmp.value = fraction * this.clay.size;
    return this;
  }

  setTouched(touched) {
    this.clay.touched = touched;
    this.clayUniforms.uClayTouched.value = touched ? 1 : 0;
    return this;
  }

  setSkin(skinId, { colorB, colorC } = {}) {
    const skin = CLAY_SKINS[skinId];
    if (!skin) throw new Error(`skin desconhecida: ${skinId}`);
    this.clay.skin = skinId;
    this.skinId = skin.id;
    this.clayUniforms.uClaySkinParams.value.set(...skin.params);
    this.clayUniforms.uClayColorB.value.set(colorB ?? skin.colorB ?? this.color);
    this.clayUniforms.uClayColorC.value.set(colorC ?? skin.colorC ?? this.color);
    this.metalness = skin.metalness ?? 0;
    if (skin.roughness !== undefined) this.roughness = skin.roughness;
    if (skin.color) this.color.set(skin.color);
    this.needsUpdate = true;
    return this;
  }

  copy(source) {
    super.copy(source);
    if (source.isClayMaterial) {
      this.clay = { ...source.clay };
      this.skinId = source.skinId;
      this.clayUniforms = {};
      for (const [k, u] of Object.entries(source.clayUniforms)) {
        // Texturas são compartilhadas (a impressão é do mapa); vetores e cores, copiados.
        this.clayUniforms[k] = { value: u.value?.isTexture ? u.value : u.value?.clone ? u.value.clone() : u.value };
      }
      this.clayImprint = source.clayImprint;
    }
    return this;
  }

  clone() {
    return new ClayMaterial({ ...this.clay, seed: this.clayUniforms.uClaySeed.value }).copy(this);
  }

  dispose() {
    unregisterClayMaterial(this);
    super.dispose();
  }
}

/** Garante os atributos opcionais da massinha numa geometria qualquer (zeros). */
export function prepareClayGeometry(geometry) {
  const n = geometry.attributes.position.count;
  if (!geometry.attributes.aTouch) geometry.setAttribute('aTouch', new THREE.BufferAttribute(new Float32Array(n), 1));
  if (!geometry.attributes.aSeam) geometry.setAttribute('aSeam', new THREE.BufferAttribute(new Float32Array(n), 1));
  return geometry;
}
