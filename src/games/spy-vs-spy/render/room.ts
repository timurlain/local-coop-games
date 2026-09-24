import { RULES } from '../logic/rules';
import { DIRS, type Dir, type GameState, type RoomTheme } from '../logic/state';
import { line, poly, r, shade, text } from './draw';
import { VIEW, project } from './geometry';
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
  radiostanice: { wall: '#747244', floor: 'tiles', base: '#5e6258', accent: '#474a42' },
  pracovna: { wall: '#5e3f7e', floor: 'carpet', base: '#2f4a3a', accent: '#c9a36b' },
};
const BG = '#101018';

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

  r(ctx, 0, 0, 320, VIEW.viewH, BG);
  poly(ctx, [[0, 0], [320, 0], [VIEW.backRight, VIEW.wallTop], [VIEW.backLeft, VIEW.wallTop]], dim);
  r(ctx, VIEW.backLeft, VIEW.wallTop, VIEW.backRight - VIEW.backLeft, VIEW.backY - VIEW.wallTop, wall);
  r(ctx, VIEW.backLeft, VIEW.backY - 3, VIEW.backRight - VIEW.backLeft, 3, edge);
  poly(ctx, [[0, 0], [VIEW.backLeft, VIEW.wallTop], [VIEW.backLeft, VIEW.backY], [VIEW.frontLeft, VIEW.frontY], [0, VIEW.viewH]], side);
  poly(ctx, [[320, 0], [VIEW.backRight, VIEW.wallTop], [VIEW.backRight, VIEW.backY], [VIEW.frontRight, VIEW.frontY], [320, VIEW.viewH]], side);
  drawFloor(ctx, look);
  if (room.rug) drawRug(ctx, wall);
  r(ctx, 0, VIEW.frontY, 320, VIEW.viewH - VIEW.frontY, BG);
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
  const cx = VIEW.backLeft + RULES.roomW / 2;
  switch (dir) {
    case 'N': {
      r(ctx, cx - RULES.doorHalfX - 1, 17, RULES.doorHalfX * 2 + 2, VIEW.backY - 17, frame);
      r(ctx, cx - RULES.doorHalfX, 18, RULES.doorHalfX * 2, VIEW.backY - 18, fill);
      if (isExit) drawIcon(ctx, 'plane', cx, 16);
      break;
    }
    case 'S': {
      const a = project(RULES.roomW / 2 - RULES.doorHalfX, RULES.roomD);
      const b = project(RULES.roomW / 2 + RULES.doorHalfX, RULES.roomD);
      r(ctx, a.sx, VIEW.frontY - 2, b.sx - a.sx, 2, frame);
      r(ctx, a.sx, VIEW.frontY, b.sx - a.sx, VIEW.viewH - VIEW.frontY, fill);
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
