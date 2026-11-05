/**
 * Which nodes of the decoded track world are drawn.
 *
 * Resource 7587 is not only scenery. `PREP` sets `visibility = #none` on the
 * `INV_` colliders, the `FAL_*_TGR` faller triggers and anything named
 * `Finish*`, and the world also carries `carPos_Mach5` and `path_01..path_209`
 * - the rival racing line - which are coordinates, not art. Drawn literally,
 * invisible walls and 209 path markers would all appear.
 *
 * This step draws the road and nothing else. The rest arrives with the props,
 * where each can be checked against `PREP` one at a time.
 */
import { describe, it, expect } from 'vitest';
import { Glb } from './glb.js';
import * as THREE from 'three';
import { isDrawnTrackNode } from '../src/render/model-frame.js';
import { applyTrackVisibility } from '../src/render/track-view.js';

describe('isDrawnTrackNode', () => {
  const glb = new Glb('public/models/track.glb');

  it('draws the 37 segments and nothing else', () => {
    const drawn = glb.json.nodes.filter((n: { name?: string }) => isDrawnTrackNode(n.name ?? ''));
    expect(drawn).toHaveLength(37);
  });

  it('leaves the positioning nodes and the props out', () => {
    for (const name of ['SceneRoot', 'carPos_Mach5', 'path_01', 'path_209', 'Tree_1', 'INV_1', 'WALL_1', 'pickup_Wrench01']) {
      expect(isDrawnTrackNode(name), name).toBe(false);
    }
  });

  it('accepts every segment name the file actually uses', () => {
    // SEG_1 through SEG_37, unpadded; the file lists them out of order.
    for (let s = 1; s <= 37; s++) expect(isDrawnTrackNode(`SEG_${s}`)).toBe(true);
  });

  it('does not accept a name that merely starts with SEG_', () => {
    expect(isDrawnTrackNode('SEG_1_extra')).toBe(false);
    expect(isDrawnTrackNode('SEG_')).toBe(false);
  });
});

/**
 * The rule has to be applied to the nodes, not to the meshes under them.
 *
 * A glTF node with several primitives does not become a Mesh in three.js: it
 * becomes a Group named after the node, holding one Mesh per primitive named
 * `<node>_0`, `<node>_1` and so on. Every segment has 16 primitives, so every
 * drawable mesh in the track world is named `SEG_1_0` and friends - none of
 * which the rule admits.
 *
 * Testing the rule against the names in the GLB's JSON passed while the road
 * did not render at all. This builds the shape the loader actually hands over.
 */
describe('applyTrackVisibility', () => {
  function loaderShapedScene(): THREE.Object3D {
    const root = new THREE.Group();
    root.name = 'SceneRoot';
    for (const name of ['SEG_1', 'SEG_2']) {
      const node = new THREE.Group();
      node.name = name;
      for (let p = 0; p < 16; p++) {
        const mesh = new THREE.Mesh(new THREE.BufferGeometry());
        mesh.name = `${name}_${p}`;
        node.add(mesh);
      }
      root.add(node);
    }
    for (const name of ['Tree_1', 'INV_1', 'carPos_Mach5', 'path_01']) {
      const node = new THREE.Mesh(new THREE.BufferGeometry());
      node.name = name;
      root.add(node);
    }
    return root;
  }

  it('shows every mesh under a segment node', () => {
    const root = loaderShapedScene();
    applyTrackVisibility(root);
    const seg = root.getObjectByName('SEG_1')!;
    expect(seg.visible).toBe(true);
    for (const child of seg.children) expect(child.visible, child.name).toBe(true);
  });

  it('hides the props and the positioning nodes', () => {
    const root = loaderShapedScene();
    applyTrackVisibility(root);
    for (const name of ['Tree_1', 'INV_1', 'carPos_Mach5', 'path_01']) {
      expect(root.getObjectByName(name)!.visible, name).toBe(false);
    }
  });

  it('counts what it drew and what it hid', () => {
    expect(applyTrackVisibility(loaderShapedScene())).toEqual({ drawn: 2, hidden: 4 });
  });
});
