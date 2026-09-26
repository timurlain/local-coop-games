import { describe, expect, it } from 'vitest';
import { assassination } from '../../src/games/diktator/logic/assassination';
import { war } from '../../src/games/diktator/logic/war';
import { initialState, type GameEvent } from '../../src/games/diktator/logic/state';
import { scriptedDice } from './helpers';

function state() {
  const s = initialState(1);
  s.quarter = 8;
  s.low = 3;
  return s;
}

describe('assassination (L1500–1560)', () => {
  it('nothing happens unless the rolled faction plots an assassination', () => {
    const s = state();
    s.plots.rolnici = { kind: 'assassination' };
    const ev: GameEvent[] = [];
    expect(assassination(s, scriptedDice([0]), ev)).toBe(false);
    expect(ev).toEqual([]);
  });

  it('a friendly or strong police saves the ruler without a coin', () => {
    const s = state();
    s.plots.armada = { kind: 'assassination' };
    s.pop.policie = 2;
    const ev: GameEvent[] = [];
    expect(assassination(s, scriptedDice([0]), ev)).toBe(false);
    expect(ev).toEqual([{ type: 'assassination', faction: 'armada', survived: true }]);
  });

  it('with the police hostile and weak, the coin decides', () => {
    const s = state();
    s.plots.armada = { kind: 'assassination' };
    s.pop.policie = 2;
    s.str.policie = 1;
    expect(assassination(s, scriptedDice([0, 1]), [])).toBe(false);
    expect(assassination(s, scriptedDice([0, 0]), [])).toBe(true);
  });

  it('all three factions plotting assassination is always fatal', () => {
    const s = state();
    s.plots = { armada: { kind: 'assassination' }, rolnici: { kind: 'assassination' }, statkari: { kind: 'assassination' } };
    expect(assassination(s, scriptedDice([2]), [])).toBe(true);
  });
});

describe('war (L4200–4340)', () => {
  it('no war while Yugoslavia is friendly or weak', () => {
    const s = state();
    expect(war(s, scriptedDice([]), [])).toBe('none');
    s.pop.jugoslavie = 2;
    s.str.jugoslavie = 2;
    expect(war(s, scriptedDice([]), [])).toBe('none');
  });

  it('a threat of war rallies the factions and the police (+1, max 9)', () => {
    const s = state();
    s.pop.jugoslavie = 2;
    s.pop.armada = 9;
    const ev: GameEvent[] = [];
    expect(war(s, scriptedDice([1]), ev)).toBe('threat');
    expect(s.pop).toMatchObject({ armada: 9, rolnici: 8, statkari: 8, policie: 8 });
    expect(ev).toEqual([{ type: 'warThreat' }]);
  });

  it('an invasion is won when home > enemy + roll; Yugoslavia loses all strength', () => {
    const s = state();
    s.pop.jugoslavie = 2;
    // home = guard 4 + 6+6+6 + police 6 = 28; enemy = povstalci 6 + jugoslavie 6 = 12
    const ev: GameEvent[] = [];
    expect(war(s, scriptedDice([0, 2]), ev)).toBe('won');
    expect(s.str.jugoslavie).toBe(0);
    expect(ev).toEqual([{ type: 'invasion', home: 28, enemy: 12, won: true }]);
  });

  it('a lost invasion kills, unless the plane works (2/3)', () => {
    const lose = () => {
      const s = state();
      s.pop = { ...s.pop, armada: 1, rolnici: 1, statkari: 1, jugoslavie: 1, policie: 1 };
      return s;
    };
    expect(war(lose(), scriptedDice([0, 1]), [])).toBe('killed');
    const withPlane = lose();
    withPlane.hasPlane = true;
    expect(war(withPlane, scriptedDice([0, 1, 1]), [])).toBe('escaped');
    const brokenPlane = lose();
    brokenPlane.hasPlane = true;
    expect(war(brokenPlane, scriptedDice([0, 1, 0]), [])).toBe('killed');
  });
});
