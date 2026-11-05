# Asset Catalog

Status tags follow `docs/research/project-brief.md`.

> **No binary asset has been extracted yet.** This catalogue records what was *located* inside the
> artifact files by a custom read-only inspection script (Python standard library, in memory). No
> bitmap, sound, mesh or video has been decoded or written out. The Lingo **source** has been
> recovered and lives in `original_game/decompiled/`; see `docs/implementation-plan.md` §Stage 1.

---

## 1. XMED resources — the complete reconciliation (VERIFIED)

The `XMED` (Xtra media) resources were decompressed **in memory only**, with a custom read-only
Python script using the standard library. Nothing was written to disk. Every XMED payload in the
supplied artifact is enumerated below and classified by its leading signature.

| Movie | Resource ID | Payload bytes | Signature | Class |
|---|---:|---:|---|---|
| `SR_MAIN.dcr` | 5136 | 497 | `FWS` | SWF |
| `SR_MAIN.dcr` | 5143 | 200236 | `3DEM` + `IFX ` | 3D world |
| `SR_MAIN.dcr` | 5196 | 961527 | `FWS` | SWF |
| `SR_MAIN.dcr` | 5198 | 157671 | `FWS` | SWF |
| `SR_MAIN.dcr` | 5200 | 138734 | `FWS` | SWF |
| `SR_MAIN.dcr` | 5202 | 256 | `FWS` | SWF |
| `SR_MAIN.dcr` | 5204 | 154448 | `FWS` | SWF |
| `SR_MAIN.dcr` | 5206 | 2357 | `FWS` | SWF |
| `SR_level_1.dcr` | 7587 | 2552084 | `3DEM` + `IFX ` | 3D world |
| `SR_level_1.dcr` | 7589 | 206268 | `3DEM` + `IFX ` | 3D world |
| `SR_level_1.dcr` | 7591 | 104584 | `3DEM` + `IFX ` | 3D world |
| `SR_level_1.dcr` | 7981 | 3027 | `FWS` | SWF |
| `SR_level_1.dcr` | 8359 | 256 | `FWS` | SWF |
| `SR_level_1.dcr` | 8362 | 29826 | `FWS` | SWF |
| `MEDIA/JIGSAW.dcr` | 71 | 941078 | `FWS` | SWF |
| `MEDIA/SLIDERS.dcr` | 80 | 1047256 | `FWS` | SWF |

### Reconciled totals — VERIFIED

| Movie | XMED | `3DEM` | `FWS` |
|---|---:|---:|---:|
| `SR_MAIN.dcr` | 8 | 1 | 7 |
| `SR_level_1.dcr` | 6 | 3 | 3 |
| `MEDIA/JIGSAW.dcr` | 1 | 0 | 1 |
| `MEDIA/SLIDERS.dcr` | 1 | 0 | 1 |
| **Total** | **16** | **4** | **12** |

Every XMED resource is accounted for; none is unclassified.

---

## 2. 3D worlds — VERIFIED (located; the Mach 5 extracted)

Four payloads begin with the signature `3DEM` followed by `IFX `.

| Movie | Resource ID | Payload bytes | Interpretation |
|---|---:|---:|---|
| `SR_level_1.dcr` | 7587 | 2552084 | **The level** — track geometry and props. 760 meshes; decodes, not yet imported |
| `SR_level_1.dcr` | 7589 | 206268 | **The Mach 5** — VERIFIED, 20 models matching `doMach5`'s properties one for one |
| `SR_level_1.dcr` | 7591 | 104584 | The rival car — 9 models (INFERRED from the node names) |
| `SR_MAIN.dcr` | 5143 | 200236 | Front-end showcase car (INFERRED) |

`3DEM` is the Director Shockwave-3D cast-member stream; `IFX ` is Intel's Interactive-FX container.

**Extracted so far:** resource 7589, the Mach 5, as `public/models/mach5.glb` — 20 meshes, 46
primitives, 4,454 triangles, 5,194 vertices, 10 materials over 6 textures.
`tools/extract_mesh.sh` regenerates it from the original artifact; `docs/research/w3d-format.md`
documents the format and the decoder.

**Still open:** the coordinate convention is recovered in practice (Director is Z-up; the exporter
writes a −90° X rotation on `SceneRoot` to satisfy glTF's Y-up requirement, which the renderer
clears), but animation data has not been looked at, and the face-index to material-name link that
the surface `effectID` table needs has not been read out. See `docs/research/open-questions.md`.

> **Format lineage is not binary compatibility.** Shockwave 3D W3D originated from Intel's IFX
> toolkit lineage, and U3D (ECMA-363) was derived primarily from the related Shockwave 3D format.
> This historical relationship **does not** establish that a U3D reader can parse these resources.

---

## 3. Flash / SWF members — VERIFIED (located, not extracted)

Twelve XMED payloads begin with `FWS` — uncompressed SWF.

| Movie | Count | Payload size range |
|---|---:|---|
| `SR_MAIN.dcr` | 7 | 497 – 961527 bytes |
| `SR_level_1.dcr` | 3 | 256 – 29826 bytes |
| `MEDIA/JIGSAW.dcr` | 1 | 941078 bytes |
| `MEDIA/SLIDERS.dcr` | 1 | 1047256 bytes |

**INFERRED:** those in the two main movies are UI / HUD / menu members, consistent with the
`Flash Asset` Xtra being required and with symbols such as `setFlashProperty`, `getFlashProperty`,
`enableFlashLingo`, `Flash Cursor`, `tflashcursor`.

### The mini-games are predominantly Flash — INFERRED

`JIGSAW.dcr` is 758633 bytes on disk yet contains a **941078-byte SWF**; `SLIDERS.dcr` is 851781
bytes and contains a **1047256-byte SWF** — each single SWF payload is larger than its compressed
host movie. Combined with their census (script-heavy, asset-light: `JIGSAW` has 12 `Lscr` but only
6 `CASt`), this suggests the two mini-games are **Flash content inside a thin Director shell**
rather than Director-native games.

---

## 4. Video — VERIFIED

16 FLV files in `MEDIA/`. All **Sorenson Spark (H.263) video + MP3 mono audio**.

### Control tutorials (7 files, ~180 kbps)

| File | Bytes | Duration |
|---|---:|---|
| `control_a.flv` | 233909 | 8.5 s |
| `control_b.flv` | 156742 | 8.6 s |
| `control_c.flv` | 236710 | 8.7 s |
| `control_d.flv` | 237611 | 9.4 s |
| `control_e.flv` | 242600 | 10.2 s |
| `control_f.flv` | 366456 | 13.7 s |
| `control_g.flv` | 228162 | 10.2 s |

**INFERRED:** seven tutorials for seven gadgets — the count matches the seven HUD gadget slots.

### Cutscenes (9 files, ~350 kbps)

| File | Bytes | Duration |
|---|---:|---|
| `gp1.flv` | 1958713 | 37.0 s |
| `gp1a.flv` | 4397950 | 104.2 s |
| `gp2.flv` | 1030769 | 19.6 s |
| `gp4.flv` | 701769 | 13.3 s |
| `gp7.flv` | 940704 | 18.7 s |
| `gp8.flv` | 783755 | 18.8 s |
| `gp11.flv` | 765661 | 14.7 s |
| `gp13.flv` | 961797 | 19.1 s |
| `gp19.flv` | 737528 | 12.8 s |

Durations read from the `onMetaData` AMF tag.

### Metadata caveat — VERIFIED

The FLV `onMetaData` tags store `width = 0` and `height = 0`, and the `framerate` field holds
implausible values (e.g. 786432.0, 1966080.0). **Pixel dimensions and true frame rate are
UNKNOWN** and cannot be read from metadata; decoding a frame is required.

Embedded `creationdate` strings range from `Fri Feb 4 2005` to `Mon Sep 5 2005`.

---

## 5. Bitmaps — VERIFIED (counted, not extracted)

| Movie | `BITD` (bitmap data) | `ALFA` (alpha channel) |
|---|---:|---:|
| `SR_MAIN.dcr` | 5 | 3 |
| `SR_level_1.dcr` | 39 | 79 |

Cast names carry an encoder suffix revealing the stored format — `kMoaCfFormat_PNG`,
`kMoaCfFormat_JPEG`, `kMoaCfFormat_GIF`.

### Named bitmap groups in `SR_level_1.dcr`

- **Explosion sequence:** `kaboom0001` … `kaboom0050` (PNG)
- **Particles:** `particle_water`, `particle_bubble`, `particle_dirt`, `particle_mud`,
  `water_ripple`, `snow_flake` (PNG)
- **HUD panels:** `Interface_Info`, `Interface_Panel`, `Interface_bracket_L`,
  `Interface_bracket_R`, `Interface_DamageBar`, `Interface_DamageBarEnd`,
  `Interface_OxygenBar`, `Interface_OxygenBarEnd`, `Interface_OxygenPanel` (PNG)
- **Gadget icons:** `Interface_Pic_` and `Interface_Txt_` × {`Blades`, `Deflector`, `Frogger`,
  `Grip`, `Jacks`, `Lights`, `Robot`} (PNG)
- **Pickup icons:** `Interface_Pic_Candy`, `Interface_Pic_Sparky`, `Interface_Pic_O2` (PNG)
- **Digits:** `Digit_0`–`Digit_9`, `BigDigit_0`–`BigDigit_9`, `BigDigit_th` (PNG)
- **Periscope overlays:** `ov_scopecam_frame`, `ov_scopecam_under`, `ov_scopecam_static` (PNG)
- **Utility:** `Black2x2` (PNG)

### Named bitmap groups in `SR_MAIN.dcr`

- **Window chrome:** `button_min_0`, `button_min_1`, `button_close_0`, `button_close_1` (GIF)
- **Splash art:** `speed_blue`, `speed_m5`, `speed_duggery` (JPEG)
- **Utility:** `Black2x2` (PNG)

---

## 6. Audio — VERIFIED (counted and named, not extracted)

| Movie | `snd ` resources | `ediM` (edit media) |
|---|---:|---:|
| `SR_MAIN.dcr` | 3 | 3 |
| `SR_level_1.dcr` | 63 | 63 |

The full cue name list is catalogued in `docs/research/gameplay-spec.md` §11.

**UNKNOWN:** sample rate, bit depth, channel count, and duration of each cue.

---

## 7. Cast member totals — VERIFIED

| Movie | `CASt` resources | `Lscr` (compiled Lingo) |
|---|---:|---:|
| `SR_MAIN.dcr` | 28 | 9 |
| `SR_level_1.dcr` | 193 | 21 |
| `MEDIA/JIGSAW.dcr` | 6 | 12 |
| `MEDIA/SLIDERS.dcr` | 5 | 3 |

**INFERRED:** the mini-games are script-heavy and asset-light, consistent with 2D puzzle games.

---

## 8. What has and has not been extracted

This section was written when the answer was "nothing". It no longer is. Extraction proceeded
stage by stage with approval, and the repository tracks the results by the owner's explicit
decision — see `docs/research/project-brief.md` for the asset policy.

**Extracted:**

- **Lingo scripts** — 36 recovered, in `original_game/decompiled/`. They are the source of every
  constant tagged `RECOVERED` in `src/sim/constants.ts`.
- **One `3DEM` world** — resource 7589, the Mach 5, converted to glTF at `public/models/mach5.glb`
  (§2). Its 50 sibling textures were extracted as JPEG during format research.

**Not extracted:**

- No `FWS` / SWF payload dumped.
- No bitmap decoded beyond the 3D world textures.
- No sound decoded.
- No FLV frame decoded.
- The track world (7587), the rival car (7591) and the showcase car (5143) decode but have not
  been imported.

**Next step:** the track mesh. It is the same chain as the Mach 5 and needs no new tooling.
