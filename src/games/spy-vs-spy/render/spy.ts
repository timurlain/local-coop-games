import { RULES } from '../logic/rules';
import { sameRoomOpponent } from '../logic/fight';
import { doorAt } from '../logic/places';
import { isActive, type Dir, type GameState, type Placing, type Spy } from '../logic/state';
import { line, r, text } from './draw';
import { VIEW, hidingSpot, project } from './geometry';
import { doorCentre } from './room';
import { SPY_FRAMES, SPY_H, SPY_STAND_BACK, SPY_STAND_H, SPY_STAND_REACH, type SpyFrame, type SpyPalette } from './sprite-data';
import type { EffectPose } from './effects';
import { drawIconScaled, drawInHand, drawSpySprite, handOutline, handPoint, heldIcon, spyImage, type HandIcon } from './sprites';

type Ctx = CanvasRenderingContext2D;

const lastKey = new Map<number, string>();
const movingUntil = new Map<number, number>();
const lastActivity = new Map<number, string>();
const stillSince = new Map<number, number>();

/** Everything that shows a spy doing something; while it stays the same he stands idle. */
function activityKey(s: Spy): string {
  return [
    s.room, s.x.toFixed(1), s.z.toFixed(1), s.facing, s.mode, s.placing !== null, s.blocking, s.ducking, s.swingAnim > 0,
    s.refuseTimer > 0, s.selected, s.hand?.kind ?? '-', s.mapOpen,
  ].join(':');
}

/**
 * Call once per rendered frame, before drawing, so walk animation doesn't flicker between the two views. It also
 * notes how long each spy has stood idle (render-only, for the giggle).
 */
export function trackMotion(spies: readonly Spy[], now: number): void {
  for (const s of spies) {
    const key = `${s.room}:${s.x.toFixed(1)}:${s.z.toFixed(1)}`;
    if (lastKey.get(s.id) !== key) {
      lastKey.set(s.id, key);
      movingUntil.set(s.id, now + 0.15);
    }
    const act = activityKey(s);
    if (lastActivity.get(s.id) !== act) {
      lastActivity.set(s.id, act);
      stillSince.set(s.id, now);
    }
  }
}

/** Seconds the spy has stood idle, as seen by trackMotion. */
export function idleTime(id: number, now: number): number {
  return now - (stillSince.get(id) ?? now);
}

/** The spy is busy (on guard, in an effect pose): his idle clock starts again. */
function busy(id: number, now: number): void {
  stillSince.set(id, now);
}

/** Idle this long before the first giggle, seconds ... */
export const GIGGLE_IDLE = 3;
/** ... one giggle lasts this long ... */
export const GIGGLE_LENGTH = 1;
/** ... and starts again this often while he stays idle. */
export const GIGGLE_EVERY = 4;
const GIGGLE_FPS = 6;

/** Giggle frame `t` seconds into a giggle: the head bobs between the two frames. */
export function giggleFrame(t: number): 'giggle1' | 'giggle2' {
  return Math.floor(t * GIGGLE_FPS) % 2 === 0 ? 'giggle1' : 'giggle2';
}

/** A spy idle for `idle` seconds giggles to himself (after GIGGLE_IDLE, for GIGGLE_LENGTH every GIGGLE_EVERY), else null. */
export function idleGiggle(idle: number): SpyFrame | null {
  if (idle < GIGGLE_IDLE) return null;
  const t = (idle - GIGGLE_IDLE) % GIGGLE_EVERY;
  return t < GIGGLE_LENGTH ? giggleFrame(t) : null;
}

export function baseColor(spy: Spy): SpyPalette {
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
  const fighting = inFight(state, spy);
  if (fighting || pose !== null) busy(spy.id, now);
  const frame = pickFrame(spy, fighting, moving, now, pose, idleTime(spy.id, now));
  // A blocking spy stands still (facing no longer follows the stick), so the open umbrella turns to the attacker.
  const opponent = spy.blocking ? sameRoomOpponent(state, spy) : null;
  const flip = opponent !== null ? opponent.x < spy.x : spy.facing < 0;
  drawSpySprite(ctx, spyImage(baseColor(spy), frame), sx, sy, flip);
  const { front, back } = handItems(spy, frame);
  const outline = handOutline(baseColor(spy));
  if (back !== null) drawInHand(ctx, back, frame, sx, sy, flip, 'back', outline);
  if (front !== null) drawInHand(ctx, front, frame, sx, sy, flip, 'front', outline);
  if (spy.placing !== null) drawPlacing(ctx, state, spy, spy.placing, frame, sx, sy, flip);
  if (spy.refuseTimer > 0 && frame.startsWith('refuse')) drawGrumble(ctx, sx, sy, flip, now);
}

/** Frames with the umbrella in the front hand (the fight stance, swing, block, duck; round 5 §3). */
export const UMBRELLA_FRAMES: readonly SpyFrame[] = [
  'fightStand', 'fightWalk1', 'fightWalk2', 'swingWind', 'swingStrike', 'block', 'bashStrike', 'duck',
];

/**
 * What each hand shows in `frame` (round 4 §2): a selected trap goes in the front hand and the carried thing
 * (kufřík, satchel, remedy) then hangs from the back hand; with no trap selected the carried thing is in front.
 * The fight frames hold the umbrella in front, so no trap is drawn and the carried thing hangs at the back; while
 * placing, the trap is drawn flying into its target instead (`drawPlacing`).
 */
export function handItems(spy: Spy, frame: SpyFrame): { front: HandIcon | null; back: HandIcon | null } {
  const carried = heldIcon(spy.hand);
  if (UMBRELLA_FRAMES.includes(frame)) return { front: null, back: carried };
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
      return hidingSpot(state.furniture[p.target.furniture]);
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
  const y = Math.max(VIEW.top + 1, Math.round(sy - SPY_STAND_H - 5));
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
 * guard (stepping in the guard stance while moving), else walk, or stand — giggling now and then once he has stood
 * idle for `idle` seconds (see idleGiggle).
 */
export function pickFrame(
  spy: Spy, fighting: boolean, moving: boolean, now: number, pose: EffectPose | null = null, idle = 0,
): SpyFrame {
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
  if (moving) return walkFrame(now);
  return idleGiggle(idle) ?? 'stand';
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
    drawSpySprite(ctx, spyImage(baseColor(spy), 'shrug'), sx, sy, flip);
    return;
  }
  // roll away from the door: head first towards the room, curled up in the kneel, turning about its middle
  const away = dx !== 0 ? -dx : -spy.facing;
  ctx.save();
  ctx.translate(sx, sy - TUMBLE_PIVOT);
  ctx.rotate(away * angle);
  drawSpySprite(ctx, spyImage(baseColor(spy), 'placeTrap'), 0, TUMBLE_PIVOT, flip);
  ctx.restore();
}

/** Height of the middle of the kneeling figure above the floor: the tumble turns about it. */
const TUMBLE_PIVOT = Math.round((SPY_H - SPY_FRAMES.placeTrap.findIndex((r) => /[^.]/.test(r))) / 2);

function drawDeath(ctx: Ctx, spy: Spy, sx: number, sy: number, now: number): void {
  const elapsed = RULES.respawnTime - spy.modeTimer;
  const flip = spy.facing < 0;

  if (elapsed >= 1.2) {
    const rise = (elapsed - 1.2) * 25;
    ctx.save();
    ctx.globalAlpha = 0.6;
    drawSpySprite(ctx, spyImage('ghost', 'stand'), sx, sy - rise, flip);
    ctx.strokeStyle = '#e8c547';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(sx, sy - rise - SPY_STAND_H - 2, 7, 2, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
    return;
  }

  switch (spy.deathCause) {
    case 'bomba':
    case 'casovana': {
      drawSpySprite(ctx, spyImage('sooty', 'stand'), sx, sy, flip);
      ctx.save();
      ctx.globalAlpha = Math.max(0, 0.8 - elapsed * 0.6);
      ctx.fillStyle = '#9a9a9a';
      for (const dx of [-7, 0, 7]) {
        ctx.beginPath();
        ctx.arc(sx + dx, sy - SPY_STAND_H - elapsed * 12, 4 + elapsed * 3, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
      break;
    }
    case 'pruzina':
      for (let i = 0; i < 4; i++) line(ctx, sx - 3, sy - i * 3, sx + 3, sy - i * 3 - 1.5, '#cfcfcf');
      drawSpySprite(ctx, spyImage(baseColor(spy), 'stand'), sx, sy - 12 - elapsed * 120, flip);
      break;
    case 'elektrina':
      drawSpySprite(ctx, spyImage('soaked', 'stand'), sx, sy, flip);
      if (Math.floor(now * 12) % 2 === 0) {
        line(ctx, sx - 12, sy - 30, sx - 6, sy - 21, '#ffeb3b');
        line(ctx, sx + 12, sy - 27, sx + 6, sy - 15, '#ffeb3b');
      }
      break;
    case 'pistole': {
      drawSpySprite(ctx, spyImage(baseColor(spy), 'stand'), sx, sy, flip);
      // the BANG! card beside the head, clear of the nose
      const fx = sx + (flip ? -(SPY_STAND_REACH + 24) : SPY_STAND_REACH + 2);
      r(ctx, fx, sy - 40, 22, 9, '#f4f4f4');
      text(ctx, 'BANG!', fx + 11, sy - 33, '#d23c3c', 6, 'center');
      break;
    }
    default:
      // fight: knocked flat
      ctx.save();
      // the sprite lies on its back, the back of the coat on the floor
      ctx.translate(sx, sy - SPY_STAND_BACK);
      ctx.rotate(((flip ? 1 : -1) * Math.PI) / 2);
      drawSpySprite(ctx, spyImage('sooty', 'stand'), 0, SPY_H / 2, flip);
      ctx.restore();
  }
}
