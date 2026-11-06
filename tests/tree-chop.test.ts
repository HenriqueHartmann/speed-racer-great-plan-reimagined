/**
 * The saw fells a tree; the bodywork does not.
 *
 * `MOVIE.ls:153-167` and `doMach5:351-363` flip both halves together: with
 * the Blades up the segment's trees lose their rigid body against the Mach 5
 * and gain their chop trigger, and with them down the reverse. Both halves
 * were half-built - the simulation knew what a felled tree was and the
 * physics never let the car reach one.
 *
 * Play reported it: "as blades não as cortam, mas deveriam".
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { initRapier, RapierWorld, RapierChassis } from '../src/physics/rapier-body.js';
import { PropColliders } from '../src/physics/prop-colliders.js';
import { flatGroundMesh } from '../src/sim/ground-mesh.js';
import { Track } from '../src/sim/track.js';
import { World } from '../src/sim/world.js';
import { NO_INPUT, vec3 } from '../src/sim/vehicle.js';
import * as K from '../src/sim/constants.js';

let rapier: Awaited<ReturnType<typeof initRapier>>;
beforeAll(async () => {
  rapier = await initRapier();
});

/** A straight run with one tree planted 30 units ahead. */
function runAtTree(raiseBlades: boolean, ticks = 200) {
  const track = new Track({ ground: flatGroundMesh(3) });
  const host = new RapierWorld(rapier);
  const body = new RapierChassis(rapier, host, vec3(0, 100, K.SPAWN_HEIGHT));
  const world = new World({
    seed: 1, body, probe: track, track, stepPhysics: () => host.step(),
  });
  const tree = track.addProp(1, 'tree', vec3(0, 130, 1), vec3(0.2, 0.22, 4.2))!;
  const colliders = new PropColliders(host, track);
  colliders.setActive(1);

  if (raiseBlades) {
    for (let t = 0; t < 12; t++) {
      world.step({ ...NO_INPUT, gadgetPresses: t === 0 ? ['blades'] : [] });
    }
  }
  for (let t = 0; t < ticks; t++) {
    world.step({ ...NO_INPUT, forward: true });
    colliders.setBladesActive(0, world.vehicle.hasBlades);
    colliders.sync();
  }
  return { world, body, tree, colliders };
}

describe('a tree in the road', () => {
  it('stops the car and hurts it when the saw is down', () => {
    const { world, body, tree, colliders } = runAtTree(false);
    expect(body.position.y).toBeLessThan(130);
    expect(tree.active, 'still standing').toBe(true);
    expect(colliders.enabledIds(), 'still solid').toContain(tree.id);
    expect(world.race.damage).toBeGreaterThan(0);
  });

  it('is driven through and felled when the saw is up', () => {
    const { world, body, tree, colliders } = runAtTree(true);
    expect(body.position.y).toBeGreaterThan(140);
    expect(tree.active, 'felled').toBe(false);
    expect(colliders.enabledIds(), 'no longer solid').not.toContain(tree.id);
    // `doHitTree` scores nothing and costs nothing. A felled tree is
    // spectacle, not a reward.
    expect(world.race.damage).toBe(0);
    expect(world.race.score).toBe(0);
  });

  it('keeps the tree solid for everyone whose saw is not up', () => {
    // `doMach5:353` names the car: `disableCollision(pCarBody.name, tree)`.
    // A rival with no saw must still hit the tree the player drives through.
    const track = new Track({ ground: flatGroundMesh(3) });
    const host = new RapierWorld(rapier);
    const tree = track.addProp(1, 'tree', vec3(0, 130, 1), vec3(0.2, 0.22, 4.2))!;
    const colliders = new PropColliders(host, track);
    colliders.setActive(1, 0);
    colliders.setActive(1, 1);

    colliders.setBladesActive(0, true);

    expect(colliders.enabledIds(0), 'intangible to the player').not.toContain(tree.id);
    expect(colliders.enabledIds(1), 'still solid for the rival').toContain(tree.id);
  });

  it('makes the tree solid again when the saw comes down', () => {
    const track = new Track({ ground: flatGroundMesh(3) });
    const host = new RapierWorld(rapier);
    const tree = track.addProp(1, 'tree', vec3(0, 130, 1), vec3(0.2, 0.22, 4.2))!;
    const colliders = new PropColliders(host, track);
    colliders.setActive(1);

    colliders.setBladesActive(0, true);
    expect(colliders.enabledIds()).not.toContain(tree.id);
    colliders.setBladesActive(0, false);
    expect(colliders.enabledIds()).toContain(tree.id);
  });

  it('leaves walls solid whatever the saw is doing', () => {
    // Only `SEG_TRE` is in the loop the Blades walk. A wall is not a tree.
    const track = new Track({ ground: flatGroundMesh(3) });
    const host = new RapierWorld(rapier);
    const wall = track.addProp(1, 'wall', vec3(0, 130, 1), vec3(2, 0.5, 2))!;
    const colliders = new PropColliders(host, track);
    colliders.setActive(1);

    colliders.setBladesActive(0, true);
    expect(colliders.enabledIds()).toContain(wall.id);
  });
});

describe('the simulation s collision box', () => {
  it('is the box the physics uses', () => {
    // They were separate numbers, and when the collider was corrected to the
    // recovered hull this one was not. Rapier then stopped the car 0.58
    // short of where the simulation believed its nose to be, so a tree
    // blocked the car and registered no impact at all - zero damage, zero
    // events, the car simply parked against it.
    const { world } = runAtTree(false, 120);
    expect(world.race.damage).toBeGreaterThan(0);
  });
});
