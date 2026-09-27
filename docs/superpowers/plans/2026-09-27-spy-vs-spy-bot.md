# Spy vs Spy Computer Opponent Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. TDD per task: failing test → implement → pass → commit.

**Goal:** A fair, seeded computer spy (IQ 1–5) that plays through the same `SpyInput` as a controller, selectable per side in the menu, plus a headless bot-vs-bot tournament command.

**Architecture:** New pure folder `src/games/spy-vs-spy/bot/` next to `logic/`: eyes (`view.ts`) → memory → decision → route → motor, plus a fight controller and one IQ table. `bot.think(state, events, dt)` builds the fair view first and never touches `state` again, then returns a `SpyInput` that `main.ts` feeds to `step` in place of a device. `logic/` learns only one new thing: `Spy.maxHealth` (the low-IQ handicap).

**Tech Stack:** TypeScript 7 strict + noUnusedLocals, Vite 8 (multi-page, base `./`), Vitest 5, Canvas 2D. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-09-27-spy-vs-spy-bot-design.md` (read it before each task; section numbers below refer to it).

**Worktree:** `C:\Users\TomášPajonk\source\repos\timurlain\local-coop-games-bot`, branch `feat/bot` (node_modules installed). Never touch the main checkout or other worktrees.

## Global Constraints

- Everything in `bot/` is pure: no DOM, no `Math.random`, no `Date`/`performance`; time only from the `dt` given. Its RNG is its own `RngState` (`shared/rng.ts`: `makeRng`, `rand`, `randInt`, `pick`) seeded `(gameSeed ^ (side === 0 ? 0x85ebca6b : 0x9e3779b9)) >>> 0` — never `state.rng`.
- Fairness (§3): after `botView()` returns, the brain never reads `GameState`. `bot.ts` is the only file in `bot/` that imports `GameState` as a value input; `view.ts` is the only file that reads it.
- Health handicap (§1): IQ 1 → 5, IQ 2 → 6, IQ 3–5 → `RULES.health` (7); humans 7.
- IQ names (Czech, in `src/shared/i18n/cs.ts`): 1 nemotorný, 2 začátečník, 3 šikovný, 4 mazaný, 5 mistr špión. Menu choice labels „Hráč" / „Počítač"; strip label „Počítač IQ n".
- Every task ends with `npx vitest run`, `npx tsc --noEmit`, `npm run build` clean. No servers left running.
- Commits end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Existing gameplay fingerprints (`tests/spy-vs-spy/setting.test.ts`) must not change: bots don't touch `state.rng` and human games are unchanged.

## Review Focus

1. **Target changes under the bot** (the opponent takes the item, a door closes again, a piece he walked to is now trapped/searched): he must re-plan within one think interval — never press Akce forever at the same spot. Test in Task 6.
2. **„Skrýt letiště" on:** the exit is invisible until he holds the full kufřík; he must keep exploring and then find/reuse it, not stall. Test in Task 6.
3. **Pause / tab blur during a bot game:** `main.ts` must not call `think` while paused, and resuming must not dump a backlog of delayed inputs (the motor's delay queue is time-based on game `dt` only). Test in Task 5 (queue) + browser check in Task 10.
4. **Big levels:** `think` on level 8 (6×6) must stay cheap — under 0.5 ms average per call in the whole-game test on a normal machine; route search only on think ticks, not every frame. Test in Task 9.
5. **Old saved settings** without the new `sides` key (and junk values) load as two humans, IQ 3. Test in Task 10.

---

## File structure

| File | Responsibility |
|---|---|
| `logic/state.ts` | `Spy.maxHealth` |
| `logic/generator.ts` | `GameOptions.maxHealth?: [number, number]` |
| `logic/fight.ts`, `logic/death.ts` | regen and respawn cap at `spy.maxHealth` |
| `render/hud.ts` | pips drawn up to `spy.maxHealth` |
| `logic/places.ts` | `itemRooms` moved here from `render/map.ts` (shared by render and bot eyes) |
| `bot/iq.ts` | `Iq` type, `IQ_PARAMS`, `botMaxHealth(iq)` |
| `bot/view.ts` | `BotView` types, `botView()`, `noticedEvents()` |
| `bot/memory.ts` | `Memory` notebook, `createMemory`, `remember`, `forget` |
| `bot/route.ts` | `route()` over known rooms/doors with danger costs |
| `bot/motor.ts` | `Motor`: intents → `SpyInput`, reaction delay queue, low-IQ slips |
| `bot/decide.ts` | goal scoring, `chooseGoal()` |
| `bot/fight.ts` | fight controller while sharing a room |
| `bot/bot.ts` | `createBot()`, `Bot.think()` — wires the layers |
| `bot/tournament.ts` | `playGame()`, `runTournament()`, `formatReport()` (pure) |
| `scripts/bots.mjs` | CLI: parses args, loads `bot/tournament.ts` via Vite `runnerImport`, prints |
| `settings.ts` | `sides` setting + migration |
| `main.ts`, `index.html`, `src/shared/i18n/cs.ts` | menu rows, start rules, feeding bot inputs, pause rules, strip name |
| `tests/spy-vs-spy/bot-*.test.ts` | one test file per bot layer + `bot-games.test.ts` |

---

### Task 1: Health handicap in logic (spec §1)

**Files:**
- Modify: `src/games/spy-vs-spy/logic/state.ts` (add to `Spy`: `/** full health for this spy (bot handicap, spec bot §1); humans RULES.health */ maxHealth: number;`)
- Modify: `src/games/spy-vs-spy/logic/generator.ts` (`GameOptions.maxHealth?: readonly [number, number]`; `createSpy` sets `health` and `maxHealth` from it, default `RULES.health`)
- Modify: `src/games/spy-vs-spy/logic/fight.ts:121` (`Math.min(spy.maxHealth, …)`), `logic/death.ts:105` (`spy.health = spy.maxHealth`)
- Modify: `src/games/spy-vs-spy/render/hud.ts:90` (loop to `spy.maxHealth`)
- Test: `tests/spy-vs-spy/fight.test.ts`, `tests/spy-vs-spy/death.test.ts`, `tests/spy-vs-spy/generator.test.ts`

**Interfaces:** Produces `Spy.maxHealth: number`, `GameOptions.maxHealth?: readonly [number, number]`.

- [ ] **Step 1: failing tests**
  - `createGame(1, 1, { maxHealth: [7, 5] })` → spies[1].health === 5 and maxHealth === 5; spies[0] 7/7; `createGame(1, 1)` → both 7/7.
  - regen: a spy with maxHealth 5 at health 3 after a long `updateHealthRegen` ends at 5, never 6.
  - respawn: kill a maxHealth-6 spy, run `updateDead` past the respawn time → health 6.
- [ ] **Step 2:** run `npx vitest run tests/spy-vs-spy/generator.test.ts tests/spy-vs-spy/fight.test.ts tests/spy-vs-spy/death.test.ts` → FAIL (`maxHealth` missing).
- [ ] **Step 3:** implement as listed; grep `RULES.health` in `src/` — every remaining use must be the default/human value, not a cap on a live spy.
- [ ] **Step 4:** full test/tsc/build; fingerprint tests unchanged.
- [ ] **Step 5:** commit `feat(spy): per-spy maximum health`.

### Task 2: IQ table and the eyes (spec §3, §6 table)

**Files:**
- Create: `src/games/spy-vs-spy/bot/iq.ts`, `src/games/spy-vs-spy/bot/view.ts`
- Modify: `src/games/spy-vs-spy/logic/places.ts` (receive `itemRooms` from `render/map.ts`; `render/map.ts` imports it from there)
- Test: `tests/spy-vs-spy/bot-view.test.ts`

**Interfaces — produces (exact):**

```ts
// bot/iq.ts
export type Iq = 1 | 2 | 3 | 4 | 5;
export const IQS: readonly Iq[] = [1, 2, 3, 4, 5];
export function isIq(n: unknown): n is Iq;
export interface IqParams {
  reaction: number;        // s between seeing and pressing: 0.8, 0.65, 0.4, 0.3, 0.2
  thinkEvery: number;      // s between decisions: 0.5, 0.4, 0.25, 0.22, 0.2
  forgetPerMinute: number; // chance a memory entry fades per minute: 0.5, 0.3, 0.1, 0.03, 0
  forgetOwnTraps: boolean; // true for IQ 1–2
  noise: number;           // decision noise added to goal scores (score units, see decide.ts): 40, 25, 12, 5, 1
  trapWill: number;        // 0..1 appetite for setting traps: 0.15, 0.3, 0.55, 0.75, 0.9
  smartTraps: boolean;     // placement uses glances/items/exit (IQ ≥ 3)
  glancePerSecond: number; // chance per second to glance at the other half: 0, 0.02, 0.06, 0.12, 0.2
  slipChance: number;      // chance per motor intent of a wrong/overshoot input: 0.15, 0.08, 0.03, 0.01, 0
  duckChance: number;      // reads a bash and ducks: 0.1, 0.3, 0.5, 0.75, 0.95
  preBlock: number;        // chance to hold block when a jab is likely: 0, 0.1, 0.3, 0.5, 0.7
  punish: number;          // bash after a blocked jab: 0, 0.1, 0.4, 0.7, 0.9
  fleeAt: number | null;   // flee when own health ≤ this and opponent's ≥ 4: null, 1, 2, 2, 3
}
export const IQ_PARAMS: Readonly<Record<Iq, IqParams>>;
export function botMaxHealth(iq: Iq): number; // 1 → 5, 2 → 6, else RULES.health
export function botRngSeed(gameSeed: number, side: PlayerId): number;

// bot/view.ts
export interface PieceView { id: number; kind: FurnitureKind; x: number; z: number; source: RemedyKind | null; armoury: boolean }
export interface DoorView { dir: Dir; key: string; to: number | null; open: boolean; exit: boolean }
export interface OpponentView { x: number; z: number; facing: -1 | 1; health: number; mode: SpyMode;
  attack: AttackKind | null; strikeIn: number; blocking: boolean; ducking: boolean; carrying: boolean }
export interface SelfView { id: PlayerId; room: number; x: number; z: number; facing: -1 | 1; mode: SpyMode;
  health: number; maxHealth: number; hand: Thing | null; stock: Readonly<Record<TrapKind, number>>;
  selected: TrapKind | null; trapPress: number | null; mapOpen: boolean; clock: number; armouryTimer: number;
  swingCooldown: number; attack: AttackKind | null; placing: boolean; doorOpening: boolean }
export interface KnownRoom { id: number; doors: Readonly<Record<Dir, boolean>>; exit: Dir | null }
export interface Glance { room: number; hand: Thing | null }
export interface BotView {
  time: number; cols: number; rows: number; hideAirport: boolean;
  self: SelfView; pieces: PieceView[]; doors: DoorView[];
  opponent: OpponentView | null;          // only while in the same room and active/visible
  known: KnownRoom[];                      // visited rooms only; exit only if exitVisibleTo(self)
  armouryRoom: number | null;              // marked for both spies
  itemRooms: number[] | null;              // only while self.mapOpen (the paid big map): itemRooms()
  glance: Glance | null;                   // only when the caller passes glance = true
}
export function botView(state: Readonly<GameState>, side: PlayerId, glance: boolean): BotView;
/** Events the bot's spy would notice: his own (spy === side) and ones in his current room (tick/explode). */
export function noticedEvents(events: readonly GameEvent[], side: PlayerId, room: number): GameEvent[];
```

- [ ] **Step 1: failing tests** (`bot-view.test.ts`)
  - IQ table: `botMaxHealth(1) === 5`, `(2) === 6`, `(3..5) === 7`; every param monotone in the direction the spec says (reaction falls with IQ, duckChance rises, …).
  - `botRngSeed` differs for sides 0 and 1 and is stable.
  - **Fairness:** for seeds 1–30 and levels 1, 3, 8, create a game, place a trap of each kind for the opponent (use the logic helpers directly on state: set `f.trap`, `state.doorTraps[key]`, push a `TimeBomb`), then `JSON.stringify(botView(state, 0, false))` must not contain the keys `"trap"`, `"hidden"`, `"owner"`, `"fuse"`, nor any furniture id of another room; `itemRooms` is null while `mapOpen` is false; `opponent` is null when the opponent is in another room; `known` lists only visited rooms; with `hideAirport` and no full kufřík no `exit` is true in `known` or `doors`.
  - With `mapOpen` true, `itemRooms` equals `itemRooms(state, spy)` as an array.
  - With `glance = true`, `glance.room` is the opponent's room; with `false`, null.
  - `noticedEvents` keeps own `found`/`died`/`disarmed`, keeps `explode` for his room, drops the opponent's `found`.
- [ ] **Step 2:** run → FAIL (modules missing).
- [ ] **Step 3:** implement; move `itemRooms` to `logic/places.ts` and update `render/map.ts`'s import (no behaviour change).
- [ ] **Step 4:** full test/tsc/build.
- [ ] **Step 5:** commit `feat(bot): IQ table and the bot's fair view`.

### Task 3: Memory (spec §4)

**Files:** Create `src/games/spy-vs-spy/bot/memory.ts`; Test `tests/spy-vs-spy/bot-memory.test.ts`

**Interfaces — produces:**

```ts
export type PieceNote =
  | { kind: 'empty' } | { kind: 'remedy'; remedy: RemedyKind } | { kind: 'item'; thing: 'secret' | 'kufrik'; secret?: SecretKind }
  | { kind: 'fixture'; remedy: RemedyKind } | { kind: 'armoury' };
export interface Danger { at: { piece: number } | { door: string } | { room: number }; cause: DeathCause | TrapKind; since: number }
export interface Memory {
  pieces: Map<number, { room: number; note: PieceNote; at: number }>; // piece id → what he found
  itemRoomsSeen: Map<number, number>;   // room → time seen as a dot on the paid map
  ownTraps: Map<string, TrapKind>;      // `p:<pieceId>` | `d:<doorKey>` | `f:<room>` → kind
  dangers: Danger[];
  lastGlance: (Glance & { at: number }) | null;
  lastSeenOpponent: { room: number; at: number } | null;
  searchedCount: number;                 // searches since the last map use
  foundSinceMap: number;
}
export function createMemory(): Memory;
/** Updates the notebook from this tick's view and the noticed events (search results, own traps set, deaths, disarms). */
export function remember(mem: Memory, view: BotView, events: readonly GameEvent[], pendingTrapTarget: string | null): void;
/** Fades entries per IQ (`forgetPerMinute`, `forgetOwnTraps`) using the bot RNG. */
export function forget(mem: Memory, iq: Iq, dt: number, rng: RngState): void;
```

- [ ] **Step 1: failing tests:** a `found` with thing null → piece `empty`; `found` remedy → `remedy`; `alreadyHave` → `item` (couldn't take); `resupplied` → `armoury`; `trapSet` with `pendingTrapTarget` set → `ownTraps` entry; `died` cause bomba while searching piece P → danger `{piece: P}`; `died` elektrina at a door → danger `{door}`; fixtures in view recorded as `fixture` without a search; `forget` at IQ 5 never removes anything over 10 simulated minutes; at IQ 1 removes some entries over 10 minutes (seeded, exact count asserted) and own traps too; at IQ 3 never removes own traps.
- [ ] **Step 2:** run → FAIL. **Step 3:** implement. **Step 4:** full test/tsc/build.
- [ ] **Step 5:** commit `feat(bot): the bot's notebook`.

### Task 4: Route (spec §6)

**Files:** Create `src/games/spy-vs-spy/bot/route.ts`; Test `tests/spy-vs-spy/bot-route.test.ts`

**Interfaces — produces:**

```ts
export interface Hop { from: number; dir: Dir; to: number; key: string }
/** Cheapest path over known rooms and their doors (each door 1; a door or the room of a known danger +DANGER_COST).
 *  `null` if unreachable with known doors. The start room may be unvisited only if it is the current room. */
export function route(known: readonly KnownRoom[], cols: number, from: number, to: number, dangers: readonly Danger[]): Hop[] | null;
export const DANGER_COST = 6;
/** Nearest room adjacent (by a known door) to known space that is not yet visited, for exploring. */
export function nearestFrontier(known: readonly KnownRoom[], cols: number, rows: number, from: number): Hop[] | null;
```

- [ ] **Step 1: failing tests** on hand-made `KnownRoom[]` grids: straight path; picks the shorter of two; detours around a danger door when the detour ≤ 6 extra; goes through the danger when no detour; `null` when the target is not reachable; `nearestFrontier` returns the hop into the closest unvisited room; deterministic tie-break (N, S, E, W order).
- [ ] **Step 2:** FAIL. **Step 3:** Dijkstra (tiny grids: ≤ 36 rooms; a simple array-scan priority is fine). **Step 4:** full.
- [ ] **Step 5:** commit `feat(bot): route through known rooms`.

### Task 5: Motor — legs and hands (spec §6)

**Files:** Create `src/games/spy-vs-spy/bot/motor.ts`; Test `tests/spy-vs-spy/bot-motor.test.ts`

**Interfaces — produces:**

```ts
export type Intent =
  | { kind: 'idle' }
  | { kind: 'walkTo'; x: number; z: number }
  | { kind: 'useDoor'; dir: Dir }              // walk to the door, open it if closed (Akce), walk through
  | { kind: 'search'; piece: PieceView }       // walk into reach, face it, Akce (with empty hands or the thing to hide)
  | { kind: 'place'; trap: TrapKind; at: PieceView | Dir | 'here' } // cycle to `trap` by taps, walk into reach, Akce
  | { kind: 'openMap' }                        // hold the trap key past RULES.trapTapMax, release after reading
  | { kind: 'fight'; input: SpyInput };        // raw fight input from bot/fight.ts, still delayed
export interface Motor {
  /** The input for this tick. Decisions are delayed by `iq.reaction` of game time before they reach the keys. */
  drive(view: BotView, intent: Intent, dt: number): SpyInput;
  /** true when the last intent has been carried out (searched, placed, went through, arrived). */
  done(): boolean;
}
export function createMotor(iq: Iq, rng: RngState): Motor;
```

Details the tests pin: the delay queue stores intents with the game time they were decided and releases them after `reaction`; a new intent replaces an older unreleased one of the same kind (no backlog: 10 s of paused `dt = 0` then resuming yields one intent, not many); trap taps are separate presses (key up between) so `logic/traps.ts` counts them as taps; the map hold releases after 0.6 s of open map; `slipChance` produces an occasional wrong direction for one tick (seeded, count asserted).

- [ ] **Step 1: failing tests** — drive the real `step()` with the motor's inputs (bot on side 0, side 1 `NO_INPUT`) on seeded games:
  - `walkTo` reaches within 3 units of the point in the same room;
  - `useDoor` on a closed door ends with the spy in the neighbouring room;
  - `search` on a piece in his room produces a `searchStart` event for side 0;
  - `place` bomba on a piece produces `trapSet` (stock −1) — with stock of an earlier kind in the cycle, the taps skip past it correctly;
  - `openMap` produces `mapOpened` once and the map closes afterwards;
  - reaction: at IQ 1 the first key press of a new intent comes ≥ 0.8 s of game time after it was given; at IQ 5 ≥ 0.2 s;
  - no backlog after a long run of `dt = 0` calls.
- [ ] **Step 2:** FAIL. **Step 3:** implement (steering: move in x toward the target, z toward the target, stop within tolerance; door approach points from `RULES` door geometry, reading `logic/places.ts` `doorAt`/`inReach` semantics). **Step 4:** full.
- [ ] **Step 5:** commit `feat(bot): the bot's legs and hands`.

### Task 6: Decision and the assembled bot — find, carry, escape (spec §2, §5)

**Files:** Create `src/games/spy-vs-spy/bot/decide.ts`, `src/games/spy-vs-spy/bot/bot.ts`; Test `tests/spy-vs-spy/bot-decide.test.ts`, `tests/spy-vs-spy/bot-solo.test.ts`

**Interfaces — produces:**

```ts
// decide.ts
export type Goal =
  | { kind: 'search'; piece: number } | { kind: 'fetch'; piece: number } | { kind: 'escape' }
  | { kind: 'explore' } | { kind: 'trap'; trap: TrapKind; at: number | string | 'here' }
  | { kind: 'remedy'; piece: number; remedy: RemedyKind } | { kind: 'armoury'; piece: number | null }
  | { kind: 'map' } | { kind: 'fight' } | { kind: 'flee'; dir: Dir };
export interface Scored { goal: Goal; score: number }
/** All goals with their scores (0..100 + noise), highest first. The current goal gets STICKY (+15). */
export function scoreGoals(view: BotView, mem: Memory, iq: Iq, current: Goal | null, rng: RngState): Scored[];
export function chooseGoal(view: BotView, mem: Memory, iq: Iq, current: Goal | null, rng: RngState): Goal;
export const STICKY = 15;

// bot.ts
export interface Bot { readonly side: PlayerId; readonly iq: Iq; think(state: Readonly<GameState>, events: readonly GameEvent[], dt: number): SpyInput }
export function createBot(side: PlayerId, iq: Iq, gameSeed: number): Bot;
```

In this task only the goals search / fetch / escape / explore / map are scored; trap, remedy, armoury, fight and flee score 0 until Tasks 7–8. `think`: advance forget + glance roll → `botView` → `noticedEvents` → `remember` → every `thinkEvery` re-choose the goal → goal → intent (route hops become `useDoor`) → `motor.drive`. Re-plan immediately when the target vanished (piece now noted, door closed, item room no longer a dot).

- [ ] **Step 1: failing tests**
  - `bot-decide`: prepared views/memories — kufřík with all four + known exit → `escape`; hand holds kufřík without plány and a noted item piece with plány → `fetch` it; nothing known → `explore` or nearest unsearched `search`; after 8 searches with 0 finds and clock > 60 s → `map` wins at IQ 5; stickiness keeps a goal unless another beats it by > STICKY; noise at IQ 1 changes the choice in some seeded cases, at IQ 5 never in the same cases.
  - `bot-solo` (the milestone): for seeds 1–20 on level 1, side 0 IQ 5 bot, side 1 `NO_INPUT` parked (set spies[1].mode `'out'` via a helper so he can't be met), `dt = 1/60`: the bot escapes before his clock runs out in ≥ 18 of 20 games; at IQ 1 escapes in ≥ 8 of 20 (slower but not hopeless). Same seed twice → identical tick count.
  - Review Focus 1: during a solo run, move the item the bot is walking to into another piece (mutate state) → within `thinkEvery + reaction + 0.1 s` his goal target changes; no spot with > 10 Akce presses in a row without an event.
  - Review Focus 2: `hideAirport: true`, seeds 1–10, IQ 5 → still escapes in ≥ 9 of 10.
- [ ] **Step 2:** FAIL. **Step 3:** implement. **Step 4:** full.
- [ ] **Step 5:** commit `feat(bot): the bot finds the items and escapes`.

### Task 7: Traps, remedies, armoury (spec §5)

**Files:** Modify `bot/decide.ts`, `bot/bot.ts`; Test `tests/spy-vs-spy/bot-traps.test.ts`

Scoring rules:
- **trap:** `stock > 0`, a valid target in his room (same rules as `logic/traps.ts` `placeTargetFor`) not in `mem.ownTraps`; value × `trapWill`. With `smartTraps`: +value when the room is on the opponent's likely path (last glance room adjacent / same), holds a noted item piece, or has the exit; without: any valid target, flat value.
- **remedy:** his next route hop or target is a known danger whose remedy he doesn't hold and a fixture/noted remedy of that kind is known → fetch it.
- **armoury:** total stock ≤ 1 and `armouryTimer === 0` and `armouryRoom` known → go and search it.
- He never searches a piece noted in `ownTraps` (unless forgotten).

- [ ] **Step 1: failing tests:** IQ 5 bot in a room with a free piece and bomba stock sets it within 10 s when the room holds a noted item; IQ 1 in the same state sets it in fewer seeded runs; after dying at door D by elektrina he fetches a deštník from a known věšák before using D (or detours); with stock 0 and the armoury room known he walks there and gets `resupplied`; he doesn't search his own trapped piece at IQ 3; at IQ 1 with forgetting forced he can.
- [ ] **Step 2–4:** FAIL → implement → full.
- [ ] **Step 5:** commit `feat(bot): traps, remedies and the armoury`.

### Task 8: Fighting (spec §7)

**Files:** Create `src/games/spy-vs-spy/bot/fight.ts`; Modify `bot/decide.ts` (fight / flee), `bot/bot.ts`; Test `tests/spy-vs-spy/bot-fight.test.ts`

**Interfaces — produces:** `export function fightInput(view: BotView, iq: Iq, rng: RngState, memo: FightMemo): SpyInput;` and `export interface FightMemo { lastOpponentAttack: AttackKind | null; decidedAt: number }` — fed through the motor as `{ kind: 'fight', input }` so the reaction delay applies.

Behaviour: keep x distance near `RULES.fightRangeX - 6`; step in and Akce (jab) or up + Akce (bash) off cooldown, mixed by seeded choice; on a seen bash wind-up duck (trap + down) with `duckChance`; hold block (trap, no down) with `preBlock` when the opponent is in range and not winding up; after the opponent's jab is `blocked`, bash with `punish`; flee (goal `flee` → `useDoor` nearest door) when `fleeAt !== null && own ≤ fleeAt && opp ≥ 4`.

- [ ] **Step 1: failing tests** (two-spy set-ups in one room, scripted human side):
  - scripted opponent bashes repeatedly: over 40 bashes the IQ 5 bot ducks ≥ 32, IQ 1 ≤ 10 (seeded exact numbers recorded once);
  - a jab from a non-blocking IQ 5 bot always lands (0.15 s < 0.2 s reaction) — the bot can't cheat reaction;
  - IQ 5 at health 2 vs 6 → leaves the room within 3 s; IQ 1 never leaves;
  - IQ 5 vs a passive opponent wins the fight within 20 s;
  - bot vs bot IQ 5 vs IQ 1 fights: IQ 5 wins ≥ 80 % of 30 seeded fights.
- [ ] **Step 2–4:** FAIL → implement → full.
- [ ] **Step 5:** commit `feat(bot): the bot fights`.

### Task 9: Whole games and the tournament (spec §8, §9)

**Files:** Create `src/games/spy-vs-spy/bot/tournament.ts`, `scripts/bots.mjs`; Modify `package.json` (`"bots": "node scripts/bots.mjs"`); Test `tests/spy-vs-spy/bot-games.test.ts`

**Interfaces — produces:**

```ts
export interface GameSummary { seed: number; result: 'white' | 'black' | 'draw' | 'timeout' | 'capped'; seconds: number;
  deaths: Record<DeathCause, number>; trapsSet: number; disarmed: number; salvaged: number; armoury: number; maps: number; stuck: boolean; thinkMs: number }
export interface TournamentOptions { games: number; iq: readonly [Iq, Iq]; level: number; gameLength: GameLengthMultiplier; seed: number }
export function playGame(seed: number, level: number, iq: readonly [Iq, Iq], gameLength: GameLengthMultiplier): GameSummary;
export function runTournament(opts: TournamentOptions): GameSummary[];
export function formatReport(opts: TournamentOptions, games: readonly GameSummary[]): string; // Czech-free, plain ASCII table
```

`playGame`: `createGame(seed, level, { gameLength, maxHealth: [botMaxHealth(iq[0]), botMaxHealth(iq[1])] })`, two bots, `dt = 1/60`, loop until `state.result` or both spies out, hard cap = 2 × the scaled clock in ticks (`'capped'`). Stuck = a spy in `'normal'` that moved < 1 unit and stayed in one room for 60 s of game time. `thinkMs` measured by the caller only in tests (pass a clock function; default `() => 0`, keeping `bot/` pure).

`scripts/bots.mjs`: `import { runnerImport } from 'vite'`; `const { module } = await runnerImport('/src/games/spy-vs-spy/bot/tournament.ts')`; args `--games N` (default 100) `--iq AvB` (default 3v3) `--level L` (default 2) `--length M` (default 1) `--seed S` (default 1); games use seeds S..S+N−1; print `formatReport`.

- [ ] **Step 1: failing tests:** levels 1–2, seeds 1–10, IQ 3v3: every game ends (no `'capped'`), no `stuck`, same seed → identical summary; IQ 5v1 over 20 seeds on level 1: side 0 wins ≥ 14; `formatReport` has lines for wins, draws, average length, deaths by cause; Review Focus 4: level 8, one game IQ 5v5 with a real clock (`performance.now` passed in from the test) → average think < 0.5 ms.
- [ ] **Step 2–4:** FAIL → implement → full; run `npm run bots -- --games 50 --iq 3v3 --level 2` and paste the report into the commit message body. If IQ 5 does not dominate IQ 1 or games stall, tune `IQ_PARAMS` (not the tests) and note the changes.
- [ ] **Step 5:** commit `feat(bot): bot-vs-bot games and the tournament command`.

### Task 10: Menu, screen and play (spec §1)

**Files:** Modify `src/games/spy-vs-spy/settings.ts`, `src/games/spy-vs-spy/main.ts`, `src/games/spy-vs-spy/index.html`, `src/shared/i18n/cs.ts`, `src/games/spy-vs-spy/render/hud.ts` (strip name); Test `tests/spy-vs-spy/settings.test.ts`, `tests/spy-vs-spy/menu-sides.test.ts`

**Interfaces — produces:**

```ts
// settings.ts
export interface SideSetting { bot: boolean; iq: Iq }
// Settings gains: sides: readonly [SideSetting, SideSetting]  (default both { bot: false, iq: 3 })
/** Which slots need a human to press Akce before the game can start. */
export function humanSlots(sides: Settings['sides']): PlayerId[];
/** The game can start: every human slot joined; with no human slot, true (any key starts). */
export function canStart(sides: Settings['sides'], joined: readonly [boolean, boolean]): boolean;
```

`main.ts`: menu rows per side (`<select>` Hráč/Počítač + IQ select shown only for Počítač, option text „IQ 3 (šikovný)"); a joining device takes the first free **human** slot; the join label of a bot slot shows „Počítač IQ n"; start rule via `canStart` (bot vs bot: any key/button, `input.anyKeyPressed()`); `startGame` builds `bots = sides.map((s, i) => s.bot ? createBot(i, s.iq, seed) : null)` and passes `maxHealth`; each play tick, a bot side's input is `bot.think(state, lastEvents, dt)` (`lastEvents` = the previous `step`'s events), called only while `screen === 'play'`; pause/pad-lost only considers human slots, and with no human any key pauses; strip under a bot's half: „Černý · Počítač IQ 3".

- [ ] **Step 1: failing tests:** `migrateSettings({})` → sides both human IQ 3; `{ sides: [{ bot: true, iq: 9 }, 'x'] }` → `[{ bot: true, iq: 3 }, { bot: false, iq: 3 }]` (Review Focus 5); round trip keeps a valid choice; `humanSlots`/`canStart` for H+H, H+B, B+H, B+B.
- [ ] **Step 2–4:** FAIL → implement → full.
- [ ] **Step 5: browser check (controller):** menu both variants, a human-vs-IQ1 game (bot walks, searches, fights), bot-vs-bot demo runs, pause and resume do not make the bot jump (Review Focus 3); screenshot to the scratchpad.
- [ ] **Step 6:** commit `feat(spy): play against the computer`.

### Finish

Full test/tsc/build; `npm run bots -- --games 100 --iq 1v5 --level 1` and `--iq 3v3 --level 2` reports for the user; final review (fable-advisor) of `main..feat/bot`; build + persistent local server (`vite preview`, 127.0.0.1) for the user's play test; push/PR only when the user asks.
