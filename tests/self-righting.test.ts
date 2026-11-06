/**
 * The car gets back on its wheels.
 *
 * `doMach5:781-800` does this in two halves and we had only one. The half we
 * had damps the spin: beyond 30 degrees on either axis with a wheel off the
 * ground, `angularVelocity *= 0.1` and an impulse of `-angularmomentum * 0.5`.
 * That stops a car tumbling. It never turns one back over, so a car resting on
 * its side with no spin left stayed there - which is exactly what play found.
 *
 * The missing half is a Havok angular dashpot, `makeAngularDashpot
 * ("m5Corrector")`, a constraint that drives the chassis toward a target
 * rotation with `strength = mass * max(|RotX|, |RotY|) / 90` and heavy
 * damping, created while `pPowerCoeff < 1` and `|RotX| > 80` or `|RotY| > 45`,
 * and deleted the moment that stops being true.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { initRapier, RapierWorld, RapierChassis } from '../src/physics/rapier-body.js';
import { World } from '../src/sim/world.js';
import { FlatGround } from '../src/sim/analytic-body.js';
import { NO_INPUT, vec3 } from '../src/sim/vehicle.js';
import { readFileSync } from 'node:fs';
import { SegmentColliders } from '../src/physics/segment-colliders.js';
import { parseGroundMesh } from '../src/sim/ground-mesh.js';
import { Track, segmentIndexFor } from '../src/sim/track.js';
import * as K from '../src/sim/constants.js';

let rapier: Awaited<ReturnType<typeof initRapier>>;
beforeAll(async () => {
  rapier = await initRapier();
});

/** A car dropped onto flat ground lying on its side. */
function onItsSide(rollDeg = 90) {
  const host = new RapierWorld(rapier);
  // A real floor, not only the hover probe: a car on its side is resting on
  // the ground, and without a collider it falls through and the run ends.
  host.addGroundPlane();
  const chassis = new RapierChassis(rapier, host, vec3(0, 0, K.SPAWN_HEIGHT));
  const half = (rollDeg * Math.PI) / 360;
  // Roll about the car's own forward axis, which is +Y.
  chassis.setRotation({ x: 0, y: Math.sin(half), z: 0, w: Math.cos(half) });
  const world = new World({
    seed: 1,
    body: chassis,
    probe: new FlatGround(),
    stepPhysics: () => host.step(),
  });
  return { world, chassis };
}

describe('self-righting', () => {
  it('starts from a car that really is on its side', () => {
    const { chassis } = onItsSide();
    expect(Math.abs(chassis.rollDeg)).toBeGreaterThan(K.RIGHTING_ROLL_DEG);
  });

  it('turns a car on its side back onto its wheels', () => {
    const { world, chassis } = onItsSide();
    for (let tick = 0; tick < 300; tick++) world.step(NO_INPUT);

    expect(Math.abs(chassis.rollDeg)).toBeLessThan(K.RIGHTING_ROLL_DEG);
    expect(chassis.up.z).toBeGreaterThan(0.5);
  });

  it('lets go once the car is upright and on all four wheels', () => {
    // The original deletes the dashpot the moment the condition clears, so a
    // car that has landed is not still being pushed at.
    const { world, chassis } = onItsSide();
    for (let tick = 0; tick < 500; tick++) world.step(NO_INPUT);

    // It stays up. The few degrees it still moves through are the suspension
    // settling - four springs on a stiff explicit integrator never go quite
    // still - and they are far under the threshold that would re-engage the
    // corrector, which is the thing being tested.
    expect(Math.abs(chassis.rollDeg)).toBeLessThan(K.RIGHTING_ROLL_DEG);
    expect(Math.abs(chassis.pitchDeg)).toBeLessThan(K.RIGHTING_PITCH_DEG);
    expect(world.vehicle.powerCoeff).toBeGreaterThan(0);
  });

  it('does not right a car that is merely tilted on a slope', () => {
    // 20 degrees of roll is under both thresholds; a banked corner must not
    // fight the suspension.
    const { world, chassis } = onItsSide(20);
    const before = chassis.rollDeg;
    world.step(NO_INPUT);
    expect(Math.abs(chassis.rollDeg - before)).toBeLessThan(5);
  });
});

describe('righting from a nose-stand', () => {
  /**
   * The case play reported: the car plants itself on its nose and comes back
   * "very slowly". It took 22 seconds.
   *
   * The cause was a gap between two recovered rules. `doMach5:797` cuts
   * angular velocity to a tenth every tick beyond 30 degrees; `doMach5:784`
   * engages the corrector only beyond 80 in pitch. Between the two the car
   * was braked hard with nothing pushing it back, and only gravity brought it
   * down. See `RIGHTING_ENGAGE_DEG`.
   */
  function tipAndTime(quat: { x: number; y: number; z: number; w: number }): number {
    const ground = parseGroundMesh(readFileSync('public/models/track-ground.bin'));
    const track = new Track({ ground });
    const host = new RapierWorld(rapier);
    const colliders = new SegmentColliders(host, ground);
    colliders.setActive(segmentIndexFor(ground.spawn.y));
    const road = track.castDown(vec3(ground.spawn.x, ground.spawn.y, ground.spawn.z), 60);
    const z = road ? ground.spawn.z - road.distance : ground.spawn.z;
    const chassis = new RapierChassis(rapier, host, vec3(ground.spawn.x, ground.spawn.y, z + 2));
    chassis.setRotation(quat);
    const world = new World({
      seed: 1, body: chassis, probe: track, track, stepPhysics: () => host.step(),
    });
    for (let tick = 0; tick < 2000; tick++) {
      world.step(NO_INPUT);
      colliders.setActive(segmentIndexFor(chassis.position.y));
      if (Math.abs(chassis.pitchDeg) < 15 && Math.abs(chassis.rollDeg) < 15
        && world.vehicle.powerCoeff >= 1) {
        return tick;
      }
    }
    return -1;
  }

  const aboutX = (deg: number) => {
    const half = (deg * Math.PI) / 360;
    return { x: Math.sin(half), y: 0, z: 0, w: Math.cos(half) };
  };
  const aboutY = (deg: number) => {
    const half = (deg * Math.PI) / 360;
    return { x: 0, y: Math.sin(half), z: 0, w: Math.cos(half) };
  };

  it('comes off its nose in a couple of seconds, not twenty', () => {
    const ticks = tipAndTime(aboutX(90));
    expect(ticks).toBeGreaterThan(0);
    expect(ticks * K.TICK_DT).toBeLessThan(3);
  });

  it('comes back from the middle of the band the damping covers', () => {
    // 75 degrees is below the original dashpot's 80 and well above the
    // damping's 30 - the dead band, and where the car used to strand.
    const ticks = tipAndTime(aboutX(75));
    expect(ticks).toBeGreaterThan(0);
    expect(ticks * K.TICK_DT).toBeLessThan(3);
  });

  it('still comes off its side at least as fast as it ever did', () => {
    const ticks = tipAndTime(aboutY(90));
    expect(ticks).toBeGreaterThan(0);
    expect(ticks * K.TICK_DT).toBeLessThan(3);
  });
});
