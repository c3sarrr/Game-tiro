// Árvore SDF (campo de distância com sinal) das peças orgânicas de massinha: cabeças, bolotas, dedadas, costuras.
// A árvore é JSON puro — viaja para o Worker (structured clone) e vira chave de cache (hashNode). Formas
// (src/clay/sdf/shapes.js, todas com pos, rot = Euler XYZ em rad, scale uniforme e mat):
//   sphere {r} · ellipsoid {radii:[x,y,z]} · capsule {a, b, r} · roundCone {a, b, ra, rb}
//   roundBox {size:[meias-medidas], r} · cylinder {h (meia-altura), r, round} (eixo Y) · torus {R, r} (plano XZ)
//   cone {h (meia-altura), r1 (base em y = −h), r2 (topo)}
//   spiral {r0, pitch, turns, t, h, round, segments} — folha enrolada (espiral de Arquimedes no plano XZ que começa
//   em +X com raio r0 e abre `pitch` por volta; meia-espessura t, meia-altura h no eixo Y, bordas com raio round)
// Operações: union {children} · smoothUnion {children, k} · smoothUnionCrease {children, k, depth, width} (vinco
// da costura onde duas massas foram apertadas: +depth·exp(−(dA−dB)²/width²), positivo afunda, negativo vira lábio)
// · subtract {a, b} · smoothSubtract {a, b, k} (dedada) · intersect {a, b} · displace {child, amp, freq, seed,
// octaves} · transform {child, pos, rot, scale} · bend {child, k} (curva as pontas do eixo X para +Y) ·
// twist {child, k} (torce em torno de Y). União/interseção aceitam seamWidth (faixa de costura entre materiais).
//
// compile(node) monta UMA vez três closures (nada de interpretar JSON nem alocar por amostra):
//   distance(x, y, z) → d                            — milhões de chamadas no marching cubes
//   sample(x, y, z, out) → out.d, out.mat, out.seam  — material do filho mais próximo + costura 0..1
//   range(x, y, z, R, out) → out.lo, out.hi          — intervalo GARANTIDO de d na bola (centro, R): poda de blocos
// As uniões pulam filhos cuja esfera envolvente prova que não mudam o resultado (resultado idêntico, bit a bit).
// Convenções: d < 0 dentro da massa; unidades de mundo (1 u = 1 cm na escala do boneco); a árvore é tratada como
// imutável depois de compilada (evaluate() guarda o compilado por objeto).

import { hash128 } from '../../core/rng.js';
import { foldGrowth } from './bounds.js';
import { MAX_OCTAVES, fbm3, fbmGradBound, noisePerm } from './noise.js';
import {
  DEFAULT_SEAM_WIDTH, MAX_DEPTH, fail, readChild, readChildren, readInteger, readNonNegative, readNumber,
  readPositive, readTransform, readType,
} from './params.js';
import { LP, compileShape, sphereBound, toLocal } from './shapes.js';

export { bounds, isEmptyBounds } from './bounds.js';
export { DEFAULT_SEAM_WIDTH, MAX_MATERIAL_ID, OP_TYPES, SHAPE_TYPES } from './params.js';

/** Objeto de saída de sample() — crie um e reutilize. */
export function createSample() {
  return { d: 0, mat: 0, seam: 0 };
}

/** Objeto de saída de range(). */
export function createRange() {
  return { lo: 0, hi: 0 };
}

/**
 * União suave polinomial (iq): min(a, b) − max(k − |a − b|, 0)²/(4k). Fica entre min − k/4 e min, é monótona
 * nos dois argumentos e 1-Lipschitz. k ≤ 0 → união dura.
 */
export function smin(a, b, k) {
  const m = a < b ? a : b;
  if (k <= 0) return m;
  const h = k - Math.abs(a - b);
  return h > 0 ? m - (h * h) / (4 * k) : m;
}

// Perfil do vinco da costura exp(−Δ²/width²), zerado em Δ² ≥ 16·width² (o resto seria < 1,2e-7).
function creaseProfile(delta, invW2) {
  const e = delta * delta * invW2;
  return e < 16 ? Math.exp(-e) : 0;
}

// Esfera que envolve várias esferas envolventes (centro da AABB delas; rho = o pior dos filhos).
function enclose(list) {
  let minX = Infinity;
  let minY = Infinity;
  let minZ = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let maxZ = -Infinity;
  for (const b of list) {
    minX = Math.min(minX, b.x - b.r);
    minY = Math.min(minY, b.y - b.r);
    minZ = Math.min(minZ, b.z - b.r);
    maxX = Math.max(maxX, b.x + b.r);
    maxY = Math.max(maxY, b.y + b.r);
    maxZ = Math.max(maxZ, b.z + b.r);
  }
  const x = (minX + maxX) / 2;
  const y = (minY + maxY) / 2;
  const z = (minZ + maxZ) / 2;
  let r = 0;
  let rho = 1;
  for (const b of list) {
    r = Math.max(r, Math.hypot(b.x - x, b.y - y, b.z - z) + b.r);
    rho = Math.max(rho, b.rho);
  }
  return { x, y, z, r, rho };
}

// union / smoothUnion / smoothUnionCrease: dobra n-ária da esquerda para a direita. O material é o do filho mais
// próximo (menor d "cru"); a costura mistura as costuras dos filhos pelo peso do smin e soma a faixa da fronteira
// (materiais diferentes: 1 − |Δ|/seamWidth; vinco: exp(−Δ²/width²)), com Δ = d do vencedor − d do novo filho.
// Poda: um filho com limite inferior lb ≥ v + k (e longe o bastante do vencedor para vinco/costura) não altera nada.
function blendNode(node, type, path, depth, opts) {
  const kids = readChildren(node, path).map((c, i) => compileNode(c, `${path}.children[${i}]`, depth + 1, opts));
  const k = type === 'union' ? 0 : readNonNegative(node, 'k', path);
  const crease = type === 'smoothUnionCrease';
  const creaseDepth = crease ? readNumber(node, 'depth', path) : 0;
  const width = crease ? readPositive(node, 'width', path) : 1;
  const invW2 = 1 / (width * width);
  const seamW = readPositive(node, 'seamWidth', path, DEFAULT_SEAM_WIDTH);
  if (kids.length === 1) return kids[0];
  const n = kids.length;
  const D = kids.map((c) => c.d);
  const S = kids.map((c) => c.s);
  const G = kids.map((c) => c.r);
  const outs = kids.map(() => createSample());
  const rgs = kids.map(() => createRange());
  const CX = Float64Array.from(kids, (c) => c.bs.x);
  const CY = Float64Array.from(kids, (c) => c.bs.y);
  const CZ = Float64Array.from(kids, (c) => c.bs.z);
  const CR = Float64Array.from(kids, (c) => (opts.cull ? c.bs.r : Infinity)); // ∞ = nunca poda
  const RHO = Float64Array.from(kids, (c) => c.bs.rho);
  // Distâncias a partir das quais o vinco e a faixa de costura valem exatamente 0 (com folga de arredondamento).
  const creaseCut = crease ? 4.01 * width : 0;
  const sampleCut = Math.max(creaseCut, 1.001 * seamW);
  // Poda sem raiz quadrada: o limite inferior (|p − cᵢ| − rᵢ)/rhoᵢ é > 0 e ≥ T exatamente quando
  // |p − cᵢ| > rᵢ + max(T, 0)·rhoᵢ; aí o filho i não muda d (smin devolve v) nem vinco/costura/material.

  const d = crease
    ? (x, y, z) => {
        let v = D[0](x, y, z);
        let raw = v;
        for (let i = 1; i < n; i++) {
          const T = v + k > raw + creaseCut ? v + k : raw + creaseCut;
          const need = CR[i] + (T > 0 ? T * RHO[i] : 0);
          const dx = x - CX[i];
          const dy = y - CY[i];
          const dz = z - CZ[i];
          if (dx * dx + dy * dy + dz * dz > need * need) continue;
          const b = D[i](x, y, z);
          v = smin(v, b, k) + creaseDepth * creaseProfile(raw - b, invW2);
          if (b < raw) raw = b;
        }
        return v;
      }
    : (x, y, z) => {
        let v = D[0](x, y, z);
        for (let i = 1; i < n; i++) {
          const T = v + k;
          const need = CR[i] + (T > 0 ? T * RHO[i] : 0);
          const dx = x - CX[i];
          const dy = y - CY[i];
          const dz = z - CZ[i];
          if (dx * dx + dy * dy + dz * dz > need * need) continue;
          v = smin(v, D[i](x, y, z), k);
        }
        return v;
      };

  const s = (x, y, z, out) => {
    const o0 = outs[0];
    S[0](x, y, z, o0);
    let v = o0.d;
    let raw = v;
    let mat = o0.mat;
    let seam = o0.seam;
    for (let i = 1; i < n; i++) {
      const T = v + k > raw + sampleCut ? v + k : raw + sampleCut;
      const need = CR[i] + (T > 0 ? T * RHO[i] : 0);
      const dx = x - CX[i];
      const dy = y - CY[i];
      const dz = z - CZ[i];
      if (dx * dx + dy * dy + dz * dz > need * need) continue;
      const o = outs[i];
      S[i](x, y, z, o);
      const b = o.d;
      let wa; // peso do acumulado na mistura (1 = só ele)
      if (k > 0) {
        wa = 0.5 + (0.5 * (b - v)) / k;
        wa = wa < 0 ? 0 : wa > 1 ? 1 : wa;
      } else {
        wa = v <= b ? 1 : 0;
      }
      const delta = raw - b;
      let pair = 0;
      if (o.mat !== mat) {
        pair = 1 - Math.abs(delta) / seamW;
        if (pair < 0) pair = 0;
      }
      if (crease) {
        const g = creaseProfile(delta, invW2);
        v = smin(v, b, k) + creaseDepth * g;
        if (g > pair) pair = g;
      } else {
        v = smin(v, b, k);
      }
      const blended = seam * wa + o.seam * (1 - wa);
      seam = blended > pair ? blended : pair;
      if (b < raw) {
        raw = b;
        mat = o.mat;
      }
    }
    out.d = v;
    out.mat = mat;
    out.seam = seam > 1 ? 1 : seam;
  };

  // Intervalo: smin é monótono → [smin(los), smin(his)]; o vinco entra pelo intervalo de |Δ|.
  const r = (x, y, z, R, out) => {
    const q0 = rgs[0];
    G[0](x, y, z, R, q0);
    let lo = q0.lo;
    let hi = q0.hi;
    let rawLo = lo;
    let rawHi = hi;
    for (let i = 1; i < n; i++) {
      const q = rgs[i];
      G[i](x, y, z, R, q);
      const blo = q.lo;
      const bhi = q.hi;
      let nlo = smin(lo, blo, k);
      let nhi = smin(hi, bhi, k);
      if (crease) {
        const dlo = rawLo - bhi;
        const dhi = rawHi - blo;
        const near = dlo > 0 ? dlo : dhi < 0 ? -dhi : 0;
        const far = Math.max(Math.abs(dlo), Math.abs(dhi));
        const gNear = creaseDepth * creaseProfile(near, invW2);
        const gFar = creaseDepth * creaseProfile(far, invW2);
        nlo += gNear < gFar ? gNear : gFar;
        nhi += gNear < gFar ? gFar : gNear;
      }
      lo = nlo;
      hi = nhi;
      if (blo < rawLo) rawLo = blo;
      if (bhi < rawHi) rawHi = bhi;
    }
    out.lo = lo;
    out.hi = hi;
  };

  // d ≥ min(dᵢ) − crescimento da dobra: a esfera conjunta cresce crescimento·rho.
  const ridge = crease ? Math.max(0, -creaseDepth) : 0;
  const bs = enclose(kids.map((c) => c.bs));
  bs.r += foldGrowth(n, k, ridge) * bs.rho;
  return { d, s, r, bs };
}

// subtract / smoothSubtract: d = −smin(−a, b, k) (k = 0 → max(a, −b)). A parede escavada é a mesma massa de `a`:
// material e costura vêm de `a` avaliado no ponto (cortar através de duas cores revela a fronteira).
// Poda: se o limite inferior do cortador b já é ≥ −a + k, smin devolve −a e d = a exatamente — b nem é avaliado.
function subtractNode(node, type, path, depth, opts) {
  const A = compileNode(readChild(node, 'a', path), `${path}.a`, depth + 1, opts);
  const B = compileNode(readChild(node, 'b', path), `${path}.b`, depth + 1, opts);
  const k = type === 'smoothSubtract' ? readNonNegative(node, 'k', path) : 0;
  const Ad = A.d;
  const As = A.s;
  const Ar = A.r;
  const Bd = B.d;
  const Br = B.r;
  const qb = createRange();
  const bx = B.bs.x;
  const by = B.bs.y;
  const bz = B.bs.z;
  const br = opts.cull ? B.bs.r : Infinity;
  const brho = B.bs.rho;
  const cutterFar = (x, y, z, a) => {
    const T = k - a;
    const need = br + (T > 0 ? T * brho : 0);
    const dx = x - bx;
    const dy = y - by;
    const dz = z - bz;
    return dx * dx + dy * dy + dz * dz > need * need;
  };
  return {
    d(x, y, z) {
      const a = Ad(x, y, z);
      return cutterFar(x, y, z, a) ? a : -smin(-a, Bd(x, y, z), k);
    },
    s(x, y, z, out) {
      As(x, y, z, out);
      if (!cutterFar(x, y, z, out.d)) out.d = -smin(-out.d, Bd(x, y, z), k);
    },
    r(x, y, z, R, out) {
      Ar(x, y, z, R, out);
      Br(x, y, z, R, qb);
      const lo = -smin(-out.lo, qb.hi, k);
      const hi = -smin(-out.hi, qb.lo, k);
      out.lo = lo;
      out.hi = hi;
    },
    bs: A.bs, // d ≥ a
  };
}

// intersect: d = max(a, b); a superfície ativa é a do filho com maior d (material e costura dele).
function intersectNode(node, path, depth, opts) {
  const A = compileNode(readChild(node, 'a', path), `${path}.a`, depth + 1, opts);
  const B = compileNode(readChild(node, 'b', path), `${path}.b`, depth + 1, opts);
  const seamW = readPositive(node, 'seamWidth', path, DEFAULT_SEAM_WIDTH);
  const Ad = A.d;
  const Bd = B.d;
  const As = A.s;
  const Bs = B.s;
  const Ar = A.r;
  const Br = B.r;
  const oa = createSample();
  const ob = createSample();
  const qb = createRange();
  return {
    d(x, y, z) {
      const a = Ad(x, y, z);
      const b = Bd(x, y, z);
      return a > b ? a : b;
    },
    s(x, y, z, out) {
      As(x, y, z, oa);
      Bs(x, y, z, ob);
      const w = oa.d >= ob.d ? oa : ob;
      let seam = w.seam;
      if (oa.mat !== ob.mat) {
        const p = 1 - Math.abs(oa.d - ob.d) / seamW;
        if (p > seam) seam = p;
      }
      out.d = w.d;
      out.mat = w.mat;
      out.seam = seam > 1 ? 1 : seam;
    },
    r(x, y, z, R, out) {
      Ar(x, y, z, R, out);
      Br(x, y, z, R, qb);
      if (qb.lo > out.lo) out.lo = qb.lo;
      if (qb.hi > out.hi) out.hi = qb.hi;
    },
    bs: A.bs.r <= B.bs.r ? A.bs : B.bs, // d ≥ a e d ≥ b: qualquer uma vale, fica a menor
  };
}

// displace: d + amp·fbm(p·freq), no espaço do próprio nó. |fbm| ≤ 1; no intervalo usa o valor no centro da bola
// ± o limite do gradiente (NOISE_GRAD_BOUND), preso em [−1, 1].
function displaceNode(node, path, depth, opts) {
  const C = compileNode(readChild(node, 'child', path), `${path}.child`, depth + 1, opts);
  const amp = readNumber(node, 'amp', path);
  const freq = readPositive(node, 'freq', path);
  const seed = node.seed ?? 0;
  if (!(typeof seed === 'string' || (typeof seed === 'number' && Number.isFinite(seed)))) {
    fail(path, `'seed' precisa ser número finito ou texto (recebeu ${JSON.stringify(seed)})`);
  }
  const octaves = readInteger(node, 'octaves', path, 1, 1, MAX_OCTAVES);
  if (amp === 0) return C;
  const perm = noisePerm(seed);
  const gb = fbmGradBound(octaves) * freq;
  const Cd = C.d;
  const Cs = C.s;
  const Cr = C.r;
  return {
    d: (x, y, z) => Cd(x, y, z) + amp * fbm3(perm, x * freq, y * freq, z * freq, octaves),
    s(x, y, z, out) {
      Cs(x, y, z, out);
      out.d = out.d + amp * fbm3(perm, x * freq, y * freq, z * freq, octaves);
    },
    r(x, y, z, R, out) {
      Cr(x, y, z, R, out);
      const nc = fbm3(perm, x * freq, y * freq, z * freq, octaves);
      const nlo = nc - gb * R > -1 ? nc - gb * R : -1;
      const nhi = nc + gb * R < 1 ? nc + gb * R : 1;
      if (amp >= 0) {
        out.lo += amp * nlo;
        out.hi += amp * nhi;
      } else {
        out.lo += amp * nhi;
        out.hi += amp * nlo;
      }
    },
    bs: { ...C.bs, r: C.bs.r + Math.abs(amp) * C.bs.rho }, // d ≥ dfilho − |amp|
  };
}

// transform: o filho vive num espaço com pos/rot/scale próprios (escala uniforme preserva a métrica: d·s).
function transformNode(node, path, depth, opts) {
  const C = compileNode(readChild(node, 'child', path), `${path}.child`, depth + 1, opts);
  const t = readTransform(node, path);
  const identity = t.px === 0 && t.py === 0 && t.pz === 0 && t.s === 1
    && t.m00 === 1 && t.m11 === 1 && t.m22 === 1
    && t.m01 === 0 && t.m02 === 0 && t.m10 === 0 && t.m12 === 0 && t.m20 === 0 && t.m21 === 0;
  if (identity) return C;
  const Cd = C.d;
  const Cs = C.s;
  const Cr = C.r;
  return {
    d(x, y, z) {
      toLocal(t, x, y, z);
      return t.s * Cd(LP[0], LP[1], LP[2]);
    },
    s(x, y, z, out) {
      toLocal(t, x, y, z);
      Cs(LP[0], LP[1], LP[2], out);
      out.d *= t.s;
    },
    r(x, y, z, R, out) {
      toLocal(t, x, y, z);
      Cr(LP[0], LP[1], LP[2], R * t.inv, out);
      out.lo *= t.s;
      out.hi *= t.s;
    },
    bs: sphereBound(t, C.bs.x, C.bs.y, C.bs.z, C.bs.r, C.bs.rho),
  };
}

// bend (iq, "cheap bend"): q.xy = R(−k·x)·p.xy — com k > 0 as pontas do eixo X curvam para +Y.
// twist: q.xz = R(k·y)·p.xz. Nenhum dos dois é isometria: a bola de raio R vira no máximo uma bola de raio
// R·(1 + |k|·ρ), ρ = raio máximo ao eixo dentro da bola (norma do jacobiano ≤ 1 + |k|ρ). Os dois preservam |p|,
// então a esfera envolvente vira uma esfera na origem com raio |c| + r.
function deformNode(node, type, path, depth, opts) {
  const C = compileNode(readChild(node, 'child', path), `${path}.child`, depth + 1, opts);
  const k = readNumber(node, 'k', path);
  if (k === 0) return C;
  const ak = Math.abs(k);
  const Cd = C.d;
  const Cs = C.s;
  const Cr = C.r;
  const bs = { x: 0, y: 0, z: 0, r: Math.hypot(C.bs.x, C.bs.y, C.bs.z) + C.bs.r, rho: C.bs.rho };
  if (type === 'bend') {
    return {
      d(x, y, z) {
        const a = k * x;
        const c = Math.cos(a);
        const s = Math.sin(a);
        return Cd(c * x + s * y, c * y - s * x, z);
      },
      s(x, y, z, out) {
        const a = k * x;
        const c = Math.cos(a);
        const s = Math.sin(a);
        Cs(c * x + s * y, c * y - s * x, z, out);
      },
      r(x, y, z, R, out) {
        const a = k * x;
        const c = Math.cos(a);
        const s = Math.sin(a);
        const rho = Math.sqrt(x * x + y * y) + R;
        Cr(c * x + s * y, c * y - s * x, z, R * (1 + ak * rho), out);
      },
      bs,
    };
  }
  return {
    d(x, y, z) {
      const a = k * y;
      const c = Math.cos(a);
      const s = Math.sin(a);
      return Cd(c * x - s * z, y, s * x + c * z);
    },
    s(x, y, z, out) {
      const a = k * y;
      const c = Math.cos(a);
      const s = Math.sin(a);
      Cs(c * x - s * z, y, s * x + c * z, out);
    },
    r(x, y, z, R, out) {
      const a = k * y;
      const c = Math.cos(a);
      const s = Math.sin(a);
      const rho = Math.sqrt(x * x + z * z) + R;
      Cr(c * x - s * z, y, s * x + c * z, R * (1 + ak * rho), out);
    },
    bs,
  };
}

function compileNode(node, path, depth, opts) {
  if (depth > MAX_DEPTH) fail(path, `árvore mais funda que ${MAX_DEPTH} níveis`);
  const type = readType(node, path);
  switch (type) {
    case 'union':
    case 'smoothUnion':
    case 'smoothUnionCrease':
      return blendNode(node, type, path, depth, opts);
    case 'subtract':
    case 'smoothSubtract':
      return subtractNode(node, type, path, depth, opts);
    case 'intersect':
      return intersectNode(node, path, depth, opts);
    case 'displace':
      return displaceNode(node, path, depth, opts);
    case 'transform':
      return transformNode(node, path, depth, opts);
    case 'bend':
    case 'twist':
      return deformNode(node, type, path, depth, opts);
    default:
      return compileShape(node, type, path);
  }
}

/**
 * Valida a árvore e compila as closures de avaliação (uma vez por árvore).
 * @param {object} node raiz
 * @param {{cull?:boolean}} [options] cull: false desliga a poda por esfera envolvente nas uniões (diagnóstico;
 *   o campo é o mesmo bit a bit, só mais lento)
 * @returns {{distance:(x:number,y:number,z:number)=>number,
 *            sample:(x:number,y:number,z:number,out:{d:number,mat:number,seam:number})=>void,
 *            range:(x:number,y:number,z:number,R:number,out:{lo:number,hi:number})=>void}}
 */
export function compile(node, { cull = true } = {}) {
  const c = compileNode(node, 'raiz', 0, { cull: cull !== false });
  return Object.freeze({ distance: c.d, sample: c.s, range: c.r });
}

const compiledCache = new WeakMap();

function compiledFor(node) {
  let c = compiledCache.get(node);
  if (!c) {
    c = compile(node);
    compiledCache.set(node, c);
  }
  return c;
}

/** Distância com sinal num ponto (compila e guarda a árvore na primeira chamada). */
export function evaluate(node, x, y, z) {
  return compiledFor(node).distance(x, y, z);
}

/**
 * Distância, material do filho mais próximo e costura (0..1) num ponto.
 * @returns {{d:number, mat:number, seam:number}}
 */
export function evaluateWithMaterial(node, x, y, z) {
  const out = createSample();
  compiledFor(node).sample(x, y, z, out);
  return out;
}

/** JSON canônico: chaves ordenadas, sem `undefined`, arrays tipados como listas. Base estável para o hash. */
export function canonicalJSON(value) {
  if (value === null || typeof value !== 'object') {
    const s = JSON.stringify(value);
    return s === undefined ? 'null' : s;
  }
  if (Array.isArray(value) || ArrayBuffer.isView(value)) {
    const parts = [];
    for (let i = 0; i < value.length; i++) parts.push(canonicalJSON(value[i]));
    return `[${parts.join(',')}]`;
  }
  const keys = Object.keys(value).filter((key) => value[key] !== undefined).sort();
  return `{${keys.map((key) => `${JSON.stringify(key)}:${canonicalJSON(value[key])}`).join(',')}}`;
}

const hex8 = (n) => (n >>> 0).toString(16).padStart(8, '0');

/**
 * Hash estável (128 bits, cyrb128 de src/core/rng.js) do JSON canônico da árvore + `extra` (resolução, versão...).
 * Independe da ordem das chaves.
 * @returns {string} 32 dígitos hexadecimais
 */
export function hashNode(node, extra = '') {
  const [a, b, c, d] = hash128(`${canonicalJSON(node)}|${extra}`);
  return hex8(a) + hex8(b) + hex8(c) + hex8(d);
}
