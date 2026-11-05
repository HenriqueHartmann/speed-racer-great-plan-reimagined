#!/usr/bin/env python3
"""Extract the Xtra-media payloads from an Afterburner-compressed Director movie.

Reads ``.dcr`` files, decompresses the Afterburner resource map in memory, and
writes out the ``XMED`` payloads it finds:

* ``3DEM`` streams, saved as ``.w3d`` (Shockwave 3D worlds)
* ``FWS``  streams, saved as ``.swf`` (uncompressed Flash members)

Standard library only. Nothing from the original game is executed, and the
input file is opened read-only and never modified.

Usage::

    python3 tools/extract_dcr.py <movie.dcr> [more.dcr ...] --out <directory>
"""

from __future__ import annotations

import argparse
import struct
import sys
import zlib
from pathlib import Path


def read_varint(buf: bytes, pos: int) -> tuple[int, int]:
    """Director's big-endian 7-bit continuation varint."""
    value = 0
    while True:
        byte = buf[pos]
        pos += 1
        value = (value << 7) | (byte & 0x7F)
        if not byte & 0x80:
            return value, pos


class AfterburnerMovie:
    """The resource map of an Afterburner-compressed Director movie."""

    def __init__(self, raw: bytes, source: str = "<memory>") -> None:
        if raw[:4] != b"XFIR" or raw[8:12] != b"MDGF":
            raise ValueError(f"{source}: not an Afterburner-compressed .dcr")
        self.source = source
        self.raw = raw
        pos = 12

        pos += 4  # 'revF' — Fver
        length, pos = read_varint(raw, pos)
        self.fver = raw[pos : pos + length]
        pos += length

        pos += 4  # 'rdcF' — Fcdr, the compression table (not needed here)
        length, pos = read_varint(raw, pos)
        pos += length

        pos += 4  # 'PMBA' — ABMP, the resource map
        length, pos = read_varint(raw, pos)
        end = pos + length
        _compression, pos = read_varint(raw, pos)
        _uncompressed, pos = read_varint(raw, pos)
        amap = zlib.decompress(raw[pos:end])
        pos = end

        pos += 4  # 'IEGF' — FGEI, start of resource data
        length, pos = read_varint(raw, pos)
        self.base = pos

        q = 0
        _, q = read_varint(amap, q)
        _, q = read_varint(amap, q)
        count, q = read_varint(amap, q)
        self.resources: list[dict] = []
        for _ in range(count):
            rid, q = read_varint(amap, q)
            offset, q = read_varint(amap, q)
            comp, q = read_varint(amap, q)
            uncomp, q = read_varint(amap, q)
            ctype, q = read_varint(amap, q)
            tag = amap[q : q + 4][::-1].decode("latin1")
            q += 4
            self.resources.append(
                {"id": rid, "offset": offset, "comp": comp,
                 "uncomp": uncomp, "ctype": ctype, "tag": tag}
            )

    def payload(self, res: dict) -> bytes:
        start = self.base + res["offset"]
        chunk = self.raw[start : start + res["comp"]]
        if res["comp"] == res["uncomp"]:
            return chunk
        try:
            return zlib.decompress(chunk)
        except zlib.error:
            return chunk


def extract(path: Path, out_dir: Path) -> list[tuple[str, int]]:
    movie = AfterburnerMovie(path.read_bytes(), source=path.name)
    stem = path.stem
    written: list[tuple[str, int]] = []
    out_dir.mkdir(parents=True, exist_ok=True)

    for res in movie.resources:
        if res["tag"] != "XMED":
            continue
        data = movie.payload(res)

        if data[:4] == b"3DEM":
            _total, _version, _inner = struct.unpack_from(">III", data, 4)
            name = f"{stem}_{res['id']}.w3d"
            (out_dir / name).write_bytes(data[16:])
            written.append((name, len(data) - 16))
            continue

        swf = data.find(b"FWS")
        if 0 <= swf <= 16:
            name = f"{stem}_{res['id']}.swf"
            (out_dir / name).write_bytes(data[swf:])
            written.append((name, len(data) - swf))
            continue

        print(f"  {stem} resource {res['id']}: unrecognised XMED payload "
              f"({len(data)} bytes, head {data[:8].hex(' ')})", file=sys.stderr)

    return written


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("movies", nargs="+", type=Path, help="input .dcr files")
    ap.add_argument("--out", type=Path, required=True, help="output directory")
    args = ap.parse_args()

    total = 0
    for movie in args.movies:
        if not movie.is_file():
            print(f"missing: {movie}", file=sys.stderr)
            return 1
        print(f"{movie.name}")
        for name, size in extract(movie, args.out):
            print(f"  -> {name}  ({size} bytes)")
            total += 1
    print(f"\n{total} payloads written to {args.out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
