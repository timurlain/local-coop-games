// Cartoon trap deaths (round 6 §6): pure timelines. Each function maps the seconds since the death to the phase
// of its gag and that phase's parameters; render/deaths.ts draws them. No DOM, no clock of its own.

import type { DeathCause } from '../logic/state';
import { RULES } from '../logic/rules';

/**
 * When the angel (the ghost with its halo) appears, seconds after the death. The total length of every death stays
 * `RULES.respawnTime`; the gag plays before the angel and the angel rises for the rest.
 */
export const ANGEL_AT: Readonly<Record<DeathCause, number>> = {
  fight: 1.2,
  bomba: 1.5,
  casovana: 1.5,
  pruzina: 1.6,
  pistole: 1.6,
  elektrina: 1.9,
};

/** The angel rises this fast, px per second. */
export const ANGEL_RISE = 25;

/** Past the gag: the angel, `rise` px above the floor. */
export interface AngelPhase {
  readonly phase: 'angel';
  readonly rise: number;
}

export function angel(cause: DeathCause, elapsed: number): AngelPhase | null {
  const at = ANGEL_AT[cause];
  return elapsed >= at ? { phase: 'angel', rise: (Math.min(elapsed, RULES.respawnTime) - at) * ANGEL_RISE } : null;
}

const clamp01 = (k: number): number => Math.max(0, Math.min(1, k));

// ---------- elektrina: the bucket, the X-ray flicker, the smoking heap ----------

/** The bucket drops from above the door onto his head. */
export const BUCKET_FALL = 0.22;
/** He flickers between his figure and the X-ray skeleton this long (the buzz). */
export const SHOCK_TIME = 1.05;
/** Figure / skeleton alternate this often, per second. */
const FLICKER_HZ = 11;
/** The two jittering shock frames alternate this often, per second. */
const JITTER_HZ = 16;
/** The splash's drops fly this long after the bucket lands. */
export const SPLASH_TIME = 0.4;

export type ElectricPhase =
  /** `drop`: how far the bucket still is above his head, 1 (start) → 0 (landed) */
  | { readonly phase: 'fall'; readonly drop: number }
  /** `xray`: the skeleton shows; `jitter` picks the shock frame; `splash` 0 → 1 over SPLASH_TIME (1 = gone); `k` 0 → 1 */
  | { readonly phase: 'shock'; readonly k: number; readonly xray: boolean; readonly jitter: 0 | 1; readonly splash: number }
  /** the smoking heap, `k` 0 → 1 until the angel */
  | { readonly phase: 'heap'; readonly k: number }
  | AngelPhase;

export function electricPhase(elapsed: number): ElectricPhase {
  const a = angel('elektrina', elapsed);
  if (a) return a;
  const t = Math.max(0, elapsed);
  if (t < BUCKET_FALL) {
    const u = t / BUCKET_FALL;
    return { phase: 'fall', drop: 1 - u * u };
  }
  const s = t - BUCKET_FALL;
  if (s < SHOCK_TIME) {
    return {
      phase: 'shock',
      k: s / SHOCK_TIME,
      // a first flash of bones straight away, then the flicker
      xray: Math.floor(s * FLICKER_HZ) % 2 === 0,
      jitter: (Math.floor(s * JITTER_HZ) % 2) as 0 | 1,
      splash: clamp01(s / SPLASH_TIME),
    };
  }
  const heapFrom = BUCKET_FALL + SHOCK_TIME;
  return { phase: 'heap', k: clamp01((t - heapFrom) / (ANGEL_AT.elektrina - heapFrom)) };
}

// ---------- bomba, časovaná: the flash, the sooty face with blinking eyes, the hat crumbling ----------

export const FLASH_TIME = 0.14;
/** The hat starts to crumble ... */
export const CRUMBLE_AT = 0.5;
/** ... and its last piece lands this long after. */
export const CRUMBLE_TIME = 0.55;
/** Blinks: the eyes stay shut this long, every BLINK_EVERY seconds. */
const BLINK_SHUT = 0.1;
const BLINK_EVERY = 0.42;

export type SootPhase =
  | { readonly phase: 'flash'; readonly k: number }
  /** `blink`: the eyes are shut; `crumble` 0 (hat on) → 1 (all pieces down); `smoke` 0 → 1 until the angel */
  | { readonly phase: 'soot'; readonly blink: boolean; readonly crumble: number; readonly smoke: number }
  | AngelPhase;

export function sootPhase(cause: 'bomba' | 'casovana', elapsed: number): SootPhase {
  const a = angel(cause, elapsed);
  if (a) return a;
  const t = Math.max(0, elapsed);
  if (t < FLASH_TIME) return { phase: 'flash', k: t / FLASH_TIME };
  const s = t - FLASH_TIME;
  return {
    phase: 'soot',
    // eyes open at first (the stunned stare), then the blinks
    blink: s > 0.2 && (s - 0.2) % BLINK_EVERY < BLINK_SHUT,
    crumble: clamp01((t - CRUMBLE_AT) / CRUMBLE_TIME),
    smoke: clamp01(t / ANGEL_AT[cause]),
  };
}

/** Hat pieces fall one after another: piece `i` of `n` leaves the head at this share of the crumble. */
export function pieceStart(i: number, n: number): number {
  return n <= 1 ? 0 : (i / (n - 1)) * 0.45;
}

/**
 * Where hat piece `i` of `n` is at crumble progress `crumble`: `fall` 0 (on the head) → 1 (on the floor), accelerating
 * like a dropped thing; `drift` sideways in px (pieces spread a little away from the head); `landed` once down.
 */
export function hatPiece(i: number, n: number, crumble: number): { fall: number; drift: number; landed: boolean } {
  const start = pieceStart(i, n);
  const u = clamp01((crumble - start) / (1 - 0.45));
  const side = i % 2 === 0 ? -1 : 1;
  return { fall: u * u, drift: side * Math.round(u * (1 + (i % 3))), landed: u >= 1 };
}

// ---------- pružina: up to the ceiling, flattened, sliding down ----------

export const SPRING_TIME = 0.08;
export const LAUNCH_TIME = 0.2;
export const SPLAT_TIME = 0.42;
export const SLIDE_TIME = 0.6;

export type SpringPhase =
  /** the coil shoots up under him, `k` 0 → 1 */
  | { readonly phase: 'spring'; readonly k: number }
  /** flying up stretched, `up` 0 (floor) → 1 (head at the ceiling) */
  | { readonly phase: 'launch'; readonly up: number }
  /** flattened against the ceiling; `wobble` squash wiggle −1..1 dying out */
  | { readonly phase: 'splat'; readonly k: number; readonly wobble: number }
  /** peeling off and sliding down, `down` 0 (ceiling) → 1 (floor) */
  | { readonly phase: 'slide'; readonly down: number }
  /** a flat pancake on the floor, `k` 0 → 1 until the angel */
  | { readonly phase: 'flat'; readonly k: number }
  | AngelPhase;

export function springPhase(elapsed: number): SpringPhase {
  const a = angel('pruzina', elapsed);
  if (a) return a;
  let t = Math.max(0, elapsed);
  if (t < SPRING_TIME) return { phase: 'spring', k: t / SPRING_TIME };
  t -= SPRING_TIME;
  if (t < LAUNCH_TIME) {
    const u = t / LAUNCH_TIME;
    return { phase: 'launch', up: 1 - (1 - u) * (1 - u) };
  }
  t -= LAUNCH_TIME;
  if (t < SPLAT_TIME) {
    const k = t / SPLAT_TIME;
    return { phase: 'splat', k, wobble: Math.sin(k * Math.PI * 4) * (1 - k) };
  }
  t -= SPLAT_TIME;
  if (t < SLIDE_TIME) {
    const u = t / SLIDE_TIME;
    // peels off slowly, then slides faster
    return { phase: 'slide', down: u * u * (1.6 - 0.6 * u) };
  }
  t -= SLIDE_TIME;
  const flatFrom = SPRING_TIME + LAUNCH_TIME + SPLAT_TIME + SLIDE_TIME;
  return { phase: 'flat', k: clamp01(t / (ANGEL_AT.pruzina - flatFrom)) };
}

/** Vertical squash of the flattened figure: flat on the ceiling, a bit less while sliding, flat again on the floor. */
export const SPLAT_SQUASH = 0.28;

// ---------- pistole: the BANG flag, the hole in the hat, sway and fall ----------

export const AIM_TIME = 0.1;
export const POP_TIME = 0.2;
/** The hole appears this long into the pop (the flag is out). */
export const HOLE_AT = AIM_TIME + 0.06;
export const SWAY_TIME = 0.6;
export const FALL_TIME = 0.3;
/** Sway amplitude, degrees, and frequency, swings per second. */
const SWAY_DEG = 9;
const SWAY_HZ = 1.7;

export type PistolPhase =
  /** the pistol pokes out, `k` 0 → 1 */
  | { readonly phase: 'aim'; readonly k: number }
  /** the flag pops out on its stick: `pop` overshoots past 1 and settles; `hole` once the hat is holed */
  | { readonly phase: 'bang'; readonly pop: number; readonly hole: boolean }
  /** `tilt` in degrees, + = towards the facing side */
  | { readonly phase: 'sway'; readonly tilt: number }
  | { readonly phase: 'fall'; readonly tilt: number }
  /** flat on his back, `k` 0 → 1 until the angel */
  | { readonly phase: 'down'; readonly k: number }
  | AngelPhase;

/** Sway angle `s` seconds into the sway: swinging forward first, fading a little. */
function sway(s: number): number {
  return SWAY_DEG * Math.sin(2 * Math.PI * SWAY_HZ * s) * (1 - 0.35 * (s / SWAY_TIME));
}

export function pistolPhase(elapsed: number): PistolPhase {
  const a = angel('pistole', elapsed);
  if (a) return a;
  let t = Math.max(0, elapsed);
  if (t < AIM_TIME) return { phase: 'aim', k: t / AIM_TIME };
  const hole = t >= HOLE_AT;
  t -= AIM_TIME;
  if (t < POP_TIME) {
    const u = t / POP_TIME;
    // a spring's overshoot: past 1 at about half, back to 1 at the end
    return { phase: 'bang', pop: Math.min(1, u * 2.2) + Math.sin(Math.min(1, u) * Math.PI) * 0.25, hole };
  }
  t -= POP_TIME;
  if (t < SWAY_TIME) return { phase: 'sway', tilt: sway(t) };
  t -= SWAY_TIME;
  if (t < FALL_TIME) {
    const u = t / FALL_TIME;
    const from = sway(SWAY_TIME);
    // falls over backwards, faster and faster
    return { phase: 'fall', tilt: from + (-90 - from) * u * u };
  }
  t -= FALL_TIME;
  const downFrom = AIM_TIME + POP_TIME + SWAY_TIME + FALL_TIME;
  return { phase: 'down', k: clamp01(t / (ANGEL_AT.pistole - downFrom)) };
}

/** Tilts of the pre-rendered swaying / falling frames, degrees. */
export const PISTOL_TILTS: readonly number[] = [-90, -75, -60, -45, -30, -18, -9, -6, -3, 0, 3, 6, 9];

/** The pre-rendered tilt nearest to `deg`. */
export function nearestTilt(deg: number): number {
  let best = PISTOL_TILTS[0];
  for (const t of PISTOL_TILTS) if (Math.abs(t - deg) < Math.abs(best - deg)) best = t;
  return best;
}
