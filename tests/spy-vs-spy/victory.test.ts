import { describe, expect, it } from 'vitest';
import {
  BOARD_AT, DOOR_DX, GROUND_Y, LAUGH_AT, LAUGH_END, MOB_CLEARANCE, PLANE_X, TAXI_AT, VICTORY_DURATION,
  mobPositions, planePose, winnerPose,
} from '../../src/games/spy-vs-spy/render/victory';

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

  it('stays on screen when the loser stands near a side wall', () => {
    for (const m of mobPositions(20, 20)) {
      expect(m.x).toBeGreaterThan(0);
      expect(m.x).toBeLessThan(320);
    }
  });

  it('keeps MOB_CLEARANCE from the loser even at the left screen edge, by sending overflow to the other side', () => {
    const loserX = 20;
    const mob = mobPositions(20, loserX);
    expect(mob).toHaveLength(8);
    const xs = mob.map((m) => m.x);
    for (const m of mob) {
      expect(Math.abs(m.x - loserX)).toBeGreaterThanOrEqual(MOB_CLEARANCE);
      expect(m.x).toBeGreaterThan(0);
      expect(m.x).toBeLessThan(320);
      expect(m.facing).toBe(m.x < loserX ? 1 : -1);
    }
    expect(new Set(xs).size).toBe(xs.length); // no two members at the same x
  });

  it('keeps MOB_CLEARANCE from the loser even at the right screen edge, by sending overflow to the other side', () => {
    const loserX = 300;
    const mob = mobPositions(20, loserX);
    expect(mob).toHaveLength(8);
    const xs = mob.map((m) => m.x);
    for (const m of mob) {
      expect(Math.abs(m.x - loserX)).toBeGreaterThanOrEqual(MOB_CLEARANCE);
      expect(m.x).toBeGreaterThan(0);
      expect(m.x).toBeLessThan(320);
      expect(m.facing).toBe(m.x < loserX ? 1 : -1);
    }
    expect(new Set(xs).size).toBe(xs.length); // no two members at the same x
  });
});

describe('airfield take-off', () => {
  it('winner walks in, laughs, then walks to the cabin door and boards', () => {
    expect(winnerPose(0).visible).toBe(true);
    expect(winnerPose(LAUGH_AT + 0.1).laughing).toBe(true);
    expect(winnerPose(LAUGH_END + 0.1).laughing).toBe(false);
    expect(winnerPose(LAUGH_END + 0.3).x).toBeGreaterThan(winnerPose(LAUGH_END).x);
    expect(winnerPose(BOARD_AT - 0.001).x).toBeCloseTo(PLANE_X + DOOR_DX, 0);
    expect(winnerPose(BOARD_AT + 0.01).visible).toBe(false);
  });

  it('the plane waits for the winner, then taxis on the ground', () => {
    expect(TAXI_AT).toBeGreaterThan(BOARD_AT);
    for (const t of [0, 1, BOARD_AT, TAXI_AT]) expect(planePose(t)).toEqual({ x: PLANE_X, lift: 0, pitch: 0 });
    const a = planePose(TAXI_AT + 0.5);
    const b = planePose(TAXI_AT + 1);
    expect(a.x).toBeGreaterThan(PLANE_X);
    expect(b.x).toBeGreaterThan(a.x);
    expect(a.lift).toBe(0);
  });

  it('takes off nose-up and leaves the half before the scene ends', () => {
    const late = planePose(VICTORY_DURATION - 0.8);
    expect(late.lift).toBeGreaterThan(10);
    expect(late.pitch).toBeGreaterThan(0);
    const end = planePose(VICTORY_DURATION);
    // tail (74 px behind the centre) past the right edge, or the whole plane above the top
    expect(end.x - 74 > 320 || GROUND_Y - end.lift + 60 < 0).toBe(true);
    let prev = 0;
    for (let t = TAXI_AT; t <= VICTORY_DURATION; t += 0.1) {
      const lift = planePose(t).lift;
      expect(lift).toBeGreaterThanOrEqual(prev);
      prev = lift;
    }
  });
});
