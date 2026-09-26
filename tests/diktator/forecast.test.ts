import { describe, expect, it } from 'vitest';
import { forecast } from '../../src/games/diktator/logic/forecast';
import { initialState } from '../../src/games/diktator/logic/state';

function state() {
  const s = initialState(1);
  s.quarter = 6;
  s.low = 3;
  s.threshold = 11;
  return s;
}

describe('forecast (Mother’s advice)', () => {
  it('says nothing for a harmless choice', () => {
    expect(forecast(state(), { pop: { armada: 1 } })).toEqual([]);
  });

  it('warns when a faction would turn hostile (no partner strong enough for a revolution)', () => {
    const s = state();
    s.str.povstalci = 2; // rolnici 6 + povstalci 2 < 11
    expect(forecast(s, { pop: { rolnici: -4 } })).toEqual([{ kind: 'turnsHostile', group: 'rolnici' }]);
  });

  it('warns of a revolution when the hostile faction finds a strong enough partner', () => {
    const s = state();
    s.str.rolnici = 6; // with povstalci (pop 0, str 6): 12 ≥ 11
    expect(forecast(s, { pop: { rolnici: -5 } })).toEqual([{ kind: 'revolutionRisk', group: 'rolnici', ally: 'povstalci' }]);
  });

  it('does not repeat a danger that already exists', () => {
    const s = state();
    s.pop.rolnici = 2;
    expect(forecast(s, { pop: { rolnici: -1 } })).toEqual([]);
  });

  it('warns when the police would stop protecting the ruler', () => {
    const s = state();
    s.str.policie = 3;
    expect(forecast(s, { pop: { policie: -4 } })).toEqual([{ kind: 'policeLost' }]);
  });

  it('warns of war when Yugoslavia turns hostile and is strong enough', () => {
    expect(forecast(state(), { pop: { jugoslavie: -4 } })).toEqual([{ kind: 'warRisk' }]);
  });

  // Money warnings use the per-quarter balance income − costs (our addition, play-test change): a one-off
  // spend that leaves the budget balanced no longer warns of running out (see budget.test.ts for the rest).
  it('warns about money: an empty treasury, or money running out soon', () => {
    const s = state();
    s.treasury = 100;
    expect(forecast(s, { cost: -120 })).toEqual([{ kind: 'broke' }]);
    s.treasury = 400; // income 60, costs 60: balanced, a one-off spend alone never runs out
    expect(forecast(s, { cost: -250 })).toEqual([]);
    expect(forecast(s, { monthly: 150 })).toEqual([{ kind: 'moneyRunsOut', quarters: 2 }]); // balance -150 → 400/150
  });

  it('tells good news: a hostile faction reconciles', () => {
    const s = state();
    s.pop.armada = 2;
    expect(forecast(s, { pop: { armada: 3 } })).toEqual([{ kind: 'reconciles', group: 'armada' }]);
  });
});
