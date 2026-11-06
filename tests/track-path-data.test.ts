/**
 * The racing line, as the asset carries it.
 *
 * It is the one piece of the level that came decoded with the track and sat
 * unused. What matters here is that it survives the trip through `PREP`'s
 * quantisation unchanged, and that the properties `doEnemy` leans on - a
 * complete 1..N index and a strictly rising Y - are checked rather than
 * assumed, because a replaced file would not re-run the extractor.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { parseTrackPath, waypoint } from '../src/sim/track-path.js';
import { Glb } from './glb.js';

const FILE = 'public/models/track-path.bin';
const path = () => parseTrackPath(readFileSync(FILE));

/** A minimal well-formed file, for the rejection cases. */
function valid(points: readonly (readonly [number, number, number])[]): Uint8Array {
  const bytes = new Uint8Array(16 + points.length * 12);
  const view = new DataView(bytes.buffer);
  bytes.set([0x53, 0x52, 0x50, 0x54], 0);
  view.setUint32(4, 1, true);
  view.setUint32(8, points.length, true);
  view.setUint32(12, 37, true);
  points.forEach((p, i) => {
    view.setInt32(16 + i * 12, p[0], true);
    view.setInt32(16 + i * 12 + 4, p[1], true);
    view.setInt32(16 + i * 12 + 8, p[2], true);
  });
  return bytes;
}

describe('track-path.bin', () => {
  it('carries all 209 waypoints', () => {
    expect(path().count).toBe(209);
  });

  it('holds integers, because pathList does', () => {
    // `PREP:308` stores `point(integer(x), integer(y))` and `ceil(z)`. The
    // rival aims at the rounded point; storing the float would be a different
    // racing line from the one the game drove.
    const p = path();
    for (let i = 0; i < p.count * 3; i++) {
      expect(Number.isInteger(p.points[i]), `component ${i}`).toBe(true);
    }
  });

  it('matches the GLB it was built from, rounded', () => {
    const glb = new Glb('public/models/track.glb');
    const p = path();
    const lingoInteger = (v: number) => (v < 0 ? -Math.round(-v) : Math.round(v));
    for (let step = 1; step <= p.count; step++) {
      const node = glb.node(`path_${String(step).padStart(2, '0')}`).translation!;
      const w = waypoint(p, step);
      expect(w.x, `waypoint ${step} x`).toBe(lingoInteger(node.x));
      expect(w.y, `waypoint ${step} y`).toBe(lingoInteger(node.y));
    }
  });

  it('runs the length of the course', () => {
    const p = path();
    // 37 segments of 300 is 11,100; the line must span essentially all of it.
    expect(waypoint(p, 1).y).toBeLessThan(300);
    expect(waypoint(p, p.count).y).toBeGreaterThan(11000);
  });

  it('advances in Y at every single step', () => {
    // Not a property of the data so much as a requirement of the code that
    // reads it: `tYOffset` is how doEnemy measures who is ahead.
    const p = path();
    for (let step = 2; step <= p.count; step++) {
      expect(waypoint(p, step).y, `step ${step}`).toBeGreaterThan(waypoint(p, step - 1).y);
    }
  });

  it('spaces its waypoints well outside the 10-unit acceptance radius', () => {
    // `doEnemy:424` advances when within 10. If a gap were ever shorter than
    // that, a car would skip waypoints without steering toward them.
    const p = path();
    for (let step = 2; step <= p.count; step++) {
      const a = waypoint(p, step - 1);
      const b = waypoint(p, step);
      expect(Math.hypot(b.x - a.x, b.y - a.y), `gap before ${step}`).toBeGreaterThan(10);
    }
  });

  it('numbers its steps from 1, as pathList does', () => {
    const p = path();
    expect(() => waypoint(p, 0)).toThrow(/outside/);
    expect(() => waypoint(p, p.count + 1)).toThrow(/outside/);
    expect(() => waypoint(p, 1.5)).toThrow(/outside/);
  });

  it('refuses a file that is not a path', () => {
    const bad = valid([[0, 0, 0]]);
    bad[0] = 0x00;
    expect(() => parseTrackPath(bad)).toThrow(/bad magic/);
  });

  it('refuses a version it does not know', () => {
    const bad = valid([[0, 0, 0]]);
    new DataView(bad.buffer).setUint32(4, 2, true);
    expect(() => parseTrackPath(bad)).toThrow(/unsupported version/);
  });

  it('refuses a truncated file rather than reading past it', () => {
    expect(() => parseTrackPath(valid([[0, 0, 0]]).subarray(0, 20))).toThrow(/expected 28 bytes/);
    expect(() => parseTrackPath(new Uint8Array(8))).toThrow(/no header/);
  });

  it('refuses a line that doubles back', () => {
    expect(() => parseTrackPath(valid([[0, 100, 0], [0, 50, 0]]))).toThrow(/does not advance in Y/);
    expect(() => parseTrackPath(valid([[0, 100, 0], [0, 100, 0]]))).toThrow(/does not advance in Y/);
  });

  it('reads a file whose bytes do not start on a word boundary', () => {
    const src = valid([[1, 2, 3], [4, 5, 6]]);
    const padded = new Uint8Array(src.length + 1);
    padded.set(src, 1);
    const p = parseTrackPath(padded.subarray(1));
    expect(waypoint(p, 2)).toEqual({ x: 4, y: 5, z: 6 });
  });
});
