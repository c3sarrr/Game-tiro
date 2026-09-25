// Gera src/clay/sdf/mcTables.js a partir das tabelas clássicas do marching cubes que já vêm com o three.js
// (vendor/three/examples/jsm/objects/MarchingCubes.js). Nada é digitado à mão: o script lê o arquivo do vendor,
// extrai `edgeTable` (256 máscaras de arestas) e `triTable` (256 × 16 índices de arestas, terminados em -1),
// valida a consistência entre as duas e escreve o módulo.
// Uso: node tools/extract-mc-tables.mjs   (rode de novo após `npm run vendor` se o three mudar de versão)

import { readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const SRC = join(ROOT, 'vendor', 'three', 'examples', 'jsm', 'objects', 'MarchingCubes.js');
const OUT = join(ROOT, 'src', 'clay', 'sdf', 'mcTables.js');

function extractArray(source, name) {
  const re = new RegExp(`const\\s+${name}\\s*=\\s*new\\s+Int32Array\\s*\\(\\s*\\[([\\s\\S]*?)\\]\\s*\\)`);
  const m = re.exec(source);
  if (!m) throw new Error(`tabela '${name}' não encontrada em ${SRC}`);
  return m[1]
    .split(',')
    .map((s) => s.replace(/\s+/g, ''))
    .filter((s) => s.length > 0)
    .map((s) => {
      const v = Number(s);
      if (!Number.isInteger(v)) throw new Error(`valor inválido em '${name}': ${s}`);
      return v;
    });
}

function validate(edgeTable, triTable) {
  if (edgeTable.length !== 256) throw new Error(`edgeTable deveria ter 256 entradas, tem ${edgeTable.length}`);
  if (triTable.length !== 256 * 16) throw new Error(`triTable deveria ter 4096 entradas, tem ${triTable.length}`);
  for (let c = 0; c < 256; c++) {
    let mask = 0;
    let i = 0;
    while (i < 16 && triTable[c * 16 + i] !== -1) {
      const e = triTable[c * 16 + i];
      if (e < 0 || e > 11) throw new Error(`caso ${c}: aresta fora da faixa (${e})`);
      mask |= 1 << e;
      i++;
    }
    if (i % 3 !== 0) throw new Error(`caso ${c}: ${i} índices não formam triângulos`);
    for (; i < 16; i++) if (triTable[c * 16 + i] !== -1) throw new Error(`caso ${c}: lixo depois do terminador`);
    // Toda aresta usada pelos triângulos precisa estar marcada na edgeTable (e vice-versa).
    if (mask !== edgeTable[c]) throw new Error(`caso ${c}: edgeTable 0x${edgeTable[c].toString(16)} ≠ arestas usadas 0x${mask.toString(16)}`);
  }
}

function formatRows(values, perRow, fmt) {
  const rows = [];
  for (let i = 0; i < values.length; i += perRow) rows.push(`  ${values.slice(i, i + perRow).map(fmt).join(', ')},`);
  return rows.join('\n');
}

const source = await readFile(SRC, 'utf8');
const edgeTable = extractArray(source, 'edgeTable');
const triTable = extractArray(source, 'triTable');
validate(edgeTable, triTable);
const revision = /REVISION\s*=\s*'(\d+)'/.exec(await readFile(join(ROOT, 'vendor', 'three', 'build', 'three.core.js'), 'utf8').catch(() => ''))?.[1] ?? '?';

const out = `// Tabelas clássicas do marching cubes (Paul Bourke, "Polygonising a scalar field", que as recebeu de
// Cory Gene Bloyd), exatamente como distribuídas com o three.js r${revision} (licença MIT) em
// vendor/three/examples/jsm/objects/MarchingCubes.js. ARQUIVO GERADO por tools/extract-mc-tables.mjs — não edite à mão.
//
// Convenção (a mesma do three.js): cantos do cubo 0:(0,0,0) 1:(1,0,0) 2:(1,1,0) 3:(0,1,0) 4:(0,0,1) 5:(1,0,1)
// 6:(1,1,1) 7:(0,1,1); arestas 0:0-1 1:1-2 2:2-3 3:3-0 4:4-5 5:5-6 6:6-7 7:7-4 8:0-4 9:1-5 10:2-6 11:3-7.
// O bit i do índice do cubo marca o canto i "abaixo do isovalor"; os triângulos saem virados para esses cantos.
// Em src/clay/sdf/marchingCubes.js o bit marca o canto FORA da massa (d > 0), então as faces saem no sentido
// anti-horário vistas de fora (faces da frente no three.js).

/** Máscara de 12 bits das arestas cortadas pela superfície, por configuração de cantos (256). */
export const edgeTable = new Int32Array([
${formatRows(edgeTable, 8, (v) => `0x${v.toString(16)}`)}
]);

/** Até 5 triângulos por configuração: 16 índices de aresta por caso, terminados em -1 (256 × 16). */
export const triTable = new Int32Array([
${formatRows(triTable, 16, (v) => String(v))}
]);
`;

await writeFile(OUT, out, 'utf8');
console.log(`mcTables.js gerado: ${edgeTable.length} máscaras, ${triTable.length / 16} casos (three r${revision}) → ${OUT}`);
