// A balanced budget (play-test change, our addition): income against expenses, deficits only from choices.
// See docs/superpowers/plans/2026-09-26-diktator-budget.md.
import { describe, expect, it } from 'vitest';
import { settleTreasury } from '../../src/games/diktator/logic/money';
import { affordable } from '../../src/games/diktator/logic/records';
import { forecast } from '../../src/games/diktator/logic/forecast';
import { initialState, type GameEvent } from '../../src/games/diktator/logic/state';

describe('settleTreasury: the budget is always booked (rule 3)', () => {
  it('a balanced start books zero and still emits the budget event', () => {
    const s = initialState(1);
    const ev: GameEvent[] = [];
    settleTreasury(s, ev);
    expect(s.treasury).toBe(300);
    expect(ev).toEqual([{ type: 'budget', income: 60, costs: 60 }]);
  });

  it('a deficit budget lowers the treasury, even from exactly zero (no more "pays nothing at 0")', () => {
    const s = initialState(1);
    s.treasury = 0;
    s.costs = 70; // income 60 → balance -10
    settleTreasury(s, []);
    expect(s.treasury).toBe(-10);
  });

  it('a surplus budget raises the treasury', () => {
    const s = initialState(1);
    s.income = 90; // costs 60 → balance +30
    settleTreasury(s, []);
    expect(s.treasury).toBe(330);
  });

  it('bankruptcy penalties still apply first, then the budget is booked on top', () => {
    const s = initialState(1);
    s.treasury = -5;
    s.pop.armada = 0;
    const ev: GameEvent[] = [];
    settleTreasury(s, ev);
    expect(s.pop.armada).toBe(0);
    expect(s.pop.policie).toBe(6);
    expect(s.str.policie).toBe(5);
    expect(s.guard).toBe(3);
    expect(s.treasury).toBe(-5); // balanced (income 60 = costs 60): bankruptcy alone, no further change
    expect(ev).toEqual([{ type: 'bankrupt' }, { type: 'budget', income: 60, costs: 60 }]);
  });
});

describe('affordable: the net change is monthly − income (rule 4)', () => {
  it('a costlier choice offset by more income stays affordable even when broke', () => {
    expect(affordable(-10, { monthly: 10, income: 10 })).toBe(true); // net 0
    expect(affordable(-10, { monthly: 5, income: 10 })).toBe(true); // net -5, surplus
  });

  it('a costlier choice only partly offset by income is unaffordable when broke', () => {
    expect(affordable(-10, { monthly: 10, income: 5 })).toBe(false); // net 5 > 0
  });

  it('losing income alone (no monthly change) can make a choice unaffordable when broke', () => {
    expect(affordable(-10, { income: -5 })).toBe(false); // net 5 > 0
  });
});

describe('forecast: money warnings use the per-quarter balance (rule 6)', () => {
  function state() {
    const s = initialState(1);
    s.quarter = 6;
    s.low = 3;
    s.threshold = 11;
    return s;
  }

  it('broke is simply treasury below zero after the choice', () => {
    const s = state();
    s.treasury = 50;
    expect(forecast(s, { cost: -60 })).toEqual([{ kind: 'broke' }]);
  });

  it('a balanced or surplus budget never warns of running out', () => {
    const s = state();
    s.treasury = 30; // low treasury, but balance stays 0
    expect(forecast(s, { cost: -20 })).toEqual([]);
    expect(forecast(s, { income: 20, monthly: 20 })).toEqual([]); // net 0
    expect(forecast(s, { income: 10 })).toEqual([]); // surplus
  });

  it('warns when the choice pushes the balance negative and money runs out soon', () => {
    const s = state();
    s.treasury = 90; // income 60, costs 60 → balanced before
    expect(forecast(s, { monthly: 30 })).toEqual([{ kind: 'moneyRunsOut', quarters: 3 }]); // balance -30 → 90/30
  });

  it('does not repeat a warning that already existed before the choice', () => {
    const s = state();
    s.treasury = 60;
    s.costs = 90; // balance already -30 → already 2 quarters left
    expect(forecast(s, { pop: { armada: 1 } })).toEqual([]); // harmless choice, same deficit, no new/worse warning
  });
});
