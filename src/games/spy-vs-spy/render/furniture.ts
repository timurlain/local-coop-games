import type { Furniture } from '../logic/state';
import { disc, line, r } from './draw';
import { VIEW } from './geometry';

type Ctx = CanvasRenderingContext2D;

export function drawFurniture(ctx: Ctx, f: Furniture, highlight: boolean, now: number): void {
  const x = VIEW.backLeft + f.x;
  const y = VIEW.backY;
  let top = y;
  switch (f.kind) {
    case 'stul':
      r(ctx, x - 12, y - 12, 24, 3, '#8b5a2b');
      r(ctx, x - 8, y - 9, 16, 4, '#7a4e25');
      r(ctx, x - 11, y - 9, 2, 9, '#6b4220');
      r(ctx, x + 9, y - 9, 2, 9, '#6b4220');
      top = y - 12;
      break;
    case 'knihovna':
      r(ctx, x - 10, y - 30, 20, 30, '#6b4220');
      for (let i = 0; i < 3; i++) {
        const sy = y - 28 + i * 9;
        r(ctx, x - 8, sy, 16, 7, '#3b2618');
        ['#d23c3c', '#3a78d8', '#e8c547', '#3fa34d'].forEach((c, j) => r(ctx, x - 7 + j * 4, sy + 1, 3, 6, c));
      }
      top = y - 30;
      break;
    case 'lampa':
      r(ctx, x - 1, y - 22, 2, 22, '#9a9a9a');
      r(ctx, x - 4, y - 2, 8, 2, '#9a9a9a');
      r(ctx, x - 6, y - 29, 12, 7, '#e8c547');
      r(ctx, x - 5, y - 22, 10, 1, '#fff6c0');
      top = y - 29;
      break;
    case 'pohovka':
      r(ctx, x - 14, y - 16, 28, 7, '#a33b3b');
      r(ctx, x - 14, y - 10, 28, 8, '#c24848');
      r(ctx, x - 16, y - 13, 4, 11, '#8a2f2f');
      r(ctx, x + 12, y - 13, 4, 11, '#8a2f2f');
      r(ctx, x - 13, y - 2, 2, 2, '#3b2618');
      r(ctx, x + 11, y - 2, 2, 2, '#3b2618');
      top = y - 16;
      break;
    case 'trezor':
      r(ctx, x - 8, y - 16, 16, 16, '#707880');
      r(ctx, x - 7, y - 15, 14, 14, '#8a939c');
      r(ctx, x - 2, y - 10, 4, 4, '#2a2a2a');
      r(ctx, x + 4, y - 9, 2, 2, '#e8c547');
      top = y - 16;
      break;
    case 'obraz':
      r(ctx, x - 9, y - 36, 18, 13, '#c9a36b');
      r(ctx, x - 7, y - 34, 14, 9, '#6cc6e8');
      r(ctx, x - 7, y - 28, 14, 3, '#3fa34d');
      r(ctx, x - 6, y - 12, 12, 12, '#6b4220');
      r(ctx, x - 5, y - 11, 10, 2, '#8b5a2b');
      top = y - 36;
      break;
    case 'skrin':
      r(ctx, x - 10, y - 32, 20, 32, '#5a3a1e');
      r(ctx, x, y - 31, 1, 30, '#3b2618');
      r(ctx, x - 3, y - 17, 2, 2, '#e8c547');
      r(ctx, x + 2, y - 17, 2, 2, '#e8c547');
      top = y - 32;
      break;
    case 'vesak':
      r(ctx, x - 1, y - 30, 2, 30, '#6b4220');
      r(ctx, x - 5, y - 30, 10, 2, '#6b4220');
      r(ctx, x - 6, y - 28, 5, 12, '#3a78d8');
      r(ctx, x - 4, y - 2, 8, 2, '#6b4220');
      top = y - 30;
      break;
    case 'kartoteka':
      r(ctx, x - 8, y - 24, 16, 24, '#6e7780');
      for (let i = 0; i < 3; i++) {
        const dy = y - 23 + i * 8;
        r(ctx, x - 7, dy, 14, 7, '#9aa3ac');
        r(ctx, x - 3, dy + 2, 6, 1, '#d8dde2');
        r(ctx, x - 2, dy + 4, 4, 1, '#3a3f44');
      }
      top = y - 24;
      break;
    case 'televize':
      r(ctx, x - 9, y - 10, 18, 6, '#6b4220');
      r(ctx, x - 8, y - 4, 2, 4, '#4a2e16');
      r(ctx, x + 6, y - 4, 2, 4, '#4a2e16');
      r(ctx, x - 10, y - 24, 20, 14, '#2a2a2e');
      r(ctx, x - 8, y - 22, 13, 10, '#8a9098');
      r(ctx, x - 8, y - 22 + (Math.floor(now * 8) % 10), 13, 1, '#b4bac2');
      r(ctx, x + 6, y - 21, 2, 2, '#c9a36b');
      r(ctx, x + 6, y - 17, 2, 2, '#c9a36b');
      line(ctx, x - 2, y - 24, x - 6, y - 29, '#9a9a9a');
      line(ctx, x + 1, y - 24, x + 5, y - 29, '#9a9a9a');
      top = y - 29;
      break;
    case 'globus':
      r(ctx, x - 5, y - 2, 10, 2, '#6b4220');
      r(ctx, x - 1, y - 11, 2, 9, '#6b4220');
      disc(ctx, x, y - 18, 6, '#3a78d8');
      r(ctx, x - 4, y - 21, 3, 3, '#3fa34d');
      r(ctx, x + 1, y - 18, 3, 4, '#3fa34d');
      r(ctx, x - 3, y - 15, 2, 2, '#3fa34d');
      r(ctx, x - 7, y - 25, 1, 14, '#c9a36b');
      r(ctx, x - 7, y - 25, 4, 1, '#c9a36b');
      r(ctx, x - 7, y - 12, 4, 1, '#c9a36b');
      top = y - 25;
      break;
    case 'lednice':
      r(ctx, x - 8, y - 30, 16, 30, '#b8bcc0');
      r(ctx, x - 7, y - 29, 14, 28, '#eceff1');
      r(ctx, x - 7, y - 19, 14, 1, '#b8bcc0');
      r(ctx, x + 4, y - 27, 1, 6, '#707880');
      r(ctx, x + 4, y - 16, 1, 8, '#707880');
      r(ctx, x - 5, y - 26, 3, 3, '#d23c3c');
      top = y - 30;
      break;
    case 'radio':
      r(ctx, x - 10, y - 7, 20, 7, '#6b5a30');
      r(ctx, x - 9, y - 5, 18, 1, '#4f4222');
      r(ctx, x - 10, y - 20, 20, 13, '#4b5a2a');
      r(ctx, x - 9, y - 19, 18, 11, '#5d6e35');
      r(ctx, x - 8, y - 18, 7, 4, '#e8e0b0');
      r(ctx, x - 7 + (Math.floor(now * 3) % 5), y - 17, 1, 3, '#d23c3c');
      disc(ctx, x - 5, y - 11, 1, '#1e1e1e');
      disc(ctx, x, y - 11, 1, '#1e1e1e');
      for (let i = 0; i < 3; i++) r(ctx, x + 3, y - 18 + i * 3, 5, 1, '#2f3a18');
      line(ctx, x + 7.5, y - 20, x + 9.5, y - 34, '#9a9a9a');
      if (Math.floor(now * 2) % 2 === 0) r(ctx, x + 5, y - 11, 2, 2, '#ff5050');
      top = y - 22;
      break;
    case 'kvetina':
      r(ctx, x - 5, y - 8, 10, 2, '#9c4a22');
      r(ctx, x - 4, y - 6, 8, 6, '#b5562b');
      r(ctx, x - 1, y - 18, 2, 10, '#2f7a3a');
      r(ctx, x - 7, y - 15, 6, 3, '#3fa34d');
      r(ctx, x + 1, y - 19, 6, 3, '#3fa34d');
      r(ctx, x - 6, y - 22, 5, 3, '#4fbf5d');
      r(ctx, x + 1, y - 13, 5, 3, '#4fbf5d');
      r(ctx, x - 2, y - 24, 4, 4, '#3fa34d');
      top = y - 24;
      break;
    case 'krb': {
      r(ctx, x - 14, y - 24, 28, 3, '#e0dcd4');
      r(ctx, x - 12, y - 21, 24, 21, '#9a5a44');
      for (let row = 0; row < 5; row++) {
        r(ctx, x - 12, y - 17 + row * 4, 24, 1, '#7a4434');
        const off = row % 2 === 0 ? 0 : 3;
        for (let c = -12 + off; c < 12; c += 6) r(ctx, x + c, y - 20 + row * 4, 1, 3, '#7a4434');
      }
      r(ctx, x - 7, y - 14, 14, 14, '#1a1010');
      const flick = Math.sin(now * 13 + f.x) + Math.sin(now * 7.3);
      const h = 6 + Math.round(flick * 1.2);
      r(ctx, x - 5, y - 3, 10, 2, '#5a3a1e');
      r(ctx, x - 4, y - 3 - h, 8, h, '#e8622a');
      r(ctx, x - 2, y - 3 - h + 2, 4, h - 2, '#f0b33a');
      r(ctx, x - 1, y - 3 - Math.max(1, h - 4), 2, Math.max(1, h - 4), '#fff2a8');
      top = y - 24;
      break;
    }
  }
  if (highlight) {
    r(ctx, x - 2, top - 5, 5, 1, '#ffffff');
    r(ctx, x - 1, top - 4, 3, 1, '#ffffff');
    r(ctx, x, top - 3, 1, 1, '#ffffff');
  }
}
