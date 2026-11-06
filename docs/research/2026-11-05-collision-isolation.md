# Design note — per-vehicle collision isolation

**Status:** design note for approval. Nothing implemented. No production code
modified, nothing committed.
**Date:** 2026-11-05
**Answers:** Decision 2 of the rivals ruling — "collision groups are not yet an
approved solution".

The ruling is right that the audit asserted the mechanism without showing it.
This note shows it, by arithmetic and then by experiment, and compares it
against the alternative before choosing.

---

## 1. The requirement, stated exactly

Four vehicles, each in its own segment, against 37 ground trimeshes and 37
barrier trimeshes. For every pair (vehicle *V*, segment collider *S*):

> *V* collides with *S* **iff** *S* is *V*'s own active segment.

and independently of that,

> every vehicle collides with every other vehicle, wherever each of them is.

Today `SegmentColliders` holds one global `active` and calls `setEnabled`
(`physics/segment-colliders.ts:50-58`). A collider is enabled or it is not;
there is no "for whom". That is the whole defect.

---

## 2. Why one shared collider *can* give different answers per vehicle

The ruling's objection is that "a shared segment collider has one
membership/filter configuration". True — and sufficient, because Rapier's
interaction test is **conjunctive across both colliders**, so the shared
collider's *filter* is the per-vehicle selector.

Rapier 0.14's `InteractionGroups` is one `u32`: memberships in the high 16
bits, filter in the low 16. Two colliders interact iff

```
(memberships_A & filter_B) != 0   AND   (memberships_B & filter_A) != 0
```

Assign:

| Collider | memberships | filter |
|---|---|---|
| segment `S` (ground or barrier) | `TRACK` | **the set of vehicle bits currently in `S`** |
| vehicle `V_i` | `VEH_i` | `TRACK \| VEH_0 \| VEH_1 \| VEH_2 \| VEH_3` |

Substituting:

- `memberships_S & filter_V` = `TRACK & (TRACK | …)` = `TRACK` ≠ 0 — always true.
- `memberships_V & filter_S` = `VEH_i & filter_S` ≠ 0 **iff vehicle *i*'s bit is
  in that segment's filter.**

So the pair interacts exactly when vehicle *i* is in segment *S*. The second
term alone carries the per-vehicle answer, and it is a property of the
*segment's* mask, not the vehicle's — which is why one shared collider suffices.

Vehicle-to-vehicle: `memberships_{V_i} & filter_{V_j}` = `VEH_i & (… | VEH_i |
…)` ≠ 0 both ways. Always true, in any segment.

Five bits are used of sixteen: `TRACK` plus four vehicles. Eleven spare.

### Masks, concretely

```
TRACK = 1 << 0
VEH_0 = 1 << 1   (player)
VEH_1 = 1 << 2
VEH_2 = 1 << 3
VEH_3 = 1 << 4
ALL_VEHICLES = VEH_0 | VEH_1 | VEH_2 | VEH_3

vehicle i   : memberships = VEH_i,  filter = TRACK | ALL_VEHICLES
segment  S  : memberships = TRACK,  filter = (bits of the vehicles now in S)
```

A segment nobody occupies has filter `0` and is inert for everyone, while
remaining enabled. Segment changes are **one mask write per vehicle per change**:
clear the bit in the old segment, set it in the new. No collider is ever created,
destroyed, enabled or disabled again after construction.

---

## 3. The experiment

Three throwaway Rapier tests, run against the installed
`@dimforge/rapier3d-compat@0.14.0` and since removed. All three passed.

1. **One shared, permanently enabled floor collider; two falling bodies.**
   Floor filter = `VEH_0`. Body with membership `VEH_0` came to rest on it
   (z > 0); body with membership `VEH_1` fell straight through (z < −10). The
   floor's `isEnabled()` stayed `true` throughout. Then the floor's filter was
   rewritten to `VEH_1` and the first body began falling on the next steps.
   → *A shared collider does give different outcomes per vehicle, and the
   relationship is live.*
2. **Filter holding two bits** (`VEH_0 | VEH_2`): bodies 0 and 2 rested, body 1
   fell through. → *Several vehicles can occupy one segment.*
3. **Two bodies with different vehicle bits, head-on, no floor:** both reversed
   their x velocity. → *Vehicle-to-vehicle collisions survive the scheme.*

---

## 4. The six questions the ruling asked

**Exact masks** — §2 above.

**Independent activation for all four simultaneously?** Yes. Each vehicle's
presence is one bit in each segment's filter; the four bits are independent and
any combination is representable, including all four in one segment and all four
in different segments.

**Can one vehicle collide with a segment another ignores?** Yes — that is
experiment 1, and it is the point of the design.

**Do permanently enabled colliders make vehicles collide with inactive
segments?** No. "Enabled" and "interacts with vehicle *i*" are different
predicates here. A segment not holding *i*'s bit is, for *i*, exactly as
intangible as a disabled collider — the narrow phase never runs for that pair.
The recovered intangibility rule is preserved, now per vehicle rather than
globally, which is what the original actually did
(`MOVIE.ls:171-191`, `disableCollision(carName, segmentName)` — a per-pair call).

**Effect on raycasts** — **none, and this is worth being explicit about.** The
suspension probe is *not* a Rapier raycast. `Track.castDown`
(`sim/track.ts:163`) calls our own `castDownMesh` over the decoded `GroundMesh`
arrays (`sim/ground-mesh.ts:72`). It never touches the physics world, so
collision groups cannot affect it. The seam rule — two segments consulted within
2 units of a boundary while the solver sees one (`track.ts:165-169`,
`tests/segment-transition.test.ts`) — is therefore untouched by this change, and
stays exactly as recovered. **No adjacent collider is enabled to paper over a
seam.**

**Effect on collision events.** `collisionGroups` governs both detection and
response, so contact events follow the same rule as contacts: a pair that does
not interact generates no event. That is what we want — a rival must not raise
an event against a segment it is not in. (`solverGroups`, which filters forces
while keeping detection, is *not* used; it would report phantom contacts.)

**Collider count and performance — measured.** 74 trimeshes (37 ground, 20,276
triangles; 37 barrier, 8,156), all permanently enabled, against today's two.
1,200 ticks driving the real course, first 200 discarded:

| | enabled colliders | p50 | p95 | p99 |
|---|---:|---:|---:|---:|
| today (one segment) | 2 | 459.5 µs | 1110.4 µs | 1422.7 µs |
| all segments enabled | 74 | 418.3 µs | 1102.0 µs | 1425.5 µs |

**No measurable cost.** The two runs differ by less than their own run-to-run
spread, and the all-enabled run is nominally *faster* because it does no
`setActive` work per tick. Rapier's broad phase handles 74 static AABBs
trivially and the narrow phase only runs where the vehicle's AABB overlaps one.
Node v26.8.1; the browser caveats of the audit's §6 apply equally.

**Limits of the representation.** Sixteen membership bits total, five used. The
scheme is bounded at **sixteen vehicles**, not thirty-seven segments — segments
need no bit of their own. Since the original's field is three rivals plus the
player, the ceiling is three times what the game can ask for. If a future level
needed more than sixteen vehicles, this design would have to change; recorded
rather than designed around.

---

## 5. The alternative, and why not

**Per-vehicle collider sets.** Build four copies of each segment trimesh, one
per vehicle, each with its own `setEnabled`, keeping the current pattern.

| | collision groups | per-vehicle sets |
|---|---|---|
| Trimeshes | 74 | **296** |
| Triangle memory | 28,432 | **113,728** |
| Per segment change | one 32-bit mask write | one collider enable + one disable |
| Construction cost | as today | 4× the trimesh build, which is the slowest part of startup |
| Vehicle count ceiling | 16 | unbounded |
| Change to `SegmentColliders` | add masks | add a per-vehicle dimension |

Groups win on every axis but the ceiling, and the ceiling is 16 against a
requirement of 4. **Recommendation: collision groups.**

A third option — leave everything enabled with no filtering at all — is rejected
outright: it discards the intangibility rule the project has preserved
deliberately since Pass 0.

---

## 6. What changes, and what must not

`physics/segment-colliders.ts` gains a per-vehicle registration and loses its
single `active`; `physics/prop-colliders.ts` gains the same. `physics/rapier-body.ts`
gains the mask on `addTrimesh`/`addStaticBox`. `src/sim/` does not change at all —
collision groups are a physics-host concern and nothing in the simulation layer
learns about them.

Must not change: the seam asymmetry; `segment-transition.test.ts`'s seven
assertions; the behaviour that an unknown segment index leaves the previous
selection standing rather than going dark (`segment-colliders.ts:52-54`) — which
becomes per vehicle, and needs its own test for a second vehicle.
