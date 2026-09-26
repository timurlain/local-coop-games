import type { Dice } from '../../src/games/diktator/logic/dice';

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
