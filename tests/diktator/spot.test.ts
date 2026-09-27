import { describe, expect, it } from 'vitest';
import { accuse, createSpot, matchesClues, redHerrings, spotResult, stepSpot, type SpotInput } from '../../src/games/diktator/minigames/spot/logic';
import type { AttemptDifficulty } from '../../src/games/diktator/logic/state';

const IDLE: SpotInput = { moveX: 0, moveY: 0 };
const diff = (clues: number, crowd = 14, seconds = 40): AttemptDifficulty => ({ seconds, clues, crowd, maxWrong: 3 });

describe('the crowd generator', () => {
  it('always makes exactly one person match every clue — the gunman — and plants red herrings', () => {
    for (let seed = 1; seed <= 300; seed++) {
      for (const clues of [1, 2, 3]) {
        const s = createSpot(diff(clues), 'trziste', seed);
        expect(s.people).toHaveLength(14);
        expect(s.clues).toHaveLength(clues);
        const matching = s.people.filter((p) => matchesClues(p, s.clues));
        expect(matching).toHaveLength(1);
        expect(matching[0].gunman).toBe(true);
        expect(redHerrings(s).length).toBeGreaterThanOrEqual(2);
      }
    }
  });

  it('gives no clue when the police know nothing', () => {
    const s = createSpot(diff(0), 'dustojnici', 7);
    expect(s.clues).toEqual([]);
    expect(s.people.filter((p) => p.gunman)).toHaveLength(1);
  });

  it('is deterministic from the seed', () => {
    expect(createSpot(diff(2), 'trziste', 42)).toEqual(createSpot(diff(2), 'trziste', 42));
  });
});

describe('the scene', () => {
  it('brings the gunman closer to Zogu as the fuse burns', () => {
    const s = createSpot(diff(1, 14, 40), 'trziste', 5);
    const gun = () => s.people.find((p) => p.gunman)!;
    const d0 = Math.abs(gun().x - s.zoguX);
    for (let i = 0; i < 20 * 60; i++) stepSpot(s, 1 / 60, IDLE);
    expect(Math.abs(gun().x - s.zoguX)).toBeLessThan(d0);
  });

  it('moves the glass with the input and keeps it on screen', () => {
    const s = createSpot(diff(1), 'trziste', 3);
    const x0 = s.glass.x;
    stepSpot(s, 0.5, { moveX: 1, moveY: 0 });
    expect(s.glass.x).toBeGreaterThan(x0);
    for (let i = 0; i < 100; i++) stepSpot(s, 0.5, { moveX: 1, moveY: 1 });
    expect(s.glass.x).toBeLessThanOrEqual(960);
    expect(s.glass.y).toBeLessThanOrEqual(540);
  });

  it('ends missed when the fuse burns out, with the result 1.5 s later', () => {
    const s = createSpot(diff(1, 10, 25), 'trziste', 9);
    for (let i = 0; i < 25 * 60 + 1; i++) stepSpot(s, 1 / 60, IDLE);
    expect(s.outcome).toBe('missed');
    expect(spotResult(s)).toBeNull();
    for (let i = 0; i < 100; i++) stepSpot(s, 1 / 60, IDLE);
    expect(spotResult(s)).toBe('missed');
  });

  it('finds the gunman when accused under the glass', () => {
    const s = createSpot(diff(1), 'trziste', 11);
    const g = s.people.find((p) => p.gunman)!;
    s.glass = { x: g.x, y: g.y - 40 };
    accuse(s);
    expect(s.outcome).toBe('found');
  });

  it('costs 6 s per wrong accusation and gives up after three', () => {
    const s = createSpot(diff(1, 14, 40), 'trziste', 13);
    const innocents = s.people.filter((p) => !p.gunman);
    for (let i = 0; i < 3; i++) {
      const p = innocents[i];
      s.glass = { x: p.x, y: p.y - 40 };
      const before = s.fuse;
      accuse(s);
      if (i < 2) expect(s.fuse).toBeCloseTo(before - 6);
    }
    expect(s.wrong).toBe(3);
    expect(s.outcome).toBe('missed');
  });

  it('does nothing when nobody is under the glass', () => {
    const s = createSpot(diff(1), 'trziste', 17);
    s.glass = { x: 480, y: 70 };
    accuse(s);
    expect(s.wrong).toBe(0);
    expect(s.outcome).toBeNull();
  });
});
