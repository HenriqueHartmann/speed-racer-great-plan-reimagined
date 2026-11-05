# The Shockwave 3D (`IFX`) container — format notes

Status tags follow `docs/research/project-brief.md`.

Reverse-engineered for this project from the four worlds shipped in *Speed Racer: The Great Plan*.
Implemented in `tools/w3d/ifx.py`; inspect with `tools/w3d_dump.py`.

> **This is not U3D.** ECMA-363 (Universal 3D) descends from the same Intel IFX lineage, but it does
> not describe this layout and a U3D parser cannot read these files. The earlier hope that the U3D
> specification would serve as documentation is **withdrawn** — the layout below was derived from
> the bytes, not from a standard.

---

## Container — VERIFIED

```
magic    "IFX\0"      4 bytes
version  uint32       observed 8 in all four worlds
field3   uint32       observed 17 in all four worlds; meaning UNKNOWN
size     uint32       total file length — matched exactly in all four worlds
blocks   to EOF       [type uint32][size uint32][data]
                      next block starts 4-byte aligned
```

All integers little-endian. Block types are always `0xffffffXX`; the tables below name them by the
low byte.

**Validation:** all four worlds walk from header to EOF with no trailing bytes and no malformed
block — 132, 75, 134 and 3631 blocks respectively. A structural error anywhere would desynchronise
the walk and fail loudly, so this is a strong check rather than a plausible-looking one.

---

## Block types — identified from their contents

| Type | Name | Evidence |
|---|---|---|
| `0x01`, `0x02` | unknown | 3–4 byte payloads near the head of the file |
| `0x10` | material | begins with a name such as `Default Material`, followed by floats |
| `0x20` | texture declaration | name plus 10 bytes including what appear to be dimensions |
| `0x21` | **texture data** | name followed by a **JPEG** stream (`FFD8FF` … `FFD9`) |
| `0x36` | shader | references a material by name |
| `0x45` | model-a | per model; purpose UNKNOWN |
| `0x47` | model-b | per model; purpose UNKNOWN |
| `0x49` | **mesh** | the bulk of the file; **not yet decoded** |
| `0x50` | unknown | appears only in the track world |
| `0x70` | line node | e.g. `hpLine01` |
| `0x71` | light | e.g. `Default MAX Light` |
| `0x72` | **scene node** | name, parent, transform |
| `0x74` | camera | e.g. `defaultview` |

Counts track each other: `0x45`, `0x47` and `0x72` appear once per model in every world
(20 / 9 / 20 / 760), which is why they are read as per-model records.

---

## Strings — VERIFIED

`uint16` length prefix followed by that many bytes, no terminator, no alignment.

---

## Scene node (`0x72`) — VERIFIED

```
name      pstr
parent    pstr          "World" for every node observed so far
unknown   uint16        observed 0
matrix    float32[16]   row-major 4x4; translation in elements 12..14
resource  pstr
model     pstr
nShaders  uint32
shaders   pstr[nShaders]
```

The matrix offset was found by locating the identity diagonal (`1.0f` at 20-byte spacing) rather
than assumed, which is how the two unknown bytes before it were discovered. The trailing layout
varies by node kind and is **not** fully decoded; `tools/w3d/ifx.py` stops gracefully rather than
guessing.

---

## Texture data (`0x21`) — VERIFIED

```
name   pstr
data   bytes   JPEG in most blocks
```

**Textures are JPEG even when the name says `.png` or `.bmp`** — the name is the authoring-time
source filename, not the stored format. 50 images were extracted across the four worlds and
confirmed as JPEG by `file(1)`, with sizes from 16×16 to 256×256.

Some `0x21` blocks contain no JPEG signature; they repeat a name already seen and begin with a
small integer header. They are **UNKNOWN** — possibly mipmaps or alpha channels — and the reader
returns them raw rather than guessing.

---

## Model descriptor (`0x45`) — PARTIALLY DECODED

```
name       pstr
unknown    uint32    always 4
nSubmesh   uint32    1 for simple models; 9 for mach5_body, 8 for jacks and saw
vertices   uint32
faces      uint32
unknown    uint32
unknown    uint32    often faces/2, but not always
...                  then: "default", shader name, model name, material name, floats
```

Vertex and face counts are confirmed against the simplest cases: `car_shadow` is 4 vertices and
2 faces — a quad — and `scope_door` is 12 and 4. The collider is 104 vertices and 204 faces, whose
Euler characteristic `V − E + F = 104 − 306 + 204 = 2` is exactly that of a closed surface. The
same check fails on most other models, which is expected: game meshes are usually open.

## Mesh payload (`0x49`) — NOT DECODED, and now bounded

Every payload begins with the same shape: `04`, one byte in `0x00`–`0x07`, two bytes, then `00 00`.
After that, three measurements rule out the easy interpretations:

| Test | Result |
|---|---|
| Fixed bytes per vertex? | **No.** The ratio ranges from 2.57 to 396 across 24 meshes in one world |
| Positions stored as `float32`? | **No.** A scan of all 132 payload bytes of `car_shadow` — a 4-vertex quad — found **zero** plausible float triples |
| Entropy-coded? | **Probably not — but the earlier argument was overstated.** Zero-order byte entropy (6.5–7.5 vs ~7.95 for random) does *not* by itself rule out range coding. A conditional-entropy test was tried and **discarded**: random data scored the same as the mesh data, so it does not discriminate at these sample sizes. The measurement that *does* discriminate is **bit-level** entropy: `car_shadow` 0.721 and `collider` 0.979 against **1.0000** for both random and zlib data. A range coder's output is bit-uniform, so a measurable bit bias argues against one |
| One payload per model? | **No.** `mach5_body` declares 50 vertices and 64 faces yet has **four** `0x49` blocks totalling 45,829 bytes |

### Mesh blocks are organised into groups — VERIFIED

The 4-byte `0x01` blocks are **group separators**. Grouping the mesh blocks by them is decisive:

| World | Group 2 | Later groups |
|---|---|---|
| Mach 5 (`7589`) | **20 meshes — one per model** | 2, then 1, then 1: only `mach5_body` and `ROBOT` |
| Enemy cars (`7591`) | **9 meshes — one per model** | 2, then 2: only `car_body` and `car_bodyDuggery` |
| Track (`7587`) | **760 meshes — one per model** | 28, then 5, then 3: only complex models |

Group 2 is uniform: **every block starts with byte `04` and has `hdr[2] = hdr[4] = 0`**. Later
groups have varied first bytes and non-zero `hdr[2]`/`hdr[4]`.

**This narrows the decoding target sharply.** Group 2 alone contains one mesh for every model in
every world. Whatever the later groups are — refinement levels, morph targets, animation — they are
not needed for static geometry. Decoding the single `04` encoding would yield all 789 meshes across
the three worlds.

Taken together: the payload is a **variable-length bitstream of quantised values**. The extra blocks
for complex models are consistent with progressive refinement, but that reading is **INFERRED** and
not required for the static-geometry goal.

**The descriptor counts do not describe final geometry for complex models.** `mach5_body` declares
50 vertices and 64 faces while its four mesh blocks carry header values 255, 255, 511 and 92 — so
the descriptor is either per-submesh (it declares 9) or describes a base mesh. For simple models the
counts are trustworthy: `car_shadow` 4/2 is a quad, `scope_door` 12/4.

### Group-2 header — VERIFIED

Every group-2 payload opens with the same ten bytes:

```
04            format tag, identical in all 789 group-2 meshes
XX            small value 0x00-0x07
YY YY         uint16, varies per instance even between identical shapes
00 00         always zero
ZZ ZZ ZZ ZZ   uint32
```

Bytes 1 and 6-9 are **shared by geometrically paired models**: `mach5_wheel_FR` and `_RR` both
carry `07` and `4a 2a 01 00`; `_RL` and `_FL` both carry `00` and `12 fd 06 00`; the grip pairs
match likewise. Bytes 2-3 differ even between those pairs. So bytes 1 and 6-9 depend on the shape
and bytes 2-3 on the instance.

### Encodings tested and ruled out

A focused decoding attempt was made against `car_shadow` — the simplest possible case, a
four-vertex, two-face quad whose descriptor counts are trustworthy. It **failed**. What it did
establish is a list of what the payload is *not*, so this ground need not be covered twice:

| Hypothesis | Test | Result |
|---|---|---|
| Raw `float32` positions | scan all 132 payload bytes for plausible coordinate triples | **ruled out** — zero candidates |
| Fixed stride per vertex | bytes/vertex across 24 meshes | **ruled out** — ranges 2.57 to 396 |
| Deflate / zlib / gzip at any offset | decompress from offsets 0–40, three window modes | **ruled out** — no hit |
| Bit-packed quantised coordinates | every bit width 6–24, every bit offset 0–400, MSB and LSB first | **ruled out** — zero candidates |
| LEB128 varint stream | decode, compare value count against `3V + 3F` | **ruled out** — ratios scatter 0.04 to 6.06 with no relationship to counts |
| Clean range/arithmetic coding | bit entropy of whole, tail-half, tail-quarter | **not clean** — tail reaches 0.998 but byte `0` occurs **14× more often than uniform**, so structure survives |

**Where that leaves it.** The payload is structured but does not match any standard shape, and there
is no ground truth to check a guess against beyond vertex and face counts.

**This is the documented stopping point.** A go/no-go criterion was set *before* the attempt —
recover `car_shadow`'s four vertices with matching counts and topology. It was not met, so geometry
decoding is **suspended by design rather than abandoned mid-stream**. The fallback is to rebuild the
models that are needed, using the node names, hierarchy, transforms and textures already recovered.

**What is not blocked by it.** Node names, hierarchy, transforms, materials, shaders, lights,
cameras and all 50 textures are already recovered.

---

## What this gives us today

| Capability | Status |
|---|---|
| Walk the container, enumerate blocks | **Working** |
| Read the scene graph: names, parents, transforms | **Working** |
| Extract textures as JPEG | **Working** — 50 images |
| Read materials, shaders, lights, cameras | **Partial** — located, not decoded |
| Extract geometry | **Not yet** — `0x49` undecoded |

### The Mach 5 scene graph, recovered

`SR_level_1_7589.w3d` contains 20 nodes whose names match the Lingo properties in `doMach5`
one for one: `collider`, `mach5_body`, `windshield`, `windshield_top`, `car_shadow`,
`mach5_wheel_FR/RR/RL/FL`, `mach5_grip_FL/FR/RR/RL`, `jacks`, `saw`, `lights`,
`scope_bar`, `scope_top`, `scope_door`, `ROBOT`.

Each gadget is a separate model, which is how the behaviour shows and hides them individually.

### Surface textures, and what they suggest

The track world carries `ROAD_Brown`, `ROAD_Blue`, `ROAD_Dirt`, `ROAD_DirtBlue`, `ROAD_BlueIce`,
`ROAD_BlueIceTRANS`, `ROAD_BLUESNOW`, `ROAD_BLUESNOW_TRANS`, `ROAD_BLUEpBLUEd`, `ROAD_Finish`,
`GRASS`, `SAND_UNDERWATER`, `water_3.bmp`, `ROCK_Brown`, `ROCK_Blue`, `TREE`, `WOODPLANK`,
`GUARDRAIL_TOP`, `STANDS_Wall`, `stands`, `BACKGROUND_Mountains`, `GIANTTIRE_Tred`,
`GIANTTIRE_Side`, plus the pickup icons.

This is **suggestive** for the surface `effectID` mapping in `handling-contract.md` §6 — road,
dirt, ice, snow, grass, underwater sand and water all exist as distinct materials. It does **not**
settle the mapping: the numeric IDs are mesh face indices, and nothing recovered so far links an
index to a material name. That link, if it exists, is likely inside the undecoded `0x49` blocks.
