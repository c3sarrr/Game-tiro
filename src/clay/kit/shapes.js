// Primitivas de massinha "moldadas à mão" (seção 0.13): bolota, cápsula, cilindro de borda arredondada,
// placa achatada, cobrinha por curva (tubo com raio variável e pontas redondas), gota, cone e rosca.
// Toda peça sai soldada, com normais suaves, calombos, amassados de polegar e aTouch/aSeam.
// Cada função devolve { geometry, radius, distance(p) } — `distance` é o SDF aproximado no espaço local,
// usado para marcar costuras onde duas massas se encostam (src/clay/kit/seams.js).

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { weld, sculpt, finalizeClayGeometry } from './sculpt.js';
import { createNoise3 } from './cpuNoise.js';

const _v = new THREE.Vector3();

function finish(geometry, sculptOpts, radius) {
  const g = sculpt(weld(geometry), { radius, ...sculptOpts });
  return finalizeClayGeometry(g);
}

/** Bolota/esfera amassada. `squash` = escala [x, y, z] (ex.: [1.2, 0.8, 1] achata). */
export function clayBall({ radius = 20, segments = 18, squash = [1, 1, 1], lumpiness = 0.05, dents = 3, seed = 1 } = {}) {
  const base = new THREE.IcosahedronGeometry(radius, segments);
  base.scale(squash[0], squash[1], squash[2]);
  const rMax = radius * Math.max(...squash);
  const geometry = finish(base, { seed, lumpiness, dents }, rMax);
  const rx = radius * squash[0];
  const ry = radius * squash[1];
  const rz = radius * squash[2];
  const rMin = Math.min(rx, ry, rz);
  return {
    geometry,
    radius: rMax,
    distance: (p) => (Math.hypot(p.x / rx, p.y / ry, p.z / rz) - 1) * rMin,
  };
}

/** Cápsula (salsicha de massa) ao longo de Y. */
export function clayCapsule({ radius = 8, length = 30, radialSegments = 28, capSegments = 10, lumpiness = 0.04, dents = 2, seed = 2 } = {}) {
  const base = new THREE.CapsuleGeometry(radius, length, capSegments, radialSegments, Math.max(4, Math.round(length / radius) * 3));
  const half = length / 2;
  const geometry = finish(base, { seed, lumpiness, dents, dentRadius: 0.25 }, half + radius);
  return {
    geometry,
    radius: half + radius,
    distance: (p) => {
      const y = Math.max(-half, Math.min(half, p.y));
      return Math.hypot(p.x, p.y - y, p.z) - radius;
    },
  };
}

/** Perfil de lathe com cantos arredondados (retângulo de raio `radius` × altura `height`, bisel `bevel`). */
function roundedRectProfile(radius, height, bevel, steps = 6) {
  const pts = [];
  const h = height / 2;
  const b = Math.min(bevel, radius * 0.95, h * 0.95);
  pts.push(new THREE.Vector2(0.0001, -h));
  for (let i = 0; i <= steps; i++) {
    const a = -Math.PI / 2 + (i / steps) * (Math.PI / 2);
    pts.push(new THREE.Vector2(radius - b + Math.cos(a) * b, -h + b + Math.sin(a) * b));
  }
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * (Math.PI / 2);
    pts.push(new THREE.Vector2(radius - b + Math.cos(a) * b, h - b + Math.sin(a) * b));
  }
  pts.push(new THREE.Vector2(0.0001, h));
  return pts;
}

/** Distância assinada para um sólido de revolução (perfil 2D em ρ,y ordenado de baixo para cima). */
function latheDistance(profile) {
  return (p) => {
    const rho = Math.hypot(p.x, p.z);
    let best = Infinity;
    for (let i = 0; i < profile.length - 1; i++) {
      const a = profile[i];
      const b = profile[i + 1];
      const abx = b.x - a.x;
      const aby = b.y - a.y;
      const t = Math.max(0, Math.min(1, ((rho - a.x) * abx + (p.y - a.y) * aby) / (abx * abx + aby * aby || 1)));
      best = Math.min(best, Math.hypot(rho - (a.x + abx * t), p.y - (a.y + aby * t)));
    }
    // Dentro se o raio no mesmo y é maior que ρ.
    let inside = false;
    for (let i = 0; i < profile.length - 1; i++) {
      const a = profile[i];
      const b = profile[i + 1];
      if ((a.y <= p.y && b.y > p.y) || (b.y <= p.y && a.y > p.y)) {
        const t = (p.y - a.y) / (b.y - a.y);
        if (rho < a.x + (b.x - a.x) * t) inside = !inside;
      }
    }
    return inside ? -best : best;
  };
}

/** Cilindro de massa com borda arredondada (potes, tampinhas, rodas). */
export function clayCylinder({ radius = 20, height = 30, bevel = 5, radialSegments = 40, lumpiness = 0.03, dents = 3, seed = 3 } = {}) {
  const profile = roundedRectProfile(radius, height, bevel);
  const base = new THREE.LatheGeometry(profile, radialSegments);
  const r = Math.hypot(radius, height / 2);
  const geometry = finish(base, { seed, lumpiness, dents, dentRadius: 0.22 }, r);
  return { geometry, radius: r, distance: latheDistance(profile) };
}

/** Placa achatada (bolacha, parede, tábua de massa) com cantos arredondados. */
export function claySlab({ width = 40, height = 8, depth = 30, bevel = 3, segments = 6, lumpiness = 0.025, dents = 4, seed = 4 } = {}) {
  const base = new RoundedBoxGeometry(width, height, depth, segments, Math.min(bevel, height / 2 - 0.01));
  const hx = width / 2;
  const hy = height / 2;
  const hz = depth / 2;
  const r = Math.hypot(hx, hy, hz);
  // `segments` subdivide cada face e o bisel: é o que dá vértices para os calombos agirem.
  const geometry = finish(base, { seed, lumpiness, dents, dentRadius: 0.18, dentDepth: 0.03 }, r);
  const b = Math.min(bevel, hy - 0.01);
  return {
    geometry,
    radius: r,
    distance: (p) => {
      const qx = Math.abs(p.x) - hx + b;
      const qy = Math.abs(p.y) - hy + b;
      const qz = Math.abs(p.z) - hz + b;
      const out = Math.hypot(Math.max(qx, 0), Math.max(qy, 0), Math.max(qz, 0));
      return out + Math.min(Math.max(qx, qy, qz), 0) - b;
    },
  };
}

/**
 * Cobrinha: tubo por uma curva Catmull-Rom com raio variável e pontas arredondadas (cabelo, letras,
 * alças, cordões — CSD3, CIL3, CIL9, PLA12).
 * @param {{points:number[][], radius?:number, radiusFn?:(t:number)=>number}} opts
 */
export function claySnake({
  points,
  radius = 4,
  radiusFn = null,
  tubularSegments = 72,
  radialSegments = 16,
  capSegments = 6,
  lumpiness = 0.08,
  seed = 5,
} = {}) {
  const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)), false, 'catmullrom', 0.5);
  const frames = curve.computeFrenetFrames(tubularSegments, false);
  const noise = createNoise3(seed);
  const rAt = (t) => (radiusFn ? radiusFn(t) : radius) * (1 + noise.noise(t * 6.3, seed, 0.5) * lumpiness);
  const rings = [];
  const pushRing = (center, n, b, r) => rings.push({ center, n, b, r });
  // Tampa inicial (hemisfério), corpo, tampa final.
  const t0 = frames.tangents[0].clone().negate();
  const r0 = rAt(0);
  const start = curve.getPointAt(0);
  for (let i = capSegments; i >= 1; i--) {
    const a = (i / capSegments) * (Math.PI / 2);
    pushRing(start.clone().addScaledVector(t0, Math.sin(a) * r0), frames.normals[0], frames.binormals[0], Math.cos(a) * r0);
  }
  for (let i = 0; i <= tubularSegments; i++) {
    const t = i / tubularSegments;
    pushRing(curve.getPointAt(t), frames.normals[i], frames.binormals[i], rAt(t));
  }
  const t1 = frames.tangents[tubularSegments];
  const r1 = rAt(1);
  const end = curve.getPointAt(1);
  for (let i = 1; i <= capSegments; i++) {
    const a = (i / capSegments) * (Math.PI / 2);
    pushRing(end.clone().addScaledVector(t1, Math.sin(a) * r1), frames.normals[tubularSegments], frames.binormals[tubularSegments], Math.cos(a) * r1);
  }
  const positions = [];
  for (const ring of rings) {
    for (let j = 0; j < radialSegments; j++) {
      const a = (j / radialSegments) * Math.PI * 2;
      const c = Math.cos(a);
      const s = Math.sin(a);
      positions.push(
        ring.center.x + (ring.n.x * c + ring.b.x * s) * ring.r,
        ring.center.y + (ring.n.y * c + ring.b.y * s) * ring.r,
        ring.center.z + (ring.n.z * c + ring.b.z * s) * ring.r,
      );
    }
  }
  const startPole = positions.length / 3;
  positions.push(start.x + t0.x * r0, start.y + t0.y * r0, start.z + t0.z * r0);
  const endPole = positions.length / 3;
  positions.push(end.x + t1.x * r1, end.y + t1.y * r1, end.z + t1.z * r1);
  const index = [];
  for (let i = 0; i < rings.length - 1; i++) {
    for (let j = 0; j < radialSegments; j++) {
      const a = i * radialSegments + j;
      const b = i * radialSegments + ((j + 1) % radialSegments);
      const c = (i + 1) * radialSegments + j;
      const d = (i + 1) * radialSegments + ((j + 1) % radialSegments);
      index.push(a, c, b, b, c, d);
    }
  }
  const last = (rings.length - 1) * radialSegments;
  for (let j = 0; j < radialSegments; j++) {
    index.push(startPole, j, (j + 1) % radialSegments);
    index.push(endPole, last + ((j + 1) % radialSegments), last + j);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setIndex(index);
  g.computeVertexNormals();
  // Orientação: se as normais apontarem para dentro do tubo, inverte a ordem dos triângulos.
  const nrm = g.attributes.normal;
  _v.set(positions[0] - rings[0].center.x, positions[1] - rings[0].center.y, positions[2] - rings[0].center.z);
  if (_v.dot(new THREE.Vector3(nrm.getX(0), nrm.getY(0), nrm.getZ(0))) < 0) {
    const idx = g.index.array;
    for (let i = 0; i < idx.length; i += 3) {
      const tmp = idx[i + 1];
      idx[i + 1] = idx[i + 2];
      idx[i + 2] = tmp;
    }
    g.index.needsUpdate = true;
    g.computeVertexNormals();
  }
  g.computeBoundingSphere();
  const R = g.boundingSphere.radius;
  const geometry = finalizeClayGeometry(sculpt(g, { seed, radius: R, lumpiness: 0.012, dents: 0 }));
  const samples = Array.from({ length: 48 }, (_, i) => ({ p: curve.getPointAt(i / 47), r: rAt(i / 47) }));
  return {
    geometry,
    radius: R,
    distance: (p) => {
      let best = Infinity;
      for (let i = 0; i < samples.length - 1; i++) {
        const a = samples[i].p;
        const b = samples[i + 1].p;
        const abx = b.x - a.x;
        const aby = b.y - a.y;
        const abz = b.z - a.z;
        const t = Math.max(0, Math.min(1, ((p.x - a.x) * abx + (p.y - a.y) * aby + (p.z - a.z) * abz) / (abx * abx + aby * aby + abz * abz || 1)));
        const r = samples[i].r + (samples[i + 1].r - samples[i].r) * t;
        best = Math.min(best, Math.hypot(p.x - (a.x + abx * t), p.y - (a.y + aby * t), p.z - (a.z + abz * t)) - r);
      }
      return best;
    },
  };
}

/** Gota (lathe): base redonda, ponta para cima. */
export function clayDrop({ radius = 14, height = 36, radialSegments = 32, lumpiness = 0.04, dents = 2, seed = 6 } = {}) {
  const profile = [];
  const steps = 24;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const y = -radius + t * (height + radius);
    const bulge = t < 0.35 ? Math.sin((t / 0.35) * Math.PI / 2) : Math.cos(((t - 0.35) / 0.65) * Math.PI / 2) ** 1.4;
    profile.push(new THREE.Vector2(Math.max(0.0001, radius * bulge), y));
  }
  const base = new THREE.LatheGeometry(profile, radialSegments);
  const r = Math.max(radius, height);
  const geometry = finish(base, { seed, lumpiness, dents }, r);
  return { geometry, radius: r, distance: latheDistance(profile) };
}

/** Cone de massa com ponta arredondada (chapéus, narizes, pés de mesa). */
export function clayCone({ radius = 14, height = 30, tipRadius = 2.5, radialSegments = 32, lumpiness = 0.035, dents = 2, seed = 7 } = {}) {
  const h = height / 2;
  const profile = [new THREE.Vector2(0.0001, -h)];
  const b = Math.min(3, radius * 0.3);
  for (let i = 0; i <= 5; i++) {
    const a = -Math.PI / 2 + (i / 5) * (Math.PI / 2);
    profile.push(new THREE.Vector2(radius - b + Math.cos(a) * b, -h + b + Math.sin(a) * b));
  }
  for (let i = 0; i <= 6; i++) {
    const a = (i / 6) * (Math.PI / 2);
    profile.push(new THREE.Vector2(Math.max(0.0001, tipRadius * Math.cos(a)), h - tipRadius + Math.sin(a) * tipRadius));
  }
  const base = new THREE.LatheGeometry(profile, radialSegments);
  const r = Math.hypot(radius, h);
  const geometry = finish(base, { seed, lumpiness, dents }, r);
  return { geometry, radius: r, distance: latheDistance(profile) };
}

/** Rosca/anel (argolas, pneus, olhos de botão). No plano XZ. */
export function clayTorus({ R = 16, r = 5, radialSegments = 16, tubularSegments = 56, lumpiness = 0.05, dents = 2, seed = 8 } = {}) {
  const base = new THREE.TorusGeometry(R, r, radialSegments, tubularSegments);
  base.rotateX(Math.PI / 2);
  const geometry = finish(base, { seed, lumpiness, dents, dentRadius: 0.2 }, R + r);
  return {
    geometry,
    radius: R + r,
    distance: (p) => Math.hypot(Math.hypot(p.x, p.z) - R, p.y) - r,
  };
}
