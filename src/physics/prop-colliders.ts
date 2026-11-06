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
import { trackGroups, vehicleBit } from './interaction-groups.js';

export class PropColliders {
  private readonly colliders = new Map<number, RAPIER.Collider>();
  private readonly ownerSegment = new Map<number, number>();
  private readonly props = new Map<number, Prop>();
  /** Per prop, the bits of the vehicles it is currently tangible to. */
  private readonly masks = new Map<number, number>();
  /** Vehicles whose saw is up, and which may therefore drive through trees. */
  private readonly bladed = new Set<number>();
  /** Per vehicle, the segment whose solids are tangible to it. */
  private readonly active = new Map<number, number>();

  constructor(host: RapierWorld, track: Track) {
    for (const segment of track.segments) {
      for (const prop of segment.props) {
        // Pickups are triggers, never blockers: `PREP:394-428` gives them a
        // collision modifier and no rigid body at all.
        if (prop.kind === 'pickup') continue;
        const collider = host.addStaticBox(prop.position, prop.halfExtent);
        // Tangible to nobody yet. As with the segment meshes, solidity is a
        // filter from here on and the collider is never switched off.
        collider.setCollisionGroups(trackGroups(0));
        this.colliders.set(prop.id, collider);
        this.ownerSegment.set(prop.id, segment.index);
        this.props.set(prop.id, prop);
      }
    }
  }

  /**
   * Raise or lower a vehicle's saw, which decides whether trees stop it.
   *
   * RECOVERED, and per pair in the original too: `doMach5:351-356` runs
   * `gHavok.disableCollision(pCarBody.name, SEG_TRE[gSEG][i].name)` over the
   * segment's trees when the Blades go up, naming the car, and
   * `enableCollision` over the same list when they come down. So a tree goes
   * intangible to the MACH 5 and stays solid for everybody else - which is
   * what the per-vehicle filters already express.
   *
   * The other half of that pair of lines, `collision.enabled = 1`, is the
   * chop trigger, and it lives in the simulation rather than here.
   */
  setBladesActive(vehicle: number, active: boolean): void {
    const had = this.bladed.has(vehicle);
    if (had === active) return;
    if (active) this.bladed.add(vehicle);
    else this.bladed.delete(vehicle);
    this.refresh();
  }

  /** Make `segmentIndex`'s solids the only ones tangible to `vehicle`. */
  setActive(segmentIndex: number, vehicle = 0): void {
    this.active.set(vehicle, segmentIndex);
    this.refresh();
  }

  /**
   * Re-read the props' `active` flags.
   *
   * Consumption is the simulation's to decide; this follows it. Called when
   * something may have been taken, not every frame for every prop.
   */
  sync(): void {
    this.refresh();
  }

  has(propId: number): boolean {
    return this.colliders.has(propId);
  }

  /** The props that can currently stop that vehicle, in a stable order. */
  enabledIds(vehicle = 0): number[] {
    const bit = vehicleBit(vehicle);
    return [...this.colliders.keys()].filter((id) => (this.masks.get(id)! & bit) !== 0);
  }

  /** Rewrite every prop's filter from the per-vehicle active segments. */
  private refresh(): void {
    for (const [id, collider] of this.colliders) {
      let mask = 0;
      if (this.props.get(id)!.active) {
        const owner = this.ownerSegment.get(id)!;
        const isTree = this.props.get(id)!.kind === 'tree';
        for (const [vehicle, segment] of this.active) {
          if (segment !== owner) continue;
          if (isTree && this.bladed.has(vehicle)) continue;
          mask |= vehicleBit(vehicle);
        }
      }
      this.masks.set(id, mask);
      collider.setCollisionGroups(trackGroups(mask));
    }
  }
}
