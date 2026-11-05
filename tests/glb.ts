/**
 * A minimal GLB reader, so the model tests can measure the real exported file
 * without a DOM and without a loader. It reads the JSON chunk and, on demand,
 * one accessor out of the binary chunk - enough to check what the renderer
 * depends on.
 */
import { readFileSync } from 'node:fs';

export interface Vec3Like {
  x: number;
  y: number;
  z: number;
}

export interface GlbNode {
  name: string;
  translation: Vec3Like | null;
  scale: Vec3Like | null;
  mesh?: number;
}

/** glTF component types, by their byte width. */
const COMPONENT_BYTES: Record<number, number> = {
  5120: 1,
  5121: 1,
  5122: 2,
  5123: 2,
  5125: 4,
  5126: 4,
};
const COMPONENT_COUNT: Record<string, number> = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 };

export class Glb {
  readonly json: any;
  private readonly bin: DataView;

  constructor(path: string) {
    const bytes = readFileSync(path);
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const jsonLength = view.getUint32(12, true);

    this.json = JSON.parse(new TextDecoder().decode(bytes.subarray(20, 20 + jsonLength)));
    // Chunk 0 is the JSON; chunk 1 is the binary, past its own 8-byte header.
    const binStart = 20 + jsonLength + 8;
    this.bin = new DataView(bytes.buffer, bytes.byteOffset + binStart, bytes.byteLength - binStart);
  }

  node(name: string): GlbNode {
    const raw = this.json.nodes.find((n: any) => n.name === name);
    if (!raw) throw new Error(`no node named ${name} in the model`);
    const vec = (a: number[] | undefined): Vec3Like | null =>
      a ? { x: a[0]!, y: a[1]!, z: a[2]! } : null;
    return { name, translation: vec(raw.translation), scale: vec(raw.scale), mesh: raw.mesh };
  }

  /** The node's mesh bounding box, in the node's own space, from the accessors. */
  bounds(name: string): { min: number[]; max: number[] } {
    const node = this.node(name);
    if (node.mesh === undefined) throw new Error(`${name} has no mesh`);

    let min: number[] | null = null;
    let max: number[] | null = null;
    for (const prim of this.json.meshes[node.mesh].primitives) {
      const accessor = this.json.accessors[prim.attributes.POSITION];
      if (!accessor.min) continue;
      if (!min || !max) {
        min = accessor.min.slice();
        max = accessor.max.slice();
        continue;
      }
      for (let i = 0; i < 3; i++) {
        min[i] = Math.min(min[i]!, accessor.min[i]);
        max[i] = Math.max(max[i]!, accessor.max[i]);
      }
    }
    if (!min || !max) throw new Error(`${name} has no positions`);

    const s = node.scale ?? { x: 1, y: 1, z: 1 };
    const k = [s.x, s.y, s.z];
    return { min: min.map((v, i) => v * k[i]!), max: max.map((v, i) => v * k[i]!) };
  }

  accessor(index: number): number[] {
    const a = this.json.accessors[index];
    const view = this.json.bufferViews[a.bufferView];
    const bytes = COMPONENT_BYTES[a.componentType];
    const parts = COMPONENT_COUNT[a.type];
    if (!bytes || !parts) throw new Error(`accessor ${index} has an unsupported layout`);

    const stride = view.byteStride || bytes * parts;
    const base = (view.byteOffset || 0) + (a.byteOffset || 0);

    const out: number[] = [];
    for (let i = 0; i < a.count; i++) {
      for (let c = 0; c < parts; c++) {
        const at = base + i * stride + c * bytes;
        if (a.componentType === 5126) out.push(this.bin.getFloat32(at, true));
        else if (a.componentType === 5125) out.push(this.bin.getUint32(at, true));
        else if (a.componentType === 5123) out.push(this.bin.getUint16(at, true));
        else out.push(this.bin.getUint8(at));
      }
    }
    return out;
  }

  /** A node's first primitive, as flat positions and indices. */
  geometry(name: string): { positions: number[]; indices: number[] | null } {
    const node = this.node(name);
    if (node.mesh === undefined) throw new Error(`${name} has no mesh`);
    const prim = this.json.meshes[node.mesh].primitives[0];
    return {
      positions: this.accessor(prim.attributes.POSITION),
      indices: prim.indices === undefined ? null : this.accessor(prim.indices),
    };
  }
}
