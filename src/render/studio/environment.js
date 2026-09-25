// Mapa de ambiente do estúdio (IBL): uma "sala" escura com o rebote quente da mesa embaixo e painéis
// emissivos onde estão as softboxes/fresnéis da montagem. Assado com PMREMGenerator.fromScene uma vez por
// montagem de luz: dá o rebote suave em todos os materiais e, principalmente, o reflexo RETANGULAR das
// softboxes na massinha úmida (clearcoat) e no metal — a assinatura de foto de estúdio (SSD14, CSD14).

import * as THREE from 'three';

/**
 * @param {THREE.WebGLRenderer} renderer
 * @param {object} def rig.environment (walls, floor, background, panels)
 * @param {Array<{id:string, position:THREE.Vector3, target:THREE.Vector3, color:THREE.Color, fixture:object}>} lights
 * @param {THREE.Vector3} center ponto de onde o ambiente é "fotografado" (centro da cena)
 * @returns {{texture: THREE.Texture, dispose(): void}}
 */
export function bakeStudioEnvironment(renderer, def, lights, center) {
  const scene = new THREE.Scene();
  const geos = [];
  const mats = [];
  const basic = (color, side = THREE.FrontSide) => {
    const m = new THREE.MeshBasicMaterial({ color, side, toneMapped: false });
    mats.push(m);
    return m;
  };
  // Sala: caixa grande escura em volta (paredes/teto do estúdio) e o chão/mesa quente embaixo.
  const room = new THREE.BoxGeometry(9000, 6000, 9000);
  geos.push(room);
  const walls = new THREE.Mesh(room, basic(new THREE.Color(def.walls), THREE.BackSide));
  walls.position.set(center.x, center.y + 2000, center.z);
  scene.add(walls);
  const floorGeo = new THREE.PlaneGeometry(9000, 9000);
  geos.push(floorGeo);
  const floor = new THREE.Mesh(floorGeo, basic(new THREE.Color(def.floor)));
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(center.x, center.y - 30, center.z);
  scene.add(floor);

  // Painéis das luzes: retângulo da softbox, disco do fresnel, bolinha da prática — na cor da luz.
  for (const panel of def.panels) {
    const light = lights.find((l) => l.id === panel.light);
    if (!light) continue;
    const f = light.fixture ?? {};
    let geo;
    if (f.kind === 'softbox') geo = new THREE.PlaneGeometry(f.width * panel.scale, f.height * panel.scale);
    else if (f.kind === 'fresnel') geo = new THREE.CircleGeometry(f.radius * panel.scale * 1.4, 32);
    else geo = new THREE.CircleGeometry(20 * panel.scale, 24);
    geos.push(geo);
    const color = light.color.clone().multiplyScalar(panel.strength);
    const mesh = new THREE.Mesh(geo, basic(color, THREE.DoubleSide));
    mesh.position.copy(light.position);
    mesh.lookAt(light.target);
    scene.add(mesh);
  }

  const pmrem = new THREE.PMREMGenerator(renderer);
  const target = pmrem.fromScene(scene, 0.02, 1, 20000, { size: 256, position: center });
  pmrem.dispose();
  for (const g of geos) g.dispose();
  for (const m of mats) m.dispose();
  return {
    texture: target.texture,
    dispose() {
      target.dispose();
    },
  };
}
