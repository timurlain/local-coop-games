import type { RemedyKind, Thing } from '../logic/state';
import {
  ICONS, ICON_PALETTE, SPY_BACK_HANDS, SPY_CANOPY, SPY_CENTER_X, SPY_FRAMES, SPY_HANDS, SPY_PALETTES,
  type IconName, type SpyFrame, type SpyPalette,
} from './sprite-data';

/** Sentinel character marking the outline ring in `outlineRows`' output; never a real palette key. */
const OUTLINE_MARK = '+';

/**
 * Pads `rows` by 1px on every side and marks every transparent cell touching an opaque one (4-directionally)
 * with `mark`, so the result can be baked into a silhouette that rings the icon's opaque pixels (round 4 §2:
 * items held in hand need to read against a same-toned coat). Pure and side-effect free.
 */
export function outlineRows(rows: readonly string[], mark: string = OUTLINE_MARK): string[] {
  const h = rows.length;
  const w = h > 0 ? rows[0].length : 0;
  const padded: string[][] = Array.from({ length: h + 2 }, () => Array<string>(w + 2).fill('.'));
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) padded[y + 1][x + 1] = rows[y][x];
  }
  const opaque = (x: number, y: number): boolean => (padded[y]?.[x] ?? '.') !== '.';
  return padded.map((row, y) => row
    .map((ch, x) => (ch === '.' && (opaque(x - 1, y) || opaque(x + 1, y) || opaque(x, y - 1) || opaque(x, y + 1)) ? mark : ch))
    .join(''));
}

/** Outline colour that reads on that spy's own coat: light grey on the black spy, dark on the white spy. */
export function handOutline(palette: SpyPalette): string {
  return palette === 'black' ? '#d8d8d8' : '#1a1a1a';
}

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

/** The icon with a baked-in 1px outline ring in `outline`, cached per icon + colour like the other baked sprites. */
export function outlinedIconImage(name: IconName, outline: string): HTMLCanvasElement {
  return bake(`icon+:${name}:${outline}`, outlineRows(ICONS[name]), { ...ICON_PALETTE, [OUTLINE_MARK]: outline });
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

/**
 * Draws a spy frame standing at (x, y): its body centre column (SPY_CENTER_X) on x, its bottom row just above y.
 * Flipped, the image is mirrored about that column, so the spy turns on the spot.
 */
export function drawSpySprite(ctx: CanvasRenderingContext2D, img: HTMLCanvasElement, x: number, y: number, flip = false): void {
  const cx = Math.round(x);
  const top = Math.round(y - img.height);
  if (!flip) {
    ctx.drawImage(img, cx - SPY_CENTER_X, top);
    return;
  }
  ctx.save();
  ctx.translate(cx + SPY_CENTER_X + 1, top);
  ctx.scale(-1, 1);
  ctx.drawImage(img, 0, 0);
  ctx.restore();
}

/** Screen pixel of image pixel (px, py) of a spy frame drawn with drawSpySprite at (x, y). */
function spyPixel(frame: SpyFrame, [px, py]: readonly [number, number], x: number, y: number, flip: boolean): { hx: number; hy: number } {
  const top = Math.round(y - SPY_FRAMES[frame].length);
  return { hx: Math.round(x) + (flip ? SPY_CENTER_X - px : px - SPY_CENTER_X), hy: top + py };
}

/** Which hand: the carrying `front` hand (SPY_HANDS) or the `back` hand (SPY_BACK_HANDS, spec §2). */
export type Hand = 'front' | 'back';

/** Screen pixel of the frame's hand when the spy is drawn with drawSpySprite at (x, y). */
export function handPoint(frame: SpyFrame, x: number, y: number, flip = false, hand: Hand = 'front'): { hx: number; hy: number } {
  return spyPixel(frame, (hand === 'back' ? SPY_BACK_HANDS : SPY_HANDS)[frame], x, y, flip);
}

/** Screen pixel in the middle of the open umbrella's canopy (block, duck); the front hand for other frames. */
export function canopyPoint(frame: SpyFrame, x: number, y: number, flip = false): { hx: number; hy: number } {
  return spyPixel(frame, SPY_CANOPY[frame] ?? SPY_HANDS[frame], x, y, flip);
}

/** What a spy visibly carries in hand: the kufřík, a loose secret in a satchel (spec §6), or a remedy (round 4 §3). */
export type HeldIcon = 'kufrik' | 'satchel' | RemedyKind;

export function heldIcon(t: Thing | null): HeldIcon | null {
  if (t === null) return null;
  switch (t.kind) {
    case 'kufrik':
      return 'kufrik';
    case 'secret':
      return 'satchel';
    case 'remedy':
      return t.remedy;
  }
}

/**
 * Every icon that can be drawn in a hand: the carried things, the selected trap (spec §2), the carried
 * remedies and the umbrella opened over the head while disarming (spec §3).
 */
export const HAND_ICONS = [
  'kufrik', 'satchel',
  'bomba', 'pruzina', 'elektrina', 'pistole', 'casovana',
  'voda', 'kleste', 'destnik', 'nuzky', 'destnik_open',
] as const satisfies readonly IconName[];

export type HandIcon = (typeof HAND_ICONS)[number];

/** Icon row of the handle / strap / grip that sits on the hand pixel. */
export const HANDLE_ROW: Readonly<Record<HandIcon, number>> = {
  kufrik: 1,
  satchel: 0,
  // traps: held by the top of the bomb / the top plate / the bucket rim / the barrel / the clock case
  bomba: 3,
  pruzina: 0,
  elektrina: 4,
  pistole: 2,
  casovana: 2,
  // remedies: the bucket's wire handle, where the pliers' handles meet, the crook, the scissors' pivot
  voda: 0,
  kleste: 3,
  destnik: 0,
  nuzky: 3,
  // the open umbrella is gripped on the shaft above the crook
  destnik_open: 5,
};

/**
 * Draws a held item hanging from the frame's front (or back) hand: its handle row sits on the hand pixel.
 * With `outline` set (see `handOutline`), the icon gets a baked 1px ring in that colour first, so it still
 * reads against a same-toned coat (round 4 §2). The outlined bake is padded 1px on every side, so it is drawn
 * 1px lower than the plain icon to keep its original pixels lined up on the same hand point.
 */
export function drawInHand(
  ctx: CanvasRenderingContext2D, icon: HandIcon, frame: SpyFrame, x: number, y: number, flip = false, hand: Hand = 'front',
  outline?: string,
): void {
  const { hx, hy } = handPoint(frame, x, y, flip, hand);
  // icons are anchored bottom-centre: row HANDLE_ROW lands on hy
  const bottomY = hy + ICONS[icon].length - HANDLE_ROW[icon];
  if (outline) drawSprite(ctx, outlinedIconImage(icon, outline), hx, bottomY + 1);
  else drawIcon(ctx, icon, hx, bottomY);
}

/** Draws the kufřík hanging from the frame's hand (the handle sits on the hand pixel). */
export function drawKufrikInHand(
  ctx: CanvasRenderingContext2D, frame: SpyFrame, x: number, y: number, flip = false, outline?: string,
): void {
  drawInHand(ctx, 'kufrik', frame, x, y, flip, 'front', outline);
}

export function drawIcon(ctx: CanvasRenderingContext2D, name: IconName, cx: number, bottomY: number): void {
  drawSprite(ctx, iconImage(name), cx, bottomY);
}

/** An icon with a 1-px `outline` around it, so a dark icon still reads in front of Černý's coat. */
export function drawIconOutlined(ctx: CanvasRenderingContext2D, name: IconName, cx: number, bottomY: number, outline: string): void {
  const rows = ICONS[name];
  const inks = [...new Set(rows.join(''))].filter((ch) => ch !== '.');
  const sil = bake(`sil:${name}:${outline}`, rows, Object.fromEntries(inks.map((ch) => [ch, outline])));
  for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]] as const) drawSprite(ctx, sil, cx + dx, bottomY + dy);
  drawIcon(ctx, name, cx, bottomY);
}

/** An icon scaled by `k` about its centre (cx, cy); used where one shrinks into a target. */
export function drawIconScaled(ctx: CanvasRenderingContext2D, name: IconName, cx: number, cy: number, k: number): void {
  const img = iconImage(name);
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(k, k);
  ctx.drawImage(img, -img.width / 2, -img.height / 2);
  ctx.restore();
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
