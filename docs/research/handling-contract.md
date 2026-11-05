# Handling Contract

Status tags follow `docs/research/project-brief.md`.

The behaviour the reimplementation must reproduce, with every number traced to its source.
Recovered from decompiled Lingo in `SR_level_1.dcr`, chiefly `BehaviorScript 25 — doMach5`. The
decompiled source is in `original_game/decompiled/`.

> **Nothing here is OBSERVED.** The original game has still never been executed. These are values
> and control flow read out of recovered source, not measurements of play.

---

## 1. The model in one paragraph

A **rigid-body chassis with zero contact friction and zero restitution**, held above the track by a
**four-point raycast hover suspension**, driven by a **proportional speed controller** and steered
by **angular impulses on the Z axis** with a build-up ramp and a speed-dependent yaw-rate limiter.
The physics engine integrates and resolves collisions; the behaviour supplies every force that
determines feel.

---

## 2. Constants — RECOVERED

All from `prepareCar` / `beginSprite` unless noted.

| Constant | Value | Role |
|---|---|---|
| `pMaxSpeed` | `69` | target speed, also exported as global `gM5MaxSpeed` |
| `pAccGain` | `0.07` | proportional gain on acceleration (set to `0.1` in `beginSprite`, then overwritten by `prepareCar`) |
| `pDecGain` | `0.04` | declared; set to `0.02` then `0.04` |
| `pBrakeGain` | `0.3` | declared |
| `pCarMass` | `30000` | authored mass; the runtime uses `pChassisRB.mass` |
| `pStrength` | `3.0` | suspension spring |
| `pDamping` | `0.05` | suspension damper |
| `pHoverDist` | `1.2` | suspension rest height and ray length |
| `pWheelRadius` | `0.35` | |
| `pFrontWheelBase` / `pBackWheelBase` | `1.2` / `1.2` | |
| `pwidth` | `1.55` | track width |
| `pMaxWheelTurn` | `45` | degrees, visual wheel deflection |
| `pWheelSpinCoeff` | `2` | visual wheel spin |
| `pTurnBuildFactor` | `0.3` | steering ramp rate |
| `pGripFactor` | `10` | |
| `pScalar` | `1.0` | |

### World — RECOVERED

| Constant | Value | Source |
|---|---|---|
| Gravity | `vector(0, 0, -90.81)` | `BehaviorScript 2 — Havok Physics`, `beginSprite` |
| Configured timestep | `0.025` s | same, property default `pTimeStep` |
| Sub-steps | `5` | same, property default `pSubSteps` |
| Collision tolerance | `4` | same, property default `pTolerance` |
| World scale | `1.0` | same, property default `pScale` |
| Deactivation | `[5.0, 0.1]` | `BehaviorScript 19 — INIT` |
| Chassis friction | `0` | `BehaviorScript 25 — doMach5`, `prepareCar` |
| Chassis restitution | `0` | same |
| **Movie frame rate** | **`30`** | `DRCF` config chunk, `SR_level_1.dcr` and `SR_MAIN.dcr` |
| **Stage** | **`512 × 384`** | same |

---

## 2b. The simulation cadence — RECOVERED, and it is not what "0.025 s" suggests

> **Correction.** An earlier revision of this document described the configured timestep as
> "0.025 s (40 Hz)". That inferred a simulation frequency from a timestep value without checking
> the invocation schedule. The schedule has now been traced and the inference was wrong.

### The call chain

The entire Havok driver is one behaviour, `BehaviorScript 2 — Havok Physics (Inserted HKE)`,
attached to the Shockwave 3D sprite:

| Handler | What it does |
|---|---|
| `beginSprite` | resolves the Havok cast member, shuts down any existing instance, calls `Initialize(sprite.member, pTolerance, pScale)`, publishes the instance as the global `gHavok`, sets gravity, clears the pause flag |
| `exitFrame` | **if not paused, calls `step(pTimeStep, pSubSteps)` — once, unconditionally** |
| `endSprite` | shuts the instance down |
| `setPause` | sets the pause flag |

### What this establishes

1. **The world is advanced exactly once per Director frame.**
2. **There is no accumulator and no elapsed-time logic anywhere.** Each frame advances the same
   fixed amount of *simulated* time regardless of how long the frame actually took.
3. The movie's configured frame rate is **30**.

So the five quantities the configured timestep could have meant are now distinct:

| Quantity | Value |
|---|---|
| Configured timestep | `0.025` s of simulated time per call |
| Sub-steps per call | `5` |
| Frequency the world is advanced | **once per Director frame → 30 per second at the configured tempo** |
| Frequency forces and impulses are applied | **once per Director frame**, same cadence |
| Director event cadence | `enterFrame` then `exitFrame`, 30 per second nominal |

### The consequence

At the configured tempo, the simulation advances **30 × 0.025 = 0.75 seconds of simulated time per
real second**. Simulated time runs at **three quarters of real time**, and every per-update constant
in this contract is denominated in *frames*, not seconds.

### `step()` semantics — RESOLVED from primary documentation

The *Havok Xtra Lingo Reference Guide* (Havok.com, 2000/2001) documents
`hkWorld.step(TimeIncrement, NumOfSubsteps)`:

> "This function **steps the physical simulation by the time increment** and uses the specified
> number of sub-steps to supersample and **split that interval into smaller units**."

So `TimeIncrement` is the **total** simulated time per call, subdivided by the substeps — not per
substep. The earlier 5× ambiguity is closed: each call advances **0.025 s**, in five internal
sub-steps of 0.005 s.

The same guide states the intended idiom:

> "To achieve approximate real-time performance you should step the simulation according to the
> frame rate of the movie. For example, for a Director tempo of 60 fps you should step the world
> 0.0167 seconds each frame = 1.0 / 60."

**By that formula, `0.025` corresponds to a 40 fps tempo — but this movie's tempo is 30.** The game
therefore does not step in real time by its own engine's documented convention. Whether that was
deliberate, a leftover from an earlier tempo, or simply tuned by feel is **UNKNOWN**.

The guide also confirms the frame-rate caveat directly:

> "The frame rate specified in Director is not necessarily the actual frame rate at which the movie
> plays. It depends on how long it takes Director to render…"

So the original was **frame-rate coupled by construction**, and `30 fps` is a target, never a
guarantee.

### Force versus impulse — RESOLVED from the same guide

> `applyForce(force)` — "applies a force to a rigid body at its center of mass… An example
> application of applying a force would be applying the brakes in a car, **which takes time to have
> an effect**."
>
> `applyImpulse(impulse)` — "An impulse, **unlike a force, has an immediate effect on the velocity**
> of the rigid body."

A force is integrated across the step; an impulse changes velocity at once. The arithmetic in §4
holds.

**UNKNOWN, and still open:**

- The relative order of `exitFrame` handlers is determined by **sprite channel order in the score**.
  The score chunk (`VWSC`) *is* present — 5872 bytes in `SR_level_1.dcr`, recovered from the
  movie's initial load segment — but has not yet been parsed. Whether the drive forces applied in
  `doMach5.exitFrame` land *before* or *after* the Havok step in the same frame remains unresolved,
  and a one-frame latency difference changes the feel of the controller.

---

## 2c. Update-frequency dependence — audit

Every constant below is applied **once per Director frame**. None is scaled by elapsed time, and
no handler anywhere reads a clock to compute a delta. Classification:

| Mechanic | Value | Classification |
|---|---|---|
| Suspension spring and damper | `pStrength 3.0`, `pDamping 0.05` | **Simulation-step-dependent** — applied as impulses once per step |
| Throttle force | `× 60` literal | **Simulation-step-dependent**, and the literal encodes an assumed rate (§4) |
| Coast deceleration | `0.06` / `0.9` | **Director-frame-dependent** — a per-frame fraction of velocity; at a different frame rate the car coasts differently |
| `pTurnBuild` increment | `pTurnBuildFactor × 0.03` per update | **Director-frame-dependent** — the ramp reaches its 0.75 cap in a fixed number of *frames*, not seconds |
| `pTurnBuild` decay | `−0.2` per update, floor `0.2` | **Director-frame-dependent** |
| Z angular damping | `× 0.84` per update | **Director-frame-dependent** — a geometric decay per frame |
| Self-righting velocity cut | `× 0.1` per update | **Director-frame-dependent** |
| Underwater damage | `+0.3` per update | **Director-frame-dependent** |
| Oxygen drain | `−0.2` per update | **Director-frame-dependent** |
| Oxygen-starvation damage | `+0.3` per update | **Director-frame-dependent** |
| Damage/oxygen bar easing | `30%` of the gap per update | **Director-frame-dependent** (cosmetic) |
| Overlay fades | `5`, `10`, `30` per update | **Director-frame-dependent** (cosmetic) |
| Jacks cooldown | `80` ticks | **Time-independent** — measured against `the ticks`, a real clock |
| Collision debounce | `60` ticks | **Time-independent** — same clock |
| Finish line, wrong-way threshold, fall death | `10921`, `100`, `z ≤ −10` | **Time-independent** — positional |
| Damage and score awards | fixed amounts | **Time-independent** — event-driven |

**The consequence for the port.** The two tick-based timers are the *only* mechanics with real-time
semantics. Everything else is per-frame, so at any frame rate other than the original's the car
steers, coasts, drowns and takes water damage at a different real-world rate. A fixed-timestep
simulation is therefore not merely good practice here — it is required to reproduce the behaviour
at all.

**RESOLVED.** The *Macromedia Director MX Lingo Dictionary* defines a tick as **a 60th of a
second**. So the Jacks cooldown of 80 ticks is **≈1.333 s** and the collision debounce of 60 ticks
is **1 s** — both in real time, independent of frame rate and of the physics step.

This is the one place where the original has genuine wall-clock semantics, and it is worth
preserving exactly: at a different frame rate everything else drifts, but these two do not.

---

## 3. Suspension — RECOVERED

Per update, for each of four wheel points, in `updateHover`:

1. Transform the wheel point into world space and cast a ray straight down, limited to
   `maxDistance 1`, against the **track segment model only** — not the whole scene.
2. Near a segment seam (within 2 units of either end of a 300-unit segment) the ray is cast against
   **both** the current and the adjacent segment, so a wheel straddling a join still finds ground.
3. If the hit distance is below `pHoverDist`, apply an impulse at that wheel point:
   - spring term proportional to compression `(pHoverDist − hitDistance)`, scaled by `pStrength`
   - damper term proportional to the wheel point's velocity projected onto the contact direction,
     scaled by `pDamping`
   - the whole impulse multiplied by **chassis mass**
4. Record a per-wheel grounded flag.

### `pPowerCoeff` — authoritative description, RECOVERED

Every read and write was traced in `doMach5`. One write, nine reads.

**Written** once per update, at the top of `updateCar`: the sum of the four grounded flags; if
non-zero it is then divided by 4, so the value is `0`, `0.25`, `0.5`, `0.75` or `1`. **When no wheel
is grounded it stays at the raw sum, which is `0`** — the division is skipped, which is harmless
only because the sum is zero in that branch.

**Read** for:

| Use | Condition | Effect |
|---|---|---|
| Throttle authority | `> 0` required | gates the whole throttle branch |
| Reverse authority | `> 0` required | gates the reverse branch |
| Coast deceleration | multiplier | deceleration scales **linearly** with wheels on the ground |
| Jacks eligibility | `= 1` required | all four wheels must be grounded to jump |
| Jacks retraction | `> 0` required | the jack model retracts only once a wheel is grounded again |
| Airborne self-righting | `< 1` required | both the dashpot and the angular-velocity cut |
| Fall death | `= 0` required | combined with `z ≤ −10` and track face `99` |
| Wheel/visual branch | `≠ 1` and `= 1` | two cosmetic branches |

**Correction to earlier documentation:** `pPowerCoeff` does **not** scale braking in the sense of
the reverse input — the reverse impulse is *not* multiplied by it; only the *coast* deceleration is.
Reverse is gated by it but not scaled. The earlier wording conflated the two.

The same derived value exists in `doEnemy` with the same construction, where it additionally scales
a lateral anti-slide impulse that has no counterpart in `doMach5`.

---

## 4. Drive — RECOVERED

Applied each `exitFrame`, after `updateHover` runs on `enterFrame`.

**Throttle held, moving forward or stationary:**
the controller targets `pMaxSpeed × pDrag` and applies a **force** along world-forward proportional
to the error, scaled by `pAccGain`, by chassis mass, by `min(1, pGrip)`, and by a factor of **60**.

**Throttle held while moving backwards:** a fixed force of `pAccGain × 2 × pMaxSpeed × mass`
forward, likewise grip-limited and ×60 — a strong arrest rather than a proportional term.

**Reverse held:** targets `−pMaxSpeed × pDrag` with gain `pAccGain × 1.1`, applied as an
**impulse**, not a force.

**No input (coast):** a decelerating impulse opposing forward velocity, scaled by `pPowerCoeff`:
factor `0.06` while `|forwardVel| > 1`, and `0.9` below that — so the car stops crisply at low
speed instead of creeping.

### Every force and impulse call in `doMach5` — RECOVERED

All in `BehaviorScript 25 — doMach5`. Invocation frequency is **once per Director frame** for
everything in `updateCar` and `updateHover`; `collisionHandler` and `keyDown` are event-driven.

| Handler | Kind | Expression | Gated by |
|---|---|---|---|
| `updateHover` | impulse at point | `(spring + damper) × chassisMass`, per wheel | hit distance below `pHoverDist` |
| `updateCar` — throttle, moving forward | **force** | `(pMaxSpeed × pDrag − forwardVel) × pAccGain × chassisMass × forward × min(1, pGrip) × 60` | `pPowerCoeff > 0` |
| `updateCar` — throttle, moving backward | **force** | `pAccGain × 2 × pMaxSpeed × chassisMass × forward × min(1, pGrip) × 60` | `pPowerCoeff > 0` |
| `updateCar` — reverse | impulse | `(−pMaxSpeed × pDrag − forwardVel) × (pAccGain × 1.1) × chassisMass × forward` | `pPowerCoeff > 0` |
| `updateCar` — coast, `\|v\| > 1` | impulse | `−forwardVel × chassisMass × forward × 0.06 × pPowerCoeff` | no input |
| `updateCar` — coast, `\|v\| ≤ 1` | impulse | `−forwardVel × chassisMass × forward × 0.9 × pPowerCoeff` | no input |
| `updateCar` — steering | angular impulse | `chassisMass × tPercentAng × pTurnBuild` about Z | `isPlaying` |
| `updateCar` — self-righting | angular impulse | `−angularMomentum × 0.5` | `pPowerCoeff < 1` and attitude past 30° |
| `keyDown` — Jacks | impulse | `chassisMass × 40` on world Z | `pPowerCoeff = 1`, not already active |

**Only the two throttle paths use `applyForce`. Everything else uses impulses.** That distinction is
load-bearing and must survive the port.

### The literal `60` — best-supported explanation, not proven

A force integrated over a step of `dt` delivers an impulse of `force × dt`.

- With the configured `dt = 0.025`, the `× 60` yields an effective impulse of `base × 1.5`.
- Had the author assumed `dt = 1/60`, it would yield exactly `base × 1.0`.

**Best-supported reading:** the `60` is a *per-second to per-step* conversion written under the
assumption of a 60 Hz step, applied to a world actually configured at `0.025 s`. Under that reading
the throttle delivers **1.5× the impulse the author's arithmetic intended** — and the movie then ran
at 30 fps, a third rate again.

**This is a hypothesis.** It is not settled, because:

- The Havok Xtra's exact `applyForce` semantics — whether the force persists until the next step, is
  consumed by one step, or is scaled internally — are not recoverable from this source.
- Whether `step(timestep, substeps)` advances `timestep` in total or per substep is unknown (§2b).
- The ordering of force application versus the step within a frame is unknown (§2b).

**Do not port the `60` literally, and do not replace it with `40` or `30`.** The correct action is
to reproduce the *observable behaviour* — reaching `pMaxSpeed` in a comparable time and distance —
and record the chosen constant as a **designed substitute**, not a recovered value. Settling it for
real needs either Havok Xtra documentation or a reference capture of the original running.

---

## 5. Steering — RECOVERED

Steering is a **yaw impulse**, not a wheel-angle simulation. The visual wheel deflection
(`pMaxWheelTurn = 45°`) is cosmetic.

- Holding a direction ramps `pTurnBuild` upward by `pTurnBuildFactor × 0.03` per update, clamped
  to **0.75**.
- Releasing decays it by `0.2` per update, with a floor of `0.2`.
- Each update applies an angular impulse about Z of magnitude `mass × tPercentAng × pTurnBuild`.
- `tPercentAng` is a **speed-dependent yaw-rate limiter**: it falls toward zero as the current yaw
  rate approaches `forwardVel × 0.07`, so turn authority shrinks as the car already rotates fast.
  At zero yaw rate it is `1`.
- A separate branch ramps `pTurnBuild` to a cap of **1.0** in steps of `0.2`. **UNKNOWN:** the exact
  condition — the surrounding control flow has not been fully traced.
- Z angular velocity is multiplied by **0.84** every update — a constant yaw damping.

---

## 6. Surfaces — PARTIALLY RECOVERED

`effectID` is assigned from `pTrackFace`, which is the **face index returned by the suspension
raycast** on the rear wheel. It selects grip and drag.

| `effectID` | `pGrip` | `pDrag` | Associated texture / sound | Likely surface |
|---|---:|---:|---|---|
| `8, 9, 14, 15` | **0.016** | `1` | water particle texture, skid sound | shallow water skim — **INFERRED** |
| `4` | `0.8` | `1` | dirt particle texture, skid sound | dirt — **INFERRED** |
| `12` | `1` | `0.75` | splash sound, camera fog, underwater damage | deep water — **INFERRED** |
| `1, 2, 6, 7, 10, 13` | `1` | `1.0` | — | road / pavement — **INFERRED** |
| `3` | `1` | `0.5` | — | heavy-drag surface, perhaps tall grass or mud — **INFERRED** |
| otherwise | `1` | `1.0` | — | default |

> **UNKNOWN — the ID-to-name mapping.** The movie declares globals named `gEffectRoad`,
> `gEffectDirt`, `gEffectMud`, `gEffectSnow`, `gEffectGrass`, `gEffectTallGrass`, `gEffectWater`,
> `gEffectDeepWater` and `gEffectBlack`, but **none of them is ever assigned** in the recovered
> scripts. The numeric IDs are face indices of the W3D track mesh. The surface names in the table
> above are inferred from the particle textures and sounds each branch triggers — they are **not**
> recovered names. Confirming them requires inspecting the track geometry.

Grip enters the drive force as `min(1, pGrip)`, so grip `0.016` cuts drive authority to ~1.6%.
Drag scales the **target speed**, not a resistive force: on a drag-`0.5` surface the car settles at
half top speed rather than decelerating against a force.

---

## 7. Jacks (jump) — RECOVERED

- Triggered by `kJacks`, or the literal keys `a` or `1`.
- **Requires `pPowerCoeff = 1`** — all four wheels grounded.
- Applies an upward impulse of `chassisMass × 40` on world Z.
- Sets a cooldown of **80 ticks** from the moment of use.
- Shows the `pCarJacks` model, plays `Snd_M5Jump`, and raises the HUD text and picture.

**RESOLVED:** a tick is 1/60 s (*Director MX Lingo Dictionary*), so the cooldown is **≈1.333 s** of
real time.

---

## 8. Airborne self-righting — RECOVERED

When not fully grounded (`pPowerCoeff < 1`):

- If pitch exceeds **80°** or roll exceeds **45°**, an angular dashpot named `m5Corrector` is
  created with strength `mass × (max(|pitch|, |roll|) / 90)` and damping `1000`, targeting an
  upright attitude that preserves current yaw. It is deleted once the car is within range again.
- If pitch or roll exceeds **30°**, angular velocity is additionally scaled by `0.1` and an angular
  impulse of `−angularMomentum × 0.5` is applied.

This is why the car in the original rarely stays flipped.

---

## 9. Race state — RECOVERED

| Rule | Value |
|---|---|
| Finish line | `y ≥ 10921` |
| Track direction | **+Y** |
| Segment length | `300` world units → ≈**36.4 segments** |
| Wrong-way warning | current `y` falls more than **100** below the maximum `y` reached |
| Fall death | chassis `z ≤ −10`, no wheels grounded, and track face `99` → game over, jumps to the `CLIFF` frame |
| Underwater damage | on `effectID 12` with camera below water and no Parascope: `gDamage` increases by `0.3` per update, clamped to 100 |

---

## 9b. Collision response — RECOVERED

`collisionHandler me, collisionDetails` in `doMach5`. Registered via `setCollisionCallback`.

**Event data used:** `collisionDetails[2]` is the other model; `collisionDetails[5]` is the hit
force. Classification is by `userData.kind` on the hit model, a property set during `PREP`.

**Debounce:** the entire handler is skipped unless `the ticks ≥ pCollisionTimeout + 60` — **one
second** of real time, since a tick is 1/60 s. On a handled collision, `pCollisionTimeout` is reset
and the model is remembered in `lastHitModel`.

| `kind` | Damage | Other effect |
|---|---|---|
| `"track"` | none | explicitly ignored and returned early — driving on the road never damages |
| `"faller"` | `+ min(30, hitForce × 10)` | plays `Snd_Crash1` |
| `"enemyCar"`, Blades active | `+ min(5, hitForce × 10)` | plays `Snd_Crash1` — Blades reduce the penalty sixfold |
| `"enemyCar"`, no Blades | `+ min(30, hitForce × 10)` | `Snd_Crash1` plus a random voice line from `Snds_HitReactions`, only if the voice channel is free |
| anything else | `+ min(10, 30 × \|forwardVel\| / 90)`, **only if reverse is not held** | Z angular velocity multiplied by `0.2`; crash volume scales with the same magnitude |

**Script-side behaviour that bypasses the engine:** the `0.2` yaw-velocity cut on generic impacts is
applied directly to the rigid body, not left to Havok. Damage is entirely script-side. Holding
reverse during a generic impact **suppresses damage completely** — a recovered quirk, not an
inference.

**For the vertical slice:** `"track"` and the generic branch are required. `"faller"` is required
only if falling props are in the slice. `"enemyCar"` is not.

---

## 9c. Track segments — RECOVERED

Segments are **authored, not generated**. Nothing is created or destroyed at runtime.

### Construction, in `BehaviorScript 20 — PREP`

Four parallel arrays are pre-sized to **exactly 37 empty lists**: `SEG_TRK`, `SEG_OBJ`, `SEG_PIC`,
`SEG_TRE`. The handler then walks every model in the 3D world once and files it by name:

| Name pattern | Destination |
|---|---|
| first 3 chars `SEG` | track and scenery, index taken from **chars 5–6 of the model name** for `SEG_TRK` |
| first 6 chars `Finish` | the finish object |
| `FALLER_NN_OBJ`, with `TGR` at chars 11–13 | a faller trigger; `userData.myFaller` links trigger to object, id from chars 8–9 |
| chars 8+ `Wrench`, `CandyPurple`, `CandyRed`, `Oxegen` | pickups |

For everything except `SEG_TRK`, the segment index is computed from geometry:
`integer(model.transform.position.y) / 300 + 1`. For `SEG_TRK` it is parsed from the **name**.

> **Note on the segment count.** 37 is the array size, read from source — it is **not** derived from
> `10921 / 300`. The two agree (the finish at `y = 10921` falls inside segment 37), which is
> corroboration, not the derivation. How many of the 37 slots are actually populated is **UNKNOWN**
> without inspecting the track geometry.

### Transition, in `doM5ChangeSegment` (`MovieScript 13 — MOVIE`)

Called from `updateCar` when the car's computed segment index changes. It does **not** stream
geometry; it **toggles collision**:

- On first entry it disables collision between the car and *every* track, object and tree model from
  index 2 onward, then enables only the current segment.
- On each subsequent change it disables the car's collision with the outgoing segment's track,
  objects and trees, and enables it for the incoming one. Scenery (`SEG_PIC`) collision is toggled
  the same way.

So at any moment the car can only collide with the contents of its own segment. This is a
performance strategy, and it has a gameplay consequence worth preserving: **objects in adjacent
segments are intangible.**

`doEnemyChangeSegment` is the rival's equivalent.

### Starting coordinate

**UNKNOWN.** The source computes segment indices from `y` but the starting `y` is set by the
authored position of the Mach 5 model in the W3D world, which has not been inspected.

---

## 9d. Race rules — RECOVERED

Sources: `BehaviorScript 21 — PLAY` (per-frame rules), `MovieScript 33 — handlePickups`,
`MovieScript 34 — doUpdateScore`, `MovieScript 37 — doDisplayDamage`,
`MovieScript 38 — doDisplayOxygen`, `doMach5`.

### Damage

| Rule | Value |
|---|---|
| Range | `0`–`100` |
| Displayed value | eases toward the real value by **30% of the gap per update**, snapping when within `0.5` |
| Death | when the **displayed** value reaches `100` — not the real value |
| On death | `isGameOver = 1`, `isPlaying = 0`, audio fades over 1000 ms, a black overlay fades in at 5% per update |
| Repair pickup | `−50`, clamped at 0, `+500` score |
| Oxygen starvation | `+0.3` per update while displayed oxygen is at 0 |
| Underwater without Parascope | `+0.3` per update, clamped to 100 |

### Oxygen

| Rule | Value |
|---|---|
| Initial | `100`, mode `0` (hidden) |
| Underwater | mode `1`, drains `0.2` per update, clamped at 0 |
| Surfacing | mode `2` — the panel fades out at 10% per update |
| Pickup | `+50`, clamped to 100 |
| Low warning | voice line fires when the displayed value crosses **below 25** |
| Panel fade-in | 30% per update |

### Score

Six digits, rendered by swapping texture overlays `Digit_0`–`Digit_9`; maximum displayable
`999999`. Recovered awards: repair pickup `+500`, finishing **first** `+5000`.
**UNKNOWN:** the remaining award values — other pickup branches were not traced.

### Finish

`doFinish` fires from `updateCar` when `y ≥ 10921` while playing. Sets `hasFinished`, awards the
first-place bonus if `gPosition = 1`, plays the win or lose voice line, then the same game-over
fade as death.

### Fall death

Chassis `z ≤ −10` **and** `pPowerCoeff = 0` **and** track face `99` → immediate game over and a jump
to the `CLIFF` frame. The track-face sentinel `99` is what distinguishes a fall from simply being
airborne.

### Wrong way

`updateCar` tracks the maximum `y` ever reached. If current `y` falls more than **100** below it and
no interface message is showing, the warning text and `Snd_WrongWay` fire. The maximum resets to
current `y` at that moment.

---

## 10. Declared but never assigned — do not implement

`pTurnGain`, `pXtraTurnGain`, `pMaxTurnSpeed`, `pMinTurnSpeed`, `pBoost` are properties of
`doMach5` that are **never assigned** in it. They appear to be inherited from the behaviour shared
with `doEnemy`. Implementing them as active parameters would be inventing mechanics.

Likewise `pDecGain`, `pBrakeGain`, `pGripFactor`, `pScalar` and `pWheelSpinCoeff` are assigned but
their consumers have **not** been located in the traced handlers. Treat them as unconfirmed until
the remaining control flow is read.

---

## 11. Open items before this contract can drive an implementation

| # | Item | Status |
|---|---|---|
| 11.1 | The `×60` factor and the force/impulse unit convention | **UNKNOWN** — largest translation risk |
| 11.2 | Whether gravity `90.81` implies a non-metric world scale or arcade weighting | **UNKNOWN** |
| 11.3 | The surface ID-to-name mapping | **UNKNOWN** — needs track geometry |
| 11.4 | The condition selecting the `1.0`-cap steering branch | **UNKNOWN** |
| 11.5 | Consumers of `pDecGain`, `pBrakeGain`, `pGripFactor`, `pScalar` | **UNKNOWN** |
| 11.6 | Director tick rate for this build, for the Jacks cooldown | **UNKNOWN** |
| 11.7 | Collision response — `collisionHandler` has not yet been traced | **UNKNOWN** |

None of these blocks a prototype. All of them must be resolved, or explicitly marked as designed
substitutes, before the result can be called faithful.
