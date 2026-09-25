import { describe, expect, it } from 'vitest';
import { placeTargetFor, placeTargetsInRoom } from '../../src/games/spy-vs-spy/logic/traps';
import { EXIT_KEY, doorKey } from '../../src/games/spy-vs-spy/logic/state';
import { softPulse } from '../../src/games/spy-vs-spy/render/furniture';
import { trapMarks } from '../../src/games/spy-vs-spy/render/view';
import { atFurniture, firstFurniture, openGame, place } from './fixtures';

describe('placeTargetsInRoom (round 5 §1)', () => {
  it('is empty with no trap in hand', () => {
    const s = openGame();
    const spy = place(s, 0, 4, 70, 34);
    expect(placeTargetsInRoom(s, spy)).toEqual([]);
  });

  it('lists every untrapped piece of the room for bomba and pružina, wherever the spy stands', () => {
    const s = openGame();
    const spy = place(s, 0, 4, 70, 34);
    const [first, ...rest] = s.rooms[4].furniture;
    s.furniture[first].trap = { kind: 'pruzina', owner: 1 };
    for (const kind of ['bomba', 'pruzina'] as const) {
      spy.selected = kind;
      expect(placeTargetsInRoom(s, spy)).toEqual(rest.map((id) => ({ on: 'furniture', furniture: id })));
    }
  });

  it('lists every untrapped door of the room for elektřina and pistole, with its side', () => {
    const s = openGame();
    const spy = place(s, 0, 4, 70, 34);
    s.doorTraps[doorKey(4, 1)] = { kind: 'pistole', owner: 1 };
    for (const kind of ['elektrina', 'pistole'] as const) {
      spy.selected = kind;
      expect(placeTargetsInRoom(s, spy)).toEqual([
        { on: 'door', key: doorKey(4, 7), dir: 'S' },
        { on: 'door', key: doorKey(4, 5), dir: 'E' },
        { on: 'door', key: doorKey(4, 3), dir: 'W' },
      ]);
    }
  });

  it('includes the exit only while the spy can see it (hidden airport)', () => {
    const s = openGame();
    const spy = place(s, 0, 2, 70, 34);
    spy.selected = 'elektrina';
    expect(placeTargetsInRoom(s, spy)).toContainEqual({ on: 'door', key: EXIT_KEY, dir: 'E' });
    s.hideAirport = true;
    expect(placeTargetsInRoom(s, spy).map((t) => t.on === 'door' && t.key)).not.toContain(EXIT_KEY);
  });

  it('is the floor under the spy for časovaná', () => {
    const s = openGame();
    const spy = place(s, 0, 4, 70, 34);
    spy.selected = 'casovana';
    expect(placeTargetsInRoom(s, spy)).toEqual([{ on: 'floor' }]);
  });

  it('is empty in a shared room or with no stock left', () => {
    const s = openGame();
    const spy = place(s, 0, 4, 70, 34);
    spy.selected = 'bomba';
    place(s, 1, 4, 150, 20);
    expect(placeTargetsInRoom(s, spy)).toEqual([]);
    place(s, 1, 8, 150, 20);
    spy.stock.bomba = 0;
    expect(placeTargetsInRoom(s, spy)).toEqual([]);
  });

  it('contains the target in reach, the one Akce would use', () => {
    const s = openGame();
    const f = firstFurniture(s, 4);
    const spy = atFurniture(s, 0, f);
    spy.selected = 'bomba';
    expect(placeTargetsInRoom(s, spy)).toContainEqual(placeTargetFor(s, spy, 'bomba'));
  });
});

describe('trapMarks: the targets in the owner\'s view (round 5 §1)', () => {
  it('marks the piece in reach red and every other free piece of the room softly', () => {
    const s = openGame();
    const f = firstFurniture(s, 4);
    const spy = atFurniture(s, 0, f);
    spy.selected = 'bomba';
    const others = s.rooms[4].furniture.filter((id) => id !== f.id);
    expect(trapMarks(s, spy)).toEqual({ armedFurniture: f.id, armedDoor: null, floor: false, softFurniture: others, softDoors: [] });
  });

  it('marks every piece softly when none is in reach', () => {
    const s = openGame();
    const spy = place(s, 0, 4, 70, 34);
    spy.selected = 'pruzina';
    expect(trapMarks(s, spy)).toMatchObject({ armedFurniture: null, softFurniture: s.rooms[4].furniture });
  });

  it('marks the door in reach red and the other doors softly', () => {
    const s = openGame();
    const spy = place(s, 0, 4, 100, 0);
    spy.selected = 'elektrina';
    expect(trapMarks(s, spy)).toMatchObject({ armedDoor: 'N', softDoors: ['S', 'E', 'W'], softFurniture: [] });
  });

  it('marks the floor for časovaná', () => {
    const s = openGame();
    const spy = place(s, 0, 4, 70, 34);
    spy.selected = 'casovana';
    expect(trapMarks(s, spy)).toMatchObject({ floor: true, softFurniture: [], softDoors: [] });
  });

  it('marks nothing without a trap in hand, in a shared room, or while not free (searching, dead)', () => {
    const s = openGame();
    const spy = place(s, 0, 4, 70, 34);
    const none = { armedFurniture: null, armedDoor: null, floor: false, softFurniture: [], softDoors: [] };
    expect(trapMarks(s, spy)).toEqual(none);
    spy.selected = 'bomba';
    spy.mode = 'searching';
    expect(trapMarks(s, spy)).toEqual(none);
    spy.mode = 'normal';
    place(s, 1, 4, 150, 20);
    expect(trapMarks(s, spy)).toEqual(none);
    expect(trapMarks(s, s.spies[1])).toEqual(none); // the opponent's view never shows them
  });
});

describe('softPulse', () => {
  it('pulses between 0 and 1', () => {
    const values = Array.from({ length: 60 }, (_, i) => softPulse(i / 60));
    expect(Math.min(...values)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...values)).toBeLessThanOrEqual(1);
    expect(Math.max(...values) - Math.min(...values)).toBeGreaterThan(0.9);
  });
});
