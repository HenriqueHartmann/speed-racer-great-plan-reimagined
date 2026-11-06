/**
 * The generated ground file, and the parser's refusal to trust a bad one.
 *
 * `track-ground.bin` is what the simulation drives on, so a file that is wrong
 * in the middle surfaces as a car falling through the world a minute into a
 * run. Every malformed shape below is rejected at the door instead.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { parseGroundMesh, castDownMesh } from '../src/sim/ground-mesh.js';
import { vec3 } from '../src/sim/vehicle.js';
import { Glb } from './glb.js';

const FILE = 'public/models/track-ground.bin';

/** A minimal well-formed file: one segment, one triangle. */
function valid(): Uint8Array {
  const segs = 1;
  const tris = 1;
  const verts = 3;
  const idsPadded = Math.ceil(tris / 4) * 4;
  const bytes = new Uint8Array(32 + verts * 12 + tris * 12 + idsPadded + segs * 8);
  const view = new DataView(bytes.buffer);

  bytes.set([0x53, 0x52, 0x54, 0x47], 0); // "SRTG"
  view.setUint32(4, 1, true);
  view.setUint32(8, segs, true);
  view.setUint32(12, tris, true);
  view.setUint32(16, verts, true);
  view.setFloat32(20, 1, true);
  view.setFloat32(24, 2, true);
  view.setFloat32(28, 3, true);

  const positions = [-1, 0, 0, 1, 0, 0, 0, 1, 0];
  positions.forEach((v, i) => view.setFloat32(32 + i * 4, v, true));
  const io = 32 + verts * 12;
  [0, 1, 2].forEach((v, i) => view.setUint32(io + i * 4, v, true));
  const so = io + tris * 12;
  bytes[so] = 3;
  const go = so + idsPadded;
  view.setUint32(go, 0, true);
  view.setUint32(go + segs * 4, tris, true);
  return bytes;
}

function corrupt(edit: (b: Uint8Array, v: DataView) => Uint8Array | void): Uint8Array {
  const b = valid();
  return edit(b, new DataView(b.buffer)) ?? b;
}

describe('the decoded track', () => {
  const mesh = parseGroundMesh(readFileSync(FILE));

  it('carries 37 segments and the recovered start line', () => {
    expect(mesh.segmentCount).toBe(37);
    expect(mesh.spawn.x).toBeCloseTo(41.98, 1);
    expect(mesh.spawn.y).toBeCloseTo(38.83, 1);
    expect(mesh.spawn.z).toBeCloseTo(16.56, 1);
  });

  it('files every triangle under exactly one segment', () => {
    expect(mesh.segmentStart[0]).toBe(0);
    expect(mesh.segmentEnd[36]).toBe(mesh.surfaceIds.length);
    for (let s = 0; s < 36; s++) expect(mesh.segmentEnd[s]).toBe(mesh.segmentStart[s + 1]);
  });

  it('uses 1-based sub-mesh indices within 1..16', () => {
    for (const id of mesh.surfaceIds) {
      expect(id).toBeGreaterThanOrEqual(1);
      expect(id).toBeLessThanOrEqual(16);
    }
  });

  it('keeps every ROAD_Finish triangle parked far below the course', () => {
    // Sub-mesh 1 is ROAD_Finish and has no live geometry on this level: all
    // 98 of its triangles are padding at z = -20, there so that all 16
    // sub-mesh indices exist in every segment and the index can serve as an
    // id. The finish itself is FINISH_Y, a coordinate, not a surface.
    let finishTriangles = 0;
    for (let t = 0; t < mesh.surfaceIds.length; t++) {
      if (mesh.surfaceIds[t] !== 1) continue;
      finishTriangles++;
      for (let c = 0; c < 3; c++) {
        const z = mesh.positions[mesh.indices[t * 3 + c]! * 3 + 2]!;
        expect(z).toBeCloseTo(-20, 1);
      }
    }
    expect(finishTriangles).toBe(98);
  });

  it('puts segment N where segmentIndexFor expects it', () => {
    // Nine segments overrun their nominal slice, so this is a containment
    // check with the measured 2.1-unit slack, not an equality.
    for (let s = 0; s < mesh.segmentCount; s++) {
      let lo = Infinity;
      let hi = -Infinity;
      for (let t = mesh.segmentStart[s]!; t < mesh.segmentEnd[s]!; t++) {
        for (let c = 0; c < 3; c++) {
          const y = mesh.positions[mesh.indices[t * 3 + c]! * 3 + 1]!;
          lo = Math.min(lo, y);
          hi = Math.max(hi, y);
        }
      }
      expect(lo).toBeGreaterThanOrEqual(s * 300 - 2.1);
      expect(hi).toBeLessThanOrEqual((s + 1) * 300 + 1.4);
    }
  });
});

describe('the sub-mesh identity the surface table rests on', () => {
  // `surfaceIds` is a primitive's position in its mesh, and the recovered
  // surface table reads that position as a material. That only works because
  // every segment carries the same primitives in the same order - which is
  // measured, not given. `tools/build_track_ground.mjs` refuses to build
  // without it; this says so in the suite as well.
  const glb = new Glb('public/models/track.glb');
  const segments = glb.json.nodes
    .filter((n: { name?: string }) => /^SEG_\d+$/.test(n.name ?? ''))
    .sort((a: { name: string }, b: { name: string }) => Number(a.name.slice(4)) - Number(b.name.slice(4)));

  const materialsOf = (node: { mesh: number }): string[] =>
    glb.json.meshes[node.mesh].primitives.map(
      (p: { material?: number }) => glb.json.materials[p.material!].name as string,
    );

  it('gives every segment the same 16 sub-meshes in the same order', () => {
    const first = materialsOf(segments[0]);
    expect(first).toHaveLength(16);
    for (const seg of segments) expect(materialsOf(seg), seg.name).toEqual(first);
  });

  it('puts the three unhandled ids on the three non-drivable materials', () => {
    // This is the evidence the whole mapping rests on: `doMach5`'s table has
    // no 5, 11 or 16, and those are exactly the rocks and the trees. One
    // chance in 560 if the id were anything but the sub-mesh index.
    const materials = materialsOf(segments[0]);
    const unhandled = [5, 11, 16].map((i) => materials[i - 1]);
    expect(unhandled).toEqual(['ROCK_bROWN', 'ROCK_bLUE', 'TREE']);
    for (const [id, name] of [[3, 'GRASS'], [4, 'ROAD_Dirt'], [12, 'SAND_UNDERWATER'], [14, 'ROAD_BlueIce']] as const) {
      expect(materials[id - 1], `id ${id}`).toBe(name);
    }
  });
});

describe('parseGroundMesh refuses a file it cannot trust', () => {
  it('accepts the well-formed shape the others corrupt', () => {
    expect(parseGroundMesh(valid()).segmentCount).toBe(1);
  });

  it('rejects a bad magic', () => {
    expect(() => parseGroundMesh(corrupt((b) => void b.set([0x58], 0)))).toThrow(/magic/i);
  });

  it('rejects an unsupported version', () => {
    expect(() => parseGroundMesh(corrupt((_, v) => v.setUint32(4, 2, true)))).toThrow(/version/i);
  });

  it('rejects a truncated file', () => {
    expect(() => parseGroundMesh(valid().slice(0, 40))).toThrow(/truncat|short|size/i);
  });

  it('rejects counts that do not match the payload', () => {
    expect(() => parseGroundMesh(corrupt((_, v) => v.setUint32(12, 999, true)))).toThrow();
  });

  it('rejects an index past the vertex count', () => {
    expect(() =>
      parseGroundMesh(corrupt((_, v) => v.setUint32(32 + 36, 99, true))),
    ).toThrow(/index/i);
  });

  it('rejects a non-finite coordinate', () => {
    expect(() => parseGroundMesh(corrupt((_, v) => v.setFloat32(32, NaN, true)))).toThrow(/finite/i);
  });

  it('rejects a surface id of zero', () => {
    // Nothing downstream would notice: `surfaceFor` falls through to the
    // default and the car drives on an invented surface.
    // The synthetic file has three vertices and one triangle, so its single
    // surface id sits at 32 + 36 + 12.
    expect(() => parseGroundMesh(corrupt((b) => void (b[80] = 0)))).toThrow(/surface id/i);
  });

  it('reads a buffer that does not start on a four-byte boundary', () => {
    // The typed arrays are views onto the caller's buffer and a Float32Array
    // cannot start on an odd byte. An unaligned input used to throw a raw
    // RangeError from the constructor rather than this module's own error.
    const file = readFileSync(FILE);
    const padded = new Uint8Array(file.byteLength + 2);
    padded.set(file, 2);
    const unaligned = padded.subarray(2);
    expect(unaligned.byteOffset % 4).not.toBe(0);
    expect(parseGroundMesh(unaligned).segmentCount).toBe(37);
  });

  it('rejects segment ranges that are not contiguous and ascending', () => {
    // segmentEnd[0] set to 0 while triangleCount is 1: the last segment no
    // longer accounts for every triangle.
    expect(() =>
      parseGroundMesh(corrupt((_, v) => v.setUint32(32 + 36 + 12 + 4 + 4, 0, true))),
    ).toThrow(/segment/i);
  });
});

describe('the near-parallel guard, against the real mesh', () => {
  /**
   * One ray per segment, frozen.
   *
   * The guard that rejects a near-parallel triangle sits in the hot loop and
   * is a candidate for algebraic rewriting. This pins every segment's answer -
   * distance to seventeen digits and surface id - so a rewrite is proved
   * equivalent on the shipped geometry, not only on constructed slivers.
   *
   * Captured from the implementation at 2e344eb. A change here is a change to
   * what the car drives on, and must be justified, not re-captured.
   */
  const FROZEN: readonly (readonly [number, number | null, number | null])[] = [
  [1, 0.50000000000000000, 2],
  [2, null, null],
  [3, 7.0260557750441723, 6],
  [4, 21.965680852295016, 6],
  [5, 5.4045300150551201, 6],
  [6, 13.312832469927216, 6],
  [7, null, null],
  [8, null, null],
  [9, 14.178070020287066, 6],
  [10, 14.731844103904550, 6],
  [11, 2.2641178138149742, 6],
  [12, 25.576116539940426, 5],
  [13, 24.848136259535437, 12],
  [14, 1.0309401176159998, 6],
  [15, 21.991922138640309, 12],
  [16, 22.019590743745223, 12],
  [17, null, null],
  [18, 5.2215633392333984, 10],
  [19, 5.2208080291748047, 11],
  [20, null, null],
  [21, 0.50000000000000000, 10],
  [22, 6.1720790863037109, 10],
  [23, null, null],
  [24, null, null],
  [25, 0.50000000000000000, 7],
  [26, 0.50000000000000000, 6],
  [27, 31.387912072732696, 5],
  [28, 26.202048640315624, 12],
  [29, 4.7879087081072980, 6],
  [30, 22.526744067169531, 12],
  [31, 22.530839920043949, 12],
  [32, 18.086314572816466, 6],
  [33, 12.075196721759536, 6],
  [34, 6.4795913696289063, 6],
  [35, 2.0723325114751634, 6],
  [36, 6.5802519514670106, 6],
  [37, 2.2786554430030801, 3],
  ];

  it('answers identically on all 37 segments', () => {
    const g = parseGroundMesh(readFileSync(FILE));
    expect(FROZEN.length).toBe(g.segmentCount);

    for (const [segment, distance, effectId] of FROZEN) {
      const a = g.segmentStart[segment - 1]!;
      const b = g.segmentEnd[segment - 1]!;

      // The probe point is reproducible from the mesh alone: the centroid of
      // the segment's first 400 triangles, half a unit above its highest vertex.
      let sx = 0, sy = 0, maxz = -Infinity, n = 0;
      for (let t = a; t < Math.min(b, a + 400); t++) {
        for (let k = 0; k < 3; k++) {
          const i = g.indices[t * 3 + k]! * 3;
          sx += g.positions[i]!;
          sy += g.positions[i + 1]!;
          maxz = Math.max(maxz, g.positions[i + 2]!);
          n++;
        }
      }

      const hit = castDownMesh(g, vec3(sx / n, sy / n, maxz + 0.5), 60, a, b);
      if (distance === null) {
        expect(hit, `segment ${segment}`).toBeNull();
        continue;
      }
      expect(hit, `segment ${segment}`).not.toBeNull();
      expect(hit!.distance, `segment ${segment} distance`).toBe(distance);
      expect(hit!.effectId, `segment ${segment} surface`).toBe(effectId);
    }
  });
});
