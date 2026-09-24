import { kill } from './death';
import { RULES } from './rules';
import { isActive, opponentOf, type GameEvent, type GameState, type Spy, type SpyInput } from './state';

export function sameRoomOpponent(state: GameState, spy: Spy): Spy | null {
  const o = opponentOf(state, spy);
  return o.room === spy.room && isActive(o) ? o : null;
}

export function inFightRange(a: Spy, b: Spy): boolean {
  return Math.abs(a.x - b.x) <= RULES.fightRangeX && Math.abs(a.z - b.z) <= RULES.fightRangeZ;
}

/** Holding the direction away from the opponent = block. */
export function updateBlocking(state: GameState, spy: Spy, input: SpyInput): void {
  const o = sameRoomOpponent(state, spy);
  spy.blocking = o !== null && spy.mode === 'normal' && input.moveX !== 0 && input.moveX === -Math.sign(o.x - spy.x);
}

/** Returns true when the Akce press was used for fighting (even during cooldown). */
export function trySwing(state: GameState, spy: Spy, events: GameEvent[]): boolean {
  const o = sameRoomOpponent(state, spy);
  if (o === null || spy.mode !== 'normal' || !inFightRange(spy, o)) return false;
  if (spy.swingCooldown > 0) return true;
  spy.swingCooldown = RULES.swingCooldown;
  spy.swingAnim = RULES.swingAnim;
  spy.facing = o.x >= spy.x ? 1 : -1;
  events.push({ type: 'swing', spy: spy.id });
  if (o.blocking) {
    events.push({ type: 'blocked', spy: o.id });
    return true;
  }
  o.health -= 1;
  events.push({ type: 'hit', spy: o.id });
  const push = Math.sign(o.x - spy.x) || spy.facing;
  o.x = Math.max(0, Math.min(RULES.roomW, o.x + push * RULES.knockback));
  if (o.health <= 0) kill(state, o, 'fight', events);
  return true;
}
