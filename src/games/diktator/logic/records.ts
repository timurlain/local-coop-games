import type { FactionId, GroupId, LenderId, StrengthGroupId } from './groups';
import { RULES } from './rules';

/**
 * What a record does. `cost` is the one-off change to the treasury (+ adds money, − costs money);
 * `monthly` is the change to the per-turn costs (+ = costs rise). Deltas are clamped to 0..9 when applied.
 */
export interface Effects {
  readonly cost?: number;
  readonly monthly?: number;
  /** Change of per-quarter income, + = more revenue (our addition, play-test change). */
  readonly income?: number;
  readonly pop?: Readonly<Partial<Record<GroupId, number>>>;
  readonly str?: Readonly<Partial<Record<StrengthGroupId, number>>>;
}

/** Where a record comes from: the 1983 original, another remake, or new for this game. */
export type Origin = 'original' | 'remake' | 'new';

export interface Petition {
  readonly id: string;
  readonly from: FactionId;
  readonly title: string;
  readonly effects: Effects;
  readonly origin: Origin;
  /** How many times "yes" may be answered over the whole game (our addition, play-test change); unset = unlimited. */
  readonly maxAccepted?: number;
  /** Marks a petition whose accepted count feeds the yearly tariff penalty (our addition, play-test change). */
  readonly tariff?: boolean;
}

export type DecisionSpecial =
  | { readonly kind: 'bodyguard' }
  | { readonly kind: 'plane' }
  | { readonly kind: 'swiss' }
  | { readonly kind: 'aid'; readonly lender: LenderId };

export interface Decision {
  readonly id: string;
  /** Menu section of the original: 1 please a group, 2 please all, 3 improve your chances, 4 raise cash, 5 strengthen a group. */
  readonly section: 1 | 2 | 3 | 4 | 5;
  readonly title: string;
  readonly effects: Effects;
  readonly special?: DecisionSpecial;
  /** Reusable decisions are never marked used (bodyguard, Swiss account). */
  readonly reusable?: boolean;
  readonly origin: Origin;
}

export interface NewsItem {
  readonly id: string;
  readonly title: string;
  readonly effects: Effects;
  readonly origin: Origin;
}

/** The parts of the game state that effects touch. */
export interface Stats {
  pop: Record<GroupId, number>;
  str: Record<StrengthGroupId, number>;
  treasury: number;
  /** Per-quarter income (our addition, play-test change). */
  income: number;
  costs: number;
}

export function clamp(v: number): number {
  return Math.max(RULES.min, Math.min(RULES.max, v));
}

/** Applies a record (L1620–1664): popularity and strength clamped, money moved, costs floored at 0. */
export function applyEffects(s: Stats, e: Effects): void {
  for (const [g, d] of Object.entries(e.pop ?? {}) as [GroupId, number][]) s.pop[g] = clamp(s.pop[g] + d);
  for (const [g, d] of Object.entries(e.str ?? {}) as [StrengthGroupId, number][]) s.str[g] = clamp(s.str[g] + d);
  s.treasury += e.cost ?? 0;
  s.costs = Math.max(0, s.costs + (e.monthly ?? 0));
  s.income = Math.max(0, s.income + (e.income ?? 0));
}

/**
 * The original cash check (L2020–2022). In the original `mcst` is the negated monthly change, so
 * `bk + mcst` is `treasury - monthly` here. `net` (our addition, play-test change) is the per-quarter
 * deficit the choice adds: more expenses or less income.
 */
export function affordable(treasury: number, e: Effects): boolean {
  const cost = e.cost ?? 0;
  const net = (e.monthly ?? 0) - (e.income ?? 0);
  if (treasury + cost > 0) return true;
  if ((cost < 0 || net > 0) && (treasury + cost < 0 || treasury - net < 0)) return false;
  return true;
}
