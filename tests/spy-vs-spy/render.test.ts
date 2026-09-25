import { describe, expect, it } from 'vitest';
import { shade } from '../../src/games/spy-vs-spy/render/draw';
import { VIEW, project, wallX } from '../../src/games/spy-vs-spy/render/geometry';
import { ROOM } from '../../src/games/spy-vs-spy/render/layout';
import { formatClock } from '../../src/games/spy-vs-spy/render/hud';
import { createSpy } from '../../src/games/spy-vs-spy/logic/generator';
import { RULES, levelRules } from '../../src/games/spy-vs-spy/logic/rules';
import type { Spy } from '../../src/games/spy-vs-spy/logic/state';
import {
  ICONS, ICON_PALETTE, SPY_BACK_HANDS, SPY_CENTER_X, SPY_FRAMES, SPY_H, SPY_HANDS, SPY_PALETTES, SPY_W, type SpyFrame,
} from '../../src/games/spy-vs-spy/render/sprite-data';
import { HANDLE_ROW, HAND_ICONS, handPoint, heldIcon } from '../../src/games/spy-vs-spy/render/sprites';
import {
  FIGHT_WALK_CYCLE, WALK_CYCLE, digFrame, fightWalkFrame, pickFrame, walkFrame,
} from '../../src/games/spy-vs-spy/render/spy';
import { leafFraction } from '../../src/games/spy-vs-spy/render/room';

describe('project', () => {
  it('maps the floor corners onto the trapezoid inside the room view', () => {
    expect(project(0, 0)).toEqual({ sx: 34, sy: 46 });
    expect(project(200, 0)).toEqual({ sx: 184, sy: 46 });
    expect(project(0, 40)).toEqual({ sx: 13, sy: 79 });
    expect(project(200, 40)).toEqual({ sx: 205, sy: 79 });
    expect(project(100, 20)).toEqual({ sx: 109, sy: 62.5 });
    expect(VIEW.backLeft).toBe(34);
    expect(VIEW.frontY).toBeLessThan(VIEW.bottom);
  });

  it('keeps the whole room inside ROOM', () => {
    expect(VIEW.left).toBe(ROOM.x);
    expect(VIEW.right).toBe(ROOM.x + ROOM.w);
    expect(VIEW.frontLeft).toBeGreaterThanOrEqual(VIEW.left);
    expect(VIEW.frontRight).toBeLessThanOrEqual(VIEW.right);
    expect(VIEW.wallTop).toBeGreaterThan(VIEW.top);
    expect(wallX(RULES.roomW)).toBe(VIEW.backRight);
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
  'fightStand', 'fightWalk1', 'fightWalk2', 'swingWind', 'swingStrike', 'block', 'bashStrike', 'duck',
  'searchDig1', 'searchDig2', 'hidePut', 'placeTrap', 'shrug', 'liftFind',
  'laugh1', 'laugh2', 'refuse1', 'refuse2',
];

const FIGHT_FRAMES = ['fightStand', 'fightWalk1', 'fightWalk2', 'swingWind', 'swingStrike', 'block', 'bashStrike', 'duck'];

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
    const club = new Set(FIGHT_FRAMES);
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
    for (const f of FIGHT_FRAMES as SpyFrame[]) {
      expect(SPY_HANDS[f][0], `${f} back hand`).toBeLessThan(SPY_CENTER_X);
    }
    const front = ['stand', 'walk1', 'walk2', 'walk4', 'searchDig1', 'searchDig2', 'hidePut', 'placeTrap', 'refuse1', 'refuse2'];
    for (const f of front as SpyFrame[]) {
      expect(SPY_HANDS[f][0], `${f} front hand`).toBeGreaterThan(SPY_CENTER_X);
    }
    for (const f of ['liftFind', 'laugh1', 'laugh2'] as SpyFrame[]) {
      expect(SPY_HANDS[f][1], `${f} raised hand`).toBeLessThan(SPY_HANDS.stand[1] - 6);
    }
  });

  it('every spy frame has a back hand on a drawn pixel, behind the body centre (spec §2)', () => {
    expect(Object.keys(SPY_BACK_HANDS).sort()).toEqual([...FRAMES].sort());
    for (const [frame, [x, y]] of Object.entries(SPY_BACK_HANDS)) {
      expect(Number.isInteger(x) && x >= 0 && x < SPY_CENTER_X, `${frame} back hand x`).toBe(true);
      expect(Number.isInteger(y) && y >= 0 && y < SPY_H, `${frame} back hand y`).toBe(true);
      expect(SPY_FRAMES[frame as SpyFrame][y][x], `${frame} back hand pixel is drawn`).not.toBe('.');
      // at the side / hip, below the chin; only liftFind holds the back hand up high
      if (frame !== 'liftFind') expect(y, `${frame} back hand below the head`).toBeGreaterThanOrEqual(19);
    }
  });

  it('fight walk keeps the crouched ready stance and steps its legs (spec §4)', () => {
    const upper = (f: SpyFrame) => SPY_FRAMES[f].slice(0, 28);
    const legs = (f: SpyFrame) => SPY_FRAMES[f].slice(28);
    const club = (f: SpyFrame) => SPY_FRAMES[f].map((r) => r.replace(/[^c]/g, '.'));
    expect(club('fightWalk1'), 'club held as in the stance').toEqual(club('fightStand'));
    expect(club('fightWalk2'), 'club held as in the stance').toEqual(club('fightStand'));
    expect(upper('fightWalk1')).toEqual(upper('fightStand'));
    expect(legs('fightWalk1')).not.toEqual(legs('fightStand'));
    expect(legs('fightWalk2')).not.toEqual(legs('fightWalk1'));
    expect(legs('fightWalk2')).not.toEqual(legs('fightStand'));
  });

  it('placing a trap reaches low and forward, lower than hiding (spec §4)', () => {
    const [hx, hy] = SPY_HANDS.placeTrap;
    expect(hx).toBeGreaterThan(SPY_CENTER_X + 6);
    expect(hy).toBeGreaterThan(SPY_HANDS.hidePut[1]);
    expect(hy).toBeGreaterThanOrEqual(SPY_H - 6);
    const top = (f: SpyFrame) => SPY_FRAMES[f].findIndex((r) => r.includes('o'));
    expect(top('placeTrap'), 'bent down').toBeGreaterThan(top('stand') + 4);
  });

  it('the head shake turns the nose one way, then the other (spec §4)', () => {
    const face = (f: SpyFrame) => SPY_FRAMES[f].slice(8, 16);
    const right = (f: SpyFrame) => Math.max(...face(f).map((r) => r.replace(/\.+$/, '').length - 1));
    const left = (f: SpyFrame) => Math.min(...face(f).map((r) => r.search(/[^.]/)).filter((i) => i >= 0));
    // refuse1: nose foreshortened, still to the right; refuse2: nose to the left, behind the head
    expect(right('refuse1')).toBeLessThan(right('stand') - 2);
    expect(right('refuse1')).toBeGreaterThan(SPY_CENTER_X + 4);
    expect(left('refuse2')).toBeLessThan(SPY_CENTER_X - 6);
    expect(right('refuse2')).toBeLessThan(SPY_CENTER_X + 6);
    // only the head moves
    expect(SPY_FRAMES.refuse1.slice(16)).toEqual(SPY_FRAMES.refuse2.slice(16));
  });

  it('the head bash brings the club down in front of the head, above the nose', () => {
    const rows = SPY_FRAMES.bashStrike;
    const hatTop = rows.findIndex((r) => r.includes('o'));
    const noseRow = rows.findIndex((r) => r.lastIndexOf('o') >= SPY_W - 2);
    const clubInFront = rows.flatMap((r, y) => [...r].flatMap((ch, x) => (ch === 'c' && x > SPY_CENTER_X + 6 ? [y] : [])));
    expect(clubInFront.length).toBeGreaterThan(8);
    expect(Math.max(...clubInFront)).toBeLessThan(noseRow);
    expect(Math.min(...clubInFront)).toBeGreaterThanOrEqual(hatTop);
  });

  it('the duck is lower than the fight stance, with the club flat above the hat', () => {
    const top = (f: SpyFrame) => SPY_FRAMES[f].findIndex((r) => /[ob]/.test(r));
    const clubRows = (f: SpyFrame) => SPY_FRAMES[f].flatMap((r, y) => (r.includes('c') ? [y] : []));
    const hatTop = SPY_FRAMES.duck.findIndex((r) => /[ob]/.test(r.slice(SPY_CENTER_X - 4, SPY_CENTER_X + 5)));
    expect(hatTop).toBeGreaterThanOrEqual(top('fightStand') + 5);
    expect(Math.max(...clubRows('duck'))).toBeLessThan(hatTop);
    const widest = Math.max(...SPY_FRAMES.duck.map((r) => (r.match(/c/g) ?? []).length));
    expect(widest, 'held flat: one long row of club').toBeGreaterThanOrEqual(15);
  });

  it('icons are 8×8 (the open umbrella up to 12×8) and use only palette characters', () => {
    for (const [name, rows] of Object.entries(ICONS)) {
      checkSprite(name, rows, ICON_PALETTE);
      expect(rows, name).toHaveLength(8);
      if (name === 'destnik_open') {
        expect(rows[0].length).toBeGreaterThanOrEqual(8);
        expect(rows[0].length).toBeLessThanOrEqual(12);
      } else expect(rows[0].length, name).toBe(8);
    }
  });

  it('has hand icons for every trap and remedy, the open umbrella too (spec §2, §3)', () => {
    const all = ['kufrik', 'satchel', 'bomba', 'pruzina', 'elektrina', 'pistole', 'casovana', 'voda', 'kleste', 'destnik', 'nuzky', 'destnik_open'];
    expect([...HAND_ICONS].sort()).toEqual(all.sort());
  });

  it('every hand icon has a handle row with a drawn pixel under the hand column', () => {
    expect(Object.keys(HANDLE_ROW).sort()).toEqual([...HAND_ICONS].sort());
    for (const name of HAND_ICONS) {
      const rows = ICONS[name];
      const row = HANDLE_ROW[name];
      expect(Number.isInteger(row) && row >= 0 && row < rows.length, `${name} handle row`).toBe(true);
      // drawIcon centres the icon on the hand: column w/2 (or the one left of it) sits on the hand pixel
      const w = rows[0].length;
      const cols = [Math.floor(w / 2), Math.ceil(w / 2) - 1];
      expect(cols.some((x) => rows[row][x] !== '.'), `${name} handle under the hand`).toBe(true);
    }
  });

  it('remedy icons read as themselves: bucket of water on a handle, pliers, closed umbrella, scissors', () => {
    const count = (name: keyof typeof ICONS, ch: string) => ICONS[name].join('').split(ch).length - 1;
    expect(count('voda', 'u') + count('voda', 'c'), 'water').toBeGreaterThanOrEqual(6);
    expect(HANDLE_ROW.voda, 'bucket hangs from its handle, above the water').toBeLessThan(ICONS.voda.findIndex((r) => /[uc]/.test(r)));
    // closed umbrella: canopy never wider than 3 px; the open one: a wide canopy
    expect(Math.max(...ICONS.destnik.map((r) => (r.match(/r/g) ?? []).length))).toBeLessThanOrEqual(3);
    expect(Math.max(...ICONS.destnik_open.map((r) => (r.match(/r/g) ?? []).length))).toBeGreaterThanOrEqual(9);
    expect(ICONS.nuzky).not.toEqual(ICONS.kleste);
  });
});

describe('satchel (spec §6)', () => {
  it('is a light leather bag with a brown strap on top and a brass clasp', () => {
    const rows = ICONS.satchel;
    expect(rows).toHaveLength(8);
    expect(rows[0].length).toBe(8);
    const count = (ch: string) => rows.join('').split(ch).length - 1;
    expect(count('w') + count('m'), 'white/cream body').toBeGreaterThanOrEqual(20);
    expect(count('y'), 'brass clasp').toBeGreaterThanOrEqual(2);
    expect(rows[HANDLE_ROW.satchel], 'the strap is the top row it hangs from').toMatch(/n/);
    const clasp = rows.findIndex((r) => r.includes('y'));
    expect(clasp).toBeGreaterThan(HANDLE_ROW.satchel + 1);
  });

  it('the kufřík hangs from its handle row', () => {
    expect(ICONS.kufrik[HANDLE_ROW.kufrik]).toMatch(/n/);
  });

  it('a loose secret is carried in the satchel, the kufřík and remedies as themselves (round 4 §3)', () => {
    expect(heldIcon(null)).toBeNull();
    expect(heldIcon({ kind: 'secret', secret: 'pas', lastHolder: null })).toBe('satchel');
    expect(heldIcon({ kind: 'kufrik', contents: ['klic'], lastHolder: 0 })).toBe('kufrik');
    expect(heldIcon({ kind: 'remedy', remedy: 'voda' })).toBe('voda');
    expect(heldIcon({ kind: 'remedy', remedy: 'kleste' })).toBe('kleste');
    expect(heldIcon({ kind: 'remedy', remedy: 'destnik' })).toBe('destnik');
    expect(heldIcon({ kind: 'remedy', remedy: 'nuzky' })).toBe('nuzky');
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
  const spy = (over: Partial<Spy> = {}): Spy => ({ ...createSpy(0, 0, 40, 9, 480, levelRules(3).trapStockPerSpy), ...over });

  it('uses the fight frames when an opponent is in the room', () => {
    expect(pickFrame(spy(), true, false, 0)).toBe('fightStand');
    expect(pickFrame(spy({ blocking: true }), true, false, 0)).toBe('block');
    expect(pickFrame(spy({ ducking: true }), true, false, 0)).toBe('duck');
    expect(pickFrame(spy({ ducking: true, blocking: true }), true, false, 0)).toBe('block');
  });

  it('steps in the fight stance when moving in a shared room (spec §4)', () => {
    expect(FIGHT_WALK_CYCLE).toEqual(['fightWalk1', 'fightWalk2']);
    expect(pickFrame(spy(), true, true, 0)).toBe('fightWalk1');
    expect(pickFrame(spy(), true, true, 1 / 8 + 0.01)).toBe('fightWalk2');
    expect(pickFrame(spy(), true, true, 2 / 8 + 0.01)).toBe('fightWalk1');
    expect(pickFrame(spy(), true, true, 0.3)).toBe(fightWalkFrame(0.3));
    // block, duck and the swing still win over the step
    expect(pickFrame(spy({ blocking: true }), true, true, 0)).toBe('block');
    expect(pickFrame(spy({ ducking: true }), true, true, 0)).toBe('duck');
  });

  it('winds up for both attacks, then strikes with the frame of the attack (spec §8)', () => {
    const jab = { attack: 'jab' as const, swingAnim: RULES.swingWindup + RULES.strikeAnim, strikeIn: RULES.swingWindup };
    const bash = { attack: 'bash' as const, swingAnim: RULES.bashWindup + RULES.strikeAnim, strikeIn: RULES.bashWindup };
    expect(pickFrame(spy(jab), true, false, 0)).toBe('swingWind');
    expect(pickFrame(spy(bash), true, false, 0)).toBe('swingWind');
    expect(pickFrame(spy({ ...jab, swingAnim: 0.1, strikeIn: 0 }), true, false, 0)).toBe('swingStrike');
    expect(pickFrame(spy({ ...bash, swingAnim: 0.1, strikeIn: 0 }), true, false, 0)).toBe('bashStrike');
    // the swing shows over block and duck
    expect(pickFrame(spy({ ...bash, swingAnim: 0.1, strikeIn: 0, blocking: true, ducking: true }), true, false, 0)).toBe('bashStrike');
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

  it('an effect pose overrides search, fight and stand while not moving, but not swing or block', () => {
    expect(pickFrame(spy(), false, false, 0, 'liftFind')).toBe('liftFind');
    expect(pickFrame(spy(), true, false, 0, 'hidePut')).toBe('hidePut');
    expect(pickFrame(spy({ mode: 'searching' }), false, false, 0, 'shrug')).toBe('shrug');
    expect(pickFrame(spy({ blocking: true }), true, false, 0, 'liftFind')).toBe('block');
    expect(pickFrame(spy({ attack: 'jab', swingAnim: 0.3, strikeIn: 0.1 }), true, false, 0, 'liftFind')).toBe('swingWind');
    expect(pickFrame(spy({ ducking: true }), true, false, 0, 'liftFind')).toBe('duck');
    expect(pickFrame(spy(), false, false, 0, null)).toBe('stand');
  });

  it('walking cancels the effect pose so the spy shows a walk frame instead', () => {
    expect(pickFrame(spy(), false, true, 0, 'shrug')).toBe(walkFrame(0));
    expect(WALK_CYCLE).toContain(pickFrame(spy(), false, true, 0.3, 'liftFind'));
    expect(pickFrame(spy(), true, true, 0, 'liftFind')).toBe('fightWalk1');
  });

  it('a running search still digs over a pose even while moving, per the frame priority', () => {
    expect(pickFrame(spy({ mode: 'searching' }), false, true, 0, 'hidePut')).toBe(digFrame(0));
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

describe('leafFraction (spec §5: closed vs open door drawing)', () => {
  it('is fully closed (1) when there is no runtime state', () => {
    expect(leafFraction(undefined)).toBe(1);
  });

  it('shrinks linearly over the 0.3 s opening swing', () => {
    expect(leafFraction({ phase: 'opening', timer: RULES.doorOpenTime })).toBe(1);
    expect(leafFraction({ phase: 'opening', timer: RULES.doorOpenTime / 2 })).toBeCloseTo(0.575, 5);
    expect(leafFraction({ phase: 'opening', timer: 0 })).toBeCloseTo(0.15, 5);
  });

  it('stays at the open sliver for the whole 1.5 s open window', () => {
    expect(leafFraction({ phase: 'open', timer: 1.5 })).toBeCloseTo(0.15, 5);
    expect(leafFraction({ phase: 'open', timer: 0.01 })).toBeCloseTo(0.15, 5);
  });
});
