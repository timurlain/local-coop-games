import { makeRng, pick, rand, randInt, shuffle } from '../../../shared/rng';
import { RULES, levelRules } from './rules';
import { THEME_FURNITURE, assignThemes, decorate, pickHost } from './themes';
import {
  ARMOURY_KIND, DIRS, FIXTURE_KINDS, FIXTURE_REMEDY, FREE_STANDING_KINDS, NO_INPUT, OPPOSITE, SECRETS, canHold, neighbor,
  type Dir, type FixtureKind, type FurnitureKind, type GameState, type PlayerId, type Room, type SecretKind, type Spy, type TrapKind,
} from './state';

const LOOKS_SALT = 0x5eed7e3a;

export function createSpy(
  id: PlayerId, room: number, x: number, roomCount: number, clock: number, stock: Readonly<Record<TrapKind, number>>,
): Spy {
  const visited = Array<boolean>(roomCount).fill(false);
  visited[room] = true;
  return {
    id, room, x, z: RULES.spawnZ, facing: id === 0 ? 1 : -1,
    hand: null, clock, health: RULES.health, sinceHit: 0, score: 0,
    mode: 'normal', modeTimer: 0, searchTarget: null, deathCause: null,
    selected: null, trapPress: null, mapOpen: false, placing: null, refuseTimer: 0, stock: { ...stock },
    armouryTimer: 0, stockFlash: null,
    swingCooldown: 0, swingAnim: 0, attack: null, strikeIn: 0, blocking: false, ducking: false, kickTimer: 0, doorOpening: null,
    enteredAt: 0, visited, trail: [], prev: { ...NO_INPUT },
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
  // The exit comes first (it only needs the grid): the armoury's room is chosen among the other rooms and furnished
  // together with the rest (round 6 §4).
  placeExit(state);
  placeFurniture(state, minPieces, pickArmouryRoom(state));
  placeFixtures(state);
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

/** Round 6 §3: every secret item the generator hides, in placement order (`RULES.secretCopies` of each kind). */
export function secretItems(): SecretKind[] {
  return SECRETS.flatMap((kind) => Array<SecretKind>(RULES.secretCopies[kind]).fill(kind));
}

/**
 * Fewest furniture pieces per room so that fixtures (4 kinds × fixtureCount), the secret items, the kufřík and the
 * armoury (round 6 §4) always get distinct pieces: `RULES.furniturePerRoom.min`, which is what every level gets.
 * Fixtures stay on the wall, and a room with a free-standing piece may have one wall piece fewer than the minimum, so
 * that is counted too. Throws when even full rooms of `max` pieces are not enough, or (see `checkSecretRoomCapacity`)
 * when the fixtures could crowd a room out or the secret items and kufřík cannot get distinct rooms — which rules out
 * anything as small as a 3×2 (it throws, it is never given more pieces).
 */
export function minFurniturePerRoom(roomCount: number): number {
  const fixtures = FIXTURE_KINDS.length * fixtureCount(roomCount);
  const needed = fixtures + secretItems().length + 1 + 1; // + the kufřík + the armoury
  const min = Math.max(
    RULES.furniturePerRoom.min,
    Math.ceil(needed / roomCount),
    Math.ceil(fixtures / roomCount) + 1,
  );
  if (min > RULES.furniturePerRoom.max) {
    throw new Error(`embassy of ${roomCount} rooms too small: needs room for ${needed} hidden things`);
  }
  checkSecretRoomCapacity(roomCount, fixtures);
  return min;
}

/**
 * Round 5, tightened in round 6 §3 (6 secret items + the kufřík = 7 distinct rooms, level 1 has 9) and §4 (the
 * armoury): fixtures never take a room's last piece that can hold a thing (`canHold`, see `placeFixtureKind`), so
 * every room keeps one for a secret item. That holds as long as the fixtures fit: every room can take at least one
 * fixture without losing its last holdable piece — a room without a free-standing piece has two holdable wall pieces;
 * one with it keeps the free piece, which is never a fixture; the armoury's room always gets both wall pieces plus a
 * free one (`placeFurniture`), so it too has one holdable wall piece to spare — hence `fixtures <= roomCount` is
 * always enough. Throws if the fixtures could not fit that way, or if there are fewer rooms than secret items plus
 * the kufřík.
 */
function checkSecretRoomCapacity(roomCount: number, fixtures: number): void {
  const need = secretItems().length + 1;
  if (fixtures > roomCount) {
    throw new Error(
      `embassy of ${roomCount} rooms too small: ${fixtures} fixtures could leave a room without a non-fixture piece`,
    );
  }
  if (roomCount < need) {
    throw new Error(`embassy of ${roomCount} rooms too small: need ${need} distinct rooms for the secrets and kufřík`);
  }
}

/** Round 6 §4: the armoury's room, on the gameplay RNG — any room but the exit room (so `placeExit` runs first). */
function pickArmouryRoom(state: GameState): number {
  return pick(state.rng, state.rooms.filter((r) => r.exit === null)).id;
}

/**
 * 2-3 pieces per room (round 5 §5), on the gameplay RNG. About half the rooms (every room when `min` is 3) get one
 * free-standing piece in the middle of the floor, of a free-standing kind from the room's theme; the rest stand on
 * the back wall, at most one on each side of the back door. A room without a free piece has one on each side.
 * Round 6 §4: the armoury's room always gets the full three — the armoury cabinet on one side of the back door, a
 * theme piece on the other and a free-standing one — so it keeps two holdable pieces (see `checkSecretRoomCapacity`).
 */
function placeFurniture(state: GameState, min: number, armouryRoom: number): void {
  const { max } = RULES.furniturePerRoom;
  for (const room of state.rooms) {
    const pool = THEME_FURNITURE[room.theme];
    const armoury = room.id === armouryRoom;
    const free = armoury || min >= max || rand(state.rng) < RULES.freeStandingChance;
    const wallCount = free && !armoury ? min - 1 + randInt(state.rng, max - min + 1) : RULES.slotX.length;
    const sides = shuffle(state.rng, RULES.slotX).slice(0, wallCount);
    const add = (kind: FurnitureKind, x: number, z: number) => {
      const id = state.furniture.length;
      state.furniture.push({ id, room: room.id, kind, x, z, hidden: null, source: null, trap: null });
      room.furniture.push(id);
    };
    // the armoury takes the first shuffled side; the wall pieces are added in x order
    const wall = sides.map((side, i) => ({
      x: pick(state.rng, side),
      kind: armoury && i === 0 ? ARMOURY_KIND : pick(state.rng, pool),
    }));
    for (const { x, kind } of wall.sort((a, b) => a.x - b.x)) add(kind, x, 0);
    if (free) {
      const kind = pick(state.rng, pool.filter((k) => FREE_STANDING_KINDS.includes(k)));
      add(kind, pick(state.rng, RULES.freeSlotX), pick(state.rng, RULES.freeSlotZ));
    }
  }
}

/** Fixtures per kind: 2 for a small embassy, growing with the room count. */
function fixtureCount(roomCount: number): number {
  return Math.max(2, Math.ceil(roomCount / 5));
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
      // fixtures always hang on the wall (round 5 §5), and never take a room's last piece that can hold a thing
      // (round 6 §3: every room stays able to hide a secret item); never the armoury either (`canHold`, round 6 §4)
      const holdable = state.rooms[roomId].furniture.filter((id) => canHold(state.furniture[id]));
      if (holdable.length < 2) continue;
      const candidates = holdable.filter((id) => state.furniture[id].z === 0);
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
 * each other, z=20; the room counts as visited for both, entered at the same tick.
 */
function placeSpawn(state: GameState): void {
  const candidates = state.rooms.filter((r) => r.exit === null).map((r) => r.id);
  const room = pick(state.rng, candidates);
  for (const spy of state.spies) {
    spy.room = room;
    spy.visited.fill(false);
    spy.visited[room] = true;
    spy.enteredAt = state.tick; // same for both: the merged view (spec §2) breaks the tie
  }
}

/**
 * Round 5: at most one secret item per room at the start. The secret items (round 6 §3: `secretItems()`, 6 of them)
 * and the kufřík go into *distinct* rooms — rooms are shuffled, then one piece that can hold a thing (`canHold`: not a
 * fixture, not the armoury) is picked in each of the first ones that have one. `checkSecretRoomCapacity` (run up front, in `minFurniturePerRoom`) and the fixture rule
 * in `placeFixtureKind` guarantee every room keeps such a piece.
 */
function placeThings(state: GameState): void {
  const items = secretItems();
  const need = items.length + 1;
  const roomsWithSpace = state.rooms.filter((r) => r.furniture.some((id) => canHold(state.furniture[id])));
  if (roomsWithSpace.length < need) {
    throw new Error(`only ${roomsWithSpace.length} rooms have a piece that can hold a thing; need ${need} distinct rooms`);
  }
  const chosenRooms = shuffle(state.rng, roomsWithSpace).slice(0, need);
  const chosenFurniture = chosenRooms.map((r) => pick(state.rng, r.furniture.filter((id) => canHold(state.furniture[id]))));
  items.forEach((secret, i) => {
    state.furniture[chosenFurniture[i]].hidden = { kind: 'secret', secret, lastHolder: null };
  });
  state.furniture[chosenFurniture[items.length]].hidden = { kind: 'kufrik', contents: [], lastHolder: null };
}
