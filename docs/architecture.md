# Architecture

Status tags follow `docs/research/project-brief.md`.

> **Nothing here is installed.** This is a proposal grounded in the research findings, not a locked
> decision. No `package.json` exists. The first dependency is installed only when Stage 3 is
> approved — see `docs/implementation-plan.md`.

---

## 1. Why a 3D/WebGL target

This is **evidence-driven, not preference**.

| Finding | Status | Consequence |
|---|---|---|
| The gameplay movie requires `Shockwave 3d Asset Xtra` | **VERIFIED** | The original targeted a 3D renderer |
| Four `3DEM` / `IFX ` worlds exist, the largest ~2.5 MB | **VERIFIED** | Real 3D geometry is present in the artifact |
| The gameplay movie declares `Havok.x32` | **VERIFIED** | Physics integration existed. Stage 1 recovered *how*: rigid-body chassis, zero contact friction, custom suspension and drive |
| Renderer-negotiation symbols: `getRendererServices`, `directX7_0`, `fullScene`, `hardwareAntialiasing`, `sw3dbaddriverlist` | **VERIFIED** (symbols) | A hardware Direct3D 7 path was **available**. Whether it was actually used at runtime is **UNKNOWN** — no gameplay has been observed |
| Symbols show heavy *scripted* behaviour | **INFERRED** | The original was likely not a pure simulation |

Note what is **not** claimed: an Xtra requirement proves the movie *asks for* the 3D renderer, not
that hardware acceleration was engaged on any particular machine. The driver blacklist symbol
(`sw3dbaddriverlist`) suggests the original itself anticipated machines where it would not be.

**Recommendation:** a 3D renderer is the **faithful target** for the reimagining, given a 3D Xtra
requirement and four 3D worlds in the artifact. This is a recommendation grounded in that evidence,
not a proof that a 2D approach is impossible.

---

## 2. Preferred initial stack

*(project decision)*

| Layer | Choice |
|---|---|
| Language | **TypeScript** |
| Build / dev server | **Vite** |
| Renderer | **Three.js** |
| Asset format | **glTF 2.0 / GLB** |
| Physics | **Rapier** (JavaScript / WASM) |
| Unit & simulation tests | **Vitest** |
| Browser smoke & integration tests | **Playwright** |

### Rendering target

**WebGL2** initially. The renderer architecture is kept isolated enough that a later **WebGPU**
evaluation does not require rewriting gameplay code.

### Alternatives

**Babylon.js** and **PlayCanvas** are valid choices.

**No market-share ranking is claimed** — no reliable evidence for one was gathered, and the absence
of that evidence is itself recorded rather than papered over.

The stack is **not** switched merely because another viable engine exists. It changes only on a
demonstrated compatibility, capability, or reproducibility problem.

---

## 3. Hybrid physics architecture

The central design decision. Two systems, with a deliberate boundary.

### The Mach 5 controller owns its arcade handling model

Implemented as explicit, configurable parameters — **not** a realistic car simulation, unless
evidence later demonstrates one is necessary.

- Acceleration and braking
- Speed limits
- Steering response
- Lateral grip and skid behaviour
- Scripted jumps and special actions
- Gameplay-specific damage and other rules

This makes handling feel a **tunable parameter set** rather than an emergent accident.

### Rapier handles what benefits from a physics engine

- Collision detection and queries
- Static obstacles and track boundaries
- Selected dynamic props
- Falling objects and physical debris where appropriate

### Everything else stays under explicit gameplay control

Scripted behaviour, track segment management, rival AI, gadgets, score, damage, oxygen.

### The open question this rests on

> **Answered in Stage 1 — the hybrid split matches the original.** Decompilation shows the Mach 5
> chassis *is* a Havok rigid body, but with **contact friction and restitution both set to zero**.
> Grip, drive and suspension are applied by the behaviour itself: a four-point raycast hover
> suspension plus custom drive impulses. The engine handled collision and integration; the game
> handled feel.
>
> This is the architecture proposed here, confirmed rather than assumed. Recovered constants are in
> `docs/research/gameplay-spec.md` §3b, and they become the starting point for the Stage 2 handling
> contract.

---

## 4. Determinism

Three distinct goals. **Never conflated.**

| # | Goal |
|---|---|
| 1 | **Repeatability** on the same build and environment |
| 2 | **Repeatability across rendering schedules** — frame pacing varies, tick sequence does not |
| 3 | **Cross-platform deterministic behaviour** |

Rapier's documentation describes cross-platform determinism under its documented conditions. This
project makes **no claim in either direction**: it neither asserts that a fixed timestep alone
guarantees determinism, nor that Rapier lacks deterministic replay. Goal 3 is **reported separately
and claimed to pass only when actually executed**.

### Assumptions any of these goals rests on

- Identical initial conditions and physics parameters
- Identical ordered simulation steps
- Stable ordering of world-affecting operations
- Identical recorded gameplay inputs
- Explicit random seeds
- No dependence on wall-clock timing for simulation decisions
- No unaccounted platform differences in game logic or transcendental math

The replay test design and its acceptance criteria live in `docs/implementation-plan.md`.

---

## 5. Physics alternatives — documented, no comparison spike required now

| Option | Note | Status |
|---|---|---|
| **JoltPhysics.js** | A real source-available JS/WASM project. Its cross-platform deterministic build option **must be verified for the exact build** before any claim about a distributed package | **UNKNOWN** |
| **Havok WASM** | Available in the Babylon.js ecosystem. **No equivalent deterministic-replay guarantee is claimed** absent specific documentation and testing | **UNKNOWN** |
| **Babylon physics plugins** | Integration layers, not independent physics engines | documented fact |
| **Three.js with no physics engine** | Retained as a fallback if Rapier integration stalls. Sufficient for a driving-only prototype | project decision |

**Rapier is not replaced unless a concrete compatibility, capability, or reproducibility problem is
demonstrated.**

---

## 6. Desktop distribution — out of scope for the initial prototype

The browser build is validated first. Wrappers are evaluated later, against the actual Linux
distributions and hardware targeted for release. **No wrapper dependency is added now.**

| Option | Trade-offs |
|---|---|
| **Tauri** | Uses **WebKitGTK** on Linux. Exposed to GPU-driver, WebGL2, rendering and runtime-version differences. WebGPU availability must be verified for the concrete WebKitGTK environment. **Do not assume hardware acceleration merely because a WebGL context exists** |
| **Electron** | Bundled Chromium gives a more controlled browser-engine baseline. Still depends on working graphics drivers and GPU configuration. Larger application footprint than a system-WebView wrapper |
| **Native build** | Potentially greater rendering and runtime control. Can require substantial work to reuse a TypeScript/Three.js implementation. Consider only if desktop distribution becomes a primary requirement, or if measured limitations justify it |

---

## 7. Performance posture

The original's stated requirements were **Pentium II 500 MHz, 128 MB RAM, DirectX 7, 16 MB
Direct3D card** *(source: the Internet Archive item listing)*, with a `512 × 384` stage
(**INFERRED**) and 16-bit-era texture formats (`rgba4444`, `rgba5551`).

Modern hardware is far above that envelope. **This is context, not a performance guarantee.**

Performance is measured against a **defined workload and environment** — named GPU and browser,
declared entity and draw-call counts, a fixed scripted run — reporting frame-time **p50 / p95 /
p99**. A single 60-FPS observation from an empty scene is **not** sufficient evidence of production
performance.

---

## 8. Module boundaries

Proposed separation, so the deterministic core can be tested without a browser:

| Module | Responsibility | Testable with |
|---|---|---|
| `sim/` | Fixed-timestep simulation: vehicle controller, rules engine, segment manager, seeded RNG. **No DOM, no WebGL, no wall-clock.** | Vitest, headless |
| `physics/` | Rapier integration behind a narrow interface, so the engine can be swapped or removed | Vitest |
| `render/` | Three.js scene, cameras, materials, HUD. Reads simulation state; never writes it | Playwright |
| `assets/` | glTF/GLB loading and validation | Vitest |
| `input/` | Input capture and the tick-indexed recording format used by replay tests | Vitest |

The `sim/` ↔ `render/` boundary is what makes determinism goal 2 testable: the simulation advances
on ticks, the renderer merely observes.
