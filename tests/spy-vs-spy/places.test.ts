import { describe, expect, it } from 'vitest';
import { doorAt, doorKeyFor, furnitureAt } from '../../src/games/spy-vs-spy/logic/places';
import { EXIT_KEY, doorKey } from '../../src/games/spy-vs-spy/logic/state';
import { firstFurniture, openGame, place } from './fixtures';

describe('furnitureAt', () => {
  it('finds furniture right in front of the spy at the back wall', () => {
    const s = openGame();
    const f = firstFurniture(s, 0);
    place(s, 0, 0, f.x + 5, 3);
    expect(furnitureAt(s, s.spies[0])?.id).toBe(f.id);
  });

  it('ignores furniture that is too far in x or z', () => {
    const s = openGame();
    const f = firstFurniture(s, 0);
    place(s, 0, 0, f.x, 12);
    expect(furnitureAt(s, s.spies[0])?.id).toBe(f.id);
    place(s, 0, 0, f.x, 13);
    expect(furnitureAt(s, s.spies[0])?.id).not.toBe(f.id);
    place(s, 0, 0, f.x + 22, 0);
    expect(furnitureAt(s, s.spies[0])?.id).toBe(f.id);
    place(s, 0, 0, f.x + 23, 0);
    expect(furnitureAt(s, s.spies[0])?.id).not.toBe(f.id);
  });
});

describe('doorAt', () => {
  it('detects all four doors of the centre room', () => {
    const s = openGame();
    const spy = s.spies[0];
    place(s, 0, 4, 100, 0);
    expect(doorAt(s, spy)).toBe('N');
    place(s, 0, 4, 100, 40);
    expect(doorAt(s, spy)).toBe('S');
    place(s, 0, 4, 0, 20);
    expect(doorAt(s, spy)).toBe('W');
    place(s, 0, 4, 200, 20);
    expect(doorAt(s, spy)).toBe('E');
    place(s, 0, 4, 50, 20);
    expect(doorAt(s, spy)).toBeNull();
  });

  it('ignores a wall without a door', () => {
    const s = openGame();
    place(s, 0, 0, 100, 0); // room 0 has no north neighbour
    expect(doorAt(s, s.spies[0])).toBeNull();
  });

  it('treats the exit as a door', () => {
    const s = openGame();
    place(s, 0, 2, 200, 20);
    expect(doorAt(s, s.spies[0])).toBe('E');
  });
});

describe('doorKeyFor', () => {
  it('uses the shared key for internal doors and EXIT_KEY for the exit', () => {
    const s = openGame();
    expect(doorKeyFor(s, 4, 'N')).toBe(doorKey(4, 1));
    expect(doorKeyFor(s, 1, 'S')).toBe(doorKey(4, 1));
    expect(doorKeyFor(s, 2, 'E')).toBe(EXIT_KEY);
  });
});
