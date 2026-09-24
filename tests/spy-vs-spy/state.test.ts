import { describe, expect, it } from 'vitest';
import { doorKey, neighbor } from '../../src/games/spy-vs-spy/logic/state';

const grid = { cols: 4, rows: 3 };

describe('neighbor', () => {
  it('finds rooms in all four directions from the centre', () => {
    // room 5 = (1,1)
    expect(neighbor(grid, 5, 'N')).toBe(1);
    expect(neighbor(grid, 5, 'S')).toBe(9);
    expect(neighbor(grid, 5, 'W')).toBe(4);
    expect(neighbor(grid, 5, 'E')).toBe(6);
  });

  it('returns null outside the grid', () => {
    expect(neighbor(grid, 0, 'N')).toBeNull();
    expect(neighbor(grid, 0, 'W')).toBeNull();
    expect(neighbor(grid, 11, 'S')).toBeNull();
    expect(neighbor(grid, 11, 'E')).toBeNull();
    expect(neighbor(grid, 3, 'E')).toBeNull();
  });
});

describe('doorKey', () => {
  it('is symmetric', () => {
    expect(doorKey(3, 7)).toBe(doorKey(7, 3));
    expect(doorKey(3, 7)).toBe('3-7');
  });
});
