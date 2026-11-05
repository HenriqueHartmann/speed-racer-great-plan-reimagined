/**
 * A blocked-out Mach 5, and its gadget hardware.
 *
 * This is **our own geometry**, built from reference images rather than from the
 * original's meshes - those live in the undecoded W3D worlds. The proportions
 * are not invented though: track width, wheelbase and wheel radius are
 * recovered constants, so the car is the right size even where the shape is an
 * approximation.
 *
 * The hull is a lofted profile rather than an assembly of boxes and cones. The
 * first attempt used primitives and grew grey spikes where the cones were
 * mis-rotated; a loft gives direct control over the silhouette.
 *
 * Gadget hardware follows what the car actually does in the show:
 *
 *   Blades      two serrated discs on arms, out from under the nose, nearly
 *               flat and close to the ground
 *   Grip        brown segmented pads over the tyres
 *   Deflector   the cockpit canopy closing over an open-top car
 *   Frogger     the same canopy, plus the periscope mast
 *   Lights      real spotlights in the nose, not translucent cones
 *   Jacks       four long poles with feet, lifting the car clear
 *   Robot       a bird-shaped drone that rises out of a hood hatch
 *
 * Local axes follow the simulation: +X right, +Y forward, +Z up.
 */

import * as THREE from 'three';
import * as K from '../sim/constants.js';
import type { Vec3 } from '../sim/vehicle.js';
import { applyChassisOrientation } from './scene.js';
import type { VehicleView, VehicleViewState } from './scene.js';
import { loftHull, type HullSection } from './hull.js';

const WHITE = 0xf3f3f0;
const RED = 0xc81d1d;
const YELLOW = 0xeec23a;
const TYRE = 0x16161a;
const CHROME = 0xc6ced4;
/** Brown, as the high-grip tyres read in the original. */
const GRIP_PAD = 0x6b4426;
const WING = 0xb3abd6;

const HALF_WIDTH = K.TRACK_WIDTH / 2;

/**
 * The physics chassis hovers its origin around 0.95 above the ground, because
 * the recovered suspension measures from wheel points at the centre of mass.
 * A car body drawn at that origin would float. This offset drops the model so
 * the wheels meet the road; it is presentation only and never feeds back.
 */
const VISUAL_Z_OFFSET = -0.52;

/** Tail to nose. Half-widths stay inside the track so the wheels show. */
const HULL: HullSection[] = [
  { y: -2.45, halfWidth: 0.10, zBottom: 0.08, zTop: 0.20 },
  { y: -2.10, halfWidth: 0.26, zBottom: 0.02, zTop: 0.36, squareness: 0.2 },
  { y: -1.60, halfWidth: 0.40, zBottom: -0.04, zTop: 0.50, squareness: 0.3 },
  { y: -1.05, halfWidth: 0.46, zBottom: -0.08, zTop: 0.58, squareness: 0.35 },
  { y: -0.50, halfWidth: 0.47, zBottom: -0.10, zTop: 0.54, squareness: 0.35 },
  { y: 0.05, halfWidth: 0.47, zBottom: -0.10, zTop: 0.40, squareness: 0.3 },
  { y: 0.65, halfWidth: 0.46, zBottom: -0.10, zTop: 0.36, squareness: 0.28 },
  { y: 1.30, halfWidth: 0.43, zBottom: -0.08, zTop: 0.33, squareness: 0.22 },
  { y: 1.95, halfWidth: 0.37, zBottom: -0.05, zTop: 0.28, squareness: 0.16 },
  { y: 2.55, halfWidth: 0.26, zBottom: -0.01, zTop: 0.21, squareness: 0.1 },
  { y: 3.10, halfWidth: 0.13, zBottom: 0.03, zTop: 0.15 },
  { y: 3.45, halfWidth: 0.03, zBottom: 0.06, zTop: 0.11 },
];

/**
 * The wheel pods.
 *
 * These are what the earlier model was missing, and why it read as a slab with
 * wheels bolted on. On the real car the width comes from four rounded pods
 * standing out from a slim fuselage - the front pair drawn forward into points
 * that reach past the nose, the rear pair carrying the swept fins.
 */
const POD_HALF_WIDTH = HALF_WIDTH + 0.12;

export class Mach5 implements VehicleView {
  readonly object = new THREE.Group();

  /** Everything hangs off this, offset so the wheels meet the road. */
  private readonly root = new THREE.Group();

  private readonly wheels: THREE.Group[] = [];
  private readonly gripPads: THREE.Group[] = [];
  private readonly jackPoles = new THREE.Group();
  private readonly bladeUnits = new THREE.Group();
  private readonly bladeDiscs: THREE.Mesh[] = [];
  private readonly canopy: THREE.Mesh;
  private readonly periscope = new THREE.Group();
  private readonly lamps = new THREE.Group();
  private readonly spots: THREE.SpotLight[] = [];
  private readonly robot = new THREE.Group();
  private readonly hatch: THREE.Mesh;

  private canopyOpen = 1;
  private periscopeUp = 0;
  private bladeOut = 0;
  private jackDrop = 0;
  private robotFlight = -1;

  constructor() {
    this.root.position.z = VISUAL_Z_OFFSET;
    this.object.add(this.root);

    this.buildHull();
    this.buildMarkings();
    this.buildWheels();
    this.buildJacks();
    this.buildBlades();

    this.canopy = this.buildCanopy();
    this.root.add(this.canopy);

    this.buildPeriscope();
    this.buildLights();
    this.hatch = this.buildHatch();
    this.buildRobot();
  }

  // -- body -----------------------------------------------------------------

  private buildHull(): void {
    const shell = new THREE.MeshStandardMaterial({
      color: WHITE,
      roughness: 0.25,
      metalness: 0.1,
    });
    const hull = new THREE.Mesh(loftHull(HULL, 20), shell);
    hull.castShadow = true;
    hull.receiveShadow = true;
    this.root.add(hull);

    // Cockpit recess: the car is open-top until the canopy closes.
    const well = new THREE.Mesh(
      new THREE.BoxGeometry(0.78, 1.15, 0.3),
      new THREE.MeshStandardMaterial({ color: 0x1b242e, roughness: 0.95 }),
    );
    well.position.set(0, 0.0, 0.38);
    this.root.add(well);

    // Headrest fairing behind the cockpit.
    const fairing = new THREE.Mesh(
      new THREE.SphereGeometry(0.3, 14, 10),
      shell,
    );
    fairing.scale.set(0.9, 1.5, 0.8);
    fairing.position.set(0, -0.85, 0.52);
    this.root.add(fairing);

    this.buildPods(shell);
  }

  /** Four rounded wheel pods, forward spears and the swept rear fins. */
  private buildPods(shell: THREE.Material): void {
    // Front pods, drawn out into points that reach ahead of the nose.
    for (const sign of [-1, 1]) {
      const pod = new THREE.Mesh(new THREE.SphereGeometry(1, 18, 12), shell);
      pod.scale.set(0.33, 1.15, 0.34);
      pod.position.set(sign * POD_HALF_WIDTH, K.WHEELBASE_FRONT + 0.1, 0.1);
      pod.castShadow = true;
      this.root.add(pod);

      // ConeGeometry's axis is +Y, which is already forward. Rotating it was
      // what turned these into rockets pointing at the sky.
      const spear = new THREE.Mesh(new THREE.ConeGeometry(0.3, 2.3, 14), shell);
      spear.scale.set(1, 1, 0.42);
      spear.position.set(sign * POD_HALF_WIDTH, K.WHEELBASE_FRONT + 1.5, 0.04);
      spear.castShadow = true;
      this.root.add(spear);

      // Rear pods.
      const rear = new THREE.Mesh(new THREE.SphereGeometry(1, 18, 12), shell);
      rear.scale.set(0.34, 1.0, 0.36);
      rear.position.set(sign * POD_HALF_WIDTH, -K.WHEELBASE_REAR, 0.12);
      rear.castShadow = true;
      this.root.add(rear);

      // The long swept fin trailing off each rear pod, pointed at the tip.
      // Tip pointing backwards: a half turn about X, not a quarter.
      const fin = new THREE.Mesh(new THREE.ConeGeometry(0.26, 2.0, 12), shell);
      fin.rotation.x = Math.PI;
      fin.scale.set(1, 1, 0.5);
      fin.position.set(sign * (POD_HALF_WIDTH + 0.04), -K.WHEELBASE_REAR - 1.3, 0.16);
      fin.castShadow = true;
      this.root.add(fin);

      // A thin blade joining pod to fin, so the silhouette reads as one piece.
      const web = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.5, 0.42), shell);
      web.position.set(sign * POD_HALF_WIDTH, -K.WHEELBASE_REAR - 0.75, 0.14);
      this.root.add(web);
    }
  }

  private buildMarkings(): void {
    const redMat = new THREE.MeshStandardMaterial({ color: RED, roughness: 0.35 });

    // The red marking is a long lightning stripe running the length of the
    // hood, flaring at the shoulders - not the small chevron this had before.
    const bolt = new THREE.Shape();
    bolt.moveTo(0.05, 2.5);
    bolt.lineTo(0.34, 1.1);
    bolt.lineTo(0.16, 1.1);
    bolt.lineTo(0.44, -0.2);
    bolt.lineTo(0.2, -0.2);
    bolt.lineTo(0.3, -1.5);
    bolt.lineTo(0.06, -0.3);
    bolt.lineTo(0.22, -0.3);
    bolt.lineTo(-0.02, 1.0);
    bolt.lineTo(0.14, 1.0);
    bolt.closePath();
    const boltGeom = new THREE.ExtrudeGeometry(bolt, {
      depth: 0.015,
      bevelEnabled: false,
    });
    for (const sign of [-1, 1]) {
      const stripe = new THREE.Mesh(boltGeom, redMat);
      stripe.position.set(sign * 0.02, 0, 0.42);
      stripe.scale.x = sign;
      this.root.add(stripe);
    }

    // Yellow under-nose wedge and tail accents.
    const yellowMat = new THREE.MeshStandardMaterial({
      color: YELLOW,
      roughness: 0.4,
    });
    // Yellow tips on the forward spears, as on the reference.
    for (const sign of [-1, 1]) {
      const tip = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.42, 12), yellowMat);
      tip.scale.set(1, 1, 0.45);
      tip.position.set(sign * POD_HALF_WIDTH, K.WHEELBASE_FRONT + 2.5, 0.04);
      this.root.add(tip);
    }

    // The "5" roundel on each flank.
    const roundel = makeRoundelTexture();
    for (const sign of [-1, 1]) {
      const badge = new THREE.Mesh(
        new THREE.PlaneGeometry(0.42, 0.42),
        new THREE.MeshBasicMaterial({ map: roundel, transparent: true }),
      );
      badge.position.set(sign * 0.49, -0.45, 0.3);
      badge.rotation.y = sign * Math.PI / 2;
      badge.rotation.z = sign * Math.PI / 2;
      this.root.add(badge);
    }
  }

  private buildWheels(): void {
    const tyreGeom = new THREE.CylinderGeometry(
      K.WHEEL_RADIUS,
      K.WHEEL_RADIUS,
      0.3,
      22,
    );
    tyreGeom.rotateZ(Math.PI / 2);
    const tyreMat = new THREE.MeshStandardMaterial({ color: TYRE, roughness: 0.95 });
    const hubMat = new THREE.MeshStandardMaterial({
      color: CHROME,
      metalness: 0.7,
      roughness: 0.28,
    });
    const padMat = new THREE.MeshStandardMaterial({
      color: GRIP_PAD,
      roughness: 0.85,
    });
    const padGeom = new THREE.BoxGeometry(0.34, 0.17, 0.13);

    for (const y of [K.WHEELBASE_FRONT, -K.WHEELBASE_REAR]) {
      for (const x of [-HALF_WIDTH, HALF_WIDTH]) {
        const wheel = new THREE.Group();
        wheel.position.set(x, y, 0.0);

        const tyre = new THREE.Mesh(tyreGeom, tyreMat);
        tyre.castShadow = true;
        wheel.add(tyre);

        const hub = new THREE.Mesh(
          new THREE.CylinderGeometry(
            K.WHEEL_RADIUS * 0.5,
            K.WHEEL_RADIUS * 0.5,
            0.33,
            16,
          ),
          hubMat,
        );
        hub.rotation.z = Math.PI / 2;
        wheel.add(hub);

        const pads = new THREE.Group();
        for (let i = 0; i < 14; i++) {
          const a = (i / 14) * Math.PI * 2;
          const pad = new THREE.Mesh(padGeom, padMat);
          const r = K.WHEEL_RADIUS + 0.06;
          pad.position.set(0, Math.cos(a) * r, Math.sin(a) * r);
          pad.rotation.x = -a;
          pads.add(pad);
        }
        pads.visible = false;
        this.gripPads.push(pads);
        wheel.add(pads);

        this.wheels.push(wheel);
        this.root.add(wheel);
      }
    }
  }

  // -- gadget hardware ------------------------------------------------------

  private buildJacks(): void {
    const poleMat = new THREE.MeshStandardMaterial({
      color: CHROME,
      metalness: 0.75,
      roughness: 0.3,
    });
    const footMat = new THREE.MeshStandardMaterial({
      color: 0xb6bcc1,
      metalness: 0.4,
      roughness: 0.55,
    });

    const length = 2.4;
    for (const y of [K.WHEELBASE_FRONT * 0.8, -K.WHEELBASE_REAR * 0.8]) {
      for (const x of [-HALF_WIDTH * 0.62, HALF_WIDTH * 0.62]) {
        const leg = new THREE.Group();
        leg.position.set(x, y, 0);

        const pole = new THREE.Mesh(
          new THREE.CylinderGeometry(0.05, 0.05, length, 10),
          poleMat,
        );
        pole.rotation.x = Math.PI / 2;
        pole.position.z = -length / 2;
        leg.add(pole);

        const foot = new THREE.Mesh(
          new THREE.CylinderGeometry(0.18, 0.2, 0.06, 14),
          footMat,
        );
        foot.rotation.x = Math.PI / 2;
        foot.position.z = -length;
        leg.add(foot);

        this.jackPoles.add(leg);
      }
    }
    this.jackPoles.visible = false;
    this.root.add(this.jackPoles);
  }

  private buildBlades(): void {
    const armMat = new THREE.MeshStandardMaterial({
      color: CHROME,
      metalness: 0.8,
      roughness: 0.25,
    });
    const discMat = new THREE.MeshStandardMaterial({
      color: 0xbfc6cc,
      metalness: 0.85,
      roughness: 0.2,
      side: THREE.DoubleSide,
    });

    // The disc lies flat with its axis up, so spinning it about Z turns it in
    // its own plane.
    const plateGeom = new THREE.CylinderGeometry(0.5, 0.5, 0.035, 30);
    plateGeom.rotateX(Math.PI / 2);
    const toothGeom = new THREE.BoxGeometry(0.07, 0.1, 0.035);

    for (const sign of [-1, 1]) {
      const unit = new THREE.Group();
      unit.position.set(sign * 0.45, 1.7, -0.05);

      const arm = new THREE.Mesh(
        new THREE.CylinderGeometry(0.05, 0.05, 1.5, 8),
        armMat,
      );
      // Angled forward, outward and down, from under the front of the car.
      arm.rotation.set(-Math.PI / 2.6, 0, sign * -0.34);
      arm.position.set(sign * 0.26, 0.58, -0.3);
      unit.add(arm);

      const tilt = new THREE.Group();
      tilt.position.set(sign * 0.52, 1.14, -0.58);
      tilt.rotation.x = -0.28;

      const disc = new THREE.Mesh(plateGeom, discMat);
      for (let i = 0; i < 30; i++) {
        const a = (i / 30) * Math.PI * 2;
        const tooth = new THREE.Mesh(toothGeom, discMat);
        tooth.position.set(Math.cos(a) * 0.53, Math.sin(a) * 0.53, 0);
        tooth.rotation.z = a;
        disc.add(tooth);
      }
      tilt.add(disc);
      this.bladeDiscs.push(disc);

      unit.add(tilt);
      this.bladeUnits.add(unit);
    }

    this.bladeUnits.visible = false;
    this.root.add(this.bladeUnits);
  }

  private buildCanopy(): THREE.Mesh {
    const geom = new THREE.SphereGeometry(1, 26, 16, 0, Math.PI * 2, 0, Math.PI / 2);
    geom.scale(0.64, 1.35, 0.42);
    const mesh = new THREE.Mesh(
      geom,
      new THREE.MeshPhysicalMaterial({
        color: 0xe4f3ff,
        transparent: true,
        opacity: 0.34,
        roughness: 0.04,
        metalness: 0,
        transmission: 0.7,
        side: THREE.DoubleSide,
      }),
    );
    mesh.position.set(0, 0.05, 0.36);
    mesh.visible = false;
    return mesh;
  }

  private buildPeriscope(): void {
    const mast = new THREE.Mesh(
      new THREE.CylinderGeometry(0.04, 0.04, 2.0, 10),
      new THREE.MeshStandardMaterial({
        color: 0xe6e6e6,
        metalness: 0.5,
        roughness: 0.4,
      }),
    );
    mast.rotation.x = Math.PI / 2;
    mast.position.z = 1.0;
    this.periscope.add(mast);

    const headGeom = new THREE.SphereGeometry(0.17, 14, 10);
    headGeom.scale(1, 1.8, 0.8);
    const head = new THREE.Mesh(
      headGeom,
      new THREE.MeshStandardMaterial({ color: WHITE, roughness: 0.4 }),
    );
    head.position.set(0, 0.05, 2.02);
    this.periscope.add(head);

    const capGeom = new THREE.SphereGeometry(0.175, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2);
    capGeom.scale(1, 1.8, 0.8);
    const cap = new THREE.Mesh(
      capGeom,
      new THREE.MeshStandardMaterial({ color: RED, roughness: 0.4 }),
    );
    cap.position.set(0, 0.05, 2.02);
    this.periscope.add(cap);

    this.periscope.position.set(0, -0.6, 0.45);
    this.periscope.visible = false;
    this.root.add(this.periscope);
  }

  private buildLights(): void {
    const lampMat = new THREE.MeshStandardMaterial({
      color: 0xfff7d6,
      emissive: 0xffeaa8,
      emissiveIntensity: 2,
    });

    for (const sign of [-1, 1]) {
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.11, 12, 10), lampMat);
      lamp.position.set(sign * 0.3, 2.35, 0.17);
      this.lamps.add(lamp);

      // A real light, so the road ahead is lit instead of a translucent cone
      // floating in front of the car.
      const spot = new THREE.SpotLight(0xfff1c4, 0, 46, Math.PI / 7, 0.45, 1.1);
      spot.position.set(sign * 0.3, 2.4, 0.2);
      spot.target.position.set(sign * 0.3, 20, -1.2);
      this.spots.push(spot);
      this.lamps.add(spot);
      this.lamps.add(spot.target);
    }

    this.lamps.visible = false;
    this.root.add(this.lamps);
  }

  private buildHatch(): THREE.Mesh {
    const hatch = new THREE.Mesh(
      new THREE.BoxGeometry(0.34, 0.5, 0.03),
      new THREE.MeshStandardMaterial({ color: 0x20262c, roughness: 0.8 }),
    );
    hatch.position.set(0, 1.0, 0.39);
    this.root.add(hatch);
    return hatch;
  }

  /** The homing robot is a bird: white body, long beak, swept wings, forked tail. */
  private buildRobot(): void {
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0xf6f6f4, roughness: 0.35 });
    const wingMat = new THREE.MeshStandardMaterial({
      color: WING,
      roughness: 0.4,
      side: THREE.DoubleSide,
    });

    const body = new THREE.Mesh(new THREE.SphereGeometry(0.16, 16, 12), bodyMat);
    body.scale.set(1, 2.6, 1);
    this.robot.add(body);

    const beak = new THREE.Mesh(new THREE.ConeGeometry(0.055, 0.42, 10), bodyMat);
    beak.position.y = 0.55;
    this.robot.add(beak);

    const collar = new THREE.Mesh(
      new THREE.TorusGeometry(0.14, 0.03, 8, 18),
      new THREE.MeshStandardMaterial({ color: YELLOW, roughness: 0.4 }),
    );
    collar.rotation.x = Math.PI / 2;
    collar.position.y = 0.22;
    this.robot.add(collar);

    const eyeMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a });
    for (const sign of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.028, 8, 6), eyeMat);
      eye.position.set(sign * 0.1, 0.33, 0.05);
      this.robot.add(eye);
    }

    // Wings: swept back and out, as in the show.
    const wingShape = new THREE.Shape();
    wingShape.moveTo(0, 0.1);
    wingShape.lineTo(0.72, -0.5);
    wingShape.lineTo(0.5, -0.56);
    wingShape.lineTo(0.08, -0.2);
    wingShape.closePath();
    const wingGeom = new THREE.ExtrudeGeometry(wingShape, {
      depth: 0.02,
      bevelEnabled: false,
    });
    for (const sign of [-1, 1]) {
      const wing = new THREE.Mesh(wingGeom, wingMat);
      wing.rotation.x = -Math.PI / 2;
      wing.position.set(sign * 0.08, 0.05, 0);
      wing.scale.x = sign;
      this.robot.add(wing);
    }

    // Forked tail.
    const tailShape = new THREE.Shape();
    tailShape.moveTo(0, 0);
    tailShape.lineTo(0.3, -0.52);
    tailShape.lineTo(0.14, -0.5);
    tailShape.lineTo(0.02, -0.18);
    tailShape.closePath();
    const tailGeom = new THREE.ExtrudeGeometry(tailShape, {
      depth: 0.02,
      bevelEnabled: false,
    });
    for (const sign of [-1, 1]) {
      const tail = new THREE.Mesh(tailGeom, wingMat);
      tail.rotation.x = -Math.PI / 2;
      tail.position.set(sign * 0.03, -0.34, 0);
      tail.scale.x = sign;
      this.robot.add(tail);
    }

    this.robot.visible = false;
    this.root.add(this.robot);
  }

  // -- per-frame ------------------------------------------------------------

  update(position: Vec3, forward: Vec3, up: Vec3, state: VehicleViewState): void {
    applyChassisOrientation(this.object, position, forward, up);

    for (const wheel of this.wheels) wheel.rotation.x = state.wheelSpin;
    // The fallback car's wheels are authored in place, so it ignores the
    // suspension distances the recovered model needs.
    void state.hoverDistances;
    void state.wheelTurn;
    for (const pads of this.gripPads) pads.visible = state.gripActive;

    this.updateJacks(state);
    this.updateBlades(state);
    this.updateCanopy(state);
    this.updateLights(state);
    this.updateRobot(state);
  }

  private updateJacks(state: VehicleViewState): void {
    const target = state.jacksExtended ? 1 : 0;
    this.jackDrop += (target - this.jackDrop) * 0.3;
    this.jackPoles.visible = this.jackDrop > 0.02;
    // Slide the poles down rather than scaling them, so the feet stay flat.
    for (const leg of this.jackPoles.children) {
      leg.position.z = -2.4 * (1 - this.jackDrop);
    }
  }

  private updateBlades(state: VehicleViewState): void {
    const target = state.bladesActive ? 1 : 0;
    this.bladeOut += (target - this.bladeOut) * 0.22;
    this.bladeUnits.visible = this.bladeOut > 0.03;

    // Telescope outward and forward by moving each unit, not by scaling the
    // group - scaling pulled the discs back into the body.
    for (let i = 0; i < this.bladeUnits.children.length; i++) {
      const unit = this.bladeUnits.children[i]!;
      const sign = i === 0 ? -1 : 1;
      unit.position.set(sign * 0.45, 1.7 - (1 - this.bladeOut) * 0.9, -0.05);
      unit.scale.setScalar(0.35 + 0.65 * this.bladeOut);
    }

    if (state.bladesActive) {
      for (const disc of this.bladeDiscs) disc.rotation.z += 0.8;
    }
  }

  private updateCanopy(state: VehicleViewState): void {
    const target = state.shieldActive ? 0 : 1;
    this.canopyOpen += (target - this.canopyOpen) * 0.16;
    this.canopy.visible = this.canopyOpen < 0.96;
    // Slides back and lifts away when open.
    this.canopy.position.y = 0.05 - this.canopyOpen * 1.9;
    this.canopy.position.z = 0.36 + this.canopyOpen * 0.5;

    const periTarget = state.frogger ? 1 : 0;
    this.periscopeUp += (periTarget - this.periscopeUp) * 0.14;
    this.periscope.visible = this.periscopeUp > 0.03;
    this.periscope.scale.z = Math.max(0.03, this.periscopeUp);
  }

  private updateLights(state: VehicleViewState): void {
    this.lamps.visible = state.lightsActive;
    for (const spot of this.spots) spot.intensity = state.lightsActive ? 260 : 0;
  }

  private updateRobot(state: VehicleViewState): void {
    if (state.robotLaunched && this.robotFlight < 0) this.robotFlight = 0;

    if (this.robotFlight < 0) {
      this.robot.visible = false;
      this.hatch.rotation.x = 0;
      this.hatch.position.set(0, 1.0, 0.39);
      return;
    }

    this.robotFlight += 0.022;
    if (this.robotFlight > 1) {
      this.robotFlight = -1;
      return;
    }

    const t = this.robotFlight;
    this.robot.visible = true;

    // The hatch swings open while the bird is coming out, then closes.
    const open = Math.min(1, t / 0.18) * (t > 0.6 ? Math.max(0, (1 - t) / 0.4) : 1);
    this.hatch.rotation.x = -open * 1.2;
    this.hatch.position.y = 1.0 + open * 0.16;

    // Rises out of the hood, then climbs away forward.
    if (t < 0.2) {
      const k = t / 0.2;
      this.robot.position.set(0, 1.05, 0.3 + k * 0.75);
      this.robot.rotation.set(-1.1 + k * 0.5, 0, 0);
    } else {
      const k = (t - 0.2) / 0.8;
      this.robot.position.set(0, 1.05 + k * 30, 1.05 + Math.sin(k * 1.4) * 4.5);
      this.robot.rotation.set(-0.6 + k * 0.5, 0, Math.sin(k * 9) * 0.25);
    }
  }
}

/** The yellow "5" roundel, drawn to a canvas so it can sit on the flanks. */
function makeRoundelTexture(): THREE.CanvasTexture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.clearRect(0, 0, size, size);
    ctx.fillStyle = '#eec23a';
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size * 0.46, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#c81d1d';
    ctx.font = `bold ${size * 0.68}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('5', size / 2, size * 0.54);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}
