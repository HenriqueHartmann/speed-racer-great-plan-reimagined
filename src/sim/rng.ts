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

/**
 * An independent stream for one actor, derived from the world seed.
 *
 * SUBSTITUTE. The original had a single global generator and every rival drew
 * from it - `doEnemy:789`, `:767`, `prepareCar:128`, `doJump:289`,
 * `collisionHandler:177`. Sharing one stream between three rivals would make
 * each one's sequence depend on how many draws the others made, and so on how
 * many collisions they had. The replay would still reproduce; the isolation
 * would not, and a change to one rival would silently reshuffle the rest.
 *
 * These streams therefore do not reproduce the original's sequence and no
 * claim is made that they do.
 *
 * The index is mixed with the golden-ratio constant before seeding. Be honest
 * about why: mutation shows plain `seed + index` passes every test here,
 * because mulberry32's first step already adds a large odd constant and
 * scrambles, so adjacent seeds give unrelated streams. The mix is cheap
 * insurance against a future generator that is less forgiving, not a
 * requirement anything has demonstrated.
 */
export function substream(seed: number, index: number): Rng {
  return new Rng((seed ^ Math.imul(index + 1, 0x9e37_79b9)) >>> 0);
}
