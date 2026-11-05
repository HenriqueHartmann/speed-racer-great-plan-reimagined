/**
 * Is Rapier deterministic enough to carry a replay?
 *
 * This is the question the spike exists to answer. Rapier's documentation
 * describes cross-platform determinism under stated conditions; this file does
 * not test that claim. It tests the far weaker and far more immediately useful
 * property: on this machine, in this process, does the same recorded input
 * produce the same result twice?
 *
 * If it does not, Rapier cannot back a replay test and the architecture has to
 * change. That is a go/no-go, and it is better answered by a test than by
 * reading a README.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import {
  initRapier,
  RapierWorld,
  RapierChassis,
  RapierGround,
} from '../src/physics/rapier-body.js';
import { World } from '../src/sim/world.js';
import { vec3, type VehicleInput } from '../src/sim/vehicle.js';
import * as K from '../src/sim/constants.js';

const TICKS = 600;
const SEED = 0x5eed_1234;

function inputAt(tick: number): VehicleInput {
  return {
    forward: tick % 240 < 200,
    backward: tick % 600 >= 560,
    left: tick % 300 >= 60 && tick % 300 < 140,
    right: tick % 300 >= 200 && tick % 300 < 260,
    jacks: tick % 450 === 0,
  };
}

let rapier: Awaited<ReturnType<typeof initRapier>>;

beforeAll(async () => {
  rapier = await initRapier();
}, 60_000);

function runRapierRace(renderEvery: number) {
  const host = new RapierWorld(rapier);
  host.addGroundPlane();

  const chassis = new RapierChassis(rapier, host, vec3(0, 0, K.SPAWN_HEIGHT));
  const ground = new RapierGround(rapier, host, chassis);

  const world = new World({
    seed: SEED,
    body: chassis,
    probe: ground,
    stepPhysics: () => host.step(),
  });

  const snapshots = [];
  let sinceRender = 0;
  for (let t = 0; t < TICKS; t++) {
    world.step(inputAt(t));
    if (++sinceRender >= renderEvery) {
      sinceRender = 0;
      void world.snapshot().position; // what a renderer does: read only
    }
    if (t % 60 === 0) snapshots.push(world.snapshot());
  }

  const final = world.snapshot();
  const events = world.events;
  host.free();
  return { snapshots, events, final };
}

describe('Rapier backend', () => {
  it('loads and steps without error', () => {
    const run = runRapierRace(1);
    expect(run.final.tick).toBe(TICKS);
  });

  it('actually simulates - the car moves and leaves the start', () => {
    const run = runRapierRace(1);
    expect(Math.abs(run.final.position[1])).toBeGreaterThan(0.5);
  });

  it('goal 1 - two identical runs agree exactly', () => {
    const a = runRapierRace(1);
    const b = runRapierRace(1);
    expect(a.snapshots).toEqual(b.snapshots);
    expect(a.events).toEqual(b.events);
    expect(a.final).toEqual(b.final);
  });

  it('goal 2 - render cadence does not change the simulation', () => {
    const baseline = runRapierRace(1);
    for (const every of [2, 7, 31, TICKS + 1]) {
      const run = runRapierRace(every);
      expect(run.snapshots).toEqual(baseline.snapshots);
      expect(run.events).toEqual(baseline.events);
    }
  });

  it('does not steer itself while standing still', () => {
    // A stiff explicit suspension against too little rotational inertia makes
    // the chassis rock, and the rocking couples into a steady yaw: the car
    // turns on its own. This was real - 39 degrees of drift over ten seconds -
    // and is what CHASSIS_INERTIA_MULTIPLIER exists to prevent.
    const host = new RapierWorld(rapier);
    host.addGroundPlane();
    const chassis = new RapierChassis(rapier, host, vec3(0, 0, K.SPAWN_HEIGHT));
    const world = new World({
      seed: SEED,
      body: chassis,
      probe: new RapierGround(rapier, host, chassis),
      stepPhysics: () => host.step(),
    });

    for (let t = 0; t < 300; t++) {
      world.step({
        forward: false,
        backward: false,
        left: false,
        right: false,
        jacks: false,
      });
    }

    const f = chassis.forward;
    const yawDeg = Math.abs((Math.atan2(-f.x, f.y) * 180) / Math.PI);
    expect(yawDeg).toBeLessThan(1);
    // And it should still be sitting on the ground, not have bounced away.
    expect(chassis.position.z).toBeGreaterThan(0);
    expect(chassis.position.z).toBeLessThan(K.HOVER_DISTANCE * 2);
    host.free();
  });

  it('keeps the chassis hovering rather than resting on the collider', () => {
    const run = runRapierRace(1);
    // The suspension should hold the body near its rest height, not let it sink.
    expect(run.final.position[2]).toBeGreaterThan(0);
    expect(run.final.position[2]).toBeLessThan(K.HOVER_DISTANCE * 6);
  });
});
