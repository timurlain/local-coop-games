import { cs } from '../../../shared/i18n/cs';
import { HALVES, LOGICAL_W, withViewport } from '../../../shared/splitscreen';
import { RULES } from '../logic/rules';
import type { GameState, PlayerId, Spy } from '../logic/state';
import { line, r, text } from './draw';
import { GROUND_ATTITUDE, drawAirfield, drawAirliner } from './airfield';
import { VIEW, project } from './geometry';
import { drawFrame } from './hud';
import { ROOM, UNDER } from './layout';
import { drawRoom } from './room';
import { SPY_STAND_H, SPY_STAND_REACH, type SpyPalette } from './sprite-data';
import { drawKufrikInHand, drawSpySprite, handOutline, spyImage } from './sprites';
import { walkFrame } from './spy';
import { drawCable, drawDevice } from './trapulator';

type Ctx = CanvasRenderingContext2D;
const T = cs.spy;

export const VICTORY_DURATION = 7.5;
export const VICTORY_SKIPPABLE_AFTER = 1;
/** Scene time when the winner starts laughing. */
export const LAUGH_AT = 1;
/** Scene time when the winner stops laughing and heads for the plane. */
export const LAUGH_END = 2.4;
/** Scene time when the winner reaches the boarding steps and gets in. */
export const BOARD_AT = 3.2;
/** Scene time when the airliner starts to taxi. */
export const TAXI_AT = 3.6;
/** Feet of the winner and wheels of the plane on the airfield, screen y. */
export const GROUND_Y = 84;
/** Where the airliner stands (its centre) until it taxis, screen x. */
export const PLANE_X = 176;
/** Cabin door (and boarding steps) relative to the plane's centre. */
export const DOOR_DX = -48;
const WINNER_START_X = 24;
const WINNER_LAUGH_X = 66;
const TAXI_ACCEL = 30;
/** Plane centre x at which the wheels leave the grass. */
const LIFT_X = 230;
const CLIMB = 0.005;
const MAX_PITCH = 0.28;
/** Scene time when the mob starts storming in. */
export const MOB_AT = 1.2;
/** The spy's reach from his centre line (the nose) plus half a mob member and a gap, so nobody stands inside the loser. */
export const MOB_CLEARANCE = SPY_STAND_REACH + 4 + 4;
const MOB_SIZE = 8;
const MOB_SPEED = 45;
const MOB_GAP = 11;
const MOB_COLORS = ['#a33b3b', '#3a78d8', '#3fa34d', '#8b5a2b', '#7a4fa0', '#c9a36b', '#d2763c', '#4f6b8a'];

export interface MobMember {
  x: number;
  facing: -1 | 1;
  color: string;
  torch: boolean;
}

/**
 * Screen x of each mob member `t` seconds into the scene; half enter from the left, half from the right, and stop in a
 * ring around the loser, inside the screen span `lo`..`hi`.
 */
export function mobPositions(t: number, loserX: number, lo = 0, hi: number = LOGICAL_W): MobMember[] {
  const walked = Math.max(0, t - MOB_AT) * MOB_SPEED;
  const mob: MobMember[] = [];
  for (let i = 0; i < MOB_SIZE; i++) {
    const fromLeft = i % 2 === 0;
    const rank = Math.floor(i / 2);
    const start = fromLeft ? lo - 12 - rank * MOB_GAP : hi + 12 + rank * MOB_GAP;
    const rawStop = fromLeft ? loserX - MOB_CLEARANCE - rank * MOB_GAP : loserX + MOB_CLEARANCE + rank * MOB_GAP;
    const stop = Math.min(hi - 6, Math.max(lo + 6, rawStop));
    const x = fromLeft ? Math.min(stop, start + walked) : Math.max(stop, start - walked);
    mob.push({ x, facing: fromLeft ? 1 : -1, color: MOB_COLORS[i % MOB_COLORS.length], torch: i % 3 === 0 });
  }
  return mob;
}

function palette(spy: Spy): SpyPalette {
  return spy.id === 0 ? 'white' : 'black';
}

function name(spy: Spy): string {
  return spy.id === 0 ? T.white : T.black;
}

/** Draws the victory scene `t` seconds after the escape. `now` is wall-clock seconds for flicker. */
export function renderVictory(ctx: Ctx, scale: number, state: GameState, winner: PlayerId, t: number, now: number): void {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  const win = state.spies[winner];
  const lose = state.spies[winner === 0 ? 1 : 0];
  withViewport(ctx, scale, HALVES[win.id], () => drawRunway(ctx, win, t, now));
  withViewport(ctx, scale, HALVES[lose.id], () => drawMobbed(ctx, state, lose, t, now));
}

/** Where the winner is and what they do `t` seconds into the scene; `visible` is false once aboard. */
export function winnerPose(t: number): { x: number; laughing: boolean; visible: boolean } {
  const door = PLANE_X + DOOR_DX;
  if (t < LAUGH_AT) {
    return { x: WINNER_START_X + (WINNER_LAUGH_X - WINNER_START_X) * (Math.max(0, t) / LAUGH_AT), laughing: false, visible: true };
  }
  if (t < LAUGH_END) return { x: WINNER_LAUGH_X, laughing: true, visible: true };
  if (t < BOARD_AT) {
    const k = (t - LAUGH_END) / (BOARD_AT - LAUGH_END);
    return { x: WINNER_LAUGH_X + (door - WINNER_LAUGH_X) * k, laughing: false, visible: true };
  }
  return { x: door, laughing: false, visible: false };
}

/**
 * The airliner `t` seconds into the scene: parked, then taxiing right with constant acceleration; past `LIFT_X`
 * it leaves the grass on a parabola, nose up (`pitch` in radians), and flies out of the half. `lift` is px above
 * the ground.
 */
export function planePose(t: number): { x: number; lift: number; pitch: number } {
  const dt = Math.max(0, t - TAXI_AT);
  const x = PLANE_X + 0.5 * TAXI_ACCEL * dt * dt;
  const past = Math.max(0, x - LIFT_X);
  return { x, lift: CLIMB * past * past, pitch: Math.min(MAX_PITCH, Math.atan(2 * CLIMB * past)) };
}

function drawRunway(ctx: Ctx, winner: Spy, t: number, now: number): void {
  drawAirfield(ctx, now);
  const plane = planePose(t);
  const doorOpen = t >= BOARD_AT - 0.6 && t < TAXI_AT - 0.1;
  // the tail comes up during the take-off roll, then the climb pitches the nose up
  const roll = Math.min(1, Math.max(0, (plane.x - PLANE_X) / (LIFT_X - 30 - PLANE_X)));
  const attitude = GROUND_ATTITUDE * (1 - roll) + plane.pitch;
  drawAirliner(ctx, plane.x, GROUND_Y - plane.lift, attitude, now, DOOR_DX, t < TAXI_AT, doorOpen);

  const pose = winnerPose(t);
  if (!pose.visible) return;
  const frame = pose.laughing ? (Math.floor(now * 6) % 2 === 0 ? 'laugh1' : 'laugh2') : walkFrame(now);
  drawSpySprite(ctx, spyImage(palette(winner), frame), pose.x, GROUND_Y);
  drawKufrikInHand(ctx, frame, pose.x, GROUND_Y, false, handOutline(palette(winner)));
  if (pose.laughing) {
    const bx = pose.x + 16;
    const by = GROUND_Y - SPY_STAND_H - 12;
    r(ctx, bx, by, 60, 14, '#ffffff');
    r(ctx, bx + 2, by + 14, 4, 4, '#ffffff');
    text(ctx, T.laugh, bx + 30, by + 10, '#111111', 8, 'center');
  }
}

function drawMobbed(ctx: Ctx, state: GameState, loser: Spy, t: number, now: number): void {
  const shaking = t > MOB_AT + 1.8;
  const shake = shaking ? (Math.floor(now * 30) % 2 === 0 ? 1 : -1) : 0;
  ctx.save();
  ctx.beginPath();
  ctx.rect(ROOM.x, ROOM.y, ROOM.w, ROOM.h);
  ctx.clip();
  ctx.translate(shake, 0);
  drawRoom(ctx, state, loser.room, now);

  const onFloor = loser.mode === 'normal' || loser.mode === 'searching';
  const { sx, sy } = project(onFloor ? loser.x : RULES.roomW / 2, onFloor ? loser.z : RULES.roomD / 2);
  const tremble = Math.floor(now * 25) % 2 === 0 ? 1 : 0;
  drawSpySprite(ctx, spyImage(palette(loser), 'stand'), sx + tremble, sy, loser.facing < 0);
  text(ctx, '!', sx, sy - SPY_STAND_H - 2, '#ff5050', 10, 'center');

  for (const m of mobPositions(t, sx, VIEW.left, VIEW.right)) drawMobMember(ctx, m, sy, now);
  if (t > MOB_AT + 1) text(ctx, T.mobShout, VIEW.cx, VIEW.top + 14, '#ff5050', 12, 'center');
  ctx.restore();

  drawFrame(ctx);
  drawCable(ctx);
  drawDevice(ctx, state, loser, now);
  r(ctx, UNDER.x, UNDER.y, UNDER.w, UNDER.h, '#0c0c12');
  text(ctx, T.caught(name(loser)), UNDER.x + UNDER.w / 2, UNDER.y + 9, '#ff5050', 7, 'center');
}

function drawMobMember(ctx: Ctx, m: MobMember, floorY: number, now: number): void {
  const x = m.x;
  const arm = Math.floor(now * 6 + x) % 2 === 0 ? -3 : 0;
  r(ctx, x - 4, floorY - 14, 8, 10, m.color);
  r(ctx, x - 3, floorY - 4, 2, 4, '#3b2618');
  r(ctx, x + 1, floorY - 4, 2, 4, '#3b2618');
  r(ctx, x - 3, floorY - 20, 6, 6, '#e8b890');
  r(ctx, x + m.facing, floorY - 18, 1, 1, '#111111');
  const hx = x + m.facing * 5;
  line(ctx, hx, floorY - 10, hx, floorY - 30 + arm, '#6b4220');
  if (m.torch) {
    r(ctx, hx - 2, floorY - 34 + arm, 4, 4, Math.floor(now * 10) % 2 === 0 ? '#ff9a3c' : '#e8c547');
  } else {
    r(ctx, hx - 3, floorY - 31 + arm, 7, 1, '#9a9a9a');
    for (const dx of [-3, 0, 3]) r(ctx, hx + dx, floorY - 34 + arm, 1, 3, '#9a9a9a');
  }
}
