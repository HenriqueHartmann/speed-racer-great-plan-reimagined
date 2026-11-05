/**
 * Which wheel decides the surface the car is driving on.
 *
 * `doMach5` writes `pTrackFace` in exactly one place, `if i = 4` inside the
 * wheel loop (line 452). Index 4 is `posD`, and the list is built as
 *
 *   pLocalRight = pLocalDown.cross(pLocalForward)        -> (1, 0, 0)
 *   posD = com - pBackWheelBase * forward + pwidth * 0.5 * -pLocalRight
 *
 * so index 4 is the **rear left** wheel. Our `WHEEL_LOCAL_POINTS` is ordered
 * [FL, FR, RL, RR], which puts the rear left at index 2.
 *
 * On a strip that reports one surface everywhere this cannot be observed, which
 * is why it survived until a course with grass down one side arrived.
 */
import { describe, it, expect } from 'vitest';
import { World } from '../src/sim/world.js';
import { AnalyticBody } from '../src/sim/analytic-body.js';
import {
  NO_INPUT,
  WHEEL_LOCAL_POINTS,
  vec3,
  type GroundHit,
  type GroundProbe,
  type Vec3,
} from '../src/sim/vehicle.js';
import * as K from '../src/sim/constants.js';

/** Flat ground at z = 0 whose reported surface is a function of the ray origin. */
class PatchedGround implements GroundProbe {
  constructor(private readonly idAt: (from: Vec3) => number | null) {}

  castDown(from: Vec3, maxDistance: number): GroundHit | null {
    const id = this.idAt(from);
    if (id === null) return null;
    const distance = from.z;
    if (distance < 0 || distance > maxDistance) return null;
    return { distance, point: vec3(from.x, from.y, 0), effectId: id };
  }
}

function run(probe: GroundProbe, ticks = 5): World {
  const body = new AnalyticBody();
  const world = new World({
    seed: 1,
    body,
    probe,
    stepPhysics: (dt) => body.integrate(dt),
  });
  for (let tick = 0; tick < ticks; tick++) world.step(NO_INPUT);
  return world;
}

/** The rear-left wheel point, as the simulation lays the four out. */
const REAR_LEFT = WHEEL_LOCAL_POINTS[2]!;

describe('the surface wheel', () => {
  it('takes the surface from the rear-left wheel, not the rear-right', () => {
    // Dirt on the car's left, road on its right. The car is straight, so the
    // sign of x separates the two rear wheels cleanly.
    const world = run(new PatchedGround((from) => (from.x < 0 ? 4 : 1)));

    expect(REAR_LEFT.x).toBeLessThan(0);
    expect(world.vehicle.effectId).toBe(4);
    expect(world.vehicle.surface.inferredName).toBe(K.surfaceFor(4).inferredName);
  });

  it('cannot be overwritten by the other three wheels', () => {
    // Only the rear-left point reports 7; everything else reports 3. If any
    // other wheel could write, the later ones would win and leave 3.
    const world = run(
      new PatchedGround((from) =>
        Math.abs(from.x - REAR_LEFT.x) < 0.01 && Math.abs(from.y - REAR_LEFT.y) < 0.01 ? 7 : 3,
      ),
    );
    expect(world.vehicle.effectId).toBe(7);
  });

  it('reports the no-ground sentinel when the rear-left wheel misses', () => {
    // Three wheels on the ground, the rear-left over a hole.
    const world = run(
      new PatchedGround((from) =>
        Math.abs(from.x - REAR_LEFT.x) < 0.01 && Math.abs(from.y - REAR_LEFT.y) < 0.01 ? null : 1,
      ),
    );
    expect(world.vehicle.effectId).toBe(K.NO_GROUND_EFFECT_ID);
    expect(world.vehicle.surface).toBe(K.SURFACE_DEFAULT);
  });

  it('does not keep a stale surface once the ground goes away', () => {
    // Drive on dirt, then take the ground away entirely: the car must stop
    // claiming dirt rather than carrying its grip into the air.
    const body = new AnalyticBody();
    let grounded = true;
    const world = new World({
      seed: 1,
      body,
      probe: new PatchedGround(() => (grounded ? 4 : null)),
      stepPhysics: (dt) => body.integrate(dt),
    });

    for (let tick = 0; tick < 5; tick++) world.step(NO_INPUT);
    expect(world.vehicle.effectId).toBe(4);

    grounded = false;
    world.step(NO_INPUT);
    expect(world.vehicle.effectId).toBe(K.NO_GROUND_EFFECT_ID);
    expect(world.vehicle.surface).toBe(K.SURFACE_DEFAULT);
  });

  it('leaves a uniform surface reading exactly as it did', () => {
    // The case every existing test exercises: one id everywhere.
    const world = run(new PatchedGround(() => 6));
    expect(world.vehicle.effectId).toBe(6);
    expect(world.vehicle.surface).toBe(K.surfaceFor(6));
  });
});
