// Testes das geometrias novas do set que a pista de testes usa (subfase 3.3), sem WebGL: cada peça cabe na caixa de
// colisão que a representa, nenhum triângulo fica virado contra a própria normal (o sombreado e o corte de faces de
// trás dependem disso) nem degenerado, os atributos que os materiais leem existem com o valor certo, e o ajudante de
// lotes (BatchedMesh) une os atributos das geometrias, completa os faltantes e reaproveita a geometria repetida.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { bookGeometry, spineArcLength } from '../src/clay/set/bookGeometry.js';
import {
  flagGeometry, pencilGeometry, pinGeometry, rulerGeometry, skewerGeometry, steelRulerGeometry, tapeBladeGeometry,
  tapeCaseGeometry,
} from '../src/clay/set/stationeryGeometry.js';
import { cardboardBox, cardboardPolygon, woundTube } from '../src/clay/set/boardGeometry.js';
import { balsaStick, cardboardTube } from '../src/clay/set/propGeometry.js';
import { BatchBuilder } from '../src/maps/pista/visual/batch.js';

const EPS = 1e-4;

/** Triângulos (a, b, c) da geometria, indexada ou não. */
function* triangles(geo) {
  const p = geo.attributes.position;
  const idx = geo.index;
  const count = idx ? idx.count / 3 : p.count / 3;
  for (let i = 0; i < count; i++) {
    yield idx ? [idx.getX(i * 3), idx.getX(i * 3 + 1), idx.getX(i * 3 + 2)] : [i * 3, i * 3 + 1, i * 3 + 2];
  }
}

/** Triângulos virados (a ordem dos vértices contra a normal dos vértices) e degenerados (área ≈ 0). */
function orientation(geo) {
  const p = geo.attributes.position;
  const n = geo.attributes.normal;
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  const face = new THREE.Vector3();
  const vn = new THREE.Vector3();
  const t = new THREE.Vector3();
  let flipped = 0;
  let degenerate = 0;
  let total = 0;
  for (const [i0, i1, i2] of triangles(geo)) {
    total++;
    a.fromBufferAttribute(p, i0);
    b.fromBufferAttribute(p, i1);
    c.fromBufferAttribute(p, i2);
    face.subVectors(b, a).cross(t.subVectors(c, a));
    if (face.lengthSq() < 1e-12) {
      degenerate++;
      continue;
    }
    vn.fromBufferAttribute(n, i0).add(t.fromBufferAttribute(n, i1)).add(t.fromBufferAttribute(n, i2));
    if (face.dot(vn) < 0) flipped++;
  }
  return { flipped, degenerate, total };
}

/** Sem triângulo virado nem degenerado. */
function assertOriented(geo, label) {
  const o = orientation(geo);
  assert.ok(o.total > 0, `${label}: sem triângulos`);
  assert.equal(o.flipped, 0, `${label}: ${o.flipped} de ${o.total} triângulos virados`);
  assert.equal(o.degenerate, 0, `${label}: ${o.degenerate} triângulos degenerados`);
}

/** Caixa envolvente como [min, max] em arrays. */
function box(geo) {
  geo.computeBoundingBox();
  return [geo.boundingBox.min.toArray(), geo.boundingBox.max.toArray()];
}

/** A caixa envolvente cabe em ±half (por eixo), com folga `tol`. */
function assertInside(geo, half, tol, label) {
  const [min, max] = box(geo);
  for (let k = 0; k < 3; k++) {
    assert.ok(min[k] >= -half[k] - tol && max[k] <= half[k] + tol, `${label}: eixo ${'xyz'[k]} [${min[k]}, ${max[k]}] fora de ±${half[k]}`);
  }
}

/** Valor constante de um atributo (o mesmo em todos os vértices). */
function constant(geo, name) {
  const attr = geo.attributes[name];
  assert.ok(attr, `sem o atributo ${name}`);
  const first = Array.from({ length: attr.itemSize }, (_, k) => attr.array[k]);
  for (let i = 0; i < attr.count; i++) {
    for (let k = 0; k < attr.itemSize; k++) assert.equal(attr.array[i * attr.itemSize + k], first[k], `${name} varia`);
  }
  return first;
}

test('livro: capa dura e brochura na caixa [comprimento, espessura, profundidade], atributos do bookMaterial', () => {
  for (const [size, hard] of [[[230, 16, 150], true], [[40, 3, 40], false], [[200, 17.083, 130], true]]) {
    const geo = bookGeometry(size, { hard, spineRect: [0.1, 0.2, 0.3, 0.05], seed: `teste-${size[1]}` });
    const [min, max] = box(geo);
    for (let k = 0; k < 3; k++) {
      assert.ok(Math.abs(max[k] - size[k] / 2) < EPS && Math.abs(min[k] + size[k] / 2) < EPS, `${size}: eixo ${'xyz'[k]}`);
    }
    for (const name of ['aBookPart', 'aBookUv', 'aBookDims', 'aSpineRect']) assert.ok(geo.attributes[name], name);
    const parts = new Set(geo.attributes.aBookPart.array);
    assert.deepEqual([...parts].sort(), [0, 1, 2, 3], 'pano, guarda, folhas e lombada');
    assert.deepEqual(constant(geo, 'aSpineRect').map((v) => +v.toFixed(3)), [0.1, 0.2, 0.3, 0.05]);
    assertOriented(geo, `livro ${size}`);
  }
  // A lombada arredondada é mais comprida que a espessura (o texto no atlas não estica); a da brochura quase não.
  assert.ok(spineArcLength(16, true) > 16.5 && spineArcLength(16, true) < 20);
  assert.ok(spineArcLength(3, false) - 3 < 0.05);
});

test('lápis, réguas, espeto, alfinete e bandeirinha: medidas certas e faces para fora', () => {
  // Sextavado de 7 u entre faces (deitado numa face: ±3,5 em Y, ±4,04 entre cantos em Z); a ponteira redonda passa
  // 0,3 u do sextavado, como no lápis de verdade.
  const pencil = pencilGeometry({ length: 175, across: 7, seed: 'teste' });
  const pencilHalf = { paint: [87.5, 3.5, 4.05], wood: [87.5, 3.5, 4.05], metal: [87.5, 3.85, 3.85], eraser: [87.5, 3.3, 3.3] };
  assert.deepEqual(Object.keys(pencil).sort(), Object.keys(pencilHalf).sort());
  for (const [name, geo] of Object.entries(pencil)) {
    assertInside(geo, pencilHalf[name], 0.01, `lápis.${name}`);
    assertOriented(geo, `lápis.${name}`);
  }
  assert.deepEqual([...new Set(pencil.paint.attributes.aPaint.array)].sort(), [0, 1], 'corpo pintado e grafite');
  assert.deepEqual(constant(pencil.eraser, 'aPaint'), [2], 'borracha');
  const [pMin, pMax] = box(pencil.eraser);
  assert.ok(pMin[0] < -87 && pMax[0] < -79, 'a borracha fica na ponta de trás (−X)');

  const ruler = rulerGeometry(300, 3, 30);
  assert.deepEqual(box(ruler), [[-150, -1.5, -15], [150, 1.5, 15]]);
  assert.deepEqual(constant(ruler, 'aMeasure'), [0, 300, 30, 3]);
  assertOriented(ruler, 'régua');
  const steel = steelRulerGeometry(300, 1, 25);
  assertInside(steel, [150, 0.5, 12.5], EPS, 'régua de aço');
  assert.deepEqual(constant(steel, 'aMeasure'), [1, 300, 25, 1]);
  assertOriented(steel, 'régua de aço');

  const skewer = skewerGeometry(300, 2, { seed: 'teste' });
  assertInside(skewer, [150, 2, 2], 0.01, 'espeto');
  assertOriented(skewer, 'espeto');
  const pin = pinGeometry();
  assertOriented(pin.shaft, 'alfinete');
  assertOriented(pin.head, 'cabeça do alfinete');
  assert.deepEqual(constant(pin.head, 'aPaint'), [3], 'cabeça de plástico brilhante');
  const [, shaftMax] = box(pin.shaft);
  const [headMin] = box(pin.head);
  assert.ok(headMin[1] < shaftMax[1], 'a cabeça abraça a ponta de cima da haste');
  const flag = flagGeometry({ stick: 95, seed: 'teste' });
  const [sMin, sMax] = box(flag.stick);
  assert.ok(Math.abs(sMin[1]) < EPS && Math.abs(sMax[1] - 95) < EPS, 'palito de 95 u em pé a partir do chão');
  assert.ok(sMax[0] <= 1 && sMin[0] >= -1 && sMax[2] <= 1 && sMin[2] >= -1, 'palito de Ø2');
  const [fMin, fMax] = box(flag.paper);
  assert.ok(fMin[0] > 0.9 && fMax[1] <= 95, 'papel preso ao lado do palito, abaixo da ponta');
  assertOriented(flag.stick, 'palito');
  assertOriented(flag.paper, 'papel da bandeirinha');
});

test('trena: lâmina centrada com o gancho no zero e estojo na caixa de 70 × 70 × 40', () => {
  const { blade, hook } = tapeBladeGeometry(4400, 25);
  const [bMin, bMax] = box(blade);
  assert.ok(Math.abs(bMin[0] + 2200) < EPS && Math.abs(bMax[0] - 2200) < EPS, 'comprimento');
  assert.ok(Math.abs(bMin[1] + 12.5) < EPS && Math.abs(bMax[1] - 12.5) < EPS, 'largura');
  assert.deepEqual(constant(blade, 'aMeasure'), [2, 4400, 25, 0]);
  assertOriented(blade, 'lâmina');
  const [hMin, hMax] = box(hook);
  assert.ok(hMax[0] < -2185 && hMin[0] > -2202, 'gancho na ponta do zero');
  assertOriented(hook, 'gancho');
  const parts = tapeCaseGeometry([70, 70, 40]);
  assertInside(parts.shell, [35, 35, 20], EPS, 'casca do estojo');
  // Trava em cima e presilha atrás passam um pouco da caixa, como na trena de verdade.
  assertInside(parts.rubber, [35, 35, 20], 4.5, 'borracha');
  assertInside(parts.metal, [35, 35, 20], 2.5, 'metal');
  assert.deepEqual(constant(parts.rubber, 'aPaint'), [2]);
  for (const [name, geo] of Object.entries(parts)) assertOriented(geo, `estojo.${name}`);
});

test('papelão: tubo enrolado, recortes com furos, caixa aberta sem fundo e ripa de balsa', () => {
  const tube = woundTube(84, 1310, 6, { pitch: 260 });
  const [tMin, tMax] = box(tube);
  assert.ok(Math.abs(tMax[0] - 90) < 0.5 && Math.abs(tMin[2] + 90) < 0.5, 'raio de fora = raio + parede');
  assert.equal(tMin[1], 0);
  assert.equal(tMax[1], 1310);
  const kinds = new Set();
  for (let i = 0; i < tube.attributes.aBoard.count; i++) kinds.add(tube.attributes.aBoard.getZ(i));
  assert.ok(kinds.has(3) && kinds.has(2), 'face enrolada (tipo 3) e bordas cortadas (tipo 2)');
  assertOriented(tube, 'tubo enrolado');
  assertOriented(cardboardTube(22, 100, 1.5), 'tubo de papelão');

  // Laterais das cunhas (triângulo) e a lateral da caixa de arquivo com a alça vazada.
  for (const [deg, l] of [[15, 447.85], [60, 69.28]]) {
    const len = Math.hypot(l, 120);
    const tri = new THREE.Shape([new THREE.Vector2(4 * len / 120, 0), new THREE.Vector2(l, 0), new THREE.Vector2(l, 120 - 4 * len / l)]);
    assertOriented(cardboardPolygon(tri, 4, { seed: `cunha-${deg}` }), `lateral da cunha de ${deg}°`);
  }
  const side = new THREE.Shape([new THREE.Vector2(0, 0), new THREE.Vector2(300, 0), new THREE.Vector2(300, 120), new THREE.Vector2(0, 120)]);
  const slot = new THREE.Path();
  slot.moveTo(115, 80);
  slot.lineTo(185, 80);
  slot.absarc(185, 90, 10, -Math.PI / 2, Math.PI / 2, false);
  slot.lineTo(115, 100);
  slot.absarc(115, 90, 10, Math.PI / 2, Math.PI * 1.5, false);
  side.holes.push(slot);
  const panel = cardboardPolygon(side, 4, { seed: 'arquivo' });
  assertOriented(panel, 'lateral da caixa de arquivo');
  // Área de uma face = retângulo − alça (70 × 20 + círculo de raio 10).
  let area = 0;
  const p = panel.attributes.position;
  const n = panel.attributes.normal;
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  for (const [i0, i1, i2] of triangles(panel)) {
    if (n.getZ(i0) < 0.99 || n.getZ(i1) < 0.99 || n.getZ(i2) < 0.99) continue;
    a.fromBufferAttribute(p, i0);
    b.fromBufferAttribute(p, i1);
    c.fromBufferAttribute(p, i2);
    area += b.sub(a).cross(c.sub(a)).length() / 2;
  }
  const expected = 300 * 120 - (70 * 20 + Math.PI * 100);
  assert.ok(Math.abs(area - expected) / expected < 0.02, `área da face ${area} ≠ ${expected}`);

  // Caixa da cerca: abas curtas (19 u) abertas até 0,28 × 1,3 de 90° — para fora, alcançam 19·sen(33°) além da parede.
  const fence = cardboardBox(698, 200, 40, { thickness: 6, flapOpen: 0.28, seed: 'teste', step: 40, flaps: [19, 19], bottom: false });
  const [fMin, fMax] = box(fence);
  const reach = 20 + 19 * Math.sin(0.28 * 1.3 * Math.PI / 2) + 1;
  assert.ok(fMax[1] > 200 && fMax[1] < 200 + 19 + 1, 'abas abertas passam um pouco da borda de cima');
  assert.ok(fMin[1] > -1, 'sem fundo, sem aba para baixo');
  assert.ok(fMax[2] < reach && fMin[2] > -reach, `abas curtas: z [${fMin[2]}, ${fMax[2]}]`);
  assert.ok(fMax[0] < 349 + 12 && fMin[0] > -349 - 12, `abas curtas: x [${fMin[0]}, ${fMax[0]}]`);
  assertOriented(fence, 'caixa da cerca');

  // Ripa de 680 u cortada à mão: as pontas tremem até ~2 u e as faces têm fibra de centésimos de u.
  const balsa = balsaStick(680, 32, 6, { seed: 'teste', bow: -0.45 });
  assertInside(balsa, [342, 3, 16], 0.01, 'ripa de balsa');
  assertOriented(balsa, 'ripa de balsa');
});

test('BatchBuilder: une atributos, completa faltantes com o padrão do lote e manda a geometria repetida uma vez', () => {
  const b = new BatchBuilder();
  const material = new THREE.MeshStandardMaterial();
  b.define('pecas', { material, defaults: { aPaint: [2] } });
  b.define('vazio', { material });
  assert.throws(() => b.define('pecas', { material }), /repetido/);
  assert.throws(() => b.add('outro', new THREE.BoxGeometry(), new THREE.Matrix4()), /desconhecido/);
  const painted = new THREE.BoxGeometry(10, 10, 10);
  painted.setAttribute('aPaint', new THREE.BufferAttribute(new Float32Array(painted.attributes.position.count).fill(1), 1));
  const plain = new THREE.SphereGeometry(5, 8, 6).toNonIndexed();
  const m = new THREE.Matrix4();
  b.add('pecas', painted, m.makeTranslation(0, 0, 0));
  b.add('pecas', painted, m.makeTranslation(20, 0, 0), '#ff0000');
  b.add('pecas', plain, m.makeTranslation(40, 0, 0), [0.5, 0.5, 0.5]);
  const parent = new THREE.Group();
  const out = b.build(parent);
  assert.equal(out.draws, 1, 'lote sem peças não vira desenho');
  assert.equal(out.instances, 3);
  assert.equal(out.triangles, 12 * 2 + 8 * 6 * 2 - 2 * 8);
  const mesh = parent.children[0];
  assert.ok(mesh.isBatchedMesh);
  assert.equal(mesh.name, 'pista-pecas');
  assert.ok(plain.index, 'geometria sem índice ganhou índice');
  assert.equal(plain.attributes.aPaint.getX(0), 2, 'atributo faltante com o padrão do lote');
  const color = new THREE.Color();
  mesh.getColorAt(0, color);
  assert.deepEqual(color.toArray(), [1, 1, 1], 'sem cor = branco');
  mesh.getColorAt(1, color);
  assert.deepEqual(color.toArray().map((v) => +v.toFixed(3)), [1, 0, 0]);
  const box3 = mesh.boundingBox;
  assert.ok(box3.min.x <= -5 + EPS && box3.max.x >= 45 - EPS, 'caixa envolvente cobre as três peças');
  // Atributo com tamanho diferente no mesmo lote é erro (o BatchedMesh exigiria o mesmo formato).
  const bad = new BatchBuilder().define('x', { material });
  const g1 = new THREE.BoxGeometry();
  const g2 = new THREE.BoxGeometry();
  g1.setAttribute('aTone', new THREE.BufferAttribute(new Float32Array(g1.attributes.position.count), 1));
  g2.setAttribute('aTone', new THREE.BufferAttribute(new Float32Array(g2.attributes.position.count * 2), 2));
  bad.add('x', g1, new THREE.Matrix4());
  bad.add('x', g2, new THREE.Matrix4());
  assert.throws(() => bad.build(new THREE.Group()), /tamanho diferente/);
});
