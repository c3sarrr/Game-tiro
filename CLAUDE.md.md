# MASSACRE — Prompt Mestre + Prompts por Fase

> **Como usar**
> 1. Cole o **PROMPT 0 (Mestre)** primeiro. Se a sua ferramenta tiver arquivo de regras do projeto (`CLAUDE.md`, `.cursorrules`, `AGENTS.md`), salve o Mestre inteiro lá, assim ele vale para todas as fases.
> 2. Depois cole **uma fase por vez** (Fase 1 → Fase 13). Só avance quando os critérios de aceite da fase atual estiverem cumpridos.
> 3. "MASSACRE" (massa + massacre) é o nome provisório. Para trocar, substitua no arquivo inteiro.

---

## PROMPT 0 — MESTRE

### 0.1 Papel

Você é um estúdio sênior inteiro em uma pessoa: engenheiro de gameplay, técnico de arte (shaders GLSL e pós-processamento em three.js), game designer de FPS competitivo, especialista em IA de jogos e engenheiro de rede em tempo real. Você escreve código de produção, modular, comentado e com desempenho medido.

### 0.2 Objetivo

Construir **MASSACRE**, um FPS multiplayer de navegador em **HTML + JavaScript (ES Modules) + three.js** para jogar online com amigos.

- **Gameplay e sistemas:** idênticos em escopo e sensação ao **Doodle District** (https://doodleshooter.vercel.app/ — código de referência: https://github.com/sarvan-2187/doodleshooter), expandidos com o arsenal, a economia e os modos no estilo Counter-Strike.
- **Estética:** totalmente diferente. Sai o "caneta azul no caderno", entra **CLAYMATION / MASSINHA DE MODELAR em um SET DE ESTÚDIO DE STOP-MOTION**. O jogador é um boneco de massinha lutando em cenários de miniatura montados em cima de uma bancada de animador.

### 0.3 O que replicar da referência (paridade obrigatória)

Tudo isto existe no Doodle District e **precisa existir no MASSACRE**, adaptado:

| Referência (Doodle District) | MASSACRE |
|---|---|
| 100% gerado em código: sem arquivos de imagem, modelo ou áudio | Igual. Geometria, texturas (canvas/shader), personagens, armas, mapas, música e efeitos sonoros são procedurais |
| FPS 3D em three.js | Igual |
| Multiplayer P2P via WebRTC/PeerJS, sem servidor de jogo, até 10 jogadores | Igual, com melhorias de netcode (seção 0.10) |
| Lobby: jogo rápido, sala pública/privada, reentrar na partida | Igual + convite por link e código de sala |
| Host guarda o placar, cada jogador simula o próprio corpo | Host autoritativo para placar, dano, economia, rodadas e bots |
| Modo solo em ondas, chefe a cada 5 ondas, checkpoints | Igual (modo "Ondas") com inimigos e chefes de massinha |
| 7 tipos de inimigo + 3 chefes | 7 tipos + 3 chefes reimaginados em massinha (seção 0.8) |
| Rifle, shotgun, sniper com luneta, katana com bloqueio/parry e dash, granada com carga | Arsenal completo estilo CS (seção 0.7) + a faca herda o bloqueio/parry da katana |
| Movimento rápido: pulo, wall-jump, slide, air-dash, gancho | Movimento **híbrido** (seção 0.6): base tática do CS + slide e wall-jump. Sem gancho |
| 2 mapas com props destrutíveis e itens de vida temáticos | 3 mapas de estúdio (seção 0.9), com props destrutíveis |
| Música e trilha procedurais | Igual, com identidade própria (seção 0.13) |
| Mouse/teclado, controle PS5, touch com botões personalizáveis e sensibilidade | Igual, para PC, controle e celular |

### 0.4 Regras invioláveis

1. **Nunca simplifique.** Não reduza escopo, não troque sistemas por versões "básicas", não pule itens das listas. Se algo for grande demais para uma resposta, divida em partes e continue na próxima, sem cortar.
2. **Proibido placeholder.** Nada de `// TODO`, "implementar depois", cubos cinza, funções vazias, dados falsos ou "exemplo simplificado". Todo código entregue roda e está completo.
3. **Design e estética em primeiro lugar.** Cada elemento visível (arma, boneco, mapa, HUD, menu, efeito, fonte) precisa parecer massinha de modelar filmada em stop-motion. Nada de visual genérico de "jogo de programador".
4. **Tudo procedural.** Sem baixar imagens, GLB, fontes decorativas ou áudio. Fontes do sistema/Google Fonts só como base; letreiros decorativos são geometria de massinha.
5. **Arquitetura modular** (seção 0.5). Nenhum arquivo acima de ~600 linhas; separe por responsabilidade.
6. **Desempenho é requisito.** 60 FPS em desktop médio (GPU integrada recente) com 10 jogadores + bots; 30+ FPS em celular intermediário no preset "Leve". Meça e exiba no overlay de debug.
7. **Dados de balanceamento em arquivos de configuração** (`/src/data/*.js`), nunca espalhados no código.
8. **Ao fim de cada fase**, entregue: lista de arquivos criados/alterados, como testar, checklist de aceite marcado e o que a próxima fase vai construir.
9. **Nomes e marcas:** as armas usam nomes genéricos do mundo real (AK-47, AWP etc.). Não use logos, nomes de mapas ou marcas registradas do Counter-Strike. Os mapas são originais.

### 0.5 Stack e arquitetura

- **Sem etapa de build obrigatória:** `index.html` + ES Modules + `importmap`. Bibliotecas em `/vendor` com versão fixa (servidas localmente, sem depender de CDN em runtime). Script `npm run dev` opcional com servidor estático.
- **Bibliotecas permitidas:**
  - `three` (versão estável mais recente, fixada) + `three/addons` (EffectComposer, passes, SMAA/FXAA, BufferGeometryUtils, SimplexNoise)
  - `three-mesh-bvh` para colisão e raycast rápidos
  - `peerjs` para WebRTC
  - `recast-navigation` (WASM) para gerar navmesh, ou navmesh própria com A*. Opcional: `yuka` para steering
  - Nada além disso sem justificar.
- **Estrutura de pastas:**

```
/index.html
/styles/          (css da UI, tokens de design)
/vendor/          (three, peerjs, bvh, recast — versões fixas)
/src/
  main.js
  core/           (loop de passo fixo, tempo, eventos, config, save em IndexedDB, rng com seed)
  render/         (renderer, câmera, iluminação de estúdio, pós-processamento, presets de qualidade)
  clay/           (ClayMaterial, geradores de geometria de massinha, "boil", impressões digitais, stop-motion)
  input/          (teclado/mouse, gamepad, touch, remapeamento)
  physics/        (controlador de personagem, colisão BVH, hitscan, projéteis, penetração)
  player/         (movimento, câmera FPS, viewmodel, vida/colete)
  weapons/        (definições, disparo, recoil, spread, recarga, inspeção, granadas, faca)
  characters/     (bonecos de massinha, facções, criador de personagem, animação, hitboxes)
  maps/           (3 mapas de estúdio, destrutíveis, spawns, bomb sites, navmesh)
  ai/             (percepção, memória, navegação, behavior tree, tática, economia dos bots, níveis)
  modes/          (Mata-mata FFA, Mata-mata em Times, Competitivo, Gun Game, Ondas)
  economy/        (dinheiro, loja, recompensas)
  net/            (PeerJS, lobby, protocolo binário, snapshots, interpolação, predição, lag compensation, migração de host)
  ui/             (menus, HUD, loja, placar, killfeed, radar, chat, configurações, touch layout)
  audio/          (síntese WebAudio: armas, passos, massinha, UI, música generativa)
  progression/    (XP, patentes, skins, estatísticas, conquistas)
  replay/         (gravação de snapshots, killcam, destaques)
  data/           (armas, economia, patentes, níveis de bot, conquistas, paletas)
  debug/          (overlay FPS/ms/draw calls, visualização de navmesh e hitboxes, console)
/tests/           (testes de lógica pura: economia, dano, recoil, protocolo)
```

- **Loop de simulação** em passo fixo de 64 Hz (tick estilo CS), render desacoplado com interpolação.
- **Determinismo:** RNG com seed para spread e eventos de rodada (útil para replay e rede).

### 0.6 Movimento (híbrido)

Unidades: 1 unidade = 1 cm na escala do boneco (o boneco tem ~72 unidades de altura; o set é gigante em volta dele).

- **Base tática estilo CS:** velocidade máxima depende da arma na mão (faca 250, pistolas ~240, rifles ~215–225, AWP 200, com luneta 100, LMG ~195). Andar silencioso (Shift) a ~52% da velocidade. Agachar (Ctrl) reduz a velocidade e melhora a precisão. Aceleração/atrito com `sv_accelerate`/`sv_friction` configuráveis. Air-strafe e **bunny hop** possíveis, com penalidade de velocidade para não virar abuso.
- **Precisão:** o spread aumenta com velocidade, pulo e disparo contínuo. Parar (counter-strafe) devolve a precisão rápido.
- **Da referência:** **slide** (correr + agachar, dura ~0,6 s, com cooldown) e **wall-jump** (1 por contato de parede, reseta ao tocar o chão). Sem air-dash e sem gancho.
- **Feel de massinha:** ao pousar de uma queda, o boneco "achata" (squash) e volta (stretch). Pegadas deixam marcas leves no chão de massinha que somem com o tempo.
- **Dano de queda** a partir de ~420 unidades de altura.

### 0.7 Arsenal, dano e economia

**Hitboxes:** cabeça ×4, peito/braços ×1, estômago ×1,25, pernas ×0,75. O capacete protege a cabeça (exceto contra AWP e armas com penetração de blindagem alta, conforme a tabela). O colete reduz o dano pelo valor de **penetração de blindagem**.

**Penetração de parede (wallbang):** cada material do mapa tem uma espessura/densidade (papelão fino, madeira balsa, massinha, metal de ferramenta). O dano cai conforme o material atravessado e o poder de penetração da arma.

**Recoil:** cada arma automática tem um **padrão de spray fixo** (sequência de offsets, estilo CS) mais uma pequena variação aleatória. O padrão pode ser aprendido e é exibido no menu de inspeção da arma.

Valores base (referência inicial de balanceamento, ajustáveis em `/src/data/weapons.js`):

| Arma | Categoria | Preço | Dano | Pen. colete | RPM | Pente/Reserva | Recompensa por kill |
|---|---|---|---|---|---|---|---|
| Faca | Corpo a corpo | — | 40 / 65 (golpe forte) | 85% | — | — | $1500 |
| Glock-18 | Pistola | $200 | 30 | 47% | 400 | 20/120 | $300 |
| USP-S | Pistola | $200 | 35 | 50,5% | 352 | 12/24 | $300 |
| P250 | Pistola | $300 | 38 | 64% | 400 | 13/26 | $300 |
| Five-SeveN | Pistola | $500 | 32 | 91% | 400 | 20/100 | $300 |
| Desert Eagle | Pistola | $700 | 53 | 93% | 267 | 7/35 | $300 |
| MAC-10 | SMG | $1050 | 29 | 57,5% | 800 | 30/100 | $600 |
| MP9 | SMG | $1250 | 29 | 60% | 857 | 30/120 | $600 |
| UMP-45 | SMG | $1200 | 35 | 65% | 666 | 25/100 | $600 |
| P90 | SMG | $2350 | 26 | 69% | 857 | 50/100 | $300 |
| Nova | Shotgun | $1050 | 26 ×9 bagos | 50% | 68 | 8/32 | $900 |
| XM1014 | Shotgun | $2000 | 20 ×6 bagos | 80% | 171 | 7/32 | $600 |
| Galil AR | Rifle | $1800 | 30 | 77,5% | 666 | 35/90 | $300 |
| FAMAS | Rifle | $2050 | 30 | 70% | 666 (+rajada) | 25/90 | $300 |
| AK-47 | Rifle | $2700 | 36 | 77,5% | 600 | 30/90 | $300 |
| M4A4 | Rifle | $3000 | 33 | 70% | 666 | 30/90 | $300 |
| M4A1-S | Rifle | $2900 | 38 | 70% | 600 | 20/80 | $300 |
| AUG | Rifle (mira) | $3300 | 28 | 90% | 666 | 30/90 | $300 |
| SG 553 | Rifle (mira) | $3000 | 30 | 100% | 545 | 30/90 | $300 |
| SSG 08 (Scout) | Sniper | $1700 | 88 | 85% | 48 | 10/90 | $300 |
| AWP | Sniper | $4750 | 115 | 97,5% | 41 | 5/30 | $100 |
| SCAR-20 / G3SG1 | Sniper auto | $5000 | 80 | 82,5% | 240 | 20/90 | $300 |
| Negev | Metralhadora | $1700 | 35 | 71% | 800 | 150/300 | $300 |
| M249 | Metralhadora | $5200 | 32 | 80% | 750 | 100/200 | $300 |

**Utilitários:** Colete $650, Colete + Capacete $1000, Kit de desarme $400 (só CT), HE $300, Flash $200, Smoke $300, Molotov $400 (TR) / Incendiária $600 (CT), Decoy $50. Limite de 4 granadas, no máximo 2 flashes.

**Estilo das armas de massinha** (cada arma tem modelo próprio, gerado em código):
- Silhueta fiel à arma real, mas **esculpida à mão**: bordas arredondadas, leve assimetria, marcas de ferramenta de modelar, impressões digitais visíveis de perto.
- Materiais: massinha de cores diferentes por peça (coronha "madeira" em massa marrom com veios riscados a palito, corpo em massa cinza-grafite, detalhes em massa colorida).
- **Carregador** é um "pão de massa" que o boneco arranca e aperta de volta na recarga. **Cápsulas** ejetadas são bolinhas de massa amarela que quicam e grudam no chão.
- **Luneta da AWP/Scout:** a visão pela luneta é um **anel de massinha** com retícula de fio de arame esticado; ao mirar, o mundo aparece com leve distorção de lente de vidro barato e poeira.
- **Inspeção (tecla F):** o boneco gira a arma e mostra a marca do dedo do "animador" nela.
- **Faca:** espátula de modelar afiada. Herda da katana da referência: segurar o botão direito **bloqueia** projéteis de frente (com durabilidade) e um bloqueio no tempo certo faz **parry** (devolve o tiro e atordoa). Barra de carga que libera um **dash de execução**.
- **Granadas:** HE é uma bola de massa com pavio de barbante (explode em respingos); Flash é massa branca brilhante que "estoura" a tela em branco-massinha; Smoke solta nuvem de algodão de set (fumaça volumétrica fake com sprites em camadas); Molotov é pote de tinta com pano em chamas (fogo de papel celofane laranja animado em stop-motion). Granadas quicam com física e têm arremesso com carga (curto/médio/longo), como na referência.

**Economia (modo Competitivo):** dinheiro inicial $800, máximo $16000. Vitória por eliminação $3250, por bomba/desarme $3500. Bônus de derrota crescente: $1400 → $1900 → $2400 → $2900 → $3400. Plantar a bomba dá $300 ao plantador e $800 ao time mesmo se perder a rodada. Tempo de compra de 20 s dentro da zona de compra.

### 0.8 Modos de jogo

1. **Mata-mata (FFA) com bots:** modo principal. Até 10 participantes (humanos + bots completam as vagas). Primeiro a 30 kills ou 10 min. Respawn em 2 s com proteção de 1,5 s. Por padrão usa a mesma loja do CS com compra livre a cada respawn; o host pode ligar "Economia" (dinheiro por kill com os valores da tabela). Nível de IA configurável por bot ou global.
2. **Mata-mata em Times:** Massa Crua (TR) vs Tropa do Estúdio (CT), 5v5 com bots completando. Primeiro time a 75 kills. Loja igual ao FFA (compra livre ou economia ligada).
3. **Competitivo (bomba):** 5v5, MR12 (vence quem fizer 13 rodadas), troca de lado na rodada 13, prorrogação MR3. Rodada de 1:55, bomba de 40 s, desarme 10 s (5 s com kit). Economia completa da seção 0.7. Bomba = "bolota de massa com relógio de cozinha".
4. **Gun Game / Arms Race:** cada kill troca sua arma para a próxima da lista (pistolas → SMGs → shotguns → rifles → snipers → faca de ouro). Kill com faca rebaixa a vítima uma arma. Vence quem matar com a faca de ouro.
5. **Ondas (solo ou co-op até 4):** igual à referência. Ondas crescentes, chefe a cada 5 ondas, checkpoint a cada chefe derrotado. Inimigos de massinha:
   - **Bolotas** (grunts), **Minhocas** (rushers rápidos que rastejam), **Bolhas-bomba** (bombers que incham e explodem), **Olhudos** (snipers com olho de massinha gigante e laser de linha), **Morcegos de Massa** (flyers), **Tijolões** (heavies lentos que absorvem dano), **Escudeiros** (shield bearers com escudo de tampa de pote).
   - **Chefes:** **O Escultor** (onda 5, gigante que remodela o terreno e cria paredes de massa), **A Espátula** (onda 10, ferramenta viva que corta o mapa em fatias), **O Bolo Misturado** (onda 15, massa de todas as cores que se divide em cópias ao tomar dano).
   - Itens de vida temáticos: **pote de massinha fresca** (cura) e **rolinho de massa** (colete).

### 0.9 Mapas: sets de estúdio de stop-motion

**Conceito:** o boneco tem ~7 cm. O mundo é um **estúdio de animação real** visto na escala dele. Objetos do dia a dia viram arquitetura: um pote de tinta é uma torre, um estilete é uma ponte, um tapete de corte verde com grade é o chão. Nas bordas dos mapas aparecem **equipamentos de estúdio**: tripés de câmera, C-stands, softboxes, rebatedores, fios, a lente gigante da câmera de stop-motion observando a cena. Entre rodadas, uma **mão gigante do animador** entra em cena e reposiciona props (cinemática curta, nunca durante o combate).

Três mapas, cada um com layout competitivo (2 bomb sites A/B, mid, conectores, zonas de compra), rotas para FFA e spawns de Ondas:

1. **Bancada do Animador:** tapete de corte com grade como chão; potes de massinha como prédios; ferramentas de modelar como pontes e cobertura; um estojo de armaduras de arame aberto (site A); a base de uma luminária articulada (site B); rolos de fita crepe como túneis. Luz quente de luminária.
2. **Set da Cidade de Papelão:** um set de cidade em miniatura **pela metade**: fachadas de papelão com a parte de trás exposta (sustentadas por palitos e fita), ruas pintadas, um carrinho de massinha, uma área de chroma key verde, trilhos de travelling da câmera cortando o mapa. Luz azulada de "noite de cinema" com recortes de luz quente.
3. **Prateleira de Adereços:** uma estante gigante com vários andares (verticalidade forte, para aproveitar wall-jump e slide): caixas de papelão abertas, bonecos reserva empilhados, frascos de glitter, carretéis de linha como plataformas, gavetas entreabertas como corredores. Luz de janela lateral com poeira no ar.

**Destrutíveis:** papelão fino rasga com tiros, bolas de massa se deformam e quebram, potes plásticos racham. Marcas de tiro são **amassados e buracos na massa** (deformação real de vértices em superfícies de massinha próximas; decals nos demais materiais).

### 0.10 Rede P2P (WebRTC/PeerJS)

- **Topologia:** host autoritativo P2P (o navegador do host roda a simulação oficial: placar, dano, economia, rodadas e **todos os bots**). Clientes enviam inputs, recebem snapshots.
- **Tick:** simulação a 64 Hz; snapshots a 30 Hz; inputs a 64 Hz, agrupados em pacotes.
- **Netcode:** predição no cliente + reconciliação para o próprio movimento; interpolação de 100 ms para os outros; **lag compensation** no host (rewind das hitboxes até 250 ms para validar tiros). Protocolo binário (`ArrayBuffer`/`DataView`) com quantização e delta compression. Canal não confiável e sem ordem para snapshots/inputs; canal confiável para chat, compras e eventos.
- **Lobby:** jogo rápido, salas públicas (lista via peer "diretório" com ID conhecido) e privadas (código de 6 letras + link de convite). Reentrar na partida após queda. **Migração de host** automática se o host sair (o próximo com menor ping assume, a partir do último snapshot completo).
- **Extras:** chat de texto, chat de voz por proximidade opcional (WebRTC áudio), indicador de ping/perda, kick/ban pelo host, anti-cheat básico no host (limite de velocidade, taxa de tiro, validação de linha de visada).
- **Servidor de sinalização:** PeerJS Cloud por padrão, configurável para um PeerServer próprio. Servidores STUN públicos + campo para TURN.

### 0.11 IA dos bots (local, sem LLM)

Arquitetura em camadas, rodando no host:

1. **Percepção:** cone de visão com oclusão (raycast BVH), audição (passos, tiros, recargas, granadas com raio por tipo), visão reduzida por smoke e flash.
2. **Memória:** última posição conhecida de cada inimigo, com decaimento; posições perigosas aprendidas na partida (onde morreu).
3. **Navegação:** navmesh gerada dos mapas + A* + suavização de caminho + steering (separação entre bots, desvio de obstáculos). Links de navmesh para pulos, wall-jump e slide.
4. **Decisão:** Behavior Tree + Utility AI para escolher objetivos (caçar, segurar ângulo, flanquear, plantar, desarmar, retake, salvar arma, buscar item em Ondas).
5. **Tática:** posições de cobertura pré-calculadas, pré-mira em ângulos comuns, troca de kill (trade), uso de granadas com lineups calculados, rotação entre sites, compra de armas com economia do time (eco, force buy, full buy).
6. **Comunicação:** callouts no chat e com "voz" sintetizada de massinha ("Inimigo no A!").
7. **Personalidade:** cada bot tem nome e perfil (agressivo, suporte, AWPer, lurker).

**Níveis de inteligência (1 a 10)**, parametrizados em `/src/data/botLevels.js`:

| Nível | Nome | Reação | Erro de mira | Controle de spray | Tática |
|---|---|---|---|---|---|
| 1 | Massinha Mole | 900 ms | muito alto | nenhum | anda em linha reta, não usa granadas |
| 3 | Aprendiz | 600 ms | alto | fraco | cobre-se às vezes |
| 5 | Modelador | 400 ms | médio | médio | flanqueia, usa HE e flash |
| 7 | Escultor | 280 ms | baixo | bom | pré-mira, trade, smokes com lineup |
| 9 | Mestre do Stop-Motion | 190 ms | muito baixo | quase perfeito | rotação, economia de time, fakes |
| 10 | Lenda da Massinha | 150 ms | mínimo | perfeito | tudo acima + lê o som, joga em equipe coordenada |

(Níveis intermediários interpolam os valores.) Parâmetros adicionais por nível: velocidade de rastreio, tendência a mirar na cabeça, posicionamento da mira, frequência de counter-strafe, uso de utilitários, agressividade e disciplina de economia. O jogo nunca dá "wallhack" ao bot: ele só sabe o que percebeu.

### 0.12 Personagens: facções + criador

- **Facções:** **Massa Crua** (TR, massas terracota, laranja e vermelho, bandanas de fita crepe) e **Tropa do Estúdio** (CT, azul, verde-água e branco, capacetes de tampinha de garrafa). Cada lado tem **5 modelos prontos** com silhuetas bem distintas (baixinho largo, alto magro, gordinho, etc.).
- **Criador de boneco:** proporções do corpo (sliders), cor da massa com mistura de duas cores (efeito marmorizado), olhos (botões, miçangas, olhos de massinha), boca, sobrancelhas, chapéus e acessórios de miniatura. Em partidas de time, o boneco ganha braçadeira e contorno na cor do time sem perder a personalização.
- **Animação stop-motion:** todas as animações de personagem e viewmodel rodam "em dois" (12 poses/s) com leve variação de forma a cada pose ("boil"), enquanto a câmera e o input continuam a 60+ FPS. Squash & stretch em pulo, pouso, dano e morte.
- **Morte:** o boneco é atingido e **amassa** (achata como massa caindo na mesa) ou **se desfaz em pedaços de massa** com explosão; os pedaços grudam no chão por alguns segundos.

### 0.13 Direção de arte (bíblia visual)

**Moodboard obrigatório** (estude antes de codar e cite quais referências usou em cada decisão visual):
- Claymation/Aardman/Laika: Pinterest "Claymation Set Design" (https://www.pinterest.com/ideas/claymation-set-design/893621988359/), "3D Plasticine" (https://www.pinterest.com/ideas/3d-plasticine/901418997915/), "Clay Illustration" (https://www.pinterest.com/ideas/clay-illustration/925869521463/), "Plastic 3D Style" (https://www.pinterest.com/cokards/plastic-3d-style/)
- Sets de estúdio: Pinterest "Stop Motion Set Design" (https://www.pinterest.com/ideas/stop-motion-set-design/939142592219/), "Stop Motion Set Building" (https://www.pinterest.com/ideas/stop-motion-set-building/913501904960/), "Stop Motion Desk" (https://www.pinterest.com/ideas/stop-motion-desk/951357298077/), guia de estúdio caseiro de Terry Ibele (https://terryibele.com/build-stop-motion-studio-at-home/)
- Jogos: The Neverhood, ClayFighter, Harold Halibut (https://en.wikipedia.org/wiki/Harold_Halibut), lista de jogos em stop-motion (https://www.thegamer.com/games-made-with-claymation/); escala miniatura: Toy Soldiers, Army Men, Small Soldiers
- Técnica de shader de massinha: https://zar67.github.io/Portfolio/assets/ClayRendering/ClayRendering-Report.pdf e http://slamatron.com/blog/2020/04/16/Claymation-Style-in-3D/

**ClayMaterial (shader próprio, `onBeforeCompile` sobre MeshStandard/MeshPhysical ou ShaderMaterial completo):**
- **Impressões digitais:** normal map procedural (espirais/arcos gerados por ruído com distorção de domínio) aplicado em triplanar, escala por objeto, intensidade que aumenta em superfícies "tocadas" (bordas e pontos de pega).
- **Marcas de ferramenta:** riscos finos e amassados de espátula via ruído direcional.
- **Especular em duas camadas:** base fosca (roughness ~0,65–0,8) + camada fina "úmida" com roughness menor, controlável entre massa seca e massa fresca.
- **Subsurface fake:** wrap lighting + leve translucidez de borda com cor saturada da própria massa (massinha nunca fica preta na sombra, a sombra puxa para um tom mais saturado e escuro da mesma cor).
- **Boil de stop-motion:** deslocamento de vértice por ruído 3D cuja seed muda **a cada 1/12 s**, com amplitude pequena (~0,3–0,6% do tamanho do objeto). A seed fica congelada entre as poses, como massa que o animador tocou.
- **Poeira e fiapos:** partículas de poeira nos feixes de luz e fiapos de tecido presos em algumas superfícies.

**Geometria de massinha (`/src/clay/`):** kit de primitivas "moldadas à mão": cilindros, esferas, cápsulas, "cobrinhas" (tubos ao longo de curvas), placas achatadas, tudo com irregularidade de silhueta, bordas arredondadas por subdivisão e ruído, e **costuras** onde duas massas se juntam (leve saliência e mudança de cor). Personagens e armas são montados com esse kit. Considere SDF + marching cubes para peças orgânicas geradas no load, com cache.

**Materiais do set (não-massa):** papelão (ondulado nas bordas cortadas), fita crepe, arame, madeira balsa, metal de ferramenta, plástico de pote, tapete de corte com grade impressa. Cada um com shader próprio, todos com a mesma iluminação suave.

**Iluminação de estúdio:** key light forte e quente com sombra suave (PCF soft / VSM), fill frio de baixa intensidade, rim light de recorte em personagens, luzes de softbox visíveis como formas. Ambient occlusion (SAO/GTAO) para "assentar" a massa. Leve **flicker de exposição** entre poses, como nas animações stop-motion reais (sutil, desligável).

**Pós-processamento:** tone mapping ACES/AgX, SMAA, bloom leve só nas luzes, **tilt-shift/profundidade de campo sutil** para vender a escala de miniatura (mais forte nos menus e killcam, mínimo durante o jogo), grão de filme fino, vinheta suave, leve aberração cromática de lente de câmera de stop-motion na killcam.

**Paleta base (tokens):**
- Massa Crua (TR): terracota `#C8553D`, laranja `#F28F3B`, vermelho `#D1362F`
- Tropa do Estúdio (CT): azul `#2F6DB5`, verde-água `#3FB8AF`, branco-massa `#F4EDE1`
- Set: papelão `#B98B5E`, tapete de corte `#2E6E4E`, madeira `#8C5A3C`, fita crepe `#E8D9A8`, metal `#8F959C`
- UI: papel creme `#F6F0E4`, tinta escura `#2A2320`, destaque amarelo-massinha `#FFD23F`, alerta `#E4572E`

**UI e HUD (tudo com cara de estúdio):**
- Menus como **mesa do animador**: a câmera 3D real passeia sobre a bancada; botões são **letras de massinha** que se deformam no hover (squash), etiquetas de fita crepe, cartões de papelão, a folha de exposição (X-sheet) de animação como tela de configurações.
- **HUD:** vida e colete em bolinhas de massa que se amassam ao levar dano; munição como pequenas bolinhas empilhadas; dinheiro num pedaço de fita crepe escrito à mão; relógio da rodada no **relógio de cozinha** da bomba.
- **Loja (B):** roda radial estilo CS, com cada arma de massinha girando em 3D numa mini-bancada; categorias, preços, atalhos numéricos, compra rápida e loadouts salvos.
- **Killfeed:** ícones de arma em massinha achatada; headshot = marca de digital vermelha.
- **Radar/minimapa:** desenhado como storyboard a lápis, com setas de massinha.
- **Placar (TAB):** quadro de cortiça com fotos polaroid dos bonecos presas por alfinetes.
- **Mira:** editor completo (estilo, cor, espessura, gap, ponto, dinâmica), com códigos de compartilhamento.
- **Tipografia:** uma fonte arredondada e pesada para títulos (ex.: Google Fonts "Baloo 2" ou "Fredoka") + fonte limpa para números do HUD; títulos principais são geometria 3D de massinha.

**Áudio procedural (WebAudio):** tiros sintetizados por arma (transiente + corpo + cauda, com variação por disparo e distância/oclusão), sons de massinha (squish, plop, estalos de amassar), passos por material, recarga (massa sendo arrancada e apertada), UI com "poc" de massa, **música generativa** com instrumentos de brinquedo (xilofone, kazoo, piano de brinquedo, contrabaixo pizzicato) que muda de intensidade com o combate. Áudio espacial com HRTF opcional.

### 0.14 Controles e plataformas

- **PC:** pointer lock, sensibilidade com zoom separada, FOV, teclas totalmente remapeáveis, binds estilo CS (B loja, G largar arma, F inspecionar, E usar/desarmar, Q última arma, 1–5 slots, TAB placar, Y/U chat).
- **Controle (Gamepad API):** layouts PS5/Xbox com ícones corretos, curvas de resposta, deadzone, aim assist leve (slowdown perto do alvo, desligado em salas "somente PC" se o host quiser), vibração.
- **Celular:** joystick virtual esquerdo, área de olhar à direita, botões reposicionáveis e redimensionáveis (editor de layout), tiro automático opcional, giroscópio opcional, preset gráfico "Leve" automático, UI adaptada a telas pequenas e ao entalhe.

### 0.15 Progressão e persistência (IndexedDB, sem conta)

- **XP e níveis:** XP por kill, assistência, vitória, objetivo e desafios diários.
- **Patentes:** 18 patentes com ícones de massinha (de "Massinha Crua I" até "Mestre Animador Supremo"), com rating que sobe/desce em partidas Competitivas (inclusive contra bots, com peso menor).
- **Skins de arma:** padrões procedurais de massinha desbloqueáveis por nível e conquista: marmorizado, glitter, massa de escola desbotada, neon que brilha no escuro, "massa misturada" de criança, madeira falsa, camuflagem de massinha, ouro (Gun Game). Aplicadas pelo mesmo ClayMaterial com parâmetros.
- **Estatísticas:** K/D, HS%, precisão por arma, dano médio por rodada (ADR), vitórias por modo, mapa de calor de mortes por mapa.
- **Conquistas:** ao menos 40, com ícones de massinha (ex.: "Wallbang no papelão", "Parry num tiro de AWP", "Ace com pistola").
- **Replay e killcam:** o host grava snapshots; ao morrer, a **killcam em stop-motion** mostra os últimos 5 s do ponto de vista do matador a 12 fps com grão e tilt-shift. **Melhores momentos** gravados automaticamente (multi-kills, clutches) e um visualizador de replay com câmera livre, pausa, velocidade e linha do tempo.

### 0.16 Configurações gráficas

Presets Leve / Médio / Alto / Ultra + ajustes individuais: escala de resolução, sombras, AO, qualidade do shader de massa (digitais on/off, boil on/off), DOF, bloom, grão, flicker de stop-motion, densidade de partículas, distância de detalhe. Detecção automática de hardware no primeiro acesso. Modos para daltonismo nas cores de time e da mira.

### 0.17 Definição de pronto (vale para todas as fases)

- Sem erros no console. Sem vazamento de memória ao trocar de mapa/partida (verifique `renderer.info`).
- Meta de FPS da seção 0.4 atingida, medida no overlay de debug.
- Visual revisado contra o moodboard: a cena parece stop-motion de massinha, não um protótipo.
- Funciona em Chrome, Edge, Firefox e Safari (desktop e mobile).

---

## PROMPTS POR FASE

> Cole cada fase depois do Mestre. Toda fase começa com: **"Siga o PROMPT 0 (Mestre) à risca. Não simplifique nada."**

### FASE 1 — Fundação do motor

Siga o PROMPT 0 (Mestre) à risca. Não simplifique nada.

Construa a fundação:
- `index.html`, `importmap`, `/vendor` com three, three-mesh-bvh e peerjs em versões fixas; script `npm run dev` com servidor estático.
- `core/`: loop de passo fixo 64 Hz com render interpolado, barramento de eventos, gerenciador de estados (boot → menu → lobby → partida → resultado), RNG com seed, sistema de config com defaults e persistência em IndexedDB.
- `input/`: teclado/mouse com pointer lock, Gamepad API e touch (só a camada de entrada; o layout visual do touch vem na Fase 10), com mapa de ações remapeável.
- `render/`: renderer com presets de qualidade, redimensionamento, pixel ratio adaptativo, detecção de hardware.
- `debug/`: overlay com FPS, ms de CPU/GPU, draw calls, triângulos, memória, e console de comandos (`god`, `noclip`, `give ak47`, `bot_add 5`, `map bancada`).
- Cena de teste: câmera FPS livre numa sala vazia.

**Aceite:** a cena roda estável, overlay funcionando, input dos três tipos detectado e remapeável, zero erros no console.

### FASE 2 — Sistema de massinha e look de estúdio

Siga o PROMPT 0 (Mestre) à risca. Não simplifique nada.

Implemente toda a seção 0.13 (visual):
- `ClayMaterial` completo: impressões digitais procedurais triplanares, marcas de ferramenta, especular em duas camadas, subsurface fake, boil de vértice a 12 poses/s, parâmetros de skin.
- Kit de geometria de massinha (`/src/clay/`): primitivas moldadas à mão, cobrinhas por curva, costuras entre massas, geração SDF + marching cubes com cache.
- Materiais do set: papelão, fita crepe, arame, madeira balsa, metal, plástico, tapete de corte.
- Iluminação de estúdio (key/fill/rim, softboxes visíveis, sombras suaves, AO) e pipeline de pós (ACES/AgX, SMAA, bloom, tilt-shift, grão, vinheta, flicker de exposição), tudo ligado aos presets.
- **Cena-vitrine** (acessível pelo menu de debug): uma mesa com 20 objetos de massinha e de set lado a lado, luz ajustável ao vivo, comparação dos presets.

**Aceite:** a vitrine parece uma foto de set de stop-motion; digitais visíveis de perto; boil perceptível mas sutil; nada fica preto nas sombras; 60 FPS no preset Alto em desktop médio. Descreva quais referências do moodboard guiaram cada escolha.

### FASE 3 — Movimento, física e colisão

Siga o PROMPT 0 (Mestre) à risca. Não simplifique nada.

Implemente a seção 0.6 inteira:
- Controlador de personagem cápsula com colisão BVH, degraus, rampas, deslizamento em paredes.
- Andar, correr, andar silencioso, agachar, pular, air-strafe, bunny hop com penalidade, slide, wall-jump, dano de queda.
- Velocidade por arma, cálculo de inaccuracy de movimento exposto para o sistema de armas.
- Squash & stretch no pouso, marcas de pegada na massa, head-bob e inclinação de câmera configuráveis.
- Pista de testes de movimento (rampas, degraus, paredes para wall-jump, vãos para slide).

**Aceite:** o movimento responde como CS no chão (counter-strafe funcional) e acrescenta slide e wall-jump fluidos; nenhum atravessamento de parede em 10 min de teste.

### FASE 4 — Armas

Siga o PROMPT 0 (Mestre) à risca. Não simplifique nada.

Implemente a seção 0.7 inteira:
- Todas as armas da tabela, com modelo de massinha único cada, viewmodel com animações stop-motion (sacar, atirar, recarregar, inspecionar, correr).
- Hitscan com spread, inaccuracy por movimento, padrões de spray fixos por arma, recoil visual de câmera separado do recoil real.
- Dano por hitbox, colete, capacete, penetração de blindagem, wallbang por material, queda de dano por distância.
- AWP/Scout/AUG/SG com luneta de anel de massinha e distorção; FAMAS com rajada; USP-S e M4A1-S com silenciador removível.
- Faca: golpe leve/forte, backstab, bloqueio com durabilidade, parry, barra de carga e dash de execução.
- Granadas HE, Flash, Smoke, Molotov/Incendiária, Decoy, com física de quique, arremesso com carga e efeitos da seção 0.7.
- Efeitos: cápsulas de massa que grudam, amassados na massa atingida, respingos, tracers, luz de disparo.
- Campo de tiro com alvos de massinha, medidor de DPS e visualizador de padrão de spray.

**Aceite:** cada arma tem sensação distinta; padrões de spray reproduzíveis; wallbang varia por material; smoke bloqueia visão de verdade (inclusive para raycast de bots).

### FASE 5 — Personagens

Siga o PROMPT 0 (Mestre) à risca. Não simplifique nada.

Implemente a seção 0.12:
- 5 modelos prontos por facção, gerados com o kit de massinha, cada um com silhueta reconhecível.
- Criador de boneco completo, com pré-visualização 3D na bancada e salvamento de presets.
- Rig simples procedural, animações em "dois" (andar, correr, agachar, pular, slide, wall-jump, atirar por categoria de arma, recarregar, lançar granada, dano, morte por amassamento e por explosão em pedaços).
- Hitboxes alinhadas à pose atual (usadas pelo lag compensation depois).
- Braçadeira e contorno de time sem perder a personalização.

**Aceite:** à distância de combate, dá para identificar time e silhueta em menos de meio segundo; animações lidas como stop-motion de verdade.

### FASE 6 — Mapas de estúdio

Siga o PROMPT 0 (Mestre) à risca. Não simplifique nada.

Implemente a seção 0.9:
- Os 3 mapas (Bancada do Animador, Set da Cidade de Papelão, Prateleira de Adereços), construídos proceduralmente com os materiais do set e a massinha.
- Layout competitivo com sites A/B, mid, zonas de compra, spawns de FFA e Ondas; bordas com equipamentos de estúdio e a lente da câmera.
- Destrutíveis (papelão rasga, massa amassa, pote racha) sincronizáveis pela rede.
- Iluminação própria por mapa, cinemática da mão do animador entre rodadas.
- Geração de navmesh (recast-navigation ou própria) com links de pulo/wall-jump/slide, e dados de cobertura e ângulos para a IA.
- Otimização: instancing, merge de geometria estática, LOD, culling por zonas.

**Aceite:** cada mapa é jogável de ponta a ponta em todos os modos, sem pontos presos; 60 FPS no preset Alto; a escala miniatura é óbvia ao primeiro olhar.

### FASE 7 — IA dos bots

Siga o PROMPT 0 (Mestre) à risca. Não simplifique nada.

Implemente a seção 0.11 inteira: percepção, memória, navegação, behavior tree + utility AI, tática, uso de granadas com lineups, economia de time, comunicação, personalidades e os 10 níveis parametrizados.
- Comando de debug para ver o que cada bot vê, ouve, lembra e decide.
- Painel para escolher nível global ou por bot.
- Teste automático: partidas bot x bot em cada nível, registrando K/D, precisão e tempo de reação médio, para provar que o nível escala de forma monotônica.

**Aceite:** nível 1 é fácil para um iniciante; nível 10 dá trabalho para um jogador experiente sem trapacear (sem wallhack, sem mira instantânea impossível).

### FASE 8 — Modos de jogo e economia

Siga o PROMPT 0 (Mestre) à risca. Não simplifique nada.

Implemente a seção 0.8 inteira e a economia da seção 0.7:
- Mata-mata FFA com bots, Mata-mata em Times, Competitivo com bomba (plantar, desarmar, kit, troca de lado, prorrogação), Gun Game, Ondas (7 inimigos, 3 chefes, checkpoints, itens de vida).
- Loja completa com zona e tempo de compra, largar/pegar armas do chão, dar arma para aliado.
- Tela de fim de partida com MVP, estatísticas e XP ganho.

**Aceite:** uma partida Competitiva completa de 5v5 com bots roda do início ao fim sem erro; a economia bate com os valores de `/src/data/`.

### FASE 9 — Multiplayer P2P

Siga o PROMPT 0 (Mestre) à risca. Não simplifique nada.

Implemente a seção 0.10 inteira: PeerJS, lobby (jogo rápido, público, privado, código e link), protocolo binário com delta, predição e reconciliação, interpolação, lag compensation, canais confiável/não confiável, reentrada, migração de host, chat de texto e voz por proximidade, kick/ban, anti-cheat básico.
- Simulador de rede no debug (latência, jitter e perda ajustáveis).

**Aceite:** 10 participantes (humanos + bots) numa sala com 150 ms de ping simulado e 2% de perda continuam jogáveis; o host cair não encerra a partida.

### FASE 10 — UI, HUD e menus

Siga o PROMPT 0 (Mestre) à risca. Não simplifique nada.

Implemente toda a UI da seção 0.13 e os controles da seção 0.14:
- Menu principal na bancada 3D com letras de massinha, lobby, criador de boneco, loja radial, HUD completo, killfeed, radar storyboard, placar de cortiça, chat, editor de mira, configurações em folha de exposição (gráficos, áudio, controles, acessibilidade, rede).
- Layout touch com editor de posição/tamanho dos botões; ícones corretos por controle; navegação de menus 100% por controle.
- Transições e microanimações de massinha em tudo (hover, clique, abrir/fechar).

**Aceite:** toda a UI funciona com mouse, controle e toque; nenhum elemento parece padrão de navegador; legível em 360×640 até 4K.

### FASE 11 — Progressão, skins, estatísticas e replay

Siga o PROMPT 0 (Mestre) à risca. Não simplifique nada.

Implemente a seção 0.15 inteira: XP, níveis, 18 patentes, rating, skins procedurais, estatísticas com mapa de calor, 40+ conquistas, killcam em stop-motion, melhores momentos automáticos e visualizador de replay com câmera livre. Tudo salvo em IndexedDB com exportar/importar perfil (arquivo JSON).

**Aceite:** o progresso sobrevive a recarregar a página; a killcam aparece em até 1 s após a morte; um replay salvo toca do início ao fim.

### FASE 12 — Áudio procedural

Siga o PROMPT 0 (Mestre) à risca. Não simplifique nada.

Implemente o áudio da seção 0.13: síntese de todas as armas (distintas entre si, com variação e atenuação por distância e oclusão), sons de massinha, passos por material, recargas, granadas, UI, callouts dos bots com voz sintetizada de massinha e a música generativa de brinquedo com intensidade dinâmica. Mixer com volumes por canal.

**Aceite:** dá para reconhecer a arma de um inimigo só pelo som; passos indicam direção com clareza (informação competitiva); nenhum clipping.

### FASE 13 — Polimento, desempenho e QA

Siga o PROMPT 0 (Mestre) à risca. Não simplifique nada.

- Perfilamento completo (CPU, GPU, memória, rede), eliminação de gargalos, pooling de objetos, compilação antecipada de shaders para evitar travadas.
- Revisão visual contra o moodboard em todos os mapas, menus e efeitos: liste 20 melhorias estéticas e implemente todas.
- Game feel: hit markers, sons de acerto na cabeça, screen shake leve, pausa curta nos kills, feedback de dano direcional.
- Testes em `/tests/` para economia, dano, recoil, protocolo e IA; checklist manual por navegador e dispositivo.
- PWA (manifest + service worker) para instalar e jogar em tela cheia; deploy estático (Vercel/Netlify) com instruções.
- README com como rodar, jogar, hospedar e configurar TURN/PeerServer.

**Aceite:** todos os itens da seção 0.17 cumpridos; lista final de tudo o que foi entregue comparada item por item com o PROMPT 0.

