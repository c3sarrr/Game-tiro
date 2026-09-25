// Pista de testes (subfase 3.3; desenho em docs/phases/phase-3.md, seção 3.3; referências no item 11 do moodboard):
// parque de doze estações num compensado de 5,6 × 4 m no chão do estúdio, cada uma provando um número do movimento com
// objetos de verdade na escala do boneco. A partir do mesmo layout puro (layout.js) monta a colisão (colliders.js), as
// estações do console `estacao` (a altura dos pés sai de um raio na colisão), o visual (visual/) e a montagem de luz
// `pista` (key alta com a única sombra, fill, rim e as luzes práticas da praça e do túnel). Nada na pista se mexe: a
// sombra é feita uma vez (staticShadows).

import * as THREE from 'three';
import { PISTA } from '../../data/pista.js';
import { STUDIO_RIGS } from '../../data/studioRigs.js';
import { EV } from '../../core/events.js';
import { registerMap } from '../registry.js';
import { groundAt, resolveStations } from '../stations.js';
import { StudioRig } from '../../render/studio/studioRig.js';
import { disposeObject3D } from '../../render/dispose.js';
import { CollisionWorld } from '../../physics/collisionWorld.js';
import { buildPistaLayout } from './layout.js';
import { buildPistaColliders } from './colliders.js';
import { buildPistaVisuals } from './visual/index.js';

const DEG = Math.PI / 180;

async function build({ render, config, services }) {
  const set = services.set;
  const scene = new THREE.Scene();
  scene.name = 'pista';
  // Ar do estúdio: névoa quente bem leve (a base inteira fica nítida; o fundo cai para o escuro).
  scene.fog = new THREE.FogExp2(new THREE.Color(PISTA.fog.color), PISTA.fog.density);

  const layout = buildPistaLayout(PISTA);
  const collision = CollisionWorld.fromBuilder(buildPistaColliders(layout), 'pista-de-testes');
  let visuals = null;
  let rig = null;
  try {
    const stations = resolveStations(layout.stations, collision);
    const sp = layout.spawn;
    const spawnY = groundAt(collision, sp.x, sp.z);
    if (spawnY === null) throw new Error('spawn da pista sem chão');

    visuals = buildPistaVisuals({ layout, set, anisotropy: render.anisotropy });
    scene.add(visuals.group);
    services.log?.info(`pista: ${visuals.stats.draws} desenhos estáticos, ${Math.round(visuals.stats.triangles)} triângulos, `
      + `${collision.triangleCount} triângulos de colisão`);

    const rigDef = STUDIO_RIGS.pista;
    rig = new StudioRig({
      def: rigDef, set, renderer: render.renderer, tableY: 0, floorY: null, center: new THREE.Vector3(0, 60, 0),
    }).build(scene);
    rig.setDustDensity(config.get('graphics.particles'));
    const offs = [
      services.events.on(EV.POSE, ({ pose }) => rig.onPose(pose)),
      config.watch('graphics.particles', (e) => rig.setDustDensity(e.value)),
      // GPU reiniciada: o mapa de ambiente assado (reflexo das softboxes) se perdeu com ela.
      services.events.on(EV.RENDER_CONTEXT, ({ lost }) => {
        if (!lost) rig.bakeEnvironment();
      }),
    ];

    const B = PISTA.base;
    const bounds = new THREE.Box3(
      new THREE.Vector3(B.minX, -B.thickness, B.minZ),
      new THREE.Vector3(B.maxX, PISTA.tower.tube.height + 200, B.maxZ),
    );
    return {
      id: 'pista',
      scene,
      bounds,
      rig,
      collision,
      stations,
      layout,
      stats: visuals.stats,
      post: { context: 'jogo', exposure: rigDef.exposure },
      staticShadows: true,
      spawn: {
        position: new THREE.Vector3(sp.x, spawnY, sp.z),
        yaw: -sp.heading * DEG,
        pitch: sp.pitch * DEG,
      },
      frame(dt, camera) {
        rig.frame(camera, render.drawingHeight);
      },
      dispose() {
        for (const off of offs) off();
        rig.dispose();
        visuals.dispose();
      },
    };
  } catch (err) {
    // Montagem pela metade: o matchState não recebe o mapa, então a GPU e a colisão saem aqui.
    rig?.dispose();
    visuals?.dispose();
    collision.dispose();
    disposeObject3D(scene);
    throw err;
  }
}

registerMap({
  id: 'pista',
  label: 'Pista de testes',
  description: '12 estações nos números do movimento: counter-strafe, escadas, rampas, caixas, wall-jump, slide, '
    + 'torre de queda, bhop, vigas, paredes finas, túnel e placas de massinha. Console: estacao.',
  kind: 'teste',
  aliases: ['treino', 'parque', 'obstaculos'],
  build,
});
