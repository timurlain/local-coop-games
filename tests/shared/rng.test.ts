import { describe, expect, it } from 'vitest';
import { makeRng, pick, rand, randInt, shuffle } from '../../src/shared/rng';

describe('rng', () => {
  it('produces the same sequence for the same seed', () => {
    const a = makeRng(42);
    const b = makeRng(42);
    const sa = Array.from({ length: 5 }, () => rand(a));
    const sb = Array.from({ length: 5 }, () => rand(b));
    expect(sa).toEqual(sb);
  });

  it('produces different sequences for different seeds', () => {
    const a = makeRng(1);
    const b = makeRng(2);
    expect(rand(a)).not.toEqual(rand(b));
  });

  it('rand stays in [0, 1)', () => {
    const r = makeRng(7);
    for (let i = 0; i < 1000; i++) {
      const v = rand(r);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('randInt stays in range and hits every value', () => {
    const r = makeRng(3);
    const seen = new Set<number>();
    for (let i = 0; i < 400; i++) {
      const v = randInt(r, 4);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(4);
      seen.add(v);
    }
    expect(seen.size).toBe(4);
  });

  it('shuffle keeps all elements and does not mutate the input', () => {
    const input = [1, 2, 3, 4, 5, 6];
    const out = shuffle(makeRng(9), input);
    expect(input).toEqual([1, 2, 3, 4, 5, 6]);
    expect([...out].sort()).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('pick throws on an empty array', () => {
    expect(() => pick(makeRng(1), [])).toThrow();
  });
});
