import { describe, expect, it } from 'vitest';
import { gatePosts, squadSize } from '../../../src/games/diktator/minigames/march/foes';
import { createMarch, stepMarch } from '../../../src/games/diktator/minigames/march/logic';
import { passable } from '../../../src/games/diktator/minigames/march/map';
import { MARCH } from '../../../src/games/diktator/minigames/march/rules';
import { dist, MARCH_END, type Foe, type MarchState } from '../../../src/games/diktator/minigames/march/state';
import { ALBANIA_MARCH } from '../../../src/games/diktator/scenario/albania/march-map';
import { go, HOLD, IDLE, place, PLAYGROUND, PRESS, run } from './helpers';

/** A march with no gendarmes, no gate guards and no spawns; the pair stands at Zerqan (a village on route 1). */
function quiet(seed = 1, map = ALBANIA_MARCH): MarchState {
  const s = createMarch(map, seed, false);
  s.foes = [];
  s.nextSpawnAt = Infinity;
  const zerqan = s.places.find((p) => p.def.id === 'zerqan');
  if (zerqan) {
    place(s, 'zogu', zerqan.x, zerqan.y);
    place(s, 'velitel', zerqan.x - 40, zerqan.y);
  }
  return s;
}

function gendarme(s: MarchState, x: number, y: number, squad = 99, route = 1): Foe {
  const f: Foe = {
    id: s.nextFoeId++, kind: 'gendarme', x, y, facing: -1, moving: false, mode: 'patrol', until: 0, hits: 0,
    route, wp: 1, dir: 1, squad, stuck: 0, place: -1, homeX: x, homeY: y,
  };
  s.foes.push(f);
  return f;
}

const TAP = { ...IDLE, action: true };

describe('gate guards', () => {
  it('stand 40–60 units from every barracks, on passable ground, as many as the seed says', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const s = createMarch(ALBANIA_MARCH, seed, false);
      s.places.forEach((p, i) => {
        const guards = s.foes.filter((f) => f.kind === 'guard' && f.place === i);
        if (p.def.kind !== 'barracks') return expect(guards).toHaveLength(0);
        expect(guards.length).toBeGreaterThanOrEqual(p.def.guards![0]);
        expect(guards.length).toBeLessThanOrEqual(p.def.guards![1]);
        for (const g of guards) {
          expect(dist(g, p)).toBeGreaterThanOrEqual(40);
          expect(dist(g, p)).toBeLessThanOrEqual(60);
          expect(passable(ALBANIA_MARCH, g.x, g.y)).toBe(true);
        }
      });
    }
    expect(gatePosts(0, 0, 1)[0][0]).toBeCloseTo(0, 6);
  });

  it('never chase or catch, and lock the barracks until every one is knocked down', () => {
    const s = createMarch(ALBANIA_MARCH, 2, false);
    s.nextSpawnAt = Infinity;
    const i = s.places.findIndex((p) => p.def.id === 'burrel');
    const p = s.places[i];
    place(s, 'zogu', p.x, p.y);
    place(s, 'velitel', p.x, p.y + 20);
    const guards = s.foes.filter((f) => f.place === i);
    const posts = guards.map((g) => [g.x, g.y]);
    const events = run(s, 3, { zogu: PRESS });
    expect(events).toContainEqual({ type: 'refused', place: i, reason: 'locked' });
    expect(p.progress).toBe(0);
    expect(s.caught).toBe(0);
    expect(guards.map((g) => [g.x, g.y])).toEqual(posts);
    for (const g of guards) {
      place(s, 'velitel', g.x, g.y - 30);
      run(s, 0.5, { velitel: TAP });
      place(s, 'velitel', g.x, g.y - 30);
      run(s, 0.5, { velitel: TAP });
      expect(g.mode === 'down' || g.mode === 'surrender').toBe(true);
    }
    run(s, 8.2, { zogu: HOLD });
    expect(s.barracks).toBe(1);
    expect(s.joined).toBe(guards.length);
    expect(s.captured).toBe(0);
  });
});

describe('spawning', () => {
  it('sends 1 gendarme a patrol on 13–16 Dec, 2 on 17–20, 3 on 21–24', () => {
    expect([13, 16, 17, 20, 21, 24].map(squadSize)).toEqual([1, 1, 2, 2, 3, 3]);
  });

  it('tries the first patrol at 8 s, off screen but near, then every 8–12 s', () => {
    const s = createMarch(ALBANIA_MARCH, 4, false);
    s.heroes.zogu.immuneUntil = Infinity;
    expect(run(s, 7.9).some((e) => e.type === 'spawned')).toBe(false);
    expect(run(s, 0.2)).toContainEqual({ type: 'spawned', squad: 1, size: 1 });
    expect(s.nextSpawnAt - s.now).toBeGreaterThanOrEqual(7.8);
    expect(s.nextSpawnAt - s.now).toBeLessThanOrEqual(12.1);
    const g = s.foes.find((f) => f.kind === 'gendarme')!;
    const cam = { x: (s.heroes.zogu.x + s.heroes.velitel.x) / 2, y: (s.heroes.zogu.y + s.heroes.velitel.y) / 2 };
    expect(dist(g, cam)).toBeGreaterThan(550);
  });

  it('never has more than 6 gendarmes about', () => {
    const s = createMarch(ALBANIA_MARCH, 5, false);
    s.heroes.zogu.immuneUntil = Infinity;
    s.t = 8 * 22;
    let most = 0;
    for (let i = 0; i < 80 * 60; i++) {
      stepMarch(s, MARCH.step, {});
      const n = s.foes.filter((f) => f.kind === 'gendarme').length;
      most = Math.max(most, n);
      expect(n).toBeLessThanOrEqual(MARCH.maxAlive);
    }
    expect(most).toBeGreaterThanOrEqual(3);
  });
});

describe('patrols and chases', () => {
  it('see Zogu within 260 units, and twice as far while he negotiates', () => {
    const s = quiet();
    const z = s.heroes.zogu;
    const g = gendarme(s, z.x + 400, z.y);
    run(s, 0.05);
    expect(g.mode).toBe('patrol');
    g.x = z.x + 400;
    g.y = z.y;
    run(s, 0.05, { zogu: HOLD });
    expect(s.negotiating).toBeGreaterThanOrEqual(0);
    expect(g.mode).toBe('chase');
  });

  it('give up beyond 700 units', () => {
    const s = quiet();
    const g = gendarme(s, s.heroes.zogu.x + 200, s.heroes.zogu.y);
    run(s, 0.05);
    expect(g.mode).toBe('chase');
    g.x = s.heroes.zogu.x + 750;
    run(s, 0.05);
    expect(g.mode).toBe('return');
  });

  it('give up after 1.5 s stuck against rock', () => {
    const map = { ...PLAYGROUND, patrols: [[[12, 8], [16, 8]] as const] };
    const s = createMarch(map, 1, false, { startAt: [7, 5] });
    s.nextSpawnAt = Infinity;
    const g = gendarme(s, 450, 450, 99, 0);
    run(s, 1);
    expect(g.mode).toBe('chase');
    run(s, 1.2); // ~0.4 s to reach the rock, then 1.5 s stuck
    expect(g.mode).toBe('return');
  });
});

describe('the catch', () => {
  it('costs 20 gold and a whole day, sends the patrol away, holds Zogu 2 s and then protects him 4 s', () => {
    const s = quiet();
    const z = s.heroes.zogu;
    const g1 = gendarme(s, z.x + 20, z.y, 7);
    const g2 = gendarme(s, z.x + 250, z.y, 7);
    const other = gendarme(s, z.x - 600, z.y, 8);
    const t0 = s.t;
    const events = run(s, MARCH.step);
    expect(events).toContainEqual({ type: 'caught' });
    expect(events).toContainEqual({ type: 'coins', amount: -20 });
    expect(s.gold).toBe(180);
    expect(s.t).toBeCloseTo(t0 + MARCH.step + 22, 6);
    expect(s.caught).toBe(1);
    expect([g1.mode, g2.mode, other.mode]).toEqual(['leaving', 'leaving', 'patrol']);
    const x0 = z.x;
    run(s, 1.5, { zogu: go(1, 0) });
    expect(z.x).toBe(x0);
    run(s, 0.6, { zogu: go(1, 0) });
    expect(z.x).toBeGreaterThan(x0);
    run(s, 2.5, {});
    expect(s.foes.some((f) => f.squad === 7)).toBe(false);
    gendarme(s, z.x + 10, z.y, 9);
    run(s, 0.5);
    expect(s.caught).toBe(1);
  });

  it('never takes the purse below 0', () => {
    const s = quiet();
    s.gold = 5;
    gendarme(s, s.heroes.zogu.x + 10, s.heroes.zogu.y);
    run(s, MARCH.step);
    expect(s.gold).toBe(0);
  });

  it('ends the march when the lost day runs past Christmas Eve', () => {
    const s = quiet();
    s.t = 250;
    gendarme(s, s.heroes.zogu.x + 10, s.heroes.zogu.y);
    const events = stepMarch(s, MARCH.step, {});
    expect(s.t).toBeGreaterThanOrEqual(MARCH_END);
    expect(events).toContainEqual({ type: 'timeout' });
    expect(s.arrivedDay).toBeNull();
  });
});

describe('Vlček’s blow', () => {
  it('has a 0.45 s cooldown', () => {
    const s = quiet();
    const events = run(s, 0.4, { velitel: TAP });
    expect(events.filter((e) => e.type === 'swing')).toHaveLength(1);
    expect(run(s, 0.1, { velitel: TAP }).filter((e) => e.type === 'swing')).toHaveLength(1);
  });

  it('hits the nearest foe in reach, knocks him back 30 units and stuns him', () => {
    const s = quiet();
    const v = s.heroes.velitel;
    place(s, 'zogu', v.x - 300, v.y);
    const near = gendarme(s, v.x + 30, v.y);
    const far = gendarme(s, v.x + 50, v.y);
    const events = stepMarch(s, MARCH.step, { velitel: TAP });
    expect(events).toContainEqual({ type: 'hit', down: false });
    expect(near.mode).toBe('stunned');
    expect(near.x).toBeCloseTo(v.x + 60, 0);
    expect(far.hits).toBe(0);
  });

  it('knocks out with the second hit; a gendarme surrenders and counts, then leaves', () => {
    const s = quiet();
    const v = s.heroes.velitel;
    place(s, 'zogu', v.x - 300, v.y);
    const g = gendarme(s, v.x + 30, v.y);
    stepMarch(s, MARCH.step, { velitel: TAP });
    run(s, 0.5);
    g.x = v.x + 30;
    g.y = v.y;
    const events = run(s, 0.1, { velitel: TAP });
    expect(events).toContainEqual({ type: 'hit', down: true });
    expect(g.mode).toBe('down');
    run(s, 1.25);
    expect(g.mode).toBe('surrender');
    expect(s.captured).toBe(1);
    run(s, 1.6);
    expect(s.foes).not.toContain(g);
    expect(s.captured).toBe(1);
  });

  it('swings at the air when nobody is in reach', () => {
    const s = quiet();
    const events = stepMarch(s, MARCH.step, { velitel: TAP });
    expect(events).toEqual([{ type: 'swing' }]);
  });
});
