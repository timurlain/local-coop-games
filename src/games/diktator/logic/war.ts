import type { Dice } from './dice';
import { FACTIONS, STRENGTH_GROUPS } from './groups';
import { RULES } from './rules';
import type { GameEvent, GameState } from './state';

export type WarResult = 'none' | 'threat' | 'won' | 'escaped' | 'killed';

/** L4200–4340: a hostile, strong-enough Yugoslavia threatens (2/3) or invades (1/3). */
export function war(s: GameState, dice: Dice, events: GameEvent[]): WarResult {
  if (s.pop.jugoslavie > s.low) return 'none';
  if (s.str.jugoslavie < s.low) return 'none';
  if (dice.int(RULES.invasionOneIn) !== 0) {
    for (const g of [...FACTIONS, 'policie'] as const) s.pop[g] = Math.min(RULES.max, s.pop[g] + 1);
    events.push({ type: 'warThreat' });
    return 'threat';
  }
  let home = s.guard;
  for (const f of FACTIONS) if (s.pop[f] > s.low) home += s.str[f];
  if (s.pop.policie > s.low) home += s.str.policie;
  let enemy = 0;
  for (const g of STRENGTH_GROUPS) if (s.pop[g] <= s.low) enemy += s.str[g];
  const lost = enemy + dice.int(3) - 1 >= home;
  events.push({ type: 'invasion', home, enemy, won: !lost });
  if (!lost) {
    s.str.jugoslavie = 0;
    return 'won';
  }
  if (s.hasPlane && dice.int(RULES.planeFailOneIn) !== 0) return 'escaped';
  if (s.hasPlane) events.push({ type: 'planeFailed' });
  return 'killed';
}
