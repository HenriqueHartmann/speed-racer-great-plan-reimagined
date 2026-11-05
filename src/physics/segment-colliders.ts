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
 */

import type * as RAPIER from '@dimforge/rapier3d-compat';
import type { GroundMesh } from '../sim/ground-mesh.js';
import type { RapierWorld } from './rapier-body.js';

export class SegmentColliders {
  private readonly colliders: RAPIER.Collider[] = [];
  private active = 0;

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
      collider.setEnabled(false);
      this.colliders.push(collider);
    }
  }

  /** Make `segmentIndex` the solid one. 1-based, as the segments are. */
  setActive(segmentIndex: number): void {
    const next = this.colliders[segmentIndex - 1];
    // An index the mesh does not have leaves the last good segment standing.
    // Going dark instead would drop the car through the world.
    if (!next) return;
    this.colliders[this.active - 1]?.setEnabled(false);
    next.setEnabled(true);
    this.active = segmentIndex;
  }

  isEnabled(segmentIndex: number): boolean {
    return this.colliders[segmentIndex - 1]?.isEnabled() ?? false;
  }
}
