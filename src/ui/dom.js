// Mini-helper de DOM (hyperscript). Nunca usa innerHTML com texto de usuário: nomes de jogadores e chat
// (Fase 9) passam por textContent, sem risco de injeção.

/**
 * h('button.btn-clay.is-primary', { onclick, dataset: { nav: '' } }, 'Jogar')
 * Seletor: tag + .classes + #id. Props: atributos, on* = eventos, style (objeto), dataset (objeto).
 */
export function h(selector, props = null, ...children) {
  const m = /^([a-z0-9-]+)?((?:[.#][\w-]+)*)$/i.exec(selector);
  if (!m) throw new Error(`seletor inválido: ${selector}`);
  const el = document.createElement(m[1] || 'div');
  for (const part of m[2].match(/[.#][\w-]+/g) ?? []) {
    if (part[0] === '.') el.classList.add(part.slice(1));
    else el.id = part.slice(1);
  }
  if (props) {
    for (const [key, value] of Object.entries(props)) {
      if (value === undefined || value === null || value === false) continue;
      if (key.startsWith('on') && typeof value === 'function') el.addEventListener(key.slice(2).toLowerCase(), value);
      else if (key === 'style' && typeof value === 'object') Object.assign(el.style, value);
      else if (key === 'dataset') Object.assign(el.dataset, value);
      else if (key === 'className') el.className = value;
      else if (key in el && typeof value !== 'string') el[key] = value;
      else el.setAttribute(key, value === true ? '' : String(value));
    }
  }
  append(el, children);
  return el;
}

function append(el, children) {
  for (const child of children.flat(Infinity)) {
    if (child === null || child === undefined || child === false) continue;
    el.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
}

export function clear(el) {
  while (el.firstChild) el.removeChild(el.firstChild);
  return el;
}

export function mount(parent, ...children) {
  append(parent, children);
  return parent;
}

/** Texto seguro (sempre textContent). */
export function text(el, value) {
  el.textContent = String(value);
  return el;
}

/** Quebra um título em letras individuais (cada uma "ferve" separadamente no CSS, como massinha). */
export function clayLetters(word, className = 'clay-letter') {
  return [...word].map((ch, i) =>
    h(`span.${className}`, { style: { '--i': String(i), '--r': String(((i * 37) % 7) - 3) }, 'aria-hidden': 'true' }, ch === ' ' ? ' ' : ch),
  );
}
