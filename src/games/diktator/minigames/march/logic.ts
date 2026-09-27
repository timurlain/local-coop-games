// Pochod na Tiranu — the march simulation (spec 2026-09-27-diktator-pochod-design §6). Pure and seeded: no DOM,
// canvas, audio or Math.random; the same map, seed and inputs always give the same state. Call `stepMarch` with the
// fixed step `MARCH.step` (the game object accumulates real time).

import { makeRng } from '../../../../shared/rng';
import { HEROES, type Hero } from '../../logic/palace';
import { stepBenefits } from './benefits';
import { createGateGuards, stepFoes, strike } from './foes';
import { tileCentre, type MarchMap } from './map';
import { applyRope, walk } from './move';
import { createPlaces, stepPlaces } from './places';
import { MARCH } from './rules';
import {
  dateOf, dist, IDLE_INPUT, MARCH_END,
  type HeroFigure, type MarchEvent, type MarchInput, type MarchResult, type MarchState,
} from './state';

export interface MarchOptions {
  /** DEV only (`?march=short`): start the pair on this tile and the clock at this march time. */
  readonly startAt?: readonly [number, number];
  readonly startT?: number;
}

function hero(x: number, y: number): HeroFigure {
  return { x, y, facing: -1, moving: false, frozenUntil: 0, immuneUntil: 0, actUntil: 0, cooldownUntil: 0 };
}

export function createMarch(map: MarchMap, seed: number, solo: boolean, opts: MarchOptions = {}): MarchState {
  const rng = makeRng(seed);
  const [x, y] = tileCentre(map, opts.startAt ?? map.start);
  const s: MarchState = {
    map, solo, rng, now: 0, t: opts.startT ?? 0,
    heroes: { zogu: hero(x, y), velitel: hero(x - 40, y) },
    places: [], foes: [], nextFoeId: 1, nextSquad: 1, nextSpawnAt: MARCH.spawnEvery,
    gold: MARCH.startGold, villages: 0, towers: 0, barracks: 0, captured: 0, caught: 0, joined: 0,
    caches: map.caches.map(() => false), volunteers: false, messenger: false, horses: false, horsesUntil: -1,
    negotiating: -1, trail: [[Math.round(x), Math.round(y)]], trailNext: MARCH.trailEvery,
    ending: null, arrivedDay: null,
  };
  s.places = createPlaces(map, s.rng);
  createGateGuards(s);
  return s;
}

/** The hero's walking speed: its base speed, times 1.25 while the bey's horses carry the pair (spec §4.5). */
function heroSpeed(s: MarchState, h: Hero): number {
  return MARCH.speed[h] * (s.t < s.horsesUntil ? MARCH.horsesFactor : 1);
}

/**
 * Advances the march by `dt` seconds. `inputs` holds the seated heroes' inputs; in solo play only `active` is
 * steered and the other hero is the solo helper (§6.7). Returns what happened this tick (for sounds and bubbles).
 */
export function stepMarch(
  s: MarchState, dt: number, inputs: Readonly<Partial<Record<Hero, MarchInput>>>, active: Hero = 'zogu',
): MarchEvent[] {
  const events: MarchEvent[] = [];
  s.now += dt;
  if (s.ending) return events;
  const dayBefore = dateOf(s.t);
  s.t += dt;
  const input = (h: Hero): MarchInput => (s.solo && h !== active ? IDLE_INPUT : inputs[h] ?? IDLE_INPUT);
  const zin = input('zogu');
  const vin = input('velitel');

  // 1. The heroes walk (a held Zogu stands still), then the rope pulls them back together.
  const z = s.heroes.zogu;
  const v = s.heroes.velitel;
  const prevZ = { x: z.x, y: z.y };
  const prevV = { x: v.x, y: v.y };
  if (s.now < z.frozenUntil) z.moving = false;
  else walk(s.map, z, zin.moveX, zin.moveY, heroSpeed(s, 'zogu'), dt);
  walk(s.map, v, vin.moveX, vin.moveY, heroSpeed(s, 'velitel'), dt);
  applyRope(s.map, z, v, prevZ, prevV, MARCH.rope);
  for (const h of HEROES) {
    const f = s.heroes[h];
    const p = h === 'zogu' ? prevZ : prevV;
    f.moving = Math.hypot(f.x - p.x, f.y - p.y) > 1e-6;
  }

  // 2. Negotiation, Vlček's blow, the gendarmes, the optional benefits.
  stepPlaces(s, zin, dt, events);
  const helperStrikes = s.solo && active === 'zogu';
  strike(s, vin, helperStrikes ? MARCH.helperCooldown : MARCH.blowCooldown, events);
  stepFoes(s, dt, events);
  stepBenefits(s, dt, events);

  // 3. The trail, the day banner and the end.
  if (s.now >= s.trailNext) {
    s.trail.push([Math.round(z.x), Math.round(z.y)]);
    s.trailNext += MARCH.trailEvery;
  }
  const [gx, gy] = tileCentre(s.map, s.map.goal);
  if (dist(z, { x: gx, y: gy }) <= MARCH.arriveRadius) {
    s.arrivedDay = dateOf(s.t);
    s.ending = { kind: 'arrived', at: s.now };
    events.push({ type: 'arrived', date: s.arrivedDay });
  } else if (s.t >= MARCH_END) {
    s.arrivedDay = null;
    s.ending = { kind: 'timeout', at: s.now };
    events.push({ type: 'timeout' });
  } else if (dateOf(s.t) !== dayBefore) {
    events.push({ type: 'day', date: dateOf(s.t) });
  }
  return events;
}

/** The result once the ending animation (3 s) has played, else null. */
export function marchResult(s: MarchState): MarchResult | null {
  if (!s.ending || s.now - s.ending.at < MARCH.endingSeconds) return null;
  return {
    villages: s.villages,
    towers: s.towers,
    barracks: s.barracks,
    captured: s.captured,
    caught: s.caught,
    gold: s.gold,
    arrivedDay: s.arrivedDay,
    trail: s.trail.map(([x, y]) => [x, y] as const),
    caches: s.caches.filter(Boolean).length,
    volunteers: s.volunteers,
    messenger: s.messenger,
    horses: s.horses,
  };
}
