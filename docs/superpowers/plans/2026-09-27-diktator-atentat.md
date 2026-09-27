# Diktátor — Atentát ("Najdi střelce") and the mini-game arena Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every assassination attempt in the palace game becomes the co-op scene "Najdi střelce". The palace halves merge into one big play screen, and Vlček's player hunts the gunman in a crowd with a magnifying glass. Finding him saves Zogu; missing him falls back to the original odds.

**Architecture:**
- **Rules** (`logic/`): the evening pauses in a new phase `attempt`, carrying the faction, the place, the difficulty and a seed. A new command `attemptResult` resumes it.
- **Scene simulation** (`minigames/spot/logic.ts`): pure, seeded and tested.
- **Drawing** (`minigames/spot/render.ts`): uses our puppets, which gain accessories.
- **Arena** (`minigames/arena.ts`): the shared mini-game interface.
- **Page** (`main.ts`): a new `arena` screen.

**Tech Stack:** TypeScript strict, Vite, Vitest, Canvas 2D, DOM overlays, Web Audio recipes. No runtime dependencies.

**Spec:** `docs/superpowers/specs/2026-09-27-diktator-atentat-design.md` — this is the authority.

## Global constraints

- Pure modules (`logic/`, `minigames/*/logic.ts`, `ui/*.ts` except `ui/dom.ts`) touch no DOM or `window`, and use no `Math.random`; randomness comes from `Dice` / `RngState`.
- Czech text lives only in `src/shared/i18n/cs.ts`, under the new block `cs.diktator.atentat`.
- Canvas code keeps `save`/`restore` balanced, and every world-angle rotation is negated (puppet convention).
- Classic text mode (no palace) keeps the original assassination coin **bit for bit**: the same dice consumption, and all existing tests green.
- Before each commit, `npm test` must be green and `npx tsc --noEmit` clean. After Tasks 4 and 5, `npm run build` must also succeed.
- Each commit body ends with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- The heroes are Zogu (`zogu`) and Vlček (`velitel`).

## File map

| File | Task | Responsibility |
|---|---|---|
| `logic/rules.ts`, `logic/state.ts`, `logic/assassination.ts`, `logic/attempt.ts` (new), `logic/turn.ts`, `ui/screens.ts`, `ui/event-text.ts`, `cs.ts` | 1 | the attempt phase, difficulty, resume |
| `minigames/spot/logic.ts` (new) | 2 | the scene simulation |
| `render/puppet/looks.ts`, `render/puppet/poses.ts`, `render/puppet/skeleton.ts`, `render/puppet/draw.ts` | 3 | scarves, glasses, bags, hand in the coat |
| `minigames/arena.ts` (new), `minigames/spot/game.ts` (new), `minigames/spot/render.ts` (new), `cs.ts` | 4 | the arena interface; the game object; the drawing |
| `index.html`, `palace.css`, `ui/dom.ts`, `main.ts`, `ui/sounds.ts` | 5 | the merged screen, cards, sounds, wiring |

---

### Task 1: The rules pause for an attempt

**Files:**
- Modify: `src/games/diktator/logic/rules.ts`, `logic/state.ts`, `logic/assassination.ts`, `logic/turn.ts`, `ui/screens.ts`, `ui/event-text.ts`, `src/shared/i18n/cs.ts`
- Create: `src/games/diktator/logic/attempt.ts`
- Test: `tests/diktator/attempt.test.ts`

- [ ] **Step 1: Constants.** In `rules.ts`, inside `RULES`, add:

```ts
  /** Atentát difficulty (spec 2026-09-27-diktator-atentat-design §4; our addition). */
  attempt: {
    baseSeconds: 40, guardedBonus: 15, strengthStep: 2, strongFrom: 5, minSeconds: 25, maxSeconds: 60,
    baseCrowd: 10, maxCrowd: 20, maxWrong: 3, wrongPenalty: 6, loyalPolice: 7,
  },
```

- [ ] **Step 2: Types** (`state.ts`):

```ts
/** Where an attempt happens (v1 places; more come with the art). */
export type PlaceId = 'trziste' | 'dustojnici';

/** How hard "Najdi střelce" is, fixed when the attempt strikes. */
export interface AttemptDifficulty {
  /** The fuse, seconds. */
  readonly seconds: number;
  /** Attributes of the gunman the police tip names, 0–3. */
  readonly clues: number;
  /** People in the crowd, gunman included. */
  readonly crowd: number;
  readonly maxWrong: number;
}
```

  Also:
  - Add to `Phase`: `| { readonly kind: 'attempt'; readonly faction: FactionId; readonly place: PlaceId; readonly difficulty: AttemptDifficulty; readonly seed: number }`.
  - Add to `Command`: `| { readonly type: 'attemptResult'; readonly found: boolean }`.
  - `GameEvent`: the `assassination` variant gains `readonly foiled?: true`, and there is a new variant `| { readonly type: 'attempt'; readonly faction: FactionId; readonly place: PlaceId }`.
  - Bump `GameState.version` to 6 and `SAVE_VERSION` to 6 (the phase shape changed), and update `tests/diktator/state.test.ts` with the comment "bumped for the attempt phase".

- [ ] **Step 3: Write the tests.** Create `tests/diktator/attempt.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { attemptDifficulty, attemptPlace } from '../../src/games/diktator/logic/attempt';
import { survivesUnfound } from '../../src/games/diktator/logic/assassination';
import { advance, validCommands } from '../../src/games/diktator/logic/turn';
import type { GameState } from '../../src/games/diktator/logic/state';
import { albania } from '../../src/games/diktator/scenario/albania';
import { palaceDay, scriptedDice } from './helpers';

function allPlotting(s: GameState): GameState {
  s.plots = { armada: { kind: 'assassination' }, rolnici: { kind: 'assassination' }, statkari: { kind: 'assassination' } };
  return s;
}

/** Both heroes end the quarter with every faction plotting an assassination → the evening meets an attempt. */
function nightOfAttempt(): { before: GameState; after: GameState } {
  let s = allPlotting(palaceDay());
  s = advance(albania, s, { type: 'endDay', hero: 'velitel' }).state;
  const before = allPlotting(s);
  const after = advance(albania, before, { type: 'endDay', hero: 'zogu' }).state;
  return { before, after };
}

describe('attempt difficulty', () => {
  it('gives more time when Vlček guards and less against a strong faction, within 25–60 s', () => {
    const s = palaceDay();
    s.str.armada = 5;
    expect(attemptDifficulty(s, 'armada').seconds).toBe(40);
    s.palace!.guarded = true;
    expect(attemptDifficulty(s, 'armada').seconds).toBe(55);
    s.palace!.guarded = false;
    s.str.armada = 9;
    expect(attemptDifficulty(s, 'armada').seconds).toBe(32);
    s.str.armada = 30;
    expect(attemptDifficulty(s, 'armada').seconds).toBe(25);
  });

  it('gives no clue when the police are hostile, up to three when they are loyal and strong', () => {
    const s = palaceDay();
    s.low = 3;
    s.pop.policie = 3;
    expect(attemptDifficulty(s, 'armada').clues).toBe(0);
    s.pop.policie = 5; s.str.policie = 5;
    expect(attemptDifficulty(s, 'armada').clues).toBe(1);
    s.pop.policie = 8; s.str.policie = 8;
    expect(attemptDifficulty(s, 'armada').clues).toBe(3);
  });

  it('grows the crowd with the plotters, at most 20; three wrong accusations', () => {
    const s = palaceDay();
    s.str.rolnici = 4;
    expect(attemptDifficulty(s, 'rolnici').crowd).toBe(14);
    s.str.rolnici = 15;
    expect(attemptDifficulty(s, 'rolnici').crowd).toBe(20);
    expect(attemptDifficulty(s, 'rolnici').maxWrong).toBe(3);
  });

  it('places the army in the officers’ mess, everyone else at the market', () => {
    expect(attemptPlace('armada')).toBe('dustojnici');
    expect(attemptPlace('rolnici')).toBe('trziste');
    expect(attemptPlace('statkari')).toBe('trziste');
  });
});

describe('the unfound gunman — the original odds', () => {
  it('is fatal when all three factions plot', () => {
    expect(survivesUnfound(allPlotting(palaceDay()), scriptedDice([]))).toBe(false);
  });
  it('is survived when the police are friendly or strong, without a coin', () => {
    const s = palaceDay();
    s.plots.armada = { kind: 'assassination' };
    s.low = 3; s.pop.policie = 5; s.str.policie = 2;
    expect(survivesUnfound(s, scriptedDice([]))).toBe(true);
  });
  it('otherwise tosses the coin, four-sided when Vlček guarded', () => {
    const s = palaceDay();
    s.plots.armada = { kind: 'assassination' };
    s.low = 5; s.pop.policie = 2; s.str.policie = 2;
    expect(survivesUnfound(s, scriptedDice([0]))).toBe(false);
    expect(survivesUnfound(s, scriptedDice([1]))).toBe(true);
    s.palace!.guarded = true;
    expect(survivesUnfound(s, scriptedDice([3]))).toBe(true);
  });
});

describe('the evening pauses for an attempt (palace mode)', () => {
  it('stops in the attempt phase with a place, a difficulty and a seed', () => {
    const { after } = nightOfAttempt();
    expect(after.phase.kind).toBe('attempt');
    if (after.phase.kind !== 'attempt') return;
    expect(['trziste', 'dustojnici']).toContain(after.phase.place);
    expect(after.phase.difficulty.maxWrong).toBe(3);
    expect(Number.isInteger(after.phase.seed)).toBe(true);
    expect(validCommands(albania, after)).toEqual([
      { type: 'attemptResult', found: true },
      { type: 'attemptResult', found: false },
    ]);
  });

  it('a found gunman saves Zogu, breaks that faction’s plot and lets the evening go on', () => {
    const { after } = nightOfAttempt();
    if (after.phase.kind !== 'attempt') throw new Error('no attempt');
    const faction = after.phase.faction;
    const r = advance(albania, after, { type: 'attemptResult', found: true });
    expect(r.events[0]).toEqual({ type: 'assassination', faction, survived: true, foiled: true });
    expect(r.state.phase.kind).not.toBe('attempt');
    expect(r.state.phase.kind === 'ended' && r.state.phase.ending.kind === 'killed' && r.state.phase.ending.cause === 'assassination').toBe(false);
  });

  it('a missed gunman with all three plotting ends the reign', () => {
    const { after } = nightOfAttempt();
    const r = advance(albania, after, { type: 'attemptResult', found: false });
    expect(r.state.phase).toEqual({ kind: 'ended', ending: { kind: 'killed', cause: 'assassination' } });
  });

  it('refuses attemptResult outside the attempt phase', () => {
    expect(() => advance(albania, palaceDay(), { type: 'attemptResult', found: true })).toThrow();
  });
});
```

- [ ] **Step 4: Run the tests to see them fail.** Run `npx vitest run tests/diktator/attempt.test.ts`. Expected: FAIL, because the modules are missing.

- [ ] **Step 5: Split `assassination.ts`.** The dice consumption stays identical to the original:

```ts
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
 * L1510–1560, the ruler's chances when the gunman is not stopped: all three plotting is fatal; otherwise a friendly or
 * strong police saves him, and failing that a coin (4-sided when the commander guarded, palace mode).
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
```

- [ ] **Step 6: Create `logic/attempt.ts`:**

```ts
// The Atentát mini-game's inputs from the rules (spec 2026-09-27-diktator-atentat-design §4). Pure.

import type { FactionId } from './groups';
import { RULES } from './rules';
import type { AttemptDifficulty, GameState, PlaceId } from './state';

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export function attemptDifficulty(s: GameState, faction: FactionId): AttemptDifficulty {
  const A = RULES.attempt;
  const guarded = s.palace?.guarded ?? false;
  const seconds = clamp(
    A.baseSeconds + (guarded ? A.guardedBonus : 0) - A.strengthStep * Math.max(0, s.str[faction] - A.strongFrom),
    A.minSeconds,
    A.maxSeconds,
  );
  const hostile = s.pop.policie <= s.low;
  const clues = hostile ? 0 : 1 + (s.pop.policie >= A.loyalPolice ? 1 : 0) + (s.str.policie >= A.loyalPolice ? 1 : 0);
  const crowd = Math.min(A.maxCrowd, A.baseCrowd + s.str[faction]);
  return { seconds, clues, crowd, maxWrong: A.maxWrong };
}

export function attemptPlace(faction: FactionId): PlaceId {
  return faction === 'armada' ? 'dustojnici' : 'trziste';
}
```

- [ ] **Step 7: Rework the evening** (`turn.ts`). Split `evening` into the part up to the attempt and `afterAttempt` (the rest):

```ts
function evening(sc: Scenario, s: GameState, dice: Dice, events: GameEvent[]): void {
  if (s.palace) {
    const faction = attemptStrikes(s, dice);
    if (faction) {
      const place = attemptPlace(faction);
      s.phase = { kind: 'attempt', faction, place, difficulty: attemptDifficulty(s, faction), seed: dice.int(0x7fffffff) };
      events.push({ type: 'attempt', faction, place });
      return;
    }
  } else if (assassination(s, dice, events)) {
    return end(s, { kind: 'killed', cause: 'assassination' }, events);
  }
  afterAttempt(sc, s, dice, events);
}

/** The evening after the attempt (or without one): war, plots, news, revolution, the next quarter. */
function afterAttempt(sc: Scenario, s: GameState, dice: Dice, events: GameEvent[]): void {
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
```

  Check that `dice.int` accepts `0x7fffffff`. If it doesn't, use the largest bound it accepts, and report that.

  In `advance`'s phase switch, add:

```ts
    case 'attempt': {
      if (cmd.type !== 'attemptResult') throw invalid();
      if (cmd.found) {
        events.push({ type: 'assassination', faction: phase.faction, survived: true, foiled: true });
        s.plots[phase.faction] = { kind: 'none' };
      } else {
        const survived = survivesUnfound(s, dice);
        events.push({ type: 'assassination', faction: phase.faction, survived });
        if (!survived) {
          end(s, { kind: 'killed', cause: 'assassination' }, events);
          break;
        }
      }
      afterAttempt(sc, s, dice, events);
      break;
    }
```

  In `validCommands`, add `case 'attempt': return [{ type: 'attemptResult', found: true }, { type: 'attemptResult', found: false }];`.

  The palace branch at the top of `advance` only handles `audience`/`day`, so `attempt` falls through to the switch; check this. Also update the palace bot playthrough if it needs the new commands. It picks from `validCommands`, so it should work as is.

- [ ] **Step 8: Screens and texts.**
  - `ui/screens.ts`:
    - `phaseScreen` returns `null` for `attempt`; the arena shows it, not a phase screen.
    - In `cardsFor`, treat `before.phase.kind === 'attempt'` like `day` for "the evening ran". Its events (the assassination line, news and so on) go to the evening card.
    - Lines from `attempt` events are none.
  - `cs.ts`: add a block `diktator.atentat` with these strings, which Task 4 extends:

```ts
    atentat: {
      foiled: (group: string) => `Vlček zadržel střelce (${group}). Král je v bezpečí!`,
    },
```

  - `ui/event-text.ts`: an `assassination` event with `foiled` gives `T.atentat.foiled(name(e.faction))`. `attempt` gives `null`.
  - Add tests in `tests/diktator/screens.test.ts`: `phaseScreen` of an attempt state is `null`, and `cardsFor(before=attempt, [foiled assassination, …, quarterStarted], after)` yields an evening card containing the foiled line.

- [ ] **Step 9: Run and commit.** Run `npx vitest run tests/diktator` (PASS), then `npm test` (green; classic assassination tests unchanged) and `npx tsc --noEmit` (clean; fix any non-exhaustive switches on `phase.kind` across `src`, e.g. `main.ts`, by handling `attempt` sensibly or leaving it to Task 5 with a `default`). Then commit:

```bash
git add -A src/games/diktator src/shared/i18n/cs.ts tests/diktator
git commit -m "feat(diktator): the evening pauses for an assassination attempt"
```

---

### Task 2: The scene simulation (pure, seeded)

**Files:**
- Create: `src/games/diktator/minigames/spot/logic.ts`
- Test: `tests/diktator/spot.test.ts`

- [ ] **Step 1: Write the tests.** Create `tests/diktator/spot.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { accuse, createSpot, matchesClues, redHerrings, spotResult, stepSpot, type SpotInput } from '../../src/games/diktator/minigames/spot/logic';
import type { AttemptDifficulty } from '../../src/games/diktator/logic/state';

const IDLE: SpotInput = { moveX: 0, moveY: 0 };
const diff = (clues: number, crowd = 14, seconds = 40): AttemptDifficulty => ({ seconds, clues, crowd, maxWrong: 3 });

describe('the crowd generator', () => {
  it('always makes exactly one person match every clue — the gunman — and plants red herrings', () => {
    for (let seed = 1; seed <= 300; seed++) {
      for (const clues of [1, 2, 3]) {
        const s = createSpot(diff(clues), 'trziste', seed);
        expect(s.people).toHaveLength(14);
        expect(s.clues).toHaveLength(clues);
        const matching = s.people.filter((p) => matchesClues(p, s.clues));
        expect(matching).toHaveLength(1);
        expect(matching[0].gunman).toBe(true);
        expect(redHerrings(s).length).toBeGreaterThanOrEqual(2);
      }
    }
  });

  it('gives no clue when the police know nothing', () => {
    const s = createSpot(diff(0), 'dustojnici', 7);
    expect(s.clues).toEqual([]);
    expect(s.people.filter((p) => p.gunman)).toHaveLength(1);
  });

  it('is deterministic from the seed', () => {
    expect(createSpot(diff(2), 'trziste', 42)).toEqual(createSpot(diff(2), 'trziste', 42));
  });
});

describe('the scene', () => {
  it('brings the gunman closer to Zogu as the fuse burns', () => {
    const s = createSpot(diff(1, 14, 40), 'trziste', 5);
    const gun = () => s.people.find((p) => p.gunman)!;
    const d0 = Math.abs(gun().x - s.zoguX);
    for (let i = 0; i < 20 * 60; i++) stepSpot(s, 1 / 60, IDLE);
    expect(Math.abs(gun().x - s.zoguX)).toBeLessThan(d0);
  });

  it('moves the glass with the input and keeps it on screen', () => {
    const s = createSpot(diff(1), 'trziste', 3);
    const x0 = s.glass.x;
    stepSpot(s, 0.5, { moveX: 1, moveY: 0 });
    expect(s.glass.x).toBeGreaterThan(x0);
    for (let i = 0; i < 100; i++) stepSpot(s, 0.5, { moveX: 1, moveY: 1 });
    expect(s.glass.x).toBeLessThanOrEqual(960);
    expect(s.glass.y).toBeLessThanOrEqual(540);
  });

  it('ends missed when the fuse burns out, with the result 1.5 s later', () => {
    const s = createSpot(diff(1, 10, 25), 'trziste', 9);
    for (let i = 0; i < 25 * 60 + 1; i++) stepSpot(s, 1 / 60, IDLE);
    expect(s.outcome).toBe('missed');
    expect(spotResult(s)).toBeNull();
    for (let i = 0; i < 100; i++) stepSpot(s, 1 / 60, IDLE);
    expect(spotResult(s)).toBe('missed');
  });

  it('finds the gunman when accused under the glass', () => {
    const s = createSpot(diff(1), 'trziste', 11);
    const g = s.people.find((p) => p.gunman)!;
    s.glass = { x: g.x, y: g.y - 40 };
    accuse(s);
    expect(s.outcome).toBe('found');
  });

  it('costs 6 s per wrong accusation and gives up after three', () => {
    const s = createSpot(diff(1, 14, 40), 'trziste', 13);
    const innocents = s.people.filter((p) => !p.gunman);
    for (let i = 0; i < 3; i++) {
      const p = innocents[i];
      s.glass = { x: p.x, y: p.y - 40 };
      const before = s.fuse;
      accuse(s);
      if (i < 2) expect(s.fuse).toBeCloseTo(before - 6);
    }
    expect(s.wrong).toBe(3);
    expect(s.outcome).toBe('missed');
  });

  it('does nothing when nobody is under the glass', () => {
    const s = createSpot(diff(1), 'trziste', 17);
    s.glass = { x: 480, y: 70 };
    accuse(s);
    expect(s.wrong).toBe(0);
    expect(s.outcome).toBeNull();
  });
});
```

  The wrong-accusation test puts the glass exactly on each innocent. If two people overlap, `personUnderGlass` may pick another innocent, which is fine, but it must never pick the gunman while the glass sits on an innocent's centre. If this collides in the test data, move the glass to that person's exact hit point and report it.

- [ ] **Step 2: Run to see it fail.**

- [ ] **Step 3: Implement `minigames/spot/logic.ts`:**

```ts
// "Najdi střelce" — the scene simulation (spec 2026-09-27-diktator-atentat-design §5). Pure and seeded: the same
// difficulty, place and seed always give the same crowd and gunman. Scene coordinates: 960 × 540, y down.

import { makeRng, type RngState } from '../../../../shared/rng';
import { rngDice, type Dice } from '../../logic/dice';
import { RULES } from '../../logic/rules';
import type { AttemptDifficulty, PlaceId } from '../../logic/state';

export type SpotHat = 'none' | 'fez' | 'cap' | 'plis' | 'borsalino';
export type SpotScarf = 'none' | 'red' | 'blue' | 'green' | 'yellow';

export interface SpotPerson {
  readonly id: number;
  x: number;
  /** Feet on the ground line, 330 (far) … 480 (near). */
  readonly y: number;
  dir: -1 | 1;
  readonly speed: number;
  readonly standing: boolean;
  readonly hat: SpotHat;
  readonly scarf: SpotScarf;
  /** Index into the place's coat palette, 0–4. */
  readonly coat: number;
  readonly glasses: boolean;
  readonly bag: boolean;
  readonly gunman: boolean;
  /** The gunman glances around while this is true. */
  glancing: boolean;
  /** Time (scene seconds) until the next glance toggle. */
  glanceIn: number;
  /** Shows a protest bubble until this time. */
  protestUntil: number;
}

export type ClueKey = 'hat' | 'scarf' | 'glasses' | 'bag';
export type Clue =
  | { readonly key: 'hat'; readonly value: SpotHat }
  | { readonly key: 'scarf'; readonly value: SpotScarf }
  | { readonly key: 'glasses'; readonly value: true }
  | { readonly key: 'bag'; readonly value: true };

export interface SpotInput { readonly moveX: number; readonly moveY: number }

export interface SpotState {
  readonly place: PlaceId;
  readonly difficulty: AttemptDifficulty;
  rng: RngState;
  t: number;
  people: SpotPerson[];
  readonly clues: readonly Clue[];
  zoguX: number;
  zoguTarget: number;
  zoguNextMove: number;
  glass: { x: number; y: number };
  fuse: number;
  wrong: number;
  outcome: 'found' | 'missed' | null;
  /** Scene time the outcome was decided (the ending animation runs 1.5 s). */
  endAt: number;
  /** The person accused last (for the tackle / protest drawing), or -1. */
  lastAccused: number;
}

export const SPOT_W = 960;
export const SPOT_H = 540;
export const GROUND_FAR = 330;
export const GROUND_NEAR = 480;
export const PLATFORM = { left: 390, right: 570 } as const;
const GLASS_SPEED = 320;
const ENDING_SECONDS = 1.5;

const HATS: readonly SpotHat[] = ['none', 'fez', 'cap', 'plis', 'borsalino'];
const SCARVES: readonly SpotScarf[] = ['none', 'red', 'blue', 'green', 'yellow'];

/** Scale of a person at ground line y (far people are smaller). */
export function depthScale(y: number): number {
  return 0.75 + 0.35 * ((y - GROUND_FAR) / (GROUND_NEAR - GROUND_FAR));
}

export function matchesClues(p: SpotPerson, clues: readonly Clue[]): boolean {
  return clues.every((c) => (c.key === 'glasses' ? p.glasses : c.key === 'bag' ? p.bag : p[c.key] === c.value));
}

function pick<T>(d: Dice, xs: readonly T[]): T {
  return xs[d.int(xs.length)];
}

function shuffle<T>(d: Dice, xs: readonly T[]): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = d.int(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Makes `p` fail clue `c` (changes only that attribute). */
function breakClue(d: Dice, p: SpotPerson, c: Clue): SpotPerson {
  switch (c.key) {
    case 'hat': return { ...p, hat: pick(d, HATS.filter((h) => h !== c.value)) };
    case 'scarf': return { ...p, scarf: pick(d, SCARVES.filter((s) => s !== c.value)) };
    case 'glasses': return { ...p, glasses: false };
    case 'bag': return { ...p, bag: false };
  }
}

/** Makes `p` look like clue `c` without matching it: another real hat, another scarf colour, the other accessory. */
function similarTo(d: Dice, p: SpotPerson, c: Clue): SpotPerson {
  switch (c.key) {
    case 'hat': return { ...p, hat: pick(d, HATS.filter((h) => h !== 'none' && h !== c.value)) };
    case 'scarf': return { ...p, scarf: pick(d, SCARVES.filter((x) => x !== 'none' && x !== c.value)) };
    case 'glasses': return { ...p, glasses: false, bag: true };
    case 'bag': return { ...p, bag: false, glasses: true };
  }
}

/**
 * Innocents that look like the tip: with two or more clues, those sharing at least one clue; with a single clue,
 * those with a similar attribute (another real hat / scarf colour, or the other accessory).
 */
export function redHerrings(s: SpotState): SpotPerson[] {
  const innocents = s.people.filter((p) => !p.gunman);
  if (s.clues.length >= 2) return innocents.filter((p) => s.clues.some((c) => matchesClues(p, [c])));
  if (s.clues.length === 0) return [];
  const c = s.clues[0];
  return innocents.filter((p) =>
    c.key === 'hat' ? p.hat !== 'none' && p.hat !== c.value
    : c.key === 'scarf' ? p.scarf !== 'none' && p.scarf !== c.value
    : c.key === 'glasses' ? p.bag
    : p.glasses);
}

/** Makes `p` share clue `c`. */
function shareClue(p: SpotPerson, c: Clue): SpotPerson {
  switch (c.key) {
    case 'hat': return { ...p, hat: c.value };
    case 'scarf': return { ...p, scarf: c.value };
    case 'glasses': return { ...p, glasses: true };
    case 'bag': return { ...p, bag: true };
  }
}

export function createSpot(difficulty: AttemptDifficulty, place: PlaceId, seed: number): SpotState {
  const rng = makeRng(seed);
  const d = rngDice(rng);
  const n = difficulty.crowd;
  const fromLeft = d.int(2) === 0;
  const person = (id: number, gunman: boolean): SpotPerson => {
    const standing = !gunman && d.int(10) < 3;
    return {
      id,
      x: gunman ? (fromLeft ? 70 : SPOT_W - 70) : 60 + d.float() * (SPOT_W - 120),
      y: GROUND_FAR + d.float() * (GROUND_NEAR - GROUND_FAR),
      dir: d.int(2) === 0 ? -1 : 1,
      speed: standing ? 0 : 18 + d.float() * 22,
      standing,
      hat: pick(d, HATS),
      scarf: pick(d, SCARVES),
      coat: d.int(5),
      glasses: d.int(5) === 0,
      bag: d.int(4) === 0,
      gunman,
      glancing: false,
      glanceIn: 2 + d.float() * 2,
      protestUntil: -1,
    };
  };
  let gunman = person(0, true);
  const keys = shuffle(d, ['hat', 'scarf', 'glasses', 'bag'] as const).slice(0, difficulty.clues);
  // The gunman's clue attributes are always "something to see": a real hat, a coloured scarf, glasses, a bag.
  for (const k of keys) {
    if (k === 'hat' && gunman.hat === 'none') gunman = { ...gunman, hat: pick(d, HATS.slice(1)) };
    if (k === 'scarf' && gunman.scarf === 'none') gunman = { ...gunman, scarf: pick(d, SCARVES.slice(1)) };
    if (k === 'glasses') gunman = { ...gunman, glasses: true };
    if (k === 'bag') gunman = { ...gunman, bag: true };
  }
  const clues: Clue[] = keys.map((k): Clue => {
    switch (k) {
      case 'hat': return { key: 'hat', value: gunman.hat };
      case 'scarf': return { key: 'scarf', value: gunman.scarf };
      case 'glasses': return { key: 'glasses', value: true };
      case 'bag': return { key: 'bag', value: true };
    }
  });
  let innocents = Array.from({ length: n - 1 }, (_, i) => person(i + 1, false));
  // Nobody else may match every clue.
  innocents = innocents.map((p) => (clues.length > 0 && matchesClues(p, clues) ? breakClue(d, p, pick(d, clues)) : p));
  // Red herrings: at least two innocents look like the tip without matching it all. With two or more clues they share
  // one clue each; with a single clue they wear something similar (another hat, another scarf colour, or the other
  // accessory), because sharing the only clue would make them match it.
  if (clues.length > 0) {
    for (let i = 0; i < 2 && i < innocents.length; i++) {
      const c = clues[i % clues.length];
      innocents[i] = clues.length >= 2 ? shareClue(innocents[i], c) : similarTo(d, innocents[i], c);
      if (matchesClues(innocents[i], clues)) innocents[i] = breakClue(d, innocents[i], clues.find((o) => o.key !== c.key) ?? c);
    }
  }
  // Mix the gunman into the crowd at a random index (ids stay unique).
  const people = [...innocents];
  people.splice(d.int(people.length + 1), 0, gunman);
  const zoguX = (PLATFORM.left + PLATFORM.right) / 2;
  return {
    place, difficulty, rng, t: 0, people, clues,
    zoguX, zoguTarget: zoguX, zoguNextMove: 3,
    glass: { x: SPOT_W / 2, y: 200 },
    fuse: difficulty.seconds, wrong: 0, outcome: null, endAt: 0, lastAccused: -1,
  };
}
```

  The invariant that must hold for every clue count is **exactly one person matches every clue** (the gunman).

```ts
/** The person under the glass: the nearest one whose body box (depth-scaled) contains it. */
export function personUnderGlass(s: SpotState): SpotPerson | null {
  let best: SpotPerson | null = null;
  let bestD = Infinity;
  for (const p of s.people) {
    const k = depthScale(p.y);
    const inside = Math.abs(s.glass.x - p.x) <= 20 * k && s.glass.y <= p.y && s.glass.y >= p.y - 110 * k;
    if (!inside) continue;
    const dist = Math.abs(s.glass.x - p.x) + Math.abs(s.glass.y - (p.y - 55 * k));
    if (dist < bestD) { bestD = dist; best = p; }
  }
  return best;
}

export function accuse(s: SpotState): void {
  if (s.outcome) return;
  const p = personUnderGlass(s);
  if (!p) return;
  s.lastAccused = p.id;
  if (p.gunman) {
    s.outcome = 'found';
    s.endAt = s.t;
    return;
  }
  s.wrong += 1;
  s.fuse = Math.max(0, s.fuse - RULES.attempt.wrongPenalty);
  p.protestUntil = s.t + 2;
  if (s.wrong >= s.difficulty.maxWrong) {
    s.outcome = 'missed';
    s.endAt = s.t;
  }
}

export function stepSpot(s: SpotState, dt: number, input: SpotInput): void {
  s.t += dt;
  if (s.outcome) return;
  const d = rngDice(s.rng);
  s.fuse -= dt;
  if (s.fuse <= 0) {
    s.fuse = 0;
    s.outcome = 'missed';
    s.endAt = s.t;
    return;
  }
  s.glass.x = Math.max(0, Math.min(SPOT_W, s.glass.x + input.moveX * GLASS_SPEED * dt));
  s.glass.y = Math.max(60, Math.min(SPOT_H, s.glass.y + input.moveY * GLASS_SPEED * dt));
  // Zogu walks along his platform between greetings.
  s.zoguNextMove -= dt;
  if (s.zoguNextMove <= 0) {
    s.zoguTarget = PLATFORM.left + 20 + d.float() * (PLATFORM.right - PLATFORM.left - 40);
    s.zoguNextMove = 3 + d.float() * 3;
  }
  s.zoguX += Math.sign(s.zoguTarget - s.zoguX) * Math.min(Math.abs(s.zoguTarget - s.zoguX), 30 * dt);
  for (const p of s.people) {
    if (p.gunman) {
      // He works his way to Zogu, arriving about when the fuse ends.
      const gap = s.zoguX - p.x;
      const speed = Math.max(12, Math.abs(gap) / Math.max(1, s.fuse));
      if (Math.abs(gap) > 30) {
        p.dir = gap > 0 ? 1 : -1;
        p.x += p.dir * Math.min(Math.abs(gap) - 30, speed * dt);
      }
      p.glanceIn -= dt;
      if (p.glanceIn <= 0) {
        p.glancing = !p.glancing;
        p.glanceIn = p.glancing ? 0.8 : 2 + d.float() * 2;
      }
    } else if (!p.standing) {
      p.x += p.dir * p.speed * dt;
      if (p.x < 40) { p.x = 40; p.dir = 1; }
      if (p.x > SPOT_W - 40) { p.x = SPOT_W - 40; p.dir = -1; }
    }
  }
}

/** The scene's result once the ending animation (1.5 s) has played, else null. */
export function spotResult(s: SpotState): 'found' | 'missed' | null {
  return s.outcome && s.t - s.endAt >= ENDING_SECONDS ? s.outcome : null;
}
```

- [ ] **Step 4: Run the tests** (PASS), then `npm test` and `npx tsc --noEmit`. Commit: `feat(diktator): "Najdi střelce" — the scene simulation`.

---

### Task 2b: Hidden weapons and things people carry (play-test change, spec §5a)

**Files:**
- Modify: `src/games/diktator/minigames/spot/logic.ts`
- Modify: `tests/diktator/spot.test.ts`

- [ ] **Step 1: Types.** Add:

```ts
export type SpotCarry = 'none' | 'newspaper' | 'basket' | 'bouquet';
export type SpotWeapon = 'newspaperPistol' | 'appleGrenade' | 'bouquetBomb' | 'coatRevolver';
```

  `SpotPerson` gains:
  - `readonly carry: SpotCarry`;
  - `readonly handInCoat: boolean`;
  - `readonly weapon: SpotWeapon | null` (non-null only for the gunman).

  `SpotState` gains `readonly weapon: SpotWeapon`. Export `carryOf(w: SpotWeapon): SpotCarry`:
  - `newspaperPistol` gives `newspaper`;
  - `appleGrenade` gives `basket`;
  - `bouquetBomb` gives `bouquet`;
  - `coatRevolver` gives `none`.

- [ ] **Step 2: Generator** (in `createSpot`, after the crowd is built, using the same dice so it stays deterministic):
  - **Weapon.** Pick from `['newspaperPistol', 'coatRevolver']` at `dustojnici`, and from all four at `trziste`.
  - **Gunman.** `carry = carryOf(weapon)`, `handInCoat = weapon === 'coatRevolver'`.
  - **Innocents.** Each carries a newspaper, basket or bouquet with probability 1/3 (the kind picked evenly), else `none`. Each keeps a hand in the coat with probability 1/8.
  - **Guarantees:**
    - If the gunman carries something, at least two innocents carry the same kind; set it on the first innocents that don't.
    - At least one innocent has `handInCoat`.
    - Carry and hand-in-coat never change clue attributes, so the "exactly one person matches every clue" invariant is untouched.

- [ ] **Step 3: Glances.** Every person gets `glancing`/`glanceIn`.
  - Innocents toggle a glance with a longer pause: 5–9 s between glances, 0.6 s each.
  - The gunman keeps 2–4 s between glances, 0.8 s each.
  - Keep using the scene dice only.

- [ ] **Step 4: Tests** (add to `spot.test.ts`):
  - For seeds 1..300 and both places:
    - the gunman's `carry` equals `carryOf(state.weapon)`;
    - `handInCoat` is true exactly when the weapon is `coatRevolver`;
    - the mess never picks `appleGrenade`/`bouquetBomb`;
    - when he carries, at least 2 innocents carry the same kind;
    - at least 1 innocent has `handInCoat`;
    - the clue invariant still holds.
  - Over 60 simulated seconds, some innocent glances at least once.
  - Determinism: `createSpot` with the same arguments gives equal states.

- [ ] **Step 5:** Run `npm test` and `npx tsc --noEmit`. Commit: `feat(diktator): hidden weapons — the attacker carries what others carry`.

### Task 3: Puppets get scarves, glasses, bags and a hidden hand

**Files:**
- Modify: `src/games/diktator/render/puppet/looks.ts`, `render/puppet/poses.ts`, `render/puppet/skeleton.ts` (only if the pose type needs a field), `render/puppet/draw.ts`
- Test: `tests/diktator/puppet.test.ts` (extend it)

- [ ] **Step 1: `Look` gains three optional fields:**
  - `scarf?: string`: a colour; a knotted scarf drawn around the neck, with a short tail hanging on the chest.
  - `glasses?: boolean`: round wire-rim glasses over the eye.
  - `bag?: string`: a colour; a shoulder bag hanging at the back hip, with its strap across the chest.

  Draw them in `drawPuppet` at the right layer (scarf after the torso and before the head; bag strap after the torso, bag body behind the back arm; glasses with the face). Keep the greyed variant working (`opts.grey`): grey versions of the colours.

- [ ] **Step 2: A new pose `handInCoat`** in `POSE_TABLE`: the front upper arm down and a little forward, the forearm bent up across the chest, so the hand sits inside the coat at chest height. Use `reachF` (the IK target, as `salute` does) at about `[6, 22]` with `bendF: -1`.
  - Add a `hideHandF?: boolean` field to `PuppetPose` (skeleton.ts) and pass it through `solvePuppet`'s joints, like `prop`.
  - When set, `drawPuppet` does not draw the front hand. Instead it draws a small coat-coloured lapel flap over the wrist, so the hand looks tucked in.
  - Add `handInCoatWalk` too: the walking pose, but with the front arm as in `handInCoat`. The gunman walks with his hand hidden.

- [ ] **Step 2b: Carried props.** Add `PropKind`s `'newspaper'` (a folded paper held at the hand), `'basket'` (a small wicker basket with red apples hanging from the hand) and `'bouquet'` (flowers wrapped in paper, held up). Draw them in `draw.ts` like the existing props; they are carried via `look.prop` when the pose has no prop of its own. Include them in the smoke test.

- [ ] **Step 3: Tests.**
  - `POSES.handInCoat` solves to finite joints.
  - The drawing smoke test (in the existing `tests/diktator/puppet.test.ts`, or `scene.test.ts` if the fake canvas lives there; reuse that fake ctx) draws a look with `scarf`, `glasses` and `bag` in `handInCoat`, `handInCoatWalk` and `stand`, grey and not grey, with no throw and balanced `save`/`restore`.

- [ ] **Step 4:** Run `npm test` and `npx tsc --noEmit`, then commit: `feat(diktator): puppets wear scarves, glasses, bags and hide a hand in the coat`.

---

### Task 4: The arena interface, the game object and the drawing

**Files:**
- Create: `src/games/diktator/minigames/arena.ts`, `minigames/spot/game.ts`, `minigames/spot/render.ts`
- Modify: `src/shared/i18n/cs.ts` (`diktator.atentat`)
- Test: `tests/diktator/spot-render.test.ts` (canvas smoke test, reusing the fake ctx pattern from `tests/diktator/scene.test.ts`)

- [ ] **Step 1: `minigames/arena.ts`:**

```ts
// The shared frame of every Diktátor mini-game (spec 2026-09-27-diktator-atentat-design §3).

import type { Hero } from '../logic/palace';

/** Per-hero input for one tick: held movement and whether Action went down this tick. */
export interface ArenaInput {
  readonly moveX: number;
  readonly moveY: number;
  readonly action: boolean;
}

export interface MiniGame<R> {
  /** Advance by `dt` seconds with the inputs of the heroes the game uses. */
  update(dt: number, inputs: Readonly<Partial<Record<Hero, ArenaInput>>>): void;
  /** Draw in the arena's logical space (960 × 540); the caller has set the transform. */
  render(ctx: CanvasRenderingContext2D, t: number): void;
  /** The result once the game is over (after its ending animation), else null. */
  result(): R | null;
}

export const ARENA_W = 960;
export const ARENA_H = 540;
```

- [ ] **Step 2: `minigames/spot/game.ts`.** A class `SpotGame implements MiniGame<'found' | 'missed'>`:
  - Its constructor takes `(difficulty, place, seed)` and calls `createSpot`.
  - `update` calls `stepSpot(state, dt, { moveX, moveY } from inputs.velitel ?? IDLE)`, then `accuse(state)` when `inputs.velitel?.action`.
  - `render` delegates to `drawSpot(ctx, state, t)`.
  - `result` returns `spotResult(state)`.
  - It exposes a `readonly state` for the intro card, which reads the clues.

- [ ] **Step 3: Strings.** Extend `cs.diktator.atentat`:

```ts
    atentat: {
      foiled: (group: string) => `Vlček zadržel střelce (${group}). Král je v bezpečí!`,
      title: 'Atentát!',
      places: { trziste: 'Tržiště v Tiraně', dustojnici: 'Důstojnická jídelna' },
      tip: (clues: string) => `Tajná policie hlásí: střelec nosí ${clues}.`,
      noTip: 'Tajná policie nic neví. Hledej toho, kdo se chová divně.',
      clueWords: {
        hat: { fez: 'fez', cap: 'čepici', plis: 'bílou plstěnou čapku', borsalino: 'klobouk', none: '' },
        scarf: { red: 'červený šátek', blue: 'modrý šátek', green: 'zelený šátek', yellow: 'žlutý šátek', none: '' },
        glasses: 'brýle',
        bag: 'brašnu přes rameno',
      },
      and: ' a ',
      howTo: 'Vlček hledá lupou (šipky nebo páčka). Akce: „To je on!“ — ale pozor, každý omyl zkrátí doutnák.',
      start: 'Hledat!',
      thatsHim: 'To je on!',
      protests: [
        'Já? Já jen prodávám fíky!',
        'Pane, já jsem tu s babičkou!',
        'Nechte mě, nesu chleba!',
        'To je omyl, Excelence!',
        'Já jsem jen zvědavý!',
      ] as readonly string[],
      foundCard: 'Mám ho! Pistole mu vypadla z kabátu.',
      missedCard: 'Výstřely! Střelec zmizel v davu…',
      survivedAfterShots: 'Kulky minuly — král žije!',
      fuse: 'doutnák',
    },
```

  The tip joins the clue words with `, ` and puts `and` before the last one. Add a pure helper `tipText(clues)` in `game.ts` (or a small `minigames/spot/text.ts`) and test it: one clue `'červený šátek'`; two `'fez a červený šátek'`; three `'fez, brýle a brašnu přes rameno'`.

- [ ] **Step 4: `minigames/spot/render.ts`** `drawSpot(ctx, s, t)`, drawn in 960 × 540. It owns its canvas state with `save`/`restore`. Draw, back to front:
  1. **Background** by place:
     - `trziste`: a warm sky, the silhouettes of Tirana roofs and a minaret, market stalls with striped awnings along the back, a cobbled ground band from y 300 to 540.
     - `dustojnici`: a panelled hall wall, flags, long tables at the back, a wooden floor.
  2. **The platform** at `PLATFORM.left–right`, y 300–330, with a red carpet edge. Zogu stands on it at `s.zoguX`, facing the crowd, scale 1.3, in a waving/talking pose: `POSES.talk`, alternating with `POSES.salute` every few seconds.
  3. **Vlček** at the foot of the platform, left of it, scale 1.3.
  4. **The crowd** sorted by `y` (far first). Each person is a puppet at `depthScale(y) * 1.2`, facing their walking direction. Their look is built from the place palette:
     - market coats: brown, grey, navy, olive, maroon;
     - mess: army greens with cap-heavy hats.

     On top of that come the person's hat, scarf, glasses and bag (the Task 3 fields).
     - People with `handInCoat` (the `coatRevolver` gunman and a few innocents) use `handInCoatWalk`/`handInCoat`; others carry their `carry` prop (via `look.prop`). Anyone `glancing` turns the head: add a small `head` offset.
     - Innocents walk (`POSES.walk`) or stand (`stand`/`talk`).
     - A person with `protestUntil > t` shows a small comic bubble with one of the protests, chosen by `id % protests.length`.
  5. **The fuse:** a rope across the top (y 24, x 40–920) that burns from the right. The remaining part is `fuse / seconds`. A flickering spark sits at its end, with the label `P.fuse`.
  6. **The glass:** a gold ring (radius 34) with a handle, at `s.glass`, with a faint lens tint.
  7. **The close-up window** (top-right, circle radius 90 centred at (850, 150), gold rim). If `personUnderGlass(s)` is someone, draw that person at scale 2.6 inside a circular clip, centred so the head and chest show. Only here do the hidden weapon (spec §5a: a barrel peeking out of the newspaper, one dark metal apple with a ring pin in the basket, a fuse among the flowers, a pistol grip under the lapel for `coatRevolver`) and a nervous `grumpy` face show clearly. Innocents' carried things look normal in the close-up: the gunman's face is `'grumpy'` while glancing, else `'neutral'`; innocents `'neutral'` or `'happy'`. Otherwise draw an empty, gently darkened lens.
  8. **Endings:**
     - `outcome === 'found'`: Vlček rushes from his place to the gunman over the first 0.6 s of the ending, then both are drawn low (the gunman lying: rotate his puppet by 90° with the negative-angle convention), the real weapon on the ground by `weapon` (an opened newspaper with a pistol, a grenade apple rolling away, a bouquet with a fizzled fuse, a revolver), and a big "To je on!" bubble.
     - `outcome === 'missed'`: two white muzzle flashes near the gunman and grey smoke puffs expanding over the ending, and the crowd leans back (`POSES.shocked`).

- [ ] **Step 5: Smoke test** (`tests/diktator/spot-render.test.ts`): for both places, for clues 0–3, and at several times (0, mid-fuse, after `found`, after `missed`, each advanced by `stepSpot` and `accuse`), `drawSpot` never throws and the fake ctx's save depth returns to 0. Add a `tipText` test.

- [ ] **Step 6:** Run `npm test` and `npx tsc --noEmit`, then commit: `feat(diktator): the mini-game arena interface and the drawing of "Najdi střelce"`.

---

### Task 5: The merged screen and the wiring

**Files:**
- Modify: `src/games/diktator/index.html`, `palace.css`, `ui/dom.ts`, `main.ts`, `ui/sounds.ts`

- [ ] **Step 1: The arena element.**
  - In `index.html`, after `#app`, add `<section id="arena" hidden><canvas class="arena-stage"></canvas><div id="arena-card" hidden></div></section>`.
  - `#arena` is `position: fixed`, centred, and covers 90 % of the viewport. The canvas keeps 16:9, letterboxed, with a gold border and a dark backdrop around it.
  - While the arena is shown, `#app` gets a class `merging` for 0.5 s: the two halves slide toward the centre (`transform: translateY(±25%)`) and fade out. Then `#app` is hidden and `#arena` fades in. The reverse plays when the scene ends.
  - `#arena-card` is a centred card inside the arena (title, lines, one button), styled like the existing `.card`.

- [ ] **Step 2: `ui/dom.ts` helpers.**
  - `fitArena(canvas)` works like `fitStage`: the largest 16:9 box in the section, device-pixel-ratio aware. It returns the scale for the 960-wide logical space.
  - `showArena(on: boolean)` runs the transition classes.
  - `renderArenaCard(model | null, onChoose)` shows or hides the card: `{ title, lines, button }`.

- [ ] **Step 3: `main.ts`.**
  - Add a new screen value `'arena'`.
  - After any `play()` whose resulting `state().phase.kind === 'attempt'`, once no bubble line is waiting (reuse `someoneTalking()`) and no cards are pending:
    - create `new SpotGame(phase.difficulty, phase.place, phase.seed)` and switch to `'arena'`;
    - show the intro card: the title `A.title`, the place name, the tip (or `noTip`), the line `howTo`, and the button `A.start`. The scene waits until Action or a click on the button.
  - While the scene runs, each tick:
    - build `inputs` for the seated heroes from the devices: `heroOf` for each seated device, `moveX`/`moveY` held, and `action` = `input.pressed(d, 'action')`;
    - call `game.update(dt, inputs)`;
    - render with `ctx.setTransform(k, 0, 0, k, 0, 0)` and `game.render(ctx, t)`;
    - Esc pauses as elsewhere, and the pause freezes the scene.
  - When `game.result()` returns:
    - show the result card (`foundCard` or `missedCard`, button `P.next`);
    - on Action, call `play({ type: 'attemptResult', found: result === 'found' })`, hide the arena (reverse transition), and return to `'palace'`.

    The normal cards follow (the evening card with the assassination line and the news, then the quarter). A "missed" attempt that Zogu survives shows the existing assassination-survived line; a fatal one ends the game through the ending phase screen.
  - Continuing a save whose phase is `attempt`: after `begin()`, the same trigger starts the scene from the phase's seed.
  - Sounds:
    - the unrest ambience at level 0.6 during the scene;
    - a wrong accusation plays the wood knock (`bumpHits('zogu')`);
    - found plays `zogu-bump` with the `page` rustle;
    - missed plays the `shot` synth twice (0 s and 0.25 s).

    Detect these transitions by comparing `state.wrong` / `state.outcome` before and after `update`.
  - `ui/sounds.ts`: add pure helpers if useful (for example `shotsHits()`), tested like the others.

- [ ] **Step 4: Check.** Run `npx tsc --noEmit`, `npm test` and `npm run build`. Commit: `feat(diktator): attempts play as "Najdi střelce" on one merged screen`.

- [ ] **Step 5: Manual check (controller).** Use the dev server. Force an attempt: in the browser console, set every faction's plot to assassination through a saved game, or temporarily with a dev hook if main exposes one. A dev-only hook `?attempt=1` (URL query) that forces all three plots to assassination on a new game is acceptable if it is guarded by `import.meta.env.DEV`. Check each of these:
  1. The halves merge into the arena.
  2. The tip card appears.
  3. The glass moves with the arrow keys.
  4. The close-up shows the person under the glass.
  5. A wrong accusation shortens the fuse and shows a protest.
  6. The right accusation plays the tackle and the "found" card, then the evening card continues the game.
  7. When the fuse runs out, the shots play, then the rules decide.
