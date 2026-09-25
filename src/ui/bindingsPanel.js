// Painel de teclas e botões: cada ação com 2 posições no teclado/mouse e 2 no controle.
// Clique numa posição → "Pressione…" (Esc cancela, Delete limpa). Conflitos são resolvidos tirando o
// bind da ação antiga, com aviso.

import { h, clear } from './dom.js';
import { EV } from '../core/events.js';
import { ACTIONS, ACTION_GROUPS, ACTION_BY_ID } from '../data/actions.js';

const SLOTS = 2;

export function bindingsPanel({ input, rebinder, events, toasts }) {
  const root = h('div.bindings');
  const offs = [];
  let busy = false;

  const toolbar = h('div.bindings-toolbar', null,
    h('span.tape-label', null, 'Clique numa posição e aperte a tecla ou botão · Esc cancela · Delete limpa'),
    h('div.bindings-actions', null,
      h('button.btn-clay.is-small', { type: 'button', onclick: () => rebinder.reset('kbm') }, 'Padrão do teclado'),
      h('button.btn-clay.is-small', { type: 'button', onclick: () => rebinder.reset('pad') }, 'Padrão do controle'),
    ),
  );
  const table = h('div.bindings-table', { role: 'table' });
  root.append(toolbar, table);

  function slotButton(action, device, slot) {
    const list = input.bindings[action][device];
    const binding = list[slot];
    const label = binding ? input.labelFor(binding) : '—';
    const btn = h(`button.bind-slot${binding ? '' : '.is-empty'}`, {
      type: 'button',
      title: binding ? `${label} (clique para trocar, botão direito para limpar)` : 'vazio (clique para definir)',
      dataset: { action, device, slot: String(slot) },
    }, label);
    btn.addEventListener('click', async () => {
      if (busy) return;
      busy = true;
      btn.classList.add('is-listening');
      btn.textContent = device === 'pad' ? 'Aperte no controle…' : 'Pressione…';
      const res = await rebinder.rebind(action, device, slot);
      busy = false;
      if (res.status === 'bound' && res.displaced.length) {
        const names = res.displaced.map((a) => ACTION_BY_ID[a].label).join(', ');
        toasts.show(`${input.labelFor(res.binding)} saiu de: ${names}`);
      }
      render();
      table.querySelector(`[data-action="${action}"][data-device="${device}"][data-slot="${slot}"]`)?.focus();
    });
    btn.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      if (busy || !binding) return;
      rebinder.clear(action, device, slot);
      render();
    });
    return btn;
  }

  function render() {
    clear(table);
    table.append(h('div.bindings-head', { role: 'row' },
      h('span', { role: 'columnheader' }, 'Ação'),
      h('span', { role: 'columnheader' }, 'Teclado e mouse'),
      h('span', { role: 'columnheader' }, 'Controle'),
    ));
    for (const group of ACTION_GROUPS) {
      table.append(h('div.bindings-group', { role: 'row' }, group.label));
      for (const action of ACTIONS.filter((a) => a.group === group.id)) {
        const kbm = [];
        const pad = [];
        for (let s = 0; s < SLOTS; s++) {
          kbm.push(slotButton(action.id, 'kbm', s));
          pad.push(slotButton(action.id, 'pad', s));
        }
        table.append(h('div.bindings-row', { role: 'row' },
          h('span.bindings-name', { role: 'cell' }, action.label),
          h('span.bindings-cell', { role: 'cell' }, kbm),
          h('span.bindings-cell', { role: 'cell' }, pad),
        ));
      }
    }
  }

  render();
  offs.push(events.on(EV.INPUT_REBIND, () => { if (!busy) render(); }));
  offs.push(events.on(EV.INPUT_GAMEPAD, () => render())); // ícones mudam com o tipo de controle
  offs.push(events.on(EV.CONFIG_CHANGE, (e) => { if (e.key === 'controls.bindings' && !busy) render(); }));

  return {
    el: root,
    dispose() {
      input.cancelCapture();
      for (const off of offs) off();
    },
  };
}
