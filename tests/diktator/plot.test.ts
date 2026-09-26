import { describe, expect, it } from 'vitest';
import { formPlots } from '../../src/games/diktator/logic/plot';
import { initialState } from '../../src/games/diktator/logic/state';

function state() {
  const s = initialState(1);
  s.quarter = 5;
  s.low = 3;
  s.threshold = 11;
  return s;
}

describe('formPlots (L1400)', () => {
  it('does nothing in the first two turns', () => {
    const s = state();
    s.quarter = 2;
    s.pop.armada = 0;
    s.plots.armada = { kind: 'assassination' };
    formPlots(s);
    expect(s.plots.armada).toEqual({ kind: 'assassination' });
  });

  it('clears plots of happy factions', () => {
    const s = state();
    s.plots.rolnici = { kind: 'assassination' };
    formPlots(s);
    expect(s.plots.rolnici).toEqual({ kind: 'none' });
  });

  it('clears plots but forms none while paused', () => {
    const s = state();
    s.pop.armada = 1;
    s.plots.armada = { kind: 'assassination' };
    s.plotPauseUntil = 6;
    formPlots(s);
    expect(s.plots.armada).toEqual({ kind: 'none' });
  });

  it('an unhappy faction with a strong enough hostile partner plans a revolution with the first such partner', () => {
    const s = state();
    s.pop.armada = 2;
    s.str.armada = 6;
    // povstalci (pop 0, str 6): 6 + 6 >= 11 → first hostile partner in order 1..6
    formPlots(s);
    expect(s.plots.armada).toEqual({ kind: 'revolution', ally: 'povstalci' });
  });

  it('prefers an earlier group as partner', () => {
    const s = state();
    s.pop.armada = 2;
    s.pop.rolnici = 3;
    s.str.rolnici = 5;
    formPlots(s);
    expect(s.plots.armada).toEqual({ kind: 'revolution', ally: 'rolnici' });
  });

  it('without a strong enough partner it plans an assassination', () => {
    const s = state();
    s.pop.statkari = 3;
    s.str.statkari = 2;
    s.str.povstalci = 2;
    formPlots(s);
    expect(s.plots.statkari).toEqual({ kind: 'assassination' });
  });

  it('a faction never partners with itself', () => {
    const s = state();
    s.pop.armada = 0;
    s.str.armada = 9;
    s.str.povstalci = 0;
    s.pop.jugoslavie = 9;
    s.pop.policie = 9;
    formPlots(s);
    expect(s.plots.armada).toEqual({ kind: 'assassination' });
  });
});
