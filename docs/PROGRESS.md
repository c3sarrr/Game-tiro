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
  localLoadout, focusNav, toasts, uiRoot, debugRoot, touchLayer, overlay, console) é passado aos estados.
- Loop: `input.frameStart()` (controle + olhar) → N ticks de 1/64 s (`input.sampleTick()` + `states.tick`)
  → `states.frame(alpha)` → `render.render()` → overlay. Olhar por quadro; ações/movimento por tick.
- Estados: boot (`core/bootState.js`) → menu (`ui/menuState.js`) → lobby (`ui/lobbyState.js`) →
  partida (`modes/matchState.js`) → resultado (`ui/resultState.js`). Transições em `core/stateMachine.js`.
- Mapas se registram em `src/maps/registry.js` (import em `src/maps/index.js`); `map <id>` e o lobby listam o registro.
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

## Próxima: Fase 3 — Movimento, física e colisão

Seção 0.6 inteira (fonte: `CLAUDE.md.md`, Fase 3), em subfases, uma por conversa:
- Controlador de personagem cápsula com colisão BVH (`three-mesh-bvh`), degraus, rampas e deslizamento em paredes.
- Andar, correr, andar silencioso, agachar, pular, air-strafe, bunny hop com penalidade, slide (~0,6 s com cooldown),
  wall-jump (1 por contato, reseta no chão), dano de queda a partir de ~420 u.
- Velocidade máxima por arma e inaccuracy de movimento exposta para o sistema de armas (Fase 4); números em
  `src/data/`.
- Squash & stretch no pouso, pegadas que marcam a massa e somem, head-bob e inclinação de câmera configuráveis.
- Pista de testes de movimento (rampas, degraus, paredes de wall-jump, vãos para slide) montada com o kit e os
  materiais do set — pesquisar referências no Pinterest antes do visual da pista.
- Aceite: movimento responde como CS no chão (counter-strafe funcional), slide e wall-jump fluidos, nenhum
  atravessamento de parede em 10 min de teste.
