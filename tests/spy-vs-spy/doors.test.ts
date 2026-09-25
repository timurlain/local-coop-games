import { describe, expect, it } from 'vitest';
import { RULES } from '../../src/games/spy-vs-spy/logic/rules';
import { step } from '../../src/games/spy-vs-spy/logic/step';
import { doorKey, EXIT_KEY } from '../../src/games/spy-vs-spy/logic/state';
import { input, kufrik, openGame, place, run } from './fixtures';

const TICK = 1 / 60;
const IDLE = input();
/** Comfortably past the 0.3 s opening swing: one tick to arm it, then enough to count down past
 *  zero even with float accumulation error in the per-tick subtraction. */
const OPENED = RULES.doorOpenTime + TICK * 3;

describe('closed doors (spec §5)', () => {
  it('Akce at a closed door starts an opening; it is immobile, then the door opens for both spies', () => {
    const s = openGame();
    const spy = place(s, 0, 4, 100, 0); // at the N door
    const key = doorKey(4, 1);
    step(s, [input({ action: true }), IDLE], TICK);
    expect(spy.doorOpening).toBe(key);
    expect(s.doorOpen[key]?.phase).toBe('opening');

    // holding Akce and a movement direction through most of the swing does not move the spy yet.
    const before = { x: spy.x, z: spy.z };
    run(s, [input({ action: true, moveY: -1 }), IDLE], RULES.doorOpenTime - TICK * 2);
    expect(spy.x).toBe(before.x);
    expect(spy.z).toBe(before.z);
    expect(spy.doorOpening).toBe(key); // still opening

    // finish the swing (without holding a direction, so we only observe the transition itself)
    const ev = run(s, [input({ action: true }), IDLE], TICK * 4);
    expect(spy.doorOpening).toBeNull();
    expect(s.doorOpen[key]?.phase).toBe('open');
    expect(s.doorOpen[key]?.timer).toBeGreaterThan(0);
    expect(s.doorOpen[key]?.timer).toBeLessThanOrEqual(RULES.doorOpenDuration);
    expect(ev).toContainEqual({ type: 'doorOpened', spy: 0, key });
  });

  it('closes automatically 1.5 s after opening, for both spies', () => {
    const s = openGame();
    const key = doorKey(4, 1);
    s.doorOpen[key] = { phase: 'open', timer: 0.1 };
    step(s, [IDLE, IDLE], 0.05);
    expect(s.doorOpen[key]).toEqual({ phase: 'open', timer: 0.05 });
    step(s, [IDLE, IDLE], 0.1);
    expect(s.doorOpen[key]).toBeUndefined();
  });

  it('a spy can pass once the door has finished opening, but not during the 0.3 s swing', () => {
    const s = openGame();
    const spy = place(s, 0, 4, 100, 0);
    run(s, [input({ action: true }), IDLE], RULES.doorOpenTime / 2); // mid-swing
    expect(spy.room).toBe(4);
    run(s, [IDLE, IDLE], OPENED); // finishes opening
    const ev = step(s, [input({ moveY: -1 }), IDLE], TICK);
    expect(spy.room).toBe(1);
    expect(ev).toContainEqual({ type: 'door', spy: 0 });
  });

  it('a second Akce press while already opening does not restart or duplicate it', () => {
    const s = openGame();
    const key = doorKey(4, 1);
    place(s, 0, 4, 100, 0);
    place(s, 1, 1, 100, RULES.roomD - 1); // spy 1 at the same door from the other side
    step(s, [input({ action: true }), input({ action: true })], TICK);
    expect(s.doorOpen[key]?.phase).toBe('opening');
    // exactly one of them owns the opening (processing order alternates by tick) — never both
    const openers = s.spies.filter((sp) => sp.doorOpening === key);
    expect(openers).toHaveLength(1);
  });

  it('a door trap triggers on opening, not on passing', () => {
    const s = openGame();
    const key = doorKey(4, 1);
    s.doorTraps[key] = { kind: 'pistole', owner: 1 };
    const spy = place(s, 0, 4, 100, 0);
    run(s, [input({ action: true }), IDLE], OPENED);
    expect(spy.mode).toBe('dead');
    expect(spy.deathCause).toBe('pistole');
    expect(s.doorTraps[key]).toBeUndefined();
    expect(s.doorOpen[key]?.phase).toBe('open'); // the door mechanism still opened
  });

  it('the matching remedy disarms a door trap while opening and the door still opens', () => {
    const s = openGame();
    const key = doorKey(4, 1);
    s.doorTraps[key] = { kind: 'pistole', owner: 1 };
    const spy = place(s, 0, 4, 100, 0);
    spy.hand = { kind: 'remedy', remedy: 'nuzky' };
    const ev = run(s, [input({ action: true }), IDLE], OPENED);
    expect(spy.mode).toBe('normal');
    expect(spy.hand).toBeNull();
    expect(ev).toContainEqual({ type: 'disarmed', spy: 0, trap: 'pistole', remedy: 'nuzky' });
    expect(ev).toContainEqual({ type: 'doorOpened', spy: 0, key });
    expect(s.doorOpen[key]?.phase).toBe('open');
  });

  it('dying mid-opening frees the door key instead of leaving it stuck', () => {
    const s = openGame();
    const key = doorKey(4, 1);
    const spy = place(s, 0, 4, 100, 0);
    place(s, 1, 4, 150, 20);
    s.timeBombs.push({ room: 4, x: 100, z: 0, fuse: TICK * 2, owner: 1 });
    step(s, [input({ action: true }), IDLE], TICK); // starts opening
    expect(spy.doorOpening).toBe(key);
    run(s, [IDLE, IDLE], 0.1); // the bomb goes off, killing the still-opening spy
    expect(spy.mode).toBe('dead');
    expect(spy.doorOpening).toBeNull();
    expect(s.doorOpen[key]).toBeUndefined();
  });

  it('Akce still opens a door in a shared room, out of fight range ("doors still work")', () => {
    const s = openGame();
    const key = doorKey(4, 1);
    const spy = place(s, 0, 4, 100, 0);
    place(s, 1, 4, 100, 20); // same room, out of fight range
    step(s, [input({ action: true }), IDLE], TICK);
    expect(spy.doorOpening).toBe(key);
    expect(s.doorOpen[key]?.phase).toBe('opening');
  });

  it('bumping a closed door emits bump, not door or doorOpened', () => {
    const s = openGame();
    place(s, 0, 4, 100, 0);
    const ev = step(s, [input({ moveY: -1 }), IDLE], TICK);
    expect(ev).toEqual([{ type: 'bump', spy: 0 }]);
  });

  describe('exit', () => {
    it('opens the same way even without the full kufrik', () => {
      const s = openGame();
      const spy = place(s, 0, 2, 200, 20);
      const ev = run(s, [input({ action: true }), IDLE], OPENED);
      expect(ev).toContainEqual({ type: 'doorOpened', spy: 0, key: EXIT_KEY });
      expect(spy.mode).toBe('normal');
    });

    it('still refuses to let a spy through without the full kufrik once open: the guard kicks it back (spec §9)', () => {
      const s = openGame();
      const spy = place(s, 0, 2, 200, 20);
      run(s, [input({ action: true }), IDLE], OPENED); // opens it
      const ev = step(s, [input({ moveX: 1 }), IDLE], TICK);
      expect(spy.mode).toBe('normal');
      expect(spy.room).toBe(2);
      expect(ev).toContainEqual({ type: 'bounced', spy: 0 });
    });

    it('lets a spy with the full kufrik escape once the exit is open', () => {
      const s = openGame();
      const spy = place(s, 0, 2, 200, 20);
      spy.hand = kufrik('pas', 'klic', 'penize', 'plany');
      run(s, [input({ action: true }), IDLE], OPENED); // opens it
      const ev = step(s, [input({ moveX: 1 }), IDLE], TICK);
      expect(spy.mode).toBe('escaped');
      expect(ev).toContainEqual({ type: 'escaped', spy: 0 });
    });
  });
});
