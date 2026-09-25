// Lotes da pista de testes: as peças estáticas de um mesmo material vão para um THREE.BatchedMesh — geometrias
// diferentes num só desenho, com matriz, cor e corte de visão por peça (o encanamento de espaço do objeto dos
// materiais já trata USE_BATCHING). O BatchedMesh exige o mesmo conjunto de atributos e índice em todas as geometrias:
// o construtor completa o que falta com valores padrão (por lote) e indexa quem não tem índice.

import * as THREE from 'three';

const _color = new THREE.Color();

/** Geometria indexada (índice sequencial se não tiver). */
function ensureIndex(geo) {
  if (!geo.index) {
    const n = geo.attributes.position.count;
    const idx = n > 65535 ? new Uint32Array(n) : new Uint16Array(n);
    for (let i = 0; i < n; i++) idx[i] = i;
    geo.setIndex(new THREE.BufferAttribute(idx, 1));
  }
  return geo;
}

/** Atributo constante (o valor padrão do lote para uma geometria que não tem o atributo). */
function fillAttribute(geo, name, values) {
  const n = geo.attributes.position.count;
  const arr = new Float32Array(n * values.length);
  for (let i = 0; i < n; i++) arr.set(values, i * values.length);
  geo.setAttribute(name, new THREE.BufferAttribute(arr, values.length));
}

export class BatchBuilder {
  constructor() {
    /** @type {Map<string, {material:THREE.Material, castShadow:boolean, receiveShadow:boolean, defaults:object, entries:Array}>} */
    this.groups = new Map();
  }

  /**
   * Declara um lote. `defaults` = { atributo: [valores] } usados em geometrias sem o atributo (os demais faltantes
   * viram zeros); `name` aparece no inspetor.
   */
  define(key, { material, castShadow = true, receiveShadow = true, defaults = {}, name = key }) {
    if (this.groups.has(key)) throw new Error(`lote repetido na pista: ${key}`);
    this.groups.set(key, { material, castShadow, receiveShadow, defaults, name, entries: [] });
    return this;
  }

  has(key) {
    return this.groups.has(key);
  }

  /**
   * Uma peça no lote. A mesma geometria em várias peças é enviada uma vez (instâncias). `color` = THREE.Color, hex ou
   * [r, g, b] (multiplica o material; sem cor, branco).
   */
  add(key, geometry, matrix, color = null) {
    const g = this.groups.get(key);
    if (!g) throw new Error(`lote desconhecido na pista: ${key}`);
    g.entries.push({ geometry, matrix: matrix.clone(), color });
  }

  /**
   * Monta os BatchedMesh e põe no `parent`. As geometrias de origem são liberadas (o lote copiou os dados).
   * @returns {{meshes:THREE.BatchedMesh[], draws:number, triangles:number, instances:number}}
   */
  build(parent) {
    const meshes = [];
    let triangles = 0;
    let instances = 0;
    for (const [key, g] of this.groups) {
      if (!g.entries.length) continue;
      const unique = [...new Set(g.entries.map((e) => e.geometry))];
      // Conjunto de atributos do lote: a união (tamanho do item do primeiro que tiver).
      const sizes = new Map();
      for (const geo of unique) {
        for (const [name, attr] of Object.entries(geo.attributes)) if (!sizes.has(name)) sizes.set(name, attr.itemSize);
      }
      let vertices = 0;
      let indices = 0;
      for (const geo of unique) {
        ensureIndex(geo);
        for (const [name, size] of sizes) {
          if (!geo.attributes[name]) fillAttribute(geo, name, g.defaults[name] ?? new Array(size).fill(0));
          else if (geo.attributes[name].itemSize !== size) throw new Error(`atributo ${name} com tamanho diferente no lote ${key}`);
          if (geo.attributes[name].normalized) throw new Error(`atributo ${name} normalizado no lote ${key}`);
        }
        vertices += geo.attributes.position.count;
        indices += geo.index.count;
      }
      const mesh = new THREE.BatchedMesh(g.entries.length, vertices, indices, g.material);
      mesh.name = `pista-${g.name}`;
      mesh.castShadow = g.castShadow;
      mesh.receiveShadow = g.receiveShadow;
      const ids = new Map(unique.map((geo) => [geo, mesh.addGeometry(geo)]));
      const colored = g.entries.some((e) => e.color !== null);
      for (const e of g.entries) {
        const id = mesh.addInstance(ids.get(e.geometry));
        mesh.setMatrixAt(id, e.matrix);
        if (colored) {
          if (e.color === null) _color.setRGB(1, 1, 1);
          else if (Array.isArray(e.color)) _color.setRGB(e.color[0], e.color[1], e.color[2]);
          else _color.set(e.color);
          mesh.setColorAt(id, _color);
        }
        triangles += e.geometry.index.count / 3;
      }
      instances += g.entries.length;
      mesh.computeBoundingBox();
      mesh.computeBoundingSphere();
      for (const geo of unique) geo.dispose();
      g.entries = [];
      parent.add(mesh);
      meshes.push(mesh);
    }
    return { meshes, draws: meshes.length, triangles, instances };
  }
}
