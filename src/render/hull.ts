/**
 * A lofted hull: cross-sections along the Y axis, skinned into a surface.
 *
 * The Mach 5 is a long tapered shape with a pointed nose, a waist at the
 * cockpit and a raised rear deck. Approximating that with boxes and cones
 * produces exactly what it sounds like - the first attempt grew grey spikes
 * where the cones were mis-rotated. Lofting a profile gives real control over
 * the silhouette instead.
 *
 * Axes match the simulation: +X right, +Y forward, +Z up.
 */

import * as THREE from 'three';

export interface HullSection {
  /** Position along the car's length. Sections must be ordered tail to nose. */
  y: number;
  /** Half-width of the body at this station. */
  halfWidth: number;
  /** Lowest and highest point of the cross-section. */
  zBottom: number;
  zTop: number;
  /**
   * Cross-section squareness, 0..1. At 0 the section is an ellipse; at 1 it is
   * close to a rounded rectangle. The Mach 5 is rounded at the nose and
   * squarer through the body.
   */
  squareness?: number;
}

/**
 * Skin a set of sections into a closed surface.
 *
 * Winding is chosen so face normals point outward - verified by taking a face
 * on the +X flank and checking its normal, rather than guessed and left to
 * light the car inside out.
 */
export function loftHull(
  sections: readonly HullSection[],
  radialSegments = 16,
): THREE.BufferGeometry {
  if (sections.length < 2) {
    throw new Error('loftHull needs at least two sections');
  }

  const positions: number[] = [];
  const indices: number[] = [];
  const n = radialSegments;

  for (const section of sections) {
    const centreZ = (section.zTop + section.zBottom) / 2;
    const radiusZ = (section.zTop - section.zBottom) / 2;
    const k = section.squareness ?? 0;

    for (let j = 0; j < n; j++) {
      const theta = (j / n) * Math.PI * 2;
      const c = Math.cos(theta);
      const s = Math.sin(theta);

      // Blend between an ellipse and a squarer profile by pushing the
      // parametric point toward the bounding box.
      const squareC = Math.sign(c) * Math.abs(c) ** 0.6;
      const squareS = Math.sign(s) * Math.abs(s) ** 0.6;

      const x = section.halfWidth * (c * (1 - k) + squareC * k);
      const z = centreZ + radiusZ * (s * (1 - k) + squareS * k);
      positions.push(x, section.y, z);
    }
  }

  for (let i = 0; i < sections.length - 1; i++) {
    for (let j = 0; j < n; j++) {
      const jNext = (j + 1) % n;
      const a = i * n + j;
      const b = i * n + jNext;
      const c = (i + 1) * n + jNext;
      const d = (i + 1) * n + j;
      // (a, c, b) and (a, d, c) put the normal outward; see the module note.
      indices.push(a, c, b, a, d, c);
    }
  }

  // Caps, so the ends are closed rather than open tubes.
  const first = sections[0]!;
  const last = sections[sections.length - 1]!;
  const tailCentre = positions.length / 3;
  positions.push(0, first.y, (first.zTop + first.zBottom) / 2);
  const noseCentre = positions.length / 3;
  positions.push(0, last.y, (last.zTop + last.zBottom) / 2);

  const lastRing = (sections.length - 1) * n;
  for (let j = 0; j < n; j++) {
    const jNext = (j + 1) % n;
    indices.push(tailCentre, j, jNext);
    indices.push(noseCentre, lastRing + jNext, lastRing + j);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(positions, 3),
  );
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}
