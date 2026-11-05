/**
 * A semi-implicit Euler rigid body, and a flat ground probe.
 *
 * This is not a physics engine and is not trying to be one. It exists so the
 * controller can be exercised and replayed without a WASM backend, which keeps
 * the determinism tests fast and makes a failure attributable to our own code
 * rather than to someone else's solver.
 *
 * It is also the reference the Rapier-backed body is compared against: if the
 * two diverge, that divergence is information about the engine, not a bug here.
 */

import * as K from './constants.js';
import { vec3, type ChassisBody, type GroundHit, type GroundProbe, type Vec3 } from './vehicle.js';

export class AnalyticBody implements ChassisBody {
  readonly mass: number;
  position: Vec3;
  linearVelocity: Vec3 = vec3();
  angularVelocity: Vec3 = vec3();
  /** Yaw about Z, radians. Pitch and roll stay zero: this body does not tumble. */
  yaw = 0;

  private forceAccum: Vec3 = vec3();

  constructor(mass = K.CHASSIS_MASS, position: Vec3 = vec3(0, 0, K.SPAWN_HEIGHT)) {
    this.mass = mass;
    this.position = { ...position };
  }

  get forward(): Vec3 {
    // The original's local forward is +Y, with Z up.
    return vec3(-Math.sin(this.yaw), Math.cos(this.yaw), 0);
  }

  get right(): Vec3 {
    return vec3(Math.cos(this.yaw), Math.sin(this.yaw), 0);
  }

  get up(): Vec3 {
    return vec3(0, 0, 1);
  }

  get pitchDeg(): number {
    return 0;
  }

  get rollDeg(): number {
    return 0;
  }

  applyImpulse(impulse: Vec3): void {
    this.linearVelocity = {
      x: this.linearVelocity.x + impulse.x / this.mass,
      y: this.linearVelocity.y + impulse.y / this.mass,
      z: this.linearVelocity.z + impulse.z / this.mass,
    };
  }

  applyImpulseAtPoint(impulse: Vec3, _localPoint: Vec3): void {
    // Without a full inertia tensor the torque term would be invented rather
    // than derived, so this body applies the linear part only and leaves the
    // rotational response to the engine-backed implementation.
    this.applyImpulse(impulse);
  }

  applyForce(force: Vec3): void {
    this.forceAccum = {
      x: this.forceAccum.x + force.x,
      y: this.forceAccum.y + force.y,
      z: this.forceAccum.z + force.z,
    };
  }

  applyAngularImpulse(impulse: Vec3): void {
    // Treat the Z moment of inertia as the mass, matching the original's own
    // habit of scaling angular impulses by chassis mass directly.
    this.angularVelocity = {
      ...this.angularVelocity,
      z: this.angularVelocity.z + impulse.z / this.mass,
    };
  }

  /** Integrate one tick: accumulated force, then gravity, then position. */
  integrate(dt: number): void {
    this.linearVelocity = {
      x: this.linearVelocity.x + (this.forceAccum.x / this.mass) * dt,
      y: this.linearVelocity.y + (this.forceAccum.y / this.mass) * dt,
      z: this.linearVelocity.z + (this.forceAccum.z / this.mass) * dt + K.GRAVITY_Z * dt,
    };
    this.forceAccum = vec3();

    this.yaw += this.angularVelocity.z * dt;
    this.position = {
      x: this.position.x + this.linearVelocity.x * dt,
      y: this.position.y + this.linearVelocity.y * dt,
      z: this.position.z + this.linearVelocity.z * dt,
    };
  }
}

/** An infinite plane at z = 0, reporting a single surface id. */
export class FlatGround implements GroundProbe {
  constructor(
    private readonly height = 0,
    private readonly effectId = 1,
  ) {}

  castDown(from: Vec3, maxDistance: number): GroundHit | null {
    const distance = from.z - this.height;
    if (distance < 0 || distance > maxDistance) return null;
    return {
      distance,
      point: vec3(from.x, from.y, this.height),
      effectId: this.effectId,
    };
  }
}
