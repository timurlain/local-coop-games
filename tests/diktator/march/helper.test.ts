import { describe, expect, it } from 'vitest';
import { createMarch, stepMarch } from '../../../src/games/diktator/minigames/march/logic';
import { MARCH } from '../../../src/games/diktator/minigames/march/rules';
import { dist, type Foe, type MarchState } from '../../../src/games/diktator/minigames/march/state';
import { ALBANIA_MARCH } from '../../../src/games/diktator/scenario/albania/march-map';
import { go, HOLD, place, run } from './helpers';

function solo(): MarchState {
  const s = createMarch(ALBANIA_MARCH, 1, true);
  s.foes = [];
  s.nextSpawnAt = Infinity;
  return s;
}

function chaser(s: MarchState, x: number, y: number): Foe {
  const f: Foe = {
    id: s.nextFoeId++, kind: 'gendarme', x, y, facing: -1, moving: false, mode: 'chase', until: 0, hits: 0,
    route: 1, wp: 1, dir: 1, squad: 50, stuck: 0, place: -1, homeX: x, homeY: y,
  };
  s.foes.push(f);
  return f;
}

describe('the solo helper', () => {
  it('follows the active hero and stops within 90 units', () => {
    const s = solo();
    run(s, 3, { zogu: go(-1, 0) }, 'zogu');
    const d = dist(s.heroes.zogu, s.heroes.velitel);
    expect(d).toBeGreaterThan(60);
    expect(d).toBeLessThanOrEqual(MARCH.followStop + 5);
    run(s, 2, {}, 'zogu');
    expect(dist(s.heroes.zogu, s.heroes.velitel)).toBeLessThanOrEqual(MARCH.followStop + 1);
    expect(s.heroes.velitel.moving).toBe(false);
  });

  it('as Vlček, walks at a gendarme chasing Zogu and strikes him on his own, every 0.8 s at most', () => {
    const s = solo();
    const z = s.heroes.zogu;
    s.heroes.zogu.immuneUntil = Infinity;
    const g = chaser(s, z.x - 150, z.y);
    const v = s.heroes.velitel;
    const vx0 = v.x;
    const events = [];
    for (let i = 0; i < 6; i++) events.push(...stepMarch(s, MARCH.step, {}, 'zogu'));
    expect(v.x).toBeLessThan(vx0); // he heads west, at the gendarme (following alone would keep him still)
    for (let i = 6; i < 90; i++) events.push(...stepMarch(s, MARCH.step, {}, 'zogu'));
    const swings = events.filter((e) => e.type === 'swing').length;
    expect(swings).toBeGreaterThanOrEqual(1);
    expect(swings).toBeLessThanOrEqual(2);
    expect(g.hits).toBeGreaterThanOrEqual(1);
  });

  it('as Zogu, only follows: he never negotiates', () => {
    const s = solo();
    const i = s.places.findIndex((p) => p.def.id === 'maqellare');
    place(s, 'zogu', s.places[i].x, s.places[i].y);
    place(s, 'velitel', s.places[i].x - 40, s.places[i].y);
    run(s, 6, { velitel: HOLD }, 'velitel');
    expect(s.places[i].progress).toBe(0);
    expect(s.villages).toBe(0);
  });

  it('is off in co-op: a hero without input stands still', () => {
    const s = createMarch(ALBANIA_MARCH, 1, false);
    s.nextSpawnAt = Infinity;
    const v0 = { ...s.heroes.velitel };
    run(s, 2, { zogu: go(-1, 0) });
    expect(s.heroes.velitel.x).toBe(v0.x);
  });
});
