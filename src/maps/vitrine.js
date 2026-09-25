// Vitrine da Fase 2: a mesa do animador no meio do estúdio escuro com os 20 objetos de prova do look de
// estúdio (src/data/showcase.js), a montagem de luz `vitrine` (key de tungstênio em softbox, fill frio, rim em
// fresnel e a luminária de mesa, todos em tripés/na mesa), o contexto de pós `vitrine` (foto de produto de
// miniatura: foco médio) e o painel de fita crepe ao vivo (Tab) com a varredura automática de presets.
// É também o banco do aceite da Fase 2 (docs/phases/phase-2.md, "Aceite").

import * as THREE from 'three';
import { STUDIO_RIGS } from '../data/studioRigs.js';
import { SHOWCASE_SET } from '../data/showcase.js';
import { EV } from '../core/events.js';
import { registerMap } from './registry.js';
import { StudioRig } from '../render/studio/studioRig.js';
import { ShowcaseBench } from '../debug/showcase.js';
import { PresetSweep } from '../debug/presetSweep.js';
import { createShowcasePanel } from '../debug/showcasePanel.js';

const DEG = Math.PI / 180;

async function build({ render, config, services }) {
  const scene = new THREE.Scene();
  scene.name = 'vitrine';
  // Ar do estúdio: névoa quente bem leve; fora da ilha de luz tudo cai para o escuro (SSD1, CSD14).
  scene.fog = new THREE.FogExp2(0x160f0c, 0.0001);

  const bench = new ShowcaseBench({ set: services.set, sdf: services.sdf, anisotropy: render.anisotropy, log: services.log });
  await bench.build(scene);

  const rigDef = STUDIO_RIGS.vitrine;
  const rig = new StudioRig({
    def: rigDef, set: services.set, renderer: render.renderer, tableY: SHOWCASE_SET.mat.thickness,
    floorY: SHOWCASE_SET.floorY, center: new THREE.Vector3(0, 60, 0),
  }).build(scene);
  rig.setDustDensity(config.get('graphics.particles'));

  const sweep = new PresetSweep(services, { pose: SHOWCASE_SET.sweepPose });
  const panel = createShowcasePanel(services, {
    rig, bench, sweep,
    onClose: () => services.states.current?.setCursorMode?.(false),
  });

  const offs = [
    services.events.on(EV.POSE, ({ pose }) => rig.onPose(pose)),
    config.watch('graphics.particles', (e) => rig.setDustDensity(e.value)),
    // GPU reiniciada: o mapa de ambiente assado (reflexo das softboxes) se perdeu com ela.
    services.events.on(EV.RENDER_CONTEXT, ({ lost }) => {
      if (!lost) rig.bakeEnvironment();
    }),
  ];

  const { spawn, bounds } = SHOWCASE_SET;
  return {
    id: 'vitrine',
    scene,
    bounds: new THREE.Box3(new THREE.Vector3(...bounds.min), new THREE.Vector3(...bounds.max)),
    rig,
    bench,
    sweep,
    panel,
    move: { speedScale: SHOWCASE_SET.speedScale },
    post: { context: 'vitrine', exposure: rigDef.exposure },
    // Nada na mesa se move sozinho e o painel só muda intensidade/cor das luzes: a sombra é feita uma vez.
    staticShadows: true,
    spawn: {
      position: new THREE.Vector3(spawn.x, spawn.y, spawn.z),
      yaw: spawn.yawDeg * DEG,
      pitch: spawn.pitchDeg * DEG,
    },
    frame(dt, camera) {
      rig.frame(camera, render.drawingHeight);
      sweep.frame(dt);
    },
    dispose() {
      for (const off of offs) off();
      panel.dispose();
      rig.dispose();
      bench.dispose();
    },
  };
}

registerMap({
  id: 'vitrine',
  label: 'Vitrine de massinha',
  description: '20 objetos de massinha e do set na mesa do animador; luz e massa ajustáveis ao vivo (Tab) e varredura de presets.',
  kind: 'teste',
  aliases: ['showcase', 'mesa', 'bancada'],
  build,
});
