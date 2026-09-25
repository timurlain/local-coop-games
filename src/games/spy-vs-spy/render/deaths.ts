// Drawing the cartoon trap deaths (round 6 §6) and the angel afterwards. Timelines come from death-phases.ts,
// frames from death-frames.ts; this file only paints them at a spy's floor point.

import type { TrapKind } from '../logic/state';
import {
  electricPhase, hatPiece, nearestTilt, pistolPhase, sootPhase, springPhase,
  type ElectricPhase, type PistolPhase, type SootPhase, type SpringPhase,
} from './death-phases';
import { BUCKET, DEATH_FRAMES, deathPalettes, HEAP, PROP_PALETTE, type DeathFrame } from './death-frames';
import { disc, line, r, text } from './draw';
import { SPY_CENTER_X, SPY_FRAMES, SPY_STAND_H, SPY_STAND_REACH } from './sprite-data';
import { bake, drawIconScaled, drawSpySprite, spyImage } from './sprites';

type Ctx = CanvasRenderingContext2D;
type Pal = Readonly<Record<string, string>>;
export type SpyColour = 'white' | 'black';

/** Where a death is drawn: the spy's floor point, which way he faces, and the room's ceiling row. */
export interface DeathSpot {
  readonly sx: number;
  readonly sy: number;
  readonly flip: boolean;
  readonly ceiling: number;
}

const WATER = ['#6cc6e8', '#3a78d8'];
const SPARK = ['#ffeb3b', '#ffffff'];
const SMOKE = ['#b8b8bc', '#8a8a90'];
const STEEL = ['#cfcfcf', '#8a8a8a'];

/** Draws `frame` with its centre column on x and its bottom row just above y; mirrored about that column when flipped. */
function drawFrame(ctx: Ctx, key: string, frame: DeathFrame, pal: Pal, palKey: string, x: number, y: number, flip: boolean): void {
  const img = bake(`death:${key}:${palKey}`, frame.rows, pal as Record<string, string>);
  const cx = Math.round(x);
  const top = Math.round(y - img.height);
  if (!flip) {
    ctx.drawImage(img, cx - frame.cx, top);
    return;
  }
  ctx.save();
  ctx.translate(cx + frame.cx + 1, top);
  ctx.scale(-1, 1);
  ctx.drawImage(img, 0, 0);
  ctx.restore();
}

/** Screen pixel of image pixel (px, py) of `frame` drawn with drawFrame at (x, y). */
function framePixel(frame: DeathFrame, px: number, py: number, x: number, y: number, flip: boolean): { x: number; y: number } {
  return { x: Math.round(x) + (flip ? frame.cx - px : px - frame.cx), y: Math.round(y) - frame.rows.length + py };
}

/** Pixel-art rows drawn centred on x with their bottom row just above y (props: the bucket, the heap). */
function drawProp(ctx: Ctx, key: string, rows: readonly string[], x: number, y: number): void {
  const img = bake(`prop:${key}`, rows, PROP_PALETTE as Record<string, string>);
  ctx.drawImage(img, Math.round(x - img.width / 2), Math.round(y - img.height));
}

/** The first row with anything drawn. */
function topRow(frame: DeathFrame): number {
  return frame.rows.findIndex((row) => /[^.]/.test(row));
}

/** Draws a trap death of the spy of colour `spy`, `elapsed` seconds after it happened, before the angel. */
export function drawTrapDeath(ctx: Ctx, cause: TrapKind, spy: SpyColour, at: DeathSpot, elapsed: number): void {
  switch (cause) {
    case 'elektrina':
      drawElectric(ctx, spy, at, electricPhase(elapsed), elapsed);
      break;
    case 'bomba':
    case 'casovana':
      drawSoot(ctx, spy, at, sootPhase(cause, elapsed), elapsed);
      break;
    case 'pruzina':
      drawSpring(ctx, spy, at, springPhase(elapsed), elapsed);
      break;
    case 'pistole':
      drawPistol(ctx, spy, at, pistolPhase(elapsed), elapsed);
      break;
  }
}

/** The ghost with its halo, `rise` px above the floor point. */
export function drawAngel(ctx: Ctx, at: DeathSpot, rise: number): void {
  const { sx, sy, flip } = at;
  ctx.save();
  ctx.globalAlpha = 0.6;
  drawSpySprite(ctx, spyImage('ghost', 'stand'), sx, sy - rise, flip);
  ctx.strokeStyle = '#e8c547';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.ellipse(sx, sy - rise - SPY_STAND_H - 2, 7, 2, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

// ---------- elektrina ----------

/** Bucket rim (its bottom row) resting on the head of `frame` drawn at (x, y). */
function bucketRest(frame: DeathFrame, x: number, y: number, flip: boolean): { x: number; y: number } {
  const p = framePixel(frame, frame.brim[0], frame.brim[1], x, y, flip);
  // centred a pixel behind the centre line, over the hat's crown; its rim just over the brim
  return { x: p.x + (flip ? 1 : -1), y: p.y + 2 };
}

/** Deterministic 0..1 noise for spark positions. */
function hash(i: number, j: number): number {
  const s = Math.sin(i * 127.1 + j * 311.7) * 43758.5453;
  return s - Math.floor(s);
}

/** A little yellow zigzag spark from (x, y). */
function spark(ctx: Ctx, x: number, y: number, dir: number, colour: string): void {
  line(ctx, x, y, x + 2 * dir, y - 2, colour);
  line(ctx, x + 2 * dir, y - 2, x + 1 * dir, y - 3, colour);
  line(ctx, x + 1 * dir, y - 3, x + 4 * dir, y - 5, colour);
}

function drawElectric(ctx: Ctx, spy: SpyColour, at: DeathSpot, p: ElectricPhase, elapsed: number): void {
  const { sx, sy, flip } = at;
  const pals = deathPalettes(spy);
  const F = DEATH_FRAMES;
  switch (p.phase) {
    case 'fall': {
      drawSpySprite(ctx, spyImage(spy, 'stand'), sx, sy, flip);
      const rest = bucketRest({ rows: SPY_FRAMES.stand, cx: SPY_CENTER_X, brim: F.standBrim }, sx, sy, flip);
      const start = Math.min(rest.y - 10, at.ceiling + BUCKET.length);
      const y = Math.round(rest.y + (start - rest.y) * p.drop);
      // water pouring out of the upside-down bucket, ahead of it
      for (let i = 0; i < 4; i++) r(ctx, rest.x - 3 + i * 2, y + 1 + ((i * 3 + Math.floor(elapsed * 30)) % 5), 1, 2, WATER[i % 2]);
      drawProp(ctx, 'bucket', BUCKET, rest.x, y);
      break;
    }
    case 'shock': {
      const frame = p.xray ? F.xray[p.jitter] : F.zap[p.jitter];
      drawFrame(ctx, p.xray ? `xray${p.jitter}` : `zap${p.jitter}`, frame, p.xray ? pals.xray : pals.own,
        p.xray ? 'xray' : spy, sx, sy, flip);
      const b = bucketRest(frame, sx, sy, flip);
      drawProp(ctx, 'bucket', BUCKET, b.x, b.y);
      // the splash: drops fly out from under the rim on both sides and fall
      if (p.splash < 1) {
        for (let i = 0; i < 8; i++) {
          const side = i % 2 === 0 ? -1 : 1;
          const speed = 3 + (i >> 1) * 2.2;
          const k = p.splash;
          const x = b.x + side * (5 + speed * k * 2);
          const y = b.y - 2 - (4 + (i >> 1)) * Math.sin(k * Math.PI * 0.9) + k * k * 16;
          r(ctx, Math.round(x), Math.round(y), 1, i < 4 ? 2 : 1, WATER[i % 2]);
        }
      }
      // drips off the rim
      for (let i = 0; i < 3; i++) {
        const fall = ((elapsed * 40 + i * 7) % 14);
        r(ctx, b.x - 4 + i * 4, Math.round(b.y + fall), 1, 1, WATER[1]);
      }
      // sparks crackling around him, jumping about
      const tick = Math.floor(elapsed * 14);
      for (let i = 0; i < 4; i++) {
        if ((tick + i) % 3 === 0) continue;
        const side = i % 2 === 0 ? -1 : 1;
        const x = sx + side * (6 + Math.round(hash(tick, i) * 7));
        const y = sy - 8 - Math.round(hash(i, tick) * 26);
        spark(ctx, x, y, side, SPARK[(tick + i) % 2]);
      }
      // two sparks jump off the bucket
      if (tick % 2 === 0) {
        spark(ctx, b.x - 6, b.y - 5, -1, SPARK[0]);
        spark(ctx, b.x + 6, b.y - 6, 1, SPARK[1]);
      }
      break;
    }
    case 'heap': {
      drawProp(ctx, 'heap', HEAP, sx, sy + 1);
      drawProp(ctx, 'bucket', BUCKET, sx, sy - 5);
      // smoke curls up from the heap
      smoke(ctx, sx, sy - 12, p.k, 3);
      // the collapse: a puff of smoke hides the moment he falls into ash
      if (p.k < 0.2) puff(ctx, sx, sy - 10, p.k / 0.2, 11);
      // embers wink
      if (Math.floor(elapsed * 6) % 2 === 0) r(ctx, sx - 4, sy - 4, 1, 1, '#ffd24a');
      break;
    }
    case 'angel':
      break;
  }
}

/** Grey wisps rising and swaying from (x, y); `k` 0 → 1 over the scene. */
function smoke(ctx: Ctx, x: number, y: number, k: number, n: number): void {
  for (let i = 0; i < n; i++) {
    const u = (k * 2.2 + i / n) % 1;
    const wx = Math.round(x + (i - (n - 1) / 2) * 3 + Math.sin(u * Math.PI * 3 + i) * 2);
    const wy = Math.round(y - u * 14);
    ctx.save();
    ctx.globalAlpha = 0.85 * (1 - u);
    r(ctx, wx, wy, 2, 2, SMOKE[i % 2]);
    r(ctx, wx + 1, wy - 2, 1, 1, SMOKE[(i + 1) % 2]);
    ctx.restore();
  }
}

/** A round grey cloud swelling and fading, radius up to `size`. */
function puff(ctx: Ctx, x: number, y: number, k: number, size: number): void {
  ctx.save();
  ctx.globalAlpha = 0.9 * (1 - k);
  const rad = Math.round(size * (0.5 + 0.5 * k));
  disc(ctx, Math.round(x), Math.round(y), rad, SMOKE[1]);
  disc(ctx, Math.round(x) - 2, Math.round(y) - 2, Math.max(1, rad - 3), SMOKE[0]);
  ctx.restore();
}

// ---------- bomba, časovaná ----------

function drawSoot(ctx: Ctx, spy: SpyColour, at: DeathSpot, p: SootPhase, elapsed: number): void {
  const { sx, sy, flip } = at;
  const pals = deathPalettes(spy);
  const F = DEATH_FRAMES;
  switch (p.phase) {
    case 'flash': {
      drawFrame(ctx, 'sootHat', F.soot.hat, pals.soot, `soot-${spy}`, sx, sy, flip);
      // the blast: a white-hot core in an orange ring, swelling
      const rad = Math.round(8 + p.k * 10);
      ctx.save();
      ctx.globalAlpha = 1 - p.k * 0.5;
      disc(ctx, Math.round(sx), Math.round(sy - 14), rad, '#ff9a3c');
      disc(ctx, Math.round(sx), Math.round(sy - 14), Math.max(2, rad - 4), '#ffeb3b');
      disc(ctx, Math.round(sx), Math.round(sy - 14), Math.max(1, rad - 8), '#ffffff');
      ctx.restore();
      break;
    }
    case 'soot': {
      const pal = p.blink ? pals.sootBlink : pals.soot;
      const palKey = `${p.blink ? 'blink' : 'soot'}-${spy}`;
      if (p.crumble === 0) {
        drawFrame(ctx, 'sootHat', F.soot.hat, pal, palKey, sx, sy, flip);
      } else {
        drawFrame(ctx, 'sootBare', F.soot.bare, pal, palKey, sx, sy, flip);
        const n = F.hatPieces.length;
        F.hatPieces.forEach((piece, i) => {
          const { fall, drift } = hatPiece(i, n, p.crumble);
          const bottom = Math.max(...piece.map((q) => q.y));
          // lands on the floor next to his feet
          const dy = Math.round(fall * (F.soot.hat.rows.length - 2 - bottom));
          for (const q of piece) {
            const s = framePixel(F.soot.hat, q.x, q.y, sx, sy, flip);
            r(ctx, s.x + drift * (flip ? -1 : 1), s.y + dy, 1, 1, pal[q.ch]);
          }
        });
      }
      // smoke curling up off him, thinning out
      smoke(ctx, sx - (flip ? -2 : 2), sy - SPY_STAND_H + 2, p.smoke, 3);
      if (elapsed < 0.4) puff(ctx, sx, sy - 18, elapsed / 0.4, 12);
      break;
    }
    case 'angel':
      break;
  }
}

// ---------- pružina ----------

/** A steel coil standing on the floor at x, `h` px tall, its top plate on top. */
function coil(ctx: Ctx, x: number, floor: number, h: number): void {
  const x0 = Math.round(x);
  for (let y = floor, i = 0; y > floor - h; y -= 2, i++) line(ctx, x0 - 3, y, x0 + 3, y - 1, STEEL[i % 2]);
  r(ctx, x0 - 3, Math.round(floor - h) - 1, 7, 1, '#111111');
}

const COIL_H = 9;

function drawSpring(ctx: Ctx, spy: SpyColour, at: DeathSpot, p: SpringPhase, elapsed: number): void {
  const { sx, sy, flip, ceiling } = at;
  const pal = deathPalettes(spy).own;
  const F = DEATH_FRAMES;
  // the spring stays up out of the floor, wobbling a little after the launch
  const wobble = p.phase === 'spring' ? 0 : Math.round(Math.sin(elapsed * 30) * 1.5 * Math.max(0, 1 - elapsed));
  const coilH = p.phase === 'spring' ? Math.round(COIL_H * p.k) : COIL_H + wobble;
  switch (p.phase) {
    case 'spring':
      coil(ctx, sx, sy, coilH);
      drawSpySprite(ctx, spyImage(spy, 'stand'), sx, sy - coilH, flip);
      break;
    case 'launch': {
      coil(ctx, sx, sy, coilH);
      const f = F.jump;
      // bottom of the frame: from the top of the coil until the head touches the ceiling
      const fromY = sy - COIL_H;
      const toY = ceiling - topRow(f) + f.rows.length;
      const y = Math.min(fromY, fromY + (toY - fromY) * p.up);
      drawFrame(ctx, 'jump', f, pal, spy, sx, y, flip);
      // speed lines under him
      for (let i = 0; i < 3; i++) line(ctx, sx - 4 + i * 4, y + 2, sx - 4 + i * 4, y + 6, '#f4f4f4');
      break;
    }
    case 'splat': {
      coil(ctx, sx, sy, coilH);
      const f = p.wobble > 0.35 ? F.slide : F.splat;
      drawFrame(ctx, f === F.splat ? 'splat' : 'slide', f, pal, spy, sx, ceiling - topRow(f) + f.rows.length, flip);
      // the impact: dashes shooting out along the ceiling
      if (p.k < 0.4) {
        for (const side of [-1, 1]) {
          const d = 16 + Math.round(p.k * 20);
          r(ctx, Math.round(sx + side * d) - 2, ceiling + 1, 4, 1, '#f4f4f4');
          r(ctx, Math.round(sx + side * (d - 5)), ceiling + 4, 2, 1, '#f4f4f4');
        }
      }
      break;
    }
    case 'slide': {
      coil(ctx, sx, sy, coilH);
      const f = F.slide;
      const topY = ceiling + (sy - f.rows.length + 1 - ceiling) * p.down;
      const y = Math.round(topY - topRow(f) + f.rows.length);
      drawFrame(ctx, 'slide', f, pal, spy, sx, y, flip);
      // streaks left behind on the way down
      const top = y - f.rows.length + topRow(f);
      for (const dx of [-9, -3, 4, 10]) {
        const len = Math.min(8, Math.max(0, top - ceiling - 2));
        if (len > 1) line(ctx, sx + dx, top - 2 - len, sx + dx, top - 2, '#f4f4f4');
      }
      break;
    }
    case 'flat': {
      coil(ctx, sx + (flip ? 14 : -14), sy, coilH);
      drawFrame(ctx, 'splat', F.splat, pal, spy, sx, sy + 1, flip);
      // stars circling over the pancake
      for (let i = 0; i < 3; i++) {
        const a = elapsed * 7 + (i * Math.PI * 2) / 3;
        star(ctx, Math.round(sx + Math.cos(a) * 9), Math.round(sy - 12 + Math.sin(a) * 2), i % 2 === 0 ? '#ffeb3b' : '#ffffff');
      }
      break;
    }
    case 'angel':
      break;
  }
}

/** A tiny 3×3 plus-shaped star. */
function star(ctx: Ctx, x: number, y: number, colour: string): void {
  r(ctx, x - 1, y, 3, 1, colour);
  r(ctx, x, y - 1, 1, 3, colour);
}

// ---------- pistole ----------

/**
 * The pistol pointing at the spy's head and the BANG! flag popped out of its barrel: a stick shooting out of the
 * muzzle towards his face, the flag hanging under it. `slide` 0 → 1 brings the gun in, `pop` (may overshoot) the stick
 * out, `droop` 0 → 1 lets it sag once the gag is over.
 */
function gunAndFlag(ctx: Ctx, at: DeathSpot, slide: number, pop: number, droop: number): void {
  const { sx, sy, flip } = at;
  const dir = flip ? -1 : 1;
  const headY = Math.round(sy - 29);
  const gx = Math.round(sx + dir * (SPY_STAND_REACH + 30 + Math.round((1 - slide) * 10)));
  // the icon points right: mirrored so the muzzle faces the spy
  ctx.save();
  ctx.translate(gx, headY);
  ctx.scale(-dir, 1);
  drawIconScaled(ctx, 'pistole', 0, 0, 1);
  ctx.restore();
  if (pop <= 0) return;
  const muzzle = { x: gx - dir * 4, y: headY - 2 };
  const len = Math.round(24 * pop);
  const tip = { x: muzzle.x - dir * len, y: muzzle.y + Math.round(droop * 4) };
  line(ctx, muzzle.x, muzzle.y + 0.5, tip.x, tip.y + 0.5, '#e8c547');
  if (len < 6) return;
  // the flag under the stick, from near the muzzle to its tip
  const w = len - 2;
  const h = 9;
  const left = flip ? muzzle.x + 2 : tip.x;
  const top = Math.min(tip.y, muzzle.y) + 1;
  r(ctx, left - 1, top, w + 2, h + 2, '#1a1a1a');
  r(ctx, left, top + 1, w, h, '#f8f4e8');
  if (w >= 20) text(ctx, 'BANG!', left + w / 2 + 0.5, top + h, '#d23c3c', 7, 'center');
}

function drawPistol(ctx: Ctx, spy: SpyColour, at: DeathSpot, p: PistolPhase, elapsed: number): void {
  const { sx, sy, flip } = at;
  const pal = deathPalettes(spy).own;
  const F = DEATH_FRAMES;
  const hole = (frame: DeathFrame, key: string): void => {
    drawFrame(ctx, key, frame, pal, spy, sx, sy, flip);
  };
  switch (p.phase) {
    case 'aim':
      hole(F.shot, 'shot');
      gunAndFlag(ctx, at, p.k, 0, 0);
      break;
    case 'bang': {
      if (p.hole) hole(F.tilts[0], 'tilt0');
      else hole(F.shot, 'shot');
      gunAndFlag(ctx, at, 1, p.pop, 0);
      if (p.hole) holeSmoke(ctx, at, F.tilts[0], elapsed);
      break;
    }
    case 'sway':
    case 'fall': {
      const t = nearestTilt(p.tilt);
      hole(F.tilts[t], `tilt${t}`);
      gunAndFlag(ctx, at, 1, 1, p.phase === 'fall' ? 0.5 : 0);
      holeSmoke(ctx, at, F.tilts[t], elapsed);
      break;
    }
    case 'down':
      hole(F.tilts[-90], 'tilt-90');
      gunAndFlag(ctx, at, 1, 1, 1);
      holeSmoke(ctx, at, F.tilts[-90], elapsed);
      break;
    case 'angel':
      break;
  }
}

/** A thin thread of smoke from the bullet hole in the hat. */
function holeSmoke(ctx: Ctx, at: DeathSpot, frame: DeathFrame, elapsed: number): void {
  const y0 = frame.rows.findIndex((row) => row.includes('O'));
  if (y0 < 0) return;
  const p = framePixel(frame, frame.rows[y0].indexOf('O'), y0, at.sx, at.sy, at.flip);
  for (let i = 0; i < 3; i++) {
    const u = (elapsed * 1.6 + i / 3) % 1;
    ctx.save();
    ctx.globalAlpha = 0.9 * (1 - u);
    r(ctx, Math.round(p.x + Math.sin(u * 6 + i) * 1.5), Math.round(p.y - 2 - u * 9), 1, 1, SMOKE[i % 2]);
    ctx.restore();
  }
}
