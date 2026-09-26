import { hasAllSecrets } from './hand';
import { doorAt, doorKeyFor } from './places';
import { RULES } from './rules';
import { recordTrail } from './trail';
import { neighbor, type Dir, type GameEvent, type GameState, type Spy, type SpyInput } from './state';

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** Advances one spy's position and door-crossing for this tick. */
export function updateMovement(state: GameState, spy: Spy, input: SpyInput, dt: number, events: GameEvent[]): void {
  if (input.moveX !== 0) spy.facing = input.moveX;
  spy.x = clamp(spy.x + input.moveX * RULES.speedX * dt, 0, RULES.roomW);
  spy.z = clamp(spy.z + input.moveY * RULES.speedZ * dt, 0, RULES.roomD);
  const dir = pushingDoor(state, spy, input);
  const wasPushing = spy.pushingDoor;
  spy.pushingDoor = dir;
  if (dir === null) return;
  const key = doorKeyFor(state, spy.room, dir);
  if (state.doorOpen[key]?.phase !== 'open') {
    // Closed door (spec §5): no pass, just a bump — once when the push into THIS door starts (he
    // wasn't at it, or wasn't holding into it, last tick), not every tick it's held.
    if (wasPushing !== dir) events.push({ type: 'bump', spy: spy.id });
    return;
  }
  goThrough(state, spy, dir, events);
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
  if (state.rooms[spy.room].exit === dir) {
    if (!hasAllSecrets(spy.hand)) {
      kickBack(spy, dir);
      events.push({ type: 'bounced', spy: spy.id });
      return;
    }
    spy.mode = 'escaped';
    events.push({ type: 'escaped', spy: spy.id });
    return;
  }

  const next = neighbor(state, spy.room, dir)!;
  spy.room = next;
  spy.enteredAt = state.tick;
  spy.visited[next] = true;
  spy.pushingDoor = null;
  recordTrail(spy.trail, dir);
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
}

/** The airport guard (spec §9) kicks a spy without the full kufřík `RULES.guardKick` units back from the exit
 *  at `dir`, into the room; it tumbles, immobile, for `RULES.guardKickTime`. No time penalty. */
function kickBack(spy: Spy, dir: Dir): void {
  const k = RULES.guardKick;
  switch (dir) {
    case 'N': spy.z += k; break;
    case 'S': spy.z -= k; break;
    case 'W': spy.x += k; break;
    case 'E': spy.x -= k; break;
  }
  spy.x = clamp(spy.x, 0, RULES.roomW);
  spy.z = clamp(spy.z, 0, RULES.roomD);
  spy.kickTimer = RULES.guardKickTime;
}
