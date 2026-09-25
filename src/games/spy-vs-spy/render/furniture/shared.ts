import type { Furniture, RoomTheme } from '../../logic/state';
import { r } from '../draw';

export type Ctx = CanvasRenderingContext2D;

/** Draws one piece's body for its kind at the given wall-relative position; returns the new `top`. */
export type DrawFn = (ctx: Ctx, f: Furniture, theme: RoomTheme, x: number, y: number, now: number) => number;

/** 1930s materials. */
export const OAK = '#9a6a3a';
export const OAK_LIGHT = '#b8844a';
export const OAK_DARK = '#6e4724';
export const WALNUT = '#5e3a20';
export const WALNUT_LIGHT = '#7a4e2c';
export const WALNUT_DARK = '#3a2212';
export const BRASS = '#d4b050';
export const BRASS_DARK = '#8a6a24';
export const IRON = '#2c2c30';
export const IRON_LIGHT = '#48484e';
export const CREAM = '#efe4c4';
export const INK = '#161616';
export const LEATHER = '#6e2a1e';
export const LEATHER_LIGHT = '#8e3a28';
export const LEATHER_DARK = '#4a1a12';
export const VELVET = '#2f5a40';
export const VELVET_LIGHT = '#3f7250';
export const VELVET_DARK = '#1f3e2c';
export const MARBLE = '#e6e2da';
export const MARBLE_VEIN = '#b8b2a8';
export const ENAMEL_RED = '#b8241e';
export const ENAMEL_WHITE = '#f2f0e8';
export const LEAF = '#3f7a3a';
export const LEAF_LIGHT = '#5a9a48';
export const LEAF_DARK = '#2a5a2a';

/** Small turned leg pair under a table top. */
export function legs(ctx: Ctx, x: number, y: number, half: number, h: number, color: string): void {
  r(ctx, x - half, y - h, 2, h, color);
  r(ctx, x + half - 2, y - h, 2, h, color);
}
