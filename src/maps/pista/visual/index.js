// Visual da pista de testes: monta, a partir do layout (as mesmas peças da colisão), tudo o que se vê — chão e papéis,
// livros, madeira, papelão, arte em canvas, planta, objetos de mesa e massinha. As peças estáticas de um mesmo material
// vão num BatchedMesh (batch.js); a base, o chão do estúdio, os tapetes de corte, o estojo da trena e a massinha são
// malhas próprias. Devolve o grupo, as contagens (draws e triângulos, para o aceite) e o dispose das texturas do mapa
// (os materiais são da biblioteca do set e saem em set.releaseMaterials()).

import * as THREE from 'three';
import { PISTA } from '../../../data/pista.js';
import { decalMaterial } from '../../../clay/set/printMaterials.js';
import { BatchBuilder } from './batch.js';
import { buildFloor } from './floor.js';
import { buildBooks } from './books.js';
import { buildWood } from './wood.js';
import { buildCardboard } from './cardboard.js';
import { buildArt } from './art.js';
import { bakePlan } from './plan.js';
import { buildExtras } from './extras.js';
import { buildClay } from './clayPlates.js';
import { constantAttribute } from './common.js';

/**
 * @param {{layout:object, set:import('../../../clay/set/index.js').SetLibrary, anisotropy?:number, data?:object}} opts
 * @returns {{group:THREE.Group, stats:object, dispose():void}}
 */
export function buildPistaVisuals({ layout, set, anisotropy = 8, data = PISTA }) {
  const group = new THREE.Group();
  group.name = 'pista';
  const batches = new BatchBuilder();
  const disposers = [];
  const F = data.look.fairy;
  batches
    .define('plywood', { material: set.plywood({ name: 'compensado' }) })
    .define('beech', { material: set.beech() })
    .define('balsa', { material: set.balsa() })
    .define('measure', { material: set.measure() })
    .define('paint', { material: set.paint() })
    .define('chrome', { material: set.chrome() })
    .define('cardboard', { material: set.cardboard() })
    .define('cardboardDouble', { material: set.cardboard({ double: true, name: 'papelao-parede-dupla' }) })
    .define('cardboardSingle', { material: set.cardboard({ singleFace: true, name: 'papelao-uma-face' }) })
    .define('paper', { material: set.paper(), castShadow: false })
    .define('bulbs', {
      material: set.diffuser({ color: F.bulb, emission: F.emission, hotspot: 0.25, seam: false, name: 'lampadinhas' }),
      castShadow: false, receiveShadow: false,
    });
  const ctx = { layout, data, set, batches, group, disposers, anisotropy };
  buildFloor(ctx);
  const books = buildBooks(ctx);
  const wood = buildWood(ctx);
  const cardboard = buildCardboard(ctx);
  // Arte: atlas do mapa e o lote dos decalques; a planta tem a textura dela (o papel inteiro).
  const art = buildArt(ctx);
  const plan = bakePlan(layout, data, { anisotropy });
  disposers.push(() => plan.dispose());
  batches.define('plan', { material: set.adopt('pista-planta', decalMaterial(set.textures, { atlas: plan.texture, name: 'planta-pista' })), castShadow: false });
  for (const d of layout.decor) {
    if (d.kind !== 'print') continue;
    const quad = new THREE.PlaneGeometry(d.size[0], d.size[1]);
    constantAttribute(quad, 'aDecalRect', [0, 0, 1, 1]);
    batches.add('plan', constantAttribute(quad, 'aDecalKind', [1]), d.matrix);
  }
  const extras = buildExtras(ctx);
  const clay = buildClay(ctx);
  const built = batches.build(group);
  // Malhas próprias (base, chão, tapetes, estojo, massinha) somam um desenho cada.
  let meshTriangles = 0;
  let meshes = 0;
  group.traverse((o) => {
    if (o.isMesh && !o.isBatchedMesh) {
      meshes++;
      meshTriangles += (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3;
    }
  });
  group.updateMatrixWorld(true);
  return {
    group,
    stats: {
      draws: built.draws + meshes,
      triangles: built.triangles + meshTriangles,
      instances: built.instances,
      books: books.books, spineCells: books.cells, beech: wood.beech, cardboard: cardboard.cardboard, decals: art.count,
      extras: extras.extras, plates: clay.plates, lumps: clay.lumps,
    },
    dispose() {
      for (const d of disposers) d();
      disposers.length = 0;
    },
  };
}
