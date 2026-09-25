// Detecção de hardware no primeiro acesso: identifica GPU/dispositivo, recomenda um preset e roda um
// micro-benchmark curto (cena de estresse fora da tela) para confirmar. O resultado fica em IndexedDB (store "meta")
// e só é refeito se a GPU mudar.

import * as THREE from 'three';
import { GPU_RULES, TIER_TO_PRESET, BENCHMARK_THRESHOLDS } from '../data/gpuTiers.js';
import { PRESET_IDS } from '../data/qualityPresets.js';
import { nextFrame } from '../core/frame.js';

/**
 * Nome legível da GPU a partir do texto do WebGL.
 * "ANGLE (Intel, Intel(R) Iris(R) Xe Graphics (0x0000A7A1) Direct3D11 vs_5_0 ps_5_0, D3D11)" → "Intel Iris Xe Graphics"
 */
export function prettyGpuName(renderer) {
  let s = String(renderer ?? '').trim();
  const angle = /^ANGLE \((.*)\)$/.exec(s);
  if (angle) {
    const parts = splitTopLevel(angle[1]);
    s = parts.length >= 2 ? parts[1] : parts[0];
  }
  // Firefox arredonda para uma GPU "parecida"; o Chrome no Mac usa o backend Metal do ANGLE;
  // no Linux/Android o ANGLE sobre Vulkan embrulha o nome ("Vulkan 1.3.242 (NVIDIA GeForce ...)").
  s = s.replace(/,\s*or similar$/i, '').replace(/^ANGLE Metal Renderer:\s*/i, '');
  const vulkan = /^Vulkan [\d.]+ \((.*)\)$/i.exec(s);
  if (vulkan) s = vulkan[1];
  return s
    .replace(/\((R|TM|tm|r)\)/g, '')
    .replace(/\(0x[0-9a-f]+\)/gi, '')
    .replace(/^Mesa\s+/i, '')
    .replace(/\s*(Direct3D1\d|OpenGL|Metal|Vulkan).*$/i, '')
    .replace(/\s+/g, ' ')
    .trim() || 'GPU desconhecida';
}

/** Divide por vírgulas só no nível zero de parênteses ("A, B (x, y), C" → ["A", "B (x, y)", "C"]). */
function splitTopLevel(str) {
  const parts = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < str.length; i++) {
    const c = str[i];
    if (c === '(') depth++;
    else if (c === ')') depth = Math.max(0, depth - 1);
    else if (c === ',' && depth === 0) {
      parts.push(str.slice(start, i).trim());
      start = i + 1;
    }
  }
  parts.push(str.slice(start).trim());
  return parts;
}

export function detectHardware(gl) {
  const dbg = gl.getExtension('WEBGL_debug_renderer_info');
  const vendor = String((dbg && gl.getParameter(dbg.UNMASKED_VENDOR_WEBGL)) || gl.getParameter(gl.VENDOR) || '');
  const renderer = String((dbg && gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL)) || gl.getParameter(gl.RENDERER) || '');
  const name = prettyGpuName(renderer);
  const nav = globalThis.navigator ?? {};
  const ua = nav.userAgent ?? '';
  const iPadOS = /Macintosh/.test(ua) && (nav.maxTouchPoints ?? 0) > 1;
  const mobile = nav.userAgentData?.mobile ?? (/Android|iPhone|iPad|iPod|Mobile/i.test(ua) || iPadOS);
  const coarse = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
  const touch = (nav.maxTouchPoints ?? 0) > 0 || coarse;

  const rule = GPU_RULES.find((r) => r.match.test(name) || r.match.test(renderer));
  let cls = rule?.cls ?? 'unknown';
  const tier = rule?.tier ?? 1;
  if (mobile) cls = cls === 'software' ? 'software' : 'mobile';

  return {
    vendor,
    renderer,
    name,
    cls,
    tier,
    mobile,
    touch,
    cores: nav.hardwareConcurrency ?? 4,
    memoryGB: nav.deviceMemory ?? null,
    dpr: globalThis.devicePixelRatio ?? 1,
    screen: { w: globalThis.screen?.width ?? 0, h: globalThis.screen?.height ?? 0 },
    maxTextureSize: gl.getParameter(gl.MAX_TEXTURE_SIZE),
    maxSamples: gl.getParameter(gl.MAX_SAMPLES),
    floatRT: !!gl.getExtension('EXT_color_buffer_float'),
    timerQuery: !!gl.getExtension('EXT_disjoint_timer_query_webgl2'),
    recommended: TIER_TO_PRESET[cls][tier],
  };
}

function buildStressScene() {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(60, 16 / 9, 1, 5000);
  camera.position.set(0, 300, 900);
  camera.lookAt(0, 0, 0);
  const light = new THREE.DirectionalLight(0xffffff, 3);
  light.position.set(300, 800, 400);
  light.castShadow = true;
  light.shadow.mapSize.set(2048, 2048);
  Object.assign(light.shadow.camera, { left: -800, right: 800, top: 800, bottom: -800 });
  light.shadow.radius = 4;
  scene.add(light, new THREE.HemisphereLight(0xffffff, 0x444444, 1));
  // ~400 objetos de 320 triângulos + chão: ordem de grandeza de um quadro de combate com bonecos e props.
  const geo = new THREE.IcosahedronGeometry(20, 2);
  const mat = new THREE.MeshPhysicalMaterial({ color: 0xc8553d, roughness: 0.7, clearcoat: 0.3, clearcoatRoughness: 0.4 });
  const mesh = new THREE.InstancedMesh(geo, mat, 400);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  const m = new THREE.Matrix4();
  for (let i = 0; i < 400; i++) {
    m.makeTranslation(((i % 20) - 10) * 70, Math.sin(i) * 40, (Math.floor(i / 20) - 10) * 70);
    mesh.setMatrixAt(i, m);
  }
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(3000, 3000), new THREE.MeshStandardMaterial({ color: 0x2e6e4e }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -60;
  ground.receiveShadow = true;
  scene.add(mesh, ground);
  const dispose = () => {
    geo.dispose();
    mat.dispose();
    ground.geometry.dispose();
    ground.material.dispose();
    mesh.dispose();
    light.shadow.map?.dispose();
    light.dispose();
  };
  return { scene, camera, mesh, dispose };
}

/**
 * Micro-benchmark. Com timer de GPU: mede o custo real da GPU por quadro, sem travar a CPU esperando.
 * Sem timer: mede tempo de relógio forçando sincronização com readPixels de 1 pixel.
 * @returns {Promise<{ms:number, mode:'gpu'|'wall', preset:string}>}
 */
export async function runBenchmark(renderer, { frames = 16, warmup = 4 } = {}) {
  const gl = renderer.getContext();
  const ext = gl.getExtension('EXT_disjoint_timer_query_webgl2');
  // UnsignedByte: readPixels de 1 pixel funciona em qualquer WebGL2 (HalfFloat nem sempre é legível).
  const rt = new THREE.WebGLRenderTarget(1280, 720, { type: THREE.UnsignedByteType, samples: 0 });
  const { scene, camera, mesh, dispose } = buildStressScene();
  const prevTarget = renderer.getRenderTarget();
  const prevShadow = renderer.shadowMap.enabled;
  renderer.shadowMap.enabled = true;
  const draw = (i) => {
    mesh.rotation.y = i * 0.05;
    renderer.setRenderTarget(rt);
    renderer.render(scene, camera);
  };
  let ms;
  let mode;
  try {
    for (let i = 0; i < warmup; i++) draw(i); // compila shaders e aloca o shadow map
    if (ext) {
      mode = 'gpu';
      const queries = [];
      for (let i = 0; i < frames; i++) {
        const q = gl.createQuery();
        gl.beginQuery(ext.TIME_ELAPSED_EXT, q);
        draw(warmup + i);
        gl.endQuery(ext.TIME_ELAPSED_EXT);
        queries.push(q);
        if (i % 4 === 3) await nextFrame(); // deixa o navegador respirar sem forçar sincronização
      }
      const results = [];
      for (let tries = 0; tries < 120 && results.length < queries.length; tries++) {
        await nextFrame();
        if (gl.getParameter(ext.GPU_DISJOINT_EXT)) break;
        for (const q of queries) {
          if (q.done) continue;
          if (gl.getQueryParameter(q, gl.QUERY_RESULT_AVAILABLE)) {
            results.push(gl.getQueryParameter(q, gl.QUERY_RESULT) / 1e6);
            q.done = true;
          }
        }
      }
      for (const q of queries) gl.deleteQuery(q);
      if (results.length >= frames / 2) {
        results.sort((a, b) => a - b);
        ms = results[Math.floor(results.length / 2)]; // mediana: ignora picos do sistema
      }
    }
    if (ms === undefined) {
      mode = 'wall';
      const px = new Uint8Array(4);
      renderer.readRenderTargetPixels(rt, 0, 0, 1, 1, px);
      const t0 = performance.now();
      for (let i = 0; i < frames; i++) {
        draw(warmup + i);
        renderer.readRenderTargetPixels(rt, 0, 0, 1, 1, px);
      }
      ms = (performance.now() - t0) / frames;
    }
  } finally {
    renderer.setRenderTarget(prevTarget);
    renderer.shadowMap.enabled = prevShadow;
    rt.dispose();
    dispose();
  }
  const preset = BENCHMARK_THRESHOLDS[mode].find((t) => ms <= t.maxMs).preset;
  return { ms, mode, preset };
}

/** Combina a recomendação por GPU com o benchmark: fica com a mais conservadora (GPU desconhecida: vale o benchmark). */
export function choosePreset(hw, bench) {
  if (!bench) return hw.recommended;
  if (hw.cls === 'unknown') return bench.preset;
  const a = PRESET_IDS.indexOf(hw.recommended);
  const b = PRESET_IDS.indexOf(bench.preset);
  return PRESET_IDS[Math.min(a, b)];
}
