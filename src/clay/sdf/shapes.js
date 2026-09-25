// Formas básicas das árvores SDF compiladas em closures (distância, amostra de material, intervalo garantido) +
// esfera envolvente de cada uma para a poda nas uniões. Fórmulas exatas de Inigo Quilez (iquilezles.org/articles/
// distfunctions): esfera, cápsula, cone arredondado, caixa arredondada, cilindro arredondado, toro e cone truncado;
// o elipsoide usa a aproximação "corrigida" k0·(k0 − 1)/k1 (sem raiz de polinômio por amostra). A folha em espiral
// (rocambole, caracol, rolinho de canela) é a distância exata a uma polilinha fina sobre a espiral de Arquimedes,
// engrossada e extrudada com o "opExtrusion" arredondado de iq.
// Todas aceitam pos/rot/scale (rígida + escala uniforme, então o SDF continua exato) e mat.

import {
  fail, readInteger, readMaterial, readNonNegative, readPositive, readPositiveVec3, readTransform, readVec3,
} from './params.js';

const TAU = Math.PI * 2;

// Coordenadas locais da última toLocal(); quem chama lê logo em seguida, antes de qualquer outra chamada.
export const LP = new Float64Array(3);

/** Leva (x, y, z) do espaço do pai para o espaço local da transformação `t` (resultado em LP). */
export function toLocal(t, x, y, z) {
  const dx = x - t.px;
  const dy = y - t.py;
  const dz = z - t.pz;
  const inv = t.inv;
  LP[0] = (t.m00 * dx + t.m10 * dy + t.m20 * dz) * inv;
  LP[1] = (t.m01 * dx + t.m11 * dy + t.m21 * dz) * inv;
  LP[2] = (t.m02 * dx + t.m12 * dy + t.m22 * dz) * inv;
}

/**
 * Esfera envolvente no espaço do pai: d(p) ≥ (|p − c| − r)/rho sempre que o lado direito é positivo.
 * rho = 1 para SDF exato; o elipsoide aproximado subestima a distância até rmax/rmin vezes.
 */
export function sphereBound(t, cx, cy, cz, r, rho) {
  return {
    x: t.px + t.s * (t.m00 * cx + t.m01 * cy + t.m02 * cz),
    y: t.py + t.s * (t.m10 * cx + t.m11 * cy + t.m12 * cz),
    z: t.pz + t.s * (t.m20 * cx + t.m21 * cy + t.m22 * cz),
    r: t.s * r,
    rho,
  };
}

// Forma com SDF exato (1-Lipschitz): material fixo, costura 0, intervalo d(c) ± R.
function exactShape(d, mat, bs) {
  return {
    d,
    s(x, y, z, out) {
      out.d = d(x, y, z);
      out.mat = mat;
      out.seam = 0;
    },
    r(x, y, z, R, out) {
      const v = d(x, y, z);
      out.lo = v - R;
      out.hi = v + R;
    },
    bs,
  };
}

function sphereAt(t, cx, cy, cz, r, mat) {
  return exactShape((x, y, z) => {
    toLocal(t, x, y, z);
    const dx = LP[0] - cx;
    const dy = LP[1] - cy;
    const dz = LP[2] - cz;
    return t.s * (Math.sqrt(dx * dx + dy * dy + dz * dz) - r);
  }, mat, sphereBound(t, cx, cy, cz, r, 1));
}

// Elipsoide "corrigido" de iq: k0·(k0 − 1)/k1, k0 = |p/r|, k1 = |p/r²|. Não é Lipschitz (explode perto do centro
// e longe no eixo maior), mas f = (k0 − 1)·ρ com ρ = k0/k1 ∈ [rmin, rmax] — daí um intervalo garantido só com k0.
function ellipsoidShape(node, t, mat, path) {
  const [rx, ry, rz] = readPositiveVec3(node, 'radii', path);
  const rmin = Math.min(rx, ry, rz);
  const rmax = Math.max(rx, ry, rz);
  const ix = 1 / rx;
  const iy = 1 / ry;
  const iz = 1 / rz;
  const jx = ix * ix;
  const jy = iy * iy;
  const jz = iz * iz;
  const d = (x, y, z) => {
    toLocal(t, x, y, z);
    const lx = LP[0];
    const ly = LP[1];
    const lz = LP[2];
    const ax = lx * ix;
    const ay = ly * iy;
    const az = lz * iz;
    const bx = lx * jx;
    const by = ly * jy;
    const bz = lz * jz;
    const k0 = Math.sqrt(ax * ax + ay * ay + az * az);
    const k1 = Math.sqrt(bx * bx + by * by + bz * bz);
    return t.s * (k1 > 0 ? (k0 * (k0 - 1)) / k1 : -rmin);
  };
  return {
    d,
    s(x, y, z, out) {
      out.d = d(x, y, z);
      out.mat = mat;
      out.seam = 0;
    },
    r(x, y, z, R, out) {
      toLocal(t, x, y, z);
      const ax = LP[0] * ix;
      const ay = LP[1] * iy;
      const az = LP[2] * iz;
      const k0 = Math.sqrt(ax * ax + ay * ay + az * az);
      const spread = (R * t.inv) / rmin; // |p/r| varia no máximo R/rmin dentro da bola
      const lo = (k0 > spread ? k0 - spread : 0) - 1;
      const hi = k0 + spread - 1;
      out.lo = t.s * (lo < 0 ? lo * rmax : lo * rmin);
      out.hi = t.s * (hi < 0 ? hi * rmin : hi * rmax);
    },
    // Fora da esfera de raio rmax: f ≥ (k0 − 1)·rmin ≥ (|p|/rmax − 1)·rmin.
    bs: sphereBound(t, 0, 0, 0, rmax, rmax / rmin),
  };
}

/**
 * Folha enrolada em espiral de Arquimedes no plano XZ, extrudada no eixo Y: linha central r(θ) = r0 + pitch·θ/2π,
 * θ ∈ [0, turns·2π] (começa em +X e gira de +X para +Z), meia-espessura t, meia-altura h, bordas com raio `round`
 * e pontas redondas. Distância exata à polilinha com `perTurn` segmentos por volta (flecha < 0,5% do raio com 48).
 * Busca por janela angular, sem perder exatidão: o ponto mais próximo q de p (a uma distância D) está numa
 * semirreta pela origem cujo ângulo difere do de p no máximo asin(D/ρ) (|p − q| ≥ ρ·sen Δ para Δ ≤ 90°), então
 * uma 1ª passada com ±1 segmento em cada volta dá D0 e só se D0 pedir uma janela maior os segmentos extras entram;
 * com D0 ≥ ρ (perto do centro) a busca é completa.
 */
function spiralShape(t, mat, { r0, pitch, turns, th, hh, rd, perTurn }) {
  const n = Math.max(1, Math.ceil(turns * perTurn));
  const thetaMax = turns * TAU;
  const dTheta = thetaMax / n;
  const b = pitch / TAU;
  // Segmento i: de (ax, az) a (ax + ex, az + ez), com 1/|e|² pré-calculado.
  const ax = new Float64Array(n);
  const az = new Float64Array(n);
  const ex = new Float64Array(n);
  const ez = new Float64Array(n);
  const inv = new Float64Array(n);
  let px = r0;
  let pz = 0;
  for (let i = 0; i < n; i++) {
    const a1 = (i + 1) * dTheta;
    const r1 = r0 + b * a1;
    const qx = r1 * Math.cos(a1);
    const qz = r1 * Math.sin(a1);
    ax[i] = px;
    az[i] = pz;
    ex[i] = qx - px;
    ez[i] = qz - pz;
    inv[i] = 1 / (ex[i] * ex[i] + ez[i] * ez[i]);
    px = qx;
    pz = qz;
  }
  const seg2 = (i, x, z) => {
    const wx = x - ax[i];
    const wz = z - az[i];
    let k = (wx * ex[i] + wz * ez[i]) * inv[i];
    k = k < 0 ? 0 : k > 1 ? 1 : k;
    const dx = wx - ex[i] * k;
    const dz = wz - ez[i] * k;
    return dx * dx + dz * dz;
  };
  // Menor distância² aos segmentos cujo ângulo cai em [base − w, base + w] em cada volta (base = φ + 2πk).
  const windowed = (x, z, phi, w, best) => {
    for (let base = phi - TAU; base <= thetaMax + TAU; base += TAU) {
      let i0 = Math.floor((base - w) / dTheta);
      let i1 = Math.floor((base + w) / dTheta);
      if (i1 < 0 || i0 > n - 1) continue;
      if (i0 < 0) i0 = 0;
      if (i1 > n - 1) i1 = n - 1;
      for (let i = i0; i <= i1; i++) {
        const v = seg2(i, x, z);
        if (v < best) best = v;
      }
    }
    return best;
  };
  const dist2d = (x, z) => {
    const rho = Math.sqrt(x * x + z * z);
    let phi = Math.atan2(z, x);
    if (phi < 0) phi += TAU;
    let best = windowed(x, z, phi, dTheta, Infinity);
    const d0 = Math.sqrt(best);
    if (d0 >= rho) {
      for (let i = 0; i < n; i++) {
        const v = seg2(i, x, z);
        if (v < best) best = v;
      }
    } else {
      // A 1ª passada já cobriu ±dθ em volta de cada volta: só abre a janela se o ponto mais próximo puder
      // estar mais longe que isso em ângulo.
      const need = Math.asin(d0 / rho);
      if (need > dTheta) best = windowed(x, z, phi, need, best);
    }
    return Math.sqrt(best);
  };
  const outer = r0 + pitch * turns + th;
  return exactShape((x, y, z) => {
    toLocal(t, x, y, z);
    const wx = dist2d(LP[0], LP[2]) - th + rd;
    const wy = Math.abs(LP[1]) - hh + rd;
    const mx = wx > 0 ? wx : 0;
    const my = wy > 0 ? wy : 0;
    const inner = wx > wy ? wx : wy;
    return t.s * ((inner < 0 ? inner : 0) + Math.sqrt(mx * mx + my * my) - rd);
  }, mat, sphereBound(t, 0, 0, 0, Math.hypot(outer, hh), 1));
}

/**
 * Compila uma forma básica.
 * @returns {{d:Function, s:Function, r:Function, bs:{x:number,y:number,z:number,r:number,rho:number}}}
 */
export function compileShape(node, type, path) {
  const t = readTransform(node, path);
  const mat = readMaterial(node, path);
  switch (type) {
    case 'sphere':
      return sphereAt(t, 0, 0, 0, readPositive(node, 'r', path), mat);
    case 'ellipsoid':
      return ellipsoidShape(node, t, mat, path);
    case 'capsule': {
      const [ax, ay, az] = readVec3(node, 'a', path);
      const b = readVec3(node, 'b', path);
      const r = readPositive(node, 'r', path);
      const bax = b[0] - ax;
      const bay = b[1] - ay;
      const baz = b[2] - az;
      const baba = bax * bax + bay * bay + baz * baz;
      const inv = baba > 0 ? 1 / baba : 0;
      return exactShape((x, y, z) => {
        toLocal(t, x, y, z);
        const pax = LP[0] - ax;
        const pay = LP[1] - ay;
        const paz = LP[2] - az;
        let h = (pax * bax + pay * bay + paz * baz) * inv;
        h = h < 0 ? 0 : h > 1 ? 1 : h;
        const qx = pax - bax * h;
        const qy = pay - bay * h;
        const qz = paz - baz * h;
        return t.s * (Math.sqrt(qx * qx + qy * qy + qz * qz) - r);
      }, mat, sphereBound(t, ax + bax / 2, ay + bay / 2, az + baz / 2, Math.sqrt(baba) / 2 + r, 1));
    }
    case 'roundCone': {
      // Cone arredondado exato de iq (casca convexa de duas esferas: ra em a, rb em b), uma raiz por amostra.
      const [ax, ay, az] = readVec3(node, 'a', path);
      const b = readVec3(node, 'b', path);
      const ra = readPositive(node, 'ra', path);
      const rb = readPositive(node, 'rb', path);
      const bax = b[0] - ax;
      const bay = b[1] - ay;
      const baz = b[2] - az;
      const l2 = bax * bax + bay * bay + baz * baz;
      const rr = ra - rb;
      const a2 = l2 - rr * rr;
      if (a2 <= 1e-9 * Math.max(l2, ra * ra, rb * rb)) {
        // Uma esfera engole a outra (ou pontas coincidentes): a forma é só a esfera maior.
        return ra >= rb ? sphereAt(t, ax, ay, az, ra, mat) : sphereAt(t, b[0], b[1], b[2], rb, mat);
      }
      const il2 = 1 / l2;
      const krr = Math.sign(rr) * rr * rr;
      return exactShape((x, y, z) => {
        toLocal(t, x, y, z);
        const pax = LP[0] - ax;
        const pay = LP[1] - ay;
        const paz = LP[2] - az;
        const yy = pax * bax + pay * bay + paz * baz;
        const zz = yy - l2;
        const wx = pax * l2 - bax * yy;
        const wy = pay * l2 - bay * yy;
        const wz = paz * l2 - baz * yy;
        const x2 = wx * wx + wy * wy + wz * wz;
        const y2 = yy * yy * l2;
        const z2 = zz * zz * l2;
        const kk = krr * x2;
        let v;
        if (Math.sign(zz) * a2 * z2 > kk) v = Math.sqrt(x2 + z2) * il2 - rb;
        else if (Math.sign(yy) * a2 * y2 < kk) v = Math.sqrt(x2 + y2) * il2 - ra;
        else v = (Math.sqrt(x2 * a2 * il2) + yy * rr) * il2 - ra;
        return t.s * v;
      }, mat, sphereBound(t, ax + bax / 2, ay + bay / 2, az + baz / 2, Math.sqrt(l2) / 2 + Math.max(ra, rb), 1));
    }
    case 'roundBox': {
      const [hx, hy, hz] = readPositiveVec3(node, 'size', path);
      const r = Math.min(readNonNegative(node, 'r', path, 0), hx, hy, hz);
      const ex = hx - r;
      const ey = hy - r;
      const ez = hz - r;
      return exactShape((x, y, z) => {
        toLocal(t, x, y, z);
        const qx = Math.abs(LP[0]) - ex;
        const qy = Math.abs(LP[1]) - ey;
        const qz = Math.abs(LP[2]) - ez;
        const mx = qx > 0 ? qx : 0;
        const my = qy > 0 ? qy : 0;
        const mz = qz > 0 ? qz : 0;
        const inner = qx > qy ? (qx > qz ? qx : qz) : qy > qz ? qy : qz;
        return t.s * (Math.sqrt(mx * mx + my * my + mz * mz) + (inner < 0 ? inner : 0) - r);
      }, mat, sphereBound(t, 0, 0, 0, Math.hypot(hx, hy, hz), 1));
    }
    case 'cylinder': {
      const hh = readPositive(node, 'h', path);
      const r = readPositive(node, 'r', path);
      const rd = Math.min(readNonNegative(node, 'round', path, 0), hh, r);
      const er = r - rd;
      const eh = hh - rd;
      return exactShape((x, y, z) => {
        toLocal(t, x, y, z);
        const lx = LP[0];
        const lz = LP[2];
        const dx = Math.sqrt(lx * lx + lz * lz) - er;
        const dy = Math.abs(LP[1]) - eh;
        const ox = dx > 0 ? dx : 0;
        const oy = dy > 0 ? dy : 0;
        const inner = dx > dy ? dx : dy;
        return t.s * ((inner < 0 ? inner : 0) + Math.sqrt(ox * ox + oy * oy) - rd);
      }, mat, sphereBound(t, 0, 0, 0, Math.hypot(hh, r), 1));
    }
    case 'torus': {
      const R = readPositive(node, 'R', path);
      const r = readPositive(node, 'r', path);
      return exactShape((x, y, z) => {
        toLocal(t, x, y, z);
        const lx = LP[0];
        const ly = LP[1];
        const lz = LP[2];
        const qx = Math.sqrt(lx * lx + lz * lz) - R;
        return t.s * (Math.sqrt(qx * qx + ly * ly) - r);
      }, mat, sphereBound(t, 0, 0, 0, R + r, 1));
    }
    case 'cone': {
      // Cone truncado exato de iq: base (y = −h) com r1, topo (y = +h) com r2.
      const hh = readPositive(node, 'h', path);
      const r1 = readNonNegative(node, 'r1', path);
      const r2 = readNonNegative(node, 'r2', path);
      if (r1 === 0 && r2 === 0) fail(path, "'r1' e 'r2' não podem ser ambos 0");
      const k2x = r2 - r1;
      const k2y = 2 * hh;
      const ik2 = 1 / (k2x * k2x + k2y * k2y);
      return exactShape((x, y, z) => {
        toLocal(t, x, y, z);
        const lx = LP[0];
        const lz = LP[2];
        const qx = Math.sqrt(lx * lx + lz * lz);
        const qy = LP[1];
        const rs = qy < 0 ? r1 : r2;
        const cax = qx - (qx < rs ? qx : rs);
        const cay = Math.abs(qy) - hh;
        let tt = ((r2 - qx) * k2x + (hh - qy) * k2y) * ik2;
        tt = tt < 0 ? 0 : tt > 1 ? 1 : tt;
        const cbx = qx - r2 + k2x * tt;
        const cby = qy - hh + k2y * tt;
        const da = cax * cax + cay * cay;
        const db = cbx * cbx + cby * cby;
        return t.s * (cbx < 0 && cay < 0 ? -1 : 1) * Math.sqrt(da < db ? da : db);
      }, mat, sphereBound(t, 0, 0, 0, Math.hypot(hh, Math.max(r1, r2)), 1));
    }
    case 'spiral': {
      const th = readPositive(node, 't', path);
      const hh = readPositive(node, 'h', path);
      return spiralShape(t, mat, {
        r0: readPositive(node, 'r0', path),
        pitch: readPositive(node, 'pitch', path),
        turns: readPositive(node, 'turns', path),
        th,
        hh,
        rd: Math.min(readNonNegative(node, 'round', path, 0), th, hh),
        perTurn: readInteger(node, 'segments', path, 48, 8, 256),
      });
    }
    default:
      return fail(path, `forma desconhecida: ${type}`);
  }
}
