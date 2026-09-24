import { cs } from '../../../shared/i18n/cs';
import { RULES } from '../logic/rules';
import { SECRETS, TRAPS, type GameState, type Spy } from '../logic/state';
import { r, text } from './draw';
import { VIEW } from './geometry';
import { drawIcon, thingIcon } from './sprites';

type Ctx = CanvasRenderingContext2D;
const T = cs.spy;
export const HUD_Y = VIEW.viewH;

export function formatClock(seconds: number): string {
  const s = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function box(ctx: Ctx, x: number, y: number, size: number): void {
  r(ctx, x, y, size, size, '#2a2a36');
  r(ctx, x + 1, y + 1, size - 2, size - 2, '#16161e');
}

export function drawHud(ctx: Ctx, state: GameState, spy: Spy, now: number): void {
  r(ctx, 0, HUD_Y, 320, 20, '#0c0c12');
  r(ctx, 0, HUD_Y, 320, 1, '#33334a');

  text(ctx, spy.id === 0 ? T.white : T.black, 4, HUD_Y + 8, '#cccccc');
  const blink = spy.clock < 60 && Math.floor(now * 2) % 2 === 0;
  text(ctx, formatClock(spy.clock), 4, HUD_Y + 17, blink ? '#ff5050' : '#ffffff', 8);

  for (let i = 0; i < RULES.health; i++) r(ctx, 44 + i * 5, HUD_Y + 12, 4, 4, i < spy.health ? '#d23c3c' : '#333333');

  box(ctx, 72, HUD_Y + 4, 13);
  if (spy.hand) drawIcon(ctx, thingIcon(spy.hand), 78.5, HUD_Y + 14);

  const contents = spy.hand?.kind === 'kufrik' ? spy.hand.contents : [];
  SECRETS.forEach((secret, i) => {
    box(ctx, 92 + i * 12, HUD_Y + 5, 11);
    if (contents.includes(secret)) drawIcon(ctx, secret, 97.5 + i * 12, HUD_Y + 14);
  });

  if (spy.armed) {
    text(ctx, T.armed, 146, HUD_Y + 13, '#ccffcc', 6);
    drawIcon(ctx, spy.armed, 172, HUD_Y + 15);
  }

  drawMiniMap(ctx, state, spy);
  // right-aligned against the mini-map; the armed-trap label ends at x≈176, the longest name starts at x≈200
  text(ctx, T.rooms[state.rooms[spy.room].theme], miniMapLeft(state) - 5, HUD_Y + 13, '#9a9ab0', 6, 'right');
}

function miniMapLeft(state: GameState): number {
  return 316 - state.cols * 6;
}

function drawMiniMap(ctx: Ctx, state: GameState, spy: Spy): void {
  const x0 = miniMapLeft(state);
  const y0 = HUD_Y + 3;
  for (const room of state.rooms) {
    let color = '#222230';
    if (spy.visited[room.id]) color = room.exit !== null ? '#2e7dd1' : '#666677';
    if (room.id === spy.room) color = '#ffffff';
    r(ctx, x0 + room.gx * 6, y0 + room.gy * 4, 5, 3, color);
  }
}

export function drawTrapulator(ctx: Ctx, spy: Spy): void {
  const x0 = 90;
  const y0 = 20;
  const w = 140;
  const h = 36;
  r(ctx, x0, y0, w, h, '#6fbf6f');
  r(ctx, x0 + 1, y0 + 1, w - 2, h - 2, '#1c2a1c');
  TRAPS.forEach((trap, i) => {
    const cx = x0 + 16 + i * 27;
    if (i === spy.menuCursor) r(ctx, cx - 7, y0 + 5, 14, 13, '#e8c547');
    r(ctx, cx - 6, y0 + 6, 12, 11, '#1c2a1c');
    drawIcon(ctx, trap, cx, y0 + 16);
    text(ctx, String(spy.stock[trap]), cx, y0 + 25, spy.stock[trap] > 0 ? '#ccffcc' : '#555555', 6, 'center');
  });
  text(ctx, T.traps[TRAPS[spy.menuCursor]], x0 + w / 2, y0 + 33, '#ccffcc', 6, 'center');
}

export function drawMessages(ctx: Ctx, spy: Spy): void {
  if (spy.lockedMsg > 0) {
    r(ctx, 120, 24, 80, 12, '#000000');
    text(ctx, T.locked, 160, 33, '#ffffff', 8, 'center');
  }
  if (spy.mode === 'out') {
    r(ctx, 0, 0, 320, VIEW.viewH, 'rgba(0,0,0,0.6)');
    text(ctx, T.out, 160, 44, '#ff5050', 12, 'center');
  }
}
