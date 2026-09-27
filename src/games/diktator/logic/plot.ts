import { FACTIONS, STRENGTH_GROUPS } from './groups';
import { RULES } from './rules';
import type { GameState } from './state';

/**
 * Plot formation (L1400–1452). Every unhappy faction looks for the first hostile group (1–6, not itself)
 * whose strength together with its own reaches the revolution threshold; without one it plots an assassination.
 */
export function formPlots(s: GameState): void {
  if (s.quarter <= RULES.plotsAfterQuarter) return;
  for (const f of FACTIONS) s.plots[f] = { kind: 'none' };
  if (s.quarter < s.plotPauseUntil) return;
  for (const f of FACTIONS) {
    if (s.pop[f] > s.low) continue;
    const ally = STRENGTH_GROUPS.find((p) => p !== f && s.pop[p] <= s.low && s.str[p] + s.str[f] >= s.threshold);
    s.plots[f] = ally ? { kind: 'revolution', ally } : { kind: 'assassination' };
  }
}
