/**
 * Four vehicles, each solid against its own segment and no other.
 *
 * The original filtered this **per pair**: `doM5ChangeSegment` and
 * `doEnemyChangeSegment` both call `gHavok.disableCollision(carName,
 * segmentName)` (`MOVIE.ls:171-191`). With one car a global enable is
 * indistinguishable from that, which is why `SegmentColliders` got away with
 * one `active` index. With four cars in four segments it is simply wrong:
 * whichever segment were enabled, three vehicles would have no ground.
 *
 * Rapier's interaction test is conjunctive across both colliders -
 * `(memberships_A & filter_B) && (memberships_B & filter_A)` - so the shared
 * segment collider's FILTER is the per-vehicle selector. Segments carry
 * membership TRACK and a filter holding the bits of the vehicles presently in
 * them; a vehicle carries its own bit and filters TRACK plus every vehicle.
 * The second term then reduces to `VEH_i & filter_S`, which is the whole rule.
 *
 * Colliders are never enabled or disabled after construction.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { initRapier, RapierWorld, RapierChassis } from '../src/physics/rapier-body.js';
import { SegmentColliders } from '../src/physics/segment-colliders.js';
import { flatGroundMesh } from '../src/sim/ground-mesh.js';
import { vec3 } from '../src/sim/vehicle.js';
import * as K from '../src/sim/constants.js';

let rapier: Awaited<ReturnType<typeof initRapier>>;
beforeAll(async () => {
  rapier = await initRapier();
});

/** A chassis dropped onto segment `seg`, belonging to vehicle `v`. */
function dropOn(host: RapierWorld, seg: number, v: number): RapierChassis {
  const y = (seg - 1) * K.SEGMENT_LENGTH + K.SEGMENT_LENGTH / 2;
  return new RapierChassis(rapier, host, vec3(0, y, 3), K.CHASSIS_MASS, v);
}

function settle(host: RapierWorld, ticks = 180): void {
  for (let i = 0; i < ticks; i++) host.step();
}

describe('per-vehicle collision isolation', () => {
  it('holds a vehicle on its own segment and lets another fall through it', () => {
    const host = new RapierWorld(rapier);
    const colliders = new SegmentColliders(host, flatGroundMesh(4));

    // Both bodies sit over segment 2. Only vehicle 0 is filed as being there.
    const y = K.SEGMENT_LENGTH * 1.5;
    const held = new RapierChassis(rapier, host, vec3(-3, y, 3), K.CHASSIS_MASS, 0);
    const falls = new RapierChassis(rapier, host, vec3(3, y, 3), K.CHASSIS_MASS, 1);
    colliders.setActive(2, 0);
    colliders.setActive(4, 1); // vehicle 1 is elsewhere entirely

    settle(host);

    expect(held.position.z).toBeGreaterThan(-1);
    expect(falls.position.z).toBeLessThan(-20);
  });

  it('holds all four vehicles at once, each on a different segment', () => {
    const host = new RapierWorld(rapier);
    const colliders = new SegmentColliders(host, flatGroundMesh(4));

    const cars = [0, 1, 2, 3].map((v) => dropOn(host, v + 1, v));
    cars.forEach((_, v) => colliders.setActive(v + 1, v));

    settle(host);

    for (let v = 0; v < 4; v++) {
      expect(cars[v]!.position.z, `vehicle ${v}`).toBeGreaterThan(-1);
    }
  });

  it('holds two vehicles sharing one segment', () => {
    const host = new RapierWorld(rapier);
    const colliders = new SegmentColliders(host, flatGroundMesh(3));
    const y = K.SEGMENT_LENGTH * 1.5;
    const a = new RapierChassis(rapier, host, vec3(-4, y, 3), K.CHASSIS_MASS, 0);
    const b = new RapierChassis(rapier, host, vec3(4, y, 3), K.CHASSIS_MASS, 1);
    colliders.setActive(2, 0);
    colliders.setActive(2, 1);

    settle(host);

    expect(a.position.z).toBeGreaterThan(-1);
    expect(b.position.z).toBeGreaterThan(-1);
  });

  it('moves a vehicle s solidity with it, leaving the others alone', () => {
    const host = new RapierWorld(rapier);
    const colliders = new SegmentColliders(host, flatGroundMesh(4));
    colliders.setActive(2, 0);
    colliders.setActive(3, 1);

    expect(colliders.isEnabled(2, 0)).toBe(true);
    expect(colliders.isEnabled(3, 0)).toBe(false);
    expect(colliders.isEnabled(3, 1)).toBe(true);
    expect(colliders.isEnabled(2, 1)).toBe(false);

    colliders.setActive(3, 0); // vehicle 0 follows vehicle 1 into segment 3

    expect(colliders.isEnabled(3, 0)).toBe(true);
    expect(colliders.isEnabled(2, 0)).toBe(false);
    // Vehicle 1 is untouched by its neighbour's move.
    expect(colliders.isEnabled(3, 1)).toBe(true);
    expect(colliders.isEnabled(2, 1)).toBe(false);
  });

  it('leaves one vehicle s selection standing when its index is unknown', () => {
    const host = new RapierWorld(rapier);
    const colliders = new SegmentColliders(host, flatGroundMesh(2));
    colliders.setActive(1, 0);
    colliders.setActive(2, 1);

    colliders.setActive(99, 0); // off the end of the mesh

    expect(colliders.isEnabled(1, 0)).toBe(true);
    expect(colliders.isEnabled(2, 1)).toBe(true);
  });

  it('never enables or disables a collider after construction', () => {
    const host = new RapierWorld(rapier);
    const colliders = new SegmentColliders(host, flatGroundMesh(6));

    for (let i = 0; i < 100; i++) {
      colliders.setActive((i % 6) + 1, i % 4);
    }

    for (let s = 1; s <= 6; s++) {
      expect(colliders.isColliderEnabled(s), `segment ${s}`).toBe(true);
    }
  });

  it('still lets two vehicles collide with each other across segments', () => {
    const host = new RapierWorld(rapier);
    const colliders = new SegmentColliders(host, flatGroundMesh(4));
    // Both near the seam between 1 and 2, but filed under different segments.
    const y = K.SEGMENT_LENGTH;
    const a = new RapierChassis(rapier, host, vec3(0, y - 2, 1), K.CHASSIS_MASS, 0);
    const b = new RapierChassis(rapier, host, vec3(0, y + 2, 1), K.CHASSIS_MASS, 1);
    colliders.setActive(1, 0);
    colliders.setActive(2, 1);

    a.applyImpulse(vec3(0, K.CHASSIS_MASS * 20, 0));
    b.applyImpulse(vec3(0, -K.CHASSIS_MASS * 20, 0));
    for (let i = 0; i < 60; i++) host.step();

    // They met and pushed each other back, so neither passed through.
    expect(a.position.y).toBeLessThan(b.position.y);
    expect(b.position.y - a.position.y).toBeGreaterThan(0.5);
  });
});
