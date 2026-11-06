/**
 * When the car is under water.
 *
 * `doMach5:899-925` is a `case effectID` statement. Branch `12:` sets grip 1
 * and drag 0.75 - which the surface table already carries - and **nested
 * inside that branch** is `if mMach5.transform.position.z <= 0 then
 * isUnderWater = 1`, with `gDamage = min(100, gDamage + 0.3)` when
 * `pHasScope = 0`.
 *
 * Both halves are load-bearing. Surface 12 is live on this course - 350
 * triangles reaching z 0.47 down to -20, in segments 9, 10, 13, 15, 16, 28, 30
 * and 31, which are exactly the segments holding the water planes and the
 * oxygen pickups. But **3,590 live triangles across ten surfaces dip below
 * z = 0**, ordinary road among them, so height alone would drown the player on
 * dry asphalt.
 *
 * `race.underwater` has existed since the rules were written and nothing in
 * `src/` ever set it; only the gadget tests did, by hand.
 */
import { describe, it, expect } from 'vitest';
import { World } from '../src/sim/world.js';
import { AnalyticBody } from '../src/sim/analytic-body.js';
import { NO_INPUT, vec3, type GroundHit, type GroundProbe } from '../src/sim/vehicle.js';
import * as K from '../src/sim/constants.js';

/** Ground at a chosen height reporting a chosen surface. */
function groundAt(height: number, effectId: number): GroundProbe {
  return {
    castDown: (from, maxDistance): GroundHit | null => {
      const distance = from.z - height;
      if (distance < 0 || distance > maxDistance) return null;
      return { distance, point: vec3(from.x, from.y, height), effectId };
    },
  };
}

/** A car resting on that ground, after `ticks`. */
function drive(height: number, effectId: number, ticks = 3) {
  const body = new AnalyticBody(K.CHASSIS_MASS, vec3(0, 0, height + K.SPAWN_HEIGHT));
  const world = new World({
    seed: 1,
    body,
    probe: groundAt(height, effectId),
    stepPhysics: (dt) => body.integrate(dt),
  });
  for (let tick = 0; tick < ticks; tick++) world.step(NO_INPUT);
  return world;
}

describe('underwater', () => {
  it('needs the water surface and the height together', () => {
    // Sand underwater, below zero: submerged.
    expect(drive(-3, 12).race.underwater).toBe(true);
  });

  it('is not triggered by road that happens to dip below zero', () => {
    // 3,590 live triangles on this course do exactly that.
    expect(drive(-3, 2).race.underwater).toBe(false);
    expect(drive(-3, 6).race.underwater).toBe(false);
  });

  it('is not triggered by the water surface above the waterline', () => {
    // Surface 12 reaches z 0.47, above zero, and that is not submersion.
    expect(drive(5, 12).race.underwater).toBe(false);
  });

  it('clears again when the car comes back up', () => {
    const body = new AnalyticBody(K.CHASSIS_MASS, vec3(0, 0, -3 + K.SPAWN_HEIGHT));
    let height = -3;
    const world = new World({
      seed: 1,
      body,
      probe: { castDown: (from, max) => groundAt(height, 12).castDown(from, max) },
      stepPhysics: (dt) => body.integrate(dt),
    });
    world.step(NO_INPUT);
    expect(world.race.underwater).toBe(true);

    height = 5;
    body.position = vec3(0, 0, 5 + K.SPAWN_HEIGHT);
    world.step(NO_INPUT);
    expect(world.race.underwater).toBe(false);
  });

  it('drowns a submerged car that has no Frogger', () => {
    // DROWN_DAMAGE has been implemented and unreachable since it was written.
    const world = drive(-3, 12, 10);
    expect(world.race.damage).toBeGreaterThan(0);
  });

  it('does not drown a car driving on sub-zero road', () => {
    expect(drive(-3, 2, 10).race.damage).toBe(0);
  });
});
