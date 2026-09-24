import { RULES } from '../logic/rules';
import type { GameEvent, GameState, PlayerId, Thing } from '../logic/state';
import { r, text } from './draw';
import { VIEW, project, wallX } from './geometry';
import { drawGuard } from './guard';
import { SPY_H, type SpyFrame } from './sprite-data';
import { drawIcon, handPoint, thingIcon } from './sprites';

type Ctx = CanvasRenderingContext2D;

/** How long one search / hide / swap / store / drop effect shows, seconds (spec §7). */
export const EFFECT_TIME = 0.6;

/**
 * Render-side feedback for a logic event (spec §7):
 * - `found` / `nothing`: a search outcome with / without a find;
 * - `hidden`, `swapped`, `stored`: hand ↔ furniture exchanges;
 * - `dropped`: the hand item flies into the furniture that received it; `poof`: it was lost (remedy);
 * - `guard`: the airport guard in the exit doorway kicking a spy back (spec §9), for `RULES.guardKickTime`.
 */
export type EffectKind = 'found' | 'nothing' | 'hidden' | 'swapped' | 'stored' | 'dropped' | 'poof' | 'guard';

/** Pose the spy sprite shows while an effect runs (overrides search/fight/walk, not swing/block). */
export type EffectPose = Extract<SpyFrame, 'liftFind' | 'shrug' | 'hidePut'>;

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
      thing: null, took: null, furniture: null, room: spy.room, fromSpy: true,
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
    case 'dropped':
    case 'poof':
    case 'guard':
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

/** Draws the effects of `room` (call inside the room clip, after the spies). */
export function drawEffects(ctx: Ctx, state: GameState, queue: EffectQueue, room: number, now: number): void {
  for (const e of effectsIn(queue, room, now)) drawEffect(ctx, state, e, progress(e, now));
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
  return { x: Math.round(wallX(state.furniture[e.furniture].x)), y: VIEW.backY - 5 };
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
