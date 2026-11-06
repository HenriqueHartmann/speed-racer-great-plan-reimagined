/**
 * The seven gadgets, against the behaviour recovered from `doMach5`'s
 * `keyDown` handler and its per-update expiry block.
 */

import { describe, it, expect } from 'vitest';
import { World } from '../src/sim/world.js';
import { AnalyticBody, FlatGround } from '../src/sim/analytic-body.js';
import { flatGroundMesh } from '../src/sim/ground-mesh.js';
import { Track } from '../src/sim/track.js';
import { resolveImpact } from '../src/sim/collision.js';
import { vec3, NO_INPUT, type GroundProbe, type VehicleInput } from '../src/sim/vehicle.js';
import {
  GADGETS,
  GADGET_BY_KEY,
  createGadgetStates,
  toggleGadget,
  stepGadgets,
  secondsFor,
  simTicksFor,
  type GadgetId,
  type GadgetStates,
} from '../src/sim/gadgets.js';
import * as K from '../src/sim/constants.js';

/**
 * Ground that is the water surface, below the waterline.
 *
 * `race.underwater` used to be poked by hand here, because nothing in `src/`
 * ever set it. The world now computes it from the surface under the car and
 * the car's height, so these tests have to put the car in water rather than
 * assert that it is.
 */
function submerged(): GroundProbe {
  const height = -3;
  return {
    castDown: (from, maxDistance) => {
      const distance = from.z - height;
      if (distance < 0 || distance > maxDistance) return null;
      return { distance, point: vec3(from.x, from.y, height), effectId: K.WATER_EFFECT_ID };
    },
  };
}

function freshWorld(track?: Track, probe?: GroundProbe) {
  const body = new AnalyticBody(K.CHASSIS_MASS, vec3(0, 0, probe ? -3 + K.SPAWN_HEIGHT : K.SPAWN_HEIGHT));
  const world = new World({
    seed: 1,
    body,
    probe: probe ?? track ?? new FlatGround(),
    ...(track ? { track } : {}),
    stepPhysics: (dt) => body.integrate(dt),
  });
  return { body, world };
}

const press = (...gadgets: GadgetId[]): VehicleInput => ({
  ...NO_INPUT,
  gadgetPresses: gadgets,
});

describe('bindings match the original', () => {
  it('maps a-g and 1-7, the lettering on the steering wheel', () => {
    expect(GADGET_BY_KEY.get('a')).toBe('jacks');
    expect(GADGET_BY_KEY.get('b')).toBe('grip');
    expect(GADGET_BY_KEY.get('c')).toBe('blades');
    expect(GADGET_BY_KEY.get('d')).toBe('deflector');
    expect(GADGET_BY_KEY.get('e')).toBe('lights');
    expect(GADGET_BY_KEY.get('f')).toBe('frogger');
    expect(GADGET_BY_KEY.get('g')).toBe('robot');
    for (let i = 1; i <= 7; i++) {
      expect(GADGET_BY_KEY.get(String(i))).toBe(GADGETS[i - 1]!.id);
    }
  });

  it('carries the recovered durations, in 1/60 s ticks', () => {
    const ticks = Object.fromEntries(GADGETS.map((g) => [g.id, g.ticks]));
    expect(ticks).toEqual({
      jacks: 80,
      grip: 500,
      blades: 240,
      deflector: 500,
      lights: null,
      frogger: null,
      robot: null,
    });
    expect(secondsFor(GADGETS[1]!)).toBeCloseTo(500 / 60, 10);
  });
});

describe('toggling', () => {
  /** Advance a bare gadget set, as the vehicle would, from tick 0. */
  const advance = (states: GadgetStates, ticks: number, powerCoeff = 1) => {
    for (let t = 1; t <= ticks; t++) stepGadgets(states, { powerCoeff, tick: t });
  };

  it('timed gadgets expire exactly on their tick, not a tick early', () => {
    const states = createGadgetStates();
    const blades = GADGETS[2]!;
    expect(toggleGadget(states, 'blades', { powerCoeff: 1, tick: 0 })).toBe(
      'activated',
    );

    const life = simTicksFor(blades);
    advance(states, life - 1);
    expect(states.blades.active).toBe(true);

    stepGadgets(states, { powerCoeff: 1, tick: life });
    expect(states.blades.active).toBe(false);
  });

  it('a second press turns a gadget off early', () => {
    const states = createGadgetStates();
    toggleGadget(states, 'lights', { powerCoeff: 1, tick: 0 });
    expect(states.lights.active).toBe(true);
    expect(toggleGadget(states, 'lights', { powerCoeff: 1, tick: 5 })).toBe(
      'deactivated',
    );
    expect(states.lights.active).toBe(false);
  });

  it('untimed gadgets stay on until toggled', () => {
    const states = createGadgetStates();
    toggleGadget(states, 'lights', { powerCoeff: 1, tick: 0 });
    advance(states, 1000);
    expect(states.lights.active).toBe(true);
  });
});

describe('Jacks', () => {
  it('refuses unless all four wheels are grounded', () => {
    const states = createGadgetStates();
    expect(toggleGadget(states, 'jacks', { powerCoeff: 0.75, tick: 0 })).toBe(
      'refused',
    );
    expect(toggleGadget(states, 'jacks', { powerCoeff: 1, tick: 0 })).toBe(
      'activated',
    );
  });

  it('cannot be cancelled by a second press, unlike the others', () => {
    const states = createGadgetStates();
    toggleGadget(states, 'jacks', { powerCoeff: 1, tick: 0 });
    expect(toggleGadget(states, 'jacks', { powerCoeff: 1, tick: 1 })).toBe(
      'refused',
    );
    expect(states.jacks.active).toBe(true);
  });

  it('retracts only once a wheel is back on the ground', () => {
    const states = createGadgetStates();
    toggleGadget(states, 'jacks', { powerCoeff: 1, tick: 0 });
    const life = simTicksFor(GADGETS[0]!) + 5;

    // Airborne the whole time: the timer runs out but it stays extended.
    for (let t = 1; t <= life; t++) stepGadgets(states, { powerCoeff: 0, tick: t });
    expect(states.jacks.active).toBe(true);

    stepGadgets(states, { powerCoeff: 0.25, tick: life + 1 });
    expect(states.jacks.active).toBe(false);
  });

  it('launches the car upward through the world', () => {
    const { body, world } = freshWorld();
    world.step(NO_INPUT);
    expect(world.vehicle.powerCoeff).toBe(1);

    const before = body.linearVelocity.z;
    world.step(press('jacks'));
    expect(body.linearVelocity.z).toBeGreaterThan(before + 10);
  });
});

describe('Grip', () => {
  it('overrides a low-grip surface while active', () => {
    const track = new Track({ ground: flatGroundMesh(2) });
    // Segment 1 reports a road id; force a slippery one to prove the override.
    const slippery = new Track({ ground: flatGroundMesh(2) });
    void slippery;
    const { world } = freshWorld(track);

    world.step(NO_INPUT);
    world.vehicle.surface = K.surfaceFor(8); // shallow water, grip 0.016
    expect(world.vehicle.surface.grip).toBe(0.016);

    world.step(press('grip'));
    expect(world.vehicle.gadgets.grip.active).toBe(true);
    expect(world.vehicle.surface.grip).toBe(1);
  });
});

describe('Blades', () => {
  it('sets the flag the collision code reads', () => {
    const { world } = freshWorld();
    expect(world.vehicle.hasBlades).toBe(false);
    world.step(press('blades'));
    expect(world.vehicle.hasBlades).toBe(true);
  });

  it('turns a damaging tree into a felled one', () => {
    const tree = {
      id: 1,
      kind: 'faller' as const,
      position: vec3(),
      halfExtent: vec3(1, 1, 1),
      active: true,
    };
    const ctx = { forwardVel: K.MAX_SPEED, reverseHeld: false, hasBlades: false };
    expect(resolveImpact(tree, ctx).damage).toBeGreaterThan(0);

    const withBlades = resolveImpact(tree, { ...ctx, hasBlades: true });
    expect(withBlades.damage).toBe(0);
    expect(withBlades.consume).toBe(true);
  });
});

describe('Frogger and oxygen', () => {
  it('drains oxygen while deployed, not while merely underwater', () => {
    const { world } = freshWorld(undefined, submerged());

    // Underwater without the scope: damage, and oxygen untouched.
    const oxygenBefore = world.race.oxygen;
    world.step(NO_INPUT);
    expect(world.race.oxygen).toBe(oxygenBefore);
    expect(world.race.damage).toBeGreaterThan(0);

    // With the scope: oxygen falls, no further damage from submersion.
    const damageBefore = world.race.damage;
    world.step(press('frogger'));
    world.step(NO_INPUT);
    expect(world.race.oxygen).toBeLessThan(oxygenBefore);
    expect(world.race.damage).toBe(damageBefore);
  });

  it('refills the tank when deployed out of water', () => {
    const { world } = freshWorld();
    world.race.oxygen = 10;
    world.step(press('frogger'));
    // Refilled to full, less the one tick of drain that the same update
    // applies - which is what the original does too: the refill is in the key
    // handler, the drain is in the update loop, and both run in that frame.
    expect(world.race.oxygen).toBeGreaterThan(K.STAT_MAX - 1);
    expect(world.race.oxygen).toBeLessThanOrEqual(K.STAT_MAX);
  });

  it('does not refill when deployed already submerged', () => {
    const { world } = freshWorld(undefined, submerged());
    world.race.oxygen = 10;
    world.step(press('frogger'));
    expect(world.race.oxygen).toBeLessThan(K.STAT_MAX);
  });
});

describe('events', () => {
  it('records every activation, in order', () => {
    const { world } = freshWorld();
    world.step(NO_INPUT);
    world.step(press('lights', 'blades'));
    const fired = world.events
      .filter((e) => e.kind === 'gadget')
      .map((e) => e.gadget);
    expect(fired).toEqual(['lights', 'blades']);
  });
});
describe('the Robot is one-shot', () => {
  /**
   * `gROBOTMODE` is a four-state machine in `doMach5`: 0 ready, 1-3 in flight,
   * 4 spent and `nothing()`. The key is gated on 0 (`:249`), so once the Robot
   * has flown it cannot be fired again - and the only thing that brings it
   * back is a Robot pickup, `gROBOTMODE = 4 -> 0` (`handlePickups.ls:66-68`).
   *
   * Ours was a plain toggle with no spent state at all, which left the ten
   * Robot pickups in the level with nothing to rearm.
   */
  it('refuses a second launch once it has flown', () => {
    const { world } = freshWorld();
    world.step(press('robot'));
    expect(world.vehicle.gadgets.robot.active).toBe(true);

    // Toggling it off is how it flies; after that it is spent.
    world.step(press('robot'));
    expect(world.vehicle.gadgets.robot.active).toBe(false);

    world.step(press('robot'));
    expect(world.vehicle.gadgets.robot.active).toBe(false);
  });

  it('is rearmed by a Robot pickup', () => {
    const track = new Track({ ground: flatGroundMesh(2) });
    const { world } = freshWorld(track);
    world.step(press('robot'));
    world.step(press('robot'));
    world.step(press('robot'));
    expect(world.vehicle.gadgets.robot.active).toBe(false);

    track.addProp(1, 'pickup', vec3(0, 0, 1), vec3(6, 6, 6), 'robot');
    world.step(NO_INPUT);

    world.step(press('robot'));
    expect(world.vehicle.gadgets.robot.active).toBe(true);
  });

  it('leaves the other gadgets toggling freely', () => {
    const { world } = freshWorld();
    for (let i = 0; i < 3; i++) {
      world.step(press('lights'));
      expect(world.vehicle.gadgets.lights.active).toBe(i % 2 === 0);
    }
  });
});

