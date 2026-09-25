// Nomes e perfis de personalidade dos bots (seção 0.11, item 7). Todos com cara de massinha e estúdio.
// Os pesos dos perfis orientam a escolha de papel na partida (entry, segurar ângulo, lurk, AWP, suporte).

export const BOT_PROFILES = Object.freeze([
  Object.freeze({ id: 'agressivo', label: 'Agressivo', weights: Object.freeze({ entry: 0.8, hold: 0.2, lurk: 0.1, awp: 0.1, support: 0.2 }) }),
  Object.freeze({ id: 'suporte', label: 'Suporte', weights: Object.freeze({ entry: 0.2, hold: 0.5, lurk: 0.1, awp: 0.1, support: 0.9 }) }),
  Object.freeze({ id: 'awper', label: 'AWPer', weights: Object.freeze({ entry: 0.1, hold: 0.8, lurk: 0.2, awp: 1, support: 0.3 }) }),
  Object.freeze({ id: 'lurker', label: 'Lurker', weights: Object.freeze({ entry: 0.2, hold: 0.4, lurk: 1, awp: 0.2, support: 0.2 }) }),
]);

export const BOT_NAMES = Object.freeze([
  'Bolota', 'Palito', 'Pão de Massa', 'Espátula', 'Carimbo', 'Cotoco', 'Fiapo', 'Grude', 'Minhoquinha',
  'Tampinha', 'Arame', 'Fita Crepe', 'Barbante', 'Polegar', 'Rolinho', 'Pingo', 'Tijolinho', 'Chiclete',
  'Marmorizado', 'Estilete', 'Rebarba', 'Molenga', 'Amassadinho', 'Bolinha', 'Borrão', 'Cobrinha',
  'Lasca', 'Retalho', 'Grampo', 'Clipe', 'Parafuso', 'Massapão', 'Tripé', 'Lente', 'Fresnel', 'Rebatedor',
]);
