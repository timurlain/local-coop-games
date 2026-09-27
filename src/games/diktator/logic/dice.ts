import { rand, type RngState } from '../../../shared/rng';

/** The only source of randomness in the logic. `int(n)` is INT(RND*n), `float()` is RND. */
export interface Dice {
  int(n: number): number;
  float(): number;
}

/** Dice backed by the seeded RNG stored in the game state (advances it). */
export function rngDice(r: RngState): Dice {
  return {
    int: (n) => Math.floor(rand(r) * n),
    float: () => rand(r),
  };
}
