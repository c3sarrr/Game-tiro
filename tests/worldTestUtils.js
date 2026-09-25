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
