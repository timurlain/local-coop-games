import type { Furniture, RoomTheme } from '../../logic/state';
import { line, poly, r } from '../draw';
import { BRASS, BRASS_DARK, ENAMEL_RED, ENAMEL_WHITE, INK, IRON, IRON_LIGHT, OAK, OAK_DARK, OAK_LIGHT, WALNUT, WALNUT_LIGHT, type Ctx } from './shared';

/** Bentwood (Thonet) coat stand with a black umbrella and a bowler hat. */
export function drawVesak(ctx: Ctx, f: Furniture, theme: RoomTheme, x: number, y: number, now: number): number {
  r(ctx, x - 0.5, y - 32, 1.5, 30, WALNUT);
  for (const sx of [-1, 1]) {
    line(ctx, x, y - 30, x + sx * 5, y - 32, WALNUT);
    r(ctx, x + sx * 5 - (sx < 0 ? 1 : 0), y - 33, 1, 2, WALNUT);
    line(ctx, x, y - 25, x + sx * 4, y - 27, WALNUT);
    line(ctx, x, y - 5, x + sx * 5, y, WALNUT);
  }
  // the bentwood ring that braces the legs
  for (let a = 0; a < 12; a++) {
    const ang = (a / 12) * Math.PI * 2;
    r(ctx, Math.round(x + Math.cos(ang) * 4), Math.round(y - 12 + Math.sin(ang) * 1.5), 1, 1, WALNUT_LIGHT);
  }
  // bowler hat on the top left hook
  r(ctx, x - 8, y - 34, 5, 2, INK);
  r(ctx, x - 9, y - 32, 7, 1, INK);
  // umbrella hanging from the right hook by its crook handle
  const ux = x + 5;
  r(ctx, ux, y - 31, 1, 2, OAK);
  r(ctx, ux - 1, y - 32, 2, 1, OAK);
  poly(ctx, [[ux - 1, y - 29], [ux + 2, y - 29], [ux + 1.5, y - 14], [ux - 0.5, y - 14]], '#1c1c24');
  r(ctx, ux, y - 29, 1, 15, '#34343e');
  r(ctx, ux, y - 14, 1, 3, '#9a9aa0');
  return y - 34;
}

/** Red enamel fire cabinet with a brass rim; a fire bucket behind the glass. */
export function drawHasicak(ctx: Ctx, f: Furniture, theme: RoomTheme, x: number, y: number, now: number): number {
  r(ctx, x - 8, y - 23, 16, 17, BRASS_DARK);
  r(ctx, x - 7, y - 22, 14, 15, ENAMEL_RED);
  r(ctx, x - 7, y - 22, 14, 1, '#d84a3a');
  r(ctx, x - 5, y - 20, 10, 9, BRASS);
  r(ctx, x - 4, y - 19, 8, 7, '#3a4a58');
  poly(ctx, [[x - 3, y - 17], [x + 3, y - 17], [x + 2, y - 12], [x - 2, y - 12]], '#c8302a');
  r(ctx, x - 3, y - 17, 6, 1, '#e8e0d0');
  line(ctx, x - 3, y - 18, x + 3, y - 18, '#8a8a8a');
  r(ctx, x - 3, y - 19, 1, 1, '#e8f4f8');
  r(ctx, x - 2, y - 18, 1, 1, '#e8f4f8');
  r(ctx, x + 4, y - 15, 1, 2, BRASS);
  r(ctx, x - 7, y - 9, 14, 2, '#8a1a14');
  return y - 23;
}

/** Wooden toolbox (open tote) with iron corners and handle; pliers sticking out. */
export function drawNaradi(ctx: Ctx, f: Furniture, theme: RoomTheme, x: number, y: number, now: number): number {
  r(ctx, x - 10, y - 12, 20, 12, OAK);
  r(ctx, x - 10, y - 12, 20, 1, OAK_LIGHT);
  r(ctx, x - 10, y - 7, 20, 1, OAK_DARK);
  for (const cx of [-10, 8]) {
    r(ctx, x + cx, y - 12, 2, 3, IRON);
    r(ctx, x + cx, y - 3, 2, 3, IRON);
  }
  r(ctx, x - 1, y - 20, 2, 8, OAK_DARK);
  r(ctx, x - 7, y - 20, 14, 2, IRON_LIGHT);
  line(ctx, x - 6, y - 12, x - 2, y - 17, '#9aa3ac');
  line(ctx, x - 4, y - 12, x - 2, y - 17, '#9aa3ac');
  r(ctx, x - 3, y - 18, 2, 2, '#5a6068');
  r(ctx, x - 7, y - 12, 2, 1, '#c83a2a');
  r(ctx, x - 5, y - 12, 2, 1, '#c83a2a');
  r(ctx, x + 3, y - 15, 5, 3, '#6a6e72');
  return y - 20;
}

/** White enamel first-aid cabinet with a red cross. */
export function drawLekarnicka(ctx: Ctx, f: Furniture, theme: RoomTheme, x: number, y: number, now: number): number {
  r(ctx, x - 8, y - 23, 16, 17, '#c8c6be');
  r(ctx, x - 7, y - 22, 14, 15, ENAMEL_WHITE);
  r(ctx, x - 7, y - 22, 14, 1, '#ffffff');
  r(ctx, x - 1.5, y - 20, 3, 10, '#d02a2a');
  r(ctx, x - 5, y - 16.5, 10, 3, '#d02a2a');
  r(ctx, x + 5, y - 15, 1, 2, '#9a9a94');
  r(ctx, x - 7, y - 8, 14, 1, '#a8a69e');
  return y - 23;
}
