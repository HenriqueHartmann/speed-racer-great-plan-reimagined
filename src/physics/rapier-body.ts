/**
 * A Rapier-backed chassis.
 *
 * The controller does not know this file exists: it works against `ChassisBody`
 * and `GroundProbe`. That boundary is what lets the physics backend be evaluated,
 * swapped, or dropped entirely without touching handling.
 *
 * Rapier is used for what an engine is actually good at here - integration,
 * collision detection and raycasting. Grip and drive stay in the controller,
 * because that is where the original kept them: it set contact friction and
 * restitution to zero and supplied every force itself.
 */

import type RAPIER from '@dimforge/rapier3d-compat';
import * as K from '../sim/constants.js';
import { vec3, type ChassisBody, type GroundHit, type GroundProbe, type Vec3 } from '../sim/vehicle.js';

type R = typeof RAPIER;

/** Load the WASM module. Must be awaited once before anything else here. */
export async function initRapier(): Promise<R> {
  const mod = await import('@dimforge/rapier3d-compat');
  await mod.init();
  return mod as unknown as R;
}

export class RapierWorld {
  readonly world: RAPIER.World;
  private readonly dynamicBodies: RAPIER.RigidBody[] = [];

  constructor(private readonly rapier: R) {
    // Z-up, matching the original's convention, so recovered numbers transfer.
    this.world = new rapier.World({ x: 0, y: 0, z: K.GRAVITY_Z });
    // The original called havok.step(0.025, 5): it advanced TIMESTEP seconds of
    // simulated time per frame, split into five internal sub-steps.
    //
    // Note that TIMESTEP is not the tick's wall-clock duration. At the movie's
    // 30 fps tempo the original advanced 0.75 s of simulated time per real
    // second, and every force constant was tuned against that. Advancing
    // TICK_DT instead would make the whole car 33% more powerful than the
    // numbers it was tuned with.
    //
    // The five-way split also matters on its own: the suspension is a stiff
    // explicit spring, and integrating it in one coarse step makes it oscillate
    // in pitch and roll.
    this.world.timestep = K.TIMESTEP / K.SUBSTEPS;
  }

  /**
   * A static ground plane as a cuboid.
   *
   * It is deliberately thick. The Jacks impulse is `mass * 40`, which is a
   * velocity change of 40 units per second; at a 1/30 s tick the car travels
   * more than a metre per step, so a thin plane invites tunnelling on the way
   * back down. Thickness plus CCD on the chassis is what keeps that honest.
   */
  addGroundPlane(halfExtent = 2000, thickness = 50): RAPIER.Collider {
    return this.addGroundStrip(halfExtent, halfExtent, 0, thickness);
  }

  /**
   * A drivable strip rather than an infinite plane, so leaving the track means
   * falling - which is what makes the recovered fall-death rule reachable.
   */
  addGroundStrip(
    halfWidth: number,
    halfLength: number,
    centreY: number,
    thickness = 50,
  ): RAPIER.Collider {
    const body = this.world.createRigidBody(this.rapier.RigidBodyDesc.fixed());
    const desc = this.rapier.ColliderDesc.cuboid(halfWidth, halfLength, thickness)
      .setTranslation(0, centreY, -thickness)
      .setFriction(0)
      .setRestitution(0);
    return this.world.createCollider(desc, body);
  }

  /** Registered so their force accumulators can be cleared each tick. */
  track(body: RAPIER.RigidBody): void {
    this.dynamicBodies.push(body);
  }

  /**
   * A static box collider for a track prop.
   *
   * Damage is decided by the simulation's own overlap test, mirroring the
   * original's script-side handler. This exists so the prop also physically
   * stops the car, which the overlap test alone does not do.
   */
  addStaticBox(
    centre: { x: number; y: number; z: number },
    halfExtent: { x: number; y: number; z: number },
  ): RAPIER.Collider {
    const body = this.world.createRigidBody(this.rapier.RigidBodyDesc.fixed());
    const desc = this.rapier.ColliderDesc.cuboid(
      halfExtent.x,
      halfExtent.y,
      halfExtent.z,
    )
      .setTranslation(centre.x, centre.y, centre.z)
      // The original gave the chassis no contact friction or restitution; props
      // match, so hitting one scrubs speed through the impact rather than
      // sticking or bouncing.
      .setFriction(0)
      .setRestitution(0);
    return this.world.createCollider(desc, body);
  }

  /** Remove a collider, for props consumed during play. */
  removeCollider(collider: RAPIER.Collider): void {
    this.world.removeCollider(collider, false);
  }

  step(): void {
    for (let i = 0; i < K.SUBSTEPS; i++) this.world.step();
    // Rapier's addForce/addTorque accumulate and persist across steps; they are
    // not cleared for you. A per-tick force left in place is re-applied forever,
    // which looks exactly like a runaway controller. Clear them explicitly.
    for (const b of this.dynamicBodies) {
      b.resetForces(false);
      b.resetTorques(false);
    }
  }

  free(): void {
    this.world.free();
  }
}

export class RapierChassis implements ChassisBody {
  readonly mass: number;
  private readonly body: RAPIER.RigidBody;

  constructor(
    private readonly rapier: R,
    host: RapierWorld,
    position: Vec3 = vec3(0, 0, K.SPAWN_HEIGHT),
    mass = K.CHASSIS_MASS,
  ) {
    this.mass = mass;

    const desc = rapier.RigidBodyDesc.dynamic()
      .setTranslation(position.x, position.y, position.z)
      // The original damped yaw itself, every update, by a fixed factor. Leaving
      // Rapier's own damping at zero keeps that the controller's job alone.
      .setLinearDamping(0)
      .setAngularDamping(0)
      .setCanSleep(false)
      // The Jacks jump moves the body further per tick than the suspension ray
      // is long. Without continuous collision detection it passes through the
      // ground on the way down.
      .setCcdEnabled(true);
    this.body = host.world.createRigidBody(desc);

    const half = vec3(K.TRACK_WIDTH / 2, K.WHEELBASE_FRONT, 0.4);

    // Inertia of a solid cuboid of these dimensions, then scaled. See
    // CHASSIS_INERTIA_MULTIPLIER for why the scale is there and what it costs.
    const w = half.x * 2;
    const l = half.y * 2;
    const h = half.z * 2;
    const k = (mass / 12) * K.CHASSIS_INERTIA_MULTIPLIER;
    const inertia = {
      x: k * (l * l + h * h),
      y: k * (w * w + h * h),
      z: k * (w * w + l * l),
    };

    const collider = rapier.ColliderDesc.cuboid(half.x, half.y, half.z)
      .setFriction(K.CHASSIS_FRICTION)
      .setRestitution(K.CHASSIS_RESTITUTION)
      .setMassProperties(mass, { x: 0, y: 0, z: 0 }, inertia, {
        x: 0,
        y: 0,
        z: 0,
        w: 1,
      });
    host.world.createCollider(collider, this.body);
    host.track(this.body);
  }

  get position(): Vec3 {
    const t = this.body.translation();
    return vec3(t.x, t.y, t.z);
  }

  set position(v: Vec3) {
    this.body.setTranslation({ x: v.x, y: v.y, z: v.z }, true);
  }

  get linearVelocity(): Vec3 {
    const v = this.body.linvel();
    return vec3(v.x, v.y, v.z);
  }

  set linearVelocity(v: Vec3) {
    this.body.setLinvel({ x: v.x, y: v.y, z: v.z }, true);
  }

  get angularVelocity(): Vec3 {
    const v = this.body.angvel();
    return vec3(v.x, v.y, v.z);
  }

  set angularVelocity(v: Vec3) {
    this.body.setAngvel({ x: v.x, y: v.y, z: v.z }, true);
  }

  private axis(local: Vec3): Vec3 {
    const q = this.body.rotation();
    // Rotate `local` by the body quaternion.
    const { x, y, z, w } = q;
    const ix = w * local.x + y * local.z - z * local.y;
    const iy = w * local.y + z * local.x - x * local.z;
    const iz = w * local.z + x * local.y - y * local.x;
    const iw = -x * local.x - y * local.y - z * local.z;
    return vec3(
      ix * w + iw * -x + iy * -z - iz * -y,
      iy * w + iw * -y + iz * -x - ix * -z,
      iz * w + iw * -z + ix * -y - iy * -x,
    );
  }

  /** The original's local forward is +Y, with Z up. */
  get forward(): Vec3 {
    return this.axis(vec3(0, 1, 0));
  }

  get right(): Vec3 {
    return this.axis(vec3(1, 0, 0));
  }

  get up(): Vec3 {
    return this.axis(vec3(0, 0, 1));
  }

  get pitchDeg(): number {
    const f = this.forward;
    return (Math.asin(Math.max(-1, Math.min(1, f.z))) * 180) / Math.PI;
  }

  get rollDeg(): number {
    const r = this.right;
    return (Math.asin(Math.max(-1, Math.min(1, r.z))) * 180) / Math.PI;
  }

  applyImpulse(impulse: Vec3): void {
    this.body.applyImpulse({ x: impulse.x, y: impulse.y, z: impulse.z }, true);
  }

  applyImpulseAtPoint(impulse: Vec3, localPoint: Vec3): void {
    const world = this.position;
    const offset = this.axis(localPoint);
    this.body.applyImpulseAtPoint(
      { x: impulse.x, y: impulse.y, z: impulse.z },
      { x: world.x + offset.x, y: world.y + offset.y, z: world.z + offset.z },
      true,
    );
  }

  applyForce(force: Vec3): void {
    this.body.addForce({ x: force.x, y: force.y, z: force.z }, true);
  }

  applyAngularImpulse(impulse: Vec3): void {
    this.body.applyTorqueImpulse(
      { x: impulse.x, y: impulse.y, z: impulse.z },
      true,
    );
  }

  /** The underlying body, for the renderer to read a transform from. */
  get rigidBody(): RAPIER.RigidBody {
    return this.body;
  }

  get rapierModule(): R {
    return this.rapier;
  }
}

/** Downward raycast against the Rapier world, excluding the chassis itself. */
export class RapierGround implements GroundProbe {
  constructor(
    private readonly rapier: R,
    private readonly host: RapierWorld,
    private readonly chassis: RapierChassis,
    /** Until real track geometry exists, every hit reports this surface. */
    private readonly effectId = 1,
  ) {}

  castDown(from: Vec3, maxDistance: number): GroundHit | null {
    const ray = new this.rapier.Ray(
      { x: from.x, y: from.y, z: from.z },
      { x: 0, y: 0, z: -1 },
    );
    const hit = this.host.world.castRay(
      ray,
      maxDistance,
      true,
      undefined,
      undefined,
      undefined,
      this.chassis.rigidBody,
    );
    if (!hit) return null;
    return {
      distance: hit.timeOfImpact,
      point: vec3(from.x, from.y, from.z - hit.timeOfImpact),
      effectId: this.effectId,
    };
  }
}
