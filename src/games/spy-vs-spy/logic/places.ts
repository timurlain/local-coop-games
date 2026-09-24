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

/** The door (or exit) the spy is standing at, or null. */
export function doorAt(state: GameState, spy: Spy): Dir | null {
  const room = state.rooms[spy.room];
  const has = (d: Dir) => room.doors[d] || room.exit === d;
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
