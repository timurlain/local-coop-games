import { describe, expect, it } from 'vitest';
import { answerPetition, drawPetition, suggestOther } from '../../src/games/diktator/logic/audience';
import { initialState, type GameEvent } from '../../src/games/diktator/logic/state';
import { albania } from '../../src/games/diktator/scenario/albania';
import { scriptedDice } from './helpers';

describe('drawPetition (L630–648)', () => {
  it('takes the petition at the rolled index and marks it used', () => {
    const s = initialState(1);
    const id = drawPetition(albania, s, scriptedDice([4]));
    expect(id).toBe('p05');
    expect(s.used.p05).toBe(true);
  });

  it('steps forward cyclically past used petitions', () => {
    const s = initialState(1);
    s.used.p24 = true;
    s.used.p01 = true;
    expect(drawPetition(albania, s, scriptedDice([23]))).toBe('p02');
  });

  it('resets all petitions when every one is used, then draws again', () => {
    const s = initialState(1);
    for (const p of albania.petitions) s.used[p.id] = true;
    s.used.d25 = true;
    expect(drawPetition(albania, s, scriptedDice([0, 9]))).toBe('p10');
    expect(Object.keys(s.used).sort()).toEqual(['d25', 'p10']);
  });
});

describe('answerPetition (L694–766)', () => {
  it('yes applies the effects', () => {
    const s = initialState(1);
    const ev: GameEvent[] = [];
    answerPetition(albania, s, 'p03', 'yes', ev);
    expect(s.treasury).toBe(900);
    expect(s.str.povstalci).toBe(2);
    expect(ev).toEqual([{ type: 'answered', id: 'p03', answer: 'yes' }]);
  });

  it('no lowers the petitioner by what it would have gained', () => {
    const s = initialState(1);
    answerPetition(albania, s, 'p07', 'no', []);
    expect(s.pop.armada).toBe(3);
    expect(s.costs).toBe(60);
  });

  it('refusing lowers only the petitioner, clamped at 0', () => {
    const s = initialState(1);
    s.pop.rolnici = 2;
    answerPetition(albania, s, 'p10', 'no', []); // p10: rolnici +4, statkari -4, jugoslavie +1
    expect(s.pop.rolnici).toBe(0);
    expect(s.pop.statkari).toBe(7);
    expect(s.pop.jugoslavie).toBe(7);
  });

  it('an unaffordable yes becomes a forced no', () => {
    const s = initialState(1);
    s.treasury = 50;
    const ev: GameEvent[] = [];
    answerPetition(albania, s, 'p08', 'yes', ev);
    expect(ev).toEqual([{ type: 'forcedNo', id: 'p08' }]);
    expect(s.treasury).toBe(50);
    expect(s.pop.armada).toBe(3);
  });

  it('goAway costs 1 popularity and returns the petition to the deck', () => {
    const s = initialState(1);
    s.used.p10 = true;
    answerPetition(albania, s, 'p10', 'goAway', []);
    expect(s.pop.rolnici).toBe(6);
    expect(s.used.p10).toBeUndefined();
  });
});

describe('suggestOther', () => {
  it('returns the current petition and draws another from the same faction', () => {
    const s = initialState(1);
    s.used.p10 = true;
    const id = suggestOther(albania, s, 'p10', scriptedDice([0]));
    expect(id).toBe('p09');
    expect(s.used.p10).toBeUndefined();
    expect(s.used.p09).toBe(true);
  });

  it('throws when the faction has nothing else left', () => {
    const s = initialState(1);
    for (const p of albania.petitions) s.used[p.id] = true;
    expect(() => suggestOther(albania, s, 'p10', scriptedDice([0]))).toThrow();
  });
});
