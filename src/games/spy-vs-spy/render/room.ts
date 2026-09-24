import { doorKeyFor } from '../logic/places';
import { RULES } from '../logic/rules';
import { DIRS, type Dir, type DoorRuntimeState, type GameState, type Room, type RoomTheme } from '../logic/state';
import { line, poly, r, shade, text } from './draw';
import { VIEW, project, wallX } from './geometry';
import { drawDecor } from './decor';
import { drawFloor, drawRug, type ThemeLook } from './floor';
import { drawFurniture, drawReachMarker } from './furniture';
import { ROOM } from './layout';
import { drawIcon } from './sprites';

const ARMED_RED = '#ff3030';

type Ctx = CanvasRenderingContext2D;

/** Period palettes: burgundy, bottle green, ochre, cream, navy, plum; one wallpaper pattern and floor per theme. */
const LOOKS: Readonly<Record<RoomTheme, ThemeLook>> = {
  kancelar: { wall: '#2c3a58', motif: '#3a4a6c', pattern: 'stripes', floor: 'herringbone', base: '#8a5a30', accent: '#4a2e18', light: 'sconces' },
  knihovna: { wall: '#1f4030', motif: '#2c533e', pattern: 'diamonds', floor: 'carpet', base: '#6a2430', accent: '#b8903e', light: 'chandelier' },
  salonek: { wall: '#6a1f2e', motif: '#7e2e3c', pattern: 'fans', floor: 'herringbone', base: '#6e4424', accent: '#3a2212', light: 'chandelier' },
  archiv: { wall: '#8e6e2e', motif: '#9e7e3a', pattern: 'stripes', floor: 'terrazzo', base: '#b4ab98', accent: '#7a7264', light: 'sconces' },
  konferencni: { wall: '#c6b68a', motif: '#b4a070', pattern: 'fans', floor: 'carpet', base: '#27304e', accent: '#b8903e', light: 'chandelier' },
  kuchynka: { wall: '#d8cca4', motif: '#b8c49a', pattern: 'diamonds', floor: 'checker', base: '#e6e2d6', accent: '#1e1e24', light: 'sconces' },
  sifrovna: { wall: '#34422f', motif: '#40503a', pattern: 'stripes', floor: 'terrazzo', base: '#8e8c84', accent: '#55534c', light: 'sconces' },
  pracovna: { wall: '#48264a', motif: '#5a345a', pattern: 'diamonds', floor: 'carpet', base: '#1f4030', accent: '#b8903e', light: 'chandelier' },
};
const BG = '#101018';
/** Height of the back-wall (N) door; its top stays below the decoration band. */
const N_DOOR_H = 27;
/** Dark-wood wainscoting along the bottom of the back wall, px. */
const WAINSCOT_H = 11;
const WOOD = '#3e2616';
const WOOD_LIGHT = '#5e3e22';
const WOOD_DARK = '#26160c';
const CORNICE = '#8a7a5e';
const GILT = '#c9a040';
const BRASS = '#d4b050';
const GLOW = '#fff0b0';

/**
 * Static room backgrounds (ceiling, walls, wallpaper, wainscoting, sconces, floor, rug): one offscreen canvas per
 * theme + rug at the current device scale, drawn once and blitted every frame — the patterns are hundreds of shapes.
 */
const BACKGROUNDS = new Map<string, HTMLCanvasElement>();
let cachedScale = 0;

function background(ctx: Ctx, theme: RoomTheme, rug: boolean): HTMLCanvasElement | null {
  if (typeof document === 'undefined') return null;
  const k = ctx.getTransform().a;
  if (!(k > 0)) return null;
  if (k !== cachedScale) {
    BACKGROUNDS.clear();
    cachedScale = k;
  }
  const key = `${theme}|${rug ? 1 : 0}`;
  let bg = BACKGROUNDS.get(key);
  if (!bg) {
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(ROOM.w * k);
    canvas.height = Math.round(ROOM.h * k);
    const c = canvas.getContext('2d');
    if (!c) return null;
    c.setTransform(k, 0, 0, k, -ROOM.x * k, -ROOM.y * k);
    c.imageSmoothingEnabled = false;
    drawBackground(c, LOOKS[theme], rug);
    bg = canvas;
    BACKGROUNDS.set(key, bg);
  }
  return bg;
}

/** Door openings to draw in a room; the exit only when `showExit` (hidden airport, spec §4). */
export function doorsToDraw(room: Room, showExit: boolean): { dir: Dir; isExit: boolean }[] {
  const out: { dir: Dir; isExit: boolean }[] = [];
  for (const dir of DIRS) {
    const isExit = showExit && room.exit === dir;
    if (room.doors[dir] || isExit) out.push({ dir, isExit });
  }
  return out;
}

/**
 * Draws one room in logical coordinates of a half-viewport. `highlightId` marks furniture in reach of the viewer
 * (white); `armedFurnitureId` / `armedDoor` mark where an armed trap can be placed right now (red), spec §5.
 * `showExit` false leaves the airport exit out (hidden from this viewer, spec §4).
 */
export function drawRoom(
  ctx: Ctx, state: GameState, roomId: number, highlightId: number | null, now: number,
  armedFurnitureId: number | null = null, armedDoor: Dir | null = null, showExit = true,
): void {
  const room = state.rooms[roomId];
  const look = LOOKS[room.theme];
  const bg = background(ctx, room.theme, room.rug);
  if (bg) ctx.drawImage(bg, ROOM.x, ROOM.y, ROOM.w, ROOM.h);
  else drawBackground(ctx, look, room.rug);

  for (const d of room.decor) drawDecor(ctx, d, now);

  for (const { dir, isExit } of doorsToDraw(room, showExit)) {
    const key = doorKeyFor(state, roomId, dir);
    drawDoor(ctx, dir, isExit, dir === armedDoor, leafFraction(state.doorOpen[key]));
  }
  if (look.light === 'chandelier') drawChandelier(ctx, now);

  for (const id of room.furniture) {
    drawFurniture(ctx, state.furniture[id], room.theme, id === highlightId, id === armedFurnitureId, now);
  }

  for (const bomb of state.timeBombs) {
    if (bomb.room !== roomId) continue;
    const p = project(bomb.x, bomb.z);
    drawIcon(ctx, 'casovana', p.sx, p.sy);
    if (Math.floor(now * 2) % 2 === 0) text(ctx, String(Math.ceil(bomb.fuse)), p.sx, p.sy - 10, '#ff5050', 7, 'center');
  }
}

/** y of the left side wall's floor edge (backLeft, backY)→(frontLeft, frontY), extended to any x. */
function sideFloorY(x: number): number {
  const t = (x - VIEW.backLeft) / (VIEW.frontLeft - VIEW.backLeft);
  return VIEW.backY + (VIEW.frontY - VIEW.backY) * t;
}

/** y of the left side wall's ceiling edge (left, top)→(backLeft, wallTop). */
function sideTopY(x: number): number {
  const t = (x - VIEW.backLeft) / (VIEW.left - VIEW.backLeft);
  return VIEW.wallTop + (VIEW.top - VIEW.wallTop) * t;
}

/** Wainscot height on the left side wall at screen x: grows towards the viewer with the perspective. */
function sideWainscotH(x: number): number {
  return WAINSCOT_H * (sideFloorY(x) - sideTopY(x)) / (VIEW.backY - VIEW.wallTop);
}

/** Everything in a room that never changes: ceiling, walls, wallpaper, wainscoting, sconces, floor, rug. */
function drawBackground(ctx: Ctx, look: ThemeLook, rug: boolean): void {
  const { left: L, right: R, top: T, bottom: B } = VIEW;
  const bl = VIEW.backLeft, br = VIEW.backRight;
  r(ctx, L, T, R - L, B - T, BG);
  // ceiling with a cream cornice
  poly(ctx, [[L, T], [R, T], [br, VIEW.wallTop], [bl, VIEW.wallTop]], '#2a2420');
  poly(ctx, [[L, T], [R, T], [R, T + 1], [L, T + 1]], '#1c1814');
  poly(ctx, [[bl - 4, VIEW.wallTop - 1], [br + 4, VIEW.wallTop - 1], [br, VIEW.wallTop], [bl, VIEW.wallTop]], CORNICE);

  // back wall: wallpaper, picture rail, wainscoting
  const wainTop = VIEW.backY - WAINSCOT_H;
  r(ctx, bl, VIEW.wallTop, br - bl, wainTop - VIEW.wallTop, look.wall);
  drawWallpaper(ctx, look, bl, VIEW.wallTop + 1, br - bl, wainTop - VIEW.wallTop - 1);
  r(ctx, bl, VIEW.wallTop, br - bl, 1, '#d8c89a');
  drawWainscot(ctx, bl, wainTop, br - bl);

  // side walls: shaded wallpaper, a wainscot band that follows the perspective, sconces
  const side = shade(look.wall, 0.7);
  const sideMotif = shade(look.motif, 0.7);
  const sideWood = shade(WOOD, 0.8);
  for (const mirror of [false, true]) {
    const mx = (x: number): number => (mirror ? 2 * VIEW.cx - x : x);
    const pts = (xs: readonly (readonly [number, number])[]) => xs.map(([x, y]) => [mx(x), y] as const);
    poly(ctx, pts([[L, T], [bl, VIEW.wallTop], [bl, VIEW.backY], [VIEW.frontLeft, VIEW.frontY], [L, B]]), side);
    // the wallpaper's rhythm as shaded vertical lines
    for (let x = bl - 4; x > L; x -= 5) {
      const top = sideTopY(x) + 1;
      const bottom = sideFloorY(x) - sideWainscotH(x);
      poly(ctx, pts([[x, top], [x + 1, top], [x + 1, bottom], [x, bottom]]), sideMotif);
    }
    const wl = sideFloorY(L) - sideWainscotH(L);
    poly(ctx, pts([[bl, wainTop], [bl, VIEW.backY], [L, sideFloorY(L)], [L, wl]]), sideWood);
    poly(ctx, pts([[bl, wainTop], [bl, wainTop + 1.5], [L, wl + 2], [L, wl]]), WOOD_LIGHT);
    poly(ctx, pts([[L, T], [bl, VIEW.wallTop - 1], [bl, VIEW.wallTop], [L, T + 2]]), CORNICE);
    if (look.light === 'sconces') drawSconce(ctx, Math.round(mx(24)), 22);
  }
  r(ctx, bl, VIEW.wallTop, 1, VIEW.backY - VIEW.wallTop, shade(look.wall, 0.55));
  r(ctx, br - 1, VIEW.wallTop, 1, VIEW.backY - VIEW.wallTop, shade(look.wall, 0.55));

  drawFloor(ctx, look);
  if (rug) drawRug(ctx, look.wall);
  r(ctx, L, VIEW.frontY, R - L, B - VIEW.frontY, BG);
}

/** Subtle art-deco wallpaper in whole pixels: a lozenge lattice, rows of fans, or pinstriped bands. */
function drawWallpaper(ctx: Ctx, look: ThemeLook, x0: number, y0: number, w: number, h: number): void {
  const m = look.motif;
  const gold = shade(GILT, 0.75);
  ctx.save();
  ctx.beginPath();
  ctx.rect(x0, y0, w, h);
  ctx.clip();
  switch (look.pattern) {
    case 'diamonds': {
      const tw = 10, th = 8;
      for (let ty = -1; ty * th < h + th; ty++) {
        for (let tx = -1; tx * tw < w + tw; tx++) {
          const cx = x0 + tx * tw + (ty % 2 === 0 ? 0 : tw / 2);
          const cy = y0 + ty * th;
          for (let i = 0; i < tw / 2; i++) {
            const dy = Math.round((i * th) / tw);
            r(ctx, cx + i, cy + dy, 1, 1, m);
            r(ctx, cx - i, cy + dy, 1, 1, m);
            r(ctx, cx + i, cy + th - dy, 1, 1, m);
            r(ctx, cx - i, cy + th - dy, 1, 1, m);
          }
          r(ctx, cx, cy + th / 2, 1, 1, gold);
        }
      }
      break;
    }
    case 'fans': {
      const tw = 12, th = 7;
      for (let ty = 0; ty * th < h + th; ty++) {
        for (let tx = -1; tx * tw < w + tw; tx++) {
          const cx = x0 + tx * tw + (ty % 2 === 0 ? 0 : tw / 2);
          const cy = y0 + ty * th + th - 1;
          for (let a = 0; a <= 10; a++) {
            const ang = Math.PI + (a / 10) * Math.PI;
            r(ctx, Math.round(cx + Math.cos(ang) * 5), Math.round(cy + Math.sin(ang) * 5), 1, 1, m);
          }
          for (const ang of [Math.PI * 1.25, Math.PI * 1.5, Math.PI * 1.75]) {
            for (let d = 1; d <= 3; d++) r(ctx, Math.round(cx + Math.cos(ang) * d), Math.round(cy + Math.sin(ang) * d), 1, 1, m);
          }
          r(ctx, cx, cy, 1, 1, gold);
        }
      }
      break;
    }
    case 'stripes':
      for (let i = 0, x = x0 + 1; x < x0 + w; i++, x += 6) {
        r(ctx, x, y0, 2, h, m);
        if (i % 3 === 0) r(ctx, x + 4, y0, 1, h, gold);
      }
      break;
  }
  ctx.restore();
}

/** Dark-wood panelling: top rail, raised panels, skirting. */
function drawWainscot(ctx: Ctx, x0: number, y0: number, w: number): void {
  const h = VIEW.backY - y0;
  r(ctx, x0, y0, w, h, WOOD);
  r(ctx, x0, y0, w, 2, WOOD_LIGHT);
  r(ctx, x0, y0 + 2, w, 1, WOOD_DARK);
  r(ctx, x0, VIEW.backY - 2, w, 2, WOOD_DARK);
  const panelW = 13;
  const count = Math.floor((w - 2) / (panelW + 2));
  const start = x0 + Math.floor((w - count * (panelW + 2) + 2) / 2);
  for (let i = 0; i < count; i++) {
    const x = start + i * (panelW + 2);
    r(ctx, x, y0 + 4, panelW, h - 7, WOOD_DARK);
    r(ctx, x + 1, y0 + 5, panelW - 1, h - 8, shade(WOOD, 1.18));
    r(ctx, x + 1, y0 + 5, panelW - 1, 1, shade(WOOD, 1.4));
  }
}

/** Brass wall sconce with a frosted glass tulip, on a side wall. */
function drawSconce(ctx: Ctx, x: number, y: number): void {
  ctx.fillStyle = 'rgba(255,226,150,0.08)';
  ctx.beginPath();
  ctx.arc(x + 0.5, y - 2, 7, 0, Math.PI * 2);
  ctx.fill();
  r(ctx, x, y, 1, 4, BRASS);
  r(ctx, x - 1, y + 4, 3, 1, shade(BRASS, 0.7));
  r(ctx, x - 1, y - 3, 3, 3, '#f4ecd0');
  r(ctx, x - 2, y - 3, 1, 1, '#f4ecd0');
  r(ctx, x + 2, y - 3, 1, 1, '#f4ecd0');
  r(ctx, x, y - 4, 1, 1, GLOW);
}

/**
 * Brass chandelier hanging just below the ceiling, in front of the back wall; kept above the decoration band so it
 * never covers a picture or flag. The bulbs twinkle a little.
 */
function drawChandelier(ctx: Ctx, now: number): void {
  const cx = Math.round(VIEW.cx);
  const y = VIEW.top;
  ctx.fillStyle = 'rgba(255,226,150,0.08)';
  ctx.beginPath();
  ctx.arc(cx + 0.5, y + 4, 9, 0, Math.PI * 2);
  ctx.fill();
  r(ctx, cx, y, 1, 2, shade(BRASS, 0.6));
  r(ctx, cx - 1, y + 2, 3, 2, BRASS);
  r(ctx, cx - 5, y + 4, 11, 1, BRASS);
  r(ctx, cx - 1, y + 5, 3, 1, shade(BRASS, 0.7));
  const twinkle = Math.floor(now * 4) % 4;
  [-5, -2, 2, 5].forEach((dx, i) => r(ctx, cx + dx, y + 3, 1, 1, i === twinkle ? '#ffffff' : GLOW));
}

/** Fraction of a door's width still occupied by the closed leaf: 1 = fully closed, `LEAF_OPEN` = fully
 *  open (swung to a sliver against the frame), interpolated during the 0.3 s opening swing (spec §5). */
const LEAF_OPEN = 0.15;
/** The dark opening revealed behind a door that isn't fully closed. */
const OPENING_DARK = '#0a0a10';

export function leafFraction(door: DoorRuntimeState | undefined): number {
  if (door === undefined) return 1;
  if (door.phase === 'open') return LEAF_OPEN;
  const progress = 1 - door.timer / RULES.doorOpenTime;
  return 1 - (1 - LEAF_OPEN) * Math.min(1, Math.max(0, progress));
}

function drawDoor(ctx: Ctx, dir: Dir, isExit: boolean, armed: boolean, leaf: number): void {
  const fill = isExit ? '#2e7dd1' : '#4a2c18';
  const panel = isExit ? '#5aa0e8' : '#5e3a20';
  const frame = isExit ? '#f4f4f4' : '#c9a36b';
  const closed = leaf >= 0.999;
  const cx = wallX(RULES.roomW / 2);
  const half = RULES.doorHalfX;
  switch (dir) {
    case 'N': {
      // panelled double door with a fanlight; hinged at the left when swinging open
      const top = VIEW.backY - N_DOOR_H;
      r(ctx, cx - half - 1, top, half * 2 + 2, N_DOOR_H, frame);
      if (!closed) r(ctx, cx - half, top + 1, half * 2, N_DOOR_H - 1, OPENING_DARK);
      const leafW = Math.max(2, Math.round(half * 2 * leaf));
      r(ctx, cx - half, top + 1, leafW, N_DOOR_H - 1, fill);
      if (closed) {
        r(ctx, cx - half + 1, top + 2, half * 2 - 2, 4, isExit ? '#9ad0ff' : '#e8d49a');
        for (const dx of [-half / 2, half / 2]) r(ctx, Math.round(cx + dx), top + 2, 1, 4, frame);
        r(ctx, cx - half, top + 6, half * 2, 1, frame);
        for (const sx of [cx - half + 2, cx + 2]) {
          r(ctx, sx, top + 9, half - 4, 6, panel);
          r(ctx, sx, top + 17, half - 4, 7, panel);
        }
        r(ctx, cx - 0.5, top + 7, 1, N_DOOR_H - 7, shade(fill, 0.6));
        r(ctx, cx - 2, top + 16, 1, 1, BRASS);
        r(ctx, cx + 1, top + 16, 1, 1, BRASS);
        if (isExit) drawIcon(ctx, 'plane', cx, top + 13);
      } else {
        r(ctx, cx - half, top + 1, leafW, 1, shade(fill, 1.3));
      }
      if (armed) drawReachMarker(ctx, cx, top, ARMED_RED);
      break;
    }
    case 'S': {
      const a = project(RULES.roomW / 2 - RULES.doorHalfX, RULES.roomD);
      const b = project(RULES.roomW / 2 + RULES.doorHalfX, RULES.roomD);
      const w = b.sx - a.sx;
      r(ctx, a.sx, VIEW.frontY - 2, w, 2, frame);
      if (!closed) r(ctx, a.sx, VIEW.frontY, w, VIEW.bottom - VIEW.frontY, OPENING_DARK);
      const leafW = Math.max(2, Math.round(w * leaf));
      r(ctx, a.sx, VIEW.frontY, leafW, VIEW.bottom - VIEW.frontY, fill);
      if (isExit && closed) drawIcon(ctx, 'plane', (a.sx + b.sx) / 2, VIEW.frontY - 3);
      if (armed) drawReachMarker(ctx, (a.sx + b.sx) / 2, VIEW.frontY - 2, ARMED_RED);
      break;
    }
    case 'W':
    case 'E': {
      const x = dir === 'W' ? 0 : RULES.roomW;
      const p0 = project(x, RULES.roomD / 2 - RULES.doorHalfZ);
      const p1 = project(x, RULES.roomD / 2 + RULES.doorHalfZ);
      const h0 = 26;
      const h1 = 30;
      // hinge at p0: the leaf occupies the [0, leaf] portion of the span (t), the rest is the
      // revealed dark opening while opening/open (spec §5). lerp(t, h0) is that t's top edge,
      // lerp(t, 0) its bottom edge (h scales with the door's height at t, per the original panels).
      const lerp = (t: number, h: number) => {
        const sx = p0.sx + (p1.sx - p0.sx) * t;
        const sy = p0.sy + (p1.sy - p0.sy) * t;
        return [sx, sy - h * (h0 + (h1 - h0) * t) / h0] as const;
      };
      if (!closed) poly(ctx, [lerp(leaf, 0), lerp(1, 0), lerp(1, h0), lerp(leaf, h0)], OPENING_DARK);
      poly(ctx, [lerp(0, 0), lerp(leaf, 0), lerp(leaf, h0), lerp(0, h0)], fill);
      if (closed) {
        // two raised panels following the perspective
        for (const [f0, f1] of [[0.15, 0.48], [0.55, 0.85]] as const) {
          poly(ctx, [lerp(0.2, f0 * h0), lerp(0.8, f0 * h0), lerp(0.8, f1 * h0), lerp(0.2, f1 * h0)], panel);
        }
        const knob = lerp(dir === 'W' ? 0.8 : 0.2, 0.5 * h0);
        r(ctx, knob[0] - 0.5, knob[1], 1, 1, BRASS);
        if (isExit) drawIcon(ctx, 'plane', (p0.sx + p1.sx) / 2, p0.sy - h1 - 2);
      }
      line(ctx, p0.sx, p0.sy - h0, p1.sx, p1.sy - h1, frame);
      line(ctx, p0.sx, p0.sy, p0.sx, p0.sy - h0, frame);
      line(ctx, p1.sx, p1.sy, p1.sx, p1.sy - h1, frame);
      if (armed) drawReachMarker(ctx, (p0.sx + p1.sx) / 2, Math.min(p0.sy - h0, p1.sy - h1), ARMED_RED);
      break;
    }
  }
}
