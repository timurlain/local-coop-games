// Mother's advice (spec §5.3, play-test feedback): where a petition or decision would lead. Applies the choice's
// effects to a copy of the state and compares it with the same thresholds the rules use (low, threshold,
// police protection, war, money). Pure; the UI turns the warnings into Mother's words.

import { FACTIONS, STRENGTH_GROUPS, type FactionId, type StrengthGroupId } from './groups';
import { applyEffects, type Effects, type Stats } from './records';
import type { GameState } from './state';

export type Warning =
  | { readonly kind: 'turnsHostile'; readonly group: FactionId }
  | { readonly kind: 'reconciles'; readonly group: FactionId }
  | { readonly kind: 'revolutionRisk'; readonly group: FactionId; readonly ally: StrengthGroupId }
  | { readonly kind: 'policeLost' }
  | { readonly kind: 'warRisk' }
  | { readonly kind: 'broke' }
  | { readonly kind: 'moneyRunsOut'; readonly quarters: number }
  /** Accepting a tariff petition (our addition, play-test change; tariffs plan): a permanent yearly income drain. */
  | { readonly kind: 'tariffDrain' };

/** Money lasting this many quarters or fewer after the choice is worth a warning. */
const MONEY_WARNING_QUARTERS = 3;

function copyStats(s: GameState): Stats {
  return { pop: { ...s.pop }, str: { ...s.str }, treasury: s.treasury, income: s.income, costs: s.costs };
}

function revolutionAlly(t: Stats, f: FactionId, low: number, threshold: number): StrengthGroupId | null {
  return STRENGTH_GROUPS.find((p) => p !== f && t.pop[p] <= low && t.str[p] + t.str[f] >= threshold) ?? null;
}

/** What `effects` would change that matters for survival, worst first. `opts.tariff` (our addition,
 * play-test change) marks a petition whose "yes" would add to the yearly tariff penalty. */
export function forecast(s: GameState, effects: Effects, opts: { readonly tariff?: boolean } = {}): Warning[] {
  const before = copyStats(s);
  const after = copyStats(s);
  applyEffects(after, effects);
  const { low, threshold } = s;
  const out: Warning[] = [];

  if (opts.tariff) out.push({ kind: 'tariffDrain' });

  // Money warnings (our addition, play-test change): use the per-quarter balance `income − costs`. A
  // balanced or surplus budget never runs out, since the treasury no longer melts by `costs` alone.
  if (after.treasury < 0) out.push({ kind: 'broke' });
  else if (after.costs > after.income) {
    const quarters = Math.floor(after.treasury / (after.costs - after.income));
    const was = before.costs > before.income ? Math.floor(before.treasury / (before.costs - before.income)) : Infinity;
    if (quarters <= MONEY_WARNING_QUARTERS && quarters < was) out.push({ kind: 'moneyRunsOut', quarters });
  }

  for (const f of FACTIONS) {
    const ally = after.pop[f] <= low ? revolutionAlly(after, f, low, threshold) : null;
    const allyBefore = before.pop[f] <= low ? revolutionAlly(before, f, low, threshold) : null;
    if (ally && !allyBefore) out.push({ kind: 'revolutionRisk', group: f, ally });
    else if (after.pop[f] <= low && before.pop[f] > low) out.push({ kind: 'turnsHostile', group: f });
  }

  const protectsBefore = before.pop.policie > low || before.str.policie > low;
  const protectsAfter = after.pop.policie > low || after.str.policie > low;
  if (protectsBefore && !protectsAfter) out.push({ kind: 'policeLost' });

  const warBefore = before.pop.jugoslavie <= low && before.str.jugoslavie >= low;
  const warAfter = after.pop.jugoslavie <= low && after.str.jugoslavie >= low;
  if (warAfter && !warBefore) out.push({ kind: 'warRisk' });

  for (const f of FACTIONS) if (before.pop[f] <= low && after.pop[f] > low) out.push({ kind: 'reconciles', group: f });
  return out;
}
