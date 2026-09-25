// Testes do layout da pista de testes (subfases 3.3 e 3.4): lotes na base e sem sobreposição, peças no seu lote, as
// medidas exatas de cada estação (topos, ângulos pela normal, faces de baixo, vãos, tetos, larguras, pranchas; o poço, o
// zigue-zague e a faixa de slide com os números da 3.4 e a parede sul do poço numa peça só), a espiral da torre (degraus
// ≤ 18 u, nada se cruzando) e as anotações da tábua, superfícies válidas, peças de colisão, pontos de teleporte livres e
// a busca do `estacao`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { PISTA } from '../src/data/pista.js';
import { SURFACE_INDEX } from '../src/data/surfaces.js';
import { HULL } from '../src/data/movement.js';
import { buildPistaLayout } from '../src/maps/pista/layout.js';
import { buildPistaColliders } from '../src/maps/pista/colliders.js';
import { headingDir, pieceBox, rectInside, rectsOverlap } from '../src/maps/pista/pieces.js';
import { CollisionWorld } from '../src/physics/collisionWorld.js';
import { describeStations, findStationSpot, resolveStations, searchKey } from '../src/maps/stations.js';

const layout = buildPistaLayout();
const byId = new Map(layout.pieces.map((p) => [p.id, p]));
const piece = (id) => {
  const p = byId.get(id);
  assert.ok(p, `peça ${id}`);
  return p;
};
const box = (id) => pieceBox(piece(id));
const near = (a, b, eps, msg) => assert.ok(Math.abs(a - b) <= eps, `${msg}: ${a} ≠ ${b}`);
const floorOf = (n) => PISTA.floors[PISTA.lots.find((l) => l.number === n).floor].thickness;

test('lotes: dentro da base (e da cerca), sem sobreposição; a praça também', () => {
  const inner = [[-PISTA.fence.innerX, PISTA.fence.innerX], [-PISTA.fence.innerZ, PISTA.fence.innerZ]];
  const rects = [...PISTA.lots.map((l) => [l.x, l.z, `lote ${l.number}`]), [PISTA.plaza.x, PISTA.plaza.z, 'praça']];
  for (const [x, z, name] of rects) assert.ok(rectInside(x, z, ...inner), `${name} dentro da cerca`);
  for (let i = 0; i < rects.length; i++) {
    for (let j = i + 1; j < rects.length; j++) {
      assert.ok(!rectsOverlap(rects[i][0], rects[i][1], rects[j][0], rects[j][1]), `${rects[i][2]} × ${rects[j][2]}`);
    }
  }
  assert.equal(PISTA.lots.length, 12);
});

test('peças de cada estação dentro do seu lote; ids únicos; superfícies válidas', () => {
  for (const p of layout.pieces) {
    assert.ok(p.surface in SURFACE_INDEX, `${p.id}: superfície ${p.surface}`);
    if (!p.station || p.look.kind === 'tentCard' && p.id.startsWith('lote-')) continue;
    const lot = PISTA.lots.find((l) => l.number === p.station);
    const b = pieceBox(p);
    assert.ok(rectInside([b.min.x, b.max.x], [b.min.z, b.max.z], lot.x, lot.z, 0.5),
      `${p.id} fora do lote ${lot.number}: x ${b.min.x.toFixed(1)}..${b.max.x.toFixed(1)} z ${b.min.z.toFixed(1)}..${b.max.z.toFixed(1)}`);
  }
  const ids = [...layout.pieces, ...layout.decor].map((p) => p.id);
  assert.equal(new Set(ids).size, ids.length);
});

test('escadas: topos 48/72/96/108/120/144 acima do tapete, degrau de 40 u de fundo, lombada para o sul', () => {
  const y0 = floorOf(2);
  const tops = PISTA.stairs.piles.map((p) => box(`escadas-${p.step}-5`).max.y - y0);
  assert.deepEqual(tops.map((t) => Math.round(t * 1e6) / 1e6), [48, 72, 96, 108, 120, 144]);
  for (const p of PISTA.stairs.piles) {
    for (let k = 1; k < 6; k++) {
      const lower = box(`escadas-${p.step}-${k - 1}`);
      const upper = box(`escadas-${p.step}-${k}`);
      near(upper.min.y, lower.max.y, 1e-9, `livro ${k} apoiado no de baixo (${p.step})`);
      near(lower.max.z - upper.max.z, 40, 1e-9, `degrau de 40 u (${p.step})`);
      near(upper.min.z, lower.min.z, 1e-9, 'costas alinhadas');
    }
    near(box(`escadas-${p.step}-0`).max.z, p.front, 1e-9, `frente da pilha de ${p.step}`);
  }
});

test('rampas: ângulo da face pela normal (15/30/44/46/60°), topo na altura da caixa de arquivo', () => {
  const y0 = floorOf(3);
  near(box('rampas-caixa').max.y - y0, 120, 1e-9, 'caixa');
  const walkable = Math.acos(0.7) / (Math.PI / 180);
  for (const w of PISTA.ramps.wedges) {
    const p = piece(`rampas-${w.deg}`);
    const [wd, h, l] = p.size;
    const a = new THREE.Vector3(-wd / 2, 0, 0).applyMatrix4(p.matrix);
    const b = new THREE.Vector3(wd / 2, 0, 0).applyMatrix4(p.matrix);
    const c = new THREE.Vector3(wd / 2, h, l).applyMatrix4(p.matrix);
    const n = new THREE.Vector3().crossVectors(b.clone().sub(a), c.clone().sub(a)).normalize();
    const angle = Math.acos(Math.abs(n.y)) / (Math.PI / 180);
    near(angle, w.deg, 1e-9, `cunha de ${w.deg}°`);
    assert.equal(angle < walkable, w.deg <= 44, `${w.deg}° andável?`);
    near(c.y - y0, 120, 1e-9, 'topo');
    near(c.z, PISTA.ramps.box.z[1], 1e-9, 'encosta na frente da caixa');
  }
});

test('caixas: 57/58/64/66/67/72 u acima do tapete, 128 × 128', () => {
  const y0 = floorOf(4);
  for (const row of PISTA.boxes.rows) {
    for (const h of row.heights) {
      const b = box(`caixas-${h}`);
      near(b.max.y - y0, h, 1e-9, `caixa ${h}`);
      near(b.max.x - b.min.x, 128, 1e-9, 'largura');
      near(b.max.z - b.min.z, 128, 1e-9, 'fundo');
    }
  }
});

test('wall-jump: poço de 144 × 144 por dentro, 224 u, porta 64 × 88, parede sul numa peça só; zigue-zague de 4 × 136 u', () => {
  const W = PISTA.wallJump.well;
  near(box('poco-leste').min.x - box('poco-oeste').max.x, 144, 1e-9, 'largura por dentro');
  near(box('poco-sul-leste').min.z - box('poco-norte').max.z, 144, 1e-9, 'fundo por dentro');
  near(box('poco-norte').max.y, 224, 1e-9, 'altura');
  near(box('poco-sul-leste').min.x - box('poco-sul-oeste').max.x, 64, 1e-9, 'porta');
  near(box('poco-sul-verga').min.y, W.door.height, 1e-9, 'altura da porta');
  near(box('poco-prancha').max.y, 230, 1e-9, 'prancha em cima da parede');
  near(box('poco-torre-colisao').max.y, 224, 1e-9, 'torre de blocos');
  for (const id of ['poco-sul-oeste', 'poco-sul-leste', 'poco-sul-verga']) assert.equal(piece(id).part, 'poco-sul', id);
  for (const id of ['poco-norte', 'poco-leste', 'poco-oeste']) assert.equal(piece(id).part, null, id);
  near(box('zigue-a-colisao').max.y, 128, 1e-9, 'plataforma A');
  near(box('zigue-b-colisao').max.y, 128, 1e-9, 'plataforma B');
  near(box('zigue-a-colisao').min.z - box('zigue-b-colisao').max.z, 544, 1e-9, 'vão entre as plataformas: 4 painéis');
  near(box('zigue-leste-0').min.x - box('zigue-oeste-0').max.x, 144, 1e-9, 'corredor');
  // Os painéis se alternam emendados de A até B: oeste 0, leste 0, oeste 1, leste 1.
  const panels = ['zigue-oeste-0', 'zigue-leste-0', 'zigue-oeste-1', 'zigue-leste-1'].map(box);
  near(panels[0].max.z, box('zigue-a-colisao').min.z, 1e-9, 'primeiro painel na borda de A');
  for (let i = 0; i < 4; i++) near(panels[i].max.z - panels[i].min.z, 136, 1e-9, `painel ${i}`);
  for (let i = 1; i < 4; i++) near(panels[i].max.z, panels[i - 1].min.z, 1e-9, `painel ${i} emenda no anterior`);
  near(panels[3].min.z, box('zigue-b-colisao').max.z, 1e-9, 'último painel na borda de B');
});

test('slide: traves de 70/64/58/55 u a 32/60/88/116 u da largada sobre apoios estreitos; marcas a cada 50 u; gabarito', () => {
  const S = PISTA.slide;
  assert.deepEqual(S.bars.map((b) => b.under), [70, 64, 58, 55], 'ordem do limbo');
  assert.deepEqual(S.bars.map((b) => b.at), [32, 60, 88, 116]);
  assert.ok(S.bars.at(-1).at < 129, 'a última dentro do alcance de um slide da AK (~129 u)');
  assert.ok(S.line - S.lane.x[0] >= 480, 'corrida de ~500 u até a largada');
  for (const b of S.bars) {
    const bar = box(`slide-${b.under}-trave`);
    near(bar.min.y, b.under, 1e-9, `trave ${b.kind}`);
    near((bar.min.x + bar.max.x) / 2 - S.line, b.at, 1e-9, `trave de ${b.under} a ${b.at} u da largada`);
    assert.equal(b.stack.reduce((s, h) => s + h, 0), b.under, `pilha de ${b.under}`);
    for (let j = 0; j < 2; j++) {
      near(box(`slide-${b.under}-apoio-${j}-${b.stack.length - 1}`).max.y, b.under, 1e-9, 'topo do apoio');
      for (let k = 0; k < b.stack.length; k++) {
        const size = piece(`slide-${b.under}-apoio-${j}-${k}`).size;
        assert.ok(size[0] === S.support && size[2] === S.support, `apoio estreito: ${size}`);
      }
    }
  }
  // Apoios de traves vizinhas não se tocam (os caderninhos giram até 3°: a caixa envolvente cresce um pouco).
  for (let i = 1; i < S.bars.length; i++) {
    for (let k = 0; k < S.bars[i].stack.length; k++) {
      const prev = box(`slide-${S.bars[i - 1].under}-apoio-0-${Math.min(k, S.bars[i - 1].stack.length - 1)}`);
      assert.ok(box(`slide-${S.bars[i].under}-apoio-0-${k}`).min.x > prev.max.x, `apoios da trave ${i} separados`);
    }
  }
  const marks = layout.decor.filter((d) => d.kind === 'tape' && d.id.startsWith('slide-marca-'));
  assert.deepEqual(marks.map((d) => Math.round(d.matrix.elements[12] - S.line)), [50, 100, 150, 200, 250, 300, 350, 400]);
  assert.ok(layout.decor.some((d) => d.id === 'slide-largada'), 'linha de largada');
  for (const p of PISTA.gauge.portals) {
    near(box(`gabarito-${p.clear}-verga`).min.y, p.clear, 1e-9, `verga ${p.clear}`);
    near(box(`gabarito-${p.clear}-coluna-1`).min.x - box(`gabarito-${p.clear}-coluna-0`).max.x, 64, 1e-9, 'vão de 64');
  }
});

test('torre: 78 livros, degraus ≤ 18 u, marcas exatas e pranchas nas alturas 200/420/600/900/1310', () => {
  const { books, marks } = layout.tower;
  assert.equal(books.length, 78);
  for (let i = 0; i < books.length; i++) {
    const t = books[i].y1 - books[i].y0;
    assert.ok(t > 0 && t <= 18, `livro ${i}: ${t}`);
    if (i) near(books[i].y0, books[i - 1].y1, 1e-9, `livro ${i} continua o de baixo`);
    near(books[i].heading, (270 + 18 * i) % 360, 1e-9, 'rumo');
  }
  assert.deepEqual(marks.map((m) => m.height), [200, 420, 600, 900, 1310]);
  assert.deepEqual(marks.map((m) => m.book), [11, 24, 35, 53, 77]);
  assert.deepEqual(marks.map((m) => Math.round(m.heading)), [98, 332, 170, 134, 206]);
  for (const m of marks) near(box(`torre-prancha-${m.height}`).max.y, m.height, 1e-9, `prancha ${m.height}`);
  near(box('torre-tubo').max.y, PISTA.tower.tube.height, 1e-9, 'tubo');
  // Tábua de crescimento (3.4): o dano de queda de cada prancha e o risco onde a queda do repouso passa a matar.
  const notes = PISTA.tower.growth.notes;
  assert.deepEqual(notes.map((n) => n.at), [200, 420, 600, 900, 1280, 1310]);
  assert.deepEqual(notes.map((n) => n.text), [
    '200 · sem dano', '420 · o limite seguro', '600 · −26', '900 · −62', 'daqui para cima, fatal', '1310 · fatal',
  ]);
  for (const n of notes) {
    assert.ok(layout.decor.some((d) => d.id === `torre-risco-${n.at}`), `risco ${n.at}`);
    assert.ok(layout.decor.some((d) => d.id === `torre-nota-${n.at}` && d.text === n.text), `nota ${n.at}`);
  }
  assert.ok(box('torre-regua').max.y >= 1310 + 15 * 0.62 * '1310 · fatal'.length + 12, 'a nota de cima cabe na tábua');
  // Legíveis de fora: risco e nota voltados para fora (o rumo da tábua); a nota de baixo para cima, na metade direita
  // de quem olha a tábua de fora, terminando 4 u abaixo do risco (com `up`, começando 4 u acima).
  const G = PISTA.tower.growth;
  const [ox, oz] = headingDir(G.heading);
  const [rx, rz] = headingDir(G.heading - 90);
  const decor = (id) => layout.decor.find((d) => d.id === id);
  const face = new THREE.Vector3().setFromMatrixPosition(decor('torre-risco-200').matrix);
  for (const n of notes) {
    for (const id of [`torre-risco-${n.at}`, `torre-nota-${n.at}`]) {
      const normal = new THREE.Vector3().setFromMatrixColumn(decor(id).matrix, 2);
      assert.ok(normal.x * ox + normal.z * oz > 0.999, `${id}: voltado para fora`);
    }
    const d = decor(`torre-nota-${n.at}`);
    assert.ok(new THREE.Vector3().setFromMatrixColumn(d.matrix, 0).y > 0.999, `${d.id}: de baixo para cima`);
    const p = new THREE.Vector3().setFromMatrixPosition(d.matrix);
    const side = (p.x - face.x) * rx + (p.z - face.z) * rz;
    assert.ok(side - d.size[1] / 2 > 0 && side + d.size[1] / 2 < G.size[0] / 2, `${d.id}: na metade direita (${side})`);
    if (n.up) near(p.y - d.size[0] / 2, n.at + 4, 1e-9, `${d.id}: começa no risco`);
    else near(p.y + d.size[0] / 2, n.at - 4, 1e-9, `${d.id}: termina no risco`);
  }
});

/** Caixas orientadas se cruzam (volume positivo)? Teorema do eixo separador; encostar não conta. */
function boxesIntersect(a, b, eps = 0.01) {
  const axes = (p) => [0, 1, 2].map((i) => new THREE.Vector3().setFromMatrixColumn(p.matrix, i).normalize());
  const A = axes(a);
  const B = axes(b);
  const ha = a.size.map((s) => s / 2);
  const hb = b.size.map((s) => s / 2);
  const d = new THREE.Vector3().setFromMatrixPosition(b.matrix).sub(new THREE.Vector3().setFromMatrixPosition(a.matrix));
  const tests = [...A, ...B];
  for (const u of A) for (const v of B) {
    const c = new THREE.Vector3().crossVectors(u, v);
    if (c.lengthSq() > 1e-10) tests.push(c.normalize());
  }
  for (const L of tests) {
    const ra = A.reduce((s, u, i) => s + Math.abs(u.dot(L)) * ha[i], 0);
    const rb = B.reduce((s, v, i) => s + Math.abs(v.dot(L)) * hb[i], 0);
    if (Math.abs(d.dot(L)) > ra + rb - eps) return false;
  }
  return true;
}

test('torre: livros e pranchas não se cruzam (só se apoiam); a volta de cima fica ≥ 300 u acima', () => {
  const solids = layout.pieces.filter((p) => p.id.startsWith('torre-livro-') || p.id.startsWith('torre-prancha-'));
  for (let i = 0; i < solids.length; i++) {
    for (let j = i + 1; j < solids.length; j++) {
      assert.ok(!boxesIntersect(solids[i], solids[j]), `${solids[i].id} × ${solids[j].id}`);
    }
  }
  const { books } = layout.tower;
  for (let i = 0; i + 20 < books.length; i++) assert.ok(books[i + 20].y0 - books[i].y1 >= 300, `volta acima do livro ${i}`);
});

test('vigas de 32/16/8/4 u com topo a 102 u; paredes de 0,5/1/2/4 u; vãos de 33 e 31 u; túnel com tetos a 56 e 92 u', () => {
  const y9 = floorOf(9);
  for (const b of PISTA.beams.widths) {
    const bb = box(`vigas-${b.width}`);
    near(bb.max.z - bb.min.z, b.width, 1e-9, `largura ${b.width}`);
    near(bb.max.y - y9, 102, 1e-9, 'topo');
    assert.ok(bb.min.x <= PISTA.beams.platforms[0][1] - 20 + 1e-9 && bb.max.x >= PISTA.beams.platforms[1][0] + 20 - 1e-9, 'apoiada 20 u em cada plataforma');
  }
  const inc = box('vigas-rampa');
  near(inc.max.y - y9, 96, 1e-6, 'ripa inclinada chega ao topo da plataforma');
  for (const p of PISTA.walls.row.panels) near(piece(`paredes-espessura-${p.t}`).size[2], p.t, 1e-12, `espessura ${p.t}`);
  near(box('paredes-muro-1').min.x - box('paredes-muro-0').max.x, 33, 1e-9, 'vão de 33');
  near(box('paredes-muro-2').min.x - box('paredes-muro-1').max.x, 31, 1e-9, 'vão de 31');
  const wall = PISTA.tunnel.wall;
  PISTA.tunnel.boxes.forEach((b, i) => near(box(`tunel-${i}-teto`).min.y, b.height - wall, 1e-9, `teto da caixa ${i}`));
  near(box('tunel-0-sul').max.z, PISTA.tunnel.z[0], 1e-9, 'parede sul por dentro');
  near(box('tunel-0-norte').min.z - box('tunel-0-sul').max.z, 128, 1e-9, 'largura do túnel');
});

test('pegadas: sete placas de massinha de 180 × 130 × 5 sobre o kraft, giradas até 4°', () => {
  const k = PISTA.floors.kraft.thickness;
  for (let i = 0; i < 7; i++) {
    const p = piece(`pegadas-${i}`);
    assert.equal(p.surface, 'massinha');
    assert.deepEqual([...p.size], [180, 5, 130]);
    near(box(`pegadas-${i}`).min.y, k, 1e-9, 'apoiada no kraft');
    const ang = Math.atan2(p.matrix.elements[8], p.matrix.elements[10]) / (Math.PI / 180);
    assert.ok(Math.abs(ang) <= 4 + 1e-9, `giro ${ang}`);
    // Lida de quem vem da praça (olhando para o sul, a esquerda é o leste): cada letra a oeste da anterior.
    if (i > 0) assert.ok(p.matrix.elements[12] < piece(`pegadas-${i - 1}`).matrix.elements[12], `ordem da letra ${i}`);
  }
  assert.equal(piece('pegadas-0').look.letter, 'P');
});

const builder = buildPistaColliders(layout);
const world = CollisionWorld.fromBuilder(builder, 'pista');
const stations = resolveStations(layout.stations, world);

test('colisão: ~3,5 mil triângulos (orçamento da 3.3), nenhum degenerado', () => {
  assert.equal(builder.skipped, 0);
  assert.ok(builder.triangleCount > 2000 && builder.triangleCount <= 4500, `${builder.triangleCount}`);
});

test('spawn e todos os pontos de teleporte: livres para a cápsula em pé, com chão embaixo', () => {
  const s = layout.spawn;
  assert.ok(world.canOccupy(s.x, s.y + 0.05, s.z, HULL.radius, HULL.standHeight), 'spawn');
  assert.equal(stations.length, 12);
  for (const st of stations) {
    for (const p of st.spots) {
      const { x, y, z } = p.position;
      assert.ok(world.canOccupy(x, y + 0.05, z, HULL.radius, HULL.standHeight), `${st.id} ${p.id} em ${x} ${y} ${z}`);
    }
  }
  const tower = stations.find((st) => st.id === 'torre');
  for (const h of [200, 420, 600, 900, 1310]) near(tower.spots.find((p) => p.id === String(h)).position.y, h, 1e-6, `prancha ${h}`);
});

test('estacao: número, id, apelido e ponto; ponto único sem estação; acento e maiúsculas; erros com as opções', () => {
  assert.equal(searchKey('Túnel'), 'tunel');
  const hit = (...args) => {
    const r = findStationSpot(stations, args);
    return `${r.station.id}:${r.spot.id}`;
  };
  assert.equal(hit('7', '900'), 'torre:900');
  assert.equal(hit('bhop'), 'bhop:largada');
  assert.equal(hit('gabarito'), 'slide:gabarito');
  assert.equal(hit('traves'), 'slide:traves');
  assert.equal(hit('TÚNEL', 'meio'), 'tunel:meio');
  assert.equal(hit('escada', '18'), 'escadas:18');
  assert.throws(() => findStationSpot(stations, ['16']), /mais de uma estação/);
  assert.throws(() => findStationSpot(stations, ['13']), /desconhecida/);
  assert.throws(() => findStationSpot(stations, ['torre', '1000']), /Pontos: base, 200/);
  assert.match(describeStations(stations), /^ 1 strafe/);
});
