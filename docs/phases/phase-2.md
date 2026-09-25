# Fase 2 — Sistema de massinha e look de estúdio (plano técnico)

Base: PROMPT 0 seção 0.13 + bíblia visual `docs/art/moodboard.md` (IDs do Pinterest entre parênteses).

## Estado das subfases

| Subfase | Conteúdo | Estado |
|---|---|---|
| 2.1 | Texturas procedurais na GPU (atlas de digitais e de ferramenta) | ✅ |
| 2.2 | ClayMaterial (digitais, ferramenta, clearcoat úmido, SSS falso, boil, skins) | ✅ |
| 2.3 | Kit de geometria + SDF/marching cubes com cache | ✅ |
| 2.4 | Materiais do set + montagem de luz de estúdio (equipamento, poeira, ambiente) | ✅ |
| 2.5 | Pós-processamento completo ligado aos presets + luz de estúdio na sala de testes | ✅ (2026-09-24) |
| 2.6 | Vitrine (20 objetos, painel de luz, varredura de presets) + revisão do look + aceite da fase | ✅ (2026-09-24) |

**Fase 2 concluída.** Relatório final e medições em `docs/PROGRESS.md`; decisões visuais por referência em
`docs/art/moodboard.md` (itens 1–10).

## 1. Texturas procedurais geradas na GPU (`src/clay/proceduralTextures.js`)
Gerador genérico: `bakeTexture(renderer, { size, fragmentShader, uniforms, mipmaps })` renderiza um shader de tela
cheia num WebGLRenderTarget (RGBA8, repeat, mipmaps) e devolve a textura. Tudo gerado no carregamento, nada baixado.
- `fingerprintAtlas` (RGBA): RG = normal da digital (xy codificado), B = máscara de sulco (cavidade), A = máscara de
  "patch" (onde há digital). Digitais = sulcos senoidais concêntricos/arcos em torno de centros de células Voronoi,
  com distorção de domínio (fbm) para virar espiral/arco (PLA4, PLA17, CIL17). Tileável (Voronoi periódico).
- `toolAtlas` (RGBA): RG = normal de riscos de espátula (ruído direcional por patch, CIL16) + amassados médios
  (manchas de polegar, PLA15), B = altura das manchas (vira variação de roughness: manchas mais "frescas"),
  A = pontinhos de sujeira/fiapo (PLA17).
- Revisão da 2.6 (`src/clay/atlases.js`, moodboard item 10 — FPC9, FPC14, CLT1, CLF17): a digital é uma bacia
  rasa do tamanho real da ponta do dedo (13–19 u) com lábio na borda e sulcos de espaçamento constante (fase pela
  distância a uma "espinha" de laço/verticilo/arco, minúcias por ruído de fase); as digitais se agrupam onde a
  peça foi segurada (presença 0,62 por ruído de baixa frequência) e deixam áreas lisas — a meia distância não
  lembra mais trama de tecido. Afundamento `uDent` 8,5 e sulcos `uRidgeAmp` 0,66: de longe sobra o amassado raso
  (os sulcos somem nos mipmaps), de perto aparecem os sulcos.

## 2. ClayMaterial (`src/clay/ClayMaterial.js`)
`MeshPhysicalMaterial` + `onBeforeCompile`. Uniforms globais compartilhados (`src/clay/clayGlobals.js`):
uPose, uPoseRand (vec4 aleatório da pose), uTime, atlas, qualidade. Por material: cor A/B, skin, digitais
(escala, força), ferramenta (força), boil (amplitude em unidades de mundo = 0,3–0,6% do raio do objeto),
wetness (0 seca … 1 fresca → clearcoat 0 … 0,45), wrap, SSS (cor/força), lift de sombra, "tocado" (digitais
tremem por pose — personagens/viewmodel), seed.
- Vértice: boil = ruído 3D (espaço do objeto) com seed trocada por pose (12/s) ao longo da normal. Seed do objeto
  via uniform ou via translação da instância (InstancedMesh).
- Fragmento: triplanar do atlas de digitais (escala por objeto) e de ferramenta; força das digitais maior em
  áreas "tocadas" (atributo `aTouch` do kit, bordas/pegas); sulco escurece levemente e fica mais saturado.
- Luz: diffuse com wrap + termo de subsurface na linha do terminador (cor saturada da própria massa, PLA15),
  translucidez de borda quando contraluz, "piso" de sombra saturado (nada preto, PLA2/PLA15),
  especular base fosco (roughness 0,65–0,8) + clearcoat como camada úmida (layered BRDF, relatório UWE).
  Fresnel suave (sem bordas escuras — relatório UWE, avaliação).
- Skins (seção 0.15): liso, marmorizado (2 cores), glitter, escolar desbotada, neon (emissivo no escuro), misturada
  (várias cores), madeira falsa, camuflagem, ouro. Implementadas por define + parâmetros.
- Qualidade: Leve = sem digitais/boil/clearcoat; Médio = digitais + clearcoat; Alto = tudo; Ultra = tudo +
  atlas 2048 + fiapos.
- Revisão da 2.6: peças tocadas ganham uma segunda camada de digitais (o atlas girado 90° e deslocado por cima da
  primeira, CLT1/FPC9); o canal de sulco dá micro-oclusão (−16% no fundo do sulco); wrap, faixa de subsurface e
  rim SSS usam só a normal geométrica e o relevo fino entra como diferença de Lambert por cima (o espalhamento da
  plasticina é curto: amolece a forma, não apaga as digitais). Glitter holográfico: flocos meio espelho/meio
  pigmento com a 1ª ordem de difração de uma grade cruzada na luz direta (GPD1/GPD4). Marmorizado com poucas
  faixas largas, dobra e zonas de mistura parcial (MPC3/MPC11). Diagnóstico `CLAY_BLACK_PROBE` (magenta onde a
  massa ficaria preta) ligado pelo console `r_massa_preta`.

## 3. Kit de geometria (`src/clay/kit/*.js`)
Primitivas moldadas à mão: esfera/bolota, cápsula, cilindro com borda arredondada, placa achatada, cobrinha
(tubo por curva com raio variável e pontas redondas), cone/gota; todas com irregularidade de silhueta
(ruído de baixa frequência), amassados de polegar (depressões esféricas), atributos `aTouch` (convexidade),
`aSeam` e `aCavity` (oclusão assada). Costuras: `joinClay()` marca vértices próximos da outra peça (vinco +
leve lábio + troca de cor limpa, PLA17/PLA13/CSD7).
SDF + marching cubes (`src/clay/sdf/*`): árvore SDF serializável (esfera, cápsula, caixa arredondada, elipsoide,
toro, cone; união suave com vinco, subtração, deslocamento por ruído) avaliada num Web Worker; polígonos com
normais do gradiente; cache em IndexedDB (store `cache`, chave = hash da árvore + resolução).
Revisão da 2.6: forma `spiral` (folha enrolada — distância exata à polilinha com janela angular demonstrável,
extrusão arredondada, suporte conservador em `bounds.js`) para o rocambole (MFP3/MFP15); fronteiras de material
cortadas no lugar exato (`src/clay/sdf/materialSplit.js`: busca binária do ponto de troca em cada aresta,
triângulos de duas cores viram triângulo + quadrilátero e os de três cores fecham num vértice central, malha
continua estanque e orientada, triângulos ordenados por material); versão do cache `v2`.

## 4. Materiais do set (`src/clay/setMaterials.js` + texturas em `src/clay/setTextures.js`)
Papelão (fibras, ondulação, borda cortada mostrando a onda — SSD4/SSD8/CSD16), fita crepe (crepe, bordas
rasgadas, leve translucidez — SSD2/SSD14), arame (metal fino torcido — armaduras), madeira balsa (veio fino
claro — CSD16), metal de ferramenta (escovado com riscos — CSD19/SMD3), plástico de pote (brilhante, levemente
translúcido nas bordas), tapete de corte (grade 1 cm, números na borda, riscos de estilete — SMD3).

## 5. Luz de estúdio (`src/render/studio/*`) e pós (`src/render/passes/*`, `src/render/postEffects.js`)
Key quente forte (spot com sombra PCF suave), fill frio fraco, rim de recorte, hemisférica para rebote,
softboxes/fresnels visíveis como formas emissivas (SSD14, CSD14, SMD13), luminária prática (SMD3).
Poeira nos feixes (pontos que só aparecem dentro do cone da key — CSD8/SSD16).
Pós (ordem implementada): cena → GTAO (profundidade da cena, normais reconstruídas, composição colorida) →
DOF/tilt-shift (CoC por profundidade + faixa de tilt, bokeh em disco, autofoco na GPU) → camadas (arma) →
bloom (só luzes, âmbar) → OutputPass (AgX/ACES, exposição × flicker por pose) → SMAA → lente de estúdio
(aberração, grade "massinha", vinheta quente, grão por pose, dithering). Contextos jogo/vitrine/menu/killcam
em `src/data/postFx.js`; decisões e referências novas (TSH, SMA, SML, BTS) no moodboard, item 9.
Revisão da 2.6: sombra estática por mapa (`MapInstance.staticShadows` → `shadowMap.autoUpdate = false`; o mapa
de sombra é refeito só quando a cena entra, a qualidade de sombra muda ou o contexto volta — o passe de sombra usa
a profundidade padrão do three, sem boil, então nada muda entre quadros), DOF com rotação do disco por ruído de
gradiente intercalado + pós-filtro em tenda 3×3 na meia resolução (silhuetas sem "cabelo").

## 6. Vitrine (`src/maps/vitrine.js`, `src/debug/showcase*.js`, dados em `src/data/showcase.js`)
Mapa `vitrine` (menu principal → "Vitrine de massinha", lobby ou console `vitrine`): mesa do animador de
150 × 92 cm a 76 cm do chão de molleton preto, tapete de corte de 90 × 62 cm e 20 objetos numa grade 5 × 4, cada um
com etiqueta de fita crepe escrita a caneta (atlas de texto em canvas). Câmera de foto de produto (alta, inclinada,
voo a 42% da velocidade para olhar de perto), montagem de luz `vitrine` (key de tungstênio em softbox, fill frio,
rim de cima/trás, luminária prática, poeira nos feixes) e contexto de pós `vitrine` (foco médio).
- Linha do fundo: armadura de arame, boneco de 72 u (escala), pote de massinha, caixa de papelão, neon no escuro.
- Segunda linha: cabeça SDF, camuflagem, madeira falsa, rolo de fita crepe, rocambole SDF (item de colete).
- Terceira linha: faca de ouro, massa misturada, escolar desbotada, amassado SDF, ferramentas sobre balsa.
- Frente (para olhar de perto): massa fresca, massa seca, placa de digitais, marmorizado, glitter.
- Painel de fita crepe (Tab solta o mouse): iluminância (lx) e Kelvin de cada luz, rebote, ambiente, multiplicadores
  de umidade/boil/digitais sobre cada massinha (a massa seca continua seca), diagnóstico "massa preta", contexto do
  pós, foco automático ou fixo, exposição, presets e a varredura com a tabela. Navegável por controle/teclado.
- Varredura (`src/debug/presetSweep.js`): Leve → Médio → Alto → Ultra com a câmera parada numa pose fixa e a
  resolução travada; compila a cena em paralelo (`compileAsync`) e só mede depois de 2,2 s de quadros calmos
  (quadro > 100 ms zera a contagem; teto de 45 s); 4 s de medição por preset: FPS, 1% low, p95, GPU e CPU por
  quadro, draws, resolução e a estimativa para GPU integrada (GPU × 5) contra o orçamento de 16,7 ms.
- Console: `vitrine`, `varredura [cancelar]`, `luz [id] [lx] [K]`, `massinha [umidade|boil|digitais] [×]`,
  `r_massa_preta [0|1]`.

## Aceite (conferido em 2026-09-24 — números e capturas em `docs/PROGRESS.md`)
- [x] Parece foto de set de stop-motion: vista geral e de perto revisadas contra o moodboard (itens 1–10).
- [x] Digitais visíveis de perto (placa de digitais, massa fresca, bonecos), só amassado raso de longe.
- [x] Boil perceptível mas sutil: a silhueta anda 1–2 px entre poses a ~10 cm da bola (0,3–0,6% do tamanho).
- [x] Nada preto nas sombras: `r_massa_preta` sem nenhum pixel magenta de três ângulos (frente, costas, lado);
      controle positivo com as luzes zeradas acende o magenta onde deve.
- [ ] 60 FPS no Alto em desktop médio: **estimado, não medido** (esta máquina tem RTX 2070, não GPU integrada).
      Sala de testes no Alto 1080p = 3,25 ms de GPU → ~16 ms numa Iris Xe pelo fator ×5 (no limite). Vitrine no
      Alto 1080p = 4,9 ms → ~24 ms pelo ×5 puro, mas ~1,5 ms da etapa "cena" não escala com a resolução (espera
      da GPU pelo envio dos 119 draws, medido baixando a escala); aplicando ×5 só ao que escala com pixels, ~18–19 ms
      (~53 FPS) em resolução cheia — a resolução dinâmica cobre o resto. Validar num notebook com Iris Xe/Radeon
      680M; se confirmar, otimizar vitrine e pós na Fase 13 (e a varredura passar a medir em duas resoluções).
