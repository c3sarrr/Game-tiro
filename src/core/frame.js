// Espera "o próximo quadro" sem travar para sempre: resolve no próximo requestAnimationFrame ou após
// `maxWaitMs` (webviews que não pintam, abas em transição). Usado em carregamentos que só querem ceder a vez
// para a tela atualizar entre etapas.

export function nextFrame(maxWaitMs = 50) {
  return new Promise((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      resolve();
    };
    const timer = setTimeout(finish, maxWaitMs);
    requestAnimationFrame(finish);
  });
}

export function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
