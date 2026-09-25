// Supersampling rasterizer for the rig: vector shapes in output-pixel space (x right, y down) are painted
// back-to-front into a fine grid of palette characters, then voted down to one character per output pixel,
// and finally ringed with a 1-px outline. Pure: no DOM, same result in node and the browser.

export type Vec = readonly [x: number, y: number];

export type Shape =
  | { readonly kind: 'poly'; readonly pts: readonly Vec[] }
  /** A limb: round-ended segment a→b whose radius goes linearly from ra to rb. */
  | { readonly kind: 'capsule'; readonly a: Vec; readonly b: Vec; readonly ra: number; readonly rb: number }
  | { readonly kind: 'circle'; readonly c: Vec; readonly r: number };

/** One painted shape: its palette character and the part it belongs to (higher part = nearer the viewer). */
export interface Paint {
  readonly shape: Shape;
  readonly ch: string;
  readonly part: number;
}

/** The fine grid: `ss`×`ss` samples per output pixel; character code 0 is transparent. */
export interface SuperBuffer {
  readonly w: number;
  readonly h: number;
  readonly ss: number;
  readonly chars: Uint16Array;
  readonly parts: Uint8Array;
}

/** One output pixel after the vote. */
export interface Cell {
  readonly ch: string;
  readonly part: number;
}

function inPoly(pts: readonly Vec[], x: number, y: number): boolean {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i];
    const [xj, yj] = pts[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function inCapsule(s: Extract<Shape, { kind: 'capsule' }>, x: number, y: number): boolean {
  const [ax, ay] = s.a;
  const dx = s.b[0] - ax;
  const dy = s.b[1] - ay;
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / len2));
  const px = ax + t * dx - x;
  const py = ay + t * dy - y;
  const r = s.ra + (s.rb - s.ra) * t;
  return px * px + py * py <= r * r;
}

export function contains(s: Shape, x: number, y: number): boolean {
  switch (s.kind) {
    case 'poly':
      return inPoly(s.pts, x, y);
    case 'capsule':
      return inCapsule(s, x, y);
    case 'circle': {
      const dx = x - s.c[0];
      const dy = y - s.c[1];
      return dx * dx + dy * dy <= s.r * s.r;
    }
  }
}

function bounds(s: Shape): [number, number, number, number] {
  switch (s.kind) {
    case 'poly': {
      const xs = s.pts.map((p) => p[0]);
      const ys = s.pts.map((p) => p[1]);
      return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
    }
    case 'capsule': {
      const r = Math.max(s.ra, s.rb);
      return [Math.min(s.a[0], s.b[0]) - r, Math.min(s.a[1], s.b[1]) - r, Math.max(s.a[0], s.b[0]) + r, Math.max(s.a[1], s.b[1]) + r];
    }
    case 'circle':
      return [s.c[0] - s.r, s.c[1] - s.r, s.c[0] + s.r, s.c[1] + s.r];
  }
}

/** Paints `paints` in order (painter's algorithm) into a w×h image supersampled `ss` times per axis. */
export function rasterize(paints: readonly Paint[], w: number, h: number, ss: number): SuperBuffer {
  const W = w * ss;
  const H = h * ss;
  const chars = new Uint16Array(W * H);
  const parts = new Uint8Array(W * H);
  for (const { shape, ch, part } of paints) {
    const code = ch.charCodeAt(0);
    const [x0, y0, x1, y1] = bounds(shape);
    const sx0 = Math.max(0, Math.floor(x0 * ss));
    const sy0 = Math.max(0, Math.floor(y0 * ss));
    const sx1 = Math.min(W - 1, Math.ceil(x1 * ss));
    const sy1 = Math.min(H - 1, Math.ceil(y1 * ss));
    for (let sy = sy0; sy <= sy1; sy++) {
      const y = (sy + 0.5) / ss;
      for (let sx = sx0; sx <= sx1; sx++) {
        if (!contains(shape, (sx + 0.5) / ss, y)) continue;
        chars[sy * W + sx] = code;
        parts[sy * W + sx] = part;
      }
    }
  }
  return { w, h, ss, chars, parts };
}

/**
 * Votes each output pixel from its ss×ss samples: every character scores (samples × weight), transparency
 * scores its plain sample count, and the best score wins. Heavy weights let thin details (the eye, the
 * umbrella's shaft, drawn lines) survive the downsample; the winner's most common part is kept for outlining.
 */
export function downsample(buf: SuperBuffer, weights: Readonly<Record<string, number>>): Cell[][] {
  const { w, h, ss, chars, parts } = buf;
  const W = w * ss;
  // per-pixel tallies by character code / part number, reset after each pixel
  const counts = new Float64Array(65536);
  const partCounts = new Uint32Array(256);
  const weightOf = new Float64Array(65536).fill(1);
  for (const [ch, k] of Object.entries(weights)) weightOf[ch.charCodeAt(0)] = k;
  const out: Cell[][] = [];
  for (let y = 0; y < h; y++) {
    const row: Cell[] = [];
    for (let x = 0; x < w; x++) {
      const seen: number[] = [];
      for (let sy = y * ss; sy < (y + 1) * ss; sy++) {
        for (let sx = x * ss; sx < (x + 1) * ss; sx++) {
          const c = chars[sy * W + sx];
          if (counts[c] === 0) seen.push(c);
          counts[c]++;
        }
      }
      let best = 0;
      let bestScore = -1;
      // iterate in a fixed order (char code) so ties resolve deterministically
      for (const c of seen.sort((p, q) => p - q)) {
        const score = counts[c] * (c === 0 ? 1 : weightOf[c]);
        if (score > bestScore) {
          best = c;
          bestScore = score;
        }
        counts[c] = 0;
      }
      if (best === 0) {
        row.push({ ch: '.', part: 0 });
        continue;
      }
      const partsSeen: number[] = [];
      for (let sy = y * ss; sy < (y + 1) * ss; sy++) {
        for (let sx = x * ss; sx < (x + 1) * ss; sx++) {
          const i = sy * W + sx;
          if (chars[i] !== best) continue;
          if (partCounts[parts[i]] === 0) partsSeen.push(parts[i]);
          partCounts[parts[i]]++;
        }
      }
      let part = 0;
      let most = -1;
      for (const p of partsSeen.sort((p, q) => p - q)) {
        if (partCounts[p] > most) {
          part = p;
          most = partCounts[p];
        }
        partCounts[p] = 0;
      }
      row.push({ ch: String.fromCharCode(best), part });
    }
    out.push(row);
  }
  return out;
}

const N4 = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const;

/**
 * Turns voted cells into rows. Inside: a pixel of a part that touches a nearer part (`separate` says the two
 * need a line, e.g. same colour) becomes `mark`, so the nearer part keeps its full shape and gets a 1-px
 * line where it overlaps. Outside: every transparent pixel 4-touching the figure becomes `mark`.
 */
export function outline(
  cells: readonly (readonly Cell[])[],
  separate: (back: Cell, front: Cell) => boolean,
  mark = 'o',
): string[] {
  const h = cells.length;
  const w = h > 0 ? cells[0].length : 0;
  const at = (x: number, y: number): Cell | undefined => cells[y]?.[x];
  return cells.map((row, y) => row.map((c, x) => {
    if (c.ch === '.') return N4.some(([dx, dy]) => (at(x + dx, y + dy)?.ch ?? '.') !== '.') ? mark : '.';
    if (c.ch === mark) return mark;
    for (const [dx, dy] of N4) {
      const n = at(x + dx, y + dy);
      if (n && n.ch !== '.' && n.part > c.part && separate(c, n)) return mark;
    }
    return c.ch;
  }).join('')).map((r) => r.padEnd(w, '.'));
}
