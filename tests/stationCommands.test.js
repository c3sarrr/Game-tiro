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
