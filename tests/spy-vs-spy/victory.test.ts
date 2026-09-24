import { describe, expect, it } from 'vitest';
import { MOB_CLEARANCE, mobPositions } from '../../src/games/spy-vs-spy/render/victory';

describe('mobPositions', () => {
  it('starts with the whole mob off screen', () => {
    for (const m of mobPositions(0, 160)) expect(m.x < 0 || m.x > 320).toBe(true);
  });

  it('ends in a ring around the loser without touching them', () => {
    const loserX = 160;
    const mob = mobPositions(20, loserX);
    expect(mob).toHaveLength(8);
    for (const m of mob) {
      expect(Math.abs(m.x - loserX)).toBeGreaterThanOrEqual(MOB_CLEARANCE);
      expect(m.x).toBeGreaterThan(0);
      expect(m.x).toBeLessThan(320);
    }
    expect(mobPositions(30, loserX)).toEqual(mob); // stopped
  });

  it('comes from both sides and faces the loser', () => {
    const loserX = 160;
    for (const m of mobPositions(20, loserX)) {
      expect(m.facing).toBe(m.x < loserX ? 1 : -1);
    }
    const mob = mobPositions(20, loserX);
    expect(mob.some((m) => m.x < loserX)).toBe(true);
    expect(mob.some((m) => m.x > loserX)).toBe(true);
  });

  it('moves closer over time', () => {
    const early = mobPositions(1.5, 160)[0].x;
    const later = mobPositions(2.5, 160)[0].x;
    expect(later).toBeGreaterThan(early);
  });
});
