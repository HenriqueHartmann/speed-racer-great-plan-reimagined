/**
 * The rivals' racing line: 209 waypoints.
 *
 * Input:  public/models/track.glb
 * Output: public/models/track-path.bin
 *
 * `PREP:308-311` reads the `path_NN` nodes and stores them QUANTISED:
 *
 *     pntLoc = point(integer(x), integer(y))
 *     pathList[pntNum] = [pntLoc, 0, ceil(z)]
 *
 * then removes the nodes from the world. The quantisation is behaviour, not a
 * detail of the loader - a rival aims at the rounded point, not the authored
 * one - so this file stores what `pathList` holds, never the raw float.
 *
 * Lingo's `integer()` ROUNDS, half away from zero; proved from the artifact in
 * `MOVIE.ls:263-288`, where `ceil` is `integer(f + 0.5)` and `floor` is
 * `integer(f - 0.5)`, both of which are wrong under truncation and right under
 * rounding. `ceil` is that same helper, so z goes through it rather than
 * through `Math.ceil`: for an exact integer it returns it unchanged, and
 * otherwise it is `round(z + 0.5)`.
 *
 * The index comes from the NAME here, not the position - `pntNum =
 * integer(chars(tmodel.name, 6, 8))` - because the order round the course is
 * the whole point of the list. That is the same exception `PREP:378` makes for
 * `SEG_`, and for the same reason.
 */

import { readFileSync, writeFileSync } from 'node:fs';

const IN = process.argv[2] ?? 'public/models/track.glb';
const OUT = process.argv[3] ?? 'public/models/track-path.bin';

const SEGMENT_LENGTH = 300;
const SEGMENT_SLOTS = 37;

const file = readFileSync(IN);
const head = new DataView(file.buffer, file.byteOffset, file.byteLength);
const jsonLength = head.getUint32(12, true);
const gltf = JSON.parse(new TextDecoder().decode(file.subarray(20, 20 + jsonLength)));

const parentOf = new Map();
gltf.nodes.forEach((n, i) => (n.children ?? []).forEach((c) => parentOf.set(c, i)));
const rootIndex = gltf.nodes.findIndex((n) => n.name === 'SceneRoot');
if (rootIndex < 0) throw new Error('no SceneRoot: the Y-up conversion node is missing');
const rot = gltf.nodes[rootIndex].rotation;
if (!rot || Math.abs(rot[0] + Math.SQRT1_2) > 1e-4 || Math.abs(rot[3] - Math.SQRT1_2) > 1e-4) {
  throw new Error(`SceneRoot rotation is ${JSON.stringify(rot)}, not the expected -90 degrees about X`);
}

/** Lingo's `integer()`: round to nearest, half away from zero. */
const lingoInteger = (v) => (v < 0 ? -Math.round(-v) : Math.round(v));

/** `MOVIE.ls:263-275`, which is what `PREP` calls for the waypoint's z. */
function lingoCeil(f) {
  const n = lingoInteger(f);
  if (n === f) return n;
  return f > 0 ? lingoInteger(f + 0.5) : lingoInteger(f - 0.5);
}

function segmentOf(y) {
  return Math.max(1, Math.trunc(lingoInteger(y) / SEGMENT_LENGTH) + 1);
}

const byIndex = new Map();
gltf.nodes.forEach((n, i) => {
  const m = /^path_(\d+)$/.exec(n.name ?? '');
  if (!m) return;
  if (parentOf.get(i) !== rootIndex) throw new Error(`${n.name} is not a direct child of SceneRoot`);
  if (n.matrix) throw new Error(`${n.name} carries a matrix; this converter handles TRS only`);
  // The waypoints are markers; a rotation or a scale on one would mean the
  // asset is not what PREP assumed when it read only the position.
  if (n.rotation) throw new Error(`${n.name} carries a rotation, which PREP never reads`);
  if (n.scale && n.scale.some((v) => Math.abs(v - 1) > 1e-6)) {
    throw new Error(`${n.name} carries a scale of ${JSON.stringify(n.scale)}`);
  }

  const index = Number(m[1]);
  if (byIndex.has(index)) throw new Error(`two nodes claim waypoint ${index}`);
  const t = n.translation ?? [0, 0, 0];
  byIndex.set(index, [lingoInteger(t[0]), lingoInteger(t[1]), lingoCeil(t[2])]);
});

const count = byIndex.size;
if (count === 0) throw new Error('no path_ nodes found');

// `pathList` is indexed 1..count with no holes; a gap would make `pNextPathStep`
// read VOID and the rival steer at nothing.
const points = [];
for (let i = 1; i <= count; i++) {
  const p = byIndex.get(i);
  if (!p) throw new Error(`waypoint ${i} is missing: pathList would have a hole at ${i}`);
  points.push(p);
}

// Strict monotonicity in Y is not merely true of this level - `doEnemy` depends
// on it. `tYOffset = rivalY - playerY` is the race-position measure throughout
// the script, and a line that doubled back would make a rival's place flap.
for (let i = 1; i < points.length; i++) {
  if (points[i][1] <= points[i - 1][1]) {
    throw new Error(
      `waypoint ${i + 1} does not advance in Y (${points[i - 1][1]} -> ${points[i][1]}); ` +
        'doEnemy measures race position by Y alone and needs this',
    );
  }
}

for (const [i, p] of points.entries()) {
  const segment = segmentOf(p[1]);
  if (segment < 1 || segment > SEGMENT_SLOTS) {
    throw new Error(`waypoint ${i + 1} falls in segment ${segment}, outside the original's 37 slots`);
  }
}

// --- write ------------------------------------------------------------------
// "SRPT", version, count, slots, then per waypoint 3x int32 (x, y, z) = 12
// bytes. Integers, because that is what `pathList` holds.

const STRIDE = 12;
const out = new Uint8Array(16 + count * STRIDE);
const view = new DataView(out.buffer);
out.set([0x53, 0x52, 0x50, 0x54], 0); // "SRPT"
view.setUint32(4, 1, true);
view.setUint32(8, count, true);
view.setUint32(12, SEGMENT_SLOTS, true);

points.forEach((p, i) => {
  const at = 16 + i * STRIDE;
  view.setInt32(at, p[0], true);
  view.setInt32(at + 4, p[1], true);
  view.setInt32(at + 8, p[2], true);
});

writeFileSync(OUT, out);

const gaps = points.slice(1).map((p, i) => Math.hypot(p[0] - points[i][0], p[1] - points[i][1]));
gaps.sort((a, b) => a - b);
console.log(
  `${OUT}: ${count} waypoints, ${out.length} bytes\n` +
    `  y ${points[0][1]} .. ${points[count - 1][1]}, ` +
    `spacing min ${gaps[0].toFixed(1)} / median ${gaps[gaps.length >> 1].toFixed(1)} / ` +
    `max ${gaps[gaps.length - 1].toFixed(1)}`,
);
