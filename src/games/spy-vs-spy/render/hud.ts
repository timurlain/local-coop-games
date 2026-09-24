import { cs } from '../../../shared/i18n/cs';
import { RULES } from '../logic/rules';
import { backArrows, showsBreadcrumbs } from '../logic/trail';
import { MENU_MAP, TRAPS, type Dir, type DoorTrapKind, type FurnitureTrapKind, type GameState, type Spy } from '../logic/state';
import { HAND_COLORS } from './colors';
import { r, roundRect, text } from './draw';
import { VIEW } from './geometry';
import { FRAME, ROOM, UNDER, UNDER_PARTS, UNDER_TOAST } from './layout';
import type { Toast } from './toast';

type Ctx = CanvasRenderingContext2D;
const T = cs.spy;

export function formatClock(seconds: number): string {
  const s = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

const BRICK = '#a4432c';
const BRICK_DARK = '#5a1e12';
const BRICK_LIGHT = '#d9876a';

/** Rounded brick-red bezel around the room view, like a 1980s TV set. Draw after the room. */
export function drawFrame(ctx: Ctx): void {
  const f = FRAME;
  ctx.beginPath();
  roundRect(ctx, f.x, f.y, f.w, f.h, 7);
  roundRect(ctx, ROOM.x, ROOM.y, ROOM.w, ROOM.h, 3);
  ctx.fillStyle = BRICK;
  ctx.fill('evenodd');
  // darker inner edge
  ctx.beginPath();
  roundRect(ctx, ROOM.x - 0.5, ROOM.y - 0.5, ROOM.w + 1, ROOM.h + 1, 3);
  ctx.strokeStyle = BRICK_DARK;
  ctx.lineWidth = 1;
  ctx.stroke();
  // a small highlight on the top-left of the bezel and a shade along the bottom
  r(ctx, f.x + 7, f.y + 1, 46, 1, BRICK_LIGHT);
  r(ctx, f.x + 1, f.y + 7, 1, 18, BRICK_LIGHT);
  r(ctx, f.x + 7, f.y + f.h - 2, f.w - 14, 1, BRICK_DARK);
}

/** While the Trapulator menu is held: the selected entry's name plus how to use it (spec §5). */
export function trapMenuLabel(cursor: number): string {
  if (cursor === MENU_MAP) return T.mapSelectHint;
  return T.trapSelectHint(T.traps[TRAPS[cursor]]);
}

/** While a trap is armed (Trapulator closed): where to press Akce to place it (spec §5). */
export function armedTrapHint(trap: FurnitureTrapKind | DoorTrapKind): string {
  const label = T.traps[trap];
  return trap === 'bomba' || trap === 'pruzina' ? T.trapArmedFurniture(label) : T.trapArmedDoor(label);
}

/** 5×5 pixel arrows for the breadcrumb strip ('#' = lit). */
export const ARROW_PIXELS: Readonly<Record<Dir, readonly string[]>> = {
  N: ['..#..', '.###.', '#.#.#', '..#..', '..#..'],
  S: ['..#..', '..#..', '#.#.#', '.###.', '..#..'],
  W: ['..#..', '.#...', '#####', '.#...', '..#..'],
  E: ['..#..', '...#.', '#####', '...#.', '..#..'],
};
/** Horizontal distance between two breadcrumb arrows, px. */
export const TRAIL_STEP = 6;
/** Most recent arrow first, older ones dimmer. */
const TRAIL_COLORS = ['#f4e3a8', '#c9b27a', '#9a8a60'];

/** The arrows the viewer's strip shows (spec §9): the way back, most recent first; none on levels 7-8. */
export function breadcrumbArrows(state: GameState, spy: Spy): Dir[] {
  return showsBreadcrumbs(state.level) ? backArrows(spy.trail) : [];
}

function drawArrow(ctx: Ctx, dir: Dir, x: number, y: number, color: string): void {
  ARROW_PIXELS[dir].forEach((row, dy) => {
    for (let dx = 0; dx < row.length; dx++) if (row[dx] === '#') r(ctx, x + dx, y + dy, 1, 1, color);
  });
}

/** Strip under the frame: player name, room name (or Trapulator/armed-trap guidance), breadcrumbs or a toast, health pips. */
export function drawUnder(ctx: Ctx, state: GameState, spy: Spy, toast: Toast | null): void {
  r(ctx, UNDER.x, UNDER.y, UNDER.w, UNDER.h, '#0c0c12');
  const p = UNDER_PARTS;
  const name = (spy.id === 0 ? T.white : T.black).toUpperCase();
  text(ctx, name, p.name.x, p.name.y + 8, spy.id === 0 ? '#f4f4f4' : '#9a9aae', 7);

  // The Trapulator/armed-trap guidance is longer than the room slot and runs on over the breadcrumbs.
  let guidance = true;
  if (spy.menuOpen) {
    text(ctx, trapMenuLabel(spy.menuCursor), p.room.x, p.room.y + 8, '#ffe27a', 6);
  } else if (spy.armed !== null && spy.armed !== 'casovana') {
    text(ctx, armedTrapHint(spy.armed), p.room.x, p.room.y + 8, '#ffe27a', 6);
  } else {
    text(ctx, T.rooms[state.rooms[spy.room].theme], p.room.x, p.room.y + 8, '#9a9ab0', 6);
    guidance = false;
  }

  if (!toast && !guidance) {
    const arrows = breadcrumbArrows(state, spy);
    const y = p.trail.y + Math.floor((p.trail.h - ARROW_PIXELS.N.length) / 2);
    arrows.forEach((d, i) => drawArrow(ctx, d, p.trail.x + 2 + i * TRAIL_STEP, y, TRAIL_COLORS[Math.min(i, TRAIL_COLORS.length - 1)]));
  }

  if (toast) {
    const b = UNDER_TOAST;
    const color = HAND_COLORS[toast.kind];
    r(ctx, b.x, b.y, b.w, b.h, color);
    r(ctx, b.x, b.y + b.h - 1, b.w, 1, '#00000060');
    text(ctx, toast.text, b.x + b.w / 2, b.y + 8, toast.kind === 'secret' ? '#1a1a1a' : '#ffffff', 6, 'center');
  }

  const pips = p.pips;
  for (let i = 0; i < RULES.health; i++) {
    r(ctx, pips.x + 1 + i * 5, pips.y + 2, 4, 5, i < spy.health ? '#d23c3c' : '#333340');
  }
}

/** "Zamčeno" and the out-of-time veil, inside the room view. */
export function drawMessages(ctx: Ctx, spy: Spy): void {
  if (spy.lockedMsg > 0) {
    r(ctx, VIEW.cx - 40, VIEW.top + 19, 80, 12, '#000000');
    text(ctx, T.locked, VIEW.cx, VIEW.top + 28, '#ffffff', 8, 'center');
  }
  if (spy.mode === 'out') {
    r(ctx, VIEW.left, VIEW.top, VIEW.right - VIEW.left, VIEW.bottom - VIEW.top, 'rgba(0,0,0,0.6)');
    text(ctx, T.out, VIEW.cx, VIEW.top + 39, '#ff5050', 12, 'center');
  }
}
