/**
 * The camera has to start at the car.
 *
 * It trails the car by lerping toward where it wants to be, which is right for
 * every frame but the first: at frame one there is nothing to trail from, and
 * a lerp out of the default position leaves the camera at the world origin
 * looking at empty sky.
 *
 * That cost nothing while the car spawned at (0, 4, 0.9), essentially the
 * origin. The original course starts at (41.98, 38.83, ~13.9), and the first
 * second of the game became a blue screen.
 */
import { describe, it, expect } from 'vitest';
import { ChaseCamera } from '../src/render/scene.js';
import { vec3 } from '../src/sim/vehicle.js';

describe('ChaseCamera', () => {
  const start = vec3(41.98, 38.83, 13.9);
  const forward = vec3(0, 1, 0);

  it('is already at the car on its first frame', () => {
    const chase = new ChaseCamera(1.5);
    // The smoothing a real first frame gives: 1 - exp(-8 * 1/60).
    chase.follow(start, forward, 0.125);
    const d = chase.camera.position.distanceTo({ x: start.x, y: start.y, z: start.z } as never);
    // Behind by 9 and above by 3.5, so a bit under 10 away - not 55.
    expect(d).toBeLessThan(11);
  });

  it('still eases rather than snapping once it is following', () => {
    const chase = new ChaseCamera(1.5);
    chase.follow(start, forward, 0.125);
    const first = chase.camera.position.clone();
    chase.follow(vec3(start.x, start.y + 40, start.z), forward, 0.125);
    // It moved toward the new position without arriving at it.
    expect(chase.camera.position.y).toBeGreaterThan(first.y);
    expect(chase.camera.position.y).toBeLessThan(start.y + 40 - 9);
  });
});
