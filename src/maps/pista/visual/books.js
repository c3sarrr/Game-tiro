// Livros da pista de testes (BAS1, BAS4, BAS7, BAS9, BAS11, BAS15 no item 11 do moodboard): os degraus das escadas
// (capa dura, lombada para o sul com o título e a etiqueta de biblioteca com a altura do degrau), a espiral da torre
// (capa dura, lombada virada para quem sobe) e os caderninhos dos apoios do slide (brochura). Todos num lote só, com o
// atlas das lombadas do mapa; a cor da capa é a cor da peça.

import { bakeSpineAtlas, bookMaterial } from '../../../clay/set/bookMaterial.js';
import { bookGeometry, spineArcLength } from '../../../clay/set/bookGeometry.js';

export function buildBooks(ctx) {
  const { layout, set, batches, disposers, anisotropy } = ctx;
  const books = layout.pieces.filter((p) => p.look.kind === 'book');
  // Capa dura nas escadas e na torre; os apoios do slide são caderninhos de brochura.
  const hard = (p) => !p.id.startsWith('slide-');
  // Uma célula por texto diferente (título + etiqueta + proporção da lombada); livros iguais repetem a célula.
  const keys = new Map();
  const spines = [];
  const cellOf = books.map((p) => {
    const [L, T] = p.size;
    const aspect = L / spineArcLength(T, hard(p));
    const key = `${p.look.title}|${p.look.text}|${aspect.toFixed(1)}`;
    if (!keys.has(key)) {
      keys.set(key, spines.length);
      spines.push({ title: p.look.title, label: p.look.text, aspect });
    }
    return keys.get(key);
  });
  const atlas = bakeSpineAtlas(spines, { width: 2048, cellHeight: 40, seed: 'pista-lombadas', anisotropy });
  disposers.push(() => atlas.dispose());
  const material = set.adopt('pista-livros', bookMaterial(set.textures, { atlas: atlas.texture, name: 'livros-pista' }));
  batches.define('books', { material });
  books.forEach((p, i) => {
    const geo = bookGeometry([...p.size], { hard: hard(p), spineRect: atlas.rects[cellOf[i]], seed: p.id });
    batches.add('books', geo, p.matrix, p.look.color);
  });
  return { books: books.length, cells: spines.length };
}
