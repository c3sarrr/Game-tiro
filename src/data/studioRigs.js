// Montagens de luz de estúdio (seção 0.13 "Iluminação de estúdio"; referências em docs/art/moodboard.md item 2):
// key forte e quente de tungstênio com sombra suave (CSD6, SMD3), fill frio e fraco (SSD5), rim de recorte
// (CSD14), rebote quente do papelão/mesa (hemisférica + ambiente), softboxes/fresnéis visíveis como objetos
// (SSD14, SMD13) e poeira nos feixes (CSD8, SSD16).
//
// Unidades: 10 u = 1 cm na miniatura (o boneco tem 72 u). `illuminance` é a iluminância desejada no alvo da
// luz (unidade do three: lux); a intensidade em candela sai de E·d² com decaimento físico (decay 2), então a
// luz cai com a distância como num estúdio de verdade. Cores em Kelvin (src/render/colorTemperature.js).
// `distance` (opcional) corta o alcance da luz (luzes práticas); `shadow.focus` aperta o frustum da sombra da spot
// dentro do cone; `environment.room` e `dust.box` são opcionais (sala do ambiente assado maior e poeira só numa caixa).

import { PISTA } from './pista.js';

const PISTA_LAMP = PISTA.plaza.lamp;
const PISTA_TUNNEL = PISTA.tunnel.light;

export const STUDIO_RIGS = Object.freeze({
  // Vitrine (Fase 2): mesa do animador, objetos lado a lado, luz ajustável ao vivo.
  vitrine: Object.freeze({
    exposure: 1,
    lights: Object.freeze([
      Object.freeze({
        id: 'key', label: 'Key (tungstênio)', kind: 'spot', kelvin: 3200, illuminance: 4.6,
        position: [-560, 760, 520], target: [0, 40, 40], angleDeg: 32, penumbra: 0.75,
        shadow: Object.freeze({ bias: -0.00018, normalBias: 0.9, softness: 1, scale: 1, near: 300, far: 2200 }),
        sourceRadius: 110,
        fixture: Object.freeze({ kind: 'softbox', width: 240, height: 180, depth: 120, stand: true }),
      }),
      Object.freeze({
        id: 'fill', label: 'Fill (frio)', kind: 'spot', kelvin: 7600, illuminance: 0.85,
        position: [760, 360, 560], target: [0, 40, 0], angleDeg: 50, penumbra: 1,
        shadow: null,
        sourceRadius: 90,
        fixture: Object.freeze({ kind: 'softbox', width: 170, height: 170, depth: 90, stand: true }),
      }),
      // Rim alto e quase atrás (contraluz de set, SMR/ARM): baixo e do lado oposto à key ele iluminava o tampo
      // dos objetos com a mesma componente horizontal da key (≈2,9 × 2,9) e apagava o relevo das digitais e dos
      // amassados. Alto, só recorta a silhueta e dá o brilho de contraluz na massa úmida.
      Object.freeze({
        id: 'rim', label: 'Rim (recorte)', kind: 'spot', kelvin: 5600, illuminance: 2.8,
        position: [150, 720, -760], target: [0, 40, 20], angleDeg: 30, penumbra: 0.6,
        shadow: null,
        sourceRadius: 30,
        fixture: Object.freeze({ kind: 'fresnel', radius: 26, length: 64, stand: true }),
      }),
      Object.freeze({
        id: 'practical', label: 'Luminária de mesa', kind: 'point', kelvin: 2700, illuminance: 0.9,
        position: [-470, 230, -330], target: [-330, 20, -200], distance: 0,
        shadow: null,
        sourceRadius: 12,
        fixture: Object.freeze({ kind: 'deskLamp', reach: 230 }),
      }),
    ]),
    hemi: Object.freeze({ sky: '#9DB0CE', ground: '#6E4C32', intensity: 0.32 }),
    environment: Object.freeze({
      intensity: 0.5,
      background: '#130E0B',
      walls: '#1E1712',
      floor: '#6B4D34',
      // Painéis emissivos do mapa de ambiente: reflexos retangulares de softbox na massa úmida (clearcoat).
      panels: Object.freeze([
        Object.freeze({ light: 'key', scale: 1, strength: 5.5 }),
        Object.freeze({ light: 'fill', scale: 1, strength: 1.4 }),
        Object.freeze({ light: 'rim', scale: 1.6, strength: 3.5 }),
      ]),
    }),
    dust: Object.freeze({ light: 'key', count: 420, size: 1.6, drift: 6 }),
  }),

  // Sala de testes: mesma linguagem de luz, montada para uma sala de 16 × 16 m (1600 u).
  testroom: Object.freeze({
    exposure: 1,
    lights: Object.freeze([
      Object.freeze({
        id: 'key', label: 'Key (tungstênio)', kind: 'spot', kelvin: 3300, illuminance: 4.2,
        position: [-900, 1500, 800], target: [0, 0, 0], angleDeg: 46, penumbra: 0.7,
        shadow: Object.freeze({ bias: -0.0002, normalBias: 1.4, softness: 1.2, scale: 1, near: 800, far: 4200 }),
        sourceRadius: 160,
        fixture: Object.freeze({ kind: 'softbox', width: 300, height: 220, depth: 140, stand: false }),
      }),
      Object.freeze({
        id: 'fill', label: 'Fill (frio)', kind: 'spot', kelvin: 7800, illuminance: 0.8,
        position: [1100, 700, 900], target: [0, 0, 0], angleDeg: 60, penumbra: 1,
        shadow: null,
        sourceRadius: 140,
        fixture: Object.freeze({ kind: 'softbox', width: 240, height: 240, depth: 110, stand: false }),
      }),
      Object.freeze({
        id: 'rim', label: 'Rim (recorte)', kind: 'spot', kelvin: 5600, illuminance: 2.4,
        position: [700, 900, -1100], target: [0, 60, 0], angleDeg: 40, penumbra: 0.6,
        shadow: null,
        sourceRadius: 40,
        fixture: Object.freeze({ kind: 'fresnel', radius: 36, length: 90, stand: false }),
      }),
    ]),
    hemi: Object.freeze({ sky: '#9DB0CE', ground: '#6E4C32', intensity: 0.3 }),
    environment: Object.freeze({
      intensity: 0.45,
      background: '#120D0B',
      walls: '#2A2018',
      floor: '#2E5A40',
      panels: Object.freeze([
        Object.freeze({ light: 'key', scale: 1, strength: 5 }),
        Object.freeze({ light: 'fill', scale: 1, strength: 1.3 }),
        Object.freeze({ light: 'rim', scale: 1.6, strength: 3 }),
      ]),
    }),
    dust: Object.freeze({ light: 'key', count: 600, size: 2.2, drift: 9 }),
  }),

  // Pista de testes (3.3): a base de 5,6 × 4 m inteira sob uma key pendurada alta e longe (queda de ~2× do centro às
  // bordas; a única com sombra, mapa ×2 com o frustum apertado no cone), fill frio do lado oposto, rim alto vindo do
  // norte e as duas luzes práticas da pista — a luminária de mesa da praça e a luz do túnel —, sem sombra e com alcance.
  // Níveis mais baixos que os da sala de testes: o compensado claro devolve ~4× a luz do tapete verde.
  pista: Object.freeze({
    exposure: 1,
    lights: Object.freeze([
      Object.freeze({
        id: 'key', label: 'Key (tungstênio)', kind: 'spot', kelvin: 3300, illuminance: 2.4,
        position: [-3200, 8400, 4400], target: [0, 0, 0], angleDeg: 28, penumbra: 0.45,
        shadow: Object.freeze({ bias: -0.00015, normalBias: 2.2, softness: 1.2, scale: 2, near: 5000, far: 14000, focus: 0.8 }),
        sourceRadius: 260,
        fixture: Object.freeze({ kind: 'softbox', width: 420, height: 320, depth: 180, stand: false }),
      }),
      Object.freeze({
        id: 'fill', label: 'Fill (frio)', kind: 'spot', kelvin: 7600, illuminance: 0.5,
        position: [4200, 3000, -3400], target: [0, 0, 0], angleDeg: 45, penumbra: 1,
        shadow: null,
        sourceRadius: 220,
        fixture: Object.freeze({ kind: 'softbox', width: 320, height: 320, depth: 150, stand: false }),
      }),
      Object.freeze({
        id: 'rim', label: 'Rim (recorte)', kind: 'spot', kelvin: 5600, illuminance: 1.2,
        position: [600, 5200, -7000], target: [0, 60, -400], angleDeg: 34, penumbra: 0.6,
        shadow: null,
        sourceRadius: 60,
        fixture: Object.freeze({ kind: 'fresnel', radius: 46, length: 110, stand: false }),
      }),
      Object.freeze({
        id: 'practical', label: 'Luminária de mesa', kind: 'point', kelvin: 2700, illuminance: 0.9,
        position: [...PISTA_LAMP.bulb], target: [...PISTA_LAMP.target], distance: 900,
        shadow: null,
        sourceRadius: 12,
        fixture: Object.freeze({ kind: 'deskLamp', reach: PISTA_LAMP.reach }),
      }),
      // O pisca-pisca do teto é a fonte visível; esta é a luz que ele faria, no meio da caixa alta.
      Object.freeze({
        id: 'tunnel', label: 'Luz do túnel', kind: 'point', kelvin: 2400, illuminance: PISTA_TUNNEL.illuminance,
        position: [...PISTA_TUNNEL.at], target: [PISTA_TUNNEL.at[0], 0, PISTA_TUNNEL.at[2]], distance: PISTA_TUNNEL.reach,
        shadow: null,
        sourceRadius: 20,
        fixture: null,
      }),
    ]),
    hemi: Object.freeze({ sky: '#9DB0CE', ground: '#6E4C32', intensity: 0.3 }),
    environment: Object.freeze({
      intensity: 0.45,
      background: '#110C0A',
      walls: '#241B15',
      floor: '#5C4430',
      // Sala grande: a key a 10 m do centro precisa caber nela para o reflexo da softbox aparecer.
      room: Object.freeze([26000, 22000, 26000]),
      panels: Object.freeze([
        Object.freeze({ light: 'key', scale: 3, strength: 5 }),
        Object.freeze({ light: 'fill', scale: 2.2, strength: 1.3 }),
        Object.freeze({ light: 'rim', scale: 3, strength: 3 }),
      ]),
    }),
    // Poeira só no ar baixo da base, onde o boneco anda (o cone inteiro da key tem 10 m); mais alta, contra o fundo
    // escuro do estúdio, parecia um céu estrelado.
    dust: Object.freeze({
      light: 'key', count: 800, size: 2.4, drift: 10,
      box: Object.freeze({ min: Object.freeze([-2800, 4, -2000]), max: Object.freeze([2800, 240, 2000]) }),
    }),
  }),
});

/** Faixas dos controles ao vivo da vitrine (painel de fita crepe). */
export const RIG_LIMITS = Object.freeze({
  illuminance: Object.freeze([0, 12]),
  kelvin: Object.freeze([1900, 10000]),
  hemi: Object.freeze([0, 1.5]),
  environment: Object.freeze([0, 2]),
});
