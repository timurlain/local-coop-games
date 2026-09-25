import { kill } from './death';
import { RULES } from './rules';
import { isActive, opponentOf, type AttackKind, type GameEvent, type GameState, type Spy, type SpyInput } from './state';

export function sameRoomOpponent(state: GameState, spy: Spy): Spy | null {
  const o = opponentOf(state, spy);
  return o.room === spy.room && isActive(o) ? o : null;
}

/** True while an active opponent shares this spy's room (spec §3: meeting rules). */
export function sharesRoom(state: GameState, spy: Spy): boolean {
  return sameRoomOpponent(state, spy) !== null;
}

export function inFightRange(a: Spy, b: Spy): boolean {
  return Math.abs(a.x - b.x) <= RULES.fightRangeX && Math.abs(a.z - b.z) <= RULES.fightRangeZ;
}

/**
 * Holding the Trapulator button while an opponent shares the room = block (guard stance with the open umbrella,
 * round 4 §2; play test 5: its own key, so walking away from the opponent is plain walking). The spy stands still
 * while blocking. In a shared room the button does nothing else (see `updateTrapButton`).
 *
 * Round 6 §1: holding down at the same time is a duck instead (`updateDucking`), not a block — block and duck
 * are exclusive on the same button.
 */
export function updateBlocking(state: GameState, spy: Spy, input: SpyInput): void {
  spy.blocking = input.trap && input.moveY !== 1 && spy.mode === 'normal' && spy.kickTimer <= 0
    && sameRoomOpponent(state, spy) !== null;
}

/**
 * Round 6 §1: the Trapulator button held together with down, while not swinging, is a duck — stops a head
 * bash, and the spy doesn't move that tick — but only when the opponent is actually within fight range (L3
 * review, carried over from the old "down alone" duck). An opponent merely sharing the room but out of reach
 * can't be ducked at, so holding trap+down there still just stands in place with the head bash still landing
 * (no duck), and down alone always just walks, like the other directions.
 */
export function updateDucking(state: GameState, spy: Spy, input: SpyInput): void {
  const o = sameRoomOpponent(state, spy);
  spy.ducking = spy.mode === 'normal' && spy.kickTimer <= 0 && input.trap && input.moveY === 1 && spy.attack === null
    && o !== null && inFightRange(spy, o);
}

/**
 * Akce in a fight (spec §8): starts a jab, or a head bash while holding up. The press only starts
 * the wind-up; `updateSwing` lands the strike at its end. Returns true when the press was used for
 * fighting (even during a wind-up or the cooldown).
 *
 * Round 4 fix: starting the wind-up no longer requires range — a shared room is enough (the caller,
 * `updateAction`, only reaches this once a door has been ruled out). Range is judged where it always
 * was, at the strike (`strike`, below): an opponent out of reach just makes the swing miss.
 */
export function trySwing(state: GameState, spy: Spy, kind: AttackKind, events: GameEvent[]): boolean {
  const o = sameRoomOpponent(state, spy);
  if (o === null || spy.mode !== 'normal') return false;
  if (spy.attack !== null || spy.swingCooldown > 0) return true;
  const windup = kind === 'bash' ? RULES.bashWindup : RULES.swingWindup;
  spy.attack = kind;
  spy.strikeIn = windup;
  spy.swingAnim = windup + RULES.strikeAnim;
  spy.ducking = false;
  spy.facing = o.x >= spy.x ? 1 : -1;
  events.push({ type: 'swing', spy: spy.id });
  return true;
}

/** Runs a swing's clock: the strike lands when the wind-up runs out, the swing ends with its animation. */
export function updateSwing(state: GameState, spy: Spy, dt: number, events: GameEvent[]): void {
  spy.swingAnim = Math.max(0, spy.swingAnim - dt);
  if (spy.attack === null) return;
  if (spy.strikeIn > 0) {
    spy.strikeIn -= dt;
    if (spy.strikeIn <= 1e-9) {
      spy.strikeIn = 0;
      strike(state, spy, spy.attack, events);
    }
  }
  if (spy.swingAnim === 0) spy.attack = null;
}

/** Spec §8: judged now, against the opponent's range and stance at this moment. */
function strike(state: GameState, spy: Spy, kind: AttackKind, events: GameEvent[]): void {
  spy.swingCooldown = RULES.swingCooldown;
  const o = sameRoomOpponent(state, spy);
  if (spy.mode !== 'normal' || o === null || !inFightRange(spy, o)) return;
  // A spy tumbling from the airport guard's kick (spec §9, L5 review) is immune to strikes: without
  // this, luring the opponent into the guard would bait a free, undefendable hit.
  if (o.kickTimer > 0) return;
  if (kind === 'jab' ? o.blocking : o.ducking) {
    events.push({ type: 'blocked', spy: o.id, kind });
    // A blocked jab visibly stops at the guard's club: shove the attacker back, away from the
    // defender (round 4 §2). A bash stopped by ducking has no clubs meeting, so no shove.
    if (kind === 'jab') {
      const push = Math.sign(spy.x - o.x) || -spy.facing;
      spy.x = Math.max(0, Math.min(RULES.roomW, spy.x + push * RULES.blockPushback));
    }
    return;
  }
  o.health -= kind === 'bash' ? RULES.bashDamage : RULES.jabDamage;
  o.sinceHit = 0;
  events.push({ type: 'hit', spy: o.id });
  const push = Math.sign(o.x - spy.x) || spy.facing;
  o.x = Math.max(0, Math.min(RULES.roomW, o.x + push * RULES.knockback));
  if (o.health <= 0) kill(state, o, 'fight', events, spy.id);
}

/** How many +1 recovery ticks have elapsed for a given time since the last hit. */
function regenTicksFor(sinceHit: number): number {
  if (sinceHit < RULES.regenDelay) return 0;
  return Math.floor((sinceHit - RULES.regenDelay) / RULES.regenInterval) + 1;
}

/** Strength recovery: +1 every `regenInterval`, starting `regenDelay` after the last hit, capped at max.
 *  Does not run while dead or out (spec §4); `sinceHit` is reset on hit and on respawn. */
export function updateHealthRegen(spy: Spy, dt: number): void {
  if (spy.mode === 'dead' || spy.mode === 'out') return;
  const before = regenTicksFor(spy.sinceHit);
  spy.sinceHit += dt;
  const after = regenTicksFor(spy.sinceHit);
  if (after > before) spy.health = Math.min(RULES.health, spy.health + (after - before));
}
