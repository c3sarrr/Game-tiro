// Parâmetros da sala de testes e do modo livre (Fases 1 e 3): sala de papelão andável, volta ao spawn ao cair do set
// e a câmera livre (voo da vitrine e noclip).
// Unidades: 1 unidade = 1 cm na escala do boneco (o boneco tem ~72 unidades de altura).

export const TEST_ROOM = Object.freeze({
  width: 1600, // X
  depth: 1600, // Z
  height: 520, // Y
  spawn: Object.freeze({ x: 0, y: 0, z: 560, yawDeg: 0, pitchDeg: -4 }), // pés do jogador (o olho fica 64 u acima)
  scaleMarkerHeight: 72, // "boneco" de referência para conferir a escala
  wallCollider: 6.4, // espessura de colisão das paredes: papelão de 4 u + empeno de até 1,1 u em cada face
  floorSlab: 8, // laje de colisão sob o tapete
});

/** Modo livre em mapa andável. */
export const SANDBOX = Object.freeze({
  fallOutDepth: 1500, // caiu mais que isto (u) abaixo do chão do mapa (noclip desligado fora do set): volta ao spawn
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
