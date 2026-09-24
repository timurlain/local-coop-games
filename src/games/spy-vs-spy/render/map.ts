import { cs } from '../../../shared/i18n/cs';
import { DIRS, OPPOSITE, neighbor, type Dir, type GameState, type Spy } from '../logic/state';
import { HAND_COLORS } from './colors';
import { r, text } from './draw';
import { ROOM, bigMapLayout, minimapLayout, type GridLayout } from './layout';
import { drawIcon } from './sprites';

type Ctx = CanvasRenderingContext2D;

export interface KnownDoor {
  room: number;
  dir: Dir;
}

/**
 * Doors the spy knows: every door (and the exit) of a room the spy has visited. An internal door is reported
 * once, always from its north/west room as an S/E door; the exit is reported from its own room.
 */
export function knownDoors(state: GameState, spy: Spy): KnownDoor[] {
  const seen = new Set<string>();
  const out: KnownDoor[] = [];
  for (const room of state.rooms) {
    if (!spy.visited[room.id]) continue;
    for (const dir of DIRS) {
      if (room.exit === dir) {
        out.push({ room: room.id, dir });
        continue;
      }
      if (!room.doors[dir]) continue;
      const n = neighbor(state, room.id, dir);
      if (n === null) continue;
      const door: KnownDoor = dir === 'N' || dir === 'W' ? { room: n, dir: OPPOSITE[dir] } : { room: room.id, dir };
      const k = `${door.room}${door.dir}`;
      if (seen.has(k)) continue;
      seen.add(k);
      out.push(door);
    }
  }
  return out;
}

/** Visited rooms where a piece of furniture hides a secret or the kufřík (the big map's dots). */
export function itemRooms(state: GameState, spy: Spy): Set<number> {
  const rooms = new Set<number>();
  for (const f of state.furniture) {
    if (!spy.visited[f.room] || !f.hidden) continue;
    if (f.hidden.kind === 'secret' || f.hidden.kind === 'kufrik') rooms.add(f.room);
  }
  return rooms;
}

interface GridStyle {
  unknown: string;
  visited: string;
  current: string;
  door: string;
  /** connector thickness in px */
  thick: number;
  dots: boolean;
  bigExit: boolean;
}

const MINI: GridStyle = {
  unknown: '#2c2f38', visited: '#8a8f9c', current: '#ffffff', door: '#c9ccd4', thick: 1, dots: false, bigExit: false,
};
const BIG: GridStyle = {
  unknown: '#1c2a40', visited: '#6f86a8', current: '#ffffff', door: '#dfe6f0', thick: 2, dots: true, bigExit: true,
};
const EXIT_COLOR = '#2e7dd1';

function cellAt(g: GridLayout, gx: number, gy: number): { x: number; y: number } {
  return { x: g.x0 + gx * (g.cellW + g.gap), y: g.y0 + gy * (g.cellH + g.gap) };
}

function drawGrid(ctx: Ctx, state: GameState, spy: Spy, g: GridLayout, style: GridStyle, now: number): void {
  const blinkOn = Math.floor(now * 3) % 2 === 0;
  for (const room of state.rooms) {
    const { x, y } = cellAt(g, room.gx, room.gy);
    let color = spy.visited[room.id] ? style.visited : style.unknown;
    if (room.id === spy.room && blinkOn) color = style.current;
    r(ctx, x, y, g.cellW, g.cellH, color);
  }

  for (const door of knownDoors(state, spy)) {
    const room = state.rooms[door.room];
    const { x, y } = cellAt(g, room.gx, room.gy);
    const t = style.thick;
    const midX = x + Math.floor((g.cellW - t) / 2);
    const midY = y + Math.floor((g.cellH - t) / 2);
    if (room.exit === door.dir) {
      drawExit(ctx, g, style, door.dir, x, y, midX, midY);
      continue;
    }
    if (door.dir === 'E') r(ctx, x + g.cellW, midY, g.gap, t, style.door);
    else r(ctx, midX, y + g.cellH, t, g.gap, style.door);
  }

  if (style.dots) {
    const d = 3;
    for (const id of itemRooms(state, spy)) {
      const room = state.rooms[id];
      const { x, y } = cellAt(g, room.gx, room.gy);
      const cx = x + Math.floor((g.cellW - d) / 2);
      const cy = y + Math.floor((g.cellH - d) / 2);
      r(ctx, cx - 1, cy - 1, d + 2, d + 2, '#1a1a1a');
      r(ctx, cx, cy, d, d, HAND_COLORS.secret);
    }
  }
}

/** Blue stub through the outward wall plus a plane mark: a white pixel on the mini-map, the plane icon on the big map. */
function drawExit(ctx: Ctx, g: GridLayout, style: GridStyle, dir: Dir, x: number, y: number, midX: number, midY: number): void {
  const t = Math.max(2, style.thick);
  const len = style.bigExit ? 5 : 2;
  const stub = {
    N: [midX, y - len, t, len],
    S: [midX, y + g.cellH, t, len],
    W: [x - len, midY, len, t],
    E: [x + g.cellW, midY, len, t],
  }[dir];
  r(ctx, stub[0], stub[1], stub[2], stub[3], EXIT_COLOR);
  if (!style.bigExit) {
    // the tip of the stub is the plane mark
    const tip = { N: [midX, y - len], S: [midX, y + g.cellH + len - 1], W: [x - len, midY], E: [x + g.cellW + len - 1, midY] }[dir];
    r(ctx, tip[0], tip[1], 1, 1, '#ffffff');
    return;
  }
  // plane icon in the cell's corner by the exit wall, clear of the centred item dot
  const ix = dir === 'W' ? x + 5 : x + g.cellW - 5;
  const iy = dir === 'S' ? y + g.cellH - 1 : y + 9;
  drawIcon(ctx, 'plane', ix, iy);
}

/** Always-on mini-map inside the Trapulator (the caller draws the screen behind it). */
export function drawMiniMap(ctx: Ctx, state: GameState, spy: Spy, now: number): void {
  drawGrid(ctx, state, spy, minimapLayout(state.cols, state.rows), MINI, now);
}

/** Big map drawn instead of the room view while MAPA is held. */
export function drawBigMap(ctx: Ctx, state: GameState, spy: Spy, now: number): void {
  r(ctx, ROOM.x, ROOM.y, ROOM.w, ROOM.h, '#0b1424');
  for (let x = ROOM.x + 4; x < ROOM.x + ROOM.w; x += 8) r(ctx, x, ROOM.y, 1, ROOM.h, '#101c30');
  for (let y = ROOM.y + 4; y < ROOM.y + ROOM.h; y += 8) r(ctx, ROOM.x, y, ROOM.w, 1, '#101c30');
  drawGrid(ctx, state, spy, bigMapLayout(state.cols, state.rows), BIG, now);
  text(ctx, cs.spy.device.map, ROOM.x + 3, ROOM.y + 7, '#6f86a8', 5);
}
