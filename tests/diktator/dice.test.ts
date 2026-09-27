import { describe, expect, it } from 'vitest';
import { rngDice } from '../../src/games/diktator/logic/dice';
import { makeRng } from '../../src/shared/rng';
import { scriptedDice } from './helpers';

describe('dice', () => {
  it('rngDice.int stays in 0..n-1 and is deterministic per seed', () => {
    const a = rngDice(makeRng(5));
    const b = rngDice(makeRng(5));
    const xs = Array.from({ length: 50 }, () => a.int(3));
    expect(xs).toEqual(Array.from({ length: 50 }, () => b.int(3)));
    expect(xs.every((x) => x >= 0 && x < 3)).toBe(true);
    expect(new Set(xs).size).toBe(3);
  });

  it('scriptedDice returns values in order and rejects bad ones', () => {
    const d = scriptedDice([2, 0.5, 7]);
    expect(d.int(3)).toBe(2);
    expect(d.float()).toBe(0.5);
    expect(() => d.int(3)).toThrow('not in 0..2');
    expect(() => d.int(3)).toThrow('exhausted');
  });
});
