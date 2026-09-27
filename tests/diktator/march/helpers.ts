// Shared helpers for the march tests (plan 2026-09-27-diktator-pochod).

import type { Hero } from '../../../src/games/diktator/logic/palace';
import { stepMarch } from '../../../src/games/diktator/minigames/march/logic';
import type { MarchMap, MarchPlaceDef, TilePos } from '../../../src/games/diktator/minigames/march/map';
import { MARCH } from '../../../src/games/diktator/minigames/march/rules';
import type { MarchEvent, MarchInput, MarchState } from '../../../src/games/diktator/minigames/march/state';

export const IDLE: MarchInput = { moveX: 0, moveY: 0, action: false, held: false };
export const go = (moveX: number, moveY: number): MarchInput => ({ moveX, moveY, action: false, held: false });
export const HOLD: MarchInput = { moveX: 0, moveY: 0, action: false, held: true };
export const PRESS: MarchInput = { moveX: 0, moveY: 0, action: true, held: true };

/** Steps the march for `seconds` at the fixed step; returns every event. */
export function run(
  s: MarchState, seconds: number, inputs: Partial<Record<Hero, MarchInput>> = {}, active: Hero = 'zogu',
): MarchEvent[] {
  const out: MarchEvent[] = [];
  const n = Math.round(seconds / MARCH.step);
  for (let i = 0; i < n; i++) out.push(...stepMarch(s, MARCH.step, inputs, active));
  return out;
}

/** A small hand-made map for movement and rope tests: no patrols, no caches. */
export function testMap(terrain: readonly string[], places: readonly MarchPlaceDef[] = []): MarchMap {
  const goal: TilePos = [terrain[0].length - 1, terrain.length - 2];
  return {
    cols: terrain[0].length, rows: terrain.length, tile: 60, terrain, start: [1, 0], goal, places,
    roads: [], patrols: [], caches: [], messengerRoad: [[0, 0], [1, 0]],
  };
}

/** 20 × 12: a road, meadow, forest, snow, ford, a rock wall at (5–9, 6), a river along the bottom. */
export const PLAYGROUND = testMap([
  '====================',
  '....................',
  'ffffffffffffffffffff',
  'ssssssssssssssssssss',
  'oooooooooooooooooooo',
  '....................',
  '.....mmmmm..........',
  '....................',
  '....................',
  '....................',
  '....................',
  '~~~~~~~~~~~~~~~~~~~~',
]);

export function place(s: MarchState, hero: Hero, x: number, y: number): void {
  s.heroes[hero].x = x;
  s.heroes[hero].y = y;
}

/** A deterministic pseudo-random input stream (for property and determinism tests). */
export function noise(seed: number): () => MarchInput {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), a | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  let hold: MarchInput = { moveX: 0, moveY: 0, action: false, held: false };
  let left = 0;
  return () => {
    if (left-- <= 0) {
      left = 10 + Math.floor(next() * 50);
      hold = { moveX: Math.round(next() * 2 - 1), moveY: Math.round(next() * 2 - 1), action: false, held: next() < 0.3 };
    }
    return { ...hold, action: next() < 0.05 };
  };
}
