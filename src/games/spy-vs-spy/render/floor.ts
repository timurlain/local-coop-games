import { RULES } from '../logic/rules';
import { line, poly, shade } from './draw';
import { project } from './geometry';

type Ctx = CanvasRenderingContext2D;

/** 1930s floors: herringbone parquet, terrazzo, a patterned carpet with an art-deco border, black-and-white tiles. */
export type FloorStyle = 'herringbone' | 'terrazzo' | 'carpet' | 'checker';
/** Art-deco wallpaper pattern above the wainscoting. */
export type WallPattern = 'diamonds' | 'fans' | 'stripes';
export type RoomLight = 'chandelier' | 'sconces';

export interface ThemeLook {
  /** wallpaper ground */
  wall: string;
  /** wallpaper pattern colour (subtle) */
  motif: string;
  pattern: WallPattern;
  floor: FloorStyle;
  /** main floor colour */
  base: string;
  /** joints / border / second tile colour */
  accent: string;
  light: RoomLight;
}

/** Floor quad between two (x, z) corners, projected onto the trapezoid. */
function floorQuad(ctx: Ctx, x0: number, z0: number, x1: number, z1: number, color: string): void {
  floorPoly(ctx, [[x0, z0], [x1, z0], [x1, z1], [x0, z1]], color);
}

function floorPoly(ctx: Ctx, pts: readonly (readonly [number, number])[], color: string): void {
  poly(ctx, pts.map(([x, z]) => {
    const p = project(x, z);
    return [p.sx, p.sy] as const;
  }), color);
}

function floorLineX(ctx: Ctx, x: number, z0: number, z1: number, color: string): void {
  const a = project(x, z0), b = project(x, z1);
  line(ctx, a.sx, a.sy, b.sx, b.sy, color);
}

function floorLineZ(ctx: Ctx, z: number, x0: number, x1: number, color: string): void {
  const a = project(x0, z), b = project(x1, z);
  line(ctx, a.sx, a.sy, b.sx, b.sy, color);
}

/** Small deterministic hash → [0, 1), so terrazzo chips land in the same spots every time. */
function hash01(i: number): number {
  let t = (i * 0x9e3779b1) >>> 0;
  t = Math.imul(t ^ (t >>> 15), 0x85ebca6b) >>> 0;
  t = Math.imul(t ^ (t >>> 13), 0xc2b2ae35) >>> 0;
  return ((t ^ (t >>> 16)) >>> 0) / 4294967296;
}

/** Draws the whole floor. Meant for the cached room background: it issues a few hundred shapes. */
export function drawFloor(ctx: Ctx, look: ThemeLook): void {
  const W = RULES.roomW, D = RULES.roomD;
  floorQuad(ctx, 0, 0, W, D, look.base);
  switch (look.floor) {
    case 'herringbone':
      drawHerringbone(ctx, look);
      break;
    case 'terrazzo':
      drawTerrazzo(ctx, look);
      break;
    case 'carpet':
      drawCarpet(ctx, look);
      break;
    case 'checker': {
      const tw = 10, td = 5;
      for (let i = 0; i < W / tw; i++) {
        for (let j = 0; j < D / td; j++) {
          if ((i + j) % 2 === 1) floorQuad(ctx, i * tw, j * td, (i + 1) * tw, (j + 1) * td, look.accent);
        }
      }
      break;
    }
  }
}

/** Parquet blocks laid in a herringbone: each row leans the other way, alternate blocks slightly lighter. */
function drawHerringbone(ctx: Ctx, look: ThemeLook): void {
  const W = RULES.roomW, D = RULES.roomD;
  const rows = 5;
  const bw = 7;
  const lean = 5;
  const light = shade(look.base, 1.14);
  const dark = shade(look.base, 0.86);
  for (let row = 0; row < rows; row++) {
    const z0 = (D * row) / rows, z1 = (D * (row + 1)) / rows;
    const dir = row % 2 === 0 ? 1 : -1;
    for (let i = -2, x = -bw * 2; x < W + bw; i++, x += bw) {
      const xa = x, xb = x + bw;
      const color = i % 2 === 0 ? light : dark;
      const pts: [number, number][] = [[xa, z0], [xb, z0], [xb + dir * lean, z1], [xa + dir * lean, z1]];
      floorPoly(ctx, pts.map(([px, pz]) => [Math.min(W, Math.max(0, px)), pz] as [number, number]), color);
    }
    floorLineZ(ctx, z0, 0, W, look.accent);
  }
}

/** Polished terrazzo: marble chips on a pale ground, divided by brass strips into large panels. */
function drawTerrazzo(ctx: Ctx, look: ThemeLook): void {
  const W = RULES.roomW, D = RULES.roomD;
  const chips = [shade(look.base, 0.84), shade(look.base, 0.84), shade(look.base, 1.1), shade(look.base, 1.1), '#9a7466'];
  for (let i = 0; i < 180; i++) {
    const x = hash01(i * 3 + 1) * W;
    const z = hash01(i * 3 + 2) * D;
    const p = project(x, z);
    ctx.fillStyle = chips[Math.floor(hash01(i * 3 + 3) * chips.length)];
    ctx.fillRect(Math.floor(p.sx), Math.floor(p.sy), 1, 1);
  }
  const brass = '#b89648';
  for (let x = 40; x < W; x += 40) floorLineX(ctx, x, 0, D, brass);
  floorLineZ(ctx, D / 2, 0, W, brass);
  // a darker border band along the walls
  floorQuad(ctx, 0, 0, W, 1.5, look.accent);
}

/** Wall-to-wall carpet: gold outer border, a stepped art-deco inner border and a faint diamond lattice. */
function drawCarpet(ctx: Ctx, look: ThemeLook): void {
  const W = RULES.roomW, D = RULES.roomD;
  const lattice = shade(look.base, 1.18);
  // faint diamond lattice over the field
  for (let x = -D; x < W + D; x += 16) {
    lineClipped(ctx, x, 0, x + D, D, lattice);
    lineClipped(ctx, x + D, 0, x, D, lattice);
  }
  // border: gold band, dark inner line, then a stepped (ziggurat) band
  floorQuad(ctx, 3, 1.5, W - 3, 4, look.accent);
  floorQuad(ctx, 3, D - 4, W - 3, D - 1.5, look.accent);
  floorQuad(ctx, 3, 1.5, 8, D - 1.5, look.accent);
  floorQuad(ctx, W - 8, 1.5, W - 3, D - 1.5, look.accent);
  const dark = shade(look.base, 0.6);
  floorLineZ(ctx, 4.5, 10, W - 10, dark);
  floorLineZ(ctx, D - 4.5, 10, W - 10, dark);
  for (let x = 16; x < W - 16; x += 12) {
    floorQuad(ctx, x, 1.5, x + 4, 3, look.base);
    floorQuad(ctx, x + 1, 1.5, x + 3, 2.2, dark);
    floorQuad(ctx, x, D - 3, x + 4, D - 1.5, look.base);
    floorQuad(ctx, x + 1, D - 2.2, x + 3, D - 1.5, dark);
  }
}

/** A floor line (x0, z0)→(x1, z1) clipped to the floor rectangle. */
function lineClipped(ctx: Ctx, x0: number, z0: number, x1: number, z1: number, color: string): void {
  const W = RULES.roomW;
  // clip along x; the lattice lines are diagonal with |dx| = |dz|
  const t0 = x0 < 0 ? -x0 / (x1 - x0) : x0 > W ? (W - x0) / (x1 - x0) : 0;
  const t1 = x1 < 0 ? -x0 / (x1 - x0) : x1 > W ? (W - x0) / (x1 - x0) : 1;
  if (t1 <= t0) return;
  const ax = x0 + (x1 - x0) * t0, az = z0 + (z1 - z0) * t0;
  const bx = x0 + (x1 - x0) * t1, bz = z0 + (z1 - z0) * t1;
  const a = project(ax, az), b = project(bx, bz);
  line(ctx, a.sx, a.sy, b.sx, b.sy, color);
}

/** Rug in the middle of the floor, tinted from the wall colour: gold border, stepped medallion, fringes. */
export function drawRug(ctx: Ctx, wall: string): void {
  const x0 = 62, x1 = 138, z0 = 13, z1 = 31;
  floorQuad(ctx, x0, z0, x1, z1, '#c9a36b');
  floorQuad(ctx, x0 + 3, z0 + 2, x1 - 3, z1 - 2, shade(wall, 0.7));
  floorQuad(ctx, x0 + 5, z0 + 3, x1 - 5, z1 - 3, shade(wall, 0.9));
  const mid = (x0 + x1) / 2, midZ = (z0 + z1) / 2;
  const diamond = (w: number, d: number, color: string) =>
    floorPoly(ctx, [[mid, midZ - d], [mid + w, midZ], [mid, midZ + d], [mid - w, midZ]], color);
  diamond(22, 6, '#c9a36b');
  diamond(18, 5, shade(wall, 0.55));
  diamond(10, 3, shade(wall, 1.3));
  for (const cx of [x0 + 9, x1 - 9]) {
    floorQuad(ctx, cx - 2, midZ - 1.5, cx + 2, midZ + 1.5, '#c9a36b');
  }
  for (let z = z0 + 1; z < z1; z += 3) {
    for (const [xa, xb] of [[x0 - 3, x0], [x1, x1 + 3]] as const) {
      const a = project(xa, z), b = project(xb, z);
      line(ctx, a.sx, a.sy, b.sx, b.sy, '#e8dcb0');
    }
  }
}
