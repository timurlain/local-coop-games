import type { HostCountry } from '../logic/state';

type Ctx = CanvasRenderingContext2D;

/** Flag colours. Only these, only as listed in `FLAGS`: every flag in the game is period-correct (1929-1937). */
export const FLAG_COLORS = {
  white: '#f4f4f0',
  csRed: '#d7141a',
  csBlue: '#11457e',
  plRed: '#dc143c',
  black: '#141414',
  deRed: '#dd0000',
  gold: '#ffce00',
  huRed: '#ce2939',
  huGreen: '#477050',
  atRed: '#c8102e',
} as const;

export interface FlagSpec {
  /** horizontal bands, top to bottom, equal heights */
  bands: readonly string[];
  /** isosceles triangle from the hoist to the middle of the flag (Czechoslovakia) */
  hoistTriangle: string | null;
}

const C = FLAG_COLORS;

/**
 * The five host flags as they were in the interwar years:
 * - cs: white over red, blue triangle at the hoist (Czechoslovakia, from 1920)
 * - pl: white over red (Poland)
 * - de: black-red-gold horizontal tricolour (Weimar Republic, 1919-1933) — never any other German flag
 * - hu: red-white-green horizontal tricolour (Kingdom of Hungary)
 * - at: red-white-red horizontal (Republic of Austria)
 */
export const FLAGS: Readonly<Record<HostCountry, FlagSpec>> = {
  cs: { bands: [C.white, C.csRed], hoistTriangle: C.csBlue },
  pl: { bands: [C.white, C.plRed], hoistTriangle: null },
  de: { bands: [C.black, C.deRed, C.gold], hoistTriangle: null },
  hu: { bands: [C.huRed, C.white, C.huGreen], hoistTriangle: null },
  at: { bands: [C.atRed, C.white, C.atRed], hoistTriangle: null },
};

/**
 * Draws a flag with its top-left corner at (x, y) in whole pixels, hoist on the left. `h` should be a multiple of
 * the band count (6 works for all five). `wave` (0 or 1) drops the fly-end column by a pixel for a gentle flutter.
 */
export function drawFlag(ctx: Ctx, host: HostCountry, x: number, y: number, w: number, h: number, wave = 0): void {
  const spec = FLAGS[host];
  const n = spec.bands.length;
  const x0 = Math.round(x);
  const y0 = Math.round(y);
  for (let col = 0; col < w; col++) {
    // the last third of the flag ripples
    const dy = wave && col >= Math.ceil((w * 2) / 3) ? (col % 2 === 0 ? 1 : 0) : 0;
    for (let i = 0; i < n; i++) {
      const top = Math.round((h * i) / n);
      const bottom = Math.round((h * (i + 1)) / n);
      ctx.fillStyle = spec.bands[i];
      ctx.fillRect(x0 + col, y0 + top + dy, 1, bottom - top);
    }
  }
  if (spec.hoistTriangle) {
    // column by column: full height at the hoist, a point at half the flag's length
    const len = w / 2;
    ctx.fillStyle = spec.hoistTriangle;
    for (let col = 0; col < Math.ceil(len); col++) {
      const half = (h / 2) * (1 - col / len);
      const top = Math.round(h / 2 - half);
      const bottom = Math.round(h / 2 + half);
      if (bottom > top) ctx.fillRect(x0 + col, y0 + top, 1, bottom - top);
    }
  }
}
