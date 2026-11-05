/**
 * The Mach 5 controller.
 *
 * This reproduces the model recovered from the original's `doMach5` behaviour: a
 * rigid-body chassis with no contact friction, held up by a four-point raycast
 * hover suspension, driven by a proportional speed controller and steered by yaw
 * impulses with a build-up ramp and a speed-dependent rate limiter.
 *
 * It is deliberately engine-agnostic. It reads and writes a `ChassisBody` and
 * queries a `GroundProbe`; it never touches Rapier, Three.js, the DOM or a clock.
 * That is what makes the replay test possible, and what lets the physics backend
 * be swapped without touching handling.
 *
 * See `docs/research/handling-contract.md`.
 */

import * as K from './constants.js';
import type { Surface } from './constants.js';

/** Minimal vector, kept plain so snapshots serialise predictably. */
export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export const vec3 = (x = 0, y = 0, z = 0): Vec3 => ({ x, y, z });

/** What the controller needs from whatever rigid body backs the chassis. */
export interface ChassisBody {
  readonly mass: number;
  position: Vec3;
  linearVelocity: Vec3;
  angularVelocity: Vec3;
  /** Unit vectors of the body's local axes, in world space. */
  readonly forward: Vec3;
  readonly right: Vec3;
  readonly up: Vec3;
  /** Pitch and roll in degrees, for the self-righting logic. */
  readonly pitchDeg: number;
  readonly rollDeg: number;

  applyImpulse(impulse: Vec3): void;
  applyImpulseAtPoint(impulse: Vec3, localPoint: Vec3): void;
  applyForce(force: Vec3): void;
  applyAngularImpulse(impulse: Vec3): void;
}

/** A downward ray hit against the track, as the original's `modelsUnderRay` gave. */
export interface GroundHit {
  /** Distance from the wheel point to the surface. */
  distance: number;
  /** Contact point in world space. */
  point: Vec3;
  /**
   * The face index of the surface that was hit. The original used this directly
   * as its `effectID` to select grip and drag.
   */
  effectId: number;
}

/** Casts a downward ray from a world-space point, limited to `maxDistance`. */
export interface GroundProbe {
  castDown(from: Vec3, maxDistance: number): GroundHit | null;
}

export interface VehicleInput {
  forward: boolean;
  backward: boolean;
  left: boolean;
  right: boolean;
  jacks: boolean;
}

export const NO_INPUT: VehicleInput = {
  forward: false,
  backward: false,
  left: false,
  right: false,
  jacks: false,
};

/**
 * Wheel positions in chassis-local space, ordered to match the original's
 * `pWheelPointList` indices 1..4.
 *
 * SUBSTITUTE: the original builds this list at runtime from the wheel models in
 * the 3D world, so the actual coordinates live in the W3D geometry, which is not
 * decoded. The wheelbase and track width here ARE recovered constants; the local
 * Z of 0 is our assumption and should be revisited if the geometry is ever read.
 */
export const WHEEL_LOCAL_POINTS: readonly Vec3[] = [
  vec3(-K.TRACK_WIDTH / 2, K.WHEELBASE_FRONT, 0), // front left
  vec3(K.TRACK_WIDTH / 2, K.WHEELBASE_FRONT, 0), // front right
  vec3(-K.TRACK_WIDTH / 2, -K.WHEELBASE_REAR, 0), // rear left
  vec3(K.TRACK_WIDTH / 2, -K.WHEELBASE_REAR, 0), // rear right
];

const dot = (a: Vec3, b: Vec3): number => a.x * b.x + a.y * b.y + a.z * b.z;
const scale = (v: Vec3, s: number): Vec3 => vec3(v.x * s, v.y * s, v.z * s);
const add = (a: Vec3, b: Vec3): Vec3 => vec3(a.x + b.x, a.y + b.y, a.z + b.z);
const sub = (a: Vec3, b: Vec3): Vec3 => vec3(a.x - b.x, a.y - b.y, a.z - b.z);
const cross = (a: Vec3, b: Vec3): Vec3 =>
  vec3(a.y * b.z - a.z * b.y, a.z * b.x - a.x * b.z, a.x * b.y - a.y * b.x);

/** Everything the controller carries between ticks. Snapshot-friendly. */
export interface VehicleState {
  /** Fraction of the four wheels on the ground: 0, 0.25, 0.5, 0.75 or 1. */
  powerCoeff: number;
  /** Per-wheel grounded flags, in `WHEEL_LOCAL_POINTS` order. */
  grounded: [boolean, boolean, boolean, boolean];
  /** Per-wheel hit distance, or the rest height when ungrounded. */
  hoverDistances: [number, number, number, number];
  /** The steering ramp. */
  turnBuild: number;
  /** Signed speed along the chassis forward axis. */
  forwardVel: number;
  /** Grip and drag from the surface under the rear wheel, as the original did. */
  surface: Surface;
  /** `effectId` of the last surface seen under the rear wheel. */
  effectId: number;
  /** Simulated seconds remaining before Jacks can fire again. */
  jacksCooldown: number;
  /** Whether the jack models are currently extended. */
  jacksExtended: boolean;
  /** True while airborne, so the landing impulse fires once on touchdown. */
  isLanding: boolean;
  /** Sideways speed along the chassis right axis, before grip is applied. */
  slideSpeed: number;
}

export function createVehicleState(): VehicleState {
  return {
    powerCoeff: 0,
    grounded: [false, false, false, false],
    hoverDistances: [
      K.HOVER_DISTANCE,
      K.HOVER_DISTANCE,
      K.HOVER_DISTANCE,
      K.HOVER_DISTANCE,
    ],
    turnBuild: 0,
    forwardVel: 0,
    surface: K.SURFACE_DEFAULT,
    effectId: -1,
    jacksCooldown: 0,
    jacksExtended: false,
    isLanding: false,
    slideSpeed: 0,
  };
}

/**
 * Advance the controller by one tick.
 *
 * Order matters and mirrors the original: the original ran `updateHover` on
 * Director's `enterFrame` and `updateCar` on `exitFrame`, so suspension is
 * applied before drive and steering within the same tick.
 */
export function stepVehicle(
  state: VehicleState,
  body: ChassisBody,
  probe: GroundProbe,
  input: VehicleInput,
  dt: number,
): void {
  updateHover(state, body, probe);
  updateCar(state, body, input, dt);
}

/**
 * Four-point raycast hover suspension.
 *
 * The original cast each ray only against the current track segment's model,
 * with a special case at segment seams. Segment selection belongs to the track,
 * not the vehicle, so that lives behind `GroundProbe`.
 */
function updateHover(
  state: VehicleState,
  body: ChassisBody,
  probe: GroundProbe,
): void {
  const down = scale(body.up, -1);

  for (let i = 0; i < 4; i++) {
    const local = WHEEL_LOCAL_POINTS[i]!;
    const world = localToWorld(body, local);
    const hit = probe.castDown(world, K.HOVER_RAY_LENGTH);

    if (!hit || hit.distance >= K.HOVER_DISTANCE) {
      state.grounded[i] = false;
      state.hoverDistances[i] = K.HOVER_DISTANCE;
      continue;
    }

    // The original tracked the surface under the rear-right wheel (its index 4)
    // and used that face index as the effectID for the whole car.
    if (i === 3) {
      state.effectId = hit.effectId;
      state.surface = K.surfaceFor(hit.effectId);
    }

    // Velocity of this wheel point, including the body's rotation about it.
    const chassisPos = body.position;
    const lever = sub(world, chassisPos);
    const pointVelocity = add(body.linearVelocity, cross(body.angularVelocity, lever));

    const toSurface = sub(hit.point, world);
    const compression = K.HOVER_DISTANCE - hit.distance;

    // Spring, then damper along the contact direction, then scaled by mass -
    // the original multiplied the whole impulse by the chassis mass.
    let f = -K.SUSPENSION_STRENGTH * compression;
    f -= K.SUSPENSION_DAMPING * dot(pointVelocity, toSurface);

    body.applyImpulseAtPoint(scale(toSurface, f * body.mass), local);

    state.grounded[i] = true;
    state.hoverDistances[i] = hit.distance;
    void down;
  }
}

/** Drive, steering, self-righting and the Jacks timer. */
function updateCar(
  state: VehicleState,
  body: ChassisBody,
  input: VehicleInput,
  dt: number,
): void {
  state.forwardVel = dot(body.linearVelocity, body.forward);

  // powerCoeff: the fraction of wheels on the ground. It gates drive and reverse,
  // scales the coast deceleration, and is the precondition for Jacks.
  const groundedCount = state.grounded.reduce((n, g) => n + (g ? 1 : 0), 0);
  state.powerCoeff = groundedCount === 0 ? 0 : groundedCount / 4;

  updateSteering(state, body, input);
  updateDrive(state, body, input);
  updateSelfRighting(state, body);
  updateLateralGrip(state, body);
  updateJacks(state, body, input, dt);

  // Constant yaw damping, applied every update in the original.
  body.angularVelocity = vec3(
    body.angularVelocity.x,
    body.angularVelocity.y,
    body.angularVelocity.z * K.YAW_DAMPING,
  );
}

function updateSteering(
  state: VehicleState,
  body: ChassisBody,
  input: VehicleInput,
): void {
  const turning = input.left !== input.right; // both held cancels out
  if (!turning) {
    state.turnBuild = Math.max(
      K.TURN_BUILD_FLOOR,
      state.turnBuild - K.TURN_BUILD_DECAY,
    );
    return;
  }

  state.turnBuild = Math.min(K.TURN_BUILD_CAP, state.turnBuild + K.TURN_BUILD_STEP);

  // Yaw authority falls off as the current yaw rate approaches a speed-dependent
  // limit, so the car cannot be spun arbitrarily fast by holding a direction.
  const yawRate = body.angularVelocity.z;
  const sign = input.right ? -1 : 1;
  const limit = state.forwardVel * K.YAW_RATE_COEFF * sign;

  let authority = 1;
  if (yawRate !== 0 && limit !== 0) {
    authority = Math.min(1, 1 - Math.min(1, yawRate / limit));
  }

  const magnitude = body.mass * authority * state.turnBuild * sign;
  body.applyAngularImpulse(vec3(0, 0, magnitude));
}

function updateDrive(
  state: VehicleState,
  body: ChassisBody,
  input: VehicleInput,
): void {
  const { grip, drag } = state.surface;
  const gripLimit = Math.min(1, grip);

  if (state.powerCoeff > 0 && input.forward) {
    // A proportional controller toward the surface-scaled target speed, applied
    // as a FORCE - the original's only use of applyForce on the drive path.
    if (state.forwardVel < 0) {
      const magnitude = K.ACC_GAIN * 2 * K.MAX_SPEED * body.mass;
      body.applyForce(
        scale(body.forward, magnitude * gripLimit * K.THROTTLE_FORCE_SCALE),
      );
    } else {
      const error = K.MAX_SPEED * drag - state.forwardVel;
      const magnitude = error * K.ACC_GAIN * body.mass;
      body.applyForce(
        scale(body.forward, magnitude * gripLimit * K.THROTTLE_FORCE_SCALE),
      );
    }
    return;
  }

  if (state.powerCoeff > 0 && input.backward) {
    // Reverse is an IMPULSE, not a force, and is not scaled by powerCoeff.
    const error = -K.MAX_SPEED * drag - state.forwardVel;
    const magnitude = error * (K.ACC_GAIN * K.REVERSE_GAIN_FACTOR) * body.mass;
    body.applyImpulse(scale(body.forward, magnitude));
    return;
  }

  // Coasting: an impulse opposing forward motion, scaled by wheels on the ground.
  const factor =
    Math.abs(state.forwardVel) > K.COAST_SPEED_THRESHOLD
      ? K.COAST_FACTOR_FAST
      : K.COAST_FACTOR_SLOW;
  const magnitude = state.forwardVel * body.mass * factor * state.powerCoeff;
  body.applyImpulse(scale(body.forward, -magnitude));
}

/**
 * Airborne self-righting. The original also created a Havok angular dashpot past
 * the larger thresholds; the velocity cut below reproduces the part that does not
 * require an engine-specific constraint.
 */
function updateSelfRighting(state: VehicleState, body: ChassisBody): void {
  if (state.powerCoeff >= 1) return;

  const pitch = Math.abs(body.pitchDeg);
  const roll = Math.abs(body.rollDeg);

  if (pitch > K.RIGHTING_CUT_DEG || roll > K.RIGHTING_CUT_DEG) {
    body.angularVelocity = scale(body.angularVelocity, K.RIGHTING_VELOCITY_CUT);
    body.applyAngularImpulse(
      scale(body.angularVelocity, -body.mass * K.RIGHTING_MOMENTUM_IMPULSE),
    );
  }
}

/**
 * Lateral grip - the cornering mechanic, and what `pGrip` is mostly for.
 *
 * The original cancels sideways velocity outright below a forward speed of 5,
 * and scales the cancellation by grip above it. That is why a grip of 0.016 on
 * water feels like ice: only 1.6% of the sideways velocity is removed per tick.
 *
 * It only runs with at least one wheel down. Airborne, the car keeps whatever
 * sideways momentum it had, and on touchdown the original zeroes angular
 * velocity once - the landing "chirp".
 */
function updateLateralGrip(state: VehicleState, body: ChassisBody): void {
  if (state.powerCoeff === 0) {
    state.isLanding = true;
    return;
  }

  if (state.isLanding) {
    state.isLanding = false;
    body.angularVelocity = vec3(0, 0, 0);
  }

  state.slideSpeed = dot(body.right, body.linearVelocity);

  const factor =
    state.forwardVel < K.LATERAL_FULL_GRIP_SPEED ? 1 : state.surface.grip;

  body.applyImpulse(scale(body.right, -state.slideSpeed * body.mass * factor));
}

function updateJacks(
  state: VehicleState,
  body: ChassisBody,
  input: VehicleInput,
  dt: number,
): void {
  if (state.jacksCooldown > 0) {
    state.jacksCooldown = Math.max(0, state.jacksCooldown - dt);
  }

  // Requires ALL FOUR wheels grounded, not merely some.
  if (input.jacks && !state.jacksExtended && state.powerCoeff === 1) {
    body.applyImpulse(vec3(0, 0, body.mass * K.JACKS_IMPULSE_PER_MASS));
    state.jacksExtended = true;
    state.jacksCooldown = K.JACKS_COOLDOWN_SECONDS;
    return;
  }

  // The jacks retract once the cooldown has elapsed AND a wheel is back down.
  if (state.jacksExtended && state.jacksCooldown === 0 && state.powerCoeff > 0) {
    state.jacksExtended = false;
  }
}

function localToWorld(body: ChassisBody, local: Vec3): Vec3 {
  return add(
    body.position,
    add(
      add(scale(body.right, local.x), scale(body.forward, local.y)),
      scale(body.up, local.z),
    ),
  );
}
