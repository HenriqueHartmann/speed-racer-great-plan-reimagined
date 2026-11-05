/**
 * The track, as the original organised it.
 *
 * Segments are authored, not generated: the original pre-sized four arrays to 37
 * slots and filed every model in the world into one of them by position or by
 * name. `doM5ChangeSegment` never streamed geometry - it toggled collision, so
 * that at any moment the car could only collide with the contents of its own
 * segment.
 *
 * That has a gameplay consequence worth preserving rather than smoothing away:
 * **objects in adjacent segments are intangible.** Reproducing it keeps the feel
 * honest, and it is also why a prop can overhang a seam without snagging the car.
 *
 * See `docs/research/handling-contract.md` section 9c.
 */

import * as K from './constants.js';
import { vec3, type GroundHit, type GroundProbe, type Vec3 } from './vehicle.js';

/** What a prop does when the car touches it, mirroring `userData.kind`. */
export type PropKind = 'track' | 'faller' | 'enemyCar' | 'wall' | 'pickup';

export type PickupKind = 'wrench' | 'candyPurple' | 'candyRed' | 'oxygen' | 'robot';

export interface Prop {
  readonly id: number;
  readonly kind: PropKind;
  /** Centre in world space. */
  readonly position: Vec3;
  /** Half-extents of an axis-aligned box, which is enough for the slice. */
  readonly halfExtent: Vec3;
  readonly pickup?: PickupKind;
  /** Pickups and felled trees stop colliding once taken. */
  active: boolean;
}

/** One 300-unit slice of track. */
export interface Segment {
  readonly index: number;
  /** Surface id reported by a raycast landing in this segment. */
  readonly effectId: number;
  /** Ground height; a flat segment for now, since real geometry is undecoded. */
  readonly height: number;
  /** Half-width of the drivable strip. Beyond it, the ray finds nothing. */
  readonly halfWidth: number;
  readonly props: Prop[];
}

export interface TrackOptions {
  /** How many of the 37 slots to populate. */
  segments: number;
  halfWidth?: number;
}

/**
 * Which segment a Y coordinate falls in.
 *
 * The original computed this as `integer(y) / 300 + 1`, so segment 1 spans
 * [0, 300). Negative Y is behind the start line and clamps to segment 1.
 */
export function segmentIndexFor(y: number): number {
  return Math.max(1, Math.floor(y / K.SEGMENT_LENGTH) + 1);
}

export class Track implements GroundProbe {
  readonly segments: Segment[] = [];
  /** The segment the car is currently in; only its props are collidable. */
  activeSegment = 1;

  private nextPropId = 1;

  constructor(opts: TrackOptions) {
    const count = Math.min(opts.segments, K.SEGMENT_SLOTS);
    const halfWidth = opts.halfWidth ?? 18;

    for (let i = 1; i <= count; i++) {
      this.segments.push({
        index: i,
        // A varied-but-deterministic surface layout, so grip changes are
        // exercised. Real surface ids live in the undecoded track geometry.
        effectId: i % 7 === 0 ? 4 : i % 11 === 0 ? 3 : 1,
        height: 0,
        halfWidth,
        props: [],
      });
    }
  }

  segment(index: number): Segment | undefined {
    return this.segments[index - 1];
  }

  addProp(
    segmentIndex: number,
    kind: PropKind,
    position: Vec3,
    halfExtent: Vec3,
    pickup?: PickupKind,
  ): Prop | undefined {
    const seg = this.segment(segmentIndex);
    if (!seg) return undefined;
    const prop: Prop = {
      id: this.nextPropId++,
      kind,
      position,
      halfExtent,
      active: true,
      ...(pickup ? { pickup } : {}),
    };
    seg.props.push(prop);
    return prop;
  }

  /** Called when the car's segment changes, mirroring `doM5ChangeSegment`. */
  changeSegment(to: number): void {
    this.activeSegment = to;
  }

  /**
   * Props the car can currently touch: only the active segment's, and only
   * those still active.
   */
  collidableProps(): Prop[] {
    return this.segment(this.activeSegment)?.props.filter((p) => p.active) ?? [];
  }

  /**
   * Downward ray against the track strip.
   *
   * Like the original, this only consults the current segment and its immediate
   * neighbour near a seam, rather than the whole world.
   */
  castDown(from: Vec3, maxDistance: number): GroundHit | null {
    const index = segmentIndexFor(from.y);
    const withinSeam = from.y - (index - 1) * K.SEGMENT_LENGTH;

    const candidates = [index];
    if (withinSeam < 2) candidates.push(index - 1);
    else if (withinSeam > K.SEGMENT_LENGTH - 2) candidates.push(index + 1);

    for (const i of candidates) {
      const seg = this.segment(i);
      if (!seg) continue;
      if (Math.abs(from.x) > seg.halfWidth) continue;

      const distance = from.z - seg.height;
      if (distance < 0 || distance > maxDistance) continue;

      return {
        distance,
        point: vec3(from.x, from.y, seg.height),
        effectId: seg.effectId,
      };
    }
    return null;
  }
}

/**
 * A test course for the vertical slice: a start area, a straight, obstacles,
 * fallers and pickups.
 *
 * This is our own layout. The original's is inside the undecoded track geometry,
 * so nothing here claims to reproduce it - only to exercise the recovered rules.
 */
export function buildSliceTrack(segments = 6): Track {
  const track = new Track({ segments });
  const half = vec3(2, 2, 3);

  for (let s = 2; s <= segments; s++) {
    const base = (s - 1) * K.SEGMENT_LENGTH;

    // Walls alternating sides, to make cornering matter.
    track.addProp(s, 'wall', vec3(s % 2 ? -10 : 10, base + 80, 1.5), half);
    track.addProp(s, 'wall', vec3(s % 2 ? 10 : -10, base + 190, 1.5), half);

    // A faller - the original's falling trees, which damage more than walls.
    track.addProp(s, 'faller', vec3(s % 3 ? 4 : -4, base + 140, 2), vec3(1.2, 1.2, 4));

    // Pickups, cycling through the recovered kinds.
    const kinds: PickupKind[] = ['wrench', 'candyRed', 'candyPurple', 'oxygen'];
    const kind = kinds[s % kinds.length]!;
    track.addProp(s, 'pickup', vec3(0, base + 230, 1.2), vec3(1, 1, 1), kind);
  }

  return track;
}
