/**
 * The fixed-timestep simulation.
 *
 * Nothing here reads a clock, touches the DOM or calls `Math.random()`. The
 * simulation advances in whole ticks, driven by a tick-indexed input sequence,
 * which is what makes a replay reproducible and lets the renderer run at any
 * frame rate without changing the result.
 */

import * as K from './constants.js';
import { Rng } from './rng.js';
import {
  createVehicleState,
  stepVehicle,
  NO_INPUT,
  vec3,
  type ChassisBody,
  type GroundProbe,
  type VehicleInput,
  type VehicleState,
} from './vehicle.js';
import { overlaps, resolveImpact, withinReach } from './collision.js';
import { rearmRobot } from './gadgets.js';
import { segmentIndexFor, type Track } from './track.js';

/** Why a run ended. */
export type Outcome = 'running' | 'finished' | 'destroyed' | 'fell';

/** Ordered, tick-stamped gameplay events - compared alongside state in replays. */
export interface SimEvent {
  tick: number;
  kind:
    | 'gadget'
    | 'wrong-way'
    | 'surface-change'
    | 'damage'
    | 'repair'
    | 'oxygen'
    | 'finish'
    | 'destroyed'
    | 'fell';
  /** Rounded so the event log is stable to compare. */
  value?: number;
  /** Which gadget, for `gadget` events. */
  gadget?: string;
}

export interface RaceState {
  damage: number;
  damageDisplayed: number;
  oxygen: number;
  oxygenDisplayed: number;
  oxygenActive: boolean;
  score: number;
  maxY: number;
  segment: number;
  underwater: boolean;
  hasScope: boolean;
  outcome: Outcome;
}

export function createRaceState(): RaceState {
  return {
    damage: 0,
    damageDisplayed: 0,
    oxygen: K.STAT_MAX,
    oxygenDisplayed: K.STAT_MAX,
    oxygenActive: false,
    score: 0,
    maxY: 0,
    segment: 1,
    underwater: false,
    hasScope: false,
    outcome: 'running',
  };
}

export interface WorldOptions {
  seed: number;
  body: ChassisBody;
  probe: GroundProbe;
  /** Advances the physics backend by `dt`; omitted in pure-controller tests. */
  stepPhysics?: (dt: number) => void;
  /** Supplies props and segment transitions; omitted on a bare plane. */
  track?: Track;
}

export class World {
  readonly rng: Rng;
  readonly vehicle: VehicleState;
  readonly race: RaceState;
  readonly events: SimEvent[] = [];
  tick = 0;

  private readonly body: ChassisBody;
  private readonly probe: GroundProbe;
  private readonly stepPhysics: ((dt: number) => void) | undefined;
  private readonly track: Track | undefined;
  private lastEffectId = -1;
  /** Simulated seconds until collisions are heeded again - the 60-tick debounce. */
  private collisionCooldown = 0;
  /**
   * Props the car is currently inside.
   *
   * The original received discrete collision events from Havok, so an impact
   * fired once on contact. An overlap test fires every tick while the car stays
   * inside a prop, which is not the same thing: a car resting against a wall
   * would burn the debounce at zero speed and then be immune. Tracking entry
   * restores event semantics.
   */
  private touching = new Set<number>();

  constructor(opts: WorldOptions) {
    this.rng = new Rng(opts.seed);
    this.vehicle = createVehicleState();
    this.race = createRaceState();
    this.body = opts.body;
    this.probe = opts.probe;
    this.stepPhysics = opts.stepPhysics;
    this.track = opts.track;
  }

  /** Advance exactly one tick. */
  step(input: VehicleInput = NO_INPUT): void {
    if (this.race.outcome !== 'running') {
      this.tick++;
      return;
    }

    const before = this.vehicle.jacksExtended;

    stepVehicle(this.vehicle, this.body, this.probe, input, K.TICK_DT, this.tick);
    this.stepPhysics?.(K.TICK_DT);

    for (const id of this.vehicle.justActivated) {
      this.events.push({ tick: this.tick, kind: 'gadget', gadget: id });

      // RECOVERED: deploying the Frogger out of water tops the tank back up.
      if (id === 'frogger' && !this.race.underwater) {
        this.race.oxygen = K.STAT_MAX;
      }
    }
    void before;
    if (this.vehicle.effectId !== this.lastEffectId) {
      this.lastEffectId = this.vehicle.effectId;
      this.events.push({
        tick: this.tick,
        kind: 'surface-change',
        value: this.vehicle.effectId,
      });
    }

    this.updateCollisions(input);
    this.updateRace();
    this.tick++;
  }

  /**
   * Resolve contacts against the active segment's props.
   *
   * Only the car's own segment is consulted, which is the original's behaviour
   * and means props in adjacent segments are intangible.
   */
  private updateCollisions(input: VehicleInput): void {
    if (!this.track) return;

    if (this.collisionCooldown > 0) {
      this.collisionCooldown = Math.max(0, this.collisionCooldown - K.TICK_DT);
    }

    const carHalf = vec3(K.TRACK_WIDTH / 2, K.WHEELBASE_FRONT, 0.5);
    const pos = this.body.position;
    const stillTouching = new Set<number>();

    for (const prop of this.track.collidableProps()) {
      // A pickup is reached by the saw, not by the bodywork: a sphere at the
      // chassis origin rather than the chassis box. See PICKUP_REACH.
      const touching =
        prop.kind === 'pickup'
          ? withinReach(pos, prop.position, prop.halfExtent, K.PICKUP_REACH)
          : overlaps(pos, carHalf, prop.position, prop.halfExtent);
      if (!touching) continue;
      stillTouching.add(prop.id);

      // Pickups ignore the debounce: they are consumed on contact, so there is
      // nothing to re-trigger.
      if (prop.kind === 'pickup') {
        prop.active = false;
        this.applyPickup(prop.pickup);
        continue;
      }

      // Only the moment of entry counts as an impact.
      if (this.touching.has(prop.id)) continue;
      if (this.collisionCooldown > 0) continue;

      const outcome = resolveImpact(prop, {
        forwardVel: this.vehicle.forwardVel,
        reverseHeld: input.backward,
        hasBlades: this.vehicle.hasBlades,
      });

      if (outcome.yawCut !== 1) {
        const av = this.body.angularVelocity;
        this.body.angularVelocity = vec3(av.x, av.y, av.z * outcome.yawCut);
      }
      if (outcome.consume) prop.active = false;
      if (outcome.damage > 0) this.addDamage(outcome.damage);

      this.collisionCooldown = K.COLLISION_DEBOUNCE_SECONDS;
    }

    this.touching = stillTouching;
  }

  private applyPickup(kind: string | undefined): void {
    switch (kind) {
      case 'wrench':
        this.repair();
        break;
      case 'oxygen':
        this.collectOxygen();
        this.award(K.OXYGEN_SCORE);
        break;
      case 'candyRed':
        this.award(K.CANDY_RED_SCORE);
        break;
      case 'candyPurple':
        this.award(K.CANDY_PURPLE_SCORE);
        break;
      case 'robot':
        // `handlePickups.ls:66-69`: the score, and `gROBOTMODE = 4 -> 0`,
        // which is the only way to get the Robot back once it has flown.
        this.award(K.ROBOT_SCORE);
        rearmRobot(this.vehicle.gadgets);
        break;
      default:
        break;
    }
  }

  private award(points: number): void {
    this.race.score += points;
    this.events.push({ tick: this.tick, kind: 'repair', value: this.race.score });
  }

  /** Advance `n` ticks, pulling input per tick. */
  run(n: number, inputAt: (tick: number) => VehicleInput): void {
    for (let i = 0; i < n; i++) this.step(inputAt(this.tick));
  }

  private updateRace(): void {
    const r = this.race;
    const y = this.body.position.y;

    const segment = segmentIndexFor(y);
    if (segment !== r.segment) {
      r.segment = segment;
      // The original's `doM5ChangeSegment`: swap which props are collidable.
      this.track?.changeSegment(segment);
    }

    // Wrong way: the original tracks the furthest Y ever reached and warns when
    // the car falls more than the margin behind it, then resets the maximum.
    if (y > r.maxY) {
      r.maxY = y;
    } else if (y < r.maxY - K.WRONG_WAY_MARGIN) {
      r.maxY = y;
      this.events.push({ tick: this.tick, kind: 'wrong-way' });
    }

    // Oxygen is the Frogger's supply, not a drowning timer.
    //
    // RECOVERED, and a correction to earlier documentation: the original drains
    // oxygen while the **scope is deployed** - `if (pSheildRotate = 0) and
    // (pHasScope = 1)` - not while the car is underwater. Submerged without the
    // Frogger you take damage instead; submerged with it, you spend oxygen.
    const scopeDeployed = this.vehicle.hasScope;

    if (scopeDeployed) {
      r.oxygenActive = true;
      r.oxygen = Math.max(0, r.oxygen - K.OXYGEN_DRAIN);
    }
    if (r.underwater && !scopeDeployed) {
      this.addDamage(K.DROWN_DAMAGE);
    }
    if (r.oxygenActive) {
      r.oxygenDisplayed = ease(r.oxygenDisplayed, r.oxygen);
      // Out of air with the scope still out drowns you anyway.
      if (r.oxygenDisplayed <= 0 && scopeDeployed) this.addDamage(K.DROWN_DAMAGE);
    }

    r.damageDisplayed = ease(r.damageDisplayed, r.damage);

    // The original kills on the DISPLAYED value reaching 100, not the real one,
    // which gives the bar time to fill before the run ends.
    if (r.damageDisplayed >= K.STAT_MAX) {
      r.outcome = 'destroyed';
      this.events.push({ tick: this.tick, kind: 'destroyed' });
      return;
    }

    // `doMach5:675` gates this on three things, not two: below the height,
    // no wheel hovering, and `pTrackFace = 99`. The third is redundant under
    // the original's own ray length - a wheel is grounded exactly when its ray
    // hits, so no wheel grounded already means the ray missed - but it is the
    // condition the original wrote, and it says what the rule is about.
    if (
      this.body.position.z <= K.FALL_DEATH_Z &&
      this.vehicle.powerCoeff === 0 &&
      this.vehicle.effectId === K.NO_GROUND_EFFECT_ID
    ) {
      r.outcome = 'fell';
      this.events.push({ tick: this.tick, kind: 'fell' });
      return;
    }

    if (y >= K.FINISH_Y) {
      r.score += K.FINISH_FIRST_SCORE;
      r.outcome = 'finished';
      this.events.push({ tick: this.tick, kind: 'finish', value: r.score });
    }
  }

  addDamage(amount: number): void {
    this.race.damage = Math.min(K.STAT_MAX, Math.max(0, this.race.damage + amount));
    this.events.push({
      tick: this.tick,
      kind: 'damage',
      value: round(this.race.damage),
    });
  }

  repair(): void {
    this.race.damage = Math.max(0, this.race.damage - K.REPAIR_AMOUNT);
    this.race.score += K.REPAIR_SCORE;
    this.events.push({ tick: this.tick, kind: 'repair', value: this.race.score });
  }

  collectOxygen(): void {
    this.race.oxygen = Math.min(K.STAT_MAX, this.race.oxygen + K.OXYGEN_PICKUP);
    this.events.push({ tick: this.tick, kind: 'oxygen', value: round(this.race.oxygen) });
  }

  /**
   * A stable snapshot for replay comparison.
   *
   * Floats are rounded to a fixed number of decimals so that comparison is over
   * the values we intend to be deterministic, rather than over the last bit of
   * every float. Fields that carry no meaning for determinism are left out
   * entirely rather than compared and ignored.
   */
  snapshot(): SimSnapshot {
    return {
      tick: this.tick,
      rng: this.rng.snapshot(),
      position: roundVec(this.body.position),
      linearVelocity: roundVec(this.body.linearVelocity),
      angularVelocity: roundVec(this.body.angularVelocity),
      powerCoeff: this.vehicle.powerCoeff,
      turnBuild: round(this.vehicle.turnBuild),
      forwardVel: round(this.vehicle.forwardVel),
      effectId: this.vehicle.effectId,
      jacksExtended: this.vehicle.jacksExtended,
      jacksCooldown: round(this.vehicle.jacksCooldown),
      slideSpeed: round(this.vehicle.slideSpeed),
      isLanding: this.vehicle.isLanding,
      damage: round(this.race.damage),
      oxygen: round(this.race.oxygen),
      score: this.race.score,
      segment: this.race.segment,
      outcome: this.race.outcome,
    };
  }
}

export interface SimSnapshot {
  tick: number;
  rng: number;
  position: [number, number, number];
  linearVelocity: [number, number, number];
  angularVelocity: [number, number, number];
  powerCoeff: number;
  turnBuild: number;
  forwardVel: number;
  effectId: number;
  jacksExtended: boolean;
  jacksCooldown: number;
  slideSpeed: number;
  isLanding: boolean;
  damage: number;
  oxygen: number;
  score: number;
  segment: number;
  outcome: Outcome;
}

/** Decimal places kept when comparing snapshots. */
export const SNAPSHOT_PRECISION = 6;

function round(v: number): number {
  const f = 10 ** SNAPSHOT_PRECISION;
  return Math.round(v * f) / f;
}

function roundVec(v: { x: number; y: number; z: number }): [number, number, number] {
  return [round(v.x), round(v.y), round(v.z)];
}

function ease(displayed: number, actual: number): number {
  const next = Math.min(
    K.STAT_MAX,
    Math.max(0, displayed + (actual - displayed) * K.BAR_EASE),
  );
  return Math.abs(next - actual) <= K.BAR_SNAP ? actual : next;
}
