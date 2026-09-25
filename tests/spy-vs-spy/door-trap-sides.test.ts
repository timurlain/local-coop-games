import { describe, expect, it } from 'vitest';
import { RULES } from '../../src/games/spy-vs-spy/logic/rules';
import { step } from '../../src/games/spy-vs-spy/logic/step';
import { doorKey, type GameState } from '../../src/games/spy-vs-spy/logic/state';
import { TICK, akceAndWait, input, only, openGame, place, remedy, run, select, tap } from './fixtures';

const IDLE = input();
const W = RULES.roomW;
const D = RULES.roomD;

/**
 * Round 4 §6: a door trap set by one spy on door A–B must fire for the other spy opening the same door from
 * room B. Both door orientations: a back/front (N–S) door and a side (W–E) door. `a`/`b` are where Bílý and
 * Černý stand at that door, each in their own room (openGame's 3×3 grid, every internal door present).
 */
const DOORS = [
  { name: 'N–S door 4–1', a: { room: 4, x: W / 2, z: 0 }, b: { room: 1, x: W / 2, z: D } },
  { name: 'W–E door 4–3', a: { room: 4, x: 0, z: D / 2 }, b: { room: 3, x: W, z: D / 2 } },
] as const;

describe.each(DOORS)('door trap from the other side (round 4 §6): $name', ({ a, b }) => {
  const key = doorKey(a.room, b.room);

  /** Bílý picks elektřina by tapping the Trapulator, stands at the door in room A, Akce, waits the placing time. */
  function setUp(): GameState {
    const s = openGame();
    place(s, 0, a.room, a.x, a.z);
    tap(s);
    tap(s);
    tap(s);
    expect(s.spies[0].selected).toBe('elektrina');
    akceAndWait(s);
    expect(s.doorTraps[key]).toEqual({ kind: 'elektrina', owner: 0 });
    expect(s.spies[0].selected).toBeNull();
    place(s, 1, b.room, b.x, b.z);
    return s;
  }

  /** Černý presses Akce at the same door from room B and waits for it to swing open. */
  function openFromB(s: GameState) {
    const ev = step(s, [IDLE, input({ action: true })], TICK);
    ev.push(...run(s, [IDLE, IDLE], RULES.doorOpenTime + 0.05));
    return ev;
  }

  it('fires for Černý opening it: he dies without the deštník', () => {
    const s = setUp();
    const ev = openFromB(s);
    expect(s.spies[1].mode).toBe('dead');
    expect(s.spies[1].deathCause).toBe('elektrina');
    expect(s.doorTraps[key]).toBeUndefined();
    expect(ev).toContainEqual(expect.objectContaining({ type: 'died', spy: 1, cause: 'elektrina' }));
  });

  it('is disarmed by Černý holding the deštník', () => {
    const s = setUp();
    s.spies[1].hand = remedy('destnik');
    const ev = openFromB(s);
    expect(s.spies[1].mode).toBe('normal');
    expect(s.spies[1].hand).toBeNull();
    expect(s.doorTraps[key]).toBeUndefined();
    expect(ev).toContainEqual({ type: 'disarmed', spy: 1, trap: 'elektrina', remedy: 'destnik' });
  });
});

describe('a door trap slams an open door shut (round 4)', () => {
  const key = doorKey(4, 1);

  it('placing elektřina on an open door closes it; the opponent must open it and triggers it', () => {
    const s = openGame();
    place(s, 0, 4, W / 2, 0);
    s.doorOpen[key] = { phase: 'open', timer: RULES.doorOpenDuration };
    select(s, 'elektrina');
    akceAndWait(s);
    expect(s.doorTraps[key]).toEqual({ kind: 'elektrina', owner: 0 });
    expect(s.doorOpen[key]).toBeUndefined();

    place(s, 1, 1, W / 2, D);
    const ev = step(s, [IDLE, input({ action: true })], TICK);
    ev.push(...run(s, [IDLE, IDLE], RULES.doorOpenTime + 0.05));
    expect(s.spies[1].mode).toBe('dead');
    expect(s.spies[1].deathCause).toBe('elektrina');
    expect(ev).toContainEqual(expect.objectContaining({ type: 'died', spy: 1, cause: 'elektrina' }));
  });

  it('also slams a door still swinging open, freeing the spy who was opening it (he must open it again)', () => {
    const s = openGame();
    place(s, 0, 4, W / 2, 0);
    place(s, 1, 1, W / 2, D);
    select(s, 'pistole');
    step(s, only(0, input({ action: true })), TICK);
    run(s, [IDLE, IDLE], RULES.placeTime - 0.15);
    // Černý starts opening the same door from room 1; Bílý's placing ends before the door has swung open
    step(s, [IDLE, input({ action: true })], TICK);
    expect(s.spies[1].doorOpening).toBe(key);
    run(s, [IDLE, IDLE], 0.2);
    expect(s.doorTraps[key]).toEqual({ kind: 'pistole', owner: 0 });
    expect(s.doorOpen[key]).toBeUndefined();
    expect(s.spies[1].doorOpening).toBeNull();
    expect(s.spies[1].mode).toBe('normal');

    step(s, [IDLE, input({ action: true })], TICK);
    run(s, [IDLE, IDLE], RULES.doorOpenTime + 0.05);
    expect(s.spies[1].deathCause).toBe('pistole');
  });
});
