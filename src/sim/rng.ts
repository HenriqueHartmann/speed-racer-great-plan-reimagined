/**
 * Seeded pseudo-random source.
 *
 * The simulation must never call `Math.random()`: a replay has to reproduce the
 * same sequence from the same seed, on the same build, every time. This is
 * mulberry32 - small, fast, and with a state we can snapshot and restore.
 */
export class Rng {
  private state: number;

  constructor(seed: number) {
    // Force to uint32 so the same seed means the same stream regardless of how
    // the caller produced it.
    this.state = seed >>> 0;
  }

  /** Uniform in [0, 1). */
  next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Integer in [0, n). */
  nextInt(n: number): number {
    return Math.floor(this.next() * n);
  }

  /** The full generator state, for snapshotting. */
  snapshot(): number {
    return this.state;
  }

  restore(state: number): void {
    this.state = state >>> 0;
  }
}
