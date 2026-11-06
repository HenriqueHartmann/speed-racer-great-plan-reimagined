/**
 * The field: three cars standing in for nineteen, and the place counter.
 *
 * `PREP:49-52` sets `enemiesRemaining = 19` and `enemyPositionsList = [0,0,0]`.
 * Three `doEnemy` instances are recycled nineteen times: a rival that falls 40
 * units behind the player, or out of the world, is teleported in front of the
 * leader with its damage cleared, and the player climbs from twentieth by
 * passing the same three over and over.
 *
 * Every assertion here is about the bookkeeping, not the driving, so the cars
 * are moved by hand. The trap the whole thing turns on is that a teleport
 * crosses the player in Y without being an overtake.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { parseTrackPath, waypoint } from '../src/sim/track-path.js';
import { parseGroundMesh } from '../src/sim/ground-mesh.js';
import { Track } from '../src/sim/track.js';
import { RaceField } from '../src/sim/race-field.js';
import { AnalyticBody } from '../src/sim/analytic-body.js';
import { vec3, type Vec3 } from '../src/sim/vehicle.js';
import * as K from '../src/sim/constants.js';

let path: ReturnType<typeof parseTrackPath>;
let probe: Track;
beforeAll(() => {
  path = parseTrackPath(readFileSync('public/models/track-path.bin'));
  probe = new Track({ ground: parseGroundMesh(readFileSync('public/models/track-ground.bin')) });
});

/** A body that can be teleported, which a recycled rival has to be. */
class TestBody extends AnalyticBody {
  respawn(p: Vec3): void {
    this.position = { ...p };
    this.linearVelocity = vec3();
    this.angularVelocity = vec3();
    this.yaw = 0;
  }
  setRotation(q: { x: number; y: number; z: number; w: number }): void {
    this.yaw = 2 * Math.atan2(q.z, q.w);
  }
}

function field(starts = [1, 3, 5]) {
  const bodies = starts.map((s) => {
    const at = waypoint(path, s);
    return new TestBody(K.RIVAL_MASS, vec3(at.x, at.y, at.z));
  });
  const f = new RaceField({ path, probe, seed: 0x5eed_1234, bodies, starts });
  return { f, bodies };
}

/** Advance the field one tick with the player parked where we say. */
function tick(f: RaceField, playerY: number, playerX = 0): void {
  f.step(vec3(playerX, playerY, 0), K.MAX_SPEED);
}

describe('RaceField', () => {
  it('starts the player twentieth, behind nineteen rivals', () => {
    const { f } = field();
    expect(f.enemiesRemaining).toBe(19);
    expect(f.position).toBe(20);
    expect(f.rivals.length).toBe(3);
  });

  it('files each rival under its own starting waypoint', () => {
    const { f } = field([1, 3, 5]);
    expect(f.rivals.map((r) => r.state.nextStep)).toEqual([2, 4, 6]);
  });

  it('counts the player past a rival it overtakes', () => {
    const { f, bodies } = field();
    bodies.forEach((b) => (b.position = vec3(0, 1000, 0)));
    tick(f, 900); // all three ahead
    const before = f.position;

    bodies[0]!.position = vec3(0, 800, 0); // the player is now past rival 0
    tick(f, 900);

    expect(f.position).toBe(before - 1);
  });

  it('counts a rival back past the player, both ways', () => {
    // The gap has to stay inside 40, or the rival is recycled rather than
    // merely passed, and a recycle deliberately costs nothing on the way back.
    const { f, bodies } = field();
    bodies.forEach((b) => (b.position = vec3(0, 1000, 0)));
    tick(f, 900);
    const before = f.position;

    bodies[0]!.position = vec3(0, 880, 0); // 20 behind: passed, not lost
    tick(f, 900);
    expect(f.position).toBe(before - 1);

    bodies[0]!.position = vec3(0, 920, 0); // it takes the place back
    tick(f, 900);
    expect(f.position).toBe(before);
  });

  it('treats a rival exactly level with the player as ahead', () => {
    // `doEnemy:823` tests `tYOffset < 0`, strictly. A car at the player's own
    // Y is not behind, so nothing changes hands - and it does not matter how
    // long it sits there.
    const { f, bodies } = field();
    bodies.forEach((b) => (b.position = vec3(0, 1000, 0)));
    tick(f, 900);
    const before = f.position;

    for (let i = 0; i < 50; i++) {
      bodies[0]!.position = vec3(0, 900, 0);
      tick(f, 900);
    }
    expect(f.position).toBe(before);
  });

  it('counts one place per crossing, however small the crossing', () => {
    // `isBehind` is the hysteresis. A car hovering either side of the player
    // by a thousandth of a unit must cost exactly one place each way, not one
    // per tick.
    const { f, bodies } = field();
    bodies.forEach((b) => (b.position = vec3(0, 1000, 0)));
    tick(f, 900);
    const before = f.position;

    for (let i = 0; i < 20; i++) {
      bodies[0]!.position = vec3(0, 900 - 0.001, 0);
      tick(f, 900);
    }
    expect(f.position).toBe(before - 1);

    for (let i = 0; i < 20; i++) {
      bodies[0]!.position = vec3(0, 900 + 0.001, 0);
      tick(f, 900);
    }
    expect(f.position).toBe(before);
  });

  it('recycles a rival that falls 40 units behind', () => {
    const { f, bodies } = field();
    bodies.forEach((b) => (b.position = vec3(0, 1000, 0)));
    tick(f, 900);
    const remaining = f.enemiesRemaining;

    bodies[0]!.position = vec3(0, 800, 0); // 100 behind
    tick(f, 900);

    expect(f.enemiesRemaining).toBe(remaining - 1);
    // `doJump:240` rejoins at `max(enemyPositionsList) + 2` - a place on the
    // RACING LINE, not a distance from the player. With starts of 1, 3 and 5
    // the leader is aiming at waypoint 6, so the car reappears at waypoint 8.
    const at = waypoint(path, 8);
    expect(bodies[0]!.position.x).toBeCloseTo(at.x, 0);
    expect(bodies[0]!.position.y).toBeCloseTo(at.y, 0);
  });

  it('recycles a rival that falls out of the world', () => {
    // `doEnemy:846`: `or (chassisPos.z < -30)`. The line runs over causeways
    // and a rival that misses one is gone without this.
    const { f, bodies } = field();
    bodies.forEach((b) => (b.position = vec3(0, 1000, 0)));
    tick(f, 900);
    const remaining = f.enemiesRemaining;

    bodies[0]!.position = vec3(0, 1000, -100); // still ahead, but fallen
    tick(f, 900);

    expect(f.enemiesRemaining).toBe(remaining - 1);
    expect(bodies[0]!.position.z).toBeGreaterThan(-30);
  });

  /** The invariant the whole design turns on. */
  it('never counts a teleport as an overtake', () => {
    // Put the player downstream of where a recycle will drop the car, so the
    // teleport really does cross the player's Y from behind to ahead. Without
    // `pIsJumping` that crossing would hand the player's place straight back.
    const { f, bodies } = field([1, 3, 5]);
    const rejoin = waypoint(path, 8);
    const playerY = rejoin.y - 20;

    bodies.forEach((b) => (b.position = vec3(0, playerY + 10, 0)));
    tick(f, playerY);

    bodies[0]!.position = vec3(0, playerY - 100, 0); // lost: passed, then recycled
    tick(f, playerY);
    const afterPass = f.position;

    // It is now ahead of the player again, by teleport rather than by racing.
    expect(bodies[0]!.position.y).toBeGreaterThan(playerY);
    for (let i = 0; i < 10; i++) tick(f, playerY);

    expect(f.position).toBe(afterPass);
  });

  it('clears a recycled rival s damage and puts it back in control', () => {
    const { f, bodies } = field();
    bodies.forEach((b) => (b.position = vec3(0, 1000, 0)));
    tick(f, 900);
    f.rivals[0]!.state.damage = 80;
    f.rivals[0]!.state.control = 'spun';

    bodies[0]!.position = vec3(0, 800, 0);
    tick(f, 900);

    expect(f.rivals[0]!.state.damage).toBe(0);
    expect(f.rivals[0]!.state.control).toBe('driving');
  });

  it('puts a recycled rival two steps past the leader', () => {
    // `doJump:240`: `nextStep = max(enemyPositionsList) + 2`.
    const { f, bodies } = field([1, 3, 5]);
    bodies.forEach((b) => (b.position = vec3(0, 1000, 0)));
    tick(f, 900);
    const leader = Math.max(...f.rivals.map((r) => r.state.nextStep));

    bodies[0]!.position = vec3(0, 800, 0);
    tick(f, 900);

    expect(f.rivals[0]!.state.nextStep).toBe(leader + 3);
  });

  it('keeps the place counter inside the field at all times', () => {
    const { f, bodies } = field();
    for (let i = 0; i < 400; i++) {
      // Shove the rivals back and forth across the player at random-ish.
      bodies.forEach((b, j) => {
        b.position = vec3(0, 1000 + ((i * (j + 7)) % 11) * 40 - 200, 0);
      });
      tick(f, 1000);
      expect(f.position).toBeGreaterThanOrEqual(1);
      expect(f.position).toBeLessThanOrEqual(20);
    }
  });

  it('stops recycling once the field is used up', () => {
    const { f, bodies } = field();
    bodies.forEach((b) => (b.position = vec3(0, 1000, 0)));
    tick(f, 900);

    for (let i = 0; i < 40 && f.rivals.some((r) => r.state.alive); i++) {
      bodies.forEach((b) => (b.position = vec3(0, 800, 0)));
      tick(f, 900);
      bodies.forEach((b) => (b.position = vec3(0, 1000, 0)));
      tick(f, 900);
    }

    expect(f.enemiesRemaining).toBeLessThanOrEqual(0);
    // Every ordinary car leaves; the Duggary does not. `doJump:247` removes
    // the car from the world only `if pCarBody.userData.isDuggary = 0`, and
    // the boss is still out there when the rest of the field has gone.
    const survivors = f.rivals.filter((r) => r.state.alive);
    expect(survivors.length).toBe(1);
    expect(survivors[0]!.duggary).toBe(true);
  });

  it('gives each rival its own random stream', () => {
    const { f } = field();
    const firsts = f.rivals.map((r) => r.rng.next());
    expect(new Set(firsts).size).toBe(3);
  });

  it('runs identically twice from the same seed', () => {
    const run = () => {
      const { f, bodies } = field();
      const out: string[] = [];
      for (let i = 0; i < 200; i++) {
        tick(f, 1000 + i * 2);
        out.push(JSON.stringify([
          f.position, f.enemiesRemaining,
          ...f.rivals.map((r) => [r.state.nextStep, r.state.alive, +r.state.maxSpeed.toFixed(6)]),
          ...bodies.map((b) => b.position.y.toFixed(6)),
        ]));
      }
      return out;
    };
    expect(run()).toEqual(run());
  });
});

describe('RaceField damage', () => {
  it('scores the player 1000 for a wreck, once', () => {
    const { f, bodies } = field();
    bodies.forEach((b) => (b.position = vec3(0, 1000, 0)));
    tick(f, 900);

    // 15 a hit, so the seventh is the one that finishes it.
    const r = f.rivals[0]!;
    for (let i = 0; i < 6; i++) {
      f.hit(r, { source: 'playerBlades', force: 0 }, vec3(0, 900, 0));
    }
    expect(f.killScore).toBe(0);
    expect(r.state.damage).toBe(90);

    f.hit(r, { source: 'playerBlades', force: 0 }, vec3(0, 900, 0));
    expect(f.killScore).toBe(K.RIVAL_KILL_SCORE);

    // And the wreck recycled it, so the next hit starts a fresh car's pool
    // rather than scoring again.
    f.hit(r, { source: 'playerBlades', force: 0 }, vec3(0, 900, 0));
    expect(f.killScore).toBe(K.RIVAL_KILL_SCORE);
    expect(r.state.damage).toBe(15);
  });

  it('recycles the car it just wrecked rather than leaving a hulk', () => {
    const { f, bodies } = field();
    bodies.forEach((b) => (b.position = vec3(0, 1000, 0)));
    tick(f, 900);
    const remaining = f.enemiesRemaining;

    const r = f.rivals[0]!;
    for (let i = 0; i < 7; i++) {
      f.hit(r, { source: 'playerBlades', force: 0 }, vec3(0, 900, 0));
    }

    expect(f.enemiesRemaining).toBe(remaining - 1);
    expect(r.state.damage).toBe(0);
    expect(r.state.mode).toBe('none');
    expect(r.state.alive).toBe(true);
  });

  it('takes a rear-ended rival off the top of the rubber band', () => {
    // `doEnemy:190`: `pSmartEnemy = 0`, and it stays off until a recycle.
    const { f, bodies } = field();
    bodies.forEach((b) => (b.position = vec3(0, 1000, 0)));
    tick(f, 900);
    const r = f.rivals[0]!;
    expect(r.smart).toBe(true);

    f.hit(r, { source: 'rival', force: 4, inFront: true }, vec3(0, 900, 0));
    expect(r.smart).toBe(false);

    tick(f, 900);
    expect(r.state.maxSpeed).toBeCloseTo(K.MAX_SPEED * K.RIVAL_SPEED_MIN, 6);
  });

  it('lets the Robot finish a rival with one nudge afterwards', () => {
    const { f, bodies } = field();
    bodies.forEach((b) => (b.position = vec3(0, 1000, 0)));
    tick(f, 900);
    const r = f.rivals[0]!;
    r.state.control = 'spun';

    f.hit(r, { source: 'player', force: 0 }, vec3(0, 900, 0));

    expect(f.killScore).toBe(K.RIVAL_KILL_SCORE);
  });

  it('ignores damage aimed at a car that has already left', () => {
    const { f } = field();
    const r = f.rivals[0]!;
    r.state.alive = false;
    f.hit(r, { source: 'playerBlades', force: 0 }, vec3(0, 900, 0));
    expect(r.state.damage).toBe(0);
    expect(f.killScore).toBe(0);
  });
});

describe('the Duggary', () => {
  /** Run the field down until the boss is promoted. */
  function promoted() {
    const { f, bodies } = field();
    bodies.forEach((b) => (b.position = vec3(0, 1000, 0)));
    tick(f, 900);
    while (f.enemiesRemaining > 1 && f.rivals.some((r) => r.state.alive)) {
      bodies.forEach((b) => (b.position = vec3(0, 800, 0)));
      tick(f, 900);
      bodies.forEach((b) => (b.position = vec3(0, 1000, 0)));
      tick(f, 900);
    }
    const boss = f.rivals.find((r) => r.duggary)!;
    return { f, bodies, boss };
  }

  it('is promoted when the field is down to its last car', () => {
    // `doJump:303-305`: `if (enemiesRemaining = 1) and (duggaryCreated = 0)`.
    const { f, boss } = promoted();
    expect(boss).toBeDefined();
    expect(f.rivals.filter((r) => r.duggary).length).toBe(1);
  });

  it('idles at four fifths until the player comes near', () => {
    const { f, bodies, boss } = promoted();
    boss.woken = false;
    bodies[boss.index]!.position = vec3(0, 2000, 0); // a long way ahead
    f.step(vec3(0, 900, 0), K.MAX_SPEED, K.MAX_SPEED);
    expect(boss.woken).toBe(false);
    expect(boss.state.maxSpeed).toBeCloseTo(K.MAX_SPEED * K.DUGGARY_SPEED_ASLEEP, 6);
  });

  it('wakes once the player closes to 30, and never sleeps again', () => {
    const { f, bodies, boss } = promoted();
    boss.woken = false;
    bodies[boss.index]!.position = vec3(0, 920, 0); // 20 ahead
    f.step(vec3(0, 900, 0), K.MAX_SPEED, K.MAX_SPEED);
    expect(boss.woken).toBe(true);

    bodies[boss.index]!.position = vec3(0, 3000, 0); // miles away again
    f.step(vec3(0, 900, 0), K.MAX_SPEED, K.MAX_SPEED);
    expect(boss.woken).toBe(true);
  });

  it('chases hard when it has been dropped', () => {
    const { f, bodies, boss } = promoted();
    boss.woken = true;
    bodies[boss.index]!.position = vec3(0, 800, 0); // 100 behind
    f.step(vec3(0, 900, 0), K.MAX_SPEED, K.MAX_SPEED);
    expect(boss.state.maxSpeed).toBeCloseTo(K.MAX_SPEED * K.DUGGARY_SPEED_CHASING, 6);
  });

  it('defends when it is just ahead, and cruises when it is clear', () => {
    const { f, bodies, boss } = promoted();
    boss.woken = true;
    bodies[boss.index]!.position = vec3(0, 900.5, 0);
    f.step(vec3(0, 900, 0), K.MAX_SPEED, K.MAX_SPEED);
    expect(boss.state.maxSpeed).toBeCloseTo(K.MAX_SPEED * K.DUGGARY_SPEED_DEFENDING, 6);

    bodies[boss.index]!.position = vec3(0, 950, 0); // 50 clear
    f.step(vec3(0, 900, 0), K.MAX_SPEED, K.MAX_SPEED);
    expect(boss.state.maxSpeed).toBeCloseTo(K.MAX_SPEED * K.DUGGARY_SPEED_CRUISING, 6);
  });

  it('waits when it is a long way clear', () => {
    const { f, bodies, boss } = promoted();
    boss.woken = true;
    bodies[boss.index]!.position = vec3(0, 1100, 0); // 200 ahead
    f.step(vec3(0, 900, 0), K.MAX_SPEED, K.MAX_SPEED);
    expect(boss.state.maxSpeed).toBeCloseTo(K.MAX_SPEED * K.DUGGARY_SPEED_WAITING, 6);
  });

  it('matches the player s CURRENT speed when they are alongside', () => {
    // `doEnemy:777`: `gM5Speed`, not `gM5MaxSpeed`. The duel tracks what the
    // player is actually doing, within five either way.
    const { f, bodies, boss } = promoted();
    boss.woken = true;
    boss.matchUntil = 0;
    bodies[boss.index]!.position = vec3(0, 905, 0); // 5 ahead: mode 4
    const playerSpeed = 30;
    f.step(vec3(0, 900, 0), K.MAX_SPEED, playerSpeed);
    expect(boss.state.maxSpeed).toBeGreaterThanOrEqual(playerSpeed - 5);
    expect(boss.state.maxSpeed).toBeLessThan(playerSpeed - 5 + K.DUGGARY_MATCH_SPREAD);
  });

  it('holds a matched speed for four seconds before re-rolling', () => {
    const { f, bodies, boss } = promoted();
    boss.woken = true;
    boss.matchUntil = 0;
    bodies[boss.index]!.position = vec3(0, 905, 0);
    f.step(vec3(0, 900, 0), K.MAX_SPEED, 30);
    const held = boss.state.maxSpeed;
    for (let i = 0; i < 10; i++) f.step(vec3(0, 900, 0), K.MAX_SPEED, 60);
    expect(boss.state.maxSpeed).toBe(held);
  });

  it('takes no damage from anything, Robot included', () => {
    const { f, boss } = promoted();
    f.hit(boss, { source: 'playerBlades', force: 0 }, vec3(0, 900, 0));
    f.hit(boss, { source: 'scenery', force: 1000, sceneryReady: true }, vec3(0, 900, 0));
    boss.state.control = 'spun';
    f.hit(boss, { source: 'player', force: 0 }, vec3(0, 900, 0));
    expect(boss.state.damage).toBe(0);
    expect(boss.state.alive).toBe(true);
    expect(f.killScore).toBe(0);
  });

  it('is put back beside the player when it is lost, not recycled away', () => {
    const { f, bodies, boss } = promoted();
    const playerY = waypoint(path, 60).y;
    // Keep the others alongside, or they are lost in the same tick and the
    // count moves for reasons that have nothing to do with the boss.
    bodies.forEach((b) => (b.position = vec3(0, playerY + 10, 0)));
    const remaining = f.enemiesRemaining;
    bodies[boss.index]!.position = vec3(0, playerY - 500, 0);

    f.step(vec3(0, playerY, 0), K.MAX_SPEED, K.MAX_SPEED);

    expect(boss.state.alive).toBe(true);
    expect(f.enemiesRemaining).toBe(remaining); // it is not one of the nineteen
    expect(Math.abs(bodies[boss.index]!.position.y - playerY)).toBeLessThan(200);
  });

  it('will not be put back more than once in five seconds', () => {
    // The original reads like a stuck detector and is not one: `lastYPos` is
    // assigned from `thisYPos` on the line before the comparison, so the test
    // is always true and the reset is simply on a cooldown.
    const { f, bodies, boss } = promoted();
    const playerY = waypoint(path, 60).y;
    bodies.forEach((b) => (b.position = vec3(0, playerY + 10, 0)));

    bodies[boss.index]!.position = vec3(0, playerY - 500, 0);
    f.step(vec3(0, playerY, 0), K.MAX_SPEED, K.MAX_SPEED);
    const firstPlace = bodies[boss.index]!.position.y;

    bodies[boss.index]!.position = vec3(0, playerY - 500, 0);
    f.step(vec3(0, playerY, 0), K.MAX_SPEED, K.MAX_SPEED);
    expect(bodies[boss.index]!.position.y).toBe(playerY - 500); // refused

    bodies[boss.index]!.position = vec3(0, playerY + 10, 0);
    for (let i = 0; i < Math.round(K.DUGGARY_RESET_COOLDOWN_S / K.TICK_DT); i++) {
      f.step(vec3(0, playerY, 0), K.MAX_SPEED, K.MAX_SPEED);
    }
    bodies[boss.index]!.position = vec3(0, playerY - 500, 0);
    f.step(vec3(0, playerY, 0), K.MAX_SPEED, K.MAX_SPEED);
    expect(bodies[boss.index]!.position.y).toBeCloseTo(firstPlace, 0);
  });
});
