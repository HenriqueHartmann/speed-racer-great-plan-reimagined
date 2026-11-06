/**
 * The field of rivals, and the place counter.
 *
 * `PREP:49-52` sets `enemiesRemaining = 19` while `enemyPositionsList` has
 * three slots, and `PREP:459-466` drives the whole field with `sendSprite(2,
 * ...)` - sprite 2 carrying the Mach 5's behaviour and three `doEnemy`
 * instances. So the original never has nineteen cars on the track. It has
 * three, recycled nineteen times: a rival that falls 40 units behind the
 * player, or out of the world, is teleported in front of the leader with a
 * fresh skin and no damage, and the player climbs from twentieth by passing
 * the same three over and over.
 *
 * That teleport crosses the player in Y without being an overtake, and the
 * original guards it with `pIsJumping` (`doEnemy:845`, read at `:831`). It is
 * the single most load-bearing flag in the race bookkeeping.
 */

import * as K from './constants.js';
import { Rng, substream } from './rng.js';
import { bearingDeg } from './rival-steering.js';
import { waypoint, type TrackPath } from './track-path.js';
import {
  createRivalState,
  stepRival,
  targetSpeed,
  type RivalBody,
  type RivalState,
} from './rival.js';
import { vec3, type GroundProbe, type Vec3 } from './vehicle.js';

/** One of the three concurrent cars. */
export interface RivalRuntime {
  readonly index: number;
  readonly state: RivalState;
  readonly body: RivalBody;
  /** `isBehind` - the hysteresis that stops a car level with the player ratcheting. */
  behind: boolean;
  /** `pSmartEnemy` - cleared when another rival rear-ends this one. */
  smart: boolean;
  /** `pSmartTIMER`, in our ticks. */
  smartUntil: number;
  /** Its own random stream, so one car's draws cannot move another's. */
  readonly rng: Rng;
}

export interface RaceFieldOptions {
  readonly path: TrackPath;
  readonly probe: GroundProbe;
  readonly seed: number;
  readonly bodies: readonly RivalBody[];
  /** `pStartingPathStep` per car. SUBSTITUTE: see the note on `starts` below. */
  readonly starts: readonly number[];
}

export class RaceField {
  readonly rivals: RivalRuntime[] = [];
  /** `gPosition`. The player starts behind the whole field. */
  position = K.RIVAL_FIELD_SIZE + 1;
  /** `enemiesRemaining`. Counts down by one on every recycle. */
  enemiesRemaining = K.RIVAL_FIELD_SIZE;
  /** `enemiesFinished`. A car that runs off the end of the line. */
  enemiesFinished = 0;

  private tick = 0;

  constructor(private readonly opts: RaceFieldOptions) {
    const { bodies, starts, seed } = opts;
    if (bodies.length !== starts.length) {
      throw new Error(`${bodies.length} bodies against ${starts.length} starting steps`);
    }
    bodies.forEach((body, index) => {
      this.rivals.push({
        index,
        state: createRivalState(starts[index]!),
        body,
        behind: false,
        smart: true,
        smartUntil: 0,
        // Index 0 is the player's, so the rivals take 1 upward - see
        // `substream`'s note on why they are not allowed to share.
        rng: substream(seed, index + 1),
      });
    });
  }

  /**
   * Advance every rival by one tick.
   *
   * Order within the tick, and it is a SUBSTITUTE: the original's is the
   * sprite order in the binary score and is not recoverable. Here every rival
   * is driven in index order against the same player position, so no rival can
   * see another's same-tick result and the order cannot become load-bearing
   * without a test noticing.
   */
  step(playerPosition: Vec3, playerTopSpeed: number): void {
    for (const rival of this.rivals) {
      if (!rival.state.alive) continue;

      this.setSpeed(rival, playerPosition, playerTopSpeed);
      stepRival(rival.state, rival.body, this.opts.probe, this.opts.path);
      if (!rival.state.alive) {
        // It ran off the end of the racing line. `doEnemy:428-443`.
        this.enemiesFinished += 1;
        continue;
      }

      this.updatePlace(rival, playerPosition);
      this.recycleIfLost(rival, playerPosition);
    }
    this.tick += 1;
  }

  /**
   * `doEnemy:780-805`. The rubber band, as multiples of the player's own top
   * speed. The cornering factor is applied in `rival.ts`, where the throttle
   * that it modifies lives.
   */
  private setSpeed(rival: RivalRuntime, player: Vec3, playerTopSpeed: number): void {
    const offset = rival.body.position.y - player.y;

    if (!rival.smart) {
      rival.state.maxSpeed = playerTopSpeed * K.RIVAL_SPEED_MIN;
      return;
    }

    if (offset < 1) {
      // Newly ahead: roll a fresh window to hold the player off.
      if (rival.smartUntil <= this.tick) {
        const spread = rival.rng.nextInt(K.RIVAL_SMART_WINDOW_SPREAD_TICKS);
        const frames = K.RIVAL_SMART_WINDOW_BASE_TICKS + spread;
        rival.smartUntil = this.tick + Math.round(
          (frames / K.DIRECTOR_TICKS_PER_SECOND) / K.TICK_DT,
        );
      }
      rival.state.maxSpeed = playerTopSpeed * K.RIVAL_SPEED_TOP;
      return;
    }

    rival.state.maxSpeed = playerTopSpeed * K.RIVAL_SPEED_REGULAR;
    rival.smartUntil = 0;
  }

  /**
   * `doEnemy:823-844`. One place changes hands on each crossing of the
   * player's Y, in either direction. `isBehind` is the hysteresis: a car
   * hovering at the player's shoulder costs one place, not one per tick.
   *
   * The test is `tYOffset < 0`, strictly, so a car exactly level is ahead.
   */
  private updatePlace(rival: RivalRuntime, player: Vec3): void {
    const behind = rival.body.position.y - player.y < 0;

    if (behind) {
      if (!rival.behind) this.position = Math.max(1, this.position - 1);
      rival.behind = true;
    } else if (rival.behind) {
      this.position = Math.min(K.RIVAL_FIELD_SIZE + 1, this.position + 1);
      rival.behind = false;
    }
  }

  /**
   * `doEnemy:846-860` and `doJump`. Forty units behind, or out of the world.
   *
   * ORDER, and it matters. This runs AFTER the place check, as the original
   * does - `doEnemy:845` clears `pIsJumping` and `:846` only then tests for a
   * lost car. Because the teleport lands after the check, clearing `behind`
   * here is enough: the crossing the teleport makes is never examined.
   *
   * The original ALSO carries `pIsJumping`, and it is not redundant there. It
   * guards the other caller: `explosionMODE = 5` (`doEnemy:656`) calls
   * `doJump` from inside the case statement, which runs BEFORE the place
   * check, so that recycle's crossing would be counted without it. There is
   * no explosion path here yet. When one arrives, the flag arrives with it -
   * it is not carried now, because an unreachable guard is one no test can
   * hold honest.
   */
  private recycleIfLost(rival: RivalRuntime, player: Vec3): void {
    const offset = rival.body.position.y - player.y;
    const lost = offset < -K.RIVAL_RECYCLE_BEHIND
      || rival.body.position.z < K.RIVAL_RECYCLE_FLOOR_Z;
    if (!lost) return;

    // `doJump:237-240`: a car recycled while still ahead counts as passed.
    if (!rival.behind) this.position = Math.max(1, this.position - 1);

    rival.state.damage = 0;
    rival.state.control = 'driving';
    rival.smart = true;
    rival.smartUntil = 0;

    const leader = Math.max(...this.rivals.map((r) => r.state.nextStep));
    const rejoinAt = leader + K.RIVAL_RECYCLE_LEAD;

    if (this.enemiesRemaining <= 0 || rejoinAt >= this.opts.path.count) {
      // Out of cars, or out of track. Either way this one is done.
      if (rejoinAt >= this.opts.path.count && this.enemiesRemaining > 0) {
        this.enemiesFinished += 1;
      }
      rival.state.alive = false;
      this.enemiesRemaining -= 1;
      return;
    }

    this.rejoin(rival, rejoinAt);
    rival.behind = false;
    this.enemiesRemaining -= 1;
  }

  /** `doJump:279-302`: drop onto the road at the rejoin point, facing the next. */
  private rejoin(rival: RivalRuntime, step: number): void {
    const here = waypoint(this.opts.path, step);
    const next = waypoint(this.opts.path, step + 1);

    // `doJump:290`: `point(x + (1 - random(2)), y + (1 - random(2)))`, which is
    // +1 or 0 under Lingo's 1-based `random`, so the jitter is one-sided.
    const jitterX = K.RIVAL_REJOIN_JITTER - rival.rng.nextInt(2);
    const jitterY = K.RIVAL_REJOIN_JITTER - rival.rng.nextInt(2);
    const aim = vec3(next.x + jitterX, next.y + jitterY, next.z);

    const from = vec3(here.x, here.y, here.z);
    const road = this.opts.probe.castDown(from, K.RIVAL_REJOIN_RAY);
    const at = road
      ? vec3(from.x, from.y, from.z - road.distance + K.RIVAL_PLACE_HEIGHT)
      : from;

    rival.body.respawn(at);
    // `doJump:293`: face the next waypoint. The chassis's local forward is +Y
    // and the original's rotation.z is the negated bearing, so the yaw is the
    // bearing itself about Z.
    const yaw = (bearingDeg(here.x, here.y, aim.x, aim.y) * Math.PI) / 180;
    const half = yaw / 2;
    rival.body.setRotation({ x: 0, y: 0, z: Math.sin(half), w: Math.cos(half) });

    rival.state.nextStep = step + 1;
  }
}

export { targetSpeed };
