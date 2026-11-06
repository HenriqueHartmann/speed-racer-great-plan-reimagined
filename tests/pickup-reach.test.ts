/**
 * How far the car reaches to collect something.
 *
 * Not with its bodywork. Every pickup handler in `handlePickups.ls:20-26`
 * requires the colliding model to be `mMach5Blades` — the saw — and the saw
 * is the only model on the car carrying a `#collision` modifier. It is re-set
 * to the chassis transform every frame *before* the blade scaling is applied
 * (`doMach5.ls:586`), so it is at full size with Blades off and pickups are
 * collected either way.
 *
 * We tested pickups against the chassis box, whose half-diagonal is 1.51. The
 * saw's bounding sphere about the chassis origin measures 3.683, and
 * `doHitTree` guards independently on `distanceTo(...) > 4` (`:6`). We were
 * collecting at well under half the original's reach.
 */
import { describe, it, expect } from 'vitest';
import { World } from '../src/sim/world.js';
import { AnalyticBody } from '../src/sim/analytic-body.js';
import { flatGroundMesh } from '../src/sim/ground-mesh.js';
import { Track } from '../src/sim/track.js';
import { NO_INPUT, vec3 } from '../src/sim/vehicle.js';
import * as K from '../src/sim/constants.js';

/** A pickup `distance` ahead of a car parked at the origin. */
function collectedAt(distance: number, kind: 'pickup' | 'wall' = 'pickup'): boolean {
  const track = new Track({ ground: flatGroundMesh(2) });
  const prop = track.addProp(
    1,
    kind,
    vec3(0, distance, K.SPAWN_HEIGHT),
    vec3(0.5, 0.4, 0.55), // the level's real pickup half-extents
    kind === 'pickup' ? 'candyRed' : undefined,
  );
  const body = new AnalyticBody();
  const world = new World({
    seed: 1,
    body,
    probe: track,
    track,
    stepPhysics: (dt) => body.integrate(dt),
  });
  world.step(NO_INPUT);
  return prop!.active === false;
}

describe('the pickup trigger', () => {
  it('reaches past the bodywork', () => {
    // 2.5 units ahead is outside the chassis box (half-length 1.2) and well
    // inside the saw's sphere. This is the case that used to fail.
    expect(collectedAt(2.5)).toBe(true);
  });

  it('reaches almost the radius the original states', () => {
    expect(collectedAt(3.5)).toBe(true);
  });

  it('stops at the radius', () => {
    expect(collectedAt(6)).toBe(false);
    expect(collectedAt(20)).toBe(false);
  });

  it('collects with the Blades off, which is when the saw is full size', () => {
    // doMach5:586 sets the saw to the chassis transform before any blade
    // scaling, so the trigger does not depend on the gadget.
    const track = new Track({ ground: flatGroundMesh(2) });
    const prop = track.addProp(1, 'pickup', vec3(0, 2.5, K.SPAWN_HEIGHT), vec3(0.5, 0.4, 0.55), 'wrench');
    const body = new AnalyticBody();
    const world = new World({ seed: 1, body, probe: track, track, stepPhysics: (dt) => body.integrate(dt) });
    expect(world.vehicle.hasBlades).toBe(false);
    world.step(NO_INPUT);
    expect(prop!.active).toBe(false);
  });

  it('does not widen what a solid can hit', () => {
    // Only the trigger grew. A wall 2.5 units ahead is still not touching the
    // car, or every barrier in the level would start scraping.
    expect(collectedAt(2.5, 'wall')).toBe(false);
  });
});
