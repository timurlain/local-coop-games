import { describe, expect, it } from 'vitest';
import { HOSTS } from '../../src/games/spy-vs-spy/logic/state';
import { FLAGS, FLAG_COLORS as C } from '../../src/games/spy-vs-spy/render/flags';
import { PICTURES, PICTURE_H, PICTURE_PALETTE, PICTURE_W } from '../../src/games/spy-vs-spy/render/decor-data';
import { DECOR_KINDS } from '../../src/games/spy-vs-spy/logic/themes';

const rgb = (hex: string): [number, number, number] => {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const isWhite = (hex: string) => rgb(hex).every((v) => v > 220);
const isRed = (hex: string) => {
  const [r, g, b] = rgb(hex);
  return r > 180 && g < 60 && b < 80;
};

describe('period-correct flags', () => {
  it('has a flag for every host', () => {
    expect(Object.keys(FLAGS).sort()).toEqual([...HOSTS].sort());
  });

  it('Czechoslovakia: white over red with a blue triangle at the hoist', () => {
    expect(FLAGS.cs.bands).toEqual([C.white, C.csRed]);
    expect(FLAGS.cs.hoistTriangle).toBe(C.csBlue);
    const [r, g, b] = rgb(C.csBlue);
    expect(b).toBeGreaterThan(r + 60);
    expect(b).toBeGreaterThan(g);
  });

  it('Poland: white over red, no triangle', () => {
    expect(FLAGS.pl).toEqual({ bands: [C.white, C.plRed], hoistTriangle: null });
  });

  it('Germany: only the Weimar black-red-gold horizontal tricolour', () => {
    expect(FLAGS.de).toEqual({ bands: [C.black, C.deRed, C.gold], hoistTriangle: null });
    expect(rgb(C.black).every((v) => v < 40)).toBe(true);
    expect(isRed(C.deRed)).toBe(true);
    const [r, g, b] = rgb(C.gold);
    expect(r).toBeGreaterThan(220);
    expect(g).toBeGreaterThan(170);
    expect(b).toBeLessThan(60);
    // never the black-white-red of the Empire or any later flag
    expect(FLAGS.de.bands.some(isWhite)).toBe(false);
  });

  it('Hungary: red-white-green horizontal tricolour', () => {
    expect(FLAGS.hu).toEqual({ bands: [C.huRed, C.white, C.huGreen], hoistTriangle: null });
    const [r, g, b] = rgb(C.huGreen);
    expect(g).toBeGreaterThan(r);
    expect(g).toBeGreaterThan(b);
  });

  it('Austria: red-white-red horizontal', () => {
    expect(FLAGS.at).toEqual({ bands: [C.atRed, C.white, C.atRed], hoistTriangle: null });
  });

  it('uses true whites and reds', () => {
    expect(isWhite(C.white)).toBe(true);
    for (const red of [C.csRed, C.plRed, C.deRed, C.huRed, C.atRed]) expect(isRed(red)).toBe(true);
  });
});

describe('wall picture pixel art', () => {
  it('is exactly PICTURE_W x PICTURE_H and uses only palette colours', () => {
    for (const [kind, rows] of Object.entries(PICTURES)) {
      expect(rows.length, kind).toBe(PICTURE_H);
      for (const row of rows) {
        expect(row.length, `${kind}: ${row}`).toBe(PICTURE_W);
        for (const ch of row) if (ch !== '.') expect(PICTURE_PALETTE[ch], `${kind} '${ch}'`).toBeDefined();
      }
    }
  });

  it('covers every non-flag decoration', () => {
    const pictures = DECOR_KINDS.filter((k) => !k.startsWith('vlajka_'));
    expect(Object.keys(PICTURES).sort()).toEqual([...pictures].sort());
  });
});
