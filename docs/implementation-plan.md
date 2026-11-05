# Implementation Plan

Status tags follow `docs/research/project-brief.md`.

> **Current position: Stage 3 complete — the technical spike runs, and is tested.**
>
> - Stage 0 complete — documentation and repository.
> - Stage 1 complete — decompilation, using the **ProjectorRays JavaScript core run headlessly in
>   Node.js**. The native ProjectorRays CLI remains **untested**; LibreShockwave remains untested.
> - Stage 2 complete — the handling contract.
> - Stage 2A complete — simulation cadence, force semantics, collision, segments and race rules.
>
> - Stage 3 complete — Vite + TypeScript + Three.js + Rapier, a drivable prototype, a
>   deterministic simulation core and the replay test suite.
>
> The original game has still never been executed. Decompiled output and working copies live in
> `original_game/` and are tracked. Each stage below requires **explicit approval** before it
> begins.

---

## Reverse-engineering tool evaluation

| Tool | Formats | Recovers | Limitations | Executes the game? | Status |
|---|---|---|---|---|---|
| **ProjectorRays** ([repo](https://github.com/ProjectorRays/ProjectorRays)) | DCR, DXR, CCT, CXT | Lingo source from bytecode, cast structure | README documents no version range, but its JS port **was verified** against our Afterburner D10.1 movies | No | **Verified working** (via the JS port) |
| **ProjectorRaysWeb** ([repo](https://github.com/Quackster/ProjectorRaysWeb)) | same | same, in JavaScript | **Audited: zero network primitives.** Loads `pako` from a CDN without SRI — avoided by running headless in Node with a `zlib` shim | No | **Used, headlessly** |
| **LibreShockwave** ([repo](https://github.com/LibreShockwave/LibreShockwave)) | DIR/DXR/DCR/CCT/CST; RIFX/XFIR/RIFF/FFIR | See upstream claims below | **AGPL-3.0** — license review required before any code reuse | No | **Important Stage 1 candidate** |
| **Earthquake Project format docs** ([Format-Documentation](https://github.com/Earthquake-Project/Format-Documentation), [otherfileformats](https://github.com/Earthquake-Project/otherfileformats)) | — | Director and related format documentation | Documentation resources, **not** a W3D geometry converter. Do not claim they establish a complete public W3D specification | No | Reference |
| In-repo Python Afterburner reader *(stdlib only)* | DCR | Chunk census, `XTRl`, `Lnam`, `CASt`, `DRCF`; locates `3DEM` and `FWS` payloads | No bytecode decompilation | No | **Working** — produced the format research |
| **ProjectorRays JS core, run headless in Node** | DCR | **Full Lingo decompilation** — verified on all four movies | Recovered 3 of 12 scripts in `JIGSAW.dcr`; cause unknown | No | **Working — Stage 1 primary** |
| **ScummVM Director engine** | DIR/DXR/DCR | Would *play* 2D Director titles | **2D only.** Shockwave 3D and the Havok Xtra are out of scope ([ScummVM](https://blogs.scummvm.org/djsrv/2020/08/17/shockwave/)) | Yes | **Not viable here** |

### LibreShockwave — upstream claims, read from its README

These are **the project's own documented claims**, not verified compatibility with our
`SR_level_1.dcr`:

- "LibreShockwave is a **C++20** project"
- Handles `.dir, .dxr, .dcr, .cct, .cst`; supports "RIFX, XFIR, RIFF, and FFIR containers"
- Capability listed: "**Afterburner-compressed files (.dcr, .cct)**"
- "Director versions **4 through 12**"
- "Lingo bytecode with **symbol, global, property, and handler resolution**"
- Reads "**Shockwave3D metadata**" among cast member types
- License: **AGPL-3.0**

**Why this matters:** our artifact is an Afterburner-compressed D10.1 movie — precisely the
combination whose support ProjectorRays does not document, and which LibreShockwave explicitly
claims. That makes it an important candidate, not a footnote.

**Two load-bearing cautions:**

1. **Shockwave3D *metadata* support does not imply W3D mesh extraction.** Metadata is not geometry.
2. **AGPL-3.0 is strongly copyleft.** LibreShockwave is usable as an **independent research tool**
   run beside this project. Its code must **not** be incorporated into our public game without a
   separate license review.

### Rejected: Shockwave-3D-World-Converter — VERIFIED by direct inspection

- Distribution is **binary only** — `Shockwave3DWorldConverter.exe`, `FreeImage.dll`,
  `Shockwave3DWorldConverter.dir`. No source for the converter itself.
- Built with Adobe Director 11.5.9.629 — using it means **running a Director projector**.
- Its README requires the **`LeechProtectionRemovalHelp` Xtra**, plus DropXtra, ImgXtra,
  awaSW3D (Beta) and Shell Xtra.
- License is MIT, but that covers the repository, not the Xtra dependencies.

Three of this project's own rules block it independently of anything else: do not execute legacy
executables, do not run untrusted binaries, do not interact with copy-protection mechanisms. No
further characterisation of what `LeechProtectionRemovalHelp` does is offered here, because none is
supported by a primary source we have read — and none is needed to justify the exclusion.

**Not used, not installed, not downloaded.**

---

## Stage 0 — Documentation and repository setup

**Status: documentation and staging prepared; pending human review and initial commit.**
The nine files exist and are staged. **The initial commit has not been created.**

### Deliverables — exactly nine files

| # | Path |
|---|---|
| 1 | `docs/research/project-brief.md` |
| 2 | `docs/research/artifact-inventory.md` |
| 3 | `docs/research/gameplay-spec.md` |
| 4 | `docs/research/asset-catalog.md` |
| 5 | `docs/research/open-questions.md` |
| 6 | `docs/architecture.md` |
| 7 | `docs/implementation-plan.md` |
| 8 | `README.md` |
| 9 | `.gitignore` |

### Acceptance checklist

- [x] All nine files exist and are written in English.
- [x] `.gitignore` was written **before** `git init`.
- [x] `git check-ignore -v` confirms exclusion of the original artifact directory **and**
      representative files inside it.
- [x] `git diff --cached --name-only` lists **exactly** those nine paths — nothing else.
- [x] `git config --local user.email` returns `alemaohartmann@gmail.com`; no Livon identity appears
      anywhere, and the global Git configuration is untouched.
- [x] All 21 original SHA-256 values match the baseline in `artifact-inventory.md`.
- [x] No original file was modified, renamed, moved or deleted.
- [x] No dependency installed; no `package.json`; no gameplay code.
- [x] No remote created, nothing pushed.
- [ ] **Initial commit** — not created; awaiting human review of the staged content.

---

## Stage 1 — Decompiler evaluation — **COMPLETE**

### What was actually done

1. **Source audit of ProjectorRaysWeb before handing it anything.** Its README claims local-only
   processing; the implementation was checked rather than trusted. The repository is a static site
   — `index.html`, `style.css` and 11 JavaScript modules, no build and no backend. A grep for
   network and code-execution primitives (`fetch`, `XMLHttpRequest`, `WebSocket`, `sendBeacon`,
   `FormData`, `Worker`, `importScripts`, `eval`, `Function`) returned **zero matches**. The only
   external resource is `pako` loaded from cdnjs — **without Subresource Integrity**, which is a
   real if small supply-chain risk.
2. **The browser was then avoided entirely.** The decompiler core has **no DOM coupling** — only
   `main.js` touches the page — and `pako` is used solely for `inflate`. So the audited modules
   were driven headlessly in Node 26 with `pako` shimmed onto Node's built-in `zlib`. No browser,
   no CDN, no `npm install`, no network. Strictly safer than the planned browser smoke test.
3. **Working copies** of the four movies were placed in `original_game/source/`;
   the originals were read once to copy and never written to.

### Measured results

| Movie | `read()` | Afterburner | Version | Casts | Scripts recovered | `Lscr` present |
|---|---|---|---|---:|---:|---:|
| `SR_level_1.dcr` | **true** | true | 1000 (Director 10) | 5 | **21** | 21 |
| `SR_MAIN.dcr` | **true** | true | 1000 | 5 | **9** | 9 |
| `MEDIA/JIGSAW.dcr` | **true** | true | 1000 | 1 | **3** | 12 |
| `MEDIA/SLIDERS.dcr` | **true** | true | 1000 | 1 | **3** | 3 |

**4328 lines of Lingo recovered.** Cast libraries in the two main movies are named
`Internal`, `3D`, `Sounds`, `Graphics`, `Flash`.

**One discrepancy, recorded not glossed:** `JIGSAW.dcr` has **12** `Lscr` resources but only **3**
scripts were recovered. The other nine were not reconstructed. Cause **UNKNOWN** — possibly scripts
not attached to a cast member, or a cast without a script context. This is a gap in recovery, not a
gap in the file.

### Conclusion

ProjectorRays **does** handle Afterburner-compressed Director 10.1, contrary to the uncertainty
recorded before testing. LibreShockwave was **not** needed and remains untested; it stays a
cross-check and the only candidate claiming Shockwave3D support. Building it would require `cmake`,
which is not installed on this machine.

### What this unblocked

The physics constants and the vehicle model, previously the project's largest unknown, are now
**RECOVERED** with handler-level citations. See `docs/research/gameplay-spec.md` §3 and §3b.

---

## Stage 1 — original plan, retained for reference

**Required separate approval. Not authorized by Stage 0.**

Evaluate candidates in **parallel** rather than gating everything on one tool. A ProjectorRaysWeb
failure must not terminate the whole investigation — that would discard a candidate whose
documented support matches our file better.

1. **ProjectorRaysWeb** against one copy of `SR_level_1.dcr` — *after* reviewing its actual network
   behaviour, since it would receive an original artifact.
2. **LibreShockwave** — assess its documented Afterburner and Director 4–12 support, then a
   controlled source build and parsing test, if approved.
3. **ProjectorRays locally** — only after the smoke test and review.

### Compare on measured results, not reputation

- File parsing success
- Director version detection
- Afterburner decompression success
- Number of recovered scripts
- Handler and symbol reconstruction
- Parse failures and unsupported chunks

**Do not assume the tools are interchangeable or that their decompiler outputs are equivalent.**

Then: decompile `Lscr`, extract the `3DEM` and `FWS` payloads into `original_game/`, and tag every
recovered behaviour per the evidence taxonomy.

**Acceptance:** each important parameter carries a status with its evidence; decompiler limitations
are documented; every handler that could not be reconstructed is listed **by name**.

**If every candidate fails:** physics constants stay UNKNOWN, Stage 2 becomes an explicit design
exercise, and that is recorded as a limitation rather than guessed around.

---

## Stage 2 — Handling contract — **COMPLETE**

Delivered as [`docs/research/handling-contract.md`](research/handling-contract.md).

Acceleration, top speed, steering, grip and drag per surface, jump impulse, suspension, gravity and
timestep are all **RECOVERED** with handler-level citations. Surface *names* are marked INFERRED,
because the globals that would name them are declared but never assigned. Seven open items are
listed explicitly rather than filled in.

**The largest translation risk is recorded, not hidden:** the drive path mixes `applyForce` and
`applyImpulse` and multiplies by a literal `60`, while the physics step is configured at `0.025 s`
(40 Hz). Whether the original was frame-rate coupled is **UNKNOWN**, and the factor must not be
ported literally until that is resolved.

**Acceptance met:** every number carries RECOVERED, INFERRED or UNKNOWN. None is a guess.

---

## Stage 3 — Technical spike — **COMPLETE**

Dependencies installed: TypeScript, Vite, Three.js, Rapier (`@dimforge/rapier3d-compat`), Vitest.
`npm audit` reports **0 vulnerabilities**.

### What was built

| Module | Role |
|---|---|
| `src/sim/constants.ts` | Every recovered constant, each tagged `RECOVERED` or `SUBSTITUTE` with its source handler |
| `src/sim/vehicle.ts` | The Mach 5 controller — engine-agnostic, no DOM, no clock |
| `src/sim/world.ts` | Fixed-timestep loop, race rules, snapshots and an ordered event log |
| `src/sim/rng.ts` | Seeded PRNG; the simulation never calls `Math.random()` |
| `src/sim/analytic-body.ts` | A reference body with no engine, so failures are attributable |
| `src/physics/rapier-body.ts` | Rapier-backed chassis and raycast ground probe |
| `src/render/scene.ts` | Three.js scene, chase camera, and the `VehicleView` boundary the car sits behind |
| `src/render/track-view.ts` | The original course, drawn: road segments only |
| `src/sim/ground-mesh.ts` | The triangle ground probe and the generated ground data's parser |
| `src/physics/segment-colliders.ts` | One solid segment at a time, as `doM5ChangeSegment` kept it |
| `src/render/mach5-original.ts` | The recovered Mach 5: gadget nodes, wheel placement, chassis assembly |
| `src/render/model-frame.ts` | How the exported model hangs off the chassis — DOM-free, so it is testable |
| `src/main.ts` | Accumulator loop: whole ticks for the sim, free frame rate for the renderer |

### Go/no-go: does Rapier earn its place?

**Yes, for now.** It passes determinism goals 1 and 2 under test — two identical runs agree exactly,
and five different render cadences (every tick, every 2nd, 7th, 31st, and never) produce byte-identical
snapshots and event logs. Goal 3, cross-platform determinism, is **not tested and not claimed**; the
test for it exists as a deliberately skipped marker rather than a silent gap.

The `ChassisBody` / `GroundProbe` interfaces mean swapping or dropping the engine would not touch
handling, so this is a reversible decision.

### Two real bugs the tests caught

1. **Rapier's `addForce` persists across steps.** It is not cleared for you, so the per-tick throttle
   force re-applied itself forever and the car accelerated to 400+ units and flew off. Fixed by
   resetting force and torque accumulators after each step.
2. **The Jacks impulse out-ran the suspension ray.** `mass * 40` is a 40 unit/s velocity change; at a
   1/30 s tick the car moves further per step than the ray is long, so it tunnelled through the
   ground. Fixed with CCD and a thicker ground collider.

### One research finding the prototype forced out

The prototype slid indefinitely and could not corner. That led back to the decompiled source and the
discovery of the **lateral anti-slide impulse** in `doMach5` — the car's only source of cornering
grip, which earlier research had wrongly recorded as existing solely in `doEnemy`. See
`handling-contract.md` §5b. Building the thing found what reading it had missed.

### Still outstanding

- Playwright smoke test not yet written.
- Performance not yet measured against a declared workload; no FPS claim is made.
- The track's scenery is not in: of the level's 760 meshes only the 37 road segments are drawn and
  driven on. Trees, walls, water, pickups and the invisible colliders carry gameplay rules.
- Rival AI not yet written: `doEnemy` is decompiled and the 209-point racing line is recovered
  with the track, but nothing drives against the player.

---

## Stage 3 — original plan, retained for reference

Vite + TypeScript + Three.js + Rapier: a box on a plane, keyboard-driven, fixed timestep.

### Required replay test — design now, run in Stage 3

1. A fixed initial physics world.
2. A recorded input sequence **indexed by simulation tick**.
3. A fixed pseudo-random seed.
4. **At least 3,600 fixed simulation ticks.**
5. Two independent executions of the same recorded sequence.
6. Snapshots of relevant simulation state **and** ordered gameplay events.
7. Replays under different render-frame schedules, with the tick sequence unchanged.

Comparison uses **stable numeric serialization and explicit comparison rules** over the fields
expected to be deterministic — not a blind diff of serialized objects carrying irrelevant fields.

### Acceptance

- Repeated runs under identical conditions produce equivalent snapshots and event logs
  (**determinism goal 1**).
- Different rendering schedules do not change the fixed-tick simulation result (**goal 2**).
- Any cross-platform result is **reported separately**, and claimed to pass only if actually
  executed (**goal 3**).
- Performance is measured against a **defined workload and environment** — named GPU and browser,
  declared entity and draw-call counts, a fixed 30-second scripted run — reporting frame-time
  **p50 / p95 / p99**. A single 60-FPS result from an empty scene is **not** sufficient evidence.
- A written **go/no-go** on whether Rapier earns its place.

---

## Stage 4 — Vertical slice of Level 1

Mach 5 controller matching the Stage 2 contract; one segment chain; collision with static props;
damage / oxygen / score HUD; one gadget (**Jacks** — the simplest and most clearly evidenced).

Art was to be **our own or placeholder**, never extracted assets. **That changed, deliberately.**
Once the W3D geometry proved decodable (`docs/research/w3d-format.md`), the project chose to use
the original models rather than approximate them, and the repository tracks them. The reasoning and
the limits are in `docs/research/project-brief.md` under the asset policy; this line is kept rather
than deleted so the change of position is visible.

**Acceptance:** a playable 60-second run exists; Vitest covers the rules engine; one Playwright
smoke test passes; a written comparison against reference footage records where the feel diverges.

---

## Stage 5 — Review gate

Reopen scope: remaining gadgets, rival AI, water and submersion, mini-games, cutscenes.

---

## Geometry conversion — a separate track

Does **not** block Stages 1–4. See `docs/research/open-questions.md` §2 for the four unmet
requirements, the effort estimate, the technical risks, and the six-step proof of concept.

**A time budget is agreed before this work starts.** The estimates recorded there are estimates,
not commitments.

---

## Decisions still requiring human approval

1. **Repository name** — leading with the trademark is the most exposed option.
2. **Creating and pushing the GitHub remote** — only after the first commit is inspected.
3. **Stage 1 authorization** — the decompiler evaluation.
4. **Reviewing and then using any hosted browser tool** with an original artifact.
5. **Building LibreShockwave from source**, plus its AGPL-3.0 license review.
6. **Geometry conversion budget** — before the proof of concept begins.
7. **Stage 3 dependency installation** — the first package installed in this project.
8. **Whether any original-derived material ever enters the public repository** — currently **no**,
   and this plan treats that as permanent.

---

## Risks

1. **No decompiler is verified against our file.** ProjectorRays documents no version range;
   LibreShockwave's support is an upstream claim. Mitigated by evaluating in parallel and by making
   the cheapest test the first action.
2. **W3D conversion is unsolved, and the fallback is expensive.** No tool meets all four
   requirements, and the U3D/ECMA-363 route is a *lead to test*, not a known-good path. Worst case
   is months on progressive-mesh decoding, or hand-rebuilding meshes from reference. **This is the
   project's largest schedule risk.**
3. **IP exposure is accepted, not eliminated.** Public repository under a real identity. See
   `docs/research/project-brief.md`.
4. **Only one gameplay level movie is present.** `SR_level_1.dcr` is the sole level in the supplied artifact, which also contains `SR_MAIN.dcr`, `JIGSAW.dcr` and `SLIDERS.dcr`. Plan no content depending on levels we do not have.
5. **Provenance unverified; build date unresolved.** Both retained as open items.
6. **No gameplay has been observed.** The Lingo source has been recovered and read, so behaviour is
   now traced from code rather than guessed from symbols — but the original game has still never
   been executed. Nothing in this repository is OBSERVED, and the documentation must not drift into
   implying otherwise.
