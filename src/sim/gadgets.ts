/**
 * The Mach 5's gadgets.
 *
 * All seven are recovered from the `keyDown` handler and the per-update expiry
 * block in `doMach5`. The original's own key bindings are kept: `a`–`g` and
 * `1`–`7`, which is the same lettering painted on the steering wheel in
 * `mach_5_color.jpg`.
 *
 * Durations are in Director ticks, which are 1/60 s - real time, not simulation
 * ticks. See `docs/research/handling-contract.md`.
 */

import * as K from './constants.js';

export type GadgetId =
  | 'jacks'
  | 'grip'
  | 'blades'
  | 'deflector'
  | 'lights'
  | 'frogger'
  | 'robot';

export interface GadgetSpec {
  readonly id: GadgetId;
  /** The original's own binding: a letter and a digit. */
  readonly keys: readonly string[];
  /** Label the original showed on the HUD. */
  readonly label: string;
  /**
   * Lifetime in Director ticks, or `null` for gadgets that stay on until
   * toggled off. RECOVERED from the `keyDown` handler.
   */
  readonly ticks: number | null;
}

/** RECOVERED - keys, labels and durations, all from `doMach5`'s `keyDown`. */
export const GADGETS: readonly GadgetSpec[] = [
  { id: 'jacks', keys: ['a', '1'], label: 'Jacks', ticks: 80 },
  { id: 'grip', keys: ['b', '2'], label: 'Grip', ticks: 500 },
  { id: 'blades', keys: ['c', '3'], label: 'Blades', ticks: 240 },
  { id: 'deflector', keys: ['d', '4'], label: 'Deflector', ticks: 500 },
  { id: 'lights', keys: ['e', '5'], label: 'Lights', ticks: null },
  { id: 'frogger', keys: ['f', '6'], label: 'Frogger', ticks: null },
  { id: 'robot', keys: ['g', '7'], label: 'Robot', ticks: null },
];

export const GADGET_BY_KEY: ReadonlyMap<string, GadgetId> = new Map(
  GADGETS.flatMap((g) => g.keys.map((k) => [k, g.id] as const)),
);

export const GADGET_BY_ID: ReadonlyMap<GadgetId, GadgetSpec> = new Map(
  GADGETS.map((g) => [g.id, g]),
);

/**
 * Per-gadget runtime state.
 *
 * Expiry is an absolute simulation-tick index, not an accumulated countdown.
 * The original compares integers - `the ticks >= pBladesTIMER` - and so does
 * this: subtracting a float dt each tick accumulates error and can retire a
 * gadget a tick early.
 */
export interface GadgetState {
  active: boolean;
  /** Tick at which it expires. `Infinity` for gadgets that never time out. */
  expiresAtTick: number;
  /** Seconds left, derived for display only. */
  remaining: number;
}

export type GadgetStates = Record<GadgetId, GadgetState>;

export function createGadgetStates(): GadgetStates {
  const states = {} as GadgetStates;
  for (const g of GADGETS) {
    states[g.id] = { active: false, expiresAtTick: Infinity, remaining: 0 };
  }
  return states;
}

/** A gadget's lifetime in seconds, from its duration in 1/60 s ticks. */
export function secondsFor(spec: GadgetSpec): number {
  return spec.ticks === null ? 0 : spec.ticks / K.TICKS_PER_SECOND;
}

/** The same lifetime expressed in whole simulation ticks. */
export function simTicksFor(spec: GadgetSpec): number {
  return spec.ticks === null ? Infinity : Math.round(secondsFor(spec) / K.TICK_DT);
}

/** Why a toggle attempt did not take effect, for the HUD to explain. */
export type ToggleResult = 'activated' | 'deactivated' | 'refused';

/**
 * Toggle a gadget.
 *
 * Most of the original's gadgets toggle freely. Jacks is the exception: it
 * requires all four wheels on the ground, and it is the caller that applies the
 * impulse, because that belongs to the vehicle rather than here.
 */
export function toggleGadget(
  states: GadgetStates,
  id: GadgetId,
  ctx: { powerCoeff: number; tick: number },
): ToggleResult {
  const spec = GADGET_BY_ID.get(id);
  if (!spec) return 'refused';
  const state = states[id];

  if (state.active) {
    // RECOVERED: every gadget in the handler toggles off on a second press.
    // Jacks is the one that does not - it only clears on expiry and regrounding.
    if (id === 'jacks') return 'refused';
    state.active = false;
    state.expiresAtTick = Infinity;
    state.remaining = 0;
    return 'deactivated';
  }

  if (id === 'jacks' && ctx.powerCoeff !== 1) return 'refused';

  state.active = true;
  state.expiresAtTick = ctx.tick + simTicksFor(spec);
  state.remaining = secondsFor(spec);
  return 'activated';
}

/**
 * Advance the timers.
 *
 * `powerCoeff` is needed because Jacks retracts only once a wheel is back on
 * the ground, which is the original's own condition.
 */
export function stepGadgets(
  states: GadgetStates,
  ctx: { powerCoeff: number; tick: number },
): GadgetId[] {
  const expired: GadgetId[] = [];

  for (const spec of GADGETS) {
    const state = states[spec.id];
    if (!state.active || spec.ticks === null) continue;

    state.remaining = Math.max(0, (state.expiresAtTick - ctx.tick) * K.TICK_DT);
    if (ctx.tick < state.expiresAtTick) continue;

    // RECOVERED: Jacks waits for a wheel to touch down before retracting.
    if (spec.id === 'jacks' && ctx.powerCoeff === 0) continue;

    state.active = false;
    state.expiresAtTick = Infinity;
    expired.push(spec.id);
  }

  return expired;
}
