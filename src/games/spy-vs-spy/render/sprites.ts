import type { Thing } from '../logic/state';
import { ICONS, ICON_PALETTE, SPY_FRAMES, SPY_HANDS, SPY_PALETTES, type IconName, type SpyFrame, type SpyPalette } from './sprite-data';

const cache = new Map<string, HTMLCanvasElement>();

/** Turns pixel strings into a small offscreen canvas (cached by key). */
export function bake(key: string, rows: readonly string[], palette: Record<string, string>): HTMLCanvasElement {
  const hit = cache.get(key);
  if (hit) return hit;
  const c = document.createElement('canvas');
  c.width = rows[0].length;
  c.height = rows.length;
  const g = c.getContext('2d')!;
  rows.forEach((row, y) => {
    [...row].forEach((ch, x) => {
      const color = palette[ch];
      if (color) {
        g.fillStyle = color;
        g.fillRect(x, y, 1, 1);
      }
    });
  });
  cache.set(key, c);
  return c;
}

export function spyImage(palette: SpyPalette, frame: SpyFrame): HTMLCanvasElement {
  return bake(`spy:${palette}:${frame}`, SPY_FRAMES[frame], SPY_PALETTES[palette]);
}

export function iconImage(name: IconName): HTMLCanvasElement {
  return bake(`icon:${name}`, ICONS[name], ICON_PALETTE);
}

/** Draws with (x, y) = bottom-centre of the sprite. */
export function drawSprite(ctx: CanvasRenderingContext2D, img: HTMLCanvasElement, x: number, y: number, flip = false): void {
  const dx = Math.round(x - img.width / 2);
  const dy = Math.round(y - img.height);
  if (!flip) {
    ctx.drawImage(img, dx, dy);
    return;
  }
  ctx.save();
  ctx.translate(dx + img.width, dy);
  ctx.scale(-1, 1);
  ctx.drawImage(img, 0, 0);
  ctx.restore();
}

/** Screen pixel of the frame's hand when the sprite is drawn with drawSprite at (x, y) = bottom-centre. */
export function handPoint(frame: SpyFrame, x: number, y: number, flip = false): { hx: number; hy: number } {
  const rows = SPY_FRAMES[frame];
  const w = rows[0].length;
  const left = Math.round(x - w / 2);
  const top = Math.round(y - rows.length);
  const [px, py] = SPY_HANDS[frame];
  return { hx: left + (flip ? w - 1 - px : px), hy: top + py };
}

/** What a spy visibly carries in hand: the kufřík, or a loose secret in a satchel (spec §6); remedies stay undrawn. */
export type HeldIcon = 'kufrik' | 'satchel';

export function heldIcon(t: Thing | null): HeldIcon | null {
  if (t === null) return null;
  switch (t.kind) {
    case 'kufrik':
      return 'kufrik';
    case 'secret':
      return 'satchel';
    case 'remedy':
      return null;
  }
}

/** Icon row of the handle / strap top that sits on the hand pixel. */
export const HANDLE_ROW: Readonly<Record<HeldIcon, number>> = { kufrik: 1, satchel: 0 };

/** Draws a held item hanging from the frame's hand (its handle row sits on the hand pixel). */
export function drawInHand(
  ctx: CanvasRenderingContext2D, icon: HeldIcon, frame: SpyFrame, x: number, y: number, flip = false,
): void {
  const { hx, hy } = handPoint(frame, x, y, flip);
  // icons are 8×8 anchored bottom-centre: row HANDLE_ROW lands on hy
  drawIcon(ctx, icon, hx, hy + 8 - HANDLE_ROW[icon]);
}

/** Draws the kufřík hanging from the frame's hand (the handle sits on the hand pixel). */
export function drawKufrikInHand(ctx: CanvasRenderingContext2D, frame: SpyFrame, x: number, y: number, flip = false): void {
  drawInHand(ctx, 'kufrik', frame, x, y, flip);
}

export function drawIcon(ctx: CanvasRenderingContext2D, name: IconName, cx: number, bottomY: number): void {
  drawSprite(ctx, iconImage(name), cx, bottomY);
}

export function thingIcon(t: Thing): IconName {
  switch (t.kind) {
    case 'secret':
      return t.secret;
    case 'kufrik':
      return 'kufrik';
    case 'remedy':
      return t.remedy;
  }
}
