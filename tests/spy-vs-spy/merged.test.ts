import { describe, expect, it } from 'vitest';
import { createGame } from '../../src/games/spy-vs-spy/logic/generator';
import { darkHalf, exitShownIn } from '../../src/games/spy-vs-spy/render/view';
import { kufrik, openGame, place } from './fixtures';

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

describe('exitShownIn (hidden airport × merged view, L3 review)', () => {
  const ALL_SECRETS = kufrik('klic', 'penize', 'pas', 'plany');

  it('shows the exit in the visible half when the dark-half spy holds the full kufřík', () => {
    const s = shared(10, 25); // white (0) visible, black (1) dark
    s.hideAirport = true;
    s.spies[1].hand = ALL_SECRETS;
    expect(exitShownIn(s, 0)).toBe(true);
  });

  it('shows the exit in the visible half when the visible-half spy holds the full kufřík', () => {
    const s = shared(10, 25);
    s.hideAirport = true;
    s.spies[0].hand = ALL_SECRETS;
    expect(exitShownIn(s, 0)).toBe(true);
  });

  it('hides the exit in the visible half when neither spy holds the full kufřík', () => {
    const s = shared(10, 25);
    s.hideAirport = true;
    expect(exitShownIn(s, 0)).toBe(false);
  });

  it('falls back to per-viewer visibility when the room is not shared', () => {
    const s = shared(10, 25);
    place(s, 1, 5, 160, 20); // no longer sharing the room
    s.hideAirport = true;
    expect(exitShownIn(s, 0)).toBe(false);
    s.spies[0].hand = ALL_SECRETS;
    expect(exitShownIn(s, 0)).toBe(true);
    expect(exitShownIn(s, 1)).toBe(false);
  });

  it('is unaffected when the hidden airport is off: always shown', () => {
    const s = shared(10, 25);
    s.hideAirport = false;
    expect(exitShownIn(s, 0)).toBe(true);
    expect(exitShownIn(s, 1)).toBe(true);
  });
});
