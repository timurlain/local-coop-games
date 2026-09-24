import { RULES } from '../logic/rules';
import type { Spy } from '../logic/state';
import { line, r, text } from './draw';
import { project } from './geometry';
import type { SpyPalette } from './sprite-data';
import { drawSprite, spyImage } from './sprites';

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

export function drawSpy(ctx: Ctx, spy: Spy, now: number): void {
  if (spy.mode === 'out' || spy.mode === 'escaped') return;
  const { sx, sy } = project(spy.x, spy.z);
  if (spy.mode === 'dead') {
    drawDeath(ctx, spy, sx, sy, now);
    return;
  }
  const moving = spy.mode === 'normal' && (movingUntil.get(spy.id) ?? 0) > now;
  const frame = moving ? (Math.floor(now * 8) % 2 === 0 ? 'walkA' : 'walkB') : 'stand';
  const jitter = spy.mode === 'searching' ? (Math.floor(now * 20) % 2 === 0 ? 1 : -1) : 0;
  drawSprite(ctx, spyImage(baseColor(spy), frame), sx + jitter, sy, spy.facing < 0);
  if (spy.swingAnim > 0) r(ctx, sx + (spy.facing > 0 ? 4 : -16), sy - 13, 12, 2, '#8b5a2b');
  else if (spy.blocking) r(ctx, sx + spy.facing * 7, sy - 19, 2, 12, '#8b5a2b');
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
    ctx.ellipse(sx, sy - rise - 22, 5, 1.5, 0, 0, Math.PI * 2);
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
      for (const dx of [-5, 0, 5]) {
        ctx.beginPath();
        ctx.arc(sx + dx, sy - 24 - elapsed * 12, 3 + elapsed * 3, 0, Math.PI * 2);
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
        line(ctx, sx - 8, sy - 20, sx - 4, sy - 14, '#ffeb3b');
        line(ctx, sx + 8, sy - 18, sx + 4, sy - 10, '#ffeb3b');
      }
      break;
    case 'pistole': {
      drawSprite(ctx, spyImage(baseColor(spy), 'stand'), sx, sy, flip);
      const fx = sx + (flip ? -30 : 8);
      r(ctx, fx, sy - 28, 22, 9, '#f4f4f4');
      text(ctx, 'BANG!', fx + 11, sy - 21, '#d23c3c', 6, 'center');
      break;
    }
    default:
      // fight: knocked flat
      ctx.save();
      ctx.translate(sx, sy);
      ctx.rotate(((flip ? 1 : -1) * Math.PI) / 2);
      drawSprite(ctx, spyImage('sooty', 'stand'), 0, 7, flip);
      ctx.restore();
  }
}
