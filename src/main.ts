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
import { GADGETS, GADGET_BY_KEY, type GadgetId } from './sim/gadgets.js';
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

/** Driving keys are held; gadget keys are edge-triggered. */
type DriveKey = 'forward' | 'backward' | 'left' | 'right';

const DRIVE_KEYS: Record<string, DriveKey> = {
  ArrowUp: 'forward',
  ArrowDown: 'backward',
  ArrowLeft: 'left',
  ArrowRight: 'right',
  KeyW: 'forward',
  KeyS: 'backward',
};

/**
 * Gadget bindings are the original's own: letters a-g and digits 1-7, the same
 * lettering painted on the Mach 5's steering wheel. That collides with WASD, so
 * A and D stay as steering and the gadgets on those letters are reachable by
 * their digits - noted in the on-screen help rather than silently rebound.
 */
const RESERVED_FOR_STEERING = new Set(['KeyA', 'KeyD']);

export interface InputSource {
  readonly state: VehicleInput;
  /** Consume the gadget presses accumulated since the last tick. */
  takePresses(): GadgetId[];
}

function createInput(): InputSource {
  const state: VehicleInput = {
    forward: false,
    backward: false,
    left: false,
    right: false,
    jacks: false,
  };
  let pending: GadgetId[] = [];

  addEventListener('keydown', (e) => {
    if (e.repeat) return;

    const drive = DRIVE_KEYS[e.code];
    if (drive) {
      e.preventDefault();
      state[drive] = true;
      return;
    }
    if (e.code === 'KeyA') { state.left = true; return; }
    if (e.code === 'KeyD') { state.right = true; return; }

    if (e.code === 'Space') {
      e.preventDefault();
      pending.push('jacks');
      return;
    }

    if (RESERVED_FOR_STEERING.has(e.code)) return;
    const gadget = GADGET_BY_KEY.get(e.key.toLowerCase());
    if (gadget) {
      e.preventDefault();
      pending.push(gadget);
    }
  });

  addEventListener('keyup', (e) => {
    const drive = DRIVE_KEYS[e.code];
    if (drive) state[drive] = false;
    if (e.code === 'KeyA') state.left = false;
    if (e.code === 'KeyD') state.right = false;
  });

  return {
    state,
    takePresses: () => {
      const taken = pending;
      pending = [];
      return taken;
    },
  };
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

    // Presses are consumed once and delivered to the first tick of this frame,
    // so holding a key cannot re-fire a gadget and a fast frame cannot drop one.
    let presses = input.takePresses();

    let stepped = 0;
    while (accumulator >= K.TICK_DT && stepped < MAX_CATCHUP_TICKS) {
      world.step({ ...input.state, gadgetPresses: presses });
      presses = [];
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
      bladesActive: v.gadgets.blades.active,
      gripActive: v.gadgets.grip.active,
      lightsActive: v.gadgets.lights.active,
      shieldActive: v.gadgets.deflector.active || v.gadgets.frogger.active,
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

    const gadgetLine = GADGETS.map((g) => {
      const st = v.gadgets[g.id];
      if (!st.active) return `${g.label.toLowerCase()} ·`;
      const left = g.ticks === null ? '' : ` ${st.remaining.toFixed(1)}s`;
      return `[${g.label.toUpperCase()}${left}]`;
    }).join('  ');

    hud.textContent =
      `speed ${v.forwardVel.toFixed(1)} / ${K.MAX_SPEED}` +
      `   wheels ${v.grounded.filter(Boolean).length}/4` +
      `   segment ${r.segment}/${SEGMENTS}` +
      `   surface ${surface} (grip ${v.surface.grip})` +
      `\ndamage ${r.damage.toFixed(0)}   oxygen ${r.oxygen.toFixed(0)}` +
      `   score ${r.score}   tick ${world.tick}${outcome}` +
      `\n${gadgetLine}`;
  }

  requestAnimationFrame(frame);
}

main().catch((err: unknown) => {
  document.body.insertAdjacentHTML(
    'beforeend',
    `<pre class="error">${String(err)}</pre>`,
  );
});
