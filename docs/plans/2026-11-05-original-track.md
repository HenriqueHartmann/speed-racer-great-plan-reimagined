# Original Track Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The car drives the original 37-segment course — its real shape, elevation and surfaces — instead of a generated flat strip.

**Architecture:** A generated `track-ground.bin` carries the 37 `SEG_` meshes as plain typed arrays. `src/sim/ground-mesh.ts` raycasts them with no DOM and no engine, and `Track` delegates `castDown` to it, restricted to the current segment and its seam neighbour as the original was. Rapier gets one trimesh collider per segment with only the current one enabled, mirroring `doM5ChangeSegment`. The renderer loads the decoded `track.glb` and draws only the `SEG_` nodes.

**Tech Stack:** TypeScript, Vite, Three.js, Rapier, Vitest. `macromelt` pinned at `78f1ad6c5e8ce8b4f9a36dd1a25ca8682f3976e6` for decoding.

**Spec:** `docs/design/2026-11-05-original-track.md`

## Global Constraints

- `src/sim/` contains no DOM, no clocks, no `Math.random()`, no engine imports.
- The ground query is deterministic: triangles tested in index order, nearest hit wins, ties break to the lower triangle index.
- The original artifact is never moved, renamed or modified. Its 21 SHA-256 values are re-verified before every commit.
- Staging by explicit path. Never `git add .` or `git add -A`.
- Every new constant is tagged `RECOVERED` or `SUBSTITUTE` with its source handler, as `src/sim/constants.ts` does throughout.
- `SEGMENT_LENGTH = 300`, `SEGMENT_SLOTS = 37`, `HOVER_RAY_LENGTH = 1`, `WHEEL_RADIUS = 0.35`, `SPAWN_HEIGHT = 0.9` keep their current values.
- Sub-mesh index is 1-based, matching Director. `effectId = 99` means no ground.

## Review Focus

Five conditions the spec implies that no task's happy path exercises. Each has its test named in the task that owns the code.

1. **A ray starting below the surface.** After a hard landing the wheel point can sit under a triangle; a downward ray must not report the surface it has already passed. Covered in Task 1, `rejects a surface above the ray origin`.
2. **A ray exactly on a segment seam.** `y = 300.0` belongs to segment 2 by `segmentIndexFor`, but the triangle under it may be filed in segment 1. Covered in Task 2, `finds ground exactly on a seam`.
3. **The parked quads at z = −20.** 1,163 real triangles sit there to keep the sub-mesh indices stable. A car falling past them must not be rescued by one. Covered in Task 3, `a parked quad does not count as ground`.
4. **Y outside the course.** Behind the start line and past `SEG_37` (y > 11,093) there is no segment; the probe must miss cleanly rather than index out of bounds. Covered in Task 2, `misses beyond the last segment`.
5. **Degenerate triangles.** Zero-area triangles produce a zero normal and a division by zero in any naive ray test. Covered in Task 1, `ignores a degenerate triangle`.

---

### Task 0: The surface comes from the rear-left wheel

Independent of everything else, testable on the flat strip that exists today, and done first so the track data is not built on top of it.

**Files:**
- Modify: `src/sim/vehicle.ts:221-226` — the wheel that writes `effectId`
- Modify: `src/sim/constants.ts` — add `NO_GROUND_EFFECT_ID`
- Test: `tests/surface-wheel.test.ts`

**Interfaces:**
- Produces: `export const NO_GROUND_EFFECT_ID = 99;` — `RECOVERED - doMach5:481 sets pTrackFace = 99 for a wheel whose ray finds nothing.`
- `VehicleState.effectId` is written **only** from the rear-left wheel, index 2 of `WHEEL_LOCAL_POINTS`.

- [ ] **Step 1: Write the failing tests**

```ts
it('takes the surface from the rear-left wheel', () => {
  // A probe that answers effectId 4 for x < 0 and effectId 1 for x > 0.
  // After a step, vehicle.effectId must be 4.
});

it('ignores the other three wheels', () => {
  // A probe answering 7 for the rear-left point and 3 everywhere else.
  // After a step, vehicle.effectId must be 7.
});

it('reports 99 when the rear-left wheel misses', () => {
  // A probe that answers for every point except the rear-left one.
  // vehicle.effectId must be K.NO_GROUND_EFFECT_ID, not the stale value.
});

it('does not keep a stale surface in the air', () => {
  // Drive over effectId 4, then switch the probe to answer nothing.
  // vehicle.effectId must become 99 and surface must be SURFACE_DEFAULT.
});

it('leaves flat-ground behaviour unchanged', () => {
  // On FlatGround, which answers the same id everywhere, the reported
  // effectId is what it was before this change.
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run tests/surface-wheel.test.ts`
Expected: FAIL — `NO_GROUND_EFFECT_ID` is not exported, and the rear-left cases report the rear-right wheel's id.

- [ ] **Step 3: Implement**

In `updateHover`, move the assignment from `i === 3` to `i === 2`, correct the comment to say rear-left and cite `posD`, and in the miss branch set `state.effectId = K.NO_GROUND_EFFECT_ID` and `state.surface = K.SURFACE_DEFAULT` **when `i === 2`**. Touch nothing else: the impulse, the grounded flags and the hover distances keep their current behaviour.

- [ ] **Step 4: Run the focused tests, then the suite and the type check**

Run: `npx vitest run tests/surface-wheel.test.ts` then `npx vitest run && npx tsc --noEmit`
Expected: PASS throughout.

- [ ] **Step 5: Commit**

```bash
git add src/sim/vehicle.ts src/sim/constants.ts tests/surface-wheel.test.ts
git commit -m "The surface comes from the rear-left wheel, as doMach5 reads it"
```

---

### Task 1: The ground mesh and its raycast

**Files:**
- Create: `src/sim/ground-mesh.ts`
- Test: `tests/ground-mesh.test.ts`

**Interfaces:**
- Consumes: `Vec3`, `GroundHit` from `src/sim/vehicle.js`.
- Produces:
  - `interface GroundMesh { positions: Float32Array; indices: Uint32Array; /** For triangle i, the 1-based sub-mesh index. */ surfaceIds: Uint8Array; /** segmentStart[s] and segmentEnd[s] bound segment s+1's triangles, as triangle indices. */ segmentStart: Uint32Array; segmentEnd: Uint32Array; segmentCount: number }`
  - `function castDownMesh(mesh: GroundMesh, from: Vec3, maxDistance: number, firstTri: number, lastTri: number): GroundHit | null`
  - `function flatGroundMesh(segments: number, halfWidth?: number, effectId?: number): GroundMesh` — two triangles per segment at z = 0, for tests and for `buildSliceTrack`.

- [ ] **Step 1: Write the failing tests**

```ts
describe('castDownMesh', () => {
  it('hits a triangle below the ray origin', () => {
    const mesh = flatGroundMesh(1, 10, 1);
    const hit = castDownMesh(mesh, vec3(0, 150, 0.8), 1, 0, 1);
    expect(hit?.distance).toBeCloseTo(0.8, 6);
    expect(hit?.point.z).toBeCloseTo(0, 6);
    expect(hit?.effectId).toBe(1);
  });

  it('respects maxDistance', () => {
    const mesh = flatGroundMesh(1, 10, 1);
    expect(castDownMesh(mesh, vec3(0, 150, 2), 1, 0, 1)).toBeNull();
  });

  it('misses outside the triangle', () => {
    const mesh = flatGroundMesh(1, 10, 1);
    expect(castDownMesh(mesh, vec3(50, 150, 0.5), 1, 0, 1)).toBeNull();
  });

  it('rejects a surface above the ray origin', () => {   // Review Focus 1
    const mesh = flatGroundMesh(1, 10, 1);
    expect(castDownMesh(mesh, vec3(0, 150, -0.5), 1, 0, 1)).toBeNull();
  });

  it('ignores a degenerate triangle', () => {            // Review Focus 5
    // A mesh whose first triangle has three identical vertices and whose
    // second is a normal quad half; the ray must find the second.
  });

  it('rejects a near-parallel ray at course scale', () => {
    // A triangle tilted so the downward ray is within a microradian of its
    // plane, with vertices at y ~ 11000 and float32-rounded coordinates.
    // The result must be null or a finite hit - never NaN or Infinity.
  });

  it('stays finite on a triangle at the far end of the course', () => {
    // Same quad translated to y = 11000; the hit distance must match the one
    // measured at y = 150 to within float32 tolerance, proving the relative
    // epsilon does not degrade with magnitude.
  });

  it('breaks ties to the lower triangle index', () => {
    // Two coincident triangles with different surfaceIds; the hit must carry
    // the first one's id, on every run.
  });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run tests/ground-mesh.test.ts`
Expected: FAIL — `ground-mesh.js` does not exist.

- [ ] **Step 3: Implement `src/sim/ground-mesh.ts`**

Möller–Trumbore against each triangle in `[firstTri, lastTri)`, ray direction `(0, 0, -1)`.

The rejection test is **relative to the triangle, not absolute**. A fixed `1e-12` would be meaningless here: positions reach 11,092 and are stored as `float32`, whose spacing at that magnitude is about `1e-3`, so `1e-12` can never be reached and the guard would never fire. The measured data has no degenerate triangles at all — the smallest area across 18,725 live triangles is `6.886e-3` — so this epsilon exists to reject a ray that is **near-parallel to the triangle's plane**, where the division blows up, not to clean bad data.

Reject when `|det| < EPS_REL * |edge1| * |edge2|`, with `EPS_REL = 1e-7`. That compares like with like at any coordinate scale.

Keep the smallest non-negative `t` not exceeding `maxDistance`; on an exact tie keep the hit already held, which makes the lower index win.

- [ ] **Step 4: Run to verify they pass**

Run: `npx vitest run tests/ground-mesh.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/sim/ground-mesh.ts tests/ground-mesh.test.ts
git commit -m "A deterministic triangle ground probe, free of engine and DOM"
```

---

### Task 2: `Track` rides on a ground mesh

**Files:**
- Modify: `src/sim/track.ts` — `Segment`, `TrackOptions`, the constructor, `castDown`, `buildSliceTrack`
- Modify: `tests/track-rules.test.ts` — every `new Track({ segments: N })` call site
- Test: `tests/track-rules.test.ts`

**Interfaces:**
- Consumes: `GroundMesh`, `castDownMesh`, `flatGroundMesh` from Task 1.
- Produces:
  - `Segment` drops `height` and `halfWidth` and keeps `index`, `effectId`, `props`. `effectId` stays as the segment's *fallback* id, used only when the mesh carries none.
  - `TrackOptions` becomes `{ ground: GroundMesh }`; `segments` is read from `ground.segmentCount`.
  - `new Track({ ground: flatGroundMesh(N) })` is the shape every existing test uses.

- [ ] **Step 1: Write the failing tests**

```ts
it('finds ground exactly on a seam', () => {           // Review Focus 2
  const track = new Track({ ground: flatGroundMesh(3) });
  const hit = track.castDown(vec3(0, 300, 0.5), 1);
  expect(hit).not.toBeNull();
});

it('misses beyond the last segment', () => {           // Review Focus 4
  const track = new Track({ ground: flatGroundMesh(3) });
  expect(track.castDown(vec3(0, 5000, 0.5), 1)).toBeNull();
  expect(track.castDown(vec3(0, -50, 0.5), 1)).toBeNull();
});

it('reports no ground as effectId 99', () => {
  const track = new Track({ ground: flatGroundMesh(1) });
  expect(track.castDown(vec3(500, 150, 0.5), 1)).toBeNull();
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run tests/track-rules.test.ts`
Expected: FAIL — `TrackOptions` has no `ground`.

- [ ] **Step 3: Rewrite `Track.castDown` in `src/sim/track.ts`**

Keep the existing segment-and-seam selection exactly as it stands — `segmentIndexFor`, then the neighbour when within 2 units of a boundary — and for each candidate call `castDownMesh` over that segment's triangle range from `ground.segmentStart` / `segmentEnd`. Return the nearest hit across candidates. Delete the `height` / `halfWidth` arithmetic.

- [ ] **Step 4: Update `buildSliceTrack` and the test call sites**

`buildSliceTrack(segments)` builds `new Track({ ground: flatGroundMesh(segments) })` and keeps its props unchanged. The prop positions still assume a flat strip at z = 0, which `flatGroundMesh` still is, so the 14 rules tests keep their meaning.

- [ ] **Step 5: Run the whole suite**

Run: `npx vitest run && npx tsc --noEmit`
Expected: PASS, 64+ tests.

- [ ] **Step 6: Commit**

```bash
git add src/sim/track.ts tests/track-rules.test.ts
git commit -m "Track reads its ground from a mesh instead of a flat strip"
```

---

### Task 3: The no-ground sentinel and the third fall clause

**Files:**
- Modify: `src/sim/world.ts:287-293` — the fall rule
- (`NO_GROUND_EFFECT_ID` and the `updateHover` change land in Task 0)
- Test: `tests/track-rules.test.ts`

**Interfaces:**
- Produces: `export const NO_GROUND_EFFECT_ID = 99;` tagged `RECOVERED - doMach5:481 sets pTrackFace = 99 when modelsUnderRay returns nothing.`

- [ ] **Step 1: Write the failing tests**

```ts
it('marks a missed probe with the no-ground sentinel', () => {
  // Step a World on a 1-segment flat mesh with the car off the strip;
  // expect vehicle.effectId === K.NO_GROUND_EFFECT_ID.
});

it('does not end the run below the fall height while a wheel reports ground', () => {
  // z <= FALL_DEATH_Z, powerCoeff === 0, but effectId !== 99 -> outcome stays
  // 'running'. This is SEG_4's road at z -10.1.
});

it('a parked quad does not count as ground', () => {    // Review Focus 3
  // A mesh with a single two-triangle quad at z = -20; a ray from z = 5
  // with maxDistance 1 must miss, so a falling car is not rescued by it.
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run tests/track-rules.test.ts`
Expected: FAIL — `NO_GROUND_EFFECT_ID` is not exported.

- [ ] **Step 3: Implement the sentinel**

The sentinel itself lands in Task 0. What remains here is `world.ts`: add `&& this.vehicle.effectId === K.NO_GROUND_EFFECT_ID` to the fall condition.

Note what this clause does and does not do. It is **functionally redundant** — `maxDistance: 1` is shorter than `HOVER_DISTANCE = 1.2`, so a grounded wheel is exactly a wheel whose ray hit, and `powerCoeff === 0` already implies the rear-left ray missed, which already implies 99. It is ported because it is the original's condition and it states the intent; it is **not** ported to prevent a false death, and no test should claim it does.

- [ ] **Step 4: Run to verify they pass**

Run: `npx vitest run && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/sim/constants.ts src/sim/vehicle.ts src/sim/world.ts tests/track-rules.test.ts
git commit -m "Port pTrackFace = 99, the clause that makes the fall rule safe"
```

---

### Task 4: Extract the track

**Files:**
- Create: `tools/build_track_ground.mjs`
- Modify: `tools/extract_mesh.sh` — decode resource 7587 and run the converter
- Create (generated, tracked): `public/models/track.glb`, `public/models/track-ground.bin`
- Test: `tests/track-ground-data.test.ts`

**Interfaces:**
- Produces:
  - `track-ground.bin`: a little-endian header `magic "SRTG"`, `uint32 version = 1`, `uint32 segmentCount`, `uint32 triangleCount`, `uint32 vertexCount`, `float32[3] spawn` — then `float32` positions, `uint32` indices, `uint8` surfaceIds, `uint32` segmentStart, `uint32` segmentEnd.
  - `src/sim/ground-mesh.ts` gains `function parseGroundMesh(bytes: Uint8Array): GroundMesh & { spawn: Vec3 }`. It takes `Uint8Array` rather than `ArrayBuffer` so the browser's `fetch` path and the test's `readFileSync` path hand it the same type without a cast.

- [ ] **Step 1: Write the failing test**

```ts
it('carries 37 segments and the recovered start line', () => {
  const mesh = parseGroundMesh(readFileSync('public/models/track-ground.bin'));
  expect(mesh.segmentCount).toBe(37);
  expect(mesh.spawn.x).toBeCloseTo(41.98, 1);
  expect(mesh.spawn.y).toBeCloseTo(38.83, 1);
  expect(mesh.spawn.z).toBeCloseTo(16.56, 1);
});

it('files every triangle under exactly one segment', () => {
  // segmentStart[0] === 0, segmentEnd[36] === triangleCount, and each
  // segmentEnd[i] === segmentStart[i+1].
});

it('uses 1-based sub-mesh indices within 1..16', () => {
  // every surfaceIds entry is >= 1 and <= 16
});

it('never reports surface 1, which has no live geometry on this level', () => {
  // ROAD_Finish's 98 triangles are all parked at z = -20, so no live
  // triangle may carry surfaceId 1.
});

describe('parseGroundMesh rejects a file it cannot trust', () => {
  it('rejects a bad magic', () => { /* "XXXX" -> throws */ });
  it('rejects an unsupported version', () => { /* version 2 -> throws */ });
  it('rejects a truncated file', () => { /* bytes sliced short -> throws */ });
  it('rejects counts that do not match the payload', () => { /* triangleCount too large -> throws */ });
  it('rejects an index past the vertex count', () => { /* throws */ });
  it('rejects a non-finite coordinate', () => { /* NaN written into positions -> throws */ });
  it('rejects segment ranges that are not contiguous and ascending', () => { /* throws */ });
});
```

Each rejection throws rather than returning a partial mesh: a ground file that is wrong in the middle would otherwise surface as a car falling through the world a minute into a run, which is the worst place to learn it.

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/track-ground-data.test.ts`
Expected: FAIL — the file does not exist.

- [ ] **Step 3: Write `tools/build_track_ground.mjs`**

Reads the decoded `track.glb` with the same minimal GLB reading `tests/glb.ts` does, keeps nodes matching `/^SEG_\d+$/`, sorts them by their numeric suffix, and for each emits every primitive's triangles with `surfaceId` set to the primitive's 1-based index. Vertex positions are baked through the node's translation and scale so the output is in world space. `spawn` is `carPos_Mach5`'s translation.

- [ ] **Step 4: Extend `tools/extract_mesh.sh`**

After the Mach 5 step, decode `SR_level_1_7587.xmed` to `public/models/track.glb` and run the converter. Print the SHA-256 of both outputs as the script already does for the car.

- [ ] **Step 5: Implement `parseGroundMesh` and run the tests**

Run: `tools/extract_mesh.sh && npx vitest run tests/track-ground-data.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add tools/build_track_ground.mjs tools/extract_mesh.sh src/sim/ground-mesh.ts \
        tests/track-ground-data.test.ts public/models/track.glb public/models/track-ground.bin
git commit -m "Extract the 37 track segments as sim-readable ground data"
```

---

### Task 5: Rapier trimesh colliders, one segment at a time

**Files:**
- Modify: `src/physics/rapier-body.ts` — add `addTrimesh`, remove nothing yet
- Test: `tests/rapier-determinism.test.ts` (new cases) or `tests/rapier-trimesh.test.ts`

**Interfaces:**
- Consumes: `GroundMesh` from Task 1.
- Produces: `addTrimesh(positions: Float32Array, indices: Uint32Array): RAPIER.Collider` with `friction = 0`, `restitution = 0`, matching `PREP:381`. Colliders are enabled and disabled with `collider.setEnabled(boolean)`.

- [ ] **Step 1: Write the failing test**

```ts
it('stops a falling body on a trimesh and not on a disabled one', () => {
  // Drop a chassis onto one segment's triangles; assert it comes to rest.
  // Disable the collider, drop again, assert it passes through.
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/rapier-trimesh.test.ts`
Expected: FAIL — `addTrimesh` is not a function.

- [ ] **Step 3: Implement `addTrimesh`**

`ColliderDesc.trimesh(positions, indices)` on a fixed rigid body, friction and restitution zero. Rapier wants a `Float32Array` of positions and a `Uint32Array` of indices, which is what `GroundMesh` already holds.

- [ ] **Step 4: Run to verify it passes, then check the Jacks still land**

Run: `npx vitest run`
Expected: PASS, including the existing Jacks and CCD coverage. The spec flags this as the risk of trading a thick slab for a thin surface; if the car tunnels, raise `SUBSTEPS` or the chassis CCD rather than thickening the track.

- [ ] **Step 5: Commit**

```bash
git add src/physics/rapier-body.ts tests/rapier-trimesh.test.ts
git commit -m "A trimesh ground collider, friction and restitution zero as PREP sets them"
```

---

### Task 6: Draw the track

**Files:**
- Create: `src/render/track-view.ts`
- Modify: `src/render/model-frame.ts` — extract the `SceneRoot` upright step so it is written once
- Modify: `src/render/mach5-original.ts` — use the extracted helper
- Test: `tests/track-view-nodes.test.ts`

**Interfaces:**
- Produces:
  - `model-frame.ts` gains `export function isDrawnTrackNode(name: string): boolean` — true only for `/^SEG_\d+$/`.
  - `track-view.ts` exports `class TrackView { static load(url?: string): Promise<TrackView>; readonly object: THREE.Group; report(): { drawn: number; hidden: number } }`.

- [ ] **Step 1: Write the failing test**

```ts
it('draws the 37 segments and nothing else', () => {
  const glb = new Glb('public/models/track.glb');
  const drawn = glb.json.nodes.filter((n) => isDrawnTrackNode(n.name ?? ''));
  expect(drawn).toHaveLength(37);
  for (const name of ['carPos_Mach5', 'path_01', 'Tree_1', 'INV_1']) {
    expect(isDrawnTrackNode(name)).toBe(false);
  }
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/track-view-nodes.test.ts`
Expected: FAIL — `isDrawnTrackNode` is not exported.

- [ ] **Step 3: Implement `isDrawnTrackNode` and `TrackView`**

`TrackView.load` uses `GLTFLoader` as `OriginalMach5.load` does, clears the `SceneRoot` Y-up rotation through the shared helper, and sets `visible = false` on every node failing `isDrawnTrackNode`. Shadows: segments receive, and do not cast.

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/render/track-view.ts src/render/model-frame.ts src/render/mach5-original.ts \
        tests/track-view-nodes.test.ts
git commit -m "Draw the original track, segments only"
```

---

### Task 7: Wire it up and drive it

**Files:**
- Modify: `src/main.ts:116-145` — load the ground data, build the track, swap the collider, spawn at the start line
- Modify: `src/render/scene.ts` — stop generating road geometry
- Test: manual, plus the full suite

**Interfaces:**
- Consumes: Tasks 1–6 entire.

- [ ] **Step 1: Replace the ground strip**

`main.ts` fetches `models/track-ground.bin`, calls `parseGroundMesh`, builds `new Track({ ground })`, and creates one `host.addTrimesh` per segment from that segment's triangle range. Delete the `host.addGroundStrip` call and `TRACK_HALF_WIDTH`.

- [ ] **Step 2: Toggle colliders with the segment**

Exactly one track collider is enabled at a time, and the order is the original's: **disable the old, then enable the new**, in the same tick — `MOVIE.ls:135-136` is `disableCollision(SEG_TRK[tSEG1])` followed by `enableCollision(SEG_TRK[tSEG2])`. `Track.changeSegment` already names the moment; the collider array is held in `main.ts` beside the prop colliders.

Do **not** enable the neighbour's collider at a seam. The asymmetry is deliberate and is the original's: the hover ray consults two segments within 2 units of a seam, the physical collider only ever one. Reproducing it is the point.

Tests, in `tests/segment-transition.test.ts`:

```ts
it('enables only the entered segment, in both directions', () => {
  // Cross 300 forwards: segment 1 disabled, 2 enabled, never both, never neither.
  // Cross back: segment 2 disabled, 1 enabled.
});

it('finds ground across a seam while only one collider is live', () => {
  // At y = 299.5 the probe must still hit, from either segment's geometry,
  // with a single collider enabled.
});

it('survives a segment whose geometry overruns its slice', () => {
  // Nine segments spill up to 1.30 past their nominal end; a probe at
  // 300 + 1.0 must find the previous segment's triangles.
});
```

- [ ] **Step 3: Spawn at the start line**

Place the chassis at the mesh's `spawn`, raised by `K.SPAWN_HEIGHT` above the surface found by a downward probe from it, keeping the substitute rationale in `constants.ts:133`.

- [ ] **Step 4: Stop drawing the generated road**

`createScene` no longer takes `segments` and `halfWidth` for road geometry; `main.ts` adds the `TrackView` object to the scene instead.

- [ ] **Step 5: Verify**

Run: `npx tsc --noEmit && npx vitest run`
Then run the app and confirm by screenshot: the car sits on the real road at the start line, the HUD reads `wheels 4/4`, and driving forward crosses a segment seam without the car dropping.

- [ ] **Step 6: Commit**

```bash
git add src/main.ts src/render/scene.ts
git commit -m "Drive the original course"
```

---

### Task 8: Tell the truth in the docs

**Files:**
- Modify: `docs/research/asset-catalog.md` §2 and §8, `docs/research/open-questions.md` §4.2, `docs/research/w3d-format.md` (the surface-mapping paragraph), `docs/implementation-plan.md`, `README.md`, `src/sim/constants.ts` (the surface table's `inferredName`)

- [ ] **Step 1: Record the surface mapping as recovered**

`SURFACES_BY_EFFECT_ID`'s `inferredName` becomes the material name from the design document's table. Grip 0.016 is **ice and snow**, drag 0.5 is **grass**. The grip and drag numbers do not change. Note in the comment that the id is the sub-mesh index, not the face index, and why.

- [ ] **Step 2: Update the research documents**

`w3d-format.md`'s closing paragraph says the face-to-material link is reachable; it is now read. `open-questions.md` §4.2 moves to RECOVERED with the track imported. `asset-catalog.md` §2 and §8 list the track as extracted. `README.md` and `implementation-plan.md` stop saying the track is generated.

- [ ] **Step 3: Re-verify the artifact baseline**

Run the 21-hash check from `artifact-inventory.md`. Expected: 21/21, no drift.

- [ ] **Step 4: Commit**

```bash
git add docs/ README.md src/sim/constants.ts
git commit -m "The surfaces are recovered, not inferred"
```
