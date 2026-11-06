/**
 * The rival's two pure steering functions, tested away from any physics.
 *
 * Both are small, both are recovered, and one of them carries a bug that the
 * project has decided to keep. Testing them in isolation is the only way to
 * pin the bug deliberately rather than inherit it by accident - a pursuit
 * controller wrapped around them would hide the exact input that triggers it.
 */
import { describe, it, expect } from 'vitest';
import { bearingDeg, wrapAngleDeg } from '../src/sim/rival-steering.js';
import { targetSpeed } from '../src/sim/rival.js';

describe('bearingDeg', () => {
  // `MOVIE.ls:289-307`. Zero is +Y, and the angle grows clockwise, which is
  // why the whole thing is negated at the one place that uses it
  // (`doEnemy:421`: `goto_rot = -getAngle(...)`).
  it('is zero straight ahead in +Y', () => {
    expect(bearingDeg(0, 0, 0, 10)).toBe(0);
  });

  it('is 180 straight back in -Y', () => {
    expect(bearingDeg(0, 0, 0, -10)).toBe(180);
  });

  it('is 90 to the right in +X', () => {
    expect(bearingDeg(0, 0, 10, 0)).toBeCloseTo(90, 10);
  });

  it('is -90 to the left in -X', () => {
    expect(bearingDeg(0, 0, -10, 0)).toBeCloseTo(-90, 10);
  });

  it('splits the quadrants at 45 degrees', () => {
    expect(bearingDeg(0, 0, 10, 10)).toBeCloseTo(45, 10);
    expect(bearingDeg(0, 0, -10, 10)).toBeCloseTo(-45, 10);
    expect(bearingDeg(0, 0, 10, -10)).toBeCloseTo(135, 10);
    expect(bearingDeg(0, 0, -10, -10)).toBeCloseTo(-135, 10);
  });

  it('depends only on the direction, not the distance', () => {
    expect(bearingDeg(0, 0, 3, 4)).toBeCloseTo(bearingDeg(0, 0, 300, 400), 10);
  });

  it('is measured from the first point, wherever that is', () => {
    expect(bearingDeg(100, 5000, 100, 5010)).toBe(0);
    expect(bearingDeg(-40, -7, -40, -17)).toBe(180);
  });
});

describe('wrapAngleDeg', () => {
  it('leaves a difference already inside the half-turn alone', () => {
    for (const d of [0, 1, -1, 90, -90, 179, -179, 180]) {
      expect(wrapAngleDeg(d), `${d}`).toBe(d);
    }
  });

  it('wraps a difference below -180 by adding a full turn', () => {
    // `doEnemy:452`. This branch is right.
    expect(wrapAngleDeg(-190)).toBe(170);
    expect(wrapAngleDeg(-350)).toBe(10);
  });

  /**
   * RECOVERED, and wrong on purpose.
   *
   * `doEnemy:449-450` computes `180 - dif` where the symmetric correction is
   * `dif - 360`. For 190 the original yields -10 rather than -170: a car that
   * needs a large left turn is told to make a small one. Both give a left
   * turn, so the sign survives and the car still comes round - more slowly,
   * and that slowness is the original's.
   *
   * It fires only above 180 degrees of heading error, which on a line that
   * never doubles back means a car that has been spun: the `controlMODE = 0`
   * state after a Robot hit, or the first ticks after a recycle.
   */
  it('reproduces the original s wrong correction above +180', () => {
    expect(wrapAngleDeg(190)).toBe(-10);
    expect(wrapAngleDeg(270)).toBe(-90);
    expect(wrapAngleDeg(350)).toBe(-170);
    // What a correct implementation would have returned, for the record:
    // 190 -> -170, 270 -> -90, 350 -> -10. Only 270 agrees.
    expect(wrapAngleDeg(270)).toBe(270 - 360);
  });

  it('keeps the turn on the correct side despite the error', () => {
    // The value is wrong; the sign is not, and the sign is what picks the
    // direction of the angular impulse at `doEnemy:455-459`.
    for (const d of [181, 190, 250, 300, 359]) {
      expect(Math.sign(wrapAngleDeg(d)), `${d}`).toBe(-1);
    }
  });
});

describe('targetSpeed', () => {
  // `doEnemy:781` and every other branch of the speed table:
  // `pMaxSpeed = ts - (ts * turnFactor * distFactor)`. It is the only thing
  // standing between a rival and a corner - the script has no brake at all.
  const aim = (turnFactor: number, distFactor: number) => ({ turnFactor, distFactor });

  it('leaves full speed alone when the car is aimed straight', () => {
    expect(targetSpeed(60, aim(0, 1))).toBe(60);
  });

  it('leaves full speed alone when the target is far away', () => {
    // distFactor is 0 at 50 units or more, so a distant corner costs nothing
    // until the car is close to it.
    expect(targetSpeed(60, aim(1, 0))).toBe(60);
  });

  it('stops the car dead only when both are at their maximum', () => {
    expect(targetSpeed(60, aim(1, 1))).toBe(0);
  });

  it('scales down by the product, not by either one', () => {
    expect(targetSpeed(60, aim(0.5, 0.5))).toBeCloseTo(45, 10);
    expect(targetSpeed(60, aim(1, 0.25))).toBeCloseTo(45, 10);
    expect(targetSpeed(60, aim(0.25, 1))).toBeCloseTo(45, 10);
  });

  it('slows a badly aimed car more the closer it gets', () => {
    const far = targetSpeed(60, aim(0.8, 0.2));
    const near = targetSpeed(60, aim(0.8, 0.9));
    expect(near).toBeLessThan(far);
  });
});
