import { describe, expect, it } from 'vitest';
import { createGame } from '../../src/games/spy-vs-spy/logic/generator';
import { doorAt, furnitureAt, inReach } from '../../src/games/spy-vs-spy/logic/places';
import { LEVELS, RULES } from '../../src/games/spy-vs-spy/logic/rules';
import { THEME_FURNITURE } from '../../src/games/spy-vs-spy/logic/themes';
import {
  FREE_STANDING_KINDS, ROOM_THEMES, type Furniture, type GameState,
} from '../../src/games/spy-vs-spy/logic/state';
import { openGame, place } from './fixtures';

const SEEDS = Array.from({ length: 25 }, (_, i) => i * 7919 + 3);

function forAllRooms(check: (s: GameState, pieces: Furniture[]) => void): void {
  for (const level of LEVELS) {
    for (const seed of SEEDS) {
      const s = createGame(seed, level);
      for (const room of s.rooms) check(s, room.furniture.map((id) => s.furniture[id]));
    }
  }
}

const isFree = (f: Furniture): boolean => f.z > 0;

describe('reach (round 5 §1)', () => {
  it('is larger: furniture x 22 / z 12, doors 10', () => {
    expect(RULES.furnitureReachX).toBe(22);
    expect(RULES.furnitureReachZ).toBe(12);
    expect(RULES.doorReach).toBe(10);
  });

  it('reaches a wall piece from up to 22 to the side and 12 into the room', () => {
    const f = { x: 100, z: 0 } as Furniture;
    expect(inReach(f, 122, 12)).toBe(true);
    expect(inReach(f, 78, 0)).toBe(true);
    expect(inReach(f, 123, 0)).toBe(false);
    expect(inReach(f, 100, 13)).toBe(false);
  });

  it('reaches a free-standing piece from its front edge, never from behind it (round 5 §5)', () => {
    const f = { x: 100, z: 15 } as Furniture;
    expect(inReach(f, 100, 15)).toBe(true);
    expect(inReach(f, 122, 27)).toBe(true);
    expect(inReach(f, 100, 28)).toBe(false);
    expect(inReach(f, 100, 14)).toBe(false);
    expect(inReach(f, 123, 20)).toBe(false);
  });

  it('finds a free-standing piece with furnitureAt, from in front of it', () => {
    const s = openGame();
    const room = s.rooms[0];
    const f = s.furniture[room.furniture[0]];
    f.x = 100;
    f.z = 15;
    for (const id of room.furniture.slice(1)) s.furniture[id].z = 0; // the others stay on the wall
    place(s, 0, 0, 110, 20);
    expect(furnitureAt(s, s.spies[0])?.id).toBe(f.id);
    place(s, 0, 0, 100, 10);
    expect(furnitureAt(s, s.spies[0])?.id).not.toBe(f.id);
  });

  it('never lets reach zones of two pieces, or of a piece and a door, overlap — for every possible layout', () => {
    // room 4 of the open embassy has a door on all four walls
    const s = openGame();
    const spy = place(s, 0, 4, 0, 0);
    const problems: string[] = [];
    const [left, right] = RULES.slotX;
    for (const lx of left) for (const rx of right) for (const fx of RULES.freeSlotX) for (const fz of RULES.freeSlotZ) {
      const pieces = [{ x: lx, z: 0 }, { x: rx, z: 0 }, { x: fx, z: fz }];
      for (let x = 0; x <= RULES.roomW; x += 0.5) {
        for (let z = 0; z <= RULES.roomD; z += 0.5) {
          const inside = pieces.filter((f) => inReach(f, x, z)).length;
          if (inside === 0) continue;
          if (inside > 1) problems.push(`${lx}/${rx}/${fx},${fz}: two pieces at ${x},${z}`);
          spy.x = x;
          spy.z = z;
          if (doorAt(s, spy) !== null) problems.push(`${lx}/${rx}/${fx},${fz}: piece and door at ${x},${z}`);
        }
      }
    }
    expect(problems.slice(0, 5)).toEqual([]);
  });

  it('only generates layouts from those slots', () => {
    for (const level of LEVELS) {
      for (const seed of SEEDS) {
        const s = createGame(seed, level);
        for (const f of s.furniture) {
          if (f.z === 0) expect(RULES.slotX.flat()).toContain(f.x);
          else {
            expect(RULES.freeSlotX).toContain(f.x);
            expect(RULES.freeSlotZ).toContain(f.z);
          }
        }
      }
    }
  });
});

describe('furniture layout (round 5 §5)', () => {
  it('puts 2-3 searchable pieces in every room, fixtures included', () => {
    forAllRooms((_, pieces) => {
      expect(pieces.length).toBeGreaterThanOrEqual(2);
      expect(pieces.length).toBeLessThanOrEqual(3);
    });
  });

  it('keeps wall pieces at z 0 on the wall slots, one per side of the back door', () => {
    forAllRooms((_, pieces) => {
      const wall = pieces.filter((f) => !isFree(f));
      expect(wall.length).toBeGreaterThanOrEqual(1);
      const sides = wall.map((f) => RULES.slotX.findIndex((side) => side.includes(f.x)));
      expect(sides).not.toContain(-1);
      expect(new Set(sides).size).toBe(sides.length);
    });
  });

  it('stands at most one free-standing piece per room, in about half of the rooms', () => {
    let rooms = 0;
    let withFree = 0;
    forAllRooms((_, pieces) => {
      const free = pieces.filter(isFree);
      expect(free.length).toBeLessThanOrEqual(1);
      rooms++;
      if (free.length === 1) withFree++;
    });
    expect(withFree / rooms).toBeGreaterThan(0.4);
    expect(withFree / rooms).toBeLessThan(0.6);
  });

  it('stands free pieces on the middle of the floor, clear of the doors and side walls, of a free-standing kind', () => {
    forAllRooms((_, pieces) => {
      for (const f of pieces.filter(isFree)) {
        expect(FREE_STANDING_KINDS).toContain(f.kind);
        expect(f.source).toBeNull();
        expect(f.z).toBeGreaterThanOrEqual(12);
        expect(f.z).toBeLessThanOrEqual(28);
        expect(f.x - RULES.furnitureReachX).toBeGreaterThan(RULES.doorReach);
        expect(f.x + RULES.furnitureReachX).toBeLessThan(RULES.roomW - RULES.doorReach);
      }
    });
  });

  it('keeps fixtures on the wall', () => {
    forAllRooms((_, pieces) => {
      for (const f of pieces) if (f.source !== null) expect(f.z).toBe(0);
    });
  });

  it('has a free-standing kind in every theme', () => {
    for (const theme of ROOM_THEMES) {
      expect(THEME_FURNITURE[theme].some((k) => FREE_STANDING_KINDS.includes(k)), theme).toBe(true);
    }
  });
});

describe('free-standing slots', () => {
  it('keep even the widest piece (the 36-px pohovka) clear of the back door (x 88-112)', () => {
    for (const x of RULES.freeSlotX) expect(x + 18 <= 88 || x - 18 >= 112).toBe(true);
  });

  it('leave the spawn point well in front of every free-standing piece', () => {
    for (const z of RULES.freeSlotZ) expect(RULES.spawnZ).toBeGreaterThanOrEqual(z + 10);
  });
});
