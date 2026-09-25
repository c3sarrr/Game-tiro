# Subfase 3.4 — Slide, wall-jump e dano de queda: plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** o slide (correr + agachar: impulso até 1,2 × a velocidade do item, até 0,6 s segurando o Ctrl, atrito baixo, cápsula agachada, recarga de 1 s, saída sem parada seca), o wall-jump (no ar, encostado numa parede ainda não usada no voo, o pulo chuta para onde o jogador olha; a mesma parede só volta a valer depois do chão) e o dano de queda (seguro até 420 u, linear na razão do CS:GO, fatal a 1413,373 u/s), com a vida mínima do jogador (vida 100, colete lido do `Loadout`, `god`, morte com a câmera do morto e volta em 2 s no ponto de volta), os números finais das estações 5 e 6 e as anotações da torre na pista, o HUD de teste com a vida e as ferramentas de debug (`cl_showpos`, medidor de salto, gráfico, `r_colisao`, `sv_*`, `kill`, `hurtme`).

**Architecture:** a abordagem A da 3.2: slide (`src/player/slide.js`) e wall-jump (`src/player/wallJump.js`) são funções puras dentro do `playerMove` (`src/player/movement.js`), sobre o estado de movimento, na ordem do tick do desenho; a sonda de parede (`src/physics/wallProbe.js`) consulta os corpos do `CollisionWorld` no esquema de consultas dele, e o `ColliderBuilder` passa a guardar a peça de cada triângulo (a "mesma parede" é a mesma peça no mesmo corpo). A vida é um módulo puro (`src/player/vitals.js`) que o `PlayerPawn` aplica a partir do evento de pouso; o `MatchState` faz a volta no ponto de volta (`src/modes/returnPoint.js`) e o HUD de teste mostra a vida, o dano e a morte. Números em `src/data/movement.js`, `src/data/vitals.js` e `src/data/pista.js`.

**Tech Stack:** JavaScript ES Modules, three 0.186.1, three-mesh-bvh 0.9.15 (`shapecast` da sonda), `node --test`.

**Especificação:** `docs/phases/phase-3.md` (seção 3.4, com os ajustes feitos na implementação); números de origem no código do CS:GO e no `player.js` do Doodle District, citados na seção. Regras: `CLAUDE.md` (sem placeholder, < 600 linhas por arquivo, números em `src/data/`).

**Como executar os blocos de código:** cada bloco ` ```js file=<caminho> ` (ou ` ```css file=<caminho> `) é o conteúdo completo do arquivo e é gravado com o extrator da Tarefa 0, sem redigitar — num arquivo que já existe, substitui o arquivo inteiro (usado onde a mudança toca o arquivo quase todo). Alterações em arquivos existentes vêm como pares "Em `arquivo`, trocar: … por: …", aplicados na ordem em que aparecem com a ferramenta de edição (cada trecho "trocar" é único no arquivo no momento em que é aplicado). Dois arquivos passam por um estado intermediário: `src/player/playerPawn.js` (a Tarefa 3 só roteia os eventos novos; a Tarefa 4 grava o arquivo inteiro) e `tests/vitals.test.js` (a Tarefa 3 cria a parte pura; a Tarefa 4 acrescenta o pawn e o console).

**Estado de partida:** a árvore da 3.3 (sem commit, sobre o commit `ee990d8` da branch `fase-3.1`) com o desenho da 3.4 já registrado na seção 3.4 de `docs/phases/phase-3.md`; `npm test` com 213 testes passando. A 3.4 entra na mesma árvore.

**Commits:** os passos "Commit" só rodam quando o usuário pedir (decisão da 3.3: nada de commit até o pedido). Toda mensagem termina com a linha `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

**Números conferidos pelos testes** (64 tick; faca quando não dito): slide de 300 → 204,7 u/s em 0,61 s (39 ticks) e 151,2 u (AK 258 → 176,1 u/s, 130,0 u); saída do slide de 205 a 85 u/s em ~11 ticks, sem o corte seco; pulo no slide com o teto de 286 u/s e, com o Ctrl seguro, os pés +9 u; wall-jump com a vertical de 289,41 u/s (+52,35 u de ápice), piso da velocidade no item e teto de 286, buffer de 0,15 s (9 ticks), tolerância de 0,12 s, subida máxima de 220,2 u/s e espera de 0,35 s; quedas do repouso 200 → 0, 420 → 0, 430 → 0,88, 600 → 26,15, 900 → 61,95, 1200 → 93,54, 1250 → 99,85 e 1310 → 104,06 de dano; na pista, o poço não sai com 3 paredes em nenhuma das 144 tentativas (ápice ~205 u, parede de 224) e sai com as 4 para a prancha (pés a 230,03 u); o zigue-zague passa com a faca e com a AK pelos 4 painéis (mais de 40 u de folga na borda de B) e sem wall-jump cai no vão; o slide passa sob as quatro traves e em pé bate na primeira; as pranchas da torre, saindo andando, dão 0, 0, ~26, ~62 e a de 1310 mata; 10 min simulados na sala e na pista com mais de 20 slides e 20 wall-jumps cada, sem penetração e iguais bit a bit com o estado novo.

**Números medidos no navegador** (a implementação verificada, com a entrada pelo `InputManager` do jogo e o ponteiro liberado por script): slide com a faca na faixa: 151,2 u em 0,61 s, 300 → 205 u/s, sob as quatro traves; poço com as 4 paredes: ápice 253 u e de pé na prancha a 230 u; zigue-zague: a faca passa a borda de B com ~137–139 u de folga e a AK com ~35–39; prancha de 600 andando: pouso a 968,75 u/s, dano 25,1 e "−25" no HUD; prancha de 1310 correndo: dano 105,1, morte ("Você se esborrachou") e volta na própria prancha em 2,0 s; `setpos` abaixo do set: uma morte ("Caiu do set") e volta no spawn; `hurtme 26` → vida 74; memória: menu com 2 geometrias / 33 texturas / 20 programas nas três saídas e pista com 42 / 79 / 41 nas três entradas, ouvintes de `player:*` zerados no menu, heap de volta a ~15–16 MB depois da coleta.

**Validação do próprio plano:** antes de ser gravado, o plano foi aplicado tarefa por tarefa numa cópia limpa do projeto (a árvore da 3.3) com o extrator e os pares: em cada tarefa os testes novos falham antes da implementação (as falhas esperadas estão em cada passo) e passam depois, a suíte inteira passa ao fim de cada tarefa (213 → 215 → 219 → 240 → 245 → 249 → 251 → 255) e, no fim, cada arquivo criado ou alterado ficou idêntico ao da implementação verificada no navegador.

---

## Mapa de arquivos

| Arquivo | Responsabilidade |
|---|---|
| `src/data/movement.js` | `sv_*` novas (slide, wall-jump, escala da queda) com faixa e ajuda do console; `SLIDE`, `WALLJUMP` e `FALL` |
| `src/data/vitals.js` | **novo** — vida máxima, volta em 2 s, câmera do morto, tempo do "−n", tipos de dano (colete ou não) e textos das causas |
| `src/physics/colliders.js` | `ColliderBuilder`: peça de cada triângulo (cada forma é uma peça; `part` junta formas por nome) |
| `src/physics/collisionBody.js` | peça por triângulo na ordem do BVH; chave do corpo no mundo |
| `src/physics/collisionWorld.js` | chave do corpo na ordem de entrada (`addBody`); o trace devolve a peça |
| `src/physics/wallProbe.js` | **novo** — sonda de parede do wall-jump: a face de parede mais próxima a até `reach` da cápsula, sem alocar |
| `src/physics/characterController.js` | a sonda e o resultado; `raise` (subir os pés por varredura) e `groundMove` (o fim do WalkMove, do andar e do slide) |
| `src/player/duck.js` | `snapDuck`: agachar na hora (começo do slide) |
| `src/player/footsteps.js` | sem passos no slide (o relógio fica parado) |
| `src/player/vitals.js` | **novo** — vida pura: dano de queda, acumulador fracionário, `god`, morte e volta |
| `src/player/slide.js` | **novo** — começo, atrito, movimento, pulo e fim do slide |
| `src/player/wallJump.js` | **novo** — relógios, paredes usadas, direção do chute, o chute e o contato de parede da sonda |
| `src/player/movement.js` | estado novo (slide, wall-jump e o anel de paredes usadas), `interruptMoves`, a ordem do tick da 3.4, saída do slide e o dano no pouso |
| `src/core/events.js` | `EV.PLAYER_SLIDE`, `EV.PLAYER_WALLJUMP`, `EV.PLAYER_HURT`, `EV.PLAYER_DEATH`, `EV.PLAYER_SPAWN`; `damage` no pouso |
| `src/player/telemetry.js` | marcas de slide e de wall-jump |
| `src/player/playerPawn.js` | vida, dano, morte (comando vazio e câmera do morto), volta, `kill`, eventos novos no barramento, contagens e telemetria |
| `src/debug/vitalsCommands.js` | **novo** — `kill` e `hurtme` |
| `src/debug/commands.js` | registra os comandos da vida |
| `src/data/pista.js` | poço, zigue-zague, faixa de slide, anotações da torre e os pontos das estações 5 e 6 |
| `src/maps/pista/pieces.js`, `colliders.js` | nome de peça (`part`) das peças do layout até o `ColliderBuilder` |
| `src/maps/pista/layoutAdvanced.js` | estações 5 e 6 nos números novos: parede sul do poço numa peça só, faixas acima da porta, linha de largada, marcas e etiquetas da faixa |
| `src/maps/pista/layoutTower.js` | anotações da tábua em lista (com as de cima do risco) e voltadas para fora |
| `src/debug/jumpMeter.js` | wall-jumps do voo, dano do pouso e o recorde de wall-jumps seguidos |
| `src/debug/showPos.js`, `speedGraph.js`, `physicsDebug.js`, `styles/debug.css` | linhas de vida, slide e parede; faixa do slide e marca do wall-jump no gráfico; contato de parede no `r_colisao` |
| `src/modes/returnPoint.js` | **novo** — ponto de volta: o último teleporte do console que se sustentou, senão o spawn |
| `src/modes/matchState.js` | vida no HUD, morte e volta em 2 s no ponto de volta, cair do set mata, `god` e "reduzir movimento" no tick |
| `src/ui/sandboxHud.js`, `styles/hud.css` | etiqueta "vida · colete", o "−n" do dano, a etiqueta da morte e as dicas do slide e do wall-jump |
| testes novos | `wallProbe`, `slide`, `wallJump`, `vitals`, `returnPoint` |
| testes que ganham casos | `movementData`, `tacticalMovement`, `movementFuzz`, `playerPawn`, `pistaLayout`, `pistaMovement`, `pistaFuzz`, `jumpMeter` |

---

### Tarefa 0: Extrator dos blocos do plano

**Files:**
- Create: `<scratchpad>/extract-plan.mjs` (fora do projeto)

- [ ] **Passo 1: Criar o extrator** — o mesmo da 3.1, da 3.2 e da 3.3: lê o plano e grava cada bloco ` ```js file=... ` (ou `css`) no caminho indicado, só para os arquivos pedidos na linha de comando.

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

- [ ] **Passo 2: Conferir** — `node extract-plan.mjs docs/phases/phase-3.4-plan.md . src/data/vitals.js` grava o arquivo pedido (apagar o arquivo de novo: a Tarefa 1 o cria no passo certo).

---

### Tarefa 1: Dados do slide, do wall-jump, da queda e da vida

**Files:**
- Create: `src/data/vitals.js`
- Modify: `src/data/movement.js`
- Test: `tests/movementData.test.js`

As `sv_*` novas entram no `SV_DEFAULTS` e no `SV_VARS` (o console, a faixa, a ajuda e o `sv_reset` vêm sozinhos pelo `movementCommands` da 3.2); `SLIDE`, `WALLJUMP` e `FALL` ficam no `movement.js`, ao lado do `DUCK` de que o fim do slide depende; a vida, os tipos de dano (se o colete vale) e os textos das causas de morte ficam no `vitals.js`. Os testes conferem as razões da referência (12,8 ÷ 10,6; 9,2 ÷ 9,6; 7 ÷ 9,6; 6 ÷ 10,6), o limite seguro de 420 u e a razão 1000/580 do CS:GO.

- [ ] **Passo 1: Escrever os testes** — cabeçalho e imports, as variáveis liga/desliga novas e dois testes novos.

Em `tests/movementData.test.js`, trocar:

```
// Testes dos dados de movimento (Fases 3.1 e 3.2): sv_* do CS:GO, faixas do console, constantes do movimento tático e
// materiais de superfície.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HULL, SV_DEFAULTS, SV_VARS, CONTROLLER, DUCK, MOVE, STEPS, VIEW } from '../src/data/movement.js';
import { SURFACES, SURFACE_INDEX, surfaceIndex } from '../src/data/surfaces.js';
```

por:

```
// Testes dos dados de movimento (Fases 3.1, 3.2 e 3.4): sv_* do CS:GO, faixas do console, constantes do movimento
// tático, do slide, do wall-jump e do dano de queda, a vida e os materiais de superfície.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  HULL, SV_DEFAULTS, SV_VARS, CONTROLLER, DUCK, FALL, MOVE, SLIDE, STEPS, VIEW, WALLJUMP,
} from '../src/data/movement.js';
import { DAMAGE, DEATH_CAUSES, VITALS } from '../src/data/vitals.js';
import { SURFACES, SURFACE_INDEX, surfaceIndex } from '../src/data/surfaces.js';
```

Em `tests/movementData.test.js`, trocar:

```
  assert.equal(setSvVar(vars, 'timebetweenducks', '0,25'), 0.25);
});
```

por:

```
  assert.equal(setSvVar(vars, 'timebetweenducks', '0,25'), 0.25);
  assert.equal(setSvVar(vars, 'slide', 0.4), 0);
  assert.equal(setSvVar(vars, 'walljump', '1'), 1);
  assert.equal(setSvVar(vars, 'slide_time', '0,8'), 0.8);
});

test('slide, wall-jump e queda (3.4): números da referência na escala do CS e o limite seguro de 420 u', () => {
  // Slide: impulso 12,8 ÷ 10,6 da referência, 0,6 s, recarga 1 s; entra a 80% e acaba na velocidade do agachado.
  assert.ok(Math.abs(SV_DEFAULTS.slide_speed - 12.8 / 10.6) < 0.01);
  assert.equal(SV_DEFAULTS.slide_time, 0.6);
  assert.equal(SV_DEFAULTS.slide_cooldown, 1);
  assert.ok(SLIDE.endSpeed < SLIDE.minSpeed && SLIDE.minSpeed < SV_DEFAULTS.slide_speed);
  assert.equal(SLIDE.endSpeed, DUCK.speedMultiplier);
  assert.ok(Math.abs(SLIDE.steer * 10.6 - 6) < 1e-12, 'controle lateral de 6 m/s² da referência');
  // Atrito do slide: faca 300 → ~205 u/s em 0,6 s (decaimento contínuo e^(−0,12 · 5,2 · 0,6)).
  const decay = Math.exp(-SV_DEFAULTS.slide_friction * SV_DEFAULTS.friction * SV_DEFAULTS.slide_time);
  assert.ok(300 * decay > 200 && 300 * decay < 210, `${300 * decay}`);
  // Wall-jump: 0,958 do pulo (+52,35 u de ápice), subida máxima 7 ÷ 9,6 do pulo, teto do bhop.
  assert.ok(Math.abs(SV_DEFAULTS.walljump_up ** 2 / (2 * SV_DEFAULTS.gravity) - 52.35) < 0.01);
  assert.ok(Math.abs(WALLJUMP.maxRise * SV_DEFAULTS.jump_impulse - 220.2) < 0.05);
  assert.equal(SV_DEFAULTS.walljump_maxspeed, MOVE.bunnyJumpFactor * MOVE.runSpeed);
  assert.ok(WALLJUMP.grace < WALLJUMP.buffer && WALLJUMP.buffer < WALLJUMP.cooldown);
  const wallDeg = Math.acos(WALLJUMP.maxNormalY) / (Math.PI / 180);
  assert.ok(wallDeg > 69 && wallDeg < 71, `parede: normal a até ~20° da horizontal (rampas até 70° não contam): ${wallDeg}`);
  assert.ok(WALLJUMP.minAway > 0 && WALLJUMP.minAway < 90 && WALLJUMP.sameWall > 0 && WALLJUMP.sameWall < 90);
  assert.ok(WALLJUMP.maxUsed >= 4 && WALLJUMP.ageMax > WALLJUMP.grace);
  // Queda: sem dano até a de 420 u; fatal na razão 1000/580 do CS:GO.
  assert.ok(Math.abs(FALL.safeSpeed - 819.756) < 0.001);
  assert.ok(Math.abs(FALL.fatalSpeed - 1413.373) < 0.001);
  assert.equal(FALL.fatalDamage, VITALS.maxHealth);
});

test('vida (3.4): tipos de dano sem colete, causas com texto, volta em 2 s e a câmera do morto', () => {
  for (const kind of Object.values(DAMAGE)) assert.equal(kind.armor, false, 'queda e mundo não passam pelo colete');
  for (const cause of ['queda', 'fora', 'kill', 'mundo']) assert.ok(DEATH_CAUSES[cause]?.length > 3, cause);
  assert.equal(VITALS.maxHealth, 100);
  assert.equal(VITALS.respawnDelay, 2);
  assert.ok(VITALS.deathCam.eye > 0 && VITALS.deathCam.eye < HULL.duckEye);
  assert.ok(VITALS.deathCam.rollDeg > 0 && VITALS.deathCam.time > 0 && VITALS.damageFlash > 0);
});
```

- [ ] **Passo 2: Rodar e ver falhar**

Run: `node --test tests/movementData.test.js`
Expected: FAIL — o arquivo nem carrega: `ERR_MODULE_NOT_FOUND` (não acha `src/data/vitals.js`).

- [ ] **Passo 3: Dados de movimento** — as nove `sv_*` com os valores de origem, as faixas do console e as constantes do slide, do wall-jump e da queda.

Em `src/data/movement.js`, trocar:

```
// Fonte dos números da Fase 3.2 (andar, agachar, stamina, bhop, passos): código do CS:GO e dados finais do jogo —
// docs/research/csgo-movement-notes.md; decisões em docs/phases/phase-3.md (seção 3.2).

```

por:

```
// Fonte dos números da Fase 3.2 (andar, agachar, stamina, bhop, passos): código do CS:GO e dados finais do jogo —
// docs/research/csgo-movement-notes.md; decisões em docs/phases/phase-3.md (seção 3.2). Os da 3.4 (slide, wall-jump,
// dano de queda) vêm do Doodle District (src/player.js da referência, convertido para a escala do CS) e do código do
// CS:GO (CheckFalling, FlPlayerFallDamage); decisões em docs/phases/phase-3.md (seção 3.4).

```

Em `src/data/movement.js`, trocar:

```
  accelerate_use_weapon_speed: 1, // aceleração no chão pela velocidade do item na mão
});
```

por:

```
  accelerate_use_weapon_speed: 1, // aceleração no chão pela velocidade do item na mão
  slide: 1, // 1: correr + agachar desliza (seção 0.6)
  slide_speed: 1.2, // impulso do slide: no mínimo isto × a velocidade do item (12,8 ÷ 10,6 da referência)
  slide_time: 0.6, // s: duração máxima do slide
  slide_cooldown: 1, // s: recarga, contada do fim do slide
  slide_friction: 0.12, // atrito do slide: fração do sv_friction
  walljump: 1, // 1: pulo no ar encostado numa parede é wall-jump (seção 0.6)
  walljump_up: 301.993377 * (9.2 / 9.6), // 289,41 u/s: 0,958 do pulo (a razão da referência), +52,35 u de ápice
  walljump_maxspeed: 286, // teto da velocidade no plano do chute (o do bhop: 1,1 × 260)
  falldamage_scale: 1, // escala do dano de queda (0 desliga)
});
```

Em `src/data/movement.js`, trocar:

```
  }),
]);
```

por:

```
  }),
  Object.freeze({ key: 'slide', min: 0, max: 1, int: true, help: '1 = correr + agachar desliza' }),
  Object.freeze({ key: 'slide_speed', min: 0, max: 3, help: 'impulso do slide (× velocidade do item)' }),
  Object.freeze({ key: 'slide_time', min: 0, max: 5, help: 'duração máxima do slide (s)' }),
  Object.freeze({ key: 'slide_cooldown', min: 0, max: 10, help: 'recarga do slide (s, contada do fim)' }),
  Object.freeze({ key: 'slide_friction', min: 0, max: 1, help: 'atrito do slide (fração do sv_friction)' }),
  Object.freeze({ key: 'walljump', min: 0, max: 1, int: true, help: '1 = pulo no ar encostado numa parede é wall-jump' }),
  Object.freeze({ key: 'walljump_up', min: 0, max: 2000, help: 'velocidade vertical do wall-jump (u/s)' }),
  Object.freeze({ key: 'walljump_maxspeed', min: 0, max: 3500, help: 'teto da velocidade no plano do wall-jump (u/s)' }),
  Object.freeze({ key: 'falldamage_scale', min: 0, max: 10, help: 'escala do dano de queda (0 desliga)' }),
]);
```

Em `src/data/movement.js`, trocar:

```

/** Passos (CCSPlayer::UpdateStepSound + CBasePlayer::UpdateStepSound): relógio em ms e velocidades em u/s. */
```

por:

```

/**
 * Slide (seção 0.6; referência: o slide do Doodle District na escala do CS). Começa com o Ctrl apertado correndo no
 * chão; impulso, duração, recarga e atrito são sv_* (sv_slide_speed, sv_slide_time, sv_slide_cooldown,
 * sv_slide_friction). Velocidades em fração da velocidade do item na mão no modo atual.
 */
export const SLIDE = Object.freeze({
  minSpeed: 0.8, // velocidade no plano mínima para começar (a referência: 6,3 m/s com sprint de 10,6 e andar de 6,6)
  steer: 6 / 10.6, // controle lateral: o desejo empurra isto × a velocidade do item por segundo (6 m/s² da referência)
  airTime: 0.35, // s no ar que o slide aguenta (a referência); pousando antes disso ele continua
  endSpeed: DUCK.speedMultiplier, // abaixo disto o slide acaba: a velocidade do agachado (a referência: 3,5 m/s)
});

/**
 * Wall-jump (seção 0.6; referência: o wall-jump do Doodle District). No ar, encostado numa parede, um aperto do pulo
 * chuta para onde o jogador olha; a mesma parede só volta a valer depois do chão. Vertical e teto do chute são sv_*
 * (sv_walljump_up, sv_walljump_maxspeed); o piso do chute é a velocidade do item na mão.
 */
export const WALLJUMP = Object.freeze({
  reach: 4, // u além do raio da cápsula em que a sonda acha a parede
  maxNormalY: 0.34, // parede: normal de contato a no máximo ~20° da horizontal (chão, teto e rampas não contam)
  grace: 0.12, // s: o contato vale até isto depois de soltar a parede (a referência)
  buffer: 0.15, // s: um aperto do pulo no ar fica armado isto (a referência)
  cooldown: 0.35, // s entre dois wall-jumps (a referência)
  maxRise: 7 / 9.6, // subindo mais rápido que isto × sv_jump_impulse não vale (7 m/s com pulo de 9,6 na referência)
  minAway: 30, // graus: o chute sai pelo menos isto para fora da parede
  sameWall: 45, // graus: mesma peça de colisão com a direção a até isto de uma já usada é a mesma parede
  maxUsed: 16, // paredes usadas guardadas por voo (anel)
  ageMax: 60, // teto (s) da idade do contato de parede: sem contato
});

/**
 * Dano de queda (CS:GO: CheckFalling + FlPlayerFallDamage) com o limite seguro da seção 0.6: sem dano até a queda de
 * ~420 u; depois, linear na velocidade de queda do pouso até o fatal, na razão do CS:GO
 * (CS_PLAYER_FATAL_FALL_SPEED 1000 ÷ CS_PLAYER_MAX_SAFE_FALL_SPEED 580). Escala: sv_falldamage_scale.
 */
export const FALL = Object.freeze({
  safeSpeed: Math.sqrt(2 * 800 * 420), // 819,756 u/s: queda de 420 u com a gravidade do CS (sv_gravity 800)
  fatalSpeed: Math.sqrt(2 * 800 * 420) * (1000 / 580), // 1413,373 u/s
  fatalDamage: 100, // dano no fatal (o "100" do CS: a vida inteira)
});

/** Passos (CCSPlayer::UpdateStepSound + CBasePlayer::UpdateStepSound): relógio em ms e velocidades em u/s. */
```

- [ ] **Passo 4: Dados da vida**

```js file=src/data/vitals.js
// Vida do jogador (subfase 3.4): vida máxima, volta ao jogo depois de morrer, câmera da morte do modo livre, tipos de
// dano e os textos das causas de morte. O dano das armas e a fórmula do colete entram na Fase 4; o HUD de massinha, na
// Fase 10; a morte por amassamento, na Fase 5.

export const VITALS = Object.freeze({
  maxHealth: 100,
  respawnDelay: 2, // s até voltar (o respawn do Mata-mata, seção 0.8)
  // Câmera do morto: o olho desce até `eye` u acima dos pés e tomba `rollDeg` em `time` s ("reduzir movimento": só
  // desce).
  deathCam: Object.freeze({ eye: 12, rollDeg: 35, time: 0.5 }),
  damageFlash: 0.9, // s que o "−26" fica na etiqueta de vida do HUD de teste
});

/**
 * Tipos de dano. `armor`: o colete reduz? No CS:GO o colete só vale para dano genérico, de bala, explosão, pancada e
 * corte — nunca para queda. Os da 3.4 não passam pelo colete; os das armas chegam na Fase 4.
 */
export const DAMAGE = Object.freeze({
  queda: Object.freeze({ label: 'queda', armor: false }),
  mundo: Object.freeze({ label: 'mundo', armor: false }), // console (hurtme) e sair do set
});

/** Causas de morte: texto da etiqueta do modo livre. */
export const DEATH_CAUSES = Object.freeze({
  queda: 'Você se esborrachou',
  fora: 'Caiu do set',
  kill: 'Desistiu',
  mundo: 'Amassado pelo console',
});
```

- [ ] **Passo 5: Rodar os testes da tarefa**

Run: `node --test tests/movementData.test.js`
Expected: PASS — 8 testes passando.

- [ ] **Passo 6: Suíte inteira**

Run: `npm test`
Expected: PASS — 215 testes passando.

- [ ] **Passo final: Commit** (só com o pedido do usuário)

```bash
git add src/data/movement.js src/data/vitals.js tests/movementData.test.js
git commit -m "MASSACRE 3.4: dados do slide, do wall-jump, da queda e da vida" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Tarefa 2: Peças de colisão, chave do corpo e sonda de parede

**Files:**
- Create: `src/physics/wallProbe.js`, `tests/wallProbe.test.js`
- Modify: `src/physics/colliders.js` (arquivo inteiro), `src/physics/collisionBody.js`, `src/physics/collisionWorld.js`, `src/physics/characterController.js`

O wall-jump precisa de duas coisas da física: saber qual é "a mesma parede" e achar a parede perto da cápsula no ar. O `ColliderBuilder` passa a guardar a peça de cada triângulo — cada forma (`box`, `cylinder`, `ramp`, `stairs`, `geometry`, `object`, triângulos soltos) abre uma peça nova e a opção `part` (um nome) junta formas numa peça só; o `CollisionBody` copia as peças na ordem final do BVH e o trace devolve a peça do triângulo atingido. O corpo é lembrado pela chave que o `CollisionWorld` dá na ordem em que ele entra (`addBody`): o `id` global muda de um mundo para outro e quebraria o teste de determinismo. A sonda (`WallProbe`) roda o segmento interno da cápsula contra os triângulos a até raio + `reach` com o `shapecast` do BVH, sem alocar, e devolve a face de parede mais próxima (|n.y| ≤ `maxNormalY`) com a normal no plano, o ponto, o corpo, a peça e a superfície. O controlador guarda a sonda e ganha `raise` (subir os pés até onde a cápsula passar — o pulo agachado a partir do slide) e `groundMove` (o fim do WalkMove: varredura, degrau e grudar no chão), que o andar do CS e o slide vão usar.

- [ ] **Passo 1: Escrever os testes**

```js file=tests/wallProbe.test.js
// Testes da sonda de parede do wall-jump (subfase 3.4): acha a face de parede ao alcance (raio + 4 u) e não além;
// ignora chão, teto, a aresta de cima de uma parede baixa e rampas até 70°; devolve a normal no plano, o ponto, a peça
// do ColliderBuilder (formas separadas, grupo por nome) e o material; corpo girado devolve a normal no mundo.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { SURFACE_INDEX } from '../src/data/surfaces.js';
import { HULL, WALLJUMP } from '../src/data/movement.js';
import { ColliderBuilder } from '../src/physics/colliders.js';
import { CollisionBody } from '../src/physics/collisionBody.js';
import { CollisionWorld } from '../src/physics/collisionWorld.js';
import { WallProbe, createWallHit } from '../src/physics/wallProbe.js';
import { floor, worldOf } from './worldTestUtils.js';

const R = HULL.radius;
const H = HULL.standHeight;
const DEG = Math.PI / 180;
const near = (a, b, eps, msg) => assert.ok(Math.abs(a - b) <= eps, `${msg}: ${a} ≠ ${b}`);

/** Sonda com os números do wall-jump para a cápsula em pé com os pés em (x, y, z). */
function probeAt(world, x, y, z, height = H) {
  const hit = createWallHit();
  new WallProbe(world).probe(x, y, z, R, height, WALLJUMP.reach, WALLJUMP.maxNormalY, hit);
  return hit;
}

// Parede de madeira: caixa de x = 100 a 108, face de dentro em x = 100 voltada para −x.
const wallWorld = () => worldOf((b) => {
  floor(b);
  b.box(8, 200, 200, { center: [104, 100, 0], surface: 'madeira' });
});

test('acha a parede ao alcance e não além: normal no plano, distância, ponto, material', () => {
  const world = wallWorld();
  const hit = probeAt(world, 100 - R - 3, 0, 0);
  assert.equal(hit.hit, true);
  near(hit.nx, -1, 1e-9, 'normal x');
  near(hit.nz, 0, 1e-9, 'normal z');
  near(hit.ny, 0, 1e-9, 'contato na horizontal');
  near(hit.distance, R + 3, 1e-9, 'distância do segmento');
  near(hit.px, 100, 1e-9, 'ponto na face');
  assert.equal(hit.surface, SURFACE_INDEX.madeira);
  assert.equal(hit.body, world.bodies[0]);
  assert.ok(hit.part >= 0 && hit.triangle >= 0);
  assert.equal(probeAt(world, 100 - R - WALLJUMP.reach + 0.1, 0, 0).hit, true, 'no limite do alcance');
  assert.equal(probeAt(world, 100 - R - WALLJUMP.reach - 0.1, 0, 0).hit, false, 'além do alcance');
  assert.ok(world.stats.overlaps > 0 && world.stats.triangles > 0, 'conta a consulta nas estatísticas');
});

test('ignora chão, teto, a aresta de cima de uma parede baixa e rampas até 70°', () => {
  assert.equal(probeAt(worldOf((b) => floor(b)), 0, 0.03, 0).hit, false, 'de pé no chão');
  const ceiling = worldOf((b) => {
    floor(b);
    b.box(400, 10, 400, { center: [0, H + 2 + 5, 0] });
  });
  assert.equal(probeAt(ceiling, 0, 0.03, 0).hit, false, 'teto 2 u acima da cabeça');
  const low = worldOf((b) => {
    floor(b);
    b.box(8, 60, 200, { center: [104, 30, 0] });
  });
  assert.equal(probeAt(low, 100 - R - 2, 0.03, 0).hit, true, 'ao lado da parede baixa ela conta');
  // Pés em 52 (segmento de 68 a 108), 10 u antes da face: só a aresta de cima (100, 60) está ao alcance, e inclinada.
  assert.equal(probeAt(low, 90, 52, 0).hit, false, 'acima dela, o contato com a aresta sai inclinado');
  // Rampas subindo em +z de z = 0 até y = 200: a de 60° (|n.y| = 0,5) não é parede; a de 75° (|n.y| = 0,26) é. A
  // cápsula fica no ar diante da face, com a ponta de baixo do segmento a raio + 2 u dela.
  for (const [deg, wall] of [[60, false], [75, true]]) {
    const h = 200;
    const len = h / Math.tan(deg * DEG);
    const norm = Math.hypot(len, h);
    const w = worldOf((b) => {
      floor(b);
      b.ramp(200, len, h, { center: [0, 0, 0] });
    });
    const feet = 36;
    const y0 = feet + R; // ponta de baixo do segmento da cápsula
    const z = (len * y0 - (R + 2) * norm) / h; // distância (len·y − h·z)/norm = raio + 2 à face
    const hit = probeAt(w, 0, feet, z);
    assert.equal(hit.hit, wall, `rampa de ${deg}°`);
    if (wall) {
      near(hit.ny, len / norm, 1e-9, 'normal de contato = a da face');
      near(hit.distance, R + 2, 1e-9, 'distância');
    }
  }
});

test('peças: formas separadas são peças diferentes; o grupo por nome é uma peça só; a mais próxima vence', () => {
  const world = worldOf((b) => {
    floor(b);
    b.box(8, 200, 100, { center: [104, 100, -50] }); // painel A (z de −100 a 0)
    b.box(8, 200, 100, { center: [104, 100, 50] }); // painel B, no mesmo plano (z de 0 a 100)
    b.box(8, 200, 100, { center: [-104, 100, -50], part: 'grupo' });
    b.box(8, 200, 100, { center: [-104, 100, 50], part: 'grupo' });
  });
  const a = probeAt(world, 100 - R - 2, 0.03, -50);
  const b = probeAt(world, 100 - R - 2, 0.03, 50);
  assert.ok(a.hit && b.hit);
  assert.notEqual(a.part, b.part, 'painéis separados no mesmo plano');
  const g0 = probeAt(world, -100 + R + 2, 0.03, -50);
  const g1 = probeAt(world, -100 + R + 2, 0.03, 50);
  assert.equal(g0.part, g1.part, 'o grupo é uma parede só');
  near(g0.nx, 1, 1e-9, 'normal para dentro');
  // Entre duas paredes a 18 e a 19 u do segmento: a mais próxima vence.
  const w = worldOf((bb) => {
    floor(bb);
    bb.box(8, 200, 200, { center: [104, 100, 0] }); // face em x = 100 (normal −x)
    bb.box(8, 200, 200, { center: [59, 100, 0] }); // face em x = 63 (normal +x)
  });
  const hit = probeAt(w, 82, 0.03, 0);
  assert.ok(hit.hit);
  near(hit.distance, 18, 1e-9, 'a mais próxima');
  near(hit.nx, -1, 1e-9, 'a da direita');
});

test('corpo girado: a normal e o ponto saem no mundo, a peça no corpo', () => {
  const b = new ColliderBuilder();
  b.box(8, 200, 200, { center: [104, 100, 0] });
  const world = new CollisionWorld();
  // Girado 90° em Y: a face de x = 100 (normal −x) vira a face de z = −100, com a normal para +z.
  const m = new THREE.Matrix4().makeRotationY(90 * DEG);
  world.addBody(new CollisionBody(b.build(), { name: 'girado', matrix: m }));
  const face = new THREE.Vector3(100, 50, 0).applyMatrix4(m);
  const n = new THREE.Vector3(-1, 0, 0).transformDirection(m);
  const hit = probeAt(world, face.x + n.x * (R + 2), 0, face.z + n.z * (R + 2));
  assert.ok(hit.hit);
  near(hit.nx, n.x, 1e-9, 'normal x no mundo');
  near(hit.nz, n.z, 1e-9, 'normal z no mundo');
  near(hit.px, face.x, 1e-9, 'ponto x no mundo');
  near(hit.pz, face.z, 1e-9, 'ponto z no mundo');
  assert.equal(hit.body.key, 1, 'chave do corpo no mundo');
});
```

- [ ] **Passo 2: Rodar e ver falhar**

Run: `node --test tests/wallProbe.test.js`
Expected: FAIL — `ERR_MODULE_NOT_FOUND` (não acha `src/physics/wallProbe.js`).

- [ ] **Passo 3: Peça de cada triângulo no `ColliderBuilder`** (arquivo inteiro: a peça atravessa todas as formas).

```js file=src/physics/colliders.js
// Formas de colisão dos mapas, separadas da malha visual: o boil e as digitais da massinha são deformação de
// shader (não podem virar tropeço) e malha densa deixaria cada varredura cara. Cada mapa monta as suas formas com o
// ColliderBuilder e entrega o resultado ao CollisionBody. Cada triângulo guarda o material de superfície
// (src/data/surfaces.js), usado no atrito, no pulo, nos passos e nas pegadas, e a peça de onde veio (subfase 3.4): cada
// forma (box, cylinder, ramp, stairs, geometry, object, triângulo ou quadrilátero solto) é uma peça nova, e a opção
// `part` (um nome) junta formas numa peça só — o wall-jump conta cada peça como uma parede.

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
  #nextPart = 0;
  #named = new Map();

  constructor() {
    this.positions = [];
    this.surfaces = [];
    this.parts = [];
    this.skipped = 0;
  }

  get triangleCount() {
    return this.surfaces.length;
  }

  /** Quantas peças já foram criadas (ids de 0 a partCount − 1). */
  get partCount() {
    return this.#nextPart;
  }

  /** Id da peça: `part` (nome) junta formas numa peça só; sem nome, cada forma é uma peça nova. */
  #partId(part) {
    if (part === null || part === undefined) return this.#nextPart++;
    let id = this.#named.get(part);
    if (id === undefined) {
      id = this.#nextPart++;
      this.#named.set(part, id);
    }
    return id;
  }

  /** Triângulo já com material e peça resolvidos. */
  #push(a, b, c, sid, pid) {
    const abx = b.x - a.x, aby = b.y - a.y, abz = b.z - a.z;
    const acx = c.x - a.x, acy = c.y - a.y, acz = c.z - a.z;
    const cx = aby * acz - abz * acy;
    const cy = abz * acx - abx * acz;
    const cz = abx * acy - aby * acx;
    if (cx * cx + cy * cy + cz * cz < MIN_CROSS_SQ) {
      this.skipped++;
      return;
    }
    this.positions.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
    this.surfaces.push(sid);
    this.parts.push(pid);
  }

  #quad(a, b, c, d, sid, pid) {
    this.#push(a, b, c, sid, pid);
    this.#push(a, c, d, sid, pid);
  }

  /** Triângulo em espaço de mundo; `surface` é o id do material (ou o índice já resolvido); `part` junta peças. */
  triangle(a, b, c, surface = 'padrao', part = null) {
    this.#push(a, b, c, surfaceIndex(surface), this.#partId(part));
    return this;
  }

  /** Quadrilátero a-b-c-d em ordem (triângulos abc e acd), uma peça só. */
  quad(a, b, c, d, surface = 'padrao', part = null) {
    this.#quad(a, b, c, d, surfaceIndex(surface), this.#partId(part));
    return this;
  }

  /** Malha qualquer (indexada ou não) levada ao mundo por `matrix` — para malhas já simples (chão, placas, props). */
  geometry(geometry, { matrix = null, surface = 'padrao', part = null } = {}) {
    return this.#geometry(geometry, matrix, surfaceIndex(surface), this.#partId(part));
  }

  #geometry(geometry, matrix, sid, pid) {
    const pos = geometry.attributes.position;
    const index = geometry.index;
    const count = index ? index.count : pos.count;
    for (let i = 0; i + 2 < count; i += 3) {
      _a.fromBufferAttribute(pos, index ? index.getX(i) : i);
      _b.fromBufferAttribute(pos, index ? index.getX(i + 1) : i + 1);
      _c.fromBufferAttribute(pos, index ? index.getX(i + 2) : i + 2);
      if (matrix) {
        _a.applyMatrix4(matrix);
        _b.applyMatrix4(matrix);
        _c.applyMatrix4(matrix);
      }
      this.#push(_a, _b, _c, sid, pid);
    }
    return this;
  }

  /**
   * Todas as malhas de um objeto (e dos filhos) nas matrizes de mundo atuais, numa peça só: props que colidem com a
   * própria forma visual (pote, ferramenta, boneco). Paredes e chão com relevo visual usam caixas.
   */
  object(root, { surface = 'padrao', part = null } = {}) {
    const sid = surfaceIndex(surface);
    const pid = this.#partId(part);
    root.updateWorldMatrix(true, true);
    root.traverse((o) => {
      if (o.isMesh) this.#geometry(o.geometry, o.matrixWorld, sid, pid);
    });
    return this;
  }

  /** Caixa w × h × d centrada na origem do objeto, posta no mundo por `matrix` ou `center`. */
  box(w, h, d, { matrix = null, center = null, surface = 'padrao', part = null } = {}) {
    return this.#box(w, h, d, placement(matrix, center), surfaceIndex(surface), this.#partId(part));
  }

  #box(w, h, d, m, sid, pid) {
    const x0 = -w / 2, x1 = w / 2, y0 = -h / 2, y1 = h / 2, z0 = -d / 2, z1 = d / 2;
    const p = (x, y, z) => new THREE.Vector3(x, y, z).applyMatrix4(m);
    const c000 = p(x0, y0, z0), c100 = p(x1, y0, z0), c010 = p(x0, y1, z0), c110 = p(x1, y1, z0);
    const c001 = p(x0, y0, z1), c101 = p(x1, y0, z1), c011 = p(x0, y1, z1), c111 = p(x1, y1, z1);
    this.#quad(c101, c100, c110, c111, sid, pid); // +X
    this.#quad(c000, c001, c011, c010, sid, pid); // −X
    this.#quad(c011, c111, c110, c010, sid, pid); // +Y
    this.#quad(c000, c100, c101, c001, sid, pid); // −Y
    this.#quad(c001, c101, c111, c011, sid, pid); // +Z
    this.#quad(c100, c000, c010, c110, sid, pid); // −Z
    return this;
  }

  /** Cilindro vertical com base em y = 0 e topo em y = h (no objeto); polígono circunscrito ao círculo de raio r. */
  cylinder(r, h, { segments = 32, matrix = null, center = null, surface = 'padrao', part = null } = {}) {
    const m = placement(matrix, center);
    const sid = surfaceIndex(surface);
    const pid = this.#partId(part);
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
      this.#quad(bottom[i], bottom[j], top[j], top[i], sid, pid);
      this.#push(ct, top[i], top[j], sid, pid);
      this.#push(cb, bottom[j], bottom[i], sid, pid);
    }
    return this;
  }

  /** Rampa (cunha) de largura w em X que sobe de y = 0 em z = 0 até y = h em z = l (no objeto). */
  ramp(w, l, h, { matrix = null, center = null, surface = 'padrao', part = null } = {}) {
    const m = placement(matrix, center);
    const sid = surfaceIndex(surface);
    const pid = this.#partId(part);
    const p = (x, y, z) => new THREE.Vector3(x, y, z).applyMatrix4(m);
    const hw = w / 2;
    const b0 = p(-hw, 0, 0), b1 = p(hw, 0, 0), b2 = p(hw, 0, l), b3 = p(-hw, 0, l);
    const t2 = p(hw, h, l), t3 = p(-hw, h, l);
    this.#quad(b0, t3, t2, b1, sid, pid); // rampa
    this.#quad(b3, b2, t2, t3, sid, pid); // costas
    this.#quad(b0, b1, b2, b3, sid, pid); // fundo
    this.#push(b0, b3, t3, sid, pid); // lado −X
    this.#push(b1, t2, b2, sid, pid); // lado +X
    return this;
  }

  /** Escada maciça de `count` degraus (uma peça): cada um sobe `rise` e avança `run` em +Z; largura w em X. */
  stairs(w, rise, run, count, { matrix = null, center = null, surface = 'padrao', part = null } = {}) {
    const base = placement(matrix, center);
    const sid = surfaceIndex(surface);
    const pid = this.#partId(part);
    for (let i = 0; i < count; i++) {
      const h = (i + 1) * rise;
      const local = new THREE.Matrix4().makeTranslation(0, h / 2, i * run + run / 2);
      this.#box(w, h, run, new THREE.Matrix4().multiplyMatrices(base, local), sid, pid);
    }
    return this;
  }

  /** Triângulos prontos para o CollisionBody. */
  build() {
    return {
      positions: Float64Array.from(this.positions),
      surfaces: Uint8Array.from(this.surfaces),
      parts: Uint32Array.from(this.parts),
    };
  }
}
```

- [ ] **Passo 4: Peças no corpo, chave no mundo e a peça no trace**

Em `src/physics/collisionBody.js`, trocar:

```
// opcional (props que se mexem, paredes que surgem). Depois do build, os triângulos são copiados na ordem final do
// BVH para arrays planos em precisão dupla: a fase estreita lê deles direto, sem objetos por triângulo.

```

por:

```
// opcional (props que se mexem, paredes que surgem). Depois do build, os triângulos são copiados na ordem final do
// BVH para arrays planos em precisão dupla: a fase estreita lê deles direto, sem objetos por triângulo. Cada triângulo
// guarda o material de superfície e a peça do builder (o wall-jump conta cada peça como uma parede).

```

Em `src/physics/collisionBody.js`, trocar:

```
  /**
   * @param {{positions: Float64Array, surfaces: Uint8Array}} data triângulos no espaço do corpo (ColliderBuilder.build())
   * @param {{name?: string, matrix?: THREE.Matrix4}} [opts] `matrix`: corpo → mundo, rígida (escala vem assada)
```

por:

```
  /**
   * @param {{positions: Float64Array, surfaces: Uint8Array, parts?: Uint32Array}} data triângulos no espaço do corpo
   *   (ColliderBuilder.build()); sem `parts`, todos na peça 0
   * @param {{name?: string, matrix?: THREE.Matrix4}} [opts] `matrix`: corpo → mundo, rígida (escala vem assada)
```

Em `src/physics/collisionBody.js`, trocar:

```
    this.id = nextId++;
    this.name = name;
```

por:

```
    this.id = nextId++;
    this.key = 0; // chave no mundo (CollisionWorld.addBody): determinística, ao contrário do id
    this.name = name;
```

Em `src/physics/collisionBody.js`, trocar:

```
    this.surface = new Uint8Array(count);
    for (let i = 0; i < count; i++) {
```

por:

```
    this.surface = new Uint8Array(count);
    this.part = new Uint32Array(count);
    for (let i = 0; i < count; i++) {
```

Em `src/physics/collisionBody.js`, trocar:

```
      this.surface[i] = data.surfaces[src];
    }
```

por:

```
      this.surface[i] = data.surfaces[src];
      this.part[i] = data.parts ? data.parts[src] : 0;
    }
```

Em `src/physics/collisionBody.js`, trocar:

```
    this.tris = null;
  }
```

por:

```
    this.tris = null;
    this.part = null;
  }
```

Em `src/physics/collisionWorld.js`, trocar:

```
    triangle: -1,
  };
```

por:

```
    triangle: -1,
    part: -1, // peça do ColliderBuilder
  };
```

Em `src/physics/collisionWorld.js`, trocar:

```
  dst.triangle = src.triangle;
  return dst;
```

por:

```
  dst.triangle = src.triangle;
  dst.part = src.part;
  return dst;
```

Em `src/physics/collisionWorld.js`, trocar:

```
    this.stats = { sweeps: 0, overlaps: 0, rays: 0, triangles: 0 };
    // Consulta em andamento, no espaço do corpo atual.
```

por:

```
    this.stats = { sweeps: 0, overlaps: 0, rays: 0, triangles: 0 };
    this._nextKey = 1; // chave dos corpos neste mundo (addBody)
    // Consulta em andamento, no espaço do corpo atual.
```

Em `src/physics/collisionWorld.js`, trocar:

```

  addBody(body) {
    this.bodies.push(body);
```

por:

```

  /** Põe o corpo no mundo com a chave seguinte: mundos montados na mesma ordem dão as mesmas chaves. */
  addBody(body) {
    body.key = this._nextKey++;
    this.bodies.push(body);
```

Em `src/physics/collisionWorld.js`, trocar:

```
    out.triangle = -1;
    out.surface = 0;
```

por:

```
    out.triangle = -1;
    out.part = -1;
    out.surface = 0;
```

Em `src/physics/collisionWorld.js`, trocar:

```
      out.triangle = this._tri;
      out.surface = body.surface[this._tri];
      toWorldDir(body, this._hnx, this._hny, this._hnz, out.normal);
      toWorldPoint(body, this._hpx, this._hpy, this._hpz, out.point);
```

por:

```
      out.triangle = this._tri;
      out.surface = body.surface[this._tri];
      out.part = body.part[this._tri];
      toWorldDir(body, this._hnx, this._hny, this._hnz, out.normal);
      toWorldPoint(body, this._hpx, this._hpy, this._hpz, out.point);
```

- [ ] **Passo 5: A sonda de parede**

```js file=src/physics/wallProbe.js
// Sonda de parede do wall-jump (subfase 3.4): a face de parede mais próxima da cápsula a até `reach` além do raio. O
// segmento interno da cápsula (de y + raio a y + altura − raio) é comparado com os triângulos do mundo pelo par de pontos
// mais próximos (closestSegmentTriangle), no mesmo esquema das consultas do CollisionWorld: callbacks do BVH criados uma
// vez, parâmetros em campos da instância, nada aloca por consulta. Parede = normal de contato (do triângulo para a
// cápsula) quase horizontal, |n.y| ≤ maxNormalY: o chão, o teto, a aresta de cima de uma parede (o contato sai
// inclinado) e as rampas não contam. Arquivo próprio: o collisionWorld.js já tem ~580 linhas.

import { INTERSECTED, NOT_INTERSECTED } from 'three-mesh-bvh';
import { TRI_STRIDE, closestSegmentTriangle, createClosest } from './geometryQueries.js';

/** Resultado reutilizável da sonda. */
export function createWallHit() {
  return {
    hit: false,
    distance: 0, // do segmento da cápsula até a parede (u); encostada, fica em raio + folga
    nx: 0, // normal no plano (unitária), da parede para a cápsula
    nz: 0,
    ny: 0, // componente vertical da normal de contato (antes de ir para o plano)
    px: 0, // ponto de contato na parede (mundo)
    py: 0,
    pz: 0,
    body: null,
    part: -1, // peça do ColliderBuilder
    triangle: -1,
    surface: 0,
  };
}

const _c = createClosest();

export class WallProbe {
  /** @param {import('./collisionWorld.js').CollisionWorld} world */
  constructor(world) {
    this.world = world;
    this._tris = null;
    this._m = null; // elementos da matriz corpo → mundo (null se o corpo não gira)
    this._s0x = 0; this._s0y = 0; this._s0z = 0;
    this._s1x = 0; this._s1y = 0; this._s1z = 0;
    this._minX = 0; this._minY = 0; this._minZ = 0;
    this._maxX = 0; this._maxY = 0; this._maxZ = 0;
    this._limit = 0;
    this._maxNy = 0;
    this._found = false;
    this._tri = -1;
    this._nx = 0; this._ny = 0; this._nz = 0; // normal de contato (espaço do corpo)
    this._px = 0; this._py = 0; this._pz = 0; // ponto na parede (espaço do corpo)
    this._cb = {
      intersectsBounds: (box) => (box.min.x <= this._maxX && box.max.x >= this._minX && box.min.y <= this._maxY
        && box.max.y >= this._minY && box.min.z <= this._maxZ && box.max.z >= this._minZ ? INTERSECTED : NOT_INTERSECTED),
      intersectsRange: (offset, count) => this.#range(offset, count),
    };
  }

  /**
   * Parede mais próxima da cápsula (pés em O, raio, altura) a até raio + `reach`, com |n.y| da normal de contato até
   * `maxNormalY`. Escreve em `out`; false se não há.
   */
  probe(ox, oy, oz, radius, height, reach, maxNormalY, out) {
    const world = this.world;
    world.stats.overlaps++;
    const half = height * 0.5;
    const y0 = oy + Math.min(radius, half);
    const y1 = oy + Math.max(height - radius, half);
    out.hit = false;
    out.body = null;
    out.part = -1;
    out.triangle = -1;
    out.surface = 0;
    let best = radius + reach;
    this._maxNy = maxNormalY;
    for (let b = 0; b < world.bodies.length; b++) {
      const body = world.bodies[b];
      this.#setQuery(body, ox, y0, oz, ox, y1, oz);
      const l = best;
      this._minX = Math.min(this._s0x, this._s1x) - l;
      this._minY = Math.min(this._s0y, this._s1y) - l;
      this._minZ = Math.min(this._s0z, this._s1z) - l;
      this._maxX = Math.max(this._s0x, this._s1x) + l;
      this._maxY = Math.max(this._s0y, this._s1y) + l;
      this._maxZ = Math.max(this._s0z, this._s1z) + l;
      const lb = body.localBounds;
      if (lb.min.x > this._maxX || lb.max.x < this._minX || lb.min.y > this._maxY || lb.max.y < this._minY
        || lb.min.z > this._maxZ || lb.max.z < this._minZ) continue;
      this._limit = best;
      this._found = false;
      body.bvh.shapecast(this._cb);
      if (!this._found) continue;
      best = this._limit;
      this.#write(body, out);
      out.distance = best;
    }
    return out.hit;
  }

  /** Segmento da cápsula no espaço do corpo. */
  #setQuery(body, ax, ay, az, bx, by, bz) {
    this._tris = body.tris;
    if (!body.transformed) {
      this._m = null;
      this._s0x = ax; this._s0y = ay; this._s0z = az;
      this._s1x = bx; this._s1y = by; this._s1z = bz;
      return;
    }
    this._m = body.matrix.elements;
    const e = body.inverse.elements;
    this._s0x = e[0] * ax + e[4] * ay + e[8] * az + e[12];
    this._s0y = e[1] * ax + e[5] * ay + e[9] * az + e[13];
    this._s0z = e[2] * ax + e[6] * ay + e[10] * az + e[14];
    this._s1x = e[0] * bx + e[4] * by + e[8] * bz + e[12];
    this._s1y = e[1] * bx + e[5] * by + e[9] * bz + e[13];
    this._s1z = e[2] * bx + e[6] * by + e[10] * bz + e[14];
  }

  /** Contato achado no corpo → resultado em mundo. */
  #write(body, out) {
    const m = this._m;
    let nx = this._nx, ny = this._ny, nz = this._nz;
    let px = this._px, py = this._py, pz = this._pz;
    if (m) {
      const wx = m[0] * nx + m[4] * ny + m[8] * nz;
      const wy = m[1] * nx + m[5] * ny + m[9] * nz;
      const wz = m[2] * nx + m[6] * ny + m[10] * nz;
      nx = wx; ny = wy; nz = wz;
      const qx = m[0] * px + m[4] * py + m[8] * pz + m[12];
      const qy = m[1] * px + m[5] * py + m[9] * pz + m[13];
      const qz = m[2] * px + m[6] * py + m[10] * pz + m[14];
      px = qx; py = qy; pz = qz;
    }
    const h = Math.hypot(nx, nz);
    out.hit = true;
    out.nx = nx / h;
    out.nz = nz / h;
    out.ny = ny;
    out.px = px;
    out.py = py;
    out.pz = pz;
    out.body = body;
    out.triangle = this._tri;
    out.part = body.part[this._tri];
    out.surface = body.surface[this._tri];
  }

  #range(offset, count) {
    const T = this._tris;
    const m = this._m;
    const s0x = this._s0x, s0y = this._s0y, s0z = this._s0z;
    const s1x = this._s1x, s1y = this._s1y, s1z = this._s1z;
    this.world.stats.triangles += count;
    for (let i = offset, end = offset + count; i < end; i++) {
      const o = i * TRI_STRIDE;
      const lim = this._limit;
      // Rejeição pelo plano: as duas pontas do segmento do mesmo lado e além do alcance.
      const fx = T[o + 9], fy = T[o + 10], fz = T[o + 11];
      const e0 = (s0x - T[o]) * fx + (s0y - T[o + 1]) * fy + (s0z - T[o + 2]) * fz;
      const e1 = (s1x - T[o]) * fx + (s1y - T[o + 1]) * fy + (s1z - T[o + 2]) * fz;
      if ((e0 >= lim && e1 >= lim) || (e0 <= -lim && e1 <= -lim)) continue;
      const distSq = closestSegmentTriangle(s0x, s0y, s0z, s1x, s1y, s1z, T, o, _c);
      if (distSq >= lim * lim) continue;
      const dist = Math.sqrt(distSq);
      // Segmento encostado no triângulo (penetração): a normal é ambígua; o controlador desprende no próximo tick.
      if (dist < 1e-6) continue;
      const inv = 1 / dist;
      const nx = (_c.sx - _c.x) * inv, ny = (_c.sy - _c.y) * inv, nz = (_c.sz - _c.z) * inv;
      const wy = m ? m[1] * nx + m[5] * ny + m[9] * nz : ny;
      if (Math.abs(wy) > this._maxNy) continue;
      this._found = true;
      this._limit = dist;
      this._tri = i;
      this._nx = nx; this._ny = ny; this._nz = nz;
      this._px = _c.x; this._py = _c.y; this._pz = _c.z;
    }
    return false;
  }
}
```

- [ ] **Passo 6: Sonda, `raise` e `groundMove` no controlador**

Em `src/physics/characterController.js`, trocar:

```
// Opera sobre o estado de movimento do jogador (src/player/movement.js): pés na origem, velocidade, altura da cápsula,
// chão (normal, superfície, atrito) e `viewOffset` — a subida/descida brusca deste tick que a câmera suaviza.

```

por:

```
// Opera sobre o estado de movimento do jogador (src/player/movement.js): pés na origem, velocidade, altura da cápsula,
// chão (normal, superfície, atrito) e `viewOffset` — a subida/descida brusca deste tick que a câmera suaviza. Guarda
// também a sonda de parede do wall-jump (src/physics/wallProbe.js, subfase 3.4).

```

Em `src/physics/characterController.js`, trocar:

```
import { copyTrace, createTrace } from './collisionWorld.js';

```

por:

```
import { copyTrace, createTrace } from './collisionWorld.js';
import { WallProbe, createWallHit } from './wallProbe.js';

```

Em `src/physics/characterController.js`, trocar:

```
    this._alt = new THREE.Vector3();
    // Lugar livre "com chão" para a busca de espaço livre (criado uma vez: nada aloca por tick).
```

por:

```
    this._alt = new THREE.Vector3();
    this._start = new THREE.Vector3();
    this._dest = new THREE.Vector3();
    // Lugar livre "com chão" para a busca de espaço livre (criado uma vez: nada aloca por tick).
```

Em `src/physics/characterController.js`, trocar:

```
    this.lastContact = { point: new THREE.Vector3(), normal: new THREE.Vector3(), valid: false };
  }
```

por:

```
    this.lastContact = { point: new THREE.Vector3(), normal: new THREE.Vector3(), valid: false };
    // Sonda de parede do wall-jump e o resultado da última consulta.
    this.walls = new WallProbe(world);
    this.wallHit = createWallHit();
  }
```

Em `src/physics/characterController.js`, trocar:

```
  }

  /**
   * CategorizePosition: está no chão? Chão da base chata até 2 u abaixo dos pés, ou atravessado pela base de cima
```

por:

```
  }

  /** Sobe os pés até `dy` u na vertical, até onde a cápsula passar (teto); devolve quanto subiu. */
  raise(s, dy) {
    const o = s.origin;
    this._end.set(o.x, o.y + dy, o.z);
    const tr = this.trace(o, this._end, s, this.trStep);
    if (tr.startSolid || tr.endpos.y <= o.y) return 0;
    const up = tr.endpos.y - o.y;
    o.y = tr.endpos.y;
    return up;
  }

  /**
   * CategorizePosition: está no chão? Chão da base chata até 2 u abaixo dos pés, ou atravessado pela base de cima
```

Em `src/physics/characterController.js`, trocar:

```
  }

  /**
   * StayOnGround: a base chata acompanha o chão que cobre — desce escada e rampa e sobe degrau baixo e rampa (até
```

por:

```
  }

  /**
   * Deslocamento no chão pelo tick com a velocidade atual (o fim do WalkMove): varre direto; se bater, sobe o degrau
   * (stepMove); depois gruda no chão. O andar do CS e o slide usam.
   */
  groundMove(s, dt) {
    const start = this._start.copy(s.origin);
    const dest = this._dest.copy(s.origin).addScaledVector(s.velocity, dt);
    const tr = this.trace(s.origin, dest, s, this.trFirst);
    if (tr.fraction === 1) s.origin.copy(tr.endpos);
    else this.stepMove(s, dt, dest, tr);
    this.stayOnGround(s, Math.hypot(s.origin.x - start.x, s.origin.z - start.z));
  }

  /**
   * StayOnGround: a base chata acompanha o chão que cobre — desce escada e rampa e sobe degrau baixo e rampa (até
```

- [ ] **Passo 7: Rodar os testes da tarefa**

Run: `node --test tests/wallProbe.test.js tests/collisionWorld.test.js tests/characterController.test.js`
Expected: PASS — todos os testes dos três arquivos passando.

- [ ] **Passo 8: Suíte inteira**

Run: `npm test`
Expected: PASS — 219 testes passando.

- [ ] **Passo final: Commit** (só com o pedido do usuário)

```bash
git add src/physics tests/wallProbe.test.js
git commit -m "MASSACRE 3.4: peças de colisão, chave do corpo e sonda de parede" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Tarefa 3: Slide, wall-jump e dano de queda no movimento

**Files:**
- Create: `src/player/vitals.js`, `src/player/slide.js`, `src/player/wallJump.js`, `tests/slide.test.js`, `tests/wallJump.test.js`, `tests/vitals.test.js` (a parte pura; a Tarefa 4 completa)
- Modify: `src/player/movement.js` (arquivo inteiro), `src/player/duck.js`, `src/player/footsteps.js`, `src/core/events.js`, `src/player/playerPawn.js` (só o roteamento dos eventos novos), `tests/tacticalMovement.test.js`, `tests/movementFuzz.test.js`

O coração da subfase, puro e dentro do `playerMove`, na ordem do tick da seção 3.4: relógios (passo 2), botão do slide (6), wall-jump no ar (9), atrito e movimento do slide (10–11), fim do slide (13), sonda de parede (14) e o pouso com o dano (15). O estado de movimento ganha os campos do slide, do wall-jump e o anel das 16 paredes usadas (arrays tipados, copiados no `copyMoveState`); `interruptMoves` encerra o slide e esquece o voo (noclip, teleporte, morte e volta). "Velocidade do item" é o `s.baseSpeed` do estado (mín(260, `sv_maxspeed`, item no modo atual)). O andar do CS passa a mover pelo `groundMove` do controlador e, logo depois de um slide, a velocidade só cai até caber no teto (sem o corte seco). O pouso leva `damage` (a curva do `fallDamage`); quem aplica é o `PlayerPawn` na Tarefa 4.

Dois ajustes fora do movimento mantêm a suíte verde: o teste do "teto duro" da 3.2 corre a 250 u/s e aperta o Ctrl — agora um slide — e passa a rodar com `sv_slide 0`; e o teste de eventos do pawn da 3.2 conta os eventos de agachar, então o `PlayerPawn` já roteia os eventos `slide` e `walljump` para os seus próprios tipos (a Tarefa 4 grava o pawn inteiro). Os 10 min simulados ganham fases de "toques de slide" (1 em 4) para a entrada aleatória deslizar de verdade, contam slides e wall-jumps e comparam o estado novo bit a bit.

- [ ] **Passo 1: Escrever os testes** — slide, wall-jump e a parte pura da vida (curva, quedas do repouso, acumulador, duckbug).

```js file=tests/slide.test.js
// Testes do slide (subfase 3.4) a 64 tick: condições de começo (80% da velocidade do item, Shift, no ar, recarga, spam,
// sv_slide 0, Ctrl + Espaço juntos), impulso de 1,2×, cápsula agachada na hora, 0,6 s com a curva do atrito, soltar
// encerra (levanta se couber), controle lateral sem ganhar velocidade, rampa, saída sem parada seca, pulo com o teto do
// bhop (agachado com o Ctrl seguro), sem passos, recarga de 1 s e os eventos com cada motivo.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DUCK, HULL, MOVE, SLIDE } from '../src/data/movement.js';
import { BTN } from '../src/player/moveCmd.js';
import { MOVETYPE } from '../src/player/movement.js';
import { SLIDE_END } from '../src/player/slide.js';
import { createSvVars } from '../src/player/movementVars.js';
import { floor, worldOf } from './worldTestUtils.js';
import { DT, forward, idle, makePlayer, run, speed2d } from './playerTestUtils.js';

const DEG = Math.PI / 180;
const near = (a, b, eps, msg = '') => assert.ok(Math.abs(a - b) <= eps, `${msg} ${a} ≠ ${b}`);
const ground = () => worldOf((b) => floor(b));

/** Jogador no chão com a velocidade `v` no plano para −z (para onde olha com yaw 0). */
function moving(v, { item = 'knife', sv = createSvVars(), world = ground(), at = [0, 0, 0] } = {}) {
  const p = makePlayer(world, at, { item, sv });
  run(p, 2, idle);
  p.state.velocity.set(0, 0, -v);
  return p;
}

/** Comando: para a frente com os botões dados. */
const hold = (buttons) => (c) => {
  forward(c);
  c.buttons = buttons;
};

const slideEvents = (events, phase) => events.filter((e) => e.type === 'slide' && e.phase === phase);

test('começo: Ctrl apertado correndo a ≥ 80% da velocidade do item no chão; não com Shift, no ar, spam, sv_slide 0 ou pulo', () => {
  const starts = (p, buttons = BTN.DUCK) => slideEvents(run(p, 1, hold(buttons)), 'start').length === 1;
  assert.equal(starts(moving(SLIDE.minSpeed * 250)), true, 'faca a 200 u/s');
  assert.equal(starts(moving(SLIDE.minSpeed * 250 - 0.1)), false, 'faca a 199,9 u/s');
  assert.equal(starts(moving(172, { item: 'ak47' })), true, 'AK a 172 u/s');
  assert.equal(starts(moving(171.9, { item: 'ak47' })), false, 'AK a 171,9 u/s');
  assert.equal(starts(moving(250), BTN.DUCK | BTN.WALK), false, 'com o botão do andar');
  assert.equal(starts(moving(250), BTN.DUCK | BTN.JUMP), false, 'Ctrl + Espaço juntos: o pulo agachado do CS');
  const off = createSvVars();
  off.slide = 0;
  assert.equal(starts(moving(250, { sv: off })), false, 'sv_slide 0');
  const spam = moving(250);
  spam.state.duckSpeed = DUCK.minEnabled + 1; // o aperto tira 2: fica abaixo de 1,5 e o portão ignora
  assert.equal(starts(spam), false, 'agachar travado pelo spam');
  const air = moving(250);
  air.state.velocity.y = 200;
  air.state.onGround = false;
  assert.equal(starts(air), false, 'no ar');
  const held = moving(250);
  run(held, 1, hold(0));
  held.state.oldButtons = BTN.DUCK; // o Ctrl já vinha seguro (pouso com o Ctrl seguro)
  assert.equal(starts(held), false, 'sem o aperto neste tick');
});

test('impulso de 1,2 × o item (faca 300, AK 258); mais rápido fica; cápsula agachada na hora, olho na suavização', () => {
  const p = moving(250);
  const ev = run(p, 1, hold(BTN.DUCK));
  const start = slideEvents(ev, 'start')[0];
  near(start.speed, 300, 1e-9, 'faca');
  near(start.from, 250, 1e-9, 'velocidade antes');
  const s = p.state;
  assert.equal(s.sliding, true);
  assert.equal(s.height, HULL.duckHeight);
  assert.equal(s.ducked && s.duckFlag, true);
  assert.equal(s.duckAmount, 1);
  near(s.viewOffset, HULL.standEye - HULL.duckEye, 1e-9, 'queda do olho (18 u) na suavização');
  assert.ok(ev.some((e) => e.type === 'duck'), 'evento de agachar');
  near(slideEvents(run(moving(215, { item: 'ak47' }), 1, hold(BTN.DUCK)), 'start')[0].speed, 258, 1e-9, 'AK');
  near(slideEvents(run(moving(320), 1, hold(BTN.DUCK)), 'start')[0].speed, 320, 1e-9, 'já mais rápido que 300');
});

test('0,6 s: faca 300 → ~205 u/s em ~151 u; AK 258 → ~176 u/s em ~130 u; acaba no tempo, agachado', () => {
  for (const [item, v0, v1, dist] of [['knife', 250, 204.7, 151.2], ['ak47', 215, 176.1, 130.0]]) {
    const p = moving(v0, { item });
    const ev = run(p, 45, hold(BTN.DUCK));
    const end = slideEvents(ev, 'end')[0];
    assert.equal(end.reason, SLIDE_END.TIME, item);
    near(end.time, 39 * DT, 1e-9, `${item}: 39 ticks (0,609 s)`);
    near(end.exitSpeed, v1, 0.1, `${item}: velocidade de saída`);
    near(end.distance, dist, 0.1, `${item}: distância`);
    near(end.entrySpeed, v0 * 1.2, 1e-9, `${item}: entrada`);
    assert.equal(p.state.sliding, false);
    assert.equal(p.state.ducked, true, 'com o Ctrl seguro, continua agachado');
  }
});

test('soltar o Ctrl encerra; levanta se couber e sob uma trave continua agachado', () => {
  const p = moving(250);
  run(p, 10, hold(BTN.DUCK));
  const ev = run(p, 1, hold(0));
  const end = slideEvents(ev, 'end')[0];
  assert.equal(end.reason, SLIDE_END.RELEASE);
  near(end.time, 10 * DT, 1e-9, 'tempo até soltar');
  assert.equal(p.state.ducked, false, 'cápsula em pé de novo');
  assert.equal(p.state.height, HULL.standHeight);
  // Sob uma laje a 60 u: soltar encerra, mas não levanta.
  const low = worldOf((b) => {
    floor(b);
    b.box(400, 10, 400, { center: [0, 65, -300] });
  });
  const q = moving(250, { world: low });
  run(q, 30, hold(BTN.DUCK));
  assert.equal(q.state.sliding, true);
  assert.ok(q.state.origin.z < -100 - HULL.radius, `deslizou para baixo da laje: ${q.state.origin.z}`);
  run(q, 1, hold(0));
  assert.equal(q.state.sliding, false);
  assert.equal(q.state.ducked, true, 'sob a laje continua agachado');
});

test('controle lateral: vira sem ganhar velocidade (~27°/s a 300 u/s); rampa acelera na descida e freia na subida', () => {
  const straight = moving(250);
  const turning = moving(250);
  run(straight, 1, hold(BTN.DUCK));
  run(turning, 1, hold(BTN.DUCK));
  for (let i = 0; i < 20; i++) {
    run(straight, 1, hold(BTN.DUCK));
    run(turning, 1, (c) => {
      c.forward = 0;
      c.side = 1;
      c.buttons = BTN.DUCK;
    });
    near(speed2d(turning.state), speed2d(straight.state), 1e-9, `tick ${i}: mesmo módulo`);
  }
  const v = turning.state.velocity;
  const turned = Math.atan2(v.x, -v.z) / DEG;
  assert.ok(turned > 7 && turned < 11, `virou ${turned}° em 20 ticks`);
  // Rampa de 20° descendo para −z (sobe em +z): deslizando para −z desce; para +z sobe.
  const ramp = () => worldOf((b) => {
    floor(b);
    b.ramp(400, 1200, 1200 * Math.tan(20 * DEG), { center: [0, 0, -600] });
  });
  const speedAfter = (world, [x, y, z], yaw) => {
    const p = makePlayer(world, [x, y + 10, z], { yaw });
    run(p, 30, idle); // pousa na rampa e assenta
    assert.equal(p.state.onGround, true);
    p.state.velocity.set(-Math.sin(yaw) * 250, 0, -Math.cos(yaw) * 250);
    run(p, 20, hold(BTN.DUCK));
    assert.equal(p.state.sliding, true);
    return speed2d(p.state);
  };
  const y = 900 * Math.tan(20 * DEG);
  const down = speedAfter(ramp(), [0, y, 300], 0);
  const flat = speedAfter(ground(), [0, 0, 0], 0);
  const up = speedAfter(ramp(), [0, 300 * Math.tan(20 * DEG), -300], 180 * DEG);
  assert.ok(down > flat + 50 && up < flat - 50, `descida ${down}, plano ${flat}, subida ${up}`);
});

test('saída sem parada seca: o atrito freia até caber no teto; depois o teto duro volta', () => {
  const p = moving(250);
  const speeds = [];
  let endTick = -1;
  for (let i = 0; i < 60; i++) {
    if (slideEvents(run(p, 1, hold(BTN.DUCK)), 'end').length) endTick = i;
    speeds.push(speed2d(p.state));
  }
  assert.ok(endTick > 0);
  const after = speeds.slice(endTick + 1);
  assert.ok(after[0] > 180, `logo depois do fim: ${after[0]}`);
  for (let i = 1; i < after.length; i++) assert.ok(after[i] <= after[i - 1] + 1e-9, 'só cai');
  const capped = after.findIndex((v) => Math.abs(v - 250 * DUCK.speedMultiplier) < 1e-9);
  assert.ok(capped >= 8 && capped <= 13, `cabe no teto de 85 em ${capped} ticks`);
  assert.equal(p.state.slideExit, false);
});

test('pulo no slide: teto de 286 do bhop, stamina de um pulo, fim do slide; com o Ctrl seguro, pés +9 (pulo agachado)', () => {
  const p = moving(250);
  run(p, 3, hold(BTN.DUCK));
  const before = speed2d(p.state);
  const ev = run(p, 1, hold(BTN.DUCK | BTN.JUMP));
  assert.ok(ev.some((e) => e.type === 'jump'));
  assert.equal(slideEvents(ev, 'end')[0].reason, SLIDE_END.JUMP);
  // O teto do bhop corta a velocidade 3D, com a meia gravidade do tick já na vertical (como no CS).
  const cap = MOVE.bunnyJumpFactor * MOVE.runSpeed;
  near(speed2d(p.state), (cap * before) / Math.hypot(before, p.sv.gravity * 0.5 * DT), 1e-6, 'teto do bhop');
  near(p.state.stamina, 0.08 * p.sv.jump_impulse, 1e-9, 'stamina de um pulo');
  let apex = 0;
  run(p, 40, (c) => {
    hold(BTN.DUCK)(c);
    apex = Math.max(apex, p.state.origin.y);
  });
  assert.ok(apex > 57 + HULL.airDuckLift - 1 && apex < 57 + HULL.airDuckLift + 1, `ápice ${apex}: o do pulo agachado`);
});

test('sem passos no slide (o relógio para e segue depois); recarga de 1 s contada do fim', () => {
  const p = moving(250);
  run(p, 1, hold(BTN.DUCK));
  const timer = p.state.stepTimer;
  const ev = run(p, 30, hold(BTN.DUCK));
  assert.equal(ev.filter((e) => e.type === 'step').length, 0);
  assert.equal(p.state.stepTimer, timer, 'relógio parado');
  // Fim por soltar; a recarga começa a contar dali.
  run(p, 1, hold(0));
  assert.equal(p.state.sliding, false);
  near(p.state.slideCooldown, 1, 1e-9, 'recarga cheia no fim');
  const again = () => {
    p.state.velocity.set(0, 0, -250);
    return slideEvents(run(p, 1, hold(BTN.DUCK)), 'start').length === 1;
  };
  run(p, 30, hold(0));
  assert.equal(again(), false, 'antes de 1 s');
  run(p, 1, hold(0));
  for (let i = 0; i < 40 && p.state.slideCooldown > 0; i++) run(p, 1, hold(0));
  assert.equal(again(), true, 'depois de 1 s');
});

test('fim por parar (parede), por ar demais (beirada alta), interrompido (sv_slide 0, noclip); ar curto continua', () => {
  const wall = worldOf((b) => {
    floor(b);
    b.box(400, 200, 20, { center: [0, 100, -60] });
  });
  const w = moving(250, { world: wall });
  assert.equal(slideEvents(run(w, 20, hold(BTN.DUCK)), 'end')[0].reason, SLIDE_END.STOP, 'bateu na parede');
  // Plataforma de 128 u: deslizando para fora dela, cai mais de 0,35 s.
  const ledge = worldOf((b) => {
    floor(b);
    b.box(400, 128, 400, { center: [0, 64, 0] });
  });
  const l = moving(250, { world: ledge, at: [0, 128, -150] });
  assert.equal(slideEvents(run(l, 40, hold(BTN.DUCK)), 'end')[0].reason, SLIDE_END.AIR, 'caiu da plataforma');
  // Degrau de 20 u para baixo (além do que o chão acompanha): ar curto, o slide segue ao pousar.
  const step = worldOf((b) => {
    floor(b);
    b.box(400, 20, 400, { center: [0, 10, 0] });
  });
  const st = moving(250, { world: step, at: [0, 20, -150] });
  let wasAir = false;
  run(st, 20, (c) => {
    hold(BTN.DUCK)(c);
    if (!st.state.onGround && st.state.sliding) wasAir = true;
  });
  assert.equal(wasAir, true, 'passou pelo ar deslizando');
  assert.equal(st.state.sliding, true, 'continua depois de pousar');
  const sv = createSvVars();
  const off = moving(250, { sv });
  run(off, 3, hold(BTN.DUCK));
  sv.slide = 0;
  assert.equal(slideEvents(run(off, 1, hold(BTN.DUCK)), 'end')[0].reason, SLIDE_END.INTERRUPT, 'sv_slide 0');
  const nc = moving(250);
  run(nc, 3, hold(BTN.DUCK));
  nc.state.moveType = MOVETYPE.NOCLIP;
  assert.equal(slideEvents(run(nc, 1, hold(BTN.DUCK)), 'end')[0].reason, SLIDE_END.INTERRUPT, 'noclip');
});
```

```js file=tests/wallJump.test.js
// Testes do wall-jump (subfase 3.4) a 64 tick: o chute (para onde olha, no mínimo 30° para fora, espelhado olhando para
// a parede; piso na velocidade do item e teto de 286; 289,41 × stamina na vertical e o custo de um pulo), buffer de
// 0,15 s, tolerância de 0,12 s, subida máxima, espera de 0,35 s, a mesma parede só depois do chão (grupo, faces de uma
// caixa, painéis no mesmo plano, facetas do tubo dentro de 45°), sv_walljump 0 e o pulo do CS no chão.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HULL, WALLJUMP } from '../src/data/movement.js';
import { BTN } from '../src/player/moveCmd.js';
import { createSvVars } from '../src/player/movementVars.js';
import { kickDirection } from '../src/player/wallJump.js';
import { floor, worldOf } from './worldTestUtils.js';
import { DT, idle, makePlayer, run, speed2d } from './playerTestUtils.js';

const R = HULL.radius;
const DEG = Math.PI / 180;
const near = (a, b, eps, msg = '') => assert.ok(Math.abs(a - b) <= eps, `${msg} ${a} ≠ ${b}`);
const jump = (c) => {
  idle(c);
  c.buttons = BTN.JUMP;
};
const kicks = (events) => events.filter((e) => e.type === 'walljump');

// Parede alta com a face em x = 100 (normal −x).
const wallWorld = (extra = null) => worldOf((b) => {
  floor(b);
  b.box(8, 2000, 400, { center: [104, 1000, 0], surface: 'madeira' });
  extra?.(b);
});

/**
 * Jogador parado no ar (sv_gravity 0: não cai) com os pés em (x, y, z) e o olhar `yaw`; `v` = velocidade no plano
 * inicial [vx, vz].
 */
function hover(world, [x, y, z], { yaw = 0, item = 'knife', v = [0, 0], gravity = 0 } = {}) {
  const sv = createSvVars();
  sv.gravity = gravity;
  const p = makePlayer(world, [x, y, z], { yaw, item, sv });
  p.state.velocity.set(v[0], 0, v[1]);
  return p;
}

test('o chute: olhando ao longo da parede sai a 30° dela com a velocidade da faca; vertical 289,41 e a stamina de um pulo', () => {
  const p = hover(wallWorld(), [100 - R - 2, 300, 0], { gravity: 800 });
  run(p, 1, idle); // a sonda acha a parede no fim do tick
  assert.equal(p.state.wallTime, 0);
  const ev = kicks(run(p, 1, jump));
  assert.equal(ev.length, 1);
  const e = ev[0];
  near(e.nx, -1, 1e-9, 'normal da parede');
  near(e.speed, 250, 1e-9, 'piso: a velocidade da faca');
  assert.equal(e.count, 1);
  const v = p.state.velocity;
  near(v.x, -250 * Math.sin(30 * DEG), 1e-9, 'para fora da parede');
  near(v.z, -250 * Math.cos(30 * DEG), 1e-9, 'ao longo do olhar');
  near(v.y, p.sv.walljump_up - p.sv.gravity * DT, 1e-9, 'impulso − a gravidade do tick');
  near(p.sv.walljump_up, 301.993377 * (9.2 / 9.6), 1e-9, '0,958 do pulo');
  near(p.state.stamina, p.sv.staminajumpcost * p.sv.walljump_up, 1e-9, 'stamina de um pulo');
  // Com stamina, o impulso cai como o do pulo.
  const q = hover(wallWorld(), [100 - R - 2, 300, 0]);
  run(q, 1, idle);
  q.state.stamina = 50;
  run(q, 1, jump);
  near(q.state.velocity.y, q.sv.walljump_up * (1 - (50 - q.sv.staminarecoveryrate * DT) / 100), 1e-9, 'impulso × (1 − stamina/100)');
});

test('direção: de frente para a parede sai pela normal; ao longo, a 30°; para fora, como olha; em diagonal, espelhada', () => {
  const out = { x: 0, z: 0 };
  const dir = (yawDeg) => kickDirection(yawDeg * DEG, -1, 0, out); // parede com a normal −x (olhar = (−sen yaw, −cos yaw))
  dir(-90); // olhando para +x: de frente para a parede
  near(out.x, -1, 1e-9, 'de frente: pela normal');
  near(out.z, 0, 1e-9, 'de frente: pela normal');
  dir(0); // olhando para −z: ao longo
  near(out.x, -Math.sin(30 * DEG), 1e-9, 'ao longo: 30° para fora');
  near(out.z, -Math.cos(30 * DEG), 1e-9, 'ao longo: 30° para fora');
  dir(60); // olhando 60° para fora da parede (componente para fora sen 60° ≥ sen 30°)
  near(out.x, -Math.sin(60 * DEG), 1e-9, 'para fora: como olha');
  near(out.z, -Math.cos(60 * DEG), 1e-9, 'para fora: como olha');
  dir(-45); // 45° para dentro da parede: espelhado, sai 45° para fora
  near(out.x, -Math.sin(45 * DEG), 1e-9, 'espelhado');
  near(out.z, -Math.cos(45 * DEG), 1e-9, 'espelhado');
  dir(-10); // 10° para dentro: espelhado vira 10° para fora, abaixo do mínimo: 30°
  near(out.x, -Math.sin(30 * DEG), 1e-9, 'mínimo de 30°');
});

test('velocidade no plano: a atual, com piso na do item (faca 250, AK 215) e teto de 286', () => {
  const speedOf = (item, v) => {
    const p = hover(wallWorld(), [100 - R - 2, 300, 0], { item, v: [0, -v] });
    run(p, 1, idle);
    return kicks(run(p, 1, jump))[0].speed;
  };
  near(speedOf('knife', 0), 250, 1e-9, 'faca parada');
  near(speedOf('ak47', 0), 215, 1e-9, 'AK parada');
  near(speedOf('knife', 270), 270, 1e-9, 'mais rápido que o item');
  near(speedOf('knife', 400), 286, 1e-9, 'teto (sv_walljump_maxspeed)');
});

test('buffer de 0,15 s: um aperto no ar vale até 9 ticks depois; tolerância de 0,12 s depois de sair da parede', () => {
  // Aperta longe da parede; k ticks depois o contato aparece (a sonda o acha no fim do tick k − 1).
  const buffered = (k) => {
    const p = hover(wallWorld(), [0, 300, 0]);
    run(p, 1, jump);
    run(p, k - 2, idle);
    p.state.origin.x = 100 - R - 2;
    run(p, 1, idle);
    return kicks(run(p, 1, idle)).length === 1;
  };
  assert.equal(buffered(9), true, 'contato 9 ticks depois do aperto (0,14 s)');
  assert.equal(buffered(10), false, '10 ticks (0,156 s)');
  // Encostado no tick 0, longe a partir do 1; o aperto no tick k vale se a idade do contato (k − 1 ticks) ≤ 0,12 s.
  const grace = (k) => {
    const p = hover(wallWorld(), [100 - R - 2, 300, 0]);
    run(p, 1, idle);
    p.state.origin.x = 0;
    run(p, k - 1, idle);
    return kicks(run(p, 1, jump)).length === 1;
  };
  assert.equal(grace(8), true, 'contato de 7 ticks atrás (0,109 s)');
  assert.equal(grace(9), false, 'contato de 8 ticks atrás (0,125 s)');
});

test('subida máxima: logo depois do pulo do chão não vale; abaixo de 220,2 u/s vale', () => {
  const p = makePlayer(wallWorld(), [100 - R - 0.5, 0, 0]);
  run(p, 2, idle);
  run(p, 1, jump); // pulo do CS, colado na parede
  assert.equal(p.state.onGround, false);
  let kickVy = null;
  for (let i = 0; i < 20 && kickVy === null; i++) {
    const vy = p.state.velocity.y;
    if (kicks(run(p, 1, i % 2 ? jump : idle)).length) kickVy = vy - p.sv.gravity * 0.5 * DT;
  }
  assert.ok(kickVy !== null, 'houve wall-jump');
  assert.ok(kickVy <= WALLJUMP.maxRise * p.sv.jump_impulse && kickVy > WALLJUMP.maxRise * p.sv.jump_impulse - 13,
    `subida no chute ${kickVy}`);
});

test('espera de 0,35 s entre wall-jumps; a mesma parede só depois do chão', () => {
  // Duas paredes: a face em x = 100 e outra em x = −100 (normal +x).
  const world = wallWorld((b) => b.box(8, 2000, 400, { center: [-104, 1000, 0] }));
  const p = hover(world, [100 - R - 2, 300, 0]);
  run(p, 1, idle);
  assert.equal(kicks(run(p, 1, jump)).length, 1);
  const kicked = p.cmd.tick;
  p.state.origin.x = -100 + R + 2; // encostado na outra parede
  p.state.velocity.set(0, 0, 0);
  let second = null;
  for (let i = 0; i < 40 && second === null; i++) {
    if (kicks(run(p, 1, i % 2 ? idle : jump)).length) second = p.cmd.tick - kicked;
  }
  assert.ok(second >= Math.ceil(WALLJUMP.cooldown / DT) && second <= Math.ceil(WALLJUMP.cooldown / DT) + 1,
    `segundo wall-jump ${second} ticks depois (espera de 0,35 s = 22,4 ticks)`);
  // De volta à primeira: já usada neste voo.
  p.state.origin.x = 100 - R - 2;
  p.state.velocity.set(0, 0, 0);
  let again = 0;
  for (let i = 0; i < 60; i++) again += kicks(run(p, 1, i % 2 ? idle : jump)).length;
  assert.equal(again, 0, 'a mesma parede no mesmo voo');
  assert.equal(p.state.wallJumps, 2);
  // No chão a lista zera: pulando de novo, a primeira volta a valer.
  p.sv.gravity = 800;
  for (let i = 0; i < 200 && !p.state.onGround; i++) run(p, 1, idle);
  assert.equal(p.state.onGround, true);
  assert.equal(p.state.usedCount, 0);
  assert.equal(p.state.wallJumps, 0);
  run(p, 1, jump);
  let ok = 0;
  for (let i = 0; i < 40; i++) ok += kicks(run(p, 1, i % 2 ? jump : idle)).length;
  assert.equal(ok, 1, 'depois do chão, de novo');
});

/** Chuta de uma parede em (x, z) com a normal (nx, nz) e depois tenta outra; true se o segundo chute saiu. */
function secondKick(world, first, other) {
  const p = hover(world, first, { yaw: 0 });
  run(p, 1, idle);
  assert.equal(kicks(run(p, 1, jump)).length, 1, 'primeiro chute');
  p.state.wallJumpCooldown = 0; // só a regra da parede usada importa aqui
  p.state.origin.set(other[0], other[1], other[2]);
  p.state.velocity.set(0, 0, 0);
  run(p, 1, idle);
  return kicks(run(p, 1, jump)).length === 1;
}

test('"a mesma parede": grupo = uma; faces de uma caixa e painéis separados no mesmo plano = diferentes; tubo dentro de 45°', () => {
  const y = 300;
  const x = 100 - R - 2;
  const group = worldOf((b) => {
    floor(b);
    b.box(8, 2000, 200, { center: [104, 1000, -100], part: 'g' });
    b.box(8, 2000, 200, { center: [104, 1000, 100], part: 'g' });
  });
  assert.equal(secondKick(group, [x, y, -100], [x, y, 100]), false, 'grupo: uma parede só');
  const panels = worldOf((b) => {
    floor(b);
    b.box(8, 2000, 200, { center: [104, 1000, -100] });
    b.box(8, 2000, 200, { center: [104, 1000, 100] });
  });
  assert.equal(secondKick(panels, [x, y, -100], [x, y, 100]), true, 'painéis separados no mesmo plano');
  // Pilar 200 × 200: a face oeste (normal −x) e a face sul (normal +z) são paredes diferentes da mesma peça.
  const pillar = worldOf((b) => {
    floor(b);
    b.box(200, 2000, 200, { center: [200, 1000, 0] });
  });
  assert.equal(secondKick(pillar, [100 - R - 2, y, 0], [200, y, 100 + R + 2]), true, 'faces da caixa');
  // Tubo de raio 200 (32 facetas): 30° adiante é a mesma parede, 60° adiante não.
  const tube = () => worldOf((b) => {
    floor(b);
    b.cylinder(200, 2000, { segments: 32 });
  });
  const around = (deg) => [Math.cos(deg * DEG) * (200 + R + 2), y, -Math.sin(deg * DEG) * (200 + R + 2)];
  assert.equal(secondKick(tube(), around(0), around(30)), false, 'tubo: 30° adiante');
  assert.equal(secondKick(tube(), around(0), around(60)), true, 'tubo: 60° adiante');
});

test('sv_walljump 0 não chuta; no chão, colado na parede, o Espaço é o pulo do CS', () => {
  const p = hover(wallWorld(), [100 - R - 2, 300, 0]);
  p.sv.walljump = 0;
  run(p, 1, idle);
  assert.equal(kicks(run(p, 4, (c, i) => (i % 2 ? idle(c) : jump(c)))).length, 0);
  const g = makePlayer(wallWorld(), [100 - R - 0.5, 0, 0]);
  run(g, 2, idle);
  const ev = run(g, 1, jump);
  assert.equal(ev.filter((e) => e.type === 'jump').length, 1);
  assert.equal(kicks(ev).length, 0);
  assert.ok(speed2d(g.state) < 1e-9, 'o pulo do chão não empurra para fora da parede');
});
```

```js file=tests/vitals.test.js
// Testes da vida e do dano de queda (subfase 3.4): a curva do CS:GO sobre o limite seguro de 420 u (e as quedas do
// repouso no controlador real), sv_falldamage_scale, o acumulador de dano fracionário (com god, morto e tipo
// desconhecido) e o duckbug sem dano.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FALL, HULL } from '../src/data/movement.js';
import { VITALS } from '../src/data/vitals.js';
import { BTN } from '../src/player/moveCmd.js';
import { createSvVars } from '../src/player/movementVars.js';
import {
  applyDamage, createVitals, fallDamage, killVitals, readyToRespawn, respawnVitals,
} from '../src/player/vitals.js';
import { floor, worldOf } from './worldTestUtils.js';
import { idle, makePlayer, run } from './playerTestUtils.js';

const near = (a, b, eps, msg = '') => assert.ok(Math.abs(a - b) <= eps, `${msg} ${a} ≠ ${b}`);
const ground = () => worldOf((b) => floor(b));

test('dano de queda: nada até 819,756 u/s (420 u); linear até 1413,373 u/s na razão do CS:GO; × sv_falldamage_scale', () => {
  const sv = createSvVars();
  near(FALL.safeSpeed, Math.sqrt(2 * 800 * 420), 1e-12, 'limite seguro');
  near(FALL.fatalSpeed / FALL.safeSpeed, 1000 / 580, 1e-12, 'razão do CS:GO');
  assert.equal(fallDamage(FALL.safeSpeed, sv), 0);
  assert.equal(fallDamage(500, sv), 0);
  near(fallDamage(FALL.fatalSpeed, sv), 100, 1e-9, 'fatal');
  near(fallDamage((FALL.safeSpeed + FALL.fatalSpeed) / 2, sv), 50, 1e-9, 'meio do caminho');
  near(fallDamage(FALL.safeSpeed + 1, sv), 100 / (FALL.fatalSpeed - FALL.safeSpeed), 1e-12, '0,1685 por u/s');
  sv.falldamage_scale = 0;
  assert.equal(fallDamage(1300, sv), 0, 'escala 0 desliga');
  sv.falldamage_scale = 2;
  near(fallDamage(FALL.fatalSpeed, sv), 200, 1e-9, 'escala 2');
});

test('quedas do repouso no chão plano: 200 → 0, 420 → 0, 430 → 0,88, 600 → 26,15, 900 → 61,95, 1250 → 99,85, 1310 → 104,06', () => {
  const world = ground();
  const expected = [[200, 0], [420, 0], [430, 0.88], [600, 26.15], [900, 61.95], [1200, 93.54], [1250, 99.85], [1310, 104.06]];
  for (const [h, dmg] of expected) {
    const p = makePlayer(world, [0, h, 0]);
    const land = run(p, 200, idle).find((e) => e.type === 'land');
    assert.ok(land, `pouso da queda de ${h}`);
    near(land.damage, dmg, 0.005, `queda de ${h} u (pouso a ${land.speed} u/s)`);
  }
});

test('acumulador: a parte inteira sai agora e a fração junta até completar 1; god, morto e tipo desconhecido', () => {
  const v = createVitals();
  const r = applyDamage(v, 0.88, 'queda');
  assert.equal(r.taken, 0);
  assert.equal(v.health, 100);
  near(v.accumulator, 0.88, 1e-12, 'guardou a fração');
  assert.equal(applyDamage(v, 26.15, 'queda').taken, 27, '26 + a fração que completou 1');
  near(v.accumulator, 0.03, 1e-9, 'sobra');
  assert.equal(v.health, 73);
  assert.equal(v.lastKind, 'queda');
  assert.equal(applyDamage(v, 50, 'mundo', { god: true }).taken, 0, 'god');
  assert.equal(v.health, 73);
  const dead = applyDamage(v, 80, 'mundo', { cause: 'mundo' });
  assert.equal(dead.killed, true);
  assert.equal(v.alive, false);
  assert.equal(v.health, 0, 'vida nunca abaixo de 0');
  assert.equal(v.cause, 'mundo');
  assert.equal(v.deaths, 1);
  assert.equal(applyDamage(v, 10, 'queda').taken, 0, 'morto não toma dano');
  assert.equal(killVitals(v, 'kill'), false, 'já estava morto');
  assert.throws(() => applyDamage(v, 1, 'lava'), /desconhecido/);
  assert.equal(readyToRespawn(v), false);
  v.deadTime = VITALS.respawnDelay;
  assert.equal(readyToRespawn(v), true);
  respawnVitals(v);
  assert.deepEqual([v.health, v.alive, v.accumulator, v.cause, v.deaths], [100, true, 0, null, 1]);
});

test('duckbug: o pouso de dentro do agachar não passa pelo pouso — sem dano, como no CS', () => {
  const p = makePlayer(ground(), [0, 10, 0]);
  const s = p.state;
  Object.assign(s, { ducked: true, duckFlag: true, duckAmount: 1, height: HULL.duckHeight, oldButtons: BTN.DUCK });
  s.velocity.set(0, -1300, 0);
  const events = run(p, 1, idle);
  assert.ok(s.onGround, 'pousou pelo levantar');
  assert.ok(!events.some((e) => e.type === 'land'), 'sem pouso, sem dano');
});
```

O "teto duro" da 3.2 sem o slide, e os 10 min simulados com slides e wall-jumps:

Em `tests/tacticalMovement.test.js`, trocar:

```
test('teto duro: agachando a velocidade segue o teto até 85; o primeiro tick depois do pouso já freia', () => {
  const p = ticksTo(250).p;
  const s = p.state;
```

por:

```
test('teto duro: agachando a velocidade segue o teto até 85; o primeiro tick depois do pouso já freia', () => {
  // O agachar do CS correndo: sem o slide da 3.4 (sv_slide 0), que tomaria o aperto do Ctrl a 250 u/s.
  const sv = createSvVars();
  sv.slide = 0;
  const p = ticksTo(250, { sv }).p;
  const s = p.state;
```

Em `tests/movementFuzz.test.js`, trocar:

```
// Aceite "nenhum atravessamento de parede em 10 min" automatizado (Fases 3.1 e 3.2): 38.400 ticks de entrada
// aleatória — com andar, spam de agachar, pulos (stamina) e troca do item na mão (velocidades de 100 a 250, sniper
// lenta) —, empurrões de até 3500 u/s, paredes de 0,5 a 2 u dividindo a sala em células e um painel em movimento. A
// célula do jogador nunca muda, ele nunca fica penetrando nada nem preso. Depois, a mesma seed repetida dá o mesmo
// estado inteiro, bit a bit.
import { test } from 'node:test';
```

por:

```
// Aceite "nenhum atravessamento de parede em 10 min" automatizado (Fases 3.1, 3.2 e 3.4): 38.400 ticks de entrada
// aleatória — com andar, spam de agachar, pulos (stamina), slides, wall-jumps e troca do item na mão (velocidades de 100
// a 250, sniper lenta) —, empurrões de até 3500 u/s, paredes de 0,5 a 2 u dividindo a sala em células e um painel em
// movimento. A célula do jogador nunca muda, ele nunca fica penetrando nada nem preso. Depois, a mesma seed repetida dá
// o mesmo estado inteiro, bit a bit (com o slide e o wall-jump).
import { test } from 'node:test';
```

Em `tests/movementFuzz.test.js`, trocar:

```
    maxSpeed: 0, jumps: 0, kicks: 0, groundTicks: 0, duckTicks: 0, walkTicks: 0, blockedDucks: 0, items: new Set(),
    maxStamina: 0,
  };
```

por:

```
    maxSpeed: 0, jumps: 0, kicks: 0, groundTicks: 0, duckTicks: 0, walkTicks: 0, blockedDucks: 0, items: new Set(),
    maxStamina: 0, slides: 0, wallJumps: 0,
  };
```

Em `tests/movementFuzz.test.js`, trocar:

```
  let walkRate = 0;
  for (let i = 0; i < ticks; i++) {
```

por:

```
  let walkRate = 0;
  let slideTaps = false; // Ctrl seguro 24 ticks a cada 48 (um aperto limpo por ciclo: slides quando corre)
  for (let i = 0; i < ticks; i++) {
```

Em `tests/movementFuzz.test.js`, trocar:

```
      walkRate = rng.pick([0, 0, 1]);
      const [item, zoom] = rng.pick(ITEMS);
```

por:

```
      walkRate = rng.pick([0, 0, 1]);
      // Fase de slides (1 em 4): corre para a frente quase reto e aperta o Ctrl uma vez a cada 48 ticks.
      slideTaps = rng.bool(0.25);
      if (slideTaps) {
        p.cmd.forward = 1;
        p.cmd.side = 0;
        turn = rng.float(-1, 1);
        jumpRate = 0;
        walkRate = 0;
      }
      const [item, zoom] = rng.pick(ITEMS);
```

Em `tests/movementFuzz.test.js`, trocar:

```
    p.cmd.yaw += turn * DT;
    p.cmd.buttons = (rng.bool(jumpRate) ? BTN.JUMP : 0) | (rng.bool(duckRate) ? BTN.DUCK : 0)
      | (rng.bool(walkRate) ? BTN.WALK : 0);
    // Empurrão (explosão, lançamento): até 3500 u/s em qualquer direção, inclusive direto contra as paredes.
```

por:

```
    p.cmd.yaw += turn * DT;
    const duck = slideTaps ? i % 48 < 24 : rng.bool(duckRate);
    p.cmd.buttons = (rng.bool(jumpRate) ? BTN.JUMP : 0) | (duck ? BTN.DUCK : 0) | (rng.bool(walkRate) ? BTN.WALK : 0);
    // Empurrão (explosão, lançamento): até 3500 u/s em qualquer direção, inclusive direto contra as paredes.
```

Em `tests/movementFuzz.test.js`, trocar:

```
    stats.maxStamina = Math.max(stats.maxStamina, s.stamina);
    for (const e of p.env.events) if (e.type === 'jump') stats.jumps++;
    if (!check) continue;
```

por:

```
    stats.maxStamina = Math.max(stats.maxStamina, s.stamina);
    for (const e of p.env.events) {
      if (e.type === 'jump') stats.jumps++;
      else if (e.type === 'slide' && e.phase === 'start') stats.slides++;
      else if (e.type === 'walljump') stats.wallJumps++;
    }
    if (!check) continue;
```

Em `tests/movementFuzz.test.js`, trocar:

```
  assert.ok(stats.maxStamina > 20, `stamina ${stats.maxStamina}`);
  assert.equal(stats.items.size, ITEMS.length, 'todos os itens passaram pela mão');
```

por:

```
  assert.ok(stats.maxStamina > 20, `stamina ${stats.maxStamina}`);
  assert.ok(stats.slides > 20, `slides ${stats.slides}`);
  assert.ok(stats.wallJumps > 20, `wall-jumps ${stats.wallJumps}`);
  assert.equal(stats.items.size, ITEMS.length, 'todos os itens passaram pela mão');
```

Em `tests/movementFuzz.test.js`, trocar:

```
  assert.equal(snapshot(a), snapshot(b));
  for (const key of ['duckSpeed', 'stamina', 'stepTimer', 'sinceDuck', 'walkFactor', 'staminaFactor', 'duckFactor']) {
    assert.ok(key in a, `o estado tem ${key}`);
```

por:

```
  assert.equal(snapshot(a), snapshot(b));
  for (const key of [
    'duckSpeed', 'stamina', 'stepTimer', 'sinceDuck', 'walkFactor', 'staminaFactor', 'duckFactor',
    'sliding', 'slideCooldown', 'jumpBuffer', 'wallTime', 'usedCount', 'usedBody',
  ]) {
    assert.ok(key in a, `o estado tem ${key}`);
```

- [ ] **Passo 2: Rodar e ver falhar**

Run: `node --test tests/slide.test.js tests/wallJump.test.js tests/vitals.test.js tests/movementFuzz.test.js`
Expected: FAIL — `slide`, `wallJump` e `vitals` não carregam (`ERR_MODULE_NOT_FOUND`: `src/player/slide.js`, `src/player/wallJump.js`, `src/player/vitals.js`); nos 10 min simulados, `slides 0` e o estado sem `sliding`.

- [ ] **Passo 3: Agachar na hora** (o começo do slide agacha sem a transição; a queda do olho vai para a suavização).

Em `src/player/duck.js`, trocar:

```
// os pés ±9), o FL_DUCKING (`duckFlag`: vale como agachado para a precisão, os passos e o andar) e o corte do teto de
// velocidade. Opera sobre o estado de movimento (src/player/movement.js) com as consultas do CharacterController.

```

por:

```
// os pés ±9), o FL_DUCKING (`duckFlag`: vale como agachado para a precisão, os passos e o andar) e o corte do teto de
// velocidade. Opera sobre o estado de movimento (src/player/movement.js) com as consultas do CharacterController. O
// slide (subfase 3.4) agacha na hora pelo snapDuck.

```

Em `src/player/duck.js`, trocar:

```

/** FinishUnDuck: transição encerrada em pé. Recategoriza: levantar no ar pode pousar ali mesmo (o duckbug do CS:GO). */
```

por:

```

/**
 * Agachar na hora, no chão (começo do slide): cápsula agachada, agachar completo e FL_DUCKING, sem a transição. A queda
 * do olho vai para `s.viewOffset` e a câmera suaviza, como na troca de cápsula no ar.
 */
export function snapDuck(s, env) {
  const eye0 = eyeHeight(s);
  const wasDucked = s.ducked && s.duckAmount >= 1;
  s.ducking = false;
  s.ducked = true;
  s.height = HULL.duckHeight;
  s.duckFlag = true;
  s.duckAmount = 1;
  s.sinceDuck = 0;
  s.viewOffset -= eyeHeight(s) - eye0;
  if (!wasDucked) env.events.push({ type: 'duck' });
}

/** FinishUnDuck: transição encerrada em pé. Recategoriza: levantar no ar pode pousar ali mesmo (o duckbug do CS:GO). */
```

- [ ] **Passo 4: Sem passos no slide**

Em `src/player/footsteps.js`, trocar:

```
// engatado; os passos silenciosos também saem, marcados, para as pegadas da 3.5. Diferença do CS: lá o relógio para
// enquanto o passo é silencioso; aqui continua contando. Eventos no `env.events` do playerMove.

```

por:

```
// engatado; os passos silenciosos também saem, marcados, para as pegadas da 3.5. Diferença do CS: lá o relógio para
// enquanto o passo é silencioso; aqui continua contando. No slide (subfase 3.4) não há passo: o relógio fica parado e
// segue de onde estava depois. Eventos no `env.events` do playerMove.

```

Em `src/player/footsteps.js`, trocar:

```
export function updateSteps(s, env) {
  const v = s.velocity;
```

por:

```
export function updateSteps(s, env) {
  if (s.sliding) return;
  const v = s.velocity;
```

- [ ] **Passo 5: Vida pura** — `fallDamage` (a curva sobre o limite seguro), `applyDamage` com o acumulador e `god`, morte, volta e o relógio do morto.

```js file=src/player/vitals.js
// Vida do jogador (subfase 3.4): vida inteira com o acumulador de dano fracionário do Source
// (CBaseCombatCharacter::OnTakeDamage_Alive: a parte inteira sai agora e a fração junta até completar 1), dano por tipo
// (src/data/vitals.js: nenhum dos da 3.4 passa pelo colete), morte com causa, volta ao jogo e o dano de queda do CS:GO
// (CheckFalling + FlPlayerFallDamage) com o limite seguro de ~420 u da seção 0.6. Puro: o PlayerPawn aplica e publica
// os eventos. O dano das armas e a fórmula do colete entram na Fase 4.

import { FALL } from '../data/movement.js';
import { DAMAGE, VITALS } from '../data/vitals.js';

/** Estado da vida: dados simples (a rede serializa, a predição copia). */
export function createVitals() {
  return {
    health: VITALS.maxHealth,
    alive: true,
    accumulator: 0, // fração de dano guardada (m_flDamageAccumulator)
    lastAmount: 0, // último dano como veio (antes do acumulador)
    lastKind: null, // tipo do último dano
    lastTaken: 0, // vida que o último dano tirou
    deaths: 0,
    cause: null, // causa da última morte (src/data/vitals.js, DEATH_CAUSES)
    deadTime: 0, // s desde a morte
  };
}

/**
 * Dano de queda do CS:GO para a velocidade de queda do pouso (u/s): nada até o limite seguro (FALL.safeSpeed, a queda
 * de 420 u); depois linear, com o dano cheio (FALL.fatalDamage) em FALL.fatalSpeed, × sv_falldamage_scale.
 */
export function fallDamage(speed, sv) {
  if (!(speed > FALL.safeSpeed)) return 0;
  const k = (speed - FALL.safeSpeed) / (FALL.fatalSpeed - FALL.safeSpeed);
  return k * FALL.fatalDamage * sv.falldamage_scale;
}

/** Morte na hora (kill do console, cair para fora do set): vida 0 e a causa. false se já estava morto. */
export function killVitals(v, cause) {
  if (!v.alive) return false;
  v.health = 0;
  v.alive = false;
  v.cause = cause;
  v.deadTime = 0;
  v.deaths++;
  return true;
}

/**
 * Aplica `amount` de dano do tipo `kind`. Com `god`, morto ou sem dano, nada. A parte inteira sai da vida agora; a fração
 * vai para o acumulador e, ao completar 1, sai 1 a mais. Vida ≤ 0 mata com `cause` (padrão: o tipo). Escreve em `out`
 * { taken: vida que saiu, killed } e o devolve.
 */
export function applyDamage(v, amount, kind, { god = false, cause = kind } = {}, out = { taken: 0, killed: false }) {
  if (!DAMAGE[kind]) throw new Error(`tipo de dano desconhecido: ${kind}`);
  out.taken = 0;
  out.killed = false;
  if (!v.alive || god || !(amount > 0)) return out;
  const whole = Math.floor(amount);
  let taken = whole;
  v.accumulator += amount - whole;
  if (v.accumulator >= 1) {
    taken += 1;
    v.accumulator -= 1;
  }
  v.lastAmount = amount;
  v.lastKind = kind;
  v.lastTaken = taken;
  if (taken <= 0) return out;
  v.health -= taken;
  out.taken = taken;
  if (v.health <= 0) out.killed = killVitals(v, cause);
  return out;
}

/** Volta ao jogo: vida cheia e acumulador zerado (o último dano e as mortes ficam para o debug). */
export function respawnVitals(v) {
  v.health = VITALS.maxHealth;
  v.alive = true;
  v.accumulator = 0;
  v.cause = null;
  v.deadTime = 0;
  return v;
}

/** Morto há tempo suficiente para voltar (VITALS.respawnDelay)? */
export function readyToRespawn(v) {
  return !v.alive && v.deadTime >= VITALS.respawnDelay - 1e-9;
}
```

- [ ] **Passo 6: Slide** — começo (no chão, aperto aceito pelo portão do agachar, sem pulo nem andar, ≥ 80% do item, recarga vencida), impulso, atrito sem o piso do `sv_stopspeed`, controle lateral que não acelera, gravidade na rampa, pulo (com o Ctrl seguro, os pés +9 por `raise`) e os fins com os motivos.

```js file=src/player/slide.js
// Slide (subfase 3.4; seção 0.6: "correr + agachar, dura ~0,6 s, com cooldown"). Começa com o Ctrl apertado correndo
// no chão; desliza agachado com atrito baixo, controle lateral leve e a gravidade das rampas; acaba ao soltar o Ctrl,
// no tempo, abaixo da velocidade do agachado, no pulo ou com tempo demais no ar. Números da referência (o slide do
// Doodle District) na escala do CS em src/data/movement.js (SLIDE e as sv_slide_*); desenho em docs/phases/phase-3.md,
// seção 3.4. Funções puras sobre o estado de movimento (src/player/movement.js), chamadas pelo playerMove na ordem do
// tick. "Velocidade do item" = s.baseSpeed: a do item na mão no modo atual, com o teto de 260 e do sv_maxspeed.

import { HULL, SLIDE } from '../data/movement.js';
import { snapDuck } from './duck.js';
import { BTN } from './moveCmd.js';

/** Motivos do fim do slide (evento `slide`, fase `end`). */
export const SLIDE_END = Object.freeze({
  RELEASE: 'soltou', TIME: 'tempo', STOP: 'parou', JUMP: 'pulo', AIR: 'ar', INTERRUPT: 'interrompido',
});

/**
 * Pode começar neste tick (passo 6)? No chão, parado de deslizar, com a recarga vencida e sv_slide 1; o Ctrl apertado
 * agora (o bit cru subiu) e aceito pelo portão do spam; sem o andar (Shift) e sem o pulo — Ctrl + Espaço juntos é o
 * pulo agachado do CS —; e a velocidade no plano ≥ SLIDE.minSpeed × a velocidade do item.
 */
export function canStartSlide(s, cmd, env) {
  if (!env.sv.slide || s.sliding || !s.onGround || s.slideCooldown > 0) return false;
  const b = cmd.buttons;
  if (!(b & BTN.DUCK) || (s.oldButtons & BTN.DUCK) || !s.duckHeld) return false;
  if ((b & BTN.JUMP) || (b & BTN.WALK) || s.walking) return false;
  const speed = Math.hypot(s.velocity.x, s.velocity.z);
  return speed > 0 && speed >= SLIDE.minSpeed * s.baseSpeed;
}

/** Começo: a velocidade no plano sobe para no mínimo sv_slide_speed × a do item e a cápsula agacha na hora. */
export function startSlide(s, env) {
  const v = s.velocity;
  const from = Math.hypot(v.x, v.z);
  const boost = env.sv.slide_speed * s.baseSpeed;
  if (from < boost) {
    const k = boost / from;
    v.x *= k;
    v.z *= k;
  }
  s.sliding = true;
  s.slideTime = 0;
  s.slideAir = 0;
  s.slideDistance = 0;
  s.slideExit = false;
  s.slideStartSpeed = Math.hypot(v.x, v.z);
  snapDuck(s, env);
  env.events.push({ type: 'slide', phase: 'start', speed: s.slideStartSpeed, from, surface: s.groundSurface });
}

/**
 * Fim do slide com o motivo: a recarga (sv_slide_cooldown) começa a contar; no chão começa a saída sem parada seca (o
 * atrito do CS freia até a velocidade caber no teto do tick, no lugar do corte duro).
 */
export function endSlide(s, env, reason) {
  if (!s.sliding) return;
  s.sliding = false;
  s.slideCooldown = env.sv.slide_cooldown;
  s.slideExit = s.onGround;
  s.slideAir = 0;
  env.events.push({
    type: 'slide', phase: 'end', reason, time: s.slideTime, distance: s.slideDistance,
    entrySpeed: s.slideStartSpeed, exitSpeed: Math.hypot(s.velocity.x, s.velocity.z),
  });
}

/** Passo 6: deslizando, soltar o Ctrl encerra (o agachar do passo 7 levanta se couber); senão, tenta começar. */
export function checkSlideButton(s, cmd, env) {
  if (s.sliding) {
    if (!s.duckHeld) endSlide(s, env, SLIDE_END.RELEASE);
    return;
  }
  if (canStartSlide(s, cmd, env)) startSlide(s, env);
}

/**
 * Atrito do slide (passo 10, no chão): o do CS com sv_slide_friction × sv_friction × atrito da superfície e sem o piso
 * do sv_stopspeed — a velocidade cai na mesma proporção a cada tick.
 */
export function slideFriction(s, sv, dt) {
  const v = s.velocity;
  const speed = v.length();
  if (speed < 0.1) return;
  const drop = speed * sv.slide_friction * sv.friction * s.surfaceFriction * dt;
  v.multiplyScalar(Math.max(speed - drop, 0) / speed);
}

/**
 * Movimento no chão durante o slide (passo 11), no lugar da aceleração e do teto duro do CS: o desejo (`wishDir`, com
 * a fração do analógico `amount`) empurra até SLIDE.steer × a velocidade do item por segundo e a velocidade volta ao
 * módulo de antes — girar não acelera —; a gravidade no plano da rampa acelera na descida e freia na subida; o
 * deslocamento é o do andar (varredura, degrau e grudar no chão).
 */
export function slideMove(s, wishDir, amount, env) {
  const { controller: ctl, sv, dt } = env;
  const v = s.velocity;
  v.y = 0;
  const speed = Math.hypot(v.x, v.z);
  if (amount > 0 && speed > 0) {
    const push = SLIDE.steer * s.baseSpeed * amount * dt;
    v.x += wishDir.x * push;
    v.z += wishDir.z * push;
    const len = Math.hypot(v.x, v.z);
    if (len > 1e-6) {
      v.x *= speed / len;
      v.z *= speed / len;
    }
  }
  const n = s.groundNormal;
  const g = sv.gravity * n.y * dt;
  v.x += n.x * g;
  v.z += n.z * g;
  const x0 = s.origin.x;
  const z0 = s.origin.z;
  ctl.groundMove(s, dt);
  s.slideDistance += Math.hypot(s.origin.x - x0, s.origin.z - z0);
}

/**
 * Pulo no slide (passo 9, logo depois do pulo do CS, que já cortou o embalo no teto do bhop): o slide acaba e, com o
 * Ctrl seguro, os pés sobem HULL.airDuckLift na hora — o pulo agachado do CS (agachar no ar levanta os pés 9 u), que a
 * cápsula já agachada do slide não faria sozinha. A subida vai para a suavização da câmera.
 */
export function slideJump(s, cmd, env) {
  if ((cmd.buttons & BTN.DUCK) && s.ducked) s.viewOffset -= env.controller.raise(s, HULL.airDuckLift);
  endSlide(s, env, SLIDE_END.JUMP);
}

/**
 * Passo 13: o tempo do slide anda e ele acaba com sv_slide 0 (`interrompido`), abaixo da velocidade do agachado
 * (`parou`), com mais de SLIDE.airTime seguidos no ar (`ar`) ou no sv_slide_time (`tempo`). Fora do slide, a saída sem
 * parada seca acaba ao sair do chão.
 */
export function updateSlide(s, env) {
  if (!s.sliding) {
    if (!s.onGround) s.slideExit = false;
    return;
  }
  const { sv, dt } = env;
  s.slideTime += dt;
  s.slideAir = s.onGround ? 0 : s.slideAir + dt;
  const speed = Math.hypot(s.velocity.x, s.velocity.z);
  if (!sv.slide) endSlide(s, env, SLIDE_END.INTERRUPT);
  else if (speed < SLIDE.endSpeed * s.baseSpeed) endSlide(s, env, SLIDE_END.STOP);
  else if (s.slideAir > SLIDE.airTime + 1e-9) endSlide(s, env, SLIDE_END.AIR);
  else if (s.slideTime >= sv.slide_time - 1e-9) endSlide(s, env, SLIDE_END.TIME);
}
```

- [ ] **Passo 7: Wall-jump** — buffer armado por aperto no ar, tolerância do contato, subida máxima, espera, a mesma parede (peça + corpo + 45°), a direção do chute (olhar, espelho na parede, 30° para fora) e o contato da sonda no passo 14.

```js file=src/player/wallJump.js
// Wall-jump (subfase 3.4; seção 0.6: "1 por contato de parede, reseta ao tocar o chão"). No ar, a sonda de parede
// (src/physics/wallProbe.js) guarda o último contato; um aperto do pulo no ar, com o contato recente de uma parede
// ainda não usada no voo, chuta o jogador para onde ele olha com a vertical de um pulo um pouco mais baixo. Tolerância,
// buffer, espera e subida máxima da referência (o wall-jump do Doodle District); números em src/data/movement.js
// (WALLJUMP e as sv_walljump_*); desenho em docs/phases/phase-3.md, seção 3.4. Funções puras sobre o estado de
// movimento (src/player/movement.js), chamadas pelo playerMove na ordem do tick. "A mesma parede" = a mesma peça do
// ColliderBuilder no mesmo corpo com a direção no plano a até WALLJUMP.sameWall de uma já usada.

import { HULL, MOVE, WALLJUMP } from '../data/movement.js';
import { BTN } from './moveCmd.js';

const DEG = Math.PI / 180;
const MIN_AWAY_SIN = Math.sin(WALLJUMP.minAway * DEG);
const MIN_AWAY_COS = Math.cos(WALLJUMP.minAway * DEG);
const SAME_WALL_COS = Math.cos(WALLJUMP.sameWall * DEG);

/** Relógios do passo 2: buffer do pulo e espera entre wall-jumps (a idade do contato anda na sonda, passo 14). */
export function wallJumpClocks(s, dt) {
  s.jumpBuffer = Math.max(0, s.jumpBuffer - dt);
  s.wallJumpCooldown = Math.max(0, s.wallJumpCooldown - dt);
}

/** Esquece o voo: paredes usadas, contato, buffer e a contagem de wall-jumps (chão, teleporte, volta e noclip). */
export function resetWalls(s) {
  s.usedCount = 0;
  s.wallJumps = 0;
  s.wallTime = WALLJUMP.ageMax;
  s.jumpBuffer = 0;
}

/** A parede (corpo, peça e direção no plano) já foi usada neste voo? */
export function wallUsed(s, body, part, nx, nz) {
  const n = Math.min(s.usedCount, WALLJUMP.maxUsed);
  for (let i = 0; i < n; i++) {
    if (s.usedBody[i] === body && s.usedPart[i] === part && s.usedNx[i] * nx + s.usedNz[i] * nz >= SAME_WALL_COS) {
      return true;
    }
  }
  return false;
}

/** A parede do último contato entra no anel das usadas. */
function markUsed(s) {
  const i = s.usedCount % WALLJUMP.maxUsed;
  s.usedBody[i] = s.wallBody;
  s.usedPart[i] = s.wallPart;
  s.usedNx[i] = s.wallNx;
  s.usedNz[i] = s.wallNz;
  s.usedCount++;
}

/**
 * Direção do chute no plano para o olhar `yaw` e a normal da parede (nx, nz), escrita em `out` ({x, z}): a horizontal
 * do olhar; olhando para dentro da parede, espelhada no plano dela (de frente, sai reto pela normal); e sempre pelo
 * menos WALLJUMP.minAway para fora (olhando ao longo da parede, sai nesse ângulo).
 */
export function kickDirection(yaw, nx, nz, out) {
  let dx = -Math.sin(yaw);
  let dz = -Math.cos(yaw);
  let away = dx * nx + dz * nz;
  if (away < 0) {
    dx -= 2 * away * nx;
    dz -= 2 * away * nz;
    away = -away;
  }
  if (away < MIN_AWAY_SIN) {
    const tx = dx - away * nx;
    const tz = dz - away * nz;
    const len = Math.hypot(tx, tz);
    if (len < 1e-9) {
      dx = nx;
      dz = nz;
    } else {
      dx = (tx / len) * MIN_AWAY_COS + nx * MIN_AWAY_SIN;
      dz = (tz / len) * MIN_AWAY_COS + nz * MIN_AWAY_SIN;
    }
  }
  out.x = dx;
  out.z = dz;
  return out;
}

const _dir = { x: 0, z: 0 };

/**
 * O chute: velocidade no plano para a direção do kickDirection, com o módulo atual entre a velocidade do item
 * (s.baseSpeed, o piso) e sv_walljump_maxspeed (o teto); vertical sv_walljump_up × (1 − stamina/100) menos a meia
 * gravidade do tick (a parábola exata, como o pulo); a stamina soma o custo de um pulo. A parede vira usada, o buffer é
 * consumido e a espera recomeça.
 */
function kick(s, cmd, env) {
  const { sv, dt } = env;
  const v = s.velocity;
  kickDirection(cmd.yaw, s.wallNx, s.wallNz, _dir);
  const speed = Math.min(sv.walljump_maxspeed, Math.max(s.baseSpeed, Math.hypot(v.x, v.z)));
  v.x = _dir.x * speed;
  v.z = _dir.z * speed;
  let impulse = sv.walljump_up;
  if (s.stamina > 0) impulse *= Math.max(0, Math.min(1, 1 - s.stamina / MOVE.staminaRange));
  v.y = impulse - sv.gravity * 0.5 * dt;
  s.stamina = Math.min(sv.staminamax, Math.max(0, s.stamina + sv.staminajumpcost * impulse));
  markUsed(s);
  s.jumpBuffer = 0;
  s.wallJumpCooldown = WALLJUMP.cooldown;
  s.wallJumps++;
  env.events.push({
    type: 'walljump', nx: s.wallNx, nz: s.wallNz, surface: s.wallSurface, speed, count: s.wallJumps,
    body: s.wallBody, part: s.wallPart,
  });
}

/**
 * Passo 9, no ar: um aperto do pulo (o bit subiu) arma o buffer por WALLJUMP.buffer; com o buffer armado, um contato de
 * parede de até WALLJUMP.grace atrás, essa parede ainda não usada no voo, a subida até WALLJUMP.maxRise × o pulo e a
 * espera vencida, chuta. Com sv_walljump 0 não há wall-jump. Devolve true se chutou.
 */
export function checkWallJump(s, cmd, env) {
  const { sv } = env;
  if ((cmd.buttons & BTN.JUMP) && !(s.oldButtons & BTN.JUMP)) s.jumpBuffer = WALLJUMP.buffer;
  if (!sv.walljump || s.jumpBuffer <= 1e-9 || s.wallJumpCooldown > 1e-9) return false;
  if (s.wallTime > WALLJUMP.grace + 1e-9) return false;
  if (s.velocity.y > WALLJUMP.maxRise * sv.jump_impulse) return false;
  if (wallUsed(s, s.wallBody, s.wallPart, s.wallNx, s.wallNz)) return false;
  kick(s, cmd, env);
  return true;
}

/**
 * Passo 14: no chão, esquece o voo; no ar (com sv_walljump 1), a sonda procura a parede mais próxima a até
 * WALLJUMP.reach da cápsula e guarda o contato para os próximos ticks (idade 0, medida no começo do próximo tick);
 * sem parede, a idade do último contato anda um tick.
 */
export function updateWallContact(s, env) {
  if (s.onGround) {
    resetWalls(s);
    return;
  }
  const ctl = env.controller;
  const o = s.origin;
  const w = ctl.wallHit;
  if (!env.sv.walljump
    || !ctl.walls.probe(o.x, o.y, o.z, HULL.radius, s.height, WALLJUMP.reach, WALLJUMP.maxNormalY, w)) {
    s.wallTime = Math.min(WALLJUMP.ageMax, s.wallTime + env.dt);
    return;
  }
  s.wallTime = 0;
  s.wallNx = w.nx;
  s.wallNz = w.nz;
  s.wallPx = w.px;
  s.wallPy = w.py;
  s.wallPz = w.pz;
  s.wallBody = w.body.key;
  s.wallPart = w.part;
  s.wallSurface = w.surface;
}
```

- [ ] **Passo 8: O movimento na ordem do tick da 3.4** (arquivo inteiro).

```js file=src/player/movement.js
// Movimento do jogador — porte do PlayerMove/FullWalkMove do CS:GO (cs_gamemovement.cpp sobre o gamemovement.cpp do
// Source) para Y para cima, com os números do CS:GO (src/data/movement.js). Uma função sobre dados simples,
// playerMove(estado, comando, ambiente): o mesmo código move o jogador local, a predição do cliente (Fase 9) e os bots
// (Fase 7) — só o comando muda. O agachar fica em duck.js e os passos em footsteps.js; o slide (slide.js), o wall-jump
// (wallJump.js) e o dano de queda (vitals.js) são da subfase 3.4. Única diferença intencional do CS:GO: o pulo mantém
// a parábola exata da 3.1 (impulso definido, ápice de 57 u em pé; o CS:GO a 64 tick dá 54,65 u).

import * as THREE from 'three';
import { CONTROLLER, DUCK, HULL, MOVE, STEPS, WALLJUMP } from '../data/movement.js';
import { FREE_CAMERA } from '../data/sandbox.js';
import { SURFACES } from '../data/surfaces.js';
import { duck, duckGate } from './duck.js';
import { firstStepDelay, updateSteps } from './footsteps.js';
import { BTN } from './moveCmd.js';
import {
  SLIDE_END, checkSlideButton, endSlide, slideFriction, slideJump, slideMove, updateSlide,
} from './slide.js';
import { fallDamage } from './vitals.js';
import { checkWallJump, resetWalls, updateWallContact, wallJumpClocks } from './wallJump.js';

export { eyeHeight } from './duck.js';

export const MOVETYPE = Object.freeze({ WALK: 'andar', NOCLIP: 'noclip' });

const _wishVel = new THREE.Vector3();
const _wishDir = new THREE.Vector3();
const _fwd = new THREE.Vector3();
const _right = new THREE.Vector3();

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

/** Estado de movimento de um jogador: dados simples (a rede serializa, a predição copia). */
export function createMoveState({ position = null } = {}) {
  return {
    origin: position ? position.clone() : new THREE.Vector3(), // pés
    velocity: new THREE.Vector3(),
    height: HULL.standHeight, // altura atual da cápsula
    ducked: false, // cápsula agachada (m_bDucked)
    ducking: false, // transição do agachar em andamento (m_bDucking)
    duckFlag: false, // FL_DUCKING: agachado para a precisão, os passos e o andar
    duckHeld: false, // agachar valendo neste tick (depois do portão do spam)
    duckAmount: 0, // 0 em pé … 1 agachado (olho e velocidade)
    duckSpeed: DUCK.speed, // velocidade do agachar (cai com o spam, recupera com o tempo)
    duckAnchorX: position ? position.x : 0, // onde a velocidade do agachar estava cheia (recuperação extra longe dali)
    duckAnchorZ: position ? position.z : 0,
    sinceDuck: DUCK.sinceMax, // s desde o último agachar completo (sv_timebetweenducks)
    walking: false, // m_bIsWalking: andar (Shift) engatado
    stamina: 0,
    baseSpeed: 0, // teto do item na mão no tick (com 260 e sv_maxspeed), antes de andar, stamina e agachar
    maxSpeed: 0, // teto do tick = baseSpeed × walkFactor × staminaFactor × duckFactor
    walkFactor: 1, // fatores do teto do tick (o cl_showpos mostra a conta)
    staminaFactor: 1,
    duckFactor: 1,
    onGround: false,
    groundNormal: new THREE.Vector3(0, 1, 0),
    groundSurface: 0,
    surfaceFriction: 1,
    moveType: MOVETYPE.WALK,
    oldButtons: 0,
    fallVelocity: 0, // velocidade de queda no começo do tick (para o pouso)
    viewOffset: 0, // subida/descida brusca deste tick que a câmera suaviza (degrau, troca de cápsula no ar)
    stepTimer: firstStepDelay(false), // relógio dos passos (ms)
    stepFoot: 0, // pé do próximo passo (0 esquerdo, 1 direito)
    stuck: false,
    // Slide (slide.js).
    sliding: false,
    slideTime: 0, // s desde o começo do slide atual
    slideAir: 0, // s seguidos no ar durante o slide
    slideCooldown: 0, // s de recarga que faltam
    slideExit: false, // saída do slide: o atrito freia até caber no teto do tick, sem o corte duro
    slideDistance: 0, // u percorridos no plano no slide atual
    slideStartSpeed: 0, // velocidade no plano no começo do slide (depois do impulso)
    // Wall-jump (wallJump.js).
    jumpBuffer: 0, // s que o último aperto do pulo no ar ainda vale
    wallJumpCooldown: 0, // s até o próximo wall-jump valer
    wallTime: WALLJUMP.ageMax, // idade (s) do último contato de parede, medida no começo do tick
    wallNx: 0, // normal no plano do último contato (da parede para o jogador)
    wallNz: 0,
    wallPx: 0, // ponto do último contato na parede
    wallPy: 0,
    wallPz: 0,
    wallBody: 0, // chave do corpo de colisão da parede no mundo (0: nenhum)
    wallPart: -1, // peça do ColliderBuilder
    wallSurface: 0,
    wallJumps: 0, // wall-jumps neste voo
    usedCount: 0, // paredes usadas no voo; as últimas WALLJUMP.maxUsed ficam nos anéis abaixo
    usedBody: new Int32Array(WALLJUMP.maxUsed),
    usedPart: new Int32Array(WALLJUMP.maxUsed),
    usedNx: new Float64Array(WALLJUMP.maxUsed),
    usedNz: new Float64Array(WALLJUMP.maxUsed),
  };
}

/** Copia um estado de movimento (predição e reconciliação da rede, testes de determinismo). */
export function copyMoveState(src, dst) {
  dst.origin.copy(src.origin);
  dst.velocity.copy(src.velocity);
  dst.height = src.height;
  dst.ducked = src.ducked;
  dst.ducking = src.ducking;
  dst.duckFlag = src.duckFlag;
  dst.duckHeld = src.duckHeld;
  dst.duckAmount = src.duckAmount;
  dst.duckSpeed = src.duckSpeed;
  dst.duckAnchorX = src.duckAnchorX;
  dst.duckAnchorZ = src.duckAnchorZ;
  dst.sinceDuck = src.sinceDuck;
  dst.walking = src.walking;
  dst.stamina = src.stamina;
  dst.baseSpeed = src.baseSpeed;
  dst.maxSpeed = src.maxSpeed;
  dst.walkFactor = src.walkFactor;
  dst.staminaFactor = src.staminaFactor;
  dst.duckFactor = src.duckFactor;
  dst.onGround = src.onGround;
  dst.groundNormal.copy(src.groundNormal);
  dst.groundSurface = src.groundSurface;
  dst.surfaceFriction = src.surfaceFriction;
  dst.moveType = src.moveType;
  dst.oldButtons = src.oldButtons;
  dst.fallVelocity = src.fallVelocity;
  dst.viewOffset = src.viewOffset;
  dst.stepTimer = src.stepTimer;
  dst.stepFoot = src.stepFoot;
  dst.stuck = src.stuck;
  dst.sliding = src.sliding;
  dst.slideTime = src.slideTime;
  dst.slideAir = src.slideAir;
  dst.slideCooldown = src.slideCooldown;
  dst.slideExit = src.slideExit;
  dst.slideDistance = src.slideDistance;
  dst.slideStartSpeed = src.slideStartSpeed;
  dst.jumpBuffer = src.jumpBuffer;
  dst.wallJumpCooldown = src.wallJumpCooldown;
  dst.wallTime = src.wallTime;
  dst.wallNx = src.wallNx;
  dst.wallNz = src.wallNz;
  dst.wallPx = src.wallPx;
  dst.wallPy = src.wallPy;
  dst.wallPz = src.wallPz;
  dst.wallBody = src.wallBody;
  dst.wallPart = src.wallPart;
  dst.wallSurface = src.wallSurface;
  dst.wallJumps = src.wallJumps;
  dst.usedCount = src.usedCount;
  dst.usedBody.set(src.usedBody);
  dst.usedPart.set(src.usedPart);
  dst.usedNx.set(src.usedNx);
  dst.usedNz.set(src.usedNz);
  return dst;
}

/**
 * Interrompe o slide e esquece o voo (teleporte, morte, volta): o slide acaba com o motivo `interrompido`, sem saída e
 * sem recarga; paredes usadas, contato, buffer e a espera do wall-jump zeram.
 */
export function interruptMoves(s, env) {
  endSlide(s, env, SLIDE_END.INTERRUPT);
  s.slideExit = false;
  s.slideCooldown = 0;
  resetWalls(s);
  s.wallJumpCooldown = 0;
}

/** Teto do item na mão: mín(260, sv_maxspeed, velocidade do item no modo atual). */
function baseSpeedOf(env) {
  return Math.min(MOVE.runSpeed, env.sv.maxspeed, env.item.speed);
}

/**
 * CheckParameters do CS:GO: teto do tick pelo item na mão, portão do agachar (spam), andar (Shift: ignorado em qualquer
 * estado de agachar; engata só abaixo de teto × 0,52 + 25) e o fator da stamina com o valor de antes da recuperação.
 */
function checkParameters(s, cmd, env) {
  let max = baseSpeedOf(env);
  s.baseSpeed = max;
  s.walkFactor = 1;
  s.staminaFactor = 1;
  duckGate(s, cmd, env.sv);
  const walkButton = (cmd.buttons & BTN.WALK) !== 0 && !(s.duckHeld || s.ducking || s.duckFlag);
  if (walkButton) {
    if (s.velocity.length() < max * MOVE.walkModifier + MOVE.walkCapMargin) {
      s.walkFactor = MOVE.walkModifier;
      max *= MOVE.walkModifier;
      s.walking = true;
    }
  } else {
    s.walking = false;
  }
  if (s.stamina > 0) {
    const k = clamp01(1 - s.stamina / MOVE.staminaRange);
    s.staminaFactor = k * k; // ao quadrado: casa com a penalidade do pulo
    max *= s.staminaFactor;
  }
  s.maxSpeed = max;
}

/** ReduceTimers: a stamina recupera sv_staminarecoveryrate por segundo. */
function reduceStamina(s, sv, dt) {
  if (s.stamina > 0) s.stamina = Math.max(0, s.stamina - sv.staminarecoveryrate * dt);
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

/**
 * Accelerate do CS:GO (CCSGameMovement::Accelerate), no chão. Escala e meta partem de máx(250, desejo); com
 * sv_accelerate_use_weapon_speed a meta segue a velocidade do item e a escala também, mas só correndo (ou na sniper
 * lenta com zoom); agachado e andando multiplicam por 0,34 e 0,52 (a escala não, na sniper lenta); andando, a
 * aceleração some nos últimos 5 u/s antes da meta. Ganho = mín(sv_accelerate × dt × escala × atrito, desejo − atual).
 */
export function accelerate(s, wishDir, wishSpeed, cmd, env) {
  const current = s.velocity.dot(wishDir);
  const add = wishSpeed - current;
  if (add <= 0) return;
  const cur = Math.max(0, current);
  const ducking = s.duckHeld || s.ducking || s.duckFlag;
  const walking = (cmd.buttons & BTN.WALK) !== 0 && !ducking;
  let scale = Math.max(MOVE.accelerateReference, wishSpeed);
  let goal = scale;
  let slowSniper = false;
  if (env.sv.accelerate_use_weapon_speed) {
    slowSniper = env.item.slowSniper;
    const ratio = Math.min(1, env.item.speed / MOVE.accelerateReference);
    goal *= ratio;
    if ((!ducking && !walking) || ((walking || ducking) && slowSniper)) scale *= ratio;
  }
  if (ducking) {
    if (!slowSniper) scale *= DUCK.speedMultiplier;
    goal *= DUCK.speedMultiplier;
  }
  if (walking) {
    if (!slowSniper) scale *= MOVE.walkModifier;
    goal *= MOVE.walkModifier;
  }
  let accel = env.sv.accelerate;
  if (walking && cur > goal - MOVE.walkDampWindow) accel *= clamp01((goal - cur) / MOVE.walkDampWindow);
  s.velocity.addScaledVector(wishDir, Math.min(accel * env.dt * scale * s.surfaceFriction, add));
}

/** AirAccelerate do Source: o desejo vale só até `maxWish` (30 u/s), mas a taxa usa o desejo inteiro — air-strafe. */
export function airAccelerate(s, wishDir, wishSpeed, accel, maxWish, dt) {
  const add = Math.min(wishSpeed, maxWish) - s.velocity.dot(wishDir);
  if (add <= 0) return;
  s.velocity.addScaledVector(wishDir, Math.min(accel * wishSpeed * dt * s.surfaceFriction, add));
}

/** Desejo de movimento no plano pelo yaw do comando, em u/s, limitado ao teto do tick (analógico = fração dele). */
function wishVelocity(s, cmd, out) {
  _fwd.set(-Math.sin(cmd.yaw), 0, -Math.cos(cmd.yaw));
  _right.set(Math.cos(cmd.yaw), 0, -Math.sin(cmd.yaw));
  const max = s.maxSpeed;
  out.set(0, 0, 0).addScaledVector(_fwd, cmd.forward * max).addScaledVector(_right, cmd.side * max);
  const speed = out.length();
  if (speed > max) out.multiplyScalar(max / speed);
  return out;
}

/**
 * Desejo do slide: direção no plano pelo yaw do comando em _wishDir e a fração do analógico (0–1), sem o teto do tick
 * (o controle lateral do slide é proporcional à velocidade do item).
 */
function slideSteer(cmd) {
  _fwd.set(-Math.sin(cmd.yaw), 0, -Math.cos(cmd.yaw));
  _right.set(Math.cos(cmd.yaw), 0, -Math.sin(cmd.yaw));
  _wishVel.set(0, 0, 0).addScaledVector(_fwd, cmd.forward).addScaledVector(_right, cmd.side);
  return Math.min(1, wishDirection(_wishVel));
}

/** Direção do desejo em _wishDir; devolve o módulo. */
function wishDirection(vel) {
  const speed = vel.length();
  if (speed > 0) _wishDir.copy(vel).divideScalar(speed);
  else _wishDir.set(0, 0, 0);
  return speed;
}

/**
 * WalkMove: acelera no plano (Accelerate do CS:GO), corta a velocidade no teto do tick — o teto duro do CS:GO, que faz
 * andar, agachar e pousar frearem na hora —, desliza (ou sobe o degrau) e gruda no chão. Na saída do slide o corte duro
 * vira "a velocidade só cai" (o atrito freia) até caber no teto.
 */
function walkMove(s, cmd, env) {
  const wishSpeed = wishDirection(wishVelocity(s, cmd, _wishVel));
  s.velocity.y = 0;
  const before = s.slideExit ? Math.hypot(s.velocity.x, s.velocity.z) : 0;
  accelerate(s, _wishDir, wishSpeed, cmd, env);
  s.velocity.y = 0;
  const cap = s.slideExit ? Math.max(s.maxSpeed, before) : s.maxSpeed;
  const speed = s.velocity.length();
  if (speed > cap) s.velocity.multiplyScalar(cap / speed);
  if (s.slideExit && s.velocity.length() <= s.maxSpeed) s.slideExit = false;
  if (s.velocity.length() < CONTROLLER.minSpeed) {
    s.velocity.set(0, 0, 0);
    return;
  }
  env.controller.groundMove(s, env.dt);
}

/** AirMove: no ar só o air-accelerate controla (desejo pelo teto do tick) e a cápsula desliza pelas superfícies. */
function airMove(s, cmd, env) {
  const { controller: ctl, sv, dt } = env;
  const wishSpeed = wishDirection(wishVelocity(s, cmd, _wishVel));
  airAccelerate(s, _wishDir, wishSpeed, sv.airaccelerate, sv.air_max_wishspeed, dt);
  ctl.tryPlayerMove(s, dt);
}

/**
 * CheckJumpButton: pula do chão, com o botão solto no tick anterior (ou sv_autobunnyhopping). Sem
 * sv_enablebunnyhopping, a velocidade 3D acima de 1,1 × 260 é cortada antes de sair do chão. Impulso definido (a
 * parábola exata da 3.1) × fator da superfície × (1 − stamina/100) e a meia gravidade do tick; a stamina soma
 * sv_staminajumpcost × impulso. No slide, sai com o embalo e o slide acaba (slideJump).
 */
function checkJumpButton(s, cmd, env) {
  const { sv, dt } = env;
  if (!s.onGround) return;
  if ((s.oldButtons & BTN.JUMP) && !sv.autobunnyhopping) return;
  if (!sv.enablebunnyhopping) {
    const cap = MOVE.bunnyJumpFactor * MOVE.runSpeed;
    const spd = s.velocity.length();
    if (spd > cap) s.velocity.multiplyScalar(cap / spd);
  }
  const surface = s.groundSurface;
  env.controller.setGround(s, null);
  const speed = s.velocity.length();
  let impulse = sv.jump_impulse * SURFACES[surface].jumpFactor;
  if (s.stamina > 0) impulse *= clamp01(1 - s.stamina / MOVE.staminaRange);
  s.velocity.y = impulse - sv.gravity * 0.5 * dt;
  s.stamina = Math.min(sv.staminamax, Math.max(0, s.stamina + sv.staminajumpcost * impulse));
  env.events.push({ type: 'jump', surface, speed, audible: speed > MOVE.jumpSoundSpeed });
  if (s.sliding) slideJump(s, cmd, env);
}

/**
 * CheckFalling: pouso do tick — no chão com velocidade de queda (do começo do tick) positiva. Quem pousou de dentro do
 * agachar (duckbug) já zerou a queda no passo do atrito e não conta (nem toma dano, como no CS). Soma a stamina do
 * pouso; pouso pesado atrasa o próximo passo; o evento leva o dano de queda (o PlayerPawn aplica na vida).
 */
function checkFalling(s, env) {
  if (!s.onGround || s.fallVelocity <= 0) return;
  const fall = s.fallVelocity;
  const { sv } = env;
  s.stamina = Math.min(sv.staminamax, Math.max(0, s.stamina + sv.staminalandcost * fall));
  if (fall >= STEPS.roughLandSpeed) s.stepTimer = STEPS.roughLandDelay;
  env.events.push({
    type: 'land', speed: fall, surface: s.groundSurface,
    audible: fall > STEPS.landAudibleSpeed, heavy: fall >= STEPS.roughLandSpeed, damage: fallDamage(fall, sv),
  });
  s.fallVelocity = 0;
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
 * Um tick de movimento (PlayerMove + FullWalkMove do CS:GO, com o slide e o wall-jump da 3.4). `env`: { controller, sv,
 * dt, item: {speed, slowSniper} (velocidade do item na mão no modo atual e se é sniper lenta com zoom), events: [] }.
 * Eventos do tick em env.events: step {foot, x, y, z, surface, volume, speed, audible}, jump {surface, speed, audible},
 * land {speed, surface, audible, heavy, damage}, duck, unduck, slide {phase: 'start', speed, from, surface} e
 * {phase: 'end', reason, time, distance, entrySpeed, exitSpeed}, walljump {nx, nz, surface, speed, count, body, part}.
 */
export function playerMove(s, cmd, env) {
  const { controller: ctl, sv, dt, events } = env;
  events.length = 0;
  s.viewOffset = 0;
  s.sinceDuck = Math.min(DUCK.sinceMax, s.sinceDuck + dt);
  if (s.moveType === MOVETYPE.NOCLIP) {
    s.baseSpeed = s.maxSpeed = baseSpeedOf(env);
    s.walkFactor = s.staminaFactor = s.duckFactor = 1;
    reduceStamina(s, sv, dt);
    interruptMoves(s, env);
    noclipMove(s, cmd, dt);
    s.onGround = false;
    s.fallVelocity = 0;
    s.stuck = false;
    s.oldButtons = cmd.buttons;
    return;
  }
  // 1) Teto do tick, portão do agachar, andar e stamina.
  checkParameters(s, cmd, env);
  // 2) Relógios: stamina, recarga do slide, buffer do pulo e espera do wall-jump.
  reduceStamina(s, sv, dt);
  s.slideCooldown = Math.max(0, s.slideCooldown - dt);
  wallJumpClocks(s, dt);
  // 3) Desprender; 4) queda do começo do tick; 5) passos (parados no slide).
  s.stuck = !ctl.resolvePenetration(s);
  if (!s.onGround) s.fallVelocity = -s.velocity.y;
  updateSteps(s, env);
  // 6) Slide: soltar o Ctrl encerra; o aperto correndo no chão começa (depois do portão, antes da transição).
  checkSlideButton(s, cmd, env);
  // 7) Agachar (no slide a cápsula já está agachada e fica).
  duck(s, env);
  const startY = s.origin.y; // pés no começo do movimento: pouso na beirada que a base atravessar descendo
  // 8) Meia gravidade antes e meia depois do movimento: a posição segue a parábola exata.
  s.velocity.y -= sv.gravity * 0.5 * dt;
  // 9) Pulo: no chão, o do CS — antes do atrito, então pular no tick seguinte ao pouso não perde velocidade (bunny
  // hop); no ar, o wall-jump.
  if (s.onGround) {
    if (cmd.buttons & BTN.JUMP) checkJumpButton(s, cmd, env);
  } else checkWallJump(s, cmd, env);
  // 10) Atrito: o do slide ou o do CS.
  if (s.onGround) {
    s.velocity.y = 0;
    s.fallVelocity = 0;
    if (s.sliding) slideFriction(s, sv, dt);
    else friction(s, sv, dt);
  }
  ctl.checkVelocity(s);
  // 11) Movimento: slide ou andar no chão; no ar, air-accelerate e deslize.
  if (s.onGround) {
    if (s.sliding) slideMove(s, _wishDir, slideSteer(cmd), env);
    else walkMove(s, cmd, env);
  } else airMove(s, cmd, env);
  // 12) Chão, limites e a outra meia gravidade.
  ctl.categorizePosition(s, startY);
  ctl.checkVelocity(s);
  s.velocity.y -= sv.gravity * 0.5 * dt;
  if (s.onGround) s.velocity.y = 0;
  // 13) Fim do slide; 14) sonda de parede; 15) pouso.
  updateSlide(s, env);
  updateWallContact(s, env);
  checkFalling(s, env);
  s.oldButtons = cmd.buttons;
}
```

- [ ] **Passo 9: Eventos do slide e do wall-jump, e o roteamento no pawn** — o pouso documenta o `damage`; os eventos `slide` e `walljump` vão para os tipos novos, e não para o de agachar.

Em `src/core/events.js`, trocar:

```
  PLAYER_JUMP: 'player:jump', // {surface, speed, audible}
  PLAYER_LAND: 'player:land', // {speed, surface, audible, heavy} — velocidade de queda no pouso (u/s)
  PLAYER_DUCK: 'player:duck', // {ducked}
```

por:

```
  PLAYER_JUMP: 'player:jump', // {surface, speed, audible}
  PLAYER_LAND: 'player:land', // {speed, surface, audible, heavy, damage} — queda no pouso (u/s) e o dano
  PLAYER_DUCK: 'player:duck', // {ducked}
```

Em `src/core/events.js`, trocar:

```
  PLAYER_ZOOM: 'player:zoom', // {level, fov} — nível da luneta (fov na referência de 90°; null sem zoom)
});
```

por:

```
  PLAYER_ZOOM: 'player:zoom', // {level, fov} — nível da luneta (fov na referência de 90°; null sem zoom)
  // {phase: 'start', speed, from, surface} ou {phase: 'end', reason, time, distance, entrySpeed, exitSpeed}
  PLAYER_SLIDE: 'player:slide',
  PLAYER_WALLJUMP: 'player:walljump', // {nx, nz, surface, speed, count, body, part} — normal da parede, n.º no voo
});
```

Em `src/player/playerPawn.js`, trocar:

```
    else if (e.type === 'step') this.bus.emit(EV.PLAYER_STEP, e);
    else this.bus.emit(EV.PLAYER_DUCK, { ducked: e.type === 'duck' });
```

por:

```
    else if (e.type === 'step') this.bus.emit(EV.PLAYER_STEP, e);
    else if (e.type === 'slide') this.bus.emit(EV.PLAYER_SLIDE, e);
    else if (e.type === 'walljump') this.bus.emit(EV.PLAYER_WALLJUMP, e);
    else this.bus.emit(EV.PLAYER_DUCK, { ducked: e.type === 'duck' });
```

- [ ] **Passo 10: Rodar os testes da tarefa**

Run: `node --test tests/slide.test.js tests/wallJump.test.js tests/vitals.test.js tests/tacticalMovement.test.js tests/movementFuzz.test.js tests/playerPawn.test.js`
Expected: PASS — todos os testes dos seis arquivos passando.

- [ ] **Passo 11: Suíte inteira**

Run: `npm test`
Expected: PASS — 240 testes passando.

- [ ] **Passo final: Commit** (só com o pedido do usuário)

```bash
git add src/player src/core/events.js tests/slide.test.js tests/wallJump.test.js tests/vitals.test.js tests/tacticalMovement.test.js tests/movementFuzz.test.js
git commit -m "MASSACRE 3.4: slide, wall-jump e dano de queda no movimento" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Tarefa 4: PlayerPawn — vida, dano, morte, volta e os eventos no barramento

**Files:**
- Create: `src/debug/vitalsCommands.js`
- Modify: `src/player/playerPawn.js` (arquivo inteiro), `src/player/telemetry.js`, `src/core/events.js`, `src/debug/commands.js`, `tests/vitals.test.js`, `tests/playerPawn.test.js`

O `PlayerPawn` aplica a vida: o pouso com dano vira `hurt(dano, 'queda')` (`EV.PLAYER_HURT` com a vida que saiu, o dano como veio, o tipo, a vida e o colete); vida em 0 é a morte (`EV.PLAYER_DEATH` com a causa, o tipo e o texto), que interrompe o slide e o voo. Morto, o comando do tick fica vazio (sem movimento, pulo, agachar ou troca de item; o olhar segue livre) e a câmera desce até 12 u acima dos pés e tomba 35° em 0,5 s com saída suave (só desce com "reduzir movimento"); o relógio do morto anda no tick. `respawn` zera a vida, o estado de movimento (`copyMoveState` de um estado novo), a precisão, a luneta e o FOV, e publica `EV.PLAYER_SPAWN`; `kill` mata na hora; o teleporte também interrompe o slide e o voo. Os eventos `slide` e `walljump` contam nas estatísticas, guardam o último de cada e marcam a telemetria (o gráfico da Tarefa 6 lê). No console, `kill` e `hurtme <n>` (dano do tipo mundo; `god` segura) ficam num arquivo próprio.

- [ ] **Passo 1: Escrever os testes** — o pawn (morte na queda de 1310, câmera do morto, "reduzir movimento", volta com o estado zerado, colete e `god`, `hurt` com o acumulador) e o console, na `vitals.test.js` da Tarefa 3; e os eventos do slide e do wall-jump no barramento.

Em `tests/vitals.test.js`, trocar:

```
// Testes da vida e do dano de queda (subfase 3.4): a curva do CS:GO sobre o limite seguro de 420 u (e as quedas do
// repouso no controlador real), sv_falldamage_scale, o acumulador de dano fracionário (com god, morto e tipo
// desconhecido) e o duckbug sem dano.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FALL, HULL } from '../src/data/movement.js';
import { VITALS } from '../src/data/vitals.js';
import { BTN } from '../src/player/moveCmd.js';
import { createSvVars } from '../src/player/movementVars.js';
import {
```

por:

```
// Testes da vida e do dano de queda (subfase 3.4): a curva do CS:GO sobre o limite seguro de 420 u (e as quedas do
// repouso no controlador real), sv_falldamage_scale, o acumulador de dano fracionário, god, colete ignorado, duckbug
// sem dano; no PlayerPawn, a morte (comando vazio, câmera do morto, "reduzir movimento"), a volta com o estado zerado e
// os eventos no barramento; no console, kill e hurtme.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { EV, EventBus } from '../src/core/events.js';
import { FALL, HULL, WALLJUMP } from '../src/data/movement.js';
import { VITALS } from '../src/data/vitals.js';
import { registerVitalsCommands } from '../src/debug/vitalsCommands.js';
import { Loadout } from '../src/player/loadout.js';
import { BTN } from '../src/player/moveCmd.js';
import { createSvVars } from '../src/player/movementVars.js';
import { PlayerPawn } from '../src/player/playerPawn.js';
import {
```

Em `tests/vitals.test.js`, trocar:

```
import { floor, worldOf } from './worldTestUtils.js';
import { idle, makePlayer, run } from './playerTestUtils.js';

const near = (a, b, eps, msg = '') => assert.ok(Math.abs(a - b) <= eps, `${msg} ${a} ≠ ${b}`);
```

por:

```
import { floor, worldOf } from './worldTestUtils.js';
import { DT, idle, makePlayer, run } from './playerTestUtils.js';

const DEG = Math.PI / 180;
const near = (a, b, eps, msg = '') => assert.ok(Math.abs(a - b) <= eps, `${msg} ${a} ≠ ${b}`);
```

Em `tests/vitals.test.js`, trocar:

```
  assert.ok(!events.some((e) => e.type === 'land'), 'sem pouso, sem dano');
});

```

por:

```
  assert.ok(!events.some((e) => e.type === 'land'), 'sem pouso, sem dano');
});

/** Entrada do PlayerPawn (move, isDown) sem navegador. */
function testInput() {
  return {
    move: { x: 0, y: 0 },
    down: new Set(),
    isDown(action) {
      return this.down.has(action);
    },
  };
}

function pawnAt(y, { events = null, loadout = new Loadout(), world = ground() } = {}) {
  return new PlayerPawn({ world, sv: createSvVars(), loadout, events, position: new THREE.Vector3(0, y, 0) });
}

function ticks(pawn, input, n, opts = {}) {
  for (let i = 0; i < n; i++) pawn.tick(DT, input, { tick: i, ...opts });
}

test('pawn: a queda de 1310 mata ("queda"); morto, o comando fica vazio e a câmera desce e tomba em 0,5 s', () => {
  const bus = new EventBus();
  const seen = [];
  for (const type of [EV.PLAYER_LAND, EV.PLAYER_HURT, EV.PLAYER_DEATH, EV.PLAYER_SPAWN]) bus.on(type, (e) => seen.push({ type, e }));
  const pawn = pawnAt(1310, { events: bus });
  const input = testInput();
  ticks(pawn, input, 200);
  const v = pawn.vitals;
  assert.equal(v.alive, false);
  assert.equal(v.cause, 'queda');
  assert.deepEqual(seen.map((x) => x.type), [EV.PLAYER_LAND, EV.PLAYER_HURT, EV.PLAYER_DEATH], 'pouso, dano e morte');
  near(seen[0].e.damage, 104.06, 0.005, 'dano do pouso');
  assert.equal(seen[1].e.kind, 'queda');
  assert.equal(seen[2].e.cause, 'queda');
  assert.equal(seen[2].e.text, 'Você se esborrachou');
  // A câmera terminou de descer (12 u acima dos pés) e de tombar (35°).
  near(pawn.eyeOffset, VITALS.deathCam.eye, 1e-9, 'olho do morto');
  near(pawn.roll, VITALS.deathCam.rollDeg * DEG, 1e-9, 'tombo');
  // Comando vazio: andar, pular e agachar não fazem nada; o olhar continua.
  const before = pawn.pos.clone();
  input.move.y = 1;
  input.down.add('jump');
  input.down.add('crouch');
  ticks(pawn, input, 30);
  assert.ok(pawn.pos.distanceTo(before) < 1e-6, 'não anda nem pula');
  assert.equal(pawn.state.ducked, false, 'não agacha');
  pawn.applyLook({ yaw: 0.5, pitch: 0 });
  near(pawn.yaw, 0.5, 1e-12, 'o olhar continua livre');
  // "Reduzir movimento": só desce.
  const calm = pawnAt(1310);
  ticks(calm, testInput(), 200, { reduceMotion: true });
  assert.equal(calm.vitals.alive, false);
  assert.equal(calm.roll, 0);
  near(calm.eyeOffset, VITALS.deathCam.eye, 1e-9, 'desce igual');
});

test('pawn: a volta zera vida, movimento, slide, recarga e paredes usadas, e publica o spawn', () => {
  const bus = new EventBus();
  let spawned = null;
  bus.on(EV.PLAYER_SPAWN, (e) => {
    spawned = e;
  });
  const pawn = pawnAt(0, { events: bus });
  const s = pawn.state;
  Object.assign(s, { stamina: 40, slideCooldown: 0.7, usedCount: 3, wallJumps: 3, ducked: true, height: HULL.duckHeight });
  s.velocity.set(300, 0, 0);
  pawn.kill('kill');
  assert.equal(pawn.vitals.alive, false);
  const where = new THREE.Vector3(50, 0, 50);
  pawn.respawn(where, 1, 0);
  const v = pawn.vitals;
  assert.deepEqual([v.health, v.alive, v.accumulator], [100, true, 0]);
  assert.deepEqual([s.stamina, s.slideCooldown, s.usedCount, s.wallJumps, s.sliding, s.ducked], [0, 0, 0, 0, false, false]);
  assert.equal(s.velocity.length(), 0);
  assert.equal(s.wallTime, WALLJUMP.ageMax);
  assert.ok(pawn.pos.distanceTo(where) < 0.1, 'no ponto de volta');
  assert.equal(pawn.yaw, 1);
  assert.equal(pawn.roll, 0);
  near(pawn.eyeOffset, HULL.standEye, 1e-9, 'olho em pé');
  assert.ok(spawned && spawned.position.distanceTo(where) < 0.1, 'EV.PLAYER_SPAWN');
});

test('pawn: colete não reduz a queda; god não toma dano; hurt do tipo mundo com o acumulador', () => {
  const armored = new Loadout();
  armored.giveUtility('kevlarHelmet');
  assert.equal(armored.armor, 100);
  const a = pawnAt(600, { loadout: armored });
  ticks(a, testInput(), 120);
  assert.equal(a.vitals.health, 100 - 26, 'com colete: os mesmos 26');
  const g = pawnAt(1310);
  ticks(g, testInput(), 200, { god: true });
  assert.equal(g.vitals.alive, true, 'god');
  assert.equal(g.vitals.health, 100);
  const p = pawnAt(0);
  assert.equal(p.hurt(10.5, 'mundo').taken, 10);
  assert.equal(p.hurt(10.5, 'mundo').taken, 11, 'a fração completou 1');
  assert.equal(p.vitals.health, 79);
  assert.equal(p.hurt(10, 'mundo', { god: true }).taken, 0, 'god pelo parâmetro');
  assert.equal(p.lastHurt.kind, 'mundo');
});

test('console: kill mata na hora ("Desistiu"); hurtme tira vida do tipo mundo e god segura', () => {
  const commands = new Map();
  const con = { register: (def) => commands.set(def.name, def) };
  const cheats = { god: false };
  let match = null;
  registerVitalsCommands(con, { matchState: () => match, cheats });
  assert.throws(() => commands.get('kill').run([]), /só numa partida andando/);
  const bus = new EventBus();
  let death = null;
  bus.on(EV.PLAYER_DEATH, (e) => {
    death = e;
  });
  match = { player: pawnAt(0, { events: bus }) };
  const hurtme = commands.get('hurtme');
  assert.equal(hurtme.run(['26']), 'dano 26 → vida 74');
  assert.throws(() => hurtme.run(['zero']), /dano inválido/);
  cheats.god = true;
  assert.equal(hurtme.run(['50']), 'god ligado: nenhum dano');
  assert.equal(match.player.vitals.health, 74);
  cheats.god = false;
  assert.equal(hurtme.run(['80']), 'dano 80: morreu');
  assert.equal(death.cause, 'mundo');
  assert.equal(death.text, 'Amassado pelo console');
  assert.equal(hurtme.run(['1']), 'já está morto');
  match.player.respawn(new THREE.Vector3(0, 0, 0));
  assert.equal(commands.get('kill').run([]), 'você desistiu');
  assert.equal(death.cause, 'kill');
  assert.equal(death.text, 'Desistiu');
  assert.equal(commands.get('kill').run([]), 'já está morto');
});

```

Em `tests/playerPawn.test.js`, trocar:

```
// Testes do jogador local (Fases 3.1 e 3.2): comando do tick a partir da entrada, andar, interpolação da câmera,
// suavização do degrau, noclip pelo tick, teleporte; troca de item pelo comando e automática, luneta (FOV interpolado,
// sensibilidade, velocidade), precisão no tick, telemetria e os eventos no barramento.
import { test } from 'node:test';
```

por:

```
// Testes do jogador local (Fases 3.1, 3.2 e 3.4): comando do tick a partir da entrada, andar, interpolação da câmera,
// suavização do degrau, noclip pelo tick, teleporte; troca de item pelo comando e automática, luneta (FOV interpolado,
// sensibilidade, velocidade), precisão no tick, telemetria e os eventos no barramento — com o slide e o wall-jump.
import { test } from 'node:test';
```

Em `tests/playerPawn.test.js`, trocar:

```
  assert.equal(seen.duck, 1);
});

```

por:

```
  assert.equal(seen.duck, 1);
});

test('pawn (3.4): slide e wall-jump no barramento, com contagem, último de cada e as marcas da telemetria', () => {
  const bus = new EventBus();
  const seen = { slide: [], walljump: [], duck: 0 };
  bus.on(EV.PLAYER_SLIDE, (e) => seen.slide.push(e.phase === 'end' ? e.reason : e.phase));
  bus.on(EV.PLAYER_WALLJUMP, (e) => seen.walljump.push(e));
  bus.on(EV.PLAYER_DUCK, () => seen.duck++);
  // Parede alta à direita (face em x = 100): corre ao longo dela para −z, desliza, pula e chuta nela.
  const world = worldOf((b) => {
    floor(b);
    b.box(8, 2000, 4000, { center: [104, 1000, 0] });
  });
  const pawn = pawnOn(world, [100 - HULL.radius - 2, 0, 1500], { events: bus });
  const input = testInput();
  input.move.y = 1;
  ticks(pawn, input, 60);
  input.down.add('crouch');
  ticks(pawn, input, 1, { start: 60 });
  assert.deepEqual(seen.slide, ['start']);
  assert.equal(seen.duck, 1, 'o slide agacha na hora (um evento de agachar)');
  const t = pawn.telemetry;
  assert.ok(t.flags[t.slot(t.count - 1)] & TFLAG.SLIDE, 'marca de slide');
  ticks(pawn, input, 10, { start: 61 });
  input.down.delete('crouch');
  ticks(pawn, input, 1, { start: 71 });
  assert.deepEqual(seen.slide, ['start', 'soltou']);
  assert.equal(pawn.stats.slides, 1);
  assert.equal(pawn.lastSlide.reason, 'soltou');
  assert.ok(!(t.flags[t.slot(t.count - 1)] & TFLAG.SLIDE));
  // Pulo do chão colado na parede; no ar, o aperto do pulo (depois da subida cair abaixo de 220 u/s) chuta.
  ticks(pawn, input, 40, { start: 72 });
  input.down.add('jump');
  ticks(pawn, input, 1, { start: 112 });
  input.down.delete('jump');
  let tick = 113;
  for (let i = 0; i < 20 && !seen.walljump.length; i++) {
    if (i % 2) input.down.add('jump');
    else input.down.delete('jump');
    ticks(pawn, input, 1, { start: tick++ });
  }
  assert.equal(seen.walljump.length, 1);
  assert.ok(Math.abs(seen.walljump[0].nx + 1) < 1e-9, 'normal da parede');
  assert.equal(pawn.stats.wallJumps, 1);
  assert.equal(pawn.lastWallJump.count, 1);
  assert.ok(t.flags[t.slot(t.count - 1)] & TFLAG.WALLJUMP, 'marca do wall-jump no tick do chute');
});

```

- [ ] **Passo 2: Rodar e ver falhar**

Run: `node --test tests/vitals.test.js tests/playerPawn.test.js`
Expected: FAIL — `vitals.test.js` não carrega (`ERR_MODULE_NOT_FOUND`: `src/debug/vitalsCommands.js`); em `playerPawn.test.js`, "pawn (3.4): slide e wall-jump no barramento…" falha em "marca de slide" (a telemetria ainda não marca o slide).

- [ ] **Passo 3: Marcas novas da telemetria**

Em `src/player/telemetry.js`, trocar:

```
// plano, teto do tick, velocidade da arma no modo atual, limiar de precisão, inaccuracy, desejo e velocidade no plano e
// as marcas (chão, andando, FL_DUCKING). O gráfico do cl_showpos e o medidor de counter-strafe leem daqui; gravar não
// aloca.

```

por:

```
// plano, teto do tick, velocidade da arma no modo atual, limiar de precisão, inaccuracy, desejo e velocidade no plano e
// as marcas (chão, andando, FL_DUCKING; slide e wall-jump na 3.4). O gráfico do cl_showpos e o medidor de
// counter-strafe leem daqui; gravar não aloca.

```

Em `src/player/telemetry.js`, trocar:

```
/** Marcas de cada amostra. */
export const TFLAG = Object.freeze({ GROUND: 1, WALK: 2, DUCK: 4 });

```

por:

```
/** Marcas de cada amostra. */
export const TFLAG = Object.freeze({ GROUND: 1, WALK: 2, DUCK: 4, SLIDE: 8, WALLJUMP: 16 });

```

- [ ] **Passo 4: Eventos da vida**

Em `src/core/events.js`, trocar:

```
  PLAYER_WALLJUMP: 'player:walljump', // {nx, nz, surface, speed, count, body, part} — normal da parede, n.º no voo
});
```

por:

```
  PLAYER_WALLJUMP: 'player:walljump', // {nx, nz, surface, speed, count, body, part} — normal da parede, n.º no voo
  PLAYER_HURT: 'player:hurt', // {damage, amount, kind, health, armor} — vida que saiu, dano como veio, tipo, vida
  PLAYER_DEATH: 'player:death', // {cause, kind, text} — causa (src/data/vitals.js), tipo do dano e o texto
  PLAYER_SPAWN: 'player:spawn', // {position} — volta ao jogo
});
```

- [ ] **Passo 5: O pawn com a vida** (arquivo inteiro).

```js file=src/player/playerPawn.js
// Jogador local no modo "andar": estado de movimento, item na mão (troca e luneta), precisão da arma, vida (subfase
// 3.4), comando do tick e câmera. Cada tick segue a ordem do RunCommand do Source: troca de item → playerMove →
// precisão (pouso e penalidade) → luneta (vale a partir do tick seguinte) → eventos (o pouso aplica o dano de queda). O
// render interpola pés, altura do olho, o tombo da câmera do morto e o FOV da luneta entre os ticks e suaviza degraus e a
// troca de cápsula no ar. Em terceira pessoa (debug) a câmera recua atrás do jogador e se recolhe ao encostar em parede.
// Morto, o comando do tick fica vazio (o olhar continua livre); quem chama respawn() é o estado da partida.

import * as THREE from 'three';
import { EV } from '../core/events.js';
import { VIEW } from '../data/movement.js';
import { DEATH_CAUSES, VITALS } from '../data/vitals.js';
import { SCOPE, WEAPONS, fireInterval } from '../data/weapons.js';
import { CharacterController } from '../physics/characterController.js';
import { createTrace } from '../physics/collisionWorld.js';
import { setCameraFov } from '../render/camera.js';
import {
  applySelect, autoSwitchSelect, createHands, isSlowSniper, itemSpeed, syncHands, updateZoom, weaponAlt, zoomFov,
  zoomLookScale, zoomTime,
} from './hands.js';
import {
  accuracyData, createAccuracyState, inaccuracyOf, landAccuracy, precisionThreshold, resetAccuracy, updateAccuracy,
} from './inaccuracy.js';
import { Loadout } from './loadout.js';
import { BTN, SELECT, createMoveCmd, readMoveCmd } from './moveCmd.js';
import { MOVETYPE, copyMoveState, createMoveState, eyeHeight, interruptMoves, playerMove } from './movement.js';
import { TFLAG, Telemetry } from './telemetry.js';
import { applyDamage, createVitals, killVitals, respawnVitals } from './vitals.js';

const DEG = Math.PI / 180;
const PITCH_LIMIT = 89 * DEG;
// Média móvel do custo da física por tick: o relógio do navegador é grosso (5–100 µs), um tick sozinho não diz nada.
const US_SMOOTHING = 0.05;

/** Multiplicador da tangente do FOV para um FOV na referência de 90° do CS. */
const fovFactor = (deg) => Math.tan((deg / 2) * DEG) / Math.tan((SCOPE.referenceFov / 2) * DEG);

export class PlayerPawn {
  /**
   * @param {{world, sv, loadout?, events?, position: THREE.Vector3, yaw?: number, pitch?: number}} opts
   *   `world`: CollisionWorld do mapa; `sv`: variáveis de movimento; `loadout`: inventário (o item na mão sai dele);
   *   `events`: barramento para EV.PLAYER_*.
   */
  constructor({ world, sv, loadout = new Loadout(), events = null, position, yaw = 0, pitch = 0 }) {
    this.world = world;
    this.bus = events;
    this.loadout = loadout;
    this.controller = new CharacterController(world, sv);
    this.state = createMoveState({ position });
    this.cmd = createMoveCmd();
    this.hands = createHands();
    this.accuracy = createAccuracyState();
    this.inaccuracy = { base: 0, move: 0, air: 0, total: 0 };
    // Item na mão no modo atual: o playerMove lê `speed` e `slowSniper`; a precisão lê o resto.
    this.held = { id: null, alt: false, speed: 0, slowSniper: false, data: accuracyData(null), cycleTime: 0 };
    this.env = { controller: this.controller, sv, dt: 1 / 64, item: this.held, events: [] };
    // Interrupções fora da ordem do tick (teleporte, morte, volta): os eventos saem por aqui.
    this._aside = { sv, events: [] };
    this.telemetry = new Telemetry();
    this.vitals = createVitals();
    this.god = false; // god do tick (o cheat): o dano não sai da vida
    this._hurt = { taken: 0, killed: false };
    this.deathEye = 0; // altura do olho quando morreu (a câmera do morto desce dali)
    this.pendingSelect = 0; // troca automática pedida pelo inventário (entra no próximo comando)
    // FOV da luneta (só visual): transição linear em graus na referência de 90°, avançada por tick e interpolada no
    // quadro (`prev`/`now`: multiplicador da tangente nos dois últimos ticks).
    const fov = SCOPE.referenceFov;
    this.fov = { deg: fov, from: fov, to: fov, time: 0, duration: 0, prev: 1, now: 1 };
    this.yaw = yaw;
    this.pitch = pitch;
    this.thirdPerson = false;
    this.prevOrigin = new THREE.Vector3();
    this.smooth = 0; // deslocamento da câmera ainda por suavizar (u)
    this.eyeOffset = 0;
    this.prevEyeOffset = 0;
    this.roll = 0; // tombo da câmera do morto (rad) no tick e no anterior (interpolado no quadro)
    this.prevRoll = 0;
    this.lastLanding = null;
    this.lastStep = null;
    this.lastSlide = null; // último fim de slide (evento)
    this.lastWallJump = null;
    this.lastHurt = null; // { taken, amount, kind, tick }
    this._wallJumped = false; // wall-jump neste tick (marca da telemetria)
    this.stats = { distance: 0, topSpeed: 0, ticks: 0, jumps: 0, steps: 0, slides: 0, wallJumps: 0 };
    // Custo da física do jogador: µs por tick (média móvel) e as consultas do último tick.
    this.physicsStats = { us: 0, sweeps: 0, overlaps: 0, triangles: 0 };
    this._camTrace = createTrace();
    this._before = { sweeps: 0, overlaps: 0, triangles: 0 };
    this._acc = { onGround: false, ducking: false, walking: false, speed2d: 0, vy: 0, weaponSpeed: 0 };
    syncHands(this.hands, this.loadout);
    this.#updateHeld();
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

  /** Multiplicador da sensibilidade do olhar: com luneta, zoomSensitivity × fov/90. */
  lookScale(zoomSensitivity) {
    return zoomLookScale(this.hands.item, this.hands.zoom, zoomSensitivity);
  }

  /** O inventário recebeu algo (give, loja): arma de posto melhor que a da mão é sacada no próximo tick. */
  onLoadout(received) {
    if (received?.kind !== 'weapon') return;
    const select = autoSwitchSelect(this.hands, received.slot);
    if (select) this.pendingSelect = select;
  }

  /**
   * Um tick: lê a entrada (morto, o comando fica vazio), troca de item, move, atualiza precisão e luneta, suaviza a
   * câmera e publica os eventos. `god`: o cheat (sem dano); `reduceMotion`: a câmera do morto só desce, sem tombar.
   */
  tick(dt, input, { noclip = false, tick = 0, god = false, reduceMotion = false } = {}) {
    const s = this.state;
    const v = this.vitals;
    this.prevOrigin.copy(s.origin);
    this.prevEyeOffset = this.eyeOffset;
    this.prevRoll = this.roll;
    this.god = god;
    s.moveType = noclip ? MOVETYPE.NOCLIP : MOVETYPE.WALK;
    const cmd = readMoveCmd(this.cmd, input, tick, this.yaw, this.pitch);
    if (!cmd.select && this.pendingSelect) cmd.select = this.pendingSelect;
    this.pendingSelect = 0;
    if (!v.alive) {
      // Morto: sem movimento, pulo, agachar nem troca; o corpo só assenta com o atrito e a gravidade.
      v.deadTime += dt;
      cmd.forward = 0;
      cmd.side = 0;
      cmd.buttons = 0;
      cmd.select = SELECT.NONE;
    }
    this.env.dt = dt;
    // 1) Item na mão antes do movimento: a velocidade deste tick já é a do item novo.
    applySelect(this.hands, this.loadout, cmd.select);
    this.#syncHands();
    // 2) Movimento, com o custo medido.
    const w = this.world.stats;
    const before = this._before;
    before.sweeps = w.sweeps;
    before.overlaps = w.overlaps;
    before.triangles = w.triangles;
    const t0 = performance.now();
    playerMove(s, cmd, this.env);
    const us = (performance.now() - t0) * 1000;
    const ps = this.physicsStats;
    ps.us += (us - ps.us) * US_SMOOTHING;
    ps.sweeps = w.sweeps - before.sweeps;
    ps.overlaps = w.overlaps - before.overlaps;
    ps.triangles = w.triangles - before.triangles;
    // 3) Precisão (ItemPostFrame): o pouso do tick soma, depois a penalidade anda.
    this.#updateAccuracy(dt);
    // 4) Luneta: o nível novo muda velocidade e precisão a partir do próximo tick.
    const zoomBefore = this.hands.zoom;
    if (updateZoom(this.hands, (cmd.buttons & BTN.ATTACK2) !== 0, dt, !noclip)) this.#onZoom(zoomBefore);
    this.#advanceFov(dt);
    // Câmera: o que o tick subiu/desceu de uma vez entra na suavização, que decai para zero.
    this.smooth = Math.max(-VIEW.smoothMax, Math.min(VIEW.smoothMax, this.smooth + s.viewOffset));
    this.smooth *= Math.exp(-dt / VIEW.smoothTime);
    if (v.alive) {
      this.eyeOffset = eyeHeight(s) + this.smooth;
      this.roll = 0;
    } else this.#deathCamera(reduceMotion);
    const events = this.env.events;
    this._wallJumped = false;
    for (let i = 0; i < events.length; i++) this.#onEvent(events[i], tick);
    this.#record(cmd);
    const st = this.stats;
    st.distance += s.origin.distanceTo(this.prevOrigin);
    st.topSpeed = Math.max(st.topSpeed, Math.hypot(s.velocity.x, s.velocity.z));
    st.ticks++;
  }

  /** Item resolvido no tick: se mudou (sacou), zera a precisão, volta o FOV na hora e avisa. */
  #syncHands() {
    const h = this.hands;
    const previous = h.item;
    const wasZoomed = this.fov.to !== SCOPE.referenceFov;
    if (!syncHands(h, this.loadout)) return;
    resetAccuracy(this.accuracy);
    this.#updateHeld();
    const f = this.fov;
    f.deg = f.from = f.to = SCOPE.referenceFov;
    f.time = f.duration = 0;
    f.prev = f.now = 1;
    if (!this.bus) return;
    this.bus.emit(EV.PLAYER_WEAPON, { item: h.item, previous, slot: h.slot });
    if (wasZoomed) this.bus.emit(EV.PLAYER_ZOOM, { level: 0, fov: null });
  }

  /** Velocidade, modo, sniper lenta e dados de precisão do item na mão (depois de troca ou de mudar o zoom). */
  #updateHeld() {
    const h = this.hands;
    const held = this.held;
    held.id = h.item;
    held.alt = weaponAlt(h.item, h.zoom);
    held.speed = itemSpeed(h.item, held.alt);
    held.slowSniper = isSlowSniper(h.item, h.zoom, held.alt);
    held.data = accuracyData(h.item);
    held.cycleTime = WEAPONS[h.item] ? fireInterval(WEAPONS[h.item]) : 0;
  }

  /** Nível de zoom mudou: modo da arma, transição do FOV e aviso. */
  #onZoom(previous) {
    const h = this.hands;
    this.#updateHeld();
    const f = this.fov;
    f.from = f.deg;
    f.to = zoomFov(h.item, h.zoom) ?? SCOPE.referenceFov;
    f.time = 0;
    f.duration = zoomTime(h.item, h.zoom);
    if (this.bus && h.zoom !== previous) this.bus.emit(EV.PLAYER_ZOOM, { level: h.zoom, fov: zoomFov(h.item, h.zoom) });
  }

  /** Avança a transição do FOV da luneta um tick (a câmera interpola entre `prev` e `now`). */
  #advanceFov(dt) {
    const f = this.fov;
    f.prev = f.now;
    f.time = Math.min(f.duration, f.time + dt);
    f.deg = f.from + (f.to - f.from) * (f.duration > 0 ? f.time / f.duration : 1);
    f.now = fovFactor(f.deg);
  }

  /** Precisão do tick com o jogador depois do movimento: pouso, penalidade e o total (com as partes). */
  #updateAccuracy(dt) {
    const s = this.state;
    const held = this.held;
    const acc = this.accuracy;
    const events = this.env.events;
    for (let i = 0; i < events.length; i++) {
      if (events[i].type === 'land') landAccuracy(acc, held.data, held.alt, events[i].speed);
    }
    const p = this._acc;
    p.onGround = s.onGround;
    p.ducking = s.duckFlag;
    p.walking = s.walking;
    p.speed2d = Math.hypot(s.velocity.x, s.velocity.z);
    p.vy = s.velocity.y;
    p.weaponSpeed = held.speed;
    updateAccuracy(acc, held.data, held.alt, p, held.cycleTime, dt);
    inaccuracyOf(acc, held.data, held.alt, p, this.env.sv.jump_impulse, this.inaccuracy);
  }

  /** Amostra do tick na telemetria (gráfico do cl_showpos e medidor de counter-strafe). */
  #record(cmd) {
    const s = this.state;
    const sy = Math.sin(cmd.yaw);
    const cy = Math.cos(cmd.yaw);
    let flags = 0;
    if (s.onGround) flags |= TFLAG.GROUND;
    if (s.walking) flags |= TFLAG.WALK;
    if (s.duckFlag) flags |= TFLAG.DUCK;
    if (s.sliding) flags |= TFLAG.SLIDE;
    if (this._wallJumped) flags |= TFLAG.WALLJUMP;
    this.telemetry.record(
      Math.hypot(s.velocity.x, s.velocity.z), s.maxSpeed, this.held.speed, precisionThreshold(this.held.speed),
      this.inaccuracy.total, -sy * cmd.forward + cy * cmd.side, -cy * cmd.forward - sy * cmd.side,
      s.velocity.x, s.velocity.z, flags,
    );
  }

  /** Evento do movimento: contagens, o dano do pouso e o barramento (EV.PLAYER_*). */
  #onEvent(e, tick = 0) {
    const bus = this.bus;
    switch (e.type) {
      case 'jump':
        this.stats.jumps++;
        bus?.emit(EV.PLAYER_JUMP, e);
        break;
      case 'land':
        this.lastLanding = e;
        bus?.emit(EV.PLAYER_LAND, e);
        if (e.damage > 0) this.hurt(e.damage, 'queda', { tick });
        break;
      case 'step':
        this.lastStep = e;
        this.stats.steps++;
        bus?.emit(EV.PLAYER_STEP, e);
        break;
      case 'slide':
        if (e.phase === 'start') this.stats.slides++;
        else this.lastSlide = e;
        bus?.emit(EV.PLAYER_SLIDE, e);
        break;
      case 'walljump':
        this.stats.wallJumps++;
        this.lastWallJump = e;
        this._wallJumped = true;
        bus?.emit(EV.PLAYER_WALLJUMP, e);
        break;
      default: // duck, unduck
        bus?.emit(EV.PLAYER_DUCK, { ducked: e.type === 'duck' });
    }
  }

  /**
   * Dano no jogador (`kind`: tipo em src/data/vitals.js): com `god` (padrão: o do tick) nada sai; a vida perde a parte
   * inteira e a fração vai para o acumulador. Publica EV.PLAYER_HURT e, se matou, a morte com `cause` (padrão: o tipo).
   */
  hurt(amount, kind, { god = this.god, cause = kind, tick = 0 } = {}) {
    const v = this.vitals;
    const r = applyDamage(v, amount, kind, { god, cause }, this._hurt);
    if (r.taken > 0) {
      this.lastHurt = { taken: r.taken, amount, kind, tick };
      this.bus?.emit(EV.PLAYER_HURT, { damage: r.taken, amount, kind, health: v.health, armor: this.loadout.armor });
    }
    if (r.killed) this.#die(cause, kind);
    return r;
  }

  /** Morte na hora (kill do console, cair para fora do set). false se já estava morto. */
  kill(cause, kind = 'mundo') {
    if (!killVitals(this.vitals, cause)) return false;
    this.#die(cause, kind);
    return true;
  }

  /** A morte: o slide e o voo são interrompidos e a câmera do morto começa da altura do olho de agora. */
  #die(cause, kind) {
    this.deathEye = this.eyeOffset;
    this.#interrupt();
    this.bus?.emit(EV.PLAYER_DEATH, { cause, kind, text: DEATH_CAUSES[cause] ?? cause });
  }

  /** Câmera do morto: o olho desce até VITALS.deathCam.eye acima dos pés e tomba (sem tombo com "reduzir movimento"). */
  #deathCamera(reduceMotion) {
    const c = VITALS.deathCam;
    const k = Math.min(1, this.vitals.deadTime / c.time);
    const e = 1 - (1 - k) * (1 - k); // desacelera no fim
    this.eyeOffset = this.deathEye + (c.eye - this.deathEye) * e;
    this.roll = reduceMotion ? 0 : c.rollDeg * DEG * e;
  }

  /** Slide e voo interrompidos fora da ordem do tick; o fim do slide (se havia) sai pelo barramento. */
  #interrupt() {
    const aside = this._aside;
    aside.events.length = 0;
    interruptMoves(this.state, aside);
    for (let i = 0; i < aside.events.length; i++) this.#onEvent(aside.events[i]);
    aside.events.length = 0;
  }

  /**
   * Volta ao jogo em `position`: vida cheia, estado de movimento novo (velocidade, stamina, agachar, slide, recarga e
   * paredes usadas), precisão zerada, luneta fechada e câmera do morto desfeita. Publica EV.PLAYER_SPAWN.
   */
  respawn(position, yaw = this.yaw, pitch = this.pitch) {
    respawnVitals(this.vitals);
    copyMoveState(createMoveState({ position }), this.state);
    resetAccuracy(this.accuracy);
    const zoomed = this.hands.zoom !== 0;
    this.hands.zoom = 0;
    this.hands.zoomCooldown = 0;
    this.#updateHeld();
    const f = this.fov;
    f.deg = f.from = f.to = SCOPE.referenceFov;
    f.time = f.duration = 0;
    f.prev = f.now = 1;
    this.roll = 0;
    this.prevRoll = 0;
    this.teleport(position, yaw, pitch);
    if (!this.bus) return;
    if (zoomed) this.bus.emit(EV.PLAYER_ZOOM, { level: 0, fov: null });
    this.bus.emit(EV.PLAYER_SPAWN, { position: this.state.origin.clone() });
  }

  /**
   * Câmera: pés, olho, tombo do morto e FOV da luneta interpolados entre ticks; rotação do olhar do último quadro
   * (resposta imediata).
   */
  updateCamera(camera, alpha) {
    camera.position.lerpVectors(this.prevOrigin, this.state.origin, alpha);
    camera.position.y += this.prevEyeOffset + (this.eyeOffset - this.prevEyeOffset) * alpha;
    camera.rotation.set(this.pitch, this.yaw, this.prevRoll + (this.roll - this.prevRoll) * alpha, 'YXZ');
    const zoom = this.fov.prev + (this.fov.now - this.fov.prev) * alpha;
    if (camera.userData.zoom !== zoom) setCameraFov(camera, camera.userData.hfov, zoom);
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

  /**
   * Teleporte (setpos, estacao, respawn): interrompe o slide e o voo (paredes usadas zeradas), zera velocidade e
   * interpolação e procura o chão.
   */
  teleport(position, yaw = this.yaw, pitch = this.pitch) {
    const s = this.state;
    this.#interrupt();
    s.origin.copy(position);
    s.velocity.set(0, 0, 0);
    s.fallVelocity = 0;
    this.yaw = yaw;
    this.pitch = pitch;
    this.controller.categorizePosition(s);
    this.prevOrigin.copy(s.origin);
    this.smooth = 0;
    if (this.vitals.alive) this.eyeOffset = eyeHeight(s);
    this.prevEyeOffset = this.eyeOffset;
  }
}
```

- [ ] **Passo 6: `kill` e `hurtme`**

```js file=src/debug/vitalsCommands.js
// Comandos da vida do jogador local (subfase 3.4): `kill` (o do CS: morte na hora, volta em 2 s) e `hurtme <n>` (o
// cheat do Source: dano do tipo mundo, que o colete não reduz; `god` segura). Falam com o PlayerPawn da partida andando.

/** @param {{matchState: () => object|null, cheats: {god: boolean}}} ctx */
export function registerVitalsCommands(con, { matchState, cheats }) {
  /** Jogador andando da partida (tem vida); erro fora dela. */
  const pawn = () => {
    const p = matchState()?.player;
    if (!p?.vitals) throw new Error('só numa partida andando (mapa com colisão)');
    return p;
  };
  con.register({
    name: 'kill',
    help: 'morte na hora do jogador local (volta em 2 s)',
    run: () => (pawn().kill('kill') ? 'você desistiu' : 'já está morto'),
  });
  con.register({
    name: 'hurtme',
    usage: '<dano>',
    help: 'dano do tipo mundo no jogador local (god segura)',
    run: ([n]) => {
      const p = pawn();
      const amount = Number(n);
      if (!(amount > 0)) throw new Error('dano inválido: use um número maior que 0 (ex.: hurtme 26)');
      if (!p.vitals.alive) return 'já está morto';
      if (cheats.god) return 'god ligado: nenhum dano';
      const r = p.hurt(amount, 'mundo', { god: false });
      return r.killed ? `dano ${amount}: morreu` : `dano ${amount} → vida ${p.vitals.health}`;
    },
  });
}
```

Em `src/debug/commands.js`, trocar:

```
import { registerStationCommands } from './stationCommands.js';
import { onOff } from './consoleArgs.js';
```

por:

```
import { registerStationCommands } from './stationCommands.js';
import { registerVitalsCommands } from './vitalsCommands.js';
import { onOff } from './consoleArgs.js';
```

Em `src/debug/commands.js`, trocar:

```
    run: ([v]) => `noclip ${s.cheats.set('noclip', onOff(v, s.cheats.noclip)) ? 'LIGADO' : 'desligado'}`,
  });

  reg({
```

por:

```
    run: ([v]) => `noclip ${s.cheats.set('noclip', onOff(v, s.cheats.noclip)) ? 'LIGADO' : 'desligado'}`,
  });
  // Vida do jogador local (3.4): kill e hurtme.
  registerVitalsCommands(con, { matchState, cheats: s.cheats });

  reg({
```

- [ ] **Passo 7: Rodar os testes da tarefa**

Run: `node --test tests/vitals.test.js tests/playerPawn.test.js`
Expected: PASS — todos os testes dos dois arquivos passando.

- [ ] **Passo 8: Suíte inteira**

Run: `npm test`
Expected: PASS — 245 testes passando.

- [ ] **Passo final: Commit** (só com o pedido do usuário)

```bash
git add src/player src/core/events.js src/debug/vitalsCommands.js src/debug/commands.js tests/vitals.test.js tests/playerPawn.test.js
git commit -m "MASSACRE 3.4: vida, morte e volta no PlayerPawn; kill e hurtme" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Tarefa 5: Pista — poço, zigue-zague, faixa de slide e as anotações da torre

**Files:**
- Modify: `src/data/pista.js`, `src/maps/pista/pieces.js`, `src/maps/pista/colliders.js` (arquivo inteiro), `src/maps/pista/layoutAdvanced.js` (arquivo inteiro), `src/maps/pista/layoutTower.js`
- Test: `tests/pistaLayout.test.js`, `tests/pistaMovement.test.js`, `tests/pistaFuzz.test.js`

Os números das estações 5 e 6, provisórios desde a 3.3, saem da simulação com o movimento pronto (seção 3.4, "Pista"): poço de 144 × 144 u por dentro e 224 u de altura, com a parede sul (a da porta) numa peça só (`part: 'poco-sul'`, levado pelas peças do layout até o `ColliderBuilder`) e as faixas numeradas acima da porta; zigue-zague num corredor de 144 u com painéis de 136 u e vão de 544 u; faixa de slide com a linha de largada, as quatro traves a 32/60/88/116 u dela sobre apoios de 20 u, marcas de fita a cada 50 u e as etiquetas; na torre, as anotações de dano numa lista (com a de 1310 acima do seu risco) e a tábua de 1460 u. As anotações também passam a ficar voltadas para fora: a base do decalque vinha espelhada desde a 3.3 (normal para dentro da tábua) e de fora elas não apareciam. Os pontos do `estacao` da 5 e da 6 mudam (o `traves` vira ponto, na linha de largada).

- [ ] **Passo 1: Escrever os testes** — as medidas novas no layout (e a orientação das notas), o poço, o zigue-zague, a faixa e a torre na colisão real, e os 10 min simulados na pista contando slides e wall-jumps.

Em `tests/pistaLayout.test.js`, trocar:

```
// Testes do layout da pista de testes (subfase 3.3): lotes na base e sem sobreposição, peças no seu lote, as medidas
// exatas de cada estação (topos, ângulos pela normal, faces de baixo, vãos, tetos, larguras, pranchas), a espiral da
// torre (degraus ≤ 18 u, nada se cruzando), superfícies válidas, pontos de teleporte livres e a busca do `estacao`.
import { test } from 'node:test';
```

por:

```
// Testes do layout da pista de testes (subfases 3.3 e 3.4): lotes na base e sem sobreposição, peças no seu lote, as
// medidas exatas de cada estação (topos, ângulos pela normal, faces de baixo, vãos, tetos, larguras, pranchas; o poço, o
// zigue-zague e a faixa de slide com os números da 3.4 e a parede sul do poço numa peça só), a espiral da torre (degraus
// ≤ 18 u, nada se cruzando) e as anotações da tábua, superfícies válidas, peças de colisão, pontos de teleporte livres e
// a busca do `estacao`.
import { test } from 'node:test';
```

Em `tests/pistaLayout.test.js`, trocar:

```
import { buildPistaColliders } from '../src/maps/pista/colliders.js';
import { pieceBox, rectInside, rectsOverlap } from '../src/maps/pista/pieces.js';
import { CollisionWorld } from '../src/physics/collisionWorld.js';
```

por:

```
import { buildPistaColliders } from '../src/maps/pista/colliders.js';
import { headingDir, pieceBox, rectInside, rectsOverlap } from '../src/maps/pista/pieces.js';
import { CollisionWorld } from '../src/physics/collisionWorld.js';
```

Em `tests/pistaLayout.test.js`, trocar:

```

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
```

por:

```

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
```

Em `tests/pistaLayout.test.js`, trocar:

```
  near(box('torre-tubo').max.y, PISTA.tower.tube.height, 1e-9, 'tubo');
});
```

por:

```
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
```

Em `tests/pistaLayout.test.js`, trocar:

```
  assert.equal(hit('gabarito'), 'slide:gabarito');
  assert.equal(hit('TÚNEL', 'meio'), 'tunel:meio');
```

por:

```
  assert.equal(hit('gabarito'), 'slide:gabarito');
  assert.equal(hit('traves'), 'slide:traves');
  assert.equal(hit('TÚNEL', 'meio'), 'tunel:meio');
```

Em `tests/pistaMovement.test.js`, trocar:

```
// não; de pé na viga de 4 u; pouso em cada prancha da torre na altura exata; roteiro que sobe a espiral até a prancha.
import { test } from 'node:test';
```

por:

```
// não; de pé na viga de 4 u; pouso em cada prancha da torre na altura exata; roteiro que sobe a espiral até a prancha.
// Subfase 3.4: o poço exige as 4 paredes (com 3 não sai); o zigue-zague passa com a faca e com a AK e um pulo sozinho
// não; o slide na largada passa sob as quatro traves e em pé bate na primeira; as pranchas da torre dão 0, 0, ~26, ~62
// de dano e a de 1310 mata.
import { test } from 'node:test';
```

Em `tests/pistaMovement.test.js`, trocar:

```
import { CONTROLLER } from '../src/data/movement.js';
import { buildPistaLayout } from '../src/maps/pista/layout.js';
```

por:

```
import { CONTROLLER } from '../src/data/movement.js';
import { createSvVars } from '../src/player/movementVars.js';
import { buildPistaLayout } from '../src/maps/pista/layout.js';
```

Em `tests/pistaMovement.test.js`, trocar:

```
import { BTN } from '../src/player/moveCmd.js';
import { forward, idle, makePlayer, run } from './playerTestUtils.js';

```

por:

```
import { BTN } from '../src/player/moveCmd.js';
import { DT, forward, idle, makePlayer, run } from './playerTestUtils.js';

```

Em `tests/pistaMovement.test.js`, trocar:

```
  assert.ok(p.state.onGround && Math.abs(p.state.origin.y - (mark.height + skin)) < 1e-6, `na prancha: ${p.state.origin.y}`);
});

```

por:

```
  assert.ok(p.state.onGround && Math.abs(p.state.origin.y - (mark.height + skin)) < 1e-6, `na prancha: ${p.state.origin.y}`);
});

// ---------- Subfase 3.4 ----------

/** Yaw que olha de `s` para o ponto (x, z). */
const yawTo = (s, x, z) => Math.atan2(-(x - s.origin.x), -(z - s.origin.z));

/** Roda o jogador com `drive` e mede o ápice, os wall-jumps e a maior altura de pés no chão depois do primeiro chute. */
function flight(p, ticks, drive) {
  const s = p.state;
  let apex = s.origin.y;
  let standTop = -Infinity;
  let walls = 0;
  run(p, ticks, (c, i) => {
    drive(c, i);
    apex = Math.max(apex, s.origin.y);
    walls = Math.max(walls, s.wallJumps);
    if (walls && s.onGround) standTop = Math.max(standTop, s.origin.y);
  });
  return { apex: Math.max(apex, s.origin.y), walls, standTop, final: s.origin.clone(), onGround: s.onGround };
}

// Poço: normal (x, z) de cada parede para dentro.
const WELL = PISTA.wallJump.well;
const WELL_NORMAL = { N: [0, 1], S: [0, -1], E: [-1, 0], W: [1, 0] };

/**
 * Sobe o poço de dentro na ordem `order` e tenta sair por cima da parede leste (para a prancha). Começa encostado na
 * parede sul (a da porta) olhando para o norte; corre, pula a `jumpAt` u da primeira parede; encostado na parede k,
 * mira a próxima (`along`: u ao longo dela a partir do meio) e aperta o pulo a cada 2 ticks.
 */
function climbWell(order, { startX = 0, jumpAt = 60, along = 0 } = {}) {
  const cx = (WELL.x[0] + WELL.x[1]) / 2;
  const cz = (WELL.z[0] + WELL.z[1]) / 2;
  const h = (WELL.x[1] - WELL.x[0]) / 2;
  const aim = (k) => {
    if (!order[k]) return [WELL.x[1] + 80, cz];
    const [nx, nz] = WELL_NORMAL[order[k]];
    return [cx - nx * h + nz * along, cz - nz * h - nx * along];
  };
  const p = makePlayer(world, [cx + startX, 0, WELL.z[1] - 20], { yaw: 0 });
  const s = p.state;
  let jumped = false;
  return flight(p, 400, (c, i) => {
    forward(c);
    const k = s.wallJumps;
    if (!jumped) {
      const [ax, az] = aim(0);
      c.yaw = yawTo(s, ax, az);
      if (s.onGround && Math.hypot(ax - s.origin.x, az - s.origin.z) > jumpAt) return;
      jumped = true;
      c.buttons = BTN.JUMP;
      return;
    }
    const wall = order[k];
    const touching = wall && s.wallTime <= 0.12 + 1e-9 && Math.abs(s.wallNx - WELL_NORMAL[wall][0]) < 0.3
      && Math.abs(s.wallNz - WELL_NORMAL[wall][1]) < 0.3;
    c.yaw = yawTo(s, ...aim(touching ? k + 1 : k));
    if (i % 2 === 0 && k < order.length && !s.onGround) c.buttons = BTN.JUMP;
  });
}

test('poço: com 3 paredes não sai (ápice ~205 u < 224); com as 4 sai por cima da parede leste e fica na prancha', () => {
  const walls = ['N', 'E', 'S', 'W'];
  let best = 0;
  for (const a of walls) for (const b of walls) for (const c of walls) {
    if (a === b || b === c || a === c) continue;
    for (const startX of [-48, 0, 48]) {
      for (const jumpAt of [60, 90]) {
        const r = climbWell([a, b, c], { startX, jumpAt });
        assert.ok(r.standTop < WELL.height - 0.5, `${a}${b}${c}: saiu com 3 paredes (pés em ${r.standTop})`);
        best = Math.max(best, r.apex);
      }
    }
  }
  assert.ok(best > 190 && best < WELL.height - 10, `ápice com 3 paredes: ${best}`);
  const r = climbWell(['E', 'N', 'S', 'W'], { startX: -48, jumpAt: 90, along: 36 });
  assert.equal(r.walls, 4, 'um wall-jump em cada parede (a sul, com a porta, é uma só)');
  const plank = WELL.height + PISTA.wallJump.exit.plankThickness;
  assert.ok(Math.abs(r.standTop - (plank + skin)) < 1e-6, `saiu para a prancha: pés em ${r.standTop}`);
});

/**
 * Atravessa o zigue-zague de A para B: corre em A para o norte, pula na borda mirando o painel 0; encostado no painel k,
 * mira o próximo (a `lead` do comprimento dele) ou o meio de B e aperta o pulo a cada 2 ticks; em B, para.
 */
function crossZigzag({ item = 'knife', sv = createSvVars(), lead = 0.35 } = {}) {
  const Z = PISTA.wallJump.zigzag;
  const zx = (Z.x[0] + Z.x[1]) / 2;
  const half = (Z.x[1] - Z.x[0]) / 2 - 16;
  const panels = [Z.west[0], Z.east[0], Z.west[1], Z.east[1]];
  const target = (k) => (k < 4
    ? [zx + (k % 2 === 0 ? -half : half), panels[k][1] - (panels[k][1] - panels[k][0]) * lead]
    : [zx, (Z.platformB[0] + Z.platformB[1]) / 2]);
  const p = makePlayer(world, [zx, Z.platformHeight, Z.platformA[1] - 20], { yaw: 0, item, sv });
  const s = p.state;
  let jumped = -1;
  let landed = false;
  let edgeY = null; // pés ao passar sobre a borda de B
  const r = flight(p, 500, (c, i) => {
    forward(c);
    if (edgeY === null && s.origin.z < Z.platformB[1]) edgeY = s.origin.y;
    if (jumped < 0) {
      c.yaw = 0;
      if (s.onGround && s.origin.z > Z.platformA[0] + 8) return;
      jumped = i;
      c.yaw = yawTo(s, ...target(0));
      c.buttons = BTN.JUMP;
      return;
    }
    if (landed || (s.onGround && i > jumped + 4)) {
      landed = true;
      c.forward = 0;
      return;
    }
    const k = s.wallJumps;
    const touching = k < 4 && s.wallTime <= 0.12 + 1e-9 && Math.abs(s.wallNx - (k % 2 === 0 ? 1 : -1)) < 0.3;
    c.yaw = yawTo(s, ...target(touching ? k + 1 : k));
    if (touching && i % 2 === 0) c.buttons = BTN.JUMP;
  });
  const f = r.final;
  const onB = r.onGround && f.z > Z.platformB[0] && f.z < Z.platformB[1] && Math.abs(f.y - (Z.platformHeight + skin)) < 1e-6;
  return { ...r, onB, edgeY };
}

test('zigue-zague: a faca e a AK passam de A para B pelos 4 painéis; sem wall-jump, o pulo cai no vão', () => {
  const Z = PISTA.wallJump.zigzag;
  for (const item of ['knife', 'ak47']) {
    const r = crossZigzag({ item });
    assert.ok(r.onB, `${item}: pousou em B (${r.final.toArray().map((v) => v.toFixed(1))})`);
    assert.equal(r.walls, 4, `${item}: um chute em cada painel`);
    assert.ok(r.edgeY > Z.platformHeight + 40, `${item}: folga ao chegar em B (pés em ${r.edgeY})`);
  }
  const sv = createSvVars();
  sv.walljump = 0;
  const r = crossZigzag({ sv });
  assert.equal(r.onB, false);
  assert.equal(r.walls, 0);
  assert.ok(r.final.y < 1, `caiu no vão (pés em ${r.final.y})`);
});

test('faixa de slide: o slide na largada passa sob as quatro traves (faca e AK); em pé bate na primeira', () => {
  const S = PISTA.slide;
  const sp = spot('slide', 'faixa').position;
  for (const item of ['knife', 'ak47']) {
    const p = makePlayer(world, [sp.x, sp.y, sp.z], { yaw: spot('slide', 'faixa').yaw, item });
    const s = p.state;
    const passes = [];
    let slid = false;
    run(p, 300, (c) => {
      forward(c);
      if (s.origin.x >= S.line - 16) slid = true; // Ctrl na linha de largada, seguro até o fim
      if (slid) c.buttons = BTN.DUCK;
      const x0 = s.origin.x;
      for (const b of S.bars) {
        const x = S.line + b.at;
        if (x0 < x && x0 + s.velocity.x * DT >= x) passes.push({ under: b.under, sliding: s.sliding, ducked: s.ducked });
      }
    });
    assert.deepEqual(passes.map((q) => q.under), [70, 64, 58, 55], `${item}: passou pelas quatro`);
    assert.ok(passes.every((q) => q.ducked), `${item}: agachado sob todas`);
    assert.ok(passes.slice(0, 3).every((q) => q.sliding), `${item}: deslizando sob as três primeiras`);
    if (item === 'knife') assert.ok(passes[3].sliding, 'faca: deslizando sob as quatro');
    assert.ok(s.origin.x > S.line + S.bars.at(-1).at + 30, `${item}: saiu do outro lado`);
  }
  const p = makePlayer(world, [sp.x, sp.y, sp.z], { yaw: spot('slide', 'faixa').yaw });
  let far = -Infinity;
  run(p, 300, (c) => {
    forward(c);
    far = Math.max(far, p.state.origin.x);
  });
  const bar = S.bars[0];
  assert.ok(far < S.line + bar.at - bar.size[0] / 2, `em pé bate na trave de 70 (chegou a ${(far - S.line).toFixed(1)} u da linha)`);
});

test('torre: saindo andando das pranchas, o pouso dá 0, 0, ~26, ~62 de dano e a de 1310 mata', () => {
  const notes = { 200: 0, 420: 0, 600: 26, 900: 62 };
  for (const h of [200, 420, 600, 900, 1310]) {
    const sp = spot('torre', String(h));
    const p = makePlayer(world, [sp.position.x, sp.position.y, sp.position.z], { yaw: sp.yaw });
    let land = null;
    for (let i = 0; i < 600 && !land; i++) {
      land = run(p, 1, (c) => {
        forward(c);
        c.buttons = BTN.WALK; // devagar: cai perto da prancha, sem pegar nada no caminho
      }).find((e) => e.type === 'land') ?? null;
    }
    assert.ok(land, `pousou da prancha de ${h}`);
    if (h === 1310) assert.ok(land.damage >= 100, `1310: ${land.damage}`);
    else assert.ok(Math.abs(land.damage - notes[h]) <= 1.2, `${h}: dano ${land.damage} (anotação ${notes[h]})`);
  }
});

```

Em `tests/pistaFuzz.test.js`, trocar:

```
// 10 minutos simulados na colisão da pista de testes (subfase 3.3; a parte automática do aceite da 3.5, adiantada):
// entrada aleatória com andar, spam de agachar, pulos e troca do item na mão, partindo de cada estação (50 s em cada
// uma, do primeiro ponto de teleporte), com empurrões de até 1500 u/s — nenhuma penetração além da folga, nunca preso,
// nunca abaixo do chão do estúdio. Depois, a mesma seed repetida dá o mesmo estado inteiro, bit a bit.
import { test } from 'node:test';
```

por:

```
// 10 minutos simulados na colisão da pista de testes (subfases 3.3 e 3.4; a parte automática do aceite da 3.5,
// adiantada): entrada aleatória com andar, spam de agachar, pulos, slides, wall-jumps e troca do item na mão, partindo
// de cada estação (50 s em cada uma, do primeiro ponto de teleporte), com empurrões de até 1500 u/s — nenhuma
// penetração além da folga, nunca preso, nunca abaixo do chão do estúdio. Depois, a mesma seed repetida dá o mesmo
// estado inteiro, bit a bit.
import { test } from 'node:test';
```

Em `tests/pistaFuzz.test.js`, trocar:

```
  const per = Math.ceil(ticks / stations.length);
  const stats = { jumps: 0, ducks: 0, kicks: 0, maxY: -Infinity, stations: 0 };
  let p = null;
```

por:

```
  const per = Math.ceil(ticks / stations.length);
  const stats = { jumps: 0, ducks: 0, kicks: 0, maxY: -Infinity, stations: 0, slides: 0, wallJumps: 0 };
  let p = null;
```

Em `tests/pistaFuzz.test.js`, trocar:

```
      if (e.type === 'duck') stats.ducks++;
    }
```

por:

```
      if (e.type === 'duck') stats.ducks++;
      if (e.type === 'slide' && e.phase === 'start') stats.slides++;
      if (e.type === 'walljump') stats.wallJumps++;
    }
```

Em `tests/pistaFuzz.test.js`, trocar:

```
  assert.ok(stats.maxY > 200, `subiu em alguma coisa (${stats.maxY})`);
});
```

por:

```
  assert.ok(stats.maxY > 200, `subiu em alguma coisa (${stats.maxY})`);
  assert.ok(stats.slides > 20, `slides ${stats.slides}`);
  assert.ok(stats.wallJumps > 20, `wall-jumps ${stats.wallJumps}`);
});
```

- [ ] **Passo 2: Rodar e ver falhar**

Run: `node --test tests/pistaLayout.test.js tests/pistaMovement.test.js tests/pistaFuzz.test.js`
Expected: FAIL — no layout, "wall-jump: poço de 144 × 144…", "slide: traves de 70/64/58/55…", "torre: 78 livros…" e "estacao: número, id, apelido e ponto…"; no movimento, "poço: com 3 paredes não sai…", "zigue-zague: a faca e a AK passam…" e "faixa de slide: o slide na largada…".

- [ ] **Passo 3: Números das estações 5, 6 e 7**

Em `src/data/pista.js`, trocar:

```
// de corte tem 3 u, os papéis décimos de u); a torre, sobre o compensado nu, mede do tampo.
// Números das estações 5 e 6 (wall-jump e slide) são provisórios: a 3.4 ajusta só estes dados.

```

por:

```
// de corte tem 3 u, os papéis décimos de u); a torre, sobre o compensado nu, mede do tampo.
// Números das estações 5 e 6 (wall-jump e slide) e as anotações da torre saem da simulação da subfase 3.4 com o
// movimento pronto (docs/phases/phase-3.md, seção 3.4); os testes da pista os fixam.

```

Em `src/data/pista.js`, trocar:

```

  // 5 · Wall-jump (provisório da 3.4): poço de compensado e zigue-zague de painéis.
  wallJump: F({
    well: F({
      x: F([-2538, -2362]), z: F([62, 238]), wall: 8, height: 256,
      door: F({ x: F([-2498, -2402]), height: 88 }),
      stripes: list( // parede: faixa de cor e número na face de dentro
```

por:

```

  // 5 · Wall-jump: poço de compensado de 144 × 144 u por dentro e 224 u de altura — com o movimento pronto, 3 paredes
  // sobem até ~205 u e 4 saem até ~248 u — e zigue-zague de painéis de 136 u num corredor de 144 u: o vão entre as
  // plataformas (4 painéis, 544 u) é maior que qualquer pulo correndo ou bhop (~210 u); a faca e a AK passam.
  wallJump: F({
    well: F({
      x: F([-2522, -2378]), z: F([78, 222]), wall: 8, height: 224,
      door: F({ x: F([-2482, -2418]), height: 88 }),
      part: 'poco-sul', // as três peças da parede sul (a da porta) são uma parede só para o wall-jump
      stripeY: 152, // centro das faixas numeradas (acima da porta)
      stripes: list( // parede: faixa de cor e número na face de dentro
```

Em `src/data/pista.js`, trocar:

```
    }),
    exit: F({ plankWidth: 64, plankThickness: 6, tower: F({ x: F([-2300, -2120]), z: F([60, 240]), height: 256, layers: 4 }) }),
    zigzag: F({
      x: F([-1850, -1650]), platformA: F([700, 900]), platformB: F([-140, 60]), platformHeight: 128, layers: 2,
      panel: F({ thickness: 8, length: 160, height: 320 }),
      west: F([F([540, 700]), F([220, 380])]),
      east: F([F([380, 540]), F([60, 220])]),
      ramp: F({ deg: 30, width: 160 }),
    }),
```

por:

```
    }),
    exit: F({ plankWidth: 64, plankThickness: 6, tower: F({ x: F([-2300, -2120]), z: F([60, 240]), height: 224, layers: 4 }) }),
    zigzag: F({
      x: F([-1822, -1678]), platformA: F([700, 900]), platformB: F([-44, 156]), platformHeight: 128, layers: 2,
      panel: F({ thickness: 8, length: 136, height: 320 }),
      west: F([F([564, 700]), F([292, 428])]),
      east: F([F([428, 564]), F([156, 292])]),
      ramp: F({ deg: 30, width: 144 }),
    }),
```

Em `src/data/pista.js`, trocar:

```

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
```

por:

```

  // 6 · Faixa de slide e gabarito de portais. Corrida de ~500 u até a linha de largada; as quatro traves na ordem do
  // limbo logo depois dela (`at`: u da linha), dentro do alcance de um slide da AK (~129 u); marcas de fita a cada 50 u
  // da linha para ler a distância do slide. Em pé bate na primeira; deslizando passa pelas quatro.
  slide: F({
    lane: F({ x: F([-2600, -1500]), z: F([1195, 1345]) }),
    line: -2080,
    marks: F({ every: 50, to: 400, width: 6, labelZ: 1400 }),
    supportZ: F([1175, 1365]), support: 20, labelZ: 1140,
    bars: list(
      { at: 32, kind: 'regua', under: 70, stack: [48, 11, 11], size: [30, 3, 300] },
      { at: 60, kind: 'lapis', under: 64, stack: [48, 8, 8], size: [7, 7, 175] },
      { at: 88, kind: 'aco', under: 58, stack: [48, 10], size: [25, 1, 300] },
      { at: 116, kind: 'espeto', under: 55, stack: [48, 7], size: [4, 4, 300] },
    ),
```

Em `src/data/pista.js`, trocar:

```
    spot: F({ at: 400, pitch: -25, spiralAt: 200, spiralBefore: 30 }), // teleporte: na prancha olhando o alvo
    growth: F({
      at: 330, heading: 116, size: F([60, 1400, 12]), noteHeight: 15,
      notes: F({ 200: '200 · leve', 420: '420 · o limite seguro', 600: '600 · dói', 900: '900 · dói muito', 1310: '1310 · fatal' }),
    }),
```

por:

```
    spot: F({ at: 400, pitch: -25, spiralAt: 200, spiralBefore: 30 }), // teleporte: na prancha olhando o alvo
    // Tábua de crescimento: as anotações são o dano de queda (3.4) de cada prancha, arredondado (saindo andando varia
    // ±1 com o tick do pouso), e o risco onde a queda do repouso passa a matar; a de 1310 fica acima do risco (`up`).
    growth: F({
      at: 330, heading: 116, size: F([60, 1460, 12]), noteHeight: 15,
      notes: list(
        { at: 200, text: '200 · sem dano' }, { at: 420, text: '420 · o limite seguro' }, { at: 600, text: '600 · −26' },
        { at: 900, text: '900 · −62' }, { at: 1280, text: 'daqui para cima, fatal' },
        { at: 1310, text: '1310 · fatal', up: true },
      ),
    }),
```

Em `src/data/pista.js`, trocar:

```
      { id: 'poco', label: 'porta do poço', at: [-2450, 420], heading: 0 },
      { id: 'ziguezague', label: 'plataforma A', at: [-1750, 800], heading: 180 },
    ] },
    { number: 6, id: 'slide', label: 'Vãos de slide e gabarito', aliases: ['vaos', 'traves', 'agachar'], spots: [
      { id: 'faixa', label: 'início da faixa', at: [-2580, 1270], heading: 90 },
      { id: 'gabarito', label: 'portais', at: [-2280, 1540], heading: 180 },
```

por:

```
      { id: 'poco', label: 'porta do poço', at: [-2450, 420], heading: 0 },
      { id: 'ziguezague', label: 'plataforma A', at: [-1750, 860], heading: 0 },
    ] },
    { number: 6, id: 'slide', label: 'Vãos de slide e gabarito', aliases: ['vaos', 'deslizar', 'agachar'], spots: [
      { id: 'faixa', label: 'início da corrida', at: [-2580, 1270], heading: 90 },
      { id: 'traves', label: 'linha de largada', at: [-2104, 1270], heading: 90 },
      { id: 'gabarito', label: 'portais', at: [-2280, 1540], heading: 180 },
```

- [ ] **Passo 4: Nome de peça do layout até a colisão**

Em `src/maps/pista/pieces.js`, trocar:

```
   * Peça sólida. `station`: número da estação (0 = base, cerca, praça). `look`: aparência ({ kind, ... }); kind
   * 'none' = só colisão.
   */
  add({ id, station = 0, shape = 'box', size, matrix, surface = 'padrao', collide = true, look = { kind: 'none' } }) {
    this.#claim(id);
    const p = { id, station, shape, size: Object.freeze([...size]), matrix, surface, collide, look };
    this.pieces.push(p);
```

por:

```
   * Peça sólida. `station`: número da estação (0 = base, cerca, praça). `look`: aparência ({ kind, ... }); kind
   * 'none' = só colisão. `part`: nome que junta peças numa parede só para o wall-jump (ColliderBuilder); sem nome, cada
   * peça é uma parede.
   */
  add({
    id, station = 0, shape = 'box', size, matrix, surface = 'padrao', collide = true, look = { kind: 'none' }, part = null,
  }) {
    this.#claim(id);
    const p = { id, station, shape, size: Object.freeze([...size]), matrix, surface, collide, look, part };
    this.pieces.push(p);
```

```js file=src/maps/pista/colliders.js
// Formas de colisão da pista de testes a partir das peças do layout (pieces.js): caixas, cunhas, cilindros e as
// plaquinhas em "A" (duas cunhas de costas). O relevo visual (empeno do papelão, cantos arredondados da faia, lombada
// do livro, calombos da massinha) não entra: colisão lisa com as medidas exatas das estações. Cada peça é uma peça do
// ColliderBuilder (uma parede para o wall-jump); a `part` da peça junta várias numa só. Puro.

import * as THREE from 'three';
import { ColliderBuilder } from '../../physics/colliders.js';

const _m = new THREE.Matrix4();
const _local = new THREE.Matrix4();

/** Plaquinha dobrada em "A": duas rampas de costas (uma peça só), subindo das bordas da base até a cumeeira em z = 0. */
function tent(b, [w, h, d], matrix, surface, part) {
  const half = d / 2;
  // Metade da frente: sobe de z = −d/2 (y = 0) até z = 0 (y = h).
  b.ramp(w, half, h, { matrix: _m.multiplyMatrices(matrix, _local.makeTranslation(0, 0, -half)), surface, part });
  // Metade de trás: a mesma rampa girada 180° em Y, subindo de z = +d/2.
  _local.makeRotationY(Math.PI).setPosition(0, 0, half);
  b.ramp(w, half, h, { matrix: _m.multiplyMatrices(matrix, _local), surface, part });
}

/** ColliderBuilder com todas as peças que colidem. */
export function buildPistaColliders(layout) {
  const b = new ColliderBuilder();
  for (const p of layout.pieces) {
    if (!p.collide) continue;
    const [a, c, d] = p.size;
    const { matrix, surface, part } = p;
    if (p.shape === 'box') b.box(a, c, d, { matrix, surface, part });
    else if (p.shape === 'ramp') b.ramp(a, d, c, { matrix, surface, part });
    else if (p.shape === 'cylinder') b.cylinder(a, c, { segments: 32, matrix, surface, part });
    else if (p.shape === 'tent') tent(b, p.size, matrix, surface, part ?? p.id);
    else throw new Error(`forma de colisão desconhecida na pista: ${p.shape} (${p.id})`);
  }
  return b;
}
```

- [ ] **Passo 5: Estações 5 e 6 no layout** (arquivo inteiro).

```js file=src/maps/pista/layoutAdvanced.js
// Estações 5 e 6 da pista de testes (números da 3.4): o poço de wall-jump de compensado com a saída por prancha até a
// torre de blocos (as três peças da parede sul formam uma parede só), o zigue-zague de painéis entre duas plataformas,
// a faixa de slide — linha de largada, marcas de distância e as traves de objetos de verdade (régua, lápis, régua de
// aço, espeto de bambu) juntas logo depois da linha, sobre apoios da altura exata — e o gabarito de portais com verga de
// régua. Referências: PKG3/PKG6/PKG11/PKC14 (poço e paredes numeradas), PKG19 (blocos), PRU1/PRU3/PRU15 (traves),
// CFO19 (palitos e etiquetas). Puro: só dados.

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

/**
 * 5 · Poço: quatro paredes de compensado de 8 u, porta na sul (as três peças da parede sul no grupo `W.part`: uma
 * parede só para o wall-jump), faixas numeradas por dentro, prancha até a torre.
 */
function well({ data, L, rng }) {
  const W = data.wallJump.well;
  const E = data.wallJump.exit;
  const n = 5;
  const t = W.wall;
  const H = W.height;
  const [ix0, ix1] = W.x;
  const [iz0, iz1] = W.z;
  const [ox0, ox1, oz0, oz1] = [ix0 - t, ix1 + t, iz0 - t, iz1 + t];
  const ply = (id, xr, yr, zr, axis, part = null) => L.board(id, xr, yr, zr, axis, {
    station: n, surface: 'madeira', part, look: { kind: 'plywood' },
  });
  ply('poco-norte', [ox0, ox1], [0, H], [oz0, iz0], 'z');
  ply('poco-sul-oeste', [ox0, W.door.x[0]], [0, H], [iz1, oz1], 'z', W.part);
  ply('poco-sul-leste', [W.door.x[1], ox1], [0, H], [iz1, oz1], 'z', W.part);
  ply('poco-sul-verga', W.door.x, [W.door.height, H], [iz1, oz1], 'z', W.part);
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
      matrix: wallDecalMatrix(x, W.stripeY, z, facing),
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

/**
 * 6 · Faixa de slide: fitas nas bordas, linha de largada atravessada, marcas de distância a cada `marks.every` u com o
 * número ao sul da faixa e as traves atravessadas logo depois da linha, com a face de baixo exata sobre apoios estreitos
 * de bloco e caderninhos e a etiqueta da altura ao norte.
 */
function slide({ data, L, rng }) {
  const S = data.slide;
  const n = 6;
  const [lx0, lx1] = S.lane.x;
  const [lz0, lz1] = S.lane.z;
  const zc = (lz0 + lz1) / 2;
  S.lane.z.forEach((z, i) => {
    L.addDecor({ id: `slide-fita-${i}`, station: n, kind: 'tape', matrix: floorStripMatrix((lx0 + lx1) / 2, 0.1, z, 90), length: lx1 - lx0, width: 19 });
  });
  // Linha de largada (fita crepe atravessada) e as marcas de distância, fitas finas por cima das das bordas.
  L.addDecor({ id: 'slide-largada', station: n, kind: 'tape', matrix: floorStripMatrix(S.line, 0.2, zc, 180), length: lz1 - lz0 + 19, width: 19 });
  L.addDecor({
    id: 'slide-largada-etiqueta', station: n, kind: 'label', text: 'largada', matrix: floorDecalMatrix(S.line, 0.3, S.marks.labelZ, 90),
  });
  const M = S.marks;
  for (let d = M.every; d <= M.to; d += M.every) {
    L.addDecor({
      id: `slide-marca-${d}`, station: n, kind: 'tape', matrix: floorStripMatrix(S.line + d, 0.2, zc, 180), length: lz1 - lz0 + 19, width: M.width,
    });
    L.addDecor({
      id: `slide-marca-${d}-etiqueta`, station: n, kind: 'label', text: `${d} u`, matrix: floorDecalMatrix(S.line + d, 0.3, M.labelZ, 90),
    });
  }
  const r = rng('slide');
  const half = S.support / 2;
  for (const b of S.bars) {
    const [bw, bt, bl] = b.size;
    const x = S.line + b.at;
    S.supportZ.forEach((z, j) => {
      let y = 0;
      b.stack.forEach((h, k) => {
        const id = `slide-${b.under}-apoio-${j}-${k}`;
        const look = k === 0 ? { kind: 'beech', radius: 2, tint: beechTint(r) } : bookLook(data, r);
        // Caderninhos com a lombada virada para quem vem correndo (oeste).
        L.standing(id, x, y, z, [S.support, h, S.support], k === 0 ? 0 : 90 + r.float(-3, 3), {
          station: n, surface: k === 0 ? 'madeira' : 'papelao', look,
        });
        y += h;
      });
      L.addDecor({
        id: `slide-${b.under}-bolota-${j}`, station: n, kind: 'clayLump', seed: `slide-${b.under}-${j}`,
        color: data.prints.colors[(j + b.under) % data.prints.colors.length],
        matrix: new THREE.Matrix4().makeTranslation(x, b.under + bt, z + (j ? -half * 0.2 : half * 0.2)),
      });
    });
    const surface = b.kind === 'aco' ? 'metal' : 'madeira';
    L.standing(`slide-${b.under}-trave`, x, b.under, zc, [bw, bt, bl], 0, { station: n, surface, look: { kind: b.kind, size: b.size } });
    L.addDecor({
      id: `slide-${b.under}-etiqueta`, station: n, kind: 'label', text: `${b.under} u`,
      matrix: floorDecalMatrix(x, 0.3, S.labelZ, 90),
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

- [ ] **Passo 6: Anotações da torre**

Em `src/maps/pista/layoutTower.js`, trocar:

```
// espessura própria para que cada marca de queda caia exata; pranchas de compensado apoiadas nos livros das marcas,
// giradas para trás; alvos pintados no chão; tábua de crescimento com as alturas (WRG1/WRG4/WRG11). Puro: só dados.

```

por:

```
// espessura própria para que cada marca de queda caia exata; pranchas de compensado apoiadas nos livros das marcas,
// giradas para trás; alvos pintados no chão; tábua de crescimento com as alturas e o dano de queda de cada uma
// (WRG1/WRG4/WRG11). Puro: só dados.

```

Em `src/maps/pista/layoutTower.js`, trocar:

```
  }
  // Tábua de crescimento em pé, voltada para fora: numerais a cada 100 u e traços a cada 10 u (measureMaterials) e,
  // nas cinco alturas, o risco a lápis atravessado e a anotação à mão escrita ao longo da tábua (de baixo para cima,
  // terminando no risco), na metade direita — a tábua é estreita como uma régua de parede.
  const G = T.growth;
```

por:

```
  }
  // Tábua de crescimento em pé, voltada para fora: numerais a cada 100 u e traços a cada 10 u (measureMaterials) e, em
  // cada anotação, o risco a lápis atravessado e o texto à mão escrito ao longo da tábua (de baixo para cima, terminando
  // no risco; com `up`, começando nele), na metade direita — a tábua é estreita como uma régua de parede.
  const G = T.growth;
```

Em `src/maps/pista/layoutTower.js`, trocar:

```
  const [nx, nz] = headingDir(G.heading);
  const [rx, rz] = headingDir(G.heading + 90); // à direita de quem olha a tábua de fora
  const front = G.size[2] / 2 + 0.08;
```

por:

```
  const [nx, nz] = headingDir(G.heading);
  // À direita de quem olha a tábua de fora (olhando para o rumo + 180°). A nota tem X local para cima e Y local para a
  // esquerda dessa pessoa: a normal (X × Y) sai para fora, como a do risco, e o texto lê de baixo para cima.
  const [rx, rz] = headingDir(G.heading - 90);
  const front = G.size[2] / 2 + 0.08;
```

Em `src/maps/pista/layoutTower.js`, trocar:

```
  const fz = gz + nz * front;
  for (const [h, text] of Object.entries(G.notes)) {
    const y = Number(h);
    L.addDecor({
```

por:

```
  const fz = gz + nz * front;
  for (const { at: y, text, up = false } of G.notes) {
    L.addDecor({
```

Em `src/maps/pista/layoutTower.js`, trocar:

```
      id: `torre-nota-${y}`, station: n, kind: 'ink', cell: `nota-${y}`, text, size: [len, G.noteHeight],
      matrix: basisMatrix([fx + rx * side + nx * 0.02, y - 4 - len / 2, fz + rz * side + nz * 0.02], [0, 1, 0], [-rx, 0, -rz]),
    });
```

por:

```
      id: `torre-nota-${y}`, station: n, kind: 'ink', cell: `nota-${y}`, text, size: [len, G.noteHeight],
      matrix: basisMatrix([fx + rx * side + nx * 0.02, up ? y + 4 + len / 2 : y - 4 - len / 2, fz + rz * side + nz * 0.02], [0, 1, 0], [-rx, 0, -rz]),
    });
```

- [ ] **Passo 7: Rodar os testes da tarefa**

Run: `node --test tests/pistaLayout.test.js tests/pistaMovement.test.js tests/pistaFuzz.test.js tests/stationCommands.test.js`
Expected: PASS — todos os testes dos quatro arquivos passando.

- [ ] **Passo 8: Suíte inteira**

Run: `npm test`
Expected: PASS — 249 testes passando.

- [ ] **Passo final: Commit** (só com o pedido do usuário)

```bash
git add src/data/pista.js src/maps/pista tests/pistaLayout.test.js tests/pistaMovement.test.js tests/pistaFuzz.test.js
git commit -m "MASSACRE 3.4: estações 5 e 6 e as anotações da torre com os números do movimento pronto" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Tarefa 6: Medidor de salto, `cl_showpos`, gráfico e `r_colisao`

**Files:**
- Modify: `src/debug/jumpMeter.js` (arquivo inteiro), `src/debug/showPos.js` (arquivo inteiro), `src/debug/speedGraph.js`, `src/debug/physicsDebug.js`, `styles/debug.css`
- Test: `tests/jumpMeter.test.js`

O medidor de salto conta os wall-jumps de cada voo (um wall-jump sem voo em andamento abre um voo de queda), guarda o dano de cada pouso e o recorde de wall-jumps seguidos. O `cl_showpos` ganha as linhas de vida (colete, acumulado, último dano, mortes e, morto, a causa e a contagem), de slide (estado, recarga, o último slide) e de parede (normal, peça e idade do contato, paredes usadas, wall-jumps no voo, espera e o total), o dano no pouso e os wall-jumps no salto e nos recordes, com a legenda nova. O gráfico dos 4 s desenha a faixa laranja dos ticks de slide e uma marca rosa em cada wall-jump; o `r_colisao` mostra o contato de parede da sonda (um segmento pela normal, enquanto vale a tolerância).

- [ ] **Passo 1: Escrever os testes**

Em `tests/jumpMeter.test.js`, trocar:

```
// Testes do medidor de salto e queda (subfase 3.3): sequências sintéticas (pulo, queda de beirada, teleporte, noclip,
// série de bhop que quebra com 2 ticks no chão) e o jogador do jogo simulado — pulo parado, pulo correndo, série de bhop
// perfeita e a queda de 900 u.
import { test } from 'node:test';
```

por:

```
// Testes do medidor de salto e queda (subfases 3.3 e 3.4): sequências sintéticas (pulo, queda de beirada, teleporte,
// noclip, série de bhop que quebra com 2 ticks no chão, wall-jumps do voo, dano do pouso e o recorde de wall-jumps
// seguidos) e o jogador do jogo simulado — pulo parado, pulo correndo, série de bhop perfeita, a queda de 900 u com o
// dano e um voo de dois wall-jumps entre duas paredes.
import { test } from 'node:test';
```

Em `tests/jumpMeter.test.js`, trocar:

```

test('interrupt (teleporte de perto): descarta o voo, fecha a série e guarda o último voo e os recordes', () => {
```

por:

```

test('wall-jumps do voo, dano do pouso e o recorde de wall-jumps seguidos (3.4)', () => {
  const m = new JumpMeter();
  m.update(st(0, 0, 0, true), []);
  m.update(st(4, 10, 0, false, 250), [{ type: 'jump' }]);
  m.update(st(8, 50, 0, false, 250), [{ type: 'walljump' }]);
  assert.equal(m.air.walls, 1);
  m.update(st(12, 90, 0, false, 250), [{ type: 'walljump' }]);
  m.update(st(16, 40, 0, false, 250), []);
  m.update(st(20, 0, 0, true, 250), [{ type: 'land', speed: 900, damage: 13.5 }]);
  assert.equal(m.last.walls, 2);
  assert.equal(m.last.damage, 13.5);
  assert.equal(m.best.walls, 2);
  m.update(st(24, 10, 0, false, 250), [{ type: 'jump' }]);
  m.update(st(28, 50, 0, false, 250), [{ type: 'walljump' }]);
  m.update(st(32, 0, 0, true, 250), [{ type: 'land', speed: 300, damage: 0 }]);
  assert.equal(m.last.walls, 1);
  assert.equal(m.best.walls, 2, 'o recorde fica');
  // Wall-jump num voo que o medidor não viu começar (teleporte no ar): o voo começa ali.
  m.interrupt();
  m.update(st(500, 300, 0, false), [{ type: 'walljump' }]);
  assert.equal(m.air.walls, 1);
  assert.equal(m.air.kind, AIR_KIND.FALL);
  m.reset();
  assert.equal(m.best.walls, 0);
});

test('interrupt (teleporte de perto): descarta o voo, fecha a série e guarda o último voo e os recordes', () => {
```

Em `tests/jumpMeter.test.js`, trocar:

```
  near(m.last.landSpeed, Math.sqrt(2 * 800 * 900), 15, 'velocidade de pouso');
  assert.equal(m.best.drop, m.last.drop);
});

```

por:

```
  near(m.last.landSpeed, Math.sqrt(2 * 800 * 900), 15, 'velocidade de pouso');
  assert.ok(m.last.damage > 55 && m.last.damage < 70, `dano do pouso ${m.last.damage}`);
  assert.equal(m.best.drop, m.last.drop);
});

test('simulado: pulo entre duas paredes com dois wall-jumps no mesmo voo (3.4)', () => {
  // Corredor de 128 u entre duas paredes altas (faces em x = ±64).
  const world = worldOf((b) => {
    floor(b);
    b.box(8, 1000, 600, { center: [68, 500, 0] });
    b.box(8, 1000, 600, { center: [-68, 500, 0] });
  });
  const p = makePlayer(world, [64 - 16 - 2, 0, 0]); // a 2 u da parede de +x
  const m = new JumpMeter();
  const step = stepper(p, m);
  for (let i = 0; i < 4; i++) step(idle);
  step((c) => {
    idle(c);
    c.buttons = BTN.JUMP;
  });
  // No ar: olhando para −x (yaw 90°), aperta o pulo a cada 2 ticks — encostado na parede de +x chuta para −x, e na de
  // −x (olhando para ela, de frente) sai pela normal, de volta para +x.
  for (let i = 0; i < 120 && !(m.last && m.last.walls); i++) {
    step((c) => {
      idle(c);
      c.yaw = Math.PI / 2;
      c.buttons = i % 2 ? BTN.JUMP : 0;
    });
  }
  assert.ok(m.last, 'pousou');
  assert.equal(m.last.walls, 2, 'duas paredes, um wall-jump em cada');
  assert.equal(m.best.walls, 2);
  assert.ok(m.last.apex > 57 + 40, `ápice ${m.last.apex}: bem acima do pulo do chão (57 u) com os dois chutes`);
});

```

- [ ] **Passo 2: Rodar e ver falhar**

Run: `node --test tests/jumpMeter.test.js`
Expected: FAIL — "wall-jumps do voo, dano do pouso e o recorde de wall-jumps seguidos (3.4)", "simulado: queda de 900 u de uma plataforma…" e "simulado: pulo entre duas paredes com dois wall-jumps no mesmo voo (3.4)".

- [ ] **Passo 3: Medidor de salto** (arquivo inteiro).

```js file=src/debug/jumpMeter.js
// Medidor de salto e queda (subfase 3.3), para a pista de testes e o cl_showpos. Por voo — pulo ou queda de uma beirada
// —: distância no plano da saída ao pouso, ápice acima da saída, tempo no ar, queda (ápice − pouso) e velocidade de
// pouso (a do evento `land` do movimento). Por série de bhop — pulos com até 1 tick no chão entre eles —: número de
// pulos, distância total, velocidade média (distância ÷ tempo da série) e máxima no plano. Teleporte (mais que 64 u num
// tick) e noclip descartam o voo e a série; o matchState também chama `interrupt()` em todo teleporte (estacao, setpos,
// respawn), perto ou longe. Na 3.4 cada voo conta os wall-jumps e o pouso guarda o dano de queda; o recorde de wall-jumps
// seguidos (num voo só) entra nos recordes. Puro: o matchState chama `update(estado, eventos)` a cada tick, como o
// medidor de counter-strafe, e o cl_showpos lê `air`, `last`, `shownSeries` e `best`.

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
    this.air = null; // voo em andamento: { kind, x, y, z, apex, ticks, maxSpeed, walls }
    this.last = null; // último voo: { kind, distance, apex, time, drop, landSpeed, damage, walls, maxSpeed }
    this.series = null; // série de bhop em andamento: { jumps, distance, ticks, maxSpeed }
    this.lastSeries = null; // última série terminada com 2 ou mais pulos
    this.best = { distance: 0, drop: 0, series: 0, walls: 0 }; // recordes desde o reset
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
   * tick (usa 'jump', 'walljump' e 'land').
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
    let walls = 0;
    let land = null;
    for (const e of events) {
      if (e.type === 'jump') jumped = true;
      else if (e.type === 'walljump') walls++;
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
      this.air = {
        kind: jumped ? AIR_KIND.JUMP : AIR_KIND.FALL, x: from.x, y: from.y, z: from.z, apex: from.y, ticks: 0, maxSpeed: 0,
        walls: 0,
      };
    }
    if (!this.air && walls) {
      // Wall-jump num voo que o medidor não viu começar (teleporte no ar): o voo conta daqui.
      this.air = { kind: AIR_KIND.FALL, x: o.x, y: o.y, z: o.z, apex: o.y, ticks: 0, maxSpeed: 0, walls: 0 };
    }
    if (this.air) {
      const a = this.air;
      a.ticks++;
      a.walls += walls;
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
      landSpeed: land ? land.speed : 0, damage: land?.damage ?? 0, walls: a.walls, maxSpeed: a.maxSpeed,
    };
    this.best.distance = Math.max(this.best.distance, distance);
    this.best.drop = Math.max(this.best.drop, this.last.drop);
    this.best.walls = Math.max(this.best.walls, a.walls);
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

- [ ] **Passo 4: Linhas novas do `cl_showpos`** (arquivo inteiro).

```js file=src/debug/showPos.js
// cl_showpos (Fases 3.1 a 3.4): pés, ângulos, velocidade, chão e cápsula do jogador; item na mão e luneta; o teto do
// tick com os fatores (andar, stamina, agachar); stamina; agachar; a inaccuracy com as partes; último passo e pouso;
// vida, slide e contato de parede (3.4); o placar do counter-strafe, o medidor de salto e queda (último voo com os
// wall-jumps e o dano, série de bhop e recordes; src/debug/jumpMeter.js) e o gráfico dos últimos 4 s
// (src/debug/speedGraph.js). Painel no canto, atualizado 15 vezes por segundo (texto, sem custo de layout a cada quadro).

import { h } from '../ui/dom.js';
import { WALLJUMP } from '../data/movement.js';
import { SURFACES } from '../data/surfaces.js';
import { DEATH_CAUSES, VITALS } from '../data/vitals.js';
import { WEAPONS } from '../data/weapons.js';
import { itemName, zoomFov, zoomLevels } from '../player/hands.js';
import { precisionThreshold } from '../player/inaccuracy.js';
import { MOVETYPE } from '../player/movement.js';
import { SpeedGraph } from './speedGraph.js';
import { STRAFE_KIND } from './strafeMeter.js';

const DEG = 180 / Math.PI;
const f1 = (v) => v.toFixed(1).padStart(8);
const f2 = (v) => v.toFixed(2);
const f5 = (v) => v.toFixed(5);
const yesNo = (v) => (v ? 'sim' : 'não');

/** Nome do modo alt da arma na mão (luneta, silenciador ou rajada). */
function altLabel(itemId) {
  const w = WEAPONS[itemId];
  if (w?.scope) return 'luneta';
  return w?.silencer ? 'silenciador' : 'rajada';
}

/** Linha do item na mão: nome, velocidade no modo atual, luneta e modo. */
function heldLine(pawn) {
  const { hands, held } = pawn;
  const levels = zoomLevels(hands.item);
  let zoom = '';
  if (levels) {
    const fov = hands.zoom ? ` (${zoomFov(hands.item, hands.zoom)}°)` : '';
    zoom = ` · luneta ${hands.zoom}/${levels}${fov}`;
  }
  const alt = held.alt && !WEAPONS[hands.item]?.scope ? ` · ${altLabel(hands.item)}` : '';
  return `mão   ${itemName(hands.item)} · ${held.speed} u/s${zoom}${alt}${held.slowSniper ? ' · sniper lenta' : ''}`;
}

/** Placar de um tipo de medida do counter-strafe. */
function strafeLine(meter, kind) {
  const s = meter.scores[kind];
  const active = meter.kind === kind ? ' · medindo…' : '';
  if (!s.count) return `${kind.padEnd(6)} —${active}`;
  return `${kind.padEnd(6)} ${s.lastTicks} ticks · ${s.last.toFixed(0)} ms · melhor ${s.best.toFixed(0)} · média ` +
    `${s.avg.toFixed(0)} (${s.recent.length})${active}`;
}

/** Vida (3.4): vida, colete, acumulado do dano, último dano e mortes; morto, a causa e a volta. */
function vitalsLine(pawn) {
  const v = pawn.vitals;
  const hurt = pawn.lastHurt;
  const last = hurt ? ` · último −${hurt.taken} (${hurt.amount.toFixed(2)}, ${hurt.kind})` : '';
  const dead = v.alive ? '' : ` · MORTO: ${DEATH_CAUSES[v.cause] ?? v.cause}, volta em `
    + `${Math.max(0, VITALS.respawnDelay - v.deadTime).toFixed(1)} s`;
  return `vida  ${v.health} · colete ${pawn.loadout.armor} · acumulado ${f2(v.accumulator)}${last}`
    + ` · mortes ${v.deaths}${dead}`;
}

/** Slide (3.4): estado e tempo, recarga, saída e o último slide (distância, tempo, entrada → saída, motivo). */
function slideLine(pawn) {
  const s = pawn.state;
  const now = s.sliding ? `deslizando ${s.slideTime.toFixed(2)} s${s.slideAir > 0 ? ` (no ar ${s.slideAir.toFixed(2)} s)` : ''}` : 'parado';
  const cool = s.slideCooldown > 0 ? ` · recarga ${s.slideCooldown.toFixed(2)} s` : '';
  const exit = s.slideExit ? ' · saída freando' : '';
  const e = pawn.lastSlide;
  const last = e
    ? ` · último: ${e.distance.toFixed(1)} u em ${e.time.toFixed(2)} s, ${e.entrySpeed.toFixed(0)} → `
      + `${e.exitSpeed.toFixed(0)} u/s, ${e.reason}`
    : '';
  return `slide ${now}${cool}${exit}${last} · ${pawn.stats.slides} slides`;
}

/** Parede (3.4): último contato (direção e idade em ticks), paredes usadas no voo, buffer do pulo e espera. */
function wallLine(pawn, dt) {
  const s = pawn.state;
  const contact = s.wallTime < WALLJUMP.ageMax
    ? `normal ${f2(s.wallNx)} ${f2(s.wallNz)} · peça ${s.wallPart} · há ${Math.round(s.wallTime / dt)} ticks`
    : 'sem contato';
  const buffer = s.jumpBuffer > 0 ? ` · buffer ${s.jumpBuffer.toFixed(2)} s` : '';
  const wait = s.wallJumpCooldown > 0 ? ` · espera ${s.wallJumpCooldown.toFixed(2)} s` : '';
  return `pared. ${contact} · usadas ${Math.min(s.usedCount, WALLJUMP.maxUsed)} · wall-jumps no voo ${s.wallJumps}`
    + `${buffer}${wait} · ${pawn.stats.wallJumps} no total`;
}

/** Linhas do medidor de salto e queda: último voo (e o em andamento), recordes e a série de bhop. */
function jumpLines(m) {
  const last = m.last;
  const walls = (n) => (n ? ` · ${n} wall-jump${n > 1 ? 's' : ''}` : '');
  const lastText = last
    ? `${last.kind} ${last.distance.toFixed(1)} u · ápice ${last.apex.toFixed(1)} · ${last.time.toFixed(2)} s`
      + ` · queda ${last.drop.toFixed(1)} · pouso ${last.landSpeed.toFixed(0)} u/s`
      + `${last.damage > 0 ? ` · dano ${last.damage.toFixed(2)}` : ''}${walls(last.walls)}`
    : '—';
  const air = m.air
    ? ` · no ar: ${m.air.kind} ${(m.air.ticks * m.dt).toFixed(2)} s, ápice ${(m.air.apex - m.air.y).toFixed(1)}${walls(m.air.walls)}`
    : '';
  const sr = m.shownSeries;
  const seriesText = sr
    ? `${sr.jumps} pulos · ${sr.distance.toFixed(0)} u em ${sr.time.toFixed(2)} s · média ${sr.avgSpeed.toFixed(0)} u/s`
      + ` · máx. ${sr.maxSpeed.toFixed(0)} u/s${sr.running ? ' · em andamento' : ''}`
    : '—';
  return [
    `salto ${lastText}${air}`,
    `      recordes: distância ${m.best.distance.toFixed(1)} u · queda ${m.best.drop.toFixed(1)} u · série ${m.best.series}`
      + ` pulos · ${m.best.walls} wall-jumps seguidos`,
    `bhop  ${seriesText}`,
  ];
}

export class ShowPosPanel {
  constructor(root) {
    this.text = h('pre.dbg-showpos-text');
    this.canvas = h('canvas.dbg-showpos-graph', { width: 480, height: 96 });
    this.legend = h('div.dbg-showpos-legend', null,
      h('span.is-speed', null, 'velocidade'), h('span.is-cap', null, 'teto'), h('span.is-threshold', null, 'limiar'),
      h('span.is-inaccuracy', null, 'inaccuracy'), h('span.is-air', null, 'no ar'), h('span.is-slide', null, 'slide'),
      h('span.is-walljump', null, 'wall-jump'));
    this.el = h('div.dbg-showpos', { hidden: true, 'aria-hidden': 'true' }, this.text, this.canvas, this.legend);
    root.append(this.el);
    this.graph = new SpeedGraph(this.canvas);
    this.visible = false;
    this.last = 0;
  }

  setVisible(visible) {
    this.visible = visible;
    this.el.hidden = !visible;
    this.last = 0;
  }

  /**
   * @param {import('../player/playerPawn.js').PlayerPawn} pawn
   * @param {{strafe?: import('./strafeMeter.js').StrafeMeter, jump?: import('./jumpMeter.js').JumpMeter}} [meters]
   *   placar e marcas do counter-strafe; medidor de salto e queda
   */
  update(pawn, { strafe: meter = null, jump = null } = {}, now = performance.now()) {
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
    const acc = pawn.inaccuracy;
    const step = pawn.lastStep;
    const land = pawn.lastLanding;
    const stepText = step
      ? `${step.foot ? 'dir.' : 'esq.'} · ${SURFACES[step.surface].label} · vol. ${f2(step.volume)} · `
        + `${step.speed.toFixed(0)} u/s · ${step.audible ? 'audível' : 'silencioso'}`
      : '—';
    const landText = land
      ? `${land.speed.toFixed(0)} u/s${land.audible ? ' · audível' : ''}${land.heavy ? ' · pesado' : ''}`
        + `${land.damage > 0 ? ` · dano ${land.damage.toFixed(2)}` : ''}`
      : '—';
    const lines = [
      `pos   ${f1(o.x)} ${f1(o.y)} ${f1(o.z)}  (pés)`,
      `ang   yaw ${(pawn.yaw * DEG).toFixed(1)}°  pitch ${(pawn.pitch * DEG).toFixed(1)}°`,
      `vel   ${f1(v.x)} ${f1(v.y)} ${f1(v.z)}`,
      `plano ${Math.hypot(v.x, v.z).toFixed(1)} u/s · pico ${pawn.stats.topSpeed.toFixed(1)} u/s`,
      `onde  ${where}`,
      `cáps. ${s.ducked ? 'agachada' : 'em pé'} (${s.height} u) · agachar ${f2(s.duckAmount)}` +
        ` · vel. agachar ${f2(s.duckSpeed)}${s.stuck ? ' · PRESO' : ''}`,
      `agach FL_DUCKING ${yesNo(s.duckFlag)} · descendo/subindo ${yesNo(s.ducking)} · valendo ${yesNo(s.duckHeld)}`,
      heldLine(pawn),
      `teto  ${s.maxSpeed.toFixed(1)} u/s = ${s.baseSpeed.toFixed(0)} × andar ${f2(s.walkFactor)}` +
        ` × stamina ${f2(s.staminaFactor)} × agachar ${f2(s.duckFactor)}`,
      `stam. ${s.stamina.toFixed(1)} · pulo × ${f2(Math.max(0, 1 - s.stamina / 100))}` +
        ` · andando ${yesNo(s.walking)}`,
      `prec. ${f5(acc.total)} = base ${f5(acc.base)} + mov. ${f5(acc.move)} + ar ${f5(acc.air)}` +
        ` · limiar ${precisionThreshold(pawn.held.speed).toFixed(1)}`,
      `passo ${stepText} · ${pawn.stats.steps} passos`,
      `pouso ${landText} · pulos ${pawn.stats.jumps}`,
      vitalsLine(pawn),
      slideLine(pawn),
      wallLine(pawn, pawn.env.dt),
    ];
    if (meter) {
      lines.push(
        `strafe ${strafeLine(meter, STRAFE_KIND.COUNTER)}`,
        `       ${strafeLine(meter, STRAFE_KIND.RELEASE)}`,
      );
    }
    if (jump) lines.push(...jumpLines(jump));
    this.text.textContent = lines.join('\n');
    this.graph.draw(pawn.telemetry, meter);
  }

  dispose() {
    this.el.remove();
  }
}
```

- [ ] **Passo 5: Slide e wall-jump no gráfico, com a legenda**

Em `src/debug/speedGraph.js`, trocar:

```
// (abaixo e acima do limiar de precisão da arma na mão), o teto do tick, o limiar tracejado, a velocidade no plano, a
// inaccuracy por cima, os ticks no ar numa tira embaixo e a marca de cada medida do counter-strafe com o tempo em ms. O
// tick mais novo fica na borda direita. Redesenhado a cada atualização do painel (15 Hz).

```

por:

```
// (abaixo e acima do limiar de precisão da arma na mão), o teto do tick, o limiar tracejado, a velocidade no plano, a
// inaccuracy por cima, os ticks no ar numa tira embaixo, os ticks de slide numa tira em cima e um risco em cada wall-jump
// (3.4), e a marca de cada medida do counter-strafe com o tempo em ms. O tick mais novo fica na borda direita.
// Redesenhado a cada atualização do painel (15 Hz).

```

Em `src/debug/speedGraph.js`, trocar:

```
  air: '#2F6DB5',
  text: '#F6F0E4',
```

por:

```
  air: '#2F6DB5',
  slide: '#F28F3B',
  walljump: '#E88AA8',
  text: '#F6F0E4',
```

Em `src/debug/speedGraph.js`, trocar:

```
const AIR_STRIP = 3; // px da tira dos ticks no ar
const FONT = '600 10px ui-monospace, "Cascadia Mono", Consolas, "SF Mono", "Courier New", monospace'; // --font-mono
```

por:

```
const AIR_STRIP = 3; // px da tira dos ticks no ar
const SLIDE_STRIP = 3; // px da tira dos ticks de slide (em cima)
const FONT = '600 10px ui-monospace, "Cascadia Mono", Consolas, "SF Mono", "Courier New", monospace'; // --font-mono
```

Em `src/debug/speedGraph.js`, trocar:

```
      }
    }
```

por:

```
      }
      if (t.flags[j] & TFLAG.SLIDE) {
        ctx.fillStyle = COLOR.slide;
        ctx.fillRect(x0, 0, dx, SLIDE_STRIP);
      }
    }
```

Em `src/debug/speedGraph.js`, trocar:

```
    this.#line(t, first, xOf, (j) => yOf(t.speed[j]), COLOR.speed, 1.6, false);

```

por:

```
    this.#line(t, first, xOf, (j) => yOf(t.speed[j]), COLOR.speed, 1.6, false);
    // Wall-jumps: um risco de cima a baixo no tick do chute.
    ctx.strokeStyle = COLOR.walljump;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let i = first; i < t.count; i++) {
      if (!(t.flags[t.slot(i)] & TFLAG.WALLJUMP)) continue;
      const x = Math.round(xOf(i)) + 0.5;
      ctx.moveTo(x, SLIDE_STRIP);
      ctx.lineTo(x, plotH);
    }
    ctx.stroke();

```

Em `styles/debug.css`, trocar:

```
.dbg-showpos-legend .is-air::before { border-top-width: 3px; border-top-color: var(--ct-blue); }

```

por:

```
.dbg-showpos-legend .is-air::before { border-top-width: 3px; border-top-color: var(--ct-blue); }
.dbg-showpos-legend .is-slide { color: var(--tr-orange); }
.dbg-showpos-legend .is-slide::before { border-top-width: 3px; }
.dbg-showpos-legend .is-walljump { color: #E88AA8; }
.dbg-showpos-legend .is-walljump::before { width: 0; height: 9px; border-top: 0; border-left: 1.5px solid currentColor; }

```

- [ ] **Passo 6: Contato de parede no `r_colisao`**

Em `src/debug/physicsDebug.js`, trocar:

```
// r_colisao (Fase 3): arame das formas de colisão de cada corpo, a cápsula do jogador (em pé ou agachada, visível em
// terceira pessoa e no noclip), a normal do chão e a normal do último contato que cortou a velocidade. Linhas sem luz,
// sem névoa e por cima de tudo (visão de raio X: o arame das peças coincide com a malha visual e brigaria com ela no
```

por:

```
// r_colisao (Fase 3): arame das formas de colisão de cada corpo, a cápsula do jogador (em pé ou agachada, visível em
// terceira pessoa e no noclip), a normal do chão, a normal do último contato que cortou a velocidade e o contato de
// parede da sonda do wall-jump enquanto vale (subfase 3.4: ponto e normal no plano, numa cor própria). Linhas sem luz,
// sem névoa e por cima de tudo (visão de raio X: o arame das peças coincide com a malha visual e brigaria com ela no
```

Em `src/debug/physicsDebug.js`, trocar:

```
import * as THREE from 'three';
import { HULL } from '../data/movement.js';
import { TRI_STRIDE } from '../physics/geometryQueries.js';
```

por:

```
import * as THREE from 'three';
import { HULL, WALLJUMP } from '../data/movement.js';
import { TRI_STRIDE } from '../physics/geometryQueries.js';
```

Em `src/debug/physicsDebug.js`, trocar:

```

const COLORS = Object.freeze({ edges: 0xffd23f, capsule: 0x3fb8af, normal: 0xe4572e, contact: 0xf4ede1 });
const NORMAL_LENGTH = 28;
```

por:

```

const COLORS = Object.freeze({ edges: 0xffd23f, capsule: 0x3fb8af, normal: 0xe4572e, contact: 0xf4ede1, wall: 0xf28f3b });
const NORMAL_LENGTH = 28;
```

Em `src/debug/physicsDebug.js`, trocar:

```
      lineMaterial(COLORS.edges, 0.5), lineMaterial(COLORS.capsule, 0.9), lineMaterial(COLORS.normal), lineMaterial(COLORS.contact),
    ];
    const [edgeMat, capsuleMat, normalMat, contactMat] = this.materials;
    this.bodies = world.bodies.map((body) => {
```

por:

```
      lineMaterial(COLORS.edges, 0.5), lineMaterial(COLORS.capsule, 0.9), lineMaterial(COLORS.normal), lineMaterial(COLORS.contact),
      lineMaterial(COLORS.wall),
    ];
    const [edgeMat, capsuleMat, normalMat, contactMat, wallMat] = this.materials;
    this.bodies = world.bodies.map((body) => {
```

Em `src/debug/physicsDebug.js`, trocar:

```
    this.contact = segmentLine(contactMat);
    this.group.add(this.stand, this.duck, this.normal, this.contact);
    // Depois da cena (transparentes em ordem): o arame fica sempre por cima.
```

por:

```
    this.contact = segmentLine(contactMat);
    this.wall = segmentLine(wallMat);
    this._wallNormal = new THREE.Vector3();
    this.group.add(this.stand, this.duck, this.normal, this.contact, this.wall);
    // Depois da cena (transparentes em ordem): o arame fica sempre por cima.
```

Em `src/debug/physicsDebug.js`, trocar:

```
    if (c.valid) setSegment(this.contact, c.point.x, c.point.y, c.point.z, c.normal);
  }
```

por:

```
    if (c.valid) setSegment(this.contact, c.point.x, c.point.y, c.point.z, c.normal);
    // Contato de parede enquanto vale para o wall-jump (tolerância): ponto na parede e a normal no plano.
    this.wall.visible = s.wallTime <= WALLJUMP.grace;
    if (this.wall.visible) setSegment(this.wall, s.wallPx, s.wallPy, s.wallPz, this._wallNormal.set(s.wallNx, 0, s.wallNz));
  }
```

- [ ] **Passo 7: Rodar os testes da tarefa e a sintaxe dos módulos de tela**

Run: `node --test tests/jumpMeter.test.js`
Expected: PASS — todos os testes do arquivo passando.

Run: `node --check src/debug/showPos.js && node --check src/debug/speedGraph.js && node --check src/debug/physicsDebug.js`
Expected: PASS — sem erro de sintaxe (os três usam o DOM e o three no navegador; a Tarefa 8 os confere na tela).

- [ ] **Passo 8: Suíte inteira**

Run: `npm test`
Expected: PASS — 251 testes passando.

- [ ] **Passo final: Commit** (só com o pedido do usuário)

```bash
git add src/debug/jumpMeter.js src/debug/showPos.js src/debug/speedGraph.js src/debug/physicsDebug.js styles/debug.css tests/jumpMeter.test.js
git commit -m "MASSACRE 3.4: medidor de salto, cl_showpos, gráfico e r_colisao com slide, wall-jump e vida" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Tarefa 7: Partida — ponto de volta, morte e volta, e o HUD de teste com a vida

**Files:**
- Create: `src/modes/returnPoint.js`, `tests/returnPoint.test.js`
- Modify: `src/modes/matchState.js` (arquivo inteiro), `src/ui/sandboxHud.js` (arquivo inteiro), `styles/hud.css`

A partida passa ao pawn o `god` e o "reduzir movimento" a cada tick, mostra a vida (etiqueta "vida · colete", que acompanha o `Loadout`), o "−n" do dano (pisca e some em 0,9 s) e a etiqueta da morte com a causa e "volta em N s"; com a vida em 0, espera o `respawnDelay` e volta no ponto de volta. Cair do set (1500 u abaixo do chão do mapa) mata ("Caiu do set"); com `god`, volta ao spawn com o aviso, como antes. O ponto de volta é o último teleporte do console (`estacao`, `setpos`) que se sustentou: se o mundo mata o jogador (queda fatal, cair do set; ou cair do set com `god`) antes de ele ficar de pé, vivo, no chão desde que chegou no ponto, o ponto sai e a volta é no spawn — sem isso, um `setpos` para baixo do set prendia o jogador numa morte a cada 2 s (achado no navegador); morte pelo console (`kill`, `hurtme`) não julga o ponto. As dicas dos três dispositivos citam o slide e o wall-jump.

- [ ] **Passo 1: Escrever os testes**

```js file=tests/returnPoint.test.js
// Testes do ponto de volta do respawn (subfase 3.4): o último teleporte do console neste mapa vale até o mundo matar o
// jogador (queda fatal, cair do set; ou cair do set com god) antes de ele ficar de pé, vivo, no chão desde que chegou
// nele — teleporte para o vazio ou para o alto —; aí o ponto sai e a volta é no spawn, em vez de repetir a mesma morte a
// cada 2 s. Morte pelo console (kill, hurtme) não julga o ponto. Com o PlayerPawn de verdade: o teleporte para 1310 u
// acima do chão morre no pouso e perde o ponto; de pé no ponto antes de morrer, ele fica.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { EV, EventBus } from '../src/core/events.js';
import { ReturnPoint } from '../src/modes/returnPoint.js';
import { Loadout } from '../src/player/loadout.js';
import { createSvVars } from '../src/player/movementVars.js';
import { PlayerPawn } from '../src/player/playerPawn.js';
import { floor, worldOf } from './worldTestUtils.js';
import { DT } from './playerTestUtils.js';

const SPAWN = { position: new THREE.Vector3(0, 0, 0), yaw: 0, pitch: 0 };

test('ponto de volta: sem teleporte é o spawn; o teleporte vira o ponto (cópia da posição); clear volta ao spawn', () => {
  const rp = new ReturnPoint();
  assert.equal(rp.pick(SPAWN), SPAWN);
  const at = new THREE.Vector3(10, 20, 30);
  rp.set(at, 1, 0.5);
  at.x = 99;
  const p = rp.pick(SPAWN);
  assert.deepEqual([p.position.x, p.position.y, p.position.z, p.yaw, p.pitch], [10, 20, 30, 1, 0.5]);
  rp.clear();
  assert.equal(rp.pick(SPAWN), SPAWN);
  rp.failed('fora');
  assert.equal(rp.pick(SPAWN), SPAWN, 'sem ponto, falhar não muda nada');
});

test('ponto de volta: fica se o jogador pisou vivo no chão; sai se o mundo o matou antes (no ar, no próprio pouso)', () => {
  const rp = new ReturnPoint();
  rp.set(new THREE.Vector3(0, 900, 0), 0, 0);
  rp.update(true, false); // caindo
  rp.failed('fora');
  assert.equal(rp.pick(SPAWN), SPAWN, 'caiu do set sem pisar: o ponto sai');
  rp.set(new THREE.Vector3(0, 600, 0), 0, 0);
  rp.update(true, true);
  rp.failed('queda');
  assert.notEqual(rp.pick(SPAWN), SPAWN, 'ficou de pé: o ponto fica');
  rp.placed(); // a volta coloca o jogador de novo no ponto
  rp.update(false, true); // morto no chão não conta
  rp.failed('queda');
  assert.equal(rp.pick(SPAWN), SPAWN, 'depois de cada colocação precisa pisar vivo de novo');
  rp.set(new THREE.Vector3(0, 300, 0), 0, 0);
  rp.update(true, true);
  rp.set(new THREE.Vector3(0, -5000, 0), 0, 0); // teleporte novo: o chão do ponto anterior não vale para este
  rp.failed('fora');
  assert.equal(rp.pick(SPAWN), SPAWN);
});

test('ponto de volta: morte pelo console (kill, hurtme) não julga o ponto, nem antes de pisar no chão', () => {
  const rp = new ReturnPoint();
  rp.set(new THREE.Vector3(100, 0, 100), 0, 0);
  rp.failed('kill'); // setpos e kill no mesmo instante, sem tick entre eles
  rp.failed('mundo'); // hurtme
  const back = rp.pick(SPAWN);
  assert.notEqual(back, SPAWN, 'o ponto fica');
  assert.deepEqual([back.position.x, back.position.z], [100, 100]);
  rp.failed('queda');
  assert.equal(rp.pick(SPAWN), SPAWN, 'a queda sem ter pisado tira');
});

test('com o PlayerPawn: o teleporte para 1310 u acima do chão morre no pouso e o ponto sai; de pé no ponto, ele fica', () => {
  const world = worldOf((b) => floor(b));
  const bus = new EventBus();
  const rp = new ReturnPoint();
  bus.on(EV.PLAYER_DEATH, ({ cause }) => rp.failed(cause));
  const pawn = new PlayerPawn({
    world, sv: createSvVars(), loadout: new Loadout(), events: bus, position: new THREE.Vector3(0, 0, 0),
  });
  const input = { move: { x: 0, y: 0 }, isDown: () => false };
  // Como no MatchState: o tick do jogador e, logo depois, o chão visto vivo.
  const ticks = (n) => {
    for (let i = 0; i < n; i++) {
      pawn.tick(DT, input, { tick: i });
      rp.update(pawn.vitals.alive, pawn.state.onGround);
    }
  };
  const high = new THREE.Vector3(0, 1310, 0);
  rp.set(high, 0, 0);
  pawn.teleport(high);
  ticks(200);
  assert.equal(pawn.vitals.alive, false, 'a queda de 1310 mata no pouso');
  assert.equal(pawn.vitals.cause, 'queda');
  assert.equal(rp.pick(SPAWN), SPAWN, 'o ponto que não se sustenta saiu: a volta é no spawn');
  pawn.respawn(SPAWN.position);
  rp.placed();
  const spot = new THREE.Vector3(200, 0, 0);
  rp.set(spot, 0, 0);
  pawn.teleport(spot);
  ticks(10);
  assert.ok(pawn.state.onGround);
  pawn.kill('kill');
  const back = rp.pick(SPAWN);
  assert.notEqual(back, SPAWN, 'de pé no ponto antes de morrer: o ponto fica');
  assert.ok(back.position.distanceTo(spot) < 1e-9);
});
```

- [ ] **Passo 2: Rodar e ver falhar**

Run: `node --test tests/returnPoint.test.js`
Expected: FAIL — `ERR_MODULE_NOT_FOUND` (não acha `src/modes/returnPoint.js`).

- [ ] **Passo 3: Ponto de volta**

```js file=src/modes/returnPoint.js
// Ponto de volta do respawn (subfase 3.4): o último teleporte do console neste mapa (`estacao`, `setpos`); sem ele, o
// spawn. Um ponto que não se sustenta — o mundo mata o jogador (queda fatal, cair do set; ou ele cai do set com god)
// antes de ele ficar de pé, vivo, no chão desde que chegou nele: teleporte para o vazio ou para o alto — sai na hora:
// senão cada volta repetiria a mesma morte a cada 2 s. Morte pelo console (kill, hurtme) não diz nada sobre o ponto.
// Quem usa (MatchState): `set` no teleporte, `placed` depois da volta, `update` depois de cada tick do jogador e
// `failed` na morte e na queda para fora do set.

/** Causas de morte (src/data/vitals.js) que julgam o ponto: as do mundo, não as do console. */
const WORLD_CAUSES = new Set(['queda', 'fora']);

export class ReturnPoint {
  constructor() {
    this.point = null; // {position, yaw, pitch} ou null (o spawn)
    this.grounded = false; // ficou de pé, vivo, no chão desde a última colocação no ponto
  }

  /** Teleporte do console: vira o ponto de volta (cópia da posição) e ainda precisa do chão para valer. */
  set(position, yaw, pitch) {
    this.point = { position: position.clone(), yaw, pitch };
    this.grounded = false;
  }

  /** O jogador voltou para o ponto (respawn): precisa pisar vivo no chão de novo. */
  placed() {
    this.grounded = false;
  }

  /** Depois de cada tick do jogador: de pé no chão, vivo, o ponto se sustenta. */
  update(alive, onGround) {
    if (alive && onGround) this.grounded = true;
  }

  /**
   * Morte (a causa) ou queda para fora do set com god ('fora'): se o mundo matou o jogador antes de ele pisar no chão
   * desde que chegou, o ponto sai.
   */
  failed(cause) {
    if (!this.grounded && WORLD_CAUSES.has(cause)) this.point = null;
  }

  /** Onde voltar: o ponto de volta ou o spawn do mapa. */
  pick(spawn) {
    return this.point ?? spawn;
  }

  /** Saída do mapa: nada de ponto para a próxima partida. */
  clear() {
    this.point = null;
    this.grounded = false;
  }
}
```

- [ ] **Passo 4: A partida com a vida** (arquivo inteiro).

```js file=src/modes/matchState.js
// Estado "partida". Até os modos de jogo (Fase 8) roda o modo "livre" no mapa escolhido: em mapa com colisão o jogador
// anda com a cápsula (PlayerPawn, Fase 3) e o inventário local; sem colisão (vitrine) voa com a câmera livre.
// Responsável por: montar/desmontar o mapa (sem vazar GPU), jogador e câmera, contexto de entrada, pointer lock,
// pausa, a vida no HUD de teste, a morte e a volta em 2 s (subfase 3.4: no ponto de volta — o último teleporte do
// console que se sustentou, senão o spawn —; cair do set mata, com god volta ao spawn), sensibilidade da luneta,
// trincos do andar, ferramentas de debug da física e do movimento (medidores de counter-strafe e de salto e queda), o
// teleporte das estações (`estacao`, pista de testes) e o resumo que vai para a tela de resultado.

import { EV, Subscriptions } from '../core/events.js';
import { SANDBOX } from '../data/sandbox.js';
import { VITALS } from '../data/vitals.js';
import { getMapDef } from '../maps/index.js';
import { ReturnPoint } from './returnPoint.js';
import { createFpsCamera } from '../render/camera.js';
import { disposeObject3D } from '../render/dispose.js';
import { FreeCamera } from '../player/freeCamera.js';
import { PlayerPawn } from '../player/playerPawn.js';
import { itemName, zoomLevels } from '../player/hands.js';
import { readyToRespawn } from '../player/vitals.js';
import { PhysicsDebugView } from '../debug/physicsDebug.js';
import { ShowPosPanel } from '../debug/showPos.js';
import { StrafeMeter } from '../debug/strafeMeter.js';
import { JumpMeter } from '../debug/jumpMeter.js';
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
    this.strafe = null; // medidor de counter-strafe (cl_showpos)
    this.jump = null; // medidor de salto e queda (cl_showpos)
    this.hud = null;
    this.pause = null;
    this.paused = false;
    this.params = null;
    this.devices = new Set();
    this.startedAt = 0;
    this.pausedMs = 0;
    this.pauseStart = 0;
    this.returnPoint = new ReturnPoint(); // ponto de volta: o último teleporte do console neste mapa (senão o spawn)
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
        world: this.map.collision, sv: s.sv, loadout: s.localLoadout, events: s.events,
        position: sp.position, yaw: sp.yaw, pitch: sp.pitch,
      });
      this.physicsDebug = new PhysicsDebugView({ scene: this.map.scene, world: this.map.collision });
      this.showPos = new ShowPosPanel(s.debugRoot);
      this.strafe = new StrafeMeter(s.loop.stepDt);
      this.jump = new JumpMeter(s.loop.stepDt);
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

    this.hud = createSandboxHud(s, {
      title: def.label, mode: this.map.collision ? 'andar' : 'voo', stations: Boolean(this.map.stations?.length),
    });
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
    if (this.player instanceof PlayerPawn) {
      // Arma recebida (give, loja): troca automática se for melhor que a da mão.
      this.subs.on(s.events, EV.LOADOUT, ({ owner, received }) => {
        if (owner === 'local') this.player?.onLoadout(received);
      });
      this.subs.on(s.events, EV.PLAYER_WEAPON, () => this.#syncHeld());
      this.subs.on(s.events, EV.PLAYER_ZOOM, () => this.#syncHeld());
      this.#syncHeld();
      // Vida no HUD de teste: dano (pisca e mostra quanto saiu), morte (etiqueta com a causa) e volta.
      this.subs.on(s.events, EV.LOADOUT, () => this.#syncVitals());
      this.subs.on(s.events, EV.PLAYER_HURT, ({ damage }) => {
        this.#syncVitals();
        this.hud.flashDamage(damage);
      });
      this.subs.on(s.events, EV.PLAYER_DEATH, ({ cause }) => {
        this.returnPoint.failed(cause);
        this.#syncVitals();
      });
      this.subs.on(s.events, EV.PLAYER_SPAWN, () => {
        this.#syncVitals();
        this.hud.setDeath(null);
      });
      this.#syncVitals();
    }

    this.devices = new Set([s.input.device]);
    this.startedAt = performance.now();
    this.pausedMs = 0;
    this.paused = false;
    s.input.resetToggles();
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

  /** Etiqueta "na mão" do HUD de teste: item, velocidade no modo atual e nível da luneta. */
  #syncHeld() {
    const p = this.player;
    if (!(p instanceof PlayerPawn)) return;
    const levels = zoomLevels(p.hands.item);
    const zoom = levels ? ` · luneta ${p.hands.zoom}/${levels}` : '';
    this.hud.setHeld(`na mão: ${itemName(p.hands.item)} · ${p.held.speed} u/s${zoom}`);
  }

  /** Etiqueta de vida do HUD de teste: vida do jogador e colete do inventário. */
  #syncVitals() {
    const p = this.player;
    if (!(p instanceof PlayerPawn)) return;
    this.hud.setVitals(p.vitals.health, p.loadout.armor);
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
    this.player.tick(dt, this.s.input, {
      noclip: this.s.cheats.noclip, tick: tickIndex, god: this.s.cheats.god,
      reduceMotion: this.s.config.get('accessibility.reduceMotion'),
    });
    if (this.player instanceof PlayerPawn) {
      this.returnPoint.update(this.player.vitals.alive, this.player.state.onGround);
      this.strafe.updateFrom(this.player.telemetry);
      this.jump.update(this.player.state, this.player.env.events);
      // Luneta: a sensibilidade do olhar do próximo quadro segue o nível de zoom deste tick.
      this.s.input.lookScale = this.player.lookScale(this.s.config.get('controls.zoomSensitivity'));
    }
    this.#checkFellOut();
    if (this.player instanceof PlayerPawn && readyToRespawn(this.player.vitals)) this.#respawn();
    this.map.tick?.(dt);
  }

  /**
   * Fora do set (noclip desligado lá fora, ou um buraco): bem abaixo do mapa o jogador morre ("Caiu do set"); com god,
   * volta ao spawn com o aviso. Nos dois casos, um ponto de volta em que ele ainda não tinha pisado sai (ReturnPoint).
   */
  #checkFellOut() {
    const p = this.player;
    if (!(p instanceof PlayerPawn) || p.state.origin.y > this.map.bounds.min.y - SANDBOX.fallOutDepth) return;
    if (!p.vitals.alive) return;
    if (!this.s.cheats.god) {
      p.kill('fora');
      return;
    }
    this.returnPoint.failed('fora');
    const sp = this.map.spawn;
    this.#place(sp.position, sp.yaw, sp.pitch);
    this.s.toasts.show('Caiu para fora do set: de volta ao spawn');
  }

  /** Volta ao jogo no ponto de volta (o último teleporte do console neste mapa que se sustentou, senão o spawn). */
  #respawn() {
    const point = this.returnPoint.pick(this.map.spawn);
    this.player.respawn(point.position, point.yaw, point.pitch);
    this.returnPoint.placed();
    this.jump?.interrupt();
  }

  frame(alpha, dt) {
    if (!this.player) return;
    const look = this.s.input.consumeLook();
    if (!this.paused) this.player.applyLook(look);
    const a = this.paused ? 1 : alpha;
    this.player.updateCamera(this.camera, a);
    this.physicsDebug?.update(this.player, a);
    this.showPos?.update(this.player, { strafe: this.strafe, jump: this.jump });
    if (this.player instanceof PlayerPawn) {
      const v = this.player.vitals;
      this.hud.setWalking(v.alive && !this.s.cheats.noclip && this.s.input.isDown('walk'));
      this.hud.setDeath(v.alive ? null : v.cause, Math.max(0, VITALS.respawnDelay - v.deadTime));
    }
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
    s.input.resetToggles();
    s.input.lookScale = 1;
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
    this.strafe = null;
    this.jump = null;
    this.camera = null;
    this.pause = null;
    this.hud = null;
    this.paused = false;
    this.returnPoint.clear();
  }

  /**
   * Teleporte do console (setpos, estacao): vira o ponto de volta depois de morrer neste mapa (morrer da prancha de
   * 1310 devolve à prancha); um ponto em que o mundo mata o jogador antes de ele pisar no chão (o vazio, o alto) sai
   * (ReturnPoint).
   */
  teleport(position, yaw = this.player?.yaw ?? 0, pitch = this.player?.pitch ?? 0) {
    this.returnPoint.set(position, yaw, pitch);
    this.#place(position, yaw, pitch);
  }

  /** Leva o jogador ao ponto: o voo em andamento não conta no medidor de salto. */
  #place(position, yaw, pitch) {
    this.player?.teleport(position, yaw, pitch);
    this.jump?.interrupt();
  }
}
```

- [ ] **Passo 5: HUD de teste com a vida, o dano e a morte** (arquivo inteiro e o estilo).

```js file=src/ui/sandboxHud.js
// HUD do modo livre: mira simples, etiqueta de status (cheats), aviso "clique para jogar" no PC e a dica de controles
// que some sozinha — de andar (mapa com colisão) ou de voar (vitrine); em mapa com estações (pista de testes) a dica do
// teclado cita o `estacao` do console. Andando, mostra o item na mão e a vida com o colete (etiquetas de fita crepe;
// ao tomar dano a vida pisca e "−26" aparece por um instante), "ANDANDO" sob a mira com o andar silencioso ligado e, morto,
// a etiqueta da causa acima da mira com a contagem da volta (subfase 3.4). O HUD completo de massinha chega na Fase 10.

import { h } from './dom.js';
import { EV } from '../core/events.js';
import { DEATH_CAUSES, VITALS } from '../data/vitals.js';

const HINTS = Object.freeze({
  andar: Object.freeze({
    kbm: 'WASD anda · Shift silencioso · Espaço pula (no ar, perto da parede: wall-jump) · Ctrl agacha (correndo:'
      + ' slide) · 1–5, roda e Q trocam · botão direito: luneta · ` console (noclip voa) · F3 desempenho',
    gamepad: 'Analógico E anda · Analógico D olha · A/✕ pula (no ar, perto da parede: wall-jump) · B/○ agacha'
      + ' (correndo: slide) · L3 liga/desliga o andar · Y/△ troca · LT/L2 luneta · Options pausa',
    touch: 'Joystick à esquerda anda · arraste à direita para olhar · botões pulam (no ar, perto da parede:'
      + ' wall-jump), agacham (correndo: slide), trocam de arma e ligam o andar silencioso',
  }),
  voo: Object.freeze({
    kbm: 'WASD mover · Espaço/Ctrl subir/descer · Shift devagar · botão direito acelera · ` console · F3 desempenho',
    gamepad: 'Analógico E mover · Analógico D olhar · A/✕ sobe · B/○ desce · L3 devagar · LT/L2 acelera · Options pausa',
    touch: 'Joystick à esquerda · arraste à direita para olhar · pular/agachar sobem e descem',
  }),
});

// O console só existe no teclado: a dica das estações entra na linha do teclado.
const STATIONS_HINT = ' · estacao no console lista as estações e teleporta (estacao 7 900)';

/** @param {{title: string, mode?: 'andar'|'voo', stations?: boolean}} opts */
export function createSandboxHud(services, { title, mode = 'voo', stations = false }) {
  const { events, cheats, input, uiRoot } = services;
  const base = HINTS[mode] ?? HINTS.voo;
  const hints = stations ? { ...base, kbm: base.kbm + STATIONS_HINT } : base;
  const status = h('span.hud-status');
  const held = h('span.tape-label.hud-held', { hidden: true });
  const vitals = h('span.tape-label.hud-vitals', { hidden: true });
  const hurt = h('span.hud-hurt', { hidden: true, 'aria-hidden': 'true' });
  const walk = h('span.hud-walk', { hidden: true }, 'ANDANDO');
  const deathCause = h('span.tape-label.hud-death-cause');
  const deathTimer = h('span.hud-death-timer');
  const death = h('div.hud-death', { hidden: true, role: 'status' }, deathCause, deathTimer);
  const hint = h('p.hud-hint');
  const prompt = h('button.hud-prompt', { type: 'button', hidden: true }, 'Clique para jogar');
  const root = h('div.hud', null,
    h('div.crosshair', { 'aria-hidden': 'true' }, h('i.ch-dot'), h('i.ch-l'), h('i.ch-r'), h('i.ch-t'), h('i.ch-b')),
    h('div.hud-top', null, h('span.tape-label.hud-title', null, title), held, vitals, hurt, status),
    walk,
    prompt,
    death,
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
  let hurtTimer = 0;
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
    /** Item na mão (texto da etiqueta; null esconde). */
    setHeld(text) {
      held.hidden = !text;
      if (text && held.textContent !== text) held.textContent = text;
    },
    /** Andar silencioso ligado (a cada quadro: só mexe no DOM quando muda). */
    setWalking(on) {
      if (walk.hidden === on) walk.hidden = !on;
    },
    /** Vida e colete (etiqueta de fita ao lado do item na mão). */
    setVitals(health, armor) {
      const text = `vida ${health} · colete ${armor}`;
      vitals.hidden = false;
      if (vitals.textContent !== text) vitals.textContent = text;
    },
    /** Dano recebido: a etiqueta da vida pisca e "−n" aparece ao lado por VITALS.damageFlash s. */
    flashDamage(amount) {
      hurt.textContent = `−${amount}`;
      hurt.hidden = false;
      vitals.classList.remove('is-hit');
      void vitals.offsetWidth; // recomeça a animação a cada dano
      vitals.classList.add('is-hit');
      clearTimeout(hurtTimer);
      hurtTimer = setTimeout(() => {
        hurt.hidden = true;
        vitals.classList.remove('is-hit');
      }, VITALS.damageFlash * 1000);
    },
    /**
     * Morte (a cada quadro: só mexe no DOM quando muda): a causa (src/data/vitals.js, DEATH_CAUSES) e os segundos até
     * voltar, acima da mira; `cause` null esconde.
     */
    setDeath(cause, left = 0) {
      if (!cause) {
        if (!death.hidden) death.hidden = true;
        return;
      }
      const text = DEATH_CAUSES[cause] ?? cause;
      const timer = `volta em ${Math.max(1, Math.ceil(left - 1e-6))} s`;
      if (deathCause.textContent !== text) deathCause.textContent = text;
      if (deathTimer.textContent !== timer) deathTimer.textContent = timer;
      if (death.hidden) death.hidden = false;
    },
    dispose() {
      clearTimeout(hintTimer);
      clearTimeout(hurtTimer);
      for (const off of offs) off();
      root.remove();
    },
  };
}
```

Em `styles/hud.css`, trocar:

```

/* Andar silencioso ligado: aviso curto logo abaixo da mira. */
```

por:

```

/* Vida e colete: terceira tira; ao tomar dano o texto pisca em vermelho de pose em pose (stop-motion). */
.hud-vitals { font: 700 0.8rem / 1.2 var(--font-mono); transform: rotate(-0.6deg); }
.hud-vitals.is-hit { animation: vitals-hit calc(var(--pose) * 2) steps(1) 5; }

@keyframes vitals-hit {
  0% { color: var(--tr-red); }
  50% { color: var(--ink); }
}

/* Quanto a vida perdeu, ao lado da etiqueta (some sozinho). */
.hud-hurt { font: 800 0.95rem var(--font-mono); color: var(--alert); text-shadow: 0 1px 2px #000; }

/* Morte: etiqueta com a causa acima da mira e a contagem da volta; o "clique para jogar" continua por baixo. */
.hud-death {
  position: absolute;
  left: 50%;
  top: calc(50% - 96px);
  translate: -50% 0;
  display: grid;
  justify-items: center;
  gap: 6px;
  pointer-events: none;
}

.hud-death-cause { font: 800 1.25rem / 1.2 var(--font-title); transform: rotate(-2deg); }

.hud-death-timer {
  font: 800 0.8rem var(--font-mono);
  letter-spacing: 0.1em;
  color: var(--paper);
  text-shadow: 0 1px 2px #000;
}

/* Andar silencioso ligado: aviso curto logo abaixo da mira. */
```

- [ ] **Passo 6: Rodar os testes da tarefa e a sintaxe dos módulos de tela**

Run: `node --test tests/returnPoint.test.js`
Expected: PASS — 4 testes passando.

Run: `node --check src/modes/matchState.js && node --check src/ui/sandboxHud.js`
Expected: PASS — sem erro de sintaxe.

- [ ] **Passo 7: Suíte inteira e tamanhos**

Run: `npm test`
Expected: PASS — 255 testes passando.

Conferir: `wc -l src/modes/matchState.js src/player/movement.js src/player/playerPawn.js src/physics/collisionWorld.js` → 379, 457, 417 e 587 linhas (todos abaixo de 600).
- [ ] **Passo final: Commit** (só com o pedido do usuário)

```bash
git add src/modes src/ui/sandboxHud.js styles/hud.css tests/returnPoint.test.js
git commit -m "MASSACRE 3.4: ponto de volta, morte e volta na partida e o HUD de teste com a vida" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Tarefa 8: Verificação no navegador

O servidor de desenvolvimento de outro chat pode estar na 5173: usar `massacre-dev-auto` (porta livre) ou uma configuração própria. O painel de preview não concede pointer lock a scripts: a entrada de teclado é a do próprio `KeyboardMouse` do jogo, liberada por script como na 3.2 e na 3.3. Não emular um tamanho de tela maior que o painel (com a emulação escalada, os cliques do painel caem no lugar errado): usar o tamanho do painel.

- [ ] **Passo 1:** `preview_start`; no menu, clicar em **Pista de testes** (ou, pelo `javascript_tool`, `massacre.states.go('match', { map: 'pista', mode: 'livre' })`).
- [ ] **Passo 2: Ajudante de entrada, ticks e robôs** (colar no `javascript_tool`). O navegador pode mandar o `pointerlockerror` do pedido de captura depois do carregamento, o que desfaz a captura liberada e abre a pausa: `__t.unpause()` fecha a pausa e libera de novo.

```js
const m = massacre;
const T = {
  lock() { const k = m.input.kbm; k.pointerLocked = true; k.listener.onLockChange(true); },
  unpause() {
    const s = m.states.current;
    if (s.paused) {
      s.paused = false;
      s.pausedMs += performance.now() - s.pauseStart;
      s.pause.hide();
      m.input.setContext('game');
    }
    T.lock();
  },
  down(code) { window.dispatchEvent(new KeyboardEvent('keydown', { code, key: code, bubbles: true })); },
  up(code) { window.dispatchEvent(new KeyboardEvent('keyup', { code, key: code, bubbles: true })); },
  exec(line) { m.console.execute(line); return [...m.console.log.children].slice(-3).map((r) => r.textContent); },
  pawn: () => m.states.current.player,
  /** Roda `fn(i)` antes de cada tick da partida até devolver true (ou `max` ticks). */
  bot(fn, max = 600) {
    const s = m.states.current;
    const tick = Object.getPrototypeOf(s).tick;
    let i = 0;
    return new Promise((done) => {
      s.tick = function (dt, ti) {
        if (i >= max || fn(i++)) { delete s.tick; done(i); }
        return tick.call(this, dt, ti);
      };
    });
  },
};
window.__t = T;
window.__ev = [];
for (const t of ['player:land', 'player:hurt', 'player:death', 'player:spawn', 'player:slide', 'player:walljump']) {
  m.events.on(t, (e) => window.__ev.push({ t, ...JSON.parse(JSON.stringify(e)) }));
}
T.unpause();
```

- [ ] **Passo 3: HUD** — etiqueta "vida 100 · colete 0" ao lado de "na mão"; `__t.exec('give colete')` → "vida 100 · colete 100" (o colete sai do `Loadout`); console sem mensagens do jogo.
- [ ] **Passo 4: Slide na faixa** — `__t.exec('estacao slide faixa')`, `__t.exec('cl_showpos 1')`; W seguro e Ctrl a partir da linha:

```js
const s = __t.pawn().state;
__t.down('KeyW');
await __t.bot(() => { if (s.origin.x >= -2096) __t.down('ControlLeft'); return s.origin.x > -1900; }, 900);
__t.up('KeyW'); __t.up('ControlLeft');
__t.pawn().lastSlide; // { reason: 'tempo', distance ≈ 151,2, entrySpeed 300, exitSpeed ≈ 204,7 }
```

  Esperado: passou sob as quatro traves (x final > −1964); linha "slide parado · último: 151.2 u em 0.61 s, 300 → 205 u/s, tempo"; no gráfico, a faixa laranja do slide. Visual: `estacao slide traves` mostra a régua, o lápis, a régua de aço e o espeto sobre os apoios de livros, as marcas de fita a cada 50 u e as etiquetas.
- [ ] **Passo 5: Wall-jump no poço** — `__t.exec('setpos -2498 0 202 0 0')` e o robô das 4 paredes (o mesmo roteiro do teste `climbWell`: a leste, norte, sul e oeste, mirando a próxima parede ao encostar e apertando o pulo a cada 2 ticks):

```js
const p = __t.pawn(); const s = p.state;
const cx = -2450, cz = 150, h = 72, along = 36; const N = { N: [0, 1], S: [0, -1], E: [-1, 0], W: [1, 0] };
const order = ['E', 'N', 'S', 'W'];
const aim = (k) => (order[k] ? [cx - N[order[k]][0] * h + N[order[k]][1] * along, cz - N[order[k]][1] * h - N[order[k]][0] * along] : [-2298, cz]);
const yawTo = ([x, z]) => Math.atan2(-(x - s.origin.x), -(z - s.origin.z));
let jumped = false; let space = false; let apex = 0;
const press = (d) => { if (d !== space) { space = d; __t[d ? 'down' : 'up']('Space'); } };
__t.down('KeyW');
await __t.bot((i) => {
  const k = s.wallJumps;
  if (!jumped) {
    p.yaw = yawTo(aim(0));
    if (!(s.onGround && Math.hypot(aim(0)[0] - s.origin.x, aim(0)[1] - s.origin.z) > 90)) { jumped = true; press(true); }
  } else {
    const w = order[k];
    const touching = w && s.wallTime <= 0.12 + 1e-9 && Math.abs(s.wallNx - N[w][0]) < 0.3 && Math.abs(s.wallNz - N[w][1]) < 0.3;
    p.yaw = yawTo(aim(touching ? k + 1 : k));
    press(i % 2 === 0 && k < 4 && !s.onGround);
  }
  apex = Math.max(apex, s.origin.y);
  return i > 200;
}, 400);
__t.up('KeyW'); press(false);
[apex, s.origin.y, p.stats.wallJumps]; // ~253, 230 (a prancha: 224 + 6), 4
```

  Com `r_colisao 1` e `thirdperson`, parar o robô no meio (devolver true com `s.wallJumps === 2`): o segmento laranja do contato de parede na face; `cl_showpos` com "pared. normal … usadas 2 · wall-jumps no voo 2". Voltar com `firstperson` e `r_colisao 0`.
- [ ] **Passo 6: Zigue-zague** — o roteiro do teste `crossZigzag`: corre em A para o norte, pula na borda mirando o painel 0; encostado no painel k, mira o seguinte a 35% do comprimento dele e aperta o pulo a cada 2 ticks; em B, para. Rodar com a AK (`__t.exec('give ak47')`) e com a faca (`__t.down('Digit3')` e `__t.up('Digit3')`):

```js
const p = __t.pawn(); const s = p.state;
const Z = { x: [-1822, -1678], A: [700, 900], B: [-44, 156], y: 128, panels: [[564, 700], [428, 564], [292, 428], [156, 292]] };
const zx = (Z.x[0] + Z.x[1]) / 2; const half = (Z.x[1] - Z.x[0]) / 2 - 16;
const target = (k) => (k < 4 ? [zx + (k % 2 === 0 ? -half : half), Z.panels[k][1] - (Z.panels[k][1] - Z.panels[k][0]) * 0.35] : [zx, (Z.B[0] + Z.B[1]) / 2]);
const yawTo = ([x, z]) => Math.atan2(-(x - s.origin.x), -(z - s.origin.z));
__t.exec(`setpos ${zx} ${Z.y} ${Z.A[1] - 20} 0 0`);
let jumped = -1; let landed = false; let space = false; let edgeY = null;
const press = (d) => { if (d !== space) { space = d; __t[d ? 'down' : 'up']('Space'); } };
__t.down('KeyW');
await __t.bot((i) => {
  if (edgeY === null && s.origin.z < Z.B[1]) edgeY = s.origin.y;
  if (jumped < 0) {
    p.yaw = 0;
    if (!(s.onGround && s.origin.z > Z.A[0] + 8)) { jumped = i; p.yaw = yawTo(target(0)); press(true); }
    return false;
  }
  if (landed || (s.onGround && i > jumped + 4)) { landed = true; __t.up('KeyW'); press(false); return true; }
  const k = s.wallJumps;
  const touching = k < 4 && s.wallTime <= 0.12 + 1e-9 && Math.abs(s.wallNx - (k % 2 === 0 ? 1 : -1)) < 0.3;
  p.yaw = yawTo(target(touching ? k + 1 : k));
  press(touching && i % 2 === 0);
  return false;
}, 500);
__t.up('KeyW'); press(false);
[s.origin.z, s.origin.y, p.lastWallJump?.count, edgeY - Z.y]; // z entre −44 e 156, pés a 128, 4 chutes, folga > 0
```

  Esperado com as duas armas: pouso em B com 4 wall-jumps (no navegador, folga de ~137–139 u com a faca e ~35–39 u com a AK na borda de B, conforme o tick em que a entrada chega — a do navegador chega um tick depois da do teste).
- [ ] **Passo 7: Queda, dano e morte** — `estacao torre 600`; Shift + W seguros ~2 s: pouso com `damage` ≈ 25–26, `EV.PLAYER_HURT`, "vida 74/75" e o "−25/−26" piscando. `hurtme 26`, `hurtme abc` (erro com o uso), `god` + `hurtme 50` ("god ligado: nenhum dano"), `god` de novo. `estacao torre 1310` + W: dano ~105, "Você se esborrachou" com "volta em 2 s", a câmera baixa e tombada; em ~2 s, a volta na própria prancha com a vida 100. `kill`: "Desistiu" e a volta.
- [ ] **Passo 8: Ponto de volta** — `setpos -3200 -3000 0`: uma morte ("Caiu do set") e a volta no spawn (0, 0, 1200), sem repetir. `setpos 0 2000 1100`: morte na queda e a volta no spawn. Na sala de testes (`massacre.states.go('match', { map: 'testroom', mode: 'livre' })`, `__t.unpause()`): `setpos 100 0 100` e `kill` na mesma chamada → a volta em (100, 0, 100).
- [ ] **Passo 9: Tábua da torre** — noclip, `setpos -1745 480 -727 64 5`: a anotação "600 · −26" a lápis na metade direita da tábua, lida de baixo para cima; `setpos -1720 1110 -715 64 0`: "daqui para cima, fatal" terminando no risco de 1280; `setpos -1690 1260 -700 64 8`: "1310 · fatal" acima do risco de 1310. `noclip` de novo.
- [ ] **Passo 10: Memória** — menu ↔ pista 3×: o comando `mem` volta aos valores do menu em todos os ciclos e os ouvintes de `player:*` ficam em 0 no menu (depois de recarregar a página, sem os ouvintes do Passo 2):

```js
const bus = massacre.events; const live = new Map(); const on = Object.getPrototypeOf(bus).on;
bus.on = function (type, fn) {
  const off = on.call(this, type, fn);
  live.set(type, (live.get(type) ?? 0) + 1);
  let done = false;
  return () => { if (!done) { done = true; live.set(type, live.get(type) - 1); } off(); };
};
const rows = [];
const mem = () => { massacre.console.execute('mem'); return massacre.console.log.lastChild.textContent; };
const players = () => JSON.stringify([...live].filter(([t]) => t.startsWith('player:')));
// Do menu para o menu a máquina de estados recusa ("transição proibida"): só vai ao menu se não estiver nele.
const toMenu = async () => { if (massacre.states.name !== 'menu') await massacre.states.go('menu'); await new Promise((r) => setTimeout(r, 800)); };
for (let i = 0; i < 3; i++) {
  await toMenu(); rows.push(['menu', mem(), players()]);
  await massacre.states.go('match', { map: 'pista', mode: 'livre' }); await new Promise((r) => setTimeout(r, 1500));
  rows.push(['pista', mem(), players()]);
}
await toMenu(); rows.push(['menu', mem(), players()]);
rows; // menu depois da 1ª partida: 2 geometrias / 33 texturas / 20 programas e os player:* em 0; pista: 42 / 79 / 41 e 1 de cada
```

  O menu recém-carregado, antes de qualquer partida, ainda não tem os recursos compartilhados (1 / 8 / 0): a comparação vale a partir da primeira saída. O heap volta a ~16 MB depois da coleta (esperar uns 20 s e repetir o `mem`).
- [ ] **Passo 11:** `read_console_messages` sem erros do jogo; parar o servidor.

---

### Tarefa 9: Documentação e memória

- [ ] **Passo 1:** `docs/PROGRESS.md` — subfase 3.4 dentro da seção da Fase 3: arquivos criados e alterados, como testar (`npm test`, a faixa, o poço, o zigue-zague, a torre, `kill`, `hurtme`, `god`, `cl_showpos`, `r_colisao`, `sv_slide*`, `sv_walljump*`, `sv_falldamage_scale`), os números medidos (testes e navegador), o checklist de aceite marcado e o que vem na 3.5.
- [ ] **Passo 2:** `docs/phases/phase-3.md` — 3.4 ✅ com a data na tabela de estado; checklist de aceite da 3.4 marcado; medições do navegador registradas na seção 3.4.
- [ ] **Passo 3:** memória do projeto (`massacre-game-project.md`): 3.4 pronta (sem commit, junto com a 3.1, a 3.2 e a 3.3), próxima 3.5 (sensação: head-bob, inclinação, squash & stretch, pegadas; e o aceite da Fase 3).
- [ ] **Passo 4:** encerrar pedindo um chat novo para a 3.5.
