# Project Brief

## Objective

Reverse-engineer the gameplay and technical structure of the historical browser game
*Speed Racer: The Great Plan*, and build a modern browser-based reimagining that preserves its
arcade racing feel while remaining maintainable and extensible.

## Current status

**Research phase.** No gameplay code exists. No dependency is installed.

Three statements that must not be collapsed into one:

| | |
|---|---|
| **Custom inspection script** | **Was run.** Read-only, Python standard library (`zlib`), operating in memory. It wrote nothing and modified nothing. It produced most of this research |
| **Third-party decompilers** | **Not yet tested.** ProjectorRays, LibreShockwave — never executed |
| **Original executables and projectors** | **Never executed.** `SR_GAME.exe` was only scanned with `strings(1)` |

No original artifact has been modified, renamed or moved. Everything recorded in `docs/research/`
comes from that read-only inspection plus cited external sources.

---

## Evidence taxonomy

This taxonomy governs **every** document in this repository. Each claim carries exactly one status.

| Status | Meaning |
|---|---|
| **VERIFIED** | Directly supported by bytes in the artifact, or by a cited primary source |
| **RECOVERED** | Supported by reconstructed code or data, with file + handler reference |
| **DERIVED** | Computed from verified implementation logic, with the derivation shown |
| **OBSERVED** | Supported by actual gameplay evidence |
| **INFERRED** | Plausible interpretation of symbols or structure |
| **UNKNOWN** | Unresolved, with the next safe investigation step recorded |
| **TODO(unverified)** | A placeholder where information is not yet available |

### Rules

1. Never invent a parameter value, a mechanic, a script, or an asset provenance.
2. Never promote **INFERRED** to **VERIFIED** without new evidence.
3. **OBSERVED** requires that gameplay was actually executed and watched. As of this writing,
   **nothing in this repository is OBSERVED** — the original game has never been run.
4. Record every handler a decompiler could not reconstruct, by name.
5. A claim that cannot be verified is stated as unverified, not quietly softened.

---

## Scope

### In scope — the first milestone

A **vertical slice of Level 1**: a playable segment with the Mach 5, a streamed track segment chain,
collision against static props, the damage / oxygen / score rules, and one gadget.

### Out of scope for now

- The remaining Mach 5 gadgets, rival AI, water and submersion mechanics.
- The `JIGSAW` and `SLIDERS` mini-games.
- The FLV cutscenes and voice-over content.
- Desktop packaging (Tauri / Electron / native). The browser build is validated first.
- Any level other than Level 1. **Only one gameplay level movie, `SR_level_1.dcr`, is present in
  the supplied artifact** — the package also contains `SR_MAIN.dcr`, `MEDIA/JIGSAW.dcr` and
  `MEDIA/SLIDERS.dcr`, but no second level. No content may be planned that depends on levels we do
  not have.

---

## Asset and publication policy

Three distinct contexts. Conflating them is the mistake this policy exists to prevent.

### A. Local research laboratory

The original artifacts, and anything extracted from them — decompiled Lingo, converted meshes,
textures, audio, SWF dumps. Lives on local disk under `original_game/`. **Never committed, never
pushed.** All analysis happens here.

### B. Private prototype

A local build that may load reference material while handling and geometry are being measured.
Not distributed. Subject to whatever permissions actually apply.

### C. Publicly distributable game

This repository.

> **No original game binaries, extracted media, converted assets or decompiled source code are
> tracked or distributed by this repository** — neither in the working tree nor in Git history.

It contains our own documentation, our own code and our own art. Stated precisely, because the
distinction matters:

| Category | Present here? |
|---|---|
| Original binaries and media | **No** |
| Extracted or converted assets | **No** |
| Decompiled source code | **No** |
| Factual technical research notes from read-only analysis | **Yes, by design** |

The research documentation **does** contain factual observations and identifiers obtained from the
original artifact — cast member names, Lingo symbols, resource IDs, payload sizes, chunk signatures,
file hashes. Claiming otherwise would be false. That information is the product of the research; it
is not the game.

The original artifacts are **physically inside the project root**, not outside the working tree.
They are excluded from Git by `.gitignore` and verified with `git check-ignore`.

### Honest limitation

Excluding original media files does **not** by itself resolve every intellectual-property question.
Copyright, trademark, trade dress and derivative-work issues are **distinct legal concepts**, and
whether and how each applies depends on the concrete use and the applicable jurisdiction. This
document does not attempt to decide that, and none of it is legal advice.

What can be said plainly: a public repository under a real name and personal email is a more exposed
position than an anonymous archive item, and DMCA takedowns against game-asset repositories do
occur. This is recorded as an accepted, project-owner risk — not as a solved problem.

Anyone obtaining the original artifacts must have an appropriate legal basis to access them. This
repository does not link to downloads and does not redistribute the original game.

---

## Repository policy

This repository is **public**, personal, and not affiliated with any employer.

| Control | Rule |
|---|---|
| `.gitignore` | Written **before** `git init` stages anything |
| Staging | **Explicit paths only.** Never `git add .`, never `git add -A` |
| Verification | `git check-ignore -v` on the artifact directory and representative files inside it |
| Identity | Set **repository-local only**, never global |
| Author metadata | Publicly visible in a public repository — an accepted, authorized choice |
| Original artifacts | Never moved, renamed, modified or deleted |

**Layout note.** The original artifact directory sits *inside* the project root. Physical separation
is unavailable without relocating it, and relocating an original artifact is forbidden by this
project's own rules. Therefore `.gitignore` plus explicit-path staging **is** the isolation control,
and it is verified before every commit rather than assumed.

---

## Non-goals

- Bit-for-bit reproduction of the original binary or its assets.
- Redistribution of original game content in any form.
- Running the original game, its installer, or its projector as part of the normal workflow.
- Bypassing copy protection, access controls, or any similar mechanism.
- Executing binary-only tools whose source cannot be audited.

---

## Related documents

- `docs/research/artifact-inventory.md` — the supplied files, hashes, provenance limits
- `docs/research/gameplay-spec.md` — gameplay model recovered from symbols and source
- `docs/research/handling-contract.md` — the vehicle behaviour to reproduce, with sources
- `docs/research/asset-catalog.md` — assets located, and what has not been extracted
- `docs/research/open-questions.md` — what is unresolved and the next safe step for each
- `docs/architecture.md` — proposed technical architecture
- `docs/implementation-plan.md` — tooling evaluation and staged plan
