/**
 * Where the recovered Mach 5 sits on the road.
 *
 * This measures the exported GLB against the resting height the simulation
 * actually settles at, because the first attempt at drawing the recovered car
 * got exactly this wrong: the body kept the authoring scene's park translation
 * and rode 0.31 above its own wheels, which read on screen as four wheels
 * floating underneath a hovering car.
 *
 * Nothing here is asserted from a convention. The ride height is checked
 * against the one the artists authored, which the model carries in the form of
 * `car_shadow` - a flat plane laid on the road in the authoring scene.
 */
import { describe, it, expect } from 'vitest';
import { Glb } from './glb.js';
import {
  chassisLocalTranslation,
  GADGET_NODES,
  NEVER_DRAWN,
  volumeCentroid,
  wheelDrop,
  type Vec3Like,
} from '../src/render/model-frame.js';
import { World } from '../src/sim/world.js';
import { AnalyticBody, FlatGround } from '../src/sim/analytic-body.js';
import * as K from '../src/sim/constants.js';

const MODEL = 'public/models/mach5.glb';

/** The height the suspension settles at, in chassis units above the road. */
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

describe('the recovered Mach 5 on the road', () => {
  const glb = new Glb(MODEL);
  const park = glb.node('mach5_body').translation as Vec3Like;

  // Our simulation integrates about the centre of mass, so the chassis origin
  // is that point; the model's own origin is this far from it.
  const collider = glb.geometry('collider');
  const com = volumeCentroid(collider.positions, collider.indices);

  /** A node's z in chassis space, once the model is hung off the chassis. */
  const nodeZ = (name: string): number =>
    chassisLocalTranslation(glb.node(name), park).z - com.z;

  const hover = restingHover();
  const road = -hover;

  it('puts the collider hull s centre of mass above the model origin', () => {
    // Havok reported this as `pChassisRB.centerOfMass`; it is what makes the
    // wheel points sit at the car's waist rather than at its floor.
    expect(com.x).toBeCloseTo(0, 2);
    expect(com.z).toBeCloseTo(0.156, 2);
  });

  it('rests the tyres on the road', () => {
    const wheel = glb.bounds('mach5_wheel_FL');
    const centre = wheelDrop(hover, K.WHEEL_RADIUS);
    const bottom = centre + wheel.min[2]!;

    // The exported tyre is 0.32 in radius against a simulated 0.35, so it may
    // clear the road by that difference, but it must not dig into it.
    expect(bottom).toBeGreaterThanOrEqual(road - 0.01);
    expect(bottom - road).toBeLessThan(0.05);
  });

  it('rides at the height the artists authored', () => {
    // `car_shadow` is a flat plane; in the authoring scene it lies on the road.
    const authoredRoad = glb.node('car_shadow').translation!.z;
    const authoredUnderside = park.z + glb.bounds('mach5_body').min[2]!;
    const authoredRide = authoredUnderside - authoredRoad;

    const underside = nodeZ('mach5_body') + glb.bounds('mach5_body').min[2]!;
    const ride = underside - road;

    expect(authoredRide).toBeGreaterThan(0);
    // The original hovers a little; it must not hover a lot.
    expect(ride).toBeGreaterThan(authoredRide - 0.05);
    expect(ride).toBeLessThan(authoredRide + 0.1);
  });

  it('tucks the wheels into the body instead of hanging them below it', () => {
    const wheel = glb.bounds('mach5_wheel_FL');
    const top = wheelDrop(hover, K.WHEEL_RADIUS) + wheel.max[2]!;
    const underside = nodeZ('mach5_body') + glb.bounds('mach5_body').min[2]!;

    // Most of the tyre has to be inside the body's own depth. This is the
    // assertion that fails when the body keeps its park translation.
    expect(top).toBeGreaterThan(underside + 0.3);
  });

  it('closes the Deflector canopy over the cockpit', () => {
    // `doMach5` 569 hangs the canopy back and down from the chassis before
    // swinging it: `pCarShield.translate(0, -0.238, -0.313)`. Without that
    // nudge it floats a third of a unit clear above the car.
    const roof = nodeZ('mach5_body') + glb.bounds('mach5_body').max[2]!;
    const canopy = glb.bounds('windshield_top');
    const top = nodeZ('windshield_top') + canopy.max[2]!;
    expect(top).toBeGreaterThan(roof - 0.02);
    expect(top).toBeLessThan(roof + 0.1);

    // And it closes over the cockpit: it has to overlap the windshield it
    // shares the opening with, in both axes, rather than sit off its end.
    const shieldY = chassisLocalTranslation(glb.node('windshield_top'), park).y;
    const glassY = chassisLocalTranslation(glb.node('windshield'), park).y;
    const glass = glb.bounds('windshield');
    expect(shieldY + canopy.max[1]!).toBeGreaterThan(glassY + glass.min[1]!);
    expect(shieldY + canopy.min[1]!).toBeLessThan(glassY + glass.max[1]!);
  });

  it('never ties the periscope hatch cover to a gadget', () => {
    // The hole the cover fills. `doMach5` 128 and `doSpinner` 60 set
    // `scope_door` to `#front` once and never touch it again, so it is drawn
    // whatever the gadgets are doing. Hiding it with the Frogger opened a gap
    // in the bodywork over the periscope well.
    expect(NEVER_DRAWN.has('scope_door')).toBe(false);
    for (const [gadget, nodes] of Object.entries(GADGET_NODES)) {
      expect(nodes, `${gadget} must not own the hatch cover`).not.toContain('scope_door');
    }
  });

  it('draws the periscope mast, which it did not use to', () => {
    // This test asserted the opposite, on the strength of `doMach5:129-130`
    // and `doSpinner:61-62` setting `#none` and nothing else setting anything.
    // `doCamera:69-76` does - it addresses the models by their cloned names,
    // `Mach5CarScopeTop`, which a search for the property or the mesh name
    // never finds. The mast rises when the Frogger deploys.
    expect(NEVER_DRAWN.has('scope_top')).toBe(false);
    expect(NEVER_DRAWN.has('scope_bar')).toBe(false);
  });

  it('still stands the unused mast in its own door', () => {
    const base = nodeZ('scope_bar') + glb.bounds('scope_bar').min[2]!;
    const door = glb.bounds('scope_door');
    expect(base).toBeGreaterThan(nodeZ('scope_door') + door.min[2]! - 0.02);
    expect(base).toBeLessThan(nodeZ('scope_door') + door.max[2]! + 0.02);
  });
});

/**
 * The bug this file exists for, stated as the arrangement that caused it.
 *
 * Hanging the model off the chassis with the authoring scene's translations
 * intact - which is what a plain `scene.add(gltf.scene)` does - lifts the body
 * by the park translation plus the centre-of-mass offset, while the wheels,
 * which the simulation places rather than the artists, stay down on the road.
 *
 * The two do not quite separate: the tyre's crown still reaches the floor pan,
 * the single lowest point of the body, by about a centimetre. What is lost is
 * the tuck - the wheel sinking into the arch - and with it the only thing that
 * reads, on screen, as the wheel belonging to the car.
 */
describe('the arrangement that detached the wheels', () => {
  const glb = new Glb(MODEL);

  it('leaves the tyre grazing the floor pan instead of tucked into the arch', () => {
    const body = new AnalyticBody();
    const world = new World({
      seed: 1,
      body,
      probe: new FlatGround(),
      stepPhysics: (dt) => body.integrate(dt),
    });
    const idle = { forward: false, backward: false, left: false, right: false, jacks: false };
    for (let tick = 0; tick < 300; tick++) world.step(idle);
    const hover = world.vehicle.hoverDistances[0];

    // As authored: the body keeps its park translation and nothing accounts for
    // the centre of mass.
    const underside = glb.node('mach5_body').translation!.z + glb.bounds('mach5_body').min[2]!;
    const top = wheelDrop(hover, K.WHEEL_RADIUS) + glb.bounds('mach5_wheel_FL').max[2]!;

    expect(top - underside).toBeLessThan(0.05);
  });
});
