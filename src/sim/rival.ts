/**
 * One rival car.
 *
 * `doEnemy`'s `updateCar` is the Mach 5's chassis loop with the keyboard taken
 * out and a pursuit controller put in. Everything physical is shared: the same
 * four-ray suspension, the same sideways grip, the same self-righting. This
 * file composes those three from `vehicle.ts` - exported there, unchanged -
 * and adds only what a rival has of its own.
 *
 * What it deliberately does NOT share: `updateGadgets`, `updateSteering` and
 * `updateDrive`. A rival has no gadgets, no brake, no reverse and no steering
 * ramp. It has one angular impulse toward the next waypoint and one forward
 * impulse toward a target speed, and that is the whole of its driving.
 */

import * as K from './constants.js';
import type { ExplosionMode } from './rival-damage.js';
import { bearingDeg, wrapAngleDeg } from './rival-steering.js';
import { waypoint, type TrackPath } from './track-path.js';
import {
  createVehicleState,
  updateHover,
  updateLateralGrip,
  updateSelfRighting,
  vec3,
  type ChassisBody,
  type GroundProbe,
  type Vec3,
  type VehicleState,
} from './vehicle.js';

/** How a rival is being driven. `doEnemy`'s `controlMODE`. */
export type RivalControl =
  /** Following the racing line. `controlMODE = 1`. */
  | 'driving'
  /** Spun by the Robot, steering at random until the timer runs out. `= 0`. */
  | 'spun';

/** A chassis a rival can be teleported into, which a recycle needs. */
export interface RivalBody extends ChassisBody {
  respawn(position: Vec3): void;
  setRotation(q: { x: number; y: number; z: number; w: number }): void;
}

export interface RivalState {
  /** The chassis state it shares with the player, suspension and all. */
  readonly vehicle: VehicleState;
  /** `pNextPathStep` - the waypoint it is steering at, 1-based. */
  nextStep: number;
  /** `controlMODE`. */
  control: RivalControl;
  /** `pMaxSpeed`, rewritten every tick once the rubber band exists. */
  maxSpeed: number;
  /** `pCarBody.userData.damage`, 0..100. */
  damage: number;
  /** `explosionMODE`, reduced to the three values that gate behaviour. */
  mode: ExplosionMode;
  /** False once it has finished, exploded or been taken out of the world. */
  alive: boolean;
}

export function createRivalState(startStep: number): RivalState {
  return {
    vehicle: createVehicleState(),
    nextStep: startStep + 1,
    control: 'driving',
    maxSpeed: K.MAX_SPEED * K.RIVAL_BASE_SPEED_FACTOR,
    damage: 0,
    mode: 'none',
    alive: true,
  };
}

/**
 * The heading the original compares against, in its own convention.
 *
 * `doEnemy:447` reads `pChassisMDL.transform.rotation.z` and subtracts it from
 * `goto_rot`, which is `-getAngle(...)`. So the rotation it compares with is
 * the negated bearing of the car's own forward axis, and deriving it that way
 * keeps the two sides in one convention rather than two.
 */
export function headingDeg(body: ChassisBody): number {
  return -bearingDeg(0, 0, body.forward.x, body.forward.y);
}

/**
 * Advance one rival by one tick.
 *
 * Order follows `doEnemy`: suspension first, then steering, then drive, then
 * the airborne corrections - the same split across Director's `enterFrame` and
 * `exitFrame` that `stepVehicle` already mirrors for the player.
 */
export function stepRival(
  state: RivalState,
  body: ChassisBody,
  probe: GroundProbe,
  path: TrackPath,
): void {
  if (!state.alive) return;

  updateHover(state.vehicle, body, probe);

  const v = state.vehicle;
  v.forwardVel = body.forward.x * body.linearVelocity.x
    + body.forward.y * body.linearVelocity.y
    + body.forward.z * body.linearVelocity.z;

  const grounded = v.grounded.reduce((n, g) => n + (g ? 1 : 0), 0);
  v.powerCoeff = grounded === 0 ? 0 : grounded / 4;

  const aim = steerTowardWaypoint(state, body, path);
  if (!state.alive) return;

  drive(state, body, aim);
  updateSelfRighting(v, body);
  updateLateralGrip(v, body);
}

/** What the pursuit controller worked out this tick, for the speed rule. */
export interface RivalAim {
  /** `turnFactor` - how badly aimed, 0 when straight on, 1 at 40 degrees out. */
  readonly turnFactor: number;
  /** `distFactor` - how close, 0 at 50 units away or more, 1 on top of it. */
  readonly distFactor: number;
}

/**
 * Aim at the next waypoint and push the nose round toward it.
 *
 * `doEnemy:420-461`. Advancing the waypoint is a `while` here rather than the
 * original's single `if`, because the original ran at Director's frame rate
 * and ours is a fixed tick: at the shortest gap on the line, 21.5 units, a
 * fast car could clear two acceptance radii in one step and the original would
 * have left the second behind it.
 */
function steerTowardWaypoint(
  state: RivalState,
  body: ChassisBody,
  path: TrackPath,
): RivalAim {
  const pos = body.position;
  let target = waypoint(path, state.nextStep);
  let distance = Math.hypot(target.x - pos.x, target.y - pos.y);

  while (distance < K.RIVAL_WAYPOINT_REACH) {
    if (state.nextStep >= path.count) {
      // `doEnemy:427-443`: the line is finished and the car leaves the race.
      state.alive = false;
      return { turnFactor: 0, distFactor: 0 };
    }
    state.nextStep += 1;
    target = waypoint(path, state.nextStep);
    distance = Math.hypot(target.x - pos.x, target.y - pos.y);
  }

  const wanted = -bearingDeg(pos.x, pos.y, target.x, target.y);
  const dif = wrapAngleDeg(wanted - headingDeg(body));

  const turnFactor = Math.min(K.RIVAL_TURN_FULL_DEG, Math.abs(dif)) / K.RIVAL_TURN_FULL_DEG;
  const distFactor = 1 - Math.min(K.RIVAL_DIST_FULL, distance) / K.RIVAL_DIST_FULL;

  if (dif !== 0) {
    // `doEnemy:456-460`. The sign of `dif` picks the side; the magnitude is
    // the impulse. The damping term opposes the current yaw rate - see
    // RIVAL_YAW_DAMPING for why its coefficient is a substitute.
    const turn = Math.sign(dif) * body.mass * turnFactor;
    const damp = -body.angularVelocity.z * body.mass * K.RIVAL_YAW_DAMPING;
    body.applyAngularImpulse(vec3(0, 0, turn + damp));
  }

  return { turnFactor, distFactor };
}

/**
 * The speed a rival is actually aiming for this tick.
 *
 * `doEnemy` writes every branch of its speed table as
 * `ts - (ts * turnFactor * distFactor)`, so the cornering slowdown is a factor
 * on whatever the rubber band chose. It bites only when the car is BOTH badly
 * aimed and close to its target: either factor at zero leaves full speed. That
 * is the whole of a rival's cornering - there is no brake anywhere in the
 * script.
 */
export function targetSpeed(maxSpeed: number, aim: RivalAim): number {
  return maxSpeed - maxSpeed * aim.turnFactor * aim.distFactor;
}

/**
 * Full throttle toward `maxSpeed`, always.
 *
 * `doEnemy:505-509`. A rival never lifts and never brakes; all of its
 * racecraft is in `maxSpeed`, which the rubber band rewrites every tick. The
 * cornering slowdown is the `turnFactor * distFactor` term, applied here
 * rather than at the speed table so that it is visible beside the throttle it
 * modifies.
 */
function drive(state: RivalState, body: ChassisBody, aim: RivalAim): void {
  if (state.vehicle.powerCoeff === 0) return;

  const error = targetSpeed(state.maxSpeed, aim) - state.vehicle.forwardVel;
  const magnitude = error * K.ACC_GAIN * body.mass * state.vehicle.powerCoeff;
  body.applyImpulse(vec3(
    body.forward.x * magnitude,
    body.forward.y * magnitude,
    body.forward.z * magnitude,
  ));
}
