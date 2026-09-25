import { describe, expect, it } from 'vitest';
import { shade } from '../../src/games/spy-vs-spy/render/draw';
import { VIEW, project, wallX } from '../../src/games/spy-vs-spy/render/geometry';
import { ROOM } from '../../src/games/spy-vs-spy/render/layout';
import { formatClock } from '../../src/games/spy-vs-spy/render/hud';
import { createSpy } from '../../src/games/spy-vs-spy/logic/generator';
import { RULES, levelRules } from '../../src/games/spy-vs-spy/logic/rules';
import type { Spy } from '../../src/games/spy-vs-spy/logic/state';
import {
  ICONS, ICON_PALETTE, SPY_BACK_HANDS, SPY_CANOPY, SPY_CENTER_X, SPY_FRAMES, SPY_H, SPY_HANDS, SPY_PALETTES, SPY_STAND_H,
  SPY_STAND_REACH, SPY_W, type SpyFrame,
} from '../../src/games/spy-vs-spy/render/sprite-data';
import { RIG_CHARS, RIG_POSES, renderRig } from '../../src/games/spy-vs-spy/render/rig';
import { HANDLE_ROW, HAND_ICONS, canopyPoint, handPoint, heldIcon } from '../../src/games/spy-vs-spy/render/sprites';
import {
  FIGHT_WALK_CYCLE, GIGGLE_EVERY, GIGGLE_IDLE, GIGGLE_LENGTH, UMBRELLA_FRAMES, WALK_CYCLE, digFrame, fightWalkFrame,
  giggleFrame, idleGiggle, pickFrame, walkFrame,
} from '../../src/games/spy-vs-spy/render/spy';
import { N_DOOR_H, SIDE_DOOR_H, doorCentre, leafFraction } from '../../src/games/spy-vs-spy/render/room';

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
  'laugh1', 'laugh2', 'refuse1', 'refuse2', 'giggle1', 'giggle2',
];

const FIGHT_FRAMES = ['fightStand', 'fightWalk1', 'fightWalk2', 'swingWind', 'swingStrike', 'block', 'bashStrike', 'duck'];

function drawn(frame: SpyFrame, x: number, y: number): boolean {
  const ch = SPY_FRAMES[frame][y]?.[x];
  return ch !== undefined && ch !== '.';
}

/** Rows (y) and columns (x) where `frame` draws one of `chars`. */
function where(frame: SpyFrame, chars: string): { xs: number[]; ys: number[] } {
  const xs: number[] = [];
  const ys: number[] = [];
  SPY_FRAMES[frame].forEach((r, y) => [...r].forEach((ch, x) => {
    if (chars.includes(ch)) {
      xs.push(x);
      ys.push(y);
    }
  }));
  return { xs, ys };
}

const topRow = (f: SpyFrame): number => SPY_FRAMES[f].findIndex((r) => /[^.]/.test(r));

describe('sprite data (spies rendered from the rig)', () => {
  it('has exactly the planned spy frames', () => {
    expect(Object.keys(SPY_FRAMES).sort()).toEqual([...FRAMES].sort());
  });

  it('spy frames are all 40×40, the body on column 20, and use only palette characters', () => {
    expect([SPY_W, SPY_H, SPY_CENTER_X]).toEqual([40, 40, 20]);
    for (const [frame, rows] of Object.entries(SPY_FRAMES)) {
      for (const [pal, colours] of Object.entries(SPY_PALETTES)) checkSprite(`${frame}/${pal}`, rows, colours);
      expect(rows[0].length, `${frame} width`).toBe(SPY_W);
      expect(rows, `${frame} height`).toHaveLength(SPY_H);
    }
  });

  it('the standing spy is about as tall as before (≈36 px), hat top to sole', () => {
    expect(SPY_STAND_H).toBeGreaterThanOrEqual(35);
    expect(SPY_STAND_H).toBeLessThanOrEqual(38);
    expect(SPY_STAND_REACH, 'the nose reaches well forward').toBeGreaterThanOrEqual(10);
  });

  it('is deterministic: rendering the rig again gives the same frames and hands', () => {
    for (const f of FRAMES as SpyFrame[]) {
      const again = renderRig(RIG_POSES[f]);
      expect(again.rows, f).toEqual(SPY_FRAMES[f]);
      expect(again.hand, f).toEqual(SPY_HANDS[f]);
      expect(again.backHand, f).toEqual(SPY_BACK_HANDS[f]);
    }
  });

  it('every palette colours every character the rig draws, with the same umbrella crook', () => {
    expect(Object.keys(SPY_PALETTES).sort()).toEqual(['black', 'ghost', 'soaked', 'sooty', 'white']);
    for (const [pal, colours] of Object.entries(SPY_PALETTES)) {
      expect(Object.keys(colours).sort(), pal).toEqual([...RIG_CHARS].sort());
    }
    // the two spies share skin, crook and ferrule; the tinted palettes tint the skin too
    expect(SPY_PALETTES.black.s).toBe(SPY_PALETTES.white.s);
    expect(SPY_PALETTES.black.h).toBe(SPY_PALETTES.white.h);
    for (const pal of ['sooty', 'soaked', 'ghost'] as const) expect(SPY_PALETTES[pal].s, pal).not.toBe(SPY_PALETTES.white.s);
  });

  it('the body sits on the centre column and every frame stands on the floor', () => {
    for (const frame of FRAMES as SpyFrame[]) {
      // the torso or the head crosses near the centre column in a vertical run
      let best = 0;
      for (const x of [SPY_CENTER_X - 2, SPY_CENTER_X, SPY_CENTER_X + 2]) {
        let run = 0;
        for (let y = 0; y < SPY_H; y++) {
          run = drawn(frame, x, y) ? run + 1 : 0;
          best = Math.max(best, run);
        }
      }
      expect(best, `${frame} centre run`).toBeGreaterThanOrEqual(8);
      // the shoes (or a kneecap) on the last row above the ground outline
      expect(SPY_FRAMES[frame][SPY_H - 2], `${frame} touches the floor`).toMatch(/[kb]/);
      expect(SPY_FRAMES[frame][SPY_H - 1].replace(/[.o]/g, ''), `${frame} only outline below`).toBe('');
    }
  });

  it('only the fight frames (duck included) draw the umbrella', () => {
    const fight = new Set(FIGHT_FRAMES);
    for (const frame of FRAMES as SpyFrame[]) {
      expect(where(frame, 'uhf').xs.length > 0, `${frame} umbrella`).toBe(fight.has(frame));
    }
    expect([...UMBRELLA_FRAMES].sort()).toEqual([...FIGHT_FRAMES].sort());
  });

  it('faces and hands are skin coloured, with a dark eye, and the spy wears shoes', () => {
    for (const frame of FRAMES as SpyFrame[]) {
      expect(where(frame, 's').xs.length, `${frame} skin`).toBeGreaterThan(8);
      expect(where(frame, 'd').xs.length, `${frame} eye`).toBeGreaterThan(0);
      expect(where(frame, 'k').xs.length, `${frame} shoes`).toBeGreaterThan(2);
    }
  });

  it('every spy frame has a front and a back hand point on a drawn pixel', () => {
    for (const hands of [SPY_HANDS, SPY_BACK_HANDS]) {
      expect(Object.keys(hands).sort()).toEqual([...FRAMES].sort());
      for (const [frame, [x, y]] of Object.entries(hands)) {
        expect(Number.isInteger(x) && x >= 0 && x < SPY_W, `${frame} hand x`).toBe(true);
        expect(Number.isInteger(y) && y >= 0 && y < SPY_H, `${frame} hand y`).toBe(true);
        expect(SPY_FRAMES[frame as SpyFrame][y][x], `${frame} hand pixel is drawn`).not.toBe('.');
      }
    }
  });

  it('in a fight the front hand holds the umbrella, so the carried thing hangs from the back hand behind the body', () => {
    for (const f of FIGHT_FRAMES as SpyFrame[]) {
      if (f === 'duck') continue; // both hands up on the shaft, under the canopy
      const [hx, hy] = SPY_HANDS[f];
      const near = where(f, 'uh');
      expect(near.xs.some((x, i) => Math.abs(x - hx) <= 2 && Math.abs(near.ys[i] - hy) <= 2), `${f} umbrella at the hand`).toBe(true);
      expect(SPY_BACK_HANDS[f][0], `${f} back hand behind`).toBeLessThan(SPY_CENTER_X);
    }
  });

  it('carries in front when walking or standing, and holds the find / points up high when lifting or laughing', () => {
    for (const f of ['stand', 'searchDig1', 'searchDig2', 'hidePut', 'placeTrap', 'refuse1', 'refuse2'] as SpyFrame[]) {
      expect(SPY_HANDS[f][0], `${f} front hand`).toBeGreaterThan(SPY_CENTER_X);
    }
    for (const f of ['liftFind', 'laugh1', 'laugh2'] as SpyFrame[]) {
      expect(SPY_HANDS[f][1], `${f} raised hand`).toBeLessThan(SPY_HANDS.stand[1] - 6);
    }
    expect(SPY_HANDS.liftFind[1], 'the find held above the hat brim').toBeLessThan(SPY_H - SPY_STAND_H + 12);
  });

  it('the walk cycle bobs the head and swings the legs (tiptoe stride, pass, stride, pass)', () => {
    const legs = (f: SpyFrame) => SPY_FRAMES[f].slice(28);
    for (const [a, b] of [['walk1', 'walk2'], ['walk2', 'walk3'], ['walk3', 'walk4'], ['walk4', 'walk1']] as const) {
      expect(legs(a), `${a} → ${b}`).not.toEqual(legs(b));
    }
    expect(topRow('walk2'), 'passing: head up').toBeLessThan(topRow('walk1'));
    expect(topRow('walk4'), 'passing: head up').toBeLessThan(topRow('walk3'));
  });

  it('fight walk keeps the crouched guard (umbrella and upper body still) and steps its legs (round 4 §4)', () => {
    const upper = (f: SpyFrame) => SPY_FRAMES[f].slice(0, 22);
    const legs = (f: SpyFrame) => SPY_FRAMES[f].slice(30);
    const umbrella = (f: SpyFrame) => SPY_FRAMES[f].map((r) => r.replace(/[^uhf]/g, '.'));
    for (const f of ['fightWalk1', 'fightWalk2'] as SpyFrame[]) {
      expect(umbrella(f), `${f} umbrella held as in the guard`).toEqual(umbrella('fightStand'));
      expect(upper(f), `${f} upper body`).toEqual(upper('fightStand'));
    }
    expect(legs('fightWalk1')).not.toEqual(legs('fightStand'));
    expect(legs('fightWalk2')).not.toEqual(legs('fightWalk1'));
    expect(topRow('fightStand'), 'crouched lower than standing').toBeGreaterThan(topRow('stand'));
  });

  it('the guard points the closed umbrella level at the opponent, the jab thrusts it further', () => {
    const guard = where('fightStand', 'f');
    expect(Math.max(...guard.ys) - Math.min(...guard.ys), 'level').toBeLessThanOrEqual(1);
    expect(Math.min(...guard.xs)).toBeGreaterThan(SPY_HANDS.fightStand[0] + 6);
    const jab = where('swingStrike', 'f');
    expect(Math.max(...jab.xs)).toBeGreaterThanOrEqual(Math.max(...guard.xs));
    expect(Math.max(...jab.xs), 'the ferrule clear of the frame edge').toBeLessThanOrEqual(SPY_W - 3);
  });

  it('the wind-up draws the umbrella back and up, behind the body', () => {
    const { xs, ys } = where('swingWind', 'f');
    expect(Math.max(...xs)).toBeLessThan(SPY_CENTER_X - 4);
    expect(Math.max(...ys)).toBeLessThan(SPY_HANDS.swingWind[1]);
  });

  it('the head bash brings the umbrella down from above in front of the head', () => {
    const hatTop = topRow('bashStrike');
    const [, handY] = SPY_HANDS.bashStrike;
    expect(handY, 'the hand raised to hat height').toBeLessThan(SPY_H - SPY_STAND_H + 12);
    const front = where('bashStrike', 'u');
    const inFront = front.ys.filter((_, i) => front.xs[i] > SPY_CENTER_X + 8);
    expect(inFront.length).toBeGreaterThan(8);
    expect(Math.min(...inFront)).toBeGreaterThanOrEqual(hatTop);
    // the tip is lower than the hand: coming down
    expect(Math.max(...where('bashStrike', 'f').ys)).toBeGreaterThan(handY);
  });

  it('block opens the umbrella in front as a shield, its canopy point on the canopy', () => {
    const { xs, ys } = where('block', 'u');
    expect(Math.max(...ys) - Math.min(...ys), 'a tall canopy').toBeGreaterThanOrEqual(12);
    expect(Math.min(...xs.filter((_, i) => ys[i] < 20 && ys[i] > 18))).toBeGreaterThan(SPY_CENTER_X + 4);
    expect(Object.keys(SPY_CANOPY).sort()).toEqual(['block', 'duck']);
    const [cx, cy] = SPY_CANOPY.block!;
    expect(SPY_FRAMES.block[cy][cx]).toMatch(/[uof]/);
    expect(cx).toBeGreaterThan(SPY_HANDS.block[0] + 6);
  });

  it('the duck kneels low under the open umbrella spread flat above the hat', () => {
    const hatTop = where('duck', 'b').ys.reduce((a, b) => Math.min(a, b));
    expect(hatTop).toBeGreaterThanOrEqual(topRow('fightStand') + 5);
    const canopyRows = where('duck', 'u').ys.filter((y) => y < hatTop);
    expect(canopyRows.length).toBeGreaterThan(10);
    const widest = Math.max(...SPY_FRAMES.duck.slice(0, hatTop).map((r) => (r.match(/u/g) ?? []).length));
    expect(widest, 'spread flat').toBeGreaterThanOrEqual(12);
  });

  it('searching bends over, nose down towards the furniture, the hands rummaging in front', () => {
    for (const f of ['searchDig1', 'searchDig2'] as SpyFrame[]) {
      expect(topRow(f), `${f} bent over`).toBeGreaterThan(topRow('stand') + 1);
      expect(SPY_HANDS[f][0], `${f} front hand forward`).toBeGreaterThan(SPY_CENTER_X + 4);
    }
    expect(SPY_HANDS.searchDig1).not.toEqual(SPY_HANDS.searchDig2);
  });

  it('placing a trap is a clear kneel with the hand down at the floor, lower than hiding (round 5 §6)', () => {
    const [hx, hy] = SPY_HANDS.placeTrap;
    expect(hx).toBeGreaterThan(SPY_CENTER_X + 6);
    expect(hy).toBeGreaterThan(SPY_HANDS.hidePut[1]);
    expect(hy).toBeGreaterThanOrEqual(SPY_H - 7);
    expect(topRow('placeTrap'), 'kneeling').toBeGreaterThan(topRow('stand') + 4);
    expect(SPY_HANDS.hidePut[0], 'hiding reaches forward').toBeGreaterThan(SPY_CENTER_X + 6);
  });

  it('the head shake turns the nose one way, then the other, with the same body and arms out (round 5 §6)', () => {
    const face = (f: SpyFrame) => where(f, 's').xs.filter((_, i) => where(f, 's').ys[i] < 18);
    expect(Math.max(...face('refuse1'))).toBeLessThan(Math.max(...face('stand')) - 3);
    expect(Math.min(...face('refuse2'))).toBeLessThan(SPY_CENTER_X - 6);
    expect(SPY_FRAMES.refuse1.slice(19)).toEqual(SPY_FRAMES.refuse2.slice(19));
    // arms out at the sides: hands away from the body, on both sides
    expect(SPY_HANDS.refuse1[0]).toBeGreaterThan(SPY_CENTER_X + 5);
    expect(SPY_BACK_HANDS.refuse1[0]).toBeLessThan(SPY_CENTER_X - 5);
  });

  it('laughing throws the head back, nose up; giggling tilts it down with the shoulders up — they differ', () => {
    const eyeRow = (f: SpyFrame) => where(f, 'd').ys[0];
    const skin = (f: SpyFrame) => where(f, 's');
    // laughing: the highest skin pixel is the nose tip, well above the eye
    for (const f of ['laugh1', 'laugh2'] as SpyFrame[]) expect(Math.min(...skin(f).ys), `${f} nose up`).toBeLessThan(eyeRow(f) - 2);
    // giggling: the nose tip (the skin pixel furthest forward, above the clasped hands) hangs below the eye
    for (const f of ['giggle1', 'giggle2'] as SpyFrame[]) {
      const s = skin(f);
      const head = s.xs.map((x, i) => [x, s.ys[i]] as const).filter(([, y]) => y < SPY_BACK_HANDS[f][1] - 3);
      const tip = head.reduce((a, b) => (b[0] > a[0] ? b : a));
      expect(tip[1], `${f} nose down`).toBeGreaterThan(eyeRow(f) + 2);
    }
    expect(SPY_FRAMES.giggle1).not.toEqual(SPY_FRAMES.giggle2);
    expect(topRow('giggle2'), 'the giggle bobs').not.toBe(topRow('giggle1'));
  });

  it('the giggle keeps the fedora: the hat stays wider than it is tall, not a cone', () => {
    for (const f of ['giggle1', 'giggle2'] as SpyFrame[]) {
      const hat = where(f, 'b');
      const top = Math.min(...hat.ys);
      const rows = hat.ys.map((y, i) => [y, hat.xs[i]] as const).filter(([y]) => y < top + 9);
      const xs = rows.map(([, x]) => x);
      expect(Math.max(...xs) - Math.min(...xs), `${f} brim span`).toBeGreaterThanOrEqual(12);
    }
  });

  it('a shrug raises the shoulders with both hands out', () => {
    expect(SPY_HANDS.shrug[1]).toBeLessThan(SPY_HANDS.stand[1] - 4);
    expect(SPY_BACK_HANDS.shrug[0]).toBeLessThan(SPY_CENTER_X - 4);
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
  it('maps the stand hand to screen pixels, the body centre column on x, mirroring about it when flipped', () => {
    const [px, py] = SPY_HANDS.stand;
    const x = 123.4;
    const y = 70.6;
    const top = Math.round(y - SPY_H);
    const plain = handPoint('stand', x, y);
    const flipped = handPoint('stand', x, y, true);
    expect(plain.hx).toBe(123 + px - SPY_CENTER_X);
    expect(flipped.hx).toBe(123 - (px - SPY_CENTER_X));
    expect(plain.hy).toBe(top + py);
    expect(flipped.hy).toBe(plain.hy);
  });

  it('keeps the flipped hand as far from the body centre as the plain one', () => {
    for (const f of Object.keys(SPY_FRAMES) as SpyFrame[]) {
      for (const hand of ['front', 'back'] as const) {
        const plain = handPoint(f, 100, 70, false, hand);
        const flipped = handPoint(f, 100, 70, true, hand);
        expect(plain.hx - 100, `${f} ${hand}`).toBe(100 - flipped.hx);
      }
    }
  });

  it('the canopy point sits on the open canopy in front of the blocking spy, mirrored when flipped', () => {
    const [cx, cy] = SPY_CANOPY.block!;
    expect(canopyPoint('block', 100, 70)).toEqual({ hx: 100 + cx - SPY_CENTER_X, hy: 70 - SPY_H + cy });
    expect(canopyPoint('block', 100, 70, true).hx).toBe(100 - (cx - SPY_CENTER_X));
    expect(canopyPoint('block', 100, 70).hx).toBeGreaterThan(handPoint('block', 100, 70).hx);
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

  it('after standing idle for GIGGLE_IDLE s he giggles for about a second, every few seconds', () => {
    expect(GIGGLE_IDLE).toBeGreaterThanOrEqual(3);
    expect(GIGGLE_LENGTH).toBeCloseTo(1);
    expect(GIGGLE_EVERY).toBeGreaterThan(GIGGLE_LENGTH + 1);
    expect(idleGiggle(0)).toBeNull();
    expect(idleGiggle(GIGGLE_IDLE - 0.01)).toBeNull();
    expect(idleGiggle(GIGGLE_IDLE)).toBe('giggle1');
    expect(idleGiggle(GIGGLE_IDLE + 1 / 6 + 0.01)).toBe('giggle2');
    expect(idleGiggle(GIGGLE_IDLE + GIGGLE_LENGTH + 0.01)).toBeNull();
    expect(idleGiggle(GIGGLE_IDLE + GIGGLE_EVERY + 0.01)).toBe('giggle1');
    expect(giggleFrame(0)).toBe('giggle1');
    expect(pickFrame(spy(), false, false, 0, null, GIGGLE_IDLE + 0.1)).toBe('giggle1');
    expect(pickFrame(spy(), false, false, 0, null, 1)).toBe('stand');
  });

  it('never giggles while walking, fighting, searching, placing or in an effect pose', () => {
    const idle = GIGGLE_IDLE + 0.1;
    expect(pickFrame(spy(), false, true, 0, null, idle)).toBe(walkFrame(0));
    expect(pickFrame(spy(), true, false, 0, null, idle)).toBe('fightStand');
    expect(pickFrame(spy({ mode: 'searching' }), false, false, 0, null, idle)).toBe(digFrame(0));
    expect(pickFrame(spy({ placing: { trap: 'bomba', target: { on: 'floor' }, timer: 0.2 } }), false, false, 0, null, idle))
      .toBe('placeTrap');
    expect(pickFrame(spy(), false, false, 0, 'shrug', idle)).toBe('shrug');
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

describe('taller doors (round 4 §5)', () => {
  it('the back door is about 25 % taller than before, fits a 36-px spy standing in front and stays under the cornice', () => {
    expect(N_DOOR_H).toBeGreaterThanOrEqual(Math.round(27 * 1.25));
    expect(N_DOOR_H, 'a standing spy fits under the lintel (bar the hat crown)').toBeGreaterThanOrEqual(SPY_STAND_H - 4);
    expect(VIEW.backY - N_DOOR_H).toBeGreaterThan(VIEW.wallTop);
  });

  it('side doors grow the same way, their tops (and the exit sign above) inside the room view', () => {
    expect(SIDE_DOOR_H[0]).toBeGreaterThanOrEqual(Math.round(26 * 1.25));
    expect(SIDE_DOOR_H[1]).toBeGreaterThanOrEqual(Math.round(30 * 1.25));
    const front = project(0, RULES.roomD / 2 + RULES.doorHalfZ);
    const back = project(0, RULES.roomD / 2 - RULES.doorHalfZ);
    // the plane icon (8 px) sits 2 px above the front jamb's top
    expect(Math.min(front.sy - SIDE_DOOR_H[1], back.sy - SIDE_DOOR_H[0]) - 2 - 8).toBeGreaterThanOrEqual(VIEW.top);
  });

  it('a door trap flies into the middle of the opening', () => {
    expect(doorCentre('N')).toEqual({ x: wallX(RULES.roomW / 2), y: VIEW.backY - N_DOOR_H / 2 });
    for (const dir of ['W', 'E', 'S'] as const) {
      const c = doorCentre(dir);
      expect(c.y).toBeGreaterThan(VIEW.top);
      expect(c.y).toBeLessThan(VIEW.bottom);
    }
  });
});
