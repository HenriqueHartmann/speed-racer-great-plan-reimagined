/**
 * The physical life of a prop.
 *
 * The simulation has always obeyed the original's rule that **only the car's
 * own segment is tangible** — `doM5ChangeSegment` (`MOVIE.ls:124-146`)
 * disables the old segment's collisions and enables the new one's, and
 * `Track.collidableProps` reads only `activeSegment`. The physics world did
 * not: every prop's collider was created at startup and never disabled, so a
 * wall in segment 9 would have stopped a car in segment 8.
 *
 * It was invisible because the track ships with no props. These tests exist so
 * that it cannot come back once it does.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { initRapier, RapierWorld } from '../src/physics/rapier-body.js';
import { PropColliders } from '../src/physics/prop-colliders.js';
import { flatGroundMesh } from '../src/sim/ground-mesh.js';
import { Track } from '../src/sim/track.js';
import { vec3 } from '../src/sim/vehicle.js';

let rapier: Awaited<ReturnType<typeof initRapier>>;
beforeAll(async () => {
  rapier = await initRapier();
});

/** Four segments: 1 and 3 hold a wall, 2 holds only a pickup, 4 is empty. */
function track(): Track {
  const t = new Track({ ground: flatGroundMesh(4) });
  t.addProp(1, 'wall', vec3(0, 100, 1), vec3(2, 2, 2));
  t.addProp(2, 'pickup', vec3(0, 400, 1), vec3(1, 1, 1), 'wrench');
  t.addProp(3, 'wall', vec3(0, 700, 1), vec3(2, 2, 2));
  t.addProp(3, 'faller', vec3(4, 760, 1), vec3(1, 1, 3));
  return t;
}

describe('PropColliders', () => {
  it('gives a collider to every solid and none to a pickup', () => {
    // A pickup is a trigger in the original - `PREP:394-428` gives it a
    // collision modifier and no rigid body - so it must never block the car.
    const t = track();
    const colliders = new PropColliders(new RapierWorld(rapier), t);
    const ids = [...t.segments.flatMap((s) => s.props)];
    expect(colliders.has(ids.find((p) => p.kind === 'wall')!.id)).toBe(true);
    expect(colliders.has(ids.find((p) => p.kind === 'faller')!.id)).toBe(true);
    expect(colliders.has(ids.find((p) => p.kind === 'pickup')!.id)).toBe(false);
  });

  it('starts with nothing enabled until a segment is chosen', () => {
    const t = track();
    const colliders = new PropColliders(new RapierWorld(rapier), t);
    expect(colliders.enabledIds()).toEqual([]);
  });

  it('enables exactly the active segment, in both directions', () => {
    const t = track();
    const colliders = new PropColliders(new RapierWorld(rapier), t);
    const idsIn = (s: number) => t.segment(s)!.props.filter((p) => p.kind !== 'pickup').map((p) => p.id);

    colliders.setActive(1);
    expect(colliders.enabledIds()).toEqual(idsIn(1));
    colliders.setActive(3);
    expect(colliders.enabledIds()).toEqual(idsIn(3));
    colliders.setActive(1);
    expect(colliders.enabledIds()).toEqual(idsIn(1));
  });

  it('leaves a segment with no solids genuinely empty', () => {
    // Segment 2 holds only a pickup; segment 4 holds nothing. Neither may
    // leave another segment's props standing.
    const t = track();
    const colliders = new PropColliders(new RapierWorld(rapier), t);
    colliders.setActive(1);
    colliders.setActive(2);
    expect(colliders.enabledIds()).toEqual([]);
    colliders.setActive(4);
    expect(colliders.enabledIds()).toEqual([]);
  });

  it('never enables a prop of an inactive segment', () => {
    const t = track();
    const colliders = new PropColliders(new RapierWorld(rapier), t);
    for (const s of [1, 2, 3, 4, 3, 2, 1]) {
      colliders.setActive(s);
      for (const id of colliders.enabledIds()) {
        const owner = t.segments.find((seg) => seg.props.some((p) => p.id === id))!;
        expect(owner.index, `prop ${id} enabled while in segment ${s}`).toBe(s);
      }
    }
  });

  it('disables a consumed prop without destroying it', () => {
    const t = track();
    const colliders = new PropColliders(new RapierWorld(rapier), t);
    const wall = t.segment(1)!.props[0]!;
    colliders.setActive(1);
    expect(colliders.enabledIds()).toContain(wall.id);

    wall.active = false;
    colliders.sync();
    expect(colliders.enabledIds()).not.toContain(wall.id);
    expect(colliders.has(wall.id)).toBe(true); // still owned, not removed
  });

  it('restores a consumed prop on restart', () => {
    // The bug this replaces destroyed the collider, so a restart brought the
    // prop back as a ghost: visible, and you drove straight through it.
    const t = track();
    const colliders = new PropColliders(new RapierWorld(rapier), t);
    const wall = t.segment(1)!.props[0]!;
    colliders.setActive(1);
    wall.active = false;
    colliders.sync();

    wall.active = true;
    colliders.setActive(1);
    expect(colliders.enabledIds()).toContain(wall.id);
  });
});
