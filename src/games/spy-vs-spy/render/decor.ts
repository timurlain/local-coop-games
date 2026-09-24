import type { HostCountry, RoomDecor } from '../logic/state';
import { drawFlag } from './flags';
import { DECOR_W } from '../logic/themes';
import { disc, line, r, text, withScale } from './draw';
import { VIEW, wallX } from './geometry';

type Ctx = CanvasRenderingContext2D;

/** Top of the decoration band on the back wall (screen y); the band is 10 px tall before scaling, above the door frames. */
const TOP = VIEW.wallTop + 1;
const H = 10;

/** One wall decoration, centred at `d.x` on the back wall. Visual only. */
export function drawDecor(ctx: Ctx, d: RoomDecor, now: number): void {
  const cx = wallX(d.x);
  if (d.kind.startsWith('vlajka_')) {
    drawFlagOnPole(ctx, d.kind.slice(7) as HostCountry, cx, now);
    return;
  }
  withScale(cx, TOP, VIEW.scale, () => drawPicture(ctx, d, cx, now));
}

/** Authored at 1 px per logic unit; `drawDecor` scales it with the wall. */
function drawPicture(ctx: Ctx, d: RoomDecor, cx: number, now: number): void {
  const x0 = cx - DECOR_W / 2;
  const y0 = TOP;
  switch (d.kind) {
    case 'plakat_psst':
      r(ctx, x0 + 1, y0, 18, H, '#b02a2a');
      r(ctx, x0 + 2, y0 + 1, 16, H - 2, '#f0e6c8');
      text(ctx, 'PSST!', cx, y0 + 7, '#b02a2a', 5, 'center');
      break;
    case 'plakat_mapa':
      r(ctx, x0, y0, 20, H, '#c9a36b');
      r(ctx, x0 + 1, y0 + 1, 18, H - 2, '#4a8ac8');
      r(ctx, x0 + 2, y0 + 2, 4, 3, '#3fa34d');
      r(ctx, x0 + 4, y0 + 5, 2, 3, '#3fa34d');
      r(ctx, x0 + 8, y0 + 2, 3, 2, '#3fa34d');
      r(ctx, x0 + 9, y0 + 4, 3, 3, '#3fa34d');
      r(ctx, x0 + 13, y0 + 2, 5, 3, '#3fa34d');
      r(ctx, x0 + 15, y0 + 6, 2, 1, '#3fa34d');
      r(ctx, x0 + 10, y0 + 3, 1, 1, '#ff3030');
      break;
    case 'plakat_tajne':
      r(ctx, x0 + 1, y0, 18, H, '#d9c48a');
      r(ctx, x0 + 2, y0 + 1, 16, 8, '#b02a2a');
      r(ctx, x0 + 3, y0 + 2, 14, 6, '#d9c48a');
      text(ctx, 'PŘÍSNĚ', cx, y0 + 5, '#b02a2a', 3.5, 'center');
      text(ctx, 'TAJNÉ', cx, y0 + 8, '#b02a2a', 3.5, 'center');
      break;
    case 'plakat_spion':
      r(ctx, x0 + 1, y0, 18, H, '#1a1a1a');
      r(ctx, x0 + 2, y0 + 1, 16, H - 2, '#e8c547');
      // hat, head and coat in silhouette
      r(ctx, x0 + 4, y0 + 2, 5, 1, '#1a1a1a');
      r(ctx, x0 + 5, y0 + 1, 3, 1, '#1a1a1a');
      r(ctx, x0 + 5, y0 + 3, 3, 2, '#1a1a1a');
      r(ctx, x0 + 8, y0 + 4, 2, 1, '#1a1a1a');
      r(ctx, x0 + 4, y0 + 5, 6, 4, '#1a1a1a');
      // magnifying glass
      r(ctx, x0 + 10, y0 + 6, 2, 1, '#1a1a1a');
      disc(ctx, x0 + 14, y0 + 4, 2, '#1a1a1a');
      r(ctx, x0 + 13, y0 + 3, 3, 3, '#bfe6ff');
      break;
    case 'portret':
      r(ctx, x0 + 3, y0, 14, H, '#d4a93a');
      r(ctx, x0 + 4, y0 + 1, 12, H - 2, '#2f4a3a');
      r(ctx, x0 + 6, y0 + 6, 8, 3, '#1e1e2a');
      r(ctx, x0 + 9, y0 + 6, 2, 3, '#f4f4f4');
      disc(ctx, cx, y0 + 4, 2, '#e0b090');
      r(ctx, x0 + 8, y0 + 1, 4, 1, '#3b2618');
      r(ctx, x0 + 3, y0, 1, 1, '#f0d070');
      r(ctx, x0 + 16, y0 + H - 1, 1, 1, '#a07a20');
      break;
    case 'telegram':
      // telegram form pinned to a cork board
      r(ctx, x0 + 1, y0, 18, H, '#5a3a1e');
      r(ctx, x0 + 2, y0 + 1, 16, H - 2, '#b0844e');
      r(ctx, x0 + 5, y0 + 2, 11, 7, '#efe4c4');
      r(ctx, x0 + 5, y0 + 2, 11, 1, '#c9a36b');
      for (const ly of [4, 6, 7]) r(ctx, x0 + 6, y0 + ly, ly === 7 ? 6 : 9, 1, '#6a6a6a');
      r(ctx, x0 + 10, y0 + 1, 1, 1, '#d23c3c');
      break;
    case 'hodiny': {
      const cy = y0 + 5;
      disc(ctx, cx, cy, 5, '#3b2618');
      disc(ctx, cx, cy, 4, '#f4f4f4');
      for (const [dx, dy] of [[0, -3], [3, 0], [0, 3], [-3, 0]] as const) r(ctx, cx + dx, cy + dy, 1, 1, '#3b2618');
      const minute = now * 0.4;
      const hour = now * 0.4 / 12 + 1;
      line(ctx, cx + 0.5, cy + 0.5, cx + 0.5 + Math.sin(minute) * 3.2, cy + 0.5 - Math.cos(minute) * 3.2, '#1a1a1a');
      line(ctx, cx + 0.5, cy + 0.5, cx + 0.5 + Math.sin(hour) * 2, cy + 0.5 - Math.cos(hour) * 2, '#1a1a1a');
      const sec = Math.floor(now) * (Math.PI / 30);
      line(ctx, cx + 0.5, cy + 0.5, cx + 0.5 + Math.sin(sec) * 3.5, cy + 0.5 - Math.cos(sec) * 3.5, '#d23c3c');
      break;
    }
    case 'okno':
      r(ctx, x0 + 1, y0, 18, H, '#e0dcd4');
      r(ctx, x0 + 2, y0 + 1, 16, H - 2, '#1a2a4a');
      r(ctx, x0 + 13, y0 + 2, 2, 2, '#f4f0c0');
      r(ctx, x0 + 2, y0 + 5, 3, 4, '#0c1224');
      r(ctx, x0 + 5, y0 + 3, 3, 6, '#0c1224');
      r(ctx, x0 + 8, y0 + 6, 3, 3, '#0c1224');
      r(ctx, x0 + 11, y0 + 4, 3, 5, '#0c1224');
      r(ctx, x0 + 14, y0 + 6, 4, 3, '#0c1224');
      for (const [wx, wy] of [[3, 6], [6, 4], [6, 7], [12, 5], [12, 7], [15, 7]] as const) r(ctx, x0 + wx, y0 + wy, 1, 1, '#e8c547');
      r(ctx, x0 + 9, y0 + 1, 1, H - 2, '#e0dcd4');
      r(ctx, x0 + 2, y0 + 5, 16, 1, '#e0dcd4');
      break;
  }
}

/** A small flag on a wall-mounted pole with a gilt finial, drawn at native pixels so the bands stay exact. */
function drawFlagOnPole(ctx: Ctx, host: HostCountry, cx: number, now: number): void {
  const px = Math.round(cx - 6);
  const y = Math.round(TOP);
  r(ctx, px, y + 1, 1, 9, '#6b4a20');
  r(ctx, px - 1, y, 3, 1, '#e8c547');
  r(ctx, px - 1, y + 9, 3, 1, '#8a6a2a');
  drawFlag(ctx, host, px + 1, y + 1, 12, 6, Math.floor(now * 3) % 2);
}
