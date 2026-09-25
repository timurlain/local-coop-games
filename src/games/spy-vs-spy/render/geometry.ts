import { RULES } from '../logic/rules';
import { ROOM } from './layout';

const CX = ROOM.x + ROOM.w / 2;
/** Screen px per logic unit along the back wall; furniture and decorations are drawn at this scale. */
const WALL_SCALE = 0.75;
const BACK_HALF = (RULES.roomW * WALL_SCALE) / 2;
const FRONT_HALF = 96;

/** Screen layout of one room view (logical pixels of a 320×100 half), inside the `ROOM` rectangle. */
export const VIEW = {
  /** edges of the room view */
  left: ROOM.x,
  right: ROOM.x + ROOM.w,
  top: ROOM.y,
  bottom: ROOM.y + ROOM.h,
  cx: CX,
  backLeft: CX - BACK_HALF,
  backRight: CX + BACK_HALF,
  wallTop: ROOM.y + 5,
  backY: ROOM.y + 41,
  frontLeft: CX - FRONT_HALF,
  frontRight: CX + FRONT_HALF,
  frontY: ROOM.y + 74,
  scale: WALL_SCALE,
} as const;

/** Floor coordinates (x, z) → screen point on the floor trapezoid. */
export function project(x: number, z: number): { sx: number; sy: number } {
  const t = z / RULES.roomD;
  const left = VIEW.backLeft + (VIEW.frontLeft - VIEW.backLeft) * t;
  const right = VIEW.backRight + (VIEW.frontRight - VIEW.backRight) * t;
  return {
    sx: left + (x / RULES.roomW) * (right - left),
    sy: VIEW.backY + (VIEW.frontY - VIEW.backY) * t,
  };
}

/** Screen x of a back-wall position (logic units), e.g. a furniture slot. */
export function wallX(x: number): number {
  return VIEW.backLeft + x * VIEW.scale;
}

/** Screen px per logic unit at depth z: the wall scale at the back, growing towards the viewer with the floor. */
export function floorScale(z: number): number {
  return (project(RULES.roomW, z).sx - project(0, z).sx) / RULES.roomW;
}

/**
 * Where a furniture piece stands on screen and how big it is drawn (round 5 §5): wall pieces (z 0) on the back wall's
 * floor line at the wall scale, free-standing ones on the floor at their front edge, scaled with the perspective.
 */
export function furnitureBase(f: { x: number; z: number }): { x: number; y: number; k: number } {
  const { sx, sy } = project(f.x, f.z);
  return { x: sx, y: sy, k: floorScale(f.z) };
}

/** The hiding spot of a piece, where things pop out and traps fly in: a little above its floor line, at its centre. */
export function hidingSpot(f: { x: number; z: number }): { x: number; y: number } {
  const b = furnitureBase(f);
  return { x: Math.round(b.x), y: Math.round(b.y) - 5 };
}
