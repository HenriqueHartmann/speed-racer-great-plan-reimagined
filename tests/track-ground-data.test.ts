/**
 * The generated ground file, and the parser's refusal to trust a bad one.
 *
 * `track-ground.bin` is what the simulation drives on, so a file that is wrong
 * in the middle surfaces as a car falling through the world a minute into a
 * run. Every malformed shape below is rejected at the door instead.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { parseGroundMesh } from '../src/sim/ground-mesh.js';

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

  it('rejects segment ranges that are not contiguous and ascending', () => {
    // segmentEnd[0] set to 0 while triangleCount is 1: the last segment no
    // longer accounts for every triangle.
    expect(() =>
      parseGroundMesh(corrupt((_, v) => v.setUint32(32 + 36 + 12 + 4 + 4, 0, true))),
    ).toThrow(/segment/i);
  });
});
