// Parâmetros da sala de testes (Fase 1): câmera FPS livre numa sala vazia.
// Unidades: 1 unidade = 1 cm na escala do boneco (o boneco tem ~72 unidades de altura).

export const TEST_ROOM = Object.freeze({
  width: 1600, // X
  depth: 1600, // Z
  height: 520, // Y
  spawn: Object.freeze({ x: 0, y: 64, z: 560, yawDeg: 0, pitchDeg: -4 }),
  scaleMarkerHeight: 72, // "boneco" de referência para conferir a escala
});

export const FREE_CAMERA = Object.freeze({
  speed: 420, // u/s voando
  walkFactor: 0.52, // Shift: mesma proporção do andar silencioso do CS
  boostFactor: 2.4, // segurar "mirar" acelera (útil para atravessar mapas grandes em noclip)
  verticalSpeed: 320,
  accelerate: 10, // sv_accelerate
  friction: 8, // sv_friction
  stopSpeed: 60,
  radius: 16, // raio de colisão com as paredes (noclip desligado)
});
