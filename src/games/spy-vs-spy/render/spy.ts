import { RULES } from '../logic/rules';
import { sameRoomOpponent } from '../logic/fight';
import { isActive, type Dir, type GameState, type Spy } from '../logic/state';
import { line, r, text } from './draw';
import { project } from './geometry';
import { SPY_H, SPY_W, type SpyFrame, type SpyPalette } from './sprite-data';
import type { EffectPose } from './effects';
import { drawInHand, drawSprite, heldIcon, spyImage } from './sprites';

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
  const held = heldIcon(spy.hand);
  if (held !== null) drawInHand(ctx, held, frame, sx, sy, flip);
}

export const WALK_CYCLE: readonly SpyFrame[] = ['walk1', 'walk2', 'walk3', 'walk4'];

/** Walk cycle frame at ~8 fps. */
export function walkFrame(now: number): SpyFrame {
  return WALK_CYCLE[Math.floor(now * 8) % WALK_CYCLE.length];
}

/** Dig frames alternate at ~6 fps while searching. */
export function digFrame(now: number): SpyFrame {
  return Math.floor(now * 6) % 2 === 0 ? 'searchDig1' : 'searchDig2';
}

/**
 * Swing (wind-up, then the jab or head-bash strike), block and duck always show; then an effect pose (search/hide feedback `liftFind`, `shrug`, `hidePut`; the trap-death `laugh1`/`laugh2`) while the spy
 * isn't moving — walking away cancels the pose so the spy doesn't glide frozen; a running search keeps digging
 * (it completes even when the opponent walks in); otherwise an active opponent in the room puts the spy on
 * guard, else walk or stand.
 */
export function pickFrame(spy: Spy, fighting: boolean, moving: boolean, now: number, pose: EffectPose | null = null): SpyFrame {
  if (spy.swingAnim > 0 && spy.attack !== null) {
    if (spy.strikeIn > 0) return 'swingWind';
    return spy.attack === 'bash' ? 'bashStrike' : 'swingStrike';
  }
  if (spy.blocking) return 'block';
  if (spy.ducking) return 'duck';
  if (pose !== null && !moving) return pose;
  if (spy.mode === 'searching') return digFrame(now);
  if (fighting) return 'fightStand';
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
