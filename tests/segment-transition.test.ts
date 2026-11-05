/**
 * Exactly one segment of track is solid at a time.
 *
 * `doM5ChangeSegment` (`MOVIE.ls:135-136`) is two lines in this order:
 *
 *     gHavok.disableCollision(tCar.name, SEG_TRK[tSEG1].name)
 *     gHavok.enableCollision(tCar.name, SEG_TRK[tSEG2].name)
 *
 * Old off, new on. The neighbour is never enabled, not even at a seam - and
 * that asymmetry is deliberate: the hover ray consults two segments within 2
 * units of a boundary, the physical collider only ever one. Reproducing it is
 * the point, because it is what let a prop overhang a seam without snagging.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { initRapier, RapierWorld } from '../src/physics/rapier-body.js';
import { SegmentColliders } from '../src/physics/segment-colliders.js';
import { flatGroundMesh, parseGroundMesh } from '../src/sim/ground-mesh.js';
import { Track } from '../src/sim/track.js';
import { vec3 } from '../src/sim/vehicle.js';
import * as K from '../src/sim/constants.js';

let rapier: Awaited<ReturnType<typeof initRapier>>;
beforeAll(async () => {
  rapier = await initRapier();
});

describe('segment colliders', () => {
  it('enables only the entered segment, in both directions', () => {
    const host = new RapierWorld(rapier);
    const colliders = new SegmentColliders(host, flatGroundMesh(3));

    colliders.setActive(1);
    expect([1, 2, 3].map((s) => colliders.isEnabled(s))).toEqual([true, false, false]);

    colliders.setActive(2);
    expect([1, 2, 3].map((s) => colliders.isEnabled(s))).toEqual([false, true, false]);

    colliders.setActive(1);
    expect([1, 2, 3].map((s) => colliders.isEnabled(s))).toEqual([true, false, false]);
  });

  it('never leaves the car with no ground and never with two', () => {
    const host = new RapierWorld(rapier);
    const colliders = new SegmentColliders(host, flatGroundMesh(4));
    for (const s of [1, 2, 3, 4, 3, 2, 1]) {
      colliders.setActive(s);
      expect([1, 2, 3, 4].filter((i) => colliders.isEnabled(i))).toEqual([s]);
    }
  });

  it('ignores a segment index the mesh does not have', () => {
    const host = new RapierWorld(rapier);
    const colliders = new SegmentColliders(host, flatGroundMesh(2));
    colliders.setActive(1);
    colliders.setActive(99);
    // Out of range leaves the last good one standing rather than going dark.
    expect(colliders.isEnabled(1)).toBe(true);
  });
});

describe('the real course across a seam', () => {
  const ground = parseGroundMesh(readFileSync('public/models/track-ground.bin'));
  const track = new Track({ ground });

  /** The triangle of `segment` reaching furthest past its nominal slice. */
  function furthestOverrun(segment: number): { x: number; y: number; z: number } | null {
    let best: { x: number; y: number; z: number } | null = null;
    const edge = segment * K.SEGMENT_LENGTH;
    for (let t = ground.segmentStart[segment - 1]!; t < ground.segmentEnd[segment - 1]!; t++) {
      for (let c = 0; c < 3; c++) {
        const v = ground.indices[t * 3 + c]! * 3;
        const y = ground.positions[v + 1]!;
        if (y <= edge) continue;
        if (best === null || y > best.y) {
          best = { x: ground.positions[v]!, y, z: ground.positions[v + 2]! };
        }
      }
    }
    return best;
  }

  it('has segments that reach past their own slice', () => {
    // This is the premise the 2-unit seam window exists for. If the decoded
    // geometry ever stops overrunning, the window stops being necessary and
    // this test says so rather than silently passing.
    const overrunning = [];
    for (let s = 1; s <= 37; s++) if (furthestOverrun(s)) overrunning.push(s);
    expect(overrunning.length).toBeGreaterThan(0);
  });

  it('finds that overrunning geometry from the far side of the seam', () => {
    // A wheel point just past the boundary is, by segmentIndexFor, in the next
    // segment - but the road under it belongs to the previous one. Without the
    // seam neighbour the probe would miss and the car would drop.
    for (let s = 1; s <= 37; s++) {
      const far = furthestOverrun(s);
      if (!far) continue;
      const hit = track.castDown(vec3(far.x, far.y, far.z + 0.5), K.HOVER_RAY_LENGTH);
      expect(hit, `segment ${s} overruns to y ${far.y.toFixed(2)}`).not.toBeNull();
    }
  });
});
