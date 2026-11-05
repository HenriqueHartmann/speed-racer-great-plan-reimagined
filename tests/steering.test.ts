/**
 * Which way the car turns, forward and in reverse.
 *
 * `doMach5` steers in two branches, not one. Going forward (`forwardVel >= 0`,
 * line 690) holding right applies a yaw impulse of `-mass * pct * pTurnBuild`.
 * Backing up (line 713) holding right applies `+mass * pct * pTurnBuild` - the
 * same key, the opposite sign - and the ramp fills far faster, `min(1, build +
 * 0.2)` against the forward `min(0.75, build + 0.009)`.
 *
 * Reversing also has two gates the forward case does not: at least one wheel
 * must be on the ground, and the forward key must not be held.
 */
import { describe, it, expect } from 'vitest';
import { World } from '../src/sim/world.js';
import { AnalyticBody, FlatGround } from '../src/sim/analytic-body.js';
import { NO_INPUT, type VehicleInput } from '../src/sim/vehicle.js';

function world(): { world: World; body: AnalyticBody } {
  const body = new AnalyticBody();
  return {
    body,
    world: new World({
      seed: 1,
      body,
      probe: new FlatGround(),
      stepPhysics: (dt) => body.integrate(dt),
    }),
  };
}

/** Settle on the ground, build speed in one direction, then hold a steer. */
function yawAfterSteering(drive: 'forward' | 'backward', steer: 'left' | 'right'): number {
  const { world: w, body } = world();
  const roll: VehicleInput = { ...NO_INPUT, [drive]: true };

  for (let tick = 0; tick < 120; tick++) w.step(roll);

  const before = body.angularVelocity.z;
  const turn: VehicleInput = { ...roll, [steer]: true };
  for (let tick = 0; tick < 30; tick++) w.step(turn);

  return body.angularVelocity.z - before;
}

describe('steering', () => {
  it('turns the two ways round going forward', () => {
    expect(yawAfterSteering('forward', 'right')).toBeLessThan(0);
    expect(yawAfterSteering('forward', 'left')).toBeGreaterThan(0);
  });

  it('reverses the yaw when the car is reversing', () => {
    // The whole of the user-visible bug: holding the same key must swing the
    // car the other way when it is going backwards.
    const forwardRight = yawAfterSteering('forward', 'right');
    const reverseRight = yawAfterSteering('backward', 'right');
    expect(Math.sign(reverseRight)).toBe(-Math.sign(forwardRight));

    const forwardLeft = yawAfterSteering('forward', 'left');
    const reverseLeft = yawAfterSteering('backward', 'left');
    expect(Math.sign(reverseLeft)).toBe(-Math.sign(forwardLeft));
  });

  it('does not steer in reverse while the forward key is held', () => {
    // `doMach5` 713 gates the reverse branch on `kForwardIsDown = 0`.
    //
    // The gate only has to hold while the car is still going backwards: the
    // forward key is also throttle, so it drags `forwardVel` up through zero
    // and the forward branch then takes over, correctly.
    const { world: w, body } = world();
    for (let tick = 0; tick < 120; tick++) w.step({ ...NO_INPUT, backward: true });
    expect(w.vehicle.forwardVel).toBeLessThan(0);

    // `forwardVel` is sampled once at the top of each step and not written
    // again, so reading it *after* a step gives the value that step's gate
    // actually saw. Reading it before would test the previous tick's branch.
    let reversingTicks = 0;
    for (let tick = 0; tick < 30; tick++) {
      const before = Math.abs(body.angularVelocity.z);
      w.step({ ...NO_INPUT, backward: true, forward: true, right: true });
      if (w.vehicle.forwardVel >= 0) break; // that step took the forward branch
      expect(Math.abs(body.angularVelocity.z)).toBeLessThanOrEqual(before + 1e-9);
      reversingTicks++;
    }
    expect(reversingTicks).toBeGreaterThan(0);
  });
});
