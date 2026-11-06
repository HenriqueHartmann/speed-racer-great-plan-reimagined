/**
 * What hurts a rival.
 *
 * The table is recovered; the unit it is denominated in is not. `hitforce` is
 * Havok's collision magnitude and stays UNRESOLVED, so the tests below split
 * in two: the thresholds and the flat numbers are checked against the Lingo,
 * and the one substituted quantity is checked against outcomes a player could
 * see rather than against a number nobody can recover.
 */
import { describe, it, expect } from 'vitest';
import {
  applyImpact,
  damageFrom,
  impactForce,
  modeAfter,
  type ExplosionMode,
  type Impact,
} from '../src/sim/rival-damage.js';
import * as K from '../src/sim/constants.js';

const hit = (p: Partial<Impact> & Pick<Impact, 'source'>): Impact =>
  ({ force: 0, ...p });

describe('damageFrom', () => {
  it('charges nothing for the track', () => {
    // `doEnemy:187`: `if hitKind = "track" then return`.
    expect(damageFrom(hit({ source: 'track', force: 1000 }))).toBe(0);
  });

  it('charges the saw six times the bodywork', () => {
    expect(damageFrom(hit({ source: 'playerBlades' }))).toBe(15);
    expect(damageFrom(hit({ source: 'player' }))).toBe(2.5);
  });

  it('charges a rear-ending to the car in front, and only that car', () => {
    // `doEnemy:189`: `if pCarBody.position.y < otherModel.position.y`.
    expect(damageFrom(hit({ source: 'rival', force: 20, inFront: true }))).toBe(10);
    expect(damageFrom(hit({ source: 'rival', force: 20, inFront: false }))).toBe(0);
  });

  it('kills outright on scenery above the threshold, and does nothing below', () => {
    // `doEnemy:226`: `if (hitforce > 10) ... damage = 100`. There is no
    // partial damage from a wall at all - it is fatal or it is free.
    expect(damageFrom(hit({ source: 'scenery', force: 10.1 }))).toBe(100);
    expect(damageFrom(hit({ source: 'scenery', force: 10 }))).toBe(0);
    expect(damageFrom(hit({ source: 'scenery', force: 9.9 }))).toBe(0);
  });

  it('honours the scenery debounce', () => {
    // `doEnemy:227`: at most once a second, so a car scraping along a wall
    // is not killed on the tick after it was spared.
    expect(damageFrom(hit({ source: 'scenery', force: 50, sceneryReady: false }))).toBe(0);
    expect(damageFrom(hit({ source: 'scenery', force: 50, sceneryReady: true }))).toBe(100);
  });
});

describe('modeAfter', () => {
  it('starts smoking at 30 and not before', () => {
    expect(modeAfter(29.9)).toBe('none');
    expect(modeAfter(30)).toBe('smoking');
  });

  it('destroys at 100 and not before', () => {
    expect(modeAfter(99.9)).toBe('smoking');
    expect(modeAfter(100)).toBe('destroyed');
  });

  it('is whole at zero', () => {
    expect(modeAfter(0)).toBe('none');
  });
});

describe('applyImpact', () => {
  it('detonates a spun rival on any contact at all', () => {
    // `doEnemy:184-186`. The Robot's whole purpose: it does no damage itself,
    // it makes the next thing the car touches fatal.
    const r = applyImpact(0, 'none', hit({ source: 'player', spun: true }));
    expect(r.mode).toBe('destroyed');
    expect(r.damage).toBe(100);
  });

  it('leaves a spun rival alone if all it touched was the road', () => {
    const r = applyImpact(0, 'none', hit({ source: 'track', spun: true }));
    expect(r.mode).toBe('none');
    expect(r.damage).toBe(0);
  });

  it('accumulates ordinary hits predictably', () => {
    let damage = 0;
    let mode: ExplosionMode = 'none';
    const smokeAt: number[] = [];
    for (let i = 1; i <= 40; i++) {
      ({ damage, mode } = applyImpact(damage, mode, hit({ source: 'player' })));
      if (mode === 'smoking' && smokeAt.length === 0) smokeAt.push(i);
    }
    // 2.5 a hit: smoke on the twelfth, destroyed on the fortieth. Those two
    // numbers follow from the recovered table, not from any tuning.
    expect(smokeAt).toEqual([12]);
    expect(mode).toBe('destroyed');
  });

  it('never lets damage run past the pool', () => {
    const r = applyImpact(99, 'smoking', hit({ source: 'playerBlades' }));
    expect(r.damage).toBe(100);
  });
});

describe('impactForce', () => {
  /**
   * The substitute. These assert OUTCOMES, which is all that can honestly be
   * asserted: the original's scale is Havok's and is not recoverable.
   */
  it('leaves a slow nudge far below the scenery threshold', () => {
    expect(impactForce(10)).toBeLessThan(K.RIVAL_SCENERY_FORCE);
  });

  it('lets a car brush scenery at the player s top speed and survive', () => {
    expect(impactForce(K.MAX_SPEED)).toBeLessThan(K.RIVAL_SCENERY_FORCE);
  });

  it('makes a full head-on fatal against scenery', () => {
    expect(impactForce(K.MAX_SPEED * 2)).toBeGreaterThan(K.RIVAL_SCENERY_FORCE);
  });

  it('scales with the closing speed, so a fast hit is worse than a slow one', () => {
    expect(impactForce(60)).toBeGreaterThan(impactForce(20));
    expect(impactForce(60)).toBeCloseTo(impactForce(20) * 3, 10);
  });

  it('charges nothing for separating bodies', () => {
    expect(impactForce(-30)).toBe(0);
  });

  it('cannot destroy a car by slow shunts alone before the pool runs out', () => {
    // A queue of nudges at a sixth of top speed. Each costs half its force to
    // the car in front, so it takes a great many - which is the point: low
    // speed must not be implausibly lethal.
    const nudge = hit({ source: 'rival', force: impactForce(10), inFront: true });
    let damage = 0;
    let mode: ExplosionMode = 'none';
    let hits = 0;
    while (mode !== 'destroyed' && hits < 10_000) {
      ({ damage, mode } = applyImpact(damage, mode, nudge));
      hits++;
    }
    expect(hits).toBeGreaterThan(100);
  });
});
