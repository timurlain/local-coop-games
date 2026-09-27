// "Najdi střelce" — the scene simulation (spec 2026-09-27-diktator-atentat-design §5). Pure and seeded: the same
// difficulty, place and seed always give the same crowd and gunman. Scene coordinates: 960 × 540, y down.

import { makeRng, type RngState } from '../../../../shared/rng';
import { rngDice, type Dice } from '../../logic/dice';
import { RULES } from '../../logic/rules';
import type { AttemptDifficulty, PlaceId } from '../../logic/state';

export type SpotHat = 'none' | 'fez' | 'cap' | 'plis' | 'borsalino';
export type SpotScarf = 'none' | 'red' | 'blue' | 'green' | 'yellow';
export type SpotCarry = 'none' | 'newspaper' | 'basket' | 'bouquet';
export type SpotWeapon = 'newspaperPistol' | 'appleGrenade' | 'bouquetBomb' | 'coatRevolver';

/** What the weapon looks like from a distance: the everyday thing it hides inside. */
export function carryOf(w: SpotWeapon): SpotCarry {
  switch (w) {
    case 'newspaperPistol': return 'newspaper';
    case 'appleGrenade': return 'basket';
    case 'bouquetBomb': return 'bouquet';
    case 'coatRevolver': return 'none';
  }
}

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
  /** The everyday thing this person carries — the gunman's hides his weapon. */
  readonly carry: SpotCarry;
  /** A hand kept in the coat — a cold day, or the gunman's grip on a `coatRevolver`. */
  readonly handInCoat: boolean;
  /** Non-null only for the gunman: which weapon he hides and how. */
  readonly weapon: SpotWeapon | null;
  /** Glances around while this is true — the gunman often, some innocents rarely. */
  glancing: boolean;
  /** Time (scene seconds) until the next glance toggle. */
  glanceIn: number;
  /** Shows a protest bubble until this time. */
  protestUntil: number;
  /** Gunman only (fix wave item 3): seconds until his next loiter decision (which way, or a pause). */
  wanderIn: number;
  /** Gunman only, while loitering: standing still between decisions, like an innocent sometimes does. */
  resting: boolean;
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
  readonly weapon: SpotWeapon;
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
/** How far from the platform centre the gunman spawns, at least (fix wave item 3): a distance alone must not give
 * him away. */
const MIN_GUNMAN_DIST = 250;

const HATS: readonly SpotHat[] = ['none', 'fez', 'cap', 'plis', 'borsalino'];
/** The mess's crowd is uniform-like (fix wave item 9): only a cap or a bare head, cap-heavy. */
const MESS_HATS: readonly SpotHat[] = ['cap', 'cap', 'cap', 'none'];
const SCARVES: readonly SpotScarf[] = ['none', 'red', 'blue', 'green', 'yellow'];

/** The hat pool this place's crowd (and its gunman/clues) is drawn from. */
function hatsFor(place: PlaceId): readonly SpotHat[] {
  return place === 'dustojnici' ? MESS_HATS : HATS;
}

/** A hat from `hats` other than any in `exclude`, falling back to `hats[0]` if that would leave nothing to pick. */
function pickHatOtherThan(d: Dice, hats: readonly SpotHat[], exclude: readonly SpotHat[]): SpotHat {
  const opts = hats.filter((h) => !exclude.includes(h));
  return opts.length > 0 ? pick(d, opts) : hats[0];
}

const MARKET_CARRIES: readonly SpotCarry[] = ['newspaper', 'basket', 'bouquet'];
/** Innocents at the mess carry only newspapers (fix wave item 9): no market baskets or bouquets among officers. */
const MESS_CARRIES: readonly SpotCarry[] = ['newspaper'];

function carriesFor(place: PlaceId): readonly SpotCarry[] {
  return place === 'dustojnici' ? MESS_CARRIES : MARKET_CARRIES;
}

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
function breakClue(d: Dice, p: SpotPerson, c: Clue, hats: readonly SpotHat[]): SpotPerson {
  switch (c.key) {
    case 'hat': return { ...p, hat: pickHatOtherThan(d, hats, [c.value]) };
    case 'scarf': return { ...p, scarf: pick(d, SCARVES.filter((s) => s !== c.value)) };
    case 'glasses': return { ...p, glasses: false };
    case 'bag': return { ...p, bag: false };
  }
}

/** Makes `p` look like clue `c` without matching it: another real hat, another scarf colour, the other accessory. */
function similarTo(d: Dice, p: SpotPerson, c: Clue, hats: readonly SpotHat[]): SpotPerson {
  switch (c.key) {
    case 'hat': return { ...p, hat: pickHatOtherThan(d, hats, ['none', c.value]) };
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
  const hats = hatsFor(place);
  const carries = carriesFor(place);
  const centreX = (PLATFORM.left + PLATFORM.right) / 2;
  // The gunman spawns at a random x like anyone else, just kept at least MIN_GUNMAN_DIST from the platform centre —
  // a distance alone must not give him away (fix wave item 3, replacing the old fixed edge spawn).
  const leftZoneEnd = centreX - MIN_GUNMAN_DIST;
  const rightZoneStart = centreX + MIN_GUNMAN_DIST;
  const gunmanX = (): number =>
    fromLeft ? 60 + d.float() * Math.max(0, leftZoneEnd - 60) : rightZoneStart + d.float() * Math.max(0, SPOT_W - 60 - rightZoneStart);
  const person = (id: number, gunman: boolean): SpotPerson => {
    const standing = !gunman && d.int(10) < 3;
    return {
      id,
      x: gunman ? gunmanX() : 60 + d.float() * (SPOT_W - 120),
      y: GROUND_FAR + d.float() * (GROUND_NEAR - GROUND_FAR),
      dir: d.int(2) === 0 ? -1 : 1,
      // The same walker-speed distribution as everyone else (18–40) — nothing sets him apart on the move either.
      speed: standing ? 0 : 18 + d.float() * 22,
      standing,
      hat: pick(d, hats),
      scarf: pick(d, SCARVES),
      coat: d.int(5),
      glasses: d.int(5) === 0,
      bag: d.int(4) === 0,
      gunman,
      carry: 'none',
      handInCoat: false,
      weapon: null,
      glancing: false,
      glanceIn: gunman ? 2 + d.float() * 2 : 5 + d.float() * 4,
      protestUntil: -1,
      wanderIn: gunman ? 1 + d.float() * 2 : 0,
      resting: false,
    };
  };
  let gunman = person(0, true);
  const keys = shuffle(d, ['hat', 'scarf', 'glasses', 'bag'] as const).slice(0, difficulty.clues);
  // The gunman's clue attributes are always "something to see": a real hat, a coloured scarf, glasses, a bag.
  for (const k of keys) {
    if (k === 'hat' && gunman.hat === 'none') gunman = { ...gunman, hat: pick(d, hats.filter((h) => h !== 'none')) };
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
  innocents = innocents.map((p) => (clues.length > 0 && matchesClues(p, clues) ? breakClue(d, p, pick(d, clues), hats) : p));
  // Red herrings: at least two innocents look like the tip without matching it all. With two or more clues they share
  // one clue each; with a single clue they wear something similar (another hat, another scarf colour, or the other
  // accessory), because sharing the only clue would make them match it.
  if (clues.length > 0) {
    for (let i = 0; i < 2 && i < innocents.length; i++) {
      const c = clues[i % clues.length];
      innocents[i] = clues.length >= 2 ? shareClue(innocents[i], c) : similarTo(d, innocents[i], c, hats);
      if (matchesClues(innocents[i], clues)) innocents[i] = breakClue(d, innocents[i], clues.find((o) => o.key !== c.key) ?? c, hats);
    }
  }
  // The attacker's hidden weapon — one per attempt, drawn from the same dice so it stays deterministic. The mess
  // only stocks a pistol or a revolver; the market has all four.
  const weapons: readonly SpotWeapon[] =
    place === 'dustojnici' ? ['newspaperPistol', 'coatRevolver'] : ['newspaperPistol', 'appleGrenade', 'bouquetBomb', 'coatRevolver'];
  const weapon = pick(d, weapons);
  const carry = carryOf(weapon);
  gunman = { ...gunman, weapon, carry, handInCoat: weapon === 'coatRevolver' };
  // Everyone may carry an everyday thing, or keep a hand in the coat (a cold day) — nothing that touches a clue
  // attribute, so the "exactly one person matches every clue" invariant is untouched.
  innocents = innocents.map((p) => {
    const carriesSomething = d.int(3) === 0;
    const innocentCarry = carriesSomething ? pick(d, carries) : 'none';
    const handInCoat = d.int(8) === 0;
    return { ...p, carry: innocentCarry, handInCoat };
  });
  // Guarantee: when the gunman carries something, at least two innocents *visibly* carry the same kind (a hand kept
  // in the coat would hide the carry again, so those chosen must show it) — nothing distinguishes him at a distance.
  const usedForCarry = new Set<number>();
  if (carry !== 'none') {
    let need = 2;
    for (let i = 0; i < innocents.length && need > 0; i++) {
      if (innocents[i].carry === carry && !innocents[i].handInCoat) { usedForCarry.add(i); need--; }
    }
    for (let i = 0; i < innocents.length && need > 0; i++) {
      if (usedForCarry.has(i)) continue;
      innocents[i] = { ...innocents[i], carry, handInCoat: false };
      usedForCarry.add(i);
      need--;
    }
  }
  // Guarantee: at least one innocent keeps a hand in the coat, so a hidden hand alone proves nothing either — pick
  // one not already spent proving the carry guarantee above, so that one stays visibly carrying.
  if (!innocents.some((p) => p.handInCoat) && innocents.length > 0) {
    const idx = innocents.findIndex((_, i) => !usedForCarry.has(i));
    if (idx !== -1) innocents[idx] = { ...innocents[idx], handInCoat: true };
  }
  // Mix the gunman into the crowd at a random index (ids stay unique).
  const people = [...innocents];
  people.splice(d.int(people.length + 1), 0, gunman);
  const zoguX = (PLATFORM.left + PLATFORM.right) / 2;
  return {
    place, difficulty, weapon, rng, t: 0, people, clues,
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
      // He works his way to Zogu, arriving about when the fuse ends (fix wave item 3): too early, and he loiters
      // like an innocent (walking, turning at the edges, sometimes standing, drifting on average toward Zogu)
      // instead of beelining the whole time — a straight, purposeful walk from far away would give him away.
      const gap = s.zoguX - p.x;
      const arriveIn = Math.abs(gap) / p.speed;
      if (arriveIn < s.fuse - 4) {
        p.wanderIn -= dt;
        if (p.wanderIn <= 0) {
          const towardZogu: -1 | 1 = gap >= 0 ? 1 : -1;
          const roll = d.float();
          p.resting = roll < 0.2;
          if (!p.resting) p.dir = d.float() < 0.7 ? towardZogu : (d.int(2) === 0 ? -1 : 1);
          p.wanderIn = 1 + d.float() * 2;
        }
        if (!p.resting) {
          p.x += p.dir * p.speed * dt;
          if (p.x < 40) { p.x = 40; p.dir = 1; }
          if (p.x > SPOT_W - 40) { p.x = SPOT_W - 40; p.dir = -1; }
        }
      } else if (Math.abs(gap) > 30) {
        p.dir = gap > 0 ? 1 : -1;
        p.x += p.dir * Math.min(Math.abs(gap) - 30, p.speed * dt);
      }
      p.glanceIn -= dt;
      if (p.glanceIn <= 0) {
        p.glancing = !p.glancing;
        p.glanceIn = p.glancing ? 0.8 : 2 + d.float() * 2;
      }
    } else {
      // Some innocents glance around now and then too, so a glance alone proves nothing — much less often than the
      // gunman, and briefer.
      p.glanceIn -= dt;
      if (p.glanceIn <= 0) {
        p.glancing = !p.glancing;
        p.glanceIn = p.glancing ? 0.6 : 5 + d.float() * 4;
      }
      if (!p.standing) {
        p.x += p.dir * p.speed * dt;
        if (p.x < 40) { p.x = 40; p.dir = 1; }
        if (p.x > SPOT_W - 40) { p.x = SPOT_W - 40; p.dir = -1; }
      }
    }
  }
}

/** The scene's result once the ending animation (1.5 s) has played, else null. */
export function spotResult(s: SpotState): 'found' | 'missed' | null {
  return s.outcome && s.t - s.endAt >= ENDING_SECONDS ? s.outcome : null;
}
