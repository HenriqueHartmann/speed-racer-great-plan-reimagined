/**
 * The level's solid barriers, as the simulation reads them.
 *
 * `WALL_`, `INV_` and `RAIL_` are not objects with a position and a size: they
 * are one arbitrary mesh per segment, 48 of them, and an axis-aligned box
 * around `WALL_8` would be a 300-unit block filling its whole segment. They go
 * through the trimesh path the road already uses.
 *
 * `MISC_` deliberately does not. No branch of `PREP`'s dispatcher matches
 * `"MIS"` - the 23 models fall off the end of the chain and receive no rigid
 * body, no collision modifier and no array. They are scenery.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { parseSolidMesh } from '../src/sim/ground-mesh.js';
import { Glb } from './glb.js';
import * as K from '../src/sim/constants.js';

const FILE = 'public/models/track-solids.bin';

describe('the decoded barriers', () => {
  const solids = parseSolidMesh(readFileSync(FILE));
  const glb = new Glb('public/models/track.glb');

  it('carries one slot per segment the original pre-sized', () => {
    expect(solids.segmentCount).toBe(K.SEGMENT_SLOTS);
  });

  it('files every triangle under exactly one segment', () => {
    expect(solids.segmentStart[0]).toBe(0);
    expect(solids.segmentEnd[K.SEGMENT_SLOTS - 1]).toBe(solids.surfaceIds.length);
    for (let s = 0; s < K.SEGMENT_SLOTS - 1; s++) {
      expect(solids.segmentEnd[s]).toBe(solids.segmentStart[s + 1]);
    }
  });

  it('gives every segment a barrier, which is why you can be held in', () => {
    // Measured, not assumed, and it surprised me: walls cover 8-32 and 37
    // while INV_ covers 1-7, 11-12, 15-16 and 27-37, and between them the
    // union is all 37. There is no stretch of this course without a fence.
    //
    // The empty-segment case is still real - it is the shape of the data, not
    // a guarantee of it - and PropSegmentColliders is tested against a
    // synthetic mesh that has one.
    for (let s = 0; s < K.SEGMENT_SLOTS; s++) {
      expect(solids.segmentEnd[s]! - solids.segmentStart[s]!, `segment ${s + 1}`).toBeGreaterThan(0);
    }
  });

  it('includes the walls, the invisible fences and the rail, and nothing else', () => {
    const wanted = (glb.json.nodes as { name?: string }[]).filter((n) =>
      /^(WALL|INV|RAIL)_/.test(n.name ?? ''),
    );
    expect(wanted).toHaveLength(48);

    const triangles = wanted.reduce((sum, n) => {
      const node = glb.node(n.name!);
      return (
        sum +
        glb.json.meshes[node.mesh!].primitives.reduce(
          (t: number, p: { indices?: number }) =>
            t + glb.json.accessors[p.indices!].count / 3,
          0,
        )
      );
    }, 0);
    expect(solids.surfaceIds.length).toBe(triangles);
  });

  it('excludes MISC_, which the original never makes solid', () => {
    // 4,143 triangles of grandstand. If they were in here the player would be
    // walled in by scenery.
    const misc = (glb.json.nodes as { name?: string }[]).filter((n) => /^MISC_/.test(n.name ?? ''));
    expect(misc.length).toBe(23);
    const miscTriangles = misc.reduce((sum, n) => {
      const node = glb.node(n.name!);
      return sum + glb.json.meshes[node.mesh!].primitives.reduce(
        (t: number, p: { indices?: number }) => t + glb.json.accessors[p.indices!].count / 3, 0);
    }, 0);
    expect(solids.surfaceIds.length).toBeLessThan(miscTriangles + solids.surfaceIds.length);
    expect(miscTriangles).toBeGreaterThan(0);
  });

  it('marks which barrier a triangle came from', () => {
    // 1 = wall, 2 = invisible, 3 = rail. The renderer needs to draw the first
    // and the third and not the second.
    for (const id of solids.surfaceIds) {
      expect(id).toBeGreaterThanOrEqual(1);
      expect(id).toBeLessThanOrEqual(3);
    }
    expect([...new Set(solids.surfaceIds)].sort()).toEqual([1, 2, 3]);
  });

  it('places each barrier in the segment its position implies', () => {
    // Filed by position, as PREP:272 does - never by the name suffix, which
    // MISC_08 proves is an opaque id.
    for (let s = 0; s < K.SEGMENT_SLOTS; s++) {
      for (let t = solids.segmentStart[s]!; t < solids.segmentEnd[s]!; t++) {
        const y = solids.positions[solids.indices[t * 3]! * 3 + 1]!;
        // A 300-unit barrier spans its segment, so test the centre of mass of
        // the triangle's own segment rather than every vertex.
        expect(Math.abs(y - (s + 0.5) * K.SEGMENT_LENGTH)).toBeLessThan(260);
      }
    }
  });
});
