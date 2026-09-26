import { makeRng, type RngState } from '../../../shared/rng';
import { GROUPS, STRENGTH_GROUPS, type FactionId, type GroupId, type LenderId, type StrengthGroupId } from './groups';
import type { Direction, Hero, PalaceState } from './palace';
import { RULES } from './rules';

export type Plot =
  | { readonly kind: 'none' }
  | { readonly kind: 'assassination' }
  | { readonly kind: 'revolution'; readonly ally: StrengthGroupId };

export type Ending =
  | { readonly kind: 'killed'; readonly cause: 'assassination' | 'war' | 'revolution' | 'mountains' }
  | { readonly kind: 'escaped'; readonly via: 'plane' | 'mountains' }
  | { readonly kind: 'survived' };

export type Phase =
  | { readonly kind: 'audience'; readonly petition: string; readonly suggested: boolean }
  | { readonly kind: 'day' }
  | { readonly kind: 'revolution'; readonly faction: FactionId }
  | { readonly kind: 'chooseAlly'; readonly faction: FactionId }
  | { readonly kind: 'punish'; readonly faction: FactionId; readonly chosen: StrengthGroupId | null }
  | { readonly kind: 'ended'; readonly ending: Ending };

/** Starting values that differ from the original (the march in plan 4 produces these). */
export interface StartingRegime {
  readonly pop?: Readonly<Partial<Record<GroupId, number>>>;
  readonly str?: Readonly<Partial<Record<StrengthGroupId, number>>>;
  readonly treasury?: number;
}

export interface GameState {
  readonly version: 4;
  readonly seed: number;
  rng: RngState;
  /** 0 before the first turn; 1 = 1925-Q1 … 57 = 1939-Q1. The original's `mth`. */
  quarter: number;
  pop: Record<GroupId, number>;
  str: Record<StrengthGroupId, number>;
  plots: Record<FactionId, Plot>;
  treasury: number;
  /** Per-quarter revenue (our addition, play-test change): the original had no income, only `costs`. */
  income: number;
  /** Per-turn costs, the original `mpy`. */
  costs: number;
  /** The player's own strength (bodyguard), the original `st`. */
  guard: number;
  swiss: number;
  /** Re-rolled each turn: hostile at or below `low`; `threshold` is the strength needed for a revolution. */
  low: number;
  threshold: number;
  /** Plots are paused while `quarter < plotPauseUntil` (the original `pc`). */
  plotPauseUntil: number;
  hasPlane: boolean;
  /** Ids of used records (petitions, decisions, news). */
  used: Record<string, true>;
  /** How many times each petition was answered "yes" over the whole game (our addition, play-test change);
   * a forced "no" does not count. Feeds `maxAccepted` (cap) and the tariff petitions' yearly penalty. */
  accepted: Record<string, number>;
  decisionTaken: boolean;
  phase: Phase;
  /** The palace day (plan 2); null in the classic text mode. */
  palace: PalaceState | null;
}

export type AidRefusal = 'tooEarly' | 'used' | 'unpopular';

export interface PoliceSnapshot {
  readonly pop: Readonly<Record<GroupId, number>>;
  readonly str: Readonly<Record<StrengthGroupId, number>>;
  readonly plots: Readonly<Record<FactionId, Plot>>;
  readonly guard: number;
  readonly low: number;
  readonly threshold: number;
}

export type GameEvent =
  | { readonly type: 'quarterStarted'; readonly quarter: number }
  | { readonly type: 'bankrupt' }
  /** Replaces `costsPaid` (our addition, play-test change): the balance is always booked now, income and costs both shown. */
  | { readonly type: 'budget'; readonly income: number; readonly costs: number }
  /** Yearly, permanent income penalty for tariffs in force (our addition, play-test change): §"tariffs" plan. */
  | { readonly type: 'tariffPenalty'; readonly tariffs: number; readonly amount: number }
  | { readonly type: 'petition'; readonly id: string }
  | { readonly type: 'answered'; readonly id: string; readonly answer: 'yes' | 'no' | 'goAway' }
  | { readonly type: 'forcedNo'; readonly id: string }
  | { readonly type: 'policeReport'; readonly report: PoliceSnapshot }
  | { readonly type: 'policeReportRefused'; readonly reason: 'noMoney' | 'policeHostile' }
  | { readonly type: 'decided'; readonly id: string }
  | { readonly type: 'decisionUnaffordable'; readonly id: string }
  | { readonly type: 'aidGranted'; readonly lender: LenderId; readonly amount: number }
  | { readonly type: 'aidRefused'; readonly lender: LenderId; readonly reason: AidRefusal }
  | { readonly type: 'swissTransfer'; readonly amount: number }
  | { readonly type: 'assassination'; readonly faction: FactionId; readonly survived: boolean }
  | { readonly type: 'warThreat' }
  | { readonly type: 'invasion'; readonly home: number; readonly enemy: number; readonly won: boolean }
  | { readonly type: 'news'; readonly id: string }
  | { readonly type: 'revolution'; readonly faction: FactionId; readonly ally: StrengthGroupId; readonly strength: number }
  | { readonly type: 'planeFailed' }
  | { readonly type: 'joking' }
  | { readonly type: 'revolutionFight'; readonly rebels: number; readonly ours: number; readonly won: boolean }
  | { readonly type: 'punished'; readonly faction: FactionId; readonly ally: StrengthGroupId }
  | { readonly type: 'moved'; readonly hero: Hero; readonly from: string; readonly to: string }
  | { readonly type: 'seal'; readonly holder: Hero | null }
  | { readonly type: 'wish'; readonly group: StrengthGroupId; readonly decision: string | null }
  | { readonly type: 'advised'; readonly subject: 'petition' | 'decision'; readonly id: string }
  | { readonly type: 'envoys'; readonly offers: Readonly<Record<LenderId, number | null>> }
  | { readonly type: 'investigated'; readonly faction: FactionId; readonly plot: Plot }
  | { readonly type: 'guarding' }
  | { readonly type: 'heroDone'; readonly hero: Hero }
  | { readonly type: 'ended'; readonly ending: Ending };

export type Command =
  | { readonly type: 'answer'; readonly answer: 'yes' | 'no' | 'goAway' | 'suggestOther' }
  /** Palace mode: only the commander, in the guardroom, 1 hour. */
  | { readonly type: 'policeReport'; readonly hero?: Hero }
  /** `share` only for the Swiss account: send 1/share of the treasury (1, 2, 3 or 4; the original is 2).
   * Palace mode: `hero` must carry the seal and stand in the decision's room. */
  | { readonly type: 'decide'; readonly decision: string; readonly share?: 1 | 2 | 3 | 4; readonly hero?: Hero }
  /** Palace mode: `hero` ends his day; the evening starts when both have. */
  | { readonly type: 'endDay'; readonly hero?: Hero }
  | { readonly type: 'flee' }
  | { readonly type: 'fight' }
  | { readonly type: 'ally'; readonly group: StrengthGroupId }
  | { readonly type: 'punish'; readonly punish: boolean }
  // palace mode only (plan 2a)
  | { readonly type: 'move'; readonly hero: Hero; readonly dir: Direction }
  | { readonly type: 'takeSeal'; readonly hero: Hero }
  | { readonly type: 'giveSeal'; readonly hero: Hero }
  /** Zogu, in a group's room, 1 hour. */
  | { readonly type: 'talk' }
  /** Zogu, 1 hour: without `decision` during the audience (about the petition), with it in Mother's room. */
  | { readonly type: 'advice'; readonly decision?: string }
  /** Zogu, in the envoys' salon, 1 hour. */
  | { readonly type: 'envoys' }
  /** The commander, in a faction's room, 1 hour. */
  | { readonly type: 'investigate' }
  /** The commander, in Zogu's room, his remaining hours. */
  | { readonly type: 'guard' };

function record<K extends string>(keys: readonly K[], v: (k: K) => number): Record<K, number> {
  return Object.fromEntries(keys.map((k) => [k, v(k)])) as Record<K, number>;
}

/** The state before the first turn (L140–L244), optionally with a starting regime. */
export function initialState(seed: number, regime: StartingRegime = {}): GameState {
  const st = RULES.start;
  return {
    version: 4,
    seed,
    rng: makeRng(seed),
    quarter: 0,
    pop: record(GROUPS, (g) => regime.pop?.[g] ?? (g === 'povstalci' ? st.rebelsPop : st.pop)),
    str: record(STRENGTH_GROUPS, (g) => regime.str?.[g] ?? st.str),
    plots: { armada: { kind: 'none' }, rolnici: { kind: 'none' }, statkari: { kind: 'none' } },
    treasury: regime.treasury ?? st.treasury,
    income: st.income,
    costs: st.costs,
    guard: st.guard,
    swiss: 0,
    low: RULES.lowBase,
    threshold: RULES.thresholdBase,
    plotPauseUntil: 0,
    hasPlane: false,
    used: {},
    accepted: {},
    decisionTaken: false,
    phase: { kind: 'day' },
    palace: null,
  };
}
