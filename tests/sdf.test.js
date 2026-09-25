// Testes do kit SDF (src/clay/sdf): distâncias das formas, transformações, operações (união suave, vinco de
// costura, subtração, deslocamento por ruído), a folha em espiral, caixas, intervalos de poda, hash e árvores
// inválidas. As malhas (marching cubes, fronteiras de material) e o SdfMesher estão em tests/sdfMesh.test.js.
// Nada de navegador nem WebGL.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {
  bounds, canonicalJSON, compile, createRange, createSample, evaluate, evaluateWithMaterial, hashNode, isEmptyBounds, smin,
} from '../src/clay/sdf/nodes.js';
import { fbm3, noise3, noisePerm } from '../src/clay/sdf/noise.js';
import { polygonize } from '../src/clay/sdf/marchingCubes.js';
import { RNG } from '../src/core/rng.js';
import { meshReport } from './sdfTestUtils.js';

const near = (actual, expected, eps = 1e-9, msg = '') => assert.ok(Math.abs(actual - expected) <= eps, `${msg} esperado ${expected}, veio ${actual}`);

test('formas: distâncias exatas em pontos conhecidos', () => {
  const sphere = { type: 'sphere', r: 10 };
  near(evaluate(sphere, 10, 0, 0), 0);
  near(evaluate(sphere, 0, 0, 0), -10);
  near(evaluate(sphere, 13, 4, 0), Math.hypot(13, 4) - 10);
  const ell = { type: 'ellipsoid', radii: [10, 6, 4] };
  near(evaluate(ell, 10, 0, 0), 0);
  near(evaluate(ell, 0, 6, 0), 0);
  near(evaluate(ell, 0, 0, -4), 0);
  near(evaluate(ell, 15, 0, 0), 5);
  near(evaluate(ell, 0, 0, 0), -4);
  const cap = { type: 'capsule', a: [0, 0, 0], b: [0, 10, 0], r: 2 };
  near(evaluate(cap, 2, 5, 0), 0);
  near(evaluate(cap, 0, 14, 0), 2);
  near(evaluate(cap, 0, 5, 0), -2);
  near(evaluate(cap, 0, -3, 0), 1);
  const rc = { type: 'roundCone', a: [0, 0, 0], b: [0, 10, 0], ra: 3, rb: 1 };
  near(evaluate(rc, 0, -3, 0), 0);
  near(evaluate(rc, 0, 11, 0), 0);
  near(evaluate(rc, 0, -5, 0), 2);
  near(evaluate(rc, 0, 13, 0), 2);
  near(evaluate(rc, 5, 5, 0), 5 * Math.sqrt(0.96) + 1 - 3, 1e-9, 'lateral do cone arredondado');
  const box = { type: 'roundBox', size: [5, 3, 2], r: 0.5 };
  near(evaluate(box, 5, 0, 0), 0);
  near(evaluate(box, 6, 0, 0), 1);
  near(evaluate(box, 0, 0, 0), -2);
  near(evaluate(box, 6, 4, 0), Math.sqrt(4.5) - 0.5);
  const cyl = { type: 'cylinder', h: 5, r: 3, round: 0.5 };
  near(evaluate(cyl, 3, 0, 0), 0);
  near(evaluate(cyl, 0, 5, 0), 0);
  near(evaluate(cyl, 0, 0, 0), -3);
  near(evaluate(cyl, 0, 7, 0), 2);
  near(evaluate(cyl, 4, 6, 0), Math.sqrt(4.5) - 0.5);
  const torus = { type: 'torus', R: 10, r: 2 };
  near(evaluate(torus, 12, 0, 0), 0);
  near(evaluate(torus, 10, 0, 0), -2);
  near(evaluate(torus, 0, 0, 0), 8);
  near(evaluate(torus, 0, 3, 10), 1);
  const cone = { type: 'cone', h: 5, r1: 4, r2: 2 };
  near(evaluate(cone, 0, -5, 0), 0);
  near(evaluate(cone, 0, 5, 0), 0);
  near(evaluate(cone, 0, -7, 0), 2);
  near(evaluate(cone, 0, 0, 0), -30 / Math.sqrt(104), 1e-9, 'interior do cone (lateral mais próxima)');
  // Cone arredondado com raios iguais é uma cápsula.
  const rng = new RNG('cone=capsula');
  const rc2 = { type: 'roundCone', a: [1, 2, 3], b: [4, -2, 5], ra: 1.5, rb: 1.5 };
  const cap2 = { type: 'capsule', a: [1, 2, 3], b: [4, -2, 5], r: 1.5 };
  for (let i = 0; i < 200; i++) {
    const p = [rng.float(-8, 10), rng.float(-8, 10), rng.float(-8, 10)];
    near(evaluate(rc2, ...p), evaluate(cap2, ...p), 1e-9);
  }
});

test('transformações: pos/rot/scale iguais ao Object3D do three.js e nó transform', () => {
  near(evaluate({ type: 'sphere', r: 10, pos: [5, 0, 0] }, 15, 0, 0), 0);
  const scaled = { type: 'sphere', r: 5, scale: 2 };
  near(evaluate(scaled, 10, 0, 0), 0);
  near(evaluate(scaled, 20, 0, 0), 10);
  near(evaluate(scaled, 0, 0, 0), -10);
  const rotated = { type: 'capsule', a: [0, 0, 0], b: [10, 0, 0], r: 1, rot: [0, 0, Math.PI / 2] };
  near(evaluate(rotated, 0, 11, 0), 0, 1e-9, 'eixo X girado 90° em Z vira +Y');
  // Mesma matriz do three.js (Euler 'XYZ'): um ponto da superfície local continua na superfície no mundo.
  const rot = [0.3, -0.7, 1.1];
  const pos = [1, 2, 3];
  const m = new THREE.Matrix4().compose(new THREE.Vector3(...pos), new THREE.Quaternion().setFromEuler(new THREE.Euler(...rot, 'XYZ')), new THREE.Vector3(1.5, 1.5, 1.5));
  const piece = { type: 'capsule', a: [0, 0, 0], b: [0, 6, 0], r: 1, pos, rot, scale: 1.5 };
  const onSurface = new THREE.Vector3(1, 3, 0).applyMatrix4(m);
  near(evaluate(piece, onSurface.x, onSurface.y, onSurface.z), 0, 1e-9);
  const outside = new THREE.Vector3(3, 3, 0).applyMatrix4(m);
  near(evaluate(piece, outside.x, outside.y, outside.z), 3, 1e-9, 'distância escala junto');
  const tr = { type: 'transform', pos: [0, 3, 0], scale: 2, child: { type: 'sphere', r: 1 } };
  near(evaluate(tr, 0, 5, 0), 0);
  near(evaluate(tr, 0, 3, 0), -2);
  // bend/twist com k = 0 não mudam nada; twist gira o domínio em torno de Y.
  const bar = { type: 'roundBox', size: [6, 1, 2], r: 0.2 };
  near(evaluate({ type: 'twist', k: 0, child: bar }, 1, 2, 3), evaluate(bar, 1, 2, 3));
  const k = 0.3;
  const [x, y, z] = [2, 1.5, 0.4];
  const c = Math.cos(k * y);
  const s = Math.sin(k * y);
  near(evaluate({ type: 'twist', k, child: bar }, x, y, z), evaluate(bar, c * x - s * z, y, s * x + c * z));
  const bent = { type: 'bend', k: 0.05, child: { type: 'capsule', a: [-20, 0, 0], b: [20, 0, 0], r: 1 } };
  assert.ok(evaluate(bent, 15, Math.tan(0.05 * 15) * 15, 0) < 0, 'k > 0 curva as pontas para +Y');
});

test('smooth union fica entre min − k/4 e min; longe da mistura é o min exato', () => {
  const k = 3;
  const a = { type: 'sphere', r: 4, pos: [-3, 0, 0] };
  const b = { type: 'sphere', r: 4, pos: [3, 0, 0] };
  const su = { type: 'smoothUnion', k, children: [a, b] };
  const rng = new RNG('smin');
  for (let i = 0; i < 500; i++) {
    const p = [rng.float(-10, 10), rng.float(-8, 8), rng.float(-8, 8)];
    const m = Math.min(evaluate(a, ...p), evaluate(b, ...p));
    const v = evaluate(su, ...p);
    assert.ok(v <= m + 1e-12 && v >= m - k / 4 - 1e-12, `smin fora da faixa em ${p}`);
  }
  near(evaluate(su, -7.5, 0, 0), evaluate(a, -7.5, 0, 0), 0, 'fora da faixa de mistura');
  near(smin(1, 1, 2), 1 - 0.5);
  near(smin(1, 5, 2), 1);
});

test('vinco de costura aprofunda exatamente na fronteira dA = dB e some longe dela', () => {
  const kids = [{ type: 'sphere', r: 5, pos: [-4, 0, 0] }, { type: 'sphere', r: 5, pos: [4, 0, 0] }];
  const depth = 0.4;
  const crease = { type: 'smoothUnionCrease', k: 2, depth, width: 0.6, children: kids };
  const smooth = { type: 'smoothUnion', k: 2, children: kids };
  for (const [y, z] of [[0, 0], [2.5, 1], [-3, 0.5], [0, 2.9]]) {
    near(evaluate(crease, 0, y, z) - evaluate(smooth, 0, y, z), depth, 1e-12, `plano x = 0 (${y}, ${z})`);
  }
  // Ponto da superfície da união suave em cima da costura: o vinco empurra para fora da massa.
  let lo = 0;
  let hi = 10;
  for (let i = 0; i < 80; i++) {
    const mid = (lo + hi) / 2;
    if (evaluate(smooth, 0, mid, 0) < 0) lo = mid;
    else hi = mid;
  }
  assert.ok(evaluate(crease, 0, lo, 0) > 0.3, 'superfície afundada na costura');
  near(evaluate(crease, -9, 0.5, 0), evaluate(smooth, -9, 0.5, 0), 0, 'longe da costura é igual à união suave');
  const s = evaluateWithMaterial(crease, 0, lo, 0);
  near(s.seam, 1, 1e-9, 'costura = 1 em cima do vinco');
  assert.ok(evaluateWithMaterial(crease, -9, 0, 0).seam < 1e-6);
});

test('subtract, smoothSubtract (dedada) e intersect', () => {
  const ball = { type: 'sphere', r: 10 };
  const thumb = { type: 'sphere', r: 3, pos: [10, 0, 0] };
  const hard = { type: 'subtract', a: ball, b: thumb };
  const soft = { type: 'smoothSubtract', a: ball, b: thumb, k: 1.5 };
  near(evaluate(hard, 7, 0, 0), 0);
  near(evaluate(hard, 0, 0, 0), -7, 1e-9, 'centro fica a 7 do fundo da dedada');
  near(evaluate(hard, -4, 0, 0), -6, 1e-9, 'longe da dedada vale a bola');
  const rng = new RNG('dedada');
  for (let i = 0; i < 300; i++) {
    const p = [rng.float(-12, 14), rng.float(-6, 6), rng.float(-6, 6)];
    const h = evaluate(hard, ...p);
    const v = evaluate(soft, ...p);
    assert.ok(v >= h - 1e-12 && v <= h + 1.5 / 4 + 1e-12, 'dedada suave cava um pouco mais, no máximo k/4');
  }
  const lens = { type: 'intersect', a: { type: 'sphere', r: 5, pos: [-3, 0, 0] }, b: { type: 'sphere', r: 5, pos: [3, 0, 0], mat: 1 } };
  near(evaluate(lens, 2, 0, 0), 0);
  near(evaluate(lens, 0, 0, 0), -2);
  assert.equal(evaluateWithMaterial(lens, 1.9, 0, 0).mat, 0, 'superfície ativa em x > 0 é a da esfera da esquerda');
});

test('displace: determinístico por seed, limitado por amp; ruído igual ao Perlin de referência', () => {
  const child = { type: 'sphere', r: 8 };
  const d1 = { type: 'displace', amp: 0.7, freq: 0.3, seed: 'barro', octaves: 3, child };
  const d2 = { type: 'displace', amp: 0.7, freq: 0.3, seed: 'barro', octaves: 3, child };
  const d3 = { type: 'displace', amp: 0.7, freq: 0.3, seed: 'outra', octaves: 3, child };
  const rng = new RNG('ruido');
  let differs = 0;
  for (let i = 0; i < 300; i++) {
    const p = [rng.float(-10, 10), rng.float(-10, 10), rng.float(-10, 10)];
    const v = evaluate(d1, ...p);
    assert.equal(v, evaluate(d2, ...p));
    assert.ok(Math.abs(v - evaluate(child, ...p)) <= 0.7 + 1e-12);
    if (v !== evaluate(d3, ...p)) differs++;
  }
  assert.ok(differs > 250, 'seeds diferentes dão relevos diferentes');
  // Referência: grad() original do "Improved Noise" (Perlin 2002) sobre a mesma permutação.
  const grad = (h, x, y, z) => {
    h &= 15;
    const u = h < 8 ? x : y;
    const v = h < 4 ? y : h === 12 || h === 14 ? x : z;
    return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
  };
  const table = noisePerm(42);
  const P = table.perm;
  const lerp = (t, a, b) => a + t * (b - a);
  const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);
  for (let i = 0; i < 2000; i++) {
    let [x, y, z] = [rng.float(-300, 300), rng.float(-300, 300), rng.float(-300, 300)];
    const got = noise3(table, x, y, z);
    const X = Math.floor(x) & 255, Y = Math.floor(y) & 255, Z = Math.floor(z) & 255;
    x -= Math.floor(x); y -= Math.floor(y); z -= Math.floor(z);
    const u = fade(x), v = fade(y), w = fade(z);
    const A = P[X] + Y, AA = P[A] + Z, AB = P[A + 1] + Z, B = P[X + 1] + Y, BA = P[B] + Z, BB = P[B + 1] + Z;
    const ref = lerp(w, lerp(v, lerp(u, grad(P[AA], x, y, z), grad(P[BA], x - 1, y, z)), lerp(u, grad(P[AB], x, y - 1, z), grad(P[BB], x - 1, y - 1, z))),
      lerp(v, lerp(u, grad(P[AA + 1], x, y, z - 1), grad(P[BA + 1], x - 1, y, z - 1)), lerp(u, grad(P[AB + 1], x, y - 1, z - 1), grad(P[BB + 1], x - 1, y - 1, z - 1))));
    near(got, Math.max(-1, Math.min(1, ref)), 1e-12);
    assert.ok(Math.abs(fbm3(table, x, y, z, 4)) <= 1);
  }
});

// Árvores variadas para as propriedades de caixa, intervalo e poda.
const TREES = {
  girado: { type: 'roundBox', size: [6, 1.5, 3], r: 0.5, pos: [2, -1, 4], rot: [0.4, 0.9, -0.3], scale: 1.3 },
  elipsoide: { type: 'ellipsoid', radii: [9, 3, 2], rot: [0, 0.5, 0.2], pos: [1, 1, 1] },
  vinco: { type: 'smoothUnionCrease', k: 2, depth: -0.5, width: 0.8, children: [
    { type: 'ellipsoid', radii: [6, 5, 5] }, { type: 'capsule', a: [4, 0, 0], b: [10, 3, 0], r: 1.5, mat: 1 }, { type: 'torus', R: 4, r: 1, pos: [0, 5, 0] },
  ] },
  ruido: { type: 'displace', amp: 1.2, freq: 0.4, seed: 3, octaves: 2, child: { type: 'cylinder', h: 4, r: 3, round: 1 } },
  torcido: { type: 'twist', k: 0.25, child: { type: 'roundBox', size: [5, 6, 1], r: 0.3 } },
  curvado: { type: 'bend', k: 0.06, child: { type: 'capsule', a: [-15, 0, 0], b: [15, 0, 0], r: 2 } },
  dedada: { type: 'transform', pos: [3, 0, -2], rot: [0.2, 0, 0.7], scale: 0.8, child: {
    type: 'smoothSubtract', k: 1, a: { type: 'union', children: [{ type: 'cone', h: 4, r1: 4, r2: 1.5 }, { type: 'sphere', r: 2, pos: [0, 5, 0], mat: 2 }] },
    b: { type: 'sphere', r: 1.5, pos: [0, 5, 2] } } },
  // Duas folhas encostadas na espiral inteira: união suave simples (um vinco abriria uma fresta por dentro do rolo;
  // o sulco entre as camadas nasce das bordas arredondadas de cada folha).
  rocambole: { type: 'smoothUnion', k: 0.6, seamWidth: 0.8, children: [
    { type: 'spiral', r0: 2.5, pitch: 4.6, turns: 2.2, t: 1.15, h: 8, round: 0.9, rot: [Math.PI / 2, 0, 0.3], mat: 0 },
    { type: 'spiral', r0: 4.8, pitch: 4.6, turns: 2.2, t: 1.15, h: 8, round: 0.9, rot: [Math.PI / 2, 0, 0.3], mat: 1 },
  ] },
};

// Distância 2D exata à polilinha da espiral por busca COMPLETA (referência da busca por janela do shapes.js).
function spiralPolylineDistance(x, z, { r0, pitch, turns, segments = 48 }) {
  const n = Math.ceil(turns * segments);
  const dT = (turns * Math.PI * 2) / n;
  const pt = (i) => {
    const a = i * dT;
    const r = r0 + (pitch * a) / (Math.PI * 2);
    return [r * Math.cos(a), r * Math.sin(a)];
  };
  let best = Infinity;
  for (let i = 0; i < n; i++) {
    const [ax, az] = pt(i);
    const [bx, bz] = pt(i + 1);
    const ex = bx - ax, ez = bz - az;
    let k = ((x - ax) * ex + (z - az) * ez) / (ex * ex + ez * ez);
    k = Math.max(0, Math.min(1, k));
    best = Math.min(best, Math.hypot(x - ax - ex * k, z - az - ez * k));
  }
  return best;
}

test('folha em espiral: busca por janela igual à completa, extrusão arredondada e pontas redondas', () => {
  // 2,5 voltas × 48 segmentos: os vértices caem em múltiplos exatos de π/24 (θ = π/2 e π são vértices).
  const spec = { r0: 3, pitch: 5, turns: 2.5, t: 1.2, h: 6, round: 0 };
  const node = { type: 'spiral', ...spec };
  // Linha central (vértices da polilinha): dentro, a meia-espessura da superfície.
  near(evaluate(node, 3, 0, 0), -1.2, 1e-9, 'início em +X');
  near(evaluate(node, -(3 + 2.5), 0, 0), -1.2, 1e-9, 'meia volta (θ = π)');
  near(evaluate(node, 0, 0, 3 + 1.25), -1.2, 1e-9, 'um quarto de volta (θ = π/2, gira para +Z)');
  // Acima da tampa (y > h) sobre a linha central: distância vertical exata (sem arredondamento).
  near(evaluate(node, 3, 6 + 2, 0), 2, 1e-9, 'acima da tampa');
  // Pontas redondas: além do fim (θ = 2,5 voltas) a distância cresce a partir da ponta.
  const aEnd = 2.5 * Math.PI * 2;
  const rEnd = 3 + 5 * 2.5;
  const tip = [rEnd * Math.cos(aEnd), rEnd * Math.sin(aEnd)];
  const tangent = [-Math.sin(aEnd) * rEnd + Math.cos(aEnd) * (5 / (Math.PI * 2)), Math.cos(aEnd) * rEnd + Math.sin(aEnd) * (5 / (Math.PI * 2))];
  const tl = Math.hypot(...tangent);
  const beyond = [tip[0] + (tangent[0] / tl) * 3, tip[1] + (tangent[1] / tl) * 3];
  near(evaluate(node, beyond[0], 0, beyond[1]), 3 - 1.2, 0.02, 'ponta redonda');
  // Exatidão da busca por janela: igual à completa em pontos espalhados (inclusive perto do centro e fora).
  const rng = new RNG('espiral');
  for (let i = 0; i < 3000; i++) {
    const x = rng.float(-22, 22);
    const z = rng.float(-22, 22);
    const y = rng.float(-2, 2);
    const ref = spiralPolylineDistance(x, z, spec) - 1.2;
    const refY = Math.abs(y) - 6;
    const exact = Math.min(Math.max(ref, refY), 0) + Math.hypot(Math.max(ref, 0), Math.max(refY, 0));
    near(evaluate(node, x, y, z), exact, 1e-9, `(${x.toFixed(2)}, ${y.toFixed(2)}, ${z.toFixed(2)})`);
  }
  // Bordas arredondadas: no canto da borda (sobre a linha central, y = h) o raio come a quina.
  const rounded = { ...node, round: 0.8 };
  near(evaluate(rounded, 3, 6, 0), 0, 1e-9, 'tampa plana no meio da folha');
  assert.ok(evaluate(rounded, 3 + 1.2, 6, 0) > 0, 'a quina arredondada fica fora da massa');
  assert.ok(evaluate(node, 3 + 1.2 - 1e-6, 6 - 1e-6, 0) <= 0, 'sem arredondar a quina é massa');
  // Duas folhas encostadas volta a volta: malha estanque, orientada, com as duas massas. A espiral de Arquimedes
  // deixa um canal no eixo (como a folha de massa enrolada à mão): gênero 1, sem bolsões internos.
  const tree = TREES.rocambole;
  for (const resolution of [48, 64, 96]) {
    const mesh = polygonize(compile(tree), bounds(tree), { resolution });
    const rep = meshReport(mesh);
    assert.equal(rep.open, 0, `estanque (${resolution})`);
    assert.equal(rep.badWinding, 0, `orientada (${resolution})`);
    assert.equal(rep.chi, 0, `rolo com canal no eixo: gênero 1 (${resolution})`);
    assert.equal(new Set(Array.from(mesh.mat)).size, 2, 'as duas massas aparecem');
  }
});

test('bounds contêm toda a massa (d ≤ 0) de cada árvore', () => {
  const rng = new RNG('caixas');
  for (const [name, tree] of Object.entries(TREES)) {
    const b = bounds(tree);
    assert.ok(!isEmptyBounds(b), name);
    const ext = b.max.map((v, i) => v - b.min[i]);
    let inside = 0;
    for (let i = 0; i < 6000; i++) {
      const p = [0, 1, 2].map((a) => b.min[a] - ext[a] * 0.5 + rng.next() * ext[a] * 2);
      if (evaluate(tree, ...p) > 0) continue;
      inside++;
      for (let a = 0; a < 3; a++) assert.ok(p[a] >= b.min[a] - 1e-9 && p[a] <= b.max[a] + 1e-9, `${name}: massa fora da caixa no eixo ${a}`);
    }
    assert.ok(inside > 50, `${name}: amostrou a massa`);
  }
  assert.ok(isEmptyBounds(bounds({ type: 'intersect', a: { type: 'sphere', r: 1 }, b: { type: 'sphere', r: 1, pos: [5, 0, 0] } })));
});

test('range() é um intervalo garantido e a poda por esfera não muda nenhum bit', () => {
  const rng = new RNG('intervalos');
  const q = createRange();
  const s1 = createSample();
  const s2 = createSample();
  for (const [name, tree] of Object.entries(TREES)) {
    const sdf = compile(tree);
    const plain = compile(tree, { cull: false });
    const b = bounds(tree);
    for (let i = 0; i < 400; i++) {
      const c = [0, 1, 2].map((a) => b.min[a] - 2 + rng.next() * (b.max[a] - b.min[a] + 4));
      const R = rng.float(0.05, 4);
      sdf.range(...c, R, q);
      for (let j = 0; j < 12; j++) {
        const dir = rng.onUnitSphere();
        const t = R * Math.cbrt(rng.next());
        const p = [c[0] + dir.x * t, c[1] + dir.y * t, c[2] + dir.z * t];
        const d = sdf.distance(...p);
        assert.ok(d >= q.lo - 1e-9 && d <= q.hi + 1e-9, `${name}: d = ${d} fora de [${q.lo}, ${q.hi}]`);
        assert.equal(d, plain.distance(...p), `${name}: poda mudou a distância`);
        sdf.sample(...p, s1);
        plain.sample(...p, s2);
        assert.deepEqual(s1, s2, `${name}: poda mudou a amostra`);
        assert.equal(s1.d, d, `${name}: sample.d ≠ distance`);
      }
    }
  }
});

test('hashNode: estável, independente da ordem das chaves, sensível a valores e ao extra', () => {
  const a = { type: 'smoothUnion', k: 2, children: [{ type: 'sphere', r: 3, pos: [1, 2, 3] }, { r: 1, type: 'sphere' }] };
  const b = { children: [{ pos: [1, 2, 3], r: 3, type: 'sphere' }, { type: 'sphere', r: 1 }], k: 2, type: 'smoothUnion' };
  assert.equal(hashNode(a), hashNode(b));
  assert.equal(canonicalJSON(a), canonicalJSON(b));
  assert.match(hashNode(a), /^[0-9a-f]{32}$/);
  assert.notEqual(hashNode(a), hashNode({ ...a, k: 2.0001 }));
  assert.notEqual(hashNode(a, '64:160000:v1'), hashNode(a, '96:160000:v1'));
  assert.equal(hashNode({ type: 'sphere', r: 1, pos: new Float32Array([1, 2, 3]) }), hashNode({ type: 'sphere', r: 1, pos: [1, 2, 3] }));
});

test('árvores inválidas explicam o caminho do problema', () => {
  assert.throws(() => compile({ type: 'sphere' }), /raiz.*'r' é obrigatório/);
  assert.throws(() => compile({ type: 'union', children: [{ type: 'sphere', r: 1 }, { type: 'esfera', r: 1 }] }), /raiz\.children\[1\].*desconhecido/);
  assert.throws(() => compile({ type: 'sphere', r: 1, mat: 1.5 }), /'mat'/);
  assert.throws(() => bounds({ type: 'displace', amp: 1, freq: 1 }), /'child'/);
});
