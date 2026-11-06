/**
 * Constants recovered from the original game, and the substitutes we chose where
 * recovery was not possible.
 *
 * Every value carries its evidence status and its source. See
 * `docs/research/handling-contract.md` for the full derivation.
 *
 *   RECOVERED - read directly out of decompiled Lingo
 *   SUBSTITUTE - our own value, because the original could not be ported faithfully
 */

/** Where a value came from, so nothing here looks more certain than it is. */
export type Provenance = 'RECOVERED' | 'SUBSTITUTE';

// ---------------------------------------------------------------------------
// World
// ---------------------------------------------------------------------------

/**
 * RECOVERED - `BehaviorScript 2 - Havok Physics`, `beginSprite`:
 * `gHavok.gravity = vector(0, 0, -90.81)`.
 *
 * The original is Z-up. We keep its axis convention inside the simulation so the
 * recovered numbers stay directly comparable; the renderer converts.
 */
export const GRAVITY_Z = -90.81;

/**
 * RECOVERED - property default `pTimeStep`. The Havok Xtra Lingo Reference Guide
 * confirms this is the TOTAL simulated time advanced per `step()` call, which the
 * sub-steps then subdivide.
 */
export const TIMESTEP = 0.025;

/** RECOVERED - property default `pSubSteps`. */
export const SUBSTEPS = 5;

/**
 * RECOVERED - the movie's `DRCF` config chunk gives a tempo of 30, and the Havok
 * behaviour steps the world exactly once per Director frame with no accumulator.
 *
 * Note what this means: the original advanced 30 x 0.025 = 0.75 seconds of
 * simulated time per real second, and only when it actually hit its tempo. We run
 * the simulation at a fixed rate instead - see `TICK_HZ`.
 */
export const ORIGINAL_TEMPO_FPS = 30;

/**
 * SUBSTITUTE - we run the fixed-timestep simulation at the original's nominal
 * update rate, so that every per-frame constant below keeps its meaning. The
 * original's per-update values are denominated in frames, not seconds, so
 * changing this rate changes handling.
 */
export const TICK_HZ = ORIGINAL_TEMPO_FPS;

/**
 * Wall-clock duration of one tick. Used for real-time timers such as the Jacks
 * cooldown.
 *
 * This is NOT what the physics advances per tick - that is TIMESTEP. The two
 * differ on purpose: the original advanced 0.025 s of simulated time per frame
 * while its frames arrived 1/30 s apart, so simulated time ran at 0.75x real
 * time and every force constant was tuned against that ratio.
 */
export const TICK_DT = 1 / TICK_HZ;

/** RECOVERED - Director's `the ticks` is 1/60 s (Director MX Lingo Dictionary). */
export const TICKS_PER_SECOND = 60;

// ---------------------------------------------------------------------------
// Chassis
// ---------------------------------------------------------------------------

/** RECOVERED - `prepareCar`: the chassis rigid body has no contact friction. */
export const CHASSIS_FRICTION = 0;

/** RECOVERED - `prepareCar`: and no restitution. */
export const CHASSIS_RESTITUTION = 0;

/** RECOVERED - `beginSprite`: `pCarMass = 30000`. */
export const CHASSIS_MASS = 30000;

// ---------------------------------------------------------------------------
// Suspension - four-point raycast hover
// ---------------------------------------------------------------------------

/** RECOVERED - `pStrength`. */
export const SUSPENSION_STRENGTH = 3.0;
/** RECOVERED - `pDamping`. */
export const SUSPENSION_DAMPING = 0.05;
/**
 * RECOVERED - `pHoverDist`. This is the spring's rest length, NOT the height the
 * car settles at. The original cast its rays with `#maxDistance: 1`, shorter than
 * this, so the suspension only ever engages below 1.0 and compression is at least
 * 0.2 whenever a wheel is grounded.
 *
 * Solving the per-tick force balance for four wheels puts equilibrium at a hit
 * distance of about 0.27. The car hovers low and stiff, which matches the
 * original being an arcade racer rather than a simulation.
 */
export const HOVER_DISTANCE = 1.2;

/**
 * SUBSTITUTE - the original casts this ray with `#maxDistance: 1`. We cast it
 * as far as the suspension can hover, because at 1 the car cannot stand still.
 *
 * The arithmetic is forced and every number in it is recovered. Four wheels
 * each push up by `d * pStrength * (pHoverDist - d)` per tick and gravity
 * pulls down by `|g| * pTimeStep`. With 3.0, 1.2, 90.81 and 0.025 that
 * balances at
 *
 *     4 * d * 3 * (1.2 - d) = 90.81 * 0.025   ->   d = 1.0133
 *
 * which is **beyond the 1.0 the ray reaches**. So at rest the wheel loses the
 * road, falls, is caught lower down, is pushed back past 1.0, and loses it
 * again - a limit cycle, measured here at 0.308 of bounce with a wheel off the
 * ground on 91 ticks in 200. Play described it as driving on a potholed street
 * while parked, which is exactly what it is.
 *
 * Raising the ray to the hover distance changes nothing below 1.0 and lets the
 * wheel be held at the height the spring actually wants: measured flat, zero
 * amplitude, no wheel ever loose. A hit beyond `HOVER_DISTANCE` still counts
 * as ungrounded, as it always did, so the fall rule is untouched.
 *
 * What stays UNRESOLVED is why the original's numbers contradict each other.
 * One of the five may be misread, or Havok's solver may have reached a
 * different balance than the one its own constants imply. The contradiction is
 * recorded rather than smoothed over, and this is the smallest change that
 * makes the car stand still.
 */
export const HOVER_RAY_LENGTH = 1.2;

/**
 * SUBSTITUTE - extra rotational inertia for the chassis.
 *
 * The suspension is a stiff explicit spring: each wheel delivers an impulse of
 * roughly 0.8 units of velocity per tick at a 1.2-unit lever arm. Against the
 * inertia of a thin collider box that is enough that any small asymmetry grows
 * into violent pitch and roll, and the rocking couples into a steady yaw - the
 * car turns on its own while standing still. Measured at 39 degrees of drift
 * over ten seconds at rest.
 *
 * The original ran the same spring constants inside Havok, against a convex
 * hull of the real collider mesh, integrated in 0.005 s sub-steps. We cannot
 * reproduce that solver, so this multiplier buys back the stability it had.
 * At 4x the drift falls to 0.03 degrees while pitch and roll still work, which
 * matters because the original has airborne self-righting and therefore does
 * tumble.
 *
 * This is a numerical accommodation, not a recovered value. If the real
 * collider geometry is ever decoded, derive the inertia from it and drop this.
 */
export const CHASSIS_INERTIA_MULTIPLIER = 4;

/**
 * SUBSTITUTE - a spawn height inside the ray's reach, so the suspension can
 * engage on the first tick. Spawning at `HOVER_DISTANCE` would put the ground
 * beyond `HOVER_RAY_LENGTH` and the car would simply fall.
 */
export const SPAWN_HEIGHT = 0.9;
/** RECOVERED - `pWheelRadius`. */
export const WHEEL_RADIUS = 0.35;
/** RECOVERED - `pFrontWheelBase` / `pBackWheelBase`. */
export const WHEELBASE_FRONT = 1.2;
export const WHEELBASE_REAR = 1.2;
/** RECOVERED - `pwidth`: track width. */
export const TRACK_WIDTH = 1.55;

// ---------------------------------------------------------------------------
// Drive
// ---------------------------------------------------------------------------

/** RECOVERED - `pMaxSpeed`, also published as the global `gM5MaxSpeed`. */
export const MAX_SPEED = 69;

/**
 * RECOVERED - `pAccGain`. Set to 0.1 in `beginSprite`, then overwritten to 0.07
 * in `prepareCar`, which runs later. 0.07 is the value in force during play.
 */
export const ACC_GAIN = 0.07;

/** RECOVERED - `pDecGain`, likewise overwritten to 0.04. Consumer not located. */
export const DEC_GAIN = 0.04;

/**
 * RECOVERED - `pBrakeGain`, assigned in `beginSprite`.
 *
 * **Nothing ever reads it**, in either `doMach5` or `doEnemy`, and the game has
 * no brake key. The author wrote a brake gain and never wired it up. Recorded
 * here for completeness; it does not drive anything.
 */
export const ORIGINAL_UNUSED_BRAKE_GAIN = 0.3;

/**
 * SUBSTITUTE - the gain our brake actually uses.
 *
 * In the original, reverse targets full negative speed the moment it is held,
 * so from 69 units the error term is -138 and the car crosses from top speed
 * into reverse in about seven ticks - roughly 230 ms. Faithful, and unpleasant
 * to drive.
 *
 * So reverse brakes first here, and only engages once the car has nearly
 * stopped. The curve borrows the shape of the recovered coast deceleration - a
 * per-tick fraction of current speed, biting hard and easing off - and cannot
 * overshoot into reverse, because it is proportional to the speed it removes.
 *
 * The coefficient is tuned, not recovered. `pBrakeGain`'s own 0.3 was tried
 * first and is far too strong: it still stops the car in 12 ticks, about
 * 400 ms. This value gives roughly 1.3 seconds from top speed, which reads as
 * a firm arcade brake rather than a wall.
 */
export const BRAKE_GAIN = 0.1;

/** SUBSTITUTE - below this forward speed, reverse engages instead of braking. */
export const BRAKE_ENGAGE_SPEED = 1;

/** RECOVERED - reverse uses `pAccGain * 1.1`, applied as an impulse. */
export const REVERSE_GAIN_FACTOR = 1.1;

/** RECOVERED - coast deceleration factor while |forwardVel| > 1. */
export const COAST_FACTOR_FAST = 0.06;
/** RECOVERED - and at or below 1, which stops the car crisply. */
export const COAST_FACTOR_SLOW = 0.9;
/** RECOVERED - the speed at which the coast factor switches. */
export const COAST_SPEED_THRESHOLD = 1;

/**
 * SUBSTITUTE, and the single most important one.
 *
 * The original multiplies the throttle force by a literal 60. A force integrated
 * over the configured 0.025 s step delivers `force * 0.025`, so the literal 60
 * yields 1.5x the impulse its own arithmetic implies; had the author assumed a
 * 1/60 s step it would yield exactly 1x. The movie then ran at 30 fps, a third
 * rate again. The Xtra's exact `applyForce` semantics are not recoverable from
 * the decompiled source, so the intent cannot be settled.
 *
 * We therefore do NOT port the 60 literally, and do not substitute 40 or 30.
 * This value is tuned so the car reaches MAX_SPEED in a comparable time, and is
 * declared a designed substitute rather than a recovered constant.
 *
 * See `docs/research/handling-contract.md` section 4.
 */
export const THROTTLE_FORCE_SCALE = 60;

/**
 * RECOVERED - below this forward speed, lateral velocity is cancelled in full
 * regardless of grip; above it, grip scales the cancellation.
 */
export const LATERAL_FULL_GRIP_SPEED = 5;

// ---------------------------------------------------------------------------
// Steering - yaw impulse with a build-up ramp
// ---------------------------------------------------------------------------

/** RECOVERED - `pTurnBuildFactor`; the per-update increment is this times 0.03. */
export const TURN_BUILD_FACTOR = 0.3;
export const TURN_BUILD_STEP = TURN_BUILD_FACTOR * 0.03;
/** RECOVERED - the ramp is clamped here while turning. */
export const TURN_BUILD_CAP = 0.75;
/** RECOVERED - released steering decays by this much per update... */
export const TURN_BUILD_DECAY = 0.2;

/**
 * SUBSTITUTE - ...down to this floor. The original's is **0.2**.
 *
 * Raised because the recovered value makes the car feel like it is ignoring
 * the wheel, which is the one complaint the original course produced that the
 * flat test strip never could. The cause was measured, and it is neither of
 * the obvious two:
 *
 *   - Not grip. Through a held turn the angle between where the car points and
 *     where it travels is 1.3 degrees; the lateral anti-slide impulse works.
 *   - Not inertia. `CHASSIS_INERTIA_MULTIPLIER` is a substitute whose own note
 *     said to derive the tensor from the collider hull once that was decoded.
 *     It is decoded, and the hull's yaw inertia is 4.10 against our 2.72 - the
 *     real car is *harder* to turn than ours, not easier.
 *
 * It is the ramp. `pTurnBuild` creeps 0.009 a tick from its floor to 0.75, so
 * full steering authority takes two seconds, while `pWheelTurn` puts the front
 * wheels at full visual lock in five ticks. Both are recovered, and the gap
 * between them is what the eye reads as the car refusing the wheel.
 *
 * Measured on the original course, lateral movement from a held turn at full
 * speed, on a road 18 units wide:
 *
 *            floor 0.2 (recovered)   floor 0.4 (here)
 *   0.5 s          1.2 units              2.2 units
 *   1.0 s          7.3                   11.6
 *   1.5 s         19.7                   29.0
 *
 * The floor rather than the rate, deliberately: the ramp still fills in while
 * the key is held, which is the original's own feel. Only the first bite is
 * stronger. Like `BRAKE_GAIN` and `THROTTLE_FORCE_SCALE`, this is a departure
 * from a faithful value that was faithful and unpleasant; set it to 0.2 to
 * drive what the original drove.
 */
export const TURN_BUILD_FLOOR = 0.4;
/**
 * RECOVERED - reversing fills the ramp in one jump rather than creeping up.
 *
 * `doMach5` has two steering branches, and they are not the same handler with
 * a sign flipped. Going forward the ramp creeps by 0.009 a tick to a cap of
 * 0.75 (line 693); backing up it jumps 0.2 a tick to a cap of 1 (line 715), so
 * the car swings round quickly when parking and reluctantly at speed.
 */
export const REVERSE_TURN_BUILD_STEP = 0.2;
export const REVERSE_TURN_BUILD_CAP = 1;

/**
 * RECOVERED - yaw authority falls as the yaw rate approaches
 * `forwardVel * 0.07`, which makes steering speed-sensitive.
 */
export const YAW_RATE_COEFF = 0.07;
/** RECOVERED - Z angular velocity is multiplied by this every update. */
export const YAW_DAMPING = 0.84;
/** RECOVERED - `pMaxWheelTurn`, degrees. Visual only; steering is impulse-based. */
export const MAX_WHEEL_TURN_DEG = 45;
/** RECOVERED - `pWheelSpinCoeff`: visual wheel spin rate. */
export const WHEEL_SPIN_COEFF = 2;

// ---------------------------------------------------------------------------
// Jacks
// ---------------------------------------------------------------------------

/** RECOVERED - upward impulse of `chassisMass * 40` on world Z. */
export const JACKS_IMPULSE_PER_MASS = 40;
/** RECOVERED - 80 ticks at 1/60 s per tick. */
export const JACKS_COOLDOWN_TICKS = 80;
export const JACKS_COOLDOWN_SECONDS = JACKS_COOLDOWN_TICKS / TICKS_PER_SECOND;

// ---------------------------------------------------------------------------
// Airborne self-righting
// ---------------------------------------------------------------------------

/**
 * RECOVERED - pitch beyond this engages the corrector, and roll beyond the
 * next one does too: `doMach5:784`, `(pPowerCoeff < 1) and ((abs(RotX) > 80)
 * or (abs(RotY) > 45))`.
 *
 * Both were recovered long ago and neither was used. Only the damping half of
 * the original's self-righting was implemented - the half that stops a car
 * spinning - so a car that came to rest on its side stayed on its side, which
 * is what play found.
 */
export const RIGHTING_PITCH_DEG = 80;
export const RIGHTING_ROLL_DEG = 45;

/**
 * SUBSTITUTE - how hard the corrector pushes the car back onto its wheels.
 *
 * The original uses a Havok angular dashpot, `makeAngularDashpot
 * ("m5Corrector")`, a constraint driving the chassis toward a target rotation
 * with `strength = pChassisRB.mass * max(|RotX|, |RotY|) / 90` and
 * `damping = 1000` (`doMach5:786-791`). We cannot reproduce that solver, and
 * two things about it stay UNRESOLVED: the dashpot's own integration, and its
 * target of `vector(50, 0, rotz)` - a 50 on the X axis that does not read as
 * upright and that the artifact never explains.
 *
 * So the trigger and the strength scaling are recovered and used as they
 * stand; what the torque is applied toward is ours: level, with the car's
 * heading left alone, which is what self-righting means. This multiplier sets
 * the rate and is tuned to right the car in about two seconds rather than
 * snapping it, which the dashpot's heavy damping also would not have done.
 */
export const RIGHTING_TORQUE = 2.5;
/** RECOVERED - beyond this on either axis, angular velocity is cut... */
export const RIGHTING_CUT_DEG = 30;
/** RECOVERED - ...by this factor, with an extra angular impulse of -L * 0.5. */
export const RIGHTING_VELOCITY_CUT = 0.1;
export const RIGHTING_MOMENTUM_IMPULSE = 0.5;

// ---------------------------------------------------------------------------
// Race rules
// ---------------------------------------------------------------------------

/** RECOVERED - segment length in world units; the track advances along +Y. */
export const SEGMENT_LENGTH = 300;
/** RECOVERED - `PREP` pre-sizes the four segment arrays to this many slots. */
export const SEGMENT_SLOTS = 37;
/** RECOVERED - `doFinish` fires at this Y. */
export const FINISH_Y = 10921;
/** RECOVERED - the wrong-way warning fires this far below the maximum Y reached. */
export const WRONG_WAY_MARGIN = 100;
/** RECOVERED - fall death below this Z, with no wheel grounded. */
export const FALL_DEATH_Z = -10;

/** RECOVERED - damage and oxygen are both clamped to this range. */
export const STAT_MAX = 100;
/** RECOVERED - the displayed bars ease this fraction of the gap per update. */
export const BAR_EASE = 0.3;
/** RECOVERED - and snap when within this of the real value. */
export const BAR_SNAP = 0.5;
/** RECOVERED - oxygen drain per update while underwater. */
export const OXYGEN_DRAIN = 0.2;
/** RECOVERED - damage per update while out of oxygen, or underwater unprotected. */
export const DROWN_DAMAGE = 0.3;
/** RECOVERED - wrench: -50 damage (`handlePickups.ls:35`), +500 (`:44`). */
export const REPAIR_AMOUNT = 50;
export const REPAIR_SCORE = 500;

/**
 * RECOVERED - what each pickup is worth, from `handlePickups.ls`.
 *
 * They are not all the same, and two were wrong here. Red candy is 500
 * (`:117`) and purple is **1000** (`:93`); both were scored 500, because both
 * read `REPAIR_SCORE`. The robot is 1000 (`:69`) and scored nothing at all,
 * because `applyPickup` had no case for it - ten of the level's pickups were
 * inert. `docs/research/open-questions.md` lists these as UNKNOWN; they are
 * in the handler, and that question is stale.
 */
export const CANDY_RED_SCORE = 500;
export const CANDY_PURPLE_SCORE = 1000;
export const ROBOT_SCORE = 1000;
export const OXYGEN_SCORE = 500;

/**
 * SUBSTITUTE - how far the car reaches to collect a pickup.
 *
 * Not the bodywork. Every handler in `handlePickups.ls:20-26` requires the
 * colliding model to be `mMach5Blades`, the saw, which is the only model on
 * the car carrying a `#collision` modifier. `doMach5.ls:586` re-sets it to
 * the chassis transform every frame *before* the blade scaling, so it is full
 * size with the Blades off and pickups are collected either way.
 *
 * The radius is a substitute because Director derives a `#sphere` modifier's
 * radius from the model's bounding sphere, and that rule is not in this
 * artifact. Two numbers bracket it and agree: the decoded `saw` mesh's
 * bounding sphere about the chassis origin measures **3.683**, and
 * `doHitTree` guards independently on `distanceTo(...) > 4`
 * (`handlePickups.ls:6`). The stated 4 is used; the measured 3.683 is the
 * evidence beside it.
 *
 * Before this, pickups were tested against the chassis box, whose
 * half-diagonal is 1.51 - well under half the reach.
 */
export const PICKUP_REACH = 4;

/**
 * RECOVERED - the surface id that is water, and the height below which being
 * on it means being under it.
 *
 * `doMach5:899-910` is a `case effectID` statement whose branch `12:` sets
 * grip 1 and drag 0.75, and nested inside that branch is
 * `if mMach5.transform.position.z <= 0 then isUnderWater = 1`.
 *
 * Both halves matter. Surface 12 is live on this course - 350 triangles in
 * segments 9, 10, 13, 15, 16, 28, 30 and 31, exactly the segments holding the
 * water planes and the oxygen pickups - but 3,590 live triangles across ten
 * different surfaces dip below z = 0, ordinary road among them. Height alone
 * would drown the player on dry asphalt.
 */
export const WATER_EFFECT_ID = 12;
export const WATERLINE_Z = 0;
/** RECOVERED - oxygen pickup. */
export const OXYGEN_PICKUP = 50;
/** RECOVERED - awarded by `doFinish` when finishing first. */
export const FINISH_FIRST_SCORE = 5000;
/** RECOVERED - collision debounce, 60 ticks = 1 second. */
export const COLLISION_DEBOUNCE_TICKS = 60;
export const COLLISION_DEBOUNCE_SECONDS =
  COLLISION_DEBOUNCE_TICKS / TICKS_PER_SECOND;

// ---------------------------------------------------------------------------
// Surfaces - grip limits drive force, drag scales the TARGET speed
// ---------------------------------------------------------------------------

/**
 * RECOVERED - the grip/drag pairs and the `effectID` values that select them.
 *
 * The *names* used to be guesses. They are now the track's own material
 * names, read out of the decoded geometry, and two of the guesses were wrong:
 * `grip 0.016` is ice and snow rather than "shallow water", and `drag 0.5` is
 * grass rather than "heavy drag". The numbers did not change.
 *
 * SUPPORTED, not RECOVERED, and the distinction is the point. What is
 * measured is that every segment carries exactly 16 sub-meshes and that
 * sub-mesh N holds the same material in all 37. What is inferred is that
 * `effectID` is that index - strongly, because the three IDs the original
 * leaves unhandled, 5, 11 and 16, are exactly the three non-drivable
 * materials: `ROCK_bROWN`, `ROCK_bLUE` and `TREE`. Drawn at random from 16
 * that alignment is one chance in 560.
 *
 * UNRESOLVED: *why* index 5 of the raycast result is the sub-mesh. The
 * artifact never shows the tuple's layout - across `doMach5` and `doEnemy`
 * only `details[1][2]`, `[3]` and `[5]` are ever read - and Director's
 * documentation is not part of this artifact, so it is not evidence this
 * project may cite. The mapping does not depend on it.
 *
 * See `docs/design/2026-11-05-original-track.md` for the full table.
 */
export interface Surface {
  readonly grip: number;
  readonly drag: number;
  /** The track's own material name. SUPPORTED; see the table's comment. */
  readonly inferredName: string;
}

export const SURFACE_DEFAULT: Surface = { grip: 1, drag: 1.0, inferredName: 'default' };

/**
 * RECOVERED - `doMach5:481` sets `pTrackFace = 99` for a wheel whose ray finds
 * nothing at all.
 *
 * It is what stops a surface outliving the ground that reported it: without it
 * a car in the air keeps the grip and drag of the last thing it drove on until
 * it lands. `surfaceFor(99)` is the default, which is the point.
 *
 * Note what it is *not* for. The original's fall rule reads it as a third
 * clause alongside `pPowerCoeff = 0`, but that clause is redundant: the
 * suspension ray is cast with `maxDistance: 1` while `pHoverDist` is 1.2, so a
 * wheel is grounded exactly when its ray hits, and no wheel grounded already
 * means the ray missed.
 */
export const NO_GROUND_EFFECT_ID = 99;

export const SURFACES_BY_EFFECT_ID: ReadonlyMap<number, Surface> = new Map([
  [8, { grip: 0.016, drag: 1, inferredName: 'snow (ROAD_BLUESNOW_TRANS)' }],
  [9, { grip: 0.016, drag: 1, inferredName: 'snow (ROAD_BLUESNOW)' }],
  [14, { grip: 0.016, drag: 1, inferredName: 'ice (ROAD_BlueIce)' }],
  [15, { grip: 0.016, drag: 1, inferredName: 'ice (ROAD_BlueIceTRANS)' }],
  [4, { grip: 0.8, drag: 1, inferredName: 'dirt (ROAD_Dirt)' }],
  [12, { grip: 1, drag: 0.75, inferredName: 'underwater sand (SAND_UNDERWATER)' }],
  [1, { grip: 1, drag: 1.0, inferredName: 'finish line (ROAD_Finish; no geometry on level 1)' }],
  [2, { grip: 1, drag: 1.0, inferredName: 'road (ROAD_Brown)' }],
  [6, { grip: 1, drag: 1.0, inferredName: 'road (ROAD_Blue)' }],
  [7, { grip: 1, drag: 1.0, inferredName: 'road (ROAD_Blue_Dark)' }],
  [10, { grip: 1, drag: 1.0, inferredName: 'road (ROAD_DirtBlue)' }],
  [13, { grip: 1, drag: 1.0, inferredName: 'road (ROAD_BluepBLUEd)' }],
  [3, { grip: 1, drag: 0.5, inferredName: 'grass (GRASS)' }],
]);

export function surfaceFor(effectId: number): Surface {
  return SURFACES_BY_EFFECT_ID.get(effectId) ?? SURFACE_DEFAULT;
}
