// Movimento na colisão real da pista de testes (subfase 3.3): o jogador do jogo (playerMove com a faca, 64 tick) prova
// os números de cada estação — escadas de 8/12/16/18 u sobem andando e as de 20/24 não; rampas de 15/30/44° sobem e as
// de 46/60° escorregam; o pulo em pé alcança 57 e não 58, o pulo agachado alcança 64 e 66 e não 67 nem 72; portais
// 73/72 em pé e 55/54 agachado; no túnel não levanta nas caixas de 60 u e levanta na de 96; vão de 33 u passa e de 31
// não; de pé na viga de 4 u; pouso em cada prancha da torre na altura exata; roteiro que sobe a espiral até a prancha.
// Subfase 3.4: o poço exige as 4 paredes (com 3 não sai); o zigue-zague passa com a faca e com a AK e um pulo sozinho
// não; o slide na largada passa sob as quatro traves e em pé bate na primeira; as pranchas da torre dão 0, 0, ~26, ~62
// de dano e a de 1310 mata.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PISTA } from '../src/data/pista.js';
import { CONTROLLER } from '../src/data/movement.js';
import { createSvVars } from '../src/player/movementVars.js';
import { buildPistaLayout } from '../src/maps/pista/layout.js';
import { buildPistaColliders } from '../src/maps/pista/colliders.js';
import { headingDir, headingOf } from '../src/maps/pista/pieces.js';
import { CollisionWorld } from '../src/physics/collisionWorld.js';
import { resolveStations } from '../src/maps/stations.js';
import { BTN } from '../src/player/moveCmd.js';
import { DT, forward, idle, makePlayer, run } from './playerTestUtils.js';

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
