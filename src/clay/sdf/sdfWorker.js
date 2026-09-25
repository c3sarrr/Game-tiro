// Worker de módulo que transforma árvores SDF em malha fora da thread principal (o quadro nunca espera o
// marching cubes). Protocolo:
//   entrada  {id, tree, resolution, maxCells, touchRadius?}
//   saída    {id, positions, normals, indices, mat, seam, touch, groups, stats} — buffers TRANSFERIDOS (sem cópia)
//   erro     {id, error} (árvore inválida, NaN no campo...)
// Workers não enxergam o import map da página: aqui só entram caminhos relativos para módulos sem imports "nus"
// (nodes.js → params/shapes/bounds/noise → ../../core/rng.js; marchingCubes.js → mcTables.js).

import { bounds, compile } from './nodes.js';
import { polygonize } from './marchingCubes.js';

const now = () => (globalThis.performance?.now ? globalThis.performance.now() : Date.now());

function build(msg) {
  const t0 = now();
  const sdf = compile(msg.tree);
  const mesh = polygonize(sdf, bounds(msg.tree), {
    resolution: msg.resolution,
    maxCells: msg.maxCells,
    touchRadius: msg.touchRadius,
  });
  mesh.stats.ms = now() - t0; // tempo total no Worker (validação + compilação + malha)
  return mesh;
}

self.addEventListener('message', (event) => {
  const msg = event.data;
  const id = msg?.id ?? null;
  try {
    if (!msg || typeof msg !== 'object' || !msg.tree) throw new Error('mensagem sem árvore SDF');
    const mesh = build(msg);
    const { positions, normals, indices, mat, seam, touch } = mesh;
    self.postMessage(
      { id, positions, normals, indices, mat, seam, touch, groups: mesh.groups, stats: mesh.stats },
      [positions.buffer, normals.buffer, indices.buffer, mat.buffer, seam.buffer, touch.buffer],
    );
  } catch (err) {
    self.postMessage({ id, error: err instanceof Error ? err.message : String(err) });
  }
});

// Mensagem que não pôde ser desserializada: avisa quem estava esperando (o pool sabe qual pedido está aqui).
self.addEventListener('messageerror', () => {
  self.postMessage({ id: null, error: 'a mensagem enviada ao Worker de SDF não pôde ser lida (structured clone)' });
});
