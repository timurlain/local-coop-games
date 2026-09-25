import { describe, expect, it } from 'vitest';
import {
  ESCAPE_CUES, ESCAPE_DURATION, ESCAPE_PHASES, ESCAPE_SKIP_AFTER, SPOTS, arc, doorSwing, escapeCues, escapeOver,
  escapePhase, escapePlaneX, escapeSpy, phaseStart,
} from '../../src/games/spy-vs-spy/render/escape';

/** Phase names in the order they first appear, sampled every 10 ms past the end. */
function order(): string[] {
  const seen: string[] = [];
  for (let t = 0; t <= ESCAPE_DURATION + 0.5; t += 0.01) {
    const p = escapePhase(t).phase;
    if (seen[seen.length - 1] !== p) seen.push(p);
  }
  return seen;
}

describe('escape scene timeline (round 6 §5)', () => {
  it('lasts about seven seconds', () => {
    expect(ESCAPE_DURATION).toBeGreaterThanOrEqual(6.5);
    expect(ESCAPE_DURATION).toBeLessThanOrEqual(7.5);
  });

  it('runs key → counter → passport control → plane → taxi, then done', () => {
    expect(order()).toEqual(['key', 'toCounter', 'counter', 'toControl', 'control', 'toPlane', 'board', 'taxi', 'done']);
  });

  it('reports seconds and progress into each phase', () => {
    for (const [name, d] of ESCAPE_PHASES) {
      const start = phaseStart(name);
      expect(escapePhase(start + d / 2)).toEqual({ phase: name, t: expect.closeTo(d / 2, 9), k: expect.closeTo(0.5, 9) });
    }
    expect(escapePhase(-1)).toEqual({ phase: 'key', t: 0, k: 0 });
    expect(escapePhase(ESCAPE_DURATION + 2).phase).toBe('done');
    expect(phaseStart('done')).toBeCloseTo(ESCAPE_DURATION);
  });

  it('ends on its own, and any press after the first moment skips it', () => {
    expect(escapeOver(0, false)).toBe(false);
    expect(escapeOver(ESCAPE_DURATION - 0.01, false)).toBe(false);
    expect(escapeOver(ESCAPE_DURATION, false)).toBe(true);
    expect(escapeOver(ESCAPE_SKIP_AFTER - 0.01, true)).toBe(false); // the escape's own press does not skip
    expect(escapeOver(ESCAPE_SKIP_AFTER, true)).toBe(true);
    expect(escapeOver(3, true)).toBe(true);
  });

  it('plays every item sound once, in order, inside the scene', () => {
    const names = ESCAPE_CUES.map(([, s]) => s);
    expect(names).toEqual(['jingle', 'click', 'door', 'coins', 'paper', 'paper', 'paper', 'stamp', 'engine']);
    const times = ESCAPE_CUES.map(([at]) => at);
    expect([...times].sort((a, b) => a - b)).toEqual(times);
    for (const at of times) {
      expect(at).toBeGreaterThan(0);
      expect(at).toBeLessThan(ESCAPE_DURATION);
    }
    // stepped frame by frame, every cue fires exactly once
    const heard: string[] = [];
    for (let t = 0; t < ESCAPE_DURATION + 0.1; t += 1 / 60) heard.push(...escapeCues(t, t + 1 / 60));
    expect(heard).toEqual(names);
    expect(escapeCues(0, ESCAPE_DURATION)).toEqual(names);
  });

  it('the stamp lands in the control phase and the lock clicks before the door opens', () => {
    const at = (s: string) => ESCAPE_CUES.find(([, n]) => n === s)![0];
    expect(escapePhase(at('stamp')).phase).toBe('control');
    expect(escapePhase(at('coins')).phase).toBe('counter');
    expect(at('click')).toBeLessThan(at('door'));
    expect(doorSwing(0)).toBe(0);
    expect(doorSwing(at('click'))).toBe(0);
    expect(doorSwing(phaseStart('toCounter'))).toBe(1);
  });
});

describe('escape scene motion', () => {
  it('the spy stands at each stop and walks between them, left to right', () => {
    expect(escapeSpy(0.5)).toMatchObject({ x: SPOTS.door, walking: false, visible: true });
    expect(escapeSpy(phaseStart('counter') + 0.5)).toMatchObject({ x: SPOTS.counter, walking: false });
    expect(escapeSpy(phaseStart('control') + 0.5)).toMatchObject({ x: SPOTS.control, walking: false });
    expect(escapeSpy(phaseStart('toCounter') + 0.1).walking).toBe(true);
    let last = -Infinity;
    for (let t = 0; t < phaseStart('board'); t += 0.05) {
      const { x } = escapeSpy(t);
      expect(x).toBeGreaterThanOrEqual(last);
      last = x;
    }
  });

  it('climbs the steps and is gone once aboard, before the plane rolls', () => {
    const top = escapeSpy(phaseStart('board') + 0.3);
    expect(top.y).toBeLessThan(escapeSpy(0).y);
    expect(escapeSpy(phaseStart('taxi')).visible).toBe(false);
    expect(escapeSpy(ESCAPE_DURATION + 1).visible).toBe(false);
  });

  it('the plane stays parked until the taxi, then rolls off the half', () => {
    expect(escapePlaneX(0)).toBe(escapePlaneX(phaseStart('taxi')));
    expect(escapePlaneX(phaseStart('taxi') + 0.3)).toBeGreaterThan(escapePlaneX(phaseStart('taxi')));
    // the tail (80 px behind the centre) has left the 320 px half by the end
    expect(escapePlaneX(ESCAPE_DURATION) - 80).toBeGreaterThan(320);
  });

  it('items fly in a small arc from start to target', () => {
    expect(arc([0, 50], [40, 30], 0, 10)).toEqual([0, 50]);
    expect(arc([0, 50], [40, 30], 1, 10)).toEqual([40, 30]);
    const [x, y] = arc([0, 50], [40, 30], 0.5, 10);
    expect(x).toBe(20);
    expect(y).toBe(30); // 40 on the straight line, lifted 10 by the arc
    expect(arc([0, 50], [40, 30], 2, 10)).toEqual([40, 30]);
  });
});
