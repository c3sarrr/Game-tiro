// Leitura de argumentos dos comandos do console.

/** 0/1 (on/off, sim/não, ligado/desligado) de um comando; sem argumento, inverte o valor atual. */
export function onOff(arg, current) {
  if (arg === undefined) return !current;
  if (['1', 'on', 'sim', 'true', 'ligado'].includes(String(arg).toLowerCase())) return true;
  if (['0', 'off', 'nao', 'não', 'false', 'desligado'].includes(String(arg).toLowerCase())) return false;
  throw new Error(`esperava 0/1, recebi "${arg}"`);
}
