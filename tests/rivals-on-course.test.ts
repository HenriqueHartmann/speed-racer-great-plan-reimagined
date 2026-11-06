/**
 * The three of them, on the real course, with the real colliders.
 *
 * `rival-drives.test.ts` drives one car. This drives the field the way
 * `main.ts` drives it - three bodies, each with its own segment made solid
 * through the per-vehicle filters, stepped alongside a player. It is the only
 * test that would catch the two cars sharing a collider set, or a rival
 * falling through a segment the player happens not to be in.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { initRapier, RapierWorld, RapierChassis } from '../src/physics/rapier-body.js';
import { SegmentColliders } from '../src/physics/segment-colliders.js';
import { parseGroundMesh, parseSolidMesh } from '../src/sim/ground-mesh.js';
import { parseTrackPath, waypoint } from '../src/sim/track-path.js';
import { Track, segmentIndexFor } from '../src/sim/track.js';
import { RaceField } from '../src/sim/race-field.js';
import { World } from '../src/sim/world.js';
import { NO_INPUT, vec3 } from '../src/sim/vehicle.js';
import * as K from '../src/sim/constants.js';

let rapier: Awaited<ReturnType<typeof initRapier>>;
beforeAll(async () => {
  rapier = await initRapier();
});

const STARTS = [3, 6, 9];

function startRace() {
  const ground = parseGroundMesh(readFileSync('public/models/track-ground.bin'));
  const solids = parseSolidMesh(readFileSync('public/models/track-solids.bin'));
  const path = parseTrackPath(readFileSync('public/models/track-path.bin'));
  const track = new Track({ ground });
  const host = new RapierWorld(rapier);
  const segmentColliders = new SegmentColliders(host, ground);
  const solidColliders = new SegmentColliders(host, solids);

  const road = track.castDown(vec3(ground.spawn.x, ground.spawn.y, ground.spawn.z), 60);
  const start = vec3(
    ground.spawn.x,
    ground.spawn.y,
    (road ? ground.spawn.z - road.distance : ground.spawn.z) + K.SPAWN_HEIGHT,
  );
  const chassis = new RapierChassis(rapier, host, start);
  segmentColliders.setActive(segmentIndexFor(start.y), 0);
  solidColliders.setActive(segmentIndexFor(start.y), 0);

  const bodies = STARTS.map((step, i) => {
    const at = waypoint(path, step);
    const under = track.castDown(vec3(at.x, at.y, at.z), 50);
    const place = vec3(at.x, at.y, (under ? at.z - under.distance : at.z) + K.RIVAL_PLACE_HEIGHT);
    segmentColliders.setActive(segmentIndexFor(at.y), i + 1);
    solidColliders.setActive(segmentIndexFor(at.y), i + 1);
    return new RapierChassis(rapier, host, place, K.RIVAL_MASS, i + 1);
  });

  const field = new RaceField({ path, probe: track, seed: 0x5eed_1234, bodies, starts: STARTS });
  const world = new World({
    seed: 0x5eed_1234, body: chassis, probe: track, track,
    stepPhysics: () => host.step(),
  });

  // Steer the player along the same line the rivals use, so that a race
  // actually happens. Holding the throttle with no steering leaves the road
  // inside two seconds - the course bends and the car does not.
  let target = 0;
  const followLine = () => {
    const p = chassis.position;
    while (target < path.count && Math.hypot(waypoint(path, target + 1).x - p.x,
      waypoint(path, target + 1).y - p.y) < 20) target++;
    if (target >= path.count) return { ...NO_INPUT, forward: true };
    const w = waypoint(path, target + 1);
    const f = chassis.forward;
    const dx = w.x - p.x, dy = w.y - p.y;
    const s = (f.x * dy - f.y * dx) / (Math.hypot(dx, dy) || 1);
    return { ...NO_INPUT, forward: true, left: s > 0.12, right: s < -0.12 };
  };

  const run = (ticks: number, drive = true) => {
    for (let t = 0; t < ticks; t++) {
      world.step(drive ? followLine() : NO_INPUT);
      field.step(chassis.position, K.MAX_SPEED, world.vehicle.forwardVel);
      segmentColliders.setActive(world.race.segment, 0);
      solidColliders.setActive(world.race.segment, 0);
      field.rivals.forEach((r, i) => {
        const seg = segmentIndexFor(r.body.position.y);
        segmentColliders.setActive(seg, i + 1);
        solidColliders.setActive(seg, i + 1);
      });
    }
  };
  return { field, world, chassis, bodies, segmentColliders, run };
}

describe('the field on the real course', () => {
  it('puts three cars on the road ahead of the player', () => {
    const { field, chassis, bodies } = startRace();
    expect(field.rivals.length).toBe(3);
    for (const b of bodies) expect(b.position.y).toBeGreaterThan(chassis.position.y);
  });

  it('keeps all three on their wheels while the player drives', () => {
    const { field, run } = startRace();
    let planted = 0;
    const samples = 60;
    for (let i = 0; i < samples; i++) {
      run(10);
      for (const r of field.rivals) if (r.state.vehicle.powerCoeff > 0) planted++;
    }
    // Three cars, sixty samples. They must be on the road for most of it -
    // which they cannot be if they share one solid segment with the player.
    expect(planted).toBeGreaterThan(samples * 3 * 0.7);
  });

  it('gives each car its own solid segment, the player included', () => {
    const { field, world, segmentColliders, run } = startRace();
    run(400);

    const seen = new Set<number>();
    seen.add(world.race.segment);
    expect(segmentColliders.isEnabled(world.race.segment, 0)).toBe(true);
    field.rivals.forEach((r, i) => {
      const seg = segmentIndexFor(r.body.position.y);
      expect(segmentColliders.isEnabled(seg, i + 1), `rival ${i} in segment ${seg}`).toBe(true);
      seen.add(seg);
    });
    // They have spread out, which is the situation a single global `active`
    // could not have survived.
    expect(seen.size).toBeGreaterThan(1);
  });

  it('never leaves a collider switched off', () => {
    const { run, segmentColliders } = startRace();
    run(300);
    for (let s = 1; s <= 37; s++) {
      expect(segmentColliders.isColliderEnabled(s), `segment ${s}`).toBe(true);
    }
  });

  it('races away down the line, all three of them', () => {
    // Fifty seconds. They start at waypoints 3, 6 and 9 and must be a long
    // way down the course, still alive and still on their wheels.
    //
    // What this does NOT show is the player climbing the order, and that is
    // honest rather than a gap: the test's autopilot is a crude pursuit of
    // the same waypoints, so the player is slower than a rival on 0.73 of
    // their own top speed and never gets close enough to pass anyone. The
    // place counter is pinned by `race-field.test.ts`, where the cars are
    // placed by hand and the crossings are exact.
    const { field, run } = startRace();
    run(2000);

    for (const r of field.rivals) {
      expect(r.state.alive, `rival ${r.index} alive`).toBe(true);
      expect(r.state.nextStep, `rival ${r.index} progress`).toBeGreaterThan(30);
      expect(r.body.position.z, `rival ${r.index} still in the world`)
        .toBeGreaterThan(K.RIVAL_RECYCLE_FLOOR_Z);
    }
    // And they are travelling together rather than one of them stalling.
    const ys = field.rivals.map((r) => r.body.position.y);
    expect(Math.max(...ys) - Math.min(...ys)).toBeLessThan(300);
  });

  it('runs the whole race identically twice', () => {
    const trace = () => {
      const { field, world, chassis, bodies, run } = startRace();
      const out: string[] = [];
      for (let i = 0; i < 60; i++) {
        run(10);
        out.push(JSON.stringify([
          field.position, field.enemiesRemaining, field.killScore,
          chassis.position.y.toFixed(5),
          world.race.segment,
          ...bodies.map((b) => b.position.y.toFixed(5)),
          ...field.rivals.map((r) => [r.state.nextStep, r.state.alive, r.duggary]),
        ]));
      }
      return out;
    };
    expect(trace()).toEqual(trace());
  });
});
