#!/usr/bin/env python3
"""Inspect a Shockwave 3D (``IFX``) world and optionally extract its textures.

Usage::

    python3 tools/w3d_dump.py <world.w3d> [more.w3d ...]
    python3 tools/w3d_dump.py <world.w3d> --nodes
    python3 tools/w3d_dump.py <world.w3d> --textures <directory>

Standard library only. Read-only: the input is never modified.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from w3d.ifx import IFXError, World  # noqa: E402


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("worlds", nargs="+", type=Path, help="input .w3d files")
    ap.add_argument("--nodes", action="store_true", help="list scene nodes")
    ap.add_argument("--textures", type=Path, metavar="DIR",
                    help="write texture payloads into DIR")
    args = ap.parse_args()

    failures = 0
    for path in args.worlds:
        try:
            world = World.from_file(path)
        except (IFXError, OSError) as exc:
            print(f"{path}: {exc}", file=sys.stderr)
            failures += 1
            continue

        print(world.summary())

        if args.nodes:
            print("  nodes:")
            for node in world.nodes():
                x, y, z = node.position
                shaders = ", ".join(node.shaders) if node.shaders else "-"
                print(f"    {node.name:24s} parent={node.parent:10s} "
                      f"pos=({x:10.3f},{y:10.3f},{z:10.3f})  shaders={shaders}")

        if args.textures:
            args.textures.mkdir(parents=True, exist_ok=True)
            jpeg = raw = 0
            for tex in world.textures():
                safe = "".join(c if c.isalnum() or c in "._-" else "_"
                               for c in tex.name)
                if tex.kind == "jpeg":
                    if not safe.lower().endswith(".jpg"):
                        safe += ".jpg"
                    jpeg += 1
                else:
                    safe += ".raw"
                    raw += 1
                (args.textures / f"{path.stem}__{safe}").write_bytes(tex.data)
            print(f"  textures written: {jpeg} jpeg, {raw} raw (undecoded)")

        print()

    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
