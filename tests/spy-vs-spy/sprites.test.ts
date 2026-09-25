import { describe, expect, it } from 'vitest';
import { handOutline, outlineRows } from '../../src/games/spy-vs-spy/render/sprites';

describe('outlineRows (round 4 §2): a 1px ring around the opaque pixels', () => {
  it('rings a single opaque pixel on its 4 orthogonal sides, padding the grid by 1', () => {
    expect(outlineRows(['x'])).toEqual(['.+.', '+x+', '.+.']);
  });

  it('does not mark diagonal neighbours, only the 4-directional ones', () => {
    expect(outlineRows(['x.', '.x'])).toEqual([
      '.+..',
      '+x+.',
      '.+x+',
      '..+.',
    ]);
  });

  it('leaves the opaque pixels themselves untouched and never overwrites them', () => {
    const rows = ['.y.', 'yyy', '.y.'];
    const out = outlineRows(rows);
    // every opaque pixel, shifted by the 1px pad, keeps its original character
    expect(out[2][1]).toBe('y');
    expect(out[2][2]).toBe('y');
    expect(out[2][3]).toBe('y');
    expect(out[1][2]).toBe('y');
    expect(out[3][2]).toBe('y');
  });

  it('rings a solid block only orthogonally, leaving the diagonal corners of the padding untouched', () => {
    const out = outlineRows(['xx', 'xx']);
    expect(out).toEqual([
      '.++.',
      '+xx+',
      '+xx+',
      '.++.',
    ]);
  });

  it('is pure: does not mutate its input', () => {
    const rows = ['x'];
    outlineRows(rows);
    expect(rows).toEqual(['x']);
  });

  it('accepts a custom mark character', () => {
    expect(outlineRows(['x'], '#')).toEqual(['.#.', '#x#', '.#.']);
  });
});

describe('handOutline: per-spy outline colour so the icon reads on that spy\'s own coat', () => {
  it('is light on the black spy and dark on the white spy', () => {
    expect(handOutline('black')).toBe('#d8d8d8');
    expect(handOutline('white')).toBe('#1a1a1a');
  });
});
