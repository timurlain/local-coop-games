import type { Dice } from '../../src/games/diktator/logic/dice';
import { advance, newGame } from '../../src/games/diktator/logic/turn';
import type { GameState } from '../../src/games/diktator/logic/state';
import { albania } from '../../src/games/diktator/scenario/albania';

/** Dice that return the given values in order; throws when a value is out of range or the script runs out. */
export function scriptedDice(values: readonly number[]): Dice & { readonly remaining: () => number } {
  let i = 0;
  const next = (): number => {
    if (i >= values.length) throw new Error('scripted dice exhausted');
    return values[i++];
  };
  return {
    int(n) {
      const v = next();
      if (!Number.isInteger(v) || v < 0 || v >= n) throw new Error(`scripted int ${v} not in 0..${n - 1}`);
      return v;
    },
    float() {
      const v = next();
      if (v < 0 || v >= 1) throw new Error(`scripted float ${v} not in [0, 1)`);
      return v;
    },
    remaining: () => values.length - i,
  };
}

/** A new palace game with Zogu walked from his study into the throne room, the petitioner waiting. */
export function palaceAudience(seed = 4): GameState {
  return advance(albania, newGame(albania, seed, undefined, { palace: true }).state, { type: 'move', hero: 'zogu', dir: 'right' }).state;
}

/** A palace game past its first audience (answered "no"), in the day phase, Zogu in the throne room. */
export function palaceDay(seed = 4): GameState {
  return advance(albania, palaceAudience(seed), { type: 'answer', answer: 'no' }).state;
}
