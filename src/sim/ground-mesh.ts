/**
 * The ground, as triangles, queried by a downward ray.
 *
 * This is the simulation's own raycast: no engine, no DOM, no clock, so a
 * replay stays a replay. The original did the same thing through Director -
 * `modelsUnderRay(worldWheelPoint, worldDownDir, [#modelList: [...]])` - and
 * the `#modelList` is the point. It never tested the whole world, only the
 * segment the wheel was over and, near a seam, its neighbour. The triangle
 * range this module takes is that restriction.
 *
 * Determinism is a requirement here, not a hope. Two runs of the same inputs
 * must choose the same triangle, so the scan is in index order, the nearest
 * hit wins, and an exact tie keeps the hit already held - the lower index.
 */

import * as K from './constants.js';
import { vec3, type GroundHit, type Vec3 } from './vehicle.js';

/**
 * Triangles with a surface id each, grouped into segments.
 *
 * Flat typed arrays rather than objects: this is read four times a tick, and
 * it is also exactly what a Rapier trimesh collider wants, so the same buffers
 * serve the probe and the physics without a copy.
 */
export interface GroundMesh {
  /** Vertex positions, three floats each. */
  positions: Float32Array;
  /** Triangle corners, three indices each, into `positions`. */
  indices: Uint32Array;
  /** For triangle i, the 1-based sub-mesh index the original used as its `effectID`. */
  surfaceIds: Uint8Array;
  /** `segmentStart[s]` and `segmentEnd[s]` bound segment `s + 1`'s triangles. */
  segmentStart: Uint32Array;
  segmentEnd: Uint32Array;
  segmentCount: number;
}

/**
 * How near-parallel a ray may be to a triangle's plane before the intersection
 * is refused.
 *
 * It is relative, and it has to be. Positions run to 11,092 and are stored as
 * `float32`, whose spacing at that magnitude is about 1e-3, so any fixed
 * absolute epsilon is either unreachable or wildly too coarse depending on
 * where in the course you stand. Comparing the determinant against the edge
 * lengths that produced it compares like with like at every scale.
 *
 * It is not there to reject bad data: the decoded track has no degenerate
 * triangles at all, the smallest area across 18,725 being 6.886e-3. It is
 * there because a ray lying in a triangle's plane divides by zero.
 */
const EPS_REL = 1e-7;

/**
 * Nearest triangle below `from`, within `maxDistance`, among the triangles in
 * `[firstTri, lastTri)`.
 *
 * Möller–Trumbore, specialised to a straight-down ray.
 */
export function castDownMesh(
  mesh: GroundMesh,
  from: Vec3,
  maxDistance: number,
  firstTri: number,
  lastTri: number,
): GroundHit | null {
  const { positions, indices, surfaceIds } = mesh;

  let bestT = Infinity;
  let bestSurface = 0;

  for (let tri = firstTri; tri < lastTri; tri++) {
    const i0 = indices[tri * 3]! * 3;
    const i1 = indices[tri * 3 + 1]! * 3;
    const i2 = indices[tri * 3 + 2]! * 3;

    const ax = positions[i0]!, ay = positions[i0 + 1]!, az = positions[i0 + 2]!;
    const e1x = positions[i1]! - ax, e1y = positions[i1 + 1]! - ay, e1z = positions[i1 + 2]! - az;
    const e2x = positions[i2]! - ax, e2y = positions[i2 + 1]! - ay, e2z = positions[i2 + 2]! - az;

    // h = direction x e2, with direction fixed at (0, 0, -1), so
    // (0,0,-1) x (e2x,e2y,e2z) = (e2y, -e2x, 0) and its z term drops out.
    const hx = e2y;
    const hy = -e2x;
    const det = e1x * hx + e1y * hy;

    // Negated so that a NaN - which a triangle of zero extent produces, since
    // both sides are then zero - is refused rather than carried forward.
    const scale = Math.hypot(e1x, e1y, e1z) * Math.hypot(e2x, e2y, e2z);
    if (!(Math.abs(det) > EPS_REL * scale)) continue;

    const inv = 1 / det;
    const sx = from.x - ax, sy = from.y - ay, sz = from.z - az;

    const u = (sx * hx + sy * hy) * inv;
    if (u < 0 || u > 1) continue;

    // q = s x e1
    const qx = sy * e1z - sz * e1y;
    const qy = sz * e1x - sx * e1z;
    const qz = sx * e1y - sy * e1x;

    const v = -qz * inv;
    if (v < 0 || u + v > 1) continue;

    const t = (e2x * qx + e2y * qy + e2z * qz) * inv;
    if (t < 0 || t > maxDistance) continue;

    // Strictly nearer, so an exact tie leaves the earlier triangle in place.
    if (t < bestT) {
      bestT = t;
      bestSurface = surfaceIds[tri]!;
    }
  }

  if (bestT === Infinity) return null;
  return {
    distance: bestT,
    point: vec3(from.x, from.y, from.z - bestT),
    effectId: bestSurface,
  };
}

/**
 * A flat strip at z = 0, two triangles per segment.
 *
 * It is what the generated course was, expressed as a mesh, so the prop and
 * race-rule tests keep the ground they were written against while the real
 * track arrives separately.
 */
export function flatGroundMesh(segments: number, halfWidth = 18, effectId = 1): GroundMesh {
  const positions = new Float32Array(segments * 6 * 3);
  const indices = new Uint32Array(segments * 6);
  const surfaceIds = new Uint8Array(segments * 2);
  const segmentStart = new Uint32Array(segments);
  const segmentEnd = new Uint32Array(segments);

  for (let s = 0; s < segments; s++) {
    const y0 = s * K.SEGMENT_LENGTH;
    const y1 = y0 + K.SEGMENT_LENGTH;
    const corners = [
      -halfWidth, y0, 0,
      halfWidth, y0, 0,
      halfWidth, y1, 0,
      -halfWidth, y0, 0,
      halfWidth, y1, 0,
      -halfWidth, y1, 0,
    ];
    positions.set(corners, s * 18);
    for (let i = 0; i < 6; i++) indices[s * 6 + i] = s * 6 + i;
    surfaceIds[s * 2] = effectId;
    surfaceIds[s * 2 + 1] = effectId;
    segmentStart[s] = s * 2;
    segmentEnd[s] = s * 2 + 2;
  }

  return { positions, indices, surfaceIds, segmentStart, segmentEnd, segmentCount: segments };
}
