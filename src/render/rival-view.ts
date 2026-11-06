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
import type { Vec3 } from '../sim/vehicle.js';

export const ENEMY_MODEL_URL = 'models/enemy.glb';

/** In `pWheelPointList` order, as the simulation keeps them. */
const WHEEL_NODES = ['mach5_wheel_FL', 'mach5_wheel_FR', 'mach5_wheel_RL', 'mach5_wheel_RR'];

const ORDINARY_BODY = 'car_body';
const DUGGARY_BODY = 'car_bodyDuggery';

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

/** One car's nodes, looked up once. */
interface RivalCar {
  readonly root: THREE.Object3D;
  readonly wheels: (THREE.Object3D | null)[];
  readonly ordinary: THREE.Object3D | null;
  readonly duggary: THREE.Object3D | null;
  readonly robot: THREE.Object3D | null;
}

export class RivalView {
  private readonly cars: RivalCar[] = [];

  private constructor(readonly object: THREE.Object3D, count: number, template: THREE.Object3D) {
    for (let i = 0; i < count; i++) {
      // The first car takes the loaded scene; the rest are clones of it, which
      // is what `cloneModelFromCastmember` did once per rival.
      const root = i === 0 ? template : template.clone(true);
      root.name = `rival_${i}`;
      object.add(root);
      this.cars.push({
        root,
        wheels: WHEEL_NODES.map((n) => root.getObjectByName(n) ?? null),
        ordinary: root.getObjectByName(ORDINARY_BODY) ?? null,
        duggary: root.getObjectByName(DUGGARY_BODY) ?? null,
        robot: root.getObjectByName('robot') ?? null,
      });
    }
  }

  static async load(count = K.RIVAL_CONCURRENT): Promise<RivalView> {
    const gltf = await new GLTFLoader().loadAsync(ENEMY_MODEL_URL);
    const template = gltf.scene.getObjectByName('SceneRoot') ?? gltf.scene;
    clearYUpConversion(template);
    return new RivalView(new THREE.Group(), count, template);
  }

  /** Draw one frame. States are in the simulation's own rival order. */
  update(states: readonly RivalViewState[]): void {
    this.cars.forEach((car, i) => {
      const state = states[i];
      if (!state || !state.alive) {
        car.root.visible = false;
        return;
      }
      car.root.visible = true;

      applyChassisOrientation(car.root, state.position, state.forward, state.up);

      for (let w = 0; w < car.wheels.length; w++) {
        const wheel = car.wheels[w];
        if (!wheel) continue;
        const hover = state.hoverDistances[w] ?? K.HOVER_DISTANCE;
        // The same drawn drop the player gets, clamp and all - a rival's
        // suspension is the player's, and `doEnemy` draws it the same way
        // bar the two differences recorded in the design, which are about
        // what an ungrounded wheel holds rather than how it is drawn.
        wheel.position.setZ(wheelDrop(hover, K.WHEEL_RADIUS));
      }

      // One body or the other, never both. `doJump:304-307`.
      if (car.ordinary) car.ordinary.visible = !state.duggary;
      if (car.duggary) car.duggary.visible = state.duggary;
      // `doEnemy:482-490`: the robot is shown only while the car is spinning.
      if (car.robot) car.robot.visible = state.spun;
    });
  }
}
