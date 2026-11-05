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
import { isDrawnTrackNode } from '../src/render/model-frame.js';

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
