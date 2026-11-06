# Pre-implementation audit — the rivals

**Status:** audit only. Nothing implemented, nothing refactored, nothing committed
beyond this file. Working tree otherwise clean.
**Date:** 2026-11-05
**Against:** `docs/design/2026-11-05-rival-ai.md` at `2c0cb63`.

---

## 1. Executive verdict

**Ready to prototype, after one prerequisite — and the prerequisite is not the
one the design named.**

The design flagged ground-query cost as the risk that could sink the work and
proposed a spatial index as the remedy. Measured, the cost is real but its cause
is not the algorithm: **two `Math.hypot` calls per triangle, evaluated before any
rejection test, are about 80% of the query.** Replacing them with the equivalent
squared-magnitude comparison is 5.1× to 6.8× faster with byte-identical results
on all 37 segments. No spatial index is needed for four vehicles.

The genuine blocker is elsewhere and the design did not see it:
**`SegmentColliders` and `PropColliders` each hold one `active` segment, globally.**
That is a single-vehicle collapse of a mechanism the original expressed
*per pair* (`gHavok.disableCollision(carName, segmentName)`). With four vehicles
in four different segments it cannot work as written — whichever segment is
enabled, three vehicles are over nothing. This must be reworked to Rapier
collision groups before the first rival exists, exactly as `segmentIndexFor` had
to be corrected before the first prop existed.

Two corrections to the audit brief itself are in §3.

---

## 2. Repository baseline

`HEAD` = `2c0cb63`, branch `main`, tree clean but for an untracked `RESUME.md`.

```
npx vitest run     →  Test Files 25 passed (25) · Tests 220 passed | 1 skipped (221)
npx tsc --noEmit   →  clean
artifact baseline  →  21/21 SHA-256 match
```

| System | State | Evidence |
|---|---|---|
| Ground mesh, 37 segments, 20,276 triangles | **integrated** | `main.ts:147`, `sim/ground-mesh.ts:72` |
| `WALL_` / `INV_` / `RAIL_` barriers (48) | **integrated** as per-segment trimeshes | `main.ts:153,166` via `parseSolidMesh` |
| `MISC_` | drawn, deliberately **not** solid | `render/track-view.ts`; `PREP` has no `"MIS"` branch |
| Trees (355) and pickups (77) | **integrated** | `main.ts:171` `PropColliders`; `sim/track.ts` |
| Water, drowning, sky | **integrated** | `world.ts:283-287`, `render/track-view.ts` |
| Rivals | **not implemented in any form** | no vehicle type but the player's exists in `src/` |
| Racing line | decoded in `track.glb`, **not extracted, not used** | `render/track-view.ts:9` hides `path_` nodes |
| Seeded RNG | exists, **never drawn from** | `sim/rng.ts`; `world.ts` touches it only at `:363` for `snapshot()` |

**Ground query: linear scan, no spatial index.** `castDownMesh`
(`sim/ground-mesh.ts:72-130`) walks `firstTri … lastTri` with no early exit and
no acceleration structure. `Track.castDown` (`sim/track.ts:163-186`) picks the
segment from `segmentIndexFor(y)` and adds **one** neighbour within 2 units of a
seam, then takes the nearest hit across candidates.

**Segment activation** is `setEnabled(false)` on the outgoing collider and
`true` on the incoming, with an unknown index leaving the previous one standing
(`physics/segment-colliders.ts:50-58`). `PropColliders.setActive` re-evaluates
every prop (`physics/prop-colliders.ts:45-50`).

**One tick** is `World.step` (`sim/world.ts:124-156`): `stepVehicle` →
`stepPhysics` → gadget events → surface-change event → `updateCollisions` →
`updateRace`. Inside `stepVehicle` (`sim/vehicle.ts:203-213`) it is `updateHover`
then `updateCar`, which the comment ties to Director's `enterFrame`/`exitFrame`
split. **Forces are computed from pre-integration state and Rapier steps after.**

---

## 3. Two corrections to the audit brief

**3a. The player casts four suspension rays per tick, not twelve.**
`updateHover` loops `for (let i = 0; i < 4; i++)` with one `probe.castDown` each
(`sim/vehicle.ts:229-232`). The brief's figures of 12 and 48 are therefore 3×
high. The four-vehicle workload is **16 rays per tick**, not 48. All measurements
below use the real figure and state it.

**3b. `src/sim/main.ts` does not exist.** The entry point is `src/main.ts`, and
it is a renderer/DOM file, not simulation. `src/sim/` is DOM-free as the house
rules require.

---

## 4. Evidence table

| Claim | Source | Class | Remaining uncertainty |
|---|---|---|---|
| Three concurrent rivals, recycled 19× | `PREP:49-52` (`enemiesRemaining = 19`, `enemyPositionsList = [0,0,0]`), `PREP:459-466` (`sendSprite(2, …)`) | CONFIRMED | None for the count. That sprite 2 carries three `doEnemy` instances is **SUPPORTED**, not shown: the behaviour attachment lives in the binary score. |
| Racing line: 209 points, strictly monotone in Y | measured from `track.glb`: 208/208 increasing | CONFIRMED | — |
| Line quantised to integer x,y and `ceil(z)` | `PREP:308-311` | CONFIRMED | — |
| Waypoint spacing 21.45 / 62.10 / 105.61 (min/p50/max) against acceptance radius 10 | measured; `doEnemy:424` | CONFIRMED | — |
| Rival mass 20000 vs player 30000 | `doEnemy:38`, `doMach5:55` | CONFIRMED | — |
| Rival shares the player's suspension integrator | `doEnemy:544-572` vs `doMach5:440-481` | CONFIRMED | — |
| Rival omits the ungrounded `else` branch for drawn wheel distance | `doEnemy:558-571` has none; `doMach5:471-480` has two | CONFIRMED | Whether this was intent or omission is UNRESOLVED. |
| Rubber band 0.60 / 0.73 / 1.03 × `gM5MaxSpeed` | `doEnemy:780-806` | CONFIRMED | — |
| Smart window `the ticks + random(100) + 100` | `doEnemy:789` | CONFIRMED | — |
| Damage: 15 with Blades, 2.5 without, `hitforce·0.5` rear-ended, 100 on solid/tree above force 10 | `doEnemy:204-230` | CONFIRMED | `hitforce` units are Havok's and have no analogue here — **UNRESOLVED**. |
| Robot sets `controlMODE = 0`; any contact then detonates | `doMach5:548`, `doEnemy:184-186` | CONFIRMED | — |
| Per-segment collision is **per pair** in the original | `MOVIE.ls:171-191` `disableCollision(tCar.name, …)` | CONFIRMED | — |
| `pStartingPathStep` values | sprite properties, binary score | **UNRESOLVED** | Not recoverable from Lingo. |
| Sprite update order within a frame | binary score | **UNRESOLVED** | — |
| `makeMovableRigidBody`'s third argument | no decompiled signature | **UNRESOLVED** | As for every Havok call in this project. |

---

## 5. Architecture — the smallest safe shared interface

### What is already shared, by construction

`stepVehicle(state, body, probe, input, dt, tick)` (`sim/vehicle.ts:203`) is
**already free of singletons**. It takes its state, its body and its probe as
arguments; nothing is module-global but the constants. `RapierChassis`'s
constructor **already takes mass** as a parameter defaulting to
`K.CHASSIS_MASS` (`physics/rapier-body.ts:156-162`), and the suspension impulse
reads `body.mass`, not the constant (`sim/vehicle.ts:275`). A second vehicle at
20,000 kg needs no change to either.

Wheel state is **simulation state**, correctly: `grounded[]` and
`hoverDistances[]` live on `VehicleState` (`sim/vehicle.ts:141-144`), and the
renderer reads them through `VehicleViewState`. The one drawing rule —
`wheelDrop`'s floor and ceiling — is in `render/model-frame.ts` and nothing in
`src/sim/` imports it. **So the rival's missing `else` branch is a renderer
difference and belongs in the renderer**, as the brief suspected (§Audit 2.5):
confirmed by the import graph, not assumed.

### What is not shared, and must become a parameter

| Thing | Today | Needed |
|---|---|---|
| Max speed | `K.MAX_SPEED` (`vehicle.ts:378`) | per-vehicle; the rival rewrites it every tick |
| Acceleration | `K.ACC_GAIN` | same for both (0.07), no change |
| Hover constants | `K.SUSPENSION_STRENGTH/DAMPING/HOVER_DISTANCE` | same for both, no change |
| Control | `VehicleInput` (keys) | the rival has no keys; it applies angular impulse directly |
| Gadgets, brake, reverse, turn ramp | `updateCar` → `updateGadgets`, `updateSteering`, `updateDrive` | **none of these exist for a rival** |

### Recommendation

**Do not refactor `updateCar`.** The rival shares `updateHover` and
`updateLateralGrip`/`updateSelfRighting`; it shares *none* of
`updateGadgets`, `updateSteering` or `updateDrive`, which is where the brake,
the turn ramp, the reverse branch and the gadget timers live — the three
functions carrying the most recovered behaviour and the most tests.

The smallest safe shape is therefore an **extraction, not a generalisation**:

- `updateHover(state, body, probe)` — already standalone at
  `sim/vehicle.ts:222`, already takes everything it needs. **Export it. No edit.**
- `updateSelfRighting(state, body)` (`:420`) and `updateLateralGrip(state, body)`
  (`:469`) — likewise standalone. **Export them. No edit.**
- A new `sim/rival.ts` composes those three with its own pursuit controller and
  its own throttle, and never calls `updateCar`.

That is a three-line change to `vehicle.ts` — adding `export` — and zero change
to any function body. The risk of altering the player's handling is then
structurally zero rather than merely tested. Should the two drift later, that is
a decision taken in daylight.

**Regression tests that would catch a subtle change to player handling** already
exist and must stay green with no edits to their assertions:
`suspension-rest.test.ts` (4), `steering.test.ts` (3), `self-righting.test.ts`
(4), `surface-wheel.test.ts` (5), `replay.test.ts` (11),
`rapier-determinism.test.ts` (6), `drive-original-course.test.ts` (9).

---

## 6. Performance — measured

### Method

Node v26.8.1 (not a browser), Linux, via a temporary Vitest file since removed.
Per case: 20,000 warm-up calls, then 40 batches of 2,000 timed with
`process.hrtime.bigint()`; the figure is microseconds per call, p50 = 20th of 40
sorted batches, p95 = 38th. Probe points are the centroid of each segment's
first 400 triangles, 0.5 above its highest vertex.

### Per-ray cost of the shipped query

| Segment | Triangles | p50 | p95 |
|---|---:|---:|---:|
| 1 | 62 | 4.18 µs | 5.08 µs |
| 15 | 551 | 42.5 µs | 47.4 µs |
| **4 (heaviest)** | **2428** | **187.7 µs** | **202.5 µs** |

Triangles per segment across all 37: min 62, p50 451, p95 2428, max 2428. Cost
is linear in triangle count at ≈77 ns per triangle.

### Where that time goes — the finding that changes the recommendation

`castDownMesh` computes `Math.hypot(e1x,e1y,e1z) * Math.hypot(e2x,e2y,e2z)`
**for every triangle, before any rejection** (`sim/ground-mesh.ts:97-99`), to
scale the near-parallel epsilon. The same test is expressible without a square
root: `det² > EPS² · |e1|² · |e2|²`.

A/B of the two inner loops, identical in every other line, **0 result mismatches
across all 37 segments**:

| Segment | shipped | squared form | speed-up |
|---|---:|---:|---:|
| 1 (62 tri) | 4.18 µs | 0.82 µs | **5.1×** |
| 15 (551 tri) | 42.5 µs | 6.22 µs | **6.8×** |
| 4 (2428 tri) | 187.7 µs | 33.9 µs | **5.5×** |

### Whole-tick cost, driving the real course

Driving the racing line with barrier colliders live, 5,699 ticks measured after
300 warm-up, reaching segment 8; time-weighted 503 triangles under the car:

| | p50 | p95 | p99 |
|---|---:|---:|---:|
| 4 rays (the probe alone) | 93.8 µs | 732.6 µs | 840.9 µs |
| whole `world.step()` incl. Rapier | 206.8 µs | 980.8 µs | 1118.6 µs |

**The probe is 45% of the tick at p50 and 75% at p95.**

### Projection — labelled as projection, not measurement

Scaling the probe by 4 vehicles (16 rays) and leaving Rapier's own cost as an
unknown that also grows:

| Workload | probe p95 | share of a 16.67 ms frame |
|---|---:|---:|
| player only, today | 0.73 ms | 4.4% |
| **four vehicles, today** | **2.93 ms** | **17.6%** |
| four vehicles, squared form | ≈0.53 ms | ≈3.2% |

### Limitations

Node, not a browser: no WASM/JS boundary as in the browser Rapier build, a
different JIT warm-up profile, no GPU contention, no rAF jitter. The figures
bound the *simulation* cost and say nothing about rendering 355 trees. The run
reached segment 8 of 37, so the heaviest segment (4) is included but most of the
course is not.

### Decision

**Proposed budget, labelled a proposal:** the simulation tick holds ≤ 25% of a
16.67 ms frame at p95 — 4.17 ms — leaving the rest to rendering.

**Four vehicles fit the budget even without any change** (17.6% projected), so
the design's spatial index is **not required** and should be dropped from the
plan. But the squared-form rewrite is a ~6-line change, provably result-identical
on the whole mesh, and buys 5×. **Do it first, as its own commit with its own
A/B evidence, before any rival code.** It is the cheapest risk reduction
available and it is worth having regardless of rivals.

---

## 7. Physics and collision — the real blocker

### The mismatch

`SegmentColliders` holds **one** `private active` (`segment-colliders.ts:50-58`)
and `PropColliders` holds **one** (`prop-colliders.ts:27,45-50`). Each `setActive`
disables the previous segment globally.

The original did not do this. `doEnemyChangeSegment(tCar, …)` and
`doM5ChangeSegment` both call `gHavok.disableCollision(carName, segmentName)`
(`MOVIE.ls:171-191`) — **a per-pair filter**. With one car the two are
indistinguishable, which is why the simplification has gone unnoticed and
untested. With four cars spread over four segments it fails outright: only one
segment's trimesh is enabled, so three vehicles have no ground collider beneath
them and fall through the world.

This is the same class of defect as `segmentIndexFor` before Pass 0 — inert while
there is one actor, wrong the moment there are more — and it must be fixed
**before** the first rival exists, not after.

### Remedy

Rapier's collision groups are a 32-bit field: 16 bits of membership, 16 of
filter. Four vehicles need four bits. Every segment trimesh stays permanently
enabled; its filter mask carries the set of vehicles currently in that segment,
updated on each vehicle's segment change. One bit per vehicle, 37 masks, no
collider ever enabled or disabled again. Nothing in `src/` uses
`setCollisionGroups` today — verified by grep — so this is new surface, not a
change to existing behaviour.

### The seam asymmetry must not be broken

`Track.castDown` consults **two** segments within 2 units of a seam
(`track.ts:165-169`) while the collider set is **one**. That asymmetry is the
original's and is pinned by `tests/segment-transition.test.ts` (7 tests). Moving
to collision groups must preserve it: the ray reads two, the solver sees one.
Enabling adjacent segments' colliders as a seam fix would break a recovered
behaviour and is rejected.

### Minimal experiments

1. **Line following, no contact.** One rival, 2,000 ticks from a known step;
   assert it advances monotonically through the waypoints and never leaves the
   drivable surface ids.
2. **Rival vs a stationary body.** Place a barrier on the line; assert the rival
   stops, takes the recovered damage, and does not tunnel (CCD is already on for
   the chassis — `rapier-body.ts:172`).
3. **Rival vs player.** Assert both impulses fire, the player takes the
   `doMach5` cost and the rival the `doEnemy` cost, and the global debounce
   behaves as it does for props.
4. **Rival vs rival.** Assert only the car in front takes damage
   (`doEnemy:189-190`) and that its `pSmartEnemy` clears.
5. **Seam crossing, both directions.** For each vehicle independently, assert
   exactly its own segment's bit is set in the mask before and after, and that
   the probe still reads two segments at the seam.
6. **Recycle with colliders live.** Teleport a rival mid-contact; assert no
   collider is destroyed, the mask moves with it, and nothing is left enabled
   for a vehicle that is no longer there.

---

## 8. Determinism

### What is already true

`src/sim/` contains no `Math.random()`, no clock and no DOM — verified by grep.
Forces are computed from pre-integration state, then Rapier steps once
(`world.ts:132-133`). `replay.test.ts` (11) and `rapier-determinism.test.ts` (6)
already pin reproducibility, and `drive-original-course.test.ts` runs the real
course twice and compares.

### The defect waiting to happen

**`World` holds a single `Rng` instance** (`world.ts:114`) and today **nothing
ever draws from it** — the only reference outside the constructor is
`snapshot()` at `world.ts:363`. The moment three rivals share that one stream,
rival B's sequence depends on how many draws rival A made, which depends on how
many collisions A had. Determinism survives — the same seed still replays — but
**independence does not**, and a change to one rival's logic silently reshuffles
the other two.

**Recommendation:** one sub-stream per rival, derived at construction
(`new Rng(seed ^ (rivalIndex * 0x9e3779b9))` or equivalent), each snapshotted
separately. Document it as a SUBSTITUTE: the original had one global generator
and this is a departure taken for isolation, not recovered.

### Update order

The original's order is in the binary score and stays UNRESOLVED. The substitute
to adopt and pin with a test:

> Within one tick: all vehicles' controllers run, in a fixed index order with
> the player first; then physics steps once; then collisions and race state are
> resolved, in the same fixed order.

This matches the existing single-vehicle shape exactly (`world.ts:132-154`) and
keeps every controller reading the same pre-integration world — so no rival can
see another rival's same-tick result, which would make the order load-bearing in
a way no test could easily catch.

`tYOffset` and overtaking must be sampled **after** the physics step and from
the same snapshot for all vehicles, or a rival could be judged against a player
position from a different instant.

### Replay acceptance

Run the same input sequence twice from the same seed over ≥ 4,000 ticks,
covering **at least one recycle and one Duggary activation**, comparing per-tick
a snapshot that includes every rival's position, velocity, `controlMODE`,
`pathStep`, damage and RNG state, plus the full event log. Equal, element for
element. The existing `replay.test.ts` shape extends directly.

---

## 9. Race-state invariants

The recycling teleport is the trap. `doJump` moves a rival from behind the
player to `max(enemyPositionsList) + 2` (`doEnemy:240`) — it crosses the player
in Y in one instant without overtaking. The original guards this with
`pIsJumping`, checked at `doEnemy:831` before `gPosition` is incremented, and
sets `isBehind = 0` directly at `:317`.

Invariants to assert:

1. A teleport never changes `gPosition`. (`pIsJumping = 1` suppresses exactly
   this; it is the whole reason the flag exists.)
2. Overtaking is counted on the **transition** of `tYOffset`'s sign, not its
   value, so a rival hovering at `tYOffset ≈ 0` cannot ratchet the place counter.
   The original's hysteresis is `isBehind`; keep it.
3. `gPosition` is bounded by `[1, 20]` at every tick.
4. Path exhaustion increments `enemiesFinished` and removes the rival without
   touching `gPosition` (`doEnemy:428-444`).
5. A rival that dies *while* ahead and is recycled *behind* produces exactly one
   position change, not two.
6. Duggary activation happens once, at `enemiesRemaining = 1`
   (`doEnemy:303-305`), and `doResetDuggary` never changes `gPosition`.
7. The player finishes only on `gPosition === 1`, which is where
   `handlePickups:161` and `PLAY:114` already read it.

---

## 10. Corrections the design needs

| Section | Correction |
|---|---|
| **Risks**, "the one that would sink it" | Rewrite. The measured cost is 4 rays, not 12; the projected four-vehicle load is 17.6% of frame at p95, inside a 25% budget even unchanged; and the dominant term is `Math.hypot`, not the lack of an index. **Drop the spatial index from the plan.** |
| **The design / Physics** | Add the blocker: per-segment collider toggling is global today and must become collision groups before any rival. This is a Pass 0, not a detail. |
| **Reuse, not duplication** | Soften. `stepVehicle` is already parameterised and `RapierChassis` already takes mass. The recommendation is to **export three existing functions unchanged**, not to refactor `updateCar`. The design calls the refactor "the main open question"; the audit answers it. |
| **Determinism** | Add per-rival RNG sub-streams, tagged SUBSTITUTE. One shared stream couples the rivals to each other. |
| **Non-goals** | `explosionMODE` as simulation state is right, but `pIsJumping` is not presentation — it is the guard that stops a teleport reading as an overtake. Name it explicitly. |

---

## 11. The proposed calls, judged

**Port the `±180` wrap bug — JUSTIFIED, with a caveat.** `doEnemy:449-453`
genuinely computes `180 - dif`. It is recovered, and it is testable *in complete
isolation*: the wrap is a pure function of two angles and needs no pursuit
controller, no physics and no track. Extract it as `wrapAngleDeg(dif)`, give it
a table-driven test including 190 → −10, and tag it RECOVERED with the
arithmetic spelled out. Consequence of porting: a spun rival recovers worse than
a correct implementation would, which is the original's behaviour.

**Exactly three rivals — JUSTIFIED as a count, SUPPORTED as a mechanism.**
`enemyPositionsList = [0,0,0]` is direct evidence for three slots. That the
three are behaviour instances on sprite 2 is inference from `sendSprite`'s
semantics and is not shown by any decompiled line. Build for three; record the
mechanism as SUPPORTED.

**`explosionMODE` as state without particles — JUSTIFIED.** Modes 1, 5 and 8
gate removal, recycling and the player's 1000 points; modes 2, 6 and 7 only
advance texture indices and particle parameters. The split is clean along that
line. Test: a rival at 100 damage awards exactly 1000 once and recycles.

**Substitute `pStartingPathStep` — JUSTIFIED, unavoidable.** Not in the Lingo.
Record what it would have to be read from (the sprite properties in the binary
score) so a future recovery knows where to look. Test: the chosen offsets put
all three rivals ahead of the player at tick 0 and in distinct segments.

**Existing seed for every draw — JUSTIFIED but insufficient as stated.** See §8:
it needs sub-streams, or the rivals are coupled.

**Duggary gameplay in, audio out — JUSTIFIED.** The project has no audio at all;
including it here would be the first. The behaviour — the five-way table, the
immunity, the stuck detection — is gameplay and is in scope.

---

## 12. Open questions

Only the ones the source genuinely does not answer:

1. The three `pStartingPathStep` values.
2. The sprite update order within a frame.
3. `gHavok.makeMovableRigidBody`'s third argument.
4. **The unit of `hitforce`.** `doEnemy:206` scales it by 0.5 into a 0–100 damage
   pool and `:226` compares it against 10. It is Havok's collision impulse
   magnitude in Havok's units, and this project has no conversion to Rapier's.
   Every rival-to-rival and rival-to-scenery damage figure depends on it. This is
   new, it is not in the design, and it is the largest remaining unknown in the
   damage model.
5. Whether `distFactor`'s 50-unit scale was tuned against the 62-unit median
   spacing.

---

## Final verification

```
git status --short        →  ?? RESUME.md  (plus this file)
git diff --stat HEAD      →  (empty: no tracked file modified)
npx vitest run            →  25 files, 220 passed, 1 skipped
npx tsc --noEmit          →  clean
artifact SHA-256 baseline →  21/21 match
temporary benchmark       →  tests/zz-bench.test.ts created and removed; absent
```

No production source was modified. Nothing was committed or pushed.
