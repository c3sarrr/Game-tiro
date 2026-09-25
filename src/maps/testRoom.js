// Sala de testes: câmera FPS livre numa sala vazia para validar loop, entrada, câmera e renderização.
// Mesmo sendo cena técnica, usa o look de estúdio definitivo da Fase 2 (docs/art/moodboard.md):
//  - chão de tapete de corte com grade de 1 cm (SMD3; prova de escala PLA2/PLA14);
//  - paredes de papelão ondulado cortado à mão (SSD4, SSD8) presas com tiras de fita crepe (SSD2, SSD14);
//  - montagem de luz 'testroom' (src/data/studioRigs.js): key de tungstênio em softbox com sombra suave, fill
//    frio, rim de fresnel, poeira no feixe da key e ambiente com o reflexo das softboxes (CSD14, SSD14, SMD13);
//  - boneco de referência de 72 u em massinha (a medida do mundo) e dois objetos do set perto do spawn para
//    conferir o AO de contato, o reflexo das softboxes e a profundidade de campo.

import * as THREE from 'three';
import { TEST_ROOM } from '../data/sandbox.js';
import { STUDIO_RIGS } from '../data/studioRigs.js';
import { PALETTE } from '../data/palette.js';
import { EV } from '../core/events.js';
import { registerMap } from './registry.js';
import { StudioRig } from '../render/studio/studioRig.js';
import { cardboardPanel } from '../clay/set/boardGeometry.js';
import { clayPot, sculptTool, tapeStrip } from '../clay/set/propGeometry.js';
import { scaleMarker } from '../clay/kit/scaleMarker.js';

const DEG = Math.PI / 180;
const WALL_THICKNESS = 4; // papelão de caixa grossa: 4 mm

async function build({ render, config, services }) {
  const { width, depth, height, spawn } = TEST_ROOM;
  const set = services.set;
  const scene = new THREE.Scene();
  scene.name = 'testroom';
  // Ar do estúdio: névoa quente bem leve (a luz cai fora da ilha iluminada, SSD1/CSD14).
  scene.fog = new THREE.FogExp2(0x1b1411, 0.00012);

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(width, depth), set.cuttingMat({ size: [width, depth] }));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  floor.name = 'tapete-de-corte';
  scene.add(floor);

  const board = set.cardboard();
  const tape = set.tape({ width: 46 });
  const walls = [
    { w: width, x: 0, z: -depth / 2, ry: 0 },
    { w: width, x: 0, z: depth / 2, ry: Math.PI },
    { w: depth, x: -width / 2, z: 0, ry: Math.PI / 2 },
    { w: depth, x: width / 2, z: 0, ry: -Math.PI / 2 },
  ];
  walls.forEach((wall, i) => {
    const mesh = new THREE.Mesh(cardboardPanel(wall.w, height, WALL_THICKNESS, { fluteAxis: 'y', seed: `parede-${i}` }), board);
    mesh.position.set(wall.x, height / 2, wall.z);
    mesh.rotation.y = wall.ry;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.name = 'parede-papelao';
    scene.add(mesh);
    // Duas tiras de fita crepe perto do topo, tortas como coladas à mão (moodboard SSD2/SSD14).
    const off = WALL_THICKNESS / 2 + 0.6;
    [-0.35, 0.35].forEach((t, k) => {
      const strip = new THREE.Mesh(tapeStrip(140, 46, { seed: `parede-${i}-${k}`, lift: k === 1 ? 3 : 0 }), tape);
      const along = t * wall.w;
      strip.position.set(
        wall.x + Math.cos(wall.ry) * along + Math.sin(wall.ry) * off,
        height - 60,
        wall.z - Math.sin(wall.ry) * along + Math.cos(wall.ry) * off,
      );
      strip.rotation.set(0, wall.ry, (t > 0 ? 1 : -1) * 4 * DEG);
      strip.receiveShadow = true;
      strip.name = 'fita-crepe';
      scene.add(strip);
    });
  });

  const marker = scaleMarker(TEST_ROOM.scaleMarkerHeight);
  scene.add(marker);

  // Pote de massinha (prédio da escala do boneco) e espátula de modelar deitada no tapete.
  const pot = clayPot({ radius: 55, height: 62 });
  const potGroup = new THREE.Group();
  potGroup.name = 'pote-de-massinha';
  const tub = new THREE.Mesh(pot.tub, set.plastic({ color: PALETTE.clayYellow, moldY: pot.moldY, name: 'pote-amarelo' }));
  const lid = new THREE.Mesh(pot.lid, set.plastic({ color: PALETTE.blue, moldY: 1e4, name: 'tampa-azul' }));
  // Tampa em pé, encostada na lateral do pote com a saia virada para ele (inclinada 10° para trás).
  lid.rotation.set(0, 0, 80 * DEG);
  lid.position.set(-66, 57, 0);
  potGroup.add(tub, lid);
  potGroup.position.set(-160, 0, 290);
  scene.add(potGroup);
  const tool = sculptTool('espatula', { length: 160 });
  const toolGroup = new THREE.Group();
  toolGroup.name = 'espatula-de-modelar';
  toolGroup.add(new THREE.Mesh(tool.handle, set.benchWood()), new THREE.Mesh(tool.metal, set.toolMetal()));
  toolGroup.position.set(110, 4.3, 340);
  toolGroup.rotation.set(0, 28 * DEG, 0);
  scene.add(toolGroup);
  for (const obj of [potGroup, toolGroup]) {
    obj.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
      }
    });
  }

  // Luz de estúdio: key/fill/rim com equipamento visível pendurado na grelha, poeira e ambiente.
  const rigDef = STUDIO_RIGS.testroom;
  const rig = new StudioRig({
    def: rigDef, set, renderer: render.renderer, tableY: 0, floorY: null, center: new THREE.Vector3(0, 120, 0),
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

  const bounds = new THREE.Box3(
    new THREE.Vector3(-width / 2, 0, -depth / 2),
    new THREE.Vector3(width / 2, height, depth / 2),
  );

  return {
    id: 'testroom',
    scene,
    bounds,
    rig,
    post: { context: 'jogo', exposure: rigDef.exposure },
    spawn: {
      position: new THREE.Vector3(spawn.x, spawn.y, spawn.z),
      yaw: spawn.yawDeg * DEG,
      pitch: spawn.pitchDeg * DEG,
    },
    frame(dt, camera) {
      rig.frame(camera, render.drawingHeight);
    },
    dispose() {
      for (const off of offs) off();
      rig.dispose();
    },
  };
}

registerMap({
  id: 'testroom',
  label: 'Sala de testes',
  description: 'Câmera FPS livre numa sala de papelão com a luz de estúdio: loop, entrada e renderização.',
  kind: 'teste',
  aliases: ['teste', 'sala'],
  build,
});
