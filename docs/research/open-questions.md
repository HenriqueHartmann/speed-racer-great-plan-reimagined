# Open Questions

Status tags follow `docs/research/project-brief.md`.

Each row records what is unresolved and the **next safe step** — an action that executes nothing
original, installs nothing unaudited, and bypasses no access control.

---

## 1. Tooling

| # | Question | Status | Next safe step |
|---|---|---|---|
| 1.1 | Does ProjectorRays handle **Afterburner-compressed Director 10.1** movies? | **RESOLVED — yes** | Its JavaScript port parsed all four movies: `read()` true, `afterburned` true, version 1000 (Director 10), 36 scripts recovered in total. See `implementation-plan.md` §Stage 1 results |
| 1.2 | Does LibreShockwave parse our `SR_level_1.dcr`? | **UNKNOWN — and no longer urgent** | ProjectorRays already succeeded, so LibreShockwave is now a *cross-check* rather than a necessity. It remains the only candidate claiming Shockwave3D support, which matters for §2. Building it needs `cmake`, absent from this machine |
| 1.3 | Can any tool export W3D **geometry** (not just metadata)? | **UNKNOWN** | No candidate currently satisfies all four project requirements — see §2 |
| 1.4 | Is any hosted browser tool safe to hand an original artifact? | **RESOLVED for ProjectorRaysWeb — and then avoided entirely** | Source audit found **zero** network primitives (no `fetch`, `XMLHttpRequest`, `WebSocket`, `sendBeacon`, `FormData`, `Worker`, `eval`). Only external resource is `pako` from a CDN, loaded **without** Subresource Integrity — a residual supply-chain risk. Sidestepped by running the audited modules headlessly in Node with `pako` shimmed onto the built-in `zlib`: no browser, no CDN, no network |

---

## 2. W3D / 3D geometry

### The four requirements no tool currently satisfies

1. Publicly auditable source code.
2. Suitable support for the Director 10.1 W3D variant.
3. Local operation, without running Director or a proprietary Windows binary.
4. No interaction with prohibited copy-protection mechanisms.

**This is a research limitation, not proof that no such tool exists.**

| Candidate | Against the four requirements |
|---|---|
| **ProjectorRays** | Source-available (1 ✓). Recovers Lingo; **its ability to export W3D geometry does not follow from that** and is unverified (2 ✗) |
| **LibreShockwave** | Source-available (1 ✓), AGPL-3.0. Claims Shockwave3D **metadata** reading — **metadata is not geometry** (2 unverified) |
| **innerscene W3D Viewer** | Claims W3D and extracted `3DEM` support with modern-format export. **No publicly auditable source repository confirmed** (1 ✗); uploads data to a third party (3 ✗). Reference/comparison tool only |
| **Shockwave-3D-World-Converter** | **Excluded** (3 ✗, 4 ✗) — binary-only Director 11.5 executable plus a `LeechProtectionRemovalHelp` Xtra dependency. Not installed, not executed, not downloaded |

### Format lineage — a correction worth preserving

An earlier revision of this research claimed that because W3D descends from Intel's IFX and
U3D/ECMA-363 derives from the same lineage, "a source-available specification exists for writing
our own reader." **That was an overclaim and is withdrawn.**

What is actually supported:

- ECMA-363 specifies **Universal 3D (U3D)** — not the complete Shockwave 3D format Director uses.
  *(documented fact — [Library of Congress FDD](https://www.loc.gov/preservation/digital/formats/fdd/fdd000491.shtml))*
- U3D derived mainly from the Shockwave-3D `.w3d` format, itself an offshoot of Intel's IFX toolkit
  format. *(documented fact — same source)*
- **A generic U3D reader must not be assumed to parse our `3DEM` / `IFX ` resources.** Direct
  compatibility must be demonstrated experimentally. *(project decision)*

This does **not** claim compatibility is impossible. It records that direct support has not been
demonstrated.

Format documentation resources:
[Earthquake-Project/Format-Documentation](https://github.com/Earthquake-Project/Format-Documentation)
and [Earthquake-Project/otherfileformats](https://github.com/Earthquake-Project/otherfileformats).
These are documentation efforts, **not** W3D geometry converters, and their existence does not
establish a complete public W3D specification.

### Custom parser — preliminary ESTIMATE, not a verified fact

Assumes one experienced developer, access to real sample files, and a working test loop.

| Milestone | Estimate |
|---|---|
| Header and block inspection | ~2–5 days |
| Simple static mesh + scene hierarchy | ~1–2 weeks |
| Useful geometry / material / texture exporter | ~4–8 weeks |
| Reconstructing undocumented progressive-mesh decoding | may extend to 2–4 months or longer |

Principal technical risks: progressive mesh / CLOD decoding; scene-node hierarchy and transform
composition; legacy materials, shaders, textures and UV mapping; coordinate-system conversion
(Z-up → target convention); silent loss of unsupported features on export.

### Recommended milestone — a limited proof of concept

1. Read and validate one extracted `3DEM` resource.
2. Identify and document the actual block structure.
3. Recover one small static mesh, if feasible.
4. Recover its basic material and texture, if present.
5. Export to GLB and verify in Three.js.
6. Record exactly which properties were **recovered, approximated, or lost**.

**Not authorized yet.** Geometry remains a separate future stage with a time budget agreed first.

---

## 3. Gameplay

| # | Question | Status | Next safe step |
|---|---|---|---|
| 3.1 | All physics constants — gravity, timestep, sub-steps, restitution, friction, tolerance, scale | **RECOVERED** | Values and their source handlers are in `gameplay-spec.md` §3. Remaining sub-question: whether gravity 90.81 reflects a non-metric world scale or deliberate arcade weighting — **UNKNOWN** |
| 3.2 | The vehicle handling model | **RECOVERED** | Rigid-body chassis with four-point raycast hover suspension and custom drive forces. Tuning constants in `gameplay-spec.md` §3b |
| 3.3 | Which gameplay objects actually use rigid-body simulation | **PARTIALLY RECOVERED** | The player and enemy chassis are Havok rigid bodies (`pChassisRB`), with friction and restitution both zero. Track, trees and pickups are configured in `BehaviorScript 20 — PREP`. A full per-object inventory has not yet been traced |
| 3.4 | Whether the Mach 5 controller relies on generic rigid-body physics | **RESOLVED — no** | The chassis is a rigid body, but grip and drive are custom: contact friction and restitution are set to zero and the controller applies its own suspension and drive impulses. This vindicates the hybrid architecture in `architecture.md` §3 |
| 3.5 | Gadget effects, durations, costs, cooldowns | **UNKNOWN — now tractable** | The handlers exist in the recovered source (`pBladesTIMER`, `pDeflectorTIMER`, `pGripTIMER`, `jacks_TIMER`, `pHas*` flags). Not yet traced |
| 3.6 | Pickup values | **UNKNOWN** | Decompile `Lscr` |
| 3.7 | Damage and oxygen rules | **UNKNOWN** | Decompile `Lscr` |
| 3.8 | Rival ("Duggery") behaviour model | **UNKNOWN** | Decompile `Lscr` |
| 3.9 | Segment count, length and layout | **PARTIALLY RECOVERED** | Segment length is **300 world units**, track advances along **+Y**, and boundary straddling is handled within 2 units of a seam. Segment *count* and layout still require W3D inspection |
| 3.10 | Key bindings | **UNKNOWN** | Decompile `Lscr` |
| 3.11 | Stage size — `512 × 384` read big-endian from `DRCF` | **INFERRED** | Byte-order assumption unconfirmed. Decompile `DRCF`, or measure a capture |
| 3.12 | Frame rate / tempo | **UNKNOWN** | Decompile `DRCF` |

---

## 4. Assets

| # | Question | Status | Next safe step |
|---|---|---|---|
| 4.1 | FLV pixel dimensions and true frame rate | **UNKNOWN** | `onMetaData` stores `width = 0`, `height = 0` and implausible `framerate`. Decode one frame |
| 4.2 | Polygon counts, materials, textures, hierarchy in the `3DEM` worlds | **UNKNOWN** | Blocked on §2 |
| 4.3 | Audio sample rate, bit depth, channels, duration | **UNKNOWN** | Extract and inspect, after Stage 1 approval |
| 4.4 | What the SWF members actually contain | **UNKNOWN** | Dump `FWS` payloads and inspect with ordinary SWF tooling |

---

## 5. Provenance and history

| # | Question | Status | Next safe step |
|---|---|---|---|
| 5.1 | Chain of custody for the supplied files | **UNVERIFIED** | Obtain the Internet Archive ZIP independently and compare against the SHA-256 baseline |
| 5.2 | Which release this build is | **UNKNOWN** | See the date conflict below |
| 5.3 | Whether other levels ever existed in the web build | **UNKNOWN** | Only one gameplay level movie, `SR_level_1.dcr`, is present in the supplied artifact (which also contains `SR_MAIN.dcr`, `JIGSAW.dcr` and `SLIDERS.dcr`). **Assume nothing.** Plan no content depending on levels we do not have |

### The unresolved release-date conflict

| Claim | Source |
|---|---|
| **2005-10-25** | [Internet Archive item](https://archive.org/details/SpeedRacerDemonOnWheels) |
| **2006** | secondary search summaries |
| `.dcr` mtime **2007-10-25** | supplied artifact |
| `SR_GAME.exe` mtime **2008-02-19** | supplied artifact |
| `MEDIA/` mtime **2008-06-01** | supplied artifact |
| FLV `creationdate` **2005-02-04** … **2005-09-05** | embedded metadata |

**INFERRED, not fact:** this may be a later re-release build from the 2008 film window.
**The conflict is retained unresolved.** Do not present one date as established.

### Misinformation note

A third-party source described this game as "a flash game". That is **wrong**, contradicted by the
`XFIR` / `MDGF` headers and the `Fver` value `10.1#11`. Treat secondary descriptions of the runtime
as unreliable.

---

## 6. Engineering

| # | Question | Status | Next safe step |
|---|---|---|---|
| 6.1 | Rapier cross-platform determinism for our exact build | **UNKNOWN** | Verify in the Stage 3 spike; report separately from same-build repeatability |
| 6.2 | JoltPhysics.js cross-platform deterministic build option | **UNKNOWN** | Must be verified for the exact build before any claim about a distributed package |
| 6.3 | Havok WASM deterministic-replay guarantees | **UNKNOWN** | No equivalent guarantee claimed absent specific documentation and testing |
| 6.4 | WebGPU availability under WebKitGTK | **UNKNOWN** | Verify for the concrete environment. Do not assume hardware acceleration merely because a WebGL context exists |
| 6.5 | Whether a full physics engine is warranted at all | **UNKNOWN** | Decided by the Stage 3 go/no-go, not in advance |
