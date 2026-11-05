/**
 * The car has to lean with the road.
 *
 * The simulation has always rolled and pitched the chassis - the suspension is
 * four independent springs and the original has airborne self-righting - but
 * both car views threw that away and kept only the heading:
 *
 *     this.object.rotation.set(0, 0, Math.atan2(-forward.x, forward.y));
 *
 * with the `up` argument named `_up` and unused. On a flat test strip there
 * was nothing to see. On the real course, which climbs from z -20 to +27 and
 * banks through its curves, the car reads as sliding along a level floor.
 */
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { applyChassisOrientation } from '../src/render/scene.js';
import { vec3 } from '../src/sim/vehicle.js';

/** Where a point on the car ends up once the chassis is oriented. */
function localToWorld(forward: { x: number; y: number; z: number }, up: { x: number; y: number; z: number }, local: THREE.Vector3): THREE.Vector3 {
  const object = new THREE.Object3D();
  applyChassisOrientation(object, vec3(0, 0, 0), forward, up);
  object.updateMatrixWorld(true);
  return local.clone().applyMatrix4(object.matrixWorld);
}

describe('applyChassisOrientation', () => {
  it('still points the car where it is going', () => {
    const nose = localToWorld(vec3(0, 1, 0), vec3(0, 0, 1), new THREE.Vector3(0, 1, 0));
    expect(nose.y).toBeCloseTo(1, 6);
    expect(nose.x).toBeCloseTo(0, 6);
    expect(nose.z).toBeCloseTo(0, 6);
  });

  it('turns the car to face a heading', () => {
    const nose = localToWorld(vec3(1, 0, 0), vec3(0, 0, 1), new THREE.Vector3(0, 1, 0));
    expect(nose.x).toBeCloseTo(1, 6);
    expect(nose.y).toBeCloseTo(0, 6);
  });

  it('pitches the nose up a climb', () => {
    // Driving up a 30 degree grade: forward tilts up, up tilts back.
    const s = Math.sin(Math.PI / 6);
    const c = Math.cos(Math.PI / 6);
    const nose = localToWorld(vec3(0, c, s), vec3(0, -s, c), new THREE.Vector3(0, 1, 0));
    expect(nose.z).toBeCloseTo(s, 5);
  });

  it('rolls the car into a bank', () => {
    // The road banks 20 degrees: up leans, forward does not change.
    const s = Math.sin(Math.PI / 9);
    const c = Math.cos(Math.PI / 9);
    const wingtip = localToWorld(vec3(0, 1, 0), vec3(s, 0, c), new THREE.Vector3(1, 0, 0));
    expect(wingtip.z).toBeCloseTo(-s, 5);
    expect(wingtip.x).toBeCloseTo(c, 5);
  });

  it('survives an up vector that is not square to forward', () => {
    // The suspension does not guarantee orthogonality; the basis must be
    // rebuilt rather than trusted, or the car shears.
    const object = new THREE.Object3D();
    applyChassisOrientation(object, vec3(0, 0, 0), vec3(0, 1, 0), vec3(0, 0.3, 1));
    const m = new THREE.Matrix4().makeRotationFromQuaternion(object.quaternion);
    const e = m.elements;
    const col = (i: number) => new THREE.Vector3(e[i * 4]!, e[i * 4 + 1]!, e[i * 4 + 2]!);
    expect(col(0).length()).toBeCloseTo(1, 6);
    expect(col(0).dot(col(1))).toBeCloseTo(0, 6);
    expect(col(1).dot(col(2))).toBeCloseTo(0, 6);
  });
});
