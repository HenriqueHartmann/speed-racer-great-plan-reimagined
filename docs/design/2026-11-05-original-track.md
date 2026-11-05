# Design — the original track

**Status:** approved 2026-11-05. Plan: `docs/plans/2026-11-05-original-track.md`
**Date:** 2026-11-05

Replace the generated six-segment test course with the track the game shipped,
decoded from `SR_level_1.dcr` resource 7587.

**Evidence taxonomy used throughout.** This project already separates RECOVERED
from SUBSTITUTE in `src/sim/constants.ts`; a decoded binary needs one more rung,
because a thing can be strongly indicated without being shown.

| Mark | Means |
|---|---|
| **CONFIRMED** | Demonstrated directly by the decompiled source or by a measurement anyone can repeat against the artifact. |
| **SUPPORTED** | The evidence converges on it and nothing contradicts it, but no single step demonstrates it. |
| **UNRESOLVED** | The available evidence does not establish it. Recorded rather than guessed. |

---

## Why now

The car is the original. The road under it is not: `src/sim/track.ts` builds flat
planes centred on X = 0, written when the track geometry was still undecodable and
explicitly marked as "our own layout". That constraint is gone — the same
`macromelt` chain that recovered the Mach 5 decodes the track world outright.

It is also the cheapest remaining step with a large payoff. The reconnaissance
below cost one decode and no new tooling.

---

## What the reconnaissance established

The track world decodes to 760 meshes, 67,527 triangles, 4.6 MB of glTF, with
242 materials over 29 textures. Four facts out of it shape this design.

### 1. The 37 segments are real, named, and confirm a recovered constant

There are exactly 37 nodes named `SEG_1`…`SEG_37` — **no zero padding** — matching
`SEGMENT_SLOTS`. They appear in the file unordered (`SEG_37` is the first node in
the array), so anything that walks them **must sort by the numeric suffix**;
lexical order puts `SEG_10` before `SEG_2`. All 37 carry live geometry.
(CONFIRMED by measurement.)
`PREP` binds them by name — `tSEG = integer(chars(tmodel.name, 5, 6))`, then
`SEG_TRK[tSEG] = tmodel`, an assignment rather than an append, so there is one
track surface per segment.

Their extents confirm `SEGMENT_LENGTH = 300` from the geometry rather than from
the script that was its only evidence until now (CONFIRMED):

| Node | Y extent |
|---|---|
| `SEG_10` | 2700 – 3000 |
| `SEG_11` | 3000 – 3300 |
| `SEG_12` | 3300 – 3600 |

The whole course runs Y 0 – 11,092.5 and the drivable surface is **20,276
triangles**, a small fraction of the 67,527.

The fit is close but not exact, and the slack matters. Nine of the 37 segments
spill past the end of their nominal slice, by at most **+1.30 units**, and
fourteen start before it, by at most **2.015**. That is what the original's
2-unit seam window (`pSEGpart >= 298` / `<= 2`) is for. (CONFIRMED by
measurement.)

The window is *almost* wide enough. Segment 3 begins 2.015 units early, so a
wheel in `y ∈ [597.985, 598.0)` finds no ground: the window is 2.0. The
original misses it too — `integer(597.985)/300 + 1 = 2`, `pSEGpart = 2.015`,
which fails `<= 2` — so this is a faithful port of a 15-millimetre hole in the
road rather than a porting bug. Worth knowing before someone re-derives it.

`FINISH_Y = 10921` is RECOVERED from `doFinish` and sits inside `SEG_37`, whose
live surface ends at 11,092.5. It is a coordinate the race rules test, **not a
piece of geometry** — see §3c.

### 2. The track curves, so the current ground model cannot hold it

X wanders from −106 to +227 across segments and Z from −20 to +26. The present
`Segment` is `{ height, halfWidth }` — a flat strip centred on the origin. This
is not a parameter that can be retuned; it is a different ground model.

This is also why the track cannot be imported "for the visuals only": the
drawn road would curve away while the car drove on a straight invisible strip.

### 3. `effectID` enumerates sub-meshes, not faces — SUPPORTED, and it corrects us

`src/sim/constants.ts` records `effectID` as "the face index returned by the
suspension raycast", with the surface names flagged INFERRED because the globals
that would name them are declared and never assigned.

The geometry says otherwise. Every one of the 37 segment meshes has **exactly 16
sub-meshes**, and sub-mesh *N* carries the *same material* in all 37:

| Index | Material | Our table says | Reading |
|---:|---|---|---|
| 1 | `ROAD_Finish` | road | ✓ |
| 2 | `ROAD_Brown` | road | ✓ |
| 3 | `GRASS` | "heavy drag", drag 0.5 | **grass** |
| 4 | `ROAD_Dirt` | dirt, grip 0.8 | ✓ |
| 5 | `ROCK_bROWN` | *absent* → default | rock |
| 6 | `ROAD_Blue` | road | ✓ |
| 7 | `ROAD_Blue_Dark` | road | ✓ |
| 8 | `ROAD_BLUESNOW_TRANS` | "shallow water", grip 0.016 | **snow** |
| 9 | `ROAD_BLUESNOW` | "shallow water", grip 0.016 | **snow** |
| 10 | `ROAD_DirtBlue` | road | ✓ |
| 11 | `ROCK_bLUE` | *absent* → default | rock |
| 12 | `SAND_UNDERWATER` | "deep water", drag 0.75 | **underwater** ✓ |
| 13 | `ROAD_BluepBLUEd` | road | ✓ |
| 14 | `ROAD_BlueIce` | "shallow water", grip 0.016 | **ice** |
| 15 | `ROAD_BlueIceTRANS` | "shallow water", grip 0.016 | **ice** |
| 16 | `TREE` | *absent* → default | not a surface |

**What is CONFIRMED.** Every segment has exactly 16 sub-meshes and the material
at index *N* is identical in all 37 — measurable, repeatable, and the minimum a
stable ID requires.

**What is SUPPORTED.** That `effectID` *is* that index. Three lines converge:

- The table's IDs run 1–15. A segment has 16 sub-meshes and roughly 550 faces,
  so a 13-entry table keyed by face index could not work.
- The physics matches the materials: grip 0.016 lands on ice and snow, drag 0.5
  on grass, grip 0.8 on dirt.
- Strongest: the three IDs the original **leaves unhandled — 5, 11 and 16 — are
  exactly the three non-drivable materials**, `ROCK_bROWN`, `ROCK_bLUE` and
  `TREE`. Drawn at random from 16, that alignment is one chance in 560.

**What is UNRESOLVED.** *Why* index 5 of the raycast result is the sub-mesh. The
artifact never shows the tuple's layout: across both `doMach5` and `doEnemy`,
only `details[1][2]` (distance), `[3]` (position) and `[5]` are ever read.
Indices 1 and 4 appear nowhere. Director's documented return order would settle
it, and that documentation is not part of this artifact, so it is not evidence
this project may cite.

The conclusion does not rest on it. Whatever index 5 denotes, the unhandled-ID
alignment above only works if it enumerates sub-meshes. So the **mapping** is
SUPPORTED and usable; the **mechanism** stays UNRESOLVED and is recorded as such
rather than dressed up as recovered.

Practically: `grip 0.016` is **ice and snow**, not "shallow water", and `drag
0.5` is **grass**. The three unmapped indices fall through to the default, which
is what the original does too. The `inferredName` field becomes a material name,
and its comment must carry the SUPPORTED/UNRESOLVED split — not the word
RECOVERED, which in this codebase means the value was read from a handler.

### 3b. Every sub-mesh exists in every segment, because unused ones are parked

Sub-mesh indices are only usable as IDs if all 16 exist everywhere, and they do:
each segment pads the groups it does not use with a **parked patch at z = −20**,
far under the course. The patch is usually 2 triangles but not always — `SEG_4`,
`SEG_5` and `SEG_6` carry 10 — so nothing may assume a fixed size, and some
carry a vertex as high as z = 0.469, so they are not reliably flat either. Across the
drivable groups there are 1,163 parked triangles against 9,568 of live road.
(CONFIRMED by measurement.)

This is a pipeline fact, not trivia. The parked patches are real geometry that a
downward ray can hit, so the extraction keeps them — the original gave Havok the
same mesh — but nothing may treat a hit at z = −20 as road without noticing.

### 3c. `ROAD_Finish` has no geometry in this level

Sub-mesh 1 is `ROAD_Finish`, and all **98** of its triangles across the 37
segments are parked at z = −20. Not one is live. There is likewise no node whose
name begins with `Finish` anywhere in resource 7587, although `PREP` has a
branch that would hide one.

So the finish line is a **coordinate, not a surface**: `FINISH_Y = 10921`,
RECOVERED from `doFinish`, tested by the race rules in `world.ts`. Nothing in
this step should look for finish geometry, and `effectId = 1` should never be
reported on this level. (CONFIRMED by measurement.)

### 4. Three things come along that were not asked for

- **`carPos_Mach5` at (41.98, 38.83, 16.56)** — the real start line, the node
  `prepareCar` raycasts down from.
- **`path_01`…`path_209`** feed `pathList`, which `doEnemy` walks as the rival
  racing line. The next plan item arrives with this one.
- **242 per-face material assignments**, which is the link `open-questions.md`
  §4.2 recorded as missing.

---

## Goals

1. The car drives the original course: its real shape, elevation and surfaces.
2. Surface behaviour is driven by the recovered sub-mesh index, replacing the
   inferred table with measured material names.
3. The car starts where the original starts.
4. `src/sim/` stays free of the DOM, clocks and `Math.random()`, and the ground
   query stays deterministic.
5. The extraction is reproducible from the artifact by a tracked script.

## Non-goals

- Trees, walls, water volumes, pickups and the invisible `INV_` colliders. They
  carry gameplay rules and deserve a step where each is checked against `PREP`.
- Rival AI. The path is recovered here and used later.
- Replacing the prop and collision system in `track.ts`.
- Animation data, which has not been examined.

## Anti-goals

Things that would make this a failure even if the car drives:

- Any DOM, async or clock dependency inside `src/sim/`.
- A ground query whose result depends on iteration order, floating-point
  accumulation order, or anything else that breaks replay determinism.
- Silently widening the surface table by guessing at the three unmapped indices.
- A car that drives off the mesh into nothing without that being obvious.

## Constraints

- The original artifact is never moved, renamed or modified; its 21 SHA-256
  values are re-verified before every commit.
- Staging by explicit path. No `git add .`.
- No binary-only tools; `macromelt` stays pinned at the audited revision.
- The simulation runs at a fixed 30 Hz timestep and must stay replayable.

---

## The design

### Pipeline

`tools/extract_mesh.sh` grows a second output. From resource 7587 it writes:

- `public/models/track.glb` — the full visual world as decoded.
- `public/models/track-ground.bin` — only the 37 `SEG_` meshes, as flat
  positions, indices and per-sub-mesh ranges. This is what the simulation eats.

The ground file exists so the simulation never needs a glTF loader, and so the
data it reads is plain typed arrays. It is generated, tracked, and regenerated
by the same script.

### Coordinate frame — verified, not assumed

Two earlier orientation bugs in this project came from reasoning about
conventions instead of reading the file, so the rule here is stated as a check
the converter performs, not as a constant it hard-codes.

What measurement established (CONFIRMED):

- `SceneRoot` carries the quaternion `[-0.7071, 0, 0, 0.7071]`, a −90° rotation
  about X. That is the exporter converting Director's Z-up data to the Y-up that
  glTF requires. Our simulation is Z-up, so this rotation must **not** be
  applied; node-local space under `SceneRoot` already is the simulation's frame.
- All 37 `SEG_` nodes and `carPos_Mach5` are **direct children of `SceneRoot`**,
  and none carries a rotation, a scale or a matrix — only a translation.

So the converter bakes **the node's translation and nothing else**, and asserts
the three facts above rather than trusting them: if a `SEG_` node ever arrives
with a rotation or a scale, or parented somewhere else, or if `SceneRoot`'s
rotation is not the expected quarter turn, it fails loudly instead of writing
silently wrong geometry.

### Ground model

`Segment` loses `height` and `halfWidth` and gains a reference into the ground
mesh. `Track.castDown` becomes a real downward ray against triangles, keeping
the original's restriction to the current segment plus its neighbour near a
seam — `modelsUnderRay(..., #modelList: [...])` did exactly that, and it is
what keeps the query cheap at roughly 550 triangles.

Determinism is a requirement, not a hope: triangles are tested in index order,
the nearest hit wins, and ties break to the lower triangle index.

`GroundHit.effectId` carries the 1-based sub-mesh index.

### The surface comes from the rear-left wheel

`doMach5` writes `pTrackFace` in one place only: `if i = 4`, inside the wheel
loop. Index 4 is `posD`, and `posD = com − pBackWheelBase·forward +
(pwidth/2)·(−pLocalRight)` with `pLocalRight = pLocalDown × pLocalForward =
(1,0,0)`. So index 4 is the **rear left** wheel. (CONFIRMED by derivation from
`doMach5:176-184` and `:452`.)

`src/sim/vehicle.ts` reads index 3 of `[FL, FR, RL, RR]`, which is the rear
**right**, and its comment asserts the original did the same. Both are wrong.
The correct index in our ordering is **2**. This is a defect in already-committed
code, invisible on a laterally uniform test strip and not invisible on a course
with grass down one side, so it is fixed **before** the track lands rather than
after — see the plan's Task 0.

### Spawn

From `carPos_Mach5`, raycast down and place the chassis one unit above the hit,
as `prepareCar` does at line 146.

### Renderer

`track.glb` is drawn as-is. The `SceneRoot` Y-up conversion is cleared exactly
as `mach5-original.ts` does, and the shared rule belongs in `model-frame.ts`
rather than being written twice.

### Surfaces

`SURFACES_BY_EFFECT_ID` keeps its grip and drag values — those are recovered
from the handlers and are not in question — and its `inferredName` becomes a
recovered material name. The three unmapped indices stay unmapped.

---

## Calls made while writing this

A reviewer read the first draft and found five places where it would have left a
builder guessing. Four are settled here, by the original rather than by taste.

### The Rapier ground collider is ported, not deleted

The design first addressed only the hover probe, and there are two grounds.
`main.ts:123` adds a flat Rapier slab whose top face is z = 0; on a course
running z −20 to +27 that slab blocks the car wherever the track dips and
catches it nowhere else.

The original had a real one: `PREP:381` makes every `SEG_` mesh a fixed rigid
body with `friction = 0, restitution = 0`, and `doM5ChangeSegment` (`MOVIE.ls:99`)
enables car↔track collision for the current segment and disables it for the other
36. So: **37 trimesh colliders, one per segment, only the current one enabled.**
The slab goes. This enlarges the step — chassis CCD and the Jacks landing both
need re-checking against a trimesh — and that cost is accepted rather than hidden.

### `pTrackFace = 99` is ported, and it defines driving off the mesh

`world.ts:287` ends the run on `z <= FALL_DEATH_Z && powerCoeff === 0`. The
original (`doMach5:675`) has a third clause, `pTrackFace = 99`, set at line 481
whenever the ray finds nothing at all.

**The first draft justified this wrongly and the claim is withdrawn.** It said
the missing clause would end the run for a car that was merely driving low.
It would not. The hover ray is cast with `maxDistance: 1` while `pHoverDist` is
1.2, so *every* hit is nearer than the hover distance and a wheel is grounded
exactly when its ray hits. `powerCoeff = 0` therefore already means all four
rays missed, which already means `pTrackFace = 99`. The third clause is
**functionally redundant**, and no false death was ever available. (CONFIRMED by
reading `doMach5:434-481` against `HOVER_RAY_LENGTH` and `HOVER_DISTANCE`.)

What the sentinel actually fixes is **a stale surface**. Today `updateHover`
skips the assignment when the probe misses, so a car in the air keeps the grip
and drag of the last surface it touched until it lands. The original does not:
it writes 99, and `surfaceFor(99)` is the default. Porting it also gives leaving
the mesh a defined `effectId`, which the Risks section asked for and did not
choose.

The threshold is still worth knowing: `SEG_4`'s `ROAD_Blue` reaches z = −10.1,
genuinely below `FALL_DEATH_Z`. It is reachable road below the fall height, and
the `powerCoeff` clause is what keeps it safe.

### `SPAWN_HEIGHT` stays a substitute

`prepareCar:146` spawns at the hit point plus one unit — but that is the *model
origin*, and our chassis origin is the centre of mass, 0.156 higher. Faithful
would be 1.156, past the 1.0 hover ray, so the original's car drops at the start.
`SPAWN_HEIGHT = 0.9` is already declared a SUBSTITUTE for exactly this reason;
it stays, and its comment gains the measurement.

### Only the 37 `SEG_` nodes are drawn

The first draft said "`track.glb` drawn as-is" while scoping the step to the road
alone, which contradicted itself: `PREP` hides the `INV_` colliders, the
`FAL_*_TGR` triggers and the `Finish*` marker, and the world also carries
`carPos_Mach5` and 209 path nodes that are coordinates, not art. Drawn literally
they would all appear.

So **only the 37 segment nodes are drawn**. The renderer hides everything else by
name; the hidden-node rules arrive with the props, where they belong.

The file itself stays whole, at 4.6 MB. Filtering a GLB down to 37 nodes means
rewriting its accessors and buffer views — real code for a file that ships
alongside a WebAssembly physics engine anyway. Revisit if load time proves it
wrong; measure before assuming it does.

### Two smaller ones

The generated `track.glb` and `track-ground.bin` are **tracked**, as the asset
policy already provides for. And `race.underwater`, which is reachable only from
tests today, is *not* wired to `effectId === 12` here — that is a gameplay rule
and belongs with the water step.

---

## Left to the builder

- The on-disk layout of `track-ground.bin`.
- Whether per-segment triangle lookup needs a spatial index or whether a linear
  scan of ~550 triangles at 4 rays per tick is already fast enough. Measure
  before adding one.
- How the renderer and the simulation share the segment split without loading
  the geometry twice.
- Test fixtures: the replay suite runs on `FlatGround` and should keep doing so.
  The real track needs its own tests — segment seams, a known ray hitting a
  known surface, and determinism across repeated runs.

## Risks

- **The hover ray is 1.0 long and the car rests 0.903 above the road**, so only
  0.097 of margin. The first version of this entry got the numbers and the
  reasoning wrong, and both are corrected here.

  *The numbers.* It said "94% of the drivable surface lies under 10°, 14
  triangles exceed 30°" from a set that silently **excluded grass**. Counted
  three ways: road, dirt and ice only — 8,915 live triangles, **6 above 25.5°**;
  the set the original sentence used — 9,568 live, 14 above 30°; everything
  drivable including the grass verges — 17,910 live, **314 above 30°**. The
  steep geometry is overwhelmingly verge and rock; the road itself is nearly
  flat.

  *The reasoning.* It said "on a steady grade the chassis tilts to match and the
  distance holds". That is true of a ray cast along the chassis's own down axis,
  which is what `doMach5` does — `worldDownDir = tempTrans * pLocalDown`. Ours
  is cast **world-down**: `GroundProbe.castDown` takes no direction and
  `castDownMesh` hardcodes `(0, 0, −1)`. `updateHover` even computes the chassis
  down vector and discards it (`void down`), which predates this work.

  So on a grade θ the measured distance is the true one divided by cos θ, and
  the ray stops reaching at θ ≈ 25.5°; at 20° the suspension sits about 20%
  softer than it should. On a banked curve the spring pushes straight up rather
  than perpendicular to the road. **Six road triangles exceed 25.5°**, so the
  exposure on this course is small — but it is a real divergence from the
  original, it was inherited rather than introduced, and this is the step that
  put the car on terrain where it means anything. Giving `GroundProbe` a
  direction is its own piece of work.
- **Falling off.** The original has a cliff game-over at `chassisPos.z <= -10`
  with `pTrackFace = 99`; we have no equivalent, so driving off the mesh will
  need defined behaviour even though the cliff rule itself is out of scope.
- **The replay baselines change.** The suite compares runs against each other
  rather than against stored goldens, so it should keep passing — but that is an
  expectation to verify, not to assume.
