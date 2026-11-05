/**
 * One segment's props are solid; every other segment's are not.
 *
 * The simulation has always obeyed this - `Track.collidableProps` reads only
 * `activeSegment`, because `doM5ChangeSegment` (`MOVIE.ls:124-146`) disables
 * the old segment's collisions before enabling the new one's. The physics
 * world did not: colliders were built for the whole track at startup and never
 * disabled, so a wall in segment 9 would have stopped a car in segment 8.
 *
 * That asymmetry is deliberate in the original and worth keeping: it is what
 * lets a prop overhang a seam without snagging the car, and it is the same
 * shape as `SegmentColliders`, which does this for the road.
 *
 * Nothing is created or destroyed after construction. A consumed prop is
 * disabled, not removed, so a restart can hand it back - removing it leaked
 * the parent body and left the next run driving through a visible wall.
 */

import type * as RAPIER from '@dimforge/rapier3d-compat';
import type { Prop, Track } from '../sim/track.js';
import type { RapierWorld } from './rapier-body.js';

export class PropColliders {
  private readonly colliders = new Map<number, RAPIER.Collider>();
  private readonly ownerSegment = new Map<number, number>();
  private readonly props = new Map<number, Prop>();
  private active = 0;

  constructor(host: RapierWorld, track: Track) {
    for (const segment of track.segments) {
      for (const prop of segment.props) {
        // Pickups are triggers, never blockers: `PREP:394-428` gives them a
        // collision modifier and no rigid body at all.
        if (prop.kind === 'pickup') continue;
        const collider = host.addStaticBox(prop.position, prop.halfExtent);
        collider.setEnabled(false);
        this.colliders.set(prop.id, collider);
        this.ownerSegment.set(prop.id, segment.index);
        this.props.set(prop.id, prop);
      }
    }
  }

  /** Make `segmentIndex`'s solids the only tangible ones. */
  setActive(segmentIndex: number): void {
    this.active = segmentIndex;
    for (const [id, collider] of this.colliders) {
      collider.setEnabled(this.shouldBeSolid(id));
    }
  }

  /**
   * Re-read the props' `active` flags.
   *
   * Consumption is the simulation's to decide; this follows it. Called when
   * something may have been taken, not every frame for every prop.
   */
  sync(): void {
    this.setActive(this.active);
  }

  has(propId: number): boolean {
    return this.colliders.has(propId);
  }

  /** The props that can currently stop the car, in a stable order. */
  enabledIds(): number[] {
    return [...this.colliders.keys()].filter((id) => this.colliders.get(id)!.isEnabled());
  }

  private shouldBeSolid(id: number): boolean {
    return this.ownerSegment.get(id) === this.active && this.props.get(id)!.active;
  }
}
