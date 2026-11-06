/**
 * The Grip gadget on ice.
 *
 * Two things, and only the first is recovered.
 *
 * RECOVERED, and an ordering defect we had: `doMach5:643` sets `pGrip = 1`
 * and `:1007` sets `pDrag = 1` while the gadget is up, both more than a
 * hundred lines before the throttle at `:759-764` reads them. Ours applied
 * the override in `updateLateralGrip`, after `updateDrive`, so it reached
 * the cornering and never the engine - and the next tick's ground probe
 * overwrote it before it could. On ice the gadget did nothing at all for
 * acceleration: 10.33 seconds to half speed with it up, exactly as without.
 *
 * SUBSTITUTE: the original is blunter than the owner wanted. It makes ice
 * indistinguishable from dry road - 69 and 0.53 s to nine tenths of it. Here
 * the gadget leaves a top of 64 reached over about twice the road's climb.
 */
import { describe, it, expect } from 'vitest';
import { World } from '../src/sim/world.js';
import { AnalyticBody, FlatGround } from '../src/sim/analytic-body.js';
import { NO_INPUT, type GroundHit, type Vec3 } from '../src/sim/vehicle.js';
import * as K from '../src/sim/constants.js';

/** Flat ground that reports whichever surface the test asks for. */
class Surfaced extends FlatGround {
  readonly id: number;
  constructor(id: number) {
    super();
    this.id = id;
  }
  override castDown(from: Vec3, max: number): GroundHit | null {
    const hit = super.castDown(from, max);
    return hit ? { ...hit, effectId: this.id } : null;
  }
}

/** Hold the throttle over one surface, optionally with the gadget up. */
function drive(effectId: number, grip: boolean, ticks = 2000) {
  const body = new AnalyticBody();
  const world = new World({
    seed: 1, body, probe: new Surfaced(effectId), stepPhysics: (dt) => body.integrate(dt),
  });
  for (let t = 0; t < 40; t++) world.step(NO_INPUT);
  if (grip) world.step({ ...NO_INPUT, gadgetPresses: ['grip'] });

  let top = 0;
  let reached90 = -1;
  // The 64 applies on ice only; on dry road the gadget changes nothing.
  const ceiling = grip && K.ICE_EFFECT_IDS.has(effectId) ? 64 : K.MAX_SPEED;
  for (let t = 0; t < ticks; t++) {
    world.step({ ...NO_INPUT, forward: true });
    // Measure only inside the gadget's own window; past it the car is on
    // bare ice again and climbs away toward 69 over half a minute.
    if (grip && !world.vehicle.gadgets.grip.active) break;
    top = Math.max(top, world.vehicle.forwardVel);
    if (reached90 < 0 && world.vehicle.forwardVel >= 0.9 * ceiling) reached90 = t;
  }
  return { top, secondsTo90: reached90 < 0 ? Infinity : reached90 * K.TICK_DT, world };
}

describe('the Grip gadget on ice', () => {
  it('rescues an acceleration that was unusable without it', () => {
    const bare = drive(14, false);
    const gripped = drive(14, true);
    expect(bare.secondsTo90).toBeGreaterThan(20);
    expect(gripped.secondsTo90).toBeLessThan(2);
  });

  it('tops out at 64, not at the road s 69', () => {
    const gripped = drive(14, true);
    expect(gripped.top).toBeGreaterThan(63.5);
    expect(gripped.top).toBeLessThan(64.5);
    expect(gripped.top).toBeLessThan(K.MAX_SPEED);
  });

  it('takes a little longer to get there than the road does', () => {
    const road = drive(2, false);
    const gripped = drive(14, true);
    expect(gripped.secondsTo90).toBeGreaterThan(road.secondsTo90);
    // "A little" - not another order of magnitude, which is what bare ice is.
    expect(gripped.secondsTo90).toBeLessThan(road.secondsTo90 * 4);
  });

  it('treats snow the same as ice', () => {
    // 8 and 9 are `ROAD_BLUESNOW`, 14 and 15 are `ROAD_BlueIce`, and all four
    // share the 0.016 grip that makes them a problem.
    for (const id of [8, 9, 14, 15]) {
      const gripped = drive(id, true);
      expect(gripped.top, `surface ${id}`).toBeLessThan(64.5);
      expect(gripped.secondsTo90, `surface ${id}`).toBeLessThan(2);
    }
  });

  it('does not slow the car down on a surface that is not ice', () => {
    // The gadget costs nothing where there was nothing to fix.
    const road = drive(2, false);
    const roadGripped = drive(2, true);
    expect(roadGripped.top).toBeCloseTo(road.top, 1);
    expect(roadGripped.secondsTo90).toBeCloseTo(road.secondsTo90, 2);
  });

  it('keeps full cornering grip, which is what the gadget is for', () => {
    // Only the drive is tempered; `pGrip` stays 1, so the car still holds a
    // line. The flag the throttle reads is separate from the surface.
    const { world } = drive(14, true, 60);
    expect(world.vehicle.surface.grip).toBe(1);
    expect(world.vehicle.gripOnIce).toBe(true);
  });

  it('clears the flag the moment the gadget lapses', () => {
    const body = new AnalyticBody();
    const world = new World({
      seed: 1, body, probe: new Surfaced(14), stepPhysics: (dt) => body.integrate(dt),
    });
    world.step({ ...NO_INPUT, gadgetPresses: ['grip'] });
    expect(world.vehicle.gripOnIce).toBe(true);
    while (world.vehicle.gadgets.grip.active) world.step({ ...NO_INPUT, forward: true });
    world.step({ ...NO_INPUT, forward: true });
    expect(world.vehicle.gripOnIce).toBe(false);
    expect(world.vehicle.surface.grip).toBe(0.016);
  });
});
