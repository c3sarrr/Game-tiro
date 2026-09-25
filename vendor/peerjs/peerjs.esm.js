// Wrapper ESM gerado por tools/vendor.mjs — PeerJS 1.5.5.
// O bundle oficial é UMD (define window.Peer). Carregamos sob demanda para não pesar o modo solo.
let pending = null;
export function loadPeerJS() {
  if (typeof window !== 'undefined' && window.Peer) return Promise.resolve(window.Peer);
  if (!pending) {
    pending = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = new URL('./peerjs.min.js', import.meta.url).href;
      s.async = true;
      s.onload = () => (window.Peer ? resolve(window.Peer) : reject(new Error('PeerJS carregou sem expor window.Peer')));
      s.onerror = () => { pending = null; reject(new Error('Falha ao carregar /vendor/peerjs/peerjs.min.js')); };
      document.head.appendChild(s);
    });
  }
  return pending;
}
export default loadPeerJS;
