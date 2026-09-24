// Pixel-string sprites. '.' is transparent; other characters index a palette.

// Spy facing right, 14×21. o = outline, b = body, e = eye.
const SPY_TOP = [
  '....oooooo....',
  '....obbbbo....',
  '..oooooooooo..',
  '....obbbbo....',
  '....obebbooooo',
  '....obbbbbbbbo',
  '....obbboooooo',
  '.....obbo.....',
  '....obbbbo....',
  '...obbbbbbo...',
  '..obbbbbbbbo..',
  '..obobbbbobo..',
  '..obobbbbobo..',
  '..ooobbbbooo..',
  '....obbbbo....',
  '....obbbbo....',
];

const LEGS = {
  stand: [
    '....obo.obo...',
    '....obo.obo...',
    '....obo.obo...',
    '...oobo.oboo..',
    '...ooo...ooo..',
  ],
  walkA: [
    '....obo.obo...',
    '...obo...obo..',
    '..obo.....obo.',
    '.oobo.....oboo',
    '.ooo.......ooo',
  ],
  walkB: [
    '....obbbo.....',
    '.....obo......',
    '.....obo......',
    '....oobo......',
    '....ooo.......',
  ],
};

export const SPY_FRAMES = {
  stand: [...SPY_TOP, ...LEGS.stand],
  walkA: [...SPY_TOP, ...LEGS.walkA],
  walkB: [...SPY_TOP, ...LEGS.walkB],
} satisfies Record<string, readonly string[]>;

export type SpyFrame = keyof typeof SPY_FRAMES;

export const SPY_PALETTES = {
  white: { o: '#1a1a1a', b: '#f2f2f2', e: '#1a1a1a' },
  black: { o: '#9a9a9a', b: '#1e1e1e', e: '#f2f2f2' },
  sooty: { o: '#000000', b: '#3a3a3a', e: '#ffffff' },
  soaked: { o: '#1b3a6b', b: '#8cc4ff', e: '#1b3a6b' },
  ghost: { o: '#dddddd', b: '#ffffff', e: '#999999' },
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
