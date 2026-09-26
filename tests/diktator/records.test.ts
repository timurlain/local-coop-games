import { describe, expect, it } from 'vitest';
import { affordable, applyEffects, clamp, type Effects } from '../../src/games/diktator/logic/records';

function stats() {
  return {
    pop: { armada: 7, rolnici: 7, statkari: 7, povstalci: 0, jugoslavie: 7, policie: 7, italie: 7, britanie: 7 },
    str: { armada: 6, rolnici: 6, statkari: 6, povstalci: 6, jugoslavie: 6, policie: 6 },
    treasury: 1000,
    income: 60,
    costs: 60,
  };
}

describe('clamp', () => {
  it('keeps values in 0..9', () => {
    expect(clamp(-3)).toBe(0);
    expect(clamp(12)).toBe(9);
    expect(clamp(4)).toBe(4);
  });
});

describe('applyEffects (L1620–1664)', () => {
  it('adds popularity and strength, clamped, and moves money', () => {
    const s = stats();
    const e: Effects = { cost: -100, monthly: 5, pop: { armada: 4, rolnici: -9 }, str: { povstalci: -4 } };
    applyEffects(s, e);
    expect(s.pop.armada).toBe(9);
    expect(s.pop.rolnici).toBe(0);
    expect(s.str.povstalci).toBe(2);
    expect(s.treasury).toBe(900);
    expect(s.costs).toBe(65);
  });

  it('never lets costs go below zero', () => {
    const s = stats();
    s.costs = 3;
    applyEffects(s, { monthly: -10 });
    expect(s.costs).toBe(0);
  });

  // Income (our addition, play-test change): the original had no per-quarter revenue.
  it('moves income the same way as costs, floored at zero', () => {
    const s = stats();
    applyEffects(s, { income: 5 });
    expect(s.income).toBe(65);
    s.income = 3;
    applyEffects(s, { income: -10 });
    expect(s.income).toBe(0);
  });
});

describe('affordable (cash check L2020–2022)', () => {
  it('is affordable while treasury + cost does not go below zero', () => {
    expect(affordable(200, { cost: -120 })).toBe(true);
    expect(affordable(100, { cost: -100 })).toBe(true); // original: spending down to exactly 0 is allowed
    expect(affordable(99, { cost: -100 })).toBe(false);
  });
  it('a rising monthly cost with an empty treasury is unaffordable', () => {
    expect(affordable(0, { monthly: 5 })).toBe(false);
    expect(affordable(10, { monthly: 5 })).toBe(true);
  });
  it('no money involved is always affordable', () => {
    expect(affordable(-50, {})).toBe(true);
    expect(affordable(-50, { pop: { armada: 3 } })).toBe(true);
  });
  it('income is affordable even when broke', () => {
    expect(affordable(-50, { cost: 100 })).toBe(true);
    expect(affordable(-50, { cost: 30, monthly: -5 })).toBe(true);
  });
});
