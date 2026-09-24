import { dropHand } from './death';
import { sharesRoom } from './fight';
import { hasAllSecrets } from './hand';
import { doorAt, doorKeyFor } from './places';
import { RULES } from './rules';
import { triggerDoorTrap } from './traps';
import { neighbor, type Dir, type GameEvent, type GameState, type Spy, type SpyInput } from './state';

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export function updateMovement(state: GameState, spy: Spy, input: SpyInput, dt: number, events: GameEvent[]): void {
  if (input.moveX !== 0) spy.facing = input.moveX;
  spy.x = clamp(spy.x + input.moveX * RULES.speedX * dt, 0, RULES.roomW);
  spy.z = clamp(spy.z + input.moveY * RULES.speedZ * dt, 0, RULES.roomD);
  const dir = pushingDoor(state, spy, input);
  if (dir !== null) goThrough(state, spy, dir, events);
}

/** A door the spy is standing at AND pressing into. */
function pushingDoor(state: GameState, spy: Spy, input: SpyInput): Dir | null {
  const d = doorAt(state, spy);
  if (d === 'N' && input.moveY === -1 && spy.z <= 0) return d;
  if (d === 'S' && input.moveY === 1 && spy.z >= RULES.roomD) return d;
  if (d === 'W' && input.moveX === -1 && spy.x <= 0) return d;
  if (d === 'E' && input.moveX === 1 && spy.x >= RULES.roomW) return d;
  return null;
}

function goThrough(state: GameState, spy: Spy, dir: Dir, events: GameEvent[]): void {
  const key = doorKeyFor(state, spy.room, dir);

  if (state.rooms[spy.room].exit === dir) {
    if (!hasAllSecrets(spy.hand)) {
      if (spy.lockedMsg <= 0) {
        spy.lockedMsg = RULES.lockedMsgTime;
        events.push({ type: 'locked', spy: spy.id });
      }
      return;
    }
    if (!triggerDoorTrap(state, spy, key, events)) return;
    spy.mode = 'escaped';
    events.push({ type: 'escaped', spy: spy.id });
    return;
  }

  if (!triggerDoorTrap(state, spy, key, events)) return;
  const next = neighbor(state, spy.room, dir)!;
  spy.room = next;
  spy.visited[next] = true;
  switch (dir) {
    case 'N':
      spy.x = RULES.roomW / 2;
      spy.z = RULES.roomD - 1;
      break;
    case 'S':
      spy.x = RULES.roomW / 2;
      spy.z = 1;
      break;
    case 'W':
      spy.x = RULES.roomW - 1;
      spy.z = RULES.roomD / 2;
      break;
    case 'E':
      spy.x = 1;
      spy.z = RULES.roomD / 2;
      break;
  }
  events.push({ type: 'door', spy: spy.id });
  if (sharesRoom(state, spy)) dropOnEntering(state, spy, events);
}

/**
 * Entering a room where the opponent is active (spec §3): the entering spy drops everything —
 * an armed-but-unplaced trap is cleared (nothing to refund, its stock was never spent), a remedy
 * in hand is simply lost (sources are infinite), a secret or kufřík is re-hidden via the normal
 * `dropHand` rules (nearest free furniture, same room first).
 */
function dropOnEntering(state: GameState, spy: Spy, events: GameEvent[]): void {
  const thing = spy.hand;
  spy.armed = null;
  const furniture = thing !== null && thing.kind !== 'remedy' ? dropHand(state, spy) : null;
  spy.hand = null;
  events.push({ type: 'dropped', spy: spy.id, thing, furniture });
}
