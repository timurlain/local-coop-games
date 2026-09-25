import { describe, expect, it } from 'vitest';
import { RULES } from '../../src/games/spy-vs-spy/logic/rules';
import { step } from '../../src/games/spy-vs-spy/logic/step';
import { doorKey, type GameState } from '../../src/games/spy-vs-spy/logic/state';
import { TICK, akceAndWait, input, openGame, place, remedy, run, tap } from './fixtures';

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
    expect(ev).toContainEqual({ type: 'disarmed', spy: 1, trap: 'elektrina' });
  });
});
