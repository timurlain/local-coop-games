// 2D rig renderer for the spies (sprite-data renders every frame from it at load): pose → skeleton → vector parts →
// supersampled raster → palette-character rows in the same format as SPY_FRAMES, plus the hand pixels.

import { buildParts, CANOPY_AT, headPoint, PART, toPixels, worldToPixel } from './parts';
import { downsample, outline, rasterize, type Cell, type Vec } from './raster';
import { solve, step, type RigPose } from './skeleton';

export { RIG_POSES, type RigPoseName } from './poses';
export { solve, type RigPose, type Joints } from './skeleton';

export interface RigOptions {
  /** Output size in pixels. */
  readonly w: number;
  readonly h: number;
  /** Column of the body's centre line (default ⌊w / 2⌋). */
  readonly cx?: number;
  /** World units per output pixel multiplier (1 = the 40-px-tall figure). */
  readonly scale?: number;
  /** Samples per pixel per axis. */
  readonly ss?: number;
  /** Vertical scale on top of `scale`: < 1 flattens the figure, > 1 stretches it (round 6 §6). */
  readonly squash?: number;
  /** Turns the whole figure clockwise about its foot point, degrees (swaying, falling over). */
  readonly tilt?: number;
  /** Draw the hat (default true). */
  readonly hat?: boolean;
  /** A bullet hole through the hat's crown ('O'). */
  readonly hatHole?: boolean;
}

/** Spy frame: 40×40 with the body on column 20, so the jab and the open umbrella fit without clipping. */
export const RIG_W = 40;
export const RIG_H = 40;

export interface RigFrame {
  readonly rows: readonly string[];
  /** Image pixel of the front / back hand, like SPY_HANDS / SPY_BACK_HANDS. */
  readonly hand: readonly [number, number];
  readonly backHand: readonly [number, number];
  /** Image pixel in the middle of the open umbrella's canopy (null with the umbrella closed or absent). */
  readonly canopy: readonly [number, number] | null;
  /** Image pixel of the top of the head on its centre line, where the hat's brim sits (a bucket lands there). */
  readonly brim: readonly [number, number];
}

/** Head-local point of the brim over the centre of the head. */
const BRIM: Vec = [0, 6.4];

/** Vote weights: thin, important details beat the fill around them. */
export const RIG_WEIGHTS: Readonly<Record<string, number>> = {
  b: 1, s: 1.3, S: 1.3, k: 1.6, o: 2.4, u: 2.4, h: 2.4, f: 3, d: 3.5, O: 4,
};

/** Characters the rig draws; every spy palette (SPY_PALETTES) colours all of them. */
export const RIG_CHARS = ['o', 'b', 's', 'S', 'd', 'k', 'u', 'h', 'f'] as const;
export type RigChar = (typeof RIG_CHARS)[number];

/** Two touching parts need a line between them when they would otherwise merge into one colour. */
function separate(back: Cell, front: Cell): boolean {
  if (back.ch === 'o' || back.ch === 'd') return false;
  if (back.ch === front.ch) return true;
  const dark = (c: string): boolean => c === 'b' || c === 'u' || c === 'k';
  return dark(back.ch) && dark(front.ch);
}

function floor2([x, y]: Vec): [number, number] {
  return [Math.floor(x), Math.floor(y)];
}

/** Renders one pose. Deterministic: the same pose and options always give the same rows. */
export function renderRig(pose: RigPose, opts: RigOptions = { w: RIG_W, h: RIG_H }): RigFrame {
  const { w, h } = opts;
  const cx = opts.cx ?? Math.floor(w / 2);
  const scale = opts.scale ?? 1;
  const scaleY = scale * (opts.squash ?? 1);
  const tilt = opts.tilt ?? 0;
  const ss = opts.ss ?? 8;
  const joints = solve(pose);
  const parts = buildParts(pose, joints, { hat: opts.hat, hatHole: opts.hatHole });
  const at = { cx, ground: h - 1, scale, scaleY, tilt };
  const cells = downsample(rasterize(toPixels(parts, at), w, h, ss), RIG_WEIGHTS);
  const rows = outline(cells, separate);
  const px = worldToPixel(parts, at);
  return {
    rows,
    brim: floor2(px(headPoint(joints, BRIM))),
    hand: floor2(px(joints.handFront)),
    backHand: floor2(px(joints.handBack)),
    canopy: pose.umbrella?.state === 'open' && joints.umbrellaAngle !== null
      ? floor2(px(step(joints.handFront, joints.umbrellaAngle, CANOPY_AT)))
      : null,
  };
}

export { PART };
