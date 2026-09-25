// Servidor estático de desenvolvimento do MASSACRE — zero dependências.
// Uso: node tools/dev-server.mjs [porta] [--lan] [--isolated]   (ou `npm run dev` / `npm run dev:lan`)
// - Por padrão escuta só em 127.0.0.1 (a pasta do projeto não fica exposta na rede).
//   `--lan` abre para a rede local (testar no celular e com amigos na mesma Wi-Fi).
// - Serve a raiz do projeto com MIME types corretos (inclui .wasm e .mjs); só GET/HEAD.
// - Nunca serve arquivos/pastas ocultos (.claude, .git, .env...) nem node_modules.
// - Desliga cache para que cada reload pegue o módulo mais recente.
// - Envia COOP/COEP opcionais (--isolated) caso algum recurso precise de SharedArrayBuffer.

import { createServer } from 'node:http';
import { realpathSync } from 'node:fs';
import { stat, readFile, realpath } from 'node:fs/promises';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { networkInterfaces } from 'node:os';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
// Forma canônica da raiz (maiúsculas/links resolvidos) para comparar com o realpath dos arquivos.
const ROOT_REAL = realpathSync(ROOT);
const args = process.argv.slice(2);
const PORT = Number(args.find((a) => /^\d+$/.test(a)) ?? process.env.PORT ?? 5173);
const ISOLATED = args.includes('--isolated');
const LAN = args.includes('--lan');
const HOST = LAN ? '0.0.0.0' : '127.0.0.1';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.wasm': 'application/wasm',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.woff2': 'font/woff2',
};

const TEXT = { 'Content-Type': 'text/plain; charset=utf-8' };

function send(res, code, body, headers = {}) {
  res.writeHead(code, { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...headers });
  res.end(body);
}

/** Caminho proibido: qualquer segmento oculto (".algo") ou node_modules. */
function forbiddenPath(relPath) {
  return relPath.split(/[\\/]+/).some((seg) => seg.startsWith('.') || seg === 'node_modules');
}

const inside = (abs, root = ROOT) => abs === root || abs.startsWith(root + sep);

const server = createServer(async (req, res) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, 'método não permitido', { ...TEXT, Allow: 'GET, HEAD' });
  let path;
  try {
    path = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  } catch {
    return send(res, 400, 'URL inválida', TEXT);
  }
  try {
    if (path.includes('\0') || forbiddenPath(path)) return send(res, 403, 'proibido', TEXT);
    // Bloqueia travessia de diretório.
    const abs = normalize(join(ROOT, path));
    if (!inside(abs)) return send(res, 403, 'proibido', TEXT);

    let file = abs;
    let info = await stat(file).catch(() => null);
    if (info && info.isDirectory()) {
      file = join(file, 'index.html');
      info = await stat(file).catch(() => null);
    }
    if (!info || !info.isFile()) return send(res, 404, `404 — ${path}`, TEXT);
    // Links simbólicos não podem apontar para fora do projeto.
    const real = await realpath(file);
    if (!inside(real, ROOT_REAL) || forbiddenPath(real.slice(ROOT_REAL.length))) return send(res, 403, 'proibido', TEXT);

    const headers = { 'Content-Type': MIME[extname(file).toLowerCase()] || 'application/octet-stream' };
    if (ISOLATED) {
      headers['Cross-Origin-Opener-Policy'] = 'same-origin';
      headers['Cross-Origin-Embedder-Policy'] = 'require-corp';
    }
    const data = await readFile(real);
    send(res, 200, req.method === 'HEAD' ? undefined : data, headers);
  } catch (err) {
    // O detalhe do erro fica só no terminal: quem acessa pela rede não vê caminhos do disco.
    console.error(`[dev-server] ${req.method} ${path}:`, err);
    send(res, 500, 'erro interno do servidor de desenvolvimento', TEXT);
  }
});

server.listen(PORT, HOST, () => {
  console.log(`MASSACRE dev server → http://localhost:${PORT}/`);
  if (LAN) {
    const lan = Object.values(networkInterfaces()).flat()
      .filter((n) => n && n.family === 'IPv4' && !n.internal).map((n) => n.address);
    for (const ip of lan) console.log(`  rede local (celular/amigos na mesma Wi-Fi) → http://${ip}:${PORT}/`);
  } else {
    console.log('  só nesta máquina (use `npm run dev:lan` para abrir na rede local)');
  }
  if (ISOLATED) console.log('  (COOP/COEP ativos)');
});
