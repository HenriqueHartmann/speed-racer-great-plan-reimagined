/**
 * A rival drives the course the game shipped.
 *
 * Everything below the renderer: the quantised racing line, the shared
 * suspension, the pursuit controller and the per-vehicle colliders. If this
 * passes, what remains between it and a race is the field and the places.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { initRapier, RapierWorld, RapierChassis } from '../src/physics/rapier-body.js';
import { SegmentColliders } from '../src/physics/segment-colliders.js';
import { parseGroundMesh, parseSolidMesh } from '../src/sim/ground-mesh.js';
import { parseTrackPath, waypoint } from '../src/sim/track-path.js';
import { Track, segmentIndexFor } from '../src/sim/track.js';
import { createRivalState, headingDeg, stepRival } from '../src/sim/rival.js';
import { vec3 } from '../src/sim/vehicle.js';
import * as K from '../src/sim/constants.js';

let rapier: Awaited<ReturnType<typeof initRapier>>;
beforeAll(async () => {
  rapier = await initRapier();
});

/** One rival on the real course, placed as `prepareCar:106-108` places it. */
function startRival(startStep = 1, withBarriers = false) {
  const ground = parseGroundMesh(readFileSync('public/models/track-ground.bin'));
  const path = parseTrackPath(readFileSync('public/models/track-path.bin'));
  const track = new Track({ ground });
  const host = new RapierWorld(rapier);
  const colliders = new SegmentColliders(host, ground);
  const barriers = withBarriers
    ? new SegmentColliders(host, parseSolidMesh(readFileSync('public/models/track-solids.bin')))
    : null;

  const at = waypoint(path, startStep);
  const segment = segmentIndexFor(at.y);
  colliders.setActive(segment, 1);
  barriers?.setActive(segment, 1);

  // `prepareCar:106`: drop a 50-unit ray from the waypoint and sit one unit up.
  const road = track.castDown(vec3(at.x, at.y, at.z), 50);
  const start = vec3(at.x, at.y, (road ? at.z - road.distance : at.z) + 1);
  const body = new RapierChassis(rapier, host, start, K.RIVAL_MASS, 1);

  const state = createRivalState(startStep);
  const run = (ticks: number) => {
    for (let t = 0; t < ticks; t++) {
      stepRival(state, body, track, path);
      host.step();
      const seg = segmentIndexFor(body.position.y);
      colliders.setActive(seg, 1);
      barriers?.setActive(seg, 1);
    }
  };
  return { state, body, track, path, colliders, run };
}

describe('a rival on the real course', () => {
  it('is placed on the road at its first waypoint', () => {
    const { body, path } = startRival(1);
    const at = waypoint(path, 1);
    expect(body.position.x).toBeCloseTo(at.x, 5);
    expect(body.position.y).toBeCloseTo(at.y, 5);
    // One unit above the surface, which is where `prepareCar` puts it.
    expect(body.position.z).toBeGreaterThan(at.z - 50);
  });

  it('aims at the waypoint after the one it starts on', () => {
    // `beginSprite:16`: `pNextPathStep = pStartingPathStep + 1`.
    expect(createRivalState(7).nextStep).toBe(8);
  });

  it('advances through the waypoints without going backwards', () => {
    const { state, run } = startRival(1);
    let last = state.nextStep;
    for (let i = 0; i < 40; i++) {
      run(50);
      expect(state.nextStep).toBeGreaterThanOrEqual(last);
      last = state.nextStep;
    }
    expect(state.nextStep).toBeGreaterThan(1);
  });

  it('keeps its wheels on the drivable surface', () => {
    const { state, run } = startRival(1);
    let planted = 0;
    for (let i = 0; i < 100; i++) {
      run(20);
      if (state.vehicle.powerCoeff > 0) planted++;
    }
    // A wheel may skip a joint in the mesh; most samples must be on the road.
    expect(planted).toBeGreaterThan(80);
  });

  it('gets up to speed and stays there', () => {
    const { state, run } = startRival(1);
    run(400);
    expect(state.vehicle.forwardVel).toBeGreaterThan(20);
    // It never exceeds its own target, because the throttle is proportional.
    expect(state.vehicle.forwardVel).toBeLessThan(state.maxSpeed + 1);
  });

  it('turns toward a waypoint it is not pointing at', () => {
    const { body, state, path, run } = startRival(1);
    const target = waypoint(path, state.nextStep);
    const wanted = -Math.atan2(target.x - body.position.x, target.y - body.position.y) * (180 / Math.PI);
    const before = Math.abs(wanted - headingDeg(body));
    run(120);
    const t2 = waypoint(path, state.nextStep);
    const w2 = -Math.atan2(t2.x - body.position.x, t2.y - body.position.y) * (180 / Math.PI);
    const after = Math.abs(w2 - headingDeg(body));
    expect(after).toBeLessThan(Math.max(before, 40));
  });

  it('leaves the race when the line runs out', () => {
    const { state, body, track, path } = startRival(1);
    state.nextStep = path.count;
    const last = waypoint(path, path.count);
    body.position = vec3(last.x, last.y, body.position.z);
    stepRival(state, body, track, path);
    expect(state.alive).toBe(false);
  });

  it('does nothing at all once it is out', () => {
    const { state, body, track, path } = startRival(1);
    state.alive = false;
    const before = { ...body.linearVelocity };
    stepRival(state, body, track, path);
    expect(body.linearVelocity).toEqual(before);
  });

  it('runs identically twice from the same start', () => {
    const trace = () => {
      const { state, body, run } = startRival(1);
      const out: string[] = [];
      for (let i = 0; i < 30; i++) {
        run(10);
        out.push(JSON.stringify([
          state.nextStep,
          body.position.x.toFixed(6),
          body.position.y.toFixed(6),
          body.position.z.toFixed(6),
        ]));
      }
      return out;
    };
    expect(trace()).toEqual(trace());
  });

  it('drives over half the line before the original s own fall-recovery is due', () => {
    // Measured: it tracks the line from waypoint 1 to about 113 of 209 - some
    // 134 seconds and 6,000 units of course - and then leaves the road where
    // the course narrows to a causeway. Probing across it at y = 6020 finds
    // ground only between x 80 and x 91; there is nothing at x >= 100, and the
    // car arrives there carrying the previous corner's momentum.
    //
    // That is NOT a defect in this controller, and strengthening the
    // controller to prevent it would be a departure. The original expects a
    // rival to fall off and catches it: `doEnemy:846` recycles on
    // `chassisPos.z < -30`, a check that only makes sense for a car that has
    // left the world. The recovery is `doJump`, and it belongs to the pass
    // that adds recycling. Until then a fallen rival simply keeps falling.
    const { state, body, run } = startRival(1, true);
    for (let i = 0; i < 300 && state.alive && body.position.z > -30; i++) run(20);

    expect(state.nextStep).toBeGreaterThan(100);
    expect(body.position.y).toBeGreaterThan(5500);
  });

  it('is not stopped by the segment the player is in', () => {
    // The whole point of P0.2: the rival's solidity follows the rival.
    const { body, colliders, run } = startRival(1);
    run(200);
    const seg = segmentIndexFor(body.position.y);
    expect(colliders.isEnabled(seg, 1)).toBe(true);
    // The player, who never moved, is still filed under nothing of the rival's.
    expect(colliders.isEnabled(seg, 0)).toBe(false);
  });
});
