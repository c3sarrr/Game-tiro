// Tempo de GPU por quadro e por etapa via EXT_disjoint_timer_query_webgl2 (Chrome/Edge desktop; Firefox com a
// extensão ativa). Consultas TIME_ELAPSED não podem ser aninhadas: o quadro é dividido em ETAPAS sequenciais
// (cena, ao, dof, bloom, saída, smaa, lente...) e o tempo do quadro é a soma delas.
// Os resultados chegam alguns quadros depois: guardamos uma fila de quadros e lemos quando todas as consultas de
// um quadro ficam prontas. Em navegadores sem a extensão (Safari, alguns celulares) `ms` fica null ("n/d").

const MAX_PENDING = 6;
const EMA = 0.1;

export class GpuTimer {
  constructor(gl) {
    this.gl = gl;
    this.ext = gl.getExtension('EXT_disjoint_timer_query_webgl2');
    this.pool = [];
    /** @type {Array<Array<{name:string, query:WebGLQuery}>>} quadros aguardando resultado */
    this.pending = [];
    this.frame = null;
    this.activeName = null;
    this.ms = null; // último quadro medido (soma das etapas)
    this.avgMs = null; // média móvel exponencial
    /** @type {Map<string, {ms:number, avgMs:number}>} tempo por etapa */
    this.sections = new Map();
  }

  get supported() {
    return !!this.ext;
  }

  /** Contexto WebGL perdido: consultas e extensão deixam de existir (nenhuma chamada GL aqui). */
  lose() {
    this.ext = null;
    this.pool = [];
    this.pending = [];
    this.frame = null;
    this.activeName = null;
    this.ms = null;
    this.avgMs = null;
    this.sections.clear();
  }

  /** Contexto recuperado: a extensão tem de ser pedida de novo ao novo contexto. */
  restore() {
    this.lose();
    this.ext = this.gl.getExtension('EXT_disjoint_timer_query_webgl2');
  }

  /** Abre o quadro com a primeira etapa. */
  begin(name = 'quadro') {
    if (!this.ext || this.frame) return;
    this.frame = [];
    this.#open(name);
  }

  /** Fecha a etapa atual e abre a próxima (sem efeito fora de um quadro). */
  section(name) {
    if (!this.frame || this.activeName === name) return;
    this.#close();
    this.#open(name);
  }

  end() {
    if (!this.frame) return;
    this.#close();
    this.pending.push(this.frame);
    this.frame = null;
    this.#poll();
  }

  #open(name) {
    const q = this.pool.pop() ?? this.gl.createQuery();
    this.gl.beginQuery(this.ext.TIME_ELAPSED_EXT, q);
    this.frame.push({ name, query: q });
    this.activeName = name;
  }

  #close() {
    if (this.activeName === null) return;
    this.gl.endQuery(this.ext.TIME_ELAPSED_EXT);
    this.activeName = null;
  }

  #poll() {
    const gl = this.gl;
    const disjoint = gl.getParameter(this.ext.GPU_DISJOINT_EXT);
    while (this.pending.length) {
      const frame = this.pending[0];
      const ready = frame.every((s) => gl.getQueryParameter(s.query, gl.QUERY_RESULT_AVAILABLE));
      if (!ready && !disjoint) break;
      this.pending.shift();
      if (ready && !disjoint) {
        let total = 0;
        // Mapa novo na ordem das etapas deste quadro (a ordem do pipeline); a média vem do anterior.
        // Etapas que sumiram (passe desligado) saem da lista; a mesma etapa repetida no quadro soma.
        const next = new Map();
        for (const s of frame) {
          const ms = gl.getQueryParameter(s.query, gl.QUERY_RESULT) / 1e6;
          total += ms;
          const cur = next.get(s.name);
          if (cur) {
            cur.ms += ms;
          } else {
            next.set(s.name, { ms, avgMs: 0 });
          }
        }
        for (const [name, cur] of next) {
          const prev = this.sections.get(name);
          cur.avgMs = prev ? prev.avgMs * (1 - EMA) + cur.ms * EMA : cur.ms;
        }
        this.sections = next;
        this.ms = total;
        this.avgMs = this.avgMs === null ? total : this.avgMs * (1 - EMA) + total * EMA;
      }
      for (const s of frame) this.pool.push(s.query);
    }
    // Driver atrasado demais: descarta os quadros mais antigos para não crescer sem limite.
    while (this.pending.length > MAX_PENDING) {
      for (const s of this.pending.shift()) this.pool.push(s.query);
    }
  }

  /** Etapas com média móvel, na ordem do último quadro medido. */
  sectionList() {
    return [...this.sections.entries()].map(([name, v]) => ({ name, ms: v.ms, avgMs: v.avgMs }));
  }

  dispose() {
    const gl = this.gl;
    if (this.frame && this.activeName !== null) gl.endQuery(this.ext.TIME_ELAPSED_EXT);
    const all = [...this.pool, ...this.pending.flat().map((s) => s.query), ...(this.frame ?? []).map((s) => s.query)];
    for (const q of all) gl.deleteQuery(q);
    this.pool = [];
    this.pending = [];
    this.frame = null;
    this.activeName = null;
  }
}
