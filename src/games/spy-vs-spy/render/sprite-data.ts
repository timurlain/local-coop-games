// Pixel-string sprites. '.' is transparent; other characters index a palette.

// Spy facing right, 21×24. o = outline, b = body, e = eye, c = club.
// Body centre line is column 10 in every frame; the nose and club reach right, a swung-back arm reaches left.

const HAT = [
  '.........ooo.........',
  '........obbbo........',
  '.......obbbbbo.......',
  '.......ooooooo.......',
  '....ooooooooooooo....',
];

const FACE = [
  '.......obbeeo........',
  '.......obbbbbooo.....',
  '.......obbbbbbbbooo..',
  '.......obbbbbbbbbbbo.',
  '.......obbbbooooooooo',
];

// Same face with the nose tipped 1 px up (walk bob).
const FACE_BOB = [
  '.......obbeeoooo.....',
  '.......obbbbbbbbooo..',
  '.......obbbbbbbbbbbo.',
  '.......obbbbooooooooo',
  '.......obbbbo........',
];

const COAT = {
  hang: [
    '........obbbo........',
    '......oobbbbboo......',
    '.....obbbbbbbbbo.....',
    '.....obbbbbbobbo.....',
    '.....obbbbbbobbo.....',
    '.....obbbbbbobbbo....',
    '.....obbbbbbbobbo....',
    '.....obbbbbbboobbo...',
    '.....oooooooooooo....',
  ],
  fwd: [
    '........obbbo........',
    '......oobbbbboo......',
    '.....obbbbbbbbboo....',
    '.....obbbbbbbobbbo...',
    '.....obbbbbbbboobbo..',
    '.....obbbbbbbbo.obbo.',
    '.....obbbbbbbbo..oo..',
    '.....obbbbbbbbbo.....',
    '.....ooooooooooo.....',
  ],
  back: [
    '........obbbo........',
    '......oobbbbboo......',
    '....oobbbbbbbbbo.....',
    '...obbobbbbbbbbo.....',
    '..obboobbbbbbbbo.....',
    '.obbo.obbbbbbbbo.....',
    '..oo..obbbbbbbbbo....',
    '......obbbbbbbbbo....',
    '......ooooooooooo....',
  ],
};

const LEGS = {
  stand: [
    '.......obo.obo.......',
    '.......obo.obo.......',
    '.......obo.obo.......',
    '.......obbo.obbo.....',
    '.......oooo.oooo.....',
  ],
  stride: [
    '......obo..obo.......',
    '.....obo....obo......',
    '....obo......obo.....',
    '...obbo......obbo....',
    '...ooo.......oooo....',
  ],
  pass: [
    '........obbbo........',
    '.......obbobo........',
    '.....oobo.obo........',
    '....obo...obbo.......',
    '....oo....oooo.......',
  ],
};

export const SPY_FRAMES = {
  stand: [...HAT, ...FACE, ...COAT.hang, ...LEGS.stand],
  walk1: [...HAT, ...FACE, ...COAT.fwd, ...LEGS.stride],
  walk2: [...HAT, ...FACE_BOB, ...COAT.hang, ...LEGS.pass],
  walk3: [...HAT, ...FACE, ...COAT.back, ...LEGS.stride],
  walk4: [...HAT, ...FACE_BOB, ...COAT.hang, ...LEGS.pass],
  // bent forward, nose poking down at the furniture, arms reaching in
  search: [
    '.....................',
    '.....................',
    '.....................',
    '..........ooo........',
    '.........obbbo.......',
    '........obbbbbo......',
    '........ooooooo......',
    '.....ooooooooooooo...',
    '........obbeeo.......',
    '........obbbbbooo....',
    '........obbbbbbbbooo.',
    '........obbbbbbbbbbbo',
    '.......obbbbboooooobo',
    '......obbbbbo......o.',
    '.....obbbbbbbooooo...',
    '.....obbbbbbbbbbbbo..',
    '.....obbbbbbboooooo..',
    '.....obbbbbbbo.......',
    '.....oooooooooo......',
    ...LEGS.stand,
  ],
  // club raised up behind the head
  swing1: [
    '.cc..................',
    '.cc......ooo.........',
    '..cc....obbbo........',
    '..cc...obbbbbo.......',
    '..cc...ooooooo.......',
    '..ccooooooooooooo....',
    '.obbo..obbeeo........',
    '.obbbo.obbbbbooo.....',
    '..obbbobbbbbbbbbooo..',
    '...obbbobbbbbbbbbbbo.',
    '....obbobbbbooooooooo',
    '.....obbobbbo........',
    '......obbbbbbboo.....',
    '.....obbbbbbbbbo.....',
    '.....obbbbbbbbbo.....',
    '.....obbbbbbbbbo.....',
    '.....obbbbbbbbbbo....',
    '.....obbbbbbbbbbo....',
    '.....oooooooooooo....',
    ...LEGS.stride,
  ],
  // club struck forward
  swing2: [
    '.....................',
    '.........ooo.........',
    '........obbbo........',
    '.......obbbbbo.......',
    '.......ooooooo.......',
    '....ooooooooooooo....',
    '.......obbeeo........',
    '.......obbbbbooo.....',
    '.......obbbbbbbbooo..',
    '.......obbbbbbbbbbbo.',
    '.......obbbbooooooooo',
    '........obbbo........',
    '......oobbbboooo...cc',
    '.....obbbbbbbbbbccccc',
    '.....obbbbbbboooo..cc',
    '.....obbbbbbbo.......',
    '.....obbbbbbbbo......',
    '.....obbbbbbbbo......',
    '.....oooooooooo......',
    ...LEGS.stride,
  ],
  // club held upright in front
  block: [
    ...HAT,
    ...FACE,
    '........obbbo....cc..',
    '......oobbbbboo..cc..',
    '.....obbbbbbbbboocc..',
    '.....obbbbbbbobbocco.',
    '.....obbbbbbbbooobbo.',
    '.....obbbbbbbbo..cc..',
    '.....obbbbbbbbo..cc..',
    '.....obbbbbbbbbo.....',
    '.....ooooooooooo.....',
    ...LEGS.stand,
  ],
  // head thrown back (hat tilted, nose up-forward), mouth open, kufrik arm held out in front
  laugh1: [
    '.....................',
    '.....oo..........o...',
    '...oobbo........oo...',
    '..obbbbbo......obo...',
    '..obbbbbbooo...obo...',
    '..obbbbooobbbbobbo...',
    '...oboooeebbbbbbbbo..',
    '.ooo.obbbbbbbbbbbbo..',
    '.....obbbbbbbbbbbo...',
    '.....obbbbbbboooo....',
    '.....obbbbbbo........',
    '.....obbbbbbbooo.....',
    '......obbbbboo.......',
    '.....oobbbbbbooooooo.',
    '....obbbbbbbbbbbbbbbo',
    '....obbbbbbbooooooooo',
    '....obbbbbbbbo.......',
    '....obbbbbbbbbo......',
    '....oooooooooooo.....',
    ...LEGS.stand,
  ],
  // shake: head and arm jerk 1 px up, jaw drops (mouth gap 2 px)
  laugh2: [
    '.....oo..........o...',
    '...oobbo........oo...',
    '..obbbbbo......obo...',
    '..obbbbbbooo...obo...',
    '..obbbbooobbbbobbo...',
    '...oboooeebbbbbbbbo..',
    '.ooo.obbbbbbbbbbbbo..',
    '.....obbbbbbbbbbbo...',
    '.....obbbbbbboooo....',
    '.....obbbbbbo........',
    '.....obbbbbbo........',
    '......obbbbboo.......',
    '.....oobbbbbbooooooo.',
    '....obbbbbbbbbbbbbbbo',
    '....obbbbbbbooooooooo',
    '....obbbbbbbbo.......',
    '....obbbbbbbbbo......',
    '....obbbbbbbbbo......',
    '....oooooooooooo.....',
    ...LEGS.stand,
  ],
} satisfies Record<string, readonly string[]>;

export type SpyFrame = keyof typeof SPY_FRAMES;

/**
 * Image pixel (x, y) of the hand that carries the kufrik in each frame: the front hand, except in the
 * combat frames (swing/block) where the club is in front and the kufrik hangs from the back hand at the hip;
 * for the laugh frames it is the raised hand.
 */
export const SPY_HANDS: Record<SpyFrame, readonly [number, number]> = {
  stand: [15, 17],
  walk1: [17, 15],
  walk2: [15, 17],
  walk3: [2, 15],
  walk4: [15, 17],
  search: [17, 15],
  swing1: [6, 16],
  swing2: [6, 16],
  block: [6, 16],
  laugh1: [19, 14],
  laugh2: [19, 13],
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
  voda: ['........', 'g......g', '.gccccg.', '.gccccg.', '.gggggg.', '.gggggg.', '..gggg..', '........'],
  kleste: ['r.....r.', '.r...r..', '..r.r...', '...g....', '..g.g...', '.g...g..', 'g.....g.', '........'],
  destnik: ['..rrrr..', '.rrrrrr.', 'rrrrrrrr', '...k....', '...k....', '...k....', '.k.k....', '..k.....'],
  nuzky: ['g.....g.', '.g...g..', '..g.g...', '...g....', '..r.r...', '.r...r..', 'r.r.r.r.', '.r...r..'],
  bomba: ['......o.', '.....k..', '..kkkk..', '.kkkkkk.', '.kwkkkk.', '.kkkkkk.', '..kkkk..', '........'],
  pruzina: ['gggggggg', '.g....g.', '..g..g..', '.g....g.', '..g..g..', '.g....g.', 'gggggggg', '........'],
  elektrina: ['....y...', '...y....', '..yyy...', 'g..y...g', '.gccccg.', '.gccccg.', '.gggggg.', '..gggg..'],
  pistole: ['........', '.kkkkkkk', '.kkkkkkk', '.kk.g...', '.kk.....', '.kk.....', '........', '........'],
  casovana: ['......o.', '.....k..', '..kkkk..', '.kwwwwk.', '.kwkwwk.', '.kwwkwk.', '..kkkk..', '........'],
  plane: ['...w....', '...ww...', 'wwwwwww.', '.wwwwwww', '...ww...', '...w....', '..www...', '........'],
} satisfies Record<string, readonly string[]>;

export type IconName = keyof typeof ICONS;
