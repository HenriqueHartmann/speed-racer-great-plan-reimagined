/**
 * Turn the decoded track world into the ground data the simulation reads.
 *
 * Input:  public/models/track.glb, as macromelt writes it.
 * Output: public/models/track-ground.bin - only the 37 SEG_ meshes, as flat
 *         typed arrays, in the simulation's own Z-up frame.
 *
 * The simulation must never need a glTF loader, and `src/sim/` must stay free
 * of the DOM. That is the whole reason this file exists rather than the
 * renderer handing its geometry across.
 *
 * COORDINATE FRAME. Two earlier orientation bugs in this project came from
 * reasoning about conventions instead of reading the file, so every assumption
 * here is asserted rather than trusted:
 *
 *   - `SceneRoot` carries a -90 degree X rotation. That is the exporter
 *     converting Director's Z-up data to the Y-up glTF requires. Our scene is
 *     Z-up, so node-local space under SceneRoot already IS the simulation's
 *     frame and the rotation must NOT be applied.
 *   - Every SEG_ node is a direct child of SceneRoot and carries a translation
 *     and nothing else. So baking the translation is the whole conversion.
 *
 * If any of that stops being true the script fails loudly instead of writing
 * silently wrong geometry.
 */

import { readFileSync, writeFileSync } from 'node:fs';

const IN = process.argv[2] ?? 'public/models/track.glb';
const OUT = process.argv[3] ?? 'public/models/track-ground.bin';

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

// --- verify the frame, do not assume it ------------------------------------

const parentOf = new Map();
gltf.nodes.forEach((n, i) => (n.children ?? []).forEach((c) => parentOf.set(c, i)));

const rootIndex = gltf.nodes.findIndex((n) => n.name === 'SceneRoot');
if (rootIndex < 0) throw new Error('no SceneRoot: the Y-up conversion node is missing');
const rot = gltf.nodes[rootIndex].rotation;
if (!rot || Math.abs(rot[0] + Math.SQRT1_2) > 1e-4 || Math.abs(rot[3] - Math.SQRT1_2) > 1e-4) {
  throw new Error(`SceneRoot rotation is ${JSON.stringify(rot)}, not the expected -90 degrees about X`);
}

const segs = gltf.nodes
  .map((n, i) => ({ n, i }))
  .filter(({ n }) => /^SEG_\d+$/.test(n.name ?? ''))
  .sort((a, b) => Number(a.n.name.slice(4)) - Number(b.n.name.slice(4)));

if (segs.length === 0) throw new Error('no SEG_ nodes found');
segs.forEach(({ n, i }, k) => {
  if (Number(n.name.slice(4)) !== k + 1) throw new Error(`segments are not 1..N: found ${n.name} at ${k + 1}`);
  if (parentOf.get(i) !== rootIndex) throw new Error(`${n.name} is not a direct child of SceneRoot`);
  if (n.rotation || n.scale || n.matrix) throw new Error(`${n.name} carries more than a translation`);
});

const spawnNode = gltf.nodes.find((n) => n.name === 'carPos_Mach5');
if (!spawnNode) throw new Error('no carPos_Mach5: the start line is missing');
if (spawnNode.rotation || spawnNode.scale) throw new Error('carPos_Mach5 carries more than a translation');
if (parentOf.get(gltf.nodes.indexOf(spawnNode)) !== rootIndex) {
  throw new Error('carPos_Mach5 is not a direct child of SceneRoot');
}

// --- verify the sub-mesh identity, because the surface table rests on it -----
//
// `surfaceIds` below is the primitive's position in its mesh, and the whole
// recovered surface table assumes that position means the same material in
// every segment. That is measured, not given: all 37 segments carry exactly 16
// primitives and primitive N holds the same material in all of them.
//
// Nothing downstream can notice if a future decode breaks it - a segment with
// 15 primitives would shift every id after the gap and silently turn ice into
// snow - so it is checked here, where it can still be shouted about.

const materialsByPosition = segs[0].n.mesh === undefined
  ? []
  : gltf.meshes[segs[0].n.mesh].primitives.map((p) =>
      p.material === undefined ? '(none)' : (gltf.materials[p.material].name ?? '(unnamed)'),
    );

for (const { n } of segs) {
  const prims = gltf.meshes[n.mesh].primitives;
  if (prims.length !== materialsByPosition.length) {
    throw new Error(
      `${n.name} has ${prims.length} sub-meshes, not ${materialsByPosition.length}: the sub-mesh index cannot be a surface id`,
    );
  }
  prims.forEach((p, i) => {
    const name = p.material === undefined ? '(none)' : (gltf.materials[p.material].name ?? '(unnamed)');
    if (name !== materialsByPosition[i]) {
      throw new Error(
        `${n.name} sub-mesh ${i + 1} is ${name}, but it is ${materialsByPosition[i]} elsewhere: the surface ids are not stable`,
      );
    }
    if (p.mode !== undefined && p.mode !== 4) {
      throw new Error(`${n.name} sub-mesh ${i + 1} is primitive mode ${p.mode}, not triangles`);
    }
  });
}

// --- collect the triangles --------------------------------------------------

const positions = [];
const indices = [];
const surfaceIds = [];
const segmentStart = [];
const segmentEnd = [];

for (const { n } of segs) {
  segmentStart.push(indices.length / 3);
  const [tx, ty, tz] = n.translation ?? [0, 0, 0];

  gltf.meshes[n.mesh].primitives.forEach((prim, p) => {
    const pos = accessor(prim.attributes.POSITION);
    if (prim.indices === undefined) {
      throw new Error(`${n.name} has a non-indexed primitive; this converter does not handle one`);
    }
    const idx = accessor(prim.indices);
    const base = positions.length / 3;

    for (let v = 0; v < pos.length; v += 3) {
      positions.push(pos[v] + tx, pos[v + 1] + ty, pos[v + 2] + tz);
    }
    for (let k = 0; k + 2 < idx.length; k += 3) {
      indices.push(base + idx[k], base + idx[k + 1], base + idx[k + 2]);
      // 1-based, so it matches the index the original used as its effectID.
      surfaceIds.push(p + 1);
    }
  });

  segmentEnd.push(indices.length / 3);
}

// --- write ------------------------------------------------------------------

const vertexCount = positions.length / 3;
const triangleCount = surfaceIds.length;
const idsPadded = Math.ceil(triangleCount / 4) * 4;
const out = new Uint8Array(32 + vertexCount * 12 + triangleCount * 12 + idsPadded + segs.length * 8);
const view = new DataView(out.buffer);

out.set([0x53, 0x52, 0x54, 0x47], 0); // "SRTG"
view.setUint32(4, 1, true);
view.setUint32(8, segs.length, true);
view.setUint32(12, triangleCount, true);
view.setUint32(16, vertexCount, true);
const [sx, sy, sz] = spawnNode.translation ?? [0, 0, 0];
view.setFloat32(20, sx, true);
view.setFloat32(24, sy, true);
view.setFloat32(28, sz, true);

let at = 32;
new Float32Array(out.buffer, at, positions.length).set(positions);
at += vertexCount * 12;
new Uint32Array(out.buffer, at, indices.length).set(indices);
at += triangleCount * 12;
new Uint8Array(out.buffer, at, triangleCount).set(surfaceIds);
at += idsPadded;
new Uint32Array(out.buffer, at, segs.length).set(segmentStart);
at += segs.length * 4;
new Uint32Array(out.buffer, at, segs.length).set(segmentEnd);

writeFileSync(OUT, out);
console.log(
  `   ${OUT}  ${out.byteLength} bytes  ${segs.length} segments, ${triangleCount} triangles, ${vertexCount} vertices`,
);
