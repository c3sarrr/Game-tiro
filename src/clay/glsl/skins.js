// Padrões das skins de massinha no fragment shader. Entrada: posição no espaço do objeto (p), cor base (a),
// cores B/C e parâmetros (vec4). Saída: cor de albedo; neon escreve emissão; glitter escreve flocos
// (claySkinFlake / claySkinFlakeN / claySkinFlakeG / claySkinFlakeHue) que o material transforma em micro-espelhos
// holográficos (rugosidade baixa, metal parcial, normal própria e a 1ª ordem de difração colorida na luz direta).
// Selecionado por #define CLAY_SKIN (ids em src/data/claySkins.js).

export const SKINS_GLSL = /* glsl */ `
float claySkinFlake = 0.0;
vec3 claySkinFlakeN = vec3(0.0, 0.0, 1.0);
vec3 claySkinFlakeG = vec3(1.0, 0.0, 0.0);
float claySkinFlakeHue = 0.0;

vec3 clayDeepen(vec3 c) {
  // Tom mais escuro e saturado da mesma massa (a sombra da massinha "puxa" para ele).
  return pow(max(c, vec3(1e-4)), vec3(1.7));
}

vec3 claySaturate(vec3 c, float amount) {
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  return max(mix(vec3(l), c, amount), vec3(0.0));
}

mat2 claySkinRot(float a) {
  float c = cos(a);
  float s = sin(a);
  return mat2(c, -s, s, c);
}

vec3 claySkinColor(vec3 p, vec3 a, vec3 b, vec3 c, vec4 k, inout vec3 emission, float poseRand) {
  #if CLAY_SKIN == 1
    // Marmorizado (MPC3, MPC11, MPC15, MPC17): duas massas enroladas juntas, torcidas e esticadas (rolo
    // girado entre as mãos) e dobradas sobre si — poucas faixas LARGAS que fluem (5–8 numa bola), fronteira
    // nítida onde as massas não se misturaram e, em algumas regiões, a fronteira se alarga num tom intermediário
    // (massa parcialmente misturada, MPC11); um veio fino escuro onde se encostam. Borda anti-serrilhada pela
    // derivada da tela.
    vec3 q = p * 0.05 * k.x;
    q.xz = claySkinRot(q.y * 0.9) * q.xz;
    vec3 w = vec3(clayFbm3(q * 1.3, 3), clayFbm3(q * 1.3 + 5.2, 3), clayFbm3(q * 1.3 + 9.7, 3));
    vec3 qw = q + w * k.y * 0.35;
    // Dobra: a massa esticada e dobrada (abs) faz as "divisas" em V das fotos (poucas: uma dobra por bola).
    float fold = abs(fract(qw.x * 0.35 + clayFbm3(qw * 0.8, 2) * 0.5) - 0.5) * 2.0;
    float layers = qw.x * 1.6 + qw.z * 0.7 + clayFbm3(qw * 1.7, 3) * 0.7 + fold * 1.1;
    float s = sin(layers * 6.2831853);
    float thick = clayNoise3(qw * 0.7) * 0.45;
    float aa = fwidth(s) * 0.75 + 1e-4;
    float blend = smoothstep(0.05, 0.45, clayFbm3(qw * 0.9 + 3.1, 2)) * 0.55;
    float t = smoothstep(thick - aa - blend, thick + aa + blend, s);
    vec3 col = mix(a, b, t);
    float vein = (1.0 - smoothstep(aa * 0.6, aa * 0.6 + 0.05, abs(s - thick))) * (1.0 - blend * 1.6);
    return mix(col, c, clamp(vein, 0.0, 1.0) * k.z);
  #elif CLAY_SKIN == 2
    // Glitter (GPD1, GPD2, GPD4, GPD7, GPD13) em duas populações de flocos holográficos. Fino e denso
    // (k.x = densidade, k.y = fração sem floco): pontinhos de cor própria (entre B e C, dourado ↔ azul-gelo)
    // que aparecem mesmo sem reflexo (GPD1). O floco DEITA na massa (inclinação típica ~15° sobre a normal, no
    // material) e, além do reflexo de espelho, difrata a luz direta (1ª ordem da grade holográfica, no RE_Direct
    // da massinha): anel de ~15–40° em volta do espelho, cor girando com o ângulo, só no azimute da grade de cada
    // floco (claySkinFlakeG) — o lado iluminado inteiro cintila em pontos coloridos (GPD4). Grosso e esparso
    // (k.z = tinta): lantejoulas coloridas. Cada pose sorteia a inclinação de novo (cintila a 12 poses/s).
    // Quando a célula fica menor que o pixel o floco sai em média — a massa fica levemente perolada, sem chiado.
    vec3 gp = p * 1.6 * k.x;
    vec3 cell = floor(gp);
    vec3 fp = fract(gp) - 0.5;
    vec3 jitter = clayHash33(cell + 5.0) - 0.5;
    // Floco fino de ~0,3 mm (glitter hexagonal 0,2–0,4 mm) numa célula de ~0,5 u; o deslocamento mantém o floco
    // inteiro dentro da célula (0,18 + 0,32 ≤ 0,5).
    float d = length(fp - jitter * 0.36);
    float fade = 1.0 - smoothstep(0.35, 0.9, length(fwidth(gp)));
    float fine = step(k.y, clayHash13(cell + 11.0)) * smoothstep(0.32, 0.22, d) * fade;
    vec3 gp2 = p * 0.34 * k.x;
    vec3 cell2 = floor(gp2);
    vec3 fp2 = fract(gp2) - 0.5;
    float d2 = length(fp2 - (clayHash33(cell2 + 29.0) - 0.5) * 0.45);
    float fade2 = 1.0 - smoothstep(0.4, 0.95, length(fwidth(gp2)));
    float chunky = step(0.88, clayHash13(cell2 + 23.0)) * smoothstep(0.2, 0.13, d2) * fade2;
    vec3 fn = clayHash33(cell + 17.0 + floor(poseRand * 5.0)) * 2.0 - 1.0;
    vec3 fn2 = clayHash33(cell2 + 31.0 + floor(poseRand * 3.0)) * 2.0 - 1.0;
    claySkinFlake = max(fine, chunky);
    claySkinFlakeN = chunky > fine ? fn2 : fn;
    claySkinFlakeHue = chunky > fine ? clayHash13(cell2 + 47.0) : clayHash13(cell + 43.0);
    claySkinFlakeG = (chunky > fine ? clayHash33(cell2 + 53.0) : clayHash33(cell + 59.0)) * 2.0 - 1.0;
    vec3 tintFine = mix(b, c, clayHash13(cell + 7.3));
    vec3 col = mix(a, mix(a, tintFine, 0.75), fine);
    col = mix(col, mix(b, c, clayHash13(cell2 + 3.7)), chunky * k.z);
    vec3 pearl = mix(a, mix(b, c, 0.5), (1.0 - k.y) * 0.14);
    return mix(col, pearl, 1.0 - fade);
  #elif CLAY_SKIN == 3
    // Massa de escola desbotada: menos saturada, mais clara e com pó.
    vec3 faded = claySaturate(a, k.x);
    faded = mix(faded, vec3(0.93, 0.9, 0.84), k.y);
    float powder = clayNoise3(p * 0.6) * 0.5 + 0.5;
    return mix(faded, vec3(0.95), powder * k.z);
  #elif CLAY_SKIN == 4
    // Neon que brilha no escuro (GDC2, GDC5, GDC17): sob luz a massa é um pastel quase branco da cor do
    // pigmento; a emissão é fraca e constante, então só domina onde a luz não chega (na sombra ela brilha).
    float v = 1.0 - k.y + k.y * (clayNoise3(p * 0.05) * 0.5 + 0.5);
    emission += claySaturate(a, 1.3) * k.x * v;
    return mix(a, vec3(0.96, 0.97, 0.9), 0.55);
  #elif CLAY_SKIN == 5
    // Massa misturada (MPC6, MPC12, PLI11): três cobrinhas torcidas juntas — setores helicoidais em volta do
    // eixo X do objeto, fronteiras nítidas (o setor vence pelo maior cosseno, contínuo em volta do eixo) — e,
    // onde a criança amassou mais, as cores viram uma "lama" (k.x = escala, k.y = torção).
    vec3 q = p * 0.04 * k.x;
    float ang = atan(p.z, p.y);
    float phi = 6.2831853 * (p.x * 0.02 * k.y + clayFbm3(q * 1.7, 3) * 0.35);
    float c0 = cos(ang + phi);
    float c1 = cos(ang + phi - 2.0943951);
    float c2 = cos(ang + phi + 2.0943951);
    float aa = fwidth(c0) * 1.2 + 1e-3;
    float w0 = smoothstep(-aa, aa, c0 - max(c1, c2));
    float w1 = smoothstep(-aa, aa, c1 - max(c0, c2));
    float w2 = clamp(1.0 - w0 - w1, 0.0, 1.0);
    vec3 col = a * w0 + b * w1 + c * w2;
    float smoosh = smoothstep(0.12, 0.5, clayFbm3(q * 0.9 + 4.0, 3));
    vec3 mud = (a + b + c) * (0.92 / 3.0);
    return mix(col, mix(col, mud, 0.6), smoosh);
  #elif CLAY_SKIN == 6
    // Madeira falsa: anéis riscados na massa marrom com veios.
    vec3 q = p * 0.02 * k.x;
    float rings = fract(length(q.xz * vec2(1.0, 0.35)) * k.y + clayFbm3(q * 2.0, 3) * 0.9);
    float grain = smoothstep(0.0, 0.25, rings) * smoothstep(1.0, 0.6, rings);
    vec3 col = mix(b, c, grain);
    float streak = clayNoise3(vec3(q.x * 40.0, q.y * 2.0, q.z * 40.0)) * 0.5 + 0.5;
    return mix(col, b * 0.8, streak * k.z);
  #elif CLAY_SKIN == 7
    // Camuflagem: manchas de três massas.
    vec3 q = p * 0.03 * k.x;
    float n1 = clayFbm3(q, 3);
    float n2 = clayFbm3(q * 1.3 + 9.1, 3);
    vec3 col = a;
    col = mix(col, b, smoothstep(0.06, 0.1, n1));
    col = mix(col, c, smoothstep(0.16, 0.2, n2));
    return col;
  #elif CLAY_SKIN == 8
    // Ouro: massinha dourada (metalness vem do material).
    return a;
  #else
    return a;
  #endif
}
`;
