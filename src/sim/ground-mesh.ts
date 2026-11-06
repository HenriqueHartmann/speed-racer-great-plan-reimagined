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
 * hit wins, and an exact tie keeps the hit already held - within one scan,
 * the lower index. `Track.castDown` runs two scans at a seam and keeps the
 * first strictly-nearer hit, so a tie there keeps the car's own segment
 * rather than the lower index. Both are fixed; neither depends on timing.
 */

import * as K from './constants.js';
import { vec3, type GroundHit, type Vec3 } from './vehicle.js';

/**
 * Triangles with a surface id each, grouped into segments.
 *
 * Flat typed arrays rather than objects: this is read four times a tick, and
 * it is the shape a Rapier trimesh collider takes. `SegmentColliders` still
 * copies each segment out, because Rapier wants a self-contained mesh with its
 * own vertex numbering - the shared shape saves the conversion, not the copy.
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
 * It is relative so that it means the same thing for a triangle of any size:
 * the determinant is built from the two edge vectors, so comparing it against
 * their lengths is comparing like with like. (An earlier version of this
 * comment argued from the coordinate magnitudes instead - positions reaching
 * 11,092 in float32 - which is the wrong quantity: the edges are differences,
 * and run 1 to 100 units, not 1e4.)
 *
 * It is **defensive, and currently unobservable.** The decoded track has no
 * degenerate triangles - the smallest area across 18,725 is 6.886e-3 - and the
 * ratio this tests has a clean gap in the real data: 55 triangles at exactly
 * zero, nothing until 1e-5, then 1e-3 and up. Deleting the guard, or replacing
 * it with a coarse absolute epsilon, passes the whole suite, because a zero
 * determinant already leaves via the NaN comparisons at the end. So no test
 * here pins it, and that is stated rather than implied: it stands because a
 * ray lying in a triangle's plane divides by zero, not because anything
 * currently catches it doing so.
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

/** `"SRTG"` (ground) and `"SRTP"` (solid props), little-endian. */
const MAGIC = 0x47_54_52_53;
const MAGIC_SOLIDS = 0x50_54_52_53;
const VERSION = 1;
/** Header: magic, version, three counts, then the spawn point. */
const HEADER_BYTES = 32;

/**
 * Read `public/models/track-ground.bin`, as `tools/build_track_ground.mjs`
 * writes it.
 *
 * Every malformed shape is refused here rather than carried into the
 * simulation. A ground file that is wrong in the middle does not announce
 * itself: it surfaces as a car falling through the world a minute into a run,
 * which is the worst possible place to learn about it.
 *
 * Takes `Uint8Array` so the browser's `fetch` and a test's `readFileSync` hand
 * it the same type without a cast.
 */
export function parseGroundMesh(bytes: Uint8Array): GroundMesh & { spawn: Vec3 } {
  return parseSegmentedMesh(bytes, MAGIC, 'ground data');
}

/**
 * Read `public/models/track-solids.bin`, the level's barriers.
 *
 * Same shape as the ground: one triangle range per segment, a surface id per
 * triangle. Here the id names the barrier rather than the material - 1 wall,
 * 2 invisible fence, 3 rail - because the renderer has to draw the first and
 * the third and not the second.
 *
 * The header's spawn slot is unused and zeroed, so that both files share one
 * parser rather than growing a second nearly-identical one.
 */
export function parseSolidMesh(bytes: Uint8Array): GroundMesh {
  return parseSegmentedMesh(bytes, MAGIC_SOLIDS, 'solid data');
}

function parseSegmentedMesh(
  bytes: Uint8Array,
  magic: number,
  what: string,
): GroundMesh & { spawn: Vec3 } {
  if (bytes.byteLength < HEADER_BYTES) throw new Error(`${what} truncated: no header`);

  // The typed arrays below are views onto the caller's buffer, and a
  // Float32Array cannot start on an odd byte. A `Uint8Array` whose own offset
  // is not a multiple of four would throw a raw RangeError from the
  // constructor rather than this module's own error, so copy that case rather
  // than escape our own contract. Both real callers - `fetch` and
  // `readFileSync` - are aligned, so this almost never fires.
  if (bytes.byteOffset % 4 !== 0) bytes = bytes.slice();

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (view.getUint32(0, true) !== magic) throw new Error(`${what}: bad magic`);

  const version = view.getUint32(4, true);
  if (version !== VERSION) throw new Error(`${what}: unsupported version ${version}`);

  const segmentCount = view.getUint32(8, true);
  const triangleCount = view.getUint32(12, true);
  const vertexCount = view.getUint32(16, true);
  const spawn = vec3(view.getFloat32(20, true), view.getFloat32(24, true), view.getFloat32(28, true));

  // `surfaceIds` is bytes; the segment ranges after it are uint32, so it is
  // padded up to keep them aligned.
  const idsPadded = Math.ceil(triangleCount / 4) * 4;
  const expected =
    HEADER_BYTES + vertexCount * 12 + triangleCount * 12 + idsPadded + segmentCount * 8;
  if (bytes.byteLength !== expected) {
    throw new Error(`${what}: size ${bytes.byteLength} does not match its counts, which need ${expected}`);
  }

  let at = bytes.byteOffset + HEADER_BYTES;
  const positions = new Float32Array(bytes.buffer, at, vertexCount * 3);
  at += vertexCount * 12;
  const indices = new Uint32Array(bytes.buffer, at, triangleCount * 3);
  at += triangleCount * 12;
  const surfaceIds = new Uint8Array(bytes.buffer, at, triangleCount);
  at += idsPadded;
  const segmentStart = new Uint32Array(bytes.buffer, at, segmentCount);
  at += segmentCount * 4;
  const segmentEnd = new Uint32Array(bytes.buffer, at, segmentCount);

  for (let i = 0; i < positions.length; i++) {
    if (!Number.isFinite(positions[i]!)) throw new Error(`${what}: coordinate ${i} is not finite`);
  }
  for (let i = 0; i < indices.length; i++) {
    if (indices[i]! >= vertexCount) {
      throw new Error(`${what}: index ${indices[i]} past the ${vertexCount} vertices`);
    }
  }
  for (let i = 0; i < surfaceIds.length; i++) {
    if (surfaceIds[i] === 0) throw new Error(`${what}: triangle ${i} has surface id 0`);
  }
  if (segmentCount === 0 || segmentStart[0] !== 0) {
    throw new Error(`${what}: segment ranges must start at triangle 0`);
  }
  for (let s = 0; s < segmentCount; s++) {
    if (segmentEnd[s]! < segmentStart[s]!) throw new Error(`${what}: segment ${s + 1} ends before it starts`);
    if (s + 1 < segmentCount && segmentEnd[s] !== segmentStart[s + 1]) {
      throw new Error(`${what}: segment ${s + 1} does not meet segment ${s + 2}`);
    }
  }
  if (segmentEnd[segmentCount - 1] !== triangleCount) {
    throw new Error(`${what}: the segments do not account for every triangle`);
  }

  return { positions, indices, surfaceIds, segmentStart, segmentEnd, segmentCount, spawn };
}
