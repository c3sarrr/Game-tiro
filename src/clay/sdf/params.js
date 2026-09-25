// Leitura e validação dos parâmetros dos nós SDF (JSON vindo de código, do Worker ou do cache) e a transformação
// de nó (pos/rot/scale). A rotação é Euler XYZ em radianos com a MESMA matriz do three.js
// (Matrix4.makeRotationFromEuler, ordem 'XYZ'), para que peças SDF e Object3D fiquem alinhadas sem conversão.
// Erros de árvore mal formada dizem o caminho do nó (ex.: "raiz.children[2].child") em português.

/** Formas básicas (todas aceitam pos, rot, scale e mat). */
export const SHAPE_TYPES = Object.freeze([
  'sphere', 'ellipsoid', 'capsule', 'roundCone', 'roundBox', 'cylinder', 'torus', 'cone', 'spiral',
]);

/** Operações sobre filhos. */
export const OP_TYPES = Object.freeze([
  'union', 'smoothUnion', 'smoothUnionCrease', 'subtract', 'smoothSubtract', 'intersect',
  'displace', 'transform', 'bend', 'twist',
]);

/** Maior id de material (índice do material no three.js; cabe em Uint8 na ordenação dos triângulos). */
export const MAX_MATERIAL_ID = 255;

/** Largura padrão (unidades de mundo) da faixa de costura entre massas de materiais diferentes. */
export const DEFAULT_SEAM_WIDTH = 0.6;

/** Profundidade máxima da árvore (cada nível vira uma closure aninhada na avaliação). */
export const MAX_DEPTH = 48;

const ZERO3 = Object.freeze([0, 0, 0]);

/** Lança o erro padrão de árvore inválida. */
export function fail(path, message) {
  throw new Error(`SDF inválido em ${path}: ${message}`);
}

/** Número finito; `def` (se dado) vale quando a chave falta. */
export function readNumber(node, key, path, def) {
  const v = node[key];
  if (v === undefined || v === null) {
    if (def === undefined) fail(path, `'${key}' é obrigatório`);
    return def;
  }
  if (typeof v !== 'number' || !Number.isFinite(v)) fail(path, `'${key}' precisa ser um número finito (recebeu ${JSON.stringify(v)})`);
  return v;
}

export function readPositive(node, key, path, def) {
  const v = readNumber(node, key, path, def);
  if (!(v > 0)) fail(path, `'${key}' precisa ser > 0 (recebeu ${v})`);
  return v;
}

export function readNonNegative(node, key, path, def) {
  const v = readNumber(node, key, path, def);
  if (v < 0) fail(path, `'${key}' não pode ser negativo (recebeu ${v})`);
  return v;
}

export function readInteger(node, key, path, def, min, max) {
  const v = readNumber(node, key, path, def);
  if (!Number.isInteger(v) || v < min || v > max) fail(path, `'${key}' precisa ser inteiro entre ${min} e ${max} (recebeu ${v})`);
  return v;
}

/** Vetor [x, y, z] (array comum ou tipado) de números finitos. */
export function readVec3(node, key, path, def) {
  const v = node[key];
  if (v === undefined || v === null) {
    if (def === undefined) fail(path, `'${key}' é obrigatório`);
    return def;
  }
  if (!(Array.isArray(v) || ArrayBuffer.isView(v)) || v.length !== 3) fail(path, `'${key}' precisa ser [x, y, z]`);
  const out = [Number(v[0]), Number(v[1]), Number(v[2])];
  if (!out.every(Number.isFinite)) fail(path, `'${key}' tem componente não finita (${JSON.stringify(Array.from(v))})`);
  return out;
}

/** Vetor de 3 componentes todas > 0 (raios, meias-medidas). */
export function readPositiveVec3(node, key, path) {
  const v = readVec3(node, key, path);
  if (!(v[0] > 0 && v[1] > 0 && v[2] > 0)) fail(path, `'${key}' precisa ter as 3 componentes > 0 (recebeu ${JSON.stringify(v)})`);
  return v;
}

export function readMaterial(node, path) {
  return readInteger(node, 'mat', path, 0, 0, MAX_MATERIAL_ID);
}

/** Filho único obrigatório (objeto de nó). */
export function readChild(node, key, path) {
  const c = node[key];
  if (!c || typeof c !== 'object' || Array.isArray(c)) fail(path, `'${key}' precisa ser um nó (objeto com 'type')`);
  return c;
}

/** Lista de filhos (pelo menos um). */
export function readChildren(node, path) {
  const list = node.children;
  if (!Array.isArray(list) || list.length === 0) fail(path, `'children' precisa ser uma lista com pelo menos um nó`);
  return list;
}

/**
 * Matriz de rotação 3×3 (por linhas: m[0..2] = 1ª linha) idêntica à do three.js para Euler 'XYZ' = Rx·Ry·Rz.
 * @returns {Float64Array}
 */
export function eulerXYZ(rx, ry, rz) {
  const a = Math.cos(rx);
  const b = Math.sin(rx);
  const c = Math.cos(ry);
  const d = Math.sin(ry);
  const e = Math.cos(rz);
  const f = Math.sin(rz);
  const ae = a * e;
  const af = a * f;
  const be = b * e;
  const bf = b * f;
  return new Float64Array([
    c * e, -c * f, d,
    af + be * d, ae - bf * d, -b * c,
    bf - ae * d, be + af * d, a * c,
  ]);
}

/**
 * Transformação rígida + escala uniforme: mundo = pos + s·M·local. Objetos sempre com o mesmo formato
 * (mesma "hidden class" no V8) para os avaliadores ficarem monomórficos.
 */
export function makeTransform(pos = ZERO3, rot = ZERO3, scale = 1) {
  const m = eulerXYZ(rot[0], rot[1], rot[2]);
  return {
    px: pos[0], py: pos[1], pz: pos[2],
    m00: m[0], m01: m[1], m02: m[2],
    m10: m[3], m11: m[4], m12: m[5],
    m20: m[6], m21: m[7], m22: m[8],
    s: scale,
    inv: 1 / scale,
  };
}

/** Lê pos/rot/scale opcionais de um nó. */
export function readTransform(node, path) {
  return makeTransform(readVec3(node, 'pos', path, ZERO3), readVec3(node, 'rot', path, ZERO3), readPositive(node, 'scale', path, 1));
}

/** Tipo do nó validado (string conhecida). */
export function readType(node, path) {
  if (!node || typeof node !== 'object' || Array.isArray(node)) fail(path, 'nó precisa ser um objeto');
  const type = node.type;
  if (!SHAPE_TYPES.includes(type) && !OP_TYPES.includes(type)) fail(path, `tipo de nó desconhecido: ${JSON.stringify(type)}`);
  return type;
}
