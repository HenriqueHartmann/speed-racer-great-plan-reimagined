/**
 * The level's individual objects — 355 trees and 77 pickups — read from
 * `public/models/track-objects.bin`, which `tools/build_track_objects.mjs`
 * writes from the decoded world.
 *
 * Unlike the barriers, these have a place and a size, so they go through the
 * `Prop` model rather than a trimesh. Everything here is plain arithmetic over
 * a typed array: no DOM, no engine, so the simulation stays replayable.
 *
 * Refuses a file it cannot trust, on the same principle as `parseGroundMesh`:
 * a bad object file does not announce itself, it surfaces as a pickup that
 * cannot be collected or a tree standing in the middle of the road.
 */

import * as K from './constants.js';
import { vec3, type Vec3 } from './vehicle.js';
import type { PickupKind, PropKind, Track } from './track.js';

/** A quaternion, as the exporter writes it. */
export interface Quat {
  x: number;
  y: number;
  z: number;
  w: number;
}

export interface TrackObject {
  readonly kind: PropKind;
  readonly pickup?: PickupKind;
  /** 1-based, from `(integer(y) / 300) + 1` as `PREP:272` computes it. */
  readonly segment: number;
  readonly position: Vec3;
  readonly rotation: Quat;
  readonly halfExtent: Vec3;
}

/** `"SROB"`, little-endian. */
const MAGIC = 0x42_4f_52_53;
const VERSION = 1;
const HEADER_BYTES = 16;
const STRIDE = 44;

/** Kind codes, in `PREP`'s own test order for the pickups. */
const KINDS: readonly (readonly [PropKind, PickupKind | undefined])[] = [
  ['tree', undefined],
  ['pickup', 'wrench'],
  ['pickup', 'candyPurple'],
  ['pickup', 'candyRed'],
  ['pickup', 'oxygen'],
  ['pickup', 'robot'],
];

export function parseTrackObjects(bytes: Uint8Array): TrackObject[] {
  if (bytes.byteLength < HEADER_BYTES) throw new Error('object data truncated: no header');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

  if (view.getUint32(0, true) !== MAGIC) throw new Error('object data: bad magic');
  const version = view.getUint32(4, true);
  if (version !== VERSION) throw new Error(`object data: unsupported version ${version}`);

  const count = view.getUint32(8, true);
  const slots = view.getUint32(12, true);
  const expected = HEADER_BYTES + count * STRIDE;
  if (bytes.byteLength !== expected) {
    throw new Error(
      `object data: size ${bytes.byteLength} does not match its count of ${count}, which needs ${expected}`,
    );
  }

  const objects: TrackObject[] = [];
  for (let i = 0; i < count; i++) {
    let at = HEADER_BYTES + i * STRIDE;
    const code = view.getUint8(at);
    const segment = view.getUint8(at + 1);
    const entry = KINDS[code - 1];
    if (!entry) throw new Error(`object data: object ${i} has unknown kind ${code}`);
    if (segment < 1 || segment > slots) {
      throw new Error(`object data: object ${i} is in segment ${segment}, outside 1..${slots}`);
    }
    at += 4;

    const f = (): number => {
      const v = view.getFloat32(at, true);
      at += 4;
      if (!Number.isFinite(v)) throw new Error(`object data: object ${i} has a non-finite value`);
      return v;
    };

    const position = vec3(f(), f(), f());
    const rotation = { x: f(), y: f(), z: f(), w: f() };
    const halfExtent = vec3(f(), f(), f());

    objects.push({
      kind: entry[0],
      ...(entry[1] ? { pickup: entry[1] } : {}),
      segment,
      position,
      rotation,
      halfExtent,
    });
  }
  return objects;
}

/**
 * File the objects into a track, and report how many landed.
 *
 * The segment comes from the file, which the extractor derived from the
 * position; `Track.addProp` refuses one outside its slots, so a mismatch is
 * visible in the count rather than silent.
 */
export function populateTrack(track: Track, objects: readonly TrackObject[]): number {
  let added = 0;
  for (const o of objects) {
    const prop = track.addProp(o.segment, o.kind, o.position, o.halfExtent, o.pickup);
    if (prop) added++;
  }
  void K;
  return added;
}
