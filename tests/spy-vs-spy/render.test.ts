import { describe, expect, it } from 'vitest';
import { shade } from '../../src/games/spy-vs-spy/render/draw';
import { project } from '../../src/games/spy-vs-spy/render/geometry';
import { ICONS, ICON_PALETTE, SPY_FRAMES, SPY_PALETTES } from '../../src/games/spy-vs-spy/render/sprite-data';

describe('project', () => {
  it('maps the floor corners onto the trapezoid', () => {
    expect(project(0, 0)).toEqual({ sx: 60, sy: 46 });
    expect(project(200, 0)).toEqual({ sx: 260, sy: 46 });
    expect(project(0, 40)).toEqual({ sx: 20, sy: 78 });
    expect(project(200, 40)).toEqual({ sx: 300, sy: 78 });
    expect(project(100, 20)).toEqual({ sx: 160, sy: 62 });
  });
});

describe('shade', () => {
  it('scales a hex colour', () => {
    expect(shade('#808080', 0.5)).toBe('rgb(64,64,64)');
  });
});

function checkSprite(name: string, rows: readonly string[], palette: Record<string, string>) {
  const w = rows[0].length;
  for (const row of rows) {
    expect(row.length, `${name} row width`).toBe(w);
    for (const ch of row) if (ch !== '.') expect(palette[ch], `${name} char ${ch}`).toBeDefined();
  }
}

describe('sprite data', () => {
  it('spy frames are rectangular and use only palette characters', () => {
    for (const [frame, rows] of Object.entries(SPY_FRAMES)) {
      for (const [pal, colours] of Object.entries(SPY_PALETTES)) checkSprite(`${frame}/${pal}`, rows, colours);
      expect(rows[0].length).toBe(14);
      expect(rows).toHaveLength(21);
    }
  });

  it('icons are 8×8 and use only palette characters', () => {
    for (const [name, rows] of Object.entries(ICONS)) {
      checkSprite(name, rows, ICON_PALETTE);
      expect(rows).toHaveLength(8);
      expect(rows[0].length).toBe(8);
    }
  });
});
