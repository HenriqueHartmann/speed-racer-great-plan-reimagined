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
import { castDownMesh, flatGroundMesh, type GroundMesh } from './ground-mesh.js';
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

/**
 * One 300-unit slice of track.
 *
 * The surface and the ground height used to live here, as a flat plane and a
 * half-width, because the real geometry was undecoded. They now come from the
 * mesh, which curves, climbs and changes material across a segment - none of
 * which a single height and width could say.
 */
export interface Segment {
  readonly index: number;
  readonly props: Prop[];
}

export interface TrackOptions {
  /** The triangles under the whole course, grouped by segment. */
  ground: GroundMesh;
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

  private readonly ground: GroundMesh;

  constructor(opts: TrackOptions) {
    this.ground = opts.ground;
    // The original pre-sized its arrays to 37 slots and never grew them, so a
    // mesh carrying more segments than that is truncated rather than honoured.
    const count = Math.min(opts.ground.segmentCount, K.SEGMENT_SLOTS);
    for (let i = 1; i <= count; i++) this.segments.push({ index: i, props: [] });
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

    let best: GroundHit | null = null;
    for (const i of candidates) {
      if (!this.segment(i)) continue;
      const hit = castDownMesh(
        this.ground,
        from,
        maxDistance,
        this.ground.segmentStart[i - 1]!,
        this.ground.segmentEnd[i - 1]!,
      );
      if (hit && (best === null || hit.distance < best.distance)) best = hit;
    }
    return best;
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
  const track = new Track({ ground: flatGroundMesh(segments) });
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
