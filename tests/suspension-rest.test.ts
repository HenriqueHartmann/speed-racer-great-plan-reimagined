/**
 * A parked car stays parked.
 *
 * Reported from play: "as if the car were driving on a potholed street even
 * while stopped" — the wheels visibly bouncing, the speed drifting 0.1, 0.0,
 * -0.1, -0.2. It was not drift. It was a limit cycle, and the arithmetic of
 * the recovered constants produces it exactly.
 *
 * Four wheels each push up by `d * pStrength * (pHoverDist - d)` and gravity
 * pulls down by `|g| * pTimeStep` per tick. With the recovered 3.0, 1.2, 90.81
 * and 0.025 that balances at **d = 1.0133** — and the recovered ray is 1.0
 * long. The car's resting height is 1.3% beyond the reach of the ray that
 * holds it up, so at rest the wheel loses the road, falls, is caught lower,
 * is pushed back past 1.0, and loses it again. Forever.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { initRapier, RapierWorld, RapierChassis } from '../src/physics/rapier-body.js';
import { parseGroundMesh } from '../src/sim/ground-mesh.js';
import { Track } from '../src/sim/track.js';
import { World } from '../src/sim/world.js';
import { NO_INPUT, vec3 } from '../src/sim/vehicle.js';
import * as K from '../src/sim/constants.js';

let rapier: Awaited<ReturnType<typeof initRapier>>;
beforeAll(async () => {
  rapier = await initRapier();
});

/** A car left standing on the real course for `ticks`. */
function parked(ticks: number) {
  const ground = parseGroundMesh(readFileSync('public/models/track-ground.bin'));
  const track = new Track({ ground });
  const road = track.castDown(vec3(ground.spawn.x, ground.spawn.y, ground.spawn.z), 60)!;
  const host = new RapierWorld(rapier);
  const chassis = new RapierChassis(
    rapier,
    host,
    vec3(ground.spawn.x, ground.spawn.y, ground.spawn.z - road.distance + K.SPAWN_HEIGHT),
  );
  const world = new World({ seed: 1, body: chassis, probe: track, track, stepPhysics: () => host.step() });

  const hover: number[] = [];
  let looseTicks = 0;
  for (let tick = 0; tick < ticks; tick++) {
    world.step(NO_INPUT);
    if (tick > ticks / 2) {
      hover.push(world.vehicle.hoverDistances[0]!);
      if (world.vehicle.grounded.some((g) => !g)) looseTicks++;
    }
  }
  return { hover, looseTicks, world, chassis };
}

describe('a car at rest', () => {
  it('keeps all four wheels on the road', () => {
    const { looseTicks } = parked(300);
    expect(looseTicks).toBe(0);
  });

  it('does not bounce', () => {
    const { hover } = parked(300);
    const amplitude = Math.max(...hover) - Math.min(...hover);
    expect(amplitude).toBeLessThan(0.01);
  });

  it('settles where the recovered spring says it should', () => {
    // The stable root of 4 * d * STRENGTH * (HOVER_DISTANCE - d) = |g| * dt.
    const a = -4 * K.SUSPENSION_STRENGTH;
    const b = 4 * K.SUSPENSION_STRENGTH * K.HOVER_DISTANCE;
    const c = -Math.abs(K.GRAVITY_Z) * K.TIMESTEP;
    const root = (-b - Math.sqrt(b * b - 4 * a * c)) / (2 * a);

    const { hover } = parked(300);
    expect(root).toBeCloseTo(1.013, 2);
    expect(hover[hover.length - 1]).toBeCloseTo(root, 1);
  });

  it('can see as far as it can hover', () => {
    // The contradiction, stated as the invariant that removes it: a resting
    // wheel must be inside the ray, or it cannot be held up by what it
    // cannot see.
    expect(K.HOVER_RAY_LENGTH).toBeGreaterThanOrEqual(K.HOVER_DISTANCE);
  });
});
