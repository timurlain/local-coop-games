import type { Dice } from './dice';
import { FACTIONS } from './groups';
import { RULES } from './rules';
import type { GameEvent, GameState } from './state';

/**
 * L1500–1560: one random faction; only an assassination plot acts. All three plotting is fatal; otherwise
 * a friendly or strong police saves the ruler, and failing that a coin. Returns true when the ruler dies.
 * With the commander guarding (palace mode), the coin has 4 sides and only 0 is fatal.
 */
export function assassination(s: GameState, dice: Dice, events: GameEvent[]): boolean {
  const faction = FACTIONS[dice.int(FACTIONS.length)];
  if (s.plots[faction].kind !== 'assassination') return false;
  const allPlotting = FACTIONS.every((f) => s.plots[f].kind === 'assassination');
  const coinSides = s.palace?.guarded ? RULES.guardedCoin : RULES.assassinationCoin;
  const survived =
    !allPlotting && (s.pop.policie > s.low || s.str.policie > s.low || dice.int(coinSides) !== 0);
  events.push({ type: 'assassination', faction, survived });
  return !survived;
}
