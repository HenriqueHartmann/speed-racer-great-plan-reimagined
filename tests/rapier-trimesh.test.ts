/**
 * The track as a physical surface, one segment at a time.
 *
 * The hover ray holds the car up; this collider is the backstop for when the
 * suspension cannot - a hard landing, a Jacks launch. The original had one:
 * `PREP:381` makes every SEG_ mesh a fixed rigid body with friction and
 * restitution zero, and `doM5ChangeSegment` (`MOVIE.ls:135-136`) disables the
 * old segment's collision and enables the new one's, so exactly one is live.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { initRapier, RapierWorld } from '../src/physics/rapier-body.js';
import { flatGroundMesh } from '../src/sim/ground-mesh.js';
import * as K from '../src/sim/constants.js';

let rapier: Awaited<ReturnType<typeof initRapier>>;
beforeAll(async () => {
  rapier = await initRapier();
});

/** Drop a dynamic ball from `height` for `ticks` and report where it ends up. */
function dropOnto(enabled: boolean): number {
  const host = new RapierWorld(rapier);
  const ground = flatGroundMesh(1, 50, 1);
  const collider = host.addTrimesh(ground.positions, ground.indices);
  collider.setEnabled(enabled);

  const body = host.world.createRigidBody(
    rapier.RigidBodyDesc.dynamic().setTranslation(0, 150, 5),
  );
  host.world.createCollider(rapier.ColliderDesc.ball(0.5), body);
  host.track(body);

  for (let tick = 0; tick < 120; tick++) host.step();
  return body.translation().z;
}

describe('the track collider', () => {
  it('stops a falling body', () => {
    // Resting on a ball of radius 0.5 sitting on z = 0.
    expect(dropOnto(true)).toBeGreaterThan(0.2);
    expect(dropOnto(true)).toBeLessThan(1);
  });

  it('lets a body through once disabled', () => {
    // This is how a segment stops being collidable: the same asymmetry the
    // original had, where the hover ray sees two segments and the collider
    // only ever one.
    expect(dropOnto(false)).toBeLessThan(-5);
  });

  it('is frictionless and does not bounce, as PREP:381 sets it', () => {
    const host = new RapierWorld(rapier);
    const ground = flatGroundMesh(1, 50, 1);
    const collider = host.addTrimesh(ground.positions, ground.indices);
    expect(collider.friction()).toBe(0);
    expect(collider.restitution()).toBe(0);
    void K.SEGMENT_LENGTH;
  });
});
