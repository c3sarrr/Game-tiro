// Uniforms globais da luz de estúdio, compartilhados por todos os materiais do jogo (massinha e set):
// o mesmo objeto é injetado em cada shader, então mudar `.value` aqui vale para todos no próximo quadro.
//  - uStudioSourceAngle: tamanho angular médio das fontes (softbox grande ≈ 0,1–0,15 rad). Alarga o lóbulo
//    especular das luzes pontuais (aproximação de luz de área de Karis): o brilho da massa úmida vira uma
//    mancha larga e suave, como o reflexo de uma softbox, e não um ponto duro de lâmpada.

export const studioGlobals = Object.freeze({
  uStudioSourceAngle: { value: 0.1 },
});
