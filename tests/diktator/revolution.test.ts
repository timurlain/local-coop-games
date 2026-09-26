import { describe, expect, it } from 'vitest';
import { maybeNews } from '../../src/games/diktator/logic/news';
import {
  afterVictory,
  eligibleAllies,
  findRevolution,
  fightRevolution,
  flee,
  throughMountains,
} from '../../src/games/diktator/logic/revolution';
import { score } from '../../src/games/diktator/logic/score';
import { initialState, type GameEvent } from '../../src/games/diktator/logic/state';
import { albania } from '../../src/games/diktator/scenario/albania';
import { scriptedDice } from './helpers';

function state() {
  const s = initialState(1);
  s.quarter = 10;
  s.low = 3;
  return s;
}

describe('maybeNews (L2750)', () => {
  it('nothing on a non-zero roll', () => {
    const s = state();
    const ev: GameEvent[] = [];
    maybeNews(albania, s, scriptedDice([1]), ev);
    expect(ev).toEqual([]);
  });

  it('applies an unused item and marks it; steps past used ones', () => {
    const s = state();
    s.used.n45 = true;
    const ev: GameEvent[] = [];
    maybeNews(albania, s, scriptedDice([0, 1]), ev);
    expect(ev).toEqual([{ type: 'news', id: 'n46' }]);
    expect(s.str.armada).toBe(2);
    expect(s.used.n46).toBe(true);
  });

  it('does nothing when all news is used', () => {
    const s = state();
    for (const n of albania.news) s.used[n.id] = true;
    const ev: GameEvent[] = [];
    maybeNews(albania, s, scriptedDice([0, 3]), ev);
    expect(ev).toEqual([]);
  });
});

describe('revolution (L1800–1969)', () => {
  it('findRevolution tries three random factions', () => {
    const s = state();
    s.plots.statkari = { kind: 'revolution', ally: 'povstalci' };
    expect(findRevolution(s, scriptedDice([0, 1, 2]))).toBe('statkari');
    expect(findRevolution(s, scriptedDice([0, 1, 0]))).toBeNull();
  });

  it('mountains: caught unless INT(RND*(G/3+0.4)) is 0', () => {
    const s = state();
    s.str.povstalci = 6; // range 2.4
    expect(throughMountains(s, scriptedDice([0.3]), [])).toEqual({ kind: 'escaped', via: 'mountains' });
    expect(throughMountains(s, scriptedDice([0.5]), [])).toEqual({ kind: 'killed', cause: 'mountains' });
    s.str.povstalci = 0; // range 0.4 → always 0
    expect(throughMountains(s, scriptedDice([0.99]), [])).toEqual({ kind: 'escaped', via: 'mountains' });
  });

  it('flee by plane works 2/3, otherwise falls back to the mountains', () => {
    const s = state();
    s.hasPlane = true;
    expect(flee(s, scriptedDice([1]), [])).toEqual({ kind: 'escaped', via: 'plane' });
    const ev: GameEvent[] = [];
    expect(flee(s, scriptedDice([0, 0.1]), ev)).toEqual({ kind: 'escaped', via: 'mountains' });
    expect(ev).toEqual([{ type: 'planeFailed' }]);
  });

  it('eligible allies are groups 1–6 with popularity above low', () => {
    const s = state();
    s.pop.rolnici = 2;
    expect(eligibleAllies(s)).toEqual(['armada', 'statkari', 'jugoslavie', 'policie']);
  });

  it('the fight: rebels ≤ guard + ally strength + rnd(-1..1) wins', () => {
    const s = state();
    s.plots.armada = { kind: 'revolution', ally: 'povstalci' };
    // rebels 6 + 6 = 12; ours = guard 4 + policie 6 + (roll - 1)
    const ev: GameEvent[] = [];
    expect(fightRevolution(s, 'armada', 'policie', scriptedDice([2]), ev)).toBe(false);
    expect(ev).toEqual([{ type: 'revolutionFight', rebels: 12, ours: 11, won: false }]);
    s.guard = 6;
    expect(fightRevolution(s, 'armada', 'policie', scriptedDice([0]), [])).toBe(false);
    expect(fightRevolution(s, 'armada', 'policie', scriptedDice([1]), [])).toBe(true);
  });

  it('fighting alone uses only the guard (original bug fixed)', () => {
    const s = state();
    s.plots.armada = { kind: 'revolution', ally: 'povstalci' };
    s.str.armada = 2;
    s.str.povstalci = 2;
    expect(fightRevolution(s, 'armada', null, scriptedDice([1]), [])).toBe(true);
  });

  it('after victory: punishing zeroes rebels and their ally, the chosen ally gets strength 9, plots pause', () => {
    const s = state();
    s.plots.armada = { kind: 'revolution', ally: 'povstalci' };
    const ev: GameEvent[] = [];
    afterVictory(s, 'armada', 'policie', true, ev);
    expect(s.pop.armada).toBe(0);
    expect(s.str.armada).toBe(0);
    expect(s.pop.povstalci).toBe(0);
    expect(s.str.povstalci).toBe(0);
    expect(s.str.policie).toBe(9);
    expect(s.plotPauseUntil).toBe(12);
    expect(ev).toEqual([{ type: 'punished', faction: 'armada', ally: 'povstalci' }]);
  });

  it('after victory without punishing only the ally is rewarded', () => {
    const s = state();
    s.plots.armada = { kind: 'revolution', ally: 'povstalci' };
    afterVictory(s, 'armada', 'statkari', false, []);
    expect(s.str.armada).toBe(6);
    expect(s.str.statkari).toBe(9);
  });
});

describe('score (L3026–3070)', () => {
  it('popularity + 9 per quarter, plus alive bonus and Swiss money when alive', () => {
    const s = state();
    s.swiss = 255;
    // popularity: 7*7 + 0 = 49; quarters 10 → 90; alive 10; swiss 25
    expect(score(s, { kind: 'survived' })).toEqual({ popularity: 49, time: 90, alive: 10, swiss: 25, total: 174 });
    expect(score(s, { kind: 'escaped', via: 'plane' }).total).toBe(174);
    expect(score(s, { kind: 'killed', cause: 'war' })).toEqual({ popularity: 49, time: 90, alive: 0, swiss: 0, total: 139 });
  });
});
