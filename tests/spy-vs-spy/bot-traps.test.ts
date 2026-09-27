import { describe, expect, it, vi } from 'vitest';
import { createBot } from '../../src/games/spy-vs-spy/bot/bot';
import { chooseGoal, scoreGoals, stillWorth, type Goal } from '../../src/games/spy-vs-spy/bot/decide';
import { pathTo } from '../../src/games/spy-vs-spy/bot/decide-tactics';
import { type Iq } from '../../src/games/spy-vs-spy/bot/iq';
import { createMemory, forget, remember, type Memory, type PieceNote } from '../../src/games/spy-vs-spy/bot/memory';
import type { BotView, DoorView, KnownRoom, PieceView } from '../../src/games/spy-vs-spy/bot/view';
import { RULES } from '../../src/games/spy-vs-spy/logic/rules';
import { step } from '../../src/games/spy-vs-spy/logic/step';
import { DIRS, NO_INPUT, type Dir, type GameEvent, type GameState, type Thing, type TrapKind } from '../../src/games/spy-vs-spy/logic/state';
import { makeRng } from '../../src/shared/rng';
import { kufrik, makeArmoury, openGame, remedy, secret } from './fixtures';
import * as decide from '../../src/games/spy-vs-spy/bot/decide';

// Counts the bot's full goal rebuilds (the goalSince fix below); otherwise the real thing.
vi.mock('../../src/games/spy-vs-spy/bot/decide', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../src/games/spy-vs-spy/bot/decide')>();
  return { ...real, chooseGoal: vi.fn(real.chooseGoal) };
});

const DT = 1 / 60;
const NO_STOCK: Record<TrapKind, number> = { bomba: 0, pruzina: 0, elektrina: 0, pistole: 0, casovana: 0 };

/**
 * The hand-drawn 3×3 embassy of bot-decide:  0 1 2→exit
 *                                            3 4 5
 *                                            6 7 8
 * rooms 0-1-2 joined E-W, 1-4 joined N-S (4 a dead end). He stands in room 1.
 */
function known(ids: readonly number[]): KnownRoom[] {
  const doors: Record<number, Partial<Record<Dir, boolean>>> = {
    0: { E: true }, 1: { E: true, W: true, S: true }, 2: { W: true }, 4: { N: true },
  };
  return ids.map((id) => ({ id, doors: { N: false, S: false, E: false, W: false, ...doors[id] }, exit: id === 2 ? 'E' : null }));
}

/** The same with a loop: 0 also opens south to 3, 3 east to 4 — a way round 1 → 4 → 3 → 0. */
function roundMap(): KnownRoom[] {
  const round = known([0, 1, 2, 4]).map((r) => {
    if (r.id === 0) return { ...r, doors: { ...r.doors, S: true } };
    if (r.id === 4) return { ...r, doors: { ...r.doors, W: true } };
    return r;
  });
  return [...round, { id: 3, doors: { N: true, S: false, E: true, W: false }, exit: null }];
}

const piece = (id: number, x: number, o: Partial<PieceView> = {}): PieceView => ({ id, kind: 'skrin', x, z: 0, source: null, armoury: false, ...o });

/** Room 1's doors: W to 0 (key 0-1), E to 2 (1-2), S to 4 (1-4). */
const ROOM1_DOORS: DoorView[] = [
  { dir: 'W', key: '0-1', to: 0, open: false, exit: false },
  { dir: 'E', key: '1-2', to: 2, open: false, exit: false },
  { dir: 'S', key: '1-4', to: 4, open: false, exit: false },
];

function view(o: { hand?: Thing | null; pieces?: PieceView[]; known?: KnownRoom[]; stock?: Partial<Record<TrapKind, number>>;
  doors?: DoorView[]; armouryRoom?: number | null; armouryTimer?: number; time?: number } = {}): BotView {
  return {
    time: o.time ?? 100,
    cols: 3,
    rows: 3,
    hideAirport: false,
    self: {
      id: 0, room: 1, x: 100, z: 28, facing: 1, mode: 'normal', health: 7, maxHealth: 7, hand: o.hand ?? null,
      stock: { ...NO_STOCK, ...o.stock }, selected: null, trapPress: null, mapOpen: false, clock: 200,
      armouryTimer: o.armouryTimer ?? 0, swingCooldown: 0, attack: null, placing: false, doorOpening: false,
    },
    pieces: o.pieces ?? [],
    doors: o.doors ?? ROOM1_DOORS,
    opponent: null,
    known: o.known ?? known([0, 1, 2, 4]),
    armouryRoom: o.armouryRoom ?? null,
    itemRooms: null,
    glance: null,
  };
}

function note(mem: Memory, id: number, room: number, n: PieceNote): void {
  mem.pieces.set(id, { room, note: n, at: 0 });
}

/** Every piece of every known room searched and noted empty. */
function searchedAll(v: BotView): Memory {
  const mem = createMemory();
  for (const r of v.known) mem.roomPieces.set(r.id, []);
  for (const p of v.pieces) note(mem, p.id, v.self.room, { kind: 'empty' });
  mem.roomPieces.set(v.self.room, v.pieces.map((p) => p.id));
  return mem;
}

describe('traps (spec bot §5)', () => {
  /** Room 1 searched: piece 10 empty, piece 11 holds a klíč he already has (a noted item), one bomba. Room 7 is
   *  unvisited behind 4, so exploring is on offer too. */
  function trapRoom(): { v: BotView; mem: Memory } {
    const v = view({
      hand: kufrik('klic'), pieces: [piece(10, 40), piece(11, 160)], stock: { bomba: 1 },
      known: known([0, 1, 2, 4]).map((r) => (r.id === 4 ? { ...r, doors: { ...r.doors, S: true } } : r)),
    });
    const mem = searchedAll(v);
    note(mem, 11, 1, { kind: 'item', thing: 'secret' });
    return { v, mem };
  }

  it('IQ 5 sets a bomba on a piece of a room that holds a noted item', () => {
    const { v, mem } = trapRoom();
    const goal = chooseGoal(v, mem, 5, null, makeRng(1));
    expect(goal).toMatchObject({ kind: 'trap', trap: 'bomba' });
  });

  it('without a reason (no item, no exit, no glance) IQ 5 does not trap; IQ 1 would, anywhere valid', () => {
    const { v, mem } = trapRoom();
    mem.pieces.set(11, { room: 1, note: { kind: 'empty' }, at: 0 });
    expect(scoreGoals(v, mem, 5, null, makeRng(1)).some((g) => g.goal.kind === 'trap')).toBe(false);
    expect(scoreGoals(v, mem, 1, null, makeRng(1)).some((g) => g.goal.kind === 'trap')).toBe(true);
  });

  it('never a piece still to search or one holding a secret he lacks; never the armoury or a fixture', () => {
    const v = view({
      hand: kufrik('klic'), stock: { bomba: 1 },
      pieces: [piece(10, 40), piece(11, 100), piece(12, 160, { kind: 'zbrojnice', armoury: true }), piece(13, 190, { source: 'voda' })],
    });
    const mem = searchedAll(v);
    mem.pieces.delete(10); // never searched
    note(mem, 11, 1, { kind: 'item', thing: 'secret', secret: 'pas' }); // a secret he still needs
    mem.lastGlance = { room: 1, hand: null, at: 90 }; // a reason to trap here
    expect(scoreGoals(v, mem, 5, null, makeRng(1)).some((g) => g.goal.kind === 'trap')).toBe(false);
  });

  it('door traps go on a door of his room, never the exit, and only where he can still get everywhere without it', () => {
    const exitDoor: DoorView = { dir: 'N', key: 'exit', to: null, open: false, exit: true };
    const v = view({ stock: { elektrina: 1 }, doors: [...ROOM1_DOORS, exitDoor], known: roundMap() });
    const mem = searchedAll(v);
    mem.lastGlance = { room: 1, hand: null, at: 90 };
    const trap = scoreGoals(v, mem, 5, null, makeRng(1)).find((g) => g.goal.kind === 'trap')!.goal as Extract<Goal, { kind: 'trap' }>;
    expect(['0-1', '1-4']).toContain(trap.at); // 1-2 is the only way to room 2
    // With his own trap on 0-1 the loop is broken: 1-4 would now cut room 0 (and 3) off, 1-2 room 2.
    mem.ownTraps.set('d:0-1', 'elektrina');
    expect(scoreGoals(v, mem, 5, null, makeRng(1)).some((g) => g.goal.kind === 'trap')).toBe(false);

    // Without the loop every door is the only way somewhere.
    const tree = view({ stock: { elektrina: 1 }, doors: [...ROOM1_DOORS, exitDoor] });
    expect(scoreGoals(tree, searchedAll(tree), 5, null, makeRng(1)).some((g) => g.goal.kind === 'trap')).toBe(false);
  });

  it('he never routes through a door he trapped himself (unless holding its remedy)', () => {
    const v = view({ known: roundMap() });
    const mem = searchedAll(v);
    mem.ownTraps.set('d:0-1', 'elektrina');
    expect(pathTo(v, mem, 0)?.map((h) => h.key)).toEqual(['1-4', '3-4', '0-3']);
    expect(pathTo({ ...v, self: { ...v.self, hand: remedy('destnik') } }, mem, 0)?.map((h) => h.key)).toEqual(['0-1']);
  });

  it('a second trap in the same room is worth less than the first', () => {
    const { v, mem } = trapRoom();
    const first = scoreGoals(v, mem, 5, null, makeRng(1)).find((g) => g.goal.kind === 'trap')!.score;
    mem.ownTraps.set('p:10', 'bomba');
    const v2 = { ...v, self: { ...v.self, stock: { ...NO_STOCK, pruzina: 1 } } };
    const second = scoreGoals(v2, mem, 5, null, makeRng(1)).find((g) => g.goal.kind === 'trap')!.score;
    expect(second).toBeLessThan(first);
  });

  it('he does not search his own trapped piece at IQ 3; at IQ 1, once forgetting takes it, he can', () => {
    const v = view({ pieces: [piece(10, 100)], known: known([1]) });
    const mem3 = createMemory();
    mem3.ownTraps.set('p:10', 'bomba');
    forget(mem3, 3, 600, makeRng(1)); // IQ 3 never forgets his own traps
    expect(scoreGoals(v, mem3, 3, null, makeRng(1)).some((g) => g.goal.kind === 'search' && g.goal.piece === 10)).toBe(false);
    expect(stillWorth(v, mem3, { kind: 'search', piece: 10 }, 0, null)).toBe(false);

    const mem1 = createMemory();
    mem1.ownTraps.set('p:10', 'bomba');
    forget(mem1, 1, 600, makeRng(1)); // chance 0.5/min × 10 min: forgetting forced
    expect(mem1.ownTraps.size).toBe(0);
    expect(scoreGoals(v, mem1, 1, null, makeRng(1)).some((g) => g.goal.kind === 'search' && g.goal.piece === 10)).toBe(true);
  });

  it('a time bomb of his own ticking in his room: he leaves through a door, and does not come back while it ticks', () => {
    const v = view({ pieces: [piece(10, 100)], stock: { casovana: 1 } });
    const mem = createMemory();
    remember(mem, v, [{ type: 'trapSet', spy: 0, trap: 'casovana' }], { pendingTrapTarget: 'f:1', searching: null, door: null });
    const goal = chooseGoal(v, mem, 5, null, makeRng(1));
    expect(goal.kind).toBe('flee');
    expect(stillWorth(v, mem, goal, 100, null)).toBe(true);

    // Next door, with piece 10 unsearched back in room 1: not worth going back into while it ticks.
    const next = { ...view({ known: known([0, 1, 2, 4]) }), self: { ...v.self, room: 0 }, pieces: [], doors: [] };
    expect(scoreGoals(next, mem, 5, null, makeRng(1)).some((g) => g.goal.kind === 'search' && g.goal.piece === 10)).toBe(false);
    const later = { ...next, time: 100 + RULES.timeBombFuse + 1 };
    remember(mem, later, [], { pendingTrapTarget: null, searching: null, door: null });
    expect(mem.ticking.size).toBe(0);
  });
});

describe('remedies (spec bot §5)', () => {
  /** He is in room 1; the kufřík is noted in room 0, reachable only through door 0-1, where he died by elektřina.
   *  A věšák (deštník) is noted in room 2. */
  function deadlyDoor(hand: Thing | null): { v: BotView; mem: Memory } {
    const v = view({ hand, known: known([0, 1, 2, 4]) });
    const mem = searchedAll(v);
    note(mem, 20, 0, { kind: 'item', thing: 'kufrik' });
    note(mem, 30, 2, { kind: 'fixture', remedy: 'destnik' });
    mem.dangers.push({ at: { door: '0-1' }, cause: 'elektrina', since: 50 });
    return { v, mem };
  }

  it('after dying at a door by elektřina he fetches a deštník from a known věšák before using it', () => {
    const { v, mem } = deadlyDoor(null);
    const goal = chooseGoal(v, mem, 5, null, makeRng(1));
    expect(goal).toEqual({ kind: 'remedy', piece: 30, remedy: 'destnik' });
    expect(stillWorth(v, mem, goal, 100, null)).toBe(true);
  });

  it('with the deštník in hand he goes through the door for the kufřík', () => {
    const { v, mem } = deadlyDoor(remedy('destnik'));
    expect(chooseGoal(v, mem, 5, null, makeRng(1))).toEqual({ kind: 'fetch', piece: 20 });
  });

  it('when another way round is known he detours instead', () => {
    const { mem } = deadlyDoor(null);
    const v = view({ known: roundMap() });
    mem.roomPieces.set(3, []);
    expect(chooseGoal(v, mem, 5, null, makeRng(1))).toEqual({ kind: 'fetch', piece: 20 });
  });

  it('holding a secret he does not fetch a remedy (the hand holds one thing; the swap would leave the secret)', () => {
    const { v, mem } = deadlyDoor(secret('pas'));
    expect(scoreGoals(v, mem, 5, null, makeRng(1)).some((g) => g.goal.kind === 'remedy')).toBe(false);
  });
});

describe('the armoury (spec bot §5)', () => {
  it('low stock, the cabinet open for him and its room known → he goes for it', () => {
    const v = view({ armouryRoom: 0, known: known([0, 1, 2]) });
    const mem = searchedAll(v);
    expect(chooseGoal(v, mem, 5, null, makeRng(1))).toEqual({ kind: 'armoury', piece: null });
    const closed = view({ armouryRoom: 0, armouryTimer: 10, known: known([0, 1, 2]) });
    expect(scoreGoals(closed, mem, 5, null, makeRng(1)).some((g) => g.goal.kind === 'armoury')).toBe(false);
    const stocked = view({ armouryRoom: 0, stock: { bomba: 1, pruzina: 1 }, known: known([0, 1, 2]) });
    expect(scoreGoals(stocked, mem, 5, null, makeRng(1)).some((g) => g.goal.kind === 'armoury')).toBe(false);
  });
});

// ---------- with the real game ----------

/** openGame with spy 0 in room 0 holding a kufřík with klíč, a klíč hidden in room 0's first piece (he will note it
 *  as an item he cannot take), and `stock`. */
function trapGame(stock: Partial<Record<TrapKind, number>>): GameState {
  const s = openGame();
  s.spies[0].hand = kufrik('klic');
  s.spies[0].stock = { ...NO_STOCK, ...stock };
  s.furniture[s.rooms[0].furniture[0]].hidden = secret('klic');
  return s;
}

function play(s: GameState, iq: Iq, seed: number, seconds: number, each?: (events: GameEvent[]) => void): void {
  const bot = createBot(0, iq, seed);
  let events: GameEvent[] = [];
  for (let t = 0; t < seconds / DT && s.result === null; t++) {
    const input = bot.think(s, events, DT);
    events = step(s, [input, NO_INPUT], DT);
    each?.(events);
  }
}

const mine = (events: GameEvent[], type: GameEvent['type']) => events.some((e) => e.type === type && 'spy' in e && e.spy === 0);

describe('traps, remedies and the armoury in the real game', () => {
  const SEEDS = Array.from({ length: 10 }, (_, i) => i + 1);

  function setsWithin10s(iq: Iq, seed: number): boolean {
    const s = trapGame({ bomba: 1 });
    let set = false;
    play(s, iq, seed, 10, (ev) => (set ||= mine(ev, 'trapSet')));
    return set;
  }

  it('IQ 5 sets the bomba within 10 s in a room holding a noted item; IQ 1 in fewer seeded runs', () => {
    const iq5 = SEEDS.filter((seed) => setsWithin10s(5, seed)).length;
    const iq1 = SEEDS.filter((seed) => setsWithin10s(1, seed)).length;
    expect(iq5).toBeGreaterThanOrEqual(9);
    expect(iq1).toBeLessThan(iq5);
  });

  it('IQ 3 never searches the piece he trapped himself (he stays alive, the trap stays put)', () => {
    for (const seed of SEEDS.slice(0, 5)) {
      const s = trapGame({ bomba: 1 });
      s.spies[0].visited.fill(true); // nothing new to explore: the room's pieces stay in his mind
      let trapped: number | null = null;
      let died = false;
      play(s, 3, seed, 40, (ev) => {
        if (trapped === null && mine(ev, 'trapSet')) trapped = s.furniture.find((f) => f.trap?.owner === 0)?.id ?? null;
        died ||= mine(ev, 'died');
      });
      expect(died, `seed ${seed}`).toBe(false);
      if (trapped !== null) expect(s.furniture[trapped].trap, `seed ${seed}`).not.toBeNull();
    }
  });

  it('with no stock and the armoury room known he walks there and is resupplied', () => {
    for (const seed of SEEDS.slice(0, 5)) {
      const s = openGame();
      makeArmoury(s, 1);
      s.spies[0].stock = { ...NO_STOCK };
      let resupplied = false;
      play(s, 5, seed, 30, (ev) => (resupplied ||= mine(ev, 'resupplied')));
      expect(resupplied, `seed ${seed}`).toBe(true);
    }
  });
});

describe('goalSince (Task 6 minor)', () => {
  it('a spent goal chosen again counts as taken up anew: no full rebuild every frame', () => {
    // Room 0 alone (no doors), one piece: once searched empty, the only goal left is a second look at that same piece.
    const s = openGame();
    const room = s.rooms[0];
    for (const d of DIRS) room.doors[d] = false;
    room.furniture = [room.furniture[0]];
    s.spies[0].stock = { ...NO_STOCK };
    const choose = vi.mocked(decide.chooseGoal);
    const bot = createBot(0, 5, 1);
    let events: GameEvent[] = [];
    // The first search (noted empty), and into the second looks.
    for (let t = 0; t < 6 / DT; t++) events = step(s, [bot.think(s, events, DT), NO_INPUT], DT);
    choose.mockClear();
    const ticks = 3 / DT;
    for (let t = 0; t < ticks; t++) events = step(s, [bot.think(s, events, DT), NO_INPUT], DT);
    expect(bot.goal).toEqual({ kind: 'search', piece: room.furniture[0] });
    // One rebuild per think beat (0.2 s) plus one per finished search: far fewer than one per frame.
    expect(choose.mock.calls.length).toBeLessThan(ticks / 4);
  });
});
