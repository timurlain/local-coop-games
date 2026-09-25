import type { DecorKind, FlagKind } from '../logic/state';

/** Wall pictures are authored as native pixel art: this many px wide (= DECOR_W on the 0.75 wall) and tall. */
export const PICTURE_W = 15;
export const PICTURE_H = 8;

export type PictureKind = Exclude<DecorKind, FlagKind>;

/** One character per pixel; '.' is transparent. */
export const PICTURE_PALETTE: Readonly<Record<string, string>> = {
  k: '#161616', // ink
  c: '#efe4c4', // cream
  r: '#b8281e', // deco red
  g: '#c9a040', // gilt
  G: '#f0d078', // gilt highlight
  d: '#8a6a24', // dark gilt / frame
  o: '#d8a040', // ochre
  y: '#f0c860', // sun ray / lit window
  b: '#dff0f8', // lens glass
  // map
  a: '#7a98a8', // sea
  D: '#a89878', // Germany
  P: '#c89088', // Poland
  C: '#8aac6a', // Czechoslovakia
  A: '#d8bc6a', // Austria
  H: '#c8905a', // Hungary
  E: '#bcb098', // further east
  // portrait
  e: '#2e3a2a', // dark background
  h: '#2a1c12', // hair
  s: '#dcae8a', // skin
  m: '#4a2e1a', // moustache
  n: '#1c1c24', // dark suit
  w: '#f4f0e4', // wing collar
  t: '#7a1a1a', // bow tie
  // clock
  W: '#4a2c18', // walnut
  // window
  f: '#e0d8c4', // window frame
  N: '#4a5a8e', // evening sky
  V: '#8a78a8', // dusk violet
  O: '#e8a070', // dusk glow
  S: '#1e1a24', // spires and roofs in shadow
  R: '#8a3226', // tiled roofs
  T: '#5aa08a', // copper dome
  // telegram
  K: '#b0844e', // cork
  j: '#8a6436', // cork grain
  p: '#f2ead0', // telegram form
  u: '#3a5a8a', // form header
  l: '#7a7a7a', // typed strips
};

/** Pixel art for every picture (flags are drawn from `FLAGS`). */
export const PICTURES: Readonly<Record<PictureKind, readonly string[]>> = {
  // art-deco poster: sun rays over cream, a red wedge; "PSST!" is lettered on top
  plakat_psst: [
    'kkkkkkkkkkkkkkk',
    'kycccycccyccyck',
    'kcyccyccyccycck',
    'kccyccycyccccck',
    'k' + 'c'.repeat(13) + 'k',
    'kr' + 'c'.repeat(12) + 'k',
    'krrccccccccccgk',
    'kkkkkkkkkkkkkkk',
  ],
  // "top secret" notice: red frame with gilt corners; lettered on top
  plakat_tajne: [
    'rrrrrrrrrrrrrrr',
    'rgcccccccccccgr',
    'rcccccccccccccr',
    'rcccccccccccccr',
    'rcccccccccccccr',
    'rcccccccccccccr',
    'rgcccccccccccgr',
    'rrrrrrrrrrrrrrr',
  ],
  // ochre sunburst: spy in hat and coat with a magnifying glass
  plakat_spion: [
    'kkkkkkkkkkkkkkk',
    'koykkkooyoooyok',
    'kokkkkkooykkkok',
    'kookkkoyokbbbkk',
    'kokkkkkkkkbbbkk',
    'kokkkkkoookkkok',
    'kokkkkkoyooyook',
    'kkkkkkkkkkkkkkk',
  ],
  // interwar Central Europe, no text: Germany, Poland, Czechoslovakia (Prague in red), Austria, Hungary
  plakat_mapa: [
    'ddddddddddddddd',
    'daaaaaPPPPPEEEd',
    'daDDDPPPPPPPEEd',
    'dDDDCrCCCPPPEEd',
    'dDDDDCCCCCCCEEd',
    'dDDAAAAHHHHHEEd',
    'daaAAAHHHHHEEEd',
    'ddddddddddddddd',
  ],
  // a generic gentleman of the 1930s: slicked hair, broad moustache, wing collar and bow tie
  portret: [
    '...GgggggggG...',
    '...geehhheeg...',
    '...geekskeeg...',
    '...gemmmmmeg...',
    '...geessseeg...',
    '...gnnwtwnng...',
    '...gnnnwnnng...',
    '...dgggggggd...',
  ],
  // round wall clock, walnut rim, gilt bezel; XII / III / VI / IX marks (hands drawn live)
  hodiny: [
    '.....WWWWW.....',
    '...WWgcccgWW...',
    '...WgcckccgW...',
    '..WgcccccccgW..',
    '..WgkccccckgW..',
    '..WgcccccccgW..',
    '...WgcckccgW...',
    '....WWgggWW....',
  ],
  // window onto Prague at dusk: Gothic twin spires, a copper dome, tiled roofs, lit windows
  okno: [
    'fffffffffffffff',
    'fNSNNSNfNNNNNNf',
    'fVSVVSVfVVTVVVf',
    'fVSSSSVfVTTTVVf',
    'fOSSSSOfTTTTTOf',
    'fRRSSRRfSSSSSRf',
    'fSySSySfSySRRRf',
    'fffffffffffffff',
  ],
  // telegram form pinned to a cork board
  telegram: [
    'WWWWWWWWWWWWWWW',
    'WKjKuuuruuuKKKW',
    'WKKKpppppppKjKW',
    'WKKKplllplpKKKW',
    'WjKKpppppppKKKW',
    'WKKKplllpppKKjW',
    'WKKjpppppppKKKW',
    'WWWWWWWWWWWWWWW',
  ],
};
