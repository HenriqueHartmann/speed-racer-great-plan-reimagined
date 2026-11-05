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

## Mesh (`0x49`) — NOT DECODED

The largest block type and the remaining obstacle. After the name there is a header beginning with
a uint32 that correlates with mesh complexity (`0x68` for the collider, `0xff` for the car body),
then what look like counts and offsets. Decoding this is the next step.

Until it is decoded, geometry cannot be converted to glTF.

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
