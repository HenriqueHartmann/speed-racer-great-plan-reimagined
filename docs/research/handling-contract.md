# Handling Contract

Status tags follow `docs/research/project-brief.md`.

The behaviour the reimplementation must reproduce, with every number traced to its source.
Recovered from decompiled Lingo in `SR_level_1.dcr`, `BehaviorScript 25 — doMach5`. The decompiled
source is held locally in the gitignored `original_game/` and is not part of this repository.

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
| Gravity | `vector(0, 0, -90.81)` | `BehaviorScript 2 — Havok Physics` |
| Fixed timestep | `0.025` s (**40 Hz**) | same, property default `pTimeStep` |
| Sub-steps | `5` | same, property default `pSubSteps` |
| Collision tolerance | `4` | same, property default `pTolerance` |
| World scale | `1.0` | same, property default `pScale` |
| Deactivation | `[5.0, 0.1]` | `BehaviorScript 19 — INIT` |
| Chassis friction | `0` | `prepareCar` |
| Chassis restitution | `0` | `prepareCar` |

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

### `pPowerCoeff` — the single most important derived value

The sum of the four grounded flags, divided by 4. It gates drive authority, braking and the
self-righting logic. A car with two wheels in the air has half the drive force. `pPowerCoeff = 1`
(all four grounded) is also the **precondition for the Jacks jump**.

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

> **UNKNOWN — the unit question.** Director's Havok distinguishes `applyForce` (continuous) from
> `applyImpulse` (instantaneous), and the drive path mixes both. The literal `60` suggests a
> per-second conversion assuming 60 updates per second, while the physics step is configured at
> `0.025 s` (40 Hz). Whether the original was frame-rate coupled, and how the two rates interacted,
> has **not** been determined. **Do not port the `60` literally** without resolving this; it is the
> single largest translation risk in the contract.

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

**UNKNOWN:** Director's `the ticks` is 60 per second on the platforms this targeted, making the
cooldown ≈1.33 s — but that rate has not been confirmed against this build.

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
