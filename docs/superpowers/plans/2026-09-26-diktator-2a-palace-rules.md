# Diktátor — Plan 2a: Palace rules (pure logic)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The palace day of spec §5 as engine rules: two heroes (Zogu, velitel Kovář) moving on a room grid, hours, the royal seal, talk / advice / envoys / investigate / police report / guard, decisions sealed in the right room, the evening when both end the day, and the guarded 75 % assassination coin — all pure and tested, with the plan-1 "classic" mode (text mode) left working unchanged.

**Architecture:** `GameState` gains `palace: PalaceState | null` (null = classic mode). `newGame(sc, seed, regime, { palace: true })` turns the palace on; `startQuarter` resets the palace day. Palace commands carry the hero and are validated against rooms and hours in a new `logic/palace-actions.ts`, called from `advance`. The room grid, room names and which room each group or decision belongs to are scenario data (`scenario/albania/palace.ts`). Plan 2b adds the picture (puppets, split screen, menus) on top of these commands.

**Tech Stack:** TypeScript (strict), Vitest. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-09-26-diktator-design.md` §5 (palace), §9 (guard the king). Plan 1 (`2026-09-26-diktator-1-engine.md`) is complete; its files are the base.

---

## Rules this plan fixes (decided from the spec, recorded here)

1. **Evening only when both heroes press "Konec dne"** (`endDay`). Spending all hours does not end a hero's day: moving and sealing a decision are free, so a hero with no hours may still carry the seal to a room. (Spec §5.3 says "all hours spent, or both press Konec dne"; ending on zero hours would forbid sealing a decision after the last hour.)
2. **During the audience** Zogu stays in the throne room: he can only answer, or ask Mother's advice about the petition (1 hour — "the petitioner is taken to her"). The commander acts freely during the audience.
3. **Guard the king** needs the commander in the same room as Zogu and at least one hour left; it sets his hours to 0 and ends his day.
4. **The police report** is the commander's action in the guardroom: 1 hour, plus the original money and preconditions (Plan 1 `policeReport`). The hour is spent even when the police refuse.
5. **Talk** (Zogu, in a group's room, 1 hour) names the available decision that raises that group's popularity most (ties: the first in scenario order; aid and the Swiss account excluded), or none.
6. **Envoys** (Zogu, in the envoys' salon, 1 hour) shows each lender's base offer `pop × 30`, `0` when that lender is hostile (pop ≤ low), `null` when its loan was already granted.
7. **The seal** starts each quarter lying in the study. A hero in the study takes it; a hero holding it gives it to the other hero in the same room. A decision is sealed by the seal holder standing in the decision's room (free, no hour).
8. **Rooms and moods seen** are recorded in `palace.seen` (the UI's palace strip shows them); **investigated factions** in `palace.investigated`.

## File structure

| File | Responsibility |
|---|---|
| `src/games/diktator/logic/palace.ts` (new) | heroes, directions, `PalaceLayout`, `PalaceState`, grid navigation, room lookups, `newPalaceDay` |
| `src/games/diktator/logic/palace-actions.ts` (new) | `applyPalaceCommand`, `palaceCommands`, `wishFor`, `PALACE_COMMANDS` |
| `src/games/diktator/scenario/albania/palace.ts` (new) | the Albanian palace layout and room names |
| `src/games/diktator/logic/scenario.ts` | `palace?: PalaceLayout` |
| `src/games/diktator/scenario/albania/index.ts` | add the layout |
| `src/games/diktator/logic/rules.ts` | palace hours, guarded coin |
| `src/games/diktator/logic/state.ts` | `palace` field, version 2, new commands and events |
| `src/games/diktator/logic/save.ts` | `SAVE_VERSION = 2` |
| `src/games/diktator/logic/turn.ts` | palace mode in `newGame`, `startQuarter`, `advance`, `validCommands` |
| `src/games/diktator/logic/assassination.ts` | guarded coin |
| `tests/diktator/palace.test.ts`, `tests/diktator/palace-actions.test.ts` (new) | tests |
| `tests/diktator/state.test.ts`, `tests/diktator/crises.test.ts`, `tests/diktator/turn.test.ts` | updated / extended |

Conventions as in plan 1: pure logic, named exports, `readonly` in public types, doc comments on exports, Czech only in user-facing strings, commits `feat(diktator): …`. Run `npx vitest run` and `npx tsc --noEmit` before every commit.

---

### Task 1: Palace layout and navigation

**Files:**
- Create: `src/games/diktator/logic/palace.ts`
- Create: `src/games/diktator/scenario/albania/palace.ts`
- Modify: `src/games/diktator/logic/scenario.ts`, `src/games/diktator/scenario/albania/index.ts`, `src/games/diktator/logic/rules.ts`
- Test: `tests/diktator/palace.test.ts`

- [ ] **Step 1: Write the failing test**

`tests/diktator/palace.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  decisionRoom, exits, groupsInRoom, neighbour, newPalaceDay, other, roomOfGroup,
} from '../../src/games/diktator/logic/palace';
import { GROUPS } from '../../src/games/diktator/logic/groups';
import { albania } from '../../src/games/diktator/scenario/albania';

const L = albania.palace!;

describe('albania palace layout', () => {
  it('is a 4 × 3 grid of 12 distinct named rooms', () => {
    expect(L.grid).toHaveLength(3);
    for (const row of L.grid) expect(row).toHaveLength(4);
    const rooms = L.grid.flat();
    expect(new Set(rooms).size).toBe(12);
    for (const r of rooms) expect(L.names[r]?.length ?? 0).toBeGreaterThan(0);
  });

  it('places every special room, start room, group room and decision room on the grid', () => {
    const rooms = new Set(L.grid.flat());
    for (const r of [L.throne, L.study, L.mother, L.envoys, L.guardroom, L.start.zogu, L.start.velitel]) expect(rooms.has(r)).toBe(true);
    for (const g of GROUPS) expect(rooms.has(roomOfGroup(L, g))).toBe(true);
    for (const d of albania.decisions) expect(rooms.has(decisionRoom(L, d.id)), d.id).toBe(true);
  });
});

describe('navigation', () => {
  it('moves to grid neighbours and stops at walls', () => {
    expect(neighbour(L, 'trunni', 'left')).toBe('pracovna');
    expect(neighbour(L, 'trunni', 'down')).toBe('vyslanci');
    expect(neighbour(L, 'trunni', 'up')).toBeNull();
    expect(neighbour(L, 'pokladna', 'right')).toBeNull();
  });

  it('lists exits in the order up, down, left, right', () => {
    expect(exits(L, 'matka')).toEqual(['down', 'right']);
    expect(exits(L, 'nadvori')).toEqual(['up', 'down', 'left', 'right']);
  });

  it('throws for a room that is not on the grid', () => {
    expect(() => neighbour(L, 'sklep', 'up')).toThrow();
  });
});

describe('room lookups', () => {
  it('maps groups to rooms', () => {
    expect(roomOfGroup(L, 'armada')).toBe('armada');
    expect(roomOfGroup(L, 'policie')).toBe('straznice');
    expect(roomOfGroup(L, 'povstalci')).toBe('straznice');
    expect(roomOfGroup(L, 'italie')).toBe('vyslanci');
  });

  it('lists the groups one can talk to in a room', () => {
    expect(groupsInRoom(L, 'rolnici')).toEqual(['rolnici']);
    expect(groupsInRoom(L, 'straznice')).toEqual(['policie']);
    expect(groupsInRoom(L, 'knihovna')).toEqual([]);
  });

  it('seals decisions in their room, the study by default', () => {
    expect(decisionRoom(L, 'd35')).toBe('straznice');
    expect(decisionRoom(L, 'd37')).toBe('pokladna');
    expect(decisionRoom(L, 'd31')).toBe('pracovna');
  });
});

describe('newPalaceDay', () => {
  it('starts both heroes in their rooms with full hours, the seal in the study', () => {
    const p = newPalaceDay(L);
    expect(p.at).toEqual({ zogu: 'trunni', velitel: 'straznice' });
    expect(p.hours).toEqual({ zogu: 3, velitel: 3 });
    expect(p.seal).toBeNull();
    expect(p.seen).toEqual({ trunni: true, straznice: true });
    expect(p.investigated).toEqual({});
    expect(p.guarded).toBe(false);
    expect(p.done).toEqual({ zogu: false, velitel: false });
    expect(other('zogu')).toBe('velitel');
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run tests/diktator/palace.test.ts`
Expected: FAIL — cannot resolve `logic/palace`.

- [ ] **Step 3: Add the rules**

In `src/games/diktator/logic/rules.ts`, add inside `RULES` (after `swissDivisor: 10,`):

```ts
  /** Palace day (spec §5): hours per hero per quarter. */
  palace: { hours: { zogu: 3, velitel: 3 } },
  /** Guarded by the commander, the last-chance coin becomes rnd(0..3) ≠ 0, i.e. 75 % (spec §5.3, our addition). */
  guardedCoin: 4,
```

- [ ] **Step 4: Write the palace module**

`src/games/diktator/logic/palace.ts`:

```ts
import type { FactionId, GroupId, StrengthGroupId } from './groups';
import { RULES } from './rules';

/** The two playable characters: Zogu (politics, money) and velitel Kovář (security). */
export const HEROES = ['zogu', 'velitel'] as const;
export type Hero = (typeof HEROES)[number];

export type Direction = 'up' | 'down' | 'left' | 'right';
export const DIRECTIONS: readonly Direction[] = ['up', 'down', 'left', 'right'];

/** A room id from the scenario's layout. */
export type RoomId = string;

/** The groups that have a room of their own and can be talked to there. */
export const ROOM_GROUPS = ['armada', 'rolnici', 'statkari', 'policie'] as const;
export type RoomGroupId = (typeof ROOM_GROUPS)[number];

/** Scenario data: the room grid and what happens where. */
export interface PalaceLayout {
  /** Rows top to bottom; arrows move one cell. */
  readonly grid: readonly (readonly RoomId[])[];
  readonly names: Readonly<Record<RoomId, string>>;
  readonly start: Readonly<Record<Hero, RoomId>>;
  readonly throne: RoomId;
  readonly study: RoomId;
  readonly mother: RoomId;
  readonly envoys: RoomId;
  readonly guardroom: RoomId;
  readonly groupRoom: Readonly<Record<RoomGroupId, RoomId>>;
  /** Where a decision is sealed; decisions not listed are sealed in the study. */
  readonly decisionRoom: Readonly<Record<string, RoomId>>;
}

/** One quarter's palace day. Reset at the start of every quarter. */
export interface PalaceState {
  at: Record<Hero, RoomId>;
  hours: Record<Hero, number>;
  /** Who carries the royal seal; null = it lies in the study. */
  seal: Hero | null;
  /** Rooms entered this quarter (their mood is known). */
  seen: Record<RoomId, true>;
  /** Factions whose plot the commander revealed this quarter. */
  investigated: Partial<Record<FactionId, true>>;
  /** The commander guards the king tonight. */
  guarded: boolean;
  /** Pressed "Konec dne". The evening starts when both have. */
  done: Record<Hero, boolean>;
}

export function other(h: Hero): Hero {
  return h === 'zogu' ? 'velitel' : 'zogu';
}

const STEP: Readonly<Record<Direction, readonly [number, number]>> = {
  up: [-1, 0],
  down: [1, 0],
  left: [0, -1],
  right: [0, 1],
};

function cellOf(L: PalaceLayout, room: RoomId): readonly [number, number] {
  for (let r = 0; r < L.grid.length; r++) {
    const c = L.grid[r].indexOf(room);
    if (c >= 0) return [r, c];
  }
  throw new Error(`room ${room} is not in the palace`);
}

/** The room one step away, or null at a wall. */
export function neighbour(L: PalaceLayout, room: RoomId, dir: Direction): RoomId | null {
  const [r, c] = cellOf(L, room);
  const [dr, dc] = STEP[dir];
  return L.grid[r + dr]?.[c + dc] ?? null;
}

/** Directions with a room behind them, in the order up, down, left, right. */
export function exits(L: PalaceLayout, room: RoomId): Direction[] {
  return DIRECTIONS.filter((d) => neighbour(L, room, d) !== null);
}

/** Where a group can be seen: its own room; rebels on the guardroom's map; foreign powers in the envoys' salon. */
export function roomOfGroup(L: PalaceLayout, g: GroupId): RoomId {
  if ((ROOM_GROUPS as readonly string[]).includes(g)) return L.groupRoom[g as RoomGroupId];
  if (g === 'povstalci') return L.guardroom;
  return L.envoys;
}

/** Groups Zogu can talk to in this room. */
export function groupsInRoom(L: PalaceLayout, room: RoomId): StrengthGroupId[] {
  return ROOM_GROUPS.filter((g) => L.groupRoom[g] === room);
}

export function decisionRoom(L: PalaceLayout, decisionId: string): RoomId {
  return L.decisionRoom[decisionId] ?? L.study;
}

export function newPalaceDay(L: PalaceLayout): PalaceState {
  return {
    at: { zogu: L.start.zogu, velitel: L.start.velitel },
    hours: { zogu: RULES.palace.hours.zogu, velitel: RULES.palace.hours.velitel },
    seal: null,
    seen: { [L.start.zogu]: true, [L.start.velitel]: true },
    investigated: {},
    guarded: false,
    done: { zogu: false, velitel: false },
  };
}
```

- [ ] **Step 5: Add the layout to the scenario interface**

In `src/games/diktator/logic/scenario.ts` add the import and the field:

```ts
import type { PalaceLayout } from './palace';
```

and inside `Scenario`, after `news`:

```ts
  /** The palace of plan 2 (absent: only the classic text mode is playable). */
  readonly palace?: PalaceLayout;
```

- [ ] **Step 6: Write the Albanian palace**

`src/games/diktator/scenario/albania/palace.ts`:

```ts
import type { PalaceLayout } from '../../logic/palace';

/**
 * The royal palace in Tirana as a 4 × 3 room grid (spec §5.1):
 *   Pokoj královny matky | Pracovna krále | Trůnní sál        | Herna
 *   Důstojnický sál      | Nádvoří        | Salonek vyslanců  | Knihovna
 *   Selská světnice      | Salon statkářů | Strážnice         | Pokladna
 */
export const PALACE: PalaceLayout = {
  grid: [
    ['matka', 'pracovna', 'trunni', 'herna'],
    ['armada', 'nadvori', 'vyslanci', 'knihovna'],
    ['rolnici', 'statkari', 'straznice', 'pokladna'],
  ],
  names: {
    matka: 'Pokoj královny matky',
    pracovna: 'Pracovna krále',
    trunni: 'Trůnní sál',
    herna: 'Herna',
    armada: 'Důstojnický sál',
    nadvori: 'Nádvoří',
    vyslanci: 'Salonek vyslanců',
    knihovna: 'Knihovna',
    rolnici: 'Selská světnice',
    statkari: 'Salon statkářů',
    straznice: 'Strážnice',
    pokladna: 'Pokladna',
  },
  start: { zogu: 'trunni', velitel: 'straznice' },
  throne: 'trunni',
  study: 'pracovna',
  mother: 'matka',
  envoys: 'vyslanci',
  guardroom: 'straznice',
  groupRoom: { armada: 'armada', rolnici: 'rolnici', statkari: 'statkari', policie: 'straznice' },
  decisionRoom: {
    d25: 'armada',
    d26: 'rolnici',
    d27: 'statkari',
    d28: 'vyslanci',
    d29: 'vyslanci',
    d30: 'vyslanci',
    d33: 'straznice',
    d34: 'straznice',
    d35: 'straznice',
    d36: 'nadvori',
    d37: 'pokladna',
    d38: 'vyslanci',
    d39: 'vyslanci',
    d40: 'vyslanci',
    d41: 'armada',
    d42: 'rolnici',
    d43: 'statkari',
  },
};
```

In `src/games/diktator/scenario/albania/index.ts` import it and add `palace: PALACE,` to the `albania` object:

```ts
import { PALACE } from './palace';
```

- [ ] **Step 7: Run the tests**

Run: `npx vitest run tests/diktator/palace.test.ts && npx tsc --noEmit`
Expected: all pass, no type errors.

- [ ] **Step 8: Commit**

```bash
git add src/games/diktator/logic/palace.ts src/games/diktator/logic/scenario.ts src/games/diktator/logic/rules.ts src/games/diktator/scenario/albania tests/diktator/palace.test.ts
git commit -m "feat(diktator): palace layout and room navigation"
```

---

### Task 2: Palace state in the game, commands and events

**Files:**
- Modify: `src/games/diktator/logic/state.ts`, `src/games/diktator/logic/save.ts`, `src/games/diktator/logic/turn.ts`
- Modify: `tests/diktator/state.test.ts`
- Test: `tests/diktator/palace-actions.test.ts` (created here, extended in Task 3)

- [ ] **Step 1: Update the state test and write the new failing test**

In `tests/diktator/state.test.ts` change `expect(s.version).toBe(1);` to `expect(s.version).toBe(2);` and add inside the first `it` after it:

```ts
    expect(s.palace).toBeNull();
```

Create `tests/diktator/palace-actions.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { deserialize, newSave, serialize } from '../../src/games/diktator/logic/save';
import { newGame } from '../../src/games/diktator/logic/turn';
import { albania } from '../../src/games/diktator/scenario/albania';

describe('palace mode', () => {
  it('newGame with palace starts a palace day; classic mode has none', () => {
    const palace = newGame(albania, 4, undefined, { palace: true }).state;
    expect(palace.palace?.at).toEqual({ zogu: 'trunni', velitel: 'straznice' });
    expect(palace.phase.kind).toBe('audience');
    expect(newGame(albania, 4).state.palace).toBeNull();
  });

  it('refuses palace mode for a scenario without a palace', () => {
    const noPalace = { ...albania, palace: undefined };
    expect(() => newGame(noPalace, 4, undefined, { palace: true })).toThrow();
  });

  it('saves and loads the palace state', () => {
    const { state } = newGame(albania, 4, undefined, { palace: true });
    const f = newSave('albania', state);
    expect(deserialize(serialize(f))).toEqual(f);
  });

  it('rejects version-1 saves', () => {
    const { state } = newGame(albania, 4);
    const old = { ...newSave('albania', state), version: 1 };
    expect(deserialize(JSON.stringify(old))).toBeNull();
  });
});
```

- [ ] **Step 2: Run to see failures**

Run: `npx vitest run tests/diktator/state.test.ts tests/diktator/palace-actions.test.ts`
Expected: FAIL — version is 1, `palace` missing, `newGame` has no options.

- [ ] **Step 3: Extend the state**

In `src/games/diktator/logic/state.ts`:

1. Add the import:

```ts
import type { Direction, Hero, PalaceState } from './palace';
```

2. In `GameState` change `readonly version: 1;` to `readonly version: 2;` and add after `phase: Phase;`:

```ts
  /** The palace day (plan 2); null in the classic text mode. */
  palace: PalaceState | null;
```

3. In `initialState` change `version: 1,` to `version: 2,` and add `palace: null,` after `phase: { kind: 'day' },`.

4. Replace the `Command` union with:

```ts
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
```

5. Add to the `GameEvent` union (before the final `ended` member):

```ts
  | { readonly type: 'moved'; readonly hero: Hero; readonly from: string; readonly to: string }
  | { readonly type: 'seal'; readonly holder: Hero | null }
  | { readonly type: 'wish'; readonly group: StrengthGroupId; readonly decision: string | null }
  | { readonly type: 'advised'; readonly subject: 'petition' | 'decision'; readonly id: string }
  | { readonly type: 'envoys'; readonly offers: Readonly<Record<LenderId, number | null>> }
  | { readonly type: 'investigated'; readonly faction: FactionId; readonly plot: Plot }
  | { readonly type: 'guarding' }
  | { readonly type: 'heroDone'; readonly hero: Hero }
```

- [ ] **Step 4: Bump the save version**

In `src/games/diktator/logic/save.ts` change `export const SAVE_VERSION = 1;` to `export const SAVE_VERSION = 2;`.

- [ ] **Step 5: Palace mode in `newGame` and `startQuarter`**

In `src/games/diktator/logic/turn.ts`:

1. Add the import:

```ts
import { newPalaceDay } from './palace';
```

2. In `startQuarter`, after `s.decisionTaken = false;` add:

```ts
  if (s.palace) s.palace = newPalaceDay(sc.palace!);
```

3. Replace `newGame` with:

```ts
export interface GameOptions {
  /** Play the palace day (plan 2); requires a scenario with a palace. */
  readonly palace?: boolean;
}

/** Starts a game: the state before the first turn, then the first turn begins. */
export function newGame(sc: Scenario, seed: number, regime?: StartingRegime, opts: GameOptions = {}): StepResult {
  const s = initialState(seed, regime);
  if (opts.palace) {
    if (!sc.palace) throw new Error(`scenario ${sc.id} has no palace`);
    s.palace = newPalaceDay(sc.palace);
  }
  const events: GameEvent[] = [];
  startQuarter(sc, s, rngDice(s.rng), events);
  return { state: s, events };
}
```

- [ ] **Step 6: Run the tests**

Run: `npx vitest run && npx tsc --noEmit`
Expected: all pass (the new palace-actions tests, the updated state test, and every plan-1 test), no type errors. If `tsc` reports that a `switch` over `Command` in `src/games/diktator/main.ts` (`commandLabel`) no longer returns for every member, add this before the switch's closing brace in `commandLabel`:

```ts
    default:
      return cmd.type;
```

- [ ] **Step 7: Commit**

```bash
git add src/games/diktator/logic/state.ts src/games/diktator/logic/save.ts src/games/diktator/logic/turn.ts src/games/diktator/main.ts tests/diktator/state.test.ts tests/diktator/palace-actions.test.ts
git commit -m "feat(diktator): palace state, commands and events"
```

---

### Task 3: Palace actions

**Files:**
- Create: `src/games/diktator/logic/palace-actions.ts`
- Modify: `src/games/diktator/logic/turn.ts`
- Test: `tests/diktator/palace-actions.test.ts` (extend)

- [ ] **Step 1: Write the failing tests**

Append to `tests/diktator/palace-actions.test.ts` (add the imports at the top of the file):

```ts
import { advance } from '../../src/games/diktator/logic/turn';
import type { Command, GameState } from '../../src/games/diktator/logic/state';
```

```ts
function play(s: GameState, ...cmds: Command[]): GameState {
  for (const c of cmds) s = advance(albania, s, c).state;
  return s;
}

/** A palace game past its first audience, in the day phase. */
function day(seed = 4): GameState {
  return play(newGame(albania, seed, undefined, { palace: true }).state, { type: 'answer', answer: 'no' });
}

describe('audience in the palace', () => {
  it('Zogu cannot leave the throne room during the audience; the commander can move', () => {
    const s = newGame(albania, 4, undefined, { palace: true }).state;
    expect(() => advance(albania, s, { type: 'move', hero: 'zogu', dir: 'left' })).toThrow();
    const r = advance(albania, s, { type: 'move', hero: 'velitel', dir: 'up' });
    expect(r.state.palace!.at.velitel).toBe('vyslanci');
    expect(r.events).toEqual([{ type: 'moved', hero: 'velitel', from: 'straznice', to: 'vyslanci' }]);
    expect(r.state.palace!.seen.vyslanci).toBe(true);
  });

  it("Mother's advice about the petition costs Zogu an hour and keeps the audience open", () => {
    const s = newGame(albania, 4, undefined, { palace: true }).state;
    const r = advance(albania, s, { type: 'advice' });
    expect(r.state.phase.kind).toBe('audience');
    expect(r.state.palace!.hours.zogu).toBe(2);
    expect(r.events).toEqual([{ type: 'advised', subject: 'petition', id: (s.phase as { petition: string }).petition }]);
  });

  it('the day cannot end and nothing can be sealed during the audience', () => {
    const s = newGame(albania, 4, undefined, { palace: true }).state;
    expect(() => advance(albania, s, { type: 'endDay', hero: 'velitel' })).toThrow();
  });
});

describe('moving', () => {
  it('refuses a wall', () => {
    expect(() => advance(albania, day(), { type: 'move', hero: 'zogu', dir: 'up' })).toThrow();
  });
});

describe('the seal', () => {
  it('is taken in the study and given only in the same room', () => {
    let s = day();
    expect(() => advance(albania, s, { type: 'takeSeal', hero: 'zogu' })).toThrow();
    s = play(s, { type: 'move', hero: 'zogu', dir: 'left' }, { type: 'takeSeal', hero: 'zogu' });
    expect(s.palace!.seal).toBe('zogu');
    expect(() => advance(albania, s, { type: 'giveSeal', hero: 'zogu' })).toThrow();
    // commander: guardroom → envoys' salon → throne room → study
    s = play(s, { type: 'move', hero: 'velitel', dir: 'up' }, { type: 'move', hero: 'velitel', dir: 'up' }, { type: 'move', hero: 'velitel', dir: 'left' });
    expect(s.palace!.at.velitel).toBe('pracovna');
    const r = advance(albania, s, { type: 'giveSeal', hero: 'zogu' });
    expect(r.state.palace!.seal).toBe('velitel');
    expect(r.events).toEqual([{ type: 'seal', holder: 'velitel' }]);
  });

  it('a decision needs the seal and the right room, and costs no hour', () => {
    let s = day();
    expect(() => advance(albania, s, { type: 'decide', decision: 'd35', hero: 'velitel' })).toThrow();
    s = play(
      s,
      { type: 'move', hero: 'zogu', dir: 'left' },
      { type: 'takeSeal', hero: 'zogu' },
      { type: 'move', hero: 'zogu', dir: 'down' },
    );
    expect(() => advance(albania, s, { type: 'decide', decision: 'd35', hero: 'zogu' })).toThrow();
    s = play(s, { type: 'move', hero: 'zogu', dir: 'right' }, { type: 'move', hero: 'zogu', dir: 'down' });
    expect(s.palace!.at.zogu).toBe('straznice');
    const r = advance(albania, s, { type: 'decide', decision: 'd35', hero: 'zogu' });
    expect(r.state.guard).toBe(6);
    expect(r.state.palace!.hours.zogu).toBe(3);
    expect(r.state.decisionTaken).toBe(true);
  });
});

describe("Zogu's actions", () => {
  it('talking to the army names the decision it would welcome most', () => {
    const s = play(day(), { type: 'move', hero: 'zogu', dir: 'left' }, { type: 'move', hero: 'zogu', dir: 'left' }, { type: 'move', hero: 'zogu', dir: 'down' });
    expect(s.palace!.at.zogu).toBe('armada');
    const r = advance(albania, s, { type: 'talk' });
    expect(r.events).toEqual([{ type: 'wish', group: 'armada', decision: 'd25' }]);
    expect(r.state.palace!.hours.zogu).toBe(2);
  });

  it("advice about a decision needs Mother's room", () => {
    let s = day();
    expect(() => advance(albania, s, { type: 'advice', decision: 'd41' })).toThrow();
    s = play(s, { type: 'move', hero: 'zogu', dir: 'left' }, { type: 'move', hero: 'zogu', dir: 'left' });
    const r = advance(albania, s, { type: 'advice', decision: 'd41' });
    expect(r.events).toEqual([{ type: 'advised', subject: 'decision', id: 'd41' }]);
  });

  it('the envoys state their base offers', () => {
    const s = play(day(), { type: 'move', hero: 'zogu', dir: 'down' });
    const r = advance(albania, s, { type: 'envoys' });
    expect(r.events).toEqual([{ type: 'envoys', offers: { italie: 210, britanie: 210 } }]);
  });
});

describe("the commander's actions", () => {
  it('investigating a faction reveals its plot', () => {
    let s = day();
    expect(() => advance(albania, s, { type: 'investigate' })).toThrow();
    s = play(s, { type: 'move', hero: 'velitel', dir: 'left' }, { type: 'move', hero: 'velitel', dir: 'left' });
    expect(s.palace!.at.velitel).toBe('rolnici');
    const r = advance(albania, s, { type: 'investigate' });
    expect(r.events).toEqual([{ type: 'investigated', faction: 'rolnici', plot: { kind: 'none' } }]);
    expect(r.state.palace!.investigated.rolnici).toBe(true);
    expect(r.state.palace!.hours.velitel).toBe(2);
  });

  it('the police report costs an hour and money, in the guardroom only', () => {
    const s = day();
    const r = advance(albania, s, { type: 'policeReport', hero: 'velitel' });
    expect(r.state.palace!.hours.velitel).toBe(2);
    expect(r.state.treasury).toBe(s.treasury - 1);
    expect(r.events[0].type).toBe('policeReport');
    expect(() => advance(albania, s, { type: 'policeReport', hero: 'zogu' })).toThrow();
  });

  it('hours run out', () => {
    let s = day();
    for (let i = 0; i < 3; i++) s = play(s, { type: 'policeReport', hero: 'velitel' });
    expect(s.palace!.hours.velitel).toBe(0);
    expect(() => advance(albania, s, { type: 'policeReport', hero: 'velitel' })).toThrow();
    // moving is still free
    expect(advance(albania, s, { type: 'move', hero: 'velitel', dir: 'up' }).state.palace!.at.velitel).toBe('vyslanci');
  });

  it("guarding needs Zogu's room and ends the commander's day", () => {
    let s = day();
    expect(() => advance(albania, s, { type: 'guard' })).toThrow();
    s = play(s, { type: 'move', hero: 'velitel', dir: 'up' }, { type: 'move', hero: 'velitel', dir: 'up' });
    const r = advance(albania, s, { type: 'guard' });
    expect(r.state.palace!.guarded).toBe(true);
    expect(r.state.palace!.hours.velitel).toBe(0);
    expect(r.state.palace!.done.velitel).toBe(true);
    expect(r.events).toEqual([{ type: 'guarding' }, { type: 'heroDone', hero: 'velitel' }]);
  });
});

describe('ending the day', () => {
  it('the evening starts only when both heroes end their day, then the palace resets', () => {
    let s = play(day(), { type: 'move', hero: 'zogu', dir: 'left' });
    s = play(s, { type: 'endDay', hero: 'zogu' });
    expect(s.phase.kind).toBe('day');
    expect(() => advance(albania, s, { type: 'move', hero: 'zogu', dir: 'right' })).toThrow();
    s = play(s, { type: 'endDay', hero: 'velitel' });
    if (s.phase.kind === 'audience') {
      expect(s.quarter).toBe(2);
      expect(s.palace!.at).toEqual({ zogu: 'trunni', velitel: 'straznice' });
      expect(s.palace!.hours).toEqual({ zogu: 3, velitel: 3 });
    } else {
      expect(['revolution', 'ended']).toContain(s.phase.kind);
    }
  });

  it('classic commands without a hero are refused in palace mode, palace commands in classic mode', () => {
    expect(() => advance(albania, day(), { type: 'endDay' })).toThrow();
    const classic = play(newGame(albania, 4).state, { type: 'answer', answer: 'no' });
    expect(() => advance(albania, classic, { type: 'move', hero: 'zogu', dir: 'left' })).toThrow();
  });
});
```

Note for the test with seed 4: the day-one numbers assume the Plan-1 starting values (pop 7, treasury 940 after costs). If seed 4's first petition ever changes those (a `no` only lowers the petitioner), the envoys test still holds because it checks Italy and Britain, which no petition refusal touches.

- [ ] **Step 2: Run to see failures**

Run: `npx vitest run tests/diktator/palace-actions.test.ts`
Expected: FAIL — palace commands are not handled.

- [ ] **Step 3: Write the palace actions**

`src/games/diktator/logic/palace-actions.ts`:

```ts
import { availableDecisions, decisionById, takeDecision } from './decision';
import type { Dice } from './dice';
import { FACTIONS, LENDERS, type FactionId, type LenderId, type StrengthGroupId } from './groups';
import { decisionRoom, exits, groupsInRoom, neighbour, other, type Hero, type PalaceState } from './palace';
import { policeReport } from './police';
import { RULES } from './rules';
import type { Scenario } from './scenario';
import type { Command, GameEvent, GameState } from './state';

/** Commands that act inside the palace (in palace mode they need a hero, a room and possibly an hour). */
export const PALACE_COMMANDS: ReadonlySet<Command['type']> = new Set([
  'move', 'takeSeal', 'giveSeal', 'talk', 'advice', 'envoys', 'investigate', 'guard', 'policeReport', 'decide', 'endDay',
]);

/** Commands that exist only in palace mode. */
export const PALACE_ONLY: ReadonlySet<Command['type']> = new Set([
  'move', 'takeSeal', 'giveSeal', 'talk', 'advice', 'envoys', 'investigate', 'guard',
]);

/** The decision that raises `group`'s popularity most (first on ties; aid and the Swiss account excluded). */
export function wishFor(sc: Scenario, s: GameState, group: StrengthGroupId): string | null {
  let best: { id: string; gain: number } | null = null;
  for (const d of availableDecisions(sc, s)) {
    if (d.special?.kind === 'aid' || d.special?.kind === 'swiss') continue;
    const gain = d.effects.pop?.[group] ?? 0;
    if (gain > 0 && (!best || gain > best.gain)) best = { id: d.id, gain };
  }
  return best?.id ?? null;
}

function factionsIn(sc: Scenario, room: string): FactionId[] {
  return groupsInRoom(sc.palace!, room).filter((g): g is FactionId => (FACTIONS as readonly string[]).includes(g));
}

function aidDecisionOf(sc: Scenario, lender: LenderId): string | null {
  return sc.decisions.find((d) => d.special?.kind === 'aid' && d.special.lender === lender)?.id ?? null;
}

function fail(cmd: Command, why: string): never {
  throw new Error(`${cmd.type}: ${why}`);
}

function spendHour(p: PalaceState, hero: Hero, cmd: Command): void {
  if (p.done[hero]) fail(cmd, `${hero} has ended the day`);
  if (p.hours[hero] < 1) fail(cmd, `${hero} has no hours left`);
  p.hours[hero] -= 1;
}

function requireHero(cmd: Command, hero: Hero | undefined): Hero {
  if (!hero) fail(cmd, 'palace mode needs a hero');
  return hero;
}

/**
 * Applies one palace command in the audience or day phase (spec §5, rules 1–8 of plan 2a).
 * Throws on anything the rules do not allow. The caller starts the evening when both heroes are done.
 */
export function applyPalaceCommand(sc: Scenario, s: GameState, cmd: Command, dice: Dice, events: GameEvent[]): void {
  const p = s.palace;
  const L = sc.palace;
  if (!p || !L) fail(cmd, 'not in palace mode');
  const inAudience = s.phase.kind === 'audience';

  switch (cmd.type) {
    case 'move': {
      if (inAudience && cmd.hero === 'zogu') fail(cmd, 'the audience comes first');
      if (p.done[cmd.hero]) fail(cmd, `${cmd.hero} has ended the day`);
      const from = p.at[cmd.hero];
      const to = neighbour(L, from, cmd.dir);
      if (!to) fail(cmd, `no door ${cmd.dir} from ${from}`);
      p.at[cmd.hero] = to;
      p.seen[to] = true;
      events.push({ type: 'moved', hero: cmd.hero, from, to });
      return;
    }
    case 'takeSeal': {
      if (p.seal !== null) fail(cmd, 'the seal is already carried');
      if (p.at[cmd.hero] !== L.study) fail(cmd, 'the seal lies in the study');
      p.seal = cmd.hero;
      events.push({ type: 'seal', holder: cmd.hero });
      return;
    }
    case 'giveSeal': {
      if (p.seal !== cmd.hero) fail(cmd, `${cmd.hero} does not carry the seal`);
      const to = other(cmd.hero);
      if (p.at[to] !== p.at[cmd.hero]) fail(cmd, 'both must stand in the same room');
      p.seal = to;
      events.push({ type: 'seal', holder: to });
      return;
    }
    case 'talk': {
      if (inAudience) fail(cmd, 'the audience comes first');
      const groups = groupsInRoom(L, p.at.zogu);
      if (groups.length === 0) fail(cmd, 'nobody to talk to here');
      spendHour(p, 'zogu', cmd);
      events.push({ type: 'wish', group: groups[0], decision: wishFor(sc, s, groups[0]) });
      return;
    }
    case 'advice': {
      if (cmd.decision === undefined) {
        if (s.phase.kind !== 'audience') fail(cmd, 'advice without a decision is about the petition');
        const petition = s.phase.petition;
        spendHour(p, 'zogu', cmd);
        events.push({ type: 'advised', subject: 'petition', id: petition });
        return;
      }
      if (inAudience) fail(cmd, 'the audience comes first');
      if (p.at.zogu !== L.mother) fail(cmd, "advice is given in Mother's room");
      decisionById(sc, cmd.decision);
      spendHour(p, 'zogu', cmd);
      events.push({ type: 'advised', subject: 'decision', id: cmd.decision });
      return;
    }
    case 'envoys': {
      if (inAudience) fail(cmd, 'the audience comes first');
      if (p.at.zogu !== L.envoys) fail(cmd, "the envoys wait in their salon");
      spendHour(p, 'zogu', cmd);
      const offers = {} as Record<LenderId, number | null>;
      for (const lender of LENDERS) {
        const id = aidDecisionOf(sc, lender);
        offers[lender] = id && s.used[id] ? null : s.pop[lender] <= s.low ? 0 : s.pop[lender] * RULES.aidPerPop;
      }
      events.push({ type: 'envoys', offers });
      return;
    }
    case 'investigate': {
      const factions = factionsIn(sc, p.at.velitel);
      if (factions.length === 0) fail(cmd, 'no faction in this room');
      spendHour(p, 'velitel', cmd);
      const faction = factions[0];
      p.investigated[faction] = true;
      events.push({ type: 'investigated', faction, plot: s.plots[faction] });
      return;
    }
    case 'policeReport': {
      if (requireHero(cmd, cmd.hero) !== 'velitel') fail(cmd, 'only the commander asks the police');
      if (p.at.velitel !== L.guardroom) fail(cmd, 'the police report is read in the guardroom');
      spendHour(p, 'velitel', cmd);
      policeReport(s, events);
      return;
    }
    case 'guard': {
      if (p.at.velitel !== p.at.zogu) fail(cmd, 'the commander must stand by the king');
      if (p.done.velitel) fail(cmd, 'velitel has ended the day');
      if (p.hours.velitel < 1) fail(cmd, 'velitel has no hours left');
      p.guarded = true;
      p.hours.velitel = 0;
      p.done.velitel = true;
      events.push({ type: 'guarding' }, { type: 'heroDone', hero: 'velitel' });
      return;
    }
    case 'decide': {
      if (inAudience) fail(cmd, 'the audience comes first');
      const hero = requireHero(cmd, cmd.hero);
      if (p.seal !== hero) fail(cmd, `${hero} does not carry the seal`);
      if (p.at[hero] !== decisionRoom(L, cmd.decision)) fail(cmd, `${cmd.decision} is sealed in ${decisionRoom(L, cmd.decision)}`);
      takeDecision(sc, s, cmd.decision, cmd.share ?? 2, dice, events);
      return;
    }
    case 'endDay': {
      if (inAudience) fail(cmd, 'the audience comes first');
      const hero = requireHero(cmd, cmd.hero);
      if (p.done[hero]) fail(cmd, `${hero} has already ended the day`);
      p.done[hero] = true;
      events.push({ type: 'heroDone', hero });
      return;
    }
    default:
      fail(cmd, 'not a palace command');
  }
}

/** Every palace command `hero` may give now (the UI's menus and the bot use it). */
export function palaceCommands(sc: Scenario, s: GameState, hero: Hero): Command[] {
  const p = s.palace;
  const L = sc.palace;
  if (!p || !L || (s.phase.kind !== 'audience' && s.phase.kind !== 'day') || p.done[hero]) return [];
  const audience = s.phase.kind === 'audience';
  const room = p.at[hero];
  const hasHour = p.hours[hero] >= 1;
  const out: Command[] = [];
  if (!(audience && hero === 'zogu')) for (const dir of exits(L, room)) out.push({ type: 'move', hero, dir });
  if (p.seal === null && room === L.study) out.push({ type: 'takeSeal', hero });
  if (p.seal === hero && p.at[other(hero)] === room) out.push({ type: 'giveSeal', hero });
  if (hero === 'zogu') {
    if (audience) {
      if (hasHour) out.push({ type: 'advice' });
    } else if (hasHour) {
      if (groupsInRoom(L, room).length > 0) out.push({ type: 'talk' });
      if (room === L.mother) for (const d of availableDecisions(sc, s)) out.push({ type: 'advice', decision: d.id });
      if (room === L.envoys) out.push({ type: 'envoys' });
    }
  } else if (hasHour) {
    if (factionsIn(sc, room).length > 0) out.push({ type: 'investigate' });
    if (room === L.guardroom) out.push({ type: 'policeReport', hero });
    if (room === p.at.zogu) out.push({ type: 'guard' });
  }
  if (!audience) {
    if (p.seal === hero && !s.decisionTaken) {
      for (const d of availableDecisions(sc, s)) if (decisionRoom(L, d.id) === room) out.push({ type: 'decide', hero, decision: d.id });
    }
    out.push({ type: 'endDay', hero });
  }
  return out;
}
```

- [ ] **Step 4: Route palace commands in `advance`**

In `src/games/diktator/logic/turn.ts`:

1. Add the import:

```ts
import { applyPalaceCommand, PALACE_COMMANDS, PALACE_ONLY } from './palace-actions';
```

2. In `advance`, directly after the line `const invalid = () => new Error(...)`, insert:

```ts
  if (s.palace && (phase.kind === 'audience' || phase.kind === 'day') && PALACE_COMMANDS.has(cmd.type)) {
    applyPalaceCommand(sc, s, cmd, dice, events);
    if (s.phase.kind === 'day' && s.palace.done.zogu && s.palace.done.velitel) evening(sc, s, dice, events);
    return { state: s, events };
  }
  if (!s.palace && PALACE_ONLY.has(cmd.type)) throw invalid();
```

(`PALACE_COMMANDS` contains `policeReport`, `decide` and `endDay`, so in palace mode those three always go through the palace rules and must name a hero; in classic mode they keep their plan-1 behaviour.)

- [ ] **Step 5: Run the tests**

Run: `npx vitest run && npx tsc --noEmit`
Expected: all pass. If a palace test fails, check the arithmetic against rules 1–8 at the top of this plan before touching logic; report a mismatch instead of bending the rule.

- [ ] **Step 6: Commit**

```bash
git add src/games/diktator/logic/palace-actions.ts src/games/diktator/logic/turn.ts tests/diktator/palace-actions.test.ts
git commit -m "feat(diktator): palace actions — moving, seal, talk, advice, envoys, investigate, report, guard, end of day"
```

---

### Task 4: The guarded assassination coin

**Files:**
- Modify: `src/games/diktator/logic/assassination.ts`
- Test: `tests/diktator/crises.test.ts` (extend)

- [ ] **Step 1: Write the failing test**

In `tests/diktator/crises.test.ts`, add the import:

```ts
import { newPalaceDay } from '../../src/games/diktator/logic/palace';
import { albania } from '../../src/games/diktator/scenario/albania';
```

and inside `describe('assassination (L1500–1560)', …)` add:

```ts
  it('guarded by the commander, the last-chance coin saves 3 times in 4 (our addition)', () => {
    const s = state();
    s.plots.armada = { kind: 'assassination' };
    s.pop.policie = 2;
    s.str.policie = 1;
    s.palace = newPalaceDay(albania.palace!);
    s.palace.guarded = true;
    expect(assassination(s, scriptedDice([0, 1]), [])).toBe(false);
    expect(assassination(s, scriptedDice([0, 3]), [])).toBe(false);
    expect(assassination(s, scriptedDice([0, 0]), [])).toBe(true);
  });
```

- [ ] **Step 2: Run to see it fail**

Run: `npx vitest run tests/diktator/crises.test.ts`
Expected: FAIL — `scriptedDice([0, 3])` throws "scripted int 3 not in 0..1" because the coin still has 2 sides.

- [ ] **Step 3: Implement**

In `src/games/diktator/logic/assassination.ts` replace the `survived` computation with:

```ts
  const coinSides = s.palace?.guarded ? RULES.guardedCoin : RULES.assassinationCoin;
  const survived =
    !allPlotting && (s.pop.policie > s.low || s.str.policie > s.low || dice.int(coinSides) !== 0);
```

and extend the doc comment's last sentence with: "With the commander guarding (palace mode), the coin has 4 sides and only 0 is fatal."

- [ ] **Step 4: Run the tests**

Run: `npx vitest run tests/diktator/crises.test.ts && npx tsc --noEmit`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/games/diktator/logic/assassination.ts tests/diktator/crises.test.ts
git commit -m "feat(diktator): the commander's guard makes the last-chance coin 3 in 4"
```

---

### Task 5: Valid commands and a palace playthrough

**Files:**
- Modify: `src/games/diktator/logic/turn.ts`
- Test: `tests/diktator/palace-actions.test.ts` (extend), `tests/diktator/turn.test.ts` (extend)

- [ ] **Step 1: Write the failing tests**

Append to `tests/diktator/palace-actions.test.ts` (add `palaceCommands` to the imports from `../../src/games/diktator/logic/palace-actions` and `validCommands` to the turn import):

```ts
import { palaceCommands } from '../../src/games/diktator/logic/palace-actions';
import { validCommands } from '../../src/games/diktator/logic/turn';
```

```ts
describe('palaceCommands', () => {
  it('during the audience Zogu may only ask for advice; the commander may move and act', () => {
    const s = newGame(albania, 4, undefined, { palace: true }).state;
    expect(palaceCommands(albania, s, 'zogu')).toEqual([{ type: 'advice' }]);
    expect(palaceCommands(albania, s, 'velitel')).toEqual([
      { type: 'move', hero: 'velitel', dir: 'up' },
      { type: 'move', hero: 'velitel', dir: 'left' },
      { type: 'move', hero: 'velitel', dir: 'right' },
      { type: 'policeReport', hero: 'velitel' },
    ]);
  });

  it('in the day, with the seal in the guardroom, the holder may seal the guardroom decisions', () => {
    let s = day();
    s = play(
      s,
      { type: 'move', hero: 'zogu', dir: 'left' },
      { type: 'takeSeal', hero: 'zogu' },
      { type: 'move', hero: 'zogu', dir: 'down' },
      { type: 'move', hero: 'zogu', dir: 'right' },
      { type: 'move', hero: 'zogu', dir: 'down' },
    );
    const cmds = palaceCommands(albania, s, 'zogu');
    const decisions = cmds.filter((c) => c.type === 'decide').map((c) => (c as { decision: string }).decision);
    expect(decisions).toEqual(['d33', 'd34', 'd35']);
    expect(cmds).toContainEqual({ type: 'talk' });
    expect(cmds).toContainEqual({ type: 'giveSeal', hero: 'zogu' });
    expect(cmds[cmds.length - 1]).toEqual({ type: 'endDay', hero: 'zogu' });
  });

  it('validCommands in palace mode lists the answers plus both heroes\' commands', () => {
    const s = newGame(albania, 4, undefined, { palace: true }).state;
    const cmds = validCommands(albania, s);
    expect(cmds.filter((c) => c.type === 'answer').length).toBeGreaterThanOrEqual(3);
    expect(cmds).toContainEqual({ type: 'advice' });
    expect(cmds).toContainEqual({ type: 'move', hero: 'velitel', dir: 'up' });
    expect(cmds.some((c) => c.type === 'endDay')).toBe(false);
  });

  it('every command palaceCommands offers is accepted by advance', () => {
    let s = day(7);
    for (let i = 0; i < 40 && s.phase.kind === 'day'; i++) {
      for (const hero of ['zogu', 'velitel'] as const) {
        for (const c of palaceCommands(albania, s, hero)) expect(() => advance(albania, s, c), JSON.stringify(c)).not.toThrow();
      }
      const moves = palaceCommands(albania, s, 'velitel').filter((c) => c.type === 'move');
      if (moves.length === 0) break;
      s = advance(albania, s, moves[i % moves.length]).state;
    }
  });
});
```

In `tests/diktator/turn.test.ts`, add a palace bot next to the existing bot (reuse its imports; add `newGame`'s options):

```ts
/** Plays random valid commands in palace mode until the game ends. */
function playRandomPalace(seed: number): GameState {
  const pickRng = makeRng(seed ^ 0x2c1b3c6d);
  let { state } = newGame(albania, seed, undefined, { palace: true });
  for (let step = 0; step < 60000; step++) {
    if (state.phase.kind === 'ended') return state;
    const options: Command[] = validCommands(albania, state);
    state = advance(albania, state, options[randInt(pickRng, options.length)]).state;
  }
  throw new Error(`palace seed ${seed} did not end`);
}

describe('palace bot playthrough', () => {
  it('20 random palace games always end properly', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const s = playRandomPalace(seed);
      expect(s.phase.kind).toBe('ended');
      expect(s.quarter).toBeLessThanOrEqual(57);
      if (s.phase.kind === 'ended' && s.phase.ending.kind === 'survived') expect(s.quarter).toBe(57);
    }
  });

  it('is deterministic', () => {
    expect(JSON.stringify(playRandomPalace(3))).toBe(JSON.stringify(playRandomPalace(3)));
  });
});
```

- [ ] **Step 2: Run to see failures**

Run: `npx vitest run tests/diktator/palace-actions.test.ts tests/diktator/turn.test.ts`
Expected: FAIL — `validCommands` still returns classic commands in palace mode (the palace bot throws on the hero-less `endDay`).

- [ ] **Step 3: Implement**

In `src/games/diktator/logic/turn.ts`:

1. Extend the import from `./palace-actions` with `palaceCommands`.
2. At the top of `validCommands`, before the `switch`, insert:

```ts
  if (s.palace && (s.phase.kind === 'audience' || s.phase.kind === 'day')) {
    const answers: Command[] = [];
    if (s.phase.kind === 'audience') {
      answers.push({ type: 'answer', answer: 'yes' }, { type: 'answer', answer: 'no' }, { type: 'answer', answer: 'goAway' });
      const phase = s.phase;
      const from = sc.petitions.find((p) => p.id === phase.petition)?.from;
      if (!phase.suggested && sc.petitions.some((p) => p.from === from && !s.used[p.id])) {
        answers.push({ type: 'answer', answer: 'suggestOther' });
      }
    }
    return [...answers, ...palaceCommands(sc, s, 'zogu'), ...palaceCommands(sc, s, 'velitel')];
  }
```

3. Update `validCommands`' doc comment: "In palace mode the audience and the day list the answers (audience only) and every command of both heroes (`palaceCommands`)."

- [ ] **Step 4: Run the tests**

Run: `npx vitest run && npx tsc --noEmit`
Expected: all pass. The palace bot is slower than the classic one (many moves per day); if the suite's run time for `turn.test.ts` exceeds Vitest's default 5 s per test, add `{ timeout: 30000 }` as the third argument of that `it` only.

- [ ] **Step 5: Commit**

```bash
git add src/games/diktator/logic/turn.ts tests/diktator/palace-actions.test.ts tests/diktator/turn.test.ts
git commit -m "feat(diktator): palace commands for the UI, palace playthrough test"
```

---

## Self-review notes (done while writing)

- **Spec coverage:** §5.1 room grid, names, group rooms, rebels on the guardroom map, envoys → Task 1; §5.2 moods seen (`palace.seen`) and plots only by investigation → Tasks 1, 3; §5.3 hours, every action, the seal, one decision per quarter, solo play (a UI matter for plan 2b: both heroes' commands exist regardless of devices), evening on "Konec dne" → Tasks 2, 3, 5; §9 guard the king → Task 4. Rendering, the palace strip, transitions, menus, the playroom's contents → plan 2b / plan 3.
- **Decisions recorded at the top** (rules 1–8) where the spec left room; each is visible in code comments or error messages.
- **Classic mode unchanged:** `palace` is null there, `PALACE_ONLY` commands are refused, `policeReport` / `decide` / `endDay` keep their plan-1 paths, and the plan-1 bot keeps running classic games.
- **Type names across tasks:** `Hero`, `Direction`, `RoomId`, `PalaceLayout`, `PalaceState`, `ROOM_GROUPS`, `neighbour`, `exits`, `roomOfGroup`, `groupsInRoom`, `decisionRoom`, `newPalaceDay`, `other` (Task 1); `GameOptions`, `palace` field, new commands and events (Task 2); `applyPalaceCommand`, `palaceCommands`, `wishFor`, `PALACE_COMMANDS`, `PALACE_ONLY` (Tasks 3, 5).
