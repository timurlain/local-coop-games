import { describe, expect, it } from 'vitest';
import { initialState } from '../../src/games/diktator/logic/state';

describe('initialState (L140–L244)', () => {
  it('uses the original starting values', () => {
    const s = initialState(42);
    expect(s.version).toBe(6); // bumped for the attempt phase
    expect(s.palace).toBeNull();
    expect(s.quarter).toBe(0);
    expect(s.treasury).toBe(300); // starting reserve 300, not the original 1000 (our addition, play-test change)
    expect(s.income).toBe(60); // per-quarter income (our addition, play-test change; the original had none)
    expect(s.costs).toBe(60);
    expect(s.guard).toBe(4);
    expect(s.swiss).toBe(0);
    expect(s.pop).toEqual({ armada: 7, rolnici: 7, statkari: 7, povstalci: 0, jugoslavie: 7, policie: 7, italie: 7, britanie: 7 });
    expect(s.str).toEqual({ armada: 6, rolnici: 6, statkari: 6, povstalci: 6, jugoslavie: 6, policie: 6 });
    expect(s.plots).toEqual({ armada: { kind: 'none' }, rolnici: { kind: 'none' }, statkari: { kind: 'none' } });
    expect(s.hasPlane).toBe(false);
    expect(s.used).toEqual({});
    expect(s.accepted).toEqual({}); // tariffs plan (our addition, play-test change)
  });

  it('applies a starting regime over the defaults', () => {
    const s = initialState(1, { pop: { armada: 5 }, str: { povstalci: 3 }, treasury: 800 });
    expect(s.pop.armada).toBe(5);
    expect(s.pop.rolnici).toBe(7);
    expect(s.str.povstalci).toBe(3);
    expect(s.treasury).toBe(800);
  });

  it('is plain JSON (survives a round trip)', () => {
    const s = initialState(7);
    expect(JSON.parse(JSON.stringify(s))).toEqual(s);
  });
});
