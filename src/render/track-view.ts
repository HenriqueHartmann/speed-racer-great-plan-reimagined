/**
 * The original track, drawn.
 *
 * `public/models/track.glb` is the whole decoded world - 760 meshes - and only
 * the 37 road segments are drawn here. The rest is scenery, props, invisible
 * colliders and positioning nodes, and it arrives in its own step where each
 * can be checked against `PREP`'s visibility pass. See `isDrawnTrackNode`.
 *
 * The geometry the car actually drives on is not this: the simulation reads
 * `track-ground.bin`, built from the same meshes by `tools/build_track_ground.mjs`.
 * This is the picture of it.
 */

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { trackNodeRole } from './model-frame.js';
import { clearYUpConversion } from './scene-root.js';

export const TRACK_MODEL_URL = 'models/track.glb';

/**
 * Show the road and hide everything else, deciding it at the node.
 *
 * It has to be the node, not the mesh. A glTF node with several primitives
 * becomes a `Group` named after the node holding one `Mesh` per primitive,
 * named `<node>_0` and so on - and every segment has 16 primitives, so not one
 * drawable mesh in this world is named `SEG_<n>`. Deciding per mesh hides the
 * entire road while every name in the file still looks right.
 *
 * The segments are direct children of `SceneRoot`, which the converter also
 * asserts, so one pass over those children is the whole job.
 */
export function applyTrackVisibility(scene: THREE.Object3D): { drawn: number; hidden: number } {
  const root = scene.getObjectByName('SceneRoot') ?? scene;
  let drawn = 0;
  let hidden = 0;

  for (const node of root.children) {
    if (trackNodeRole(node.name) === 'drawn') {
      node.visible = true;
      node.traverse((child) => {
        const mesh = child as THREE.Mesh;
        if (!mesh.isMesh) return;
        mesh.visible = true;
        // The road takes shadows and does not cast them: it is the floor, and
        // self-shadowing 20,000 triangles buys nothing.
        mesh.receiveShadow = true;
        mesh.castShadow = false;
      });
      drawn++;
    } else {
      node.visible = false;
      hidden++;
    }
  }

  return { drawn, hidden };
}

export class TrackView {
  readonly object = new THREE.Group();

  private drawn = 0;
  private hidden = 0;
  private uprighted = false;

  private constructor(scene: THREE.Object3D) {
    this.uprighted = clearYUpConversion(scene);
    this.object.add(scene);
    const { drawn, hidden } = applyTrackVisibility(scene);
    this.drawn = drawn;
    this.hidden = hidden;
  }

  static async load(url = TRACK_MODEL_URL): Promise<TrackView> {
    const gltf = await new GLTFLoader().loadAsync(url);
    return new TrackView(gltf.scene);
  }

  /** What was drawn and what was not, so a silent mismatch cannot pass. */
  report(): { drawn: number; hidden: number; uprighted: boolean } {
    return { drawn: this.drawn, hidden: this.hidden, uprighted: this.uprighted };
  }
}
