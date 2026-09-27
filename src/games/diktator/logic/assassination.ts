import type { Dice } from './dice';
import { FACTIONS, type FactionId } from './groups';
import { RULES } from './rules';
import type { GameEvent, GameState } from './state';

/** L1500: one random faction; it strikes only if it plots an assassination. */
export function attemptStrikes(s: GameState, dice: Dice): FactionId | null {
  const faction = FACTIONS[dice.int(FACTIONS.length)];
  return s.plots[faction].kind === 'assassination' ? faction : null;
}

/**
 * L1510–1560, the ruler's chances when the gunman is not stopped: all three plotting is fatal; otherwise
 * a friendly or strong police saves him, and failing that a coin (4-sided when the commander guarded, palace mode).
 */
export function survivesUnfound(s: GameState, dice: Dice): boolean {
  const allPlotting = FACTIONS.every((f) => s.plots[f].kind === 'assassination');
  const coinSides = s.palace?.guarded ? RULES.guardedCoin : RULES.assassinationCoin;
  return !allPlotting && (s.pop.policie > s.low || s.str.policie > s.low || dice.int(coinSides) !== 0);
}

/** The classic (text-mode) attempt, unchanged: returns true when the ruler dies. */
export function assassination(s: GameState, dice: Dice, events: GameEvent[]): boolean {
  const faction = attemptStrikes(s, dice);
  if (!faction) return false;
  const survived = survivesUnfound(s, dice);
  events.push({ type: 'assassination', faction, survived });
  return !survived;
}
