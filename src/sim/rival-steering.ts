/**
 * The two angle functions a rival steers by, kept apart from everything else.
 *
 * They are pure, they are recovered, and one of them is wrong in a way the
 * project has chosen to keep. Isolating them is what lets the wrong one be
 * pinned deliberately: wrapped inside a pursuit controller, the exact input
 * that triggers it would never be reachable from a test.
 */

const RAD_TO_DEG = 180 / Math.PI;

/**
 * Bearing from one point to another, in the original's convention.
 *
 * `MOVIE.ls:289-307`. Zero is +Y and the angle grows clockwise, which is why
 * `doEnemy:421` negates the result before comparing it with the chassis's own
 * Z rotation.
 *
 * Transcribed branch for branch rather than replaced with `atan2`, because the
 * original's own branches decide the two degenerate cases - a target directly
 * ahead is 0 and one directly behind is 180, both with `xoff = 0`.
 */
export function bearingDeg(x1: number, y1: number, x2: number, y2: number): number {
  const xoff = x2 - x1;
  const yoff = y2 - y1;

  if (xoff > 0) return 90 - Math.atan(yoff / xoff) * RAD_TO_DEG;
  if (xoff === 0) return yoff >= 0 ? 0 : 180;
  return -90 - Math.atan(yoff / xoff) * RAD_TO_DEG;
}

/**
 * Bring a heading difference into a half-turn - **with the original's bug**.
 *
 * RECOVERED. `doEnemy:449-453`:
 *
 *     if dif > 180 then
 *       dif = 180 - dif          <- the symmetric correction is dif - 360
 *     else
 *       if dif < -180 then
 *         dif = dif + 360        <- this branch is right
 *       end if
 *     end if
 *
 * For `dif = 190` the original yields -10 where -170 is correct, so a car
 * needing a large left turn is told to make a small one. The sign survives,
 * which is all that picks the side of the angular impulse at `:455-459`, so
 * the car still comes round - just slowly. The two agree only at exactly 270.
 *
 * It fires above 180 degrees of heading error, which on a line that never
 * doubles back means a car that has been spun: `controlMODE = 0` after a Robot
 * hit, or the first ticks after a recycle. Porting it is a decision, recorded
 * in `docs/design/2026-11-05-rival-ai.md`, not an oversight.
 */
export function wrapAngleDeg(dif: number): number {
  if (dif > 180) return 180 - dif;
  if (dif < -180) return dif + 360;
  return dif;
}
