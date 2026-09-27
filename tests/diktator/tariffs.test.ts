// Tariffs plan (our addition, play-test change): the tariff petition (p20) is capped at `maxAccepted`
// accepted "yes", and every tariff accepted feeds a permanent, growing yearly income penalty.
// See docs/superpowers/plans/2026-09-26-diktator-tariffs.md.
import { describe, expect, it } from 'vitest';
import { answerPetition, drawPetition, suggestOther } from '../../src/games/diktator/logic/audience';
import { applyTariffPenalty } from '../../src/games/diktator/logic/money';
import { advance, newGame } from '../../src/games/diktator/logic/turn';
import { initialState, type GameEvent, type GameState } from '../../src/games/diktator/logic/state';
import type { Scenario } from '../../src/games/diktator/logic/scenario';
import { albania } from '../../src/games/diktator/scenario/albania';
import { scriptedDice } from './helpers';

/** A minimal fake scenario, only for the "everything is capped" guard (impossible with the real data). */
function fakeScenario(petitions: Scenario['petitions']): Scenario {
  return { id: 'fake', groupNames: albania.groupNames, petitions, decisions: [], news: [] };
}

describe('accepted (rule 2): counts "yes", not a forced "no"', () => {
  it('answering yes increments accepted for that petition', () => {
    const s = initialState(1);
    s.treasury = 1000;
    answerPetition(albania, s, 'p03', 'yes', []);
    expect(s.accepted.p03).toBe(1);
    answerPetition(albania, s, 'p20', 'yes', []);
    expect(s.accepted.p20).toBe(1);
  });

  it('a plain no or goAway does not count', () => {
    const s = initialState(1);
    answerPetition(albania, s, 'p07', 'no', []);
    expect(s.accepted.p07 ?? 0).toBe(0);
    s.used.p10 = true;
    answerPetition(albania, s, 'p10', 'goAway', []);
    expect(s.accepted.p10 ?? 0).toBe(0);
  });

  it('a forced no (unaffordable) does not count', () => {
    const s = initialState(1);
    s.treasury = 50; // p08 costs more than this (see audience.test.ts)
    const ev: GameEvent[] = [];
    answerPetition(albania, s, 'p08', 'yes', ev);
    expect(ev).toEqual([{ type: 'forcedNo', id: 'p08' }]);
    expect(s.accepted.p08 ?? 0).toBe(0);
  });
});

describe('capped petitions (rule 3): p20 stops being drawn after maxAccepted "yes"', () => {
  it('drawPetition skips a capped petition even when it is otherwise the first candidate', () => {
    const s = initialState(1);
    s.accepted.p20 = 3; // at its cap
    const p20Index = albania.petitions.findIndex((p) => p.id === 'p20');
    // Start the scan exactly at p20: it must be skipped in favour of the next petition.
    const id = drawPetition(albania, s, scriptedDice([p20Index]));
    expect(id).not.toBe('p20');
    expect(s.used.p20).toBeUndefined();
  });

  it('a deck reset (every other petition used) does not bring a capped petition back', () => {
    const s = initialState(1);
    s.accepted.p20 = 3;
    for (const p of albania.petitions) if (p.id !== 'p20') s.used[p.id] = true;
    // Attempt 1 finds nothing (p20 capped, everything else used) and resets `used`; attempt 2 then finds
    // an uncapped petition immediately, never p20.
    const id = drawPetition(albania, s, scriptedDice([0, 0]));
    expect(id).not.toBe('p20');
  });

  it('suggestOther skips a capped petition from the same faction', () => {
    const s = initialState(1);
    s.accepted.p20 = 3;
    const id = suggestOther(albania, s, 'p19', scriptedDice([0]));
    expect(id).not.toBe('p20');
    expect(id).toBe('p17'); // statkari petitions minus p19 (current) and p20 (capped): p17, p18, p21, p22, p23, p24
  });

  it('throws a clear error when every petition in the scenario has reached its cap (impossible with the Albanian data)', () => {
    const sc = fakeScenario([
      { id: 'x1', from: 'statkari', origin: 'new', title: 'x1', effects: {}, maxAccepted: 1, tariff: true },
      { id: 'x2', from: 'statkari', origin: 'new', title: 'x2', effects: {}, maxAccepted: 2 },
    ]);
    const s = initialState(1);
    s.accepted.x1 = 1;
    s.accepted.x2 = 2;
    expect(() => drawPetition(sc, s, scriptedDice([0, 0]))).toThrow(/cap/i);
  });
});

describe('applyTariffPenalty (rule 4): yearly, permanent, piles up', () => {
  it('does nothing in the game\'s first quarter (1925-Q1), even with tariffs in force', () => {
    const s = initialState(1);
    s.quarter = 1;
    s.accepted.p20 = 2;
    const ev: GameEvent[] = [];
    applyTariffPenalty(albania, s, ev);
    expect(s.income).toBe(60);
    expect(ev).toEqual([]);
  });

  it('does nothing without any tariffs in force, even in January', () => {
    const s = initialState(1);
    s.quarter = 5; // 1926-Q1
    const ev: GameEvent[] = [];
    applyTariffPenalty(albania, s, ev);
    expect(s.income).toBe(60);
    expect(ev).toEqual([]);
  });

  it('only triggers in January (quarter % 4 === 1), not other quarters', () => {
    const s = initialState(1);
    s.accepted.p20 = 2;
    s.quarter = 6; // 1926-Q2
    const ev: GameEvent[] = [];
    applyTariffPenalty(albania, s, ev);
    expect(s.income).toBe(60);
    expect(ev).toEqual([]);
  });

  it('applies −1 tis. per tariff in force every January from 1926, and it piles up permanently', () => {
    const s = initialState(1);
    s.accepted.p20 = 2;
    s.quarter = 5; // 1926-Q1
    let ev: GameEvent[] = [];
    applyTariffPenalty(albania, s, ev);
    expect(s.income).toBe(58);
    expect(ev).toEqual([{ type: 'tariffPenalty', tariffs: 2, amount: 2 }]);

    s.accepted.p20 = 3; // one more accepted during the year
    s.quarter = 9; // 1927-Q1
    ev = [];
    applyTariffPenalty(albania, s, ev);
    expect(s.income).toBe(55); // the 1926 penalty is still in effect: 58 - 3
    expect(ev).toEqual([{ type: 'tariffPenalty', tariffs: 3, amount: 3 }]);
  });

  it('floors income at 0, never negative', () => {
    const s = initialState(1);
    s.income = 2;
    s.accepted.p20 = 3;
    s.quarter = 5;
    applyTariffPenalty(albania, s, []);
    expect(s.income).toBe(0);
  });

  it('is wired into startQuarter, before the budget is booked', () => {
    const s: GameState = structuredClone(newGame(albania, 1).state);
    s.accepted.p20 = 2;
    s.quarter = 4;
    s.phase = { kind: 'day' };
    const { state, events } = advance(albania, s, { type: 'endDay' });
    expect(state.quarter).toBe(5);
    const penaltyIndex = events.findIndex((e) => e.type === 'tariffPenalty');
    const budgetIndex = events.findIndex((e) => e.type === 'budget');
    expect(penaltyIndex).toBeGreaterThanOrEqual(0);
    expect(budgetIndex).toBeGreaterThan(penaltyIndex);
    expect(events[penaltyIndex]).toEqual({ type: 'tariffPenalty', tariffs: 2, amount: 2 });
    expect(state.income).toBe(58);
    expect(events[budgetIndex]).toEqual({ type: 'budget', income: 58, costs: 60 });
  });
});
