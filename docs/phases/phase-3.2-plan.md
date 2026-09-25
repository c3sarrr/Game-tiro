# Subfase 3.2 — Movimento tático CS: plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** o movimento do CS:GO portado do código do jogo (teto por item, andar, agachar com penalidade de spam, stamina, bunny hop penalizado, passos por tempo), o item na mão com troca por 1–5, roda e Q e a luneta funcional, a inaccuracy da arma calculada a cada tick, o counter-strafe medido no `cl_showpos` com gráfico e o andar silencioso alternável por dispositivo.

**Architecture:** funções puras sobre dados simples (abordagem A do desenho). `playerMove` (`movement.js`, com `duck.js` e `footsteps.js`) recebe o item na mão em `env.item`; `hands.js` resolve a troca pedida em `cmd.select`, a troca automática e a luneta; `inaccuracy.js` calcula a precisão do `CWeaponCSBase` sobre `src/data/inaccuracy.js`; o `PlayerPawn` monta tudo na ordem do `RunCommand` do Source e grava a telemetria que o medidor de counter-strafe (`strafeMeter.js`) e o gráfico do `cl_showpos` leem. A entrada ganha o trinco segurar/alternar por dispositivo (`actionToggles.js`).

**Tech Stack:** JavaScript ES Modules, three 0.186.1, three-mesh-bvh 0.9.15, `node --test`.

**Especificação:** `docs/phases/phase-3.md` (seção 3.2); notas e dados de referência em `docs/research/`. Regras: `CLAUDE.md` (sem placeholder, < 600 linhas por arquivo, números em `src/data/`).

**Como executar os blocos de código:** cada bloco ` ```js file=<caminho> ` (ou `css`) é o conteúdo completo do arquivo e é gravado com o extrator da Tarefa 0, sem redigitar. Alterações em arquivos existentes vêm como pares "Em `arquivo`, trocar: … por: …", aplicados na ordem em que aparecem com a ferramenta de edição (cada trecho "trocar" é único no arquivo no momento em que é aplicado).

**Estado de partida:** a árvore da 3.1, ainda sem commit (branch `fase-3.1`), com `npm test` passando e as notas da pesquisa já em `docs/research/`. A 3.2 entra na mesma árvore.

**Commits:** os passos "Commit" só rodam quando o usuário pedir (decisão da 3.2: não commitar agora). Toda mensagem termina com a linha `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

**Números:** os valores esperados nos testes saíram desta implementação e batem com a seção "Valores de referência" da 3.2, sem ajuste: faca 0 → 250 em 35 ticks; AK 0 → 215 em 36; faca andando 0 → 130 em 40; AK andando 26; faca agachada 100; AWP com zoom 53 e andando 22; faca a 250 + Shift trava em 130 no 7º tick; parada em 26 ticks; counter-strafe da AK contra 5 × soltar 13; descer 13 ticks e levantar 11; stamina 24,16 no pulo, pouso a 285,51 u/s → 14,28 → teto × 0,735 no primeiro tick → zera em 16; passos a cada 19 (faca) e 25 (AK) ticks; pulo 57 u e pulo + Ctrl 66 u; vetores de inaccuracy da pesquisa com diferença < 10⁻⁶.

**Validação do próprio plano:** antes de ser gravado, o plano foi aplicado tarefa por tarefa numa cópia limpa do projeto (extrator + pares): em cada tarefa o teste novo falha antes da implementação e passa depois, e a suíte inteira passa ao fim de cada tarefa. A versão final também rodou no navegador com a mesma rotina da Tarefa 12.

---

## Mapa de arquivos

| Arquivo | Responsabilidade |
|---|---|
| `src/data/movement.js` | + sv_* novas (stamina, bhop, agachar, aceleração pela arma), `MOVE`, `DUCK` completo, `STEPS` |
| `src/data/surfaces.js` | volume do passo por classe (`stepSlow` / `stepFast`) |
| `src/data/weapons.js` | FOVs de zoom (`scope`), `zoomTime`, `SCOPE`, `BOMB`, `BOMB_ALIASES` |
| `src/data/economy.js` | velocidade com a granada na mão (245) |
| `src/data/inaccuracy.js` | **novo** — inaccuracy por arma (items_game final) e constantes do `CWeaponCSBase` |
| `src/player/movementVars.js` | sv_* de 0/1 arredondam |
| `src/player/loadout.js` | `giveBomb`, `grenadeTypes`, bomba no `describe` |
| `src/player/moveCmd.js` | `cmd.select` (`SELECT`) lido das ações de troca |
| `src/player/hands.js` | **novo** — item na mão, troca, troca automática, luneta, modo alt, velocidade do item |
| `src/player/inaccuracy.js` | **novo** — precisão do `CWeaponCSBase` em funções puras |
| `src/player/duck.js` | **novo** — agachar do CS:GO (spam, transição, cápsula, `FL_DUCKING`, corte do teto) |
| `src/player/footsteps.js` | **novo** — relógio dos passos do CS:GO |
| `src/player/movement.js` | porte do `PlayerMove`/`FullWalkMove` do CS:GO (teto, andar, stamina, bhop, pouso) |
| `src/player/telemetry.js` | **novo** — anel de 256 ticks para o gráfico e o medidor |
| `src/player/playerPawn.js` | tick na ordem do `RunCommand` (mão → movimento → precisão → luneta), FOV interpolado, eventos |
| `src/core/events.js` | `PLAYER_STEP`, `PLAYER_WEAPON`, `PLAYER_ZOOM`; payloads novos de pulo, pouso e inventário |
| `src/debug/strafeMeter.js` | **novo** — medidor de counter-strafe |
| `src/data/actions.js` | `TOGGLE_MODE` / `TOGGLE_MODES` e `toggle` na ação `walk` |
| `src/input/actionToggles.js` | **novo** — trinco segurar/alternar por dispositivo |
| `src/input/inputManager.js` | avaliação por dispositivo, trincos, `resetToggles()` |
| `src/data/touchLayout.js` | botão Andar, layout versão 2, `TOUCH_BUTTONS_SINCE` |
| `src/data/configSchema.js` | modos do andar por dispositivo; migração do layout de toque |
| `src/ui/settingControls.js`, `src/ui/settingsScreen.js` | Segurar/Alternar; modo do andar nas abas Teclas, Controle e Toque |
| `src/ui/sandboxHud.js`, `styles/hud.css` | etiqueta "na mão", aviso "ANDANDO", dicas novas |
| `src/debug/speedGraph.js` | **novo** — gráfico dos últimos 4 s |
| `src/debug/showPos.js`, `styles/debug.css` | `cl_showpos` com as linhas novas, o gráfico e a legenda |
| `src/debug/movementCommands.js`, `src/debug/commands.js` | `cl_strafe_reset`; `give bomba`; `loadout` com o item na mão |
| `src/modes/matchState.js` | inventário no pawn, medidor, sensibilidade da luneta, trincos, HUD |
| testes novos | `hands`, `inaccuracy`, `tacticalMovement`, `footsteps`, `strafeMeter` |
| testes alterados | `movementData`, `data`, `characterController`, `playerTestUtils`, `movementFuzz`, `playerPawn`, `input` |

---

### Tarefa 0: Extrator dos blocos do plano

**Files:**
- Create: `<scratchpad>/extract-plan.mjs` (fora do projeto)

- [ ] **Passo 1: Criar o extrator** — o mesmo da 3.1: lê o plano e grava cada bloco ` ```js file=... ` (ou `css`) no caminho indicado, só para os arquivos pedidos na linha de comando.

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

- [ ] **Passo 2: Conferir** — `node extract-plan.mjs docs/phases/phase-3.2-plan.md . tests/hands.test.js` grava o arquivo pedido (e apagar o arquivo de novo: a Tarefa 2 o cria no passo certo).

---

### Tarefa 1: Dados — sv_* novas, MOVE/DUCK/STEPS, passos por superfície, luneta, granadas, bomba e inaccuracy

**Files:**
- Modify: `src/data/movement.js` (arquivo inteiro), `src/data/surfaces.js` (arquivo inteiro), `src/data/weapons.js`, `src/data/economy.js`, `src/player/movementVars.js`, `src/player/loadout.js`
- Create: `src/data/inaccuracy.js`
- Test: `tests/movementData.test.js` (arquivo inteiro), `tests/data.test.js`

- [ ] **Passo 1: Escrever os testes**

O teste dos dados de movimento passa a cobrir as constantes do CS:GO e as sv_* inteiras:

```js file=tests/movementData.test.js
// Testes dos dados de movimento (Fases 3.1 e 3.2): sv_* do CS:GO, faixas do console, constantes do movimento tático e
// materiais de superfície.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HULL, SV_DEFAULTS, SV_VARS, CONTROLLER, DUCK, MOVE, STEPS, VIEW } from '../src/data/movement.js';
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
  for (const s of SURFACES) {
    assert.ok(s.friction > 0 && s.jumpFactor > 0, s.id);
    assert.ok(s.stepSlow > 0 && s.stepSlow < s.stepFast && s.stepFast <= 1, s.id);
  }
  assert.throws(() => surfaceIndex('lava'), /desconhecida/);
  assert.throws(() => surfaceIndex(999), /desconhecida/);
});

test('movimento tático (3.2): constantes do CS:GO coerentes entre si', () => {
  assert.equal(MOVE.runSpeed, 260);
  assert.ok(MOVE.walkModifier > 0 && MOVE.walkModifier < 1);
  // Andar a 0,52 da faca (250) dá 130 u/s, abaixo do limiar dos passos audíveis (135,2): Shift é silencioso.
  assert.ok(250 * MOVE.walkModifier < STEPS.audibleSpeed);
  assert.ok(MOVE.bunnyJumpFactor > 1);
  assert.ok(DUCK.downFactor > 0 && DUCK.downFactor < 1);
  assert.ok(DUCK.minEnabled < DUCK.speed && DUCK.spamPenalty > 0);
  assert.ok(DUCK.flagClear > 0 && DUCK.flagClear < 1);
  assert.ok(DUCK.recoveryAway > DUCK.recovery);
  assert.ok(STEPS.walkSpeed < STEPS.runSpeed && STEPS.duckWalkSpeed < STEPS.duckRunSpeed);
  assert.ok(STEPS.fastInterval < STEPS.slowInterval && STEPS.frequency > 0 && STEPS.frequency <= 1);
  assert.ok(STEPS.landAudibleSpeed < STEPS.roughLandSpeed);
  assert.ok(SV_DEFAULTS.staminamax <= SV_VARS.find((v) => v.key === 'staminamax').max);
});

test('sv_*: variáveis liga/desliga do console são inteiras', () => {
  const vars = createSvVars();
  assert.equal(setSvVar(vars, 'enablebunnyhopping', '0,7'), 1);
  assert.equal(setSvVar(vars, 'autobunnyhopping', 5), 1);
  assert.equal(setSvVar(vars, 'accelerate_use_weapon_speed', 0.2), 0);
  assert.equal(setSvVar(vars, 'timebetweenducks', '0,25'), 0.25);
});
```

Os testes de conformidade ganham a inaccuracy, as velocidades e a luneta conferidas contra `docs/research/csgo-weapon-accuracy.json` (o items_game final), a bomba e os tipos de granada:

Em `tests/data.test.js`, trocar:

```
// Conformidade dos dados de balanceamento com o PROMPT 0 (seções 0.7, 0.8 e 0.11) + regras de inventário/roster.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WEAPONS, resolveWeaponId, damageAtDistance, fireInterval } from '../src/data/weapons.js';
```

por:

```
// Conformidade dos dados de balanceamento com o PROMPT 0 (seções 0.7, 0.8 e 0.11) + regras de inventário/roster; na
// Fase 3.2, inaccuracy, velocidades e luneta conferidas contra o items_game final do CS:GO (docs/research).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  BOMB, BOMB_ALIASES, SCOPE, WEAPONS, resolveWeaponId, damageAtDistance, fireInterval,
} from '../src/data/weapons.js';
import { ACCURACY, INACCURACY, NO_INACCURACY } from '../src/data/inaccuracy.js';
```

Em `tests/data.test.js`, trocar:

```
  assert.equal(r.size, 1);
});

```

por:

```
  assert.equal(r.size, 1);
});

// Classe do CS:GO de cada arma e granada (docs/research/csgo-weapon-accuracy.json).
const CSGO_CLASS = Object.freeze({
  glock: 'weapon_glock', usps: 'weapon_usp_silencer', p250: 'weapon_p250', fiveseven: 'weapon_fiveseven',
  deagle: 'weapon_deagle', mac10: 'weapon_mac10', mp9: 'weapon_mp9', ump45: 'weapon_ump45', p90: 'weapon_p90',
  nova: 'weapon_nova', xm1014: 'weapon_xm1014', galil: 'weapon_galilar', famas: 'weapon_famas', ak47: 'weapon_ak47',
  m4a4: 'weapon_m4a1', m4a1s: 'weapon_m4a1_silencer', aug: 'weapon_aug', sg553: 'weapon_sg556', ssg08: 'weapon_ssg08',
  awp: 'weapon_awp', scar20: 'weapon_scar20', g3sg1: 'weapon_g3sg1', negev: 'weapon_negev', m249: 'weapon_m249',
});
const GRENADE_CLASS = Object.freeze({
  he: 'weapon_hegrenade', flash: 'weapon_flashbang', smoke: 'weapon_smokegrenade', molotov: 'weapon_molotov',
  incendiary: 'weapon_incgrenade', decoy: 'weapon_decoy',
});
// Armas que entram no modo alt: rajada, silenciador colocado ou luneta.
const ALT_WEAPONS = Object.freeze([
  'glock', 'famas', 'usps', 'm4a1s', 'aug', 'sg553', 'ssg08', 'awp', 'scar20', 'g3sg1',
]);
const RESEARCH_FILE = new URL('../docs/research/csgo-weapon-accuracy.json', import.meta.url);
const RESEARCH = JSON.parse(readFileSync(RESEARCH_FILE, 'utf8'));
const six = (v) => Number(Number(v).toPrecision(6));

test('inaccuracy (3.2): cada arma com os números do items_game final do CS:GO, inclusive os modos alt', () => {
  assert.deepEqual(Object.keys(INACCURACY).sort(), Object.keys(CSGO_CLASS).sort());
  const FIELDS = [
    ['stand', 'inaccuracy stand'], ['crouch', 'inaccuracy crouch'], ['move', 'inaccuracy move'],
    ['jumpInitial', 'inaccuracy jump initial'], ['jump', 'inaccuracy jump'], ['land', 'inaccuracy land'],
    ['fire', 'inaccuracy fire'], ['recoveryStand', 'recovery time stand'], ['recoveryCrouch', 'recovery time crouch'],
  ];
  const ALT_FIELDS = FIELDS.filter(([k]) => ['stand', 'crouch', 'move', 'jump', 'land', 'fire'].includes(k));
  for (const [id, cls] of Object.entries(CSGO_CLASS)) {
    const d = INACCURACY[id];
    const c = RESEARCH[cls];
    for (const [k, key] of FIELDS) assert.equal(d[k], six(c[key]), `${id}.${k}`);
    assert.equal(d.jumpApex ?? 0, six(c['inaccuracy jump apex']), `${id}.jumpApex`);
    if (d.recoveryStandFinal === undefined) {
      // Sem transição: o final do CS é −1 (não usado) ou igual ao inicial.
      assert.ok(c['recovery time stand final'] < 0 || six(c['recovery time stand final']) === d.recoveryStand, id);
      assert.ok(c['recovery time crouch final'] < 0 || six(c['recovery time crouch final']) === d.recoveryCrouch, id);
    } else {
      assert.equal(d.recoveryStandFinal, six(c['recovery time stand final']), id);
      assert.equal(d.recoveryCrouchFinal, six(c['recovery time crouch final']), id);
      assert.equal(d.transitionStart, c['recovery transition start bullet'], id);
      assert.equal(d.transitionEnd, c['recovery transition end bullet'], id);
    }
    if (!ALT_WEAPONS.includes(id)) {
      assert.equal(d.alt, undefined, `${id} não entra no modo alt`);
      continue;
    }
    for (const [k, key] of ALT_FIELDS) assert.equal(d.alt[k], six(c[`${key} alt`]), `${id}.alt.${k}`);
  }
  assert.equal(INACCURACY.deagle.jumpApex, 331.55);
  assert.equal(Object.values(INACCURACY).filter((d) => d.jumpApex).length, 1, 'o termo do ápice só existe na Deagle');
  for (const k of ['stand', 'crouch', 'move', 'jumpInitial', 'jump', 'land', 'fire']) assert.equal(NO_INACCURACY[k], 0);
  assert.deepEqual([ACCURACY.moveFloor, ACCURACY.moveCeil, ACCURACY.moveExponent], [0.34, 0.95, 0.25]);
});

test('velocidades e luneta (3.2) iguais às do CS:GO final; a Negev fica nos 195 da seção 0.6', () => {
  for (const [id, cls] of Object.entries(CSGO_CLASS)) {
    const c = RESEARCH[cls];
    if (id !== 'negev') assert.equal(WEAPONS[id].moveSpeed, c['max player speed'], `${id}: velocidade`);
    const levels = c['zoom levels'];
    assert.equal(WEAPONS[id].scope?.length ?? 0, levels, `${id}: níveis de zoom`);
    if (!levels) continue;
    assert.equal(WEAPONS[id].scopedSpeed, c['max player speed alt'], `${id}: velocidade com luneta`);
    for (let l = 1; l <= levels; l++) assert.equal(WEAPONS[id].scope[l - 1], c[`zoom fov ${l}`], `${id}: FOV ${l}`);
    assert.equal(WEAPONS[id].zoomTime.length, levels + 1, `${id}: tempos de zoom`);
    for (let l = 0; l <= levels; l++) assert.equal(WEAPONS[id].zoomTime[l], c[`zoom time ${l}`], `${id}: tempo ${l}`);
  }
  assert.equal(WEAPONS.negev.moveSpeed, 195, 'seção 0.6 do PROMPT (o CS:GO final usa 150)');
  assert.equal(WEAPONS.knife.moveSpeed, RESEARCH.weapon_knife['max player speed']);
  for (const [id, cls] of Object.entries(GRENADE_CLASS)) {
    assert.equal(UTILITIES[id].moveSpeed, RESEARCH[cls]['max player speed'], `${id}: com a granada na mão`);
  }
  assert.equal(BOMB.moveSpeed, RESEARCH.weapon_c4['max player speed']);
  assert.deepEqual(SCOPE, { referenceFov: 90, cycleCooldown: 0.3 });
  assert.equal(BOMB.team, 'tr');
  for (const alias of ['c4', 'bomb', 'bomba']) assert.ok(BOMB_ALIASES.includes(alias), alias);
});

test('loadout (3.2): bomba do TR (ou com ignoreTeam), uma só; tipos de granada na ordem, sem repetir', () => {
  const ct = new Loadout({ team: 'ct' });
  assert.deepEqual(ct.giveBomb(), { ok: false, reason: 'a bomba é do TR' });
  assert.deepEqual(ct.giveBomb({ ignoreTeam: true }), { ok: true, slot: 'c4' });
  assert.equal(ct.giveBomb({ ignoreTeam: true }).ok, false, 'já está com a bomba');
  assert.ok(ct.describe().endsWith(' · bomba'));
  const tr = new Loadout({ team: 'tr' });
  assert.equal(tr.giveBomb().ok, true);
  tr.giveUtility('flash');
  tr.giveUtility('he');
  tr.giveUtility('flash');
  assert.deepEqual(tr.grenadeTypes(), ['flash', 'he']);
  assert.deepEqual(Loadout.fromJSON(tr.toJSON()).toJSON(), tr.toJSON(), 'a bomba entra no JSON');
});

```

- [ ] **Passo 2: Rodar e ver falhar**

Run: `node --test tests/movementData.test.js tests/data.test.js`
Expected: FAIL — `Cannot find module .../src/data/inaccuracy.js` e, nos dados de movimento, `MOVE`/`STEPS` indefinidos e `stepSlow` ausente.

- [ ] **Passo 3: Dados de movimento (sv_* novas com faixa, MOVE, DUCK, STEPS)**

```js file=src/data/movement.js
// Movimento do jogador (seção 0.6): cápsula, constantes do controlador e variáveis sv_* no modelo do CS:GO.
// Unidades: 1 u = 1 cm na escala do boneco (72 u de altura) — as mesmas do CS, então os números batem com os dele.
// As sv_* mudam em tempo de execução pelo console (`sv_gravity 600`); na partida online o host as replica.
// Fonte dos números da Fase 3.2 (andar, agachar, stamina, bhop, passos): código do CS:GO e dados finais do jogo —
// docs/research/csgo-movement-notes.md; decisões em docs/phases/phase-3.md (seção 3.2).

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
  staminamax: 80,
  staminajumpcost: 0.08, // por u/s de impulso do pulo
  staminalandcost: 0.05, // por u/s de queda no pouso
  staminarecoveryrate: 60, // por segundo
  enablebunnyhopping: 0, // 0: velocidade cortada em 1,1 × 260 ao pular
  autobunnyhopping: 0, // 0: precisa soltar o pulo entre dois pulos
  timebetweenducks: 0.4, // s: sem estar agachado, agachar de novo antes disso (do último agachar completo) é ignorado
  accelerate_use_weapon_speed: 1, // aceleração no chão pela velocidade do item na mão
});

/** Faixa aceita e ajuda de cada sv_* no console. `int`: 0/1 (arredonda). */
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
  Object.freeze({ key: 'staminamax', min: 0, max: 100, help: 'teto da stamina (penalidade de pulo e pouso)' }),
  Object.freeze({ key: 'staminajumpcost', min: 0, max: 1, help: 'stamina por u/s de impulso do pulo' }),
  Object.freeze({ key: 'staminalandcost', min: 0, max: 1, help: 'stamina por u/s de queda no pouso' }),
  Object.freeze({ key: 'staminarecoveryrate', min: 0, max: 1000, help: 'recuperação da stamina (por segundo)' }),
  Object.freeze({ key: 'enablebunnyhopping', min: 0, max: 1, int: true, help: '1 = sem teto de velocidade ao pular' }),
  Object.freeze({ key: 'autobunnyhopping', min: 0, max: 1, int: true, help: '1 = pula de novo segurando o botão' }),
  Object.freeze({ key: 'timebetweenducks', min: 0, max: 2, help: 'espera (s) para agachar de novo após completar' }),
  Object.freeze({
    key: 'accelerate_use_weapon_speed', min: 0, max: 1, int: true, help: '1 = aceleração pela velocidade da arma',
  }),
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

/** Teto e modificadores de velocidade do CS:GO (cs_shareddefs.cpp, cs_gamemovement.cpp). */
export const MOVE = Object.freeze({
  runSpeed: 260, // CS_PLAYER_SPEED_RUN: teto de qualquer item e base do teto do bhop
  walkModifier: 0.52, // CS_PLAYER_SPEED_WALK_MODIFIER (Shift)
  walkCapMargin: 25, // o andar só engata com a velocidade abaixo de teto × 0,52 + 25
  walkDampWindow: 5, // u/s: andando, a aceleração some nos últimos 5 u/s antes da meta
  accelerateReference: 250, // escala mínima da aceleração no chão (o flMaxSpeed do CCSGameMovement::Accelerate)
  slowSniperWalkSpeed: 110, // luneta de 2+ níveis, com zoom e velocidade × 0,52 abaixo disto: "sniper lenta"
  bunnyJumpFactor: 1.1, // BUNNYJUMP_MAX_SPEED_FACTOR: teto do bhop = 1,1 × runSpeed
  staminaRange: 100, // STAMINA_RANGE: divisor dos efeitos da stamina (não é o sv_staminamax)
  jumpSoundSpeed: 126, // pulo com velocidade 3D acima disto é ouvido pelos outros
});

/** Agachar (CS:GO, CCSGameMovement::CheckParameters/Duck). */
export const DUCK = Object.freeze({
  speed: 8, // CS_PLAYER_DUCK_SPEED_IDEAL: velocidade cheia do agachar (fração da transição por segundo)
  downFactor: 0.8, // descer é mais lento que levantar: 0,8 × velocidade
  speedMultiplier: 0.34, // CS_PLAYER_SPEED_DUCK_MODIFIER: velocidade agachado
  spamPenalty: 2, // cada mudança da tecla (apertar e soltar) tira isto da velocidade do agachar
  minEnabled: 1.5, // abaixo disto a tecla de agachar é ignorada
  recovery: 3, // recuperação da velocidade do agachar (por segundo)
  recoveryAway: 6, // mais esta, todo em pé ou agachado e longe de onde a velocidade estava cheia
  recoveryAwayDistance: 64, // "longe" (u, no plano)
  minUnduck: 1.5, // levantar nunca é mais lento que isto
  flagClear: 0.75, // levantando, o FL_DUCKING cai quando o quanto agachou fica abaixo disto
  sinceMax: 60, // teto (s) do "tempo desde o último agachar completo"
});

/** Passos (CCSPlayer::UpdateStepSound + CBasePlayer::UpdateStepSound): relógio em ms e velocidades em u/s. */
export const STEPS = Object.freeze({
  audibleSpeed: 135.2, // 260 × 0,52: abaixo disto, ou andando (Shift), o passo é silencioso
  stoppedSpeedSq: 10, // |v|² abaixo disto: parado, o relógio recomeça
  fastInterval: 300,
  slowInterval: 400,
  frequency: 0.97, // sv_footstep_sound_frequency: multiplica o intervalo
  duckExtra: 100, // com FL_DUCKING o passo demora mais
  walkSpeed: 90, // velocidade mínima para dar passo
  runSpeed: 220, // abaixo disto o passo é da classe lenta (cadência 400, volume menor)
  duckWalkSpeed: 60, // o mesmo com FL_DUCKING
  duckRunSpeed: 80,
  duckVolume: 0.65,
  landAudibleSpeed: 270, // pouso ouvido pelos outros (velocidade de queda)
  roughLandSpeed: 350, // pouso pesado: atrasa o próximo passo
  roughLandDelay: 400,
  transmitDistance: 1250, // passos não chegam a quem está mais longe que isto (audição dos bots, Fase 7)
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

- [ ] **Passo 4: Superfícies: volume do passo nas duas classes do CS:GO**

```js file=src/data/surfaces.js
// Materiais de superfície da colisão. Cada triângulo de colisão guarda o índice do seu material
// (src/physics/colliders.js). Campos:
//   friction: multiplica o sv_friction e a aceleração no chão (o competitivo usa 1 em tudo, como os mapas do CS)
//   jumpFactor: multiplica o impulso do pulo
//   imprint: aceita pegadas (massinha)
//   stepSlow, stepFast: volume do passo nas classes lenta e rápida do CS:GO (áudio da Fase 12 e audição dos bots da
//     Fase 7). Duros como o concreto do CS (0,2/0,5); papelão e plástico um pouco mais; metal e arame como os dutos
//     do CS (0,4/0,7); massinha e tecido abaixo de tudo — o CS não tem superfícies moles, é escolha nossa.

const S = (o) => Object.freeze(o);

export const SURFACES = Object.freeze([
  S({
    id: 'padrao', label: 'Padrão', friction: 1, jumpFactor: 1, imprint: false,
    stepSlow: 0.2, stepFast: 0.5,
  }),
  S({
    id: 'tapete', label: 'Tapete de corte', friction: 1, jumpFactor: 1, imprint: false,
    stepSlow: 0.2, stepFast: 0.5,
  }),
  S({
    id: 'papelao', label: 'Papelão', friction: 1, jumpFactor: 1, imprint: false,
    stepSlow: 0.25, stepFast: 0.55,
  }),
  S({
    id: 'massinha', label: 'Massinha', friction: 1, jumpFactor: 1, imprint: true,
    stepSlow: 0.15, stepFast: 0.4,
  }),
  S({
    id: 'madeira', label: 'Madeira', friction: 1, jumpFactor: 1, imprint: false,
    stepSlow: 0.2, stepFast: 0.5,
  }),
  S({
    id: 'metal', label: 'Metal de ferramenta', friction: 1, jumpFactor: 1, imprint: false,
    stepSlow: 0.4, stepFast: 0.7,
  }),
  S({
    id: 'plastico', label: 'Plástico de pote', friction: 1, jumpFactor: 1, imprint: false,
    stepSlow: 0.25, stepFast: 0.55,
  }),
  S({
    id: 'fita', label: 'Fita crepe', friction: 1, jumpFactor: 1, imprint: false,
    stepSlow: 0.2, stepFast: 0.5,
  }),
  S({
    id: 'arame', label: 'Arame', friction: 1, jumpFactor: 1, imprint: false,
    stepSlow: 0.4, stepFast: 0.7,
  }),
  S({
    id: 'tecido', label: 'Tecido (molleton)', friction: 1, jumpFactor: 1, imprint: false,
    stepSlow: 0.1, stepFast: 0.3,
  }),
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

- [ ] **Passo 5: Luneta, bomba e granadas**

Em `src/data/weapons.js`, trocar:

```
//   scope: níveis de zoom (multiplicador de FOV)    silencer: 'removable' quando tem silenciador removível
//   helmetBypass: ignora capacete (AWP)             heavyArmorPen: penetração alta que atravessa capacete
// Recoil, spread e padrões de spray entram na Fase 4 (src/data/sprayPatterns.js e src/data/inaccuracy.js).
```

por:

```
//   scope: FOV de cada nível de zoom (graus, na referência de 90° do CS)
//   zoomTime: duração da transição do FOV para cada nível (s; o índice 0 é sair do zoom)
//   silencer: 'removable' quando tem silenciador removível
//   helmetBypass: ignora capacete (AWP)             heavyArmorPen: penetração alta que atravessa capacete
// Inaccuracy (Fase 3.2) em src/data/inaccuracy.js; recoil, spread e padrões de spray entram na Fase 4.
```

Em `src/data/weapons.js`, trocar:

```
    moveSpeed: 220, scopedSpeed: 150, team: 'ct', rangeModifier: 0.98, range: 8192, penetration: 2, modes: ['auto'],
    scope: [0.55],
```

por:

```
    moveSpeed: 220, scopedSpeed: 150, team: 'ct', rangeModifier: 0.98, range: 8192, penetration: 2, modes: ['auto'],
    scope: [45], zoomTime: [0.06, 0.1],
```

Em `src/data/weapons.js`, trocar:

```
    scope: [0.55], heavyArmorPen: true,
```

por:

```
    scope: [45], zoomTime: [0.06, 0.1], heavyArmorPen: true,
```

Em `src/data/weapons.js`, trocar:

```
    moveSpeed: 230, scopedSpeed: 230, team: null, rangeModifier: 0.98, range: 8192, penetration: 2.5, modes: ['semi'],
    scope: [0.4, 0.15],
```

por:

```
    moveSpeed: 230, scopedSpeed: 230, team: null, rangeModifier: 0.98, range: 8192, penetration: 2.5, modes: ['semi'],
    scope: [40, 15], zoomTime: [0.05, 0.05, 0.05],
```

Em `src/data/weapons.js`, trocar:

```
    scope: [0.4, 0.1], helmetBypass: true, heavyArmorPen: true,
```

por:

```
    scope: [40, 10], zoomTime: [0.05, 0.05, 0.05], helmetBypass: true, heavyArmorPen: true,
```

Em `src/data/weapons.js`, trocar:

```
    moveSpeed: 215, scopedSpeed: 120, team: 'ct', rangeModifier: 0.98, range: 8192, penetration: 2.5, modes: ['semi'],
    scope: [0.4, 0.15],
```

por:

```
    moveSpeed: 215, scopedSpeed: 120, team: 'ct', rangeModifier: 0.98, range: 8192, penetration: 2.5, modes: ['semi'],
    scope: [40, 15], zoomTime: [0.05, 0.05, 0.05],
```

Em `src/data/weapons.js`, trocar:

```
    scope: [0.4, 0.15],
```

por:

```
    scope: [40, 15], zoomTime: [0.05, 0.05, 0.05],
```

Em `src/data/weapons.js`, trocar:

```

/** Apelidos aceitos no console (`give ak`, `give usp`, `give scout`...). */
```

por:

```

/** Luneta (CS:GO): FOV de referência dos níveis de zoom e espera entre dois cliques do botão de mirar. */
export const SCOPE = Object.freeze({ referenceFov: 90, cycleCooldown: 0.3 });

/** A bomba (C4) na mão: nome, velocidade e time (o objetivo da bomba é da Fase 8). */
export const BOMB = Object.freeze({ id: 'c4', name: 'Bomba', moveSpeed: 250, team: 'tr' });

/** Nomes aceitos no console para a bomba (`give bomba`). */
export const BOMB_ALIASES = Object.freeze(['c4', 'bomb', 'bomba']);

/** Apelidos aceitos no console (`give ak`, `give usp`, `give scout`...). */
```

Em `src/data/economy.js`, trocar:

```
/** Utilitários da loja (equipamento e granadas). `team`: null = ambos. */
```

por:

```
/** Utilitários da loja (equipamento e granadas). `team`: null = ambos. `moveSpeed`: com a granada na mão. */
```

Em `src/data/economy.js`, trocar:

```
  he: Object.freeze({ id: 'he', name: 'Granada HE', price: 300, kind: 'grenade', team: null }),
  flash: Object.freeze({ id: 'flash', name: 'Flash', price: 200, kind: 'grenade', team: null }),
  smoke: Object.freeze({ id: 'smoke', name: 'Smoke', price: 300, kind: 'grenade', team: null }),
  molotov: Object.freeze({ id: 'molotov', name: 'Molotov', price: 400, kind: 'grenade', team: 'tr' }),
  incendiary: Object.freeze({ id: 'incendiary', name: 'Incendiária', price: 600, kind: 'grenade', team: 'ct' }),
  decoy: Object.freeze({ id: 'decoy', name: 'Decoy', price: 50, kind: 'grenade', team: null }),
```

por:

```
  he: Object.freeze({ id: 'he', name: 'Granada HE', price: 300, kind: 'grenade', team: null, moveSpeed: 245 }),
  flash: Object.freeze({ id: 'flash', name: 'Flash', price: 200, kind: 'grenade', team: null, moveSpeed: 245 }),
  smoke: Object.freeze({ id: 'smoke', name: 'Smoke', price: 300, kind: 'grenade', team: null, moveSpeed: 245 }),
  molotov: Object.freeze({ id: 'molotov', name: 'Molotov', price: 400, kind: 'grenade', team: 'tr', moveSpeed: 245 }),
  incendiary: Object.freeze({
    id: 'incendiary', name: 'Incendiária', price: 600, kind: 'grenade', team: 'ct', moveSpeed: 245,
  }),
  decoy: Object.freeze({ id: 'decoy', name: 'Decoy', price: 50, kind: 'grenade', team: null, moveSpeed: 245 }),
```

- [ ] **Passo 6: Inaccuracy por arma (gerada do JSON da pesquisa; conferida pelo teste)**

```js file=src/data/inaccuracy.js
// Inaccuracy das armas (seção 0.7; o CWeaponCSBase do CS:GO) — valores do items_game.txt final do CS:GO (maio de
// 2023), nas unidades do CS: × 0,001 ≈ radianos. Fonte e conferência (269 de 275 valores iguais a uma planilha
// independente): docs/research/csgo-inaccuracy-notes.md e docs/research/csgo-weapon-accuracy.json.
// Campos de cada arma (`alt` traz os que mudam no modo alt — luneta, silenciador colocado ou rajada):
//   stand, crouch: base em pé e agachada (FL_DUCKING)      move: termo de movimento cheio (a 95% da velocidade)
//   jumpInitial: termo do ar com vy = impulso do pulo       jumpApex: o mesmo no ápice (só a Deagle; 0 nas outras)
//   jump: somado à base em pé enquanto está no ar           land: por u/s de queda no pouso
//   fire: por disparo (a Fase 4 chama)
//   recoveryStand, recoveryCrouch: tempo (s) em que o excesso de penalidade cai 10×; com recoveryStandFinal e
//     recoveryCrouchFinal o tempo vai do inicial ao final entre as balas transitionStart e transitionEnd
// Faca, granadas e bomba não têm inaccuracy (NO_INACCURACY). A Fase 4 acrescenta spread e recoil neste arquivo.

const A = (o) => Object.freeze(o);

/** Multiplicador das unidades do CS (os números abaixo × 0,001 ≈ radianos). */
export const INACCURACY_UNIT = 0.001;

/** Constantes do CWeaponCSBase (GetInaccuracy, UpdateAccuracyPenalty, GetRecoveryTime). */
export const ACCURACY = Object.freeze({
  moveFloor: 0.34, // abaixo de 34% da velocidade da arma o movimento não pesa (CS_PLAYER_SPEED_DUCK_MODIFIER)
  moveCeil: 0.95, // a 95% o termo de movimento é cheio
  moveExponent: 0.25, // MOVEMENT_CURVE01_EXPONENT (andando com Shift a rampa é linear)
  airScale: 1, // weapon_air_spread_scale
  airFloorFraction: 0.25, // o termo do ar começa em 0,25 × √impulso do pulo
  airMaxFactor: 2, // teto do termo do ar: 2 × jumpInitial
  airRecoveryFactor: 4, // no ar a recuperação é a do agachado × 4
  recoilDecayThreshold: 1.1, // o índice de recuo só decai depois de 1,1 × o intervalo entre tiros sem atirar
  recoilDecayCoefficient: 2, // weapon_recoil_decay_coefficient: o índice cai 10× a cada 1/2 s
  sinceShotMax: 60, // teto (s) do tempo desde o último tiro
  max: 1, // teto da inaccuracy do tiro
});

/** Item sem inaccuracy (faca, granadas, bomba). */
export const NO_INACCURACY = A({
  stand: 0, crouch: 0, move: 0, jumpInitial: 0, jump: 0, land: 0, fire: 0, recoveryStand: 1, recoveryCrouch: 1,
});

export const INACCURACY = Object.freeze({
  glock: A({
    stand: 5.6, crouch: 4.2, move: 10, jumpInitial: 96.62, jump: 87.87, land: 0.185, fire: 56, recoveryStand: 0.2,
    recoveryCrouch: 0.2, recoveryStandFinal: 0.33, recoveryCrouchFinal: 0.33, transitionStart: 0, transitionEnd: 5,
    // alt = rajada
    alt: A({ stand: 5.6, crouch: 3, move: 12.95, jump: 87.87, land: 0.185, fire: 45 }),
  }),
  usps: A({
    stand: 4.9, crouch: 3.68, move: 13.87, jumpInitial: 96.6, jump: 94.48, land: 0.191, fire: 71,
    recoveryStand: 0.349532, recoveryCrouch: 0.291277,
    // alt = silenciador colocado (o padrão)
    alt: A({ stand: 4.9, crouch: 3.68, move: 13.87, jump: 94.48, land: 0.198, fire: 52 }),
  }),
  p250: A({
    stand: 9.1, crouch: 6.83, move: 20, jumpInitial: 96.62, jump: 92.96, land: 0.19, fire: 52.45,
    recoveryStand: 0.345388, recoveryCrouch: 0.287823,
  }),
  fiveseven: A({
    stand: 9.1, crouch: 6.83, move: 40, jumpInitial: 99.88, jump: 89.7, land: 0.19, fire: 25, recoveryStand: 0.2,
    recoveryCrouch: 0.2, recoveryStandFinal: 0.5, recoveryCrouchFinal: 0.5, transitionStart: 0, transitionEnd: 5,
  }),
  deagle: A({
    stand: 4.2, crouch: 2.18, move: 48.1, jumpInitial: 548.82, jumpApex: 331.55, jump: 40.55, land: 0.043,
    fire: 72.23, recoveryStand: 0.8112, recoveryCrouch: 0.449927,
  }),
  mac10: A({
    stand: 13.3, crouch: 9.98, move: 13.99, jumpInitial: 34.99, jump: 33.3, land: 0.069, fire: 4.76,
    recoveryStand: 0.399729, recoveryCrouch: 0.285521,
  }),
  mp9: A({
    stand: 9, crouch: 5.5, move: 29.04, jumpInitial: 37.28, jump: 18.43, land: 0.056, fire: 3.7,
    recoveryStand: 0.25789, recoveryCrouch: 0.184207,
  }),
  ump45: A({
    stand: 13.43, crouch: 10.07, move: 28.76, jumpInitial: 47.21, jump: 37.25, land: 0.085, fire: 3.42,
    recoveryStand: 0.349993, recoveryCrouch: 0.249995,
  }),
  p90: A({
    stand: 13.65, crouch: 10.24, move: 31, jumpInitial: 104.6, jump: 90.08, land: 0.082, fire: 2.85,
    recoveryStand: 0.372098, recoveryCrouch: 0.265784,
  }),
  nova: A({
    stand: 7, crouch: 5.25, move: 36.75, jumpInitial: 109.7, jump: 126.31, land: 0.236, fire: 9.72,
    recoveryStand: 0.460517, recoveryCrouch: 0.328941,
  }),
  xm1014: A({
    stand: 7, crouch: 5.25, move: 36.03, jumpInitial: 100.38, jump: 130.83, land: 0.232, fire: 8.83,
    recoveryStand: 0.506569, recoveryCrouch: 0.361835,
  }),
  galil: A({
    stand: 8.77, crouch: 6.58, move: 123.56, jumpInitial: 105.39, jump: 149.78, land: 0.256, fire: 7,
    recoveryStand: 0.3, recoveryCrouch: 0.15, recoveryStandFinal: 0.5, recoveryCrouchFinal: 0.47, transitionStart: 2,
    transitionEnd: 5,
  }),
  famas: A({
    stand: 9.85, crouch: 7.39, move: 99.34, jumpInitial: 94.77, jump: 110.39, land: 0.205, fire: 6.05,
    recoveryStand: 0.25, recoveryCrouch: 0.12, recoveryStandFinal: 0.5, recoveryCrouchFinal: 0.48, transitionStart: 2,
    transitionEnd: 5,
    // alt = rajada
    alt: A({ stand: 3.69, crouch: 3.25, move: 99.34, jump: 110.39, land: 0.205, fire: 3.35 }),
  }),
  ak47: A({
    stand: 6.41, crouch: 4.81, move: 175.06, jumpInitial: 100.94, jump: 140.76, land: 0.242, fire: 7.8,
    recoveryStand: 0.368, recoveryCrouch: 0.305257, recoveryStandFinal: 0.506, recoveryCrouchFinal: 0.419728,
    transitionStart: 2, transitionEnd: 5,
  }),
  m4a4: A({
    stand: 4.9, crouch: 4.1, move: 137.88, jumpInitial: 94.41, jump: 97.27, land: 0.192, fire: 7,
    recoveryStand: 0.338941, recoveryCrouch: 0.2421, recoveryStandFinal: 0.466044, recoveryCrouchFinal: 0.332888,
    transitionStart: 2, transitionEnd: 5,
  }),
  m4a1s: A({
    stand: 4.9, crouch: 4.1, move: 92.88, jumpInitial: 96.77, jump: 99.7, land: 0.197, fire: 12,
    recoveryStand: 0.338941, recoveryCrouch: 0.2421, recoveryStandFinal: 0.466044, recoveryCrouchFinal: 0.332888,
    transitionStart: 2, transitionEnd: 5,
    // alt = silenciador colocado (o padrão)
    alt: A({ stand: 4.9, crouch: 4.1, move: 122, jump: 99.7, land: 0.197, fire: 7 }),
  }),
  aug: A({
    stand: 4.9, crouch: 3.68, move: 135.45, jumpInitial: 101.56, jump: 105.99, land: 0.208, fire: 7.29,
    recoveryStand: 0.429727, recoveryCrouch: 0.30552,
    // alt = com luneta
    alt: A({ stand: 3.68, crouch: 3.11, move: 105.45, jump: 105.99, land: 0.208, fire: 7.29 }),
  }),
  sg553: A({
    stand: 5.81, crouch: 3.81, move: 136.01, jumpInitial: 78.79, jump: 109, land: 0.188, fire: 7.95,
    recoveryStand: 0.452886, recoveryCrouch: 0.379204,
    // alt = com luneta
    alt: A({ stand: 3.81, crouch: 3.05, move: 136.01, jump: 109, land: 0.188, fire: 9.2 }),
  }),
  ssg08: A({
    stand: 31.7, crouch: 23.78, move: 123.45, jumpInitial: 208.72, jump: 5.72, land: 0.215, fire: 22.92,
    recoveryStand: 0.142096, recoveryCrouch: 0.055783,
    // alt = com luneta
    alt: A({ stand: 3, crouch: 2.8, move: 123.45, jump: 5.72, land: 0.215, fire: 22.92 }),
  }),
  awp: A({
    stand: 80.8, crouch: 60.6, move: 176.48, jumpInitial: 172.86, jump: 133.83, land: 0.307, fire: 53.85,
    recoveryStand: 0.34539, recoveryCrouch: 0.24671,
    // alt = com luneta
    alt: A({ stand: 2, crouch: 1.5, move: 176.48, jump: 133.83, land: 0.1, fire: 53.85 }),
  }),
  scar20: A({
    stand: 25.8, crouch: 19.35, move: 150.48, jumpInitial: 107.69, jump: 153.77, land: 0.262, fire: 18.61,
    recoveryStand: 0.544331, recoveryCrouch: 0.388808,
    // alt = com luneta
    alt: A({ stand: 2, crouch: 1.5, move: 150.48, jump: 153.77, land: 0.262, fire: 18.61 }),
  }),
  g3sg1: A({
    stand: 25.8, crouch: 19.35, move: 150.48, jumpInitial: 107.69, jump: 153.77, land: 0.262, fire: 18.61,
    recoveryStand: 0.544331, recoveryCrouch: 0.388808,
    // alt = com luneta
    alt: A({ stand: 2, crouch: 1.5, move: 150.48, jump: 153.77, land: 0.262, fire: 18.61 }),
  }),
  negev: A({
    stand: 10.17, crouch: 7.63, move: 159.14, jumpInitial: 116.29, jump: 292.23, land: 0.409, fire: 30,
    recoveryStand: 0.3, recoveryCrouch: 0.25, recoveryStandFinal: 0.1, recoveryCrouchFinal: 0.08, transitionStart: 9,
    transitionEnd: 12,
  }),
  m249: A({
    stand: 7.7, crouch: 5.34, move: 156.25, jumpInitial: 118.27, jump: 279.47, land: 0.398, fire: 3.56,
    recoveryStand: 0.828931, recoveryCrouch: 0.592093,
  }),
});
```

- [ ] **Passo 7: sv_* de 0/1 arredondam; bomba e tipos de granada no inventário**

Em `src/player/movementVars.js`, trocar:

```
/** Troca uma variável (limitada à faixa do console). Devolve o valor aplicado; erro para chave ou valor inválido. */
```

por:

```
/**
 * Troca uma variável (limitada à faixa do console; as de 0/1 arredondam). Devolve o valor aplicado; erro para chave
 * ou valor inválido.
 */
```

Em `src/player/movementVars.js`, trocar:

```
  vars[key] = Math.min(spec.max, Math.max(spec.min, n));
```

por:

```
  const v = Math.min(spec.max, Math.max(spec.min, n));
  vars[key] = spec.int ? Math.round(v) : v;
```

Em `src/player/loadout.js`, trocar:

```
// Gun Game usam estas mesmas regras. Munição e estado de cada arma ficam no sistema de armas (Fase 4).

import { WEAPONS } from '../data/weapons.js';
```

por:

```
// Gun Game usam estas mesmas regras. O item na mão fica em src/player/hands.js (Fase 3.2); munição e estado de cada
// arma ficam no sistema de armas (Fase 4).

import { BOMB, WEAPONS } from '../data/weapons.js';
```

Em `src/player/loadout.js`, trocar:

```

  removeGrenade(utilId) {
```

por:

```

  /** A bomba (C4) do TR: uma só. `ignoreTeam` para cheats. */
  giveBomb({ ignoreTeam = false } = {}) {
    if (!ignoreTeam && this.team && this.team !== BOMB.team) return { ok: false, reason: 'a bomba é do TR' };
    if (this.bomb) return { ok: false, reason: 'já está com a bomba' };
    this.bomb = true;
    return { ok: true, slot: 'c4' };
  }

  /** Tipos de granada na ordem em que entraram (a tecla 4 e a roda de troca seguem esta ordem). */
  grenadeTypes() {
    return [...new Set(this.grenades)];
  }

  removeGrenade(utilId) {
```

Em `src/player/loadout.js`, trocar:

```
    return `primária: ${name(this.primary)} · pistola: ${name(this.secondary)} · faca: ${name(this.melee)} · granadas: ${nades} · colete: ${this.armor}${this.helmet ? ' + capacete' : ''}`;
```

por:

```
    return `primária: ${name(this.primary)} · pistola: ${name(this.secondary)} · faca: ${name(this.melee)}` +
      ` · granadas: ${nades} · colete: ${this.armor}${this.helmet ? ' + capacete' : ''}` +
      `${this.bomb ? ' · bomba' : ''}`;
```

- [ ] **Passo 8: Rodar e ver passar**

Run: `node --test tests/movementData.test.js tests/data.test.js`
Expected: PASS (15 testes).

- [ ] **Passo 9: Suíte inteira**

Run: `npm test`
Expected: todos os testes passando (nenhum teste da 3.1 quebra).

- [ ] **Passo 10: Commit (só quando o usuário pedir)**

```bash
git add src/data tests/movementData.test.js tests/data.test.js src/player/movementVars.js src/player/loadout.js
git commit -m "feat(fase-3.2): dados do movimento tático, luneta, bomba e inaccuracy do CS:GO" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Tarefa 2: Comando do tick com troca de item e o item na mão (hands.js)

**Files:**
- Modify: `src/player/moveCmd.js` (arquivo inteiro)
- Create: `src/player/hands.js`
- Test: `tests/hands.test.js`

- [ ] **Passo 1: Escrever o teste**

```js file=tests/hands.test.js
// Testes do item na mão (Fase 3.2): ordem dos itens, troca por slot, roda e Q, sincronização com o inventário, troca
// automática no give, luneta (níveis, 0,3 s, FOV, sensibilidade), modo alt, velocidade do item e sniper lenta.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SCOPE } from '../src/data/weapons.js';
import {
  applySelect, autoSwitchSelect, carriedItems, createHands, isSlowSniper, itemAt, itemName, itemSpeed, syncHands,
  updateZoom, weaponAlt, zoomFactor, zoomFov, zoomLevels, zoomLookScale, zoomTime,
} from '../src/player/hands.js';
import { Loadout } from '../src/player/loadout.js';
import { SELECT } from '../src/player/moveCmd.js';

const DT = 1 / 64;

/** Inventário cheio: AK, Glock, faca, flash + HE + flash e a bomba. */
function fullLoadout() {
  const l = new Loadout({ team: 'tr' });
  l.give('ak47');
  l.give('glock');
  l.giveUtility('flash');
  l.giveUtility('he');
  l.giveUtility('flash');
  l.giveBomb();
  return l;
}

/** Mão já sincronizada com o inventário (sacou o melhor item). */
function handsFor(loadout) {
  const h = createHands();
  syncHands(h, loadout);
  return h;
}

const where = (h) => (h.slot === 'grenade' ? `grenade:${h.grenade}` : h.slot);

test('ordem dos itens: primária → pistola → faca → granadas (tipos na ordem de entrada) → bomba', () => {
  const l = fullLoadout();
  assert.deepEqual(carriedItems(l).map((e) => (e.grenade ? `grenade:${e.grenade}` : e.slot)),
    ['primary', 'secondary', 'melee', 'grenade:flash', 'grenade:he', 'c4']);
  assert.equal(itemAt(l, 'primary'), 'ak47');
  assert.equal(itemAt(l, 'grenade', 'he'), 'he');
  assert.equal(itemAt(l, 'grenade', 'smoke'), null, 'granada que não tem');
  assert.equal(itemAt(l, 'c4'), 'c4');
  const h = handsFor(l);
  assert.equal(h.slot, 'primary', 'sacou o melhor item');
  assert.equal(h.item, 'ak47');
});

test('slots 1–5: vazio não troca, 4 cicla os tipos de granada, 5 pega a bomba', () => {
  const l = new Loadout({ team: 'tr' });
  l.giveUtility('flash');
  l.giveUtility('smoke');
  const h = handsFor(l);
  assert.equal(h.slot, 'melee', 'só faca e granadas: a faca vem antes');
  assert.equal(applySelect(h, l, SELECT.SLOT1), false, 'sem primária');
  assert.equal(applySelect(h, l, SELECT.SLOT2), false, 'sem pistola');
  assert.equal(applySelect(h, l, SELECT.SLOT5), false, 'sem bomba');
  assert.equal(applySelect(h, l, SELECT.SLOT3), false, 'já está na faca');
  assert.equal(applySelect(h, l, SELECT.SLOT4), true);
  assert.equal(where(h), 'grenade:flash');
  applySelect(h, l, SELECT.SLOT4);
  assert.equal(where(h), 'grenade:smoke');
  applySelect(h, l, SELECT.SLOT4);
  assert.equal(where(h), 'grenade:flash', 'volta ao primeiro tipo');
  l.giveBomb();
  assert.equal(applySelect(h, l, SELECT.SLOT5), true);
  assert.equal(h.slot, 'c4');
  syncHands(h, l);
  assert.equal(h.item, 'c4');
});

test('roda dá a volta nos itens; Q volta ao anterior enquanto ele existir', () => {
  const l = fullLoadout();
  const h = handsFor(l);
  const seq = [];
  for (let i = 0; i < 6; i++) {
    applySelect(h, l, SELECT.NEXT);
    seq.push(where(h));
  }
  assert.deepEqual(seq, ['secondary', 'melee', 'grenade:flash', 'grenade:he', 'c4', 'primary']);
  applySelect(h, l, SELECT.PREV);
  assert.equal(h.slot, 'c4', 'anterior a partir da primária dá a volta para a bomba');
  applySelect(h, l, SELECT.SLOT2);
  assert.equal(applySelect(h, l, SELECT.LAST), true);
  assert.equal(h.slot, 'c4');
  assert.equal(applySelect(h, l, SELECT.LAST), true);
  assert.equal(h.slot, 'secondary', 'Q alterna entre os dois últimos');
  l.secondary = null; // a pistola sumiu (largada)
  applySelect(h, l, SELECT.SLOT3);
  assert.equal(applySelect(h, l, SELECT.LAST), false, 'o anterior não existe mais');
  assert.equal(h.slot, 'melee');
  assert.equal(applySelect(h, l, SELECT.NONE), false, 'nenhum pedido');
});

test('sincronização: item que some leva ao melhor que sobrou; arma trocada no slot conta como sacar', () => {
  const l = fullLoadout();
  const h = handsFor(l);
  h.zoom = 1;
  assert.equal(syncHands(h, l), false, 'nada mudou');
  l.give('m4a4', { ignoreTeam: true }); // a M4 entra no lugar da AK
  assert.equal(syncHands(h, l), true);
  assert.equal(h.item, 'm4a4');
  assert.equal(h.zoom, 0, 'sacar tira o zoom');
  applySelect(h, l, SELECT.SLOT4);
  syncHands(h, l);
  assert.equal(h.item, 'flash');
  l.grenades = ['he']; // as flashes acabaram
  assert.equal(syncHands(h, l), true);
  assert.equal(h.slot, 'primary', 'item da mão sumiu: vai para o melhor (a primária)');
  l.primary = null;
  l.secondary = null;
  syncHands(h, l);
  assert.equal(h.item, 'knife');
});

test('troca automática no give: só arma de posto melhor que a da mão', () => {
  const h = createHands(); // faca na mão
  assert.equal(autoSwitchSelect(h, 'primary'), SELECT.SLOT1);
  assert.equal(autoSwitchSelect(h, 'secondary'), SELECT.SLOT2);
  assert.equal(autoSwitchSelect(h, 'melee'), SELECT.NONE, 'mesmo posto');
  assert.equal(autoSwitchSelect(h, 'grenade'), SELECT.NONE, 'granada nunca troca sozinha');
  assert.equal(autoSwitchSelect(h, 'c4'), SELECT.NONE, 'bomba nunca troca sozinha');
  h.slot = 'primary';
  assert.equal(autoSwitchSelect(h, 'secondary'), SELECT.NONE);
  assert.equal(autoSwitchSelect(h, 'primary'), SELECT.NONE);
  h.slot = 'grenade';
  assert.equal(autoSwitchSelect(h, 'melee'), SELECT.SLOT3);
});

test('luneta: níveis por arma; segurar cicla a cada 0,3 s; sem luneta e no noclip não mexe', () => {
  assert.deepEqual(['awp', 'ssg08', 'scar20', 'g3sg1', 'aug', 'sg553', 'ak47', 'knife'].map(zoomLevels),
    [2, 2, 2, 2, 1, 1, 0, 0]);
  const h = handsFor(Object.assign(new Loadout(), { primary: 'awp' }));
  const levels = [];
  for (let i = 0; i < 64; i++) {
    if (updateZoom(h, true, DT)) levels.push(`${i}:${h.zoom}`);
  }
  // 0,3 s = 19,2 ticks: o próximo clique vale no 20º tick.
  assert.deepEqual(levels, ['0:1', '20:2', '40:0', '60:1']);
  assert.equal(updateZoom(h, false, DT), false, 'soltou: nada');
  h.zoomCooldown = 0;
  assert.equal(updateZoom(h, true, DT, false), false, 'noclip não mexe no zoom');
  assert.equal(h.zoom, 1);
  h.zoomCooldown = 0.1;
  updateZoom(h, false, 0.05, false);
  assert.ok(Math.abs(h.zoomCooldown - 0.05) < 1e-12, 'o tempo desconta mesmo sem mexer');
  const knife = handsFor(new Loadout());
  assert.equal(updateZoom(knife, true, DT), false, 'faca não tem luneta');
  assert.equal(SCOPE.cycleCooldown, 0.3);
});

test('luneta: FOV, multiplicador da tangente, tempo de transição e sensibilidade', () => {
  assert.equal(zoomFov('awp', 0), null);
  assert.equal(zoomFov('awp', 1), 40);
  assert.equal(zoomFov('awp', 2), 10);
  assert.equal(zoomFov('ssg08', 2), 15);
  assert.equal(zoomFov('aug', 1), 45);
  assert.equal(zoomFactor('ak47', 0), 1);
  assert.ok(Math.abs(zoomFactor('awp', 1) - Math.tan((20 * Math.PI) / 180)) < 1e-12);
  assert.ok(Math.abs(zoomFactor('awp', 2) - Math.tan((5 * Math.PI) / 180)) < 1e-12);
  assert.ok(Math.abs(zoomFactor('sg553', 1) - Math.tan((22.5 * Math.PI) / 180)) < 1e-12);
  assert.equal(zoomTime('awp', 1), 0.05);
  assert.equal(zoomTime('aug', 1), 0.1, 'AUG entra em 0,1 s');
  assert.equal(zoomTime('aug', 0), 0.06, 'e sai em 0,06 s');
  assert.equal(zoomTime('ak47', 1), 0);
  assert.equal(zoomLookScale('awp', 0, 1), 1);
  assert.ok(Math.abs(zoomLookScale('awp', 1, 1) - 40 / 90) < 1e-12);
  assert.ok(Math.abs(zoomLookScale('awp', 2, 1.5) - (1.5 * 10) / 90) < 1e-12);
});

test('modo alt, velocidade do item e sniper lenta', () => {
  assert.equal(weaponAlt('awp', 0), false);
  assert.equal(weaponAlt('awp', 1), true);
  assert.equal(weaponAlt('usps', 0), true, 'silenciador colocado é o padrão');
  assert.equal(weaponAlt('m4a1s', 0, false), false, 'sem silenciador');
  assert.equal(weaponAlt('glock', 0), false, 'rajada liga na Fase 4');
  assert.equal(weaponAlt('famas', 0, true, true), true);
  assert.equal(weaponAlt('ak47', 0), false);
  assert.equal(weaponAlt('flash', 0), false);
  assert.equal(itemSpeed('knife', false), 250);
  assert.equal(itemSpeed('ak47', false), 215);
  assert.equal(itemSpeed('m4a4', false), 225);
  assert.equal(itemSpeed('awp', false), 200);
  assert.equal(itemSpeed('awp', true), 100);
  assert.equal(itemSpeed('aug', true), 150);
  assert.equal(itemSpeed('ssg08', true), 230);
  assert.equal(itemSpeed('negev', false), 195);
  assert.equal(itemSpeed('c4', false), 250);
  assert.equal(itemSpeed('he', false), 245);
  assert.equal(itemSpeed('molotov', false), 245);
  assert.equal(isSlowSniper('awp', 1, true), true);
  assert.equal(isSlowSniper('scar20', 2, true), true);
  assert.equal(isSlowSniper('g3sg1', 1, true), true);
  assert.equal(isSlowSniper('awp', 0, false), false, 'sem zoom não');
  assert.equal(isSlowSniper('ssg08', 1, true), false, 'Scout com zoom anda a 230');
  assert.equal(isSlowSniper('aug', 1, true), false, 'um nível só');
  assert.equal(itemName('ak47'), 'AK-47');
  assert.equal(itemName('c4'), 'Bomba');
  assert.equal(itemName(null), '—');
});
```

- [ ] **Passo 2: Rodar e ver falhar**

Run: `node --test tests/hands.test.js`
Expected: FAIL — `Cannot find module .../src/player/hands.js`.

- [ ] **Passo 3: Comando do tick: `cmd.select` (0 nada, 1–5 slots, 6 próximo, 7 anterior, 8 último)**

```js file=src/player/moveCmd.js
// Comando de movimento de um tick (o "usercmd" do Source): o que o jogador quer fazer, sem estado. Sai da entrada
// local, da IA dos bots (Fase 7) ou da rede (Fase 9) e alimenta o playerMove e a troca de item na mão.

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

/** Troca de item pedida no tick (o `weaponselect` do Source): slots 1–5, próximo/anterior (roda) e último (Q). */
export const SELECT = Object.freeze({
  NONE: 0, SLOT1: 1, SLOT2: 2, SLOT3: 3, SLOT4: 4, SLOT5: 5, NEXT: 6, PREV: 7, LAST: 8,
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

/** Ação da entrada → troca de item; vale a primeira desta ordem apertada no tick. */
const SELECT_ACTIONS = Object.freeze([
  ['slot1', SELECT.SLOT1],
  ['slot2', SELECT.SLOT2],
  ['slot3', SELECT.SLOT3],
  ['slot4', SELECT.SLOT4],
  ['slot5', SELECT.SLOT5],
  ['nextWeapon', SELECT.NEXT],
  ['prevWeapon', SELECT.PREV],
  ['lastWeapon', SELECT.LAST],
]);

export function createMoveCmd() {
  return { tick: 0, forward: 0, side: 0, buttons: 0, yaw: 0, pitch: 0, select: SELECT.NONE };
}

/**
 * Preenche o comando com a entrada amostrada neste tick (InputManager.sampleTick já rodou): movimento analógico
 * (−1..1, já normalizado), bits dos botões, a troca de item e os ângulos da visão. Entrada sem `pressed` (bots e
 * testes que só dirigem o movimento) não troca de item.
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
  let select = SELECT.NONE;
  if (input.pressed) {
    for (let i = 0; i < SELECT_ACTIONS.length; i++) {
      if (input.pressed(SELECT_ACTIONS[i][0])) {
        select = SELECT_ACTIONS[i][1];
        break;
      }
    }
  }
  cmd.select = select;
  cmd.yaw = yaw;
  cmd.pitch = pitch;
  return cmd;
}
```

- [ ] **Passo 4: Item na mão**

```js file=src/player/hands.js
// Item na mão (seções 0.6 e 0.7): qual item do Loadout está sacado, a troca pelo comando do tick (slots 1–5, roda e Q,
// o `weaponselect` do Source), a troca automática ao receber arma melhor (cl_autowepswitch) e a luneta (níveis de zoom,
// FOV, sensibilidade e o modo "alt" que muda velocidade e precisão). Funções puras sobre um estado simples, ao lado do
// Loadout (que continua sendo só as regras de inventário): o jogador local, a predição (Fase 9) e os bots (Fase 7) usam
// as mesmas, gerando `cmd.select` e o botão de mirar.

import { MOVE } from '../data/movement.js';
import { UTILITIES } from '../data/economy.js';
import { BOMB, SCOPE, WEAPONS } from '../data/weapons.js';
import { SELECT } from './moveCmd.js';

const DEG = Math.PI / 180;

/** Posto de cada slot: o melhor item e a troca automática seguem esta ordem (primária melhor). */
const SLOT_RANK = Object.freeze({ primary: 0, secondary: 1, melee: 2, grenade: 3, c4: 4 });
const SLOT_OF_SELECT = Object.freeze([null, 'primary', 'secondary', 'melee', 'grenade', 'c4']);

/** Estado da mão: slot ativo, granada na mão, anteriores (Q), item resolvido no tick e luneta. */
export function createHands() {
  return { slot: 'melee', grenade: null, lastSlot: null, lastGrenade: null, item: null, zoom: 0, zoomCooldown: 0 };
}

/** Item do slot (id da arma, tipo de granada ou 'c4'), ou null se o slot está vazio. */
export function itemAt(loadout, slot, grenade) {
  switch (slot) {
    case 'primary':
      return loadout.primary;
    case 'secondary':
      return loadout.secondary;
    case 'melee':
      return loadout.melee;
    case 'grenade':
      return grenade && loadout.grenades.includes(grenade) ? grenade : null;
    case 'c4':
      return loadout.bomb ? BOMB.id : null;
    default:
      return null;
  }
}

/** Itens que o jogador tem, na ordem do CS: primária → pistola → faca → granadas (ordem de entrada) → bomba. */
export function carriedItems(loadout) {
  const list = [];
  if (loadout.primary) list.push({ slot: 'primary', grenade: null });
  if (loadout.secondary) list.push({ slot: 'secondary', grenade: null });
  if (loadout.melee) list.push({ slot: 'melee', grenade: null });
  for (const g of loadout.grenadeTypes()) list.push({ slot: 'grenade', grenade: g });
  if (loadout.bomb) list.push({ slot: 'c4', grenade: null });
  return list;
}

/** Vai para o slot/granada pedido, guardando o anterior para o Q. false se já estava nele. */
function switchTo(h, slot, grenade) {
  const g = slot === 'grenade' ? grenade : null;
  if (slot === h.slot && g === h.grenade) return false;
  h.lastSlot = h.slot;
  h.lastGrenade = h.grenade;
  h.slot = slot;
  h.grenade = g;
  return true;
}

/**
 * Aplica o pedido de troca do tick (`cmd.select`). 1, 2, 3 e 5 vão para o slot se houver item nele; 4 pega o primeiro
 * tipo de granada ou, já com granada, o próximo; a roda anda na ordem dos itens dando a volta; Q volta ao anterior se
 * ele ainda existir. Devolve true se o slot mudou.
 */
export function applySelect(h, loadout, select) {
  if (select >= SELECT.SLOT1 && select <= SELECT.SLOT5) {
    const slot = SLOT_OF_SELECT[select];
    if (slot === 'grenade') {
      const types = loadout.grenadeTypes();
      if (!types.length) return false;
      const next = h.slot === 'grenade' ? types[(types.indexOf(h.grenade) + 1) % types.length] : types[0];
      return switchTo(h, 'grenade', next);
    }
    return itemAt(loadout, slot, null) ? switchTo(h, slot, null) : false;
  }
  if (select === SELECT.NEXT || select === SELECT.PREV) {
    const list = carriedItems(loadout);
    if (list.length < 2) return false;
    const i = list.findIndex((e) => e.slot === h.slot && e.grenade === h.grenade);
    const j = (i + (select === SELECT.NEXT ? 1 : -1) + list.length) % list.length;
    return switchTo(h, list[j].slot, list[j].grenade);
  }
  if (select === SELECT.LAST) {
    if (!h.lastSlot || !itemAt(loadout, h.lastSlot, h.lastGrenade)) return false;
    return switchTo(h, h.lastSlot, h.lastGrenade);
  }
  return false;
}

/** Melhor item que o jogador tem (primária > pistola > faca > granadas > bomba), direto na mão. */
function selectBest(h, loadout) {
  if (loadout.primary) h.slot = 'primary';
  else if (loadout.secondary) h.slot = 'secondary';
  else if (loadout.melee) h.slot = 'melee';
  else if (loadout.grenades.length) h.slot = 'grenade';
  else if (loadout.bomb) h.slot = 'c4';
  h.grenade = h.slot === 'grenade' ? loadout.grenades[0] : null;
}

/**
 * Mantém a mão coerente com o inventário a cada tick: na primeira vez (ao nascer) saca o melhor item; depois, se o item
 * da mão sumiu (o `give` trocou a arma do slot, a granada acabou), vai para o melhor item. Devolve true se o item na
 * mão mudou — "sacou": a luneta volta ao nível 0 e o chamador zera a precisão.
 */
export function syncHands(h, loadout) {
  let id = h.item === null ? null : itemAt(loadout, h.slot, h.grenade);
  if (!id) {
    selectBest(h, loadout);
    id = itemAt(loadout, h.slot, h.grenade);
  }
  if (id === h.item) return false;
  h.item = id;
  h.zoom = 0;
  h.zoomCooldown = 0;
  return true;
}

/**
 * Troca automática ao receber uma arma (o cl_autowepswitch 1 do CS): pede o slot dela se ele for de posto melhor que o
 * da mão. Granadas e bomba nunca trocam sozinhas.
 */
export function autoSwitchSelect(h, slot) {
  if (slot !== 'primary' && slot !== 'secondary' && slot !== 'melee') return SELECT.NONE;
  if (SLOT_RANK[slot] >= SLOT_RANK[h.slot]) return SELECT.NONE;
  return slot === 'primary' ? SELECT.SLOT1 : slot === 'secondary' ? SELECT.SLOT2 : SELECT.SLOT3;
}

/** Níveis de zoom da arma (0 = sem luneta). */
export function zoomLevels(itemId) {
  return WEAPONS[itemId]?.scope?.length ?? 0;
}

/** FOV do nível de zoom, na referência de 90° do CS (null sem zoom). */
export function zoomFov(itemId, level) {
  return level > 0 ? WEAPONS[itemId].scope[level - 1] : null;
}

/** Multiplicador da tangente do FOV do jogador no nível (1 sem zoom): a ampliação do CS sobre o FOV escolhido. */
export function zoomFactor(itemId, level) {
  if (level <= 0) return 1;
  return Math.tan((zoomFov(itemId, level) / 2) * DEG) / Math.tan((SCOPE.referenceFov / 2) * DEG);
}

/** Duração (s) da transição do FOV para o nível (índice 0 = sair do zoom). */
export function zoomTime(itemId, level) {
  return WEAPONS[itemId]?.zoomTime?.[level] ?? 0;
}

/** Sensibilidade com zoom: controls.zoomSensitivity × fov/90 (o zoom_sensitivity_ratio_mouse do CS:GO); 1 sem zoom. */
export function zoomLookScale(itemId, level, zoomSensitivity) {
  return level > 0 ? (zoomSensitivity * zoomFov(itemId, level)) / SCOPE.referenceFov : 1;
}

/**
 * Luneta (o SecondaryAttack do CS): com o botão de mirar segurado e o tempo zerado, sobe um nível (depois do último
 * volta ao 0) e espera SCOPE.cycleCooldown — segurar cicla. `enabled` false (noclip) só desconta o tempo. Devolve true
 * se o nível mudou.
 */
export function updateZoom(h, aimDown, dt, enabled = true) {
  h.zoomCooldown = Math.max(0, h.zoomCooldown - dt);
  const levels = zoomLevels(h.item);
  if (!enabled || !aimDown || levels === 0 || h.zoomCooldown > 0) return false;
  h.zoom = (h.zoom + 1) % (levels + 1);
  h.zoomCooldown = SCOPE.cycleCooldown;
  return true;
}

/**
 * Modo "alt" da arma (o Secondary_Mode do CS), que troca velocidade e precisão: com zoom nas armas com luneta; com o
 * silenciador colocado na USP-S e na M4A1-S (o padrão; tirar é da Fase 4); em rajada na Glock e na FAMAS (liga na Fase
 * 4). Silenciador e rajada são entradas explícitas.
 */
export function weaponAlt(itemId, zoom, silencerOn = true, burst = false) {
  const w = WEAPONS[itemId];
  if (!w) return false;
  if (w.scope) return zoom > 0;
  if (w.silencer) return silencerOn;
  if (w.burst) return burst;
  return false;
}

/** Velocidade máxima com o item na mão (u/s), no modo atual; teto de CS_PLAYER_SPEED_RUN (260). */
export function itemSpeed(itemId, alt) {
  const w = WEAPONS[itemId];
  let v;
  if (w) v = alt && w.scopedSpeed ? w.scopedSpeed : w.moveSpeed;
  else if (itemId === BOMB.id) v = BOMB.moveSpeed;
  else v = UTILITIES[itemId]?.moveSpeed ?? MOVE.runSpeed;
  return Math.min(v, MOVE.runSpeed);
}

/**
 * "Sniper lenta" com luneta (regra da aceleração do CS:GO): arma de 2+ níveis de zoom, com zoom, e velocidade no modo
 * atual × 0,52 abaixo de 110 — AWP, SCAR-20 e G3SG1 com zoom.
 */
export function isSlowSniper(itemId, zoom, alt) {
  return zoom > 0 && zoomLevels(itemId) > 1 && itemSpeed(itemId, alt) * MOVE.walkModifier < MOVE.slowSniperWalkSpeed;
}

/** Nome de exibição do item. */
export function itemName(itemId) {
  if (WEAPONS[itemId]) return WEAPONS[itemId].name;
  if (itemId === BOMB.id) return BOMB.name;
  return UTILITIES[itemId]?.name ?? '—';
}
```

- [ ] **Passo 5: Rodar e ver passar**

Run: `node --test tests/hands.test.js`
Expected: PASS (8 testes).

- [ ] **Passo 6: Suíte inteira**

Run: `npm test`
Expected: todos os testes passando (nenhum teste da 3.1 quebra).

- [ ] **Passo 7: Commit (só quando o usuário pedir)**

```bash
git add src/player/moveCmd.js src/player/hands.js tests/hands.test.js
git commit -m "feat(fase-3.2): item na mão, troca por slot/roda/Q, troca automática e luneta" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Tarefa 3: Inaccuracy do CS:GO (inaccuracy.js)

**Files:**
- Create: `src/player/inaccuracy.js`
- Test: `tests/inaccuracy.test.js`

- [ ] **Passo 1: Escrever o teste (vetores da pesquisa, §9 de `docs/research/csgo-inaccuracy-notes.md`)**

```js file=tests/inaccuracy.test.js
// Testes da inaccuracy do CS:GO (Fase 3.2): os vetores da pesquisa (docs/research/csgo-inaccuracy-notes.md, §9),
// recuperação pelo índice de recuo, disparo, sacar zera, limiar de precisão, o ápice da Deagle e o teto de 1.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SV_DEFAULTS } from '../src/data/movement.js';
import { WEAPONS, fireInterval } from '../src/data/weapons.js';
import {
  accuracyData, basePenalty, createAccuracyState, fireAccuracy, inaccuracyOf, landAccuracy, modeValue,
  precisionThreshold, recoveryTime, resetAccuracy, updateAccuracy,
} from '../src/player/inaccuracy.js';

const DT = 1 / 64;
const J = SV_DEFAULTS.jump_impulse; // 301,99 u/s, a velocidade vertical da saída do pulo
const AK = accuracyData('ak47');
const AWP = accuracyData('awp');
const DEAGLE = accuracyData('deagle');
const AK_CYCLE = fireInterval(WEAPONS.ak47);

/** Jogador para a precisão (padrão: AK parado no chão). */
const player = (o = {}) => ({
  onGround: true, ducking: false, walking: false, speed2d: 0, vy: 0, weaponSpeed: 215, ...o,
});
const parts = () => ({ base: 0, move: 0, air: 0, total: 0 });
const near = (actual, expected, msg = '') => {
  assert.ok(Math.abs(actual - expected) < 1e-6, `${msg} ${actual} ≠ ${expected}`);
};

/** Penalidade assentada no estado `p` (10 s nele) e a inaccuracy total ali. */
function settled(data, alt, p, cycle = AK_CYCLE) {
  const acc = createAccuracyState();
  for (let i = 0; i < 640; i++) updateAccuracy(acc, data, alt, p, cycle, DT);
  const out = parts();
  inaccuracyOf(acc, data, alt, p, J, out);
  return { acc, out, total: out.total };
}

test('vetores da pesquisa: AK parado, agachado, correndo, andando e no limiar de precisão', () => {
  near(settled(AK, false, player()).total, 0.00641, 'parado');
  near(settled(AK, false, player({ ducking: true })).total, 0.00481, 'agachado');
  const run = settled(AK, false, player({ speed2d: 215 }));
  near(run.total, 0.18147, 'correndo a 215');
  near(run.out.base, 0.00641, 'parte base');
  near(run.out.move, 0.17506, 'parte movimento');
  assert.equal(run.out.air, 0);
  near(settled(AK, false, player({ speed2d: 111.8, walking: true })).total, 0.058067, 'andando a 111,8');
  near(settled(AK, false, player({ speed2d: 111.8 })).total, 0.135435, '111,8 sem andar');
  near(precisionThreshold(215), 73.1, 'limiar da AK');
  near(settled(AK, false, player({ speed2d: 73.1 })).total, 0.00641, 'no limiar o movimento não pesa');
});

test('vetores da pesquisa: no ar (saída, ápice, caindo a 600) e o pouso plano até assentar', () => {
  const air = (vy) => settled(AK, false, player({ onGround: false, vy }));
  near(air(J).total, 0.24811, 'saída do pulo');
  near(air(0).total, 0.14717, 'ápice');
  near(air(-600).total, 0.303228, 'caindo a 600 u/s');
  // Pouso: com a penalidade do ar assentada, + pouso × queda; depois ela cai para a base em pé.
  const { acc } = air(0);
  landAccuracy(acc, AK, false, J);
  const out = parts();
  near(inaccuracyOf(acc, AK, false, player(), J, out), 0.220252, 'logo após o pouso');
  const after = { 1: 0.200335, 8: 0.104228, 16: 0.051155, 24: 0.026878, 32: 0.015773, 64: 0.00682 };
  for (let tick = 1; tick <= 64; tick++) {
    updateAccuracy(acc, AK, false, player(), AK_CYCLE, DT);
    if (after[tick] === undefined) continue;
    near(inaccuracyOf(acc, AK, false, player(), J, out), after[tick], `${tick} ticks depois`);
  }
});

test('vetores da pesquisa: AWP com e sem luneta; Deagle no ápice (termo do ápice de 2020) e na saída', () => {
  near(settled(AWP, true, player({ weaponSpeed: 100 })).total, 0.002, 'AWP com luneta parada');
  near(settled(AWP, false, player({ weaponSpeed: 200 })).total, 0.0808, 'AWP sem luneta parada');
  near(settled(AWP, true, player({ weaponSpeed: 100, speed2d: 100 })).total, 0.17848, 'AWP com luneta a 100 u/s');
  const deagle = (vy) => settled(DEAGLE, false, player({ onGround: false, vy, weaponSpeed: 230 })).total;
  near(deagle(0), 0.3763, 'Deagle no ápice');
  near(deagle(J), 0.59357, 'Deagle na saída do pulo');
  // Nas outras armas o ápice é 0: a fórmula volta à do código de 2017 (termo do ar zero no topo).
  assert.equal(settled(AK, false, player({ onGround: false, vy: 0 })).out.air, 0);
});

test('disparo: +disparo e índice de recuo +1; o índice decai 10× a cada 0,5 s depois de 1,1 × o intervalo', () => {
  const acc = settled(AK, false, player()).acc;
  fireAccuracy(acc, AK, false);
  const out = parts();
  near(inaccuracyOf(acc, AK, false, player(), J, out), 0.01421, 'logo após 1 tiro');
  assert.equal(acc.recoilIndex, 1);
  assert.equal(acc.sinceShot, 0);
  const after = { 1: [0.013484, 1], 12: [0.008823, 0.698], 24: [0.007157, 0.294], 32: [0.006752, 0.165] };
  for (let tick = 1; tick <= 32; tick++) {
    updateAccuracy(acc, AK, false, player(), AK_CYCLE, DT);
    const want = after[tick];
    if (!want) continue;
    near(inaccuracyOf(acc, AK, false, player(), J, out), want[0], `${tick} ticks depois`);
    assert.ok(Math.abs(acc.recoilIndex - want[1]) < 5e-4, `índice ${acc.recoilIndex} ≠ ${want[1]}`);
  }
  // Antes de 1,1 × o intervalo (0,11 s = 7 ticks) o índice não cai.
  const fresh = createAccuracyState();
  fireAccuracy(fresh, AK, false);
  for (let tick = 0; tick < 7; tick++) updateAccuracy(fresh, AK, false, player(), AK_CYCLE, DT);
  assert.equal(fresh.recoilIndex, 1);
});

test('recuperação: do tempo inicial ao final entre as balas de transição; no ar, 4 × o agachado', () => {
  const acc = createAccuracyState();
  const at = (index, p = player()) => {
    acc.recoilIndex = index;
    return recoveryTime(AK, acc, p);
  };
  near(at(0), 0.368);
  near(at(2.9), 0.368, 'conta a bala inteira (2 = início da transição)');
  near(at(3), 0.368 + (0.506 - 0.368) / 3);
  near(at(5), 0.506);
  near(at(9), 0.506);
  near(at(0, player({ ducking: true })), 0.305257);
  near(at(9, player({ ducking: true })), 0.419728);
  near(at(9, player({ onGround: false })), 0.305257 * 4, 'no ar');
  near(recoveryTime(AWP, acc, player()), 0.34539, 'sem valores finais: sempre o inicial');
  // A penalidade sobe na hora até a base e, acima dela, cai 10× a cada tempo de recuperação.
  const rise = createAccuracyState();
  updateAccuracy(rise, AK, false, player({ onGround: false }), AK_CYCLE, DT);
  near(rise.penalty, basePenalty(AK, false, player({ onGround: false })), 'subida instantânea');
  const fall = createAccuracyState();
  fall.penalty = 0.1 + 0.00641;
  for (let i = 0; i < Math.round(0.368 * 64); i++) updateAccuracy(fall, AK, false, player(), AK_CYCLE, DT);
  assert.ok(Math.abs(fall.penalty - 0.00641 - 0.01) < 5e-4, `um tempo de recuperação: ${fall.penalty}`);
});

test('sacar zera; faca, granadas e bomba sem inaccuracy; modo alt; total no máximo 1', () => {
  const acc = settled(AK, false, player({ onGround: false })).acc;
  fireAccuracy(acc, AK, false);
  resetAccuracy(acc);
  assert.deepEqual(acc, createAccuracyState());
  for (const id of ['knife', 'flash', 'he', 'c4', null]) {
    const r = settled(accuracyData(id), false, player({ speed2d: 250, onGround: false, vy: J, weaponSpeed: 250 }));
    assert.equal(r.total, 0, `${id}`);
  }
  assert.equal(modeValue(AWP, true, 'stand'), 2, 'luneta usa o valor alt');
  assert.equal(modeValue(AWP, true, 'jumpInitial'), 172.86, 'sem valor alt: o normal');
  assert.equal(modeValue(AWP, false, 'stand'), 80.8);
  near(basePenalty(AWP, true, player({ ducking: true })), 0.0015);
  const capped = createAccuracyState();
  capped.penalty = 0.95;
  const out = parts();
  assert.equal(inaccuracyOf(capped, AK, false, player({ speed2d: 215 }), J, out), 1);
  near(out.base + out.move, 0.95 + 0.17506, 'as partes continuam inteiras');
});
```

- [ ] **Passo 2: Rodar e ver falhar**

Run: `node --test tests/inaccuracy.test.js`
Expected: FAIL — `Cannot find module .../src/player/inaccuracy.js`.

- [ ] **Passo 3: Implementar**

```js file=src/player/inaccuracy.js
// Inaccuracy de arma do CS:GO (CWeaponCSBase: GetInaccuracy, UpdateAccuracyPenalty, GetRecoveryTime, OnLand e o
// disparo) em funções puras sobre dados simples. O PlayerPawn atualiza a penalidade a cada tick depois do movimento; a
// Fase 4 usa o total no tiro e chama o disparo. Unidades do CS: os dados de src/data/inaccuracy.js × 0,001 ≈ radianos.
// `alt` é o modo da arma (luneta, silenciador colocado ou rajada — src/player/hands.js, weaponAlt).

import { ACCURACY, INACCURACY, INACCURACY_UNIT, NO_INACCURACY } from '../data/inaccuracy.js';

const LN10 = Math.log(10);

/** RemapVal do Source, sem limitar (com a = b devolve c ou d, como o RemapValClamped). */
function remap(v, a, b, c, d) {
  if (a === b) return v >= b ? d : c;
  return c + ((d - c) * (v - a)) / (b - a);
}

/** RemapValClamped do Source. */
function remapClamped(v, a, b, c, d) {
  if (a === b) return v >= b ? d : c;
  const t = Math.min(1, Math.max(0, (v - a) / (b - a)));
  return c + (d - c) * t;
}

/** Dados de inaccuracy do item na mão (faca, granadas e bomba: nenhuma). */
export function accuracyData(itemId) {
  return INACCURACY[itemId] ?? NO_INACCURACY;
}

/** Valor do campo no modo atual: o bloco `alt` quando a arma está nele e tem o campo. */
export function modeValue(data, alt, key) {
  return alt && data.alt && data.alt[key] !== undefined ? data.alt[key] : data[key];
}

/** Estado de precisão da arma na mão (a Fase 4 guarda um por arma). */
export function createAccuracyState() {
  return { penalty: 0, recoilIndex: 0, sinceShot: ACCURACY.sinceShotMax };
}

/** Sacou a arma (Deploy do CS:GO): penalidade e índice de recuo zerados. */
export function resetAccuracy(acc) {
  acc.penalty = 0;
  acc.recoilIndex = 0;
  acc.sinceShot = ACCURACY.sinceShotMax;
  return acc;
}

/** Limiar de precisão: abaixo de 34% da velocidade da arma (no modo atual) o movimento não pesa. */
export function precisionThreshold(weaponSpeed) {
  return weaponSpeed * ACCURACY.moveFloor;
}

/**
 * Base do tick (a penalidade nunca fica abaixo dela), em radianos: no ar, em pé + pulo; com FL_DUCKING, agachado;
 * senão, em pé. `p`: {onGround, ducking}.
 */
export function basePenalty(data, alt, p) {
  let v;
  if (!p.onGround) v = modeValue(data, alt, 'stand') + modeValue(data, alt, 'jump') * ACCURACY.airScale;
  else if (p.ducking) v = modeValue(data, alt, 'crouch');
  else v = modeValue(data, alt, 'stand');
  return v * INACCURACY_UNIT;
}

/**
 * Tempo (s) em que o excesso de penalidade cai 10× (GetRecoveryTime): no ar, o agachado × 4; no chão, o de em pé ou
 * agachado, indo do inicial ao final entre as balas de transição pelo índice de recuo.
 */
export function recoveryTime(data, acc, p) {
  if (!p.onGround) return data.recoveryCrouch * ACCURACY.airRecoveryFactor;
  const initial = p.ducking ? data.recoveryCrouch : data.recoveryStand;
  const final = p.ducking ? data.recoveryCrouchFinal : data.recoveryStandFinal;
  if (final === undefined) return initial;
  return remapClamped(Math.trunc(acc.recoilIndex), data.transitionStart, data.transitionEnd, initial, final);
}

/**
 * Um tick de precisão (UpdateAccuracyPenalty), com o jogador depois do movimento: a penalidade sobe na hora até a
 * base e, acima dela, cai 10× a cada tempo de recuperação; o índice de recuo decai 10× a cada 1/2 s depois de 1,1 × o
 * intervalo entre tiros (`cycleTime`) sem atirar. `p`: {onGround, ducking}.
 */
export function updateAccuracy(acc, data, alt, p, cycleTime, dt) {
  const base = basePenalty(data, alt, p);
  if (base > acc.penalty) acc.penalty = base;
  else acc.penalty = base + (acc.penalty - base) * Math.exp((-dt * LN10) / recoveryTime(data, acc, p));
  acc.sinceShot = Math.min(ACCURACY.sinceShotMax, acc.sinceShot + dt);
  if (acc.sinceShot > cycleTime * ACCURACY.recoilDecayThreshold) {
    acc.recoilIndex *= Math.exp(-dt * LN10 * ACCURACY.recoilDecayCoefficient);
  }
  return acc;
}

/** Pouso (OnLand): + pouso × velocidade de queda (crua, em u/s). */
export function landAccuracy(acc, data, alt, fallSpeed) {
  acc.penalty += modeValue(data, alt, 'land') * INACCURACY_UNIT * fallSpeed;
  return acc;
}

/** Disparo (para a Fase 4 chamar depois do tiro): + disparo; índice de recuo +1. */
export function fireAccuracy(acc, data, alt) {
  acc.penalty += modeValue(data, alt, 'fire') * INACCURACY_UNIT;
  acc.recoilIndex += 1;
  acc.sinceShot = 0;
  return acc;
}

/**
 * Inaccuracy do tiro (GetInaccuracy): penalidade + movimento + ar, no máximo 1 (radianos). Movimento: a velocidade no
 * plano entre 34% e 95% da velocidade da arma (no modo atual) vira 0…1, elevada a 0,25 (andando com Shift, linear), ×
 * movimento. Ar: a raiz de |vy| entre 0,25·√impulso e √impulso vai do ápice ao ar inicial, limitada a [ápice,
 * 2 × ar inicial] (o ápice só existe na Deagle; nas outras é 0). Escreve as partes em `out` ({base, move, air, total}).
 * `p`: {onGround, walking, speed2d, vy, weaponSpeed}.
 */
export function inaccuracyOf(acc, data, alt, p, jumpImpulse, out) {
  let move = remapClamped(p.speed2d, p.weaponSpeed * ACCURACY.moveFloor, p.weaponSpeed * ACCURACY.moveCeil, 0, 1);
  if (move > 0) {
    if (!p.walking) move = Math.pow(move, ACCURACY.moveExponent);
    move *= modeValue(data, alt, 'move') * INACCURACY_UNIT;
  }
  let air = 0;
  if (!p.onGround) {
    const initial = data.jumpInitial * INACCURACY_UNIT * ACCURACY.airScale;
    const apex = (data.jumpApex ?? 0) * INACCURACY_UNIT * ACCURACY.airScale;
    const root = Math.sqrt(jumpImpulse);
    air = remap(Math.sqrt(Math.abs(p.vy)), ACCURACY.airFloorFraction * root, root, apex, initial);
    air = Math.min(Math.max(air, apex), ACCURACY.airMaxFactor * initial);
  }
  out.base = acc.penalty;
  out.move = move;
  out.air = air;
  out.total = Math.min(ACCURACY.max, acc.penalty + move + air);
  return out.total;
}
```

- [ ] **Passo 4: Rodar e ver passar**

Run: `node --test tests/inaccuracy.test.js`
Expected: PASS (6 testes).

- [ ] **Passo 5: Suíte inteira**

Run: `npm test`
Expected: todos os testes passando (nenhum teste da 3.1 quebra).

- [ ] **Passo 6: Commit (só quando o usuário pedir)**

```bash
git add src/player/inaccuracy.js tests/inaccuracy.test.js
git commit -m "feat(fase-3.2): inaccuracy do CWeaponCSBase" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Tarefa 4: Movimento do CS:GO — agachar, passos, teto, andar, stamina, bhop e pouso

**Files:**
- Create: `src/player/duck.js`, `src/player/footsteps.js`
- Modify: `src/player/movement.js` (arquivo inteiro), `src/player/playerPawn.js` (ponte de uma linha até a Tarefa 6)
- Test: `tests/tacticalMovement.test.js`, `tests/footsteps.test.js`, `tests/playerTestUtils.js` (arquivo inteiro), `tests/characterController.test.js`

- [ ] **Passo 1: Utilitários de teste: o ambiente de movimento leva o item na mão (`env.item`)**

```js file=tests/playerTestUtils.js
// Utilitários dos testes de movimento: jogador simulado sobre um mundo de colisão, sem navegador.
import * as THREE from 'three';
import { CharacterController } from '../src/physics/characterController.js';
import { createMoveState, playerMove } from '../src/player/movement.js';
import { createMoveCmd } from '../src/player/moveCmd.js';
import { createSvVars } from '../src/player/movementVars.js';
import { isSlowSniper, itemSpeed, weaponAlt } from '../src/player/hands.js';

export const DT = 1 / 64;

/** Item na mão do ambiente de movimento (velocidade no modo atual e sniper lenta), como o PlayerPawn monta. */
export function itemEnv(item = 'knife', zoom = 0) {
  const alt = weaponAlt(item, zoom);
  return { speed: itemSpeed(item, alt), slowSniper: isSlowSniper(item, zoom, alt) };
}

/** Jogador com o item na mão (faca), pés em [x, y, z], já classificado no chão (ou no ar). */
export function makePlayer(world, [x, y, z], { yaw = 0, sv = createSvVars(), item = 'knife', zoom = 0 } = {}) {
  const controller = new CharacterController(world, sv);
  const state = createMoveState({ position: new THREE.Vector3(x, y, z) });
  const env = { controller, sv, dt: DT, item: itemEnv(item, zoom), events: [] };
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

- [ ] **Passo 2: Testes do controlador que mudam com o porte**

A aceleração passa a ser a do CS:GO (assinatura nova) e, no túnel, o jogador preso agachado acelera como agachado (~1,5 s até 85 u/s partindo parado):

Em `tests/characterController.test.js`, trocar:

```
import { BTN } from '../src/player/moveCmd.js';
```

por:

```
import { BTN, createMoveCmd } from '../src/player/moveCmd.js';
```

Em `tests/characterController.test.js`, trocar:

```
import { DT, forward, idle, makePlayer, run, speed2d } from './playerTestUtils.js';
```

por:

```
import { DT, forward, idle, itemEnv, makePlayer, run, speed2d } from './playerTestUtils.js';
```

Em `tests/characterController.test.js`, trocar:

```
  accelerate(s, new THREE.Vector3(1, 0, 0), 250, 5.5, DT);
```

por:

```
  // Correndo com a faca, o Accelerate do CS:GO dá o mesmo ganho do Source: sv_accelerate × dt × 250.
  const env = { sv: SV_DEFAULTS, dt: DT, item: itemEnv('knife') };
  accelerate(s, new THREE.Vector3(1, 0, 0), 250, createMoveCmd(), env);
```

Em `tests/characterController.test.js`, trocar:

```
  assert.ok(p.state.ducked && p.state.height === HULL.duckHeight, 'levantou dentro do túnel');
  run(p, 128, forward);
```

por:

```
  assert.ok(p.state.ducked && p.state.height === HULL.duckHeight, 'levantou dentro do túnel');
  // Preso agachado (FL_DUCKING): a aceleração é a de agachado do CS:GO, ~1,5 s para chegar a 85 u/s partindo parado.
  run(p, 192, forward);
```

- [ ] **Passo 3: Escrever os testes do movimento tático e dos passos**

```js file=tests/tacticalMovement.test.js
// Testes do movimento tático do CS:GO (Fase 3.2) a 64 tick: curvas de aceleração e parada por item, Shift correndo,
// teto duro, counter-strafe, agachar (tempos, spam, recuperação, sv_timebetweenducks, no ar, FL_DUCKING, sem espaço,
// duckbug e jumpbug), stamina, bunny hop, os pulos da 3.1 e as sv_* novas.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DUCK, HULL, MOVE } from '../src/data/movement.js';
import { BTN } from '../src/player/moveCmd.js';
import { createSvVars } from '../src/player/movementVars.js';
import { eyeHeight } from '../src/player/movement.js';
import { floor, worldOf } from './worldTestUtils.js';
import { DT, forward, idle, makePlayer, run, speed2d } from './playerTestUtils.js';

const ground = () => worldOf((b) => floor(b));
const near = (a, b, eps, msg = '') => assert.ok(Math.abs(a - b) <= eps, `${msg} ${a} ≠ ${b}`);

/** Ticks correndo para a frente (com `buttons`) até a velocidade no plano chegar a `target`. */
function ticksTo(target, { item = 'knife', zoom = 0, buttons = 0, sv, limit = 400 } = {}) {
  const p = makePlayer(ground(), [0, 0, 0], { item, zoom, sv });
  let top = 0;
  for (let i = 1; i <= limit; i++) {
    run(p, 1, (c) => {
      forward(c);
      c.buttons = buttons;
    });
    top = Math.max(top, speed2d(p.state));
    if (speed2d(p.state) >= target - 1e-9) return { ticks: i, p, top };
  }
  return { ticks: Infinity, p, top };
}

/** Ticks até a velocidade no plano ficar abaixo de `below` (ou zerar), com o comando `drive`. */
function ticksUntil(p, drive, below) {
  for (let i = 1; i <= 200; i++) {
    run(p, 1, drive);
    if (below === 0 ? speed2d(p.state) === 0 : speed2d(p.state) < below) return i;
  }
  return Infinity;
}

const withButtons = (buttons, base = idle) => (c) => {
  base(c);
  c.buttons = buttons;
};

test('aceleração do CS:GO pelo item na mão, correndo, andando e agachado', () => {
  assert.equal(ticksTo(250).ticks, 35, 'faca 0 → 250');
  assert.equal(ticksTo(215, { item: 'ak47' }).ticks, 36, 'AK 0 → 215');
  const walk = ticksTo(130, { buttons: BTN.WALK });
  assert.equal(walk.ticks, 40, 'faca andando 0 → 130');
  run(walk.p, 64, withButtons(BTN.WALK, forward));
  assert.ok(Math.abs(speed2d(walk.p.state) - 130) < 1e-9, 'andando não passa de 130');
  assert.equal(ticksTo(215 * MOVE.walkModifier, { item: 'ak47', buttons: BTN.WALK }).ticks, 26, 'AK andando 0 → 111,8');
  assert.equal(ticksTo(250 * DUCK.speedMultiplier, { buttons: BTN.DUCK }).ticks, 100, 'faca agachada 0 → 85');
  assert.equal(ticksTo(100, { item: 'awp', zoom: 1 }).ticks, 53, 'AWP com zoom 0 → 100 (sniper lenta)');
  assert.equal(ticksTo(52, { item: 'awp', zoom: 1, buttons: BTN.WALK }).ticks, 22, 'AWP com zoom andando 0 → 52');
});

test('parada: faca a 250 soltando tudo zera em 26 ticks; Shift correndo trava em 130 no 7º tick', () => {
  const stop = ticksTo(250).p;
  assert.equal(ticksUntil(stop, idle, 0), 26);
  const shift = ticksTo(250).p;
  const speeds = [];
  for (let i = 0; i < 7; i++) {
    run(shift, 1, withButtons(BTN.WALK, forward));
    speeds.push(speed2d(shift.state));
  }
  assert.ok(speeds.slice(0, 6).every((v) => v > 130 && v > 155 - 20), `freia pelo atrito: ${speeds}`);
  assert.equal(speeds[6], 130, 'abaixo de 155 o andar engata e o teto duro trava');
  assert.equal(shift.state.walking, true);
});

test('teto duro: agachando a velocidade segue o teto até 85; o primeiro tick depois do pouso já freia', () => {
  const p = ticksTo(250).p;
  const s = p.state;
  run(p, 1, withButtons(BTN.DUCK, forward));
  near(s.duckFactor, 1 + (DUCK.speedMultiplier - 1) * s.duckAmount, 1e-12);
  assert.ok(s.maxSpeed < 250 && speed2d(s) <= s.maxSpeed, 'o teto cai já no primeiro tick');
  for (let tick = 2; tick <= 13; tick++) {
    run(p, 1, withButtons(BTN.DUCK, forward));
    near(speed2d(s), s.maxSpeed, 1e-9, `tick ${tick}: cortada no teto do tick`);
  }
  assert.equal(s.ducked, true);
  near(speed2d(s), 250 * DUCK.speedMultiplier, 1e-9, 'agachado de todo: 85');
  // Correndo a 250 e pulando: o pouso soma stamina e o tick seguinte no chão fica no teto × (1 − s/100)².
  const q = ticksTo(250).p;
  run(q, 1, withButtons(BTN.JUMP, forward));
  let landed = false;
  for (let i = 0; i < 80 && !landed; i++) landed = run(q, 1, forward).some((e) => e.type === 'land');
  assert.ok(landed);
  assert.ok(q.state.stamina > 10, `stamina ${q.state.stamina}`);
  run(q, 1, forward);
  assert.ok(q.state.staminaFactor < 0.8);
  near(speed2d(q.state), 250 * q.state.staminaFactor, 1e-9, 'pouso freia no primeiro tick no chão');
});

test('counter-strafe da AK (limiar 73,1): contra 5 ticks × soltar 13', () => {
  const strafing = () => {
    const p = makePlayer(ground(), [0, 0, 0], { item: 'ak47' });
    run(p, 100, (c) => {
      idle(c);
      c.side = 1;
    });
    near(speed2d(p.state), 215, 1e-9);
    return p;
  };
  const threshold = 215 * 0.34;
  assert.equal(ticksUntil(strafing(), (c) => {
    idle(c);
    c.side = -1;
  }, threshold), 5);
  assert.equal(ticksUntil(strafing(), idle, threshold), 13);
});

test('agachar: descer em 13 ticks e levantar em 11; cada mudança da tecla custa 2 da velocidade do agachar', () => {
  const p = makePlayer(ground(), [0, 0, 0]);
  run(p, 4, idle);
  const s = p.state;
  const events = run(p, 1, withButtons(BTN.DUCK));
  near(s.duckSpeed, DUCK.speed - DUCK.spamPenalty + DUCK.recovery * DT, 1e-12, 'aperto: 8 − 2 + recuperação do tick');
  assert.equal(s.ducking, true);
  assert.equal(events.length, 0);
  let ticks = 1;
  while (!s.ducked && ticks < 60) {
    run(p, 1, withButtons(BTN.DUCK));
    ticks++;
  }
  assert.equal(ticks, 13, 'descer');
  assert.equal(s.duckFlag, true);
  assert.equal(s.height, HULL.duckHeight);
  assert.equal(s.sinceDuck, 0);
  run(p, 30, withButtons(BTN.DUCK)); // a velocidade do agachar enche de novo
  assert.equal(s.duckSpeed, DUCK.speed);
  const unduck = run(p, 1, idle);
  assert.ok(unduck.some((e) => e.type === 'unduck'), 'a cápsula em pé entra no primeiro tick');
  assert.equal(s.height, HULL.standHeight);
  ticks = 1;
  while (s.duckAmount > 0 && ticks < 60) {
    run(p, 1, idle);
    ticks++;
  }
  assert.equal(ticks, 11, 'levantar');
  assert.equal(s.ducking, false);
  near(eyeHeight(s), HULL.standEye, 1e-12);
});

test('spam do agachar: abaixo de 1,5 a tecla é ignorada; recupera 3/s e +6/s longe da âncora', () => {
  const p = makePlayer(ground(), [0, 0, 0]);
  const s = p.state;
  for (let i = 0; i < 8; i++) run(p, 1, withButtons(i % 2 === 0 ? BTN.DUCK : 0)); // 4 apertos e 4 soltas seguidos
  assert.ok(s.duckSpeed < DUCK.minEnabled, `velocidade do agachar ${s.duckSpeed}`);
  run(p, 1, withButtons(BTN.DUCK));
  assert.equal(s.duckHeld, false, 'travado: a tecla é ignorada');
  // Parado e em pé: +3/s.
  const before = s.duckSpeed;
  run(p, 64, withButtons(BTN.DUCK));
  near(s.duckSpeed, before + DUCK.recovery, 1e-9, 'um segundo parado');
  assert.equal(s.duckHeld, true, 'destravou acima de 1,5');
  // Longe (> 64 u) de onde a velocidade estava cheia, todo em pé: +3 +6 por segundo.
  const q = makePlayer(ground(), [0, 0, 0]);
  q.state.duckSpeed = 2;
  q.state.duckAnchorX = 200;
  run(q, 32, idle);
  near(q.state.duckSpeed, 2 + (DUCK.recovery + DUCK.recoveryAway) * 0.5, 1e-9, 'meio segundo longe da âncora');
});

test('sv_timebetweenducks: agachar de novo antes de 0,4 s do último agachar completo é ignorado', () => {
  const p = makePlayer(ground(), [0, 0, 0]);
  const s = p.state;
  run(p, 13, withButtons(BTN.DUCK));
  assert.equal(s.ducked, true, 'agachou de todo no 13º tick');
  let since = 0; // ticks desde o agachar completo
  while ((s.duckAmount > 0 || s.ducking) && since < 64) {
    run(p, 1, idle);
    since++;
  }
  assert.equal(s.duckFlag, false, 'levantou de todo');
  let ignored = 0;
  while (!s.duckHeld && since < 64) {
    run(p, 1, withButtons(BTN.DUCK));
    since++;
    if (!s.duckHeld) ignored++;
  }
  assert.ok(ignored > 0, 'o aperto logo depois de levantar é ignorado');
  assert.equal(s.ducking, true, 'quando vale, começa a descer no mesmo tick');
  // Vale no primeiro tick com 0,4 s desde o agachar completo: 26 ticks (25/64 = 0,39 s ainda não).
  assert.equal(since, 26);
  assert.equal(s.sinceDuck, 26 / 64);
  assert.equal(createSvVars().timebetweenducks, 0.4);
  // Com FL_DUCKING ainda ligado (levantando há pouco), agachar de novo vale na hora.
  const q = makePlayer(ground(), [0, 0, 0]);
  run(q, 14, withButtons(BTN.DUCK));
  run(q, 2, idle);
  assert.equal(q.state.duckFlag, true);
  run(q, 1, withButtons(BTN.DUCK));
  assert.equal(q.state.duckHeld, true);
});

test('no ar: agachar e levantar são na hora, com os pés ±9 u e a câmera suavizando o olho', () => {
  const jumpers = () => {
    const pair = [makePlayer(ground(), [0, 0, 0]), makePlayer(ground(), [0, 0, 0])];
    for (const p of pair) {
      run(p, 2, idle);
      run(p, 1, withButtons(BTN.JUMP));
      run(p, 6, idle);
    }
    return pair;
  };
  const [ducker, stander] = jumpers();
  run(ducker, 1, withButtons(BTN.DUCK));
  run(stander, 1, idle);
  const d = ducker.state;
  assert.equal(d.ducked, true);
  assert.equal(d.duckAmount, 1, 'na hora');
  near(d.origin.y - stander.state.origin.y, HULL.airDuckLift, 1e-9, 'pés 9 u acima');
  near(d.viewOffset, -(HULL.airDuckLift + HULL.duckEye - HULL.standEye), 1e-9, 'a câmera absorve o salto do olho');
  run(ducker, 1, idle);
  run(stander, 1, idle);
  assert.equal(d.ducked, false);
  assert.equal(d.duckAmount, 0);
  near(d.origin.y, stander.state.origin.y, 1e-9, 'pés 9 u abaixo de novo');
});

test('FL_DUCKING liga ao completar e desliga levantando ao passar de 25%', () => {
  const p = makePlayer(ground(), [0, 0, 0]);
  run(p, 14, withButtons(BTN.DUCK));
  run(p, 30, withButtons(BTN.DUCK));
  const s = p.state;
  const seen = [];
  for (let i = 0; i < 12; i++) {
    run(p, 1, idle);
    seen.push([s.duckAmount, s.duckFlag]);
  }
  for (const [amount, flag] of seen) assert.equal(flag, amount > DUCK.flagClear, `quanto agachou ${amount}`);
  assert.ok(seen.some(([a]) => a > DUCK.flagClear) && seen.some(([a]) => a <= DUCK.flagClear));
});

test('no ar sem espaço para descer 9 u: continua agachado até pousar e então levanta', () => {
  const p = makePlayer(ground(), [0, 5, 0]);
  const s = p.state;
  Object.assign(s, { ducked: true, duckFlag: true, duckAmount: 1, height: HULL.duckHeight, oldButtons: BTN.DUCK });
  assert.equal(s.onGround, false);
  run(p, 1, idle);
  assert.equal(s.ducked, true, 'a cápsula em pé cruzaria o chão');
  assert.equal(s.duckAmount, 1);
  let ticks = 0;
  while (s.ducked && ticks < 64) {
    run(p, 1, idle);
    ticks++;
  }
  assert.ok(s.onGround && !s.ducked, 'levantou no chão');
});

test('duckbug: levantar no ar rente ao chão pousa sem evento nem stamina; jumpbug pula no mesmo tick', () => {
  const falling = () => {
    const p = makePlayer(ground(), [0, 10, 0]);
    const s = p.state;
    Object.assign(s, { ducked: true, duckFlag: true, duckAmount: 1, height: HULL.duckHeight, oldButtons: BTN.DUCK });
    s.velocity.set(0, -300, 0);
    return p;
  };
  const duckbug = falling();
  const events = run(duckbug, 1, idle);
  assert.ok(duckbug.state.onGround, 'pousou pelo levantar');
  assert.ok(events.some((e) => e.type === 'unduck'));
  assert.ok(!events.some((e) => e.type === 'land'), 'sem evento de pouso');
  assert.equal(duckbug.state.stamina, 0, 'sem stamina de pouso');
  const jumpbug = falling();
  const jb = run(jumpbug, 1, withButtons(BTN.JUMP));
  assert.ok(jb.some((e) => e.type === 'jump'), 'pulou no tick em que o levantar encostou no chão');
  assert.ok(!jb.some((e) => e.type === 'land'));
  assert.equal(jumpbug.state.onGround, false);
  near(jumpbug.state.velocity.y, 301.993377 - 800 * DT, 1e-6, 'impulso cheio (sem stamina) menos a gravidade do tick');
});

test('stamina: 24,16 no pulo, 14,28 no pouso plano, teto × 0,735 no primeiro tick e recuperação a 60/s', () => {
  const p = makePlayer(ground(), [0, 0, 0]);
  const s = p.state;
  run(p, 4, idle);
  run(p, 1, withButtons(BTN.JUMP));
  near(s.stamina, 0.08 * 301.993377, 1e-6, 'pulo');
  let land = null;
  let air = 0;
  while (!land && air < 80) {
    land = run(p, 1, idle).find((e) => e.type === 'land') ?? null;
    air++;
  }
  assert.equal(air, 47, 'ticks no ar de um pulo plano');
  near(land.speed, 285.506623, 1e-5, 'queda no pouso');
  near(s.stamina, 0.05 * land.speed, 1e-9, 'a stamina do pulo já tinha zerado no ar');
  run(p, 1, forward);
  near(s.staminaFactor, (1 - (0.05 * land.speed) / 100) ** 2, 1e-12, 'fator com o valor de antes da recuperação');
  near(s.maxSpeed, 183.718, 1e-3);
  let ticks = 1;
  while (s.stamina > 0 && ticks < 64) {
    run(p, 1, idle);
    ticks++;
  }
  assert.equal(ticks, 16, 'zera em 16 ticks a 60/s');
});

test('pulos seguidos saem mais baixos (stamina); pulo em pé 57 u e pulo + Ctrl 66 u mantidos', () => {
  const apex = (buttons) => {
    const p = makePlayer(ground(), [0, 0, 0]);
    run(p, 2, idle);
    const y0 = p.state.origin.y;
    run(p, 1, withButtons(BTN.JUMP | buttons));
    let top = y0;
    for (let i = 0; i < 80; i++) {
      run(p, 1, withButtons(buttons));
      top = Math.max(top, p.state.origin.y);
    }
    return top - y0;
  };
  near(apex(0), 57, 0.01, 'em pé');
  near(apex(BTN.DUCK), 66, 0.01, 'pulo + Ctrl');
  // Segundo pulo no tick seguinte ao pouso: a stamina do pouso corta o impulso.
  const p = makePlayer(ground(), [0, 0, 0]);
  run(p, 2, idle);
  run(p, 1, withButtons(BTN.JUMP));
  let landed = false;
  while (!landed) landed = run(p, 1, idle).some((e) => e.type === 'land');
  const y0 = p.state.origin.y;
  run(p, 1, withButtons(BTN.JUMP));
  let top = y0;
  for (let i = 0; i < 60; i++) {
    run(p, 1, idle);
    top = Math.max(top, p.state.origin.y);
  }
  assert.ok(top - y0 < 57 * 0.8, `o segundo pulo subiu ${top - y0} u`);
});

test('bunny hop: teto de 286 u/s ao sair do chão; pular no tick do pouso mantém o embalo, perder o tick perde', () => {
  const p = makePlayer(ground(), [0, 0, 0]);
  p.state.velocity.set(400, 0, 0);
  run(p, 1, withButtons(BTN.JUMP));
  // O corte é na velocidade 3D, que no pulo já tem a meia gravidade do tick (−6,25 u/s), como no CS:GO.
  const halfGravity = 800 * 0.5 * DT;
  const capped = (MOVE.bunnyJumpFactor * MOVE.runSpeed * 400) / Math.hypot(400, halfGravity);
  near(speed2d(p.state), capped, 1e-9, '286 em 3D');
  const hop = (perfect) => {
    const q = ticksTo(250).p;
    run(q, 1, withButtons(BTN.JUMP, forward));
    let landed = false;
    while (!landed) landed = run(q, 1, forward).some((e) => e.type === 'land');
    const before = speed2d(q.state);
    run(q, 1, perfect ? withButtons(BTN.JUMP, forward) : forward);
    return { before, after: speed2d(q.state), air: !q.state.onGround };
  };
  const perf = hop(true);
  assert.ok(perf.air && perf.after >= perf.before - 1e-9, `perf: ${perf.before} → ${perf.after}`);
  const late = hop(false);
  assert.ok(late.after < 200, `sem o perf o atrito e a stamina levam para ${late.after}`);
  // Segurar o pulo não repete (sv_autobunnyhopping 0): precisa soltar entre um pulo e outro.
  const held = makePlayer(ground(), [0, 0, 0]);
  const jumps = run(held, 200, withButtons(BTN.JUMP)).filter((e) => e.type === 'jump').length;
  assert.equal(jumps, 1);
});

test('sv_enablebunnyhopping, sv_autobunnyhopping e sv_accelerate_use_weapon_speed', () => {
  const free = makePlayer(ground(), [0, 0, 0], { sv: Object.assign(createSvVars(), { enablebunnyhopping: 1 }) });
  free.state.velocity.set(400, 0, 0);
  run(free, 1, withButtons(BTN.JUMP));
  near(speed2d(free.state), 400, 1e-9, 'sem teto');
  const auto = makePlayer(ground(), [0, 0, 0], { sv: Object.assign(createSvVars(), { autobunnyhopping: 1 }) });
  const jumps = run(auto, 200, withButtons(BTN.JUMP)).filter((e) => e.type === 'jump').length;
  assert.ok(jumps >= 4, `segurando o pulo: ${jumps} pulos`);
  // Sem a velocidade da arma na aceleração (o Source puro), a AK acelera como a faca até o teto dela.
  const source = createSvVars();
  source.accelerate_use_weapon_speed = 0;
  const ak = ticksTo(215, { item: 'ak47', sv: source }).ticks;
  assert.ok(ak < 36, `AK sem a razão da arma: ${ak} ticks`);
  assert.equal(ticksTo(250, { sv: source }).ticks, 35, 'a faca não muda (razão 1)');
  const awp = ticksTo(100, { item: 'awp', zoom: 1, sv: source }).ticks;
  assert.ok(awp < 53, `AWP com zoom sem a regra da sniper lenta: ${awp} ticks`);
});
```

```js file=tests/footsteps.test.js
// Testes dos passos, do pulo e do pouso audíveis (Fase 3.2): cadências do CS:GO a 64 tick, primeiro passo, velocidade
// mínima, audível × silencioso por item e estado, volumes por superfície e agachado, pé alternado e o pouso pesado.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { STEPS } from '../src/data/movement.js';
import { SURFACE_INDEX } from '../src/data/surfaces.js';
import { firstStepDelay, updateSteps } from '../src/player/footsteps.js';
import { BTN } from '../src/player/moveCmd.js';
import { createMoveState } from '../src/player/movement.js';
import { floor, worldOf } from './worldTestUtils.js';
import { DT, forward, idle, makePlayer, run } from './playerTestUtils.js';

const ground = () => worldOf((b) => floor(b));

/** Passos de um jogador correndo para a frente por `ticks` ticks: [{tick, ...evento}]. */
function stepsOf(item, { ticks = 300, zoom = 0, buttons = 0 } = {}) {
  const p = makePlayer(ground(), [0, 0, 0], { item, zoom });
  const steps = [];
  for (let i = 0; i < ticks; i++) {
    for (const e of run(p, 1, (c) => {
      forward(c);
      c.buttons |= buttons;
    })) if (e.type === 'step') steps.push({ tick: i, ...e });
  }
  return steps;
}

const gaps = (steps) => steps.slice(1).map((s, i) => s.tick - steps[i].tick);

/** Estado no chão andando em +x a `speed`, com o relógio zerado (o próximo tick decide o passo). */
function moving(speed, { duckFlag = false, walking = false, surface = 'tapete' } = {}) {
  const s = createMoveState();
  s.velocity.set(speed, 0, 0);
  s.onGround = true;
  s.duckFlag = duckFlag;
  s.walking = walking;
  s.groundSurface = SURFACE_INDEX[surface];
  s.stepTimer = 0;
  return s;
}

function stepOnce(s) {
  const env = { dt: DT, events: [] };
  updateSteps(s, env);
  return env.events[0] ?? null;
}

test('cadência: faca correndo a cada 19 ticks, AK a cada 25; o primeiro passo 19 ticks depois de sair do lugar', () => {
  const knife = stepsOf('knife');
  assert.equal(knife[0].tick, 19, 'relógio de 291 ms ao sair do lugar');
  assert.ok(gaps(knife).slice(2).every((g) => g === 19), `faca: ${gaps(knife)}`);
  const ak = stepsOf('ak47');
  assert.ok(gaps(ak).slice(2).every((g) => g === 25), `AK (215 < 220, classe lenta): ${gaps(ak)}`);
  assert.equal(firstStepDelay(false), 300 * 0.97);
  assert.equal(firstStepDelay(true), 300 * 0.97 + 100);
});

test('audível × silencioso: correndo faz barulho; andar, agachar e AWP com zoom não; AUG com zoom sim', () => {
  const steady = (steps) => steps.slice(3);
  assert.ok(steady(stepsOf('knife')).every((s) => s.audible), 'faca correndo');
  assert.ok(steady(stepsOf('ak47')).every((s) => s.audible), 'AK correndo');
  const walking = stepsOf('knife', { buttons: BTN.WALK });
  assert.ok(walking.length > 5 && walking.every((s) => !s.audible), 'andando (130 u/s) não');
  assert.ok(gaps(walking).slice(2).every((g) => g === 25), 'andando: classe lenta');
  const ducked = stepsOf('knife', { buttons: BTN.DUCK });
  assert.ok(ducked.length > 3 && ducked.every((s) => !s.audible), 'agachado não');
  assert.ok(gaps(ducked).slice(1).every((g) => g === 26), 'agachado: +100 ms');
  const awp = stepsOf('awp', { zoom: 1 });
  assert.ok(awp.length > 5 && awp.every((s) => !s.audible), 'AWP com zoom (100 u/s) não');
  assert.ok(steady(stepsOf('aug', { zoom: 1 })).every((s) => s.audible), 'AUG com zoom (150 u/s) sim');
});

test('velocidade mínima: abaixo de 90 (60 agachado) não há passo; parado, o relógio volta ao primeiro passo', () => {
  assert.equal(stepOnce(moving(85)), null);
  assert.ok(stepOnce(moving(95)));
  assert.equal(stepOnce(moving(55, { duckFlag: true })), null);
  const slow = moving(65, { duckFlag: true });
  assert.ok(stepOnce(slow));
  assert.equal(slow.stepTimer, 400 * 0.97 + 100, 'agachado abaixo de 80: classe lenta + 100 ms');
  const stopped = moving(3);
  stopped.stepTimer = 12;
  assert.equal(stepOnce(stopped), null);
  assert.equal(stopped.stepTimer, 291);
  const air = moving(250);
  air.onGround = false;
  assert.equal(stepOnce(air), null, 'no ar não');
  const vertical = moving(0);
  vertical.velocity.set(0, 200, 0);
  assert.equal(stepOnce(vertical), null, 'só velocidade vertical não');
  assert.ok(Math.abs(STEPS.audibleSpeed - 260 * 0.52) < 1e-9, 'audível a partir da velocidade de andar do CS');
});

test('volume por superfície e classe, × 0,65 agachado; pé alternado; posição, superfície e velocidade', () => {
  const volume = (speed, opts) => stepOnce(moving(speed, opts)).volume;
  assert.equal(volume(250, { surface: 'metal' }), 0.7);
  assert.equal(volume(150, { surface: 'metal' }), 0.4);
  assert.equal(volume(250, { surface: 'massinha' }), 0.4);
  assert.equal(volume(150, { surface: 'tecido' }), 0.1);
  assert.ok(Math.abs(volume(85, { surface: 'metal', duckFlag: true }) - 0.7 * 0.65) < 1e-12, 'agachado a 85: rápida');
  assert.ok(Math.abs(volume(70, { surface: 'metal', duckFlag: true }) - 0.4 * 0.65) < 1e-12, 'agachado a 70: lenta');
  const s = moving(250, { surface: 'papelao' });
  s.origin.set(10, 20, 30);
  const feet = [];
  for (let i = 0; i < 3; i++) {
    s.stepTimer = 0;
    const e = stepOnce(s);
    feet.push(e.foot);
    assert.deepEqual([e.x, e.y, e.z, e.surface, e.speed], [10, 20, 30, SURFACE_INDEX.papelao, 250]);
    assert.equal(e.audible, true);
  }
  assert.deepEqual(feet, [0, 1, 0]);
  assert.equal(stepOnce(Object.assign(moving(250), { walking: true })).audible, false, 'engatado no andar: silencioso');
});

test('pulo audível acima de 126 u/s; pouso audível acima de 270 e pesado a partir de 350, que atrasa o passo', () => {
  const still = makePlayer(ground(), [0, 0, 0]);
  run(still, 4, idle);
  const quiet = run(still, 1, (c) => {
    idle(c);
    c.buttons = BTN.JUMP;
  }).find((e) => e.type === 'jump');
  assert.equal(quiet.audible, false, 'pulo parado');
  assert.equal(quiet.surface, SURFACE_INDEX.tapete);
  const runner = makePlayer(ground(), [0, 0, 0]);
  run(runner, 60, forward);
  const loud = run(runner, 1, (c) => {
    forward(c);
    c.buttons = BTN.JUMP;
  }).find((e) => e.type === 'jump');
  assert.ok(loud.audible && loud.speed > 240, `pulo correndo a ${loud.speed}`);
  // Pulo plano: pouso a ~285,5 u/s, audível e leve.
  const flat = run(still, 80, idle).find((e) => e.type === 'land');
  assert.ok(flat.audible && !flat.heavy, `pouso plano a ${flat.speed}`);
  // Queda de 200 u: ~565 u/s, pesado; o próximo passo espera 400 ms.
  const faller = makePlayer(ground(), [0, 200, 0]);
  let land = null;
  for (let i = 0; i < 64 && !land; i++) land = run(faller, 1, idle).find((e) => e.type === 'land') ?? null;
  assert.ok(land && land.heavy && land.audible, `queda a ${land?.speed}`);
  assert.equal(faller.state.stepTimer, STEPS.roughLandDelay);
  // Queda de 30 u (~219 u/s): silenciosa.
  const hop = makePlayer(ground(), [0, 30, 0]);
  const soft = run(hop, 40, idle).find((e) => e.type === 'land');
  assert.ok(soft && !soft.audible && !soft.heavy, `queda baixa a ${soft?.speed}`);
});
```

- [ ] **Passo 4: Rodar e ver falhar**

Run: `node --test tests/tacticalMovement.test.js tests/footsteps.test.js tests/characterController.test.js`
Expected: FAIL — `Cannot find module .../src/player/footsteps.js` e, no controlador, o movimento da 3.1 lendo `env.maxSpeed` (indefinido no ambiente novo).

- [ ] **Passo 5: Agachar do CS:GO**

```js file=src/player/duck.js
// Agachar do CS:GO (CCSGameMovement: DuckingEnabled/CheckParameters, Duck, CanUnduck, FinishDuck, FinishUnDuck e
// HandleDuckingSpeedCrop): penalidade de spam, transição com velocidade própria, troca de cápsula (no ar na hora, com
// os pés ±9), o FL_DUCKING (`duckFlag`: vale como agachado para a precisão, os passos e o andar) e o corte do teto de
// velocidade. Opera sobre o estado de movimento (src/player/movement.js) com as consultas do CharacterController.

import { CONTROLLER, DUCK, HULL } from '../data/movement.js';
import { BTN } from './moveCmd.js';

/** SimpleSpline do Source (smoothstep): o olho no meio da transição. */
export function duckEase(t) {
  return t * t * (3 - 2 * t);
}

/** Altura do olho sobre os pés (sem a suavização da câmera). */
export function eyeHeight(s) {
  return HULL.standEye + (HULL.duckEye - HULL.standEye) * duckEase(s.duckAmount);
}

/**
 * Portão do agachar (CheckParameters + DuckingEnabled). Cada mudança da tecla crua (apertar e soltar) tira
 * DUCK.spamPenalty da velocidade do agachar; abaixo de DUCK.minEnabled a tecla é ignorada, e sem FL_DUCKING também
 * antes de sv_timebetweenducks do último agachar completo. Grava em `s.duckHeld` se o agachar vale neste tick.
 */
export function duckGate(s, cmd, sv) {
  const raw = (cmd.buttons & BTN.DUCK) !== 0;
  if (raw !== ((s.oldButtons & BTN.DUCK) !== 0)) s.duckSpeed = Math.max(0, s.duckSpeed - DUCK.spamPenalty);
  s.duckHeld = raw && s.duckSpeed >= DUCK.minEnabled && (s.duckFlag || s.sinceDuck >= sv.timebetweenducks);
  return s.duckHeld;
}

/**
 * CanUnduck: com a cápsula agachada no ar, a em pé precisa caber 9 u abaixo sem a base atravessar chão (o CS varre a
 * caixa em pé até lá); no chão, ou com a cápsula já em pé, basta caber onde está.
 */
function canUnduck(s, ctl) {
  const o = s.origin;
  if (s.onGround || !s.ducked) return ctl.fits(o.x, o.y, o.z, HULL.standHeight);
  const low = o.y - HULL.airDuckLift;
  return ctl.fits(o.x, low, o.z, HULL.standHeight) && !ctl.support(o.x, o.z, low, o.y + CONTROLLER.supportTolerance);
}

/** FinishDuck: cápsula agachada; no ar os pés sobem 9 (a cabeça desce 9). Recategoriza o chão. */
function finishDuck(s, env) {
  if (!s.onGround) s.origin.y += HULL.airDuckLift;
  s.ducking = false;
  s.ducked = true;
  s.height = HULL.duckHeight;
  s.duckFlag = true;
  s.duckAmount = 1;
  s.sinceDuck = 0;
  env.controller.categorizePosition(s);
  env.events.push({ type: 'duck' });
}

/** FinishUnDuck: transição encerrada em pé. Recategoriza: levantar no ar pode pousar ali mesmo (o duckbug do CS:GO). */
function finishUnduck(s, env) {
  s.ducking = false;
  s.duckFlag = false;
  s.duckAmount = 0;
  env.controller.categorizePosition(s);
}

/**
 * Duck do CS:GO (depois dos passos, antes da gravidade): recupera a velocidade do agachar, anda a transição, troca a
 * cápsula e corta o teto do tick (`s.maxSpeed`) pelo quanto agachou. Trocas de cápsula no ar mudam pés e olho de uma
 * vez: a diferença vai para `s.viewOffset` e a câmera suaviza.
 */
export function duck(s, env) {
  const { controller: ctl, dt, events } = env;
  const o = s.origin;
  const y0 = o.y;
  const eye0 = eyeHeight(s);
  let snapped = false;
  // Recuperação do spam: +3/s sempre; +6/s todo em pé ou todo agachado e longe de onde a velocidade estava cheia.
  s.duckSpeed = Math.min(DUCK.speed, s.duckSpeed + DUCK.recovery * dt);
  if (s.duckSpeed >= DUCK.speed) {
    s.duckAnchorX = o.x;
    s.duckAnchorZ = o.z;
  } else if ((s.duckAmount <= 0 || s.duckAmount >= 1)
    && (o.x - s.duckAnchorX) ** 2 + (o.z - s.duckAnchorZ) ** 2 > DUCK.recoveryAwayDistance ** 2) {
    s.duckSpeed = Math.min(DUCK.speed, s.duckSpeed + DUCK.recoveryAway * dt);
  }
  const held = s.duckHeld;
  if ((!held && s.duckAmount > 0) || (held && s.duckAmount < 1)) s.ducking = true;
  if (held && s.ducking) {
    // Descer: 0,8 × velocidade do agachar; a cápsula só troca no fim (no ar, na hora).
    s.duckAmount = Math.min(1, s.duckAmount + s.duckSpeed * DUCK.downFactor * dt);
    if (s.duckAmount >= 1 || !s.onGround) {
      snapped = !s.onGround;
      finishDuck(s, env);
    }
  }
  if (!held && s.ducking) {
    if (canUnduck(s, ctl)) {
      // Levantar: a cápsula em pé entra na hora (no ar, com os pés 9 u abaixo) e o olho sobe a máx(1,5; velocidade).
      const inAir = !s.onGround;
      s.duckAmount = Math.max(0, s.duckAmount - Math.max(DUCK.minUnduck, s.duckSpeed) * dt);
      if (s.ducked) {
        if (inAir) o.y -= HULL.airDuckLift;
        s.ducked = false;
        s.height = HULL.standHeight;
        events.push({ type: 'unduck' });
      }
      if (s.duckAmount <= 0 || inAir) {
        snapped = snapped || inAir;
        finishUnduck(s, env);
      }
      if (s.duckAmount <= DUCK.flagClear) s.duckFlag = false;
    } else {
      // Sob algo que não deixa levantar: fica agachado de todo e tenta de novo nos próximos ticks.
      snapped = s.duckAmount < 1;
      s.duckAmount = 1;
      s.ducked = true;
      s.height = HULL.duckHeight;
      s.ducking = false;
      s.duckFlag = true;
    }
  }
  if (snapped) s.viewOffset -= o.y - y0 + eyeHeight(s) - eye0;
  // HandleDuckingSpeedCrop: com qualquer estado de agachar, o teto do tick cai pelo quanto agachou (também no ar).
  s.duckFactor = held || s.ducking || s.duckFlag ? 1 + (DUCK.speedMultiplier - 1) * s.duckAmount : 1;
  s.maxSpeed *= s.duckFactor;
}
```

- [ ] **Passo 6: Passos**

```js file=src/player/footsteps.js
// Passos do CS:GO (CCSPlayer::UpdateStepSound sobre o CBasePlayer::UpdateStepSound): um relógio em ms, com a
// velocidade do começo do tick. Quando zera, com o jogador no chão, andando no plano e acima da velocidade mínima, dá
// um passo e recomeça na cadência da classe (lenta abaixo de 220 u/s). Audível só com ≥ 135,2 u/s e sem o andar (Shift)
// engatado; os passos silenciosos também saem, marcados, para as pegadas da 3.5. Diferença do CS: lá o relógio para
// enquanto o passo é silencioso; aqui continua contando. Eventos no `env.events` do playerMove.

import { STEPS } from '../data/movement.js';
import { SURFACES } from '../data/surfaces.js';

/** Relógio ao parar (e ao nascer): o primeiro passo sai ~0,29 s depois de começar a andar. */
export function firstStepDelay(duckFlag) {
  return STEPS.fastInterval * STEPS.frequency + (duckFlag ? STEPS.duckExtra : 0);
}

/** Um tick do relógio dos passos. Estado em `s.stepTimer` (ms) e `s.stepFoot` (0 esquerdo, 1 direito). */
export function updateSteps(s, env) {
  const v = s.velocity;
  const speedSq = v.lengthSq();
  if (speedSq < STEPS.stoppedSpeedSq) {
    s.stepTimer = firstStepDelay(s.duckFlag);
    return;
  }
  s.stepTimer = Math.max(0, s.stepTimer - env.dt * 1000);
  if (s.stepTimer > 0 || !s.onGround || Math.hypot(v.x, v.z) <= 1e-4) return;
  const speed = Math.sqrt(speedSq);
  const ducked = s.duckFlag;
  if (speed < (ducked ? STEPS.duckWalkSpeed : STEPS.walkSpeed)) return;
  const fast = speed >= (ducked ? STEPS.duckRunSpeed : STEPS.runSpeed);
  s.stepTimer = (fast ? STEPS.fastInterval : STEPS.slowInterval) * STEPS.frequency + (ducked ? STEPS.duckExtra : 0);
  const surface = SURFACES[s.groundSurface];
  const volume = (fast ? surface.stepFast : surface.stepSlow) * (ducked ? STEPS.duckVolume : 1);
  const foot = s.stepFoot;
  s.stepFoot = 1 - foot;
  env.events.push({
    type: 'step', foot, x: s.origin.x, y: s.origin.y, z: s.origin.z, surface: s.groundSurface, volume, speed,
    audible: speed >= STEPS.audibleSpeed && !s.walking,
  });
}
```

- [ ] **Passo 7: Movimento (PlayerMove/FullWalkMove do CS:GO)**

```js file=src/player/movement.js
// Movimento do jogador — porte do PlayerMove/FullWalkMove do CS:GO (cs_gamemovement.cpp sobre o gamemovement.cpp do
// Source) para Y para cima, com os números do CS:GO (src/data/movement.js). Uma função sobre dados simples,
// playerMove(estado, comando, ambiente): o mesmo código move o jogador local, a predição do cliente (Fase 9) e os bots
// (Fase 7) — só o comando muda. O agachar fica em duck.js e os passos em footsteps.js. Única diferença intencional do
// CS:GO: o pulo mantém a parábola exata da 3.1 (impulso definido, ápice de 57 u em pé; o CS:GO a 64 tick dá 54,65 u).

import * as THREE from 'three';
import { CONTROLLER, DUCK, HULL, MOVE, STEPS } from '../data/movement.js';
import { FREE_CAMERA } from '../data/sandbox.js';
import { SURFACES } from '../data/surfaces.js';
import { duck, duckGate } from './duck.js';
import { firstStepDelay, updateSteps } from './footsteps.js';
import { BTN } from './moveCmd.js';

export { eyeHeight } from './duck.js';

export const MOVETYPE = Object.freeze({ WALK: 'andar', NOCLIP: 'noclip' });

const _wishVel = new THREE.Vector3();
const _wishDir = new THREE.Vector3();
const _dest = new THREE.Vector3();
const _start = new THREE.Vector3();
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
  return dst;
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

/** Direção do desejo em _wishDir; devolve o módulo. */
function wishDirection(vel) {
  const speed = vel.length();
  if (speed > 0) _wishDir.copy(vel).divideScalar(speed);
  else _wishDir.set(0, 0, 0);
  return speed;
}

/**
 * WalkMove: acelera no plano (Accelerate do CS:GO), corta a velocidade no teto do tick — o teto duro do CS:GO, que faz
 * andar, agachar e pousar frearem na hora —, desliza (ou sobe o degrau) e gruda no chão.
 */
function walkMove(s, cmd, env) {
  const { controller: ctl, dt } = env;
  const wishSpeed = wishDirection(wishVelocity(s, cmd, _wishVel));
  s.velocity.y = 0;
  accelerate(s, _wishDir, wishSpeed, cmd, env);
  s.velocity.y = 0;
  const speed = s.velocity.length();
  if (speed > s.maxSpeed) s.velocity.multiplyScalar(s.maxSpeed / speed);
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
 * sv_staminajumpcost × impulso.
 */
function checkJumpButton(s, env) {
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
}

/**
 * CheckFalling: pouso do tick — no chão com velocidade de queda (do começo do tick) positiva. Quem pousou de dentro do
 * agachar (duckbug) já zerou a queda no passo do atrito e não conta. Soma a stamina do pouso; pouso pesado atrasa o
 * próximo passo.
 */
function checkFalling(s, env) {
  if (!s.onGround || s.fallVelocity <= 0) return;
  const fall = s.fallVelocity;
  const { sv } = env;
  s.stamina = Math.min(sv.staminamax, Math.max(0, s.stamina + sv.staminalandcost * fall));
  if (fall >= STEPS.roughLandSpeed) s.stepTimer = STEPS.roughLandDelay;
  env.events.push({
    type: 'land', speed: fall, surface: s.groundSurface,
    audible: fall > STEPS.landAudibleSpeed, heavy: fall >= STEPS.roughLandSpeed,
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
 * Um tick de movimento (PlayerMove + FullWalkMove do CS:GO). `env`: { controller, sv, dt, item: {speed, slowSniper}
 * (velocidade do item na mão no modo atual e se é sniper lenta com zoom), events: [] }. Eventos do tick em env.events:
 * step {foot, x, y, z, surface, volume, speed, audible}, jump {surface, speed, audible}, land {speed, surface, audible,
 * heavy}, duck, unduck.
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
    noclipMove(s, cmd, dt);
    s.onGround = false;
    s.fallVelocity = 0;
    s.stuck = false;
    s.oldButtons = cmd.buttons;
    return;
  }
  checkParameters(s, cmd, env);
  reduceStamina(s, sv, dt);
  s.stuck = !ctl.resolvePenetration(s);
  if (!s.onGround) s.fallVelocity = -s.velocity.y;
  updateSteps(s, env);
  duck(s, env);
  const startY = s.origin.y; // pés no começo do movimento: pouso na beirada que a base atravessar descendo
  // Meia gravidade antes e meia depois do movimento: a posição segue a parábola exata.
  s.velocity.y -= sv.gravity * 0.5 * dt;
  // O pulo vem antes do atrito: pular no tick seguinte ao pouso não perde velocidade (bunny hop).
  if (cmd.buttons & BTN.JUMP) checkJumpButton(s, env);
  if (s.onGround) {
    s.velocity.y = 0;
    s.fallVelocity = 0;
    friction(s, sv, dt);
  }
  ctl.checkVelocity(s);
  if (s.onGround) walkMove(s, cmd, env);
  else airMove(s, cmd, env);
  ctl.categorizePosition(s, startY);
  ctl.checkVelocity(s);
  s.velocity.y -= sv.gravity * 0.5 * dt;
  if (s.onGround) s.velocity.y = 0;
  checkFalling(s, env);
  s.oldButtons = cmd.buttons;
}
```

- [ ] **Passo 8: Ponte: o PlayerPawn da 3.1 passa a entregar o item (a Tarefa 6 troca o arquivo inteiro)**

Em `src/player/playerPawn.js`, trocar:

```
    // Faca na mão: a velocidade máxima é a dela.
    this.env = { controller: this.controller, sv, dt: 1 / 64, maxSpeed: WEAPONS.knife.moveSpeed, events: [] };
```

por:

```
    // Faca na mão (ponte até o PlayerPawn da Tarefa 6): o movimento lê o item em env.item.
    this.env = {
      controller: this.controller, sv, dt: 1 / 64, item: { speed: WEAPONS.knife.moveSpeed, slowSniper: false }, events: [],
    };
```

- [ ] **Passo 9: Rodar e ver passar**

Run: `node --test tests/tacticalMovement.test.js tests/footsteps.test.js tests/characterController.test.js`
Expected: PASS (15 + 5 + 16 testes).

- [ ] **Passo 10: Suíte inteira**

Run: `npm test`
Expected: todos os testes passando (nenhum teste da 3.1 quebra).

- [ ] **Passo 11: Commit (só quando o usuário pedir)**

```bash
git add src/player tests/tacticalMovement.test.js tests/footsteps.test.js tests/playerTestUtils.js tests/characterController.test.js
git commit -m "feat(fase-3.2): movimento do CS:GO (teto, andar, agachar, stamina, bhop, passos)" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Tarefa 5: Regressão — 10 min simulados com andar, spam de agachar e troca de item; determinismo do estado inteiro

**Files:**
- Modify: `tests/movementFuzz.test.js` (arquivo inteiro)

- [ ] **Passo 1: Estender o fuzz**

```js file=tests/movementFuzz.test.js
// Aceite "nenhum atravessamento de parede em 10 min" automatizado (Fases 3.1 e 3.2): 38.400 ticks de entrada
// aleatória — com andar, spam de agachar, pulos (stamina) e troca do item na mão (velocidades de 100 a 250, sniper
// lenta) —, empurrões de até 3500 u/s, paredes de 0,5 a 2 u dividindo a sala em células e um painel em movimento. A
// célula do jogador nunca muda, ele nunca fica penetrando nada nem preso. Depois, a mesma seed repetida dá o mesmo
// estado inteiro, bit a bit.
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
import { DT, itemEnv, makePlayer } from './playerTestUtils.js';

const ROOM = 600; // meia largura da sala: x e z de −600 a 600
const CEILING = 300;
const WALLS = [-200, 200]; // planos das paredes finas, em x e em z
const THICK = { x: [0.5, 1], z: [2, 1] }; // espessura de cada parede fina
const R = HULL.radius;
const TEN_MINUTES = 10 * 60 * 64;
// Itens sorteados para a mão: [id, nível de zoom].
const ITEMS = [['knife', 0], ['ak47', 0], ['awp', 1], ['awp', 2], ['aug', 1], ['negev', 0], ['c4', 0], ['flash', 0]];

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
  const stats = {
    maxSpeed: 0, jumps: 0, kicks: 0, groundTicks: 0, duckTicks: 0, walkTicks: 0, blockedDucks: 0, items: new Set(),
    maxStamina: 0,
  };
  const startCell = cellOf(p.state.origin);
  let phase = 0;
  let turn = 0;
  let jumpRate = 0;
  let duckRate = 0;
  let walkRate = 0;
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
      duckRate = rng.pick([0, 0, 0.5, 1]); // 0,5: aperta e solta a cada tick (spam)
      walkRate = rng.pick([0, 0, 1]);
      const [item, zoom] = rng.pick(ITEMS);
      p.env.item = itemEnv(item, zoom);
      stats.items.add(`${item}:${zoom}`);
    }
    p.cmd.yaw += turn * DT;
    p.cmd.buttons = (rng.bool(jumpRate) ? BTN.JUMP : 0) | (rng.bool(duckRate) ? BTN.DUCK : 0)
      | (rng.bool(walkRate) ? BTN.WALK : 0);
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
    if (s.walking) stats.walkTicks++;
    if ((p.cmd.buttons & BTN.DUCK) && !s.duckHeld) stats.blockedDucks++;
    stats.maxStamina = Math.max(stats.maxStamina, s.stamina);
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
  assert.ok(stats.walkTicks > 1000, `andando ${stats.walkTicks}`);
  assert.ok(stats.blockedDucks > 1000, `agachar travado pelo spam ${stats.blockedDucks}`);
  assert.ok(stats.maxStamina > 20, `stamina ${stats.maxStamina}`);
  assert.equal(stats.items.size, ITEMS.length, 'todos os itens passaram pela mão');
});

/** Estado inteiro como texto: números com a representação exata do double (igual ⇔ bit a bit). */
function snapshot(s) {
  return JSON.stringify({
    ...s, origin: s.origin.toArray(), velocity: s.velocity.toArray(), groundNormal: s.groundNormal.toArray(),
  });
}

test('a mesma seed dá o mesmo estado inteiro, bit a bit (2 min)', () => {
  const a = simulate('repetivel', 2 * 60 * 64, { check: false }).state;
  const b = simulate('repetivel', 2 * 60 * 64, { check: false }).state;
  assert.equal(snapshot(a), snapshot(b));
  for (const key of ['duckSpeed', 'stamina', 'stepTimer', 'sinceDuck', 'walkFactor', 'staminaFactor', 'duckFactor']) {
    assert.ok(key in a, `o estado tem ${key}`);
  }
});
```

- [ ] **Passo 2: Rodar**

Run: `node --test tests/movementFuzz.test.js`
Expected: PASS (2 testes) — passa direto: o movimento é o da Tarefa 4; o teste prova que andar, spam, pulos com stamina e itens de 100 a 250 u/s (sniper lenta incluída) não atravessam parede e que o estado inteiro é determinístico.

- [ ] **Passo 3: Commit (só quando o usuário pedir)**

```bash
git add tests/movementFuzz.test.js
git commit -m "test(fase-3.2): 10 min simulados com andar, spam de agachar e troca de item" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Tarefa 6: Telemetria, eventos e o PlayerPawn da 3.2

**Files:**
- Create: `src/player/telemetry.js`
- Modify: `src/core/events.js`, `src/player/playerPawn.js` (arquivo inteiro)
- Test: `tests/playerPawn.test.js` (arquivo inteiro)

- [ ] **Passo 1: Escrever o teste**

```js file=tests/playerPawn.test.js
// Testes do jogador local (Fases 3.1 e 3.2): comando do tick a partir da entrada, andar, interpolação da câmera,
// suavização do degrau, noclip pelo tick, teleporte; troca de item pelo comando e automática, luneta (FOV interpolado,
// sensibilidade, velocidade), precisão no tick, telemetria e os eventos no barramento.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { EV, EventBus } from '../src/core/events.js';
import { CONTROLLER, HULL } from '../src/data/movement.js';
import { createFpsCamera } from '../src/render/camera.js';
import { Loadout } from '../src/player/loadout.js';
import { BTN, SELECT, createMoveCmd, readMoveCmd } from '../src/player/moveCmd.js';
import { PlayerPawn } from '../src/player/playerPawn.js';
import { createSvVars } from '../src/player/movementVars.js';
import { TFLAG } from '../src/player/telemetry.js';
import { floor, worldOf } from './worldTestUtils.js';

const SKIN = CONTROLLER.skin;

/** Entrada com a mesma interface que o PlayerPawn usa do InputManager (move, isDown e pressed do tick). */
function testInput() {
  return {
    move: { x: 0, y: 0 },
    down: new Set(),
    hits: new Set(), // ações apertadas neste tick (o pressed do InputManager)
    isDown(action) {
      return this.down.has(action);
    },
    pressed(action) {
      return this.hits.has(action);
    },
  };
}

const pawnOn = (world, position = [0, 0, 0], opts = {}) => new PlayerPawn({
  world, sv: createSvVars(), position: new THREE.Vector3(...position), ...opts,
});

/** Inventário com as armas dadas (a primeira de cada slot fica). */
function loadoutWith(...weapons) {
  const l = new Loadout();
  for (const w of weapons) l.give(w, { ignoreTeam: true });
  return l;
}

/** Roda `n` ticks; `hit` é apertada só no primeiro. */
function ticks(pawn, input, n, { hit = null, noclip = false, start = 0 } = {}) {
  for (let i = 0; i < n; i++) {
    input.hits.clear();
    if (hit && i === 0) input.hits.add(hit);
    pawn.tick(1 / 64, input, { tick: start + i, noclip });
  }
  input.hits.clear();
}

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
  assert.equal(cmd.select, SELECT.NONE, 'entrada sem pressed (3.1) não troca de item');
  const withHits = testInput();
  withHits.hits.add('slot2').add('lastWeapon');
  assert.equal(readMoveCmd(createMoveCmd(), withHits, 1, 0, 0).select, SELECT.SLOT2, 'vale a primeira da ordem');
  withHits.hits.clear();
  withHits.hits.add('prevWeapon');
  assert.equal(readMoveCmd(createMoveCmd(), withHits, 1, 0, 0).select, SELECT.PREV);
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

test('pawn (3.2): troca pelo comando do tick muda o teto já nesse tick, zera a precisão e avisa', () => {
  const bus = new EventBus();
  const got = [];
  bus.on(EV.PLAYER_WEAPON, (e) => got.push(e));
  const pawn = pawnOn(worldOf((b) => floor(b)), [0, 0, 0], { loadout: loadoutWith('ak47', 'glock'), events: bus });
  assert.equal(pawn.hands.item, 'ak47', 'nasce com o melhor item');
  assert.equal(pawn.held.speed, 215);
  const input = testInput();
  input.move.y = 1;
  ticks(pawn, input, 80);
  assert.ok(Math.abs(Math.hypot(pawn.state.velocity.x, pawn.state.velocity.z) - 215) < 1e-9);
  assert.ok(pawn.accuracy.penalty > 0);
  ticks(pawn, input, 1, { hit: 'slot2', start: 80 });
  assert.equal(pawn.hands.item, 'glock');
  assert.equal(pawn.held.speed, 240);
  assert.equal(pawn.state.maxSpeed, 240, 'o tick da troca já usa a velocidade da pistola');
  assert.deepEqual(got, [{ item: 'glock', previous: 'ak47', slot: 'secondary' }]);
  ticks(pawn, input, 1, { hit: 'lastWeapon', start: 81 });
  assert.equal(pawn.hands.item, 'ak47', 'Q volta');
  assert.equal(got.length, 2);
});

test('pawn (3.2): arma melhor recebida vira troca automática no próximo tick', () => {
  const loadout = new Loadout();
  const pawn = pawnOn(worldOf((b) => floor(b)), [0, 0, 0], { loadout });
  const input = testInput();
  assert.equal(pawn.hands.item, 'knife');
  const res = loadout.give('deagle');
  pawn.onLoadout({ kind: 'weapon', id: 'deagle', slot: res.slot });
  ticks(pawn, input, 1);
  assert.equal(pawn.hands.item, 'deagle');
  loadout.giveUtility('he');
  pawn.onLoadout({ kind: 'utility', id: 'he', slot: 'grenade' });
  ticks(pawn, input, 1, { start: 1 });
  assert.equal(pawn.hands.item, 'deagle', 'granada não troca sozinha');
});

test('pawn (3.2): luneta — ATTACK2 sobe o nível, FOV interpolado entre ticks, sensibilidade e velocidade', () => {
  const bus = new EventBus();
  const zooms = [];
  bus.on(EV.PLAYER_ZOOM, (e) => zooms.push(e));
  const pawn = pawnOn(worldOf((b) => floor(b)), [0, 0, 0], { loadout: loadoutWith('awp'), events: bus });
  const input = testInput();
  const cam = createFpsCamera({ hfov: 90, aspect: 16 / 9 });
  input.down.add('aim');
  ticks(pawn, input, 1);
  input.down.delete('aim');
  assert.equal(pawn.hands.zoom, 1);
  assert.deepEqual(zooms, [{ level: 1, fov: 40 }]);
  assert.equal(pawn.held.speed, 100, 'velocidade com luneta');
  assert.equal(pawn.held.slowSniper, true);
  assert.ok(Math.abs(pawn.lookScale(1) - 40 / 90) < 1e-12);
  // 0,05 s de transição (3,2 ticks) em graus: o multiplicador anda entre os ticks e o quadro interpola.
  const target = Math.tan((20 * Math.PI) / 180);
  assert.ok(pawn.fov.now < 1 && pawn.fov.now > target, 'meio da transição');
  pawn.updateCamera(cam, 0.5);
  const mid = (pawn.fov.prev + pawn.fov.now) / 2;
  assert.ok(Math.abs(cam.userData.zoom - mid) < 1e-12, 'o quadro interpola o FOV');
  ticks(pawn, input, 4, { start: 1 });
  assert.ok(Math.abs(pawn.fov.now - target) < 1e-12, 'chegou ao FOV de 40°');
  pawn.updateCamera(cam, 1);
  assert.ok(Math.abs(cam.userData.zoom - target) < 1e-12);
  // No noclip o botão de mirar é o turbo do voo: o zoom não mexe.
  input.down.add('aim');
  ticks(pawn, input, 40, { start: 5, noclip: true });
  assert.equal(pawn.hands.zoom, 1);
  // Trocar de item tira o zoom e o FOV volta na hora.
  pawn.loadout.give('ak47', { ignoreTeam: true });
  input.down.delete('aim');
  ticks(pawn, input, 1, { start: 45 });
  assert.equal(pawn.hands.item, 'ak47');
  assert.equal(pawn.hands.zoom, 0);
  assert.equal(pawn.fov.now, 1);
  assert.equal(pawn.lookScale(1), 1);
  assert.deepEqual(zooms.at(-1), { level: 0, fov: null });
});

test('pawn (3.2): precisão e telemetria do tick', () => {
  const pawn = pawnOn(worldOf((b) => floor(b)), [0, 0, 0], { loadout: loadoutWith('ak47') });
  const input = testInput();
  input.move.y = 1;
  ticks(pawn, input, 80);
  assert.ok(Math.abs(pawn.inaccuracy.total - 0.18147) < 1e-6, `correndo a 215: ${pawn.inaccuracy.total}`);
  assert.ok(Math.abs(pawn.inaccuracy.move - 0.17506) < 1e-6);
  const t = pawn.telemetry;
  const j = t.slot(t.count - 1);
  assert.equal(t.count, 80);
  assert.ok(Math.abs(t.speed[j] - 215) < 1e-3);
  assert.equal(t.cap[j], 215);
  assert.equal(t.weaponSpeed[j], 215);
  assert.ok(Math.abs(t.threshold[j] - 73.1) < 1e-4);
  assert.ok(Math.abs(t.inaccuracy[j] - 0.18147) < 1e-6);
  assert.equal(t.flags[j], TFLAG.GROUND);
  assert.ok(Math.abs(t.wishZ[j] + 1) < 1e-6, 'desejo para a frente (−z)');
  assert.ok(Math.abs(t.velZ[j] + 215) < 1e-3, 'velocidade para a frente (−z)');
  input.move.y = 0;
  input.down.add('walk');
  input.down.add('crouch');
  ticks(pawn, input, 30, { start: 80 });
  assert.equal(t.flags[t.slot(t.count - 1)], TFLAG.GROUND | TFLAG.DUCK, 'agachado ignora o andar');
});

test('pawn (3.2): passos, pulo e pouso no barramento, com contagem', () => {
  const bus = new EventBus();
  const seen = { step: 0, jump: 0, land: 0, duck: 0 };
  bus.on(EV.PLAYER_STEP, (e) => {
    seen.step++;
    assert.equal(typeof e.audible, 'boolean');
  });
  bus.on(EV.PLAYER_JUMP, () => seen.jump++);
  bus.on(EV.PLAYER_LAND, (e) => {
    seen.land++;
    assert.ok(e.speed > 250 && e.audible && !e.heavy);
  });
  bus.on(EV.PLAYER_DUCK, () => seen.duck++);
  const pawn = pawnOn(worldOf((b) => floor(b)), [0, 0, 0], { events: bus });
  const input = testInput();
  input.move.y = 1;
  ticks(pawn, input, 100);
  assert.equal(seen.step, pawn.stats.steps);
  assert.ok(seen.step >= 4, `${seen.step} passos`);
  assert.equal(pawn.lastStep.audible, true);
  input.down.add('jump');
  ticks(pawn, input, 1, { start: 100 });
  input.down.delete('jump');
  ticks(pawn, input, 60, { start: 101 });
  assert.deepEqual([seen.jump, seen.land], [1, 1]);
  assert.equal(pawn.lastLanding.type, 'land');
  input.down.add('crouch');
  ticks(pawn, input, 20, { start: 161 });
  assert.equal(seen.duck, 1);
});
```

- [ ] **Passo 2: Rodar e ver falhar**

Run: `node --test tests/playerPawn.test.js`
Expected: FAIL — `Cannot find module .../src/player/telemetry.js`.

- [ ] **Passo 3: Eventos novos**

Em `src/core/events.js`, trocar:

```
  LOADOUT: 'loadout:change', // {owner, loadout}
  PLAYER_JUMP: 'player:jump', // {surface}
  PLAYER_LAND: 'player:land', // {speed, surface} — velocidade de queda no pouso (u/s)
  PLAYER_DUCK: 'player:duck', // {ducked}
```

por:

```
  LOADOUT: 'loadout:change', // {owner, loadout, received?: {kind, id, slot}}
  PLAYER_JUMP: 'player:jump', // {surface, speed, audible}
  PLAYER_LAND: 'player:land', // {speed, surface, audible, heavy} — velocidade de queda no pouso (u/s)
  PLAYER_DUCK: 'player:duck', // {ducked}
  PLAYER_STEP: 'player:step', // {foot, x, y, z, surface, volume, speed, audible} — áudio e audição dos bots
  PLAYER_WEAPON: 'player:weapon', // {item, previous, slot} — item novo na mão
  PLAYER_ZOOM: 'player:zoom', // {level, fov} — nível da luneta (fov na referência de 90°; null sem zoom)
```

- [ ] **Passo 4: Telemetria**

```js file=src/player/telemetry.js
// Telemetria do jogador para o debug (Fase 3.2): os últimos 256 ticks (4 s a 64 Hz) em arrays fixos — velocidade no
// plano, teto do tick, velocidade da arma no modo atual, limiar de precisão, inaccuracy, desejo e velocidade no plano e
// as marcas (chão, andando, FL_DUCKING). O gráfico do cl_showpos e o medidor de counter-strafe leem daqui; gravar não
// aloca.

export const TELEMETRY_SIZE = 256;

/** Marcas de cada amostra. */
export const TFLAG = Object.freeze({ GROUND: 1, WALK: 2, DUCK: 4 });

export class Telemetry {
  constructor(size = TELEMETRY_SIZE) {
    this.size = size;
    this.count = 0; // amostras gravadas desde o começo; a última é a de índice count − 1
    this.speed = new Float32Array(size);
    this.cap = new Float32Array(size);
    this.weaponSpeed = new Float32Array(size);
    this.threshold = new Float32Array(size);
    this.inaccuracy = new Float32Array(size);
    this.wishX = new Float32Array(size);
    this.wishZ = new Float32Array(size);
    this.velX = new Float32Array(size);
    this.velZ = new Float32Array(size);
    this.flags = new Uint8Array(size);
  }

  /** Posição no anel da amostra de índice absoluto `i`. */
  slot(i) {
    return ((i % this.size) + this.size) % this.size;
  }

  /** Grava a amostra do tick (sempre a próxima). */
  record(speed, cap, weaponSpeed, threshold, inaccuracy, wishX, wishZ, velX, velZ, flags) {
    const j = this.slot(this.count);
    this.speed[j] = speed;
    this.cap[j] = cap;
    this.weaponSpeed[j] = weaponSpeed;
    this.threshold[j] = threshold;
    this.inaccuracy[j] = inaccuracy;
    this.wishX[j] = wishX;
    this.wishZ[j] = wishZ;
    this.velX[j] = velX;
    this.velZ[j] = velZ;
    this.flags[j] = flags;
    this.count++;
  }

  /** Quantas amostras estão guardadas (até o tamanho do anel). */
  get length() {
    return Math.min(this.count, this.size);
  }

  reset() {
    this.count = 0;
  }
}
```

- [ ] **Passo 5: PlayerPawn**

```js file=src/player/playerPawn.js
// Jogador local no modo "andar": estado de movimento, item na mão (troca e luneta), precisão da arma, comando do tick e
// câmera. Cada tick segue a ordem do RunCommand do Source: troca de item → playerMove → precisão (pouso e penalidade) →
// luneta (vale a partir do tick seguinte). O render interpola pés, altura do olho e o FOV da luneta entre os ticks e
// suaviza degraus e a troca de cápsula no ar. Em terceira pessoa (debug) a câmera recua atrás do jogador e se recolhe
// ao encostar em parede.

import * as THREE from 'three';
import { EV } from '../core/events.js';
import { VIEW } from '../data/movement.js';
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
import { BTN, createMoveCmd, readMoveCmd } from './moveCmd.js';
import { MOVETYPE, createMoveState, eyeHeight, playerMove } from './movement.js';
import { TFLAG, Telemetry } from './telemetry.js';

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
    this.telemetry = new Telemetry();
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
    this.lastLanding = null;
    this.lastStep = null;
    this.stats = { distance: 0, topSpeed: 0, ticks: 0, jumps: 0, steps: 0 };
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

  /** Um tick: lê a entrada, troca de item, move, atualiza precisão e luneta, suaviza a câmera e publica os eventos. */
  tick(dt, input, { noclip = false, tick = 0 } = {}) {
    const s = this.state;
    this.prevOrigin.copy(s.origin);
    this.prevEyeOffset = this.eyeOffset;
    s.moveType = noclip ? MOVETYPE.NOCLIP : MOVETYPE.WALK;
    const cmd = readMoveCmd(this.cmd, input, tick, this.yaw, this.pitch);
    if (!cmd.select && this.pendingSelect) cmd.select = this.pendingSelect;
    this.pendingSelect = 0;
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
    this.eyeOffset = eyeHeight(s) + this.smooth;
    const events = this.env.events;
    for (let i = 0; i < events.length; i++) this.#onEvent(events[i]);
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
    this.telemetry.record(
      Math.hypot(s.velocity.x, s.velocity.z), s.maxSpeed, this.held.speed, precisionThreshold(this.held.speed),
      this.inaccuracy.total, -sy * cmd.forward + cy * cmd.side, -cy * cmd.forward - sy * cmd.side,
      s.velocity.x, s.velocity.z, flags,
    );
  }

  #onEvent(e) {
    if (e.type === 'jump') this.stats.jumps++;
    else if (e.type === 'land') this.lastLanding = e;
    else if (e.type === 'step') {
      this.lastStep = e;
      this.stats.steps++;
    }
    if (!this.bus) return;
    if (e.type === 'jump') this.bus.emit(EV.PLAYER_JUMP, e);
    else if (e.type === 'land') this.bus.emit(EV.PLAYER_LAND, e);
    else if (e.type === 'step') this.bus.emit(EV.PLAYER_STEP, e);
    else this.bus.emit(EV.PLAYER_DUCK, { ducked: e.type === 'duck' });
  }

  /** Câmera: pés, olho e FOV da luneta interpolados entre ticks; rotação do último quadro (resposta imediata). */
  updateCamera(camera, alpha) {
    camera.position.lerpVectors(this.prevOrigin, this.state.origin, alpha);
    camera.position.y += this.prevEyeOffset + (this.eyeOffset - this.prevEyeOffset) * alpha;
    camera.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
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

- [ ] **Passo 6: Rodar e ver passar**

Run: `node --test tests/playerPawn.test.js`
Expected: PASS (10 testes).

- [ ] **Passo 7: Suíte inteira**

Run: `npm test`
Expected: todos os testes passando (nenhum teste da 3.1 quebra).

- [ ] **Passo 8: Commit (só quando o usuário pedir)**

```bash
git add src/player/telemetry.js src/player/playerPawn.js src/core/events.js tests/playerPawn.test.js
git commit -m "feat(fase-3.2): PlayerPawn com item na mão, precisão, luneta, telemetria e eventos" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Tarefa 7: Medidor de counter-strafe

**Files:**
- Create: `src/debug/strafeMeter.js`
- Test: `tests/strafeMeter.test.js`

- [ ] **Passo 1: Escrever o teste**

```js file=tests/strafeMeter.test.js
// Testes do medidor de counter-strafe (Fase 3.2): sequências sintéticas na telemetria (soltar, contra, cancelar, sair
// do chão, média, melhor, janela) e o counter-strafe real da AK simulado pelo PlayerPawn (contra 5 × soltar 13 ticks).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { STRAFE_KIND, StrafeMeter } from '../src/debug/strafeMeter.js';
import { Loadout } from '../src/player/loadout.js';
import { PlayerPawn } from '../src/player/playerPawn.js';
import { createSvVars } from '../src/player/movementVars.js';
import { TELEMETRY_SIZE, TFLAG, Telemetry } from '../src/player/telemetry.js';
import { floor, worldOf } from './worldTestUtils.js';

const THRESHOLD = 73.1; // AK: 215 × 0,34
const TICK_MS = 1000 / 64;

/** Uma amostra: velocidade em +x, desejo em (wx, wz), no chão (ou não). */
function sample(t, speed, [wx, wz], { ground = true, vx = speed } = {}) {
  t.record(speed, 215, 215, THRESHOLD, 0, wx, wz, vx, 0, ground ? TFLAG.GROUND : 0);
}

/** Telemetria com `n` ticks correndo em +x a 215 (desejo junto da velocidade). */
function running(n = 3) {
  const t = new Telemetry();
  for (let i = 0; i < n; i++) sample(t, 215, [1, 0]);
  return t;
}

test('soltar: do tick em que largou até o primeiro abaixo do limiar', () => {
  const t = running();
  const meter = new StrafeMeter().updateFrom(t);
  for (const v of [180, 150, 120, 90]) sample(t, v, [0, 0]);
  meter.updateFrom(t);
  assert.equal(meter.kind, STRAFE_KIND.RELEASE, 'medindo');
  sample(t, 70, [0, 0]);
  meter.updateFrom(t);
  const s = meter.scores[STRAFE_KIND.RELEASE];
  assert.equal(meter.kind, null);
  assert.equal(s.count, 1);
  assert.equal(s.lastTicks, 5);
  assert.equal(s.last, 5 * TICK_MS);
  assert.equal(s.best, s.last);
  assert.equal(s.avg, s.last);
  assert.deepEqual(meter.marks, [{ kind: STRAFE_KIND.RELEASE, ticks: 5, ms: 5 * TICK_MS, end: t.count - 1 }]);
});

test('contra: desejo contra a velocidade (cosseno < −0,5); de lado não conta', () => {
  const t = running();
  const meter = new StrafeMeter();
  sample(t, 150, [-1, 0]);
  sample(t, 100, [-1, 0]);
  sample(t, 60, [-1, 0]);
  meter.updateFrom(t);
  assert.equal(meter.scores[STRAFE_KIND.COUNTER].lastTicks, 3);
  assert.equal(meter.scores[STRAFE_KIND.RELEASE].count, 0);
  const side = running();
  const other = new StrafeMeter();
  sample(side, 200, [0, 1]); // desejo de lado (cosseno 0): nem soltou nem contra
  sample(side, 60, [0, 1]);
  other.updateFrom(side);
  assert.equal(other.scores[STRAFE_KIND.COUNTER].count + other.scores[STRAFE_KIND.RELEASE].count, 0);
  const diagonal = running();
  const back = new StrafeMeter();
  sample(diagonal, 150, [-Math.SQRT1_2, Math.SQRT1_2]); // cosseno −0,707: ainda é contra
  sample(diagonal, 60, [-Math.SQRT1_2, Math.SQRT1_2]);
  back.updateFrom(diagonal);
  assert.equal(back.scores[STRAFE_KIND.COUNTER].lastTicks, 2);
});

test('cancela se o desejo voltar para o lado do movimento ou se sair do chão; e recomeça depois', () => {
  const t = running();
  const meter = new StrafeMeter();
  sample(t, 180, [0, 0]);
  sample(t, 190, [1, 0]); // voltou a correr: cancela
  meter.updateFrom(t);
  assert.equal(meter.kind, null);
  assert.equal(meter.canceled, 1);
  sample(t, 180, [0, 0]); // soltou de novo: nova medida
  sample(t, 150, [0, 0], { ground: false }); // pulou: cancela
  meter.updateFrom(t);
  assert.equal(meter.canceled, 2);
  assert.equal(meter.scores[STRAFE_KIND.RELEASE].count, 0);
  // Abaixo do limiar ou sem vir correndo: não começa.
  const slow = new Telemetry();
  for (let i = 0; i < 3; i++) sample(slow, 60, [1, 0]);
  sample(slow, 40, [0, 0]);
  const idle = new StrafeMeter().updateFrom(slow);
  assert.equal(idle.kind, null);
  assert.equal(idle.canceled, 0);
});

test('placar: última, melhor e média das 10 últimas de cada tipo; marcas somem com a janela; reset', () => {
  const t = running();
  const meter = new StrafeMeter();
  const counter = (ticks) => {
    for (let i = 0; i < 3; i++) sample(t, 215, [1, 0]);
    for (let i = 1; i < ticks; i++) sample(t, 150, [-1, 0]);
    sample(t, 50, [-1, 0]);
    meter.updateFrom(t);
  };
  for (const n of [3, 5, 4]) counter(n);
  const s = meter.scores[STRAFE_KIND.COUNTER];
  assert.equal(s.count, 3);
  assert.equal(s.last, 4 * TICK_MS);
  assert.equal(s.best, 3 * TICK_MS);
  assert.equal(s.avg, 4 * TICK_MS);
  for (let i = 0; i < 10; i++) counter(6);
  assert.equal(s.count, 13);
  assert.equal(s.recent.length, 10);
  assert.equal(s.avg, 6 * TICK_MS, 'as 3 primeiras saíram da média');
  assert.equal(s.best, 3 * TICK_MS, 'a melhor fica');
  assert.ok(meter.marks.length > 0);
  for (let i = 0; i < TELEMETRY_SIZE; i++) sample(t, 0, [0, 0]);
  meter.updateFrom(t);
  assert.equal(meter.marks.length, 0, 'fora da janela de 4 s');
  meter.reset();
  assert.equal(meter.scores[STRAFE_KIND.COUNTER].count, 0);
  assert.equal(meter.canceled, 0);
  // Telemetria zerada: o medidor recomeça junto.
  t.reset();
  for (let i = 0; i < 3; i++) sample(t, 215, [1, 0]);
  sample(t, 60, [0, 0]);
  meter.updateFrom(t);
  assert.equal(meter.scores[STRAFE_KIND.RELEASE].lastTicks, 1);
});

test('counter-strafe real da AK no PlayerPawn: contra 5 ticks (78 ms) × soltar 13 (203 ms)', () => {
  const loadout = new Loadout();
  loadout.give('ak47');
  const pawn = new PlayerPawn({
    world: worldOf((b) => floor(b)), sv: createSvVars(), loadout, position: new THREE.Vector3(0, 0, 0),
  });
  assert.equal(pawn.hands.item, 'ak47');
  const input = { move: { x: 0, y: 0 }, isDown: () => false };
  const meter = new StrafeMeter();
  let tick = 0;
  const hold = (x, ticks) => {
    input.move.x = x;
    for (let i = 0; i < ticks; i++) {
      pawn.tick(1 / 64, input, { tick: tick++ });
      meter.updateFrom(pawn.telemetry);
    }
  };
  hold(1, 100);
  hold(-1, 10);
  hold(0, 40);
  hold(1, 100);
  hold(0, 30);
  const counter = meter.scores[STRAFE_KIND.COUNTER];
  const release = meter.scores[STRAFE_KIND.RELEASE];
  assert.equal(counter.count, 1);
  assert.equal(counter.lastTicks, 5);
  assert.ok(Math.abs(counter.last - 78.125) < 1e-9);
  assert.equal(release.count, 1);
  assert.equal(release.lastTicks, 13);
  assert.ok(Math.abs(release.last - 203.125) < 1e-9);
});
```

- [ ] **Passo 2: Rodar e ver falhar**

Run: `node --test tests/strafeMeter.test.js`
Expected: FAIL — `Cannot find module .../src/debug/strafeMeter.js`.

- [ ] **Passo 3: Implementar**

```js file=src/debug/strafeMeter.js
// Medidor de counter-strafe (Fase 3.2), sobre a telemetria do jogador (src/player/telemetry.js): quanto tempo leva, a
// partir do tick em que o jogador para de correr, até a velocidade ficar abaixo do limiar de precisão da arma na mão.
// Dois tipos: "soltar" (largou o movimento) e "contra" (o desejo passou a apontar contra a velocidade, cosseno < −0,5 —
// o counter-strafe). Começa com o jogador no chão, acima do limiar, vindo de um tick em que corria na direção da
// velocidade; termina no primeiro tick abaixo do limiar; cancela se o desejo voltar para o lado do movimento ou se o
// jogador sair do chão. Puro: o matchState chama `updateFrom` a cada tick e o cl_showpos lê o placar e as marcas.

import { TFLAG } from '../player/telemetry.js';

export const STRAFE_KIND = Object.freeze({ RELEASE: 'soltar', COUNTER: 'contra' });

const COUNTER_COS = -0.5; // desejo contra a velocidade
const RUNNING_COS = 0.5; // correndo na direção da velocidade (tick anterior ao começo)
const RECENT = 10; // a média usa as 10 últimas medidas de cada tipo
const EPS = 1e-6;

function createScore() {
  return { count: 0, lastTicks: 0, last: null, best: null, avg: null, recent: [] };
}

/** Cosseno entre (ax, az) e (bx, bz); 0 se algum for nulo. */
function cosine(ax, az, bx, bz) {
  const la = Math.hypot(ax, az);
  const lb = Math.hypot(bx, bz);
  return la > EPS && lb > EPS ? (ax * bx + az * bz) / (la * lb) : 0;
}

export class StrafeMeter {
  /** @param {number} dt duração do tick (s), para converter ticks em ms. */
  constructor(dt = 1 / 64) {
    this.dt = dt;
    this.cursor = 0; // próxima amostra da telemetria a processar
    this.kind = null; // medida em andamento (STRAFE_KIND) ou null
    this.start = 0; // amostra do tick em que ela começou
    this.canceled = 0;
    this.scores = { [STRAFE_KIND.RELEASE]: createScore(), [STRAFE_KIND.COUNTER]: createScore() };
    this.marks = []; // medidas ainda dentro da janela da telemetria: {kind, ticks, ms, end}
  }

  /** Processa as amostras novas da telemetria (normalmente uma por tick). */
  updateFrom(telemetry) {
    const t = telemetry;
    if (t.count < this.cursor) this.#restart(); // a telemetria foi zerada: tudo o que ela tem agora é novo
    // Atrasado mais que o anel: começa pela amostra mais antiga que ainda tem a anterior guardada.
    const oldest = Math.max(1, t.count - t.size + 1);
    if (this.cursor < oldest) {
      this.kind = null;
      this.cursor = oldest;
    }
    for (; this.cursor < t.count; this.cursor++) this.#step(t, this.cursor);
    const floor = t.count - t.size;
    while (this.marks.length && this.marks[0].end < floor) this.marks.shift();
    return this;
  }

  /** Zera o placar e as marcas (cl_strafe_reset); a telemetria continua de onde está. */
  reset() {
    this.kind = null;
    this.canceled = 0;
    this.scores = { [STRAFE_KIND.RELEASE]: createScore(), [STRAFE_KIND.COUNTER]: createScore() };
    this.marks = [];
  }

  #restart() {
    this.kind = null;
    this.cursor = 0;
    this.marks = [];
  }

  #step(t, i) {
    if (i === 0) return;
    const a = t.slot(i - 1);
    const b = t.slot(i);
    const onGround = (t.flags[b] & TFLAG.GROUND) !== 0;
    const wx = t.wishX[b];
    const wz = t.wishZ[b];
    const wishing = Math.hypot(wx, wz) > EPS;
    // Desejo deste tick contra a velocidade com que ele começou (a do fim do tick anterior).
    const cos = cosine(wx, wz, t.velX[a], t.velZ[a]);
    if (this.kind) {
      if (!onGround || (wishing && cos > 0)) {
        this.kind = null;
        this.canceled++;
        return;
      }
    } else {
      const wasRunning = (t.flags[a] & TFLAG.GROUND) !== 0 && t.speed[a] > t.threshold[a]
        && cosine(t.wishX[a], t.wishZ[a], t.velX[a], t.velZ[a]) > RUNNING_COS;
      if (!onGround || !wasRunning) return;
      if (!wishing) this.kind = STRAFE_KIND.RELEASE;
      else if (cos < COUNTER_COS) this.kind = STRAFE_KIND.COUNTER;
      else return;
      this.start = i;
    }
    if (t.speed[b] < t.threshold[b]) this.#finish(i);
  }

  #finish(i) {
    const ticks = i - this.start + 1;
    const ms = ticks * this.dt * 1000;
    const s = this.scores[this.kind];
    s.count++;
    s.lastTicks = ticks;
    s.last = ms;
    s.best = s.best === null ? ms : Math.min(s.best, ms);
    s.recent.push(ms);
    if (s.recent.length > RECENT) s.recent.shift();
    s.avg = s.recent.reduce((sum, v) => sum + v, 0) / s.recent.length;
    this.marks.push({ kind: this.kind, ticks, ms, end: i });
    this.kind = null;
  }
}
```

- [ ] **Passo 4: Rodar e ver passar**

Run: `node --test tests/strafeMeter.test.js`
Expected: PASS (5 testes; o counter-strafe real da AK dá 5 × 13 ticks).

- [ ] **Passo 5: Suíte inteira**

Run: `npm test`
Expected: todos os testes passando (nenhum teste da 3.1 quebra).

- [ ] **Passo 6: Commit (só quando o usuário pedir)**

```bash
git add src/debug/strafeMeter.js tests/strafeMeter.test.js
git commit -m "feat(fase-3.2): medidor de counter-strafe" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Tarefa 8: Entrada — andar silencioso segurar/alternar por dispositivo e botão Andar no toque

**Files:**
- Create: `src/input/actionToggles.js`
- Modify: `src/data/actions.js`, `src/input/inputManager.js`, `src/data/touchLayout.js`, `src/data/configSchema.js`
- Test: `tests/input.test.js`

- [ ] **Passo 1: Escrever os testes**

Em `tests/input.test.js`, trocar:

```
// Testes da camada de entrada (partes puras): bindings, conflitos, rótulos, controle.
```

por:

```
// Testes da camada de entrada (partes puras): bindings, conflitos, rótulos, controle; na Fase 3.2, o trinco
// segurar/alternar do andar por dispositivo, os modos na config e a migração do layout de toque.
```

Em `tests/input.test.js`, trocar:

```
import { validateBindings } from '../src/data/configSchema.js';
import { ACTION_IDS } from '../src/data/actions.js';
```

por:

```
import { CONFIG_SCHEMA, validateBindings, validateTouchLayout } from '../src/data/configSchema.js';
import { ACTION_BY_ID, ACTION_IDS, TOGGLE_MODE, TOGGLE_MODES } from '../src/data/actions.js';
import {
  DEFAULT_TOUCH_BUTTONS, TOUCH_BUTTONS_SINCE, TOUCH_LAYOUT_VERSION, defaultTouchLayout,
} from '../src/data/touchLayout.js';
import {
  TOGGLE_DEVICES, createToggle, createToggleSet, keepToggleDevice, resetToggleSet, stepToggle, stepToggleSet,
} from '../src/input/actionToggles.js';
```

Em `tests/input.test.js`, trocar:

```
  }
});

```

por:

```
  }
});

test('trinco do andar: segurar vale com o botão; alternar troca a cada aperto (o latch, não o botão parado)', () => {
  const hold = createToggle();
  assert.equal(stepToggle(hold, true, true, TOGGLE_MODE.HOLD), true);
  assert.equal(stepToggle(hold, true, false, TOGGLE_MODE.HOLD), true);
  assert.equal(stepToggle(hold, false, false, TOGGLE_MODE.HOLD), false);
  const t = createToggle();
  const seq = [[true, true], [true, false], [false, false], [true, true], [false, false], [true, false]];
  assert.deepEqual(seq.map(([down, pressed]) => stepToggle(t, down, pressed, TOGGLE_MODE.TOGGLE)),
    [true, true, true, false, false, false], 'segurar parado não troca; o 2º aperto desliga');
  assert.equal(stepToggle(t, true, true, TOGGLE_MODE.TOGGLE), true, 'toque mais curto que um tick também liga');
});

test('trinco por dispositivo: cada um no seu modo, a ação vale se algum ligar; trocar de dispositivo e zerar', () => {
  const set = createToggleSet();
  const modes = { kbm: TOGGLE_MODE.HOLD, gamepad: TOGGLE_MODE.TOGGLE, touch: TOGGLE_MODE.TOGGLE };
  const input = (kbm = [0, false], gamepad = [0, false], touch = [0, false]) => {
    const one = ([value, pressed]) => ({ value, pressed });
    return { kbm: one(kbm), gamepad: one(gamepad), touch: one(touch) };
  };
  assert.equal(stepToggleSet(set, input(undefined, [1, true]), modes), true, 'L3 liga');
  assert.equal(stepToggleSet(set, input(), modes), true, 'e fica ligado solto');
  assert.equal(stepToggleSet(set, input([1, true]), modes), true, 'Shift segurado também vale');
  assert.equal(stepToggleSet(set, input([1, false], [1, true]), modes), true, 'L3 desliga, mas o Shift segue apertado');
  assert.equal(stepToggleSet(set, input(), modes), false);
  stepToggleSet(set, input(undefined, undefined, [1, true]), modes);
  assert.equal(set.touch.on, true);
  keepToggleDevice(set, 'kbm');
  assert.equal(set.touch.on, false, 'trocou para o teclado: o alternado do toque desliga');
  stepToggleSet(set, input(undefined, [1, true]), modes);
  keepToggleDevice(set, 'gamepad');
  assert.equal(set.gamepad.on, true, 'o do dispositivo novo fica');
  resetToggleSet(set);
  assert.ok(TOGGLE_DEVICES.every((d) => !set[d].on));
});

test('config: modo do andar por dispositivo (teclado segura; controle e toque alternam)', () => {
  const walk = ACTION_BY_ID.walk.toggle;
  assert.deepEqual(Object.keys(walk).sort(), [...TOGGLE_DEVICES].sort());
  const expected = { kbm: TOGGLE_MODE.HOLD, gamepad: TOGGLE_MODE.TOGGLE, touch: TOGGLE_MODE.TOGGLE };
  for (const [device, key] of Object.entries(walk)) {
    const spec = CONFIG_SCHEMA[key];
    assert.ok(spec, key);
    assert.equal(spec.type, 'enum');
    assert.deepEqual([...spec.options], [...TOGGLE_MODES]);
    assert.equal(spec.default, expected[device], key);
  }
  assert.deepEqual(ACTION_IDS.filter((id) => ACTION_BY_ID[id].toggle), ['walk'], 'só o andar alterna por enquanto');
});

test('layout de toque v2: botão Andar; layouts v1 ganham só o que falta; as áreas de toque não se sobrepõem', () => {
  assert.equal(TOUCH_LAYOUT_VERSION, 2);
  assert.equal(defaultTouchLayout().version, 2);
  const walk = DEFAULT_TOUCH_BUTTONS.find((b) => b.id === 'walk');
  assert.equal(walk.action, 'walk');
  for (const ids of Object.values(TOUCH_BUTTONS_SINCE)) {
    for (const id of ids) assert.ok(DEFAULT_TOUCH_BUTTONS.some((b) => b.id === id), id);
  }
  // Layout salvo na v1, com o tiro movido pelo jogador: ganha o Andar e o tiro continua onde ele pôs.
  const v1 = { version: 1, buttons: [{ id: 'fire', action: 'fire', x: 0.5, y: 0.5, r: 0.1, opacity: 1 }] };
  const migrated = validateTouchLayout(v1);
  assert.equal(migrated.version, 2);
  assert.deepEqual(migrated.buttons.map((b) => b.id), ['fire', 'walk']);
  assert.deepEqual(migrated.buttons[0], v1.buttons[0]);
  assert.deepEqual(migrated.buttons[1], { ...walk });
  const noVersion = validateTouchLayout({ buttons: [] });
  assert.deepEqual(noVersion.buttons.map((b) => b.id), ['walk'], 'sem versão conta como v1');
  const already = validateTouchLayout({ version: 1, buttons: [{ ...walk, x: 0.2 }] });
  assert.equal(already.buttons.length, 1, 'já tinha o botão: não duplica');
  assert.equal(already.buttons[0].x, 0.2);
  assert.deepEqual(validateTouchLayout({ version: 2, buttons: [] }).buttons, [], 'v2 sem o botão: o jogador tirou');
  // Área de toque = raio × 1,15 (tolerância do TouchInput.hitButton), em fração do menor lado da tela.
  for (const [w, h] of [[1920, 1080], [2400, 1080], [1024, 768]]) {
    const min = Math.min(w, h);
    const B = DEFAULT_TOUCH_BUTTONS;
    for (let i = 0; i < B.length; i++) {
      for (let j = i + 1; j < B.length; j++) {
        const d = Math.hypot((B[i].x - B[j].x) * w, (B[i].y - B[j].y) * h);
        assert.ok(d >= (B[i].r + B[j].r) * min * 1.15, `${B[i].id} × ${B[j].id} em ${w}×${h}`);
      }
    }
  }
});

```

- [ ] **Passo 2: Rodar e ver falhar**

Run: `node --test tests/input.test.js`
Expected: FAIL — `Cannot find module .../src/input/actionToggles.js`.

- [ ] **Passo 3: Modos na definição das ações**

Em `src/data/actions.js`, trocar:

```
// `analog`: ação que também tem intensidade 0..1 (gatilhos, eixos). `ui`: dispara mesmo fora da partida.

```

por:

```
// `analog`: ação que também tem intensidade 0..1 (gatilhos, eixos). `ui`: dispara mesmo fora da partida.
// `toggle`: a ação pode alternar (cada aperto liga/desliga) em vez de valer só segurando; o modo de cada dispositivo
// vem da chave de config indicada (um dos TOGGLE_MODES; o trinco fica em src/input/actionToggles.js).

/** Modos das ações que podem alternar: segurar (vale com o botão apertado) ou alternar (cada aperto troca). */
export const TOGGLE_MODE = Object.freeze({ HOLD: 'segurar', TOGGLE: 'alternar' });
export const TOGGLE_MODES = Object.freeze([TOGGLE_MODE.HOLD, TOGGLE_MODE.TOGGLE]);

```

Em `src/data/actions.js`, trocar:

```
  { id: 'walk', group: 'movimento', label: 'Andar silencioso' },
```

por:

```
  {
    id: 'walk', group: 'movimento', label: 'Andar silencioso',
    toggle: { kbm: 'controls.walkMode', gamepad: 'controls.pad.walkMode', touch: 'controls.touch.walkMode' },
  },
```

- [ ] **Passo 4: Trinco puro**

```js file=src/input/actionToggles.js
// Trinco de ação por dispositivo (Fase 3.2): "segurar" vale enquanto o botão está apertado; "alternar" liga e desliga a
// cada aperto. As ações que podem alternar (o andar silencioso: `toggle` em src/data/actions.js) têm um trinco por
// dispositivo, cada um no modo escolhido para ele, e valem se qualquer um estiver ligado. Só o aperto registrado pelo
// dispositivo (o latch) troca o alternado: segurar o botão durante uma troca de contexto não liga nada sozinho. Funções
// puras: o InputManager passa o estado de cada dispositivo a cada tick.

import { TOGGLE_MODE } from '../data/actions.js';

/** Dispositivos com trinco próprio (os nomes do InputManager.device). */
export const TOGGLE_DEVICES = Object.freeze(['kbm', 'gamepad', 'touch']);

export function createToggle() {
  return { on: false };
}

/**
 * Um tick do trinco. `down`: o botão vale neste tick (apertado agora ou tocado desde o último tick); `pressed`: apertou
 * desde o último tick. Devolve se a ação está ligada.
 */
export function stepToggle(t, down, pressed, mode) {
  if (mode === TOGGLE_MODE.TOGGLE) {
    if (pressed) t.on = !t.on;
  } else {
    t.on = down;
  }
  return t.on;
}

export function resetToggle(t) {
  t.on = false;
  return t;
}

/** Trincos de uma ação nos três dispositivos. */
export function createToggleSet() {
  return { kbm: createToggle(), gamepad: createToggle(), touch: createToggle() };
}

/**
 * Um tick da ação nos três dispositivos. `input[device]`: {value, pressed} daquele dispositivo; `modes[device]`: o modo
 * dele. Devolve se a ação vale (algum trinco ligado).
 */
export function stepToggleSet(set, input, modes) {
  let on = false;
  for (const d of TOGGLE_DEVICES) {
    const i = input[d];
    if (stepToggle(set[d], i.value > 0 || i.pressed, i.pressed, modes[d])) on = true;
  }
  return on;
}

/** Trocou de dispositivo: o alternado dos outros desliga (não fica andando por um controle largado). */
export function keepToggleDevice(set, device) {
  for (const d of TOGGLE_DEVICES) if (d !== device) resetToggle(set[d]);
  return set;
}

export function resetToggleSet(set) {
  for (const d of TOGGLE_DEVICES) resetToggle(set[d]);
  return set;
}
```

- [ ] **Passo 5: InputManager: avaliação por dispositivo, trincos e `resetToggles()`**

Em `src/input/inputManager.js`, trocar:

```

import { EV } from '../core/events.js';
import { ACTIONS, ACTION_IDS, ACTION_BY_ID } from '../data/actions.js';
```

por:

```
// - Cada ação é avaliada por dispositivo e juntada; as que podem alternar (andar silencioso) passam por um trinco por
//   dispositivo, no modo escolhido para ele (src/input/actionToggles.js). O alternado sobrevive à pausa, é zerado pela
//   partida ao entrar e sair (resetToggles) e trocar de dispositivo desliga o dos outros.

import { EV } from '../core/events.js';
import { ACTIONS, ACTION_IDS, ACTION_BY_ID, TOGGLE_MODE } from '../data/actions.js';
```

Em `src/input/inputManager.js`, trocar:

```
import { TouchInput } from './touch.js';
```

por:

```
import { TouchInput } from './touch.js';
import { createToggleSet, keepToggleDevice, resetToggleSet, stepToggleSet } from './actionToggles.js';
```

Em `src/input/inputManager.js`, trocar:

```
    this._evalPressed = false;
```

por:

```
    this._evalPressed = false;
    // Estado de uma ação em cada dispositivo (reutilizado a cada avaliação).
    this._dev = {
      kbm: { value: 0, pressed: false },
      gamepad: { value: 0, pressed: false },
      touch: { value: 0, pressed: false },
    };
    // Ações que podem alternar: trincos por dispositivo e o modo de cada um (lido da config).
    this._toggles = {};
    this._toggleModes = {};
    this._toggleKeys = new Set();
    for (const a of ACTIONS) {
      if (!a.toggle) continue;
      this._toggles[a.id] = createToggleSet();
      this._toggleModes[a.id] = { kbm: TOGGLE_MODE.HOLD, gamepad: TOGGLE_MODE.HOLD, touch: TOGGLE_MODE.HOLD };
      for (const key of Object.values(a.toggle)) this._toggleKeys.add(key);
    }
```

Em `src/input/inputManager.js`, trocar:

```
    this._offs.push(this.config.watch('controls.', (e) => {
```

por:

```
    this.#loadToggleModes();
    this._offs.push(this.config.watch('controls.', (e) => {
      if (this._toggleKeys.has(e.key)) this.#loadToggleModes();
```

Em `src/input/inputManager.js`, trocar:

```
  /** Resultado em this._evalValue/_evalPressed (sem alocar: roda ~30 ações × 64 ticks/s). */
  #evaluate(action) {
    let value = 0;
    let pressed = false;
    const entry = this._bindings[action];
    for (const b of entry.kbm) {
```

por:

```
  /** Desliga o alternado de todas as ações (a partida chama ao entrar e ao sair). */
  resetToggles() {
    for (const id in this._toggles) resetToggleSet(this._toggles[id]);
  }

  /**
   * Resultado em this._evalValue/_evalPressed (sem alocar: roda ~30 ações × 64 ticks/s). Cada dispositivo é avaliado à
   * parte; a ação vale o maior valor entre eles. Nas que podem alternar, cada dispositivo passa pelo próprio trinco e o
   * aperto cru não vira aperto da ação (quem diz se ligou é o trinco).
   */
  #evaluate(action) {
    const dev = this._dev;
    this.#evalKbm(action, dev.kbm);
    this.#evalPad(action, dev.gamepad);
    this.#evalTouch(action, dev.touch);
    const toggles = this._toggles[action];
    if (toggles) {
      this._evalValue = stepToggleSet(toggles, dev, this._toggleModes[action]) ? 1 : 0;
      this._evalPressed = false;
      return;
    }
    this._evalValue = Math.max(dev.kbm.value, dev.gamepad.value, dev.touch.value);
    this._evalPressed = dev.kbm.pressed || dev.gamepad.pressed || dev.touch.pressed;
  }

  #evalKbm(action, out) {
    out.value = 0;
    out.pressed = false;
    for (const b of this._bindings[action].kbm) {
```

Em `src/input/inputManager.js`, trocar:

```
          value = 1;
          pressed = true;
        }
      } else if (this.kbm.isDown(b)) {
        value = 1;
        if (this.kbm.wasPressed(b)) pressed = true;
      }
    }
    if (this.pad.connected) {
      for (const b of entry.pad) {
        const p = this._parsed.get(b);
        if (!p) continue;
        let v = 0;
        if (p.kind === 'button') v = this.pad.button(p.index) >= (p.index === 6 || p.index === 7 ? this.pad.triggerThreshold : 0.5) ? this.pad.button(p.index) : 0;
        else if (p.kind === 'axis') v = this.#padAxisValue(p.index, p.sign);
        if (v > value) value = v;
        if (this.pad.wasPressed(b)) pressed = true;
      }
    }
    if (this.touch.isHeld(action)) {
      value = 1;
      if (this.touch.wasPressed(action)) pressed = true;
```

por:

```
          out.value = 1;
          out.pressed = true;
        }
      } else if (this.kbm.isDown(b)) {
        out.value = 1;
        if (this.kbm.wasPressed(b)) out.pressed = true;
      }
    }
  }

  #evalPad(action, out) {
    out.value = 0;
    out.pressed = false;
    if (!this.pad.connected) return;
    for (const b of this._bindings[action].pad) {
      const p = this._parsed.get(b);
      if (!p) continue;
      let v = 0;
      if (p.kind === 'button') {
        const threshold = p.index === 6 || p.index === 7 ? this.pad.triggerThreshold : 0.5;
        v = this.pad.button(p.index) >= threshold ? this.pad.button(p.index) : 0;
      } else if (p.kind === 'axis') {
        v = this.#padAxisValue(p.index, p.sign);
      }
      if (v > out.value) out.value = v;
      if (this.pad.wasPressed(b)) out.pressed = true;
    }
  }

  #evalTouch(action, out) {
    out.value = 0;
    out.pressed = false;
    if (this.touch.isHeld(action)) {
      out.value = 1;
      if (this.touch.wasPressed(action)) out.pressed = true;
```

Em `src/input/inputManager.js`, trocar:

```
      if (this.autoFireTarget) value = 1;
    }
    this._evalValue = value;
    this._evalPressed = pressed;
```

por:

```
      if (this.autoFireTarget) out.value = 1;
    }
```

Em `src/input/inputManager.js`, trocar:

```
    this.device = device;
```

por:

```
    this.device = device;
    for (const id in this._toggles) keepToggleDevice(this._toggles[id], device);
```

Em `src/input/inputManager.js`, trocar:

```

  get bindings() {
```

por:

```

  /** Modo (segurar/alternar) de cada dispositivo nas ações que podem alternar. */
  #loadToggleModes() {
    for (const a of ACTIONS) {
      if (!a.toggle) continue;
      const modes = this._toggleModes[a.id];
      for (const device in a.toggle) modes[device] = this.config.get(a.toggle[device]);
    }
  }

  get bindings() {
```

- [ ] **Passo 6: Layout de toque versão 2 com o botão Andar**

Em `src/data/touchLayout.js`, trocar:

```
// config `controls.touch.layout`; aqui ficam os padrões e as zonas.
```

por:

```
// config `controls.touch.layout`; aqui ficam os padrões e as zonas. Cada botão padrão novo entra em
// TOUCH_BUTTONS_SINCE com a versão que o trouxe: layouts salvos antes dela o ganham ao carregar.
```

Em `src/data/touchLayout.js`, trocar:

```
  Object.freeze({ id: 'crouch', action: 'crouch', x: 0.79, y: 0.88, r: 0.055, opacity: 0.7 }),
```

por:

```
  Object.freeze({ id: 'crouch', action: 'crouch', x: 0.79, y: 0.88, r: 0.055, opacity: 0.7 }),
  Object.freeze({ id: 'walk', action: 'walk', x: 0.705, y: 0.9, r: 0.04, opacity: 0.65 }),
```

Em `src/data/touchLayout.js`, trocar:

```
export function defaultTouchLayout() {
  return { version: 1, buttons: DEFAULT_TOUCH_BUTTONS.map((b) => ({ ...b })) };
```

por:

```
/** Versão do layout padrão (2: botão de andar silencioso, Fase 3.2). */
export const TOUCH_LAYOUT_VERSION = 2;

/** Botões padrão acrescentados em cada versão (ids de DEFAULT_TOUCH_BUTTONS). */
export const TOUCH_BUTTONS_SINCE = Object.freeze({ 2: Object.freeze(['walk']) });

export function defaultTouchLayout() {
  return { version: TOUCH_LAYOUT_VERSION, buttons: DEFAULT_TOUCH_BUTTONS.map((b) => ({ ...b })) };
```

- [ ] **Passo 7: Config: modos por dispositivo e migração do layout salvo**

Em `src/data/configSchema.js`, trocar:

```
import { ACTION_IDS } from './actions.js';
import { PRESET_IDS } from './qualityPresets.js';
import { defaultTouchLayout } from './touchLayout.js';
```

por:

```
import { ACTION_IDS, TOGGLE_MODE, TOGGLE_MODES } from './actions.js';
import { PRESET_IDS } from './qualityPresets.js';
import { DEFAULT_TOUCH_BUTTONS, TOUCH_BUTTONS_SINCE, TOUCH_LAYOUT_VERSION, defaultTouchLayout } from './touchLayout.js';
```

Em `src/data/configSchema.js`, trocar:

```
function validateTouchLayout(value) {
```

por:

```
/**
 * Valida o layout de toque salvo. Um layout de versão antiga ganha os botões padrão criados depois dela (os que ainda
 * não tiver); os botões que o jogador já tem ficam como estão.
 */
export function validateTouchLayout(value) {
```

Em `src/data/configSchema.js`, trocar:

```
  return { version: 1, buttons };
```

por:

```
  const version = Number.isInteger(value.version) && value.version > 0 ? value.version : 1;
  for (const [since, ids] of Object.entries(TOUCH_BUTTONS_SINCE)) {
    if (version >= Number(since)) continue;
    for (const id of ids) {
      if (buttons.length >= 32 || buttons.some((b) => b.id === id)) continue;
      buttons.push({ ...DEFAULT_TOUCH_BUTTONS.find((b) => b.id === id) });
    }
  }
  return { version: TOUCH_LAYOUT_VERSION, buttons };
```

Em `src/data/configSchema.js`, trocar:

```
  'controls.rawInput': { type: 'bool', default: true, label: 'Entrada bruta do mouse', group: 'controls' },
```

por:

```
  'controls.rawInput': { type: 'bool', default: true, label: 'Entrada bruta do mouse', group: 'controls' },
  'controls.walkMode': {
    type: 'enum', options: TOGGLE_MODES, default: TOGGLE_MODE.HOLD, label: 'Andar silencioso (teclado)', group: 'controls',
  },
```

Em `src/data/configSchema.js`, trocar:

```
    type: 'enum', options: ['auto', 'playstation', 'xbox', 'generico'], default: 'auto', label: 'Ícones de botão', group: 'pad',
  },

```

por:

```
    type: 'enum', options: ['auto', 'playstation', 'xbox', 'generico'], default: 'auto', label: 'Ícones de botão', group: 'pad',
  },
  'controls.pad.walkMode': {
    type: 'enum', options: TOGGLE_MODES, default: TOGGLE_MODE.TOGGLE, label: 'Andar silencioso (controle)', group: 'pad',
  },

```

Em `src/data/configSchema.js`, trocar:

```
  'controls.touch.autoFire': { type: 'bool', default: false, label: 'Tiro automático', group: 'touch' },
```

por:

```
  'controls.touch.autoFire': { type: 'bool', default: false, label: 'Tiro automático', group: 'touch' },
  'controls.touch.walkMode': {
    type: 'enum', options: TOGGLE_MODES, default: TOGGLE_MODE.TOGGLE, label: 'Andar silencioso (toque)', group: 'touch',
  },
```

- [ ] **Passo 8: Rodar e ver passar**

Run: `node --test tests/input.test.js`
Expected: PASS (10 testes).

- [ ] **Passo 9: Suíte inteira**

Run: `npm test`
Expected: todos os testes passando (nenhum teste da 3.1 quebra).

- [ ] **Passo 10: Commit (só quando o usuário pedir)**

```bash
git add src/input src/data/actions.js src/data/touchLayout.js src/data/configSchema.js tests/input.test.js
git commit -m "feat(fase-3.2): andar silencioso segurar/alternar por dispositivo e botão Andar no toque" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Tarefa 9: Interface — modo do andar nas configurações e HUD de teste

**Files:**
- Modify: `src/ui/settingControls.js`, `src/ui/settingsScreen.js`, `src/ui/sandboxHud.js`, `styles/hud.css`

Sem teste em Node (DOM): a Tarefa 12 confere no navegador.

- [ ] **Passo 1: Rótulos Segurar/Alternar**

Em `src/ui/settingControls.js`, trocar:

```
  desligado: 'Desligado', meia: 'Meia resolução', cheia: 'Resolução cheia', sutil: 'Sutil', forte: 'Forte',
```

por:

```
  desligado: 'Desligado', meia: 'Meia resolução', cheia: 'Resolução cheia', sutil: 'Sutil', forte: 'Forte',
  segurar: 'Segurar', alternar: 'Alternar',
```

- [ ] **Passo 2: Modo do andar nas abas Teclas, Controle e Toque**

Em `src/ui/settingsScreen.js`, trocar:

```
  'controls.pad.vibration', 'controls.pad.icons',
];
const TOUCH_KEYS = ['controls.touch.lookSensitivity', 'controls.touch.autoFire', 'controls.touch.gyroSensitivity', 'debug.touchGuides'];
```

por:

```
  'controls.pad.walkMode', 'controls.pad.vibration', 'controls.pad.icons',
];
// Toque: as opções antes e depois do giroscópio (que tem linha própria, com o pedido de permissão).
const TOUCH_KEYS = ['controls.touch.lookSensitivity', 'controls.touch.autoFire', 'controls.touch.walkMode'];
const TOUCH_AFTER_GYRO_KEYS = ['controls.touch.gyroSensitivity', 'debug.touchGuides'];
const WALK_HINT = 'alternar: cada aperto liga ou desliga';
```

Em `src/ui/settingsScreen.js`, trocar:

```
    return [section('Controle', status, ...PAD_KEYS.map((k) => track(settingRow(config, k))), test)];
```

por:

```
    return [section('Controle', status, ...PAD_KEYS.map((k) => track(settingRow(config, k, {
      hint: k === 'controls.pad.walkMode' ? WALK_HINT : null,
    }))), test)];
```

Em `src/ui/settingsScreen.js`, trocar:

```
    return [section('Toque', info, ...TOUCH_KEYS.slice(0, 2).map((k) => track(settingRow(config, k))), gyro,
      ...TOUCH_KEYS.slice(2).map((k) => track(settingRow(config, k))))];
```

por:

```
    return [section('Toque', info, ...TOUCH_KEYS.map((k) => track(settingRow(config, k, {
      hint: k === 'controls.touch.walkMode' ? WALK_HINT : null,
    }))), gyro, ...TOUCH_AFTER_GYRO_KEYS.map((k) => track(settingRow(config, k))))];
```

Em `src/ui/settingsScreen.js`, trocar:

```
    return [track(bindingsPanel({ input, rebinder, events, toasts }))];
```

por:

```
    return [
      section('Teclado', track(settingRow(config, 'controls.walkMode', { hint: WALK_HINT }))),
      track(bindingsPanel({ input, rebinder, events, toasts })),
    ];
```

- [ ] **Passo 3: HUD: etiqueta "na mão", "ANDANDO" e dicas**

Em `src/ui/sandboxHud.js`, trocar:

```
// que some sozinha — de andar (mapa com colisão) ou de voar (vitrine). O HUD completo de massinha chega na Fase 10.
```

por:

```
// que some sozinha — de andar (mapa com colisão) ou de voar (vitrine). Andando, mostra o item na mão (etiqueta de fita
// crepe) e "ANDANDO" sob a mira com o andar silencioso ligado. O HUD completo de massinha chega na Fase 10.
```

Em `src/ui/sandboxHud.js`, trocar:

```
    kbm: 'WASD andar · Espaço pula · Ctrl agacha · ` console (noclip voa) · F3 desempenho',
    gamepad: 'Analógico E anda · Analógico D olha · A/✕ pula · B/○ agacha · Options pausa',
    touch: 'Joystick à esquerda anda · arraste à direita para olhar · botões para pular e agachar',
```

por:

```
    kbm: 'WASD anda · Shift silencioso · Espaço pula · Ctrl agacha · 1–5, roda e Q trocam · botão direito: luneta'
      + ' · ` console (noclip voa) · F3 desempenho',
    gamepad: 'Analógico E anda · Analógico D olha · A/✕ pula · B/○ agacha · L3 liga/desliga o andar · Y/△ troca'
      + ' · LT/L2 luneta · Options pausa',
    touch: 'Joystick à esquerda anda · arraste à direita para olhar · botões pulam, agacham, trocam de arma e ligam'
      + ' o andar silencioso',
```

Em `src/ui/sandboxHud.js`, trocar:

```
  const status = h('span.hud-status');
```

por:

```
  const status = h('span.hud-status');
  const held = h('span.tape-label.hud-held', { hidden: true });
  const walk = h('span.hud-walk', { hidden: true }, 'ANDANDO');
```

Em `src/ui/sandboxHud.js`, trocar:

```
    h('div.hud-top', null, h('span.tape-label.hud-title', null, title), status),
```

por:

```
    h('div.hud-top', null, h('span.tape-label.hud-title', null, title), held, status),
    walk,
```

Em `src/ui/sandboxHud.js`, trocar:

```
    },
    dispose() {
```

por:

```
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
    dispose() {
```

Em `styles/hud.css`, trocar:

```

.hud-prompt {
```

por:

```

/* Item na mão: segunda tira de fita crepe, torta para o outro lado. */
.hud-held { font: 700 0.8rem / 1.2 var(--font-mono); transform: rotate(0.8deg); }

/* Andar silencioso ligado: aviso curto logo abaixo da mira. */
.hud-walk {
  position: absolute;
  left: 50%;
  top: calc(50% + 26px);
  translate: -50% 0;
  font: 800 0.72rem var(--font-mono);
  letter-spacing: 0.14em;
  color: var(--clay-yellow);
  text-shadow: 0 1px 2px #000;
}

.hud-prompt {
```

- [ ] **Passo 4: Sintaxe e suíte**

Run: `node --check src/ui/settingsScreen.js && node --check src/ui/sandboxHud.js && npm test`
Expected: sem erro de sintaxe; todos os testes passando.

- [ ] **Passo 5: Commit (só quando o usuário pedir)**

```bash
git add src/ui styles/hud.css
git commit -m "feat(fase-3.2): modo do andar nas configurações e HUD com item na mão" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Tarefa 10: Debug — gráfico, cl_showpos novo, cl_strafe_reset, give bomba e loadout

**Files:**
- Create: `src/debug/speedGraph.js`
- Modify: `src/debug/showPos.js` (arquivo inteiro), `styles/debug.css`, `src/debug/movementCommands.js`, `src/debug/commands.js`

Sem teste em Node (canvas e DOM): a Tarefa 12 confere no navegador.

- [ ] **Passo 1: Gráfico dos últimos 4 s**

```js file=src/debug/speedGraph.js
// Gráfico do cl_showpos (Fase 3.2): os últimos 4 s da telemetria do jogador num canvas — a faixa preciso × impreciso
// (abaixo e acima do limiar de precisão da arma na mão), o teto do tick, o limiar tracejado, a velocidade no plano, a
// inaccuracy por cima, os ticks no ar numa tira embaixo e a marca de cada medida do counter-strafe com o tempo em ms. O
// tick mais novo fica na borda direita. Redesenhado a cada atualização do painel (15 Hz).

import { TFLAG } from '../player/telemetry.js';
import { STRAFE_KIND } from './strafeMeter.js';

// Cores da paleta do projeto (tokens de UI e dos times), com a transparência do painel.
const COLOR = Object.freeze({
  precise: 'rgba(63, 184, 175, 0.2)',
  imprecise: 'rgba(228, 87, 46, 0.13)',
  grid: 'rgba(246, 240, 228, 0.1)',
  cap: 'rgba(246, 240, 228, 0.6)',
  threshold: '#3FB8AF',
  speed: '#FFD23F',
  inaccuracy: '#E4572E',
  air: '#2F6DB5',
  text: '#F6F0E4',
  [STRAFE_KIND.COUNTER]: '#FFD23F',
  [STRAFE_KIND.RELEASE]: '#F6F0E4',
});
const SPEED_TOP = 300; // u/s no topo da escala (o teto do bhop, 286, cabe); cresce de 50 em 50 se a janela passar
const SPEED_STEP = 50;
const INACCURACY_TOP = 0.3; // rad no topo da curva de inaccuracy
const AIR_STRIP = 3; // px da tira dos ticks no ar
const FONT = '600 10px ui-monospace, "Cascadia Mono", Consolas, "SF Mono", "Courier New", monospace'; // --font-mono

export class SpeedGraph {
  constructor(canvas, { width = 480, height = 96 } = {}) {
    this.canvas = canvas;
    this.width = width;
    this.height = height;
    this.ctx = canvas.getContext('2d');
    this.dpr = 0;
  }

  /** Resolução do canvas pela densidade da tela (no máximo 2×); a largura em CSS é fixa e encolhe com o painel. */
  #fit() {
    const dpr = Math.min(2, globalThis.devicePixelRatio || 1);
    if (dpr === this.dpr) return;
    this.dpr = dpr;
    this.canvas.width = Math.round(this.width * dpr);
    this.canvas.height = Math.round(this.height * dpr);
    this.canvas.style.width = `${this.width}px`;
  }

  /** Desenha a janela da telemetria `t` e as marcas do medidor (opcional). */
  draw(t, meter = null) {
    this.#fit();
    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    const n = t.length;
    if (n < 2) return;
    const first = t.count - n;
    let top = SPEED_TOP;
    for (let i = first; i < t.count; i++) {
      const j = t.slot(i);
      top = Math.max(top, t.speed[j], t.cap[j]);
    }
    top = Math.ceil(top / SPEED_STEP) * SPEED_STEP;
    const plotH = h - AIR_STRIP - 1;
    const dx = w / (t.size - 1);
    const xOf = (i) => w - (t.count - 1 - i) * dx;
    const yOf = (v) => plotH - (Math.min(v, top) / top) * plotH;

    // Faixas: preciso abaixo do limiar, impreciso acima; tira azul nos ticks no ar.
    for (let i = first; i < t.count; i++) {
      const j = t.slot(i);
      const x0 = xOf(i) - dx / 2;
      const yt = yOf(t.threshold[j]);
      ctx.fillStyle = COLOR.imprecise;
      ctx.fillRect(x0, 0, dx, yt);
      ctx.fillStyle = COLOR.precise;
      ctx.fillRect(x0, yt, dx, plotH - yt);
      if (!(t.flags[j] & TFLAG.GROUND)) {
        ctx.fillStyle = COLOR.air;
        ctx.fillRect(x0, h - AIR_STRIP, dx, AIR_STRIP);
      }
    }
    ctx.strokeStyle = COLOR.grid;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let v = SPEED_STEP; v < top; v += SPEED_STEP) {
      const y = Math.round(yOf(v)) + 0.5;
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
    }
    ctx.stroke();

    this.#line(t, first, xOf, (j) => yOf(t.cap[j]), COLOR.cap, 1, false);
    this.#line(t, first, xOf, (j) => yOf(t.threshold[j]), COLOR.threshold, 1, true);
    const yAcc = (j) => plotH - Math.min(1, t.inaccuracy[j] / INACCURACY_TOP) * plotH;
    this.#line(t, first, xOf, yAcc, COLOR.inaccuracy, 1, false);
    this.#line(t, first, xOf, (j) => yOf(t.speed[j]), COLOR.speed, 1.6, false);

    ctx.font = FONT;
    ctx.textBaseline = 'top';
    ctx.fillStyle = COLOR.text;
    ctx.textAlign = 'left';
    ctx.fillText(`${top} u/s`, 3, 2);
    if (!meter) return;
    for (const m of meter.marks) {
      if (m.end < first) continue;
      const x = Math.round(xOf(m.end)) + 0.5;
      ctx.strokeStyle = COLOR[m.kind];
      ctx.beginPath();
      ctx.moveTo(x, 12);
      ctx.lineTo(x, plotH);
      ctx.stroke();
      ctx.fillStyle = COLOR[m.kind];
      ctx.textAlign = x > w - 44 ? 'right' : 'left';
      ctx.fillText(`${Math.round(m.ms)} ms`, x + (x > w - 44 ? -3 : 3), 12);
    }
  }

  /** Uma série da telemetria como linha (`dashed`: tracejada). */
  #line(t, first, xOf, yOf, color, width, dashed) {
    const ctx = this.ctx;
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.setLineDash(dashed ? [4, 3] : []);
    ctx.beginPath();
    for (let i = first; i < t.count; i++) {
      const x = xOf(i);
      const y = yOf(t.slot(i));
      if (i === first) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.setLineDash([]);
  }
}
```

- [ ] **Passo 2: Painel do cl_showpos**

```js file=src/debug/showPos.js
// cl_showpos (Fases 3.1 e 3.2): pés, ângulos, velocidade, chão e cápsula do jogador; item na mão e luneta; o teto do
// tick com os fatores (andar, stamina, agachar); stamina; agachar; a inaccuracy com as partes; último passo e pouso; o
// placar do counter-strafe e o gráfico dos últimos 4 s (src/debug/speedGraph.js). Painel no canto, atualizado 15 vezes
// por segundo (texto, sem custo de layout a cada quadro).

import { h } from '../ui/dom.js';
import { SURFACES } from '../data/surfaces.js';
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

export class ShowPosPanel {
  constructor(root) {
    this.text = h('pre.dbg-showpos-text');
    this.canvas = h('canvas.dbg-showpos-graph', { width: 480, height: 96 });
    this.legend = h('div.dbg-showpos-legend', null,
      h('span.is-speed', null, 'velocidade'), h('span.is-cap', null, 'teto'), h('span.is-threshold', null, 'limiar'),
      h('span.is-inaccuracy', null, 'inaccuracy'), h('span.is-air', null, 'no ar'));
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
   * @param {import('./strafeMeter.js').StrafeMeter} [meter] placar e marcas do counter-strafe
   */
  update(pawn, meter = null, now = performance.now()) {
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
    ];
    if (meter) {
      lines.push(
        `strafe ${strafeLine(meter, STRAFE_KIND.COUNTER)}`,
        `       ${strafeLine(meter, STRAFE_KIND.RELEASE)}`,
      );
    }
    this.text.textContent = lines.join('\n');
    this.graph.draw(pawn.telemetry, meter);
  }

  dispose() {
    this.el.remove();
  }
}
```

Em `styles/debug.css`, trocar:

```
/* cl_showpos (Fase 3): pés, velocidade e chão do jogador no canto superior direito. Largura fixa na da linha mais
   longa (60 caracteres), para o painel não pular de linha quando o texto muda; em tela menor que isso as linhas
   quebram. */
```

por:

```
/* cl_showpos (Fase 3): jogador, item na mão, teto, precisão, passos e counter-strafe no canto superior direito, com o
   gráfico dos últimos 4 s embaixo. Largura fixa na da linha mais longa (76 caracteres), para o painel não pular de
   linha quando o texto muda; em tela menor que isso as linhas quebram e o gráfico encolhe junto. */
```

Em `styles/debug.css`, trocar:

```
  width: min(100%, calc(60ch + 18px));
```

por:

```
  width: min(100%, calc(76ch + 18px));
```

Em `styles/debug.css`, trocar:

```
  background: rgb(42 35 32 / 0.78);
  color: var(--paper);
  font: 600 11.5px/1.45 var(--font-mono);
  white-space: pre-wrap;
  text-shadow: 0 1px 0 #000;
  font-variant-numeric: tabular-nums;
  pointer-events: none !important;
```

por:

```
  background: rgb(42 35 32 / 0.78);
  color: var(--paper);
  font: 600 11.5px/1.45 var(--font-mono);
  text-shadow: 0 1px 0 #000;
  font-variant-numeric: tabular-nums;
  pointer-events: none !important;
```

Em `styles/debug.css`, trocar:

```
  font-variant-numeric: tabular-nums;
  pointer-events: none !important;
}

```

por:

```
  font-variant-numeric: tabular-nums;
  pointer-events: none !important;
}

.dbg-showpos-text { margin: 0; font: inherit; white-space: pre-wrap; }

.dbg-showpos-graph {
  display: block;
  max-width: 100%;
  height: auto;
  margin-top: 5px;
  border-radius: 3px;
  background: rgb(21 16 14 / 0.55);
}

/* Legenda do gráfico: um traço na cor de cada série (o limiar tracejado, como no gráfico). */
.dbg-showpos-legend { display: flex; flex-wrap: wrap; gap: 2px 12px; margin-top: 3px; font-size: 10.5px; }
.dbg-showpos-legend span::before {
  content: '';
  display: inline-block;
  width: 12px;
  margin-right: 5px;
  border-top: 2px solid currentColor;
  vertical-align: middle;
}
.dbg-showpos-legend .is-speed { color: var(--clay-yellow); }
.dbg-showpos-legend .is-cap { color: rgb(246 240 228 / 0.75); }
.dbg-showpos-legend .is-threshold { color: var(--ct-teal); }
.dbg-showpos-legend .is-threshold::before { border-top-style: dashed; }
.dbg-showpos-legend .is-inaccuracy { color: var(--alert); }
.dbg-showpos-legend .is-air { color: #7FA6DB; }
.dbg-showpos-legend .is-air::before { border-top-width: 3px; border-top-color: var(--ct-blue); }

```

- [ ] **Passo 3: Comandos**

Em `src/debug/movementCommands.js`, trocar:

```
// do jogador e câmera em terceira pessoa. Falam com as mesmas variáveis e chaves de config que o jogo usa.
```

por:

```
// do jogador, medidas de counter-strafe e câmera em terceira pessoa. Falam com as mesmas variáveis, chaves de config e
// o mesmo medidor que o jogo usa.
```

Em `src/debug/movementCommands.js`, trocar:

```
  toggle('cl_showpos', 'debug.showPos', 'posição, velocidade e chão do jogador');
  reg({
```

por:

```
  toggle('cl_showpos', 'debug.showPos', 'jogador, item na mão, teto, precisão, passos e counter-strafe (com gráfico)');
  reg({
    name: 'cl_strafe_reset',
    help: 'zera as medidas de counter-strafe do cl_showpos',
    run: () => {
      const meter = s.states.name === 'match' ? s.states.current?.strafe : null;
      if (!meter) throw new Error('só numa partida andando (mapa com colisão)');
      meter.reset();
      return 'medidas de counter-strafe zeradas';
    },
  });
  reg({
```

Em `src/debug/commands.js`, trocar:

```
import { WEAPONS, resolveWeaponId } from '../data/weapons.js';
```

por:

```
import { BOMB, BOMB_ALIASES, WEAPONS, resolveWeaponId } from '../data/weapons.js';
```

Em `src/debug/commands.js`, trocar:

```
import { parseBinding } from '../input/bindings.js';
```

por:

```
import { parseBinding } from '../input/bindings.js';
import { itemName } from '../player/hands.js';
```

Em `src/debug/commands.js`, trocar:

```
    name: 'give', usage: '<arma|item>', help: 'dá uma arma (ak47, awp, deagle...) ou item (he, flash, kevlarHelmet...)',
    complete: () => [...Object.keys(WEAPONS), ...Object.keys(UTILITIES)],
```

por:

```
    name: 'give', usage: '<arma|item|bomba>',
    help: 'dá uma arma (ak47, awp, deagle...), item (he, flash, kevlarHelmet...) ou a bomba',
    complete: () => [...Object.keys(WEAPONS), ...Object.keys(UTILITIES), 'bomba'],
```

Em `src/debug/commands.js`, trocar:

```
      let res;
      let label;
```

por:

```
      const bomb = !wid && !uid && BOMB_ALIASES.includes(String(name).toLowerCase());
      let res;
      let label;
      let received;
```

Em `src/debug/commands.js`, trocar:

```
        label = WEAPONS[wid].name;
```

por:

```
        label = WEAPONS[wid].name;
        received = { kind: 'weapon', id: wid, slot: res.slot };
```

Em `src/debug/commands.js`, trocar:

```
        label = UTILITIES[uid].name;
```

por:

```
        label = UTILITIES[uid].name;
        received = { kind: 'utility', id: uid, slot: res.slot };
      } else if (bomb) {
        res = loadout.giveBomb({ ignoreTeam: true });
        label = BOMB.name;
        received = { kind: 'bomb', id: BOMB.id, slot: 'c4' };
```

Em `src/debug/commands.js`, trocar:

```
      s.events.emit(EV.LOADOUT, { owner: 'local', loadout: loadout.toJSON() });
```

por:

```
      s.events.emit(EV.LOADOUT, { owner: 'local', loadout: loadout.toJSON(), received });
```

Em `src/debug/commands.js`, trocar:

```
  reg({ name: 'loadout', help: 'mostra o inventário do jogador local', run: () => s.localLoadout.describe() });
```

por:

```
  reg({
    name: 'loadout', help: 'mostra o inventário do jogador local e o item na mão',
    run: () => {
      const hands = matchState()?.player?.hands;
      return `${s.localLoadout.describe()}${hands ? `\nna mão: ${itemName(hands.item)}` : ''}`;
    },
  });
```

- [ ] **Passo 4: Sintaxe e suíte**

Run: `node --check src/debug/speedGraph.js && node --check src/debug/showPos.js && node --check src/debug/commands.js && npm test`
Expected: sem erro de sintaxe; todos os testes passando.

- [ ] **Passo 5: Commit (só quando o usuário pedir)**

```bash
git add src/debug styles/debug.css
git commit -m "feat(fase-3.2): cl_showpos com gráfico e counter-strafe, give bomba" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Tarefa 11: Integração na partida (matchState)

**Files:**
- Modify: `src/modes/matchState.js`

- [ ] **Passo 1: Inventário no pawn, medidor, sensibilidade da luneta, trincos e HUD**

Em `src/modes/matchState.js`, trocar:

```
// anda com a cápsula (PlayerPawn, Fase 3); sem colisão (vitrine) voa com a câmera livre.
// Responsável por: montar/desmontar o mapa (sem vazar GPU), jogador e câmera, contexto de entrada, pointer lock,
// pausa, volta ao spawn ao cair do set, ferramentas de debug da física e o resumo que vai para a tela de resultado.
```

por:

```
// anda com a cápsula (PlayerPawn, Fase 3) e o inventário local; sem colisão (vitrine) voa com a câmera livre.
// Responsável por: montar/desmontar o mapa (sem vazar GPU), jogador e câmera, contexto de entrada, pointer lock,
// pausa, volta ao spawn ao cair do set, sensibilidade da luneta, trincos do andar, ferramentas de debug da física e do
// movimento (medidor de counter-strafe) e o resumo que vai para a tela de resultado.
```

Em `src/modes/matchState.js`, trocar:

```
import { PhysicsDebugView } from '../debug/physicsDebug.js';
import { ShowPosPanel } from '../debug/showPos.js';
```

por:

```
import { itemName, zoomLevels } from '../player/hands.js';
import { PhysicsDebugView } from '../debug/physicsDebug.js';
import { ShowPosPanel } from '../debug/showPos.js';
import { StrafeMeter } from '../debug/strafeMeter.js';
```

Em `src/modes/matchState.js`, trocar:

```
    this.showPos = null;
    this.hud = null;
```

por:

```
    this.showPos = null;
    this.strafe = null; // medidor de counter-strafe (cl_showpos)
    this.hud = null;
```

Em `src/modes/matchState.js`, trocar:

```
        world: this.map.collision, sv: s.sv, events: s.events, position: sp.position, yaw: sp.yaw, pitch: sp.pitch,
```

por:

```
        world: this.map.collision, sv: s.sv, loadout: s.localLoadout, events: s.events,
        position: sp.position, yaw: sp.yaw, pitch: sp.pitch,
```

Em `src/modes/matchState.js`, trocar:

```
      this.showPos = new ShowPosPanel(s.debugRoot);
```

por:

```
      this.showPos = new ShowPosPanel(s.debugRoot);
      this.strafe = new StrafeMeter(s.loop.stepDt);
```

Em `src/modes/matchState.js`, trocar:

```
      this.hud.setPromptVisible(device === 'kbm' && !s.input.pointerLocked && !this.paused);
    });

```

por:

```
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
    }

```

Em `src/modes/matchState.js`, trocar:

```
    this.paused = false;
    s.input.setContext(CONTEXT.GAME);
```

por:

```
    this.paused = false;
    s.input.resetToggles();
    s.input.setContext(CONTEXT.GAME);
```

Em `src/modes/matchState.js`, trocar:

```

  async #lock() {
```

por:

```

  /** Etiqueta "na mão" do HUD de teste: item, velocidade no modo atual e nível da luneta. */
  #syncHeld() {
    const p = this.player;
    if (!(p instanceof PlayerPawn)) return;
    const levels = zoomLevels(p.hands.item);
    const zoom = levels ? ` · luneta ${p.hands.zoom}/${levels}` : '';
    this.hud.setHeld(`na mão: ${itemName(p.hands.item)} · ${p.held.speed} u/s${zoom}`);
  }

  async #lock() {
```

Em `src/modes/matchState.js`, trocar:

```
    this.player.tick(dt, this.s.input, { noclip: this.s.cheats.noclip, tick: tickIndex });
```

por:

```
    this.player.tick(dt, this.s.input, { noclip: this.s.cheats.noclip, tick: tickIndex });
    if (this.player instanceof PlayerPawn) {
      this.strafe.updateFrom(this.player.telemetry);
      // Luneta: a sensibilidade do olhar do próximo quadro segue o nível de zoom deste tick.
      this.s.input.lookScale = this.player.lookScale(this.s.config.get('controls.zoomSensitivity'));
    }
```

Em `src/modes/matchState.js`, trocar:

```
    this.showPos?.update(this.player);
```

por:

```
    this.showPos?.update(this.player, this.strafe);
    if (this.player instanceof PlayerPawn) this.hud.setWalking(!this.s.cheats.noclip && this.s.input.isDown('walk'));
```

Em `src/modes/matchState.js`, trocar:

```
    s.input.setContext(CONTEXT.UI);
    this._popCursorNav?.();
```

por:

```
    s.input.setContext(CONTEXT.UI);
    s.input.resetToggles();
    s.input.lookScale = 1;
    this._popCursorNav?.();
```

Em `src/modes/matchState.js`, trocar:

```
    this.showPos = null;
    this.camera = null;
```

por:

```
    this.showPos = null;
    this.strafe = null;
    this.camera = null;
```

- [ ] **Passo 2: Sintaxe e suíte**

Run: `node --check src/modes/matchState.js && npm test`
Expected: sem erro de sintaxe; 166 testes passando.

- [ ] **Passo 3: Commit (só quando o usuário pedir)**

```bash
git add src/modes/matchState.js
git commit -m "feat(fase-3.2): partida com item na mão, luneta, medidor e andar alternável" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Tarefa 12: Verificação no navegador

O painel de preview costuma rodar a poucos quadros por segundo; o loop limita a 8 ticks por quadro, então a simulação fica mais lenta que o relógio. Por isso as medidas abaixo esperam **ticks**, não milissegundos. Sem pointer lock (o preview não o concede a scripts), a entrada de teclado é dirigida pelo próprio `KeyboardMouse` do jogo — o caminho do `InputManager` é o mesmo de uma tecla real.

- [ ] **Passo 1:** `preview_start` com `massacre-dev` (ou `massacre-dev-auto` se a 5173 estiver ocupada); `resize_window` 1280 × 720; pelo `javascript_tool`: `massacre.console.execute('map testroom')`.
- [ ] **Passo 2:** ajudante de entrada e ticks (colar no `javascript_tool`):

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

- [ ] **Passo 3: Item na mão e troca** — `give ak47` → após 2 ticks `pawn().hands.item === 'ak47'` e a etiqueta "na mão: AK-47 · 215 u/s" ao lado do título; `give awp`, `give bomba`, `give flash`, `give he`; `__t.tap('key:Digit3')` → faca; `k.wheelDown = 1` → flash, de novo → HE; `Digit4` → flash; `Digit5` → bomba (250 u/s); `KeyQ` → flash; `k.wheelUp = 1` → faca. `loadout` no console mostra "na mão: Faca".
- [ ] **Passo 4: Luneta** — AWP na mão (`Digit1`): `__t.tap('mouse:2')` → nível 1, `camera.userData.zoom` = tan 20° (0,36397), `m.input.lookScale` = 40/90, etiqueta "AWP · 100 u/s · luneta 1/2"; depois de 20 ticks, de novo → nível 2 (tan 5° = 0,087489; 10/90); de novo → 0 (zoom 1, `lookScale` 1).
- [ ] **Passo 5: cl_showpos e counter-strafe** — `cl_showpos 1`; AK na mão; `__t.hold('key:KeyD')`, 100 ticks, soltar D e segurar A por 8 ticks, soltar, 40 ticks; depois D por 100 ticks e soltar, 30 ticks. `m.states.current.strafe.scores`: contra 5 ticks (78 ms), soltar 13 ticks (203 ms). Captura de tela: painel com as linhas novas, o gráfico (faixa preciso × impreciso, teto, limiar tracejado, velocidade, inaccuracy) e as marcas "78 ms" e "203 ms".
- [ ] **Passo 6: Andar, agachar, pulo** — AK: Shift + S por 60 ticks → 111,8 u/s, `state.walking`, "ANDANDO" sob a mira, passo silencioso; Ctrl por 20 ticks → agachado, olho a 46; Espaço → 1 pulo, pouso a 285,5 u/s audível.
- [ ] **Passo 7: Configurações** — pausa → Configurações: aba Teclas com "Andar silencioso (teclado)" (Segurar), Controle com "(controle)" e Toque com "(toque)" (Alternar). Escolher Alternar no teclado, fechar, voltar ao jogo: um toque de Shift liga o andar ("ANDANDO"), continua ligado sem segurar, outro toque desliga; voltar para Segurar.
- [ ] **Passo 8: Toque** — `debug.touchGuides` ligado: o botão "Andar" aparece entre "Próxima" e "Agachar" sem encostar neles; o layout da config está na versão 2.
- [ ] **Passo 9: Memória e ouvintes** — menu ↔ sala 3×: `renderer.info.memory` (geometrias, texturas) e `renderer.info.programs.length` voltam ao valor do menu; `.dbg-showpos` some; `m.input.lookScale === 1`; no menu, `m.events.emit('player:weapon', {})`, `'player:zoom'` e `'loadout:change'` devolvem 0 ouvintes.
- [ ] **Passo 10: Vitrine** — `map vitrine`: câmera livre, sem etiqueta "na mão" nem "ANDANDO", sem erros.
- [ ] **Passo 11:** `read_console_messages` sem erros do jogo (o aviso `X4122 … double precision` do compilador de shader do Direct3D sobre constantes do próprio three.js é conhecido e não é do jogo); `resize_window` de volta para `desktop`.

---

### Tarefa 13: Documentação e memória

- [ ] **Passo 1:** `docs/PROGRESS.md` — subfase 3.2 dentro da seção da Fase 3: arquivos criados e alterados, como testar (console e teclas), os números medidos (tabela da seção "Números" acima e os do navegador), checklist de aceite marcado e o que vem na 3.3.
- [ ] **Passo 2:** `docs/phases/phase-3.md` — 3.2 ✅ com a data na tabela de estado; checklist de aceite da 3.2 marcado; em "Arquivos" da 3.2, `src/data/actions.js` entra na lista de alterados (os modos do trinco ficam lá).
- [ ] **Passo 3:** memória do projeto (`massacre-game-project.md`): 3.2 pronta (sem commit, junto com a 3.1), próxima 3.3 (pista de testes).
- [ ] **Passo 4:** encerrar pedindo um chat novo para a 3.3.

