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
 * The periscope mast is the one assembly `doMach5` clones but never positions -
 * it only ever hides it. Its two parts were authored *relative to the parked
 * shell*, and they prove it: de-parked, the mast's base lands at z 0.255, in
 * the middle of `scope_door`'s panel (z 0.199..0.310), and its top mates with
 * `scope_top` to the third decimal. So these keep their offset, minus the park.
 *
 * Nothing draws them - see `NEVER_DRAWN` - but placing them correctly costs
 * nothing and keeps the recovered measurement where it can be checked.
 */
export const DEPARKED_FROM_SHELL: ReadonlySet<string> = new Set(['scope_bar', 'scope_top']);

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
]);

/**
 * Parts the model carries that the game never draws.
 *
 * `collider` is the physics hull Havok was given, not bodywork, and
 * `car_shadow` is a flat blob used as a drop shadow - we have real shadow
 * mapping, so drawing it as well would double up.
 *
 * `scope_top` and `scope_bar` are the periscope mast. Every script that touches
 * them sets `#none` and no script ever sets anything else - `doMach5` 129-130
 * and `doSpinner` 61-62 are the only six lines in the game that mention them.
 * The Frogger's periscope is a *camera*, not a model: `SCOPEMODE`, the
 * `scopeCam` camera and the `ovScopeUnder` / `ovScopeStatic` / `ovScopeFrame`
 * overlays in `doCamera`. Nothing rises out of the car.
 */
export const NEVER_DRAWN: ReadonlySet<string> = new Set([
  'collider',
  'car_shadow',
  'scope_top',
  'scope_bar',
]);

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
export function chassisLocalTranslation(node: AuthoredNode, park: Vec3Like): Vec3Like {
  if (PINNED_TO_CHASSIS.has(node.name)) {
    const nudge = CHASSIS_OFFSET.get(node.name);
    return nudge ? { ...nudge } : { x: 0, y: 0, z: 0 };
  }

  const t = node.translation ?? { x: 0, y: 0, z: 0 };
  if (DEPARKED_FROM_SHELL.has(node.name)) {
    return { x: t.x - park.x, y: t.y - park.y, z: t.z - park.z };
  }
  return t;
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
 * Whether a node of the decoded track world is drawn.
 *
 * Only the 37 road segments, `SEG_1` through `SEG_37`. Resource 7587 also
 * carries the things `PREP` hides - the `INV_` colliders, the `FAL_*_TGR`
 * faller triggers, anything named `Finish*` - and `carPos_Mach5` and
 * `path_01..path_209`, which are coordinates rather than art: the start line
 * and the rival racing line. Drawn literally they would all appear.
 *
 * The props arrive in their own step, where each can be checked against
 * `PREP`'s own visibility pass one at a time.
 */
export function isDrawnTrackNode(name: string): boolean {
  return /^SEG_\d+$/.test(name);
}
