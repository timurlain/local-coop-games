import { doorAt, furnitureAt } from '../logic/places';
import { RULES } from '../logic/rules';
import {
  isActive, opponentOf,
  type Dir, type DoorTrapKind, type FurnitureTrapKind, type GameEvent, type GameState, type PlayerId, type RemedyKind, type Thing,
} from '../logic/state';
import { line, r, text } from './draw';
import { VIEW, furnitureBase, hidingSpot, project } from './geometry';
import { drawGuard } from './guard';
import { doorCentre } from './room';
import { ICONS, SPY_H, type SpyFrame } from './sprite-data';
import { drawIcon, drawIconOutlined, drawIconScaled, drawInHand, handOutline, handPoint, thingIcon } from './sprites';
import { baseColor } from './spy';

type Ctx = CanvasRenderingContext2D;

/** How long one search / hide / swap / store / drop effect shows, seconds (spec §7). */
export const EFFECT_TIME = 0.6;
/** How long the other spy laughs at a trap death, seconds (spec §3). */
export const LAUGH_TIME = 1.2;
/** Laugh frames alternate at this rate, frames per second. */
const LAUGH_FPS = 6;
/** How long a remedy's disarm animation shows, seconds (round 4 §3). */
export const DISARM_TIME = 0.8;
/** How long a blocked jab's club-spark shows, seconds (round 4 §2). */
export const BLOCK_SPARK_TIME = 0.3;

/**
 * Render-side feedback for a logic event (spec §7):
 * - `found` / `nothing`: a search outcome with / without a find;
 * - `hidden`, `swapped`, `stored`: hand ↔ furniture exchanges;
 * - `dropped`: the hand item flies into the furniture that received it; `poof`: it was lost (remedy);
 * - `guard`: the airport guard in the exit doorway kicking a spy back (spec §9), for `RULES.guardKickTime`;
 * - `laugh`: the other spy laughing at a trap death (spec §3), for `LAUGH_TIME` — a pose only, nothing drawn;
 * - `disarm`: a remedy defusing a trap (round 4 §3), for `DISARM_TIME` — umbrella under the electric bucket, water on
 *   the bomb's fuse, pliers snipping the spring, scissors cutting the pistol's string.
 * - `blockSpark`: a jab stopped by the guard's club (round 4 §2), for `BLOCK_SPARK_TIME` — a few white/yellow
 *   pixels flying from the point where the clubs meet, between the two spies at club height.
 */
export type EffectKind =
  | 'found' | 'nothing' | 'hidden' | 'swapped' | 'stored' | 'dropped' | 'poof' | 'guard' | 'laugh' | 'disarm' | 'blockSpark';

/** Pose the spy sprite shows while an effect runs (overrides search/fight/walk, not swing/block). */
export type EffectPose = Extract<SpyFrame, 'liftFind' | 'shrug' | 'hidePut' | 'laugh1' | 'laugh2' | 'placeTrap'>;

/** The spy who laughs at this event (spec §3): on a trap death (`died`, cause ≠ fight), the other spy if it is active. */
export function laugher(state: GameState, e: GameEvent): PlayerId | null {
  if (e.type !== 'died' || e.cause === 'fight') return null;
  const other = state.spies[e.spy === 0 ? 1 : 0];
  return isActive(other) ? other.id : null;
}

export interface Effect {
  kind: EffectKind;
  spy: PlayerId;
  /** the room the effect is drawn in */
  room: number;
  /** anchor: where the spy stood when it happened (floor units) */
  x: number;
  z: number;
  facing: -1 | 1;
  /** the item shown: found / hidden / given (swap) / stored secret / dropped */
  thing: Thing | null;
  /** the item taken out on a swap */
  took: Thing | null;
  furniture: number | null;
  /** disarm: the defused trap and the remedy that did it, and the door it was on (door traps) */
  trap: FurnitureTrapKind | DoorTrapKind | null;
  remedy: RemedyKind | null;
  door: Dir | null;
  /** true when the anchor is in `room` (a drop can land in a neighbouring room's furniture) */
  fromSpy: boolean;
  start: number;
  duration: number;
}

export type EffectQueue = Effect[];

/** Turns this tick's logic events into effects. `state` is the state after the events happened. */
export function spawnEffects(queue: EffectQueue, state: GameState, events: readonly GameEvent[], now: number): void {
  for (const e of events) {
    const fx = effectFor(state, e);
    if (fx === null) continue;
    const spy = state.spies[fx.spy];
    queue.push({
      thing: null, took: null, furniture: null, trap: null, remedy: null, door: null, room: spy.room, fromSpy: true,
      x: spy.x, z: spy.z, facing: spy.facing, start: now, duration: EFFECT_TIME,
      ...fx,
    });
  }
}

type EffectSeed = Pick<Effect, 'kind' | 'spy'> & Partial<Effect>;

function effectFor(state: GameState, e: GameEvent): EffectSeed | null {
  switch (e.type) {
    case 'found':
      return e.thing
        ? { kind: 'found', spy: e.spy, thing: e.thing, furniture: e.furniture }
        : { kind: 'nothing', spy: e.spy, furniture: e.furniture };
    case 'hidden':
      return { kind: 'hidden', spy: e.spy, thing: e.thing, furniture: e.furniture };
    case 'swapped':
      return { kind: 'swapped', spy: e.spy, thing: e.gave, took: e.took, furniture: e.furniture };
    case 'stored':
      return { kind: 'stored', spy: e.spy, thing: { kind: 'secret', secret: e.secret, lastHolder: null }, furniture: e.furniture };
    case 'dropped': {
      if (e.thing === null) return null;
      if (e.furniture === null) return { kind: 'poof', spy: e.spy, thing: e.thing };
      const room = state.furniture[e.furniture].room;
      return {
        kind: 'dropped', spy: e.spy, thing: e.thing, furniture: e.furniture, room,
        fromSpy: room === state.spies[e.spy].room,
      };
    }
    case 'bounced':
      return { kind: 'guard', spy: e.spy, duration: RULES.guardKickTime };
    case 'blocked': {
      // Only a blocked jab shows a spark: the clubs actually meet. A bash stopped by ducking has
      // no club contact to spark from.
      if (e.kind !== 'jab') return null;
      const defender = state.spies[e.spy];
      const attacker = opponentOf(state, defender);
      return {
        kind: 'blockSpark', spy: e.spy, duration: BLOCK_SPARK_TIME,
        x: (attacker.x + defender.x) / 2, z: (attacker.z + defender.z) / 2,
      };
    }
    case 'died': {
      const spy = laugher(state, e);
      return spy === null ? null : { kind: 'laugh', spy, duration: LAUGH_TIME };
    }
    case 'disarmed': {
      const spy = state.spies[e.spy];
      const onFurniture = e.trap === 'bomba' || e.trap === 'pruzina';
      return {
        kind: 'disarm', spy: e.spy, duration: DISARM_TIME, trap: e.trap, remedy: e.remedy,
        furniture: onFurniture ? spy.searchTarget ?? furnitureAt(state, spy)?.id ?? null : null,
        door: onFurniture ? null : doorAt(state, spy),
      };
    }
    default:
      return null;
  }
}

/** Drops finished effects and returns the running ones. */
export function activeEffects(queue: EffectQueue, now: number): Effect[] {
  for (let i = queue.length - 1; i >= 0; i--) {
    if (now >= queue[i].start + queue[i].duration) queue.splice(i, 1);
  }
  return queue.filter((e) => e.start <= now);
}

/** Running effects drawn in the view of `room`. */
export function effectsIn(queue: EffectQueue, room: number, now: number): Effect[] {
  return activeEffects(queue, now).filter((e) => e.room === room);
}

/** Progress 0..1 of an effect at `now`. */
function progress(e: Effect, now: number): number {
  return Math.min(1, Math.max(0, (now - e.start) / e.duration));
}

function poseOf(e: Effect, now: number): EffectPose | null {
  switch (e.kind) {
    case 'found':
    case 'stored':
      return 'liftFind';
    case 'nothing':
      return 'shrug';
    case 'hidden':
      return 'hidePut';
    case 'swapped':
      return progress(e, now) < 0.5 ? 'hidePut' : 'liftFind';
    case 'laugh':
      return Math.floor((now - e.start) * LAUGH_FPS) % 2 === 0 ? 'laugh1' : 'laugh2';
    case 'disarm':
      return disarmPose(e);
    case 'dropped':
    case 'poof':
    case 'guard':
    case 'blockSpark':
      return null;
  }
}

/** The pose override of one spy at `now` (latest running effect with a pose), or null. */
export function effectPose(queue: EffectQueue, spy: PlayerId, now: number): EffectPose | null {
  const mine = activeEffects(queue, now).filter((e) => e.spy === spy);
  for (let i = mine.length - 1; i >= 0; i--) {
    const pose = poseOf(mine[i], now);
    if (pose !== null) return pose;
  }
  return null;
}

// ---------- drawing ----------

const SPARKLE = ['#fff6c0', '#e8c547'];
const DUST = ['#bdbdbd', '#8a8a8a'];

/** Draws one running effect at `now`; the view depth-sorts effects by their anchor `z` (round 5 §5). */
export function drawEffectAt(ctx: Ctx, state: GameState, e: Effect, now: number): void {
  drawEffect(ctx, state, e, progress(e, now));
}

const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
const ease = (t: number): number => t * t * (3 - 2 * t);

function hand(e: Effect, frame: SpyFrame): { x: number; y: number } {
  const { sx, sy } = project(e.x, e.z);
  const { hx, hy } = handPoint(frame, sx, sy, e.facing < 0);
  return { x: hx, y: hy };
}

/** The hiding spot of a piece: a little above the floor line at its centre. */
function slot(state: GameState, e: Effect): { x: number; y: number } | null {
  if (e.furniture === null) return null;
  return hidingSpot(state.furniture[e.furniture]);
}

function icon(ctx: Ctx, t: Thing | null, x: number, y: number): void {
  if (t !== null) drawIcon(ctx, thingIcon(t), Math.round(x), Math.round(y) + 4);
}

function fading(ctx: Ctx, alpha: number, draw: () => void): void {
  ctx.save();
  ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
  draw();
  ctx.restore();
}

function drawEffect(ctx: Ctx, state: GameState, e: Effect, t: number): void {
  const at = slot(state, e);
  switch (e.kind) {
    case 'found': {
      const h = hand(e, 'liftFind');
      const y = h.y - 5 - ease(t) * 8;
      icon(ctx, e.thing, h.x, y);
      sparkles(ctx, h.x, y, t);
      break;
    }
    case 'nothing': {
      if (at) dust(ctx, at.x, at.y, t, 7);
      const { sx, sy } = project(e.x, e.z);
      const bob = Math.round(Math.sin(t * Math.PI * 3));
      text(ctx, '?', sx, sy - SPY_H - 2 + bob, '#f4f4f4', 8, 'center');
      break;
    }
    case 'hidden': {
      const h = hand(e, 'hidePut');
      if (at && t < 0.7) {
        const k = ease(t / 0.7);
        fading(ctx, 1.4 - k, () => icon(ctx, e.thing, lerp(h.x, at.x, k), lerp(h.y, at.y, k)));
      }
      if (t >= 0.6) {
        const fall = Math.round((t - 0.6) * 12);
        r(ctx, h.x - 1, h.y + 2 + fall, 1, 1, DUST[0]);
        r(ctx, h.x + 2, h.y + 3 + fall, 1, 1, DUST[1]);
      }
      break;
    }
    case 'swapped': {
      if (!at) break;
      const put = hand(e, 'hidePut');
      const lift = hand(e, 'liftFind');
      const k = ease(t);
      fading(ctx, 1.4 - k, () => icon(ctx, e.thing, lerp(put.x, at.x, k), lerp(put.y, at.y, k)));
      fading(ctx, 0.3 + k, () => icon(ctx, e.took, lerp(at.x, lift.x, k), lerp(at.y, lift.y - 5, k)));
      break;
    }
    case 'stored': {
      if (!at) break;
      const h = hand(e, 'liftFind');
      const k = ease(Math.min(1, t / 0.8));
      // the kufřík hangs under the raised hand: the secret flies into it and vanishes
      if (t < 0.8) icon(ctx, e.thing, lerp(at.x, h.x, k), lerp(at.y, h.y + 3, k) - Math.sin(k * Math.PI) * 6);
      else sparkles(ctx, h.x, h.y + 3, t);
      break;
    }
    case 'dropped': {
      if (!at) break;
      const k = ease(Math.min(1, t / 0.8));
      if (!e.fromSpy) {
        if (t < 0.8) icon(ctx, e.thing, at.x, lerp(at.y - 20, at.y, k));
      } else if (t < 0.8) {
        const h = hand(e, 'stand');
        icon(ctx, e.thing, lerp(h.x, at.x, k), lerp(h.y, at.y, k) - Math.sin(k * Math.PI) * 12);
      }
      if (t >= 0.8) dust(ctx, at.x, at.y, (t - 0.8) / 0.2, 4);
      break;
    }
    case 'poof': {
      const h = hand(e, 'stand');
      if (t < 0.25) icon(ctx, e.thing, h.x, h.y);
      dust(ctx, h.x, h.y - 2, t, 6);
      break;
    }
    case 'guard': {
      const exit = state.rooms[e.room].exit;
      if (exit !== null) drawGuard(ctx, exit, e.x, t * e.duration);
      break;
    }
    case 'laugh':
      break; // the pose is the whole effect
    case 'disarm':
      drawDisarm(ctx, state, e, t);
      break;
    case 'blockSpark': {
      const h = hand(e, 'block');
      sparkles(ctx, h.x, h.y, t);
      break;
    }

  }
}

/** 4 twinkling pixels around (x, y). */
function sparkles(ctx: Ctx, x: number, y: number, t: number): void {
  const spin = t * Math.PI * 2;
  for (let i = 0; i < 4; i++) {
    if ((Math.floor(t * 12) + i) % 3 === 0) continue;
    const a = spin + (i * Math.PI) / 2;
    r(ctx, Math.round(x + Math.cos(a) * 7), Math.round(y - 2 + Math.sin(a) * 6), 1, 1, SPARKLE[i % 2]);
  }
}

/** A grey puff of `n` pixels spreading out and up from (x, y). */
function dust(ctx: Ctx, x: number, y: number, t: number, n: number): void {
  fading(ctx, 1 - t, () => {
    for (let i = 0; i < n; i++) {
      const a = Math.PI + (i / (n - 1)) * Math.PI; // upper half circle
      const d = 2 + t * 7;
      r(ctx, Math.round(x + Math.cos(a) * d), Math.round(y + Math.sin(a) * d * 0.6 - t * 3), 1, 1, DUST[i % 2]);
    }
  });
}

// ---------- disarming (round 4 §3) ----------

/** Crouched at the furniture for the bucket and the pliers; standing, hand raised, for the umbrella and the scissors. */
function disarmPose(e: Effect): EffectPose {
  return e.remedy === 'voda' || e.remedy === 'kleste' ? 'placeTrap' : 'liftFind';
}

const WATER = ['#6cc6e8', '#3a78d8'];
const SPARK = '#ffeb3b';
const STEAM = ['#e8e8ec', '#b8b8c0'];
const STEEL = '#cfcfcf';
const STRING = '#f4f4f4';

type Pt = { x: number; y: number };

function drawDisarm(ctx: Ctx, state: GameState, e: Effect, t: number): void {
  const frame = disarmPose(e);
  const { sx, sy } = project(e.x, e.z);
  const flip = e.facing < 0;
  const h = hand(e, frame);
  // The spy may walk off through the door he just opened: then only the part in the room stays behind.
  const spy = state.spies[e.spy];
  const withSpy = spy.room === e.room && spy.mode !== 'dead';
  // the floor line of the defused piece: the back wall's, or a free-standing piece's front edge (round 5 §5)
  const base = (e.furniture === null ? VIEW.backY : Math.round(furnitureBase(state.furniture[e.furniture]).y)) - 1;
  switch (e.remedy) {
    case 'destnik':
      if (withSpy) umbrella(ctx, h, t);
      break;
    case 'voda':
      water(ctx, frame, sx, sy, flip, h, e.facing, t, withSpy, handOutline(baseColor(spy)), base);
      break;
    case 'kleste':
      snipSpring(ctx, h, e.facing, t, withSpy, base);
      break;
    case 'nuzky':
      cutString(ctx, e, h, t, withSpy);
      break;
    case null:
      break;
  }
}

/** The umbrella opens over his head; blue drops pour onto it and run off its rim, a yellow spark at the top. */
function umbrella(ctx: Ctx, h: Pt, t: number): void {
  // The canopy's crown sits 5 px above the raised hand (its handle row); at the back wall that would be under the
  // view's top edge, so there it comes down over the hat, leaving room for the drops and the spark above it.
  const top = Math.max(h.y - 5, VIEW.top + 6);
  drawIcon(ctx, 'destnik_open', h.x, top + ICONS.destnik_open.length);
  if (t > 0.9) return;
  // drops falling onto the canopy
  for (let i = 0; i < 5; i++) {
    const fall = (t * 40 + i * 5) % 9;
    r(ctx, h.x - 4 + i * 2, Math.max(VIEW.top, Math.round(top - 9 + fall)), 1, 2, WATER[i % 2]);
  }
  // running off the rim on both sides
  for (const side of [-1, 1]) {
    const drip = (t * 30 + (side > 0 ? 3 : 0)) % 7;
    r(ctx, h.x + side * 6, Math.round(top + 3 + drip), 1, 1, WATER[0]);
  }
  // the spark on top, flickering
  if (t < 0.7 && Math.floor(t * 20) % 2 === 0) {
    r(ctx, h.x, top - 2, 1, 1, SPARK);
    r(ctx, h.x - 1, top - 3, 1, 1, SPARK);
    r(ctx, h.x + 1, top - 1, 1, 1, SPARK);
    r(ctx, h.x + 1, top - 4, 1, 1, '#ffffff');
  }
}

/** The bucket in hand pours an arc of water onto the bomb's lit fuse; a steam puff rises and the bomb is out. */
function water(
  ctx: Ctx, frame: SpyFrame, sx: number, sy: number, flip: boolean, h: Pt, facing: -1 | 1, t: number, withSpy: boolean,
  outline: string, by: number,
): void {
  const bx = h.x + facing * 11;
  if (withSpy) drawInHand(ctx, 'voda', frame, sx, sy, flip, 'front', outline);
  if (t < 0.75) drawIcon(ctx, 'bomba', bx, by);
  const fuse = { x: bx + 2, y: by - 7 };
  if (t < 0.4 && Math.floor(t * 24) % 2 === 0) r(ctx, fuse.x + 1, fuse.y - 1, 1, 1, '#ff9a3c');
  if (withSpy && t < 0.5) {
    // water arcing from the bucket's rim over to the fuse
    const from = { x: h.x + facing * 3, y: h.y + 1 };
    const n = 7;
    const shown = Math.ceil(n * Math.min(1, t / 0.25));
    for (let i = 0; i < shown; i++) {
      const k = i / (n - 1);
      const x = from.x + (fuse.x - from.x) * k;
      const y = from.y + (fuse.y - from.y) * k - Math.sin(k * Math.PI) * 6;
      r(ctx, Math.round(x), Math.round(y), 1, 1, WATER[(i + Math.floor(t * 20)) % 2]);
    }
  }
  if (t >= 0.35) steam(ctx, fuse.x, fuse.y, (t - 0.35) / 0.65);
}

/** A grey-white puff swelling and rising from (x, y), fading out. */
function steam(ctx: Ctx, x: number, y: number, k: number): void {
  fading(ctx, 1 - k * k, () => {
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 + k * 2;
      const d = 1 + k * 4;
      const size = 2 + Math.round(k * 2);
      r(ctx, Math.round(x + Math.cos(a) * d) - 1, Math.round(y - 2 - k * 9 + Math.sin(a) * d * 0.6) - 1, size, size, STEAM[i % 2]);
    }
  });
}

/** A coiled spring pops up out of the furniture, the pliers snap it, and the two halves drop. */
function snipSpring(ctx: Ctx, h: Pt, facing: -1 | 1, t: number, withSpy: boolean, base: number): void {
  const x = h.x + facing * 10;
  const coil = (y0: number, y1: number, dx = 0): void => {
    for (let y = y0, i = 0; y > y1; y -= 2, i++) line(ctx, x - 2 + dx, y, x + 2 + dx, y - 1, i % 2 === 0 ? STEEL : '#8a8a8a');
  };
  const pop = Math.min(1, t / 0.2);
  const height = Math.round(14 * (1 - (1 - pop) * (1 - pop)));
  const cutAt = 0.45;
  const mid = base - 7;
  if (t < cutAt) {
    coil(base, base - height);
    r(ctx, x - 2, base - height - 1, 5, 1, '#111111'); // the top plate
  } else {
    const k = (t - cutAt) / (1 - cutAt);
    // the lower half sags back down, the upper half falls off sideways
    coil(base, mid + Math.round(k * 5));
    fading(ctx, 1.3 - k, () => {
      const drop = Math.round(k * k * 12);
      const dx = facing * Math.round(k * 5);
      coil(mid + drop, mid - 7 + drop, dx);
      r(ctx, x - 2 + dx, mid - 8 + drop, 5, 1, '#111111');
    });
    if (k < 0.25) { // the snap
      r(ctx, x - 3, mid, 1, 1, '#ffffff');
      r(ctx, x + 3, mid - 1, 1, 1, '#ffffff');
    }
  }
  if (!withSpy) return;
  // the pliers reach from the hand to the coil's middle and close on it
  const reach = ease(Math.min(1, t / cutAt));
  const px = h.x + (x - h.x) * reach;
  const py = h.y + (mid - 1 - h.y) * reach;
  drawIconScaled(ctx, 'kleste', Math.round(px), Math.round(py), t < cutAt ? 1 : 0.85);
}

/** A string runs from the door to the hand; the scissors cut it and the pistol drops off the door, harmless. */
function cutString(ctx: Ctx, e: Effect, h: Pt, t: number, withSpy: boolean): void {
  if (e.door === null) return;
  const d = doorCentre(e.door);
  const cutAt = 0.35;
  const floor = e.door === 'S' ? VIEW.frontY - 1 : Math.max(d.y + 6, project(e.x, e.z).sy - 1);
  if (t < cutAt) {
    line(ctx, d.x, d.y, h.x, h.y, STRING);
    drawIconOutlined(ctx, 'pistole', Math.round(d.x), Math.round(d.y) + 4, STRING);
  } else {
    const k = (t - cutAt) / (1 - cutAt);
    // the two loose ends droop and fade
    const mx = (d.x + h.x) / 2;
    const my = (d.y + h.y) / 2;
    fading(ctx, 1 - k, () => {
      line(ctx, d.x, d.y, mx - 1, my + 2 + k * 6, STRING);
      if (withSpy) line(ctx, h.x, h.y, mx + 1, my + 2 + k * 6, STRING);
    });
    // the pistol falls to the floor with a little bounce
    const fall = Math.min(1, k / 0.6);
    const y = d.y + 4 + (floor - d.y - 4) * fall * fall;
    const bounce = k > 0.6 ? Math.round(Math.sin(((k - 0.6) / 0.4) * Math.PI) * 2) : 0;
    drawIconOutlined(ctx, 'pistole', Math.round(d.x), Math.round(y) - bounce, STRING);
  }
  if (!withSpy) return;
  // the scissors at the hand, snapping shut at the cut
  const shut = Math.abs(t - cutAt) < 0.08;
  drawIconScaled(ctx, 'nuzky', h.x, h.y - 3, shut ? 0.8 : 1);
  if (shut) r(ctx, h.x + 3, h.y - 6, 1, 1, '#ffffff');
}
