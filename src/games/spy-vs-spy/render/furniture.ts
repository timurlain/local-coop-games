import type { Furniture, RoomTheme } from '../logic/state';
import { disc, line, poly, r, withScale } from './draw';
import { VIEW, wallX } from './geometry';

type Ctx = CanvasRenderingContext2D;

/** 1930s materials. */
const OAK = '#9a6a3a';
const OAK_LIGHT = '#b8844a';
const OAK_DARK = '#6e4724';
const WALNUT = '#5e3a20';
const WALNUT_LIGHT = '#7a4e2c';
const WALNUT_DARK = '#3a2212';
const BRASS = '#d4b050';
const BRASS_DARK = '#8a6a24';
const IRON = '#2c2c30';
const IRON_LIGHT = '#48484e';
const CREAM = '#efe4c4';
const INK = '#161616';
const LEATHER = '#6e2a1e';
const LEATHER_LIGHT = '#8e3a28';
const LEATHER_DARK = '#4a1a12';
const VELVET = '#2f5a40';
const VELVET_LIGHT = '#3f7250';
const VELVET_DARK = '#1f3e2c';
const MARBLE = '#e6e2da';
const MARBLE_VEIN = '#b8b2a8';
const ENAMEL_RED = '#b8241e';
const ENAMEL_WHITE = '#f2f0e8';
const LEAF = '#3f7a3a';
const LEAF_LIGHT = '#5a9a48';
const LEAF_DARK = '#2a5a2a';

/** Draws one piece standing against the back wall, scaled with the wall (pieces are authored at 1 px per logic unit). */
export function drawFurniture(ctx: Ctx, f: Furniture, theme: RoomTheme, highlight: boolean, now: number): void {
  const x = wallX(f.x);
  const y = VIEW.backY;
  withScale(x, y, VIEW.scale, () => drawPiece(ctx, f, theme, x, y, highlight, now));
}

/** Small turned leg pair under a table top. */
function legs(ctx: Ctx, x: number, y: number, half: number, h: number, color: string): void {
  r(ctx, x - half, y - h, 2, h, color);
  r(ctx, x + half - 2, y - h, 2, h, color);
}

function drawPiece(ctx: Ctx, f: Furniture, theme: RoomTheme, x: number, y: number, highlight: boolean, now: number): void {
  let top = y;
  const alt = f.id % 2 === 1;
  switch (f.kind) {
    case 'stul': {
      // writing desk: top, drawer pedestal, legs; on it a typewriter, a cipher machine or a banker's lamp
      r(ctx, x - 14, y - 13, 28, 2, OAK_LIGHT);
      r(ctx, x - 14, y - 11, 28, 1, OAK_DARK);
      r(ctx, x - 13, y - 10, 10, 10, OAK);
      for (const dy of [-9, -6, -3]) {
        r(ctx, x - 12, y + dy, 8, 2, OAK_LIGHT);
        r(ctx, x - 9, y + dy + 1, 2, 1, BRASS);
      }
      r(ctx, x - 3, y - 10, 15, 2, OAK);
      r(ctx, x + 10, y - 10, 2, 10, OAK_DARK);
      top = y - 13;
      if (theme === 'kancelar') top = typewriter(ctx, x + 2, y - 13);
      else if (theme === 'sifrovna') top = cipherMachine(ctx, x + 2, y - 13);
      else if (theme === 'kuchynka') top = coffeePot(ctx, x + 3, y - 13);
      else top = bankersLamp(ctx, x + 5, y - 13);
      break;
    }
    case 'knihovna': {
      // glazed bookcase, dark wood, cornice and plinth
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
      top = y - 33;
      break;
    }
    case 'lampa': {
      // floor lamp: round base, brass pole, silk shade with a fringe, warm glow
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
      top = y - 31;
      break;
    }
    case 'pohovka': {
      // chesterfield: rolled arms, buttoned back, leather (or bottle-green velvet)
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
      top = y - 16;
      break;
    }
    case 'trezor': {
      // cast-iron safe with a brass dial, handle and a gilt border, on a plinth
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
      top = y - 19;
      break;
    }
    case 'obraz': {
      // oil painting in a gilt frame above a low walnut sideboard with a vase
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
      top = y - 37;
      break;
    }
    case 'skrin': {
      // art-deco wardrobe: rounded shoulders, book-matched veneer panels, bar handles, stepped plinth
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
      top = y - 34;
      break;
    }
    case 'kartoteka': {
      // oak filing cabinet: four drawers with brass label holders and cup pulls
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
      top = y - 25;
      break;
    }
    case 'gramofon': {
      // horn gramophone on a small table
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
      top = y - 35;
      break;
    }
    case 'globus': {
      // floor globe in a wooden stand with a brass meridian, antique colours
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
      top = y - 27;
      break;
    }
    case 'kredenc': {
      // kitchen dresser: cream-painted, glazed upper cabinet with plates, worktop, lower doors
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
      top = y - 34;
      break;
    }
    case 'radio': {
      // arched wooden valve radio ("cathedral") on a side table; the dial glows while the valves warm
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
      top = y - 24;
      break;
    }
    case 'kvetina': {
      // palm or aspidistra in a glazed pot on a tall plant stand
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
        top = y - 33;
      } else {
        // aspidistra: broad upright leaves
        for (const [dx, h] of [[-5, 10], [-2, 13], [1, 14], [4, 11], [6, 8]] as const) {
          poly(ctx, [[x + dx * 0.4, y - 18], [x + dx - 1, y - 18 - h * 0.6], [x + dx, y - 18 - h], [x + dx + 1, y - 18 - h * 0.6]], dx % 2 === 0 ? LEAF_DARK : LEAF);
        }
        r(ctx, x - 2, y - 28, 1, 3, LEAF_LIGHT);
        top = y - 32;
      }
      break;
    }
    case 'krb': {
      // marble fireplace with a mantel clock
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
      top = y - 27;
      break;
    }
    case 'telefon': {
      // candlestick telephone on a round side table
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
      top = y - 27;
      break;
    }
    case 'vesak': {
      // bentwood (Thonet) coat stand with a black umbrella and a bowler hat
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
      top = y - 34;
      break;
    }
    case 'hasicak': {
      // red enamel fire cabinet with a brass rim; a fire bucket behind the glass
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
      top = y - 23;
      break;
    }
    case 'naradi': {
      // wooden toolbox (open tote) with iron corners and handle; pliers sticking out
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
      top = y - 20;
      break;
    }
    case 'lekarnicka': {
      // white enamel first-aid cabinet with a red cross
      r(ctx, x - 8, y - 23, 16, 17, '#c8c6be');
      r(ctx, x - 7, y - 22, 14, 15, ENAMEL_WHITE);
      r(ctx, x - 7, y - 22, 14, 1, '#ffffff');
      r(ctx, x - 1.5, y - 20, 3, 10, '#d02a2a');
      r(ctx, x - 5, y - 16.5, 10, 3, '#d02a2a');
      r(ctx, x + 5, y - 15, 1, 2, '#9a9a94');
      r(ctx, x - 7, y - 8, 14, 1, '#a8a69e');
      top = y - 23;
      break;
    }
  }
  if (highlight) {
    r(ctx, x - 2, top - 5, 5, 1, '#ffffff');
    r(ctx, x - 1, top - 4, 3, 1, '#ffffff');
    r(ctx, x, top - 3, 1, 1, '#ffffff');
  }
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
