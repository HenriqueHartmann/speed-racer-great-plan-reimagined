# Speed Racer: The Great Plan — Research & Reimagining

A personal research project: reverse-engineering the structure of the historical browser game
*Speed Racer: The Great Plan*, and building a modern browser-based reimagining of it.

**Status: Stage 3 — there is a drivable prototype.** There is no game here yet — no gameplay code, no
dependencies, no build. What exists is documentation of what the original artifact actually
contains, written to a strict evidence standard. The original's Lingo source has been decompiled
locally, so the physics constants and vehicle model are now recovered facts rather than open
questions — the source itself stays local and is not part of this repository.

---

## What was found

The original is **not a Flash game**, despite third-party sources describing it that way. The file
headers say otherwise:

| Finding | Evidence |
|---|---|
| **Macromedia Director MX 2004 / Shockwave 10.1** | `XFIR` / `MDGF` container, `Fver` = `10.1#11` |
| **The gameplay movie requires 3D** | It declares `Shockwave 3d Asset Xtra` as an Xtra requirement |
| **With physics integration** | It also declares `Havok.x32` |
| **3D worlds are present** | Four `3DEM` / `IFX ` payloads; the largest ~2.5 MB |
| **Flash lives inside Director** | Twelve uncompressed SWF (`FWS`) members across the four movies |
| **The Mach 5 is 20 separate models** | `mach5_body`, four wheels, four grips, `jacks`, `saw`, `lights`, `scope_*`, `ROBOT` — matching the Lingo properties one for one |
| **Textures are JPEG** | Even when the name says `.png`; 50 extracted and verified |
| **The car is not a generic physics car** | Rigid-body chassis, friction and restitution both zero, with a four-point raycast hover suspension and custom drive forces |
| **World gravity is `-90.81` on Z** | With a `0.025 s` fixed timestep (40 Hz) and 5 sub-steps |
| **Track segments are 300 units long** | Advancing along +Y, with seam straddling handled per wheel |

Full details: [`docs/research/`](docs/research/).

---

## Running it

```bash
npm install
npm run dev     # http://localhost:5173
npm test        # determinism and replay suite
npm run build   # production bundle
```

W/A/S/D or the arrow keys drive; Space fires the Jacks; the digits `1`–`7` fire the seven gadgets.

**The car and the course are both the original's**, decoded from the game's own Shockwave 3D
worlds. The Mach 5 is 20 models and 4,454 triangles with its own textures; the track is the real
37-segment course, 11,092 units of road that curves and climbs, starting at the line the original
starts at. `tools/extract_mesh.sh` regenerates both from the artifact;
`docs/research/w3d-format.md` documents the format and the decoder, and
`docs/design/2026-11-05-original-track.md` the track.

**The level is in**, too: its walls and invisible fences hold you on the road, its 355 trees and
77 pickups are where the original put them, and its water drowns you. Damage, score, repair and
oxygen all fire on the real course — they had been implemented and unreachable, because there was
nothing to hit and nothing to collect.

What is still missing is the rival AI. The 209-point racing line came decoded with the track and
is waiting for it.

---

## Documentation

| Document | Contents |
|---|---|
| [`docs/research/project-brief.md`](docs/research/project-brief.md) | Objective, scope, **the evidence taxonomy**, asset policy |
| [`docs/research/artifact-inventory.md`](docs/research/artifact-inventory.md) | The 21 original files, SHA-256 baseline, resource census, provenance limits |
| [`docs/research/gameplay-spec.md`](docs/research/gameplay-spec.md) | Gameplay model recovered from symbols and source |
| [`docs/research/handling-contract.md`](docs/research/handling-contract.md) | **The vehicle behaviour to reproduce**, every number traced to its handler |
| [`docs/research/w3d-format.md`](docs/research/w3d-format.md) | The Shockwave 3D container format, reverse-engineered here |
| [`docs/research/asset-catalog.md`](docs/research/asset-catalog.md) | Assets located — and what has **not** been extracted |
| [`docs/research/open-questions.md`](docs/research/open-questions.md) | Everything unresolved, with the next safe step for each |
| [`docs/architecture.md`](docs/architecture.md) | Proposed technical architecture |
| [`docs/implementation-plan.md`](docs/implementation-plan.md) | Tooling evaluation and staged plan |

---

## How claims are labelled

Every claim in this repository carries a status. This is the discipline the project runs on:

| Status | Meaning |
|---|---|
| **VERIFIED** | Directly supported by bytes in the artifact, or by a cited primary source |
| **RECOVERED** | Supported by reconstructed code or data, with file + handler reference |
| **DERIVED** | Computed from verified implementation logic, with the derivation shown |
| **OBSERVED** | Supported by actual gameplay evidence |
| **INFERRED** | Plausible interpretation of symbols or structure |
| **UNKNOWN** | Unresolved, with the next investigation step recorded |
| **TODO(unverified)** | A placeholder where information is not yet available |

Two consequences worth stating plainly:

- **Nothing here is OBSERVED.** The original game has never been executed, and `SR_GAME.exe` was
  only string-scanned, never run. The Lingo source *has* been decompiled — using the ProjectorRays
  JavaScript core run headlessly in Node.js — so behaviour is traced from code rather than guessed
  from symbols. The native ProjectorRays CLI and LibreShockwave remain untested.
- **Physics parameters now have values, and each cites its source handler.** They were recovered by
  decompiling the Lingo bytecode locally. What is still unknown stays marked unknown — for example
  which surface each grip and drag pair belongs to, and whether gravity `90.81` reflects a
  non-metric world scale or deliberate arcade weighting.

---

## What this repository contains

This repository carries the **complete working set**, so that the project can be cloned and run on
the owner's own machines:

| Directory | Contents |
|---|---|
| `docs/` | Research documentation — the analysis, with every claim carrying an evidence status |
| `Speed Racer Demon on Wheels The Great Plan Full/` | The original artifact as supplied: four Director movies, the Windows projector, and 16 FLV videos |
| `original_game/source/` | Working copies of the four `.dcr` movies |
| `original_game/decompiled/` | The Lingo source recovered from those movies |
| `original_game/extracted/` | 3D worlds and Flash members pulled out of the movies, plus 50 extracted textures |
| `tools/` | Our own extraction and inspection tools — standard library only |
| `src/` | The reimagining: a deterministic simulation core, a Rapier physics backend and a Three.js renderer |
| `tests/` | Determinism and replay tests |

The original files are never moved, renamed or modified in place. Their SHA-256 values are recorded
in [`artifact-inventory.md`](docs/research/artifact-inventory.md) and re-verified before every
commit, so any drift would be visible.

Staging is still done by explicit path — `git add .` and `git add -A` are not used — so that every
addition to history is deliberate.

### Provenance and rights

*Speed Racer* / *Mach GoGoGo* is the intellectual property of its respective rights holders. The
artifact here is a 2005–2008 Shockwave title; its provenance is **unverified** and its release date
is **unresolved** (see the research documents). Nothing in this repository was authored by the
rights holders for this purpose, and no permission has been sought or granted.

## Legal note

*Speed Racer* / *Mach GoGoGo* is the intellectual property of its respective rights holders. This
is an independent personal research and reimplementation project with no affiliation to, or
endorsement by, any rights holder.

Copyright, trademark, trade dress and derivative-work issues are distinct legal concepts, and
whether and how each applies depends on the concrete use and the applicable jurisdiction. Nothing
in this repository is legal advice.

---

## Project

Personal project by [@HenriqueHartmann](https://github.com/HenriqueHartmann). Not affiliated with
any employer.
