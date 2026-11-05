/**
 * Collision response, as `collisionHandler` in the original implemented it.
 *
 * The damage model is entirely script-side there: the physics engine resolved
 * the contact, and the behaviour decided what it cost. Two details are worth
 * preserving because they are recovered, not invented:
 *
 *   - driving on the track never damages, it is explicitly ignored and returned
 *     from early;
 *   - holding reverse during a generic impact suppresses damage completely.
 *
 * See `docs/research/handling-contract.md` section 9b.
 */

import * as K from './constants.js';
import type { Prop } from './track.js';
import type { Vec3 } from './vehicle.js';

/** What a resolved collision costs and does. */
export interface CollisionOutcome {
  damage: number;
  /** Multiply Z angular velocity by this - the recovered generic-impact spin cut. */
  yawCut: number;
  /** Whether the prop should stop colliding, as a felled tree does. */
  consume: boolean;
  sound: 'crash' | 'reaction' | 'none';
}

const NO_EFFECT: CollisionOutcome = {
  damage: 0,
  yawCut: 1,
  consume: false,
  sound: 'none',
};

/** Axis-aligned overlap test. Enough while props are boxes. */
export function overlaps(
  centreA: Vec3,
  halfA: Vec3,
  centreB: Vec3,
  halfB: Vec3,
): boolean {
  return (
    Math.abs(centreA.x - centreB.x) <= halfA.x + halfB.x &&
    Math.abs(centreA.y - centreB.y) <= halfA.y + halfB.y &&
    Math.abs(centreA.z - centreB.z) <= halfA.z + halfB.z
  );
}

export interface ImpactContext {
  /** Signed speed along the chassis forward axis at the moment of contact. */
  forwardVel: number;
  /** Whether the reverse key is held - it suppresses generic-impact damage. */
  reverseHeld: boolean;
  /** Blades reduce enemy-car damage sixfold and let the car fell trees. */
  hasBlades: boolean;
}

/**
 * Resolve one impact.
 *
 * The original read a `hitforce` out of the Havok collision record. We do not
 * have that number, so the `faller` and `enemyCar` formulas take an impact
 * magnitude derived from forward speed instead. That is a **substitute**: the
 * shape of the formula is recovered, the input is ours.
 */
export function resolveImpact(prop: Prop, ctx: ImpactContext): CollisionOutcome {
  const speedFraction = Math.abs(ctx.forwardVel) / K.MAX_SPEED;
  // SUBSTITUTE: stands in for Havok's hitforce, scaled so a full-speed impact
  // lands at the formula's cap rather than far past it.
  const hitForce = speedFraction * 3;

  switch (prop.kind) {
    case 'track':
      // RECOVERED: explicitly ignored. Driving on the road costs nothing.
      return NO_EFFECT;

    case 'faller':
      if (ctx.hasBlades) {
        // RECOVERED from `doHitTree`: with Blades the tree is felled instead.
        return { damage: 0, yawCut: 1, consume: true, sound: 'crash' };
      }
      return {
        damage: Math.min(30, hitForce * 10),
        yawCut: 1,
        consume: false,
        sound: 'crash',
      };

    case 'enemyCar':
      return {
        damage: ctx.hasBlades
          ? Math.min(5, hitForce * 10)
          : Math.min(30, hitForce * 10),
        yawCut: 1,
        consume: false,
        sound: ctx.hasBlades ? 'crash' : 'reaction',
      };

    case 'pickup':
      return { damage: 0, yawCut: 1, consume: true, sound: 'none' };

    case 'wall':
    default: {
      // RECOVERED: holding reverse suppresses the damage entirely, but the
      // spin cut still applies.
      const magnitude = Math.abs(ctx.forwardVel) / 90;
      return {
        damage: ctx.reverseHeld ? 0 : Math.min(10, 30 * magnitude),
        yawCut: 0.2,
        consume: false,
        sound: ctx.reverseHeld ? 'none' : 'crash',
      };
    }
  }
}
