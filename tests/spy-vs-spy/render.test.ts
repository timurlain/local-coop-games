import { describe, expect, it } from 'vitest';
import { shade } from '../../src/games/spy-vs-spy/render/draw';
import { project } from '../../src/games/spy-vs-spy/render/geometry';
import { formatClock } from '../../src/games/spy-vs-spy/render/hud';
import { createSpy } from '../../src/games/spy-vs-spy/logic/generator';
import { RULES } from '../../src/games/spy-vs-spy/logic/rules';
import type { Spy } from '../../src/games/spy-vs-spy/logic/state';
import {
  ICONS, ICON_PALETTE, SPY_CENTER_X, SPY_FRAMES, SPY_H, SPY_HANDS, SPY_PALETTES, SPY_W, type SpyFrame,
} from '../../src/games/spy-vs-spy/render/sprite-data';
import { handPoint } from '../../src/games/spy-vs-spy/render/sprites';
import { WALK_CYCLE, pickFrame, walkFrame } from '../../src/games/spy-vs-spy/render/spy';

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

const FRAMES = [
  'stand', 'walk1', 'walk2', 'walk3', 'walk4',
  'fightStand', 'swingWind', 'swingStrike', 'block',
  'searchDig1', 'searchDig2', 'hidePut', 'shrug', 'liftFind',
  'laugh1', 'laugh2',
];

function drawn(frame: SpyFrame, x: number, y: number): boolean {
  const ch = SPY_FRAMES[frame][y]?.[x];
  return ch !== undefined && ch !== '.';
}

describe('sprite data', () => {
  it('has exactly the planned spy frames', () => {
    expect(Object.keys(SPY_FRAMES).sort()).toEqual([...FRAMES].sort());
  });

  it('spy frames share one size of about 28x36 and use only palette characters', () => {
    expect(SPY_W).toBeGreaterThanOrEqual(28);
    expect(SPY_W).toBeLessThanOrEqual(30);
    expect(SPY_H).toBeGreaterThanOrEqual(36);
    expect(SPY_H).toBeLessThanOrEqual(38);
    for (const [frame, rows] of Object.entries(SPY_FRAMES)) {
      for (const [pal, colours] of Object.entries(SPY_PALETTES)) checkSprite(`${frame}/${pal}`, rows, colours);
      expect(rows[0].length, `${frame} width`).toBe(SPY_W);
      expect(rows, `${frame} height`).toHaveLength(SPY_H);
    }
  });

  it('every palette has the same characters and the same brown club', () => {
    for (const [pal, colours] of Object.entries(SPY_PALETTES)) {
      expect(Object.keys(colours).sort(), pal).toEqual(['b', 'c', 'e', 'o']);
      expect(colours.c, pal).toBe(SPY_PALETTES.white.c);
    }
  });

  it('the body sits on the image centre column', () => {
    expect(SPY_CENTER_X).toBe(Math.floor(SPY_W / 2));
    for (const frame of FRAMES as SpyFrame[]) {
      // the torso crosses the centre column in a long vertical run
      let run = 0;
      let best = 0;
      for (let y = 0; y < SPY_H; y++) {
        run = drawn(frame, SPY_CENTER_X, y) ? run + 1 : 0;
        best = Math.max(best, run);
      }
      expect(best, `${frame} centre run`).toBeGreaterThanOrEqual(8);
      // and the feet stand around it
      const feet = [...SPY_FRAMES[frame][SPY_H - 1]].flatMap((ch, x) => (ch === '.' ? [] : [x]));
      expect(feet.length, `${frame} touches the floor`).toBeGreaterThan(0);
      expect(Math.min(...feet), `${frame} feet left`).toBeLessThanOrEqual(SPY_CENTER_X + 2);
      expect(Math.max(...feet), `${frame} feet right`).toBeGreaterThanOrEqual(SPY_CENTER_X - 2);
    }
    // standing legs mirror each other around the centre
    const legs = SPY_FRAMES.stand[SPY_H - 6];
    for (let d = 1; d <= SPY_CENTER_X; d++) {
      expect(legs[SPY_CENTER_X - d] === '.', `stand legs symmetric at ${d}`).toBe(legs[SPY_CENTER_X + d] === '.');
    }
  });

  it('only the fight frames draw the club', () => {
    const club = new Set(['fightStand', 'swingWind', 'swingStrike', 'block']);
    for (const frame of FRAMES) {
      const has = SPY_FRAMES[frame as SpyFrame].some((row) => row.includes('c'));
      expect(has, `${frame} club`).toBe(club.has(frame));
    }
  });

  it('every spy frame has a hand point on a drawn pixel', () => {
    expect(Object.keys(SPY_HANDS).sort()).toEqual([...FRAMES].sort());
    for (const [frame, [x, y]] of Object.entries(SPY_HANDS)) {
      expect(Number.isInteger(x) && x >= 0 && x < SPY_W, `${frame} hand x`).toBe(true);
      expect(Number.isInteger(y) && y >= 0 && y < SPY_H, `${frame} hand y`).toBe(true);
      expect(SPY_FRAMES[frame as SpyFrame][y][x], `${frame} hand pixel is drawn`).not.toBe('.');
    }
  });

  it('carries the kufrik in the front hand, at the back hip in a fight, and raised when lifting or laughing', () => {
    for (const f of ['fightStand', 'swingWind', 'swingStrike', 'block'] as SpyFrame[]) {
      expect(SPY_HANDS[f][0], `${f} back hand`).toBeLessThan(SPY_CENTER_X);
    }
    for (const f of ['stand', 'walk1', 'walk2', 'walk4', 'searchDig1', 'searchDig2', 'hidePut'] as SpyFrame[]) {
      expect(SPY_HANDS[f][0], `${f} front hand`).toBeGreaterThan(SPY_CENTER_X);
    }
    for (const f of ['liftFind', 'laugh1', 'laugh2'] as SpyFrame[]) {
      expect(SPY_HANDS[f][1], `${f} raised hand`).toBeLessThan(SPY_HANDS.stand[1] - 6);
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

describe('handPoint', () => {
  it('maps the stand hand to screen pixels, mirroring x when flipped', () => {
    const [px, py] = SPY_HANDS.stand;
    const x = 123.4;
    const y = 70.6;
    const left = Math.round(x - SPY_W / 2);
    const top = Math.round(y - SPY_H);
    const plain = handPoint('stand', x, y);
    const flipped = handPoint('stand', x, y, true);
    expect(plain.hx).toBe(left + px);
    expect(flipped.hx).toBe(left + (SPY_W - 1 - px));
    expect(plain.hy).toBe(top + py);
    expect(flipped.hy).toBe(plain.hy);
  });

  it('keeps the flipped hand as far from the body centre as the plain one', () => {
    const plain = handPoint('stand', 100, 70);
    const flipped = handPoint('stand', 100, 70, true);
    const centre = Math.round(100 - SPY_W / 2) + SPY_CENTER_X;
    expect(plain.hx - centre).toBe(centre - flipped.hx);
  });
});

describe('pickFrame', () => {
  const spy = (over: Partial<Spy> = {}): Spy => ({ ...createSpy(0, 0, 40, 9, 480), ...over });

  it('uses the fight frames when an opponent is in the room', () => {
    expect(pickFrame(spy(), true, false, 0)).toBe('fightStand');
    expect(pickFrame(spy(), true, true, 0)).toBe('fightStand');
    expect(pickFrame(spy({ blocking: true }), true, false, 0)).toBe('block');
    expect(pickFrame(spy({ swingAnim: RULES.swingAnim }), true, false, 0)).toBe('swingWind');
    expect(pickFrame(spy({ swingAnim: RULES.swingAnim - RULES.swingWindup + 0.01 }), true, false, 0)).toBe('swingWind');
    expect(pickFrame(spy({ swingAnim: Math.min(0.01, RULES.swingAnim - RULES.swingWindup) }), true, false, 0)).toBe('swingStrike');
  });

  it('digs while searching, alternating at about 6 fps', () => {
    const s = spy({ mode: 'searching' });
    expect(pickFrame(s, false, false, 0)).toBe('searchDig1');
    expect(pickFrame(s, false, false, 1 / 6 + 0.01)).toBe('searchDig2');
    expect(pickFrame(s, false, false, 2 / 6 + 0.01)).toBe('searchDig1');
  });

  it('walks when moving and stands otherwise, outside a fight', () => {
    expect(pickFrame(spy(), false, false, 0)).toBe('stand');
    expect(WALK_CYCLE).toContain(pickFrame(spy(), false, true, 0.3));
    expect(pickFrame(spy(), false, true, 0)).toBe(walkFrame(0));
  });
});

describe('formatClock', () => {
  it('shows m:ss rounded up', () => {
    expect(formatClock(480)).toBe('8:00');
    expect(formatClock(59.2)).toBe('1:00');
    expect(formatClock(58.9)).toBe('0:59');
    expect(formatClock(0)).toBe('0:00');
  });
});
