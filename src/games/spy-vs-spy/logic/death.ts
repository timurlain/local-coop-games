import { pick } from '../../../shared/rng';
import { RULES } from './rules';
import {
  DIRS, isActive, neighbor,
  type DeathCause, type Furniture, type GameEvent, type GameState, type PlayerId, type Spy,
} from './state';

/** `killer` is the opponent who landed the strike (spec §7); only meaningful for cause 'fight'. */
export function kill(state: GameState, spy: Spy, cause: DeathCause, events: GameEvent[], killer?: PlayerId): void {
  if (!isActive(spy)) return;
  spy.mode = 'dead';
  spy.modeTimer = RULES.respawnTime;
  spy.deathCause = cause;
  spy.clock = Math.max(0, spy.clock - RULES.deathPenalty);
  spy.menuOpen = false;
  spy.mapOpen = false;
  spy.armed = null;
  spy.holdTarget = null;
  spy.searchTarget = null;
  spy.blocking = false;
  spy.kickTimer = 0;
  cancelSwing(spy);
  cancelDoorOpening(state, spy);
  dropHand(state, spy);
  events.push({ type: 'died', spy: spy.id, cause, killer });
}

/** Drops a swing in progress, so a spy that is out of the fight never strikes (spec §8). */
export function cancelSwing(spy: Spy): void {
  spy.attack = null;
  spy.strikeIn = 0;
  spy.swingAnim = 0;
  spy.ducking = false;
}

/** A door this spy was opening never finishes (spec §5): drop it, freeing the door key. */
export function cancelDoorOpening(state: GameState, spy: Spy): void {
  if (spy.doorOpening === null) return;
  delete state.doorOpen[spy.doorOpening];
  spy.doorOpening = null;
}

/**
 * Re-hides the hand item in the nearest free furniture (spec §3.5).
 * Returns the furniture id that received it, or null when nothing was held or a remedy vanished.
 */
export function dropHand(state: GameState, spy: Spy): number | null {
  const thing = spy.hand;
  if (thing === null) return null;
  spy.hand = null;
  const free = nearestFurniture(state, spy.room, (f) => f.hidden === null);
  if (free) {
    free.hidden = thing;
    return free.id;
  }
  // Remedies are infinite at their sources, losing one costs nothing.
  if (thing.kind === 'remedy') return null;
  const replace = nearestFurniture(state, spy.room, (f) => f.hidden?.kind === 'remedy');
  if (!replace) throw new Error('embassy has no room left for a secret item');
  replace.hidden = thing;
  return replace.id;
}

/** Breadth-first over doors; random pick among matches at the smallest distance. */
export function nearestFurniture(
  state: GameState,
  fromRoom: number,
  accept: (f: Furniture) => boolean,
): Furniture | null {
  const seen = new Set<number>([fromRoom]);
  let frontier = [fromRoom];
  while (frontier.length > 0) {
    const candidates = frontier
      .flatMap((id) => state.rooms[id].furniture.map((fid) => state.furniture[fid]))
      .filter(accept);
    if (candidates.length > 0) return pick(state.rng, candidates);
    const next: number[] = [];
    for (const id of frontier) {
      for (const d of DIRS) {
        if (!state.rooms[id].doors[d]) continue;
        const n = neighbor(state, id, d);
        if (n !== null && !seen.has(n)) {
          seen.add(n);
          next.push(n);
        }
      }
    }
    frontier = next;
  }
  return null;
}

export function updateDead(state: GameState, spy: Spy, dt: number, events: GameEvent[]): void {
  spy.modeTimer -= dt;
  if (spy.modeTimer > 0) return;
  spy.mode = 'normal';
  spy.modeTimer = 0;
  spy.health = RULES.health;
  spy.sinceHit = 0;
  spy.deathCause = null;
  spy.x = RULES.roomW / 2;
  spy.z = RULES.roomD / 2;
  spy.enteredAt = state.tick;
  events.push({ type: 'respawn', spy: spy.id });
}
