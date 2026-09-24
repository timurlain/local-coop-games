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
