import { describe, expect, it } from 'vitest';
import { GROUPS, STRENGTH_GROUPS } from '../../../src/games/diktator/logic/groups';
import { policeFromArrival, regimeFromMarch } from '../../../src/games/diktator/logic/march-regime';
import { RULES } from '../../../src/games/diktator/logic/rules';
import { initialState } from '../../../src/games/diktator/logic/state';
import { newGame } from '../../../src/games/diktator/logic/turn';
import { createMarch, marchResult, stepMarch } from '../../../src/games/diktator/minigames/march/logic';
import { tileCentre, type TilePos } from '../../../src/games/diktator/minigames/march/map';
import { MARCH } from '../../../src/games/diktator/minigames/march/rules';
import type { MarchInput, MarchResult, MarchState } from '../../../src/games/diktator/minigames/march/state';
import { marchCardLines } from '../../../src/games/diktator/minigames/march/text';
import { albania } from '../../../src/games/diktator/scenario/albania';
import { ALBANIA_MARCH } from '../../../src/games/diktator/scenario/albania/march-map';
import { noise } from './helpers';

/** The historical march (spec §8.2): 2 of each place, 8 gendarmes, 200 gold, Christmas Eve, no benefits. */
const HISTORICAL: MarchResult = {
  villages: 2, towers: 2, barracks: 2, captured: 8, caught: 0, gold: 200, arrivedDay: 24, trail: [],
  caches: 0, volunteers: false, messenger: false, horses: false,
};

describe('regimeFromMarch', () => {
  it('reproduces today’s start exactly for the historical march', () => {
    expect(initialState(7, regimeFromMarch(HISTORICAL))).toEqual(initialState(7));
    expect(initialState(7, regimeFromMarch({ ...HISTORICAL, caught: 3, trail: [[1, 2]] }))).toEqual(initialState(7));
  });

  it('follows the police table', () => {
    // 8/8 only by 17 Dec (earlyFrom: 7), 8/7 for 18–20 Dec (onTimeFrom: 4), 7/6 for 21–24 Dec (fix wave, item 8).
    expect([13, 17, 18, 20, 21, 22, 23, 24, null].map(policeFromArrival)).toEqual([
      [8, 8], [8, 8], [8, 7], [8, 7], [7, 6], [7, 6], [7, 6], [7, 6], [5, 4],
    ]);
  });

  it('keeps every value in range for every tally, and no faction starts hostile', () => {
    let popLo = 9, popHi = 0, strLo = 9, strHi = 0, tLo = 1e9, tHi = 0, guardHi = 0;
    for (const villages of [0, 1, 2, 3, 4]) for (const towers of [0, 1, 2, 3, 4]) for (const barracks of [0, 1, 2, 3, 4]) {
      for (let captured = 0; captured <= 30; captured++) for (let gold = 0; gold <= 400; gold += 25) {
        for (const arrivedDay of [13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, null]) {
          const benefits = (villages + captured) % 2 === 0;
          const g = regimeFromMarch({
            villages, towers, barracks, captured, caught: 0, gold, arrivedDay, trail: [],
            caches: 0, volunteers: benefits, messenger: benefits, horses: false,
          });
          for (const v of Object.values(g.pop!)) { popLo = Math.min(popLo, v); popHi = Math.max(popHi, v); }
          for (const v of Object.values(g.str!)) { strLo = Math.min(strLo, v); strHi = Math.max(strHi, v); }
          tLo = Math.min(tLo, g.treasury!);
          tHi = Math.max(tHi, g.treasury!);
          guardHi = Math.max(guardHi, g.guard ?? RULES.start.guard);
        }
      }
    }
    expect([popLo, popHi, strLo, strHi, tLo, tHi, guardHi]).toEqual([5, 8, 4, 8, 200, 400, 5]);
  });

  it('maps each tally as in spec §8.1', () => {
    const g = regimeFromMarch({ ...HISTORICAL, villages: 4, towers: 0, barracks: 3, captured: 13, gold: 170, arrivedDay: 22 });
    expect(g.pop).toEqual({ rolnici: 8, statkari: 5, armada: 8, policie: 7 });
    expect(g.str).toEqual({ statkari: 4, armada: 7, povstalci: 5, policie: 6 });
    expect(g.treasury).toBe(270);
    expect(regimeFromMarch({ ...HISTORICAL, captured: 40 }).str!.povstalci).toBe(4);
    expect(regimeFromMarch({ ...HISTORICAL, gold: 0 }).treasury).toBe(200);
    expect(regimeFromMarch({ ...HISTORICAL, gold: 500 }).treasury).toBe(400);
  });

  it('adds the optional benefits, capped: Itálie 8, the bodyguard 5', () => {
    const g = regimeFromMarch({ ...HISTORICAL, messenger: true, volunteers: true, horses: true, caches: 3, gold: 245 });
    expect(g.pop!.italie).toBe(8);
    expect(g.guard).toBe(5);
    expect(g.treasury).toBe(345);
    const s = initialState(1, g);
    expect([s.pop.italie, s.guard]).toEqual([8, 5]);
    expect(GROUPS.filter((x) => x !== 'italie' && s.pop[x] !== initialState(1).pop[x])).toEqual([]);
    expect(STRENGTH_GROUPS.filter((x) => s.str[x] !== initialState(1).str[x])).toEqual([]);
  });
});

describe('the result card', () => {
  it('lists each tally next to what it gives', () => {
    const lines = marchCardLines({ ...HISTORICAL, villages: 3, captured: 9, gold: 170, arrivedDay: 22 }, albania.groupNames, 3);
    expect(lines).toContain('Vesnice 3/4 → Rolníci: oblíbenost 8');
    expect(lines).toContain('Zajatí četníci 9 → Povstalci: síla 6');
    expect(lines).toContain('Zlato 170 → pokladna 270');
    expect(lines).toContain('Příchod 22. prosince → Tajná policie: oblíbenost 7, síla 6');
    expect(lines).toHaveLength(6);
  });

  it('adds the catches and the benefits when there are any', () => {
    const lines = marchCardLines(
      { ...HISTORICAL, caught: 2, caches: 1, volunteers: true, messenger: true, horses: true, arrivedDay: null },
      albania.groupNames, 3,
    );
    expect(lines).toContain('Příchod po Vánocích → Tajná policie: oblíbenost 5, síla 4');
    expect(lines).toContain('Zogu byl zajat 2× (pokaždé den a 20 zlata)');
    expect(lines).toContain('Skrýše 1/3 (každá +15 zlata)');
    expect(lines).toContain('Dobrovolníci z Martaneshe → tělesná stráž 5');
    expect(lines).toContain('Italský posel → Itálie: oblíbenost 8');
    expect(lines).toContain('Koně z Homeshe → rychlejší pochod');
  });
});

/** Runs a march to its result with per-tick input functions (solo when only Zogu is given). */
function finish(s: MarchState, zogu: () => MarchInput, velitel?: () => MarchInput): MarchResult {
  for (let i = 0; i < 300 * 60 && !marchResult(s); i++) {
    stepMarch(s, MARCH.step, velitel ? { zogu: zogu(), velitel: velitel() } : { zogu: zogu() }, 'zogu');
  }
  return marchResult(s)!;
}

/** Zogu walks the road Dibra → Peshkopi → Burrel → the Mat gorge → Krujë → Tirana, holding Action. */
const ROAD: readonly TilePos[] = [
  [72, 30], [69, 29], [65, 27], [61, 28], [58, 29], [55, 28], [53, 27], [49, 25], [44, 23], [41, 24], [38, 24],
  [38, 28], [36, 31], [31, 32], [25, 29], [22, 26], [20, 23], [17, 26], [16, 30], [13, 33], [10, 35],
];

function roadBot(s: MarchState): () => MarchInput {
  let next = 0;
  return () => {
    const z = s.heroes.zogu;
    let [x, y] = tileCentre(ALBANIA_MARCH, ROAD[next]);
    if (Math.hypot(x - z.x, y - z.y) < 20 && next < ROAD.length - 1) [x, y] = tileCentre(ALBANIA_MARCH, ROAD[++next]);
    const d = Math.max(1, Math.hypot(x - z.x, y - z.y));
    return { moveX: (x - z.x) / d, moveY: (y - z.y) / d, action: false, held: true };
  };
}

describe('bots finish the march', () => {
  it('a random-input pair always ends by Christmas Eve with a valid regime', () => {
    for (let seed = 1; seed <= 50; seed++) {
      const s = createMarch(ALBANIA_MARCH, seed, false);
      const r = finish(s, noise(seed), noise(seed + 1000));
      expect(r).not.toBeNull();
      expect(s.now).toBeLessThanOrEqual(264 + MARCH.endingSeconds + 0.1);
      const g = regimeFromMarch(r);
      expect(() => newGame(albania, seed, g, { palace: true })).not.toThrow();
    }
  }, 30_000);

  it('a solo player walking the road reaches Tirana before Christmas', () => {
    let arrived = 0;
    for (let seed = 1; seed <= 50; seed++) {
      const s = createMarch(ALBANIA_MARCH, seed, true);
      const r = finish(s, roadBot(s));
      if (r.arrivedDay !== null) arrived += 1;
      expect(newGame(albania, seed, regimeFromMarch(r), { palace: true }).state.phase.kind).toBe('audience');
    }
    expect(arrived).toBeGreaterThanOrEqual(45);
  }, 30_000);
});
