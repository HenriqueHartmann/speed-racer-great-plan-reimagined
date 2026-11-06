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
import { Track } from './sim/track.js';
import { GADGETS, GADGET_BY_KEY, type GadgetId } from './sim/gadgets.js';
import {
  initRapier,
  RapierWorld,
  RapierChassis,
} from './physics/rapier-body.js';
import {
  ChaseCamera,
  createPropViews,
  createScene,
  type VehicleView,
} from './render/scene.js';
import { Mach5 } from './render/mach5.js';
import { TrackView } from './render/track-view.js';
import { SegmentColliders } from './physics/segment-colliders.js';
import { PropColliders } from './physics/prop-colliders.js';
import { parseGroundMesh, parseSolidMesh } from './sim/ground-mesh.js';
import { parseTrackObjects, populateTrack } from './sim/track-objects.js';
import { OriginalMach5 } from './render/mach5-original.js';

const TRACK_GROUND_URL = 'models/track-ground.bin';
const TRACK_SOLIDS_URL = 'models/track-solids.bin';
const TRACK_OBJECTS_URL = 'models/track-objects.bin';

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
  /** True once per press of the restart key. */
  takeRestart(): boolean;
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
  let restartPressed = false;

  addEventListener('keydown', (e) => {
    if (e.repeat) return;

    if (e.code === 'KeyR') {
      e.preventDefault();
      restartPressed = true;
      return;
    }

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
    takeRestart: () => {
      const taken = restartPressed;
      restartPressed = false;
      return taken;
    },
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

  // The original course, as the game shipped it: 37 segments decoded from
  // SR_level_1 resource 7587. tools/extract_mesh.sh regenerates this file.
  const ground = parseGroundMesh(new Uint8Array(await (await fetch(TRACK_GROUND_URL)).arrayBuffer()));
  const track = new Track({ ground });

  const rapier = await initRapier();
  const host = new RapierWorld(rapier);

  // One solid segment at a time, as doM5ChangeSegment kept it. The hover ray
  // consults two at a seam; the collider never does.
  const segmentColliders = new SegmentColliders(host, ground);

  // The level's barriers - walls, invisible fences, the rail - on the same
  // rule. MISC_ is not among them: PREP has no branch for it, so those 23
  // models are scenery and stay drawn and inert.
  const solids = parseSolidMesh(new Uint8Array(await (await fetch(TRACK_SOLIDS_URL)).arrayBuffer()));
  const solidColliders = new SegmentColliders(host, solids);

  // The level's trees and pickups. They are filed into the track before any
  // collider is built, because PropColliders reads the track it is given.
  const objects = parseTrackObjects(
    new Uint8Array(await (await fetch(TRACK_OBJECTS_URL)).arrayBuffer()),
  );
  const filed = populateTrack(track, objects);
  if (filed !== objects.length) {
    console.warn(`only ${filed} of ${objects.length} track objects could be filed`);
  }
  let solidSegment = 1;
  segmentColliders.setActive(solidSegment);
  solidColliders.setActive(solidSegment);


  // Solid props, one segment tangible at a time, as doM5ChangeSegment kept
  // them. Pickups get no collider: they are triggers, not blockers.
  const propColliders = new PropColliders(host, track);
  propColliders.setActive(solidSegment);

  // The start line is the original's own: carPos_Mach5, carried in the ground
  // data. prepareCar:146 drops the car onto the road from there; SPAWN_HEIGHT
  // stays the declared substitute, since the recovered +1 is measured from the
  // model origin and ours is the centre of mass.
  const road = track.castDown(vec3(ground.spawn.x, ground.spawn.y, ground.spawn.z), 60);
  const start = vec3(
    ground.spawn.x,
    ground.spawn.y,
    (road ? ground.spawn.z - road.distance : ground.spawn.z) + K.SPAWN_HEIGHT,
  );
  const chassis = new RapierChassis(rapier, host, start);
  const newWorld = (): World =>
    new World({
      seed: 0x5eed_1234,
      body: chassis,
      // The track is the ground probe: it knows segments, surfaces and seams.
      probe: track,
      track,
      stepPhysics: () => host.step(),
    });

  let world = newWorld();

  /**
   * Put the car back on the start line and begin again.
   *
   * The original has no in-place recovery: `doMach5:675` fades the sound and
   * does `go("CLIFF")`, a game-over frame. This is the restart that frame
   * leads to, and it exists because the real course has somewhere to fall off.
   */
  function restart(): void {
    chassis.respawn(start);
    world = newWorld();
    solidSegment = 1;
    segmentColliders.setActive(solidSegment);
    // Every prop comes back: the flag, the view and the collider. The
    // colliders were only disabled, never destroyed, which is what makes this
    // possible - destroying them left the next run driving through a wall it
    // could still see.
    for (const seg of track.segments) for (const prop of seg.props) prop.active = true;
    for (const view of propViews.values()) view.visible = true;
    propColliders.setActive(solidSegment);
    solidColliders.setActive(solidSegment);
  }

  const scene = createScene();

  // Prefer the model recovered from the game's own 3D world. The hand-built
  // one stays as a fallback rather than being deleted, so a missing or broken
  // GLB degrades to a drivable car instead of a blank screen.
  let car: VehicleView;
  try {
    const original = await OriginalMach5.load();
    const { missing, uprighted, centerOfMass } = original.report();
    if (missing.length) {
      console.warn('recovered model is missing nodes:', missing);
    }
    if (!uprighted) {
      console.warn(
        'SceneRoot not found in the GLB: the Y-up conversion was not cleared, ' +
          'so the car will render on its side.',
      );
    }
    if (centerOfMass.z === 0) {
      console.warn(
        'the collider hull gave no centre of mass: the body will ride high and ' +
          'its wheels will hang below it.',
      );
    }
    car = original;
  } catch (err) {
    console.warn('falling back to the hand-built car:', err);
    car = new Mach5();
  }
  scene.add(car.object);

  // The road itself. A missing or broken track model degrades to an empty
  // world you can still drive in, rather than a blank screen.
  let trackView: TrackView | null = null;
  try {
    const view = await TrackView.load();
    const { drawn, hidden, uprighted } = view.report();
    if (!uprighted) {
      console.warn(`track model drew ${drawn}, hid ${hidden}, uprighted ${uprighted}`);
    }
    scene.add(view.object);
    trackView = view;
  } catch (err) {
    console.warn('the track model did not load:', err);
  }
  // The props are drawn as the meshes they are, matched to the simulation's
  // props by position in the extractor's name-sorted list. The placeholder
  // boxes stay as the fallback for a missing or short model file.
  const propViews = new Map<number, THREE.Object3D>();
  const nodes = trackView?.objectNodes() ?? [];
  if (nodes.length === objects.length) {
    const props = track.segments.flatMap((seg) => seg.props);
    const byOrder = [...props].sort((a, b) => a.id - b.id);
    objects.forEach((_, i) => propViews.set(byOrder[i]!.id, nodes[i]!));
  } else {
    if (trackView) {
      console.warn(
        `the track model has ${nodes.length} object nodes for ${objects.length} objects; ` +
          'drawing placeholder boxes instead',
      );
    }
    for (const [id, view] of createPropViews(scene, track.segments)) propViews.set(id, view);
  }

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
  /** Eased steering for the front wheels. The original eased pWheelTurn by 0.2
   *  per update toward -1, 0 or 1; this is the same shape, frame-rate scaled. */
  let wheelTurn = 0;
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

    if (input.takeRestart()) restart();

    let stepped = 0;
    while (accumulator >= K.TICK_DT && stepped < MAX_CATCHUP_TICKS) {
      world.step({ ...input.state, gadgetPresses: presses });
      presses = [];
      accumulator -= K.TICK_DT;
      stepped++;
    }
    if (stepped === MAX_CATCHUP_TICKS) accumulator = 0;

    // `doM5ChangeSegment` toggled the solid segment as the car crossed; the
    // simulation already tracks which one it is in.
    if (world.race.segment !== solidSegment) {
      solidSegment = world.race.segment;
      segmentColliders.setActive(solidSegment);
      solidColliders.setActive(solidSegment);
      propColliders.setActive(solidSegment);
    }

    const v = world.vehicle;
    const r = world.race;

    wheelSpin += (v.forwardVel / K.WHEEL_RADIUS) * K.WHEEL_SPIN_COEFF * elapsed;

    const steerTarget = (input.state.right ? 1 : 0) - (input.state.left ? 1 : 0);
    wheelTurn += (steerTarget - wheelTurn) * Math.min(1, 6 * elapsed);
    car.update(chassis.position, chassis.forward, chassis.up, {
      forwardVel: v.forwardVel,
      grounded: v.grounded,
      jacksExtended: v.jacksExtended,
      bladesActive: v.gadgets.blades.active,
      gripActive: v.gadgets.grip.active,
      lightsActive: v.gadgets.lights.active,
      shieldActive: v.gadgets.deflector.active || v.gadgets.frogger.active,
      frogger: v.gadgets.frogger.active,
      robotLaunched: v.justActivated.includes('robot'),
      wheelSpin,
      hoverDistances: v.hoverDistances,
      wheelTurn,
    });
    chase.follow(chassis.position, chassis.forward, 1 - Math.exp(-8 * elapsed));

    // Consumed props disappear, and stop blocking. The simulation owns the
    // flag; the renderer and the physics world only follow it. The colliders
    // are disabled rather than destroyed, so a restart can hand them back.
    // The active segment's props, consumed or not - `collidableProps` filters
    // the consumed ones out, which is right for collision and wrong here: a
    // prop whose view is never revisited stays on screen after it is taken.
    for (const prop of track.segment(solidSegment)?.props ?? []) {
      const view = propViews.get(prop.id);
      if (view) view.visible = prop.active;
    }
    propColliders.sync();

    // The scenery that moves: the water's slosh and the skydome riding with
    // the camera. Per rendered frame, not per tick - nothing in it feeds back
    // into the simulation.
    trackView?.update(chase.camera.position);

    renderer.render(scene, chase.camera);

    const surface = v.surface.inferredName;
    const outcome =
      r.outcome === 'running' ? '' : `   — ${r.outcome.toUpperCase()}, press R to restart`;

    const gadgetLine = GADGETS.map((g) => {
      const st = v.gadgets[g.id];
      if (!st.active) return `${g.label.toLowerCase()} ·`;
      const left = g.ticks === null ? '' : ` ${st.remaining.toFixed(1)}s`;
      return `[${g.label.toUpperCase()}${left}]`;
    }).join('  ');

    hud.textContent =
      `speed ${v.forwardVel.toFixed(1)} / ${K.MAX_SPEED}` +
      `   wheels ${v.grounded.filter(Boolean).length}/4` +
      `   segment ${r.segment}/${ground.segmentCount}` +
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
