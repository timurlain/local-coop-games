import { describe, expect, it } from 'vitest';
import { createMarch, marchResult } from '../../../src/games/diktator/minigames/march/logic';
import { tileCentre, type MarchPlaceId } from '../../../src/games/diktator/minigames/march/map';
import { MARCH } from '../../../src/games/diktator/minigames/march/rules';
import { dist, MARCH_END, type MarchState } from '../../../src/games/diktator/minigames/march/state';
import { ALBANIA_MARCH } from '../../../src/games/diktator/scenario/albania/march-map';
import { go, HOLD, place, run } from './helpers';

function quiet(): MarchState {
  const s = createMarch(ALBANIA_MARCH, 1, false);
  s.foes = [];
  s.nextSpawnAt = Infinity;
  return s;
}

function standAt(s: MarchState, id: MarchPlaceId): number {
  const i = s.places.findIndex((p) => p.def.id === id);
  place(s, 'zogu', s.places[i].x, s.places[i].y);
  place(s, 'velitel', s.places[i].x - 40, s.places[i].y);
  return i;
}

describe('hidden supply caches', () => {
  it('give 15 gold once, to either hero who steps on them', () => {
    const s = quiet();
    const [x, y] = tileCentre(ALBANIA_MARCH, ALBANIA_MARCH.caches[0]);
    place(s, 'velitel', x + 30, y);
    place(s, 'zogu', x + 200, y);
    const events = run(s, 0.1);
    expect(events).toContainEqual({ type: 'cache', index: 0 });
    expect(s.gold).toBe(215);
    run(s, 1);
    expect(s.gold).toBe(215);
    expect(s.caches).toEqual([true, false, false]);
  });
});

describe('the volunteers of Martanesh', () => {
  it('join after 4 s of negotiation', () => {
    const s = quiet();
    standAt(s, 'martanesh');
    run(s, MARCH.ring.volunteers + 0.1, { zogu: HOLD });
    expect(s.volunteers).toBe(true);
    expect(s.villages).toBe(0);
  });
});

describe('the bey’s stable at Homesh', () => {
  it('lends horses: the pair walks 25 % faster for two days of the march clock', () => {
    const s = quiet();
    standAt(s, 'homesh');
    run(s, MARCH.ring.stable + 0.1, { zogu: HOLD });
    expect(s.horses).toBe(true);
    expect(s.horsesUntil).toBeCloseTo(s.t + 44, 0);
    place(s, 'zogu', 3930, 1650); // Peshkopi, on the road
    place(s, 'velitel', 3890, 1650);
    const x0 = s.heroes.zogu.x;
    run(s, 0.5, { zogu: go(-1, 0), velitel: go(-1, 0) });
    expect(x0 - s.heroes.zogu.x).toBeCloseTo(75, 0);
    s.t = s.horsesUntil + 1;
    const x1 = s.heroes.zogu.x;
    run(s, 0.5, { zogu: go(-1, 0), velitel: go(-1, 0) });
    expect(x1 - s.heroes.zogu.x).toBeCloseTo(60, 0);
  });
});

describe('the Italian messenger', () => {
  it('walks his road, waits while Zogu is with him, and brings Italy’s favour after 2 s', () => {
    const s = quiet();
    const i = s.places.findIndex((p) => p.def.kind === 'messenger');
    const m = s.places[i];
    place(s, 'zogu', 600, 2400);
    place(s, 'velitel', 640, 2400);
    const x0 = m.x;
    run(s, 2);
    expect(m.x).toBeLessThan(x0 - 50);
    place(s, 'zogu', m.x, m.y);
    place(s, 'velitel', m.x + 30, m.y);
    const x1 = m.x;
    run(s, MARCH.ring.messenger + 0.1, { zogu: HOLD });
    expect(m.x).toBe(x1);
    expect(s.messenger).toBe(true);
    expect(dist(m, s.heroes.zogu)).toBeLessThan(1);
  });

  it('turns back at the ends of his road', () => {
    const s = quiet();
    const m = s.places.find((p) => p.def.kind === 'messenger')!;
    place(s, 'zogu', 600, 2400);
    place(s, 'velitel', 640, 2400);
    run(s, 40);
    const [ex] = tileCentre(ALBANIA_MARCH, ALBANIA_MARCH.messengerRoad[1]);
    expect(m.x).toBeGreaterThan(ex + 10);
  });
});

describe('the result carries the benefits', () => {
  it('reports caches, volunteers, messenger and horses', () => {
    const s = quiet();
    s.caches = [true, false, true];
    s.volunteers = true;
    s.messenger = true;
    s.horses = true;
    s.t = MARCH_END;
    run(s, 3.1);
    const r = marchResult(s)!;
    expect([r.caches, r.volunteers, r.messenger, r.horses]).toEqual([2, true, true, true]);
  });
});
