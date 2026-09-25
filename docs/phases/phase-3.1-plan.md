# Subfase 3.1 — Colisão BVH e controlador cápsula: plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** jogador andando na sala de testes com colisão exata (paredes, quinas, degraus, rampas, teto, beirada), gravidade, pulo, agachar com troca de cápsula, noclip, ferramentas de debug e testes que provam 10 min simulados sem atravessar parede.

**Architecture:** formas de colisão simples por mapa (`ColliderBuilder`) viram corpos com BVH (`CollisionBody`, three-mesh-bvh); o `CollisionWorld` faz a varredura exata da cápsula por avanço conservador (`capsuleSweep.js` sobre `geometryQueries.js`). O `CharacterController` porta o `gamemovement.cpp` do Source (TryPlayerMove, StepMove, StayOnGround, CategorizePosition) e `playerMove()` porta o FullWalkMove com os números do CS:GO. O `PlayerPawn` liga entrada → comando do tick → movimento → câmera interpolada; o `matchState` usa o pawn em mapas com colisão.

**Tech Stack:** JavaScript ES Modules, three 0.186.1, three-mesh-bvh 0.9.15, `node --test`.

**Especificação:** `docs/phases/phase-3.md` (seção 3.1). Regras: `CLAUDE.md` (sem placeholder, < 600 linhas por arquivo, números em `src/data/`).

**Como executar os blocos de código:** cada bloco ` ```js file=<caminho> ` é o conteúdo completo do arquivo. A execução extrai esses blocos com o script da Tarefa 0 (sem redigitar); alterações em arquivos existentes vêm como pares "trocar / por" aplicados com a ferramenta de edição.

**Commits:** os passos "Commit" só rodam quando o usuário pedir. Nesse caso, primeiro criar a branch `fase-3.1` a partir de `main`, e toda mensagem termina com a linha `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

---

## Mapa de arquivos

| Arquivo | Responsabilidade |
|---|---|
| `src/data/movement.js` | cápsula, sv_* do CS:GO e faixas do console, constantes do controlador, agachar, câmera |
| `src/data/surfaces.js` | materiais de superfície da colisão (atrito, pulo, pegadas, volume do passo) |
| `src/player/movementVars.js` | objeto das sv_* em tempo de execução (trocar/limitar/restaurar) |
| `src/physics/geometryQueries.js` | ponto–triângulo, segmento–segmento, segmento–triângulo, raio–caixa, altura de triângulo no disco dos pés (sem alocar) |
| `src/physics/capsuleSweep.js` | varredura exata de cápsula contra um triângulo (avanço conservador) |
| `src/physics/colliders.js` | `ColliderBuilder`: caixa, cilindro, rampa, escada, malha qualquer, objeto com filhos |
| `src/physics/collisionBody.js` | corpo com BVH, triângulos na ordem do BVH, matriz rígida opcional |
| `src/physics/collisionWorld.js` | varredura, contato mais fundo, desempenetração, espaço livre (com filtro), chão da base chata, raio, estatísticas |
| `src/physics/characterController.js` | porte do controlador do Source (deslize, degrau, grudar no chão), chão da base chata, quina baixa, desprender preferindo chão |
| `src/player/moveCmd.js` | comando do tick (botões, movimento, ângulos) a partir da entrada |
| `src/player/movement.js` | `playerMove()`: FullWalkMove, pulo, agachar, atrito/aceleração, noclip |
| `src/player/playerPawn.js` | jogador local: tick, olhar, câmera interpolada e suavizada, terceira pessoa |
| `src/debug/consoleArgs.js` | leitura de 0/1 dos comandos (extraída de `commands.js`) |
| `src/debug/movementCommands.js` | `sv_*`, `sv_reset`, `r_colisao`, `cl_showpos`, `thirdperson`, `firstperson` |
| `src/debug/physicsDebug.js` | arame da colisão, cápsula e normal do chão |
| `src/debug/showPos.js` | painel do `cl_showpos` |
| alterados | `events.js`, `configSchema.js`, `sandbox.js`, `main.js`, `registry.js`, `testRoom.js`, `matchState.js`, `sandboxHud.js`, `overlay.js`, `commands.js`, `styles/debug.css` |
| testes | `movementData`, `physicsMath`, `capsuleSweep`, `collisionWorld`, `characterController`, `movementFuzz`, `playerPawn` + utilitários `physicsTestUtils.js`, `worldTestUtils.js`, `playerTestUtils.js` |

---

### Tarefa 0: Extrator dos blocos do plano

**Files:**
- Create: `<scratchpad>/extract-plan.mjs` (fora do projeto)

- [ ] **Passo 1: Criar o extrator** — lê este plano e grava cada bloco ` ```js file=... ` (ou `css`) no caminho indicado, só para os arquivos pedidos na linha de comando.

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

- [ ] **Passo 2: Conferir** — `node extract-plan.mjs docs/phases/phase-3.1-plan.md . tests/movementData.test.js` grava o arquivo pedido.

---

### Tarefa 1: Dados de movimento, superfícies e variáveis sv_*

**Files:**
- Create: `src/data/movement.js`, `src/data/surfaces.js`, `src/player/movementVars.js`
- Test: `tests/movementData.test.js`

- [ ] **Passo 1: Escrever o teste**

```js file=tests/movementData.test.js
// Testes dos dados de movimento (Fase 3.1): sv_* do CS:GO, faixas do console e materiais de superfície.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HULL, SV_DEFAULTS, SV_VARS, CONTROLLER, DUCK, VIEW } from '../src/data/movement.js';
import { SURFACES, SURFACE_INDEX, surfaceIndex } from '../src/data/surfaces.js';
import { createSvVars, setSvVar, resetSvVars } from '../src/player/movementVars.js';

test('movimento: pulo do CS:GO chega a 57 u e as medidas da cápsula são coerentes', () => {
  const apex = SV_DEFAULTS.jump_impulse ** 2 / (2 * SV_DEFAULTS.gravity);
  assert.ok(Math.abs(apex - 57) < 1e-3, `ápice ${apex}`);
  assert.ok(HULL.duckHeight < HULL.standHeight);
  assert.ok(HULL.duckEye < HULL.standEye && HULL.standEye < HULL.standHeight && HULL.duckEye < HULL.duckHeight);
  assert.ok(HULL.footRadius > 0 && HULL.footRadius <= HULL.radius);
  assert.equal(HULL.airDuckLift * 2, HULL.standHeight - HULL.duckHeight);
  assert.ok(CONTROLLER.walkableNormalY > 0 && CONTROLLER.walkableNormalY < 1);
  assert.ok(CONTROLLER.skin > 0 && CONTROLLER.skin < 0.1);
  assert.ok(DUCK.speedMultiplier > 0 && DUCK.speedMultiplier < 1 && DUCK.speed > 0);
  assert.ok(VIEW.smoothTime > 0 && VIEW.smoothMax >= SV_DEFAULTS.stepsize);
});

test('sv_*: toda variável tem faixa no console e o padrão cabe nela', () => {
  assert.deepEqual(SV_VARS.map((v) => v.key).sort(), Object.keys(SV_DEFAULTS).sort());
  for (const v of SV_VARS) {
    assert.ok(v.min <= SV_DEFAULTS[v.key] && SV_DEFAULTS[v.key] <= v.max, v.key);
    assert.ok(v.help.length > 3, v.key);
  }
});

test('sv_*: troca limitada à faixa, rejeita lixo e volta ao CS:GO', () => {
  const vars = createSvVars();
  assert.equal(setSvVar(vars, 'gravity', '600'), 600);
  assert.equal(vars.gravity, 600);
  assert.equal(setSvVar(vars, 'stepsize', 999), 64);
  assert.equal(setSvVar(vars, 'friction', '4,5'), 4.5);
  assert.throws(() => setSvVar(vars, 'gravidade', 1), /desconhecida/);
  assert.throws(() => setSvVar(vars, 'gravity', 'abc'), /inválido/);
  resetSvVars(vars);
  assert.deepEqual(vars, { ...SV_DEFAULTS });
});

test('superfícies: ids únicos, índice e erro para id desconhecido', () => {
  const ids = SURFACES.map((s) => s.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.ok(SURFACES.length < 256, 'o índice precisa caber em Uint8');
  ids.forEach((id, i) => assert.equal(SURFACE_INDEX[id], i));
  assert.equal(surfaceIndex('massinha'), SURFACE_INDEX.massinha);
  assert.equal(surfaceIndex(3), 3);
  assert.ok(SURFACES[SURFACE_INDEX.massinha].imprint);
  for (const s of SURFACES) assert.ok(s.friction > 0 && s.jumpFactor > 0 && s.step >= 0, s.id);
  assert.throws(() => surfaceIndex('lava'), /desconhecida/);
  assert.throws(() => surfaceIndex(999), /desconhecida/);
});
```

- [ ] **Passo 2: Rodar e ver falhar** — `node --test tests/movementData.test.js` → FAIL (módulos inexistentes).

- [ ] **Passo 3: Implementar**

```js file=src/data/movement.js
// Movimento do jogador (seção 0.6): cápsula, constantes do controlador e variáveis sv_* no modelo do CS:GO.
// Unidades: 1 u = 1 cm na escala do boneco (72 u de altura) — as mesmas do CS, então os números batem com os dele.
// As sv_* mudam em tempo de execução pelo console (`sv_gravity 600`); na partida online o host as replica.

/** Jogador: cápsula para colidir e base chata (disco dos pés) para o chão. A origem fica nos pés (centro da base). */
export const HULL = Object.freeze({
  radius: 16, // hull de 32 × 32 do CS (o corpo do boneco de referência tem raio ~15)
  standHeight: 72,
  duckHeight: 54,
  standEye: 64, // VEC_VIEW
  duckEye: 46, // VEC_DUCK_VIEW
  airDuckLift: 9, // agachar no ar: pés sobem 9 u e a cabeça desce 9 u (pulo agachado ≈ 66 u, alcança caixa de 64)
  footRadius: 16, // disco dos pés: fica de pé em qualquer chão andável que ele cubra (o fundo reto da caixa do CS)
});

/** Variáveis de servidor com os valores do CS:GO. A chave é o nome do console sem o prefixo `sv_`. */
export const SV_DEFAULTS = Object.freeze({
  gravity: 800,
  maxspeed: 320, // teto do desejo de movimento
  maxvelocity: 3500, // teto por eixo
  accelerate: 5.5,
  airaccelerate: 12,
  air_max_wishspeed: 30,
  friction: 5.2,
  stopspeed: 80,
  stepsize: 18,
  jump_impulse: 301.993377, // √(2·800·57): ápice de 57 u
  bounce: 0,
});

/** Faixa aceita e ajuda de cada sv_* no console. */
export const SV_VARS = Object.freeze([
  Object.freeze({ key: 'gravity', min: 0, max: 4000, help: 'gravidade (u/s²)' }),
  Object.freeze({ key: 'maxspeed', min: 1, max: 2000, help: 'teto do desejo de movimento (u/s)' }),
  Object.freeze({ key: 'maxvelocity', min: 100, max: 10000, help: 'velocidade máxima por eixo (u/s)' }),
  Object.freeze({ key: 'accelerate', min: 0, max: 100, help: 'aceleração no chão' }),
  Object.freeze({ key: 'airaccelerate', min: 0, max: 1000, help: 'aceleração no ar' }),
  Object.freeze({ key: 'air_max_wishspeed', min: 0, max: 1000, help: 'desejo máximo de velocidade no ar (u/s)' }),
  Object.freeze({ key: 'friction', min: 0, max: 100, help: 'atrito no chão' }),
  Object.freeze({ key: 'stopspeed', min: 0, max: 1000, help: 'velocidade de parada do atrito (u/s)' }),
  Object.freeze({ key: 'stepsize', min: 0, max: 64, help: 'altura máxima de degrau (u)' }),
  Object.freeze({ key: 'jump_impulse', min: 0, max: 2000, help: 'velocidade vertical do pulo (u/s)' }),
  Object.freeze({ key: 'bounce', min: 0, max: 2, help: 'quique nas paredes no ar' }),
]);

/** Constantes do controlador (gamemovement.cpp do Source). */
export const CONTROLLER = Object.freeze({
  skin: 0.03125, // DIST_EPSILON: a cápsula para a esta distância das superfícies
  groundProbe: 2, // chão até esta distância abaixo dos pés ainda segura o jogador (ele encosta nele)
  walkableNormalY: 0.7, // chão andável até ~45,6°
  supportTolerance: 0.05, // folga (u) ao comparar alturas do chão da base chata
  edgeContactDot: 0.9999, // normal de contato × normal da face abaixo disto: contato de aresta ou vértice
  nonJumpVelocity: 140, // subindo mais rápido que isso não gruda no chão
  maxBumps: 4,
  maxClipPlanes: 5,
  minSpeed: 1, // abaixo disso (u/s) a velocidade no chão zera
  steepSlideFriction: 0.25, // atrito da superfície subindo em rampa íngreme
  snapMin: 0.015625, // ajuste mínimo (u) para grudar no chão (meia COORD_RESOLUTION)
  depenetrateIterations: 8,
  penetrationTolerance: 0.01, // penetração real (u) abaixo disso não conta como preso
  unstuckRadii: Object.freeze([4, 8, 16, 24, 32, 48, 64]), // anéis da busca por espaço livre
  unstuckPreferGround: 8, // empurrão maior que isto (u) para um lugar sem chão: procura antes um lugar livre com chão
  unstuckGroundDepth: 128, // "com chão": chão da base chata até esta distância (u) abaixo dos pés
  discreteStepTolerance: 0.25, // variação de altura além da inclinação do chão (u) que a câmera trata como degrau
});

/** Agachar (CS:GO). */
export const DUCK = Object.freeze({
  speed: 8, // fração da transição por segundo (0,125 s)
  speedMultiplier: 0.34, // velocidade agachado
});

/** Câmera do jogador: suavização de degrau e de troca de cápsula no ar; terceira pessoa (debug). */
export const VIEW = Object.freeze({
  smoothTime: 0.06, // constante de tempo (s) do decaimento da suavização
  smoothMax: 24, // teto do deslocamento suavizado (u)
  thirdPersonDistance: 120,
  thirdPersonHeight: 12,
  thirdPersonProbe: 6, // raio da esfera que recolhe a câmera ao bater em parede
});
```

```js file=src/data/surfaces.js
// Materiais de superfície da colisão. Cada triângulo de colisão guarda o índice do seu material
// (src/physics/colliders.js). Campos:
//   friction: multiplica o sv_friction e a aceleração no chão (o competitivo usa 1 em tudo, como os mapas do CS)
//   jumpFactor: multiplica o impulso do pulo
//   imprint: aceita pegadas (massinha)
//   step: volume relativo do passo (áudio e audição dos bots)

const S = (o) => Object.freeze(o);

export const SURFACES = Object.freeze([
  S({ id: 'padrao', label: 'Padrão', friction: 1, jumpFactor: 1, imprint: false, step: 0.8 }),
  S({ id: 'tapete', label: 'Tapete de corte', friction: 1, jumpFactor: 1, imprint: false, step: 0.7 }),
  S({ id: 'papelao', label: 'Papelão', friction: 1, jumpFactor: 1, imprint: false, step: 0.9 }),
  S({ id: 'massinha', label: 'Massinha', friction: 1, jumpFactor: 1, imprint: true, step: 0.5 }),
  S({ id: 'madeira', label: 'Madeira', friction: 1, jumpFactor: 1, imprint: false, step: 0.85 }),
  S({ id: 'metal', label: 'Metal de ferramenta', friction: 1, jumpFactor: 1, imprint: false, step: 1 }),
  S({ id: 'plastico', label: 'Plástico de pote', friction: 1, jumpFactor: 1, imprint: false, step: 0.85 }),
  S({ id: 'fita', label: 'Fita crepe', friction: 1, jumpFactor: 1, imprint: false, step: 0.6 }),
  S({ id: 'arame', label: 'Arame', friction: 1, jumpFactor: 1, imprint: false, step: 0.9 }),
  S({ id: 'tecido', label: 'Tecido (molleton)', friction: 1, jumpFactor: 1, imprint: false, step: 0.4 }),
]);

export const SURFACE_INDEX = Object.freeze(Object.fromEntries(SURFACES.map((s, i) => [s.id, i])));

/** Índice do material (aceita id ou índice); erro para material desconhecido — pega erro de digitação no mapa. */
export function surfaceIndex(id) {
  if (typeof id === 'number') {
    if (Number.isInteger(id) && id >= 0 && id < SURFACES.length) return id;
    throw new Error(`superfície desconhecida: ${id}`);
  }
  const i = SURFACE_INDEX[id];
  if (i === undefined) throw new Error(`superfície desconhecida: ${id}`);
  return i;
}
```

```js file=src/player/movementVars.js
// Variáveis sv_* de movimento em tempo de execução: um objeto simples que o controlador lê a cada tick
// (acesso direto por propriedade). O console troca os valores; `resetSvVars` volta aos do CS:GO.

import { SV_DEFAULTS, SV_VARS } from '../data/movement.js';

const BY_KEY = Object.freeze(Object.fromEntries(SV_VARS.map((v) => [v.key, v])));

export function createSvVars() {
  return { ...SV_DEFAULTS };
}

/** Troca uma variável (limitada à faixa do console). Devolve o valor aplicado; erro para chave ou valor inválido. */
export function setSvVar(vars, key, value) {
  const spec = BY_KEY[key];
  if (!spec) throw new Error(`variável desconhecida: sv_${key}`);
  const n = typeof value === 'string' ? Number(value.replace(',', '.')) : Number(value);
  if (!Number.isFinite(n)) throw new Error(`valor inválido para sv_${key}: ${value}`);
  vars[key] = Math.min(spec.max, Math.max(spec.min, n));
  return vars[key];
}

export function resetSvVars(vars) {
  return Object.assign(vars, SV_DEFAULTS);
}
```

- [ ] **Passo 4: Rodar e ver passar** — `node --test tests/movementData.test.js` → 4 testes PASS.

- [ ] **Passo 5: Commit** — `git add src/data/movement.js src/data/surfaces.js src/player/movementVars.js tests/movementData.test.js && git commit -m "feat(fase-3.1): dados de movimento, superfícies e variáveis sv_*"`

---

### Tarefa 2: Consultas geométricas

**Files:**
- Create: `src/physics/geometryQueries.js`, `tests/physicsTestUtils.js` (primeira versão: só `triangleArray`)
- Test: `tests/physicsMath.test.js`

- [ ] **Passo 1: Utilitário de teste mínimo** (a Tarefa 4 grava a versão completa do mesmo arquivo)

```js file=tests/physicsTestUtils.js
// Utilitários dos testes de física: triângulos no formato do mundo de colisão.

/** Float64Array no formato dos triângulos do mundo (a, b, c, normal unitária); null se degenerado. */
export function triangleArray([ax, ay, az, bx, by, bz, cx, cy, cz]) {
  const abx = bx - ax, aby = by - ay, abz = bz - az;
  const acx = cx - ax, acy = cy - ay, acz = cz - az;
  const nx = aby * acz - abz * acy;
  const ny = abz * acx - abx * acz;
  const nz = abx * acy - aby * acx;
  const len = Math.hypot(nx, ny, nz);
  if (len < 1e-3) return null;
  return Float64Array.of(ax, ay, az, bx, by, bz, cx, cy, cz, nx / len, ny / len, nz / len);
}

/** Triângulo aleatório não degenerado dentro de [−span, span]³. */
export function randomTriangle(rng, span = 100) {
  for (;;) {
    const T = triangleArray(Array.from({ length: 9 }, () => rng.float(-span, span)));
    if (T) return T;
  }
}
```

- [ ] **Passo 2: Escrever o teste**

```js file=tests/physicsMath.test.js
// Testes das consultas geométricas (Fase 3.1) contra força bruta: ponto–triângulo, segmento–segmento,
// segmento–triângulo, raio–caixa e altura de triângulo dentro de cilindro vertical (chão da base chata).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RNG } from '../src/core/rng.js';
import {
  closestPointTriangle, closestSegmentSegment, closestSegmentTriangle, createClosest, createSegmentPair, rayBoxEntry,
  triangleDiscRange,
} from '../src/physics/geometryQueries.js';
import { randomTriangle, triangleArray } from './physicsTestUtils.js';

const dist2 = (ax, ay, az, bx, by, bz) => (ax - bx) ** 2 + (ay - by) ** 2 + (az - bz) ** 2;

/** Coordenadas baricêntricas de P (no plano do triângulo). */
function barycentric(T, px, py, pz) {
  const v0 = [T[3] - T[0], T[4] - T[1], T[5] - T[2]];
  const v1 = [T[6] - T[0], T[7] - T[1], T[8] - T[2]];
  const v2 = [px - T[0], py - T[1], pz - T[2]];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const d00 = dot(v0, v0), d01 = dot(v0, v1), d11 = dot(v1, v1), d20 = dot(v2, v0), d21 = dot(v2, v1);
  const den = d00 * d11 - d01 * d01;
  const v = (d11 * d20 - d01 * d21) / den;
  const w = (d00 * d21 - d01 * d20) / den;
  return [1 - v - w, v, w];
}

function assertOnTriangle(T, x, y, z, msg) {
  const planeDist = (x - T[0]) * T[9] + (y - T[1]) * T[10] + (z - T[2]) * T[11];
  assert.ok(Math.abs(planeDist) < 1e-6, `${msg}: fora do plano (${planeDist})`);
  for (const b of barycentric(T, x, y, z)) assert.ok(b > -1e-7, `${msg}: fora do triângulo (${b})`);
}

/** Menor distância² de P a uma grade baricêntrica densa do triângulo. */
function bruteTriangle(T, px, py, pz, n = 60) {
  let best = Infinity;
  for (let i = 0; i <= n; i++) {
    for (let j = 0; i + j <= n; j++) {
      const u = i / n, v = j / n;
      const x = T[0] + u * (T[3] - T[0]) + v * (T[6] - T[0]);
      const y = T[1] + u * (T[4] - T[1]) + v * (T[7] - T[1]);
      const z = T[2] + u * (T[5] - T[2]) + v * (T[8] - T[2]);
      best = Math.min(best, dist2(px, py, pz, x, y, z));
    }
  }
  return best;
}

test('ponto–triângulo: o ponto devolvido está no triângulo e é o mais próximo (400 casos)', () => {
  const rng = new RNG('ponto-triangulo');
  const out = createClosest();
  for (let n = 0; n < 400; n++) {
    const T = randomTriangle(rng, 80);
    const px = rng.float(-150, 150), py = rng.float(-150, 150), pz = rng.float(-150, 150);
    const d = closestPointTriangle(px, py, pz, T, 0, out);
    assertOnTriangle(T, out.x, out.y, out.z, `caso ${n}`);
    assert.ok(Math.abs(d - dist2(px, py, pz, out.x, out.y, out.z)) < 1e-6);
    assert.ok(d <= bruteTriangle(T, px, py, pz) + 1e-9, `caso ${n}: não é o mínimo`);
  }
});

test('ponto–triângulo: regiões de vértice, aresta e face', () => {
  const T = triangleArray([0, 0, 0, 10, 0, 0, 0, 10, 0]);
  const out = createClosest();
  assert.equal(closestPointTriangle(-5, -5, 3, T, 0, out), 59);
  assert.deepEqual([out.x, out.y, out.z], [0, 0, 0]);
  closestPointTriangle(5, -4, 0, T, 0, out);
  assert.deepEqual([out.x, out.y, out.z], [5, 0, 0]);
  assert.equal(closestPointTriangle(2, 3, 7, T, 0, out), 49);
  assert.deepEqual([out.x, out.y, out.z], [2, 3, 0]);
});

test('segmento–segmento: parâmetros em [0, 1] e mínimo contra grade densa (300 casos)', () => {
  const rng = new RNG('segmento-segmento');
  const out = createSegmentPair();
  for (let n = 0; n < 300; n++) {
    const p = Array.from({ length: 12 }, () => rng.float(-100, 100));
    // um em cada cinco casos com segmentos paralelos (o caso difícil do algoritmo)
    if (n % 5 === 0) {
      p[9] = p[6] + (p[3] - p[0]) * 0.7;
      p[10] = p[7] + (p[4] - p[1]) * 0.7;
      p[11] = p[8] + (p[5] - p[2]) * 0.7;
    }
    const d = closestSegmentSegment(...p, out);
    assert.ok(out.s >= 0 && out.s <= 1 && out.t >= 0 && out.t <= 1);
    assert.ok(Math.abs(out.px - (p[0] + (p[3] - p[0]) * out.s)) < 1e-9);
    assert.ok(Math.abs(out.qz - (p[8] + (p[11] - p[8]) * out.t)) < 1e-9);
    let brute = Infinity;
    for (let i = 0; i <= 120; i++) {
      for (let j = 0; j <= 120; j++) {
        const s = i / 120, t = j / 120;
        brute = Math.min(brute, dist2(
          p[0] + (p[3] - p[0]) * s, p[1] + (p[4] - p[1]) * s, p[2] + (p[5] - p[2]) * s,
          p[6] + (p[9] - p[6]) * t, p[7] + (p[10] - p[7]) * t, p[8] + (p[11] - p[8]) * t,
        ));
      }
    }
    assert.ok(d <= brute + 1e-9, `caso ${n}: ${d} > ${brute}`);
  }
});

test('segmento–triângulo: pontos válidos, mínimo contra amostragem e zero quando fura (300 casos)', () => {
  const rng = new RNG('segmento-triangulo');
  const out = createClosest();
  const tmp = createClosest();
  for (let n = 0; n < 300; n++) {
    const T = randomTriangle(rng, 70);
    const p = Array.from({ length: 6 }, () => rng.float(-120, 120));
    const d = closestSegmentTriangle(...p, T, 0, out);
    assertOnTriangle(T, out.x, out.y, out.z, `caso ${n}`);
    assert.ok(Math.abs(d - dist2(out.x, out.y, out.z, out.sx, out.sy, out.sz)) < 1e-6);
    let brute = Infinity;
    for (let k = 0; k <= 300; k++) {
      const s = k / 300;
      brute = Math.min(brute, closestPointTriangle(
        p[0] + (p[3] - p[0]) * s, p[1] + (p[4] - p[1]) * s, p[2] + (p[5] - p[2]) * s, T, 0, tmp,
      ));
    }
    assert.ok(d <= brute + 1e-9, `caso ${n}: ${d} > ${brute}`);
  }
  // Segmento vertical furando o miolo do triângulo horizontal.
  const flat = triangleArray([-10, 0, -10, 10, 0, -10, 0, 0, 10]);
  assert.equal(closestSegmentTriangle(1, -5, 0, 1, 5, 0, flat, 0, out), 0);
  assert.deepEqual([out.x, out.y, out.z], [1, 0, 0]);
});

test('raio–caixa: entrada, dentro, falta, paralelo e limite de tempo', () => {
  const box = [-1, -1, -1, 1, 1, 1];
  assert.equal(rayBoxEntry(-5, 0, 0, 10, 0, 0, ...box, 1), 0.4);
  assert.equal(rayBoxEntry(0, 0, 0, 10, 0, 0, ...box, 1), 0);
  assert.equal(rayBoxEntry(-5, 3, 0, 10, 0, 0, ...box, 1), Infinity);
  assert.equal(rayBoxEntry(-5, 0, 0, 0, 0, 0, ...box, 1), Infinity);
  assert.equal(rayBoxEntry(-5, 0, 0, 10, 0, 0, ...box, 0.3), Infinity);
  assert.equal(rayBoxEntry(5, 0, 0, -10, 0, 0, ...box, 1), 0.4);
});

test('triângulo × cilindro vertical: alcance de altura contém e acompanha a amostragem densa (300 casos)', () => {
  const rng = new RNG('disco');
  const out = { min: 0, max: 0 };
  const N = 160;
  let hits = 0;
  for (let n = 0; n < 300; n++) {
    let T;
    do T = randomTriangle(rng, 60);
    while (Math.abs(T[10]) < 0.5); // até ~60°: a altura é afim sobre XZ
    const sign = T[10] >= 0 ? 1 : -1;
    const nx = T[9] * sign, ny = T[10] * sign, nz = T[11] * sign;
    const cx = rng.float(-60, 60), cz = rng.float(-60, 60), r = rng.float(2, 30);
    const found = triangleDiscRange(T, nx, ny, nz, cx, cz, r, out);
    let min = Infinity;
    let max = -Infinity;
    for (let i = 0; i <= N; i++) {
      for (let j = 0; j <= N - i; j++) {
        const u = i / N, v = j / N;
        const x = T[0] + (T[3] - T[0]) * u + (T[6] - T[0]) * v;
        const z = T[2] + (T[5] - T[2]) * u + (T[8] - T[2]) * v;
        if ((x - cx) ** 2 + (z - cz) ** 2 > r * r) continue;
        const y = T[1] + (T[4] - T[1]) * u + (T[7] - T[1]) * v;
        if (y < min) min = y;
        if (y > max) max = y;
      }
    }
    if (min > max) continue; // interseção pequena demais para a grade: só o lado exato vê
    hits++;
    assert.ok(found, `caso ${n}: amostras dentro do disco, mas sem alcance`);
    assert.ok(out.min <= min + 1e-9 && out.max >= max - 1e-9, `caso ${n}: alcance [${out.min}, ${out.max}] não cobre [${min}, ${max}]`);
    // A grade anda no máximo ~170/N u entre amostras; a altura muda no máximo inclinação × isso.
    const tol = (170 / N) * (Math.hypot(nx, nz) / ny) + 1e-6;
    assert.ok(out.min >= min - tol && out.max <= max + tol, `caso ${n}: alcance [${out.min}, ${out.max}] longe de [${min}, ${max}]`);
  }
  assert.ok(hits > 100, `poucos casos com interseção (${hits})`);
});
```

- [ ] **Passo 3: Rodar e ver falhar** — `node --test tests/physicsMath.test.js` → FAIL (módulo inexistente).

- [ ] **Passo 4: Implementar**

```js file=src/physics/geometryQueries.js
// Consultas geométricas puras e sem alocação: ponto–triângulo, segmento–segmento, segmento–triângulo, raio–caixa e
// alcance de altura de um triângulo dentro de um cilindro vertical (chão da base chata). Base da varredura de cápsula
// (capsuleSweep.js) e das consultas do mundo de colisão. Algoritmos de Ericson,
// "Real-Time Collision Detection": 5.1.5 (ponto–triângulo), 5.1.9 (segmento–segmento), 5.3.3 (raio–caixa).
// Triângulos ficam num Float64Array com passo TRI_STRIDE: a(3) b(3) c(3) normal unitária(3), com a normal
// coerente com a ordem a → b → c.

export const TRI_STRIDE = 12;

const EPS = 1e-12;
const PARALLEL_EPS = 1e-10;

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

/** Resultado reutilizável: ponto no triângulo (x, y, z) e ponto no segmento (sx, sy, sz). */
export function createClosest() {
  return { x: 0, y: 0, z: 0, sx: 0, sy: 0, sz: 0 };
}

/** Resultado reutilizável do segmento–segmento: parâmetros s e t e os pontos em P (px…) e em Q (qx…). */
export function createSegmentPair() {
  return { s: 0, t: 0, px: 0, py: 0, pz: 0, qx: 0, qy: 0, qz: 0 };
}

/** Ponto do triângulo `o` de T mais próximo de P (Ericson 5.1.5). Escreve em out.x/y/z; devolve a distância². */
export function closestPointTriangle(px, py, pz, T, o, out) {
  const ax = T[o], ay = T[o + 1], az = T[o + 2];
  const bx = T[o + 3], by = T[o + 4], bz = T[o + 5];
  const cx = T[o + 6], cy = T[o + 7], cz = T[o + 8];
  const abx = bx - ax, aby = by - ay, abz = bz - az;
  const acx = cx - ax, acy = cy - ay, acz = cz - az;
  const apx = px - ax, apy = py - ay, apz = pz - az;
  const d1 = abx * apx + aby * apy + abz * apz;
  const d2 = acx * apx + acy * apy + acz * apz;
  let qx;
  let qy;
  let qz;
  if (d1 <= 0 && d2 <= 0) {
    qx = ax; qy = ay; qz = az;
  } else {
    const bpx = px - bx, bpy = py - by, bpz = pz - bz;
    const d3 = abx * bpx + aby * bpy + abz * bpz;
    const d4 = acx * bpx + acy * bpy + acz * bpz;
    const vc = d1 * d4 - d3 * d2;
    if (d3 >= 0 && d4 <= d3) {
      qx = bx; qy = by; qz = bz;
    } else if (vc <= 0 && d1 >= 0 && d3 <= 0) {
      const v = d1 / (d1 - d3);
      qx = ax + v * abx; qy = ay + v * aby; qz = az + v * abz;
    } else {
      const cpx = px - cx, cpy = py - cy, cpz = pz - cz;
      const d5 = abx * cpx + aby * cpy + abz * cpz;
      const d6 = acx * cpx + acy * cpy + acz * cpz;
      const vb = d5 * d2 - d1 * d6;
      const va = d3 * d6 - d5 * d4;
      if (d6 >= 0 && d5 <= d6) {
        qx = cx; qy = cy; qz = cz;
      } else if (vb <= 0 && d2 >= 0 && d6 <= 0) {
        const w = d2 / (d2 - d6);
        qx = ax + w * acx; qy = ay + w * acy; qz = az + w * acz;
      } else if (va <= 0 && d4 - d3 >= 0 && d5 - d6 >= 0) {
        const w = (d4 - d3) / (d4 - d3 + (d5 - d6));
        qx = bx + w * (cx - bx); qy = by + w * (cy - by); qz = bz + w * (cz - bz);
      } else {
        const denom = 1 / (va + vb + vc);
        const v = vb * denom;
        const w = vc * denom;
        qx = ax + abx * v + acx * w; qy = ay + aby * v + acy * w; qz = az + abz * v + acz * w;
      }
    }
  }
  out.x = qx;
  out.y = qy;
  out.z = qz;
  const dx = px - qx, dy = py - qy, dz = pz - qz;
  return dx * dx + dy * dy + dz * dz;
}

/** Pontos mais próximos entre os segmentos P0P1 e Q0Q1 (Ericson 5.1.9). Escreve em `out`; devolve a distância². */
export function closestSegmentSegment(p0x, p0y, p0z, p1x, p1y, p1z, q0x, q0y, q0z, q1x, q1y, q1z, out) {
  const d1x = p1x - p0x, d1y = p1y - p0y, d1z = p1z - p0z;
  const d2x = q1x - q0x, d2y = q1y - q0y, d2z = q1z - q0z;
  const rx = p0x - q0x, ry = p0y - q0y, rz = p0z - q0z;
  const a = d1x * d1x + d1y * d1y + d1z * d1z;
  const e = d2x * d2x + d2y * d2y + d2z * d2z;
  const f = d2x * rx + d2y * ry + d2z * rz;
  let s;
  let t;
  if (a <= EPS && e <= EPS) {
    s = 0;
    t = 0;
  } else if (a <= EPS) {
    s = 0;
    t = clamp01(f / e);
  } else {
    const c = d1x * rx + d1y * ry + d1z * rz;
    if (e <= EPS) {
      t = 0;
      s = clamp01(-c / a);
    } else {
      const b = d1x * d2x + d1y * d2y + d1z * d2z;
      const denom = a * e - b * b;
      // Quase paralelos: qualquer s serve; s = 0 e o ajuste de t abaixo acham o par certo.
      s = denom > PARALLEL_EPS * a * e ? clamp01((b * f - c * e) / denom) : 0;
      t = (b * s + f) / e;
      if (t < 0) {
        t = 0;
        s = clamp01(-c / a);
      } else if (t > 1) {
        t = 1;
        s = clamp01((b - c) / a);
      }
    }
  }
  out.s = s;
  out.t = t;
  out.px = p0x + d1x * s;
  out.py = p0y + d1y * s;
  out.pz = p0z + d1z * s;
  out.qx = q0x + d2x * t;
  out.qy = q0y + d2y * t;
  out.qz = q0z + d2z * t;
  const dx = out.px - out.qx, dy = out.py - out.qy, dz = out.pz - out.qz;
  return dx * dx + dy * dy + dz * dz;
}

/** P (já no plano do triângulo) está dentro dele? Usa a normal guardada, coerente com a ordem a → b → c. */
function insideTriangle(px, py, pz, T, o) {
  const nx = T[o + 9], ny = T[o + 10], nz = T[o + 11];
  for (let e = 0; e < 3; e++) {
    const i0 = o + e * 3;
    const i1 = o + ((e + 1) % 3) * 3;
    const ex = T[i1] - T[i0], ey = T[i1 + 1] - T[i0 + 1], ez = T[i1 + 2] - T[i0 + 2];
    const wx = px - T[i0], wy = py - T[i0 + 1], wz = pz - T[i0 + 2];
    if ((ey * wz - ez * wy) * nx + (ez * wx - ex * wz) * ny + (ex * wy - ey * wx) * nz < 0) return false;
  }
  return true;
}

const _pair = createSegmentPair();

/**
 * Pontos mais próximos entre o segmento P0P1 e o triângulo `o` de T. Escreve em `out` o ponto no triângulo (x, y, z)
 * e o ponto no segmento (sx, sy, sz); devolve a distância² (0 quando o segmento fura o triângulo).
 * Candidatos (Ericson 5.1): furo no plano dentro do triângulo; senão as duas pontas contra o triângulo e o
 * segmento contra as três arestas (um par de mais próximos sempre envolve um desses).
 */
export function closestSegmentTriangle(p0x, p0y, p0z, p1x, p1y, p1z, T, o, out) {
  const ax = T[o], ay = T[o + 1], az = T[o + 2];
  const nx = T[o + 9], ny = T[o + 10], nz = T[o + 11];
  const e0 = (p0x - ax) * nx + (p0y - ay) * ny + (p0z - az) * nz;
  const e1 = (p1x - ax) * nx + (p1y - ay) * ny + (p1z - az) * nz;
  if ((e0 <= 0 && e1 >= 0) || (e0 >= 0 && e1 <= 0)) {
    const den = e0 - e1;
    if (den !== 0) {
      const t = e0 / den;
      const ix = p0x + (p1x - p0x) * t;
      const iy = p0y + (p1y - p0y) * t;
      const iz = p0z + (p1z - p0z) * t;
      if (insideTriangle(ix, iy, iz, T, o)) {
        out.x = ix;
        out.y = iy;
        out.z = iz;
        out.sx = ix;
        out.sy = iy;
        out.sz = iz;
        return 0;
      }
    }
  }
  let best = closestPointTriangle(p0x, p0y, p0z, T, o, out);
  let bx = out.x, by = out.y, bz = out.z;
  let sx = p0x, sy = p0y, sz = p0z;
  const d = closestPointTriangle(p1x, p1y, p1z, T, o, out);
  if (d < best) {
    best = d;
    bx = out.x; by = out.y; bz = out.z;
    sx = p1x; sy = p1y; sz = p1z;
  }
  for (let e = 0; e < 3; e++) {
    const i0 = o + e * 3;
    const i1 = o + ((e + 1) % 3) * 3;
    const de = closestSegmentSegment(p0x, p0y, p0z, p1x, p1y, p1z, T[i0], T[i0 + 1], T[i0 + 2], T[i1], T[i1 + 1], T[i1 + 2], _pair);
    if (de < best) {
      best = de;
      bx = _pair.qx; by = _pair.qy; bz = _pair.qz;
      sx = _pair.px; sy = _pair.py; sz = _pair.pz;
    }
  }
  out.x = bx;
  out.y = by;
  out.z = bz;
  out.sx = sx;
  out.sy = sy;
  out.sz = sz;
  return best;
}

/**
 * Tempo de entrada do raio O + t·D, t ∈ [0, tMax], na caixa [min, max] (lajes, Ericson 5.3.3).
 * 0 se O já está dentro; Infinity se o raio não entra na caixa nesse intervalo.
 */
export function rayBoxEntry(ox, oy, oz, dx, dy, dz, minX, minY, minZ, maxX, maxY, maxZ, tMax) {
  let t0 = 0;
  let t1 = tMax;
  if (dx > -EPS && dx < EPS) {
    if (ox < minX || ox > maxX) return Infinity;
  } else {
    const inv = 1 / dx;
    let a = (minX - ox) * inv;
    let b = (maxX - ox) * inv;
    if (a > b) { const tmp = a; a = b; b = tmp; }
    if (a > t0) t0 = a;
    if (b < t1) t1 = b;
    if (t0 > t1) return Infinity;
  }
  if (dy > -EPS && dy < EPS) {
    if (oy < minY || oy > maxY) return Infinity;
  } else {
    const inv = 1 / dy;
    let a = (minY - oy) * inv;
    let b = (maxY - oy) * inv;
    if (a > b) { const tmp = a; a = b; b = tmp; }
    if (a > t0) t0 = a;
    if (b < t1) t1 = b;
    if (t0 > t1) return Infinity;
  }
  if (dz > -EPS && dz < EPS) {
    if (oz < minZ || oz > maxZ) return Infinity;
  } else {
    const inv = 1 / dz;
    let a = (minZ - oz) * inv;
    let b = (maxZ - oz) * inv;
    if (a > b) { const tmp = a; a = b; b = tmp; }
    if (a > t0) t0 = a;
    if (b < t1) t1 = b;
    if (t0 > t1) return Infinity;
  }
  return t0;
}

/** Altura do plano do triângulo P (normal n, não vertical) no ponto (x, z). */
function planeY(P, nx, ny, nz, x, z) {
  return P[1] - (nx * (x - P[0]) + nz * (z - P[2])) / ny;
}

/** (x, z) dentro da projeção XZ do triângulo P (qualquer orientação, borda inclusa)? */
function insideXZ(P, x, z) {
  const d0 = (P[3] - P[0]) * (z - P[2]) - (P[5] - P[2]) * (x - P[0]);
  const d1 = (P[6] - P[3]) * (z - P[5]) - (P[8] - P[5]) * (x - P[3]);
  const d2 = (P[0] - P[6]) * (z - P[8]) - (P[2] - P[8]) * (x - P[6]);
  const eps = 1e-9;
  return (d0 >= -eps && d1 >= -eps && d2 >= -eps) || (d0 <= eps && d1 <= eps && d2 <= eps);
}

/**
 * Alcance de altura do triângulo P (9 números, mundo, não vertical) dentro do cilindro vertical de raio r em (cx, cz).
 * A altura é afim sobre a projeção XZ, então os extremos em triângulo ∩ disco ficam em vértices dentro do disco,
 * cruzamentos das arestas com o círculo ou nos pontos do círculo na direção de subida/descida do plano (o centro,
 * se o plano é horizontal). false se o triângulo não chega ao disco.
 */
export function triangleDiscRange(P, nx, ny, nz, cx, cz, r, out) {
  const r2 = r * r;
  let min = Infinity;
  let max = -Infinity;
  for (let k = 0; k < 9; k += 3) {
    const dx = P[k] - cx, dz = P[k + 2] - cz;
    if (dx * dx + dz * dz <= r2) {
      if (P[k + 1] < min) min = P[k + 1];
      if (P[k + 1] > max) max = P[k + 1];
    }
  }
  for (let k = 0; k < 9; k += 3) {
    const b = (k + 3) % 9;
    const ex = P[b] - P[k], ez = P[b + 2] - P[k + 2];
    const A = ex * ex + ez * ez;
    if (A < 1e-18) continue;
    const fx = P[k] - cx, fz = P[k + 2] - cz;
    const B = fx * ex + fz * ez;
    const disc = B * B - A * (fx * fx + fz * fz - r2);
    if (disc < 0) continue;
    const sq = Math.sqrt(disc);
    for (let s = -1; s <= 1; s += 2) {
      const t = (-B + s * sq) / A;
      if (t < 0 || t > 1) continue;
      const y = P[k + 1] + t * (P[b + 1] - P[k + 1]);
      if (y < min) min = y;
      if (y > max) max = y;
    }
  }
  const gx = -nx / ny, gz = -nz / ny; // subida da altura por unidade em X e em Z
  const g = Math.hypot(gx, gz);
  if (g < 1e-12) {
    if (insideXZ(P, cx, cz)) {
      const y = planeY(P, nx, ny, nz, cx, cz);
      if (y < min) min = y;
      if (y > max) max = y;
    }
  } else {
    const ux = (gx / g) * r, uz = (gz / g) * r;
    for (let s = -1; s <= 1; s += 2) {
      const x = cx + s * ux, z = cz + s * uz;
      if (!insideXZ(P, x, z)) continue;
      const y = planeY(P, nx, ny, nz, x, z);
      if (y < min) min = y;
      if (y > max) max = y;
    }
  }
  if (min > max) return false;
  out.min = min;
  out.max = max;
  return true;
}
```

- [ ] **Passo 5: Rodar e ver passar** — `node --test tests/physicsMath.test.js` → 6 testes PASS.

- [ ] **Passo 6: Commit** — `git add src/physics/geometryQueries.js tests/physicsMath.test.js tests/physicsTestUtils.js && git commit -m "feat(fase-3.1): consultas geométricas sem alocação (ponto, segmento, triângulo, caixa)"`

---

### Tarefa 3: Varredura exata de cápsula contra triângulo

**Files:**
- Create: `src/physics/capsuleSweep.js`
- Test: `tests/capsuleSweep.test.js`

- [ ] **Passo 1: Escrever o teste**

```js file=tests/capsuleSweep.test.js
// Testes da varredura de cápsula (Fase 3.1): contato exato de face, começo encostado, vértice rasante e 400 casos
// aleatórios conferidos por amostragem do caminho (nenhum contato antes do t devolvido).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RNG } from '../src/core/rng.js';
import { closestSegmentTriangle, createClosest } from '../src/physics/geometryQueries.js';
import { SWEEP_TOLERANCE, createSweepHit, sweepCapsuleTriangle } from '../src/physics/capsuleSweep.js';
import { randomTriangle, triangleArray } from './physicsTestUtils.js';

const TARGET = 16 + 0.03125;
const FLOOR = triangleArray([-1000, 0, 1000, 1000, 0, 1000, 0, 0, -1000]); // normal +Y
const c = createClosest();

/** Distância segmento–triângulo com o segmento s (6 números) deslocado por t·d. */
function distAt(T, s, d, t) {
  return Math.sqrt(closestSegmentTriangle(
    s[0] + d[0] * t, s[1] + d[1] * t, s[2] + d[2] * t, s[3] + d[0] * t, s[4] + d[1] * t, s[5] + d[2] * t, T, 0, c,
  ));
}

test('varredura: contato de face para exatamente a raio + folga', () => {
  const hit = createSweepHit();
  assert.ok(sweepCapsuleTriangle(0, 66, 0, 0, 106, 0, 0, -100, 0, FLOOR, 0, TARGET, 1, hit));
  assert.ok(Math.abs(hit.t - (66 - TARGET) / 100) < 1e-9, `t ${hit.t}`);
  assert.ok(Math.abs(hit.ny - 1) < 1e-12 && Math.abs(hit.py) < 1e-12);
  assert.equal(hit.startDist, 66);
  assert.equal(sweepCapsuleTriangle(0, 66, 0, 0, 106, 0, 0, -40, 0, FLOOR, 0, TARGET, 1, hit), false, 'para antes do chão');
  assert.equal(sweepCapsuleTriangle(0, 66, 0, 0, 106, 0, 0, -100, 0, FLOOR, 0, TARGET, 0.4, hit), false, 'além do tMax');
});

test('varredura: começando encostado só bloqueia se estiver se aproximando', () => {
  const hit = createSweepHit();
  assert.equal(sweepCapsuleTriangle(0, TARGET, 0, 0, TARGET + 40, 0, 50, 0, 0, FLOOR, 0, TARGET, 1, hit), false, 'deslizando rente');
  assert.equal(sweepCapsuleTriangle(0, TARGET, 0, 0, TARGET + 40, 0, 0, 10, 0, FLOOR, 0, TARGET, 1, hit), false, 'saindo');
  assert.equal(sweepCapsuleTriangle(0, TARGET, 0, 0, TARGET + 40, 0, 10, -1, 0, FLOOR, 0, TARGET, 1, hit), true, 'entrando');
  assert.equal(hit.t, 0);
  assert.ok(hit.ny > 0.999);
});

test('varredura: vértice rasante passa quando sobra folga e bate onde a geometria manda quando falta', () => {
  const wall = triangleArray([-50, -100, 0, 50, -100, 0, 0, 0, 0]); // triângulo em pé no plano z = 0, topo em (0, 0, 0)
  const hit = createSweepHit();
  const above = TARGET + 0.01;
  assert.equal(sweepCapsuleTriangle(0, above, -100, 0, above, -100, 0, 0, 200, wall, 0, TARGET, 1, hit), false);
  const below = TARGET - 0.5;
  assert.ok(sweepCapsuleTriangle(0, below, -100, 0, below, -100, 0, 0, 200, wall, 0, TARGET, 1, hit));
  const zHit = -100 + 200 * hit.t;
  const expected = -Math.sqrt(TARGET * TARGET - below * below);
  assert.ok(Math.abs(zHit - expected) < 0.01, `z ${zHit} × ${expected}`);
  assert.ok(Math.hypot(hit.px, hit.py, hit.pz) < 1e-6, 'contato no vértice do topo');
});

test('varredura: nenhum contato antes do t devolvido e distância = alvo no contato (400 casos)', () => {
  const rng = new RNG('varredura');
  const hit = createSweepHit();
  const axis = { x: 0, y: 0, z: 0 };
  const dir = { x: 0, y: 0, z: 0 };
  let hits = 0;
  let misses = 0;
  for (let n = 0; n < 400; n++) {
    const T = randomTriangle(rng, 60);
    rng.onUnitSphere(axis);
    rng.onUnitSphere(dir);
    const len = rng.float(0, 60);
    const b = [rng.float(-120, 120), rng.float(-120, 120), rng.float(-120, 120)];
    const s = [b[0], b[1], b[2], b[0] + axis.x * len, b[1] + axis.y * len, b[2] + axis.z * len];
    let d;
    if (n % 2 === 0) {
      // Metade dos casos mira um ponto do triângulo (sorteando só a direção, quase tudo passa longe); o alcance
      // varia, então parte para antes — faltas rentes ao contato também são conferidas.
      let u = rng.next();
      let v = rng.next();
      if (u + v > 1) {
        u = 1 - u;
        v = 1 - v;
      }
      const reach = rng.float(0.5, 2);
      const p = [0, 1, 2].map((k) => T[k] + (T[3 + k] - T[k]) * u + (T[6 + k] - T[k]) * v);
      const m = [0, 1, 2].map((k) => (s[k] + s[3 + k]) / 2);
      d = [(p[0] - m[0]) * reach + dir.x * 20, (p[1] - m[1]) * reach + dir.y * 20, (p[2] - m[2]) * reach + dir.z * 20];
    } else {
      const v = rng.float(1, 300);
      d = [dir.x * v, dir.y * v, dir.z * v];
    }
    const speed = Math.hypot(d[0], d[1], d[2]);
    if (distAt(T, s, d, 0) <= TARGET + 0.01) continue; // começar encostado tem teste próprio
    const ok = sweepCapsuleTriangle(...s, ...d, T, 0, TARGET, 1, hit);
    const tEnd = ok ? hit.t : 1;
    const N = 400;
    for (let k = 0; k < N; k++) {
      const t = (tEnd * k) / N;
      if (distAt(T, s, d, t) < TARGET - (speed * tEnd) / N - 1e-6) assert.fail(`caso ${n}: contato antes do t (${t})`);
    }
    if (!ok) {
      misses++;
      continue;
    }
    hits++;
    const at = distAt(T, s, d, hit.t);
    assert.ok(at >= TARGET - 1e-6 && at <= TARGET + SWEEP_TOLERANCE + 1e-6, `caso ${n}: distância no contato ${at}`);
    assert.ok(Math.abs(Math.hypot(hit.nx, hit.ny, hit.nz) - 1) < 1e-9);
    const nx = (c.sx - c.x) / at, ny = (c.sy - c.y) / at, nz = (c.sz - c.z) / at;
    assert.ok(nx * hit.nx + ny * hit.ny + nz * hit.nz > 0.999, `caso ${n}: normal não aponta do triângulo para a cápsula`);
  }
  assert.ok(hits > 50 && misses > 50, `cobertura: ${hits} contatos, ${misses} faltas`);
});
```

- [ ] **Passo 2: Rodar e ver falhar** — `node --test tests/capsuleSweep.test.js` → FAIL (módulo inexistente).

- [ ] **Passo 3: Implementar**

```js file=src/physics/capsuleSweep.js
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
```

- [ ] **Passo 4: Rodar e ver passar** — `node --test tests/capsuleSweep.test.js` → 4 testes PASS.

- [ ] **Passo 5: Commit** — `git add src/physics/capsuleSweep.js tests/capsuleSweep.test.js && git commit -m "feat(fase-3.1): varredura exata de cápsula por avanço conservador"`

---

### Tarefa 4: Formas de colisão, corpo com BVH e mundo de colisão

**Files:**
- Create: `src/physics/colliders.js`, `src/physics/collisionBody.js`, `src/physics/collisionWorld.js`, `tests/worldTestUtils.js`
- Test: `tests/collisionWorld.test.js`

- [ ] **Passo 1: Utilitário de mundos para os testes**

```js file=tests/worldTestUtils.js
// Utilitários dos testes de física: mundos de colisão montados com o ColliderBuilder.
import { ColliderBuilder } from '../src/physics/colliders.js';
import { CollisionWorld } from '../src/physics/collisionWorld.js';

/** Mundo com um corpo estático montado por `build(builder)`. */
export function worldOf(build) {
  const b = new ColliderBuilder();
  build(b);
  return CollisionWorld.fromBuilder(b, 'teste');
}

/** Chão: laje de 8 u com o topo em y = 0. */
export function floor(b, size = 4000, surface = 'tapete') {
  return b.box(size, 8, size, { center: [0, -4, 0], surface });
}
```

- [ ] **Passo 2: Escrever o teste**

```js file=tests/collisionWorld.test.js
// Testes do mundo de colisão (Fase 3.1): formas do ColliderBuilder, corpo com BVH, varredura igual à força bruta,
// corpo transformado igual ao assado, chão da base chata, começo penetrando, desempenetração (inclusive furando), espaço
// livre e raio.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { RNG } from '../src/core/rng.js';
import { SURFACE_INDEX } from '../src/data/surfaces.js';
import { CONTROLLER, HULL } from '../src/data/movement.js';
import { TRI_STRIDE } from '../src/physics/geometryQueries.js';
import { createSweepHit, sweepCapsuleTriangle } from '../src/physics/capsuleSweep.js';
import { ColliderBuilder } from '../src/physics/colliders.js';
import { CollisionBody } from '../src/physics/collisionBody.js';
import { CollisionWorld, createRayHit, createTrace } from '../src/physics/collisionWorld.js';
import { floor, worldOf } from './worldTestUtils.js';

const R = 16;
const H = 72;
const SKIN = CONTROLLER.skin;

test('ColliderBuilder: triângulos por forma, degenerados descartados e superfícies', () => {
  const b = new ColliderBuilder();
  b.box(10, 10, 10, { surface: 'papelao' });
  assert.equal(b.triangleCount, 12);
  b.cylinder(5, 10, { segments: 16, surface: 'plastico' });
  assert.equal(b.triangleCount, 12 + 64);
  b.ramp(10, 20, 5, { surface: 'madeira' });
  assert.equal(b.triangleCount, 76 + 8);
  b.stairs(10, 4, 6, 3);
  assert.equal(b.triangleCount, 84 + 36);
  const v = new THREE.Vector3(1, 2, 3);
  b.triangle(v, v, new THREE.Vector3(4, 5, 6));
  assert.equal(b.skipped, 1);
  assert.throws(() => b.box(1, 1, 1, { surface: 'lava' }), /desconhecida/);
  assert.equal(b.triangleCount, 120, 'erro de superfície não deixa triângulo pela metade');
  const data = b.build();
  assert.equal(data.positions.length, data.surfaces.length * 9);
  assert.equal(data.surfaces[0], SURFACE_INDEX.papelao);
  assert.equal(data.surfaces[12], SURFACE_INDEX.plastico);
});

test('ColliderBuilder.object: malhas do objeto nas matrizes de mundo, polos degenerados descartados', () => {
  const group = new THREE.Group();
  group.position.set(100, 0, 0);
  const profile = [new THREE.Vector2(0, 0), new THREE.Vector2(10, 0), new THREE.Vector2(10, 20), new THREE.Vector2(0, 20)];
  const lathe = new THREE.Mesh(new THREE.LatheGeometry(profile, 8));
  lathe.position.set(0, 5, 0);
  group.add(lathe, new THREE.Mesh(new THREE.BoxGeometry(4, 4, 4)));
  const b = new ColliderBuilder();
  b.object(group, { surface: 'plastico' });
  // Torno: 3 trechos × 8 fatias × 2 triângulos = 48; nos dois polos (raio 0) um triângulo por fatia é degenerado.
  assert.equal(b.skipped, 16);
  assert.equal(b.triangleCount, 48 - 16 + 12);
  const data = b.build();
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (let i = 0; i < data.positions.length; i += 3) {
    minX = Math.min(minX, data.positions[i]);
    maxX = Math.max(maxX, data.positions[i]);
    minY = Math.min(minY, data.positions[i + 1]);
    maxY = Math.max(maxY, data.positions[i + 1]);
  }
  assert.ok(Math.abs(minX - 90) < 1e-9 && Math.abs(maxX - 110) < 1e-9, `x de ${minX} a ${maxX}`);
  assert.ok(Math.abs(minY + 2) < 1e-9 && Math.abs(maxY - 25) < 1e-9, `y de ${minY} a ${maxY}`);
  assert.ok(data.surfaces.every((s) => s === SURFACE_INDEX.plastico));
});

test('CollisionBody: triângulos na ordem do BVH com normal unitária e a superfície certa', () => {
  const b = new ColliderBuilder();
  b.box(100, 10, 100, { center: [0, -5, 0], surface: 'tapete' });
  b.cylinder(20, 50, { center: [30, 0, 30], surface: 'plastico' });
  const body = new CollisionBody(b.build(), { name: 'teste' });
  assert.equal(body.triangleCount, 12 + 128);
  let tapete = 0;
  let plastico = 0;
  for (let i = 0; i < body.triangleCount; i++) {
    const o = i * TRI_STRIDE;
    assert.ok(Math.abs(Math.hypot(body.tris[o + 9], body.tris[o + 10], body.tris[o + 11]) - 1) < 1e-12);
    if (body.surface[i] === SURFACE_INDEX.tapete) {
      tapete++;
      for (let k = 0; k < 3; k++) assert.ok(body.tris[o + k * 3 + 1] <= 0, 'vértice da laje fora dela');
    }
    if (body.surface[i] === SURFACE_INDEX.plastico) plastico++;
  }
  assert.equal(tapete, 12);
  assert.equal(plastico, 128);
  body.dispose();
});

/** Menor t de contato varrendo todos os triângulos, sem BVH. */
function bruteSweep(world, o, d) {
  const hit = createSweepHit();
  let best = 1;
  let found = false;
  for (const body of world.bodies) {
    for (let i = 0; i < body.triangleCount; i++) {
      if (sweepCapsuleTriangle(o[0], o[1] + R, o[2], o[0], o[1] + H - R, o[2], d[0], d[1], d[2],
        body.tris, i * TRI_STRIDE, R + SKIN, best, hit)) {
        best = hit.t;
        found = true;
      }
    }
  }
  return { found, best };
}

test('varredura do mundo = força bruta sobre todos os triângulos (300 varreduras)', () => {
  const rng = new RNG('mundo');
  const world = worldOf((b) => {
    floor(b, 2000);
    for (let i = 0; i < 6; i++) {
      b.box(rng.float(20, 120), rng.float(20, 200), rng.float(20, 120), {
        center: [rng.float(-400, 400), rng.float(0, 100), rng.float(-400, 400)], surface: 'papelao',
      });
    }
    b.cylinder(30, 120, { center: [100, 0, -100], surface: 'plastico' });
    b.cylinder(12, 60, { segments: 12, center: [-150, 0, 200] });
    b.ramp(100, 200, 80, { center: [0, 0, 250], surface: 'madeira' });
  });
  const tr = createTrace();
  let hits = 0;
  for (let n = 0; n < 300; n++) {
    const o = [rng.float(-500, 500), rng.float(1, 300), rng.float(-500, 500)];
    const d = [rng.float(-400, 400), rng.float(-300, 300), rng.float(-400, 400)];
    world.sweepCapsule(...o, ...d, R, H, tr);
    const ref = bruteSweep(world, o, d);
    assert.equal(tr.hit, ref.found, `varredura ${n}`);
    if (ref.found) {
      hits++;
      assert.ok(Math.abs(tr.fraction - ref.best) < 1e-12, `varredura ${n}: ${tr.fraction} × ${ref.best}`);
      assert.ok(Math.abs(tr.normal.length() - 1) < 1e-9);
      assert.ok(tr.faceNormal.dot(tr.normal) >= 0);
    } else {
      assert.equal(tr.fraction, 1);
    }
    assert.ok(Math.abs(tr.endpos.x - (o[0] + d[0] * tr.fraction)) < 1e-9);
  }
  assert.ok(hits > 60, `poucos contatos (${hits})`);
});

test('corpo com matriz rígida responde igual ao mesmo corpo assado no mundo', () => {
  const m = new THREE.Matrix4().makeRotationY(0.6).setPosition(120, 10, -80);
  const moving = new CollisionWorld();
  const body = moving.addBody(new CollisionBody(new ColliderBuilder().box(80, 60, 30, { surface: 'metal' }).build(), { name: 'movel', matrix: m }));
  const fixed = CollisionWorld.fromBuilder(new ColliderBuilder().box(80, 60, 30, { matrix: m, surface: 'metal' }), 'assado');
  assert.ok(body.transformed);
  const rng = new RNG('corpo-movel');
  const a = createTrace();
  const b = createTrace();
  for (let n = 0; n < 200; n++) {
    const o = [rng.float(-100, 300), rng.float(-60, 80), rng.float(-250, 100)];
    const d = [rng.float(-300, 300), rng.float(-100, 100), rng.float(-300, 300)];
    moving.sweepCapsule(...o, ...d, R, H, a);
    fixed.sweepCapsule(...o, ...d, R, H, b);
    assert.equal(a.hit, b.hit, `varredura ${n}`);
    assert.ok(Math.abs(a.fraction - b.fraction) < 1e-6, `varredura ${n}: ${a.fraction} × ${b.fraction}`);
    if (a.hit) {
      assert.ok(a.normal.distanceTo(b.normal) < 1e-4, `varredura ${n}: normal`);
      // Aresta vertical ou parede, paralelas ao eixo da cápsula: o ponto de contato não é único ao longo de Y.
      // (A normal da face também não: numa aresta é a de qualquer das faces — o chão tem consulta própria, a base chata.)
      assert.ok(Math.hypot(a.point.x - b.point.x, a.point.z - b.point.z) < 1e-3, `varredura ${n}: ponto`);
      if (Math.abs(a.point.y - b.point.y) > 1e-3) assert.ok(Math.abs(a.normal.y) < 1e-6, `varredura ${n}: Y só varia de lado`);
    }
  }
  body.setMatrix(new THREE.Matrix4().makeTranslation(0, 1000, 0));
  moving.sweepCapsule(120, 0, -300, 0, 0, 400, R, H, a);
  assert.equal(a.hit, false, 'o corpo saiu do caminho');
});

test('chão da base chata: face andável mais alta sob o disco dos pés (corpo parado e girado)', () => {
  const DEG = Math.PI / 180;
  const FOOT = HULL.footRadius;
  const out = { height: 0, normal: new THREE.Vector3(), surface: -1 };
  for (const matrix of [null, new THREE.Matrix4().makeRotationY(0.7).setPosition(30, 0, -20)]) {
    const b = new ColliderBuilder();
    b.box(800, 8, 800, { center: [0, -4, 0], surface: 'tapete' }); // chão em y = 0
    b.box(100, 40, 100, { center: [0, 20, 0], surface: 'madeira' }); // caixa: topo em 40, bordas em x, z = ±50
    b.ramp(100, 100, 100 * Math.tan(30 * DEG), { center: [200, 0, 0], surface: 'papelao' }); // 30°, sobe em +Z
    b.ramp(100, 40, 40 * Math.tan(60 * DEG), { center: [-200, 0, 0], surface: 'metal' }); // 60°: não é chão
    b.box(60, 10, 60, { center: [0, 105, 300], surface: 'metal' }); // prateleira: fundo em 100, topo em 110
    const world = new CollisionWorld();
    world.addBody(new CollisionBody(b.build(), { name: 'chao', matrix }));
    const query = (x, z, minY = -20, maxY = 200) => {
      const p = new THREE.Vector3(x, 0, z);
      if (matrix) p.applyMatrix4(matrix);
      return world.supportBelow(p.x, p.z, FOOT, minY, maxY, CONTROLLER.walkableNormalY, out);
    };
    assert.ok(query(0, 0) && Math.abs(out.height - 40) < 1e-9 && out.normal.y > 0.999, 'topo da caixa');
    assert.equal(out.surface, SURFACE_INDEX.madeira);
    assert.ok(query(50 + FOOT - 0.1, 0) && Math.abs(out.height - 40) < 1e-9, 'o disco ainda cobre a borda por 0,1 u');
    assert.ok(query(50 + FOOT + 0.1, 0) && Math.abs(out.height) < 1e-9, 'passou do raio: chão');
    assert.equal(out.surface, SURFACE_INDEX.tapete);
    assert.ok(query(50 + FOOT - 0.1, 50 + FOOT - 0.1) && Math.abs(out.height) < 1e-9, 'quina: o disco não chega nela');
    assert.ok(query(0, 0, -20, 30) && out.height <= 30, 'fora do intervalo pedido não conta');
    // Rampa de 30° no meio: a borda do disco morro acima segura (tan 30° × 16 u acima do ponto sob o eixo).
    assert.ok(query(200, 50), 'rampa');
    assert.ok(Math.abs(out.height - (50 + FOOT) * Math.tan(30 * DEG)) < 1e-9, `altura na rampa ${out.height}`);
    assert.ok(Math.abs(out.normal.y - Math.cos(30 * DEG)) < 1e-9 && out.surface === SURFACE_INDEX.papelao);
    // A mesma rampa com o teto do intervalo abaixo da borda de cima: ela sobe além dele dentro do disco — é obstáculo
    // acima da base, não chão (senão a base "pousaria" cortada no teto do intervalo).
    assert.ok(query(200, 50, -20, 30) && Math.abs(out.height) < 1e-9, `rampa acima do intervalo: ${out.height}`);
    // Rampa de 60°: íngreme, não segura — vale o chão por baixo dela.
    assert.ok(query(-200, 20) && Math.abs(out.height) < 1e-9, 'rampa íngreme');
    // Fundo da prateleira (virado para baixo) no intervalo: o sólido está por cima dele — não segura a base.
    assert.equal(query(0, 300, 90, 105), false, 'fundo de prateleira não é chão');
    assert.ok(query(0, 300, 90, 120) && Math.abs(out.height - 110) < 1e-9, 'topo da prateleira');
    assert.equal(query(1000, 1000), false, 'fora do mapa');
  }
});

test('varredura: startSolid ao começar penetrando e entrando mais; de fora para a raio + folga', () => {
  const world = worldOf((b) => b.box(200, 200, 200, { center: [0, 100, -100] })); // face em z = 0
  const tr = createTrace();
  world.sweepCapsule(0, 50, 10, 0, 0, -10, R, H, tr);
  assert.ok(tr.hit && tr.startSolid && tr.fraction === 0);
  world.sweepCapsule(0, 50, 10, 0, 0, 10, R, H, tr);
  assert.equal(tr.hit, false, 'saindo passa');
  world.sweepCapsule(0, 50, 100, 0, 0, -200, R, H, tr);
  assert.ok(tr.hit && !tr.startSolid);
  assert.ok(Math.abs(tr.endpos.z - (R + SKIN)) < 2e-3, `z ${tr.endpos.z}`);
  assert.ok(tr.normal.z > 0.999);
  assert.ok(world.stats.sweeps >= 3 && world.stats.triangles > 0);
});

test('desempenetração: sai de lado até raio + folga e sai por cima quando a laje fura a cápsula', () => {
  const world = worldOf((b) => b.box(200, 200, 200, { center: [0, 100, -100] })); // face em z = 0
  const pos = new THREE.Vector3(0, 50, 11); // eixo a 11 u da face: 5 u para dentro
  assert.equal(world.canOccupy(pos.x, pos.y, pos.z, R, H), false);
  assert.ok(world.depenetrate(pos, R, H));
  assert.ok(Math.abs(pos.z - (R + SKIN)) < 1e-3, `z ${pos.z}`);
  assert.ok(Math.abs(pos.x) < 1e-9 && Math.abs(pos.y - 50) < 1e-9);
  assert.ok(world.canOccupy(pos.x, pos.y, pos.z, R, H));

  const slab = worldOf((b) => b.box(400, 1, 400, { center: [0, 30, 0] })); // laje de y 29,5 a 30,5
  const p2 = new THREE.Vector3(0, 0, 0); // o meio do segmento (y = 36) está acima: sai por cima
  assert.ok(slab.depenetrate(p2, R, H));
  assert.ok(p2.y >= 30.5 + SKIN - 1e-3, `y ${p2.y}`);
  assert.ok(slab.canOccupy(p2.x, p2.y, p2.z, R, H));
});

test('espaço livre: espremido num vão de 20 u, sai para o lado livre mais próximo', () => {
  const world = worldOf((b) => {
    floor(b, 1000);
    b.box(2, 60, 400, { center: [11, 30, 0] });
    b.box(2, 60, 400, { center: [-11, 30, 0] });
  });
  const start = new THREE.Vector3(0, SKIN, 0);
  assert.equal(world.depenetrate(start.clone(), R, H), false, 'não cabe no vão');
  const pos = start.clone();
  assert.ok(world.findFreeSpot(pos, R, H));
  assert.ok(world.canOccupy(pos.x, pos.y, pos.z, R, H));
  assert.ok(Math.abs(pos.x) >= 12 + R, `continua no vão (x ${pos.x})`);
  assert.ok(pos.distanceTo(start) <= 64 * Math.SQRT2 + 1);
});

test('raio: face mais próxima, normal contra o raio, superfície, dos dois lados e falta', () => {
  const world = worldOf((b) => {
    b.box(100, 100, 100, { center: [0, 50, 0], surface: 'papelao' });
    b.box(100, 100, 100, { center: [0, 50, 300], surface: 'metal' });
  });
  const hit = createRayHit();
  assert.ok(world.raycast(0, 50, -300, 0, 0, 1, 1000, hit));
  assert.ok(Math.abs(hit.distance - 250) < 1e-9);
  assert.ok(hit.normal.distanceTo(new THREE.Vector3(0, 0, -1)) < 1e-9);
  assert.equal(hit.surface, SURFACE_INDEX.papelao);
  assert.ok(Math.abs(hit.point.z + 50) < 1e-9);
  assert.ok(world.raycast(0, 50, 0, 0, 0, 1, 1000, hit), 'de dentro bate na face de trás');
  assert.ok(Math.abs(hit.distance - 50) < 1e-9);
  assert.equal(world.raycast(0, 500, 0, 0, 0, 1, 1000, hit), false);
  assert.equal(hit.distance, 1000);
  assert.equal(world.raycast(0, 50, -300, 0, 0, 1, 100, hit), false, 'além do alcance');
  assert.ok(world.stats.rays >= 4);
});
```

- [ ] **Passo 3: Rodar e ver falhar** — `node --test tests/collisionWorld.test.js` → FAIL (módulos inexistentes).

- [ ] **Passo 4: Implementar as formas de colisão**

```js file=src/physics/colliders.js
// Formas de colisão dos mapas, separadas da malha visual: o boil e as digitais da massinha são deformação de
// shader (não podem virar tropeço) e malha densa deixaria cada varredura cara. Cada mapa monta as suas formas com o
// ColliderBuilder e entrega o resultado ao CollisionBody. Cada triângulo guarda o material de superfície
// (src/data/surfaces.js), usado no atrito, no pulo, nos passos e nas pegadas.

import * as THREE from 'three';
import { surfaceIndex } from '../data/surfaces.js';

const MIN_CROSS_SQ = 1e-10; // |(b − a) × (c − a)|² menor que isto: triângulo degenerado (descartado)
const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const _c = new THREE.Vector3();

/** Matriz objeto → mundo de uma forma: `matrix`, ou translação para `center` ([x, y, z] ou {x, y, z}). */
function placement(matrix, center) {
  const m = new THREE.Matrix4();
  if (matrix) return m.copy(matrix);
  if (center) m.makeTranslation(center.x ?? center[0], center.y ?? center[1], center.z ?? center[2]);
  return m;
}

export class ColliderBuilder {
  constructor() {
    this.positions = [];
    this.surfaces = [];
    this.skipped = 0;
  }

  get triangleCount() {
    return this.surfaces.length;
  }

  /** Triângulo em espaço de mundo; `surface` é o id do material (ou o índice já resolvido). */
  triangle(a, b, c, surface = 'padrao') {
    const sid = surfaceIndex(surface);
    const abx = b.x - a.x, aby = b.y - a.y, abz = b.z - a.z;
    const acx = c.x - a.x, acy = c.y - a.y, acz = c.z - a.z;
    const cx = aby * acz - abz * acy;
    const cy = abz * acx - abx * acz;
    const cz = abx * acy - aby * acx;
    if (cx * cx + cy * cy + cz * cz < MIN_CROSS_SQ) {
      this.skipped++;
      return this;
    }
    this.positions.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
    this.surfaces.push(sid);
    return this;
  }

  /** Quadrilátero a-b-c-d em ordem (triângulos abc e acd). */
  quad(a, b, c, d, surface = 'padrao') {
    return this.triangle(a, b, c, surface).triangle(a, c, d, surface);
  }

  /** Malha qualquer (indexada ou não) levada ao mundo por `matrix` — para malhas já simples (chão, placas, props). */
  geometry(geometry, { matrix = null, surface = 'padrao' } = {}) {
    const pos = geometry.attributes.position;
    const index = geometry.index;
    const count = index ? index.count : pos.count;
    const sid = surfaceIndex(surface);
    for (let i = 0; i + 2 < count; i += 3) {
      _a.fromBufferAttribute(pos, index ? index.getX(i) : i);
      _b.fromBufferAttribute(pos, index ? index.getX(i + 1) : i + 1);
      _c.fromBufferAttribute(pos, index ? index.getX(i + 2) : i + 2);
      if (matrix) {
        _a.applyMatrix4(matrix);
        _b.applyMatrix4(matrix);
        _c.applyMatrix4(matrix);
      }
      this.triangle(_a, _b, _c, sid);
    }
    return this;
  }

  /**
   * Todas as malhas de um objeto (e dos filhos) nas matrizes de mundo atuais: props que colidem com a própria forma
   * visual (pote, ferramenta, boneco). Paredes e chão com relevo visual usam caixas.
   */
  object(root, { surface = 'padrao' } = {}) {
    root.updateWorldMatrix(true, true);
    root.traverse((o) => {
      if (o.isMesh) this.geometry(o.geometry, { matrix: o.matrixWorld, surface });
    });
    return this;
  }

  /** Caixa w × h × d centrada na origem do objeto, posta no mundo por `matrix` ou `center`. */
  box(w, h, d, { matrix = null, center = null, surface = 'padrao' } = {}) {
    const m = placement(matrix, center);
    const x0 = -w / 2, x1 = w / 2, y0 = -h / 2, y1 = h / 2, z0 = -d / 2, z1 = d / 2;
    const p = (x, y, z) => new THREE.Vector3(x, y, z).applyMatrix4(m);
    const c000 = p(x0, y0, z0), c100 = p(x1, y0, z0), c010 = p(x0, y1, z0), c110 = p(x1, y1, z0);
    const c001 = p(x0, y0, z1), c101 = p(x1, y0, z1), c011 = p(x0, y1, z1), c111 = p(x1, y1, z1);
    this.quad(c101, c100, c110, c111, surface); // +X
    this.quad(c000, c001, c011, c010, surface); // −X
    this.quad(c011, c111, c110, c010, surface); // +Y
    this.quad(c000, c100, c101, c001, surface); // −Y
    this.quad(c001, c101, c111, c011, surface); // +Z
    this.quad(c100, c000, c010, c110, surface); // −Z
    return this;
  }

  /** Cilindro vertical com base em y = 0 e topo em y = h (no objeto); polígono circunscrito ao círculo de raio r. */
  cylinder(r, h, { segments = 32, matrix = null, center = null, surface = 'padrao' } = {}) {
    const m = placement(matrix, center);
    const R = r / Math.cos(Math.PI / segments);
    const ring = (y) => Array.from({ length: segments }, (_, i) => {
      const a = (i / segments) * Math.PI * 2;
      return new THREE.Vector3(Math.cos(a) * R, y, -Math.sin(a) * R).applyMatrix4(m);
    });
    const bottom = ring(0);
    const top = ring(h);
    const cb = new THREE.Vector3(0, 0, 0).applyMatrix4(m);
    const ct = new THREE.Vector3(0, h, 0).applyMatrix4(m);
    for (let i = 0; i < segments; i++) {
      const j = (i + 1) % segments;
      this.quad(bottom[i], bottom[j], top[j], top[i], surface);
      this.triangle(ct, top[i], top[j], surface);
      this.triangle(cb, bottom[j], bottom[i], surface);
    }
    return this;
  }

  /** Rampa (cunha) de largura w em X que sobe de y = 0 em z = 0 até y = h em z = l (no objeto). */
  ramp(w, l, h, { matrix = null, center = null, surface = 'padrao' } = {}) {
    const m = placement(matrix, center);
    const p = (x, y, z) => new THREE.Vector3(x, y, z).applyMatrix4(m);
    const hw = w / 2;
    const b0 = p(-hw, 0, 0), b1 = p(hw, 0, 0), b2 = p(hw, 0, l), b3 = p(-hw, 0, l);
    const t2 = p(hw, h, l), t3 = p(-hw, h, l);
    this.quad(b0, t3, t2, b1, surface); // rampa
    this.quad(b3, b2, t2, t3, surface); // costas
    this.quad(b0, b1, b2, b3, surface); // fundo
    this.triangle(b0, b3, t3, surface); // lado −X
    this.triangle(b1, t2, b2, surface); // lado +X
    return this;
  }

  /** Escada maciça de `count` degraus: cada um sobe `rise` e avança `run` em +Z; largura w em X (no objeto). */
  stairs(w, rise, run, count, { matrix = null, center = null, surface = 'padrao' } = {}) {
    const base = placement(matrix, center);
    for (let i = 0; i < count; i++) {
      const h = (i + 1) * rise;
      const local = new THREE.Matrix4().makeTranslation(0, h / 2, i * run + run / 2);
      this.box(w, h, run, { matrix: new THREE.Matrix4().multiplyMatrices(base, local), surface });
    }
    return this;
  }

  /** Triângulos prontos para o CollisionBody. */
  build() {
    return { positions: Float64Array.from(this.positions), surfaces: Uint8Array.from(this.surfaces) };
  }
}
```

- [ ] **Passo 5: Implementar o corpo com BVH**

```js file=src/physics/collisionBody.js
// Corpo de colisão: os triângulos de um ColliderBuilder com um BVH (three-mesh-bvh, divisão SAH) e uma matriz rígida
// opcional (props que se mexem, paredes que surgem). Depois do build, os triângulos são copiados na ordem final do
// BVH para arrays planos em precisão dupla: a fase estreita lê deles direto, sem objetos por triângulo.

import * as THREE from 'three';
import { MeshBVH, SAH } from 'three-mesh-bvh';
import { TRI_STRIDE } from './geometryQueries.js';

const IDENTITY = new THREE.Matrix4();
let nextId = 1;

export class CollisionBody {
  /**
   * @param {{positions: Float64Array, surfaces: Uint8Array}} data triângulos no espaço do corpo (ColliderBuilder.build())
   * @param {{name?: string, matrix?: THREE.Matrix4}} [opts] `matrix`: corpo → mundo, rígida (escala vem assada)
   */
  constructor(data, { name = 'corpo', matrix = null } = {}) {
    const count = data.surfaces.length;
    if (!count) throw new Error(`corpo de colisão vazio: ${name}`);
    this.id = nextId++;
    this.name = name;
    this.triangleCount = count;
    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute('position', new THREE.BufferAttribute(Float32Array.from(data.positions), 3));
    this.bvh = new MeshBVH(this.geometry, { strategy: SAH, targetLeafSize: 4 });
    // Entrada não indexada: o BVH criou o índice 0..n−1 e reordenou os triângulos em blocos de 3, então o
    // triângulo i do BVH é o triângulo index[3i] / 3 do builder.
    const index = this.geometry.index.array;
    const P = data.positions;
    this.tris = new Float64Array(count * TRI_STRIDE);
    this.surface = new Uint8Array(count);
    for (let i = 0; i < count; i++) {
      const src = index[i * 3] / 3;
      const s = src * 9;
      const o = i * TRI_STRIDE;
      for (let k = 0; k < 9; k++) this.tris[o + k] = P[s + k];
      const abx = P[s + 3] - P[s], aby = P[s + 4] - P[s + 1], abz = P[s + 5] - P[s + 2];
      const acx = P[s + 6] - P[s], acy = P[s + 7] - P[s + 1], acz = P[s + 8] - P[s + 2];
      const nx = aby * acz - abz * acy;
      const ny = abz * acx - abx * acz;
      const nz = abx * acy - aby * acx;
      const len = Math.hypot(nx, ny, nz);
      this.tris[o + 9] = nx / len;
      this.tris[o + 10] = ny / len;
      this.tris[o + 11] = nz / len;
      this.surface[i] = data.surfaces[src];
    }
    this.geometry.computeBoundingBox();
    this.localBounds = this.geometry.boundingBox.clone();
    this.matrix = new THREE.Matrix4();
    this.inverse = new THREE.Matrix4();
    this.transformed = false;
    if (matrix) this.setMatrix(matrix);
  }

  /** Posição/rotação do corpo no mundo (rígida). */
  setMatrix(matrix) {
    this.matrix.copy(matrix);
    this.inverse.copy(matrix).invert();
    this.transformed = !matrix.equals(IDENTITY);
    return this;
  }

  dispose() {
    this.geometry.dispose();
    this.bvh = null;
    this.tris = null;
  }
}
```

- [ ] **Passo 6: Implementar o mundo de colisão** — conteúdo completo no bloco `src/physics/collisionWorld.js` logo abaixo.

```js file=src/physics/collisionWorld.js
// Mundo de colisão: corpos com BVH e as consultas do controlador de personagem, do hitscan e da câmera — varredura de
// cápsula (o "trace" do Source), contato mais fundo, desempenetração, busca de espaço livre, chão da base chata e
// raio. Nenhuma consulta aloca: os callbacks do BVH são criados uma vez e leem os parâmetros de campos da instância.
// A cápsula é dada pelos pés (origem), raio e altura; o segmento interno vai de y + raio a y + altura − raio.

import * as THREE from 'three';
import { INTERSECTED, NOT_INTERSECTED } from 'three-mesh-bvh';
import { CONTROLLER } from '../data/movement.js';
import { TRI_STRIDE, closestSegmentTriangle, createClosest, rayBoxEntry, triangleDiscRange } from './geometryQueries.js';
import { SWEEP_TOLERANCE, createSweepHit, sweepCapsuleTriangle } from './capsuleSweep.js';
import { CollisionBody } from './collisionBody.js';

/** Resultado reutilizável de uma varredura (o trace_t do Source). */
export function createTrace() {
  return {
    fraction: 1,
    hit: false,
    startSolid: false,
    endpos: new THREE.Vector3(),
    normal: new THREE.Vector3(), // normal de contato: do obstáculo para a cápsula
    faceNormal: new THREE.Vector3(), // normal da face tocada, virada para a cápsula (numa aresta, a de uma das faces)
    point: new THREE.Vector3(), // ponto de contato no obstáculo
    surface: 0,
    body: null,
    triangle: -1,
  };
}

export function copyTrace(src, dst) {
  if (src === dst) return dst;
  dst.fraction = src.fraction;
  dst.hit = src.hit;
  dst.startSolid = src.startSolid;
  dst.endpos.copy(src.endpos);
  dst.normal.copy(src.normal);
  dst.faceNormal.copy(src.faceNormal);
  dst.point.copy(src.point);
  dst.surface = src.surface;
  dst.body = src.body;
  dst.triangle = src.triangle;
  return dst;
}

/** Resultado reutilizável de um raio. */
export function createRayHit() {
  return { hit: false, distance: Infinity, point: new THREE.Vector3(), normal: new THREE.Vector3(), surface: 0, body: null, triangle: -1 };
}

/** Contato mais fundo (desempenetração): distância, normal de empurrão e, se o segmento fura, quanto falta sair. */
export function createContact() {
  return { distance: 0, normal: new THREE.Vector3(), pierced: false, pierceDepth: 0, surface: 0, body: null };
}

const _hit = createSweepHit();
const _c = createClosest();
const _contact = createContact();
const _free = new THREE.Vector3();

function toWorldDir(body, x, y, z, out) {
  if (!body.transformed) return out.set(x, y, z);
  const e = body.matrix.elements;
  return out.set(e[0] * x + e[4] * y + e[8] * z, e[1] * x + e[5] * y + e[9] * z, e[2] * x + e[6] * y + e[10] * z);
}

function toWorldPoint(body, x, y, z, out) {
  if (!body.transformed) return out.set(x, y, z);
  const e = body.matrix.elements;
  return out.set(
    e[0] * x + e[4] * y + e[8] * z + e[12], e[1] * x + e[5] * y + e[9] * z + e[13], e[2] * x + e[6] * y + e[10] * z + e[14],
  );
}

const _sp = new Float64Array(9); // vértices (mundo) do triângulo em teste no chão da base chata
const _range = { min: 0, max: 0 };

export class CollisionWorld {
  constructor({ skin = CONTROLLER.skin } = {}) {
    this.skin = skin;
    this.bodies = [];
    this.stats = { sweeps: 0, overlaps: 0, rays: 0, triangles: 0 };
    // Consulta em andamento, no espaço do corpo atual.
    this._tris = null;
    this._s0x = 0; this._s0y = 0; this._s0z = 0;
    this._s1x = 0; this._s1y = 0; this._s1z = 0;
    this._dx = 0; this._dy = 0; this._dz = 0;
    this._cx = 0; this._cy = 0; this._cz = 0;
    this._ex = 0; this._ey = 0; this._ez = 0;
    this._minX = 0; this._minY = 0; this._minZ = 0;
    this._maxX = 0; this._maxY = 0; this._maxZ = 0;
    this._target = 0;
    this._best = 1;
    this._bestVn = 0;
    this._limit = 0;
    this._found = false;
    this._stop = false;
    this._tri = -1;
    this._hnx = 0; this._hny = 0; this._hnz = 0;
    this._hpx = 0; this._hpy = 0; this._hpz = 0;
    this._startDist = Infinity;
    this._pierced = false;
    this._pierceDepth = 0;
    // Consulta do chão da base chata (supportBelow).
    this._qBody = null;
    this._sx = 0; this._sz = 0; this._sr = 0;
    this._sMinY = 0; this._sMaxY = 0; this._sMinNy = 0;
    this._sBest = -Infinity; this._sBestNy = 0;
    this._snx = 0; this._sny = 1; this._snz = 0;
    this._sweepCb = {
      boundsTraverseOrder: (box) => rayBoxEntry(
        this._cx, this._cy, this._cz, this._dx, this._dy, this._dz,
        box.min.x - this._ex, box.min.y - this._ey, box.min.z - this._ez,
        box.max.x + this._ex, box.max.y + this._ey, box.max.z + this._ez, this._best,
      ),
      intersectsBounds: (box, isLeaf, score) => (score <= this._best ? INTERSECTED : NOT_INTERSECTED),
      intersectsRange: (offset, count) => this.#sweepRange(offset, count),
    };
    this._overlapCb = {
      intersectsBounds: (box) => (box.min.x <= this._maxX && box.max.x >= this._minX && box.min.y <= this._maxY
        && box.max.y >= this._minY && box.min.z <= this._maxZ && box.max.z >= this._minZ ? INTERSECTED : NOT_INTERSECTED),
      intersectsRange: (offset, count) => this.#overlapRange(offset, count),
    };
    this._supportCb = {
      intersectsBounds: this._overlapCb.intersectsBounds,
      intersectsRange: (offset, count) => this.#supportRange(offset, count),
    };
    this._rayCb = {
      boundsTraverseOrder: (box) => rayBoxEntry(
        this._s0x, this._s0y, this._s0z, this._dx, this._dy, this._dz,
        box.min.x, box.min.y, box.min.z, box.max.x, box.max.y, box.max.z, this._best,
      ),
      intersectsBounds: (box, isLeaf, score) => (score <= this._best ? INTERSECTED : NOT_INTERSECTED),
      intersectsRange: (offset, count) => this.#rayRange(offset, count),
    };
  }

  /** Mundo com um único corpo estático montado pelo ColliderBuilder. */
  static fromBuilder(builder, name = 'mapa') {
    const world = new CollisionWorld();
    world.addBody(new CollisionBody(builder.build(), { name }));
    return world;
  }

  addBody(body) {
    this.bodies.push(body);
    return body;
  }

  removeBody(body) {
    const i = this.bodies.indexOf(body);
    if (i >= 0) this.bodies.splice(i, 1);
    return i >= 0;
  }

  get triangleCount() {
    let n = 0;
    for (const body of this.bodies) n += body.triangleCount;
    return n;
  }

  /** Leva o segmento AB e o deslocamento D para o espaço do corpo e prepara os triângulos dele. */
  #setQuery(body, ax, ay, az, bx, by, bz, dx, dy, dz) {
    this._tris = body.tris;
    if (!body.transformed) {
      this._s0x = ax; this._s0y = ay; this._s0z = az;
      this._s1x = bx; this._s1y = by; this._s1z = bz;
      this._dx = dx; this._dy = dy; this._dz = dz;
      return;
    }
    const e = body.inverse.elements;
    this._s0x = e[0] * ax + e[4] * ay + e[8] * az + e[12];
    this._s0y = e[1] * ax + e[5] * ay + e[9] * az + e[13];
    this._s0z = e[2] * ax + e[6] * ay + e[10] * az + e[14];
    this._s1x = e[0] * bx + e[4] * by + e[8] * bz + e[12];
    this._s1y = e[1] * bx + e[5] * by + e[9] * bz + e[13];
    this._s1z = e[2] * bx + e[6] * by + e[10] * bz + e[14];
    this._dx = e[0] * dx + e[4] * dy + e[8] * dz;
    this._dy = e[1] * dx + e[5] * dy + e[9] * dz;
    this._dz = e[2] * dx + e[6] * dy + e[10] * dz;
  }

  /**
   * Varre a cápsula (pés em O, raio, altura) pelo deslocamento D e para no primeiro contato a `raio + folga`.
   * `out` recebe a fração percorrida, a posição final dos pés e o contato (normal, face, ponto, superfície, corpo).
   * startSolid: começou penetrando (além da tolerância) e se aprofundando.
   */
  sweepCapsule(ox, oy, oz, dx, dy, dz, radius, height, out, skin = this.skin) {
    this.stats.sweeps++;
    const half = height * 0.5;
    const y0 = oy + Math.min(radius, half);
    const y1 = oy + Math.max(height - radius, half);
    const target = radius + skin;
    const margin = target + SWEEP_TOLERANCE;
    out.hit = false;
    out.startSolid = false;
    out.body = null;
    out.triangle = -1;
    out.surface = 0;
    out.normal.set(0, 0, 0);
    out.faceNormal.set(0, 0, 0);
    let best = 1;
    for (let b = 0; b < this.bodies.length; b++) {
      const body = this.bodies[b];
      this.#setQuery(body, ox, y0, oz, ox, y1, oz, dx, dy, dz);
      this._ex = Math.abs(this._s1x - this._s0x) * 0.5 + margin;
      this._ey = Math.abs(this._s1y - this._s0y) * 0.5 + margin;
      this._ez = Math.abs(this._s1z - this._s0z) * 0.5 + margin;
      this._cx = (this._s0x + this._s1x) * 0.5;
      this._cy = (this._s0y + this._s1y) * 0.5;
      this._cz = (this._s0z + this._s1z) * 0.5;
      const lb = body.localBounds;
      if (rayBoxEntry(this._cx, this._cy, this._cz, this._dx, this._dy, this._dz,
        lb.min.x - this._ex, lb.min.y - this._ey, lb.min.z - this._ez,
        lb.max.x + this._ex, lb.max.y + this._ey, lb.max.z + this._ez, best) === Infinity) continue;
      this._target = target;
      this._best = best;
      this._found = false;
      body.bvh.shapecast(this._sweepCb);
      if (!this._found) continue;
      best = this._best;
      out.hit = true;
      out.body = body;
      out.triangle = this._tri;
      out.surface = body.surface[this._tri];
      toWorldDir(body, this._hnx, this._hny, this._hnz, out.normal);
      toWorldPoint(body, this._hpx, this._hpy, this._hpz, out.point);
      const o = this._tri * TRI_STRIDE;
      toWorldDir(body, body.tris[o + 9], body.tris[o + 10], body.tris[o + 11], out.faceNormal);
      if (out.faceNormal.dot(out.normal) < 0) out.faceNormal.negate();
      out.startSolid = best === 0 && this._startDist < radius - CONTROLLER.penetrationTolerance;
    }
    out.fraction = best;
    out.endpos.set(ox + dx * best, oy + dy * best, oz + dz * best);
    return out;
  }

  #sweepRange(offset, count) {
    const T = this._tris;
    const s0x = this._s0x, s0y = this._s0y, s0z = this._s0z;
    const s1x = this._s1x, s1y = this._s1y, s1z = this._s1z;
    const dx = this._dx, dy = this._dy, dz = this._dz;
    const target = this._target;
    const lim = target + SWEEP_TOLERANCE;
    this.stats.triangles += count;
    for (let i = offset, end = offset + count; i < end; i++) {
      const o = i * TRI_STRIDE;
      // Rejeição pelo plano: as pontas do segmento, no começo e no fim, do mesmo lado e além do alcance.
      const nx = T[o + 9], ny = T[o + 10], nz = T[o + 11];
      const e0 = (s0x - T[o]) * nx + (s0y - T[o + 1]) * ny + (s0z - T[o + 2]) * nz;
      const e1 = (s1x - T[o]) * nx + (s1y - T[o + 1]) * ny + (s1z - T[o + 2]) * nz;
      const dn = (dx * nx + dy * ny + dz * nz) * this._best;
      const e2 = e0 + dn;
      const e3 = e1 + dn;
      if (e0 > lim && e1 > lim && e2 > lim && e3 > lim) continue;
      if (e0 < -lim && e1 < -lim && e2 < -lim && e3 < -lim) continue;
      if (!sweepCapsuleTriangle(s0x, s0y, s0z, s1x, s1y, s1z, dx, dy, dz, T, o, target, this._best, _hit)) continue;
      const vn = dx * _hit.nx + dy * _hit.ny + dz * _hit.nz;
      if (this._found) {
        // Empate no mesmo t (quina tocada no começo): fica com o plano que mais se opõe ao movimento.
        if (_hit.t > this._best + 1e-12) continue;
        if (_hit.t > this._best - 1e-12 && vn >= this._bestVn) continue;
      }
      this._found = true;
      this._best = _hit.t;
      this._bestVn = vn;
      this._tri = i;
      this._hnx = _hit.nx; this._hny = _hit.ny; this._hnz = _hit.nz;
      this._hpx = _hit.px; this._hpy = _hit.py; this._hpz = _hit.pz;
      this._startDist = _hit.startDist;
    }
    return false;
  }

  /**
   * Contato mais fundo da cápsula: o triângulo mais próximo do segmento abaixo de `limit`. Escreve em `out` a
   * distância, a normal de empurrão (mundo) e, quando o segmento fura o triângulo, quanto falta para sair.
   * `firstOnly`: para no primeiro contato (teste "cabe aqui?").
   */
  deepestContact(ox, oy, oz, radius, height, limit, out, firstOnly = false) {
    this.stats.overlaps++;
    const half = height * 0.5;
    const y0 = oy + Math.min(radius, half);
    const y1 = oy + Math.max(height - radius, half);
    let found = false;
    this._limit = limit;
    for (let b = 0; b < this.bodies.length; b++) {
      const body = this.bodies[b];
      this.#setQuery(body, ox, y0, oz, ox, y1, oz, 0, 0, 0);
      const l = this._limit;
      this._minX = Math.min(this._s0x, this._s1x) - l;
      this._minY = Math.min(this._s0y, this._s1y) - l;
      this._minZ = Math.min(this._s0z, this._s1z) - l;
      this._maxX = Math.max(this._s0x, this._s1x) + l;
      this._maxY = Math.max(this._s0y, this._s1y) + l;
      this._maxZ = Math.max(this._s0z, this._s1z) + l;
      const lb = body.localBounds;
      if (lb.min.x > this._maxX || lb.max.x < this._minX || lb.min.y > this._maxY || lb.max.y < this._minY
        || lb.min.z > this._maxZ || lb.max.z < this._minZ) continue;
      this._found = false;
      this._stop = firstOnly;
      body.bvh.shapecast(this._overlapCb);
      if (!this._found) continue;
      found = true;
      out.distance = this._limit;
      out.pierced = this._pierced;
      out.pierceDepth = this._pierceDepth;
      out.body = body;
      out.surface = body.surface[this._tri];
      toWorldDir(body, this._hnx, this._hny, this._hnz, out.normal);
      if (firstOnly) break;
    }
    return found;
  }

  /**
   * Chão da base chata (o fundo reto da caixa do Source): a maior altura de face andável virada para cima
   * (normal.y ≥ minNormalY) dentro do cilindro vertical de raio `radius` em volta de (x, z), entre `minY` e `maxY`;
   * face que passa de `maxY` dentro do disco é obstáculo acima da base, não chão. A cápsula colide com o redondo, mas
   * o jogador fica de pé em tudo o que o disco dos pés cobre — beirada, degrau, topo de rampa — e só alcança o que o
   * pulo alcança. Escreve em `out` ({height, normal, surface}); false se não há chão.
   */
  supportBelow(x, z, radius, minY, maxY, minNormalY, out) {
    this.stats.overlaps++;
    this._sx = x;
    this._sz = z;
    this._sr = radius;
    this._sMinY = minY;
    this._sMaxY = maxY;
    this._sMinNy = minNormalY;
    this._sBest = -Infinity;
    this._sBestNy = 0;
    let found = false;
    for (let b = 0; b < this.bodies.length; b++) {
      const body = this.bodies[b];
      if (!this.#setBoxQuery(body, x - radius, minY, z - radius, x + radius, maxY, z + radius)) continue;
      this._tris = body.tris;
      this._qBody = body;
      this._found = false;
      body.bvh.shapecast(this._supportCb);
      if (!this._found) continue;
      found = true;
      out.height = this._sBest;
      out.surface = body.surface[this._tri];
      out.normal.set(this._snx, this._sny, this._snz);
    }
    return found;
  }

  /** Caixa de mundo levada ao espaço do corpo (conservadora se ele gira); false se nem encosta nos limites dele. */
  #setBoxQuery(body, x0, y0, z0, x1, y1, z1) {
    if (!body.transformed) {
      this._minX = x0; this._minY = y0; this._minZ = z0;
      this._maxX = x1; this._maxY = y1; this._maxZ = z1;
    } else {
      const e = body.inverse.elements;
      let ax = Infinity, ay = Infinity, az = Infinity, bx = -Infinity, by = -Infinity, bz = -Infinity;
      for (let k = 0; k < 8; k++) {
        const px = k & 1 ? x1 : x0, py = k & 2 ? y1 : y0, pz = k & 4 ? z1 : z0;
        const lx = e[0] * px + e[4] * py + e[8] * pz + e[12];
        const ly = e[1] * px + e[5] * py + e[9] * pz + e[13];
        const lz = e[2] * px + e[6] * py + e[10] * pz + e[14];
        if (lx < ax) ax = lx;
        if (ly < ay) ay = ly;
        if (lz < az) az = lz;
        if (lx > bx) bx = lx;
        if (ly > by) by = ly;
        if (lz > bz) bz = lz;
      }
      this._minX = ax; this._minY = ay; this._minZ = az;
      this._maxX = bx; this._maxY = by; this._maxZ = bz;
    }
    const lb = body.localBounds;
    return !(lb.min.x > this._maxX || lb.max.x < this._minX || lb.min.y > this._maxY || lb.max.y < this._minY
      || lb.min.z > this._maxZ || lb.max.z < this._minZ);
  }

  #supportRange(offset, count) {
    const T = this._tris;
    const body = this._qBody;
    const e = body.transformed ? body.matrix.elements : null;
    const lo = this._sMinY, hi = this._sMaxY;
    this.stats.triangles += count;
    for (let i = offset, end = offset + count; i < end; i++) {
      const o = i * TRI_STRIDE;
      let nx = T[o + 9], ny = T[o + 10], nz = T[o + 11];
      if (e) {
        const wx = e[0] * nx + e[4] * ny + e[8] * nz;
        const wy = e[1] * nx + e[5] * ny + e[9] * nz;
        const wz = e[2] * nx + e[6] * ny + e[10] * nz;
        nx = wx; ny = wy; nz = wz;
      }
      // Só face virada para cima segura a base: a de baixo de uma aba (normal para baixo) tem o sólido por cima.
      if (ny < this._sMinNy) continue;
      for (let k = 0; k < 9; k += 3) {
        const x = T[o + k], y = T[o + k + 1], z = T[o + k + 2];
        if (e) {
          _sp[k] = e[0] * x + e[4] * y + e[8] * z + e[12];
          _sp[k + 1] = e[1] * x + e[5] * y + e[9] * z + e[13];
          _sp[k + 2] = e[2] * x + e[6] * y + e[10] * z + e[14];
        } else {
          _sp[k] = x; _sp[k + 1] = y; _sp[k + 2] = z;
        }
      }
      if (!triangleDiscRange(_sp, nx, ny, nz, this._sx, this._sz, this._sr, _range)) continue;
      // Face que passa de maxY dentro do disco é obstáculo acima da base (o redondo da cápsula chegou perto dela
      // por baixo), não chão.
      if (_range.max > hi || _range.max < lo) continue;
      const h = _range.max;
      // Mais alto ganha; na mesma altura (aresta de duas faces), a face mais plana.
      if (h < this._sBest - 1e-9 || (h <= this._sBest + 1e-9 && ny <= this._sBestNy)) continue;
      this._sBest = h;
      this._sBestNy = ny;
      this._found = true;
      this._tri = i;
      this._snx = nx; this._sny = ny; this._snz = nz;
    }
    return false;
  }

  #overlapRange(offset, count) {
    const T = this._tris;
    const s0x = this._s0x, s0y = this._s0y, s0z = this._s0z;
    const s1x = this._s1x, s1y = this._s1y, s1z = this._s1z;
    this.stats.triangles += count;
    for (let i = offset, end = offset + count; i < end; i++) {
      const o = i * TRI_STRIDE;
      const lim = this._limit;
      const nx = T[o + 9], ny = T[o + 10], nz = T[o + 11];
      const e0 = (s0x - T[o]) * nx + (s0y - T[o + 1]) * ny + (s0z - T[o + 2]) * nz;
      const e1 = (s1x - T[o]) * nx + (s1y - T[o + 1]) * ny + (s1z - T[o + 2]) * nz;
      if ((e0 >= lim && e1 >= lim) || (e0 <= -lim && e1 <= -lim)) continue;
      const distSq = closestSegmentTriangle(s0x, s0y, s0z, s1x, s1y, s1z, T, o, _c);
      if (distSq >= lim * lim) continue;
      const dist = Math.sqrt(distSq);
      this._found = true;
      this._limit = dist;
      this._tri = i;
      if (dist > 1e-9) {
        const inv = 1 / dist;
        this._hnx = (_c.sx - _c.x) * inv;
        this._hny = (_c.sy - _c.y) * inv;
        this._hnz = (_c.sz - _c.z) * inv;
        this._pierced = false;
        this._pierceDepth = 0;
      } else {
        // O segmento fura o triângulo: sai pelo lado do meio do segmento (para cima, se o meio estiver no plano).
        let side = e0 + e1;
        if (side === 0) side = ny >= 0 ? 1 : -1;
        const sign = side > 0 ? 1 : -1;
        this._hnx = nx * sign;
        this._hny = ny * sign;
        this._hnz = nz * sign;
        this._pierced = true;
        this._pierceDepth = -Math.min(e0 * sign, e1 * sign);
      }
      if (this._stop) return true;
    }
    return false;
  }

  /**
   * Empurra a cápsula (pés em `pos`, alterado no lugar) para fora dos contatos até ficar a `raio + folga` de tudo,
   * resolvendo o mais fundo a cada iteração. Contatos só um pouco dentro da folga ficam como estão (repouso).
   * Devolve true se terminou sem penetração real. Com o segmento inteiro dentro de um sólido fechado a distância
   * aponta para dentro — nesse caso devolve false e quem chama recorre ao findFreeSpot a partir da posição original.
   */
  depenetrate(pos, radius, height, skin = this.skin) {
    const target = radius + skin;
    const keep = target - skin * 0.25;
    for (let i = 0; i < CONTROLLER.depenetrateIterations; i++) {
      if (!this.deepestContact(pos.x, pos.y, pos.z, radius, height, keep, _contact)) return true;
      const push = (_contact.pierced ? target + _contact.pierceDepth : target - _contact.distance) + 1e-4;
      pos.addScaledVector(_contact.normal, push);
    }
    return this.canOccupy(pos.x, pos.y, pos.z, radius, height);
  }

  /** A cápsula cabe aqui (nenhum triângulo mais perto do segmento que raio − tolerância)? */
  canOccupy(x, y, z, radius, height, tolerance = CONTROLLER.penetrationTolerance) {
    return !this.deepestContact(x, y, z, radius, height, radius - tolerance, _contact, true);
  }

  /**
   * Procura, em anéis cada vez maiores (primeiro para cima, depois em 8 direções no mesmo nível e acima, por último
   * para baixo), um lugar onde a cápsula caiba; move `pos` para lá. Para quem ficou espremido ou saiu do noclip
   * dentro de algo. `accept(pos)` opcional recusa lugares livres que não servem (sem chão, por exemplo).
   */
  findFreeSpot(pos, radius, height, skin = this.skin, accept = null) {
    const x = pos.x, y = pos.y, z = pos.z;
    for (const r of CONTROLLER.unstuckRadii) {
      if (this.#tryAt(pos, x, y + r, z, radius, height, skin, accept)) return true;
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2;
        const ox = Math.cos(a) * r;
        const oz = Math.sin(a) * r;
        if (this.#tryAt(pos, x + ox, y, z + oz, radius, height, skin, accept)) return true;
        if (this.#tryAt(pos, x + ox, y + r, z + oz, radius, height, skin, accept)) return true;
      }
      if (this.#tryAt(pos, x, y - r, z, radius, height, skin, accept)) return true;
    }
    return false;
  }

  #tryAt(pos, x, y, z, radius, height, skin, accept) {
    if (!this.canOccupy(x, y, z, radius, height)) return false;
    _free.set(x, y, z);
    this.depenetrate(_free, radius, height, skin);
    if (accept && !accept(_free)) return false;
    pos.copy(_free);
    return true;
  }

  /** Primeiro triângulo (dos dois lados) no raio O + t·D, t ∈ [0, maxDist], com D unitário. */
  raycast(ox, oy, oz, dx, dy, dz, maxDist, out) {
    this.stats.rays++;
    out.hit = false;
    out.body = null;
    out.triangle = -1;
    let best = maxDist;
    for (let b = 0; b < this.bodies.length; b++) {
      const body = this.bodies[b];
      this.#setQuery(body, ox, oy, oz, ox, oy, oz, dx, dy, dz);
      const lb = body.localBounds;
      if (rayBoxEntry(this._s0x, this._s0y, this._s0z, this._dx, this._dy, this._dz,
        lb.min.x, lb.min.y, lb.min.z, lb.max.x, lb.max.y, lb.max.z, best) === Infinity) continue;
      this._best = best;
      this._found = false;
      body.bvh.shapecast(this._rayCb);
      if (!this._found) continue;
      best = this._best;
      out.hit = true;
      out.body = body;
      out.triangle = this._tri;
      out.surface = body.surface[this._tri];
      toWorldDir(body, this._hnx, this._hny, this._hnz, out.normal);
    }
    out.distance = out.hit ? best : maxDist;
    out.point.set(ox + dx * out.distance, oy + dy * out.distance, oz + dz * out.distance);
    return out.hit;
  }

  /** Möller–Trumbore dos dois lados em cada triângulo da folha. */
  #rayRange(offset, count) {
    const T = this._tris;
    const ox = this._s0x, oy = this._s0y, oz = this._s0z;
    const dx = this._dx, dy = this._dy, dz = this._dz;
    this.stats.triangles += count;
    for (let i = offset, end = offset + count; i < end; i++) {
      const o = i * TRI_STRIDE;
      const e1x = T[o + 3] - T[o], e1y = T[o + 4] - T[o + 1], e1z = T[o + 5] - T[o + 2];
      const e2x = T[o + 6] - T[o], e2y = T[o + 7] - T[o + 1], e2z = T[o + 8] - T[o + 2];
      const px = dy * e2z - dz * e2y, py = dz * e2x - dx * e2z, pz = dx * e2y - dy * e2x;
      const det = e1x * px + e1y * py + e1z * pz;
      if (det > -1e-12 && det < 1e-12) continue;
      const inv = 1 / det;
      const sx = ox - T[o], sy = oy - T[o + 1], sz = oz - T[o + 2];
      const u = (sx * px + sy * py + sz * pz) * inv;
      if (u < 0 || u > 1) continue;
      const qx = sy * e1z - sz * e1y, qy = sz * e1x - sx * e1z, qz = sx * e1y - sy * e1x;
      const v = (dx * qx + dy * qy + dz * qz) * inv;
      if (v < 0 || u + v > 1) continue;
      const t = (e2x * qx + e2y * qy + e2z * qz) * inv;
      if (t < 0 || t > this._best) continue;
      this._best = t;
      this._found = true;
      this._tri = i;
      // Normal da face virada contra o raio (o triângulo vale dos dois lados).
      const nx = T[o + 9], ny = T[o + 10], nz = T[o + 11];
      const s = nx * dx + ny * dy + nz * dz > 0 ? -1 : 1;
      this._hnx = nx * s;
      this._hny = ny * s;
      this._hnz = nz * s;
    }
    return false;
  }

  dispose() {
    for (const body of this.bodies) body.dispose();
    this.bodies.length = 0;
  }
}
```

- [ ] **Passo 7: Rodar e ver passar** — `node --test tests/collisionWorld.test.js` → 10 testes PASS.

- [ ] **Passo 8: Commit** — `git add src/physics/colliders.js src/physics/collisionBody.js src/physics/collisionWorld.js tests/worldTestUtils.js tests/collisionWorld.test.js && git commit -m "feat(fase-3.1): formas de colisão, corpo com BVH e mundo de colisão"`

---

### Tarefa 5: Controlador de personagem (porte do Source)

**Files:**
- Create: `src/physics/characterController.js`
- Test: coberto pelos cenários da Tarefa 7 (o controlador só faz sentido com o movimento por cima)

**Decisão de projeto (tomada na execução):** a primeira versão decidia o chão pelo contato da própria cápsula, com um
"raio de apoio" — o redondo de baixo sustentava o jogador em quinas até ~12 u acima dos pés. Os cenários quebraram duas
regras do CS com ela: parado junto ao espelho de um degrau, o avanço lento emperrava; e o pulo em pé "empoleirava" na
caixa de 64 u, que só o pulo agachado pode alcançar. A versão abaixo usa a **base chata**: a cápsula só colide (paredes,
teto, obstáculos); o chão é o disco dos pés (`HULL.footRadius`), como o fundo reto da caixa do Source (e o
`bUseFlatBaseForFloorChecks` da Unreal). Daí saem: a consulta `supportBelow` do mundo (face andável mais alta virada para
cima dentro do disco; o que passa do teto da faixa é obstáculo, não chão); o `clipLowEdge` para quinas pegas pelo
redondo de baixo (tira a velocidade horizontal contra a quina antes do corte: sem impulso para cima, sem ficar
pendurado); o pouso quando a base atravessa o topo da beirada de cima para baixo durante o tick; o degrau e o grudar no
chão levando os pés até o chão da base; e, ao desprender (noclip desligado dentro de algo), a preferência por um lugar
livre com chão quando o empurrão direto passa de 8 u para um lugar sem chão.

- [ ] **Passo 1: Implementar**

```js file=src/physics/characterController.js
// Controlador de personagem: porte do gamemovement.cpp do Source (TryPlayerMove, StepMove, StayOnGround,
// CategorizePosition) para Y para cima, sobre a varredura exata do CollisionWorld. A cápsula colide (paredes, teto,
// obstáculos); o chão é o da base chata — o disco dos pés (HULL.footRadius), como o fundo reto da caixa do CS: o
// jogador fica de pé em qualquer chão andável que o disco cubra, sobe degrau até sv_stepsize e só alcança a beirada
// que o pulo alcança (o redondo de baixo da cápsula não afunda na borda nem serve de rampa para subir nela).
// Opera sobre o estado de movimento do jogador (src/player/movement.js): pés na origem, velocidade, altura da cápsula,
// chão (normal, superfície, atrito) e `viewOffset` — a subida/descida brusca deste tick que a câmera suaviza.

import * as THREE from 'three';
import { CONTROLLER, HULL } from '../data/movement.js';
import { SURFACES } from '../data/surfaces.js';
import { copyTrace, createTrace } from './collisionWorld.js';

/** Tira de `v` a componente contra o plano de normal `n` (ClipVelocity do Source); overbounce 1 = deslizar. */
export function clipVelocity(v, n, out, overbounce) {
  const backoff = v.dot(n) * overbounce;
  out.set(v.x - n.x * backoff, v.y - n.y * backoff, v.z - n.z * backoff);
  // Segunda passada: não sobra nada entrando no plano por arredondamento.
  const adjust = out.dot(n);
  if (adjust < 0) out.addScaledVector(n, -adjust);
  return out;
}

/**
 * Corte contra uma quina pega pelo redondo de baixo da cápsula (normal subindo, de aresta ou vértice): o ponto fica
 * acima dos pés, onde a base chata bateria na lateral de quem sustenta a quina. Então primeiro tira a velocidade
 * horizontal que entra nela e só corta contra a normal verdadeira se ainda entrar. Assim a quina nunca dá impulso
 * para cima (subir beirada mais alta que o pulo) nem segura a cápsula pendurada: caindo, ela escorrega para trás;
 * subindo, sobe reto ao lado.
 */
export function clipLowEdge(v, n, out, overbounce) {
  const len = Math.hypot(n.x, n.z);
  out.copy(v);
  if (len > 1e-9) {
    const into = (v.x * n.x + v.z * n.z) / len;
    if (into < 0) {
      out.x -= (n.x / len) * into;
      out.z -= (n.z / len) * into;
    }
  }
  if (out.dot(n) >= 0) return out;
  return clipVelocity(out, n, out, overbounce);
}

export class CharacterController {
  /**
   * @param {import('./collisionWorld.js').CollisionWorld} world
   * @param {object} sv variáveis sv_* (src/player/movementVars.js), lidas a cada chamada
   */
  constructor(world, sv) {
    this.world = world;
    this.sv = sv;
    this.radius = HULL.radius;
    this.skin = CONTROLLER.skin;
    this.tr = createTrace(); // batidas do tryPlayerMove
    this.trStep = createTrace(); // subir/descer degrau e grudar no chão
    this.trProbe = createTrace(); // encostar no chão (categorizePosition)
    this.trFirst = createTrace(); // primeira varredura do walkMove, reaproveitada no stepMove
    this._planes = Array.from({ length: CONTROLLER.maxClipPlanes }, () => new THREE.Vector3());
    this._lowEdge = new Array(CONTROLLER.maxClipPlanes).fill(false);
    this._end = new THREE.Vector3();
    this._original = new THREE.Vector3();
    this._primal = new THREE.Vector3();
    this._clipped = new THREE.Vector3();
    this._dir = new THREE.Vector3();
    this._pos = new THREE.Vector3();
    this._vel = new THREE.Vector3();
    this._downPos = new THREE.Vector3();
    this._downVel = new THREE.Vector3();
    this._probe = new THREE.Vector3();
    this._alt = new THREE.Vector3();
    // Lugar livre "com chão" para a busca de espaço livre (criado uma vez: nada aloca por tick).
    this._hasGround = (p) => this.support(
      p.x, p.z, p.y - CONTROLLER.unstuckGroundDepth, p.y + CONTROLLER.supportTolerance,
    );
    // Chão da base chata achado pela última consulta (altura da superfície, normal para cima, material).
    this.ground = { height: 0, normal: new THREE.Vector3(0, 1, 0), surface: 0 };
    // Último contato que cortou a velocidade (ponto e normal): o r_colisao desenha a normal.
    this.lastContact = { point: new THREE.Vector3(), normal: new THREE.Vector3(), valid: false };
  }

  /** TracePlayerBBox: varre a cápsula do estado `s` (altura atual) de `from` até `to`. */
  trace(from, to, s, out) {
    return this.world.sweepCapsule(
      from.x, from.y, from.z, to.x - from.x, to.y - from.y, to.z - from.z, this.radius, s.height, out, this.skin,
    );
  }

  /** A cápsula de altura `height` cabe com os pés em (x, y, z)? */
  fits(x, y, z, height) {
    return this.world.canOccupy(x, y, z, this.radius, height);
  }

  /**
   * Chão da base chata para pés em (x, z) entre as alturas `minFeet` e `maxFeet`: a face andável mais alta coberta
   * pelo disco dos pés (os pés param a uma folga acima dela). Resultado em `this.ground`.
   */
  support(x, z, minFeet, maxFeet) {
    return this.world.supportBelow(
      x, z, HULL.footRadius, minFeet - this.skin, maxFeet - this.skin, CONTROLLER.walkableNormalY, this.ground,
    );
  }

  /**
   * Tira a cápsula de penetrações (corpo em movimento, arredondamento, saída do noclip): desempenetra; se não
   * resolver, procura espaço livre a partir da posição original. Empurrão grande para um lugar sem chão (noclip
   * desligado no meio de uma parede de fora do set) perde para um lugar livre com chão perto. false = continua presa.
   */
  resolvePenetration(s) {
    const probe = this._probe.copy(s.origin);
    const r = this.radius, h = s.height, skin = this.skin;
    if (this.world.depenetrate(probe, r, h, skin)) {
      if (probe.distanceToSquared(s.origin) > CONTROLLER.unstuckPreferGround ** 2 && !this._hasGround(probe)) {
        this._alt.copy(s.origin);
        if (this.world.findFreeSpot(this._alt, r, h, skin, this._hasGround)) probe.copy(this._alt);
      }
      s.origin.copy(probe);
      return true;
    }
    if (this.world.findFreeSpot(probe.copy(s.origin), r, h, skin, this._hasGround)
      || this.world.findFreeSpot(probe.copy(s.origin), r, h, skin)) {
      s.origin.copy(probe);
      return true;
    }
    return false;
  }

  /** SetGroundEntity: liga o chão `ground` ({normal, superfície}; zera a velocidade vertical) ou desliga (null). */
  setGround(s, ground) {
    if (!ground) {
      s.onGround = false;
      return;
    }
    s.onGround = true;
    s.groundNormal.copy(ground.normal);
    s.groundSurface = ground.surface;
    s.surfaceFriction = SURFACES[ground.surface].friction;
    s.velocity.y = 0;
  }

  /** Leva os pés na vertical até `y` se a cápsula passar (encostar no chão, degrau, pouso na beirada). */
  #moveVertical(s, y, tr) {
    const o = s.origin;
    if (Math.abs(y - o.y) <= CONTROLLER.snapMin) return true;
    this._end.set(o.x, y, o.z);
    this.trace(o, this._end, s, tr);
    if (tr.startSolid || Math.abs(tr.endpos.y - y) > CONTROLLER.supportTolerance) return false;
    o.y = tr.endpos.y;
    return true;
  }

  /**
   * CategorizePosition: está no chão? Chão da base chata até 2 u abaixo dos pés, ou atravessado pela base de cima
   * para baixo durante o tick (`startY`: pés no começo do tick — pouso na beirada). Subindo rápido nunca está.
   */
  categorizePosition(s, startY = s.origin.y) {
    s.surfaceFriction = 1;
    const vy = s.velocity.y;
    if (vy > CONTROLLER.nonJumpVelocity) {
      this.setGround(s, null);
      return;
    }
    const o = s.origin;
    const top = Math.max(o.y, startY) + CONTROLLER.supportTolerance;
    if (this.support(o.x, o.z, o.y - CONTROLLER.groundProbe, top)
      && this.#moveVertical(s, this.ground.height + this.skin, this.trProbe)) {
      this.setGround(s, this.ground);
      return;
    }
    this.setGround(s, null);
    if (vy > 0) s.surfaceFriction = CONTROLLER.steepSlideFriction;
  }

  /**
   * TryPlayerMove: desliza pelo tempo `dt` em até 4 batidas, cortando a velocidade contra até 5 planos; em quina de
   * dois planos segue pelo vinco; velocidade contrária à original para seco (sem tremer em quina inclinada).
   * `firstDest`/`firstTrace`: a primeira varredura já feita pelo walkMove.
   */
  tryPlayerMove(s, dt, firstDest = null, firstTrace = null) {
    const planes = this._planes;
    const original = this._original.copy(s.velocity);
    const primal = this._primal.copy(s.velocity);
    const clipped = this._clipped;
    const tr = this.tr;
    const walkable = CONTROLLER.walkableNormalY;
    let numPlanes = 0;
    let allFraction = 0;
    let timeLeft = dt;
    // Planos de quina pegos pelo redondo de baixo (normal subindo, diferente da face): cortados pelo clipLowEdge — a
    // quina fica acima dos pés, onde a base chata bateria na lateral. Degrau fica com o stepMove, pouso na beirada com
    // o categorizePosition; rampa (contato de face) continua empurrando para cima como no Source.
    const lowEdge = this._lowEdge;
    for (let bump = 0; bump < CONTROLLER.maxBumps; bump++) {
      if (s.velocity.lengthSq() === 0) break;
      const end = this._end.copy(s.origin).addScaledVector(s.velocity, timeLeft);
      if (bump === 0 && firstTrace && firstDest && end.equals(firstDest)) copyTrace(firstTrace, tr);
      else this.trace(s.origin, end, s, tr);
      allFraction += tr.fraction;
      if (tr.startSolid) {
        // Preso dentro de algo (corpo em movimento): para aqui; a desempenetração do próximo tick resolve.
        s.velocity.set(0, 0, 0);
        return;
      }
      if (tr.fraction > 0) {
        s.origin.copy(tr.endpos);
        original.copy(s.velocity);
        numPlanes = 0;
      }
      if (tr.fraction === 1) break;
      timeLeft -= timeLeft * tr.fraction;
      if (numPlanes >= CONTROLLER.maxClipPlanes) {
        s.velocity.set(0, 0, 0);
        break;
      }
      lowEdge[numPlanes] = tr.normal.y > 0 && tr.normal.dot(tr.faceNormal) < CONTROLLER.edgeContactDot;
      planes[numPlanes++].copy(tr.normal);
      this.#noteContact(tr);
      if (numPlanes === 1 && !s.onGround) {
        // No ar, contra um plano só: o chão corta seco; a parede pode quicar (sv_bounce).
        const overbounce = planes[0].y > walkable ? 1 : 1 + this.sv.bounce * (1 - s.surfaceFriction);
        if (lowEdge[0]) clipLowEdge(original, planes[0], clipped, overbounce);
        else clipVelocity(original, planes[0], clipped, overbounce);
        s.velocity.copy(clipped);
        original.copy(clipped);
        continue;
      }
      let i = 0;
      for (; i < numPlanes; i++) {
        if (lowEdge[i]) clipLowEdge(original, planes[i], s.velocity, 1);
        else clipVelocity(original, planes[i], s.velocity, 1);
        let j = 0;
        for (; j < numPlanes; j++) if (j !== i && s.velocity.dot(planes[j]) < 0) break;
        if (j === numPlanes) break;
      }
      if (i === numPlanes) {
        // Nenhum plano sozinho resolve: segue pelo vinco dos dois (com três ou mais, para).
        if (numPlanes !== 2) {
          s.velocity.set(0, 0, 0);
          break;
        }
        const dir = this._dir.crossVectors(planes[0], planes[1]);
        if (dir.lengthSq() < 1e-12) {
          s.velocity.set(0, 0, 0);
          break;
        }
        dir.normalize();
        s.velocity.copy(dir).multiplyScalar(dir.dot(s.velocity));
        // Vinco com quina baixa também não levanta a cápsula.
        const lift = Math.max(original.y, 0);
        if ((lowEdge[0] || lowEdge[1]) && s.velocity.y > lift) s.velocity.y = lift;
      }
      if (s.velocity.dot(primal) <= 0) {
        s.velocity.set(0, 0, 0);
        break;
      }
    }
    if (allFraction === 0) s.velocity.set(0, 0, 0);
  }

  #noteContact(tr) {
    const c = this.lastContact;
    c.point.copy(tr.point);
    c.normal.copy(tr.normal);
    c.valid = true;
  }

  /**
   * StepMove: compara deslizar direto com "subir um degrau (sv_stepsize), deslizar e descer até o chão da base chata"
   * e fica com o que andou mais no plano. Degrau de verdade (não rampa) vira deslocamento da câmera para suavizar.
   */
  stepMove(s, dt, dest, firstTrace) {
    const pos = this._pos.copy(s.origin);
    const vel = this._vel.copy(s.velocity);
    // 1) Deslizar direto.
    this.tryPlayerMove(s, dt, dest, firstTrace);
    const downPos = this._downPos.copy(s.origin);
    const downVel = this._downVel.copy(s.velocity);
    // 2) Subir um degrau.
    s.origin.copy(pos);
    s.velocity.copy(vel);
    this._end.copy(s.origin);
    this._end.y += this.sv.stepsize + this.skin;
    const tr = this.trace(s.origin, this._end, s, this.trStep);
    if (!tr.startSolid) s.origin.copy(tr.endpos);
    // 3) Deslizar lá em cima.
    this.tryPlayerMove(s, dt);
    // 4) Descer até o chão coberto pela base — no máximo até a altura de partida, como a descida do Source.
    const tol = CONTROLLER.supportTolerance;
    const found = this.support(s.origin.x, s.origin.z, pos.y - tol, s.origin.y + tol);
    if (!this.#moveVertical(s, found ? this.ground.height + this.skin : pos.y, this.trStep)) {
      // A cápsula não desce até lá (quina íngreme no caminho): vale o deslize direto.
      s.origin.copy(downPos);
      s.velocity.copy(downVel);
      return;
    }
    const downDist = (downPos.x - pos.x) ** 2 + (downPos.z - pos.z) ** 2;
    const upDist = (s.origin.x - pos.x) ** 2 + (s.origin.z - pos.z) ** 2;
    if (downDist > upDist) {
      s.origin.copy(downPos);
      s.velocity.copy(downVel);
      return;
    }
    s.velocity.y = downVel.y;
    this.#viewStep(s, s.origin.y - pos.y, Math.sqrt(upDist), found ? this.ground.normal.y : 1);
  }

  /**
   * StayOnGround: a base chata acompanha o chão que cobre — desce escada e rampa e sobe degrau baixo e rampa (até
   * sv_stepsize para cada lado), se a cápsula passar.
   */
  stayOnGround(s, horizontalMove) {
    const o = s.origin;
    const step = this.sv.stepsize;
    if (!this.support(o.x, o.z, o.y - step, o.y + step)) return;
    const y = this.ground.height + this.skin;
    const dy = y - o.y;
    if (Math.abs(dy) <= CONTROLLER.snapMin) return;
    if (this.#moveVertical(s, y, this.trStep)) this.#viewStep(s, dy, horizontalMove, this.ground.normal.y);
  }

  /**
   * Subida/descida brusca (degrau) vira deslocamento da câmera; rampa não: a variação de altura que a inclinação do
   * chão explica pelo deslocamento no plano é contínua.
   */
  #viewStep(s, dy, horizontal, groundNy) {
    const slope = groundNy > 1e-6 ? Math.sqrt(Math.max(0, 1 - groundNy * groundNy)) / groundNy : 0;
    if (Math.abs(dy) > horizontal * slope + CONTROLLER.discreteStepTolerance) s.viewOffset -= dy;
  }

  /** CheckVelocity: troca NaN por 0 e limita cada eixo a sv_maxvelocity. */
  checkVelocity(s) {
    const max = this.sv.maxvelocity;
    const v = s.velocity;
    v.x = Number.isFinite(v.x) ? Math.max(-max, Math.min(max, v.x)) : 0;
    v.y = Number.isFinite(v.y) ? Math.max(-max, Math.min(max, v.y)) : 0;
    v.z = Number.isFinite(v.z) ? Math.max(-max, Math.min(max, v.z)) : 0;
  }
}
```

- [ ] **Passo 2: Commit** — `git add src/physics/characterController.js && git commit -m "feat(fase-3.1): controlador de personagem (porte do gamemovement do Source)"`

---

### Tarefa 6: Comando do tick e movimento (FullWalkMove)

**Files:**
- Create: `src/player/moveCmd.js`, `src/player/movement.js`
- Test: Tarefa 7

- [ ] **Passo 1: Comando do tick**

```js file=src/player/moveCmd.js
// Comando de movimento de um tick (o "usercmd" do Source): o que o jogador quer fazer, sem estado. Sai da entrada
// local, da IA dos bots (Fase 7) ou da rede (Fase 9) e alimenta o playerMove.

export const BTN = Object.freeze({
  JUMP: 1 << 0,
  DUCK: 1 << 1,
  WALK: 1 << 2,
  ATTACK: 1 << 3,
  ATTACK2: 1 << 4,
  RELOAD: 1 << 5,
  USE: 1 << 6,
  INSPECT: 1 << 7,
});

/** Ação da entrada (src/data/actions.js) → bit do comando. */
const BUTTON_ACTIONS = Object.freeze([
  ['jump', BTN.JUMP],
  ['crouch', BTN.DUCK],
  ['walk', BTN.WALK],
  ['fire', BTN.ATTACK],
  ['aim', BTN.ATTACK2],
  ['reload', BTN.RELOAD],
  ['use', BTN.USE],
  ['inspect', BTN.INSPECT],
]);

export function createMoveCmd() {
  return { tick: 0, forward: 0, side: 0, buttons: 0, yaw: 0, pitch: 0 };
}

/**
 * Preenche o comando com a entrada amostrada neste tick (InputManager.sampleTick já rodou): movimento analógico
 * (−1..1, já normalizado), bits dos botões e os ângulos da visão.
 */
export function readMoveCmd(cmd, input, tick, yaw, pitch) {
  cmd.tick = tick;
  cmd.forward = input.move.y;
  cmd.side = input.move.x;
  let buttons = 0;
  for (let i = 0; i < BUTTON_ACTIONS.length; i++) {
    if (input.isDown(BUTTON_ACTIONS[i][0])) buttons |= BUTTON_ACTIONS[i][1];
  }
  cmd.buttons = buttons;
  cmd.yaw = yaw;
  cmd.pitch = pitch;
  return cmd;
}
```

- [ ] **Passo 2: Movimento**

```js file=src/player/movement.js
// Movimento do jogador — porte do FullWalkMove do Source (gamemovement.cpp) para Y para cima, com os números do CS:GO
// (src/data/movement.js). Uma função sobre dados simples, playerMove(estado, comando, ambiente): o mesmo código move o
// jogador local, a predição do cliente (Fase 9) e os bots (Fase 7) — só o comando muda.

import * as THREE from 'three';
import { CONTROLLER, DUCK, HULL } from '../data/movement.js';
import { FREE_CAMERA } from '../data/sandbox.js';
import { SURFACES } from '../data/surfaces.js';
import { BTN } from './moveCmd.js';

export const MOVETYPE = Object.freeze({ WALK: 'andar', NOCLIP: 'noclip' });

const _wishVel = new THREE.Vector3();
const _wishDir = new THREE.Vector3();
const _dest = new THREE.Vector3();
const _start = new THREE.Vector3();
const _fwd = new THREE.Vector3();
const _right = new THREE.Vector3();

/** Estado de movimento de um jogador: dados simples (a rede serializa, a predição copia). */
export function createMoveState({ position = null } = {}) {
  return {
    origin: position ? position.clone() : new THREE.Vector3(), // pés
    velocity: new THREE.Vector3(),
    height: HULL.standHeight, // altura atual da cápsula
    ducked: false, // cápsula agachada
    duckAmount: 0, // 0 em pé … 1 agachado (olho e velocidade)
    onGround: false,
    groundNormal: new THREE.Vector3(0, 1, 0),
    groundSurface: 0,
    surfaceFriction: 1,
    moveType: MOVETYPE.WALK,
    oldButtons: 0,
    fallVelocity: 0, // velocidade de queda no começo do tick (para o pouso)
    viewOffset: 0, // subida/descida brusca deste tick que a câmera suaviza (degrau, troca de cápsula no ar)
    stuck: false,
  };
}

/** Copia um estado de movimento (predição e reconciliação da rede, testes de determinismo). */
export function copyMoveState(src, dst) {
  dst.origin.copy(src.origin);
  dst.velocity.copy(src.velocity);
  dst.height = src.height;
  dst.ducked = src.ducked;
  dst.duckAmount = src.duckAmount;
  dst.onGround = src.onGround;
  dst.groundNormal.copy(src.groundNormal);
  dst.groundSurface = src.groundSurface;
  dst.surfaceFriction = src.surfaceFriction;
  dst.moveType = src.moveType;
  dst.oldButtons = src.oldButtons;
  dst.fallVelocity = src.fallVelocity;
  dst.viewOffset = src.viewOffset;
  dst.stuck = src.stuck;
  return dst;
}

/** Altura do olho sobre os pés (sem a suavização da câmera). */
export function eyeHeight(s) {
  return HULL.standEye + (HULL.duckEye - HULL.standEye) * s.duckAmount;
}

/** Velocidade máxima no chão: a da arma na mão, reduzida pelo agachar (×0,34 no agachado completo). */
export function maxSpeedOf(s, env) {
  const duck = 1 + (DUCK.speedMultiplier - 1) * s.duckAmount;
  return Math.min(env.sv.maxspeed, env.maxSpeed * duck);
}

/** Friction do Source: abaixo de sv_stopspeed o freio é o de sv_stopspeed (o jogador para de vez). */
export function friction(s, sv, dt) {
  const v = s.velocity;
  const speed = v.length();
  if (speed < 0.1) return;
  const control = speed < sv.stopspeed ? sv.stopspeed : speed;
  const drop = control * sv.friction * s.surfaceFriction * dt;
  v.multiplyScalar(Math.max(speed - drop, 0) / speed);
}

/** Accelerate do Source: soma velocidade na direção do desejo sem passar de `wishSpeed` nessa direção. */
export function accelerate(s, wishDir, wishSpeed, accel, dt) {
  const add = wishSpeed - s.velocity.dot(wishDir);
  if (add <= 0) return;
  s.velocity.addScaledVector(wishDir, Math.min(accel * dt * wishSpeed * s.surfaceFriction, add));
}

/** AirAccelerate do Source: o desejo vale só até `maxWish` (30 u/s), mas a taxa usa o desejo inteiro — air-strafe. */
export function airAccelerate(s, wishDir, wishSpeed, accel, maxWish, dt) {
  const add = Math.min(wishSpeed, maxWish) - s.velocity.dot(wishDir);
  if (add <= 0) return;
  s.velocity.addScaledVector(wishDir, Math.min(accel * wishSpeed * dt * s.surfaceFriction, add));
}

/** Desejo de movimento no plano pelo yaw do comando, em u/s, limitado à velocidade máxima. */
function wishVelocity(s, cmd, env, out) {
  _fwd.set(-Math.sin(cmd.yaw), 0, -Math.cos(cmd.yaw));
  _right.set(Math.cos(cmd.yaw), 0, -Math.sin(cmd.yaw));
  const max = maxSpeedOf(s, env);
  out.set(0, 0, 0).addScaledVector(_fwd, cmd.forward * max).addScaledVector(_right, cmd.side * max);
  const speed = out.length();
  if (speed > max) out.multiplyScalar(max / speed);
  return out;
}

/** Direção do desejo em _wishDir; devolve o módulo. */
function wishDirection(vel) {
  const speed = vel.length();
  if (speed > 0) _wishDir.copy(vel).divideScalar(speed);
  else _wishDir.set(0, 0, 0);
  return speed;
}

/** WalkMove: acelera no plano, desliza (ou sobe o degrau) e gruda no chão. */
function walkMove(s, cmd, env) {
  const { controller: ctl, sv, dt } = env;
  const wishSpeed = wishDirection(wishVelocity(s, cmd, env, _wishVel));
  s.velocity.y = 0;
  accelerate(s, _wishDir, wishSpeed, sv.accelerate, dt);
  s.velocity.y = 0;
  if (s.velocity.length() < CONTROLLER.minSpeed) {
    s.velocity.set(0, 0, 0);
    return;
  }
  _start.copy(s.origin);
  _dest.copy(s.origin).addScaledVector(s.velocity, dt);
  const tr = ctl.trace(s.origin, _dest, s, ctl.trFirst);
  if (tr.fraction === 1) s.origin.copy(tr.endpos);
  else ctl.stepMove(s, dt, _dest, tr);
  ctl.stayOnGround(s, Math.hypot(s.origin.x - _start.x, s.origin.z - _start.z));
}

/** AirMove: no ar só o air-accelerate controla e a cápsula desliza pelas superfícies. */
function airMove(s, cmd, env) {
  const { controller: ctl, sv, dt } = env;
  const wishSpeed = wishDirection(wishVelocity(s, cmd, env, _wishVel));
  airAccelerate(s, _wishDir, wishSpeed, sv.airaccelerate, sv.air_max_wishspeed, dt);
  ctl.tryPlayerMove(s, dt);
}

/** CheckJumpButton: pula do chão com o impulso do CS:GO; precisa soltar o botão para pular de novo. */
function checkJumpButton(s, env) {
  if (!s.onGround) return;
  if (s.oldButtons & BTN.JUMP) return;
  const surface = s.groundSurface;
  env.controller.setGround(s, null);
  s.velocity.y = env.sv.jump_impulse * SURFACES[surface].jumpFactor;
  // FinishGravity do Source dentro do CheckJumpButton: o tick do pulo integra a parábola exata.
  s.velocity.y -= env.sv.gravity * 0.5 * env.dt;
  env.events.push({ type: 'jump', surface });
}

/**
 * Levantar: no ar os pés descem 9 (desfaz o encolhimento pelo centro) se a cápsula couber e a base não atravessar
 * chão que ela cobre (ficaria dentro da beirada); senão cresce para cima. Só se couber.
 */
function tryUnduck(s, env) {
  const ctl = env.controller;
  const o = s.origin;
  const lowered = o.y - HULL.airDuckLift;
  if (!s.onGround && ctl.fits(o.x, lowered, o.z, HULL.standHeight)
    && !ctl.support(o.x, o.z, lowered, o.y + CONTROLLER.supportTolerance)) {
    o.y -= HULL.airDuckLift;
    s.viewOffset += HULL.airDuckLift;
  } else if (!ctl.fits(o.x, o.y, o.z, HULL.standHeight)) {
    return;
  }
  s.ducked = false;
  s.height = HULL.standHeight;
  env.events.push({ type: 'unduck' });
}

/**
 * Agachar (CS:GO): a transição anda a 8/s e a cápsula troca quando ela completa. No chão encolhe pelo topo; no ar,
 * pelo centro (pés +9, cabeça −9: o pulo agachado). Levantar só se a cápsula em pé couber.
 */
function duck(s, cmd, env) {
  if (cmd.buttons & BTN.DUCK) {
    s.duckAmount = Math.min(1, s.duckAmount + DUCK.speed * env.dt);
    if (!s.ducked && s.duckAmount >= 1) {
      if (!s.onGround) {
        s.origin.y += HULL.airDuckLift;
        s.viewOffset -= HULL.airDuckLift;
      }
      s.ducked = true;
      s.height = HULL.duckHeight;
      env.events.push({ type: 'duck' });
    }
    return;
  }
  if (s.ducked) tryUnduck(s, env);
  if (!s.ducked) s.duckAmount = Math.max(0, s.duckAmount - DUCK.speed * env.dt);
}

/** Noclip: voo com a aceleração e o atrito da câmera livre (FREE_CAMERA), atravessando tudo. */
function noclipMove(s, cmd, dt) {
  const P = FREE_CAMERA;
  const cp = Math.cos(cmd.pitch);
  _fwd.set(-Math.sin(cmd.yaw) * cp, Math.sin(cmd.pitch), -Math.cos(cmd.yaw) * cp);
  _right.set(Math.cos(cmd.yaw), 0, -Math.sin(cmd.yaw));
  const up = (cmd.buttons & BTN.JUMP ? 1 : 0) - (cmd.buttons & BTN.DUCK ? 1 : 0);
  let speed = P.speed;
  if (cmd.buttons & BTN.WALK) speed *= P.walkFactor;
  if (cmd.buttons & BTN.ATTACK2) speed *= P.boostFactor;
  _wishVel.set(0, 0, 0).addScaledVector(_fwd, cmd.forward).addScaledVector(_right, cmd.side);
  const planar = _wishVel.length();
  if (planar > 1) _wishVel.divideScalar(planar);
  _wishVel.multiplyScalar(speed);
  _wishVel.y += up * P.verticalSpeed * (speed / P.speed);
  const wishSpeed = wishDirection(_wishVel);
  const v = s.velocity;
  const current = v.length();
  if (current > 0) {
    const drop = Math.max(current, P.stopSpeed) * P.friction * dt;
    v.multiplyScalar(Math.max(current - drop, 0) / current);
  }
  if (wishSpeed > 0) {
    const add = wishSpeed - v.dot(_wishDir);
    if (add > 0) v.addScaledVector(_wishDir, Math.min(P.accelerate * wishSpeed * dt, add));
  }
  s.origin.addScaledVector(v, dt);
}

/**
 * Um tick de movimento (FullWalkMove do Source). `env`: { controller, sv, dt, maxSpeed (velocidade da arma na mão),
 * events: [] }. Eventos do tick em env.events: jump {surface}, land {speed, surface}, duck, unduck.
 */
export function playerMove(s, cmd, env) {
  const { controller: ctl, sv, dt, events } = env;
  events.length = 0;
  s.viewOffset = 0;
  if (s.moveType === MOVETYPE.NOCLIP) {
    noclipMove(s, cmd, dt);
    s.onGround = false;
    s.fallVelocity = 0;
    s.stuck = false;
    s.oldButtons = cmd.buttons;
    return;
  }
  s.stuck = !ctl.resolvePenetration(s);
  const startedOnGround = s.onGround;
  if (!s.onGround) s.fallVelocity = -s.velocity.y;
  duck(s, cmd, env);
  const startY = s.origin.y; // pés no começo do movimento: pouso na beirada que a base atravessar descendo
  // Meia gravidade antes e meia depois do movimento: a posição segue a parábola exata.
  s.velocity.y -= sv.gravity * 0.5 * dt;
  // O pulo vem antes do atrito: pular no tick do pouso não perde velocidade (bunny hop).
  if (cmd.buttons & BTN.JUMP) checkJumpButton(s, env);
  if (s.onGround) {
    s.velocity.y = 0;
    friction(s, sv, dt);
  }
  ctl.checkVelocity(s);
  if (s.onGround) walkMove(s, cmd, env);
  else airMove(s, cmd, env);
  ctl.categorizePosition(s, startY);
  ctl.checkVelocity(s);
  s.velocity.y -= sv.gravity * 0.5 * dt;
  if (s.onGround) {
    s.velocity.y = 0;
    if (!startedOnGround) events.push({ type: 'land', speed: Math.max(0, s.fallVelocity), surface: s.groundSurface });
    s.fallVelocity = 0;
  }
  s.oldButtons = cmd.buttons;
}
```

- [ ] **Passo 3: Commit** — `git add src/player/moveCmd.js src/player/movement.js && git commit -m "feat(fase-3.1): comando do tick e movimento (FullWalkMove do Source)"`

---

### Tarefa 7: Cenários do controlador e do movimento

**Files:**
- Create: `tests/playerTestUtils.js`
- Test: `tests/characterController.test.js`

- [ ] **Passo 1: Utilitário do jogador simulado**

```js file=tests/playerTestUtils.js
// Utilitários dos testes de movimento: jogador simulado sobre um mundo de colisão, sem navegador.
import * as THREE from 'three';
import { CharacterController } from '../src/physics/characterController.js';
import { createMoveState, playerMove } from '../src/player/movement.js';
import { createMoveCmd } from '../src/player/moveCmd.js';
import { createSvVars } from '../src/player/movementVars.js';
import { WEAPONS } from '../src/data/weapons.js';

export const DT = 1 / 64;

/** Jogador com a faca na mão, pés em [x, y, z], já classificado no chão (ou no ar). */
export function makePlayer(world, [x, y, z], { yaw = 0, sv = createSvVars() } = {}) {
  const controller = new CharacterController(world, sv);
  const state = createMoveState({ position: new THREE.Vector3(x, y, z) });
  const env = { controller, sv, dt: DT, maxSpeed: WEAPONS.knife.moveSpeed, events: [] };
  const cmd = createMoveCmd();
  cmd.yaw = yaw;
  controller.categorizePosition(state);
  return { world, controller, state, env, cmd, sv };
}

/** Roda `ticks` ticks; `drive(cmd, i, p)` monta o comando antes de cada um. Devolve os eventos de todos os ticks. */
export function run(p, ticks, drive = null) {
  const events = [];
  for (let i = 0; i < ticks; i++) {
    if (drive) drive(p.cmd, i, p);
    p.cmd.tick += 1;
    playerMove(p.state, p.cmd, p.env);
    for (const e of p.env.events) events.push(e);
  }
  return events;
}

/** Comando parado (sem movimento nem botões). */
export function idle(cmd) {
  cmd.forward = 0;
  cmd.side = 0;
  cmd.buttons = 0;
}

/** Correndo para a frente, sem botões. */
export function forward(cmd) {
  cmd.forward = 1;
  cmd.side = 0;
  cmd.buttons = 0;
}

export const speed2d = (s) => Math.hypot(s.velocity.x, s.velocity.z);
```

- [ ] **Passo 2: Escrever os cenários**

```js file=tests/characterController.test.js
// Cenários do controlador e do movimento (Fase 3.1), sem navegador: números do Source, repouso no chão, aceleração
// do CS, parede, quina aguda, degraus, rampas, descer escada grudado, teto, pulo (57 u), pulo agachado (64 × 72),
// beirada, túnel baixo, noclip, pouso e determinismo.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { RNG } from '../src/core/rng.js';
import { CONTROLLER, HULL, SV_DEFAULTS } from '../src/data/movement.js';
import { SURFACE_INDEX } from '../src/data/surfaces.js';
import { BTN } from '../src/player/moveCmd.js';
import { MOVETYPE, accelerate, airAccelerate, copyMoveState, createMoveState, friction } from '../src/player/movement.js';
import { clipVelocity } from '../src/physics/characterController.js';
import { floor, worldOf } from './worldTestUtils.js';
import { DT, forward, idle, makePlayer, run, speed2d } from './playerTestUtils.js';

const SKIN = CONTROLLER.skin;
const R = HULL.radius;
const DEG = Math.PI / 180;

test('números do Source: corte contra plano, atrito, aceleração e aceleração no ar', () => {
  const out = new THREE.Vector3();
  clipVelocity(new THREE.Vector3(3, -4, 0), new THREE.Vector3(0, 1, 0), out, 1);
  assert.ok(out.distanceTo(new THREE.Vector3(3, 0, 0)) < 1e-12);
  const s = createMoveState();
  s.velocity.set(250, 0, 0);
  friction(s, SV_DEFAULTS, DT);
  assert.ok(Math.abs(s.velocity.x - 250 * (1 - 5.2 / 64)) < 1e-9);
  s.velocity.set(50, 0, 0);
  friction(s, SV_DEFAULTS, DT);
  assert.ok(Math.abs(s.velocity.x - (50 - (80 * 5.2) / 64)) < 1e-9, 'abaixo do stopspeed freia pelo stopspeed');
  s.velocity.set(0, 0, 0);
  accelerate(s, new THREE.Vector3(1, 0, 0), 250, 5.5, DT);
  assert.ok(Math.abs(s.velocity.x - (5.5 * 250) / 64) < 1e-9);
  s.velocity.set(0, 0, 0);
  airAccelerate(s, new THREE.Vector3(0, 0, 1), 250, 12, 30, DT);
  assert.ok(Math.abs(s.velocity.z - 30) < 1e-9, 'no ar o desejo fica em 30 u/s');
});

test('repouso: pousa no chão exatamente na folga e para', () => {
  const p = makePlayer(worldOf((b) => floor(b)), [0, 30, 0]);
  const events = run(p, 64, idle);
  assert.ok(p.state.onGround);
  assert.ok(Math.abs(p.state.origin.y - SKIN) < 2e-3, `y ${p.state.origin.y}`);
  assert.ok(p.state.velocity.length() < 1e-9);
  assert.equal(events.filter((e) => e.type === 'land').length, 1);
});

test('chão: acelera até a velocidade da faca (250 u/s) e para sozinho pelo atrito', () => {
  const p = makePlayer(worldOf((b) => floor(b)), [0, 0, 0]);
  run(p, 128, forward);
  assert.ok(Math.abs(speed2d(p.state) - 250) < 1e-6, `velocidade ${speed2d(p.state)}`);
  assert.ok(p.state.velocity.z < 0, 'yaw 0 anda para −Z');
  let ticks = 0;
  while (speed2d(p.state) > 0 && ticks < 128) {
    run(p, 1, idle);
    ticks++;
  }
  assert.ok(ticks > 5 && ticks < 64, `parou em ${ticks} ticks`);
});

test('parede: deslizando na diagonal nunca entra e continua andando ao longo dela', () => {
  const p = makePlayer(worldOf((b) => {
    floor(b);
    b.box(2000, 200, 20, { center: [0, 100, -110] }); // face em z = −100
  }), [0, 0, 0]);
  let minZ = Infinity;
  run(p, 192, (cmd, i, q) => {
    cmd.forward = Math.SQRT1_2;
    cmd.side = Math.SQRT1_2;
    cmd.buttons = 0;
    minZ = Math.min(minZ, q.state.origin.z);
  });
  minZ = Math.min(minZ, p.state.origin.z);
  assert.ok(minZ >= -100 + R + SKIN - 2e-3, `entrou na parede (z ${minZ})`);
  assert.ok(p.state.origin.x > 400, `não deslizou (x ${p.state.origin.x})`);
});

test('quina aguda (40°): para no vértice sem tremer e sem penetrar', () => {
  const half = 20 * DEG;
  const apex = new THREE.Vector3(0, 0, -300);
  const world = worldOf((b) => {
    floor(b);
    for (const side of [-1, 1]) {
      const far = new THREE.Vector3(apex.x + side * Math.sin(half) * 400, 0, apex.z + Math.cos(half) * 400);
      b.quad(apex, far, far.clone().setY(200), apex.clone().setY(200), 'papelao');
    }
  });
  const p = makePlayer(world, [0, 0, 0]);
  const positions = [];
  run(p, 256, (cmd, i, q) => {
    forward(cmd);
    const o = q.state.origin;
    if (!world.canOccupy(o.x, o.y, o.z, R, q.state.height)) assert.fail(`penetrou no tick ${i}`);
    positions.push(o.clone());
  });
  const last = positions.slice(-32);
  const drift = last[0].distanceTo(last[last.length - 1]);
  assert.ok(drift < 0.05, `tremendo na quina (${drift})`);
  assert.ok(p.state.origin.z > apex.z, 'passou da quina');
});

test('degraus: sobe escada de 16 u, sobe o limite de 18 u e barra o de 20 u', () => {
  const stairs = worldOf((b) => {
    floor(b);
    b.stairs(200, 16, 32, 8, { center: [0, 0, 100] });
    b.box(200, 128, 2000, { center: [0, 64, 356 + 1000] }); // platô no topo
  });
  const p = makePlayer(stairs, [0, 0, 0], { yaw: Math.PI }); // yaw π anda para +Z
  run(p, 256, forward);
  assert.ok(Math.abs(p.state.origin.y - (8 * 16 + SKIN)) < 2e-3, `topo da escada: y ${p.state.origin.y}`);
  assert.ok(p.state.onGround);
  // Agachado (85 u/s) e partindo parado, encostado no espelho: com qualquer avanço a base chata pousa no degrau.
  const slow = makePlayer(stairs, [0, 0, 100 - R - SKIN], { yaw: Math.PI });
  run(slow, 512, (cmd) => {
    forward(cmd);
    cmd.buttons = BTN.DUCK;
  });
  assert.ok(Math.abs(slow.state.origin.y - (8 * 16 + SKIN)) < 2e-3, `agachado, topo da escada: y ${slow.state.origin.y}`);
  for (const [rise, climbs] of [[18, true], [20, false]]) {
    const world = worldOf((b) => {
      floor(b);
      b.box(200, rise, 2000, { center: [0, rise / 2, 1050] });
    });
    const q = makePlayer(world, [0, 0, 0], { yaw: Math.PI });
    run(q, 128, forward);
    assert.equal(q.state.origin.y > rise - 1, climbs, `degrau de ${rise} u: y ${q.state.origin.y}`);
  }
});

test('rampas: sobe 30° até o topo, não sobe 50° e escorrega parado nela', () => {
  const ramp = (deg) => worldOf((b) => {
    floor(b);
    const h = 200 * Math.tan(deg * DEG);
    b.ramp(300, 200, h, { center: [0, 0, 60] });
    b.box(300, h, 2000, { center: [0, h / 2, 260 + 1000] }); // platô no topo
  });
  const up = makePlayer(ramp(30), [0, 0, 0], { yaw: Math.PI });
  run(up, 192, forward);
  const top30 = 200 * Math.tan(30 * DEG);
  assert.ok(Math.abs(up.state.origin.y - (top30 + SKIN)) < 0.05 && up.state.onGround, `rampa de 30°: y ${up.state.origin.y}`);
  const steep = makePlayer(ramp(50), [0, 0, 0], { yaw: Math.PI });
  let maxY = 0;
  run(steep, 192, (cmd, i, q) => {
    forward(cmd);
    maxY = Math.max(maxY, q.state.origin.y);
  });
  assert.ok(maxY < 40, `subiu a rampa de 50° (y máx ${maxY})`);
  const slide = makePlayer(ramp(50), [0, 100 * Math.tan(50 * DEG) + 5, 160]);
  run(slide, 128, idle);
  assert.ok(slide.state.origin.y < 5, `não escorregou (y ${slide.state.origin.y})`);
  assert.ok(slide.state.origin.z < 60, 'escorregou para a base da rampa');
});

test('descendo escada correndo fica no chão em todos os ticks', () => {
  const world = worldOf((b) => {
    floor(b);
    b.stairs(200, 16, 32, 8, { center: [0, 0, 100] });
    b.box(200, 128, 400, { center: [0, 64, 356 + 200] });
  });
  const p = makePlayer(world, [0, 128 + SKIN, 500]); // no platô, olhando para −Z (desce)
  let airborne = 0;
  run(p, 160, (cmd, i, q) => {
    forward(cmd);
    if (i > 2 && !q.state.onGround) airborne++;
  });
  assert.ok(p.state.origin.y < 1 && p.state.origin.z < 90, `não desceu (y ${p.state.origin.y}, z ${p.state.origin.z})`);
  assert.equal(airborne, 0, 'saiu do chão na descida');
});

test('teto: o pulo bate a cabeça e volta a cair', () => {
  const world = worldOf((b) => {
    floor(b);
    b.box(1000, 20, 1000, { center: [0, 110, 0] }); // teto em y = 100
  });
  const p = makePlayer(world, [0, 0, 0]);
  run(p, 4, idle);
  let top = 0;
  run(p, 64, (cmd, i, q) => {
    idle(cmd);
    if (i === 0) cmd.buttons = BTN.JUMP;
    top = Math.max(top, q.state.origin.y + q.state.height);
  });
  assert.ok(top <= 100 - SKIN + 2e-3, `atravessou o teto (${top})`);
  assert.ok(top > 99, 'deveria ter encostado no teto');
  assert.ok(p.state.onGround);
});

test('pulo: ápice de ~57 u e ~0,755 s no ar', () => {
  const p = makePlayer(worldOf((b) => floor(b)), [0, 0, 0]);
  run(p, 4, idle);
  let maxY = 0;
  let airTicks = 0;
  const events = run(p, 96, (cmd, i, q) => {
    idle(cmd);
    if (i === 0) cmd.buttons = BTN.JUMP;
    maxY = Math.max(maxY, q.state.origin.y);
    if (!q.state.onGround) airTicks++;
  });
  assert.ok(maxY > 56 && maxY <= 57 + SKIN + 1e-6, `ápice ${maxY}`);
  assert.ok(airTicks >= 47 && airTicks <= 50, `ticks no ar ${airTicks}`);
  assert.equal(events.filter((e) => e.type === 'jump').length, 1);
  assert.equal(events.filter((e) => e.type === 'land').length, 1);
});

/**
 * Corre até a caixa, pula a 95 u dela e (opcional) segura o agachar. Devolve o estado final e os pés mais altos com o
 * eixo já sobre a caixa (quem não alcança escorrega da quina e cai: a janela de 4 s cobre a queda).
 */
function jumpOntoBox(boxHeight, { duck = true } = {}) {
  const faceZ = -200;
  const world = worldOf((b) => {
    floor(b);
    b.box(400, boxHeight, 2000, { center: [0, boxHeight / 2, faceZ - 1000] });
  });
  const p = makePlayer(world, [0, 0, 400]);
  let jumpTick = -1;
  let topY = -Infinity;
  run(p, 256, (cmd, i, q) => {
    cmd.forward = 1;
    cmd.side = 0;
    if (jumpTick < 0 && q.state.onGround && q.state.origin.z - R - faceZ <= 95) jumpTick = i;
    cmd.buttons = (i === jumpTick ? BTN.JUMP : 0) | (duck && jumpTick >= 0 ? BTN.DUCK : 0);
    if (q.state.origin.z < faceZ) topY = Math.max(topY, q.state.origin.y);
  });
  return { state: p.state, topY };
}

test('pulo agachado alcança caixa de 64 u; pulo em pé não; 72 u nem agachado', () => {
  const crouched = jumpOntoBox(64).state;
  assert.ok(Math.abs(crouched.origin.y - (64 + SKIN)) < 2e-3, `agachado na caixa de 64: y ${crouched.origin.y}`);
  const standing = jumpOntoBox(64, { duck: false });
  assert.ok(standing.state.origin.y < 1 && standing.topY < 64, `em pé não alcança 64 (y ${standing.state.origin.y}, topo ${standing.topY})`);
  const high = jumpOntoBox(72);
  assert.ok(high.state.origin.y < 1 && high.topY < 72, `agachado não alcança 72 (y ${high.state.origin.y}, topo ${high.topY})`);
});

test('beirada: a base chata segura em pé no topo com o eixo até 16 u fora da borda, sem afundar, e cai além', () => {
  const world = worldOf((b) => {
    floor(b);
    b.box(100, 40, 100, { center: [0, 20, 0] }); // borda em x = 50, topo em y = 40
  });
  const hold = makePlayer(world, [50 + 15.9, 40 + SKIN, 0]);
  run(hold, 64, (cmd, i, q) => {
    idle(cmd);
    if (!q.state.onGround) assert.fail(`caiu da beirada no tick ${i}`);
  });
  const o = hold.state.origin;
  assert.ok(Math.abs(o.y - (40 + SKIN)) < 2e-3 && Math.abs(o.x - (50 + 15.9)) < 1e-6, `afundou ou escorregou: ${o.toArray()}`);
  const fall = makePlayer(world, [50 + 16.1, 40 + SKIN, 0]);
  run(fall, 64, idle);
  assert.ok(fall.state.origin.y < 1, `não caiu (y ${fall.state.origin.y})`);
});

test('túnel de 60 u: entra agachado, não levanta lá dentro e levanta ao sair', () => {
  const world = worldOf((b) => {
    floor(b);
    b.box(400, 20, 300, { center: [0, 70, -250] }); // teto do túnel em y = 60, de z = −100 a z = −400
  });
  const standing = makePlayer(world, [0, 0, 0]);
  run(standing, 128, forward);
  // Em pé para quando o hemisfério de cima encosta na quina do teto (y = 60): o eixo fica a √(16,03² − 4²) dela.
  const stopZ = -100 + Math.sqrt((R + SKIN) ** 2 - (60 - (HULL.standHeight - R)) ** 2);
  assert.ok(Math.abs(standing.state.origin.z - stopZ) < 0.01, `em pé parou em z ${standing.state.origin.z} (esperado ${stopZ})`);
  const p = makePlayer(world, [0, 0, 0]);
  run(p, 256, (cmd) => {
    forward(cmd);
    cmd.buttons = BTN.DUCK;
  });
  assert.ok(p.state.origin.z < -150 && p.state.ducked, `agachado entra (z ${p.state.origin.z})`);
  run(p, 16, idle);
  assert.ok(p.state.ducked && p.state.height === HULL.duckHeight, 'levantou dentro do túnel');
  run(p, 128, forward);
  assert.ok(p.state.origin.z < -400 - R && !p.state.ducked, `não levantou ao sair (z ${p.state.origin.z})`);
});

test('noclip atravessa parede; ao desligar dentro dela o jogador é tirado para fora, pelo lado do chão', () => {
  const world = worldOf((b) => {
    floor(b);
    b.box(1000, 300, 60, { center: [0, 150, -200] }); // parede de z = −230 a z = −170
  });
  const p = makePlayer(world, [0, 0, 0]);
  p.state.moveType = MOVETYPE.NOCLIP;
  run(p, 64, forward);
  assert.ok(p.state.origin.z < -230, `noclip não atravessou (z ${p.state.origin.z})`);
  // Eixo 10 u dentro da parede: a desempenetração não resolve (o segmento está dentro do sólido) e a busca por
  // espaço livre acha a face mais perto.
  p.state.origin.set(0, SKIN, -180);
  p.state.velocity.set(0, 0, 0);
  p.state.moveType = MOVETYPE.WALK;
  run(p, 1, idle);
  const s = p.state;
  assert.ok(world.canOccupy(s.origin.x, s.origin.y, s.origin.z, R, s.height), 'continua preso na parede');
  assert.equal(s.stuck, false);
  // Parede fina na borda do set (a parede norte da sala de teste), com chão só de um lado. Com o eixo dentro dela cada
  // face empurra para o seu lado; daqui o empurrão direto sai do set, e o controlador prefere um lugar livre com chão.
  const edge = worldOf((b) => {
    b.box(1600, 8, 1600, { center: [0, -4, 0] }); // chão de z = −800 a z = 800
    b.box(1600, 520, 6.4, { center: [0, 260, -800] }); // parede de z = −803,2 a z = −796,8
  });
  const direct = new THREE.Vector3(0, 40, -799);
  edge.depenetrate(direct, R, HULL.standHeight, SKIN);
  assert.ok(direct.z < -803.2 - R, `o cenário não exercita a preferência por chão (empurrão direto em z ${direct.z})`);
  const q = makePlayer(edge, [0, 40, -799]);
  run(q, 64, idle);
  const e = q.state.origin;
  assert.ok(e.z > -796.8 + R && edge.canOccupy(e.x, e.y, e.z, R, q.state.height), `saiu pelo lado sem chão (z ${e.z})`);
  assert.ok(q.state.onGround && !q.state.stuck, 'não ficou de pé no chão');
});

test('pouso: evento com a velocidade de queda (~565 u/s de 200 u) e a superfície', () => {
  const p = makePlayer(worldOf((b) => floor(b)), [0, 200, 0]);
  const events = run(p, 96, idle);
  const land = events.find((e) => e.type === 'land');
  assert.ok(land, 'sem evento de pouso');
  assert.ok(land.speed > 550 && land.speed < 570, `velocidade ${land.speed}`);
  assert.equal(land.surface, SURFACE_INDEX.tapete);
});

test('determinismo: a mesma sequência de comandos dá o mesmo estado, bit a bit', () => {
  const build = () => worldOf((b) => {
    floor(b);
    b.stairs(200, 16, 32, 6, { center: [100, 0, -200] });
    b.cylinder(30, 100, { center: [-120, 0, -150] });
  });
  const script = (seed) => {
    const rng = new RNG(seed);
    return (cmd) => {
      cmd.forward = rng.float(-1, 1);
      cmd.side = rng.float(-1, 1);
      cmd.buttons = (rng.bool(0.1) ? BTN.JUMP : 0) | (rng.bool(0.2) ? BTN.DUCK : 0);
      cmd.yaw += rng.float(-0.1, 0.1);
    };
  };
  const a = makePlayer(build(), [0, 0, 0]);
  const b = makePlayer(build(), [0, 0, 0]);
  run(a, 640, script('determinismo'));
  run(b, 640, script('determinismo'));
  assert.deepEqual(a.state.origin.toArray(), b.state.origin.toArray());
  assert.deepEqual(a.state.velocity.toArray(), b.state.velocity.toArray());
  const c = copyMoveState(a.state, createMoveState());
  assert.deepEqual(c.origin.toArray(), a.state.origin.toArray());
  assert.equal(c.duckAmount, a.state.duckAmount);
  assert.equal(c.onGround, a.state.onGround);
});
```

- [ ] **Passo 3: Rodar** — `node --test tests/characterController.test.js` → 16 testes PASS. Falha aqui aponta erro no controlador ou no movimento (Tarefas 5 e 6): corrigir no código, nunca afrouxar o cenário.

- [ ] **Passo 4: Commit** — `git add tests/playerTestUtils.js tests/characterController.test.js && git commit -m "test(fase-3.1): cenários do controlador e do movimento"`

---

### Tarefa 8: Aceite automatizado — 10 min sem atravessar parede

**Files:**
- Test: `tests/movementFuzz.test.js`

- [ ] **Passo 1: Escrever o teste**

```js file=tests/movementFuzz.test.js
// Aceite "nenhum atravessamento de parede em 10 min" automatizado (Fase 3.1): 38.400 ticks de entrada aleatória,
// empurrões de até 3500 u/s, paredes de 0,5 a 2 u dividindo a sala em células e um painel em movimento. A célula do
// jogador nunca muda, ele nunca fica penetrando nada nem preso. Depois, a mesma seed repetida dá o mesmo resultado.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { RNG } from '../src/core/rng.js';
import { HULL } from '../src/data/movement.js';
import { ColliderBuilder } from '../src/physics/colliders.js';
import { CollisionBody } from '../src/physics/collisionBody.js';
import { CollisionWorld } from '../src/physics/collisionWorld.js';
import { BTN } from '../src/player/moveCmd.js';
import { playerMove } from '../src/player/movement.js';
import { DT, makePlayer } from './playerTestUtils.js';

const ROOM = 600; // meia largura da sala: x e z de −600 a 600
const CEILING = 300;
const WALLS = [-200, 200]; // planos das paredes finas, em x e em z
const THICK = { x: [0.5, 1], z: [2, 1] }; // espessura de cada parede fina
const R = HULL.radius;
const TEN_MINUTES = 10 * 60 * 64;

function buildWorld() {
  const b = new ColliderBuilder();
  const span = 2 * ROOM + 80;
  b.box(span, 20, span, { center: [0, -10, 0], surface: 'tapete' });
  b.box(span, 20, span, { center: [0, CEILING + 10, 0] });
  for (const s of [-1, 1]) {
    b.box(40, CEILING, span, { center: [s * (ROOM + 20), CEILING / 2, 0] });
    b.box(span, CEILING, 40, { center: [0, CEILING / 2, s * (ROOM + 20)] });
  }
  WALLS.forEach((w, i) => {
    b.box(THICK.x[i], CEILING, 2 * ROOM, { center: [w, CEILING / 2, 0], surface: 'papelao' });
    b.box(2 * ROOM, CEILING, THICK.z[i], { center: [0, CEILING / 2, w], surface: 'papelao' });
  });
  // Obstáculos da célula do meio: escada, rampa, pilar, laje baixa (túnel) e bloco solto.
  b.stairs(80, 16, 24, 4, { center: [-150, 0, -150] });
  b.ramp(80, 120, 60, { center: [120, 0, -180] });
  b.cylinder(20, CEILING, { center: [60, 0, -40], surface: 'plastico' });
  b.box(90, 10, 90, { center: [140, 65, 140] });
  b.box(60, 30, 60, { center: [-120, 15, 60] });
  const world = new CollisionWorld();
  world.addBody(new CollisionBody(b.build(), { name: 'celulas' }));
  // Painel que vai e volta em x (1,5 u por tick no máximo), sem espremer ninguém contra nada.
  const panel = world.addBody(new CollisionBody(new ColliderBuilder().box(60, 100, 8, { surface: 'papelao' }).build(), { name: 'painel' }));
  return { world, panel };
}

/** Célula 0..8 da grade 3 × 3 formada pelas paredes finas. */
function cellOf(v) {
  const c = (a) => (a < WALLS[0] ? 0 : a > WALLS[1] ? 2 : 1);
  return c(v.x) * 3 + c(v.z);
}

function simulate(seed, ticks, { check }) {
  const { world, panel } = buildWorld();
  const p = makePlayer(world, [0, 0, 0]);
  const rng = new RNG(seed);
  const m = new THREE.Matrix4();
  const dir = { x: 0, y: 0, z: 0 };
  const stats = { maxSpeed: 0, jumps: 0, kicks: 0, groundTicks: 0, duckTicks: 0 };
  const startCell = cellOf(p.state.origin);
  let phase = 0;
  let turn = 0;
  let jumpRate = 0;
  let duckRate = 0;
  for (let i = 0; i < ticks; i++) {
    panel.setMatrix(m.makeTranslation(-30 + 60 * Math.sin((2 * Math.PI * i * DT) / 4), 50, 150));
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
      turn = rng.float(-6, 6); // rad/s
      jumpRate = rng.pick([0, 0.05, 0.3]);
      duckRate = rng.pick([0, 0, 0.5, 1]);
    }
    p.cmd.yaw += turn * DT;
    p.cmd.buttons = (rng.bool(jumpRate) ? BTN.JUMP : 0) | (rng.bool(duckRate) ? BTN.DUCK : 0);
    // Empurrão (explosão, lançamento): até 3500 u/s em qualquer direção, inclusive direto contra as paredes.
    if (i % 200 === 199) {
      rng.onUnitSphere(dir);
      const v = rng.float(500, 3500);
      p.state.velocity.set(dir.x * v, dir.y * v, dir.z * v);
      p.state.onGround = false;
      stats.kicks++;
    }
    p.cmd.tick = i;
    playerMove(p.state, p.cmd, p.env);
    const s = p.state;
    stats.maxSpeed = Math.max(stats.maxSpeed, s.velocity.length());
    if (s.onGround) stats.groundTicks++;
    if (s.ducked) stats.duckTicks++;
    for (const e of p.env.events) if (e.type === 'jump') stats.jumps++;
    if (!check) continue;
    if (cellOf(s.origin) !== startCell) assert.fail(`tick ${i}: atravessou para outra célula (${s.origin.toArray()})`);
    if (!(s.origin.y > -0.01 && s.origin.y + s.height < CEILING + 0.01)) assert.fail(`tick ${i}: saiu entre chão e teto (y ${s.origin.y})`);
    if (!world.canOccupy(s.origin.x, s.origin.y, s.origin.z, R, s.height, 0.05)) assert.fail(`tick ${i}: penetrando`);
    if (s.stuck) assert.fail(`tick ${i}: preso`);
  }
  return { state: p.state, stats };
}

test('10 min simulados com entrada aleatória e empurrões de até 3500 u/s: nenhuma parede atravessada', () => {
  const { stats } = simulate('dez-minutos', TEN_MINUTES, { check: true });
  // A simulação exercitou de fato o que se pede: altas velocidades, pulos, agachar, chão.
  assert.ok(stats.maxSpeed > 3000, `velocidade máxima ${stats.maxSpeed}`);
  assert.equal(stats.kicks, TEN_MINUTES / 200);
  assert.ok(stats.jumps > 50, `pulos ${stats.jumps}`);
  assert.ok(stats.duckTicks > 1000 && stats.groundTicks > 1000, `agachado ${stats.duckTicks}, chão ${stats.groundTicks}`);
});

test('a mesma seed dá o mesmo resultado, bit a bit (2 min)', () => {
  const a = simulate('repetivel', 2 * 60 * 64, { check: false }).state;
  const b = simulate('repetivel', 2 * 60 * 64, { check: false }).state;
  assert.deepEqual(a.origin.toArray(), b.origin.toArray());
  assert.deepEqual(a.velocity.toArray(), b.velocity.toArray());
  assert.equal(a.ducked, b.ducked);
});
```

- [ ] **Passo 2: Rodar** — `node --test tests/movementFuzz.test.js` → 2 testes PASS (alguns segundos). Uma falha dá o tick exato: reproduzir com a mesma seed, achar a causa no controlador/varredura e corrigir no código.

- [ ] **Passo 3: Commit** — `git add tests/movementFuzz.test.js && git commit -m "test(fase-3.1): 10 min simulados sem atravessar parede"`

---

### Tarefa 9: Jogador local (PlayerPawn)

**Files:**
- Create: `src/player/playerPawn.js`
- Modify: `src/core/events.js` (eventos do jogador)
- Test: `tests/playerPawn.test.js`

- [ ] **Passo 1: Eventos do jogador** — em `src/core/events.js`, trocar

```
  LOADOUT: 'loadout:change', // {owner, loadout}
});
```

por

```
  LOADOUT: 'loadout:change', // {owner, loadout}
  PLAYER_JUMP: 'player:jump', // {surface}
  PLAYER_LAND: 'player:land', // {speed, surface} — velocidade de queda no pouso (u/s)
  PLAYER_DUCK: 'player:duck', // {ducked}
});
```

- [ ] **Passo 2: Escrever o teste**

```js file=tests/playerPawn.test.js
// Testes do jogador local (Fase 3.1): comando do tick a partir da entrada, andar, interpolação da câmera, suavização
// do degrau, noclip pelo tick e teleporte.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { CONTROLLER, HULL } from '../src/data/movement.js';
import { BTN, createMoveCmd, readMoveCmd } from '../src/player/moveCmd.js';
import { PlayerPawn } from '../src/player/playerPawn.js';
import { createSvVars } from '../src/player/movementVars.js';
import { floor, worldOf } from './worldTestUtils.js';

const SKIN = CONTROLLER.skin;

/** Entrada com a mesma interface que o PlayerPawn usa do InputManager (move + isDown). */
function testInput() {
  return {
    move: { x: 0, y: 0 },
    down: new Set(),
    isDown(action) {
      return this.down.has(action);
    },
  };
}

const pawnOn = (world, position = [0, 0, 0]) => new PlayerPawn({ world, sv: createSvVars(), position: new THREE.Vector3(...position) });

test('comando do tick: movimento, bits dos botões e ângulos', () => {
  const input = testInput();
  input.move.x = 0.5;
  input.move.y = -1;
  input.down.add('jump').add('crouch').add('aim');
  const cmd = readMoveCmd(createMoveCmd(), input, 42, 1.5, -0.2);
  assert.equal(cmd.tick, 42);
  assert.equal(cmd.side, 0.5);
  assert.equal(cmd.forward, -1);
  assert.equal(cmd.buttons, BTN.JUMP | BTN.DUCK | BTN.ATTACK2);
  assert.equal(cmd.yaw, 1.5);
  assert.equal(cmd.pitch, -0.2);
});

test('pawn: anda para onde olha e a câmera interpola pés + olho entre os ticks', () => {
  const pawn = pawnOn(worldOf((b) => floor(b)));
  const input = testInput();
  input.move.y = 1;
  for (let i = 0; i < 64; i++) pawn.tick(1 / 64, input, { tick: i });
  assert.ok(pawn.state.origin.z < -100, `andou ${pawn.state.origin.z}`);
  assert.ok(pawn.stats.distance > 100 && pawn.stats.topSpeed > 200);
  assert.ok(pawn.physicsStats.sweeps > 0 && pawn.physicsStats.us >= 0);
  const cam = new THREE.PerspectiveCamera();
  pawn.updateCamera(cam, 0);
  const a = cam.position.clone();
  pawn.updateCamera(cam, 1);
  const b = cam.position.clone();
  pawn.updateCamera(cam, 0.5);
  assert.ok(cam.position.distanceTo(a.clone().lerp(b, 0.5)) < 1e-9);
  assert.ok(Math.abs(b.y - (pawn.state.origin.y + HULL.standEye)) < 1e-6);
  assert.ok(b.z < a.z, 'o quadro seguinte está à frente');
});

test('pawn: ao subir um degrau de 16 u o olho sobe suave e alcança a altura certa', () => {
  const world = worldOf((b) => {
    floor(b);
    b.box(400, 16, 2000, { center: [0, 8, -1050] }); // degrau com a frente em z = −50
  });
  const pawn = pawnOn(world);
  const input = testInput();
  input.move.y = 1;
  const cam = new THREE.PerspectiveCamera();
  let stepped = false;
  for (let i = 0; i < 64 && !stepped; i++) {
    const before = pawn.state.origin.y;
    pawn.tick(1 / 64, input, { tick: i });
    stepped = pawn.state.origin.y - before > 10;
  }
  assert.ok(stepped, 'não subiu o degrau');
  pawn.updateCamera(cam, 1);
  const eyeJump = cam.position.y - (pawn.prevOrigin.y + pawn.prevEyeOffset);
  assert.ok(eyeJump < 12, `a câmera pulou ${eyeJump} u de uma vez`);
  for (let i = 0; i < 32; i++) pawn.tick(1 / 64, input, { tick: 100 + i });
  pawn.updateCamera(cam, 1);
  assert.ok(Math.abs(cam.position.y - (16 + SKIN + HULL.standEye)) < 0.05, `olho ${cam.position.y}`);
});

test('pawn: noclip pelo tick atravessa parede e, desligado dentro dela, o jogador sai', () => {
  const world = worldOf((b) => {
    floor(b);
    b.box(1000, 300, 40, { center: [0, 150, -100] }); // parede de z = −120 a z = −80
  });
  const pawn = pawnOn(world);
  const input = testInput();
  input.move.y = 1;
  for (let i = 0; i < 48; i++) pawn.tick(1 / 64, input, { noclip: true, tick: i });
  assert.ok(pawn.state.origin.z < -120, `noclip ficou na parede (z ${pawn.state.origin.z})`);
  pawn.teleport(new THREE.Vector3(0, 0, -100)); // dentro da parede
  input.move.y = 0;
  pawn.tick(1 / 64, input, { tick: 99 });
  const s = pawn.state;
  assert.ok(world.canOccupy(s.origin.x, s.origin.y, s.origin.z, HULL.radius, s.height), 'continua dentro da parede');
  assert.equal(s.stuck, false);
});

test('pawn: teleporte zera velocidade e interpolação e acha o chão', () => {
  const pawn = pawnOn(worldOf((b) => floor(b)));
  pawn.state.velocity.set(100, 0, 0);
  pawn.teleport(new THREE.Vector3(50, 1, 50), 1, 0);
  assert.equal(pawn.state.velocity.length(), 0);
  assert.ok(pawn.state.onGround && Math.abs(pawn.state.origin.y - SKIN) < 2e-3);
  assert.ok(pawn.prevOrigin.equals(pawn.state.origin));
  assert.equal(pawn.yaw, 1);
  assert.equal(pawn.pos, pawn.state.origin);
});
```

- [ ] **Passo 3: Rodar e ver falhar** — `node --test tests/playerPawn.test.js` → FAIL (módulo inexistente).

- [ ] **Passo 4: Implementar**

```js file=src/player/playerPawn.js
// Jogador local no modo "andar": estado de movimento, comando do tick e câmera. A simulação roda a 64 Hz (playerMove);
// o render interpola pés e altura do olho entre os ticks e suaviza degraus e a troca de cápsula no ar. Em terceira
// pessoa (debug) a câmera recua atrás do jogador e se recolhe ao encostar em parede.

import * as THREE from 'three';
import { EV } from '../core/events.js';
import { VIEW } from '../data/movement.js';
import { WEAPONS } from '../data/weapons.js';
import { CharacterController } from '../physics/characterController.js';
import { createTrace } from '../physics/collisionWorld.js';
import { createMoveCmd, readMoveCmd } from './moveCmd.js';
import { MOVETYPE, createMoveState, eyeHeight, playerMove } from './movement.js';

const PITCH_LIMIT = (89 * Math.PI) / 180;
// Média móvel do custo da física por tick: o relógio do navegador é grosso (5–100 µs), um tick sozinho não diz nada.
const US_SMOOTHING = 0.05;

export class PlayerPawn {
  /**
   * @param {{world, sv, events?, position: THREE.Vector3, yaw?: number, pitch?: number}} opts
   *   `world`: CollisionWorld do mapa; `sv`: variáveis de movimento; `events`: barramento para EV.PLAYER_*.
   */
  constructor({ world, sv, events = null, position, yaw = 0, pitch = 0 }) {
    this.world = world;
    this.bus = events;
    this.controller = new CharacterController(world, sv);
    this.state = createMoveState({ position });
    this.cmd = createMoveCmd();
    // Faca na mão: a velocidade máxima é a dela.
    this.env = { controller: this.controller, sv, dt: 1 / 64, maxSpeed: WEAPONS.knife.moveSpeed, events: [] };
    this.yaw = yaw;
    this.pitch = pitch;
    this.thirdPerson = false;
    this.prevOrigin = new THREE.Vector3();
    this.smooth = 0; // deslocamento da câmera ainda por suavizar (u)
    this.eyeOffset = 0;
    this.prevEyeOffset = 0;
    this.lastLanding = null;
    this.stats = { distance: 0, topSpeed: 0, ticks: 0, jumps: 0 };
    // Custo da física do jogador: µs por tick (média móvel) e as consultas do último tick.
    this.physicsStats = { us: 0, sweeps: 0, overlaps: 0, triangles: 0 };
    this._camTrace = createTrace();
    this._before = { sweeps: 0, overlaps: 0, triangles: 0 };
    this.teleport(position, yaw, pitch);
  }

  /** Pés do jogador (console: getpos/setpos). */
  get pos() {
    return this.state.origin;
  }

  applyLook({ yaw, pitch }) {
    this.yaw += yaw;
    this.pitch = Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, this.pitch + pitch));
  }

  /** Um tick: lê a entrada, move, suaviza a câmera, conta e publica os eventos de movimento. */
  tick(dt, input, { noclip = false, tick = 0 } = {}) {
    const s = this.state;
    this.prevOrigin.copy(s.origin);
    this.prevEyeOffset = this.eyeOffset;
    s.moveType = noclip ? MOVETYPE.NOCLIP : MOVETYPE.WALK;
    readMoveCmd(this.cmd, input, tick, this.yaw, this.pitch);
    this.env.dt = dt;
    const w = this.world.stats;
    const before = this._before;
    before.sweeps = w.sweeps;
    before.overlaps = w.overlaps;
    before.triangles = w.triangles;
    const t0 = performance.now();
    playerMove(s, this.cmd, this.env);
    const us = (performance.now() - t0) * 1000;
    const ps = this.physicsStats;
    ps.us += (us - ps.us) * US_SMOOTHING;
    ps.sweeps = w.sweeps - before.sweeps;
    ps.overlaps = w.overlaps - before.overlaps;
    ps.triangles = w.triangles - before.triangles;
    // Câmera: o que o tick subiu/desceu de uma vez entra na suavização, que decai para zero.
    this.smooth = Math.max(-VIEW.smoothMax, Math.min(VIEW.smoothMax, this.smooth + s.viewOffset));
    this.smooth *= Math.exp(-dt / VIEW.smoothTime);
    this.eyeOffset = eyeHeight(s) + this.smooth;
    const events = this.env.events;
    for (let i = 0; i < events.length; i++) this.#onEvent(events[i]);
    const st = this.stats;
    st.distance += s.origin.distanceTo(this.prevOrigin);
    st.topSpeed = Math.max(st.topSpeed, Math.hypot(s.velocity.x, s.velocity.z));
    st.ticks++;
  }

  #onEvent(e) {
    if (e.type === 'jump') this.stats.jumps++;
    else if (e.type === 'land') this.lastLanding = e;
    if (!this.bus) return;
    if (e.type === 'jump') this.bus.emit(EV.PLAYER_JUMP, e);
    else if (e.type === 'land') this.bus.emit(EV.PLAYER_LAND, e);
    else this.bus.emit(EV.PLAYER_DUCK, { ducked: e.type === 'duck' });
  }

  /** Posiciona a câmera: pés e olho interpolados entre ticks, rotação do último quadro (resposta imediata). */
  updateCamera(camera, alpha) {
    camera.position.lerpVectors(this.prevOrigin, this.state.origin, alpha);
    camera.position.y += this.prevEyeOffset + (this.eyeOffset - this.prevEyeOffset) * alpha;
    camera.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
    if (this.thirdPerson) this.#pullBack(camera);
  }

  /** Terceira pessoa (debug): recua atrás do olho e se recolhe ao encostar em algo (varredura de esfera). */
  #pullBack(camera) {
    const cp = Math.cos(this.pitch);
    const d = VIEW.thirdPersonDistance;
    const dx = Math.sin(this.yaw) * cp * d;
    const dy = -Math.sin(this.pitch) * d + VIEW.thirdPersonHeight;
    const dz = Math.cos(this.yaw) * cp * d;
    const eye = camera.position;
    const r = VIEW.thirdPersonProbe;
    const tr = this.world.sweepCapsule(eye.x, eye.y - r, eye.z, dx, dy, dz, r, r * 2, this._camTrace);
    eye.set(eye.x + dx * tr.fraction, eye.y + dy * tr.fraction, eye.z + dz * tr.fraction);
  }

  /** Teleporte (setpos, respawn): zera velocidade e interpolação e procura o chão. */
  teleport(position, yaw = this.yaw, pitch = this.pitch) {
    const s = this.state;
    s.origin.copy(position);
    s.velocity.set(0, 0, 0);
    s.fallVelocity = 0;
    this.yaw = yaw;
    this.pitch = pitch;
    this.controller.categorizePosition(s);
    this.prevOrigin.copy(s.origin);
    this.smooth = 0;
    this.eyeOffset = eyeHeight(s);
    this.prevEyeOffset = this.eyeOffset;
  }
}
```

- [ ] **Passo 5: Rodar e ver passar** — `node --test tests/playerPawn.test.js` → 5 testes PASS.

- [ ] **Passo 6: Commit** — `git add src/player/playerPawn.js src/core/events.js tests/playerPawn.test.js && git commit -m "feat(fase-3.1): jogador local com câmera interpolada e suavizada"`

---

### Tarefa 10: Integração — serviço sv, sala de testes andável e partida

**Files:**
- Modify: `src/main.js`, `src/data/sandbox.js`, `src/maps/registry.js`, `src/maps/testRoom.js`, `src/modes/matchState.js`, `src/ui/sandboxHud.js`, `src/data/configSchema.js`

- [ ] **Passo 1: Serviço `sv` em `src/main.js`** — trocar

```
import { Loadout } from './player/loadout.js';
```

por

```
import { Loadout } from './player/loadout.js';
import { createSvVars } from './player/movementVars.js';
```

trocar

```
  const localLoadout = new Loadout();
```

por

```
  const localLoadout = new Loadout();
  const sv = createSvVars(); // variáveis sv_* de movimento (valores do CS:GO; o console troca)
```

e trocar

```
    localLoadout, focusNav, toasts, uiRoot, debugRoot, touchLayer,
```

por

```
    localLoadout, sv, focusNav, toasts, uiRoot, debugRoot, touchLayer,
```

- [ ] **Passo 2: Chaves de debug em `src/data/configSchema.js`** — trocar

```
  'debug.touchGuides': { type: 'bool', default: false, label: 'Mostrar zonas e botões de toque', group: 'debug' },
```

por

```
  'debug.touchGuides': { type: 'bool', default: false, label: 'Mostrar zonas e botões de toque', group: 'debug' },
  'debug.collision': { type: 'bool', default: false, transient: true, label: 'Mostrar a colisão (r_colisao)', group: 'debug' },
  'debug.showPos': { type: 'bool', default: false, transient: true, label: 'Posição e velocidade (cl_showpos)', group: 'debug' },
  'debug.thirdPerson': { type: 'bool', default: false, transient: true, label: 'Câmera em terceira pessoa', group: 'debug' },
```

- [ ] **Passo 3: Dados da sala de testes**

```js file=src/data/sandbox.js
// Parâmetros da sala de testes e do modo livre (Fases 1 e 3): sala de papelão andável, volta ao spawn ao cair do set
// e a câmera livre (voo da vitrine e noclip).
// Unidades: 1 unidade = 1 cm na escala do boneco (o boneco tem ~72 unidades de altura).

export const TEST_ROOM = Object.freeze({
  width: 1600, // X
  depth: 1600, // Z
  height: 520, // Y
  spawn: Object.freeze({ x: 0, y: 0, z: 560, yawDeg: 0, pitchDeg: -4 }), // pés do jogador (o olho fica 64 u acima)
  scaleMarkerHeight: 72, // "boneco" de referência para conferir a escala
  wallCollider: 6.4, // espessura de colisão das paredes: papelão de 4 u + empeno de até 1,1 u em cada face
  floorSlab: 8, // laje de colisão sob o tapete
});

/** Modo livre em mapa andável. */
export const SANDBOX = Object.freeze({
  fallOutDepth: 1500, // caiu mais que isto (u) abaixo do chão do mapa (noclip desligado fora do set): volta ao spawn
});

export const FREE_CAMERA = Object.freeze({
  speed: 420, // u/s voando
  walkFactor: 0.52, // Shift: mesma proporção do andar silencioso do CS
  boostFactor: 2.4, // segurar "mirar" acelera (útil para atravessar mapas grandes em noclip)
  verticalSpeed: 320,
  accelerate: 10, // sv_accelerate
  friction: 8, // sv_friction
  stopSpeed: 60,
  radius: 16, // raio de colisão com as paredes (noclip desligado)
});
```

- [ ] **Passo 4: Contrato do mapa em `src/maps/registry.js`** — trocar

```
//   staticShadows?: boolean (nada que projeta sombra se move: o mapa de sombra só é refeito quando algo pede) }
```

por

```
//   staticShadows?: boolean (nada que projeta sombra se move: o mapa de sombra só é refeito quando algo pede),
//   collision?: CollisionWorld (mapa andável: o jogador anda com a cápsula; sem ela, voa com a câmera livre) }
```

- [ ] **Passo 5: Sala de testes andável**

```js file=src/maps/testRoom.js
// Sala de testes: sala de papelão andável para validar loop, entrada, câmera, renderização e a colisão (Fase 3).
// Mesmo sendo cena técnica, usa o look de estúdio definitivo da Fase 2 (docs/art/moodboard.md):
//  - chão de tapete de corte com grade de 1 cm (SMD3; prova de escala PLA2/PLA14);
//  - paredes de papelão ondulado cortado à mão (SSD4, SSD8) presas com tiras de fita crepe (SSD2, SSD14);
//  - montagem de luz 'testroom' (src/data/studioRigs.js): key de tungstênio em softbox com sombra suave, fill
//    frio, rim de fresnel, poeira no feixe da key e ambiente com o reflexo das softboxes (CSD14, SSD14, SMD13);
//  - boneco de referência de 72 u em massinha (a medida do mundo) e dois objetos do set perto do spawn para
//    conferir o AO de contato, o reflexo das softboxes e a profundidade de campo.
// Colisão (src/physics/colliders.js): chão e paredes são caixas — o relevo do tapete e o empeno do papelão são só
// visuais; pote, tampa e espátula (plástico, madeira e metal lisos, sem boil, poucos triângulos) colidem com a própria
// malha; o boneco de massinha, com um cilindro do tamanho dele. O pote é aberto: dá para cair dentro, e só o pulo
// agachado (≈66 u) passa da borda de 62 u — para subir nele ou sair dele.

import * as THREE from 'three';
import { TEST_ROOM } from '../data/sandbox.js';
import { STUDIO_RIGS } from '../data/studioRigs.js';
import { PALETTE } from '../data/palette.js';
import { EV } from '../core/events.js';
import { registerMap } from './registry.js';
import { StudioRig } from '../render/studio/studioRig.js';
import { cardboardPanel } from '../clay/set/boardGeometry.js';
import { clayPot, sculptTool, tapeStrip } from '../clay/set/propGeometry.js';
import { scaleMarker } from '../clay/kit/scaleMarker.js';
import { ColliderBuilder } from '../physics/colliders.js';
import { CollisionWorld } from '../physics/collisionWorld.js';

const DEG = Math.PI / 180;
const WALL_THICKNESS = 4; // papelão de caixa grossa: 4 mm

/** Formas de colisão da sala, nas posições atuais das malhas. */
function buildColliders({ walls, potGroup, handle, metal, marker }) {
  const { width, depth, height, floorSlab, wallCollider } = TEST_ROOM;
  const b = new ColliderBuilder();
  b.box(width, floorSlab, depth, { center: [0, -floorSlab / 2, 0], surface: 'tapete' });
  for (const { mesh, width: w } of walls) {
    mesh.updateWorldMatrix(true, false);
    b.box(w, height, wallCollider, { matrix: mesh.matrixWorld, surface: 'papelao' });
  }
  b.object(potGroup, { surface: 'plastico' });
  b.object(handle, { surface: 'madeira' });
  b.object(metal, { surface: 'metal' });
  // Boneco de massinha: cilindro com a largura e a altura dele (os calombos e o boil não viram tropeço).
  const body = new THREE.Box3().setFromObject(marker);
  const size = body.getSize(new THREE.Vector3());
  b.cylinder(Math.max(size.x, size.z) / 2, size.y, {
    segments: 24, center: [(body.min.x + body.max.x) / 2, body.min.y, (body.min.z + body.max.z) / 2], surface: 'massinha',
  });
  return b;
}

async function build({ render, config, services }) {
  const { width, depth, height, spawn } = TEST_ROOM;
  const set = services.set;
  const scene = new THREE.Scene();
  scene.name = 'testroom';
  // Ar do estúdio: névoa quente bem leve (a luz cai fora da ilha iluminada, SSD1/CSD14).
  scene.fog = new THREE.FogExp2(0x1b1411, 0.00012);

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(width, depth), set.cuttingMat({ size: [width, depth] }));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  floor.name = 'tapete-de-corte';
  scene.add(floor);

  const board = set.cardboard();
  const tape = set.tape({ width: 46 });
  const walls = [
    { w: width, x: 0, z: -depth / 2, ry: 0 },
    { w: width, x: 0, z: depth / 2, ry: Math.PI },
    { w: depth, x: -width / 2, z: 0, ry: Math.PI / 2 },
    { w: depth, x: width / 2, z: 0, ry: -Math.PI / 2 },
  ];
  const wallMeshes = [];
  walls.forEach((wall, i) => {
    const mesh = new THREE.Mesh(cardboardPanel(wall.w, height, WALL_THICKNESS, { fluteAxis: 'y', seed: `parede-${i}` }), board);
    mesh.position.set(wall.x, height / 2, wall.z);
    mesh.rotation.y = wall.ry;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.name = 'parede-papelao';
    scene.add(mesh);
    wallMeshes.push({ mesh, width: wall.w });
    // Duas tiras de fita crepe perto do topo, tortas como coladas à mão (moodboard SSD2/SSD14).
    const off = WALL_THICKNESS / 2 + 0.6;
    [-0.35, 0.35].forEach((t, k) => {
      const strip = new THREE.Mesh(tapeStrip(140, 46, { seed: `parede-${i}-${k}`, lift: k === 1 ? 3 : 0 }), tape);
      const along = t * wall.w;
      strip.position.set(
        wall.x + Math.cos(wall.ry) * along + Math.sin(wall.ry) * off,
        height - 60,
        wall.z - Math.sin(wall.ry) * along + Math.cos(wall.ry) * off,
      );
      strip.rotation.set(0, wall.ry, (t > 0 ? 1 : -1) * 4 * DEG);
      strip.receiveShadow = true;
      strip.name = 'fita-crepe';
      scene.add(strip);
    });
  });

  const marker = scaleMarker(TEST_ROOM.scaleMarkerHeight);
  scene.add(marker);

  // Pote de massinha (prédio da escala do boneco) e espátula de modelar deitada no tapete.
  const pot = clayPot({ radius: 55, height: 62 });
  const potGroup = new THREE.Group();
  potGroup.name = 'pote-de-massinha';
  const tub = new THREE.Mesh(pot.tub, set.plastic({ color: PALETTE.clayYellow, moldY: pot.moldY, name: 'pote-amarelo' }));
  const lid = new THREE.Mesh(pot.lid, set.plastic({ color: PALETTE.blue, moldY: 1e4, name: 'tampa-azul' }));
  // Tampa em pé, encostada na lateral do pote com a saia virada para ele (inclinada 10° para trás).
  lid.rotation.set(0, 0, 80 * DEG);
  lid.position.set(-66, 57, 0);
  potGroup.add(tub, lid);
  potGroup.position.set(-160, 0, 290);
  scene.add(potGroup);
  const tool = sculptTool('espatula', { length: 160 });
  const toolGroup = new THREE.Group();
  toolGroup.name = 'espatula-de-modelar';
  const handle = new THREE.Mesh(tool.handle, set.benchWood());
  const metal = new THREE.Mesh(tool.metal, set.toolMetal());
  toolGroup.add(handle, metal);
  toolGroup.position.set(110, 4.3, 340);
  toolGroup.rotation.set(0, 28 * DEG, 0);
  scene.add(toolGroup);
  for (const obj of [potGroup, toolGroup]) {
    obj.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
      }
    });
  }

  // Luz de estúdio: key/fill/rim com equipamento visível pendurado na grelha, poeira e ambiente.
  const rigDef = STUDIO_RIGS.testroom;
  const rig = new StudioRig({
    def: rigDef, set, renderer: render.renderer, tableY: 0, floorY: null, center: new THREE.Vector3(0, 120, 0),
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

  const collision = CollisionWorld.fromBuilder(
    buildColliders({ walls: wallMeshes, potGroup, handle, metal, marker }), 'sala-de-testes',
  );

  const bounds = new THREE.Box3(
    new THREE.Vector3(-width / 2, 0, -depth / 2),
    new THREE.Vector3(width / 2, height, depth / 2),
  );

  return {
    id: 'testroom',
    scene,
    bounds,
    rig,
    collision,
    post: { context: 'jogo', exposure: rigDef.exposure },
    spawn: {
      position: new THREE.Vector3(spawn.x, spawn.y, spawn.z),
      yaw: spawn.yawDeg * DEG,
      pitch: spawn.pitchDeg * DEG,
    },
    frame(dt, camera) {
      rig.frame(camera, render.drawingHeight);
    },
    dispose() {
      for (const off of offs) off();
      rig.dispose();
    },
  };
}

registerMap({
  id: 'testroom',
  label: 'Sala de testes',
  description: 'Sala de papelão andável com a luz de estúdio: colisão, pulo, agachar e o pote que só o pulo agachado alcança.',
  kind: 'teste',
  aliases: ['teste', 'sala'],
  build,
});
```

- [ ] **Passo 6: HUD com dicas de andar**

```js file=src/ui/sandboxHud.js
// HUD do modo livre: mira simples, etiqueta de status (cheats), aviso "clique para jogar" no PC e a dica de controles
// que some sozinha — de andar (mapa com colisão) ou de voar (vitrine). O HUD completo de massinha chega na Fase 10.

import { h } from './dom.js';
import { EV } from '../core/events.js';

const HINTS = Object.freeze({
  andar: Object.freeze({
    kbm: 'WASD andar · Espaço pula · Ctrl agacha · ` console (noclip voa) · F3 desempenho',
    gamepad: 'Analógico E anda · Analógico D olha · A/✕ pula · B/○ agacha · Options pausa',
    touch: 'Joystick à esquerda anda · arraste à direita para olhar · botões para pular e agachar',
  }),
  voo: Object.freeze({
    kbm: 'WASD mover · Espaço/Ctrl subir/descer · Shift devagar · botão direito acelera · ` console · F3 desempenho',
    gamepad: 'Analógico E mover · Analógico D olhar · A/✕ sobe · B/○ desce · L3 devagar · LT/L2 acelera · Options pausa',
    touch: 'Joystick à esquerda · arraste à direita para olhar · pular/agachar sobem e descem',
  }),
});

/** @param {{title: string, mode?: 'andar'|'voo'}} opts */
export function createSandboxHud(services, { title, mode = 'voo' }) {
  const { events, cheats, input, uiRoot } = services;
  const hints = HINTS[mode] ?? HINTS.voo;
  const status = h('span.hud-status');
  const hint = h('p.hud-hint');
  const prompt = h('button.hud-prompt', { type: 'button', hidden: true }, 'Clique para jogar');
  const root = h('div.hud', null,
    h('div.crosshair', { 'aria-hidden': 'true' }, h('i.ch-dot'), h('i.ch-l'), h('i.ch-r'), h('i.ch-t'), h('i.ch-b')),
    h('div.hud-top', null, h('span.tape-label.hud-title', null, title), status),
    prompt,
    hint,
  );
  uiRoot.append(root);

  const syncStatus = () => {
    const flags = [];
    if (cheats.noclip) flags.push('noclip');
    if (cheats.god) flags.push('god');
    status.textContent = flags.length ? `cheats: ${flags.join(' · ')}` : '';
    status.hidden = !flags.length;
  };
  let hintTimer = 0;
  const syncHint = () => {
    hint.textContent = hints[input.device] ?? hints.kbm;
    hint.classList.remove('is-faded');
    clearTimeout(hintTimer);
    hintTimer = setTimeout(() => hint.classList.add('is-faded'), 7000);
  };
  syncStatus();
  syncHint();
  const offs = [events.on(EV.CHEAT, syncStatus), events.on(EV.INPUT_DEVICE, syncHint)];

  return {
    root,
    prompt,
    setPromptVisible(v) {
      prompt.hidden = !v;
    },
    setVisible(v) {
      root.hidden = !v;
    },
    dispose() {
      clearTimeout(hintTimer);
      for (const off of offs) off();
      root.remove();
    },
  };
}
```

- [ ] **Passo 7: Partida com o jogador que anda**

```js file=src/modes/matchState.js
// Estado "partida". Até os modos de jogo (Fase 8) roda o modo "livre" no mapa escolhido: em mapa com colisão o jogador
// anda com a cápsula (PlayerPawn, Fase 3); sem colisão (vitrine) voa com a câmera livre.
// Responsável por: montar/desmontar o mapa (sem vazar GPU), jogador e câmera, contexto de entrada, pointer lock,
// pausa, volta ao spawn ao cair do set, ferramentas de debug da física e o resumo que vai para a tela de resultado.

import { EV, Subscriptions } from '../core/events.js';
import { SANDBOX } from '../data/sandbox.js';
import { getMapDef } from '../maps/index.js';
import { createFpsCamera } from '../render/camera.js';
import { disposeObject3D } from '../render/dispose.js';
import { FreeCamera } from '../player/freeCamera.js';
import { PlayerPawn } from '../player/playerPawn.js';
import { PhysicsDebugView } from '../debug/physicsDebug.js';
import { ShowPosPanel } from '../debug/showPos.js';
import { CONTEXT } from '../input/inputManager.js';
import { createSandboxHud } from '../ui/sandboxHud.js';
import { createPauseMenu } from '../ui/pauseMenu.js';
import { openSettings } from '../ui/settingsScreen.js';
import { h } from '../ui/dom.js';

export class MatchState {
  constructor(services) {
    this.s = services;
    this.subs = null;
    this.map = null;
    this.camera = null;
    this.player = null;
    this.physicsDebug = null;
    this.showPos = null;
    this.hud = null;
    this.pause = null;
    this.paused = false;
    this.params = null;
    this.devices = new Set();
    this.startedAt = 0;
    this.pausedMs = 0;
    this.pauseStart = 0;
  }

  async enter(params = {}) {
    const s = this.s;
    this.params = { map: 'testroom', mode: 'livre', ...params };
    const def = getMapDef(this.params.map);
    if (!def) throw new Error(`mapa desconhecido: ${this.params.map}`);
    this.subs = new Subscriptions();

    const loading = h('div.loading', { role: 'status' }, h('span.tape-label', null, `Montando o set: ${def.label}…`));
    s.uiRoot.append(loading);
    try {
      this.map = await def.build({ render: s.render, config: s.config, rng: s.rng, services: s });
    } finally {
      loading.remove();
    }
    this.cursorMode = false;

    this.camera = createFpsCamera({ hfov: s.config.get('graphics.fov'), aspect: s.render.cssWidth / s.render.cssHeight });
    const sp = this.map.spawn;
    if (this.map.collision) {
      this.player = new PlayerPawn({
        world: this.map.collision, sv: s.sv, events: s.events, position: sp.position, yaw: sp.yaw, pitch: sp.pitch,
      });
      this.physicsDebug = new PhysicsDebugView({ scene: this.map.scene, world: this.map.collision });
      this.showPos = new ShowPosPanel(s.debugRoot);
      this.#applyDebugView();
      this.subs.add(s.config.watch('debug.', () => this.#applyDebugView()));
    } else {
      this.player = new FreeCamera({
        position: sp.position, yaw: sp.yaw, pitch: sp.pitch, bounds: this.map.bounds, speedScale: this.map.move?.speedScale ?? 1,
      });
    }
    this.player.updateCamera(this.camera, 1);
    s.render.setView(this.map.scene, this.camera, { staticShadows: this.map.staticShadows ?? false });
    // Contexto do pós (jogo, vitrine...) e exposição da montagem de luz do mapa.
    s.render.post?.configure(this.map.post ?? { context: 'jogo', exposure: 1 });

    if (!s.roster.humans.some((p) => p.local)) s.roster.addHuman({ name: 'Você', local: true });

    this.hud = createSandboxHud(s, { title: def.label, mode: this.map.collision ? 'andar' : 'voo' });
    this.pause = createPauseMenu(s, {
      onResume: () => this.resume(),
      onSettings: () => openSettings(s),
      onEnd: () => s.states.go('result', { summary: this.summary() }),
      onQuit: () => s.states.go('menu'),
    });
    // Agachar (Ctrl) + andar (W) = Ctrl+W, que fecha a aba. Durante a partida o navegador pergunta antes
    // de sair; em tela cheia no Chromium o Keyboard Lock (botão "Tela cheia" da pausa) evita até a pergunta.
    this.subs.listen(window, 'beforeunload', (e) => {
      e.preventDefault();
      e.returnValue = '';
    });
    this.subs.listen(this.hud.prompt, 'click', () => this.#lock());
    this.subs.listen(s.render.canvas, 'click', () => {
      if (this.cursorMode) {
        this.setCursorMode(false);
        return;
      }
      if (!this.paused && s.input.device === 'kbm' && !s.input.pointerLocked) this.#lock();
    });
    this.subs.on(s.events, EV.INPUT_POINTER_LOCK, ({ locked }) => {
      this.hud.setPromptVisible(!locked && !this.paused && !this.cursorMode && s.input.device === 'kbm');
      if (!locked && !this.paused && !this.cursorMode && s.input.device === 'kbm') this.openPause();
    });
    this.subs.on(s.events, EV.INPUT_ACTION, ({ action, phase }) => {
      if (action === 'pause' && phase === 'press' && !this.paused && s.focusNav.empty) this.openPause();
      // Mapas com painel interativo (vitrine): Tab solta o mouse para usar o painel, sem pausar.
      if (action === 'scoreboard' && phase === 'press' && this.map?.panel && !this.paused) this.setCursorMode(true);
    });
    this.subs.on(s.events, EV.INPUT_DEVICE, ({ device }) => {
      this.devices.add(device);
      this.hud.setPromptVisible(device === 'kbm' && !s.input.pointerLocked && !this.paused);
    });

    this.devices = new Set([s.input.device]);
    this.startedAt = performance.now();
    this.pausedMs = 0;
    this.paused = false;
    s.input.setContext(CONTEXT.GAME);
    s.events.emit(EV.MAP_LOADED, { id: this.map.id });
    if (s.input.device === 'kbm') {
      // O clique que abriu a partida ainda vale como gesto do usuário na maioria dos navegadores.
      const ok = await s.input.requestPointerLock();
      this.hud.setPromptVisible(!ok);
    }
  }

  /** r_colisao, cl_showpos e terceira pessoa seguem as chaves de debug da config. */
  #applyDebugView() {
    const cfg = this.s.config;
    this.physicsDebug?.setVisible(cfg.get('debug.collision'));
    this.showPos?.setVisible(cfg.get('debug.showPos'));
    if (this.player instanceof PlayerPawn) this.player.thirdPerson = cfg.get('debug.thirdPerson');
  }

  async #lock() {
    const ok = await this.s.input.requestPointerLock();
    if (ok) this.hud.setPromptVisible(false);
    return ok;
  }

  /**
   * Modo cursor (só em mapas com `panel`): o mouse fica livre para o painel do mapa e o jogo não pausa.
   * Sai com Esc/B (navegação por foco), pelo botão do painel ou clicando na cena.
   */
  setCursorMode(on) {
    const s = this.s;
    const panel = this.map?.panel;
    if (!panel || on === this.cursorMode || this.paused) return;
    this.cursorMode = on;
    if (on) {
      s.input.exitPointerLock();
      s.input.setContext(CONTEXT.UI);
      this.hud.setPromptVisible(false);
      panel.open();
      this._popCursorNav = s.focusNav.push(panel.root, { onBack: () => this.setCursorMode(false) });
    } else {
      this._popCursorNav?.();
      this._popCursorNav = null;
      panel.close();
      s.input.setContext(CONTEXT.GAME);
      if (s.input.device === 'kbm') this.#lock();
    }
  }

  openPause() {
    if (this.paused) return;
    this.paused = true;
    this.pauseStart = performance.now();
    // Pausa aberta pelo controle, pelo toque ou pelo Esc com Keyboard Lock: o cursor precisa voltar.
    this.s.input.exitPointerLock();
    this.s.input.setContext(CONTEXT.UI);
    this.hud.setPromptVisible(false);
    this.pause.show();
  }

  async resume() {
    if (!this.paused) return;
    const s = this.s;
    if (s.input.device === 'kbm') {
      // Sem pointer lock não há como mirar no PC: continua pausado até o navegador aceitar.
      const ok = await s.input.requestPointerLock();
      if (!ok) {
        s.toasts.show('Clique em "Continuar" de novo para capturar o mouse');
        return;
      }
    }
    this.paused = false;
    this.pausedMs += performance.now() - this.pauseStart;
    this.pause.hide();
    s.input.setContext(CONTEXT.GAME);
  }

  tick(dt, tickIndex) {
    if (this.paused || !this.player) return;
    // O olhar acumulado no quadro entra antes do tick: o comando do tick usa o yaw mais recente.
    this.player.applyLook(this.s.input.consumeLook());
    this.player.tick(dt, this.s.input, { noclip: this.s.cheats.noclip, tick: tickIndex });
    this.#checkFellOut();
    this.map.tick?.(dt);
  }

  /** Noclip desligado fora do set: o jogador cai sem chão. Bem abaixo do mapa, volta ao spawn. */
  #checkFellOut() {
    const p = this.player;
    if (!(p instanceof PlayerPawn) || p.state.origin.y > this.map.bounds.min.y - SANDBOX.fallOutDepth) return;
    const sp = this.map.spawn;
    p.teleport(sp.position, sp.yaw, sp.pitch);
    this.s.toasts.show('Caiu para fora do set: de volta ao spawn');
  }

  frame(alpha, dt) {
    if (!this.player) return;
    const look = this.s.input.consumeLook();
    if (!this.paused) this.player.applyLook(look);
    const a = this.paused ? 1 : alpha;
    this.player.updateCamera(this.camera, a);
    this.physicsDebug?.update(this.player, a);
    this.showPos?.update(this.player);
    this.map.frame?.(dt, this.camera);
  }

  summary() {
    const now = performance.now();
    const pausedNow = this.paused ? now - this.pauseStart : 0;
    return {
      map: this.params.map,
      mode: this.params.mode,
      durationS: (now - this.startedAt - this.pausedMs - pausedNow) / 1000,
      distance: this.player?.stats.distance ?? 0,
      topSpeed: this.player?.stats.topSpeed ?? 0,
      ticks: this.player?.stats.ticks ?? 0,
      devices: [...this.devices],
    };
  }

  async exit() {
    const s = this.s;
    s.input.exitPointerLock();
    s.input.setContext(CONTEXT.UI);
    this._popCursorNav?.();
    this._popCursorNav = null;
    this.cursorMode = false;
    this.subs?.dispose();
    this.pause?.dispose();
    this.hud?.dispose();
    this.physicsDebug?.dispose();
    this.showPos?.dispose();
    s.render.clearView();
    s.render.post?.configure({ context: 'jogo', exposure: 1 });
    if (this.map) {
      const id = this.map.id;
      this.map.dispose?.();
      this.map.collision?.dispose();
      disposeObject3D(this.map.scene);
      // Materiais do set em cache eram deste mapa (a GPU já foi liberada acima): o próximo mapa cria os seus.
      s.set?.releaseMaterials();
      s.events.emit(EV.MAP_UNLOADED, { id });
    }
    this.map = null;
    this.player = null;
    this.physicsDebug = null;
    this.showPos = null;
    this.camera = null;
    this.pause = null;
    this.hud = null;
    this.paused = false;
  }

  /** Teleporte do console (setpos) e respawn. */
  teleport(position, yaw, pitch) {
    this.player?.teleport(position, yaw, pitch);
  }
}
```

- [ ] **Passo 8: Rodar todos os testes** — `npm test` → todos passando (os 66 anteriores + os novos).

- [ ] **Passo 9: Commit** — `git add src/main.js src/data/sandbox.js src/data/configSchema.js src/maps/registry.js src/maps/testRoom.js src/ui/sandboxHud.js src/modes/matchState.js && git commit -m "feat(fase-3.1): sala de testes andável com colisão e partida com o PlayerPawn"`

---

### Tarefa 11: Ferramentas de debug (console, arame da colisão, cl_showpos, overlay)

**Files:**
- Create: `src/debug/consoleArgs.js`, `src/debug/movementCommands.js`, `src/debug/physicsDebug.js`, `src/debug/showPos.js`
- Modify: `src/debug/commands.js`, `src/debug/overlay.js`, `styles/debug.css`

- [ ] **Passo 1: `onOff` num módulo próprio** (usado por `commands.js` e pelos comandos novos)

```js file=src/debug/consoleArgs.js
// Leitura de argumentos dos comandos do console.

/** 0/1 (on/off, sim/não, ligado/desligado) de um comando; sem argumento, inverte o valor atual. */
export function onOff(arg, current) {
  if (arg === undefined) return !current;
  if (['1', 'on', 'sim', 'true', 'ligado'].includes(String(arg).toLowerCase())) return true;
  if (['0', 'off', 'nao', 'não', 'false', 'desligado'].includes(String(arg).toLowerCase())) return false;
  throw new Error(`esperava 0/1, recebi "${arg}"`);
}
```

Em `src/debug/commands.js`, trocar

```
const onOff = (arg, current) => {
  if (arg === undefined) return !current;
  if (['1', 'on', 'sim', 'true', 'ligado'].includes(String(arg).toLowerCase())) return true;
  if (['0', 'off', 'nao', 'não', 'false', 'desligado'].includes(String(arg).toLowerCase())) return false;
  throw new Error(`esperava 0/1, recebi "${arg}"`);
};

```

por nada (linha removida), trocar

```
import { registerShowcaseCommands } from './showcaseCommands.js';
```

por

```
import { registerShowcaseCommands } from './showcaseCommands.js';
import { registerMovementCommands } from './movementCommands.js';
import { onOff } from './consoleArgs.js';
```

e trocar

```
  registerShowcaseCommands(con, s, { goState, matchState });
}
```

por

```
  registerShowcaseCommands(con, s, { goState, matchState });
  // Movimento e colisão (Fase 3): variáveis sv_*, colisão visível, cl_showpos e câmera em terceira pessoa.
  registerMovementCommands(con, s);
}
```

- [ ] **Passo 2: Comandos de movimento**

```js file=src/debug/movementCommands.js
// Comandos do console da Fase 3: variáveis sv_* de movimento (valores do CS:GO), colisão visível, posição/velocidade
// do jogador e câmera em terceira pessoa. Falam com as mesmas variáveis e chaves de config que o jogo usa.

import { SV_VARS } from '../data/movement.js';
import { resetSvVars, setSvVar } from '../player/movementVars.js';
import { onOff } from './consoleArgs.js';

export function registerMovementCommands(con, s) {
  const reg = (def) => con.register(def);
  for (const v of SV_VARS) {
    reg({
      name: `sv_${v.key}`,
      usage: `[${v.min}-${v.max}]`,
      help: v.help,
      run: ([value]) => `sv_${v.key} ${value === undefined ? s.sv[v.key] : setSvVar(s.sv, v.key, value)}`,
    });
  }
  reg({
    name: 'sv_reset',
    help: 'volta as variáveis de movimento aos valores do CS:GO',
    run: () => {
      resetSvVars(s.sv);
      return 'variáveis de movimento restauradas (CS:GO)';
    },
  });
  const toggle = (name, key, help) => reg({
    name,
    usage: '[0|1]',
    help,
    run: ([v]) => `${name} ${s.config.set(key, onOff(v, s.config.get(key))) ? 1 : 0}`,
  });
  toggle('r_colisao', 'debug.collision', 'arame das formas de colisão, a cápsula e a normal do chão');
  toggle('cl_showpos', 'debug.showPos', 'posição, velocidade e chão do jogador');
  reg({
    name: 'thirdperson',
    help: 'câmera atrás do jogador (debug)',
    run: () => {
      s.config.set('debug.thirdPerson', true);
      return 'terceira pessoa';
    },
  });
  reg({
    name: 'firstperson',
    help: 'volta à câmera em primeira pessoa',
    run: () => {
      s.config.set('debug.thirdPerson', false);
      return 'primeira pessoa';
    },
  });
}
```

- [ ] **Passo 3: Arame da colisão**

```js file=src/debug/physicsDebug.js
// r_colisao (Fase 3): arame das formas de colisão de cada corpo, a cápsula do jogador (em pé ou agachada, visível em
// terceira pessoa e no noclip), a normal do chão e a normal do último contato que cortou a velocidade. Linhas sem luz,
// sem névoa e por cima de tudo (visão de raio X: o arame das peças coincide com a malha visual e brigaria com ela no
// depth); corpos que se mexem acompanham a matriz.

import * as THREE from 'three';
import { HULL } from '../data/movement.js';
import { TRI_STRIDE } from '../physics/geometryQueries.js';
import { MOVETYPE } from '../player/movement.js';

const COLORS = Object.freeze({ edges: 0xffd23f, capsule: 0x3fb8af, normal: 0xe4572e, contact: 0xf4ede1 });
const NORMAL_LENGTH = 28;

/** Segmento de duas pontas com posição atualizável (normais). */
function segmentLine(material) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
  const line = new THREE.LineSegments(g, material);
  line.frustumCulled = false;
  return line;
}

function setSegment(line, x, y, z, n) {
  const pos = line.geometry.attributes.position;
  pos.setXYZ(0, x, y, z);
  pos.setXYZ(1, x + n.x * NORMAL_LENGTH, y + n.y * NORMAL_LENGTH, z + n.z * NORMAL_LENGTH);
  pos.needsUpdate = true;
}

/** As 3 arestas de cada triângulo do corpo, no espaço dele. */
function edgesGeometry(body) {
  const T = body.tris;
  const n = body.triangleCount;
  const pos = new Float32Array(n * 18);
  for (let i = 0; i < n; i++) {
    const o = i * TRI_STRIDE;
    for (let e = 0; e < 3; e++) {
      const a = o + e * 3;
      const b = o + ((e + 1) % 3) * 3;
      const w = i * 18 + e * 6;
      pos[w] = T[a];
      pos[w + 1] = T[a + 1];
      pos[w + 2] = T[a + 2];
      pos[w + 3] = T[b];
      pos[w + 4] = T[b + 1];
      pos[w + 5] = T[b + 2];
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  return g;
}

/** Cápsula em arame com os pés na origem: anéis no equador das semiesferas e quatro meridianos. */
function capsuleGeometry(radius, height, segments = 24) {
  const pts = [];
  const push = (ax, ay, az, bx, by, bz) => pts.push(ax, ay, az, bx, by, bz);
  const lo = radius;
  const hi = height - radius;
  for (const y of [lo, hi]) {
    for (let i = 0; i < segments; i++) {
      const a0 = (i / segments) * Math.PI * 2;
      const a1 = ((i + 1) / segments) * Math.PI * 2;
      push(Math.cos(a0) * radius, y, Math.sin(a0) * radius, Math.cos(a1) * radius, y, Math.sin(a1) * radius);
    }
  }
  const quarter = segments / 4;
  for (let k = 0; k < 4; k++) {
    const phi = (k / 4) * Math.PI * 2;
    const cx = Math.cos(phi);
    const cz = Math.sin(phi);
    for (let i = 0; i < quarter; i++) {
      const t0 = -Math.PI / 2 + (i / quarter) * (Math.PI / 2);
      const t1 = -Math.PI / 2 + ((i + 1) / quarter) * (Math.PI / 2);
      // semiesfera de baixo (do polo ao equador) e a de cima, espelhada
      push(Math.cos(t0) * radius * cx, lo + Math.sin(t0) * radius, Math.cos(t0) * radius * cz,
        Math.cos(t1) * radius * cx, lo + Math.sin(t1) * radius, Math.cos(t1) * radius * cz);
      push(Math.cos(t0) * radius * cx, hi - Math.sin(t0) * radius, Math.cos(t0) * radius * cz,
        Math.cos(t1) * radius * cx, hi - Math.sin(t1) * radius, Math.cos(t1) * radius * cz);
    }
    push(radius * cx, lo, radius * cz, radius * cx, hi, radius * cz);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  return g;
}

export class PhysicsDebugView {
  /** @param {{scene: THREE.Scene, world: import('../physics/collisionWorld.js').CollisionWorld}} opts */
  constructor({ scene, world }) {
    this.group = new THREE.Group();
    this.group.name = 'debug-colisao';
    this.group.visible = false;
    const lineMaterial = (color, opacity = 1) => new THREE.LineBasicMaterial({
      color, transparent: true, opacity, depthTest: false, depthWrite: false, fog: false, toneMapped: false,
    });
    this.materials = [
      lineMaterial(COLORS.edges, 0.5), lineMaterial(COLORS.capsule, 0.9), lineMaterial(COLORS.normal), lineMaterial(COLORS.contact),
    ];
    const [edgeMat, capsuleMat, normalMat, contactMat] = this.materials;
    this.bodies = world.bodies.map((body) => {
      const lines = new THREE.LineSegments(edgesGeometry(body), edgeMat);
      lines.matrixAutoUpdate = false;
      lines.matrix.copy(body.matrix);
      lines.name = `colisao-${body.name}`;
      this.group.add(lines);
      return { body, lines };
    });
    this.stand = new THREE.LineSegments(capsuleGeometry(HULL.radius, HULL.standHeight), capsuleMat);
    this.duck = new THREE.LineSegments(capsuleGeometry(HULL.radius, HULL.duckHeight), capsuleMat);
    this.normal = segmentLine(normalMat);
    this.contact = segmentLine(contactMat);
    this.group.add(this.stand, this.duck, this.normal, this.contact);
    // Depois da cena (transparentes em ordem): o arame fica sempre por cima.
    this.group.traverse((o) => {
      o.renderOrder = 1000;
    });
    scene.add(this.group);
  }

  setVisible(visible) {
    this.group.visible = visible;
  }

  /** Acompanha corpos que se mexem, a cápsula (pés interpolados) e a normal do chão. */
  update(pawn, alpha) {
    if (!this.group.visible) return;
    for (const { body, lines } of this.bodies) if (body.transformed) lines.matrix.copy(body.matrix);
    const s = pawn.state;
    const p = pawn.prevOrigin;
    const x = p.x + (s.origin.x - p.x) * alpha;
    const y = p.y + (s.origin.y - p.y) * alpha;
    const z = p.z + (s.origin.z - p.z) * alpha;
    // A cápsula só aparece com a câmera fora dela (terceira pessoa ou noclip).
    const showCapsule = pawn.thirdPerson || s.moveType === MOVETYPE.NOCLIP;
    this.stand.visible = showCapsule && !s.ducked;
    this.duck.visible = showCapsule && s.ducked;
    this.stand.position.set(x, y, z);
    this.duck.position.set(x, y, z);
    this.normal.visible = s.onGround;
    if (s.onGround) setSegment(this.normal, x, y, z, s.groundNormal);
    const c = pawn.controller.lastContact;
    this.contact.visible = c.valid;
    if (c.valid) setSegment(this.contact, c.point.x, c.point.y, c.point.z, c.normal);
  }

  dispose() {
    this.group.removeFromParent();
    this.group.traverse((o) => o.geometry?.dispose());
    for (const m of this.materials) m.dispose();
  }
}
```

- [ ] **Passo 4: Painel do cl_showpos**

```js file=src/debug/showPos.js
// cl_showpos (Fase 3): pés, ângulos, velocidade, chão e cápsula do jogador num painel no canto, atualizado 15 vezes
// por segundo (texto, sem custo de layout a cada quadro).

import { h } from '../ui/dom.js';
import { SURFACES } from '../data/surfaces.js';
import { MOVETYPE } from '../player/movement.js';

const DEG = 180 / Math.PI;
const f1 = (v) => v.toFixed(1).padStart(8);
const f2 = (v) => v.toFixed(2);

export class ShowPosPanel {
  constructor(root) {
    this.el = h('pre.dbg-showpos', { hidden: true, 'aria-hidden': 'true' });
    root.append(this.el);
    this.visible = false;
    this.last = 0;
  }

  setVisible(visible) {
    this.visible = visible;
    this.el.hidden = !visible;
    this.last = 0;
  }

  update(pawn, now = performance.now()) {
    if (!this.visible || now - this.last < 66) return;
    this.last = now;
    const s = pawn.state;
    const o = s.origin;
    const v = s.velocity;
    let where = 'ar';
    if (s.moveType === MOVETYPE.NOCLIP) where = 'noclip';
    else if (s.onGround) {
      const n = s.groundNormal;
      where = `chão · ${SURFACES[s.groundSurface].label} · normal ${f2(n.x)} ${f2(n.y)} ${f2(n.z)}`;
    }
    this.el.textContent = [
      `pos   ${f1(o.x)} ${f1(o.y)} ${f1(o.z)}  (pés)`,
      `ang   yaw ${(pawn.yaw * DEG).toFixed(1)}°  pitch ${(pawn.pitch * DEG).toFixed(1)}°`,
      `vel   ${f1(v.x)} ${f1(v.y)} ${f1(v.z)}`,
      `plano ${Math.hypot(v.x, v.z).toFixed(1)} u/s · pico ${pawn.stats.topSpeed.toFixed(1)} u/s`,
      `onde  ${where}`,
      `cáps. ${s.ducked ? 'agachada' : 'em pé'} (${s.height} u) · agachar ${f2(s.duckAmount)}${s.stuck ? ' · PRESO' : ''}`,
      `pouso ${pawn.lastLanding ? `${pawn.lastLanding.speed.toFixed(0)} u/s` : '—'} · pulos ${pawn.stats.jumps}`,
    ].join('\n');
  }

  dispose() {
    this.el.remove();
  }
}
```

Em `styles/debug.css`, os painéis fixos passam a ficar em fluxo numa linha que quebra (o overlay à esquerda, o
cl_showpos à direita; em tela estreita o cl_showpos desce para baixo do overlay em vez de cobri-lo — visto no
navegador numa janela de 834 px, em que os dois se sobrepunham). Trocar o topo do arquivo e a regra do overlay

```css
/* Ferramentas de desenvolvimento: overlay de desempenho (F3), console (` / F1) e guias de toque. */

.dbg-overlay {
  position: absolute;
  top: calc(8px + var(--safe-t));
  left: calc(8px + var(--safe-l));
  z-index: 60;
  display: grid;
  gap: 4px;
  max-width: min(760px, 96vw);
  pointer-events: none !important;
}
```

por

```css
/* Ferramentas de desenvolvimento: overlay de desempenho (F3), console (` / F1), cl_showpos e guias de toque. */

/* Os painéis fixos (overlay à esquerda, cl_showpos à direita) ficam em fluxo numa linha que quebra: em tela estreita
   o cl_showpos desce para baixo do overlay em vez de cobri-lo. O console é absoluto e fica fora desse fluxo. */
#debug {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  align-content: flex-start;
  gap: 4px 8px;
  padding: calc(8px + var(--safe-t)) calc(8px + var(--safe-r)) 0 calc(8px + var(--safe-l));
}

.dbg-overlay {
  position: relative;
  z-index: 60;
  display: grid;
  gap: 4px;
  max-width: 100%;
  pointer-events: none !important;
}
```

e acrescentar ao fim (o `!important` do `pointer-events` é necessário: `#debug > *` liga os cliques dos filhos e tem
especificidade de id; sem ele o painel bloquearia cliques no menu de pausa embaixo):

```css
/* cl_showpos (Fase 3): pés, velocidade e chão do jogador no canto superior direito. Largura fixa na da linha mais
   longa (60 caracteres), para o painel não pular de linha quando o texto muda; em tela menor que isso as linhas
   quebram. */
.dbg-showpos {
  position: relative;
  z-index: 60;
  width: min(100%, calc(60ch + 18px));
  margin: 0 0 0 auto;
  padding: 6px 9px;
  border-radius: 6px;
  background: rgb(42 35 32 / 0.78);
  color: var(--paper);
  font: 600 11.5px/1.45 var(--font-mono);
  white-space: pre-wrap;
  text-shadow: 0 1px 0 #000;
  font-variant-numeric: tabular-nums;
  pointer-events: none !important;
}
```

- [ ] **Passo 5: Linha de física no overlay** — em `src/debug/overlay.js`, trocar

```
import { PRESET_LABELS } from '../data/qualityPresets.js';
```

por

```
import { PRESET_LABELS } from '../data/qualityPresets.js';
import { MOVETYPE } from '../player/movement.js';
```

trocar

```
export class DebugOverlay {
```

por

```
/** Linha da física do jogador (Fase 3): custo médio por tick e as consultas do último tick. */
function physicsLine(player) {
  if (!player) return 'física: — (fora da partida)';
  const p = player.physicsStats;
  if (!p) return 'física: câmera livre (mapa sem colisão)';
  const s = player.state;
  const where = s.moveType === MOVETYPE.NOCLIP ? 'noclip' : s.onGround ? 'chão' : 'ar';
  return `física: ${fmt(p.us, 0)} µs/tick · varreduras ${p.sweeps} · sobreposições ${p.overlaps} · triângulos ${p.triangles} · ${where}`;
}

export class DebugOverlay {
```

e, no fim do array `lines` de `#full()`, acrescentar depois da linha `estado: …`:

```
      physicsLine(states.name === 'match' ? states.current?.player : null),
```

- [ ] **Passo 6: Rodar todos os testes** — `npm test` → todos passando.

- [ ] **Passo 7: Commit** — `git add src/debug styles/debug.css && git commit -m "feat(fase-3.1): r_colisao, cl_showpos, terceira pessoa, sv_* e física no overlay"`

---

### Tarefa 12: Verificação no navegador

- [ ] **Passo 1:** `preview_start` com `massacre-dev` (ou `massacre-dev-auto` se a 5173 estiver ocupada); menu → "Sala de testes".
- [ ] **Passo 2:** `read_console_messages` sem erros do jogo; se o painel estiver oculto, dirigir quadros pelo console da página (`setInterval(() => massacre.loop.frame(performance.now()), 16)`). Duas mensagens esperadas que não são do jogo: "Blocked attempt to show a 'beforeunload' confirmation panel…" quando a página é recarregada por script no meio da partida (a proteção contra Ctrl+W da Fase 1, sem gesto do usuário o Chrome só registra) e o aviso `X4122 … double precision` do compilador de shader do Direct3D (ANGLE no Windows) sobre as constantes do chunk `packing` do próprio three.js (`UnpackDownscale = 255/256`).
- [ ] **Passo 3:** pelo `javascript_tool`: jogador no chão (`massacre.states.current.player.state.onGround`, `origin.y ≈ 0,031`); empurrões de velocidade (até 3500 u/s) contra as paredes, o pote, a tampa e o boneco → nunca atravessa; `r_colisao 1`, `thirdperson`, `cl_showpos 1` e captura de tela mostrando arame, cápsula e painel. Os painéis de debug não se cobrem: `cl_showpos` ao lado do overlay em janela larga, abaixo dele em janela estreita (conferir com `resize_window` 1600 × 900, a janela do painel e o preset `mobile`).
- [ ] **Passo 4:** pote aberto, pelo lado de fora: pulo em pé não alcança a borda (ápice 57 u < borda ~62 u), pulo agachado alcança. Por dentro, o fundo curvo do pote ergue a base chata a 8,4 u com o eixo encostado na parede interna (36,6 u do centro), então lá dentro o pulo em pé alcança a borda (8,4 + 57 > 62) e sai. Espátula: andar por cima (degrau de ~8,6 u, câmera suave, nunca no ar).
- [ ] **Passo 5:** `noclip` para dentro da parede norte (eixo em z −801, −800, −799 e −798,5) e `noclip` de novo → o jogador sai da parede pelo lado do chão, de pé, sem ficar preso (o empurrão direto é ambíguo com o eixo dentro de parede fina; sem a preferência por chão ele saía em z −819,23, fora do set); `noclip` fora do set, desligar → cai e volta ao spawn com o aviso; `sv_gravity 400` muda o pulo; `sv_reset`.
- [ ] **Passo 6:** memória: menu ↔ sala 3× e comparar `renderer.info.memory` (geometrias/texturas estáveis) e o heap JS depois da coleta; linha "física" do overlay (µs/tick) anotada para o relatório, parado e correndo (rota com pulo, agachar e contato com paredes e pote — a média é o número confiável: sem isolamento de origem o `performance.now()` do navegador tem resolução de 100 µs).

---

### Tarefa 13: Documentação e memória

- [ ] **Passo 1:** `docs/PROGRESS.md` — seção "Fase 3 — Movimento, física e colisão" com a subfase 3.1 (arquivos criados/alterados, como testar, medições, checklist) e `sv` na lista de serviços das convenções.
- [ ] **Passo 2:** `docs/phases/phase-3.md` — 3.1 ✅ com a data e o checklist marcado.
- [ ] **Passo 3:** memória do projeto (`massacre-game-project.md`): repositório git próprio, Fase 3 em andamento, 3.1 pronta, próxima 3.2.
- [ ] **Passo 4:** commit dos documentos e encerrar pedindo um chat novo para a 3.2.
