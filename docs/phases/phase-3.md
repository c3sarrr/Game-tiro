# Fase 3 — Movimento, física e colisão (plano técnico)

Base: PROMPT 0 seção 0.6 inteira + Fase 3 de `CLAUDE.md.md`. Aprovado em 2026-09-24: cinco subfases nesta ordem,
colisão por **varredura contínua exata** da cápsula (opção A) com o movimento do Source por cima.

## Estado das subfases

| Subfase | Conteúdo | Estado |
|---|---|---|
| 3.1 | Mundo de colisão BVH + controlador cápsula (paredes, quinas, degraus, rampas, teto, beirada, chão), gravidade, pulo, agachar com troca de cápsula, noclip, sala de testes andável, debug, testes sem navegador (10 min simulados sem atravessar) | ✅ 2026-09-25 |
| 3.2 | Movimento tático CS: velocidade por arma, andar silencioso, agachar (spam), air-strafe, bunny hop com penalidade, counter-strafe medido, inaccuracy de movimento para a Fase 4, eventos de passo | ✅ 2026-09-25 (plano executado: `docs/phases/phase-3.2-plan.md`) |
| 3.3 | Pista de testes: pesquisa no Pinterest + mapa `pista` com os módulos de movimento | — |
| 3.4 | Slide, wall-jump, dano de queda, vida mínima do jogador e respawn | — |
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

## 3.3 — Pista de testes (plano)
Pesquisa no Pinterest antes do visual (pistas de obstáculos de papelão, blocos e réguas como arquitetura, escadas
de livros, rampas de balsa, bancada vista de cima), moodboard item 11. Mapa `pista` montado com o kit e os materiais
do set: faixa de counter-strafe com grade de 1 m, escadas de 8/12/16/18/20/24 u, rampas de 15/30/44/46/60°, caixas
de 57/64/72 u, poço e paredes em zigue-zague para wall-jump, vãos de slide sob régua/lápis, torre de queda com
marcas de altura (200/420/600/900/1310 u), faixa longa de bhop com marcas de distância, vigas estreitas de balsa,
paredes finas de papelão, túnel baixo e placas de chão de massinha para as pegadas. Colisão com as formas do
`ColliderBuilder`, montagem de luz própria e acesso pelo menu, lobby e console.

## 3.4 — Slide, wall-jump e dano de queda (plano)
- Vida mínima do jogador (`src/player/vitals.js`: vida 100, colete do `Loadout`, `god`, morte e respawn na sala
  de testes/pista).
- Slide: correr + agachar no chão acima de ~80% da velocidade máxima; ~0,6 s com impulso inicial, atrito baixo,
  controle lateral leve, rampas aceleram, cápsula agachada (passa sob vãos), pulo mantém o embalo, recarga de ~1 s.
- Wall-jump: no ar, tocando parede (varredura horizontal curta), o pulo empurra para longe da parede e para cima;
  1 por contato de parede (a mesma parede só volta a valer depois de tocar o chão; paredes diferentes encadeiam),
  com tolerância curta depois de soltar a parede.
- Dano de queda: seguro até ~420 u de altura (≈ 819,8 u/s no impacto), fatal por volta de 1310 u (a mesma razão do
  CS), linear na velocidade entre os dois; colete não reduz.
- Números em `src/data/movement.js`; testes de duração, recarga, contagem de wall-jumps e curva de dano.

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
