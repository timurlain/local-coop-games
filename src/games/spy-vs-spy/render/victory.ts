import { cs } from '../../../shared/i18n/cs';
import { HALVES, LOGICAL_W, withViewport } from '../../../shared/splitscreen';
import { RULES } from '../logic/rules';
import type { GameState, PlayerId, Spy } from '../logic/state';
import { line, r, text } from './draw';
import { VIEW, project } from './geometry';
import { drawRoom } from './room';
import type { SpyPalette } from './sprite-data';
import { drawIcon, drawKufrikInHand, drawSprite, spyImage } from './sprites';
import { walkFrame } from './spy';

type Ctx = CanvasRenderingContext2D;
const T = cs.spy;

export const VICTORY_DURATION = 6;
export const VICTORY_SKIPPABLE_AFTER = 1;
/** Scene time when the winner starts laughing. */
export const LAUGH_AT = 1;
/** Scene time when the mob starts storming in. */
export const MOB_AT = 1.2;
export const MOB_CLEARANCE = 16;
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

/** Screen x of each mob member `t` seconds into the scene; half enter from the left, half from the right, and stop in a ring around the loser. */
export function mobPositions(t: number, loserX: number): MobMember[] {
  const walked = Math.max(0, t - MOB_AT) * MOB_SPEED;
  const mob: MobMember[] = [];
  for (let i = 0; i < MOB_SIZE; i++) {
    const fromLeft = i % 2 === 0;
    const rank = Math.floor(i / 2);
    const start = fromLeft ? -12 - rank * MOB_GAP : LOGICAL_W + 12 + rank * MOB_GAP;
    const rawStop = fromLeft ? loserX - MOB_CLEARANCE - rank * MOB_GAP : loserX + MOB_CLEARANCE + rank * MOB_GAP;
    const stop = Math.min(LOGICAL_W - 6, Math.max(6, rawStop));
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

function drawRunway(ctx: Ctx, winner: Spy, t: number, now: number): void {
  r(ctx, 0, 0, 320, 100, '#6cb4e8');
  r(ctx, 0, 70, 320, 30, '#4a4a52');
  for (let x = 8; x < 320; x += 24) r(ctx, x, 84, 12, 2, '#f4f4f4');
  // embassy corner with the open exit door
  r(ctx, 0, 10, 60, 60, '#8a6b4f');
  r(ctx, 36, 34, 18, 36, '#2e7dd1');
  drawIcon(ctx, 'plane', 45, 32);
  drawPlane(ctx, 250, 66);

  const walk = Math.min(1, t / LAUGH_AT);
  const x = 50 + walk * 90;
  const laughing = t >= LAUGH_AT;
  const frame = laughing ? (Math.floor(now * 6) % 2 === 0 ? 'laugh1' : 'laugh2') : walkFrame(now);
  drawSprite(ctx, spyImage(palette(winner), frame), x, 78);
  drawKufrikInHand(ctx, frame, x, 78);
  if (laughing) {
    const bx = x + 14;
    const by = 36;
    r(ctx, bx, by, 60, 14, '#ffffff');
    r(ctx, bx + 2, by + 14, 4, 4, '#ffffff');
    text(ctx, T.laugh, bx + 30, by + 10, '#111111', 8, 'center');
  }
}

function drawPlane(ctx: Ctx, x: number, y: number): void {
  r(ctx, x - 40, y - 14, 80, 10, '#f4f4f4');
  r(ctx, x + 40, y - 12, 6, 6, '#f4f4f4');
  r(ctx, x - 40, y - 24, 8, 10, '#d23c3c');
  r(ctx, x - 10, y - 8, 30, 4, '#cfcfcf');
  for (let i = 0; i < 7; i++) r(ctx, x - 30 + i * 9, y - 12, 3, 3, '#3a78d8');
  r(ctx, x - 20, y - 4, 2, 4, '#222222');
  r(ctx, x + 24, y - 4, 2, 4, '#222222');
}

function drawMobbed(ctx: Ctx, state: GameState, loser: Spy, t: number, now: number): void {
  const shaking = t > MOB_AT + 1.8;
  const shake = shaking ? (Math.floor(now * 30) % 2 === 0 ? 1 : -1) : 0;
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, LOGICAL_W, VIEW.viewH);
  ctx.clip();
  ctx.translate(shake, 0);
  drawRoom(ctx, state, loser.room, null, now);

  const onFloor = loser.mode === 'normal' || loser.mode === 'searching';
  const { sx, sy } = project(onFloor ? loser.x : RULES.roomW / 2, onFloor ? loser.z : RULES.roomD / 2);
  const tremble = Math.floor(now * 25) % 2 === 0 ? 1 : 0;
  drawSprite(ctx, spyImage(palette(loser), 'stand'), sx + tremble, sy, loser.facing < 0);
  text(ctx, '!', sx, sy - 24, '#ff5050', 10, 'center');

  for (const m of mobPositions(t, sx)) drawMobMember(ctx, m, sy, now);
  if (t > MOB_AT + 1) text(ctx, T.mobShout, 160, 20, '#ff5050', 12, 'center');
  ctx.restore();

  r(ctx, 0, VIEW.viewH, 320, 20, '#0c0c12');
  text(ctx, T.caught(name(loser)), 160, VIEW.viewH + 13, '#ff5050', 8, 'center');
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
