// The escape scene (round 6 §5): after a successful escape and before the victory, ~7 s of pictures on the airfield
// strip showing what each secret was for. The klíč unlocks the embassy's exit door, the peníze buy a ticket at the
// pokladna while the pas is shown, passport control stamps the pas, and the spy carries the kufřík (the plány
// glowing in it) up the steps into the airliner, which taxis off. No controls; any key or button skips to the victory.
// The timeline here is pure; the draw functions below it paint one 320×100 half.

import type { SfxName } from '../../../shared/audio';
import { HALVES, withViewport } from '../../../shared/splitscreen';
import type { PlayerId } from '../logic/state';
import { disc, poly, r } from './draw';
import { GROUND_ATTITUDE, drawAirfield, drawAirliner, drawControlDesk, drawTicketBooth } from './airfield';
import { GUARD_SHOULDER_H, drawGuardAt } from './guard';
import type { IconName, SpyFrame, SpyPalette } from './sprite-data';
import { drawIconOutlined, drawKufrikInHand, drawSpySprite, handOutline, handPoint, iconImage, spyImage } from './sprites';
import { walkFrame } from './spy';

type Ctx = CanvasRenderingContext2D;

// ---------- timeline ----------

export type EscapePhaseName =
  | 'key' // the klíč flies to the exit door's lock, turns, the door swings open
  | 'toCounter'
  | 'counter' // peníze to the clerk, the pas shown, a ticket back
  | 'toControl'
  | 'control' // the officer stamps the pas
  | 'toPlane' // the kufřík with the plány glowing in it
  | 'board' // up the steps into the cabin
  | 'taxi' // the airliner rolls off
  | 'done';

/** The phases in order and their lengths, seconds. */
export const ESCAPE_PHASES: readonly (readonly [Exclude<EscapePhaseName, 'done'>, number])[] = [
  ['key', 1.3],
  ['toCounter', 0.7],
  ['counter', 1.45],
  ['toControl', 0.5],
  ['control', 1.15],
  ['toPlane', 0.8],
  ['board', 0.45],
  ['taxi', 0.9],
];

export const ESCAPE_DURATION = ESCAPE_PHASES.reduce((sum, [, d]) => sum + d, 0);
/** A press this early is still the one that ended the match; later any key or button skips the scene. */
export const ESCAPE_SKIP_AFTER = 0.25;

export interface EscapePhase {
  readonly phase: EscapePhaseName;
  /** Seconds into the phase. */
  readonly t: number;
  /** Progress through the phase, 0 → 1 (1 once done). */
  readonly k: number;
}

/** Scene time at which phase `name` starts. */
export function phaseStart(name: EscapePhaseName): number {
  let at = 0;
  for (const [n, d] of ESCAPE_PHASES) {
    if (n === name) return at;
    at += d;
  }
  return at;
}

export function escapePhase(elapsed: number): EscapePhase {
  let t = Math.max(0, elapsed);
  for (const [phase, d] of ESCAPE_PHASES) {
    if (t < d) return { phase, t, k: t / d };
    t -= d;
  }
  return { phase: 'done', t, k: 1 };
}

/** The scene is over: it ran out, or someone pressed a key or button after the first moment. */
export function escapeOver(elapsed: number, pressed: boolean): boolean {
  return elapsed >= ESCAPE_DURATION || (pressed && elapsed >= ESCAPE_SKIP_AFTER);
}

/** Each item's own short sound, at its scene time. */
export const ESCAPE_CUES: readonly (readonly [number, SfxName])[] = [
  [phaseStart('key') + 0.05, 'jingle'],
  [phaseStart('key') + 0.7, 'click'],
  [phaseStart('key') + 0.85, 'door'],
  [phaseStart('counter') + 0.05, 'coins'],
  [phaseStart('counter') + 0.45, 'paper'],
  [phaseStart('counter') + 1.1, 'paper'],
  [phaseStart('control') + 0.02, 'paper'],
  [phaseStart('control') + 0.5, 'stamp'],
  [phaseStart('taxi'), 'engine'],
];

/** The cues whose time passes when the scene clock goes from `before` to `after` (before < time ≤ after, or time 0). */
export function escapeCues(before: number, after: number): SfxName[] {
  return ESCAPE_CUES.filter(([at]) => (before < at || (before <= 0 && at <= 0)) && at <= after).map(([, s]) => s);
}

const clamp01 = (k: number): number => Math.max(0, Math.min(1, k));
const span = (t: number, from: number, to: number): number => clamp01((t - from) / (to - from));
const lerp = (a: number, b: number, k: number): number => a + (b - a) * k;
const ease = (k: number): number => k * k * (3 - 2 * k);

/** A point flying from `from` to `to` in a small arc `height` px above the straight line, `u` 0 → 1. */
export function arc(from: readonly [number, number], to: readonly [number, number], u: number, height: number): [number, number] {
  const k = clamp01(u);
  return [lerp(from[0], to[0], k), lerp(from[1], to[1], k) - height * 4 * k * (1 - k)];
}

// ---------- the strip's layout (half-local screen px) ----------

/** Feet of the spy, wheels of the plane. */
export const ESC_GROUND = 84;
/** The embassy's outer wall: the exit door fills its doorway. */
const WALL_X = 40;
const WALL_W = 12;
const DOOR_TOP = ESC_GROUND - 30;
const KEYHOLE: readonly [number, number] = [WALL_X + 3, ESC_GROUND - 13];
const BOOTH_X = 88;
const WINDOW: readonly [number, number] = [BOOTH_X + 14, ESC_GROUND - 30];
const DESK_X = 150;
const OFFICER_X = 170;
const PLANE_AT = 262;
const DOOR_DX = -48;
/** Where the spy stands in each stop. */
export const SPOTS = { door: 26, counter: 84, control: 138, steps: 198 } as const;
/** Boarding steps: the top step at the cabin door (see drawAirliner). */
const SILL: readonly [number, number] = [
  PLANE_AT + DOOR_DX * Math.cos(GROUND_ATTITUDE) - 24 * Math.sin(GROUND_ATTITUDE),
  ESC_GROUND - DOOR_DX * Math.sin(GROUND_ATTITUDE) - 24 * Math.cos(GROUND_ATTITUDE),
];
const TAXI_ACCEL = 360;

/** Where the spy is (feet), whether he walks, and whether he is still in sight (not yet in the cabin). */
export function escapeSpy(elapsed: number): { x: number; y: number; walking: boolean; visible: boolean } {
  const p = escapePhase(elapsed);
  const walk = (from: number, to: number) => ({ x: lerp(from, to, p.k), y: ESC_GROUND, walking: true, visible: true });
  const stand = (x: number) => ({ x, y: ESC_GROUND, walking: false, visible: true });
  switch (p.phase) {
    case 'key': return stand(SPOTS.door);
    case 'toCounter': return walk(SPOTS.door, SPOTS.counter);
    case 'counter': return stand(SPOTS.counter);
    case 'toControl': return walk(SPOTS.counter, SPOTS.control);
    case 'control': return stand(SPOTS.control);
    case 'toPlane': return walk(SPOTS.control, SPOTS.steps);
    case 'board': {
      const u = clamp01(p.k / 0.8);
      return { x: lerp(SPOTS.steps, SILL[0], u), y: lerp(ESC_GROUND, SILL[1], u), walking: true, visible: p.k < 0.8 };
    }
    default: return { x: SILL[0], y: SILL[1], walking: false, visible: false };
  }
}

/** The airliner's centre x: parked, then rolling off to the right with constant acceleration. */
export function escapePlaneX(elapsed: number): number {
  const dt = Math.max(0, elapsed - phaseStart('taxi'));
  return PLANE_AT + 0.5 * TAXI_ACCEL * dt * dt;
}

// ---------- drawing ----------

/** Draws the escape scene of spy `palette` `elapsed` seconds in, into a 320×100 half. `now` drives clouds and props. */
export function drawEscape(ctx: Ctx, palette: SpyPalette, elapsed: number, now: number): void {
  const p = escapePhase(elapsed);
  const at = (name: EscapePhaseName): number => elapsed - phaseStart(name);
  drawAirfield(ctx, now);
  drawPath(ctx);

  // the airliner, parked with its steps down until it rolls
  const planeX = escapePlaneX(elapsed);
  const rolling = p.phase === 'taxi' || p.phase === 'done';
  const roll = clamp01((planeX - PLANE_AT) / 60);
  const doorOpen = p.phase === 'toPlane' ? p.k > 0.6 : p.phase === 'board';
  drawAirliner(ctx, planeX, ESC_GROUND, GROUND_ATTITUDE * (1 - roll), now, DOOR_DX, !rolling, doorOpen);
  if (rolling) drawDust(ctx, planeX - 74, at('taxi'));
  if (p.phase === 'board' && p.k > 0.8 || rolling) drawWindowHat(ctx, palette, planeX, GROUND_ATTITUDE * (1 - roll));

  // the ticket booth and passport control stand behind the spy's path
  const counterT = at('counter');
  const inCounter = p.phase === 'counter';
  drawTicketBooth(ctx, BOOTH_X, ESC_GROUND, inCounter && (counterT > 0.4 && counterT < 0.55 || counterT > 0.8 && counterT < 0.95),
    inCounter && (counterT < 0.45 || counterT > 1.05));
  drawGuardAt(ctx, OFFICER_X, ESC_GROUND - 2, true);
  drawControlDesk(ctx, DESK_X, ESC_GROUND);

  drawEmbassy(ctx, doorSwing(at('key')));

  // the spy with the kufřík
  const spy = escapeSpy(elapsed);
  const frame: SpyFrame = spy.walking ? walkFrame(elapsed) : 'stand';
  const kuf = kufrikPoint(frame, spy.x, spy.y);
  if (spy.visible) {
    ctx.save();
    // he fades into the cabin door at the top of the steps
    if (p.phase === 'board') ctx.globalAlpha = 1 - span(p.k, 0.45, 0.8);
    drawSpySprite(ctx, spyImage(palette, frame), spy.x, spy.y);
    if (p.phase === 'toPlane' || p.phase === 'board') drawPlanyPeek(ctx, kuf, elapsed);
    drawKufrikInHand(ctx, frame, spy.x, spy.y, false, handOutline(palette));
    ctx.restore();
  }

  // the key, the stamp and the flying items in front of everything
  drawKey(ctx, at('key'), kuf);
  drawCounterItems(ctx, counterT, kuf);
  drawControl(ctx, at('control'), kuf);
}

/** Where things leave and enter the kufřík: the middle of its lid. */
function kufrikPoint(frame: SpyFrame, x: number, y: number): [number, number] {
  const { hx, hy } = handPoint(frame, x, y);
  return [hx, hy + 2];
}

/** How far the exit door has swung open 0 → 1, `t` seconds into the key phase. */
export function doorSwing(t: number): number {
  return ease(span(t, 0.85, 1.2));
}

/** Stepping stones from the embassy door to the airliner's steps. */
function drawPath(ctx: Ctx): void {
  for (let x = WALL_X + WALL_W + 2; x < SPOTS.steps + 4; x += 7) {
    r(ctx, x, ESC_GROUND - 1, 5, 2, '#a8a494');
    r(ctx, x, ESC_GROUND + 1, 5, 1, '#7e7a6c');
  }
}

/**
 * The embassy's corner in cut-away: its lobby on the left (wallpaper, wainscot, parquet), the thick outer wall with
 * the exit door, which swings out towards the airfield (`swing` 0 = shut, 1 = wide open) and lets the daylight in.
 */
function drawEmbassy(ctx: Ctx, swing: number): void {
  // lobby
  r(ctx, 0, 0, WALL_X, ESC_GROUND, '#5a2226');
  for (let x = 2; x < WALL_X; x += 5) r(ctx, x, 6, 2, ESC_GROUND - 20, '#6a2c30');
  r(ctx, 0, 0, WALL_X, 6, '#3a1a14');
  r(ctx, 0, 6, WALL_X, 1, '#c8a050');
  r(ctx, 0, ESC_GROUND - 14, WALL_X, 14, '#4a2a18');
  r(ctx, 0, ESC_GROUND - 14, WALL_X, 1, '#7a4a28');
  r(ctx, 0, ESC_GROUND, WALL_X + WALL_W, 100 - ESC_GROUND, '#8a5a30');
  for (let x = 0; x < WALL_X + WALL_W; x += 6) r(ctx, x + ((x / 6) % 2) * 3, ESC_GROUND + 3, 1, 13, '#6a4222');
  r(ctx, 0, ESC_GROUND, WALL_X + WALL_W, 1, '#3a2010');
  // a portrait on the wall and a hanging lamp
  r(ctx, 10, 22, 12, 15, '#c8a050');
  r(ctx, 12, 24, 8, 11, '#3a4a3a');
  r(ctx, 14, 26, 4, 4, '#d8b890');
  r(ctx, 13, 30, 6, 5, '#2a2a2a');
  r(ctx, 30, 6, 1, 10, '#2a1a10');
  r(ctx, 27, 16, 7, 3, '#e8c547');
  // the outer wall: plaster over a stone plinth, a cornice at the top, the doorway
  r(ctx, WALL_X, 0, WALL_W, DOOR_TOP, '#d8cfb8');
  r(ctx, WALL_X + WALL_W, 0, 1, ESC_GROUND, '#8a826c');
  r(ctx, WALL_X - 1, 0, WALL_W + 3, 4, '#b4aa90');
  r(ctx, WALL_X, DOOR_TOP - 3, WALL_W, 3, '#b4aa90');
  // daylight through the doorway once the door opens, spilling onto the lobby floor
  if (swing > 0) {
    r(ctx, WALL_X, DOOR_TOP, WALL_W, ESC_GROUND - DOOR_TOP, '#fff2c0');
    ctx.save();
    ctx.globalAlpha = 0.35 * swing;
    poly(ctx, [[WALL_X, ESC_GROUND], [WALL_X, ESC_GROUND + 6], [WALL_X - 26, ESC_GROUND + 14], [WALL_X - 14, ESC_GROUND]], '#fff2c0');
    ctx.restore();
  } else {
    r(ctx, WALL_X, DOOR_TOP, WALL_W, ESC_GROUND - DOOR_TOP, '#2a1a10');
  }
  drawExitDoor(ctx, swing);
}

/**
 * The exit door, hinged on the airfield side of the doorway: shut it faces us (panels, brass knob, keyhole plate);
 * opening, its free edge swings out past the hinge and comes nearer (taller), so it reads as a door swinging open.
 */
function drawExitDoor(ctx: Ctx, swing: number): void {
  const hinge = WALL_X + WALL_W;
  const angle = swing * (Math.PI * 0.8);
  const free = hinge - WALL_W * Math.cos(angle);
  const grow = Math.round(3 * Math.sin(angle));
  const top = DOOR_TOP, bottom = ESC_GROUND;
  const wood = '#6b3e1e', panel = '#7c4a26', brass = '#e8c547';
  if (swing <= 0) {
    r(ctx, WALL_X, top, WALL_W, bottom - top, wood);
    r(ctx, WALL_X + 2, top + 3, WALL_W - 4, 10, panel);
    r(ctx, WALL_X + 2, top + 16, WALL_W - 4, 11, panel);
    r(ctx, WALL_X + 1, KEYHOLE[1] - 5, 3, 7, '#b89a3a');
    r(ctx, WALL_X + 1, KEYHOLE[1] - 5, 3, 2, brass);
    r(ctx, KEYHOLE[0] - 0.5, KEYHOLE[1] - 1, 1, 2, '#111111');
    return;
  }
  const edge = Math.abs(free - hinge) < 1.5;
  const color = free > hinge ? '#5a3216' : wood;
  poly(ctx, [[hinge, top], [free, top - grow], [free, bottom + grow], [hinge, bottom]], color);
  if (!edge) {
    const inset = (k: number, y: number): [number, number] => [lerp(hinge, free, k), y + (y < (top + bottom) / 2 ? -grow * k : grow * k) * 0.8];
    poly(ctx, [inset(0.2, top + 3), inset(0.8, top + 3), inset(0.8, top + 13), inset(0.2, top + 13)], free > hinge ? '#6a3e1e' : panel);
    // the knob on the free edge
    const [kx, ky] = [lerp(hinge, free, 0.8), KEYHOLE[1] - 3];
    r(ctx, kx - 1, ky, 2, 2, brass);
  }
  r(ctx, hinge - 1, top, 1, bottom - top, '#2a1a10');
}

/** The klíč: out of the kufřík in an arc to the keyhole, a quarter turn there, then it stays in the lock until the door swings. */
function drawKey(ctx: Ctx, t: number, from: readonly [number, number]): void {
  if (t < 0.05 || t >= 0.85) return;
  const img = iconImage('klic');
  const fly = span(t, 0.05, 0.55);
  const [x, y] = fly < 1 ? arc(from, KEYHOLE, fly, 16) : KEYHOLE;
  // the key's tip (its bit, right end) points at the keyhole; turning rotates it about the tip
  const turn = ease(span(t, 0.55, 0.75)) * (Math.PI / 2);
  ctx.save();
  ctx.translate(Math.round(x), Math.round(y));
  ctx.rotate(turn);
  ctx.scale(ITEM_SCALE, ITEM_SCALE);
  // the bow on the spy's side, the bit's tip (icon column 7, row 3) in the lock; outlined for the sky and the wood
  outlineImage(ctx, 'klic', -7, -3);
  ctx.drawImage(img, -7, -3);
  ctx.restore();
  if (t > 0.68 && t < 0.8) spark(ctx, KEYHOLE[0] + 3, KEYHOLE[1] - 4, '#ffffff');
}

/** A 1 px dark ring around an icon drawn at (x, y) top-left in the current transform. */
function outlineImage(ctx: Ctx, name: IconName, x: number, y: number): void {
  const img = iconImage(name);
  ctx.save();
  ctx.globalCompositeOperation = 'source-over';
  ctx.filter = 'brightness(0)';
  for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]] as const) ctx.drawImage(img, x + dx, y + dy);
  ctx.restore();
}

/** The peníze to the clerk, the pas held up at the window and back, then the ticket out of the window. */
function drawCounterItems(ctx: Ctx, t: number, kuf: readonly [number, number]): void {
  if (t < 0 || t > 1.45) return;
  const sill: [number, number] = [WINDOW[0] - 2, WINDOW[1] + 4];
  if (t < 0.45) {
    const [x, y] = arc(kuf, sill, span(t, 0.02, 0.4), 18);
    item(ctx, 'penize', x, y);
    if (t > 0.1) coin(ctx, x - 5, y + 2 + ((t * 40) % 4));
  }
  if (t >= 0.45 && t < 1.15) {
    const shown: [number, number] = [WINDOW[0] - 6, WINDOW[1] + 1];
    const up = span(t, 0.45, 0.72);
    const back = span(t, 0.95, 1.15);
    const [x, y] = back > 0 ? arc(shown, kuf, back, 10) : arc(kuf, shown, up, 14);
    // held up to the glass: a little bob while the clerk looks at it
    const bob = up >= 1 && back === 0 ? Math.round(Math.sin(t * 20)) : 0;
    item(ctx, 'pas', x, y + bob);
  }
  if (t >= 1.05) {
    const [x, y] = arc(sill, kuf, span(t, 1.05, 1.42), 14);
    ticket(ctx, x, y);
  }
}

/** Passport control: the pas onto the desk, the officer's stamp comes down on it (an ink flash), the pas goes back stamped. */
function drawControl(ctx: Ctx, t: number, kuf: readonly [number, number]): void {
  if (t < 0 || t > 1.15) return;
  const desk: [number, number] = [DESK_X + 6, ESC_GROUND - 25];
  const stamped = t >= 0.5;
  // the stamp: up over the desk, down on the pas, up again, held by the officer's arm
  const down = t < 0.5 ? ease(span(t, 0.3, 0.5)) : 1 - ease(span(t, 0.62, 0.8));
  const sx = desk[0] + 1, sy = Math.round(lerp(ESC_GROUND - 48, desk[1] - 12, down));
  const shoulder: [number, number] = [OFFICER_X - 3, ESC_GROUND - 2 - GUARD_SHOULDER_H];
  armLine(ctx, shoulder, [sx + 5, sy - 4]);
  if (t < 0.85) {
    item(ctx, 'pas', ...(t < 0.3 ? arc(kuf, desk, span(t, 0, 0.28), 14) : desk), stamped);
  } else {
    const [x, y] = arc(desk, kuf, span(t, 0.85, 1.13), 14);
    item(ctx, 'pas', x, y, true);
  }
  // wooden knob, black handle, rubber foot
  big(ctx, sx, sy, () => {
    r(ctx, -2, -6, 4, 3, '#a06a38');
    r(ctx, -1, -3, 2, 3, '#2a1a10');
    r(ctx, -3, 0, 6, 2, '#2a2a44');
  });
  if (t >= 0.5 && t < 0.68) {
    // the thud: rays bursting from the pas, white first, then ink violet
    const k = span(t, 0.5, 0.68);
    const [cx, cy] = [desk[0], desk[1] - 2];
    const color = k < 0.45 ? '#ffffff' : '#9a4ad0';
    for (let i = 0; i < 8; i++) {
      const ang = (i / 8) * Math.PI * 2 + 0.2;
      for (let d = 9 + Math.round(k * 5); d < 13 + Math.round(k * 5); d++) {
        r(ctx, cx + Math.round(Math.cos(ang) * d * 1.2), cy + Math.round(Math.sin(ang) * d * 0.8), 1, 1, color);
      }
    }
  }
}

/** The officer's sleeve from his shoulder to the stamp, a 2 px dark-blue line. */
function armLine(ctx: Ctx, [x0, y0]: readonly [number, number], [x1, y1]: readonly [number, number]): void {
  const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
  for (let i = 0; i <= n; i++) r(ctx, lerp(x0, x1, i / n) - 1, lerp(y0, y1, i / n) - 1, 2, 2, '#22336a');
  r(ctx, x1 - 1, y1 - 1, 3, 2, '#e6b089');
}

/** Flying items are drawn twice their icon size, so a child can tell the key from the passport. */
export const ITEM_SCALE = 2;

/** Runs `draw` with (0, 0) at (x, y) and everything ITEM_SCALE times bigger. */
function big(ctx: Ctx, x: number, y: number, draw: () => void): void {
  ctx.save();
  ctx.translate(Math.round(x), Math.round(y));
  ctx.scale(ITEM_SCALE, ITEM_SCALE);
  draw();
  ctx.restore();
}

/** An item icon centred on (x, y), outlined so it reads on the sky, the grass and the booth; `stamped` adds the ink. */
function item(ctx: Ctx, name: IconName, x: number, y: number, stamped = false): void {
  big(ctx, x, y, () => {
    drawIconOutlined(ctx, name, 0, 4, '#1a1a1a');
    if (stamped) inkMark(ctx, 0, 0);
  });
}

/** The violet stamp on a pas centred on (x, y). */
function inkMark(ctx: Ctx, x: number, y: number): void {
  r(ctx, x - 2, y - 1, 3, 1, '#5a1a9a');
  r(ctx, x - 2, y + 2, 3, 1, '#5a1a9a');
  r(ctx, x - 3, y, 1, 2, '#5a1a9a');
  r(ctx, x + 1, y, 1, 2, '#5a1a9a');
  r(ctx, x - 2, y, 3, 2, '#b07ad8');
}

/** A cream airline ticket with a red stub, centred on (x, y). */
function ticket(ctx: Ctx, x: number, y: number): void {
  big(ctx, x, y, () => ticketAt(ctx, -5, -3));
}

function ticketAt(ctx: Ctx, cx: number, cy: number): void {
  r(ctx, cx - 1, cy - 1, 12, 8, '#1a1a1a');
  r(ctx, cx, cy, 10, 6, '#f4ecd0');
  r(ctx, cx, cy, 3, 6, '#d23c3c');
  r(ctx, cx + 4, cy + 1, 5, 1, '#6a6a6a');
  r(ctx, cx + 4, cy + 3, 4, 1, '#6a6a6a');
  r(ctx, cx + 3, cy + 5, 1, 1, '#f4ecd0');
}

function coin(ctx: Ctx, x: number, y: number): void {
  disc(ctx, Math.round(x), Math.round(y), 1, '#e8c547');
}

function spark(ctx: Ctx, x: number, y: number, color: string): void {
  r(ctx, x, y - 2, 1, 5, color);
  r(ctx, x - 2, y, 5, 1, color);
}

/** The plány rolled up behind the kufřík's handle, glowing. */
function drawPlanyPeek(ctx: Ctx, [kx, ky]: readonly [number, number], t: number): void {
  const pulse = Math.floor(t * 8) % 2 === 0;
  // a golden glow behind, the blue plans sticking up out of the lid, twinkles around
  ctx.save();
  ctx.globalAlpha = pulse ? 0.8 : 0.5;
  disc(ctx, kx, ky - 4, 7, '#ffe27a');
  ctx.restore();
  drawIconOutlined(ctx, 'plany', kx, ky + 1, '#1a1a1a');
  const glints = pulse ? [[-8, -8], [7, -10], [9, -2]] : [[-7, -11], [8, -6], [-9, -3]];
  for (const [dx, dy] of glints) spark(ctx, kx + dx, ky + dy, '#ffffff');
}

/** Aboard: his hat and nose in the first cabin window (plane-local, as drawAirliner draws the windows). */
function drawWindowHat(ctx: Ctx, palette: SpyPalette, planeX: number, pitch: number): void {
  const coat = palette === 'white' ? '#f2f2f2' : '#1e1e1e';
  ctx.save();
  ctx.translate(Math.round(planeX), ESC_GROUND);
  ctx.rotate(-pitch);
  r(ctx, -32, -39, 4, 3, '#a8c8e0');
  r(ctx, -31, -39, 2, 1, coat);
  r(ctx, -32, -38, 4, 1, coat);
  r(ctx, -29, -37, 2, 1, '#f0a484');
  ctx.restore();
}

/** Dust puffs kicked up behind the rolling airliner's tailwheel. */
function drawDust(ctx: Ctx, x: number, t: number): void {
  for (let i = 0; i < 4; i++) {
    const age = t - i * 0.12;
    if (age < 0) continue;
    const rr = 1 + Math.min(4, Math.floor(age * 8));
    ctx.save();
    ctx.globalAlpha = Math.max(0, 0.7 - age);
    disc(ctx, Math.round(x - i * 9 - age * 10), ESC_GROUND - rr, rr, '#d8ccb0');
    ctx.restore();
  }
}

/** The winner's half shows the escape scene, `elapsed` seconds in; call after drawing the frozen match underneath. */
export function renderEscape(ctx: Ctx, scale: number, winner: PlayerId, elapsed: number, now: number): void {
  withViewport(ctx, scale, HALVES[winner], () => {
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, 320, 100);
    drawEscape(ctx, winner === 0 ? 'white' : 'black', elapsed, now);
  });
}
