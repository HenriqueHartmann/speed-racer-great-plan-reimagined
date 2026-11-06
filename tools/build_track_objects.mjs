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
 * HALF-EXTENTS come from each node's own mesh bounds with its scale applied -
 * every pickup carries one, and all 355 trees do. They are measured, not
 * chosen: the original's collision volume was a Director `#sphere` whose
 * radius it derived from the bounding sphere, and that rule is not in this
 * artifact, so a measured box is the honest stand-in.
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
  objects.push({ name: n.name, kind: match[1], segment, t, r, half: halfExtent(n) });
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
