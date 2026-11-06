/**
 * How the recovered Mach 5 model is assembled onto the chassis.
 *
 * The exported GLB is the *authoring* scene: the artists parked each model
 * where it was convenient to edit it. The game never used those positions. At
 * runtime `doMach5` pins every visible part straight onto the collider's
 * transform - `tTrans = pCarBody.transform`, then
 *
 *   pCarShell.transform      = tTrans      (line 512)
 *   pCarWindshield.transform = tTrans      (line 513)
 *   pCarScopeDoor.transform.position/rotation                (514-515)
 *   pCarShield.transform     = tTrans      (568, 577)
 *   pCarSaws.transform       = tTrans      (586, 589, 608)
 *   pCarLights.transform     = tTrans      (623, 626)
 *   pCarJacks.transform      = tTrans      (637)
 *
 * so each of those parts sits at the chassis origin with *no* offset, and its
 * authored translation is discarded. Keeping the authored translation instead
 * is what left the body riding 0.31 above its own wheels.
 *
 * Two things are measured rather than assumed, and both are checked by
 * `tests/mach5-placement.test.ts` against the GLB itself:
 *
 *   - The canopy proves the rule. `windshield_top` is parked at z 0 with its
 *     mesh spanning z 0.34..0.67, and the body's roof is at z 0.33. The two
 *     only mate if the body's park translation of +0.31 is dropped as well:
 *     keep it and the roof rises to 0.64 and swallows the canopy whole.
 *   - The drop shadow proves the ride height. `car_shadow` is a flat plane the
 *     original laid on the road; de-parked it sits 0.84 below the centre of
 *     mass, and the suspension rests with the road 0.90 below it. The 0.07
 *     between them is the hover the car is supposed to have.
 */

/** A plain vector, so this module stays free of three.js and of the DOM. */
export interface Vec3Like {
  x: number;
  y: number;
  z: number;
}

/**
 * Parts the original pinned straight onto the chassis transform. Their authored
 * translation is editor parking and is dropped.
 */
export const PINNED_TO_CHASSIS: ReadonlySet<string> = new Set([
  'mach5_body',
  'windshield',
  'windshield_top',
  'jacks',
  'saw',
  'lights',
  'scope_door',
]);

/**
 * Parts the original pins to the chassis and then nudges off it.
 *
 * Only the canopy. `doMach5` line 569 reads
 *
 *     pCarShield.transform = tTrans
 *     pCarShield.translate(0, -0.238, -0.313)
 *     pCarShield.rotate(pSheildRotate, 0, 0)
 *
 * so the canopy hangs back and down from the chassis origin, and swings about
 * that point. `pSheildRotate` ramps between 0 and 80 degrees in steps of 5 -
 * the canopy is hinged, not switched - and we draw only the closed end of that
 * travel, where the rotation is the identity. The hinge itself is not animated
 * here yet.
 */
export const CHASSIS_OFFSET: ReadonlyMap<string, Vec3Like> = new Map([
  ['windshield_top', { x: 0, y: -0.238, z: -0.313 }],
  // The periscope, from `doCamera:73-74`: both halves are placed at the
  // chassis transform and then translated by this. An earlier version of this
  // file inferred an offset for them by de-parking the authoring translation,
  // which landed in roughly the right place for the wrong reason; this is the
  // number the game uses. The renderer then animates z by `scopeFactor`.
  ['scope_bar', { x: -0.3, y: -0.9, z: 0.246 }],
  ['scope_top', { x: -0.3, y: -0.9, z: 0.246 }],
]);

/**
 * Parts the model carries that the game never draws.
 *
 * `collider` is the physics hull Havok was given, not bodywork, and
 * `car_shadow` is a flat blob used as a drop shadow - we have real shadow
 * mapping, so drawing it as well would double up.
 *
 * `scope_top` and `scope_bar` are **not** here, and a previous version of this
 * comment was wrong to put them here. It claimed the game never shows the
 * periscope mast, on the strength of `doMach5:129-130` and `doSpinner:61-62`
 * setting `#none` and nothing setting anything else.
 *
 * Nothing in those files does. `doCamera:69-76` does, and it was missed
 * because it addresses the models by their *cloned* names - `g3DWorld.model
 * ("Mach5CarScopeTop")`, built as `pCarName & "CarScopeTop"` - so a search for
 * the property or the mesh name finds neither. The mast rises, extends, and
 * its head turns 20 degrees a frame. See `mach5-original.ts`.
 */
export const NEVER_DRAWN: ReadonlySet<string> = new Set(['collider', 'car_shadow']);

/**
 * Parts that are always drawn, whatever the gadgets are doing.
 *
 * `scope_door` is the hatch *cover*. The original sets it `#front` once and
 * never touches it again, in both `doMach5` (128) and `doSpinner` (60). Tying
 * it to the Frogger hid it whenever the gadget was off, which left a hole in
 * the bodywork over the periscope well.
 */
export const ALWAYS_DRAWN: ReadonlySet<string> = new Set(['scope_door']);

/**
 * RECOVERED - `pWheelList[i].transform.position = worldWheelPoint +
 * (t * worldDownDir) - (pWheelRadius * worldDownDir)` with
 * `t = max(0.75, pHoverDistList[i])`, from the wheel loop at line 1028.
 *
 * The wheel point is at the centre of mass' own height - `pWheelPointList` is
 * built as `com +- pFrontWheelBase * forward +- pwidth/2 * right`, with no
 * vertical term - so this drop is measured from the chassis origin our
 * simulation uses, and the result puts the tyre's underside on the road.
 */
export function wheelDrop(hoverDistance: number, wheelRadius: number): number {
  return -(Math.max(WHEEL_DROP_FLOOR, hoverDistance) - wheelRadius);
}

/**
 * RECOVERED - the original floors the suspension distance here before using it
 * to drop the wheel, so a fully extended corner still has its wheel on the car.
 */
export const WHEEL_DROP_FLOOR = 0.75;

/**
 * The centre of mass of a closed mesh of uniform density, which is what Havok
 * reported as `pChassisRB.centerOfMass` for the `collider` hull.
 *
 * Our simulation integrates about the centre of mass, so `body.position` *is*
 * that point, while the original's `pChassisRB.position` was the model origin
 * and `centerOfMass` the offset between them. Drawing the model at the chassis
 * origin without subtracting this offset lifts the whole car by 0.16.
 *
 * Signed tetrahedron volumes against the origin; the sign cancels, so winding
 * does not matter as long as it is consistent.
 */
export function volumeCentroid(
  positions: ArrayLike<number>,
  indices: ArrayLike<number> | null,
): Vec3Like {
  const count = indices ? indices.length : positions.length / 3;
  const at = (i: number): number => (indices ? indices[i]! : i);

  let volume = 0;
  let cx = 0;
  let cy = 0;
  let cz = 0;

  for (let i = 0; i + 2 < count; i += 3) {
    const a = at(i) * 3;
    const b = at(i + 1) * 3;
    const c = at(i + 2) * 3;

    const ax = positions[a]!, ay = positions[a + 1]!, az = positions[a + 2]!;
    const bx = positions[b]!, by = positions[b + 1]!, bz = positions[b + 2]!;
    const cx3 = positions[c]!, cy3 = positions[c + 1]!, cz3 = positions[c + 2]!;

    const v =
      (ax * (by * cz3 - bz * cy3) - ay * (bx * cz3 - bz * cx3) + az * (bx * cy3 - by * cx3)) / 6;

    volume += v;
    cx += (v * (ax + bx + cx3)) / 4;
    cy += (v * (ay + by + cy3)) / 4;
    cz += (v * (az + bz + cz3)) / 4;
  }

  if (volume === 0) return { x: 0, y: 0, z: 0 };
  return { x: cx / volume, y: cy / volume, z: cz / volume };
}

/** One node of the exported scene, as either three.js or a raw GLB can supply it. */
export interface AuthoredNode {
  name: string;
  /** The authored translation, or null when the node has none. */
  translation: Vec3Like | null;
}

/**
 * Where a node belongs once the model hangs off the chassis.
 *
 * Shared by the renderer and by `tests/mach5-placement.test.ts`, so the test
 * exercises the rule the game actually uses rather than a restatement of it.
 */
export function chassisLocalTranslation(node: AuthoredNode, _park: Vec3Like): Vec3Like {
  if (PINNED_TO_CHASSIS.has(node.name)) {
    const pinnedNudge = CHASSIS_OFFSET.get(node.name);
    return pinnedNudge ? { ...pinnedNudge } : { x: 0, y: 0, z: 0 };
  }

  const nudge = CHASSIS_OFFSET.get(node.name);
  if (nudge) return { ...nudge };
  return node.translation ?? { x: 0, y: 0, z: 0 };
}

/**
 * Which nodes each gadget shows, from `prepareCar`'s bindings.
 *
 * The Frogger has no model of its own. Pressing it sets `pHasScope = 1` and,
 * on the next line, `pHasShield = 1` (`doMach5` 316-317), so what you see is
 * the Deflector's canopy closing; the periscope itself is the scope camera.
 * That is why `frogger` is not a group here - it shares `shield`.
 */
export const GADGET_NODES = {
  jacks: ['jacks'],
  blades: ['saw'],
  lights: ['lights'],
  /** Closed by the Deflector and by the Frogger alike. */
  shield: ['windshield_top'],
  robot: ['ROBOT'],
} as const;

/**
 * What the renderer does with a node of the decoded level.
 *
 * `PREP` gives the three solid kinds different treatment and the renderer has
 * to follow it, so one boolean is no longer enough:
 *
 *   - `WALL_` is drawn and solid (`PREP:438`, `visibility = #front`)
 *   - `INV_` is **solid and unseen** (`PREP:452`, `visibility = #none`) - the
 *     out-of-bounds fences
 *   - `RAIL_` is drawn and solid, double-sided (`PREP:326`, `#both`)
 *   - `MISC_` is drawn and **inert**: no branch of `PREP`'s dispatcher matches
 *     `"MIS"` at all, so those 23 models get no body and no modifier. Scenery.
 *
 * Whether a node is *solid* is not this function's business - that comes from
 * `track-solids.bin`, which carries only the first three. This decides what is
 * seen. Everything else is hidden until its own step: trees, pickups, water,
 * the sky, the racing line.
 *
 * The zero-padding in this file is inconsistent - `MISC_1` beside `MISC_08`,
 * `Tree_01` beside `Tree_388` - so the patterns accept any run of digits.
 */
export type TrackNodeRole = 'drawn' | 'hidden';

const DRAWN = /^(SEG|WALL|RAIL|MISC|WATER)_\d+$/;
/** The skydome, which `PREP:64` picks out by name and the camera carries. */
const SKY = /^Sphere\d+$/;
/** The level's objects, drawn from their own decoded meshes. */
const DRAWN_OBJECTS = /^(Tree_\d+|pickup_[A-Za-z]+\d+)$/;

export function trackNodeRole(name: string): TrackNodeRole {
  return DRAWN.test(name) || DRAWN_OBJECTS.test(name) || SKY.test(name) ? 'drawn' : 'hidden';
}

/** Whether a node is one of the water planes, which slosh and never collide. */
export function isWaterNode(name: string): boolean {
  return /^WATER_\d+$/.test(name);
}

/** Whether a node is the skydome. */
export function isSkyNode(name: string): boolean {
  return SKY.test(name);
}

/**
 * Whether a node is one of the level's individual objects.
 *
 * They are drawn from their own decoded geometry rather than from the
 * placeholder boxes `createPropViews` builds, and they are hidden and shown
 * as the simulation consumes them - so the renderer needs to find them by
 * name and match them to a `Prop`.
 */
export function isTrackObjectNode(name: string): boolean {
  return DRAWN_OBJECTS.test(name);
}
