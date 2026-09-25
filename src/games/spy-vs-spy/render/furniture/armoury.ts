import type { Furniture, RoomTheme } from '../../logic/state';
import { line, poly, r } from '../draw';
import { BRASS, BRASS_DARK, IRON_LIGHT, WALNUT, WALNUT_DARK, WALNUT_LIGHT, type Ctx } from './shared';

const GLASS = '#34464e';
const GLASS_SHINE = '#6a8a94';
const STOCK = '#9a6234';
const STOCK_LIGHT = '#c08048';
const STEEL = '#a4acb2';
const CREST_RED = '#a8241e';

/**
 * Round 6 §4, the armoury cabinet (zbrojní skříň): a tall dark-walnut gun cabinet with a glazed door, three rifles
 * standing in the rack behind the glass, a drawer below and a small brass-rimmed crest on the cornice. Same scale as
 * the other tall wall pieces (skříň, kredenc).
 */
export function drawZbrojnice(ctx: Ctx, f: Furniture, theme: RoomTheme, x: number, y: number, now: number): number {
  // cornice with the crest on top
  r(ctx, x - 11, y - 35, 22, 2, WALNUT_LIGHT);
  r(ctx, x - 10, y - 33, 20, 1, WALNUT_DARK);
  poly(ctx, [[x - 3, y - 40], [x + 3, y - 40], [x + 3, y - 37], [x, y - 35], [x - 3, y - 37]], BRASS_DARK);
  poly(ctx, [[x - 2, y - 39], [x + 2, y - 39], [x + 2, y - 37.5], [x, y - 36], [x - 2, y - 37.5]], CREST_RED);
  r(ctx, x - 0.5, y - 39, 1, 3, BRASS);
  // carcass
  r(ctx, x - 10, y - 32, 20, 30, WALNUT_DARK);
  r(ctx, x - 9, y - 32, 18, 30, WALNUT);
  // glazed door: frame, glass, the rifles behind it
  r(ctx, x - 8, y - 31, 16, 20, WALNUT_DARK);
  r(ctx, x - 7, y - 30, 14, 18, GLASS);
  for (const dx of [-4, 0, 4]) {
    const gx = x + dx;
    r(ctx, gx, y - 29, 1, 10, STEEL); // barrel
    r(ctx, gx - 0.5, y - 20, 2, 3, IRON_LIGHT); // lock
    poly(ctx, [[gx - 1, y - 17], [gx + 1.5, y - 17], [gx + 2, y - 13], [gx - 1.5, y - 13]], STOCK); // butt
    r(ctx, gx - 1, y - 17, 1, 3, STOCK_LIGHT);
  }
  r(ctx, x - 7, y - 26, 14, 1, WALNUT_LIGHT); // the rack bar holding the barrels
  line(ctx, x - 6, y - 29, x - 3, y - 24, GLASS_SHINE);
  line(ctx, x - 5, y - 29, x - 2, y - 24, GLASS_SHINE);
  r(ctx, x + 6, y - 22, 1, 3, BRASS); // key escutcheon
  // drawer and plinth
  r(ctx, x - 8, y - 10, 16, 6, WALNUT_LIGHT);
  r(ctx, x - 8, y - 10, 16, 1, WALNUT);
  r(ctx, x - 2, y - 8, 4, 1, BRASS);
  r(ctx, x - 10, y - 3, 20, 1, WALNUT_DARK);
  r(ctx, x - 9, y - 2, 18, 2, WALNUT_DARK);
  return y - 40;
}
