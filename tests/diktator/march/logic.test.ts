import { describe, expect, it } from 'vitest';
import { createMarch, marchResult, stepMarch } from '../../../src/games/diktator/minigames/march/logic';
import { tileCentre } from '../../../src/games/diktator/minigames/march/map';
import { applyRope } from '../../../src/games/diktator/minigames/march/move';
import { MARCH } from '../../../src/games/diktator/minigames/march/rules';
import { cameraOf, dateOf, dist, MARCH_END } from '../../../src/games/diktator/minigames/march/state';
import { ALBANIA_MARCH } from '../../../src/games/diktator/scenario/albania/march-map';
import { go, IDLE, noise, place, PLAYGROUND, run } from './helpers';

describe('the clock', () => {
  it('dates 13 December at t = 0, the next day at 22 s, Christmas Eve on the last day', () => {
    expect(dateOf(0)).toBe(13);
    expect(dateOf(21.9)).toBe(13);
    expect(dateOf(22)).toBe(14);
    expect(dateOf(263.9)).toBe(24);
    expect(MARCH_END).toBe(264);
  });

  it('announces a new day', () => {
    const s = createMarch(PLAYGROUND, 1, false);
    s.t = 21.99;
    const events = stepMarch(s, MARCH.step, {});
    expect(events).toContainEqual({ type: 'day', date: 14 });
  });

  it('ends at 264 s as a timeout, with the result 3 s later', () => {
    const s = createMarch(PLAYGROUND, 1, false);
    s.t = MARCH_END - 0.005;
    const events = stepMarch(s, MARCH.step, {});
    expect(events).toContainEqual({ type: 'timeout' });
    expect(s.ending?.kind).toBe('timeout');
    expect(marchResult(s)).toBeNull();
    run(s, 3.1);
    expect(marchResult(s)?.arrivedDay).toBeNull();
  });
});

describe('movement and terrain', () => {
  const speedOn = (row: number) => {
    const s = createMarch(PLAYGROUND, 1, false, { startAt: [2, row] });
    const x0 = s.heroes.zogu.x;
    run(s, 0.5, { zogu: go(1, 0) });
    return s.heroes.zogu.x - x0;
  };

  it('walks 120 units/s on the road, slower on meadow, forest, snow and a ford', () => {
    expect(speedOn(0)).toBeCloseTo(60, 0);
    expect(speedOn(1)).toBeCloseTo(45, 0);
    expect(speedOn(2)).toBeCloseTo(33, 0);
    expect(speedOn(3)).toBeCloseTo(27, 0);
    expect(speedOn(4)).toBeCloseTo(21, 0);
  });

  it('clamps a diagonal to length 1 and faces the last horizontal direction', () => {
    const s = createMarch(PLAYGROUND, 1, false, { startAt: [10, 8] });
    const z = s.heroes.zogu;
    const [x0, y0] = [z.x, z.y];
    run(s, 0.5, { zogu: go(-1, 1) });
    expect(Math.hypot(z.x - x0, z.y - y0)).toBeCloseTo(45, 0);
    expect(z.facing).toBe(-1);
    run(s, 0.1, { zogu: go(0, -1) });
    expect(z.facing).toBe(-1);
    expect(z.moving).toBe(true);
    run(s, 0.1, {});
    expect(z.moving).toBe(false);
  });

  it('stops at rock and slides along it', () => {
    const s = createMarch(PLAYGROUND, 1, false, { startAt: [6, 5] });
    const z = s.heroes.zogu;
    run(s, 2, { zogu: go(0, 1) });
    expect(z.y).toBeLessThan(360);
    const x0 = z.x;
    run(s, 0.5, { zogu: go(1, 1) });
    expect(z.x).toBeGreaterThan(x0 + 30);
    expect(z.y).toBeLessThan(360);
  });

  it('never enters a river', () => {
    const s = createMarch(PLAYGROUND, 1, false, { startAt: [3, 10] });
    run(s, 3, { zogu: go(0, 1), velitel: go(0, 1) });
    expect(s.heroes.zogu.y).toBeLessThan(660);
    expect(s.heroes.velitel.y).toBeLessThan(660);
  });
});

describe('the rope', () => {
  it('stops the pair at 320 units apart', () => {
    const s = createMarch(PLAYGROUND, 1, false, { startAt: [3, 8] });
    run(s, 4, { velitel: go(1, 0) });
    expect(dist(s.heroes.zogu, s.heroes.velitel)).toBeCloseTo(MARCH.rope, 3);
  });

  it('allows sideways moves and moving closer when taut', () => {
    const s = createMarch(PLAYGROUND, 1, false, { startAt: [3, 9] });
    run(s, 4, { velitel: go(1, 0) });
    const v = s.heroes.velitel;
    const y0 = v.y;
    run(s, 0.5, { velitel: go(0, -1) });
    expect(v.y).toBeLessThan(y0 - 50);
    expect(dist(s.heroes.zogu, v)).toBeLessThanOrEqual(MARCH.rope + 1e-6);
    const d0 = dist(s.heroes.zogu, v);
    run(s, 0.5, { velitel: go(-1, 0) });
    expect(dist(s.heroes.zogu, v)).toBeLessThan(d0 - 50);
  });

  it('pulls back only the hero who moved away', () => {
    const map = PLAYGROUND;
    const z = { x: 100, y: 500 };
    const v = { x: 425, y: 500 };
    applyRope(map, z, v, { x: 100, y: 500 }, { x: 420, y: 500 }, 320);
    expect(z).toEqual({ x: 100, y: 500 });
    expect(v.x).toBeCloseTo(420, 6);
  });

  it('never lets the pair drift more than 320 apart (random inputs, many seeds, the real map)', () => {
    for (let seed = 1; seed <= 12; seed++) {
      const s = createMarch(ALBANIA_MARCH, seed, false);
      const zi = noise(seed * 7);
      const vi = noise(seed * 13 + 1);
      for (let i = 0; i < 1800; i++) {
        stepMarch(s, MARCH.step, { zogu: zi(), velitel: vi() });
        expect(dist(s.heroes.zogu, s.heroes.velitel)).toBeLessThanOrEqual(MARCH.rope + 1e-6);
      }
    }
  });
});

describe('camera, trail and the end', () => {
  it('centres the camera on the pair, clamped to the map', () => {
    const s = createMarch(ALBANIA_MARCH, 1, false);
    const c = cameraOf(s);
    expect(c.x).toBe(4800 - 480);
    place(s, 'zogu', 2000, 1500);
    place(s, 'velitel', 2100, 1500);
    expect(cameraOf(s)).toEqual({ x: 2050, y: 1500 });
  });

  it('samples Zogu’s path every half second', () => {
    const s = createMarch(PLAYGROUND, 1, false, { startAt: [2, 0] });
    run(s, 10, { zogu: go(1, 0) });
    expect(s.trail.length).toBeGreaterThanOrEqual(20);
    expect(s.trail.length).toBeLessThanOrEqual(21);
    expect(s.trail[s.trail.length - 1][0]).toBeGreaterThan(s.trail[0][0]);
  });

  it('arrives when Zogu reaches Tirana, with the date, and returns the result after 3 s', () => {
    const s = createMarch(ALBANIA_MARCH, 3, false);
    const [gx, gy] = tileCentre(ALBANIA_MARCH, ALBANIA_MARCH.goal);
    place(s, 'zogu', gx + 80, gy);
    place(s, 'velitel', gx + 120, gy);
    s.t = 5 * 22 + 3;
    const events = stepMarch(s, MARCH.step, {});
    expect(events).toContainEqual({ type: 'arrived', date: 18 });
    expect(marchResult(s)).toBeNull();
    run(s, 2.9);
    expect(marchResult(s)).toBeNull();
    run(s, 0.2);
    const r = marchResult(s)!;
    expect(r.arrivedDay).toBe(18);
    expect(r.gold).toBe(200);
    expect(r.trail.length).toBeGreaterThan(0);
  });

  it('freezes everything after the end', () => {
    const s = createMarch(PLAYGROUND, 1, false);
    s.t = MARCH_END;
    stepMarch(s, MARCH.step, {});
    const z = { ...s.heroes.zogu };
    run(s, 1, { zogu: go(1, 0) });
    expect(s.heroes.zogu.x).toBe(z.x);
  });
});

describe('determinism', () => {
  it('gives the same state for the same seed and inputs', () => {
    const play = () => {
      const s = createMarch(ALBANIA_MARCH, 42, false);
      const zi = noise(5);
      const vi = noise(6);
      for (let i = 0; i < 3000; i++) stepMarch(s, MARCH.step, { zogu: zi(), velitel: vi() });
      return s;
    };
    expect(play()).toEqual(play());
  });

  it('keeps the starting state free of randomness except the seeded variants', () => {
    const a = createMarch(ALBANIA_MARCH, 1, false);
    expect(a.gold).toBe(200);
    expect(a.t).toBe(0);
    expect(dist(a.heroes.zogu, a.heroes.velitel)).toBe(40);
    stepMarch(a, MARCH.step, { zogu: IDLE });
    expect(a.now).toBeCloseTo(MARCH.step, 9);
  });
});
