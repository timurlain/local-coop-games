import { RULES } from '../logic/rules';
import { sameRoomOpponent } from '../logic/fight';
import { doorAt } from '../logic/places';
import { isActive, type Dir, type GameState, type Placing, type Spy } from '../logic/state';
import { line, r, text } from './draw';
import { VIEW, project, wallX } from './geometry';
import { doorCentre } from './room';
import { SPY_H, SPY_W, type SpyFrame, type SpyPalette } from './sprite-data';
import type { EffectPose } from './effects';
import { drawIconScaled, drawInHand, drawSprite, handPoint, heldIcon, spyImage, type HandIcon } from './sprites';

type Ctx = CanvasRenderingContext2D;

const lastKey = new Map<number, string>();
const movingUntil = new Map<number, number>();

/** Call once per rendered frame, before drawing, so walk animation doesn't flicker between the two views. */
export function trackMotion(spies: readonly Spy[], now: number): void {
  for (const s of spies) {
    const key = `${s.room}:${s.x.toFixed(1)}:${s.z.toFixed(1)}`;
    if (lastKey.get(s.id) !== key) {
      lastKey.set(s.id, key);
      movingUntil.set(s.id, now + 0.15);
    }
  }
}

function baseColor(spy: Spy): SpyPalette {
  return spy.id === 0 ? 'white' : 'black';
}

/** True while an active opponent shares the spy's room: the spy stands ready to fight. */
export function inFight(state: GameState, spy: Spy): boolean {
  return isActive(spy) && sameRoomOpponent(state, spy) !== null;
}

/** `pose` is the effect-queue override (search/hide feedback, trap-death laugh; see effects.ts). */
export function drawSpy(ctx: Ctx, state: GameState, spy: Spy, now: number, pose: EffectPose | null = null): void {
  if (spy.mode === 'out' || spy.mode === 'escaped') return;
  const { sx, sy } = project(spy.x, spy.z);
  if (spy.mode === 'dead') {
    drawDeath(ctx, spy, sx, sy, now);
    return;
  }
  const exit = state.rooms[spy.room].exit;
  if (spy.kickTimer > 0 && exit !== null) {
    drawTumble(ctx, spy, exit);
    return;
  }
  const moving = spy.mode === 'normal' && (movingUntil.get(spy.id) ?? 0) > now;
  const frame = pickFrame(spy, inFight(state, spy), moving, now, pose);
  const flip = spy.facing < 0;
  drawSprite(ctx, spyImage(baseColor(spy), frame), sx, sy, flip);
  const { front, back } = handItems(spy, frame);
  if (back !== null) drawInHand(ctx, back, frame, sx, sy, flip, 'back');
  if (front !== null) drawInHand(ctx, front, frame, sx, sy, flip);
  if (spy.placing !== null) drawPlacing(ctx, state, spy, spy.placing, frame, sx, sy, flip);
  if (spy.refuseTimer > 0 && frame.startsWith('refuse')) drawGrumble(ctx, sx, sy, flip, now);
}

/** Frames with the club drawn in the front hand (the fight stance, swing, block, duck). */
export const CLUB_FRAMES: readonly SpyFrame[] = [
  'fightStand', 'fightWalk1', 'fightWalk2', 'swingWind', 'swingStrike', 'block', 'bashStrike', 'duck',
];

/**
 * What each hand shows in `frame` (round 4 §2): a selected trap goes in the front hand and the carried thing
 * (kufřík, satchel, remedy) then hangs from the back hand; with no trap selected the carried thing is in front.
 * The club frames hold the club in front, so no trap is drawn and the carried thing hangs at the back; while
 * placing, the trap is drawn flying into its target instead (`drawPlacing`).
 */
export function handItems(spy: Spy, frame: SpyFrame): { front: HandIcon | null; back: HandIcon | null } {
  const carried = heldIcon(spy.hand);
  if (CLUB_FRAMES.includes(frame)) return { front: null, back: carried };
  if (spy.selected === null) return { front: carried, back: null };
  return { front: spy.placing === null ? spy.selected : null, back: carried };
}

/** 0 → 1 over the placing time (round 4 §4). */
export function placeProgress(p: Placing): number {
  return Math.min(1, Math.max(0, 1 - p.timer / RULES.placeTime));
}

/** Screen point the trap being placed flies into: the furniture's hiding spot, the door opening or the floor. */
function placeTargetPoint(state: GameState, spy: Spy, p: Placing, sx: number, sy: number): { x: number; y: number } {
  switch (p.target.on) {
    case 'furniture':
      return { x: Math.round(wallX(state.furniture[p.target.furniture].x)), y: VIEW.backY - 5 };
    case 'door': {
      const dir = doorAt(state, spy);
      return dir === null ? { x: sx, y: sy - 4 } : doorCentre(dir);
    }
    case 'floor':
      return { x: sx + spy.facing * 9, y: sy - 3 };
  }
}

/** The trap icon leaving the hand and shrinking into its target over the placing time. */
function drawPlacing(
  ctx: CanvasRenderingContext2D, state: GameState, spy: Spy, p: Placing, frame: SpyFrame, sx: number, sy: number, flip: boolean,
): void {
  const k = placeProgress(p);
  const { hx, hy } = handPoint(frame, sx, sy, flip);
  const to = placeTargetPoint(state, spy, p, sx, sy);
  const e = k * k * (3 - 2 * k);
  drawIconScaled(ctx, p.trap, hx + (to.x - hx) * e, hy + 3 + (to.y - hy - 3) * e, 1 - 0.75 * e);
}

/** A tiny grey grumble cloud above the head during the head shake, with a scribble in it. */
function drawGrumble(ctx: CanvasRenderingContext2D, sx: number, sy: number, flip: boolean, now: number): void {
  const x = Math.round(sx + (flip ? 5 : -5));
  const y = Math.max(VIEW.top + 1, Math.round(sy - SPY_H - 5));
  const bob = Math.floor(now * 8) % 2;
  const cloud = '#b8b8bc';
  r(ctx, x - 4, y + 1 - bob, 9, 3, cloud);
  r(ctx, x - 3, y - bob, 3, 1, cloud);
  r(ctx, x + 1, y - 1 - bob, 3, 2, cloud);
  r(ctx, x - 3, y + 4 - bob, 7, 1, cloud);
  // the scribble: a little zigzag of dark pixels
  for (let i = 0; i < 5; i++) r(ctx, x - 2 + i, y + 1 + ((i + bob) % 2) - bob, 1, 1, '#3a3a40');
  r(ctx, x + (flip ? 3 : -3), y + 6 - bob, 1, 1, cloud);
}

export const WALK_CYCLE: readonly SpyFrame[] = ['walk1', 'walk2', 'walk3', 'walk4'];

/** Walk cycle frame at ~8 fps. */
export function walkFrame(now: number): SpyFrame {
  return WALK_CYCLE[Math.floor(now * 8) % WALK_CYCLE.length];
}

/** Stepping on guard in a shared room (spec §4): legs apart, legs passing. */
export const FIGHT_WALK_CYCLE: readonly SpyFrame[] = ['fightWalk1', 'fightWalk2'];

/** Fight walk frame at ~8 fps, in step with the walk cycle's stride / pass rhythm. */
export function fightWalkFrame(now: number): SpyFrame {
  return FIGHT_WALK_CYCLE[Math.floor(now * 8) % FIGHT_WALK_CYCLE.length];
}

/** Head shake frames alternate at ~8 fps (round 4 §4). */
export function refuseFrame(now: number): SpyFrame {
  return Math.floor(now * 8) % 2 === 0 ? 'refuse1' : 'refuse2';
}

/** Dig frames alternate at ~6 fps while searching. */
export function digFrame(now: number): SpyFrame {
  return Math.floor(now * 6) % 2 === 0 ? 'searchDig1' : 'searchDig2';
}

/**
 * Swing (wind-up, then the jab or head-bash strike), block and duck always show; then putting a trap down
 * (`placeTrap`) and the head shake (`refuse1`/`refuse2`, shown even while walking — it is only visual); then an effect pose (search/hide feedback `liftFind`, `shrug`, `hidePut`; the trap-death `laugh1`/`laugh2`) while the spy
 * isn't moving — walking away cancels the pose so the spy doesn't glide frozen; a running search keeps digging
 * (it completes even when the opponent walks in); otherwise an active opponent in the room puts the spy on
 * guard (stepping in the guard stance while moving), else walk or stand.
 */
export function pickFrame(spy: Spy, fighting: boolean, moving: boolean, now: number, pose: EffectPose | null = null): SpyFrame {
  if (spy.swingAnim > 0 && spy.attack !== null) {
    if (spy.strikeIn > 0) return 'swingWind';
    return spy.attack === 'bash' ? 'bashStrike' : 'swingStrike';
  }
  if (spy.blocking) return 'block';
  if (spy.ducking) return 'duck';
  if (spy.placing !== null) return 'placeTrap';
  if (spy.refuseTimer > 0) return refuseFrame(now);
  if (pose !== null && !moving) return pose;
  if (spy.mode === 'searching') return digFrame(now);
  if (fighting) return moving ? fightWalkFrame(now) : 'fightStand';
  return moving ? walkFrame(now) : 'stand';
}

/** Share of the kick's flight spent rolling back from the doorway; the spy then sits there, indignant. */
const ROLL_SHARE = 0.4;

/**
 * The kicked spy's tumble `elapsed` seconds after the guard's kick (spec §9): `back` is how much of the
 * `RULES.guardKick` flight is still ahead of it (1 = still in the doorway, 0 = landed at its logic position) and
 * `angle` the backward roll so far (radians, 0..2π, 0 once landed).
 */
export function tumble(elapsed: number): { back: number; angle: number } {
  const u = elapsed / (RULES.guardKickTime * ROLL_SHARE);
  if (u >= 1) return { back: 0, angle: 0 };
  const k = Math.max(0, u);
  return { back: 1 - k * (2 - k), angle: 2 * Math.PI * k };
}

const EXIT_STEP: Readonly<Record<Dir, readonly [number, number]>> = { N: [0, -1], S: [0, 1], W: [-1, 0], E: [1, 0] };

/** A spy kicked back by the airport guard: rolls back from the exit, curled up, then lands with its hands up. */
function drawTumble(ctx: Ctx, spy: Spy, exit: Dir): void {
  const { back, angle } = tumble(RULES.guardKickTime - spy.kickTimer);
  const [dx, dz] = EXIT_STEP[exit];
  const { sx, sy } = project(spy.x + dx * back * RULES.guardKick, spy.z + dz * back * RULES.guardKick);
  const flip = spy.facing < 0;
  if (back === 0) {
    drawSprite(ctx, spyImage(baseColor(spy), 'shrug'), sx, sy, flip);
    return;
  }
  // roll away from the door: head first towards the room
  const away = dx !== 0 ? -dx : -spy.facing;
  ctx.save();
  ctx.translate(sx, sy - SPY_H / 2);
  ctx.rotate(away * angle);
  drawSprite(ctx, spyImage(baseColor(spy), 'duck'), 0, SPY_H / 2, flip);
  ctx.restore();
}

function drawDeath(ctx: Ctx, spy: Spy, sx: number, sy: number, now: number): void {
  const elapsed = RULES.respawnTime - spy.modeTimer;
  const flip = spy.facing < 0;

  if (elapsed >= 1.2) {
    const rise = (elapsed - 1.2) * 25;
    ctx.save();
    ctx.globalAlpha = 0.6;
    drawSprite(ctx, spyImage('ghost', 'stand'), sx, sy - rise, flip);
    ctx.strokeStyle = '#e8c547';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(sx, sy - rise - SPY_H - 2, 7, 2, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
    return;
  }

  switch (spy.deathCause) {
    case 'bomba':
    case 'casovana': {
      drawSprite(ctx, spyImage('sooty', 'stand'), sx, sy, flip);
      ctx.save();
      ctx.globalAlpha = Math.max(0, 0.8 - elapsed * 0.6);
      ctx.fillStyle = '#9a9a9a';
      for (const dx of [-7, 0, 7]) {
        ctx.beginPath();
        ctx.arc(sx + dx, sy - SPY_H - elapsed * 12, 4 + elapsed * 3, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
      break;
    }
    case 'pruzina':
      for (let i = 0; i < 4; i++) line(ctx, sx - 3, sy - i * 3, sx + 3, sy - i * 3 - 1.5, '#cfcfcf');
      drawSprite(ctx, spyImage(baseColor(spy), 'stand'), sx, sy - 12 - elapsed * 120, flip);
      break;
    case 'elektrina':
      drawSprite(ctx, spyImage('soaked', 'stand'), sx, sy, flip);
      if (Math.floor(now * 12) % 2 === 0) {
        line(ctx, sx - 12, sy - 30, sx - 6, sy - 21, '#ffeb3b');
        line(ctx, sx + 12, sy - 27, sx + 6, sy - 15, '#ffeb3b');
      }
      break;
    case 'pistole': {
      drawSprite(ctx, spyImage(baseColor(spy), 'stand'), sx, sy, flip);
      const fx = sx + (flip ? -34 : 12);
      r(ctx, fx, sy - 40, 22, 9, '#f4f4f4');
      text(ctx, 'BANG!', fx + 11, sy - 33, '#d23c3c', 6, 'center');
      break;
    }
    default:
      // fight: knocked flat
      ctx.save();
      ctx.translate(sx, sy - SPY_W / 2); // the sprite lies on its back, its width resting on the floor
      ctx.rotate(((flip ? 1 : -1) * Math.PI) / 2);
      drawSprite(ctx, spyImage('sooty', 'stand'), 0, SPY_H / 2, flip);
      ctx.restore();
  }
}
