// Prototype 2D rig renderer for the spies (not used by the game yet): pose → skeleton → vector parts →
// supersampled raster → palette-character rows in the same format as SPY_FRAMES, plus the hand pixels.

import { SPY_PALETTES, type SpyPalette } from '../sprite-data';
import { buildParts, PART, toPixels } from './parts';
import { downsample, outline, rasterize, type Cell, type Vec } from './raster';
import { solve, type RigPose } from './skeleton';

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

/** Proposed frame: 40×40 with the body on column 20, so the jab and the open umbrella fit without clipping. */
export const RIG_W = 40;
export const RIG_H = 40;

export interface RigFrame {
  readonly rows: readonly string[];
  /** Image pixel of the front / back hand, like SPY_HANDS / SPY_BACK_HANDS. */
  readonly hand: readonly [number, number];
  readonly backHand: readonly [number, number];
}

/** Vote weights: thin, important details beat the fill around them. */
export const RIG_WEIGHTS: Readonly<Record<string, number>> = {
  b: 1, s: 1.3, S: 1.3, k: 1.6, o: 2.4, u: 2.4, h: 2.4, f: 3, d: 3.5,
};

/** Characters the rig draws; every RIG_PALETTES entry has all of them. */
export const RIG_CHARS = ['o', 'b', 'e', 'c', 's', 'S', 'd', 'k', 'u', 'h', 'f'] as const;

/** The game's spy palettes plus the rig's skin, eye, shoe and umbrella characters. */
export const RIG_PALETTES: Record<SpyPalette, Record<(typeof RIG_CHARS)[number], string>> = {
  white: { ...SPY_PALETTES.white, s: '#f0a484', S: '#c47858', d: '#1a1a1a', k: '#1a1a1a', u: '#262626', h: '#8b5a2b', f: '#c8c8c8' },
  black: { ...SPY_PALETTES.black, s: '#f0a484', S: '#c47858', d: '#1a1a1a', k: '#050505', u: '#383838', h: '#8b5a2b', f: '#c8c8c8' },
  sooty: { ...SPY_PALETTES.sooty, s: '#6a5a52', S: '#4a3e38', d: '#ffffff', k: '#000000', u: '#1a1a1a', h: '#4a3020', f: '#808080' },
  soaked: { ...SPY_PALETTES.soaked, s: '#c8b8e8', S: '#9a8cc0', d: '#1b3a6b', k: '#1b3a6b', u: '#2a4a7a', h: '#5a6a8a', f: '#c8d8ff' },
  ghost: { ...SPY_PALETTES.ghost, s: '#fff0ea', S: '#eeddd6', d: '#999999', k: '#cccccc', u: '#dddddd', h: '#e6d8cc', f: '#ffffff' },
};

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
  };
}

export { PART };
