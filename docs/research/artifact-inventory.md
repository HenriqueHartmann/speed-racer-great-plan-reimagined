# Artifact Inventory

Status tags follow `docs/research/project-brief.md`.

> **These files are tracked in this repository**, by the owner's decision, so the project can be
> cloned and run across their own machines. They are never moved, renamed or modified in place, and
> the SHA-256 baseline below is re-verified before every commit so that any drift would be visible.

---

## Provenance — UNVERIFIED

The artifacts were supplied by the project owner, extracted from a ZIP archive.

The upstream origin is **believed** to be the Internet Archive item
[`SpeedRacerDemonOnWheels`](https://archive.org/details/SpeedRacerDemonOnWheels), but:

- the ZIP's own hash was never provided;
- no chain of custody was established;
- the supplied files have not been compared against that item.

**Provenance is therefore UNVERIFIED and must not be stated as fact.**

Next safe step: obtain the Internet Archive ZIP independently and compare SHA-256 values against
the baseline below.

---

## Directory

```
Speed Racer Demon on Wheels The Great Plan Full/   (dir mtime 2018-12-13)
├── SR_GAME.exe
├── SR_MAIN.dcr
├── SR_level_1.dcr
└── MEDIA/                                          (dir mtime 2008-06-01)
    ├── JIGSAW.dcr
    ├── SLIDERS.dcr
    ├── control_a.flv .. control_g.flv              (7 files)
    └── gp1, gp1a, gp2, gp4, gp7, gp8, gp11, gp13, gp19 .flv   (9 files)
```

**21 files, 26 MB total.**

---

## SHA-256 baseline — VERIFIED

Computed with `sha256sum` on the supplied files. **This baseline is never replaced automatically.**
Any future mismatch is a discrepancy to report, not to overwrite.

| File | Bytes | mtime | SHA-256 |
|---|---:|---|---|
| `SR_GAME.exe` | 4535137 | 2008-02-19 | `92189a2537c9837ea58bcdd60f7f8b53752b0e1218033e76741acf6681511472` |
| `SR_MAIN.dcr` | 3339914 | 2007-10-25 | `972a41c1a6abc6318bc220afb3924a8fe27aa0cba907bd0b8ae0e5a1b99574ef` |
| `SR_level_1.dcr` | 2912860 | 2007-10-25 | `f24015c4866fa4b725353e9330f034fad7437c564af69c0ffbbb6523c1adb4cb` |
| `MEDIA/JIGSAW.dcr` | 758633 | 2007-10-25 | `f853e4577d117627ec81c2e7deeec01dd0afdbb8ac98bcbe6a4df3c8082ddb4f` |
| `MEDIA/SLIDERS.dcr` | 851781 | 2007-10-25 | `c66cba38578cdfbc6d2f915a90ae127870dedd7371fe2488fbfe4f22cf2c9077` |
| `MEDIA/control_a.flv` | 233909 | 2007-10-25 | `fd16746bc792b74c84aa458692d06fd45b28f2190c6fde8d212ef1402a77258b` |
| `MEDIA/control_b.flv` | 156742 | 2007-10-25 | `667635ff97408a078d7f9a945410caf9fecce41971003f7c32b30b15c77be337` |
| `MEDIA/control_c.flv` | 236710 | 2007-10-25 | `0f48b20abc1a01611b529100927efd9c8c57d016f568ec736518185a42049f66` |
| `MEDIA/control_d.flv` | 237611 | 2007-10-25 | `e46aa3fa465dfe0bddaca227251409c214734db8209892ea4ff8e7d1d99dfd56` |
| `MEDIA/control_e.flv` | 242600 | 2007-10-25 | `419ce2b3621ae6a855a76098914cb02733110e4b25c326087361008ce6edacc0` |
| `MEDIA/control_f.flv` | 366456 | 2007-10-25 | `f15fbea89a8eb079c27d83ae2884645c670ceca456967fe26874a9a627f758cd` |
| `MEDIA/control_g.flv` | 228162 | 2007-10-25 | `989bf37b41d5607bdc08bd935525f47c5165385da77f0d3587afcf120a725615` |
| `MEDIA/gp1.flv` | 1958713 | 2007-10-25 | `fdd2a1f5a80b3f4e5d7ef01510efdf778a75ea61878eebafa5a9b00606c5387a` |
| `MEDIA/gp1a.flv` | 4397950 | 2007-10-25 | `f2d63d5757b34b1c57955bab7493fabe372b8d12bfba5299701010c9dcc68243` |
| `MEDIA/gp2.flv` | 1030769 | 2007-10-25 | `057c505b414ca22d0d310be4d02669d511230274592dcbb6ed329e55b3fb3e88` |
| `MEDIA/gp4.flv` | 701769 | 2007-10-25 | `f421c76ae94aed1a39dc28f96da5ad889b8f7719cb5a3ce116d457b642df70b8` |
| `MEDIA/gp7.flv` | 940704 | 2007-10-25 | `c8067f6b44e9abbf00d589a369989787e881cce8bd36e02a3af2798869ff82db` |
| `MEDIA/gp8.flv` | 783755 | 2007-10-25 | `eb991043937380834c609e1e25a8934c68c59a01dde1d25205dbb226a3e7d1d6` |
| `MEDIA/gp11.flv` | 765661 | 2007-10-25 | `e800c127ad5eb7ff5eacac761b4e0f0d14e028ac0599b31f536ac335ddc78f9d` |
| `MEDIA/gp13.flv` | 961797 | 2007-10-25 | `ac270177b6a09a336af6f73dc43c50e3060ebbf389aaa4eadcc74382bcfe0607` |
| `MEDIA/gp19.flv` | 737528 | 2007-10-25 | `da1be0a6e535147aecbcc2e3772acf4c89e87bda4fd1aee5d1e43882fa5052a6` |

Re-verify with:

```bash
find "Speed Racer Demon on Wheels The Great Plan Full" -type f -exec sha256sum {} + | sort -k2
```

---

## Format identification — VERIFIED

### `.dcr` movies — Shockwave Director, Afterburner-compressed

All four `.dcr` files begin with the same structure. Quoted bytes from `SR_MAIN.dcr`:

```
0000000  58 46 49 52  82 f6 32 00  4d 44 47 46  72 65 76 46   XFIR..2.MDGFrevF
0000016  0d 8a 01 01  8e 44 07 31  30 2e 31 23  31 31 72 64   .....D.10.1#11rd
```

- `58 46 49 52` = `XFIR` — little-endian form of `RIFX`, the Director container.
- `4d 44 47 46` = `MDGF` — reversed `FGDM`, the Afterburner compression marker.
- `72 65 76 46` = `revF` — reversed `Fver`, the version chunk.
- Literal string `10.1#11`, value `0x501` → **Director MX 2004 / Shockwave Player 10.1**.

### `SR_GAME.exe` — Director projector, NEVER EXECUTED

`file(1)` reports: `PE32 executable for MS Windows 4.00 (GUI), Intel i386, 4 sections`.

A read-only `strings` scan found `Director MX 2004`, `Director Player build Info`, and hardcoded
Xtra paths of the form
`C:\Program Files\Macromedia\Director MX 2004\Configuration\xtras\...`.

It also leaks the original authoring path **`C:\PROJECTS\SPEED\SR_LOADER_2.dir`** and a reference
to `shared.cst`.

**INFERRED:** the standalone Windows build is a loader shell built from `SR_LOADER_2.dir`; the
`.dcr` files beside it are the actual content, shared with the web build.

### `.flv` media — VERIFIED

16 files, all `Macromedia Flash Video`: **Sorenson Spark (H.263) video + MP3 mono audio**.

---

## Resource census — VERIFIED

Produced by a **custom read-only inspection script** written for this project, using only the
Python standard library (`zlib`), decompressing the Afterburner resource map **in memory**. No
third-party tool was installed or run. No file was written. No original byte was changed.

| Movie | Resources | ≈ uncompressed | `CASt` | `Lscr` | `BITD` | `snd ` | `ALFA` | `XMED` |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| `SR_MAIN.dcr` | 86 | 4.4 MB | 28 | 9 | 5 | 3 | 3 | 8 |
| `SR_level_1.dcr` | 491 | 11.9 MB | 193 | 21 | 39 | 63 | 79 | 6 |
| `MEDIA/JIGSAW.dcr` | 37 | 0.9 MB | 6 | 12 | 0 | 0 | 0 | 1 |
| `MEDIA/SLIDERS.dcr` | 26 | 1.0 MB | 5 | 3 | 0 | 0 | 0 | 1 |

Chunk tags are stored byte-reversed in these little-endian files; the table shows them normalised.
`Lscr` = compiled Lingo script, `CASt` = cast member, `BITD` = bitmap data, `ALFA` = alpha channel,
`XMED` = Xtra media.

### XMED breakdown — VERIFIED

The `XMED` column above counts resources, not kinds. Classified by leading signature:

| Movie | XMED | `3DEM` (3D world) | `FWS` (SWF) |
|---|---:|---:|---:|
| `SR_MAIN.dcr` | 8 | 1 | 7 |
| `SR_level_1.dcr` | 6 | 3 | 3 |
| `MEDIA/JIGSAW.dcr` | 1 | 0 | 1 |
| `MEDIA/SLIDERS.dcr` | 1 | 0 | 1 |
| **Total** | **16** | **4** | **12** |

Every XMED resource is accounted for; none is unclassified. The full per-resource enumeration with
IDs and payload sizes is in `docs/research/asset-catalog.md` §1.

---

## Release date — UNRESOLVED CONFLICT

| Claim | Source |
|---|---|
| Released **2005-10-25** | [Internet Archive item](https://archive.org/details/SpeedRacerDemonOnWheels) |
| Released **2006** | secondary search summaries of the studio listings |
| `.dcr` files stamped **2007-10-25** | filesystem mtime of the supplied artifact |
| `SR_GAME.exe` stamped **2008-02-19** | filesystem mtime |
| `MEDIA/` directory stamped **2008-06-01** | filesystem mtime |
| FLV `creationdate` strings **2005-02-04** … **2005-09-05** | embedded in the FLV metadata tags |

**INFERRED, not fact:** this copy may be a later re-release build from the 2008 film window rather
than the original 2005/2006 web release.

**This conflict is retained unresolved.** Do not pick one date and present it as established.

Next safe step: compare the baseline hashes against the Internet Archive ZIP.

---

## What has and has not been done

**Has been done — a custom read-only inspection script**, Python standard library only, operating
in memory. It produced the format identification, the resource census, the XMED classification, and
the symbol and cast-name tables used throughout this research. It wrote nothing and modified
nothing.

**Has not been done:**

- No third-party decompiler run — ProjectorRays and LibreShockwave remain untested against these
  files.
- No `Lscr` bytecode decompiled.
- No bitmap, sound, mesh, texture or video extracted.
- No `3DEM` or `FWS` payload written to disk.
- No projector, installer, plugin or converter **executed**. `SR_GAME.exe` was only string-scanned
  with `strings(1)`, never run.
- No gameplay observed.
