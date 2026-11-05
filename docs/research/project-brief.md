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

**The repository owner has chosen to track the original artifact and everything derived from it**,
so the project can be cloned and run across their own machines. This document records that decision
plainly rather than describing a policy the repository does not follow.

### What is in version control

| Category | Tracked? |
|---|---|
| Original binaries and media — Director movies, the projector, FLV | **Yes** |
| Material derived from them — decompiled Lingo, working copies | **Yes** |
| Extracted or converted assets, once they exist | **Yes** |
| Our own documentation, code and art | **Yes** |

### What that means

- The repository is **public**, so this material is published, not merely stored.
- Git history is permanent: removing a file later does not remove it from history, and forks and
  caches persist independently.
- Commit author metadata is publicly visible.

### What has not changed

- Original files are **never moved, renamed or modified in place**. Their SHA-256 baseline is in
  `artifact-inventory.md` and is re-verified before every commit.
- Staging is by **explicit path**; `git add .` and `git add -A` are not used.
- No original executable, installer, projector or plugin is ever run.
- No binary-only tool is run, and no copy-protection mechanism is interacted with — that restriction
  is about **safety**, and is independent of any distribution question.

### Rights

*Speed Racer* / *Mach GoGoGo* is the intellectual property of its respective rights holders. No
permission has been sought or granted. Provenance of the artifact is **unverified** and its release
date is **unresolved**. Copyright, trademark, trade dress and derivative-work issues are distinct
legal concepts whose application depends on the concrete use and jurisdiction; nothing here is legal
advice.

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
| Original artifacts | Never moved, renamed, modified or deleted; SHA-256 re-verified before every commit |
| Tracked content | The full working set, including the original artifact and derived material |

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
