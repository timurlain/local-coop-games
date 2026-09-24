// Pixel-string sprites. '.' is transparent; other characters index a palette.

// Spy facing right, drawn after the 1984 C64 originals: a huge hat and head (hat + head ≈ 45 % of the
// figure), a long pointed nose, a small coat and thin legs on tiptoe.
// o = outline, b = body, e = eye, c = club. The body centre is column SPY_CENTER_X in every frame;
// the nose, club and reaching hands go right, a swung-back arm goes left.

export const SPY_W = 29;
export const SPY_H = 36;
export const SPY_CENTER_X = 14;

type Layer = readonly [x: number, y: number, rows: readonly string[]];

/** Pads rows to the frame width; rows are written left-aligned and never longer than SPY_W. */
function part(rows: readonly string[]): string[] {
  return rows.map((r) => r.padEnd(SPY_W, '.'));
}

/** Frame from stacked parts, then layers painted on top ('.' in a layer is transparent). */
function frame(parts: readonly string[], ...layers: Layer[]): string[] {
  const out = part(parts).map((r) => [...r]);
  for (const [x, y, rows] of layers) {
    rows.forEach((row, dy) => {
      [...row].forEach((ch, dx) => {
        if (ch !== '.' && out[y + dy] && x + dx >= 0 && x + dx < SPY_W) out[y + dy][x + dx] = ch;
      });
    });
  }
  return out.map((r) => r.join(''));
}

function blank(n: number): string[] {
  return Array.from({ length: n }, () => '');
}

// Fedora: pinched crown with a centre crease, hat band, brim curled up at the back and turned down at the front.
const HAT = [
  '...........ooo.ooo',
  '..........obbbobbbo',
  '..........obbbbbbbo',
  '..........obbbbbbbo',
  '....oo....ooooooooo',
  '....obooooooooooooooo',
  '.....obbbbbbbbbbbbbbbooo',
  '......ooooooooooooooooooo',
];

const FACE = [
  '.........obbbbbbeeoo',
  '.........obbbbbbbbbbooo',
  '.........obbbbbbbbbbbbbooo',
  '.........obbbbbbbbbbbbbbbbbo',
  '.........obbbbbbbooooooooooo',
  '.........obbbbbbbo',
  '..........obbbbbo',
  '...........obbbo',
];

// Same face with the nose tipped 1 px up (walk bob).
const FACE_BOB = [
  '.........obbbbbbeeooo',
  '.........obbbbbbbbbbbbooo',
  '.........obbbbbbbbbbbbbbbbbo',
  '.........obbbbbbbooooooooooo',
  '.........obbbbbbbo',
  '.........obbbbbbbo',
  '..........obbbbbo',
  '...........obbbo',
];

// Peering down: the nose droops towards the furniture.
const FACE_DOWN = [
  '.........obbbbbbeeo',
  '.........obbbbbbbbboo',
  '.........obbbbbbbbbbboo',
  '.........obbbbbbbbbbbbboo',
  '.........obbbbbbbooobbbbbo',
  '.........obbbbbbbo...obbbbo',
  '..........obbbbbo.....obbo',
  '...........obbbo.......oo',
];

const COAT = {
  // arms hanging, front hand at the hem
  hang: [
    '..........oobbbbboo',
    '.........obbbbbbbbbo',
    '.........obbbbbbbbbo',
    '.........obbbbbbobbo',
    '.........obbbbbbobbo',
    '.........obbbbbbobbo',
    '.........obbbbbbbobbo',
    '.........obbbbbbbobbo',
    '.........obbbbbbbboo',
    '.........ooooooooooo',
  ],
  // front arm swung forward
  fwd: [
    '..........oobbbbboo',
    '.........obbbbbbbbboo',
    '.........obbbbbbbbbbbo',
    '.........obbbbbbbboobbo',
    '.........obbbbbbbbo.obbo',
    '.........obbbbbbbbo..obbo',
    '.........obbbbbbbbo...oo',
    '.........obbbbbbbbo',
    '.........obbbbbbbbbo',
    '.........ooooooooooo',
  ],
  // front arm swung back
  back: [
    '..........oobbbbboo',
    '........oobbbbbbbbbo',
    '.......obbbbbbbbbbbo',
    '......obboobbbbbbbbo',
    '.....obbo.obbbbbbbbo',
    '....obbo..obbbbbbbbo',
    '.....oo...obbbbbbbbo',
    '..........obbbbbbbbo',
    '.........obbbbbbbbbo',
    '.........ooooooooooo',
  ],
  // both forearms out, palms up
  shrug: [
    '..........oobbbbboo',
    '.........obbbbbbbbbo',
    '....oo...obbbbbbbbbo...oo',
    '....obo..obbbbbbbbbo..obo',
    '.....obo.obbbbbbbbbo.obo',
    '......oboobbbbbbbbboobo',
    '.......obbbbbbbbbbbbbo',
    '.........obbbbbbbbbo',
    '.........obbbbbbbbbo',
    '.........ooooooooooo',
  ],
};

const LEGS = {
  stand: [
    '...........obo.obo',
    '...........obo.obo',
    '...........obo.obo',
    '...........obo.obo',
    '...........obo.obo',
    '...........obo.obo',
    '...........obo.obo',
    '...........obbo.obbo',
    '............obo..obo',
    '............oo...oo',
  ],
  stride: [
    '..........obo..obo',
    '..........obo...obo',
    '.........obo....obo',
    '.........obo.....obo',
    '........obo......obo',
    '........obo.......obo',
    '.......obo........obo',
    '.......obo.........obo',
    '.......obo.........obbo',
    '.......oo...........oooo',
  ],
  // front knee lifted high, toe pointing down (sneaking)
  passFront: [
    '...........obo.obo',
    '...........obo.obbo',
    '...........obo..obbo',
    '...........obo...obbo',
    '...........obo...obo',
    '...........obo..obo',
    '...........obo..oo',
    '...........obbo',
    '............obo',
    '............oo',
  ],
  // back heel kicked up behind
  passBack: [
    '...........obo.obo',
    '..........obbo.obo',
    '.........obbo..obo',
    '........obbo...obo',
    '........obo....obo',
    '.........obo...obo',
    '..........oo...obo',
    '...............obbo',
    '................obo',
    '................oo',
  ],
  // knees bent, wide stance (8 rows)
  crouch: [
    '..........obo..obo',
    '.........obo....obo',
    '........obo......obo',
    '.......obo.......obo',
    '.......obo.......obo',
    '........obo......obo',
    '........obbo.....obbo',
    '.........ooo.....oooo',
  ],
  // lunging: back leg stretched out behind (8 rows)
  lunge: [
    '..........obo..obo',
    '.........obo....obo',
    '........obo......obo',
    '.......obo.......obo',
    '......obo.........obo',
    '.....obo..........obo',
    '....obo...........obbo',
    '...ooo............oooo',
  ],
};

// Crouched fight body (9 rows) under a head lowered by 3 px.
const FIGHT_COAT = [
  '..........oobbbbboo',
  '.........obbbbbbbbbo',
  '.........obbbbbbbbbo',
  '.........obbbbbbbbbo',
  '.........obbbbbbbbbo',
  '.........obbbbbbbbbo',
  '........oobbbbbbbbbo',
  '.......obobbbbbbbbbo',
  '........ooooooooooo',
];

// Bent-over search body (rows 21..25) under a head lowered by 5 px.
const DIG_COAT = [
  '.........oobbbbbbbo',
  '........obbbbbbbbbbo',
  '........obbbbbbbbbbo',
  '........obbbbbbbbbbo',
  '........oooooooooooo',
];

const DIG_LEGS = [
  '..........obo..obo',
  '..........obo..obo',
  '..........obo...obo',
  '..........obo...obo',
  '..........obo...obo',
  '..........obo...obo',
  '..........obbo..obbo',
  '...........obo...obo',
  '...........oo....oo',
  '...........oo....oo',
];

// Arms reaching into the furniture: one low, one high (swapped for the second dig frame).
const ARM_LOW: Layer = [16, 21, ['oooo', 'obbbooo', '.oobbbbo', '....oobbo', '......obbo', '.......oo']];
const ARM_HIGH: Layer = [16, 20, ['.ooooo', 'obbbbbooo', '.oooobbbbo', '.....oobbo', '.......oo']];

// Club layers.
const ARM_READY: Layer = [17, 20, ['oooooo', 'obbbbbo', 'oooooo']];
// The club is a bludgeon: thin handle in the fist, fat end.
const CLUB_READY: Layer = [21, 16, ['....ccc', '...cccc', '..ccc..', '.cc....', 'cc.....']];

// Laughing arm held straight out in front, square to the up-pointing nose (never parallel to it).
const LAUGH_ARM: Layer = [17, 15, ['ooooooooooo', 'obbbbbbbbbbo', 'ooooooooooo']];

export const SPY_FRAMES = {
  stand: frame([...HAT, ...FACE, ...COAT.hang, ...LEGS.stand]),
  walk1: frame([...HAT, ...FACE, ...COAT.fwd, ...LEGS.stride]),
  walk2: frame([...HAT, ...FACE_BOB, ...COAT.hang, ...LEGS.passFront]),
  walk3: frame([...HAT, ...FACE, ...COAT.back, ...LEGS.stride]),
  walk4: frame([...HAT, ...FACE_BOB, ...COAT.hang, ...LEGS.passBack]),

  // crouched, club drawn and held ready in front; kufrik hand at the back hip
  fightStand: frame([...blank(3), ...HAT, ...FACE, ...FIGHT_COAT, ...LEGS.crouch], ARM_READY, CLUB_READY),
  // club raised back over the shoulder
  swingWind: frame(
    [...blank(3), ...HAT, ...FACE, ...FIGHT_COAT, ...LEGS.crouch],
    [0, 1, ['ccc', 'cccc', '.ccc', '..cc', '..cc', '...cc', '...cc', '....cc', '....cc', '.....c', '.....c']],
    [4, 12, ['oo', 'obo', 'obbo', '.obbo', '..obbo', '...obbo', '....obbo', '.....oo']],
  ),
  // club struck forward, lunging
  swingStrike: frame(
    [...blank(3), ...HAT, ...FACE, ...FIGHT_COAT, ...LEGS.lunge],
    [16, 20, ['ooooooo', 'obbbbbbo', 'ooooooo']],
    [22, 17, ['....ccc', '..ccccc', 'ccccc..', 'cc.....']],
  ),
  // club held upright in front of the face
  block: frame(
    [...blank(3), ...HAT, ...FACE, ...FIGHT_COAT, ...LEGS.crouch],
    [16, 21, ['oooooo', 'obbbbbo', '.oooooo']],
    [21, 8, ['ccc', 'ccc', 'ccc', '.cc', '.cc', '.cc', '.cc', '.cc', '.cc', '.cc', '.cc', '.cc', '.cc', '.cc', '.cc', '.cc']],
  ),

  // bent over, rummaging forward with alternating arms
  searchDig1: frame([...blank(5), ...shift(HAT, 2), ...shift(FACE_DOWN, 2), ...shift(DIG_COAT, 1), ...DIG_LEGS], ARM_LOW),
  searchDig2: frame([...blank(5), ...shift(HAT, 2), ...shift(FACE_DOWN, 2), ...shift(DIG_COAT, 1), ...DIG_LEGS], ARM_HIGH),
  // placing an item forward and down
  hidePut: frame(
    [...blank(5), ...shift(HAT, 2), ...shift(FACE_DOWN, 2), ...shift(DIG_COAT, 1), ...DIG_LEGS],
    [16, 21, ['oooo', 'obbbooo', '.oobbbbo', '....oobbo', '......obo', '......obbo', '.......oo']],
  ),
  // both hands up, nothing found
  shrug: frame([...HAT, ...FACE, ...COAT.shrug, ...LEGS.stand]),
  // the find held up high in the back hand
  liftFind: frame(
    [...HAT, ...FACE, ...COAT.hang, ...LEGS.stand],
    [1, 0, ['.oo', 'obbo', 'obbo', '.obo', '.obo', '.obo', '.obo', '.obo', '.obo', '.obo', '.obo', '.obo', '.obbo', '..obbo', '...obbo', '....obbo', '.....obbo', '......ooo']],
  ),

  // head thrown back (fedora tipped back, nose up), mouth open, kufrik arm held out in front
  laugh1: frame([
    '',
    '...oo.oo...............o',
    '..obbobbo.............obo',
    '..obbbbbbo...........obbo',
    '...obbbbbbo.........obbbo',
    '....obbbbbbo.......obbbo',
    '.....ooooooo.....oobbbo',
    '...oobbbbbbbooooobbbbbo',
    '.obbooooooooeebbbbbbbo',
    '.oo.......obbbbbbbbbo',
    '.........obbbbbbbbbo',
    '.........obbbbbbbooo',
    '.........obbbbbbo',
    '.........obbbbbbboooo',
    '..........obbbbbbbbo',
    '...........obbbbboo',
    '..........oobbbbboo',
    '.........obbbbbbbbbo',
    '.........obbbbbbbbbo',
    '.........obbbbbbbbbo',
    '.........obbbbbbbbbo',
    '.........obbbbbbbbbo',
    '.........obbbbbbbbbo',
    '.........obbbbbbbbbo',
    '.........obbbbbbbbbo',
    '.........ooooooooooo',
    ...LEGS.stand,
  ], LAUGH_ARM),
  // shake: head and arm jerk 1 px up, jaw drops
  laugh2: frame([
    '...oo.oo...............o',
    '..obbobbo.............obo',
    '..obbbbbbo...........obbo',
    '...obbbbbbo.........obbbo',
    '....obbbbbbo.......obbbo',
    '.....ooooooo.....oobbbo',
    '...oobbbbbbbooooobbbbbo',
    '.obbooooooooeebbbbbbbo',
    '.oo.......obbbbbbbbbo',
    '.........obbbbbbbbbo',
    '.........obbbbbbbooo',
    '.........obbbbbbo',
    '.........obbbbbbo',
    '.........obbbbbbboooo',
    '..........obbbbbbbbo',
    '..........oobbbbbbo',
    '..........oobbbbboo',
    '.........obbbbbbbbbo',
    '.........obbbbbbbbbo',
    '.........obbbbbbbbbo',
    '.........obbbbbbbbbo',
    '.........obbbbbbbbbo',
    '.........obbbbbbbbbo',
    '.........obbbbbbbbbo',
    '.........obbbbbbbbbo',
    '.........ooooooooooo',
    ...LEGS.stand,
  ], [LAUGH_ARM[0], LAUGH_ARM[1] - 1, LAUGH_ARM[2]]),
} satisfies Record<string, readonly string[]>;

function shift(rows: readonly string[], dx: number): string[] {
  return rows.map((r) => '.'.repeat(dx) + r);
}

export type SpyFrame = keyof typeof SPY_FRAMES;

/**
 * Image pixel (x, y) of the hand that carries the kufrik in each frame: the front hand, except in the
 * fight frames where the club is in front and the kufrik hangs from the back hand at the hip;
 * for liftFind and the laugh frames it is the raised hand.
 */
export const SPY_HANDS: Record<SpyFrame, readonly [number, number]> = {
  stand: [19, 23],
  walk1: [22, 22],
  walk2: [19, 23],
  walk3: [5, 21],
  walk4: [19, 23],
  fightStand: [8, 26],
  swingWind: [8, 26],
  swingStrike: [8, 26],
  block: [8, 26],
  searchDig1: [23, 25],
  searchDig2: [23, 23],
  hidePut: [23, 26],
  shrug: [23, 19],
  liftFind: [2, 1],
  laugh1: [26, 16],
  laugh2: [26, 15],
};

export const SPY_PALETTES = {
  white: { o: '#1a1a1a', b: '#f2f2f2', e: '#1a1a1a', c: '#8b5a2b' },
  black: { o: '#9a9a9a', b: '#1e1e1e', e: '#f2f2f2', c: '#8b5a2b' },
  sooty: { o: '#000000', b: '#3a3a3a', e: '#ffffff', c: '#8b5a2b' },
  soaked: { o: '#1b3a6b', b: '#8cc4ff', e: '#1b3a6b', c: '#8b5a2b' },
  ghost: { o: '#dddddd', b: '#ffffff', e: '#999999', c: '#8b5a2b' },
} satisfies Record<string, Record<string, string>>;

export type SpyPalette = keyof typeof SPY_PALETTES;

export const ICON_PALETTE: Record<string, string> = {
  k: '#111111', w: '#f4f4f4', g: '#9a9a9a', y: '#e8c547', G: '#3fa34d',
  u: '#3a78d8', r: '#d23c3c', n: '#8b5a2b', c: '#6cc6e8', o: '#ff9a3c',
};

export const ICONS = {
  klic: ['........', '.yyy....', 'y...y...', 'y...yyyy', 'y...y.y.', '.yyy..y.', '........', '........'],
  penize: ['........', 'GGGGGGGG', 'G..GG..G', 'G.GyyG.G', 'G.GyyG.G', 'G..GG..G', 'GGGGGGGG', '........'],
  pas: ['.rrrrrr.', '.rrrrrr.', '.rryyrr.', '.ryrryr.', '.rryyrr.', '.rrrrrr.', '.ryyyyr.', '.rrrrrr.'],
  plany: ['........', 'uuuuuuuu', 'uwwuwwwu', 'uwuuuuwu', 'uwwwuwwu', 'uuuuuuuu', '........', '........'],
  kufrik: ['........', '..nnnn..', '..n..n..', 'nnnnnnnn', 'nnnnnnnn', 'nnnyynnn', 'nnnnnnnn', 'nnnnnnnn'],
  voda: ['..gggg..', '.g....g.', 'gccccccg', 'guuuuuug', '.gggggg.', '.gwgggg.', '..gggg..', '........'],
  kleste: ['...gg...', '...gg...', '..gggg..', '...ww...', '..r..r..', '.rr..rr.', '.r....r.', 'rr....rr'],
  destnik: ['....g...', '..rrrr..', '.rrrrrr.', 'rrrrrrrr', '....g...', '....g...', '..g.g...', '...g....'],
  nuzky: ['g......g', '.g....g.', '..g..g..', '...ww...', '..r..r..', 'rrr..rrr', 'r.r..r.r', 'rrr..rrr'],
  bomba: ['......o.', '.....o..', '....k...', '..kkkk..', '.kkkkkk.', '.kwkkkk.', '.kkkkkk.', '..kkkk..'],
  pruzina: ['kkkkkkkk', '.gggggg.', 'g......g', '.gggggg.', 'g......g', '.gggggg.', 'kkkkkkkk', '........'],
  elektrina: ['...yyy..', '..yyy...', '...yy...', '...y....', 'gccccccg', 'guuuuuug', '.gggggg.', '..gggg..'],
  pistole: ['........', 'gkkkkkkk', 'kkkkkkkk', '.kk.n...', '.kk..n..', 'kkk...n.', 'kk.....n', '........'],
  casovana: ['......o.', '.....k..', '..kkkk..', '.kwwwwk.', 'kwwkwwwk', 'kwwkkwwk', '.kwwwwk.', '..kkkk..'],
  plane: ['...w....', '...ww...', 'wwwwwww.', '.wwwwwww', '...ww...', '...w....', '..www...', '........'],
} satisfies Record<string, readonly string[]>;

export type IconName = keyof typeof ICONS;
