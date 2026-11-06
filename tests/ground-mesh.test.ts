/**
 * The ground probe the simulation runs against real triangles.
 *
 * It replaces the flat-strip arithmetic `Track` used while the track geometry
 * was undecoded. Two properties matter more than speed: it must be free of the
 * DOM and of any engine, so `src/sim/` stays replayable, and it must be
 * deterministic to the bit, so the replay tests keep meaning what they say.
 */
import { describe, it, expect } from 'vitest';
import {
  castDownMesh,
  flatGroundMesh,
  type GroundMesh,
} from '../src/sim/ground-mesh.js';
import { vec3 } from '../src/sim/vehicle.js';

/** A mesh from explicit triangles, all filed under a single segment. */
function mesh(triangles: readonly (readonly number[])[], surfaceIds: readonly number[]): GroundMesh {
  const positions = new Float32Array(triangles.flatMap((t) => [...t]));
  return {
    positions,
    indices: new Uint32Array(triangles.flatMap((_, i) => [i * 3, i * 3 + 1, i * 3 + 2])),
    surfaceIds: new Uint8Array(surfaceIds),
    segmentStart: new Uint32Array([0]),
    segmentEnd: new Uint32Array([triangles.length]),
    segmentCount: 1,
  };
}

/** A unit quad's two halves, centred on (x, y) at height z. */
function quadAt(x: number, y: number, z: number): readonly (readonly number[])[] {
  return [
    [x - 1, y - 1, z, x + 1, y - 1, z, x + 1, y + 1, z],
    [x - 1, y - 1, z, x + 1, y + 1, z, x - 1, y + 1, z],
  ];
}

describe('castDownMesh', () => {
  it('hits a triangle below the ray origin', () => {
    const m = flatGroundMesh(1, 10, 1);
    const hit = castDownMesh(m, vec3(0, 150, 0.8), 1, 0, 2);
    expect(hit?.distance).toBeCloseTo(0.8, 6);
    expect(hit?.point.z).toBeCloseTo(0, 6);
    expect(hit?.effectId).toBe(1);
  });

  it('respects maxDistance', () => {
    const m = flatGroundMesh(1, 10, 1);
    expect(castDownMesh(m, vec3(0, 150, 2), 1, 0, 2)).toBeNull();
  });

  it('misses outside the triangle', () => {
    const m = flatGroundMesh(1, 10, 1);
    expect(castDownMesh(m, vec3(50, 150, 0.5), 1, 0, 2)).toBeNull();
  });

  it('rejects a surface above the ray origin', () => {
    // After a hard landing a wheel point can sit under the road. A downward
    // ray must not report a surface it has already passed.
    const m = flatGroundMesh(1, 10, 1);
    expect(castDownMesh(m, vec3(0, 150, -0.5), 1, 0, 2)).toBeNull();
  });

  it('ignores a degenerate triangle', () => {
    const m = mesh([[0, 150, 0, 0, 150, 0, 0, 150, 0], ...quadAt(0, 150, 0)], [7, 4, 4]);
    const hit = castDownMesh(m, vec3(0, 150, 0.5), 1, 0, 3);
    expect(hit).not.toBeNull();
    expect(hit?.effectId).toBe(4);
  });

  it('returns null for an exactly vertical triangle', () => {
    // Math.fround collapses 11000.000001 to 11000, so this triangle really is
    // vertical: the determinant is exactly zero and the answer must be a
    // refusal, not a NaN dressed up as a distance.
    const f = Math.fround;
    const m = mesh(
      [[f(-1), f(11000), f(-1), f(1), f(11000), f(-1), f(0), f(11000.000001), f(1)]],
      [6],
    );
    expect(castDownMesh(m, vec3(0, 11000, 0.5), 1, 0, 1)).toBeNull();
  });

  it('measures the same distance at the far end of the course', () => {
    // The relative epsilon must not degrade with coordinate magnitude: the
    // course reaches y 11,092 and positions are float32.
    const near = castDownMesh(mesh(quadAt(0, 150, 0), [2, 2]), vec3(0, 150, 0.8), 1, 0, 2);
    const far = castDownMesh(mesh(quadAt(0, 11000, 0), [2, 2]), vec3(0, 11000, 0.8), 1, 0, 2);
    expect(near?.distance).toBeCloseTo(0.8, 5);
    expect(far?.distance).toBeCloseTo(0.8, 5);
  });

  it('breaks ties to the lower triangle index', () => {
    // Two coincident triangles. Which one answers must not depend on anything
    // but their order, or replays stop being replays.
    const [first] = quadAt(0, 150, 0);
    const m = mesh([first!, first!], [3, 9]);
    for (let run = 0; run < 3; run++) {
      expect(castDownMesh(m, vec3(0, 150, 0.5), 1, 0, 2)?.effectId).toBe(3);
    }
  });

  it('answers with the nearest triangle, not the last one scanned', () => {
    // Segments 4 and 31 of the real course carry geometry stacked in depth,
    // live road with more live surface beneath it. Nearest-wins is the only
    // thing stopping the probe reporting the floor under the road.
    const m = mesh([...quadAt(0, 150, 0), ...quadAt(0, 150, 0.4)], [2, 2, 9, 9]);
    const hit = castDownMesh(m, vec3(0, 150, 1), 2, 0, 4);
    expect(hit?.effectId).toBe(9);
    expect(hit?.distance).toBeCloseTo(0.6, 5);
  });

  it('answers with the nearest triangle whichever order they are in', () => {
    const m = mesh([...quadAt(0, 150, 0.4), ...quadAt(0, 150, 0)], [9, 9, 2, 2]);
    expect(castDownMesh(m, vec3(0, 150, 1), 2, 0, 4)?.effectId).toBe(9);
  });

  it('refuses a ray lying in a triangle plane rather than inventing a hit', () => {
    // A near-vertical triangle with the ray almost in its plane: the
    // determinant collapses and the intersection divides by it. The guard is
    // relative to the edge lengths, so it means the same thing at y = 150 and
    // at y = 11,000 - which a fixed epsilon would not.
    const steep = (y: number): readonly (readonly number[])[] => [
      [-1, y, -5, 1, y, -5, -1, y + 1e-7, 5],
    ];
    for (const y of [150, 11000]) {
      const hit = castDownMesh(mesh(steep(y), [6]), vec3(0, y, 0), 1000, 0, 1);
      if (hit !== null) {
        expect(Number.isFinite(hit.distance), `y=${y}`).toBe(true);
        expect(hit.distance, `y=${y}`).toBeLessThanOrEqual(1000);
      }
    }
  });

  it('sets the near-parallel threshold at the ratio the epsilon names', () => {
    // The guard is `|det| > EPS_REL * |e1| * |e2|` with EPS_REL = 1e-7, and
    // `det` is the 2D cross product of the two edges projected onto XY. So the
    // quantity being thresholded is a RATIO - how edge-on the triangle is seen
    // from above - and the epsilon is the ratio's floor, not the determinant's.
    //
    // Nothing pinned that before. The existing near-vertical test asserts only
    // that a hit, if one comes back, is finite. This fixes the threshold on
    // both sides of 1e-7, which is what any rewrite of the guard has to keep.
    //
    // A sliver with a = (0,0,-1), e1 = (1,0,0), e2 = (1,d,0): det = d and both
    // edges are of length about 1, so the ratio IS d. A ray dropped through
    // the sliver's interior - barycentric u = 0.5, v = 0.25 - must hit when d
    // is above the epsilon and be refused when it is below.
    const sliver = (d: number): readonly (readonly number[])[] => [
      [0, 0, -1, 1, 0, -1, 1, d, -1],
    ];
    const through = (d: number) => vec3(0.75, 0.25 * d, 0);

    // Comfortably above 1e-7: a real, if thin, triangle. It must be hit.
    const wide = castDownMesh(mesh(sliver(1e-5), [1]), through(1e-5), 10, 0, 1);
    expect(wide, 'ratio 1e-5 is above the epsilon and must be hit').not.toBeNull();
    expect(wide!.distance).toBeCloseTo(1, 6);

    // Comfortably below it: refused rather than divided by.
    expect(castDownMesh(mesh(sliver(1e-9), [1]), through(1e-9), 10, 0, 1)).toBeNull();
  });

  it('judges a triangle by its shape, not by its size', () => {
    // The `* |e1| * |e2|` is what makes the epsilon scale-free. The same sliver
    // blown up by a thousand is the same shape and must get the same answer,
    // which a guard comparing the bare determinant would not give.
    const sliver = (d: number, k: number): readonly (readonly number[])[] => [
      [0, 0, -k, k, 0, -k, k, d * k, -k],
    ];
    for (const k of [1, 1000]) {
      const hit = castDownMesh(mesh(sliver(1e-5, k), [1]), vec3(0.75 * k, 0.25e-5 * k, 0), 1e5, 0, 1);
      expect(hit, `k=${k} must be hit`).not.toBeNull();
      expect(castDownMesh(mesh(sliver(1e-9, k), [1]), vec3(0.75 * k, 0.25e-9 * k, 0), 1e5, 0, 1),
        `k=${k} must be refused`).toBeNull();
    }
  });

  it('only tests the triangles in the given range', () => {
    // The range is how the caller restricts a query to one segment, as the
    // original restricted modelsUnderRay with #modelList.
    const m = mesh([...quadAt(0, 150, 0), ...quadAt(0, 150, 0.2)], [1, 1, 4, 4]);
    expect(castDownMesh(m, vec3(0, 150, 1), 2, 0, 2)?.effectId).toBe(1);
    expect(castDownMesh(m, vec3(0, 150, 1), 2, 2, 4)?.effectId).toBe(4);
  });
});

describe('flatGroundMesh', () => {
  it('files two triangles under each segment', () => {
    const m = flatGroundMesh(3);
    expect(m.segmentCount).toBe(3);
    expect(m.segmentStart[0]).toBe(0);
    expect(m.segmentEnd[2]).toBe(6);
    for (let s = 0; s < 2; s++) expect(m.segmentEnd[s]).toBe(m.segmentStart[s + 1]);
  });

  it('covers each segment s from 300*(s-1) to 300*s', () => {
    const m = flatGroundMesh(3);
    expect(castDownMesh(m, vec3(0, 10, 0.5), 1, m.segmentStart[0]!, m.segmentEnd[0]!)).not.toBeNull();
    expect(castDownMesh(m, vec3(0, 310, 0.5), 1, m.segmentStart[0]!, m.segmentEnd[0]!)).toBeNull();
    expect(castDownMesh(m, vec3(0, 310, 0.5), 1, m.segmentStart[1]!, m.segmentEnd[1]!)).not.toBeNull();
  });
});
