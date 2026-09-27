import { describe, expect, it } from 'vitest';
import { answersSearch } from '../../src/games/spy-vs-spy/bot/bot';
import type { GameEvent } from '../../src/games/spy-vs-spy/logic/state';

/** Regression (review finding 1): reach zones overlap (wall slots 12 apart, reach ±22), so the game may answer a
 *  search of a piece the bot never pressed while he is mid-`tries` on another. Only an answer naming the piece he
 *  actually tried may reset `tries` — otherwise he could stay stuck retrying it all game, never reaching `giveUp`. */
describe('answersSearch (review finding 1)', () => {
  it('a search answer naming the tried piece resets tries', () => {
    const events: GameEvent[] = [{ type: 'found', spy: 0, thing: null, furniture: 5 }];
    expect(answersSearch(events, 5)).toBe(true);
  });

  it('a search answer naming a different piece (an overlapping reach zone) does not reset tries', () => {
    const events: GameEvent[] = [{ type: 'found', spy: 0, thing: null, furniture: 7 }];
    expect(answersSearch(events, 5)).toBe(false);
  });

  it('no tried piece yet: never answers', () => {
    const events: GameEvent[] = [{ type: 'found', spy: 0, thing: null, furniture: 5 }];
    expect(answersSearch(events, null)).toBe(false);
  });

  it('an event that is not a search answer never resets tries, even for the tried piece', () => {
    const events: GameEvent[] = [{ type: 'trapSet', spy: 0, trap: 'bomba' }];
    expect(answersSearch(events, 5)).toBe(false);
  });

  it('no events: does not answer', () => {
    expect(answersSearch([], 5)).toBe(false);
  });
});
