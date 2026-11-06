/**
 * The original Mach 5, recovered from the game's own Shockwave 3D world.
 *
 * `public/models/mach5.glb` is decoded from `SR_level_1.dcr` resource 7589 by
 * `macromelt`; `tools/extract_mesh.sh` regenerates it. Twenty meshes, 4,454
 * triangles, with the original textures.
 *
 * Gadget parts are shown and hidden by **node name**, and the mapping is not a
 * guess - `doMach5`'s `prepareCar` binds each property to a named model:
 *
 *   pCarShield     -> "windshield_top"     the Deflector canopy
 *   pCarWindshield -> "windshield"
 *   pCarJacks      -> "jacks"
 *   pCarSaws       -> "saw"
 *   pCarLights     -> "lights"
 *   pCarScopeDoor  -> "scope_door"
 *   pCarScopeTop   -> "scope_top"
 *   pCarScopeBar   -> "scope_bar"
 *   pGripA..D      -> "mach5_grip_FL" / "_FR" / "_RR" / "_RL"
 *
 * So the car shows the same part the original showed, for the same reason.
 */

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import * as K from '../sim/constants.js';
import { WHEEL_LOCAL_POINTS, type Vec3 } from '../sim/vehicle.js';
import {
  chassisLocalTranslation,
  GADGET_NODES,
  NEVER_DRAWN,
  volumeCentroid,
  wheelDrop,
  type Vec3Like,
} from './model-frame.js';
import { clearYUpConversion } from './scene-root.js';
import {
  BLADE_REST,
  BLADE_SPIN_DEG,
  SCOPE_OFFSET,
  SCOPE_REST,
  SCOPE_SPIN_DEG,
  stepBlades,
  stepScope,
} from './gadget-animation.js';
import { applyChassisOrientation } from './scene.js';
import type { VehicleView, VehicleViewState } from './scene.js';

export const MACH5_MODEL_URL = 'models/mach5.glb';

/**
 * Wheel nodes in `pWheelPointList` order: front-left, front-right, rear-left,
 * rear-right. The order matters because the original steers only the first two.
 */
const WHEEL_NODES = [
  'mach5_wheel_FL',
  'mach5_wheel_FR',
  'mach5_wheel_RL',
  'mach5_wheel_RR',
];

/** Grips, in the same order, so each can ride its wheel. */
const GRIP_NODES = [
  'mach5_grip_FL',
  'mach5_grip_FR',
  'mach5_grip_RL',
  'mach5_grip_RR',
];

export class OriginalMach5 implements VehicleView {
  readonly object = new THREE.Group();

  private readonly root = new THREE.Group();
  private readonly byName = new Map<string, THREE.Object3D>();
  private readonly wheels: THREE.Object3D[] = [];
  private robotFlight = -1;
  /** `pBladeFactor`: the saws scale out of the bodywork rather than appearing. */
  private bladeFactor = BLADE_REST;
  /** The blade texture's own rotation, which is what reads as the blur. */
  private bladeSpin = 0;
  /** `scopeFactor` and `scopeRotate` from `doCamera`. */
  private scopeFactor = SCOPE_REST;
  private scopeSpin = 0;
  private bladeMaterialCloned = false;
  /** The collider hull's centre of mass - the chassis origin we integrate about. */
  private centerOfMass: Vec3Like = { x: 0, y: 0, z: 0 };
  private loaded = false;
  /** Whether the Y-up conversion node was found and cleared. */
  private uprighted = false;

  private constructor(scene: THREE.Object3D) {
    // The mesh data is Director Z-up - `car_shadow` sits at
    // (-0.01, -1.16, -0.37) in the GLB, the same values our own 0x72 parser
    // read. But glTF requires Y-up, so the exporter puts a -90 degree X
    // rotation on `SceneRoot` to convert the whole scene.
    //
    // Our scene is Z-up as well, so that conversion is exactly what we do not
    // want. Clear it, rather than cancelling it with a second rotation: the
    // data already speaks our coordinate system, and two opposing quarter turns
    // would be a thing to get wrong again later.
    //
    // The rotation is on the node *named* `SceneRoot`, which is a child of the
    // Group the loader hands back - clearing the wrapper's rotation does
    // nothing, which is how this was got wrong once already. Search by name and
    // report if it is not found, instead of silently leaving the car on its
    // tail.
    this.uprighted = clearYUpConversion(scene);

    this.root.add(scene);
    this.object.add(this.root);

    scene.traverse((node) => {
      if (node.name) this.byName.set(node.name, node);
      const mesh = node as THREE.Mesh;
      if (mesh.isMesh) {
        mesh.castShadow = true;
        mesh.receiveShadow = true;
      }
    });

    this.hangOffTheChassis();

    for (const name of NEVER_DRAWN) {
      const node = this.byName.get(name);
      if (node) node.visible = false;
    }
    for (const group of Object.values(GADGET_NODES)) {
      for (const name of group) {
        const node = this.byName.get(name);
        if (node) node.visible = false;
      }
    }
    // The wheels hang off the chassis, not off the model: the original placed
    // them in world space every frame (`pWheelList[i].transform.position = ...`)
    // rather than carrying them with the bodywork, and their wheel points are
    // measured from the centre of mass, which is exactly where `object` sits.
    for (const name of WHEEL_NODES) {
      const node = this.byName.get(name);
      if (!node) continue;
      this.object.add(node);
      this.wheels.push(node);
    }
    // The original assigns each grip the matching wheel's transform outright
    // (`pGripA.transform = pWheelList[1].transform`). Parenting achieves the
    // same thing and keeps them in step for free.
    for (let i = 0; i < GRIP_NODES.length; i++) {
      const grip = this.byName.get(GRIP_NODES[i]!);
      const wheel = this.wheels[i];
      if (grip && wheel) {
        grip.position.set(0, 0, 0);
        grip.rotation.set(0, 0, 0);
        wheel.add(grip);
      }
    }

    this.loaded = true;
  }

  /**
   * Hang the model off the chassis the way `doMach5` does.
   *
   * Two separate offsets, and both were got wrong the first time:
   *
   * 1. The authoring scene parked each part where it was convenient to edit it.
   *    The game throws those positions away - it assigns the collider's own
   *    transform to every visible part - so `chassisLocalTranslation` drops
   *    them. Keeping them is what put 0.31 of air between the body and its
   *    wheels. See `model-frame.ts` for the per-node rule and its evidence.
   *
   * 2. The original's chassis origin was the rigid body's position, with the
   *    centre of mass an offset from it. Ours *is* the centre of mass, because
   *    that is the point the simulation integrates about. So the model hangs
   *    that offset lower, which is what the original's `pChassisRB.position +
   *    pChassisRB.centerOfMass` says in reverse.
   *
   * The wheels take no part in either. The simulation places them at the wheel
   * points, which sit at the centre of mass' own height, so they are parented
   * to the chassis directly rather than to the model.
   */
  private hangOffTheChassis(): void {
    const park = this.byName.get('mach5_body')?.position.clone() ?? new THREE.Vector3();

    const collider = this.byName.get('collider') as THREE.Mesh | undefined;
    const geometry = collider?.geometry;
    if (geometry) {
      const positions = geometry.getAttribute('position').array as ArrayLike<number>;
      const index = geometry.getIndex();
      this.centerOfMass = volumeCentroid(positions, index ? (index.array as ArrayLike<number>) : null);
    }
    this.root.position.set(-this.centerOfMass.x, -this.centerOfMass.y, -this.centerOfMass.z);

    for (const [name, node] of this.byName) {
      const local = chassisLocalTranslation({ name, translation: node.position }, park);
      node.position.set(local.x, local.y, local.z);
    }
  }

  /** Load the recovered model. Rejects if the file is missing or malformed. */
  static async load(url = MACH5_MODEL_URL): Promise<OriginalMach5> {
    const loader = new GLTFLoader();
    const gltf = await loader.loadAsync(url);
    return new OriginalMach5(gltf.scene);
  }

  /** Which recovered nodes were found, so a silent mismatch cannot pass. */
  report(): {
    found: string[];
    missing: string[];
    uprighted: boolean;
    centerOfMass: Vec3Like;
  } {
    const expected = [
      ...NEVER_DRAWN,
      'scope_door',
      ...WHEEL_NODES,
      ...GRIP_NODES,
      ...Object.values(GADGET_NODES).flat(),
      'mach5_body',
      'windshield',
    ];
    const found = expected.filter((n) => this.byName.has(n));
    return {
      found,
      missing: expected.filter((n) => !this.byName.has(n)),
      uprighted: this.uprighted,
      centerOfMass: this.centerOfMass,
    };
  }

  update(position: Vec3, forward: Vec3, up: Vec3, state: VehicleViewState): void {
    if (!this.loaded) return;

    applyChassisOrientation(this.object, position, forward, up);

    this.placeWheels(state);

    this.show(GADGET_NODES.jacks, state.jacksExtended);
    this.updateBlades(state.bladesActive);
    this.updateScope(state.frogger);
    this.show(GADGET_NODES.lights, state.lightsActive);
    this.show(GRIP_NODES, state.gripActive);
    // The Frogger closes the Deflector's canopy rather than showing anything of
    // its own: `doMach5` 316-317 sets `pHasScope` and `pHasShield` together.
    this.show(GADGET_NODES.shield, state.shieldActive || state.frogger);

    this.updateRobot(state);
  }

  /**
   * Place the four wheels, as `doMach5` does every frame.
   *
   * A wheel sits at its wheel point, pushed down by the suspension's current
   * hit distance less the wheel radius, so a compressed corner lifts its wheel
   * and an extended one drops it. The exported nodes are all at the origin
   * because the authored scene never placed them - the behaviour did.
   */
  private placeWheels(state: VehicleViewState): void {
    const steer = state.wheelTurn * K.MAX_WHEEL_TURN_DEG * (Math.PI / 180);

    for (let i = 0; i < this.wheels.length; i++) {
      const wheel = this.wheels[i]!;
      const point = WHEEL_LOCAL_POINTS[i];
      if (!point) continue;

      const hover = state.hoverDistances[i] ?? K.HOVER_DISTANCE;
      wheel.position.set(point.x, point.y, wheelDrop(hover, K.WHEEL_RADIUS));

      // Steer the front pair only; the rear two just roll.
      wheel.rotation.set(0, 0, i < 2 ? -steer : 0);
      wheel.rotateX(state.wheelSpin);
    }
  }

  /**
   * The saws grow out and their texture spins.
   *
   * `doMach5:586-607`. `pBladeFactor` ramps a tenth a frame between 0.1 and 1
   * and scales the whole model, so the blades emerge from the bodywork rather
   * than appearing at full size. They do not turn as geometry: the mesh is
   * still and `shaderList[3]`'s texture rotates 52 degrees a frame about its
   * own centre (`:592-594`), which is how a 2007 Shockwave game drew a blur.
   */
  private updateBlades(active: boolean): void {
    this.bladeFactor = stepBlades(this.bladeFactor, active);
    const saw = this.byName.get('saw');
    if (!saw) return;

    const out = active || this.bladeFactor > BLADE_REST;
    saw.visible = out;
    saw.traverse((n) => {
      const mesh = n as THREE.Mesh;
      if (mesh.isMesh) mesh.visible = out;
    });
    saw.scale.setScalar(this.bladeFactor);

    if (!out) return;
    this.bladeSpin = (this.bladeSpin + BLADE_SPIN_DEG) % 360;
    const map = this.bladeTexture(saw);
    if (map) {
      map.center.set(0.5, 0.5);
      map.rotation = (this.bladeSpin * Math.PI) / 180;
    }
  }

  /**
   * The texture the original spins: `shaderList[3]`, the third primitive.
   *
   * glTF gives a multi-primitive node a `Group` of meshes in order, so the
   * third is index 2. Its material is cloned the first time, because the
   * loader shares one material instance across the saw's other `blades`
   * primitive and the original turns only this one.
   */
  private bladeTexture(saw: THREE.Object3D): THREE.Texture | null {
    const mesh = saw.children[2] as THREE.Mesh | undefined;
    if (!mesh?.isMesh) return null;
    const material = mesh.material as THREE.MeshStandardMaterial;
    if (!material.map) return null;
    if (!this.bladeMaterialCloned) {
      const clone = material.clone();
      clone.map = material.map.clone();
      clone.map.needsUpdate = true;
      mesh.material = clone;
      this.bladeMaterialCloned = true;
      return clone.map;
    }
    return material.map;
  }

  /**
   * The periscope rises, and the hatch opens to let it.
   *
   * `doCamera:58-156`, which is where this lives rather than in `doMach5` -
   * and it addresses the models by their cloned names, `Mach5CarScopeTop`, so
   * a search for the property or the mesh name finds nothing. This project
   * concluded from exactly that search that the mast is never drawn, and was
   * wrong.
   *
   * The bar is scaled in z by `scopeFactor` and the head rides on top of it at
   * `0.246 + scopeFactor`, turning `SCOPE_SPIN_DEG` a frame. `scope_door` is
   * hidden while the mast is out and comes back when it retracts - which is
   * the other half of the fix that made the door stay shut when the Frogger
   * was off.
   */
  private updateScope(active: boolean): void {
    this.scopeFactor = stepScope(this.scopeFactor, active);
    const out = this.scopeFactor > SCOPE_REST;

    this.show(['scope_door'], !out);
    this.show(['scope_bar', 'scope_top'], out);
    if (!out) {
      this.scopeSpin = 0;
      return;
    }

    const bar = this.byName.get('scope_bar');
    if (bar) {
      bar.position.set(SCOPE_OFFSET.x, SCOPE_OFFSET.y, SCOPE_OFFSET.z);
      bar.scale.set(1, 1, this.scopeFactor);
    }

    const top = this.byName.get('scope_top');
    if (top) {
      top.position.set(SCOPE_OFFSET.x, SCOPE_OFFSET.y, SCOPE_OFFSET.z + this.scopeFactor);
      this.scopeSpin = Math.min(360, this.scopeSpin + SCOPE_SPIN_DEG);
      top.rotation.set(0, 0, (this.scopeSpin * Math.PI) / 180);
    }
  }

  private show(names: readonly string[], visible: boolean): void {
    for (const name of names) {
      const node = this.byName.get(name);
      if (node) node.visible = visible;
    }
  }

  /** The homing robot leaves the car and flies off, as it does in the show. */
  private updateRobot(state: VehicleViewState): void {
    const robot = this.byName.get('ROBOT');
    if (!robot) return;

    if (state.robotLaunched && this.robotFlight < 0) this.robotFlight = 0;

    if (this.robotFlight < 0) {
      robot.visible = false;
      return;
    }

    this.robotFlight += 0.02;
    if (this.robotFlight > 1) {
      this.robotFlight = -1;
      robot.visible = false;
      robot.position.set(0, 0, 0);
      return;
    }

    robot.visible = true;
    const t = this.robotFlight;
    // Local axes here are the model's own, before the root's Z-up rotation.
    robot.position.set(0, t * 26, Math.sin(t * 1.5) * 4);
  }
}
