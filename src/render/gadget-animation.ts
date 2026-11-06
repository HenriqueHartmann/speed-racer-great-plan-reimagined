/**
 * The two gadget animations the original runs, as pure ramps.
 *
 * Both were missing: the Blades appeared at full size and stood still, and the
 * Frogger closed the canopy and left the periscope where it was. The timings
 * here are the originals'; what they drive lives in `mach5-original.ts`.
 */

/**
 * RECOVERED - `doMach5:609`, `pBladeFactor = max(0.1, pBladeFactor - 0.1)`.
 *
 * Not zero. The retracted saw is a tenth of its size, and reaching that floor
 * is the moment the original re-enables the trees' collision (`:612-617`).
 */
export const BLADE_REST = 0.1;

/** RECOVERED - `doMach5:589`, `min(1, pBladeFactor + 0.1)`: ten frames out. */
const BLADE_STEP = 0.1;

/**
 * RECOVERED - how fast the saw blade's texture turns: `doMach5:593`,
 * `textureTransform.rotate(0, 0, 52)` about its centre, every frame.
 *
 * The blades do not spin as geometry. The mesh is still and the texture turns
 * under it, which is how a 2007 Shockwave game drew a blur.
 */
export const BLADE_SPIN_DEG = 52;

/**
 * RECOVERED - `doCamera:70-76`. The mast starts at a hundredth, not at zero:
 * the bar is *scaled* by this factor and a zero scale is a degenerate matrix.
 */
export const SCOPE_REST = 0.01;

/** RECOVERED - `doCamera:88`, `min(1, scopeFactor + 0.05)`: twenty frames up. */
const SCOPE_RISE = 0.05;

/** RECOVERED - `doCamera:150`, `max(0.01, scopeFactor - 0.08)`: thirteen down. */
const SCOPE_FALL = 0.08;

/** RECOVERED - `doCamera:112`, `scopeRotate = min(360, scopeRotate + 20)`. */
export const SCOPE_SPIN_DEG = 20;

/** Where the mast sits, from `doCamera:73`'s translate off the chassis. */
export const SCOPE_OFFSET = { x: -0.3, y: -0.9, z: 0.246 } as const;

export function stepBlades(factor: number, active: boolean): number {
  return active
    ? Math.min(1, factor + BLADE_STEP)
    : Math.max(BLADE_REST, factor - BLADE_STEP);
}

export function stepScope(factor: number, active: boolean): number {
  return active
    ? Math.min(1, factor + SCOPE_RISE)
    : Math.max(SCOPE_REST, factor - SCOPE_FALL);
}

/**
 * RECOVERED - `PLAY.ls:52`, `cDirection = cDirection + 8`, wrapping at 360.
 *
 * Forty-five frames to the cycle.
 */
const WATER_STEP_DEG = 8;

/** RECOVERED - `PLAY.ls:50`: the plane slides by `sin(phase) * 1.0` on X. */
const WATER_AMPLITUDE = 1;

export function stepWater(phaseDeg: number): number {
  return (phaseDeg + WATER_STEP_DEG) % 360;
}

export function waterOffset(phaseDeg: number): number {
  return Math.sin((phaseDeg * Math.PI) / 180) * WATER_AMPLITUDE;
}
