// Where a room's people stand: strength 0–9 = number of people; front row of 5, back row of 4 (smaller,
// higher). Returned back row first so the caller can draw in order. Pure.

export const STAGE_W = 480;
export const STAGE_H = 200;
export const FLOOR_Y = 168;
export const CROWD_MIN_X = 250;
export const CROWD_MAX_X = 465;
const FRONT = 5;
const BACK = 4;

export interface CrowdSlot {
  readonly x: number;
  /** Ground line of this person, stage units (y down). */
  readonly ground: number;
  readonly scale: number;
  /** 0 = front, 1 = back. */
  readonly row: 0 | 1;
  /** Phase offset so idle animations do not move in lockstep. */
  readonly phase: number;
}

export function crowdSlots(strength: number): CrowdSlot[] {
  const n = Math.max(0, Math.min(FRONT + BACK, Math.round(strength)));
  const front = Math.min(n, FRONT);
  const back = n - front;
  const slots: CrowdSlot[] = [];
  for (let i = 0; i < back; i++) slots.push({ x: 285 + i * 44, ground: FLOOR_Y - 14, scale: 0.82, row: 1, phase: 0.37 * (i + 5) });
  for (let i = 0; i < front; i++) slots.push({ x: 262 + i * 44, ground: FLOOR_Y, scale: 1, row: 0, phase: 0.37 * i });
  return slots;
}
