/**
 * The recovered race rules, exercised against the track.
 *
 * Each test names the behaviour it is protecting and why that behaviour exists,
 * so a future change that breaks one gets told what it broke rather than just
 * that something went red.
 */

import { describe, it, expect } from 'vitest';
import { World } from '../src/sim/world.js';
import { AnalyticBody } from '../src/sim/analytic-body.js';
import { Track, buildSliceTrack, segmentIndexFor } from '../src/sim/track.js';
import { flatGroundMesh } from '../src/sim/ground-mesh.js';
import { resolveImpact, overlaps } from '../src/sim/collision.js';
import { vec3, type GroundProbe, type VehicleInput } from '../src/sim/vehicle.js';
import * as K from '../src/sim/constants.js';

const DRIVE: VehicleInput = {
  forward: true,
  backward: false,
  left: false,
  right: false,
  jacks: false,
};
const IDLE: VehicleInput = { ...DRIVE, forward: false };

function worldOn(track: Track, at = vec3(0, 0, K.SPAWN_HEIGHT)) {
  const body = new AnalyticBody(K.CHASSIS_MASS, at);
  return {
    body,
    world: new World({
      seed: 1,
      body,
      probe: track,
      track,
      stepPhysics: (dt) => body.integrate(dt),
    }),
  };
}

describe('segment indexing', () => {
  it('places Y in 300-unit slices, starting at segment 1', () => {
    expect(segmentIndexFor(0)).toBe(1);
    expect(segmentIndexFor(299)).toBe(1);
    expect(segmentIndexFor(300)).toBe(2);
    expect(segmentIndexFor(10921)).toBe(37); // the finish line's segment
  });

  it('clamps behind the start line rather than going negative', () => {
    expect(segmentIndexFor(-50)).toBe(1);
  });

  it('never exceeds the 37 slots the original pre-sized', () => {
    const track = new Track({ ground: flatGroundMesh(100) });
    expect(track.segments.length).toBe(K.SEGMENT_SLOTS);
  });
});

describe('the ground query', () => {
  it('finds ground exactly on a seam', () => {
    // y = 300 belongs to segment 2 by segmentIndexFor, but the geometry under
    // it may be filed in either. The original consulted both within 2 units.
    const track = new Track({ ground: flatGroundMesh(3) });
    expect(track.castDown(vec3(0, 300, 0.5), 1)).not.toBeNull();
  });

  it('misses beyond the last segment and behind the start line', () => {
    const track = new Track({ ground: flatGroundMesh(3) });
    expect(track.castDown(vec3(0, 5000, 0.5), 1)).toBeNull();
    expect(track.castDown(vec3(0, -50, 0.5), 1)).toBeNull();
  });

  it('misses off the side of the strip', () => {
    // The mesh's own extent is what bounds the car now; there is no halfWidth.
    const track = new Track({ ground: flatGroundMesh(1) });
    expect(track.castDown(vec3(500, 150, 0.5), 1)).toBeNull();
  });

  it('carries the surface id the mesh gives it', () => {
    const track = new Track({ ground: flatGroundMesh(1, 18, 4) });
    expect(track.castDown(vec3(0, 150, 0.5), 1)?.effectId).toBe(4);
  });

  it('still caps at the 37 slots the original pre-sized', () => {
    const track = new Track({ ground: flatGroundMesh(100) });
    expect(track.segments.length).toBe(K.SEGMENT_SLOTS);
  });
});

describe('the fall rule', () => {
  it('marks a missed probe with the no-ground sentinel', () => {
    // The car sits off the side of the strip, so every ray finds nothing.
    const body = new AnalyticBody(K.CHASSIS_MASS, vec3(500, 150, K.SPAWN_HEIGHT));
    const track = new Track({ ground: flatGroundMesh(1) });
    const world = new World({
      seed: 1,
      body,
      probe: track,
      track,
      stepPhysics: (dt) => body.integrate(dt),
    });
    world.step(IDLE);
    expect(world.vehicle.effectId).toBe(K.NO_GROUND_EFFECT_ID);
  });

  it('keeps the surface of a hit too far away to stand on', () => {
    // `doMach5` sets pTrackFace from any hit at all and only then asks whether
    // it was near enough to push against. Under HOVER_RAY_LENGTH = 1 this can
    // never happen, because every hit is nearer than HOVER_DISTANCE = 1.2 -
    // but the two conditions are separate in the original and stay separate
    // here, so the third fall clause has something to be about.
    const far: GroundProbe = {
      castDown: (from) => ({
        distance: 5,
        point: vec3(from.x, from.y, from.z - 5),
        effectId: 6,
      }),
    };
    const body = new AnalyticBody(K.CHASSIS_MASS, vec3(0, 150, K.FALL_DEATH_Z - 1));
    const world = new World({
      seed: 1,
      body,
      probe: far,
      stepPhysics: (dt) => body.integrate(dt),
    });
    world.step(IDLE);

    expect(world.vehicle.powerCoeff).toBe(0);
    expect(world.vehicle.effectId).toBe(6);
    expect(world.race.outcome).toBe('running');
  });

  it('is not rescued by a quad parked far below the course', () => {
    // Unused sub-mesh groups are padded with patches at z = -20 so that all
    // 16 indices exist in every segment. A car falling past them must not
    // find ground: the hover ray is only 1 unit long, and that is why.
    const parked = flatGroundMesh(1);
    for (let i = 2; i < parked.positions.length; i += 3) parked.positions[i] = -20;
    const track = new Track({ ground: parked });
    expect(track.castDown(vec3(0, 150, 5), K.HOVER_RAY_LENGTH)).toBeNull();
    expect(track.castDown(vec3(0, 150, -19.5), K.HOVER_RAY_LENGTH)).not.toBeNull();
  });
});

describe('props in adjacent segments are intangible', () => {
  it('only the active segment contributes collidable props', () => {
    const track = buildSliceTrack(4);
    track.changeSegment(2);
    const inSeg2 = track.collidableProps();
    expect(inSeg2.length).toBeGreaterThan(0);
    for (const p of inSeg2) {
      expect(segmentIndexFor(p.position.y)).toBe(2);
    }

    track.changeSegment(3);
    for (const p of track.collidableProps()) {
      expect(segmentIndexFor(p.position.y)).toBe(3);
    }
  });

  it('a wall one segment ahead does not damage the car', () => {
    const track = new Track({ ground: flatGroundMesh(3) });
    // Put a wall exactly where the car sits, but file it under segment 2.
    track.addProp(2, 'wall', vec3(0, 0, 1), vec3(5, 5, 5));
    const { world } = worldOn(track);
    expect(world.race.segment).toBe(1);
    for (let i = 0; i < 20; i++) world.step(IDLE);
    // The car overlaps it in space, but it belongs to another segment.
    expect(world.race.damage).toBe(0);
  });
});

describe('collision damage formulas', () => {
  const ctx = { forwardVel: K.MAX_SPEED, reverseHeld: false, hasBlades: false };
  const prop = (kind: Parameters<typeof resolveImpact>[0]['kind']) => ({
    id: 1,
    kind,
    position: vec3(),
    halfExtent: vec3(1, 1, 1),
    active: true,
  });

  it('driving on the track costs nothing - it is ignored outright', () => {
    expect(resolveImpact(prop('track'), ctx).damage).toBe(0);
  });

  it('holding reverse suppresses generic-impact damage entirely', () => {
    const normal = resolveImpact(prop('wall'), ctx);
    const reversing = resolveImpact(prop('wall'), { ...ctx, reverseHeld: true });
    expect(normal.damage).toBeGreaterThan(0);
    expect(reversing.damage).toBe(0);
    // The spin cut still applies either way.
    expect(reversing.yawCut).toBe(0.2);
  });

  it('Blades cut enemy-car damage sixfold', () => {
    const without = resolveImpact(prop('enemyCar'), ctx).damage;
    const withBlades = resolveImpact(prop('enemyCar'), { ...ctx, hasBlades: true })
      .damage;
    expect(without).toBe(30);
    expect(withBlades).toBe(5);
  });

  it('Blades fell a tree instead of taking damage from it', () => {
    const outcome = resolveImpact(prop('faller'), { ...ctx, hasBlades: true });
    expect(outcome.damage).toBe(0);
    expect(outcome.consume).toBe(true);
  });

  it('generic impacts are capped at 10, fallers at 30', () => {
    expect(resolveImpact(prop('wall'), ctx).damage).toBeLessThanOrEqual(10);
    expect(resolveImpact(prop('faller'), ctx).damage).toBeLessThanOrEqual(30);
  });
});

describe('collision debounce', () => {
  it('one impact does not re-trigger every tick while overlapping', () => {
    const track = new Track({ ground: flatGroundMesh(2) });
    // Ahead of the car, so it arrives at speed rather than starting inside.
    track.addProp(1, 'wall', vec3(0, 40, 1), vec3(8, 8, 8));
    const { world } = worldOn(track);

    for (let i = 0; i < 40; i++) world.step(DRIVE);
    const hits = world.events.filter((e) => e.kind === 'damage').length;
    expect(hits).toBeGreaterThan(0);
    // Entry fires once; staying inside does not re-trigger.
    expect(hits).toBe(1);
  });
});

describe('pickups', () => {
  it('a wrench repairs and scores, and is consumed', () => {
    const track = new Track({ ground: flatGroundMesh(2) });
    const wrench = track.addProp(1, 'pickup', vec3(0, 0, 1), vec3(6, 6, 6), 'wrench');
    const { world } = worldOn(track);
    world.addDamage(80);

    world.step(IDLE);
    expect(world.race.damage).toBe(30); // 80 - 50
    expect(world.race.score).toBe(K.REPAIR_SCORE);
    expect(wrench?.active).toBe(false);

    const before = world.race.score;
    for (let i = 0; i < 10; i++) world.step(IDLE);
    expect(world.race.score).toBe(before); // consumed, not repeatable
  });

  it('oxygen refills, clamped at the maximum', () => {
    const track = new Track({ ground: flatGroundMesh(2) });
    track.addProp(1, 'pickup', vec3(0, 0, 1), vec3(6, 6, 6), 'oxygen');
    const { world } = worldOn(track);
    world.race.oxygen = 20;
    world.step(IDLE);
    expect(world.race.oxygen).toBe(70);
  });
});

describe('reverse suppression, end to end', () => {
  it('the same wall hurts when driving and not when reversing', () => {
    // Both runs drive forward into the same wall. The throttle takes priority
    // over reverse in the controller, so holding both still drives - which is
    // exactly the state the recovered rule keys on.
    const makeRun = (holdReverse: boolean) => {
      const track = new Track({ ground: flatGroundMesh(2) });
      track.addProp(1, 'wall', vec3(0, 40, 1), vec3(8, 8, 8));
      const { world } = worldOn(track);
      const input: VehicleInput = { ...DRIVE, backward: holdReverse };
      for (let i = 0; i < 40; i++) world.step(input);
      return world.race.damage;
    };
    expect(makeRun(false)).toBeGreaterThan(0);
    expect(makeRun(true)).toBe(0);
  });
});

describe('overlap test', () => {
  it('is a plain axis-aligned box test', () => {
    expect(overlaps(vec3(0, 0, 0), vec3(1, 1, 1), vec3(1.5, 0, 0), vec3(1, 1, 1))).toBe(true);
    expect(overlaps(vec3(0, 0, 0), vec3(1, 1, 1), vec3(2.5, 0, 0), vec3(1, 1, 1))).toBe(false);
  });
});
