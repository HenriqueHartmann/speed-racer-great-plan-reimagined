# Gameplay Specification

Status tags follow `docs/research/project-brief.md`.

> **Nothing in this document is OBSERVED.** The original game has never been executed. Every
> behavioural entry below is **INFERRED** from identifiers recovered from the movie files. The
> identifiers themselves are **VERIFIED** — they are real strings in the artifact. Their *meaning*
> is interpretation until the Lingo bytecode is decompiled or gameplay is actually watched.

Source of the identifiers: the `Lnam` (symbol name table) and `CASt` (cast member) chunks of
`SR_MAIN.dcr` and `SR_level_1.dcr`, decompressed in memory by a custom read-only script using only
the Python standard library. 1442 Lingo symbols and 245 cast-name strings were recovered this way.
No third-party decompiler was run, so **no handler body has been read** — only names.

---

## 1. Runtime — VERIFIED

| Property | Value |
|---|---|
| Engine | Macromedia Director MX 2004 / Shockwave Player 10.1 |
| Container | Afterburner-compressed `.dcr` (`XFIR` / `MDGF`, `Fver` = `10.1#11`) |
| Rendering | Shockwave 3D. A hardware Direct3D 7 path was **available** (renderer-negotiation symbols); whether it was engaged at runtime is **UNKNOWN** |
| Physics integration | Havok Xtra (see §3) |
| UI layer | Flash members embedded in Director (uncompressed SWF) |
| Audio | SWA / MP3 streaming plus `snd ` cast members |

⚠️ A third-party source described this game as "a flash game". That is **wrong** and contradicted
by the file headers. Treat secondary descriptions of the runtime as unreliable.

---

## 2. Required Xtras — VERIFIED

From the `XTRl` chunk of each movie.

| Xtra | `SR_MAIN.dcr` | `SR_level_1.dcr` |
|---|---|---|
| `Shockwave 3d Asset Xtra` | ✓ | ✓ |
| `Havok` / `Havok.x32` | — | **✓** |
| `Flash Asset` | ✓ | ✓ |
| `SWA Decompression` | ✓ | ✓ |
| `Sound Control` | ✓ | ✓ |
| `NetLingo`, `INetURL`, `NetFile` | ✓ | ✓ |

**INFERRED:** the front-end uses 3D only for a car showcase ("spinner"), which is why it needs no
physics engine.

---

## 3. Physics — the four claims, kept separate

| Claim | Status |
|---|---|
| The gameplay movie **declares `Havok.x32`** as an Xtra requirement | **VERIFIED** |
| The symbol table contains Havok and rigid-body API references | **VERIFIED** |
| Which gameplay objects actually use rigid-body simulation | **not yet verified** |
| Whether the Mach 5 controller relies on generic rigid-body physics | **UNKNOWN** |

Rigid-body symbols present: `gHavok`, `makeMovableRigidBody`, `makeFixedRigidBody`,
`setCollisionCallback`, `gravity`, `restitution`, `friction`, `pTimeStep`, `pSubSteps`,
`deactivationParameters`, `immovable`, `pinned`, `meshDeform`, `resetWorld`, `disableCollision`,
`enableCollision`, `removeFromWorld`.

**Declaring the Xtra proves integration, not that the car was driven by it.** Scripted symbols
(`doFaller`, `doHitTree`, segment swapping, a scripted rival) suggest the original was not a pure
simulation — but that is **INFERRED** and must be settled by decompilation.

### Physics parameters — RECOVERED

Recovered from decompiled Lingo in `SR_level_1.dcr`. Each value cites its originating script and
handler. Source is held locally and is not part of this repository.

| Parameter | Value | Source |
|---|---|---|
| World gravity | `vector(0, 0, -90.81)` | `BehaviorScript 2 — Havok Physics`, `Initialize` |
| Fixed timestep | `0.025` s (**40 Hz**) | same, property default `pTimeStep` |
| Sub-steps | `5` | same, property default `pSubSteps` |
| Collision tolerance | `4` | same, property default `pTolerance` |
| World scale | `1.0` | same, property default `pScale` |
| Deactivation parameters | `[5.0, 0.1]` | `BehaviorScript 19 — INIT` |
| Chassis friction | `0` | `BehaviorScript 25 — doMach5`, `prepareCar` |
| Chassis restitution | `0` | same |

Gravity is applied on **Z**, and its magnitude (90.81) is roughly 9.26× Earth gravity — consistent
with a world scale where 1 unit is not 1 metre, or with deliberate arcade weighting. Which of the
two is **UNKNOWN**.

**Chassis friction and restitution are both zero.** The car does not rely on Havok's contact
friction for grip at all; grip is applied by the custom controller described below.

---

## 3b. Vehicle model — RECOVERED

The Mach 5 is **not** a generic Havok vehicle. It is a **rigid-body chassis with a four-point
raycast hover suspension**, driven by custom forces. This resolves the question previously left open.

Recovered from `BehaviorScript 25 — doMach5`, handlers `prepareCar`, `updateHover`, `updateCar`.

### Suspension

`updateHover` casts a ray straight down from each of four wheel points against the track segment
models. When the hit distance is below the rest height, it applies an impulse at that wheel point
proportional to compression and damped by the point velocity along the contact direction, scaled by
chassis mass. A per-wheel contact flag is recorded; their sum over four wheels forms `pPowerCoeff`,
which gates how much drive authority the car has — so a car with wheels in the air loses power
proportionally.

### Tuning constants

| Constant | Value | Note |
|---|---|---|
| `pMaxSpeed` | `69` | also published as the global `gM5MaxSpeed` |
| `pAccGain` | `0.1`, then `0.07` | reassigned in `prepareCar` |
| `pDecGain` | `0.02`, then `0.04` | reassigned in `prepareCar` |
| `pBrakeGain` | `0.3` | |
| `pCarMass` | `30000` | |
| `pStrength` | `3.0` | suspension spring |
| `pDamping` | `0.05` | suspension damper |
| `pHoverDist` | `1.2` | suspension rest height |
| `pWheelRadius` | `0.35` | |
| `pFrontWheelBase` / `pBackWheelBase` | `1.2` / `1.2` | |
| `pwidth` | `1.55` | track width |
| `pMaxWheelTurn` | `45` | degrees |
| `pWheelSpinCoeff` | `2` | visual wheel spin |
| `pTurnBuildFactor` | `0.3` | steering builds over time rather than snapping |
| `pGripFactor` | `10` | |
| `pScalar` | `1.0` | |

### Surface-dependent grip and drag — RECOVERED

`pGrip` and `pDrag` are reassigned per surface state inside `updateCar`. Observed value pairs
include grip `0.016` (lowest — a low-traction state), `0.8`, and `1`; drag `0.5`, `0.75` and `1.0`.
**UNKNOWN:** the exact surface each pair corresponds to; the branch conditions have not yet been
fully traced.

### Declared but unused

`pTurnGain`, `pXtraTurnGain`, `pMaxTurnSpeed`, `pMinTurnSpeed` and `pBoost` are declared as
properties of `doMach5` but **never assigned** in it. They appear to be inherited from the
behaviour shared with `doEnemy`. Do not implement them as if they were active.

## 4. Core loop state — INFERRED

| Symbol | Interpretation |
|---|---|
| `gScore` | player score |
| `gDamage`, `gDamageDisplayed` | damage value and its HUD representation |
| `gOxygen`, `gOxygenDisplayed`, `gOxygenMODE` | oxygen value, display, and a mode flag |
| `gPosition` | race position |
| `enemiesRemaining`, `enemiesFinished`, `enemyPositionsList`, `enemyDistArr` | rival tracking |
| `isGameOver`, `hasFinished`, `isGamePlaying`, `isStarted` | run state |
| `gLevelStartTIMER`, `ticks` | timing |
| `isUnderWater` | submersion state |
| `gameLevel`, `gameLighting` | level and lighting selectors |
| `GAMEMODE`, `PREPMODE`, `CAMERAMODE`, `SCOPEMODE` | mode state machines |

---

## 5. Input — INFERRED

Named key constants: `kForward`, `kBackward`, `kRight`, `kLeft`, `kJacks`, `space`.

**UNKNOWN:** the actual key bindings, and whether gadgets beyond Jacks had dedicated keys.

---

## 6. The Mach 5 — INFERRED

### Model parts

`pCarShell`, `pCarWindshield`, `pCarShield`, `pCarJacks`, `pCarScopeDoor`, `pCarScopeTop`,
`pCarScopeBar`, `pCarSaws`, `pCarLights`, `pGripA`–`pGripD`, `pRobot`, `pShadow`,
`pWheelA`–`pWheelD`, `pCarCollider`.

### Gadgets

Seven HUD slots, corroborated by both model parts and interface art
(`Interface_Pic_*` / `Interface_Txt_*`):

| Gadget | Supporting symbols |
|---|---|
| Blades | `pCarSaws`, `blades`, `Snd_M5BladesOn/Loop/Off`, `m5_blades_*` |
| Deflector | `pCarShield` |
| Frogger | `Interface_Pic_Frogger`, `Interface_Txt_Frogger` |
| Grip | `pGripA`–`pGripD`, `Snd_M5Grip`, `m5_grip_tires` |
| Jacks | `pCarJacks`, `kJacks`, `Snd_M5Jump`, `m5_jump` |
| Lights | `pCarLights`, `Snd_M5Lights` |
| Robot | `pRobot`, `doPickupRobot`, `robot_launch`, `robot_fly`, `Snd_Robot1/2` |

Also present: a **Parascope** (`pCarScopeDoor`, `pCarScopeTop`, `pCarScopeBar`, `m5_parascope`,
`Snd_M5Parascope`) with its own camera overlays — see §9.

**UNKNOWN:** each gadget's actual effect, duration, cost and cooldown.

---

## 7. Track — INFERRED

The track appears to be **segment-streamed** rather than one monolithic level.

| Symbol | Interpretation |
|---|---|
| `SEG_PIC`, `SEG_TRK`, `SEG_OBJ`, `SEG_TRE` | segment categories: scenery, track, objects, trees |
| `gSEG`, `tSEG`, `tSEG1`, `tSEG2` | segment state |
| `doUpdatePlace`, `myPlace`, `gPosition` | position along the track |
| `doM5ChangeSegment`, `doEnemyChangeSegment` | segment transition for player and rivals |
| `ovPlace_L`, `ovPlace_R`, `ovPlace_1`, `ovPlace_2`, `ovPlace_3` | position overlays |

**Segment length is `300` world units — RECOVERED.** `updateHover` derives the current segment as
`integer(worldWheelPoint.y) / 300 + 1`, and within 2 units of a segment boundary it raycasts against
*both* the current and the adjacent segment model, so wheels straddling a seam still find ground.
The track therefore advances along **+Y**.

**UNKNOWN:** segment count, how segments are authored, and the overall track layout.

---

## 8. World interaction — INFERRED

### Pickups

`handlePickups`, `doPickupWrench` (repair), `doPickupCandyPurple`, `doPickupCandyRed`,
`doPickupOxegen` *(spelling as in the original)*, `doPickupRobot`.

Supporting art: `Interface_Pic_Candy`, `Interface_Pic_Sparky`, `Interface_Pic_O2`.
Supporting audio: `Snd_Candy`, `Snd_Repair`.

**UNKNOWN:** the value each pickup grants.

### Hazards and props

`gWaterObj`, `gDeadTreeList`, `doHitTree`, `doFaller`, `myFaller`, `gExplosionSet`,
`cloneModelFromCastmember`, `pathList`, `pickupObj`.

### Particles and effects

`particle_water`, `particle_bubble`, `particle_dirt`, `particle_mud`, `water_ripple`,
`snow_flake`, and a 50-frame explosion sprite sheet `kaboom0001`–`kaboom0050`.

### Rival

`gCarDuggery`, `duggaryIntro`, `duggaryBuild`, `HitDuggary_2`, `duggery_too_bad`,
`gCarSkinsArr`, `gCarsList`, `enemyScriptArr`.

**INFERRED:** a scripted opponent car rather than a physics-driven AI. "Duggery" appears to be an
in-house name. **UNKNOWN:** the rival's behaviour model.

---

## 9. Camera — INFERRED

`mCamera`, `mCamera2`, `doCamera`, `newCamera`, `projectionAngle`, `colorBuffer`, `clearAtRender`.

At least two modes: a chase camera and a **periscope** mode (`SCOPEMODE`), the latter with
dedicated overlays `ov_scopecam_frame`, `ov_scopecam_under`, `ov_scopecam_static`.

**UNKNOWN:** camera follow distance, damping, field of view.

---

## 10. HUD

Two sets of observations, recorded separately. **The rendering path is UNKNOWN.**

### Overlay-related symbols — VERIFIED (symbols)

`addOverlay`, `removeOverlay`, `gOverlays`, and the `ovInterface_*` family:
`ovInterface_Panel`, `ovInterface_bracket_L/_R`, `ovInterface_Txt`, `ovInterface_Pic`,
`ovInterface_DamageBar`, `ovInterface_DamageBarEnd`, `ovInterface_OxygenBar`,
`ovInterface_OxygenBarEnd`, `ovOxygen_Panel`, `ovScore_1`–`ovScore_6`, `ovHelp`.

### HUD bitmap resources — VERIFIED (cast names)

`Interface_Panel`, `Interface_Info`, `Interface_bracket_L/_R`, `Interface_DamageBar`,
`Interface_DamageBarEnd`, `Interface_OxygenBar`, `Interface_OxygenBarEnd`,
`Interface_OxygenPanel`, the `Interface_Pic_*` / `Interface_Txt_*` gadget icons, and the digit art
`Digit_0`–`Digit_9`, `BigDigit_0`–`BigDigit_9`, `BigDigit_th` — all PNG.

### What this does not establish

**UNKNOWN:** whether the HUD is composited as 3D camera overlays, drawn as 2D sprites, rendered
through the Flash members, or some combination. The symbols above are consistent with a camera
overlay approach but do not prove it. Resolving this requires analysing the relevant Lingo
handlers.

---

## 11. Audio — VERIFIED (names) / INFERRED (roles)

63 `snd ` resources in `SR_level_1.dcr`. Named cues include:

- **Engine and driving:** `Snd_M5EngineStart`, `Snd_M5EngineLoop`, `Snd_SkidPav`, `Snd_SkidDrt`,
  `loop_skid_pavement`, `loop_skid_dirt`, `drive_takeoff`, `m5_drive_by1/2`
- **Gadgets:** `Snd_M5Jump`, `Snd_M5BladesOn/Loop/Off`, `Snd_M5Grip`, `Snd_M5Parascope`,
  `Snd_M5Lights`
- **Impacts:** `Snd_Crash1/2/3`, `crash_sm`, `crash_sm2`, `crash_lg`, `Snd_HitReaction_1`–`_5`
- **Water:** `Snd_FX_Splash`, `Snd_FX_Underwater`, `Snd_FX_InWater`, `loop_underwater`,
  `_inwater_splash`, `_inwater_loop`
- **Music:** `Snd_MusicLoop1`–`Snd_MusicLoop5`, `Snd_MusicGoSpeedGo`, `Snd_MusicGameOver`,
  `music_intro`, `music_gospeed`
- **Voice:** `Snd_WhereistheCar`, `Snd_NowitsGone`, `Snd_ThatsaRobot`, `Snd_WrongWay`,
  `Snd_EnemyScream`, and many `sp_*` / `spr_*` / `spa_*` lines
- **Announcer:** `announcer_StandBy`, `announcer_GetReady`, `announcer_m5_wins`

Sound channels: `SndC_Music`, `SndC_M5Engine`, `SndC_M5Grnd`, `SndC_M5FX`, `SndC_M5FX2`,
`SndC_EnemyFX`, `SndC_VO`.

---

## 12. Presentation — INFERRED

| Property | Reading | Status |
|---|---|---|
| Stage rect | `DRCF` read big-endian: top 320, left 384, bottom 704, right 896 → **512 × 384 (4:3)** | **INFERRED** — byte order unconfirmed |
| Frame rate / tempo | `TODO(unverified)` | **UNKNOWN** |
| Renderer path **available** | `getRendererServices`, `directX7_0`, `fullScene`, `hardwareAntialiasing`, `sw3dbaddriverlist` | **VERIFIED** (symbols). Evidence of an available hardware Direct3D 7 path — **not** evidence of observed runtime behaviour |
| Texture formats | `rgba8880`, `rgba4444`, `rgba5551`, `rgba5550` | **VERIFIED** (symbols) |

---

## 13. Structure beyond the race — INFERRED

- **Mini-games:** `doLaunchMiniGame`, with `MEDIA/JIGSAW.dcr` and `MEDIA/SLIDERS.dcr`.
  **INFERRED:** each contains a single SWF payload larger than its own compressed movie
  (941078 and 1047256 bytes respectively), suggesting the mini-games are Flash content inside a
  thin Director shell rather than Director-native games. See `asset-catalog.md` §3.
- **Dual distribution:** `doBuyNow`, `doGetWallpaper`, `reportScore`, `gotoNetPage`, `isProjector`,
  `shockmachineversion`, `getStreamStatus`, `dirBytesLoaded` → one codebase served both the free
  streamed web build and the paid download.

---

## 14. What must be recovered before implementation

| Item | Status | Next step |
|---|---|---|
| All physics constants | **UNKNOWN** | decompile `Lscr` |
| Vehicle handling model | **UNKNOWN** | decompile `Lscr` |
| Gadget effects and durations | **UNKNOWN** | decompile `Lscr` |
| Pickup values | **UNKNOWN** | decompile `Lscr` |
| Damage and oxygen rules | **UNKNOWN** | decompile `Lscr` |
| Rival behaviour model | **UNKNOWN** | decompile `Lscr` |
| Segment count and layout | **UNKNOWN** | decompile + W3D inspection |
| Stage size and tempo | **INFERRED** | decompile `DRCF` |
| Key bindings | **UNKNOWN** | decompile `Lscr` |
