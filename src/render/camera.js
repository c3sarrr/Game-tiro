// Câmera FPS: FOV configurado como horizontal em 16:9 (padrão de FPS competitivo) e aplicado como "Hor+":
// o FOV vertical fica fixo e telas mais largas ganham visão lateral (ultrawide) em vez de cortar em cima/baixo.
// Zoom de luneta multiplica a tangente do FOV (mantém a perspectiva correta).

import * as THREE from 'three';

export const REFERENCE_ASPECT = 16 / 9;
export const NEAR = 2; // 2 cm na escala do boneco
export const FAR = 60000;

const DEG = Math.PI / 180;

/** FOV vertical (graus) equivalente a um FOV horizontal (graus) no aspecto de referência. */
export function verticalFovFromHorizontal(hDeg, aspect = REFERENCE_ASPECT) {
  return (2 * Math.atan(Math.tan((hDeg * DEG) / 2) / aspect)) / DEG;
}

/** FOV horizontal (graus) visto de fato num aspecto qualquer, dado o FOV vertical. */
export function horizontalFovFromVertical(vDeg, aspect) {
  return (2 * Math.atan(Math.tan((vDeg * DEG) / 2) * aspect)) / DEG;
}

export function createFpsCamera({ hfov = 100, aspect = REFERENCE_ASPECT, near = NEAR, far = FAR } = {}) {
  const camera = new THREE.PerspectiveCamera(verticalFovFromHorizontal(hfov), aspect, near, far);
  camera.rotation.order = 'YXZ'; // yaw depois pitch: sem roll acidental
  camera.userData.hfov = hfov;
  camera.userData.zoom = 1;
  return camera;
}

/** Aplica FOV horizontal (16:9) e zoom (1 = sem zoom; 0,4 = luneta 2,5x). */
export function setCameraFov(camera, hfov = camera.userData.hfov, zoom = camera.userData.zoom ?? 1) {
  camera.userData.hfov = hfov;
  camera.userData.zoom = zoom;
  const v = verticalFovFromHorizontal(hfov) * DEG;
  camera.fov = (2 * Math.atan(Math.tan(v / 2) * zoom)) / DEG;
  camera.updateProjectionMatrix();
}

export function setCameraAspect(camera, aspect) {
  camera.aspect = aspect;
  camera.updateProjectionMatrix();
}
