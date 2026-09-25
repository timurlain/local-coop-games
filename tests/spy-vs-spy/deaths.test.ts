import { describe, expect, it } from 'vitest';
import { RULES } from '../../src/games/spy-vs-spy/logic/rules';
import type { DeathCause } from '../../src/games/spy-vs-spy/logic/state';
import {
  ANGEL_AT, ANGEL_RISE, BUCKET_FALL, CRUMBLE_AT, CRUMBLE_TIME, HOLE_AT, PISTOL_TILTS, SHOCK_TIME, SPLAT_SQUASH,
  angel, electricPhase, hatPiece, nearestTilt, pieceStart, pistolPhase, sootPhase, springPhase,
} from '../../src/games/spy-vs-spy/render/death-phases';
import { DEATH_FRAMES, DEATH_POSES, deathPalettes, hatPieces } from '../../src/games/spy-vs-spy/render/death-frames';
import { renderRig, RIG_H, RIG_W } from '../../src/games/spy-vs-spy/render/rig';
import { renderXray, XRAY_CHARS } from '../../src/games/spy-vs-spy/render/rig/xray';

const CAUSES: DeathCause[] = ['fight', 'bomba', 'casovana', 'pruzina', 'pistole', 'elektrina'];

/** Samples `phaseOf` every 10 ms over the whole death; returns the phase names in the order they first appear. */
function order(phaseOf: (t: number) => { phase: string }): string[] {
  const seen: string[] = [];
  for (let t = 0; t <= RULES.respawnTime + 1e-9; t += 0.01) {
    const p = phaseOf(t).phase;
    if (seen[seen.length - 1] !== p) seen.push(p);
  }
  return seen;
}

const drawn = (rows: readonly string[]): { top: number; bottom: number; left: number; right: number } => {
  const ys = rows.flatMap((r, y) => (/[^.]/.test(r) ? [y] : []));
  const xs = rows.flatMap((r) => [...r].flatMap((ch, x) => (ch === '.' ? [] : [x])));
  return { top: Math.min(...ys), bottom: Math.max(...ys), left: Math.min(...xs), right: Math.max(...xs) };
};

describe('death timelines (round 6 §6)', () => {
  it('every death keeps its total length and ends with the angel rising for at least a second', () => {
    expect(RULES.respawnTime).toBe(3);
    expect(ANGEL_AT.fight).toBe(1.2);
    for (const c of CAUSES) {
      expect(ANGEL_AT[c], c).toBeLessThanOrEqual(RULES.respawnTime - 1);
      expect(angel(c, ANGEL_AT[c] - 0.01), c).toBeNull();
      expect(angel(c, ANGEL_AT[c])).toEqual({ phase: 'angel', rise: 0 });
      expect(angel(c, RULES.respawnTime)!.rise).toBeCloseTo((RULES.respawnTime - ANGEL_AT[c]) * ANGEL_RISE);
    }
  });

  it('elektrina: the bucket falls, he flickers with the skeleton for about a second, then a smoking heap', () => {
    expect(order(electricPhase)).toEqual(['fall', 'shock', 'heap', 'angel']);
    expect(SHOCK_TIME).toBeGreaterThanOrEqual(0.9);
    expect(SHOCK_TIME).toBeLessThanOrEqual(1.1);
    const f0 = electricPhase(0);
    const f1 = electricPhase(BUCKET_FALL - 0.01);
    if (f0.phase !== 'fall' || f1.phase !== 'fall') throw new Error('falling');
    expect(f0.drop).toBe(1);
    expect(f1.drop).toBeLessThan(0.1);
    // both the figure and the skeleton show during the shock, the skeleton straight away
    const shocks = [];
    for (let t = BUCKET_FALL; t < BUCKET_FALL + SHOCK_TIME; t += 0.01) shocks.push(electricPhase(t));
    const xr = shocks.map((p) => (p.phase === 'shock' ? p.xray : null));
    expect(xr[0]).toBe(true);
    expect(xr.filter((x) => x === true).length).toBeGreaterThan(30);
    expect(xr.filter((x) => x === false).length).toBeGreaterThan(30);
    expect(shocks.some((p) => p.phase === 'shock' && p.jitter === 1)).toBe(true);
  });

  it('bomba and časovaná: flash, then the sooty face blinking while the hat crumbles off', () => {
    for (const c of ['bomba', 'casovana'] as const) expect(order((t) => sootPhase(c, t))).toEqual(['flash', 'soot', 'angel']);
    for (let t = 0; t < 3; t += 0.05) expect(sootPhase('casovana', t)).toEqual(sootPhase('bomba', t));
    const at = (t: number) => {
      const p = sootPhase('bomba', t);
      if (p.phase !== 'soot') throw new Error(`soot at ${t}`);
      return p;
    };
    expect(at(0.2).blink).toBe(false);
    expect(at(CRUMBLE_AT - 0.01).crumble).toBe(0);
    expect(at(CRUMBLE_AT + CRUMBLE_TIME).crumble).toBe(1);
    const blinks = [];
    for (let t = 0.2; t < ANGEL_AT.bomba; t += 0.01) blinks.push(at(t).blink);
    expect(blinks.filter(Boolean).length).toBeGreaterThan(10);
    expect(blinks.filter((b) => !b).length).toBeGreaterThan(blinks.length / 2);
  });

  it('hat pieces leave one after another and fall faster and faster down to the floor', () => {
    const n = 8;
    for (let i = 0; i < n; i++) {
      expect(pieceStart(i, n)).toBeLessThanOrEqual(0.45);
      expect(hatPiece(i, n, 0).fall).toBe(0);
      expect(hatPiece(i, n, 1)).toMatchObject({ fall: 1, landed: true });
      const a = hatPiece(i, n, pieceStart(i, n) + 0.1).fall;
      const b = hatPiece(i, n, pieceStart(i, n) + 0.2).fall;
      expect(b - a).toBeGreaterThan(a);
    }
    expect(pieceStart(n - 1, n)).toBeGreaterThan(pieceStart(0, n));
  });

  it('pružina: spring, up to the ceiling, flattened there, sliding down, a pancake', () => {
    expect(order(springPhase)).toEqual(['spring', 'launch', 'splat', 'slide', 'flat', 'angel']);
    let last = -1;
    let lastDown = -1;
    for (let t = 0; t < ANGEL_AT.pruzina; t += 0.01) {
      const p = springPhase(t);
      if (p.phase === 'launch') {
        expect(p.up).toBeGreaterThanOrEqual(last);
        last = p.up;
      }
      if (p.phase === 'slide') {
        expect(p.down).toBeGreaterThanOrEqual(lastDown);
        expect(p.down).toBeLessThanOrEqual(1);
        lastDown = p.down;
      }
    }
    expect(SPLAT_SQUASH).toBeLessThan(0.5);
  });

  it('pistole: the gun, the BANG flag with the hole in the hat, sway, fall over backwards, lie there', () => {
    expect(order(pistolPhase)).toEqual(['aim', 'bang', 'sway', 'fall', 'down', 'angel']);
    const bang = (t: number) => {
      const p = pistolPhase(t);
      if (p.phase !== 'bang') throw new Error(`bang at ${t}`);
      return p;
    };
    expect(bang(HOLE_AT - 0.01).hole).toBe(false);
    expect(bang(HOLE_AT).hole).toBe(true);
    let prev: number | null = null;
    for (let t = 0; t < ANGEL_AT.pistole; t += 0.01) {
      const p = pistolPhase(t);
      if (p.phase !== 'sway' && p.phase !== 'fall') continue;
      if (p.phase === 'sway') expect(Math.abs(p.tilt)).toBeLessThanOrEqual(9);
      // no jumps: the fall continues from the sway
      if (prev !== null) expect(Math.abs(p.tilt - prev)).toBeLessThan(15);
      prev = p.tilt;
    }
    expect(prev).toBeLessThan(-75);
    expect(nearestTilt(-88)).toBe(-90);
    expect(nearestTilt(4.4)).toBe(3);
    expect(nearestTilt(0.2)).toBe(0);
  });
});

describe('death frames (round 6 §6)', () => {
  it('are rendered deterministically from the rig', () => {
    expect(renderRig(DEATH_POSES.zap1).rows).toEqual(DEATH_FRAMES.zap[0].rows);
    expect(renderXray(DEATH_POSES.zap1, { w: RIG_W, h: RIG_H })).toEqual(DEATH_FRAMES.xray[0].rows);
    expect(renderXray(DEATH_POSES.zap2, { w: RIG_W, h: RIG_H })).toEqual(renderXray(DEATH_POSES.zap2, { w: RIG_W, h: RIG_H }));
    expect(renderRig(DEATH_POSES.shot, { w: 88, h: 44, cx: 46, tilt: -45, hatHole: true }).rows).toEqual(DEATH_FRAMES.tilts[-45].rows);
  });

  it('the X-ray is the same pose as the figure: same outline box, white bones on a dark silhouette', () => {
    for (const i of [0, 1]) {
      const xray = DEATH_FRAMES.xray[i].rows;
      expect(drawn(xray), `frame ${i}`).toEqual(drawn(DEATH_FRAMES.zap[i].rows));
      const allowed = new Set(['.', ...XRAY_CHARS]);
      for (const r of xray) for (const ch of r) expect(allowed.has(ch)).toBe(true);
      const count = (ch: string): number => xray.join('').split(ch).length - 1;
      expect(count('w')).toBeGreaterThan(40);
      expect(count('x')).toBeGreaterThan(count('w'));
      expect(count('W')).toBeGreaterThan(5);
    }
    const pal = deathPalettes('white').xray;
    for (const ch of XRAY_CHARS) expect(pal[ch]).toBeDefined();
  });

  it('the sooty spy loses his hat: the bare frame is lower, and the pieces are exactly the hat pixels', () => {
    const { hat, bare } = DEATH_FRAMES.soot;
    expect(drawn(bare.rows).top).toBeGreaterThan(drawn(hat.rows).top + 3);
    const pieces = hatPieces(hat.rows, bare.rows);
    expect(pieces).toEqual(DEATH_FRAMES.hatPieces);
    expect(pieces.length).toBeGreaterThanOrEqual(6);
    for (const p of pieces.flat()) expect(bare.rows[p.y][p.x]).not.toBe(p.ch);
    // big white eyes on a black face: the eye is two pixels tall
    const eye = hat.rows.flatMap((r, y) => [...r].flatMap((ch, x) => (ch === 'd' ? [[x, y]] : [])));
    expect(eye.length).toBeGreaterThanOrEqual(2);
    const soot = deathPalettes('black');
    expect(soot.soot.d).toBe('#ffffff');
    expect(soot.sootBlink.d).toBe(soot.soot.s);
  });

  it('the spring: stretched on the way up, flattened (a scaled rig frame) against the ceiling', () => {
    const stand = drawn(renderRig(DEATH_POSES.splat).rows);
    const splat = drawn(DEATH_FRAMES.splat.rows);
    expect(splat.bottom - splat.top).toBeLessThan((stand.bottom - stand.top) * 0.45);
    expect(splat.right - splat.left).toBeGreaterThan(stand.right - stand.left);
    const jump = drawn(DEATH_FRAMES.jump.rows);
    expect(jump.bottom - jump.top).toBeGreaterThan(stand.bottom - stand.top);
  });

  it('the shot spy: a hole in the hat once hit, lying flat on the floor at −90°', () => {
    expect(DEATH_FRAMES.shot.rows.join('')).not.toContain('O');
    for (const t of PISTOL_TILTS) {
      const rows = DEATH_FRAMES.tilts[t].rows;
      expect(rows.join(''), `tilt ${t}`).toContain('O');
      // stands (or lies) on the floor: the bottom row is only outline
      expect(drawn(rows).bottom, `tilt ${t}`).toBe(rows.length - 1);
    }
    const down = drawn(DEATH_FRAMES.tilts[-90].rows);
    expect(down.right - down.left).toBeGreaterThan(1.5 * (down.bottom - down.top));
    const own = deathPalettes('white').own;
    expect(own.O).toBeDefined();
  });
});
