/**
 * The level's individual objects: 355 trees and 77 pickups.
 *
 * Input:  public/models/track.glb
 * Output: public/models/track-objects.bin
 *
 * Unlike the barriers, these really are objects with a place and a size, so
 * they go through the simulation's `Prop` model rather than a trimesh. What
 * this writes is their position, their measured half-extent, their kind, and
 * the segment they belong to.
 *
 * SEGMENT ASSIGNMENT, as `PREP:272` does it for everything that is not the
 * road: `(integer(y) / 300) + 1`, from the position. Never from the name's
 * numeric suffix - `Tree_*` ids run 1..388 with gaps for 355 nodes, and
 * `MISC_08` proves elsewhere that a suffix is an opaque id.
 *
 * HALF-EXTENTS come from each node's own mesh bounds with its scale applied.
 * They are measured, not chosen: the original's collision volume was a
 * Director `#sphere` whose radius it derived from the bounding sphere, and
 * that rule is not in this artifact, so a measured box is the honest stand-in.
 *
 * A TREE IS MEASURED AT ITS TRUNK, not over its canopy, and that is a
 * SUBSTITUTE. The whole-mesh bounds of `Tree_01` are 2.009 by 2.096, which is
 * the foliage eight metres overhead; its trunk is 0.192 by 0.221. Boxing the
 * canopy stops the car two metres from a tree it is nowhere near touching,
 * which play reported with a picture of exactly that.
 *
 * The cut is the bottom fifth of the tree's own height, and it is not a round
 * number picked for the look of it. Sampling `Tree_01` at the bottom 5, 8,
 * 10, 12, 15 and 20 per cent all give the same 0.192 by 0.221; at 25 per cent
 * it jumps to 1.071 by 0.701 and at 30 to 1.878 by 2.096. The trunk is flat
 * across that whole range and the canopy begins abruptly after it, so any cut
 * inside it gives the same answer.
 *
 * What stays UNRESOLVED is the original's own solid shape: `PREP:361` builds
 * the tree's body with `makeFixedRigidBody(name, 1)` and the second argument
 * has no decompiled signature anywhere in the artifact.
 *
 * ROTATION is carried for the 68 trees that have one.
 */

import { readFileSync, writeFileSync } from 'node:fs';

const IN = process.argv[2] ?? 'public/models/track.glb';
const OUT = process.argv[3] ?? 'public/models/track-objects.bin';

const SEGMENT_LENGTH = 300;
const SEGMENT_SLOTS = 37;

/** Kind codes. 1 = tree; 2..6 are the five pickups, in `PREP`'s test order. */
const KINDS = [
  [/^Tree_\d+$/, 1, 'tree'],
  [/^pickup_Wrench\d+$/, 2, 'wrench'],
  [/^pickup_CandyPurple\d+$/, 3, 'candyPurple'],
  [/^pickup_CandyRed\d+$/, 4, 'candyRed'],
  [/^pickup_Oxegen\d+$/, 5, 'oxygen'],
  [/^pickup_Robot\d+$/, 6, 'robot'],
];

const file = readFileSync(IN);
const head = new DataView(file.buffer, file.byteOffset, file.byteLength);
const jsonLength = head.getUint32(12, true);
const gltf = JSON.parse(new TextDecoder().decode(file.subarray(20, 20 + jsonLength)));
// The binary chunk, past the JSON chunk and its own 8-byte header.
const binStart = 20 + jsonLength + 8;
const bin = new DataView(file.buffer, file.byteOffset + binStart, file.byteLength - binStart);

const parentOf = new Map();
gltf.nodes.forEach((n, i) => (n.children ?? []).forEach((c) => parentOf.set(c, i)));
const rootIndex = gltf.nodes.findIndex((n) => n.name === 'SceneRoot');
if (rootIndex < 0) throw new Error('no SceneRoot: the Y-up conversion node is missing');
const rot = gltf.nodes[rootIndex].rotation;
if (!rot || Math.abs(rot[0] + Math.SQRT1_2) > 1e-4 || Math.abs(rot[3] - Math.SQRT1_2) > 1e-4) {
  throw new Error(`SceneRoot rotation is ${JSON.stringify(rot)}, not the expected -90 degrees about X`);
}

function segmentOf(y) {
  const rounded = y < 0 ? -Math.round(-y) : Math.round(y);
  return Math.max(1, Math.trunc(rounded / SEGMENT_LENGTH) + 1);
}

/** The fraction of a tree's height that is trunk rather than canopy. */
const TRUNK_FRACTION = 0.2;

/** Mesh bounds from the accessors' own min/max, with the node's scale applied. */
function halfExtent(node) {
  let min = null;
  let max = null;
  for (const prim of gltf.meshes[node.mesh].primitives) {
    const a = gltf.accessors[prim.attributes.POSITION];
    if (!a.min) continue;
    if (!min) {
      min = a.min.slice();
      max = a.max.slice();
      continue;
    }
    for (let i = 0; i < 3; i++) {
      min[i] = Math.min(min[i], a.min[i]);
      max[i] = Math.max(max[i], a.max[i]);
    }
  }
  if (!min) throw new Error(`${node.name} has no positions`);
  const s = node.scale ?? [1, 1, 1];
  return [0, 1, 2].map((i) => ((max[i] - min[i]) / 2) * Math.abs(s[i]));
}

/** Read a node's vertex positions, scale applied, as flat xyz triples. */
function positionsOf(node) {
  const out = [];
  const s = node.scale ?? [1, 1, 1];
  for (const prim of gltf.meshes[node.mesh].primitives) {
    const a = gltf.accessors[prim.attributes.POSITION];
    const v = gltf.bufferViews[a.bufferView];
    const stride = v.byteStride || 12;
    const base = (v.byteOffset || 0) + (a.byteOffset || 0);
    for (let i = 0; i < a.count; i++) {
      for (let c = 0; c < 3; c++) {
        out.push(bin.getFloat32(base + i * stride + c * 4, true) * s[c]);
      }
    }
  }
  return out;
}

/**
 * A tree's horizontal half-extents taken at its TRUNK, with its full height.
 *
 * See the note at the top of this file: the canopy is ten times the trunk's
 * width and boxing it walls off ground the car is nowhere near. The vertical
 * half-extent stays the whole tree, so the column cannot be driven over.
 */
function trunkHalfExtent(node) {
  const p = positionsOf(node);
  let zMin = Infinity;
  let zMax = -Infinity;
  for (let i = 2; i < p.length; i += 3) {
    zMin = Math.min(zMin, p[i]);
    zMax = Math.max(zMax, p[i]);
  }
  const cut = zMin + (zMax - zMin) * TRUNK_FRACTION;

  let xMin = Infinity, xMax = -Infinity, yMin = Infinity, yMax = -Infinity, seen = 0;
  for (let i = 0; i < p.length; i += 3) {
    if (p[i + 2] > cut) continue;
    seen++;
    xMin = Math.min(xMin, p[i]);
    xMax = Math.max(xMax, p[i]);
    yMin = Math.min(yMin, p[i + 1]);
    yMax = Math.max(yMax, p[i + 1]);
  }
  if (seen < 3) throw new Error(`${node.name} has no vertices below its trunk line`);
  return [(xMax - xMin) / 2, (yMax - yMin) / 2, (zMax - zMin) / 2];
}

const objects = [];
gltf.nodes.forEach((n, i) => {
  const match = KINDS.find(([re]) => re.test(n.name ?? ''));
  if (!match) return;
  if (parentOf.get(i) !== rootIndex) throw new Error(`${n.name} is not a direct child of SceneRoot`);
  if (n.matrix) throw new Error(`${n.name} carries a matrix; this converter handles TRS only`);
  if (n.mesh === undefined) throw new Error(`${n.name} has no mesh`);

  const t = n.translation ?? [0, 0, 0];
  const r = n.rotation ?? [0, 0, 0, 1];
  const segment = segmentOf(t[1]);
  if (segment < 1 || segment > SEGMENT_SLOTS) {
    throw new Error(`${n.name} falls in segment ${segment}, outside the original's 37 slots`);
  }
  const half = match[1] === 1 ? trunkHalfExtent(n) : halfExtent(n);
  objects.push({ name: n.name, kind: match[1], segment, t, r, half });
});

if (objects.length === 0) throw new Error('no Tree_ or pickup_ nodes found');

const counts = {};
for (const o of objects) counts[KINDS.find(([, c]) => c === o.kind)[2]] = (counts[KINDS.find(([, c]) => c === o.kind)[2]] ?? 0) + 1;

// Sorted by name, and only by name. The renderer sorts the same nodes the
// same way, so object i in this file is object i on screen - that is the only
// link between a `Prop` and the mesh it is drawn as, and
// `tests/track-objects-data.test.ts` pins that the two orders agree.
objects.sort((a, b) => a.name.localeCompare(b.name));

// --- write ------------------------------------------------------------------
// "SROB", version, count, slots, then per object:
//   uint8 kind, uint8 segment, 2 bytes padding, 3x f32 position,
//   4x f32 rotation (xyzw), 3x f32 half-extent  = 44 bytes.

const STRIDE = 44;
const out = new Uint8Array(16 + objects.length * STRIDE);
const view = new DataView(out.buffer);
out.set([0x53, 0x52, 0x4f, 0x42], 0); // "SROB"
view.setUint32(4, 1, true);
view.setUint32(8, objects.length, true);
view.setUint32(12, SEGMENT_SLOTS, true);

objects.forEach((o, i) => {
  let at = 16 + i * STRIDE;
  view.setUint8(at, o.kind);
  view.setUint8(at + 1, o.segment);
  at += 4;
  for (const v of o.t) { view.setFloat32(at, v, true); at += 4; }
  for (const v of o.r) { view.setFloat32(at, v, true); at += 4; }
  for (const v of o.half) { view.setFloat32(at, v, true); at += 4; }
});

writeFileSync(OUT, out);
const rotated = objects.filter((o) => o.r.some((v, i) => v !== [0, 0, 0, 1][i])).length;
console.log(
  `   ${OUT}  ${out.byteLength} bytes  ${objects.length} objects ` +
  `(${Object.entries(counts).map(([k, v]) => `${v} ${k}`).join(', ')}), ${rotated} rotated`,
);
