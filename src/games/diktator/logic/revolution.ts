import type { Dice } from './dice';
import { FACTIONS, STRENGTH_GROUPS, type FactionId, type StrengthGroupId } from './groups';
import { formPlots } from './plot';
import { RULES } from './rules';
import type { Ending, GameEvent, GameState } from './state';

/** L1802–1807: three random picks among the factions; the first one planning a revolution starts it. */
export function findRevolution(s: GameState, dice: Dice): FactionId | null {
  for (let i = 0; i < RULES.revolutionTries; i++) {
    const f = FACTIONS[dice.int(FACTIONS.length)];
    if (s.plots[f].kind === 'revolution') return f;
  }
  return null;
}

/** L1833–1840: caught by the rebels when INT(RND * (rebel strength / 3 + 0.4)) ≠ 0. */
export function throughMountains(s: GameState, dice: Dice, _events: GameEvent[]): Ending {
  const range = s.str.povstalci / RULES.mountainsDivisor + RULES.mountainsBase;
  return Math.floor(dice.float() * range) !== 0 ? { kind: 'killed', cause: 'mountains' } : { kind: 'escaped', via: 'mountains' };
}

/** L1830–1847: the plane (if bought) works unless rnd(0..2) = 0; otherwise over the mountains. */
export function flee(s: GameState, dice: Dice, events: GameEvent[]): Ending {
  if (s.hasPlane) {
    if (dice.int(RULES.planeFailOneIn) !== 0) return { kind: 'escaped', via: 'plane' };
    events.push({ type: 'planeFailed' });
  }
  return throughMountains(s, dice, events);
}

/** L1860–1868: groups 1–6 that are not hostile can be asked for help. */
export function eligibleAllies(s: GameState): StrengthGroupId[] {
  return STRENGTH_GROUPS.filter((g) => s.pop[g] > s.low);
}

/**
 * L1850–1926: rebels = faction strength + its ally's; the ruler wins if rebels ≤ guard + chosen ally's strength
 * + rnd(−1..1). `chosen` null = "on your own" (the original left `h` unset; we use the guard alone).
 */
export function fightRevolution(
  s: GameState,
  faction: FactionId,
  chosen: StrengthGroupId | null,
  dice: Dice,
  events: GameEvent[],
): boolean {
  const plot = s.plots[faction];
  if (plot.kind !== 'revolution') throw new Error(`${faction} is not planning a revolution`);
  const rebels = s.str[faction] + s.str[plot.ally];
  const ours = s.guard + (chosen ? s.str[chosen] : 0) + dice.int(3) - 1;
  const won = rebels <= ours;
  events.push({ type: 'revolutionFight', rebels, ours, won });
  return won;
}

/** L1955–1969: optional punishment, the loyal ally grows to strength 9, plots pause for a turn. */
export function afterVictory(
  s: GameState,
  faction: FactionId,
  chosen: StrengthGroupId | null,
  punish: boolean,
  events: GameEvent[],
): void {
  const plot = s.plots[faction];
  if (punish && plot.kind === 'revolution') {
    s.pop[faction] = 0;
    s.str[faction] = 0;
    s.pop[plot.ally] = 0;
    s.str[plot.ally] = 0;
    events.push({ type: 'punished', faction, ally: plot.ally });
  }
  if (chosen) s.str[chosen] = RULES.allyVictoryStrength;
  s.plotPauseUntil = s.quarter + RULES.plotPause;
  formPlots(s);
}
