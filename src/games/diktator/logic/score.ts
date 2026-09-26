import { GROUPS } from './groups';
import { RULES } from './rules';
import type { Ending, GameState } from './state';

export interface Score {
  readonly popularity: number;
  readonly time: number;
  readonly alive: number;
  readonly swiss: number;
  readonly total: number;
}

/** L3026–3070: total popularity + 3 per month (9 per quarter); alive: +10 and 1 per 10 in Switzerland. */
export function score(s: GameState, ending: Ending): Score {
  const popularity = GROUPS.reduce((sum, g) => sum + s.pop[g], 0);
  const time = s.quarter * RULES.pointsPerQuarter;
  const isAlive = ending.kind !== 'killed';
  const alive = isAlive ? RULES.aliveBonus : 0;
  const swiss = isAlive ? Math.floor(s.swiss / RULES.swissDivisor) : 0;
  return { popularity, time, alive, swiss, total: popularity + time + alive + swiss };
}
