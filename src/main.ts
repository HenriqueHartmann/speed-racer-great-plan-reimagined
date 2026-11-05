/**
 * Entry point: wires input, the fixed-timestep simulation and the renderer.
 *
 * The important structure here is the loop. The simulation advances in whole
 * ticks from an accumulator; the renderer draws whenever the browser asks. A
 * slow frame makes the simulation catch up in discrete steps rather than take a
 * bigger one, so the result does not depend on frame rate. That is the same
 * property the replay tests assert, running for real.
 */

import * as THREE from 'three';
import * as K from './sim/constants.js';
import { World } from './sim/world.js';
import { vec3, type VehicleInput } from './sim/vehicle.js';
import {
  initRapier,
  RapierWorld,
  RapierChassis,
  RapierGround,
} from './physics/rapier-body.js';
import { ChaseCamera, PlaceholderCar, createScene } from './render/scene.js';

const KEY_MAP: Record<string, keyof VehicleInput> = {
  ArrowUp: 'forward',
  KeyW: 'forward',
  ArrowDown: 'backward',
  KeyS: 'backward',
  ArrowLeft: 'left',
  KeyA: 'left',
  ArrowRight: 'right',
  KeyD: 'right',
  Space: 'jacks',
};

function createInput(): { current: VehicleInput; dispose: () => void } {
  const current: VehicleInput = {
    forward: false,
    backward: false,
    left: false,
    right: false,
    jacks: false,
  };

  const set = (code: string, down: boolean) => {
    const key = KEY_MAP[code];
    if (key) current[key] = down;
  };
  const onDown = (e: KeyboardEvent) => {
    if (KEY_MAP[e.code]) e.preventDefault();
    set(e.code, true);
  };
  const onUp = (e: KeyboardEvent) => set(e.code, false);

  window.addEventListener('keydown', onDown);
  window.addEventListener('keyup', onUp);
  return {
    current,
    dispose: () => {
      window.removeEventListener('keydown', onDown);
      window.removeEventListener('keyup', onUp);
    },
  };
}

async function main(): Promise<void> {
  const canvas = document.getElementById('game') as HTMLCanvasElement;
  const hud = document.getElementById('hud') as HTMLElement;

  const rapier = await initRapier();
  const host = new RapierWorld(rapier);
  host.addGroundPlane();

  const chassis = new RapierChassis(rapier, host, vec3(0, 0, K.SPAWN_HEIGHT));
  const ground = new RapierGround(rapier, host, chassis);
  const world = new World({
    seed: 0x5eed_1234,
    body: chassis,
    probe: ground,
    stepPhysics: () => host.step(),
  });

  const scene = createScene();
  const car = new PlaceholderCar();
  scene.add(car.object);

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const chase = new ChaseCamera(innerWidth / innerHeight);

  const resize = () => {
    renderer.setSize(innerWidth, innerHeight, false);
    chase.setAspect(innerWidth / innerHeight);
  };
  resize();
  addEventListener('resize', resize);

  const input = createInput();
  let wheelSpin = 0;
  let accumulator = 0;
  let last = performance.now();
  /** Never advance more than this many ticks in one frame, so a stall cannot
   *  cascade into a freeze while the simulation tries to catch up. */
  const MAX_CATCHUP_TICKS = 5;

  function frame(now: number): void {
    requestAnimationFrame(frame);

    const elapsed = Math.min((now - last) / 1000, 0.25);
    last = now;
    accumulator += elapsed;

    let stepped = 0;
    while (accumulator >= K.TICK_DT && stepped < MAX_CATCHUP_TICKS) {
      world.step(input.current);
      accumulator -= K.TICK_DT;
      stepped++;
    }
    if (stepped === MAX_CATCHUP_TICKS) accumulator = 0;

    const v = world.vehicle;
    wheelSpin += (v.forwardVel / K.WHEEL_RADIUS) * K.WHEEL_SPIN_COEFF * elapsed;

    car.update(chassis.position, chassis.forward, chassis.up, {
      forwardVel: v.forwardVel,
      grounded: v.grounded,
      jacksExtended: v.jacksExtended,
      wheelSpin,
    });
    chase.follow(chassis.position, chassis.forward, 1 - Math.exp(-8 * elapsed));

    renderer.render(scene, chase.camera);

    hud.textContent =
      `speed ${v.forwardVel.toFixed(1)} / ${K.MAX_SPEED}` +
      `   wheels ${v.grounded.filter(Boolean).length}/4` +
      `   segment ${world.race.segment}/${K.SEGMENT_SLOTS}` +
      `   damage ${world.race.damage.toFixed(0)}` +
      `   tick ${world.tick}`;
  }

  requestAnimationFrame(frame);
}

main().catch((err: unknown) => {
  document.body.insertAdjacentHTML(
    'beforeend',
    `<pre class="error">${String(err)}</pre>`,
  );
});
