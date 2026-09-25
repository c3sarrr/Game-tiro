// Vida do jogador (subfase 3.4): vida máxima, volta ao jogo depois de morrer, câmera da morte do modo livre, tipos de
// dano e os textos das causas de morte. O dano das armas e a fórmula do colete entram na Fase 4; o HUD de massinha, na
// Fase 10; a morte por amassamento, na Fase 5.

export const VITALS = Object.freeze({
  maxHealth: 100,
  respawnDelay: 2, // s até voltar (o respawn do Mata-mata, seção 0.8)
  // Câmera do morto: o olho desce até `eye` u acima dos pés e tomba `rollDeg` em `time` s ("reduzir movimento": só
  // desce).
  deathCam: Object.freeze({ eye: 12, rollDeg: 35, time: 0.5 }),
  damageFlash: 0.9, // s que o "−26" fica na etiqueta de vida do HUD de teste
});

/**
 * Tipos de dano. `armor`: o colete reduz? No CS:GO o colete só vale para dano genérico, de bala, explosão, pancada e
 * corte — nunca para queda. Os da 3.4 não passam pelo colete; os das armas chegam na Fase 4.
 */
export const DAMAGE = Object.freeze({
  queda: Object.freeze({ label: 'queda', armor: false }),
  mundo: Object.freeze({ label: 'mundo', armor: false }), // console (hurtme) e sair do set
});

/** Causas de morte: texto da etiqueta do modo livre. */
export const DEATH_CAUSES = Object.freeze({
  queda: 'Você se esborrachou',
  fora: 'Caiu do set',
  kill: 'Desistiu',
  mundo: 'Amassado pelo console',
});
