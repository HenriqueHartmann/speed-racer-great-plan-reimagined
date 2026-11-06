/**
 * The rivals, drawn.
 *
 * `public/models/enemy.glb` is resource 7591, `Car_Enemy`: one body, the
 * Duggary's own body, a windshield, a shadow, the spin robot, and four wheels
 * whose node names are the Mach 5's. `prepareCar:90-100` clones the whole set
 * once per rival, which is what `load` does here - three independent copies,
 * because a `Group` can only be in one place at a time.
 *
 * The Duggary is not a fourth car. `doJump:304-307` swaps the ordinary shell
 * for `gCarDuggery` on the car that gets promoted, so a rival is drawn with
 * one body or the other and never both.
 */

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { applyChassisOrientation } from './scene.js';
import { wheelDrop } from './model-frame.js';
import { clearYUpConversion } from './scene-root.js';
import * as K from '../sim/constants.js';
import { WHEEL_LOCAL_POINTS, type Vec3 } from '../sim/vehicle.js';

export const ENEMY_MODEL_URL = 'models/enemy.glb';

/** In `pWheelPointList` order, as the simulation keeps them. */
const WHEEL_NODES = ['mach5_wheel_FL', 'mach5_wheel_FR', 'mach5_wheel_RL', 'mach5_wheel_RR'];

const ORDINARY_BODY = 'car_body';
const DUGGARY_BODY = 'car_bodyDuggery';

/**
 * Parts the game re-parents to the chassis every frame, so their authored
 * translations are thrown away.
 *
 * `doEnemy:370-371` assigns `pCarShell.transform = pCarBody.transform` and the
 * same for the windshield, and `:484-486` does it for the robot. The enemy
 * model parks all three at (0, 0.037, 0.311) - the same kind of authoring
 * offset that once left 0.31 of air between the Mach 5 and its wheels.
 */
const PINNED = new Set([ORDINARY_BODY, DUGGARY_BODY, 'car_windshield', 'robot']);

/**
 * Not drawn, as the player's is not.
 *
 * `car_shadow` is a flat plane the original slides under the rear axle
 * (`doEnemy:605-607`). This project draws no shadow planes for the player
 * either - `NEVER_DRAWN` holds it - and an unplaced one stands on edge under
 * the car, which is exactly how it looked.
 */
const NEVER_DRAWN = new Set(['car_shadow']);

/** Everything the renderer needs about one rival this frame. */
export interface RivalViewState {
  readonly position: Vec3;
  readonly forward: Vec3;
  readonly up: Vec3;
  readonly hoverDistances: readonly number[];
  readonly alive: boolean;
  readonly duggary: boolean;
  /** Spun by the Robot: the original shows its tumbling robot while this lasts. */
  readonly spun: boolean;
}

/**
 * One car, in the Mach 5's own two-level shape.
 *
 * `chassis` is what gets oriented every frame, and it sits at the centre of
 * mass because that is the point the simulation integrates about. `body`
 * hangs inside it, offset by `-centreOfMass`, because the original's chassis
 * origin was the rigid body's position with the centre of mass an offset from
 * it. The WHEELS hang off `chassis` directly, not off `body`: their wheel
 * points are measured from the centre of mass, which is where `chassis` is.
 *
 * Collapsing the two is what this file got wrong first: `applyChassisOrientation`
 * writes the node's position outright, so orienting the same node that carried
 * the offset wiped the offset on the first frame.
 */
interface RivalCar {
  readonly chassis: THREE.Object3D;
  readonly wheels: (THREE.Object3D | null)[];
  readonly ordinary: THREE.Object3D | null;
  readonly duggary: THREE.Object3D | null;
  readonly robot: THREE.Object3D | null;
}

export class RivalView {
  private readonly cars: RivalCar[] = [];

  private constructor(
    readonly object: THREE.Object3D,
    count: number,
    template: THREE.Object3D,
    centerOfMass: Vec3,
  ) {
    // Prepare the template ONCE, then clone it for every car - including the
    // first. Letting car 0 keep the template was a real defect: the wheels
    // are reparented out of the model onto the chassis below, so the clones
    // taken afterwards came out with no wheels at all, and a bodywork with no
    // wheels reads on screen as a car lying flat on the road.
    RivalView.hangOffTheChassis(template);

    for (let i = 0; i < count; i++) {
      // `cloneModelFromCastmember`, once per rival.
      const model = template.clone(true);

      const chassis = new THREE.Group();
      chassis.name = `rival_${i}`;
      const body = new THREE.Group();
      body.name = `rival_${i}_body`;
      body.position.set(-centerOfMass.x, -centerOfMass.y, -centerOfMass.z);
      body.add(model);
      chassis.add(body);
      object.add(chassis);

      // Reparent the wheels onto the chassis, out from under the body's
      // offset, exactly as the player's model does.
      const wheels = WHEEL_NODES.map((n) => {
        const wheel = model.getObjectByName(n);
        if (wheel) chassis.add(wheel);
        return wheel ?? null;
      });

      this.cars.push({
        chassis,
        wheels,
        ordinary: model.getObjectByName(ORDINARY_BODY) ?? null,
        duggary: model.getObjectByName(DUGGARY_BODY) ?? null,
        robot: model.getObjectByName('robot') ?? null,
      });
    }
  }

  /**
   * Throw the authoring positions away and hang the model off the chassis.
   *
   * The same two offsets the Mach 5 needed, and for the same reasons - see
   * `OriginalMach5.hangOffTheChassis`. The rival's rigid body is literally the
   * Mach 5's collider (`prepareCar:90` clones `"collider"` out of
   * `member("Car_Mach5")`), so its centre of mass is the same one, which is
   * why it is passed in rather than measured again from a mesh this file does
   * not have.
   */
  private static hangOffTheChassis(root: THREE.Object3D): void {
    for (const child of [...root.children]) {
      if (NEVER_DRAWN.has(child.name)) {
        child.visible = false;
        continue;
      }
      if (PINNED.has(child.name)) child.position.set(0, 0, 0);
    }
  }

  /**
   * Build from a scene already in hand.
   *
   * Separated from `load` so the structure can be tested without a DOM:
   * `GLTFLoader` needs one, and the structure is what went wrong twice.
   */
  static fromScene(scene: THREE.Object3D, count: number, centerOfMass: Vec3): RivalView {
    return new RivalView(new THREE.Group(), count, scene, centerOfMass);
  }

  static async load(
    count = K.RIVAL_CONCURRENT,
    centerOfMass: Vec3 = { x: 0, y: 0, z: 0 },
  ): Promise<RivalView> {
    const gltf = await new GLTFLoader().loadAsync(ENEMY_MODEL_URL);
    const template = gltf.scene.getObjectByName('SceneRoot') ?? gltf.scene;
    clearYUpConversion(template);
    return RivalView.fromScene(template, count, centerOfMass);
  }

  /** Draw one frame. States are in the simulation's own rival order. */
  update(states: readonly RivalViewState[]): void {
    this.cars.forEach((car, i) => {
      const state = states[i];
      if (!state || !state.alive) {
        car.chassis.visible = false;
        return;
      }
      car.chassis.visible = true;

      applyChassisOrientation(car.chassis, state.position, state.forward, state.up);

      for (let w = 0; w < car.wheels.length; w++) {
        const wheel = car.wheels[w];
        const point = WHEEL_LOCAL_POINTS[w];
        if (!wheel || !point) continue;
        const hover = state.hoverDistances[w] ?? K.HOVER_DISTANCE;
        // At the wheel POINT, not at the authored translation - the enemy
        // model carries none at all, so every wheel sits at the car's centre
        // until it is placed. `doEnemy:596` is explicit:
        // `pWheelList[i].transform.position = pChassisMDL.transform *
        // pWheelPointList[i]`, then dropped by the hover distance.
        wheel.position.set(point.x, point.y, wheelDrop(hover, K.WHEEL_RADIUS));
      }

      // One body or the other, never both. `doJump:304-307`.
      if (car.ordinary) car.ordinary.visible = !state.duggary;
      if (car.duggary) car.duggary.visible = state.duggary;
      // `doEnemy:482-490`: the robot is shown only while the car is spinning.
      if (car.robot) car.robot.visible = state.spun;
    });
  }
}
