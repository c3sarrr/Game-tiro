// Libera GPU de uma hierarquia (geometrias, materiais e texturas) — usado ao trocar de mapa/partida
// para não vazar memória (verificável em renderer.info.memory).

const TEXTURE_KEYS = [
  'map', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap', 'bumpMap', 'emissiveMap', 'alphaMap',
  'displacementMap', 'lightMap', 'envMap', 'clearcoatMap', 'clearcoatNormalMap', 'clearcoatRoughnessMap',
  'sheenColorMap', 'sheenRoughnessMap', 'specularIntensityMap', 'specularColorMap', 'transmissionMap', 'thicknessMap',
];

export function disposeMaterial(material, seen = new Set()) {
  if (!material || seen.has(material)) return;
  seen.add(material);
  for (const key of TEXTURE_KEYS) {
    const tex = material[key];
    if (tex && !seen.has(tex)) {
      seen.add(tex);
      tex.dispose();
    }
  }
  if (material.uniforms) {
    for (const u of Object.values(material.uniforms)) {
      const v = u?.value;
      if (v && v.isTexture && !seen.has(v)) {
        seen.add(v);
        v.dispose();
      }
    }
  }
  material.dispose();
}

export function disposeObject3D(root) {
  const seen = new Set();
  root.traverse((obj) => {
    if (obj.geometry && !seen.has(obj.geometry)) {
      seen.add(obj.geometry);
      obj.geometry.dispose();
    }
    if (obj.material) {
      for (const m of Array.isArray(obj.material) ? obj.material : [obj.material]) disposeMaterial(m, seen);
    }
    if (obj.isLight && obj.shadow?.map) {
      obj.shadow.map.dispose();
      obj.shadow.map = null;
    }
    // Instâncias e lotes guardam texturas próprias (matrizes, cores, índices): o dispose deles libera essas também.
    if (obj.isInstancedMesh || obj.isBatchedMesh) obj.dispose();
  });
  root.removeFromParent();
}
