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
