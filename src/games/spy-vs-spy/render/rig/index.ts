// 2D rig renderer for the spies (sprite-data renders every frame from it at load): pose → skeleton → vector parts →
// supersampled raster → palette-character rows in the same format as SPY_FRAMES, plus the hand pixels.

import { buildParts, CANOPY_AT, PART, toPixels } from './parts';
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
}

/** Vote weights: thin, important details beat the fill around them. */
export const RIG_WEIGHTS: Readonly<Record<string, number>> = {
  b: 1, s: 1.3, S: 1.3, k: 1.6, o: 2.4, u: 2.4, h: 2.4, f: 3, d: 3.5,
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

function pixel(p: Vec, cx: number, h: number, scale: number): [number, number] {
  return [Math.floor(cx + 0.5 + p[0] * scale), Math.floor(h - p[1] * scale)];
}

/** Renders one pose. Deterministic: the same pose and options always give the same rows. */
export function renderRig(pose: RigPose, opts: RigOptions = { w: RIG_W, h: RIG_H }): RigFrame {
  const { w, h } = opts;
  const cx = opts.cx ?? Math.floor(w / 2);
  const scale = opts.scale ?? 1;
  const ss = opts.ss ?? 8;
  const joints = solve(pose);
  const paints = toPixels(buildParts(pose, joints), cx, h - 1, scale);
  const cells = downsample(rasterize(paints, w, h, ss), RIG_WEIGHTS);
  const rows = outline(cells, separate);
  return {
    rows,
    hand: pixel(joints.handFront, cx, h - 1, scale),
    backHand: pixel(joints.handBack, cx, h - 1, scale),
    canopy: pose.umbrella?.state === 'open' && joints.umbrellaAngle !== null
      ? pixel(step(joints.handFront, joints.umbrellaAngle, CANOPY_AT), cx, h - 1, scale)
      : null,
  };
}

export { PART };
