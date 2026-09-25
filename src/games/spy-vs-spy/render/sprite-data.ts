// Pixel-string sprites. '.' is transparent; other characters index a palette.

import { RIG_H, RIG_POSES, RIG_W, renderRig, type RigChar, type RigFrame, type RigPoseName } from './rig';

// Spies: every frame is rendered once, at load, from the 2D rig (render/rig): a pose → skeleton → vector parts →
// supersampled raster → rows of palette characters. Deterministic, so the rig is the one source of truth.
// Facing right, the body's centre line on column SPY_CENTER_X, the ground under the bottom row.
// o = outline, b = the spy colour (coat, trousers, hat), s / S = skin and its shade, d = eye, k = shoes,
// u = umbrella, h = its crook, f = its ferrule.

export const SPY_W = RIG_W;
export const SPY_H = RIG_H;
export const SPY_CENTER_X = Math.floor(RIG_W / 2);

export type SpyFrame = RigPoseName;

const RENDERED = Object.fromEntries(
  (Object.keys(RIG_POSES) as SpyFrame[]).map((name) => [name, renderRig(RIG_POSES[name])]),
) as Record<SpyFrame, RigFrame>;

function each<T>(pick: (f: RigFrame) => T): Record<SpyFrame, T> {
  return Object.fromEntries(Object.entries(RENDERED).map(([name, f]) => [name, pick(f)])) as Record<SpyFrame, T>;
}

export const SPY_FRAMES: Readonly<Record<SpyFrame, readonly string[]>> = each((f) => f.rows);

/** Image pixel (x, y) of the front (near) hand in each frame: it carries things, and holds the umbrella in a fight. */
export const SPY_HANDS: Readonly<Record<SpyFrame, readonly [number, number]>> = each((f) => f.hand);

/** Image pixel (x, y) of the back (far) hand, where the carried thing hangs while a trap is in front (round 4 §2). */
export const SPY_BACK_HANDS: Readonly<Record<SpyFrame, readonly [number, number]>> = each((f) => f.backHand);

/** Image pixel in the middle of the open umbrella's canopy, for the frames that open it (block, duck). */
export const SPY_CANOPY: Readonly<Partial<Record<SpyFrame, readonly [number, number]>>> = Object.fromEntries(
  Object.entries(RENDERED).flatMap(([name, f]) => (f.canopy ? [[name, f.canopy]] : [])),
);

/** First and last drawn columns / first drawn row of a frame. */
function extent(rows: readonly string[]): { left: number; right: number; top: number } {
  const cols = rows.flatMap((r) => [...r].flatMap((ch, x) => (ch === '.' ? [] : [x])));
  return { left: Math.min(...cols), right: Math.max(...cols), top: rows.findIndex((r) => /[^.]/.test(r)) };
}

const STAND = extent(SPY_FRAMES.stand);
/** Height of the standing spy above the floor, px (hat top to sole): anchors things drawn above his head. */
export const SPY_STAND_H = SPY_H - STAND.top;
/** How far the standing spy reaches from his centre line, px (the nose in front, the hat brim behind). */
export const SPY_STAND_REACH = Math.max(STAND.right - SPY_CENTER_X, SPY_CENTER_X - STAND.left);
/** Columns from the centre line back to the standing spy's back (outline included): he lies on it when knocked flat. */
export const SPY_STAND_BACK = SPY_CENTER_X - STAND.left;

/**
 * Spy palettes: the two spies, sooty (bomb), soaked (electric shock) and ghost (respawn). Skin, eye, shoes and the
 * umbrella are tinted with the body so a sooty or soaked spy reads as one colour.
 */
export const SPY_PALETTES: Readonly<Record<'white' | 'black' | 'sooty' | 'soaked' | 'ghost', Readonly<Record<RigChar, string>>>> = {
  white: { o: '#1a1a1a', b: '#f2f2f2', s: '#f0a484', S: '#c47858', d: '#1a1a1a', k: '#1a1a1a', u: '#262626', h: '#8b5a2b', f: '#c8c8c8' },
  black: { o: '#9a9a9a', b: '#1e1e1e', s: '#f0a484', S: '#c47858', d: '#1a1a1a', k: '#050505', u: '#383838', h: '#8b5a2b', f: '#c8c8c8' },
  sooty: { o: '#000000', b: '#3a3a3a', s: '#6a5a52', S: '#4a3e38', d: '#ffffff', k: '#000000', u: '#1a1a1a', h: '#4a3020', f: '#808080' },
  soaked: { o: '#1b3a6b', b: '#8cc4ff', s: '#c8b8e8', S: '#9a8cc0', d: '#1b3a6b', k: '#1b3a6b', u: '#2a4a7a', h: '#5a6a8a', f: '#c8d8ff' },
  ghost: { o: '#dddddd', b: '#ffffff', s: '#fff0ea', S: '#eeddd6', d: '#999999', k: '#cccccc', u: '#dddddd', h: '#e6d8cc', f: '#ffffff' },
};

export type SpyPalette = keyof typeof SPY_PALETTES;

export const ICON_PALETTE: Record<string, string> = {
  k: '#111111', w: '#f4f4f4', g: '#9a9a9a', y: '#e8c547', G: '#3fa34d',
  u: '#3a78d8', r: '#d23c3c', n: '#8b5a2b', c: '#6cc6e8', o: '#ff9a3c', m: '#d8c9a3',
};

export const ICONS = {
  klic: ['........', '.yyy....', 'y...y...', 'y...yyyy', 'y...y.y.', '.yyy..y.', '........', '........'],
  penize: ['........', 'GGGGGGGG', 'G..GG..G', 'G.GyyG.G', 'G.GyyG.G', 'G..GG..G', 'GGGGGGGG', '........'],
  pas: ['.rrrrrr.', '.rrrrrr.', '.rryyrr.', '.ryrryr.', '.rryyrr.', '.rrrrrr.', '.ryyyyr.', '.rrrrrr.'],
  plany: ['........', 'uuuuuuuu', 'uwwuwwwu', 'uwuuuuwu', 'uwwwuwwu', 'uuuuuuuu', '........', '........'],
  kufrik: ['........', '..nnnn..', '..n..n..', 'nnnnnnnn', 'nnnnnnnn', 'nnnyynnn', 'nnnnnnnn', 'nnnnnnnn'],
  // remedies, drawn to hang from a hand (spec §3): a bucket of water on its wire handle,
  // pliers held by the red handles (grey jaws down), a closed umbrella on its crook, scissors by the rings
  voda: ['...kk...', '..k..k..', '.k....k.', 'gccccccg', 'guuuuuug', '.gwgggg.', '.gwgggg.', '..gggg..'],
  kleste: ['.r....r.', '.rr..rr.', '..r..r..', '..rrrr..', '...kk...', '..gggg..', '..gggg..', '...gg...'],
  destnik: ['..nnn...', '..n.n...', '....n...', '...rrr..', '...rrr..', '...rrr..', '....r...', '....g...'],
  nuzky: ['rrr..rrr', 'r.r..r.r', 'rrr..rrr', '...rr...', '...ww...', '..g..g..', '.g....g.', 'g......g'],
  // the umbrella opened over the head, seen from the side (disarm animation, spec §3); 11×8
  destnik_open: [
    '...rrrrr...',
    '.rrrrrrrrr.',
    'rrwrrrrrrrr',
    'rrrrrrrrrrr',
    'r..r.n.r..r',
    '.....n.....',
    '...n.n.....',
    '....n......',
  ],
  bomba: ['......o.', '.....o..', '....k...', '..kkkk..', '.kkkkkk.', '.kwkkkk.', '.kkkkkk.', '..kkkk..'],
  pruzina: ['kkkkkkkk', '.gggggg.', 'g......g', '.gggggg.', 'g......g', '.gggggg.', 'kkkkkkkk', '........'],
  elektrina: ['...yyy..', '..yyy...', '...yy...', '...y....', 'gccccccg', 'guuuuuug', '.gggggg.', '..gggg..'],
  pistole: ['........', 'gkkkkkkk', 'kkkkkkkk', '.kk.n...', '.kk..n..', 'kkk...n.', 'kk.....n', '........'],
  casovana: ['......o.', '.....k..', '..kkkk..', '.kwwwwk.', 'kwwkwwwk', 'kwwkkwwk', '.kwwwwk.', '..kkkk..'],
  // a loose secret carried in hand (spec §6): cream leather bag, brown strap, brass clasp on the flap
  satchel: ['..nnnn..', '.n....n.', 'gwwwwwwg', 'gwwwwwwg', 'gmmyymmg', 'gwwyywwg', 'gwwwwwwg', '.gggggg.'],
  plane: ['...w....', '...ww...', 'wwwwwww.', '.wwwwwww', '...ww...', '...w....', '..www...', '........'],
} satisfies Record<string, readonly string[]>;

export type IconName = keyof typeof ICONS;
