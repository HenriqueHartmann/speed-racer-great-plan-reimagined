/**
 * The renderer.
 *
 * It reads simulation state and draws it. It never writes to the simulation, and
 * it never advances it - that is the boundary the replay tests rely on, and the
 * reason frame rate cannot change the outcome.
 *
 * The car is a placeholder. The real Mach 5 is 20 separate models inside a
 * Shockwave 3D world whose mesh encoding is not decoded; see
 * `docs/research/w3d-format.md`. The placeholder sits behind `VehicleView` so it
 * can be replaced without touching anything else.
 */

import * as THREE from 'three';
import * as K from '../sim/constants.js';
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
  wheelSpin: number;
}

/**
 * A blocked-out car at the recovered dimensions.
 *
 * The proportions are not invented: track width, wheelbase and wheel radius are
 * recovered constants, so the placeholder is the right size even though it is
 * the wrong shape.
 */
export class PlaceholderCar implements VehicleView {
  readonly object = new THREE.Group();
  private readonly wheels: THREE.Mesh[] = [];
  private readonly jacks: THREE.Mesh;

  constructor() {
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(K.TRACK_WIDTH, K.WHEELBASE_FRONT * 2, 0.5),
      new THREE.MeshStandardMaterial({ color: 0xf2f2f2, roughness: 0.4, metalness: 0.1 }),
    );
    body.position.z = 0.1;
    body.castShadow = true;
    this.object.add(body);

    // The red "M" the car is known for, as a flat marker on the hood.
    const marker = new THREE.Mesh(
      new THREE.BoxGeometry(K.TRACK_WIDTH * 0.5, 0.5, 0.02),
      new THREE.MeshStandardMaterial({ color: 0xcc1111 }),
    );
    marker.position.set(0, K.WHEELBASE_FRONT * 0.45, 0.36);
    this.object.add(marker);

    const wheelGeom = new THREE.CylinderGeometry(
      K.WHEEL_RADIUS,
      K.WHEEL_RADIUS,
      0.25,
      16,
    );
    wheelGeom.rotateZ(Math.PI / 2);
    const wheelMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.9 });

    const xs = [-K.TRACK_WIDTH / 2, K.TRACK_WIDTH / 2];
    const ys = [K.WHEELBASE_FRONT, -K.WHEELBASE_REAR];
    for (const y of ys) {
      for (const x of xs) {
        const wheel = new THREE.Mesh(wheelGeom, wheelMat);
        wheel.position.set(x, y, -0.1);
        wheel.castShadow = true;
        this.wheels.push(wheel);
        this.object.add(wheel);
      }
    }

    this.jacks = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.08, 1.0, 8),
      new THREE.MeshStandardMaterial({ color: 0xdddd33 }),
    );
    this.jacks.position.z = -0.6;
    this.jacks.visible = false;
    this.object.add(this.jacks);
  }

  update(position: Vec3, forward: Vec3, _up: Vec3, state: VehicleViewState): void {
    this.object.position.set(position.x, position.y, position.z);
    // Yaw only: the placeholder does not need the full orientation to read well.
    this.object.rotation.set(0, 0, Math.atan2(-forward.x, forward.y));

    for (const wheel of this.wheels) wheel.rotation.x = state.wheelSpin;
    this.jacks.visible = state.jacksExtended;
  }
}

/** A chase camera that trails the car, smoothed per rendered frame. */
export class ChaseCamera {
  readonly camera: THREE.PerspectiveCamera;
  private readonly target = new THREE.Vector3();

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
    this.camera.position.lerp(desired, alpha);
    this.target.lerp(new THREE.Vector3(position.x, position.y, position.z + 1), alpha);
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

export function createScene(segmentCount = 8, halfWidth = 18): THREE.Scene {
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

  // The drivable strip. It is as wide as the track's own half-width, so what
  // you can see is exactly what the suspension will find.
  const length = K.SEGMENT_LENGTH * segmentCount;
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(halfWidth * 2, length),
    new THREE.MeshStandardMaterial({ color: 0x6f6f72, roughness: 1 }),
  );
  ground.position.y = length / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  // A stripe at every segment boundary, so the recovered 300-unit spacing is
  // visible rather than merely documented.
  const stripeMat = new THREE.MeshStandardMaterial({ color: 0xe8e8e8 });
  for (let i = 0; i <= segmentCount; i++) {
    const stripe = new THREE.Mesh(
      new THREE.PlaneGeometry(halfWidth * 2, 2),
      stripeMat,
    );
    stripe.position.set(0, i * K.SEGMENT_LENGTH, 0.02);
    scene.add(stripe);
  }

  return scene;
}
