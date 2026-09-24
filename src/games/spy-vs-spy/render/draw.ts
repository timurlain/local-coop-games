type Ctx = CanvasRenderingContext2D;

/** Active drawing scale set by `withScale`: points map to anchor + (p − anchor) · k. */
let sk = 1;
let sax = 0;
let say = 0;
const mx = (x: number): number => sax + (x - sax) * sk;
const my = (y: number): number => say + (y - say) * sk;

/**
 * Runs `draw` with every helper here (r, poly, line, text, disc) scaled by `k` around (ax, ay). Rectangles are
 * still snapped to whole pixels after scaling, so pixel art drawn at its original size stays crisp when shrunk.
 */
export function withScale(ax: number, ay: number, k: number, draw: () => void): void {
  const prev = [sk, sax, say] as const;
  sk = k;
  sax = ax;
  say = ay;
  try {
    draw();
  } finally {
    [sk, sax, say] = prev;
  }
}

export function r(ctx: Ctx, x: number, y: number, w: number, h: number, color: string): void {
  ctx.fillStyle = color;
  const x0 = Math.round(mx(x)), y0 = Math.round(my(y));
  let x1 = Math.round(mx(x + w)), y1 = Math.round(my(y + h));
  // a detail that shrinks below a pixel keeps one pixel
  if (w > 0 && x1 === x0) x1 = x0 + 1;
  if (h > 0 && y1 === y0) y1 = y0 + 1;
  ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
}

export function poly(ctx: Ctx, pts: readonly (readonly [number, number])[], color: string): void {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(mx(pts[0][0]), my(pts[0][1]));
  for (const [x, y] of pts.slice(1)) ctx.lineTo(mx(x), my(y));
  ctx.closePath();
  ctx.fill();
}

export function line(ctx: Ctx, x1: number, y1: number, x2: number, y2: number, color: string): void {
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(mx(x1), my(y1));
  ctx.lineTo(mx(x2), my(y2));
  ctx.stroke();
}

export function text(
  ctx: Ctx, s: string, x: number, y: number, color: string, size = 7, align: CanvasTextAlign = 'left',
): void {
  ctx.fillStyle = color;
  ctx.font = `bold ${size * sk}px monospace`;
  ctx.textAlign = align;
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(s, mx(x), my(y));
}

export function shade(hex: string, factor: number): string {
  const n = parseInt(hex.slice(1), 16);
  const [rr, gg, bb] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => Math.round(v * factor));
  return `rgb(${rr},${gg},${bb})`;
}

/** Filled pixel circle (row by row, so it stays crisp when scaled). */
export function disc(ctx: Ctx, cx: number, cy: number, radius: number, color: string): void {
  for (let dy = -radius; dy <= radius; dy++) {
    const half = Math.floor(Math.sqrt(radius * radius - dy * dy) + 0.3);
    r(ctx, cx - half, cy + dy, half * 2 + 1, 1, color);
  }
}

/** Rounded rectangle path (for the TV frame and device body). */
export function roundRect(ctx: Ctx, x: number, y: number, w: number, h: number, radius: number): void {
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}
