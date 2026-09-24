import { RULES } from '../logic/rules';

/** Screen layout of one room view (logical pixels inside a 320×100 half; HUD below y=80). */
export const VIEW = {
  backLeft: 60,
  backRight: 260,
  wallTop: 6,
  backY: 46,
  frontLeft: 20,
  frontRight: 300,
  frontY: 78,
  viewH: 80,
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
