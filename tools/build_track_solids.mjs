/**
 * The level's solid barriers, reduced to what the simulation can read.
 *
 * Input:  public/models/track.glb
 * Output: public/models/track-solids.bin
 *
 * `WALL_`, `INV_` and `RAIL_` are not objects with a position and a size.
 * Each is one arbitrary mesh spanning a whole segment - `WALL_8` is 659
 * vertices across 154 x 300 x 65 - so an axis-aligned box around one would be
 * a solid block filling the segment. They take the trimesh path the road uses.
 *
 * `MISC_` is deliberately absent. `PREP`'s dispatcher is an ordered chain and
 * no branch matches "MIS": the 23 models fall off the end and receive no rigid
 * body, no collision modifier and no array. They are scenery, and making them
 * solid would wall the player in with 4,143 triangles of grandstand.
 *
 * SEGMENT ASSIGNMENT. By position, `(integer(y) / 300) + 1`, which is what
 * `PREP:272` does for everything that is not the road. Never by the name's
 * numeric suffix: it agrees almost always and `MISC_08` - zero-padded, sitting
 * in segment 37 - proves the relationship does not hold. The suffix is an
 * opaque id.
 *
 * COORDINATE FRAME. Asserted, not assumed, exactly as build_track_ground.mjs
 * does: `SceneRoot` carries the -90 degree X rotation that converts Director's
 * Z-up to glTF's Y-up, and must not be applied. Unlike the road's segments,
 * props may carry a scale, so scale is baked - and a negative scale flips
 * triangle winding, which is corrected rather than shipped inside out.
 */

import { readFileSync, writeFileSync } from 'node:fs';

const IN = process.argv[2] ?? 'public/models/track.glb';
const OUT = process.argv[3] ?? 'public/models/track-solids.bin';

const SEGMENT_LENGTH = 300;
const SEGMENT_SLOTS = 37;

/** 1 = wall (drawn), 2 = invisible fence, 3 = rail (drawn, double-sided). */
const BARRIER = [
  [/^WALL_/, 1],
  [/^INV_/, 2],
  [/^RAIL_/, 3],
];

const COMPONENT_BYTES = { 5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4 };
const COMPONENT_COUNT = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 };

const file = readFileSync(IN);
const head = new DataView(file.buffer, file.byteOffset, file.byteLength);
const jsonLength = head.getUint32(12, true);
const gltf = JSON.parse(new TextDecoder().decode(file.subarray(20, 20 + jsonLength)));
const binStart = 20 + jsonLength + 8;
const bin = new DataView(file.buffer, file.byteOffset + binStart, file.byteLength - binStart);

function accessor(index) {
  const a = gltf.accessors[index];
  const view = gltf.bufferViews[a.bufferView];
  const bytes = COMPONENT_BYTES[a.componentType];
  const parts = COMPONENT_COUNT[a.type];
  const stride = view.byteStride || bytes * parts;
  const base = (view.byteOffset || 0) + (a.byteOffset || 0);
  const out = new Array(a.count * parts);
  for (let i = 0; i < a.count; i++) {
    for (let c = 0; c < parts; c++) {
      const at = base + i * stride + c * bytes;
      out[i * parts + c] =
        a.componentType === 5126 ? bin.getFloat32(at, true)
        : a.componentType === 5125 ? bin.getUint32(at, true)
        : a.componentType === 5123 ? bin.getUint16(at, true)
        : bin.getUint8(at);
    }
  }
  return out;
}

/** `(integer(y) / 300) + 1`, with Lingo's rounding integer(). */
function segmentOf(y) {
  const rounded = y < 0 ? -Math.round(-y) : Math.round(y);
  return Math.max(1, Math.trunc(rounded / SEGMENT_LENGTH) + 1);
}

// --- verify the frame -------------------------------------------------------

const parentOf = new Map();
gltf.nodes.forEach((n, i) => (n.children ?? []).forEach((c) => parentOf.set(c, i)));

const rootIndex = gltf.nodes.findIndex((n) => n.name === 'SceneRoot');
if (rootIndex < 0) throw new Error('no SceneRoot: the Y-up conversion node is missing');
const rot = gltf.nodes[rootIndex].rotation;
if (!rot || Math.abs(rot[0] + Math.SQRT1_2) > 1e-4 || Math.abs(rot[3] - Math.SQRT1_2) > 1e-4) {
  throw new Error(`SceneRoot rotation is ${JSON.stringify(rot)}, not the expected -90 degrees about X`);
}

const barriers = [];
gltf.nodes.forEach((n, i) => {
  const kind = BARRIER.find(([re]) => re.test(n.name ?? ''));
  if (!kind) return;
  if (parentOf.get(i) !== rootIndex) throw new Error(`${n.name} is not a direct child of SceneRoot`);
  if (n.matrix) throw new Error(`${n.name} carries a matrix; this converter handles TRS only`);
  if (n.mesh === undefined) throw new Error(`${n.name} has no mesh`);
  barriers.push({ node: n, surface: kind[1], segment: segmentOf((n.translation ?? [0, 0, 0])[1]) });
});

if (barriers.length === 0) throw new Error('no WALL_, INV_ or RAIL_ nodes found');
for (const b of barriers) {
  if (b.segment < 1 || b.segment > SEGMENT_SLOTS) {
    throw new Error(`${b.node.name} falls in segment ${b.segment}, outside the original's 37 slots`);
  }
}

// --- collect, grouped by segment -------------------------------------------

const positions = [];
const indices = [];
const surfaceIds = [];
const segmentStart = new Uint32Array(SEGMENT_SLOTS);
const segmentEnd = new Uint32Array(SEGMENT_SLOTS);

let flipped = 0;
for (let s = 1; s <= SEGMENT_SLOTS; s++) {
  segmentStart[s - 1] = indices.length / 3;

  for (const { node, surface } of barriers.filter((b) => b.segment === s)) {
    const [tx, ty, tz] = node.translation ?? [0, 0, 0];
    const [sx, sy, sz] = node.scale ?? [1, 1, 1];
    if (node.rotation) throw new Error(`${node.name} carries a rotation; not handled`);
    // A negative scale mirrors the mesh, which reverses triangle winding. Swap
    // two corners back so the normals still point out of the barrier.
    //
    // No barrier in this level is mirrored - the counter below reports zero -
    // so this branch is unexercised today. It is here because WATER_34 does
    // carry a negative X scale and will come through a sibling of this file,
    // and because a silently inside-out collider is the kind of thing that
    // surfaces as a car falling through a wall an hour later.
    const mirrored = sx * sy * sz < 0;
    if (mirrored) flipped++;

    for (const prim of gltf.meshes[node.mesh].primitives) {
      if (prim.indices === undefined) throw new Error(`${node.name} has a non-indexed primitive`);
      if (prim.mode !== undefined && prim.mode !== 4) {
        throw new Error(`${node.name} is primitive mode ${prim.mode}, not triangles`);
      }
      const pos = accessor(prim.attributes.POSITION);
      const idx = accessor(prim.indices);
      const base = positions.length / 3;

      for (let v = 0; v < pos.length; v += 3) {
        positions.push(pos[v] * sx + tx, pos[v + 1] * sy + ty, pos[v + 2] * sz + tz);
      }
      for (let k = 0; k + 2 < idx.length; k += 3) {
        const [a, b, c] = [idx[k], idx[k + 1], idx[k + 2]];
        indices.push(base + a, base + (mirrored ? c : b), base + (mirrored ? b : c));
        surfaceIds.push(surface);
      }
    }
  }

  segmentEnd[s - 1] = indices.length / 3;
}

// --- write ------------------------------------------------------------------

const vertexCount = positions.length / 3;
const triangleCount = surfaceIds.length;
const idsPadded = Math.ceil(triangleCount / 4) * 4;
const out = new Uint8Array(
  32 + vertexCount * 12 + triangleCount * 12 + idsPadded + SEGMENT_SLOTS * 8,
);
const view = new DataView(out.buffer);

out.set([0x53, 0x52, 0x54, 0x50], 0); // "SRTP"
view.setUint32(4, 1, true);
view.setUint32(8, SEGMENT_SLOTS, true);
view.setUint32(12, triangleCount, true);
view.setUint32(16, vertexCount, true);
// The spawn slot the ground file uses is unused here; zeroed rather than omitted
// so both files share one header shape and one parser.
view.setFloat32(20, 0, true);
view.setFloat32(24, 0, true);
view.setFloat32(28, 0, true);

let at = 32;
new Float32Array(out.buffer, at, positions.length).set(positions);
at += vertexCount * 12;
new Uint32Array(out.buffer, at, indices.length).set(indices);
at += triangleCount * 12;
new Uint8Array(out.buffer, at, triangleCount).set(surfaceIds);
at += idsPadded;
new Uint32Array(out.buffer, at, SEGMENT_SLOTS).set(segmentStart);
at += SEGMENT_SLOTS * 4;
new Uint32Array(out.buffer, at, SEGMENT_SLOTS).set(segmentEnd);

writeFileSync(OUT, out);
const empty = [...segmentStart].filter((v, i) => v === segmentEnd[i]).length;
console.log(
  `   ${OUT}  ${out.byteLength} bytes  ${barriers.length} barriers, ${triangleCount} triangles, ` +
  `${empty} empty segments${flipped ? `, ${flipped} mirrored` : ''}`,
);
