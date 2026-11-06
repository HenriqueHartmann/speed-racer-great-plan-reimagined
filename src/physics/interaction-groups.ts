/**
 * Who may collide with whom, per vehicle.
 *
 * The original restricted the track to one segment **per car**:
 * `doM5ChangeSegment` and `doEnemyChangeSegment` both call
 * `gHavok.disableCollision(carName, segmentName)` (`MOVIE.ls:171-191`), naming
 * the car. With a single car that is indistinguishable from switching the
 * segment off for everybody, which is what this project did until rivals
 * arrived. With four it is not: whichever segment were enabled, three vehicles
 * would have no ground beneath them.
 *
 * Rapier settles a pair with a conjunction across both colliders,
 *
 *     (memberships_A & filter_B) != 0  AND  (memberships_B & filter_A) != 0
 *
 * so a single shared collider can answer differently for different vehicles,
 * as long as the per-vehicle part lives in **its** filter. Segments therefore
 * carry one membership bit and a filter holding the bits of the vehicles
 * presently in them; a vehicle carries its own bit and filters the track plus
 * every vehicle. The first term is then constant and the second reduces to
 * `VEH_i & filter_S` - the whole rule, in one bit test.
 *
 * Nothing is ever enabled or disabled after construction. A segment change is
 * one mask write.
 *
 * The ceiling is **sixteen vehicles**, not thirty-seven segments: segments need
 * no bit of their own. The original's field is three rivals and the player.
 */

/** Every segment and prop collider, ground or barrier. */
export const TRACK_BIT = 1 << 0;

/** Player plus three rivals, which is all `enemyPositionsList` ever holds. */
export const MAX_VEHICLES = 4;

/** Vehicle `index`'s own bit. The player is index 0. */
export function vehicleBit(index: number): number {
  if (!Number.isInteger(index) || index < 0 || index >= MAX_VEHICLES) {
    throw new RangeError(`vehicle index ${index} is outside 0..${MAX_VEHICLES - 1}`);
  }
  return 1 << (index + 1);
}

/** Every vehicle bit at once, so vehicles always collide with each other. */
export const ALL_VEHICLE_BITS = (() => {
  let bits = 0;
  for (let i = 0; i < MAX_VEHICLES; i++) bits |= 1 << (i + 1);
  return bits;
})();

/** Rapier packs memberships into the high 16 bits and the filter into the low. */
export function groups(memberships: number, filter: number): number {
  return (((memberships & 0xffff) << 16) | (filter & 0xffff)) >>> 0;
}

/** A vehicle's own groups: its bit, filtering the track and every vehicle. */
export function vehicleGroups(index: number): number {
  return groups(vehicleBit(index), TRACK_BIT | ALL_VEHICLE_BITS);
}

/** A track collider's groups, given the vehicles currently filed under it. */
export function trackGroups(occupants: number): number {
  return groups(TRACK_BIT, occupants);
}
