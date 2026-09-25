# MASSACRE — Bíblia visual (moodboard estudado)

Folha de contato navegável: `docs/art/moodboard.html` (rode `npm run dev` e abra `/docs/art/moodboard.html`).
Cada ID abaixo (ex.: `PLA15`) é uma imagem dos boards do Pinterest listados na seção 0.13 do PROMPT 0.
Lista crua dos pins: `docs/art/pinterest-boards.json`.

| Prefixo | Board |
|---|---|
| CSD | Claymation Set Design — pinterest.com/ideas/claymation-set-design/893621988359 |
| PLA | 3D Plasticine — pinterest.com/ideas/3d-plasticine/901418997915 |
| CIL | Clay Illustration — pinterest.com/ideas/clay-illustration/925869521463 |
| P3D | Plastic 3D Style — pinterest.com/cokards/plastic-3d-style |
| SSD | Stop Motion Set Design — pinterest.com/ideas/stop-motion-set-design/939142592219 |
| SSB | Stop Motion Set Building — pinterest.com/ideas/stop-motion-set-building/913501904960 |
| SMD | Stop Motion Desk — pinterest.com/ideas/stop-motion-desk/951357298077 |
| TSH | Tilt Shift (fotografia de miniatura) — pinterest.com/ideas/tilt-shift/942751172933 |
| SMA | Stop Motion Aesthetic (fotogramas e bastidores) — pinterest.com/ideas/stop-motion-aesthetic/960919693804 |
| SML | Stop Motion Lighting — pinterest.com/mrrufus13/stop-motion-lighting |
| BTS | Behind the Scenes – Stop Motion — pinterest.com/mrrufus13/behind-the-scenes-stop-motion |
| CLT | Clay Texture — pinterest.com/ideas/clay-texture/918258762185 |
| FPC | Fingerprint in Clay — pinterest.com/ideas/fingerprint-in-clay/914205465062 |
| MPC | Marbled Polymer Clay — pinterest.com/ideas/marbled-polymer-clay/957722805947 |
| GPD | Glitter Playdough — pinterest.com/ideas/glitter-playdough/953828611932 |
| GDC | Glow in the Dark Clay — pinterest.com/ideas/glow-in-the-dark-clay/902744489574 |
| PDH | Play Doh — pinterest.com/ideas/play-doh/922980152283 |
| TRL | Tape Rolls — pinterest.com/ideas/tape-rolls/905317052557 |
| ARM | Stop Motion Armature — pinterest.com/ideas/stop-motion-armature/922526094853 |
| CLF | Claymation Figures — pinterest.com/ideas/claymation-figures/918006513492 |
| AAC | Aardman Characters — pinterest.com/ideas/aardman-characters/928944982599 |
| MFP | Miniature Food Photography Props — pinterest.com/ideas/miniature-food-photography-props/932796717606 |
| PLI | Plasticine Ideas — pinterest.com/ideas/plasticine-ideas/924839357923 |
| SMR | Stop Motion Rig — pinterest.com/ideas/stop-motion-rig/923657372951 |
| COC | Cardboard Obstacle Course — pinterest.com/ideas/cardboard-obstacle-course/959069167784 |
| CBT | Cardboard Box Tunnel — pinterest.com/ideas/cardboard-box-tunnel/958387563144 |
| CFO | Cardboard Fingerboard Obstacles — pinterest.com/ideas/cardboard-fingerboard-obstacles/914410744968 |
| CFR | Cardboard Fingerboard Ramps — pinterest.com/ideas/cardboard-fingerboard-ramps/948478168138 |
| BAS | Books As Stairs — pinterest.com/ideas/books-as-stairs/943259823545 |
| AWB | Architectural Wooden Building Blocks — pinterest.com/ideas/architectural-wooden-building-blocks/935841685680 |
| WRG | Wall Ruler Growth Charts — pinterest.com/ideas/wall-ruler-growth-charts/907164492834 |
| PKG | Parkour Gym — pinterest.com/ideas/parkour-gym/958718375641 |
| PKC | Parkour Course — pinterest.com/ideas/parkour-course/915062227603 |
| CFP | Clay Footprints — pinterest.com/ideas/clay-footprints/909576168004 |
| CIM | Clay Imprints — pinterest.com/ideas/clay-imprints/952443037456 |
| DFL | Desk Flatlay — pinterest.com/ideas/desk-flatlay/918272522219 |
| BWM | Balsa Wood Models — pinterest.com/ideas/balsa-wood-models/953315394598 |
| TMA | Tape Measure Aesthetic — pinterest.com/ideas/tape-measure-aesthetic/939157022954 |
| PRU | Pencil Ruler — pinterest.com/ideas/pencil-ruler/922061658246 |
| CMR | Cardboard Marble Run — pinterest.com/ideas/cardboard-marble-run/956681619018 |
| LDB | Level Design Grey/Whiteboxes & Blockouts — pinterest.com/danejcustance/level-design-greywhiteboxes-blockouts |

Os boards TSH, SMA, SML e BTS entraram na subfase 2.5 (pós-processamento), os treze de CLT a SMR na subfase 2.6
(vitrine e revisão do look) e os dezessete de COC a LDB na subfase 3.3 (pista de testes): só os pins estudados estão
na lista, renumerados a partir de 1 (ID = prefixo + posição em `pinterest-boards.json`). Um mesmo pin pode aparecer em
dois boards (ex.: ARM5 = CLF1; CFR1 = CFO7; CBT8 = COC2). O PKC ficou sem os seis pins que repetiam o PKG e o COC.

Leituras técnicas: relatório "Creating a Realistic Clay Shader for Digital Stop Motion" (Z. Rowbotham, UWE — zar67 portfolio) e o post "Claymation Style in 3D" (slamatron). Guia de estúdio caseiro de Terry Ibele.

---

## 1. Superfície da massinha (ClayMaterial)

O que as fotos mostram e a decisão técnica que cada observação gera:

| Observação | Referências | Decisão |
|---|---|---|
| Massinha é **fosca**, com um brilho largo e suave nas partes bojudas; nunca é espelhada. | PLA1, PLA4, PLA14, PLA16 | Camada base `roughness` 0,65–0,80, `specularIntensity` reduzida (~0,35). |
| Massa **fresca/oleosa** ganha um segundo brilho mais definido por cima (a borda da bolacha achatada pega luz). | PLA15, CSD4, PLA2 | Segunda camada especular = `clearcoat` do MeshPhysical (0 = seca, 0,45 = fresca) com `clearcoatRoughness` 0,35–0,5. Isso reproduz o *layered BRDF* (Weidlich & Wilkie) usado no relatório da UWE: camada fina de óleo/água sobre a base difusa. |
| A **sombra puxa para a mesma cor, mais saturada e escura** (lado escuro do vermelho vira carmim; do amarelo, ocre), nunca cinza/preto. | PLA15, PLA2, PLA8, CSD6 | Wrap lighting + termo de "subsurface" que tinge a parte não iluminada com `saturate(albedo)^1.6`; *tone mapping* AgX preserva a saturação; ambiente hemisférico colorido. |
| Bordas **não escurecem** (Aardman). O relatório registra que um Fresnel íngreme escureceu as bordas e afastou o resultado do Aardman. | PLA16, CSD19, relatório UWE §4 | Fresnel suave (F0 baixo), borda recebe leve translucidez clara/saturada (rim SSS), nunca uma borda escura. |
| Superfície com **amassados de polegar** grandes (1/10 do objeto), **manchas** médias e **digitais** finas só visíveis de perto. | PLA4, PLA17, PLA2, CIL17 | Três escalas de normal: (a) amassados de baixa frequência na geometria (kit `/src/clay`), (b) manchas médias no normal map, (c) digitais: sulcos concêntricos/arcos com distorção de domínio, em patches (célula Voronoi = uma digital), aplicados em triplanar. |
| **Marcas de ferramenta**: riscos curtos e paralelos (cabelo/barba riscados a palito), e o bisel arredondado em toda borda. | CIL16, CIL4, SMD1 | Ruído direcional (riscos alongados numa direção por patch) + geometria sempre com borda arredondada (nenhuma aresta viva). |
| **Costuras** onde duas massas se juntam: um vinco/sulco e às vezes uma borda saliente; mudança de cor limpa. | PLA17, PLA13, CSD7 | Costura = anel de geometria (vinco + leve lábio) e atributo `seam` para escurecer/saturar o sulco no shader. |
| **Fiapos e poeira** grudados (pontinhos escuros, fibras). | PLA17, CSD3 | Poucas fibras (tubos finíssimos) e pontinhos no albedo em alguns objetos; partículas de poeira nos feixes de luz. |
| Olhos: **bolinhas brancas com pupila preta** (massinha ou miçanga), às vezes olhos de plástico (googly). | PLA2, PLA4, PLA8, PLA11, PLA14, CIL18 | Criador de boneco: olhos de massinha, miçanga (brilho alto, plástico) e botão (furinhos). |
| Cabelo e detalhes são **cobrinhas** de massa (tubos com ponta arredondada) ou espetos. | CSD3, CSD7, CIL3, CIL9 | Kit "cobrinha" (tubo por curva com raio variável e pontas arredondadas). |
| Stop-motion: o personagem "treme" entre poses porque o animador tocou nele; a textura (digitais) muda um pouco a cada pose. | slamatron ("subtle jitters", "texture movement … as if moulding every frame") | *Boil* de vértice com seed trocada a cada 1/12 s e um deslocamento mínimo do padrão de digitais a cada pose **só em objetos "tocados"** (personagens, viewmodel, props animados). Cenário estático quase não ferve. |

## 2. Iluminação

| Observação | Referências | Decisão |
|---|---|---|
| O set é uma **ilha iluminada no escuro** do estúdio; a luz cai rápido fora do set. | SSD1, CSD14, SSB3, SSD16 | Fundo do estúdio escuro, *fog* exponencial quente leve, vinheta; luzes pontuais/spot com decaimento. |
| **Key quente** forte e lateral (tungstênio/luminária), **fill frio** fraco. | CSD6, PLA2, SMD3, SSD5 | Key 3200–3800 K (âmbar), fill 6500–8000 K (azulado) a ~15–25% da key, rim para recortar bonecos. |
| Sombras **suaves** (softbox) mas com contato definido. | SSD14, PLA15, PLA4 | PCFSoft/VSM com raio largo + AO (GTAO) para assentar a massa. |
| Noite de cinema: fachadas laranja com sombras roxo-azuladas. | SSD5, SSB3, SSB8, SSB10 | Mapa Cidade de Papelão: ambiente azul-violeta + recortes de luz quente das janelas e postes. |
| Luz de janela com poeira no ar. | CSD8, CSD2, SSD16 | Mapa Prateleira: key de janela lateral, *god rays* falsos com partículas de poeira. |

## 3. O estúdio em volta do set (bordas dos mapas)

| Elemento | Referências | Uso |
|---|---|---|
| **Grade de canos** no teto com refletores *fresnel* pretos e frente brilhante. | CSD14, SMD13, SSD11 | Teto/bordas de todos os mapas; formas emissivas visíveis. |
| **Softbox** retangular branca com moldura preta, em C-stand. | SSD14, SMD7 | Formas de luz visíveis nas bordas; fonte da key. |
| **Luminária articulada** prateada com cúpula cônica. | SMD3, SMD11 | Mapa Bancada (site B é a base da luminária). |
| **Braço de rig** (haste metálica com junta) entrando no set. | CSD14, SSD3 | Cobertura e props de borda. |
| **Câmera DSLR/lente preta** na frente do set, tela acesa; câmera no **trilho de travelling**. | CSD14, SSD15, SMD17, SMD13 | "Lente gigante observando a cena"; trilhos de travelling cortando o mapa Cidade. |
| **Chroma key** verde/azul. | CSD20, SSD13, SMD2, SMD13 | Área de chroma no mapa Cidade de Papelão. |
| **Pegboard**, gavetas, fitas, potes, cabos. | SMD3, SMD5, SMD4 | Paredes de fundo e props. |
| Set montado sobre **base de compensado** com borda visível. | SSB9, SSD10, SSD2 | Limites do mapa = borda da base/mesa. |
| Mão do animador entrando no set. | CSD15, CSD6, SSD3 | Cinemática da mão gigante entre rodadas. |
| Prateleira de miniaturas / bonecos reserva empilhados. | SMD6, SMD14, CSD19 | Mapa Prateleira de Adereços. |
| Objetos de mesa como arquitetura (apontador, lápis, borracha). | SMD15, SMD16, PLA2, PLA11, PLA14 | Escala: teclado e mesa atrás dos bonecos provam o tamanho; props do cotidiano viram prédios. |

## 4. Materiais do set

| Material | Referências | Decisão |
|---|---|---|
| Papelão/cartão cru, bege, com recorte mostrando a onda e a parte de trás sem pintura. | SSD4, SSD8, CSD16, SSB9 | Shader de papelão com fibra, variação de tom, borda ondulada em geometria nas faces de corte. |
| Madeira balsa clara, sem acabamento. | CSD16 | Veio fino, tom claro, poros. |
| Fachadas pintadas com cores pastel e desgaste. | SSB4, SSB10, SSB6, SSB7 | Tinta sobre papelão (Cidade). |
| Pedras/cobblestones esculpidos à mão. | SSB1, SSB5, SSD9 | Chão de rua da Cidade em massa cinza-azulada. |
| Metal de ferramenta/assadeira. | CSD19, SMD3 | Metal escovado com riscos, roughness média. |
| Tapete de corte verde com grade. | (paleta do PROMPT 0) + SMD3 (bancada) | Grade impressa + números na borda + riscos de estilete. |

## 5. Personagens

| Observação | Referências | Decisão |
|---|---|---|
| Silhuetas muito distintas: baixinho largo, alto magro, gordinho de braços inflados. | P3D11, P3D6, P3D10, PLA8, PLA2 | 5 modelos por facção com proporções extremas e cabeças/mãos/pés grandes (leitura rápida). |
| Roupas com vincos esculpidos, cabelo em espetos ou cobrinhas. | CSD7, CSD3 | Kit de roupa com dobras; cabelos por cobrinhas. |
| Peças montadas de primitivas simples (ovais, placas, bolas). | PLA6, PLA7, PLA14 | Construção por kit de primitivas + costuras. |
| Bases/plinths e arame (armadura) aparecendo. | PLA16, slamatron (armature) | Detalhe de arame em mortes por explosão (armadura exposta). |

## 6. Tipografia e UI

| Observação | Referências | Decisão |
|---|---|---|
| Letras de massinha grossas, tubos arredondados, cores terracota/verde/creme. | CIL5, PLA12, CIL1, CIL12 | Logo "MASSACRE" e títulos em geometria de massinha (cobrinhas + placas). |
| Faixas onduladas de massa como divisores. | CIL9 | Separadores de UI. |
| Esboço a lápis em papel creme. | CIL7, CIL8 | Radar storyboard. |
| Fundo liso de cor quente com sombra suave de contato. | CIL15, CIL18, PLA18 | Cartões de menu e vitrines de arma. |

## 7. Paleta — conferência

As cores do PROMPT 0 batem com o moodboard: terracota/laranja/creme de CIL5 e PLA2 (Massa Crua), azuis e verde-água de PLA14/PLA8/CIL11 (Tropa do Estúdio), papelão de SSD4, madeira de SSB9, verde do chroma/tapete de SMD13. Nenhuma troca de token necessária; acrescentamos apenas tons auxiliares de luz (âmbar da key `#FFB46B`, azul do fill `#8FB4FF`, violeta da noite `#4B3F8C`).

## 8. Pós-processamento

| Observação | Referências | Decisão |
|---|---|---|
| Profundidade de campo rasa vende a miniatura (fundo borrado atrás do boneco). | PLA4, PLA2, SSD6, SSD15 | Tilt-shift/DOF: forte em menu/killcam, mínimo em jogo. |
| Grão de foto e vinheta, cor quente. | CSD1, SSD16, CSD8 | Grão fino, vinheta suave. |
| Flicker leve de exposição entre fotos (problema clássico de stop-motion citado no guia de Terry Ibele — LEDs evitam flicker). | Terry Ibele | Flicker sutil e desligável, sincronizado com a troca de pose. |

## 9. Pós-processamento — estudo detalhado (subfase 2.5)

Leitura dos boards TSH (tilt-shift de miniatura), SMA (estética stop-motion), SML (luz de stop-motion) e BTS
(bastidores), mais duas leituras de fotografia de stop-motion: a entrevista de Tristan Oliver sobre *Isle of Dogs*
(British Cinematographer: lentes muito abertas, foco profundo e luz difusa quase sem sombra nos planos gerais) e o
artigo da AWN "The Advanced Art of Stop-Motion Animation: Digital Cinematography" (o normal em stop-motion é foco
mais profundo para não denunciar a miniatura; em *ParaNorman* usaram lentes longas e foco raso de propósito).
Conclusão: o jogo quer foco profundo (legibilidade competitiva) e guarda o foco raso para menu, vitrine e killcam.

| Observação | Referências | Decisão (arquivo) |
|---|---|---|
| Na foto de miniatura o foco é uma **faixa**: o desfoque cresce rápido acima e abaixo dela e o **primeiro plano também borra** e vaza por cima do que está nítido. | TSH1, TSH4, TSH8, TSH9, TSH10 | DOF por profundidade, CoC = abertura·(1 − foco/z) com camada "perto" que cobre o nítido; em menus e killcam, **plano focal inclinado** (faixa na tela) somado à profundidade (`render/passes/dofPass.js`). |
| O fundo fora de foco vira **discos** nas luzes (bokeh), não borrão gaussiano; o recorte entre planos é o que vende a lente. | TSH15, TSH14, TSH11, SMA9, SMA7 | Gather em disco com espiral de ângulo dourado (Gustafsson 2018, "bokeh em uma passada") em meia resolução; amostras de trás não vazam sobre o que está na frente. |
| Close de boneco: o rosto nítido e flores/cenário na frente e atrás bem desfocados. No jogo o foco é mais profundo (planos gerais de *Isle of Dogs*). | SMA7, SMA5, SML4 | Perfis por contexto em `data/postFx.js`: **jogo** quase sem DOF (só o fundo distante amolece), **vitrine/menu** médio, **killcam** forte. Autofoco na mira com transição suave em dioptrias. |
| Saturação e contraste de brinquedo — o efeito "maquete" some quando a imagem fica lavada. | TSH2, TSH4, TSH10, SMA2 | Grade final "massinha": vibrance (satura mais o que está menos saturado), contraste em S suave e leve aquecimento (`render/passes/lensPass.js`). |
| Lâmpadas práticas de tungstênio com **halo largo, macio e âmbar** (halação de filme), ao redor da fonte e não do cenário. | SMA9, SMA6, TSH11, TSH14 | Bloom só nas luzes: limiar HDR alto com joelho suave (painéis de softbox/lâmpadas passam, massa iluminada não), cadeia de mips com filtro de 13 amostras e média de Karis (Jimenez 2014), tingido de âmbar (`render/passes/bloomPass.js`). |
| O set é uma **ilha de luz**: cantos escuros e quentes, nunca pretos azulados. | SMA8, SMA10, SMA1, BTS1 | Vinheta que puxa para marrom-quente (`#3A2418`), proporcional à tela, com miolo largo. |
| **Grão** visível nos meios-tons e nas sombras, some nas altas luzes; cada fotograma tem o seu. | SMA7, SMA9, SMA11, SML4 | Grão de filme por **pose** (12/s), resposta de luminância de filme (máximo nos meios-tons), leve cor, tamanho ~1,5 px; dithering para não criar faixas no 8 bits. |
| Contato massa–mesa "assentado"; a sombra de contato fica na **cor da massa**, mais saturada. | SML5, BTS2, SMA5, PLA15 | GTAO (Jimenez 2016) em meia resolução a partir da profundidade da cena, desruído bilateral e composição **colorida**: a oclusão escurece e satura a própria cor; painéis de luz são poupados (`render/passes/aoPass.js`). |
| Lente barata de câmera de stop-motion: franja colorida só nas bordas, em planos de câmera especial. | SMA12, SML3 | Aberração cromática radial: 0 no jogo, sutil no menu, visível na killcam. |
| Flicker de exposição entre fotos (tungstênio, obturador mecânico). | Terry Ibele; SML2, SMA4 | Multiplicador de exposição por pose (±1,4%) antes do tone mapping; desligável e anulado por "reduzir movimento". |

## 10. Vitrine e revisão do look de massinha (subfase 2.6)

Treze boards novos (CLT a SMR, ~230 pins) estudados para a vitrine — a mesa do animador com 20 objetos que prova o
look de estúdio — e para rever de perto o que as capturas mostraram de errado: digitais que liam como trama de tecido
a meia distância e sumiam sob luz cruzada, marmorizado picotado demais, glitter sem cintilância e um rocambole feito
de cobrinha esticada. A vitrine é fotografada como **foto de produto de miniatura** (MFP7, MFP9, PLI2): câmera alta e
inclinada sobre o tapete, foco médio (contexto de pós `vitrine`), a mesa como ilha de luz no escuro (SSD1, CSD14).

| Observação | Referências | Decisão (arquivo) |
|---|---|---|
| A digital é antes de tudo uma **bacia rasa** do tamanho da ponta do dedo, com um lábio de massa empurrada na borda; os sulcos finos só existem onde houve pressão e só aparecem de perto, com luz rasante. | FPC14, FPC9, CLF17 | Atlas de digitais refeito: almofada oval de 13–19 u (ponta de dedo num boneco de 7,2 cm; 6×6 células em 96 u), laço/verticilo/arco com fase pela distância a uma "espinha" (espaçamento constante, bifurcações e sulcos que terminam). Afundamento `uDent` 8,5 (encostas de até ~13°) e sulcos `uRidgeAmp` 0,66 (~30°, somem nos mipmaps de longe) (`src/clay/atlases.js`). |
| As digitais se **agrupam** onde a peça foi segurada e deixam áreas lisas entre os grupos; nas peças muito manuseadas elas se **sobrepõem**. Nada de padrão regular. | CLT1, FPC9 | Presença 0,62 modulada por ruído de baixa frequência (fim da "trama de tecido" a meia distância) e, em peças tocadas (bonecos, armas, a placa da vitrine), uma segunda camada do atlas girada 90° e deslocada por cima da primeira (`src/clay/atlases.js`, `src/clay/ClayMaterial.js`). |
| O fundo do sulco é um pouco mais escuro que a crista (poeira e oclusão fina), o que desenha a digital mesmo com luz frontal. | CLT1, FPC14 | Micro-oclusão pelo canal de sulco do atlas: até −16% no albedo dentro do sulco (`src/clay/ClayMaterial.js`). |
| A plasticina espalha luz só por uma fração de milímetro: o terminador da **forma** é macio e saturado, mas o relevo fino continua nítido no lado da sombra. | CLT1, FPC14, PLA15 | Wrap e faixa de subsurface calculados só com a normal geométrica; digitais e ferramenta entram como diferença de Lambert por cima (antes o wrap comia metade do contraste e qualquer luz cruzada apagava as digitais) (`RE_Direct_Clay` em `src/clay/ClayMaterial.js`). |
| Digital só lê com luz **rasante vinda de um lado**; nas capturas, o rim baixo e oposto à key cancelava o gradiente do relevo. | FPC14, CLT1 (e as capturas de teste da sessão) | Rim da montagem `vitrine` subiu e foi para trás (150, 720, −760), 2,8 lx: recorta de cima sem apagar o relevo que a key desenha (`src/data/studioRigs.js`). |
| Marmorizado de verdade: duas massas enroladas, torcidas e dobradas — **poucas faixas largas** que fluem (5–8 numa bola), fronteira nítida, divisas em V da dobra, zonas onde a fronteira se alarga num tom intermediário e um veio fino escuro onde as massas se encostam. | MPC3, MPC11, MPC15, MPC17 | Skin marmorizado: frequência pela metade, distorção de domínio 2,6, dobra por `abs(fract())`, zonas de mistura parcial e veio anti-serrilhado pela derivada da tela (`src/clay/glsl/skins.js`, parâmetros em `src/data/claySkins.js`). |
| Glitter em massinha: pontinhos finos e densos que têm **cor própria** mesmo sem reflexo, e o **lado iluminado inteiro cintila** em pontos coloridos iridescentes; poucas lantejoulas maiores. | GPD1, GPD2, GPD4, GPD7, GPD13 | Duas populações de flocos (fino ~0,5 u denso; grosso esparso). Floco = meio espelho, meio pigmento, deitado na massa (~15° de inclinação, sorteada de novo a cada pose). Como só ~1% dos flocos acertaria o espelho de uma softbox, a película holográfica é modelada como grade de difração cruzada: anel da 1ª ordem a ~14–40° do espelho, cor girando com o ângulo, radiância ~1,6·E. Longe, o floco sai em média e a massa fica perolada, sem chiado (`skins.js`, `ClayMaterial.js`). |
| Massa que brilha no escuro: pastel quase branco sob luz, verde-limão forte só onde a luz não chega. | GDC2, GDC5, GDC17 | Emissão fraca e constante (domina só na sombra); fantasminha dentro de um túnel de papelão para ter onde brilhar (`skins.js`, `src/debug/showcaseObjects.js`). |
| Massa misturada de criança: cobrinhas de três cores torcidas juntas e, onde amassou mais, uma "lama" das três. | MPC6, MPC12, PLI11 | Setores helicoidais de fronteira nítida + lama onde o ruído manda; na vitrine, corda torcida + bola já amassada (`skins.js`, `showcaseObjects.js`). |
| Massa escolar e pote: bolachas empilhadas de cores lavadas com pó; pote amarelo com tampa azul encostada e a massa guardando o formato do pote. | GPD1, PDH10, PDH8, PDH13 | Pilha de discos com costura entre eles (skin escolar desbotada) e pote com o bloco tirado ainda cilíndrico (`showcaseObjects.js`). |
| Rolinho/rocambole: a espiral da folha aparece na face, as voltas são regulares e a ponta da folha fica **embaixo** do rolo. | MFP3, MFP15 | Forma SDF nova `spiral` (distância exata à polilinha da espiral com janela angular demonstrável, extrusão arredondada) com duas folhas de massa; emenda girada para baixo (`src/clay/sdf/shapes.js`, `bounds.js`, `showcaseObjects.js`). |
| Onde duas massas se encostam a fronteira de cor é **limpa**, sem degraus. | MFP3, CLT3, PLA17 | Corte exato das fronteiras de material no marching cubes: busca binária do ponto de troca em cada aresta, triângulos de duas e três cores refeitos sem junção em T (`src/clay/sdf/materialSplit.js`). |
| Duas massas apertadas uma na outra com dedadas; cabeça esculpida sobre pedestal com nariz, sobrancelha e orelhas soldados e olhos de massinha. | CLT3, CLT12, CLF17, CLF3, CLF14, AAC3 | Peças SDF da vitrine: vinco de costura + três dedadas por subtração suave; cabeça com órbitas por subtração suave e olhos com pupila (`showcaseObjects.js`). |
| Armadura de stop-motion: arame de alumínio torcido, "ossos" de massa epóxi, blocos de balsa no peito/quadril e porcas de fixação nos pés. | ARM5, ARM12, ARM15, ARM18, SMR2 | Armadura de 72 u na vitrine com esses quatro materiais (`showcaseObjects.js`). |
| Rolo de fita crepe: a lateral mostra **anéis de camadas** pelo raio e poeira grudada na cola; a ponta solta cai na mesa. | TRL1, TRL4, TRL5, TRL10 | Material da lateral do rolo: anéis de tensão do enrolamento (a espessura real do papel, 0,13 mm, some em sub-pixel e vira faixas), rolo levemente excêntrico, borda externa mais clara, cola amarelada com poeira e relevo das camadas que "telescoparam" (`src/clay/set/paperMaterials.js`). |
| Etiqueta de bancada: tira de fita crepe escrita à mão com caneta. | TRL1, SSD2, SSD14 | Atlas de texto em canvas com letra a letra girada/variada e material de fita que o lê (`src/clay/set/labelAtlas.js`, `tapeLabelMaterial`). |
| Braço de rig (haste articulada com base pesada e garra) segurando o boneco na frente do chroma. | SMR1, SMR4, SMR7 | Registrado para as bordas dos mapas (Fase 6) e para a mão/rig do animador entre rodadas; a vitrine não usa. |
| Luz parada e nada se movendo na mesa: a sombra não precisa ser refeita a cada quadro. | (desempenho) | Sombra estática por mapa (`staticShadows`): o mapa de sombra só é refeito quando algo pede (troca de qualidade, contexto recuperado) — ~1,4 ms de GPU a menos por quadro na vitrine (RTX 2070, preset Leve) (`src/render/renderSystem.js`). |
| O desfoque de fundo de uma lente é liso; o DOF em meia resolução deixava silhuetas "cabeludas". | TSH1, TSH15 | Rotação do disco por ruído de gradiente intercalado (Jimenez 2014) + pós-filtro em tenda 3×3 na meia resolução (`src/render/passes/dofPass.js`). |

## 11. Pista de testes (subfase 3.3)

Dezessete boards novos (COC a LDB, 330 pins) estudados para a pista de testes de movimento, mais a página
"Counter-Strike: Global Offensive/Mapper's Reference" da Valve Developer Community (medidas de mapa do CS:GO: caixa
grande ≥ 72, caixa de "headglitch" 56–60, degrau ≤ 18 com piso ≥ 16, rampa andável até 45,573°, corredor > 32, teto que
não bate a 73 em pé e 55 agachado, alturas alcançáveis e tabelas de dano de queda). A pista é um **parque de estações**
montado pelos animadores no chão do estúdio (desenho aprovado em 2026-09-25, `docs/phases/phase-3.md`, seção 3.3). A
chave de tudo é a escala: **1 u = 1 mm** (o boneco de 72 u tem 7,2 cm), então cada objeto do dia a dia entra com a
medida verdadeira e vira arquitetura — um livro deitado (150 × 230 × 8–24 u) é um degrau, uma régua (300 × 30 × 3 u) é
uma trave, uma trena de 5 m é a faixa de bhop.

| Observação | Referências | Decisão (arquivo) |
|---|---|---|
| Pista de obstáculos de criança: estações em sequência com placas escritas à mão e uma **planta desenhada** (caminho tracejado, números, largada e chegada). | COC5, COC30, COC32, PKC12, PKC1, CFO19 | 12 estações numeradas; plaquinha de papelão dobrada em "A" com número e nome em cada lote; planta da pista desenhada a lápis numa prancheta no spawn, gerada dos próprios dados do layout (`src/maps/pista/visual/art.js`, `src/data/pista.js`). |
| Foto de bancada vista de cima: objetos paralelos e ortogonais com respiro (knolling); ginásio de parkour e blockout de jogo marcam áreas e rotas com **linhas no chão**. | DFL1, DFL5, DFL10, PKG1, PKG8, LDB9, LDB15 | Lotes alinhados à grade da base, cada um demarcado no compensado com fita crepe; peças de cada estação alinhadas entre si (`src/maps/pista/layout.js`). |
| Escada de livros de verdade: pilhas em degrau com a **lombada virada para fora**; espelhos pintados como lombadas com título. | BAS11, BAS7, BAS15, BAS18 | Seis pilhas de seis livros da mesma espessura (8/12/16/18/20/24 u), do maior embaixo ao menor em cima, costas alinhadas e frentes recuando 40 u; lombadas com título e altura (`src/clay/set/bookGeometry.js`, `bookMaterial.js`, `src/maps/pista/visual/books.js`). |
| Livros em espiral e torre de livros com escada encostada. | BAS1, BAS4, BAS6, BAS8, BAS9 | Torre de queda: escada em espiral de ~78 livros encaixados num tubo de papelão grosso (Ø 180 u, 1310 u), 18° por degrau, espessura por trecho para as pranchas caírem exatas em 200/420/600/900/1310 u (`src/maps/pista/layout.js`, `visual/books.js`). |
| Régua de crescimento: tábua em pé com **numerais grandes pintados**, traços longo/médio/curto e anotações à mão com risquinho na altura; tema de pista de corrida com bandeira quadriculada. | WRG1, WRG4, WRG5, WRG11, WRG15 | Tábua de crescimento de 1400 u ao lado da torre (numerais brancos a cada 100 u, traços a cada 10 u, notas nas cinco alturas); bandeirinha xadrez de papel na chegada do bhop (`src/clay/set/measureMaterials.js`, `visual/art.js`). |
| Blocos de montar de madeira: faia clara com cantos arredondados, tons variando de bloco para bloco. | AWB1, AWB4, AWB12, AWB17 | Caixas de 57/58/64/66/67/72 u em blocos de faia com a altura em estêncil (`src/clay/set/woodMaterials.js`, `visual/wood.js`). |
| Obstáculos de fingerboard (a escala do boneco): cunhas fechadas dos lados, caixas com cantoneira, escada de compensado com as **lâminas à mostra**, peças sobre o tapete de corte verde, etiquetas à mão. | CFO4, CFO8, CFO9, CFO11, CFR6, CFR7, CFR19 | Rampas de 15/30/44/46/60° como cunhas de papelão fechadas sobre o tapete de corte, com transferidor de papel colado na lateral; compensado com as lâminas nas bordas na base e nas paredes do wall-jump (`visual/cardboard.js`, `woodMaterials.js`). |
| Pista de bolinha de papelão: rampas sobre tubos de papel-toalha, montada em cima do tapete de corte. | CMR5, CMR12, CMR15 | Tubo de papelão (kit do set) como pilar e caixa de arquivo como plataforma das rampas (`visual/cardboard.js`). |
| Túnel de caixas: furos redondos no teto, fendas de respiro, **pisca-pisca por dentro**, interior marrom quente com luz vazando nas emendas; arcos de papelão curvado presos com fita. | COC2, COC25, CBT6, CBT7, CBT13, CBT14 | Três caixas rasas emendadas (60/96/60 u por dentro), furos e fendas, 12 lampadinhas quentes no teto e uma luz prática sem sombra na caixa do meio (`visual/cardboard.js`, `visual/extras.js`, `src/data/studioRigs.js`). |
| Paredes de papelão de uma face curvadas e tiras em pé mostrando a onda no corte. | CBT12, COC15, COC13 | Paredes finas (2 u) de papelão de uma face — opção nova do material de papelão — em zigue-zague, quina de 20°, curva, vãos de 33/31 u e fileira de 0,5/1/2/4 u (`src/clay/set/paperMaterials.js`, `visual/cardboard.js`). |
| Parkour: subida entre duas paredes altas, wall-jump num beco estreito, estruturas de compensado com bordas pintadas. | PKG3, PKG6, PKG11, PKC14, PKG19 | Poço de 4 paredes de compensado, cada uma com faixa de cor e número (paredes distintas para a regra de 1 wall-jump por parede); corredor em zigue-zague de painéis alternados sobre um vão (`visual/wood.js`, `src/data/pista.js`). |
| Ripas de balsa presas com alfinete sobre a planta; a ripa é creme, de fibras longas e ponta felpuda. | BWM1, BWM10, BWM14, BWM16 | Vigas de 32/16/8/4 u de balsa com alfinetes de cabeça colorida nas pontas e uma ripa inclinada a 20° (`visual/wood.js`, `src/clay/set/stationeryGeometry.js`). |
| Fita métrica e trena: números a cada centímetro, traços nas duas bordas, ponta de metal; a fita solta enrola e torce; fitas antigas amareladas. | TMA2, TMA5, TMA6, TMA9, TMA11, TMA12 | Trena de aço amarela esticada ao longo da faixa de bhop (número a cada 10 u, vermelho a cada 100 u) com o estojo na chegada (`measureMaterials.js`, `stationeryGeometry.js`, `visual/extras.js`). |
| Lápis sextavado apontado, régua de madeira com bisel e traços, régua escolar, borracha. | PRU1, PRU2, PRU3, PRU15 | Traves dos vãos de slide: régua de madeira, lápis (laca, madeira, grafite, ponteira e borracha), régua de aço e espeto de bambu apoiados em blocos com uma bolota de massinha (`stationeryGeometry.js`, `src/clay/set/paintMaterials.js`). |
| Impressão na massa: placa aberta no rolo com borda cortada à mão, a marca é uma bacia com **lábio de massa empurrada**, letras carimbadas e borda de furinhos; pegada de pé descalço numa superfície lisa. | CFP1, CFP7, CFP10, CFP19, CIM1, CIM5, CIM8 | Sete placas de massinha (P-E-G-A-D-A-S) com letra carimbada e borda de furos, por um canal de impressão opcional no `ClayMaterial` (relevo com lábio + fundo mais escuro) que a 3.5 reaproveita para as pegadas (`src/clay/ClayMaterial.js`, `visual/clayPlates.js`). |
| Blockout de level design: leitura por silhueta, grade no chão, rotas coloridas. | LDB9, LDB15, LDB3 | Folha de papel quadriculado com grade de 1 m (100 u) e 20 u na quadra de counter-strafe, metros numerados nas bordas (`measureMaterials.js`). |
| O set grande é uma ilha de luz no estúdio escuro; luz baixa e quente com sombras longas sobre a bancada. | SSD1, CSD14, DFL5, DFL6, DFL12 | Montagem de luz `pista`: key de tungstênio alta e distante (queda suave de ~2× do centro às bordas), fill frio, rim do norte, luminária acesa no spawn e luz do túnel; sombra estática com mapa ×2 (`src/data/studioRigs.js`). |
