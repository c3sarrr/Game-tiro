// Varredura exata de cápsula (segmento + raio) contra um triângulo, por avanço conservador com a direção separadora.
// Com n a direção do triângulo para a cápsula nos pontos mais próximos em t, o plano perpendicular a n separa os dois
// convexos; com a cápsula deslocada ele continua separando, e a folga cai à taxa −D·n. Logo a distância nunca cai
// mais rápido que D·n e o passo t += (dist − alvo)/(−D·n) nunca atravessa o contato: contato de face converge num
// passo, aresta e vértice em poucos, e deslizar rente (D·n = 0) não custa nada. Não há "tunelamento" em nenhuma
// velocidade.

import { closestSegmentTriangle, createClosest } from './geometryQueries.js';

const MAX_ITERATIONS = 32;
/** Tolerância de distância (u) para declarar contato: a cápsula para entre o alvo e o alvo + tolerância. */
export const SWEEP_TOLERANCE = 1e-3;
/** Aproximação mais lenta que isto (fração do deslocamento) conta como deslizamento paralelo. */
const APPROACH_EPSILON = 1e-7;

const _c = createClosest();

/** Resultado reutilizável da varredura contra um triângulo. */
export function createSweepHit() {
  return { t: 1, nx: 0, ny: 0, nz: 0, px: 0, py: 0, pz: 0, startDist: Infinity };
}

function record(hit, t, nx, ny, nz) {
  hit.t = t;
  hit.nx = nx;
  hit.ny = ny;
  hit.nz = nz;
  hit.px = _c.x;
  hit.py = _c.y;
  hit.pz = _c.z;
  return true;
}

/**
 * Varre o segmento S0S1 (pontas em t = 0) pelo deslocamento D contra o triângulo `o` de T. O contato acontece
 * quando a distância segmento–triângulo chega a `target` (raio + folga). Escreve em `hit` o t, a normal de contato
 * (do triângulo para a cápsula), o ponto no triângulo e a distância inicial; devolve true se houver contato em
 * t ≤ tMax. Começando dentro do alvo, só conta se estiver se aproximando: saindo ou deslizando rente, passa.
 */
export function sweepCapsuleTriangle(s0x, s0y, s0z, s1x, s1y, s1z, dx, dy, dz, T, o, target, tMax, hit) {
  const approach = -APPROACH_EPSILON * Math.sqrt(dx * dx + dy * dy + dz * dz);
  let t = 0;
  let nx = 0;
  let ny = 0;
  let nz = 0;
  for (let i = 0; i < MAX_ITERATIONS; i++) {
    const ox = dx * t, oy = dy * t, oz = dz * t;
    const dist = Math.sqrt(closestSegmentTriangle(s0x + ox, s0y + oy, s0z + oz, s1x + ox, s1y + oy, s1z + oz, T, o, _c));
    if (i === 0) hit.startDist = dist;
    if (dist > 1e-9) {
      const inv = 1 / dist;
      nx = (_c.sx - _c.x) * inv;
      ny = (_c.sy - _c.y) * inv;
      nz = (_c.sz - _c.z) * inv;
    } else {
      // O segmento fura o triângulo: sem direção separadora, vale a normal da face virada para o meio do segmento.
      nx = T[o + 9];
      ny = T[o + 10];
      nz = T[o + 11];
      const side = ((s0x + s1x) * 0.5 + ox - T[o]) * nx + ((s0y + s1y) * 0.5 + oy - T[o + 1]) * ny
        + ((s0z + s1z) * 0.5 + oz - T[o + 2]) * nz;
      if (side < 0) {
        nx = -nx;
        ny = -ny;
        nz = -nz;
      }
    }
    const vn = dx * nx + dy * ny + dz * nz;
    if (dist <= target + SWEEP_TOLERANCE) {
      if (i === 0 && vn >= approach) return false;
      return record(hit, t, nx, ny, nz);
    }
    if (vn >= approach) return false;
    t += (dist - target) / -vn;
    if (t > tMax) return false;
  }
  // Não convergiu (contato rasante numa aresta, raríssimo): o último t ainda é seguro.
  return record(hit, t, nx, ny, nz);
}
