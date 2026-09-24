import type { Furniture, RoomTheme } from '../../logic/state';
import { disc, line, poly, r } from '../draw';
import { BRASS, BRASS_DARK, CREAM, INK, IRON, IRON_LIGHT, OAK, OAK_DARK, OAK_LIGHT, WALNUT, WALNUT_DARK, WALNUT_LIGHT, type Ctx, legs } from './shared';

/** Writing desk: top, drawer pedestal, legs; on it a typewriter, a cipher machine or a banker's lamp. */
export function drawStul(ctx: Ctx, f: Furniture, theme: RoomTheme, x: number, y: number, now: number): number {
  r(ctx, x - 14, y - 13, 28, 2, OAK_LIGHT);
  r(ctx, x - 14, y - 11, 28, 1, OAK_DARK);
  r(ctx, x - 13, y - 10, 10, 10, OAK);
  for (const dy of [-9, -6, -3]) {
    r(ctx, x - 12, y + dy, 8, 2, OAK_LIGHT);
    r(ctx, x - 9, y + dy + 1, 2, 1, BRASS);
  }
  r(ctx, x - 3, y - 10, 15, 2, OAK);
  r(ctx, x + 10, y - 10, 2, 10, OAK_DARK);
  if (theme === 'kancelar') return typewriter(ctx, x + 2, y - 13);
  if (theme === 'sifrovna') return cipherMachine(ctx, x + 2, y - 13);
  if (theme === 'kuchynka') return coffeePot(ctx, x + 3, y - 13);
  return bankersLamp(ctx, x + 5, y - 13);
}

/** Glazed bookcase, dark wood, cornice and plinth. */
export function drawKnihovna(ctx: Ctx, f: Furniture, theme: RoomTheme, x: number, y: number, now: number): number {
  r(ctx, x - 11, y - 33, 22, 2, WALNUT_LIGHT);
  r(ctx, x - 10, y - 31, 20, 31, WALNUT);
  r(ctx, x - 10, y - 3, 20, 3, WALNUT_DARK);
  const spines = ['#7a2a2a', '#2a4a6a', '#8a6a2a', '#3a5a3a', '#5a3a5a', '#6a4a2a'];
  for (let i = 0; i < 3; i++) {
    const sy = y - 29 + i * 9;
    r(ctx, x - 8, sy, 16, 8, WALNUT_DARK);
    for (let j = 0; j < 6; j++) {
      const h = j % 3 === 1 ? 5 : 6;
      r(ctx, x - 8 + j * 2.6, sy + 8 - h, 2, h, spines[(i * 2 + j) % spines.length]);
    }
    r(ctx, x - 8, sy + 8, 16, 1, WALNUT_LIGHT);
  }
  // glass doors: mullions and a diagonal sheen
  r(ctx, x - 0.5, y - 30, 1, 27, WALNUT_LIGHT);
  for (let i = 0; i < 5; i++) r(ctx, x - 7 + i, y - 27 + i * 2, 1, 1, '#d8eef4');
  for (let i = 0; i < 4; i++) r(ctx, x + 3 + i, y - 20 + i * 2, 1, 1, '#d8eef4');
  r(ctx, x - 2, y - 16, 1, 1, BRASS);
  r(ctx, x + 1, y - 16, 1, 1, BRASS);
  return y - 33;
}

/** Cast-iron safe with a brass dial, handle and a gilt border, on a plinth. */
export function drawTrezor(ctx: Ctx, f: Furniture, theme: RoomTheme, x: number, y: number, now: number): number {
  r(ctx, x - 9, y - 19, 18, 17, IRON);
  r(ctx, x - 9, y - 19, 18, 1, IRON_LIGHT);
  r(ctx, x - 8, y - 17, 16, 13, '#35353a');
  r(ctx, x - 7, y - 16, 14, 1, BRASS_DARK);
  r(ctx, x - 7, y - 6, 14, 1, BRASS_DARK);
  r(ctx, x - 7, y - 16, 1, 11, BRASS_DARK);
  r(ctx, x + 6, y - 16, 1, 11, BRASS_DARK);
  // brass combination dial with a moving index, and a T handle
  disc(ctx, x - 2, y - 11, 3, BRASS);
  disc(ctx, x - 2, y - 11, 2, '#1e1e22');
  r(ctx, x - 2, y - 11, 1, 1, BRASS);
  const tick = Math.floor(now * 0.5 + f.x) % 4;
  r(ctx, x - 2 + [0, 2, 0, -2][tick], y - 11 + [-2, 0, 2, 0][tick], 1, 1, '#f0d888');
  r(ctx, x + 3, y - 14, 1, 6, BRASS);
  r(ctx, x + 2, y - 14, 3, 1, BRASS);
  r(ctx, x + 2, y - 9, 3, 1, BRASS);
  r(ctx, x - 10, y - 2, 20, 2, IRON_LIGHT);
  return y - 19;
}

/** Oak filing cabinet: four drawers with brass label holders and cup pulls. */
export function drawKartoteka(ctx: Ctx, f: Furniture, theme: RoomTheme, x: number, y: number, now: number): number {
  r(ctx, x - 8, y - 25, 16, 25, OAK);
  r(ctx, x - 8, y - 25, 16, 1, OAK_LIGHT);
  for (let i = 0; i < 4; i++) {
    const dy = y - 23 + i * 6;
    r(ctx, x - 7, dy, 14, 5, OAK_LIGHT);
    r(ctx, x - 7, dy + 5, 14, 1, OAK_DARK);
    r(ctx, x - 3, dy + 1, 6, 2, BRASS);
    r(ctx, x - 2, dy + 1.5, 4, 1, CREAM);
    r(ctx, x - 1, dy + 3, 2, 1, BRASS_DARK);
  }
  return y - 25;
}

/** Floor globe in a wooden stand with a brass meridian, antique colours. */
export function drawGlobus(ctx: Ctx, f: Furniture, theme: RoomTheme, x: number, y: number, now: number): number {
  r(ctx, x - 7, y - 2, 3, 2, WALNUT_DARK);
  r(ctx, x + 4, y - 2, 3, 2, WALNUT_DARK);
  line(ctx, x - 5, y - 2, x - 1, y - 9, WALNUT);
  line(ctx, x + 5, y - 2, x + 1, y - 9, WALNUT);
  r(ctx, x - 1, y - 12, 2, 4, WALNUT);
  r(ctx, x - 8, y - 13, 16, 1, WALNUT_LIGHT);
  disc(ctx, x, y - 20, 6, '#9ab4b0');
  r(ctx, x - 4, y - 23, 3, 2, '#c8a860');
  r(ctx, x - 2, y - 21, 2, 4, '#c8a860');
  r(ctx, x + 1, y - 19, 4, 3, '#9a6a3a');
  r(ctx, x + 2, y - 24, 2, 2, '#c8a860');
  for (let a = 0; a < 12; a++) {
    const ang = -Math.PI / 2 + ((a - 5.5) / 12) * Math.PI * 1.2;
    r(ctx, Math.round(x + Math.cos(ang) * 7 - 0.5), Math.round(y - 20 + Math.sin(ang) * 7), 1, 1, BRASS);
  }
  return y - 27;
}

/** Candlestick telephone on a round side table. */
export function drawTelefon(ctx: Ctx, f: Furniture, theme: RoomTheme, x: number, y: number, now: number): number {
  r(ctx, x - 6, y - 13, 12, 2, WALNUT_LIGHT);
  r(ctx, x - 6, y - 11, 12, 1, WALNUT_DARK);
  r(ctx, x - 1, y - 10, 2, 8, WALNUT);
  r(ctx, x - 4, y - 2, 8, 2, WALNUT_DARK);
  r(ctx, x - 3, y - 15, 6, 2, INK);
  r(ctx, x - 0.5, y - 24, 1, 9, INK);
  poly(ctx, [[x - 1, y - 24], [x + 3, y - 27], [x + 3, y - 23]], INK);
  r(ctx, x - 1, y - 25, 2, 1, BRASS);
  // receiver hanging on its hook, with the cord
  r(ctx, x - 1, y - 21, 3, 1, INK);
  r(ctx, x - 4, y - 22, 2, 6, INK);
  r(ctx, x - 4, y - 22, 2, 1, BRASS);
  line(ctx, x - 3, y - 16, x - 5, y - 12, '#3a3a3a');
  return y - 27;
}

/** Arched wooden valve radio ("cathedral") on a side table; the dial glows while the valves warm. */
export function drawRadio(ctx: Ctx, f: Furniture, theme: RoomTheme, x: number, y: number, now: number): number {
  r(ctx, x - 8, y - 9, 16, 2, WALNUT_LIGHT);
  legs(ctx, x, y, 7, 7, WALNUT_DARK);
  r(ctx, x - 7, y - 20, 14, 11, WALNUT);
  r(ctx, x - 6, y - 22, 12, 2, WALNUT);
  r(ctx, x - 4, y - 24, 8, 2, WALNUT);
  r(ctx, x - 4, y - 24, 8, 1, WALNUT_LIGHT);
  // cloth grille with gothic fretwork
  r(ctx, x - 4, y - 21, 8, 7, '#c8b890');
  r(ctx, x - 3, y - 22, 6, 1, '#c8b890');
  for (const fx of [-2, 0.5, 3]) r(ctx, x + fx - 0.5, y - 21, 1, 7, WALNUT_DARK);
  const lit = 0.7 + 0.3 * Math.sin(now * 2 + f.x);
  r(ctx, x - 3, y - 13, 6, 2, lit > 0.8 ? '#ffd070' : '#e8b050');
  r(ctx, x - 2 + (Math.floor(now * 0.7) % 4), y - 13, 1, 2, '#8a2a1a');
  disc(ctx, x - 5, y - 11, 1, WALNUT_DARK);
  disc(ctx, x + 5, y - 11, 1, WALNUT_DARK);
  return y - 24;
}

/** Black typewriter with a sheet of paper; returns the new top. */
function typewriter(ctx: Ctx, x: number, y: number): number {
  r(ctx, x - 5, y - 4, 10, 4, INK);
  r(ctx, x - 6, y - 5, 12, 1, '#3a3a3a');
  r(ctx, x - 3, y - 9, 6, 4, CREAM);
  for (const ky of [-3, -1.5]) for (let i = 0; i < 4; i++) r(ctx, x - 4 + i * 2.5, y + ky, 1, 1, '#b8b8b8');
  r(ctx, x + 6, y - 5, 1, 1, '#c8c8c8');
  return y - 9;
}

/** Wooden cipher machine: lamp board, keys and rotor wheels; returns the new top. */
function cipherMachine(ctx: Ctx, x: number, y: number): number {
  r(ctx, x - 6, y - 5, 12, 5, OAK_DARK);
  r(ctx, x - 5, y - 5, 10, 2, '#2a2a2a');
  for (let i = 0; i < 5; i++) r(ctx, x - 4 + i * 2, y - 4.5, 1, 1, i === 2 ? '#ffe070' : '#8a8a6a');
  for (let i = 0; i < 5; i++) r(ctx, x - 4 + i * 2, y - 2, 1, 1, '#d8d8d0');
  for (const wx of [-2, 0, 2]) r(ctx, x + wx - 0.5, y - 7, 1, 2, '#9a9aa0');
  r(ctx, x - 7, y - 8, 1, 8, OAK);
  return y - 8;
}

/** Green-shaded banker's lamp on a brass stem; returns the new top. */
function bankersLamp(ctx: Ctx, x: number, y: number): number {
  r(ctx, x - 3, y - 1, 6, 1, BRASS_DARK);
  r(ctx, x - 0.5, y - 5, 1, 4, BRASS);
  poly(ctx, [[x - 5, y - 5], [x + 5, y - 5], [x + 4, y - 8], [x - 4, y - 8]], '#1f6a3a');
  r(ctx, x - 3, y - 8, 6, 1, '#3a9a5a');
  r(ctx, x - 4, y - 5, 8, 1, '#fff2b0');
  return y - 8;
}

/** Enamel coffee pot on a checked tablecloth (kitchen table); returns the new top. */
function coffeePot(ctx: Ctx, x: number, y: number): number {
  for (let i = 0; i < 14; i++) r(ctx, x - 17 + i * 2, y, 2, 2, i % 2 === 0 ? '#c83a3a' : '#f4f0e8');
  r(ctx, x - 2, y - 6, 5, 6, '#e8e4d8');
  r(ctx, x - 1, y - 7, 3, 1, '#2a4a8a');
  r(ctx, x + 3, y - 5, 1, 3, '#e8e4d8');
  r(ctx, x - 3, y - 5, 1, 2, '#e8e4d8');
  return y - 7;
}
