// Controlador de personagem: porte do gamemovement.cpp do Source (TryPlayerMove, StepMove, StayOnGround,
// CategorizePosition) para Y para cima, sobre a varredura exata do CollisionWorld. A cápsula colide (paredes, teto,
// obstáculos); o chão é o da base chata — o disco dos pés (HULL.footRadius), como o fundo reto da caixa do CS: o
// jogador fica de pé em qualquer chão andável que o disco cubra, sobe degrau até sv_stepsize e só alcança a beirada
// que o pulo alcança (o redondo de baixo da cápsula não afunda na borda nem serve de rampa para subir nela).
// Opera sobre o estado de movimento do jogador (src/player/movement.js): pés na origem, velocidade, altura da cápsula,
// chão (normal, superfície, atrito) e `viewOffset` — a subida/descida brusca deste tick que a câmera suaviza.

import * as THREE from 'three';
import { CONTROLLER, HULL } from '../data/movement.js';
import { SURFACES } from '../data/surfaces.js';
import { copyTrace, createTrace } from './collisionWorld.js';

/** Tira de `v` a componente contra o plano de normal `n` (ClipVelocity do Source); overbounce 1 = deslizar. */
export function clipVelocity(v, n, out, overbounce) {
  const backoff = v.dot(n) * overbounce;
  out.set(v.x - n.x * backoff, v.y - n.y * backoff, v.z - n.z * backoff);
  // Segunda passada: não sobra nada entrando no plano por arredondamento.
  const adjust = out.dot(n);
  if (adjust < 0) out.addScaledVector(n, -adjust);
  return out;
}

/**
 * Corte contra uma quina pega pelo redondo de baixo da cápsula (normal subindo, de aresta ou vértice): o ponto fica
 * acima dos pés, onde a base chata bateria na lateral de quem sustenta a quina. Então primeiro tira a velocidade
 * horizontal que entra nela e só corta contra a normal verdadeira se ainda entrar. Assim a quina nunca dá impulso
 * para cima (subir beirada mais alta que o pulo) nem segura a cápsula pendurada: caindo, ela escorrega para trás;
 * subindo, sobe reto ao lado.
 */
export function clipLowEdge(v, n, out, overbounce) {
  const len = Math.hypot(n.x, n.z);
  out.copy(v);
  if (len > 1e-9) {
    const into = (v.x * n.x + v.z * n.z) / len;
    if (into < 0) {
      out.x -= (n.x / len) * into;
      out.z -= (n.z / len) * into;
    }
  }
  if (out.dot(n) >= 0) return out;
  return clipVelocity(out, n, out, overbounce);
}

export class CharacterController {
  /**
   * @param {import('./collisionWorld.js').CollisionWorld} world
   * @param {object} sv variáveis sv_* (src/player/movementVars.js), lidas a cada chamada
   */
  constructor(world, sv) {
    this.world = world;
    this.sv = sv;
    this.radius = HULL.radius;
    this.skin = CONTROLLER.skin;
    this.tr = createTrace(); // batidas do tryPlayerMove
    this.trStep = createTrace(); // subir/descer degrau e grudar no chão
    this.trProbe = createTrace(); // encostar no chão (categorizePosition)
    this.trFirst = createTrace(); // primeira varredura do walkMove, reaproveitada no stepMove
    this._planes = Array.from({ length: CONTROLLER.maxClipPlanes }, () => new THREE.Vector3());
    this._lowEdge = new Array(CONTROLLER.maxClipPlanes).fill(false);
    this._end = new THREE.Vector3();
    this._original = new THREE.Vector3();
    this._primal = new THREE.Vector3();
    this._clipped = new THREE.Vector3();
    this._dir = new THREE.Vector3();
    this._pos = new THREE.Vector3();
    this._vel = new THREE.Vector3();
    this._downPos = new THREE.Vector3();
    this._downVel = new THREE.Vector3();
    this._probe = new THREE.Vector3();
    this._alt = new THREE.Vector3();
    // Lugar livre "com chão" para a busca de espaço livre (criado uma vez: nada aloca por tick).
    this._hasGround = (p) => this.support(
      p.x, p.z, p.y - CONTROLLER.unstuckGroundDepth, p.y + CONTROLLER.supportTolerance,
    );
    // Chão da base chata achado pela última consulta (altura da superfície, normal para cima, material).
    this.ground = { height: 0, normal: new THREE.Vector3(0, 1, 0), surface: 0 };
    // Último contato que cortou a velocidade (ponto e normal): o r_colisao desenha a normal.
    this.lastContact = { point: new THREE.Vector3(), normal: new THREE.Vector3(), valid: false };
  }

  /** TracePlayerBBox: varre a cápsula do estado `s` (altura atual) de `from` até `to`. */
  trace(from, to, s, out) {
    return this.world.sweepCapsule(
      from.x, from.y, from.z, to.x - from.x, to.y - from.y, to.z - from.z, this.radius, s.height, out, this.skin,
    );
  }

  /** A cápsula de altura `height` cabe com os pés em (x, y, z)? */
  fits(x, y, z, height) {
    return this.world.canOccupy(x, y, z, this.radius, height);
  }

  /**
   * Chão da base chata para pés em (x, z) entre as alturas `minFeet` e `maxFeet`: a face andável mais alta coberta
   * pelo disco dos pés (os pés param a uma folga acima dela). Resultado em `this.ground`.
   */
  support(x, z, minFeet, maxFeet) {
    return this.world.supportBelow(
      x, z, HULL.footRadius, minFeet - this.skin, maxFeet - this.skin, CONTROLLER.walkableNormalY, this.ground,
    );
  }

  /**
   * Tira a cápsula de penetrações (corpo em movimento, arredondamento, saída do noclip): desempenetra; se não
   * resolver, procura espaço livre a partir da posição original. Empurrão grande para um lugar sem chão (noclip
   * desligado no meio de uma parede de fora do set) perde para um lugar livre com chão perto. false = continua presa.
   */
  resolvePenetration(s) {
    const probe = this._probe.copy(s.origin);
    const r = this.radius, h = s.height, skin = this.skin;
    if (this.world.depenetrate(probe, r, h, skin)) {
      if (probe.distanceToSquared(s.origin) > CONTROLLER.unstuckPreferGround ** 2 && !this._hasGround(probe)) {
        this._alt.copy(s.origin);
        if (this.world.findFreeSpot(this._alt, r, h, skin, this._hasGround)) probe.copy(this._alt);
      }
      s.origin.copy(probe);
      return true;
    }
    if (this.world.findFreeSpot(probe.copy(s.origin), r, h, skin, this._hasGround)
      || this.world.findFreeSpot(probe.copy(s.origin), r, h, skin)) {
      s.origin.copy(probe);
      return true;
    }
    return false;
  }

  /** SetGroundEntity: liga o chão `ground` ({normal, superfície}; zera a velocidade vertical) ou desliga (null). */
  setGround(s, ground) {
    if (!ground) {
      s.onGround = false;
      return;
    }
    s.onGround = true;
    s.groundNormal.copy(ground.normal);
    s.groundSurface = ground.surface;
    s.surfaceFriction = SURFACES[ground.surface].friction;
    s.velocity.y = 0;
  }

  /** Leva os pés na vertical até `y` se a cápsula passar (encostar no chão, degrau, pouso na beirada). */
  #moveVertical(s, y, tr) {
    const o = s.origin;
    if (Math.abs(y - o.y) <= CONTROLLER.snapMin) return true;
    this._end.set(o.x, y, o.z);
    this.trace(o, this._end, s, tr);
    if (tr.startSolid || Math.abs(tr.endpos.y - y) > CONTROLLER.supportTolerance) return false;
    o.y = tr.endpos.y;
    return true;
  }

  /**
   * CategorizePosition: está no chão? Chão da base chata até 2 u abaixo dos pés, ou atravessado pela base de cima
   * para baixo durante o tick (`startY`: pés no começo do tick — pouso na beirada). Subindo rápido nunca está.
   */
  categorizePosition(s, startY = s.origin.y) {
    s.surfaceFriction = 1;
    const vy = s.velocity.y;
    if (vy > CONTROLLER.nonJumpVelocity) {
      this.setGround(s, null);
      return;
    }
    const o = s.origin;
    const top = Math.max(o.y, startY) + CONTROLLER.supportTolerance;
    if (this.support(o.x, o.z, o.y - CONTROLLER.groundProbe, top)
      && this.#moveVertical(s, this.ground.height + this.skin, this.trProbe)) {
      this.setGround(s, this.ground);
      return;
    }
    this.setGround(s, null);
    if (vy > 0) s.surfaceFriction = CONTROLLER.steepSlideFriction;
  }

  /**
   * TryPlayerMove: desliza pelo tempo `dt` em até 4 batidas, cortando a velocidade contra até 5 planos; em quina de
   * dois planos segue pelo vinco; velocidade contrária à original para seco (sem tremer em quina inclinada).
   * `firstDest`/`firstTrace`: a primeira varredura já feita pelo walkMove.
   */
  tryPlayerMove(s, dt, firstDest = null, firstTrace = null) {
    const planes = this._planes;
    const original = this._original.copy(s.velocity);
    const primal = this._primal.copy(s.velocity);
    const clipped = this._clipped;
    const tr = this.tr;
    const walkable = CONTROLLER.walkableNormalY;
    let numPlanes = 0;
    let allFraction = 0;
    let timeLeft = dt;
    // Planos de quina pegos pelo redondo de baixo (normal subindo, diferente da face): cortados pelo clipLowEdge — a
    // quina fica acima dos pés, onde a base chata bateria na lateral. Degrau fica com o stepMove, pouso na beirada com
    // o categorizePosition; rampa (contato de face) continua empurrando para cima como no Source.
    const lowEdge = this._lowEdge;
    for (let bump = 0; bump < CONTROLLER.maxBumps; bump++) {
      if (s.velocity.lengthSq() === 0) break;
      const end = this._end.copy(s.origin).addScaledVector(s.velocity, timeLeft);
      if (bump === 0 && firstTrace && firstDest && end.equals(firstDest)) copyTrace(firstTrace, tr);
      else this.trace(s.origin, end, s, tr);
      allFraction += tr.fraction;
      if (tr.startSolid) {
        // Preso dentro de algo (corpo em movimento): para aqui; a desempenetração do próximo tick resolve.
        s.velocity.set(0, 0, 0);
        return;
      }
      if (tr.fraction > 0) {
        s.origin.copy(tr.endpos);
        original.copy(s.velocity);
        numPlanes = 0;
      }
      if (tr.fraction === 1) break;
      timeLeft -= timeLeft * tr.fraction;
      if (numPlanes >= CONTROLLER.maxClipPlanes) {
        s.velocity.set(0, 0, 0);
        break;
      }
      lowEdge[numPlanes] = tr.normal.y > 0 && tr.normal.dot(tr.faceNormal) < CONTROLLER.edgeContactDot;
      planes[numPlanes++].copy(tr.normal);
      this.#noteContact(tr);
      if (numPlanes === 1 && !s.onGround) {
        // No ar, contra um plano só: o chão corta seco; a parede pode quicar (sv_bounce).
        const overbounce = planes[0].y > walkable ? 1 : 1 + this.sv.bounce * (1 - s.surfaceFriction);
        if (lowEdge[0]) clipLowEdge(original, planes[0], clipped, overbounce);
        else clipVelocity(original, planes[0], clipped, overbounce);
        s.velocity.copy(clipped);
        original.copy(clipped);
        continue;
      }
      let i = 0;
      for (; i < numPlanes; i++) {
        if (lowEdge[i]) clipLowEdge(original, planes[i], s.velocity, 1);
        else clipVelocity(original, planes[i], s.velocity, 1);
        let j = 0;
        for (; j < numPlanes; j++) if (j !== i && s.velocity.dot(planes[j]) < 0) break;
        if (j === numPlanes) break;
      }
      if (i === numPlanes) {
        // Nenhum plano sozinho resolve: segue pelo vinco dos dois (com três ou mais, para).
        if (numPlanes !== 2) {
          s.velocity.set(0, 0, 0);
          break;
        }
        const dir = this._dir.crossVectors(planes[0], planes[1]);
        if (dir.lengthSq() < 1e-12) {
          s.velocity.set(0, 0, 0);
          break;
        }
        dir.normalize();
        s.velocity.copy(dir).multiplyScalar(dir.dot(s.velocity));
        // Vinco com quina baixa também não levanta a cápsula.
        const lift = Math.max(original.y, 0);
        if ((lowEdge[0] || lowEdge[1]) && s.velocity.y > lift) s.velocity.y = lift;
      }
      if (s.velocity.dot(primal) <= 0) {
        s.velocity.set(0, 0, 0);
        break;
      }
    }
    if (allFraction === 0) s.velocity.set(0, 0, 0);
  }

  #noteContact(tr) {
    const c = this.lastContact;
    c.point.copy(tr.point);
    c.normal.copy(tr.normal);
    c.valid = true;
  }

  /**
   * StepMove: compara deslizar direto com "subir um degrau (sv_stepsize), deslizar e descer até o chão da base chata"
   * e fica com o que andou mais no plano. Degrau de verdade (não rampa) vira deslocamento da câmera para suavizar.
   */
  stepMove(s, dt, dest, firstTrace) {
    const pos = this._pos.copy(s.origin);
    const vel = this._vel.copy(s.velocity);
    // 1) Deslizar direto.
    this.tryPlayerMove(s, dt, dest, firstTrace);
    const downPos = this._downPos.copy(s.origin);
    const downVel = this._downVel.copy(s.velocity);
    // 2) Subir um degrau.
    s.origin.copy(pos);
    s.velocity.copy(vel);
    this._end.copy(s.origin);
    this._end.y += this.sv.stepsize + this.skin;
    const tr = this.trace(s.origin, this._end, s, this.trStep);
    if (!tr.startSolid) s.origin.copy(tr.endpos);
    // 3) Deslizar lá em cima.
    this.tryPlayerMove(s, dt);
    // 4) Descer até o chão coberto pela base — no máximo até a altura de partida, como a descida do Source.
    const tol = CONTROLLER.supportTolerance;
    const found = this.support(s.origin.x, s.origin.z, pos.y - tol, s.origin.y + tol);
    if (!this.#moveVertical(s, found ? this.ground.height + this.skin : pos.y, this.trStep)) {
      // A cápsula não desce até lá (quina íngreme no caminho): vale o deslize direto.
      s.origin.copy(downPos);
      s.velocity.copy(downVel);
      return;
    }
    const downDist = (downPos.x - pos.x) ** 2 + (downPos.z - pos.z) ** 2;
    const upDist = (s.origin.x - pos.x) ** 2 + (s.origin.z - pos.z) ** 2;
    if (downDist > upDist) {
      s.origin.copy(downPos);
      s.velocity.copy(downVel);
      return;
    }
    s.velocity.y = downVel.y;
    this.#viewStep(s, s.origin.y - pos.y, Math.sqrt(upDist), found ? this.ground.normal.y : 1);
  }

  /**
   * StayOnGround: a base chata acompanha o chão que cobre — desce escada e rampa e sobe degrau baixo e rampa (até
   * sv_stepsize para cada lado), se a cápsula passar.
   */
  stayOnGround(s, horizontalMove) {
    const o = s.origin;
    const step = this.sv.stepsize;
    if (!this.support(o.x, o.z, o.y - step, o.y + step)) return;
    const y = this.ground.height + this.skin;
    const dy = y - o.y;
    if (Math.abs(dy) <= CONTROLLER.snapMin) return;
    if (this.#moveVertical(s, y, this.trStep)) this.#viewStep(s, dy, horizontalMove, this.ground.normal.y);
  }

  /**
   * Subida/descida brusca (degrau) vira deslocamento da câmera; rampa não: a variação de altura que a inclinação do
   * chão explica pelo deslocamento no plano é contínua.
   */
  #viewStep(s, dy, horizontal, groundNy) {
    const slope = groundNy > 1e-6 ? Math.sqrt(Math.max(0, 1 - groundNy * groundNy)) / groundNy : 0;
    if (Math.abs(dy) > horizontal * slope + CONTROLLER.discreteStepTolerance) s.viewOffset -= dy;
  }

  /** CheckVelocity: troca NaN por 0 e limita cada eixo a sv_maxvelocity. */
  checkVelocity(s) {
    const max = this.sv.maxvelocity;
    const v = s.velocity;
    v.x = Number.isFinite(v.x) ? Math.max(-max, Math.min(max, v.x)) : 0;
    v.y = Number.isFinite(v.y) ? Math.max(-max, Math.min(max, v.y)) : 0;
    v.z = Number.isFinite(v.z) ? Math.max(-max, Math.min(max, v.z)) : 0;
  }
}
