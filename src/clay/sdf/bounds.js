// Caixa envolvente (AABB) conservadora de uma árvore SDF, em coordenadas de mundo: a superfície (d = 0) nunca sai
// dela. As transformações acumuladas descem até as folhas, então cada forma entra com a AABB exata da versão
// girada (função suporte por tipo, sem inflar caixa girada). As operações só somam o que pode realmente crescer:
// união suave (recorrência exata do smin encadeado, < k no total), vinco negativo (saliência), amplitude do
// displace, e bend/twist por varredura angular do retângulo da caixa filha.
// `reach` acompanha quanto o campo de um nó pode subestimar a distância fora da forma (o elipsoide aproximado de
// iq chega a rmax/rmin), para as expansões acima continuarem garantidas também sobre ele.

import {
  MAX_DEPTH, fail, readChild, readChildren, readNonNegative, readNumber, readPositive, readPositiveVec3,
  readTransform, readType, readVec3,
} from './params.js';

const TAU = Math.PI * 2;

function box(min, max, reach) {
  return { min, max, reach };
}

function emptyBox() {
  return box([Infinity, Infinity, Infinity], [-Infinity, -Infinity, -Infinity], 1);
}

/** true se a caixa não tem volume (interseção vazia, árvore sem superfície). */
export function isEmptyBounds(b) {
  return !(b.min[0] <= b.max[0] && b.min[1] <= b.max[1] && b.min[2] <= b.max[2]);
}

// Transformação afim acumulada (rotação por linhas m, translação t, escala uniforme s): mundo = t + s·m·local.
const IDENTITY = Object.freeze({ m: new Float64Array([1, 0, 0, 0, 1, 0, 0, 0, 1]), tx: 0, ty: 0, tz: 0, s: 1 });

function compose(A, T) {
  const a = A.m;
  const b = [T.m00, T.m01, T.m02, T.m10, T.m11, T.m12, T.m20, T.m21, T.m22];
  const m = new Float64Array(9);
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) m[i * 3 + j] = a[i * 3] * b[j] + a[i * 3 + 1] * b[3 + j] + a[i * 3 + 2] * b[6 + j];
  }
  return {
    m,
    tx: A.tx + A.s * (a[0] * T.px + a[1] * T.py + a[2] * T.pz),
    ty: A.ty + A.s * (a[3] * T.px + a[4] * T.py + a[5] * T.pz),
    tz: A.tz + A.s * (a[6] * T.px + a[7] * T.py + a[8] * T.pz),
    s: A.s * T.s,
  };
}

// Função suporte h(u) = max u·x sobre a forma local (u unitário). Exata para as formas do kit; na folha em
// espiral, a do cilindro que a contém (conservadora).
function supportOf(node, type, path) {
  switch (type) {
    case 'sphere': {
      const r = readPositive(node, 'r', path);
      return () => r;
    }
    case 'ellipsoid': {
      const [rx, ry, rz] = readPositiveVec3(node, 'radii', path);
      return (ux, uy, uz) => Math.hypot(ux * rx, uy * ry, uz * rz);
    }
    case 'capsule': {
      const a = readVec3(node, 'a', path);
      const b = readVec3(node, 'b', path);
      const r = readPositive(node, 'r', path);
      return (ux, uy, uz) => Math.max(ux * a[0] + uy * a[1] + uz * a[2], ux * b[0] + uy * b[1] + uz * b[2]) + r;
    }
    case 'roundCone': {
      const a = readVec3(node, 'a', path);
      const b = readVec3(node, 'b', path);
      const ra = readPositive(node, 'ra', path);
      const rb = readPositive(node, 'rb', path);
      return (ux, uy, uz) => Math.max(ux * a[0] + uy * a[1] + uz * a[2] + ra, ux * b[0] + uy * b[1] + uz * b[2] + rb);
    }
    case 'roundBox': {
      const [hx, hy, hz] = readPositiveVec3(node, 'size', path);
      const r = Math.min(readNonNegative(node, 'r', path, 0), hx, hy, hz);
      return (ux, uy, uz) => Math.abs(ux) * (hx - r) + Math.abs(uy) * (hy - r) + Math.abs(uz) * (hz - r) + r;
    }
    case 'cylinder': {
      const h = readPositive(node, 'h', path);
      const r = readPositive(node, 'r', path);
      const rd = Math.min(readNonNegative(node, 'round', path, 0), h, r);
      return (ux, uy, uz) => Math.abs(uy) * (h - rd) + Math.hypot(ux, uz) * (r - rd) + rd;
    }
    case 'torus': {
      const R = readPositive(node, 'R', path);
      const r = readPositive(node, 'r', path);
      return (ux, uy, uz) => R * Math.hypot(ux, uz) + r;
    }
    case 'cone': {
      const h = readPositive(node, 'h', path);
      const r1 = readNonNegative(node, 'r1', path);
      const r2 = readNonNegative(node, 'r2', path);
      if (r1 === 0 && r2 === 0) fail(path, "'r1' e 'r2' não podem ser ambos 0");
      // Casca convexa dos dois discos (base em y = −h com r1, topo em y = +h com r2).
      return (ux, uy, uz) => {
        const q = Math.hypot(ux, uz);
        return Math.max(-uy * h + r1 * q, uy * h + r2 * q);
      };
    }
    case 'spiral': {
      // Cabe no cilindro de raio (fim da espiral + meia-espessura) e meia-altura h (eixo Y): conservador.
      const R = readPositive(node, 'r0', path) + readPositive(node, 'pitch', path) * readPositive(node, 'turns', path)
        + readPositive(node, 't', path);
      const h = readPositive(node, 'h', path);
      return (ux, uy, uz) => R * Math.hypot(ux, uz) + Math.abs(uy) * h;
    }
    default:
      return fail(path, `forma desconhecida: ${type}`);
  }
}

function shapeBox(node, type, A, path) {
  const W = compose(A, readTransform(node, path));
  const support = supportOf(node, type, path);
  const t = [W.tx, W.ty, W.tz];
  const min = [0, 0, 0];
  const max = [0, 0, 0];
  for (let i = 0; i < 3; i++) {
    // Linha i da rotação = eixo i do mundo visto no espaço local da forma.
    const ux = W.m[i * 3];
    const uy = W.m[i * 3 + 1];
    const uz = W.m[i * 3 + 2];
    max[i] = t[i] + W.s * support(ux, uy, uz);
    min[i] = t[i] - W.s * support(-ux, -uy, -uz);
  }
  let reach = 1;
  if (type === 'ellipsoid') {
    const r = readPositiveVec3(node, 'radii', path);
    reach = Math.max(...r) / Math.min(...r);
  }
  return box(min, max, reach);
}

function unionBoxes(list) {
  const out = emptyBox();
  for (const b of list) {
    for (let i = 0; i < 3; i++) {
      if (b.min[i] < out.min[i]) out.min[i] = b.min[i];
      if (b.max[i] > out.max[i]) out.max[i] = b.max[i];
    }
    if (b.reach > out.reach) out.reach = b.reach;
  }
  return out;
}

function intersectBoxes(a, b) {
  const out = box(
    [Math.max(a.min[0], b.min[0]), Math.max(a.min[1], b.min[1]), Math.max(a.min[2], b.min[2])],
    [Math.min(a.max[0], b.max[0]), Math.min(a.max[1], b.max[1]), Math.min(a.max[2], b.max[2])],
    Math.max(a.reach, b.reach),
  );
  return isEmptyBounds(out) ? emptyBox() : out;
}

function expand(b, delta) {
  if (isEmptyBounds(b) || !(delta > 0)) return b;
  return box(b.min.map((v) => v - delta), b.max.map((v) => v + delta), b.reach);
}

/**
 * Quanto o zero de uma união suave encadeada de n filhos pode avançar além da união dura (unidades locais).
 * Com a = o que já foi descontado de min(dᵢ): cada passo desconta no máximo (k − a)²/(4k) (smin é monótono) e o
 * vinco negativo mais `ridge`. Sem vinco a série converge para < k.
 */
export function foldGrowth(n, k, ridge = 0) {
  let a = 0;
  for (let i = 1; i < n; i++) {
    if (k > 0 && a < k) a += ((k - a) * (k - a)) / (4 * k);
    a += ridge;
  }
  return a;
}

// Ângulo `beta` (mod 2π) cai dentro de [a0, a1]?
function hitsAngle(a0, a1, beta) {
  return Math.ceil((a0 - beta) / TAU) <= Math.floor((a1 - beta) / TAU);
}

/**
 * AABB 2D de um retângulo [x0,x1]×[y0,y1] girado por todos os ângulos em [th0, th1] (união dos arcos dos 4 cantos).
 * @returns {number[]} [minX, maxX, minY, maxY]
 */
export function sweptRect(x0, x1, y0, y1, th0, th1) {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  const full = th1 - th0 >= TAU;
  for (const [vx, vy] of [[x0, y0], [x1, y0], [x0, y1], [x1, y1]]) {
    const rho = Math.hypot(vx, vy);
    const phi = Math.atan2(vy, vx);
    const a0 = phi + th0;
    const a1 = phi + th1;
    const c0 = Math.cos(a0);
    const c1 = Math.cos(a1);
    const s0 = Math.sin(a0);
    const s1 = Math.sin(a1);
    const cMax = full || hitsAngle(a0, a1, 0) ? 1 : Math.max(c0, c1);
    const cMin = full || hitsAngle(a0, a1, Math.PI) ? -1 : Math.min(c0, c1);
    const sMax = full || hitsAngle(a0, a1, Math.PI / 2) ? 1 : Math.max(s0, s1);
    const sMin = full || hitsAngle(a0, a1, -Math.PI / 2) ? -1 : Math.min(s0, s1);
    minX = Math.min(minX, rho * cMin);
    maxX = Math.max(maxX, rho * cMax);
    minY = Math.min(minY, rho * sMin);
    maxY = Math.max(maxY, rho * sMax);
  }
  return [minX, maxX, minY, maxY];
}

function transformBox(b, A) {
  if (A === IDENTITY || isEmptyBounds(b)) return b;
  const out = emptyBox();
  out.reach = b.reach;
  for (let c = 0; c < 8; c++) {
    const x = c & 1 ? b.max[0] : b.min[0];
    const y = c & 2 ? b.max[1] : b.min[1];
    const z = c & 4 ? b.max[2] : b.min[2];
    const w = [
      A.tx + A.s * (A.m[0] * x + A.m[1] * y + A.m[2] * z),
      A.ty + A.s * (A.m[3] * x + A.m[4] * y + A.m[5] * z),
      A.tz + A.s * (A.m[6] * x + A.m[7] * y + A.m[8] * z),
    ];
    for (let i = 0; i < 3; i++) {
      if (w[i] < out.min[i]) out.min[i] = w[i];
      if (w[i] > out.max[i]) out.max[i] = w[i];
    }
  }
  return out;
}

// bend: p.xy = R(k·p.x)·q.xy (z igual); twist: p.xz = R(−k·y)·q.xz (y igual). Caixa filha no espaço do nó,
// varrida pelos ângulos possíveis e depois levada ao mundo pela transformação acumulada.
function deformBox(node, type, A, path, depth) {
  const k = readNumber(node, 'k', path);
  const child = walk(readChild(node, 'child', path), IDENTITY, `${path}.child`, depth + 1);
  if (k === 0 || isEmptyBounds(child)) return transformBox(child, A);
  const { min, max } = child;
  let local;
  if (type === 'twist') {
    const th0 = Math.min(-k * min[1], -k * max[1]);
    const th1 = Math.max(-k * min[1], -k * max[1]);
    const [x0, x1, z0, z1] = sweptRect(min[0], max[0], min[2], max[2], th0, th1);
    const rho = Math.max(Math.hypot(min[0], min[2]), Math.hypot(max[0], min[2]), Math.hypot(min[0], max[2]), Math.hypot(max[0], max[2]));
    local = box([x0, min[1], z0], [x1, max[1], z1], child.reach * (1 + Math.abs(k) * rho));
  } else {
    // O ângulo depende do x do próprio resultado: parte do disco |p.xy| ≤ ρ e aperta o intervalo de x iterando
    // (cada passo continua contendo o conjunto verdadeiro).
    const rho = Math.max(Math.hypot(min[0], min[1]), Math.hypot(max[0], min[1]), Math.hypot(min[0], max[1]), Math.hypot(max[0], max[1]));
    let xLo = -rho;
    let xHi = rho;
    let swept = [-rho, rho, -rho, rho];
    for (let it = 0; it < 12; it++) {
      swept = sweptRect(min[0], max[0], min[1], max[1], Math.min(k * xLo, k * xHi), Math.max(k * xLo, k * xHi));
      const nLo = Math.max(xLo, swept[0]);
      const nHi = Math.min(xHi, swept[1]);
      const done = nLo - xLo <= 1e-9 * rho && xHi - nHi <= 1e-9 * rho;
      xLo = nLo;
      xHi = nHi;
      if (done) break;
    }
    local = box([xLo, swept[2], min[2]], [xHi, swept[3], max[2]], child.reach * (1 + Math.abs(k) * rho));
  }
  return transformBox(local, A);
}

function walk(node, A, path, depth) {
  if (depth > MAX_DEPTH) fail(path, `árvore mais funda que ${MAX_DEPTH} níveis`);
  const type = readType(node, path);
  switch (type) {
    case 'union':
    case 'smoothUnion':
    case 'smoothUnionCrease': {
      const kids = readChildren(node, path).map((c, i) => walk(c, A, `${path}.children[${i}]`, depth + 1));
      const b = unionBoxes(kids);
      if (type === 'union' || kids.length === 1) return b;
      const k = readNonNegative(node, 'k', path);
      const ridge = type === 'smoothUnionCrease' ? Math.max(0, -readNumber(node, 'depth', path)) : 0;
      return expand(b, A.s * foldGrowth(kids.length, k, ridge) * b.reach);
    }
    case 'subtract':
    case 'smoothSubtract':
      // Subtrair só remove massa: max(a, −b) ≥ a (a versão suave também).
      return walk(readChild(node, 'a', path), A, `${path}.a`, depth + 1);
    case 'intersect':
      return intersectBoxes(
        walk(readChild(node, 'a', path), A, `${path}.a`, depth + 1),
        walk(readChild(node, 'b', path), A, `${path}.b`, depth + 1),
      );
    case 'displace': {
      const c = walk(readChild(node, 'child', path), A, `${path}.child`, depth + 1);
      return expand(c, A.s * Math.abs(readNumber(node, 'amp', path)) * c.reach);
    }
    case 'transform':
      return walk(readChild(node, 'child', path), compose(A, readTransform(node, path)), `${path}.child`, depth + 1);
    case 'bend':
    case 'twist':
      return deformBox(node, type, A, path, depth);
    default:
      return shapeBox(node, type, A, path);
  }
}

/**
 * AABB conservadora da superfície da árvore, em coordenadas de mundo.
 * @param {object} node raiz da árvore SDF
 * @returns {{min:number[], max:number[]}} caixa vazia (min = +∞, max = −∞) se a árvore não tem superfície
 */
export function bounds(node) {
  const b = walk(node, IDENTITY, 'raiz', 0);
  return { min: [b.min[0], b.min[1], b.min[2]], max: [b.max[0], b.max[1], b.max[2]] };
}
