"""Reader for the Shockwave 3D (``IFX``) container used by Director MX 2004.

The format was reverse-engineered for this project from the four worlds shipped
in *Speed Racer: The Great Plan*. It is **not** U3D/ECMA-363: that standard
descends from the same Intel IFX lineage but does not describe this layout, and
a U3D parser cannot read these files.

Layout, confirmed byte-exact against all four worlds::

    magic   "IFX\\0"       4 bytes
    version uint32         observed value 8
    field3  uint32         observed value 17, meaning unknown
    size    uint32         total file length, matches exactly
    blocks  until EOF      [type uint32][size uint32][data size bytes]
                           the next block starts 4-byte aligned

Block types are always ``0xffffffXX``; this module refers to them by the low
byte. Only the types needed so far are decoded; the rest are returned raw
rather than guessed at.

Everything here is our own code. Nothing is executed from the original game.
"""

from __future__ import annotations

import struct
from dataclasses import dataclass, field
from pathlib import Path

MAGIC = b"IFX\0"
HEADER_SIZE = 16

# Block types, named from the content observed in them.
T_UNKNOWN_01 = 0x01
T_UNKNOWN_02 = 0x02
T_MATERIAL = 0x10
T_TEXTURE_DECL = 0x20
T_TEXTURE_DATA = 0x21
T_SHADER = 0x36
T_MODEL_A = 0x45
T_MODEL_B = 0x47
T_MESH = 0x49
T_UNKNOWN_50 = 0x50
T_LINE_NODE = 0x70
T_LIGHT = 0x71
T_NODE = 0x72
T_CAMERA = 0x74

TYPE_NAMES = {
    T_MATERIAL: "material",
    T_TEXTURE_DECL: "texture-decl",
    T_TEXTURE_DATA: "texture-data",
    T_SHADER: "shader",
    T_MODEL_A: "model-a",
    T_MODEL_B: "model-b",
    T_MESH: "mesh",
    T_LINE_NODE: "line-node",
    T_LIGHT: "light",
    T_NODE: "node",
    T_CAMERA: "camera",
}

JPEG_SOI = b"\xff\xd8\xff"
JPEG_EOI = b"\xff\xd9"


class IFXError(Exception):
    pass


@dataclass
class Block:
    type: int
    offset: int  # offset of the block's data within the file
    size: int
    data: bytes

    @property
    def type_name(self) -> str:
        return TYPE_NAMES.get(self.type, f"0x{self.type:02x}")


@dataclass
class Node:
    """A ``0x72`` scene node: a named transform with a parent."""

    name: str
    parent: str
    matrix: tuple[float, ...]  # 16 floats, row-major
    resource: str = ""
    model: str = ""
    shaders: list[str] = field(default_factory=list)

    @property
    def position(self) -> tuple[float, float, float]:
        return self.matrix[12], self.matrix[13], self.matrix[14]


@dataclass
class Texture:
    name: str
    data: bytes
    kind: str  # "jpeg" or "raw"


def read_pstr(buf: bytes, pos: int) -> tuple[str, int]:
    """Read a uint16 length-prefixed string. Returns the value and new position."""
    (n,) = struct.unpack_from("<H", buf, pos)
    pos += 2
    return buf[pos : pos + n].decode("latin1"), pos + n


class World:
    """A parsed ``IFX`` world."""

    def __init__(self, raw: bytes, source: str = "<memory>") -> None:
        if raw[:4] != MAGIC:
            raise IFXError(f"{source}: not an IFX container (magic {raw[:4]!r})")
        self.source = source
        self.raw = raw
        self.version, self.field3, declared = struct.unpack_from("<III", raw, 4)
        if declared != len(raw):
            raise IFXError(
                f"{source}: header declares {declared} bytes, file has {len(raw)}"
            )
        self.blocks: list[Block] = []
        self._walk()

    @classmethod
    def from_file(cls, path: str | Path) -> "World":
        p = Path(path)
        return cls(p.read_bytes(), source=p.name)

    def _walk(self) -> None:
        raw = self.raw
        pos = HEADER_SIZE
        while pos + 8 <= len(raw):
            btype, size = struct.unpack_from("<II", raw, pos)
            if (btype >> 24) != 0xFF:
                raise IFXError(
                    f"{self.source}: block at {pos} has type 0x{btype:08x}, "
                    "expected 0xffffffXX"
                )
            start = pos + 8
            end = start + size
            if end > len(raw):
                raise IFXError(
                    f"{self.source}: block at {pos} declares {size} bytes, overruns file"
                )
            self.blocks.append(Block(btype & 0xFF, start, size, raw[start:end]))
            pos = (end + 3) & ~3
        if pos < len(raw):
            raise IFXError(f"{self.source}: {len(raw) - pos} trailing bytes")

    def of_type(self, btype: int) -> list[Block]:
        return [b for b in self.blocks if b.type == btype]

    # -- decoded views ----------------------------------------------------

    def nodes(self) -> list[Node]:
        """Scene nodes. The transform offset was located by finding the
        identity matrix diagonal; two bytes of unknown purpose sit between the
        parent name and the matrix."""
        out: list[Node] = []
        for blk in self.of_type(T_NODE):
            d = blk.data
            name, p = read_pstr(d, 0)
            parent, p = read_pstr(d, p)
            p += 2  # unknown uint16, observed as 0
            matrix = struct.unpack_from("<16f", d, p)
            p += 64
            node = Node(name=name, parent=parent, matrix=matrix)
            try:
                node.resource, p = read_pstr(d, p)
                node.model, p = read_pstr(d, p)
                (count,) = struct.unpack_from("<I", d, p)
                p += 4
                for _ in range(count):
                    shader, p = read_pstr(d, p)
                    node.shaders.append(shader)
            except (struct.error, UnicodeDecodeError, IndexError):
                # Trailing layout varies by node kind and is not fully decoded.
                pass
            out.append(node)
        return out

    def textures(self) -> list[Texture]:
        """Texture payloads. Those carrying a JPEG are returned as ``jpeg``;
        the rest are returned raw and are **not** decoded by this module."""
        out: list[Texture] = []
        for blk in self.of_type(T_TEXTURE_DATA):
            name, p = read_pstr(blk.data, 0)
            payload = blk.data[p:]
            start = payload.find(JPEG_SOI)
            if start < 0:
                out.append(Texture(name, payload, "raw"))
                continue
            end = payload.rfind(JPEG_EOI)
            img = payload[start : end + 2] if end > start else payload[start:]
            out.append(Texture(name, img, "jpeg"))
        return out

    def summary(self) -> str:
        counts: dict[int, list[int]] = {}
        for b in self.blocks:
            c = counts.setdefault(b.type, [0, 0])
            c[0] += 1
            c[1] += b.size
        lines = [
            f"{self.source}: version={self.version} field3={self.field3} "
            f"bytes={len(self.raw)} blocks={len(self.blocks)}"
        ]
        for t in sorted(counts):
            n, total = counts[t]
            label = TYPE_NAMES.get(t, "?")
            lines.append(f"  0x{t:02x} {label:<14} count={n:<5} bytes={total}")
        return "\n".join(lines)


__all__ = ["World", "Node", "Block", "Texture", "IFXError", "read_pstr", "TYPE_NAMES"]
