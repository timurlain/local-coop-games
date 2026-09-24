export const LOGICAL_W = 320;
export const LOGICAL_H = 200;

export interface Viewport {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Top half for player 0, bottom half for player 1. */
export const HALVES: readonly [Viewport, Viewport] = [
  { x: 0, y: 0, w: LOGICAL_W, h: LOGICAL_H / 2 },
  { x: 0, y: LOGICAL_H / 2, w: LOGICAL_W, h: LOGICAL_H / 2 },
];

export function computeScale(winW: number, winH: number): number {
  return Math.max(1, Math.floor(Math.min(winW / LOGICAL_W, winH / LOGICAL_H)));
}

/** Resizes the canvas backing store to an integer multiple of the logical size. */
export function fitCanvas(canvas: HTMLCanvasElement, winW: number, winH: number): number {
  const s = computeScale(winW, winH);
  canvas.width = LOGICAL_W * s;
  canvas.height = LOGICAL_H * s;
  canvas.style.width = `${LOGICAL_W * s}px`;
  canvas.style.height = `${LOGICAL_H * s}px`;
  return s;
}

/** Runs `draw` with logical coordinates local to the viewport, clipped to it. */
export function withViewport(ctx: CanvasRenderingContext2D, scale: number, vp: Viewport, draw: () => void): void {
  ctx.save();
  ctx.setTransform(scale, 0, 0, scale, vp.x * scale, vp.y * scale);
  ctx.beginPath();
  ctx.rect(0, 0, vp.w, vp.h);
  ctx.clip();
  ctx.imageSmoothingEnabled = false;
  draw();
  ctx.restore();
}
