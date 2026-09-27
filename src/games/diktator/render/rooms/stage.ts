// One half of the split screen (spec §5): the room its hero stands in, the 0.4 s slide when he changes rooms
// (the old room slides away, the new one comes in, his figure steps in from the left edge) and a short nudge
// when he walks into a wall. Owns its canvas state.

import type { Direction, Hero } from '../../logic/palace';
import type { RoomView } from '../../ui/palace-view';
import { STAGE_H, STAGE_W } from './crowd';
import { drawHeroes, drawRoom } from './scene';

export const SLIDE_SEC = 0.4;
export const BUMP_SEC = 0.15;

export type StageAnim =
  | { readonly kind: 'slide'; readonly from: RoomView; readonly dir: Direction; readonly start: number }
  | { readonly kind: 'bump'; readonly dir: Direction; readonly start: number };

const VEC: Readonly<Record<Direction, readonly [number, number]>> = { left: [-1, 0], right: [1, 0], up: [0, -1], down: [0, 1] };

/** 0..1 through the animation at time `t` (seconds); 1 when there is none or it has finished. */
export function progress(anim: StageAnim | null, t: number): number {
  if (!anim) return 1;
  const len = anim.kind === 'slide' ? SLIDE_SEC : BUMP_SEC;
  return Math.min(1, Math.max(0, (t - anim.start) / len));
}

/** Offsets of the old and the new room during a slide (ease-out): the new room comes in from the side walked to. */
export function slideOffsets(dir: Direction, p: number): { readonly from: readonly [number, number]; readonly to: readonly [number, number] } {
  const [vx, vy] = VEC[dir];
  const e = 1 - (1 - p) * (1 - p);
  return {
    from: [-vx * STAGE_W * e, -vy * STAGE_H * e],
    to: [vx * STAGE_W * (1 - e), vy * STAGE_H * (1 - e)],
  };
}

/** A quick nudge toward the wall and back. */
export function bumpOffset(dir: Direction, p: number): readonly [number, number] {
  const [vx, vy] = VEC[dir];
  const k = Math.sin(p * Math.PI) * 4;
  return [vx * k, vy * k];
}

/** Draws `own`'s half: `view` is the room he stands in now. The caller has set the stage transform (480 × 200). */
export function drawHalf(ctx: CanvasRenderingContext2D, view: RoomView, own: Hero, anim: StageAnim | null, t: number): void {
  const p = progress(anim, t);
  ctx.save();
  if (anim && anim.kind === 'slide' && p < 1) {
    const o = slideOffsets(anim.dir, p);
    ctx.save();
    ctx.translate(o.from[0], o.from[1]);
    drawRoom(ctx, anim.from, t, { heroes: false });
    ctx.restore();
    ctx.save();
    ctx.translate(o.to[0], o.to[1]);
    drawRoom(ctx, view, t, { heroes: false });
    drawHeroes(ctx, view.heroes.filter((h) => h !== own), own, t);
    ctx.restore();
    drawHeroes(ctx, view.heroes.filter((h) => h === own), own, t, p);
  } else {
    if (anim && anim.kind === 'bump' && p < 1) {
      const [bx, by] = bumpOffset(anim.dir, p);
      ctx.translate(bx, by);
    }
    drawRoom(ctx, view, t, { heroes: false });
    drawHeroes(ctx, view.heroes, own, t);
  }
  ctx.restore();
}
