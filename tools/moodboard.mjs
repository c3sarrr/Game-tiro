// Gera a folha de contato do moodboard (docs/art/moodboard.html) a partir de docs/art/pinterest-boards.json.
// Uso: node tools/moodboard.mjs
// Cada pin vira uma célula com o ID usado em docs/art/moodboard.md (prefixo do board + posição, ex.: FPC7).
// As imagens são exibidas direto do CDN do Pinterest (nada é baixado para o projeto). Na página:
//   ?inteira  → mostra cada foto inteira (object-fit: contain) em vez de recortada — bom para estudar detalhes;
//   ?grande   → 2 colunas (células maiores);  ?colunas=N&altura=PX → grade sob medida (estudo em telas estreitas);
//   #PREFIXO → pula para o board.

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const BOARDS_JSON = `${ROOT}docs/art/pinterest-boards.json`;
const OUT = `${ROOT}docs/art/moodboard.html`;

/** Boards na ordem da folha. `phase` = subfase em que o board entrou no estudo. */
const BOARDS = [
  { id: 'CSD', label: 'Claymation Set Design', url: 'https://www.pinterest.com/ideas/claymation-set-design/893621988359/', phase: '2.1' },
  { id: 'PLA', label: '3D Plasticine', url: 'https://www.pinterest.com/ideas/3d-plasticine/901418997915/', phase: '2.1' },
  { id: 'CIL', label: 'Clay Illustration', url: 'https://www.pinterest.com/ideas/clay-illustration/925869521463/', phase: '2.1' },
  { id: 'P3D', label: 'Plastic 3D Style (cokards)', url: 'https://www.pinterest.com/cokards/plastic-3d-style/', phase: '2.1' },
  { id: 'SSD', label: 'Stop Motion Set Design', url: 'https://www.pinterest.com/ideas/stop-motion-set-design/939142592219/', phase: '2.1' },
  { id: 'SSB', label: 'Stop Motion Set Building', url: 'https://www.pinterest.com/ideas/stop-motion-set-building/913501904960/', phase: '2.1' },
  { id: 'SMD', label: 'Stop Motion Desk', url: 'https://www.pinterest.com/ideas/stop-motion-desk/951357298077/', phase: '2.1' },
  { id: 'TSH', label: 'Tilt Shift', url: 'https://www.pinterest.com/ideas/tilt-shift/942751172933/', phase: '2.5' },
  { id: 'SMA', label: 'Stop Motion Aesthetic', url: 'https://www.pinterest.com/ideas/stop-motion-aesthetic/960919693804/', phase: '2.5' },
  { id: 'SML', label: 'Stop Motion Lighting', url: 'https://www.pinterest.com/mrrufus13/stop-motion-lighting/', phase: '2.5' },
  { id: 'BTS', label: 'Behind the Scenes — Stop Motion', url: 'https://www.pinterest.com/mrrufus13/behind-the-scenes-stop-motion/', phase: '2.5' },
  { id: 'CLT', label: 'Clay Texture', url: 'https://www.pinterest.com/ideas/clay-texture/918258762185/', phase: '2.6' },
  { id: 'FPC', label: 'Fingerprint in Clay', url: 'https://www.pinterest.com/ideas/fingerprint-in-clay/914205465062/', phase: '2.6' },
  { id: 'MPC', label: 'Marbled Polymer Clay', url: 'https://www.pinterest.com/ideas/marbled-polymer-clay/957722805947/', phase: '2.6' },
  { id: 'GPD', label: 'Glitter Playdough', url: 'https://www.pinterest.com/ideas/glitter-playdough/953828611932/', phase: '2.6' },
  { id: 'GDC', label: 'Glow in the Dark Clay', url: 'https://www.pinterest.com/ideas/glow-in-the-dark-clay/902744489574/', phase: '2.6' },
  { id: 'PDH', label: 'Play Doh', url: 'https://www.pinterest.com/ideas/play-doh/922980152283/', phase: '2.6' },
  { id: 'TRL', label: 'Tape Rolls', url: 'https://www.pinterest.com/ideas/tape-rolls/905317052557/', phase: '2.6' },
  { id: 'ARM', label: 'Stop Motion Armature', url: 'https://www.pinterest.com/ideas/stop-motion-armature/922526094853/', phase: '2.6' },
  { id: 'CLF', label: 'Claymation Figures', url: 'https://www.pinterest.com/ideas/claymation-figures/918006513492/', phase: '2.6' },
  { id: 'AAC', label: 'Aardman Characters', url: 'https://www.pinterest.com/ideas/aardman-characters/928944982599/', phase: '2.6' },
  { id: 'MFP', label: 'Miniature Food Photography Props', url: 'https://www.pinterest.com/ideas/miniature-food-photography-props/932796717606/', phase: '2.6' },
  { id: 'PLI', label: 'Plasticine Ideas', url: 'https://www.pinterest.com/ideas/plasticine-ideas/924839357923/', phase: '2.6' },
  { id: 'SMR', label: 'Stop Motion Rig', url: 'https://www.pinterest.com/ideas/stop-motion-rig/923657372951/', phase: '2.6' },
  { id: 'COC', label: 'Cardboard Obstacle Course', url: 'https://www.pinterest.com/ideas/cardboard-obstacle-course/959069167784/', phase: '3.3' },
  { id: 'CBT', label: 'Cardboard Box Tunnel', url: 'https://www.pinterest.com/ideas/cardboard-box-tunnel/958387563144/', phase: '3.3' },
  { id: 'CFO', label: 'Cardboard Fingerboard Obstacles', url: 'https://www.pinterest.com/ideas/cardboard-fingerboard-obstacles/914410744968/', phase: '3.3' },
  { id: 'CFR', label: 'Cardboard Fingerboard Ramps', url: 'https://www.pinterest.com/ideas/cardboard-fingerboard-ramps/948478168138/', phase: '3.3' },
  { id: 'BAS', label: 'Books As Stairs', url: 'https://www.pinterest.com/ideas/books-as-stairs/943259823545/', phase: '3.3' },
  { id: 'AWB', label: 'Architectural Wooden Building Blocks', url: 'https://www.pinterest.com/ideas/architectural-wooden-building-blocks/935841685680/', phase: '3.3' },
  { id: 'WRG', label: 'Wall Ruler Growth Charts', url: 'https://www.pinterest.com/ideas/wall-ruler-growth-charts/907164492834/', phase: '3.3' },
  { id: 'PKG', label: 'Parkour Gym', url: 'https://www.pinterest.com/ideas/parkour-gym/958718375641/', phase: '3.3' },
  { id: 'PKC', label: 'Parkour Course', url: 'https://www.pinterest.com/ideas/parkour-course/915062227603/', phase: '3.3' },
  { id: 'CFP', label: 'Clay Footprints', url: 'https://www.pinterest.com/ideas/clay-footprints/909576168004/', phase: '3.3' },
  { id: 'CIM', label: 'Clay Imprints', url: 'https://www.pinterest.com/ideas/clay-imprints/952443037456/', phase: '3.3' },
  { id: 'DFL', label: 'Desk Flatlay', url: 'https://www.pinterest.com/ideas/desk-flatlay/918272522219/', phase: '3.3' },
  { id: 'BWM', label: 'Balsa Wood Models', url: 'https://www.pinterest.com/ideas/balsa-wood-models/953315394598/', phase: '3.3' },
  { id: 'TMA', label: 'Tape Measure Aesthetic', url: 'https://www.pinterest.com/ideas/tape-measure-aesthetic/939157022954/', phase: '3.3' },
  { id: 'PRU', label: 'Pencil Ruler', url: 'https://www.pinterest.com/ideas/pencil-ruler/922061658246/', phase: '3.3' },
  { id: 'CMR', label: 'Cardboard Marble Run', url: 'https://www.pinterest.com/ideas/cardboard-marble-run/956681619018/', phase: '3.3' },
  { id: 'LDB', label: 'Level Design Grey/Whiteboxes & Blockouts (danejcustance)', url: 'https://www.pinterest.com/danejcustance/level-design-greywhiteboxes-blockouts/', phase: '3.3' },
];

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

const pins = JSON.parse(readFileSync(BOARDS_JSON, 'utf8'));
const known = new Set(BOARDS.map((b) => b.id));
const orphan = Object.keys(pins).filter((k) => !known.has(k));
if (orphan.length) throw new Error(`boards sem metadados em tools/moodboard.mjs: ${orphan.join(', ')}`);

const css = [
  'body{margin:0;background:#2A2320;font:14px system-ui,sans-serif;color:#F6F0E4}',
  'header{padding:16px}h1{margin:0 0 4px;font-size:22px}nav{margin-top:8px;display:flex;flex-wrap:wrap;gap:6px}',
  'nav a{color:#2A2320;background:#E8D9A8;border-radius:4px;padding:2px 6px;font-weight:700;text-decoration:none}',
  'h2{margin:18px 8px 6px;font-size:18px}h2 a{color:#FFD23F;font-size:12px;margin-left:8px}h2 small{color:#B98B5E;margin-left:8px;font-size:12px}',
  '.g{display:grid;grid-template-columns:repeat(var(--cols,4),1fr);gap:4px;padding:4px}',
  '.c{position:relative;height:var(--h,330px);background:#000;overflow:hidden}',
  '.c img{width:100%;height:100%;object-fit:cover;display:block}',
  '.inteira .c img{object-fit:contain}.grande{--cols:2}.grande .c{--h:560px}',
  '.c span{position:absolute;left:4px;top:4px;background:#FFD23F;color:#2A2320;font-weight:700;padding:2px 6px;font-size:16px;border-radius:4px}',
  '@media(max-width:700px){:root:not(.sob-medida) .g{grid-template-columns:repeat(2,1fr)}}',
].join('');

const parts = [];
parts.push('<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">');
parts.push(`<title>MASSACRE — Moodboard</title><style>${css}</style>`);
parts.push('<script>{const q=new URLSearchParams(location.search),r=document.documentElement;' +
  'for(const k of ["inteira","grande"])if(q.has(k))r.classList.add(k);' +
  'const n=Number(q.get("colunas")),h=Number(q.get("altura"));' +
  'if(n>0){r.style.setProperty("--cols",String(Math.min(8,Math.round(n))));r.classList.add("sob-medida")}' +
  'if(h>0)r.style.setProperty("--h",`${Math.min(1200,Math.round(h))}px`)}</script>');
parts.push('<header><h1>MASSACRE — Moodboard de referências (Pinterest)</h1>');
parts.push('<div>IDs usados em docs/art/moodboard.md. Imagens exibidas direto do CDN do Pinterest (nada é baixado para o projeto). ');
parts.push('Gerado por tools/moodboard.mjs · <code>?inteira</code> mostra as fotos sem recorte · <code>?grande</code> usa células maiores.</div>');
parts.push(`<nav>${BOARDS.filter((b) => pins[b.id]).map((b) => `<a href="#${b.id}">${b.id}</a>`).join('')}</nav></header>`);
let total = 0;
for (const b of BOARDS) {
  const list = pins[b.id];
  if (!list?.length) continue;
  parts.push(`<h2 id="${b.id}">${b.id} — ${esc(b.label)}<a href="${esc(b.url)}" target="_blank" rel="noopener">abrir board</a><small>subfase ${b.phase} · ${list.length} pins</small></h2><div class="g">`);
  list.forEach((hash, i) => {
    const id = `${b.id}${i + 1}`;
    parts.push(`<div class="c"><img loading="lazy" referrerpolicy="no-referrer" src="https://i.pinimg.com/736x/${hash}.jpg" alt="${id}"><span>${id}</span></div>`);
  });
  parts.push('</div>');
  total += list.length;
}
parts.push('</html>');
writeFileSync(OUT, parts.join(''));
console.log(`moodboard.html: ${BOARDS.filter((b) => pins[b.id]).length} boards, ${total} pins`);
