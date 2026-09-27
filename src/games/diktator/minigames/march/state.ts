// Pochod na Tiranu — the simulation's state, inputs, events and result (spec 2026-09-27-diktator-pochod-design §6).
// Types plus a few pure helpers every march module shares.

import type { RngState } from '../../../../shared/rng';
import type { Hero } from '../../logic/palace';
import { ARENA_H, ARENA_W } from '../arena';
import { mapHeight, mapWidth, type MarchMap, type MarchPlaceDef } from './map';
import { MARCH } from './rules';

/** One hero's input for one tick. */
export interface MarchInput {
  readonly moveX: number;
  readonly moveY: number;
  /** Action went down this tick: Vlček strikes, Zogu waves (outside a place). */
  readonly action: boolean;
  /** Action is held this tick: Zogu negotiates. */
  readonly held: boolean;
}

export const IDLE_INPUT: MarchInput = { moveX: 0, moveY: 0, action: false, held: false };

export interface Point {
  x: number;
  y: number;
}

/** Anything that walks on the map; (x, y) are the feet. */
export interface Figure extends Point {
  /** The direction of the last horizontal movement: 1 = east (right), -1 = west. */
  facing: 1 | -1;
  /** Moved this tick (the render plays the walk pose). */
  moving: boolean;
}

export interface HeroFigure extends Figure {
  /** Zogu is held (after a catch) until this `now`. */
  frozenUntil: number;
  /** Zogu cannot be caught until this `now`. */
  immuneUntil: number;
  /** Vlček: the blow animation runs until this `now`; Zogu: he waves until this `now`. */
  actUntil: number;
  /** Vlček: the next blow may start at this `now`. */
  cooldownUntil: number;
}

export interface PlaceState extends Point {
  readonly def: MarchPlaceDef;
  /** Seconds of negotiation needed (villages: seeded 4–6). */
  readonly ring: number;
  /** A tower's bribe in gold (0 elsewhere). */
  readonly bribe: number;
  /** Seconds negotiated so far; kept when Zogu walks away or is caught. */
  progress: number;
  won: boolean;
  /** The messenger only: the index of his next road point and the walking direction. */
  wp: number;
  dir: 1 | -1;
}

export type FoeMode = 'wait' | 'patrol' | 'chase' | 'return' | 'post' | 'stunned' | 'down' | 'surrender' | 'leaving';

export interface Foe extends Figure {
  readonly id: number;
  /** A patrol gendarme of Noli's, or a barracks gate guard (the army). */
  readonly kind: 'gendarme' | 'guard';
  mode: FoeMode;
  /** When a timed mode ends (wait, stunned, down, surrender, leaving) or, in `return`, until when he is blind. */
  until: number;
  /** Blows taken: 1 = stunned, 2 = knocked out. */
  hits: number;
  /** Gendarmes: the route (index into `map.patrols`), the next waypoint, the direction and the patrol they came in. */
  readonly route: number;
  wp: number;
  dir: 1 | -1;
  readonly squad: number;
  /** Seconds the chase or the return has been blocked by terrain. */
  stuck: number;
  /** Gate guards: their barracks (index into `places`) and their post. -1 / the spawn point for gendarmes. */
  readonly place: number;
  readonly homeX: number;
  readonly homeY: number;
}

export type MarchEvent =
  | { readonly type: 'day'; readonly date: number }
  | { readonly type: 'tick' }
  | { readonly type: 'won'; readonly place: number }
  | { readonly type: 'refused'; readonly place: number; readonly reason: 'noGold' | 'locked' }
  /** Gold gained (> 0: a barracks chest, Burgajet, a cache) or paid (< 0: a bribe, the ransom). */
  | { readonly type: 'coins'; readonly amount: number }
  | { readonly type: 'swing' }
  | { readonly type: 'hit'; readonly down: boolean }
  | { readonly type: 'surrendered'; readonly kind: 'gendarme' | 'guard' }
  | { readonly type: 'spawned'; readonly squad: number; readonly size: number }
  | { readonly type: 'caught' }
  | { readonly type: 'cache'; readonly index: number }
  | { readonly type: 'arrived'; readonly date: number }
  | { readonly type: 'timeout' };

export interface MarchState {
  readonly map: MarchMap;
  readonly solo: boolean;
  rng: RngState;
  /** Simulated seconds since the start: monotonic, drives every timer and animation. */
  now: number;
  /** The march clock: `now` plus the days lost to catches. The date is 13 + ⌊t / 22⌋. */
  t: number;
  heroes: Record<Hero, HeroFigure>;
  places: PlaceState[];
  foes: Foe[];
  nextFoeId: number;
  nextSquad: number;
  /** The next spawn try, `now` seconds. */
  nextSpawnAt: number;
  gold: number;
  villages: number;
  towers: number;
  barracks: number;
  /** Noli's gendarmes who surrendered. */
  captured: number;
  /** Times Zogu was caught. */
  caught: number;
  /** Gate guards who joined the column (followers). */
  joined: number;
  /** Optional benefits (spec §4.5): caches taken (by index), the volunteers, the horses and the messenger. */
  caches: boolean[];
  volunteers: boolean;
  messenger: boolean;
  horses: boolean;
  /** The horses carry the pair while `t` is below this (march clock). */
  horsesUntil: number;
  /** The place Zogu negotiates at this tick (doubles the gendarmes' sight), or -1. */
  negotiating: number;
  /** Zogu's path, sampled every `MARCH.trailEvery` s. */
  trail: [number, number][];
  trailNext: number;
  ending: { readonly kind: 'arrived' | 'timeout'; readonly at: number } | null;
  arrivedDay: number | null;
}

export interface MarchResult {
  /** 0..4 (Burgajet counts). */
  readonly villages: number;
  readonly towers: number;
  readonly barracks: number;
  /** Gendarmes who surrendered. */
  readonly captured: number;
  /** Times Zogu was caught (for the card only). */
  readonly caught: number;
  /** Gold left, ≥ 0. */
  readonly gold: number;
  /** 13..24, or null = after Christmas (timeout). */
  readonly arrivedDay: number | null;
  /** Zogu's path, sampled every 0.5 s (the result card). */
  readonly trail: readonly (readonly [number, number])[];
  /** Optional benefits (spec §4.5). */
  readonly caches: number;
  readonly volunteers: boolean;
  readonly messenger: boolean;
  readonly horses: boolean;
}

/** The December date of a march-clock time: 13 at t = 0, 24 on the last day (clamped). */
export function dateOf(t: number): number {
  return MARCH.firstDate + Math.max(0, Math.min(MARCH.days - 1, Math.floor(t / MARCH.day)));
}

/** The march is over at the end of Christmas Eve. */
export const MARCH_END = MARCH.day * MARCH.days;

export function dist(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** The camera centre: the pair's midpoint, clamped so the 960 × 540 view stays on the map. */
export function cameraOf(s: MarchState): Point {
  const z = s.heroes.zogu;
  const v = s.heroes.velitel;
  const clamp = (v0: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v0));
  return {
    x: clamp((z.x + v.x) / 2, ARENA_W / 2, mapWidth(s.map) - ARENA_W / 2),
    y: clamp((z.y + v.y) / 2, ARENA_H / 2, mapHeight(s.map) - ARENA_H / 2),
  };
}
