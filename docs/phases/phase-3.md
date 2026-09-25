# Fase 3 — Movimento, física e colisão (plano técnico)

Base: PROMPT 0 seção 0.6 inteira + Fase 3 de `CLAUDE.md.md`. Aprovado em 2026-09-24: cinco subfases nesta ordem,
colisão por **varredura contínua exata** da cápsula (opção A) com o movimento do Source por cima.

## Estado das subfases

| Subfase | Conteúdo | Estado |
|---|---|---|
| 3.1 | Mundo de colisão BVH + controlador cápsula (paredes, quinas, degraus, rampas, teto, beirada, chão), gravidade, pulo, agachar com troca de cápsula, noclip, sala de testes andável, debug, testes sem navegador (10 min simulados sem atravessar) | ✅ 2026-09-25 |
| 3.2 | Movimento tático CS: velocidade por arma, andar silencioso, agachar (spam), air-strafe, bunny hop com penalidade, counter-strafe medido, inaccuracy de movimento para a Fase 4, eventos de passo | ✅ 2026-09-25 (plano executado: `docs/phases/phase-3.2-plan.md`) |
| 3.3 | Pista de testes: pesquisa no Pinterest + mapa `pista` com os módulos de movimento | ✅ 2026-09-25 (plano executado: `docs/phases/phase-3.3-plan.md`) |
| 3.4 | Slide, wall-jump, dano de queda, vida mínima do jogador e respawn | ✅ 2026-09-25 (plano executado: `docs/phases/phase-3.4-plan.md`) |
| 3.5 | Sensação: head-bob, inclinação, squash & stretch no pouso, pegadas na massa + aceite da fase | — |

## Unidades e números de referência

As unidades do PROMPT 0 são as do CS (boneco de 72 u, faca a 250 u/s), então os valores do CS:GO valem direto.
Eixo Y para cima (three.js); a origem do jogador fica nos **pés** (centro da base da cápsula).

| Grandeza | Valor | Origem |
|---|---|---|
| Cápsula em pé | raio 16, altura 72 (o corpo do boneco de referência tem raio ~15) | hull 32×32×72 do CS |
| Base chata (chão) | disco de raio 16 nos pés | fundo reto da caixa do CS |
| Cápsula agachada | altura 54 | hull agachado do CS:GO |
| Olho | 64 em pé, 46 agachado | VEC_VIEW / VEC_DUCK_VIEW |
| Gravidade | 800 u/s² | sv_gravity |
| Pulo | 301,993377 u/s (= √(2·800·57): ápice de 57 u) | sv_jump_impulse |
| Degrau | 18 u | sv_stepsize |
| Chão andável | normal.y ≥ 0,7 (~45,6°) | Source |
| Atrito / parada | 5,2 / 80 u/s | sv_friction / sv_stopspeed |
| Aceleração chão / ar | 5,5 / 12, desejo no ar limitado a 30 u/s | sv_accelerate / sv_airaccelerate / sv_air_max_wishspeed |
| Velocidade máx. absoluta | 3500 u/s por eixo | sv_maxvelocity |
| Folga de contato | 0,03125 u | DIST_EPSILON |
| Agachado | velocidade × lerp(1; 0,34) pelo quanto agachou; descer a 0,8 × velocidade do agachar (8) e levantar a máx(1,5; velocidade), com penalidade de spam — 13 e 11 ticks no uso normal (3.2) | CS:GO |
| Agachar no ar | instantâneo (3.2): pés sobem 9 u e cabeça desce 9 u (pulo agachado ≈ 66 u, alcança caixas de 64) | CS:GO |
| Teto de qualquer item | 260 u/s (faca e bomba 250, granadas 245, armas pela tabela da seção 0.6) | CS_PLAYER_SPEED_RUN |

Todos esses números ficam em `src/data/movement.js`; as variáveis `sv_*` podem ser trocadas em tempo de execução
pelo console (no online, o host as replica — Fase 9).

## 3.1 — Colisão e controlador cápsula

### Por que varredura contínua exata
A cápsula é arrastada pelo deslocamento do tick e para no primeiro contato (tempo de impacto exato, com folga de
0,03125 u). Não há deslocamento "às cegas" seguido de empurrão: nada atravessa parede fina em nenhuma velocidade,
o contato traz a normal certa para o corte de velocidade do Source e o resultado é determinístico (predição da rede).

### Geometria de colisão (`src/physics/colliders.js`)
Separada da geometria visual onde ela engana: o boil e as digitais da massinha são deformação de shader e não podem
virar tropeço, malha densa de massinha deixaria cada varredura cara, e o relevo do tapete e o empeno do papelão são
só visuais. Cada mapa monta as suas formas com `ColliderBuilder`: `box`, `cylinder` (polígono circunscrito), `ramp`
(cunha), `stairs`, `triangle`/`quad`, `geometry` (malha já baixa) e `object` (as malhas de um objeto nas matrizes de
mundo — props lisos de plástico, madeira e metal, que não têm boil e têm poucos triângulos). Triângulos degenerados
(polos de torno) são descartados. Cada triângulo carrega o **material de superfície** (índice por triângulo, copiado
na ordem final do BVH) — tabela em `src/data/surfaces.js`: nome, atrito relativo, fator de pulo, se aceita pegadas
(3.5) e o volume do passo (3.2); a Fase 4 acrescenta densidade e espessura para o wallbang.

### Mundo de colisão (`src/physics/collisionWorld.js` + `collisionBody.js`)
- Corpos com `MeshBVH` (three-mesh-bvh, SAH). O corpo estático do mapa junta todas as formas em espaço de mundo;
  corpos rígidos extras (props que se mexem, paredes que o chefe O Escultor levanta — Fases 6 e 8) têm matriz
  própria: a consulta entra no espaço local do corpo (transformação rígida preserva distâncias).
- Depois do build, os triângulos são copiados na ordem final do BVH para `Float64Array` (vértices, normal da face,
  superfície) — a fase estreita lê direto dos arrays, sem objetos por triângulo.
- Consultas (sem alocar por chamada):
  - `sweepCapsule(origem, deslocamento, raio, altura, out)` — o "trace" do Source: fração, posição final, normal de
    contato, normal da face (orientada para a cápsula), ponto, superfície, corpo, triângulo, `startSolid`.
  - `supportBelow(x, z, raio, minY, maxY, normalMínima, out)` — o chão da base chata: a face andável virada para
    cima mais alta dentro do cilindro vertical do disco dos pés, entre `minY` e `maxY` (altura exata de cada
    triângulo dentro do disco: vértices dentro, cruzamentos aresta–círculo e os pontos da borda na direção do
    gradiente). Face que passa de `maxY` dentro do disco é obstáculo acima da base, não chão; face virada para baixo
    nunca é chão.
  - `deepestContact`, `canOccupy` (cabe aqui?) e `depenetrate` — empurra para fora do contato mais fundo, até 8
    iterações; se continuar preso, `findFreeSpot` procura em anéis (primeiro para cima), com um filtro opcional que
    recusa lugares livres que não servem (sem chão, por exemplo).
  - `raycast(origem, direção, distância, out)` — base do hitscan (Fase 4).
  - `stats`: varreduras, sobreposições, raios e triângulos testados (overlay de debug, por tick).
- Poda do BVH: cada nó é testado pelo tempo de entrada do centro da cápsula na caixa do nó expandida pela meia
  extensão da cápsula (teste de lajes); `boundsTraverseOrder` visita primeiro os nós mais próximos e descarta os que
  começam depois do melhor impacto já achado.

### Fase estreita (`src/physics/capsuleSweep.js` + `geometryQueries.js`)
A cápsula é um segmento vertical com raio. Para cada triângulo candidato:
1. Rejeição rápida pelo plano do triângulo (as quatro pontas do segmento, no início e no fim, do mesmo lado e além
   do raio).
2. **Avanço conservador com a direção separadora**: com os pontos mais próximos segmento–triângulo em `t`, a
   distância nunca cai mais rápido que `D·n` (n = direção do triângulo para a cápsula). Isso vale para qualquer par
   convexo, então o passo `t += (dist − alvo) / (−D·n)` nunca ultrapassa o contato. Se `D·n ≥ 0`, a cápsula não se
   aproxima mais desse triângulo e ele é descartado. O contato de face converge num passo; aresta e vértice, em
   poucos. Deslizar rente à parede não custa iterações (`D·n = 0`).
3. Pontos mais próximos segmento–triângulo (Ericson, *Real-Time Collision Detection* 5.1): interseção do segmento
   com o triângulo; senão, o mínimo entre as duas pontas contra o triângulo e o segmento contra as três arestas.
Triângulos valem dos dois lados (paredes finas de papelão); a normal sai sempre do triângulo para a cápsula.

### Controlador (`src/physics/characterController.js`) — porte do `gamemovement.cpp` do Source em Y para cima
**Cápsula colide, base chata decide o chão.** A cápsula faz as varreduras (paredes, teto, obstáculos); o chão é o do
disco dos pés (raio 16), como o fundo reto da caixa do CS (e o `bUseFlatBaseForFloorChecks` da Unreal): o jogador
fica de pé em qualquer chão andável que o disco cubra — beirada de caixa com o eixo até 16 u para fora da borda, sem
afundar —, sobe degrau até `sv_stepsize` em qualquer velocidade e só alcança a beirada que o pulo alcança. A primeira
versão decidia o chão pelo contato da própria cápsula (um "raio de apoio" de 15,5 u): o redondo de baixo segurava o
jogador em quinas até ~12 u acima dos pés — o pulo em pé "empoleirava" na caixa de 64 u, reservada ao pulo agachado —
e o avanço lento emperrava no espelho do degrau; foi trocada na execução.
- `support(x, z, pésMín, pésMáx)` → `supportBelow` do mundo com o raio do disco: a face andável mais alta sob a base.
- `tryPlayerMove`: até 4 batidas, até 5 planos, `clipVelocity` com overbounce 1, deslize pelo vinco de dois planos,
  parada seca contra velocidade oposta à original (sem tremer em quina inclinada). Contato de **quina baixa** (aresta
  ou vértice pego pelo redondo de baixo: normal subindo e diferente da normal da face) usa o `clipLowEdge`: primeiro
  tira a velocidade horizontal que entra na quina e só corta contra a normal verdadeira se ainda entrar — a quina nunca
  dá impulso para cima (subir beirada mais alta que o pulo) nem segura a cápsula pendurada; no vinco, a velocidade
  vertical não passa da original.
- `stepMove`: compara "deslizar direto" com "subir 18 u + deslizar + descer até o chão da base (no máximo até a altura
  de partida)" e fica com o que andou mais no plano; se a cápsula não desce até lá, vale o deslize direto.
- `stayOnGround`: a base acompanha o chão que cobre — desce e sobe escada e rampa até 18 u para cada lado, se a
  cápsula passar.
- `categorizePosition(s, pésNoComeçoDoTick)`: chão da base até 2 u abaixo dos pés, ou atravessado de cima para baixo
  durante o tick (pouso na beirada); os pés descem até ele por uma varredura vertical. Subindo a mais de 140 u/s não
  gruda; subindo em rampa íngreme o atrito da superfície cai para 0,25 (Source).
- Degrau e grudar no chão deixam o salto brusco de altura em `viewOffset` (a câmera suaviza); a variação que a
  inclinação do chão explica pelo deslocamento no plano (rampa) é contínua e não entra.
- `resolvePenetration`: desempenetra; se o segmento está todo dentro de um sólido, procura espaço livre a partir da
  posição original. Com o eixo dentro de uma parede fina cada face empurra para o seu lado; se o empurrão passa de 8 u
  e cai num lugar sem chão (noclip desligado no meio da parede da borda do set), vale antes um lugar livre com chão
  até 128 u abaixo dos pés.
- `fits` / troca de cápsula: agachar no chão encolhe pelo topo; no ar encolhe pelo centro (pés +9, cabeça −9);
  levantar só acontece se a cápsula em pé couber (no ar baixa os pés só se couber e se não houver chão da base entre
  os pés baixados e os atuais; senão sobe a cabeça).
- `lastContact`: ponto e normal do último contato que cortou a velocidade (desenhado pelo `r_colisao`).

### Movimento (`src/player/movement.js`) — `FullWalkMove` do Source
Função sobre dados simples: `playerMove(state, cmd, env)`, com `state` (origem, velocidade, chão, agachado,
botões anteriores, velocidade de queda...), `cmd` (tick, frente/lado de −1 a 1, botões, yaw/pitch) e `env` (mundo,
variáveis sv, velocidade máxima da arma). Ordem por tick: agachar → meia gravidade → pulo (antes do atrito, o que
permite o bhop) → atrito no chão → `walkMove` ou `airMove` → `categorizePosition` → meia gravidade → queda/pouso.
Eventos do tick numa lista reutilizada: `jump`, `land` (velocidade de queda, superfície), `duck`/`unduck`. Degrau e
troca de cápsula no ar deixam no estado o `viewOffset` do tick (o salto brusco de altura que a câmera suaviza); rampa
contínua não entra nele. Noclip é outro tipo de movimento (voo com aceleração e atrito, sem colisão);
ao sair do noclip dentro da geometria, o `resolvePenetration` tira o jogador (pelo lado com chão). O mesmo `playerMove` vai rodar
na predição do cliente (Fase 9) e nos bots (Fase 7), que só geram outro `cmd`.

### Jogador (`src/player/moveCmd.js`, `src/player/playerPawn.js`)
- `moveCmd`: monta o comando do tick a partir do `InputManager` (movimento analógico, bits de botão de todas as ações
  de jogo, ângulos). O olhar é consumido antes dos ticks do quadro, então o comando usa o yaw mais recente.
- `PlayerPawn`: estado atual + anterior para interpolar no render, altura do olho interpolada pelo agachar,
  suavização de degrau (a câmera não "pula" ao subir 18 u; decaimento exponencial com constante de 0,06 s, teto de
  24 u), terceira pessoa de debug, teleporte, estatísticas, custo da física por tick (média móvel) e eventos no
  barramento (`EV.PLAYER_JUMP`, `EV.PLAYER_LAND`, `EV.PLAYER_DUCK`).
- `matchState`: mapas com `collision` usam o `PlayerPawn` (modo "andar"); mapas sem colisão (vitrine) continuam com
  a `FreeCamera`. `setpos`/`getpos` passam a usar os pés do jogador. Quem desliga o noclip fora do set cai e, 1500 u
  abaixo do chão do mapa, volta ao spawn.

### Sala de testes andável
Formas de colisão: laje do chão e quatro caixas de parede (papelão de 4 u + empeno: 6,4 u); pote e tampa encostada
com a própria malha — o pote é aberto: dá para cair dentro; de fora, o pulo em pé (ápice de 57 u) não alcança a
borda de ~62 u e o agachado (≈66 u) alcança; por dentro, o fundo curvo ergue a base chata a 8,4 u encostado na parede
interna, então o pulo em pé alcança a borda e sai; a tampa é um disco inclinado (superfície íngreme); espátula
deitada com a própria malha (degrau baixo de ~8,6 u); boneco de referência de massinha em cilindro. O spawn passa a
ser a posição dos pés. HUD com as dicas de andar (WASD, Espaço pula, Ctrl agacha).

### Debug
- `r_colisao 0|1` — arame das formas de colisão (por cima de tudo) e da cápsula (em terceira pessoa e no noclip),
  com a normal do chão e a do último contato.
- `cl_showpos 0|1` — painel com posição, velocidade, velocidade horizontal, chão/ar/noclip, normal e superfície do
  chão, estado do agachar. Fica no canto superior direito; em tela estreita desce para baixo do overlay em vez de
  cobri-lo (os painéis fixos ficam em fluxo numa linha que quebra).
- `thirdperson` / `firstperson` — câmera atrás do jogador (recolhe ao bater na parede, via varredura de esfera).
- `sv_gravity`, `sv_maxspeed`, `sv_maxvelocity`, `sv_accelerate`, `sv_airaccelerate`, `sv_air_max_wishspeed`,
  `sv_friction`, `sv_stopspeed`, `sv_stepsize`, `sv_jump_impulse`, `sv_bounce`, `sv_reset` — variáveis de movimento
  em tempo de execução (valores do CS:GO, faixas limitadas).
- Overlay completo: linha "física" (varreduras, triângulos e µs por tick).

### Testes (Node, sem navegador)
- Matemática contra força bruta: ponto–triângulo, segmento–segmento, segmento–triângulo e altura de triângulo dentro
  do disco dos pés (amostragem densa).
- Varredura contra amostragem: nenhum contato antes do `t` devolvido e distância igual ao alvo no `t`; faltas
  conferidas pelo caminho inteiro (margem de Lipschitz).
- Mundo: corpo girado igual ao assado; chão da base chata (borda de caixa a 16 ± 0,1 u, quina, limite da faixa, topo
  de rampa de 30°, rampa acima da faixa, rampa de 60°, fundo de prateleira virado para baixo, fora do mapa) no corpo
  parado e no girado.
- Cenários do controlador: deslizar em parede e em quina aguda sem tremer, subir degrau de 18 (inclusive agachado e
  partindo parado encostado no espelho) e barrar o de 20, rampa de 30° andável e de 50° escorregando, teto parando o
  pulo, beirada (em pé com o eixo a 15,9 u fora da borda, cai a 16,1), grudar descendo escada, túnel baixo sem
  conseguir levantar, pulo agachado alcançando 64 u e não 72 (e o pulo em pé não), noclip desligado dentro da parede
  fina da borda do set saindo pelo lado do chão.
- **10 min simulados** (38.400 ticks) com entrada aleatória, velocidades de até 3500 u/s, paredes de 0,5 a 2 u
  dividindo a sala em células e um corpo em movimento empurrando o jogador: a célula nunca muda, nenhuma
  penetração além da tolerância, resultado idêntico em duas execuções com a mesma seed.

### Aceite da 3.1 (2026-09-25)
- [x] Sala de testes andável: paredes, pote, tampa, espátula e boneco colidem (empurrões de até 3500 u/s param na
  distância exata); quinas sem tremer; beirada funciona; no pote aberto se entra caindo, de fora só o pulo agachado
  alcança a borda (em pé: 57,03 u < ~62 u) e por dentro o pulo em pé sai (fundo curvo: base a 8,4 u).
- [x] Degraus (≤ 18 u), rampas (≤ ~45,6°) e deslize em rampa íngreme; teto barra pulo e levantar.
- [x] Pulo com ápice de ~57 u (`sv_gravity 400`: 114,03 u); pulo agachado alcança 64 u, o em pé não.
- [x] Noclip liga/desliga sem prender o jogador na parede (e sai pelo lado do chão); fora do set cai e volta ao spawn.
- [x] `r_colisao`, `cl_showpos`, `thirdperson` e `sv_*` funcionando; overlay com a linha de física (~73 µs/tick
  correndo, pulando e raspando nas paredes; 31–45 µs parado).
- [x] Testes passando (113), incluindo os 10 min simulados sem atravessar parede.
- [x] Sem erros do jogo no console; sem vazamento ao entrar e sair do mapa 3× (sala 30 geometrias / 37 texturas /
  29 programas nas três vezes, menu 2 / 34 / 18; heap JS 19–21 MB depois da coleta); arquivos < 600 linhas; números
  em `src/data/`.

## 3.2 — Movimento tático CS

Desenho aprovado em 2026-09-25, seção por seção. Base: o movimento do CS:GO lido no código do jogo (a árvore
`cstrike15` de ~2017 publicada em 2020; as fórmulas abaixo foram conferidas linha a linha nela) e os dados finais do
CS:GO (`items_game.txt` de maio de 2023), cruzados com o modo "Vanilla" do GOKZ e com uma planilha da comunidade
(269 de 275 valores iguais; as 6 diferenças são erros da planilha). Notas completas, com pseudocódigo, fontes e
vetores de teste, em `docs/research/csgo-movement-notes.md` e `docs/research/csgo-inaccuracy-notes.md` (em inglês,
como vieram das fontes); dados por arma em `docs/research/csgo-weapon-accuracy.json`.

Decisões do usuário nesta subfase:
- **Abordagem A**: movimento, item na mão, luneta, inaccuracy e passos são funções puras sobre dados, montadas pelo
  `PlayerPawn`; a troca de item viaja no comando do tick. Bots (Fase 7) e rede (Fase 9) reaproveitam tudo gerando
  outro comando.
- **Luneta funcional já na 3.2** (níveis, FOV, sensibilidade, velocidade e inaccuracy com zoom); o visual da luneta
  (anel de massinha, retícula de arame, distorção) fica na Fase 4.
- **Andar silencioso**: segurar no teclado; alternar no controle e no toque; configurável por dispositivo.
- **Pulo da 3.1 mantido**: impulso definido e parábola exata, ápice de 57 u em pé. O CS:GO a 64 tick soma o impulso à
  meia gravidade e cobra meia gravidade a mais no tick do pulo (ápice de 54,65 u); é uma diferença intencional.
- **Passos por tempo**, como no CS:GO (o rascunho dizia "por distância").
- A 3.1 continua sem commit (branch `fase-3.1`); a 3.2 entra na mesma árvore até o usuário pedir o commit.

### Ordem do tick
No `PlayerPawn`, a cada tick (a ordem do `RunCommand` do Source):
1. **Item na mão**: aplica `cmd.select` e sincroniza com o `Loadout` — antes do movimento, como o `weaponselect`. Item
   novo na mão ("sacou"): zoom 0, precisão zerada, `EV.PLAYER_WEAPON`.
2. **`playerMove`** (lista abaixo).
3. **Precisão**: o pouso do tick soma a penalidade de pouso; depois a penalidade é atualizada (base, subida, queda).
4. **Luneta**: `ATTACK2` sobe o nível de zoom; vale a partir do tick seguinte (no `ItemPostFrame` do CS o
   `SecondaryAttack` roda depois do movimento e da atualização da precisão).
5. **Telemetria**, eventos no barramento e (no `matchState`) o medidor de counter-strafe.

`playerMove(estado, cmd, env)` — porte do `PlayerMove`/`FullWalkMove` do CS:GO:
1. `checkParameters`: teto do tick; portão do agachar (spam); andar (Shift); fator da stamina com o valor de antes da
   recuperação deste tick.
2. `reduceTimers`: stamina −`sv_staminarecoveryrate`·dt (mínimo 0); tempo desde o último agachar completo.
3. Desprender (3.1).
4. Queda: no ar, `fallVelocity = −vy` do começo do tick.
5. Passos (`footsteps.js`), com a velocidade do começo do tick.
6. Agachar (`duck.js`): recuperação da velocidade do agachar, transição, troca de cápsula e corte da velocidade.
7. Meia gravidade.
8. Pulo: teto do bhop, impulso, stamina.
9. No chão: `vy = 0`, `fallVelocity = 0` e atrito.
10. Chão: aceleração do CS:GO, teto duro, degrau e grudar no chão. Ar: air-accelerate e deslize (3.1).
11. `categorizePosition`, limites por eixo, meia gravidade.
12. Pouso: no chão com `fallVelocity > 0` → evento `land`, stamina e atraso do passo se for pesado.

No noclip continua só o voo da 3.1; a stamina e o tempo desde o último agachar seguem contando.

### Item na mão, troca e luneta (`src/player/hands.js`)
O item na mão fica num estado próprio (`hands`), ao lado do `Loadout`: o inventário continua sendo só as regras de
compra, `give` e Gun Game, e o `hands` é o que roda no tick (a predição da Fase 9 copia os dois). Campos: slot ativo
(`primary`, `secondary`, `melee`, `grenade`, `c4`), tipo de granada na mão, slot e granada anteriores (para o Q), id do
item resolvido no tick, nível de zoom e tempo até a luneta aceitar outro clique.

**Ordem dos itens** (a do CS): primária → pistola → faca → granadas (tipos na ordem em que entraram no `Loadout`) →
bomba.

**`cmd.select`**: 0 nada; 1–5 slots; 6 próximo (roda para baixo); 7 anterior (roda para cima); 8 último (Q). O
`moveCmd` lê as ações `slot1`…`slot5`, `nextWeapon`, `prevWeapon` e `lastWeapon` do tick (vale a primeira dessa ordem
que foi apertada).
- 1, 2, 3 e 5: vai para o slot se houver item nele; já estando nele, nada.
- 4: sem granada na mão, pega o primeiro tipo; com granada, passa para o próximo tipo (e volta ao primeiro).
- Roda: próximo/anterior entre os itens que você tem, dando a volta. Q: volta ao item anterior, se ele ainda existir.

**Sincronização a cada tick**: se o item ativo sumiu (o `give` trocou a arma do slot, a granada acabou), vai para o
melhor item: primária > pistola > faca > granadas > bomba.

**Troca automática no `give`** (o `cl_autowepswitch 1` do CS): arma recebida de posto melhor que o item na mão
(primária 0, pistola 1, faca 2, granada 3, bomba 4) vira um pedido de slot no próximo comando. Granadas e bomba nunca
trocam sozinhas. O `EV.LOADOUT` passa a dizer o que foi recebido.

**Velocidade do item** (u/s): arma, `moveSpeed` (com zoom, `scopedSpeed`); faca e bomba 250; granadas 245. Teto de 260
(`CS_PLAYER_SPEED_RUN`) e de `sv_maxspeed`. A Negev fica em 195 (seção 0.6 do PROMPT; o CS:GO final usa 150).

**Luneta** (AWP, SSG 08, SCAR-20, G3SG1, AUG, SG 553), números do CS:GO final:
- FOV de cada nível, na referência de 90° do CS: AWP 40 e 10; SSG 08, SCAR-20 e G3SG1 40 e 15; AUG e SG 553 45 (um
  nível só). O zoom multiplica a tangente do FOV do jogador por `tan(fov/2) / tan(45°)` — a mesma ampliação relativa do
  CS, sobre o FOV que o jogador escolheu.
- `ATTACK2` segurado com o tempo zerado sobe um nível (depois do último volta ao 0) e espera 0,3 s: segurar cicla.
- Transição do FOV (só visual): 0,05 s nas snipers; na AUG e na SG, 0,1 s para entrar e 0,06 s para sair.
- Sensibilidade com zoom: `controls.zoomSensitivity × fov/90` (o `zoom_sensitivity_ratio_mouse` do CS:GO), aplicada ao
  mouse, ao controle e ao toque pelo `InputManager.lookScale`; volta a 1 ao sair da partida.
- No noclip o `ATTACK2` continua sendo o turbo do voo e não mexe no zoom.
- Ficam para a Fase 4: anel de massinha, retícula, distorção, esconder a mira, desfazer o zoom no tiro da AWP/Scout e
  na recarga, e o tempo de sacar (na 3.2 a troca é instantânea, como a velocidade no CS).

**Modo da arma** (o "alt" do CS), para velocidade e precisão: com zoom nas armas com luneta; USP-S e M4A1-S com o
silenciador colocado (o padrão do CS; tirar é da Fase 4); Glock e FAMAS em rajada (a rajada liga na Fase 4, até lá modo
normal). `weaponAlt()` recebe zoom, silenciador e rajada como entrada explícita.

**Sniper lenta com luneta** (dois níveis de zoom e velocidade de luneta × 0,52 < 110: AWP, SCAR-20 e G3SG1 com zoom): a
aceleração mantém a razão da arma em vez de ×0,52/×0,34 (regra do CS:GO).

**Bomba**: `give bomba` (apelidos `c4`, `bomb`) marca a bomba no `Loadout`; dados em `src/data/weapons.js` (`BOMB`).

**HUD de teste**: etiqueta de fita crepe "na mão: AK-47 · 215 u/s · luneta 1/2", atualizada pelos eventos
`EV.PLAYER_WEAPON` e `EV.PLAYER_ZOOM`.

### Teto de velocidade e aceleração
- **Teto do tick** = mín(260, `sv_maxspeed`, velocidade do item no modo atual) × andar × stamina × agachar.
- **Andar** (Shift, ou alternar no controle/toque): ignorado em qualquer estado de agachar; engata (×0,52 e marca
  "andando") só com a velocidade 3D abaixo de teto × 0,52 + 25; soltar desliga. Com a faca a 250 u/s, apertar Shift
  freia só pelo atrito até ficar abaixo de 155 e aí o teto duro trava em 130 (7 ticks).
- **Aceleração no chão do CS:GO** (`sv_accelerate_use_weapon_speed 1`):
  - escala = meta = máx(250, desejo);
  - com o item na mão, meta × mín(1, velocidade do item / 250); a escala também, mas só correndo (nem andando nem
    agachado) ou na sniper lenta com zoom;
  - agachado: escala × 0,34 (exceto sniper lenta) e meta × 0,34;
  - andando: escala × 0,52 (exceto sniper lenta) e meta × 0,52, e a aceleração some linearmente nos últimos 5 u/s
    antes da meta (fator `clamp((meta − velocidade)/5, 0, 1)`): nunca passa da velocidade de caminhada;
  - ganho do tick = mín(`sv_accelerate` × dt × escala × atrito da superfície, desejo − velocidade na direção).
- **Teto duro**: depois de acelerar, a velocidade no chão é cortada ao teto do tick — andar, agachar e pousar freiam
  na hora.
- **Entrada analógica**: fração do teto do tick, como na 3.1 (o CS:GO usa 450 u/s por eixo; com teclado dá o mesmo).
- **No ar**: air-accelerate da 3.1 (desejo limitado a `sv_air_max_wishspeed`, 30 u/s), com o desejo vindo do teto do
  tick (agachado no ar ×0,34, stamina).

### Agachar (`src/player/duck.js`)
Estado novo: em transição (`ducking`), o `FL_DUCKING` do CS (`duckFlag`: vale como agachado para precisão, passos e o
andar), velocidade do agachar (começa em 8), âncora da recuperação e tempo desde o último agachar completo.
- **Portão** (no `checkParameters`): cada mudança da tecla crua — apertar e soltar — tira 2 da velocidade do agachar
  (mínimo 0). Abaixo de 1,5 a tecla é ignorada. Sem `duckFlag`, agachar de novo antes de `sv_timebetweenducks` (0,4 s)
  do último agachar completo também é ignorado.
- **Recuperação**: +3/s sempre; mais +6/s estando todo em pé ou todo agachado a mais de 64 u (no plano) de onde a
  velocidade do agachar estava cheia.
- **Descer**: o quanto agachou sobe 0,8 × velocidade do agachar por segundo; ao completar, a cápsula troca. No ar é na
  hora (pés +9).
- **Levantar** (se couber): a cápsula em pé entra na hora e o quanto agachou desce máx(1,5; velocidade) por segundo. No
  ar é na hora (pés −9), mas só se a cápsula couber 9 u abaixo sem a base atravessar chão; senão continua agachado até
  pousar (como o CS:GO — a alternativa da 3.1 de crescer pela cabeça sai). Levantar no ar pode pousar ali mesmo
  (`categorizePosition`): é o duckbug do CS:GO, sem evento de pouso e sem stamina; pular no mesmo tick é o jumpbug.
- **`duckFlag`** liga ao completar o agachar e desliga ao levantar passando de 25% (quanto agachou ≤ 0,75).
- **Tempos a 64 tick**: o próprio aperto já custa 2 (8 → 6), então descer leva 13 ticks (0,203 s) e levantar, depois
  de ficar agachado até a velocidade encher de novo, 11 ticks (0,172 s). Spam deixa mais lento e, abaixo de 1,5,
  trava. (Na apresentação do desenho saíram 0,156 s e 0,125 s: são as taxas com a velocidade cheia, que nenhum aperto
  chega a usar.)
- **Corte do agachar** (vale também no ar): com qualquer estado de agachar, teto e desejo × lerp(1; 0,34) pelo quanto
  agachou.
- **Olho**: `lerp(64, 46, smoothstep(quanto agachou))`. A troca de cápsula no ar muda pés e olho de uma vez; a diferença
  entra na suavização da câmera da 3.1 (a câmera anda os 9 u em ~0,06 s).

### Pulo, stamina e bunny hop
- **Pulo** (mantido da 3.1): impulso definido `sv_jump_impulse × jumpFactor × (1 − stamina/100)` mais a meia gravidade
  do tick (parábola exata). Precisa soltar o botão entre pulos (`sv_autobunnyhopping 0`).
- **Teto do bhop** (`sv_enablebunnyhopping 0`): antes de sair do chão, velocidade 3D acima de 1,1 × 260 = 286 u/s é
  cortada para 286 — o mesmo para qualquer item.
- **Stamina** (`sv_staminamax` 80, `sv_staminajumpcost` 0,08, `sv_staminalandcost` 0,05, `sv_staminarecoveryrate`
  60): o pulo soma 0,08 × impulso (24,16 partindo parado), o pouso soma 0,05 × velocidade de queda, recupera 60/s.
  Efeitos, com o divisor fixo 100 do CS: teto × (1 − s/100)² (valor de antes da recuperação do tick) e pulo ×
  (1 − s/100) (depois).
- **Pulo plano partindo parado**: pouso a ~285,5 u/s (a base encosta no chão até 2 u antes) → stamina 14,3 → primeiro
  tick no chão com teto × 0,735 (183,7 u/s com a faca); a stamina zera em 16 ticks.
- **Bhop**: pular no tick seguinte ao pouso ("perf") não passa pelo atrito nem pelo teto duro e mantém o embalo (até
  286); perder esse tick entrega a velocidade ao atrito e ao teto com stamina; pulos seguidos saem mais baixos.
- Evento `jump` com a velocidade e `audible` (velocidade 3D > 126 u/s).

### Pouso
- Conta só com `fallVelocity > 0` e se o jogador estava no ar no passo do atrito: pousar de dentro do agachar não conta
  (duckbug).
- Evento `land` {velocidade de queda, superfície, `audible` (> 270), `heavy` (≥ 350)}; stamina; pouso pesado atrasa o
  próximo passo para 400 ms. Dano de queda é da 3.4.

### Passos (`src/player/footsteps.js`)
O relógio do CS:GO, com a velocidade do começo do tick:
- quase parado (|v|² < 10): o relógio volta a 291 ms — o primeiro passo sai ~0,29 s depois de começar a andar;
- o relógio desconta o tick; quando zera, com o jogador no chão, andando no plano e acima da velocidade mínima (90 u/s,
  ou 60 com `duckFlag`), dá um passo e o relógio recomeça em 300 ms × 0,97 (400 ms × 0,97 abaixo de 220 u/s, ou de 80
  com `duckFlag`), +100 ms com `duckFlag`. Na prática 19 ticks (297 ms) ou 25 (391 ms);
- volume pela superfície em duas classes (lenta/rápida, a mesma divisão da cadência), × 0,65 com `duckFlag`;
- audível só com velocidade ≥ 135,2 (260 × 0,52) e sem estar andando: andar, agachar e AWP/SCAR/G3 com zoom ficam em
  silêncio; AUG/SG com zoom (150) fazem barulho;
- passos silenciosos também saem, com `audible: false` (as pegadas da 3.5 precisam deles). Diferença do CS: lá o relógio
  para enquanto o passo é silencioso; aqui continua;
- pé esquerdo/direito alternado; distância de envio de 1250 u nos dados, para a audição dos bots (Fase 7);
- `EV.PLAYER_STEP` {pé, x, y, z, superfície, volume, audível, velocidade}.

Volumes (lenta/rápida) em `src/data/surfaces.js`: padrão, tapete, madeira e fita 0,2/0,5 (o concreto do CS); papelão e
plástico 0,25/0,55; metal e arame 0,4/0,7; massinha 0,15/0,4; tecido 0,1/0,3 (escolha nossa para as superfícies moles,
que o CS não tem).

### Inaccuracy (`src/player/inaccuracy.js` + `src/data/inaccuracy.js`)
Funções puras do `CWeaponCSBase` do CS:GO, nas unidades do CS (× 0,001 ≈ radianos). Dados por arma do `items_game`
final: em pé, agachado, movimento, ar inicial, ápice (só a Deagle), pulo, pouso, disparo, recuperação em pé e agachado
(inicial e final), balas de transição e os valores "alt". Faca, granadas e bomba não têm inaccuracy. Spread e recoil
entram na Fase 4, no mesmo arquivo de dados.
- **Base do tick**: no ar, em pé + pulo; com `duckFlag`, agachado; senão, em pé (tudo no modo atual da arma).
- **Penalidade guardada**: sobe na hora até a base; acima dela cai 10× a cada tempo de recuperação T
  (`base + (p − base)·e^(−dt·ln 10/T)`). No ar, T = recuperação agachado × 4; no chão, T vai do valor inicial ao final
  entre as balas de transição, pelo índice de recuo.
- **Pouso**: + pouso × 0,001 × velocidade de queda (crua: ~285 u/s num pulo plano).
- **Disparo** (para a Fase 4 chamar): + disparo; índice de recuo +1. O índice decai 10× a cada 0,5 s depois de
  1,1 × o intervalo entre tiros sem atirar.
- **Total do tiro** = penalidade + movimento + ar, no máximo 1:
  - movimento: velocidade no plano entre 34% e 95% da velocidade da arma no modo atual → 0…1, elevada a 0,25 (andando,
    linear), × movimento;
  - ar: raiz de |vy| entre 0,25·√`sv_jump_impulse` e √`sv_jump_impulse` → ápice…ar inicial, limitado a [ápice,
    2 × ar inicial]. O termo de ápice (2020) só existe na Deagle e foi inferido dos números da Valve; nas outras armas
    ápice = 0 e é a fórmula verificada no código.
- **Sacar** zera a penalidade e o índice de recuo (código do CS:GO).
- **Limiar de precisão** = 34% da velocidade da arma no modo atual (onde o termo de movimento zera).
- Escada fica de fora (nenhum mapa da especificação tem).

### Andar silencioso nos três dispositivos
- `controls.walkMode` (teclado, padrão segurar), `controls.pad.walkMode` e `controls.touch.walkMode` (padrão
  alternar), nas abas Teclas, Controle e Toque das configurações.
- `src/input/actionToggles.js`: trinco puro por dispositivo (segurar = a tecla; alternar = cada aperto troca). O
  `InputManager` avalia a ação `walk` por dispositivo e junta os três. O alternado sobrevive à pausa, é zerado ao
  entrar e ao sair da partida, e trocar de dispositivo desliga o alternado dos outros.
- Toque: botão "Andar" no layout padrão (versão 2). Layouts salvos na versão 1 ganham o botão que falta; os outros
  botões do jogador ficam como estão.
- HUD de teste: "ANDANDO" enquanto o andar estiver ligado. As dicas passam a citar Shift, L3 e o botão de toque, 1–5,
  roda e Q, e a luneta.

### Counter-strafe medido e `cl_showpos`
- **Telemetria** (`src/player/telemetry.js`): anel de 256 ticks (4 s) em arrays fixos, sem alocar — velocidade no
  plano, teto do tick, velocidade da arma no modo atual, limiar, inaccuracy, chão, desejo e velocidade no plano,
  andar e `duckFlag`.
- **Medidor** (`src/debug/strafeMeter.js`, puro, atualizado pelo `matchState` a cada tick): começa com o jogador no chão
  acima do limiar quando ele (a) solta o movimento ("soltar") ou (b) o desejo passa a apontar contra a velocidade
  (cosseno < −0,5, "contra"). Termina no primeiro tick com a velocidade abaixo do limiar; cancela se o desejo voltar
  para o lado do movimento ou se o jogador sair do chão. Guarda a última, a melhor e a média das 10 últimas de cada
  tipo.
- **`cl_showpos`** ganha linhas (item e zoom, teto do tick com os fatores, stamina, agachar e velocidade do agachar,
  inaccuracy com as partes base/movimento/ar, último passo, placar do counter-strafe) e o gráfico
  (`src/debug/speedGraph.js`): velocidade dos últimos 4 s, teto, limiar tracejado, faixa preciso × impreciso,
  inaccuracy por cima e a marca de cada medida com o tempo em ms.
- `cl_strafe_reset` zera as medidas.

### Console, dados e eventos
- `sv_*` novas, com os valores do CS:GO e faixa no console (as de 0/1 arredondam): `sv_staminamax` 80,
  `sv_staminajumpcost` 0,08, `sv_staminalandcost` 0,05, `sv_staminarecoveryrate` 60, `sv_enablebunnyhopping` 0,
  `sv_autobunnyhopping` 0, `sv_timebetweenducks` 0,4, `sv_accelerate_use_weapon_speed` 1.
- `src/data/movement.js`: `MOVE` (260; andar 0,52, +25 e janela de 5 u/s; referência 250; sniper lenta 110; bhop 1,1;
  divisor da stamina 100; som do pulo 126), `DUCK` (velocidade 8, descida 0,8, 0,34, spam 2 e mínimo 1,5, recuperação
  3 e 6 a 64 u, levantar no mínimo 1,5, `duckFlag` até 0,75), `STEPS` (cadências, velocidades, volumes, pouso audível e
  pesado, distância de envio).
- `src/data/weapons.js`: `scope` passa a guardar os FOVs de zoom; `zoomTime` por nível; `SCOPE` (referência 90°, 0,3 s
  entre cliques); `BOMB`. `src/data/economy.js`: granadas com `moveSpeed` 245. `src/data/inaccuracy.js`: novo.
- Eventos novos: `EV.PLAYER_WEAPON` {item, anterior, slot}, `EV.PLAYER_ZOOM` {nível, fov}, `EV.PLAYER_STEP`;
  `EV.PLAYER_JUMP` e `EV.PLAYER_LAND` ganham velocidade, `audible` e `heavy`.
- `give bomba`; o `loadout` do console mostra o item na mão.
- Fora da 3.2, cada coisa na sua fase: escada; pisar em outro jogador (Fases 5 e 9); plantar e desarmar forçando o
  agachar (Fase 8); freio por levar tiro (Fase 4); dano de queda (3.4).

### Arquivos
- Novos: `src/player/hands.js`, `src/player/inaccuracy.js`, `src/data/inaccuracy.js`, `src/player/footsteps.js`,
  `src/player/duck.js` (o agachar do CS:GO sai do `movement.js`), `src/player/telemetry.js`,
  `src/input/actionToggles.js`, `src/debug/strafeMeter.js`, `src/debug/speedGraph.js`; testes `hands`,
  `tacticalMovement`, `footsteps`, `inaccuracy` e `strafeMeter`.
- Alterados: dados (`movement`, `weapons`, `economy`, `surfaces`, `touchLayout`, `configSchema`, `actions` — os modos
  do trinco ficam nele), `loadout`, `movementVars`, `moveCmd`, `movement`, `playerPawn`, `inputManager`,
  `settingControls`, `settingsScreen`, `sandboxHud`, `showPos`, `movementCommands`, `commands`, `events`,
  `matchState`, `styles/hud.css`, `styles/debug.css`; testes da 3.1 cujo
  número muda com o porte (`characterController`, `movementData`, `playerPawn`, `data`, `input`, `movementFuzz`,
  `playerTestUtils`).

### Valores de referência (64 tick)
Os de movimento vêm da simulação do algoritmo feita na pesquisa e das contas acima; o plano fixa o número exato que a
implementação der (diferença máxima de 1 tick; maior que isso é investigado, não ajustado).
- Faca 0 → 250 em 35 ticks (0,55 s); AK 0 → 215 em ~0,56 s; faca andando 0 → 130 em ~0,63 s sem passar de 130; AK
  andando 0 → 111,8 em ~0,41 s; faca agachada 0 → 85 em ~1,56 s; AWP com zoom 0 → 100 em ~0,83 s e andando 0 → 52 em
  ~0,34 s.
- Faca a 250 + Shift: 130 em 7 ticks. Faca a 250 soltando tudo: 0 em 26 ticks.
- Counter-strafe da AK (limiar 73,1 u/s): contra 5 ticks (78 ms) × soltar 13 ticks (203 ms).
- Agachar: descer 13 ticks; levantar 11 ticks. Pulo em pé 57 u; pulo + Ctrl 66 u.
- Stamina de um pulo plano: 24,16 na saída, zera em 26 ticks; pouso a ~285,5 u/s → 14,28; primeiro tick no chão ×0,735.
- Passos: faca correndo a cada 19 ticks; AK a cada 25; agachado +100 ms.
- Inaccuracy (vetores da pesquisa): AK parado 0,006410; agachado 0,004810; correndo a 215 u/s 0,181470; a 111,8 u/s
  andando 0,058067 e sem andar 0,135435; no ápice 0,147170; saindo do chão (vy = 301,99) 0,248110; logo após um pouso
  plano 0,220252 e depois de 1/8/16/24/32/64 ticks 0,200335 / 0,104228 / 0,051155 / 0,026878 / 0,015773 / 0,006820;
  AWP com zoom parado 0,002000 e sem zoom 0,080800; AWP com zoom a 100 u/s 0,178480. (O pouso usa a velocidade de queda
  de 301,99 da pesquisa; o teste usa esse valor direto na função.)

### Testes (Node, sem navegador)
- **Dados**: inaccuracy de todas as armas (com os modos alt) contra o `items_game`; velocidades de armas, granadas, faca
  e bomba; FOVs e tempos de zoom; volumes de passo; `sv_*` novas com faixa.
- **Item na mão** (`hands`): ordem dos itens; slots 1–5 (vazio não troca; 4 cicla as granadas); roda dá a volta; Q;
  sincronização quando o item some; troca automática no `give`; zoom (níveis por arma, 0,3 s, segurar cicla, trocar de
  item tira, noclip não mexe); multiplicador do FOV; sensibilidade; modo alt; sniper lenta.
- **Movimento** (`tacticalMovement`): curvas de aceleração e parada; Shift correndo; teto duro (agachar e pouso freiam
  no tick); counter-strafe; agachar (tempos, −2 por mudança, trava abaixo de 1,5, recuperação 3/s e +6/s longe da
  âncora, `sv_timebetweenducks`, no ar na hora com ±9, `duckFlag` até 0,75, levantar no ar sem espaço continua
  agachado, duckbug sem pouso, jumpbug); stamina (custos, efeitos, recuperação, pulos seguidos mais baixos); bhop (teto
  de 286, "perf" mantém a velocidade, perder o tick perde); pulo em pé de 57 u e pulo + Ctrl de 66 u mantidos;
  `sv_enablebunnyhopping`, `sv_autobunnyhopping` e `sv_accelerate_use_weapon_speed`.
- **Passos**: cadências, primeiro passo, velocidade mínima, audível × silencioso (faca correndo, AK, andando, agachado,
  AWP com zoom, AUG com zoom), volumes por superfície e agachado, pé alternado, pulo e pouso audíveis, atraso do pouso
  pesado.
- **Inaccuracy**: os vetores de teste, recuperação pelo índice de recuo, disparo, sacar zera, limiar, Deagle.
- **Medidor**: sequências sintéticas (soltar, contra, cancelar, sair do chão, média e melhor) e o counter-strafe real
  simulado com o `PlayerPawn` (AK 5 × 13 ticks).
- **Entrada**: trinco segurar/alternar, troca de dispositivo, zerar; migração do layout de toque v1 → v2.
- **Regressão**: os 10 min simulados sem atravessar parede passam a ter andar, spam de agachar, pulos (stamina) e troca
  de item na entrada aleatória; determinismo bit a bit com todo o estado novo.

### Aceite da 3.2 (2026-09-25)
- [x] Velocidade de cada arma e item, andar, agachar e luneta nos números certos (`cl_showpos` e testes).
- [x] Troca por 1–5, roda e Q; luneta funcional nas 6 armas com mira (FOV, sensibilidade, velocidade, precisão).
- [x] Counter-strafe medido no `cl_showpos`: "contra" bem mais rápido que "soltar" (AK: 78 × 203 ms).
- [x] Bunny hop possível mas penalizado (teto de 286, stamina); spam de agachar visível.
- [x] Eventos de passo, pulo e pouso corretos (audível × silencioso, volume, superfície).
- [x] Andar alternado no controle e no toque; segurar no teclado; configurável por dispositivo (no navegador, o
  teclado em Alternar e o botão no layout de toque; controle e toque pelos testes do trinco e da config — sem
  controle físico nem celular nesta máquina).
- [x] Testes passando (166, incluindo os 10 min simulados); sem erros do jogo no console; sem vazamento em 3 ciclos
  menu ↔ sala; arquivos < 600 linhas; números em `src/data/`.

## 3.3 — Pista de testes

Desenho aprovado em 2026-09-25, seção por seção (escala e disposição; estações 1–6; estações 7–12; materiais, luz e
desempenho; código, ferramentas e testes). Pesquisa antes do visual: 17 boards do Pinterest (COC a LDB, 330 pins) e o
"Mapper's Reference" do CS:GO na Valve Developer Community — observação, pins e decisão de cada peça no item 11 do
`docs/art/moodboard.md`.

Decisões do usuário nesta subfase:
- **Parque de estações** (e não circuito único nem mesas separadas): cada módulo isolado num lote, dá para repetir e
  medir sem esbarrar nos outros; teleporte por estação.
- **Caixas nos limites exatos** (57/58/64/66/67/72 u) e **gabarito de portais** (73/72/55/54 u): a pista prova os
  números, não só ilustra.
- Números das estações que dependem da 3.4 (wall-jump e slide) ficam provisórios em `src/data/pista.js`; a 3.4 ajusta
  só os dados.
- A pista entra na mesma árvore (branch `fase-3.1`), sem commit até o usuário pedir.

### Escala, base e convenções
- **1 u = 1 mm real** (o boneco de 72 u tem 7,2 cm): cada objeto do dia a dia entra com a medida verdadeira — livro
  deitado 150 × 230 × 8–24 u, régua escolar 300 × 30 × 3, lápis Ø7 × 175, tubo de papel-toalha Ø45, trena de 5 m,
  placa de massinha de 5 u.
- **Base**: compensado de 18 u no chão do estúdio, tampo em y = 0, X ∈ [−2800, 2800], Z ∈ [−2000, 2000] (5,6 × 4 m
  reais), chapas de 2440 × 1220 com emendas, parafusos e riscos de lápis. Em volta, o chão escuro do estúdio 18 u abaixo.
- **Cerca**: caixas de papelão de parede dupla (6 u) abertas e em pé, 200 u de altura (acima dos 66 u do pulo
  agachado), face interna em x = ±2760 e z = ±1960, emendas de fita crepe e estampas de caixa ("este lado para cima",
  "frágil"); colisão de 8,4 u (papelão + empeno, como a sala de testes).
- **Convenções**: origem no centro do tampo; norte = −Z, leste = +X; rumo (graus, horário a partir do norte) nas
  descrições; o yaw do jogador é o do resto do jogo (0 = norte, +90° = oeste, isto é, yaw = −rumo).
- **Lotes** demarcados no compensado com fita crepe; o chão de cada lote é o do material da estação (tapete de corte
  em 2, 3, 4, 9 e 10; papel kraft em 8 e 12; papel quadriculado em 1; compensado nu em 5, 6, 7 e 11). Cada lote tem uma
  plaquinha de papelão dobrada em "A" com número e nome.
- **Spawn**: (0, 0, 1200), olhando para o norte (pitch −2°), no fundo da praça ao sul da quadra. Na praça: prancheta num
  cavalete de papelão com a **planta da pista desenhada a lápis** a partir dos dados do layout (lotes, números, rota
  tracejada, "você está aqui", rosa dos ventos) e a luminária de mesa acesa sobre ela, inteira na primeira vista.

Lotes (X × Z, u):

| Nº | Estação | Lote |
|---|---|---|
| 1 | Counter-strafe | [−850, 850] × [−600, 600] |
| 2 | Escadas de livros | [1450, 2500] × [−1500, −550] |
| 3 | Rampas | [1450, 2600] × [−450, 400] |
| 4 | Caixas | [1500, 2300] × [550, 1100] |
| 5 | Wall-jump (poço e zigue-zague) | [−2750, −1400] × [−200, 950] |
| 6 | Vãos de slide e gabarito | [−2750, −950] × [1100, 1900] |
| 7 | Torre de queda | [−2750, −1420] × [−1520, −230] |
| 8 | Faixa de bhop | [−2560, 2400] × [−1900, −1540] |
| 9 | Vigas de balsa | [−1400, −300] × [−1460, −700] |
| 10 | Paredes finas | [250, 1250] × [−1450, −650] |
| 11 | Túnel baixo | [1300, 2400] × [1350, 1560] |
| 12 | Pegadas | [−800, 800] × [1450, 1700] |
| — | Praça do spawn | [−600, 600] × [700, 1300] |

### Estações 1–6
**1 · Counter-strafe.** Folha de papel quadriculado de plotter em x ∈ [−800, 800], z ∈ [−450, 550], presa com fita crepe
nos cantos e no meio das bordas, levemente ondulada (papel). Linha forte a cada 100 u (1 m), fina a cada 20 u, metros
numerados nas bordas sul (0–16) e oeste (0–10); faixa de fita colorida de 20 u ao longo de x em z = 50 (linha de
strafe). Ao norte, dois pilares de peek — pilhas de dois blocos de faia de 96 × 100 × 96 — centrados em (±450, −540).
Com as linhas de 20 u se vê a diferença entre parar no contra (~10–15 u) e soltando (~60 u); os alvos da Fase 4 entram
atrás dos pilares.

**2 · Escadas de livros.** Seis pilhas de seis livros da mesma espessura t (a altura do degrau), em duas fileiras:
- fileira sul (degraus de 8, 12 e 16 u): frentes em z = −600, costas em z = −950;
- fileira norte (18, 20 e 24 u): frentes em z = −1100, costas em z = −1450 (corredor de 150 u entre as fileiras);
- pilhas centradas em x = 1580, 1920 e 2260 (8/18, 12/20, 16/24).

Livro k (0 = embaixo): fundo 350 − 40k, largura 260 − 20k, costas alinhadas nas costas da pilha, de y = k·t a
(k+1)·t — a frente de cada livro recua 40 u e forma o degrau; topos em 48/72/96/108/120/144 u. Lombadas viradas para o
sul com título e altura; plaquinhas "18 u · o limite", "20 u · só pulando", "24 u · só pulando". Superfície `papelao`.

**3 · Rampas.** Caixa de arquivo de papelão (a plataforma) em x ∈ [1500, 2540], z ∈ [−400, −100], 120 u de altura.
Cinco cunhas de papelão fechadas dos lados, 160 u de largura, centradas em x = 1580 (15°), 1800 (30°), 2020 (44°),
2240 (46°) e 2460 (60°), subindo de z = −100 + L até a frente da caixa, com L = 120/tan θ (447,85 / 207,85 / 124,26 /
115,88 / 69,28 u). Transferidor de papel colado na lateral leste de cada uma, com o ângulo riscado a lápis; etiqueta com o
ângulo. 44° sobe andando, 46° e 60° escorregam (limite de 45,573°). Superfície `papelao`.

**4 · Caixas.** Blocos de faia de 128 × 128 u de base com cantos arredondados (raio 3) e a altura em estêncil na face
sul: fileira sul z ∈ [900, 1028] com 57, 58 e 64; fileira norte z ∈ [600, 728] com 66, 67 e 72; colunas x ∈ [1550, 1678],
[1758, 1886] e [1966, 2094]. 57 e 58: limite do pulo em pé (ápice 57,03 u); 64, 66 e 67: pulo agachado (66 u); 72: a
altura do boneco. Superfície `madeira`.

**5 · Wall-jump** (números provisórios da 3.4).
- **Poço**: chaminé de quatro paredes de compensado de 8 u, 256 u de altura, por dentro x ∈ [−2538, −2362],
  z ∈ [62, 238]; paredes distintas com faixa de cor e número (norte 1 vermelho, leste 2 amarelo, sul 3 verde, oeste 4
  azul) — a mesma parede só volta a valer depois de tocar o chão. Porta embaixo na parede sul: x ∈ [−2498, −2402],
  0–88 u. Saída: prancha de compensado (64 × 6 u) do topo da parede leste até uma torre de blocos de faia em
  x ∈ [−2300, −2120], z ∈ [60, 240], 256 u de altura.
- **Zigue-zague**: plataformas de blocos de faia de 128 u — A em z ∈ [700, 900] e B em z ∈ [−140, 60], ambas
  x ∈ [−1850, −1650] — com vão de 640 u entre elas; painéis de papelão de parede dupla (8 × 160 × 320 u) alternando os
  lados do corredor de 200 u: oeste (face em x = −1850) em z ∈ [540, 700] e [220, 380]; leste (face em x = −1650) em
  z ∈ [380, 540] e [60, 220]. Quem erra cai 128 u no compensado; rampa de papelão de 30° (L = 221,7 u, 160 de largura)
  sobe pelo leste até a plataforma A.

**6 · Vãos de slide e gabarito** (faixa provisória da 3.4).
- **Faixa**: x ∈ [−2600, −1000], z ∈ [1195, 1345] (150 u, fita nas bordas), 500 u de corrida antes da primeira trave.
  Traves atravessadas, com a face de baixo exata: x = −2100 régua de madeira (300 × 30 × 3) a 70 u; x = −1850 lápis
  (Ø7 × 175) a 64 u; x = −1600 régua de aço (300 × 25 × 1) a 58 u; x = −1350 espeto de bambu (Ø4 × 300) a 55 u. Cada
  trave em dois apoios de 40 × 40 u fora da faixa (pilhas de blocos e livros finos da altura exata) com uma bolota de
  massinha segurando a ponta. Em pé não passa em nenhuma; agachado (54 u) passa em todas.
- **Gabarito**: quatro portais para atravessar no sentido norte–sul, centrados em z = 1650 e x = −2520, −2360, −2200 e
  −2040, vão de 64 u, colunas de 30 × 40 u, verga de régua de 15 cm: 73 u (em pé passa), 72 u (em pé não passa), 55 u
  (agachado passa), 54 u (agachado não passa) — os números do CS ("teto que não bate") com a cápsula 72/54.

### Estações 7–12
**7 · Torre de queda.** Eixo em (−2100, −900).
- **Tubo** de papelão grosso, raio 90 u (parede de 6), 1310 u de altura, tampa em cima (o topo da torre).
- **Espiral de 78 livros** de 200 × 130 u encaixados no tubo (de r = 70 a r = 270), um por degrau, cada um 18° à frente
  do de baixo no sentido horário, o primeiro no rumo 270° (oeste). Cinco trechos com espessura própria para cada marca
  cair exata e todo degrau ficar abaixo de 18 u: 12 livros de 16 u (topo 192), 13 de 16,923 (412), 11 de 16,364 (592),
  18 de 16,667 (892) e 24 de 17,083 (1302). O degrau livre de cada livro é a faixa de 18° que o de cima não cobre
  (≥ 47 u de largura a partir de r = 150); o livro da volta de cima fica ≥ 300 u acima de cada degrau.
- **Pranchas** de compensado (96 × 8 u, de r = 250 a 520) apoiadas no livro de cada marca, com o topo exatamente em
  200, 420, 600, 900 e 1310 u, giradas 10° para trás do livro (não encostam no degrau seguinte). Rumos: 200 → 98°,
  420 → 332°, 600 → 170°, 900 → 134°, 1310 → 206° — nenhuma aponta para o oeste (cerca) nem se cruza.
- **Alvos** pintados no compensado (raio 90, três anéis e o número da altura) a r = 580 no rumo de cada prancha.
- **Tábua de crescimento** (1400 × 60 × 12 u) em pé a r = 330 no rumo 116° (entre as pranchas de 200 e 900), voltada para
  fora: numerais brancos a cada 100 u, traços a cada 10 u, anotações à mão com risco horizontal nas cinco alturas
  ("420 · o limite seguro", "1310 · fatal" — números da 3.4).
- Superfícies: tubo e livros `papelao`, pranchas e tábua `madeira`.

**8 · Faixa de bhop.** Papel kraft em x ∈ [−2500, 2300], z ∈ [−1880, −1560] (4800 × 320 u), fita crepe nas bordas; 400 u de
corrida até a linha de largada (x = −2100). Trena de aço amarela (lâmina de 25 u) esticada ao longo da borda sul, com o
zero na largada e 4400 u até a chegada (número a cada 10 u, vermelho a cada 100 u); o estojo (70 × 70 × 40 u, plástico)
fica na chegada, no canto sul. Etiquetas a cada 500 u na borda norte ("5 m · 500 u" … "40 m · 4000 u"); bandeirinha
xadrez de papel num palito espetado numa bolota de massinha na chegada (x = 2300). Superfície `papelao`.

**9 · Vigas de balsa.** Plataformas de blocos de faia de 96 u em x ∈ [−1350, −1150] e [−510, −310], z ∈ [−1440, −980]
(vão de 640 u). Quatro ripas de balsa de 6 u de espessura apoiadas 20 u em cada plataforma (x ∈ [−1170, −490], topo
em 102), com 32, 16, 8 e 4 u de largura, centradas em z = −1400, −1300, −1200 e −1100; alfinetes de cabeça colorida nas
pontas. Ripa inclinada a 20° (16 × 6 u) em x = −1250 subindo do chão (z = −716,2) até a borda sul da primeira
plataforma. Superfície `madeira`.

**10 · Paredes finas.** Papelão de uma face (2 u), 180 u de altura:
- fileira de espessuras (z = −1400): painéis de 160 u em x = 380, 580, 780 e 980 com 0,5, 1, 2 e 4 u;
- muro em z = −1220 de x = 280 a 1220 com um vão de 33 u (centro x = 520, passa) e um de 31 u (x = 880, não passa);
- corredor em zigue-zague de 64 u (curvas de 60°, trechos de 120 u) em x ∈ [300, 620], z ∈ [−1100, −800];
- quina aguda de 20° aberta para o sul em x ≈ 760, z ∈ [−1050, −800];
- parede curva de raio 160 (arco de 90°, 12 trechos) centrada em (1050, −880).

Superfície `papelao`.

**11 · Túnel baixo.** Três caixas rasas de papelão (paredes e teto de 4 u, sem fundo) emendadas com fita ao longo de x,
por dentro z ∈ [1386, 1514] (128 u): x ∈ [1350, 1650] com 60 u de altura, [1650, 1950] com 96 u e [1950, 2250] com 60 u
(o degrau entre os tetos é fechado). Abas das bocas abertas para fora; três furos de Ø24 no teto das caixas baixas e
fendas de respiro nas laterais da alta; pisca-pisca de 12 lampadinhas quentes no teto (lado norte) e uma luz prática sem
sombra (2400 K, alcance 320 u) na caixa do meio. Agachado passa; em pé, só na caixa do meio. Superfície `papelao`.

**12 · Pegadas.** Tira de papel kraft em x ∈ [−760, 760], z ∈ [1480, 1680] com sete placas de massinha de 180 × 130 × 5 u,
centradas em x = −600 … 600 (a cada 200) e z = 1580, giradas ±4° (seed). Cores: terracota `#C8553D`, laranja `#F28F3B`,
amarelo `#F4C542`, verde `#5BA55B`, azul `#2F6DB5`, rosa `#E88AA8` e branco-massa `#F4EDE1`. Abertas no rolo (marcas do
rolo), borda cortada à mão, uma letra carimbada em cada (P-E-G-A-D-A-S) e borda de furinhos. Superfície `massinha`
(aceita pegadas na 3.5).

### Materiais, peças e luz
Materiais novos do set (shader próprio cada, todos pela luz suave de estúdio de `studioLight.js`):
- **Compensado** (`woodMaterials.js`): lâmina de bétula com veio largo e remendos ovais nas faces; lâminas alternadas
  nas bordas (a espessura segue o eixo Y local da peça); parafusos e riscos de lápis na base.
- **Faia** (`woodMaterials.js`): o shader da balsa com cor e escala da faia (blocos).
- **Livro** (`bookMaterial.js` + `bookGeometry.js`): um material para todos os livros; atributo por vértice diz a parte
  (capa, miolo, lombada, cantos); cor da capa pela cor da peça no lote (`BatchedMesh.setColorAt`); miolo com as linhas
  das folhas; título e altura na lombada lidos de um atlas de texto.
- **Régua e fita de medir** (`measureMaterials.js`): uma família com três aparências — régua escolar de madeira com
  traços, lâmina amarela da trena com números pretos e vermelhos, tábua de crescimento escura com numerais brancos —
  usando o atlas de dígitos do tapete de corte; e o **papel quadriculado** da quadra.
- **Impressão em papel e tinta** (`printMaterials.js`): papel com desenho de canvas (planta, transferidores, bandeirinha)
  e tinta com recorte por alpha test (alvos, estêncil dos blocos, estampas da cerca, notas da tábua) — sem transparência,
  para não bagunçar AO e DOF. Os desenhos da pista ficam num atlas por mapa.
- **Laca e borracha** (`paintMaterials.js`): corpo pintado do lápis e borracha rosa.
- **Papelão de uma face** (`paperMaterials.js`): opção nova do papelão com as ondas à mostra num lado.
- Reaproveitados: papelão, fita crepe e etiquetas, tapete de corte, balsa, arame (fio do pisca-pisca), metal de
  ferramenta (ponteira, alfinetes), plástico (estojo da trena) e difusor (lampadinhas).
- Geometrias novas em `bookGeometry.js` (livro com capa maior que o miolo, lombada arredondada, cantos) e
  `stationeryGeometry.js` (lápis sextavado apontado, régua com bisel, trena e estojo, espeto, alfinete, bandeirinha);
  placas de massinha com o kit (`claySlab`) e borda cortada à mão.
- **`ClayMaterial`**: canal de impressão opcional (define própria, desligado por padrão): uma textura de relevo (fundo da
  marca e lábio de massa empurrada) desloca a normal e escurece levemente o fundo; na 3.3 desenha as letras carimbadas
  e os furinhos pelas uv das placas; na 3.5 recebe as pegadas pelo mesmo caminho.

Montagem de luz `pista` (`src/data/studioRigs.js`):
- key de tungstênio (3300 K, 2,4 lux no centro) em softbox pendurada, alta e longe — em (−3200, 8400, 4400), apontada
  para o centro, cone de 28° — para a base toda receber luz com queda de ~2× do centro às bordas; é a única com sombra,
  com mapa ×2 (4096 no Alto; o tamanho passa a ter teto de 4096) e o frustum apertado no cone (`focus` 0,8);
- fill frio (7600 K, 0,5) do lado oposto, rim (5600 K, 1,2) alto vindo do norte — níveis abaixo dos da sala de testes:
  o compensado claro devolve ~4× a luz do tapete verde;
- luzes práticas: a luminária de mesa do spawn (2700 K, alcance 900 u) e a luz do túnel (2400 K, alcance 320 u, a meia
  altura da caixa alta), sem sombra;
- rebote hemisférico, ambiente assado numa sala de 26 × 22 × 26 m (a softbox da key cabe nela) e poeira só no ar baixo
  da base (até 240 u; o cone inteiro tem 10 m e, espalhada nele, a poeira parecia um céu estrelado contra o fundo);
- `staticShadows: true`: nada na pista se mexe e a sombra é feita uma vez.

Desempenho (metas no preset Alto, RTX 2070): peças estáticas de um mesmo material juntas num `BatchedMesh` (geometrias
diferentes num só draw, cor e corte de visão por peça; o encanamento de `objectSpace.js` já trata `USE_BATCHING`); as sete
placas de massinha como malhas próprias. ~120 draws no máximo, cena abaixo de ~400 mil triângulos, GPU em 1080p perto
dos ~3,3 ms da sala de testes; colisão com ~4 mil triângulos, custo por tick perto do da sala; sem vazamento em 3 ciclos
menu ↔ pista. A câmera de stop-motion no tripé e os equipamentos extras de borda ficam para a Fase 6.

### Código
- `src/data/pista.js`: todos os números acima (lotes, estações, trechos da torre, cores, textos das etiquetas, pontos de
  teleporte).
- `src/maps/pista/layout.js` (puro, sem WebGL): expande os dados numa lista de peças — tipo, forma (caixa, cunha,
  cilindro), matriz, tamanho, superfície, se colide e aparência (material, cor, texto) —, determinística (seed nas
  pequenas tortices de "feito à mão").
- `src/maps/pista/colliders.js` (puro): monta o `ColliderBuilder` a partir das peças.
- `src/maps/pista/visual/`: aparência por família em arquivos de até 600 linhas — chão e papéis, livros, madeira, papelão,
  arte (canvas), extras e placas de massinha —, mais o ajudante que agrupa as geometrias por material em `BatchedMesh`.
- `src/maps/pista/index.js`: registra o mapa `pista` (apelidos `treino`, `parque`, `obstaculos`) e monta cena, luz,
  colisão, estações e `dispose`.
- `MapInstance.stations`: `[{ number, id, label, aliases, spots: [{ id, label, position, yaw, pitch }] }]` — genérico
  (os mapas da Fase 6 podem declarar os seus).
- Console: `estacao [n|nome] [ponto]` — sem argumento lista as estações e os pontos; com argumento teleporta (zera a
  velocidade): `estacao 7 900`, `estacao bhop`, `estacao gabarito`. `map pista` e o lobby listam o mapa; o menu ganha o
  botão "Pista de testes"; as dicas do HUD citam o `estacao`.
- **Medidor de salto e queda** (`src/debug/jumpMeter.js`, puro, alimentado pelo `matchState` a cada tick como o de
  counter-strafe): por pulo — distância no plano, ápice acima da saída, tempo no ar, queda (ápice − pouso) e velocidade de
  pouso; por série de bhop (pulos com até 1 tick no chão entre eles) — número de pulos, distância total, velocidade média e
  máxima no plano. Linhas novas no `cl_showpos`; `cl_salto_reset` zera.
- O tamanho do mapa de sombra passa a ter teto (4096 e o máximo da GPU) em `renderSystem.js`.

### Testes (Node, sem navegador)
- `pistaLayout`: lotes dentro da base e sem sobreposição; peças dentro do seu lote; topos das escadas e dos blocos,
  ângulos das cunhas (pela normal da face), face de baixo das traves, vãos dos portais, tetos do túnel, larguras das
  vigas, topos das pranchas da torre, espessura de todo degrau da espiral ≤ 18 u, livros e pranchas sem se cruzar,
  superfícies válidas.
- `pistaMovement` (`PlayerPawn` na colisão real da pista): spawn livre; escadas de 8/12/16/18 u sobem andando e as de 20
  e 24 u não; rampas de 15/30/44° sobem e as de 46/60° escorregam; pulo em pé alcança 57 e não 58, pulo agachado
  alcança 64 e 66 e não 67 nem 72; portais 73/72 em pé e 55/54 agachado; no túnel não levanta nas caixas de 60 u e
  levanta na de 96; vão de 33 u passa e de 31 não; de pé na viga de 4 u; pouso em cada prancha da torre na altura exata;
  roteiro de passos sobe o primeiro trecho da espiral até a prancha de 200.
- `pistaFuzz`: 10 minutos simulados com entrada aleatória partindo de cada estação — nenhuma penetração além da folga,
  resultado idêntico bit a bit em duas rodadas (a parte automática do aceite da 3.5, adiantada).
- `jumpMeter`: sequências sintéticas, a interrupção pelo teleporte e o pulo plano, a série de bhop e a queda de 900 u
  simulados.
- Acrescentados na implementação: `pistaGeometry` (cada livro, peça de papelaria, recorte e caixa de papelão cabe na
  caixa de colisão dela, sem triângulo virado nem degenerado; o `BatchBuilder` une atributos e reaproveita geometria),
  `pistaMaterials` (o remendo de cada material novo entra no shader físico e todo uniform declarado tem valor; a
  impressão do `ClayMaterial` troca os valores no lugar), `pistaRig` (a key alcança a base inteira dentro do cone e do
  frustum da sombra, luzes práticas com alcance, sala do ambiente com todas as luzes, poeira só na caixa) e
  `stationCommands` (o `estacao` e o registro do mapa).

### Ajustes feitos na implementação
- Spawn no fundo da praça (z = 1200, pitch −2°) e luminária mais baixa (lâmpada a 290 u): a luminária inteira e a
  prancheta entram na primeira vista (em z = 1000 só aparecia a haste no meio da tela).
- Luz: níveis da montagem mais baixos que os da sala (o compensado claro estourava), compensado um pouco mais escuro
  (bétula usada), luz do túnel a meia altura (colada no teto, estourava o papelão de perto), poeira numa caixa baixa.
- Ponto `entrada` do túnel recuado para x = 1250 (a aba de cima da boca aberta ficava na altura do olho).
- Placas das pegadas com o P a leste: quem vem da praça olhando para o sul lê P-E-G-A-D-A-S da esquerda para a
  direita; relevo das letras exagerado (4,5 u) como a luz rasante de macro mostra nas fotos.
- Anotações da tábua de crescimento ao longo dela; tapetes e papéis do chão com colisão (a espessura conta nos
  números); lote 11 no compensado nu; chão do estúdio e base da luminária com colisão.
- Ondas do papelão de uma face somem suavemente de longe (moiré na quina das paredes finas).
- Montagem mais leve: marcas do rolo das placas numa grade de 8 px interpolada e bolotas com 8 divisões (de ~3,1 s
  para ~1,5 s de montagem, 50 mil triângulos a menos).

### Medições (2026-09-25, preset Alto, 1920 × 1080, GPU do usuário)
- Pista: 31 desenhos estáticos (lotes + malhas próprias), 285 mil triângulos no total, 735 peças nos lotes; colisão com
  3532 triângulos.
- Quadro: spawn 59 draws, 156 mil triângulos, GPU ~4,5 ms (cena 2,3 ms); vista geral de cima 62 draws, 295 mil
  triângulos, 5,3 ms; torre 3,0 ms, escadas 3,6 ms, túnel 3,4 ms, faixa de bhop 4,7 ms. Sala de testes na mesma
  máquina: 60 draws, 3,3 ms. Draws e triângulos dentro das metas; a GPU passa da meta de "perto de 3,3 ms" nas vistas
  que pegam a base inteira (o compensado aceso cobre metade da tela) — fica para a passada de desempenho da Fase 6.
- Montagem do mapa ~1,5 s com o cache de shader quente (primeira vez numa máquina: ~20 s compilando os shaders novos).
- Memória: menu com 2 geometrias / 34 texturas / 25 programas nas três saídas; pista com 42 / 80 / 46 nas três
  entradas; ouvintes de `player:weapon`, `player:zoom` e `loadout:change` em 0 no menu.
- Medidor no navegador: pulo parado "ápice 57.0 · 0.75 s · pouso 286 u/s"; queda da prancha de 420 até o kraft da
  faixa de bhop "queda 419.7 · pouso 806 u/s"; série de 8 pulos correndo com a faca "1359 u em 5.55 s · média 245 u/s".

### Aceite da 3.3
- [x] Pesquisa no Pinterest registrada (item 11 do moodboard, folha de contato regenerada).
- [x] Mapa `pista` com as 12 estações nos números acima, acessível pelo menu, pelo lobby e pelo console; `estacao` leva a
      cada estação e ponto.
- [x] Visual conferido contra o moodboard: a pista parece um set de stop-motion montado com objetos de verdade na escala
      do boneco, não um blockout.
- [x] Medidor de salto e queda no `cl_showpos`.
- [x] Testes novos passando (layout, movimento na pista, 10 min simulados, medidor, geometrias, materiais, luz e
      `estacao`) junto com os antigos: 213 testes.
- [x] Sem erros do jogo no console; sem vazamento em 3 ciclos menu ↔ pista; metas de draws, triângulos e GPU medidas e
      anotadas (acima); arquivos abaixo de 600 linhas (o maior, `ClayMaterial.js`, com 554); números em `src/data/`.

## 3.4 — Slide, wall-jump e dano de queda

Desenho aprovado em 2026-09-25, seção por seção (slide; wall-jump; dano de queda, vida, morte e respawn; pista e debug;
arquivos, testes e aceite). Base: PROMPT 0 seção 0.6 — "slide (correr + agachar, dura ~0,6 s, com cooldown) e wall-jump
(1 por contato de parede, reseta ao tocar o chão)" e "dano de queda a partir de ~420 unidades de altura" —, o `player.js`
do Doodle District (lido no repositório de referência) e o código do CS:GO (a árvore `cstrike15` de ~2017): o
`CheckFalling` e o `PlayerRoughLandingEffects` de `gamemovement.cpp`, o `FlPlayerFallDamage` e as constantes de queda de
`cs_gamerules.cpp`, o `PlayerFallingDamage` de `movehelper_server.cpp`, o `OnTakeDamage_Alive` (acumulador de dano) de
`basecombatcharacter.cpp` e o colete do `CCSPlayer::OnTakeDamage` de `cs_player.cpp`. Plano de implementação:
`docs/phases/phase-3.4-plan.md` (validado tarefa por tarefa numa cópia limpa; os números abaixo são os do código pronto).

Decisões do usuário nesta subfase:
- **Segurar para deslizar**: soltar o Ctrl encerra o slide, que dura no máximo ~0,6 s (como na referência e no agachar
  de segurar do CS). A alternativa (slide comprometido até o fim) saiu.
- **Wall-jump para onde o jogador olha** (e não a fórmula literal da referência): com o controle aéreo do CS (desejo
  limitado a 30 u/s), o empurrão perpendicular da referência não deixa mirar o próximo painel — a simulação na colisão
  real (protótipo fora do projeto) só fechava o zigue-zague minúsculo; o chute para onde o jogador olha atravessou um
  zigue-zague de 4 painéis e subiu um poço de 4 paredes.
- **Razão exata do CS:GO no dano de queda** (1000/580, conferida no código): a do Source (1024/580), usada no rascunho
  do "~1310 fatal", deixava 1 de vida na queda da prancha de 1310 (99,4 de dano); com a do CS:GO ela mata (105).
- Arquitetura da 3.2 (**abordagem A**): slide e wall-jump são funções puras dentro do `playerMove`, sobre o estado de
  movimento (a predição da Fase 9 e os bots da Fase 7 reaproveitam só gerando outro comando); a vida fica num módulo
  puro aplicado pelo `PlayerPawn` a partir do evento de pouso.
- A 3.4 entra na mesma árvore da branch `fase-3.1`, sem commit até o usuário pedir.

### O que a referência e o CS fazem (números de origem)
- **Doodle District** (`src/player.js`, igual desde o primeiro commit; unidades em metros, boneco de 1,75 m, sprint 10,6
  m/s, andar 6,6, agachado 3,6, pulo 9,6 m/s, gravidade 26 m/s²):
  - slide: começa com o agachar apertado no chão acima de 6,3 m/s; impulso até 12,8 m/s (no máximo +4,5); durante,
    freio constante de 6,5 m/s² e desejo lateral de 6 m/s² que não aumenta a velocidade; acaba ao soltar o agachar,
    abaixo de 3,5 m/s ou com mais de 0,35 s no ar; pular no slide multiplica a velocidade por 1,06;
  - wall-jump: todo contato horizontal no ar guarda a normal da parede por 0,12 s; o pulo tem buffer de 0,15 s; espera
    de 0,35 s entre wall-jumps; só com a subida abaixo de 7 m/s; velocidade = normal × 7,5 + velocidade × 0,35 +
    frente × 2,5 e vertical 9,2 m/s (0,958 do pulo);
  - hoje a referência tem também pulo duplo, air-dash, gancho e escalada de beirada: a spec tira o air-dash e o gancho
    e não pede os outros.
- **CS:GO** (valores fora do HL2): `PLAYER_FATAL_FALL_SPEED` 1024, `PLAYER_MAX_SAFE_FALL_SPEED` 580,
  `PLAYER_FALL_PUNCH_THRESHOLD` 350 (`shareddefs.h`); no `cs_gamerules.cpp`, `CS_PLAYER_FATAL_FALL_SPEED` 1000 e
  `CS_PLAYER_MAX_SAFE_FALL_SPEED` 580, dano = (queda − 580) × 100/(1000 − 580), sem o fator 1,25 do CS:S. O pouso com
  queda acima de 580 chama o dano (`DMG_FALL`, som "Player.FallDamage"); o colete só vale para dano genérico, de bala,
  explosão, pancada e corte — nunca para queda. O `god` (FL_GODMODE) anula o dano no `OnTakeDamage_Alive`, que aplica a
  parte inteira do dano e guarda a fração num acumulador (`m_flDamageAccumulator`) até completar 1. Quem pousa pelo
  duckbug não passa pelo `CheckFalling`: nem pouso, nem dano.

### Ordem do tick (atualizada)
`playerMove(estado, cmd, env)` — a lista da 3.2 com os passos novos:
1. `checkParameters`: teto do tick, portão do agachar, andar e fator da stamina.
2. Relógios: stamina, tempo desde o último agachar, recarga do slide, buffer do pulo no ar e espera do wall-jump.
3. Desprender.
4. Queda: no ar, `fallVelocity = −vy` do começo do tick.
5. Passos (o relógio fica parado durante o slide).
6. **Botão do slide** (depois do portão do agachar, antes da transição): soltar o Ctrl encerra; o começo.
7. Agachar (`duck.js`); no slide a cápsula já está agachada e fica.
8. Meia gravidade.
9. Pulo: no chão, o pulo do CS (no slide, sai com o embalo e o slide acaba); **no ar, o wall-jump** com o contato de
   parede guardado pela sonda e o buffer do botão.
10. No chão: `vy = 0`, `fallVelocity = 0`; no slide, o atrito do slide; senão o atrito do CS.
11. Chão: **slide** (movimento próprio) ou aceleração do CS com o teto duro (a velocidade só cai, até caber no teto,
    logo depois de um slide); ar: air-accelerate e deslize.
12. `categorizePosition`, limites por eixo, meia gravidade.
13. **Fim do slide** por tempo, velocidade ou tempo no ar.
14. **Sonda de parede** (no ar): guarda o contato (idade 0) ou, sem parede, envelhece o último em um tick — a idade vale
    a partir do começo do tick seguinte, então a tolerância de 0,12 s cobre os 7 ticks depois de desencostar; no chão,
    a lista de paredes usadas, a contagem do voo e o buffer zeram.
15. Pouso: evento `land` com `damage` (a velocidade de queda vira dano no `PlayerPawn`).

### Slide (`src/player/slide.js`)
**Começo**, no passo 6, com tudo isto valendo: no chão; o Ctrl apertado neste tick (o bit cru subiu) e aceito pelo portão
do spam (`duckHeld`); o pulo não apertado (Ctrl + Espaço continua sendo o pulo agachado do CS); o andar não engatado nem
o botão do andar apertado; velocidade no plano ≥ 80% da velocidade do item (`s.baseSpeed` = mín(260, `sv_maxspeed`,
velocidade do item no modo atual): faca 200, AK 172, AWP 160; AWP com zoom 80); recarga vencida; `sv_slide 1`. Na hora:
- a velocidade no plano sobe para no mínimo `sv_slide_speed` (1,2) × a velocidade do item — faca 300, AK 258, AWP 240 (o
  impulso da referência, 12,8 ÷ 10,6); velocidade maior fica como está;
- a cápsula agacha na hora (54 u, `duckAmount` 1, FL_DUCKING); a queda do olho (18 u) vai para a suavização da câmera,
  como a troca de cápsula no ar;
- evento `slide` { fase: início, velocidade, velocidade de antes do impulso, superfície }.

**Durante** (no chão, no lugar do atrito e da aceleração do CS):
- atrito do slide: a fórmula do atrito do CS com `sv_slide_friction` (0,12) × `sv_friction` × atrito da superfície e
  sem o piso do `sv_stopspeed` — faca 300 → 204,7 u/s em 0,61 s (39 ticks) e 151,2 u percorridos (AK 258 → 176,1 u/s,
  130,0 u);
- controle lateral leve: o desejo (WASD/analógico) empurra a no máximo 0,566 × a velocidade do item por segundo (6 ÷
  10,6 da referência; 141,5 u/s² com a faca, ~27°/s a 300 u/s) e a velocidade volta ao módulo de antes — girar não
  acelera;
- rampas: a componente horizontal da gravidade no plano do chão (`sv_gravity` × n.y × (n.x, n.z)) acelera na descida e
  freia na subida;
- sem o teto duro do tick; o deslocamento é o do andar (`groundMove` do controlador: varredura, degrau de até
  `sv_stepsize`, grudar no chão);
- sem passos (o relógio fica parado e recomeça depois);
- no ar por pouco tempo (lombada, degrau para baixo além do que o chão acompanha): o movimento é o do ar e o slide segue
  se pousar em até 0,35 s (o tempo total continua contando).

**Fim**, com o evento `slide` { fase: fim, motivo, tempo, distância, velocidade de entrada e de saída }:
- soltar o Ctrl (motivo `soltou`) — a decisão do usuário;
- `sv_slide_time` (0,6 s) desde o começo (`tempo`);
- velocidade no plano abaixo da do agachado, 0,34 × item (`parou`; subida, parede);
- pulo (`pulo`);
- mais de 0,35 s no ar (`ar`);
- noclip, teleporte, morte ou `sv_slide 0` (`interrompido`).

**Depois do slide:**
- recarga de `sv_slide_cooldown` (1 s) contada do fim;
- **saída sem parada seca**: logo depois do slide, com a velocidade acima do teto do tick (agachado, 85 com a faca; em pé,
  depois de uma descida rápida, 250), o corte duro do CS vira "a velocidade só cai": a aceleração do tick não pode passar
  da velocidade de antes dela, e o atrito normal freia até caber no teto (205 → 85 em ~11 ticks, 0,17 s); a saída acaba
  ao caber no teto ou ao sair do chão;
- soltando o Ctrl, levanta se couber (o `CanUnduck` do CS); sob uma trave continua agachado.

**Pulo no slide:** sai com o embalo do slide — o pulo do CS já corta no teto do bhop (286 u/s, `sv_enablebunnyhopping 0`)
—, custa stamina como qualquer pulo, e o slide acaba. Com o Ctrl seguro é o pulo agachado do CS: os pés sobem 9 u na hora
(`HULL.airDuckLift`, a subida do agachar no ar, por varredura — sob um teto sobe menos) e a subida vai para a suavização
do olho; a cápsula já agachada do slide não faria essa subida sozinha.

**Interações:** a precisão usa a velocidade real e o FL_DUCKING (atirar deslizando é impreciso); o andar (Shift) não
desliza; Ctrl no ar e pouso com o Ctrl seguro não deslizam (o pulo agachado do CS continua igual); o spam do agachar
também trava o slide (o aperto passa pelo portão).

### Wall-jump (`src/player/wallJump.js` + `src/physics/wallProbe.js`)
**Sonda de parede** (passo 14, todo tick no ar): a face de parede mais próxima a até 4 u da cápsula — o segmento
interno contra os triângulos a até raio + 4 u, sem alocar, no mesmo esquema de consultas do `CollisionWorld` (arquivo
próprio: o `collisionWorld.js` já tem 580 linhas). Parede = normal de contato a no máximo 20° da horizontal
(|n.y| ≤ 0,34): chão, teto, topo de parede (o contato na aresta de cima sai inclinado) e rampas de até 70° não contam.
Guarda { normal no plano, ponto, corpo, peça, superfície }.

**Peças de colisão:** o `ColliderBuilder` passa a guardar a peça de cada triângulo — cada forma (`box`, `cylinder`,
`ramp`, `stairs`, `geometry`, `object`, triângulos soltos) é uma peça nova; a opção `part` (nome) junta formas numa peça
só. O `CollisionBody` guarda a peça na ordem do BVH e o trace e a sonda devolvem a peça. O corpo é lembrado pela chave
que o `CollisionWorld` dá na ordem em que ele entra (`addBody`): igual em dois mundos montados do mesmo jeito (o `id`
global do corpo muda de um mundo para outro e quebraria o determinismo das rodadas repetidas).

**"A mesma parede"** = mesma peça (no mesmo corpo) com a direção no plano a até 45° de uma já usada. As faces de uma
caixa (90°) são paredes diferentes; as facetas do tubo redondo dentro de 45° são a mesma; as três peças da parede sul do
poço (a da porta) são uma parede só (grupo `poco-sul`); painéis separados no mesmo plano (o zigue-zague) são paredes
diferentes. A lista de paredes usadas (anel de 16) zera ao tocar o chão, no teleporte, no respawn e no noclip.

**Condições** (no passo 9): no ar (`moveType` andar, vivo, `sv_walljump 1`); um aperto do pulo no ar (o bit subiu neste
tick; no chão o aperto é o pulo do CS) nos últimos 0,15 s — o buffer da referência: apertar um pouco antes de encostar
também vale; contato de parede nos últimos 0,12 s — a tolerância da referência depois de soltar a parede; essa parede
ainda não usada desde o chão; velocidade vertical ≤ 220,2 u/s (7 ÷ 9,6 do pulo, a razão da referência: logo depois do
pulo do chão ainda não vale); 0,35 s desde o último wall-jump.

**O chute (para onde olha):**
- direção = a horizontal do olhar; olhando para dentro da parede, espelhada no plano dela (de frente sai reto pela
  normal; de viés, sai para o mesmo lado); e sempre pelo menos 30° para fora da parede (olhando ao longo dela sai a 30°);
- velocidade no plano = a atual, com piso na velocidade do item (`s.baseSpeed`: faca 250, AK 215, AWP 200 — como no CS,
  com a faca vai mais longe) e teto de `sv_walljump_maxspeed` (286, o do bhop);
- vertical: `sv_walljump_up` (289,41 u/s = 0,958 do pulo, a razão 9,2 ÷ 9,6 da referência; +52,35 u acima do ponto do
  wall-jump) × (1 − stamina/100) menos a meia gravidade do tick (a parábola exata, como o pulo); a stamina soma 0,08 ×
  o impulso, como um pulo;
- a parede entra na lista de usadas, o buffer é consumido e a espera recomeça;
- evento `walljump` { normal, superfície, velocidade, número do wall-jump no voo, corpo, peça } — áudio (Fase 12),
  audição dos bots (Fase 7) e câmera (3.5).

**Ficam iguais:** no chão, colado na parede, o Espaço é o pulo do CS; no noclip e morto não há wall-jump; a precisão no ar
segue a regra da 3.2 (termo pela velocidade vertical).

### Dano de queda
- Conta só no pouso com evento `land` (passo 15): velocidade de queda acima de 819,756 u/s (= √(2·800·420), o "seguro
  até ~420 u" do PROMPT).
- Dano = (velocidade − 819,756) × 100 / (1413,373 − 819,756) × `sv_falldamage_scale` — a razão exata do CS:GO
  (1000/580) sobre o nosso limite seguro: 0,1685 de vida por u/s; fatal a partir de 1413,373 u/s.
- Simulação no controlador real (queda do repouso sobre chão plano): 200 u → 0; 420 u → 0 (pouso a 812,5 u/s); 430 u →
  0,88; 600 u → 26,15; 900 u → 61,95; 1200 u → 93,54; 1250 u → 99,85 (sobra 1 de vida); 1310 u → 104,06 (morre). As
  velocidades de pouso andam em degraus de 12,5 u/s (a gravidade de um tick), então a queda do repouso passa a matar entre
  1270 e 1310 u; saindo andando de uma prancha o degrau cai em outro lugar (as pranchas da torre, andando com Shift: 0,
  0, 25,1, 63,0 e 105).
- O colete não reduz; `god` não toma dano; pouso pelo duckbug (sem evento `land`) não toma dano, como no CS.
- Com o evento `land` passa a ir `damage` (o dano antes do acumulador) para o áudio e os medidores.

### Vida mínima (`src/player/vitals.js` + `src/data/vitals.js`)
- Estado puro: vida inteira (100), vivo, acumulador de dano fracionário, último dano { quanto, tipo, vida que saiu },
  mortes, causa e tempo morto.
- `applyDamage(vida, quanto, tipo, { god, cause })`: com `god`, nada; a parte inteira sai da vida agora, a fração vai
  para o acumulador e, ao completar 1, sai 1 a mais (o `OnTakeDamage_Alive` do Source); vida ≤ 0 → morte com a causa
  (a vida para em 0).
- Colete e capacete são lidos do `Loadout` (o HUD de teste mostra); os tipos de dano nos dados dizem se o colete vale:
  `queda` e `mundo` (console, fora do set) não passam pelo colete. A fórmula do colete contra bala, explosão e faca entra
  na Fase 4, com as armas.
- Eventos: `EV.PLAYER_HURT` { damage (vida que saiu), amount (dano como veio), kind, health, armor },
  `EV.PLAYER_DEATH` { cause, kind, text }, `EV.PLAYER_SPAWN` { position }.

### Morte e volta (modo livre)
- **Morto**: o comando do tick fica vazio (sem movimento, pulo, agachar nem troca de item; o corpo só termina de assentar
  com o atrito e a gravidade); o olhar continua livre; a câmera desce até 12 u acima dos pés e tomba 35° em 0,5 s (com
  saída suave; só desce com "reduzir movimento"); etiqueta de fita no centro com a causa ("Você se esborrachou", "Caiu do
  set", "Desistiu", "Amassado pelo console") e "volta em 2 s" contando.
- **Volta** em 2 s (o tempo do Mata-mata na spec) no **ponto de volta**: o último teleporte do console neste mapa
  (`estacao`, `setpos`), senão o spawn do mapa — morrer da prancha de 1310 devolve à prancha. Vida 100, acumulador 0;
  estado de movimento zerado (velocidade, stamina, agachar, slide e recarga, paredes usadas); precisão e luneta
  zeradas; medidores interrompidos; evento `EV.PLAYER_SPAWN`. A proteção de 1,5 s depois de nascer é dos modos (Fase 8).
- **Ponto que não se sustenta** (`src/modes/returnPoint.js`): se o mundo mata o jogador — queda fatal, cair do set, ou
  cair do set com `god` — antes de ele ficar de pé, vivo, no chão desde que chegou no ponto (teleporte para o vazio ou
  para o alto), o ponto sai e a volta é no spawn; senão cada volta repetiria a mesma morte a cada 2 s. Morte pelo
  console (`kill`, `hurtme`) não julga o ponto.
- **Cair para fora do set** (1500 u abaixo do chão do mapa) passa a matar ("Caiu do set"); com `god`, volta ao spawn como
  antes (com o aviso).
- **Console** (`src/debug/vitalsCommands.js`): `kill` (o do CS: morte na hora) e `hurtme <n>` (o cheat do Source: dano
  do tipo mundo; `god` segura).

### HUD de teste (o HUD de massinha é da Fase 10)
- Etiqueta de fita "vida 100 · colete 0" no topo, ao lado de "na mão"; ao tomar dano o número pisca e aparece a vida que
  saiu ("−26") por 0,9 s.
- Etiqueta da morte no centro da tela, acima da mira; o "clique para jogar" continua funcionando por baixo dela.
- Dicas dos três dispositivos citam o slide (Ctrl correndo / B correndo / botão agachar correndo) e o wall-jump (pulo no
  ar perto da parede).
- Sem elemento visual novo: a 3.4 reaproveita a etiqueta de fita e as peças e materiais da pista (item 11 do moodboard);
  o HUD de massinha (Fase 10) e a morte por amassamento (Fase 5) terão pesquisa própria.

### Pista (números em `src/data/pista.js`; no layout, o grupo da parede sul, as marcas da faixa e as notas da tábua)
Os números saíram da simulação com o código pronto e os testes os fixam:
- **Poço (5)**: 144 × 144 u por dentro (x −2522…−2378, z 78…222) e 224 u de altura — com 3 paredes o ápice chega a
  ~205 u e nunca sai (24 ordens × 3 largadas × 2 distâncias de pulo no teste); com as 4 sai por cima da parede leste e
  fica na prancha de saída; porta de 64 × 88 u; as três peças da parede sul formam uma parede só (grupo `poco-sul`);
  faixas numeradas com o centro a 152 u (acima da porta); prancha de saída e torre de blocos de faia a 224 u.
- **Zigue-zague (5)**: corredor de 144 u (x −1822…−1678), painéis de 136 u (oeste 564–700 e 292–428, leste 428–564 e
  156–292), plataformas A (z 700–900) e B (z −44–156) a 128 u, vão de 544 u — maior que qualquer pulo correndo ou bhop
  (~210 u); passa com a faca e com a AK, com folga de altura na borda de B; a rampa de 30° (144 u de largura) continua
  subindo à plataforma A. Ponto `ziguezague` na plataforma A (−1750, 860) olhando para B.
- **Faixa de slide (6)**: faixa de −2600 a −1500 em x; linha de largada de fita em x = −2080 (520 u de corrida desde o
  ponto `faixa`); as quatro traves na ordem do limbo a 32, 60, 88 e 116 u da linha (régua 70, lápis 64, régua de aço 58,
  espeto 55) sobre apoios de 20 u (z 1175 e 1365) com as etiquetas em z = 1140; marcas de fita a cada 50 u até 400 u da
  linha, com os números em z = 1400. Em pé bate na primeira trave; deslizando passa pelas quatro (a faca deslizando sob
  as quatro, a AK sob as três primeiras e agachada na saída sob a quarta). O gabarito de portais não muda. Ponto novo
  `traves` na linha de largada (−2104, 1270); apelidos da estação 6: `vaos`, `deslizar` e `agachar` (o `traves` virou
  ponto).
- **Torre (7)**: anotações da tábua "200 · sem dano", "420 · o limite seguro", "600 · −26", "900 · −62" e "1310 · fatal"
  (acima do seu risco), e um risco a mais onde a queda do repouso passa a matar (1280 u, "daqui para cima, fatal"); a
  tábua de crescimento cresce para 1460 u para a nota de cima caber. As notas são decalques voltados para fora, lidos de
  baixo para cima na metade direita de quem olha a tábua de fora.

### Debug, console e dados
- **`cl_showpos`**, linhas novas: vida (colete, acumulado, último dano e tipo, mortes e, morto, a causa e a contagem);
  slide (estado, tempo, recarga, último slide: distância, tempo, velocidade de entrada e de saída, motivo); parede
  (último contato: normal, peça e idade em ticks, paredes usadas, wall-jumps no voo, espera e o total).
- **Medidor de salto**: wall-jumps de cada voo, o dano de cada pouso e o recorde de wall-jumps seguidos.
- **Gráfico dos 4 s**: faixa nos ticks de slide e marca em cada wall-jump (marcas novas na telemetria).
- **`r_colisao`**: o contato de parede da sonda (segmento pela normal numa cor própria, enquanto vale a tolerância).
- **`sv_*` novas** (faixa e ajuda no console pelo `SV_VARS`; `sv_reset` restaura; no online o host replica): `sv_slide`
  1, `sv_slide_speed` 1,2, `sv_slide_time` 0,6, `sv_slide_cooldown` 1, `sv_slide_friction` 0,12, `sv_walljump` 1,
  `sv_walljump_up` 289,41, `sv_walljump_maxspeed` 286, `sv_falldamage_scale` 1.
- **`src/data/movement.js`**: `SLIDE` (entrada 0,8 × item, controle lateral 0,566 × item/s, 0,35 s no ar, fim abaixo de
  0,34 × item), `WALLJUMP` (alcance 4 u, |n.y| ≤ 0,34, tolerância 0,12 s, buffer 0,15 s, espera 0,35 s, subida máxima
  220,2 u/s, 30° para fora, 45° para a mesma parede, anel de 16 paredes usadas), `FALL` (819,756 e 1413,373 u/s).
- **`src/data/vitals.js`**: vida máxima 100, volta em 2 s, câmera da morte (12 u, 35°, 0,5 s), "−n" por 0,9 s, tipos de
  dano (colete ou não) e os textos das causas.
- **Eventos novos**: `EV.PLAYER_SLIDE`, `EV.PLAYER_WALLJUMP`, `EV.PLAYER_HURT`, `EV.PLAYER_DEATH`, `EV.PLAYER_SPAWN`;
  `EV.PLAYER_LAND` ganha `damage`.

### Arquivos
- Novos: `src/player/slide.js`, `src/player/wallJump.js`, `src/player/vitals.js`, `src/physics/wallProbe.js`,
  `src/data/vitals.js`, `src/debug/vitalsCommands.js`, `src/modes/returnPoint.js`; testes `wallProbe`, `slide`,
  `wallJump`, `vitals` e `returnPoint`.
- Alterados: dados (`movement`, `pista`), física (`colliders`, `collisionBody`, `collisionWorld`,
  `characterController`), jogador (`movement`, `duck`, `footsteps`, `playerPawn`, `telemetry`), `core/events`,
  `modes/matchState`, `ui/sandboxHud` + `styles/hud.css`, debug (`showPos`, `jumpMeter`, `speedGraph`, `physicsDebug`,
  `commands`) + `styles/debug.css`, pista (`pieces`, `colliders`, `layoutAdvanced`, `layoutTower`); testes que ganham
  casos (`pistaLayout`, `pistaMovement`, `pistaFuzz`, `movementFuzz`, `playerPawn`, `jumpMeter`, `movementData`,
  `tacticalMovement`); `docs/phases/phase-3.4-plan.md` e o relatório no `PROGRESS.md`.

### Testes (Node, sem navegador)
- **Sonda**: acha a parede ao alcance (e não além); ignora chão, teto, topo de parede e rampa; devolve a peça certa e o
  grupo; a mais próxima entre duas.
- **Slide**: condições de começo (80%, Shift, no ar, recarga, spam, pulo apertado, `sv_slide 0`); impulso de 1,2×; 0,6 s;
  soltar encerra; curva do atrito (204,7 u/s e 151,2 u com a faca); controle lateral sem ganhar velocidade; rampa
  acelera na descida e freia na subida; cápsula agachada na hora (passa a trave de 55; em pé bate na de 70); saída sem
  parada seca; pulo mantém o embalo com o teto de 286 e sobe 9 u com o Ctrl seguro; sem passos; eventos com os motivos;
  recarga de 1 s.
- **Wall-jump**: buffer de 0,15 s (só no ar); tolerância de 0,12 s; subida máxima; espera de 0,35 s; a mesma parede só
  depois do chão; grupo = uma parede; faces da caixa = paredes diferentes; painéis separados no mesmo plano =
  diferentes; tubo dentro de 45° = a mesma; direção do chute (olhar, espelho, mínimo de 30°, de frente sai pela normal);
  piso pelo item e teto de 286; 289,41 × stamina e o custo de stamina; `sv_walljump 0`.
- **Vida e queda**: curva de dano (os valores acima), acumulador, `god`, duckbug sem dano, colete ignorado,
  `sv_falldamage_scale`; morte (comando vazio, câmera, "reduzir movimento") e volta com o estado zerado; `kill` e
  `hurtme`; o ponto de volta que não se sustenta sai e o do console fica.
- **Pista** (colisão real): o poço exige as 4 paredes (com 3 não sai); o zigue-zague passa com a faca e com a AK e sem
  wall-jump cai no vão; o slide passa as quatro traves e em pé bate na primeira; as pranchas da torre dão 0, 0, ~26,
  ~62 e morte; as notas da tábua voltadas para fora, na metade direita, terminando no risco.
- **Regressão**: os 10 min simulados na sala e na pista com slides e wall-jumps na entrada aleatória (fases de "toques
  de slide" e mais de 20 slides e 20 wall-jumps por rodada) — nenhuma penetração, nunca preso —, e o resultado igual
  bit a bit com todo o estado novo.

### Ajustes feitos na implementação
- Slide não começa com o pulo apertado: Ctrl + Espaço correndo segue o pulo agachado do CS.
- Pulo do slide com o Ctrl seguro sobe os pés 9 u (o pulo agachado do CS), por varredura (`raise` no controlador).
- Chute do wall-jump espelhado no plano da parede quando o olhar entra nela (antes: reto pela normal).
- Buffer do pulo armado só por apertos no ar (no chão o aperto é o pulo do CS).
- Saída do slide: "a velocidade só cai" no lugar de "o atrito até caber" (a aceleração do tick não passa da velocidade
  de antes dela).
- Idade do contato de parede anda na sonda (passo 14) e não nos relógios do passo 2: a tolerância conta do começo do
  tick seguinte (7 ticks depois de desencostar).
- O corpo da parede é a chave dada pelo `CollisionWorld` na ordem de entrada (o `id` global quebrava o determinismo).
- "Velocidade do item" é o `s.baseSpeed` do estado (o teto do tick sem agachar, andar nem stamina).
- Controlador: `groundMove` (varredura, degrau e grudar no chão) compartilhado pelo andar e pelo slide, e `raise`.
- Poço a 224 u (o desenho estimava ~210 pelo protótipo) e zigue-zague 144/136/544 (dentro das faixas do desenho).
- Notas da tábua de crescimento: a base do decalque estava espelhada desde a 3.3 (normal para dentro da tábua) e as notas
  não apareciam de fora — achado no navegador; agora saem para fora, com teste no `pistaLayout`.
- Ponto de volta que não se sustenta — achado no navegador (`setpos` abaixo do set prendia o jogador num ciclo de morte
  a cada 2 s): `src/modes/returnPoint.js`.
- Fuzz: 25% das fases são "toques de slide" (correndo para a frente, Ctrl seguro 24 de cada 48 ticks, sem pulo nem
  andar), para a entrada aleatória deslizar de verdade.
- `kill` e `hurtme` num arquivo próprio (`vitalsCommands.js`), registrado pelo `commands.js`.

### Medições (2026-09-25, projeto real no navegador, entrada pelo `InputManager`)
- Slide na faixa (faca): 151,2 u em 0,61 s, 300 → 205 u/s, motivo `tempo`, sob as quatro traves.
- Poço com as 4 paredes: ápice 253 u, de pé na prancha de saída a 230,03 u, 4 wall-jumps.
- Zigue-zague: AK e faca pousam em B com 4 wall-jumps (folga na borda de B: 38,7 u com a AK, 136,7 u com a faca; a
  entrada do navegador chega um tick depois da dos testes, que medem mais de 40 u com as duas).
- Prancha de 600 andando, com colete 100: pouso a 968,75 u/s, dano 25,1 (o colete não reduz), "vida 75 · colete 100" e
  "−25"; `hurtme 26` → 49; `god` segura.
- Prancha de 1310 correndo: dano 105,1, "Você se esborrachou" com "volta em 2 s", câmera baixa e tombada, volta na
  prancha em 2,0 s com vida 100; `kill` → "Desistiu" e volta ao mesmo ponto.
- Ponto de volta: `setpos` abaixo do set → uma morte ("Caiu do set") e volta no spawn, sem repetir; queda de 2000 u →
  volta no spawn; na sala, `setpos` e `kill` na mesma chamada → volta no ponto.
- Anotações da tábua legíveis de fora ("600 · −26", "daqui para cima, fatal", "1310 · fatal").
- Pista: 31 desenhos estáticos, 288 mil triângulos, colisão com 3532 triângulos. Memória: menu com 2 geometrias / 33
  texturas / 20 programas nas três saídas e pista com 42 / 79 / 41 nas três entradas; ouvintes de `player:*` zerados no
  menu; heap de volta a ~16 MB depois da coleta. Console sem erros do jogo.

### Aceite da 3.4
- [x] Slide: até 0,6 s, soltar encerra, passa sob as traves, rampa acelera, recarga de 1 s, fim sem parada seca.
- [x] Wall-jump: o poço exige as 4 paredes, o zigue-zague passa, a mesma parede só depois do chão, tolerância e buffer.
- [x] Dano de queda: 420 u seguro, curva pela razão do CS:GO, 1310 fatal, colete não reduz, `god` e acumulador.
- [x] Morte e volta em 2 s na sala e na pista; cair do set mata.
- [x] `cl_showpos`, medidor, gráfico, `r_colisao`, `sv_*` e HUD com a vida funcionando.
- [x] Testes passando (255: os antigos e os novos, com os 10 min simulados e o determinismo); sem erros do jogo no
      console; sem vazamento em 3 ciclos menu ↔ pista; arquivos abaixo de 600 linhas; números em `src/data/`; conferido
      no navegador com o projeto real.

## 3.5 — Sensação (plano)
- Câmera: head-bob, inclinação ao andar de lado, no slide e no wall-jump, mergulho no pouso com mola — tudo com
  intensidade ajustável na seção "Conforto" e anulado por "reduzir movimento".
- Squash & stretch do corpo no pouso e no pulo (mola que o corpo em terceira pessoa usa — o boneco de referência até a
  Fase 5 trazer os personagens —, animado "em dois" a 12 poses/s).
- Pegadas: mapa de impressão por área de chão de massinha (render target em espaço de mundo), carimbos alternados
  esquerda/direita a partir dos eventos de passo, amassado e leve escurecimento no `ClayMaterial`, esmaecendo em
  ~20 s.
- Aceite da fase: 10 min de jogo na pista sem atravessar parede (manual + varredura aleatória na geometria da
  pista), counter-strafe medido, slide e wall-jump fluidos, FPS e memória conferidos, relatório no PROGRESS.md.

## Aceite da Fase 3 (PROMPT, Fase 3)
- [ ] O movimento responde como CS no chão (counter-strafe funcional).
- [ ] Slide e wall-jump fluidos.
- [ ] Nenhum atravessamento de parede em 10 min de teste.
