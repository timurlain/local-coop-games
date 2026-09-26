import { describe, expect, it } from 'vitest';
import { availableDecisions, takeDecision } from '../../src/games/diktator/logic/decision';
import { initialState, type GameEvent } from '../../src/games/diktator/logic/state';
import { albania } from '../../src/games/diktator/scenario/albania';
import { scriptedDice } from './helpers';

function state() {
  const s = initialState(1);
  s.quarter = 6;
  s.low = 3;
  return s;
}

describe('takeDecision', () => {
  it('applies a plain decision and marks it used', () => {
    const s = state();
    const ev: GameEvent[] = [];
    expect(takeDecision(albania, s, 'd41', 2, scriptedDice([]), ev)).toBe(true);
    expect(s.treasury).toBe(950);
    expect(s.str.armada).toBe(9);
    expect(s.used.d41).toBe(true);
    expect(s.decisionTaken).toBe(true);
    expect(ev).toEqual([{ type: 'decided', id: 'd41' }]);
    expect(availableDecisions(albania, s).some((d) => d.id === 'd41')).toBe(false);
  });

  it('an unaffordable decision is not consumed', () => {
    const s = state();
    s.treasury = 100;
    const ev: GameEvent[] = [];
    expect(takeDecision(albania, s, 'd36', 2, scriptedDice([]), ev)).toBe(false);
    expect(ev).toEqual([{ type: 'decisionUnaffordable', id: 'd36' }]);
    expect(s.decisionTaken).toBe(false);
    expect(s.hasPlane).toBe(false);
  });

  it('bodyguard adds 2 strength and stays available', () => {
    const s = state();
    takeDecision(albania, s, 'd35', 2, scriptedDice([]), []);
    expect(s.guard).toBe(6);
    expect(s.used.d35).toBeUndefined();
  });

  it('the plane sets the flag', () => {
    const s = state();
    takeDecision(albania, s, 'd36', 2, scriptedDice([]), []);
    expect(s.hasPlane).toBe(true);
  });

  it('the Swiss account sends 1/share of the treasury, rounded down', () => {
    const s = state();
    const ev: GameEvent[] = [];
    takeDecision(albania, s, 'd37', 3, scriptedDice([]), ev);
    expect(s.swiss).toBe(333);
    expect(s.treasury).toBe(667);
    expect(ev).toEqual([{ type: 'swissTransfer', amount: 333 }]);
  });

  it('the Swiss account with an empty treasury sends nothing but still uses the turn', () => {
    const s = state();
    s.treasury = 1;
    const ev: GameEvent[] = [];
    expect(takeDecision(albania, s, 'd37', 2, scriptedDice([]), ev)).toBe(true);
    expect(ev).toEqual([{ type: 'swissTransfer', amount: 0 }]);
    expect(s.swiss).toBe(0);
  });

  it('aid: too early (turn < rnd(0..4)+3)', () => {
    const s = state();
    s.quarter = 4;
    const ev: GameEvent[] = [];
    expect(takeDecision(albania, s, 'd38', 2, scriptedDice([2]), ev)).toBe(true);
    expect(ev).toEqual([{ type: 'aidRefused', lender: 'italie', reason: 'tooEarly' }]);
  });

  it('aid: granted pop*30 + rnd(0..199), only once', () => {
    const s = state();
    const ev: GameEvent[] = [];
    takeDecision(albania, s, 'd38', 2, scriptedDice([0, 50]), ev);
    expect(ev).toEqual([{ type: 'aidGranted', lender: 'italie', amount: 260 }]);
    expect(s.treasury).toBe(1260);
    s.decisionTaken = false;
    const ev2: GameEvent[] = [];
    takeDecision(albania, s, 'd38', 2, scriptedDice([0]), ev2);
    expect(ev2).toEqual([{ type: 'aidRefused', lender: 'italie', reason: 'used' }]);
  });

  it('aid: refused by an unfriendly power', () => {
    const s = state();
    s.pop.britanie = 3;
    const ev: GameEvent[] = [];
    takeDecision(albania, s, 'd39', 2, scriptedDice([0]), ev);
    expect(ev).toEqual([{ type: 'aidRefused', lender: 'britanie', reason: 'unpopular' }]);
    expect(s.used.d39).toBeUndefined();
  });

  it('only one decision per turn', () => {
    const s = state();
    takeDecision(albania, s, 'd41', 2, scriptedDice([]), []);
    expect(() => takeDecision(albania, s, 'd42', 2, scriptedDice([]), [])).toThrow();
  });

  it('re-forms plots after a decision', () => {
    const s = state();
    s.pop.armada = 4;
    takeDecision(albania, s, 'd35', 2, scriptedDice([]), []); // armada -2 → 2 ≤ low
    expect(s.plots.armada.kind).not.toBe('none');
  });
});
