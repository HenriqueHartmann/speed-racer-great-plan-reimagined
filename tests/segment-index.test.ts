/**
 * Which 300-unit slice a Y coordinate belongs to.
 *
 * `PREP:272` and `doMach5:505` both compute it as `(integer(y) / 300) + 1`,
 * and the whole level is filed by it: the road, every prop, the car's own
 * segment and therefore which track collider is solid at any moment.
 *
 * The rule turns on what Lingo's `integer()` does, and Director's manual is
 * not part of this artifact. The game answers it itself: `MOVIE.ls:263-288`
 * defines a `ceil` that returns `integer(f + 0.5)` and a `floor` that returns
 * `integer(f - 0.5)`, for positive f. Under a truncating `integer()` both are
 * wrong - `trunc(1.7) = 1` is not `ceil(1.2)`, `trunc(0.7) = 0` is not
 * `floor(1.2)`. Under a rounding one both are right. Two helpers the authors
 * wrote and relied on, each broken by truncation: `integer()` rounds.
 *
 * `src/sim/track.ts` documented that rule and implemented `Math.floor`, which
 * disagrees on the half-unit below every boundary.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { initRapier, RapierWorld, RapierChassis } from '../src/physics/rapier-body.js';
import { parseGroundMesh } from '../src/sim/ground-mesh.js';
import { readFileSync } from 'node:fs';
import { Track, segmentIndexFor } from '../src/sim/track.js';
import { World } from '../src/sim/world.js';
import { NO_INPUT, vec3 } from '../src/sim/vehicle.js';
import * as K from '../src/sim/constants.js';

/** The original's expression, transcribed. */
function lingoSegment(y: number): number {
  const rounded = y < 0 ? -Math.round(-y) : Math.round(y); // integer(): half away from zero
  return Math.trunc(rounded / 300) + 1; // integer division
}

describe('segmentIndexFor', () => {
  it('agrees with the transcribed Lingo rule across the whole course', () => {
    for (let y = 0; y <= 11100; y += 0.1) {
      const y2 = Math.round(y * 10) / 10;
      expect(segmentIndexFor(y2), `y = ${y2}`).toBe(Math.max(1, lingoSegment(y2)));
    }
  });

  it('rounds up into the next segment just below a boundary', () => {
    // integer(299.6) = 300, 300/300 = 1, +1 = 2. Math.floor says 1.
    expect(segmentIndexFor(299.5)).toBe(2);
    expect(segmentIndexFor(299.6)).toBe(2);
    expect(segmentIndexFor(299.9)).toBe(2);
  });

  it('stays in this segment further below the boundary', () => {
    expect(segmentIndexFor(299.4)).toBe(1);
    expect(segmentIndexFor(298)).toBe(1);
  });

  it('is unsurprising at and just above a boundary', () => {
    expect(segmentIndexFor(300)).toBe(2);
    expect(segmentIndexFor(300.1)).toBe(2);
    expect(segmentIndexFor(600)).toBe(3);
  });

  it('files the two real props that sit in the divergence band', () => {
    // Measured from track.glb; both are within 0.2 units of a boundary.
    expect(segmentIndexFor(1199.829)).toBe(5);
    expect(segmentIndexFor(8399.982)).toBe(29);
  });

  it('clamps behind the start line rather than going negative', () => {
    // Negative Y is accepted, not rejected, and lands in segment 1.
    expect(segmentIndexFor(-0.4)).toBe(1);
    expect(segmentIndexFor(-50)).toBe(1);
    expect(segmentIndexFor(-5000)).toBe(1);
  });

  it('puts the start of the course in segment 1', () => {
    expect(segmentIndexFor(0)).toBe(1);
    expect(segmentIndexFor(0.4)).toBe(1);
  });
});

describe("the car's own segment", () => {
  let rapier: Awaited<ReturnType<typeof initRapier>>;
  beforeAll(async () => {
    rapier = await initRapier();
  });

  it('follows the same rule as prop filing', () => {
    // Not only props: world.ts reads segmentIndexFor for race.segment, which
    // is what decides the solid track segment.
    const ground = parseGroundMesh(readFileSync('public/models/track-ground.bin'));
    const track = new Track({ ground });
    const host = new RapierWorld(rapier);
    const chassis = new RapierChassis(rapier, host, vec3(0, 299.7, 20));
    const world = new World({
      seed: 1,
      body: chassis,
      probe: track,
      track,
      stepPhysics: () => host.step(),
    });
    world.step(NO_INPUT);

    expect(world.race.segment).toBe(segmentIndexFor(chassis.position.y));
    expect(world.race.segment).toBe(2);
    void K;
  });
});
