import { RULES } from '../logic/rules';
import { line, poly, shade } from './draw';
import { project } from './geometry';

type Ctx = CanvasRenderingContext2D;

export type FloorStyle = 'parquet' | 'carpet' | 'tiles' | 'checker';

export interface ThemeLook {
  wall: string;
  floor: FloorStyle;
  /** main floor colour */
  base: string;
  /** joints / border / second checker colour */
  accent: string;
}

/** Floor quad between two (x, z) corners, projected onto the trapezoid. */
function floorQuad(ctx: Ctx, x0: number, z0: number, x1: number, z1: number, color: string): void {
  const a = project(x0, z0), b = project(x1, z0), c = project(x1, z1), d = project(x0, z1);
  poly(ctx, [[a.sx, a.sy], [b.sx, b.sy], [c.sx, c.sy], [d.sx, d.sy]], color);
}

function floorLineX(ctx: Ctx, x: number, z0: number, z1: number, color: string): void {
  const a = project(x, z0), b = project(x, z1);
  line(ctx, a.sx, a.sy, b.sx, b.sy, color);
}

function floorLineZ(ctx: Ctx, z: number, x0: number, x1: number, color: string): void {
  const a = project(x0, z), b = project(x1, z);
  line(ctx, a.sx, a.sy, b.sx, b.sy, color);
}

export function drawFloor(ctx: Ctx, look: ThemeLook): void {
  const W = RULES.roomW, D = RULES.roomD;
  floorQuad(ctx, 0, 0, W, D, look.base);
  switch (look.floor) {
    case 'parquet': {
      // planks run into the room; joints staggered row by row
      const rows = 5;
      for (let i = 1; i < rows; i++) floorLineZ(ctx, (D * i) / rows, 0, W, look.accent);
      for (let i = 0; i < rows; i++) {
        const off = i % 2 === 0 ? 0 : 12.5;
        for (let x = off + 25; x < W; x += 25) floorLineX(ctx, x, (D * i) / rows, (D * (i + 1)) / rows, look.accent);
      }
      break;
    }
    case 'carpet':
      floorQuad(ctx, 5, 2, W - 5, D - 2, look.accent);
      floorQuad(ctx, 8, 4, W - 8, D - 4, look.base);
      break;
    case 'tiles':
      for (let x = 20; x < W; x += 20) floorLineX(ctx, x, 0, D, look.accent);
      for (let z = 8; z < D; z += 8) floorLineZ(ctx, z, 0, W, look.accent);
      break;
    case 'checker':
      for (let i = 0; i < 10; i++) {
        for (let j = 0; j < 5; j++) if ((i + j) % 2 === 1) floorQuad(ctx, i * 20, j * 8, (i + 1) * 20, (j + 1) * 8, look.accent);
      }
      break;
  }
}

/** Rug in the middle of the floor, tinted from the wall colour, with a gold border and fringes. */
export function drawRug(ctx: Ctx, wall: string): void {
  const x0 = 62, x1 = 138, z0 = 13, z1 = 31;
  floorQuad(ctx, x0, z0, x1, z1, '#c9a36b');
  floorQuad(ctx, x0 + 3, z0 + 2, x1 - 3, z1 - 2, shade(wall, 0.75));
  const mid = (x0 + x1) / 2, midZ = (z0 + z1) / 2;
  const pts = [project(mid, z0 + 4), project(x1 - 12, midZ), project(mid, z1 - 4), project(x0 + 12, midZ)];
  poly(ctx, pts.map((p) => [p.sx, p.sy] as const), shade(wall, 1.15));
  for (let z = z0 + 1; z < z1; z += 3) {
    for (const [xa, xb] of [[x0 - 3, x0], [x1, x1 + 3]] as const) {
      const a = project(xa, z), b = project(xb, z);
      line(ctx, a.sx, a.sy, b.sx, b.sy, '#e0d0a0');
    }
  }
}
