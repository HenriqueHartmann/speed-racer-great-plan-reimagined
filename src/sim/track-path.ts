/**
 * The rivals' racing line, as `pathList` holds it.
 *
 * 209 waypoints read from `path_01`..`path_209` by `PREP:308-311` and stored
 * **quantised**: `point(integer(x), integer(y))` with `ceil(z)`. A rival aims
 * at the rounded point, not the authored one, so the quantisation belongs to
 * the behaviour and is baked into the asset rather than applied here.
 *
 * Only x and y are ever read while driving (`doEnemy:423-424`). The z is used
 * when a car is placed or recycled, as the height to drop a ray from.
 *
 * Strictly increasing in Y, which `doEnemy` depends on: `tYOffset = rivalY -
 * playerY` is the race-position measure throughout the script. The extractor
 * refuses a line that doubles back and the parser checks it again here,
 * because a file can be replaced without the extractor running.
 */

import { vec3, type Vec3 } from './vehicle.js';

/** "SRPT". */
const MAGIC = 0x5450_5253;
const VERSION = 1;
const HEADER_BYTES = 16;
const STRIDE = 12;

export interface TrackPath {
  /** Waypoint count. `pathList.count` in the original. */
  readonly count: number;
  /** Integer x, y, z triples, three per waypoint, in course order. */
  readonly points: Int32Array;
}

/** Waypoint `step`, 1-based as `pathList` is. */
export function waypoint(path: TrackPath, step: number): Vec3 {
  if (!Number.isInteger(step) || step < 1 || step > path.count) {
    throw new RangeError(`waypoint ${step} is outside 1..${path.count}`);
  }
  const at = (step - 1) * 3;
  return vec3(path.points[at]!, path.points[at + 1]!, path.points[at + 2]!);
}

export function parseTrackPath(bytes: Uint8Array): TrackPath {
  if (bytes.byteLength < HEADER_BYTES) throw new Error('path data truncated: no header');

  // Int32Array views cannot start on an unaligned byte; see `parseSegmentedMesh`
  // for why this copy exists rather than letting the constructor throw.
  if (bytes.byteOffset % 4 !== 0) bytes = bytes.slice();

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (view.getUint32(0, true) !== MAGIC) throw new Error('path data: bad magic');

  const version = view.getUint32(4, true);
  if (version !== VERSION) throw new Error(`path data: unsupported version ${version}`);

  const count = view.getUint32(8, true);
  if (count === 0) throw new Error('path data: no waypoints');

  const expected = HEADER_BYTES + count * STRIDE;
  if (bytes.byteLength !== expected) {
    throw new Error(`path data: expected ${expected} bytes for ${count} waypoints, got ${bytes.byteLength}`);
  }

  const points = new Int32Array(bytes.buffer, bytes.byteOffset + HEADER_BYTES, count * 3);

  for (let i = 1; i < count; i++) {
    if (points[i * 3 + 1]! <= points[(i - 1) * 3 + 1]!) {
      throw new Error(`path data: waypoint ${i + 1} does not advance in Y`);
    }
  }

  return { count, points };
}
