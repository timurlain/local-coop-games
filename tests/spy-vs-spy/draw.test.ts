import { describe, expect, it } from 'vitest';
import { line, poly, withScale } from '../../src/games/spy-vs-spy/render/draw';

/**
 * A minimal recording `CanvasRenderingContext2D`: `moveTo`/`lineTo` are recorded as points, everything else
 * (fillStyle, strokeStyle, beginPath, closePath, fill, stroke, lineWidth) is a no-op, so `poly`/`line` run
 * without a real canvas.
 */
function makeCtx(): { ctx: CanvasRenderingContext2D; points: [number, number][] } {
  const points: [number, number][] = [];
  const target: Record<string, unknown> = {
    moveTo(x: number, y: number) { points.push([x, y]); },
    lineTo(x: number, y: number) { points.push([x, y]); },
  };
  const ctx = new Proxy(target, {
    get(t, prop, receiver) {
      if (prop in t) return Reflect.get(t, prop, receiver);
      return () => undefined;
    },
    set(t, prop, value) {
      t[prop as string] = value;
      return true;
    },
  });
  return { ctx: ctx as unknown as CanvasRenderingContext2D, points };
}

describe('poly and line snap to whole device pixels under withScale (crisp furniture edges)', () => {
  it('poly snaps every scaled point to a whole pixel', () => {
    const { ctx, points } = makeCtx();
    // scale 0.37 around (10, 10) is chosen to land the raw scaled coordinates on a fraction
    withScale(10, 10, 0.37, () => {
      poly(ctx, [[20, 20], [24, 26]], '#fff');
    });
    for (const [x, y] of points) {
      expect(x).toBe(Math.round(x));
      expect(y).toBe(Math.round(y));
    }
  });

  it('line snaps to whole pixels plus 0.5, so a 1-px stroke lands crisp', () => {
    const { ctx, points } = makeCtx();
    withScale(10, 10, 0.37, () => {
      line(ctx, 20, 20, 24, 26, '#fff');
    });
    for (const [x, y] of points) {
      expect(x - Math.floor(x)).toBeCloseTo(0.5);
      expect(y - Math.floor(y)).toBeCloseTo(0.5);
    }
  });

  it('at scale 1 with an integer anchor, poly leaves whole-pixel input points unchanged', () => {
    const { ctx, points } = makeCtx();
    poly(ctx, [[3, 4], [7, 9]], '#fff');
    expect(points).toEqual([[3, 4], [7, 9]]);
  });
});
