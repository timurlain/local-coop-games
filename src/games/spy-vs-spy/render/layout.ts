/**
 * Screen layout of one 320×100 half, in the style of the 1984 original: the room in a brick-red TV
 * frame on the left, a strip under it, and the Trapulator device on the right.
 */
export interface Rect {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

const rect = (x: number, y: number, w: number, h: number): Rect => ({ x, y, w, h });

export const HALF_W = 320;
export const HALF_H = 100;

/** Rounded brick-red bezel, incl. its border. */
export const FRAME = rect(1, 1, 216, 84);
/** Width of the bezel around the room view. */
export const FRAME_BORDER = 4;
/** The room view inside the bezel. */
export const ROOM = rect(FRAME.x + FRAME_BORDER, FRAME.y + FRAME_BORDER, FRAME.w - 2 * FRAME_BORDER, FRAME.h - 2 * FRAME_BORDER);
/** Label strip under the frame. */
export const UNDER = rect(1, 86, 216, 13);
/** Parts of the under-frame strip. */
export const UNDER_PARTS = {
  name: rect(3, 87, 24, 11),
  room: rect(29, 87, 84, 11),
  toast: rect(115, 87, 62, 11),
  pips: rect(179, 88, 36, 9),
} as const;

/** The Trapulator: a calculator-like device on the right. */
export const DEVICE = rect(222, 1, 97, 98);

const TRAP_BUTTON_W = 13;
const TRAP_BUTTON_STEP = 15;
const BUTTON_Y = 21;
const BUTTON_H = 15;
const SECRET_STEP = 13;

/** Contents of the Trapulator device. Text labels are placed from these rects by the renderer. */
export const DEV = {
  /** red LED clock */
  led: rect(226, 3, 70, 11),
  /** low-time warning light */
  warn: rect(301, 4, 9, 9),
  /** PASTI: the five trap buttons, in TRAPS order */
  traps: [0, 1, 2, 3, 4].map((i) => rect(226 + i * TRAP_BUTTON_STEP, BUTTON_Y, TRAP_BUTTON_W, BUTTON_H)),
  /** MAPA: the sixth button */
  map: rect(302, BUTTON_Y, 13, BUTTON_H),
  /** baseline of the PASTI / MAPA labels above the buttons */
  buttonLabelY: 19,
  /** OCHRANA: the carried remedy (green frame) */
  remedy: rect(254, 39, 12, 12),
  /** crossed-out icon of the trap the remedy defuses */
  remedyHint: rect(268, 40, 10, 10),
  remedyLabelY: 48,
  /** TAJNÉ: four gold slots in SECRETS order */
  secrets: [0, 1, 2, 3].map((i) => rect(247 + i * SECRET_STEP, 53, 11, 11)),
  /** brown kufřík slot */
  kufrik: rect(301, 53, 14, 11),
  secretsLabelY: 61,
  /** always-on mini-map */
  minimap: rect(226, 65, 89, 32),
} as const;

export function contains(outer: Rect, inner: Rect): boolean {
  return inner.x >= outer.x && inner.y >= outer.y && inner.x + inner.w <= outer.x + outer.w && inner.y + inner.h <= outer.y + outer.h;
}

export function overlaps(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

/** Placement of a cols×rows room grid inside an area. */
export interface GridLayout {
  x0: number;
  y0: number;
  cellW: number;
  cellH: number;
  gap: number;
}

/**
 * Largest grid of cells (at most `maxW`×`maxH`, ratio kept near `maxW/maxH`) with `gap` px between cells that
 * fits `area` with `margin` px left free around it (for the exit marker), centred.
 */
export function gridLayout(
  cols: number, rows: number, area: Rect, opts: { maxW: number; maxH: number; gap: number; margin: number },
): GridLayout {
  const { maxW, maxH, gap, margin } = opts;
  const fitW = Math.floor((area.w - 2 * margin - (cols - 1) * gap) / cols);
  const fitH = Math.floor((area.h - 2 * margin - (rows - 1) * gap) / rows);
  let cellW = Math.min(maxW, fitW);
  let cellH = Math.min(maxH, fitH);
  // keep roughly the room's aspect: never wider than maxW/maxH times the height, nor taller than that allows
  cellW = Math.max(1, Math.min(cellW, Math.round((cellH * maxW) / maxH)));
  cellH = Math.max(1, Math.min(cellH, Math.round((cellW * maxH) / maxW) + 1));
  const gridW = cols * cellW + (cols - 1) * gap;
  const gridH = rows * cellH + (rows - 1) * gap;
  return {
    x0: area.x + Math.floor((area.w - gridW) / 2),
    y0: area.y + Math.floor((area.h - gridH) / 2),
    cellW,
    cellH,
    gap,
  };
}

/**
 * `gridLayout` with the widest gap from `gaps` (widest first) whose cells are still at least `minH` tall; the
 * narrowest gap when none is. Keeps the round-2 spacing on small embassies and squeezes the gaps on tall ones (6×6).
 */
function gridWithGap(
  cols: number, rows: number, area: Rect, opts: { maxW: number; maxH: number; margin: number },
  gaps: readonly number[], minH: number,
): GridLayout {
  let g = gridLayout(cols, rows, area, { ...opts, gap: gaps[0] });
  for (const gap of gaps.slice(1)) {
    if (g.cellH >= minH) break;
    g = gridLayout(cols, rows, area, { ...opts, gap });
  }
  return g;
}

/** Mini-map grid in the Trapulator. */
export function minimapLayout(cols: number, rows: number): GridLayout {
  return gridWithGap(cols, rows, DEV.minimap, { maxW: 7, maxH: 5, margin: 3 }, [2, 1], 3);
}

/** Big map grid, drawn instead of the room view; cells stay tall enough for the 8 px plane icon. */
export function bigMapLayout(cols: number, rows: number): GridLayout {
  return gridWithGap(cols, rows, ROOM, { maxW: 34, maxH: 16, margin: 6 }, [5, 4, 3, 2], 9);
}
