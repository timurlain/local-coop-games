import { pick } from '../../../shared/rng';
import { RULES } from './rules';
import {
  DIRS, canHold, isActive, neighbor, opponentOf,
  type DeathCause, type Furniture, type GameEvent, type GameState, type PlayerId, type Spy,
} from './state';

/** `killer` is the opponent who landed the strike (spec §7); only meaningful for cause 'fight'. */
export function kill(state: GameState, spy: Spy, cause: DeathCause, events: GameEvent[], killer?: PlayerId): void {
  if (!isActive(spy)) return;
  spy.mode = 'dead';
  spy.modeTimer = RULES.respawnTime;
  spy.deathCause = cause;
  spy.clock = Math.max(0, spy.clock - RULES.deathPenalty);
  // The trap in hand stays (its stock was never spent, round 4 §1); a placement or the map in progress is dropped.
  spy.trapPress = null;
  spy.mapOpen = false;
  spy.placing = null;
  spy.refuseTimer = 0;
  spy.searchTarget = null;
  spy.blocking = false;
  spy.kickTimer = 0;
  cancelSwing(spy);
  cancelDoorOpening(state, spy);
  const thing = spy.hand;
  const furniture = dropHand(state, spy);
  events.push({ type: 'died', spy: spy.id, cause, killer });
  // Round 5: show where the hand item landed (spec §7 scoring is untouched — `dropped` carries no
  // score delta — and the sound stays a plain 'clatter'). Death is now the only way a `dropped`
  // event fires (round 6 play test: entering the opponent's room no longer drops anything).
  if (thing !== null) events.push({ type: 'dropped', spy: spy.id, thing, furniture });
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
 * Re-hides the hand item in the nearest free furniture that can hold it (spec §3.5; round 6 §4: `canHold`, so never a
 * fixture or the armoury).
 * Returns the furniture id that received it, or null when nothing was held or a remedy vanished.
 */
export function dropHand(state: GameState, spy: Spy): number | null {
  const thing = spy.hand;
  if (thing === null) return null;
  spy.hand = null;
  const free = nearestFurniture(state, spy.room, (f) => canHold(f) && f.hidden === null);
  if (free) {
    free.hidden = thing;
    return free.id;
  }
  // Remedies are infinite at their sources, losing one costs nothing.
  if (thing.kind === 'remedy') return null;
  const replace = nearestFurniture(state, spy.room, (f) => canHold(f) && f.hidden?.kind === 'remedy');
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
  // Round 5 §2: back in another room. Until now `spy.room` stayed the room of death, so the death animation and
  // the angel play there.
  spy.room = respawnRoom(state, spy, spy.room);
  spy.visited[spy.room] = true;
  spy.x = RULES.roomW / 2;
  spy.z = RULES.spawnZ;
  spy.pushingDoor = null;
  spy.enteredAt = state.tick;
  events.push({ type: 'respawn', spy: spy.id });
}

/**
 * Where a spy killed in `deathRoom` comes back (round 5 §2), picked with the gameplay RNG: any room that is neither
 * the room of death, nor the opponent's current room, nor the exit room, nor a room with a ticking time bomb; when no such room
 * exists, any room but the opponent's.
 */
export function respawnRoom(state: GameState, spy: Spy, deathRoom: number): number {
  const opponentRoom = opponentOf(state, spy).room;
  const ids = state.rooms.map((r) => r.id).filter((id) => id !== opponentRoom);
  const preferred = ids.filter(
    (id) => id !== deathRoom && state.rooms[id].exit === null && !state.timeBombs.some((b) => b.room === id),
  );
  return pick(state.rng, preferred.length > 0 ? preferred : ids);
}
