// Copia as bibliotecas fixadas de node_modules para /vendor (servidas localmente, sem CDN em runtime).
// Uso: npm install && npm run vendor
// Mantém /vendor reproduzível: versões vêm do package.json (fixas, sem ^/~) e ficam registradas em vendor/VERSIONS.json.

import { cp, mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const NM = join(ROOT, 'node_modules');
const OUT = join(ROOT, 'vendor');

// Pastas de three/addons que o jogo usa (pós-processamento, shaders, utilitários de geometria,
// ambientes de estúdio, luzes de área, CSM, LOD/simplificação, linhas de debug, curvas).
const THREE_ADDON_DIRS = [
  'postprocessing', 'shaders', 'math', 'utils', 'geometries', 'environments', 'capabilities',
  'lights', 'csm', 'modifiers', 'lines', 'objects', 'curves', 'helpers', 'misc', 'textures',
];
// Nada de loaders/tsl/webxr/inspector: o MASSACRE é 100% procedural e roda em WebGL2.
const EXCLUDE_FILES = new Set(['capabilities/WebGPU.js']);

async function exists(p) { return !!(await stat(p).catch(() => null)); }

async function walk(dir) {
  const out = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...await walk(p));
    else out.push(p);
  }
  return out;
}

// Garante o fechamento transitivo de imports relativos (ex.: '../libs/xxx.js').
async function closeImports(srcBase, dstBase) {
  const pending = (await walk(dstBase)).filter((f) => f.endsWith('.js'));
  const seen = new Set(pending);
  let added = 0;
  while (pending.length) {
    const file = pending.pop();
    const code = await readFile(file, 'utf8');
    const re = /(?:import|export)\s[^'"]*?from\s*['"](\.{1,2}\/[^'"]+)['"]|import\(\s*['"](\.{1,2}\/[^'"]+)['"]\s*\)/g;
    let m;
    while ((m = re.exec(code))) {
      const spec = m[1] || m[2];
      const target = resolve(dirname(file), spec);
      if (seen.has(target)) continue;
      seen.add(target);
      if (await exists(target)) continue;
      const src = join(srcBase, relative(dstBase, target));
      if (!(await exists(src))) throw new Error(`Import não resolvido: ${spec} em ${relative(ROOT, file)}`);
      await mkdir(dirname(target), { recursive: true });
      await cp(src, target);
      pending.push(target);
      added++;
    }
  }
  return added;
}

async function pkgVersion(name) {
  return JSON.parse(await readFile(join(NM, name, 'package.json'), 'utf8')).version;
}

async function main() {
  const rootPkg = JSON.parse(await readFile(join(ROOT, 'package.json'), 'utf8'));
  for (const [name, range] of Object.entries(rootPkg.devDependencies)) {
    if (/[\^~*]/.test(range)) throw new Error(`${name} precisa de versão fixa (está "${range}")`);
    const v = await pkgVersion(name);
    if (v !== range) throw new Error(`${name}: package.json pede ${range} mas node_modules tem ${v} — rode npm install`);
  }

  await rm(OUT, { recursive: true, force: true });

  // three
  const threeSrc = join(NM, 'three');
  const threeOut = join(OUT, 'three');
  await mkdir(join(threeOut, 'build'), { recursive: true });
  for (const f of ['three.module.js', 'three.core.js']) await cp(join(threeSrc, 'build', f), join(threeOut, 'build', f));
  await cp(join(threeSrc, 'LICENSE'), join(threeOut, 'LICENSE'));
  const addonsSrc = join(threeSrc, 'examples', 'jsm');
  const addonsOut = join(threeOut, 'examples', 'jsm');
  for (const d of THREE_ADDON_DIRS) {
    await cp(join(addonsSrc, d), join(addonsOut, d), {
      recursive: true,
      filter: (src) => !EXCLUDE_FILES.has(relative(addonsSrc, src).replaceAll('\\', '/')),
    });
  }
  const extra = await closeImports(addonsSrc, addonsOut);

  // three-mesh-bvh (ESM de arquivo único, importa apenas 'three')
  const bvhOut = join(OUT, 'three-mesh-bvh');
  await mkdir(bvhOut, { recursive: true });
  await cp(join(NM, 'three-mesh-bvh', 'build', 'index.module.js'), join(bvhOut, 'index.module.js'));
  await cp(join(NM, 'three-mesh-bvh', 'LICENSE'), join(bvhOut, 'LICENSE'));

  // peerjs (bundle UMD autocontido) + wrapper ESM com carregamento sob demanda
  const peerOut = join(OUT, 'peerjs');
  await mkdir(peerOut, { recursive: true });
  await cp(join(NM, 'peerjs', 'dist', 'peerjs.min.js'), join(peerOut, 'peerjs.min.js'));
  await cp(join(NM, 'peerjs', 'LICENSE'), join(peerOut, 'LICENSE'));
  await writeFile(join(peerOut, 'peerjs.esm.js'), `// Wrapper ESM gerado por tools/vendor.mjs — PeerJS ${await pkgVersion('peerjs')}.
// O bundle oficial é UMD (define window.Peer). Carregamos sob demanda para não pesar o modo solo.
let pending = null;
export function loadPeerJS() {
  if (typeof window !== 'undefined' && window.Peer) return Promise.resolve(window.Peer);
  if (!pending) {
    pending = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = new URL('./peerjs.min.js', import.meta.url).href;
      s.async = true;
      s.onload = () => (window.Peer ? resolve(window.Peer) : reject(new Error('PeerJS carregou sem expor window.Peer')));
      s.onerror = () => { pending = null; reject(new Error('Falha ao carregar /vendor/peerjs/peerjs.min.js')); };
      document.head.appendChild(s);
    });
  }
  return pending;
}
export default loadPeerJS;
`);

  const versions = {
    three: await pkgVersion('three'),
    'three-mesh-bvh': await pkgVersion('three-mesh-bvh'),
    peerjs: await pkgVersion('peerjs'),
    generatedBy: 'tools/vendor.mjs',
  };
  await writeFile(join(OUT, 'VERSIONS.json'), JSON.stringify(versions, null, 2) + '\n');
  console.log('vendor/ atualizado:', versions, `(+${extra} arquivos puxados por imports relativos)`);
}

main().catch((err) => { console.error(err); process.exit(1); });
