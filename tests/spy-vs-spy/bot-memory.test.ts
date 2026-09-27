import { describe, expect, it } from 'vitest';
import { createMemory, forget, gaveUp, giveUp, GIVE_UP_FOR, remember, type Memory } from '../../src/games/spy-vs-spy/bot/memory';
import type { BotView, PieceView } from '../../src/games/spy-vs-spy/bot/view';
import { IQ_PARAMS } from '../../src/games/spy-vs-spy/bot/iq';
import { makeRng } from '../../src/shared/rng';
import type { GameEvent } from '../../src/games/spy-vs-spy/logic/state';

const NO_CTX = { pendingTrapTarget: null, searching: null, door: null };

function piece(id: number, overrides: Partial<PieceView> = {}): PieceView {
  return { id, kind: 'skrin', x: 0, z: 0, source: null, armoury: false, ...overrides };
}

function view(overrides: Partial<BotView> = {}): BotView {
  return {
    time: 10,
    cols: 3,
    rows: 3,
    hideAirport: false,
    self: {
      id: 0, room: 1, x: 0, z: 0, facing: 1, mode: 'normal', health: 7, maxHealth: 7, hand: null,
      stock: { bomba: 0, pruzina: 0, elektrina: 0, pistole: 0, casovana: 0 }, selected: null, trapPress: null,
      mapOpen: false, clock: 0, armouryTimer: 0, swingCooldown: 0, attack: null, placing: false, doorOpening: false,
    },
    pieces: [],
    doors: [],
    opponent: null,
    known: [],
    armouryRoom: null,
    itemRooms: null,
    glance: null,
    ...overrides,
  };
}

describe('memory (spec bot §4)', () => {
  it('createMemory starts empty', () => {
    const mem = createMemory();
    expect(mem.pieces.size).toBe(0);
    expect(mem.itemRoomsSeen.size).toBe(0);
    expect(mem.ownTraps.size).toBe(0);
    expect(mem.dangers).toEqual([]);
    expect(mem.lastGlance).toBeNull();
    expect(mem.lastSeenOpponent).toBeNull();
    expect(mem.searchedCount).toBe(0);
    expect(mem.foundSinceMap).toBe(0);
  });

  it('found with thing null marks the piece empty', () => {
    const mem = createMemory();
    const events: GameEvent[] = [{ type: 'found', spy: 0, thing: null, furniture: 5 }];
    remember(mem, view(), events, NO_CTX);
    expect(mem.pieces.get(5)).toMatchObject({ room: 1, note: { kind: 'empty' } });
    expect(mem.searchedCount).toBe(1);
    expect(mem.foundSinceMap).toBe(0);
  });

  it('found with a remedy marks the piece with that remedy kind', () => {
    const mem = createMemory();
    const events: GameEvent[] = [{ type: 'found', spy: 0, thing: { kind: 'remedy', remedy: 'voda' }, furniture: 5 }];
    remember(mem, view(), events, NO_CTX);
    expect(mem.pieces.get(5)).toMatchObject({ note: { kind: 'remedy', remedy: 'voda' } });
  });

  it('found with a secret: he took it, so the piece is empty now; bumps foundSinceMap', () => {
    const mem = createMemory();
    const events: GameEvent[] = [
      { type: 'found', spy: 0, thing: { kind: 'secret', secret: 'klic', lastHolder: null }, furniture: 5 },
    ];
    remember(mem, view(), events, NO_CTX);
    expect(mem.pieces.get(5)).toMatchObject({ note: { kind: 'empty' } });
    expect(mem.searchedCount).toBe(1);
    expect(mem.foundSinceMap).toBe(1);
  });

  it('stored: the piece is empty now (secret into his kufřík, or the kufřík taken); counts as a find', () => {
    const mem = createMemory();
    remember(mem, view(), [{ type: 'stored', spy: 0, secret: 'pas', furniture: 5 }], NO_CTX);
    expect(mem.pieces.get(5)).toMatchObject({ room: 1, note: { kind: 'empty' } });
    expect(mem.searchedCount).toBe(1);
    expect(mem.foundSinceMap).toBe(1);
  });

  it('swapped: the piece now holds what he gave', () => {
    const mem = createMemory();
    remember(mem, view(), [{
      type: 'swapped', spy: 0, furniture: 5,
      gave: { kind: 'secret', secret: 'pas', lastHolder: 0 }, took: { kind: 'kufrik', contents: [], lastHolder: 0 },
    }], NO_CTX);
    expect(mem.pieces.get(5)).toMatchObject({ note: { kind: 'item', thing: 'secret', secret: 'pas' } });
    expect(mem.searchedCount).toBe(1);
    expect(mem.foundSinceMap).toBe(1);
  });

  it('hidden: the piece now holds what he put in', () => {
    const mem = createMemory();
    remember(mem, view(), [{ type: 'hidden', spy: 0, furniture: 5, thing: { kind: 'kufrik', contents: ['klic'], lastHolder: 0 } }], NO_CTX);
    expect(mem.pieces.get(5)).toMatchObject({ note: { kind: 'item', thing: 'kufrik' } });
    expect(mem.searchedCount).toBe(1);
    expect(mem.foundSinceMap).toBe(0);
  });

  it('dropped on death into a piece he has seen: that piece holds it now', () => {
    const mem = createMemory();
    remember(mem, view({ self: { ...view().self, room: 4 }, pieces: [piece(8)] }), [], NO_CTX);
    remember(mem, view(), [{ type: 'dropped', spy: 0, furniture: 8, thing: { kind: 'secret', secret: 'plany', lastHolder: 0 } }], NO_CTX);
    expect(mem.pieces.get(8)).toMatchObject({ room: 4, note: { kind: 'item', thing: 'secret', secret: 'plany' } });
  });

  it('remembers which searchable pieces stand in each room he has been in (not fixtures, not the armoury)', () => {
    const mem = createMemory();
    remember(mem, view({ pieces: [piece(3), piece(4, { source: 'voda' }), piece(5, { armoury: true }), piece(6)] }), [], NO_CTX);
    expect(mem.roomPieces.get(1)).toEqual([3, 6]);
  });

  it('alreadyHave marks the piece as an item he could not take (kind unknown)', () => {
    const mem = createMemory();
    const events: GameEvent[] = [{ type: 'alreadyHave', spy: 0, furniture: 7 }];
    remember(mem, view(), events, NO_CTX);
    expect(mem.pieces.get(7)).toMatchObject({ note: { kind: 'item', thing: 'secret' } });
    expect((mem.pieces.get(7)!.note as { secret?: string }).secret).toBeUndefined();
  });

  it('resupplied marks the piece as the armoury', () => {
    const mem = createMemory();
    const events: GameEvent[] = [{ type: 'resupplied', spy: 0, trap: 'bomba', furniture: 2 }];
    remember(mem, view(), events, NO_CTX);
    expect(mem.pieces.get(2)).toMatchObject({ note: { kind: 'armoury' } });
  });

  it('trapSet with a pending target records the own trap', () => {
    const mem = createMemory();
    const events: GameEvent[] = [{ type: 'trapSet', spy: 0, trap: 'pruzina' }];
    remember(mem, view(), events, { ...NO_CTX, pendingTrapTarget: 'p:5' });
    expect(mem.ownTraps.get('p:5')).toBe('pruzina');
  });

  it('trapSet without a pending target records nothing', () => {
    const mem = createMemory();
    const events: GameEvent[] = [{ type: 'trapSet', spy: 0, trap: 'pruzina' }];
    remember(mem, view(), events, NO_CTX);
    expect(mem.ownTraps.size).toBe(0);
  });

  it('died to a furniture trap while searching a piece records a danger at that piece', () => {
    const mem = createMemory();
    const events: GameEvent[] = [{ type: 'died', spy: 0, cause: 'bomba' }];
    remember(mem, view(), events, { ...NO_CTX, searching: 9 });
    expect(mem.dangers).toEqual([{ at: { piece: 9 }, cause: 'bomba', since: 10 }]);
  });

  it('died to a door trap at a door records a danger at that door', () => {
    const mem = createMemory();
    const events: GameEvent[] = [{ type: 'died', spy: 0, cause: 'elektrina' }];
    remember(mem, view(), events, { ...NO_CTX, door: 'd:0:E' });
    expect(mem.dangers).toEqual([{ at: { door: 'd:0:E' }, cause: 'elektrina', since: 10 }]);
  });

  it('died to a furniture trap with no search target records nothing', () => {
    const mem = createMemory();
    const events: GameEvent[] = [{ type: 'died', spy: 0, cause: 'pruzina' }];
    remember(mem, view(), events, NO_CTX);
    expect(mem.dangers).toEqual([]);
  });

  it('died to a timed bomb records a danger at the whole room', () => {
    const mem = createMemory();
    const events: GameEvent[] = [{ type: 'died', spy: 0, cause: 'casovana' }];
    remember(mem, view({ self: { ...view().self, room: 4 } }), events, NO_CTX);
    expect(mem.dangers).toEqual([{ at: { room: 4 }, cause: 'casovana', since: 10 }]);
  });

  it('died in a fight records no danger', () => {
    const mem = createMemory();
    const events: GameEvent[] = [{ type: 'died', spy: 0, cause: 'fight', killer: 1 }];
    remember(mem, view(), events, { ...NO_CTX, searching: 9, door: 'd:0:E' });
    expect(mem.dangers).toEqual([]);
  });

  it('events for the other spy are ignored', () => {
    const mem = createMemory();
    const events: GameEvent[] = [{ type: 'found', spy: 1, thing: null, furniture: 5 }];
    remember(mem, view(), events, NO_CTX);
    expect(mem.pieces.size).toBe(0);
  });

  it('fixtures in view are recorded without any search', () => {
    const mem = createMemory();
    remember(mem, view({ pieces: [piece(3, { source: 'destnik' })] }), [], NO_CTX);
    expect(mem.pieces.get(3)).toMatchObject({ note: { kind: 'fixture', remedy: 'destnik' } });
  });

  it('records the opponent glimpse and last glance', () => {
    const mem = createMemory();
    remember(mem, view({ opponent: { x: 1, z: 2, facing: 1, health: 7, mode: 'normal', attack: null, strikeIn: 0, blocking: false, ducking: false, carrying: false } }), [], NO_CTX);
    expect(mem.lastSeenOpponent).toEqual({ room: 1, at: 10 });

    const mem2 = createMemory();
    remember(mem2, view({ glance: { room: 6, hand: null } }), [], NO_CTX);
    expect(mem2.lastGlance).toEqual({ room: 6, hand: null, at: 10 });
  });

  it('records item rooms seen from the paid map', () => {
    const mem = createMemory();
    remember(mem, view({ itemRooms: [2, 5] }), [], NO_CTX);
    expect(mem.itemRoomsSeen.get(2)).toBe(10);
    expect(mem.itemRoomsSeen.get(5)).toBe(10);
  });

  it('notes when he last stood in each room', () => {
    const mem = createMemory();
    remember(mem, view(), [], NO_CTX);
    remember(mem, view({ time: 30, self: { ...view().self, room: 4 } }), [], NO_CTX);
    expect(mem.lastIn.get(1)).toBe(10);
    expect(mem.lastIn.get(4)).toBe(30);
  });

  it('giving up on a piece leaves it alone for a while without noting anything about it', () => {
    const mem = createMemory();
    giveUp(mem, 5, 100);
    expect(mem.pieces.has(5)).toBe(false);
    expect(gaveUp(mem, 5, 100 + GIVE_UP_FOR - 1)).toBe(true);
    expect(gaveUp(mem, 5, 100 + GIVE_UP_FOR)).toBe(false);
    expect(gaveUp(mem, 6, 100)).toBe(false);
  });

  it('the open map drops dots of visited rooms that no longer show one', () => {
    const mem = createMemory();
    remember(mem, view({ itemRooms: [2, 5] }), [], NO_CTX);
    const known = [2, 5].map((id) => ({ id, doors: { N: false, S: false, E: false, W: false }, exit: null }));
    remember(mem, view({ time: 20, itemRooms: [5], known }), [], NO_CTX);
    expect(mem.itemRoomsSeen.has(2)).toBe(false);
    expect(mem.itemRoomsSeen.get(5)).toBe(20);
  });

  it('mapOpened resets searchedCount and foundSinceMap', () => {
    const mem = createMemory();
    mem.searchedCount = 4;
    mem.foundSinceMap = 2;
    remember(mem, view(), [{ type: 'mapOpened', spy: 0 }], NO_CTX);
    expect(mem.searchedCount).toBe(0);
    expect(mem.foundSinceMap).toBe(0);
  });
});

describe('forget (spec bot §4: forgetting)', () => {
  function fullMemory(): Memory {
    const mem = createMemory();
    for (let i = 0; i < 20; i++) mem.pieces.set(i, { room: 0, note: { kind: 'empty' }, at: 0 });
    for (let i = 0; i < 10; i++) mem.itemRoomsSeen.set(i, 0);
    for (let i = 0; i < 10; i++) mem.dangers.push({ at: { piece: i }, cause: 'bomba', since: 0 });
    mem.lastGlance = { room: 1, hand: null, at: 0 };
    mem.lastSeenOpponent = { room: 1, at: 0 };
    mem.ownTraps.set('p:1', 'bomba');
    mem.ownTraps.set('d:0:E', 'elektrina');
    return mem;
  }

  function totalEntries(mem: Memory): number {
    return mem.pieces.size + mem.itemRoomsSeen.size + mem.dangers.length + (mem.lastGlance ? 1 : 0) + (mem.lastSeenOpponent ? 1 : 0);
  }

  it('IQ 5 never forgets anything over 10 simulated minutes', () => {
    const mem = fullMemory();
    const before = totalEntries(mem);
    const beforeTraps = mem.ownTraps.size;
    const rng = makeRng(42);
    for (let t = 0; t < 600; t += 1) forget(mem, 5, 1, rng);
    expect(totalEntries(mem)).toBe(before);
    expect(mem.ownTraps.size).toBe(beforeTraps);
  });

  it('IQ 1 forgets some entries over 10 simulated minutes (seeded, exact count)', () => {
    const mem = fullMemory();
    const before = totalEntries(mem);
    const rng = makeRng(42);
    for (let t = 0; t < 600; t += 1) forget(mem, 1, 1, rng);
    const after = totalEntries(mem);
    expect(after).toBeLessThan(before);
    expect(after).toBe(0);
    expect(mem.ownTraps.size).toBeLessThan(2);
  });

  it('IQ 3 never forgets own traps, even though other entries fade', () => {
    expect(IQ_PARAMS[3].forgetOwnTraps).toBe(false);
    const mem = fullMemory();
    const before = totalEntries(mem);
    const rng = makeRng(7);
    for (let t = 0; t < 600; t += 1) forget(mem, 3, 1, rng);
    expect(mem.ownTraps.size).toBe(2);
    expect(totalEntries(mem)).toBeLessThan(before);
  });
});
