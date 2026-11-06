/**
 * Where a rival's parts sit on the road.
 *
 * The same measurement `mach5-placement.test.ts` makes for the player, and
 * for the same reason: the first attempt at drawing the rival kept the
 * authoring scene's park translations and left every wheel stacked at the
 * car's centre, which read on screen as a black slab hanging under a body.
 *
 * The rival's rigid body IS the Mach 5's collider - `prepareCar:90` clones
 * `"collider"` out of `member("Car_Mach5")` - so the two models must agree
 * about the road, and most of what follows is that comparison.
 */
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { RivalView } from '../src/render/rival-view.js';
import { Glb } from './glb.js';
import { wheelDrop, volumeCentroid } from '../src/render/model-frame.js';
import { WHEEL_LOCAL_POINTS } from '../src/sim/vehicle.js';
import { World } from '../src/sim/world.js';
import { AnalyticBody, FlatGround } from '../src/sim/analytic-body.js';
import * as K from '../src/sim/constants.js';

const ENEMY = 'public/models/enemy.glb';
const MACH5 = 'public/models/mach5.glb';

/** The height the suspension settles at, as the player's own test measures it. */
function restingHover(): number {
  const body = new AnalyticBody();
  const world = new World({
    seed: 1,
    body,
    probe: new FlatGround(),
    stepPhysics: (dt) => body.integrate(dt),
  });
  const idle = { forward: false, backward: false, left: false, right: false, jacks: false };
  for (let tick = 0; tick < 300; tick++) world.step(idle);
  return world.vehicle.hoverDistances[0];
}

describe('the rival on the road', () => {
  const enemy = new Glb(ENEMY);
  const mach5 = new Glb(MACH5);
  const hover = restingHover();
  const road = -hover;
  const wheelCentre = wheelDrop(hover, K.WHEEL_RADIUS);

  it('carries the parts the renderer looks for', () => {
    for (const name of [
      'car_body', 'car_bodyDuggery', 'car_windshield', 'car_shadow', 'robot',
      'mach5_wheel_FL', 'mach5_wheel_FR', 'mach5_wheel_RL', 'mach5_wheel_RR',
    ]) {
      expect(() => enemy.node(name), name).not.toThrow();
    }
  });

  it('parks its bodywork exactly where the Mach 5 parks its own', () => {
    // Both models come out of the same authoring scene and carry the same
    // offset. Keeping it is what put 0.31 of air between a body and its
    // wheels the first time; the renderer zeroes it for both.
    const e = enemy.node('car_body').translation!;
    const m = mach5.node('mach5_body').translation!;
    expect(e.z).toBeCloseTo(m.z, 5);
    expect(e.y).toBeCloseTo(m.y, 5);
    expect(e.z).toBeGreaterThan(0.3);
  });

  it('gives its wheels no position of their own at all', () => {
    // Which is why `setZ` was not enough: with x and y left at zero, all four
    // wheels sit inside the car. They have to be placed at the wheel points.
    for (const n of ['mach5_wheel_FL', 'mach5_wheel_FR', 'mach5_wheel_RL', 'mach5_wheel_RR']) {
      expect(enemy.node(n).translation, n).toBeNull();
    }
    expect(WHEEL_LOCAL_POINTS.length).toBe(4);
    for (const p of WHEEL_LOCAL_POINTS) {
      expect(Math.abs(p.x)).toBeGreaterThan(0.5);
      expect(Math.abs(p.y)).toBeGreaterThan(0.5);
    }
  });

  it('rests its tyres on the road, as the player s do', () => {
    const tyre = enemy.bounds('mach5_wheel_FL');
    const bottom = wheelCentre + tyre.min[2]!;
    // The exported tyre is 0.32 in radius against a simulated 0.35, so it may
    // clear the road by that difference, but it must not dig in.
    expect(bottom).toBeGreaterThanOrEqual(road - 0.01);
    expect(bottom - road).toBeLessThan(0.05);
  });

  it('tucks its wheels into the body instead of hanging them below it', () => {
    const tyre = enemy.bounds('mach5_wheel_FL');
    const top = wheelCentre + tyre.max[2]!;
    const com = (() => {
      const g = mach5.geometry('collider');
      return volumeCentroid(g.positions, g.indices);
    })();
    // The body hangs at -com inside the chassis; the wheels hang off the
    // chassis itself. This is the assertion that fails if the two are
    // collapsed into one node and the offset is wiped by the orientation.
    const underside = -com.z + enemy.bounds('car_body').min[2]!;
    expect(top).toBeGreaterThan(underside + 0.3);
  });

  it('sits the same height off the road as the player s car', () => {
    // Same collider, same centre of mass, same suspension: if these two ever
    // disagree, one of the two renderers has drifted.
    const e = enemy.bounds('car_body').min[2]!;
    const m = mach5.bounds('mach5_body').min[2]!;
    expect(e).toBeCloseTo(m, 2);
  });
});

describe('RivalView', () => {
  /**
   * Built without a loader, from a stand-in with the same node names. The
   * real GLB cannot be loaded here - `GLTFLoader` wants a DOM - but the
   * structure this class builds is its own and is what went wrong.
   */
  function stubScene(): THREE.Object3D {
    const root = new THREE.Group();
    root.name = 'SceneRoot';
    for (const name of [
      'car_body', 'car_bodyDuggery', 'car_windshield', 'car_shadow', 'robot',
      'mach5_wheel_FL', 'mach5_wheel_FR', 'mach5_wheel_RL', 'mach5_wheel_RR',
    ]) {
      const node = new THREE.Object3D();
      node.name = name;
      node.position.set(0, 0.037, 0.311); // the authoring park, as the GLB has it
      root.add(node);
    }
    return root;
  }

  it('gives every car its own four wheels', () => {
    // Car 0 used to keep the template while the others cloned it afterwards,
    // so the wheels were reparented away before the clones were taken and
    // cars 1 and 2 came out bare.
    const view = RivalView.fromScene(stubScene(), 3, { x: 0, y: 0, z: 0.156 });
    for (let i = 0; i < 3; i++) {
      const chassis = view.object.getObjectByName(`rival_${i}`)!;
      expect(chassis, `rival ${i}`).toBeDefined();
      const wheels = ['mach5_wheel_FL', 'mach5_wheel_FR', 'mach5_wheel_RL', 'mach5_wheel_RR']
        .map((n) => chassis.getObjectByName(n));
      expect(wheels.filter(Boolean).length, `rival ${i} wheels`).toBe(4);
    }
  });

  it('hangs the wheels off the chassis and the body off the offset', () => {
    const com = { x: 0, y: 0, z: 0.156 };
    const view = RivalView.fromScene(stubScene(), 1, com);
    const chassis = view.object.getObjectByName('rival_0')!;
    const body = view.object.getObjectByName('rival_0_body')!;

    expect(body.position.z).toBeCloseTo(-com.z, 6);
    // A wheel's parent is the chassis, not the body: if it were the body it
    // would inherit the offset, which its wheel point already accounts for.
    expect(chassis.getObjectByName('mach5_wheel_FL')!.parent).toBe(chassis);
    expect(body.getObjectByName('car_body')!.parent!.parent).toBe(body);
  });

  it('throws the authoring park away and hides the shadow', () => {
    const view = RivalView.fromScene(stubScene(), 1, { x: 0, y: 0, z: 0.156 });
    const chassis = view.object.getObjectByName('rival_0')!;
    for (const name of ['car_body', 'car_bodyDuggery', 'car_windshield', 'robot']) {
      expect(chassis.getObjectByName(name)!.position.z, name).toBe(0);
    }
    expect(chassis.getObjectByName('car_shadow')!.visible).toBe(false);
  });

  it('keeps the orientation from wiping the centre-of-mass offset', () => {
    const com = { x: 0, y: 0, z: 0.156 };
    const view = RivalView.fromScene(stubScene(), 1, com);
    view.update([{
      position: { x: 5, y: 7, z: 11 },
      forward: { x: 0, y: 1, z: 0 },
      up: { x: 0, y: 0, z: 1 },
      hoverDistances: [1, 1, 1, 1],
      alive: true, duggary: false, spun: false,
    }]);
    expect(view.object.getObjectByName('rival_0')!.position.z).toBe(11);
    expect(view.object.getObjectByName('rival_0_body')!.position.z).toBeCloseTo(-com.z, 6);
  });

  it('places each wheel at its own wheel point, not at the car s centre', () => {
    const view = RivalView.fromScene(stubScene(), 1, { x: 0, y: 0, z: 0.156 });
    view.update([{
      position: { x: 0, y: 0, z: 0 },
      forward: { x: 0, y: 1, z: 0 },
      up: { x: 0, y: 0, z: 1 },
      hoverDistances: [1, 1, 1, 1],
      alive: true, duggary: false, spun: false,
    }]);
    const chassis = view.object.getObjectByName('rival_0')!;
    const names = ['mach5_wheel_FL', 'mach5_wheel_FR', 'mach5_wheel_RL', 'mach5_wheel_RR'];
    names.forEach((n, i) => {
      const p = chassis.getObjectByName(n)!.position;
      expect(p.x, `${n} x`).toBeCloseTo(WHEEL_LOCAL_POINTS[i]!.x, 6);
      expect(p.y, `${n} y`).toBeCloseTo(WHEEL_LOCAL_POINTS[i]!.y, 6);
      expect(p.z, `${n} z`).toBeLessThan(0);
    });
    // And no two of them are in the same place, which is how they looked.
    const spots = new Set(names.map((n) => {
      const p = chassis.getObjectByName(n)!.position;
      return `${p.x},${p.y}`;
    }));
    expect(spots.size).toBe(4);
  });

  it('shows one body or the other, never both', () => {
    const view = RivalView.fromScene(stubScene(), 1, { x: 0, y: 0, z: 0.156 });
    const base = {
      position: { x: 0, y: 0, z: 0 }, forward: { x: 0, y: 1, z: 0 }, up: { x: 0, y: 0, z: 1 },
      hoverDistances: [1, 1, 1, 1], alive: true, spun: false,
    };
    const chassis = view.object.getObjectByName('rival_0')!;

    view.update([{ ...base, duggary: false }]);
    expect(chassis.getObjectByName('car_body')!.visible).toBe(true);
    expect(chassis.getObjectByName('car_bodyDuggery')!.visible).toBe(false);

    view.update([{ ...base, duggary: true }]);
    expect(chassis.getObjectByName('car_body')!.visible).toBe(false);
    expect(chassis.getObjectByName('car_bodyDuggery')!.visible).toBe(true);
  });

  it('hides a car that has left the race', () => {
    const view = RivalView.fromScene(stubScene(), 1, { x: 0, y: 0, z: 0.156 });
    view.update([{
      position: { x: 0, y: 0, z: 0 }, forward: { x: 0, y: 1, z: 0 }, up: { x: 0, y: 0, z: 1 },
      hoverDistances: [1, 1, 1, 1], alive: false, duggary: false, spun: false,
    }]);
    expect(view.object.getObjectByName('rival_0')!.visible).toBe(false);
  });
});
