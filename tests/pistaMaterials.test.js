// Testes dos materiais novos do set e do canal de impressão do ClayMaterial (subfase 3.3), sem WebGL: o remendo de
// shader de cada material entra no shader físico do three e todo uniform que ele declara tem objeto de valor (um uniform
// sem objeto deixa a textura sem unidade e o material sai preto); materiais com o mesmo GLSL dividem o programa; a
// impressão do ClayMaterial liga a define, muda a chave do programa e troca os valores no lugar (o programa compilado
// continua lendo os mesmos objetos), e a cópia mantém a impressão.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { bookMaterial } from '../src/clay/set/bookMaterial.js';
import { measureMaterial } from '../src/clay/set/measureMaterials.js';
import { floorPaintMaterial, paintMaterial } from '../src/clay/set/paintMaterials.js';
import { decalMaterial, paperMaterial } from '../src/clay/set/printMaterials.js';
import { cardboardMaterial, tapeMaterial } from '../src/clay/set/paperMaterials.js';
import { beechMaterial, plywoodMaterial } from '../src/clay/set/woodMaterials.js';
import { ClayMaterial } from '../src/clay/ClayMaterial.js';

/** Texturas de mentira: qualquer chave vira uma textura (as do set são desenhadas em canvas no navegador). */
function fakeTextures() {
  const made = {};
  return new Proxy(made, { get: (o, k) => (typeof k === 'string' ? (o[k] ??= new THREE.Texture()) : undefined) });
}

/** Roda o onBeforeCompile sobre o shader físico do three (os #include ficam para o three expandir depois). */
function patched(material) {
  const lib = THREE.ShaderLib.physical;
  const shader = {
    uniforms: THREE.UniformsUtils.clone(lib.uniforms), vertexShader: lib.vertexShader, fragmentShader: lib.fragmentShader,
    defines: {},
  };
  material.onBeforeCompile(shader, null);
  return shader;
}

/** Uniforms declarados no texto do shader. */
function declaredUniforms(src) {
  return [...src.matchAll(/^[ \t]*uniform\s+\w+\s+(\w+)/gm)].map((m) => m[1]);
}

/** Todo uniform declarado tem objeto de valor e o texto mudou (o remendo achou as âncoras). */
function assertPatched(material, label, markers) {
  const lib = THREE.ShaderLib.physical;
  const shader = patched(material);
  assert.notEqual(shader.fragmentShader, lib.fragmentShader, `${label}: fragment sem remendo`);
  for (const name of declaredUniforms(shader.vertexShader + shader.fragmentShader)) {
    assert.ok(shader.uniforms[name], `${label}: uniform ${name} declarado sem valor`);
  }
  for (const m of markers) assert.ok(shader.vertexShader.includes(m) || shader.fragmentShader.includes(m), `${label}: sem ${m}`);
  return shader;
}

test('materiais novos do set: remendo aplicado, uniforms com valor e o que cada um lê da geometria', () => {
  const tex = fakeTextures();
  const atlas = new THREE.Texture();
  const cases = [
    ['livro', bookMaterial(tex, { atlas }), ['aBookPart', 'aBookUv', 'aBookDims', 'aSpineRect']],
    ['medidas', measureMaterial(tex), ['aMeasure']],
    ['tintas', paintMaterial(tex), ['aPaint']],
    ['chão do estúdio', floorPaintMaterial(tex), []],
    ['papel', paperMaterial(tex), []],
    ['decalque', decalMaterial(tex, { atlas }), ['aDecalRect', 'aDecalKind']],
    ['fita com etiquetas', tapeMaterial(tex, { atlas }), ['aTapeLabel', 'aTapeBox']],
    ['fita lisa', tapeMaterial(tex), []],
    ['papelão de uma face', cardboardMaterial(tex, { singleFace: true }), ['aBoard', 'aBoardSize']],
    ['papelão de parede dupla', cardboardMaterial(tex, { double: true }), ['aBoard', 'aBoardSize']],
    ['compensado da base', plywoodMaterial(tex, { sheets: [2440, 1220], origin: [-2800, -2000] }), []],
    ['faia', beechMaterial(tex), []],
  ];
  for (const [label, material, markers] of cases) assertPatched(material, label, markers);
  // O decalque recorta por alpha test com cobertura (sem transparência: não bagunça AO e DOF).
  const decal = cases.find((c) => c[0] === 'decalque')[1];
  assert.equal(decal.transparent, false);
  assert.ok(decal.alphaTest > 0 && decal.alphaToCoverage);
  // Decalques e fitas ficam por cima do que cobrem sem brigar na profundidade.
  for (const label of ['decalque', 'fita com etiquetas', 'medidas', 'papel']) {
    const m = cases.find((c) => c[0] === label)[1];
    assert.ok(m.polygonOffset && m.polygonOffsetUnits < 0, `${label}: polygonOffset`);
  }
});

test('materiais do set com o mesmo GLSL dividem o programa; cores diferentes não criam shader novo', () => {
  const tex = fakeTextures();
  const a = paintMaterial(tex, { name: 'a' });
  const b = paintMaterial(tex, { name: 'b', graphite: '#111111' });
  assert.equal(a.customProgramCacheKey(), b.customProgramCacheKey());
  const single = cardboardMaterial(tex, { singleFace: true });
  const plain = cardboardMaterial(tex);
  assert.equal(single.customProgramCacheKey(), plain.customProgramCacheKey(), 'uma face é uniform, não outro programa');
  assert.notEqual(a.customProgramCacheKey(), plain.customProgramCacheKey());
});

test('ClayMaterial: a impressão liga a define, muda a chave do programa e troca os valores no lugar', () => {
  const plain = new ClayMaterial({ color: '#C8553D', seed: 'lisa' });
  const map = new THREE.DataTexture(new Uint8Array(8 * 4 * 4), 8, 4);
  const stamped = new ClayMaterial({
    color: '#C8553D', seed: 'carimbo', imprint: { map, rect: [90, -65, -180, 130], depth: 4.5, lip: 1.1, roller: 0.3 },
  });
  assert.notEqual(plain.customProgramCacheKey(), stamped.customProgramCacheKey());
  assert.equal(patched(plain).defines.CLAY_IMPRINT, undefined);
  const shader = patched(stamped);
  assert.equal(shader.defines.CLAY_IMPRINT, '');
  for (const name of declaredUniforms(shader.vertexShader + shader.fragmentShader)) assert.ok(shader.uniforms[name], `uniform ${name}`);
  const u = stamped.clayUniforms;
  assert.equal(u.uClayImprint.value, map);
  assert.deepEqual(u.uClayImprintRect.value.toArray(), [90, -65, -180, 130]);
  assert.deepEqual(u.uClayImprintDepth.value.toArray(), [4.5, 1.1, 0.3]);
  assert.deepEqual(u.uClayImprintTexel.value.toArray(), [1 / 8, 1 / 4]);
  // Trocar a impressão (a 3.5 põe as pegadas assim) mexe só nos valores: o programa compilado lê os mesmos objetos.
  const objects = [u.uClayImprint, u.uClayImprintRect, u.uClayImprintDepth, u.uClayImprintTexel];
  const version = stamped.version;
  const map2 = new THREE.DataTexture(new Uint8Array(16 * 16 * 4), 16, 16);
  stamped.setImprint({ map: map2, rect: [1, 2, 3, 4] });
  assert.deepEqual([u.uClayImprint, u.uClayImprintRect, u.uClayImprintDepth, u.uClayImprintTexel], objects);
  assert.equal(stamped.version, version, 'sem recompilar');
  assert.equal(u.uClayImprint.value, map2);
  assert.deepEqual(u.uClayImprintRect.value.toArray(), [1, 2, 3, 4]);
  assert.deepEqual(u.uClayImprintDepth.value.toArray(), [1.6, 0.35, 0.08], 'padrões');
  assert.deepEqual(u.uClayImprintTexel.value.toArray(), [1 / 16, 1 / 16]);
  // Ligar a impressão depois de criado recompila (a define entra no programa).
  const later = new ClayMaterial({ color: '#2F6DB5', seed: 'depois' });
  const before = later.version;
  later.setImprint({ map, rect: [0, 0, 1, 1] });
  assert.ok(later.version > before, 'needsUpdate');
  assert.equal(patched(later).defines.CLAY_IMPRINT, '');
  // Cópia: a textura é compartilhada, os vetores são copiados e a impressão continua ligada.
  const copy = stamped.clone();
  assert.equal(copy.clayImprint, true);
  assert.equal(copy.clayUniforms.uClayImprint.value, map2);
  assert.notEqual(copy.clayUniforms.uClayImprintRect, u.uClayImprintRect);
  assert.deepEqual(copy.clayUniforms.uClayImprintRect.value.toArray(), [1, 2, 3, 4]);
  assert.equal(copy.customProgramCacheKey(), stamped.customProgramCacheKey());
  for (const m of [plain, stamped, later, copy]) m.dispose();
});
