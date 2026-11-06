/**
 * What hurts a rival, and how much.
 *
 * The table is recovered in full from `doEnemy:161-234`. What is not
 * recovered, and cannot be, is the unit the table is denominated in: the
 * original reads `collisionDetails[5]` - Havok's own collision magnitude, in
 * Havok's units - and scales it by 0.5 for a rear-ending and compares it
 * against 10 for scenery. This project has no Havok and no conversion to it.
 *
 * So `hitforce` stays UNRESOLVED and `IMPACT_FORCE` is a separately named
 * substitute standing where it stood. Nothing here claims the two are
 * physically equivalent; what is claimed is that the recovered thresholds -
 * 30 to smoke, 100 to destroy, 15 with the saw, 2.5 without, 10 for scenery -
 * are the original's and remain legible in the code.
 */

import * as K from './constants.js';

/** `explosionMODE`, restricted to the values that gate behaviour. */
export type ExplosionMode =
  /** 0 - whole. */
  | 'none'
  /** 1 and 2 - trailing smoke, past 30 damage. Still racing. */
  | 'smoking'
  /** 5 onward - destroyed; the player scores and the car is recycled. */
  | 'destroyed';

/** What hit the rival. `userData.kind` in `collisionHandler`. */
export type ImpactSource =
  | 'track'
  | 'rival'
  | 'player'
  | 'playerBlades'
  | 'scenery';

export interface Impact {
  readonly source: ImpactSource;
  /**
   * The substitute for Havok's `collisionDetails[5]`.
   *
   * See `IMPACT_FORCE_SCALE`. Only `rival` and `scenery` read it; the two
   * player cases are flat numbers in the original and stay flat here.
   */
  readonly force: number;
  /**
   * Whether the rival is the car IN FRONT in a rival-to-rival contact.
   *
   * `doEnemy:189`: only the car with the lower Y takes the damage, so a
   * rear-ending costs the car that was rear-ended, not the one that did it.
   */
  readonly inFront?: boolean;
  /** `controlMODE = 0` - spun by the Robot. Any contact at all is then fatal. */
  readonly spun?: boolean;
  /**
   * Whether the scenery debounce has elapsed. `doEnemy:226` admits a scenery
   * hit at most once a second.
   */
  readonly sceneryReady?: boolean;
}

/** How much damage this impact adds, before any threshold is considered. */
export function damageFrom(impact: Impact): number {
  switch (impact.source) {
    // `doEnemy:187-188`: the track never hurts anyone.
    case 'track':
      return 0;

    // `doEnemy:189-190`. Only the car in front, and only half the force.
    case 'rival':
      return impact.inFront ? impact.force * K.RIVAL_REAR_END_FACTOR : 0;

    // `doEnemy:205`, `:213`. Flat, and the saw is six times the bodywork.
    case 'playerBlades':
      return K.RIVAL_DAMAGE_FROM_BLADES;
    case 'player':
      return K.RIVAL_DAMAGE_FROM_PLAYER;

    // `doEnemy:226-229`. Above the threshold it is not damage, it is death -
    // and below it, nothing at all.
    case 'scenery':
      return impact.sceneryReady !== false && impact.force > K.RIVAL_SCENERY_FORCE
        ? K.STAT_MAX
        : 0;
  }
}

/**
 * The mode a rival is in, given how hurt it is.
 *
 * `doEnemy:191-199` and its three copies: smoke at 30, destroyed at 100.
 *
 * The original guards the smoke transition with `explosionMODE = 0` as well,
 * and that guard is PRESENTATION, not rule: mode 1 spawns a particle emitter
 * (`:620-640`) and re-entering it every frame would spawn a new one every
 * frame. With the particles out of scope the guard is unreachable - mutation
 * confirms removing it changes no outcome - so the mode is a plain function
 * of the damage. Damage only ever rises, and a recycle resets both together.
 */
export function modeAfter(damage: number): ExplosionMode {
  if (damage >= K.STAT_MAX) return 'destroyed';
  if (damage >= K.RIVAL_SMOKE_DAMAGE) return 'smoking';
  return 'none';
}

/**
 * Apply one impact. Returns the new damage and mode.
 *
 * `doEnemy:184-186` comes first and overrides everything: a rival spun by the
 * Robot detonates on its next contact of any kind, which is the Robot's whole
 * purpose.
 */
export function applyImpact(
  damage: number,
  mode: ExplosionMode,
  impact: Impact,
): { damage: number; mode: ExplosionMode } {
  if (impact.spun && impact.source !== 'track') {
    return { damage: K.STAT_MAX, mode: 'destroyed' };
  }

  void mode;
  const next = Math.min(K.STAT_MAX, damage + damageFrom(impact));
  return { damage: next, mode: modeAfter(next) };
}

/**
 * Havok's collision magnitude, substituted.
 *
 * SUBSTITUTE, and deliberately not presented as a conversion. The original's
 * number is Havok's; this one is the closing speed along the line between two
 * bodies, which is the quantity a player can see and a test can state.
 *
 * CALIBRATION. `IMPACT_FORCE_SCALE` is the one free parameter and it was not
 * chosen to make any particular collision fatal after any particular number
 * of hits. It was chosen so that the recovered scenery threshold of 10 lands
 * where a scenery hit should become fatal, and the recovered 100-point pool
 * then follows from the table rather than being tuned to it:
 *
 *   - At a closing speed of 10 - a slow nudge, about a sixth of top speed -
 *     the force is 1. Below the scenery threshold, and a rear-ending costs
 *     0.5 of a 100-point pool, so a queue of slow shunts cannot destroy a car.
 *   - At the player's top speed of 69 the force is 6.9: still under the
 *     scenery threshold, so brushing a wall at speed is survivable.
 *   - A head-on between two cars at full speed closes at about 138, giving
 *     13.8 - over the scenery threshold, and 6.9 of damage to the car in
 *     front. Meaningfully worse than the nudge, by the ratio of the speeds.
 *
 * What remains uncertain: the original's own scale. If Havok's magnitude ran
 * an order of magnitude higher or lower than closing speed, its rivals
 * destroyed each other far more or far less readily than ours will. Nothing
 * in the artifact settles it, and this constant is where that uncertainty is
 * concentrated rather than spread through the table.
 */
export function impactForce(closingSpeed: number): number {
  return Math.max(0, closingSpeed) * K.IMPACT_FORCE_SCALE;
}
