import { hasAllSecrets } from './hand';
import { RULES } from './rules';
import { EXIT_KEY, doorKey, neighbor, type Dir, type Furniture, type GameState, type Spy } from './state';

/** Nearest furniture within reach of a spy standing at the back wall, or null. */
export function furnitureAt(state: GameState, spy: Spy): Furniture | null {
  if (spy.z > RULES.furnitureReachZ) return null;
  let best: Furniture | null = null;
  let bestDist = Infinity;
  for (const id of state.rooms[spy.room].furniture) {
    const f = state.furniture[id];
    const d = Math.abs(f.x - spy.x);
    if (d <= RULES.furnitureReachX && d < bestDist) {
      best = f;
      bestDist = d;
    }
  }
  return best;
}

/**
 * Whether `spy` sees (and can use) the airport exit: always, unless „Skrýt letiště" is on — then only while that
 * spy holds the kufřík with all 4 secrets (spec §4). A hidden exit is plain wall for that spy: not drawn, not on
 * its maps, not a door to stand at, push through or trap.
 */
export function exitVisibleTo(state: GameState, spy: Spy): boolean {
  return !state.hideAirport || hasAllSecrets(spy.hand);
}

/** The door (or exit, if visible to the spy) the spy is standing at, or null. */
export function doorAt(state: GameState, spy: Spy): Dir | null {
  const room = state.rooms[spy.room];
  const exit = exitVisibleTo(state, spy) ? room.exit : null;
  const has = (d: Dir) => room.doors[d] || exit === d;
  const midX = Math.abs(spy.x - RULES.roomW / 2) <= RULES.doorHalfX;
  const midZ = Math.abs(spy.z - RULES.roomD / 2) <= RULES.doorHalfZ;
  if (has('N') && midX && spy.z <= RULES.doorReach) return 'N';
  if (has('S') && midX && spy.z >= RULES.roomD - RULES.doorReach) return 'S';
  if (has('W') && midZ && spy.x <= RULES.doorReach) return 'W';
  if (has('E') && midZ && spy.x >= RULES.roomW - RULES.doorReach) return 'E';
  return null;
}

/** Key into `state.doorTraps` for a door of a room. */
export function doorKeyFor(state: GameState, roomId: number, dir: Dir): string {
  if (state.rooms[roomId].exit === dir) return EXIT_KEY;
  const n = neighbor(state, roomId, dir);
  if (n === null) throw new Error(`no room ${dir} of ${roomId}`);
  return doorKey(roomId, n);
}
