/**
 * The renderer.
 *
 * It reads simulation state and draws it. It never writes to the simulation, and
 * it never advances it - that is the boundary the replay tests rely on, and the
 * reason frame rate cannot change the outcome.
 *
 * The car lives behind the `VehicleView` interface declared here, so it can be
 * swapped without touching anything else. Two implementations use it: the
 * recovered Mach 5 in `mach5-original.ts` - 20 models decoded out of the game's
 * own Shockwave 3D world - and the hand-built one in `mach5.ts`, kept as the
 * fallback for when the model file is missing. See `docs/research/w3d-format.md`.
 */

import * as THREE from 'three';
import type { Vec3 } from '../sim/vehicle.js';

/** Anything that can stand in for the car. */
export interface VehicleView {
  readonly object: THREE.Object3D;
  /** Called once per rendered frame with the latest simulation state. */
  update(position: Vec3, forward: Vec3, up: Vec3, state: VehicleViewState): void;
}

export interface VehicleViewState {
  forwardVel: number;
  grounded: readonly boolean[];
  jacksExtended: boolean;
  bladesActive: boolean;
  gripActive: boolean;
  lightsActive: boolean;
  /** Deflector or Frogger: either closes the cockpit canopy. */
  shieldActive: boolean;
  /** Frogger specifically, which also raises the periscope. */
  frogger: boolean;
  /** True on the frame the Robot is launched. */
  robotLaunched: boolean;
  wheelSpin: number;
  /**
   * Per-wheel suspension hit distance, in `WHEEL_LOCAL_POINTS` order. The
   * original placed each wheel model by this every frame rather than authoring
   * it in the scene, which is why the exported wheel nodes sit at the origin.
   */
  hoverDistances: readonly number[];
  /** Eased steering, -1..1, for turning the front wheels. Cosmetic. */
  wheelTurn: number;
}

/**
 * Put the car where the chassis is, facing where it faces, leaning how it leans.
 *
 * Both car views used to keep only the heading - `rotation.set(0, 0, yaw)` -
 * and ignore the `up` the simulation hands them. The simulation has always
 * pitched and rolled: the suspension is four independent springs and the
 * original self-rights in the air. On a flat strip there was nothing to see,
 * and on a course that climbs from z -20 to +27 the car read as sliding along
 * a level floor over the hills.
 *
 * The basis is rebuilt rather than trusted. Four springs do not keep `up`
 * square to `forward`, and feeding a skewed pair straight into a matrix shears
 * the bodywork.
 */
export function applyChassisOrientation(
  object: THREE.Object3D,
  position: Vec3,
  forward: Vec3,
  up: Vec3,
): void {
  object.position.set(position.x, position.y, position.z);

  const f = new THREE.Vector3(forward.x, forward.y, forward.z);
  const u = new THREE.Vector3(up.x, up.y, up.z);
  if (f.lengthSq() < 1e-12 || u.lengthSq() < 1e-12) return;
  f.normalize();
  u.normalize();

  // Right is forward x up in this Z-up frame: (0,1,0) x (0,0,1) = (1,0,0).
  const right = new THREE.Vector3().crossVectors(f, u);
  if (right.lengthSq() < 1e-12) return; // forward and up collinear; keep the last pose
  right.normalize();
  // Square `up` back up against the pair we trust.
  u.crossVectors(right, f).normalize();

  object.quaternion.setFromRotationMatrix(
    new THREE.Matrix4().makeBasis(right, f, u),
  );
}

/** A chase camera that trails the car, smoothed per rendered frame. */
export class ChaseCamera {
  readonly camera: THREE.PerspectiveCamera;
  private readonly target = new THREE.Vector3();
  /** There is nothing to trail from on the first frame. */
  private placed = false;

  constructor(aspect: number) {
    this.camera = new THREE.PerspectiveCamera(60, aspect, 0.1, 5000);
    this.camera.up.set(0, 0, 1); // Z-up, matching the simulation
  }

  /**
   * `alpha` is frame-rate dependent smoothing. That is fine precisely because
   * the camera is not part of the simulation: nothing it does feeds back.
   */
  follow(position: Vec3, forward: Vec3, alpha: number): void {
    const behind = 9;
    const height = 3.5;
    const desired = new THREE.Vector3(
      position.x - forward.x * behind,
      position.y - forward.y * behind,
      position.z + height,
    );
    const look = new THREE.Vector3(position.x, position.y, position.z + 1);
    if (this.placed) {
      this.camera.position.lerp(desired, alpha);
      this.target.lerp(look, alpha);
    } else {
      // Snap. Easing out of the default position would start the camera at
      // the world origin, which was invisible while the car spawned there and
      // is a second of empty sky now that the course starts at x 42, y 39.
      this.camera.position.copy(desired);
      this.target.copy(look);
      this.placed = true;
    }
    this.camera.lookAt(this.target);
  }

  setAspect(aspect: number): void {
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
  }
}

/** Colours chosen so a prop's kind is readable at a glance while driving. */
const PROP_COLOURS: Record<string, number> = {
  wall: 0xb4583c,
  faller: 0x3f7a35,
  enemyCar: 0x2a4fa8,
  pickup: 0xe8c33a,
  track: 0x6f6f72,
};

/** Build meshes for every prop on the track, and return a per-id lookup. */
export function createPropViews(
  scene: THREE.Scene,
  segments: readonly {
    props: readonly {
      id: number;
      kind: string;
      position: { x: number; y: number; z: number };
      halfExtent: { x: number; y: number; z: number };
    }[];
  }[],
): Map<number, THREE.Object3D> {
  const views = new Map<number, THREE.Object3D>();
  for (const seg of segments) {
    for (const prop of seg.props) {
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(
          prop.halfExtent.x * 2,
          prop.halfExtent.y * 2,
          prop.halfExtent.z * 2,
        ),
        new THREE.MeshStandardMaterial({
          color: PROP_COLOURS[prop.kind] ?? 0x888888,
          roughness: 0.7,
          emissive: prop.kind === 'pickup' ? 0x664c00 : 0x000000,
        }),
      );
      mesh.position.set(prop.position.x, prop.position.y, prop.position.z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      scene.add(mesh);
      views.set(prop.id, mesh);
    }
  }
  return views;
}

/**
 * The lights and the sky. The road is no longer generated here: the original
 * course is loaded as a model by `TrackView` and added by the caller.
 */
export function createScene(): THREE.Scene {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x87b8e8);
  scene.fog = new THREE.Fog(0x87b8e8, 120, 900);

  const sun = new THREE.DirectionalLight(0xffffff, 2.2);
  sun.position.set(60, -40, 120);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 400;
  const d = 40;
  sun.shadow.camera.left = -d;
  sun.shadow.camera.right = d;
  sun.shadow.camera.top = d;
  sun.shadow.camera.bottom = -d;
  scene.add(sun);
  scene.add(new THREE.HemisphereLight(0xcfe6ff, 0x3a3a2a, 0.9));

  return scene;
}
