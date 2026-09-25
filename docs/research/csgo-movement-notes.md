> Notas de pesquisa da subfase 3.2 (movimento do CS:GO), em inglês como vieram das fontes. As decisões e os números
> adotados no MASSACRE estão em `docs/phases/phase-3.md`, seção 3.2 — onde as duas coisas diferem, vale o phase-3.md.

# CS:GO player movement: research notes for a 64 Hz, Y-up re-implementation

Everything below is **paraphrased pseudocode**. No source was copied. The notation is CS/Source Z-up. In your Y-up engine, read `vUp` as `velocity.y` and "horizontal/2D" as the (x, z) plane. `dt` is one tick (1/64 s = 0.015625 s).

---

## 0. Sources and confidence

**Primary source.** The CS:GO game code itself: the `cstrike15` tree from about 2017, which leaked in 2020. I read it through the public GitHub mirror `perilouswithadollarsign/cstrike15_src`. I checked every formula below against that code. Files and approximate lines:

| File | What it contains |
|---|---|
| `game/shared/cstrike15/cs_gamemovement.cpp` ([link](https://github.com/perilouswithadollarsign/cstrike15_src/blob/master/game/shared/cstrike15/cs_gamemovement.cpp)) | Stamina cvars (l.27-31), duck-spam constant (l.33), `sv_timebetweenducks` (l.36), `sv_jump_impulse` (l.49), `DuckingEnabled` (l.149), `CheckParameters` (l.169), `PlayerMove` (l.451), `ReduceTimers` (l.581), bhop cvars and `PreventBunnyJumping` (l.596-625), `CheckJumpButton` (l.627), `HandleDuckingSpeedCrop` (l.829), `CanUnduck` / `FinishUnDuck` / `FinishDuck` / `Duck` (l.850-1232), `OnJump` / `OnLand` (l.1234-1249), `Accelerate` (l.1251) |
| `game/shared/gamemovement.cpp` ([link](https://github.com/perilouswithadollarsign/cstrike15_src/blob/master/game/shared/gamemovement.cpp)) | CS:GO's own copy of the base class: `ProcessMovement` (l.1325), `StartGravity` (l.1490), `Friction` (l.1865), `FinishGravity` (l.1937), `AirAccelerate` (l.1960), `AirMove` (l.2006), base `Accelerate` (l.2075), `WalkMove` (l.2150), `FullWalkMove` (l.2287), `CategorizePosition` (l.4147), `CheckFalling` (l.4337), `PlayerRoughLandingEffects` (l.4418), `SetDuckedEyeOffset` (l.4707), `PlayerMove` (l.4994) |
| `game/shared/cstrike15/cs_player_shared.cpp` | `GetPlayerMaxSpeed` (l.321), `UpdateStepSound` (l.2434), `OnJump` / `OnLand` (l.2564-2615) |
| `game/shared/baseplayer_shared.cpp` | `sv_footstep_sound_frequency` (l.149), base `UpdateStepSound` (l.632), `sv_max_distance_transmit_footsteps` (l.783), `PlayStepSound` (l.791), `GetStepSoundVelocities` (l.981), `SetStepSoundTime` (l.999) |
| `game/shared/cstrike15/weapon_csbase.cpp` | Movement and air inaccuracy (l.1219-1285), weapon `OnLand` (l.3810) |
| `game/shared/cstrike15/cs_weapon_parse.h` / `.cpp` | Inaccuracy attributes are scaled by 0.001 |
| `game/shared/cstrike15/cs_shareddefs.cpp` (l.14-26) | Speed constants |
| `game/shared/shareddefs.h` (l.424-436) | Fall constants |
| `game/shared/cstrike15/cs_gamerules.cpp` | Hulls (l.211-224), fall damage (l.2654-2656, l.6249) |
| `game/shared/movevars_shared.cpp` | `sv_*` defaults |
| `game/server/cstrike15/cs_player.cpp` | `SetMaxSpeed(260)` at spawn (l.1489); flinch stamina (l.5108) |
| `game/client/in_main.cpp` | `cl_forwardspeed` and `cl_sidespeed` = 450; `KeyState` fractions |

**Final-CS:GO data (February 2023, build 1.38.5.5).** `csgo/scripts/items/items_game.txt` from the SteamDB tracker, now named GameTracking-CS2, at a commit taken before CS2: https://raw.githubusercontent.com/SteamTracking/GameTracking-CS2/108f1682bf7eeb1420caaf2357da88b614a7e1b0/csgo/scripts/items/items_game.txt

**Cross-checks for later CS:GO builds:**
- GOKZ "Vanilla" mode. It forces the vanilla CS:GO cvar values and was maintained until 2023. https://github.com/KZGlobalTeam/gokz/blob/master/addons/sourcemod/scripting/gokz-mode-vanilla.sp (l.31-56)
- GOKZ SimpleKZ duck-speed constants. https://github.com/KZGlobalTeam/gokz/blob/master/addons/sourcemod/scripting/gokz-mode-simplekz.sp (l.36-37, l.815-835)
- MovementAPI terminology for jumpbug, duckbug and perf. https://github.com/KZGlobalTeam/gokz/blob/master/addons/sourcemod/scripting/include/movementapi.inc
- A CS:GO cvar dump dated 2020-12-07 (exe 1.37.5.2, May 2020 build). It is generated from the VDC list, and **decimals are truncated**, so 5.5 shows as 5, 0.08 as 0, and 0.4 as 0. https://gist.github.com/eguven/779902f22124e5d69d1e76c138bbdfa2
- totalcsgo cvar pages: https://totalcsgo.com/commands/svstaminajumpcost (0.08) and https://totalcsgo.com/commands/svstaminalandcost (0.05)

**CS:S comparison.** Momentum Mod reproduces the CS:S stamina logic (the `pow(ratio, frametime*70)` version). https://github.com/momentum-mod/game/blob/develop/mp/src/game/shared/momentum/mom_gamemovement.cpp (l.27-30, l.167-179, l.1450-1459, l.3101-3107)

**Community write-ups:**
- PCGamesN, 2016-09-10. The anti-crouch-spam system was redesigned to use "degrading speed". https://www.pcgamesn.com/counter-strike-global-offensive/csgo-beta-patch-hitbox
- sm_realbhop README. Ground velocity is reset to weapon speed if you don't jump on the first tick. https://github.com/seritools/sm_realbhop
- zer0k deadstrafe write-up. https://gist.github.com/zer0k-z/808bc8bfc494e0bbb5a423c2b1ca6685
- win.gg, 2020-01-06, on "silent jump". https://win.gg/news/did-you-know-silent-jumping-in-csgo-isnt-really-silent-question-mark/
- Steam guide on speed ("max speed in about half a second"). https://steamcommunity.com/sharedfiles/filedetails/?id=501419345

**Not accessible:**
- The Valve Developer Community cvar list sits behind an anti-bot proof-of-work page. I did not try to bypass it.
- counterstrike.fandom returned HTTP 402.
- AlliedModders returned HTTP 403.

**Main caveat.** The code is from about 2017, and CS:GO ran until 2023. The evidence points to the movement code staying the same after 2017:
- GOKZ vanilla values from 2018-2023 match the leak's defaults exactly: stamina 0.08 / 0.05 / 80 / 60, and `sv_timebetweenducks` 0.4.
- The 2023 item speeds match what this code expects.

Post-2017 additions that I could **not** read in code:
- `sv_air_max_wishspeed` (the hardcoded 30 became a cvar)
- `sv_ledge_mantle_helper`
- `sv_standable_normal` and `sv_walkable_normal`
- `sv_water_*`
- `mp_footsteps_serverside`
- The Danger Zone items

See §12 for the full list of open questions.

**Where the sources disagree:**
- A search-engine summary claimed stamina defaults of 0.1 / 0.1 / 80 / 50. The actual totalcsgo pages say 0.08 and 0.05, and the code and GOKZ agree. Use **0.08 / 0.05 / 80 / 60**.
- The VDC-derived dump shows `sv_timebetweenducks 0` and `sv_staminajumpcost 0`. That is decimal truncation. The real values are 0.4 and 0.08.

---

## 1. Per-tick order in CS:GO (one usercmd = one tick)

```
ProcessMovement:
  dt = tickInterval * laggedMovement (normally 1)
  resetSpeedCropFlags()                       // duck crop may apply once per tick
  mv.maxSpeed = CS_GetPlayerMaxSpeed()        // §8: min(260, weapon speed or scoped alt speed); 1.0 when frozen or defusing

PlayerMove (CS override calls the base, then the tagging recovery at the end):
  1  CS_CheckParameters()   // duck-spam penalty and duck gating (§2); walk cap (§1a); max-speed scaling by surface,
                            // tagging (ground only) and stamina (§3); clamp |(fmove, smove, upmove)| <= mv.maxSpeed
  2  outWishVel = 0
  3  CS_ReduceTimers()      // stamina -= 60*dt (§3); base duck and jump timers
  4  (about once per second) CheckStuck
  5  ground check at tick start: with sv_optimizedmovement = 1 and MOVETYPE_WALK, the full
     CategorizePosition is skipped; only "vUp > 250 -> airborne" is applied
  6  if airborne: fallVelocity = -vUp         // this start-of-tick value later goes to OnLand (§7)
  7  CS_UpdateStepSound(velocity at tick start)   // footsteps (§6)
  8  CS_Duck()              // duck-speed recovery, duck amount, FinishDuck/FinishUnDuck (instant in air),
                            // HandleDuckingSpeedCrop(duckAmount)  (§2)
  9  LadderMove()
 10  FullWalkMove:
       a. vUp -= 0.5*g*dt                        // StartGravity (g = 800)
       b. if JUMP held: CS_CheckJumpButton()     // §4 bhop crop, jump impulse, §3 stamina scale,
                                                 // an extra FinishGravity, OnJump -> stamina
          else: clear the "jump was held" bit
       c. if onGround: vUp = 0; fallVelocity = 0; Friction()
       d. clamp each velocity axis to ±sv_maxvelocity (3500)
       e. onGround ? WalkMove()    // wish direction, CS_Accelerate, HARD CLAMP |v| <= mv.maxSpeed, step-move, stay on ground
                   : AirMove()     // AirAccelerate with the 30 cap, then TryPlayerMove
       f. CategorizePosition()     // ground test; sets surfaceFriction (0.25 "deadstrafe" case, §5)
       g. clamp axes
       h. vUp -= 0.5*g*dt           // FinishGravity
       i. if onGround: vUp = 0
       j. CheckFalling()            // §7: rough landing (>= 350), fall damage (> 580), CS view punch,
                                    // OnLand(fallVelocity) -> stamina, weapon penalty, landing sound (> 270)
 11  (CS, after the base) if onGround and velocityModifier < 1:
         velocityModifier = min(1, velocityModifier + 0.4*dt)     // tagging recovery, out of scope
```

**Jump tick subtlety.** `CheckJumpButton` calls `FinishGravity` itself, and `FullWalkMove` calls it again in step 10h. The jump tick therefore receives **1.5·g·dt** of gravity (−18.75 u/s at 64 tick). The position update in that tick uses the velocity after the first `FinishGravity`.

---

## 2. Walking (+speed / IN_SPEED / Shift)

Constants:
- `CS_PLAYER_SPEED_WALK_MODIFIER = 0.52`
- `sv_accelerate = 5.5`
- `sv_accelerate_use_weapon_speed = 1` (a release cvar)
- `sv_friction = 5.2`
- `sv_stopspeed = 80`
- The accelerate reference speed of 250 is hardcoded (`flMaxSpeed = 250`).
- Exponential acceleration mode is compiled out (`SV_ACCELERATE_EXPONENT_TIME = 0`).

Walking is **server-side movement logic**. The client does no `cl_movespeedkey` scaling in CS:GO: `ScaleMovements` returns immediately, and `cl_forwardspeed` = `cl_sidespeed` = `cl_backspeed` = 450 (cheat cvars).

### 2a. Max-speed cap (CheckParameters, first step of the tick)
```
walkBtn = SPEED button held
if (DUCK held after gating) or ducking or FL_DUCKING:
    walkBtn = false                             // Shift is ignored while in any duck state
if walkBtn:
    if length3D(player velocity at tick start) < mv.maxSpeed*0.52 + 25:
        mv.maxSpeed *= 0.52
        isWalking = true
    // otherwise: no cap yet; isWalking keeps its previous value
else:
    isWalking = false
// then, still in CheckParameters: mv.maxSpeed *= surface maxSpeedFactor
//   (* velocityModifier if on ground) (* stamina factor, §3)
// then scale (fmove, smove, upmove) down so their length <= mv.maxSpeed
```

### 2b. Ground acceleration (CCSGameMovement::Accelerate, called from WalkMove)
How the three versions differ:
- **Source SDK 2013** base `Accelerate` uses `accel·dt·wishspeed·surfaceFriction` with no 250 floor. Its `WalkMove` has **no** hard max-speed clamp. (Verified: [SDK 2013 gamemovement.cpp](https://github.com/ValveSoftware/source-sdk-2013/blob/master/src/game/shared/gamemovement.cpp), `Accelerate` at l.1820.)
- **CS:GO's copy of the base** already uses `max(250, wishspeed)`.
- **CS:GO's override (below)** adds the weapon ratio and the walk, duck and scoped rules.
```
cur = dot(v, wishdir);  add = wishspeed - cur;  if add <= 0: return
if cur < 0: cur = 0
isDuck = DUCK held or ducking or FL_DUCKING
isWalk = SPEED held and not isDuck
scale = max(250, wishspeed);  goal = scale
if sv_accelerate_use_weapon_speed and weapon:
    slowSniper = zoomed and weapon.zoomLevels > 1 and weapon.maxSpeed(current mode)*0.52 < 110
    r = min(1, weapon.maxSpeed(current mode) / 250)
    goal *= r
    if (not isDuck and not isWalk) or ((isWalk or isDuck) and slowSniper):
        scale *= r
if isDuck: if not slowSniper: scale *= 0.34;  goal *= 0.34
if isWalk: if not slowSniper: scale *= 0.52;  goal *= 0.52
a = sv_accelerate
if isWalk and cur > goal - 5:
    a *= clamp((goal - cur) / 5, 0, 1)          // the 5 u/s "goal speed" damping window (walking only)
accelspeed = min(a * dt * scale * surfaceFriction, add)
v += accelspeed * wishdir
```

### 2c. Hard clamp in WalkMove
The base `WalkMove` in CS:GO's own copy (not in SDK 2013) runs this right after `Accelerate`:
```
if |v| > mv.maxSpeed:  v *= mv.maxSpeed / |v|     // vUp was zeroed just before this
```
This clamp is why walk, crouch, landing stamina and tagging slow you **instantly** on the ground.

### What this means in play
- **Shift at full run (knife, 250).** The cap stays off until your speed is below 130 + 25 = 155. Until then `goal` = 130 and `cur` > 125, so the damping factor is 0 and there is no acceleration. Friction alone slows you (−8.1 % per tick at 64 tick). As soon as speed drops below 155, max speed becomes 130 and the hard clamp snaps you to 130. My model gives about 7 ticks, roughly 0.11 s (§11).
- **Walking acceleration scale.** It is 250 × 0.52 = **130 for every weapon** except slow scoped snipers. The weapon ratio is not applied while walking or ducking. The target (goal and wishspeed) *is* weapon-scaled: AK walk = 215 × 0.52 = 111.8, knife walk = 130.
- **Walk speed = weapon max speed × 0.52.** Examples: knife 130, M4 117, AK 111.8, scoped AWP 52, scoped autos 62.4.
- **Scoped.** `weapon.maxSpeed()` returns the attribute `max player speed alt` while the weapon is in Secondary mode, which zooming sets. The values are in §9.
  - "Slow sniper" = AWP, G3SG1 and SCAR-20 when zoomed (they have two zoom levels, and their alt speed × 0.52 is below 110).
  - The SSG 08 is excluded: scoped speed 230 × 0.52 = 119.6.
  - The AUG and SG 553 are excluded: one zoom level.
  - For slow snipers, the acceleration scale keeps the weapon ratio (AWP scoped: 250 × 100/250 = 100) and skips the ×0.52 and ×0.34. The goal is still reduced.
  - Scoped + walk: max speed = alt × 0.52 (AWP 52), under the same "+25" rule.
- **Partial or analog input.** `wishspeed = min(|(fmove, smove)|, maxSpeed)`, so analog input below max speed lowers the *target*. The acceleration *scale* does not shrink, because it is `max(250, wishspeed) × weapon ratio`. The keyboard gives ±450, which saturates. On the frame a key goes down, `KeyState` returns 0.5 (or 0.25 / 0.75 for press-release combinations in one frame). That produces 225 for one command, which only matters for weapons faster than 225.
- **`sv_accelerate_use_weapon_speed = 0`:** neither the goal nor the scale is multiplied by the weapon ratio.

---

## 3. Ducking and the duck-spam penalty

Constants:

| Name | Value |
|---|---|
| `CS_PLAYER_SPEED_DUCK_MODIFIER` | 0.34 |
| `CS_PLAYER_DUCK_SPEED_IDEAL` | 8.0 |
| Crouch-spam penalty (hardcoded) | 2.0 per raw key change |
| Minimum duck speed that still accepts duck input | 1.5 |
| Recovery | 3.0/s, plus 6.0/s under the condition below |
| Duck-down rate factor | 0.8 |
| Minimum unduck rate | 1.5/s |
| Defusing | ×0.4 on duck and unduck rate |
| `sv_timebetweenducks` | 0.4 s (release cvar, range 0..2) |
| Hulls | standing 32×32×72, ducked 32×32×54 (origin at the feet); eye 64 standing, 46 ducked |
| Air shift | (72 − 54) / 2 = 9 |

### CheckParameters (start of tick)
```
rawDuck = DUCK bit as sent by the client (stored in a spare button bit before any gameplay change)
if rawDuck != rawDuck of the previous tick:          // BOTH press and release
    duckSpeed = max(0, duckSpeed - 2.0)
duckAllowed = duckSpeed >= 1.5
              and not (not FL_DUCKING and now < lastCompletedDuckTime + sv_timebetweenducks)
if not duckAllowed: clear DUCK for this tick          // input is ignored
(while planting the bomb, DUCK is forced on and unducking is impossible)
```

### Duck() (after footsteps, before FullWalkMove)
```
duckSpeed = approach(duckSpeed -> 8, 3.0*dt)
if duckSpeed >= 8:
    lastFullSpeedPos = horizontal position
else if (duckAmount == 0 or duckAmount == 1) and dist2D(position, lastFullSpeedPos) > 64:
    duckSpeed = approach(duckSpeed -> 8, 6.0*dt)      // cumulative, so 9/s total
held = DUCK (after gating)
if (not held and duckAmount > 0) or (held and duckAmount < 1): ducking = true
if held and ducking:                                   // going down
    duckAmount = approach(-> 1, duckSpeed*0.8*(defusing ? 0.4 : 1)*dt)
    if duckAmount >= 1 or not onGround: FinishDuck()   // in air: instant
    else: eyeZ = lerp(64, 46, smooth(duckAmount))      // smooth(t) = 3t^2 - 2t^3
if not held and ducking:                               // going up
    if CanUnduck():                                    // room for the standing hull (in air: 9 u lower)
        duckAmount = approach(-> 0, max(1.5, duckSpeed)*(defusing ? 0.4 : 1)*dt)
        ducked(hull flag) = false                      // standing hull immediately
        if duckAmount <= 0 or not onGround: FinishUnDuck()   // in air: instant
        else: eyeZ = lerp(64, 46, smooth(duckAmount))
        if duckAmount <= 0.75: clear FL_DUCKING        // lose crouch accuracy and footstep flag early
    else:
        stay fully ducked (duckAmount = 1, hull ducked, FL_DUCKING)
HandleDuckingSpeedCrop(duckAmount)
```

`HandleDuckingSpeedCrop` (once per tick, **no ground check**):
```
if held or ducking or FL_DUCKING:
    k = 0.34*duckAmount + (1 - duckAmount)             // 1 when standing, 0.34 when fully ducked
    fmove *= k;  smove *= k;  upmove *= k;  mv.maxSpeed *= k
```

`FinishDuck`:
- On the ground, the origin (feet) stays put and the head drops 18. In the air, the origin moves **up 9**: the feet rise 9 and the head drops 9.
- Sets hull = ducked, eye = 46, FL_DUCKING, duckAmount = 1, and `lastCompletedDuckTime = now`.
- Then runs a stuck fix and `CategorizePosition`.

`FinishUnDuck`:
- On the ground, the origin stays and the hull grows up by 18. In the air, the origin moves **down 9**.
- Clears the flags and sets duckAmount = 0.
- Then runs `CategorizePosition`. Landing through this call is the duckbug; see §10.

### Answers to your questions
- **Duck-spam penalty.** −2.0 on **every change** of the raw key: press = −2, release = −2, so a full crouch-uncrouch costs −4.
  - The value never goes below 0.
  - Below 1.5 the duck input is ignored until it recovers.
  - Recovery is +3.0/s, applied every tick in `Duck()` (+0.046875 per tick at 64 tick). Add +6.0/s more while fully up or fully down and more than 64 u (2D) from where the duck speed was last full.
- **Both directions share the value.** Duck-down rate = 0.8 × duckSpeed per second. At full speed that is 6.4/s, 0.156 s, 10 ticks at 64 tick. Unduck rate = max(1.5, duckSpeed), which is 8/s, 0.125 s, 8 ticks.
- **First press in a while.** At 64 tick: 8 → 6 in `CheckParameters` → 6.046875 after the recovery in `Duck()`. At 128 tick the same sequence gives 6.0234375, which is exactly GOKZ's `DUCK_SPEED_MINIMUM` with its comment "Equal to if you just ducked/unducked for the first time in a while". GOKZ also states "Duck speed is reduced by the game upon ducking or unducking".
- **History.** The degrading-speed system replaced a key-press counter in the September 2016 beta (PCGamesN). Older demos used a fixed 150 ms duck; the client has a compatibility branch for them.
- **Your "duck transition 8/s".** CS:GO uses 6.4/s going down and 8/s going up, both scaled by the spam penalty. Eye height eases with smoothstep. The collision hull swaps **at the end** when going down and **at the start** when going up.
- **Duck speed modifier 0.34.** It is lerped by duckAmount. It also scales `mv.maxSpeed`, so the WalkMove hard clamp slows you smoothly over the duck time instead of through friction. Ground acceleration uses the full ×0.34 scale as soon as any duck state is active (§2b). Derived consequence: crouch acceleration is slow. Net acceleration below 80 u/s is (5.5 × 85 − 5.2 × 80) ≈ 51 u/s², so reaching 85 takes about 1.5 s. See §11.
- **Ducking in the air:**
  - Duck and unduck complete **instantly**, with the ±9 origin shift.
  - `sv_timebetweenducks` 0.4 blocks starting a new duck within 0.4 s of the last *completed* duck, unless you are still flagged ducked. The comment on this cvar reads "Prevent super-fast duck-spam while in air".
  - The duck speed crop also applies in the air, so air acceleration while ducked is about ×0.34 (§5).
  - Jumping while ducking or ducked uses the "set" impulse, `vUp = J` instead of `vUp += J` (§4). That includes pressing jump and duck on the **same tick** from standing, because the duck state is already `ducking` when the jump runs.
- **Ladders.** Climb speed 200 (×0.34 if DUCK or SPEED is held). Lateral movement is ×0.5 unless ducking. `sv_ladder_scale_speed` = 0.78 scales ladder velocity.

---

## 4. Stamina (CS:GO version; verified)

Cvars (all release/replicated):

| Cvar | Default | Role |
|---|---|---|
| `sv_staminamax` | 80 | Clamp ceiling of the stamina value |
| `sv_staminajumpcost` | 0.080 | Per u/s of jump impulse |
| `sv_staminalandcost` | 0.050 | Per u/s of fall velocity |
| `sv_staminarecoveryrate` | 60 | Stamina units per second |

The divisor for all effects is the hardcoded **`STAMINA_RANGE` = 100**, not `sv_staminamax`.

```
// Build-up
OnJump(impulse):  stamina = clamp(stamina + 0.08*impulse, 0, 80)
   // impulse = vUp right after the jump (after the stamina scale and after CheckJumpButton's FinishGravity)
   //           minus vUp before the jump (after StartGravity)
   // standing jump from rest, 64 tick: (J - 0.5*g*dt) = 295.743; ducked/"set" jump: J = 301.993
OnLand(fallVel):  stamina = clamp(stamina + 0.05*fallVel, 0, 80)   // fallVel = raw u/s, §7
(being hit)       stamina = clamp(stamina + 8*(1 - flinchModifier), 0, 80)   // tagging, out of scope

// Decay: ReduceTimers, 3rd step of the tick (after CheckParameters, before CheckJumpButton)
if stamina > 0: stamina = max(0, stamina - 60*dt)           // -0.9375 per tick at 64 tick

// Effect 1, horizontal. CheckParameters uses the stamina value from BEFORE this tick's decay.
// Applies on the ground and in the air.
if stamina > 0: mv.maxSpeed *= clamp(1 - stamina/100, 0, 1)^2
   // the source comment says it is squared to match the jump penalty
   // on the ground the WalkMove hard clamp enforces it instantly -> the landing slowdown

// Effect 2, vertical. CheckJumpButton uses the value AFTER decay, applied before FinishGravity.
if stamina > 0: vUp *= clamp(1 - stamina/100, 0, 1)
```

- **The formula you proposed is not CS:GO.** The version `ratio = (max − stamina)/max`, applied as `pow(ratio, frametime/(1/70))` to horizontal velocity in `WalkMove`, is **CS:Source** (itself derived from GoldSrc). In CS:S, stamina is stored in milliseconds, with `STAMINA_MAX` 100, jump cost 25 and recover rate 19. Momentum Mod reproduces that, and it matches the old CS:S file. In the CS:GO file, `WalkMove` and `AirMove` just call the base class, and stamina works only through the two effects above.
- **Typical flat standing jump at 64 tick** (derived, §11):
  - Stamina after takeoff: 23.66.
  - It has decayed to 0 before landing (airtime about 0.73 s, 47 ticks).
  - Landing at fallVel ≈ 279 adds 13.96.
  - The first ground tick is capped at (1 − 0.1396)² ≈ 0.74 × max speed, about 185 u/s with the knife.
  - Stamina is back to 0 after about 0.23 s.
- **Consecutive perfect bhops** settle at jump impulses of about 257-261 instead of 296, with about 32-34 stamina at takeoff.

---

## 5. Bunny-hop speed cap

- `sv_enablebunnyhopping` = **0**: "Allow player speed to exceed maximum running speed".
- `sv_autobunnyhopping` = **0**: re-jump while jump is held.
- `BUNNYJUMP_MAX_SPEED_FACTOR` = **1.1**. The source comment claims TF2's value was changed "from 1.1 to 1.0", but the define says 1.1. Trust the define.

Where it runs, inside `CheckJumpButton`:
```
if dead: mark jump held; return
if water jump in progress: tick the timer; return
if in water up to the waist: swim-up (vUp = 100) instead; return
(detect "standing on a player" and "that player is airborne")
if not onGround: mark jump held; return                  // no double jumps
if jump was already held last tick and not sv_autobunnyhopping: return   // no pogo
if not sv_enablebunnyhopping: PreventBunnyJumping()      // HERE: before leaving the ground and before the impulse
leave the ground
if |v| (3D) > 126: play a jump step sound (volume 1.0, forced, audible to others)   // §6
(the client plays "Default.WalkJump" locally)
jumpFactor = surface jumpFactor (normally 1)
if standing on an airborne player:              vUp = 0
else if ducking or FL_DUCKING or on a player:   vUp = jumpFactor * J      // SET
else:                                           vUp += jumpFactor * J     // ADD to -0.5*g*dt
if stamina > 0: vUp *= clamp(1 - stamina/100, 0, 1)
FinishGravity()                                  // extra half gravity step on the jump tick
OnJump(vUp - vUpBeforeJump)                      // stamina (§4); the weapon's OnJump does nothing
mark jump held
```

`PreventBunnyJumping`:
```
cap = 1.1 * player.m_flMaxspeed
if cap <= 0: return
s = |v|                                         // 3D length (includes the small -0.5*g*dt vUp)
if s > cap: v *= cap / s                        // all three components
```

- **Which max speed?** `player.m_flMaxspeed` is **not** the weapon speed and not `mv.maxSpeed`. CS:GO sets it once at spawn to `CS_PLAYER_SPEED_RUN` = 260 (`cs_player.cpp` l.1489) and never changes it. So **cap = 286 u/s for every weapon**; walk, duck, scope and stamina are ignored. The movement's own max speed (weapon-dependent) is a different variable.
- The crop only happens on a jump. Airspeed is otherwise uncapped. But if you touch the ground for even one tick without jumping (no "perf"), Friction and the WalkMove hard clamp cut you to the current, stamina-reduced max speed. sm_realbhop's README describes the same thing: velocity is "set back to his weapon's running speed".

---

## 6. Air acceleration

`AirMove` is the base class. CS:GO does not override it, and the CS `Accelerate` override is **ground-only**.
```
wishvel = forward2D*fmove + right2D*smove      // after the CheckParameters clamp and the duck crop
wishspeed = |wishvel|;  if wishspeed > mv.maxSpeed: wishspeed = mv.maxSpeed
AirAccelerate(wishdir, wishspeed, sv_airaccelerate = 12):
    if dead or water-jumping: return
    capped = min(wishspeed, 30)                // hardcoded 30 in the 2017 code; later builds have
                                               // sv_air_max_wishspeed (default 30), confirmed in the 2020 dump and GOKZ
    add = capped - dot(v, wishdir);  if add <= 0: return
    accelspeed = 12 * wishspeed * dt * surfaceFriction   // UNCAPPED wishspeed; no max(250, ...), no weapon ratio
    v += min(accelspeed, add) * wishdir
TryPlayerMove()
```

- **wishspeed is `mv.maxSpeed`-derived**, so everything that scales `mv.maxSpeed` also scales air acceleration: weapon or scoped speed, the ×0.34 duck crop (in the air a duck completes instantly, so ×0.34), stamina, and walk if the "+25" rule triggers. Per tick at 64 tick, before the 30 cap:

  | Case | accelspeed per tick |
  |---|---|
  | Knife | 12 × 250 / 64 = 46.9 |
  | AK | 40.3 |
  | Scoped AWP | 18.75 |
  | Ducked knife | 15.9 |

- **surfaceFriction in the air.** `CategorizePosition` resets it to 1.0 on every call. When the player is found airborne while **0 < vUp ≤ 140** (140 is `NON_JUMP_VELOCITY`; above 140 the ground trace is skipped entirely), it sets **0.25**. That value applies to the next tick's `AirAccelerate`. This is the "deadstrafe" window just before the apex (about 11 ticks at 64 tick), and it cuts per-tick gain to about 11.7 with the knife (zer0k's write-up).

---

## 7. Footsteps, jump and landing sounds

Cvars:
- `sv_footsteps` = 1 (development-only).
- `sv_footstep_sound_frequency` = **0.97**: a cheat cvar that **multiplies the step interval**. It is not 97, and it is not distance-based.
- `sv_max_distance_transmit_footsteps` = 1250 (no release flag; hidden in retail).
- `mp_footsteps_serverside` = 1 exists in the 2020 dump (post-leak). It only moves where footsteps are computed.

Step logic (`UpdateStepSound`, step 7 of the tick, uses the start-of-tick velocity):
```
// CS gate
if dead: return
if |v|^2 (3D) < 135.2^2 or isWalking:      // 135.2 = 260 (CS_PLAYER_SPEED_RUN) * 0.52; isWalking from §2a
    if |v|^2 < 10: stepTimer = 300*0.97      // reset so the first step comes about 0.29 s after starting to move
    return                                   // silent; the timer does not tick down while gated
// base
stepTimer -= 1000*dt;  if stepTimer > 0: return
if frozen, noclip or observer, or sv_footsteps == 0: return
(velWalk, velRun) = (FL_DUCKING or ladder) ? (60, 80) : (90, 220)
need |v| >= velWalk and (on ladder or (on ground and |v2D| > 0))
slow = |v| < velRun                          // a cadence/volume class, NOT the Shift walk
interval (ms): normal or water-feet: slow ? 400 : 300;  ladder 200;  waist-deep 600
interval *= 0.97;  if FL_DUCKING or ladder: interval += 100
volume by surface (slow / fast):
    concrete, metal, grate, tile, slosh, default: 0.2 / 0.5
    dirt: 0.25 / 0.55
    vent: 0.4 / 0.7
    ladder: 0.5;  water at the feet: 0.2 / 0.5;  waist-deep "wade": 0.65 (plays 3 steps out of 4)
if FL_DUCKING: volume *= 0.65
PlayStepSound(volume):
    alternate the left/right sound of the surface, prefixed "ct_" or "t_" by team
    also play a team "Suit" sound at the same volume
    others hear it through PAS/PVS, and not beyond 1250 u from their eyes
```

- **Threshold: 135.2 u/s.** It comes from `CCSPlayer::UpdateStepSound` (260 × 0.52). "110" is **not** a footstep value; it only appears in the slow-sniper test in `Accelerate`.
- **Which movement is silent:**
  - Shift-walk: always silent once the walk cap has engaged, and walk speeds are ≤ 130 anyway.
  - Crouch-walk: silent, because maximum crouch speed is 85 < 135.2.
  - Scoped AWP (100) and autos (120): silent.
  - **Scoped AUG / SG 553 (150) and the Negev (150): audible.**
  - Sprinting with Shift held: you stay audible until your speed drops under 155 (knife), because `isWalking` only turns on at that point.
  - Weapons at or above 135.2 but below 220 (AK 215, M4 225 is above) use the slow class: a 388 ms cadence and volume 0.2 on concrete. At 220 and above the cadence is 291 ms and the volume 0.5.
  - The timer decreases in 15.625 ms steps at 64 tick, so the real interval is 19 ticks (0.297 s) for fast steps and 25 ticks (0.391 s) for slow steps.
  - Absolute loudness and attenuation come from the sound scripts, which I did not verify; `fvol` is a volume multiplier on top of them.
- **Jump sound.** In `CheckJumpButton`, if 3D |v| > **126**, a step sound plays at volume 1.0, forced to all players (except yourself; the 1250 u cutoff applies). The jumper always hears a local "Default.WalkJump". So jumps from standing or slow walking (< 126) make no jump step for others in the 2017 code. win.gg (2020) quotes a developer saying that some jump soundscript "plays on every jump regardless that you're walking or not". **Unverified** in code; it may have been added later.
- **Landing sounds:**
  - `CCSPlayer::OnLand`: if fallVel > **270**, "Default.Land" plus the team-prefixed surface step play to all other players. A flat standing jump lands at about 279, so it is audible. Landing on a higher box, with fallVel < 270, is silent.
  - `CheckFalling`, rough landing: if fallVel ≥ **350**, a step sound plays at volume 0.85 (1.0 above 580, which also means fall damage), and the step timer is set to 400.
- **"Silent jump" and duckbug landings.** If you land through an in-air unduck, `CheckFalling` never runs and there is no landing sound at all (§10).

---

## 8. Landing (fall velocity, OnLand penalties)

```
fallVelocity = -vUp   // taken at tick start while airborne, i.e. the previous tick's end velocity, in raw u/s
// in CheckFalling, only if the landing happened this tick (onGround and fallVelocity > 0):
if fallVelocity >= 350 (PLAYER_FALL_PUNCH_THRESHOLD):
    if the ground entity is floating: fallVelocity -= 200
    if the ground is moving down: add the ground's vUp (min 0.1)
    if > 580: fall damage (fallVelocity - 580) * 100/(1000 - 580) = 0.238 hp per u/s; volume 1.0
    else (the 350..580 range): volume 0.85
    rough-landing step sound + roll view-punch
if 16 < fallVelocity <= 1024 (CS only): viewPunch.pitch = max(0.75°, 0.001*fallVelocity)   // cosmetic, decays
OnLand(fallVelocity)          // RAW u/s, not normalized:
    stamina += 0.05*fallVelocity                                       (§4)
    weapon: accuracyPenalty += 0.001*[weapon attribute "inaccuracy land"]*fallVelocity   // radians
            aimPunch.pitch += asin(clamp(thatPenalty, -1, 1)) in degrees * 0.2
            aimPunch.yaw   += random(-1, 1) * thatPitchKick * 0.1
    if fallVelocity > 270: landing sound (§7)
fallVelocity = 0
```

- **No other landing speed penalty exists in the movement code.** The slowdown is entirely the stamina max-speed factor, enforced by the WalkMove hard clamp, plus normal friction when you don't jump on the next tick.
- There is also no special "landing duck penalty".
- The weapon's in-air inaccuracy is separate (`GetInaccuracy`): it scales with the square root of |vUp| against the square root of `sv_jump_impulse`, and the recovery time in the air is ×4.

---

## 9. Max speeds (final CS:GO items_game, Feb 2023)

| Item | max player speed | alt / scoped |
|---|---|---|
| HE grenade (prefab `explosive_grenade`) | **245** | 245 |
| Flashbang | **245** | 245 |
| Smoke | **245** | 245 |
| Molotov | **245** | 245 |
| Incendiary | **245** | 245 |
| Decoy | **245** | 245 |
| TA grenade / snowball | 245 | 245 |
| C4 | **250** | 250 |
| Knife (prefab `melee`, every knife) | **250** | 250 |
| Healthshot | 250 | 250 |
| Zeus | 220 | 220 |
| Fists (Danger Zone) | 275 (capped to 260) | |

Runtime constants:

| Constant | Value |
|---|---|
| `CS_PLAYER_SPEED_RUN` | **260** (hard ceiling in `GetPlayerMaxSpeed` and `player.m_flMaxspeed`) |
| `sv_maxspeed` | 320 |
| VIP | 227 |
| Shield | 160 |
| Carrying a hostage | 200 |
| Frozen, defusing or grabbing a hostage | 1.0 (`CS_PLAYER_SPEED_STOPPED`) |
| Observer | 900 |

`GetPlayerMaxSpeed` = min(260, sv_maxspeed / m_flMaxspeed), then the VIP, hostage, shield or weapon override. Guns, for reference (normal / scoped):
- AK 215, M4A4 / M4A1-S 225, AUG 220/150, SG 553 210/150, FAMAS 220, Galil 215
- AWP 200/100, SSG 08 230/230, G3SG1 / SCAR-20 215/120
- Pistols 240 (Deagle 230, R8 180/220)
- MP9 / MAC-10 / Bizon 240, MP7 220, MP5-SD 235, P90 / UMP 230
- Nova 220, XM1014 215, MAG-7 225, Sawed-Off 210, M249 195, Negev 150

---

## 10. Other CS:GO movement details a faithful re-implementation needs (brief)

1. **WalkMove hard clamp** of ground speed to `mv.maxSpeed` every tick (§2c). This drives instant crouch, walk and landing slowdowns and makes "perf" bhops matter.
2. **Double `FinishGravity` on the jump tick** (§1), and **"set" versus "add" impulse** (§5): jumping while ducking, ducked, or pressing duck on the same tick; standing on a player gives the set impulse; standing on an airborne player gives vUp = 0.
3. **Ground test (`CategorizePosition`):**
   - vUp > 140 means airborne.
   - Otherwise trace 2 u down (plus the 18 u step height when already grounded, so the player snaps down slopes and stairs).
   - Standable if the normal's z ≥ 0.7, with four quadrant retraces on steep hits. A later cvar `sv_standable_normal` defaults to 0.7.
   - Landing sets vUp = 0.
   - Surface friction on the ground is the surface-prop friction × 1.25, capped at 1. Surfaces also have `maxSpeedFactor` and `jumpFactor`, normally 1.
4. **Deadstrafe:** `surfaceFriction` 0.25 while airborne with 0 < vUp ≤ 140 (§6).
5. **Jumpbug and duckbug are not prevented.**
   - Duckbug: if an in-air unduck in `Duck()` puts your feet within the ground test, you land inside `Duck()`. `FullWalkMove` then zeroes `fallVelocity`, so there is no `OnLand`: no landing stamina, no fall damage, no landing sound. This is the "silent jump".
   - Jumpbug: unduck and jump on the same tick. You jump without ever being grounded or getting friction. See MovementAPI's definitions.
6. **Duck gating** (`sv_timebetweenducks` 0.4, duck speed < 1.5), bomb plant forcing a duck, and defuse ×0.4 duck speed.
7. **Player stacking:** standing on two or more stacked players forces a slide off.
8. **Tagging** (out of scope): `velocityModifier` multiplies max speed only on the ground and recovers 0.4/s only on the ground. Being hit also adds stamina of 8 × (1 − flinch modifier).
9. **Post-2017 cvars** present in late CS:GO but not read in code: `sv_air_max_wishspeed` 30, `sv_ledge_mantle_helper` 1 ("improves success of jump+ducks to windows or vents"), `sv_standable_normal` and `sv_walkable_normal` 0.7, `sv_water_movespeed_multiplier` 0.8, `sv_water_swim_mode` 0, `sv_weapon_encumbrance_*` (Danger Zone), and parachute, exojump and bump-mine variables.
10. **Cosmetic landing effects:** view punch (§8) and a weapon dip of `weapon_land_dip_amt` = 20. `CheckVelocity` clamps each axis to ±3500.

---

## 11. Derived check values (my simulation, NOT in-game measurements)

These come from `csgo_jump_sim.py` and `csgo_ground_sim.py` in the scratchpad. They follow the paraphrased algorithm above, assume flat ground, and assume surface friction 1. Use them as unit-test targets for your implementation, not as ground truth.

Vertical motion (feet height above the ground; g = 800, J = 301.993377):

| Case | 64 tick | 128 tick |
|---|---|---|
| Standing jump, apex | 54.65 | 55.83 |
| Standing jump, landing fallVel | 279.3 | 288.6 |
| Jump then duck next tick, apex (includes +9) | 63.65 | 64.83 |
| Jump + duck same tick, apex ("set" impulse + 9) | 66.00 | 66.00 |
| Already ducked on the ground, jump, apex | 57.00 | 57.00 |
| Stamina after takeoff (standing) | 23.66 | |
| Stamina after landing | 13.96 | |
| First ground tick max-speed factor | 0.740 (knife 185 u/s) | |
| Time until stamina is 0 | 0.233 s | |

Ground speed, straight line, 64 tick (128 tick is within about 0.02 s):

| Case | Time |
|---|---|
| Knife 0 → 250 | 35 ticks, 0.55 s ("max speed within half a second" matches the Steam guide) |
| AK 0 → 215 | 0.56 s |
| Knife walk 0 → 130 | 0.63 s |
| AK walk 0 → 111.8 | 0.41 s |
| Knife crouch 0 → 85 | about 1.56 s (friction at stopspeed 80 nearly cancels the ×0.34 acceleration) |
| Knife 250 → Shift | 130 after 7 ticks, 0.11 s (friction, then the hard clamp at < 155) |
| Knife 250 → release all keys | 0 after 26 ticks, 0.41 s |
| Scoped AWP 0 → 100 | 0.83 s |
| Scoped AWP walk 0 → 52 | 0.34 s |

---

## 12. Unverified or open

- **Post-2017 CS:GO changes.** The 2017 code is the base. Where later data exists (GOKZ, the 2020 dump, items_game 2023), it matches. But patches between 2017 and 2023 could have changed a detail I cannot see, for example footstep or landing sound rules.
- **`sv_air_max_wishspeed`.** The cvar exists (default 30). I **assume** it replaced the hardcoded 30 in `AirAccelerate` with the same formula. I did not see that code.
- **Jump sound.** The claim that a jump sound plays for others "on every jump" (win.gg, 2020) is not in the 2017 code.
- **Absolute footstep loudness and attenuation** (sound scripts) are not checked; only the volume multipliers and the 1250 u cutoff are.
- **Behaviour of later cvars:** `sv_ledge_mantle_helper`, the water swim mode, and `mp_footsteps_serverside` are not read.
- **All numbers in §11** are derived from my model, not measured in the game.

---

## 13. Constant cheat-sheet

| Group | Values |
|---|---|
| Gravity and jump | `sv_gravity` 800; `sv_jump_impulse` 301.993377 |
| Speed and acceleration | `sv_maxspeed` 320; `CS_PLAYER_SPEED_RUN` 260; `sv_accelerate` 5.5; `sv_accelerate_use_weapon_speed` 1; accelerate reference 250 |
| Air | `sv_airaccelerate` 12; air wish cap 30 (`sv_air_max_wishspeed`) |
| Friction | `sv_friction` 5.2; `sv_stopspeed` 80 |
| Movement limits | `sv_stepsize` 18; `sv_maxvelocity` 3500; standable normal z 0.7; `NON_JUMP_VELOCITY` 140 |
| Speed modifiers | walk 0.52 (cap at speed < max × 0.52 + 25; 5 u/s damping window); duck 0.34 (lerped by duck amount; also in the air); climb 0.34 |
| Duck | ideal speed 8; spam −2 per raw change; usable ≥ 1.5; recovery 3/s (+6/s when fully up/down and > 64 u away); down rate 0.8 × speed; up rate max(1.5, speed); `sv_timebetweenducks` 0.4 |
| Hull and eye | 72/54; eye 64/46; in-air shift 9 |
| Stamina | max 80; jump 0.08 × impulse; land 0.05 × fallVel; recovery 60/s; effects use /100: max speed × (1 − s/100)², jump × (1 − s/100) |
| Bhop | 1.1 × 260 = 286 (3D length, in `CheckJumpButton` before the impulse); `sv_enablebunnyhopping` 0; `sv_autobunnyhopping` 0 |
| Footsteps | silent below 135.2 (3D) or while walking; cadence 300 / 400 ms × 0.97 (+100 ducked or on a ladder; ladder base 200); slow class below 220 (below 80 when ducked); volumes by surface in §7 |
| Other sounds | jump step to others if \|v\| > 126; landing sound if fallVel > 270; rough landing ≥ 350; fall damage above 580 at 100/420 hp per u/s |
| Landing | fallVel is raw u/s; weapon land penalty = 0.001 × attribute × fallVel |
| Item speeds | grenades 245; knife / C4 / healthshot 250; Zeus 220 |
