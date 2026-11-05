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
import { buildSliceTrack } from './sim/track.js';
import {
  initRapier,
  RapierWorld,
  RapierChassis,
} from './physics/rapier-body.js';
import {
  ChaseCamera,
  PlaceholderCar,
  createPropViews,
  createScene,
} from './render/scene.js';

const SEGMENTS = 6;
const TRACK_HALF_WIDTH = 18;

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

function createInput(): VehicleInput {
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
  addEventListener('keydown', (e) => {
    if (KEY_MAP[e.code]) e.preventDefault();
    set(e.code, true);
  });
  addEventListener('keyup', (e) => set(e.code, false));
  return current;
}

async function main(): Promise<void> {
  const canvas = document.getElementById('game') as HTMLCanvasElement;
  const hud = document.getElementById('hud') as HTMLElement;

  const track = buildSliceTrack(SEGMENTS);

  const rapier = await initRapier();
  const host = new RapierWorld(rapier);
  // A strip, not a plane: driving off the edge should mean falling.
  const length = K.SEGMENT_LENGTH * SEGMENTS;
  host.addGroundStrip(TRACK_HALF_WIDTH, length / 2, length / 2);

  // Solid props get a static collider so they stop the car. Pickups do not:
  // they are collected by the simulation's overlap test and must not block.
  const propColliders = new Map<number, ReturnType<typeof host.addStaticBox>>();
  for (const seg of track.segments) {
    for (const prop of seg.props) {
      if (prop.kind === 'pickup') continue;
      propColliders.set(prop.id, host.addStaticBox(prop.position, prop.halfExtent));
    }
  }

  const chassis = new RapierChassis(rapier, host, vec3(0, 4, K.SPAWN_HEIGHT));
  const world = new World({
    seed: 0x5eed_1234,
    body: chassis,
    // The track is the ground probe: it knows segments, surfaces and seams.
    probe: track,
    track,
    stepPhysics: () => host.step(),
  });

  const scene = createScene(SEGMENTS, TRACK_HALF_WIDTH);
  const car = new PlaceholderCar();
  scene.add(car.object);
  const propViews = createPropViews(scene, track.segments);

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
  /** Never advance more than this in one frame, so a stall cannot cascade. */
  const MAX_CATCHUP_TICKS = 5;

  function frame(now: number): void {
    requestAnimationFrame(frame);

    const elapsed = Math.min((now - last) / 1000, 0.25);
    last = now;
    accumulator += elapsed;

    let stepped = 0;
    while (accumulator >= K.TICK_DT && stepped < MAX_CATCHUP_TICKS) {
      world.step(input);
      accumulator -= K.TICK_DT;
      stepped++;
    }
    if (stepped === MAX_CATCHUP_TICKS) accumulator = 0;

    const v = world.vehicle;
    const r = world.race;

    wheelSpin += (v.forwardVel / K.WHEEL_RADIUS) * K.WHEEL_SPIN_COEFF * elapsed;
    car.update(chassis.position, chassis.forward, chassis.up, {
      forwardVel: v.forwardVel,
      grounded: v.grounded,
      jacksExtended: v.jacksExtended,
      wheelSpin,
    });
    chase.follow(chassis.position, chassis.forward, 1 - Math.exp(-8 * elapsed));

    // Consumed props disappear, and stop blocking. The simulation owns the
    // flag; the renderer and the physics world only follow it.
    for (const seg of track.segments) {
      for (const prop of seg.props) {
        const view = propViews.get(prop.id);
        if (view) view.visible = prop.active;

        if (!prop.active) {
          const collider = propColliders.get(prop.id);
          if (collider) {
            host.removeCollider(collider);
            propColliders.delete(prop.id);
          }
        }
      }
    }

    renderer.render(scene, chase.camera);

    const surface = v.surface.inferredName;
    const outcome = r.outcome === 'running' ? '' : `   — ${r.outcome.toUpperCase()}`;
    hud.textContent =
      `speed ${v.forwardVel.toFixed(1)} / ${K.MAX_SPEED}` +
      `   wheels ${v.grounded.filter(Boolean).length}/4` +
      `   segment ${r.segment}/${SEGMENTS}` +
      `   surface ${surface} (grip ${v.surface.grip})` +
      `\ndamage ${r.damage.toFixed(0)}   oxygen ${r.oxygen.toFixed(0)}` +
      `   score ${r.score}   tick ${world.tick}${outcome}`;
  }

  requestAnimationFrame(frame);
}

main().catch((err: unknown) => {
  document.body.insertAdjacentHTML(
    'beforeend',
    `<pre class="error">${String(err)}</pre>`,
  );
});
