# Subfase 3.3 — Pista de testes: plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** o mapa `pista` — parque de 12 estações num compensado de 5,6 × 4 m no chão do estúdio, cada uma provando um número do movimento com objetos de verdade na escala do boneco (counter-strafe na grade de 1 m, escadas de livros, rampas, caixas nos limites do pulo, poço e zigue-zague de wall-jump, vãos de slide e gabarito de portais, torre de queda com as marcas de altura, faixa longa de bhop com trena, vigas de balsa, paredes finas, túnel baixo e placas de massinha para as pegadas) —, com teleporte por estação (`estacao`), medidor de salto e queda no `cl_showpos` e o visual de set de stop-motion do item 11 do moodboard.

**Architecture:** os números ficam em `src/data/pista.js`; um layout puro (`src/maps/pista/layout*.js`, sem WebGL) expande os dados numa lista de peças — forma de colisão, matriz, superfície e aparência — que alimenta a colisão (`colliders.js`), as estações (`src/maps/stations.js`) e o visual (`src/maps/pista/visual/`), onde as peças estáticas de um mesmo material vão para um `THREE.BatchedMesh` (`batch.js`). Geometrias e materiais novos entram no set (`src/clay/set/`), o `ClayMaterial` ganha um canal de impressão (letras carimbadas agora, pegadas na 3.5), a montagem de luz `pista` usa uma key alta com a única sombra (estática) e o medidor de salto (`src/debug/jumpMeter.js`) é puro, alimentado pelo `matchState` a cada tick como o de counter-strafe.

**Tech Stack:** JavaScript ES Modules, three 0.186.1 (BatchedMesh, DataTexture, onBeforeCompile), three-mesh-bvh 0.9.15, `node --test`.

**Especificação:** `docs/phases/phase-3.md` (seção 3.3); pesquisa e decisões de cada peça no item 11 de `docs/art/moodboard.md`. Regras: `CLAUDE.md` (sem placeholder, < 600 linhas por arquivo, números em `src/data/`).

**Como executar os blocos de código:** cada bloco ` ```js file=<caminho> ` é o conteúdo completo do arquivo e é gravado com o extrator da Tarefa 0, sem redigitar. Alterações em arquivos existentes vêm como pares "Em `arquivo`, trocar: … por: …", aplicados na ordem em que aparecem com a ferramenta de edição (cada trecho "trocar" é único no arquivo no momento em que é aplicado).

**Estado de partida:** a árvore da 3.2 (commit `ee990d8`, branch `fase-3.1`) com a pesquisa da 3.3 já registrada nos documentos (`docs/art/moodboard.md`, `docs/art/moodboard.html`, `docs/art/pinterest-boards.json`, `tools/moodboard.mjs` e a seção 3.3 de `docs/phases/phase-3.md`); `npm test` com 166 testes passando. A 3.3 entra na mesma árvore.

**Commits:** os passos "Commit" só rodam quando o usuário pedir (decisão da 3.3: nada de commit até o pedido). Toda mensagem termina com a linha `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

**Números conferidos pelos testes** (cápsula de 72/54 u e o movimento do CS:GO da 3.2): degraus de 8, 12, 16 e 18 u sobem andando, 20 e 24 u não; rampas de 15, 30 e 44° sobem, 46 e 60° escorregam (limite de 45,573°); pulo em pé com ápice de 57,03 u alcança o bloco de 57 e não o de 58, pulo agachado (66 u) alcança 64 e 66 e não 67 nem 72; portais de 73 u (em pé passa), 72 (em pé não), 55 (agachado passa) e 54 (agachado não); no túnel o boneco não levanta nas caixas de 60 u e levanta na de 96; fenda de 33 u passa e a de 31 não; de pé na viga de 4 u; pouso em cada prancha da torre exatamente em 200, 420, 600, 900 e 1310 u; todo degrau da espiral com no máximo 18 u; colisão com 3532 triângulos (teto de 4500); 10 minutos simulados por estação sem penetração e idênticos bit a bit em duas rodadas. Medidor de salto: pulo parado de 57 u em 48 ticks com pouso a 285,5 u/s; queda de 900 u com pouso a ~1200 u/s.

**Números medidos no navegador** (preset Alto, 1920 × 1080, GPU do usuário): 31 desenhos estáticos da pista (lotes + malhas próprias) com 285 mil triângulos no total; na vista do spawn, ~60 draws e ~206 mil triângulos no quadro, GPU ~4,2 ms (a sala de testes, na mesma máquina e preset: 3,3 ms); vista geral de cima 345 mil triângulos; montagem do mapa em ~1,5 s (cache de shader quente); geometrias, texturas e programas voltam aos valores do menu em 3 ciclos menu ↔ pista.

**Validação do próprio plano:** antes de ser gravado, o plano foi aplicado tarefa por tarefa numa cópia limpa do projeto (commit `ee990d8`) com o extrator e os pares: em cada tarefa com teste novo o teste falha antes da implementação e passa depois, e a suíte inteira passa ao fim de cada tarefa; no fim, cada arquivo criado ou alterado ficou idêntico ao da implementação que foi verificada no navegador com a rotina da Tarefa 8.

---

## Mapa de arquivos

| Arquivo | Responsabilidade |
|---|---|
| `src/data/pista.js` | **novo** — base, cerca, lotes, praça, as 12 estações, cores e títulos dos livros, aparência (`look`) e os pontos de teleporte |
| `src/maps/pista/pieces.js` | **novo** — lista de peças e enfeites, matrizes por rumo (yaw, faixa no chão, decalque de parede e de chão), caixa de uma peça |
| `src/maps/pista/layout.js` | **novo** — layout puro: base, chão do estúdio, cerca, lotes com fitas e plaquinhas, praça e as estações |
| `src/maps/pista/layoutGround.js` | **novo** — estações 1–4 (counter-strafe, escadas de livros, rampas, caixas de faia) |
| `src/maps/pista/layoutAdvanced.js` | **novo** — estações 5–6 (poço e zigue-zague de wall-jump, vãos de slide e gabarito) |
| `src/maps/pista/layoutTower.js` | **novo** — estação 7 (tubo, espiral de 78 livros, pranchas, alvos e tábua de crescimento) |
| `src/maps/pista/layoutCourse.js` | **novo** — estações 8–12 (bhop, vigas, paredes finas, túnel, pegadas) |
| `src/maps/pista/colliders.js` | **novo** — `ColliderBuilder` a partir das peças (caixas, cunhas, cilindros, plaquinhas em "A") |
| `src/maps/stations.js` | **novo** — estações de mapa: altura do chão por raio, lista e busca do `estacao` |
| `src/render/studio/fixtures.js` | `deskLampBase` (a base da luminária no mesmo ponto para colisão e desenho) |
| `src/debug/jumpMeter.js` | **novo** — medidor de salto e queda (voo e série de bhop) |
| `src/clay/set/bookGeometry.js` | **novo** — livro de capa dura e brochura com lombada arredondada |
| `src/clay/set/stationeryGeometry.js` | **novo** — lápis, régua de madeira e de aço, trena (lâmina, gancho, estojo), espeto, alfinete, bandeirinha |
| `src/clay/set/boardGeometry.js` | caixa aberta com abas curtas e sem fundo, recorte de papelão com furos (`cardboardPolygon`), tubo enrolado (`woundTube`) |
| `src/clay/set/propGeometry.js` | borda do tubo de papelão virada corretamente; empeno fixo da ripa de balsa |
| `src/maps/pista/visual/batch.js` | **novo** — `BatchBuilder`: peças de um material num `BatchedMesh` |
| `src/clay/set/bookMaterial.js` | **novo** — material dos livros e o atlas das lombadas |
| `src/clay/set/measureMaterials.js` | **novo** — régua, régua de aço, lâmina da trena, tábua de crescimento e papel quadriculado |
| `src/clay/set/paintMaterials.js` | **novo** — laca, grafite, borracha e plástico brilhante; chão pintado do estúdio |
| `src/clay/set/printMaterials.js` | **novo** — papel no chão e decalque de atlas (tinta, papel impresso, grafite) |
| `src/clay/set/paperMaterials.js` | papelão tingível por peça, uma face com as ondas à mostra, tubo enrolado, fita com etiquetas de atlas |
| `src/clay/set/woodMaterials.js` | faia e compensado (chapas, emendas, parafusos e riscos de lápis); balsa tingível |
| `src/clay/set/labelAtlas.js` | `drawHandwriting` e `handwritingWidth` reaproveitáveis (planta, notas, placas) |
| `src/clay/set/index.js` | fábricas novas na biblioteca (`beech`, `plywood`, `measure`, `paper`, `paint`, `floorPaint`) |
| `src/clay/ClayMaterial.js` | canal de impressão opcional (`imprint`, define `CLAY_IMPRINT`, `setImprint` no lugar) |
| `src/maps/pista/visual/*.js` | **novos** — `common`, `floor`, `books`, `wood`, `cardboard`, `art`, `plan`, `extras`, `clayPlates` e `index` |
| `src/data/studioRigs.js` | montagem de luz `pista` |
| `src/render/studio/studioRig.js`, `environment.js`, `dust.js` | foco da sombra da spot, sala do ambiente com tamanho e poeira em caixa |
| `src/data/qualityPresets.js`, `src/render/renderSystem.js` | teto do mapa de sombra (4096 e o máximo da GPU) |
| `src/render/dispose.js` | `BatchedMesh.dispose()` na troca de mapa |
| `src/maps/pista/index.js` | **novo** — registra o mapa `pista` (apelidos `treino`, `parque`, `obstaculos`) |
| `src/debug/stationCommands.js` | **novo** — comando `estacao [n\|nome] [ponto]` |
| `src/maps/index.js`, `src/maps/registry.js` | importa a pista; `MapInstance.stations` documentado |
| `src/modes/matchState.js` | medidor de salto por tick, teleporte que interrompe o voo, dica das estações no HUD |
| `src/debug/showPos.js`, `src/debug/movementCommands.js`, `src/debug/commands.js` | linhas de salto e bhop; `cl_salto_reset`; registro do `estacao` |
| `src/ui/sandboxHud.js`, `src/ui/menuState.js` | dica do `estacao`; botão "Pista de testes" |
| testes novos | `pistaLayout`, `pistaMovement`, `pistaFuzz`, `jumpMeter`, `pistaGeometry`, `pistaMaterials`, `pistaRig`, `stationCommands` |

---

### Tarefa 0: Extrator dos blocos do plano

**Files:**
- Create: `<scratchpad>/extract-plan.mjs` (fora do projeto)

- [ ] **Passo 1: Criar o extrator** — o mesmo da 3.1 e da 3.2: lê o plano e grava cada bloco ` ```js file=... ` no caminho indicado, só para os arquivos pedidos na linha de comando.

```js
// Uso: node extract-plan.mjs <plano.md> <raiz do projeto> <arquivo> [arquivo...]
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';

const [plan, root, ...wanted] = process.argv.slice(2);
const text = readFileSync(plan, 'utf8');
const re = /^```[a-z]+ file=(\S+)\n([\s\S]*?)^```$/gm;
const blocks = new Map();
for (const m of text.matchAll(re)) blocks.set(m[1], m[2]);
for (const file of wanted) {
  if (!blocks.has(file)) throw new Error(`bloco não encontrado no plano: ${file}`);
  const out = join(root, file);
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, blocks.get(file));
  console.log(`gravado ${file} (${blocks.get(file).split('\n').length - 1} linhas)`);
}
```

- [ ] **Passo 2: Conferir** — `node extract-plan.mjs docs/phases/phase-3.3-plan.md . src/debug/jumpMeter.js` grava o arquivo pedido (apagar o arquivo de novo: a Tarefa 2 o cria no passo certo).

---

### Tarefa 1: Dados, peças, layout puro, colisão e estações da pista

**Files:**
- Create: `src/data/pista.js`, `src/maps/pista/pieces.js`, `src/maps/pista/layout.js`, `src/maps/pista/layoutGround.js`, `src/maps/pista/layoutAdvanced.js`, `src/maps/pista/layoutTower.js`, `src/maps/pista/layoutCourse.js`, `src/maps/pista/colliders.js`, `src/maps/stations.js`
- Modify: `src/render/studio/fixtures.js`
- Test: `tests/pistaLayout.test.js`, `tests/pistaMovement.test.js`, `tests/pistaFuzz.test.js`

O layout é puro (sem WebGL): os testes do Node leem as mesmas peças que o mapa monta. `pistaLayout` confere a geometria de cada estação contra os números do desenho; `pistaMovement` põe o `PlayerPawn` da 3.2 na colisão real da pista e prova os limites do movimento em cada estação; `pistaFuzz` roda 10 minutos simulados de entrada aleatória a partir de cada estação.

- [ ] **Passo 1: Escrever os testes**

```js file=tests/pistaLayout.test.js
// Testes do layout da pista de testes (subfase 3.3): lotes na base e sem sobreposição, peças no seu lote, as medidas
// exatas de cada estação (topos, ângulos pela normal, faces de baixo, vãos, tetos, larguras, pranchas), a espiral da
// torre (degraus ≤ 18 u, nada se cruzando), superfícies válidas, pontos de teleporte livres e a busca do `estacao`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { PISTA } from '../src/data/pista.js';
import { SURFACE_INDEX } from '../src/data/surfaces.js';
import { HULL } from '../src/data/movement.js';
import { buildPistaLayout } from '../src/maps/pista/layout.js';
import { buildPistaColliders } from '../src/maps/pista/colliders.js';
import { pieceBox, rectInside, rectsOverlap } from '../src/maps/pista/pieces.js';
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

test('wall-jump: poço de 176 × 176 por dentro, 256 u, porta 96 × 88; zigue-zague com plataformas de 128 u', () => {
  const W = PISTA.wallJump.well;
  near(box('poco-leste').min.x - box('poco-oeste').max.x, 176, 1e-9, 'largura por dentro');
  near(box('poco-sul-leste').min.z - box('poco-norte').max.z, 176, 1e-9, 'fundo por dentro');
  near(box('poco-norte').max.y, 256, 1e-9, 'altura');
  near(box('poco-sul-leste').min.x - box('poco-sul-oeste').max.x, 96, 1e-9, 'porta');
  near(box('poco-sul-verga').min.y, W.door.height, 1e-9, 'altura da porta');
  near(box('poco-prancha').max.y, 262, 1e-9, 'prancha em cima da parede');
  near(box('poco-torre-colisao').max.y, 256, 1e-9, 'torre de blocos');
  near(box('zigue-a-colisao').max.y, 128, 1e-9, 'plataforma A');
  near(box('zigue-b-colisao').max.y, 128, 1e-9, 'plataforma B');
  near(box('zigue-a-colisao').min.z - box('zigue-b-colisao').max.z, 640, 1e-9, 'vão entre as plataformas');
});

test('slide: face de baixo das traves em 70/64/58/55 u sobre apoios da altura exata; gabarito 73/72/55/54', () => {
  for (const b of PISTA.slide.bars) {
    near(box(`slide-${b.under}-trave`).min.y, b.under, 1e-9, `trave ${b.kind}`);
    assert.equal(b.stack.reduce((s, h) => s + h, 0), b.under, `pilha de ${b.under}`);
    for (let j = 0; j < 2; j++) near(box(`slide-${b.under}-apoio-${j}-${b.stack.length - 1}`).max.y, b.under, 1e-9, 'topo do apoio');
  }
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
  assert.equal(hit('TÚNEL', 'meio'), 'tunel:meio');
  assert.equal(hit('escada', '18'), 'escadas:18');
  assert.throws(() => findStationSpot(stations, ['16']), /mais de uma estação/);
  assert.throws(() => findStationSpot(stations, ['13']), /desconhecida/);
  assert.throws(() => findStationSpot(stations, ['torre', '1000']), /Pontos: base, 200/);
  assert.match(describeStations(stations), /^ 1 strafe/);
});
```


```js file=tests/pistaMovement.test.js
// Movimento na colisão real da pista de testes (subfase 3.3): o jogador do jogo (playerMove com a faca, 64 tick) prova
// os números de cada estação — escadas de 8/12/16/18 u sobem andando e as de 20/24 não; rampas de 15/30/44° sobem e as
// de 46/60° escorregam; o pulo em pé alcança 57 e não 58, o pulo agachado alcança 64 e 66 e não 67 nem 72; portais
// 73/72 em pé e 55/54 agachado; no túnel não levanta nas caixas de 60 u e levanta na de 96; vão de 33 u passa e de 31
// não; de pé na viga de 4 u; pouso em cada prancha da torre na altura exata; roteiro que sobe a espiral até a prancha.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PISTA } from '../src/data/pista.js';
import { CONTROLLER } from '../src/data/movement.js';
import { buildPistaLayout } from '../src/maps/pista/layout.js';
import { buildPistaColliders } from '../src/maps/pista/colliders.js';
import { headingDir, headingOf } from '../src/maps/pista/pieces.js';
import { CollisionWorld } from '../src/physics/collisionWorld.js';
import { resolveStations } from '../src/maps/stations.js';
import { BTN } from '../src/player/moveCmd.js';
import { forward, idle, makePlayer, run } from './playerTestUtils.js';

const DEG = Math.PI / 180;
const layout = buildPistaLayout();
const world = CollisionWorld.fromBuilder(buildPistaColliders(layout), 'pista');
const stations = resolveStations(layout.stations, world);
const spot = (station, id) => stations.find((s) => s.id === station).spots.find((p) => p.id === id);
const floorOf = (n) => PISTA.floors[PISTA.lots.find((l) => l.number === n).floor].thickness;
const skin = CONTROLLER.skin;

/** Jogador no ponto de teleporte, olhando para o rumo do ponto (yaw = −rumo). */
function atSpot(station, id) {
  const s = spot(station, id);
  return makePlayer(world, [s.position.x, s.position.y, s.position.z], { yaw: s.yaw });
}

/** Anda para a frente `ticks` ticks (com `buttons`) e devolve a maior altura dos pés. */
function walk(p, ticks, buttons = 0) {
  let top = p.state.origin.y;
  run(p, ticks, (c) => {
    forward(c);
    c.buttons = buttons;
    top = Math.max(top, p.state.origin.y);
  });
  return Math.max(top, p.state.origin.y);
}

test('spawn: de pé no compensado', () => {
  const s = layout.spawn;
  const p = makePlayer(world, [s.x, s.y, s.z]);
  run(p, 8, idle);
  assert.ok(p.state.onGround);
  assert.ok(Math.abs(p.state.origin.y - skin) < 1e-6, `${p.state.origin.y}`);
});

test('escadas: 8, 12, 16 e 18 u sobem andando até o topo; 20 e 24 u não sobem', () => {
  const y0 = floorOf(2);
  for (const step of [8, 12, 16, 18]) {
    const top = walk(atSpot('escadas', String(step)), 160);
    assert.ok(top >= y0 + 6 * step - 0.1, `degrau de ${step}: chegou a ${top}`);
  }
  for (const step of [20, 24]) {
    const top = walk(atSpot('escadas', String(step)), 160);
    assert.ok(top < y0 + step, `degrau de ${step} não sobe andando: chegou a ${top}`);
  }
});

test('rampas: 15, 30 e 44° sobem até a caixa de arquivo; 46 e 60° escorregam', () => {
  const top = floorOf(3) + PISTA.ramps.box.height;
  for (const deg of [15, 30, 44]) assert.ok(walk(atSpot('rampas', String(deg)), 200) >= top - 0.1, `${deg}° sobe`);
  for (const deg of [46, 60]) assert.ok(walk(atSpot('rampas', String(deg)), 200) < top - 30, `${deg}° escorrega`);
});

/**
 * Encostado na face sul do bloco `h`, pula (em pé, ou pulo + Ctrl segurando o Ctrl) empurrando contra ele; conta se em
 * algum tick ficou de pé no topo.
 */
function jumpOnto(h, crouch) {
  const row = PISTA.boxes.rows.find((r) => r.heights.includes(h));
  const [x0, x1] = PISTA.boxes.columns[row.heights.indexOf(h)];
  const y0 = floorOf(4);
  const p = makePlayer(world, [(x0 + x1) / 2, y0, row.z[1] + 16.5], { yaw: 0 });
  run(p, 4, idle);
  const hold = crouch ? BTN.DUCK : 0;
  let on = false;
  let apex = 0;
  run(p, 80, (c, i) => {
    forward(c);
    c.buttons = hold | (i === 0 ? BTN.JUMP : 0);
    apex = Math.max(apex, p.state.origin.y);
    if (p.state.onGround && p.state.origin.y > y0 + h - 0.1) on = true;
  });
  return { on, apex: apex - y0 };
}

test('caixas: pulo em pé alcança 57 e não 58; pulo agachado alcança 64 e 66 e não 67 nem 72', () => {
  for (const [h, crouch, ok] of [[57, false, true], [58, false, false], [64, true, true], [66, true, true], [67, true, false], [72, true, false]]) {
    const r = jumpOnto(h, crouch);
    assert.equal(r.on, ok, `${crouch ? 'pulo agachado' : 'pulo em pé'} na caixa de ${h}: ápice ${r.apex}`);
  }
});

/** Atravessa o portal de vão livre `clear` de norte para sul, em pé ou agachado. */
function throughPortal(clear, crouch) {
  const portal = PISTA.gauge.portals.find((q) => q.clear === clear);
  const p = makePlayer(world, [portal.x, 0, PISTA.gauge.z - 110], { yaw: -180 * DEG });
  const hold = crouch ? BTN.DUCK : 0;
  run(p, 30, (c) => {
    idle(c);
    c.buttons = hold;
  });
  walk(p, 160, hold);
  return p.state.origin.z > PISTA.gauge.z + PISTA.gauge.depth / 2 + 16;
}

test('gabarito: 73 u passa em pé e 72 não; 55 u passa agachado e 54 não', () => {
  assert.equal(throughPortal(73, false), true, '73 em pé');
  assert.equal(throughPortal(72, false), false, '72 em pé');
  assert.equal(throughPortal(55, true), true, '55 agachado');
  assert.equal(throughPortal(54, true), false, '54 agachado');
});

test('túnel: agachado entra; nas caixas de 60 u não levanta, na de 96 u levanta sozinho', () => {
  const p = atSpot('tunel', 'entrada');
  run(p, 30, (c) => {
    idle(c);
    c.buttons = BTN.DUCK;
  });
  // Entra agachado até o meio da primeira caixa baixa e solta o Ctrl.
  run(p, 200, (c) => {
    forward(c);
    c.buttons = BTN.DUCK;
    if (p.state.origin.x > 1500) c.forward = 0;
  });
  run(p, 40, idle);
  assert.ok(p.state.origin.x > 1450 && p.state.origin.x < 1640, `na caixa baixa (x ${p.state.origin.x})`);
  assert.equal(p.state.ducked, true, 'sem espaço para levantar na caixa de 60 u');
  // Sem o Ctrl, anda (ainda agachado) até a caixa alta: levanta lá.
  run(p, 320, (c) => {
    forward(c);
    if (p.state.origin.x > 1800) c.forward = 0;
  });
  run(p, 40, idle);
  assert.ok(p.state.origin.x > 1700 && p.state.origin.x < 1940, `na caixa alta (x ${p.state.origin.x})`);
  assert.equal(p.state.ducked, false, 'levanta na caixa de 96 u');
  assert.equal(p.state.height, 72);
});

test('paredes finas: vão de 33 u passa, de 31 u não', () => {
  const G = PISTA.walls.gapWall;
  for (const gap of G.gaps) {
    const p = makePlayer(world, [gap.x, floorOf(10), G.z + 80], { yaw: 0 });
    walk(p, 120);
    assert.equal(p.state.origin.z < G.z - 40, gap.width > 32 + 2 * skin, `vão de ${gap.width} (z ${p.state.origin.z})`);
  }
});

test('vigas: de pé na ripa de 4 u e andando nela até o meio do vão', () => {
  const b = PISTA.beams.widths.find((w) => w.width === 4);
  const y = floorOf(9) + PISTA.beams.height + PISTA.beams.beam.thickness;
  const p = makePlayer(world, [-1100, y, b.z], { yaw: -90 * DEG });
  run(p, 16, idle);
  assert.ok(p.state.onGround && Math.abs(p.state.origin.y - (y + skin)) < 1e-6, `parado em ${p.state.origin.y}`);
  run(p, 64, forward);
  assert.ok(p.state.onGround && Math.abs(p.state.origin.y - (y + skin)) < 1e-6, `andando em ${p.state.origin.y}`);
  assert.ok(p.state.origin.x > -900, `andou ${p.state.origin.x}`);
});

test('torre: cai de 30 u em cada prancha e para na altura exata', () => {
  for (const h of [200, 420, 600, 900, 1310]) {
    const s = spot('torre', String(h)).position;
    const p = makePlayer(world, [s.x, s.y + 30, s.z]);
    run(p, 60, idle);
    assert.ok(p.state.onGround, `prancha ${h}`);
    assert.ok(Math.abs(p.state.origin.y - (h + skin)) < 1e-6, `prancha ${h}: pés em ${p.state.origin.y}`);
  }
});

test('torre: roteiro de passos sobe a espiral (12 livros de 16 u) e sai na prancha de 200 u', () => {
  const T = PISTA.tower;
  const [ax, az] = T.axis;
  const p = atSpot('torre', 'base');
  const mark = layout.tower.marks[0];
  const [wx, wz] = headingDir(mark.heading);
  const goal = [ax + wx * T.spot.at, az + wz * T.spot.at]; // ponto de teleporte da prancha
  let turned = 0; // graus andados em volta do eixo
  let last = headingOf(p.state.origin.x - ax, p.state.origin.z - az);
  let onMarkBook = false;
  let steps = 0;
  let prevY = p.state.origin.y;
  run(p, 900, (c) => {
    const o = p.state.origin;
    const h = headingOf(o.x - ax, o.z - az);
    turned += ((h - last + 540) % 360) - 180;
    last = h;
    if (o.y > prevY + 1) steps++;
    prevY = o.y;
    c.side = 0;
    c.buttons = 0;
    c.forward = 1;
    if (!onMarkBook && Math.abs(o.y - (mark.bookTop + skin)) < 1e-6) onMarkBook = true;
    if (onMarkBook) {
      // No livro da marca: segue reto para o ponto da prancha e para lá.
      if (Math.hypot(o.x - ax, o.z - az) >= T.spot.at) c.forward = 0;
      else c.yaw = -headingOf(goal[0] - o.x, goal[1] - o.z) * DEG;
      return;
    }
    // Espiral: tangente no sentido horário mais uma correção para o raio do roteiro.
    const r = Math.hypot(o.x - ax, o.z - az);
    const [tx, tz] = headingDir(h + 90);
    const [rx, rz] = headingDir(h);
    const k = (T.spot.spiralAt - r) * 0.02;
    c.yaw = -headingOf(tx + rx * k, tz + rz * k) * DEG;
  });
  assert.ok(onMarkBook, 'chegou ao livro da marca');
  assert.equal(steps, 13, 'doze livros e a prancha, um degrau por vez');
  assert.ok(turned > 180, `deu a volta subindo (${turned}°)`);
  assert.ok(p.state.onGround && Math.abs(p.state.origin.y - (mark.height + skin)) < 1e-6, `na prancha: ${p.state.origin.y}`);
});
```


```js file=tests/pistaFuzz.test.js
// 10 minutos simulados na colisão da pista de testes (subfase 3.3; a parte automática do aceite da 3.5, adiantada):
// entrada aleatória com andar, spam de agachar, pulos e troca do item na mão, partindo de cada estação (50 s em cada
// uma, do primeiro ponto de teleporte), com empurrões de até 1500 u/s — nenhuma penetração além da folga, nunca preso,
// nunca abaixo do chão do estúdio. Depois, a mesma seed repetida dá o mesmo estado inteiro, bit a bit.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RNG } from '../src/core/rng.js';
import { HULL } from '../src/data/movement.js';
import { PISTA } from '../src/data/pista.js';
import { buildPistaLayout } from '../src/maps/pista/layout.js';
import { buildPistaColliders } from '../src/maps/pista/colliders.js';
import { CollisionWorld } from '../src/physics/collisionWorld.js';
import { resolveStations } from '../src/maps/stations.js';
import { BTN } from '../src/player/moveCmd.js';
import { playerMove } from '../src/player/movement.js';
import { DT, itemEnv, makePlayer } from './playerTestUtils.js';

const layout = buildPistaLayout();
const world = CollisionWorld.fromBuilder(buildPistaColliders(layout), 'pista');
const stations = resolveStations(layout.stations, world);
const TEN_MINUTES = 10 * 60 * 64;
const ITEMS = [['knife', 0], ['ak47', 0], ['awp', 1], ['negev', 0], ['c4', 0]];
const FLOOR = -PISTA.base.thickness; // chão do estúdio

function simulate(seed, ticks, { check }) {
  const rng = new RNG(seed);
  const per = Math.ceil(ticks / stations.length);
  const stats = { jumps: 0, ducks: 0, kicks: 0, maxY: -Infinity, stations: 0 };
  let p = null;
  let phase = 0;
  let turn = 0;
  let rates = { jump: 0, duck: 0, walk: 0 };
  for (let i = 0; i < ticks; i++) {
    if (i % per === 0) {
      const st = stations[Math.floor(i / per)];
      const s = st.spots[0].position;
      p = makePlayer(world, [s.x, s.y, s.z], { yaw: st.spots[0].yaw });
      stats.stations++;
    }
    if (phase-- <= 0) {
      phase = rng.int(16, 64);
      let f = rng.bool(0.3) ? rng.float(-1, 1) : rng.pick([-1, 0, 1]);
      let sd = rng.bool(0.3) ? rng.float(-1, 1) : rng.pick([-1, 0, 1]);
      const len = Math.hypot(f, sd);
      if (len > 1) {
        f /= len;
        sd /= len;
      }
      p.cmd.forward = f;
      p.cmd.side = sd;
      turn = rng.float(-5, 5);
      rates = { jump: rng.pick([0, 0.05, 0.3]), duck: rng.pick([0, 0, 0.5, 1]), walk: rng.pick([0, 0, 1]) };
      const [item, zoom] = rng.pick(ITEMS);
      p.env.item = itemEnv(item, zoom);
    }
    p.cmd.yaw += turn * DT;
    p.cmd.buttons = (rng.bool(rates.jump) ? BTN.JUMP : 0) | (rng.bool(rates.duck) ? BTN.DUCK : 0) | (rng.bool(rates.walk) ? BTN.WALK : 0);
    if (i % 400 === 399) {
      const dir = rng.onUnitSphere();
      const v = rng.float(300, 1500);
      p.state.velocity.set(dir.x * v, Math.abs(dir.y) * v, dir.z * v);
      p.state.onGround = false;
      stats.kicks++;
    }
    p.cmd.tick = i;
    playerMove(p.state, p.cmd, p.env);
    const s = p.state;
    for (const e of p.env.events) {
      if (e.type === 'jump') stats.jumps++;
      if (e.type === 'duck') stats.ducks++;
    }
    stats.maxY = Math.max(stats.maxY, s.origin.y);
    if (!check) continue;
    const o = s.origin;
    if (!world.canOccupy(o.x, o.y, o.z, HULL.radius, s.height, 0.05)) assert.fail(`tick ${i}: penetrando em ${o.toArray()}`);
    if (s.stuck) assert.fail(`tick ${i}: preso em ${o.toArray()}`);
    if (o.y < FLOOR - 0.01) assert.fail(`tick ${i}: abaixo do chão do estúdio (${o.y})`);
  }
  return { state: p.state, stats };
}

test('10 min simulados na pista, partindo de cada estação: nenhuma penetração, nunca preso', () => {
  const { stats } = simulate('pista-dez-minutos', TEN_MINUTES, { check: true });
  assert.equal(stats.stations, 12);
  assert.ok(stats.jumps > 100, `pulos ${stats.jumps}`);
  assert.ok(stats.ducks > 100, `agachadas ${stats.ducks}`);
  assert.equal(stats.kicks, TEN_MINUTES / 400);
  assert.ok(stats.maxY > 200, `subiu em alguma coisa (${stats.maxY})`);
});

/** Estado inteiro como texto: números com a representação exata do double (igual ⇔ bit a bit). */
function snapshot(s) {
  return JSON.stringify({
    ...s, origin: s.origin.toArray(), velocity: s.velocity.toArray(), groundNormal: s.groundNormal.toArray(),
  });
}

test('a mesma seed dá o mesmo estado inteiro na pista, bit a bit (2 min)', () => {
  const a = simulate('pista-repetivel', 2 * 60 * 64, { check: false }).state;
  const b = simulate('pista-repetivel', 2 * 60 * 64, { check: false }).state;
  assert.equal(snapshot(a), snapshot(b));
});
```


- [ ] **Passo 2: Rodar e ver falhar**

Run: `node --test tests/pistaLayout.test.js tests/pistaMovement.test.js tests/pistaFuzz.test.js`
Expected: FAIL — `Cannot find module` de `src/data/pista.js` nos três arquivos.


- [ ] **Passo 3: Dados da pista** — todos os números do desenho (lotes, estações, trechos da torre, cores, textos das etiquetas e pontos de teleporte) e a aparência que só o visual usa (`look`).

```js file=src/data/pista.js
// Pista de testes (subfase 3.3; desenho em docs/phases/phase-3.md, seção 3.3; pesquisa no item 11 do moodboard).
// Parque de estações num compensado de 5,6 × 4 m, cada módulo isolado num lote, com os números que o movimento do
// jogo promete (src/data/movement.js) construídos com objetos de verdade na escala do boneco.
// Unidades: 1 u = 1 cm na escala do boneco = 1 mm real (o boneco de 72 u tem 7,2 cm). Origem no centro do tampo do
// compensado (y = 0); norte = −Z, leste = +X. Rumo = graus no sentido horário a partir do norte (a direção do rumo h é
// (sen h, −cos h) no plano XZ); o yaw do jogador é −rumo. Alturas das estações contam do chão do próprio lote (o tapete
// de corte tem 3 u, os papéis décimos de u); a torre, sobre o compensado nu, mede do tampo.
// Números das estações 5 e 6 (wall-jump e slide) são provisórios: a 3.4 ajusta só estes dados.

const F = Object.freeze;
const list = (...items) => F(items.map((i) => F(i)));

export const PISTA = F({
  seed: 'pista-de-testes',
  base: F({ minX: -2800, maxX: 2800, minZ: -2000, maxZ: 2000, thickness: 18, sheet: F([2440, 1220]) }),
  // Chão do estúdio em volta (18 u abaixo do tampo, sob o compensado) e o ar do estúdio.
  studioFloor: F({ size: 16000, color: '#171210' }),
  fog: F({ color: '#1B1411', density: 0.00005 }),
  // Cerca de caixas de papelão de parede dupla, abertas e em pé; colisão de 8,4 u (papelão de 6 u + empeno).
  fence: F({
    innerX: 2760, innerZ: 1960, height: 200, wall: 6, collider: 8.4, depth: 40, boxesX: 8, boxesZ: 6, tape: 48,
    flapOpen: 0.28, stamps: F(['ESTE LADO PARA CIMA', 'FRÁGIL', 'MANTER SECO']),
  }),
  // Chãos dos lotes: tapete de corte (3 mm) cobre o lote inteiro; papéis são folhas próprias das estações.
  floors: F({
    tapete: F({ thickness: 3, surface: 'tapete' }),
    kraft: F({ thickness: 0.3, surface: 'papelao', color: '#B08560' }),
    grade: F({ thickness: 0.2, surface: 'papelao', color: '#F2EEE2' }),
    compensado: F({ thickness: 0, surface: 'madeira' }),
  }),
  lotTape: F({ width: 19, offset: 12 }), // fita crepe de 19 mm em volta de cada lote, 12 u para fora da borda
  lots: list(
    { number: 1, x: [-850, 850], z: [-600, 600], floor: 'compensado', card: [-780, 560, 0] },
    { number: 2, x: [1450, 2500], z: [-1500, -550], floor: 'tapete', card: [2440, -520, 180] },
    { number: 3, x: [1450, 2600], z: [-450, 400], floor: 'tapete', card: [2130, 370, 0] },
    { number: 4, x: [1500, 2300], z: [550, 1100], floor: 'tapete', card: [2220, 1060, 0] },
    { number: 5, x: [-2750, -1400], z: [-200, 950], floor: 'compensado', card: [-1470, 920, 0] },
    { number: 6, x: [-2750, -950], z: [1100, 1900], floor: 'compensado', card: [-1020, 1080, 180] },
    { number: 7, x: [-2750, -1420], z: [-1520, -230], floor: 'compensado', card: [-1490, -300, 0] },
    { number: 8, x: [-2560, 2400], z: [-1900, -1540], floor: 'compensado', card: [2340, -1520, 180] },
    { number: 9, x: [-1400, -300], z: [-1460, -700], floor: 'tapete', card: [-360, -680, 180] },
    { number: 10, x: [250, 1250], z: [-1450, -650], floor: 'tapete', card: [310, -630, 180] },
    { number: 11, x: [1300, 2400], z: [1350, 1560], floor: 'compensado', card: [1360, 1330, 180] },
    { number: 12, x: [-800, 800], z: [1450, 1700], floor: 'compensado', card: [-740, 1430, 180] },
  ),
  plaza: F({
    x: F([-600, 600]), z: F([700, 1300]),
    // Prancheta com a planta da pista num cavalete de papelão, voltada para o spawn; luminária de mesa ao lado.
    easel: F({ at: F([-250, 800]), heading: 130, board: F([420, 300, 4]), tilt: 72, bottom: 40 }),
    // Luminária de mesa acesa sobre a prancheta (luz prática da montagem `pista`); a base colide. Baixa o bastante
    // para caber inteira na vista do spawn (cúpula e cotovelo abaixo da borda de cima da tela).
    lamp: F({ bulb: F([-110, 290, 690]), target: F([-250, 180, 800]), reach: 230, baseRadius: 38, baseHeight: 10 }),
  }),
  // Spawn no fundo da praça: a prancheta, a luminária e a quadra de strafe entram inteiras na primeira vista.
  spawn: F({ at: F([0, 0, 1200]), heading: 0, pitch: -2 }),

  // 1 · Counter-strafe: papel quadriculado de plotter, linhas a cada 20 u e fortes a cada 100 u.
  strafe: F({
    paper: F({ x: F([-800, 800]), z: F([-450, 550]) }),
    fine: 20, strong: 100,
    line: F({ z: 50, width: 20, color: '#D1362F' }),
    pillars: list({ at: [-450, -540] }, { at: [450, -540] }),
    pillarBlock: F([96, 100, 96]), pillarLayers: 2,
  }),

  // 2 · Escadas de livros: seis pilhas de seis livros da espessura do degrau; a frente de cada livro recua 40 u.
  stairs: F({
    books: 6, depth0: 350, depthStep: 40, width0: 260, widthStep: 20,
    piles: list(
      { step: 8, x: 1580, front: -600, back: -950 },
      { step: 12, x: 1920, front: -600, back: -950 },
      { step: 16, x: 2260, front: -600, back: -950 },
      { step: 18, x: 1580, front: -1100, back: -1450, note: '18 u · o limite' },
      { step: 20, x: 1920, front: -1100, back: -1450, note: '20 u · só pulando' },
      { step: 24, x: 2260, front: -1100, back: -1450, note: '24 u · só pulando' },
    ),
  }),

  // 3 · Rampas: caixa de arquivo (plataforma) e cinco cunhas de papelão fechadas dos lados.
  ramps: F({
    box: F({ x: F([1500, 2540]), z: F([-400, -100]), height: 120 }),
    width: 160,
    wedges: list(
      { deg: 15, x: 1580, note: '15° · sobe' }, { deg: 30, x: 1800, note: '30° · sobe' },
      { deg: 44, x: 2020, note: '44° · sobe' }, { deg: 46, x: 2240, note: '46° · escorrega' },
      { deg: 60, x: 2460, note: '60° · escorrega' },
    ),
  }),

  // 4 · Caixas: blocos de faia de 128 × 128 com a altura em estêncil na face sul.
  boxes: F({
    size: 128, radius: 3,
    rows: list({ z: [900, 1028], heights: [57, 58, 64] }, { z: [600, 728], heights: [66, 67, 72] }),
    columns: F([F([1550, 1678]), F([1758, 1886]), F([1966, 2094])]),
  }),

  // 5 · Wall-jump (provisório da 3.4): poço de compensado e zigue-zague de painéis.
  wallJump: F({
    well: F({
      x: F([-2538, -2362]), z: F([62, 238]), wall: 8, height: 256,
      door: F({ x: F([-2498, -2402]), height: 88 }),
      stripes: list( // parede: faixa de cor e número na face de dentro
        { side: 'norte', number: 1, color: '#D1362F' }, { side: 'leste', number: 2, color: '#F4C542' },
        { side: 'sul', number: 3, color: '#5BA55B' }, { side: 'oeste', number: 4, color: '#2F6DB5' },
      ),
    }),
    exit: F({ plankWidth: 64, plankThickness: 6, tower: F({ x: F([-2300, -2120]), z: F([60, 240]), height: 256, layers: 4 }) }),
    zigzag: F({
      x: F([-1850, -1650]), platformA: F([700, 900]), platformB: F([-140, 60]), platformHeight: 128, layers: 2,
      panel: F({ thickness: 8, length: 160, height: 320 }),
      west: F([F([540, 700]), F([220, 380])]),
      east: F([F([380, 540]), F([60, 220])]),
      ramp: F({ deg: 30, width: 160 }),
    }),
  }),

  // 6 · Vãos de slide (provisório da 3.4) e gabarito de portais.
  slide: F({
    lane: F({ x: F([-2600, -1000]), z: F([1195, 1345]) }),
    supportZ: F([1175, 1365]), support: 40,
    bars: list(
      { x: -2100, kind: 'regua', under: 70, stack: [48, 11, 11], size: [30, 3, 300] },
      { x: -1850, kind: 'lapis', under: 64, stack: [48, 8, 8], size: [7, 7, 175] },
      { x: -1600, kind: 'aco', under: 58, stack: [48, 10], size: [25, 1, 300] },
      { x: -1350, kind: 'espeto', under: 55, stack: [48, 7], size: [4, 4, 300] },
    ),
  }),
  gauge: F({
    z: 1650, depth: 40, column: 30, opening: 64, lintel: F([150, 3, 30]),
    portals: list(
      { x: -2520, clear: 73, note: '73 u · em pé passa' }, { x: -2360, clear: 72, note: '72 u · em pé não passa' },
      { x: -2200, clear: 55, note: '55 u · agachado passa' }, { x: -2040, clear: 54, note: '54 u · agachado não' },
    ),
  }),

  // 7 · Torre de queda: tubo de papelão com espiral de livros e pranchas nas alturas de queda.
  tower: F({
    axis: F([-2100, -900]),
    tube: F({ radius: 90, wall: 6, height: 1310 }),
    book: F({ inner: 70, length: 200, width: 130 }),
    stepDeg: 18, firstHeading: 270,
    segments: list(
      { books: 12, top: 192 }, { books: 13, top: 412 }, { books: 11, top: 592 }, { books: 18, top: 892 },
      { books: 24, top: 1302 },
    ),
    plank: F({ width: 96, thickness: 8, from: 250, to: 520, backDeg: 10 }),
    target: F({ at: 580, radius: 90, rings: 3 }),
    spot: F({ at: 400, pitch: -25, spiralAt: 200, spiralBefore: 30 }), // teleporte: na prancha olhando o alvo
    growth: F({
      at: 330, heading: 116, size: F([60, 1400, 12]), noteHeight: 15,
      notes: F({ 200: '200 · leve', 420: '420 · o limite seguro', 600: '600 · dói', 900: '900 · dói muito', 1310: '1310 · fatal' }),
    }),
  }),

  // 8 · Faixa de bhop: kraft, trena de aço esticada do zero na largada até a chegada.
  bhop: F({
    paper: F({ x: F([-2500, 2300]), z: F([-1880, -1560]) }),
    start: -2100, length: 4400, labelEvery: 500,
    trena: F({ width: 25, z: -1582, color: '#F2C230' }),
    labelZ: -1850,
    case: F({ size: F([70, 70, 40]), z: -1582 }),
    flag: F({ at: F([2300, -1846]), stick: 95 }),
  }),

  // 9 · Vigas de balsa entre duas plataformas de faia.
  beams: F({
    platforms: F([F([-1350, -1150]), F([-510, -310])]), z: F([-1440, -980]), height: 96, layers: 2,
    beam: F({ from: -1170, to: -490, thickness: 6 }),
    widths: list({ width: 32, z: -1400 }, { width: 16, z: -1300 }, { width: 8, z: -1200 }, { width: 4, z: -1100 }),
    incline: F({ x: -1250, deg: 20, width: 16, thickness: 6 }),
  }),

  // 10 · Paredes finas de papelão de uma face.
  walls: F({
    height: 180, thickness: 2,
    row: F({ z: -1400, length: 160, panels: list({ x: 380, t: 0.5 }, { x: 580, t: 1 }, { x: 780, t: 2 }, { x: 980, t: 4 }) }),
    gapWall: F({ z: -1220, x: F([280, 1220]), gaps: list({ x: 520, width: 33, note: '33 u · passa' }, { x: 880, width: 31, note: '31 u · não passa' }) }),
    zigzag: F({ start: F([460, -794]), width: 64, segment: 120, headings: F([330, 30, 330]) }),
    corner: F({ apex: F([760, -1050]), deg: 20, length: 250 }),
    curve: F({ center: F([1050, -880]), radius: 160, from: 0, to: 90, segments: 12 }),
  }),

  // 11 · Túnel baixo: três caixas rasas sem fundo emendadas ao longo de X.
  tunnel: F({
    z: F([1386, 1514]), wall: 4,
    boxes: list({ x: [1350, 1650], height: 60 }, { x: [1650, 1950], height: 96 }, { x: [1950, 2250], height: 60 }),
    holes: F({ diameter: 24, perBox: 3 }),
    vents: F({ perSide: 3, size: F([46, 6]) }),
    bulbs: 12,
    // Luz prática sem sombra na caixa do meio (montagem `pista`): a meia altura, para não estourar o teto de perto.
    light: F({ at: F([1800, 58, 1450]), reach: 320, illuminance: 0.9 }),
  }),

  // 12 · Pegadas: placas de massinha sobre kraft (aceitam pegadas na 3.5). A palavra se lê de quem vem da praça,
  // olhando para o sul: a primeira letra fica a leste (x = 600) e as outras seguem para o oeste.
  prints: F({
    paper: F({ x: F([-760, 760]), z: F([1480, 1680]) }),
    plate: F([180, 5, 130]), z: 1580, from: 600, step: -200, turnDeg: 4,
    colors: F(['#C8553D', '#F28F3B', '#F4C542', '#5BA55B', '#2F6DB5', '#E88AA8', '#F4EDE1']),
    letters: 'PEGADAS',
  }),

  // Capas dos livros (tecido sobre papelão) e títulos inventados das lombadas.
  bookColors: F(['#8E2B25', '#22375C', '#2E5339', '#C9962E', '#2C6E6A', '#6B2338', '#B7652C', '#5B6E83', '#D9CDB4', '#3A3430', '#6E6B34']),
  bookTitles: F([
    'Massa e Forma', 'O Boneco de Arame', 'Luz de Estúdio', 'Doze Poses', 'Papelão Ondulado', 'A Mão do Animador',
    'Cenários de Mesa', 'Quadro a Quadro', 'Cor e Plasticina', 'Sombra Suave', 'Poeira no Feixe', 'O Tripé',
    'Miniaturas', 'Tapete Verde', 'Fita Crepe', 'Relatos de Bancada', 'Grão e Vinheta', 'Espátulas', 'Arame e Espuma',
    'Pequenas Cenas',
  ]),

  // Aparência (src/maps/pista/visual/): cores, tons e medidas que só o desenho usa. Tons em [r, g, b] multiplicam o
  // material (madeira clara da balsa vira cedro, bambu, palito); hex é a cor da peça.
  look: F({
    tape: F({
      color: '#E8D9A8', ink: '#1C2238', labelWidth: 19, textHeight: 10.5, margin: 7,
      font: '700 {px}px "Segoe Print", "Bradley Hand", "Comic Sans MS", "Chalkboard SE", "Baloo 2", cursive',
      atlas: F({ width: 2048, cellHeight: 72, columns: 4 }),
      feet: F({ length: 46, fold: 16, every: 160 }), // fita dobrada no pé das paredes soltas, a cada 160 u de parede
    }),
    cardboardTint: F([0.9, 1.05]), // tom de cada caixa e painel (lotes de papelão diferentes)
    // Caixa de arquivo das rampas: parede, saia da tampa (por fora, rente à colisão), alças e etiqueta na frente.
    archive: F({ wall: 4, lid: 22, handle: F([70, 20]), label: F([150, 90]) }),
    wedgeWall: 4, tentWall: 2.2, tubePitch: 260, flap: F({ top: 34, side: 30, openDeg: 20, splayDeg: 25 }),
    ruler: '#E4C38D', steel: '#B8BDC3', growth: '#27313C',
    pencil: F({ body: '#E7B722', wood: F([1.0, 0.82, 0.66]), ferrule: '#D3B45C', eraser: '#E7909F' }),
    bamboo: F([1.0, 0.92, 0.72]), toothpick: F([1.02, 0.97, 0.84]),
    trenaCase: F({ rubber: '#1E1D1C', metal: '#A7ADB3' }),
    pinShaft: '#C9CDD2',
    fairy: F({ wire: '#2F5A33', bulb: '#FFC88A', emission: 8, bulbRadius: 2.6 }),
    clipboard: F([0.46, 0.34, 0.25]), clip: '#C3C7CB',
    lump: 8.5, // raio das bolotas de massinha que seguram as traves e a bandeirinha
    imprint: F({ depth: 4.5, lip: 1.1, roller: 0.3 }), // relevo das letras, furinhos e marcas do rolo nas placas (u)
  }),

  // Estações (console `estacao`): número, id, nome, apelidos e pontos de teleporte — `at` = [x, z] no chão do lugar,
  // `plank` = altura da prancha da torre (em cima dela, olhando para fora) ou `spiral` (pé da espiral); rumo e pitch
  // em graus. A altura dos pés sai do chão embaixo do ponto (raio de cima para baixo a partir de `below`, padrão 3000).
  stations: list(
    { number: 1, id: 'strafe', label: 'Counter-strafe', aliases: ['counter', 'contra', 'parar'], spots: [
      { id: 'grade', label: 'linha de strafe', at: [-760, 50], heading: 90 },
      { id: 'pilares', label: 'pilares de peek', at: [0, -300], heading: 0 },
    ] },
    { number: 2, id: 'escadas', label: 'Escadas de livros', aliases: ['escada', 'livros', 'degraus'], spots: [
      { id: '8', at: [1580, -500], heading: 0 }, { id: '12', at: [1920, -500], heading: 0 },
      { id: '16', at: [2260, -500], heading: 0 }, { id: '18', at: [1640, -1030], heading: 0 },
      { id: '20', at: [1980, -1030], heading: 0 }, { id: '24', at: [2320, -1030], heading: 0 },
    ] },
    { number: 3, id: 'rampas', label: 'Rampas', aliases: ['rampa', 'inclinacao'], spots: [
      { id: '15', at: [1580, 385], heading: 0 }, { id: '30', at: [1800, 385], heading: 0 },
      { id: '44', at: [2020, 385], heading: 0 }, { id: '46', at: [2240, 385], heading: 0 },
      { id: '60', at: [2460, 385], heading: 0 },
    ] },
    { number: 4, id: 'caixas', label: 'Caixas', aliases: ['caixa', 'blocos', 'altura'], spots: [
      { id: '57', at: [1614, 1085], heading: 0 }, { id: '58', at: [1822, 1085], heading: 0 },
      { id: '64', at: [2030, 1085], heading: 0 }, { id: '66', at: [1614, 830], heading: 0 },
      { id: '67', at: [1822, 830], heading: 0 }, { id: '72', at: [2030, 830], heading: 0 },
    ] },
    { number: 5, id: 'walljump', label: 'Wall-jump', aliases: ['wall', 'poco'], spots: [
      { id: 'poco', label: 'porta do poço', at: [-2450, 420], heading: 0 },
      { id: 'ziguezague', label: 'plataforma A', at: [-1750, 800], heading: 180 },
    ] },
    { number: 6, id: 'slide', label: 'Vãos de slide e gabarito', aliases: ['vaos', 'traves', 'agachar'], spots: [
      { id: 'faixa', label: 'início da faixa', at: [-2580, 1270], heading: 90 },
      { id: 'gabarito', label: 'portais', at: [-2280, 1540], heading: 180 },
    ] },
    { number: 7, id: 'torre', label: 'Torre de queda', aliases: ['queda', 'espiral'], spots: [
      { id: 'base', label: 'pé da espiral', spiral: true, below: 60 },
      { id: '200', plank: 200 }, { id: '420', plank: 420 }, { id: '600', plank: 600 },
      { id: '900', plank: 900 }, { id: '1310', plank: 1310 },
    ] },
    { number: 8, id: 'bhop', label: 'Faixa de bhop', aliases: ['trena', 'corrida', 'bunny'], spots: [
      { id: 'largada', label: '400 u antes da largada', at: [-2480, -1720], heading: 90 },
      { id: 'chegada', at: [2200, -1720], heading: 270 },
    ] },
    { number: 9, id: 'vigas', label: 'Vigas de balsa', aliases: ['viga', 'balsa', 'equilibrio'], spots: [
      { id: '32', at: [-1200, -1400], heading: 90 }, { id: '16', at: [-1200, -1300], heading: 90 },
      { id: '8', at: [-1200, -1200], heading: 90 }, { id: '4', at: [-1200, -1100], heading: 90 },
      { id: 'rampa', label: 'pé da ripa inclinada', at: [-1250, -680], heading: 0 },
    ] },
    { number: 10, id: 'paredes', label: 'Paredes finas', aliases: ['parede', 'finas'], spots: [
      { id: 'espessuras', at: [680, -1300], heading: 0 }, { id: 'fendas', at: [700, -1140], heading: 0 },
      { id: 'corredor', at: [460, -760], heading: 0 }, { id: 'quina', at: [760, -760], heading: 0 },
      { id: 'curva', at: [980, -800], heading: 45 },
    ] },
    { number: 11, id: 'tunel', label: 'Túnel baixo', aliases: ['caixas-baixas'], spots: [
      { id: 'entrada', label: 'boca oeste', at: [1250, 1450], heading: 90 },
      { id: 'meio', label: 'caixa alta', at: [1800, 1450], heading: 90, below: 50 },
    ] },
    { number: 12, id: 'pegadas', label: 'Pegadas', aliases: ['pegada', 'massinha'], spots: [
      { id: 'placas', at: [0, 1380], heading: 180 },
    ] },
  ),
});

/** Montagem de desempenho medida no preset Alto (para o aceite): teto de draws e triângulos da cena. */
export const PISTA_BUDGET = F({ draws: 120, triangles: 400000, collisionTriangles: 4500 });
```


- [ ] **Passo 4: Peças e matrizes** — a lista de peças/enfeites e as matrizes por rumo (norte = −Z, leste = +X; o rumo h aponta para (sen h, −cos h); yaw do jogador = −rumo).

```js file=src/maps/pista/pieces.js
// Peças da pista de testes em dados simples (sem WebGL): cada peça tem forma de colisão, matriz de mundo, tamanho,
// superfície e aparência; cada enfeite (fita, etiqueta, tinta, trena...) só aparência. O layout (layout.js) monta as
// listas; colliders.js e os visuais (visual/) leem delas — a mesma fonte para o que colide e o que se vê.
//
// Formas (tamanho no espaço da peça):
//   box      [w, h, d] centrada na origem da matriz
//   ramp     [w, h, l] cunha que sobe de y = 0 em z = 0 até y = h em z = l (ColliderBuilder.ramp)
//   cylinder [r, h]    cilindro vertical de y = 0 a y = h
//   tent     [w, h, d] plaquinha dobrada em "A": duas rampas de costas, cumeeira em z = 0, base de −d/2 a d/2
// Convenções de rumo em src/data/pista.js: a direção do rumo h é (sen h, −cos h); yawMatrix põe o −Z local no rumo.

import * as THREE from 'three';

export const DEG = Math.PI / 180;

const _x = new THREE.Vector3();
const _y = new THREE.Vector3();
const _z = new THREE.Vector3();

/** Direção [x, z] do rumo `h` (graus). */
export function headingDir(h) {
  return [Math.sin(h * DEG), -Math.cos(h * DEG)];
}

/** Rumo (graus, 0–360) da direção (x, z). */
export function headingOf(x, z) {
  const h = Math.atan2(x, -z) / DEG;
  return (h + 360) % 360;
}

/** Matriz com origem em (x, y, z) e o −Z local apontando para o rumo `heading` (o +X local fica à direita). */
export function yawMatrix(x, y, z, heading = 0) {
  return new THREE.Matrix4().makeRotationY(-heading * DEG).setPosition(x, y, z);
}

/** Matriz a partir da origem e de dois eixos (o terceiro sai do produto vetorial, base ortonormal destra). */
export function basisMatrix([ox, oy, oz], xAxis, yAxis) {
  _x.set(xAxis[0], xAxis[1], xAxis[2]).normalize();
  _y.set(yAxis[0], yAxis[1], yAxis[2]).normalize();
  _z.crossVectors(_x, _y).normalize();
  _y.crossVectors(_z, _x);
  return new THREE.Matrix4().makeBasis(_x, _y, _z).setPosition(ox, oy, oz);
}

/**
 * Matriz de tira deitada no chão (fita, etiqueta, trena): X local ao longo do rumo `heading`, Z local para cima (a
 * normal da tira do propGeometry.tapeStrip), origem no centro.
 */
export function floorStripMatrix(x, y, z, heading) {
  const [dx, dz] = headingDir(heading);
  return basisMatrix([x, y, z], [dx, 0, dz], [dz, 0, -dx]);
}

/**
 * Matriz de enfeite colado numa face vertical voltada para o rumo `facing`: X local para a direita de quem olha a face,
 * Y local para cima, Z local saindo da face.
 */
export function wallDecalMatrix(x, y, z, facing) {
  const [nx, nz] = headingDir(facing);
  return basisMatrix([x, y, z], [nz, 0, -nx], [0, 1, 0]);
}

/** Matriz de enfeite deitado no chão, lido por quem olha para o rumo `heading` (Y local = para a frente dele). */
export function floorDecalMatrix(x, y, z, heading) {
  const [dx, dz] = headingDir(heading);
  return basisMatrix([x, y, z], [-dz, 0, dx], [dx, 0, dz]);
}

export class PieceList {
  constructor() {
    this.pieces = [];
    this.decor = [];
    this.ids = new Set();
  }

  #claim(id) {
    if (this.ids.has(id)) throw new Error(`peça repetida na pista: ${id}`);
    this.ids.add(id);
  }

  /**
   * Peça sólida. `station`: número da estação (0 = base, cerca, praça). `look`: aparência ({ kind, ... }); kind
   * 'none' = só colisão.
   */
  add({ id, station = 0, shape = 'box', size, matrix, surface = 'padrao', collide = true, look = { kind: 'none' } }) {
    this.#claim(id);
    const p = { id, station, shape, size: Object.freeze([...size]), matrix, surface, collide, look };
    this.pieces.push(p);
    return p;
  }

  /** Caixa alinhada aos eixos pelos limites. */
  bounds(id, [x0, x1], [y0, y1], [z0, z1], opts = {}) {
    return this.add({
      ...opts, id, shape: 'box', size: [x1 - x0, y1 - y0, z1 - z0],
      matrix: new THREE.Matrix4().makeTranslation((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2),
    });
  }

  /** Caixa de tamanho [w, h, d] com a base em y0, centrada em (x, z) e girada para o rumo `heading`. */
  standing(id, x, y0, z, [w, h, d], heading = 0, opts = {}) {
    return this.add({ ...opts, id, shape: 'box', size: [w, h, d], matrix: yawMatrix(x, y0 + h / 2, z, heading) });
  }

  /**
   * Placa de compensado pelos limites, com a espessura no Y local (as lâminas do material seguem o Y da peça):
   * `axis` = eixo do mundo da espessura ('x', 'y' ou 'z').
   */
  board(id, xr, yr, zr, axis, opts = {}) {
    return this.#slab(id, xr, yr, zr, axis, 'y', opts);
  }

  /** Placa de papelão pelos limites, com a espessura no Z local (como boardGeometry.cardboardPanel). */
  panel(id, xr, yr, zr, axis, opts = {}) {
    return this.#slab(id, xr, yr, zr, axis, 'z', opts);
  }

  #slab(id, [x0, x1], [y0, y1], [z0, z1], axis, local, opts) {
    const ext = { x: x1 - x0, y: y1 - y0, z: z1 - z0 };
    const m = new THREE.Matrix4();
    let size;
    if (local === 'y') {
      // Y local = eixo da espessura; X local = X do mundo (ou −Y quando a espessura é X).
      if (axis === 'y') size = [ext.x, ext.y, ext.z];
      else if (axis === 'z') {
        m.makeRotationX(Math.PI / 2); // Y → +Z, Z → −Y
        size = [ext.x, ext.z, ext.y];
      } else {
        m.makeRotationZ(-Math.PI / 2); // Y → +X, X → −Y
        size = [ext.y, ext.x, ext.z];
      }
    } else if (axis === 'z') size = [ext.x, ext.y, ext.z];
    else if (axis === 'x') {
      m.makeRotationY(Math.PI / 2); // Z → +X, X → −Z
      size = [ext.z, ext.y, ext.x];
    } else {
      m.makeRotationX(-Math.PI / 2); // Z → +Y, Y → −Z
      size = [ext.x, ext.z, ext.y];
    }
    m.setPosition((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
    return this.add({ ...opts, id, shape: 'box', size, matrix: m });
  }

  /** Enfeite (só aparência). */
  addDecor({ id, station = 0, kind, matrix, ...params }) {
    this.#claim(id);
    const d = { id, station, kind, matrix, ...params };
    this.decor.push(d);
    return d;
  }
}

/** Pontos de um retângulo [x0, x1] × [z0, z1] dentro de outro (com folga `eps`). */
export function rectInside([ax0, ax1], [az0, az1], [bx0, bx1], [bz0, bz1], eps = 1e-6) {
  return ax0 >= bx0 - eps && ax1 <= bx1 + eps && az0 >= bz0 - eps && az1 <= bz1 + eps;
}

/** Os retângulos se sobrepõem (área positiva)? */
export function rectsOverlap([ax0, ax1], [az0, az1], [bx0, bx1], [bz0, bz1]) {
  return ax0 < bx1 && bx0 < ax1 && az0 < bz1 && bz0 < az1;
}

/** Cantos da forma de uma peça no mundo (para medir limites e sobreposições nos testes e na planta). */
export function pieceCorners(p) {
  const pts = [];
  const push = (x, y, z) => pts.push(new THREE.Vector3(x, y, z).applyMatrix4(p.matrix));
  const [a, b, c] = p.size;
  if (p.shape === 'box' || p.shape === 'tent') {
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) {
      push((sx * a) / 2, p.shape === 'tent' ? (sy < 0 ? 0 : b) : (sy * b) / 2, (sz * c) / 2);
    }
  } else if (p.shape === 'ramp') {
    for (const sx of [-1, 1]) {
      push((sx * a) / 2, 0, 0);
      push((sx * a) / 2, 0, c);
      push((sx * a) / 2, b, c);
    }
  } else if (p.shape === 'cylinder') {
    for (let i = 0; i < 16; i++) {
      const t = (i / 16) * Math.PI * 2;
      push(Math.cos(t) * a, 0, Math.sin(t) * a);
      push(Math.cos(t) * a, b, Math.sin(t) * a);
    }
  }
  return pts;
}

/** Caixa envolvente [min, max] (THREE.Box3) de uma peça no mundo. */
export function pieceBox(p) {
  return new THREE.Box3().setFromPoints(pieceCorners(p));
}
```


- [ ] **Passo 5: A base da luminária de mesa num ponto só** (a colisão da base da praça e o desenho da luminária usam o mesmo cálculo).


Em `src/render/studio/fixtures.js`, trocar:

```
/**
 * Luminária de mesa articulada (luz prática) em espaço de mundo: lâmpada em `bulb`, apontando para `target`,
```

por:

```
/**
 * Centro da base da luminária de mesa no tampo (a colisão da base no mapa usa o mesmo ponto): recuada da lâmpada
 * para trás da direção em que ela aponta.
 */
export function deskLampBase(bulb, target, reach = 230, tableY = 0) {
  const aim = new THREE.Vector3().subVectors(target, bulb).normalize();
  const back = aim.setY(0).normalize().multiplyScalar(-1);
  return new THREE.Vector3().copy(bulb).addScaledVector(back, reach * 0.55).setY(tableY);
}

/**
 * Luminária de mesa articulada (luz prática) em espaço de mundo: lâmpada em `bulb`, apontando para `target`,
```

Em `src/render/studio/fixtures.js`, trocar:

```
  const base = bulb.clone().addScaledVector(back, reach * 0.55).setY(tableY);
```

por:

```
  const base = deskLampBase(bulb, target, reach, tableY);
```


- [ ] **Passo 6: Layout** — base, chão do estúdio, cerca, lotes (chão, fitas e plaquinha), praça e as estações, em quatro arquivos por grupo de estações.

```js file=src/maps/pista/layout.js
// Layout da pista de testes (subfase 3.3): expande src/data/pista.js numa lista de peças (forma de colisão, matriz,
// superfície e aparência) e de enfeites, e nas estações com os pontos de teleporte. Determinístico (seed nas pequenas
// tortices de "feito à mão") e puro, sem WebGL: os testes do Node leem o mesmo layout que o mapa monta.
// Base, cerca, lotes e praça ficam aqui; as estações em layoutGround (1–4), layoutAdvanced (5–6), layoutTower (7) e
// layoutCourse (8–12). Referências do moodboard no item 11 (COC5/COC30/PKC12 planta de estações, DFL1/DFL5/LDB15
// lotes e fitas, COC4/CBT15 caixas da cerca).

import * as THREE from 'three';
import { PISTA } from '../../data/pista.js';
import { RNG } from '../../core/rng.js';
import { deskLampBase } from '../../render/studio/fixtures.js';
import { PieceList, basisMatrix, floorStripMatrix, headingDir, wallDecalMatrix, yawMatrix, DEG } from './pieces.js';
import { layoutGroundStations } from './layoutGround.js';
import { layoutAdvancedStations } from './layoutAdvanced.js';
import { layoutTower } from './layoutTower.js';
import { layoutCourse } from './layoutCourse.js';

/** Fitas do contorno de um lote: 12 u para fora da borda; camadas separadas por lote (sem briga de profundidade). */
function lotTapes(L, lot, { width, offset }) {
  const [x0, x1] = lot.x;
  const [z0, z1] = lot.z;
  const n = lot.number;
  const y = 0.1 * (1 + (n % 4));
  const long = x1 - x0 + 2 * offset + width;
  const tall = z1 - z0 + 2 * offset;
  const strip = (id, x, yy, z, heading, length) => L.addDecor({
    id: `lote-${n}-fita-${id}`, station: n, kind: 'tape', matrix: floorStripMatrix(x, yy, z, heading), length, width,
  });
  strip('norte', (x0 + x1) / 2, y, z0 - offset, 90, long);
  strip('sul', (x0 + x1) / 2, y, z1 + offset, 90, long);
  strip('oeste', x0 - offset, y + 0.05, (z0 + z1) / 2, 180, tall);
  strip('leste', x1 + offset, y + 0.05, (z0 + z1) / 2, 180, tall);
}

/** Base de compensado, chão do estúdio e a cerca de caixas de papelão. */
function baseAndFence({ data, L, rng }) {
  const B = data.base;
  L.bounds('base', [B.minX, B.maxX], [-B.thickness, 0], [B.minZ, B.maxZ], {
    surface: 'madeira', look: { kind: 'base', sheet: B.sheet, origin: [B.minX, B.minZ] },
  });
  const S = data.studioFloor.size;
  L.bounds('chao-estudio', [-S / 2, S / 2], [-B.thickness - 20, -B.thickness], [-S / 2, S / 2], {
    surface: 'padrao', look: { kind: 'studioFloor', color: data.studioFloor.color },
  });
  const Fc = data.fence;
  const { innerX: ix, innerZ: iz, height: h, wall, collider, depth } = Fc;
  // Colisão: uma caixa por lado centrada no painel de dentro (papelão + empeno).
  const mid = wall / 2;
  L.bounds('cerca-norte', [B.minX, B.maxX], [0, h], [-iz - mid - collider / 2, -iz - mid + collider / 2], { surface: 'papelao' });
  L.bounds('cerca-sul', [B.minX, B.maxX], [0, h], [iz + mid - collider / 2, iz + mid + collider / 2], { surface: 'papelao' });
  L.bounds('cerca-oeste', [-ix - mid - collider / 2, -ix - mid + collider / 2], [0, h], [B.minZ, B.maxZ], { surface: 'papelao' });
  L.bounds('cerca-leste', [ix + mid - collider / 2, ix + mid + collider / 2], [0, h], [B.minZ, B.maxZ], { surface: 'papelao' });
  // Aparência: caixas abertas em pé (a frente de cada uma é a face de dentro da cerca), estampas e fita nas emendas.
  const r = rng('cerca');
  const sides = [
    { id: 'norte', count: Fc.boxesX, span: 2 * ix, facing: 180, at: (s) => [s, -iz - depth / 2] },
    { id: 'sul', count: Fc.boxesX, span: 2 * ix, facing: 0, at: (s) => [-s, iz + depth / 2] },
    { id: 'oeste', count: Fc.boxesZ, span: 2 * iz, facing: 90, at: (s) => [-ix - depth / 2, -s] },
    { id: 'leste', count: Fc.boxesZ, span: 2 * iz, facing: 270, at: (s) => [ix + depth / 2, s] },
  ];
  let stamp = 0;
  for (const side of sides) {
    const len = side.span / side.count;
    const [fx, fz] = headingDir(side.facing);
    for (let i = 0; i < side.count; i++) {
      const s = -side.span / 2 + len * (i + 0.5);
      const [x, z] = side.at(s);
      // yaw no rumo oposto ao da face: o +Z local (frente da caixa) aponta para dentro da cerca.
      L.add({
        id: `cerca-${side.id}-${i}`, shape: 'box', size: [len - 1, h, depth], collide: false,
        matrix: yawMatrix(x, h / 2, z, side.facing + 180),
        look: { kind: 'fenceBox', size: [len - 1, h, depth], wall, flapOpen: Fc.flapOpen * r.float(0.7, 1.3), seed: `cerca-${side.id}-${i}` },
      });
      const face = [x + fx * (depth / 2 + 0.1), z + fz * (depth / 2 + 0.1)];
      const [rx, rz] = headingDir(side.facing + 90);
      const shift = r.float(-0.25, 0.25) * len;
      L.addDecor({
        id: `cerca-${side.id}-${i}-estampa`, kind: 'ink', cell: `estampa-${stamp % Fc.stamps.length}`, size: [150, 75],
        matrix: wallDecalMatrix(face[0] - rx * shift, r.float(95, 135), face[1] - rz * shift, side.facing),
      });
      stamp++;
      if (i > 0) {
        // Emenda com a caixa anterior: meia caixa para a direita de quem olha a face (a ordem de `at` segue esse lado).
        const jx = x + rx * (len / 2);
        const jz = z + rz * (len / 2);
        L.addDecor({
          id: `cerca-${side.id}-${i}-fita`, kind: 'tape', width: Fc.tape, length: h + 30, seed: `cerca-fita-${side.id}-${i}`,
          matrix: basisMatrix([jx + fx * (depth / 2 + 0.2), h / 2 - 6, jz + fz * (depth / 2 + 0.2)], [0, 1, 0], [-fz, 0, fx]),
        });
      }
    }
  }
}

/** Chão dos lotes (tapete de corte no lote inteiro), fitas do contorno e a plaquinha em "A" de cada estação. */
function lots({ data, L }) {
  for (const lot of data.lots) {
    const cover = data.floors[lot.floor];
    if (cover.thickness > 0) {
      L.bounds(`lote-${lot.number}-chao`, lot.x, [0, cover.thickness], lot.z, {
        station: lot.number, surface: cover.surface,
        look: { kind: 'mat', size: [lot.x[1] - lot.x[0], lot.z[1] - lot.z[0]] },
      });
    }
    lotTapes(L, lot, data.lotTape);
    const [cx, cz, heading] = lot.card;
    const onLot = cx >= lot.x[0] && cx <= lot.x[1] && cz >= lot.z[0] && cz <= lot.z[1];
    const station = data.stations.find((s) => s.number === lot.number);
    L.add({
      id: `lote-${lot.number}-placa`, station: lot.number, shape: 'tent', size: [140, 70, 56], surface: 'papelao',
      matrix: yawMatrix(cx, onLot ? cover.thickness : 0, cz, heading),
      look: { kind: 'tentCard', number: lot.number, text: `${lot.number} · ${station.label}` },
    });
  }
}

/** Praça do spawn: cavalete de papelão com a prancheta da planta e a base da luminária de mesa. */
function plaza({ data, L }) {
  const E = data.plaza.easel;
  const frame = yawMatrix(E.at[0], 0, E.at[1], E.heading);
  const [bw, bh, bt] = E.board;
  const reach = bh * Math.cos(E.tilt * DEG); // a prancheta deita para trás do cavalete
  const top = E.bottom + bh * Math.sin(E.tilt * DEG);
  const box = new THREE.Matrix4().makeTranslation(0, top / 2 + 4, reach / 2 + 24);
  L.add({
    id: 'praca-cavalete', shape: 'box', size: [bw + 20, top + 8, reach + 64], surface: 'papelao',
    matrix: frame.clone().multiply(box), look: { kind: 'easel', frame, board: E.board, tilt: E.tilt, bottom: E.bottom },
  });
  // Planta desenhada a lápis sobre a prancheta (frente = −Z local do cavalete, inclinada; quem olha de frente tem a
  // direita no −X local).
  const up = new THREE.Vector3(0, Math.sin(E.tilt * DEG), Math.cos(E.tilt * DEG));
  const normal = new THREE.Vector3(0, Math.cos(E.tilt * DEG), -Math.sin(E.tilt * DEG));
  const center = new THREE.Vector3(0, E.bottom, 0).addScaledVector(up, bh / 2).addScaledVector(normal, bt / 2 + 0.15);
  const m = basisMatrix(center.toArray(), [-1, 0, 0], up.toArray());
  L.addDecor({ id: 'praca-planta', kind: 'print', cell: 'planta', size: [bw - 40, bh - 50], matrix: frame.clone().multiply(m) });
  const lamp = data.plaza.lamp;
  const base = deskLampBase(new THREE.Vector3(...lamp.bulb), new THREE.Vector3(...lamp.target), lamp.reach, 0);
  L.add({
    id: 'praca-luminaria', shape: 'cylinder', size: [lamp.baseRadius, lamp.baseHeight], surface: 'metal',
    matrix: new THREE.Matrix4().makeTranslation(base.x, 0, base.z),
  });
}

/** Estações com os pontos ainda sem a altura dos pés (sai de um raio no mundo de colisão: src/maps/stations.js). */
function stationDefs({ data }, tower) {
  return data.stations.map((s) => ({
    number: s.number, id: s.id, label: s.label, aliases: [...s.aliases],
    spots: s.spots.map((sp) => {
      if (sp.plank) return { id: sp.id, label: sp.label ?? `prancha de ${sp.plank} u`, ...tower.plankSpot(sp.plank) };
      if (sp.spiral) return { id: sp.id, label: sp.label, below: sp.below, ...tower.spiralSpot() };
      return {
        id: sp.id, label: sp.label ?? sp.id, x: sp.at[0], z: sp.at[1], heading: sp.heading, pitch: sp.pitch ?? -4,
        below: sp.below ?? 3000,
      };
    }),
  }));
}

/**
 * Monta a pista. Devolve `{ pieces, decor, stations, tower, spawn }` — `stations` com os pontos em (x, z, rumo, pitch,
 * `below`); `tower` com os livros da espiral e as marcas das pranchas (testes e planta).
 */
export function buildPistaLayout(data = PISTA) {
  const L = new PieceList();
  const lotOf = new Map(data.lots.map((l) => [l.number, l]));
  const ctx = {
    data,
    L,
    rng: (label) => new RNG(`${data.seed}:${label}`),
    lot: (n) => lotOf.get(n),
    floorTop: (n) => data.floors[lotOf.get(n).floor].thickness,
  };
  baseAndFence(ctx);
  lots(ctx);
  plaza(ctx);
  layoutGroundStations(ctx);
  layoutAdvancedStations(ctx);
  const tower = layoutTower(ctx);
  layoutCourse(ctx);
  const [sx, sy, sz] = data.spawn.at;
  return {
    pieces: L.pieces,
    decor: L.decor,
    stations: stationDefs(ctx, tower),
    tower,
    spawn: { x: sx, y: sy, z: sz, heading: data.spawn.heading, pitch: data.spawn.pitch },
  };
}
```


```js file=src/maps/pista/layoutGround.js
// Estações 1–4 da pista de testes (movimento no chão): counter-strafe no papel quadriculado, escadas de livros,
// rampas de papelão e caixas de faia nos limites do pulo. Números em src/data/pista.js; referências no item 11 do
// moodboard (COC5/PKC12 estações, LDB9 grade, BAS7/BAS11/BAS15 livros como degraus, CFO8/CFR7 cunhas, AWB1/AWB17
// blocos de faia). Puro: só dados (peças e enfeites).

import { DEG, floorDecalMatrix, floorStripMatrix, wallDecalMatrix, yawMatrix } from './pieces.js';

/** Fitas crepe prendendo uma folha retangular: diagonais nos cantos e atravessadas no meio das bordas. */
export function sheetTapes(L, id, station, [x0, x1], [z0, z1], y, { length = 90, width = 19 } = {}) {
  const corners = [[x0, z0, 315], [x1, z0, 45], [x1, z1, 135], [x0, z1, 225]];
  corners.forEach(([x, z, h], i) => {
    L.addDecor({ id: `${id}-fita-canto-${i}`, station, kind: 'tape', matrix: floorStripMatrix(x, y, z, h), length, width });
  });
  const mids = [[(x0 + x1) / 2, z0, 0], [x1, (z0 + z1) / 2, 90], [(x0 + x1) / 2, z1, 180], [x0, (z0 + z1) / 2, 270]];
  mids.forEach(([x, z, h], i) => {
    L.addDecor({ id: `${id}-fita-meio-${i}`, station, kind: 'tape', matrix: floorStripMatrix(x, y + 0.05, z, h), length, width });
  });
}

/** 1 · Counter-strafe: folha de plotter com grade de 20/100 u, linha de strafe e dois pilares de peek. */
function strafe({ data, L, rng }) {
  const S = data.strafe;
  const g = data.floors.grade;
  const n = 1;
  L.bounds('strafe-papel', S.paper.x, [0, g.thickness], S.paper.z, {
    station: n, surface: g.surface,
    look: { kind: 'gridPaper', fine: S.fine, strong: S.strong, color: g.color, size: [S.paper.x[1] - S.paper.x[0], S.paper.z[1] - S.paper.z[0]] },
  });
  sheetTapes(L, 'strafe-papel', n, S.paper.x, S.paper.z, g.thickness + 0.1);
  const len = S.paper.x[1] - S.paper.x[0] - 60;
  L.addDecor({
    id: 'strafe-linha', station: n, kind: 'tape', matrix: floorStripMatrix(0, g.thickness + 0.2, S.line.z, 90),
    length: len, width: S.line.width, color: S.line.color,
  });
  const r = rng('strafe-pilares');
  S.pillars.forEach(({ at: [px, pz] }, i) => {
    for (let k = 0; k < S.pillarLayers; k++) {
      L.standing(`strafe-pilar-${i}-${k}`, px, k * S.pillarBlock[1], pz, S.pillarBlock, r.float(-1.2, 1.2), {
        station: n, surface: 'madeira', look: { kind: 'beech', radius: 3, tint: beechTint(r) },
      });
    }
  });
}

/** Variação de tom de um bloco de faia (multiplica o albedo da madeira). */
export function beechTint(r) {
  const v = r.float(0.9, 1.05);
  const w = r.float(-0.035, 0.035);
  return [v + w, v, v - w * 1.4];
}

/** Aparência de um livro: capa, título e o texto extra da lombada (altura do degrau). */
export function bookLook(data, r, text = '') {
  return { kind: 'book', color: r.pick(data.bookColors), title: r.pick(data.bookTitles), text };
}

/** 2 · Escadas: livro k da pilha com fundo 350 − 40k e largura 260 − 20k, costas alinhadas, lombada para o sul. */
function stairs({ data, L, rng, floorTop }) {
  const S = data.stairs;
  const n = 2;
  const y0 = floorTop(n);
  for (const p of S.piles) {
    const r = rng(`escadas-${p.step}`);
    for (let k = 0; k < S.books; k++) {
      const depth = S.depth0 - S.depthStep * k;
      const width = S.width0 - S.widthStep * k;
      const yb = y0 + k * p.step;
      L.bounds(`escadas-${p.step}-${k}`, [p.x - width / 2, p.x + width / 2], [yb, yb + p.step], [p.back, p.back + depth], {
        station: n, surface: 'papelao', look: bookLook(data, r, `${p.step} u`),
      });
    }
    if (p.note) {
      L.add({
        id: `escadas-${p.step}-placa`, station: n, shape: 'tent', size: [110, 50, 40], surface: 'papelao',
        matrix: yawMatrix(p.x - 70, y0, p.front + 55, 0), look: { kind: 'tentCard', text: p.note },
      });
    }
  }
}

/** 3 · Rampas: caixa de arquivo e cunhas que sobem para o norte até a frente dela (L = altura / tg θ). */
function ramps({ data, L, floorTop, lot }) {
  const R = data.ramps;
  const B = R.box;
  const n = 3;
  const y0 = floorTop(n);
  L.bounds('rampas-caixa', B.x, [y0, y0 + B.height], B.z, {
    station: n, surface: 'papelao', look: { kind: 'archiveBox', size: [B.x[1] - B.x[0], B.height, B.z[1] - B.z[0]] },
  });
  for (const w of R.wedges) {
    const len = B.height / Math.tan(w.deg * DEG);
    const foot = B.z[1] + len;
    // Rampa do ColliderBuilder girada 180° em Y: o +Z local (a subida) aponta para o norte; origem no pé.
    L.add({
      id: `rampas-${w.deg}`, station: n, shape: 'ramp', size: [R.width, B.height, len], surface: 'papelao',
      matrix: yawMatrix(w.x, y0, foot, 180), look: { kind: 'wedge', deg: w.deg },
    });
    // Transferidor de papel colado na lateral leste, com o centro no pé da cunha.
    L.addDecor({
      id: `rampas-${w.deg}-transferidor`, station: n, kind: 'protractor', deg: w.deg, length: len, height: B.height,
      matrix: wallDecalMatrix(w.x + R.width / 2 + 0.35, y0, foot, 90),
    });
    L.addDecor({
      id: `rampas-${w.deg}-etiqueta`, station: n, kind: 'label', text: w.note,
      matrix: floorDecalMatrix(w.x, y0 + 0.1, Math.min(foot + 30, lot(n).z[1] - 18), 0),
    });
  }
}

/** 4 · Caixas: blocos de faia de 128 × 128 com a altura em estêncil na face sul. */
function boxes({ data, L, rng, floorTop }) {
  const B = data.boxes;
  const n = 4;
  const y0 = floorTop(n);
  const r = rng('caixas');
  for (const row of B.rows) {
    row.heights.forEach((h, c) => {
      const [x0, x1] = B.columns[c];
      L.bounds(`caixas-${h}`, [x0, x1], [y0, y0 + h], row.z, {
        station: n, surface: 'madeira', look: { kind: 'beech', radius: B.radius, tint: beechTint(r) },
      });
      L.addDecor({
        id: `caixas-${h}-estencil`, station: n, kind: 'ink', cell: `estencil-${h}`, size: [78, 44],
        matrix: wallDecalMatrix((x0 + x1) / 2, y0 + h / 2, row.z[1] + 0.06, 180),
      });
    });
  }
}

export function layoutGroundStations(ctx) {
  strafe(ctx);
  stairs(ctx);
  ramps(ctx);
  boxes(ctx);
}
```


```js file=src/maps/pista/layoutAdvanced.js
// Estações 5 e 6 da pista de testes (números provisórios da 3.4): o poço de wall-jump de compensado com a saída por
// prancha até a torre de blocos, o zigue-zague de painéis entre duas plataformas, a faixa de slide com traves de
// objetos de verdade (régua, lápis, régua de aço, espeto de bambu) sobre apoios da altura exata e o gabarito de portais
// com verga de régua. Referências: PKG3/PKG6/PKG11/PKC14 (poço e paredes numeradas), PKG19 (blocos), PRU1/PRU3/PRU15
// (traves), CFO19 (palitos e etiquetas). Puro: só dados.

import * as THREE from 'three';
import { floorDecalMatrix, floorStripMatrix, wallDecalMatrix, yawMatrix, DEG } from './pieces.js';
import { beechTint, bookLook } from './layoutGround.js';

/** Pilha de blocos de faia que preenche a caixa [x0, x1] × [0, h] × [z0, z1] em `layers` camadas de nx × nz blocos. */
export function blockStack(L, id, station, [x0, x1], [z0, z1], y0, height, { layers, nx, nz, r, jitter = 1.5 }) {
  const bw = (x1 - x0) / nx;
  const bd = (z1 - z0) / nz;
  const bh = height / layers;
  for (let k = 0; k < layers; k++) {
    for (let i = 0; i < nx; i++) {
      for (let j = 0; j < nz; j++) {
        // Empilhado à mão: cada bloco um pouco fora do lugar e girado (dentro da caixa de colisão da pilha).
        const cx = x0 + bw * (i + 0.5) + r.float(-jitter, jitter) * 0.5;
        const cz = z0 + bd * (j + 0.5) + r.float(-jitter, jitter) * 0.5;
        L.standing(`${id}-bloco-${k}-${i}-${j}`, cx, y0 + k * bh, cz, [bw - jitter, bh, bd - jitter], r.float(-0.8, 0.8), {
          station, collide: false, look: { kind: 'beech', radius: 3, tint: beechTint(r) },
        });
      }
    }
  }
  return L.bounds(`${id}-colisao`, [x0, x1], [y0, y0 + height], [z0, z1], { station, surface: 'madeira' });
}

/** 5 · Poço: quatro paredes de compensado de 8 u, porta na sul, faixas numeradas por dentro, prancha até a torre. */
function well({ data, L, rng }) {
  const W = data.wallJump.well;
  const E = data.wallJump.exit;
  const n = 5;
  const t = W.wall;
  const H = W.height;
  const [ix0, ix1] = W.x;
  const [iz0, iz1] = W.z;
  const [ox0, ox1, oz0, oz1] = [ix0 - t, ix1 + t, iz0 - t, iz1 + t];
  const ply = (id, xr, yr, zr, axis) => L.board(id, xr, yr, zr, axis, { station: n, surface: 'madeira', look: { kind: 'plywood' } });
  ply('poco-norte', [ox0, ox1], [0, H], [oz0, iz0], 'z');
  ply('poco-sul-oeste', [ox0, W.door.x[0]], [0, H], [iz1, oz1], 'z');
  ply('poco-sul-leste', [W.door.x[1], ox1], [0, H], [iz1, oz1], 'z');
  ply('poco-sul-verga', W.door.x, [W.door.height, H], [iz1, oz1], 'z');
  ply('poco-leste', [ix1, ox1], [0, H], [iz0, iz1], 'x');
  ply('poco-oeste', [ox0, ix0], [0, H], [iz0, iz1], 'x');
  // Faixa de cor com o número em cada face de dentro (acima da porta), como as paredes numeradas do parkour.
  const cx = (ix0 + ix1) / 2;
  const cz = (iz0 + iz1) / 2;
  const faces = {
    norte: [cx, iz0 + 0.06, 180], sul: [cx, iz1 - 0.06, 0], leste: [ix1 - 0.06, cz, 270], oeste: [ix0 + 0.06, cz, 90],
  };
  for (const s of W.stripes) {
    const [x, z, facing] = faces[s.side];
    L.addDecor({
      id: `poco-faixa-${s.number}`, station: n, kind: 'ink', cell: `faixa-${s.number}`, size: [ix1 - ix0 - 6, 64],
      matrix: wallDecalMatrix(x, 160, z, facing),
    });
  }
  // Saída: prancha do topo da parede leste até a torre de blocos (apoiada 20 u nela).
  const T = E.tower;
  ply('poco-prancha', [ix1, T.x[0] + 20], [H, H + E.plankThickness], [cz - E.plankWidth / 2, cz + E.plankWidth / 2], 'y');
  blockStack(L, 'poco-torre', n, T.x, T.z, 0, T.height, { layers: T.layers, nx: 2, nz: 2, r: rng('poco-torre') });
}

/** 5 · Zigue-zague: plataformas A e B de blocos, painéis de papelão de parede dupla alternados e rampa de 30°. */
function zigzag({ data, L, rng }) {
  const Z = data.wallJump.zigzag;
  const n = 5;
  const r = rng('ziguezague');
  const opts = { layers: Z.layers, nx: 2, nz: 2, r };
  blockStack(L, 'zigue-a', n, Z.x, Z.platformA, 0, Z.platformHeight, opts);
  blockStack(L, 'zigue-b', n, Z.x, Z.platformB, 0, Z.platformHeight, opts);
  const P = Z.panel;
  const panel = (id, xr, zr) => L.panel(id, xr, [0, P.height], zr, 'x', {
    station: n, surface: 'papelao', look: { kind: 'panel', wall: 'double', thickness: P.thickness },
  });
  Z.west.forEach((zr, i) => panel(`zigue-oeste-${i}`, [Z.x[0] - P.thickness, Z.x[0]], zr));
  Z.east.forEach((zr, i) => panel(`zigue-leste-${i}`, [Z.x[1], Z.x[1] + P.thickness], zr));
  // Rampa de papelão subindo do leste até a borda leste da plataforma A.
  const len = Z.platformHeight / Math.tan(Z.ramp.deg * DEG);
  const zc = (Z.platformA[0] + Z.platformA[1]) / 2;
  L.add({
    id: 'zigue-rampa', station: n, shape: 'ramp', size: [Z.ramp.width, Z.platformHeight, len], surface: 'papelao',
    matrix: yawMatrix(Z.x[1] + len, 0, zc, 90), look: { kind: 'wedge', deg: Z.ramp.deg },
  });
}

/** 6 · Faixa de slide: traves atravessadas com a face de baixo exata sobre apoios de bloco e caderninhos. */
function slide({ data, L, rng }) {
  const S = data.slide;
  const n = 6;
  const [lx0, lx1] = S.lane.x;
  const zc = (S.lane.z[0] + S.lane.z[1]) / 2;
  S.lane.z.forEach((z, i) => {
    L.addDecor({ id: `slide-fita-${i}`, station: n, kind: 'tape', matrix: floorStripMatrix((lx0 + lx1) / 2, 0.1, z, 90), length: lx1 - lx0, width: 19 });
  });
  const r = rng('slide');
  const half = S.support / 2;
  for (const b of S.bars) {
    const [bw, bt, bl] = b.size;
    S.supportZ.forEach((z, j) => {
      let y = 0;
      b.stack.forEach((h, k) => {
        const id = `slide-${b.under}-apoio-${j}-${k}`;
        const look = k === 0 ? { kind: 'beech', radius: 2, tint: beechTint(r) } : bookLook(data, r);
        // Caderninhos com a lombada virada para quem vem correndo (oeste).
        L.standing(id, b.x, y, z, [S.support, h, S.support], k === 0 ? 0 : 90 + r.float(-3, 3), {
          station: n, surface: k === 0 ? 'madeira' : 'papelao', look,
        });
        y += h;
      });
      L.addDecor({
        id: `slide-${b.under}-bolota-${j}`, station: n, kind: 'clayLump', seed: `slide-${b.under}-${j}`,
        color: data.prints.colors[(j + b.under) % data.prints.colors.length],
        matrix: new THREE.Matrix4().makeTranslation(b.x, b.under + bt, z + (j ? -half * 0.2 : half * 0.2)),
      });
    });
    const surface = b.kind === 'aco' ? 'metal' : 'madeira';
    L.standing(`slide-${b.under}-trave`, b.x, b.under, zc, [bw, bt, bl], 0, { station: n, surface, look: { kind: b.kind, size: b.size } });
    L.addDecor({
      id: `slide-${b.under}-etiqueta`, station: n, kind: 'label', text: `${b.under} u`,
      matrix: floorDecalMatrix(b.x - 80, 0.3, zc, 90),
    });
  }
}

/** 6 · Gabarito: quatro portais de colunas de faia com verga de régua de 15 cm, vão livre exato. */
function gauge({ data, L, rng }) {
  const G = data.gauge;
  const n = 6;
  const r = rng('gabarito');
  const off = G.opening / 2 + G.column / 2;
  for (const p of G.portals) {
    [-1, 1].forEach((s, i) => {
      L.standing(`gabarito-${p.clear}-coluna-${i}`, p.x + s * off, 0, G.z, [G.column, p.clear, G.depth], 0, {
        station: n, surface: 'madeira', look: { kind: 'beech', radius: 2, tint: beechTint(r) },
      });
    });
    L.standing(`gabarito-${p.clear}-verga`, p.x, p.clear, G.z, G.lintel, 0, {
      station: n, surface: 'madeira', look: { kind: 'regua', size: G.lintel },
    });
    L.addDecor({
      id: `gabarito-${p.clear}-etiqueta`, station: n, kind: 'label', text: p.note,
      matrix: floorDecalMatrix(p.x, 0.1, G.z - G.depth / 2 - 42, 180),
    });
  }
}

export function layoutAdvancedStations(ctx) {
  well(ctx);
  zigzag(ctx);
  slide(ctx);
  gauge(ctx);
}
```


```js file=src/maps/pista/layoutTower.js
// Estação 7 da pista de testes: a torre de queda. Tubo de papelão grosso com uma escada em espiral de 78 livros
// encaixados nele (BAS1/BAS4/BAS9), um por degrau, 18° à frente do de baixo no sentido horário, em cinco trechos de
// espessura própria para que cada marca de queda caia exata; pranchas de compensado apoiadas nos livros das marcas,
// giradas para trás; alvos pintados no chão; tábua de crescimento com as alturas (WRG1/WRG4/WRG11). Puro: só dados.

import * as THREE from 'three';
import { basisMatrix, floorDecalMatrix, headingDir, wallDecalMatrix, yawMatrix } from './pieces.js';
import { bookLook } from './layoutGround.js';

/** Ponto [x, z] a `r` do eixo no rumo `h`. */
function polar(axis, r, h) {
  const [dx, dz] = headingDir(h);
  return [axis[0] + dx * r, axis[1] + dz * r];
}

/**
 * Espiral: livro k no rumo firstHeading + stepDeg·k, de y0 a y1 (espessura do trecho). O último livro de cada trecho
 * fecha exatamente no topo do trecho. Devolve os livros e as marcas (topo do trecho + prancha).
 */
export function spiralBooks(T) {
  const books = [];
  const marks = [];
  let start = 0;
  let k = 0;
  for (const seg of T.segments) {
    const t = (seg.top - start) / seg.books;
    for (let i = 0; i < seg.books; i++, k++) {
      const y0 = start + i * t;
      const y1 = i === seg.books - 1 ? seg.top : start + (i + 1) * t;
      books.push({ index: k, heading: (T.firstHeading + T.stepDeg * k) % 360, y0, y1 });
    }
    const last = books[books.length - 1];
    marks.push({
      book: last.index, bookTop: seg.top, height: seg.top + T.plank.thickness,
      heading: (last.heading - T.plank.backDeg + 360) % 360,
    });
    start = seg.top;
  }
  return { books, marks };
}

export function layoutTower({ data, L, rng }) {
  const T = data.tower;
  const n = 7;
  const axis = T.axis;
  L.add({
    id: 'torre-tubo', station: n, shape: 'cylinder', size: [T.tube.radius, T.tube.height], surface: 'papelao',
    matrix: new THREE.Matrix4().makeTranslation(axis[0], 0, axis[1]),
    look: { kind: 'tube', radius: T.tube.radius, wall: T.tube.wall, height: T.tube.height },
  });
  const { books, marks } = spiralBooks(T);
  const rc = T.book.inner + T.book.length / 2;
  const r = rng('torre-livros');
  for (const b of books) {
    const [cx, cz] = polar(axis, rc, b.heading);
    // Livro deitado com o comprimento no raio e a lombada no lado anti-horário (o espelho do degrau para quem sobe):
    // no quadro canônico do livro a lombada fica em +Z, e o yaw de rumo + 90 põe o +Z no rumo − 90.
    L.add({
      id: `torre-livro-${b.index}`, station: n, shape: 'box', size: [T.book.length, b.y1 - b.y0, T.book.width],
      matrix: yawMatrix(cx, (b.y0 + b.y1) / 2, cz, b.heading + 90), surface: 'papelao', look: bookLook(data, r),
    });
  }
  const P = T.plank;
  const plankLen = P.to - P.from;
  for (const m of marks) {
    const [cx, cz] = polar(axis, (P.from + P.to) / 2, m.heading);
    L.add({
      id: `torre-prancha-${m.height}`, station: n, shape: 'box', size: [P.width, P.thickness, plankLen],
      matrix: yawMatrix(cx, m.bookTop + P.thickness / 2, cz, m.heading), surface: 'madeira', look: { kind: 'plywood' },
    });
    const [tx, tz] = polar(axis, T.target.at, m.heading);
    L.addDecor({
      id: `torre-alvo-${m.height}`, station: n, kind: 'ink', cell: `alvo-${m.height}`,
      size: [T.target.radius * 2, T.target.radius * 2], matrix: floorDecalMatrix(tx, 0.05, tz, m.heading),
    });
  }
  // Tábua de crescimento em pé, voltada para fora: numerais a cada 100 u e traços a cada 10 u (measureMaterials) e,
  // nas cinco alturas, o risco a lápis atravessado e a anotação à mão escrita ao longo da tábua (de baixo para cima,
  // terminando no risco), na metade direita — a tábua é estreita como uma régua de parede.
  const G = T.growth;
  const [gx, gz] = polar(axis, G.at, G.heading);
  L.add({
    id: 'torre-regua', station: n, shape: 'box', size: G.size, surface: 'madeira',
    matrix: yawMatrix(gx, G.size[1] / 2, gz, G.heading + 180), look: { kind: 'growth', size: G.size },
  });
  const [nx, nz] = headingDir(G.heading);
  const [rx, rz] = headingDir(G.heading + 90); // à direita de quem olha a tábua de fora
  const front = G.size[2] / 2 + 0.08;
  const fx = gx + nx * front;
  const fz = gz + nz * front;
  for (const [h, text] of Object.entries(G.notes)) {
    const y = Number(h);
    L.addDecor({
      id: `torre-risco-${y}`, station: n, kind: 'ink', cell: 'risco', size: [G.size[0] + 6, 3],
      matrix: wallDecalMatrix(fx, y, fz, G.heading),
    });
    const len = G.noteHeight * 0.62 * text.length + 8;
    const side = G.size[0] * 0.22;
    L.addDecor({
      id: `torre-nota-${y}`, station: n, kind: 'ink', cell: `nota-${y}`, text, size: [len, G.noteHeight],
      matrix: basisMatrix([fx + rx * side + nx * 0.02, y - 4 - len / 2, fz + rz * side + nz * 0.02], [0, 1, 0], [-rx, 0, -rz]),
    });
  }
  return {
    axis, books, marks,
    /** Ponto de teleporte na prancha de altura `height` (olhando para fora, para o alvo). */
    plankSpot(height) {
      const m = marks.find((mk) => mk.height === height);
      if (!m) throw new Error(`prancha desconhecida na torre: ${height}`);
      const [x, z] = polar(axis, T.spot.at, m.heading);
      return { x, z, heading: m.heading, pitch: T.spot.pitch, below: height + 60 };
    },
    /** Pé da espiral: antes do primeiro livro, olhando no sentido da subida (horário). */
    spiralSpot() {
      const h = T.firstHeading - T.spot.spiralBefore;
      const [x, z] = polar(axis, T.spot.spiralAt, h);
      return { x, z, heading: (h + 90) % 360, pitch: -4 };
    },
  };
}
```


```js file=src/maps/pista/layoutCourse.js
// Estações 8–12 da pista de testes: faixa de bhop com a trena esticada no kraft (TMA2/TMA6/TMA12, WRG15), vigas de
// balsa entre plataformas de faia (BWM1/BWM10/BWM14, COC1), paredes finas de papelão de uma face (CBT12, COC15,
// PKG12), túnel baixo de caixas rasas com pisca-pisca (COC2/COC25, CBT6/CBT7/CBT13/CBT14) e as placas de massinha
// das pegadas (CFP1/CFP7/CFP10, CIM1/CIM5/CIM8). Puro: só dados.

import * as THREE from 'three';
import { DEG, basisMatrix, floorDecalMatrix, floorStripMatrix, headingDir, headingOf, yawMatrix } from './pieces.js';
import { sheetTapes } from './layoutGround.js';
import { blockStack } from './layoutAdvanced.js';

/** 8 · Bhop: kraft com fita nas bordas, trena do zero na largada até a chegada, etiquetas a cada 500 u e bandeira. */
function bhop({ data, L }) {
  const B = data.bhop;
  const k = data.floors.kraft;
  const n = 8;
  L.bounds('bhop-kraft', B.paper.x, [0, k.thickness], B.paper.z, { station: n, surface: k.surface, look: { kind: 'paper', color: k.color } });
  const [x0, x1] = B.paper.x;
  const [z0, z1] = B.paper.z;
  const y = k.thickness + 0.1;
  [z0, z1].forEach((z, i) => {
    L.addDecor({ id: `bhop-fita-borda-${i}`, station: n, kind: 'tape', matrix: floorStripMatrix((x0 + x1) / 2, y, z, 90), length: x1 - x0 + 30, width: 19 });
  });
  [x0, x1].forEach((x, i) => {
    L.addDecor({ id: `bhop-fita-ponta-${i}`, station: n, kind: 'tape', matrix: floorStripMatrix(x, y + 0.1, (z0 + z1) / 2, 0), length: z1 - z0 + 30, width: 19 });
  });
  const finish = B.start + B.length;
  L.addDecor({
    id: 'bhop-largada', station: n, kind: 'tape', color: '#F4EDE1', length: z1 - z0 - 40, width: 19,
    matrix: floorStripMatrix(B.start, y + 0.2, (z0 + z1) / 2, 0),
  });
  L.addDecor({
    id: 'bhop-chegada', station: n, kind: 'tape', color: '#D1362F', length: z1 - z0 - 40, width: 19,
    matrix: floorStripMatrix(finish, y + 0.2, (z0 + z1) / 2, 0),
  });
  // Lâmina da trena deitada no kraft, do gancho (zero) na largada até o estojo na chegada.
  L.addDecor({
    id: 'bhop-trena', station: n, kind: 'trena', length: B.length, width: B.trena.width, color: B.trena.color,
    matrix: floorStripMatrix(B.start + B.length / 2, y + 0.3, B.trena.z, 90),
  });
  const [cw, ch, cd] = B.case.size;
  L.standing('bhop-estojo', finish + cw / 2, k.thickness, B.case.z, [cw, ch, cd], 0, {
    station: n, surface: 'plastico', look: { kind: 'trenaCase', size: B.case.size, color: B.trena.color },
  });
  for (let d = B.labelEvery; d < B.length; d += B.labelEvery) {
    L.addDecor({
      id: `bhop-etiqueta-${d}`, station: n, kind: 'label', text: `${d / 100} m · ${d} u`,
      matrix: floorDecalMatrix(B.start + d, y + 0.3, B.labelZ, 90),
    });
  }
  L.addDecor({
    id: 'bhop-bandeira', station: n, kind: 'flag', stick: B.flag.stick, seed: 'bandeira-bhop',
    matrix: new THREE.Matrix4().makeTranslation(B.flag.at[0], k.thickness, B.flag.at[1]),
  });
}

/** 9 · Vigas de balsa: plataformas de faia, quatro ripas de larguras diferentes, alfinetes e ripa inclinada. */
function beams({ data, L, rng, floorTop }) {
  const V = data.beams;
  const n = 9;
  const y0 = floorTop(n);
  const r = rng('vigas');
  V.platforms.forEach((xr, i) => {
    blockStack(L, `vigas-plataforma-${i}`, n, xr, V.z, y0, V.height, { layers: V.layers, nx: 2, nz: 4, r });
  });
  const top = y0 + V.height;
  const { from, to, thickness } = V.beam;
  for (const b of V.widths) {
    L.standing(`vigas-${b.width}`, (from + to) / 2, top, b.z, [to - from, thickness, b.width], 0, {
      station: n, surface: 'madeira', look: { kind: 'balsa', seed: `viga-${b.width}` },
    });
    [from + 9, to - 9].forEach((x, j) => {
      L.addDecor({
        id: `vigas-${b.width}-alfinete-${j}`, station: n, kind: 'pin', seed: `alfinete-${b.width}-${j}`,
        color: data.prints.colors[(j * 3 + b.width) % data.prints.colors.length],
        matrix: new THREE.Matrix4().makeTranslation(x, top + thickness, b.z + r.float(-b.width * 0.2, b.width * 0.2)),
      });
    });
    L.addDecor({
      id: `vigas-${b.width}-etiqueta`, station: n, kind: 'label', text: `${b.width} u`,
      matrix: floorDecalMatrix(V.platforms[0][1] - 60, top + 0.1, b.z + b.width / 2 + 20, 90),
    });
  }
  // Ripa inclinada: a face de cima vai do chão (pé) até a borda sul da primeira plataforma, na altura do topo dela.
  const I = V.incline;
  const run = V.height / Math.tan(I.deg * DEG);
  const zTop = V.z[1];
  const a = new THREE.Vector3(I.x, y0, zTop + run);
  const b = new THREE.Vector3(I.x, top, zTop);
  const down = new THREE.Vector3().subVectors(a, b).normalize();
  const up = new THREE.Vector3(0, down.z, -down.y); // perpendicular à descida, para cima
  const len = a.distanceTo(b);
  const center = a.clone().add(b).multiplyScalar(0.5).addScaledVector(up, -I.thickness / 2);
  L.add({
    id: 'vigas-rampa', station: n, shape: 'box', size: [len, I.thickness, I.width], surface: 'madeira',
    matrix: basisMatrix(center.toArray(), down.toArray(), up.toArray()), look: { kind: 'balsa', seed: 'viga-inclinada' },
  });
}

/** Linhas deslocadas de um trecho de reta, com junta em meia-esquadria nos vértices internos. */
function offsetPolyline(points, offset) {
  const segs = [];
  for (let i = 0; i + 1 < points.length; i++) {
    const [ax, az] = points[i];
    const [bx, bz] = points[i + 1];
    const len = Math.hypot(bx - ax, bz - az);
    const d = [(bx - ax) / len, (bz - az) / len];
    const nrm = [-d[1], d[0]];
    segs.push({ p: [ax + nrm[0] * offset, az + nrm[1] * offset], d, len });
  }
  const meet = (s, t) => {
    // s.p + u·s.d = t.p + v·t.d
    const det = s.d[0] * -t.d[1] - s.d[1] * -t.d[0];
    const rx = t.p[0] - s.p[0];
    const rz = t.p[1] - s.p[1];
    const u = (rx * -t.d[1] - rz * -t.d[0]) / det;
    return [s.p[0] + s.d[0] * u, s.p[1] + s.d[1] * u];
  };
  return segs.map((s, i) => [
    i === 0 ? s.p : meet(segs[i - 1], s),
    i === segs.length - 1 ? [s.p[0] + s.d[0] * s.len, s.p[1] + s.d[1] * s.len] : meet(s, segs[i + 1]),
  ]);
}

/** Parede fina de papelão de uma face entre dois pontos do chão (a espessura para os dois lados da linha). */
function thinWall(L, id, station, [ax, az], [bx, bz], y0, height, thickness, extend = 0) {
  const len = Math.hypot(bx - ax, bz - az) + extend * 2;
  const heading = headingOf(bx - ax, bz - az);
  // O +X local fica à direita do rumo: com yaw no rumo − 90 ele aponta ao longo da parede (de a para b).
  return L.add({
    id, station, shape: 'box', size: [len, height, thickness], surface: 'papelao',
    matrix: yawMatrix((ax + bx) / 2, y0 + height / 2, (az + bz) / 2, heading - 90),
    look: { kind: 'panel', wall: 'single', thickness },
  });
}

/** 10 · Paredes finas: fileira de espessuras, muro com vãos de 33 e 31 u, corredor em zigue-zague, quina e curva. */
function walls({ data, L, floorTop }) {
  const W = data.walls;
  const n = 10;
  const y0 = floorTop(n);
  const H = W.height;
  const t = W.thickness;
  for (const p of W.row.panels) {
    const half = W.row.length / 2;
    thinWall(L, `paredes-espessura-${p.t}`, n, [p.x - half, W.row.z], [p.x + half, W.row.z], y0, H, p.t);
    L.addDecor({
      id: `paredes-espessura-${p.t}-etiqueta`, station: n, kind: 'label', text: `${String(p.t).replace('.', ',')} u`,
      matrix: floorDecalMatrix(p.x, y0 + 0.1, W.row.z + 40, 0),
    });
  }
  // Muro com dois vãos.
  const G = W.gapWall;
  let x = G.x[0];
  G.gaps.forEach((g, i) => {
    const gx0 = g.x - g.width / 2;
    thinWall(L, `paredes-muro-${i}`, n, [x, G.z], [gx0, G.z], y0, H, t);
    x = g.x + g.width / 2;
    L.addDecor({
      id: `paredes-vao-${g.width}-etiqueta`, station: n, kind: 'label', text: g.note,
      matrix: floorDecalMatrix(g.x, y0 + 0.1, G.z + 46, 0),
    });
  });
  thinWall(L, `paredes-muro-${G.gaps.length}`, n, [x, G.z], [G.x[1], G.z], y0, H, t);
  // Corredor em zigue-zague: linha central por trechos, paredes deslocadas de meia largura + meia espessura.
  const Z = W.zigzag;
  const pts = [Z.start];
  for (const h of Z.headings) {
    const [dx, dz] = headingDir(h);
    const [px, pz] = pts[pts.length - 1];
    pts.push([px + dx * Z.segment, pz + dz * Z.segment]);
  }
  [-1, 1].forEach((s) => {
    offsetPolyline(pts, s * (Z.width / 2 + t / 2)).forEach(([a, b], i) => {
      thinWall(L, `paredes-corredor-${s < 0 ? 'e' : 'd'}-${i}`, n, a, b, y0, H, t, t * 0.6);
    });
  });
  // Quina aguda aberta para o sul: as faces de dentro se encontram no vértice.
  const C = W.corner;
  [180 - C.deg / 2, 180 + C.deg / 2].forEach((h, i) => {
    const [dx, dz] = headingDir(h);
    const inward = i === 0 ? [-dz, dx] : [dz, -dx]; // normal que aponta para dentro da quina
    const ox = -inward[0] * (t / 2);
    const oz = -inward[1] * (t / 2);
    const a = [C.apex[0] + ox, C.apex[1] + oz];
    const b = [C.apex[0] + dx * C.length + ox, C.apex[1] + dz * C.length + oz];
    thinWall(L, `paredes-quina-${i}`, n, a, b, y0, H, t);
  });
  // Parede curva: arco de 90° em trechos retos.
  const R = W.curve;
  for (let i = 0; i < R.segments; i++) {
    const h0 = R.from + ((R.to - R.from) * i) / R.segments;
    const h1 = R.from + ((R.to - R.from) * (i + 1)) / R.segments;
    const [ax, az] = headingDir(h0);
    const [bx, bz] = headingDir(h1);
    thinWall(L, `paredes-curva-${i}`, n,
      [R.center[0] + ax * R.radius, R.center[1] + az * R.radius],
      [R.center[0] + bx * R.radius, R.center[1] + bz * R.radius], y0, H, t, t * 0.4);
  }
}

/** 11 · Túnel: três caixas rasas sem fundo, degrau fechado entre os tetos, abas nas bocas, furos, respiros e luzes. */
function tunnel({ data, L }) {
  const T = data.tunnel;
  const n = 11;
  const t = T.wall;
  const [iz0, iz1] = T.z;
  const [oz0, oz1] = [iz0 - t, iz1 + t];
  const boxes = T.boxes;
  const tall = Math.max(...boxes.map((b) => b.height));
  boxes.forEach((b, i) => {
    const low = b.height < tall;
    const look = (part) => ({ kind: 'tunnel', part, box: i, low, size: [b.x[1] - b.x[0], b.height] });
    L.panel(`tunel-${i}-norte`, b.x, [0, b.height], [iz1, oz1], 'z', { station: n, surface: 'papelao', look: look('norte') });
    L.panel(`tunel-${i}-sul`, b.x, [0, b.height], [oz0, iz0], 'z', { station: n, surface: 'papelao', look: look('sul') });
    L.panel(`tunel-${i}-teto`, b.x, [b.height - t, b.height], [oz0, oz1], 'y', { station: n, surface: 'papelao', look: look('teto') });
  });
  // Degrau entre os tetos: a parede da ponta da caixa alta, da face de baixo do teto baixo até o teto alto.
  for (let i = 0; i + 1 < boxes.length; i++) {
    const a = boxes[i];
    const b = boxes[i + 1];
    const xs = a.x[1];
    const lowH = Math.min(a.height, b.height);
    L.panel(`tunel-degrau-${i}`, [xs - t / 2, xs + t / 2], [lowH - t, Math.max(a.height, b.height)], [oz0, oz1], 'x', {
      station: n, surface: 'papelao', look: { kind: 'panel', wall: 'regular', thickness: t },
    });
    // Fita larga atravessada no teto da caixa alta, perto da emenda.
    const into = a.height > b.height ? -1 : 1;
    L.addDecor({
      id: `tunel-fita-${i}`, station: n, kind: 'tape', width: 48, length: oz1 - oz0 + 24,
      matrix: floorStripMatrix(xs + into * 30, Math.max(a.height, b.height) + 0.15, (oz0 + oz1) / 2, 180),
    });
  }
  const first = boxes[0];
  const last = boxes[boxes.length - 1];
  L.addDecor({ id: 'tunel-abas-oeste', station: n, kind: 'tunnelFlaps', x: first.x[0], outward: -1, height: first.height, z: [oz0, oz1] });
  L.addDecor({ id: 'tunel-abas-leste', station: n, kind: 'tunnelFlaps', x: last.x[1], outward: 1, height: last.height, z: [oz0, oz1] });
  // Pisca-pisca: fio preso sob o teto do lado norte, 12 lampadinhas quentes.
  const anchors = [];
  const count = T.bulbs + 1;
  const x0 = first.x[0] + 16;
  const x1 = last.x[1] - 16;
  for (let i = 0; i < count; i++) {
    const x = x0 + ((x1 - x0) * i) / (count - 1);
    const box = boxes.find((b) => x >= b.x[0] && x <= b.x[1]) ?? last;
    anchors.push([x, box.height - t - 2, iz1 - 16]);
  }
  L.addDecor({ id: 'tunel-pisca', station: n, kind: 'fairyLights', anchors, sag: 7, matrix: new THREE.Matrix4() });
}

/** 12 · Pegadas: tira de kraft com as sete placas de massinha (P-E-G-A-D-A-S) giradas ±4°. */
function prints({ data, L, rng }) {
  const P = data.prints;
  const k = data.floors.kraft;
  const n = 12;
  L.bounds('pegadas-kraft', P.paper.x, [0, k.thickness], P.paper.z, { station: n, surface: k.surface, look: { kind: 'paper', color: k.color } });
  sheetTapes(L, 'pegadas-kraft', n, P.paper.x, P.paper.z, k.thickness + 0.1, { length: 70 });
  const r = rng('pegadas');
  [...P.letters].forEach((letter, i) => {
    L.standing(`pegadas-${i}`, P.from + P.step * i, k.thickness, P.z, P.plate, r.float(-P.turnDeg, P.turnDeg), {
      station: n, surface: 'massinha', look: { kind: 'clayPlate', color: P.colors[i], letter, seed: `placa-${i}` },
    });
  });
}

export function layoutCourse(ctx) {
  bhop(ctx);
  beams(ctx);
  walls(ctx);
  tunnel(ctx);
  prints(ctx);
}
```


- [ ] **Passo 7: Colisão e estações**

```js file=src/maps/pista/colliders.js
// Formas de colisão da pista de testes a partir das peças do layout (pieces.js): caixas, cunhas, cilindros e as
// plaquinhas em "A" (duas cunhas de costas). O relevo visual (empeno do papelão, cantos arredondados da faia, lombada
// do livro, calombos da massinha) não entra: colisão lisa com as medidas exatas das estações. Puro.

import * as THREE from 'three';
import { ColliderBuilder } from '../../physics/colliders.js';

const _m = new THREE.Matrix4();
const _local = new THREE.Matrix4();

/** Plaquinha dobrada em "A": duas rampas de costas, subindo das bordas da base até a cumeeira em z = 0. */
function tent(b, [w, h, d], matrix, surface) {
  const half = d / 2;
  // Metade da frente: sobe de z = −d/2 (y = 0) até z = 0 (y = h).
  b.ramp(w, half, h, { matrix: _m.multiplyMatrices(matrix, _local.makeTranslation(0, 0, -half)), surface });
  // Metade de trás: a mesma rampa girada 180° em Y, subindo de z = +d/2.
  _local.makeRotationY(Math.PI).setPosition(0, 0, half);
  b.ramp(w, half, h, { matrix: _m.multiplyMatrices(matrix, _local), surface });
}

/** ColliderBuilder com todas as peças que colidem. */
export function buildPistaColliders(layout) {
  const b = new ColliderBuilder();
  for (const p of layout.pieces) {
    if (!p.collide) continue;
    const [a, c, d] = p.size;
    if (p.shape === 'box') b.box(a, c, d, { matrix: p.matrix, surface: p.surface });
    else if (p.shape === 'ramp') b.ramp(a, d, c, { matrix: p.matrix, surface: p.surface });
    else if (p.shape === 'cylinder') b.cylinder(a, c, { segments: 32, matrix: p.matrix, surface: p.surface });
    else if (p.shape === 'tent') tent(b, p.size, p.matrix, p.surface);
    else throw new Error(`forma de colisão desconhecida na pista: ${p.shape} (${p.id})`);
  }
  return b;
}
```


```js file=src/maps/stations.js
// Estações de mapa (MapInstance.stations; a pista de testes da 3.3 declara as suas e os mapas da Fase 6 podem declarar
// as deles): [{ number, id, label, aliases, spots: [{ id, label, position, yaw, pitch }] }]. Aqui: a altura dos pés de
// cada ponto (raio de cima para baixo no mundo de colisão), a lista para o console e a busca de `estacao [n|nome]
// [ponto]` — sem acento e sem diferenciar maiúsculas. Puro (o console e os testes usam).

import * as THREE from 'three';
import { createRayHit } from '../physics/collisionWorld.js';

const DEG = Math.PI / 180;

/** Texto de busca: minúsculo e sem acento ("Túnel" → "tunel"). */
export function searchKey(text) {
  return String(text ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

/**
 * Altura do chão em (x, z): a primeira superfície de um raio de cima para baixo a partir de `below` (y), ou null sem
 * chão até 200 u abaixo de 0.
 */
export function groundAt(world, x, z, below = 3000, hit = createRayHit()) {
  world.raycast(x, below, z, 0, -1, 0, below + 200, hit);
  return hit.hit ? hit.point.y : null;
}

/**
 * Estações prontas para o jogo: cada ponto { id, label, x, z, heading, pitch, below } vira posição com a altura do chão
 * embaixo dele (groundAt a partir de `below`) e yaw/pitch em radianos (yaw = −rumo).
 */
export function resolveStations(defs, world) {
  const hit = createRayHit();
  return defs.map((s) => ({
    number: s.number,
    id: s.id,
    label: s.label,
    aliases: [...(s.aliases ?? [])],
    spots: s.spots.map((sp) => {
      const y = groundAt(world, sp.x, sp.z, sp.below ?? 3000, hit);
      if (y === null) throw new Error(`ponto sem chão: estação ${s.id}, ${sp.id}`);
      return {
        id: sp.id,
        label: sp.label ?? sp.id,
        position: new THREE.Vector3(sp.x, y, sp.z),
        yaw: -sp.heading * DEG,
        pitch: (sp.pitch ?? 0) * DEG,
      };
    }),
  }));
}

/** Lista para o console: uma linha por estação com os pontos. */
export function describeStations(stations) {
  return stations.map((s) => {
    const spots = s.spots.map((p) => p.id).join(', ');
    return `${String(s.number).padStart(2)} ${s.id.padEnd(10)} ${s.label} — pontos: ${spots}`;
  }).join('\n');
}

/**
 * Busca de `estacao [n|nome] [ponto]`: a estação por número, id ou apelido; sem estação que case, um ponto de nome
 * único em todas (ex.: `gabarito`). Sem ponto, o primeiro da estação. Erro com as opções quando não acha.
 * @returns {{station: object, spot: object}}
 */
export function findStationSpot(stations, args) {
  const [first, second] = args.map(searchKey);
  if (!first) throw new Error('diga a estação (número ou nome)');
  const station = stations.find((s) => String(s.number) === first || searchKey(s.id) === first
    || s.aliases.some((a) => searchKey(a) === first));
  if (station) {
    if (!second) return { station, spot: station.spots[0] };
    const spot = station.spots.find((p) => searchKey(p.id) === second);
    if (!spot) throw new Error(`ponto desconhecido em ${station.id}: ${args[1]}. Pontos: ${station.spots.map((p) => p.id).join(', ')}`);
    return { station, spot };
  }
  const matches = stations.flatMap((s) => s.spots.filter((p) => searchKey(p.id) === first).map((spot) => ({ station: s, spot })));
  if (matches.length === 1 && !second) return matches[0];
  if (matches.length > 1) {
    throw new Error(`"${args[0]}" é ponto de mais de uma estação (${matches.map((m) => m.station.id).join(', ')}): use estacao <estação> ${args[0]}`);
  }
  throw new Error(`estação desconhecida: ${args[0]}. Estações: ${stations.map((s) => `${s.number} ${s.id}`).join(', ')}`);
}
```


- [ ] **Passo 8: Rodar e ver passar**

Run: `node --test tests/pistaLayout.test.js tests/pistaMovement.test.js tests/pistaFuzz.test.js`
Expected: PASS (26 testes; o fuzz leva alguns segundos).


- [ ] **Passo 9: Suíte inteira**

Run: `npm test`
Expected: 192 testes passando.


- [ ] **Commit (só quando o usuário pedir)**

```bash
git add src/data/pista.js src/maps/pista src/maps/stations.js src/render/studio/fixtures.js tests/pistaLayout.test.js tests/pistaMovement.test.js tests/pistaFuzz.test.js
git commit -m "feat(fase-3.3): layout, colisão e estações da pista de testes" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```


---

### Tarefa 2: Medidor de salto e queda

**Files:**
- Create: `src/debug/jumpMeter.js`
- Test: `tests/jumpMeter.test.js`

Por voo (pulo ou queda de uma beirada): distância no plano, ápice acima da saída, tempo no ar, queda (ápice − pouso) e velocidade de pouso; por série de bhop (pulos com até 1 tick no chão entre eles): pulos, distância, velocidade média e máxima. Teleporte (mais de 64 u num tick, ou `interrupt()` chamado pelo `matchState`) e noclip descartam o voo.

- [ ] **Passo 1: Escrever o teste**

```js file=tests/jumpMeter.test.js
// Testes do medidor de salto e queda (subfase 3.3): sequências sintéticas (pulo, queda de beirada, teleporte, noclip,
// série de bhop que quebra com 2 ticks no chão) e o jogador do jogo simulado — pulo parado, pulo correndo, série de bhop
// perfeita e a queda de 900 u.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { AIR_KIND, JumpMeter } from '../src/debug/jumpMeter.js';
import { MOVE } from '../src/data/movement.js';
import { BTN } from '../src/player/moveCmd.js';
import { floor, worldOf } from './worldTestUtils.js';
import { DT, forward, idle, makePlayer, run } from './playerTestUtils.js';

const near = (a, b, eps, msg) => assert.ok(Math.abs(a - b) <= eps, `${msg}: ${a} ≠ ${b}`);

/** Estado sintético: pés em (x, y, z), velocidade no plano (vx, vz), no chão ou não. */
const st = (x, y, z, onGround, vx = 0, vz = 0, moveType = 'andar') => ({
  origin: new THREE.Vector3(x, y, z), velocity: new THREE.Vector3(vx, 0, vz), onGround, moveType,
});

test('pulo sintético: distância no plano, ápice, tempo, queda e pouso', () => {
  const m = new JumpMeter();
  m.update(st(0, 0, 0, true), []);
  m.update(st(4, 10, 0, false, 250), [{ type: 'jump' }]);
  m.update(st(8, 30, 3, false, 250), []);
  assert.equal(m.air.kind, AIR_KIND.JUMP);
  m.update(st(12, 20, 3, false, 250), []);
  m.update(st(16, 5, 3, true, 250), [{ type: 'land', speed: 180 }]);
  assert.equal(m.air, null);
  assert.equal(m.last.kind, AIR_KIND.JUMP);
  near(m.last.distance, Math.hypot(16, 3), 1e-12, 'distância');
  assert.equal(m.last.apex, 30);
  assert.equal(m.last.drop, 25);
  assert.equal(m.last.landSpeed, 180);
  near(m.last.time, 4 * DT, 1e-12, 'tempo');
  assert.equal(m.best.distance, m.last.distance);
});

test('queda de beirada sem pulo, teleporte e noclip descartam', () => {
  const m = new JumpMeter();
  m.update(st(0, 100, 0, true), []);
  m.update(st(3, 99, 0, false), []);
  assert.equal(m.air.kind, AIR_KIND.FALL);
  m.update(st(4.5, 50, 0, false), []); // quedas rápidas andam até ~55 u por tick (3500 u/s): não é teleporte
  m.update(st(6, 0, 0, true), [{ type: 'land', speed: 400 }]);
  assert.equal(m.last.kind, AIR_KIND.FALL);
  assert.equal(m.last.drop, 100);
  assert.equal(m.last.apex, 0);
  m.update(st(6, 0, 0, true), []);
  m.update(st(6, 10, 0, false), [{ type: 'jump' }]);
  m.update(st(500, 10, 0, false), []); // teleporte no meio do pulo
  assert.equal(m.air, null);
  m.update(st(500, 5, 0, true), [{ type: 'land', speed: 100 }]);
  assert.equal(m.last.kind, AIR_KIND.FALL, 'o pulo interrompido não conta');
  m.update(st(500, 50, 0, false, 0, 0, 'noclip'), []);
  assert.equal(m.air, null);
  m.reset();
  assert.equal(m.last, null);
  assert.equal(m.best.distance, 0);
});

test('interrupt (teleporte de perto): descarta o voo, fecha a série e guarda o último voo e os recordes', () => {
  const m = new JumpMeter();
  m.update(st(0, 0, 0, true), []);
  m.update(st(5, 10, 0, false, 250), [{ type: 'jump' }]);
  m.update(st(10, 0, 0, true, 250), [{ type: 'land', speed: 100 }]);
  m.update(st(15, 10, 0, false, 250), [{ type: 'jump' }]); // segundo pulo da série, ainda no ar
  const first = m.last.distance;
  m.interrupt();
  assert.equal(m.air, null);
  assert.equal(m.series, null);
  assert.equal(m.lastSeries.jumps, 2);
  assert.equal(m.last.distance, first);
  assert.equal(m.best.distance, first);
  // O teleporte levou 30 u (abaixo do limiar de 64 u por tick) e pôs no chão: não vira pouso nem voo.
  m.update(st(45, 0, 0, true), []);
  assert.equal(m.air, null);
  assert.equal(m.last.distance, first);
  m.update(st(46, 0, 0, false), []); // sai de uma beirada depois: voo novo normal
  assert.equal(m.air.kind, AIR_KIND.FALL);
});

test('série de bhop: pulos com até 1 tick no chão entre eles; 2 ticks fecham a série', () => {
  const m = new JumpMeter();
  let x = 0;
  const hop = (groundTicks) => {
    for (let g = 0; g < groundTicks; g++) m.update(st(x, 0, 0, true, 280), []);
    x += 5;
    m.update(st(x, 5, 0, false, 280), [{ type: 'jump' }]);
    for (let i = 0; i < 3; i++) {
      x += 5;
      m.update(st(x, 10, 0, false, 284), []);
    }
    x += 5;
    m.update(st(x, 0, 0, true, 286), [{ type: 'land', speed: 200 }]);
  };
  m.update(st(0, 0, 0, true), []);
  hop(0);
  hop(0);
  hop(0);
  assert.equal(m.series.jumps, 3);
  const shown = m.shownSeries;
  assert.equal(shown.running, true);
  near(shown.distance, 75, 1e-9, 'distância da série (3 pulos de 25 u)');
  assert.equal(shown.maxSpeed, 286);
  hop(1); // 2 ticks no chão (o do pouso e mais um): série nova
  assert.equal(m.series.jumps, 1);
  assert.equal(m.lastSeries.jumps, 3);
  near(m.lastSeries.time, (3 * 5 + 2) * DT, 1e-12, 'tempo: 5 ticks no ar por pulo + 1 no chão entre eles');
  near(m.lastSeries.avgSpeed, 75 / m.lastSeries.time, 1e-9, 'média');
  assert.equal(m.best.series, 3);
});

/** Um tick do jogador do jogo com o medidor alimentado depois (como o matchState faz). */
function stepper(p, m) {
  return (drive) => {
    run(p, 1, drive);
    m.update(p.state, p.env.events);
  };
}

test('simulado: pulo parado sobe 57 u e fica 48 ticks no ar; correndo cobre ~188 u; pouso a 285,5 u/s', () => {
  const ground = worldOf((b) => floor(b));
  const p = makePlayer(ground, [0, 0, 0]);
  const m = new JumpMeter();
  const step = stepper(p, m);
  for (let i = 0; i < 4; i++) step(idle);
  step((c) => {
    idle(c);
    c.buttons = BTN.JUMP;
  });
  for (let i = 0; i < 60; i++) step(idle);
  assert.equal(m.last.kind, AIR_KIND.JUMP);
  near(m.last.apex, 57, 0.01, 'ápice');
  assert.equal(Math.round(m.last.time / DT), 48, 'ticks no ar');
  near(m.last.landSpeed, 285.506623, 1e-5, 'pouso');
  near(m.last.distance, 0, 1e-9, 'parado');
  // Correndo a 250 u/s (faca): a mesma parábola levada a 250 u/s.
  const q = makePlayer(ground, [0, 0, 0]);
  const mq = new JumpMeter();
  const stepQ = stepper(q, mq);
  for (let i = 0; i < 60; i++) stepQ(forward);
  stepQ((c) => {
    forward(c);
    c.buttons = BTN.JUMP;
  });
  for (let i = 0; i < 60; i++) stepQ(forward);
  assert.ok(mq.last.distance > 180 && mq.last.distance < 195, `distância correndo ${mq.last.distance}`);
});

test('simulado: série de bhop perfeita (pulo no tick seguinte ao pouso) com teto de 286 u/s', () => {
  const ground = worldOf((b) => floor(b));
  const p = makePlayer(ground, [0, 0, 0]);
  const m = new JumpMeter();
  p.state.velocity.set(250, 0, 0);
  p.cmd.yaw = -Math.PI / 2; // olhando para +X
  let landed = true;
  for (let i = 0; i < 400; i++) {
    run(p, 1, (c) => {
      forward(c);
      c.buttons = landed ? BTN.JUMP : 0;
    });
    landed = p.env.events.some((e) => e.type === 'land');
    m.update(p.state, p.env.events);
    if (m.series?.jumps === 6 && landed) break;
  }
  const s = m.shownSeries;
  assert.equal(s.jumps, 6);
  assert.ok(s.maxSpeed <= MOVE.bunnyJumpFactor * MOVE.runSpeed + 1e-6, `máxima ${s.maxSpeed}`);
  assert.ok(s.avgSpeed > 200 && s.avgSpeed <= s.maxSpeed, `média ${s.avgSpeed}`);
  assert.ok(s.distance > 5 * 150, `distância ${s.distance}`);
});

test('simulado: queda de 900 u de uma plataforma — queda 900, pouso a ~1200 u/s', () => {
  const world = worldOf((b) => {
    floor(b);
    b.box(200, 20, 200, { center: [0, 890, 0] });
  });
  const p = makePlayer(world, [0, 900, 0]);
  p.cmd.yaw = -Math.PI / 2;
  const m = new JumpMeter();
  for (let i = 0; i < 200 && !(m.last && m.last.kind === AIR_KIND.FALL); i++) {
    run(p, 1, (c) => forward(c));
    m.update(p.state, p.env.events);
  }
  assert.equal(m.last.kind, AIR_KIND.FALL);
  near(m.last.drop, 900, 0.1, 'queda');
  near(m.last.landSpeed, Math.sqrt(2 * 800 * 900), 15, 'velocidade de pouso');
  assert.equal(m.best.drop, m.last.drop);
});
```


- [ ] **Passo 2: Rodar e ver falhar**

Run: `node --test tests/jumpMeter.test.js`
Expected: FAIL — `Cannot find module` de `src/debug/jumpMeter.js`.


- [ ] **Passo 3: Implementar**

```js file=src/debug/jumpMeter.js
// Medidor de salto e queda (subfase 3.3), para a pista de testes e o cl_showpos. Por voo — pulo ou queda de uma beirada
// —: distância no plano da saída ao pouso, ápice acima da saída, tempo no ar, queda (ápice − pouso) e velocidade de
// pouso (a do evento `land` do movimento). Por série de bhop — pulos com até 1 tick no chão entre eles —: número de
// pulos, distância total, velocidade média (distância ÷ tempo da série) e máxima no plano. Teleporte (mais que 64 u num
// tick) e noclip descartam o voo e a série; o matchState também chama `interrupt()` em todo teleporte (estacao, setpos,
// respawn), perto ou longe. Puro: o matchState chama `update(estado, eventos)` a cada tick, como o medidor de
// counter-strafe, e o cl_showpos lê `air`, `last`, `shownSeries` e `best`.

export const AIR_KIND = Object.freeze({ JUMP: 'pulo', FALL: 'queda' });

const TELEPORT = 64; // u num tick (3500 u/s é o teto por eixo: 54,7 u por tick)
const BHOP_GROUND = 1; // ticks no chão entre dois pulos da mesma série

export class JumpMeter {
  /** @param {number} dt duração do tick (s). */
  constructor(dt = 1 / 64) {
    this.dt = dt;
    this.reset();
  }

  /** Zera tudo (cl_salto_reset). */
  reset() {
    this.air = null; // voo em andamento: { kind, x, y, z, apex, ticks, maxSpeed }
    this.last = null; // último voo: { kind, distance, apex, time, drop, landSpeed, maxSpeed }
    this.series = null; // série de bhop em andamento: { jumps, distance, ticks, maxSpeed }
    this.lastSeries = null; // última série terminada com 2 ou mais pulos
    this.best = { distance: 0, drop: 0, series: 0 }; // recordes desde o reset
    this.prev = null; // pés e chão no fim do tick anterior
    this.ground = 0; // ticks seguidos terminados no chão
  }

  /** Teleporte: descarta o voo em andamento e fecha a série (os recordes e o último voo ficam). */
  interrupt() {
    this.air = null;
    this.#endSeries();
    this.prev = null;
    this.ground = 0;
  }

  /**
   * Um tick. `s`: estado de movimento depois do playerMove (origin, velocity, onGround, moveType); `events`: eventos do
   * tick (usa 'jump' e 'land').
   */
  update(s, events) {
    const o = s.origin;
    const prev = this.prev;
    if (s.moveType === 'noclip' || (prev && Math.hypot(o.x - prev.x, o.y - prev.y, o.z - prev.z) > TELEPORT)) {
      this.air = null;
      this.#endSeries();
      this.#remember(s);
      return this;
    }
    let jumped = false;
    let land = null;
    for (const e of events) {
      if (e.type === 'jump') jumped = true;
      else if (e.type === 'land') land = e;
    }
    const speed = Math.hypot(s.velocity.x, s.velocity.z);
    if (!this.air && (jumped || (!s.onGround && prev?.onGround))) {
      const from = prev ?? o;
      if (jumped) {
        if (!this.series || this.ground > BHOP_GROUND) {
          this.#endSeries();
          this.series = { jumps: 0, distance: 0, ticks: 0, maxSpeed: 0 };
        } else this.series.ticks += this.ground;
        this.series.jumps++;
      } else this.#endSeries();
      this.air = { kind: jumped ? AIR_KIND.JUMP : AIR_KIND.FALL, x: from.x, y: from.y, z: from.z, apex: from.y, ticks: 0, maxSpeed: 0 };
    }
    if (this.air) {
      const a = this.air;
      a.ticks++;
      a.apex = Math.max(a.apex, o.y);
      a.maxSpeed = Math.max(a.maxSpeed, speed);
      if (a.kind === AIR_KIND.JUMP && this.series) this.series.maxSpeed = Math.max(this.series.maxSpeed, speed);
      if (s.onGround) this.#land(s, land);
    }
    if (s.onGround) {
      this.ground++;
      if (this.series && this.ground > BHOP_GROUND) this.#endSeries();
    } else this.ground = 0;
    this.#remember(s);
    return this;
  }

  #land(s, land) {
    const a = this.air;
    const o = s.origin;
    const distance = Math.hypot(o.x - a.x, o.z - a.z);
    this.last = {
      kind: a.kind, distance, apex: a.apex - a.y, time: a.ticks * this.dt, drop: a.apex - o.y,
      landSpeed: land ? land.speed : 0, maxSpeed: a.maxSpeed,
    };
    this.best.distance = Math.max(this.best.distance, distance);
    this.best.drop = Math.max(this.best.drop, this.last.drop);
    if (a.kind === AIR_KIND.JUMP && this.series) {
      this.series.distance += distance;
      this.series.ticks += a.ticks;
    }
    this.air = null;
  }

  /** Fecha a série em andamento; com 2 ou mais pulos ela vira a última série. */
  #endSeries() {
    const sr = this.series;
    this.series = null;
    if (!sr || sr.jumps < 2) return;
    this.lastSeries = { ...sr, time: sr.ticks * this.dt, avgSpeed: sr.ticks ? sr.distance / (sr.ticks * this.dt) : 0 };
    this.best.series = Math.max(this.best.series, sr.jumps);
  }

  #remember(s) {
    const o = s.origin;
    if (!this.prev) this.prev = { x: 0, y: 0, z: 0, onGround: false };
    this.prev.x = o.x;
    this.prev.y = o.y;
    this.prev.z = o.z;
    this.prev.onGround = s.onGround;
  }

  /** Série para mostrar: a em andamento (com velocidade média até agora) ou a última terminada. */
  get shownSeries() {
    const sr = this.series;
    if (sr && sr.jumps >= 2) {
      const ticks = sr.ticks + (this.air ? this.air.ticks : 0);
      return { ...sr, running: true, time: ticks * this.dt, avgSpeed: sr.ticks ? sr.distance / (sr.ticks * this.dt) : 0 };
    }
    return this.lastSeries ? { ...this.lastSeries, running: false } : null;
  }
}
```


- [ ] **Passo 4: Rodar e ver passar**

Run: `node --test tests/jumpMeter.test.js`
Expected: PASS (7 testes).


- [ ] **Passo 5: Suíte inteira**

Run: `npm test`
Expected: 199 testes passando.


- [ ] **Commit (só quando o usuário pedir)**

```bash
git add src/debug/jumpMeter.js tests/jumpMeter.test.js
git commit -m "feat(fase-3.3): medidor de salto e queda" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```


---

### Tarefa 3: Geometrias novas do set e os lotes (BatchedMesh)

**Files:**
- Create: `src/clay/set/bookGeometry.js`, `src/clay/set/stationeryGeometry.js`, `src/maps/pista/visual/batch.js`
- Modify: `src/clay/set/boardGeometry.js` (arquivo inteiro), `src/clay/set/propGeometry.js`
- Test: `tests/pistaGeometry.test.js`

Cada peça cabe na caixa de colisão que a representa (a pista prova números: o desenho não pode enganar) e nenhum triângulo fica virado contra a própria normal. O `BatchBuilder` junta as peças de um material num `BatchedMesh`: o three exige o mesmo conjunto de atributos em todas as geometrias do lote, então o construtor completa os faltantes com o padrão do lote.

- [ ] **Passo 1: Escrever o teste**

```js file=tests/pistaGeometry.test.js
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
```


- [ ] **Passo 2: Rodar e ver falhar**

Run: `node --test tests/pistaGeometry.test.js`
Expected: FAIL — `Cannot find module` de `src/clay/set/bookGeometry.js`.


- [ ] **Passo 3: Livro** — capa dura em "C" (duas pastas e lombada arredondada com o vinco da dobradiça, maior que o miolo), miolo com a boca côncava; brochura rente ao miolo. Atributos para o material: parte, uv em u, dimensões e a célula da lombada no atlas.

```js file=src/clay/set/bookGeometry.js
// Livro deitado (pista de testes: degraus das escadas, espiral da torre, caderninhos dos apoios do slide; BAS1, BAS4,
// BAS7, BAS9, BAS11, BAS15 no item 11 do moodboard). Quadro canônico: tamanho [comprimento (X), espessura (Y),
// profundidade (Z)], centrado na origem, lombada em +Z e boca (corte da frente) em −Z.
//  - Capa dura: capa inteiriça em "C" (duas pastas + lombada arredondada, com o vinco da dobradiça), maior que o miolo
//    (a "esquadria" de 1–3 u na cabeça, no pé e na boca); o miolo tem a boca levemente côncava (lombada arredondada).
//  - Brochura (caderninho): capa fina rente ao miolo, lombada quase reta.
// Atributos para o bookMaterial.js (todos os livros de um mapa num lote só, então todos com o mesmo conjunto):
//   aBookPart  0 = pano da capa · 1 = guarda (papel de dentro da capa) · 2 = borda das folhas · 3 = lombada
//   aBookUv    posição em u na parte (capa: x a partir do pé, z a partir da boca; lombada: x, arco a partir da
//              dobradiça de cima; folhas: ao longo, através da espessura; bordas das pastas e tampas: 0 = gasto máximo)
//   aBookDims  (comprimento, profundidade, arco da lombada) — o shader mede o gasto e mapeia o título; nas bordas
//              das folhas o terceiro valor é a espessura do miolo
//   aSpineRect célula do texto da lombada no atlas do mapa (u0, v0, largura, altura; zeros = sem texto)

import * as THREE from 'three';
import { RNG } from '../../core/rng.js';

/** Pontos do arco que passa pelas duas dobradiças (y = ±h, z = zh) e pelo ponto mais saliente (zs, 0), de cima para baixo. */
function arcPoints(zc, R, h, segments, sign) {
  const half = Math.asin(Math.min(1, h / R));
  const pts = [];
  for (let i = 0; i <= segments; i++) {
    const a = half - (2 * half * i) / segments;
    pts.push({ z: zc + Math.cos(a) * R, y: Math.sin(a) * R, n: [0, Math.sin(a) * sign, Math.cos(a) * sign] });
  }
  return { pts, half };
}

/** Quanto a lombada sai da dobradiça (capa dura arredondada, brochura quase reta). */
function spineBulge(T, hard) {
  return hard ? T * 0.28 : Math.max(0.15, T * 0.05);
}

/** Comprimento do arco da lombada de um livro de espessura T (o atlas das lombadas usa para não esticar o texto). */
export function spineArcLength(T, hard = true) {
  const j = spineBulge(T, hard);
  const h = T / 2;
  const R = (j * j + h * h) / (2 * j);
  return 2 * Math.asin(Math.min(1, h / R)) * R;
}

/**
 * @param {[number, number, number]} size [comprimento, espessura, profundidade] em u
 * @param {{hard?:boolean, spineRect?:number[], seed?:string}} [opts] `hard` = capa dura (padrão) ou brochura
 */
export function bookGeometry([L, T, D], { hard = true, spineRect = [0, 0, 0, 0], seed = 'livro' } = {}) {
  const rng = new RNG(`livro:${seed}`);
  const c = hard ? THREE.MathUtils.clamp(T * 0.12, 0.9, 2.4) : Math.min(0.45, T * 0.06);
  const sq = hard ? THREE.MathUtils.clamp(Math.min(L, D) * 0.012, 1.2, 3) : 0;
  const j = spineBulge(T, hard);
  const h = T / 2;
  const hl = L / 2;
  const zs = D / 2;
  const zh = zs - j;
  const R = (j * j + h * h) / (2 * j);
  const zc = zs - R;
  const arcSegs = hard ? 8 : 4;
  const outerArc = arcPoints(zc, R, h, arcSegs, 1);
  const arcLen = 2 * outerArc.half * R;
  const dims = [L, D, arcLen];

  const pos = [];
  const nrm = [];
  const part = [];
  const buv = [];
  const bdims = [];
  const rect = [];
  const index = [];
  const push = (x, y, z, n, p, u, v) => {
    pos.push(x, y, z);
    nrm.push(n[0], n[1], n[2]);
    part.push(p);
    buv.push(u, v);
    bdims.push(dims[0], dims[1], dims[2]);
    rect.push(spineRect[0], spineRect[1], spineRect[2], spineRect[3]);
    return pos.length / 3 - 1;
  };
  /**
   * Faixa ao longo de X (de −x a +x) entre dois pontos do perfil em YZ, cada um com a sua normal; o sentido dos
   * triângulos sai da normal pedida. `u` em cada ponta = coordenada da parte ao longo do perfil.
   */
  const strip = (a, b, x, p, uA, uB) => {
    const v0 = push(-x, a.y, a.z, a.n, p, hl - x, uA);
    const v1 = push(x, a.y, a.z, a.n, p, hl + x, uA);
    const v2 = push(-x, b.y, b.z, b.n, p, hl - x, uB);
    const v3 = push(x, b.y, b.z, b.n, p, hl + x, uB);
    // Triângulo (v0, v2, v1) tem normal ∝ (0, Δz, −Δy).
    const dy = b.y - a.y;
    const dz = b.z - a.z;
    const out = (a.n[1] + b.n[1]) * dz - (a.n[2] + b.n[2]) * dy;
    if (out > 0) index.push(v0, v2, v1, v1, v2, v3);
    else index.push(v0, v1, v2, v1, v3, v2);
  };
  /** Normal plana de um trecho do perfil, virada para o lado de `sign` em Y (pastas) ou pedida. */
  const flat = (a, b, want) => {
    const dy = b.y - a.y;
    const dz = b.z - a.z;
    const l = Math.hypot(dy, dz);
    let n = [0, dz / l, -dy / l];
    if (n[1] * want[1] + n[2] * want[2] < 0) n = [0, -n[1], -n[2]];
    return n;
  };
  const polyline = (pts, p, want, uOf) => {
    for (let i = 0; i + 1 < pts.length; i++) {
      const n = flat(pts[i], pts[i + 1], want);
      strip({ ...pts[i], n }, { ...pts[i + 1], n }, hl, p, uOf(pts[i]), uOf(pts[i + 1]));
    }
  };

  // Pastas de fora: da boca até a dobradiça, com o vinco (duas rampas rasas) perto da lombada.
  const board = (y) => {
    const pts = [{ z: -zs, y }];
    if (hard) {
      const gz = zh - Math.max(2.4, T * 0.18);
      const gw = Math.min(1.4, T * 0.08);
      const gd = Math.min(0.45, c * 0.3);
      pts.push({ z: gz - gw, y }, { z: gz, y: y - Math.sign(y) * gd }, { z: gz + gw, y });
    }
    pts.push({ z: zh, y });
    return pts;
  };
  const fromFore = (pt) => pt.z + zs;
  polyline(board(h), 0, [0, 1, 0], fromFore);
  polyline(board(-h), 0, [0, -1, 0], fromFore);
  // Lombada: normais do arco (sombreado liso), uv = arco a partir da dobradiça de cima.
  for (let i = 0; i < arcSegs; i++) {
    strip(outerArc.pts[i], outerArc.pts[i + 1], hl, 3, (arcLen * i) / arcSegs, (arcLen * (i + 1)) / arcSegs);
  }

  // Guarda (papel de dentro), a espessura da pasta para dentro; só aparece na fresta entre a capa e o miolo.
  const hi = h - c;
  const Ri = R - c;
  const innerHinge = zc + Math.sqrt(Math.max(Ri * Ri - hi * hi, 0));
  const innerArc = arcPoints(zc, Ri, hi, arcSegs, -1);
  polyline([{ z: -zs, y: hi }, { z: innerHinge, y: hi }], 1, [0, -1, 0], () => 0);
  polyline([{ z: -zs, y: -hi }, { z: innerHinge, y: -hi }], 1, [0, 1, 0], () => 0);
  for (let i = 0; i < arcSegs; i++) strip(innerArc.pts[i], innerArc.pts[i + 1], hl, 1, 0, 0);

  // Bordas das pastas na boca (pano dobrado por cima do papelão: gasto máximo).
  polyline([{ z: -zs, y: h }, { z: -zs, y: hi }], 0, [0, 0, -1], () => 0);
  polyline([{ z: -zs, y: -hi }, { z: -zs, y: -h }], 0, [0, 0, -1], () => 0);

  // Tampas na cabeça e no pé: o "C" da capa triangulado, normal ±X, gasto máximo (é a quina que roça em tudo).
  const ring = [
    ...board(h),
    ...outerArc.pts.slice(1, -1),
    ...board(-h).reverse(),
    { z: -zs, y: -hi },
    { z: innerHinge, y: -hi },
    ...innerArc.pts.slice(1, -1).reverse(),
    { z: innerHinge, y: hi },
    { z: -zs, y: hi },
  ];
  const cap = (poly2, x, p, uvOf) => {
    const tris = THREE.ShapeUtils.triangulateShape(poly2.slice(), []);
    for (const side of [1, -1]) {
      const base = pos.length / 3;
      for (const q of poly2) {
        const [u, v] = uvOf(q);
        push(side * x, q.y, q.x, [side, 0, 0], p, u, v);
      }
      for (const [a, b, cc] of tris) {
        const pa = poly2[a];
        // Em (z, y): z → x do Vector2. A normal em X do triângulo é −(produto vetorial 2D).
        const cross = (poly2[b].x - pa.x) * (poly2[cc].y - pa.y) - (poly2[b].y - pa.y) * (poly2[cc].x - pa.x);
        if ((cross > 0) === (side < 0)) index.push(base + a, base + b, base + cc);
        else index.push(base + a, base + cc, base + b);
      }
    }
  };
  cap(ring.map((q) => new THREE.Vector2(q.z, q.y)), hl, 0, () => [0, 0]);

  // Miolo: cabeça, pé e boca à mostra; na capa dura a boca é côncava (a lombada arredondada empurra as folhas).
  const tp = T - 2 * c;
  const hp = tp / 2 - 0.02;
  const xs = hl - sq;
  const zb = -zs + sq;
  const zBack = innerHinge + 0.2;
  const cup = hard ? Math.min(1.6, tp * 0.12) * rng.float(0.8, 1.2) : 0;
  dims[2] = 2 * hp;
  const rows = hard ? 6 : 2;
  const fore = [];
  for (let r = 0; r <= rows; r++) {
    const y = -hp + (2 * hp * r) / rows;
    const t = y / hp;
    // Normal da boca côncava: z = zb + cup·(1 − t²) → dz/dy = −2·cup·t/hp → n ∝ (0, dz/dy, −1).
    const dz = (-2 * cup * t) / hp;
    const l = Math.hypot(dz, 1);
    fore.push({ y, z: zb + cup * (1 - t * t), n: [0, dz / l, -1 / l] });
  }
  for (let r = 0; r < rows; r++) strip(fore[r], fore[r + 1], xs, 2, fore[r].y + hp, fore[r + 1].y + hp);
  const block = [...fore.map((q) => new THREE.Vector2(q.z, q.y)), new THREE.Vector2(zBack, hp), new THREE.Vector2(zBack, -hp)];
  cap(block, xs, 2, (q) => [q.x - zb, q.y + hp]);

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  geo.setAttribute('aBookPart', new THREE.Float32BufferAttribute(part, 1));
  geo.setAttribute('aBookUv', new THREE.Float32BufferAttribute(buv, 2));
  geo.setAttribute('aBookDims', new THREE.Float32BufferAttribute(bdims, 3));
  geo.setAttribute('aSpineRect', new THREE.Float32BufferAttribute(rect, 4));
  geo.setIndex(index);
  geo.computeBoundingSphere();
  return geo;
}
```


- [ ] **Passo 4: Papelaria** — lápis sextavado apontado (corpo pintado, madeira, grafite, ponteira e borracha em partes separadas por material), régua de madeira com bisel, régua de aço, lâmina e gancho da trena, estojo da trena, espeto, alfinete e bandeirinha.

```js file=src/clay/set/stationeryGeometry.js
// Papelaria e ferramentas de medir do set (pista de testes; PRU1, PRU3, PRU15, TMA2, TMA6, TMA12, BWM10, CFO19 no
// item 11 do moodboard), na medida de verdade (1 u = 1 mm): lápis sextavado apontado, régua escolar com bisel, régua
// de aço, lâmina e gancho da trena, estojo da trena, espeto de bambu, alfinete de cabeça e bandeirinha de papel.
// Cada função devolve as geometrias por família de material — o mapa junta cada família num lote:
//   paint  → paintMaterials.paintMaterial (aPaint: 0 laca, 1 grafite, 2 borracha, 3 plástico brilhante)
//   measure→ measureMaterials.measureMaterial (uv em u; aMeasure = modo, comprimento, largura, espessura)
//   wood   → balsa tingida (veio ao longo do X local) · metal → cromado tingido · shell → plástico do estojo
// Convenção: objetos compridos ao longo de +X, centrados; o mapa gira para o eixo da peça.

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RNG } from '../../core/rng.js';

const TAU = Math.PI * 2;

/** Atributo constante em todos os vértices. */
function constant(geo, name, values) {
  const n = geo.attributes.position.count;
  const arr = new Float32Array(n * values.length);
  for (let i = 0; i < n; i++) arr.set(values, i * values.length);
  geo.setAttribute(name, new THREE.BufferAttribute(arr, values.length));
  return geo;
}

/** Sólido de revolução em volta de X a partir de [x, raio], com as normais do perfil. */
function latheX(profile, segments = 24) {
  const geo = new THREE.LatheGeometry(profile.map(([x, r]) => new THREE.Vector2(Math.max(r, 1e-4), x)), segments);
  geo.rotateZ(-Math.PI / 2);
  geo.deleteAttribute('uv');
  return geo;
}

/** Junta partes (todas com ou todas sem índice viram indexadas) sem uv. */
function join(parts) {
  const clean = parts.map((g) => {
    if (g.attributes.uv) g.deleteAttribute('uv');
    if (!g.index) {
      const idx = Array.from({ length: g.attributes.position.count }, (_, i) => i);
      g.setIndex(idx);
    }
    return g;
  });
  const geo = mergeGeometries(clean, false);
  for (const g of clean) g.dispose();
  return geo;
}

/**
 * Lápis preto sextavado (Ø7 entre faces, 175 u) ao longo de +X com a ponta em +X: corpo laqueado (face plana
 * embaixo), madeira do apontado com as "conchinhas" onde o cone corta as faces, grafite, virola de alumínio com os
 * frisos e borracha rosa gasta. A borracha sai à parte (é outra peça no lote de tinta, com a cor dela).
 * @returns {{paint:THREE.BufferGeometry, eraser:THREE.BufferGeometry, wood:THREE.BufferGeometry, metal:THREE.BufferGeometry}}
 */
export function pencilGeometry({ length = 175, across = 7, sharpen = 26, lead = 2.2, ferrule = 12, eraser = 8, seed = 'lapis' } = {}) {
  const rng = new RNG(`lapis:${seed}`);
  const x0 = -length / 2;
  const x1 = length / 2;
  const ap = across / 2;
  const round = ap * 1.1; // quinas levemente arredondadas (o sextavado de verdade tem o canto quebrado)
  const cols = 48;
  // Raio do sextavado no ângulo a (faces com normal em 0°, 60°, ...; a de 180° fica embaixo: y = r·cos a).
  const hexR = (a) => {
    const d = ((((a + Math.PI / 6) % (Math.PI / 3)) + Math.PI / 3) % (Math.PI / 3)) - Math.PI / 6;
    return Math.min(ap / Math.cos(d), round);
  };
  const hexN = (a) => {
    const d = ((((a + Math.PI / 6) % (Math.PI / 3)) + Math.PI / 3) % (Math.PI / 3)) - Math.PI / 6;
    return ap / Math.cos(d) < round ? a - d : a;
  };
  const xCone = x1 - sharpen;
  const slope = round / (sharpen + 0.9); // o cone termina num ponto rombudo (0,9 u além da ponta)
  const coneR = (x) => Math.max((x1 + 0.9 - x) * slope, 0);
  const xLead = x1 + 0.9 - lead / 2 / slope;
  const xBody0 = x0 + eraser + ferrule - 1.5;
  const pos = { paint: [], wood: [] };
  const nrm = { paint: [], wood: [] };
  const idx = { paint: [], wood: [] };
  const paintKind = { paint: [], wood: [] };
  // Grade (colunas em volta × linhas ao longo) de um trecho; `radius(x, a)` e `normal(x, a)`.
  const grid = (key, rows, radius, normal, kind = 0) => {
    const base = pos[key].length / 3;
    for (let r = 0; r < rows.length; r++) {
      for (let c = 0; c <= cols; c++) {
        const a = (c / cols) * TAU;
        const x = rows[r](a);
        const rr = radius(x, a);
        const n = normal(x, a);
        pos[key].push(x, Math.cos(a) * rr, Math.sin(a) * rr);
        nrm[key].push(n[0], n[1], n[2]);
        paintKind[key].push(kind);
      }
    }
    for (let r = 0; r + 1 < rows.length; r++) {
      for (let c = 0; c < cols; c++) {
        const a = base + r * (cols + 1) + c;
        const b = a + 1;
        const cc = a + cols + 2;
        const d = a + cols + 1;
        idx[key].push(a, b, cc, a, cc, d);
      }
    }
  };
  // Corpo laqueado: do fim da virola até a borda da madeira (que avança nas faces e recua nas quinas).
  const boundary = (a) => xCone + (round - hexR(a)) / slope;
  grid('paint', [() => xBody0, boundary], (x, a) => hexR(a), (x, a) => {
    const na = hexN(a);
    return [0, Math.cos(na), Math.sin(na)];
  });
  // Cone de madeira e grafite: raio do cone; normal com a componente ao longo do eixo.
  const coneNormal = (x, a) => {
    const l = Math.hypot(1, slope);
    return [slope / l, Math.cos(a) / l, Math.sin(a) / l];
  };
  const woodRows = [boundary];
  for (let k = 1; k <= 4; k++) woodRows.push((a) => boundary(a) + ((xLead - boundary(a)) * k) / 4);
  grid('wood', woodRows, (x) => coneR(x), coneNormal);
  const leadRows = [];
  for (let k = 0; k <= 4; k++) leadRows.push(() => xLead + ((x1 - 0.35 - xLead) * k) / 4);
  grid('paint', leadRows, (x) => coneR(x), coneNormal, 1);
  // Ponta rombuda do grafite.
  const turns = 24; // peças de revolução pequenas: 24 lados bastam
  const tip = latheX([[x1 - 0.35, coneR(x1 - 0.35)], [x1 - 0.12, 0.2], [x1, 0]], turns);
  // Virola: frisos apertados e duas cintas de crimpagem; borracha com a ponta gasta (achatada e torta).
  const fx0 = x0 + eraser - 2;
  const fr = ap * 1.04;
  const ferruleProfile = [[fx0, 0], [fx0, fr - 0.3], [fx0 + 0.4, fr]];
  for (let k = 0; k < 5; k++) {
    const xx = fx0 + 1.5 + k * 1.1;
    ferruleProfile.push([xx, fr], [xx + 0.35, fr + 0.18], [xx + 0.7, fr]);
  }
  ferruleProfile.push([fx0 + ferrule - 3, fr], [fx0 + ferrule - 2.4, fr - 0.28], [fx0 + ferrule - 1.8, fr], [fx0 + ferrule, fr - 0.1], [fx0 + ferrule + 0.2, ap * 0.9]);
  const metal = latheX(ferruleProfile, turns);
  const er = ap * 0.92;
  const wear = rng.float(0.8, 1.6);
  const eraserGeo = latheX([[x0 + wear * 0.25, 0], [x0 + 0.2 + wear * 0.2, er * 0.45], [x0 + 0.9, er * 0.86], [x0 + 2.2, er], [x0 + eraser, er]], turns);
  eraserGeo.applyMatrix4(new THREE.Matrix4().makeShear(0, 0, 0, 0, rng.float(-0.04, 0.04), 0));
  const build = (key) => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos[key], 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm[key], 3));
    g.setAttribute('aPaint', new THREE.Float32BufferAttribute(paintKind[key], 1));
    g.setIndex(idx[key]);
    return g;
  };
  constant(tip, 'aPaint', [1]);
  constant(eraserGeo, 'aPaint', [2]);
  const paint = join([build('paint'), tip]);
  const eraserPart = join([eraserGeo]);
  const wood = build('wood');
  wood.deleteAttribute('aPaint');
  return { paint, eraser: eraserPart, wood, metal };
}

/**
 * Régua escolar de madeira ao longo de +X (comprimento × espessura × largura), com o bisel da escala na borda +Z.
 * uv = (ao longo a partir da ponta −X, através a partir da borda do bisel) em u; aMeasure = (0, comprimento, largura,
 * espessura).
 */
export function rulerGeometry(length, thickness, width, { bevel = 7, edge = 1.1 } = {}) {
  const hz = width / 2;
  const top = thickness / 2;
  const bottom = -thickness / 2;
  // Perfil em (z, y) no sentido anti-horário visto de +X: fundo, borda do bisel, bisel, topo, costas.
  const prof = [
    { z: -hz, y: bottom }, { z: hz, y: bottom }, { z: hz, y: bottom + edge }, { z: hz - bevel, y: top }, { z: -hz, y: top },
  ];
  const pos = [];
  const nrm = [];
  const uv = [];
  const index = [];
  const hl = length / 2;
  // Coordenada "através" medida da borda do bisel pela superfície de cima (bisel + topo).
  const bevelLen = Math.hypot(bevel, top - bottom - edge);
  const across = (p) => {
    if (p.y <= bottom + edge && p.z >= hz - 1e-6) return 0;
    if (Math.abs(p.y - top) < 1e-6) return bevelLen + (hz - bevel - p.z);
    return 0;
  };
  for (let i = 0; i < prof.length; i++) {
    const a = prof[i];
    const b = prof[(i + 1) % prof.length];
    const dy = b.y - a.y;
    const dz = b.z - a.z;
    const l = Math.hypot(dy, dz);
    const n = [0, -dz / l, dy / l]; // perfil anti-horário em (z, y): a normal para fora fica à direita
    const base = pos.length / 3;
    for (const p of [a, b]) {
      for (const x of [-hl, hl]) {
        pos.push(x, p.y, p.z);
        nrm.push(n[0], n[1], n[2]);
        uv.push(x + hl, across(p));
      }
    }
    index.push(base, base + 1, base + 2, base + 1, base + 3, base + 2);
  }
  const ring = prof.map((p) => new THREE.Vector2(p.z, p.y));
  const tris = THREE.ShapeUtils.triangulateShape(ring.slice(), []);
  for (const side of [1, -1]) {
    const base = pos.length / 3;
    for (const p of prof) {
      pos.push(side * hl, p.y, p.z);
      nrm.push(side, 0, 0);
      uv.push(side > 0 ? length : 0, across(p));
    }
    for (const [a, b, c] of tris) {
      const pa = ring[a];
      const cross = (ring[b].x - pa.x) * (ring[c].y - pa.y) - (ring[b].y - pa.y) * (ring[c].x - pa.x);
      if ((cross > 0) === (side < 0)) index.push(base + a, base + b, base + c);
      else index.push(base + a, base + c, base + b);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(index);
  return constant(geo, 'aMeasure', [0, length, width, thickness]);
}

/** Régua de aço (chapa com os cantos arredondados) ao longo de +X; escala gravada a partir da borda +Z (aMeasure modo 1). */
export function steelRulerGeometry(length, thickness, width, { corner = 1.5 } = {}) {
  const hl = length / 2;
  const hw = width / 2;
  const s = new THREE.Shape();
  s.moveTo(-hl + corner, -hw);
  s.lineTo(hl - corner, -hw);
  s.quadraticCurveTo(hl, -hw, hl, -hw + corner);
  s.lineTo(hl, hw - corner);
  s.quadraticCurveTo(hl, hw, hl - corner, hw);
  s.lineTo(-hl + corner, hw);
  s.quadraticCurveTo(-hl, hw, -hl, hw - corner);
  s.lineTo(-hl, -hw + corner);
  s.quadraticCurveTo(-hl, -hw, -hl + corner, -hw);
  const geo = new THREE.ExtrudeGeometry(s, { depth: thickness, bevelEnabled: false, curveSegments: 4 });
  // Forma no plano XY com a espessura em Z → espessura em Y (Z da forma vira −Y), centrada.
  geo.rotateX(Math.PI / 2);
  geo.translate(0, thickness / 2, 0);
  const p = geo.attributes.position;
  const uv = geo.attributes.uv;
  for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) + hl, hw - p.getZ(i));
  return constant(geo, 'aMeasure', [1, length, width, thickness]);
}

/**
 * Lâmina da trena no plano XY (normal +Z, como a fita crepe deitada), do gancho (x = 0 no zero) até `length`:
 * seção em calha (as bordas levantam `cup`) e o começo erguido pelo gancho apoiado no chão. uv = (ao longo, através
 * a partir da borda −Y); aMeasure = (2, comprimento, largura, 0). Devolve também o gancho (metal) e os rebites.
 */
export function tapeBladeGeometry(length, width, { cup = 1.1, hook = 5, lift = 44, segment = 100 } = {}) {
  const across = 6;
  const along = [0];
  for (let x = 4; x < lift; x += 4) along.push(x);
  for (let x = lift; x < length; x += segment) along.push(x);
  along.push(length);
  const pos = [];
  const uv = [];
  const index = [];
  const hw = width / 2;
  const z = (x, y) => {
    const t = THREE.MathUtils.clamp(1 - x / lift, 0, 1);
    return cup * (y / hw) ** 2 + hook * t * t * (3 - 2 * t);
  };
  for (const x of along) {
    for (let j = 0; j <= across; j++) {
      const y = -hw + (width * j) / across;
      pos.push(x - length / 2, y, z(x, y));
      uv.push(x, y + hw);
    }
  }
  for (let i = 0; i + 1 < along.length; i++) {
    for (let j = 0; j < across; j++) {
      const a = i * (across + 1) + j;
      index.push(a, a + across + 1, a + 1, a + 1, a + across + 1, a + across + 2);
    }
  }
  const blade = new THREE.BufferGeometry();
  blade.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  blade.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  blade.setIndex(index);
  blade.computeVertexNormals();
  constant(blade, 'aMeasure', [2, length, width, 0]);
  // Gancho: chapinha rebitada por cima da lâmina e a aba dobrada para baixo até o chão, na ponta do zero.
  const x0 = -length / 2;
  const plate = new THREE.BoxGeometry(11, width + 1, 0.6).translate(x0 + 5.5, 0, hook + 0.45);
  const tab = new THREE.BoxGeometry(0.8, width + 1, hook + 0.9).translate(x0 - 0.4, 0, (hook + 0.9) / 2 - 0.3);
  const parts = [plate, tab];
  for (const y of [-width * 0.22, width * 0.22]) {
    parts.push(new THREE.SphereGeometry(1.1, 10, 6, 0, TAU, 0, Math.PI / 2).rotateX(Math.PI / 2).translate(x0 + 6.5, y, hook + 0.75));
  }
  return { blade, hook: join(parts) };
}

/**
 * Estojo da trena (tamanho [x, y, z], centrado): casca de plástico amarelo de cantos redondos com a boca da lâmina
 * embaixo na frente (−X), laterais de borracha com o rebaixo redondo, trava em cima, clipe de cinto de aço num lado e
 * parafusos. { shell, rubber (aPaint 2), metal }
 */
export function tapeCaseGeometry([w, h, d]) {
  // A casca é extrudada com chanfro arredondado: o contorno encolhe o tamanho do chanfro para a caixa final caber em
  // [w, h, d]; as laterais de borracha (1,8 u de saliência) entram na profundidade.
  const bevel = 3;
  const bs = bevel * 0.8;
  const hw = w / 2 - bs;
  const hh = h / 2 - bs;
  const r = Math.min(w, h) * 0.2;
  const mouth = 4;
  const shellDepth = d - 3.6;
  const s = new THREE.Shape();
  s.moveTo(-hw + mouth, -hh);
  s.lineTo(hw - r, -hh);
  s.quadraticCurveTo(hw, -hh, hw, -hh + r);
  s.lineTo(hw, hh - r);
  s.quadraticCurveTo(hw, hh, hw - r, hh);
  s.lineTo(-hw + r, hh);
  s.quadraticCurveTo(-hw, hh, -hw, hh - r);
  s.lineTo(-hw, -hh + mouth);
  s.lineTo(-hw + mouth, -hh);
  const shell = new THREE.ExtrudeGeometry(s, {
    depth: shellDepth - 2 * bevel, bevelEnabled: true, bevelThickness: bevel, bevelSize: bs, bevelSegments: 3, curveSegments: 6,
  }).translate(0, 0, -(shellDepth - 2 * bevel) / 2);
  shell.deleteAttribute('uv');
  // Laterais de borracha: placa arredondada levemente saliente com o rebaixo redondo do emblema.
  const side = new THREE.Shape();
  const sr = r * 0.8;
  const sw = hw * 0.78;
  const sh = hh * 0.78;
  side.moveTo(-sw + sr, -sh);
  side.lineTo(sw - sr, -sh);
  side.quadraticCurveTo(sw, -sh, sw, -sh + sr);
  side.lineTo(sw, sh - sr);
  side.quadraticCurveTo(sw, sh, sw - sr, sh);
  side.lineTo(-sw + sr, sh);
  side.quadraticCurveTo(-sw, sh, -sw, sh - sr);
  side.lineTo(-sw, -sh + sr);
  side.quadraticCurveTo(-sw, -sh, -sw + sr, -sh);
  side.holes.push(new THREE.Path().absarc(0, 0, sh * 0.42, 0, TAU, true));
  const rubberParts = [];
  for (const sgn of [1, -1]) {
    const g = new THREE.ExtrudeGeometry(side, { depth: 1.6, bevelEnabled: true, bevelThickness: 0.6, bevelSize: 0.6, bevelSegments: 2, curveSegments: 8 });
    if (sgn < 0) g.rotateY(Math.PI);
    g.translate(0, 0, sgn * (shellDepth / 2 - 0.4));
    rubberParts.push(g);
    const emblem = new THREE.CylinderGeometry(sh * 0.42, sh * 0.42, 0.8, 32).rotateX(Math.PI / 2).translate(0, 0, sgn * (shellDepth / 2 + 0.6));
    rubberParts.push(emblem);
  }
  // Trava: botão de borracha em cima, perto da frente.
  rubberParts.push(new THREE.BoxGeometry(18, 5, 12, 2, 1, 2).translate(-hw * 0.35, h / 2 + 1.5, 0));
  const rubber = constant(join(rubberParts), 'aPaint', [2]);
  // Clipe de cinto: chapa dobrada presa no lado −Z, com dois parafusos.
  const clip = new THREE.BoxGeometry(12, h * 0.72, 1.2).translate(hw * 0.25, -h * 0.06, -d / 2 - 1.4);
  const clipTop = new THREE.BoxGeometry(12, 1.2, 2.6).translate(hw * 0.25, h * 0.3, -d / 2 - 0.5);
  // Parafusos nos cantos da casca, fora da placa de borracha.
  const screws = [];
  for (const [x, y] of [[-hw + 6, -hh + 6], [hw - 6, hh - 6], [-hw + 6, hh - 6]]) {
    screws.push(new THREE.CylinderGeometry(1.6, 1.6, 0.6, 12).rotateX(Math.PI / 2).translate(x, y, shellDepth / 2 + 0.3));
  }
  return { shell, rubber, metal: join([clip, clipTop, ...screws]) };
}

/** Espeto de bambu ao longo de +X (Ø = 2·radius), ponta afiada em +X e a outra ponta cortada com o canto quebrado. */
export function skewerGeometry(length, radius, { point = 14, seed = 'espeto' } = {}) {
  const rng = new RNG(`espeto:${seed}`);
  const x0 = -length / 2;
  const x1 = length / 2;
  const prof = [[x0, 0], [x0, radius * 0.8], [x0 + 0.4, radius]];
  const bend = rng.float(-0.3, 0.3);
  for (let k = 1; k < 8; k++) prof.push([x0 + ((x1 - point - x0) * k) / 8, radius * (1 + bend * 0.01 * Math.sin(k))]);
  prof.push([x1 - point, radius], [x1 - point * 0.35, radius * 0.4], [x1 - 0.2, 0.15], [x1, 0]);
  return latheX(prof, 12);
}

/**
 * Alfinete de cabeça: haste de aço de `length` descendo de y = 0 (a ponta enterrada na madeira) e a bolinha de plástico
 * em cima. { shaft (metal), head (aPaint 3) } com a origem no ponto onde a haste entra na superfície.
 */
export function pinGeometry({ length = 30, buried = 11, head = 3.8 } = {}) {
  const above = length - buried;
  const shaft = new THREE.CylinderGeometry(0.32, 0.32, length - 0.8, 8).translate(0, above - (length - 0.8) / 2, 0);
  const point = new THREE.ConeGeometry(0.32, 0.8, 8).rotateX(Math.PI).translate(0, -buried + 0.4, 0);
  const ball = new THREE.SphereGeometry(head / 2, 16, 12).translate(0, above + head / 2 - 0.4, 0);
  ball.deleteAttribute('uv');
  return { shaft: join([shaft, point]), head: constant(ball, 'aPaint', [3]) };
}

/**
 * Bandeirinha de largada: palito de dente (Ø2, pontas afinadas) em pé a partir de y = 0 e a bandeira de papel colada
 * em volta do palito perto do topo, com uma leve ondulação. A bandeira tem frente e verso (uv 0..1 da célula, verso
 * espelhado). { stick (madeira), paper (uv) }
 */
export function flagGeometry({ stick = 95, width = 42, height = 28, wave = 2.2, seed = 'bandeira' } = {}) {
  const rng = new RNG(`bandeira:${seed}`);
  const stickGeo = latheX([[0, 0], [0.2, 0.35], [2.5, 1], [stick - 2.5, 1], [stick - 0.2, 0.35], [stick, 0]], 10).rotateZ(Math.PI / 2);
  const cols = 12;
  const rows = 4;
  const top = stick - 6;
  const pos = [];
  const uv = [];
  const nrm = [];
  const index = [];
  const phase = rng.float(0, TAU);
  // A folha sai colada no palito e ondula mais para a ponta solta.
  const at = (u, v) => [1.05 + u * width, top - height + v * height, Math.sin(u * 5.2 + phase) * wave * u];
  for (const side of [1, -1]) {
    const base = pos.length / 3;
    for (let r = 0; r <= rows; r++) {
      for (let c = 0; c <= cols; c++) {
        const u = c / cols;
        const v = r / rows;
        const [x, y, zz] = at(u, v);
        const dz = Math.cos(u * 5.2 + phase) * 5.2 * wave * u / width + Math.sin(u * 5.2 + phase) * wave / width;
        const l = Math.hypot(dz, 1);
        pos.push(x, y, zz + side * 0.06);
        nrm.push((-dz / l) * side, 0, (1 / l) * side);
        uv.push(side > 0 ? u : 1 - u, v);
      }
    }
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const a = base + r * (cols + 1) + c;
        if (side > 0) index.push(a, a + 1, a + cols + 2, a, a + cols + 2, a + cols + 1);
        else index.push(a, a + cols + 2, a + 1, a, a + cols + 1, a + cols + 2);
      }
    }
  }
  const paper = new THREE.BufferGeometry();
  paper.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  paper.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  paper.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  paper.setIndex(index);
  return { stick: stickGeo, paper };
}
```


- [ ] **Passo 5: Papelão** — caixa aberta com abas de comprimento escolhido e sem fundo (a cerca), recorte de papelão com furos e bordas cortadas à mão (`cardboardPolygon`: laterais das cunhas, caixa de arquivo com alças, tampa do tubo) e o tubo de papelão enrolado em espiral (`woundTube`, a torre).

```js file=src/clay/set/boardGeometry.js
// Geometria de papelão ondulado cortado à mão (docs/art/moodboard.md: SSD4, SSD8, CSD16).
// Placa no plano XY (espessura em Z), com:
//  - faces subdivididas para o empeno leve (papelão nunca é plano) e bordas de corte com tremor de estilete;
//  - atributos para o shader (paperMaterials.js): aBoard = (x, y, tipo, através), aBoardSize = (w, h) nas
//    faces ou (espessura, comprimento) nos cortes. Flautas correm ao longo de Y (fluteAxis 'y') ou X.
// cardboardBox monta uma caixa aberta com abas a partir de placas; cardboardPolygon recorta uma placa de qualquer
// contorno, com furos (laterais triangulares das cunhas, tetos furados e paredes com respiro do túnel, tampa do tubo).

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RNG } from '../../core/rng.js';
import { createNoise3 } from '../kit/cpuNoise.js';

/**
 * @param {number} width largura (X, u)
 * @param {number} height altura (Y, u)
 * @param {number} [thickness] espessura (Z, u); papelão de caixa ≈ 3–4 mm = 3–4 u
 * @param {{fluteAxis?:'x'|'y', seed?:string|number, step?:number, jitter?:number, warp?:number}} [opts]
 */
export function cardboardPanel(width, height, thickness = 3.5, {
  fluteAxis = 'y',
  seed = 'papelao',
  step = 12,
  jitter = 0.45,
  warp = 1.1,
} = {}) {
  const rng = new RNG(`placa:${seed}`);
  const noise = createNoise3(rng.nextU32());
  const nx = Math.max(2, Math.ceil(width / step));
  const ny = Math.max(2, Math.ceil(height / step));
  const hw = width / 2;
  const hh = height / 2;
  const ht = thickness / 2;
  const phase = rng.float(0, 100);

  // Grade de pontos (x, y) com tremor só na borda (corte à mão) e empeno em Z (mesmo nas duas faces).
  const gx = [];
  const gy = [];
  const gz = [];
  for (let j = 0; j <= ny; j++) {
    for (let i = 0; i <= nx; i++) {
      let x = -hw + (width * i) / nx;
      let y = -hh + (height * j) / ny;
      const border = i === 0 || i === nx || j === 0 || j === ny;
      if (border) {
        const n = noise.noise(x * 0.05 + phase, y * 0.05, 0.5) * jitter + noise.noise(x * 0.3, y * 0.3, 2.1) * jitter * 0.4;
        if (i === 0 || i === nx) x += n;
        if (j === 0 || j === ny) y += n;
      }
      const bend = noise.noise(x * 0.004 + phase, y * 0.004, 7.7) * warp;
      gx.push(x);
      gy.push(y);
      gz.push(bend);
    }
  }
  const idx = (i, j) => j * (nx + 1) + i;

  const pos = [];
  const nrm = [];
  const uv = [];
  const board = [];
  const size = [];
  const index = [];
  const push = (x, y, z, n, u, v, b, s) => {
    pos.push(x, y, z);
    nrm.push(n[0], n[1], n[2]);
    uv.push(u, v);
    board.push(b[0], b[1], b[2], b[3]);
    size.push(s[0], s[1]);
    return pos.length / 3 - 1;
  };
  const faceBoard = (x, y) => (fluteAxis === 'y' ? [x + hw, y + hh, 0, 0] : [y + hh, x + hw, 0, 0]);
  const faceSize = fluteAxis === 'y' ? [width, height] : [height, width];

  // Faces frente (+Z) e verso (−Z). Normais aproximadas (o empeno é suave).
  for (const side of [1, -1]) {
    const base = pos.length / 3;
    for (let j = 0; j <= ny; j++) {
      for (let i = 0; i <= nx; i++) {
        const k = idx(i, j);
        push(gx[k], gy[k], gz[k] + side * ht, [0, 0, side], (gx[k] + hw) / width, (gy[k] + hh) / height,
          faceBoard(gx[k], gy[k]), faceSize);
      }
    }
    for (let j = 0; j < ny; j++) {
      for (let i = 0; i < nx; i++) {
        const a = base + idx(i, j);
        const b = base + idx(i + 1, j);
        const c = base + idx(i + 1, j + 1);
        const d = base + idx(i, j + 1);
        if (side > 0) index.push(a, b, c, a, c, d);
        else index.push(a, c, b, a, d, c);
      }
    }
  }

  // Cortes: faixas ligando frente e verso ao longo de cada borda.
  const edge = (points, outward, kind, lengthTotal) => {
    const base = pos.length / 3;
    let along = 0;
    for (let s = 0; s < points.length; s++) {
      const k = points[s];
      if (s > 0) {
        const p = points[s - 1];
        along += Math.hypot(gx[k] - gx[p], gy[k] - gy[p]);
      }
      const n = [outward[0], outward[1], 0];
      push(gx[k], gy[k], gz[k] - ht, n, along / lengthTotal, 0, [along, 0, kind, 0], [thickness, lengthTotal]);
      push(gx[k], gy[k], gz[k] + ht, n, along / lengthTotal, 1, [along, 0, kind, 1], [thickness, lengthTotal]);
    }
    for (let s = 0; s < points.length - 1; s++) {
      const a = base + s * 2;
      const b = base + s * 2 + 1;
      const c = base + s * 2 + 3;
      const d = base + s * 2 + 2;
      index.push(a, d, c, a, c, b);
    }
  };
  const row = (j) => Array.from({ length: nx + 1 }, (_, i) => idx(i, j));
  const col = (i) => Array.from({ length: ny + 1 }, (_, j) => idx(i, j));
  // Bordas horizontais (ao longo de X): transversais às flautas se elas correm em Y.
  const kindX = fluteAxis === 'y' ? 1 : 2;
  const kindY = fluteAxis === 'y' ? 2 : 1;
  edge(row(0), [0, -1], kindX, width);
  edge(row(ny).reverse(), [0, 1], kindX, width);
  edge(col(nx), [1, 0], kindY, height);
  edge(col(0).reverse(), [-1, 0], kindY, height);

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setAttribute('aBoard', new THREE.Float32BufferAttribute(board, 4));
  geo.setAttribute('aBoardSize', new THREE.Float32BufferAttribute(size, 2));
  geo.setIndex(index);
  // Normais das faces com o empeno (os cortes já têm a normal para fora da borda).
  geo.computeVertexNormals();
  geo.computeBoundingSphere();
  return geo;
}

/**
 * Caixa de papelão aberta em cima, com abas levemente abertas. Origem no centro do fundo. `step` = passo da grade das
 * placas (caixas grandes, como as da cerca da pista, usam um passo maior: o empeno é de baixa frequência).
 * `flaps` = [comprimento das abas das paredes largas (X), das paredes estreitas (Z)]; o padrão fecha a caixa (cada par
 * encontra o outro no meio). `bottom: false` omite o fundo (caixa apoiada que ninguém vê por baixo).
 * @param {number} w X · @param {number} h Y · @param {number} d Z
 */
export function cardboardBox(w, h, d, {
  thickness = 3.5, flapOpen = 0.35, seed = 'caixa', step = 12, flaps = null, bottom = true,
} = {}) {
  const parts = [];
  const place = (geo, matrix) => {
    geo.applyMatrix4(matrix);
    parts.push(geo);
  };
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const compose = (x, y, z, rx, ry, rz) => m.compose(new THREE.Vector3(x, y, z), q.setFromEuler(e.set(rx, ry, rz)), new THREE.Vector3(1, 1, 1)).clone();
  const t = thickness;
  // Laterais (flautas na vertical), fundo.
  place(cardboardPanel(w, h, t, { seed: `${seed}:f`, fluteAxis: 'y', step }), compose(0, h / 2, d / 2 - t / 2, 0, 0, 0));
  place(cardboardPanel(w, h, t, { seed: `${seed}:t`, fluteAxis: 'y', step }), compose(0, h / 2, -d / 2 + t / 2, 0, Math.PI, 0));
  place(cardboardPanel(d - 2 * t, h, t, { seed: `${seed}:l`, fluteAxis: 'y', step }), compose(-w / 2 + t / 2, h / 2, 0, 0, -Math.PI / 2, 0));
  place(cardboardPanel(d - 2 * t, h, t, { seed: `${seed}:r`, fluteAxis: 'y', step }), compose(w / 2 - t / 2, h / 2, 0, 0, Math.PI / 2, 0));
  if (bottom) place(cardboardPanel(w - 2 * t, d - 2 * t, t, { seed: `${seed}:b`, fluteAxis: 'x', step }), compose(0, t / 2, 0, -Math.PI / 2, 0, 0));
  // Abas: dobradas para fora pela linha do vinco, cada uma num ângulo um pouco diferente.
  const rng = new RNG(`abas:${seed}`);
  const flap = (len, width, x, z, ry) => {
    const g = cardboardPanel(width, len, t, { seed: `${seed}:aba${parts.length}`, fluteAxis: 'y', step });
    g.translate(0, len / 2, 0);
    // Rotação positiva em X inclina a aba para +Z local, que após `ry` é o lado de fora daquela parede.
    const open = flapOpen * rng.float(0.7, 1.3);
    g.applyMatrix4(new THREE.Matrix4().makeRotationX(open * Math.PI / 2));
    g.applyMatrix4(compose(x, h, z, 0, ry, 0));
    parts.push(g);
  };
  const [wide, narrow] = flaps ?? [d * 0.48, w * 0.42];
  flap(wide, w, 0, d / 2 - t / 2, 0);
  flap(wide, w, 0, -d / 2 + t / 2, Math.PI);
  flap(narrow, d - 2 * t, -w / 2 + t / 2, 0, -Math.PI / 2);
  flap(narrow, d - 2 * t, w / 2 - t / 2, 0, Math.PI / 2);
  const geo = mergeGeometries(parts, false);
  for (const p of parts) p.dispose();
  geo.computeBoundingSphere();
  return geo;
}

/** Reamostra um contorno fechado a cada ~`step` u, tremendo os pontos novos ao longo da normal (corte de estilete). */
function resampleOutline(points, step, jitter, noise) {
  const closed = points.length > 1 && points[0].equals(points[points.length - 1]) ? points.slice(0, -1) : points.slice();
  const out = [];
  for (let i = 0; i < closed.length; i++) {
    const a = closed[i];
    const b = closed[(i + 1) % closed.length];
    const len = a.distanceTo(b);
    if (len < 1e-6) continue;
    const n = Math.max(1, Math.ceil(len / step));
    const nx = (b.y - a.y) / len;
    const ny = -(b.x - a.x) / len;
    for (let k = 0; k < n; k++) {
      const t = k / n;
      const x = a.x + (b.x - a.x) * t;
      const y = a.y + (b.y - a.y) * t;
      // Os cantos do desenho ficam no lugar; só os pontos do meio das bordas tremem.
      const j = k === 0 ? 0 : (noise.noise(x * 0.09, y * 0.09, 1.7) + noise.noise(x * 0.4, y * 0.4, 5.3) * 0.35) * jitter;
      out.push(new THREE.Vector2(x + nx * j, y + ny * j));
    }
  }
  return out;
}

/** Distância de p ao contorno fechado `loop` (lista de Vector2). */
function outlineDistance(p, loop) {
  let best = Infinity;
  for (let i = 0; i < loop.length; i++) {
    const a = loop[i];
    const b = loop[(i + 1) % loop.length];
    const abx = b.x - a.x;
    const aby = b.y - a.y;
    const t = Math.max(0, Math.min(1, ((p.x - a.x) * abx + (p.y - a.y) * aby) / (abx * abx + aby * aby || 1)));
    best = Math.min(best, Math.hypot(p.x - a.x - abx * t, p.y - a.y - aby * t));
  }
  return best;
}

/**
 * Placa de papelão de qualquer contorno no plano XY (espessura em Z), recortada à mão: faces trianguladas do contorno
 * com os furos e subdivididas (triângulos de no máximo `step` u, para o empeno e para o gasto da borda), cortes em
 * todas as bordas (o tipo do corte segue o ângulo da borda com as flautas) e tremor de estilete no contorno.
 * Mesmos atributos do cardboardPanel; nas faces, aBoardSize = (−1, −1) avisa o shader que a distância até a borda de
 * fora (onde o manuseio escurece o papelão) vem pronta em aBoard.w — os furos são cortes novos, sem gasto.
 * @param {THREE.Shape} shape contorno em u (furos em shape.holes)
 * @param {number} [thickness] espessura (Z, u)
 */
export function cardboardPolygon(shape, thickness = 3.5, {
  fluteAxis = 'y', seed = 'recorte', jitter = 0.3, edgeStep = 8, step = 40, warp = 0.6, curveSegments = 12,
} = {}) {
  const rng = new RNG(`recorte:${seed}`);
  const noise = createNoise3(rng.nextU32());
  const phase = rng.float(0, 100);
  const ht = thickness / 2;
  const { shape: rawOuter, holes: rawHoles } = shape.extractPoints(curveSegments);
  const outer = resampleOutline(rawOuter, edgeStep, jitter, noise);
  if (THREE.ShapeUtils.isClockWise(outer)) outer.reverse();
  const holes = rawHoles.map((h) => {
    const loop = resampleOutline(h, edgeStep, jitter, noise);
    if (!THREE.ShapeUtils.isClockWise(loop)) loop.reverse();
    return loop;
  });
  const verts = [...outer, ...holes.flat()];
  // Subdivisão pela aresta mais longa (o ponto médio de uma aresta é o mesmo para os dois triângulos que a dividem).
  const mids = new Map();
  const midpoint = (a, b) => {
    const key = a < b ? `${a}:${b}` : `${b}:${a}`;
    let m = mids.get(key);
    if (m === undefined) {
      m = verts.length;
      verts.push(new THREE.Vector2((verts[a].x + verts[b].x) / 2, (verts[a].y + verts[b].y) / 2));
      mids.set(key, m);
    }
    return m;
  };
  const stack = THREE.ShapeUtils.triangulateShape(outer.slice(), holes.map((h) => h.slice())).map((t) => [...t]);
  const tris = [];
  const step2 = step * step;
  while (stack.length) {
    const [a, b, c] = stack.pop();
    const ab = verts[a].distanceToSquared(verts[b]);
    const bc = verts[b].distanceToSquared(verts[c]);
    const ca = verts[c].distanceToSquared(verts[a]);
    const longest = Math.max(ab, bc, ca);
    if (longest <= step2) {
      tris.push([a, b, c]);
      continue;
    }
    if (longest === ab) {
      const m = midpoint(a, b);
      stack.push([a, m, c], [m, b, c]);
    } else if (longest === bc) {
      const m = midpoint(b, c);
      stack.push([a, b, m], [a, m, c]);
    } else {
      const m = midpoint(c, a);
      stack.push([a, b, m], [m, b, c]);
    }
  }
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of verts) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  const w = Math.max(maxX - minX, 1e-3);
  const h = Math.max(maxY - minY, 1e-3);
  // Empeno (a mesma função nas duas faces) e a normal dele por diferença central.
  const bend = (x, y) => noise.noise(x * 0.004 + phase, y * 0.004, 7.7) * warp;
  const pos = [];
  const nrm = [];
  const uv = [];
  const board = [];
  const size = [];
  const index = [];
  const push = (x, y, z, n, u, v, b, s) => {
    pos.push(x, y, z);
    nrm.push(n[0], n[1], n[2]);
    uv.push(u, v);
    board.push(b[0], b[1], b[2], b[3]);
    size.push(s[0], s[1]);
    return pos.length / 3 - 1;
  };
  const wear = verts.map((p) => outlineDistance(p, outer));
  const faceBoard = (p, e) => (fluteAxis === 'y' ? [p.x - minX, p.y - minY, 0, e] : [p.y - minY, p.x - minX, 0, e]);
  for (const side of [1, -1]) {
    const base = pos.length / 3;
    verts.forEach((p, i) => {
      const z = bend(p.x, p.y);
      const gx = bend(p.x + 0.5, p.y) - bend(p.x - 0.5, p.y);
      const gy = bend(p.x, p.y + 0.5) - bend(p.x, p.y - 0.5);
      const l = Math.hypot(gx, gy, 1);
      push(p.x, p.y, z + side * ht, [(-gx / l) * side, (-gy / l) * side, side / l], (p.x - minX) / w, (p.y - minY) / h,
        faceBoard(p, wear[i]), [-1, -1]);
    });
    for (const [a, b, c] of tris) {
      const pa = verts[a];
      const cross = (verts[b].x - pa.x) * (verts[c].y - pa.y) - (verts[b].y - pa.y) * (verts[c].x - pa.x);
      if ((cross > 0) === (side > 0)) index.push(base + a, base + b, base + c);
      else index.push(base + a, base + c, base + b);
    }
  }
  // Cortes: um quadrilátero por trecho de cada contorno, com a normal para fora do material (contorno de fora no
  // sentido anti-horário e furos no horário: a direita do trecho é o lado de fora).
  const flute = fluteAxis === 'y' ? [0, 1] : [1, 0];
  for (const loop of [outer, ...holes]) {
    let total = 0;
    for (let i = 0; i < loop.length; i++) total += loop[i].distanceTo(loop[(i + 1) % loop.length]);
    let along = 0;
    for (let i = 0; i < loop.length; i++) {
      const a = loop[i];
      const b = loop[(i + 1) % loop.length];
      const len = a.distanceTo(b);
      if (len < 1e-6) continue;
      const dx = (b.x - a.x) / len;
      const dy = (b.y - a.y) / len;
      const n = [dy, -dx, 0];
      const kind = Math.abs(dx * flute[0] + dy * flute[1]) < 0.5 ? 1 : 2;
      const s = [thickness, total];
      const za = bend(a.x, a.y);
      const zb = bend(b.x, b.y);
      const v0 = push(a.x, a.y, za - ht, n, along / total, 0, [along, 0, kind, 0], s);
      const v1 = push(a.x, a.y, za + ht, n, along / total, 1, [along, 0, kind, 1], s);
      const v2 = push(b.x, b.y, zb - ht, n, (along + len) / total, 0, [along + len, 0, kind, 0], s);
      const v3 = push(b.x, b.y, zb + ht, n, (along + len) / total, 1, [along + len, 0, kind, 1], s);
      index.push(v0, v2, v1, v1, v2, v3);
      along += len;
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setAttribute('aBoard', new THREE.Float32BufferAttribute(board, 4));
  geo.setAttribute('aBoardSize', new THREE.Float32BufferAttribute(size, 2));
  geo.setIndex(index);
  geo.computeBoundingSphere();
  return geo;
}

/**
 * Tubo de papelão enrolado em espiral (tubo de forma, tubo de postal grande): superfícies de fora e de dentro com a
 * emenda helicoidal (tipo 3 no shader: aBoard = (arco, altura, 3, distância até a borda), aBoardSize = (circunferência,
 * passo da hélice)) e linhas de vértices perto das bordas para o gasto; bordas de cima e de baixo com as camadas de
 * papel (tipo 2). Eixo Y, de y = 0 a `height`; `radius` é o raio de dentro.
 */
export function woundTube(radius, height, wall, { pitch = 240, radial = 64, rowStep = 120 } = {}) {
  const rows = [0, 2, 5, 9, 14];
  for (let y = rowStep; y < height - 14; y += rowStep) rows.push(y);
  rows.push(height - 14, height - 9, height - 5, height - 2, height);
  rows.sort((a, b) => a - b);
  const pos = [];
  const nrm = [];
  const uv = [];
  const board = [];
  const size = [];
  const index = [];
  const push = (x, y, z, n, u, v, b, s) => {
    pos.push(x, y, z);
    nrm.push(n[0], n[1], n[2]);
    uv.push(u, v);
    board.push(b[0], b[1], b[2], b[3]);
    size.push(s[0], s[1]);
    return pos.length / 3 - 1;
  };
  const surface = (r, sign) => {
    const circ = Math.PI * 2 * r;
    const base = pos.length / 3;
    for (const y of rows) {
      for (let i = 0; i <= radial; i++) {
        const a = (i / radial) * Math.PI * 2;
        push(Math.cos(a) * r, y, Math.sin(a) * r, [Math.cos(a) * sign, 0, Math.sin(a) * sign], i / radial, y / height,
          [a * r, y, 3, Math.min(y, height - y)], [circ, pitch]);
      }
    }
    for (let j = 0; j + 1 < rows.length; j++) {
      for (let i = 0; i < radial; i++) {
        const a = base + j * (radial + 1) + i;
        const b = a + 1;
        const c = a + radial + 2;
        const d = a + radial + 1;
        if (sign > 0) index.push(a, d, c, a, c, b);
        else index.push(a, c, d, a, b, c);
      }
    }
  };
  surface(radius + wall, 1);
  surface(radius, -1);
  const circ = Math.PI * 2 * radius;
  for (const side of [1, -1]) {
    const base = pos.length / 3;
    const y = side > 0 ? height : 0;
    for (let i = 0; i <= radial; i++) {
      const a = (i / radial) * Math.PI * 2;
      push(Math.cos(a) * radius, y, Math.sin(a) * radius, [0, side, 0], i / radial, 0, [a * radius, 0, 2, 0], [wall, circ]);
      push(Math.cos(a) * (radius + wall), y, Math.sin(a) * (radius + wall), [0, side, 0], i / radial, 1, [a * radius, 0, 2, 1], [wall, circ]);
    }
    for (let i = 0; i < radial; i++) {
      const a = base + i * 2;
      const b = a + 1;
      const c = a + 3;
      const d = a + 2;
      // Borda de cima (side > 0) com a normal +Y: (dentro i, fora i+1, fora i) no sentido anti-horário visto de cima.
      if (side > 0) index.push(a, c, b, a, d, c);
      else index.push(a, b, c, a, c, d);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setAttribute('aBoard', new THREE.Float32BufferAttribute(board, 4));
  geo.setAttribute('aBoardSize', new THREE.Float32BufferAttribute(size, 2));
  geo.setIndex(index);
  geo.computeBoundingSphere();
  return geo;
}
```


- [ ] **Passo 6: Tubo de papelão com a borda virada certa; ripa de balsa com empeno fixo**


Em `src/clay/set/propGeometry.js`, trocar:

```
      if (side > 0) index.push(a, b, c, a, c, d);
      else index.push(a, c, b, a, d, c);
```

por:

```
      // Borda de cima (side > 0) com a normal +Y: (dentro i, fora i+1, fora i) no sentido anti-horário visto de cima.
      if (side > 0) index.push(a, c, b, a, d, c);
      else index.push(a, b, c, a, c, d);
```

Em `src/clay/set/propGeometry.js`, trocar:

```
/** Ripa de balsa ao longo de X: quinas levemente amaciadas, pontas cortadas à mão, leve empeno. */
export function balsaStick(length, width = 10, height = 6, { seed = 'balsa' } = {}) {
```

por:

```
/**
 * Ripa de balsa ao longo de X: quinas levemente amaciadas, pontas cortadas à mão, leve empeno. `bow` fixa o empeno no
 * meio (u; negativo = barriga para baixo, como a ripa comprida apoiada só nas pontas); sem ele, sorteado em ±0,8.
 */
export function balsaStick(length, width = 10, height = 6, { seed = 'balsa', bow: fixedBow = null } = {}) {
```

Em `src/clay/set/propGeometry.js`, trocar:

```
  const bow = rng.float(-0.8, 0.8);
```

por:

```
  const drawn = rng.float(-0.8, 0.8);
  const bow = fixedBow ?? drawn;
```


- [ ] **Passo 7: Lotes**

```js file=src/maps/pista/visual/batch.js
// Lotes da pista de testes: as peças estáticas de um mesmo material vão para um THREE.BatchedMesh — geometrias
// diferentes num só desenho, com matriz, cor e corte de visão por peça (o encanamento de espaço do objeto dos
// materiais já trata USE_BATCHING). O BatchedMesh exige o mesmo conjunto de atributos e índice em todas as geometrias:
// o construtor completa o que falta com valores padrão (por lote) e indexa quem não tem índice.

import * as THREE from 'three';

const _color = new THREE.Color();

/** Geometria indexada (índice sequencial se não tiver). */
function ensureIndex(geo) {
  if (!geo.index) {
    const n = geo.attributes.position.count;
    const idx = n > 65535 ? new Uint32Array(n) : new Uint16Array(n);
    for (let i = 0; i < n; i++) idx[i] = i;
    geo.setIndex(new THREE.BufferAttribute(idx, 1));
  }
  return geo;
}

/** Atributo constante (o valor padrão do lote para uma geometria que não tem o atributo). */
function fillAttribute(geo, name, values) {
  const n = geo.attributes.position.count;
  const arr = new Float32Array(n * values.length);
  for (let i = 0; i < n; i++) arr.set(values, i * values.length);
  geo.setAttribute(name, new THREE.BufferAttribute(arr, values.length));
}

export class BatchBuilder {
  constructor() {
    /** @type {Map<string, {material:THREE.Material, castShadow:boolean, receiveShadow:boolean, defaults:object, entries:Array}>} */
    this.groups = new Map();
  }

  /**
   * Declara um lote. `defaults` = { atributo: [valores] } usados em geometrias sem o atributo (os demais faltantes
   * viram zeros); `name` aparece no inspetor.
   */
  define(key, { material, castShadow = true, receiveShadow = true, defaults = {}, name = key }) {
    if (this.groups.has(key)) throw new Error(`lote repetido na pista: ${key}`);
    this.groups.set(key, { material, castShadow, receiveShadow, defaults, name, entries: [] });
    return this;
  }

  has(key) {
    return this.groups.has(key);
  }

  /**
   * Uma peça no lote. A mesma geometria em várias peças é enviada uma vez (instâncias). `color` = THREE.Color, hex ou
   * [r, g, b] (multiplica o material; sem cor, branco).
   */
  add(key, geometry, matrix, color = null) {
    const g = this.groups.get(key);
    if (!g) throw new Error(`lote desconhecido na pista: ${key}`);
    g.entries.push({ geometry, matrix: matrix.clone(), color });
  }

  /**
   * Monta os BatchedMesh e põe no `parent`. As geometrias de origem são liberadas (o lote copiou os dados).
   * @returns {{meshes:THREE.BatchedMesh[], draws:number, triangles:number, instances:number}}
   */
  build(parent) {
    const meshes = [];
    let triangles = 0;
    let instances = 0;
    for (const [key, g] of this.groups) {
      if (!g.entries.length) continue;
      const unique = [...new Set(g.entries.map((e) => e.geometry))];
      // Conjunto de atributos do lote: a união (tamanho do item do primeiro que tiver).
      const sizes = new Map();
      for (const geo of unique) {
        for (const [name, attr] of Object.entries(geo.attributes)) if (!sizes.has(name)) sizes.set(name, attr.itemSize);
      }
      let vertices = 0;
      let indices = 0;
      for (const geo of unique) {
        ensureIndex(geo);
        for (const [name, size] of sizes) {
          if (!geo.attributes[name]) fillAttribute(geo, name, g.defaults[name] ?? new Array(size).fill(0));
          else if (geo.attributes[name].itemSize !== size) throw new Error(`atributo ${name} com tamanho diferente no lote ${key}`);
          if (geo.attributes[name].normalized) throw new Error(`atributo ${name} normalizado no lote ${key}`);
        }
        vertices += geo.attributes.position.count;
        indices += geo.index.count;
      }
      const mesh = new THREE.BatchedMesh(g.entries.length, vertices, indices, g.material);
      mesh.name = `pista-${g.name}`;
      mesh.castShadow = g.castShadow;
      mesh.receiveShadow = g.receiveShadow;
      const ids = new Map(unique.map((geo) => [geo, mesh.addGeometry(geo)]));
      const colored = g.entries.some((e) => e.color !== null);
      for (const e of g.entries) {
        const id = mesh.addInstance(ids.get(e.geometry));
        mesh.setMatrixAt(id, e.matrix);
        if (colored) {
          if (e.color === null) _color.setRGB(1, 1, 1);
          else if (Array.isArray(e.color)) _color.setRGB(e.color[0], e.color[1], e.color[2]);
          else _color.set(e.color);
          mesh.setColorAt(id, _color);
        }
        triangles += e.geometry.index.count / 3;
      }
      instances += g.entries.length;
      mesh.computeBoundingBox();
      mesh.computeBoundingSphere();
      for (const geo of unique) geo.dispose();
      g.entries = [];
      parent.add(mesh);
      meshes.push(mesh);
    }
    return { meshes, draws: meshes.length, triangles, instances };
  }
}
```


- [ ] **Passo 8: Rodar e ver passar**

Run: `node --test tests/pistaGeometry.test.js`
Expected: PASS (5 testes).


- [ ] **Passo 9: Suíte inteira**

Run: `npm test`
Expected: 204 testes passando.


- [ ] **Commit (só quando o usuário pedir)**

```bash
git add src/clay/set/bookGeometry.js src/clay/set/stationeryGeometry.js src/clay/set/boardGeometry.js src/clay/set/propGeometry.js src/maps/pista/visual/batch.js tests/pistaGeometry.test.js
git commit -m "feat(fase-3.3): livros, papelaria, papelão recortado e lotes" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```


---

### Tarefa 4: Materiais novos do set e a impressão do ClayMaterial

**Files:**
- Create: `src/clay/set/bookMaterial.js`, `src/clay/set/measureMaterials.js`, `src/clay/set/paintMaterials.js`, `src/clay/set/printMaterials.js`
- Modify: `src/clay/set/paperMaterials.js` (arquivo inteiro), `src/clay/set/woodMaterials.js` (arquivo inteiro), `src/clay/set/labelAtlas.js` (arquivo inteiro), `src/clay/set/index.js`, `src/clay/ClayMaterial.js`
- Test: `tests/pistaMaterials.test.js`

Todos pela mesma luz suave de estúdio do set (`createSetMaterial`); a cor de cada peça num lote multiplica o `diffuseColor` depois do trecho de superfície. O teste roda o `onBeforeCompile` de cada material sobre o shader físico do three e confere que todo uniform declarado tem objeto de valor (um uniform sem objeto deixa a textura sem unidade e o material sai preto); a compilação do GLSL de verdade é conferida no navegador (Tarefa 8).

- [ ] **Passo 1: Escrever o teste**

```js file=tests/pistaMaterials.test.js
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
```


- [ ] **Passo 2: Rodar e ver falhar**

Run: `node --test tests/pistaMaterials.test.js`
Expected: FAIL — `Cannot find module` de `src/clay/set/bookMaterial.js`.


- [ ] **Passo 3: Livros** — pano da capa com trama e gasto nas pontas, guarda, folhas com as linhas e os cadernos, e a lombada lida de um atlas por mapa (título em dourado nas capas escuras ou impresso, etiqueta e anotação a caneta, com relevo).

```js file=src/clay/set/bookMaterial.js
// Livros do set (bookGeometry.js; BAS1, BAS4, BAS7, BAS9, BAS11, BAS15 no item 11 do moodboard): um material para
// todos os livros de um mapa, num lote só.
//  - Pano da capa (buckram): trama fina, a cor de cada livro vem da cor da peça (BatchedMesh.setColorAt); gasto de
//    manuseio nas bordas das pastas, quinas batidas mostrando o papelão cinza e as pontas da lombada puídas.
//  - Lombada: título estampado (dourado em capa escura, preto em capa clara, levemente afundado) e, nos livros das
//    escadas, a etiqueta de biblioteca com a altura escrita à mão — do atlas das lombadas do mapa.
//  - Borda das folhas: papel creme com as folhas (de muito perto), os cadernos costurados (grupos de folhas), pontinhos
//    de mofo e a borda um pouco mais escura rente às capas.
//  - Guarda: papel de dentro da capa, só na fresta.
// O atlas das lombadas (bakeSpineAtlas) é do mapa: RGBA = título · papel da etiqueta · escrita da etiqueta · 1.

import * as THREE from 'three';
import { RNG } from '../../core/rng.js';
import { createSetMaterial } from './setShader.js';

const linear = (hex) => new THREE.Color(hex);

/**
 * @param {object} tex texturas do set
 * @param {{atlas:THREE.Texture, paper?:string, endpaper?:string, board?:string, foil?:string, ink?:string, name?:string}} opts
 */
export function bookMaterial(tex, {
  atlas, paper = '#EFE5CF', endpaper = '#E6DAC0', board = '#8D8578', foil = '#C8A24A', ink = '#1B1714',
  sticker = '#F3EFE4', pen = '#23272F', name = 'livros',
}) {
  return createSetMaterial({
    name,
    physical: true,
    params: { color: 0xffffff, roughness: 0.78, metalness: 0, clearcoat: 0, sheen: 0.35, sheenRoughness: 0.7, sheenColor: new THREE.Color('#6d6259') },
    uniforms: {
      uWeave: { value: tex.weave },
      uPaperTex: { value: tex.paper },
      uSpineAtlas: { value: atlas },
      uPagePaper: { value: linear(paper) },
      uEndpaper: { value: linear(endpaper) },
      uBoardGrey: { value: linear(board) },
      uFoil: { value: linear(foil) },
      uPrintInk: { value: linear(ink) },
      uSticker: { value: linear(sticker) },
      uPen: { value: linear(pen) },
    },
    light: { wrap: 0.3, lift: 0.07 },
    vertexPars: /* glsl */ `
attribute float aBookPart;
attribute vec2 aBookUv;
attribute vec3 aBookDims;
attribute vec4 aSpineRect;
varying float vBookPart;
varying vec2 vBookUv;
varying vec3 vBookDims;
varying vec4 vSpineRect;
`,
    vertex: 'vBookPart = aBookPart;\n  vBookUv = aBookUv;\n  vBookDims = aBookDims;\n  vSpineRect = aSpineRect;',
    fragPars: /* glsl */ `
uniform sampler2D uWeave;
uniform sampler2D uPaperTex;
uniform sampler2D uSpineAtlas;
uniform vec3 uPagePaper;
uniform vec3 uEndpaper;
uniform vec3 uBoardGrey;
uniform vec3 uFoil;
uniform vec3 uPrintInk;
uniform vec3 uSticker;
uniform vec3 uPen;
varying float vBookPart;
varying vec2 vBookUv;
varying vec3 vBookDims;
varying vec4 vSpineRect;
`,
    surface: /* glsl */ `
vec3 cover = diffuseColor.rgb;
float part = vBookPart;
vec2 uv = vBookUv;
vec3 col;
// Amostras fora de desvio (mipmap com derivadas válidas em todo o quadrado de pixels).
vec4 wv = texture(uWeave, uv / 32.0);
vec4 pp = texture(uPaperTex, vec2(uv.x / 140.0, setP.y / 9.0));
// Lombada: (ao longo ÷ comprimento, 1 − arco ÷ arco total) na célula do atlas; mais duas amostras de cada lado para o
// relevo (título afundado, etiqueta colada por cima). Em partes sem lombada, vSpineRect.z = 0 zera tudo.
vec2 suv = vec2(uv.x / max(vBookDims.x, 1e-3), 1.0 - uv.y / max(vBookDims.z, 1e-3));
vec2 se = vec2(0.35 / max(vBookDims.x, 1e-3), 0.35 / max(vBookDims.z, 1e-3));
vec4 sp = texture(uSpineAtlas, vSpineRect.xy + clamp(suv, 0.0, 1.0) * vSpineRect.zw);
vec4 sx1 = texture(uSpineAtlas, vSpineRect.xy + clamp(suv + vec2(se.x, 0.0), 0.0, 1.0) * vSpineRect.zw);
vec4 sx0 = texture(uSpineAtlas, vSpineRect.xy + clamp(suv - vec2(se.x, 0.0), 0.0, 1.0) * vSpineRect.zw);
vec4 sy1 = texture(uSpineAtlas, vSpineRect.xy + clamp(suv - vec2(0.0, se.y), 0.0, 1.0) * vSpineRect.zw);
vec4 sy0 = texture(uSpineAtlas, vSpineRect.xy + clamp(suv + vec2(0.0, se.y), 0.0, 1.0) * vSpineRect.zw);
float hasSpine = step(1e-6, vSpineRect.z) * step(2.5, part);
mat3 tbn = setCotangentFrame(setN, setP, uv);
if (part < 0.5 || part > 2.5) {
  // Pano: trama em cruz e fios mais claros/escuros; o gasto clareia e acinzenta o pano (fibras quebradas) e, nas quinas
  // batidas, some e mostra o papelão cinza da pasta.
  col = cover * (0.9 + 0.2 * (wv.b - 0.5) * 2.0);
  float dEnd = min(uv.x, vBookDims.x - uv.x);
  float dFore = part > 2.5 ? 1e4 : uv.y;
  float d = min(dEnd, dFore);
  float corner = (1.0 - smoothstep(0.0, 9.0, dEnd)) * (1.0 - smoothstep(0.0, 9.0, dFore));
  float n = clayNoise3(vec3(uv * 0.35, part * 7.0)) * 0.5 + 0.5;
  float worn = (1.0 - smoothstep(0.0, 4.0 + n * 5.0, d)) * (0.55 + 0.45 * n);
  worn = max(worn, corner * 0.8);
  col = mix(col, mix(col, vec3(dot(col, vec3(0.3333))) * 1.35 + 0.04, 0.6), worn * 0.7);
  col = mix(col, uBoardGrey * (0.85 + 0.2 * n), smoothstep(0.55, 0.95, corner * n * 1.6) * step(part, 0.5));
  // Título e etiqueta da lombada.
  float lum = dot(cover, vec3(0.2126, 0.7152, 0.0722));
  float dark = 1.0 - step(0.12, lum);
  vec3 inkCol = mix(uPrintInk, uFoil, dark);
  float title = clamp(sp.r * 1.25, 0.0, 1.0) * hasSpine * (1.0 - worn * 0.5);
  float label = sp.g * hasSpine;
  float pen = sp.b * hasSpine;
  col = mix(col, inkCol, title);
  col = mix(col, uSticker * (0.94 + 0.08 * (pp.a - 0.5)), label);
  col = mix(col, uPen, pen * 0.95);
  // Relevo: título afundado (a normal cai para dentro na borda das letras) e etiqueta colada por cima, lisa.
  vec2 gt = vec2(sx1.r - sx0.r, sy1.r - sy0.r) / 0.7 * hasSpine;
  vec2 gl = vec2(sx1.g - sx0.g, sy1.g - sy0.g) / 0.7 * hasSpine;
  vec2 dn = (wv.rg * 2.0 - 1.0) * 0.8 * (1.0 - label) + gt * 0.3 - gl * 0.25;
  setObjN = normalize(tbn * vec3(dn, 1.0));
  float foil = title * dark;
  setMetal += foil * 0.75;
  setRough += worn * 0.15 - foil * 0.5 - title * 0.1 - label * 0.1;
} else if (part < 1.5) {
  col = uEndpaper * (0.94 + 0.12 * (pp.b - 0.5));
  setRough += 0.1;
} else {
  // Borda das folhas: folha a folha (0,1 u) só de muito perto; os cadernos (16 folhas) em sulcos mais escuros.
  // Aqui vBookDims.z é a espessura do miolo.
  float y = uv.y;
  float fw = max(fwidth(y), 1e-4);
  float leaf = (0.5 + 0.5 * cos(6.2831853 * y / 0.1)) * (1.0 - smoothstep(0.02, 0.06, fw));
  float sig = abs(fract(y / 1.6 + clayHash12(vec2(floor(y / 1.6), 1.0)) * 0.2) - 0.5) * 1.6;
  float gap = (1.0 - smoothstep(0.0, 0.12 + fw, sig)) * (1.0 - smoothstep(0.3, 0.9, fw));
  col = uPagePaper * (0.93 + 0.1 * (pp.b - 0.5)) * (1.0 - leaf * 0.06) * (1.0 - gap * 0.25);
  // Rente às capas o papel pegou mais poeira e luz; pontinhos de mofo aqui e ali.
  float nearCover = 1.0 - smoothstep(0.0, 2.2, min(y, vBookDims.z - y));
  float spots = smoothstep(0.78, 0.9, clayNoise3(vec3(uv.x * 0.6, y * 0.6, 3.1)) * 0.5 + 0.5);
  col *= (1.0 - nearCover * 0.1) * (1.0 - spots * 0.15);
  // Folhas não ficam perfeitamente alinhadas: a normal oscila em grupos ao longo da espessura.
  float wob = clayNoise3(vec3(uv.x * 0.08, y * 1.4, 5.5));
  setObjN = normalize(tbn * vec3(0.0, wob * 0.25 + gap * 0.2, 1.0));
  setRough += 0.08;
}
diffuseColor.rgb = col;
`,
  });
}

/**
 * Atlas das lombadas: uma célula por texto diferente, com a largura proporcional à lombada (texto sem esticar),
 * empacotadas em prateleiras. RGBA = título impresso · papel da etiqueta · escrita da etiqueta · 1.
 * @param {Array<{title:string, label?:string, aspect:number}>} spines `aspect` = comprimento ÷ arco da lombada
 * @returns {{texture:THREE.CanvasTexture, rects:number[][], dispose():void}} rects[i] = [u0, v0, largura, altura]
 */
export function bakeSpineAtlas(spines, { width = 2048, cellHeight = 40, seed = 'lombadas', anisotropy = 8 } = {}) {
  const pad = 2;
  const cells = [];
  let x = 0;
  let y = 0;
  for (const s of spines) {
    const w = Math.min(width - 2 * pad, Math.max(24, Math.round(cellHeight * s.aspect)));
    if (x + w + pad > width) {
      x = 0;
      y += cellHeight + pad;
    }
    cells.push({ x, y, w, h: cellHeight });
    x += w + pad;
  }
  const height = 2 ** Math.ceil(Math.log2(Math.max(y + cellHeight, 1)));
  const layer = () => {
    const c = document.createElement('canvas');
    c.width = width;
    c.height = height;
    const g = c.getContext('2d');
    g.fillStyle = '#ffffff';
    g.strokeStyle = '#ffffff';
    g.textBaseline = 'middle';
    return { c, g };
  };
  const title = layer();
  const sticker = layer();
  const pen = layer();
  spines.forEach((s, i) => {
    const cell = cells[i];
    const rng = new RNG(`${seed}:${i}:${s.title}`);
    const hasLabel = !!s.label;
    const stickerW = hasLabel ? Math.min(cell.w * 0.3, cell.h * 1.7) : 0;
    const room = cell.w - stickerW - cell.h * 0.6;
    // Título em versaletes espaçados, centrado no espaço livre (a etiqueta fica perto da ponta direita).
    let px = Math.round(cell.h * 0.52);
    title.g.font = `600 ${px}px Georgia, "Times New Roman", serif`;
    const text = s.title.toUpperCase();
    const spacing = px * 0.08;
    const measure = () => [...text].reduce((wsum, ch) => wsum + title.g.measureText(ch).width + spacing, 0);
    let tw = measure();
    if (tw > room) {
      px = Math.max(8, Math.floor(px * (room / tw)));
      title.g.font = `600 ${px}px Georgia, "Times New Roman", serif`;
      tw = measure();
    }
    let cx = cell.x + cell.h * 0.3 + Math.max(0, (room - tw) / 2);
    const cy = cell.y + cell.h / 2 + rng.float(-0.4, 0.4);
    for (const ch of text) {
      title.g.fillText(ch, cx, cy);
      cx += title.g.measureText(ch).width + spacing;
    }
    if (hasLabel) {
      // Etiqueta de biblioteca: retângulo de papel de cantos redondos, um pouco torto, com a altura escrita à mão.
      const sx = cell.x + cell.w - stickerW - cell.h * 0.25;
      const sh = cell.h * 0.78;
      const sy = cell.y + (cell.h - sh) / 2;
      sticker.g.save();
      sticker.g.translate(sx + stickerW / 2, sy + sh / 2);
      sticker.g.rotate(rng.float(-0.025, 0.025));
      sticker.g.beginPath();
      sticker.g.roundRect(-stickerW / 2, -sh / 2, stickerW, sh, sh * 0.16);
      sticker.g.fill();
      sticker.g.restore();
      const hp = Math.round(sh * 0.62);
      pen.g.lineJoin = 'round';
      pen.g.lineCap = 'round';
      let lx = sx + stickerW * 0.12;
      const chars = [...s.label];
      pen.g.font = `700 ${hp}px "Segoe Print", "Bradley Hand", "Comic Sans MS", cursive`;
      const natural = chars.reduce((wsum, ch) => wsum + pen.g.measureText(ch).width, 0);
      const fit = Math.min(1, (stickerW * 0.8) / Math.max(natural, 1));
      lx = sx + (stickerW - natural * fit) / 2;
      for (const ch of chars) {
        const size = hp * fit * rng.float(0.93, 1.07);
        pen.g.font = `700 ${Math.round(size)}px "Segoe Print", "Bradley Hand", "Comic Sans MS", cursive`;
        const adv = pen.g.measureText(ch).width;
        pen.g.save();
        pen.g.translate(lx + adv / 2, sy + sh / 2 + rng.float(-0.05, 0.05) * size);
        pen.g.rotate(rng.float(-0.07, 0.07));
        pen.g.lineWidth = size * 0.07;
        pen.g.strokeText(ch, -adv / 2, 0);
        pen.g.fillText(ch, -adv / 2, 0);
        pen.g.restore();
        lx += adv * rng.float(0.97, 1.03);
      }
    }
  });
  const out = document.createElement('canvas');
  out.width = width;
  out.height = height;
  const og = out.getContext('2d');
  const img = og.createImageData(width, height);
  const t = title.g.getImageData(0, 0, width, height).data;
  const st = sticker.g.getImageData(0, 0, width, height).data;
  const pn = pen.g.getImageData(0, 0, width, height).data;
  for (let i = 0; i < img.data.length; i += 4) {
    img.data[i] = t[i + 3];
    img.data[i + 1] = st[i + 3];
    img.data[i + 2] = pn[i + 3];
    img.data[i + 3] = 255;
  }
  og.putImageData(img, 0, 0);
  for (const l of [title, sticker, pen]) l.c.width = l.c.height = 0;
  const texture = new THREE.CanvasTexture(out);
  texture.name = 'massacre.set.lombadas';
  texture.colorSpace = THREE.NoColorSpace;
  texture.anisotropy = anisotropy;
  texture.generateMipmaps = true;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.needsUpdate = true;
  const rects = cells.map((c) => [c.x / width, 1 - (c.y + c.h) / height, c.w / width, c.h / height]);
  return {
    texture,
    rects,
    dispose() {
      texture.dispose();
      out.width = out.height = 0;
    },
  };
}
```


- [ ] **Passo 4: Medidas** — régua de madeira, régua de aço, lâmina amarela da trena (números a cada 10 u, vermelho a cada 100 u, placa a cada 1000 u), tábua de crescimento escura com numerais brancos e o papel quadriculado da quadra, todos com o atlas de dígitos do tapete de corte.

```js file=src/clay/set/measureMaterials.js
// Coisas de medir do set (pista de testes; PRU1, PRU15, TMA2, TMA6, TMA12, WRG1, WRG4, WRG11, LDB9 no item 11 do
// moodboard): um material, num lote só, com cinco aparências escolhidas pelo atributo aMeasure = (modo, comprimento,
// largura, espessura) e a cor de cada peça vinda da cor da peça (BatchedMesh.setColorAt). uv em u:
//   0 régua escolar de madeira: veio claro envernizado, escala impressa a partir da borda do bisel (uv.y = 0 no bisel):
//     traços de 1 mm, 5 mm e 1 cm e os números dos centímetros;
//   1 régua de aço: aço escovado ao longo do comprimento, escala gravada e preenchida de preto;
//   2 lâmina da trena: aço laqueado amarelo, traços de milímetro nas duas bordas, número a cada 1 cm (10 u) e vermelho
//     a cada 10 cm (100 u); no metro, o número em branco sobre o retângulo vermelho;
//   3 tábua de crescimento: tinta escura, traço a cada 10 u, maior a cada 50 u, linha inteira e numeral branco a cada
//     100 u (uv.x = altura a partir do chão);
//   4 papel quadriculado de plotter: linha fina a cada 20 u e forte a cada 100 u, metros numerados nas bordas sul e
//     oeste (uv = a partir do canto sudoeste).
// Números com o atlas de dígitos do set (o mesmo do tapete de corte), até quatro dígitos.

import * as THREE from 'three';
import { createSetMaterial } from './setShader.js';

const linear = (hex) => new THREE.Color(hex);

const MEASURE_GLSL = /* glsl */ `
uniform sampler2D uDigits;
uniform sampler2D uWood;
uniform sampler2D uBrushed;
uniform sampler2D uPaperTex;
uniform vec3 uInk;
uniform vec3 uRed;
uniform vec3 uWhite;
uniform vec3 uGridInk;
varying vec4 vMeasure;
// Número inteiro de até 4 dígitos no espaço da letra (x para a direita, y para cima): centrado em x = 0, base em y = 0;
// gh = altura, gw = avanço por dígito (u). A amostra usa o gradiente da coordenada contínua (sem costura de mipmap entre
// dígitos) e acontece sempre — fora do número a máscara zera.
float msNumber(vec2 q, float value, float gh, float gw) {
  float v = floor(value + 0.5);
  float nd = v >= 1000.0 ? 4.0 : (v >= 100.0 ? 3.0 : (v >= 10.0 ? 2.0 : 1.0));
  vec2 g = vec2((q.x + nd * gw * 0.5) / gw, q.y / gh);
  vec2 cont = vec2(g.x * 0.082, g.y);
  float inside = step(0.0, g.x) * step(g.x, nd - 1e-4) * step(0.0, g.y) * step(g.y, 1.0);
  float idx = clamp(floor(g.x), 0.0, nd - 1.0);
  float digit = mod(floor(v / pow(10.0, nd - 1.0 - idx) + 1e-3), 10.0);
  vec2 uv = vec2((digit + 0.09 + fract(g.x) * 0.82) / 10.0, clamp(g.y, 0.0, 1.0));
  return textureGrad(uDigits, uv, dFdx(cont), dFdy(cont)).a * inside;
}
// Traços de escala a partir de uma borda: d = distância até a borda; comprimentos de 1, 5 e 10 u.
float msTicks(float along, float d, float l1, float l5, float l10) {
  float mm = setGridLine(along, 1.0, 0.07) * step(d, l1);
  float mm5 = setGridLine(along, 5.0, 0.09) * step(d, l5);
  float cm = setGridLine(along, 10.0, 0.11) * step(d, l10);
  return max(max(mm * 0.8, mm5 * 0.9), cm);
}
`;

export function measureMaterial(tex, {
  ink = '#15130F', red = '#C8261E', white = '#F2EEE6', grid = '#5E93BF', name = 'medidas',
} = {}) {
  return createSetMaterial({
    name,
    params: {
      color: 0xffffff, roughness: 0.5, metalness: 0, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2,
    },
    uniforms: {
      uDigits: { value: tex.digits },
      uWood: { value: tex.wood },
      uBrushed: { value: tex.brushed },
      uPaperTex: { value: tex.paper },
      uInk: { value: linear(ink) },
      uRed: { value: linear(red) },
      uWhite: { value: linear(white) },
      uGridInk: { value: linear(grid) },
    },
    light: { wrap: 0.3, lift: 0.07 },
    vertexPars: 'attribute vec4 aMeasure;\nvarying vec4 vMeasure;',
    vertex: 'vMeasure = aMeasure;',
    fragPars: MEASURE_GLSL,
    surface: /* glsl */ `
float mode = floor(vMeasure.x + 0.5);
float L = vMeasure.y;
float W = vMeasure.z;
vec2 p = setUv;
vec3 base = diffuseColor.rgb;
vec3 col = base;
vec3 inkCol = uInk;
float ink = 0.0;
mat3 tbn = setCotangentFrame(setN, setP, p);
vec4 wd = texture(uWood, vec2(p.x / 180.0, p.y / 55.0));
vec4 bru = texture(uBrushed, vec2(p.x / 90.0, p.y / 14.0));
vec4 pp = texture(uPaperTex, p / 150.0);
if (mode < 0.5) {
  // Régua escolar: o zero 4 u depois da ponta; números dos centímetros acima dos traços.
  float along = p.x - 4.0;
  float on = step(0.0, along + 0.2) * step(along, L - 7.8) * step(0.3, setN.y);
  ink = msTicks(along, p.y, 3.0, 4.6, 6.6) * on;
  float k = floor(along / 10.0 + 0.5);
  ink = max(ink, msNumber(vec2(along - k * 10.0, p.y - 7.6), k, 3.6, 2.3) * on * step(-0.5, k));
  col = base * (0.84 + 0.26 * wd.b) * (1.0 - wd.a * 0.2);
  setRough += -0.07 + wd.a * 0.1 - ink * 0.05;
  setObjN = normalize(tbn * vec3((wd.rg * 2.0 - 1.0) * 0.25, 1.0));
} else if (mode < 1.5) {
  // Régua de aço: gravação preenchida de preto; o aço escovado reflete o estúdio.
  float along = p.x - 3.0;
  float on = step(0.0, along + 0.2) * step(along, L - 6.0) * step(0.5, setN.y);
  ink = msTicks(along, p.y, 2.6, 4.0, 6.0) * on;
  float k = floor(along / 10.0 + 0.5);
  ink = max(ink, msNumber(vec2(along - k * 10.0, p.y - 7.0), k, 3.2, 2.1) * on * step(-0.5, k));
  col = base * (0.9 + 0.12 * bru.b);
  inkCol = vec3(0.03);
  setMetal += 1.0 - ink;
  setRough += -0.2 + bru.b * 0.12 + bru.a * 0.08 + ink * 0.4;
  setObjN = normalize(tbn * vec3((bru.rg * 2.0 - 1.0) * 0.5, 1.0));
} else if (mode < 2.5) {
  // Trena: traços nas duas bordas; centímetros numerados (menores com 3 dígitos); vermelho a cada 10 cm; no metro o
  // número em branco num retângulo vermelho.
  float along = p.x;
  float top = W - p.y;
  ink = max(msTicks(along, top, 2.8, 4.4, 6.8), msTicks(along, p.y, 2.0, 3.2, 5.0) * 0.9);
  float k = floor(along / 10.0 + 0.5);
  float big = k < 100.0 ? 1.0 : 0.0;
  float gh = mix(5.0, 6.4, big);
  float gw = mix(2.75, 3.4, big);
  float num = msNumber(vec2(along - k * 10.0, p.y - W * 0.5 + gh * 0.5 - 0.6), k, gh, gw) * step(0.5, k);
  float tenth = 1.0 - step(0.5, abs(mod(k, 10.0)));
  float meter = 1.0 - step(0.5, abs(mod(k, 100.0)));
  vec2 box = abs(vec2(along - k * 10.0, p.y - W * 0.5)) - vec2(8.5, 5.2);
  float plate = meter * step(0.5, k) * (1.0 - step(0.0, max(box.x, box.y)));
  col = base * (0.94 + 0.08 * (bru.b - 0.5));
  col = mix(col, uRed, plate);
  vec3 numCol = mix(mix(uInk, uRed, tenth), uWhite, meter);
  col = mix(col, uInk, ink * (1.0 - plate));
  col = mix(col, numCol, num);
  ink = 0.0; // já composto acima (traço preto, número na cor dele)
  setRough += -0.15 + bru.a * 0.05;
  setMetal += 0.05;
  setObjN = normalize(tbn * vec3((bru.rg * 2.0 - 1.0) * 0.12, 1.0));
} else if (mode < 3.5) {
  // Tábua de crescimento: pinceladas na tinta escura; escala branca na borda esquerda de quem olha (uv.y = 0).
  float h = p.x;
  float on = step(0.5, setN.z);
  float t10 = setGridLine(h, 10.0, 0.4) * step(p.y, 9.0);
  float t50 = setGridLine(h, 50.0, 0.5) * step(p.y, 16.0);
  float t100 = setGridLine(h, 100.0, 0.7);
  float k = floor(h / 100.0 + 0.5);
  // Numeral entre os traços da esquerda e as anotações a lápis da direita (layoutTower: 22% da largura à direita).
  float num = msNumber(vec2(p.y - W * 0.39, h - k * 100.0 - 4.0), k * 100.0, 9.0, 5.6) * step(0.5, k);
  ink = max(max(max(t10, t50), t100), num) * on;
  float stroke = clayNoise3(vec3(p.x * 0.012, p.y * 0.3, 2.0)) * 0.5 + 0.5;
  col = base * (0.88 + 0.22 * stroke) * (0.95 + 0.1 * (pp.b - 0.5));
  inkCol = uWhite * (0.94 + 0.06 * (pp.b - 0.5));
  setRough += 0.1 - ink * 0.08;
  setObjN = normalize(tbn * vec3((stroke - 0.5) * 0.12, (pp.g - 0.5) * 0.2, 1.0));
} else {
  // Quadriculado de plotter: linhas finas e fortes; metros na borda sul (0–16) e na oeste (0–10), lidos do sul.
  float fine = max(setGridLine(p.x, 20.0, 0.16), setGridLine(p.y, 20.0, 0.16));
  float strong = max(setGridLine(p.x, 100.0, 0.42), setGridLine(p.y, 100.0, 0.42));
  float kx = floor(p.x / 100.0 + 0.5);
  float ky = floor(p.y / 100.0 + 0.5);
  float south = msNumber(vec2(p.x - kx * 100.0 - 7.0, p.y - 6.0), kx, 9.0, 5.6) * step(p.y, 20.0);
  float west = msNumber(vec2(p.x - 12.0, p.y - ky * 100.0 - 5.0), ky, 9.0, 5.6) * step(p.x, 30.0) * step(0.5, ky);
  ink = max(max(fine * 0.55, strong), max(south, west)) * step(0.5, setN.y);
  inkCol = uGridInk;
  col = base * (0.95 + 0.08 * (pp.b - 0.5)) * (0.97 + 0.05 * pp.a);
  setRough += 0.4;
  setObjN = normalize(tbn * vec3((pp.rg * 2.0 - 1.0) * 0.12, 1.0));
}
diffuseColor.rgb = mix(col, inkCol, clamp(ink, 0.0, 1.0) * 0.95);
`,
  });
}
```


- [ ] **Passo 5: Tintas e o chão do estúdio**

```js file=src/clay/set/paintMaterials.js
// Tintas e acabamentos do set (pista de testes; PRU3, TMA6, BWM10 no item 11 do moodboard):
//  - paint: um material para as peças pequenas pintadas de um mapa, num lote só; o atributo aPaint escolhe o acabamento
//    e a cor de cada peça vem da cor da peça (BatchedMesh.setColorAt):
//      0 laca (corpo do lápis): tinta grossa e brilhante com casca de laranja e filme de verniz (clearcoat);
//      1 grafite (ponta do lápis): cinza-chumbo meio metálico com os riscos do apontador;
//      2 borracha (borracha do lápis, laterais e trava da trena): fosca, porosa, com o brilho do uso nas partes gastas;
//      3 plástico brilhante (cabeça dos alfinetes): liso, reflexo firme, leve translucidez.
//  - floorPaint: chão do estúdio em volta da mesa (piso pintado escuro): marcas de arrasto, restos de fita e poeira.

import * as THREE from 'three';
import { createSetMaterial } from './setShader.js';

const linear = (hex) => new THREE.Color(hex);

export function paintMaterial(tex, { graphite = '#2E2E31', name = 'tintas' } = {}) {
  return createSetMaterial({
    name,
    physical: true,
    params: { color: 0xffffff, roughness: 0.5, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.12 },
    uniforms: {
      uBrushed: { value: tex.brushed },
      uPaperTex: { value: tex.paper },
      uGraphite: { value: linear(graphite) },
    },
    light: { wrap: 0.25, lift: 0.06, translucency: 0.15 },
    vertexPars: 'attribute float aPaint;\nvarying float vPaint;',
    vertex: 'vPaint = aPaint;',
    fragPars: 'uniform sampler2D uBrushed;\nuniform sampler2D uPaperTex;\nuniform vec3 uGraphite;\nvarying float vPaint;',
    surface: /* glsl */ `
float mode = floor(vPaint + 0.5);
vec3 base = diffuseColor.rgb;
vec3 col = base;
SetTri t = setTriSetup(setP, setN, 24.0);
vec4 br = setTriSample(uBrushed, t);
float n1 = clayNoise3(setP * 1.7);
float n2 = clayNoise3(setP * 0.35 + 4.0);
if (mode < 0.5) {
  // Laca: casca de laranja (ondinhas de ~1 u) e escorrido suave; a tinta junta nas quinas (um pouco mais escura).
  col = base * (0.96 + 0.06 * n2);
  setObjN = normalize(setN + vec3(clayNoise3(setP * 2.3), clayNoise3(setP * 2.3 + 7.0), clayNoise3(setP * 2.3 + 13.0)) * 0.05);
  setRough += -0.15 + br.b * 0.1;
  setCoat = 1.0 - br.a * 0.3;
} else if (mode < 1.5) {
  // Grafite: riscos do apontador ao longo do eixo (X local) e brilho metálico fraco.
  float streak = clayNoise3(vec3(setP.x * 0.4, setP.y * 9.0, setP.z * 9.0)) * 0.5 + 0.5;
  col = uGraphite * (0.85 + 0.3 * streak);
  setMetal += 0.45;
  setRough += -0.08 + streak * 0.12;
  setCoat = 0.0;
  setObjN = normalize(setN + vec3(0.0, (streak - 0.5) * 0.3, 0.0));
} else if (mode < 2.5) {
  // Borracha: poros e grão fino, fosca; onde gasta (ruído largo) fica mais lisa e brilha um pouco.
  vec4 pp = texture(uPaperTex, setP.xy / 18.0 + setP.zx / 23.0);
  float worn = smoothstep(0.35, 0.8, n2 * 0.5 + 0.5);
  col = base * (0.9 + 0.12 * (pp.b - 0.5)) * (1.0 - worn * 0.06);
  setRough += 0.38 - worn * 0.25;
  setCoat = 0.0;
  setObjN = normalize(setN + vec3(pp.r - 0.5, pp.g - 0.5, n1 * 0.3) * 0.25 * (1.0 - worn));
} else {
  // Plástico brilhante (cabeça de alfinete): quase liso, clearcoat fraco, reflexo firme.
  col = base * (0.97 + 0.04 * n2);
  setRough += -0.32;
  setCoat = 0.4;
}
diffuseColor.rgb = col;
`,
  });
}

/**
 * Chão do estúdio: tinta de piso escura (fosca, gasta) com marcas de arrasto em arcos, restos de fita crepe velha e
 * poeira clara nos cantos (pelo ruído). `color` = a tinta.
 */
export function floorPaintMaterial(tex, { color = '#171210', residue = '#8C7D5A', name = 'chao-estudio' } = {}) {
  return createSetMaterial({
    name,
    params: { color: 0xffffff, roughness: 0.82, metalness: 0 },
    uniforms: {
      uMatWear: { value: tex.mat },
      uPaperTex: { value: tex.paper },
      uPaint: { value: linear(color) },
      uResidue: { value: linear(residue) },
    },
    light: { wrap: 0.2, lift: 0.04 },
    fragPars: 'uniform sampler2D uMatWear;\nuniform sampler2D uPaperTex;\nuniform vec3 uPaint;\nuniform vec3 uResidue;',
    surface: /* glsl */ `
vec2 q = setP.xz;
vec4 w = texture(uMatWear, q / 1400.0);
vec4 pp = texture(uPaperTex, q / 600.0);
float mottle = clayNoise3(vec3(q * 0.0011, 1.0)) * 0.5 + 0.5;
vec3 col = uPaint * (0.8 + 0.4 * mottle) * (0.92 + 0.16 * (pp.a - 0.5));
// Arrasto: arcos claros de cadeira e tripé (cortes do atlas do tapete, bem esticados).
float scuff = w.b * (0.5 + 0.5 * mottle);
col = mix(col, col * 1.9 + 0.012, scuff * 0.6);
// Restos de fita velha: retalhos retangulares amarelados aqui e ali.
vec2 cell = floor(q / 520.0);
vec2 f = q - (cell + 0.5) * 520.0;
float has = step(0.86, clayHash12(cell + 17.0));
float ang = clayHash12(cell + 23.0) * 3.14159;
vec2 rq = vec2(cos(ang) * f.x + sin(ang) * f.y, -sin(ang) * f.x + cos(ang) * f.y);
float tape = has * (1.0 - smoothstep(0.0, 1.5, max(abs(rq.x) - 60.0, abs(rq.y) - 19.0)));
col = mix(col, uResidue * (0.6 + 0.3 * pp.b), tape * 0.55);
// Poeira fina clara nas partes pouco pisadas.
float dust = smoothstep(0.55, 0.9, clayNoise3(vec3(q * 0.0045, 7.0)) * 0.5 + 0.5);
col = mix(col, vec3(0.08, 0.07, 0.06), dust * 0.35);
diffuseColor.rgb = col * diffuseColor.rgb;
setRough += dust * 0.1 - scuff * 0.15 - tape * 0.05;
mat3 tbn = setCotangentFrame(setN, setP, q / 1400.0);
setObjN = normalize(tbn * vec3((w.rg * 2.0 - 1.0) * 0.25, 1.0));
`,
  });
}
```


- [ ] **Passo 6: Papel no chão e decalques de atlas** (alpha test com cobertura: sem transparência, AO e profundidade de campo continuam certos).

```js file=src/clay/set/printMaterials.js
// Papel e desenhos do set (pista de testes; LDB9, TMA12, WRG4, COC4, CFO19 no item 11 do moodboard):
//  - paper: folhas no chão (papel kraft das faixas de bhop e das pegadas): fibras, manchas de tom, a cor de cada folha
//    vinda da cor da peça; uv em u. Deitado sobre o compensado: desloca a profundidade para não brigar com ele.
//  - decal: desenhos de um atlas RGBA do mapa (cor + cobertura), recortados por teste de alfa (sem transparência: AO
//    e profundidade de campo continuam certos; com MSAA, o alfa vira cobertura e a borda sai lisa). O atributo
//    aDecalKind escolhe o acabamento: 0 tinta (estêncil, faixas, alvos, estampas, marcador), 1 papel impresso
//    (transferidor, bandeirinha, planta, etiqueta), 2 grafite (anotações e riscos a lápis). aDecalRect = célula no atlas;
//    uv = 0..1 na célula. O atlas é DataTexture sem pré-multiplicação: a cor continua certa onde a cobertura é zero
//    (mipmaps sem franja escura).

import { createSetMaterial } from './setShader.js';

export function paperMaterial(tex, { name = 'papel' } = {}) {
  return createSetMaterial({
    name,
    params: { color: 0xffffff, roughness: 0.9, metalness: 0, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 },
    uniforms: { uPaperTex: { value: tex.paper }, uCrepe: { value: tex.crepe } },
    light: { wrap: 0.35, lift: 0.07, translucency: 0.2 },
    fragPars: 'uniform sampler2D uPaperTex;\nuniform sampler2D uCrepe;',
    surface: /* glsl */ `
vec4 pt = texture(uPaperTex, setUv / 170.0);
vec4 pt2 = texture(uPaperTex, setUv / 41.0 + 0.37);
float mottle = clayNoise3(vec3(setUv * 0.0035, 2.0)) * 0.5 + 0.5;
// Kraft de rolo: faixas largas de tom ao longo do comprimento (a bobina) e as fibras longas.
float band = clayNoise3(vec3(setUv.y * 0.012, 5.0, setUv.x * 0.0004)) * 0.5 + 0.5;
vec3 col = diffuseColor.rgb * (0.88 + 0.16 * mottle) * (0.96 + 0.08 * band);
col *= 1.0 + (pt.b - 0.5) * 0.4 + (pt2.b - 0.5) * 0.15;
col *= 0.96 + 0.08 * pt.a;
diffuseColor.rgb = col;
setRough += (pt.a - 0.5) * 0.08;
mat3 tbn = setCotangentFrame(setN, setP, setUv / 170.0);
setObjN = normalize(tbn * vec3((pt.rg * 2.0 - 1.0) * 0.35 + (pt2.rg * 2.0 - 1.0) * 0.12, 1.0));
`,
  });
}

export function decalMaterial(tex, { atlas, name = 'desenhos' }) {
  return createSetMaterial({
    name,
    params: {
      color: 0xffffff, roughness: 0.7, metalness: 0, alphaTest: 0.5, alphaToCoverage: true,
      polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -4,
    },
    uniforms: { uDecalAtlas: { value: atlas }, uPaperTex: { value: tex.paper } },
    light: { wrap: 0.3, lift: 0.07 },
    vertexPars: 'attribute vec4 aDecalRect;\nattribute float aDecalKind;\nvarying vec4 vDecalRect;\nvarying float vDecalKind;',
    vertex: 'vDecalRect = aDecalRect;\n  vDecalKind = aDecalKind;',
    fragPars: 'uniform sampler2D uDecalAtlas;\nuniform sampler2D uPaperTex;\nvarying vec4 vDecalRect;\nvarying float vDecalKind;',
    surface: /* glsl */ `
vec4 t = texture(uDecalAtlas, vDecalRect.xy + clamp(setUv, 0.0, 1.0) * vDecalRect.zw);
float kind = floor(vDecalKind + 0.5);
vec3 col = t.rgb;
vec4 pt = texture(uPaperTex, setP.xy / 60.0);
if (kind < 0.5) {
  // Tinta: camada fosca e fina sobre a superfície (o relevo de baixo quase não aparece por ela).
  col *= 0.97 + 0.06 * (pt.b - 0.5);
  setRough += 0.1 + (pt.a - 0.5) * 0.1;
} else if (kind < 1.5) {
  // Papel impresso: fibras no papel e a tinta de impressão um pouco mais lisa.
  float printed = 1.0 - smoothstep(0.55, 0.8, dot(col, vec3(0.3333)));
  col *= 0.95 + 0.1 * (pt.b - 0.5);
  setRough += 0.2 - printed * 0.15;
  mat3 tbn = setCotangentFrame(setN, setP, setP.xy / 60.0);
  setObjN = normalize(tbn * vec3((pt.rg * 2.0 - 1.0) * 0.3, 1.0));
} else {
  // Grafite: o traço brilha de leve contra a luz (metálico e liso).
  setMetal += 0.35;
  setRough += -0.3;
}
diffuseColor.rgb = col;
diffuseColor.a = t.a;
`,
  });
}
```


- [ ] **Passo 7: Papelão e fita** — papelão tingível por peça, papelão de uma face com as ondas à mostra (que somem suavemente de longe, sem moiré), tubo enrolado com a emenda helicoidal e fita crepe que lê etiquetas de um atlas do mapa.

```js file=src/clay/set/paperMaterials.js
// Papelão ondulado e fita crepe (docs/art/moodboard.md item 4: SSD4, SSD8, CSD16 / SSD2, SSD14).
//
// Papelão (simples, de parede dupla ou de uma face): a geometria (boardGeometry.js) manda o atributo aBoard =
// (x, y, tipo, através) e aBoardSize:
//   tipo 0 = face (x/y em u na placa)  · tipo 1 = corte transversal às flautas (mostra a onda do miolo)
//   tipo 2 = corte paralelo às flautas (lateral de um tubo). "através" vai de 0 a 1 de um forro ao outro.
//   tipo 3 = face de tubo enrolado em espiral (boardGeometry.woundTube): x = arco, y = altura, w = distância até a
//   borda; aBoardSize = (circunferência, passo da hélice).
// Face: fibras do kraft, pintas de reciclado, manchas, nervuras das flautas marcando o forro por baixo e
// borda gasta/escurecida pelo manuseio (placas recortadas mandam a distância até a borda pronta em aBoard.w, com
// aBoardSize negativo). Corte: forros claros, miolo ondulado e vãos escuros. A cor da peça tinge (lote do BatchedMesh).
//
// Fita crepe: uv em unidades de mundo (x ao longo, y através de 0 a largura). Rugas do crepe, poeira grudada
// na cola das bordas, leve translucidez (material fino) e rugosidade alta. Com `atlas` (a fita da pista, num lote só),
// a cor de cada tira vem da cor da peça e o texto de caneta das etiquetas vem por atributo (aTapeLabel = célula no
// atlas, aTapeBox = comprimento, largura, margem e altura do texto) — fitas e etiquetas no mesmo desenho.
// Lateral do rolo (TRL1, TRL4, TRL10): anéis de camadas pelo raio (a espessura do papel, 0,13 mm, some em
// sub-pixel e vira faixas de tensão do enrolamento), rolo levemente excêntrico, borda externa mais clara, cola
// amarelada e poeira grudada na cola exposta, relevo das camadas que "telescoparam".
// Etiqueta (SSD2, SSD14): a mesma fita com texto de caneta vindo de um atlas em canvas (src/clay/set/labelAtlas.js).

import * as THREE from 'three';
import { PALETTE } from '../../data/palette.js';
import { createSetMaterial } from './setShader.js';

const linear = (hex) => new THREE.Color(hex);

/**
 * Papelão ondulado. `double`: parede dupla (duas ondas e o forro do meio no corte — caixas grandes da cerca e painéis do
 * zigue-zague, COC4/CBT15). `singleFace`: papelão de uma face (CBT12, COC15) — o lado −Z da placa é o miolo ondulado
 * sem forro, com as ondas à mostra; no corte só o forro da frente.
 */
export function cardboardMaterial(tex, {
  color = PALETTE.cardboard, dark = '#3B2616', flutePitch = 4.2, double = false, singleFace = false, name = 'papelao',
} = {}) {
  const uniforms = {
    uPaper: { value: tex.paper },
    uKraft: { value: linear(color) },
    uKraftDark: { value: linear(dark) },
    uFlutePitch: { value: flutePitch },
    uPaperScale: { value: 120 },
    uDoubleWall: { value: double ? 1 : 0 },
    uSingleFace: { value: singleFace ? 1 : 0 },
  };
  return createSetMaterial({
    name,
    params: { color: 0xffffff, roughness: 0.86, metalness: 0 },
    uniforms,
    light: { wrap: 0.32, lift: 0.07 },
    vertexPars: 'attribute vec4 aBoard;\nattribute vec2 aBoardSize;\nvarying vec4 vBoard;\nvarying vec2 vBoardSize;',
    vertex: 'vBoard = aBoard;\n  vBoardSize = aBoardSize;',
    fragPars: /* glsl */ `
uniform sampler2D uPaper;
uniform vec3 uKraft;
uniform vec3 uKraftDark;
uniform float uFlutePitch;
uniform float uPaperScale;
uniform float uDoubleWall;
uniform float uSingleFace;
varying vec4 vBoard;
varying vec2 vBoardSize;
`,
    surface: /* glsl */ `
float kind = vBoard.z;
vec3 col = uKraft;
// Ondas de 4 u somem suavemente quando ficam menores que uns 4 px na tela (de longe viram moiré). Derivada fora dos
// ramos: o tipo muda de face para face.
float flutesAA = 1.0 - smoothstep(0.8, 2.2, fwidth(6.2831853 * vBoard.x / uFlutePitch));
if (kind < 0.5 || kind > 2.5) {
  // Face. Tipo 3 = tubo enrolado em espiral (woundTube): sem flautas, com a emenda helicoidal da tira de papel.
  bool wound = kind > 2.5;
  vec2 pc = vBoard.xy / uPaperScale;
  vec4 pt = texture(uPaper, pc);
  float fleck = pt.b - 0.5;
  float phase = 6.2831853 * vBoard.x / uFlutePitch;
  float ribs = wound ? 0.0 : flutesAA;
  mat3 tbn = setCotangentFrame(setN, setP, vBoard.xy);
  if (!wound && uSingleFace > 0.5 && setN.z < -0.5) {
    // Miolo à mostra: ondas altas, vales escuros (a luz não entra), papel do miolo mais cinza que o forro.
    float crest = mix(0.5, 0.5 + 0.5 * cos(phase), flutesAA);
    col = uKraft * vec3(0.92, 0.88, 0.82) * (0.58 + 0.42 * crest) * (0.92 + 0.18 * fleck);
    setRough += 0.05;
    setObjN = normalize(tbn * vec3(sin(phase) * 1.15 * flutesAA + (pt.r - 0.5) * 0.4, (pt.g - 0.5) * 0.4, 1.0));
  } else {
    col *= 0.88 + 0.22 * pt.a;
    col *= 1.0 + fleck * 0.45;
    // O forro afunda entre as cristas do miolo; poeira fica nos vales.
    col *= 1.0 - 0.04 * ribs * (0.5 + 0.5 * cos(phase));
    // Distância até a borda gasta: pelo retângulo da placa ou pronta no atributo (recortes e tubo: aBoardSize < 0).
    float e = (wound || vBoardSize.x < 0.0) ? vBoard.w
      : min(min(vBoard.x, vBoardSize.x - vBoard.x), min(vBoard.y, vBoardSize.y - vBoard.y));
    float worn = 1.0 - smoothstep(0.0, 7.0, e);
    col = mix(col, col * 0.74, worn * 0.55);
    setRough += worn * 0.08;
    vec2 d = (pt.rg * 2.0 - 1.0) * 0.55 + vec2(sin(phase) * 0.07 * ribs, 0.0);
    if (wound) {
      // Emenda: a borda da tira de cima assenta sobre a de baixo (degrau fino e um pouco mais escuro); cada volta de
      // papel com o seu tom (lotes de papel).
      float s = (vBoard.y - vBoard.x * vBoardSize.y / vBoardSize.x) / vBoardSize.y;
      float fs = fract(s);
      float gap = min(fs, 1.0 - fs) * vBoardSize.y;
      float fw = max(fwidth(gap), 1e-3);
      float seam = 1.0 - smoothstep(0.0, 0.7 + fw, gap);
      col *= (1.0 - seam * 0.25) * (1.0 + (clayHash12(vec2(floor(s + 0.5), 3.0)) - 0.5) * 0.07);
      d.y += seam * 0.7 * (fs < 0.5 ? 1.0 : -1.0);
      setRough += seam * 0.05;
    }
    setObjN = normalize(tbn * vec3(d, 1.0));
  }
} else {
  float a = vBoard.w;
  float s = vBoard.x;
  float thick = max(vBoardSize.x, 0.5);
  // Parede dupla: duas camadas de miolo (a de cima com a onda defasada) e o forro do meio.
  float cells = uDoubleWall > 0.5 ? 2.0 : 1.0;
  float aa = fract(a * cells - 1e-4);
  float layer = floor(a * cells - 1e-4);
  float liner = 0.11 * cells;
  float front = 1.0 - step(liner, aa) * step(aa, 1.0 - liner);
  // Uma face: só o forro da frente (através = 1); o de trás não existe.
  float linerMask = uSingleFace > 0.5 ? step(1.0 - liner, a) : front;
  vec4 pt = texture(uPaper, vec2(s, a * thick) / uPaperScale);
  if (kind < 1.5) {
    // Corte transversal: onda do miolo entre os forros.
    float wave = 0.5 + 0.34 * sin(6.2831853 * s / uFlutePitch + layer * 3.14159265);
    float dm = abs(aa - wave) * thick / cells;
    float medium = smoothstep(0.42, 0.18, dm);
    float paper = max(medium, linerMask);
    vec3 voidCol = uKraftDark * (0.45 + 0.9 * clamp(abs(aa - wave), 0.0, 0.5));
    col = mix(voidCol, uKraft * (0.98 + 0.12 * (pt.b - 0.5)), paper);
    setRough += (1.0 - paper) * 0.12;
    float slope = cos(6.2831853 * s / uFlutePitch + layer * 3.14159265) * 0.34 * 6.2831853 / uFlutePitch * thick / cells;
    vec3 tn = normalize(vec3(medium * slope * 0.25 * sign(aa - wave), 0.0, 1.0));
    mat3 tbn = setCotangentFrame(setN, setP, vec2(s, a * thick));
    setObjN = normalize(tbn * tn);
  } else {
    // Corte paralelo: lateral curva de um tubo do miolo entre os forros.
    float tube = sin(3.14159265 * clamp((aa - liner) / (1.0 - 2.0 * liner), 0.0, 1.0));
    col = mix(uKraftDark * (0.5 + 0.6 * tube), uKraft * (0.97 + 0.1 * (pt.b - 0.5)), linerMask);
    setRough += (1.0 - linerMask) * 0.1;
  }
}
// A cor da peça (branco sem lote; no BatchedMesh, o tom de cada caixa) tinge o papelão.
diffuseColor.rgb = col * diffuseColor.rgb;
`,
  });
}

const TAPE_SURFACE = /* glsl */ `
vec4 cr = texture(uCrepe, setUv / 30.0);
vec3 col = uTapeColor * (0.95 + 0.1 * (cr.b - 0.5) + 0.04 * (cr.a - 0.5));
float edge = min(setUv.y, uTapeWidth - setUv.y);
col *= 1.0 - 0.2 * (1.0 - smoothstep(0.0, 1.4, edge)); // poeira grudada na cola da borda
diffuseColor.rgb = col * diffuseColor.rgb;
setRough += (cr.b - 0.5) * 0.12;
mat3 tbn = setCotangentFrame(setN, setP, setUv);
setObjN = normalize(tbn * vec3((cr.rg * 2.0 - 1.0) * 0.9, 1.0));
`;

// Fita da pista (num lote só): largura, etiqueta e cor por tira. A amostra do atlas fica fora de desvio (derivadas
// do mipmap valem em todo o quadrado de pixels) e só conta dentro da caixa do texto.
const LABELED_TAPE_SURFACE = /* glsl */ `
vec4 cr = texture(uCrepe, setUv / 30.0);
vec3 col = uTapeColor * (0.95 + 0.1 * (cr.b - 0.5) + 0.04 * (cr.a - 0.5));
float edge = min(setUv.y, vTapeBox.y - setUv.y);
col *= 1.0 - 0.2 * (1.0 - smoothstep(0.0, 1.4, edge));
col *= diffuseColor.rgb;
vec2 box = vec2(max(vTapeBox.x - 2.0 * vTapeBox.z, 1e-3), max(vTapeBox.w, 1e-3));
vec2 q = vec2((setUv.x - vTapeBox.z) / box.x, (setUv.y - (vTapeBox.y - box.y) * 0.5) / box.y);
vec2 inside = step(vec2(0.0), q) * step(q, vec2(1.0));
float ink = texture(uLabelAtlas, vTapeLabel.xy + clamp(q, 0.0, 1.0) * vTapeLabel.zw).a;
ink *= inside.x * inside.y * step(1e-6, vTapeLabel.z);
// A tinta assenta nas cristas do crepe e falha um pouco nos vales; a caneta deixa o traço mais escuro e liso.
ink = clamp(ink * 1.35, 0.0, 1.0) * (0.86 + 0.14 * smoothstep(0.3, 0.7, cr.b));
diffuseColor.rgb = mix(col, uInk, ink * 0.96);
setRough += (cr.b - 0.5) * 0.12 - ink * 0.12;
mat3 tbn = setCotangentFrame(setN, setP, setUv);
setObjN = normalize(tbn * vec3((cr.rg * 2.0 - 1.0) * 0.9 * (1.0 - ink * 0.5), 1.0));
`;

/**
 * Fita crepe. Sem `atlas`: uma cor (`color`) e uma largura (`width`) para o material inteiro. Com `atlas` (o atlas de
 * etiquetas do mapa, labelAtlas.js): cor, largura e etiqueta por tira — a geometria traz aTapeLabel (célula do texto no
 * atlas, zeros = só fita) e aTapeBox (comprimento, largura, margem nas pontas, altura do texto) e a cor da peça pinta
 * a tira (`color` fica branco). Deitada sobre outras superfícies: desloca a profundidade para não brigar com elas.
 */
export function tapeMaterial(tex, { color = PALETTE.maskingTape, width = 46, atlas = null, ink = '#1C2238', name = 'fita-crepe' } = {}) {
  const uniforms = {
    uCrepe: { value: tex.crepe },
    uTapeColor: { value: linear(color) },
    uTapeWidth: { value: width },
  };
  const params = { color: 0xffffff, roughness: 0.74, metalness: 0, side: THREE.DoubleSide };
  if (atlas) {
    uniforms.uLabelAtlas = { value: atlas };
    uniforms.uInk = { value: linear(ink) };
    Object.assign(params, { polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -4 });
  }
  return createSetMaterial({
    name,
    params,
    uniforms,
    light: { wrap: 0.45, lift: 0.08, translucency: 0.4 },
    vertexPars: atlas ? 'attribute vec4 aTapeLabel;\nattribute vec4 aTapeBox;\nvarying vec4 vTapeLabel;\nvarying vec4 vTapeBox;' : '',
    vertex: atlas ? 'vTapeLabel = aTapeLabel;\n  vTapeBox = aTapeBox;' : '',
    fragPars: /* glsl */ `
uniform sampler2D uCrepe;
uniform vec3 uTapeColor;
uniform float uTapeWidth;
${atlas ? 'uniform sampler2D uLabelAtlas;\nuniform vec3 uInk;\nvarying vec4 vTapeLabel;\nvarying vec4 vTapeBox;' : ''}
`,
    surface: atlas ? LABELED_TAPE_SURFACE : TAPE_SURFACE,
  });
}

/**
 * Laterais de um rolo de fita (anéis de tapeRoll().sides, eixo Y no espaço do objeto).
 * @param {{inner:number, outer:number}} opts raio interno (onde a fita começa, fora do miolo) e externo, em u
 */
export function tapeSideMaterial(tex, { color = PALETTE.maskingTape, inner = 42, outer = 48, layer = 0.13, name = 'fita-lateral' } = {}) {
  const uniforms = {
    uCrepe: { value: tex.crepe },
    uPaper: { value: tex.paper },
    uTapeColor: { value: linear(color) },
    uRollInner: { value: inner },
    uRollOuter: { value: outer },
    uLayer: { value: layer },
  };
  return createSetMaterial({
    name,
    params: { color: 0xffffff, roughness: 0.8, metalness: 0 },
    uniforms,
    light: { wrap: 0.4, lift: 0.08 },
    fragPars: /* glsl */ `
uniform sampler2D uCrepe;
uniform sampler2D uPaper;
uniform vec3 uTapeColor;
uniform float uRollInner;
uniform float uRollOuter;
uniform float uLayer;
`,
    surface: /* glsl */ `
float ang = atan(setP.z, setP.x);
// Rolo levemente excêntrico (enrolado sob tensão variável): o raio "de camada" oscila com o ângulo.
float rr = length(setP.xz) + 0.35 * cos(ang - 1.3) + 0.12 * sin(2.0 * ang + 0.4);
float t = clamp((rr - uRollInner) / max(uRollOuter - uRollInner, 1e-3), 0.0, 1.0);
// Camadas individuais (0,13 mm): só aparecem de muito perto; somem suavemente quando ficam menores que o pixel.
float fwl = fwidth(rr) / uLayer;
float layers = (0.5 + 0.5 * cos(6.2831853 * rr / uLayer)) * (1.0 - smoothstep(0.25, 0.7, fwl));
// Faixas de tensão do enrolamento: grupos de camadas mais claros/escuros, concêntricos com leve variação angular.
float bands = clayNoise3(vec3(rr * 0.85, cos(ang) * 0.6, sin(ang) * 0.6)) * 0.6
            + clayNoise3(vec3(rr * 2.3, cos(ang) * 1.4, sin(ang) * 1.4 + 3.0)) * 0.4;
vec3 col = uTapeColor * vec3(0.92, 0.88, 0.8); // lateral: papel comprimido + cola amarelada
col *= 1.0 + bands * 0.07 - layers * 0.035;
// Primeiras voltas (junto do miolo) mais escuras e a última volta (borda de fora) mais clara e limpa.
col *= mix(0.86, 1.0, smoothstep(0.0, 0.12, t));
col = mix(col, uTapeColor * 1.04, smoothstep(0.93, 0.995, t) * 0.7);
// Poeira grudada na cola exposta: pontinhos e fiapos escuros (pintas do atlas de papel), mais densos para a
// borda de fora; a última volta, recém-desenrolada, está limpa.
vec4 cr = texture(uCrepe, setP.xz / 22.0 + vec2(0.37, 0.11));
vec4 pt = texture(uPaper, setP.xz / 30.0 + vec2(0.71, 0.53));
float dust = smoothstep(0.42, 0.18, pt.b) * (0.35 + 0.65 * t) * (1.0 - smoothstep(0.96, 1.0, t));
col *= 1.0 - dust * 0.45;
col *= 0.97 + 0.06 * (cr.b - 0.5);
diffuseColor.rgb = col;
setRough += dust * 0.08 - smoothstep(0.93, 0.995, t) * 0.06;
// Relevo das camadas que escorregaram (telescopagem): a normal inclina no sentido radial com a derivada das faixas.
vec2 radial = normalize(setP.xz + vec2(1e-4));
float slope = clayNoise3(vec3(rr * 0.85 + 0.05, cos(ang) * 0.6, sin(ang) * 0.6))
            - clayNoise3(vec3(rr * 0.85 - 0.05, cos(ang) * 0.6, sin(ang) * 0.6));
vec3 tilt = vec3(radial.x, 0.0, radial.y) * slope * 3.2;
setObjN = normalize(setN + tilt * sign(setN.y) + vec3((cr.r - 0.5) * 0.08, 0.0, (cr.g - 0.5) * 0.08));
`,
  });
}

/**
 * Etiqueta de fita crepe escrita a caneta. O texto vem de um atlas em canvas (labelAtlas.js); `rect` é a
 * célula da etiqueta no atlas (u0, v0, largura, altura em 0..1) e `length`/`width` o tamanho da tira em u.
 * O texto ocupa a tira inteira menos `margin` nas pontas, centrado na largura.
 */
export function tapeLabelMaterial(tex, {
  atlas, rect, length, width = 19, margin = 7, textHeight = 10.5, color = PALETTE.maskingTape, ink = '#1C2238', name = 'etiqueta',
}) {
  const uniforms = {
    uCrepe: { value: tex.crepe },
    uLabelAtlas: { value: atlas },
    uLabelRect: { value: new THREE.Vector4(rect[0], rect[1], rect[2], rect[3]) },
    uLabelSize: { value: new THREE.Vector4(length, width, margin, textHeight) },
    uTapeColor: { value: linear(color) },
    uInk: { value: linear(ink) },
  };
  return createSetMaterial({
    name,
    params: { color: 0xffffff, roughness: 0.74, metalness: 0, side: THREE.DoubleSide },
    uniforms,
    light: { wrap: 0.45, lift: 0.08, translucency: 0.4 },
    fragPars: /* glsl */ `
uniform sampler2D uCrepe;
uniform sampler2D uLabelAtlas;
uniform vec4 uLabelRect;
uniform vec4 uLabelSize;
uniform vec3 uTapeColor;
uniform vec3 uInk;
`,
    surface: /* glsl */ `
vec4 cr = texture(uCrepe, setUv / 30.0);
vec3 col = uTapeColor * (0.95 + 0.1 * (cr.b - 0.5) + 0.04 * (cr.a - 0.5));
float edge = min(setUv.y, uLabelSize.y - setUv.y);
col *= 1.0 - 0.2 * (1.0 - smoothstep(0.0, 1.4, edge));
// Texto: faixa central da tira com a altura do texto; fora dela, só fita.
vec2 box = vec2(uLabelSize.x - 2.0 * uLabelSize.z, uLabelSize.w);
vec2 q = vec2((setUv.x - uLabelSize.z) / box.x, (setUv.y - (uLabelSize.y - box.y) * 0.5) / box.y);
float ink = 0.0;
if (q.x > 0.0 && q.x < 1.0 && q.y > 0.0 && q.y < 1.0) {
  vec2 auv = uLabelRect.xy + q * uLabelRect.zw;
  ink = texture(uLabelAtlas, auv).a;
}
// A tinta assenta nas cristas do crepe e falha um pouco nos vales; a caneta deixa o traço mais escuro e liso.
ink = clamp(ink * 1.35, 0.0, 1.0) * (0.86 + 0.14 * smoothstep(0.3, 0.7, cr.b));
col = mix(col, uInk, ink * 0.96);
diffuseColor.rgb = col;
setRough += (cr.b - 0.5) * 0.12 - ink * 0.12;
mat3 tbn = setCotangentFrame(setN, setP, setUv);
setObjN = normalize(tbn * vec3((cr.rg * 2.0 - 1.0) * 0.9 * (1.0 - ink * 0.5), 1.0));
`,
  });
}
```


- [ ] **Passo 8: Madeiras** — faia (blocos), compensado de bétula (chapas, emendas, remendos, parafusos e riscos de lápis na base) e a balsa tingível.

```js file=src/clay/set/woodMaterials.js
// Madeiras do set (docs/art/moodboard.md item 4: CSD16; pista de testes no item 11).
//  - balsa: palitos e ripas claras de maquete, veio fino ao longo do eixo X da peça, pontas com o topo da
//    madeira (anéis e poros) e fibras levantadas (rugosa, macia). A cor da peça (lote do BatchedMesh) tinge: bambu do
//    espeto e cedro do lápis saem do mesmo material (BWM1, BWM14, PRU3).
//  - benchWood: tampo da bancada do animador (madeira mais escura, verniz gasto = clearcoat irregular,
//    manchas de uso e arranhões).
//  - beech: blocos de faia de brinquedo (AWB1, AWB4, AWB12, AWB17) — o shader da balsa com a cor, a escala e o acabamento
//    encerado da faia; cada bloco tingido pela cor da peça (tons variados de uma caixa de blocos).
//  - plywood: compensado de bétula (PKG3, PKG6, CFO11, CFR6): lâmina da face com veio largo e remendos ovais
//    ("barquinhos" de reparo da lâmina), lâminas alternadas nas bordas ao longo do Y local da peça (a espessura), linhas
//    de cola; na base da pista (`sheets`), as chapas de 2440 × 1220 com emendas, parafusos nas linhas dos caibros e
//    riscos de lápis de marcação.

import * as THREE from 'three';
import { PALETTE } from '../../data/palette.js';
import { createSetMaterial } from './setShader.js';

const linear = (hex) => new THREE.Color(hex);

const WOOD_GLSL = /* glsl */ `
uniform sampler2D uWood;
uniform vec3 uWoodLight;
uniform vec3 uWoodDark;
uniform float uWoodScale;
uniform float uRingFreq;
// Albedo e relevo da madeira: lateral (veio ao longo de X) nas projeções Y/Z, topo (anéis) na projeção X.
vec3 woodSurface(vec3 p, vec3 n, out vec3 objN, out float roughAdd) {
  SetTri t = setTriSetup(p, n, uWoodScale);
  vec4 side = texture(uWood, t.uvY) * t.w.y + texture(uWood, t.uvZ) * t.w.z;
  float sideW = t.w.y + t.w.z;
  side /= max(sideW, 1e-4);
  vec3 sideCol = mix(uWoodLight, uWoodDark, side.b * 0.75);
  sideCol *= 1.0 - side.a * 0.35;
  // Topo: anéis concêntricos em volta de um centro fora da peça (tábua serrada) + poros.
  vec2 e = p.zy + vec2(37.0, -21.0);
  float r = length(e) * uRingFreq + clayNoise3(vec3(p.zy * 0.08, 3.0)) * 1.4;
  float ring = pow(0.5 + 0.5 * cos(6.2831853 * r), 5.0);
  float pores = step(0.8, clayHash12(floor(p.zy * 1.8)));
  vec3 endCol = mix(uWoodLight * 0.92, uWoodDark, ring * 0.8) * (1.0 - pores * 0.25);
  vec3 col = mix(sideCol, endCol, t.w.x);
  roughAdd = t.w.x * 0.12 + side.a * 0.05;
  objN = setTriBump(uWood, t, n, 0.6);
  return col;
}
`;

// A cor da peça (material branco × cor do lote no BatchedMesh) tinge a madeira.
const TINTED_WOOD_SURFACE = /* glsl */ `
float ra;
vec3 bn;
diffuseColor.rgb = woodSurface(setP, setN, bn, ra) * diffuseColor.rgb;
setObjN = bn;
setRough += ra;
`;

export function balsaMaterial(tex, { light = '#E0CBA4', dark = '#BFA173', name = 'balsa' } = {}) {
  return createSetMaterial({
    name,
    params: { color: 0xffffff, roughness: 0.8, metalness: 0 },
    uniforms: {
      uWood: { value: tex.wood },
      uWoodLight: { value: linear(light) },
      uWoodDark: { value: linear(dark) },
      uWoodScale: { value: 70 },
      uRingFreq: { value: 0.35 },
    },
    light: { wrap: 0.35, lift: 0.07 },
    fragPars: WOOD_GLSL,
    surface: TINTED_WOOD_SURFACE,
  });
}

export function beechMaterial(tex, { light = '#E8CFA6', dark = '#C29A68', name = 'faia' } = {}) {
  return createSetMaterial({
    name,
    physical: true,
    params: { color: 0xffffff, roughness: 0.6, metalness: 0, clearcoat: 0.12, clearcoatRoughness: 0.55 },
    uniforms: {
      uWood: { value: tex.wood },
      uWoodLight: { value: linear(light) },
      uWoodDark: { value: linear(dark) },
      uWoodScale: { value: 110 },
      uRingFreq: { value: 0.22 },
    },
    light: { wrap: 0.3, lift: 0.07 },
    fragPars: WOOD_GLSL,
    surface: TINTED_WOOD_SURFACE,
  });
}

export function benchWoodMaterial(tex, { light = '#9C6A47', dark = PALETTE.wood, name = 'bancada' } = {}) {
  return createSetMaterial({
    name,
    physical: true,
    params: { color: 0xffffff, roughness: 0.58, metalness: 0, clearcoat: 0.35, clearcoatRoughness: 0.35 },
    uniforms: {
      uWood: { value: tex.wood },
      uWoodLight: { value: linear(light) },
      uWoodDark: { value: linear(dark) },
      uWoodScale: { value: 220 },
      uRingFreq: { value: 0.12 },
      uMatWear: { value: tex.mat },
    },
    light: { wrap: 0.25, lift: 0.06 },
    fragPars: `${WOOD_GLSL}\nuniform sampler2D uMatWear;`,
    surface: /* glsl */ `
float ra;
vec3 bn;
vec3 col = woodSurface(setP, setN, bn, ra);
// Verniz gasto: onde o tampo é mais usado o brilho some e a madeira escurece; arranhões claros.
vec4 wear = texture(uMatWear, setP.xz / 900.0);
float used = smoothstep(0.35, 0.8, wear.a);
col *= 1.0 - used * 0.12;
col = mix(col, col * 1.25, wear.b * 0.5);
diffuseColor.rgb = col;
setObjN = bn;
setRough += ra + used * 0.15 + wear.b * 0.1;
setCoat = 1.0 - used * 0.75 - wear.b * 0.5;
`,
  });
}

const PLYWOOD_GLSL = /* glsl */ `
uniform sampler2D uWood;
uniform vec3 uPlyLight;
uniform vec3 uPlyDark;
uniform vec3 uPlyCore;
uniform vec3 uPlyGlue;
uniform vec3 uPencil;
uniform float uPlyPitch;
uniform vec4 uSheet;      // largura e altura da chapa, origem (x, z) da primeira chapa
uniform float uSheetMode; // 1 = base: chapas, emendas, parafusos e riscos
uniform vec3 uJoist;      // espaçamento dos caibros, dos parafusos e o recuo da borda (u)
float plyLine(vec2 p, vec2 a, vec2 b, float w) {
  vec2 pa = p - a;
  vec2 ba = b - a;
  float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  float d = length(pa - ba * h);
  float fw = max(fwidth(d), 1e-4);
  return clamp((w - d) / fw + 0.5, 0.0, 1.0);
}
`;

/**
 * Compensado de bétula. `sheets` = [largura, altura] das chapas (só na base da pista, com `origin` = canto [x, z] da
 * primeira chapa no espaço da peça): liga emendas, tom por chapa, parafusos e riscos de lápis.
 */
export function plywoodMaterial(tex, {
  light = '#D9BC8F', dark = '#B48B5C', core = '#CDAE80', glue = '#8A6A45', pitch = 1.6, sheets = null, origin = [0, 0],
  name = 'compensado',
} = {}) {
  return createSetMaterial({
    name,
    params: { color: 0xffffff, roughness: 0.72, metalness: 0 },
    uniforms: {
      uWood: { value: tex.wood },
      uPlyLight: { value: linear(light) },
      uPlyDark: { value: linear(dark) },
      uPlyCore: { value: linear(core) },
      uPlyGlue: { value: linear(glue) },
      uPencil: { value: linear('#55575C') },
      uPlyPitch: { value: pitch },
      uSheet: { value: new THREE.Vector4(sheets?.[0] ?? 2440, sheets?.[1] ?? 1220, origin[0], origin[1]) },
      uSheetMode: { value: sheets ? 1 : 0 },
      uJoist: { value: new THREE.Vector3(406.4, 152.4, 12) },
    },
    light: { wrap: 0.3, lift: 0.07 },
    fragPars: PLYWOOD_GLSL,
    surface: /* glsl */ `
vec3 n = setN;
vec3 col;
if (abs(n.y) > 0.5) {
  // Face da lâmina: veio largo ao longo do X local; nas chapas da base, cada chapa com o seu começo de veio e tom.
  vec2 q = setP.xz;
  vec2 f = q;
  float seam = 0.0;
  float tone = 0.0;
  if (uSheetMode > 0.5) {
    vec2 g = (q - uSheet.zw) / uSheet.xy;
    vec2 cell = floor(g);
    f = fract(g) * uSheet.xy;
    vec2 edge = min(f, uSheet.xy - f);
    seam = 1.0 - smoothstep(0.35, 1.3, min(edge.x, edge.y));
    tone = clayHash12(cell + 7.0) - 0.5;
    q = f + cell * vec2(97.0, 57.0);
  }
  float warp = clayNoise3(vec3(q * vec2(0.0019, 0.007), 1.3)) * 2.4;
  vec4 w = texture(uWood, vec2(q.x / 540.0, q.y / 160.0 + warp * 0.06));
  float figure = clayNoise3(vec3(q.x * 0.0016, q.y * 0.021 + warp, 4.1)) * 0.5 + 0.5;
  col = mix(uPlyLight, uPlyDark, clamp(w.b * 0.55 + figure * 0.3, 0.0, 1.0));
  col *= (1.0 + tone * 0.1) * (1.0 - w.a * 0.12);
  // Remendos ovais da lâmina: elipse de tom um pouco diferente com o contorno fino do corte.
  vec2 pc = q / vec2(430.0, 170.0);
  vec2 pcell = floor(pc);
  float has = step(0.74, clayHash12(pcell + 3.1));
  vec2 pctr = (pcell + 0.3 + clayHash22(pcell) * 0.4) * vec2(430.0, 170.0);
  float pr = length((q - pctr) / vec2(36.0, 11.0));
  float inside = has * (1.0 - smoothstep(0.96, 1.0, pr));
  float outline = has * smoothstep(0.9, 0.97, pr) * (1.0 - smoothstep(1.0, 1.07, pr));
  col = mix(col, col * vec3(1.05, 1.02, 0.96), inside);
  col *= 1.0 - outline * 0.25;
  float graphite = 0.0;
  float screw = 0.0;
  if (uSheetMode > 0.5) {
    col *= 1.0 - seam * 0.6;
    // Parafusos: nas linhas dos caibros e a um recuo das bordas de cada chapa, um a cada uJoist.y.
    float jx = floor((f.x - uJoist.z) / uJoist.x + 0.5) * uJoist.x + uJoist.z;
    jx = clamp(jx, uJoist.z, uSheet.x - uJoist.z);
    float sz = (fract((f.y - uJoist.z) / uJoist.y + 0.5) - 0.5) * uJoist.y;
    vec2 sd = vec2(f.x - jx, sz);
    float sr = length(sd);
    screw = 1.0 - smoothstep(2.1, 2.5, sr);
    float slot = screw * (1.0 - smoothstep(0.25, 0.45, min(abs(sd.x), abs(sd.y)))) * step(sr, 1.8);
    float sink = smoothstep(2.1, 2.5, sr) * (1.0 - smoothstep(2.5, 3.1, sr));
    col = mix(col, vec3(0.34, 0.33, 0.31) * (0.9 + 0.2 * clayHash12(floor(f / 7.0))), screw);
    col *= 1.0 - slot * 0.6 - sink * 0.18;
    // Riscos de lápis: linha de cada caibro marcada a 9 u do parafuso e alguns "X" de marcação.
    graphite = max(graphite, plyLine(f, vec2(jx - 9.0, 20.0), vec2(jx - 9.0, uSheet.y - 20.0), 0.32)
      * step(0.35, clayHash12(vec2(floor(q.x / uJoist.x), 5.0))));
    vec2 xc = floor(f / 300.0);
    vec2 xo = (xc + 0.2 + clayHash22(xc + 11.0) * 0.6) * 300.0;
    float xmark = step(0.8, clayHash12(xc + 13.0));
    graphite = max(graphite, xmark * max(plyLine(f, xo - 7.0, xo + 7.0, 0.3), plyLine(f, xo + vec2(-7.0, 7.0), xo + vec2(7.0, -7.0), 0.3)));
    col = mix(col, uPencil, graphite * 0.7);
  }
  setRough += w.a * 0.06 - graphite * 0.3 - screw * 0.3;
  setMetal += screw * 0.6;
  mat3 tbn = setCotangentFrame(n, setP, q / 540.0);
  setObjN = normalize(tbn * vec3((w.rg * 2.0 - 1.0) * 0.35, 1.0));
} else {
  // Borda: lâminas alternadas (veio ao comprido e de topo) ao longo do Y local, com as linhas de cola.
  float yy = setP.y / uPlyPitch;
  float layer = floor(yy);
  float within = fract(yy);
  float crossed = mod(layer, 2.0);
  float along = dot(setP.xz, vec2(abs(n.z), abs(n.x)));
  float streak = clayNoise3(vec3(along * 0.09, layer * 3.1, 2.0)) * 0.5 + 0.5;
  float pore = step(0.8, clayHash12(floor(vec2(along * 1.3, yy * 3.0)) + layer));
  col = mix(uPlyCore * (0.9 + 0.16 * streak), uPlyCore * 0.8 * (1.0 - pore * 0.3), crossed);
  float glue = 1.0 - smoothstep(0.0, 0.1, min(within, 1.0 - within));
  col = mix(col, uPlyGlue, glue * 0.55);
  setRough += crossed * 0.1;
  setObjN = normalize(n + vec3(0.0, (streak - 0.5) * 0.15 * (1.0 - crossed), 0.0));
}
diffuseColor.rgb = col * diffuseColor.rgb;
`,
  });
}
```


- [ ] **Passo 9: Letra à mão reaproveitável** (planta, notas e placas desenham com a mesma caneta das etiquetas).

```js file=src/clay/set/labelAtlas.js
// Atlas de texto das etiquetas de fita crepe (vitrine, depois placas e letreiros de mapa): cada etiqueta é uma
// linha escrita "à mão" com caneta — letra a letra, com leve giro, variação de linha de base e de tamanho, como
// no rótulo feito com fita e marcador na bancada do animador (SSD2, SSD14). Gerado em canvas no carregamento
// (fonte do sistema como base; nada é baixado). O material que lê o atlas é tapeLabelMaterial (paperMaterials.js).

import * as THREE from 'three';
import { RNG } from '../../core/rng.js';

/**
 * Layout puro (sem DOM): células de altura fixa em `columns` colunas, linha a linha, dentro de `width` px.
 * @param {number} count número de etiquetas
 * @param {{width:number, cellHeight:number, columns:number}} opts
 * @returns {{width:number, height:number, cells:Array<{x:number, y:number, w:number, h:number}>}} altura em
 *   potência de dois (mipmaps completos) e células em px com a origem no canto de cima do canvas
 */
export function layoutLabelCells(count, { width, cellHeight, columns }) {
  if (!(count >= 0 && Number.isInteger(count))) throw new Error(`número de etiquetas inválido: ${count}`);
  if (!(columns >= 1 && width >= columns && cellHeight >= 1)) throw new Error('layout de etiquetas inválido');
  const cellW = Math.floor(width / columns);
  const rows = Math.max(1, Math.ceil(count / columns));
  const needed = rows * cellHeight;
  const height = 2 ** Math.ceil(Math.log2(Math.max(needed, 1)));
  const cells = [];
  for (let i = 0; i < count; i++) {
    const col = i % columns;
    const row = Math.floor(i / columns);
    cells.push({ x: col * cellW, y: row * cellHeight, w: cellW, h: cellHeight });
  }
  return { width, height, cells };
}

/**
 * Retângulo da parte escrita de uma célula em coordenadas de textura (0..1, com flipY do CanvasTexture: v = 0
 * embaixo). `textWidth` em px (a largura realmente ocupada pelo texto, a partir da borda esquerda da célula).
 * @returns {[number, number, number, number]} u0, v0, largura, altura
 */
export function labelRect(cell, textWidth, atlasWidth, atlasHeight) {
  const w = Math.min(textWidth, cell.w);
  return [cell.x / atlasWidth, 1 - (cell.y + cell.h) / atlasHeight, w / atlasWidth, cell.h / atlasHeight];
}

/**
 * Escreve `text` "à mão" num contexto 2D: letra a letra, com giro, variação de linha de base, de tamanho e de
 * espaçamento, e o traço engrossado de caneta de ponta redonda (contorno + preenchimento). `font` com "{px}" no lugar
 * do tamanho. Usa a cor/estilo atuais do contexto. Devolve o x depois da última letra.
 * @param {CanvasRenderingContext2D} g
 * @param {{x:number, baseline:number, size:number, font:string, rng:RNG, stroke?:number, wobble?:number}} opts
 */
export function drawHandwriting(g, text, { x, baseline, size, font, rng, stroke = 0.085, wobble = 1 }) {
  let cx = x;
  g.save();
  g.textAlign = 'left';
  g.textBaseline = 'alphabetic';
  g.lineJoin = 'round';
  g.lineCap = 'round';
  for (const ch of text) {
    const s = size * rng.float(1 - 0.07 * wobble, 1 + 0.07 * wobble);
    g.font = font.replace('{px}', String(Math.round(s)));
    const adv = g.measureText(ch).width;
    g.save();
    g.translate(cx + adv / 2, baseline + rng.float(-0.035, 0.035) * wobble * size);
    g.rotate(rng.float(-0.06, 0.06) * wobble);
    g.globalAlpha = rng.float(0.9, 1);
    g.lineWidth = s * stroke;
    if (stroke > 0) g.strokeText(ch, -adv / 2, 0);
    g.fillText(ch, -adv / 2, 0);
    g.restore();
    cx += adv * rng.float(0.98, 1.04);
  }
  g.restore();
  return cx;
}

/** Largura natural (sem tremor) de `text` na fonte `font` de tamanho `px`, com folga de 4%. */
export function handwritingWidth(g, text, font, px) {
  g.font = font.replace('{px}', String(px));
  return [...text].reduce((w, ch) => w + g.measureText(ch).width, 0) * 1.04;
}

/**
 * Desenha as etiquetas e devolve o atlas.
 * @param {string[]} texts
 * @param {{width:number, cellHeight:number, columns:number, font:string, seed?:string, anisotropy?:number}} opts
 *   `font` com "{px}" no lugar do tamanho (ex.: '700 {px}px "Segoe Print", cursive')
 * @returns {{texture: THREE.CanvasTexture, labels: Array<{text:string, rect:number[], aspect:number}>, dispose(): void}}
 *   `aspect` = largura/altura da parte escrita (a tira da etiqueta usa para calcular o comprimento)
 */
export function bakeLabelAtlas(texts, { width, cellHeight, columns, font, seed = 'etiquetas', anisotropy = 8 }) {
  const layout = layoutLabelCells(texts.length, { width, cellHeight, columns });
  const canvas = document.createElement('canvas');
  canvas.width = layout.width;
  canvas.height = layout.height;
  const g = canvas.getContext('2d');
  g.clearRect(0, 0, canvas.width, canvas.height);
  g.fillStyle = '#ffffff';
  g.strokeStyle = '#ffffff';
  g.lineJoin = 'round';
  g.lineCap = 'round';
  g.textBaseline = 'alphabetic';
  const px = Math.round(cellHeight * 0.66);
  const baseFont = font.replace('{px}', String(px));
  g.font = baseFont;
  const labels = texts.map((text, i) => {
    const cell = layout.cells[i];
    const rng = new RNG(`${seed}:${i}:${text}`);
    // Medida sem jitter para decidir a escala (texto longo encolhe para caber na célula, com folga de 4%).
    const natural = handwritingWidth(g, text, font, px) + px * 0.2;
    const fit = Math.min(1, (cell.w - 8) / Math.max(natural, 1));
    const size = Math.max(10, Math.round(px * fit));
    const baseline = cell.y + cell.h * 0.74;
    // Caneta permanente de ponta redonda: o traço da fonte engrossa com um contorno redondo (a tinta espalha no crepe)
    // e a pressão varia um pouco de letra para letra.
    const x = drawHandwriting(g, text, { x: cell.x + size * 0.12, baseline, size, font, rng });
    const textWidth = Math.min(cell.w, x - cell.x + size * 0.12);
    return { text, rect: labelRect(cell, textWidth, layout.width, layout.height), aspect: textWidth / cell.h };
  });
  const texture = new THREE.CanvasTexture(canvas);
  texture.name = 'massacre.set.etiquetas';
  texture.colorSpace = THREE.NoColorSpace; // só o alfa (cobertura da tinta) é lido
  texture.anisotropy = anisotropy;
  texture.generateMipmaps = true;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.needsUpdate = true;
  return {
    texture,
    labels,
    dispose() {
      texture.dispose();
      canvas.width = canvas.height = 0;
    },
  };
}
```


- [ ] **Passo 10: Fábricas novas na biblioteca do set**


Em `src/clay/set/index.js`, trocar:

```
// Mapas pedem materiais aqui: set.cardboard(), set.tape({ width }), set.cuttingMat({ size }), ...

```

por:

```
// Mapas pedem materiais aqui: set.cardboard(), set.tape({ width }), set.cuttingMat({ size }), ...
// Materiais que leem um atlas do próprio mapa (livros, desenhos, fita com etiquetas) são criados pelo mapa com as
// fábricas de bookMaterial.js, printMaterials.js e paperMaterials.js e entram na biblioteca por adopt().

```

Em `src/clay/set/index.js`, trocar:

```
import { balsaMaterial, benchWoodMaterial } from './woodMaterials.js';
import { cuttingMatMaterial, plasticMaterial, fabricMaterial, diffuserMaterial } from './surfaceMaterials.js';
```

por:

```
import { balsaMaterial, beechMaterial, benchWoodMaterial, plywoodMaterial } from './woodMaterials.js';
import { cuttingMatMaterial, plasticMaterial, fabricMaterial, diffuserMaterial } from './surfaceMaterials.js';
import { measureMaterial } from './measureMaterials.js';
import { paperMaterial } from './printMaterials.js';
import { paintMaterial, floorPaintMaterial } from './paintMaterials.js';
```

Em `src/clay/set/index.js`, trocar:

```
  balsa: balsaMaterial,
  benchWood: benchWoodMaterial,
```

por:

```
  balsa: balsaMaterial,
  beech: beechMaterial,
  plywood: plywoodMaterial,
  benchWood: benchWoodMaterial,
```

Em `src/clay/set/index.js`, trocar:

```
  diffuser: diffuserMaterial,
});
```

por:

```
  diffuser: diffuserMaterial,
  measure: measureMaterial,
  paper: paperMaterial,
  paint: paintMaterial,
  floorPaint: floorPaintMaterial,
});
```


- [ ] **Passo 11: Canal de impressão do ClayMaterial** — textura com R = fundo da marca, G = lábio de massa empurrada e B = marcas do rolo, mapeada pelo XZ do objeto; desloca a normal, escurece e alisa o fundo. `setImprint` troca os valores nos mesmos objetos de uniform (a 3.5 põe as pegadas assim, sem recompilar).


Em `src/clay/ClayMaterial.js`, trocar:

```
//  - Skins procedurais (src/data/claySkins.js) por define.

```

por:

```
//  - Skins procedurais (src/data/claySkins.js) por define.
//  - Impressão (opcional, define CLAY_IMPRINT): textura de relevo na face de cima — R = fundo da marca, G = lábio de
//    massa empurrada, B = marcas do rolo — mapeada pelo XZ do objeto; desloca a normal (4 amostras) e escurece e alisa o
//    fundo. Letras carimbadas e furinhos das placas da pista (3.3); as pegadas da 3.5 vêm pelo mesmo caminho.

```

Em `src/clay/ClayMaterial.js`, trocar:

```
uniform vec4 uClayProbe;
${objectSpaceVaryings('Clay')}
```

por:

```
uniform vec4 uClayProbe;
#ifdef CLAY_IMPRINT
uniform sampler2D uClayImprint;
uniform vec4 uClayImprintRect;
uniform vec3 uClayImprintDepth;
uniform vec2 uClayImprintTexel;
#endif
float clayImprintMask = 0.0;
${objectSpaceVaryings('Clay')}
```

Em `src/clay/ClayMaterial.js`, trocar:

```
  diffuseColor.rgb *= 1.0 - dust * uClayLint * 0.6;
}
`;

```

por:

```
  diffuseColor.rgb *= 1.0 - dust * uClayLint * 0.6;
}
#ifdef CLAY_IMPRINT
{
  // uv da impressão pelo XZ do objeto (retângulo com largura negativa = espelhado); só a face de cima recebe.
  vec2 iuv = (vClayPos.xz - uClayImprintRect.xy) / uClayImprintRect.zw;
  float top = smoothstep(0.6, 0.9, clayN.y) * step(0.0, iuv.x) * step(iuv.x, 1.0) * step(0.0, iuv.y) * step(iuv.y, 1.0);
  vec3 hw = vec3(-uClayImprintDepth.x, uClayImprintDepth.y, uClayImprintDepth.z);
  vec2 tx = uClayImprintTexel;
  vec4 c0 = texture(uClayImprint, iuv);
  float hL = dot(texture(uClayImprint, iuv - vec2(tx.x, 0.0)).rgb, hw);
  float hR = dot(texture(uClayImprint, iuv + vec2(tx.x, 0.0)).rgb, hw);
  float hD = dot(texture(uClayImprint, iuv - vec2(0.0, tx.y)).rgb, hw);
  float hU = dot(texture(uClayImprint, iuv + vec2(0.0, tx.y)).rgb, hw);
  // Diferença central em u do objeto (o sinal do retângulo cuida do espelhamento).
  float dhdx = (hR - hL) / (2.0 * uClayImprintRect.z * tx.x);
  float dhdz = (hU - hD) / (2.0 * uClayImprintRect.w * tx.y);
  clayObjN = normalize(clayObjN + vec3(-dhdx, 0.0, -dhdz) * top);
  // Fundo da marca: massa comprimida, mais escura e mais lisa (o carimbo alisa); o lábio pega mais luz.
  clayImprintMask = c0.r * top;
  diffuseColor.rgb = mix(diffuseColor.rgb, clayDeepen(diffuseColor.rgb), clayImprintMask * 0.35);
  diffuseColor.rgb *= 1.0 + c0.g * top * 0.04;
}
#endif
`;

```

Em `src/clay/ClayMaterial.js`, trocar:

```
roughnessFactor = mix(roughnessFactor, 0.16, claySkinFlake);
`;
```

por:

```
roughnessFactor = mix(roughnessFactor, 0.16, claySkinFlake);
roughnessFactor = clamp(roughnessFactor - clayImprintMask * 0.18, 0.2, 1.0);
`;
```

Em `src/clay/ClayMaterial.js`, trocar:

```
#if defined(CLAY_FINGERPRINTS) || CLAY_SKIN == 2
```

por:

```
#if defined(CLAY_FINGERPRINTS) || CLAY_SKIN == 2 || defined(CLAY_IMPRINT)
```

Em `src/clay/ClayMaterial.js`, trocar:

```
  seed: null,
});
```

por:

```
  seed: null,
  // { map: Texture, rect: [x0, z0, largura, profundidade] no XZ do objeto, depth, lip, roller (u) } ou null
  imprint: null,
});
```

Em `src/clay/ClayMaterial.js`, trocar:

```
    this.customProgramCacheKey = () =>
      `clay:${this.skinId}:${clayFlags.fingerprints ? 1 : 0}:${clayFlags.boil ? 1 : 0}:${clayFlags.blackProbe ? 1 : 0}`;
```

por:

```
    this.clayImprint = false;
    if (p.imprint) this.setImprint(p.imprint);
    this.customProgramCacheKey = () =>
      `clay:${this.skinId}:${clayFlags.fingerprints ? 1 : 0}:${clayFlags.boil ? 1 : 0}:${clayFlags.blackProbe ? 1 : 0}:${this.clayImprint ? 1 : 0}`;
```

Em `src/clay/ClayMaterial.js`, trocar:

```
    if (clayFlags.blackProbe) shader.defines.CLAY_BLACK_PROBE = '';
    shader.vertexShader = shader.vertexShader
```

por:

```
    if (clayFlags.blackProbe) shader.defines.CLAY_BLACK_PROBE = '';
    if (this.clayImprint) shader.defines.CLAY_IMPRINT = '';
    shader.vertexShader = shader.vertexShader
```

Em `src/clay/ClayMaterial.js`, trocar:

```
    this.clayUniforms.uClayBoilFreq.value = 2.2 / r;
    return this;
```

por:

```
    this.clayUniforms.uClayBoilFreq.value = 2.2 / r;
    return this;
  }

  /**
   * Liga (ou troca) a impressão: `map` com R = fundo, G = lábio, B = rolo; `rect` = [x0, z0, largura, profundidade] no XZ
   * do objeto (largura negativa espelha); `depth`/`lip`/`roller` em u. A textura é de quem chama (o mapa a libera).
   */
  setImprint({ map, rect, depth = 1.6, lip = 0.35, roller = 0.08 }) {
    const had = this.clayImprint;
    const u = this.clayUniforms;
    // Os objetos de uniform são os mesmos que o programa compilado lê: troca só o valor.
    if (!u.uClayImprint) {
      u.uClayImprint = { value: null };
      u.uClayImprintRect = { value: new THREE.Vector4() };
      u.uClayImprintDepth = { value: new THREE.Vector3() };
      u.uClayImprintTexel = { value: new THREE.Vector2() };
    }
    const img = map.image;
    u.uClayImprint.value = map;
    u.uClayImprintRect.value.set(rect[0], rect[1], rect[2], rect[3]);
    u.uClayImprintDepth.value.set(depth, lip, roller);
    u.uClayImprintTexel.value.set(1 / (img?.width ?? 512), 1 / (img?.height ?? 512));
    this.clay.imprint = { map, rect: [...rect], depth, lip, roller };
    this.clayImprint = true;
    if (!had) this.needsUpdate = true;
    return this;
```

Em `src/clay/ClayMaterial.js`, trocar:

```
        this.clayUniforms[k] = { value: u.value?.clone ? u.value.clone() : u.value };
      }
```

por:

```
        // Texturas são compartilhadas (a impressão é do mapa); vetores e cores, copiados.
        this.clayUniforms[k] = { value: u.value?.isTexture ? u.value : u.value?.clone ? u.value.clone() : u.value };
      }
      this.clayImprint = source.clayImprint;
```


- [ ] **Passo 12: Rodar e ver passar**

Run: `node --test tests/pistaMaterials.test.js`
Expected: PASS (3 testes).


- [ ] **Passo 13: Suíte inteira**

Run: `npm test`
Expected: 207 testes passando (o teste da vitrine continua lendo `layoutLabelCells`/`labelRect`).


- [ ] **Commit (só quando o usuário pedir)**

```bash
git add src/clay tests/pistaMaterials.test.js
git commit -m "feat(fase-3.3): materiais do set da pista e impressão na massinha" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```


---

### Tarefa 5: Visual da pista

**Files:**
- Create: `src/maps/pista/visual/common.js`, `src/maps/pista/visual/floor.js`, `src/maps/pista/visual/books.js`, `src/maps/pista/visual/wood.js`, `src/maps/pista/visual/cardboard.js`, `src/maps/pista/visual/art.js`, `src/maps/pista/visual/plan.js`, `src/maps/pista/visual/extras.js`, `src/maps/pista/visual/clayPlates.js`, `src/maps/pista/visual/index.js`

O visual lê o mesmo layout da colisão. Os desenhos em canvas (etiquetas, lombadas, estampas, estêncil, alvos, transferidores, placas, planta) só existem no navegador, então esta tarefa não tem teste do Node: a conferência é a sintaxe, a carga dos módulos e a rotina da Tarefa 8.

- [ ] **Passo 1: Ajudantes comuns** (matrizes locais, malha própria, atributo constante, faces da plaquinha em "A", tom do papelão).

```js file=src/maps/pista/visual/common.js
// Ajudantes comuns dos visuais da pista: matrizes locais sobre a matriz da peça, malhas soltas fixas, atributos
// constantes e o tom de cada peça de papelão.

import * as THREE from 'three';

const _m = new THREE.Matrix4();

/** Matriz da peça × matriz local (a geometria montada no quadro canônico do visual). */
export function withLocal(pieceMatrix, local) {
  return pieceMatrix.clone().multiply(local);
}

/** Translação local. */
export function offset(x, y, z) {
  return new THREE.Matrix4().makeTranslation(x, y, z);
}

/** Giro local em Y (radianos) seguido de translação. */
export function turnY(angle, x = 0, y = 0, z = 0) {
  return _m.makeRotationY(angle).setPosition(x, y, z).clone();
}

/** Malha estática com a matriz dada (sem recalcular posição/rotação a cada quadro). */
export function placeMesh(mesh, matrix, { castShadow = true, receiveShadow = true, name = '' } = {}) {
  mesh.matrixAutoUpdate = false;
  mesh.matrix.copy(matrix);
  mesh.castShadow = castShadow;
  mesh.receiveShadow = receiveShadow;
  if (name) mesh.name = name;
  return mesh;
}

/** Atributo constante em todos os vértices (em lotes, o valor da peça inteira). */
export function constantAttribute(geo, name, values) {
  const n = geo.attributes.position.count;
  const arr = new Float32Array(n * values.length);
  for (let i = 0; i < n; i++) arr.set(values, i * values.length);
  geo.setAttribute(name, new THREE.BufferAttribute(arr, values.length));
  return geo;
}

/**
 * Faces de fora da plaquinha em "A" [w, h, d] (cumeeira em z = 0, base de −d/2 a d/2), no quadro da peça: para cada
 * lado, a matriz do centro da face (X para a direita de quem olha a face, Y subindo até a cumeeira, Z para fora), o
 * comprimento da rampa e o lado (−1 frente, +1 trás).
 */
export function tentFaces([w, h, d]) {
  const half = d / 2;
  const slope = Math.hypot(half, h);
  return [-1, 1].map((side) => {
    const up = new THREE.Vector3(0, h, -side * half).normalize();
    const out = new THREE.Vector3(0, half, side * h).normalize();
    const right = new THREE.Vector3().crossVectors(up, out);
    const center = new THREE.Vector3(0, h / 2, (side * half) / 2);
    const matrix = new THREE.Matrix4().makeBasis(right, up, out).setPosition(center);
    return { matrix, width: w, slope, side, out };
  });
}

/** Tom de uma peça de papelão (cinza levemente quente ou frio, entre os limites do dado). */
export function cardboardTone(rng, [lo, hi]) {
  const v = rng.float(lo, hi);
  const w = rng.float(-0.025, 0.025);
  return [v + w, v, v - w * 1.2];
}
```


- [ ] **Passo 2: Chão e papéis** — base de compensado, chão pintado do estúdio, tapetes de corte, papel quadriculado, kraft, fitas dos lotes com as etiquetas escritas à mão, fitas das emendas e as fitas dobradas no pé das paredes soltas.

```js file=src/maps/pista/visual/floor.js
// Chão da pista de testes (item 11 do moodboard: PKG3/PKG6 compensado da base, DFL1/DFL5/LDB15 lotes e fitas, LDB9
// quadriculado, TMA12 kraft): o compensado da base com as chapas, o chão do estúdio, os tapetes de corte dos lotes, os
// papéis (quadriculado da estação 1 no lote das medidas, kraft da bhop e das pegadas) e todas as fitas crepe num lote
// só — contornos dos lotes, folhas presas, emendas da cerca, largada e chegada, pés das paredes soltas — com as
// etiquetas escritas à mão (atlas de etiquetas do mapa, lido pela fita por atributo).

import * as THREE from 'three';
import { RNG } from '../../../core/rng.js';
import { createNoise3 } from '../../../clay/kit/cpuNoise.js';
import { tapeStrip } from '../../../clay/set/propGeometry.js';
import { bakeLabelAtlas } from '../../../clay/set/labelAtlas.js';
import { tapeMaterial } from '../../../clay/set/paperMaterials.js';
import { basisMatrix } from '../pieces.js';
import { constantAttribute, placeMesh } from './common.js';

/**
 * Folha deitada no quadro da peça (caixa [w, h, d] centrada): topo em grade com ondulação para baixo (nunca acima do
 * topo da colisão) e a saia da borda até o fundo. uv em u a partir do canto sudoeste (x a leste, y a norte).
 */
function sheetGeometry(w, h, d, { seed, wave = 0.12, step = 40 }) {
  const noise = createNoise3(new RNG(`folha:${seed}`).nextU32());
  const nx = Math.max(2, Math.ceil(w / step));
  const nz = Math.max(2, Math.ceil(d / step));
  const top = h / 2;
  const y = (x, z) => top - wave * (0.5 + 0.5 * noise.noise(x * 0.004, z * 0.004, 3.3)) - wave * 0.4 * Math.max(0, noise.noise(x * 0.02, z * 0.02, 9.1));
  const pos = [];
  const uv = [];
  const index = [];
  for (let j = 0; j <= nz; j++) {
    for (let i = 0; i <= nx; i++) {
      const x = -w / 2 + (w * i) / nx;
      const z = -d / 2 + (d * j) / nz;
      pos.push(x, y(x, z), z);
      uv.push(x + w / 2, d / 2 - z);
    }
  }
  for (let j = 0; j < nz; j++) {
    for (let i = 0; i < nx; i++) {
      const a = j * (nx + 1) + i;
      // Normal +Y: (a, a + nx + 1, a + 1) gira de +X para +Z visto de cima.
      index.push(a, a + nx + 1, a + 1, a + 1, a + nx + 1, a + nx + 2);
    }
  }
  // Saia: da borda do topo até o fundo, com a normal para fora.
  const ring = [];
  for (let i = 0; i <= nx; i++) ring.push([-w / 2 + (w * i) / nx, -d / 2]);
  for (let j = 1; j <= nz; j++) ring.push([w / 2, -d / 2 + (d * j) / nz]);
  for (let i = nx - 1; i >= 0; i--) ring.push([-w / 2 + (w * i) / nx, d / 2]);
  for (let j = nz - 1; j >= 1; j--) ring.push([-w / 2, -d / 2 + (d * j) / nz]);
  const base = pos.length / 3;
  for (const [x, z] of ring) {
    pos.push(x, y(x, z), z, x, -h / 2, z);
    uv.push(x + w / 2, d / 2 - z, x + w / 2, d / 2 - z);
  }
  for (let k = 0; k < ring.length; k++) {
    const a = base + k * 2;
    const b = base + ((k + 1) % ring.length) * 2;
    // Contorno anti-horário visto de cima (−Z → +X → +Z): a direita do trecho é o lado de fora.
    index.push(a, b, a + 1, b, b + 1, a + 1);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(index);
  geo.computeVertexNormals();
  return geo;
}

/** Tapete de corte (caixa [w, 3, d]) com uv 0..1 no topo a partir do canto sudoeste; nas laterais, a margem lisa. */
function matGeometry(w, h, d) {
  const geo = new THREE.BoxGeometry(w, h, d);
  const p = geo.attributes.position;
  const n = geo.attributes.normal;
  const uv = geo.attributes.uv;
  for (let i = 0; i < p.count; i++) {
    if (n.getY(i) > 0.5) uv.setXY(i, (p.getX(i) + w / 2) / w, (d / 2 - p.getZ(i)) / d);
    else uv.setXY(i, 0.002, 0.002);
  }
  return geo;
}

/** Fita com os atributos da fita da pista (etiqueta: célula do texto; sem etiqueta, zeros). */
function tapeGeometry(length, width, { seed, lift = 0, rect = null, margin = 0, textHeight = 0 }) {
  const step = Math.max(4, Math.min(40, length / 30));
  const geo = tapeStrip(length, width, { seed, lift, step });
  constantAttribute(geo, 'aTapeLabel', rect ?? [0, 0, 0, 0]);
  constantAttribute(geo, 'aTapeBox', [length, width, margin, textHeight]);
  return geo;
}

/**
 * Fita dobrada no pé de uma parede solta: `fold` u sobem pela face (x = 0 é a face, +X para fora, +Y para cima, Z ao
 * longo da parede) e o resto deita no chão, com a dobra arredondada.
 */
function footTapeGeometry(length, width, fold, seed) {
  const geo = tapeGeometry(length, width, { seed });
  const p = geo.attributes.position;
  const r = 1.4;
  const vertical = fold - r;
  const arc = (Math.PI / 2) * r;
  for (let i = 0; i < p.count; i++) {
    const s = p.getX(i) + length / 2;
    const q = -p.getY(i); // através invertido: a face da tira fica para fora
    const off = 0.12 + Math.max(p.getZ(i), 0);
    let x;
    let y;
    if (s <= vertical) {
      x = off;
      y = fold - s;
    } else if (s <= vertical + arc) {
      const a = Math.PI + ((s - vertical) / arc) * (Math.PI / 2);
      x = r + Math.cos(a) * (r - off);
      y = r + Math.sin(a) * (r - off);
    } else {
      x = r + (s - vertical - arc);
      y = off;
    }
    p.setXYZ(i, x, y, q);
  }
  geo.computeVertexNormals();
  return geo;
}

export function buildFloor(ctx) {
  const { layout, data, set, batches, group, disposers, anisotropy } = ctx;
  const look = data.look;
  const byId = new Map(layout.pieces.map((p) => [p.id, p]));

  // Compensado da base: chapas, emendas, parafusos e riscos (plywoodMaterial com `sheets`).
  const base = byId.get('base');
  const [bw, bh, bd] = base.size;
  const baseMat = set.plywood({ sheets: [...base.look.sheet], origin: [...base.look.origin], name: 'compensado-base' });
  group.add(placeMesh(new THREE.Mesh(new THREE.BoxGeometry(bw, bh, bd), baseMat), base.matrix, { castShadow: false, name: 'base-compensado' }));
  const floor = byId.get('chao-estudio');
  const [fw, fh, fd] = floor.size;
  group.add(placeMesh(new THREE.Mesh(new THREE.BoxGeometry(fw, fh, fd), set.floorPaint({ color: floor.look.color })), floor.matrix, {
    castShadow: false, name: 'chao-estudio',
  }));

  // Tapetes de corte dos lotes (cada um com o tamanho dele na grade impressa).
  for (const p of layout.pieces) {
    if (p.look.kind !== 'mat') continue;
    const [w, h, d] = p.size;
    const mat = set.cuttingMat({ size: [w, d], name: `tapete-${p.station}` });
    group.add(placeMesh(new THREE.Mesh(matGeometry(w, h, d), mat), p.matrix, { castShadow: false, name: p.id }));
  }

  // Papéis: quadriculado (lote das medidas, modo 4) e kraft (lote dos papéis).
  for (const p of layout.pieces) {
    const [w, h, d] = p.size;
    if (p.look.kind === 'gridPaper') {
      const geo = constantAttribute(sheetGeometry(w, h, d, { seed: p.id, wave: 0.08 }), 'aMeasure', [4, w, d, h]);
      batches.add('measure', geo, p.matrix, p.look.color);
    } else if (p.look.kind === 'paper') {
      batches.add('paper', sheetGeometry(w, h, d, { seed: p.id, wave: 0.12 }), p.matrix, p.look.color);
    }
  }

  // Etiquetas: um atlas com todos os textos; cada etiqueta é uma tira do comprimento do texto.
  const T = look.tape;
  const labels = layout.decor.filter((d) => d.kind === 'label');
  const atlas = bakeLabelAtlas(labels.map((d) => d.text), {
    width: T.atlas.width, cellHeight: T.atlas.cellHeight, columns: T.atlas.columns, font: T.font, seed: 'pista-etiquetas', anisotropy,
  });
  disposers.push(() => atlas.dispose());
  const tapeMat = set.adopt('pista-fitas', tapeMaterial(set.textures, { color: '#FFFFFF', atlas: atlas.texture, ink: T.ink, name: 'fitas-pista' }));
  batches.define('tape', { material: tapeMat, castShadow: false, receiveShadow: true });
  const rng = new RNG(`${data.seed}:fitas`);
  labels.forEach((d, i) => {
    const info = atlas.labels[i];
    const length = T.margin * 2 + T.textHeight * info.aspect;
    const geo = tapeGeometry(length, T.labelWidth, { seed: d.id, lift: rng.bool(0.2) ? 1.1 : 0, rect: info.rect, margin: T.margin, textHeight: T.textHeight });
    batches.add('tape', geo, d.matrix, T.color);
  });
  for (const d of layout.decor) {
    if (d.kind !== 'tape') continue;
    const geo = tapeGeometry(d.length, d.width, { seed: d.seed ?? d.id, lift: rng.bool(0.25) ? rng.float(0.6, 1.6) : 0 });
    batches.add('tape', geo, d.matrix, d.color ?? T.color);
  }
  // Pés das paredes soltas (papelão de uma face e de parede dupla): fita dobrada da face para o chão, dos dois lados.
  const F = T.feet;
  for (const p of layout.pieces) {
    if (p.look.kind !== 'panel' || p.look.wall === 'regular') continue;
    const [len, h, t] = p.size;
    const count = Math.max(1, Math.round(len / F.every));
    for (const side of [1, -1]) {
      for (let k = 0; k < count; k++) {
        const a = -len / 2 + (len * (k + 0.5)) / count + rng.float(-0.12, 0.12) * (len / count);
        const local = basisMatrix([a, -h / 2, (side * t) / 2], [0, 0, side], [0, 1, 0]);
        const geo = footTapeGeometry(F.length * rng.float(0.85, 1.15), T.labelWidth, F.fold, `${p.id}:pe:${side}:${k}`);
        batches.add('tape', geo, p.matrix.clone().multiply(local), T.color);
      }
    }
  }
}
```


- [ ] **Passo 3: Livros** (escadas, espiral da torre, caderninhos dos apoios) com o atlas das lombadas.

```js file=src/maps/pista/visual/books.js
// Livros da pista de testes (BAS1, BAS4, BAS7, BAS9, BAS11, BAS15 no item 11 do moodboard): os degraus das escadas
// (capa dura, lombada para o sul com o título e a etiqueta de biblioteca com a altura do degrau), a espiral da torre
// (capa dura, lombada virada para quem sobe) e os caderninhos dos apoios do slide (brochura). Todos num lote só, com o
// atlas das lombadas do mapa; a cor da capa é a cor da peça.

import { bakeSpineAtlas, bookMaterial } from '../../../clay/set/bookMaterial.js';
import { bookGeometry, spineArcLength } from '../../../clay/set/bookGeometry.js';

export function buildBooks(ctx) {
  const { layout, set, batches, disposers, anisotropy } = ctx;
  const books = layout.pieces.filter((p) => p.look.kind === 'book');
  // Capa dura nas escadas e na torre; os apoios do slide são caderninhos de brochura.
  const hard = (p) => !p.id.startsWith('slide-');
  // Uma célula por texto diferente (título + etiqueta + proporção da lombada); livros iguais repetem a célula.
  const keys = new Map();
  const spines = [];
  const cellOf = books.map((p) => {
    const [L, T] = p.size;
    const aspect = L / spineArcLength(T, hard(p));
    const key = `${p.look.title}|${p.look.text}|${aspect.toFixed(1)}`;
    if (!keys.has(key)) {
      keys.set(key, spines.length);
      spines.push({ title: p.look.title, label: p.look.text, aspect });
    }
    return keys.get(key);
  });
  const atlas = bakeSpineAtlas(spines, { width: 2048, cellHeight: 40, seed: 'pista-lombadas', anisotropy });
  disposers.push(() => atlas.dispose());
  const material = set.adopt('pista-livros', bookMaterial(set.textures, { atlas: atlas.texture, name: 'livros-pista' }));
  batches.define('books', { material });
  books.forEach((p, i) => {
    const geo = bookGeometry([...p.size], { hard: hard(p), spineRect: atlas.rects[cellOf[i]], seed: p.id });
    batches.add('books', geo, p.matrix, p.look.color);
  });
  return { books: books.length, cells: spines.length };
}
```


- [ ] **Passo 4: Madeira** — blocos de faia, peças de compensado, ripas de balsa e a tábua de crescimento.

```js file=src/maps/pista/visual/wood.js
// Madeira da pista de testes (item 11 do moodboard: AWB1/AWB4/AWB12/AWB17 blocos de faia, PKG3/PKG6/PKG11 compensado,
// BWM1/BWM10/BWM14 balsa, WRG1/WRG4/WRG11 tábua de crescimento): blocos de faia de cantos arredondados (pilares,
// caixas, pilhas, colunas do gabarito, apoios), placas de compensado (poço, pranchas da torre, prancha de saída), ripas
// de balsa (vigas e a ripa inclinada) e a tábua de crescimento da torre (escala pintada no lote das medidas).

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { balsaStick } from '../../../clay/set/propGeometry.js';
import { constantAttribute } from './common.js';

/** Tábua de crescimento [w, h, t] com a escala na face da frente (+Z): uv = (altura a partir do pé, a partir da esquerda). */
function growthGeometry([w, h, t]) {
  const geo = new THREE.BoxGeometry(w, h, t);
  const p = geo.attributes.position;
  const n = geo.attributes.normal;
  const uv = geo.attributes.uv;
  for (let i = 0; i < p.count; i++) {
    if (n.getZ(i) > 0.5) uv.setXY(i, p.getY(i) + h / 2, p.getX(i) + w / 2);
    else uv.setXY(i, 0, 0);
  }
  return constantAttribute(geo, 'aMeasure', [3, h, w, t]);
}

export function buildWood(ctx) {
  const { layout, data, batches } = ctx;
  const blocks = new Map();
  let beech = 0;
  for (const p of layout.pieces) {
    const k = p.look.kind;
    if (k === 'beech') {
      const [w, h, d] = p.size;
      const r = p.look.radius ?? 3;
      const key = `${w.toFixed(2)}:${h.toFixed(2)}:${d.toFixed(2)}:${r}`;
      if (!blocks.has(key)) blocks.set(key, new RoundedBoxGeometry(w, h, d, 2, Math.min(r, h / 2 - 0.01, w / 2 - 0.01, d / 2 - 0.01)));
      batches.add('beech', blocks.get(key), p.matrix, p.look.tint ?? [1, 1, 1]);
      beech++;
    } else if (k === 'plywood') {
      batches.add('plywood', new THREE.BoxGeometry(...p.size), p.matrix);
    } else if (k === 'balsa') {
      const [len, thick, width] = p.size;
      // As vigas compridas cedem um pouco no meio (apoiadas só nas pontas); a ripa inclinada fica reta.
      const bow = len > 400 ? -0.45 : 0;
      batches.add('balsa', balsaStick(len, width, thick, { seed: p.look.seed ?? p.id, bow }), p.matrix);
    } else if (k === 'growth') {
      batches.add('measure', growthGeometry(p.size), p.matrix, data.look.growth);
    }
  }
  return { beech };
}
```


- [ ] **Passo 5: Papelão** — caixas da cerca, caixa de arquivo com alças e tampa, cunhas fechadas, painéis (parede dupla, uma face, fina), túnel com furos, respiros e abas, tubo da torre com tampa, plaquinhas em "A" e o cavalete com a prancheta.

```js file=src/maps/pista/visual/cardboard.js
// Papelão da pista de testes (item 11 do moodboard: COC4/CBT15 caixas da cerca, CFO8/CFR7 cunhas, CBT12/COC15 papelão
// de uma face, COC2/COC25/CBT6/CBT13 túnel, BAS9 tubo da torre, DFL5 plaquinhas, COC30 cavalete): caixas abertas da
// cerca (parede dupla), caixa de arquivo das rampas com tampa e alças, cunhas fechadas dos lados, painéis (parede
// dupla do zigue-zague, uma face das paredes finas, cartão nas mais finas), caixas do túnel com furos e respiros e as
// abas das bocas, o tubo enrolado da torre com a tampa, as plaquinhas em "A" e o cavalete com a prancheta. Três lotes
// (papelão comum, parede dupla, uma face), cada peça com o seu tom.

import * as THREE from 'three';
import { RNG } from '../../../core/rng.js';
import { cardboardBox, cardboardPanel, cardboardPolygon, woundTube } from '../../../clay/set/boardGeometry.js';
import { basisMatrix, DEG } from '../pieces.js';
import { cardboardTone, offset, tentFaces } from './common.js';

/** Retângulo centrado em (cx, cy). */
function rectShape(w, h, cx = 0, cy = 0) {
  return new THREE.Shape([
    new THREE.Vector2(cx - w / 2, cy - h / 2), new THREE.Vector2(cx + w / 2, cy - h / 2),
    new THREE.Vector2(cx + w / 2, cy + h / 2), new THREE.Vector2(cx - w / 2, cy + h / 2),
  ]);
}

/** Furo em estádio (retângulo de pontas redondas) centrado em (cx, cy): alças e respiros. */
function slotPath(w, h, cx, cy) {
  const r = h / 2;
  const p = new THREE.Path();
  p.moveTo(cx - w / 2 + r, cy - r);
  p.lineTo(cx + w / 2 - r, cy - r);
  p.absarc(cx + w / 2 - r, cy, r, -Math.PI / 2, Math.PI / 2, false);
  p.lineTo(cx - w / 2 + r, cy + r);
  p.absarc(cx - w / 2 + r, cy, r, Math.PI / 2, (Math.PI * 3) / 2, false);
  return p;
}

/** Caixa aberta da cerca: parede dupla, abas curtas abertas para fora, sem fundo (ninguém vê); origem no pé. */
function fence(add, p) {
  const [w, h, d] = p.size;
  const L = p.look;
  const geo = cardboardBox(w, h, d, { thickness: L.wall, flapOpen: L.flapOpen, seed: L.seed, step: 40, flaps: [d * 0.48, d * 0.48], bottom: false });
  add('cardboardDouble', geo, offset(0, -h / 2, 0));
}

/** Caixa de arquivo: tampa com saia rente à colisão, paredes por dentro da saia e alças nas laterais. */
function archiveBox(add, p, A) {
  const [w, h, d] = p.size;
  const t = A.wall;
  const skirt = A.lid;
  const flat = (cx, cy, cz) => basisMatrix([cx, cy, cz], [1, 0, 0], [0, 0, -1]); // placa deitada, frente para cima
  add('cardboard', cardboardPanel(w, d, t, { seed: `${p.id}:tampa`, fluteAxis: 'x', step: 24 }), flat(0, h / 2 - t / 2, 0));
  const yS = h / 2 - skirt / 2;
  add('cardboard', cardboardPanel(w, skirt, t, { seed: `${p.id}:saia-s`, step: 24 }), basisMatrix([0, yS, d / 2 - t / 2], [1, 0, 0], [0, 1, 0]));
  add('cardboard', cardboardPanel(w, skirt, t, { seed: `${p.id}:saia-n`, step: 24 }), basisMatrix([0, yS, -d / 2 + t / 2], [-1, 0, 0], [0, 1, 0]));
  add('cardboard', cardboardPanel(d - 2 * t, skirt, t, { seed: `${p.id}:saia-l`, step: 24 }), basisMatrix([w / 2 - t / 2, yS, 0], [0, 0, -1], [0, 1, 0]));
  add('cardboard', cardboardPanel(d - 2 * t, skirt, t, { seed: `${p.id}:saia-o`, step: 24 }), basisMatrix([-w / 2 + t / 2, yS, 0], [0, 0, 1], [0, 1, 0]));
  // Paredes: da base até a tampa, por dentro da saia.
  const wh = h - t;
  const yW = -h / 2 + wh / 2;
  add('cardboard', cardboardPanel(w - 2 * t, wh, t, { seed: `${p.id}:frente`, step: 24 }), basisMatrix([0, yW, d / 2 - 1.5 * t], [1, 0, 0], [0, 1, 0]));
  add('cardboard', cardboardPanel(w - 2 * t, wh, t, { seed: `${p.id}:fundo`, step: 24 }), basisMatrix([0, yW, -d / 2 + 1.5 * t], [-1, 0, 0], [0, 1, 0]));
  for (const side of [1, -1]) {
    const sw = d - 4 * t;
    const shape = rectShape(sw, wh);
    shape.holes.push(slotPath(A.handle[0], A.handle[1], 0, wh / 2 - skirt - A.handle[1]));
    const geo = cardboardPolygon(shape, t, { seed: `${p.id}:alca-${side}` });
    add('cardboard', geo, basisMatrix([side * (w / 2 - 1.5 * t), yW, 0], [0, 0, -side], [0, 1, 0]));
  }
}

/** Cunha fechada dos lados: tampa inclinada rente à rampa da colisão, laterais triangulares e o fundo encostado. */
function wedge(add, p, t) {
  const [w, h, l] = p.size;
  const len = Math.hypot(h, l);
  const up = new THREE.Vector3(0, h, l).divideScalar(len);
  const n = new THREE.Vector3(0, l, -h).divideScalar(len);
  const mid = new THREE.Vector3(0, h / 2, l / 2).addScaledVector(n, -t / 2);
  add('cardboard', cardboardPanel(w, len, t, { seed: `${p.id}:tampo`, fluteAxis: 'x', step: 16 }), basisMatrix(mid.toArray(), [-1, 0, 0], up.toArray()));
  // Laterais: o triângulo abaixo da tampa (hipotenusa recuada a espessura da tampa).
  const z0 = (t * len) / h;
  const top = h - (t * len) / l;
  const tri = new THREE.Shape([new THREE.Vector2(z0, 0), new THREE.Vector2(l, 0), new THREE.Vector2(l, top)]);
  for (const side of [1, -1]) {
    add('cardboard', cardboardPolygon(tri, t, { seed: `${p.id}:lado-${side}` }), basisMatrix([side * (w / 2 - t / 2), 0, 0], [0, 0, 1], [0, 1, 0]));
  }
  add('cardboard', cardboardPanel(w - 2 * t, top, t, { seed: `${p.id}:fundo`, step: 16 }), basisMatrix([0, top / 2, l - t / 2], [1, 0, 0], [0, 1, 0]));
}

/** Placa de papelão comum, de parede dupla ou de uma face (as mais finas que 1,5 u são cartão). */
function panel(add, p) {
  const [w, h, t] = p.size;
  const wall = p.look.wall;
  const key = wall === 'double' ? 'cardboardDouble' : wall === 'single' && t >= 1.5 ? 'cardboardSingle' : 'cardboard';
  add(key, cardboardPanel(w, h, t, { seed: p.id, fluteAxis: 'y', step: 16, warp: t < 3 ? 1.4 : 1.1 }), new THREE.Matrix4());
}

/** Caixas do túnel: paredes (a caixa alta com fendas de respiro) e tetos (os baixos com três furos). */
function tunnelPart(add, p, T) {
  const [w, h, t] = p.size;
  const L = p.look;
  const shape = rectShape(w, h);
  if (L.part === 'teto' && L.low) {
    for (let k = 0; k < T.holes.perBox; k++) {
      const hole = new THREE.Path();
      hole.absarc(-w / 2 + (w * (k + 0.5)) / T.holes.perBox, 0, T.holes.diameter / 2, 0, Math.PI * 2, true);
      shape.holes.push(hole);
    }
  } else if (L.part !== 'teto' && !L.low) {
    const [vw, vh] = T.vents.size;
    for (let k = 0; k < T.vents.perSide; k++) shape.holes.push(slotPath(vw, vh, -w / 2 + (w * (k + 0.5)) / T.vents.perSide, h / 2 - 24));
  }
  add('cardboard', cardboardPolygon(shape, t, { seed: p.id, fluteAxis: L.part === 'teto' ? 'x' : 'y', step: 30 }), new THREE.Matrix4());
}

/** Abas de uma boca do túnel: a de cima aberta para fora e para cima, as dos lados abertas em leque. */
function tunnelFlaps(addWorld, d, F, t, rng) {
  const o = d.outward;
  const [z0, z1] = d.z;
  const zc = (z0 + z1) / 2;
  const up = F.openDeg * DEG * rng.float(0.8, 1.2);
  const dir = [o * Math.cos(up), Math.sin(up), 0];
  const hinge = new THREE.Vector3(d.x, d.height - t / 2, zc);
  const topCenter = hinge.clone().add(new THREE.Vector3(...dir).multiplyScalar(F.top / 2));
  addWorld('cardboard', cardboardPanel(z1 - z0, F.top, t, { seed: `${d.id}:cima`, fluteAxis: 'x', step: 16 }), basisMatrix(topCenter.toArray(), [0, 0, o], dir));
  for (const side of [1, -1]) {
    const splay = F.splayDeg * DEG * rng.float(0.8, 1.2);
    const along = [o * Math.cos(splay), 0, side * Math.sin(splay)];
    const zEdge = side > 0 ? z1 - t / 2 : z0 + t / 2;
    const fh = d.height - 6;
    const c = new THREE.Vector3(d.x, fh / 2 + 1, zEdge).add(new THREE.Vector3(...along).multiplyScalar(F.side / 2));
    addWorld('cardboard', cardboardPanel(F.side, fh, t, { seed: `${d.id}:lado-${side}`, step: 16 }), basisMatrix(c.toArray(), along, [0, 1, 0]));
  }
}

/** Tubo da torre: enrolado em espiral, com a tampa encaixada rente à boca de cima. */
function tube(add, p, pitch) {
  const [r, height] = p.size;
  const wall = p.look.wall;
  add('cardboard', woundTube(r - wall, height, wall, { pitch }), new THREE.Matrix4());
  const disc = new THREE.Shape().absarc(0, 0, r - wall, 0, Math.PI * 2, false);
  add('cardboard', cardboardPolygon(disc, 4, { seed: `${p.id}:tampa`, curveSegments: 40 }), basisMatrix([0, height - 2, 0], [1, 0, 0], [0, 0, -1]));
}

/** Plaquinha em "A": dois cartões com a face de fora na rampa da colisão. */
function tentCard(add, p, t) {
  for (const f of tentFaces(p.size)) {
    add('cardboard', cardboardPanel(f.width, f.slope, t, { seed: `${p.id}:${f.side}`, fluteAxis: 'x', step: 24 }), f.matrix.clone().multiply(offset(0, 0, -t / 2)));
  }
}

/**
 * Cavalete de papelão com a prancheta: laterais em "A" com a borda da frente no plano de trás da prancheta, a
 * prateleira que segura a prancheta, a travessa de trás, a prancheta (chapa dura escura) e o prendedor de metal.
 */
function easel(add, p, look, frameInv) {
  const L = p.look;
  const [bw, bh, bt] = L.board;
  const s = Math.sin(L.tilt * DEG);
  const c = Math.cos(L.tilt * DEG);
  const F = L.frame;
  // No quadro do cavalete (o add da peça multiplica pela matriz da peça: desfaz com a inversa e usa o quadro).
  const inFrame = (m) => frameInv.clone().multiply(F).multiply(m);
  const up = [0, s, c];
  const center = new THREE.Vector3(0, L.bottom, 0).addScaledVector(new THREE.Vector3(...up), bh / 2);
  add('cardboard', cardboardPanel(bw, bh, bt, { seed: `${p.id}:prancheta`, step: 24, warp: 0.4 }), inFrame(basisMatrix(center.toArray(), [-1, 0, 0], up)), look.clipboard);
  // Prendedor: chapa curva no alto da prancheta, rolo da mola e a alavanca de arame.
  const clipAt = new THREE.Vector3(0, L.bottom, 0).addScaledVector(new THREE.Vector3(...up), bh - 16).addScaledVector(new THREE.Vector3(0, c, -s), bt / 2 + 0.8);
  const plate = new THREE.BoxGeometry(100, 26, 1.4).translate(0, 0, 0);
  const roll = new THREE.CylinderGeometry(3, 3, 104, 16).rotateZ(Math.PI / 2).translate(0, 11, 2.5);
  const lever = new THREE.TorusGeometry(14, 1.1, 8, 24, Math.PI).rotateX(-Math.PI / 2).translate(0, 11, 6);
  const clipFrame = inFrame(basisMatrix(clipAt.toArray(), [-1, 0, 0], up));
  for (const g of [plate, roll, lever]) add('chrome', g, clipFrame, look.clip);
  // Laterais: triângulos com a borda da frente no plano de trás da prancheta, da base até o alto dela.
  const back = { z: s * bt / 2, y: L.bottom - c * bt / 2 };
  const kFoot = -back.y / s;
  const kTop = bh * 0.94;
  const foot = [back.z + c * kFoot, 0];
  const apex = [back.z + c * kTop, back.y + s * kTop];
  const rear = [apex[0] + 50, 0];
  const tri = new THREE.Shape([new THREE.Vector2(...foot), new THREE.Vector2(...rear), new THREE.Vector2(...apex)]);
  for (const side of [1, -1]) {
    add('cardboard', cardboardPolygon(tri, 4, { seed: `${p.id}:lado-${side}` }), inFrame(basisMatrix([side * (bw / 2 + 6), 0, 0], [0, 0, 1], [0, 1, 0])));
  }
  // Prateleira sob a borda de baixo da prancheta e o friso da frente.
  add('cardboard', cardboardPanel(bw + 16, 30, 4, { seed: `${p.id}:prateleira`, fluteAxis: 'x' }), inFrame(basisMatrix([0, L.bottom - 2, 2], [1, 0, 0], [0, 0, -1])));
  add('cardboard', cardboardPanel(bw + 16, 14, 4, { seed: `${p.id}:friso` }), inFrame(basisMatrix([0, L.bottom + 5, -13], [-1, 0, 0], [0, 1, 0])));
  // Travessa de trás entre as laterais, baixa.
  add('cardboard', cardboardPanel(bw + 8, 34, 4, { seed: `${p.id}:travessa` }), inFrame(basisMatrix([0, 46, rear[0] - 36], [1, 0, 0], [0, 1, 0])));
}

export function buildCardboard(ctx) {
  const { layout, data, batches } = ctx;
  const look = data.look;
  const rng = new RNG(`${data.seed}:papelao`);
  let count = 0;
  for (const p of layout.pieces) {
    const k = p.look.kind;
    const tone = cardboardTone(rng, look.cardboardTint);
    const add = (key, geo, local, color = tone) => {
      batches.add(key, geo, p.matrix.clone().multiply(local), color);
      count++;
    };
    if (k === 'fenceBox') fence(add, p);
    else if (k === 'archiveBox') archiveBox(add, p, look.archive);
    else if (k === 'wedge') wedge(add, p, look.wedgeWall);
    else if (k === 'panel') panel(add, p);
    else if (k === 'tunnel') tunnelPart(add, p, data.tunnel);
    else if (k === 'tube') tube(add, p, look.tubePitch);
    else if (k === 'tentCard') tentCard(add, p, look.tentWall);
    else if (k === 'easel') easel(add, p, look, p.matrix.clone().invert());
  }
  const addWorld = (key, geo, matrix) => {
    batches.add(key, geo, matrix, cardboardTone(rng, look.cardboardTint));
    count++;
  };
  for (const d of layout.decor) {
    if (d.kind === 'tunnelFlaps') tunnelFlaps(addWorld, d, look.flap, data.tunnel.wall, rng);
  }
  return { cardboard: count };
}
```


- [ ] **Passo 6: Arte em canvas** — estampas da cerca, estêncil dos blocos, faixas das paredes do poço, alvos, notas e riscos a lápis, transferidores, bandeirinha, placas e a etiqueta da caixa de arquivo, num atlas do mapa (cor e cobertura separadas: sem franja escura nos mipmaps).

```js file=src/maps/pista/visual/art.js
// Arte em canvas da pista de testes (item 11 do moodboard: COC4/CBT15 estampas de caixa, AWB17 estêncil, PKG11/PKC14
// paredes numeradas, WRG4/WRG11 anotações a lápis, CFO8 transferidor, TMA12 bandeirinha, DFL5 plaquinhas, COC30
// etiqueta de arquivo): um atlas RGBA por mapa com todas as células, e os decalques que as usam (lote `decal`).
// Cada célula desenha duas camadas: a cor (opaca na célula inteira — a cor continua certa onde a cobertura é zero, sem
// franja escura nos mipmaps) e a cobertura (alfa, recortada no shader por teste de alfa). O atlas vai como DataTexture
// sem pré-multiplicação, com as linhas invertidas para v = 0 embaixo (como as CanvasTexture do resto do set).

import * as THREE from 'three';
import { RNG } from '../../../core/rng.js';
import { drawHandwriting, handwritingWidth } from '../../../clay/set/labelAtlas.js';
import { flagGeometry } from '../../../clay/set/stationeryGeometry.js';
import { decalMaterial } from '../../../clay/set/printMaterials.js';
import { DEG } from '../pieces.js';
import { constantAttribute, offset, tentFaces } from './common.js';

const HAND = '700 {px}px "Segoe Print", "Bradley Hand", "Comic Sans MS", "Chalkboard SE", cursive';
const PENCIL = '400 {px}px "Segoe Print", "Bradley Hand", "Comic Sans MS", cursive';
const STAMP = '900 {px}px "Arial Black", "Impact", "Helvetica Neue", sans-serif';
const PRINT = '700 {px}px "Helvetica Neue", Arial, sans-serif';
const KIND = Object.freeze({ ink: 0, paper: 1, graphite: 2 });

/** Salpica furinhos transparentes (tinta que falhou) na cobertura. */
function distress(g, x, y, w, h, rng, count, size) {
  g.save();
  g.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < count; i++) {
    g.globalAlpha = rng.float(0.4, 1);
    g.beginPath();
    g.arc(x + rng.float(0, w), y + rng.float(0, h), rng.float(0.3, 1) * size, 0, Math.PI * 2);
    g.fill();
  }
  g.restore();
}

/** Ícones das estampas de caixa (setas "para cima", taça "frágil", guarda-chuva "manter seco"), em branco na cobertura. */
function stampIcon(g, kind, cx, cy, s) {
  g.lineWidth = s * 0.12;
  g.lineCap = 'round';
  g.lineJoin = 'round';
  if (kind === 0) {
    for (const dx of [-0.32, 0.32]) {
      g.beginPath();
      g.moveTo(cx + dx * s, cy + 0.5 * s);
      g.lineTo(cx + dx * s, cy - 0.3 * s);
      g.stroke();
      g.beginPath();
      g.moveTo(cx + dx * s - 0.22 * s, cy - 0.12 * s);
      g.lineTo(cx + dx * s, cy - 0.5 * s);
      g.lineTo(cx + dx * s + 0.22 * s, cy - 0.12 * s);
      g.closePath();
      g.fill();
    }
  } else if (kind === 1) {
    g.beginPath();
    g.moveTo(cx - 0.3 * s, cy - 0.5 * s);
    g.lineTo(cx + 0.3 * s, cy - 0.5 * s);
    g.quadraticCurveTo(cx + 0.3 * s, cy - 0.02 * s, cx, cy + 0.05 * s);
    g.quadraticCurveTo(cx - 0.3 * s, cy - 0.02 * s, cx - 0.3 * s, cy - 0.5 * s);
    g.fill();
    g.beginPath();
    g.moveTo(cx, cy + 0.05 * s);
    g.lineTo(cx, cy + 0.42 * s);
    g.moveTo(cx - 0.18 * s, cy + 0.45 * s);
    g.lineTo(cx + 0.18 * s, cy + 0.45 * s);
    g.stroke();
  } else {
    g.beginPath();
    g.arc(cx, cy - 0.05 * s, 0.42 * s, Math.PI, 0);
    g.closePath();
    g.fill();
    g.beginPath();
    g.moveTo(cx, cy - 0.05 * s);
    g.lineTo(cx, cy + 0.38 * s);
    g.arc(cx - 0.08 * s, cy + 0.38 * s, 0.08 * s, 0, Math.PI);
    g.stroke();
    for (const [dx, dy] of [[-0.45, -0.62], [0.05, -0.72], [0.42, -0.6]]) {
      g.beginPath();
      g.moveTo(cx + dx * s, cy + dy * s);
      g.lineTo(cx + (dx - 0.05) * s, cy + (dy + 0.12) * s);
      g.stroke();
    }
  }
}

/** Texto centrado em (cx, cy) que cabe em `maxW`. */
function fitText(g, text, font, px, cx, cy, maxW) {
  g.font = font.replace('{px}', String(px));
  const w = g.measureText(text).width;
  const k = Math.min(1, maxW / Math.max(w, 1));
  g.font = font.replace('{px}', String(Math.max(6, Math.floor(px * k))));
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text, cx, cy);
}

/** Tamanho do transferidor de uma cunha: raio (até 82% da cunha, no máximo 110 u) e altura do papel. */
function protractorSize(d) {
  const radius = Math.min(d.length * 0.82, 110);
  return { radius, height: radius * Math.sin(Math.min(d.deg + 4, 88) * DEG) + 4 };
}

/**
 * Receitas das células: `size` em u (o decalque), densidade em px/u, tipo de acabamento e o desenho em (cor, cobertura)
 * no retângulo (x, y, w, h) em px.
 */
function recipes(layout, data) {
  const cells = new Map();
  const add = (name, size, density, kind, draw) => {
    if (!cells.has(name)) cells.set(name, { name, size, density, kind, draw });
  };
  const stripes = new Map(data.wallJump.well.stripes.map((s) => [s.number, s]));
  for (const d of layout.decor) {
    if (d.kind !== 'ink') continue;
    const [kindName, arg] = [d.cell.split('-')[0], d.cell.split('-').slice(1).join('-')];
    if (kindName === 'estampa') {
      const k = Number(arg);
      add(d.cell, d.size, 2.4, KIND.ink, (col, cov, x, y, w, h, rng) => {
        col.fillStyle = '#5B2A22';
        col.fillRect(x, y, w, h);
        cov.fillStyle = '#fff';
        cov.strokeStyle = '#fff';
        cov.lineWidth = h * 0.035;
        cov.strokeRect(x + h * 0.05, y + h * 0.05, w - h * 0.1, h - h * 0.1);
        stampIcon(cov, k, x + h * 0.55, y + h * 0.5, h * 0.62);
        cov.textAlign = 'left';
        const text = data.fence.stamps[k];
        const words = text.split(' ');
        const lines = words.length > 2 ? [words.slice(0, 2).join(' '), words.slice(2).join(' ')] : [text];
        lines.forEach((line, i) => {
          const px = Math.round(h * (lines.length > 1 ? 0.26 : 0.36));
          cov.font = STAMP.replace('{px}', String(px));
          const lw = cov.measureText(line).width;
          const room = w - h * 1.15;
          const sx = Math.min(1, room / lw);
          cov.save();
          cov.translate(x + h * 1.02, y + h * (lines.length > 1 ? 0.37 + i * 0.3 : 0.52));
          cov.scale(sx, 1);
          cov.textBaseline = 'middle';
          cov.fillText(line, 0, 0);
          cov.restore();
        });
        distress(cov, x, y, w, h, rng, 520, h * 0.02);
      });
    } else if (kindName === 'estencil') {
      add(d.cell, d.size, 3.2, KIND.ink, (col, cov, x, y, w, h, rng) => {
        col.fillStyle = '#1D1A18';
        col.fillRect(x, y, w, h);
        cov.fillStyle = '#fff';
        const px = Math.round(h * 0.9);
        cov.font = STAMP.replace('{px}', String(px));
        cov.textAlign = 'center';
        cov.textBaseline = 'middle';
        const cx = x + w / 2;
        const cy = y + h / 2 + h * 0.04;
        cov.fillText(arg, cx, cy);
        // Pontes do estêncil: fendas verticais no meio de cada algarismo (em cima e embaixo).
        const tw = cov.measureText(arg).width;
        cov.save();
        cov.globalCompositeOperation = 'destination-out';
        [...arg].forEach((_, i) => {
          const gx = cx - tw / 2 + (tw / arg.length) * (i + 0.5);
          cov.fillRect(gx - px * 0.035, cy - px * 0.34, px * 0.07, px * 0.22);
          cov.fillRect(gx - px * 0.035, cy + px * 0.12, px * 0.07, px * 0.22);
        });
        cov.restore();
        // Névoa do spray em volta das letras.
        cov.globalAlpha = 1;
        for (let i = 0; i < 700; i++) {
          const a = rng.float(0, Math.PI * 2);
          const r = rng.float(0.28, 0.62) * w;
          cov.beginPath();
          cov.arc(cx + Math.cos(a) * r * 0.9, cy + Math.sin(a) * r * 0.45, rng.float(0.4, 1.1), 0, Math.PI * 2);
          if (rng.bool(0.35)) cov.fill();
        }
        distress(cov, x, y, w, h, rng, 120, h * 0.015);
      });
    } else if (kindName === 'faixa') {
      const s = stripes.get(Number(arg));
      add(d.cell, d.size, 2.5, KIND.ink, (col, cov, x, y, w, h, rng) => {
        col.fillStyle = s.color;
        col.fillRect(x, y, w, h);
        // Pinceladas: faixa com as bordas irregulares do rolinho.
        cov.fillStyle = '#fff';
        cov.beginPath();
        cov.moveTo(x + 4, y + h * 0.1);
        for (let i = 0; i <= 24; i++) cov.lineTo(x + 4 + ((w - 8) * i) / 24, y + h * 0.08 + rng.float(-1, 1) * h * 0.04);
        for (let i = 24; i >= 0; i--) cov.lineTo(x + 4 + ((w - 8) * i) / 24, y + h * 0.92 + rng.float(-1, 1) * h * 0.04);
        cov.closePath();
        cov.fill();
        distress(cov, x, y, w, h, rng, 60, h * 0.015);
        const light = s.color.toUpperCase() === '#F4C542';
        col.fillStyle = light ? '#1D1A18' : '#F4EDE1';
        col.font = STAMP.replace('{px}', String(Math.round(h * 0.7)));
        col.textAlign = 'center';
        col.textBaseline = 'middle';
        col.fillText(String(s.number), x + w / 2, y + h / 2 + h * 0.03);
      });
    } else if (kindName === 'alvo') {
      add(d.cell, d.size, 1.8, KIND.ink, (col, cov, x, y, w, h, rng) => {
        const cx = x + w / 2;
        const cy = y + h / 2;
        const R = w / 2 - 1;
        const rings = data.tower.target.rings;
        for (let i = 0; i <= rings; i++) {
          col.fillStyle = i % 2 === 0 ? '#C8261E' : '#EFE6D2';
          col.beginPath();
          col.arc(cx, cy, R * (1 - i / (rings + 1)), 0, Math.PI * 2);
          col.fill();
        }
        col.fillStyle = '#1D1A18';
        col.strokeStyle = '#EFE6D2';
        col.lineWidth = w * 0.02;
        col.font = STAMP.replace('{px}', String(Math.round(w * 0.16)));
        col.textAlign = 'center';
        col.textBaseline = 'middle';
        col.strokeText(arg, cx, cy);
        col.fillText(arg, cx, cy);
        cov.fillStyle = '#fff';
        cov.beginPath();
        for (let i = 0; i <= 64; i++) {
          const a = (i / 64) * Math.PI * 2;
          const r = R * (1 + rng.float(-0.012, 0.012));
          cov.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
        }
        cov.fill();
        distress(cov, x, y, w, h, rng, 90, w * 0.006);
      });
    } else if (kindName === 'nota') {
      add(d.cell, d.size, 5, KIND.graphite, (col, cov, x, y, w, h, rng) => {
        col.fillStyle = '#44454A';
        col.fillRect(x, y, w, h);
        cov.fillStyle = '#fff';
        cov.strokeStyle = '#fff';
        const size = h * 0.78;
        const nat = handwritingWidth(cov, d.text, PENCIL, Math.round(size));
        const fit = Math.min(1, (w - h * 0.4) / Math.max(nat, 1));
        drawHandwriting(cov, d.text, { x: x + h * 0.2, baseline: y + h * 0.78, size: size * fit, font: PENCIL, rng, stroke: 0.02 });
        distress(cov, x, y, w, h, rng, Math.round(w * 0.6), h * 0.03);
      });
    } else if (kindName === 'risco') {
      add(d.cell, d.size, 5, KIND.graphite, (col, cov, x, y, w, h, rng) => {
        col.fillStyle = '#44454A';
        col.fillRect(x, y, w, h);
        cov.strokeStyle = '#fff';
        cov.lineCap = 'round';
        cov.beginPath();
        for (let i = 0; i <= 20; i++) cov.lineTo(x + 3 + ((w - 6) * i) / 20, y + h / 2 + rng.float(-0.12, 0.12) * h);
        cov.lineWidth = h * 0.55;
        cov.stroke();
        distress(cov, x, y, w, h, rng, Math.round(w * 0.4), h * 0.12);
      });
    }
  }
  // Transferidores de papel colados nas cunhas: setor até pouco abaixo da rampa, escala em graus e o ângulo a lápis.
  for (const d of layout.decor) {
    if (d.kind !== 'protractor') continue;
    const { radius: R, height: H } = protractorSize(d);
    add(`transferidor-${d.deg}`, [R, H], 3, KIND.paper, (col, cov, x, y, w, h, rng) => {
      const s = w / R;
      const ox = x + 2;
      const oy = y + h - 2;
      col.fillStyle = '#F2EEE3';
      col.fillRect(x, y, w, h);
      const rr = (R - 3) * s;
      col.strokeStyle = '#2F4C74';
      col.fillStyle = '#2F4C74';
      col.lineWidth = s * 0.35;
      col.beginPath();
      col.arc(ox, oy, rr, -d.deg * DEG, 0);
      col.stroke();
      for (let a = 0; a <= d.deg; a++) {
        const len = a % 10 === 0 ? 9 : a % 5 === 0 ? 6 : 3.5;
        const c = Math.cos(a * DEG);
        const sn = Math.sin(a * DEG);
        col.beginPath();
        col.moveTo(ox + c * rr, oy - sn * rr);
        col.lineTo(ox + c * (rr - len * s), oy - sn * (rr - len * s));
        col.stroke();
        if (a % 10 === 0 && a > 0) {
          col.font = PRINT.replace('{px}', String(Math.round(5 * s)));
          col.textAlign = 'center';
          col.textBaseline = 'middle';
          col.fillText(String(a), ox + c * (rr - 15 * s), oy - sn * (rr - 15 * s));
        }
      }
      // A lápis: a linha da rampa desde o centro, o arco do ângulo e o número.
      col.strokeStyle = '#4B4C50';
      col.lineWidth = s * 0.6;
      col.beginPath();
      col.moveTo(ox, oy);
      col.lineTo(ox + Math.cos(d.deg * DEG) * rr, oy - Math.sin(d.deg * DEG) * rr);
      col.stroke();
      col.beginPath();
      col.arc(ox, oy, rr * 0.34, -d.deg * DEG, 0);
      col.stroke();
      col.fillStyle = '#4B4C50';
      drawHandwriting(col, `${d.deg}°`, { x: ox + rr * 0.38, baseline: oy - rr * 0.05 - 3 * s, size: 9 * s, font: PENCIL, rng, stroke: 0.02 });
      // Papel recortado à mão: setor um pouco abaixo da rampa.
      cov.fillStyle = '#fff';
      cov.beginPath();
      cov.moveTo(ox - 2, oy + 2);
      const top = Math.max(d.deg - 1.2, 1);
      for (let i = 0; i <= 32; i++) {
        const a = (i / 32) * top * DEG;
        const r = R * s * (1 + rng.float(-0.006, 0.006));
        cov.lineTo(ox + Math.cos(a) * r, oy - Math.sin(a) * r);
      }
      cov.closePath();
      cov.fill();
    });
  }
  const flag = layout.decor.find((d) => d.kind === 'flag');
  if (flag) {
    add('bandeira', [42, 28], 6, KIND.paper, (col, cov, x, y, w, h) => {
      col.fillStyle = '#F4F1E8';
      col.fillRect(x, y, w, h);
      col.fillStyle = '#18171A';
      const n = 6;
      const m = 4;
      for (let i = 0; i < n; i++) for (let j = 0; j < m; j++) if ((i + j) % 2 === 0) col.fillRect(x + (w * i) / n, y + (h * j) / m, w / n, h / m);
      cov.fillStyle = '#fff';
      cov.fillRect(x, y, w, h);
    });
  }
  // Plaquinhas em "A": marcador no cartão (número grande e o nome do lote; ou a nota em duas linhas).
  for (const p of layout.pieces) {
    if (p.look.kind !== 'tentCard') continue;
    const [first, rest] = p.look.number ? [String(p.look.number), p.look.text.split(' · ').slice(1).join(' · ')] : p.look.text.split(' · ');
    const face = tentFaces(p.size)[0];
    const size = [face.width - 16, face.slope - 12];
    add(`placa-${p.id}`, size, 3, KIND.ink, (col, cov, x, y, w, h, rng) => {
      col.fillStyle = '#1C2238';
      col.fillRect(x, y, w, h);
      cov.fillStyle = '#fff';
      cov.strokeStyle = '#fff';
      const big = h * 0.5;
      const bw = handwritingWidth(cov, first, HAND, Math.round(big));
      drawHandwriting(cov, first, { x: x + (w - Math.min(bw, w * 0.9)) / 2, baseline: y + h * 0.52, size: big * Math.min(1, (w * 0.9) / bw), font: HAND, rng });
      if (rest) {
        const small = h * 0.3;
        const sw = handwritingWidth(cov, rest, HAND, Math.round(small));
        const k = Math.min(1, (w * 0.94) / sw);
        drawHandwriting(cov, rest, { x: x + (w - sw * k) / 2, baseline: y + h * 0.9, size: small * k, font: HAND, rng });
      }
    });
  }
  // Etiqueta impressa da caixa de arquivo, preenchida à mão.
  const archive = layout.pieces.find((p) => p.look.kind === 'archiveBox');
  if (archive) {
    add('arquivo', data.look.archive.label, 3, KIND.paper, (col, cov, x, y, w, h, rng) => {
      col.fillStyle = '#EFE9DC';
      col.fillRect(x, y, w, h);
      col.fillStyle = '#1D1A18';
      col.strokeStyle = '#1D1A18';
      col.lineWidth = h * 0.012;
      col.strokeRect(x + h * 0.05, y + h * 0.05, w - h * 0.1, h - h * 0.1);
      fitText(col, 'ARQUIVO', PRINT, Math.round(h * 0.16), x + w / 2, y + h * 0.18, w * 0.8);
      for (let i = 0; i < 3; i++) {
        col.beginPath();
        col.moveTo(x + w * 0.1, y + h * (0.48 + i * 0.18));
        col.lineTo(x + w * 0.9, y + h * (0.48 + i * 0.18));
        col.stroke();
      }
      col.fillStyle = '#23336B';
      drawHandwriting(col, 'rampas', { x: x + w * 0.12, baseline: y + h * 0.45, size: h * 0.15, font: HAND, rng, stroke: 0.05 });
      const degs = data.ramps.wedges.map((wd) => `${wd.deg}°`).join(' · ');
      drawHandwriting(col, degs, { x: x + w * 0.12, baseline: y + h * 0.63, size: h * 0.11, font: HAND, rng, stroke: 0.05 });
      cov.fillStyle = '#fff';
      cov.fillRect(x + 1, y + 1, w - 2, h - 2);
    });
  }
  return [...cells.values()];
}

/** Desenha e empacota as células em prateleiras; devolve a textura e o retângulo (u0, v0, largura, altura) de cada uma. */
function bakeAtlas(cells, { width = 2048, anisotropy = 8, seed = 'pista-arte' } = {}) {
  const pad = 4;
  const sized = cells.map((c) => ({ ...c, w: Math.ceil(c.size[0] * c.density), h: Math.ceil(c.size[1] * c.density) }));
  const order = [...sized.keys()].sort((a, b) => sized[b].h - sized[a].h);
  let x = pad;
  let y = pad;
  let rowH = 0;
  for (const i of order) {
    const c = sized[i];
    if (c.w > width - 2 * pad) throw new Error(`célula larga demais no atlas da pista: ${c.name}`);
    if (x + c.w + pad > width) {
      x = pad;
      y += rowH + pad;
      rowH = 0;
    }
    c.x = x;
    c.y = y;
    x += c.w + pad;
    rowH = Math.max(rowH, c.h);
  }
  const height = 2 ** Math.ceil(Math.log2(y + rowH + pad));
  const canvas = (fill) => {
    const cv = document.createElement('canvas');
    cv.width = width;
    cv.height = height;
    const g = cv.getContext('2d');
    if (fill) {
      g.fillStyle = fill;
      g.fillRect(0, 0, width, height);
    }
    return { cv, g };
  };
  const color = canvas('#808080');
  const cover = canvas(null);
  for (const c of sized) {
    const rng = new RNG(`${seed}:${c.name}`);
    for (const g of [color.g, cover.g]) {
      g.save();
      g.beginPath();
      g.rect(c.x, c.y, c.w, c.h);
      g.clip();
    }
    c.draw(color.g, cover.g, c.x, c.y, c.w, c.h, rng);
    color.g.restore();
    cover.g.restore();
  }
  const rgb = color.g.getImageData(0, 0, width, height).data;
  const alpha = cover.g.getImageData(0, 0, width, height).data;
  const data = new Uint8Array(width * height * 4);
  for (let row = 0; row < height; row++) {
    const src = row * width * 4;
    const dst = (height - 1 - row) * width * 4;
    for (let i = 0; i < width * 4; i += 4) {
      data[dst + i] = rgb[src + i];
      data[dst + i + 1] = rgb[src + i + 1];
      data[dst + i + 2] = rgb[src + i + 2];
      data[dst + i + 3] = alpha[src + i + 3];
    }
  }
  color.cv.width = color.cv.height = 0;
  cover.cv.width = cover.cv.height = 0;
  const texture = new THREE.DataTexture(data, width, height, THREE.RGBAFormat, THREE.UnsignedByteType);
  texture.name = 'massacre.pista.arte';
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.generateMipmaps = true;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.anisotropy = anisotropy;
  texture.needsUpdate = true;
  const rects = new Map(sized.map((c) => [c.name, { rect: [c.x / width, 1 - (c.y + c.h) / height, c.w / width, c.h / height], kind: c.kind }]));
  return { texture, rects };
}

/** Quadrado de decalque [w, h] no plano XY (normal +Z) com os atributos da célula. */
function decalQuad(w, h, cell, cx = 0, cy = 0) {
  const geo = new THREE.PlaneGeometry(w, h).translate(cx, cy, 0);
  constantAttribute(geo, 'aDecalRect', cell.rect);
  return constantAttribute(geo, 'aDecalKind', [cell.kind]);
}

/** Monta o atlas da arte, o lote `decal` (material adotado pela biblioteca do set) e os decalques. */
export function buildArt(ctx) {
  const { layout, data, set, batches, disposers, anisotropy } = ctx;
  const { texture, rects } = bakeAtlas(recipes(layout, data), { anisotropy });
  disposers.push(() => texture.dispose());
  batches.define('decal', { material: set.adopt('pista-arte', decalMaterial(set.textures, { atlas: texture, name: 'arte-pista' })), castShadow: false });
  const cell = (name) => {
    const c = rects.get(name);
    if (!c) throw new Error(`célula de arte desconhecida na pista: ${name}`);
    return c;
  };
  let count = 0;
  const put = (geo, matrix) => {
    batches.add('decal', geo, matrix);
    count++;
  };
  for (const d of layout.decor) {
    if (d.kind === 'ink') put(decalQuad(d.size[0], d.size[1], cell(d.cell)), d.matrix);
    else if (d.kind === 'protractor') {
      const { radius, height } = protractorSize(d);
      put(decalQuad(radius, height, cell(`transferidor-${d.deg}`), radius / 2, height / 2), d.matrix);
    }
    else if (d.kind === 'flag') {
      const paper = flagGeometry({ stick: d.stick, seed: d.seed }).paper;
      const c = cell('bandeira');
      constantAttribute(paper, 'aDecalRect', c.rect);
      put(constantAttribute(paper, 'aDecalKind', [c.kind]), d.matrix);
    }
  }
  for (const p of layout.pieces) {
    if (p.look.kind === 'tentCard') {
      const c = cell(`placa-${p.id}`);
      for (const f of tentFaces(p.size)) {
        put(decalQuad(f.width - 16, f.slope - 12, c, 0, -1), p.matrix.clone().multiply(f.matrix).multiply(offset(0, 0, 0.06)));
      }
    } else if (p.look.kind === 'archiveBox') {
      const [, , d] = p.size;
      const A = data.look.archive;
      const local = offset(-p.size[0] * 0.22, -8, d / 2 - A.wall + 0.08);
      put(decalQuad(A.label[0], A.label[1], cell('arquivo')), p.matrix.clone().multiply(local));
    }
  }
  return { count };
}
```


- [ ] **Passo 7: Planta desenhada a lápis** a partir do layout (lotes, números, rota tracejada, "você está aqui", rosa dos ventos, escala).

```js file=src/maps/pista/visual/plan.js
// Planta da pista desenhada a lápis na prancheta do spawn (item 11 do moodboard: COC5, COC30, PKC12), feita a partir
// dos próprios dados do layout: contorno da base e da cerca, cada lote com o número e o nome, as peças principais em
// traço leve, a rota tracejada passando pelas estações em ordem, "você está aqui" no spawn, rosa dos ventos, escala e
// o título. Papel inteiro na textura (opaca), decalque de papel impresso (lote `plan`).

import * as THREE from 'three';
import { RNG } from '../../../core/rng.js';
import { drawHandwriting } from '../../../clay/set/labelAtlas.js';
import { pieceBox } from '../pieces.js';

const HAND = '700 {px}px "Segoe Print", "Bradley Hand", "Comic Sans MS", "Chalkboard SE", cursive';
const THIN = '400 {px}px "Segoe Print", "Bradley Hand", "Comic Sans MS", cursive';
const GRAPHITE = '#57585D';

/** Linha de lápis levemente trêmula entre dois pontos (px). */
function pencilLine(g, x0, y0, x1, y1, rng, width = 1.6) {
  const n = Math.max(2, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 18));
  g.lineWidth = width * rng.float(0.85, 1.15);
  g.beginPath();
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const jitter = i === 0 || i === n ? 0 : rng.float(-0.8, 0.8);
    const dx = y1 - y0;
    const dy = -(x1 - x0);
    const l = Math.hypot(dx, dy) || 1;
    g.lineTo(x0 + (x1 - x0) * t + (dx / l) * jitter, y0 + (y1 - y0) * t + (dy / l) * jitter);
  }
  g.stroke();
}

/** Retângulo a lápis (os cantos passam um pouco, como no traço à mão). */
function pencilRect(g, x0, y0, x1, y1, rng, width) {
  const o = 3;
  pencilLine(g, x0 - o, y0, x1 + o, y0, rng, width);
  pencilLine(g, x1, y0 - o, x1, y1 + o, rng, width);
  pencilLine(g, x1 + o, y1, x0 - o, y1, rng, width);
  pencilLine(g, x0, y1 + o, x0, y0 - o, rng, width);
}

/**
 * Desenha a planta e devolve a textura (CanvasTexture opaca; o papel inteiro está nela).
 * @param {{pieces, stations, spawn}} layout
 */
export function bakePlan(layout, data, { width = 1536, height = 1011, anisotropy = 8 } = {}) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const g = canvas.getContext('2d');
  const rng = new RNG(`${data.seed}:planta`);
  // Papel: branco levemente amarelado, com a sombra de manuseio nas bordas.
  g.fillStyle = '#F1ECE0';
  g.fillRect(0, 0, width, height);
  const grad = g.createRadialGradient(width / 2, height / 2, height * 0.3, width / 2, height / 2, width * 0.72);
  grad.addColorStop(0, 'rgba(0,0,0,0)');
  grad.addColorStop(1, 'rgba(90,70,40,0.16)');
  g.fillStyle = grad;
  g.fillRect(0, 0, width, height);
  const B = data.base;
  const margin = { left: 70, right: 70, top: 120, bottom: 90 };
  const sx = (width - margin.left - margin.right) / (B.maxX - B.minX);
  const sz = (height - margin.top - margin.bottom) / (B.maxZ - B.minZ);
  const s = Math.min(sx, sz);
  const ox = (width - (B.maxX - B.minX) * s) / 2;
  const oy = margin.top;
  const px = (x) => ox + (x - B.minX) * s;
  const pz = (z) => oy + (z - B.minZ) * s;
  g.strokeStyle = GRAPHITE;
  g.fillStyle = GRAPHITE;
  g.lineCap = 'round';
  g.lineJoin = 'round';
  // Base e cerca.
  pencilRect(g, px(B.minX), pz(B.minZ), px(B.maxX), pz(B.maxZ), rng, 2.4);
  const F = data.fence;
  pencilRect(g, px(-F.innerX), pz(-F.innerZ), px(F.innerX), pz(F.innerZ), rng, 1.2);
  // Peças principais em traço leve (a projeção de cada peça no chão), sem as da base, cerca e lotes.
  g.globalAlpha = 0.55;
  for (const p of layout.pieces) {
    if (p.station === 0 || p.id.includes('-chao') || p.id.includes('-placa') || p.look.kind === 'none') continue;
    if (p.look.kind === 'paper' || p.look.kind === 'gridPaper' || p.look.kind === 'mat') continue;
    const b = pieceBox(p);
    g.lineWidth = 0.9;
    g.strokeRect(px(b.min.x), pz(b.min.z), (b.max.x - b.min.x) * s, (b.max.z - b.min.z) * s);
  }
  g.globalAlpha = 1;
  // Lotes: contorno firme, número num círculo e o nome.
  const centers = [];
  for (const lot of data.lots) {
    const x0 = px(lot.x[0]);
    const x1 = px(lot.x[1]);
    const y0 = pz(lot.z[0]);
    const y1 = pz(lot.z[1]);
    pencilRect(g, x0, y0, x1, y1, rng, 1.8);
    const station = data.stations.find((st) => st.number === lot.number);
    const cx = (x0 + x1) / 2;
    const cy = (y0 + y1) / 2;
    centers.push([cx, cy]);
    g.lineWidth = 1.6;
    g.beginPath();
    g.arc(x0 + 20, y0 + 20, 13, 0, Math.PI * 2);
    g.stroke();
    drawHandwriting(g, String(lot.number), { x: x0 + (lot.number >= 10 ? 9 : 14), baseline: y0 + 27, size: 18, font: HAND, rng, stroke: 0.03 });
    const label = station.label;
    const size = Math.min(22, ((x1 - x0) * 0.9) / Math.max(label.length * 0.55, 1));
    drawHandwriting(g, label, { x: x0 + 38, baseline: y0 + 27, size: Math.max(12, size), font: THIN, rng, stroke: 0.02 });
  }
  // Rota tracejada em lápis vermelho pelos lotes em ordem, a partir do spawn.
  const [sxp, szp] = [px(layout.spawn.x), pz(layout.spawn.z)];
  g.strokeStyle = '#B03A2E';
  g.setLineDash([10, 9]);
  g.lineWidth = 2.2;
  g.beginPath();
  g.moveTo(sxp, szp);
  for (const [cx, cy] of centers) g.lineTo(cx + rng.float(-6, 6), cy + rng.float(-6, 6));
  g.stroke();
  g.setLineDash([]);
  // Você está aqui: estrela no spawn com a seta e o texto.
  g.fillStyle = '#B03A2E';
  g.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const r = i % 2 === 0 ? 14 : 6;
    g.lineTo(sxp + Math.cos(a) * r, szp + Math.sin(a) * r);
  }
  g.closePath();
  g.fill();
  drawHandwriting(g, 'você está aqui', { x: sxp + 20, baseline: szp + 34, size: 22, font: HAND, rng, stroke: 0.04 });
  // Rosa dos ventos e escala.
  g.strokeStyle = GRAPHITE;
  g.fillStyle = GRAPHITE;
  const rx = width - 90;
  const ry = 72;
  pencilLine(g, rx, ry + 34, rx, ry - 34, rng, 1.8);
  pencilLine(g, rx - 26, ry, rx + 26, ry, rng, 1.2);
  g.beginPath();
  g.moveTo(rx, ry - 42);
  g.lineTo(rx - 8, ry - 22);
  g.lineTo(rx + 8, ry - 22);
  g.closePath();
  g.fill();
  drawHandwriting(g, 'N', { x: rx - 8, baseline: ry - 48, size: 22, font: HAND, rng, stroke: 0.03 });
  const barX = 80;
  const barY = height - 40;
  const meter = 100 * s;
  for (let k = 0; k < 5; k++) {
    g.fillStyle = k % 2 === 0 ? GRAPHITE : 'rgba(0,0,0,0)';
    g.fillRect(barX + k * meter, barY - 5, meter, 10);
    g.strokeRect(barX + k * meter, barY - 5, meter, 10);
  }
  g.fillStyle = GRAPHITE;
  drawHandwriting(g, '5 m = 500 u', { x: barX + 5 * meter + 14, baseline: barY + 8, size: 20, font: THIN, rng, stroke: 0.02 });
  // Título.
  drawHandwriting(g, 'Pista de testes — planta', { x: 70, baseline: 70, size: 44, font: HAND, rng, stroke: 0.05 });
  const texture = new THREE.CanvasTexture(canvas);
  texture.name = 'massacre.pista.planta';
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = anisotropy;
  texture.generateMipmaps = true;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.needsUpdate = true;
  return {
    texture,
    dispose() {
      texture.dispose();
      canvas.width = canvas.height = 0;
    },
  };
}
```


- [ ] **Passo 8: Objetos de mesa** — trena esticada, traves do slide, verga do gabarito, alfinetes, palito da bandeirinha e o pisca-pisca do túnel.

```js file=src/maps/pista/visual/extras.js
// Objetos de mesa da pista de testes (item 11 do moodboard: TMA2/TMA6/TMA12 trena, PRU1/PRU3/PRU15 traves do slide,
// BWM10 alfinetes, CFO19 palitos, COC2/CBT14 pisca-pisca): a trena esticada na faixa de bhop (lâmina, gancho e estojo),
// as traves do slide e a verga do gabarito (régua de madeira, lápis, régua de aço, espeto de bambu), os alfinetes das
// vigas, o palito da bandeirinha e o pisca-pisca do túnel. Cada parte no lote do seu material.

import * as THREE from 'three';
import { RNG } from '../../../core/rng.js';
import { wireGeometry } from '../../../clay/set/propGeometry.js';
import {
  flagGeometry, pencilGeometry, pinGeometry, rulerGeometry, skewerGeometry, steelRulerGeometry, tapeBladeGeometry, tapeCaseGeometry,
} from '../../../clay/set/stationeryGeometry.js';
import { constantAttribute, placeMesh, turnY } from './common.js';

/** Peça comprida ao longo de Z no quadro dela: a geometria (ao longo de X) gira −90° em Y (X → +Z). */
const ALONG_Z = new THREE.Matrix4().makeRotationY(-Math.PI / 2);

/** Pisca-pisca: fio verde com barriga entre os pontos presos e uma lampadinha no meio de cada vão. */
function fairyLights(batches, d, F) {
  const pts = [];
  for (let i = 0; i < d.anchors.length; i++) {
    const a = new THREE.Vector3(...d.anchors[i]);
    pts.push(a);
    if (i + 1 < d.anchors.length) {
      const b = new THREE.Vector3(...d.anchors[i + 1]);
      pts.push(a.clone().lerp(b, 0.5).add(new THREE.Vector3(0, -d.sag, 0)));
    }
  }
  const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
  const wire = constantAttribute(wireGeometry(curve, 0.55, { radialSegments: 6 }), 'aPaint', [3]);
  batches.add('paint', wire, d.matrix, F.wire);
  const bulb = new THREE.SphereGeometry(F.bulbRadius, 12, 10).scale(1, 1.4, 1);
  const socket = constantAttribute(new THREE.CylinderGeometry(1.5, 1.8, 3.2, 10), 'aPaint', [3]);
  for (let i = 0; i + 1 < d.anchors.length; i++) {
    const mid = pts[i * 2 + 1];
    const m = new THREE.Matrix4().makeTranslation(mid.x, mid.y - 2.2, mid.z);
    batches.add('paint', socket, d.matrix.clone().multiply(m), F.wire);
    batches.add('bulbs', bulb, d.matrix.clone().multiply(m).multiply(new THREE.Matrix4().makeTranslation(0, -F.bulbRadius * 1.4 - 1.2, 0)));
  }
}

export function buildExtras(ctx) {
  const { layout, data, set, batches, group } = ctx;
  const look = data.look;
  let count = 0;
  for (const p of layout.pieces) {
    const k = p.look.kind;
    const along = p.size[2] > p.size[0];
    const frame = along ? p.matrix.clone().multiply(ALONG_Z) : p.matrix;
    if (['regua', 'aco', 'lapis', 'espeto', 'trenaCase'].includes(k)) count++;
    if (k === 'regua') {
      const [a, t, b] = p.size;
      const [len, width] = along ? [b, a] : [a, b];
      // Verga do gabarito: o bisel e a escala viram para o norte (quem chega da praça vê a escala).
      const m = along ? frame : p.matrix.clone().multiply(turnY(Math.PI));
      batches.add('measure', rulerGeometry(len, t, width), m, look.ruler);
    } else if (k === 'aco') {
      batches.add('measure', steelRulerGeometry(p.size[2], p.size[1], p.size[0]), frame, look.steel);
    } else if (k === 'lapis') {
      const pen = pencilGeometry({ length: p.size[2], across: p.size[0], seed: p.id });
      batches.add('paint', pen.paint, frame, look.pencil.body);
      batches.add('paint', pen.eraser, frame, look.pencil.eraser);
      batches.add('balsa', pen.wood, frame, look.pencil.wood);
      batches.add('chrome', pen.metal, frame, look.pencil.ferrule);
    } else if (k === 'espeto') {
      batches.add('balsa', skewerGeometry(p.size[2], p.size[0] / 2, { seed: p.id }), frame, look.bamboo);
    } else if (k === 'trenaCase') {
      const parts = tapeCaseGeometry(p.size);
      const shell = set.plastic({ color: p.look.color, moldY: 0, name: 'estojo-trena' });
      group.add(placeMesh(new THREE.Mesh(parts.shell, shell), p.matrix, { name: 'estojo-trena' }));
      batches.add('paint', parts.rubber, p.matrix, look.trenaCase.rubber);
      batches.add('chrome', parts.metal, p.matrix, look.trenaCase.metal);
    }
  }
  for (const d of layout.decor) {
    if (['trena', 'pin', 'flag', 'fairyLights'].includes(d.kind)) count++;
    if (d.kind === 'trena') {
      const { blade, hook } = tapeBladeGeometry(d.length, d.width);
      batches.add('measure', blade, d.matrix, d.color);
      batches.add('chrome', hook, d.matrix, look.trenaCase.metal);
    } else if (d.kind === 'pin') {
      const r = new RNG(`alfinete:${d.seed}`);
      const { shaft, head } = pinGeometry();
      // Espetado à mão: cada um inclinado para um lado.
      const tilt = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(r.float(-0.25, 0.25), r.float(0, Math.PI * 2), r.float(-0.25, 0.25), 'YXZ'));
      const m = d.matrix.clone().multiply(tilt);
      batches.add('chrome', shaft, m, look.pinShaft);
      batches.add('paint', head, m, d.color);
    } else if (d.kind === 'flag') {
      batches.add('balsa', flagGeometry({ stick: d.stick, seed: d.seed }).stick, d.matrix, look.toothpick);
    } else if (d.kind === 'fairyLights') {
      fairyLights(batches, d, look.fairy);
    }
  }
  return { extras: count };
}
```


- [ ] **Passo 9: Massinha** — as sete placas com a letra carimbada, a borda de furinhos e as marcas do rolo na textura de impressão, e as bolotas.

```js file=src/maps/pista/visual/clayPlates.js
// Massinha da pista de testes (item 11 do moodboard: CFP1/CFP7/CFP10 placas abertas no rolo, CIM1/CIM5/CIM8 letras
// carimbadas e borda de furinhos): as sete placas das pegadas, cada uma com a letra carimbada, a borda de furinhos e as
// marcas do rolo numa textura de impressão própria (o ClayMaterial desloca a normal por ela; a 3.5 põe as pegadas pelo
// mesmo caminho), e as bolotas que seguram as pontas das traves do slide e o palito da bandeirinha, numa malha só com
// a cor por vértice.

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RNG } from '../../../core/rng.js';
import { createNoise3 } from '../../../clay/kit/cpuNoise.js';
import { clayBall, claySlab } from '../../../clay/kit/shapes.js';
import { ClayMaterial } from '../../../clay/ClayMaterial.js';
import { placeMesh } from './common.js';

const STAMP_FONT = '900 {px}px "Arial Black", "Impact", "Helvetica Neue", sans-serif';

/** Desfoque em caixa separável (raio em px) de um campo de floats w × h, `passes` vezes (≈ gaussiano). */
function boxBlur(src, w, h, radius, passes = 2) {
  let a = src;
  let b = new Float32Array(src.length);
  const r = Math.max(1, Math.round(radius));
  const norm = 1 / (2 * r + 1);
  for (let pass = 0; pass < passes; pass++) {
    for (let y = 0; y < h; y++) {
      let acc = 0;
      for (let k = -r; k <= r; k++) acc += a[y * w + Math.min(w - 1, Math.max(0, k))];
      for (let x = 0; x < w; x++) {
        b[y * w + x] = acc * norm;
        acc += a[y * w + Math.min(w - 1, x + r + 1)] - a[y * w + Math.max(0, x - r)];
      }
    }
    [a, b] = [b, a];
    for (let x = 0; x < w; x++) {
      let acc = 0;
      for (let k = -r; k <= r; k++) acc += a[Math.min(h - 1, Math.max(0, k)) * w + x];
      for (let y = 0; y < h; y++) {
        b[y * w + x] = acc * norm;
        acc += a[Math.min(h - 1, y + r + 1) * w + x] - a[Math.max(0, y - r) * w + x];
      }
    }
    [a, b] = [b, a];
  }
  return a;
}

/**
 * Textura de impressão de uma placa [w × d u]: R = fundo (letra carimbada e furinhos, paredes suaves), G = lábio de
 * massa empurrada em volta, B = marcas do rolo. Desenhada de pé (a letra lida de cima para baixo do canvas) e
 * guardada com as linhas invertidas (v = 0 embaixo, a base da letra).
 */
function imprintTexture(letter, [w, d], seed, { density = 2.9, border = 9, dot = 1.7, pitch = 9 } = {}) {
  const W = Math.round(w * density);
  const H = Math.round(d * density);
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const g = canvas.getContext('2d');
  const rng = new RNG(`carimbo:${seed}`);
  g.fillStyle = '#000';
  g.fillRect(0, 0, W, H);
  g.fillStyle = '#fff';
  // Letra: carimbo de borracha levemente torto e fora do centro.
  g.save();
  g.translate(W / 2 + rng.float(-0.04, 0.04) * W, H / 2 + rng.float(-0.03, 0.03) * H);
  g.rotate(rng.float(-0.08, 0.08));
  g.font = STAMP_FONT.replace('{px}', String(Math.round(H * 0.62)));
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(letter, 0, H * 0.03);
  g.restore();
  // Borda de furinhos: a ponta de um lápis a cada `pitch` u, `border` u para dentro da borda.
  const step = pitch * density;
  const inset = border * density;
  const along = (x0, y0, x1, y1) => {
    const len = Math.hypot(x1 - x0, y1 - y0);
    const n = Math.max(1, Math.round(len / step));
    for (let i = 0; i < n; i++) {
      const t = i / n;
      g.beginPath();
      g.arc(x0 + (x1 - x0) * t + rng.float(-0.6, 0.6), y0 + (y1 - y0) * t + rng.float(-0.6, 0.6), dot * density * rng.float(0.85, 1.15), 0, Math.PI * 2);
      g.fill();
    }
  };
  along(inset, inset, W - inset, inset);
  along(W - inset, inset, W - inset, H - inset);
  along(W - inset, H - inset, inset, H - inset);
  along(inset, H - inset, inset, inset);
  const px = g.getImageData(0, 0, W, H).data;
  const mask = new Float32Array(W * H);
  for (let i = 0; i < W * H; i++) mask[i] = px[i * 4] / 255;
  canvas.width = canvas.height = 0;
  const depth = boxBlur(mask, W, H, density * 0.45, 2);
  const wide = boxBlur(mask, W, H, density * 1.6, 2);
  const noise = createNoise3(rng.nextU32());
  // Rolo: faixas largas ao longo da placa com uma leve irregularidade (a massa não abre igual). O ruído é de baixa
  // frequência: calculado numa grade de 8 px e interpolado (um ruído por pixel custava ~40 ms por placa).
  const G = 8;
  const gw = Math.ceil(W / G) + 1;
  const gh = Math.ceil(H / G) + 1;
  const warp = new Float32Array(gw * gh);
  const swell = new Float32Array(gw * gh);
  for (let gy = 0; gy < gh; gy++) {
    for (let gx = 0; gx < gw; gx++) {
      const u = (gx * G) / W;
      const v = (gy * G) / H;
      warp[gy * gw + gx] = noise.noise(u * 3, v * 3, 1.3) * 2.4;
      swell[gy * gw + gx] = 0.6 + 0.4 * noise.noise(u * 9, v * 2, 4.1);
    }
  }
  const lerpGrid = (grid, x, y) => {
    const fx = x / G;
    const fy = y / G;
    const x0 = Math.floor(fx);
    const y0 = Math.floor(fy);
    const tx = fx - x0;
    const ty = fy - y0;
    const a = grid[y0 * gw + x0] + (grid[y0 * gw + x0 + 1] - grid[y0 * gw + x0]) * tx;
    const b = grid[(y0 + 1) * gw + x0] + (grid[(y0 + 1) * gw + x0 + 1] - grid[(y0 + 1) * gw + x0]) * tx;
    return a + (b - a) * ty;
  };
  const data = new Uint8Array(W * H * 4);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      const o = ((H - 1 - y) * W + x) * 4;
      const lip = Math.max(0, wide[i] - depth[i]) * 2.2 * (1 - depth[i]);
      const roll = 0.5 + 0.5 * Math.sin((y / H) * 38 + lerpGrid(warp, x, y)) * lerpGrid(swell, x, y);
      data[o] = Math.round(Math.min(1, depth[i]) * 255);
      data[o + 1] = Math.round(Math.min(1, lip) * 255);
      data[o + 2] = Math.round(Math.min(1, Math.max(0, roll)) * 255);
      data[o + 3] = 255;
    }
  }
  const texture = new THREE.DataTexture(data, W, H, THREE.RGBAFormat, THREE.UnsignedByteType);
  texture.name = `massacre.pista.impressao-${letter}`;
  texture.colorSpace = THREE.NoColorSpace;
  texture.generateMipmaps = true;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

/** Placa aberta no rolo e cortada à mão: a borda treme (deslocamento suave em XZ); o topo continua plano. */
function plateGeometry([w, h, d], seed) {
  const slab = claySlab({ width: w, height: h, depth: d, bevel: 1.6, segments: 10, lumpiness: 0.012, dents: 2, seed: `placa:${seed}` });
  const geo = slab.geometry;
  const noise = createNoise3(new RNG(`recorte-placa:${seed}`).nextU32());
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const z = p.getZ(i);
    const edge = Math.max(Math.abs(x) / (w / 2), Math.abs(z) / (d / 2));
    const k = THREE.MathUtils.smoothstep(edge, 0.7, 1) * 1.3;
    p.setX(i, x + noise.noise(z * 0.03, 1.1, x * 0.004) * k);
    p.setZ(i, z + noise.noise(x * 0.03, 2.7, z * 0.004) * k);
  }
  geo.computeVertexNormals();
  geo.computeBoundingSphere();
  return geo;
}

export function buildClay(ctx) {
  const { layout, data, group, disposers } = ctx;
  let plates = 0;
  for (const p of layout.pieces) {
    if (p.look.kind !== 'clayPlate') continue;
    const [w, , d] = p.size;
    const map = imprintTexture(p.look.letter, [w, d], p.look.seed);
    disposers.push(() => map.dispose());
    // Retângulo espelhado em X: quem vem da praça (olhando para o sul) lê a letra de pé. O relevo é exagerado em
    // relação ao carimbo de verdade (≈1,5 mm), como a luz rasante de macro o mostra nas fotos (CIM5, CIM8).
    const material = new ClayMaterial({
      color: p.look.color, roughness: 0.74, wetness: 0.22, fingerprints: 0.9, touched: false, seed: p.look.seed,
      imprint: { map, rect: [w / 2, -d / 2, -w, d], ...data.look.imprint },
    });
    material.setObjectSize(Math.hypot(w, d) / 2);
    group.add(placeMesh(new THREE.Mesh(plateGeometry(p.size, p.look.seed), material), p.matrix, { name: p.id }));
    plates++;
  }
  // Bolotas: nas pontas das traves e no pé do palito da bandeirinha; uma malha com a cor de cada uma nos vértices.
  const r = data.look.lump;
  const parts = [];
  const color = new THREE.Color();
  for (const d of layout.decor) {
    if (d.kind !== 'clayLump' && d.kind !== 'flag') continue;
    const rng = new RNG(`bolota:${d.id}`);
    // Bolota de 8,5 u: 8 divisões do icosaedro bastam (o padrão de 18 é para peças do tamanho do boneco).
    const ball = clayBall({
      radius: r * rng.float(0.85, 1.15), segments: 8, squash: [rng.float(1, 1.2), rng.float(0.62, 0.78), rng.float(0.95, 1.1)],
      lumpiness: 0.09, dents: 3, seed: rng.int(1, 9999),
    });
    const geo = ball.geometry;
    geo.applyMatrix4(new THREE.Matrix4().makeRotationY(rng.float(0, Math.PI * 2)).setPosition(0, r * 0.42, 0));
    geo.applyMatrix4(d.matrix);
    color.set(d.color ?? data.prints.colors[0]);
    const n = geo.attributes.position.count;
    const col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) col.set([color.r, color.g, color.b], i * 3);
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    parts.push(geo);
  }
  if (parts.length) {
    const merged = mergeGeometries(parts, false);
    for (const g of parts) g.dispose();
    merged.computeBoundingSphere();
    const material = new ClayMaterial({ color: '#FFFFFF', vertexColors: true, roughness: 0.7, wetness: 0.35, seed: 'bolotas-pista' });
    material.setObjectSize(r);
    group.add(placeMesh(new THREE.Mesh(merged, material), new THREE.Matrix4(), { name: 'bolotas' }));
  }
  return { plates, lumps: parts.length };
}
```


- [ ] **Passo 10: Montagem do visual** — define os lotes, chama cada família e devolve o grupo, as contagens e o dispose das texturas do mapa.

```js file=src/maps/pista/visual/index.js
// Visual da pista de testes: monta, a partir do layout (as mesmas peças da colisão), tudo o que se vê — chão e papéis,
// livros, madeira, papelão, arte em canvas, planta, objetos de mesa e massinha. As peças estáticas de um mesmo material
// vão num BatchedMesh (batch.js); a base, o chão do estúdio, os tapetes de corte, o estojo da trena e a massinha são
// malhas próprias. Devolve o grupo, as contagens (draws e triângulos, para o aceite) e o dispose das texturas do mapa
// (os materiais são da biblioteca do set e saem em set.releaseMaterials()).

import * as THREE from 'three';
import { PISTA } from '../../../data/pista.js';
import { decalMaterial } from '../../../clay/set/printMaterials.js';
import { BatchBuilder } from './batch.js';
import { buildFloor } from './floor.js';
import { buildBooks } from './books.js';
import { buildWood } from './wood.js';
import { buildCardboard } from './cardboard.js';
import { buildArt } from './art.js';
import { bakePlan } from './plan.js';
import { buildExtras } from './extras.js';
import { buildClay } from './clayPlates.js';
import { constantAttribute } from './common.js';

/**
 * @param {{layout:object, set:import('../../../clay/set/index.js').SetLibrary, anisotropy?:number, data?:object}} opts
 * @returns {{group:THREE.Group, stats:object, dispose():void}}
 */
export function buildPistaVisuals({ layout, set, anisotropy = 8, data = PISTA }) {
  const group = new THREE.Group();
  group.name = 'pista';
  const batches = new BatchBuilder();
  const disposers = [];
  const F = data.look.fairy;
  batches
    .define('plywood', { material: set.plywood({ name: 'compensado' }) })
    .define('beech', { material: set.beech() })
    .define('balsa', { material: set.balsa() })
    .define('measure', { material: set.measure() })
    .define('paint', { material: set.paint() })
    .define('chrome', { material: set.chrome() })
    .define('cardboard', { material: set.cardboard() })
    .define('cardboardDouble', { material: set.cardboard({ double: true, name: 'papelao-parede-dupla' }) })
    .define('cardboardSingle', { material: set.cardboard({ singleFace: true, name: 'papelao-uma-face' }) })
    .define('paper', { material: set.paper(), castShadow: false })
    .define('bulbs', {
      material: set.diffuser({ color: F.bulb, emission: F.emission, hotspot: 0.25, seam: false, name: 'lampadinhas' }),
      castShadow: false, receiveShadow: false,
    });
  const ctx = { layout, data, set, batches, group, disposers, anisotropy };
  buildFloor(ctx);
  const books = buildBooks(ctx);
  const wood = buildWood(ctx);
  const cardboard = buildCardboard(ctx);
  // Arte: atlas do mapa e o lote dos decalques; a planta tem a textura dela (o papel inteiro).
  const art = buildArt(ctx);
  const plan = bakePlan(layout, data, { anisotropy });
  disposers.push(() => plan.dispose());
  batches.define('plan', { material: set.adopt('pista-planta', decalMaterial(set.textures, { atlas: plan.texture, name: 'planta-pista' })), castShadow: false });
  for (const d of layout.decor) {
    if (d.kind !== 'print') continue;
    const quad = new THREE.PlaneGeometry(d.size[0], d.size[1]);
    constantAttribute(quad, 'aDecalRect', [0, 0, 1, 1]);
    batches.add('plan', constantAttribute(quad, 'aDecalKind', [1]), d.matrix);
  }
  const extras = buildExtras(ctx);
  const clay = buildClay(ctx);
  const built = batches.build(group);
  // Malhas próprias (base, chão, tapetes, estojo, massinha) somam um desenho cada.
  let meshTriangles = 0;
  let meshes = 0;
  group.traverse((o) => {
    if (o.isMesh && !o.isBatchedMesh) {
      meshes++;
      meshTriangles += (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3;
    }
  });
  group.updateMatrixWorld(true);
  return {
    group,
    stats: {
      draws: built.draws + meshes,
      triangles: built.triangles + meshTriangles,
      instances: built.instances,
      books: books.books, spineCells: books.cells, beech: wood.beech, cardboard: cardboard.cardboard, decals: art.count,
      extras: extras.extras, plates: clay.plates, lumps: clay.lumps,
    },
    dispose() {
      for (const d of disposers) d();
      disposers.length = 0;
    },
  };
}
```


- [ ] **Passo 11: Sintaxe e carga dos módulos**

Run: `node --check src/maps/pista/visual/common.js && node --check src/maps/pista/visual/floor.js && node --check src/maps/pista/visual/books.js && node --check src/maps/pista/visual/wood.js && node --check src/maps/pista/visual/cardboard.js && node --check src/maps/pista/visual/art.js && node --check src/maps/pista/visual/plan.js && node --check src/maps/pista/visual/extras.js && node --check src/maps/pista/visual/clayPlates.js && node --check src/maps/pista/visual/index.js`
Expected: sem saída (sintaxe válida).


Run: `node --input-type=module -e "await import('./src/maps/pista/visual/index.js'); console.log('ok')"`
Expected: `ok` (os módulos carregam; o canvas só é usado ao montar).


- [ ] **Passo 12: Suíte inteira**

Run: `npm test`
Expected: 207 testes passando.


- [ ] **Commit (só quando o usuário pedir)**

```bash
git add src/maps/pista/visual
git commit -m "feat(fase-3.3): visual da pista de testes" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```


---

### Tarefa 6: Montagem de luz `pista`, ambiente, poeira, teto da sombra e dispose dos lotes

**Files:**
- Modify: `src/data/studioRigs.js`, `src/render/studio/studioRig.js`, `src/render/studio/environment.js`, `src/render/studio/dust.js`, `src/data/qualityPresets.js`, `src/render/renderSystem.js`, `src/render/dispose.js`
- Test: `tests/pistaRig.test.js`

A base inteira fica sob uma key pendurada alta e longe — a única com sombra, estática, mapa ×2 com o frustum apertado no cone (`focus`) — com níveis mais baixos que os da sala de testes (o compensado claro devolve ~4× a luz do tapete verde). A sala do ambiente assado cresce para a softbox da key caber nela; a poeira fica só no ar baixo da base (o cone inteiro tem 10 m e, contra o fundo escuro, espalhada parecia um céu estrelado).

- [ ] **Passo 1: Escrever o teste**

```js file=tests/pistaRig.test.js
// Testes da montagem de luz `pista` e da poeira em caixa (subfase 3.3), sem WebGL: a key alcança a base inteira dentro
// do cone e do frustum da sombra (planos perto e longe) e é a única com sombra, o mapa ×2 dela tem teto, as luzes
// práticas ficam onde os dados da pista dizem e têm alcance, a sala do ambiente assado contém todas as luzes (senão o
// reflexo da softbox some) e a poeira nasce e continua só dentro da caixa e do cone.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { STUDIO_RIGS } from '../src/data/studioRigs.js';
import { PISTA } from '../src/data/pista.js';
import { SHADOW_LEVELS, SHADOW_MAX_SIZE } from '../src/data/qualityPresets.js';
import { DustMotes } from '../src/render/studio/dust.js';

const DEG = Math.PI / 180;
const RIG = STUDIO_RIGS.pista;
const light = (id) => RIG.lights.find((l) => l.id === id);

/** O que a key precisa alcançar: cantos da base no tampo e no alto da cerca, e o topo da torre. */
function targets() {
  const B = PISTA.base;
  const pts = [];
  for (const x of [B.minX, B.maxX]) {
    for (const z of [B.minZ, B.maxZ]) pts.push(new THREE.Vector3(x, 0, z), new THREE.Vector3(x, PISTA.fence.height, z));
  }
  const [tx, tz] = PISTA.tower.axis;
  pts.push(new THREE.Vector3(tx, PISTA.tower.tube.height, tz));
  return pts;
}

test('montagem pista: a key alcança a base inteira (cone, frustum da sombra, perto e longe) e é a única com sombra', () => {
  assert.deepEqual(RIG.lights.map((l) => l.id), ['key', 'fill', 'rim', 'practical', 'tunnel']);
  const key = light('key');
  const pos = new THREE.Vector3(...key.position);
  const axis = new THREE.Vector3(...key.target).sub(pos).normalize();
  for (const p of targets()) {
    const d = p.clone().sub(pos);
    // O frustum da sombra é a pirâmide de meio ângulo `angle × focus`: dentro do cone inscrito, dentro dela.
    const angle = Math.acos(d.clone().normalize().dot(axis)) / DEG;
    assert.ok(angle < key.angleDeg * key.shadow.focus, `${p.toArray()}: ${angle.toFixed(1)}° do eixo`);
    const len = d.length();
    assert.ok(len > key.shadow.near && len < key.shadow.far, `${p.toArray()}: ${len.toFixed(0)} u fora de [perto, longe]`);
  }
  for (const l of RIG.lights) if (l.id !== 'key') assert.equal(l.shadow, null, `${l.id} sem sombra`);
  // Mapa ×2 da key com teto: no Alto chega a 4096 e no Ultra não passa disso.
  assert.equal(key.shadow.scale, 2);
  assert.equal(SHADOW_MAX_SIZE, 4096);
  assert.equal(Math.min(SHADOW_MAX_SIZE, SHADOW_LEVELS.alta.mapSize * key.shadow.scale), 4096);
  assert.equal(Math.min(SHADOW_MAX_SIZE, SHADOW_LEVELS.ultra.mapSize * key.shadow.scale), 4096);
});

test('montagem pista: luzes práticas nos pontos da pista e com alcance; a sala do ambiente contém todas as luzes', () => {
  const lamp = light('practical');
  assert.deepEqual(lamp.position, [...PISTA.plaza.lamp.bulb]);
  assert.deepEqual(lamp.target, [...PISTA.plaza.lamp.target]);
  assert.equal(lamp.fixture.kind, 'deskLamp');
  assert.equal(lamp.fixture.reach, PISTA.plaza.lamp.reach);
  assert.ok(lamp.distance > 0, 'luminária com alcance');
  const tunnel = light('tunnel');
  assert.deepEqual(tunnel.position, [...PISTA.tunnel.light.at]);
  assert.equal(tunnel.distance, PISTA.tunnel.light.reach);
  assert.equal(tunnel.fixture, null, 'o pisca-pisca é a fonte visível');
  // A luz do túnel fica dentro da caixa alta, abaixo do teto de dentro.
  const tall = PISTA.tunnel.boxes.find((b) => b.height > 72);
  const [x, y, z] = tunnel.position;
  assert.ok(x > tall.x[0] && x < tall.x[1] && z > PISTA.tunnel.z[0] && z < PISTA.tunnel.z[1] && y > 0 && y < tall.height);
  // O mapa assa o ambiente de (0, 60, 0); environment.js sobe a sala 1/3 da altura.
  const [rw, rh, rd] = RIG.environment.room;
  const center = new THREE.Vector3(0, 60 + rh / 3, 0);
  for (const l of RIG.lights) {
    const p = new THREE.Vector3(...l.position).sub(center);
    assert.ok(Math.abs(p.x) < rw / 2 && Math.abs(p.y) < rh / 2 && Math.abs(p.z) < rd / 2, `${l.id} fora da sala`);
  }
});

test('poeira em caixa: nasce e continua só dentro da caixa e do cone da key', () => {
  const key = light('key');
  const spot = new THREE.SpotLight(0xffffff, 1, 0, key.angleDeg * DEG, key.penumbra);
  spot.position.set(...key.position);
  spot.target.position.set(...key.target);
  spot.updateMatrixWorld(true);
  spot.target.updateMatrixWorld(true);
  const count = 300;
  const box = RIG.dust.box;
  const dust = new DustMotes({ light: spot, count, size: RIG.dust.size, drift: RIG.dust.drift, seed: 'teste', box });
  const b = new THREE.Box3(new THREE.Vector3(...box.min), new THREE.Vector3(...box.max));
  // A caixa é o ar baixo da base.
  const B = PISTA.base;
  assert.ok(box.min[0] >= B.minX && box.max[0] <= B.maxX && box.min[2] >= B.minZ && box.max[2] <= B.maxZ);
  assert.ok(box.min[1] > 0 && box.max[1] <= PISTA.fence.height + 50);
  const axis = spot.target.position.clone().sub(spot.position).normalize();
  const p = new THREE.Vector3();
  const check = (when) => {
    for (let i = 0; i < count; i++) {
      p.fromArray(dust.positions, i * 3);
      assert.ok(b.containsPoint(p), `${when}: grão ${i} fora da caixa`);
      assert.ok(p.clone().sub(spot.position).normalize().dot(axis) >= Math.cos(spot.angle), `${when}: grão ${i} fora do cone`);
    }
  };
  check('ao nascer');
  for (let pose = 1; pose <= 240; pose++) dust.step(pose);
  check('depois de 20 s de poses');
  dust.dispose();
});
```


- [ ] **Passo 2: Rodar e ver falhar**

Run: `node --test tests/pistaRig.test.js`
Expected: FAIL — `SyntaxError: The requested module '../src/data/qualityPresets.js' does not provide an export named 'SHADOW_MAX_SIZE'`.


- [ ] **Passo 3: Teto do mapa de sombra**


Em `src/data/qualityPresets.js`, trocar:

```

/** Controle de resolução dinâmica (graphics.adaptiveResolution). */
```

por:

```

/** Teto do lado do mapa de sombra (px): luzes com `shadowScale` > 1 (a key da pista) não passam disto nem do máximo da GPU. */
export const SHADOW_MAX_SIZE = 4096;

/** Controle de resolução dinâmica (graphics.adaptiveResolution). */
```



Em `src/render/renderSystem.js`, trocar:

```
import { SHADOW_LEVELS } from '../data/qualityPresets.js';
```

por:

```
import { SHADOW_LEVELS, SHADOW_MAX_SIZE } from '../data/qualityPresets.js';
```

Em `src/render/renderSystem.js`, trocar:

```
        const size = Math.max(256, Math.round(level.mapSize * (obj.userData.shadowScale ?? 1)));
```

por:

```
        const cap = Math.min(SHADOW_MAX_SIZE, this.renderer.capabilities.maxTextureSize);
        const size = Math.min(cap, Math.max(256, Math.round(level.mapSize * (obj.userData.shadowScale ?? 1))));
```


- [ ] **Passo 4: Montagem de luz `pista`**


Em `src/data/studioRigs.js`, trocar:

```
// luz cai com a distância como num estúdio de verdade. Cores em Kelvin (src/render/colorTemperature.js).

```

por:

```
// luz cai com a distância como num estúdio de verdade. Cores em Kelvin (src/render/colorTemperature.js).
// `distance` (opcional) corta o alcance da luz (luzes práticas); `shadow.focus` aperta o frustum da sombra da spot
// dentro do cone; `environment.room` e `dust.box` são opcionais (sala do ambiente assado maior e poeira só numa caixa).

import { PISTA } from './pista.js';

const PISTA_LAMP = PISTA.plaza.lamp;
const PISTA_TUNNEL = PISTA.tunnel.light;

```

Em `src/data/studioRigs.js`, trocar:

```
  }),
});
```

por:

```
  }),

  // Pista de testes (3.3): a base de 5,6 × 4 m inteira sob uma key pendurada alta e longe (queda de ~2× do centro às
  // bordas; a única com sombra, mapa ×2 com o frustum apertado no cone), fill frio do lado oposto, rim alto vindo do
  // norte e as duas luzes práticas da pista — a luminária de mesa da praça e a luz do túnel —, sem sombra e com alcance.
  // Níveis mais baixos que os da sala de testes: o compensado claro devolve ~4× a luz do tapete verde.
  pista: Object.freeze({
    exposure: 1,
    lights: Object.freeze([
      Object.freeze({
        id: 'key', label: 'Key (tungstênio)', kind: 'spot', kelvin: 3300, illuminance: 2.4,
        position: [-3200, 8400, 4400], target: [0, 0, 0], angleDeg: 28, penumbra: 0.45,
        shadow: Object.freeze({ bias: -0.00015, normalBias: 2.2, softness: 1.2, scale: 2, near: 5000, far: 14000, focus: 0.8 }),
        sourceRadius: 260,
        fixture: Object.freeze({ kind: 'softbox', width: 420, height: 320, depth: 180, stand: false }),
      }),
      Object.freeze({
        id: 'fill', label: 'Fill (frio)', kind: 'spot', kelvin: 7600, illuminance: 0.5,
        position: [4200, 3000, -3400], target: [0, 0, 0], angleDeg: 45, penumbra: 1,
        shadow: null,
        sourceRadius: 220,
        fixture: Object.freeze({ kind: 'softbox', width: 320, height: 320, depth: 150, stand: false }),
      }),
      Object.freeze({
        id: 'rim', label: 'Rim (recorte)', kind: 'spot', kelvin: 5600, illuminance: 1.2,
        position: [600, 5200, -7000], target: [0, 60, -400], angleDeg: 34, penumbra: 0.6,
        shadow: null,
        sourceRadius: 60,
        fixture: Object.freeze({ kind: 'fresnel', radius: 46, length: 110, stand: false }),
      }),
      Object.freeze({
        id: 'practical', label: 'Luminária de mesa', kind: 'point', kelvin: 2700, illuminance: 0.9,
        position: [...PISTA_LAMP.bulb], target: [...PISTA_LAMP.target], distance: 900,
        shadow: null,
        sourceRadius: 12,
        fixture: Object.freeze({ kind: 'deskLamp', reach: PISTA_LAMP.reach }),
      }),
      // O pisca-pisca do teto é a fonte visível; esta é a luz que ele faria, no meio da caixa alta.
      Object.freeze({
        id: 'tunnel', label: 'Luz do túnel', kind: 'point', kelvin: 2400, illuminance: PISTA_TUNNEL.illuminance,
        position: [...PISTA_TUNNEL.at], target: [PISTA_TUNNEL.at[0], 0, PISTA_TUNNEL.at[2]], distance: PISTA_TUNNEL.reach,
        shadow: null,
        sourceRadius: 20,
        fixture: null,
      }),
    ]),
    hemi: Object.freeze({ sky: '#9DB0CE', ground: '#6E4C32', intensity: 0.3 }),
    environment: Object.freeze({
      intensity: 0.45,
      background: '#110C0A',
      walls: '#241B15',
      floor: '#5C4430',
      // Sala grande: a key a 10 m do centro precisa caber nela para o reflexo da softbox aparecer.
      room: Object.freeze([26000, 22000, 26000]),
      panels: Object.freeze([
        Object.freeze({ light: 'key', scale: 3, strength: 5 }),
        Object.freeze({ light: 'fill', scale: 2.2, strength: 1.3 }),
        Object.freeze({ light: 'rim', scale: 3, strength: 3 }),
      ]),
    }),
    // Poeira só no ar baixo da base, onde o boneco anda (o cone inteiro da key tem 10 m); mais alta, contra o fundo
    // escuro do estúdio, parecia um céu estrelado.
    dust: Object.freeze({
      light: 'key', count: 800, size: 2.4, drift: 10,
      box: Object.freeze({ min: Object.freeze([-2800, 4, -2000]), max: Object.freeze([2800, 240, 2000]) }),
    }),
  }),
});
```


- [ ] **Passo 5: Foco da sombra e poeira em caixa na montagem**


Em `src/render/studio/studioRig.js`, trocar:

```
      this.dust = new DustMotes({ light: key.light, count: d.count, size: d.size, drift: d.drift, seed: this.def.dust.light });
```

por:

```
      this.dust = new DustMotes({ light: key.light, count: d.count, size: d.size, drift: d.drift, seed: this.def.dust.light, box: d.box ?? null });
```

Em `src/render/studio/studioRig.js`, trocar:

```
      light.userData.shadowScale = ld.shadow.scale;
    }
```

por:

```
      light.userData.shadowScale = ld.shadow.scale;
      // Frustum da sombra da spot apertado dentro do cone (mais texels no que importa; a borda do cone quase não tem luz).
      if (ld.shadow.focus !== undefined && light.isSpotLight) light.shadow.focus = ld.shadow.focus;
    }
```



Em `src/render/studio/dust.js`, trocar:

```
// pega a poeira num lugar novo, flutuando devagar com a convecção do calor da lâmpada.

```

por:

```
// pega a poeira num lugar novo, flutuando devagar com a convecção do calor da lâmpada.
// Com `box`, a poeira só ocupa a parte do cone dentro da caixa (a pista: o ar da base, onde o boneco anda — a key fica
// a 10 m e o cone inteiro espalharia os grãos longe da câmera).

```

Em `src/render/studio/dust.js`, trocar:

```
import { RNG } from '../../core/rng.js';

```

por:

```
import { RNG } from '../../core/rng.js';

const _p = new THREE.Vector3();

```

Em `src/render/studio/dust.js`, trocar:

```
   * @param {{light: THREE.SpotLight, count:number, size:number, drift:number, seed?:string}} opts
   */
  constructor({ light, count, size = 1.6, drift = 6, seed = 'poeira' }) {
```

por:

```
   * @param {{light: THREE.SpotLight, count:number, size:number, drift:number, seed?:string,
   *   box?: {min:number[], max:number[]}|null}} opts
   */
  constructor({ light, count, size = 1.6, drift = 6, seed = 'poeira', box = null }) {
```

Em `src/render/studio/dust.js`, trocar:

```
    this.drift = drift;
    this.rng = new RNG(`poeira:${seed}`);
```

por:

```
    this.drift = drift;
    this.box = box ? new THREE.Box3(new THREE.Vector3(...box.min), new THREE.Vector3(...box.max)) : null;
    this.rng = new RNG(`poeira:${seed}`);
```

Em `src/render/studio/dust.js`, trocar:

```
  #spawn(i) {
    const f = this._frame ?? (this._frame = this.#coneFrame());
```

por:

```
  /** Com caixa: um ponto sorteado na caixa que esteja dentro do cone (até 48 tentativas; senão, o sorteio do cone). */
  #spawnInBox(i, f) {
    const b = this.box;
    const cosOuter = Math.cos(this.light.angle) + 0.004;
    for (let k = 0; k < 48; k++) {
      const x = this.rng.float(b.min.x, b.max.x);
      const y = this.rng.float(b.min.y, b.max.y);
      const z = this.rng.float(b.min.z, b.max.z);
      const dx = x - f.pos.x;
      const dy = y - f.pos.y;
      const dz = z - f.pos.z;
      if ((dx * f.axis.x + dy * f.axis.y + dz * f.axis.z) / Math.hypot(dx, dy, dz) < cosOuter) continue;
      this.positions[i * 3] = x;
      this.positions[i * 3 + 1] = y;
      this.positions[i * 3 + 2] = z;
      return true;
    }
    return false;
  }

  #spawn(i) {
    const f = this._frame ?? (this._frame = this.#coneFrame());
    if (this.box && this.#spawnInBox(i, f)) {
      this.velocity[i * 3] = this.rng.float(-1, 1);
      this.velocity[i * 3 + 1] = this.rng.float(0, 1);
      this.velocity[i * 3 + 2] = this.rng.float(-1, 1);
      return;
    }
```

Em `src/render/studio/dust.js`, trocar:

```
      if (along < f.range * 0.15 || along > f.range * 1.2 || along / Math.max(len, 1e-4) < cosOuter) this.#spawn(i);
```

por:

```
      const outside = this.box
        ? !this.box.containsPoint(_p.set(p[k], p[k + 1], p[k + 2]))
        : along < f.range * 0.15 || along > f.range * 1.2;
      if (outside || along / Math.max(len, 1e-4) < cosOuter) this.#spawn(i);
```


- [ ] **Passo 6: Sala do ambiente com tamanho** (as outras montagens continuam com 9000 × 6000 × 9000 e o mesmo centro).


Em `src/render/studio/environment.js`, trocar:

```
 * @param {object} def rig.environment (walls, floor, background, panels)
```

por:

```
 * @param {object} def rig.environment (walls, floor, background, panels; room = [largura, altura, fundo] da sala, padrão
 *   9000 × 6000 × 9000 — a pista usa uma sala maior para a key alta e longe caber dentro)
```

Em `src/render/studio/environment.js`, trocar:

```
  // Sala: caixa grande escura em volta (paredes/teto do estúdio) e o chão/mesa quente embaixo.
  const room = new THREE.BoxGeometry(9000, 6000, 9000);
  geos.push(room);
  const walls = new THREE.Mesh(room, basic(new THREE.Color(def.walls), THREE.BackSide));
  walls.position.set(center.x, center.y + 2000, center.z);
  scene.add(walls);
  const floorGeo = new THREE.PlaneGeometry(9000, 9000);
```

por:

```
  // Sala: caixa grande escura em volta (paredes/teto do estúdio) e o chão/mesa quente embaixo. O centro da caixa sobe
  // um terço da altura: o chão fica perto e o teto longe, como num estúdio.
  const [rw, rh, rd] = def.room ?? [9000, 6000, 9000];
  const room = new THREE.BoxGeometry(rw, rh, rd);
  geos.push(room);
  const walls = new THREE.Mesh(room, basic(new THREE.Color(def.walls), THREE.BackSide));
  walls.position.set(center.x, center.y + rh / 3, center.z);
  scene.add(walls);
  const floorGeo = new THREE.PlaneGeometry(Math.max(rw, rd), Math.max(rw, rd));
```

Em `src/render/studio/environment.js`, trocar:

```
  const target = pmrem.fromScene(scene, 0.02, 1, 20000, { size: 256, position: center });
```

por:

```
  // O plano distante alcança os cantos da sala.
  const target = pmrem.fromScene(scene, 0.02, 1, Math.max(20000, Math.hypot(rw, rh, rd)), { size: 256, position: center });
```


- [ ] **Passo 7: Lotes liberados na troca de mapa** (o `BatchedMesh` guarda texturas próprias de matrizes, cores e índices).


Em `src/render/dispose.js`, trocar:

```
    if (obj.isInstancedMesh) obj.dispose();
```

por:

```
    // Instâncias e lotes guardam texturas próprias (matrizes, cores, índices): o dispose deles libera essas também.
    if (obj.isInstancedMesh || obj.isBatchedMesh) obj.dispose();
```


- [ ] **Passo 8: Rodar e ver passar**

Run: `node --test tests/pistaRig.test.js`
Expected: PASS (3 testes).


- [ ] **Passo 9: Suíte inteira**

Run: `npm test`
Expected: 210 testes passando.


- [ ] **Commit (só quando o usuário pedir)**

```bash
git add src/data/studioRigs.js src/data/qualityPresets.js src/render tests/pistaRig.test.js
git commit -m "feat(fase-3.3): montagem de luz da pista, poeira em caixa e teto da sombra" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```


---

### Tarefa 7: Mapa `pista`, comando `estacao` e integração na partida

**Files:**
- Create: `src/maps/pista/index.js`, `src/debug/stationCommands.js`
- Modify: `src/maps/index.js`, `src/maps/registry.js`, `src/modes/matchState.js`, `src/debug/showPos.js`, `src/debug/movementCommands.js`, `src/debug/commands.js`, `src/ui/sandboxHud.js`, `src/ui/menuState.js`
- Test: `tests/stationCommands.test.js`

- [ ] **Passo 1: Escrever o teste**

```js file=tests/stationCommands.test.js
// Testes do comando `estacao` e do registro do mapa `pista` (subfase 3.3): lista, teleporte com o yaw e o pitch do
// ponto, busca por número, id, apelido e ponto de nome único, completação, erros fora da partida e em mapa sem estações;
// `map pista` e os apelidos acham o mapa, que o lobby lista como mapa de teste.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { registerStationCommands } from '../src/debug/stationCommands.js';
import { getMapDef, listMaps } from '../src/maps/index.js';
import { buildPistaLayout } from '../src/maps/pista/layout.js';
import { buildPistaColliders } from '../src/maps/pista/colliders.js';
import { resolveStations } from '../src/maps/stations.js';
import { CollisionWorld } from '../src/physics/collisionWorld.js';

const DEG = Math.PI / 180;
const near = (a, b, msg) => assert.ok(Math.abs(a - b) < 1e-9, `${msg}: ${a} ≠ ${b}`);

const layout = buildPistaLayout();
const world = CollisionWorld.fromBuilder(buildPistaColliders(layout), 'pista-teste');
const stations = resolveStations(layout.stations, world);

/** Console mínimo com o mesmo registro do console do jogo (nome e apelidos apontam para a definição). */
function fakeConsole() {
  const commands = new Map();
  return {
    commands,
    register(def) {
      commands.set(def.name, def);
      for (const a of def.aliases ?? []) commands.set(a, def);
    },
  };
}

test('estacao: lista sem argumento e teleporta para a estação ou o ponto com os ângulos dele', () => {
  const con = fakeConsole();
  const calls = [];
  const match = { map: { id: 'pista', stations }, teleport: (position, yaw, pitch) => calls.push({ position, yaw, pitch }) };
  registerStationCommands(con, { matchState: () => match });
  const cmd = con.commands.get('estacao');
  assert.equal(con.commands.get('estação'), cmd);
  const list = cmd.run([]);
  assert.equal(list.split('\n').length, 12);
  assert.match(list, / 7 torre\s+Torre de queda — pontos: base, 200, 420, 600, 900, 1310/);

  assert.equal(cmd.run(['7', '900']), 'estação 7 · Torre de queda — prancha de 900 u');
  near(calls[0].position.y, 900, 'pés na prancha de 900');
  assert.equal(cmd.run(['bhop']), 'estação 8 · Faixa de bhop — 400 u antes da largada');
  near(calls[1].yaw, -90 * DEG, 'olhando para o leste');
  near(calls[1].pitch, -4 * DEG, 'pitch padrão dos pontos');
  assert.equal(cmd.run(['Túnel', 'MEIO']), 'estação 11 · Túnel baixo — caixa alta');
  assert.equal(cmd.run(['gabarito']), 'estação 6 · Vãos de slide e gabarito — portais');
  near(calls[3].yaw, -180 * DEG, 'portais: olhando para o sul');
  assert.equal(calls.length, 4);
  assert.throws(() => cmd.run(['99']), /estação desconhecida: 99/);
  assert.throws(() => cmd.run(['torre', '1000']), /ponto desconhecido em torre/);
  assert.equal(calls.length, 4, 'erro não teleporta');

  // Completação: números, ids, apelidos e pontos no primeiro argumento; pontos no segundo.
  const first = cmd.complete(0, '');
  for (const k of ['1', '12', 'strafe', 'torre', 'queda', 'gabarito', 'largada']) assert.ok(first.includes(k), k);
  const second = cmd.complete(1, '');
  assert.ok(second.includes('900') && second.includes('meio'));
});

test('estacao: fora da partida e em mapa sem estações explica o que fazer', () => {
  const con = fakeConsole();
  let match = null;
  registerStationCommands(con, { matchState: () => match });
  const cmd = con.commands.get('estacao');
  assert.throws(() => cmd.run([]), /dentro de uma partida/);
  assert.deepEqual(cmd.complete(0, ''), []);
  match = { map: { id: 'testroom' }, teleport() {} };
  assert.throws(() => cmd.run(['1']), /testroom não tem estações .*map pista/);
});

test('mapa pista registrado: id, apelidos, tipo e a descrição cita o console', () => {
  const def = getMapDef('pista');
  assert.ok(def, 'map pista');
  assert.equal(def.label, 'Pista de testes');
  for (const alias of ['treino', 'parque', 'obstaculos', 'PISTA']) assert.equal(getMapDef(alias), def, alias);
  assert.equal(def.kind, 'teste');
  assert.ok(listMaps().includes(def), 'o lobby e o `map` listam');
  assert.match(def.description, /estacao/);
  assert.equal(typeof def.build, 'function');
});
```


- [ ] **Passo 2: Rodar e ver falhar**

Run: `node --test tests/stationCommands.test.js`
Expected: FAIL — `Cannot find module` de `src/debug/stationCommands.js`.


- [ ] **Passo 3: O mapa** — layout, colisão, estações (altura dos pés por raio), visual, névoa, montagem de luz, sombra estática; se a montagem falhar no meio, libera o que já criou.

```js file=src/maps/pista/index.js
// Pista de testes (subfase 3.3; desenho em docs/phases/phase-3.md, seção 3.3; referências no item 11 do moodboard):
// parque de doze estações num compensado de 5,6 × 4 m no chão do estúdio, cada uma provando um número do movimento com
// objetos de verdade na escala do boneco. A partir do mesmo layout puro (layout.js) monta a colisão (colliders.js), as
// estações do console `estacao` (a altura dos pés sai de um raio na colisão), o visual (visual/) e a montagem de luz
// `pista` (key alta com a única sombra, fill, rim e as luzes práticas da praça e do túnel). Nada na pista se mexe: a
// sombra é feita uma vez (staticShadows).

import * as THREE from 'three';
import { PISTA } from '../../data/pista.js';
import { STUDIO_RIGS } from '../../data/studioRigs.js';
import { EV } from '../../core/events.js';
import { registerMap } from '../registry.js';
import { groundAt, resolveStations } from '../stations.js';
import { StudioRig } from '../../render/studio/studioRig.js';
import { disposeObject3D } from '../../render/dispose.js';
import { CollisionWorld } from '../../physics/collisionWorld.js';
import { buildPistaLayout } from './layout.js';
import { buildPistaColliders } from './colliders.js';
import { buildPistaVisuals } from './visual/index.js';

const DEG = Math.PI / 180;

async function build({ render, config, services }) {
  const set = services.set;
  const scene = new THREE.Scene();
  scene.name = 'pista';
  // Ar do estúdio: névoa quente bem leve (a base inteira fica nítida; o fundo cai para o escuro).
  scene.fog = new THREE.FogExp2(new THREE.Color(PISTA.fog.color), PISTA.fog.density);

  const layout = buildPistaLayout(PISTA);
  const collision = CollisionWorld.fromBuilder(buildPistaColliders(layout), 'pista-de-testes');
  let visuals = null;
  let rig = null;
  try {
    const stations = resolveStations(layout.stations, collision);
    const sp = layout.spawn;
    const spawnY = groundAt(collision, sp.x, sp.z);
    if (spawnY === null) throw new Error('spawn da pista sem chão');

    visuals = buildPistaVisuals({ layout, set, anisotropy: render.anisotropy });
    scene.add(visuals.group);
    services.log?.info(`pista: ${visuals.stats.draws} desenhos estáticos, ${Math.round(visuals.stats.triangles)} triângulos, `
      + `${collision.triangleCount} triângulos de colisão`);

    const rigDef = STUDIO_RIGS.pista;
    rig = new StudioRig({
      def: rigDef, set, renderer: render.renderer, tableY: 0, floorY: null, center: new THREE.Vector3(0, 60, 0),
    }).build(scene);
    rig.setDustDensity(config.get('graphics.particles'));
    const offs = [
      services.events.on(EV.POSE, ({ pose }) => rig.onPose(pose)),
      config.watch('graphics.particles', (e) => rig.setDustDensity(e.value)),
      // GPU reiniciada: o mapa de ambiente assado (reflexo das softboxes) se perdeu com ela.
      services.events.on(EV.RENDER_CONTEXT, ({ lost }) => {
        if (!lost) rig.bakeEnvironment();
      }),
    ];

    const B = PISTA.base;
    const bounds = new THREE.Box3(
      new THREE.Vector3(B.minX, -B.thickness, B.minZ),
      new THREE.Vector3(B.maxX, PISTA.tower.tube.height + 200, B.maxZ),
    );
    return {
      id: 'pista',
      scene,
      bounds,
      rig,
      collision,
      stations,
      layout,
      stats: visuals.stats,
      post: { context: 'jogo', exposure: rigDef.exposure },
      staticShadows: true,
      spawn: {
        position: new THREE.Vector3(sp.x, spawnY, sp.z),
        yaw: -sp.heading * DEG,
        pitch: sp.pitch * DEG,
      },
      frame(dt, camera) {
        rig.frame(camera, render.drawingHeight);
      },
      dispose() {
        for (const off of offs) off();
        rig.dispose();
        visuals.dispose();
      },
    };
  } catch (err) {
    // Montagem pela metade: o matchState não recebe o mapa, então a GPU e a colisão saem aqui.
    rig?.dispose();
    visuals?.dispose();
    collision.dispose();
    disposeObject3D(scene);
    throw err;
  }
}

registerMap({
  id: 'pista',
  label: 'Pista de testes',
  description: '12 estações nos números do movimento: counter-strafe, escadas, rampas, caixas, wall-jump, slide, '
    + 'torre de queda, bhop, vigas, paredes finas, túnel e placas de massinha. Console: estacao.',
  kind: 'teste',
  aliases: ['treino', 'parque', 'obstaculos'],
  build,
});
```


- [ ] **Passo 4: Registro**


Em `src/maps/index.js`, trocar:

```
import './vitrine.js';

```

por:

```
import './vitrine.js';
import './pista/index.js';

```



Em `src/maps/registry.js`, trocar:

```
//   collision?: CollisionWorld (mapa andável: o jogador anda com a cápsula; sem ela, voa com a câmera livre) }
```

por:

```
//   collision?: CollisionWorld (mapa andável: o jogador anda com a cápsula; sem ela, voa com a câmera livre),
//   stations?: [{ number, id, label, aliases, spots: [{ id, label, position, yaw, pitch }] }] (console `estacao`;
//   src/maps/stations.js) }
```


- [ ] **Passo 5: Comando `estacao`**

```js file=src/debug/stationCommands.js
// Comando `estacao` (subfase 3.3): sem argumento lista as estações do mapa (MapInstance.stations) com os pontos; com
// argumento teleporta para uma estação ou ponto — `estacao 7 900`, `estacao bhop`, `estacao gabarito`. O teleporte é
// o do jogador (zera a velocidade e procura o chão) e interrompe o voo do medidor de salto. A busca (número, id,
// apelido ou ponto de nome único; sem acento) fica em src/maps/stations.js.

import { describeStations, findStationSpot } from '../maps/stations.js';

/** @param {{matchState: () => object|null}} ctx */
export function registerStationCommands(con, { matchState }) {
  const current = () => {
    const m = matchState();
    if (!m?.map) throw new Error('só funciona dentro de uma partida');
    const stations = m.map.stations;
    if (!stations?.length) throw new Error(`o mapa ${m.map.id} não tem estações (a pista de testes tem: map pista)`);
    return { m, stations };
  };
  con.register({
    name: 'estacao',
    aliases: ['estação', 'estacoes', 'estações'],
    usage: '[n|nome] [ponto]',
    help: 'lista as estações do mapa ou teleporta para uma (ex.: estacao 7 900, estacao bhop, estacao gabarito)',
    complete: (index) => {
      const m = matchState();
      const stations = m?.map?.stations ?? [];
      if (index === 0) {
        return [...new Set(stations.flatMap((st) => [String(st.number), st.id, ...st.aliases, ...st.spots.map((p) => p.id)]))];
      }
      return index === 1 ? [...new Set(stations.flatMap((st) => st.spots.map((p) => p.id)))] : [];
    },
    run: (args) => {
      const { m, stations } = current();
      if (!args.length) return describeStations(stations);
      const { station, spot } = findStationSpot(stations, args);
      m.teleport(spot.position, spot.yaw, spot.pitch);
      return `estação ${station.number} · ${station.label} — ${spot.label}`;
    },
  });
}
```


Em `src/debug/commands.js`, trocar:

```
import { registerMovementCommands } from './movementCommands.js';
import { onOff } from './consoleArgs.js';
```

por:

```
import { registerMovementCommands } from './movementCommands.js';
import { registerStationCommands } from './stationCommands.js';
import { onOff } from './consoleArgs.js';
```

Em `src/debug/commands.js`, trocar:

```
  registerMovementCommands(con, s);
}
```

por:

```
  registerMovementCommands(con, s);
  // Estações do mapa (pista de testes, 3.3): estacao [n|nome] [ponto].
  registerStationCommands(con, { matchState });
}
```


- [ ] **Passo 6: `cl_salto_reset` e as linhas de salto e bhop no `cl_showpos`**


Em `src/debug/movementCommands.js`, trocar:

```
// do jogador, medidas de counter-strafe e câmera em terceira pessoa. Falam com as mesmas variáveis, chaves de config e
// o mesmo medidor que o jogo usa.
```

por:

```
// do jogador, medidas de counter-strafe e de salto e queda, e câmera em terceira pessoa. Falam com as mesmas variáveis,
// chaves de config e os mesmos medidores que o jogo usa.
```

Em `src/debug/movementCommands.js`, trocar:

```
  toggle('cl_showpos', 'debug.showPos', 'jogador, item na mão, teto, precisão, passos e counter-strafe (com gráfico)');
```

por:

```
  toggle('cl_showpos', 'debug.showPos', 'jogador, item na mão, teto, precisão, passos, counter-strafe (com gráfico) e salto');
  /** Medidor da partida andando (strafe ou jump do matchState). */
  const meterOf = (key) => {
    const meter = s.states.name === 'match' ? s.states.current?.[key] : null;
    if (!meter) throw new Error('só numa partida andando (mapa com colisão)');
    return meter;
  };
```

Em `src/debug/movementCommands.js`, trocar:

```
      const meter = s.states.name === 'match' ? s.states.current?.strafe : null;
      if (!meter) throw new Error('só numa partida andando (mapa com colisão)');
      meter.reset();
      return 'medidas de counter-strafe zeradas';
```

por:

```
      meterOf('strafe').reset();
      return 'medidas de counter-strafe zeradas';
    },
  });
  reg({
    name: 'cl_salto_reset',
    help: 'zera o medidor de salto e queda do cl_showpos (último voo, série de bhop e recordes)',
    run: () => {
      meterOf('jump').reset();
      return 'medidor de salto e queda zerado';
```



Em `src/debug/showPos.js`, trocar:

```
// cl_showpos (Fases 3.1 e 3.2): pés, ângulos, velocidade, chão e cápsula do jogador; item na mão e luneta; o teto do
// tick com os fatores (andar, stamina, agachar); stamina; agachar; a inaccuracy com as partes; último passo e pouso; o
// placar do counter-strafe e o gráfico dos últimos 4 s (src/debug/speedGraph.js). Painel no canto, atualizado 15 vezes
// por segundo (texto, sem custo de layout a cada quadro).
```

por:

```
// cl_showpos (Fases 3.1 a 3.3): pés, ângulos, velocidade, chão e cápsula do jogador; item na mão e luneta; o teto do
// tick com os fatores (andar, stamina, agachar); stamina; agachar; a inaccuracy com as partes; último passo e pouso; o
// placar do counter-strafe, o medidor de salto e queda (último voo, série de bhop e recordes; src/debug/jumpMeter.js) e
// o gráfico dos últimos 4 s (src/debug/speedGraph.js). Painel no canto, atualizado 15 vezes por segundo (texto, sem
// custo de layout a cada quadro).
```

Em `src/debug/showPos.js`, trocar:

```

export class ShowPosPanel {
```

por:

```

/** Linhas do medidor de salto e queda: último voo (e o em andamento), recordes e a série de bhop. */
function jumpLines(m) {
  const last = m.last;
  const lastText = last
    ? `${last.kind} ${last.distance.toFixed(1)} u · ápice ${last.apex.toFixed(1)} · ${last.time.toFixed(2)} s`
      + ` · queda ${last.drop.toFixed(1)} · pouso ${last.landSpeed.toFixed(0)} u/s`
    : '—';
  const air = m.air ? ` · no ar: ${m.air.kind} ${(m.air.ticks * m.dt).toFixed(2)} s, ápice ${(m.air.apex - m.air.y).toFixed(1)}` : '';
  const sr = m.shownSeries;
  const seriesText = sr
    ? `${sr.jumps} pulos · ${sr.distance.toFixed(0)} u em ${sr.time.toFixed(2)} s · média ${sr.avgSpeed.toFixed(0)} u/s`
      + ` · máx. ${sr.maxSpeed.toFixed(0)} u/s${sr.running ? ' · em andamento' : ''}`
    : '—';
  return [
    `salto ${lastText}${air}`,
    `      recordes: distância ${m.best.distance.toFixed(1)} u · queda ${m.best.drop.toFixed(1)} u · série ${m.best.series} pulos`,
    `bhop  ${seriesText}`,
  ];
}

export class ShowPosPanel {
```

Em `src/debug/showPos.js`, trocar:

```
   * @param {import('./strafeMeter.js').StrafeMeter} [meter] placar e marcas do counter-strafe
   */
  update(pawn, meter = null, now = performance.now()) {
```

por:

```
   * @param {{strafe?: import('./strafeMeter.js').StrafeMeter, jump?: import('./jumpMeter.js').JumpMeter}} [meters]
   *   placar e marcas do counter-strafe; medidor de salto e queda
   */
  update(pawn, { strafe: meter = null, jump = null } = {}, now = performance.now()) {
```

Em `src/debug/showPos.js`, trocar:

```
    }
    this.text.textContent = lines.join('\n');
```

por:

```
    }
    if (jump) lines.push(...jumpLines(jump));
    this.text.textContent = lines.join('\n');
```


- [ ] **Passo 7: Partida** — medidor de salto a cada tick (depois do de counter-strafe), teleporte do console e respawn interrompem o voo, dica das estações no HUD.


Em `src/modes/matchState.js`, trocar:

```
// movimento (medidor de counter-strafe) e o resumo que vai para a tela de resultado.
```

por:

```
// movimento (medidores de counter-strafe e de salto e queda), o teleporte das estações (`estacao`, pista de testes) e o
// resumo que vai para a tela de resultado.
```

Em `src/modes/matchState.js`, trocar:

```
import { StrafeMeter } from '../debug/strafeMeter.js';
import { CONTEXT } from '../input/inputManager.js';
```

por:

```
import { StrafeMeter } from '../debug/strafeMeter.js';
import { JumpMeter } from '../debug/jumpMeter.js';
import { CONTEXT } from '../input/inputManager.js';
```

Em `src/modes/matchState.js`, trocar:

```
    this.strafe = null; // medidor de counter-strafe (cl_showpos)
    this.hud = null;
```

por:

```
    this.strafe = null; // medidor de counter-strafe (cl_showpos)
    this.jump = null; // medidor de salto e queda (cl_showpos)
    this.hud = null;
```

Em `src/modes/matchState.js`, trocar:

```
      this.strafe = new StrafeMeter(s.loop.stepDt);
      this.#applyDebugView();
```

por:

```
      this.strafe = new StrafeMeter(s.loop.stepDt);
      this.jump = new JumpMeter(s.loop.stepDt);
      this.#applyDebugView();
```

Em `src/modes/matchState.js`, trocar:

```
    this.hud = createSandboxHud(s, { title: def.label, mode: this.map.collision ? 'andar' : 'voo' });
```

por:

```
    this.hud = createSandboxHud(s, {
      title: def.label, mode: this.map.collision ? 'andar' : 'voo', stations: Boolean(this.map.stations?.length),
    });
```

Em `src/modes/matchState.js`, trocar:

```
      this.strafe.updateFrom(this.player.telemetry);
      // Luneta: a sensibilidade do olhar do próximo quadro segue o nível de zoom deste tick.
```

por:

```
      this.strafe.updateFrom(this.player.telemetry);
      this.jump.update(this.player.state, this.player.env.events);
      // Luneta: a sensibilidade do olhar do próximo quadro segue o nível de zoom deste tick.
```

Em `src/modes/matchState.js`, trocar:

```
    p.teleport(sp.position, sp.yaw, sp.pitch);
```

por:

```
    this.teleport(sp.position, sp.yaw, sp.pitch);
```

Em `src/modes/matchState.js`, trocar:

```
    this.showPos?.update(this.player, this.strafe);
```

por:

```
    this.showPos?.update(this.player, { strafe: this.strafe, jump: this.jump });
```

Em `src/modes/matchState.js`, trocar:

```
    this.strafe = null;
    this.camera = null;
```

por:

```
    this.strafe = null;
    this.jump = null;
    this.camera = null;
```

Em `src/modes/matchState.js`, trocar:

```
  /** Teleporte do console (setpos) e respawn. */
  teleport(position, yaw, pitch) {
    this.player?.teleport(position, yaw, pitch);
```

por:

```
  /** Teleporte do console (setpos, estacao) e respawn: o voo em andamento não conta no medidor de salto. */
  teleport(position, yaw, pitch) {
    this.player?.teleport(position, yaw, pitch);
    this.jump?.interrupt();
```


- [ ] **Passo 8: Dica do HUD e botão do menu**


Em `src/ui/sandboxHud.js`, trocar:

```
// que some sozinha — de andar (mapa com colisão) ou de voar (vitrine). Andando, mostra o item na mão (etiqueta de fita
// crepe) e "ANDANDO" sob a mira com o andar silencioso ligado. O HUD completo de massinha chega na Fase 10.
```

por:

```
// que some sozinha — de andar (mapa com colisão) ou de voar (vitrine); em mapa com estações (pista de testes) a dica do
// teclado cita o `estacao` do console. Andando, mostra o item na mão (etiqueta de fita crepe) e "ANDANDO" sob a mira
// com o andar silencioso ligado. O HUD completo de massinha chega na Fase 10.
```

Em `src/ui/sandboxHud.js`, trocar:

```
/** @param {{title: string, mode?: 'andar'|'voo'}} opts */
export function createSandboxHud(services, { title, mode = 'voo' }) {
  const { events, cheats, input, uiRoot } = services;
  const hints = HINTS[mode] ?? HINTS.voo;
```

por:

```
// O console só existe no teclado: a dica das estações entra na linha do teclado.
const STATIONS_HINT = ' · estacao no console lista as estações e teleporta (estacao 7 900)';

/** @param {{title: string, mode?: 'andar'|'voo', stations?: boolean}} opts */
export function createSandboxHud(services, { title, mode = 'voo', stations = false }) {
  const { events, cheats, input, uiRoot } = services;
  const base = HINTS[mode] ?? HINTS.voo;
  const hints = stations ? { ...base, kbm: base.kbm + STATIONS_HINT } : base;
```



Em `src/ui/menuState.js`, trocar:

```
          btn('Sala de testes', () => s.states.go('match', { map: 'testroom', mode: 'livre' })),
          // Bancada de prova do look de massinha (Fase 2): 20 objetos, painel de luz no Tab, varredura de presets.
```

por:

```
          btn('Sala de testes', () => s.states.go('match', { map: 'testroom', mode: 'livre' })),
          // Parque de estações da Fase 3 (3.3): os números do movimento com objetos de verdade; `estacao` teleporta.
          btn('Pista de testes', () => s.states.go('match', { map: 'pista', mode: 'livre' })),
          // Bancada de prova do look de massinha (Fase 2): 20 objetos, painel de luz no Tab, varredura de presets.
```


- [ ] **Passo 9: Rodar e ver passar**

Run: `node --test tests/stationCommands.test.js`
Expected: PASS (3 testes).


- [ ] **Passo 10: Suíte inteira e tamanhos**

Run: `npm test`
Expected: 213 testes passando.


Run: `wc -l src/maps/pista/*.js src/maps/pista/visual/*.js src/clay/set/*.js src/clay/ClayMaterial.js src/modes/matchState.js | sort -n | tail -5`
Expected: o maior arquivo abaixo de 600 linhas (`ClayMaterial.js`, 554).


- [ ] **Commit (só quando o usuário pedir)**

```bash
git add src/maps src/debug src/modes/matchState.js src/ui tests/stationCommands.test.js
git commit -m "feat(fase-3.3): mapa pista, comando estacao e medidor de salto no cl_showpos" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```


---

### Tarefa 8: Verificação no navegador

O servidor de desenvolvimento de outro chat pode estar na 5173: usar `massacre-dev-auto` (porta livre) ou uma configuração própria. O painel de preview não concede pointer lock a scripts: a entrada de teclado é dirigida pelo próprio `KeyboardMouse` do jogo, como na 3.2.

- [ ] **Passo 1:** `preview_start`; `resize_window` 1920 × 1080; pelo `javascript_tool`: `massacre.console.execute('map pista')`. Primeira vez numa máquina (cache de shader frio): ~20 s na tela "Montando o set"; depois, ~1,5 s de montagem.
- [ ] **Passo 2: Ajudante de entrada e ticks** (colar no `javascript_tool`):

```js
const m = massacre;
const k = m.input.kbm;
k.pointerLocked = true; // o jogo passa a aceitar a entrada de teclado como se o mouse estivesse capturado
m.states.current.hud.setPromptVisible(false);
const pawn = () => m.states.current.player;
window.__t = {
  hold(code) { k.down.add(code); k.pressed.add(code); },
  release(code) { k.down.delete(code); },
  tap(code) { k.pressed.add(code); },
  ticks: (n) => new Promise((done) => {
    const start = pawn().stats.ticks;
    const poll = () => (pawn().stats.ticks - start >= n ? done() : setTimeout(poll, 5));
    poll();
  }),
};
```

- [ ] **Passo 3: Spawn** — a prancheta com a planta a lápis à esquerda (título "Pista de testes — planta", lotes numerados, rota tracejada vermelha, "você está aqui"), a luminária de mesa acesa inteira na vista, a quadra de strafe e as estações ao fundo, a cerca de caixas de papelão com as emendas de fita. `estacao` no console lista as 12 estações com os pontos.
- [ ] **Passo 4: Visual por estação** (`estacao <n>` e noclip para olhar de cima), contra o item 11 do moodboard: 1 papel quadriculado com a faixa vermelha e os pilares de faia; 2 pilhas de livros com lombadas e títulos virados para o sul; 3 caixa de arquivo com alças e as cunhas de papelão; 4 blocos de faia com a altura em estêncil (57/58/64 na frente, 66/67/72 atrás); 5 poço de compensado com as faixas coloridas por dentro e a torre de faia, painéis do zigue-zague; 6 traves (régua, lápis, régua de aço, espeto) com bolotas de massinha nas pontas e o gabarito de portais; 7 tubo enrolado com a espiral de livros, pranchas, alvos no chão e a tábua de crescimento; 8 trena amarela esticada do zero na largada, estojo e bandeirinha na chegada; 9 ripas de balsa com alfinetes; 10 paredes de uma face (sem moiré de longe), fendas, zigue-zague, quina e curva com fitas dobradas no pé; 11 túnel com furos no teto, respiros, pisca-pisca aceso e a luz quente dentro; 12 placas de massinha com P-E-G-A-D-A-S carimbado (lido da praça), borda de furinhos e marcas do rolo.
- [ ] **Passo 5: Medidor de salto** — `cl_showpos 1`; `estacao caixas 57`; `__t.tap('key:Space')`, 80 ticks: linha "salto pulo 0.0 u · ápice 57.0 · 0.75 s · queda 57.0 · pouso 286 u/s". `estacao torre 420`; `__t.hold('key:KeyW')`, 120 ticks, soltar, 80 ticks: "salto queda …" com queda de ~420 u e pouso a ~800 u/s. `cl_salto_reset` zera as linhas.
- [ ] **Passo 6: Desempenho** (Alto, resolução dinâmica desligada, 1920 × 1080; somar as seções de GPU de `massacre.render.stats().gpuSections` em 20 quadros): spawn ~60 draws, ~206 mil triângulos, GPU ~4,2 ms; vista geral de cima ≤ 400 mil triângulos e ≤ 120 draws; sala de testes na mesma máquina para comparar (~3,3 ms).
- [ ] **Passo 7: Memória** — menu ↔ pista 3×: `renderer.info.memory` (geometrias, texturas) e `renderer.info.programs.length` voltam aos valores do menu em todos os ciclos.
- [ ] **Passo 8:** `read_console_messages` sem erros do jogo (o aviso `beforeunload` de navegação feita por script não é do jogo); `resize_window` de volta para `desktop`.

---

### Tarefa 9: Documentação e memória

- [ ] **Passo 1:** `docs/PROGRESS.md` — subfase 3.3 dentro da seção da Fase 3: arquivos criados e alterados, como testar (menu, `map pista`, `estacao`, `cl_showpos`, `cl_salto_reset`), os números medidos (testes e navegador), checklist de aceite marcado e o que vem na 3.4.
- [ ] **Passo 2:** `docs/phases/phase-3.md` — 3.3 ✅ com a data na tabela de estado; checklist de aceite da 3.3 marcado; ajustes feitos na implementação registrados na seção 3.3 (spawn em z = 1200 com pitch −2°, luminária mais baixa, luz do túnel a meia altura, níveis de luz da pista, poeira em caixa, anotações da tábua de crescimento ao longo dela, tapetes e papéis que colidem, lote 11 no compensado nu, chão do estúdio e base da luminária com colisão, placas invertidas para a palavra se ler da praça, ponto da boca do túnel recuado).
- [ ] **Passo 3:** memória do projeto (`massacre-game-project.md`): 3.3 pronta (sem commit, junto com a 3.1 e a 3.2), próxima 3.4 (slide, wall-jump e dano de queda, ajustando só os números provisórios das estações 5 e 6).
- [ ] **Passo 4:** encerrar pedindo um chat novo para a 3.4.
