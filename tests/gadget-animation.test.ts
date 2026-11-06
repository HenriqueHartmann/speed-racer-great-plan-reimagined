/**
 * The two gadget animations, as the original times them.
 *
 * Both were missing: the Blades appeared at full size and stood still, and
 * the Frogger closed the canopy and left the periscope where it was.
 */
import { describe, it, expect } from 'vitest';
import {
  stepBlades,
  stepScope,
  stepWater,
  waterOffset,
  BLADE_REST,
  SCOPE_REST,
} from '../src/render/gadget-animation.js';

describe('the Blades', () => {
  it('grows out over ten frames rather than appearing', () => {
    // `doMach5:589`: pBladeFactor = min(1, pBladeFactor + 0.1).
    let f = BLADE_REST;
    const seen = [f];
    for (let i = 0; i < 12; i++) seen.push((f = stepBlades(f, true)));
    expect(seen[1]).toBeCloseTo(0.2, 6);
    expect(seen[9]).toBeCloseTo(1, 6);
    expect(f).toBe(1); // and stops there
  });

  it('retracts to a tenth and no further', () => {
    // `doMach5:609`: max(0.1, pBladeFactor - 0.1). The floor is what the
    // original waits for before it re-enables the trees' collision.
    let f = 1;
    for (let i = 0; i < 20; i++) f = stepBlades(f, false);
    expect(f).toBe(BLADE_REST);
    expect(BLADE_REST).toBe(0.1);
  });

  it('never leaves the range it was given', () => {
    for (const start of [0, 0.5, 1, 2, -1]) {
      expect(stepBlades(start, true)).toBeLessThanOrEqual(1);
      expect(stepBlades(start, false)).toBeGreaterThanOrEqual(BLADE_REST);
    }
  });
});

describe('the periscope', () => {
  it('rises over twenty frames', () => {
    // `doCamera:88`: scopeFactor = min(1, scopeFactor + 0.05), from 0.01.
    let f = SCOPE_REST;
    let frames = 0;
    while (f < 1 && frames < 100) {
      f = stepScope(f, true);
      frames++;
    }
    expect(frames).toBe(20);
    expect(f).toBe(1);
  });

  it('comes down faster than it goes up', () => {
    // `doCamera:150`: max(0.01, scopeFactor - 0.08).
    let f = 1;
    let frames = 0;
    while (f > SCOPE_REST && frames < 100) {
      f = stepScope(f, false);
      frames++;
    }
    expect(frames).toBe(13);
    expect(f).toBe(SCOPE_REST);
  });

  it('starts from very nearly nothing, not from zero', () => {
    // The bar is scaled by this factor, and a zero scale is a degenerate
    // matrix. The original starts it at 0.01 for that reason.
    expect(SCOPE_REST).toBe(0.01);
    expect(stepScope(SCOPE_REST, false)).toBe(SCOPE_REST);
  });
});

/**
 * The water's slosh.
 *
 * `PLAY.ls:48-55` moves each water plane along X by `sin(cDirection)` while
 * `cDirection` advances 8 degrees a frame and wraps at 360 - a 45-frame
 * period, one unit either way. The planes carry no physics at all: `PREP:315`
 * gives them no rigid body, no collision modifier and no segment array.
 */
describe('the water', () => {
  it('sloshes one unit either way', () => {
    const seen: number[] = [];
    let phase = 0;
    for (let frame = 0; frame < 45; frame++) {
      seen.push(waterOffset(phase));
      phase = stepWater(phase);
    }
    expect(Math.max(...seen)).toBeCloseTo(1, 2);
    expect(Math.min(...seen)).toBeCloseTo(-1, 2);
  });

  it('comes back to where it started after forty-five frames', () => {
    let phase = 0;
    for (let frame = 0; frame < 45; frame++) phase = stepWater(phase);
    expect(phase).toBe(0);
  });

  it('advances eight degrees a frame', () => {
    expect(stepWater(0)).toBe(8);
    expect(stepWater(352)).toBe(0);
  });
});
