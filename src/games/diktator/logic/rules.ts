// Every number of the original Dictator (1983) BASIC in one place; see docs/diktator/research/original-rules.md.
// Money is in the original units (1 = 1 000). One turn is one quarter; per-turn values keep their original size.

export const RULES = {
  /** 1925-Q1 … 1939-Q1. */
  quarters: 57,
  firstYear: 1925,
  /** Popularity and strength are clamped to this range. */
  min: 0,
  max: 9,
  /** `income` and the 300 starting `treasury` are our addition (play-test change, 2026-09-26): the original had
   * no income and started with 1000, melting by `costs` every quarter with no way back. */
  start: { pop: 7, str: 6, rebelsPop: 0, treasury: 300, income: 60, costs: 60, guard: 4 },
  /** low = 2 + rnd(0..2): a group at or below it is hostile (L603). */
  lowBase: 2,
  lowSpread: 3,
  /** str = 10 + rnd(0..2): strength needed for a revolution (L604). */
  thresholdBase: 10,
  thresholdSpread: 3,
  /** Plots only form once the turn number is above this (L1410). */
  plotsAfterQuarter: 2,
  policeReportCost: 1,
  /** "Increase your bodyguard" adds this to the player's strength (L2674). */
  bodyguardStep: 2,
  /** News appears when rnd(0..2) = 0 (L2760). */
  newsOneIn: 3,
  /** The revolution phase picks a random faction this many times (L1802). */
  revolutionTries: 3,
  /** War: invasion when rnd(0..2) = 0, otherwise only a threat (L4212). */
  invasionOneIn: 3,
  /** The plane fails when rnd(0..2) = 0 (L1842, L4324). */
  planeFailOneIn: 3,
  /** Mountains: caught if INT(RND * (rebel strength / 3 + 0.4)) ≠ 0 (L1836). */
  mountainsDivisor: 3,
  mountainsBase: 0.4,
  /** Foreign aid: too early if turn < rnd(0..4) + 3; amount = pop × 30 + rnd(0..199) (L2088, L2117). */
  aidEarliestBase: 3,
  aidEarliestSpread: 5,
  aidPerPop: 30,
  aidSpread: 200,
  /** Assassination: the last chance is a coin, INT(RND*2) (L1540). */
  assassinationCoin: 2,
  /** After a crushed revolution: ally strength set to this, plots paused until turn + 2 (L1968–1969). */
  allyVictoryStrength: 9,
  plotPause: 2,
  /** Score (L3026–3070): 3 points per month, a quarter counts as 3 months. */
  pointsPerQuarter: 9,
  aliveBonus: 10,
  swissDivisor: 10,
  /** Palace day (spec §5): hours per hero per quarter. */
  palace: { hours: { zogu: 3, velitel: 3 } },
  /** Guarded by the commander, the last-chance coin becomes rnd(0..3) ≠ 0, i.e. 75 % (spec §5.3, our addition). */
  guardedCoin: 4,
} as const;
