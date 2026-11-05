# Speed Racer: The Great Plan — Research & Reimagining

A personal research project: reverse-engineering the structure of the historical browser game
*Speed Racer: The Great Plan*, and building a modern browser-based reimagining of it.

**Status: research phase, Stage 1 complete.** There is no game here yet — no gameplay code, no
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
| **The car is not a generic physics car** | Rigid-body chassis, friction and restitution both zero, with a four-point raycast hover suspension and custom drive forces |
| **World gravity is `-90.81` on Z** | With a `0.025 s` fixed timestep (40 Hz) and 5 sub-steps |
| **Track segments are 300 units long** | Advancing along +Y, with seam straddling handled per wheel |

Full details: [`docs/research/`](docs/research/).

---

## Documentation

| Document | Contents |
|---|---|
| [`docs/research/project-brief.md`](docs/research/project-brief.md) | Objective, scope, **the evidence taxonomy**, asset policy |
| [`docs/research/artifact-inventory.md`](docs/research/artifact-inventory.md) | The 21 original files, SHA-256 baseline, resource census, provenance limits |
| [`docs/research/gameplay-spec.md`](docs/research/gameplay-spec.md) | Gameplay model recovered from symbols |
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

- **Nothing here is OBSERVED.** The original game has never been executed. A custom read-only
  inspection script (Python standard library, operating in memory) *was* run and produced most of
  this research; no third-party decompiler has been tested, and `SR_GAME.exe` was only
  string-scanned, never run.
- **Physics parameters now have values, and each cites its source handler.** They were recovered by
  decompiling the Lingo bytecode locally. What is still unknown stays marked unknown — for example
  which surface each grip and drag pair belongs to, and whether gravity `90.81` reflects a
  non-metric world scale or deliberate arcade weighting.

---

## What this repository does and does not contain

> **No original game binaries, extracted media, converted assets or decompiled source code are
> tracked or distributed by this repository.**

Four categories, kept distinct:

| Category | Present here? |
|---|---|
| Original binaries and media — Director movies, executables, FLV, audio, bitmaps | **No** |
| Extracted or converted assets — meshes, textures, dumped SWF, decoded audio | **No** |
| Decompiled source code — reconstructed Lingo | **No** |
| Factual technical research notes from read-only analysis | **Yes, by design** |

The fourth category is the point of this repository, and it is worth being explicit: the research
documents **do** contain factual observations derived from the original artifact — identifiers,
cast member names, resource IDs, payload sizes, chunk signatures and file hashes. That information
is the product of the research; it is not the game.

The original artifacts sit **physically inside the project root** on the author's machine. They are
not outside the working tree — they are excluded from Git by [`.gitignore`](.gitignore), verified
with `git check-ignore` before every commit, and never moved, renamed or modified.

### Obtaining the original artifact

This repository **does not distribute the original game and does not link to downloads.**

Anyone wishing to reproduce this research must obtain the original artifact themselves and must
have an appropriate legal basis to access it. The file hashes in
[`artifact-inventory.md`](docs/research/artifact-inventory.md) exist so that a copy can be compared
against the one studied here — not as a pointer to a source.

---

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
