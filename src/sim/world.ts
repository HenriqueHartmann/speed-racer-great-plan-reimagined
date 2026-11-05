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
  type ChassisBody,
  type GroundProbe,
  type VehicleInput,
  type VehicleState,
} from './vehicle.js';

/** Why a run ended. */
export type Outcome = 'running' | 'finished' | 'destroyed' | 'fell';

/** Ordered, tick-stamped gameplay events - compared alongside state in replays. */
export interface SimEvent {
  tick: number;
  kind:
    | 'jacks'
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
  private lastEffectId = -1;

  constructor(opts: WorldOptions) {
    this.rng = new Rng(opts.seed);
    this.vehicle = createVehicleState();
    this.race = createRaceState();
    this.body = opts.body;
    this.probe = opts.probe;
    this.stepPhysics = opts.stepPhysics;
  }

  /** Advance exactly one tick. */
  step(input: VehicleInput = NO_INPUT): void {
    if (this.race.outcome !== 'running') {
      this.tick++;
      return;
    }

    const before = this.vehicle.jacksExtended;

    stepVehicle(this.vehicle, this.body, this.probe, input, K.TICK_DT);
    this.stepPhysics?.(K.TICK_DT);

    if (!before && this.vehicle.jacksExtended) {
      this.events.push({ tick: this.tick, kind: 'jacks' });
    }
    if (this.vehicle.effectId !== this.lastEffectId) {
      this.lastEffectId = this.vehicle.effectId;
      this.events.push({
        tick: this.tick,
        kind: 'surface-change',
        value: this.vehicle.effectId,
      });
    }

    this.updateRace();
    this.tick++;
  }

  /** Advance `n` ticks, pulling input per tick. */
  run(n: number, inputAt: (tick: number) => VehicleInput): void {
    for (let i = 0; i < n; i++) this.step(inputAt(this.tick));
  }

  private updateRace(): void {
    const r = this.race;
    const y = this.body.position.y;

    r.segment = Math.floor(y / K.SEGMENT_LENGTH) + 1;

    // Wrong way: the original tracks the furthest Y ever reached and warns when
    // the car falls more than the margin behind it, then resets the maximum.
    if (y > r.maxY) {
      r.maxY = y;
    } else if (y < r.maxY - K.WRONG_WAY_MARGIN) {
      r.maxY = y;
      this.events.push({ tick: this.tick, kind: 'wrong-way' });
    }

    if (r.underwater) {
      r.oxygenActive = true;
      r.oxygen = Math.max(0, r.oxygen - K.OXYGEN_DRAIN);
      if (!r.hasScope) this.addDamage(K.DROWN_DAMAGE);
    }
    if (r.oxygenActive) {
      r.oxygenDisplayed = ease(r.oxygenDisplayed, r.oxygen);
      if (r.oxygenDisplayed <= 0) this.addDamage(K.DROWN_DAMAGE);
    }

    r.damageDisplayed = ease(r.damageDisplayed, r.damage);

    // The original kills on the DISPLAYED value reaching 100, not the real one,
    // which gives the bar time to fill before the run ends.
    if (r.damageDisplayed >= K.STAT_MAX) {
      r.outcome = 'destroyed';
      this.events.push({ tick: this.tick, kind: 'destroyed' });
      return;
    }

    if (
      this.body.position.z <= K.FALL_DEATH_Z &&
      this.vehicle.powerCoeff === 0
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
