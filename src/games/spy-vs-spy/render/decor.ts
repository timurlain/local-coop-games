import type { HostCountry, RoomDecor } from '../logic/state';
import { r, text } from './draw';
import { PICTURES, PICTURE_H, PICTURE_PALETTE, PICTURE_W, type PictureKind } from './decor-data';
import { drawFlag } from './flags';
import { VIEW, wallX } from './geometry';

type Ctx = CanvasRenderingContext2D;

/** Top of the decoration band on the back wall (screen y), above the door frames. */
const TOP = VIEW.wallTop + 1;
const GILT_LIGHT = '#f0d078';
const GILT_DARK = '#8a6a24';
const INK = '#161616';
const DECO_RED = '#b8281e';

/** One wall decoration, centred at `d.x` on the back wall, in native pixels. Visual only. */
export function drawDecor(ctx: Ctx, d: RoomDecor, now: number): void {
  const cx = wallX(d.x);
  if (d.kind.startsWith('vlajka_')) {
    drawFlagOnPole(ctx, d.kind.slice(7) as HostCountry, cx);
    return;
  }
  const kind = d.kind as PictureKind;
  const x0 = Math.round(cx - PICTURE_W / 2);
  const y0 = Math.round(TOP);
  drawPixels(ctx, PICTURES[kind], x0, y0);
  const mid = x0 + PICTURE_W / 2;
  switch (kind) {
    case 'plakat_psst':
      text(ctx, 'PSST!', mid, y0 + 6.2, INK, 3.6, 'center');
      break;
    case 'plakat_tajne':
      text(ctx, 'PŘÍSNĚ', mid, y0 + 4.2, DECO_RED, 2.6, 'center');
      text(ctx, 'TAJNÉ', mid, y0 + 6.8, DECO_RED, 2.6, 'center');
      break;
    case 'hodiny':
      drawClockHands(ctx, x0 + 7, y0 + 4, now);
      break;
  }
}

/** Blits a pixel-art picture, one rect per run of equal pixels. */
function drawPixels(ctx: Ctx, rows: readonly string[], x0: number, y0: number): void {
  for (let y = 0; y < PICTURE_H; y++) {
    const row = rows[y];
    let x = 0;
    while (x < row.length) {
      const ch = row[x];
      let end = x + 1;
      while (end < row.length && row[end] === ch) end++;
      if (ch !== '.') r(ctx, x0 + x, y0 + y, end - x, 1, PICTURE_PALETTE[ch]);
      x = end;
    }
  }
}

/** Minute and hour hands of the wall clock: pixels off the centre, stepping round. */
function drawClockHands(ctx: Ctx, cx: number, cy: number, now: number): void {
  const dirs = [[0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1]] as const;
  const [mx, my] = dirs[Math.floor(now * 0.8) % 8];
  const [hx, hy] = dirs[Math.floor(now * 0.1) % 8];
  r(ctx, cx, cy, 1, 1, INK);
  r(ctx, cx + mx, cy + my, 1, 1, INK);
  r(ctx, cx + mx * 2, cy + my * 2, 1, 1, INK);
  r(ctx, cx + hx, cy + hy, 1, 1, '#5a3a20');
}

/** A small flag on a wall-mounted pole with a gilt finial, drawn at native pixels so the bands stay exact. */
function drawFlagOnPole(ctx: Ctx, host: HostCountry, cx: number): void {
  const px = Math.round(cx - 6);
  const y = Math.round(TOP);
  r(ctx, px, y + 1, 1, 8, '#6b4a20');
  r(ctx, px - 1, y, 3, 1, GILT_LIGHT);
  r(ctx, px - 1, y + 8, 3, 1, GILT_DARK);
  drawFlag(ctx, host, px + 1, y + 1, 12, 6);
}
