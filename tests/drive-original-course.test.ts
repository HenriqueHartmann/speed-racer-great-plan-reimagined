/**
 * The car drives the course the game shipped.
 *
 * Everything below the renderer, end to end: the decoded ground data, the
 * triangle probe, the Rapier chassis and the per-segment colliders. If this
 * passes, what remains between it and a playable level is drawing.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { initRapier, RapierWorld, RapierChassis } from '../src/physics/rapier-body.js';
import { SegmentColliders } from '../src/physics/segment-colliders.js';
import { parseGroundMesh } from '../src/sim/ground-mesh.js';
import { Track } from '../src/sim/track.js';
import { World } from '../src/sim/world.js';
import { NO_INPUT, vec3, type VehicleInput } from '../src/sim/vehicle.js';
import * as K from '../src/sim/constants.js';

const DRIVE: VehicleInput = { ...NO_INPUT, forward: true };

let rapier: Awaited<ReturnType<typeof initRapier>>;
beforeAll(async () => {
  rapier = await initRapier();
});

/** The whole stack, started at the original's own start line. */
function startTheRace() {
  const ground = parseGroundMesh(readFileSync('public/models/track-ground.bin'));
  const track = new Track({ ground });
  const host = new RapierWorld(rapier);
  const colliders = new SegmentColliders(host, ground);
  colliders.setActive(1);

  const road = track.castDown(vec3(ground.spawn.x, ground.spawn.y, ground.spawn.z), 60);
  const start = vec3(
    ground.spawn.x,
    ground.spawn.y,
    (road ? ground.spawn.z - road.distance : ground.spawn.z) + K.SPAWN_HEIGHT,
  );
  const chassis = new RapierChassis(rapier, host, start);
  const world = new World({
    seed: 0x5eed_1234,
    body: chassis,
    probe: track,
    track,
    stepPhysics: () => host.step(),
  });
  return { world, chassis, colliders, ground, road };
}

describe('the original course', () => {
  it('puts the start line on the road', () => {
    const { road } = startTheRace();
    expect(road).not.toBeNull();
    // carPos_Mach5 sits above the road, and prepareCar:145 drops onto it from
    // there with a 2-unit ray. Ours reaches further, but the road must be
    // close enough that the recovered node means what we think it means.
    expect(road!.distance).toBeLessThan(5);
  });

  it('has all four wheels on the ground at the start line', () => {
    const { world } = startTheRace();
    world.step(NO_INPUT);
    expect(world.vehicle.grounded).toEqual([true, true, true, true]);
  });

  it('reports a recovered surface rather than the no-ground sentinel', () => {
    const { world } = startTheRace();
    world.step(NO_INPUT);
    expect(world.vehicle.effectId).not.toBe(K.NO_GROUND_EFFECT_ID);
    expect(world.vehicle.effectId).toBeGreaterThanOrEqual(1);
    expect(world.vehicle.effectId).toBeLessThanOrEqual(16);
  });

  it('stays on the road along the straight that starts the course', () => {
    // The course is a corridor about 18 units wide. It runs straight at
    // x 37..54 for the first 130 units and then bends right, reaching
    // x 109..127 by y 290 - so holding the throttle with no steering leaves
    // it, and that is the road's doing, not the car's.
    const { world, colliders } = startTheRace();
    let grounded = 0;
    for (let tick = 0; tick < 60; tick++) {
      world.step(DRIVE);
      if (world.race.segment !== 0) colliders.setActive(world.race.segment);
      if (world.vehicle.powerCoeff > 0) grounded++;
    }

    expect(world.race.outcome).toBe('running');
    expect(world.vehicle.forwardVel).toBeGreaterThan(40);
    // A wheel may skip over a joint in the mesh; most ticks must be planted.
    expect(grounded).toBeGreaterThan(50);
  });

  it('runs the real course identically twice', () => {
    // The replay suite proves determinism on a flat plane. The track is
    // 20,276 triangles scanned by index, and the probe is the one thing in
    // the loop that reads them, so it is the part that could quietly stop
    // being reproducible.
    const run = () => {
      const { world, colliders } = startTheRace();
      const trace: string[] = [];
      for (let tick = 0; tick < 200; tick++) {
        world.step(DRIVE);
        if (world.race.segment !== 0) colliders.setActive(world.race.segment);
        if (tick % 10 === 0) {
          trace.push(JSON.stringify(world.snapshot()));
        }
      }
      return trace;
    };
    expect(run()).toEqual(run());
  });

  it('ends the run when the car drives off the course', () => {
    // The fall rule has been in the simulation since the slice course and was
    // unreachable there, because that course was flat at z = 0. On real
    // geometry it finally means something: drive straight into the first bend
    // and the car leaves the road and the run ends.
    const { world, colliders } = startTheRace();
    for (let tick = 0; tick < 300; tick++) {
      world.step(DRIVE);
      if (world.race.segment !== 0) colliders.setActive(world.race.segment);
      if (world.race.outcome !== 'running') break;
    }

    expect(world.race.outcome).toBe('fell');
    expect(world.vehicle.effectId).toBe(K.NO_GROUND_EFFECT_ID);
    expect(world.events.some((e) => e.kind === 'fell')).toBe(true);
  });
});
