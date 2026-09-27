import { describe, expect, it } from 'vitest';
import { accuse, carryOf, createSpot, matchesClues, redHerrings, spotResult, stepSpot, type SpotInput } from '../../src/games/diktator/minigames/spot/logic';
import type { AttemptDifficulty } from '../../src/games/diktator/logic/state';
import type { PlaceId } from '../../src/games/diktator/logic/state';

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

describe('hidden weapons and things people carry (§5a)', () => {
  const places: readonly PlaceId[] = ['trziste', 'dustojnici'];

  it('hides the attacker behind an everyday carry and never distinguishes him at a distance', () => {
    for (const place of places) {
      for (let seed = 1; seed <= 300; seed++) {
        const s = createSpot(diff(2), place, seed);
        const gun = s.people.find((p) => p.gunman)!;
        const innocents = s.people.filter((p) => !p.gunman);

        expect(gun.carry).toBe(carryOf(s.weapon));
        expect(gun.handInCoat).toBe(s.weapon === 'coatRevolver');
        if (place === 'dustojnici') {
          expect(s.weapon).not.toBe('appleGrenade');
          expect(s.weapon).not.toBe('bouquetBomb');
        }
        if (gun.carry !== 'none') {
          // Fix wave item 5: they must *visibly* carry it — a hand kept in the coat would hide it again.
          expect(innocents.filter((p) => p.carry === gun.carry && !p.handInCoat).length).toBeGreaterThanOrEqual(2);
        }
        expect(innocents.some((p) => p.handInCoat)).toBe(true);

        const matching = s.people.filter((p) => matchesClues(p, s.clues));
        expect(matching).toHaveLength(1);
        expect(matching[0].gunman).toBe(true);
      }
    }
  });

  it('dresses the mess crowd like officers: only a cap or bare head, only newspapers (fix wave item 9)', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const s = createSpot(diff(2), 'dustojnici', seed);
      for (const p of s.people) {
        expect(['cap', 'none']).toContain(p.hat);
        expect(['none', 'newspaper']).toContain(p.carry);
      }
    }
  });

  it('lets some innocent glance around over a minute, so a glance alone proves nothing', () => {
    const s = createSpot(diff(1, 14, 60), 'trziste', 21);
    const innocentIds = new Set(s.people.filter((p) => !p.gunman).map((p) => p.id));
    let sawInnocentGlance = false;
    for (let i = 0; i < 60 * 60; i++) {
      stepSpot(s, 1 / 60, { moveX: 0, moveY: 0 });
      if (s.people.some((p) => innocentIds.has(p.id) && p.glancing)) sawInnocentGlance = true;
    }
    expect(sawInnocentGlance).toBe(true);
  });

  it('is deterministic from the seed, weapon and carries included', () => {
    expect(createSpot(diff(2), 'trziste', 42)).toEqual(createSpot(diff(2), 'trziste', 42));
    expect(createSpot(diff(2), 'dustojnici', 8)).toEqual(createSpot(diff(2), 'dustojnici', 8));
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

  it('gives the gunman an ordinary walker speed and lets him turn like anyone else (fix wave item 3)', () => {
    let turnedSeeds = 0;
    const SEEDS = 200;
    for (let seed = 1; seed <= SEEDS; seed++) {
      const s = createSpot(diff(1, 14, 40), 'trziste', seed);
      const gun = s.people.find((p) => p.gunman)!;
      expect(gun.speed).toBeGreaterThanOrEqual(18);
      expect(gun.speed).toBeLessThanOrEqual(40);
      expect(Math.abs(gun.x - s.zoguX)).toBeGreaterThanOrEqual(250 - 1e-6);
      let sawTurn = false;
      let dir = gun.dir;
      for (let i = 0; i < 60; i++) {
        stepSpot(s, 1, IDLE);
        const now = s.people.find((p) => p.gunman)!;
        if (now.dir !== dir) { sawTurn = true; dir = now.dir; }
        expect(now.x).toBeGreaterThanOrEqual(40);
        expect(now.x).toBeLessThanOrEqual(920);
      }
      if (sawTurn) turnedSeeds++;
    }
    expect(turnedSeeds).toBeGreaterThanOrEqual(SEEDS * 0.5);
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
