import { describe, expect, it } from 'vitest';
import { createMarch } from '../../../src/games/diktator/minigames/march/logic';
import type { MarchPlaceId } from '../../../src/games/diktator/minigames/march/map';
import { zoguPlace } from '../../../src/games/diktator/minigames/march/places';
import { MARCH } from '../../../src/games/diktator/minigames/march/rules';
import type { MarchState } from '../../../src/games/diktator/minigames/march/state';
import { ALBANIA_MARCH } from '../../../src/games/diktator/scenario/albania/march-map';
import { go, HOLD, place, PRESS, run } from './helpers';

/** A fresh march with no gendarmes and no gate guards, and the index of place `id`. */
function at(id: MarchPlaceId, seed = 1): { s: MarchState; i: number } {
  const s = createMarch(ALBANIA_MARCH, seed, false);
  s.foes = [];
  s.nextSpawnAt = Infinity;
  const i = s.places.findIndex((p) => p.def.id === id);
  place(s, 'zogu', s.places[i].x, s.places[i].y);
  place(s, 'velitel', s.places[i].x - 40, s.places[i].y);
  return { s, i };
}

describe('seeded variants', () => {
  it('draws village rings of 4–6 s and tower bribes of 30/40/50; the rest is fixed', () => {
    const rings = new Set<number>();
    const bribes = new Set<number>();
    for (let seed = 1; seed <= 60; seed++) {
      const s = createMarch(ALBANIA_MARCH, seed, false);
      for (const p of s.places) {
        if (p.def.kind === 'village') rings.add(p.ring);
        else expect(p.ring).toBe(MARCH.ring[p.def.kind]);
        if (p.def.kind === 'tower') bribes.add(p.bribe);
        else expect(p.bribe).toBe(0);
      }
    }
    expect([...rings].sort()).toEqual([4, 5, 6]);
    expect([...bribes].sort()).toEqual([30, 40, 50]);
  });
});

describe('negotiation', () => {
  it('fills the ring only while Action is held inside the place, and keeps the progress outside', () => {
    const { s, i } = at('maqellare');
    const p = s.places[i];
    run(s, 1, { zogu: HOLD });
    expect(p.progress).toBeCloseTo(1, 1);
    expect(s.negotiating).toBe(i);
    run(s, 1, {});
    expect(p.progress).toBeCloseTo(1, 1);
    expect(s.negotiating).toBe(-1);
    run(s, 1.5, { zogu: go(1, 0) });
    expect(zoguPlace(s)).toBe(-1);
    run(s, 1, { zogu: HOLD });
    expect(p.progress).toBeCloseTo(1, 1);
  });

  it('wins a village once, with a tick every second', () => {
    const { s, i } = at('zerqan');
    const p = s.places[i];
    const events = run(s, p.ring + 0.1, { zogu: HOLD });
    expect(p.won).toBe(true);
    expect(s.villages).toBe(1);
    expect(events.filter((e) => e.type === 'won')).toEqual([{ type: 'won', place: i }]);
    expect(events.filter((e) => e.type === 'tick').length).toBe(p.ring - 1);
    run(s, 10, { zogu: HOLD });
    expect(s.villages).toBe(1);
  });

  it('gives Burgajet a village and 40 gold', () => {
    const { s } = at('burgajet');
    run(s, MARCH.ring.home + 0.1, { zogu: HOLD });
    expect(s.villages).toBe(1);
    expect(s.gold).toBe(240);
  });

  it('charges a tower its bribe when the ring completes', () => {
    const { s, i } = at('bulqize');
    const bribe = s.places[i].bribe;
    run(s, 2, { zogu: HOLD });
    expect(s.gold).toBe(200);
    const events = run(s, 3.1, { zogu: HOLD });
    expect(s.towers).toBe(1);
    expect(s.gold).toBe(200 - bribe);
    expect(events).toContainEqual({ type: 'coins', amount: -bribe });
  });

  it('refuses a tower without enough gold, and says so on the press', () => {
    const { s, i } = at('selite');
    s.gold = s.places[i].bribe - 1;
    const events = run(s, 0.1, { zogu: PRESS });
    expect(events).toContainEqual({ type: 'refused', place: i, reason: 'noGold' });
    run(s, 6, { zogu: HOLD });
    expect(s.places[i].progress).toBe(0);
    expect(s.towers).toBe(0);
    expect(s.negotiating).toBe(-1);
  });

  it('gives a barracks (its gate guards gone) +1 and 20 gold after 8 s', () => {
    const { s } = at('burrel');
    run(s, 7.9, { zogu: HOLD });
    expect(s.barracks).toBe(0);
    run(s, 0.2, { zogu: HOLD });
    expect(s.barracks).toBe(1);
    expect(s.gold).toBe(220);
  });

  it('waves outside a place', () => {
    const { s } = at('klos');
    place(s, 'zogu', s.heroes.zogu.x, s.heroes.zogu.y + 100);
    run(s, 0.1, { zogu: PRESS });
    expect(s.heroes.zogu.actUntil).toBeGreaterThan(s.now);
  });
});
