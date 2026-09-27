// "Najdi střelce" — the scene simulation (spec 2026-09-27-diktator-atentat-design §5). Pure and seeded: the same
// difficulty, place and seed always give the same crowd and gunman. Scene coordinates: 960 × 540, y down.

import { makeRng, type RngState } from '../../../../shared/rng';
import { rngDice, type Dice } from '../../logic/dice';
import { RULES } from '../../logic/rules';
import type { AttemptDifficulty, PlaceId } from '../../logic/state';

export type SpotHat = 'none' | 'fez' | 'cap' | 'plis' | 'borsalino';
export type SpotScarf = 'none' | 'red' | 'blue' | 'green' | 'yellow';

export interface SpotPerson {
  readonly id: number;
  x: number;
  /** Feet on the ground line, 330 (far) … 480 (near). */
  readonly y: number;
  dir: -1 | 1;
  readonly speed: number;
  readonly standing: boolean;
  readonly hat: SpotHat;
  readonly scarf: SpotScarf;
  /** Index into the place's coat palette, 0–4. */
  readonly coat: number;
  readonly glasses: boolean;
  readonly bag: boolean;
  readonly gunman: boolean;
  /** The gunman glances around while this is true. */
  glancing: boolean;
  /** Time (scene seconds) until the next glance toggle. */
  glanceIn: number;
  /** Shows a protest bubble until this time. */
  protestUntil: number;
}

export type ClueKey = 'hat' | 'scarf' | 'glasses' | 'bag';
export type Clue =
  | { readonly key: 'hat'; readonly value: SpotHat }
  | { readonly key: 'scarf'; readonly value: SpotScarf }
  | { readonly key: 'glasses'; readonly value: true }
  | { readonly key: 'bag'; readonly value: true };

export interface SpotInput { readonly moveX: number; readonly moveY: number }

export interface SpotState {
  readonly place: PlaceId;
  readonly difficulty: AttemptDifficulty;
  rng: RngState;
  t: number;
  people: SpotPerson[];
  readonly clues: readonly Clue[];
  zoguX: number;
  zoguTarget: number;
  zoguNextMove: number;
  glass: { x: number; y: number };
  fuse: number;
  wrong: number;
  outcome: 'found' | 'missed' | null;
  /** Scene time the outcome was decided (the ending animation runs 1.5 s). */
  endAt: number;
  /** The person accused last (for the tackle / protest drawing), or -1. */
  lastAccused: number;
}

export const SPOT_W = 960;
export const SPOT_H = 540;
export const GROUND_FAR = 330;
export const GROUND_NEAR = 480;
export const PLATFORM = { left: 390, right: 570 } as const;
const GLASS_SPEED = 320;
const ENDING_SECONDS = 1.5;

const HATS: readonly SpotHat[] = ['none', 'fez', 'cap', 'plis', 'borsalino'];
const SCARVES: readonly SpotScarf[] = ['none', 'red', 'blue', 'green', 'yellow'];

/** Scale of a person at ground line y (far people are smaller). */
export function depthScale(y: number): number {
  return 0.75 + 0.35 * ((y - GROUND_FAR) / (GROUND_NEAR - GROUND_FAR));
}

export function matchesClues(p: SpotPerson, clues: readonly Clue[]): boolean {
  return clues.every((c) => (c.key === 'glasses' ? p.glasses : c.key === 'bag' ? p.bag : p[c.key] === c.value));
}

function pick<T>(d: Dice, xs: readonly T[]): T {
  return xs[d.int(xs.length)];
}

function shuffle<T>(d: Dice, xs: readonly T[]): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = d.int(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Makes `p` fail clue `c` (changes only that attribute). */
function breakClue(d: Dice, p: SpotPerson, c: Clue): SpotPerson {
  switch (c.key) {
    case 'hat': return { ...p, hat: pick(d, HATS.filter((h) => h !== c.value)) };
    case 'scarf': return { ...p, scarf: pick(d, SCARVES.filter((s) => s !== c.value)) };
    case 'glasses': return { ...p, glasses: false };
    case 'bag': return { ...p, bag: false };
  }
}

/** Makes `p` look like clue `c` without matching it: another real hat, another scarf colour, the other accessory. */
function similarTo(d: Dice, p: SpotPerson, c: Clue): SpotPerson {
  switch (c.key) {
    case 'hat': return { ...p, hat: pick(d, HATS.filter((h) => h !== 'none' && h !== c.value)) };
    case 'scarf': return { ...p, scarf: pick(d, SCARVES.filter((x) => x !== 'none' && x !== c.value)) };
    case 'glasses': return { ...p, glasses: false, bag: true };
    case 'bag': return { ...p, bag: false, glasses: true };
  }
}

/**
 * Innocents that look like the tip: with two or more clues, those sharing at least one clue; with a single clue,
 * those with a similar attribute (another real hat / scarf colour, or the other accessory).
 */
export function redHerrings(s: SpotState): SpotPerson[] {
  const innocents = s.people.filter((p) => !p.gunman);
  if (s.clues.length >= 2) return innocents.filter((p) => s.clues.some((c) => matchesClues(p, [c])));
  if (s.clues.length === 0) return [];
  const c = s.clues[0];
  return innocents.filter((p) =>
    c.key === 'hat' ? p.hat !== 'none' && p.hat !== c.value
    : c.key === 'scarf' ? p.scarf !== 'none' && p.scarf !== c.value
    : c.key === 'glasses' ? p.bag
    : p.glasses);
}

/** Makes `p` share clue `c`. */
function shareClue(p: SpotPerson, c: Clue): SpotPerson {
  switch (c.key) {
    case 'hat': return { ...p, hat: c.value };
    case 'scarf': return { ...p, scarf: c.value };
    case 'glasses': return { ...p, glasses: true };
    case 'bag': return { ...p, bag: true };
  }
}

export function createSpot(difficulty: AttemptDifficulty, place: PlaceId, seed: number): SpotState {
  const rng = makeRng(seed);
  const d = rngDice(rng);
  const n = difficulty.crowd;
  const fromLeft = d.int(2) === 0;
  const person = (id: number, gunman: boolean): SpotPerson => {
    const standing = !gunman && d.int(10) < 3;
    return {
      id,
      x: gunman ? (fromLeft ? 70 : SPOT_W - 70) : 60 + d.float() * (SPOT_W - 120),
      y: GROUND_FAR + d.float() * (GROUND_NEAR - GROUND_FAR),
      dir: d.int(2) === 0 ? -1 : 1,
      speed: standing ? 0 : 18 + d.float() * 22,
      standing,
      hat: pick(d, HATS),
      scarf: pick(d, SCARVES),
      coat: d.int(5),
      glasses: d.int(5) === 0,
      bag: d.int(4) === 0,
      gunman,
      glancing: false,
      glanceIn: 2 + d.float() * 2,
      protestUntil: -1,
    };
  };
  let gunman = person(0, true);
  const keys = shuffle(d, ['hat', 'scarf', 'glasses', 'bag'] as const).slice(0, difficulty.clues);
  // The gunman's clue attributes are always "something to see": a real hat, a coloured scarf, glasses, a bag.
  for (const k of keys) {
    if (k === 'hat' && gunman.hat === 'none') gunman = { ...gunman, hat: pick(d, HATS.slice(1)) };
    if (k === 'scarf' && gunman.scarf === 'none') gunman = { ...gunman, scarf: pick(d, SCARVES.slice(1)) };
    if (k === 'glasses') gunman = { ...gunman, glasses: true };
    if (k === 'bag') gunman = { ...gunman, bag: true };
  }
  const clues: Clue[] = keys.map((k): Clue => {
    switch (k) {
      case 'hat': return { key: 'hat', value: gunman.hat };
      case 'scarf': return { key: 'scarf', value: gunman.scarf };
      case 'glasses': return { key: 'glasses', value: true };
      case 'bag': return { key: 'bag', value: true };
    }
  });
  let innocents = Array.from({ length: n - 1 }, (_, i) => person(i + 1, false));
  // Nobody else may match every clue.
  innocents = innocents.map((p) => (clues.length > 0 && matchesClues(p, clues) ? breakClue(d, p, pick(d, clues)) : p));
  // Red herrings: at least two innocents look like the tip without matching it all. With two or more clues they share
  // one clue each; with a single clue they wear something similar (another hat, another scarf colour, or the other
  // accessory), because sharing the only clue would make them match it.
  if (clues.length > 0) {
    for (let i = 0; i < 2 && i < innocents.length; i++) {
      const c = clues[i % clues.length];
      innocents[i] = clues.length >= 2 ? shareClue(innocents[i], c) : similarTo(d, innocents[i], c);
      if (matchesClues(innocents[i], clues)) innocents[i] = breakClue(d, innocents[i], clues.find((o) => o.key !== c.key) ?? c);
    }
  }
  // Mix the gunman into the crowd at a random index (ids stay unique).
  const people = [...innocents];
  people.splice(d.int(people.length + 1), 0, gunman);
  const zoguX = (PLATFORM.left + PLATFORM.right) / 2;
  return {
    place, difficulty, rng, t: 0, people, clues,
    zoguX, zoguTarget: zoguX, zoguNextMove: 3,
    glass: { x: SPOT_W / 2, y: 200 },
    fuse: difficulty.seconds, wrong: 0, outcome: null, endAt: 0, lastAccused: -1,
  };
}

/** The person under the glass: the nearest one whose body box (depth-scaled) contains it. */
export function personUnderGlass(s: SpotState): SpotPerson | null {
  let best: SpotPerson | null = null;
  let bestD = Infinity;
  for (const p of s.people) {
    const k = depthScale(p.y);
    const inside = Math.abs(s.glass.x - p.x) <= 20 * k && s.glass.y <= p.y && s.glass.y >= p.y - 110 * k;
    if (!inside) continue;
    const dist = Math.abs(s.glass.x - p.x) + Math.abs(s.glass.y - (p.y - 55 * k));
    if (dist < bestD) { bestD = dist; best = p; }
  }
  return best;
}

export function accuse(s: SpotState): void {
  if (s.outcome) return;
  const p = personUnderGlass(s);
  if (!p) return;
  s.lastAccused = p.id;
  if (p.gunman) {
    s.outcome = 'found';
    s.endAt = s.t;
    return;
  }
  s.wrong += 1;
  s.fuse = Math.max(0, s.fuse - RULES.attempt.wrongPenalty);
  p.protestUntil = s.t + 2;
  if (s.wrong >= s.difficulty.maxWrong) {
    s.outcome = 'missed';
    s.endAt = s.t;
  }
}

export function stepSpot(s: SpotState, dt: number, input: SpotInput): void {
  s.t += dt;
  if (s.outcome) return;
  const d = rngDice(s.rng);
  s.fuse -= dt;
  if (s.fuse <= 0) {
    s.fuse = 0;
    s.outcome = 'missed';
    s.endAt = s.t;
    return;
  }
  s.glass.x = Math.max(0, Math.min(SPOT_W, s.glass.x + input.moveX * GLASS_SPEED * dt));
  s.glass.y = Math.max(60, Math.min(SPOT_H, s.glass.y + input.moveY * GLASS_SPEED * dt));
  // Zogu walks along his platform between greetings.
  s.zoguNextMove -= dt;
  if (s.zoguNextMove <= 0) {
    s.zoguTarget = PLATFORM.left + 20 + d.float() * (PLATFORM.right - PLATFORM.left - 40);
    s.zoguNextMove = 3 + d.float() * 3;
  }
  s.zoguX += Math.sign(s.zoguTarget - s.zoguX) * Math.min(Math.abs(s.zoguTarget - s.zoguX), 30 * dt);
  for (const p of s.people) {
    if (p.gunman) {
      // He works his way to Zogu, arriving about when the fuse ends.
      const gap = s.zoguX - p.x;
      const speed = Math.max(12, Math.abs(gap) / Math.max(1, s.fuse));
      if (Math.abs(gap) > 30) {
        p.dir = gap > 0 ? 1 : -1;
        p.x += p.dir * Math.min(Math.abs(gap) - 30, speed * dt);
      }
      p.glanceIn -= dt;
      if (p.glanceIn <= 0) {
        p.glancing = !p.glancing;
        p.glanceIn = p.glancing ? 0.8 : 2 + d.float() * 2;
      }
    } else if (!p.standing) {
      p.x += p.dir * p.speed * dt;
      if (p.x < 40) { p.x = 40; p.dir = 1; }
      if (p.x > SPOT_W - 40) { p.x = SPOT_W - 40; p.dir = -1; }
    }
  }
}

/** The scene's result once the ending animation (1.5 s) has played, else null. */
export function spotResult(s: SpotState): 'found' | 'missed' | null {
  return s.outcome && s.t - s.endAt >= ENDING_SECONDS ? s.outcome : null;
}
