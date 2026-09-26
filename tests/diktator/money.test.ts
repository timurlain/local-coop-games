import { describe, expect, it } from 'vitest';
import { settleTreasury } from '../../src/games/diktator/logic/money';
import { policeReport } from '../../src/games/diktator/logic/police';
import { initialState, type GameEvent } from '../../src/games/diktator/logic/state';

describe('settleTreasury (L618–620, L900)', () => {
  it('pays the costs when there is money', () => {
    const s = initialState(1);
    const ev: GameEvent[] = [];
    settleTreasury(s, ev);
    expect(s.treasury).toBe(940);
    expect(ev).toEqual([{ type: 'costsPaid', amount: 60 }]);
  });

  it('pays nothing at exactly zero, and can go negative when paying', () => {
    const s = initialState(1);
    s.treasury = 0;
    settleTreasury(s, []);
    expect(s.treasury).toBe(0);
    s.treasury = 10;
    settleTreasury(s, []);
    expect(s.treasury).toBe(-50);
  });

  it('bankruptcy hits army, police and the bodyguard, floored at zero, and pays nothing', () => {
    const s = initialState(1);
    s.treasury = -5;
    s.pop.armada = 0;
    const ev: GameEvent[] = [];
    settleTreasury(s, ev);
    expect(s.pop.armada).toBe(0);
    expect(s.pop.policie).toBe(6);
    expect(s.str.policie).toBe(5);
    expect(s.guard).toBe(3);
    expect(s.treasury).toBe(-5);
    expect(ev).toEqual([{ type: 'bankrupt' }]);
  });
});

describe('policeReport (L1700)', () => {
  it('costs 1 and shows everything', () => {
    const s = initialState(1);
    s.low = 3;
    const ev: GameEvent[] = [];
    policeReport(s, ev);
    expect(s.treasury).toBe(999);
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
