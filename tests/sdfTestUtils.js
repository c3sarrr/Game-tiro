// Utilitários dos testes do kit SDF (não é um arquivo de teste: não termina em .test.js).

/**
 * Relatório de uma malha indexada: arestas dirigidas (estanque = toda aresta aparece uma vez em cada sentido,
 * o que também garante orientação consistente), característica de Euler (V − A + F) e triângulos cujo
 * enrolamento discorda das normais dos vértices (CCW visto de fora).
 * @param {{positions: ArrayLike<number>, normals: ArrayLike<number>, indices: ArrayLike<number>}} mesh
 * @returns {{open:number, badWinding:number, chi:number, V:number, F:number}}
 */
export function meshReport(mesh) {
  const { positions: P, normals: N, indices: I } = mesh;
  const directed = new Map();
  const edge = (u, v) => u * 4294967296 + v;
  for (let t = 0; t < I.length; t += 3) {
    for (const [u, v] of [[I[t], I[t + 1]], [I[t + 1], I[t + 2]], [I[t + 2], I[t]]]) directed.set(edge(u, v), (directed.get(edge(u, v)) ?? 0) + 1);
  }
  let open = 0;
  for (const [key, count] of directed) {
    const u = Math.floor(key / 4294967296);
    const v = key % 4294967296;
    if (count !== 1 || directed.get(edge(v, u)) !== 1) open++;
  }
  let badWinding = 0;
  for (let t = 0; t < I.length; t += 3) {
    const a = I[t] * 3;
    const b = I[t + 1] * 3;
    const c = I[t + 2] * 3;
    const ux = P[b] - P[a], uy = P[b + 1] - P[a + 1], uz = P[b + 2] - P[a + 2];
    const vx = P[c] - P[a], vy = P[c + 1] - P[a + 1], vz = P[c + 2] - P[a + 2];
    const fx = uy * vz - uz * vy, fy = uz * vx - ux * vz, fz = ux * vy - uy * vx;
    if (Math.hypot(fx, fy, fz) < 1e-12) continue;
    const nx = N[a] + N[b] + N[c], ny = N[a + 1] + N[b + 1] + N[c + 1], nz = N[a + 2] + N[b + 2] + N[c + 2];
    if (fx * nx + fy * ny + fz * nz <= 0) badWinding++;
  }
  const V = P.length / 3;
  const F = I.length / 3;
  return { open, badWinding, chi: V - directed.size / 2 + F, V, F };
}
