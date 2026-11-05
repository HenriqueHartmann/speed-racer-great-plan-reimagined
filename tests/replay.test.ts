/**
 * Determinism and replay tests.
 *
 * Three goals are kept separate here, because conflating them is how a project
 * ends up claiming a guarantee it never tested:
 *
 *   Goal 1  repeatability on the same build and environment
 *   Goal 2  repeatability across rendering schedules
 *   Goal 3  cross-platform determinism  <- NOT tested here, and not claimed
 *
 * Goal 3 would need the same inputs run on different machines and architectures.
 * Nothing in this file establishes it, so nothing in this project should say it
 * holds.
 */

import { describe, it, expect } from 'vitest';
import { World, type SimSnapshot, type SimEvent } from '../src/sim/world.js';
import { AnalyticBody, FlatGround } from '../src/sim/analytic-body.js';
import { vec3, type VehicleInput } from '../src/sim/vehicle.js';
import * as K from '../src/sim/constants.js';

/** The spec calls for at least 3,600 fixed ticks - two minutes at 30 Hz. */
const TICKS = 3600;
const SEED = 0x5eed_1234;

/**
 * A deterministic, tick-indexed input sequence. It is deliberately varied:
 * a constant throttle would exercise almost none of the controller.
 */
function inputAt(tick: number): VehicleInput {
  return {
    forward: tick % 240 < 200,
    backward: tick % 600 >= 560,
    left: tick % 300 >= 60 && tick % 300 < 140,
    right: tick % 300 >= 200 && tick % 300 < 260,
    jacks: tick % 450 === 0,
  };
}

function freshWorld(): World {
  const body = new AnalyticBody();
  const ground = new FlatGround();
  return new World({
    seed: SEED,
    body,
    probe: ground,
    stepPhysics: (dt) => body.integrate(dt),
  });
}

/**
 * Run the simulation for `TICKS`, taking a snapshot every `sampleEvery` ticks.
 *
 * `renderEvery` simulates a renderer observing the world at a different cadence
 * than the simulation. Observation must never change the result; if it does, the
 * simulation is reading something it should not.
 */
function runRace(
  renderEvery: number,
  sampleEvery = 60,
): { snapshots: SimSnapshot[]; events: SimEvent[]; final: SimSnapshot } {
  const world = freshWorld();
  const snapshots: SimSnapshot[] = [];
  let sinceRender = 0;

  for (let t = 0; t < TICKS; t++) {
    world.step(inputAt(t));

    if (++sinceRender >= renderEvery) {
      sinceRender = 0;
      // What a renderer does: read state, never write it.
      const s = world.snapshot();
      void s.position;
    }
    if (t % sampleEvery === 0) snapshots.push(world.snapshot());
  }

  return { snapshots, events: world.events, final: world.snapshot() };
}

describe('goal 1 - repeatability on the same build', () => {
  it('two independent runs of the same recorded sequence agree exactly', () => {
    const a = runRace(1);
    const b = runRace(1);

    expect(a.snapshots).toEqual(b.snapshots);
    expect(a.events).toEqual(b.events);
    expect(a.final).toEqual(b.final);
  });

  it('completes the required number of ticks', () => {
    const a = runRace(1);
    expect(a.final.tick).toBe(TICKS);
    expect(TICKS).toBeGreaterThanOrEqual(3600);
  });

  it('actually moves the car, so the comparison is not of a dead simulation', () => {
    const a = runRace(1);
    expect(Math.abs(a.final.position[1])).toBeGreaterThan(1);
    expect(a.events.length).toBeGreaterThan(0);
  });

  it('is seeded, not accidentally identical - a different seed diverges', () => {
    const body = new AnalyticBody();
    const w = new World({
      seed: SEED + 1,
      body,
      probe: new FlatGround(),
      stepPhysics: (dt) => body.integrate(dt),
    });
    w.run(10, inputAt);
    const other = freshWorld();
    other.run(10, inputAt);
    expect(w.snapshot().rng).not.toBe(other.snapshot().rng);
  });
});

describe('goal 2 - repeatability across rendering schedules', () => {
  const schedules = [
    { name: 'every tick', every: 1 },
    { name: 'every 2nd tick', every: 2 },
    { name: 'every 7th tick - uneven', every: 7 },
    { name: 'every 31st tick - heavy drops', every: 31 },
    { name: 'never - headless', every: TICKS + 1 },
  ];

  const baseline = runRace(1);

  for (const { name, every } of schedules) {
    it(`renders ${name} without changing the simulation`, () => {
      const run = runRace(every);
      expect(run.snapshots).toEqual(baseline.snapshots);
      expect(run.events).toEqual(baseline.events);
    });
  }
});

describe('goal 3 - cross-platform determinism', () => {
  it.skip('is NOT tested here and is NOT claimed', () => {
    // Establishing this needs the same recorded inputs executed on different
    // machines and architectures, with the results compared out of band. Until
    // that exists, the project must not state that cross-platform determinism
    // holds. The test is skipped deliberately, as a marker rather than a gap.
  });
});

describe('recovered rules behave as documented', () => {
  it('Jacks requires all four wheels grounded', () => {
    const body = new AnalyticBody(K.CHASSIS_MASS, vec3(0, 0, 50)); // airborne
    const w = new World({
      seed: SEED,
      body,
      probe: new FlatGround(),
      stepPhysics: (dt) => body.integrate(dt),
    });
    w.step({ forward: false, backward: false, left: false, right: false, jacks: true });
    expect(w.vehicle.powerCoeff).toBe(0);
    expect(w.vehicle.jacksExtended).toBe(false);
  });

  it('damage kills on the displayed value, not the real one', () => {
    const w = freshWorld();
    w.addDamage(K.STAT_MAX);
    expect(w.race.damage).toBe(K.STAT_MAX);
    // One tick is not enough: the bar eases 30% of the gap per update.
    w.step();
    expect(w.race.outcome).toBe('running');
    for (let i = 0; i < 60; i++) w.step();
    expect(w.race.outcome).toBe('destroyed');
  });

  it('surface grip and drag come from the recovered table', () => {
    expect(K.surfaceFor(4).grip).toBe(0.8);
    expect(K.surfaceFor(12).drag).toBe(0.75);
    expect(K.surfaceFor(8).grip).toBe(0.016);
    expect(K.surfaceFor(999)).toBe(K.SURFACE_DEFAULT);
  });

  it('the Jacks cooldown is 80 ticks at 1/60 s, not 80 simulation ticks', () => {
    expect(K.JACKS_COOLDOWN_SECONDS).toBeCloseTo(80 / 60, 10);
  });
});

describe('braking', () => {
  it('slows without overshooting into reverse', () => {
    const body = new AnalyticBody();
    const world = new World({
      seed: SEED,
      body,
      probe: new FlatGround(),
      stepPhysics: (dt) => body.integrate(dt),
    });

    // Get up to speed.
    world.run(60, () => ({ ...NO_INPUT_LOCAL, forward: true }));
    const top = world.vehicle.forwardVel;
    expect(top).toBeGreaterThan(40);

    // Brake, sampling the body's own velocity rather than the controller's
    // cached `forwardVel`. That cache is read before the tick's impulse and
    // before integration, so it lags by one tick - which shows up as a tiny
    // rise on the first braking tick and would make a monotonic check lie.
    let previous = body.linearVelocity.y;
    let minimum = previous;
    for (let i = 0; i < 90; i++) {
      world.step({ ...NO_INPUT_LOCAL, backward: true });
      const v = body.linearVelocity.y;
      expect(v).toBeLessThanOrEqual(previous + 1e-9);
      minimum = Math.min(minimum, v);
      previous = v;
    }
    // It does eventually reverse - that part is the original's behaviour.
    expect(minimum).toBeLessThan(0);
  });

  it('takes meaningfully longer than the original to stop from top speed', () => {
    const body = new AnalyticBody();
    const world = new World({
      seed: SEED,
      body,
      probe: new FlatGround(),
      stepPhysics: (dt) => body.integrate(dt),
    });
    world.run(60, () => ({ ...NO_INPUT_LOCAL, forward: true }));

    let ticks = 0;
    while (world.vehicle.forwardVel > 1 && ticks < 300) {
      world.step({ ...NO_INPUT_LOCAL, backward: true });
      ticks++;
    }
    // The original crossed into reverse in about 7 ticks, roughly 230 ms.
    // This brake targets about 1.3 seconds, so anything under a second means
    // the gain has drifted back toward the behaviour it exists to replace.
    expect(ticks).toBeGreaterThan(30);
    expect(ticks).toBeLessThan(60);
  });
});

const NO_INPUT_LOCAL = {
  forward: false,
  backward: false,
  left: false,
  right: false,
  jacks: false,
};
