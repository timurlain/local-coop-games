import { describe, expect, it } from 'vitest';
import { createGame } from '../../src/games/spy-vs-spy/logic/generator';
import { darkHalf } from '../../src/games/spy-vs-spy/render/view';
import { openGame, place } from './fixtures';

/** Both spies in room 4, Bílý entered at `white`, Černý at `black`. */
function shared(white: number, black: number) {
  const s = openGame();
  place(s, 0, 4, 40, 20).enteredAt = white;
  place(s, 1, 4, 160, 20).enteredAt = black;
  return s;
}

describe('darkHalf (spec §2 merged view)', () => {
  it('darkens the half of the spy who entered the shared room later', () => {
    const s = shared(10, 25);
    expect(darkHalf(s, 0)).toBe(false);
    expect(darkHalf(s, 1)).toBe(true);
    const t = shared(40, 25);
    expect(darkHalf(t, 0)).toBe(true);
    expect(darkHalf(t, 1)).toBe(false);
  });

  it('breaks a tie in favour of Bílý: Černý goes dark', () => {
    const s = shared(7, 7);
    expect(darkHalf(s, 0)).toBe(false);
    expect(darkHalf(s, 1)).toBe(true);
  });

  it('at the start of a match Bílý sees the shared start room and Černý is dark', () => {
    const s = createGame(42, 3);
    expect(darkHalf(s, 0)).toBe(false);
    expect(darkHalf(s, 1)).toBe(true);
  });

  it('is off for both when the spies are in different rooms', () => {
    const s = shared(10, 25);
    place(s, 1, 5, 160, 20);
    expect(darkHalf(s, 0)).toBe(false);
    expect(darkHalf(s, 1)).toBe(false);
  });

  it('is off for both when one of them is not active (dead, out, escaped)', () => {
    for (const mode of ['dead', 'out', 'escaped'] as const) {
      const s = shared(10, 25);
      s.spies[0].mode = mode;
      expect(darkHalf(s, 0), mode).toBe(false);
      expect(darkHalf(s, 1), mode).toBe(false);
      const t = shared(10, 25);
      t.spies[1].mode = mode;
      expect(darkHalf(t, 0), mode).toBe(false);
      expect(darkHalf(t, 1), mode).toBe(false);
    }
  });

  it('a searching spy counts as active', () => {
    const s = shared(10, 25);
    s.spies[0].mode = 'searching';
    expect(darkHalf(s, 1)).toBe(true);
    expect(darkHalf(s, 0)).toBe(false);
  });
});
