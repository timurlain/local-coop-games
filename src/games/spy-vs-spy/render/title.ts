import { cs } from '../../../shared/i18n/cs';
import { HALVES, withViewport } from '../../../shared/splitscreen';
import type { GameState, HostCountry } from '../logic/state';
import { line, r } from './draw';
import { drawFlag } from './flags';
import { ROOM } from './layout';

type Ctx = CanvasRenderingContext2D;
const T = cs.spy;

/** How long the match title card shows before play starts (Akce skips it), seconds. */
export const TITLE_CARD_TIME = 2.2;
const FADE_IN = 0.25;
const FADE_OUT = 0.35;
/** Art-deco display faces loaded by the page from Google Fonts, with fallbacks. */
export const DECO_DISPLAY = '"Limelight", "Poiret One", Georgia, serif';
export const DECO_TEXT = '"Poiret One", Georgia, serif';

const GOLD = '#e0bc5a';
const GOLD_DARK = '#8a6a24';
const CREAM = '#efe4c4';
const NIGHT = '#15110c';

/** The two lines of the card: the embassy, and „Praha <year>". */
export function titleCardLines(host: HostCountry, year: number): [string, string] {
  return [T.hosts[host], `${T.city} ${year}`];
}

/** Opacity of the card `t` seconds after it appeared: quick fade in, hold, fade out at the end. */
export function titleCardAlpha(t: number): number {
  if (t <= 0) return 0;
  if (t < FADE_IN) return t / FADE_IN;
  const left = TITLE_CARD_TIME - t;
  if (left <= 0) return 0;
  return Math.min(1, left / FADE_OUT);
}

/** Draws the title card over both halves (on top of the already rendered game). */
export function renderTitleCard(ctx: Ctx, scale: number, state: GameState, t: number): void {
  const alpha = titleCardAlpha(t);
  if (alpha <= 0) return;
  for (const half of HALVES) {
    withViewport(ctx, scale, half, () => {
      ctx.globalAlpha = alpha;
      drawCard(ctx, state.host, state.year);
      ctx.globalAlpha = 1;
    });
  }
}

function decoText(ctx: Ctx, s: string, x: number, y: number, size: number, font: string, color: string, maxW: number): void {
  ctx.font = `${size}px ${font}`;
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(s, x, y, maxW);
  // the hairline deco face gets a thin outline so it holds up at game scale
  ctx.strokeStyle = color;
  ctx.lineWidth = size / 28;
  ctx.strokeText(s, x, y, maxW);
}

/** Night-black panel, double gilt border with stepped corners, a sunburst behind the host flag, two lines of text. */
function drawCard(ctx: Ctx, host: HostCountry, year: number): void {
  r(ctx, 0, 0, 320, 100, 'rgba(8,6,4,0.6)');
  const w = 196, h = 60;
  const x0 = Math.round(ROOM.x + (ROOM.w - w) / 2);
  const y0 = Math.round(ROOM.y + (ROOM.h - h) / 2);
  const cx = x0 + w / 2;
  r(ctx, x0, y0, w, h, NIGHT);
  // double border
  for (const [inset, color] of [[1, GOLD], [3, GOLD_DARK]] as const) {
    r(ctx, x0 + inset, y0 + inset, w - 2 * inset, 1, color);
    r(ctx, x0 + inset, y0 + h - 1 - inset, w - 2 * inset, 1, color);
    r(ctx, x0 + inset, y0 + inset, 1, h - 2 * inset, color);
    r(ctx, x0 + w - 1 - inset, y0 + inset, 1, h - 2 * inset, color);
  }
  // stepped (ziggurat) corners
  for (const [sx, sy] of [[0, 0], [1, 0], [0, 1], [1, 1]] as const) {
    const px = sx === 0 ? x0 + 5 : x0 + w - 5;
    const py = sy === 0 ? y0 + 5 : y0 + h - 5;
    const dx = sx === 0 ? 1 : -1;
    const dy = sy === 0 ? 1 : -1;
    for (let i = 0; i < 3; i++) r(ctx, px + dx * i * 2 - (dx < 0 ? 1 : 0), py + dy * (4 - i * 2) - (dy < 0 ? 1 : 0), 1, 1, GOLD);
    r(ctx, px - (dx < 0 ? 1 : 0), py - (dy < 0 ? 1 : 0), 1, 1, GOLD);
  }
  // sunburst behind the flag
  const fy = y0 + 18;
  for (let i = 0; i <= 12; i++) {
    const a = Math.PI + (i / 12) * Math.PI;
    line(ctx, cx, fy, cx + Math.cos(a) * 26, fy + Math.sin(a) * 12, i % 2 === 0 ? GOLD_DARK : '#4a3a1a');
  }
  r(ctx, cx - 8, y0 + 8, 16, 10, NIGHT);
  drawFlag(ctx, host, cx - 6, y0 + 10, 12, 6);
  // rules with a diamond
  const ry = y0 + 21;
  r(ctx, x0 + 20, ry, w / 2 - 24, 1, GOLD_DARK);
  r(ctx, cx + 4, ry, w / 2 - 24, 1, GOLD_DARK);
  r(ctx, cx - 1, ry - 1, 2, 3, GOLD);
  r(ctx, cx - 2, ry, 4, 1, GOLD);

  const [embassy, city] = titleCardLines(host, year);
  decoText(ctx, embassy, cx, y0 + 33, 8, DECO_TEXT, CREAM, w - 16);
  decoText(ctx, city.toUpperCase(), cx, y0 + 51, 14, DECO_DISPLAY, GOLD, w - 24);
}
