import type { Furniture, RoomTheme } from '../../logic/state';
import { disc, line, poly, r } from '../draw';
import {
  BRASS, BRASS_DARK, CREAM, INK, LEAF, LEAF_DARK, LEAF_LIGHT, LEATHER, LEATHER_DARK, LEATHER_LIGHT, MARBLE, MARBLE_VEIN,
  OAK_LIGHT, VELVET, VELVET_DARK, VELVET_LIGHT, WALNUT, WALNUT_DARK, WALNUT_LIGHT, type Ctx, legs,
} from './shared';

/** Chesterfield: rolled arms, buttoned back, leather (or bottle-green velvet). */
export function drawPohovka(ctx: Ctx, f: Furniture, theme: RoomTheme, x: number, y: number, now: number): number {
  const alt = f.id % 2 === 1;
  const [c, light, dark] = alt ? [VELVET, VELVET_LIGHT, VELVET_DARK] : [LEATHER, LEATHER_LIGHT, LEATHER_DARK];
  r(ctx, x - 14, y - 16, 28, 8, c);
  for (let i = 0; i < 6; i++) r(ctx, x - 11 + i * 4.5, y - 13 + (i % 2), 1, 1, dark);
  r(ctx, x - 14, y - 16, 28, 1, light);
  r(ctx, x - 13, y - 9, 26, 5, light);
  r(ctx, x - 0.5, y - 9, 1, 5, dark);
  r(ctx, x - 13, y - 4, 26, 1, dark);
  for (const sx of [-1, 1]) {
    const ax = x + sx * 15;
    r(ctx, ax - 3, y - 12, 6, 9, c);
    r(ctx, ax - 3, y - 13, 6, 2, light);
    r(ctx, ax - 2, y - 14, 4, 1, light);
    r(ctx, ax - 3, y - 4, 6, 1, dark);
  }
  r(ctx, x - 16, y - 3, 2, 3, WALNUT_DARK);
  r(ctx, x + 14, y - 3, 2, 3, WALNUT_DARK);
  return y - 16;
}

/** Floor lamp: round base, brass pole, silk shade with a fringe, warm glow. */
export function drawLampa(ctx: Ctx, f: Furniture, theme: RoomTheme, x: number, y: number, now: number): number {
  ctx.fillStyle = 'rgba(255,224,150,0.14)';
  ctx.beginPath();
  ctx.arc(x, y - 22, 9, 0, Math.PI * 2);
  ctx.fill();
  r(ctx, x - 4, y - 2, 8, 2, BRASS_DARK);
  r(ctx, x - 2, y - 3, 4, 1, BRASS);
  r(ctx, x - 0.5, y - 24, 1, 21, BRASS);
  r(ctx, x - 1, y - 14, 2, 1, BRASS_DARK);
  poly(ctx, [[x - 3, y - 31], [x + 3, y - 31], [x + 6, y - 24], [x - 6, y - 24]], '#e0b870');
  r(ctx, x - 3, y - 31, 6, 1, '#f0d090');
  r(ctx, x - 6, y - 24, 12, 1, '#b8863e');
  for (let i = 0; i < 6; i++) r(ctx, x - 6 + i * 2, y - 23, 1, 2, '#b8863e');
  r(ctx, x - 4, y - 22, 8, 1, '#fff2c0');
  return y - 31;
}

/** Oil painting in a gilt frame above a low walnut sideboard with a vase. */
export function drawObraz(ctx: Ctx, f: Furniture, theme: RoomTheme, x: number, y: number, now: number): number {
  r(ctx, x - 10, y - 37, 20, 15, '#b8903e');
  r(ctx, x - 10, y - 37, 20, 1, '#e8c86a');
  r(ctx, x - 10, y - 37, 1, 15, '#e8c86a');
  r(ctx, x - 8, y - 35, 16, 11, '#6a8aa0');
  r(ctx, x - 8, y - 29, 16, 5, '#5a6a3a');
  poly(ctx, [[x - 8, y - 29], [x - 3, y - 32], [x + 2, y - 29]], '#4a5a34');
  poly(ctx, [[x - 1, y - 29], [x + 4, y - 31], [x + 8, y - 29]], '#6a7a44');
  r(ctx, x + 4, y - 34, 2, 2, '#f0e0a0');
  r(ctx, x - 7, y - 27, 1, 3, '#3a2a1a');
  for (const [cx, cy] of [[-10, -37], [9, -37], [-10, -23], [9, -23]] as const) r(ctx, x + cx, y + cy, 1, 1, '#fff0b0');
  // sideboard
  r(ctx, x - 11, y - 11, 22, 2, WALNUT_LIGHT);
  r(ctx, x - 10, y - 9, 20, 7, WALNUT);
  r(ctx, x - 0.5, y - 9, 1, 7, WALNUT_DARK);
  r(ctx, x - 3, y - 6, 1, 1, BRASS);
  r(ctx, x + 2, y - 6, 1, 1, BRASS);
  legs(ctx, x, y, 10, 2, WALNUT_DARK);
  r(ctx, x + 5, y - 16, 3, 5, '#2a5a7a');
  r(ctx, x + 5.5, y - 17, 2, 1, '#2a5a7a');
  return y - 37;
}

/** Art-deco wardrobe: rounded shoulders, book-matched veneer panels, bar handles, stepped plinth. */
export function drawSkrin(ctx: Ctx, f: Furniture, theme: RoomTheme, x: number, y: number, now: number): number {
  r(ctx, x - 9, y - 34, 18, 1, WALNUT_LIGHT);
  r(ctx, x - 10, y - 33, 20, 1, WALNUT_LIGHT);
  r(ctx, x - 11, y - 32, 22, 29, WALNUT);
  for (const sx of [-1, 1]) {
    const px = sx < 0 ? x - 9 : x + 1;
    r(ctx, px, y - 30, 8, 25, WALNUT_LIGHT);
    for (let i = 0; i < 4; i++) {
      const vx = sx < 0 ? px + 7 - i * 2 : px + i * 2;
      r(ctx, vx, y - 28 + i * 5, 1, 4, WALNUT);
    }
  }
  r(ctx, x - 0.5, y - 32, 1, 29, WALNUT_DARK);
  r(ctx, x - 3, y - 20, 1, 5, '#d8d8d0');
  r(ctx, x + 2, y - 20, 1, 5, '#d8d8d0');
  r(ctx, x - 11, y - 3, 22, 1, WALNUT_DARK);
  r(ctx, x - 9, y - 2, 18, 2, WALNUT_DARK);
  return y - 34;
}

/** Horn gramophone on a small table. */
export function drawGramofon(ctx: Ctx, f: Furniture, theme: RoomTheme, x: number, y: number, now: number): number {
  r(ctx, x - 9, y - 11, 18, 2, WALNUT_LIGHT);
  legs(ctx, x, y, 8, 9, WALNUT_DARK);
  r(ctx, x - 6, y - 17, 12, 6, WALNUT);
  r(ctx, x - 6, y - 17, 12, 1, WALNUT_LIGHT);
  r(ctx, x - 3, y - 14, 2, 2, BRASS);
  r(ctx, x + 6, y - 15, 2, 1, BRASS);
  r(ctx, x - 5, y - 18, 9, 1, INK);
  // the horn rises from the sound box and flares up and to the left
  poly(ctx, [[x + 1, y - 17], [x + 5, y - 17], [x + 3, y - 24], [x - 3, y - 32], [x - 10, y - 31], [x - 2, y - 25]], BRASS);
  line(ctx, x + 3, y - 18, x - 4, y - 29, '#f0d888');
  poly(ctx, [[x - 3, y - 32], [x - 10, y - 31], [x - 10, y - 34], [x - 5, y - 35]], BRASS_DARK);
  r(ctx, x - 8, y - 34, 3, 2, '#4a3a1a');
  return y - 35;
}

/** Palm or aspidistra in a glazed pot on a tall plant stand. */
export function drawKvetina(ctx: Ctx, f: Furniture, theme: RoomTheme, x: number, y: number, now: number): number {
  const alt = f.id % 2 === 1;
  r(ctx, x - 4, y - 2, 8, 2, WALNUT_DARK);
  r(ctx, x - 1, y - 11, 2, 9, WALNUT);
  r(ctx, x - 5, y - 12, 10, 1, WALNUT_LIGHT);
  r(ctx, x - 4, y - 17, 8, 5, alt ? '#2a6a6a' : '#8a3a2a');
  r(ctx, x - 5, y - 18, 10, 1, alt ? '#3a8a8a' : '#a84a32');
  r(ctx, x - 3, y - 15, 6, 1, '#d8c890');
  if (alt) {
    // kentia palm: arching fronds
    for (const [dx, dy] of [[-10, -24], [-7, -30], [0, -33], [7, -30], [10, -24]] as const) {
      line(ctx, x, y - 18, x + dx, y + dy, LEAF);
      line(ctx, x + dx * 0.5, y - 18 + (dy + 18) * 0.5 - 1, x + dx * 0.9, y + dy + 2, LEAF_LIGHT);
    }
    return y - 33;
  }
  // aspidistra: broad upright leaves
  for (const [dx, h] of [[-5, 10], [-2, 13], [1, 14], [4, 11], [6, 8]] as const) {
    poly(ctx, [[x + dx * 0.4, y - 18], [x + dx - 1, y - 18 - h * 0.6], [x + dx, y - 18 - h], [x + dx + 1, y - 18 - h * 0.6]], dx % 2 === 0 ? LEAF_DARK : LEAF);
  }
  r(ctx, x - 2, y - 28, 1, 3, LEAF_LIGHT);
  return y - 32;
}

/** Marble fireplace with a mantel clock. */
export function drawKrb(ctx: Ctx, f: Furniture, theme: RoomTheme, x: number, y: number, now: number): number {
  r(ctx, x - 15, y - 21, 30, 3, MARBLE);
  r(ctx, x - 15, y - 18, 30, 1, MARBLE_VEIN);
  r(ctx, x - 13, y - 18, 26, 18, MARBLE);
  line(ctx, x - 12, y - 16, x - 9, y - 4, MARBLE_VEIN);
  line(ctx, x + 10, y - 17, x + 12, y - 6, MARBLE_VEIN);
  r(ctx, x - 8, y - 15, 16, 15, '#1a1210');
  r(ctx, x - 9, y - 16, 18, 1, BRASS_DARK);
  const flick = Math.sin(now * 13 + f.x) + Math.sin(now * 7.3);
  const h = 6 + Math.round(flick * 1.2);
  r(ctx, x - 5, y - 3, 10, 2, WALNUT_DARK);
  r(ctx, x - 4, y - 3 - h, 8, h, '#e8622a');
  r(ctx, x - 2, y - 3 - h + 2, 4, h - 2, '#f0b33a');
  r(ctx, x - 1, y - 3 - Math.max(1, h - 4), 2, Math.max(1, h - 4), '#fff2a8');
  r(ctx, x - 14, y - 1, 28, 1, MARBLE_VEIN);
  // mantel clock: art-deco arched case
  r(ctx, x - 5, y - 25, 10, 4, WALNUT);
  r(ctx, x - 3, y - 27, 6, 2, WALNUT);
  disc(ctx, x, y - 24, 2, CREAM);
  r(ctx, x, y - 25, 1, 1, INK);
  return y - 27;
}

/** Kitchen dresser: cream-painted, glazed upper cabinet with plates, worktop, lower doors. */
export function drawKredenc(ctx: Ctx, f: Furniture, theme: RoomTheme, x: number, y: number, now: number): number {
  const paint = '#d8d2b0', paintDark = '#a8a080', paintLight = '#ece6c8';
  r(ctx, x - 10, y - 34, 20, 2, paintLight);
  r(ctx, x - 9, y - 32, 18, 14, paint);
  r(ctx, x - 8, y - 31, 16, 12, '#b8ccc8');
  for (const px of [-5, 0, 5]) {
    disc(ctx, x + px, y - 27, 2, '#f8f8f4');
    r(ctx, x + px, y - 27, 1, 1, '#3a5a9a');
  }
  r(ctx, x - 8, y - 23, 16, 1, paintDark);
  for (const cx of [-5, -2, 1, 4]) r(ctx, x + cx, y - 22, 2, 2, cx === -2 ? '#c84a3a' : '#f8f8f4');
  r(ctx, x - 0.5, y - 31, 1, 12, paint);
  r(ctx, x - 11, y - 18, 22, 2, OAK_LIGHT);
  r(ctx, x - 10, y - 16, 20, 14, paint);
  r(ctx, x - 9, y - 15, 18, 3, paintLight);
  r(ctx, x - 9, y - 11, 8, 8, paintLight);
  r(ctx, x + 1, y - 11, 8, 8, paintLight);
  r(ctx, x - 2, y - 7, 1, 2, BRASS_DARK);
  r(ctx, x + 1, y - 7, 1, 2, BRASS_DARK);
  r(ctx, x - 1, y - 14, 2, 1, BRASS_DARK);
  r(ctx, x - 10, y - 2, 20, 2, paintDark);
  return y - 34;
}
