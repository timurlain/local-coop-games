# Diktátor — Plan 1: Rules engine and text mode

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A pure, fully tested Diktátor rules engine (the original Dictator BASIC formulas, one turn = one quarter, 1925-Q1 → 1939-Q1) with the 49 original records re-themed for Albania, save/retry, and a playable text-mode page.

**Architecture:** `src/games/diktator/logic/` is pure TypeScript (no DOM, no `Math.random`): a phase machine `advance(scenario, state, command)` that clones the state, applies one command and returns `{ state, events }`. All randomness goes through a `Dice` built from the seeded `RngState` stored in the state, so tests can script dice. Country content lives in `src/games/diktator/scenario/albania/`. A small DOM text UI (`src/games/diktator/main.ts`) drives the engine; later plans replace it with the palace.

**Tech Stack:** TypeScript (strict), Vite multi-page, Vitest. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-09-26-diktator-design.md`. **Rules reference:** `docs/diktator/research/original-rules.md` (the BASIC line numbers `L…` cited below refer to the listing summarised there).

---

## Roadmap (this is plan 1 of 6)

| Plan | Delivers | Depends on |
|---|---|---|
| **1. Engine + text mode** (this file) | rules, original data, save/retry, text-mode page, hub card | — |
| 2. Palace | extract `raster.ts` to `src/shared/rig/`, character rig + grey puppets, split-screen room jumping (Dune style), palace strip, hours, seal, investigate/report/guard, ten mood levels, playroom shell | 1 |
| 3. Newspaper and history | the timeline as data, newspaper screen, chronicle, big moments with choices, world-event effects, dated decisions, remake content (≈20 petitions, ≈17 news, conditional news), playroom items | 1, 2 |
| 4. Pochod na Tiranu | the co-op march mini-game → `StartingRegime` | 1 |
| 5. Art pipeline | manifest, `art-style.md`, prompts, placeholder frames, `assets:check`, part-sheet skinning | 2, 3, 4 |
| 6. Menus and endings | menu (new / continue / quick start / retry), posters, ending screens, score ranks, polish | all |

Each plan ends with the game playable and all tests green.

---

## File structure (plan 1)

| File | Responsibility |
|---|---|
| `src/games/diktator/logic/groups.ts` | group ids, subsets (factions, strength groups, lenders) |
| `src/games/diktator/logic/rules.ts` | every number from the original, in one object |
| `src/games/diktator/logic/dice.ts` | `Dice` interface and the RNG-backed implementation |
| `src/games/diktator/logic/records.ts` | record types, `applyEffects`, `affordable`, clamping |
| `src/games/diktator/logic/state.ts` | `GameState`, `Phase`, `Ending`, `GameEvent`, `Command`, `initialState` |
| `src/games/diktator/logic/scenario.ts` | the `Scenario` interface |
| `src/games/diktator/logic/plot.ts` | plot formation (L1400) |
| `src/games/diktator/logic/money.ts` | bankruptcy and paying costs (L618–620, L900) |
| `src/games/diktator/logic/audience.ts` | drawing petitions and answering them (L630–766) |
| `src/games/diktator/logic/decision.ts` | presidential decisions incl. Swiss account, aid, plane, bodyguard (L2500, L2060) |
| `src/games/diktator/logic/police.ts` | the police report (L1700) |
| `src/games/diktator/logic/assassination.ts` | L1500 |
| `src/games/diktator/logic/war.ts` | L4200 |
| `src/games/diktator/logic/news.ts` | L2750 |
| `src/games/diktator/logic/revolution.ts` | L1800 |
| `src/games/diktator/logic/score.ts` | L3000 |
| `src/games/diktator/logic/turn.ts` | `newGame`, `advance`, the phase machine, `quarterLabel` |
| `src/games/diktator/logic/save.ts` | save file, versioning, yearly checkpoints, retry |
| `src/games/diktator/scenario/albania/groups.ts` | Czech group names |
| `src/games/diktator/scenario/albania/records.ts` | the 49 original records, re-themed |
| `src/games/diktator/scenario/albania/index.ts` | the `albania` scenario object |
| `src/games/diktator/index.html`, `main.ts`, `style.css` | text-mode page |
| `src/shared/i18n/cs.ts` | add `diktator` UI strings |
| `vite.config.ts`, `index.html`, `README.md` | page entry, hub card, readme |
| `tests/diktator/*.test.ts`, `tests/diktator/helpers.ts` | tests; `helpers.ts` holds `scriptedDice` and state builders |

Conventions (match the repo): named exports, `readonly` in public types, short doc comments on exported things, Czech only in user-facing strings, conventional commits `feat(diktator): …`, `test(diktator): …`. Before the first task run `npm install` once (the worktree has no `node_modules`).

---

### Task 1: Groups, rules and dice

**Files:**
- Create: `src/games/diktator/logic/groups.ts`
- Create: `src/games/diktator/logic/rules.ts`
- Create: `src/games/diktator/logic/dice.ts`
- Create: `tests/diktator/helpers.ts`
- Test: `tests/diktator/dice.test.ts`

- [ ] **Step 1: Install dependencies**

Run: `npm install`
Expected: completes, `node_modules/` exists.

- [ ] **Step 2: Write the groups module**

`src/games/diktator/logic/groups.ts`:

```ts
// The eight groups of the original, in the original order (g$(1..8)): the first six have a strength,
// only the first three (the factions) can plot.

export const GROUPS = ['armada', 'rolnici', 'statkari', 'povstalci', 'jugoslavie', 'policie', 'italie', 'britanie'] as const;
export type GroupId = (typeof GROUPS)[number];

/** Groups 1–6: they have a strength as well as a popularity. */
export const STRENGTH_GROUPS = ['armada', 'rolnici', 'statkari', 'povstalci', 'jugoslavie', 'policie'] as const;
export type StrengthGroupId = (typeof STRENGTH_GROUPS)[number];

/** Groups 1–3: the only ones that petition and plot. */
export const FACTIONS = ['armada', 'rolnici', 'statkari'] as const;
export type FactionId = (typeof FACTIONS)[number];

/** Groups 7–8: foreign powers that can lend money (the original Russians and Americans). */
export const LENDERS = ['italie', 'britanie'] as const;
export type LenderId = (typeof LENDERS)[number];

/** The hostile neighbour that can invade (the original Leftoto). */
export const NEIGHBOUR = 'jugoslavie' satisfies StrengthGroupId;
export const POLICE = 'policie' satisfies StrengthGroupId;
export const REBELS = 'povstalci' satisfies StrengthGroupId;

export function hasStrength(g: GroupId): g is StrengthGroupId {
  return (STRENGTH_GROUPS as readonly string[]).includes(g);
}
```

- [ ] **Step 3: Write the rules module**

`src/games/diktator/logic/rules.ts`:

```ts
// Every number of the original Dictator (1983) BASIC in one place; see docs/diktator/research/original-rules.md.
// Money is in the original units (1 = 1 000). One turn is one quarter; per-turn values keep their original size.

export const RULES = {
  /** 1925-Q1 … 1939-Q1. */
  quarters: 57,
  firstYear: 1925,
  /** Popularity and strength are clamped to this range. */
  min: 0,
  max: 9,
  start: { pop: 7, str: 6, rebelsPop: 0, treasury: 1000, costs: 60, guard: 4 },
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
} as const;
```

- [ ] **Step 4: Write the dice module**

`src/games/diktator/logic/dice.ts`:

```ts
import { rand, type RngState } from '../../../shared/rng';

/** The only source of randomness in the logic. `int(n)` is INT(RND*n), `float()` is RND. */
export interface Dice {
  int(n: number): number;
  float(): number;
}

/** Dice backed by the seeded RNG stored in the game state (advances it). */
export function rngDice(r: RngState): Dice {
  return {
    int: (n) => Math.floor(rand(r) * n),
    float: () => rand(r),
  };
}
```

- [ ] **Step 5: Write the test helpers**

`tests/diktator/helpers.ts`:

```ts
import type { Dice } from '../../src/games/diktator/logic/dice';

/** Dice that return the given values in order; throws when a value is out of range or the script runs out. */
export function scriptedDice(values: readonly number[]): Dice & { readonly remaining: () => number } {
  let i = 0;
  const next = (): number => {
    if (i >= values.length) throw new Error('scripted dice exhausted');
    return values[i++];
  };
  return {
    int(n) {
      const v = next();
      if (!Number.isInteger(v) || v < 0 || v >= n) throw new Error(`scripted int ${v} not in 0..${n - 1}`);
      return v;
    },
    float() {
      const v = next();
      if (v < 0 || v >= 1) throw new Error(`scripted float ${v} not in [0, 1)`);
      return v;
    },
    remaining: () => values.length - i,
  };
}
```

- [ ] **Step 6: Write the test**

`tests/diktator/dice.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { rngDice } from '../../src/games/diktator/logic/dice';
import { makeRng } from '../../src/shared/rng';
import { scriptedDice } from './helpers';

describe('dice', () => {
  it('rngDice.int stays in 0..n-1 and is deterministic per seed', () => {
    const a = rngDice(makeRng(5));
    const b = rngDice(makeRng(5));
    const xs = Array.from({ length: 50 }, () => a.int(3));
    expect(xs).toEqual(Array.from({ length: 50 }, () => b.int(3)));
    expect(xs.every((x) => x >= 0 && x < 3)).toBe(true);
    expect(new Set(xs).size).toBe(3);
  });

  it('scriptedDice returns values in order and rejects bad ones', () => {
    const d = scriptedDice([2, 0.5, 7]);
    expect(d.int(3)).toBe(2);
    expect(d.float()).toBe(0.5);
    expect(() => d.int(3)).toThrow('not in 0..2');
    expect(() => d.int(3)).toThrow('exhausted');
  });
});
```

- [ ] **Step 7: Run the tests**

Run: `npx vitest run tests/diktator/dice.test.ts`
Expected: 2 passed.

- [ ] **Step 8: Commit**

```bash
git add src/games/diktator/logic tests/diktator
git commit -m "feat(diktator): groups, original rule constants and dice"
```

---

### Task 2: Records and effects

**Files:**
- Create: `src/games/diktator/logic/records.ts`
- Test: `tests/diktator/records.test.ts`

- [ ] **Step 1: Write the failing test**

`tests/diktator/records.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { affordable, applyEffects, clamp, type Effects } from '../../src/games/diktator/logic/records';

function stats() {
  return {
    pop: { armada: 7, rolnici: 7, statkari: 7, povstalci: 0, jugoslavie: 7, policie: 7, italie: 7, britanie: 7 },
    str: { armada: 6, rolnici: 6, statkari: 6, povstalci: 6, jugoslavie: 6, policie: 6 },
    treasury: 1000,
    costs: 60,
  };
}

describe('clamp', () => {
  it('keeps values in 0..9', () => {
    expect(clamp(-3)).toBe(0);
    expect(clamp(12)).toBe(9);
    expect(clamp(4)).toBe(4);
  });
});

describe('applyEffects (L1620–1664)', () => {
  it('adds popularity and strength, clamped, and moves money', () => {
    const s = stats();
    const e: Effects = { cost: -100, monthly: 5, pop: { armada: 4, rolnici: -9 }, str: { povstalci: -4 } };
    applyEffects(s, e);
    expect(s.pop.armada).toBe(9);
    expect(s.pop.rolnici).toBe(0);
    expect(s.str.povstalci).toBe(2);
    expect(s.treasury).toBe(900);
    expect(s.costs).toBe(65);
  });

  it('never lets costs go below zero', () => {
    const s = stats();
    s.costs = 3;
    applyEffects(s, { monthly: -10 });
    expect(s.costs).toBe(0);
  });
});

describe('affordable (cash check L2020–2022)', () => {
  it('is affordable whenever treasury + cost stays positive', () => {
    expect(affordable(200, { cost: -120 })).toBe(true);
    expect(affordable(100, { cost: -100 })).toBe(false);
  });
  it('a rising monthly cost with an empty treasury is unaffordable', () => {
    expect(affordable(0, { monthly: 5 })).toBe(false);
    expect(affordable(10, { monthly: 5 })).toBe(true);
  });
  it('no money involved is always affordable', () => {
    expect(affordable(-50, {})).toBe(true);
    expect(affordable(-50, { pop: { armada: 3 } })).toBe(true);
  });
  it('income is affordable even when broke', () => {
    expect(affordable(-50, { cost: 100 })).toBe(true);
    expect(affordable(-50, { cost: 30, monthly: -5 })).toBe(true);
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run tests/diktator/records.test.ts`
Expected: FAIL — cannot resolve `records`.

- [ ] **Step 3: Implement**

`src/games/diktator/logic/records.ts`:

```ts
import type { FactionId, GroupId, LenderId, StrengthGroupId } from './groups';
import { RULES } from './rules';

/**
 * What a record does. `cost` is the one-off change to the treasury (+ adds money, − costs money);
 * `monthly` is the change to the per-turn costs (+ = costs rise). Deltas are clamped to 0..9 when applied.
 */
export interface Effects {
  readonly cost?: number;
  readonly monthly?: number;
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
}

/**
 * The original cash check (L2020–2022). In the original `mcst` is the negated monthly change, so
 * `bk + mcst` is `treasury - monthly` here.
 */
export function affordable(treasury: number, e: Effects): boolean {
  const cost = e.cost ?? 0;
  const monthly = e.monthly ?? 0;
  if (treasury + cost > 0) return true;
  if ((cost < 0 || monthly > 0) && (treasury + cost < 0 || treasury - monthly < 0)) return false;
  return true;
}
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run tests/diktator/records.test.ts`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/games/diktator/logic/records.ts tests/diktator/records.test.ts
git commit -m "feat(diktator): record types, effects and the original cash check"
```

---

### Task 3: Game state and scenario interface

**Files:**
- Create: `src/games/diktator/logic/state.ts`
- Create: `src/games/diktator/logic/scenario.ts`
- Test: `tests/diktator/state.test.ts`

- [ ] **Step 1: Write the scenario interface**

`src/games/diktator/logic/scenario.ts`:

```ts
import type { GroupId } from './groups';
import type { Decision, NewsItem, Petition } from './records';

/** Everything country-specific. The logic never imports a scenario directly; it receives one. */
export interface Scenario {
  readonly id: string;
  readonly groupNames: Readonly<Record<GroupId, string>>;
  readonly petitions: readonly Petition[];
  readonly decisions: readonly Decision[];
  readonly news: readonly NewsItem[];
}
```

- [ ] **Step 2: Write the failing test**

`tests/diktator/state.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { initialState } from '../../src/games/diktator/logic/state';

describe('initialState (L140–L244)', () => {
  it('uses the original starting values', () => {
    const s = initialState(42);
    expect(s.version).toBe(1);
    expect(s.quarter).toBe(0);
    expect(s.treasury).toBe(1000);
    expect(s.costs).toBe(60);
    expect(s.guard).toBe(4);
    expect(s.swiss).toBe(0);
    expect(s.pop).toEqual({ armada: 7, rolnici: 7, statkari: 7, povstalci: 0, jugoslavie: 7, policie: 7, italie: 7, britanie: 7 });
    expect(s.str).toEqual({ armada: 6, rolnici: 6, statkari: 6, povstalci: 6, jugoslavie: 6, policie: 6 });
    expect(s.plots).toEqual({ armada: { kind: 'none' }, rolnici: { kind: 'none' }, statkari: { kind: 'none' } });
    expect(s.hasPlane).toBe(false);
    expect(s.used).toEqual({});
  });

  it('applies a starting regime over the defaults', () => {
    const s = initialState(1, { pop: { armada: 5 }, str: { povstalci: 3 }, treasury: 800 });
    expect(s.pop.armada).toBe(5);
    expect(s.pop.rolnici).toBe(7);
    expect(s.str.povstalci).toBe(3);
    expect(s.treasury).toBe(800);
  });

  it('is plain JSON (survives a round trip)', () => {
    const s = initialState(7);
    expect(JSON.parse(JSON.stringify(s))).toEqual(s);
  });
});
```

- [ ] **Step 3: Run it to see it fail**

Run: `npx vitest run tests/diktator/state.test.ts`
Expected: FAIL — cannot resolve `state`.

- [ ] **Step 4: Implement**

`src/games/diktator/logic/state.ts`:

```ts
import { makeRng, type RngState } from '../../../shared/rng';
import { GROUPS, STRENGTH_GROUPS, type FactionId, type GroupId, type LenderId, type StrengthGroupId } from './groups';
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
  readonly version: 1;
  readonly seed: number;
  rng: RngState;
  /** 0 before the first turn; 1 = 1925-Q1 … 57 = 1939-Q1. The original's `mth`. */
  quarter: number;
  pop: Record<GroupId, number>;
  str: Record<StrengthGroupId, number>;
  plots: Record<FactionId, Plot>;
  treasury: number;
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
  decisionTaken: boolean;
  phase: Phase;
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
  | { readonly type: 'costsPaid'; readonly amount: number }
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
  | { readonly type: 'ended'; readonly ending: Ending };

export type Command =
  | { readonly type: 'answer'; readonly answer: 'yes' | 'no' | 'goAway' | 'suggestOther' }
  | { readonly type: 'policeReport' }
  /** `share` only for the Swiss account: send 1/share of the treasury (1, 2, 3 or 4; the original is 2). */
  | { readonly type: 'decide'; readonly decision: string; readonly share?: 1 | 2 | 3 | 4 }
  | { readonly type: 'endDay' }
  | { readonly type: 'flee' }
  | { readonly type: 'fight' }
  | { readonly type: 'ally'; readonly group: StrengthGroupId }
  | { readonly type: 'punish'; readonly punish: boolean };

function record<K extends string>(keys: readonly K[], v: (k: K) => number): Record<K, number> {
  return Object.fromEntries(keys.map((k) => [k, v(k)])) as Record<K, number>;
}

/** The state before the first turn (L140–L244), optionally with a starting regime. */
export function initialState(seed: number, regime: StartingRegime = {}): GameState {
  const st = RULES.start;
  return {
    version: 1,
    seed,
    rng: makeRng(seed),
    quarter: 0,
    pop: record(GROUPS, (g) => regime.pop?.[g] ?? (g === 'povstalci' ? st.rebelsPop : st.pop)),
    str: record(STRENGTH_GROUPS, (g) => regime.str?.[g] ?? st.str),
    plots: { armada: { kind: 'none' }, rolnici: { kind: 'none' }, statkari: { kind: 'none' } },
    treasury: regime.treasury ?? st.treasury,
    costs: st.costs,
    guard: st.guard,
    swiss: 0,
    low: RULES.lowBase,
    threshold: RULES.thresholdBase,
    plotPauseUntil: 0,
    hasPlane: false,
    used: {},
    decisionTaken: false,
    phase: { kind: 'day' },
  };
}
```

- [ ] **Step 5: Run the tests**

Run: `npx vitest run tests/diktator/state.test.ts`
Expected: 3 passed.

- [ ] **Step 6: Commit**

```bash
git add src/games/diktator/logic/state.ts src/games/diktator/logic/scenario.ts tests/diktator/state.test.ts
git commit -m "feat(diktator): game state, events, commands and scenario interface"
```

---

### Task 4: The Albania scenario data (the 49 original records)

The numbers are the original's (see `docs/diktator/research/original-rules.md` §3–§5) with the groups renamed:
Army → `armada`, Peasants → `rolnici`, Landowners → `statkari`, Guerillas → `povstalci`, Leftoto → `jugoslavie`,
Secret Police → `policie`, Russians → `italie`, Americans → `britanie`. Monthly-cost signs follow the reference
table ("Mo +5" = costs rise = `monthly: 5`).

**Files:**
- Create: `src/games/diktator/scenario/albania/groups.ts`
- Create: `src/games/diktator/scenario/albania/records.ts`
- Create: `src/games/diktator/scenario/albania/index.ts`
- Test: `tests/diktator/scenario.test.ts`

- [ ] **Step 1: Write the failing validator test**

`tests/diktator/scenario.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { GROUPS, STRENGTH_GROUPS } from '../../src/games/diktator/logic/groups';
import type { Effects } from '../../src/games/diktator/logic/records';
import { albania } from '../../src/games/diktator/scenario/albania';

function checkEffects(e: Effects, where: string) {
  for (const [g, d] of Object.entries(e.pop ?? {})) {
    expect((GROUPS as readonly string[]).includes(g), `${where}: pop group ${g}`).toBe(true);
    expect(Math.abs(d as number), `${where}: pop ${g}`).toBeLessThanOrEqual(9);
  }
  for (const [g, d] of Object.entries(e.str ?? {})) {
    expect((STRENGTH_GROUPS as readonly string[]).includes(g), `${where}: str group ${g}`).toBe(true);
    expect(Math.abs(d as number), `${where}: str ${g}`).toBeLessThanOrEqual(9);
  }
}

describe('albania scenario data', () => {
  it('has the original counts: 24 petitions (8 per faction), 19 decisions, 6 news', () => {
    expect(albania.petitions).toHaveLength(24);
    expect(albania.petitions.filter((p) => p.from === 'armada')).toHaveLength(8);
    expect(albania.petitions.filter((p) => p.from === 'rolnici')).toHaveLength(8);
    expect(albania.petitions.filter((p) => p.from === 'statkari')).toHaveLength(8);
    expect(albania.decisions).toHaveLength(19);
    expect(albania.news).toHaveLength(6);
  });

  it('has unique ids and valid effects everywhere', () => {
    const all = [...albania.petitions, ...albania.decisions, ...albania.news];
    expect(new Set(all.map((r) => r.id)).size).toBe(all.length);
    for (const r of all) {
      expect(r.title.length, r.id).toBeGreaterThan(0);
      expect(r.origin, r.id).toBe('original');
      checkEffects(r.effects, r.id);
    }
  });

  it('keeps spot-checked original numbers', () => {
    const p = (id: string) => albania.petitions.find((x) => x.id === id)!;
    const d = (id: string) => albania.decisions.find((x) => x.id === id)!;
    expect(p('p01').effects).toEqual({ monthly: 5, pop: { armada: 4, rolnici: -3, statkari: -1 }, str: { armada: 3, rolnici: -2, statkari: -1 } });
    expect(p('p24').effects.cost).toBe(-120);
    expect(p('p24').effects.monthly).toBe(10);
    expect(d('d40').effects.cost).toBe(130);
    expect(d('d35').special).toEqual({ kind: 'bodyguard' });
    expect(d('d35').reusable).toBe(true);
    expect(d('d37').reusable).toBe(true);
    expect(d('d38').special).toEqual({ kind: 'aid', lender: 'italie' });
    expect(d('d39').special).toEqual({ kind: 'aid', lender: 'britanie' });
  });

  it('decisions are in the original sections', () => {
    const sections = albania.decisions.map((d) => d.section);
    expect(sections).toEqual([1, 1, 1, 1, 1, 1, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 5, 5, 5]);
  });

  it('names every group', () => {
    for (const g of GROUPS) expect(albania.groupNames[g].length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run tests/diktator/scenario.test.ts`
Expected: FAIL — cannot resolve `scenario/albania`.

- [ ] **Step 3: Write the group names**

`src/games/diktator/scenario/albania/groups.ts`:

```ts
import type { GroupId } from '../../logic/groups';

/** Bar labels: plain Czech, close to the original; Albanian terms stay in flavour text. */
export const GROUP_NAMES: Readonly<Record<GroupId, string>> = {
  armada: 'Armáda',
  rolnici: 'Rolníci',
  statkari: 'Statkáři',
  povstalci: 'Povstalci',
  jugoslavie: 'Jugoslávie',
  policie: 'Tajná policie',
  italie: 'Itálie',
  britanie: 'Británie',
};
```

- [ ] **Step 4: Write the records**

`src/games/diktator/scenario/albania/records.ts`:

```ts
// The 49 records of the 1983 original with their original numbers (docs/diktator/research/original-rules.md),
// re-themed for Zog's Albania. Russians → Itálie, Americans → Británie, Leftoto → Jugoslávie.

import type { Decision, NewsItem, Petition } from '../../logic/records';

export const PETITIONS: readonly Petition[] = [
  // Armáda (1–8)
  { id: 'p01', from: 'armada', origin: 'original', title: 'Zavést povinnou vojenskou službu',
    effects: { monthly: 5, pop: { armada: 4, rolnici: -3, statkari: -1 }, str: { armada: 3, rolnici: -2, statkari: -1 } } },
  { id: 'p02', from: 'armada', origin: 'original', title: 'Zabrat statkářům půdu pro cvičiště',
    effects: { pop: { armada: 3, statkari: -3 }, str: { armada: 1, statkari: -1 } } },
  { id: 'p03', from: 'armada', origin: 'original', title: 'Zaútočit na všechny tábory povstalců v horách',
    effects: { cost: -100, pop: { armada: 3, rolnici: -1, statkari: 1, jugoslavie: -1, italie: -1 }, str: { armada: 1, statkari: 1, povstalci: -4 } } },
  { id: 'p04', from: 'armada', origin: 'original', title: 'Zaútočit na tábory povstalců za jugoslávskou hranicí',
    effects: { cost: -80, pop: { armada: 3, rolnici: -1, jugoslavie: -4, italie: -1 }, str: { armada: 1, statkari: 1, povstalci: -2 } } },
  { id: 'p05', from: 'armada', origin: 'original', title: 'Odvolat velitele tajné policie',
    effects: { pop: { armada: 4, rolnici: 2, statkari: 1, policie: -4 }, str: { armada: 1, statkari: 1, policie: -3 } } },
  { id: 'p06', from: 'armada', origin: 'original', title: 'Vyhostit italské vojenské poradce',
    effects: { pop: { armada: 3, jugoslavie: -1, italie: -4, britanie: 2 } } },
  { id: 'p07', from: 'armada', origin: 'original', title: 'Zvýšit vojákům žold',
    effects: { monthly: 9, pop: { armada: 4, statkari: -1 }, str: { armada: 2, rolnici: -1, statkari: -1, povstalci: -1 } } },
  { id: 'p08', from: 'armada', origin: 'original', title: 'Nakoupit více pušek a střeliva',
    effects: { cost: -120, pop: { armada: 4, rolnici: -1, statkari: -1, jugoslavie: -1, policie: -1 }, str: { armada: 3, rolnici: -1, statkari: -1, povstalci: -2, jugoslavie: -1 } } },
  // Rolníci (9–16)
  { id: 'p09', from: 'rolnici', origin: 'original', title: 'Zastavit násilné odvody mladých mužů do armády',
    effects: { pop: { armada: -1, rolnici: 2, statkari: 1 }, str: { armada: -1, povstalci: -1 } } },
  { id: 'p10', from: 'rolnici', origin: 'original', title: 'Zvýšit nejnižší mzdu',
    effects: { pop: { rolnici: 4, statkari: -4, jugoslavie: 1 }, str: { rolnici: 2, statkari: -1 } } },
  { id: 'p11', from: 'rolnici', origin: 'original', title: 'Omezit pravomoci tajné policie',
    effects: { monthly: -3, pop: { armada: 1, rolnici: 4, statkari: 2, policie: -4 }, str: { armada: 1, rolnici: 1, statkari: 1, povstalci: 1, policie: -3 } } },
  { id: 'p12', from: 'rolnici', origin: 'original', title: 'Nepouštět k nám dělníky z Jugoslávie',
    effects: { pop: { rolnici: 3, statkari: -2, jugoslavie: -2 }, str: { rolnici: 2, statkari: -2 } } },
  { id: 'p13', from: 'rolnici', origin: 'original', title: 'Zavést bezplatné školy pro všechny děti',
    effects: { cost: -100, monthly: 8, pop: { armada: -1, rolnici: 4, statkari: -2, jugoslavie: 2, policie: -1, italie: 1 }, str: { rolnici: 1, statkari: -1, povstalci: -1 } } },
  { id: 'p14', from: 'rolnici', origin: 'original', title: 'Povolit rolnické spolky a odbory',
    effects: { pop: { rolnici: 4, statkari: -3, jugoslavie: 1, policie: -1, italie: 1 }, str: { rolnici: 3, statkari: -3, policie: -1 } } },
  { id: 'p15', from: 'rolnici', origin: 'original', title: 'Propustit jejich uvězněného vůdce',
    effects: { pop: { armada: -1, rolnici: 4, statkari: -2, jugoslavie: 1, policie: -1 }, str: { rolnici: 2, statkari: -1, povstalci: -1 } } },
  { id: 'p16', from: 'rolnici', origin: 'original', title: 'Založit státní loterii',
    effects: { monthly: -6, pop: { rolnici: 3, statkari: -1 }, str: { povstalci: -1 } } },
  // Statkáři (17–24)
  { id: 'p17', from: 'statkari', origin: 'original', title: 'Zakázat armádě cvičit na jejich pozemcích',
    effects: { pop: { armada: -2, statkari: 3 }, str: { armada: -1 } } },
  { id: 'p18', from: 'statkari', origin: 'original', title: 'Snížit nejnižší mzdu',
    effects: { pop: { rolnici: -4, statkari: 4, jugoslavie: -1, italie: -1 }, str: { rolnici: -2, statkari: 2, povstalci: 1 } } },
  { id: 'p19', from: 'statkari', origin: 'original', title: 'Znárodnit britské podniky',
    effects: { cost: 100, monthly: 5, pop: { statkari: 3, jugoslavie: 1, italie: 2, britanie: -4 }, str: { statkari: 1 } } },
  { id: 'p20', from: 'statkari', origin: 'original', title: 'Uvalit clo na všechno zboží z Jugoslávie',
    effects: { monthly: -5, pop: { statkari: 3, jugoslavie: -3, italie: -1 }, str: { rolnici: 1, statkari: 2, jugoslavie: -1 } } },
  { id: 'p21', from: 'statkari', origin: 'original', title: 'Snížit výdaje na tajnou policii',
    effects: { monthly: -4, pop: { armada: 1, rolnici: 1, statkari: 3, policie: -4 }, str: { armada: 1, statkari: 1, povstalci: 1, policie: -2 } } },
  { id: 'p22', from: 'statkari', origin: 'original', title: 'Snížit vysoké pozemkové daně',
    effects: { monthly: 5, pop: { statkari: 4 }, str: { statkari: 2 } } },
  { id: 'p23', from: 'statkari', origin: 'original', title: 'Poslat vojáky pracovat na pole',
    effects: { pop: { armada: -2, rolnici: -1, statkari: 3 }, str: { armada: -1, rolnici: -1, statkari: 1, povstalci: 1 } } },
  { id: 'p24', from: 'statkari', origin: 'original', title: 'Postavit velké zavlažovací kanály',
    effects: { cost: -120, monthly: 10, pop: { armada: 1, rolnici: 1, statkari: 3, jugoslavie: -3, italie: 2, britanie: 1 }, str: { statkari: 3, jugoslavie: -2 } } },
];

export const DECISIONS: readonly Decision[] = [
  // 1 Please a group
  { id: 'd25', section: 1, origin: 'original', title: 'Jmenovat velitele armády svým zástupcem',
    effects: { pop: { armada: 4, rolnici: -1, statkari: -1, policie: -1 }, str: { armada: 1, povstalci: -1, policie: -1 } } },
  { id: 'd26', section: 1, origin: 'original', title: 'Zřídit bezplatné ošetřovny pro dělníky',
    effects: { cost: -10, monthly: 4, pop: { armada: -1, rolnici: 4, statkari: 1, jugoslavie: 2, italie: 1 }, str: { povstalci: -1 } } },
  { id: 'd27', section: 1, origin: 'original', title: 'Dát statkářům moc v krajích',
    effects: { pop: { armada: -1, rolnici: -2, statkari: 4, policie: -1, italie: -1 }, str: { armada: -1, rolnici: -1, statkari: 2, policie: -1 } } },
  { id: 'd28', section: 1, origin: 'original', title: 'Prodat britské zbraně Jugoslávii',
    effects: { cost: 50, pop: { armada: -2, jugoslavie: 4, italie: -2, britanie: 1 }, str: { armada: -1, povstalci: -1, jugoslavie: 3 } } },
  { id: 'd29', section: 1, origin: 'original', title: 'Prodat Britům právo těžit naftu',
    effects: { cost: 120, pop: { statkari: -1, jugoslavie: -1, italie: -2, britanie: 3 } } },
  { id: 'd30', section: 1, origin: 'original', title: 'Pronajmout Italům ostrov Sazan pro námořnictvo',
    effects: { monthly: -10, pop: { armada: -2, italie: 3, britanie: -3 }, str: { jugoslavie: 1 } } },
  // 2 Please all groups
  { id: 'd31', section: 2, origin: 'original', title: 'Snížit daně všem',
    effects: { monthly: 8, pop: { armada: 1, rolnici: 3, statkari: 3 }, str: { armada: -1, povstalci: -1 } } },
  { id: 'd32', section: 2, origin: 'original', title: 'Uspořádat velkou oslavnou kampaň',
    effects: { cost: -80, pop: { armada: 3, rolnici: 3, statkari: 3 }, str: { povstalci: -1 } } },
  { id: 'd33', section: 2, origin: 'original', title: 'Úplně zrušit pravomoci tajné policie',
    effects: { monthly: -8, pop: { armada: 3, rolnici: 3, statkari: 3, policie: -9 }, str: { armada: 2, rolnici: 1, statkari: 1, povstalci: 1, policie: -9 } } },
  // 3 Improve your chances
  { id: 'd34', section: 3, origin: 'original', title: 'Výrazně posílit tajnou policii',
    effects: { monthly: 6, pop: { armada: -3, rolnici: -3, statkari: -3, policie: 8 }, str: { armada: -1, rolnici: -1, statkari: -1, povstalci: -1, policie: 8 } } },
  { id: 'd35', section: 3, origin: 'original', title: 'Posílit osobní stráž', special: { kind: 'bodyguard' }, reusable: true,
    effects: { cost: -40, pop: { armada: -2, rolnici: -1, statkari: -1, policie: -1 }, str: { armada: -2, policie: -1 } } },
  { id: 'd36', section: 3, origin: 'original', title: 'Koupit letadlo pro útěk', special: { kind: 'plane' },
    effects: { cost: -120, pop: { armada: -4, rolnici: -4, statkari: -3, policie: -2 } } },
  { id: 'd37', section: 3, origin: 'original', title: 'Poslat peníze na švýcarský účet', special: { kind: 'swiss' }, reusable: true,
    effects: {} },
  // 4 Raise some cash
  { id: 'd38', section: 4, origin: 'original', title: 'Požádat Itálii o půjčku', special: { kind: 'aid', lender: 'italie' },
    effects: {} },
  { id: 'd39', section: 4, origin: 'original', title: 'Požádat Británii o pomoc', special: { kind: 'aid', lender: 'britanie' },
    effects: {} },
  { id: 'd40', section: 4, origin: 'original', title: 'Znárodnit jugoslávské podniky',
    effects: { cost: 130, pop: { armada: 1, rolnici: 1, statkari: 3, jugoslavie: -6, italie: -2 } } },
  // 5 Strengthen a group
  { id: 'd41', section: 5, origin: 'original', title: 'Koupit armádě těžká děla',
    effects: { cost: -50, pop: { armada: 3, jugoslavie: -3, italie: -1 }, str: { armada: 5, povstalci: -2, jugoslavie: -2, policie: -1 } } },
  { id: 'd42', section: 5, origin: 'original', title: 'Dovolit rolníkům volně se stěhovat',
    effects: { pop: { rolnici: 3, statkari: -1, policie: -1 }, str: { rolnici: 5, statkari: -1, povstalci: 3, policie: -1 } } },
  { id: 'd43', section: 5, origin: 'original', title: 'Dovolit statkářům soukromé ozbrojené družiny',
    effects: { pop: { armada: -1, rolnici: -1, statkari: 3, policie: -1 }, str: { armada: -1, rolnici: -1, statkari: 5, povstalci: -1, policie: -1 } } },
];

export const NEWS: readonly NewsItem[] = [
  { id: 'n44', origin: 'original', title: 'Král ztratil tajné spisy četnictva',
    effects: { pop: { policie: -4 }, str: { povstalci: 4, policie: -4 } } },
  { id: 'n45', origin: 'original', title: 'Exulanti v Bari vyzbrojili a vycvičili povstalce',
    effects: { str: { armada: -1, povstalci: 9 } } },
  { id: 'n46', origin: 'original', title: 'Neštěstí: vybuchla kasárna',
    effects: { str: { armada: -4, povstalci: 2, policie: 1 } } },
  { id: 'n47', origin: 'original', title: 'Ceny tabáku klesly o 98 %',
    effects: { str: { statkari: -3, jugoslavie: -2 } } },
  { id: 'n48', origin: 'original', title: 'Velké zemětřesení v Jugoslávii',
    effects: { str: { statkari: 2, jugoslavie: -4 } } },
  { id: 'n49', origin: 'original', title: 'Vesnice zasáhla epidemie',
    effects: { str: { rolnici: -4, statkari: -1, povstalci: -2 } } },
];
```

- [ ] **Step 5: Write the scenario object**

`src/games/diktator/scenario/albania/index.ts`:

```ts
import type { Scenario } from '../../logic/scenario';
import { GROUP_NAMES } from './groups';
import { DECISIONS, NEWS, PETITIONS } from './records';

export const albania: Scenario = {
  id: 'albania',
  groupNames: GROUP_NAMES,
  petitions: PETITIONS,
  decisions: DECISIONS,
  news: NEWS,
};
```

- [ ] **Step 6: Run the tests**

Run: `npx vitest run tests/diktator/scenario.test.ts`
Expected: 5 passed. If a spot check fails, compare that record with `docs/diktator/research/original-rules.md` and fix the data, not the test.

- [ ] **Step 7: Commit**

```bash
git add src/games/diktator/scenario tests/diktator/scenario.test.ts
git commit -m "feat(diktator): Albania scenario with the 49 original records"
```

---

### Task 5: Plots

**Files:**
- Create: `src/games/diktator/logic/plot.ts`
- Test: `tests/diktator/plot.test.ts`

- [ ] **Step 1: Write the failing test**

`tests/diktator/plot.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { formPlots } from '../../src/games/diktator/logic/plot';
import { initialState } from '../../src/games/diktator/logic/state';

function state() {
  const s = initialState(1);
  s.quarter = 5;
  s.low = 3;
  s.threshold = 11;
  return s;
}

describe('formPlots (L1400)', () => {
  it('does nothing in the first two turns', () => {
    const s = state();
    s.quarter = 2;
    s.pop.armada = 0;
    s.plots.armada = { kind: 'assassination' };
    formPlots(s);
    expect(s.plots.armada).toEqual({ kind: 'assassination' });
  });

  it('clears plots of happy factions', () => {
    const s = state();
    s.plots.rolnici = { kind: 'assassination' };
    formPlots(s);
    expect(s.plots.rolnici).toEqual({ kind: 'none' });
  });

  it('clears plots but forms none while paused', () => {
    const s = state();
    s.pop.armada = 1;
    s.plots.armada = { kind: 'assassination' };
    s.plotPauseUntil = 6;
    formPlots(s);
    expect(s.plots.armada).toEqual({ kind: 'none' });
  });

  it('an unhappy faction with a strong enough hostile partner plans a revolution with the first such partner', () => {
    const s = state();
    s.pop.armada = 2;
    s.str.armada = 6;
    // povstalci (pop 0, str 6): 6 + 6 >= 11 → first hostile partner in order 1..6
    formPlots(s);
    expect(s.plots.armada).toEqual({ kind: 'revolution', ally: 'povstalci' });
  });

  it('prefers an earlier group as partner', () => {
    const s = state();
    s.pop.armada = 2;
    s.pop.rolnici = 3;
    s.str.rolnici = 5;
    formPlots(s);
    expect(s.plots.armada).toEqual({ kind: 'revolution', ally: 'rolnici' });
  });

  it('without a strong enough partner it plans an assassination', () => {
    const s = state();
    s.pop.statkari = 3;
    s.str.statkari = 2;
    s.str.povstalci = 2;
    formPlots(s);
    expect(s.plots.statkari).toEqual({ kind: 'assassination' });
  });

  it('a faction never partners with itself', () => {
    const s = state();
    s.pop.armada = 0;
    s.str.armada = 9;
    s.str.povstalci = 0;
    s.pop.jugoslavie = 9;
    s.pop.policie = 9;
    formPlots(s);
    expect(s.plots.armada).toEqual({ kind: 'assassination' });
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run tests/diktator/plot.test.ts`
Expected: FAIL — cannot resolve `plot`.

- [ ] **Step 3: Implement**

`src/games/diktator/logic/plot.ts`:

```ts
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
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run tests/diktator/plot.test.ts`
Expected: 7 passed.

- [ ] **Step 5: Commit**

```bash
git add src/games/diktator/logic/plot.ts tests/diktator/plot.test.ts
git commit -m "feat(diktator): plot formation"
```

---

### Task 6: Money and the police report

**Files:**
- Create: `src/games/diktator/logic/money.ts`
- Create: `src/games/diktator/logic/police.ts`
- Test: `tests/diktator/money.test.ts`

- [ ] **Step 1: Write the failing test**

`tests/diktator/money.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { settleTreasury } from '../../src/games/diktator/logic/money';
import { policeReport } from '../../src/games/diktator/logic/police';
import { initialState, type GameEvent } from '../../src/games/diktator/logic/state';

describe('settleTreasury (L618–620, L900)', () => {
  it('pays the costs when there is money', () => {
    const s = initialState(1);
    const ev: GameEvent[] = [];
    settleTreasury(s, ev);
    expect(s.treasury).toBe(940);
    expect(ev).toEqual([{ type: 'costsPaid', amount: 60 }]);
  });

  it('pays nothing at exactly zero, and can go negative when paying', () => {
    const s = initialState(1);
    s.treasury = 0;
    settleTreasury(s, []);
    expect(s.treasury).toBe(0);
    s.treasury = 10;
    settleTreasury(s, []);
    expect(s.treasury).toBe(-50);
  });

  it('bankruptcy hits army, police and the bodyguard, floored at zero, and pays nothing', () => {
    const s = initialState(1);
    s.treasury = -5;
    s.pop.armada = 0;
    const ev: GameEvent[] = [];
    settleTreasury(s, ev);
    expect(s.pop.armada).toBe(0);
    expect(s.pop.policie).toBe(6);
    expect(s.str.policie).toBe(5);
    expect(s.guard).toBe(3);
    expect(s.treasury).toBe(-5);
    expect(ev).toEqual([{ type: 'bankrupt' }]);
  });
});

describe('policeReport (L1700)', () => {
  it('costs 1 and shows everything', () => {
    const s = initialState(1);
    s.low = 3;
    const ev: GameEvent[] = [];
    policeReport(s, ev);
    expect(s.treasury).toBe(999);
    expect(ev[0].type).toBe('policeReport');
  });

  it('is refused when broke or when the police are hostile or weak', () => {
    const s = initialState(1);
    s.low = 3;
    s.treasury = 0;
    const ev: GameEvent[] = [];
    policeReport(s, ev);
    expect(ev).toEqual([{ type: 'policeReportRefused', reason: 'noMoney' }]);
    s.treasury = 100;
    s.str.policie = 3;
    policeReport(s, ev);
    expect(ev[1]).toEqual({ type: 'policeReportRefused', reason: 'policeHostile' });
    expect(s.treasury).toBe(100);
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run tests/diktator/money.test.ts`
Expected: FAIL — cannot resolve `money`.

- [ ] **Step 3: Implement money**

`src/games/diktator/logic/money.ts`:

```ts
import { formPlots } from './plot';
import type { GameEvent, GameState } from './state';

/**
 * Start-of-turn money (L618–620): a negative treasury is bankrupt (army and police popularity, police
 * strength and the bodyguard drop by 1, then plots re-form); a positive treasury pays the per-turn costs.
 */
export function settleTreasury(s: GameState, events: GameEvent[]): void {
  if (s.treasury < 0) {
    s.pop.armada = Math.max(0, s.pop.armada - 1);
    s.pop.policie = Math.max(0, s.pop.policie - 1);
    s.str.policie = Math.max(0, s.str.policie - 1);
    s.guard = Math.max(0, s.guard - 1);
    events.push({ type: 'bankrupt' });
    formPlots(s);
  }
  if (s.treasury > 0) {
    s.treasury -= s.costs;
    events.push({ type: 'costsPaid', amount: s.costs });
  }
}
```

- [ ] **Step 4: Implement the police report**

`src/games/diktator/logic/police.ts`:

```ts
import { RULES } from './rules';
import type { GameEvent, GameState } from './state';

/** The secret police report (L1700–1772): needs money and a friendly, strong police; costs 1. */
export function policeReport(s: GameState, events: GameEvent[]): void {
  if (s.treasury <= 0) {
    events.push({ type: 'policeReportRefused', reason: 'noMoney' });
    return;
  }
  if (s.pop.policie <= s.low || s.str.policie <= s.low) {
    events.push({ type: 'policeReportRefused', reason: 'policeHostile' });
    return;
  }
  s.treasury -= RULES.policeReportCost;
  events.push({
    type: 'policeReport',
    report: {
      pop: { ...s.pop },
      str: { ...s.str },
      plots: { ...s.plots },
      guard: s.guard,
      low: s.low,
      threshold: s.threshold,
    },
  });
}
```

- [ ] **Step 5: Run the tests**

Run: `npx vitest run tests/diktator/money.test.ts`
Expected: 5 passed.

- [ ] **Step 6: Commit**

```bash
git add src/games/diktator/logic/money.ts src/games/diktator/logic/police.ts tests/diktator/money.test.ts
git commit -m "feat(diktator): treasury, bankruptcy and the police report"
```

---

### Task 7: Audience

**Files:**
- Create: `src/games/diktator/logic/audience.ts`
- Test: `tests/diktator/audience.test.ts`

Rules: the draw picks a random start and scans cyclically for an unused petition; if all are used it resets them and draws again (L630–648). A drawn petition is marked used immediately. Answers:
`yes` — cash check; affordable → apply the effects; unaffordable → forced no. `no` (and forced no) — the petitioner's popularity drops by the amount accepting would have given it, clamped 0..9 (L740–750). `goAway` (our addition from the remake) — petitioner −1, the petition is un-marked so it can come back. `suggestOther` (our addition) — once per audience: un-mark the current petition and draw another unused one from the same faction; throws if there is none.

- [ ] **Step 1: Write the failing test**

`tests/diktator/audience.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { answerPetition, drawPetition, suggestOther } from '../../src/games/diktator/logic/audience';
import { initialState, type GameEvent } from '../../src/games/diktator/logic/state';
import { albania } from '../../src/games/diktator/scenario/albania';
import { scriptedDice } from './helpers';

describe('drawPetition (L630–648)', () => {
  it('takes the petition at the rolled index and marks it used', () => {
    const s = initialState(1);
    const id = drawPetition(albania, s, scriptedDice([4]));
    expect(id).toBe('p05');
    expect(s.used.p05).toBe(true);
  });

  it('steps forward cyclically past used petitions', () => {
    const s = initialState(1);
    s.used.p24 = true;
    s.used.p01 = true;
    expect(drawPetition(albania, s, scriptedDice([23]))).toBe('p02');
  });

  it('resets all petitions when every one is used, then draws again', () => {
    const s = initialState(1);
    for (const p of albania.petitions) s.used[p.id] = true;
    s.used.d25 = true;
    expect(drawPetition(albania, s, scriptedDice([0, 9]))).toBe('p10');
    expect(Object.keys(s.used).sort()).toEqual(['d25', 'p10']);
  });
});

describe('answerPetition (L694–766)', () => {
  it('yes applies the effects', () => {
    const s = initialState(1);
    const ev: GameEvent[] = [];
    answerPetition(albania, s, 'p03', 'yes', ev);
    expect(s.treasury).toBe(900);
    expect(s.str.povstalci).toBe(2);
    expect(ev).toEqual([{ type: 'answered', id: 'p03', answer: 'yes' }]);
  });

  it('no lowers the petitioner by what it would have gained', () => {
    const s = initialState(1);
    answerPetition(albania, s, 'p07', 'no', []);
    expect(s.pop.armada).toBe(3);
    expect(s.costs).toBe(60);
  });

  it('refusing a petition that would have cost the petitioner raises it (original behaviour), clamped', () => {
    const s = initialState(1);
    s.pop.armada = 9;
    answerPetition(albania, s, 'p09', 'no', []); // p09 gives armada -1
    expect(s.pop.armada).toBe(9);
    s.pop.armada = 5;
    answerPetition(albania, s, 'p09', 'no', []);
    expect(s.pop.armada).toBe(6);
  });

  it('an unaffordable yes becomes a forced no', () => {
    const s = initialState(1);
    s.treasury = 50;
    const ev: GameEvent[] = [];
    answerPetition(albania, s, 'p08', 'yes', ev);
    expect(ev).toEqual([{ type: 'forcedNo', id: 'p08' }]);
    expect(s.treasury).toBe(50);
    expect(s.pop.armada).toBe(3);
  });

  it('goAway costs 1 popularity and returns the petition to the deck', () => {
    const s = initialState(1);
    s.used.p10 = true;
    answerPetition(albania, s, 'p10', 'goAway', []);
    expect(s.pop.rolnici).toBe(6);
    expect(s.used.p10).toBeUndefined();
  });
});

describe('suggestOther', () => {
  it('returns the current petition and draws another from the same faction', () => {
    const s = initialState(1);
    s.used.p10 = true;
    const id = suggestOther(albania, s, 'p10', scriptedDice([0]));
    expect(id).toBe('p09');
    expect(s.used.p10).toBeUndefined();
    expect(s.used.p09).toBe(true);
  });

  it('throws when the faction has nothing else left', () => {
    const s = initialState(1);
    for (const p of albania.petitions) s.used[p.id] = true;
    expect(() => suggestOther(albania, s, 'p10', scriptedDice([0]))).toThrow();
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run tests/diktator/audience.test.ts`
Expected: FAIL — cannot resolve `audience`.

- [ ] **Step 3: Implement**

`src/games/diktator/logic/audience.ts`:

```ts
import type { Dice } from './dice';
import { affordable, applyEffects, clamp, type Petition } from './records';
import type { Scenario } from './scenario';
import type { GameEvent, GameState } from './state';

export function petitionById(sc: Scenario, id: string): Petition {
  const p = sc.petitions.find((x) => x.id === id);
  if (!p) throw new Error(`unknown petition ${id}`);
  return p;
}

/** L630–648: random start, cyclic scan for an unused petition; when all are used, reset them and draw again. */
export function drawPetition(sc: Scenario, s: GameState, dice: Dice): string {
  const ps = sc.petitions;
  for (let attempt = 0; attempt < 2; attempt++) {
    const start = dice.int(ps.length);
    for (let k = 0; k < ps.length; k++) {
      const p = ps[(start + k) % ps.length];
      if (!s.used[p.id]) {
        s.used[p.id] = true;
        return p.id;
      }
    }
    for (const p of ps) delete s.used[p.id];
  }
  throw new Error('scenario has no petitions');
}

/** Our addition: put the petition back and draw another unused one from the same faction. */
export function suggestOther(sc: Scenario, s: GameState, currentId: string, dice: Dice): string {
  const current = petitionById(sc, currentId);
  const options = sc.petitions.filter((p) => p.from === current.from && p.id !== currentId && !s.used[p.id]);
  if (options.length === 0) throw new Error(`no other petition from ${current.from}`);
  delete s.used[currentId];
  const next = options[dice.int(options.length)];
  s.used[next.id] = true;
  return next.id;
}

function refuse(s: GameState, p: Petition): void {
  s.pop[p.from] = clamp(s.pop[p.from] - (p.effects.pop?.[p.from] ?? 0));
}

/** L694–766. `goAway` is our addition: −1 popularity and the petition goes back into the deck. */
export function answerPetition(
  sc: Scenario,
  s: GameState,
  id: string,
  answer: 'yes' | 'no' | 'goAway',
  events: GameEvent[],
): void {
  const p = petitionById(sc, id);
  if (answer === 'goAway') {
    s.pop[p.from] = clamp(s.pop[p.from] - 1);
    delete s.used[id];
    events.push({ type: 'answered', id, answer });
    return;
  }
  if (answer === 'yes' && !affordable(s.treasury, p.effects)) {
    refuse(s, p);
    events.push({ type: 'forcedNo', id });
    return;
  }
  if (answer === 'yes') applyEffects(s, p.effects);
  else refuse(s, p);
  events.push({ type: 'answered', id, answer });
}
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run tests/diktator/audience.test.ts`
Expected: 10 passed.

- [ ] **Step 5: Commit**

```bash
git add src/games/diktator/logic/audience.ts tests/diktator/audience.test.ts
git commit -m "feat(diktator): audience draw and answers"
```

---

### Task 8: Decisions

**Files:**
- Create: `src/games/diktator/logic/decision.ts`
- Test: `tests/diktator/decision.test.ts`

Rules (L2500–2746, L2060): one decision per turn. `takeDecision` returns `true` when the decision was consumed (the turn's decision is used up). A plain decision that is unaffordable emits `decisionUnaffordable` and is **not** consumed (the original returns to the menu). Aid is always consumed, even when refused. The Swiss account is always consumed (even with nothing to send). Bodyguard and Swiss are never marked used. After a consumed decision the plots re-form.

- [ ] **Step 1: Write the failing test**

`tests/diktator/decision.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { availableDecisions, takeDecision } from '../../src/games/diktator/logic/decision';
import { initialState, type GameEvent } from '../../src/games/diktator/logic/state';
import { albania } from '../../src/games/diktator/scenario/albania';
import { scriptedDice } from './helpers';

function state() {
  const s = initialState(1);
  s.quarter = 6;
  s.low = 3;
  return s;
}

describe('takeDecision', () => {
  it('applies a plain decision and marks it used', () => {
    const s = state();
    const ev: GameEvent[] = [];
    expect(takeDecision(albania, s, 'd41', 2, scriptedDice([]), ev)).toBe(true);
    expect(s.treasury).toBe(950);
    expect(s.str.armada).toBe(9);
    expect(s.used.d41).toBe(true);
    expect(s.decisionTaken).toBe(true);
    expect(ev).toEqual([{ type: 'decided', id: 'd41' }]);
    expect(availableDecisions(albania, s).some((d) => d.id === 'd41')).toBe(false);
  });

  it('an unaffordable decision is not consumed', () => {
    const s = state();
    s.treasury = 100;
    const ev: GameEvent[] = [];
    expect(takeDecision(albania, s, 'd36', 2, scriptedDice([]), ev)).toBe(false);
    expect(ev).toEqual([{ type: 'decisionUnaffordable', id: 'd36' }]);
    expect(s.decisionTaken).toBe(false);
    expect(s.hasPlane).toBe(false);
  });

  it('bodyguard adds 2 strength and stays available', () => {
    const s = state();
    takeDecision(albania, s, 'd35', 2, scriptedDice([]), []);
    expect(s.guard).toBe(6);
    expect(s.used.d35).toBeUndefined();
  });

  it('the plane sets the flag', () => {
    const s = state();
    takeDecision(albania, s, 'd36', 2, scriptedDice([]), []);
    expect(s.hasPlane).toBe(true);
  });

  it('the Swiss account sends 1/share of the treasury, rounded down', () => {
    const s = state();
    const ev: GameEvent[] = [];
    takeDecision(albania, s, 'd37', 3, scriptedDice([]), ev);
    expect(s.swiss).toBe(333);
    expect(s.treasury).toBe(667);
    expect(ev).toEqual([{ type: 'swissTransfer', amount: 333 }]);
  });

  it('the Swiss account with an empty treasury sends nothing but still uses the turn', () => {
    const s = state();
    s.treasury = 1;
    const ev: GameEvent[] = [];
    expect(takeDecision(albania, s, 'd37', 2, scriptedDice([]), ev)).toBe(true);
    expect(ev).toEqual([{ type: 'swissTransfer', amount: 0 }]);
    expect(s.swiss).toBe(0);
  });

  it('aid: too early (turn < rnd(0..4)+3)', () => {
    const s = state();
    s.quarter = 4;
    const ev: GameEvent[] = [];
    expect(takeDecision(albania, s, 'd38', 2, scriptedDice([2]), ev)).toBe(true);
    expect(ev).toEqual([{ type: 'aidRefused', lender: 'italie', reason: 'tooEarly' }]);
  });

  it('aid: granted pop*30 + rnd(0..199), only once', () => {
    const s = state();
    const ev: GameEvent[] = [];
    takeDecision(albania, s, 'd38', 2, scriptedDice([0, 50]), ev);
    expect(ev).toEqual([{ type: 'aidGranted', lender: 'italie', amount: 260 }]);
    expect(s.treasury).toBe(1260);
    s.decisionTaken = false;
    const ev2: GameEvent[] = [];
    takeDecision(albania, s, 'd38', 2, scriptedDice([0]), ev2);
    expect(ev2).toEqual([{ type: 'aidRefused', lender: 'italie', reason: 'used' }]);
  });

  it('aid: refused by an unfriendly power', () => {
    const s = state();
    s.pop.britanie = 3;
    const ev: GameEvent[] = [];
    takeDecision(albania, s, 'd39', 2, scriptedDice([0]), ev);
    expect(ev).toEqual([{ type: 'aidRefused', lender: 'britanie', reason: 'unpopular' }]);
    expect(s.used.d39).toBeUndefined();
  });

  it('only one decision per turn', () => {
    const s = state();
    takeDecision(albania, s, 'd41', 2, scriptedDice([]), []);
    expect(() => takeDecision(albania, s, 'd42', 2, scriptedDice([]), [])).toThrow();
  });

  it('re-forms plots after a decision', () => {
    const s = state();
    s.pop.armada = 4;
    takeDecision(albania, s, 'd35', 2, scriptedDice([]), []); // armada -2 → 2 ≤ low
    expect(s.plots.armada.kind).not.toBe('none');
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run tests/diktator/decision.test.ts`
Expected: FAIL — cannot resolve `decision`.

- [ ] **Step 3: Implement**

`src/games/diktator/logic/decision.ts`:

```ts
import type { Dice } from './dice';
import type { LenderId } from './groups';
import { formPlots } from './plot';
import { affordable, applyEffects, type Decision } from './records';
import { RULES } from './rules';
import type { Scenario } from './scenario';
import type { GameEvent, GameState } from './state';

export function decisionById(sc: Scenario, id: string): Decision {
  const d = sc.decisions.find((x) => x.id === id);
  if (!d) throw new Error(`unknown decision ${id}`);
  return d;
}

/** Decisions still on the menu (used ones are hidden; reusable ones never get used up). */
export function availableDecisions(sc: Scenario, s: GameState): Decision[] {
  return sc.decisions.filter((d) => d.reusable || !s.used[d.id]);
}

/** Foreign aid (L2060–2140). Always uses the turn's decision. */
function askForAid(s: GameState, id: string, lender: LenderId, dice: Dice, events: GameEvent[]): void {
  if (s.quarter < dice.int(RULES.aidEarliestSpread) + RULES.aidEarliestBase) {
    events.push({ type: 'aidRefused', lender, reason: 'tooEarly' });
  } else if (s.used[id]) {
    events.push({ type: 'aidRefused', lender, reason: 'used' });
  } else if (s.pop[lender] <= s.low) {
    events.push({ type: 'aidRefused', lender, reason: 'unpopular' });
  } else {
    const amount = s.pop[lender] * RULES.aidPerPop + dice.int(RULES.aidSpread);
    s.treasury += amount;
    s.used[id] = true;
    events.push({ type: 'aidGranted', lender, amount });
  }
}

/**
 * The presidential decision (L2500–2746). Returns whether the turn's decision was used up.
 * `share` is only read by the Swiss account (send ⌊treasury / share⌋; the original is share 2).
 */
export function takeDecision(
  sc: Scenario,
  s: GameState,
  id: string,
  share: 1 | 2 | 3 | 4,
  dice: Dice,
  events: GameEvent[],
): boolean {
  if (s.decisionTaken) throw new Error('decision already taken this turn');
  const d = decisionById(sc, id);
  const special = d.special;
  if (special?.kind === 'aid') {
    // Aid checks "already used" itself (with the original message), so it stays on the menu until granted.
    askForAid(s, id, special.lender, dice, events);
  } else if (special?.kind === 'swiss') {
    const amount = Math.max(0, Math.floor(s.treasury / share));
    if (amount >= 1) {
      s.swiss += amount;
      s.treasury -= amount;
    }
    events.push({ type: 'swissTransfer', amount: amount >= 1 ? amount : 0 });
  } else {
    if (!d.reusable && s.used[id]) throw new Error(`decision ${id} already used`);
    if (!affordable(s.treasury, d.effects)) {
      events.push({ type: 'decisionUnaffordable', id });
      return false;
    }
    applyEffects(s, d.effects);
    if (special?.kind === 'bodyguard') s.guard += RULES.bodyguardStep;
    if (special?.kind === 'plane') s.hasPlane = true;
    if (!d.reusable) s.used[id] = true;
    events.push({ type: 'decided', id });
  }
  s.decisionTaken = true;
  formPlots(s);
  return true;
}
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run tests/diktator/decision.test.ts`
Expected: 11 passed.

- [ ] **Step 5: Commit**

```bash
git add src/games/diktator/logic/decision.ts tests/diktator/decision.test.ts
git commit -m "feat(diktator): decisions, Swiss account, foreign aid, plane and bodyguard"
```

---

### Task 9: Assassination and war

**Files:**
- Create: `src/games/diktator/logic/assassination.ts`
- Create: `src/games/diktator/logic/war.ts`
- Test: `tests/diktator/crises.test.ts`

- [ ] **Step 1: Write the failing test**

`tests/diktator/crises.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { assassination } from '../../src/games/diktator/logic/assassination';
import { war } from '../../src/games/diktator/logic/war';
import { initialState, type GameEvent } from '../../src/games/diktator/logic/state';
import { scriptedDice } from './helpers';

function state() {
  const s = initialState(1);
  s.quarter = 8;
  s.low = 3;
  return s;
}

describe('assassination (L1500–1560)', () => {
  it('nothing happens unless the rolled faction plots an assassination', () => {
    const s = state();
    s.plots.rolnici = { kind: 'assassination' };
    const ev: GameEvent[] = [];
    expect(assassination(s, scriptedDice([0]), ev)).toBe(false);
    expect(ev).toEqual([]);
  });

  it('a friendly or strong police saves the ruler without a coin', () => {
    const s = state();
    s.plots.armada = { kind: 'assassination' };
    s.pop.policie = 2;
    const ev: GameEvent[] = [];
    expect(assassination(s, scriptedDice([0]), ev)).toBe(false);
    expect(ev).toEqual([{ type: 'assassination', faction: 'armada', survived: true }]);
  });

  it('with the police hostile and weak, the coin decides', () => {
    const s = state();
    s.plots.armada = { kind: 'assassination' };
    s.pop.policie = 2;
    s.str.policie = 1;
    expect(assassination(s, scriptedDice([0, 1]), [])).toBe(false);
    expect(assassination(s, scriptedDice([0, 0]), [])).toBe(true);
  });

  it('all three factions plotting assassination is always fatal', () => {
    const s = state();
    s.plots = { armada: { kind: 'assassination' }, rolnici: { kind: 'assassination' }, statkari: { kind: 'assassination' } };
    expect(assassination(s, scriptedDice([2]), [])).toBe(true);
  });
});

describe('war (L4200–4340)', () => {
  it('no war while Yugoslavia is friendly or weak', () => {
    const s = state();
    expect(war(s, scriptedDice([]), [])).toBe('none');
    s.pop.jugoslavie = 2;
    s.str.jugoslavie = 2;
    expect(war(s, scriptedDice([]), [])).toBe('none');
  });

  it('a threat of war rallies the factions and the police (+1, max 9)', () => {
    const s = state();
    s.pop.jugoslavie = 2;
    s.pop.armada = 9;
    const ev: GameEvent[] = [];
    expect(war(s, scriptedDice([1]), ev)).toBe('threat');
    expect(s.pop).toMatchObject({ armada: 9, rolnici: 8, statkari: 8, policie: 8 });
    expect(ev).toEqual([{ type: 'warThreat' }]);
  });

  it('an invasion is won when home > enemy + roll; Yugoslavia loses all strength', () => {
    const s = state();
    s.pop.jugoslavie = 2;
    // home = guard 4 + 6+6+6 + police 6 = 28; enemy = povstalci 6 + jugoslavie 6 = 12
    const ev: GameEvent[] = [];
    expect(war(s, scriptedDice([0, 2]), ev)).toBe('won');
    expect(s.str.jugoslavie).toBe(0);
    expect(ev).toEqual([{ type: 'invasion', home: 28, enemy: 12, won: true }]);
  });

  it('a lost invasion kills, unless the plane works (2/3)', () => {
    const lose = () => {
      const s = state();
      s.pop = { ...s.pop, armada: 1, rolnici: 1, statkari: 1, jugoslavie: 1, policie: 1 };
      return s;
    };
    expect(war(lose(), scriptedDice([0, 1]), [])).toBe('killed');
    const withPlane = lose();
    withPlane.hasPlane = true;
    expect(war(withPlane, scriptedDice([0, 1, 1]), [])).toBe('escaped');
    const brokenPlane = lose();
    brokenPlane.hasPlane = true;
    expect(war(brokenPlane, scriptedDice([0, 1, 0]), [])).toBe('killed');
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run tests/diktator/crises.test.ts`
Expected: FAIL — cannot resolve `assassination`.

- [ ] **Step 3: Implement assassination**

`src/games/diktator/logic/assassination.ts`:

```ts
import type { Dice } from './dice';
import { FACTIONS } from './groups';
import { RULES } from './rules';
import type { GameEvent, GameState } from './state';

/**
 * L1500–1560: one random faction; only an assassination plot acts. All three plotting is fatal; otherwise
 * a friendly or strong police saves the ruler, and failing that a coin. Returns true when the ruler dies.
 */
export function assassination(s: GameState, dice: Dice, events: GameEvent[]): boolean {
  const faction = FACTIONS[dice.int(FACTIONS.length)];
  if (s.plots[faction].kind !== 'assassination') return false;
  const allPlotting = FACTIONS.every((f) => s.plots[f].kind === 'assassination');
  const survived =
    !allPlotting && (s.pop.policie > s.low || s.str.policie > s.low || dice.int(RULES.assassinationCoin) !== 0);
  events.push({ type: 'assassination', faction, survived });
  return !survived;
}
```

- [ ] **Step 4: Implement war**

`src/games/diktator/logic/war.ts`:

```ts
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
```

- [ ] **Step 5: Run the tests**

Run: `npx vitest run tests/diktator/crises.test.ts`
Expected: 8 passed.

- [ ] **Step 6: Commit**

```bash
git add src/games/diktator/logic/assassination.ts src/games/diktator/logic/war.ts tests/diktator/crises.test.ts
git commit -m "feat(diktator): assassination and war with Yugoslavia"
```

---

### Task 10: News, revolution and score

**Files:**
- Create: `src/games/diktator/logic/news.ts`
- Create: `src/games/diktator/logic/revolution.ts`
- Create: `src/games/diktator/logic/score.ts`
- Test: `tests/diktator/revolution.test.ts`

- [ ] **Step 1: Write the failing test**

`tests/diktator/revolution.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { maybeNews } from '../../src/games/diktator/logic/news';
import {
  afterVictory,
  eligibleAllies,
  findRevolution,
  fightRevolution,
  flee,
  throughMountains,
} from '../../src/games/diktator/logic/revolution';
import { score } from '../../src/games/diktator/logic/score';
import { initialState, type GameEvent } from '../../src/games/diktator/logic/state';
import { albania } from '../../src/games/diktator/scenario/albania';
import { scriptedDice } from './helpers';

function state() {
  const s = initialState(1);
  s.quarter = 10;
  s.low = 3;
  return s;
}

describe('maybeNews (L2750)', () => {
  it('nothing on a non-zero roll', () => {
    const s = state();
    const ev: GameEvent[] = [];
    maybeNews(albania, s, scriptedDice([1]), ev);
    expect(ev).toEqual([]);
  });

  it('applies an unused item and marks it; steps past used ones', () => {
    const s = state();
    s.used.n45 = true;
    const ev: GameEvent[] = [];
    maybeNews(albania, s, scriptedDice([0, 1]), ev);
    expect(ev).toEqual([{ type: 'news', id: 'n46' }]);
    expect(s.str.armada).toBe(2);
    expect(s.used.n46).toBe(true);
  });

  it('does nothing when all news is used', () => {
    const s = state();
    for (const n of albania.news) s.used[n.id] = true;
    const ev: GameEvent[] = [];
    maybeNews(albania, s, scriptedDice([0, 3]), ev);
    expect(ev).toEqual([]);
  });
});

describe('revolution (L1800–1969)', () => {
  it('findRevolution tries three random factions', () => {
    const s = state();
    s.plots.statkari = { kind: 'revolution', ally: 'povstalci' };
    expect(findRevolution(s, scriptedDice([0, 1, 2]))).toBe('statkari');
    expect(findRevolution(s, scriptedDice([0, 1, 0]))).toBeNull();
  });

  it('mountains: caught unless INT(RND*(G/3+0.4)) is 0', () => {
    const s = state();
    s.str.povstalci = 6; // range 2.4
    expect(throughMountains(s, scriptedDice([0.3]), [])).toEqual({ kind: 'escaped', via: 'mountains' });
    expect(throughMountains(s, scriptedDice([0.5]), [])).toEqual({ kind: 'killed', cause: 'mountains' });
    s.str.povstalci = 0; // range 0.4 → always 0
    expect(throughMountains(s, scriptedDice([0.99]), [])).toEqual({ kind: 'escaped', via: 'mountains' });
  });

  it('flee by plane works 2/3, otherwise falls back to the mountains', () => {
    const s = state();
    s.hasPlane = true;
    expect(flee(s, scriptedDice([1]), [])).toEqual({ kind: 'escaped', via: 'plane' });
    const ev: GameEvent[] = [];
    expect(flee(s, scriptedDice([0, 0.1]), ev)).toEqual({ kind: 'escaped', via: 'mountains' });
    expect(ev).toEqual([{ type: 'planeFailed' }]);
  });

  it('eligible allies are groups 1–6 with popularity above low', () => {
    const s = state();
    s.pop.rolnici = 2;
    expect(eligibleAllies(s)).toEqual(['armada', 'statkari', 'jugoslavie', 'policie']);
  });

  it('the fight: rebels ≤ guard + ally strength + rnd(-1..1) wins', () => {
    const s = state();
    s.plots.armada = { kind: 'revolution', ally: 'povstalci' };
    // rebels 6 + 6 = 12; ours = guard 4 + policie 6 + (roll - 1)
    const ev: GameEvent[] = [];
    expect(fightRevolution(s, 'armada', 'policie', scriptedDice([2]), ev)).toBe(false);
    expect(ev).toEqual([{ type: 'revolutionFight', rebels: 12, ours: 11, won: false }]);
    s.guard = 6;
    expect(fightRevolution(s, 'armada', 'policie', scriptedDice([0]), [])).toBe(false);
    expect(fightRevolution(s, 'armada', 'policie', scriptedDice([1]), [])).toBe(true);
  });

  it('fighting alone uses only the guard (original bug fixed)', () => {
    const s = state();
    s.plots.armada = { kind: 'revolution', ally: 'povstalci' };
    s.str.armada = 2;
    s.str.povstalci = 2;
    expect(fightRevolution(s, 'armada', null, scriptedDice([1]), [])).toBe(true);
  });

  it('after victory: punishing zeroes rebels and their ally, the chosen ally gets strength 9, plots pause', () => {
    const s = state();
    s.plots.armada = { kind: 'revolution', ally: 'povstalci' };
    const ev: GameEvent[] = [];
    afterVictory(s, 'armada', 'policie', true, ev);
    expect(s.pop.armada).toBe(0);
    expect(s.str.armada).toBe(0);
    expect(s.pop.povstalci).toBe(0);
    expect(s.str.povstalci).toBe(0);
    expect(s.str.policie).toBe(9);
    expect(s.plotPauseUntil).toBe(12);
    expect(ev).toEqual([{ type: 'punished', faction: 'armada', ally: 'povstalci' }]);
  });

  it('after victory without punishing only the ally is rewarded', () => {
    const s = state();
    s.plots.armada = { kind: 'revolution', ally: 'povstalci' };
    afterVictory(s, 'armada', 'statkari', false, []);
    expect(s.str.armada).toBe(6);
    expect(s.str.statkari).toBe(9);
  });
});

describe('score (L3026–3070)', () => {
  it('popularity + 9 per quarter, plus alive bonus and Swiss money when alive', () => {
    const s = state();
    s.swiss = 255;
    // popularity: 7*7 + 0 = 49; quarters 10 → 90; alive 10; swiss 25
    expect(score(s, { kind: 'survived' })).toEqual({ popularity: 49, time: 90, alive: 10, swiss: 25, total: 174 });
    expect(score(s, { kind: 'escaped', via: 'plane' }).total).toBe(174);
    expect(score(s, { kind: 'killed', cause: 'war' })).toEqual({ popularity: 49, time: 90, alive: 0, swiss: 0, total: 139 });
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run tests/diktator/revolution.test.ts`
Expected: FAIL — cannot resolve `news`.

- [ ] **Step 3: Implement news**

`src/games/diktator/logic/news.ts`:

```ts
import type { Dice } from './dice';
import { formPlots } from './plot';
import { applyEffects } from './records';
import { RULES } from './rules';
import type { Scenario } from './scenario';
import type { GameEvent, GameState } from './state';

/** L2750–2806: 1 in 3 turns an unused random news item happens (cyclic scan; nothing when all are used). */
export function maybeNews(sc: Scenario, s: GameState, dice: Dice, events: GameEvent[]): void {
  if (dice.int(RULES.newsOneIn) !== 0) return;
  const ns = sc.news;
  const start = dice.int(ns.length);
  for (let k = 0; k < ns.length; k++) {
    const n = ns[(start + k) % ns.length];
    if (s.used[n.id]) continue;
    s.used[n.id] = true;
    applyEffects(s, n.effects);
    events.push({ type: 'news', id: n.id });
    formPlots(s);
    return;
  }
}
```

- [ ] **Step 4: Implement revolution**

`src/games/diktator/logic/revolution.ts`:

```ts
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
```

Note: `formPlots` clears all plots only when `quarter > 2`; after a victory the pause makes it clear and stop.

- [ ] **Step 5: Implement score**

`src/games/diktator/logic/score.ts`:

```ts
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
```

- [ ] **Step 6: Run the tests**

Run: `npx vitest run tests/diktator/revolution.test.ts`
Expected: all pass. The unused `_events` parameter is intentional (keeps `throughMountains` and `flee` interchangeable); `noUnusedParameters` is not enabled in `tsconfig.json`.

- [ ] **Step 7: Commit**

```bash
git add src/games/diktator/logic/news.ts src/games/diktator/logic/revolution.ts src/games/diktator/logic/score.ts tests/diktator/revolution.test.ts
git commit -m "feat(diktator): news, revolution, escape and score"
```

---

### Task 11: The phase machine

**Files:**
- Create: `src/games/diktator/logic/turn.ts`
- Test: `tests/diktator/turn.test.ts`

Order of one turn (spec §4.1, including the documented deviation): start of turn — re-roll `low` and `threshold`, quarter += 1, form plots, settle the treasury, draw a petition → `audience`. Answer → form plots → `day`. `day` accepts `policeReport` (any number of times), `decide` (once), `endDay`. Evening: assassination → war → form plots → news → revolution tries. A revolution → `revolution` phase: `flee` ends the game; `fight` → `chooseAlly` (or straight to the fight when nobody is eligible) → `ally` → fight → `punish` → next turn. After the evening of the last quarter the game ends `survived`.

- [ ] **Step 1: Write the failing test**

`tests/diktator/turn.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { advance, newGame, quarterLabel, validCommands } from '../../src/games/diktator/logic/turn';
import type { Command, GameState } from '../../src/games/diktator/logic/state';
import { albania } from '../../src/games/diktator/scenario/albania';
import { makeRng, randInt } from '../../src/shared/rng';

describe('quarterLabel', () => {
  it('maps turns to years and quarters', () => {
    expect(quarterLabel(1)).toEqual({ year: 1925, q: 1 });
    expect(quarterLabel(15)).toEqual({ year: 1928, q: 3 });
    expect(quarterLabel(57)).toEqual({ year: 1939, q: 1 });
  });
});

describe('newGame', () => {
  it('starts in the first quarter with an audience after paying costs', () => {
    const { state, events } = newGame(albania, 123);
    expect(state.quarter).toBe(1);
    expect(state.phase.kind).toBe('audience');
    expect(state.treasury).toBe(940);
    expect(events[0]).toEqual({ type: 'quarterStarted', quarter: 1 });
    expect(state.low).toBeGreaterThanOrEqual(2);
    expect(state.low).toBeLessThanOrEqual(4);
    expect(state.threshold).toBeGreaterThanOrEqual(10);
    expect(state.threshold).toBeLessThanOrEqual(12);
  });
});

describe('advance', () => {
  it('does not mutate its input', () => {
    const { state } = newGame(albania, 5);
    const before = JSON.stringify(state);
    advance(albania, state, { type: 'answer', answer: 'no' });
    expect(JSON.stringify(state)).toBe(before);
  });

  it('audience → day → next quarter', () => {
    let { state } = newGame(albania, 9);
    state = advance(albania, state, { type: 'answer', answer: 'no' }).state;
    expect(state.phase.kind).toBe('day');
    state = advance(albania, state, { type: 'endDay' }).state;
    expect(state.quarter).toBe(2);
    expect(state.phase.kind).toBe('audience');
    expect(state.decisionTaken).toBe(false);
  });

  it('rejects commands that are not valid in the phase', () => {
    const { state } = newGame(albania, 9);
    expect(() => advance(albania, state, { type: 'endDay' })).toThrow();
    expect(() => advance(albania, state, { type: 'fight' })).toThrow();
  });

  it('suggestOther works once per audience', () => {
    let { state } = newGame(albania, 11);
    state = advance(albania, state, { type: 'answer', answer: 'suggestOther' }).state;
    expect(state.phase).toMatchObject({ kind: 'audience', suggested: true });
    expect(() => advance(albania, state, { type: 'answer', answer: 'suggestOther' })).toThrow();
  });

  it('a decision is taken once per day', () => {
    let { state } = newGame(albania, 12);
    state = advance(albania, state, { type: 'answer', answer: 'no' }).state;
    state = advance(albania, state, { type: 'decide', decision: 'd35' }).state;
    expect(state.decisionTaken).toBe(true);
    expect(() => advance(albania, state, { type: 'decide', decision: 'd35' })).toThrow();
  });

  it('is deterministic: same seed and commands give the same state', () => {
    const run = () => {
      let { state } = newGame(albania, 77);
      for (let i = 0; i < 10 && state.phase.kind !== 'ended'; i++) {
        state = advance(albania, state, validCommands(albania, state)[0]).state;
      }
      return JSON.stringify(state);
    };
    expect(run()).toBe(run());
  });
});

/** Plays random valid commands until the game ends. */
function playRandom(seed: number): GameState {
  const pickRng = makeRng(seed ^ 0x5bd1e995);
  let { state } = newGame(albania, seed);
  for (let step = 0; step < 5000; step++) {
    if (state.phase.kind === 'ended') return state;
    const options: Command[] = validCommands(albania, state);
    state = advance(albania, state, options[randInt(pickRng, options.length)]).state;
  }
  throw new Error(`seed ${seed} did not end`);
}

describe('bot playthrough', () => {
  it('50 random games always end properly within the 57 quarters', () => {
    for (let seed = 1; seed <= 50; seed++) {
      const s = playRandom(seed);
      expect(s.phase.kind).toBe('ended');
      expect(s.quarter).toBeGreaterThanOrEqual(1);
      expect(s.quarter).toBeLessThanOrEqual(57);
      for (const v of Object.values(s.pop)) expect(v >= 0 && v <= 9).toBe(true);
      for (const v of Object.values(s.str)) expect(v >= 0 && v <= 9).toBe(true);
    }
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run tests/diktator/turn.test.ts`
Expected: FAIL — cannot resolve `turn`.

- [ ] **Step 3: Implement**

`src/games/diktator/logic/turn.ts`:

```ts
import { answerPetition, drawPetition, suggestOther } from './audience';
import { assassination } from './assassination';
import type { StrengthGroupId } from './groups';
import { availableDecisions, takeDecision } from './decision';
import { rngDice, type Dice } from './dice';
import { maybeNews } from './news';
import { formPlots } from './plot';
import { policeReport } from './police';
import { afterVictory, eligibleAllies, fightRevolution, findRevolution, flee, throughMountains } from './revolution';
import { settleTreasury } from './money';
import { RULES } from './rules';
import type { Scenario } from './scenario';
import { initialState, type Command, type Ending, type GameEvent, type GameState, type StartingRegime } from './state';
import { war } from './war';

export interface StepResult {
  readonly state: GameState;
  readonly events: readonly GameEvent[];
}

export function quarterLabel(quarter: number): { year: number; q: 1 | 2 | 3 | 4 } {
  return { year: RULES.firstYear + Math.floor((quarter - 1) / 4), q: (((quarter - 1) % 4) + 1) as 1 | 2 | 3 | 4 };
}

function end(s: GameState, ending: Ending, events: GameEvent[]): void {
  s.phase = { kind: 'ended', ending };
  events.push({ type: 'ended', ending });
}

function startQuarter(sc: Scenario, s: GameState, dice: Dice, events: GameEvent[]): void {
  s.low = RULES.lowBase + dice.int(RULES.lowSpread);
  s.threshold = RULES.thresholdBase + dice.int(RULES.thresholdSpread);
  s.quarter += 1;
  s.decisionTaken = false;
  events.push({ type: 'quarterStarted', quarter: s.quarter });
  formPlots(s);
  settleTreasury(s, events);
  const id = drawPetition(sc, s, dice);
  s.phase = { kind: 'audience', petition: id, suggested: false };
  events.push({ type: 'petition', id });
}

function nextQuarter(sc: Scenario, s: GameState, dice: Dice, events: GameEvent[]): void {
  if (s.quarter >= RULES.quarters) end(s, { kind: 'survived' }, events);
  else startQuarter(sc, s, dice, events);
}

function evening(sc: Scenario, s: GameState, dice: Dice, events: GameEvent[]): void {
  if (assassination(s, dice, events)) return end(s, { kind: 'killed', cause: 'assassination' }, events);
  const w = war(s, dice, events);
  if (w === 'killed') return end(s, { kind: 'killed', cause: 'war' }, events);
  if (w === 'escaped') return end(s, { kind: 'escaped', via: 'plane' }, events);
  formPlots(s);
  maybeNews(sc, s, dice, events);
  const faction = findRevolution(s, dice);
  if (faction) {
    const plot = s.plots[faction];
    if (plot.kind !== 'revolution') throw new Error('unreachable');
    events.push({ type: 'revolution', faction, ally: plot.ally, strength: s.str[faction] + s.str[plot.ally] });
    s.phase = { kind: 'revolution', faction };
    return;
  }
  nextQuarter(sc, s, dice, events);
}

function resolveFight(s: GameState, chosen: StrengthGroupId | null, dice: Dice, events: GameEvent[]): void {
  if (s.phase.kind !== 'chooseAlly' && s.phase.kind !== 'revolution') throw new Error('not in a revolution');
  const faction = s.phase.faction;
  if (fightRevolution(s, faction, chosen, dice, events)) s.phase = { kind: 'punish', faction, chosen };
  else end(s, { kind: 'killed', cause: 'revolution' }, events);
}

/** Starts a game: the state before the first turn, then the first turn begins. */
export function newGame(sc: Scenario, seed: number, regime?: StartingRegime): StepResult {
  const s = initialState(seed, regime);
  const events: GameEvent[] = [];
  startQuarter(sc, s, rngDice(s.rng), events);
  return { state: s, events };
}

/** Applies one command to a copy of the state. Throws on a command that is not valid in the current phase. */
export function advance(sc: Scenario, input: GameState, cmd: Command): StepResult {
  const s: GameState = structuredClone(input);
  const dice = rngDice(s.rng);
  const events: GameEvent[] = [];
  const phase = s.phase;
  const invalid = () => new Error(`command ${cmd.type} not valid in phase ${phase.kind}`);

  switch (phase.kind) {
    case 'audience': {
      if (cmd.type !== 'answer') throw invalid();
      if (cmd.answer === 'suggestOther') {
        if (phase.suggested) throw new Error('already suggested another petition');
        const id = suggestOther(sc, s, phase.petition, dice);
        s.phase = { kind: 'audience', petition: id, suggested: true };
        events.push({ type: 'petition', id });
        break;
      }
      answerPetition(sc, s, phase.petition, cmd.answer, events);
      formPlots(s);
      s.phase = { kind: 'day' };
      break;
    }
    case 'day': {
      if (cmd.type === 'policeReport') policeReport(s, events);
      else if (cmd.type === 'decide') takeDecision(sc, s, cmd.decision, cmd.share ?? 2, dice, events);
      else if (cmd.type === 'endDay') evening(sc, s, dice, events);
      else throw invalid();
      break;
    }
    case 'revolution': {
      if (cmd.type === 'flee') end(s, flee(s, dice, events), events);
      else if (cmd.type === 'fight') {
        if (eligibleAllies(s).length === 0) resolveFight(s, null, dice, events);
        else s.phase = { kind: 'chooseAlly', faction: phase.faction };
      } else throw invalid();
      break;
    }
    case 'chooseAlly': {
      if (cmd.type !== 'ally') throw invalid();
      if (s.pop[cmd.group] <= s.low) {
        events.push({ type: 'joking' });
        end(s, throughMountains(s, dice, events), events);
      } else resolveFight(s, cmd.group, dice, events);
      break;
    }
    case 'punish': {
      if (cmd.type !== 'punish') throw invalid();
      afterVictory(s, phase.faction, phase.chosen, cmd.punish, events);
      nextQuarter(sc, s, dice, events);
      break;
    }
    case 'ended':
      throw invalid();
  }
  return { state: s, events };
}

/** Every command the UI may offer in the current phase (used by the text UI and the bot test). */
export function validCommands(sc: Scenario, s: GameState): Command[] {
  switch (s.phase.kind) {
    case 'audience': {
      const cmds: Command[] = [
        { type: 'answer', answer: 'yes' },
        { type: 'answer', answer: 'no' },
        { type: 'answer', answer: 'goAway' },
      ];
      const phase = s.phase;
      const from = sc.petitions.find((p) => p.id === phase.petition)?.from;
      const canSuggest = !phase.suggested && sc.petitions.some((p) => p.from === from && !s.used[p.id]);
      if (canSuggest) cmds.push({ type: 'answer', answer: 'suggestOther' });
      return cmds;
    }
    case 'day': {
      const cmds: Command[] = [{ type: 'endDay' }, { type: 'policeReport' }];
      if (!s.decisionTaken) for (const d of availableDecisions(sc, s)) cmds.push({ type: 'decide', decision: d.id });
      return cmds;
    }
    case 'revolution':
      return [{ type: 'flee' }, { type: 'fight' }];
    case 'chooseAlly':
      return eligibleAllies(s).map((group) => ({ type: 'ally', group }) as Command);
    case 'punish':
      return [{ type: 'punish', punish: true }, { type: 'punish', punish: false }];
    case 'ended':
      return [];
  }
}
```

Note on `validCommands` in `day`: `policeReport` is always offered (the engine emits a refusal event when not possible). The bot therefore can loop on police reports; each costs money, so the treasury drains, which is fine, but it must not loop forever — `endDay` is always among the options and the 5000-step cap in the test guards it.

- [ ] **Step 4: Run the tests**

Run: `npx vitest run tests/diktator/turn.test.ts`
Expected: all pass. If the bot test fails on a seed, print that seed's last events and fix the engine, not the test.

- [ ] **Step 5: Run the whole suite and the type check**

Run: `npx vitest run && npx tsc --noEmit`
Expected: every test passes (spy tests included), no type errors.

- [ ] **Step 6: Commit**

```bash
git add src/games/diktator/logic/turn.ts tests/diktator/turn.test.ts
git commit -m "feat(diktator): phase machine for a quarter, crises and endings"
```

---

### Task 12: Save and yearly checkpoints

**Files:**
- Create: `src/games/diktator/logic/save.ts`
- Test: `tests/diktator/save.test.ts`

- [ ] **Step 1: Write the failing test**

`tests/diktator/save.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { deserialize, newSave, recordTurn, retryFromYear, serialize } from '../../src/games/diktator/logic/save';
import { advance, newGame } from '../../src/games/diktator/logic/turn';
import type { GameState } from '../../src/games/diktator/logic/state';
import { albania } from '../../src/games/diktator/scenario/albania';

function playQuarters(n: number): GameState[] {
  let { state } = newGame(albania, 3);
  const starts = [state];
  while (starts.length < n) {
    state = advance(albania, state, { type: 'answer', answer: 'no' }).state;
    state = advance(albania, state, { type: 'endDay' }).state;
    if (state.phase.kind !== 'audience') break;
    starts.push(state);
  }
  return starts;
}

describe('save file', () => {
  it('round-trips through JSON', () => {
    const { state } = newGame(albania, 1);
    const f = newSave('albania', state);
    expect(deserialize(serialize(f))).toEqual(f);
  });

  it('rejects garbage and other versions', () => {
    expect(deserialize(null)).toBeNull();
    expect(deserialize('not json')).toBeNull();
    expect(deserialize(JSON.stringify({ version: 99 }))).toBeNull();
  });

  it('keeps a checkpoint at the start of each year (Q1 audience)', () => {
    const starts = playQuarters(6);
    let f = newSave('albania', starts[0]);
    for (const s of starts.slice(1)) f = recordTurn(f, s);
    expect(f.checkpoints.map((c) => c.quarter)).toEqual(starts.filter((s) => s.quarter % 4 === 1).map((s) => s.quarter));
    expect(f.current.quarter).toBe(starts[starts.length - 1].quarter);
  });

  it('retry goes back to the latest yearly checkpoint and counts the retry', () => {
    const starts = playQuarters(6);
    let f = newSave('albania', starts[0]);
    for (const s of starts.slice(1)) f = recordTurn(f, s);
    const r = retryFromYear(f)!;
    expect(r.state.quarter % 4).toBe(1);
    expect(r.file.retries).toBe(1);
    expect(r.file.current).toEqual(r.state);
  });
});
```

Note: if seed 3 ends the game before 6 quarters the loop stops early and the test still holds; if it ever produces fewer than 5 starts, change the seed to one that survives (try 4, 5, …) and note it in the test name.

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run tests/diktator/save.test.ts`
Expected: FAIL — cannot resolve `save`.

- [ ] **Step 3: Implement**

`src/games/diktator/logic/save.ts`:

```ts
import type { GameState } from './state';

export const SAVE_VERSION = 1;

export interface SaveFile {
  readonly version: typeof SAVE_VERSION;
  readonly scenario: string;
  readonly current: GameState;
  /** The state at the start of each year (Q1, audience phase), oldest first. */
  readonly checkpoints: readonly GameState[];
  readonly retries: number;
}

function isYearStart(s: GameState): boolean {
  return s.phase.kind === 'audience' && s.quarter % 4 === 1;
}

export function newSave(scenario: string, state: GameState): SaveFile {
  return { version: SAVE_VERSION, scenario, current: state, checkpoints: isYearStart(state) ? [state] : [], retries: 0 };
}

/** Stores the latest state; at the start of a year also stores (or replaces) that year's checkpoint. */
export function recordTurn(f: SaveFile, state: GameState): SaveFile {
  const checkpoints = isYearStart(state)
    ? [...f.checkpoints.filter((c) => c.quarter !== state.quarter), state]
    : f.checkpoints;
  return { ...f, current: state, checkpoints };
}

/** Back to the latest yearly checkpoint not after the current turn; null when there is none. */
export function retryFromYear(f: SaveFile): { file: SaveFile; state: GameState } | null {
  const cp = [...f.checkpoints].reverse().find((c) => c.quarter <= f.current.quarter);
  if (!cp) return null;
  const state = structuredClone(cp);
  return { state, file: { ...f, current: state, retries: f.retries + 1 } };
}

export function serialize(f: SaveFile): string {
  return JSON.stringify(f);
}

/** Null for missing, broken or foreign-version data (the menu then hides "Pokračovat"). */
export function deserialize(raw: string | null): SaveFile | null {
  if (!raw) return null;
  try {
    const f = JSON.parse(raw) as Partial<SaveFile>;
    if (f.version !== SAVE_VERSION || !f.current || !Array.isArray(f.checkpoints)) return null;
    return f as SaveFile;
  } catch {
    return null;
  }
}
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run tests/diktator/save.test.ts`
Expected: 4 passed.

- [ ] **Step 5: Commit**

```bash
git add src/games/diktator/logic/save.ts tests/diktator/save.test.ts
git commit -m "feat(diktator): save file with yearly checkpoints and retry"
```

---

### Task 13: Text-mode page

A plain, readable Art Deco text page that plays the whole game with mouse or number keys. It shows only what the
original showed: the treasury is always visible, group bars only from the latest police report.

**Files:**
- Modify: `src/shared/i18n/cs.ts` (add a `diktator` key after `spy`)
- Create: `src/games/diktator/index.html`
- Create: `src/games/diktator/style.css`
- Create: `src/games/diktator/main.ts`
- Modify: `vite.config.ts` (add the page input)

- [ ] **Step 1: Add the strings**

In `src/shared/i18n/cs.ts`, before the final `};` of the `cs` object (after the closing `},` of `spy`), add:

```ts
  diktator: {
    title: 'Diktátor',
    subtitle: 'Tirana, 1925–1939',
    quarter: (year: number, q: number) => `${['', 'Zima', 'Jaro', 'Léto', 'Podzim'][q]} ${year}`,
    address: (isKing: boolean) => (isKing ? 'Veličenstvo' : 'Excelence'),
    treasury: (amount: number) => `Pokladna: ${amount.toLocaleString('cs-CZ')} tis. franků`,
    costs: (amount: number) => `Čtvrtletní výdaje: ${amount} tis.`,
    swiss: (amount: number) => `Švýcarský účet: ${amount.toLocaleString('cs-CZ')} tis.`,
    guard: (n: number) => `Tvá stráž: ${n}`,
    audienceFrom: (group: string) => `Žádost: ${group}`,
    audienceAsk: (address: string) => `Svolí Vaše ${address}…`,
    yes: 'Ano',
    no: 'Ne',
    goAway: 'Odejděte',
    suggestOther: 'Navrhněte něco jiného',
    policeReport: 'Hlášení tajné policie (1 tis.)',
    endDay: 'Ukončit den',
    decisionSections: ['', 'Potěšit skupinu', 'Potěšit všechny', 'Zlepšit své šance', 'Získat peníze', 'Posílit skupinu'],
    swissShare: (share: number) => (share === 1 ? 'vše' : `1/${share}`),
    flee: 'Utéct',
    fight: 'Bojovat',
    punishYes: 'Potrestat vzbouřence',
    punishNo: 'Omilostnit',
    chooseAlly: 'Koho požádáš o pomoc?',
    newGame: 'Nová hra',
    continueGame: 'Pokračovat',
    retry: (year: number) => `Zkusit znovu od ledna ${year}`,
    popularity: 'Oblíbenost',
    strength: 'Síla',
    plots: { none: '', assassination: 'chystá atentát', revolution: (ally: string) => `chystá revoluci s: ${ally}` },
    events: {
      bankrupt: 'Pokladna je prázdná! Armáda a tajná policie reptají, stráž slábne.',
      costsPaid: (n: number) => `Zaplaceno ${n} tis. výdajů.`,
      forcedNo: 'Na to v pokladně nejsou peníze. Odpověď musí být NE.',
      policeRefusedMoney: 'Na hlášení nejsou peníze.',
      policeRefusedHostile: 'Tajná policie odmítá spolupracovat.',
      unaffordable: 'Na to v pokladně nejsou peníze.',
      aidGranted: (who: string, n: number) => `${who} půjčuje ${n} tis. franků.`,
      aidTooEarly: (who: string) => `${who}: na půjčku je ještě brzy.`,
      aidUsed: (who: string) => `${who}: žádné další půjčky.`,
      aidUnpopular: (who: string) => `${who}: NE! Nemají vás rádi.`,
      swiss: (n: number) => (n > 0 ? `Do Švýcarska odešlo ${n} tis.` : 'Nebylo co poslat.'),
      assassinationSurvived: (group: string) => `Atentát! Útočníci (${group}) neuspěli.`,
      warThreat: 'Jugoslávie hrozí válkou! Lid se semkl kolem krále.',
      invasionWon: (home: number, enemy: number) => `Jugoslávská vojska vpadla do země — a byla poražena (${home} : ${enemy}).`,
      invasionLost: (home: number, enemy: number) => `Jugoslávská vojska zvítězila (${home} : ${enemy}).`,
      revolution: (group: string, ally: string, n: number) => `REVOLUCE! ${group} se spojili s: ${ally}. Jejich síla je ${n}.`,
      planeFailed: 'Letadlo nechce nastartovat!',
      joking: 'To myslíte vážně?! Musíte utéct přes hory.',
      fight: (rebels: number, ours: number, won: boolean) =>
        won ? `Vzpoura potlačena (${ours} proti ${rebels}).` : `Byl jsi svržen (${ours} proti ${rebels}).`,
      punished: 'Vzbouřenci byli potrestáni.',
    },
    endings: {
      assassination: 'Atentát se podařil. Tvá vláda skončila.',
      war: 'Nepřítel tě prohlásil za nepřítele lidu a nechal popravit.',
      revolution: 'Revoluce zvítězila. Byl jsi svržen.',
      mountains: 'Povstalci tě v horách chytili.',
      plane: 'Uletěl jsi letadlem do exilu.',
      escapedMountains: 'Prošel jsi horami až do exilu.',
      survived: 'Vydržel jsi až do dubna 1939! Italská vojska se vylodila a král odchází s rodinou do Řecka.',
    },
    score: (total: number) => `Skóre: ${total}`,
    back: '← Zpět na hry',
  },
```

- [ ] **Step 2: Write the page**

`src/games/diktator/index.html`:

```html
<!doctype html>
<html lang="cs">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Diktátor</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Limelight&family=Poiret+One&display=swap" />
    <link rel="stylesheet" href="./style.css" />
  </head>
  <body>
    <main>
      <header>
        <h1 id="title"></h1>
        <p id="date" class="date"></p>
        <p id="money" class="money"></p>
      </header>
      <section id="log" aria-live="polite"></section>
      <section id="prompt"></section>
      <section id="choices"></section>
      <section id="report"></section>
      <a href="../../../index.html" id="back"></a>
    </main>
    <script type="module" src="./main.ts"></script>
  </body>
</html>
```

`src/games/diktator/style.css`:

```css
:root {
  --night: #120e0a;
  --panel: #1c160f;
  --gold: #d9b45a;
  --gold-dark: #8a6a24;
  --cream: #efe4c4;
  --muted: #a8977a;
  --red: #c8102e;
}
body {
  margin: 0;
  background: var(--night);
  color: var(--cream);
  font-family: 'Poiret One', Georgia, serif;
  font-weight: 700;
  font-size: 19px;
}
main { max-width: 760px; margin: 0 auto; padding: 24px 16px 48px; }
h1 { font-family: 'Limelight', Georgia, serif; font-weight: 400; color: var(--gold); margin: 0; letter-spacing: 2px; }
.date { color: var(--gold); margin: 4px 0; }
.money { color: var(--muted); margin: 0 0 16px; white-space: pre-line; }
#log p { margin: 4px 0; color: var(--muted); }
#log p.big { color: var(--cream); }
#prompt { margin: 16px 0 8px; font-size: 22px; }
#choices { display: flex; flex-direction: column; gap: 8px; }
#choices h2 { font-family: 'Limelight', Georgia, serif; font-weight: 400; font-size: 17px; color: var(--gold); margin: 12px 0 0; }
button {
  font: inherit;
  text-align: left;
  color: var(--cream);
  background: var(--panel);
  border: 1px solid var(--gold-dark);
  padding: 8px 12px;
  cursor: pointer;
}
button:hover, button:focus-visible { border-color: var(--gold); outline: none; }
button .key { color: var(--gold); margin-right: 8px; }
#report table { width: 100%; border-collapse: collapse; margin-top: 16px; }
#report td { padding: 2px 6px; }
#report .bar { display: inline-block; height: 10px; background: var(--gold); vertical-align: middle; }
#report .plot { color: var(--red); }
#back { display: inline-block; margin-top: 24px; color: var(--muted); }
```

- [ ] **Step 3: Write the wiring**

`src/games/diktator/main.ts`:

```ts
import { cs } from '../../shared/i18n/cs';
import { randomSeed } from '../../shared/rng';
import { loadJson, saveJson } from '../../shared/storage';
import { decisionById } from './logic/decision';
import { GROUPS, hasStrength, type GroupId } from './logic/groups';
import { deserialize, newSave, recordTurn, retryFromYear, type SaveFile } from './logic/save';
import { score } from './logic/score';
import type { Command, GameEvent, GameState, PoliceSnapshot } from './logic/state';
import { advance, newGame, quarterLabel, validCommands } from './logic/turn';
import { albania } from './scenario/albania';

const T = cs.diktator;
const SAVE_KEY = 'diktator/save';
const sc = albania;
/** 1928-Q3: Zogu is crowned; from then on he is addressed as Veličenstvo. */
const CORONATION_QUARTER = 15;

const $ = (id: string) => document.getElementById(id)!;
let file: SaveFile | null = null;
let lastReport: PoliceSnapshot | null = null;
let log: string[] = [];

function name(g: GroupId): string {
  return sc.groupNames[g];
}

function describe(e: GameEvent): string | null {
  const E = T.events;
  switch (e.type) {
    case 'bankrupt': return E.bankrupt;
    case 'costsPaid': return E.costsPaid(e.amount);
    case 'forcedNo': return E.forcedNo;
    case 'policeReportRefused': return e.reason === 'noMoney' ? E.policeRefusedMoney : E.policeRefusedHostile;
    case 'decisionUnaffordable': return E.unaffordable;
    case 'decided': return `✓ ${decisionById(sc, e.id).title}`;
    case 'aidGranted': return E.aidGranted(name(e.lender), e.amount);
    case 'aidRefused':
      return e.reason === 'tooEarly' ? E.aidTooEarly(name(e.lender)) : e.reason === 'used' ? E.aidUsed(name(e.lender)) : E.aidUnpopular(name(e.lender));
    case 'swissTransfer': return E.swiss(e.amount);
    case 'assassination': return e.survived ? E.assassinationSurvived(name(e.faction)) : null;
    case 'warThreat': return E.warThreat;
    case 'invasion': return e.won ? E.invasionWon(e.home, e.enemy) : E.invasionLost(e.home, e.enemy);
    case 'news': return `📰 ${sc.news.find((n) => n.id === e.id)!.title}`;
    case 'revolution': return E.revolution(name(e.faction), name(e.ally), e.strength);
    case 'planeFailed': return E.planeFailed;
    case 'joking': return E.joking;
    case 'revolutionFight': return E.fight(e.rebels, e.ours, e.won);
    case 'punished': return E.punished;
    default: return null;
  }
}

function endingText(s: GameState): string {
  if (s.phase.kind !== 'ended') return '';
  const e = s.phase.ending;
  if (e.kind === 'survived') return T.endings.survived;
  if (e.kind === 'escaped') return e.via === 'plane' ? T.endings.plane : T.endings.escapedMountains;
  return T.endings[e.cause];
}

function button(label: string, key: string, onClick: () => void): HTMLButtonElement {
  const b = document.createElement('button');
  b.innerHTML = `<span class="key">${key}</span>`;
  b.append(label);
  b.dataset.key = key;
  b.addEventListener('click', onClick);
  return b;
}

function commandLabel(cmd: Command): string {
  switch (cmd.type) {
    case 'answer': return T[cmd.answer];
    case 'policeReport': return T.policeReport;
    case 'endDay': return T.endDay;
    case 'decide': return decisionById(sc, cmd.decision).title;
    case 'flee': return T.flee;
    case 'fight': return T.fight;
    case 'ally': return name(cmd.group);
    case 'punish': return cmd.punish ? T.punishYes : T.punishNo;
  }
}

function play(cmd: Command): void {
  if (!file) return;
  const { state, events } = advance(sc, file.current, cmd);
  for (const e of events) {
    if (e.type === 'policeReport') lastReport = e.report;
    const line = describe(e);
    if (line) log.push(line);
  }
  file = recordTurn(file, state);
  saveJson(SAVE_KEY, file);
  render();
}

function renderReport(): void {
  const r = $('report');
  r.innerHTML = '';
  if (!lastReport) return;
  const table = document.createElement('table');
  for (const g of GROUPS) {
    const tr = document.createElement('tr');
    const plot = (g === 'armada' || g === 'rolnici' || g === 'statkari') ? lastReport.plots[g] : null;
    const plotText = !plot || plot.kind === 'none' ? '' : plot.kind === 'assassination' ? T.plots.assassination : T.plots.revolution(name(plot.ally));
    const strCell = hasStrength(g) ? `<span class="bar" style="width:${lastReport.str[g] * 12}px"></span> ${lastReport.str[g]}` : '';
    tr.innerHTML = `<td>${name(g)}</td><td><span class="bar" style="width:${lastReport.pop[g] * 12}px"></span> ${lastReport.pop[g]}</td><td>${strCell}</td><td class="plot">${plotText}</td>`;
    table.append(tr);
  }
  const head = document.createElement('tr');
  head.innerHTML = `<td></td><td>${T.popularity}</td><td>${T.strength}</td><td></td>`;
  table.prepend(head);
  r.append(table);
}

function render(): void {
  $('title').textContent = T.title;
  $('back').textContent = T.back;
  const logEl = $('log');
  logEl.innerHTML = '';
  for (const line of log.slice(-8)) {
    const p = document.createElement('p');
    p.textContent = line;
    logEl.append(p);
  }
  const prompt = $('prompt');
  const choices = $('choices');
  choices.innerHTML = '';
  if (!file) {
    prompt.textContent = T.subtitle;
    choices.append(button(T.newGame, '1', startNew));
    const saved = deserialize(JSON.stringify(loadJson<Record<string, unknown>>(SAVE_KEY, {})));
    if (saved && saved.current.phase.kind !== 'ended') choices.append(button(T.continueGame, '2', () => { file = saved; render(); }));
    return;
  }
  const s = file.current;
  const { year, q } = quarterLabel(Math.max(1, s.quarter));
  $('date').textContent = T.quarter(year, q);
  $('money').textContent = [T.treasury(s.treasury), T.costs(s.costs), T.swiss(s.swiss), T.guard(s.guard)].join('\n');
  renderReport();

  if (s.phase.kind === 'ended') {
    prompt.textContent = `${endingText(s)} ${T.score(score(s, s.phase.ending).total)}`;
    let key = 1;
    const retry = retryFromYear(file);
    if (retry) choices.append(button(T.retry(quarterLabel(retry.state.quarter).year), String(key++), () => { file = retry.file; log = []; render(); }));
    choices.append(button(T.newGame, String(key++), startNew));
    return;
  }

  if (s.phase.kind === 'audience') {
    const p = sc.petitions.find((x) => x.id === (s.phase as { petition: string }).petition)!;
    prompt.textContent = `${T.audienceFrom(name(p.from))} — ${T.audienceAsk(T.address(s.quarter >= CORONATION_QUARTER))} ${p.title}?`;
  } else if (s.phase.kind === 'chooseAlly') {
    prompt.textContent = T.chooseAlly;
  } else {
    prompt.textContent = '';
  }

  let key = 1;
  let section = 0;
  for (const cmd of validCommands(sc, s)) {
    if (cmd.type === 'decide') {
      const d = decisionById(sc, cmd.decision);
      if (d.section !== section) {
        section = d.section;
        const h = document.createElement('h2');
        h.textContent = T.decisionSections[section];
        choices.append(h);
      }
      if (d.special?.kind === 'swiss') {
        for (const share of [1, 2, 3, 4] as const) {
          choices.append(button(`${d.title} (${T.swissShare(share)})`, String(key++), () => play({ ...cmd, share })));
        }
        continue;
      }
    }
    choices.append(button(commandLabel(cmd), key <= 9 ? String(key) : '', () => play(cmd)));
    key++;
  }
}

function startNew(): void {
  const { state, events } = newGame(sc, randomSeed());
  file = newSave(sc.id, state);
  lastReport = null;
  log = events.map(describe).filter((x): x is string => x !== null);
  saveJson(SAVE_KEY, file);
  render();
}

window.addEventListener('keydown', (ev) => {
  const b = document.querySelector<HTMLButtonElement>(`#choices button[data-key="${ev.key}"]`);
  if (b) b.click();
});

render();
```

- [ ] **Step 4: Register the page**

In `vite.config.ts`, add the entry to `rollupOptions.input`:

```ts
      input: {
        main: 'index.html',
        spy: 'src/games/spy-vs-spy/index.html',
        diktator: 'src/games/diktator/index.html',
      },
```

- [ ] **Step 5: Type check and build**

Run: `npx tsc --noEmit && npm run build`
Expected: no errors; `dist/src/games/diktator/index.html` exists.

- [ ] **Step 6: Try it in the browser**

Run: `npm run dev` and open `http://localhost:5173/src/games/diktator/index.html`.
Check by hand:
1. "Nová hra" starts in "Zima 1925" with an audience and the treasury at 940.
2. Number keys press the matching buttons.
3. Buying a police report shows the table with bars and plots.
4. The Swiss account offers four shares.
5. Reloading the page offers "Pokračovat" and resumes the same quarter.
6. Play until the game ends (answer quickly); the ending text, score and "Zkusit znovu od ledna …" appear, and retry returns to a Q1 audience.

- [ ] **Step 7: Commit**

```bash
git add src/shared/i18n/cs.ts src/games/diktator/index.html src/games/diktator/style.css src/games/diktator/main.ts vite.config.ts
git commit -m "feat(diktator): playable text mode"
```

---

### Task 14: Hub card and README

**Files:**
- Modify: `index.html` (the hub)
- Modify: `README.md`

- [ ] **Step 1: Add the hub card**

In `index.html`, inside `<ul class="games">`, after the Spy vs Spy `<li>…</li>`, add:

```html
        <li>
          <a class="card" href="./src/games/diktator/index.html">
            <h2>Diktátor</h2>
            <p class="subtitle">Tirana, 1925</p>
            <p>Král Zogu a jeho velitel gardy drží Albánii do roku 1939. Zatím textová verze.</p>
          </a>
        </li>
```

- [ ] **Step 2: Add the README entry**

In `README.md`, under `## Games`, after the Spy vs Spy entry, add:

```markdown
- **Diktátor** — a remake of Don Priestley's *Dictator* (1983) set in King Zog's Albania, 1925–1939.
  - Plan 1: the original rules as a pure engine (one turn = one quarter) and a text mode. The palace, the newspaper and the march on Tirana follow (see `docs/superpowers/plans/`).
```

- [ ] **Step 3: Full check**

Run: `npx vitest run && npm run build`
Expected: all tests pass, build succeeds.

- [ ] **Step 4: Commit**

```bash
git add index.html README.md
git commit -m "feat(diktator): hub card and readme entry"
```

---

## Self-review notes (done while writing)

- **Spec coverage for plan 1:** §2.1 group names → Task 4; §4.1 turn order incl. the deviation → Task 11; §4.2 plots → Task 5; §8 original records, Swiss share, plane, aid → Tasks 4, 8; §9 crises, the "on your own" fix, endings, score (9 per quarter), retry → Tasks 9–12; §10 save → Task 12; §13 formula tests, determinism, bot playthrough, save → Tasks 1–12; §14 page, hub card, README, strings → Tasks 13–14. The palace (§5), newspaper (§7), march (§6), art (§11) and controls (§12) are plans 2–6.
- **Deliberate differences from the original, all visible in code comments:** evening order (spec §4.1), `goAway`/`suggestOther` (spec §4.1), the Swiss share (spec §8), the "on your own" fix (spec §9). The audience draw scans all petitions instead of the original 22 steps (a quirk with no gameplay meaning).
- **Type names used across tasks:** `GameState`, `Phase`, `Ending`, `GameEvent`, `Command`, `StartingRegime`, `PoliceSnapshot` (Task 3); `Dice`, `rngDice` (Task 1); `Effects`, `Petition`, `Decision`, `NewsItem`, `affordable`, `applyEffects`, `clamp` (Task 2); `formPlots` (5); `settleTreasury`, `policeReport` (6); `drawPetition`, `answerPetition`, `suggestOther`, `petitionById` (7); `takeDecision`, `availableDecisions`, `decisionById` (8); `assassination`, `war` (9); `maybeNews`, `findRevolution`, `flee`, `throughMountains`, `eligibleAllies`, `fightRevolution`, `afterVictory`, `score` (10); `newGame`, `advance`, `validCommands`, `quarterLabel` (11); `newSave`, `recordTurn`, `retryFromYear`, `serialize`, `deserialize` (12).
