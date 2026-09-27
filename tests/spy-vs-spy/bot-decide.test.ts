import { describe, expect, it } from 'vitest';
import { chooseGoal, exploreFor, scoreGoals, stillWorth, STICKY, type Goal } from '../../src/games/spy-vs-spy/bot/decide';
import { createMemory, giveUp, type Memory, type PieceNote } from '../../src/games/spy-vs-spy/bot/memory';
import type { BotView, KnownRoom, PieceView } from '../../src/games/spy-vs-spy/bot/view';
import type { Dir, Thing } from '../../src/games/spy-vs-spy/logic/state';
import { makeRng } from '../../src/shared/rng';
import { kufrik, secret } from './fixtures';

/**
 * A 3×3 embassy drawn by hand:  0 1 2→exit
 *                               3 4 5
 *                               6 7 8
 * rooms 0-1-2 joined E-W, 1-4-7 joined N-S (7 never visited). He stands in room 1.
 */
function known(ids: readonly number[], exitKnown = true): KnownRoom[] {
  const doors: Record<number, Partial<Record<Dir, boolean>>> = {
    0: { E: true }, 1: { E: true, W: true, S: true }, 2: { W: true }, 4: { N: true, S: true },
  };
  return ids.map((id) => ({
    id,
    doors: { N: false, S: false, E: false, W: false, ...doors[id] },
    exit: exitKnown && id === 2 ? 'E' : null,
  }));
}

/** Every room of the hand-drawn map visited, with no door to an unvisited one. */
const closedMap = (exitKnown = true) => known([0, 1, 2, 4], exitKnown).map((r) => (r.id === 4 ? { ...r, doors: { ...r.doors, S: false } } : r));

function piece(id: number, x: number): PieceView {
  return { id, kind: 'skrin', x, z: 0, source: null, armoury: false };
}

function view(o: { hand?: Thing | null; pieces?: PieceView[]; known?: KnownRoom[]; clock?: number; room?: number; doors?: BotView['doors'] } = {}): BotView {
  return {
    time: 100,
    cols: 3,
    rows: 3,
    hideAirport: false,
    self: {
      id: 0, room: o.room ?? 1, x: 100, z: 28, facing: 1, mode: 'normal', health: 7, maxHealth: 7, hand: o.hand ?? null,
      stock: { bomba: 0, pruzina: 0, elektrina: 0, pistole: 0, casovana: 0 }, selected: null, trapPress: null,
      mapOpen: false, clock: o.clock ?? 200, armouryTimer: 0, swingCooldown: 0, attack: null, placing: false, doorOpening: false,
    },
    pieces: o.pieces ?? [],
    doors: o.doors ?? [],
    opponent: null,
    known: o.known ?? known([0, 1, 2, 4]),
    armouryRoom: null,
    itemRooms: null,
    glance: null,
  };
}

function note(mem: Memory, id: number, room: number, n: PieceNote): void {
  mem.pieces.set(id, { room, note: n, at: 0 });
}

/** A memory where every piece of every known room has been searched (nothing left to look into). */
function searchedAll(v: BotView): Memory {
  const mem = createMemory();
  for (const r of v.known) mem.roomPieces.set(r.id, []);
  for (const p of v.pieces) note(mem, p.id, v.self.room, { kind: 'empty' });
  mem.roomPieces.set(v.self.room, v.pieces.map((p) => p.id));
  return mem;
}

describe('decide: goal scores (spec bot §5)', () => {
  it('the full kufřík and a known exit → escape', () => {
    const v = view({ hand: kufrik('klic', 'penize', 'pas', 'plany'), pieces: [piece(10, 50)] });
    const mem = createMemory();
    note(mem, 20, 0, { kind: 'item', thing: 'secret', secret: 'pas' });
    expect(chooseGoal(v, mem, 5, null, makeRng(1))).toEqual({ kind: 'escape' });
  });

  it('the full kufřík with the exit not yet found → explore, never escape', () => {
    const v = view({ hand: kufrik('klic', 'penize', 'pas', 'plany'), known: known([0, 1, 2, 4], false) });
    const goals = scoreGoals(v, searchedAll(v), 5, null, makeRng(1));
    expect(goals[0].goal).toEqual({ kind: 'explore' });
    expect(goals.some((g) => g.goal.kind === 'escape')).toBe(false);
  });

  it('holding the kufřík without plány and a noted piece with plány → fetch it', () => {
    const v = view({ hand: kufrik('klic', 'penize', 'pas'), pieces: [piece(10, 50)] });
    const mem = createMemory();
    note(mem, 20, 4, { kind: 'item', thing: 'secret', secret: 'plany' });
    expect(chooseGoal(v, mem, 5, null, makeRng(1))).toEqual({ kind: 'fetch', piece: 20 });
  });

  it('a noted secret he already carries is not worth fetching', () => {
    const v = view({ hand: kufrik('klic', 'penize', 'pas') });
    const mem = searchedAll(v);
    note(mem, 20, 4, { kind: 'item', thing: 'secret', secret: 'pas' });
    expect(scoreGoals(v, mem, 5, null, makeRng(1)).some((g) => g.goal.kind === 'fetch')).toBe(false);
  });

  it('with a loose secret in hand, the noted kufřík is worth fetching; another loose secret is not', () => {
    const v = view({ hand: secret('klic') });
    const mem = searchedAll(v);
    note(mem, 20, 4, { kind: 'item', thing: 'secret', secret: 'pas' });
    note(mem, 21, 0, { kind: 'item', thing: 'kufrik' });
    const goals = scoreGoals(v, mem, 5, null, makeRng(1));
    expect(goals[0].goal).toEqual({ kind: 'fetch', piece: 21 });
    expect(goals.some((g) => g.goal.kind === 'fetch' && g.goal.piece === 20)).toBe(false);
  });

  it('nothing known → searches the nearest unsearched piece in his room', () => {
    const v = view({ pieces: [piece(10, 20), piece(11, 130)] });
    const mem = createMemory();
    expect(chooseGoal(v, mem, 5, null, makeRng(1))).toEqual({ kind: 'search', piece: 11 });
  });

  it('nothing known and his room searched → explore', () => {
    const v = view({ pieces: [piece(10, 40)], known: known([1]) });
    const mem = searchedAll(v);
    expect(chooseGoal(v, mem, 5, null, makeRng(1))).toEqual({ kind: 'explore' });
  });

  it('fixtures and the armoury are never searched', () => {
    const v = view({
      pieces: [{ ...piece(10, 40), source: 'voda' }, { ...piece(11, 140), kind: 'zbrojnice', armoury: true }],
      known: known([1]),
    });
    const mem = searchedAll(v);
    mem.pieces.delete(10);
    mem.pieces.delete(11);
    expect(scoreGoals(v, mem, 5, null, makeRng(1)).some((g) => g.goal.kind === 'search')).toBe(false);
  });

  it('after 8 searches with no find and clock > 60 s the map wins at IQ 5', () => {
    const v = view({ pieces: [piece(10, 40)], clock: 120 });
    const mem = createMemory();
    mem.searchedCount = 8;
    mem.foundSinceMap = 0;
    expect(chooseGoal(v, mem, 5, null, makeRng(1))).toEqual({ kind: 'map' });

    mem.foundSinceMap = 1;
    expect(chooseGoal(v, mem, 5, null, makeRng(1)).kind).not.toBe('map');
    mem.foundSinceMap = 0;
    expect(chooseGoal(view({ pieces: [piece(10, 40)], clock: 50 }), mem, 5, null, makeRng(1)).kind).not.toBe('map');
  });

  it('stickiness keeps the current goal unless another beats it by more than STICKY', () => {
    // Two pieces: the near one scores a little higher than the far one.
    const v = view({ pieces: [piece(10, 100), piece(11, 190)] });
    const mem = createMemory();
    const far: Goal = { kind: 'search', piece: 11 };
    const fresh = scoreGoals(v, mem, 5, null, makeRng(1));
    expect(fresh[0].goal).toEqual({ kind: 'search', piece: 10 });
    const gap = fresh[0].score - fresh.find((g) => g.goal.kind === 'search' && g.goal.piece === 11)!.score;
    expect(gap).toBeGreaterThan(0);
    expect(gap).toBeLessThan(STICKY);
    expect(chooseGoal(v, mem, 5, far, makeRng(1))).toEqual(far);

    // A fetch of the kufřík beats the far piece by more than STICKY: he switches.
    note(mem, 21, 1, { kind: 'item', thing: 'kufrik' });
    expect(chooseGoal(v, mem, 5, far, makeRng(1))).toEqual({ kind: 'fetch', piece: 21 });
  });

  it('noise at IQ 1 changes the choice in some seeded cases, at IQ 5 never in the same cases', () => {
    const v = view({ hand: kufrik('klic'), pieces: [piece(10, 100)] });
    const mem = createMemory();
    note(mem, 20, 4, { kind: 'item', thing: 'secret', secret: 'plany' });
    const plain = scoreGoals(v, mem, 5, null, makeRng(1))[0].goal;
    expect(plain).toEqual({ kind: 'fetch', piece: 20 });
    let iq1Changed = 0;
    for (let seed = 1; seed <= 50; seed++) {
      if (JSON.stringify(chooseGoal(v, mem, 1, null, makeRng(seed))) !== JSON.stringify(plain)) iq1Changed++;
      expect(chooseGoal(v, mem, 5, null, makeRng(seed))).toEqual(plain);
    }
    expect(iq1Changed).toBeGreaterThan(0);
    expect(iq1Changed).toBeLessThan(50);
  });

  it('scores come out highest first', () => {
    const v = view({ pieces: [piece(10, 40), piece(11, 140)] });
    const goals = scoreGoals(v, createMemory(), 1, null, makeRng(3));
    for (let i = 1; i < goals.length; i++) expect(goals[i - 1].score).toBeGreaterThanOrEqual(goals[i].score);
  });

  describe('last resort: something always scores (fix round 1)', () => {
    /** Everything visited and searched, a secret still missing, no finds to make the map pay: nothing regular scores. */
    function spent(): { v: BotView; mem: Memory } {
      const v = view({ hand: kufrik('klic'), pieces: [piece(10, 40)], known: closedMap() });
      const mem = searchedAll(v);
      mem.pieces.get(10)!.at = 50;
      note(mem, 20, 0, { kind: 'empty' });
      mem.pieces.get(20)!.at = 10;
      note(mem, 21, 4, { kind: 'empty' });
      mem.pieces.get(21)!.at = 30;
      mem.foundSinceMap = 1;
      return { v, mem };
    }

    it('re-searches the oldest piece noted empty', () => {
      const { v, mem } = spent();
      expect(chooseGoal(v, mem, 5, null, makeRng(1))).toEqual({ kind: 'search', piece: 20 });
    });

    it('a piece he gave up on is skipped while he leaves it alone', () => {
      const { v, mem } = spent();
      giveUp(mem, 20, v.time);
      expect(chooseGoal(v, mem, 5, null, makeRng(1))).toEqual({ kind: 'search', piece: 21 });
    });

    it('the map comes first after MAP_AFTER searches since the last one (finds or not) while the clock allows', () => {
      const { v, mem } = spent();
      mem.searchedCount = 7;
      expect(chooseGoal(v, mem, 5, null, makeRng(1))).toEqual({ kind: 'search', piece: 20 });
      mem.searchedCount = 8;
      expect(chooseGoal(v, mem, 5, null, makeRng(1))).toEqual({ kind: 'map' });
      expect(chooseGoal({ ...v, self: { ...v.self, clock: 40 } }, mem, 5, null, makeRng(1))).toEqual({ kind: 'search', piece: 20 });
    });

    it('a re-search stays worth it until the piece is noted again', () => {
      const { v, mem } = spent();
      const goal: Goal = { kind: 'search', piece: 20 };
      expect(stillWorth(v, mem, goal, 60, null)).toBe(true);
      note(mem, 20, 0, { kind: 'empty' });
      mem.pieces.get(20)!.at = 70;
      expect(stillWorth({ ...v, time: 70 }, mem, goal, 60, null)).toBe(false);
    });

    it('the full kufřík with no exit in sight and nothing unvisited: he walks the least recently seen room', () => {
      const v = view({ hand: kufrik('klic', 'penize', 'pas', 'plany'), known: closedMap(false) });
      const mem = searchedAll(v);
      mem.lastIn.set(0, 20);
      mem.lastIn.set(2, 5);
      mem.lastIn.set(4, 30);
      expect(chooseGoal(v, mem, 5, null, makeRng(1))).toEqual({ kind: 'explore' });
      expect(exploreFor(v, mem)).toMatchObject({ room: 2, why: 'wander' });
    });

    it('the full kufřík in the exit room with no exit door in view: not escape (it could not be done), explore', () => {
      const v = view({ hand: kufrik('klic', 'penize', 'pas', 'plany'), known: closedMap(), room: 2 });
      const goals = scoreGoals(v, searchedAll(v), 5, null, makeRng(1));
      expect(goals.some((g) => g.goal.kind === 'escape')).toBe(false);
      expect(goals[0].goal).toEqual({ kind: 'explore' });
    });
  });
});
