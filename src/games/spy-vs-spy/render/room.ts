import { RULES } from '../logic/rules';
import { DIRS, type Dir, type GameState, type RoomTheme } from '../logic/state';
import { line, poly, r, shade, text } from './draw';
import { VIEW, project, wallX } from './geometry';
import { drawDecor } from './decor';
import { drawFloor, drawRug, type ThemeLook } from './floor';
import { drawFurniture } from './furniture';
import { drawIcon } from './sprites';

type Ctx = CanvasRenderingContext2D;

const LOOKS: Readonly<Record<RoomTheme, ThemeLook>> = {
  kancelar: { wall: '#5d6f82', floor: 'parquet', base: '#7a5638', accent: '#5e412a' },
  knihovna: { wall: '#2f5a40', floor: 'carpet', base: '#7a2f2f', accent: '#c9a36b' },
  salonek: { wall: '#7e2f40', floor: 'parquet', base: '#8a5e3a', accent: '#6a452a' },
  archiv: { wall: '#9a7a36', floor: 'tiles', base: '#8a8478', accent: '#6a655c' },
  konferencni: { wall: '#35598f', floor: 'carpet', base: '#4a4a58', accent: '#8a8aa0' },
  kuchynka: { wall: '#c2b489', floor: 'checker', base: '#e6e2d6', accent: '#2e2e36' },
  sifrovna: { wall: '#747244', floor: 'tiles', base: '#5e6258', accent: '#474a42' },
  pracovna: { wall: '#5e3f7e', floor: 'carpet', base: '#2f4a3a', accent: '#c9a36b' },
};
const BG = '#101018';
/** Height of the back-wall (N) door; its top stays below the decoration band. */
const N_DOOR_H = 27;

/** Wall shades used repeatedly while drawing a room, precomputed once per wall colour. */
interface WallShades {
  dim: string;
  edge: string;
  side: string;
}

const SHADE_CACHE = new Map<string, WallShades>();

function wallShades(wall: string): WallShades {
  let shades = SHADE_CACHE.get(wall);
  if (!shades) {
    shades = { dim: shade(wall, 0.45), edge: shade(wall, 0.6), side: shade(wall, 0.7) };
    SHADE_CACHE.set(wall, shades);
  }
  return shades;
}

/** Draws one room in logical coordinates of a half-viewport. `highlightId` marks furniture in reach of the viewer. */
export function drawRoom(ctx: Ctx, state: GameState, roomId: number, highlightId: number | null, now: number): void {
  const room = state.rooms[roomId];
  const look = LOOKS[room.theme];
  const wall = look.wall;
  const { dim, edge, side } = wallShades(wall);

  const { left: L, right: R, top: T, bottom: B } = VIEW;
  r(ctx, L, T, R - L, B - T, BG);
  poly(ctx, [[L, T], [R, T], [VIEW.backRight, VIEW.wallTop], [VIEW.backLeft, VIEW.wallTop]], dim);
  r(ctx, VIEW.backLeft, VIEW.wallTop, VIEW.backRight - VIEW.backLeft, VIEW.backY - VIEW.wallTop, wall);
  r(ctx, VIEW.backLeft, VIEW.backY - 3, VIEW.backRight - VIEW.backLeft, 3, edge);
  poly(ctx, [[L, T], [VIEW.backLeft, VIEW.wallTop], [VIEW.backLeft, VIEW.backY], [VIEW.frontLeft, VIEW.frontY], [L, B]], side);
  poly(ctx, [[R, T], [VIEW.backRight, VIEW.wallTop], [VIEW.backRight, VIEW.backY], [VIEW.frontRight, VIEW.frontY], [R, B]], side);
  drawFloor(ctx, look);
  if (room.rug) drawRug(ctx, wall);
  r(ctx, L, VIEW.frontY, R - L, B - VIEW.frontY, BG);
  for (const d of room.decor) drawDecor(ctx, d, now);

  for (const dir of DIRS) {
    const isExit = room.exit === dir;
    if (room.doors[dir] || isExit) drawDoor(ctx, dir, isExit);
  }

  for (const id of room.furniture) drawFurniture(ctx, state.furniture[id], id === highlightId, now);

  for (const bomb of state.timeBombs) {
    if (bomb.room !== roomId) continue;
    const p = project(bomb.x, bomb.z);
    drawIcon(ctx, 'casovana', p.sx, p.sy);
    if (Math.floor(now * 2) % 2 === 0) text(ctx, String(Math.ceil(bomb.fuse)), p.sx, p.sy - 10, '#ff5050', 7, 'center');
  }
}

function drawDoor(ctx: Ctx, dir: Dir, isExit: boolean): void {
  const fill = isExit ? '#2e7dd1' : '#3b2618';
  const frame = isExit ? '#f4f4f4' : '#c9a36b';
  const cx = wallX(RULES.roomW / 2);
  const half = RULES.doorHalfX;
  switch (dir) {
    case 'N': {
      const top = VIEW.backY - N_DOOR_H;
      r(ctx, cx - half - 1, top, half * 2 + 2, N_DOOR_H, frame);
      r(ctx, cx - half, top + 1, half * 2, N_DOOR_H - 1, fill);
      if (isExit) drawIcon(ctx, 'plane', cx, top + 9);
      break;
    }
    case 'S': {
      const a = project(RULES.roomW / 2 - RULES.doorHalfX, RULES.roomD);
      const b = project(RULES.roomW / 2 + RULES.doorHalfX, RULES.roomD);
      r(ctx, a.sx, VIEW.frontY - 2, b.sx - a.sx, 2, frame);
      r(ctx, a.sx, VIEW.frontY, b.sx - a.sx, VIEW.bottom - VIEW.frontY, fill);
      if (isExit) drawIcon(ctx, 'plane', (a.sx + b.sx) / 2, VIEW.frontY - 3);
      break;
    }
    case 'W':
    case 'E': {
      const x = dir === 'W' ? 0 : RULES.roomW;
      const p0 = project(x, RULES.roomD / 2 - RULES.doorHalfZ);
      const p1 = project(x, RULES.roomD / 2 + RULES.doorHalfZ);
      const h0 = 26;
      const h1 = 30;
      poly(ctx, [[p0.sx, p0.sy], [p1.sx, p1.sy], [p1.sx, p1.sy - h1], [p0.sx, p0.sy - h0]], fill);
      line(ctx, p0.sx, p0.sy - h0, p1.sx, p1.sy - h1, frame);
      line(ctx, p0.sx, p0.sy, p0.sx, p0.sy - h0, frame);
      line(ctx, p1.sx, p1.sy, p1.sx, p1.sy - h1, frame);
      if (isExit) drawIcon(ctx, 'plane', (p0.sx + p1.sx) / 2, p0.sy - h1 - 2);
      break;
    }
  }
}
