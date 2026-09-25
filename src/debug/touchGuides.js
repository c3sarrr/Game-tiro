// Visualização de depuração da camada de toque (config debug.touchGuides): zona do joystick, botões
// virtuais com a ação ligada, posição atual do polegar e dedos de olhar. O visual final é da Fase 10.

import { h } from '../ui/dom.js';
import { TOUCH_ZONES, TOUCH_JOYSTICK } from '../data/touchLayout.js';
import { ACTION_BY_ID } from '../data/actions.js';

export class TouchGuides {
  constructor(services) {
    this.s = services;
    this.canvas = h('canvas.touch-guides', { 'aria-hidden': 'true' });
    services.touchLayer.append(this.canvas);
    this.g = this.canvas.getContext('2d');
    this.enabled = services.config.get('debug.touchGuides');
    this.canvas.hidden = !this.enabled;
    this.off = services.config.watch('debug.touchGuides', (e) => {
      this.enabled = e.value;
      this.canvas.hidden = !e.value;
    });
  }

  frame() {
    if (!this.enabled) return;
    const c = this.canvas;
    const rect = this.s.touchLayer.getBoundingClientRect();
    const dpr = Math.min(2, devicePixelRatio || 1);
    const w = Math.round(rect.width * dpr);
    const hgt = Math.round(rect.height * dpr);
    if (c.width !== w || c.height !== hgt) {
      c.width = w;
      c.height = hgt;
    }
    const g = this.g;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, rect.width, rect.height);
    const min = Math.min(rect.width, rect.height);
    const z = TOUCH_ZONES.joystick;
    g.fillStyle = 'rgba(63,184,175,0.10)';
    g.strokeStyle = 'rgba(63,184,175,0.6)';
    g.setLineDash([6, 6]);
    g.fillRect(z.x0 * rect.width, z.y0 * rect.height, (z.x1 - z.x0) * rect.width, (z.y1 - z.y0) * rect.height);
    g.strokeRect(z.x0 * rect.width, z.y0 * rect.height, (z.x1 - z.x0) * rect.width, (z.y1 - z.y0) * rect.height);
    g.setLineDash([]);
    g.font = '600 12px Nunito, system-ui, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    const touch = this.s.input.touch;
    for (const b of touch.buttons) {
      const x = b.x * rect.width;
      const y = b.y * rect.height;
      const r = b.r * min;
      const held = touch.held.has(b.action);
      g.fillStyle = held ? 'rgba(255,210,63,0.55)' : `rgba(246,240,228,${0.18 * b.opacity})`;
      g.strokeStyle = 'rgba(246,240,228,0.8)';
      g.beginPath();
      g.arc(x, y, r, 0, Math.PI * 2);
      g.fill();
      g.stroke();
      g.fillStyle = '#2A2320';
      g.fillText(ACTION_BY_ID[b.action]?.label.split(' ')[0] ?? b.action, x, y);
    }
    const j = touch.joy;
    if (j.active) {
      const radius = TOUCH_JOYSTICK.radius * min;
      g.strokeStyle = 'rgba(255,210,63,0.9)';
      g.lineWidth = 3;
      g.beginPath();
      g.arc(j.ox - rect.left, j.oy - rect.top, radius, 0, Math.PI * 2);
      g.stroke();
      g.fillStyle = 'rgba(255,210,63,0.9)';
      g.beginPath();
      g.arc(j.ox - rect.left + j.x * radius, j.oy - rect.top - j.y * radius, radius * 0.35, 0, Math.PI * 2);
      g.fill();
      g.lineWidth = 1;
    }
    for (const p of touch.pointers.values()) {
      if (p.role !== 'look') continue;
      g.fillStyle = 'rgba(47,109,181,0.55)';
      g.beginPath();
      g.arc(p.lastX - rect.left, p.lastY - rect.top, 26, 0, Math.PI * 2);
      g.fill();
    }
  }

  dispose() {
    this.off();
    this.canvas.remove();
  }
}
