/**
 * Independent random streams, one per actor.
 *
 * SUBSTITUTE, and deliberately not the original's behaviour. `doEnemy` draws
 * from Director's single global generator in five places - the smart-overtake
 * window (`:789`), the Duggary's speed roll (`:767`), the skin choice
 * (`prepareCar:128`), the +/-1 jitter on a recycled car's target (`doJump:289`)
 * and the voice-over pick (`collisionHandler:177`). One generator, shared.
 *
 * Reproduced faithfully, three rivals sharing one stream would mean rival B's
 * sequence depends on how many draws rival A made, which depends on how many
 * collisions A had. A replay from the same seed still reproduces; what is lost
 * is isolation, so a change to one rival's logic silently reshuffles the other
 * two and no test can say which change caused which difference.
 *
 * These streams therefore do NOT reproduce the original's sequence, and no
 * claim is made that they do.
 */
import { describe, it, expect } from 'vitest';
import { Rng, substream } from '../src/sim/rng.js';

const SEED = 0x5eed_1234;

describe('substream', () => {
  it('gives the same stream for the same seed and index, every time', () => {
    const a = substream(SEED, 2);
    const b = substream(SEED, 2);
    const left = Array.from({ length: 16 }, () => a.next());
    const right = Array.from({ length: 16 }, () => b.next());
    expect(left).toEqual(right);
  });

  it('gives different streams to different indices of the same seed', () => {
    const streams = [0, 1, 2, 3].map((i) => substream(SEED, i));
    const firsts = streams.map((s) => s.next());
    expect(new Set(firsts).size).toBe(4);
  });

  it('gives different streams to the same index of different seeds', () => {
    expect(substream(SEED, 1).next()).not.toBe(substream(SEED + 1, 1).next());
  });

  /**
   * The one that matters, and the one a shared generator fails.
   */
  it('leaves one stream untouched however many draws another makes', () => {
    const undisturbed = substream(SEED, 1);
    const expected = Array.from({ length: 8 }, () => undisturbed.next());

    const noisy = substream(SEED, 0);
    const quiet = substream(SEED, 1);
    const got: number[] = [];
    for (let i = 0; i < 8; i++) {
      // An uneven, state-dependent number of draws on stream 0, which is what
      // a rival with collisions actually does.
      for (let k = 0; k <= i * 3; k++) noisy.next();
      got.push(quiet.next());
    }
    expect(got).toEqual(expected);
  });

  it('round-trips through snapshot and restore', () => {
    const s = substream(SEED, 3);
    for (let i = 0; i < 5; i++) s.next();
    const saved = s.snapshot();
    const after = [s.next(), s.next()];

    const restored = new Rng(0);
    restored.restore(saved);
    expect([restored.next(), restored.next()]).toEqual(after);
  });

  it('is a plain Rng, so index 0 is not special', () => {
    expect(substream(SEED, 0)).toBeInstanceOf(Rng);
  });
});
