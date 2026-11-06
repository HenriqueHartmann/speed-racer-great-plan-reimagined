/**
 * The level's trees and pickups, as the simulation reads them.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { parseTrackObjects, populateTrack } from '../src/sim/track-objects.js';
import { flatGroundMesh } from '../src/sim/ground-mesh.js';
import { Track, segmentIndexFor } from '../src/sim/track.js';
import * as K from '../src/sim/constants.js';
import { Glb } from './glb.js';
import { isTrackObjectNode } from '../src/render/model-frame.js';

const FILE = 'public/models/track-objects.bin';

describe('the decoded objects', () => {
  const objects = parseTrackObjects(readFileSync(FILE));

  it('carries all 355 trees and all 77 pickups', () => {
    // 77, not the 68 the asset catalogue claimed: 37 red candy, 13 purple,
    // 10 robot, 9 oxygen, 8 wrench. 68 is the number of *rotated trees*.
    expect(objects).toHaveLength(432);
    expect(objects.filter((o) => o.kind === 'tree')).toHaveLength(355);
    expect(objects.filter((o) => o.kind === 'pickup')).toHaveLength(77);
  });

  it('carries each pickup kind in the number the level has', () => {
    const count = (p: string) => objects.filter((o) => o.pickup === p).length;
    expect(count('candyRed')).toBe(37);
    expect(count('candyPurple')).toBe(13);
    expect(count('robot')).toBe(10);
    expect(count('oxygen')).toBe(9);
    expect(count('wrench')).toBe(8);
  });

  it('files every object in the segment its position implies', () => {
    // By position, as PREP:272 does - never by the name's numeric suffix.
    for (const o of objects) {
      expect(o.segment, `object at y ${o.position.y}`).toBe(segmentIndexFor(o.position.y));
    }
  });

  it('stays inside the 37 slots the original pre-sized', () => {
    for (const o of objects) {
      expect(o.segment).toBeGreaterThanOrEqual(1);
      expect(o.segment).toBeLessThanOrEqual(K.SEGMENT_SLOTS);
    }
  });

  it('gives every object a real size', () => {
    for (const o of objects) {
      expect(o.halfExtent.x, o.kind).toBeGreaterThan(0);
      expect(o.halfExtent.y, o.kind).toBeGreaterThan(0);
      expect(o.halfExtent.z, o.kind).toBeGreaterThan(0);
    }
    // Trees are the big ones: about 4 x 4 x 8.5 across.
    const tree = objects.find((o) => o.kind === 'tree')!;
    expect(tree.halfExtent.z).toBeGreaterThan(1);
  });

  it('keeps the rotation the 68 turned trees carry', () => {
    const rotated = objects.filter(
      (o) => o.rotation.x !== 0 || o.rotation.y !== 0 || o.rotation.z !== 0 || o.rotation.w !== 1,
    );
    expect(rotated).toHaveLength(68);
    for (const o of rotated) expect(o.kind).toBe('tree');
  });

  it('refuses a file it cannot trust', () => {
    const bad = (edit: (v: DataView) => void) => {
      const b = readFileSync(FILE).slice();
      edit(new DataView(b.buffer, b.byteOffset, b.byteLength));
      return () => parseTrackObjects(b);
    };
    expect(bad((v) => v.setUint32(0, 0, true))).toThrow(/magic/i);
    expect(bad((v) => v.setUint32(4, 9, true))).toThrow(/version/i);
    expect(bad((v) => v.setUint32(8, 99999, true))).toThrow(/size|count/i);
    expect(bad((v) => v.setUint8(16, 0))).toThrow(/kind/i);
    expect(bad((v) => v.setUint8(17, 99))).toThrow(/segment/i);
    expect(bad((v) => v.setFloat32(20, NaN, true))).toThrow(/finite/i);
  });
});

describe('the link to the geometry', () => {
  it('lists objects in the same order the renderer finds their nodes', () => {
    // A prop and the mesh it is drawn as are matched by position in this
    // list. Both sides sort by name and nothing else; if that ever drifts,
    // every tree in the level is drawn as a different tree.
    const objects = parseTrackObjects(readFileSync(FILE));
    const glb = new Glb('public/models/track.glb');
    const nodes = (glb.json.nodes as { name?: string }[])
      .map((n) => n.name ?? '')
      .filter((n) => isTrackObjectNode(n))
      .sort((a, b) => a.localeCompare(b));

    expect(nodes).toHaveLength(objects.length);
    // The kinds have to line up index for index.
    nodes.forEach((name, i) => {
      const expected = name.startsWith('Tree_') ? 'tree' : 'pickup';
      expect(objects[i]!.kind, `${i}: ${name}`).toBe(expected);
    });
  });
});

describe('populateTrack', () => {
  it('files them into the track the simulation drives on', () => {
    const track = new Track({ ground: flatGroundMesh(K.SEGMENT_SLOTS) });
    const added = populateTrack(track, parseTrackObjects(readFileSync(FILE)));
    expect(added).toBe(432);

    const total = track.segments.reduce((n, s) => n + s.props.length, 0);
    expect(total).toBe(432);
    for (const segment of track.segments) {
      for (const prop of segment.props) {
        expect(segmentIndexFor(prop.position.y)).toBe(segment.index);
      }
    }
  });

  it('puts at most 26 trees in any one segment', () => {
    // Measured. It is what keeps the per-segment collider count in the tens.
    const track = new Track({ ground: flatGroundMesh(K.SEGMENT_SLOTS) });
    populateTrack(track, parseTrackObjects(readFileSync(FILE)));
    const most = Math.max(
      ...track.segments.map((s) => s.props.filter((p) => p.kind === 'tree').length),
    );
    expect(most).toBe(26);
  });
});
