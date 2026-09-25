# MASSACRE — Progresso por fase

Fonte da especificação: `CLAUDE.md.md` (PROMPT 0 + Fases 1–13). Regras permanentes: `CLAUDE.md`.
Bíblia visual (Pinterest): `docs/art/moodboard.md` + folha de contato `docs/art/moodboard.html`.

## Como rodar

```
npm install        # só para atualizar /vendor ou rodar testes
npm run dev        # http://localhost:5173 (só nesta máquina)
npm run dev:lan    # abre na rede local (celular / amigos na mesma Wi-Fi)
npm test           # testes de lógica pura (node --test)
npm run vendor     # recopia three / three-mesh-bvh / peerjs fixados para /vendor
```

O servidor de desenvolvimento só atende GET/HEAD e nunca serve arquivos ocultos (`.claude`, `.git`...) nem `node_modules`.

## Convenções de arquitetura (valem para todas as fases)

- `src/main.js` é a raiz de composição: cria os serviços e registra os estados. O objeto `services`
  (events, log, store, config, render, quality, input, rebinder, loop, states, rng, cheats, roster,
  localLoadout, sv, focusNav, toasts, uiRoot, debugRoot, touchLayer, overlay, console) é passado aos estados.
  `sv` são as variáveis `sv_*` de movimento em tempo de execução (valores do CS:GO; no online o host as replica).
- Loop: `input.frameStart()` (controle + olhar) → N ticks de 1/64 s (`input.sampleTick()` + `states.tick`)
  → `states.frame(alpha)` → `render.render()` → overlay. Olhar por quadro; ações/movimento por tick.
- Estados: boot (`core/bootState.js`) → menu (`ui/menuState.js`) → lobby (`ui/lobbyState.js`) →
  partida (`modes/matchState.js`) → resultado (`ui/resultState.js`). Transições em `core/stateMachine.js`.
- Mapas se registram em `src/maps/registry.js` (import em `src/maps/index.js`); `map <id>` e o lobby listam o registro.
- Colisão (Fase 3): mapa andável entrega `collision` no MapInstance — um `CollisionWorld` montado com o
  `ColliderBuilder` (`src/physics/colliders.js`), separado da malha visual (boil, digitais e empeno não viram
  tropeço; massinha densa vira forma simples; props lisos entram com a própria malha por `object`). Com ela a partida
  usa o `PlayerPawn` (anda com a cápsula); sem ela, a câmera livre. O movimento é `playerMove(state, cmd, env)`,
  função sobre dados que a predição da rede (Fase 9) e os bots (Fase 7) vão reaproveitar só gerando outro `cmd`.
  Números de movimento em `src/data/movement.js`, materiais de superfície em `src/data/surfaces.js`.
- Render: `render/postPipeline.js` (cena → alvo HDR MSAA com profundidade → passes de CENA (AO, DOF: leem a
  profundidade) → camadas (arma, alvo próprio com profundidade, composição "sobre") → passes HDR de luz (bloom) →
  OutputPass (tone mapping) → passes LDR (SMAA, lente) → tela). `render/postEffects.js` monta os passes, liga-os
  à config e aplica o contexto de câmera (`jogo`, `vitrine`, `menu`, `killcam` em `data/postFx.js`); mapas pedem
  o seu com `post: { context, exposure }` no MapInstance. Cada passe tem `name` e vira etapa do cronômetro de GPU.
- Recuperação de contexto WebGL: `render/contextRestore.js` tira os ouvintes de 'dispose' do contexto morto antes
  de qualquer sistema reassar/liberar recursos (senão o three apaga objetos que não existem mais). Quem guarda
  conteúdo assado (atlas, texturas do set, mapa de ambiente da montagem de luz) reassa em `EV.RENDER_CONTEXT`.
- Config: esquema em `src/data/configSchema.js`; cada fase acrescenta as chaves que consome.
- Dados de balanceamento só em `src/data/*.js`.
- Escrita de arquivos: a ferramenta Write voltou a funcionar (2026-09-24); o desktop-commander continua como reserva.
- Painel do navegador do app pode ficar oculto (rAF parado): o loop tem watchdog com setTimeout; para testar, dirigir
  quadros com `setInterval(() => massacre.loop.frame(performance.now()), 16)` no console da página.
- Painel do navegador: o servidor de preview lê `.claude/launch.json` da pasta-mãe (`game tiro/`), que chama
  `Game tiro/tools/dev-server.mjs` (`massacre-dev` na 5173; `massacre-dev-auto` pega uma porta livre pela variável
  PORT quando a 5173 já está em uso). Emular largura < 768 px liga a emulação de celular (UA Android + toque) e a
  detecção de hardware classifica como "mobile" — use 698×392 só para inspeção visual e ≥ 1280 para medir.
- Máquina de desenvolvimento: NVIDIA RTX 2070 (não Iris Xe). Metas de GPU integrada são estimadas: o quadro do
  preset Alto em 1080p precisa ficar em ~3 ms nesta placa para caber em 16,6 ms numa Iris Xe (~5× mais lenta).
  Cuidado ao ler o cronômetro de GPU: a etapa "cena" inclui a espera da GPU pelo envio dos draws (~13 µs por draw
  nesta máquina, não escala com a resolução) — para separar custo fixo de custo por pixel, meça em duas escalas.
  O monitor desta máquina é de 144 Hz (o FPS da varredura satura em 144) e o Windows usa escala de 125%
  (1920×1080 CSS = 2400×1350 de desenho com escala 1; `r_scale 0.8` dá 1080p exato).
- Mapas estáticos pedem `staticShadows: true` no MapInstance: o mapa de sombra só é refeito quando a cena entra, a
  qualidade de sombra muda ou o contexto volta (`render.invalidateShadows()` força). Funciona porque o passe de
  sombra usa a profundidade padrão do three (sem o boil da massinha): numa cena parada o mapa é igual quadro a
  quadro. Mapas com coisas que se movem (bonecos, props destrutíveis) ficam com a sombra dinâmica.

## Fase 1 — Fundação do motor ✅

Entregue em 2026-09-24. Detalhes no relatório abaixo.

- Motor: loop 64 Hz com render interpolado e watchdog; eventos; máquina de estados; RNG sfc32/cyrb128; config com
  esquema + IndexedDB (fallback em memória); log com espelho no console.
- Entrada: teclado/mouse (pointer lock com entrada bruta, filtro de picos), Gamepad API (PS5/PS4/Xbox/Switch, zona
  morta radial, 3 curvas, vibração), toque (joystick flutuante, olhar, botões virtuais, giroscópio), mapa de ações
  remapeável com conflito estilo CS, rótulos no layout real do teclado (ABNT2) e ícones por fabricante.
- Render: WebGLRenderer + pipeline próprio de pós, presets Leve/Médio/Alto/Ultra + ajustes individuais,
  resolução dinâmica guiada por tempo de GPU, detecção de hardware + micro-benchmark (timer query), recuperação de contexto.
- Debug: overlay (FPS, 1% low, CPU sim/render, GPU, draw calls, triângulos, memória, ticks, pose, entrada, estado,
  gráfico) e console com ~35 comandos (god, noclip, give, bot_add, map, set/get, bind, setpos...).
- Cena: sala de testes com câmera FPS livre (aceleração/atrito do CS, colisão com as paredes, noclip).
- UI DOM com a linguagem de estúdio (até a Fase 10): boot, menu, lobby local, resultado, pausa, configurações em
  folha de exposição, remapeamento, navegação 100% por controle/teclado.
- Testes: 32 testes (`npm test`).

### Revisão independente da Fase 1 (18 achados, todos corrigidos)

- Ctrl+W (agachar + andar) fechava a aba: `beforeunload` durante a partida + botão "Tela cheia" na pausa com
  Keyboard Lock (Chromium), que entrega Ctrl+W/Ctrl+T ao jogo.
- Pausa aberta por controle/toque/Esc com Keyboard Lock agora solta o cursor (`exitPointerLock`).
- `autoClear` desligado só durante cena + camadas no pipeline (a camada da arma apagaria a cena).
- Resolução dinâmica: orçamento = máx(alvo, limite de FPS, taxa do monitor medida nos menus) — não derruba a
  resolução perseguindo 144 FPS num monitor de 60 Hz nem com limite de 30.
- Limite de FPS sem deriva (`FramePacer`): 50 FPS num monitor de 60 Hz fica em 50, não 30.
- Timer de GPU refeito quando o contexto WebGL é perdido/recuperado.
- Configurações fecham se o estado do jogo mudar; "Detectar hardware de novo" não redesenha uma folha fechada;
  cartões de mapa do lobby mantêm o foco do controle; foco visível (`.nav-keys :focus`).
- Console: `map`/`quit` validam a transição e mostram falhas no próprio console; `give` aceita qualquer caixa e
  apelidos de itens (`give goldenknife`, `give colete`, `give fumaça`).
- Nome da GPU para ANGLE Metal, ANGLE Vulkan, Mesa e o "or similar" do Firefox.
- Sem alocação por quadro no pipeline, no controle, no toque e na navegação por foco.
- Servidor de desenvolvimento restrito a 127.0.0.1 por padrão, sem arquivos ocultos/node_modules.

## Fase 2 — Sistema de massinha e look de estúdio ✅

Entregue em 2026-09-24 (relatório final no fim desta seção). Plano técnico e aceite: `docs/phases/phase-2.md`.
Subfases 2.1–2.4 (texturas procedurais, ClayMaterial, kit de geometria + SDF, materiais do set e montagem de luz)
prontas antes da 2.5.

### Subfase 2.5 — Pós-processamento de estúdio + luz ligada ✅ (2026-09-24)

Referências novas estudadas no Pinterest (boards Tilt Shift, Stop Motion Aesthetic, Stop Motion Lighting e
Behind the Scenes) e leituras de fotografia de stop-motion (Tristan Oliver/*Isle of Dogs*, AWN): moodboard item 9,
com uma decisão técnica por observação e o arquivo que a implementa.

Arquivos criados:
- `src/data/postFx.js` — todos os números do pós (AO, bloom, DOF, lente, flicker) e os contextos de câmera.
- `src/render/passes/common.js` — alvos, material de tela cheia, GLSL comum (luminância, profundidade linear, hash).
- `src/render/passes/aoPass.js` — GTAO (shader do three/addons) em meia/cheia resolução a partir da profundidade
  da cena, desruído bilateral separável, upsample conjunto e composição colorida que poupa as luzes.
- `src/render/passes/dofPass.js` — CoC por profundidade + faixa de tilt, autofoco na mira calculado na GPU
  (histórico 1×1, transição em dioptrias), pré-filtro 1/2, bokeh em disco (espiral de ângulo dourado,
  Gustafsson 2018) e composição com a CoC exata.
- `src/render/passes/bloomPass.js` — pré-filtro com média de Karis + limiar suave, cadeia de mips de 13 amostras,
  subida em tenda aditiva e halo âmbar (halação).
- `src/render/passes/smaaPass.js` — SMAA do three com limpeza preta garantida (o renderer limpa com o marrom do estúdio).
- `src/render/passes/lensPass.js` — aberração radial, grade "massinha" (vibrance, S suave, tungstênio), vinheta
  marrom-quente, grão por pose a partir de textura assada (2 leituras/pixel) e dithering.
- `src/render/postEffects.js` — monta os passes, liga à config (`graphics.ao/bloom/dof/smaa/grain/vignette/flicker`,
  `accessibility.reduceMotion`), contextos, foco manual/automático, vistas de diagnóstico e flicker de exposição.
- `src/render/contextRestore.js` — recuperação de contexto WebGL sem rajada de INVALID_OPERATION.
- `src/debug/postCommands.js` — `post`, `post_view <final|ao|coc|bloom>`, `post_ctx <jogo|vitrine|menu|killcam>`,
  `foco [auto|u]`, `r_ao`, `r_dof`, `r_bloom`, `r_smaa`, `r_grain`, `r_vignette`, `r_flicker`, `gpu`.
- `tests/post.test.js` — 8 testes (cronômetro por etapa com WebGL simulado, dados, presets, recuperação de contexto).

Arquivos alterados:
- `src/render/postPipeline.js` — estágios cena/camadas/luz/exibição, camada da arma em alvo próprio, contexto do
  quadro para os passes, etapas no cronômetro de GPU.
- `src/render/gpuTimer.js` — tempo de GPU por etapa (consultas sequenciais, média móvel, ordem do pipeline).
- `src/render/renderSystem.js` — cria o PostEffects, exposição por quadro, etapas no `stats()`, registro de
  ouvintes para a recuperação de contexto.
- `src/maps/testRoom.js` — tapete de corte, paredes de papelão ondulado, fita crepe, montagem de luz `testroom`
  (equipamento visível, poeira, ambiente), boneco de referência de 72 u em massinha, pote e espátula.
- `src/modes/matchState.js` — aplica o contexto de pós do mapa ao entrar e volta para `jogo` ao sair.
- `src/debug/overlay.js` — linha "GPU por etapa" no modo completo; `src/debug/commands.js` registra os comandos novos.
- `src/ui/settingsScreen.js` + `src/ui/settingControls.js` — seções "Massinha", "Lente e luz de estúdio" e "Conforto".
- `docs/art/moodboard.md`, `moodboard.html`, `pinterest-boards.json` — boards TSH, SMA, SML, BTS e item 9.

Como testar:
1. `npm test` → 58 testes passando.
2. `npm run dev`, abrir http://localhost:5173 → "Sala de testes". F3 duas vezes = overlay completo com "GPU por etapa".
3. Console (tecla `): `post` (estado), `post_view ao` / `coc` / `bloom` / `final`, `post_ctx menu` (tilt-shift forte),
   `post_ctx killcam` (aberração e foco raso), `foco 300` / `foco auto`, `r_preset leve|medio|alto|ultra`, `gpu`.
4. Configurações → Gráficos: mexer em AO, bloom, DOF, SMAA, grão, vinheta, flicker e poeira; o preset vira
   "Personalizado" e volta a bater quando os valores coincidem.

Medições (RTX 2070, 1920×1080, sala de testes): Leve 2,8 ms · Médio 3,4 ms · Alto 3,4 ms · Ultra 4,6 ms de GPU por
quadro (cena ~1,2–1,7 · AO meia 0,55 / cheia 2,25 · DOF 0,3 · bloom 0,3 · SMAA 0,4 · lente 0,1).

Checklist da subfase:
- [x] AO (GTAO) com níveis meia/cheia, composição colorida, sem halo nas silhuetas nem nas luzes.
- [x] Bloom só nas luzes (limiar HDR 2,4 com joelho), halo âmbar, mips adaptados à resolução.
- [x] DOF/tilt-shift por contexto: mínimo no jogo, tilt-shift no menu, foco raso + aberração na killcam; autofoco
      na mira sem leitura da GPU na CPU; vista de CoC para diagnóstico.
- [x] SMAA, tone mapping AgX/ACES, grão por pose, vinheta quente, grade "massinha", dithering, flicker de exposição
      por pose (desligável e anulado por "reduzir movimento").
- [x] Tudo ligado aos presets Leve/Médio/Alto/Ultra e aos ajustes individuais (e visível na folha de configurações).
- [x] Luz de estúdio real na sala de testes (key/fill/rim, equipamento visível, poeira, ambiente com softboxes).
- [x] Sem erros de GL/console em todos os presets, alternâncias, contextos e vistas; sem vazamento ao sair e entrar
      no mapa 3× (25 geometrias / 36 texturas estáveis); perda + recuperação de contexto sem nenhum erro de GL.
- [x] Arquivos novos abaixo de 600 linhas; números só em `src/data/`.

### Subfase 2.6 — Vitrine, revisão do look e aceite da Fase 2 ✅ (2026-09-24)

Pesquisa nova no Pinterest antes do trabalho visual: 13 boards (Clay Texture, Fingerprint in Clay, Marbled Polymer
Clay, Glitter Playdough, Glow in the Dark Clay, Play Doh, Tape Rolls, Stop Motion Armature, Claymation Figures,
Aardman Characters, Miniature Food Photography Props, Plasticine Ideas, Stop Motion Rig — prefixos CLT … SMR),
~230 pins na folha de contato e o item 10 do moodboard com observação → referências → decisão → arquivo.
As capturas da vitrine mostraram o que precisava mudar no look (digitais com cara de trama de tecido e apagadas por
luz cruzada, marmorizado picotado, glitter sem brilho, rocambole feito de cobrinha esticada, silhuetas "cabeludas"
no DOF) e cada item foi refeito contra as fotos.

Arquivos criados:
- `src/maps/vitrine.js` — mapa `vitrine`: bancada, montagem de luz `vitrine`, varredura, painel, contexto de pós
  `vitrine`, voo a 42% da velocidade, sombra estática; reassa o ambiente quando o contexto WebGL volta.
- `src/data/showcase.js` — mesa, tapete A1, grade 5 × 4, etiquetas, câmera, os 20 objetos (com as referências de
  cada um), números da varredura, faixas do painel e o diagnóstico "massa preta".
- `src/debug/showcase.js` — bancada: mesa, tapete de corte, chão de molleton, os 20 objetos na grade, etiquetas de
  fita escritas a caneta e multiplicadores de massinha que preservam a diferença entre os objetos.
- `src/debug/showcaseObjects.js` — construtores dos 20 objetos (kit, SDF e materiais do set).
- `src/debug/showcasePanel.js` + `styles/showcase.css` — painel de fita crepe ao vivo (luzes em lx/K, rebote,
  ambiente, massinha, massa preta, contexto, foco, exposição, presets, varredura e tabela), navegável por controle.
- `src/debug/showcaseCommands.js` — `vitrine`, `varredura [cancelar]`, `luz [id] [lx] [K]`,
  `massinha [umidade|boil|digitais] [×]`, `r_massa_preta [0|1]`.
- `src/debug/presetSweep.js` — varredura automática de presets com estatística pura testada (FPS, 1% low, p95,
  GPU/CPU por quadro, tabela com a estimativa de GPU integrada).
- `src/clay/set/labelAtlas.js` — atlas de texto das etiquetas (letra a letra com giro, base e tamanho variados).
- `src/clay/kit/scaleMarker.js` — boneco de referência de 72 u (sala de testes e vitrine).
- `src/clay/sdf/materialSplit.js` — corte exato das fronteiras de cor da malha do marching cubes.
- `tools/moodboard.mjs` (+ `npm run moodboard`) — gera `docs/art/moodboard.html` a partir de `pinterest-boards.json`
  (`?inteira`, `?grande`, `?colunas=N&altura=PX`, `#PREFIXO`).
- `tests/showcase.test.js` (6 testes); `tests/sdfMesh.test.js` + `tests/sdfTestUtils.js` — o `sdf.test.js` passou
  de 600 linhas e foi dividido (formas/operações/poda × malhas/fronteiras/SdfMesher).

Arquivos alterados:
- `src/clay/atlases.js` — digitais refeitas: bacia rasa com lábio, sulcos de espaçamento constante com minúcias,
  agrupamento onde a peça foi segurada, `uDent` 8,5, `uRidgeAmp` 0,66, `uPresence` 0,62.
- `src/clay/ClayMaterial.js` — segunda camada de digitais em peças tocadas, micro-oclusão do sulco, wrap/SSS/rim na
  normal geométrica (relevo fino por cima), glitter holográfico (difração da 1ª ordem de grade cruzada), sonda de
  massa preta.
- `src/clay/glsl/skins.js` + `src/data/claySkins.js` — marmorizado (poucas faixas largas, dobra, mistura parcial,
  veio) e glitter (duas populações de flocos com cor própria, inclinação e grade por floco, pérola de longe).
- `src/clay/claySystem.js` — `setBlackProbe()` (recompila as massinhas com o diagnóstico).
- `src/clay/set/paperMaterials.js` + `src/clay/set/index.js` — lateral do rolo de fita crepe e material de etiqueta.
- `src/clay/sdf/shapes.js`, `params.js`, `bounds.js`, `nodes.js` — forma `spiral` (distância exata, janela angular,
  extrusão arredondada, suporte conservador).
- `src/clay/sdf/marchingCubes.js`, `sdfMesher.js` — fronteiras de material cortadas, triângulos ordenados por
  material, estatística `boundarySplits`, cache `v2`.
- `src/render/renderSystem.js`, `src/modes/matchState.js`, `src/maps/registry.js` — sombra estática por mapa
  (`staticShadows`) e velocidade de voo por mapa (`move.speedScale`).
- `src/render/passes/dofPass.js`, `src/render/passes/common.js` — disco girado por ruído de gradiente intercalado e
  pós-filtro em tenda 3×3.
- `src/data/studioRigs.js` — rim da vitrine no alto e atrás.
- `src/maps/index.js` (registra a vitrine), `src/maps/testRoom.js` (boneco de escala do kit),
  `src/player/freeCamera.js` (`speedScale` por mapa), `src/debug/commands.js` (comandos da vitrine),
  `src/ui/menuState.js` (botão "Vitrine de massinha"), `index.html` (`styles/showcase.css`), `package.json`
  (script `moodboard`), `tests/sdf.test.js` (árvore do rocambole e teste da espiral; as malhas, com os testes novos
  de fronteira exata entre duas e três massas, foram para `tests/sdfMesh.test.js`).
- `docs/art/moodboard.md` (boards novos + item 10), `docs/art/moodboard.html`, `docs/art/pinterest-boards.json`,
  `docs/phases/phase-2.md`; `.claude/launch.json` da pasta-mãe (`massacre-dev-auto`).

Como testar:
1. `npm test` → 66 testes passando.
2. `npm run dev`, abrir http://localhost:5173 → menu principal → **Vitrine de massinha** (ou console `vitrine`).
3. Voo livre (WASD, mais lento na vitrine): chegar a um palmo da linha da frente — placa de digitais, massa fresca ×
   massa seca, marmorizado, glitter (andar em volta para ver a cintilância mudar); rolinho, cabeça e amassado SDF.
4. **Tab** solta o mouse no painel de fita crepe: mexer em lx/K de cada luz, rebote, ambiente, umidade/boil/digitais,
   "massa preta", contexto (`vitrine`/`jogo`/`menu`/`killcam`), foco e presets; **Varredura** mede os 4 presets com a
   câmera parada e mostra a tabela.
5. Console: `varredura`, `luz key 8 3000`, `massinha digitais 2`, `r_massa_preta 1` (nada deve ficar magenta),
   `post_ctx killcam`, `foco auto`. F3 duas vezes: overlay com "GPU por etapa".
6. `npm run moodboard` e abrir `/docs/art/moodboard.html#FPC` para ver as referências novas.

Medições (RTX 2070 via ANGLE/D3D11, monitor de 144 Hz, janela 1920×1080 com escala do Windows de 125%).
Varredura da vitrine, resolução de cada preset travada:

| Preset | Resolução | FPS | 1% low | GPU | GPU p95 | CPU | Draws | GPU×5 (Iris Xe) |
|---|---|---|---|---|---|---|---|---|
| Leve | 1440×810 | 144 | 99 | 2,96 ms | 4,80 ms | 3,05 ms | 98 | 14,8 ms — cabe |
| Médio | 2160×1215 | 144 | 86 | 5,48 ms | 7,06 ms | 3,41 ms | 119 | 27,4 ms |
| Alto | 2400×1350 | 144 | 112 | 5,96 ms | 7,27 ms | 3,44 ms | 119 | 29,8 ms |
| Ultra | 2400×1350 | 126 | 73 | 7,48 ms | 8,79 ms | 3,33 ms | 119 | 37,4 ms |

Em 1080p exato (`r_scale 0.8`): vitrine Leve 2,66 ms (1536×864) · Médio 4,96 · Alto 5,06 · Ultra 5,64 ms; sala de
testes Leve 2,02 · Médio 3,07 · **Alto 3,25** · Ultra 4,53 ms. Etapas no Alto 1080p (vitrine): cena 2,73 · AO 1,01 ·
DOF 0,63 · bloom 0,40 · saída 0,08 · SMAA 0,37 · lente 0,08. A etapa "cena" tem ~1,5 ms que não escala com a
resolução (espera pelo envio de 119 draws — as 20 etiquetas sozinhas somam ~0,3 ms): aplicando ×5 só ao que escala
com pixels, a vitrine no Alto 1080p fica em ~18–19 ms numa Iris Xe (~53 FPS); a sala de testes fica em ~16 ms
mesmo pelo ×5 puro.
Sombra estática: ~1,4 ms a menos por quadro na vitrine (Leve). Memória: 88 geometrias / 38 texturas / 44 programas
dentro da vitrine, 2 / 34 / 19 no menu, iguais em 3 ciclos de entrar e sair; cena, bancada, luzes, painel e varredura
são coletados ao sair (conferido com WeakRef). Entrar na vitrine: ~6 s com o cache (SDF no IndexedDB + shaders do
navegador); a primeira vez, sem cache, leva mais (malhas SDF nos Workers + compilação D3D).

Checklist da subfase:
- [x] Referências novas no Pinterest (13 boards), folha de contato regenerada e moodboard item 10 com a decisão e o
      arquivo de cada observação.
- [x] Vitrine com 20 objetos de massinha e do set, etiquetas de fita crepe escritas a caneta, acessível pelo menu,
      pelo lobby e pelo console.
- [x] Painel de luz ao vivo (Tab) com presets e varredura automática (GPU/CPU/FPS/1% low por preset, tabela
      comparativa e estimativa de GPU integrada); tudo restaurado ao fim ou ao cancelar.
- [x] Material das laterais do rolo de fita crepe (camadas pelo raio, cola com poeira).
- [x] Digitais revistas de perto: escala real de dedo, agrupamento, sobreposição, micro-oclusão; a meia distância não
      lembram mais trama de tecido e continuam visíveis sob luz cruzada.
- [x] Marmorizado e glitter refeitos contra MPC/GPD; rocambole com espiral SDF e fronteira de cor exata.
- [x] DOF sem silhuetas "cabeludas"; sombra estática para mapas parados.
- [x] Sem erros no console (carga nova + vitrine + sala de testes); sem vazamento em 3 ciclos.
- [x] 66 testes passando; nenhum arquivo acima de 600 linhas; números visuais em `src/data/`.

### Relatório final da Fase 2 — sistema de massinha e look de estúdio

O que a fase entregou (detalhes técnicos em `docs/phases/phase-2.md`, referência de cada decisão em
`docs/art/moodboard.md`):
- **Superfície da massinha** (moodboard 1 e 10): atlas procedurais de digitais e de ferramenta assados na GPU;
  `ClayMaterial` com digitais triplanares no espaço do objeto (duas camadas nas peças tocadas), marcas de espátula,
  especular em duas camadas (base fosca + filme úmido), subsurface falso (wrap e terminador saturados pela forma,
  rim em contraluz), piso de sombra saturado, costuras, fiapos/poeira, boil de vértice a 12 poses/s e 9 skins
  (liso, marmorizado, glitter holográfico, escolar desbotada, neon, misturada, madeira falsa, camuflagem, ouro).
- **Geometria** (moodboard 1 e 10): kit de primitivas moldadas à mão com costuras e atributos de toque/cavidade, e
  SDF + marching cubes em Workers com poda por intervalos, forma espiral, fronteiras de cor exatas e cache IndexedDB.
- **Set** (moodboard 3 e 4): papelão ondulado com corte mostrando a onda, fita crepe (tira, rolo com laterais,
  etiqueta escrita), arame, balsa, metal de ferramenta, plástico de pote, tapete de corte com grade e riscos.
- **Luz de estúdio** (moodboard 2 e 3): montagens por mapa com key de tungstênio, fill frio, rim, luminária prática,
  softboxes/fresnéis visíveis, poeira nos feixes, ambiente assado das softboxes, sombra suave (e estática quando o
  mapa é parado).
- **Pós** (moodboard 8 e 9): GTAO colorido, DOF/tilt-shift por contexto com autofoco, bloom só nas luzes, AgX/ACES,
  SMAA, lente (aberração, grade "massinha", vinheta quente, grão por pose, dithering), flicker de exposição — tudo
  ligado aos presets Leve/Médio/Alto/Ultra e aos ajustes individuais.
- **Vitrine** e ferramentas de aceite: 20 objetos, painel ao vivo, varredura de presets, diagnóstico "massa preta".

Aceite da Fase 2 (PROMPT, Fase 2):
- [x] A vitrine parece uma foto de set de stop-motion (vista geral e de perto conferidas contra o moodboard).
- [x] Digitais visíveis de perto (e só o amassado raso de longe).
- [x] Boil perceptível mas sutil: a silhueta anda 1–2 px entre poses a ~10 cm da bola (0,3–0,6% do tamanho).
- [x] Nada fica preto nas sombras: `r_massa_preta` sem nenhum pixel magenta (frente, costas e lado da mesa); o
      controle com as luzes zeradas acende o magenta onde deve.
- [ ] 60 FPS no Alto em desktop médio — **não verificável nesta máquina** (RTX 2070). Estimativa: sala de testes no
      limite (~16 ms), vitrine ~18–19 ms em 1080p cheio (a resolução dinâmica cobre); validar num notebook com GPU
      integrada e, se confirmar, otimizar vitrine e pós na Fase 13.
- [x] Referências do moodboard descritas para cada escolha (itens 1–10).

Pendências conhecidas (não bloqueiam a Fase 3): validação em GPU integrada real; varredura medindo em duas
resoluções (custo fixo × por pixel); braço de rig e mão do animador (SMR1/SMR4/SMR7) entram com os mapas (Fase 6).

## Fase 3 — Movimento, física e colisão (em andamento)

Seção 0.6 inteira (fonte: `CLAUDE.md.md`, Fase 3). Plano técnico e estado das cinco subfases em
`docs/phases/phase-3.md` — aprovado em 2026-09-24: colisão por **varredura contínua exata** da cápsula com o
movimento do Source por cima; 3.1 colisão e controlador → 3.2 movimento tático CS → 3.3 pista de testes → 3.4 slide,
wall-jump e dano de queda → 3.5 sensação e aceite. Uma subfase por conversa.

### Subfase 3.1 — Colisão BVH e controlador cápsula ✅ (2026-09-25)

Plano executado: `docs/phases/phase-3.1-plan.md` (os blocos de código estão sincronizados com a versão final). O
jogador anda na sala de testes com a cápsula do CS (raio 16; 72 u em pé, 54 agachado) e os números do CS:GO
(gravidade 800, pulo com ápice de 57 u, degrau de 18 u, chão andável até ~45,6°, atrito 5,2, aceleração 5,5 no chão
e 12 no ar com desejo de 30 u/s, tick de 64 Hz). A varredura é exata (avanço conservador segmento–triângulo sobre o
BVH): nada atravessa parede fina em nenhuma velocidade e o resultado é determinístico.

Decisões tomadas na execução:
- **Base chata para o chão** (o fundo reto da caixa do CS; o `bUseFlatBaseForFloorChecks` da Unreal): a cápsula
  colide, o chão é o do disco dos pés. A primeira versão decidia o chão pelo contato da cápsula ("raio de apoio"):
  o pulo em pé empoleirava na caixa de 64 u (reservada ao pulo agachado) e o avanço lento emperrava no espelho do
  degrau — os cenários pegaram as duas coisas e ela foi trocada.
- **Quina baixa** (`clipLowEdge`): aresta ou vértice pego pelo redondo de baixo da cápsula não dá impulso para cima
  nem segura a cápsula pendurada.
- **Desprender preferindo chão**: com o eixo dentro de parede fina cada face empurra para o seu lado; empurrão maior
  que 8 u para um lugar sem chão perde para um lugar livre com chão.
- **Volta ao spawn** de quem desliga o noclip fora do set e cai 1500 u abaixo do chão do mapa (com aviso).

Correções achadas no navegador (cada uma virou regra ou teste): a borda do pote segurava o jogador ainda subindo
(chão preso no teto da faixa de busca → face que passa da faixa é obstáculo); a aba da borda, virada para baixo,
contava como chão (→ só face virada para cima); o canto andável da borda dava +67 u/s de subida (→ `clipLowEdge` em
todo contato de quina baixa); desligar o noclip no meio da parede norte jogava o jogador para fora do set, em
z −819,23 (→ preferência por chão; teste com a mesma parede); o `cl_showpos` cobria o overlay numa janela de 834 px
(→ painéis de debug em fluxo, o `cl_showpos` desce para baixo do overlay em tela estreita).

Arquivos criados:
- `src/data/movement.js` — cápsula e base chata (`HULL`), `sv_*` do CS:GO com faixas e ajuda do console,
  constantes do controlador (folga, sonda do chão, quina baixa, busca de espaço livre), agachar e câmera.
- `src/data/surfaces.js` — materiais de superfície da colisão (atrito, fator de pulo, pegadas, volume do passo).
- `src/player/movementVars.js` — objeto das `sv_*` em tempo de execução (trocar, limitar, restaurar).
- `src/physics/geometryQueries.js` — consultas sem alocar: ponto–triângulo, segmento–segmento, segmento–triângulo,
  raio–caixa e altura exata de um triângulo dentro do disco dos pés.
- `src/physics/capsuleSweep.js` — varredura exata de cápsula contra triângulo (avanço conservador).
- `src/physics/colliders.js` — `ColliderBuilder`: `box`, `cylinder`, `ramp`, `stairs`, `triangle`/`quad`, `geometry`,
  `object`; material de superfície por triângulo.
- `src/physics/collisionBody.js` — corpo com BVH (three-mesh-bvh, SAH), triângulos na ordem do BVH em
  `Float64Array`, matriz rígida opcional.
- `src/physics/collisionWorld.js` — `sweepCapsule` (o "trace" do Source), `deepestContact`, `canOccupy`,
  `depenetrate`, `findFreeSpot` (com filtro), `supportBelow` (chão da base chata), `raycast`, estatísticas.
- `src/physics/characterController.js` — porte do `gamemovement.cpp`: `tryPlayerMove` (+ `clipLowEdge`), `stepMove`,
  `stayOnGround`, `categorizePosition`, `resolvePenetration`, `fits`, `lastContact`.
- `src/player/moveCmd.js` — comando do tick (frente/lado, bits de botão, ângulos) a partir da entrada.
- `src/player/movement.js` — `playerMove()` (FullWalkMove): agachar com troca de cápsula, gravidade em duas metades
  por tick (antes e depois do movimento, como o Source), pulo, atrito, aceleração no chão e no ar, noclip e eventos
  `jump`/`land`/`duck`/`unduck`.
- `src/player/playerPawn.js` — jogador local: tick, olhar, câmera interpolada com suavização de degrau (0,06 s, teto
  de 24 u), terceira pessoa com recolhimento na parede, teleporte, estatísticas e custo da física por tick.
- `src/debug/consoleArgs.js` (leitura de 0/1, extraída de `commands.js`), `src/debug/movementCommands.js` (`sv_*`,
  `sv_reset`, `r_colisao`, `cl_showpos`, `thirdperson`, `firstperson`), `src/debug/physicsDebug.js` (arame das
  formas, cápsula, normal do chão e do último contato), `src/debug/showPos.js` (painel do `cl_showpos`).
- Testes: `tests/movementData.test.js` (4), `physicsMath.test.js` (6), `capsuleSweep.test.js` (4),
  `collisionWorld.test.js` (10), `characterController.test.js` (16), `movementFuzz.test.js` (2),
  `playerPawn.test.js` (5) + utilitários `physicsTestUtils.js`, `worldTestUtils.js`, `playerTestUtils.js`.
- `docs/phases/phase-3.md` (plano técnico da fase) e `docs/phases/phase-3.1-plan.md` (plano de implementação).

Arquivos alterados:
- `src/core/events.js` — `EV.PLAYER_JUMP`, `EV.PLAYER_LAND`, `EV.PLAYER_DUCK`.
- `src/main.js` — serviço `sv`.
- `src/data/configSchema.js` — `debug.collision`, `debug.showPos`, `debug.thirdPerson` (transitórias).
- `src/data/sandbox.js` — spawn nos pés, espessura de colisão das paredes (6,4 u), laje do chão, `SANDBOX.fallOutDepth`.
- `src/maps/registry.js` — contrato `collision` do MapInstance.
- `src/maps/testRoom.js` — formas de colisão da sala (laje, paredes, pote/tampa/espátula com a própria malha,
  boneco em cilindro): 3228 triângulos.
- `src/modes/matchState.js` — `PlayerPawn` em mapas com colisão, vistas de debug ligadas à config, volta ao spawn de
  quem cai do set, liberação da colisão ao sair.
- `src/ui/sandboxHud.js` — dicas de andar (mapa com colisão) ou de voar (vitrine).
- `src/debug/commands.js` — registra os comandos de movimento; `src/debug/overlay.js` — linha "física".
- `styles/debug.css` — painéis fixos em fluxo (overlay à esquerda, `cl_showpos` à direita ou abaixo) e o `cl_showpos`.

Como testar:
1. `npm test` → 113 testes passando (~4 s; os 10 min simulados levam ~1,5 s).
2. `npm run dev`, abrir http://localhost:5173 → menu → **Sala de testes** (ou console `map testroom`) → clicar para
   jogar. WASD anda, Espaço pula, Ctrl agacha (no ar, é o pulo agachado).
3. Andar contra as paredes, o pote, a tampa e o boneco de referência: desliza, não atravessa, quina sem tremer.
   Subir na espátula deitada (degrau de ~8,6 u, câmera suave).
4. Pote: de fora, o pulo em pé não alcança a borda e o agachado alcança; lá dentro, o pulo em pé sai.
5. Console (`` ` ``): `r_colisao 1` (arame da colisão, cápsula, normal do chão e do último contato), `cl_showpos 1`,
   `thirdperson` / `firstperson`, `sv_gravity 400` (pulo de ~114 u) e `sv_reset`, `setpos x y z` / `getpos` (pés do
   jogador), `noclip` (voar; desligar dentro de uma parede tira o jogador pelo lado do chão; desligar fora do set →
   cai e volta ao spawn com o aviso).
6. F3 duas vezes: overlay completo com a linha "física" (µs/tick, varreduras, sobreposições, triângulos, chão/ar).

Medições (RTX 2070, Chrome/ANGLE; sala de testes, 3228 triângulos de colisão):
- Física do jogador: ~73 µs/tick correndo em círculo, pulando, agachando e raspando nas paredes e no pote (média
  móvel; ~1,1 varredura e ~2 sobreposições por tick); 31–45 µs/tick parado — ~0,5% de um núcleo a 64 Hz. Sem
  isolamento de origem o `performance.now()` do navegador tem resolução de 100 µs: vale a média (p99 ≤ 400 µs).
- Node: 10 min simulados (38.400 ticks de entrada aleatória, com as checagens a cada tick) em ~1,5 s.
- Colisão: empurrões de até 3500 u/s contra paredes, pote e boneco param na distância exata da folga; o pulo em pé
  de fora do pote chega a 57,03 u (borda ~62 u); `sv_gravity 400` dá ápice de 114,03 u; quem cai do set volta ao
  spawn em ~2 s.
- Memória: sala com 30 geometrias / 37 texturas / 29 programas nas três entradas; menu com 2 / 34 / 18 nas três
  saídas; heap JS de 19–21 MB depois da coleta.
- Console sem erros do jogo. Duas mensagens que não são do jogo: o aviso `X4122 … double precision` do compilador de
  shader do Direct3D (ANGLE) sobre as constantes do chunk `packing` do próprio three.js (`UnpackDownscale = 255/256`,
  vem da sombra/AO da Fase 2) e "Blocked attempt to show a 'beforeunload' confirmation panel…", que o Chrome registra
  quando a página é recarregada por script no meio da partida (a proteção contra Ctrl+W da Fase 1; com gesto do
  usuário ele pergunta).

Checklist da subfase (o aceite detalhado está em `docs/phases/phase-3.md`):
- [x] Sala de testes andável: paredes, pote, tampa, espátula e boneco colidem; quinas sem tremer; beirada (em pé com o
      eixo até 16 u fora da borda, sem afundar); pote aberto com o pulo agachado de fora.
- [x] Degraus (≤ 18 u, em qualquer velocidade, inclusive agachado partindo parado), rampas (≤ ~45,6°), deslize em
      rampa íngreme; teto barra pulo e levantar.
- [x] Pulo com ápice de ~57 u; pulo agachado alcança 64 u, o em pé não, 72 u nenhum.
- [x] Noclip liga e desliga sem prender o jogador (sai da parede pelo lado do chão); fora do set volta ao spawn.
- [x] `r_colisao`, `cl_showpos`, `thirdperson` e `sv_*` funcionando; overlay com a linha de física; painéis de debug
      sem se cobrir em janela larga, estreita e de celular.
- [x] 113 testes passando, incluindo os 10 min simulados sem atravessar parede e o determinismo bit a bit.
- [x] Sem erros do jogo no console; sem vazamento em 3 ciclos menu ↔ sala; arquivos abaixo de 600 linhas (o maior,
      `collisionWorld.js`, com 580); números em `src/data/`.

Git: o projeto tem repositório próprio; a branch `fase-3.1` foi criada a partir de `main` (commit `c8bf024`, Fases 1
e 2). Nada da 3.1 foi commitado ainda — os arquivos estão na árvore de trabalho esperando o pedido de commit.

### Subfase 3.2 — Movimento tático CS ✅ (2026-09-25)

Plano executado: `docs/phases/phase-3.2-plan.md` (validado tarefa por tarefa numa cópia limpa antes da execução; os
blocos de código são a versão final). Desenho em `docs/phases/phase-3.md` (seção 3.2); pesquisa em `docs/research/`
(o movimento e a inaccuracy lidos no código do CS:GO de ~2017 e os dados do `items_game` final).

O movimento agora é o do CS:GO: teto do tick pelo item na mão (mín(260, `sv_maxspeed`, item)), aceleração com a
razão da arma, andar (×0,52, engata só abaixo de teto × 0,52 + 25, com a rampa final de 5 u/s), agachar com
velocidade própria e penalidade de spam (−2 por mudança da tecla, trava abaixo de 1,5, 0,4 s entre agachares,
recuperação 3/s e +6/s longe da âncora), `FL_DUCKING`, troca de cápsula no ar com ±9 u (duckbug e jumpbug), teto
duro, stamina (pulo +0,08 × impulso, pouso +0,05 × queda, recupera 60/s; teto × (1 − s/100)², pulo × (1 − s/100)),
bunny hop com teto de 286 u/s e passos por tempo, audíveis ou não. O pulo da 3.1 ficou (57 u). O item na mão tem
estado próprio (`hands`) ao lado do `Loadout`: troca pelo comando do tick (1–5, roda e Q), troca automática no `give`
e a luneta das 6 armas com mira (níveis, FOV relativo ao do jogador, 0,3 s entre cliques, sensibilidade
`zoomSensitivity × fov/90`, velocidade com luneta, "sniper lenta"). A inaccuracy do `CWeaponCSBase` roda a cada tick
(base, penalidade com recuperação pelo índice de recuo, pouso, movimento, ar com o ápice da Deagle; o disparo fica
pronto para a Fase 4). O counter-strafe é medido (telemetria de 256 ticks → medidor → gráfico no `cl_showpos`). O andar
silencioso segura no teclado e alterna no controle e no toque, configurável por dispositivo; o toque ganhou o botão
Andar (layout versão 2, com migração dos layouts salvos).

Decisões tomadas na implementação:
- **Fatores do teto no estado** (`walkFactor`, `staminaFactor`, `duckFactor`): o `cl_showpos` mostra a conta exata.
  Andar pode ficar "engatado" sem valer num tick (velocidade acima de teto × 0,52 + 25), como no CS:GO.
- **Ao nascer, a mão saca o melhor item** (primária > pistola > faca > granadas > bomba), como no spawn do CS.
- **Teto do bhop na velocidade 3D** com a meia gravidade do tick (−6,25 u/s), como no CS:GO: de 400 u/s no plano sai
  a 285,97.
- **Trinco do andar troca só com o aperto registrado pelo dispositivo**: segurar o botão durante uma troca de
  contexto não liga nada sozinho. Os modos (`TOGGLE_MODE`) ficam em `src/data/actions.js` — a config em `src/data` não
  depende de `src/input`.
- **`sv_timebetweenducks`**: vale no primeiro tick com 0,4 s desde o agachar completo (26 ticks a 64 Hz).

Ajustes achados nos testes: no túnel de 60 u da 3.1, o jogador preso agachado acelera como agachado do CS:GO (+0,8 u/s
líquidos por tick partindo parado), então a saída do teste passou de 128 para 192 ticks; o medidor de counter-strafe
recomeça do início quando a telemetria é zerada (antes pulava as amostras gravadas antes da chamada).

Arquivos criados:
- `src/data/inaccuracy.js` — inaccuracy das 24 armas (items_game final, com os modos alt) e as constantes do
  `CWeaponCSBase`.
- `src/player/hands.js` — item na mão: ordem dos itens, troca por slot/roda/Q, sincronização com o inventário, troca
  automática, luneta (níveis, FOV, tempos, sensibilidade), modo alt, velocidade do item e sniper lenta.
- `src/player/inaccuracy.js` — `updateAccuracy`, `landAccuracy`, `fireAccuracy`, `inaccuracyOf`, recuperação,
  limiar de precisão.
- `src/player/duck.js` — agachar do CS:GO (portão do spam, recuperação, transição, `CanUnduck`, troca de cápsula,
  corte do teto, olho).
- `src/player/footsteps.js` — relógio dos passos (19 ticks correndo, 25 na classe lenta, +100 ms agachado).
- `src/player/telemetry.js` — anel de 256 ticks (velocidade, teto, velocidade da arma, limiar, inaccuracy, desejo,
  velocidade, marcas).
- `src/input/actionToggles.js` — trinco segurar/alternar por dispositivo.
- `src/debug/strafeMeter.js` — medidor de counter-strafe ("contra" e "soltar"; última, melhor e média das 10).
- `src/debug/speedGraph.js` — gráfico dos últimos 4 s do `cl_showpos`.
- Testes: `hands.test.js` (8), `inaccuracy.test.js` (6), `tacticalMovement.test.js` (15), `footsteps.test.js` (5),
  `strafeMeter.test.js` (5).
- `docs/phases/phase-3.2-plan.md`; `docs/research/csgo-movement-notes.md`, `csgo-inaccuracy-notes.md` e
  `csgo-weapon-accuracy.json`.

Arquivos alterados:
- `src/data/movement.js` — `sv_*` novas (stamina, bhop, `timebetweenducks`, `accelerate_use_weapon_speed`), `MOVE`,
  `DUCK` completo, `STEPS`.
- `src/data/surfaces.js` (`stepSlow`/`stepFast`), `src/data/weapons.js` (FOVs e tempos de zoom, `SCOPE`, `BOMB`),
  `src/data/economy.js` (granadas a 245 u/s), `src/data/actions.js` (modos do trinco), `src/data/touchLayout.js`
  (botão Andar, versão 2), `src/data/configSchema.js` (modos do andar por dispositivo, migração do layout).
- `src/player/movement.js` (porte do `PlayerMove`/`FullWalkMove` do CS:GO), `src/player/moveCmd.js` (`cmd.select`),
  `src/player/playerPawn.js` (tick na ordem do `RunCommand`, precisão, luneta com FOV interpolado, telemetria,
  eventos), `src/player/loadout.js` (`giveBomb`, `grenadeTypes`), `src/player/movementVars.js` (sv_* de 0/1).
- `src/core/events.js` — `EV.PLAYER_STEP`, `EV.PLAYER_WEAPON`, `EV.PLAYER_ZOOM`; pulo e pouso com `audible`/`heavy`;
  `EV.LOADOUT` com `received`.
- `src/input/inputManager.js` — avaliação por dispositivo, trincos, `resetToggles()`.
- `src/ui/settingControls.js`, `src/ui/settingsScreen.js` (modo do andar nas abas Teclas, Controle e Toque),
  `src/ui/sandboxHud.js` + `styles/hud.css` (etiqueta "na mão", "ANDANDO", dicas).
- `src/debug/showPos.js` + `styles/debug.css` (linhas novas, gráfico e legenda), `src/debug/movementCommands.js`
  (`cl_strafe_reset`), `src/debug/commands.js` (`give bomba`; `loadout` com o item na mão).
- `src/modes/matchState.js` — inventário no pawn, medidor, sensibilidade da luneta, trincos, HUD.
- Testes: `movementData` (6), `data` (9), `characterController` (16), `playerPawn` (10), `input` (10),
  `movementFuzz` (2, agora com andar, spam de agachar, pulos com stamina e troca de item), `playerTestUtils`.

Como testar:
1. `npm test` → 166 testes passando (~3,3 s; os 10 min simulados levam ~1,8 s).
2. `npm run dev` → **Sala de testes**. Teclado: WASD, Shift anda (segurar), Ctrl agacha, Espaço pula, 1–5 / roda / Q
   trocam de item, botão direito é a luneta. Controle: L3 liga/desliga o andar, Y/△ troca, LT/L2 luneta. Toque: botão
   Andar.
3. Console: `give ak47` (troca sozinho para a primária), `give awp` + botão direito (40° e 10°), `give bomba`,
   `give flash`, `loadout`; `cl_showpos 1` (teto com os fatores, stamina, agachar, precisão com as partes, passo,
   pouso, placar do counter-strafe e o gráfico); com a AK, correr de lado e apertar o lado oposto marca "contra"
   (~78 ms), soltar marca "soltar" (~203 ms); `cl_strafe_reset`; `sv_enablebunnyhopping 1`, `sv_autobunnyhopping 1`,
   `sv_staminajumpcost 0`, `sv_timebetweenducks 0`, `sv_accelerate_use_weapon_speed 0` e `sv_reset`.
4. Configurações → Teclas, Controle e Toque: "Andar silencioso" com Segurar / Alternar.

Medições (Node e navegador, 64 tick):
- Movimento: faca 0 → 250 em 35 ticks; AK 0 → 215 em 36; faca andando 0 → 130 em 40 (sem passar de 130); AK andando
  0 → 111,8 em 26; faca agachada 0 → 85 em 100; AWP com zoom 0 → 100 em 53 e andando 0 → 52 em 22; faca a 250 + Shift
  trava em 130 no 7º tick; soltando tudo para em 26 ticks; agachar 13 ticks, levantar 11; pulo 57 u, pulo + Ctrl 66 u;
  stamina 24,16 no pulo, pouso plano a 285,51 u/s → 14,28 → teto × 0,735 no primeiro tick → zera em 16 ticks.
- Passos: faca a cada 19 ticks, AK a cada 25; andando, agachado e AWP com zoom silenciosos; AUG com zoom audível.
- Inaccuracy: os vetores da pesquisa com diferença < 10⁻⁶ (AK parada 0,00641, correndo 0,18147, andando a 111,8
  0,058067, saída do pulo 0,24811, pouso 0,220252 → 0,00682 em 64 ticks; AWP com zoom 0,002; Deagle no ápice 0,3763).
- Navegador (projeto real, entrada pelo `InputManager`): counter-strafe da AK "contra" 5 ticks (78 ms) × "soltar" 13
  (203 ms); AK andando 111,8 u/s com "ANDANDO" e passo silencioso; luneta da AWP com zoom 0,36397 (tan 20°) e 0,087489
  (tan 5°) e sensibilidade 0,444 e 0,111; troca por 1–5, roda e Q na ordem do CS.
- Memória: sala com 25 geometrias / 37 texturas / 29 programas nas três entradas; menu com 2 / 34 / 19 nas três
  saídas; ouvintes de `player:weapon`, `player:zoom` e `loadout:change`: 1 na partida, 0 no menu.
- Console do navegador sem nenhuma mensagem nesta rodada. O painel de preview roda a poucos quadros por segundo (o
  loop limita a 8 ticks por quadro), por isso as medidas no navegador esperam ticks; custo em µs/tick não foi medido.

Checklist da subfase (o aceite detalhado está em `docs/phases/phase-3.md`):
- [x] Velocidade de cada arma e item, andar, agachar e luneta nos números certos (`cl_showpos` e testes).
- [x] Troca por 1–5, roda e Q; luneta funcional nas 6 armas com mira (FOV, sensibilidade, velocidade, precisão).
- [x] Counter-strafe medido no `cl_showpos`: "contra" bem mais rápido que "soltar" (78 × 203 ms na AK).
- [x] Bunny hop possível mas penalizado (teto de 286, stamina); spam de agachar visível (velocidade do agachar no
      `cl_showpos`; a tecla trava abaixo de 1,5).
- [x] Eventos de passo, pulo e pouso corretos (audível × silencioso, volume, superfície).
- [x] Andar alternado no controle e no toque; segurar no teclado; configurável por dispositivo. No navegador, conferidos
      o teclado em Alternar e o botão no layout de toque; controle e toque, pelos testes do trinco e da config (sem
      controle físico nem celular nesta máquina).
- [x] 166 testes passando (incluindo os 10 min simulados); sem erros do jogo no console; sem vazamento em 3 ciclos
      menu ↔ sala; arquivos abaixo de 600 linhas (o maior da 3.2, `inputManager.js`, com 561); números em `src/data/`.

Fica para as outras fases, como no desenho: o visual da luneta (anel de massinha, retícula, distorção, esconder a
mira, desfazer o zoom no tiro e na recarga) e o tempo de sacar, tirar o silenciador e ligar a rajada, o freio por
levar tiro (Fase 4); escada; pisar em outro jogador (Fases 5 e 9); plantar e desarmar forçando o agachar (Fase 8);
dano de queda (3.4); o áudio dos passos (Fase 12) e a audição dos bots (Fase 7), que já recebem os eventos.

Git: nada commitado. A 3.1 e a 3.2 estão juntas na árvore de trabalho da branch `fase-3.1`, esperando o pedido de
commit.

### Próxima: Subfase 3.3 — Pista de testes

Plano em `docs/phases/phase-3.md` (seção 3.3): pesquisa no Pinterest antes do visual (moodboard item 11) e o mapa
`pista` com o kit e os materiais do set — faixa de counter-strafe com grade de 1 m, escadas de 8/12/16/18/20/24 u,
rampas de 15/30/44/46/60°, caixas de 57/64/72 u, poço e paredes em zigue-zague para wall-jump, vãos de slide, torre
de queda com marcas de altura, faixa longa de bhop, vigas estreitas, paredes finas, túnel baixo e placas de massinha
para as pegadas; colisão com o `ColliderBuilder`, luz própria e acesso pelo menu, lobby e console.
