/**
 * One solid segment of track at a time, as `doM5ChangeSegment` kept it.
 *
 * `PREP:381` makes every `SEG_` model a fixed rigid body; `MOVIE.ls:135-136`
 * then disables the old segment's collision against the car and enables the
 * new one's, in that order, so exactly one is solid.
 *
 * The neighbour is never enabled, not even at a seam. That asymmetry is not an
 * oversight to smooth away: the hover ray consults two segments within 2 units
 * of a boundary while the collider stays at one, and it is what let a prop
 * overhang a seam without snagging the car.
 *
 * "One at a time" is **per vehicle**, because the original's call names the car
 * - `disableCollision(tCar.name, SEG_TRK[i].name)`. Every collider here is
 * built enabled and stays enabled for good; which vehicles a segment is solid
 * for lives in its interaction filter. See `interaction-groups.ts` for why one
 * shared collider can answer differently for different vehicles.
 */

import type * as RAPIER from '@dimforge/rapier3d-compat';
import type { GroundMesh } from '../sim/ground-mesh.js';
import type { RapierWorld } from './rapier-body.js';
import { trackGroups, vehicleBit } from './interaction-groups.js';

export class SegmentColliders {
  private readonly colliders: RAPIER.Collider[] = [];
  /** Per segment, the bits of the vehicles it is currently solid for. */
  private readonly occupants: number[] = [];
  /** Per vehicle, the segment it was last filed under. */
  private readonly active = new Map<number, number>();

  constructor(host: RapierWorld, ground: GroundMesh) {
    for (let s = 0; s < ground.segmentCount; s++) {
      const first = ground.segmentStart[s]!;
      const last = ground.segmentEnd[s]!;
      const count = last - first;

      // Rapier wants a self-contained mesh, so each segment's triangles are
      // copied out with their own compact vertex numbering.
      const positions = new Float32Array(count * 9);
      const indices = new Uint32Array(count * 3);
      for (let t = 0; t < count; t++) {
        for (let c = 0; c < 3; c++) {
          const v = ground.indices[(first + t) * 3 + c]! * 3;
          const out = (t * 3 + c) * 3;
          positions[out] = ground.positions[v]!;
          positions[out + 1] = ground.positions[v + 1]!;
          positions[out + 2] = ground.positions[v + 2]!;
          indices[t * 3 + c] = t * 3 + c;
        }
      }

      const collider = host.addTrimesh(positions, indices);
      // Solid for nobody yet, but never switched off again.
      collider.setCollisionGroups(trackGroups(0));
      this.colliders.push(collider);
      this.occupants.push(0);
    }
  }

  /**
   * Make `segmentIndex` the solid one for `vehicle`. 1-based, as segments are.
   *
   * The old segment is cleared before the new one is set, which is the order
   * `MOVIE.ls:135-136` uses. Other vehicles are untouched.
   */
  setActive(segmentIndex: number, vehicle = 0): void {
    // An index the mesh does not have leaves this vehicle's last good segment
    // standing. Going dark instead would drop it through the world.
    if (!this.colliders[segmentIndex - 1]) return;

    const bit = vehicleBit(vehicle);
    const previous = this.active.get(vehicle);
    if (previous !== undefined) this.setOccupants(previous, this.occupants[previous - 1]! & ~bit);
    this.setOccupants(segmentIndex, this.occupants[segmentIndex - 1]! | bit);
    this.active.set(vehicle, segmentIndex);
  }

  /** Whether this segment can currently stop that vehicle. */
  isEnabled(segmentIndex: number, vehicle = 0): boolean {
    const mask = this.occupants[segmentIndex - 1];
    return mask === undefined ? false : (mask & vehicleBit(vehicle)) !== 0;
  }

  /**
   * Whether the collider object itself is live in the physics world.
   *
   * Always true after construction, and asserted to stay so: solidity is a
   * filter here, never an enable. Separate from `isEnabled`, which answers the
   * question the simulation actually asks.
   */
  isColliderEnabled(segmentIndex: number): boolean {
    return this.colliders[segmentIndex - 1]?.isEnabled() ?? false;
  }

  private setOccupants(segmentIndex: number, mask: number): void {
    this.occupants[segmentIndex - 1] = mask;
    this.colliders[segmentIndex - 1]!.setCollisionGroups(trackGroups(mask));
  }
}
