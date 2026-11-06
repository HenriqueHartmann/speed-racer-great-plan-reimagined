/**
 * The original track, drawn.
 *
 * `public/models/track.glb` is the whole decoded world - 760 meshes - and
 * `trackNodeRole` decides which of them are seen. Most are: the road, the
 * walls, the rail, the scenery, the trees, the pickups, the water and the sky.
 * What stays hidden is what `PREP` hides or never draws - the `INV_` fences,
 * which are solid and unseen - and the nodes that are coordinates rather than
 * art: `carPos_Mach5` and the 209 `path_` waypoints of the rival racing line.
 *
 * The geometry the car actually drives on is not this: the simulation reads
 * `track-ground.bin`, built from the same meshes by `tools/build_track_ground.mjs`.
 * This is the picture of it.
 */

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { isSkyNode, isTrackObjectNode, isWaterNode, trackNodeRole } from './model-frame.js';
import { stepWater, waterOffset } from './gadget-animation.js';
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
  /** `cDirection`: the water's shared phase, 8 degrees a frame (`PLAY.ls:52`). */
  private waterPhase = 0;
  private readonly water: { node: THREE.Object3D; restX: number }[] = [];
  private sky: THREE.Object3D | null = null;
  private hidden = 0;
  private uprighted = false;

  private constructor(scene: THREE.Object3D) {
    this.uprighted = clearYUpConversion(scene);
    this.object.add(scene);
    const { drawn, hidden } = applyTrackVisibility(scene);
    this.drawn = drawn;
    this.hidden = hidden;

    const root = scene.getObjectByName('SceneRoot') ?? scene;
    for (const node of root.children) {
      if (isWaterNode(node.name)) this.water.push({ node, restX: node.position.x });
      if (isSkyNode(node.name)) this.sky = node;
    }
  }

  /**
   * Advance the scenery that moves.
   *
   * The water planes slide along X by `sin(cDirection)` while the phase
   * advances 8 degrees a frame (`PLAY.ls:48-55`) - one unit either way, a
   * 45-frame cycle, shared by all nine. They carry no physics: `PREP:315`
   * gives them no rigid body, no collision modifier and no segment array, so
   * being in water comes from the road's own surface id, not from these.
   *
   * The skydome follows the camera (`doCamera:56`) so it never recedes.
   */
  update(cameraPosition: { x: number; y: number; z: number }): void {
    this.waterPhase = stepWater(this.waterPhase);
    const slosh = waterOffset(this.waterPhase);
    for (const { node, restX } of this.water) node.position.x = restX + slosh;
    this.sky?.position.set(cameraPosition.x, cameraPosition.y, cameraPosition.z);
  }

  static async load(url = TRACK_MODEL_URL): Promise<TrackView> {
    const gltf = await new GLTFLoader().loadAsync(url);
    return new TrackView(gltf.scene);
  }

  /**
   * The level's object nodes, keyed by the order the extractor sorted them.
   *
   * `tools/build_track_objects.mjs` sorts by segment then by name, and the
   * simulation files them in that order, so a prop's position in the track
   * matches a node here. Matching by name would be better and needs the name
   * carried through the binary; this is the cheaper link and the test below
   * pins that the two orders agree.
   */
  objectNodes(): THREE.Object3D[] {
    const root = this.object.getObjectByName('SceneRoot') ?? this.object;
    return root.children
      .filter((n) => isTrackObjectNode(n.name))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  /** What was drawn and what was not, so a silent mismatch cannot pass. */
  report(): { drawn: number; hidden: number; uprighted: boolean } {
    return { drawn: this.drawn, hidden: this.hidden, uprighted: this.uprighted };
  }
}
