/**
 * Putting the car back on the road after it leaves it.
 *
 * The original ends the run instead: `doMach5:675` fades the music and does
 * `go("CLIFF")`, a game-over frame. There is no in-place recovery to port, so
 * what this provides is the restart that frame leads to - and the thing that
 * made it necessary is that driving off the real course used to leave the game
 * with no way back except reloading the page.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { initRapier, RapierWorld, RapierChassis } from '../src/physics/rapier-body.js';
import { vec3 } from '../src/sim/vehicle.js';
import * as K from '../src/sim/constants.js';

let rapier: Awaited<ReturnType<typeof initRapier>>;
beforeAll(async () => {
  rapier = await initRapier();
});

/** A chassis that has been thrown about and is nowhere near upright. */
function tumbling(): { host: RapierWorld; chassis: RapierChassis } {
  const host = new RapierWorld(rapier);
  const chassis = new RapierChassis(rapier, host, vec3(0, 0, 50));
  // Set the state outright rather than pushing and hoping: what respawn has to
  // clear is whatever state exists, and a test that first has to achieve a
  // tumble is testing Rapier's damping instead.
  chassis.linearVelocity = vec3(12, -30, -45);
  chassis.angularVelocity = vec3(2.5, 1.8, 3.1);
  for (let tick = 0; tick < 20; tick++) host.step();
  return { host, chassis };
}

describe('respawn', () => {
  it('starts from a car that is genuinely out of control', () => {
    const { chassis } = tumbling();
    expect(chassis.position.z).toBeLessThan(40);
    expect(Math.hypot(chassis.angularVelocity.x, chassis.angularVelocity.y)).toBeGreaterThan(0.5);
    expect(Math.abs(chassis.rollDeg) + Math.abs(chassis.pitchDeg)).toBeGreaterThan(5);
  });

  it('puts the car back at a given point, still and upright', () => {
    const { chassis } = tumbling();
    chassis.respawn(vec3(41.98, 38.83, 13.9));

    expect(chassis.position.x).toBeCloseTo(41.98, 4);
    expect(chassis.position.y).toBeCloseTo(38.83, 4);
    expect(chassis.position.z).toBeCloseTo(13.9, 4);

    expect(chassis.linearVelocity.x).toBeCloseTo(0, 6);
    expect(chassis.linearVelocity.y).toBeCloseTo(0, 6);
    expect(chassis.linearVelocity.z).toBeCloseTo(0, 6);
    expect(chassis.angularVelocity.z).toBeCloseTo(0, 6);

    // Upright and facing +Y, as it spawned.
    expect(chassis.up.z).toBeCloseTo(1, 5);
    expect(chassis.forward.y).toBeCloseTo(1, 5);
    expect(chassis.pitchDeg).toBeCloseTo(0, 4);
    expect(chassis.rollDeg).toBeCloseTo(0, 4);
  });

  it('leaves no momentum to carry into the next tick', () => {
    const { host, chassis } = tumbling();
    chassis.respawn(vec3(0, 0, K.SPAWN_HEIGHT));
    host.step();
    // Only gravity has acted, so it is falling and nothing else.
    expect(Math.abs(chassis.linearVelocity.x)).toBeLessThan(1e-6);
    expect(Math.abs(chassis.linearVelocity.y)).toBeLessThan(1e-6);
    expect(chassis.linearVelocity.z).toBeLessThan(0);
  });
});
