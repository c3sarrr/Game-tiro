> Notas de pesquisa da subfase 3.2 (inaccuracy de arma do CS:GO), em inglês como vieram das fontes. As decisões e os
> números adotados no MASSACRE estão em `docs/phases/phase-3.md`, seção 3.2; os dados por arma viram `src/data/inaccuracy.js`.

# CS:GO (2012–2023) weapon inaccuracy: algorithm, constants, per-weapon data

This covers **CS:GO, not CS2**, and is written for a 64 Hz JavaScript reimplementation using pure functions.

Files in this folder:
- `csgo-weapon-accuracy.json`: per-weapon attributes, resolved through the prefabs, as raw numbers.
- `csgo-weapon-accuracy.provenance.json`: the prefab or item each value came from.
- `parse_items_game.js`: KeyValues parser plus Valve's prefab-merge rules. Run it with `node parse_items_game.js`.
- `csgo_inaccuracy_ref.js`: a runnable version of the pseudocode below. It printed the test vectors in §9.
- `crosscheck_sheet.js`: compares the JSON against an independent community spreadsheet (§8).
- `bisect.sh` and `bisect2.sh` with `commits.txt` and `scommits.txt`: date when attributes and cvars first appeared in the GameTracking history.
- `items_game.txt`, `server_client_strings.txt`, `sheet.csv`, `src/`: the downloaded inputs.

## 0. Confidence tags

| Tag | Meaning |
|---|---|
| **[CODE]** | Read in the CS:GO game code as published in the Kisak-Strike port of the 2020-leaked CS:GO source. That code is a snapshot from about mid-2017 (see §5). I paraphrase it here and do not copy it. |
| **[DATA]** | Read in the final CS:GO `items_game.txt` (2023). |
| **[BIN]** | The attribute name or cvar string is present in the final CS:GO server binary's string dump (2023). |
| **[SHEET]** | Matches an independent community spreadsheet numerically (§8). |
| **[INFERRED]** | Deduced from indirect evidence. **Not verified in code.** |
| **[UNVERIFIED]** | Could not be confirmed. |

## 1. Sources (URLs)

- **items_game.txt, final CS:GO version.** <https://raw.githubusercontent.com/SteamTracking/GameTracking-CS2/64b7772ba263a87083c3979c769c5919aae78337/csgo/scripts/items/items_game.txt>
  - The repo `SteamDatabase/GameTracking-CSGO` has been renamed `SteamTracking/GameTracking-CS2`; GitHub redirects the old name.
  - Commit `64b7772` is dated 2023-05-31 and labelled "CSGO: 1568". It is the last change to that path. The next commit touching it, `9083300` (2023-08-21), deleted the whole CS:GO tree.
  - The last CS:GO server build tracked, 1569 (`d80b24a`, 2023-06-06), did not change items_game.
- **Final server string dump.** Same commit, `csgo/bin/linux64/server_client_strings.txt`.
  - I bisected the history of this file to date the later cvars (§5).
- **Game code.** <https://github.com/SwagSoftware/Kisak-Strike> (derived from the leaked source):
  - `game/shared/cstrike15/weapon_csbase.cpp`
    - `GetInaccuracy` about L1210–1286
    - `UpdateAccuracyPenalty` L3690–3757
    - `GetRecoveryTime` L3759–3808
    - `OnJump`/`OnLand` L3811–3835
    - cvars L85–113, including `#define MOVEMENT_CURVE01_EXPONENT 0.25` at L23
    - `Deploy` reset L1571
  - `game/shared/cstrike15/weapon_csbasegun.cpp`
    - fire penalty L760
    - zoom/burst mode switching L346–420, L530–600
  - `game/shared/cstrike15/cs_weapon_parse.h` L240–250: the getters for spread and inaccuracy default to `flScale = 0.001`.
  - `game/shared/cstrike15/cs_weapon_parse.cpp` L1134–1223: attribute getters. An `" alt"` suffix is used when `nAlt != 0`.
  - `game/shared/cstrike15/fx_cs_shared.cpp` L415–480: how spread and inaccuracy are sampled per shot.
  - `game/shared/cstrike15/cs_player_shared.cpp` L1192: the bullet direction.
  - `game/shared/cstrike15/cs_shareddefs.cpp` L21–23: speed modifiers.
  - `game/shared/cstrike15/cs_gamemovement.cpp`
    - L49 `sv_jump_impulse`
    - L219–249 walk flag
    - L1124–1175 `FL_DUCKING`
    - L1243 `OnLand`
  - `game/shared/gamemovement.cpp` L4337–4416 `CheckFalling`, L5053–5056 fall velocity.
  - `game/server/player_command.cpp` L428–470: command order is PreThink, then movement, then PostThink/ItemPostFrame.
  - `game/shared/econ/econ_item_schema.cpp` L4661–4798: prefab merge.
- **Valve, 2016 in-air model ("air-time").** <https://blog.counter-strike.net/index.php/2016/09/air-time/>
  - HLTV coverage of the beta: <https://www.hltv.org/news/18756/beta-update-tackles-jumping-inacc>
- **Valve release notes 4/10/2020.** <https://blog.counter-strike.net/index.php/2020/04/29649>
- **Release notes 4/16/2020** ("Added a new weapon parameter 'inaccuracy jump apex', set to 331.55 for the Deagle").
  - Mirror: <https://csgo.com/news/38066-csgo-update-release-notes-for-4162020/>
  - Coverage: <https://www.dexerto.com/csgo/csgo-april-16-patch-nerfs-deagle-adds-warmup-mode-more-1354496/>
- **Community spreadsheet used for the cross-check.** <https://docs.google.com/spreadsheets/d/11tDzUNBq9zIX6_9Rel__fdAUezAQzSnh5AVYzCP060c>
  - Linked from <https://counterstrike.fandom.com/wiki/Inaccuracy>.
- **Fandom infoboxes** for running speed and rate of fire: <https://counterstrike.fandom.com/wiki/AK-47>, `/Desert_Eagle`, `/SSG_08`.
- **`weapon_accuracy_reset_on_deploy` default** (CS2 page): <https://totalcsgo.com/commands/weaponaccuracyresetondeploy>
- **Secondary note** that "jump inaccuracy" sheets add the apex term: <https://github.com/sidcarrollworks/CSGODOT/pull/59>

## 2. Units and modes

- **Inaccuracy and spread units.** The getters multiply the `items_game` numbers by 0.001 **[CODE]**. The result is a tangent-plane radius (about radians).
  - AK "inaccuracy stand" 6.41 becomes 0.00641, about 0.37°.
  - Speeds are in units per second.
  - Times are in seconds.
- **"alt" is the weapon's Secondary mode** (`m_weaponMode == Secondary_Mode`) **[CODE]**:
  - **Scoped weapons** (AUG, SG 553, SSG 08, AWP, SCAR-20, G3SG1): alt = zoomed, at any zoom level of 1 or more. Unzooming, including the automatic unzoom after a bolt-action shot, returns to primary.
  - **USP-S and M4A1-S: alt = silencer ON.** That is the default state: on spawn the mode is set to Secondary if the weapon has a silencer. The mode switches when the attach/detach animation completes.
    - The sheet's "(silencer)" rows use the alt values [SHEET].
  - **Glock-18 and FAMAS**: alt = burst mode.
  - **R8**: alt = secondary fire (not in this list).
  - **All other weapons stay in primary mode.** Their `* alt` values are leftovers the game never uses, except through the ladder quirk in §3. Examples: M4A4, Galil, P250, Five-SeveN, Deagle, Negev.
- **Mode-dependent getters**: stand, crouch, move, jump, land, ladder, fire, spread, and max player speed.
- **Primary value only** (called without the mode) **[CODE]**:
  - jump initial
  - reload
  - the recovery times (initial and final)
  - the transition bullets
  - jump apex [INFERRED]

## 3. The algorithm (paraphrased pseudocode, JS-like)

**Per-weapon state**:
- `penalty` (`m_fAccuracyPenalty`, persistent)
- `recoilIndex` (a float, +1 per shot)
- `lastShotTime`
- `alt` (the weapon mode)

**Per-player inputs**:
- velocity
- `onGround` (ground entity is not null)
- `onLadder` (`MOVETYPE_LADDER`)
- `ducking` (`FL_DUCKING`)
- `walking` (`m_bIsWalking`)
- `reloading`

**Order within one tick** (one user command) **[CODE]**:
1. **Movement.** This may call `onLand(fallSpeed)`.
2. **Weapon `ItemPostFrame`** (or `ItemBusyFrame` while the weapon cannot attack). It first calls `updateAccuracyPenalty()`. Then, if it fires, the bullets use `getInaccuracy()` and `getSpread()` **before** the fire penalty is added. After the shot: `penalty += fire`, `recoilIndex += 1`, `lastShotTime = now`.

```js
const S = 0.001, TICK = 1/64, LN10 = Math.log(10);
const DUCK_MOD = 0.34;                // CS_PLAYER_SPEED_DUCK_MODIFIER (also the crouch-walk speed factor)
const MOVE_EXP = 0.25;                // #define MOVEMENT_CURVE01_EXPONENT (no cvar). MOVEMENT_WALK_CURVE01_EXPONENT 0.85 exists but is unused.
const JUMP_IMPULSE = 301.993377;      // cvar sv_jump_impulse
const AIR_SCALE = 1.0;                // cvar weapon_air_spread_scale (0..1)

// A(w, name, alt): use "<name> alt" when in alt mode, else "<name>"

function getInaccuracy(w, st) {                       // CWeaponCSBase::GetInaccuracy
  if (weapon_accuracy_nospread) return 0;
  const maxSpeed = A(w, 'max player speed', st.alt); // the weapon's GetMaxSpeed() for the current mode:
                                                      // "max player speed alt" while scoped. It is NOT the player's
                                                      // current cap (walk/crouch/tagging do not change it).
  let acc = st.penalty;
  // 1) Horizontal movement. Instantaneous: it is never stored in the penalty.
  let m = remapClamped(len2D(st.vel), maxSpeed*DUCK_MOD, maxSpeed*0.95, 0, 1);
  if (m > 0) {
    if (!st.walking) m = Math.pow(m, MOVE_EXP);       // the power curve is skipped while walking (+speed)
    acc += m * A(w,'inaccuracy move',st.alt) * S;
  }
  // 2) Vertical speed while airborne (ground entity == null). Best at the apex.
  if (!st.onGround) {
    const initial = w['inaccuracy jump initial'] * S * AIR_SCALE;          // primary value
    const sq = Math.sqrt(JUMP_IMPULSE);
    let air = remap(Math.sqrt(Math.abs(st.vel.z)), 0.25*sq, sq, 0, initial);  // RemapVal, NOT clamped
    air = clamp(air, 0, 2 * initial);                                        // kMaxFallingPenalty = 2
    acc += air;
    // Final CS:GO (2020-04-16+), INFERRED, matters only for the Deagle: see §5.1
    //   air = clamp(remap(sqrt|vz|, 0.25*sq, sq, APEX, initial), APEX, 2*initial), APEX = "inaccuracy jump apex"*S*AIR_SCALE
  }
  return Math.min(acc, 1.0);
}

function baselinePenalty(w, st) {                     // "fNewPenalty" in UpdateAccuracyPenalty
  let p;
  if (st.onLadder)       p = A(w,'inaccuracy ladder',st.alt) + w['inaccuracy ladder'];   // mode + PRIMARY
  else if (!st.onGround) p = A(w,'inaccuracy stand',st.alt) + A(w,'inaccuracy jump',st.alt) * AIR_SCALE;
  else if (st.ducking)   p = A(w,'inaccuracy crouch',st.alt);   // FL_DUCKING: set when the duck finishes (duck amount
                                                                // reaches 1; instantly if airborne), cleared when
                                                                // un-ducking passes duck amount <= 0.75
  else                   p = A(w,'inaccuracy stand',st.alt);
  if (st.reloading) p += w['inaccuracy reload'];                // primary value; 0 for every CS:GO weapon
  return p * S;
}

function recoveryTime(w, st) {                        // CWeaponCSBase::GetRecoveryTime (no alt variants used)
  if (st.onLadder)  return w['recovery time stand'];
  if (!st.onGround) return w['recovery time crouch'] * 4;       // "400% penalty" in the air (!FL_ONGROUND)
  const [t0, t1] = st.ducking ? [w['recovery time crouch'], w['recovery time crouch final']]
                              : [w['recovery time stand'],  w['recovery time stand final']];
  if (t1 === -1) return t0;                           // weapon_base sets the *final values to -1 = "unset"
  return remapClamped(Math.trunc(st.recoilIndex),
                      w['recovery transition start bullet'], w['recovery transition end bullet'], t0, t1);
}

function updateAccuracyPenalty(w, st, now) {          // every tick while the weapon is held
  const target = baselinePenalty(w, st);
  let penalty = st.penalty;
  if (target > penalty) penalty = target;             // rises instantly
  else {                                              // falls exponentially: 10x per recoveryTime seconds
    const decay = LN10 / recoveryTime(w, st);
    penalty = lerp(Math.exp(-TICK * decay), target, penalty);   // = target + (penalty - target) * e^(-TICK*decay)
  }
  let ri = st.recoilIndex;                            // the recoil index decays only once not firing
  if (now > st.lastShotTime + w['cycletime'] * 1.10)            // WEAPON_RECOIL_DECAY_THRESHOLD, primary cycletime
    ri = lerp(Math.exp(-TICK * LN10 * weapon_recoil_decay_coefficient /*2.0*/), 0, ri);   // 10x per 0.5 s
  return { penalty, recoilIndex: ri };
}

function onJump() {}                                  // CWeaponCSBase::OnJump is EMPTY: no impulse on take-off

function onLand(w, st, fallSpeed) {                   // fallSpeed = m_flFallVelocity = -vel.z of the last airborne
  return { penalty: st.penalty                        // tick, in u/s, NOT normalized (a flat jump gives ~302)
           + A(w,'inaccuracy land',st.alt) * S * fallSpeed };
  // CheckFalling calls it for any touchdown with fallSpeed > 0. It also kicks the aim punch:
  // pitch += deg(asin(clamp(landPenalty,-1,1))) * 0.2, and yaw gets a random +-10% of that.
}

function onFire(w, st, now) {                         // after FX_FireBullets(getInaccuracy(), getSpread())
  return { penalty: st.penalty + A(w,'inaccuracy fire',st.alt) * S,
           recoilIndex: st.recoilIndex + 1, lastShotTime: now };
}

function onDeploy(st) { return { ...st, penalty: 0, recoilIndex: 0 }; }   // 2017 code: always. Final: see §5.3
```

Helpers from Source mathlib:
- `remap(v,a,b,c,d) = c + (d-c)*(v-a)/(b-a)`
- `remapClamped` is the same with `(v-a)/(b-a)` clamped to [0,1]. When `a == b` it returns `v >= b ? d : c`.
- `lerp(t,a,b) = a + (b-a)*t`

**Notes that follow from the code**:
- **Running.** Movement costs nothing up to 34% of the weapon's max speed. That is exactly full crouch-walking speed. With the 0.25 power curve the cost rises very steeply above that, and it is capped at 95% of max speed.
  - Walking uses a linear ramp instead. `m_bIsWalking` is set while +speed is held, you are not ducking, and the current speed is below 0.52·maxSpeed + 25. It is cleared when +speed is released or you duck. If +speed is held but you are faster than that, it keeps its previous value.
- **In the air** the stored penalty rises instantly to `stand + jump`, the air baseline. `onJump` itself adds nothing.
  - The vertical-speed term is added on top.
  - Its "free" window is |vz| < 0.0625·302 = 18.9 u/s. With `sv_gravity` 800 that is ±23.6 ms around the apex.
  - The 2x cap is reached at |vz| ≈ 925 u/s.
  - For a flat jump: apex after 0.377 s at 57 u height, landing speed about 302 u/s.
- **After landing**, `penalty = stand + jump + land·fallSpeed`. It then decays toward stand (or crouch) with the ground recovery time.
- **Scoping in** drops the baseline, e.g. the AWP goes from 80.8 to 2. The penalty therefore decays over about the recovery time instead of snapping. That is why snipers need a moment after scoping.
  - Unscoping raises the baseline instantly.
  - Zooming in also adds a weapon-script value "InaccuracyAltSwitch" (m_fInaccuracyAltSwitch, read from the old weapon scripts). It is not an items_game attribute. I assume it is effectively 0 in the final game **[UNVERIFIED]**.
- **The ladder baseline** is `ladder(current mode) + ladder(primary)`, so twice the primary value for single-mode weapons.
  - The community sheet assumes `2 × ladder(mode)`. The two differ only for the USP-S (silenced) and the Glock (burst) (§8).

## 4. Constants and cvars (defaults)

| Name | Default | Kind | Effect on the above |
|---|---|---|---|
| attribute scale for spread and inaccuracy | 0.001 | code | multiplies every `items_game` inaccuracy and spread value **[CODE]** |
| `CS_PLAYER_SPEED_DUCK_MODIFIER` | 0.34 | const | lower threshold of the movement ramp, and crouch speed **[CODE]** |
| movement ramp top | 0.95 × maxSpeed | literal | **[CODE]** |
| `MOVEMENT_CURVE01_EXPONENT` | 0.25 | `#define` | pow() on the move ramp when not walking. No cvar exists (none in the final binary either) **[CODE][BIN]** |
| `MP_WEAPON_ACCURACY_SEPARATE_WALK_FUNCTION` | true | `#define` | enables the walking exception **[CODE]** |
| `CS_PLAYER_SPEED_WALK_MODIFIER` | 0.52 | const | walk speed = 0.52 × max speed **[CODE]** |
| `sv_jump_impulse` | 301.993377 | cvar | jump speed; air-term reference **[CODE][BIN]** |
| `sv_gravity` | 800 | cvar | CS:GO default (physics only) |
| `weapon_air_spread_scale` | 1.0 (range 0–1) | cvar | scales both "jump initial" and "jump" **[CODE][BIN]** |
| kMaxFallingPenalty | 2.0 | literal | cap on the air term = 2 × initial **[CODE]** |
| air recovery multiplier | 4.0 | literal | recovery time in air = crouch recovery × 4 **[CODE]** |
| decay law | ln(10)/T per second | code | the excess penalty drops 10x every T seconds **[CODE]** |
| `weapon_recoil_decay_coefficient` | 2.0 | cvar | recoil index decays 10x per 1/2.0 = 0.5 s after `cycletime × 1.10` without a shot. This matters because the index drives the recovery-time transition **[CODE][BIN]** |
| `WEAPON_RECOIL_DECAY_THRESHOLD` | 1.10 | `#define` | see above **[CODE]** |
| `weapon_accuracy_nospread` | 0 | cvar | 1 makes `GetInaccuracy` return 0. In the snapshot code spread is still applied **[CODE][BIN]** |
| inaccuracy clamp | 1.0 | literal | in `GetInaccuracy`, and again in `FX_FireBullets` **[CODE]** |
| `TICK_INTERVAL` | 1/64 | engine | per-tick decay factor, e.g. `10^(-TICK/0.368)` = 0.906861 for the AK standing |

Recoil-only cvars (they do not affect inaccuracy), all **[CODE]** and all present in the final binary **[BIN]**:
- `weapon_recoil_scale` 2.0
- `weapon_recoil_decay1_exp` 3.5
- `weapon_recoil_decay2_exp` 8
- `weapon_recoil_decay2_lin` 18
- `weapon_recoil_vel_decay` 4.5
- `weapon_recoil_suppression_shots` 4
- `weapon_recoil_suppression_factor` 0.75
- `weapon_recoil_variance` 0.55
- `weapon_recoil_view_punch_extra` 0.055
- `weapon_recoil_cooldown` 0.55 (deprecated)

## 5. Changes after the code snapshot (final CS:GO)

**Dating the snapshot.** I grepped all 460 `game/shared`, `game/shared/cstrike15` and `game/server/cstrike15` sources of the port. None of the strings below from 2017-09-27 onward is present. The snapshot does contain "inaccuracy jump initial" (2017-06-21) and the recoil-suppression cvars. So the code is roughly a mid-2017 snapshot.

I dated the later strings by bisecting the history of `server_client_strings.txt` (script `bisect2.sh`):

| Added (build, date) | String | Impact |
|---|---|---|
| 1.35.9.0, 2017-06-21 | attribute `inaccuracy jump initial` | already in the snapshot code |
| 1.36.0.6, 2017-09-27 | `weapon_accuracy_forcespread` ("Force spread to the specified value.") | debug only |
| 1.36.1.8, 2017-12-20 | `weapon_accuracy_shotgun_spread_patterns` | spread only (shotgun pellets); default **[UNVERIFIED]** |
| 1.36.6.2, 2018-12-06 | `sv_turning_inaccuracy_enabled/_decay/_angle_min` | an experiment; default **[UNVERIFIED]**, believed off (its CS2 counterpart is reported disabled) |
| 1.37.4.7, 2020-04-10 | `weapon_accuracy_reset_on_deploy` ("On deploy, forcibly reset weapon accuracy to zero.") | §5.3 |
| 1.37.4.8, 2020-04-16 | attribute `inaccuracy jump apex` (+ `alt`) | §5.1 |

### 5.1 "inaccuracy jump apex" (Deagle only: 331.55; every other weapon inherits 0)

The attribute is **[DATA][BIN]**. The patch note only says "Added a new weapon parameter 'inaccuracy jump apex', set to 331.55 for the Deagle".

**The Deagle's retuning, from items_game history** (bisected with `bisect.sh`):

| Build | jump initial | jump | land | apex |
|---|---|---|---|---|
| ≤ 2020-03-31 | 217.27 | 371.55 | 0.73 | — |
| 2020-04-10 (buff) | 100.27 | 40.55 | 0.043 | — |
| 2020-04-16 (nerf) | 548.82 | 40.55 | 0.043 | 331.55 |

The arithmetic: 548.82 − 331.55 = **217.27**, exactly the pre-buff initial value, and 331.55 + 40.55 ≈ 371.55 + 0.55.

This only works if the air term is `remap(√|vz|, 0.25√impulse, √impulse, apex, initial)`, a line from **apex** (near the top) to **initial** (at jump speed). With that form, the total airborne inaccuracy (stand + jump + air term) reproduces the pre-buff curve almost exactly at every vertical speed, while landing keeps the buffed land 0.043 and jump 40.55 values. The alternatives do not fit:
- An additive term would give 880 at take-off.
- `max(old term, apex)` would give 372 instead of 480 at mid-rise.

The community sheet's "Inaccuracy at Jump Apex" for the Deagle is 378.30 = 4.2 + 40.55 + 331.55 + 2 (stand + jump + apex + spread) **[SHEET]**, which is consistent.

**[INFERRED] What is not known**:
- the exact lower clamp near the apex. I use `apex`. With `0`, the value could dip to about 259 when |vz| is below 18.9 u/s.
- whether the 2 × initial cap still applies.

For every weapon except the Deagle, apex = 0 and the formula reduces exactly to the verified 2017 code.

### 5.2 OnJump

`OnJump` is a no-op in the code. "inaccuracy jump" is not an impulse. It is part of the in-air baseline, re-applied every airborne tick **[CODE]**. The 2016 Valve post says the same: accuracy in the air depends on vertical velocity, both up and down, and is "always worse than when standing still on the ground".

### 5.3 Deploy reset

The 2017 code zeroes `penalty` and `recoilIndex` in `Deploy()`. In the final game this is gated by `weapon_accuracy_reset_on_deploy`:
- CS2 default: 0 (totalcsgo).
- CS:GO default: **[UNVERIFIED]**.

In practice this changes little. `UpdateAccuracyPenalty` runs during the deploy animation (`ItemBusyFrame`), so the old penalty decays before you can shoot.

## 6. Spread vs inaccuracy (one line)

Each shot draws one offset with radius `U·inaccuracy` at a uniform random angle, shared by all pellets, plus a per-pellet offset with radius `U·spread` at another uniform angle. U is uniform on [0,1], not area-uniform, so hits cluster toward the centre. The direction is `normalize(forward + (x0+x1)·right + (y0+y1)·up)`, using the aim angles after aim punch **[CODE]**.

Special cases: the Negev (first 3 shots) and the R8 alt-fire reshape U. The final game adds fixed shotgun patterns (§5).

## 7. Per-weapon data

Raw `items_game` units: multiply inaccuracy and spread by 0.001. "a / b" = primary / alt, shown only for weapons that actually enter alt mode. `rec.` = recovery time, written as initial→final (initial for the first bullets, final after the transition bullets). "trans. bullets" = recovery transition start–end (by `int(recoilIndex)`). "Jump apex" is only non-zero for the Deagle. All other alt values are in the JSON.

| weapon | alt = | max speed | stand | crouch | move | jump initial | jump apex | jump | land | ladder | fire | spread | rec. stand | rec. crouch | trans. bullets | cycletime | auto |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| weapon_knife | — | 250 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 1 | 1 | 0–0 | 0.15 | no |
| weapon_glock | burst | 240 | 5.6 | 4.2 / 3 | 10 / 12.95 | 96.62 | 0 | 87.87 | 0.185 | 137 / 119.25 | 56 / 45 | 2 / 15 | 0.2→0.33 | 0.2→0.33 | 0–5 | 0.15 | no |
| weapon_usp_silencer | silencer ON | 240 | 4.9 | 3.68 | 13.87 | 96.6 | 0 | 94.48 | 0.191 / 0.198 | 138.32 / 119.9 | 71 / 52 | 2.5 / 1.5 | 0.3495 | 0.2913 | 3–10 | 0.17 | no |
| weapon_p250 | — | 240 | 9.1 | 6.83 | 20 | 96.62 | 0 | 92.96 | 0.19 | 138 | 52.45 | 2 | 0.3454 | 0.2878 | 3–10 | 0.15 | no |
| weapon_fiveseven | — | 240 | 9.1 | 6.83 | 40 | 99.88 | 0 | 89.7 | 0.19 | 138 | 25 | 2 | 0.2→0.5 | 0.2→0.5 | 0–5 | 0.15 | no |
| weapon_deagle | — | 230 | 4.2 | 2.18 | 48.1 | 548.82 | 331.55 | 40.55 | 0.043 | 152 | 72.23 | 2 | 0.8112 | 0.4499 | 3–10 | 0.225 | no |
| weapon_mac10 | — | 240 | 13.3 | 9.98 | 13.99 | 34.99 | 0 | 33.3 | 0.069 | 34.26 | 4.76 | 0.6 | 0.3997 | 0.2855 | 2–5 | 0.075 | yes |
| weapon_mp9 | — | 240 | 9 | 5.5 | 29.04 | 37.28 | 0 | 18.43 | 0.056 | 148.9125 | 3.7 | 0.6 | 0.2579 | 0.1842 | 2–5 | 0.07 | yes |
| weapon_ump45 | — | 230 | 13.43 | 10.07 | 28.76 | 47.21 | 0 | 37.25 | 0.085 | 42.35 | 3.42 | 1 | 0.35 | 0.25 | 2–5 | 0.09 | yes |
| weapon_p90 | — | 230 | 13.65 | 10.24 | 31 | 104.6 | 0 | 90.08 | 0.082 | 132.17 | 2.85 | 1 | 0.3721 | 0.2658 | 2–5 | 0.07 | yes |
| weapon_nova | — | 220 | 7 | 5.25 | 36.75 | 109.7 | 0 | 126.31 | 0.236 | 78.75 | 9.72 | 40 | 0.4605 | 0.3289 | 2–5 | 0.88 | no |
| weapon_xm1014 | — | 215 | 7 | 5.25 | 36.03 | 100.38 | 0 | 130.83 | 0.232 | 77.21 | 8.83 | 38 | 0.5066 | 0.3618 | 2–5 | 0.35 | yes |
| weapon_galilar | — | 215 | 8.77 | 6.58 | 123.56 | 105.39 | 0 | 149.78 | 0.256 | 113.58 | 7 | 0.6 | 0.3→0.5 | 0.15→0.47 | 2–5 | 0.09 | yes |
| weapon_famas | burst | 220 | 9.85 / 3.69 | 7.39 / 3.25 | 99.34 | 94.77 | 0 | 110.39 | 0.205 | 118.716 | 6.05 / 3.35 | 0.6 | 0.25→0.5 | 0.12→0.48 | 2–5 | 0.09 | yes |
| weapon_ak47 | — | 215 | 6.41 | 4.81 | 175.06 | 100.94 | 0 | 140.76 | 0.242 | 140 | 7.8 | 0.6 | 0.368→0.506 | 0.3053→0.4197 | 2–5 | 0.1 | yes |
| weapon_m4a1 | — | 225 | 4.9 | 4.1 | 137.88 | 94.41 | 0 | 97.27 | 0.192 | 110.994 | 7 | 0.6 | 0.3389→0.466 | 0.2421→0.3329 | 2–5 | 0.09 | yes |
| weapon_m4a1_silencer | silencer ON | 225 | 4.9 | 4.1 | 92.88 / 122 | 96.77 | 0 | 99.7 | 0.197 | 110.994 / 113.672 | 12 / 7 | 0.6 / 0.5 | 0.3389→0.466 | 0.2421→0.3329 | 2–5 | 0.1 | yes |
| weapon_aug | scoped | 220 / 150 | 4.9 / 3.68 | 3.68 / 3.11 | 135.45 / 105.45 | 101.56 | 0 | 105.99 | 0.208 | 110.04 / 100.04 | 7.29 | 0.5 / 0.3 | 0.4297 | 0.3055 | 2–5 | 0.1 | yes |
| weapon_sg556 | scoped | 210 / 150 | 5.81 / 3.81 | 3.81 / 3.05 | 136.01 | 78.79 | 0 | 109 | 0.188 | 83.66 / 138.758 | 7.95 / 9.2 | 0.6 / 0.3 | 0.4529 | 0.3792 | 2–5 | 0.11 | yes |
| weapon_ssg08 | scoped | 230 | 31.7 / 3 | 23.78 / 2.8 | 123.45 | 208.72 | 0 | 5.72 | 0.215 | 95.49 | 22.92 | 0.28 / 0.23 | 0.1421 | 0.0558 | 2–5 | 1.25 | no |
| weapon_awp | scoped | 200 / 100 | 80.8 / 2 | 60.6 / 1.5 | 176.48 | 172.86 | 0 | 133.83 | 0.307 / 0.1 | 136.5 | 53.85 | 0.2 | 0.3454 | 0.2467 | 2–5 | 1.455 | no |
| weapon_scar20 | scoped | 215 / 120 | 25.8 / 2 | 19.35 / 1.5 | 150.48 | 107.69 | 0 | 153.77 | 0.262 | 116.39 | 18.61 | 0.3 | 0.5443 | 0.3888 | 2–5 | 0.25 | yes |
| weapon_g3sg1 | scoped | 215 / 120 | 25.8 / 2 | 19.35 / 1.5 | 150.48 | 107.69 | 0 | 153.77 | 0.262 | 116.39 | 18.61 | 0.3 | 0.5443 | 0.3888 | 2–5 | 0.25 | yes |
| weapon_negev | — | 150 | 10.17 | 7.63 | 159.14 | 116.29 | 0 | 292.23 | 0.409 | 136.43 | 30 | 2 | 0.3→0.1 | 0.25→0.08 | 9–12 | 0.075 | yes |
| weapon_m249 | — | 195 | 7.7 | 5.34 | 156.25 | 118.27 | 0 | 279.47 | 0.398 | 132.81 | 3.56 | 2 | 0.8289 | 0.5921 | 2–5 | 0.08 | yes |
| weapon_hegrenade | — | 245 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 1 | 1 | 0–0 | 0.15 | no |
| weapon_flashbang | — | 245 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 1 | 1 | 0–0 | 0.15 | no |
| weapon_smokegrenade | — | 245 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 1 | 1 | 0–0 | 0.15 | no |
| weapon_molotov | — | 245 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 1 | 1 | 0–0 | 0.15 | no |
| weapon_incgrenade | — | 245 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 1 | 1 | 0–0 | 0.15 | no |
| weapon_decoy | — | 245 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 1 | 1 | 0–0 | 0.15 | no |
| weapon_c4 | — | 250 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 1 | 1 | 0–0 | 0.15 | no |

**Zoom attributes**:

| weapon | zoom levels | zoom fov 1, 2 | zoom time 0/1/2 | notes |
|---|---|---|---|---|
| AUG, SG 553 | 1 | 45 | 0.06/0.1/0 | |
| SSG 08 | 2 | 40, 15 | 0.05 each | unzoom after shot = 1 |
| AWP | 2 | 40, 10 | 0.05 each | unzoom after shot = 1 |
| SCAR-20, G3SG1 | 2 | 40, 15 | 0.05 each | |

"cycletime when zoomed" is absent for all of them. `has silencer` = 1 only for the USP-S and M4A1-S. `bullets` (pellets) is 9 for the Nova and 6 for the XM1014.

**How the JSON was produced**: `parse_items_game.js` reproduces Valve's `InheritKeyValuesRTLMulti` and `RecursiveInheritKeyValues`:
- For "prefab" "a b c", the right-most parent has priority over the ones to its left. The instance always wins.
- Duplicate sub-blocks merge in order. This matters: the `secondary` prefab has two `attributes` blocks, and the second one supplies the pistols' transition bullets 3/10 and the default jump values.
- Key lookups are case-insensitive.
- The weapons' chains are single-parent, for example:
  - `weapon_ak47_prefab → rifle → primary → weapon_base → statted_item_base`
  - `weapon_knife` item → `melee`
  - grenades → `grenade` / `explosive_grenade` / `weapon_fire_grenade_prefab`
  - `weapon_c4` → `c4`

**Schema defaults to keep in mind**:
- **`statted_item_base`** gives every item every attribute: zeros, "recovery time" 1, "max player speed" 1, zoom fov 90, cycletime 0.15.
- **`weapon_base`** sets "recovery time * final" = −1, meaning unset.
- **Knife, grenades and C4** keep these defaults, so their inaccuracy is 0 and their 0.15 cycletime is unused.
- **"inaccuracy reload"** is 0 for every weapon.
- **Harmless duplicate**: `weapon_m4a1_silencer_prefab` lists "addon scale" twice (a cosmetic value, not used for accuracy).

## 8. Cross-check against an independent source

**The community spreadsheet** (§1, apparently post-April-2020: SG 553 at 545 RPM, Deagle apex included, M4A1-S with 20 rounds) publishes derived columns in the same ×1000 units. `crosscheck_sheet.js` recomputes each column from the JSON:

| Sheet column | Recomputed from the JSON as |
|---|---|
| standing | stand + spread |
| crouching | crouch + spread |
| running | move + stand + spread |
| ladder | 2·ladder + spread |
| at jump apex | stand + jump + apex + spread |
| from firing | fire |
| recovery | recovery times |
| max speed | max speed |

**Result: 275 values compared, 269 identical (within 0.011).** The 6 mismatches:
- **FAMAS** (4 values). The sheet's stand is 7.59 and crouch 5.50. The game data has had 9.85 / 7.39 unchanged since at least 2018 (checked in 2018-08, 2019-08, 2019-12, 2020-04, 2020-12, 2021-09 and the final file).
- **MP9** (2 values). The sheet's crouch is 8.0 and jump 50.0. The game has had 5.5 / 18.43 since at least 2019-12.

Both look like sheet errors.

**The sheet's "Inaccuracy After Landing" column** is reproduced for every weapon, silenced, scoped and burst modes included, with a single time t = 0.333 s:

`stand + spread + (jump + land × 301.99) × 10^(−t / recoveryStand)`

This independently confirms:
- land × **raw** fall speed of about 302 u/s,
- the air baseline stand + jump,
- the 10x-per-recovery-time decay law.

It could not confirm the ladder formula. The sheet uses 2·ladder(mode), whereas the code uses ladder(mode) + ladder(primary); they differ only for the USP-S (silenced) and the Glock (burst).

**Fandom infoboxes** agree on running speeds (AK 215, Deagle 230, SSG 08 230) and on RPM (AK 600 = 60/0.1, Deagle 267 = 60/0.225, SSG 08 48 = 60/1.25).

## 9. Test vectors (64 tick, from `csgo_inaccuracy_ref.js`; radians = ×0.001 units)

| Case | Inaccuracy |
|---|---|
| AK standing still (penalty settled) | 0.006410 |
| AK crouched still | 0.004810 |
| AK running at 215 u/s | 0.181470 |
| AK 111.8 u/s, walking (+speed) | 0.058067 |
| AK 111.8 u/s, not walking | 0.135435 |
| AK 73.1 u/s (= 34%) | 0.006410 |
| AK airborne baseline (stand + jump) | 0.147170 |
| AK take-off (vz = +301.99) | 0.248110 |
| AK apex (vz = 0) | 0.147170 |
| AK falling at 600 u/s | 0.303228 |
| AK penalty right after a flat landing | 0.220252 |
| … 1 / 8 / 16 / 24 / 32 / 64 ticks later | 0.200335 / 0.104228 / 0.051155 / 0.026878 / 0.015773 / 0.006820 |
| AWP scoped still / unscoped still | 0.002000 / 0.080800 |
| AWP scoped, moving at 100 u/s | 0.178480 |
| Deagle apex, with the INFERRED apex term | 0.376300 |
| Deagle apex, 2017 code without the apex term | 0.044750 |
| Deagle take-off (vz = +301.99) | 0.593570 |
| AK penalty right after 1 shot | 0.014210 |
| … 1 / 12 / 24 / 32 ticks later (recoil index 1 → 0.698 → 0.294 → 0.165) | 0.013484 / 0.008823 / 0.007157 / 0.006752 |

## 10. Not verified / open points

1. **The exact final-2023 formula for "inaccuracy jump apex"** (§5.1): the lower clamp and the 2x cap. The linear apex→initial form is strongly supported by the tuning numbers but was not seen in code. It affects the Deagle only.
2. **CS:GO defaults** of `weapon_accuracy_reset_on_deploy`, `sv_turning_inaccuracy_*` and `weapon_accuracy_shotgun_spread_patterns`. The cvars exist in the final binary, but their defaults cannot be read from a string dump.
3. **Other code changes between 2017 and 2023** that added no new strings cannot be excluded. The sheet cross-check shows the data plus model matches for standing, crouching, running, apex, landing decay and firing values.
4. **"InaccuracyAltSwitch"**, a zoom-in penalty from the old weapon scripts, is assumed to be 0.
5. **Whether the vertical-speed term applies on ladders** (it does whenever the ground entity is null) was not traced. The ladder baseline and recovery rules themselves are verified.
