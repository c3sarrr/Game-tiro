// Paleta base do MASSACRE (seção 0.13) + tons auxiliares de luz derivados do moodboard (docs/art/moodboard.md, item 7).
// Estes são os mesmos valores dos tokens CSS em styles/tokens.css.

export const PALETTE = Object.freeze({
  // Massa Crua (TR)
  terracotta: '#C8553D',
  orange: '#F28F3B',
  red: '#D1362F',
  // Tropa do Estúdio (CT)
  blue: '#2F6DB5',
  teal: '#3FB8AF',
  clayWhite: '#F4EDE1',
  // Set
  cardboard: '#B98B5E',
  cuttingMat: '#2E6E4E',
  wood: '#8C5A3C',
  maskingTape: '#E8D9A8',
  metal: '#8F959C',
  // UI
  paper: '#F6F0E4',
  ink: '#2A2320',
  clayYellow: '#FFD23F',
  alert: '#E4572E',
  // Luz (moodboard: key âmbar CSD6/SMD3, fill azulado, noite violeta SSD5)
  keyAmber: '#FFB46B',
  fillBlue: '#8FB4FF',
  nightViolet: '#4B3F8C',
});

export const TEAM_COLORS = Object.freeze({
  tr: Object.freeze({ id: 'tr', name: 'Massa Crua', primary: PALETTE.terracotta, secondary: PALETTE.orange, accent: PALETTE.red }),
  ct: Object.freeze({ id: 'ct', name: 'Tropa do Estúdio', primary: PALETTE.blue, secondary: PALETTE.teal, accent: PALETTE.clayWhite }),
});
