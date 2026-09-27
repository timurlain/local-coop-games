import { describe, expect, it } from 'vitest';
import { settleTreasury } from '../../src/games/diktator/logic/money';
import { policeReport } from '../../src/games/diktator/logic/police';
import { initialState, type GameEvent } from '../../src/games/diktator/logic/state';

// settleTreasury's budget behaviour (income against costs, our addition) is covered by budget.test.ts.
describe('settleTreasury (L618–620, L900)', () => {
  it('bankruptcy hits army, police and the bodyguard, floored at zero', () => {
    const s = initialState(1);
    s.treasury = -5;
    s.pop.armada = 0;
    const ev: GameEvent[] = [];
    settleTreasury(s, ev);
    expect(s.pop.armada).toBe(0);
    expect(s.pop.policie).toBe(6);
    expect(s.str.policie).toBe(5);
    expect(s.guard).toBe(3);
    expect(ev[0]).toEqual({ type: 'bankrupt' });
  });
});

describe('policeReport (L1700)', () => {
  it('costs 1 and shows everything', () => {
    const s = initialState(1);
    s.low = 3;
    const ev: GameEvent[] = [];
    policeReport(s, ev);
    expect(s.treasury).toBe(299); // starting reserve 300 (our addition, play-test change) minus the report's cost 1
    expect(ev[0].type).toBe('policeReport');
  });

  it('is refused when broke or when the police are hostile or weak', () => {
    const s = initialState(1);
    s.low = 3;
    s.treasury = 0;
    const ev: GameEvent[] = [];
    policeReport(s, ev);
    expect(ev).toEqual([{ type: 'policeReportRefused', reason: 'noMoney' }]);
    s.treasury = 100;
    s.str.policie = 3;
    policeReport(s, ev);
    expect(ev[1]).toEqual({ type: 'policeReportRefused', reason: 'policeHostile' });
    expect(s.treasury).toBe(100);
  });
});
