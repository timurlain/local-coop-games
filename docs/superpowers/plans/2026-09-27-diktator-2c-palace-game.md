# Diktátor 2c — the palace game (split screen) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the palace playable: two players (or one switching with Tab/Back) jump between rooms with the arrows on a split screen, open each room's menu, answer the audience, seal decisions, and go through the shared screens (evening, new quarter, revolution, ending) with autosave.

**Architecture:** Everything the players see is built by pure, tested modules in `src/games/diktator/ui/` (menus, notes, HUD, shared screens, controls, flick edges) from the existing rules (`palaceCommands`, `advance`). Rendering adds a stage module (`render/rooms/stage.ts`: slide between rooms, wall bump, heroes drawn apart from the room) on top of plan 2b's `drawRoom`. The page (`index.html` + `main.ts` + `ui/dom.ts`) only wires input, state and DOM together; the old text mode moves to `text.html` and stays reachable.

**Tech Stack:** TypeScript (strict, `noUnusedLocals`), Vite multi-page, Vitest, Canvas 2D, DOM overlays. No runtime dependencies.

**Spec:** `docs/superpowers/specs/2026-09-26-diktator-design.md` — §4.1 (one quarter), §5 (the palace: rooms, strip, split screen, moves, 0.4 s transition, bump), §5.3 (actions, dialogs per half, solo switch), §9 (crises and endings, retry), §10 (save), §12 (controls).

**Not in this plan:** the newspaper and history (plan 3 — the quarter card is its placeholder), playroom items and the strip's playroom star (plan 3), the march (plan 4), generated art (plan 5), menus/settings/music and the finale screens (plan 6), grey-out reasons for commands that are not valid (menus list only valid commands).

---

## Global constraints

- Logic stays pure: nothing under `src/games/diktator/logic/` changes in this plan.
- `ui/*.ts` modules (except `ui/dom.ts`) must not touch `document`/`window` — they are tested in Node.
- Czech strings live in `src/shared/i18n/cs.ts` (`cs.diktator…`), never inline in `ui/` or `main.ts` (the canvas scene keeps its existing few labels).
- Every canvas function that changes canvas state wraps itself in `ctx.save()`/`ctx.restore()`.
- Canvas rotate convention from the puppet code is untouched (this plan draws no new puppets).
- Commit after every task with a message `feat(diktator): …` and the trailer `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` in the commit body.
- Run `npm test` and `npx tsc --noEmit` before each commit; both must be clean.

## File map

| File | Task | Responsibility |
|---|---|---|
| `src/shared/input/actions.ts`, `src/shared/input/manager.ts` | 1 | gamepad Back button (`back`) |
| `src/games/diktator/ui/flick.ts` | 1 | one step per flick of a stick / arrow |
| `src/shared/i18n/cs.ts` | 2 | `cs.diktator.moods`, `heroes`, `palace` strings |
| `src/games/diktator/ui/event-text.ts` | 2 | event → Czech line, ending and plot texts (shared by text and palace mode) |
| `src/games/diktator/ui/menus.ts` | 3 | a hero's menu: items with labels, money, commands |
| `src/games/diktator/ui/notes.ts`, `ui/hud.ts` | 4 | what each half learns from events; HUD lines |
| `src/games/diktator/ui/screens.ts` | 5 | shared full screens: evening/quarter cards, revolution, ally, punish, ending |
| `src/games/diktator/ui/controls.ts` | 6 | menu navigation, arrows → move/bump, seats and solo switch |
| `src/games/diktator/ui/palace-view.ts`, `render/rooms/scene.ts`, `render/rooms/stage.ts` | 7 | petitioner, revealed plot marker, heroes apart from the room, slide and bump |
| `src/games/diktator/text.html`, `text.ts` (moved), `index.html`, `palace.css`, `ui/dom.ts`, `vite.config.ts` | 8 | page shell and DOM rendering |
| `src/games/diktator/main.ts` | 9 | the game loop: join, input, play, cards, pause, save |

---

### Task 1: Gamepad Back button and flick edges

**Files:**
- Modify: `src/shared/input/actions.ts`
- Modify: `src/shared/input/manager.ts:5` (the `Edge` type)
- Modify: `tests/shared/input.test.ts`
- Create: `src/games/diktator/ui/flick.ts`
- Test: `tests/diktator/flick.test.ts`

Keyboards get no `back` binding on purpose: Tab would steal focus navigation from the Spy vs Spy menu. Diktátor reads the Tab key itself (Task 9).

- [ ] **Step 1: Update the input tests (they now expect `back`)**

In `tests/shared/input.test.ts` replace the four whole-object expectations and add a Back test. The file becomes:

```ts
import { describe, expect, it } from 'vitest';
import { KEYBOARD_LEFT, KEYBOARD_RIGHT, gamepadActions, keyboardActions } from '../../src/shared/input/actions';

const pad = (axes: number[], pressed: number[] = []) => ({
  axes,
  buttons: Array.from({ length: 17 }, (_, i) => ({ pressed: pressed.includes(i) })),
});

describe('keyboardActions', () => {
  it('maps WASD + F + G for the left player', () => {
    const a = keyboardActions(new Set(['KeyA', 'KeyS', 'KeyF']), KEYBOARD_LEFT);
    expect(a).toEqual({ moveX: -1, moveY: 1, action: true, trap: false, pause: false, back: false });
  });

  it('maps arrows + Enter + right Shift for the right player', () => {
    const a = keyboardActions(new Set(['ArrowRight', 'ArrowUp', 'ControlRight', 'Escape']), KEYBOARD_RIGHT);
    expect(a).toEqual({ moveX: 1, moveY: -1, action: false, trap: true, pause: true, back: false });
  });

  it('cancels opposite directions', () => {
    const a = keyboardActions(new Set(['KeyA', 'KeyD']), KEYBOARD_LEFT);
    expect(a.moveX).toBe(0);
  });

  it('ignores the other player keys', () => {
    const a = keyboardActions(new Set(['ArrowLeft', 'Enter']), KEYBOARD_LEFT);
    expect(a).toEqual({ moveX: 0, moveY: 0, action: false, trap: false, pause: false, back: false });
  });

  it('never reports back for a keyboard (games read their own key, e.g. Tab)', () => {
    expect(keyboardActions(new Set(['Tab']), KEYBOARD_LEFT).back).toBe(false);
  });
});
```

Keep the existing `describe('gamepadActions', …)` block, change its whole-object expectation to include `back: false`:

```ts
    expect(a).toEqual({ moveX: 1, moveY: -1, action: true, trap: true, pause: true, back: false });
```

and add inside that block:

```ts
  it('reads Back/Select (button 8)', () => {
    expect(gamepadActions(pad([0, 0], [8])).back).toBe(true);
    expect(gamepadActions(pad([0, 0])).back).toBe(false);
  });
```

If other tests in that file compare whole `PlayerActions` objects, add `back: false` to them the same way.

- [ ] **Step 2: Run the input tests to see them fail**

Run: `npx vitest run tests/shared/input.test.ts`
Expected: FAIL — objects lack `back`.

- [ ] **Step 3: Add `back` to the actions**

In `src/shared/input/actions.ts`:

```ts
/** Device-independent controls of one player for one frame (held states). */
export interface PlayerActions {
  moveX: -1 | 0 | 1;
  moveY: -1 | 0 | 1;
  action: boolean;
  trap: boolean;
  pause: boolean;
  /** Gamepad Back/Select (button 8). Keyboards have no binding: a game that needs it reads its own key (Diktátor: Tab). */
  back: boolean;
}

export const IDLE: Readonly<PlayerActions> = { moveX: 0, moveY: 0, action: false, trap: false, pause: false, back: false };
```

In `keyboardActions` add `back: false,` after `pause: any(b.pause),`. In `gamepadActions` update the doc comment to `/** Standard mapping: 0 = A, 2 = X, 8 = Back, 9 = Start, 12-15 = D-pad up/down/left/right. */` and add `back: btn(8),` after `pause: btn(9),`.

In `src/shared/input/manager.ts` change line 5 to:

```ts
type Edge = 'action' | 'trap' | 'pause' | 'back';
```

- [ ] **Step 4: Run the input tests**

Run: `npx vitest run tests/shared/input.test.ts`
Expected: PASS.

- [ ] **Step 5: Write the flick test**

Create `tests/diktator/flick.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { Flick } from '../../src/games/diktator/ui/flick';

const at = (moveX: -1 | 0 | 1, moveY: -1 | 0 | 1) => ({ moveX, moveY });

describe('Flick', () => {
  it('fires once when a direction is pressed, not while it is held', () => {
    const f = new Flick();
    expect(f.next(at(1, 0))).toBe('right');
    expect(f.next(at(1, 0))).toBeNull();
    expect(f.next(at(1, 0))).toBeNull();
  });

  it('fires again after the stick returns to the centre', () => {
    const f = new Flick();
    f.next(at(0, -1));
    expect(f.next(at(0, 0))).toBeNull();
    expect(f.next(at(0, -1))).toBe('up');
  });

  it('fires when the stick flips straight to the other side', () => {
    const f = new Flick();
    f.next(at(-1, 0));
    expect(f.next(at(1, 0))).toBe('right');
  });

  it('prefers the horizontal direction when both axes fire together', () => {
    const f = new Flick();
    expect(f.next(at(-1, 1))).toBe('left');
    expect(f.next(at(-1, 1))).toBeNull();
  });

  it('maps every direction', () => {
    expect(new Flick().next(at(-1, 0))).toBe('left');
    expect(new Flick().next(at(1, 0))).toBe('right');
    expect(new Flick().next(at(0, -1))).toBe('up');
    expect(new Flick().next(at(0, 1))).toBe('down');
  });

  it('hold() swallows a direction already held when a screen opens', () => {
    const f = new Flick();
    f.hold(at(0, 1));
    expect(f.next(at(0, 1))).toBeNull();
  });
});
```

- [ ] **Step 6: Run it to see it fail**

Run: `npx vitest run tests/diktator/flick.test.ts`
Expected: FAIL — cannot find module `ui/flick`.

- [ ] **Step 7: Implement `Flick`**

Create `src/games/diktator/ui/flick.ts`:

```ts
// Held stick / D-pad / arrow states → one step per flick (spec §12: "one flick = one room"). Pure.

import type { Direction } from '../logic/palace';

export interface Axes {
  readonly moveX: number;
  readonly moveY: number;
}

export class Flick {
  private x = 0;
  private y = 0;

  /** The direction that was just pressed, or null. Holding fires nothing more; horizontal wins a tie. */
  next(a: Axes): Direction | null {
    const fx = a.moveX !== 0 && a.moveX !== this.x;
    const fy = a.moveY !== 0 && a.moveY !== this.y;
    this.x = a.moveX;
    this.y = a.moveY;
    if (fx) return a.moveX < 0 ? 'left' : 'right';
    if (fy) return a.moveY < 0 ? 'up' : 'down';
    return null;
  }

  /** Treats the current axes as already held, so a direction held while a screen opened does not fire into it. */
  hold(a: Axes): void {
    this.x = a.moveX;
    this.y = a.moveY;
  }
}
```

- [ ] **Step 8: Run the tests, type check, commit**

Run: `npx vitest run tests/diktator/flick.test.ts tests/shared/input.test.ts` → PASS.
Run: `npm test` → all green. Run: `npx tsc --noEmit` → clean (if a spy file builds a `PlayerActions` literal, add `back: false` there).

```bash
git add src/shared/input tests/shared/input.test.ts src/games/diktator/ui/flick.ts tests/diktator/flick.test.ts
git commit -m "feat(diktator): gamepad Back button and one-step flicks"
```

---

### Task 2: Czech palace strings, moods and shared event texts

**Files:**
- Modify: `src/shared/i18n/cs.ts` (the `diktator` block)
- Modify: `src/games/diktator/render/puppet/poses.ts` (remove `MOOD_NAMES`)
- Modify: `src/games/diktator/dev/rooms.ts` (use `cs.diktator.moods`)
- Create: `src/games/diktator/ui/event-text.ts`
- Modify: `src/games/diktator/main.ts` (use `event-text.ts` instead of its own `describe`/`endingText`/plot text)
- Test: `tests/diktator/event-text.test.ts`

- [ ] **Step 1: Add the strings**

In `src/shared/i18n/cs.ts`, inside `diktator: { … }`, directly after `back: '← Zpět na hry',` add:

```ts
    /** The ten mood levels 0–9 (spec §5.2), lowest first. */
    moods: ['vzbouření', 'zuřiví', 'rozzlobení', 'reptají', 'nejistí', 'vlažní', 'klidní', 'spokojení', 'oddaní', 'nadšení'] as readonly string[],
    heroes: { zogu: 'Zogu', velitel: 'Kovář' },
    /** The palace game (plan 2c). */
    palace: {
      audienceTitle: (group: string) => `Audience: ${group}`,
      money: (text: string) => `Peníze: ${text}`,
      adviceAudience: 'Poslat pro radu k matce (1 h)',
      adviceDecision: (title: string) => `Rada matky: ${title} (1 h)`,
      talk: (group: string) => `Promluvit si: ${group} (1 h)`,
      envoys: 'Přijmout vyslance (1 h)',
      investigate: (group: string) => `Prověřit: ${group} (1 h)`,
      policeReport: 'Hlášení tajné policie (1 h, 1 tis.)',
      guard: 'Hlídat krále (zbytek dne)',
      takeSeal: 'Vzít královskou pečeť',
      giveSeal: (to: string) => `Předat pečeť: ${to}`,
      seal: (title: string) => `Zapečetit: ${title}`,
      waiting: (other: string) => `Čtvrtletí ukončeno. Čeká se na: ${other}.`,
      noActions: 'Tady se nedá nic dělat.',
      hintClosed: 'Akce: nabídka · pohyb: jiná místnost · G / pravý Ctrl / X: pečeť',
      hintOpen: 'Nahoru a dolů vybrat · Akce potvrdit · Esc zavřít',
      soloHint: 'Tab / Back: přepnout postavu',
      sealHolder: (who: string) => `Pečeť nese ${who}.`,
      sealLies: 'Pečeť leží v pracovně.',
      wish: (group: string, title: string) => `${group}: „Přejeme si: ${title}.“`,
      wishNone: (group: string) => `${group}: „Nic si nepřejeme.“`,
      adviceYes: (text: string) => `Matka o „ano“: ${text}`,
      adviceNo: (text: string) => `Matka o „ne“: ${text}`,
      adviceOn: (title: string, text: string) => `Matka o „${title}“: ${text}`,
      offer: (who: string, n: number) => `${who}: půjčka až ${n} tis.`,
      offerHostile: (who: string) => `${who}: nic, nemají vás rádi.`,
      offerUsed: (who: string) => `${who}: už jednou půjčili.`,
      noPlot: (group: string) => `${group}: žádné spiknutí.`,
      plot: (group: string, text: string) => `${group} — ${text}!`,
      reportRead: 'Hlášení tajné policie:',
      reportLimits: (low: number, threshold: number) => `Nepřátelé: nálada ${low} a níž. Revoluce: společná síla ${threshold} a víc.`,
      guarding: 'Kovář dnes v noci hlídá krále.',
      heroDone: (who: string) => `${who} končí čtvrtletí.`,
      evening: (date: string) => `Večer — ${date}`,
      quietNight: 'Noc proběhla klidně.',
      toPalace: 'Do paláce',
      next: 'Dál',
      revolutionTitle: 'REVOLUCE!',
      rebels: (group: string) => `Bouří se: ${group}.`,
      planeReady: 'Na nádvoří čeká letadlo.',
      victory: 'Vzpoura potlačena!',
      allyMood: (group: string, mood: string) => `${group} — ${mood}`,
      unknownMood: '?',
      ending: 'Konec vlády',
      toMenu: 'Do menu',
      hours: 'hodiny',
      sealMark: 'pečeť',
      join: {
        title: 'Diktátor',
        slot: (hero: string, device: string) => `${hero}: ${device}`,
        waiting: 'stiskni Akci…',
        hint: 'Každý hráč stiskne Akci (F, Enter nebo A). První hraje Zogua, druhý Kováře. Hraješ-li sám, ovládáš oba — Tab / Back přepíná.',
        newGame: 'Nová hra',
        continueGame: 'Pokračovat',
        textMode: 'Textová verze',
      },
      pause: { title: 'Pauza', padLost: 'Ovladač se odpojil', resume: 'Pokračovat', menu: 'Uložit a do menu' },
    },
```

- [ ] **Step 2: Move the mood names to `cs`**

In `src/games/diktator/render/puppet/poses.ts` delete the line `export const MOOD_NAMES = [...] as const;` (and its doc comment, if any). In `src/games/diktator/dev/rooms.ts` remove `import { MOOD_NAMES } from '../render/puppet/poses';`, add `import { cs } from '../../../shared/i18n/cs';`, and replace both uses of `MOOD_NAMES[…]` with `cs.diktator.moods[…]`. Run `npx tsc --noEmit`; nothing else should reference `MOOD_NAMES` (check with Grep for `MOOD_NAMES` in `src` and `tests`).

- [ ] **Step 3: Write the event-text test**

Create `tests/diktator/event-text.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { cs } from '../../src/shared/i18n/cs';
import { albania } from '../../src/games/diktator/scenario/albania';
import { endingText, eventText, plotText } from '../../src/games/diktator/ui/event-text';

const T = cs.diktator;

describe('eventText', () => {
  it('describes money and aid events in Czech', () => {
    expect(eventText(albania, { type: 'budget', income: 60, costs: 70 })).toBe(T.events.budget(60, 70));
    expect(eventText(albania, { type: 'aidGranted', lender: 'italie', amount: 180 })).toBe(T.events.aidGranted('Itálie', 180));
    expect(eventText(albania, { type: 'aidRefused', lender: 'britanie', reason: 'unpopular' })).toBe(T.events.aidUnpopular('Británie'));
  });

  it('names a decision and a news item by their titles', () => {
    const d = albania.decisions[0];
    expect(eventText(albania, { type: 'decided', id: d.id })).toBe(`✓ ${d.title}`);
    const n = albania.news[0];
    expect(eventText(albania, { type: 'news', id: n.id })).toBe(`📰 ${n.title}`);
  });

  it('has no line for palace bookkeeping events', () => {
    expect(eventText(albania, { type: 'moved', hero: 'zogu', from: 'trunni', to: 'pracovna' })).toBeNull();
    expect(eventText(albania, { type: 'heroDone', hero: 'velitel' })).toBeNull();
    expect(eventText(albania, { type: 'quarterStarted', quarter: 2 })).toBeNull();
  });
});

describe('endingText', () => {
  it('covers every ending', () => {
    expect(endingText({ kind: 'survived' })).toBe(T.endings.survived);
    expect(endingText({ kind: 'escaped', via: 'plane' })).toBe(T.endings.plane);
    expect(endingText({ kind: 'escaped', via: 'mountains' })).toBe(T.endings.escapedMountains);
    expect(endingText({ kind: 'killed', cause: 'war' })).toBe(T.endings.war);
  });
});

describe('plotText', () => {
  it('names the plot and the ally', () => {
    expect(plotText(albania, { kind: 'none' })).toBe('');
    expect(plotText(albania, { kind: 'assassination' })).toBe(T.plots.assassination);
    expect(plotText(albania, { kind: 'revolution', ally: 'policie' })).toBe(T.plots.revolution('Tajná policie'));
  });
});
```

- [ ] **Step 4: Run it to see it fail**

Run: `npx vitest run tests/diktator/event-text.test.ts`
Expected: FAIL — cannot find module `ui/event-text`.

- [ ] **Step 5: Implement `event-text.ts`**

Create `src/games/diktator/ui/event-text.ts` (the body of `eventText` is the text mode's `describe`, moved):

```ts
// Czech lines for game events, endings and plots — shared by the text mode and the palace (plan 2c). Pure.

import { cs } from '../../../shared/i18n/cs';
import { decisionById } from '../logic/decision';
import type { Scenario } from '../logic/scenario';
import type { Ending, GameEvent, Plot } from '../logic/state';

const T = cs.diktator;

/** One line for the log, or null for events that have no line of their own. */
export function eventText(sc: Scenario, e: GameEvent): string | null {
  const E = T.events;
  const name = (g: keyof Scenario['groupNames']) => sc.groupNames[g];
  switch (e.type) {
    case 'bankrupt': return E.bankrupt;
    case 'budget': return E.budget(e.income, e.costs);
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
    case 'tariffPenalty': return E.tariffPenalty(e.amount, e.tariffs);
    default: return null;
  }
}

export function endingText(ending: Ending): string {
  if (ending.kind === 'survived') return T.endings.survived;
  if (ending.kind === 'escaped') return ending.via === 'plane' ? T.endings.plane : T.endings.escapedMountains;
  return T.endings[ending.cause];
}

/** '' for no plot; otherwise the plot and, for a revolution, the ally. */
export function plotText(sc: Scenario, plot: Plot): string {
  if (plot.kind === 'none') return '';
  if (plot.kind === 'assassination') return T.plots.assassination;
  return T.plots.revolution(sc.groupNames[plot.ally]);
}
```

If `Scenario['groupNames']` is not keyed by `GroupId` in `logic/scenario.ts`, type the helper as `(g: GroupId) => sc.groupNames[g]` with `import type { GroupId } from '../logic/groups';`.

- [ ] **Step 6: Use it in the text mode**

In `src/games/diktator/main.ts`:
- delete the local `describe` and `endingText` functions and the `name` helper if nothing else uses it (`renderReport` and `commandLabel` still do — keep `name` then);
- add `import { endingText, eventText, plotText } from './ui/event-text';`;
- replace `describe(e)` / `.map(describe)` with `eventText(sc, e)` / `.map((e) => eventText(sc, e))`;
- replace `${endingText(s)}` with `${s.phase.kind === 'ended' ? endingText(s.phase.ending) : ''}` (inside the `if (s.phase.kind === 'ended')` branch simply `endingText(s.phase.ending)`);
- in `renderReport` replace the `plotText` expression with `const plotText = plot ? plotText(sc, plot) : '';` renamed to avoid shadowing: `const plotLine = plot ? plotText(sc, plot) : '';` and use `plotLine` in the row HTML.
- remove imports that become unused (`decisionById` stays — `commandLabel` uses it).

- [ ] **Step 7: Run everything, commit**

Run: `npx vitest run tests/diktator/event-text.test.ts` → PASS. `npm test` → green. `npx tsc --noEmit` → clean.

```bash
git add src/shared/i18n/cs.ts src/games/diktator tests/diktator/event-text.test.ts
git commit -m "feat(diktator): palace strings, mood names in cs, shared event texts"
```

---

### Task 3: Hero menus

**Files:**
- Create: `src/games/diktator/ui/menus.ts`
- Test: `tests/diktator/menus.test.ts`

The menu is built from the rules' own list (`palaceCommands`; plus the audience answers for Zogu). Moves are not menu items — the arrows do them. Every item whose choice moves money shows it.

- [ ] **Step 1: Write the test**

Create `tests/diktator/menus.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { cs } from '../../src/shared/i18n/cs';
import { advance, newGame } from '../../src/games/diktator/logic/turn';
import type { Direction, Hero } from '../../src/games/diktator/logic/palace';
import type { GameState } from '../../src/games/diktator/logic/state';
import { petitionById } from '../../src/games/diktator/logic/audience';
import { albania } from '../../src/games/diktator/scenario/albania';
import { heroMenu } from '../../src/games/diktator/ui/menus';

const T = cs.diktator;
const P = T.palace;

function audience(): GameState {
  return newGame(albania, 4, undefined, { palace: true }).state;
}
function day(): GameState {
  return advance(albania, audience(), { type: 'answer', answer: 'no' }).state;
}
function walk(s: GameState, hero: Hero, dirs: readonly Direction[]): GameState {
  for (const dir of dirs) s = advance(albania, s, { type: 'move', hero, dir }).state;
  return s;
}

describe('heroMenu — audience', () => {
  it('keeps Zogu in a modal audience with the answers first, money on "Ano", advice last', () => {
    const s = audience();
    const m = heroMenu(albania, s, 'zogu');
    const pet = petitionById(albania, (s.phase as { petition: string }).petition);
    expect(m.modal).toBe(true);
    expect(m.title).toBe(P.audienceTitle(albania.groupNames[pet.from]));
    expect(m.body[0]).toContain(pet.title);
    expect(m.items.slice(0, 3).map((i) => i.label)).toEqual([T.yes, T.no, T.goAway]);
    expect(m.items[0].detail.startsWith('Peníze: ')).toBe(true);
    expect(m.items[m.items.length - 1].label).toBe(P.adviceAudience);
  });

  it('lets the commander act freely during the audience', () => {
    const m = heroMenu(albania, audience(), 'velitel');
    expect(m.modal).toBe(false);
    expect(m.title).toBe('Strážnice');
    const labels = m.items.map((i) => i.label);
    expect(labels).toContain(P.policeReport);
    expect(labels).toContain(T.endDay);
    expect(m.items.some((i) => i.command.type === 'move')).toBe(false);
  });

  it('tells a hero who has ended his day that he waits for the other', () => {
    const s = advance(albania, audience(), { type: 'endDay', hero: 'velitel' }).state;
    const m = heroMenu(albania, s, 'velitel');
    expect(m.items).toEqual([]);
    expect(m.body).toEqual([P.waiting('Zogu')]);
  });
});

describe('heroMenu — day', () => {
  it('offers only the end of the quarter in the empty throne room', () => {
    expect(heroMenu(albania, day(), 'zogu').items.map((i) => i.label)).toEqual([T.endDay]);
  });

  it('offers talk in a faction room', () => {
    const s = walk(day(), 'zogu', ['down', 'left', 'left']);
    expect(s.palace!.at.zogu).toBe('armada');
    expect(heroMenu(albania, s, 'zogu').items[0].label).toBe(P.talk(albania.groupNames.armada));
  });

  it('offers the seal in the study, then the study decisions with their money', () => {
    let s = walk(day(), 'zogu', ['left']);
    expect(heroMenu(albania, s, 'zogu').items.map((i) => i.label)).toContain(P.takeSeal);
    s = advance(albania, s, { type: 'takeSeal', hero: 'zogu' }).state;
    const seals = heroMenu(albania, s, 'zogu').items.filter((i) => i.command.type === 'decide');
    expect(seals.length).toBeGreaterThan(0);
    for (const item of seals) {
      expect(item.label.startsWith('Zapečetit: ')).toBe(true);
      expect(item.detail.startsWith('Peníze: ')).toBe(true);
    }
  });

  it('splits the Swiss account into its four shares in the treasury', () => {
    let s = walk(day(), 'zogu', ['left']);
    s = advance(albania, s, { type: 'takeSeal', hero: 'zogu' }).state;
    s = walk(s, 'zogu', ['down', 'right', 'right', 'down']);
    expect(s.palace!.at.zogu).toBe('pokladna');
    const swiss = heroMenu(albania, s, 'zogu').items.filter((i) => i.command.type === 'decide' && i.command.decision === 'd37');
    expect(swiss.map((i) => (i.command.type === 'decide' ? i.command.share : 0))).toEqual([1, 2, 3, 4]);
  });

  it('names the other hero when the seal can be handed over', () => {
    let s = walk(day(), 'zogu', ['left']);
    s = advance(albania, s, { type: 'takeSeal', hero: 'zogu' }).state;
    s = walk(s, 'zogu', ['down', 'right']); // vyslanci
    s = walk(s, 'velitel', ['up']); // straznice → vyslanci
    expect(s.palace!.at.velitel).toBe('vyslanci');
    expect(heroMenu(albania, s, 'zogu').items.map((i) => i.label)).toContain(P.giveSeal('Kovář'));
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run tests/diktator/menus.test.ts`
Expected: FAIL — cannot find module `ui/menus`.

- [ ] **Step 3: Implement `menus.ts`**

Create `src/games/diktator/ui/menus.ts`:

```ts
// The menu a hero opens in his half of the palace (spec §5.3). Built from the rules' own list of valid commands
// (`palaceCommands`, plus the audience answers for Zogu), with Czech labels and every money effect shown.
// Moves are not items: the arrows do them. Pure — reads the state, never changes it.

import { cs } from '../../../shared/i18n/cs';
import { petitionById } from '../logic/audience';
import { decisionById } from '../logic/decision';
import { FACTIONS } from '../logic/groups';
import { groupsInRoom, other, type Hero } from '../logic/palace';
import { palaceCommands } from '../logic/palace-actions';
import type { Scenario } from '../logic/scenario';
import type { Command, GameState } from '../logic/state';
import { validCommands } from '../logic/turn';
import { moneyText } from './effects-text';

const T = cs.diktator;
const P = T.palace;

/** 1928-Q3: Zogu is crowned; from then on he is addressed as Veličenstvo. */
export const CORONATION_QUARTER = 15;

export interface MenuItem {
  readonly label: string;
  /** Second line: the money a choice moves, '' when none. */
  readonly detail: string;
  readonly command: Command;
}

export interface HeroMenu {
  readonly title: string;
  /** Lines above the items: the petition during the audience, or why there is nothing to do. */
  readonly body: readonly string[];
  readonly items: readonly MenuItem[];
  /** The audience: Zogu's menu stays open until he answers. */
  readonly modal: boolean;
}

function item(label: string, command: Command, detail = ''): MenuItem {
  return { label, detail, command };
}

function itemsFor(sc: Scenario, s: GameState, cmd: Command): MenuItem[] {
  const L = sc.palace!;
  const p = s.palace!;
  switch (cmd.type) {
    case 'answer': {
      if (s.phase.kind !== 'audience') return [];
      const pet = petitionById(sc, s.phase.petition);
      const detail = cmd.answer === 'yes' ? P.money(moneyText(pet.effects, { tariff: pet.tariff })) : '';
      return [item(T[cmd.answer], cmd, detail)];
    }
    case 'advice':
      return [item(cmd.decision === undefined ? P.adviceAudience : P.adviceDecision(decisionById(sc, cmd.decision).title), cmd)];
    case 'talk':
      return [item(P.talk(sc.groupNames[groupsInRoom(L, p.at.zogu)[0]]), cmd)];
    case 'envoys':
      return [item(P.envoys, cmd)];
    case 'investigate': {
      const faction = groupsInRoom(L, p.at.velitel).find((g) => (FACTIONS as readonly string[]).includes(g));
      return faction ? [item(P.investigate(sc.groupNames[faction]), cmd)] : [];
    }
    case 'policeReport':
      return [item(P.policeReport, cmd)];
    case 'guard':
      return [item(P.guard, cmd)];
    case 'takeSeal':
      return [item(P.takeSeal, cmd)];
    case 'giveSeal':
      return [item(P.giveSeal(T.heroes[other(cmd.hero)]), cmd)];
    case 'decide': {
      const d = decisionById(sc, cmd.decision);
      if (d.special?.kind === 'swiss') {
        return ([1, 2, 3, 4] as const).map((share) => item(P.seal(`${d.title} (${T.swissShare(share)})`), { ...cmd, share }));
      }
      return [item(P.seal(d.title), cmd, d.special?.kind === 'aid' ? '' : P.money(moneyText(d.effects)))];
    }
    case 'endDay':
      return [item(T.endDay, cmd)];
    default:
      return [];
  }
}

export function heroMenu(sc: Scenario, s: GameState, hero: Hero): HeroMenu {
  const p = s.palace;
  const L = sc.palace;
  if (!p || !L) throw new Error('heroMenu needs palace mode');
  if (s.phase.kind === 'audience' && hero === 'zogu') {
    const answers = validCommands(sc, s).filter((c) => c.type === 'answer');
    const items = [...answers, ...palaceCommands(sc, s, hero)].flatMap((c) => itemsFor(sc, s, c));
    const pet = petitionById(sc, s.phase.petition);
    return {
      title: P.audienceTitle(sc.groupNames[pet.from]),
      body: [`${T.audienceAsk(T.address(s.quarter >= CORONATION_QUARTER))} ${pet.title}?`],
      items,
      modal: true,
    };
  }
  const items = palaceCommands(sc, s, hero).flatMap((c) => itemsFor(sc, s, c));
  const body = p.done[hero] ? [P.waiting(T.heroes[other(hero)])] : items.length === 0 ? [P.noActions] : [];
  return { title: L.names[p.at[hero]], body, items, modal: false };
}
```

- [ ] **Step 4: Run the test**

Run: `npx vitest run tests/diktator/menus.test.ts`
Expected: PASS. If the Swiss test fails because `d37` is not available at the start (check `availableDecisions`), report it as DONE_WITH_CONCERNS with the reason — do not change the test to hide it.

- [ ] **Step 5: Type check and commit**

Run: `npm test` → green; `npx tsc --noEmit` → clean.

```bash
git add src/games/diktator/ui/menus.ts tests/diktator/menus.test.ts
git commit -m "feat(diktator): hero menus for the palace halves"
```

---

### Task 4: Notes per half and the HUD

**Files:**
- Create: `src/games/diktator/ui/notes.ts`
- Create: `src/games/diktator/ui/hud.ts`
- Test: `tests/diktator/notes.test.ts`

A note is what one half learns from an event: Zogu hears the wishes, Mother's advice and the envoys' offers; Kovář reads the investigations and the police report; both see the seal, the guard and who has finished.

- [ ] **Step 1: Write the test**

Create `tests/diktator/notes.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { cs } from '../../src/shared/i18n/cs';
import { advance, newGame } from '../../src/games/diktator/logic/turn';
import type { GameState, PoliceSnapshot } from '../../src/games/diktator/logic/state';
import { albania } from '../../src/games/diktator/scenario/albania';
import { notesFor } from '../../src/games/diktator/ui/notes';
import { heroHud, topHud } from '../../src/games/diktator/ui/hud';

const T = cs.diktator;
const P = T.palace;

function audience(): GameState {
  return newGame(albania, 4, undefined, { palace: true }).state;
}
function day(): GameState {
  return advance(albania, audience(), { type: 'answer', answer: 'no' }).state;
}

describe('notesFor', () => {
  it('tells both halves who carries the seal', () => {
    const s = day();
    expect(notesFor(albania, s, { type: 'seal', holder: 'velitel' })).toEqual([{ to: 'both', text: P.sealHolder('Kovář') }]);
    expect(notesFor(albania, s, { type: 'seal', holder: null })).toEqual([{ to: 'both', text: P.sealLies }]);
  });

  it('gives Zogu the envoys’ offers, one line per lender', () => {
    const notes = notesFor(albania, day(), { type: 'envoys', offers: { italie: 180, britanie: 0 } });
    expect(notes.every((n) => n.to === 'zogu')).toBe(true);
    expect(notes.map((n) => n.text)).toEqual([P.offer('Itálie', 180), P.offerHostile('Británie')]);
    const used = notesFor(albania, day(), { type: 'envoys', offers: { italie: null, britanie: 90 } });
    expect(used[0].text).toBe(P.offerUsed('Itálie'));
  });

  it('gives Zogu a group’s wish by the decision’s title', () => {
    const d = albania.decisions[0];
    expect(notesFor(albania, day(), { type: 'wish', group: 'armada', decision: d.id })).toEqual([
      { to: 'zogu', text: P.wish('Armáda', d.title) },
    ]);
    expect(notesFor(albania, day(), { type: 'wish', group: 'rolnici', decision: null })[0].text).toBe(P.wishNone('Rolníci'));
  });

  it('gives Zogu Mother’s advice on both answers of the petition', () => {
    const s = audience();
    const id = (s.phase as { petition: string }).petition;
    const notes = notesFor(albania, s, { type: 'advised', subject: 'petition', id });
    expect(notes.map((n) => n.to)).toEqual(['zogu', 'zogu']);
    expect(notes[0].text.startsWith('Matka o „ano“: ')).toBe(true);
    expect(notes[1].text.startsWith('Matka o „ne“: ')).toBe(true);
  });

  it('gives Kovář the investigation and the whole police report', () => {
    const s = day();
    expect(notesFor(albania, s, { type: 'investigated', faction: 'armada', plot: { kind: 'none' } })).toEqual([
      { to: 'velitel', text: P.noPlot('Armáda') },
    ]);
    const report: PoliceSnapshot = {
      pop: s.pop, str: s.str, guard: s.guard, low: 3, threshold: 11,
      plots: { armada: { kind: 'assassination' }, rolnici: { kind: 'none' }, statkari: { kind: 'revolution', ally: 'policie' } },
    };
    const notes = notesFor(albania, s, { type: 'policeReport', report });
    expect(notes.every((n) => n.to === 'velitel')).toBe(true);
    expect(notes.map((n) => n.text)).toEqual([
      P.reportRead,
      P.plot('Armáda', T.plots.assassination),
      P.noPlot('Rolníci'),
      P.plot('Statkáři', T.plots.revolution('Tajná policie')),
      P.reportLimits(3, 11),
    ]);
  });

  it('tells both halves about the guard and who finished; routes other lines to both', () => {
    const s = day();
    expect(notesFor(albania, s, { type: 'guarding' })).toEqual([{ to: 'both', text: P.guarding }]);
    expect(notesFor(albania, s, { type: 'heroDone', hero: 'zogu' })).toEqual([{ to: 'both', text: P.heroDone('Zogu') }]);
    expect(notesFor(albania, s, { type: 'budget', income: 60, costs: 60 })).toEqual([{ to: 'both', text: T.events.budget(60, 60) }]);
    expect(notesFor(albania, s, { type: 'moved', hero: 'zogu', from: 'trunni', to: 'pracovna' })).toEqual([]);
  });
});

describe('HUD', () => {
  it('shows the hero, his room, his hours as dots and the seal', () => {
    const s = day();
    expect(heroHud(albania, s, 'velitel')).toEqual({ name: 'Kovář', room: 'Strážnice', hours: '●●●', seal: false, done: false });
    const spent = advance(albania, s, { type: 'policeReport', hero: 'velitel' }).state;
    expect(heroHud(albania, spent, 'velitel').hours).toBe('●●○');
  });

  it('shows the date and the money on top', () => {
    const s = day();
    expect(topHud(s)).toEqual([T.quarter(1925, 1), T.treasury(s.treasury), T.balance(s.income - s.costs), T.guard(s.guard)]);
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run tests/diktator/notes.test.ts`
Expected: FAIL — cannot find modules.

- [ ] **Step 3: Implement `notes.ts`**

Create `src/games/diktator/ui/notes.ts`:

```ts
// What each half of the split screen learns from an event (spec §5.3: dialogs belong to their own half). Pure.

import { cs } from '../../../shared/i18n/cs';
import { petitionById } from '../logic/audience';
import { decisionById } from '../logic/decision';
import { forecast } from '../logic/forecast';
import { FACTIONS, LENDERS, type GroupId } from '../logic/groups';
import type { Hero } from '../logic/palace';
import type { Scenario } from '../logic/scenario';
import type { GameEvent, GameState, Plot } from '../logic/state';
import { motherAdvice } from './effects-text';
import { eventText, plotText } from './event-text';

const T = cs.diktator;
const P = T.palace;

export interface Note {
  readonly to: Hero | 'both';
  readonly text: string;
}

function plotNote(sc: Scenario, g: GroupId, plot: Plot): string {
  return plot.kind === 'none' ? P.noPlot(sc.groupNames[g]) : P.plot(sc.groupNames[g], plotText(sc, plot));
}

/** `s` is the state after the command that produced `e`. */
export function notesFor(sc: Scenario, s: GameState, e: GameEvent): Note[] {
  const name = (g: GroupId) => sc.groupNames[g];
  switch (e.type) {
    case 'moved':
    case 'petition':
    case 'quarterStarted':
    case 'answered':
      return [];
    case 'seal':
      return [{ to: 'both', text: e.holder ? P.sealHolder(T.heroes[e.holder]) : P.sealLies }];
    case 'wish':
      return [{ to: 'zogu', text: e.decision ? P.wish(name(e.group), decisionById(sc, e.decision).title) : P.wishNone(name(e.group)) }];
    case 'advised': {
      if (e.subject === 'decision') {
        const d = decisionById(sc, e.id);
        return [{ to: 'zogu', text: P.adviceOn(d.title, motherAdvice(forecast(s, d.effects), sc.groupNames)) }];
      }
      const pet = petitionById(sc, e.id);
      const self = pet.effects.pop?.[pet.from] ?? 0;
      return [
        { to: 'zogu', text: P.adviceYes(motherAdvice(forecast(s, pet.effects, { tariff: pet.tariff }), sc.groupNames)) },
        { to: 'zogu', text: P.adviceNo(motherAdvice(forecast(s, { pop: { [pet.from]: -self } }), sc.groupNames)) },
      ];
    }
    case 'envoys':
      return LENDERS.map((l) => {
        const offer = e.offers[l];
        const text = offer === null ? P.offerUsed(name(l)) : offer === 0 ? P.offerHostile(name(l)) : P.offer(name(l), offer);
        return { to: 'zogu' as const, text };
      });
    case 'investigated':
      return [{ to: 'velitel', text: plotNote(sc, e.faction, e.plot) }];
    case 'policeReport':
      return [
        P.reportRead,
        ...FACTIONS.map((f) => plotNote(sc, f, e.report.plots[f])),
        P.reportLimits(e.report.low, e.report.threshold),
      ].map((text) => ({ to: 'velitel' as const, text }));
    case 'guarding':
      return [{ to: 'both', text: P.guarding }];
    case 'heroDone':
      return [{ to: 'both', text: P.heroDone(T.heroes[e.hero]) }];
    default: {
      const text = eventText(sc, e);
      return text ? [{ to: 'both', text }] : [];
    }
  }
}
```

If `forecast`'s effects parameter rejects `{ pop: { [pet.from]: -self } }` (a computed key widens to `string`), write it as `{ pop: { [pet.from]: -self } as Partial<Record<GroupId, number>> }` — the text mode (`main.ts`) passes the same literal, so check how it compiles there first.

- [ ] **Step 4: Implement `hud.ts`**

Create `src/games/diktator/ui/hud.ts`:

```ts
// HUD lines: the top bar (date and money) and each half's hero line (room, hours, seal). Pure.

import { cs } from '../../../shared/i18n/cs';
import type { Hero } from '../logic/palace';
import { RULES } from '../logic/rules';
import type { Scenario } from '../logic/scenario';
import type { GameState } from '../logic/state';
import { quarterLabel } from '../logic/turn';

const T = cs.diktator;

export interface HeroHud {
  readonly name: string;
  readonly room: string;
  /** Remaining hours as filled dots, spent ones hollow: '●●○'. */
  readonly hours: string;
  readonly seal: boolean;
  readonly done: boolean;
}

export function heroHud(sc: Scenario, s: GameState, hero: Hero): HeroHud {
  const p = s.palace;
  if (!p || !sc.palace) throw new Error('heroHud needs palace mode');
  const total = RULES.palace.hours[hero];
  const left = Math.max(0, Math.min(total, p.hours[hero]));
  return {
    name: T.heroes[hero],
    room: sc.palace.names[p.at[hero]],
    hours: '●'.repeat(left) + '○'.repeat(total - left),
    seal: p.seal === hero,
    done: p.done[hero],
  };
}

export function topHud(s: GameState): string[] {
  const { year, q } = quarterLabel(Math.max(1, s.quarter));
  return [T.quarter(year, q), T.treasury(s.treasury), T.balance(s.income - s.costs), T.guard(s.guard)];
}
```

- [ ] **Step 5: Run the test, type check, commit**

Run: `npx vitest run tests/diktator/notes.test.ts` → PASS (if the police report in the HUD test is refused for seed 4 because the police are hostile, the hours still drop only when the report is read — report it as DONE_WITH_CONCERNS rather than changing the seed silently). `npm test` → green; `npx tsc --noEmit` → clean.

```bash
git add src/games/diktator/ui/notes.ts src/games/diktator/ui/hud.ts tests/diktator/notes.test.ts
git commit -m "feat(diktator): per-half notes and the HUD"
```

---

### Task 5: Shared full screens

**Files:**
- Create: `src/games/diktator/ui/screens.ts`
- Test: `tests/diktator/screens.test.ts`

Two kinds of shared screen (spec §5: together → apart → together): **cards** that follow one command (the evening, the revolution's outcome, the new quarter — the newspaper's placeholder), and **phase screens** that stay until the players choose (revolution, ally, punish, ending).

- [ ] **Step 1: Write the test**

Create `tests/diktator/screens.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { cs } from '../../src/shared/i18n/cs';
import { advance, newGame } from '../../src/games/diktator/logic/turn';
import type { GameState } from '../../src/games/diktator/logic/state';
import { albania } from '../../src/games/diktator/scenario/albania';
import { cardsFor, phaseScreen } from '../../src/games/diktator/ui/screens';

const T = cs.diktator;
const P = T.palace;

function day(): GameState {
  return advance(albania, newGame(albania, 4, undefined, { palace: true }).state, { type: 'answer', answer: 'no' }).state;
}

describe('cardsFor', () => {
  it('opens a new game with the first quarter’s card', () => {
    const { state, events } = newGame(albania, 4, undefined, { palace: true });
    const cards = cardsFor(albania, null, events, state);
    expect(cards).toHaveLength(1);
    expect(cards[0].title).toBe(T.quarter(1925, 1));
    expect(cards[0].lines).toContain(T.events.budget(60, 60));
    expect(cards[0].button).toBe(P.toPalace);
  });

  it('shows no card for a command inside the day', () => {
    const s = day();
    const r = advance(albania, s, { type: 'move', hero: 'zogu', dir: 'left' });
    expect(cardsFor(albania, s, r.events, r.state)).toEqual([]);
  });

  it('shows the evening, then the next quarter, once both heroes end the day', () => {
    let s = day();
    s = advance(albania, s, { type: 'endDay', hero: 'velitel' }).state;
    const r = advance(albania, s, { type: 'endDay', hero: 'zogu' });
    const cards = cardsFor(albania, s, r.events, r.state);
    expect(cards[0].title).toBe(P.evening(T.quarter(1925, 1)));
    expect(cards[0].lines.length).toBeGreaterThan(0);
    if (r.state.phase.kind === 'audience') {
      expect(cards).toHaveLength(2);
      expect(cards[1].title).toBe(T.quarter(1925, 2));
    }
  });
});

describe('phaseScreen', () => {
  it('shows nothing during the palace day', () => {
    expect(phaseScreen(albania, day(), null)).toBeNull();
  });

  it('offers flight and fight in a revolution, and mentions the plane', () => {
    const s = day();
    s.phase = { kind: 'revolution', faction: 'armada' };
    s.hasPlane = true;
    const scr = phaseScreen(albania, s, null)!;
    expect(scr.title).toBe(P.revolutionTitle);
    expect(scr.lines).toEqual([P.rebels('Armáda'), P.planeReady]);
    expect(scr.options.map((o) => o.label)).toEqual([T.flee, T.fight]);
    expect(scr.options[0].choice).toEqual({ kind: 'command', command: { type: 'flee' } });
  });

  it('lists all six strength groups as allies with their known mood or "?"', () => {
    const s = day();
    s.phase = { kind: 'chooseAlly', faction: 'armada' };
    s.palace!.seenPop.rolnici = 9;
    const scr = phaseScreen(albania, s, null)!;
    expect(scr.options).toHaveLength(6);
    expect(scr.options.find((o) => o.label.startsWith('Rolníci'))!.label).toBe(P.allyMood('Rolníci', 'nadšení'));
    const unseen = scr.options.find((o) => o.label.startsWith('Statkáři'))!;
    expect(unseen.label).toBe(P.allyMood('Statkáři', P.unknownMood));
    expect(unseen.choice).toEqual({ kind: 'command', command: { type: 'ally', group: 'statkari' } });
  });

  it('asks whether to punish after a won fight', () => {
    const s = day();
    s.phase = { kind: 'punish', faction: 'armada', chosen: 'policie' };
    const scr = phaseScreen(albania, s, null)!;
    expect(scr.title).toBe(P.victory);
    expect(scr.options.map((o) => o.label)).toEqual([T.punishYes, T.punishNo]);
  });

  it('ends with the text, the score and retry / new game / menu', () => {
    const s = day();
    s.phase = { kind: 'ended', ending: { kind: 'killed', cause: 'assassination' } };
    const scr = phaseScreen(albania, s, 1925)!;
    expect(scr.title).toBe(P.ending);
    expect(scr.lines[0]).toBe(T.endings.assassination);
    expect(scr.lines[1].startsWith('Skóre: ')).toBe(true);
    expect(scr.options.map((o) => o.choice.kind)).toEqual(['retry', 'newGame', 'menu']);
    expect(scr.options[0].label).toBe(T.retry(1925));
    expect(phaseScreen(albania, s, null)!.options.map((o) => o.choice.kind)).toEqual(['newGame', 'menu']);
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run tests/diktator/screens.test.ts`
Expected: FAIL — cannot find module `ui/screens`.

- [ ] **Step 3: Implement `screens.ts`**

Create `src/games/diktator/ui/screens.ts`:

```ts
// Shared full screens (spec §5, §9): cards that follow one command (evening, revolution outcome, the new quarter —
// the newspaper's placeholder until plan 3) and phase screens that wait for a choice (revolution, ally, punish,
// ending). Pure.

import { cs } from '../../../shared/i18n/cs';
import { STRENGTH_GROUPS, type StrengthGroupId } from '../logic/groups';
import type { Scenario } from '../logic/scenario';
import { score } from '../logic/score';
import type { Command, GameEvent, GameState } from '../logic/state';
import { quarterLabel } from '../logic/turn';
import { endingText, eventText } from './event-text';

const T = cs.diktator;
const P = T.palace;

export interface Card {
  readonly title: string;
  readonly lines: readonly string[];
  readonly button: string;
}

export type ScreenChoice =
  | { readonly kind: 'command'; readonly command: Command }
  | { readonly kind: 'retry' }
  | { readonly kind: 'newGame' }
  | { readonly kind: 'menu' };

export interface ScreenOption {
  readonly label: string;
  readonly choice: ScreenChoice;
}

export interface PhaseScreen {
  readonly title: string;
  readonly lines: readonly string[];
  readonly options: readonly ScreenOption[];
}

function dateOf(quarter: number): string {
  const { year, q } = quarterLabel(Math.max(1, quarter));
  return T.quarter(year, q);
}

function lines(sc: Scenario, events: readonly GameEvent[]): string[] {
  return events.map((e) => eventText(sc, e)).filter((x): x is string => x !== null);
}

const PALACE_PHASES = new Set(['audience', 'day']);

/**
 * The cards to show after one command. `before` is null for a new game. The evening ran when the day ended —
 * the quarter moved on or a crisis/ending began; a crisis command's outcome gets its own card.
 */
export function cardsFor(sc: Scenario, before: GameState | null, events: readonly GameEvent[], after: GameState): Card[] {
  const qi = events.findIndex((e) => e.type === 'quarterStarted');
  const head = qi < 0 ? events : events.slice(0, qi);
  const cards: Card[] = [];
  if (before) {
    const eveningRan = before.phase.kind === 'day' && (qi >= 0 || !PALACE_PHASES.has(after.phase.kind));
    const crisis = before.phase.kind === 'revolution' || before.phase.kind === 'chooseAlly' || before.phase.kind === 'punish';
    if (eveningRan) {
      const l = lines(sc, head);
      cards.push({ title: P.evening(dateOf(before.quarter)), lines: l.length > 0 ? l : [P.quietNight], button: P.next });
    } else if (crisis) {
      const l = lines(sc, head);
      if (l.length > 0) cards.push({ title: P.revolutionTitle, lines: l, button: P.next });
    }
  }
  if (qi >= 0) cards.push({ title: dateOf(after.quarter), lines: lines(sc, events.slice(qi)), button: P.toPalace });
  return cards;
}

function knownMood(s: GameState, g: StrengthGroupId): number | null {
  if (!s.palace) return s.pop[g];
  return s.palace.seenPop[g] ?? s.palace.report?.pop[g] ?? null;
}

/** The screen the phase itself asks for, or null while the palace day runs. `retryYear` is null without a checkpoint. */
export function phaseScreen(sc: Scenario, s: GameState, retryYear: number | null): PhaseScreen | null {
  const cmd = (command: Command): ScreenChoice => ({ kind: 'command', command });
  switch (s.phase.kind) {
    case 'audience':
    case 'day':
      return null;
    case 'revolution':
      return {
        title: P.revolutionTitle,
        lines: [P.rebels(sc.groupNames[s.phase.faction]), ...(s.hasPlane ? [P.planeReady] : [])],
        options: [
          { label: T.flee, choice: cmd({ type: 'flee' }) },
          { label: T.fight, choice: cmd({ type: 'fight' }) },
        ],
      };
    case 'chooseAlly':
      return {
        title: T.chooseAlly,
        lines: [],
        options: STRENGTH_GROUPS.map((g) => {
          const m = knownMood(s, g);
          return { label: P.allyMood(sc.groupNames[g], m === null ? P.unknownMood : T.moods[m]), choice: cmd({ type: 'ally', group: g }) };
        }),
      };
    case 'punish':
      return {
        title: P.victory,
        lines: [],
        options: [
          { label: T.punishYes, choice: cmd({ type: 'punish', punish: true }) },
          { label: T.punishNo, choice: cmd({ type: 'punish', punish: false }) },
        ],
      };
    case 'ended': {
      const ending = s.phase.ending;
      const options: ScreenOption[] = [];
      if (retryYear !== null) options.push({ label: T.retry(retryYear), choice: { kind: 'retry' } });
      options.push({ label: T.newGame, choice: { kind: 'newGame' } }, { label: P.toMenu, choice: { kind: 'menu' } });
      return { title: P.ending, lines: [endingText(ending), T.score(score(s, ending).total)], options };
    }
  }
}
```

- [ ] **Step 4: Run the test, type check, commit**

Run: `npx vitest run tests/diktator/screens.test.ts` → PASS. `npm test` → green; `npx tsc --noEmit` → clean.

```bash
git add src/games/diktator/ui/screens.ts tests/diktator/screens.test.ts
git commit -m "feat(diktator): shared screens — evening, new quarter, revolution, ending"
```

---

### Task 6: Controls — menu navigation, arrows, seats

**Files:**
- Create: `src/games/diktator/ui/controls.ts`
- Test: `tests/diktator/controls.test.ts`

- [ ] **Step 1: Write the test**

Create `tests/diktator/controls.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { Command } from '../../src/games/diktator/logic/state';
import { CLOSED, clampFocus, heroOf, isSolo, join, navigate, NO_SEATS, palaceAct, seatedDevices } from '../../src/games/diktator/ui/controls';

describe('navigate', () => {
  it('opens a closed menu with Action, and passes arrows and the seal key through', () => {
    expect(navigate(CLOSED, { kind: 'action' }, 3, false)).toEqual({ ui: { open: true, focus: 0 }, chosen: null, pass: null });
    expect(navigate(CLOSED, { kind: 'action' }, 0, false)).toEqual({ ui: CLOSED, chosen: null, pass: null });
    expect(navigate(CLOSED, { kind: 'dir', dir: 'left' }, 3, false).pass).toEqual({ kind: 'dir', dir: 'left' });
    expect(navigate(CLOSED, { kind: 'seal' }, 3, false).pass).toEqual({ kind: 'seal' });
    expect(navigate(CLOSED, { kind: 'close' }, 3, false).pass).toBeNull();
  });

  it('moves the focus up and down with wrap-around, ignores left and right', () => {
    const open = { open: true, focus: 0 };
    expect(navigate(open, { kind: 'dir', dir: 'down' }, 3, false).ui.focus).toBe(1);
    expect(navigate(open, { kind: 'dir', dir: 'up' }, 3, false).ui.focus).toBe(2);
    expect(navigate(open, { kind: 'dir', dir: 'left' }, 3, false)).toEqual({ ui: open, chosen: null, pass: null });
  });

  it('chooses the focused item and closes, or closes on Esc / seal key', () => {
    const open = { open: true, focus: 2 };
    expect(navigate(open, { kind: 'action' }, 3, false)).toEqual({ ui: CLOSED, chosen: 2, pass: null });
    expect(navigate(open, { kind: 'close' }, 3, false)).toEqual({ ui: CLOSED, chosen: null, pass: null });
    expect(navigate(open, { kind: 'seal' }, 3, false)).toEqual({ ui: CLOSED, chosen: null, pass: null });
  });

  it('keeps a modal menu open: arrows move the focus, Action chooses, Esc does nothing', () => {
    expect(navigate(CLOSED, { kind: 'dir', dir: 'down' }, 4, true).ui.focus).toBe(1);
    expect(navigate({ open: false, focus: 1 }, { kind: 'action' }, 4, true)).toEqual({ ui: { open: false, focus: 1 }, chosen: 1, pass: null });
    expect(navigate(CLOSED, { kind: 'close' }, 4, true)).toEqual({ ui: CLOSED, chosen: null, pass: null });
    expect(navigate(CLOSED, { kind: 'dir', dir: 'left' }, 4, true).pass).toBeNull();
  });

  it('clamps the focus when the menu shrinks', () => {
    expect(clampFocus({ open: true, focus: 5 }, 3)).toEqual({ open: true, focus: 2 });
    expect(clampFocus({ open: true, focus: 1 }, 3)).toEqual({ open: true, focus: 1 });
    expect(clampFocus({ open: true, focus: 1 }, 0)).toEqual({ open: true, focus: 0 });
  });
});

describe('palaceAct', () => {
  const cmds: Command[] = [
    { type: 'move', hero: 'zogu', dir: 'left' },
    { type: 'giveSeal', hero: 'zogu' },
    { type: 'endDay', hero: 'zogu' },
  ];
  it('turns an arrow into a move, or a bump at a wall', () => {
    expect(palaceAct(cmds, { kind: 'dir', dir: 'left' })).toEqual({ kind: 'command', command: cmds[0] });
    expect(palaceAct(cmds, { kind: 'dir', dir: 'up' })).toEqual({ kind: 'bump', dir: 'up' });
  });
  it('turns the seal key into take or give, preferring take', () => {
    expect(palaceAct(cmds, { kind: 'seal' })).toEqual({ kind: 'command', command: cmds[1] });
    const both: Command[] = [{ type: 'giveSeal', hero: 'zogu' }, { type: 'takeSeal', hero: 'zogu' }];
    expect(palaceAct(both, { kind: 'seal' })).toEqual({ kind: 'command', command: both[1] });
    expect(palaceAct([], { kind: 'seal' })).toBeNull();
    expect(palaceAct(cmds, { kind: 'action' })).toBeNull();
  });
});

describe('seats', () => {
  it('seats the first device as Zogu and the second as Kovář, once each', () => {
    let s = join(NO_SEATS, 'kb-left');
    expect(s).toEqual({ zogu: 'kb-left', velitel: null });
    expect(join(s, 'kb-left')).toBe(s);
    s = join(s, 'pad-0');
    expect(s).toEqual({ zogu: 'kb-left', velitel: 'pad-0' });
    expect(join(s, 'kb-right')).toBe(s);
    expect(seatedDevices(s)).toEqual(['kb-left', 'pad-0']);
  });

  it('lets a solo player steer the active hero; two players steer their own', () => {
    const solo = join(NO_SEATS, 'pad-0');
    expect(isSolo(solo)).toBe(true);
    expect(heroOf(solo, 'pad-0', 'velitel')).toBe('velitel');
    expect(heroOf(solo, 'kb-left', 'zogu')).toBeNull();
    const duo = join(solo, 'kb-right');
    expect(isSolo(duo)).toBe(false);
    expect(heroOf(duo, 'pad-0', 'velitel')).toBe('zogu');
    expect(heroOf(duo, 'kb-right', 'zogu')).toBe('velitel');
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run tests/diktator/controls.test.ts`
Expected: FAIL — cannot find module `ui/controls`.

- [ ] **Step 3: Implement `controls.ts`**

Create `src/games/diktator/ui/controls.ts`:

```ts
// Controls of the palace game (spec §12), device-free and pure: menu navigation shared by the halves and the
// shared screens, what an arrow or the seal key means in the palace, and which device steers which hero.

import type { DeviceId } from '../../../shared/input/manager';
import type { Direction, Hero } from '../logic/palace';
import type { Command } from '../logic/state';

export type Intent =
  | { readonly kind: 'dir'; readonly dir: Direction }
  | { readonly kind: 'action' }
  | { readonly kind: 'seal' }
  | { readonly kind: 'close' };

export interface MenuUi {
  readonly open: boolean;
  readonly focus: number;
}

export const CLOSED: MenuUi = { open: false, focus: 0 };

export interface NavResult {
  readonly ui: MenuUi;
  /** Index of the chosen item. */
  readonly chosen: number | null;
  /** An intent a closed menu does not handle (arrows, the seal key), for the palace to act on. */
  readonly pass: Intent | null;
}

/**
 * One intent applied to a menu of `count` items. A modal menu (the audience, a shared screen) is always open:
 * arrows move its focus, Action chooses, nothing closes it. A closed menu opens on Action and passes arrows and
 * the seal key through.
 */
export function navigate(ui: MenuUi, intent: Intent, count: number, modal: boolean): NavResult {
  if (!ui.open && !modal) {
    if (intent.kind === 'action') return { ui: count > 0 ? { open: true, focus: 0 } : ui, chosen: null, pass: null };
    return { ui, chosen: null, pass: intent.kind === 'close' ? null : intent };
  }
  const after = modal ? ui : CLOSED;
  switch (intent.kind) {
    case 'dir': {
      if ((intent.dir !== 'up' && intent.dir !== 'down') || count === 0) return { ui, chosen: null, pass: null };
      const step = intent.dir === 'up' ? -1 : 1;
      return { ui: { open: ui.open, focus: (ui.focus + step + count) % count }, chosen: null, pass: null };
    }
    case 'action':
      return { ui: after, chosen: count > 0 ? Math.min(ui.focus, count - 1) : null, pass: null };
    case 'seal':
    case 'close':
      return { ui: after, chosen: null, pass: null };
  }
}

export function clampFocus(ui: MenuUi, count: number): MenuUi {
  return ui.focus < count || ui.focus === 0 ? ui : { ...ui, focus: Math.max(0, count - 1) };
}

export type PalaceAct =
  | { readonly kind: 'command'; readonly command: Command }
  | { readonly kind: 'bump'; readonly dir: Direction }
  | null;

/** A passed-through intent in the palace: a move to the next room, a bump against a wall, or the seal shortcut. */
export function palaceAct(commands: readonly Command[], intent: Intent): PalaceAct {
  if (intent.kind === 'dir') {
    const move = commands.find((c) => c.type === 'move' && c.dir === intent.dir);
    return move ? { kind: 'command', command: move } : { kind: 'bump', dir: intent.dir };
  }
  if (intent.kind === 'seal') {
    const seal = commands.find((c) => c.type === 'takeSeal') ?? commands.find((c) => c.type === 'giveSeal');
    return seal ? { kind: 'command', command: seal } : null;
  }
  return null;
}

export interface Seats {
  readonly zogu: DeviceId | null;
  readonly velitel: DeviceId | null;
}

export const NO_SEATS: Seats = { zogu: null, velitel: null };

/** The first device to join plays Zogu, the second Kovář; a device joins once. */
export function join(seats: Seats, d: DeviceId): Seats {
  if (seats.zogu === d || seats.velitel === d) return seats;
  if (seats.zogu === null) return { ...seats, zogu: d };
  if (seats.velitel === null) return { ...seats, velitel: d };
  return seats;
}

export function isSolo(seats: Seats): boolean {
  return seats.zogu !== null && seats.velitel === null;
}

export function seatedDevices(seats: Seats): DeviceId[] {
  return [seats.zogu, seats.velitel].filter((d): d is DeviceId => d !== null);
}

/** The hero this device steers now: its own seat, or in solo play whichever hero the player switched to. */
export function heroOf(seats: Seats, d: DeviceId, active: Hero): Hero | null {
  if (isSolo(seats)) return seats.zogu === d ? active : null;
  if (seats.zogu === d) return 'zogu';
  if (seats.velitel === d) return 'velitel';
  return null;
}
```

- [ ] **Step 4: Run the test, type check, commit**

Run: `npx vitest run tests/diktator/controls.test.ts` → PASS. `npm test` → green; `npx tsc --noEmit` → clean.

```bash
git add src/games/diktator/ui/controls.ts tests/diktator/controls.test.ts
git commit -m "feat(diktator): palace controls — menus, arrows, seats, solo switch"
```

---

### Task 7: The stage — petitioner, revealed plots, heroes apart, slide and bump

**Files:**
- Modify: `src/games/diktator/ui/palace-view.ts` (two new `RoomView` fields)
- Modify: `src/games/diktator/render/rooms/scene.ts` (`drawRoom` option, `drawHeroes`, petitioner, plot marker)
- Create: `src/games/diktator/render/rooms/stage.ts`
- Modify: `tests/diktator/palace-view.test.ts`, `tests/diktator/scene.test.ts`
- Test: `tests/diktator/stage.test.ts`

- [ ] **Step 1: Write the view tests**

Append to `tests/diktator/palace-view.test.ts` (it already imports `advance`, `newGame`, `albania`, `roomView` and defines `day()`); add the imports `import { petitionById } from '../../src/games/diktator/logic/audience';` and `import { GROUP_LOOK } from '../../src/games/diktator/render/puppet/looks';` at the top:

```ts
describe('roomView — petitioner and revealed plots', () => {
  it('puts the petitioner in the throne room during the audience only', () => {
    const s = newGame(albania, 4, undefined, { palace: true }).state;
    const pet = petitionById(albania, (s.phase as { petition: string }).petition);
    expect(roomView(albania, s, 'trunni').petitioner).toBe(GROUP_LOOK[pet.from]);
    expect(roomView(albania, s, 'pracovna').petitioner).toBeNull();
    expect(roomView(albania, day(), 'trunni').petitioner).toBeNull();
  });

  it('marks a plot the commander revealed, in the faction’s own room', () => {
    const s = day();
    expect(roomView(albania, s, 'armada').plotMarker).toBeNull();
    s.palace!.investigated.armada = { kind: 'assassination' };
    expect(roomView(albania, s, 'armada').plotMarker).toBe('spiknutí: atentát');
    s.palace!.investigated.armada = { kind: 'none' };
    expect(roomView(albania, s, 'armada').plotMarker).toBeNull();
  });

  it('takes plots from the police report too', () => {
    const s = day();
    s.palace!.report = {
      pop: s.pop, str: s.str, guard: s.guard, low: s.low, threshold: s.threshold,
      plots: { armada: { kind: 'none' }, rolnici: { kind: 'revolution', ally: 'policie' }, statkari: { kind: 'none' } },
    };
    expect(roomView(albania, s, 'rolnici').plotMarker).toBe('spiknutí: revoluce, spojenec Tajná policie');
  });
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run tests/diktator/palace-view.test.ts`
Expected: FAIL — `petitioner` / `plotMarker` undefined.

- [ ] **Step 3: Add the fields to `RoomView`**

In `src/games/diktator/ui/palace-view.ts`:
- add imports `import { petitionById } from '../logic/audience';`, `import { FACTIONS } from '../logic/groups';` (merge into the existing groups import), `import { plotText } from './event-text';`;
- add to `RoomView` after `portraitMood`:

```ts
  /** Throne room during the audience: the petitioner's look; else null. */
  readonly petitioner: LookId | null;
  /** A plot the commander revealed this quarter for this room's faction (investigation, else police report), as text; null if none known. */
  readonly plotMarker: string | null;
```

- in `roomView`, before `return`, compute:

```ts
  const petitioner = room === L.throne && s.phase.kind === 'audience' ? GROUP_LOOK[petitionById(sc, s.phase.petition).from] : null;
  const faction = crowds.map((c) => c.group).find((g) => (FACTIONS as readonly string[]).includes(g)) as (typeof FACTIONS)[number] | undefined;
  const known = faction && s.palace ? (s.palace.investigated[faction] ?? s.palace.report?.plots[faction]) : undefined;
  const plotMarker = known && known.kind !== 'none' ? plotText(sc, known) : null;
```

and add `petitioner,` and `plotMarker,` to the returned object.

Run: `npx vitest run tests/diktator/palace-view.test.ts` → PASS.

- [ ] **Step 4: Write the stage test**

Create `tests/diktator/stage.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { BUMP_SEC, bumpOffset, progress, SLIDE_SEC, slideOffsets } from '../../src/games/diktator/render/rooms/stage';
import { STAGE_H, STAGE_W } from '../../src/games/diktator/render/rooms/crowd';

function near(a: readonly number[], b: readonly number[]): void {
  expect(a.length).toBe(b.length);
  a.forEach((v, i) => expect(Math.abs(v - b[i])).toBeLessThan(1e-9));
}

describe('progress', () => {
  it('is 1 without an animation and runs 0 → 1 over its length', () => {
    expect(progress(null, 5)).toBe(1);
    expect(SLIDE_SEC).toBe(0.4);
    const bump = { kind: 'bump', dir: 'up', start: 1 } as const;
    expect(progress(bump, 1)).toBe(0);
    expect(progress(bump, 1 + BUMP_SEC / 2)).toBeCloseTo(0.5);
    expect(progress(bump, 9)).toBe(1);
    expect(progress(bump, 0)).toBe(0);
  });
});

describe('slideOffsets', () => {
  it('brings the new room in from the side the hero walked to', () => {
    near([...slideOffsets('right', 0).from, ...slideOffsets('right', 0).to], [0, 0, STAGE_W, 0]);
    near([...slideOffsets('right', 1).from, ...slideOffsets('right', 1).to], [-STAGE_W, 0, 0, 0]);
    near([...slideOffsets('up', 1).from], [0, STAGE_H]);
    near([...slideOffsets('down', 0).to], [0, STAGE_H]);
  });
});

describe('bumpOffset', () => {
  it('nudges toward the wall and back', () => {
    near(bumpOffset('left', 0), [0, 0]);
    near(bumpOffset('left', 0.5), [-4, 0]);
    near(bumpOffset('down', 1), [0, 0]);
  });
});
```

- [ ] **Step 5: Run it to see it fail**

Run: `npx vitest run tests/diktator/stage.test.ts`
Expected: FAIL — cannot find module `render/rooms/stage`.

- [ ] **Step 6: Split the heroes from the room in `scene.ts`**

In `src/games/diktator/render/rooms/scene.ts`:
- add `import type { Hero } from '../../logic/palace';`;
- replace the heroes block at the end of `drawRoom` (the `v.heroes.forEach(…)` loop) and the signature so the function reads:

```ts
export interface DrawRoomOptions {
  /** Draw the heroes standing in the room (default). The split screen draws them itself with `drawHeroes`. */
  readonly heroes?: boolean;
}

/** Draws the room; heroes present stand on the left facing right. `t` is seconds (animation).
 * Owns its canvas state (save/restore, and the defaults below) so one room never leaks style into the next. */
export function drawRoom(ctx: CanvasRenderingContext2D, v: RoomView, t: number, opts: DrawRoomOptions = {}): void {
  ctx.save();
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.lineCap = 'butt';
  ctx.lineJoin = 'miter';
  const st = ROOM_STYLES[v.id];
  drawBackground(ctx, st);
  if (st.portrait) drawPortrait(ctx, st, v.portraitMood);
  for (const f of st.furniture) drawFurniture(ctx, f, st, t);
  drawSpecial(ctx, v, st, t);
  if (v.layout === 'envoys') drawEnvoys(ctx, v.crowds, t);
  else v.crowds.forEach((c, i) => drawCrowd(ctx, c, t, i * 12));
  if (v.resident) {
    puppetAt(ctx, 380, FLOOR_Y, 1, -1, () => drawPuppet(ctx, solvePuppet(POSES.stand(t)), LOOKS[v.resident!], 'neutral'));
  }
  if (v.petitioner) {
    puppetAt(ctx, 330, FLOOR_Y, 1, -1, () => drawPuppet(ctx, solvePuppet(POSES.talk(t)), LOOKS[v.petitioner!], 'neutral'));
  }
  if (v.plotMarker) drawPlotMarker(ctx, v.plotMarker);
  if (opts.heroes ?? true) drawHeroes(ctx, v.heroes, null, t);
  ctx.fillStyle = '#efe4c4';
  ctx.font = '13px Georgia, serif';
  ctx.fillText(v.name, 10, 11);
  ctx.restore();
}

/** A revealed plot: a red ribbon over the room's crowd (spec §5.2: "a marker naming the ally"). */
function drawPlotMarker(ctx: CanvasRenderingContext2D, text: string): void {
  ctx.save();
  ctx.fillStyle = '#8c1d24';
  ctx.fillRect(250, 16, 222, 18);
  ctx.fillStyle = '#efe4c4';
  ctx.font = '11px Georgia, serif';
  ctx.textAlign = 'center';
  ctx.fillText(text, 361, 29);
  ctx.restore();
}

/**
 * Heroes on the left, facing right. With `own` (the split screen's hero) the other hero stands behind, a little
 * smaller, and `own` is drawn last so his own figure is always foremost; `stepIn` < 1 walks `own` in from the
 * left edge (the room change). Without `own`, the heroes stand side by side as in plan 2b.
 */
export function drawHeroes(ctx: CanvasRenderingContext2D, heroes: readonly Hero[], own: Hero | null, t: number, stepIn = 1): void {
  ctx.save();
  const others = own === null ? heroes : heroes.filter((h) => h !== own);
  others.forEach((h, i) => {
    const x = own === null ? 90 + i * 55 : 145 + i * 55;
    const scale = own === null ? 1 : 0.92;
    puppetAt(ctx, x, FLOOR_Y, scale, 1, () => drawPuppet(ctx, solvePuppet(POSES.stand(t)), LOOKS[h], 'neutral'));
  });
  if (own !== null && heroes.includes(own)) {
    const walking = stepIn < 1;
    const x = walking ? -20 + 110 * Math.max(0, stepIn) : 90;
    const pose = walking ? POSES.walk(t) : POSES.stand(t);
    puppetAt(ctx, x, FLOOR_Y, 1, 1, () => drawPuppet(ctx, solvePuppet(pose), LOOKS[own], 'neutral'));
  }
  ctx.restore();
}
```

Keep every other function in `scene.ts` unchanged. If `POSES.talk` does not exist, use `POSES.stand` and say so in the report.

- [ ] **Step 7: Implement `stage.ts`**

Create `src/games/diktator/render/rooms/stage.ts`:

```ts
// One half of the split screen (spec §5): the room its hero stands in, the 0.4 s slide when he changes rooms
// (the old room slides away, the new one comes in, his figure steps in from the left edge) and a short nudge
// when he walks into a wall. Owns its canvas state.

import type { Direction, Hero } from '../../logic/palace';
import type { RoomView } from '../../ui/palace-view';
import { STAGE_H, STAGE_W } from './crowd';
import { drawHeroes, drawRoom } from './scene';

export const SLIDE_SEC = 0.4;
export const BUMP_SEC = 0.15;

export type StageAnim =
  | { readonly kind: 'slide'; readonly from: RoomView; readonly dir: Direction; readonly start: number }
  | { readonly kind: 'bump'; readonly dir: Direction; readonly start: number };

const VEC: Readonly<Record<Direction, readonly [number, number]>> = { left: [-1, 0], right: [1, 0], up: [0, -1], down: [0, 1] };

/** 0..1 through the animation at time `t` (seconds); 1 when there is none or it has finished. */
export function progress(anim: StageAnim | null, t: number): number {
  if (!anim) return 1;
  const len = anim.kind === 'slide' ? SLIDE_SEC : BUMP_SEC;
  return Math.min(1, Math.max(0, (t - anim.start) / len));
}

/** Offsets of the old and the new room during a slide (ease-out): the new room comes in from the side walked to. */
export function slideOffsets(dir: Direction, p: number): { readonly from: readonly [number, number]; readonly to: readonly [number, number] } {
  const [vx, vy] = VEC[dir];
  const e = 1 - (1 - p) * (1 - p);
  return {
    from: [-vx * STAGE_W * e, -vy * STAGE_H * e],
    to: [vx * STAGE_W * (1 - e), vy * STAGE_H * (1 - e)],
  };
}

/** A quick nudge toward the wall and back. */
export function bumpOffset(dir: Direction, p: number): readonly [number, number] {
  const [vx, vy] = VEC[dir];
  const k = Math.sin(p * Math.PI) * 4;
  return [vx * k, vy * k];
}

/** Draws `own`'s half: `view` is the room he stands in now. The caller has set the stage transform (480 × 200). */
export function drawHalf(ctx: CanvasRenderingContext2D, view: RoomView, own: Hero, anim: StageAnim | null, t: number): void {
  const p = progress(anim, t);
  ctx.save();
  if (anim && anim.kind === 'slide' && p < 1) {
    const o = slideOffsets(anim.dir, p);
    ctx.save();
    ctx.translate(o.from[0], o.from[1]);
    drawRoom(ctx, anim.from, t, { heroes: false });
    ctx.restore();
    ctx.save();
    ctx.translate(o.to[0], o.to[1]);
    drawRoom(ctx, view, t, { heroes: false });
    drawHeroes(ctx, view.heroes.filter((h) => h !== own), own, t);
    ctx.restore();
    drawHeroes(ctx, view.heroes.filter((h) => h === own), own, t, p);
  } else {
    if (anim && anim.kind === 'bump' && p < 1) {
      const [bx, by] = bumpOffset(anim.dir, p);
      ctx.translate(bx, by);
    }
    drawRoom(ctx, view, t, { heroes: false });
    drawHeroes(ctx, view.heroes, own, t);
  }
  ctx.restore();
}
```

- [ ] **Step 8: Extend the canvas smoke test**

In `tests/diktator/scene.test.ts` add the import `import { drawHalf, SLIDE_SEC } from '../../src/games/diktator/render/rooms/stage';` and `import { advance } from '../../src/games/diktator/logic/turn';` (merge with the existing `newGame` import), and append:

```ts
describe('drawHalf and the new room details (canvas smoke test)', () => {
  it('slides, bumps and draws the petitioner and a plot marker without throwing, balancing save/restore', () => {
    const originalPath2D = globalThis.Path2D;
    (globalThis as { Path2D: unknown }).Path2D = FakePath2D;
    try {
      const audience = newGame(albania, 1, undefined, { palace: true }).state;
      const day = advance(albania, audience, { type: 'answer', answer: 'no' }).state;
      day.palace!.investigated.armada = { kind: 'revolution', ally: 'policie' };
      day.palace!.at.velitel = 'trunni';
      const throne = roomView(albania, audience, 'trunni');
      expect(throne.petitioner).not.toBeNull();
      for (const room of ROOMS) {
        const view = roomView(albania, day, room);
        const from = roomView(albania, day, 'nadvori');
        for (const t of [0, SLIDE_SEC / 2, SLIDE_SEC * 2]) {
          for (const anim of [null, { kind: 'slide', from, dir: 'left', start: 0 }, { kind: 'bump', dir: 'up', start: 0 }] as const) {
            const ctx = createFakeCtx();
            drawHalf(ctx, view, 'zogu', anim, t);
            expect(ctx.depth, `${room} t=${t} ${anim?.kind ?? 'still'}`).toBe(0);
          }
        }
      }
      const ctx = createFakeCtx();
      drawHalf(ctx, throne, 'zogu', null, 0.3);
      drawHalf(ctx, roomView(albania, day, 'armada'), 'velitel', null, 0.3);
      expect(ctx.depth).toBe(0);
    } finally {
      (globalThis as { Path2D: unknown }).Path2D = originalPath2D;
    }
  });
});
```

- [ ] **Step 9: Run the tests, type check, commit**

Run: `npx vitest run tests/diktator/stage.test.ts tests/diktator/scene.test.ts tests/diktator/palace-view.test.ts` → PASS. `npm test` → green; `npx tsc --noEmit` → clean.

```bash
git add src/games/diktator/ui/palace-view.ts src/games/diktator/render/rooms tests/diktator/stage.test.ts tests/diktator/scene.test.ts tests/diktator/palace-view.test.ts
git commit -m "feat(diktator): split-screen stage — slide, bump, petitioner, plot marker"
```

---

### Task 8: Page shell and DOM rendering

**Files:**
- Move: `src/games/diktator/index.html` → `src/games/diktator/text.html`, `src/games/diktator/main.ts` → `src/games/diktator/text.ts`
- Create: `src/games/diktator/index.html` (the palace page), `src/games/diktator/palace.css`, `src/games/diktator/ui/dom.ts`
- Create (temporary, replaced in Task 9): `src/games/diktator/main.ts`
- Modify: `vite.config.ts`, `README.md`

- [ ] **Step 1: Move the text mode**

```bash
git mv src/games/diktator/index.html src/games/diktator/text.html
git mv src/games/diktator/main.ts src/games/diktator/text.ts
```

In `text.html` change `<script type="module" src="./main.ts"></script>` to `<script type="module" src="./text.ts"></script>` and the `<title>` to `Diktátor — textová verze`. In `vite.config.ts` add the input `'diktator-text': 'src/games/diktator/text.html',` after the `diktator` line.

- [ ] **Step 2: Write the palace page**

Create `src/games/diktator/index.html`:

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
    <link rel="stylesheet" href="./palace.css" />
  </head>
  <body>
    <div id="app">
      <header id="top">
        <h1 id="title">Diktátor</h1>
        <div id="top-hud"></div>
      </header>
      <div id="strip" class="strip"></div>
      <section class="half" id="half-zogu">
        <div class="stage-box"><canvas class="stage"></canvas></div>
        <aside class="panel">
          <div class="hud"></div>
          <h2 class="menu-title"></h2>
          <div class="menu-body"></div>
          <ol class="menu"></ol>
          <p class="hint"></p>
          <div class="notes" aria-live="polite"></div>
        </aside>
      </section>
      <section class="half" id="half-velitel">
        <div class="stage-box"><canvas class="stage"></canvas></div>
        <aside class="panel">
          <div class="hud"></div>
          <h2 class="menu-title"></h2>
          <div class="menu-body"></div>
          <ol class="menu"></ol>
          <p class="hint"></p>
          <div class="notes" aria-live="polite"></div>
        </aside>
      </section>
    </div>
    <div id="overlay" class="overlay hidden">
      <div class="card">
        <h2 id="overlay-title"></h2>
        <div id="overlay-lines"></div>
        <ol id="overlay-options" class="menu"></ol>
        <p id="overlay-hint" class="hint"></p>
      </div>
    </div>
    <script type="module" src="./main.ts"></script>
  </body>
</html>
```

- [ ] **Step 3: Write the styles**

Create `src/games/diktator/palace.css`:

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
* { box-sizing: border-box; }
html, body { margin: 0; height: 100%; background: var(--night); color: var(--cream); }
body { font-family: 'Poiret One', Georgia, serif; font-weight: 700; font-size: 16px; overflow: hidden; }
#app { display: grid; grid-template-rows: auto auto minmax(0, 1fr) minmax(0, 1fr); gap: 6px; height: 100vh; padding: 6px 10px; }
#top { display: flex; align-items: baseline; gap: 18px; flex-wrap: wrap; }
#top h1 { font-family: 'Limelight', Georgia, serif; font-weight: 400; color: var(--gold); margin: 0; font-size: 24px; letter-spacing: 2px; }
#top-hud { display: flex; gap: 16px; flex-wrap: wrap; color: var(--muted); }
#top-hud span:first-child { color: var(--gold); }

.strip { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 3px; max-width: 760px; width: 100%; justify-self: center; }
.strip .cell { background: var(--panel); border: 1px solid var(--gold-dark); padding: 2px 6px; font-size: 12px; line-height: 1.25; min-height: 34px; position: relative; }
.strip .cell .mood { color: var(--muted); }
.strip .cell .heroes { position: absolute; right: 4px; top: 2px; display: flex; gap: 3px; }
.strip .cell .heroes b { background: var(--gold); color: var(--night); border-radius: 50%; width: 16px; height: 16px; font-size: 11px; display: grid; place-items: center; }
.strip .cell.flash { border-color: var(--gold); box-shadow: inset 0 0 0 2px var(--gold); }

.half { display: grid; grid-template-columns: minmax(0, 1fr) minmax(250px, 30%); gap: 10px; min-height: 0; }
.half.inactive { opacity: 0.55; }
.stage-box { min-height: 0; min-width: 0; display: flex; align-items: center; justify-content: center; }
.stage { display: block; border: 1px solid var(--gold-dark); background: #000; }
.panel { min-height: 0; overflow-y: auto; background: var(--panel); border: 1px solid var(--gold-dark); padding: 8px 10px; display: flex; flex-direction: column; gap: 4px; }
.hud { color: var(--gold); display: flex; gap: 10px; flex-wrap: wrap; }
.menu-title { font-family: 'Limelight', Georgia, serif; font-weight: 400; font-size: 17px; color: var(--gold); margin: 4px 0 0; }
.menu-body p { margin: 2px 0; }
.menu { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 3px; }
.menu button { font: inherit; width: 100%; text-align: left; color: var(--cream); background: #241c12; border: 1px solid var(--gold-dark); padding: 5px 8px; cursor: pointer; }
.menu button small { display: block; color: var(--muted); font-size: 13px; }
.menu button.focus, .menu button:hover { border-color: var(--gold); box-shadow: inset 0 0 0 1px var(--gold); }
.menu.closed button { opacity: 0.7; }
.hint { color: var(--muted); font-size: 13px; margin: 2px 0; }
.notes p { margin: 2px 0; color: var(--muted); font-size: 14px; }
.notes p:last-child { color: var(--cream); }

.overlay { position: fixed; inset: 0; background: rgba(18, 14, 10, 0.88); display: grid; place-items: center; padding: 16px; }
.overlay.hidden { display: none; }
.card { max-width: 640px; width: 100%; background: var(--panel); border: 1px solid var(--gold); padding: 20px 24px; display: flex; flex-direction: column; gap: 8px; }
.card h2 { font-family: 'Limelight', Georgia, serif; font-weight: 400; color: var(--gold); margin: 0; font-size: 26px; letter-spacing: 1px; }
#overlay-lines p { margin: 4px 0; }
```

- [ ] **Step 4: Write the DOM renderer**

Create `src/games/diktator/ui/dom.ts`:

```ts
// DOM rendering of the palace page (plan 2c): the top HUD, the palace strip, each half's panel and the shared
// overlay. Thin: it draws the pure models from menus/hud/notes/screens and reports clicks; no game logic here.

import { cs } from '../../../shared/i18n/cs';
import type { Hero, RoomId } from '../logic/palace';
import { STAGE_H, STAGE_W } from '../render/rooms/crowd';
import type { MenuUi } from './controls';
import type { HeroHud } from './hud';
import type { HeroMenu } from './menus';
import type { StripCell } from './palace-view';

const T = cs.diktator;
const P = T.palace;
const $ = <E extends HTMLElement = HTMLElement>(sel: string, root: ParentNode = document) => root.querySelector(sel) as E;

function para(text: string): HTMLParagraphElement {
  const p = document.createElement('p');
  p.textContent = text;
  return p;
}

function menuList(ol: HTMLOListElement, labels: readonly { label: string; detail: string }[], focus: number | null, onChoose: (i: number) => void): void {
  ol.replaceChildren(
    ...labels.map((it, i) => {
      const li = document.createElement('li');
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = it.label;
      if (it.detail) {
        const small = document.createElement('small');
        small.textContent = it.detail;
        b.append(small);
      }
      if (i === focus) b.classList.add('focus');
      b.addEventListener('click', () => onChoose(i));
      li.append(b);
      return li;
    }),
  );
  const focused = focus === null ? null : ol.children[focus];
  focused?.scrollIntoView({ block: 'nearest' });
}

export function renderTop(lines: readonly string[]): void {
  $('#top-hud').replaceChildren(
    ...lines.map((l) => {
      const s = document.createElement('span');
      s.textContent = l;
      return s;
    }),
  );
}

export function renderStrip(cells: readonly (readonly StripCell[])[], flash: ReadonlySet<RoomId>): void {
  $('#strip').replaceChildren(
    ...cells.flat().map((c) => {
      const div = document.createElement('div');
      div.className = 'cell';
      if (flash.has(c.room)) div.classList.add('flash');
      div.append(para(c.name));
      const mood = document.createElement('span');
      mood.className = 'mood';
      mood.textContent = c.count > 0 ? `${c.count} · ${c.mood === null ? P.unknownMood : T.moods[c.mood]}` : '';
      div.append(mood);
      const heroes = document.createElement('span');
      heroes.className = 'heroes';
      for (const h of c.heroes) {
        const b = document.createElement('b');
        b.textContent = T.heroes[h][0];
        b.title = T.heroes[h];
        heroes.append(b);
      }
      div.append(heroes);
      return div;
    }),
  );
}

export interface HalfModel {
  readonly hud: HeroHud;
  readonly menu: HeroMenu;
  readonly ui: MenuUi;
  readonly notes: readonly string[];
  /** Solo play: this half is not the one being steered. */
  readonly inactive: boolean;
  readonly solo: boolean;
}

export function renderHalf(hero: Hero, m: HalfModel, onChoose: (i: number) => void): void {
  const root = $(`#half-${hero}`);
  root.classList.toggle('inactive', m.inactive);
  const hud = [m.hud.name, m.hud.room, `${P.hours} ${m.hud.hours}`];
  if (m.hud.seal) hud.push(`✉ ${P.sealMark}`);
  $('.hud', root).replaceChildren(...hud.map((t) => { const s = document.createElement('span'); s.textContent = t; return s; }));
  $('.menu-title', root).textContent = m.menu.title;
  $('.menu-body', root).replaceChildren(...m.menu.body.map(para));
  const open = m.ui.open || m.menu.modal;
  const ol = $<HTMLOListElement>('.menu', root);
  ol.classList.toggle('closed', !open);
  menuList(ol, m.menu.items, open ? m.ui.focus : null, onChoose);
  const hint = open ? P.hintOpen : P.hintClosed;
  $('.hint', root).textContent = m.solo ? `${hint} · ${P.soloHint}` : hint;
  $('.notes', root).replaceChildren(...m.notes.map(para));
}

export interface OverlayModel {
  readonly title: string;
  readonly lines: readonly string[];
  readonly options: readonly string[];
  readonly focus: number;
  readonly hint: string;
}

export function renderOverlay(m: OverlayModel | null, onChoose: (i: number) => void): void {
  $('#overlay').classList.toggle('hidden', m === null);
  if (!m) return;
  $('#overlay-title').textContent = m.title;
  $('#overlay-lines').replaceChildren(...m.lines.map(para));
  menuList($<HTMLOListElement>('#overlay-options'), m.options.map((label) => ({ label, detail: '' })), m.focus, onChoose);
  $('#overlay-hint').textContent = m.hint;
}

/** Sizes the half's canvas to the largest 480 × 200 box that fits its container; returns the stage scale. */
export function fitStage(canvas: HTMLCanvasElement): number {
  const box = canvas.parentElement!;
  const w = Math.max(1, Math.min(box.clientWidth, (box.clientHeight * STAGE_W) / STAGE_H));
  const h = (w * STAGE_H) / STAGE_W;
  const dpr = window.devicePixelRatio || 1;
  canvas.style.width = `${Math.floor(w)}px`;
  canvas.style.height = `${Math.floor(h)}px`;
  const bw = Math.round(w * dpr);
  if (canvas.width !== bw) {
    canvas.width = bw;
    canvas.height = Math.round(h * dpr);
  }
  return canvas.width / STAGE_W;
}

export function stageCanvas(hero: Hero): HTMLCanvasElement {
  return $<HTMLCanvasElement>(`#half-${hero} .stage`);
}
```

- [ ] **Step 5: A temporary `main.ts` so the page builds**

Create `src/games/diktator/main.ts` (Task 9 replaces it):

```ts
// Placeholder until Task 9 of plan 2c: the palace page shell. The text mode lives in text.html.
import { renderOverlay } from './ui/dom';

renderOverlay({ title: 'Diktátor', lines: [], options: [], focus: 0, hint: '' }, () => {});
```

- [ ] **Step 6: README**

In `README.md`, in the Diktátor entry, add one sentence: `The palace game is at src/games/diktator/index.html; the classic text mode stays at text.html.` (match the README's language and list style — if the entry is Czech, write: `Palác je hlavní hra (index.html); klasická textová verze zůstává v text.html.`)

- [ ] **Step 7: Build and commit**

Run: `npm test` → green. Run: `npm run build` → succeeds and emits both `diktator` and `diktator-text` pages.

```bash
git add -A src/games/diktator vite.config.ts README.md
git commit -m "feat(diktator): palace page shell, DOM rendering; text mode moves to text.html"
```

---

### Task 9: The game loop

**Files:**
- Replace: `src/games/diktator/main.ts`

No unit tests: this file only wires the tested modules to input, DOM and storage (spec §13: "The UI is checked by hand in the browser"). It must type-check, build, and pass the manual check in Step 3.

- [ ] **Step 1: Write `main.ts`**

Replace `src/games/diktator/main.ts` with:

```ts
// Diktátor — the palace game (plan 2c). Wires the pure UI models (menus, notes, HUD, screens, controls) to input,
// canvas, DOM and storage. Screens: title (join + menu) → palace (split screen, cards and phase screens as a
// shared overlay) ⇄ pause.

import { cs } from '../../shared/i18n/cs';
import { Sfx } from '../../shared/audio';
import { InputManager, type DeviceId } from '../../shared/input/manager';
import { startLoop } from '../../shared/loop';
import { randomSeed } from '../../shared/rng';
import { saveJson } from '../../shared/storage';
import { exits, HEROES, neighbour, other, type Hero, type RoomId } from './logic/palace';
import { palaceCommands } from './logic/palace-actions';
import { deserialize, newSave, recordTurn, retryFromYear, type SaveFile } from './logic/save';
import type { Command, GameEvent, GameState } from './logic/state';
import { advance, newGame, quarterLabel } from './logic/turn';
import { STAGE_H, STAGE_W } from './render/rooms/crowd';
import { drawHalf, type StageAnim } from './render/rooms/stage';
import { albania } from './scenario/albania';
import { CLOSED, clampFocus, heroOf, isSolo, join, navigate, NO_SEATS, palaceAct, seatedDevices, type Intent, type MenuUi, type Seats } from './ui/controls';
import { fitStage, renderHalf, renderOverlay, renderStrip, renderTop, stageCanvas, type OverlayModel } from './ui/dom';
import { Flick } from './ui/flick';
import { heroHud, topHud } from './ui/hud';
import { heroMenu, type HeroMenu } from './ui/menus';
import { notesFor } from './ui/notes';
import { roomView, stripView, type RoomView } from './ui/palace-view';
import { cardsFor, phaseScreen, type Card, type PhaseScreen } from './ui/screens';

const T = cs.diktator;
const P = T.palace;
const sc = albania;
const SAVE_KEY = 'diktator/palace';
const NOTES_KEPT = 6;
const FLASH_SEC = 0.5;

type Screen = 'title' | 'palace' | 'pause';

interface Half {
  ui: MenuUi;
  anim: StageAnim | null;
  view: RoomView;
  menu: HeroMenu;
  notes: string[];
}

const input = new InputManager(window);
const sfx = new Sfx();
const flicks = new Map<DeviceId, Flick>();

let screen: Screen = 'title';
let pauseReason = '';
let seats: Seats = NO_SEATS;
let active: Hero = 'zogu';
let file: SaveFile | null = null;
let cards: Card[] = [];
let overlayUi: MenuUi = CLOSED;
let halves: Record<Hero, Half> | null = null;
let flash: { rooms: Set<RoomId>; until: number } = { rooms: new Set(), until: 0 };
let t = 0;
let dirty = true;

// ---------- state helpers ----------

function state(): GameState {
  return file!.current;
}

function savedGame(): SaveFile | null {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(SAVE_KEY);
  } catch {
    // storage unavailable: no Continue
  }
  const f = deserialize(raw);
  return f && f.current.palace ? f : null;
}

function buildHalves(s: GameState, keep: Record<Hero, Half> | null): Record<Hero, Half> {
  const out = {} as Record<Hero, Half>;
  for (const h of HEROES) {
    const menu = heroMenu(sc, s, h);
    const prev = keep?.[h];
    out[h] = {
      ui: prev ? clampFocus(prev.ui, menu.items.length) : CLOSED,
      anim: prev?.anim ?? null,
      view: roomView(sc, s, s.palace!.at[h]),
      menu,
      notes: prev?.notes ?? [],
    };
  }
  return out;
}

function retryYear(): number | null {
  const r = file ? retryFromYear(file) : null;
  return r ? quarterLabel(r.state.quarter).year : null;
}

function currentScreen(): PhaseScreen | null {
  return file ? phaseScreen(sc, state(), retryYear()) : null;
}

function holdAll(): void {
  for (const d of input.devices()) {
    let f = flicks.get(d);
    if (!f) flicks.set(d, (f = new Flick()));
    f.hold(input.get(d));
  }
}

// ---------- starting and leaving ----------

function begin(f: SaveFile, first: readonly GameEvent[]): void {
  file = f;
  saveJson(SAVE_KEY, file);
  cards = cardsFor(sc, null, first, state());
  overlayUi = CLOSED;
  halves = buildHalves(state(), null);
  active = 'zogu';
  screen = 'palace';
  holdAll();
  dirty = true;
}

function startNew(): void {
  const { state: s, events } = newGame(sc, randomSeed(), undefined, { palace: true });
  begin(newSave(sc.id, s), events);
}

function continueSaved(): void {
  const f = savedGame();
  if (f) begin(f, []);
}

function retry(): void {
  const r = file ? retryFromYear(file) : null;
  if (!r) return;
  begin(r.file, [{ type: 'quarterStarted', quarter: r.state.quarter }]);
}

function toTitle(): void {
  if (file) saveJson(SAVE_KEY, file);
  file = null;
  halves = null;
  cards = [];
  seats = NO_SEATS;
  overlayUi = CLOSED;
  screen = 'title';
  dirty = true;
}

// ---------- playing a command ----------

function play(cmd: Command): void {
  if (!file || !halves) return;
  const before = state();
  let result: { state: GameState; events: readonly GameEvent[] };
  try {
    result = advance(sc, before, cmd);
  } catch (e) {
    console.error(e);
    return;
  }
  const { state: after, events } = result;
  file = recordTurn(file, after);
  saveJson(SAVE_KEY, file);

  const oldViews = { zogu: halves.zogu.view, velitel: halves.velitel.view };
  const next = buildHalves(after, after.quarter === before.quarter ? halves : null);
  for (const e of events) {
    if (e.type === 'moved') {
      next[e.hero].anim = { kind: 'slide', from: oldViews[e.hero], dir: dirOf(e.from, e.to), start: t };
      sfx.play('step');
      sfx.play('door');
    }
    if (e.type === 'decided') sfx.play('stamp');
    if (e.type === 'aidGranted' || e.type === 'swissTransfer') sfx.play('coins');
    for (const n of notesFor(sc, after, e)) {
      for (const h of n.to === 'both' ? HEROES : [n.to]) next[h].notes = [...next[h].notes, n.text].slice(-NOTES_KEPT);
    }
  }
  halves = next;
  const newCards = cardsFor(sc, before, events, after);
  if (newCards.length > 0) {
    cards.push(...newCards);
    overlayUi = CLOSED;
    sfx.play('paper');
    holdAll();
  }
  dirty = true;
}

function dirOf(from: RoomId, to: RoomId): 'up' | 'down' | 'left' | 'right' {
  const L = sc.palace!;
  for (const d of ['up', 'down', 'left', 'right'] as const) if (neighbour(L, from, d) === to) return d;
  return 'right';
}

function bump(hero: Hero, dir: 'up' | 'down' | 'left' | 'right'): void {
  if (!halves || !file) return;
  halves[hero].anim = { kind: 'bump', dir, start: t };
  const L = sc.palace!;
  const room = state().palace!.at[hero];
  flash = { rooms: new Set(exits(L, room).map((d) => neighbour(L, room, d)!)), until: t + FLASH_SEC };
  sfx.play('bump');
  dirty = true;
}

// ---------- input ----------

function intentsOf(d: DeviceId): Intent[] {
  let f = flicks.get(d);
  if (!f) flicks.set(d, (f = new Flick()));
  const out: Intent[] = [];
  const dir = f.next(input.get(d));
  if (dir) out.push({ kind: 'dir', dir });
  if (input.pressed(d, 'action')) out.push({ kind: 'action' });
  if (input.pressed(d, 'trap')) out.push({ kind: 'seal' });
  if (input.pressed(d, 'pause')) out.push({ kind: 'close' });
  return out;
}

/** Title: an unseated device joins with Action; seated devices steer the title menu. */
function titleOptions(): { label: string; run: () => void }[] {
  const opts = [{ label: P.join.newGame, run: startNew }];
  if (savedGame()) opts.push({ label: P.join.continueGame, run: continueSaved });
  opts.push({ label: P.join.textMode, run: () => { window.location.href = './text.html'; } });
  return opts;
}

function updateTitle(): void {
  for (const d of input.devices()) {
    const seated = seatedDevices(seats).includes(d);
    const intents = intentsOf(d);
    if (!seated) {
      if (intents.some((i) => i.kind === 'action')) {
        sfx.unlock();
        seats = join(seats, d);
        sfx.play('join');
        dirty = true;
      }
      continue;
    }
    for (const intent of intents) {
      const opts = titleOptions();
      const r = navigate(overlayUi, intent, opts.length, true);
      if (r.ui.focus !== overlayUi.focus) sfx.play('click');
      overlayUi = r.ui;
      dirty = true;
      if (r.chosen !== null) {
        opts[r.chosen].run();
        return;
      }
    }
  }
}

/** A shared screen (card or phase screen) is up: any seated device steers it. */
function updateShared(): boolean {
  const card = cards[0];
  const scr = card ? null : currentScreen();
  if (!card && !scr) return false;
  const count = card ? 1 : scr!.options.length;
  for (const d of seatedDevices(seats)) {
    for (const intent of intentsOf(d)) {
      const r = navigate(overlayUi, intent, count, true);
      if (r.ui.focus !== overlayUi.focus) sfx.play('click');
      overlayUi = r.ui;
      dirty = true;
      if (r.chosen !== null) {
        chooseShared(r.chosen);
        return true;
      }
    }
  }
  return true;
}

function chooseShared(i: number): void {
  if (cards.length > 0) {
    cards.shift();
    overlayUi = CLOSED;
    holdAll();
    dirty = true;
    return;
  }
  const scr = currentScreen();
  const opt = scr?.options[i];
  if (!opt) return;
  overlayUi = CLOSED;
  switch (opt.choice.kind) {
    case 'command': play(opt.choice.command); break;
    case 'retry': retry(); break;
    case 'newGame': startNew(); break;
    case 'menu': toTitle(); break;
  }
  dirty = true;
}

function choosePalace(hero: Hero, i: number): void {
  if (!halves) return;
  const item = halves[hero].menu.items[i];
  halves[hero].ui = halves[hero].menu.modal ? halves[hero].ui : CLOSED;
  if (item) play(item.command);
}

function updatePalace(): void {
  if (seatedDevices(seats).some((d) => !input.isConnected(d))) return pause(P.pause.padLost);
  const switchPressed = input.keyPressed('Tab') || seatedDevices(seats).some((d) => input.pressed(d, 'back'));
  if (switchPressed && isSolo(seats)) {
    active = other(active);
    dirty = true;
  }
  if (updateShared()) return;
  if (!halves) return;
  for (const d of seatedDevices(seats)) {
    const hero = heroOf(seats, d, active);
    if (!hero) continue;
    for (const intent of intentsOf(d)) {
      const half = halves[hero];
      if (intent.kind === 'close' && !(half.ui.open && !half.menu.modal)) return pause(P.pause.title);
      const r = navigate(half.ui, intent, half.menu.items.length, half.menu.modal);
      if (r.ui.focus !== half.ui.focus && r.chosen === null) sfx.play('click');
      half.ui = r.ui;
      dirty = true;
      if (r.chosen !== null) {
        choosePalace(hero, r.chosen);
        return;
      }
      if (r.pass) {
        const act = palaceAct(palaceCommands(sc, state(), hero), r.pass);
        if (act?.kind === 'command') {
          play(act.command);
          return;
        }
        if (act?.kind === 'bump') bump(hero, act.dir);
      }
    }
  }
}

function pause(reason: string): void {
  pauseReason = reason;
  screen = 'pause';
  overlayUi = CLOSED;
  dirty = true;
}

function pauseOptions(): { label: string; run: () => void }[] {
  return [
    { label: P.pause.resume, run: () => { if (seatedDevices(seats).every((d) => input.isConnected(d))) { screen = 'palace'; holdAll(); } } },
    { label: P.pause.menu, run: toTitle },
  ];
}

function updatePause(): void {
  for (const d of seatedDevices(seats)) {
    if (!input.isConnected(d)) continue;
    for (const intent of intentsOf(d)) {
      const opts = pauseOptions();
      if (intent.kind === 'close') {
        opts[0].run();
        dirty = true;
        return;
      }
      const r = navigate(overlayUi, intent, opts.length, true);
      overlayUi = r.ui;
      dirty = true;
      if (r.chosen !== null) {
        opts[r.chosen].run();
        return;
      }
    }
  }
}

function update(dt: number): void {
  input.update();
  t += dt;
  if (input.anyKeyPressed()) sfx.unlock();
  if (flash.rooms.size > 0 && t > flash.until) {
    flash = { rooms: new Set(), until: 0 };
    dirty = true;
  }
  if (screen === 'title') updateTitle();
  else if (screen === 'palace') updatePalace();
  else updatePause();
}

// ---------- rendering ----------

function overlayModel(): OverlayModel | null {
  if (screen === 'title') {
    const deviceName = (d: DeviceId | null) =>
      d === null ? P.join.waiting : d === 'kb-left' ? cs.spy.devices.kbLeft : d === 'kb-right' ? cs.spy.devices.kbRight : cs.spy.devices.pad(Number(d.slice(4)) + 1);
    const opts = seatedDevices(seats).length > 0 ? titleOptions().map((o) => o.label) : [];
    return {
      title: P.join.title,
      lines: [T.subtitle, P.join.slot(T.heroes.zogu, deviceName(seats.zogu)), P.join.slot(T.heroes.velitel, deviceName(seats.velitel))],
      options: opts,
      focus: overlayUi.focus,
      hint: P.join.hint,
    };
  }
  if (screen === 'pause') {
    return { title: pauseReason, lines: [], options: pauseOptions().map((o) => o.label), focus: overlayUi.focus, hint: '' };
  }
  const card = cards[0];
  if (card) return { title: card.title, lines: card.lines, options: [card.button], focus: 0, hint: '' };
  const scr = currentScreen();
  if (scr) return { title: scr.title, lines: scr.lines, options: scr.options.map((o) => o.label), focus: overlayUi.focus, hint: '' };
  return null;
}

function onOverlayClick(i: number): void {
  if (screen === 'title') {
    if (seatedDevices(seats).length === 0) seats = join(seats, 'kb-left');
    titleOptions()[i]?.run();
  } else if (screen === 'pause') {
    pauseOptions()[i]?.run();
  } else {
    chooseShared(i);
  }
  dirty = true;
}

function renderDom(): void {
  renderOverlay(overlayModel(), onOverlayClick);
  if (!file || !halves) return;
  const s = state();
  renderTop(topHud(s));
  renderStrip(stripView(sc, s), flash.rooms);
  for (const h of HEROES) {
    const half = halves[h];
    renderHalf(
      h,
      { hud: heroHud(sc, s, h), menu: half.menu, ui: half.ui, notes: half.notes, inactive: isSolo(seats) && active !== h, solo: isSolo(seats) },
      (i) => { choosePalace(h, i); dirty = true; },
    );
  }
}

function render(): void {
  if (dirty) {
    dirty = false;
    renderDom();
  }
  if (!halves) return;
  for (const h of HEROES) {
    const canvas = stageCanvas(h);
    const k = fitStage(canvas);
    const ctx = canvas.getContext('2d');
    if (!ctx) continue;
    ctx.setTransform(k, 0, 0, k, 0, 0);
    ctx.clearRect(0, 0, STAGE_W, STAGE_H);
    drawHalf(ctx, halves[h].view, h, halves[h].anim, t);
  }
}

window.addEventListener('keydown', (e) => {
  if (e.code === 'Tab') e.preventDefault();
});

startLoop(update, render);
```

If `input.pressed(d, 'back')` does not type-check, Task 1's `Edge` change is missing — fix that, not this call. `neighbour`/`exits` come from `logic/palace.ts` (plan 2a). If `noUnusedLocals` flags an import, remove it.

- [ ] **Step 2: Type check, test, build**

Run: `npx tsc --noEmit` → clean. `npm test` → green. `npm run build` → succeeds.

- [ ] **Step 3: Manual check in the browser (controller's step)**

Start `npm run dev -- --port 5174 --strictPort`, open `http://localhost:5174/src/games/diktator/index.html` and check:
1. Title: F joins Zogu, Enter joins Kovář; "Nová hra" with F starts the game; the first quarter's card appears; "Do paláce" closes it.
2. Zogu's half shows the audience (modal); answering "Ne" closes it; Zogu can then walk with WASD, the room slides in 0.4 s and his figure steps in from the left; walking into a wall nudges the room and flashes the neighbouring cells on the strip.
3. Kovář (arrows + Enter) opens his menu in the guardroom and reads the police report; the notes appear only in his half.
4. Zogu takes the seal in the study (G) and seals a decision; the money moves in the top HUD.
5. Both end the quarter: the evening card, then the next quarter's card.
6. Esc pauses; "Uložit a do menu" returns to the title; "Pokračovat" resumes the saved game.
7. Solo: one device only — Tab switches which half is steered (the other dims).
8. `text.html` still plays the text mode.

- [ ] **Step 4: Commit**

```bash
git add src/games/diktator/main.ts
git commit -m "feat(diktator): the palace game loop — join, split screen, shared screens, pause, autosave"
```
