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
import { isDrawnTrackNode } from './model-frame.js';
import { clearYUpConversion } from './scene-root.js';

export const TRACK_MODEL_URL = 'models/track.glb';

export class TrackView {
  readonly object = new THREE.Group();

  private drawn = 0;
  private hidden = 0;
  private uprighted = false;

  private constructor(scene: THREE.Object3D) {
    this.uprighted = clearYUpConversion(scene);
    this.object.add(scene);

    scene.traverse((node) => {
      const mesh = node as THREE.Mesh;
      if (!mesh.isMesh) return;
      if (isDrawnTrackNode(node.name)) {
        // The road takes shadows and does not cast them: it is the floor, and
        // self-shadowing a 20,000-triangle surface buys nothing.
        mesh.receiveShadow = true;
        mesh.castShadow = false;
        this.drawn++;
      } else {
        mesh.visible = false;
        this.hidden++;
      }
    });
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
