import { describe, expect, it } from 'vitest';
import {
  decisionRoom, exits, groupsInRoom, neighbour, newPalaceDay, other, roomOfGroup,
} from '../../src/games/diktator/logic/palace';
import { GROUPS } from '../../src/games/diktator/logic/groups';
import { albania } from '../../src/games/diktator/scenario/albania';

const L = albania.palace!;

describe('albania palace layout', () => {
  it('is a 4 × 3 grid of 12 distinct named rooms', () => {
    expect(L.grid).toHaveLength(3);
    for (const row of L.grid) expect(row).toHaveLength(4);
    const rooms = L.grid.flat();
    expect(new Set(rooms).size).toBe(12);
    for (const r of rooms) expect(L.names[r]?.length ?? 0).toBeGreaterThan(0);
  });

  it('places every special room, start room, group room and decision room on the grid', () => {
    const rooms = new Set(L.grid.flat());
    for (const r of [L.throne, L.study, L.mother, L.envoys, L.guardroom, L.start.zogu, L.start.velitel]) expect(rooms.has(r)).toBe(true);
    for (const g of GROUPS) expect(rooms.has(roomOfGroup(L, g))).toBe(true);
    for (const d of albania.decisions) expect(rooms.has(decisionRoom(L, d.id)), d.id).toBe(true);
  });
});

describe('navigation', () => {
  it('moves to grid neighbours and stops at walls', () => {
    expect(neighbour(L, 'trunni', 'left')).toBe('pracovna');
    expect(neighbour(L, 'trunni', 'down')).toBe('vyslanci');
    expect(neighbour(L, 'trunni', 'up')).toBeNull();
    expect(neighbour(L, 'pokladna', 'right')).toBeNull();
  });

  it('lists exits in the order up, down, left, right', () => {
    expect(exits(L, 'matka')).toEqual(['down', 'right']);
    expect(exits(L, 'nadvori')).toEqual(['up', 'down', 'left', 'right']);
  });

  it('throws for a room that is not on the grid', () => {
    expect(() => neighbour(L, 'sklep', 'up')).toThrow();
  });
});

describe('room lookups', () => {
  it('maps groups to rooms', () => {
    expect(roomOfGroup(L, 'armada')).toBe('armada');
    expect(roomOfGroup(L, 'policie')).toBe('straznice');
    expect(roomOfGroup(L, 'povstalci')).toBe('straznice');
    expect(roomOfGroup(L, 'italie')).toBe('vyslanci');
  });

  it('lists the groups one can talk to in a room', () => {
    expect(groupsInRoom(L, 'rolnici')).toEqual(['rolnici']);
    expect(groupsInRoom(L, 'straznice')).toEqual(['policie']);
    expect(groupsInRoom(L, 'knihovna')).toEqual([]);
  });

  it('seals decisions in their room, the study by default', () => {
    expect(decisionRoom(L, 'd35')).toBe('straznice');
    expect(decisionRoom(L, 'd37')).toBe('pokladna');
    expect(decisionRoom(L, 'd31')).toBe('pracovna');
  });
});

describe('newPalaceDay', () => {
  it('starts both heroes in their rooms with full hours, the seal in the study', () => {
    const p = newPalaceDay(L);
    expect(p.at).toEqual({ zogu: 'pracovna', velitel: 'straznice' });
    expect(p.hours).toEqual({ zogu: 3, velitel: 3 });
    expect(p.steps).toEqual({ zogu: 0, velitel: 0 });
    expect(p.seal).toBeNull();
    expect(p.seen).toEqual({ pracovna: true, straznice: true });
    expect(p.seenPop).toEqual({});
    expect(p.investigated).toEqual({});
    expect(p.report).toBeNull();
    expect(p.offers).toBeNull();
    expect(p.wishes).toEqual({});
    expect(p.guarded).toBe(false);
    expect(p.done).toEqual({ zogu: false, velitel: false });
    expect(other('zogu')).toBe('velitel');
  });
});
