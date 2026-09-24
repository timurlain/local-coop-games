import { makeRng, pick, rand, randInt, shuffle } from '../../../shared/rng';
import { RULES } from './rules';
import { THEME_FURNITURE, assignThemes, decorate } from './themes';
import {
  DIRS, NO_INPUT, OPPOSITE, REMEDIES, SECRETS, neighbor,
  type Dir, type EmbassySize, type GameState, type PlayerId, type Room, type Spy,
} from './state';

const LOOKS_SALT = 0x5eed7e3a;

export function createSpy(id: PlayerId, room: number, x: number, roomCount: number, clock: number): Spy {
  const visited = Array<boolean>(roomCount).fill(false);
  visited[room] = true;
  return {
    id, room, x, z: RULES.roomD / 2, facing: id === 0 ? 1 : -1,
    hand: null, clock, health: RULES.health,
    mode: 'normal', modeTimer: 0, searchTarget: null, holdTarget: null, holdTime: 0, deathCause: null,
    menuOpen: false, menuCursor: 0, armed: null, stock: { ...RULES.trapStock },
    swingCooldown: 0, swingAnim: 0, blocking: false, lockedMsg: 0,
    visited, prev: { ...NO_INPUT },
  };
}

export function createGame(seed: number, size: EmbassySize, clock: number = RULES.defaultClock): GameState {
  const { cols, rows } = RULES.sizes[size];
  // Looks come from their own stream so the gameplay stream (doors, slots, hidden things) is untouched.
  const looks = makeRng((seed ^ LOOKS_SALT) >>> 0);
  const themes = assignThemes({ cols, rows }, looks);
  const rooms: Room[] = [];
  for (let gy = 0; gy < rows; gy++) {
    for (let gx = 0; gx < cols; gx++) {
      rooms.push({
        id: gy * cols + gx, gx, gy,
        doors: { N: false, S: false, E: false, W: false },
        exit: null, furniture: [], theme: themes[gy * cols + gx], decor: [], rug: false,
      });
    }
  }
  // 4 remedy sources + 4 secrets + kufrik need 9 distinct furniture pieces.
  if (rooms.length * RULES.furniturePerRoom.min < 9) {
    throw new Error(`embassy ${size} too small: needs room for 9 hidden things`);
  }
  const last = rooms.length - 1;
  const state: GameState = {
    seed, cols, rows, rooms, furniture: [], doorTraps: {}, timeBombs: [],
    spies: [createSpy(0, 0, 40, rooms.length, clock), createSpy(1, last, 160, rooms.length, clock)],
    rng: makeRng(seed), time: 0, tick: 0, result: null,
  };
  carveDoors(state);
  placeFurniture(state);
  placeExit(state);
  placeThings(state);
  for (const room of rooms) decorate(room, room.furniture.map((id) => state.furniture[id]), looks);
  return state;
}

export function outwardDirs(state: GameState, roomId: number): Dir[] {
  return DIRS.filter((d) => neighbor(state, roomId, d) === null);
}

function connect(state: GameState, a: number, dir: Dir): void {
  const b = neighbor(state, a, dir);
  if (b === null) throw new Error(`no room ${dir} of ${a}`);
  state.rooms[a].doors[dir] = true;
  state.rooms[b].doors[OPPOSITE[dir]] = true;
}

/** Randomised DFS spanning tree (everything reachable) plus some extra doors for loops. */
function carveDoors(state: GameState): void {
  const visited = new Set<number>([0]);
  const stack = [0];
  while (stack.length > 0) {
    const cur = stack[stack.length - 1];
    const options = DIRS.filter((d) => {
      const n = neighbor(state, cur, d);
      return n !== null && !visited.has(n);
    });
    if (options.length === 0) {
      stack.pop();
      continue;
    }
    const d = pick(state.rng, options);
    const n = neighbor(state, cur, d)!;
    connect(state, cur, d);
    visited.add(n);
    stack.push(n);
  }
  for (const room of state.rooms) {
    for (const d of ['E', 'S'] as const) {
      if (neighbor(state, room.id, d) !== null && !room.doors[d] && rand(state.rng) < RULES.extraDoorChance) {
        connect(state, room.id, d);
      }
    }
  }
}

function placeFurniture(state: GameState): void {
  const { min, max } = RULES.furniturePerRoom;
  for (const room of state.rooms) {
    const count = min + randInt(state.rng, max - min + 1);
    const slots = shuffle(state.rng, RULES.slotX).slice(0, count).sort((a, b) => a - b);
    for (const x of slots) {
      const id = state.furniture.length;
      state.furniture.push({
        id, room: room.id, kind: pick(state.rng, THEME_FURNITURE[room.theme]), x,
        hidden: null, source: null, trap: null,
      });
      room.furniture.push(id);
    }
  }
}

function placeExit(state: GameState): void {
  const starts = [0, state.rooms.length - 1];
  const candidates = state.rooms.filter((r) => !starts.includes(r.id) && outwardDirs(state, r.id).length > 0);
  const room = pick(state.rng, candidates);
  room.exit = pick(state.rng, outwardDirs(state, room.id));
}

function placeThings(state: GameState): void {
  const ids = shuffle(state.rng, state.furniture.map((f) => f.id));
  REMEDIES.forEach((remedy, i) => {
    state.furniture[ids[i]].source = remedy;
  });
  SECRETS.forEach((secret, i) => {
    state.furniture[ids[4 + i]].hidden = { kind: 'secret', secret };
  });
  state.furniture[ids[8]].hidden = { kind: 'kufrik', contents: [] };
}
