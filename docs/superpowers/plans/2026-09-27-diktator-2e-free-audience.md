# Diktátor 2e — the audience waits, Zogu is free; fixed keyboard seats Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A quarter no longer opens with Zogu locked in front of the petitioner. He starts in his study and may walk and act. The petitioner waits in the throne room; the quarter cannot end until Zogu has answered him there. Mother's advice about the petition is asked in her own room. The petitioner stands further back so bubbles don't cover him. F/WASD always plays Zogu and Enter/arrows always plays Kovář.

**Why (play-test, 2026-09-27):**
- "Can we start the next quarter with both players not directly in front of the audience? … never let the game continue without it."
- "I tried moving Zogu with WASD and it never did anything." Zogu could not move during the audience.
- "When I pressed F it controlled Kovář." Seats were assigned by join order.
- "Send to mother for advice — who goes?" The answer is Zogu, who walks to her.
- The petitioner should step back so the bubbles do not overlap his hands.

**Architecture:**
- Rule changes are in `logic/palace-actions.ts` and `logic/turn.ts`, plus the scenario's start room.
- UI follow-ups are in `ui/menus.ts`, `ui/speech.ts`, `ui/screens.ts`, `ui/bubbles.ts`, `render/rooms/scene.ts` and `ui/controls.ts`.
- Classic text mode (no palace) is unchanged.

**Spec:** `docs/superpowers/specs/2026-09-26-diktator-design.md` §4.1 and §5.3. The controller updates the spec text in the same commit as the plan.

## Global constraints

- `npm test` must be green and `npx tsc --noEmit` clean before each commit; `npm run build` must succeed after the last task.
- Czech text goes only in `cs.ts`.
- Each commit body ends with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Tests that encode the old rule ("Zogu cannot leave during the audience", "audience first") change on purpose. Rewrite them to the new rule and list every changed test in the report. Never weaken an unrelated assertion.

---

### Task 1: The rules — Zogu starts in the study, the petitioner waits

**Files:**
- `src/games/diktator/scenario/albania/palace.ts`
- `src/games/diktator/logic/palace-actions.ts`
- `src/games/diktator/logic/turn.ts`
- `tests/diktator/helpers.ts`
- `tests/diktator/palace-actions.test.ts`
- `tests/diktator/palace.test.ts`
- every test file whose palace helper answers the audience directly (see Step 4)

- [ ] **Step 1: Start room.** In `scenario/albania/palace.ts`, set `start: { zogu: 'pracovna', velitel: 'straznice' }` and update the header comment accordingly.

- [ ] **Step 2: Rules in `palace-actions.ts`** (`applyPalaceCommand`):
  - `move`: remove the audience check. Zogu may move during the audience.
  - `talk`, `envoys`, `decide`, and `advice` with a decision: remove `if (inAudience) fail(...)`. Everything a hero can do in the day he can also do while the petitioner waits.
  - `advice` without a decision (about the petition): it requires `s.phase.kind === 'audience'` **and** `p.at.zogu === L.mother`. If Zogu is elsewhere, fail with `"advice about the petition is asked in Mother's room"`. It costs 1 hour as before.
  - `endDay`: `if (inAudience && hero === 'zogu') fail(cmd, 'the petitioner still waits in the throne room');`. The commander may end his day during the audience, as before.
  - `inAudience` stays only where it is still used. Update the function's doc comment.

- [ ] **Step 3: `palaceCommands`** becomes:

```ts
export function palaceCommands(sc: Scenario, s: GameState, hero: Hero): Command[] {
  const p = s.palace;
  const L = sc.palace;
  if (!p || !L || (s.phase.kind !== 'audience' && s.phase.kind !== 'day') || p.done[hero]) return [];
  const audience = s.phase.kind === 'audience';
  const room = p.at[hero];
  const hasHour = p.hours[hero] >= 1;
  const out: Command[] = [];
  for (const dir of exits(L, room)) out.push({ type: 'move', hero, dir });
  if (p.seal === null && room === L.study) out.push({ type: 'takeSeal', hero });
  if (p.seal === hero && p.at[other(hero)] === room && !p.done[other(hero)]) out.push({ type: 'giveSeal', hero });
  if (hero === 'zogu') {
    if (hasHour) {
      if (groupsInRoom(L, room).length > 0) out.push({ type: 'talk' });
      if (room === L.mother) {
        if (audience) out.push({ type: 'advice' });
        for (const d of availableDecisions(sc, s)) out.push({ type: 'advice', decision: d.id });
      }
      if (room === L.envoys) out.push({ type: 'envoys' });
    }
  } else if (hasHour) {
    if (factionsIn(sc, room).length > 0) out.push({ type: 'investigate' });
    if (room === L.guardroom) out.push({ type: 'policeReport', hero });
    if (room === p.at.zogu) out.push({ type: 'guard' });
  }
  if (p.seal === hero && !s.decisionTaken) {
    for (const d of availableDecisions(sc, s)) if (decisionRoom(L, d.id) === room) out.push({ type: 'decide', hero, decision: d.id });
  }
  if (!(audience && hero === 'zogu')) out.push({ type: 'endDay', hero });
  return out;
}
```

- [ ] **Step 4: Answering needs Zogu in the throne room** (`logic/turn.ts`):
  - In `advance`, `case 'audience'`, before handling the answer: `if (s.palace && s.palace.at.zogu !== sc.palace!.throne) throw new Error('answer: Zogu must stand in the throne room');`.
  - In `validCommands`' palace branch, the answers are listed only when `s.palace.at.zogu === sc.palace!.throne`: `...(s.palace.at.zogu === sc.palace!.throne ? audienceAnswers(sc, s) : [])`.
  - Update both doc comments.

- [ ] **Step 5: Tests.**
  - In `tests/diktator/helpers.ts`, add:

```ts
import { advance, newGame } from '../../src/games/diktator/logic/turn';
import type { GameState } from '../../src/games/diktator/logic/state';
import { albania } from '../../src/games/diktator/scenario/albania';

/** A new palace game with Zogu walked from his study into the throne room, the petitioner waiting. */
export function palaceAudience(seed = 4): GameState {
  return advance(albania, newGame(albania, seed, undefined, { palace: true }).state, { type: 'move', hero: 'zogu', dir: 'right' }).state;
}

/** A palace game past its first audience (answered "no"), in the day phase, Zogu in the throne room. */
export function palaceDay(seed = 4): GameState {
  return advance(albania, palaceAudience(seed), { type: 'answer', answer: 'no' }).state;
}
```

  - Every test file that builds its palace state with `newGame(…, { palace: true })` and then answers directly, or expects Zogu in `trunni` at the start, must switch to these helpers. The positions after `palaceDay()` equal the old `day()`, except that `seen` also holds `pracovna`. Find them with Grep for `palace: true` under `tests/diktator`. The expected files include palace-actions, palace-view, menus, notes, screens, speech, bubbles, scene and save; others may turn up.
  - Where a test asserts the old start (`{ zogu: 'trunni', … }`, `seen: { trunni, straznice }`), change it to the new start: `pracovna`, and `seen` `{ pracovna: true, straznice: true }`.
  - Rewrite the `describe('audience in the palace')` block in `palace-actions.test.ts` as:

```ts
describe('audience in the palace', () => {
  it('opens with Zogu in his study, free to move; the commander too', () => {
    const s = newGame(albania, 4, undefined, { palace: true }).state;
    expect(s.palace!.at).toEqual({ zogu: 'pracovna', velitel: 'straznice' });
    expect(s.phase.kind).toBe('audience');
    const r = advance(albania, s, { type: 'move', hero: 'zogu', dir: 'left' });
    expect(r.state.palace!.at.zogu).toBe('matka');
  });

  it('answering needs Zogu in the throne room', () => {
    const s = newGame(albania, 4, undefined, { palace: true }).state;
    expect(() => advance(albania, s, { type: 'answer', answer: 'no' })).toThrow();
    expect(validCommands(albania, s).some((c) => c.type === 'answer')).toBe(false);
    const there = palaceAudience();
    expect(validCommands(albania, there).some((c) => c.type === 'answer')).toBe(true);
    expect(advance(albania, there, { type: 'answer', answer: 'no' }).state.phase.kind).toBe('day');
  });

  it("Mother's advice about the petition is asked in her room and costs Zogu an hour", () => {
    const s = newGame(albania, 4, undefined, { palace: true }).state;
    expect(() => advance(albania, s, { type: 'advice' })).toThrow();
    const atMother = advance(albania, s, { type: 'move', hero: 'zogu', dir: 'left' }).state;
    const r = advance(albania, atMother, { type: 'advice' });
    expect(r.state.phase.kind).toBe('audience');
    expect(r.state.palace!.hours.zogu).toBe(2);
    expect(r.events).toEqual([{ type: 'advised', subject: 'petition', id: (s.phase as { petition: string }).petition }]);
  });

  it('Zogu cannot end his quarter while the petitioner waits; the commander can', () => {
    const s = newGame(albania, 4, undefined, { palace: true }).state;
    expect(() => advance(albania, s, { type: 'endDay', hero: 'zogu' })).toThrow();
    expect(palaceCommands(albania, s, 'zogu').some((c) => c.type === 'endDay')).toBe(false);
    const r = advance(albania, s, { type: 'endDay', hero: 'velitel' });
    expect(r.state.palace!.done.velitel).toBe(true);
    expect(r.state.phase.kind).toBe('audience');
  });

  it('a decision may be sealed before the audience', () => {
    let s = newGame(albania, 4, undefined, { palace: true }).state;
    s = advance(albania, s, { type: 'takeSeal', hero: 'zogu' }).state;
    const d = palaceCommands(albania, s, 'zogu').find((c) => c.type === 'decide');
    expect(d).toBeDefined();
    const r = advance(albania, s, d!);
    expect(r.state.decisionTaken || r.events.some((e) => e.type === 'decisionUnaffordable')).toBe(true);
    expect(r.state.phase.kind).toBe('audience');
  });
});
```

  - Replace the `palaceCommands` test "during the audience Zogu may only ask for advice…" with a new one. At the start, Zogu (in the study) gets exactly his exits, `takeSeal`, and no `endDay`. The commander's list is unchanged.
  - If a bot or playthrough test with a step cap now runs out of steps because Zogu wanders, do not raise the cap silently. Report it; making the bot prefer the throne room while an audience waits is acceptable.

- [ ] **Step 6:** Run `npm test` (green) and `npx tsc --noEmit` (clean), then commit: `feat(diktator): the petitioner waits — Zogu starts in his study and answers when he comes`.

---

### Task 2: What the players see — menus, lines, cards, petitioner position

**Files:**
- `src/shared/i18n/cs.ts`
- `src/games/diktator/ui/menus.ts`
- `src/games/diktator/ui/speech.ts`
- `src/games/diktator/ui/screens.ts`
- `src/games/diktator/ui/bubbles.ts`
- `src/games/diktator/render/rooms/scene.ts`
- the matching tests

- [ ] **Step 1: Strings** (`cs.ts`):
  - `palace.adviceAudience` becomes the function `(title: string) => \`Zeptat se matky na žádost: ${title} (1 h)\``.
  - Add `palace.petitionerWaits: (group: string) => \`V trůnním sále čeká žadatel: ${group}.\``.
  - `speech.adviceAudience` becomes `'Matko, co mám odpovědět na tu žádost?'`.

- [ ] **Step 2: `ui/menus.ts` `heroMenu`:**
  - The audience menu (title `P.audienceTitle(group)`, body with the question, the answers) is shown only when Zogu stands in the throne room during the audience. It is **not modal** any more (`modal: false`), because Zogu may leave. Its items are the answers followed by Zogu's other palace commands there (none today besides moves and possibly the seal).
  - Anywhere else during the audience, Zogu's normal room menu gets `body: [P.petitionerWaits(groupName)]` at the top, before any other body line.
  - In `itemsFor`, `advice` without a decision is labelled `P.adviceAudience(petition title)`.
  - Update the menus tests:
    - Zogu in the throne room during the audience has `modal === false`, the answers first, and no advice item.
    - Zogu in Mother's room during the audience has an item labelled `P.adviceAudience(title)`.
    - Zogu in the study during the audience has the body `[P.petitionerWaits('…')]` and no `endDay` item.

- [ ] **Step 3: `ui/screens.ts` `cardsFor`:** the quarter card's lines end with `P.petitionerWaits(groupName)` when `after.phase.kind === 'audience'`. The group is that of the petition: `petitionById(sc, after.phase.petition).from`. Add this to the screens test that checks the first quarter's card.

- [ ] **Step 4: The petitioner steps back.**
  - In `scene.ts`, draw the petitioner at x **395** instead of 330.
  - In `bubbles.ts`, the petitioner's anchor is `{ x: 395, y: head() }`, and the choice bubble's right edge is `view.petitioner ? 372 : 470`.
  - Update the bubbles tests: the petitioner anchor is 395, and the right edge is 372 in the throne room during the audience.

- [ ] **Step 5: `ui/speech.ts`:** no code change is needed, because `heroLine` reads `S.adviceAudience`. Check that the speech tests still hold and update the ones that answer from a start state so they use `palaceAudience()`.

- [ ] **Step 6:** Run `npm test` and `npx tsc --noEmit`, then commit: `feat(diktator): the audience menu waits in the throne room; Mother advises in her room; the petitioner steps back`.

---

### Task 3: Fixed keyboard seats

**Files:**
- `src/games/diktator/ui/controls.ts`
- `tests/diktator/controls.test.ts`
- `src/shared/i18n/cs.ts` (`palace.join.hint`)
- `src/games/diktator/main.ts` (only if needed)

- [ ] **Step 1: Tests.** Replace the seats tests with:

```ts
describe('seats', () => {
  it('always gives the left keyboard to Zogu and the right one to Kovář', () => {
    expect(join(NO_SEATS, 'kb-right')).toEqual({ zogu: null, velitel: 'kb-right' });
    expect(join(join(NO_SEATS, 'kb-right'), 'kb-left')).toEqual({ zogu: 'kb-left', velitel: 'kb-right' });
  });

  it('gives a gamepad the free hero, Zogu first', () => {
    expect(join(NO_SEATS, 'pad-0')).toEqual({ zogu: 'pad-0', velitel: null });
    expect(join({ zogu: 'kb-left', velitel: null }, 'pad-1')).toEqual({ zogu: 'kb-left', velitel: 'pad-1' });
    expect(join({ zogu: 'pad-0', velitel: null }, 'kb-left')).toEqual({ zogu: 'pad-0', velitel: null });
  });

  it('joins a device once and lists the seated devices', () => {
    const s = join(join(NO_SEATS, 'kb-left'), 'pad-0');
    expect(join(s, 'kb-left')).toBe(s);
    expect(seatedDevices(s)).toEqual(['kb-left', 'pad-0']);
  });

  it('one device alone steers both heroes; two players steer their own', () => {
    const solo = join(NO_SEATS, 'kb-right');
    expect(isSolo(solo)).toBe(true);
    expect(heroOf(solo, 'kb-right', 'zogu')).toBe('zogu');
    expect(heroOf(solo, 'kb-left', 'zogu')).toBeNull();
    const duo = join(solo, 'kb-left');
    expect(isSolo(duo)).toBe(false);
    expect(heroOf(duo, 'kb-left', 'velitel')).toBe('zogu');
    expect(heroOf(duo, 'kb-right', 'zogu')).toBe('velitel');
  });
});
```

  If a keyboard's own seat is taken by a gamepad, that keyboard does not join; the test above covers this.

- [ ] **Step 2: Implement:**

```ts
/** The left keyboard (F, WASD) always plays Zogu and the right one (Enter, arrows) always plays Kovář;
 * a gamepad takes the free hero, Zogu first. A device joins once. */
export function join(seats: Seats, d: DeviceId): Seats {
  if (seats.zogu === d || seats.velitel === d) return seats;
  if (d === 'kb-left') return seats.zogu === null ? { ...seats, zogu: d } : seats;
  if (d === 'kb-right') return seats.velitel === null ? { ...seats, velitel: d } : seats;
  if (seats.zogu === null) return { ...seats, zogu: d };
  if (seats.velitel === null) return { ...seats, velitel: d };
  return seats;
}

/** Exactly one device joined: it steers both heroes (Tab / Back switches). */
export function isSolo(seats: Seats): boolean {
  return (seats.zogu === null) !== (seats.velitel === null);
}

/** The hero this device steers now: its own seat, or in solo play whichever hero the player switched to. */
export function heroOf(seats: Seats, d: DeviceId, active: Hero): Hero | null {
  if (isSolo(seats)) return seats.zogu === d || seats.velitel === d ? active : null;
  if (seats.zogu === d) return 'zogu';
  if (seats.velitel === d) return 'velitel';
  return null;
}
```

- [ ] **Step 3: `main.ts`:**
  - Wherever solo play takes "the one device" from `seats.zogu`, it must use `seats.zogu ?? seats.velitel` (for example `keysFor(isSolo(seats) ? … : seats[h])`). Grep `seats.zogu` in `main.ts` and fix each spot.
  - The title's mouse fallback (`if no seats, join kb-left`) stays.

- [ ] **Step 4: `cs.ts`:** set `palace.join.hint` to `'F nebo W A S D hraje za Zogua, Enter nebo šipky za Kováře, gamepad dostane volnou postavu. Každý hráč stiskne svou Akci. Kdo hraje sám, ovládá oba — Tab / Back přepíná.'`. Keep any `clickFirst` prefix that is already there.

- [ ] **Step 5:** Run `npm test`, `npx tsc --noEmit` and `npm run build`, then commit: `feat(diktator): F plays Zogu, Enter plays Kovář — fixed keyboard seats`.
