import { makeRng, pick, rand, randInt, shuffle } from '../../../shared/rng';
import { RULES, levelRules } from './rules';
import { THEME_FURNITURE, assignThemes, decorate, pickHost } from './themes';
import {
  DIRS, FIXTURE_KINDS, FIXTURE_REMEDY, NO_INPUT, OPPOSITE, SECRETS, neighbor,
  type Dir, type FixtureKind, type Furniture, type GameState, type PlayerId, type Room, type Spy, type TrapKind,
} from './state';

const LOOKS_SALT = 0x5eed7e3a;

export function createSpy(
  id: PlayerId, room: number, x: number, roomCount: number, clock: number, stock: Readonly<Record<TrapKind, number>>,
): Spy {
  const visited = Array<boolean>(roomCount).fill(false);
  visited[room] = true;
  return {
    id, room, x, z: RULES.roomD / 2, facing: id === 0 ? 1 : -1,
    hand: null, clock, health: RULES.health, sinceHit: 0, score: 0,
    mode: 'normal', modeTimer: 0, searchTarget: null, holdTarget: null, holdTime: 0, deathCause: null,
    menuOpen: false, menuCursor: 0, mapOpen: false, armed: null, stock: { ...stock },
    swingCooldown: 0, swingAnim: 0, attack: null, strikeIn: 0, blocking: false, ducking: false, lockedMsg: 0, doorOpening: null,
    visited, trail: [], prev: { ...NO_INPUT },
  };
}

export interface GameOptions {
  /** „Skrýt letiště" (spec §4), default off */
  hideAirport?: boolean;
}

/** A new match on `level` (1-8, spec §4): grid, clock and trap stock come from `RULES.levels`. */
export function createGame(seed: number, level: number, opts: GameOptions = {}): GameState {
  const { cols, rows, clockSeconds, trapStockPerSpy } = levelRules(level);
  // Looks come from their own stream so the gameplay stream (doors, slots, hidden things) is untouched.
  const looks = makeRng((seed ^ LOOKS_SALT) >>> 0);
  const themes = assignThemes({ cols, rows }, looks);
  const { host, year } = pickHost(looks);
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
  const minPieces = minFurniturePerRoom(rooms.length);
  const state: GameState = {
    seed, host, year, level, cols, rows, hideAirport: opts.hideAirport ?? false, rooms, furniture: [], doorTraps: {}, doorOpen: {}, timeBombs: [],
    spies: [
      createSpy(0, 0, 40, rooms.length, clockSeconds, trapStockPerSpy),
      createSpy(1, 0, 160, rooms.length, clockSeconds, trapStockPerSpy),
    ],
    rng: makeRng(seed), time: 0, tick: 0, result: null,
  };
  carveDoors(state);
  placeFurniture(state, minPieces);
  placeFixtures(state);
  placeExit(state);
  placeSpawn(state);
  placeThings(state);
  for (const room of rooms) decorate(room, room.furniture.map((id) => state.furniture[id]), looks, host);
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

/**
 * Fewest furniture pieces per room so that fixtures (4 kinds × fixtureCount), 4 secrets and the kufřík always get
 * distinct pieces: `RULES.furniturePerRoom.min`, raised only for tiny embassies (level 1's 3×2 needs 3). Throws when
 * even a full room of `max` pieces is not enough.
 */
export function minFurniturePerRoom(roomCount: number): number {
  const needed = FIXTURE_KINDS.length * fixtureCount(roomCount) + SECRETS.length + 1;
  const min = Math.max(RULES.furniturePerRoom.min, Math.ceil(needed / roomCount));
  if (min > RULES.furniturePerRoom.max) {
    throw new Error(`embassy of ${roomCount} rooms too small: needs room for ${needed} hidden things`);
  }
  return min;
}

function placeFurniture(state: GameState, min: number): void {
  const { max } = RULES.furniturePerRoom;
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

/** Fixtures per kind: 2 for a small embassy, growing with the room count. */
function fixtureCount(roomCount: number): number {
  return Math.max(2, Math.ceil(roomCount / 5));
}

function isFixture(f: Furniture): boolean {
  return f.source !== null;
}

/**
 * Converts randomly chosen ordinary furniture pieces into fixtures: an infinite source of one
 * remedy, distinct rooms per kind where possible. Runs on the gameplay RNG, after ordinary
 * furniture is placed and before secrets/kufrik are hidden (so a fixture never gets one).
 */
function placeFixtures(state: GameState): void {
  const count = fixtureCount(state.rooms.length);
  for (const kind of FIXTURE_KINDS) placeFixtureKind(state, kind, count);
}

function placeFixtureKind(state: GameState, kind: FixtureKind, count: number): void {
  const remedy = FIXTURE_REMEDY[kind];
  const roomOrder = shuffle(state.rng, state.rooms.map((room) => room.id));
  const usedRooms = new Set<number>();
  let placed = 0;
  for (const allowRepeat of [false, true]) {
    for (const roomId of roomOrder) {
      if (placed >= count) return;
      if (!allowRepeat && usedRooms.has(roomId)) continue;
      const candidates = state.rooms[roomId].furniture.filter((id) => !isFixture(state.furniture[id]));
      if (candidates.length === 0) continue;
      const f = state.furniture[pick(state.rng, candidates)];
      f.kind = kind;
      f.source = remedy;
      usedRooms.add(roomId);
      placed++;
    }
  }
  if (placed < count) {
    throw new Error(`fixture ${kind}: placed ${placed} of ${count} — check RULES`);
  }
}

function placeExit(state: GameState): void {
  const candidates = state.rooms.filter((r) => outwardDirs(state, r.id).length > 0);
  const room = pick(state.rng, candidates);
  room.exit = pick(state.rng, outwardDirs(state, room.id));
}

/**
 * Both spies start in the same room, chosen after the exit among rooms that are not the exit
 * room (spec §2). Bílý (0) at x=40, Černý (1) at x=160 — already set by `createSpy` — facing
 * each other, z=20; the room counts as visited for both.
 */
function placeSpawn(state: GameState): void {
  const candidates = state.rooms.filter((r) => r.exit === null).map((r) => r.id);
  const room = pick(state.rng, candidates);
  for (const spy of state.spies) {
    spy.room = room;
    spy.visited.fill(false);
    spy.visited[room] = true;
  }
}

function placeThings(state: GameState): void {
  const eligible = state.furniture.filter((f) => !isFixture(f)).map((f) => f.id);
  const ids = shuffle(state.rng, eligible);
  SECRETS.forEach((secret, i) => {
    state.furniture[ids[i]].hidden = { kind: 'secret', secret, lastHolder: null };
  });
  state.furniture[ids[SECRETS.length]].hidden = { kind: 'kufrik', contents: [], lastHolder: null };
}
