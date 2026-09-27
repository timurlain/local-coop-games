# Diktátor 2d — comic dialogue and hero sounds Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every palace conversation happens in comic speech bubbles on the stage, like an old RPG: Action opens the hero's choice bubble, the hero says the chosen line, the other party answers in its bubble, and each bubble waits for Action. Each hero gets his own footsteps, door, bump sounds and a voice blip.

**Architecture:** Pure modules under `src/games/diktator/ui/`:
- `speech.ts`: what is said and by whom.
- `dialogue.ts`: each half's line queue on top of plan 2c's menu navigation.
- `bubbles.ts`: where each bubble sits on the 480 × 200 stage.
- `sounds.ts`: which sound belongs to whom.

The DOM draws the bubbles as an absolutely positioned layer over each half's canvas (`ui/dom.ts`). `main.ts` swaps the side-panel menu and notes for the dialogue. New sound recipes go into the shared `audio.ts`.

**Tech Stack:** TypeScript (strict, `noUnusedLocals`), Vite, Vitest, Canvas 2D, DOM overlays, Web Audio recipes. No runtime dependencies.

**Spec:** `docs/superpowers/specs/2026-09-26-diktator-design.md` §5.3, the paragraphs "Comic dialogue (play-test change, 2026-09-27)" and "Sounds tell the heroes apart".

**Builds on plan 2c** (`docs/superpowers/plans/2026-09-27-diktator-2c-palace-game.md`), which is complete, together with its fix wave (commit 853db64).

**Not in this plan:** NPC crowd talk poses (only the petitioner and the talking hero change pose), the dialog keys 1–5/A/N (plan 6), newspaper and playroom (plan 3).

---

## Global constraints

- `logic/` does not change.
- `ui/*.ts` except `ui/dom.ts` stay pure (no `document`/`window`), tested in Node.
- Czech text lives in `src/shared/i18n/cs.ts`.
- Canvas functions keep `save`/`restore` balanced.
- Every commit carries `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` in its body.
- `npm test` green and `npx tsc --noEmit` clean before each commit. `npm run build` must succeed after Tasks 6 and 7.

## File map

| File | Task | Responsibility |
|---|---|---|
| `src/shared/i18n/cs.ts`, `src/games/diktator/ui/speech.ts` | 1 | spoken lines; `Speaker`, `Line`; `heroLine`, `replyLines` |
| `src/games/diktator/ui/dialogue.ts` | 2 | per-half line queue + menu steering |
| `src/shared/audio.ts`, `src/games/diktator/ui/sounds.ts` | 3 | hero footsteps/doors/bumps, voice blips; mapping |
| `src/games/diktator/ui/bubbles.ts` | 4 | speaker anchors and bubble models |
| `src/games/diktator/render/rooms/scene.ts`, `stage.ts` | 5 | the talking hero takes the talk pose |
| `src/games/diktator/index.html`, `palace.css`, `ui/dom.ts` | 6 | bubble layer over the canvas; slim side panel |
| `src/games/diktator/main.ts` | 7 | wiring: dialogue instead of panel menu, sounds per hero, cards wait for talk |

---

### Task 1: Spoken lines

**Files:**
- Modify: `src/shared/i18n/cs.ts` (inside `diktator: { … }`)
- Create: `src/games/diktator/ui/speech.ts`
- Test: `tests/diktator/speech.test.ts`

- [ ] **Step 1: Add the strings**

In `cs.ts`, inside `diktator`, after the `palace: { … },` block add:

```ts
    /** Spoken lines of the comic dialogue (plan 2d). */
    speech: {
      yes: 'Ano, svoluji.',
      no: 'Ne. To nepovolím.',
      goAway: 'Odejděte!',
      suggestOther: 'Navrhněte něco jiného.',
      adviceAudience: 'Ať mi matka poradí.',
      adviceDecision: (title: string) => `Matko, co říkáš na tohle: ${title}?`,
      talk: 'Co si přejete?',
      envoys: 'Pánové, co nabízejí vaše vlády?',
      investigate: 'Kdo tu co chystá?',
      policeReport: 'Hlášení!',
      guard: 'Dnes v noci budu stát u krále.',
      takeSeal: 'Pečeť beru s sebou.',
      giveSealToKing: (address: string) => `Pečeť, ${address}.`,
      giveSealToCommander: 'Pečeť, Kováři.',
      decide: (title: string) => `Ať se stane: ${title}!`,
      endDay: 'Pro toto čtvrtletí končím.',
      thanks: (address: string) => `Děkujeme, ${address}!`,
      refused: 'To je křivda!',
      leaving: 'Tak my zase půjdeme…',
      suggested: (title: string) => `Pak tedy: ${title}?`,
      motherSends: (text: string) => `Matka vzkazuje: ${text}`,
      more: '▸',
    },
```

- [ ] **Step 2: Write the test**

Create `tests/diktator/speech.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { cs } from '../../src/shared/i18n/cs';
import { advance, newGame } from '../../src/games/diktator/logic/turn';
import type { Command, GameState } from '../../src/games/diktator/logic/state';
import { albania } from '../../src/games/diktator/scenario/albania';
import { heroLine, replyLines } from '../../src/games/diktator/ui/speech';

const T = cs.diktator;
const S = T.speech;
const P = T.palace;

function audience(): GameState {
  return newGame(albania, 4, undefined, { palace: true }).state;
}
function day(): GameState {
  return advance(albania, audience(), { type: 'answer', answer: 'no' }).state;
}
function run(s: GameState, cmd: Command, actor: 'zogu' | 'velitel') {
  const r = advance(albania, s, cmd);
  return { after: r.state, replies: replyLines(albania, s, r.state, r.events, actor) };
}

describe('heroLine', () => {
  it('says the audience answers and the room actions', () => {
    const s = audience();
    expect(heroLine(albania, s, { type: 'answer', answer: 'yes' })).toBe(S.yes);
    expect(heroLine(albania, s, { type: 'answer', answer: 'goAway' })).toBe(S.goAway);
    expect(heroLine(albania, s, { type: 'talk' })).toBe(S.talk);
    expect(heroLine(albania, s, { type: 'policeReport', hero: 'velitel' })).toBe(S.policeReport);
    expect(heroLine(albania, s, { type: 'endDay', hero: 'zogu' })).toBe(S.endDay);
  });

  it('addresses the one who receives the seal', () => {
    const s = audience();
    expect(heroLine(albania, s, { type: 'giveSeal', hero: 'velitel' })).toBe(S.giveSealToKing('Excelence'));
    expect(heroLine(albania, s, { type: 'giveSeal', hero: 'zogu' })).toBe(S.giveSealToCommander);
  });

  it('names the decision it seals, and says nothing for a move', () => {
    const d = albania.decisions[0];
    expect(heroLine(albania, audience(), { type: 'decide', decision: d.id, hero: 'zogu' })).toBe(S.decide(d.title));
    expect(heroLine(albania, audience(), { type: 'move', hero: 'zogu', dir: 'left' })).toBeNull();
  });
});

describe('replyLines', () => {
  it('lets the petitioner answer "yes" with thanks, and captions the money', () => {
    const pet = albania.petitions.find((p) => (p.effects.cost ?? 0) > 0 && (p.effects.cost ?? 0) < 100)!;
    const s = audience();
    s.phase = { kind: 'audience', petition: pet.id, suggested: false };
    const { replies } = run(s, { type: 'answer', answer: 'yes' }, 'zogu');
    expect(replies.actor[0]).toEqual({ speaker: { kind: 'petitioner' }, text: S.thanks('Excelence') });
    expect(replies.actor[1].speaker).toEqual({ kind: 'caption' });
    expect(replies.actor[1].text.startsWith('Peníze: ')).toBe(true);
  });

  it('lets the petitioner complain on "no"', () => {
    const { replies } = run(audience(), { type: 'answer', answer: 'no' }, 'zogu');
    expect(replies.actor[0]).toEqual({ speaker: { kind: 'petitioner' }, text: S.refused });
  });

  it('lets the room’s group tell its wish', () => {
    let s = day();
    for (const dir of ['down', 'left', 'left'] as const) s = advance(albania, s, { type: 'move', hero: 'zogu', dir }).state;
    const { replies } = run(s, { type: 'talk' }, 'zogu');
    expect(replies.actor).toHaveLength(1);
    expect(replies.actor[0].speaker).toEqual({ kind: 'group', group: 'armada' });
  });

  it('lets each envoy state his own offer', () => {
    let s = day();
    s = advance(albania, s, { type: 'move', hero: 'zogu', dir: 'down' }).state;
    const { replies } = run(s, { type: 'envoys' }, 'zogu');
    expect(replies.actor.map((l) => l.speaker)).toEqual([
      { kind: 'group', group: 'italie' },
      { kind: 'group', group: 'britanie' },
    ]);
  });

  it('lets the gendarme read the whole police report in one bubble', () => {
    const { replies } = run(day(), { type: 'policeReport', hero: 'velitel' }, 'velitel');
    expect(replies.actor).toHaveLength(1);
    expect(replies.actor[0].speaker).toEqual({ kind: 'group', group: 'policie' });
  });

  it('tells the other half, as a caption, that a hero has finished; the actor said it himself', () => {
    const { replies } = run(audience(), { type: 'endDay', hero: 'velitel' }, 'velitel');
    expect(replies.actor).toEqual([]);
    expect(replies.other).toEqual([P.heroDone('Kovář')]);
  });

  it('shows the seal changing hands to both halves', () => {
    let s = day();
    s = advance(albania, s, { type: 'move', hero: 'zogu', dir: 'left' }).state;
    const { replies } = run(s, { type: 'takeSeal', hero: 'zogu' }, 'zogu');
    expect(replies.actor).toEqual([{ speaker: { kind: 'caption' }, text: P.sealHolder('Zogu') }]);
    expect(replies.other).toEqual([P.sealHolder('Zogu')]);
  });
});
```

- [ ] **Step 3: Run it to see it fail**

Run: `npx vitest run tests/diktator/speech.test.ts` — FAIL (module missing).

- [ ] **Step 4: Implement `speech.ts`**

Create `src/games/diktator/ui/speech.ts`:

```ts
// The comic dialogue's words (spec §5.3, "Comic dialogue"): what a hero says when he chooses something, and who
// answers him with what. Answers reuse the notes' texts (ui/notes.ts) and add who speaks them. Pure.

import { cs } from '../../../shared/i18n/cs';
import { petitionById } from '../logic/audience';
import { decisionById } from '../logic/decision';
import { LENDERS, type GroupId } from '../logic/groups';
import { other, type Hero } from '../logic/palace';
import type { Scenario } from '../logic/scenario';
import type { Command, GameEvent, GameState } from '../logic/state';
import { moneyText } from './effects-text';
import { CORONATION_QUARTER } from './menus';
import { notesFor } from './notes';

const T = cs.diktator;
const S = T.speech;
const P = T.palace;

export type Speaker =
  | { readonly kind: 'hero'; readonly hero: Hero }
  | { readonly kind: 'petitioner' }
  /** Whoever lives in the room: the Queen Mother, the treasurer. */
  | { readonly kind: 'resident' }
  /** A room's crowd or one envoy. */
  | { readonly kind: 'group'; readonly group: GroupId }
  /** A comic's narrator box: facts nobody in the room says. */
  | { readonly kind: 'caption' };

export interface Line {
  readonly speaker: Speaker;
  readonly text: string;
}

export interface Replies {
  /** The acting hero's half: answers, in order; each waits for Action. */
  readonly actor: readonly Line[];
  /** The other half: short captions that fade on their own. */
  readonly other: readonly string[];
}

function address(s: GameState): string {
  return T.address(s.quarter >= CORONATION_QUARTER);
}

/** What the hero says aloud when he chooses `cmd`; null when he says nothing (moves). `s` is the state before. */
export function heroLine(sc: Scenario, s: GameState, cmd: Command): string | null {
  switch (cmd.type) {
    case 'answer': return S[cmd.answer];
    case 'advice': return cmd.decision === undefined ? S.adviceAudience : S.adviceDecision(decisionById(sc, cmd.decision).title);
    case 'talk': return S.talk;
    case 'envoys': return S.envoys;
    case 'investigate': return S.investigate;
    case 'policeReport': return S.policeReport;
    case 'guard': return S.guard;
    case 'takeSeal': return S.takeSeal;
    case 'giveSeal': return cmd.hero === 'velitel' ? S.giveSealToKing(address(s)) : S.giveSealToCommander;
    case 'decide': return S.decide(decisionById(sc, cmd.decision).title);
    case 'endDay': return S.endDay;
    default: return null;
  }
}

function hasMoney(e: { readonly cost?: number; readonly monthly?: number; readonly income?: number }): boolean {
  return (e.cost ?? 0) !== 0 || (e.monthly ?? 0) !== 0 || (e.income ?? 0) !== 0;
}

/** Who says an event's note in the actor's half. */
function speakerOf(sc: Scenario, after: GameState, actor: Hero, e: GameEvent): Speaker {
  switch (e.type) {
    case 'wish': return { kind: 'group', group: e.group };
    case 'advised': return after.palace && sc.palace && after.palace.at[actor] === sc.palace.mother ? { kind: 'resident' } : { kind: 'caption' };
    case 'policeReport':
    case 'policeReportRefused': return { kind: 'group', group: 'policie' };
    case 'forcedNo': return { kind: 'petitioner' };
    default: return { kind: 'caption' };
  }
}

/**
 * The answers to one command. `before`/`after` are the states around it, `events` what it produced, `actor` the hero
 * who chose it. The actor's own deeds (heroDone, guarding) are not repeated to him — he said them himself.
 */
export function replyLines(sc: Scenario, before: GameState, after: GameState, events: readonly GameEvent[], actor: Hero): Replies {
  const mine: Line[] = [];
  const theirs: string[] = [];
  for (const e of events) {
    if (e.type === 'answered') {
      if (e.answer === 'yes') {
        mine.push({ speaker: { kind: 'petitioner' }, text: S.thanks(address(before)) });
        const pet = petitionById(sc, e.id);
        if (hasMoney(pet.effects)) mine.push({ speaker: { kind: 'caption' }, text: P.money(moneyText(pet.effects, { tariff: pet.tariff })) });
      } else {
        mine.push({ speaker: { kind: 'petitioner' }, text: e.answer === 'no' ? S.refused : S.leaving });
      }
      continue;
    }
    if (e.type === 'petition' && before.phase.kind === 'audience') {
      mine.push({ speaker: { kind: 'petitioner' }, text: S.suggested(petitionById(sc, e.id).title) });
      continue;
    }
    const notes = notesFor(sc, after, e);
    if (e.type === 'envoys') {
      notes.forEach((n, i) => mine.push({ speaker: { kind: 'group', group: LENDERS[i] }, text: n.text }));
      continue;
    }
    if (e.type === 'policeReport') {
      mine.push({ speaker: speakerOf(sc, after, actor, e), text: notes.map((n) => n.text).join('\n') });
      continue;
    }
    for (const n of notes) {
      const ownDeed = (e.type === 'heroDone' || e.type === 'guarding') && (e.type === 'guarding' ? actor === 'velitel' : e.hero === actor);
      if (n.to === actor || (n.to === 'both' && !ownDeed)) {
        const sp = speakerOf(sc, after, actor, e);
        mine.push({ speaker: sp, text: e.type === 'advised' && sp.kind === 'caption' ? S.motherSends(n.text) : n.text });
      }
      if (n.to === 'both' || n.to === other(actor)) theirs.push(n.text);
    }
  }
  return { actor: mine, other: theirs };
}
```

- [ ] **Step 5: Run the test, then type-check and commit**

Run: `npx vitest run tests/diktator/speech.test.ts`. Expected: PASS.

The envoys test moves Zogu `down` from the throne room to the envoys' salon. If the rules refuse `envoys` there, report it rather than changing the test.

Then run `npm test` (green) and `npx tsc --noEmit` (clean).

```bash
git add src/shared/i18n/cs.ts src/games/diktator/ui/speech.ts tests/diktator/speech.test.ts
git commit -m "feat(diktator): spoken lines — the hero says it, the other side answers"
```

---

### Task 2: The dialogue queue

**Files:**
- Create: `src/games/diktator/ui/dialogue.ts`
- Test: `tests/diktator/dialogue.test.ts`

- [ ] **Step 1: Write the test**

Create `tests/diktator/dialogue.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { QUIET, say, speaking, steer } from '../../src/games/diktator/ui/dialogue';
import type { Line } from '../../src/games/diktator/ui/speech';

const a: Line = { speaker: { kind: 'hero', hero: 'zogu' }, text: 'Co si přejete?' };
const b: Line = { speaker: { kind: 'group', group: 'armada' }, text: 'Armáda: „Nic si nepřejeme.“' };

describe('dialogue', () => {
  it('without lines, steers the menu like plan 2c', () => {
    const r = steer(QUIET, { kind: 'action' }, 3, false);
    expect(r.d.ui).toEqual({ open: true, focus: 0 });
    expect(r.chosen).toBeNull();
    expect(r.advanced).toBe(false);
    expect(steer(QUIET, { kind: 'dir', dir: 'left' }, 3, false).pass).toEqual({ kind: 'dir', dir: 'left' });
  });

  it('say() closes the choice bubble and queues the lines', () => {
    const d = say({ ui: { open: true, focus: 2 }, queue: [] }, [a, b]);
    expect(d.ui.open).toBe(false);
    expect(d.queue).toEqual([a, b]);
    expect(speaking(d)).toEqual(a.speaker);
  });

  it('while lines wait, Action shows the next one and nothing else gets through', () => {
    const d = say(QUIET, [a, b]);
    const r1 = steer(d, { kind: 'action' }, 3, false);
    expect(r1.advanced).toBe(true);
    expect(r1.d.queue).toEqual([b]);
    expect(r1.chosen).toBeNull();
    const moved = steer(d, { kind: 'dir', dir: 'left' }, 3, false);
    expect(moved.pass).toBeNull();
    expect(moved.d).toBe(d);
    expect(steer(d, { kind: 'seal' }, 3, false).d).toBe(d);
  });

  it('Esc skips the rest of the conversation', () => {
    const r = steer(say(QUIET, [a, b]), { kind: 'close' }, 3, false);
    expect(r.d.queue).toEqual([]);
    expect(r.advanced).toBe(true);
  });

  it('keeps a modal menu’s focus while lines play', () => {
    const d = say({ ui: { open: false, focus: 1 }, queue: [] }, [a]);
    expect(d.ui).toEqual({ open: false, focus: 1 });
    expect(speaking(QUIET)).toBeNull();
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run tests/diktator/dialogue.test.ts` — FAIL.

- [ ] **Step 3: Implement `dialogue.ts`**

Create `src/games/diktator/ui/dialogue.ts`:

```ts
// One half's conversation (spec §5.3, "Comic dialogue"): the choice bubble (plan 2c's menu navigation) and the
// queue of lines that play after a choice, each waiting for Action. Pure.

import { CLOSED, navigate, type Intent, type MenuUi } from './controls';
import type { Line, Speaker } from './speech';

export interface Dialogue {
  readonly ui: MenuUi;
  /** Lines still to show; the first one is on screen. */
  readonly queue: readonly Line[];
}

export const QUIET: Dialogue = { ui: CLOSED, queue: [] };

export interface SteerResult {
  readonly d: Dialogue;
  /** A menu item was chosen (only when no line is waiting). */
  readonly chosen: number | null;
  /** An intent for the palace (arrows, the seal key) when no line waits and the menu is closed. */
  readonly pass: Intent | null;
  /** A line was dismissed (Action) or the conversation skipped (Esc). */
  readonly advanced: boolean;
}

/** Queues `lines` and closes an open (non-modal) choice bubble; a modal audience keeps its focus. */
export function say(d: Dialogue, lines: readonly Line[]): Dialogue {
  return { ui: d.ui.open ? CLOSED : d.ui, queue: [...d.queue, ...lines] };
}

/** Who is speaking now, or null when no line is up. */
export function speaking(d: Dialogue): Speaker | null {
  return d.queue[0]?.speaker ?? null;
}

/** While lines wait, Action shows the next, Esc skips the rest and nothing else gets through; otherwise the menu. */
export function steer(d: Dialogue, intent: Intent, count: number, modal: boolean): SteerResult {
  if (d.queue.length > 0) {
    if (intent.kind === 'action') return { d: { ...d, queue: d.queue.slice(1) }, chosen: null, pass: null, advanced: true };
    if (intent.kind === 'close') return { d: { ...d, queue: [] }, chosen: null, pass: null, advanced: true };
    return { d, chosen: null, pass: null, advanced: false };
  }
  const r = navigate(d.ui, intent, count, modal);
  return { d: { ...d, ui: r.ui }, chosen: r.chosen, pass: r.pass, advanced: false };
}
```

- [ ] **Step 4: Run, check, commit**

Run `npx vitest run tests/diktator/dialogue.test.ts` (PASS), `npm test` and `npx tsc --noEmit`.

```bash
git add src/games/diktator/ui/dialogue.ts tests/diktator/dialogue.test.ts
git commit -m "feat(diktator): dialogue queue — each bubble waits for Action"
```

---

### Task 3: Hero sounds and voice blips

**Files:**
- Modify: `src/shared/audio.ts` (`SfxName`, `RECIPES`)
- Create: `src/games/diktator/ui/sounds.ts`
- Test: `tests/diktator/sounds.test.ts`

- [ ] **Step 1: Write the test**

Create `tests/diktator/sounds.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { bumpSound, moveSounds, voiceOf } from '../../src/games/diktator/ui/sounds';

describe('hero sounds', () => {
  it('gives each hero his own footsteps, door and bump', () => {
    expect(moveSounds('zogu')).toEqual(['stepZogu', 'doorZogu']);
    expect(moveSounds('velitel')).toEqual(['stepKovar', 'doorKovar']);
    expect(bumpSound('zogu')).toBe('bumpZogu');
    expect(bumpSound('velitel')).toBe('bumpKovar');
  });

  it('gives every speaker a voice', () => {
    expect(voiceOf({ kind: 'hero', hero: 'zogu' })).toBe('voiceZogu');
    expect(voiceOf({ kind: 'hero', hero: 'velitel' })).toBe('voiceKovar');
    expect(voiceOf({ kind: 'resident' })).toBe('voiceMother');
    expect(voiceOf({ kind: 'petitioner' })).toBe('voiceCrowd');
    expect(voiceOf({ kind: 'group', group: 'armada' })).toBe('voiceCrowd');
    expect(voiceOf({ kind: 'group', group: 'italie' })).toBe('voiceEnvoy');
    expect(voiceOf({ kind: 'group', group: 'jugoslavie' })).toBe('voiceEnvoy');
    expect(voiceOf({ kind: 'caption' })).toBe('paper');
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run tests/diktator/sounds.test.ts` — FAIL.

- [ ] **Step 3: Add the recipes**

In `src/shared/audio.ts` extend the `SfxName` union with a new line:

```ts
  | 'stepZogu' | 'stepKovar' | 'doorZogu' | 'doorKovar' | 'bumpZogu' | 'bumpKovar'
  | 'voiceZogu' | 'voiceKovar' | 'voiceMother' | 'voiceCrowd' | 'voiceEnvoy';
```

The existing last line `| 'jingle' | 'click' | 'coins' | 'paper' | 'stamp' | 'engine';` loses its `;`, which moves to the end of the new line.

Above `const RECIPES`, add:

```ts
/** A short "voice": three syllable blips around `base` Hz, like the talking boxes of old RPGs. */
function blips(c: AudioContext, base: number, type: OscillatorType, vol: number): void {
  [1, 1.12, 0.94].forEach((k, i) => tone(c, { freq: base * k, dur: 0.06, delay: i * 0.08, type, vol }));
}
```

Inside `RECIPES` (anywhere; keep them together), add:

```ts
  /** Diktátor (plan 2d): Zogu's heavy, slow boots — two low thumps. */
  stepZogu: (c) => [0, 0.22].forEach((delay) => {
    tone(c, { freq: 90, to: 50, dur: 0.09, type: 'sine', vol: 0.3, delay });
    noise(c, { dur: 0.05, vol: 0.1, delay, lowpass: 400 });
  }),
  /** Kovář's quick steps with a spur's jingle. */
  stepKovar: (c) => {
    [0, 0.1, 0.2].forEach((delay) => noise(c, { dur: 0.03, vol: 0.08, delay, lowpass: 1200 }));
    [0.02, 0.12].forEach((delay) => tone(c, { freq: 3200, to: 2800, dur: 0.05, delay, type: 'triangle', vol: 0.05 }));
  },
  /** Zogu's door: a slow, low creak. */
  doorZogu: (c) => { tone(c, { freq: 150, to: 110, dur: 0.25, type: 'triangle', vol: 0.12, delay: 0.3 }); noise(c, { dur: 0.15, vol: 0.08, delay: 0.3, lowpass: 600 }); },
  /** Kovář's door: a quick latch. */
  doorKovar: (c) => {
    tone(c, { freq: 900, dur: 0.02, type: 'square', vol: 0.08, delay: 0.25 });
    tone(c, { freq: 600, dur: 0.03, type: 'square', vol: 0.08, delay: 0.3 });
    noise(c, { dur: 0.03, vol: 0.1, delay: 0.25, lowpass: 4000 });
  },
  bumpZogu: (c) => tone(c, { freq: 80, to: 50, dur: 0.1, type: 'sine', vol: 0.2 }),
  bumpKovar: (c) => tone(c, { freq: 160, to: 110, dur: 0.07, type: 'sine', vol: 0.15 }),
  voiceZogu: (c) => blips(c, 150, 'square', 0.06),
  voiceKovar: (c) => blips(c, 230, 'square', 0.06),
  voiceMother: (c) => blips(c, 420, 'triangle', 0.08),
  voiceCrowd: (c) => { blips(c, 180, 'sawtooth', 0.04); blips(c, 260, 'sawtooth', 0.03); },
  voiceEnvoy: (c) => blips(c, 300, 'sine', 0.08),
```

- [ ] **Step 4: Implement `sounds.ts`**

Create `src/games/diktator/ui/sounds.ts`:

```ts
// Which sound belongs to whom (spec §5.3, "Sounds tell the heroes apart"). Pure.

import type { SfxName } from '../../../shared/audio';
import type { Hero } from '../logic/palace';
import type { Speaker } from './speech';

const ENVOYS: ReadonlySet<string> = new Set(['italie', 'britanie', 'jugoslavie']);

export function moveSounds(h: Hero): SfxName[] {
  return h === 'zogu' ? ['stepZogu', 'doorZogu'] : ['stepKovar', 'doorKovar'];
}

export function bumpSound(h: Hero): SfxName {
  return h === 'zogu' ? 'bumpZogu' : 'bumpKovar';
}

export function voiceOf(sp: Speaker): SfxName {
  switch (sp.kind) {
    case 'hero': return sp.hero === 'zogu' ? 'voiceZogu' : 'voiceKovar';
    case 'resident': return 'voiceMother';
    case 'petitioner': return 'voiceCrowd';
    case 'group': return ENVOYS.has(sp.group) ? 'voiceEnvoy' : 'voiceCrowd';
    case 'caption': return 'paper';
  }
}
```

- [ ] **Step 5: Run, check, commit**

Run: `npx vitest run tests/diktator/sounds.test.ts` (PASS), `npm test` (green; the Spy vs Spy tests too), `npx tsc --noEmit`.

```bash
git add src/shared/audio.ts src/games/diktator/ui/sounds.ts tests/diktator/sounds.test.ts
git commit -m "feat(diktator): each hero sounds his own — steps, doors, bumps, voices"
```

---

### Task 4: Bubble models and anchors

**Files:**
- Create: `src/games/diktator/ui/bubbles.ts`
- Test: `tests/diktator/bubbles.test.ts`

Stage geometry (plan 2b/2c): puppets are 95 stage units tall standing on `FLOOR_Y` = 168, so a head's top is at y ≈ 73.
- The split-screen's own hero stands at x 90, the other hero at x 145 (scale 0.92).
- The petitioner stands at x 330 and the resident at x 380.
- A crowd stands across x 250–465.
- The envoys stand at x 300 + 60 × i, in the order the salon's `crowds` lists them.

- [ ] **Step 1: Write the test**

Create `tests/diktator/bubbles.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { advance, newGame } from '../../src/games/diktator/logic/turn';
import { albania } from '../../src/games/diktator/scenario/albania';
import { roomView } from '../../src/games/diktator/ui/palace-view';
import { heroMenu } from '../../src/games/diktator/ui/menus';
import { anchorFor, bubblesFor } from '../../src/games/diktator/ui/bubbles';
import { QUIET, say } from '../../src/games/diktator/ui/dialogue';

const audience = () => newGame(albania, 4, undefined, { palace: true }).state;

describe('anchorFor', () => {
  it('puts a hero’s bubble above his head, own hero in front', () => {
    const s = audience();
    s.palace!.at.velitel = 'trunni';
    const v = roomView(albania, s, 'trunni');
    expect(anchorFor({ kind: 'hero', hero: 'zogu' }, v, 'zogu')).toEqual({ x: 90, y: 69 });
    expect(anchorFor({ kind: 'hero', hero: 'velitel' }, v, 'zogu')).toEqual({ x: 145, y: 77 });
    expect(anchorFor({ kind: 'hero', hero: 'velitel' }, roomView(albania, audience(), 'trunni'), 'zogu')).toBeNull();
    expect(anchorFor({ kind: 'petitioner' }, v, 'zogu')).toEqual({ x: 330, y: 69 });
  });

  it('finds each envoy and the crowd; a group not in the room becomes a caption', () => {
    const s = audience();
    const salon = roomView(albania, s, 'vyslanci');
    const i = salon.crowds.findIndex((c) => c.group === 'britanie');
    expect(anchorFor({ kind: 'group', group: 'britanie' }, salon, 'zogu')).toEqual({ x: 300 + 60 * i, y: 69 });
    expect(anchorFor({ kind: 'group', group: 'policie' }, roomView(albania, s, 'straznice'), 'velitel')).toEqual({ x: 358, y: 69 });
    expect(anchorFor({ kind: 'group', group: 'armada' }, salon, 'zogu')).toBeNull();
    expect(anchorFor({ kind: 'caption' }, salon, 'zogu')).toBeNull();
  });
});

describe('bubblesFor', () => {
  it('shows Zogu’s audience as a choice bubble over him', () => {
    const s = audience();
    const b = bubblesFor(QUIET, [], heroMenu(albania, s, 'zogu'), roomView(albania, s, 'trunni'), 'zogu');
    expect(b).toHaveLength(1);
    expect(b[0].kind).toBe('choice');
    if (b[0].kind === 'choice') {
      expect(b[0].anchor).toEqual({ x: 90, y: 69 });
      expect(b[0].items.length).toBeGreaterThan(2);
    }
  });

  it('shows the first waiting line instead of the choice, with a "more" mark, plus the captions', () => {
    const s = audience();
    const d = say(QUIET, [
      { speaker: { kind: 'hero', hero: 'zogu' }, text: 'Ano, svoluji.' },
      { speaker: { kind: 'caption' }, text: 'Peníze: stojí 10 tis.' },
    ]);
    const b = bubblesFor(d, ['Pečeť nese Kovář.'], heroMenu(albania, s, 'zogu'), roomView(albania, s, 'trunni'), 'zogu');
    expect(b.map((x) => x.kind)).toEqual(['speech', 'caption']);
    if (b[0].kind === 'speech') expect(b[0].more).toBe(true);
    if (b[1].kind === 'caption') expect(b[1].text).toBe('Pečeť nese Kovář.');
  });

  it('shows no choice bubble for a closed, non-modal menu', () => {
    const s = advance(albania, audience(), { type: 'answer', answer: 'no' }).state;
    expect(bubblesFor(QUIET, [], heroMenu(albania, s, 'zogu'), roomView(albania, s, 'trunni'), 'zogu')).toEqual([]);
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run tests/diktator/bubbles.test.ts` — FAIL.

- [ ] **Step 3: Implement `bubbles.ts`**

Create `src/games/diktator/ui/bubbles.ts`:

```ts
// Where the comic bubbles sit on a half's stage (480 × 200 stage units) and what each shows. Pure; ui/dom.ts
// turns these into positioned elements over the canvas.

import type { Hero } from '../logic/palace';
import { CROWD_MAX_X, CROWD_MIN_X, FLOOR_Y } from '../render/rooms/crowd';
import type { Dialogue } from './dialogue';
import type { HeroMenu } from './menus';
import type { RoomView } from './palace-view';
import type { Speaker } from './speech';

/** Puppet height on stage (render/rooms/scene.ts scales every figure to 95 units). */
const FIGURE = 95;
const GAP = 4;

export interface Anchor {
  readonly x: number;
  /** Just above the speaker's head. */
  readonly y: number;
}

export type Bubble =
  | {
      readonly kind: 'choice';
      readonly anchor: Anchor;
      readonly title: string;
      readonly body: readonly string[];
      readonly items: readonly { readonly label: string; readonly detail: string }[];
      readonly focus: number;
    }
  | { readonly kind: 'speech'; readonly anchor: Anchor; readonly text: string; readonly speaker: Speaker; readonly more: boolean }
  | { readonly kind: 'caption'; readonly text: string; readonly more: boolean };

const head = (scale = 1): number => Math.round(FLOOR_Y - FIGURE * scale - GAP);

/** The point above the speaker's head in this room, or null when he is not on this stage (shown as a caption). */
export function anchorFor(sp: Speaker, view: RoomView, own: Hero): Anchor | null {
  switch (sp.kind) {
    case 'hero':
      if (!view.heroes.includes(sp.hero)) return null;
      return sp.hero === own ? { x: 90, y: head() } : { x: 145, y: head(0.92) };
    case 'petitioner':
      return view.petitioner ? { x: 330, y: head() } : null;
    case 'resident':
      return view.resident ? { x: 380, y: head() } : null;
    case 'group': {
      const i = view.crowds.findIndex((c) => c.group === sp.group);
      if (i < 0) return null;
      if (view.layout === 'envoys') return { x: 300 + 60 * i, y: head() };
      return { x: Math.round((CROWD_MIN_X + CROWD_MAX_X) / 2), y: head() };
    }
    case 'caption':
      return null;
  }
}

/**
 * The bubbles of one half, back to front: the waiting line (or else the open choice bubble), then the other half's
 * fading captions. `captions` are texts only.
 */
export function bubblesFor(d: Dialogue, captions: readonly string[], menu: HeroMenu, view: RoomView, own: Hero): Bubble[] {
  const out: Bubble[] = [];
  const line = d.queue[0];
  if (line) {
    const anchor = anchorFor(line.speaker, view, own);
    const more = d.queue.length > 1;
    out.push(anchor ? { kind: 'speech', anchor, text: line.text, speaker: line.speaker, more } : { kind: 'caption', text: line.text, more });
  } else if ((d.ui.open || menu.modal) && (menu.items.length > 0 || menu.body.length > 0)) {
    out.push({
      kind: 'choice',
      anchor: anchorFor({ kind: 'hero', hero: own }, view, own) ?? { x: 90, y: head() },
      title: menu.title,
      body: menu.body,
      items: menu.items.map((i) => ({ label: i.label, detail: i.detail })),
      focus: d.ui.focus,
    });
  }
  for (const text of captions) out.push({ kind: 'caption', text, more: false });
  return out;
}
```

- [ ] **Step 4: Run, check, commit**

Run: `npx vitest run tests/diktator/bubbles.test.ts` (PASS; if `CROWD_MIN_X`/`CROWD_MAX_X` are not 250/465 the crowd anchor differs — use the constants and fix the test's 358 to their rounded mean, reporting it), `npm test`, `npx tsc --noEmit`.

```bash
git add src/games/diktator/ui/bubbles.ts tests/diktator/bubbles.test.ts
git commit -m "feat(diktator): bubble anchors and models for the comic dialogue"
```

---

### Task 5: The talking hero takes the talk pose

**Files:**
- Modify: `src/games/diktator/render/rooms/scene.ts` (`drawHeroes`)
- Modify: `src/games/diktator/render/rooms/stage.ts` (`drawHalf`)
- Modify: `tests/diktator/scene.test.ts`

- [ ] **Step 1: Extend the smoke test**

In `tests/diktator/scene.test.ts`, inside the existing `drawHalf …` test (after the loop, before the final `expect(ctx.depth).toBe(0)`), add a call that draws a talking hero:

```ts
      drawHalf(ctx, roomView(albania, day, 'trunni'), 'zogu', null, 0.3, 'zogu');
      drawHalf(ctx, roomView(albania, day, 'trunni'), 'zogu', null, 0.3, 'velitel');
```

- [ ] **Step 2: Implement**

In `scene.ts`, give `drawHeroes` one more optional parameter at the end: `talking: Hero | null = null`.
- A hero equal to `talking` who is not walking in is drawn with `POSES.talk(t)`.
- Talking takes priority over bowing.
- Both the "others" loop and the `own` branch apply this: pose = `walking ? walk : h === talking ? talk : bowing ? bow : stand`.

In `stage.ts`, give `drawHalf` one more optional parameter at the end: `talking: Hero | null = null`. Pass it to both still `drawHeroes` calls: the one for the others inside the slide, and the one in the non-slide branch. The walking-in call does not get it.

- [ ] **Step 3: Run, check, commit**

Run: `npx vitest run tests/diktator/scene.test.ts tests/diktator/stage.test.ts` (PASS), `npm test`, `npx tsc --noEmit`.

```bash
git add src/games/diktator/render/rooms tests/diktator/scene.test.ts
git commit -m "feat(diktator): the talking hero gestures"
```

---

### Task 6: The bubble layer and a slim side panel

**Files:**
- Modify: `src/games/diktator/index.html`
- Modify: `src/games/diktator/palace.css`
- Modify: `src/games/diktator/ui/dom.ts`
- Modify: `src/shared/i18n/cs.ts` (two hint strings)

- [ ] **Step 1: HTML**

In `index.html`, in **both** halves, replace

```html
        <div class="stage-box"><canvas class="stage"></canvas></div>
        <aside class="panel">
          <div class="hud"></div>
          <h2 class="menu-title"></h2>
          <div class="menu-body"></div>
          <ol class="menu"></ol>
          <p class="hint"></p>
          <div class="notes" aria-live="polite"></div>
        </aside>
```

with

```html
        <div class="stage-box"><canvas class="stage"></canvas><div class="bubbles" aria-live="polite"></div></div>
        <aside class="panel">
          <div class="hud"></div>
          <p class="hint"></p>
        </aside>
```

- [ ] **Step 2: Strings**

In `cs.ts` `diktator.palace`, replace `hintClosed` and `hintOpen` with:

```ts
      hintClosed: 'Akce: mluvit · pohyb: jiná místnost · G / pravý Ctrl / X: pečeť',
      hintOpen: 'Nahoru a dolů vybrat · Akce říct · Esc zavřít',
      hintTalk: 'Akce: dál · Esc: přeskočit',
```

- [ ] **Step 3: CSS**

In `palace.css`:
- change `.half`'s `grid-template-columns` to `minmax(0, 1fr) minmax(170px, 16%)`;
- change `.stage-box` to `position: relative;` (keep its flex centring);
- append:

```css
.bubbles { position: absolute; inset: 0; pointer-events: none; }
.bubble {
  position: absolute; pointer-events: auto; background: #fbf6e6; color: #1a1410; border: 2px solid #1a1410;
  border-radius: 14px; padding: 0.35em 0.7em; font-family: 'Poiret One', Georgia, serif; font-weight: 700;
  line-height: 1.25; box-shadow: 2px 3px 0 rgba(0, 0, 0, 0.35); white-space: pre-line; max-width: 46%;
}
.bubble.speech::after {
  content: ''; position: absolute; bottom: -12px; left: var(--tail, 50%); width: 0; height: 0;
  border: 10px solid transparent; border-top: 12px solid #1a1410; border-bottom: 0; transform: translateX(-50%);
}
.bubble.choice { max-width: 58%; overflow-y: auto; }
.bubble.choice::before {
  content: ''; position: absolute; left: -14px; top: 22px; border: 8px solid transparent; border-right: 12px solid #1a1410; border-left: 0;
}
.bubble.choice h3 { margin: 0 0 0.2em; font-family: 'Limelight', Georgia, serif; font-weight: 400; font-size: 1em; color: #7a1f24; }
.bubble.choice p { margin: 0 0 0.3em; }
.bubble.choice ol { list-style: none; margin: 0; padding: 0; }
.bubble.choice button {
  font: inherit; color: inherit; background: transparent; border: 0; border-left: 4px solid transparent;
  padding: 0.1em 0.4em; width: 100%; text-align: left; cursor: pointer;
}
.bubble.choice button small { display: block; font-size: 0.8em; color: #6a5a40; }
.bubble.choice button.focus { border-left-color: #c8102e; background: #efe0b8; }
.bubble.caption { left: 1%; top: 2%; border-radius: 2px; background: #f3d98a; max-width: 60%; }
.bubble .more { float: right; margin-left: 0.5em; color: #c8102e; }
```

- [ ] **Step 4: DOM rendering**

In `ui/dom.ts`:
- **`HalfModel`**: replace its `menu`, `ui` and `notes` fields with `readonly talking: boolean` (a line is waiting in this half). Keep `hud`, `inactive` and `solo`.
- **`renderHalf(hero, m)`**: it takes no `onChoose` any more. It renders the HUD spans as before. The hint is `m.talking ? P.hintTalk : P.hintClosed`, plus the solo suffix as before. It no longer touches `.menu-title`, `.menu-body`, `.menu` or `.notes`; delete that code and the now-unused `menuList` parameter paths. Keep `menuList`, because the overlay still uses it.
- **New `renderBubbles`**: add it together with the types it needs. Imports: `import type { Bubble } from './bubbles';` and `import { STAGE_H, STAGE_W } from '../render/rooms/crowd';` (the latter is already imported).

```ts
/** Draws a half's comic bubbles over its canvas. Stage units are mapped onto the canvas' on-screen box. */
export function renderBubbles(hero: Hero, bubbles: readonly Bubble[], onChoose: (i: number) => void): void {
  const box = $(`#half-${hero} .stage-box`);
  const canvas = $<HTMLCanvasElement>('.stage', box);
  const layer = $('.bubbles', box);
  const cw = canvas.clientWidth;
  const ch = canvas.clientHeight;
  const ox = canvas.offsetLeft;
  const oy = canvas.offsetTop;
  const px = (x: number) => ox + (x / STAGE_W) * cw;
  const py = (y: number) => oy + (y / STAGE_H) * ch;
  layer.style.fontSize = `${Math.max(13, Math.min(26, ch * 0.075))}px`;
  layer.replaceChildren(
    ...bubbles.map((b) => {
      const el = document.createElement('div');
      el.className = `bubble ${b.kind}`;
      if (b.kind === 'caption') {
        el.style.left = `${ox + cw * 0.01}px`;
        el.style.top = `${oy + ch * 0.02}px`;
        el.textContent = b.text;
      } else if (b.kind === 'speech') {
        const left = b.anchor.x < 140 ? -0.2 : b.anchor.x > 340 ? -0.8 : -0.5;
        el.style.left = `${px(b.anchor.x)}px`;
        el.style.bottom = `${box.clientHeight - py(b.anchor.y) + 12}px`;
        el.style.transform = `translateX(${left * 100}%)`;
        el.style.setProperty('--tail', `${-left * 100}%`);
        el.textContent = b.text;
      } else {
        el.style.left = `${px(b.anchor.x + 26)}px`;
        el.style.top = `${oy + ch * 0.03}px`;
        el.style.maxHeight = `${ch * 0.94}px`;
        const h = document.createElement('h3');
        h.textContent = b.title;
        el.append(h, ...b.body.map(para));
        const ol = document.createElement('ol');
        menuList(ol, b.items, b.focus, onChoose);
        el.append(ol);
      }
      if (b.kind !== 'choice' && b.more) {
        const m = document.createElement('span');
        m.className = 'more';
        m.textContent = T.speech.more;
        el.prepend(m);
      }
      return el;
    }),
  );
}
```

Remove imports that are now unused (`MenuUi`, `HeroMenu` if nothing else uses them).

- [ ] **Step 5: Temporary compile bridge**

`main.ts` still calls the old `renderHalf` signature, and Task 7 rewires it. To keep this task compiling, change the call in `main.ts` `renderDom` to:

```ts
    renderHalf(h, { hud: heroHud(sc, s, h), talking: false, inactive: isSolo(seats) && active !== h, solo: isSolo(seats) });
```

Remove the now-unused `choosePalace` click argument there. Keep `choosePalace` itself, which the keyboard still uses. For now the menus can only be reached by keyboard; Task 7 shows them as bubbles.

- [ ] **Step 6: Check, build, commit**

Run `npm test`, `npx tsc --noEmit` and `npm run build`; all must pass.

```bash
git add src/games/diktator/index.html src/games/diktator/palace.css src/games/diktator/ui/dom.ts src/games/diktator/main.ts src/shared/i18n/cs.ts
git commit -m "feat(diktator): comic bubble layer over the stage; slim side panel"
```

---

### Task 7: Wire the dialogue into the game

**Files:**
- Modify: `src/games/diktator/main.ts`

No unit tests: the wiring is checked by hand (spec §13); the logic it uses is tested in Tasks 1–4.

- [ ] **Step 1: State**

- **Imports.** Add:
  - `import { QUIET, say, speaking, steer, type Dialogue } from './ui/dialogue';`
  - `import { heroLine, replyLines, type Line } from './ui/speech';`
  - `import { bubblesFor } from './ui/bubbles';`
  - `import { bumpSound, moveSounds, voiceOf } from './ui/sounds';`
  - `renderBubbles` in the `./ui/dom` import.

  Remove `notesFor` and `NOTES_KEPT`.
- **Constant.** Add `const CAPTION_SEC = 4;`.
- **`Half`.** Replace the interface with:

```ts
interface Half {
  dialogue: Dialogue;
  /** The other half's news, fading on their own. */
  captions: { text: string; until: number }[];
  anim: StageAnim | null;
  view: RoomView;
  menu: HeroMenu;
}
```

- **`buildHalves`.**
  - When `keep` is given, carry over `dialogue` with its focus clamped, `captions` and `anim`: `{ ...prev.dialogue, ui: clampFocus(prev.dialogue.ui, menu.items.length) }`.
  - Otherwise use `QUIET`, `[]` and `null`.
  - Delete the `ui` and `notes` fields.

- [ ] **Step 2: Playing a command speaks**

Replace `play(cmd: Command)` with `play(cmd: Command, actor: Hero | null = null)`. Everything up to and including `const next = buildHalves(…)` stays the same. Then:
- Keep the `moved` handling, but play `moveSounds(e.hero).forEach((n) => sfx.play(n))` instead of `step` and `door`.
- Keep the `stamp` and `coins` sounds.
- Delete the `notesFor` loop.
- After the events loop, before `halves = next;`, add:

```ts
  if (actor && after.quarter === before.quarter) {
    const said = heroLine(sc, before, cmd);
    const replies = replyLines(sc, before, after, events, actor);
    const lines: Line[] = [...(said ? [{ speaker: { kind: 'hero' as const, hero: actor }, text: said }] : []), ...replies.actor];
    if (lines.length > 0) {
      const wasQuiet = next[actor].dialogue.queue.length === 0;
      next[actor].dialogue = say(next[actor].dialogue, lines);
      if (wasQuiet) sfx.play(voiceOf(lines[0].speaker));
    }
    const o = other(actor);
    for (const text of replies.other) next[o].captions = [...next[o].captions, { text, until: t + CAPTION_SEC }].slice(-3);
  }
```

The shared-screen commands (flee, fight, ally, punish) keep calling `play(cmd)` without an actor. `choosePalace(hero, i)` calls `play(item.command, hero)`. The `palaceAct` branch calls `play(act.command, hero)`.

- [ ] **Step 3: Cards wait for the conversation**

Add:

```ts
/** A line is still waiting in some half: shared cards and phase screens wait until it is read. */
function someoneTalking(): boolean {
  return !!halves && HEROES.some((h) => halves![h].dialogue.queue.length > 0);
}
```

In `updateShared()`, the first line becomes `if (someoneTalking()) return false;`. In `overlayModel()`, cards and phase screens are shown only when `!someoneTalking()`. The title and pause screens are unchanged.

- [ ] **Step 4: Steering a half**

In `updatePalace`'s device loop, replace the body of `for (const intent of intentsOf(d)) { … }` with:

```ts
      const half = halves![hero];
      const talking = half.dialogue.queue.length > 0;
      if (intent.kind === 'close' && !talking && !(half.dialogue.ui.open && !half.menu.modal)) return pause(P.pause.title);
      const r = steer(half.dialogue, intent, half.menu.items.length, half.menu.modal);
      if (r.d.ui.focus !== half.dialogue.ui.focus && r.chosen === null) sfx.play('click');
      half.dialogue = r.d;
      dirty = true;
      if (r.advanced) {
        const next = speaking(half.dialogue);
        if (next) sfx.play(voiceOf(next));
        continue;
      }
      if (r.chosen !== null) {
        choosePalace(hero, r.chosen);
        if (afterCommand()) return;
        continue devices;
      }
      if (r.pass) {
        const act = palaceAct(palaceCommands(sc, state(), hero), r.pass);
        if (act?.kind === 'command') {
          play(act.command, hero);
          if (afterCommand()) return;
          continue devices;
        }
        if (act?.kind === 'bump') bump(hero, act.dir);
      }
```

In `choosePalace`, drop the line that closed `halves[hero].ui`, because `say()` closes the bubble; call `play(item.command, hero)`. In `bump()`, play `bumpSound(hero)` instead of `'bump'`.

- [ ] **Step 5: Captions fade, bubbles render, talker gestures**

- **In `update(dt)`**: after `t += dt;`, drop expired captions. For each half, filter out captions with `until <= t`, and set `dirty = true` if any were dropped.
- **In `renderDom()`**:
  - Replace the `renderHalf` call with `renderHalf(h, { hud: heroHud(sc, s, h), talking: half.dialogue.queue.length > 0, inactive: isSolo(seats) && active !== h, solo: isSolo(seats) });`.
  - Follow it with:

```ts
    renderBubbles(h, bubblesFor(half.dialogue, half.captions.map((c) => c.text), half.menu, half.view, h), (i) => {
      choosePalace(h, i);
      dirty = true;
    });
```

  Bubbles are clickable: the choice bubble's buttons choose an item. Clicking elsewhere does nothing.
- **In `render()`**:
  - Track each canvas' backing width before and after `fitStage`, and set `dirty = true` when it changed, so bubbles follow a resize.
  - Pass the talker to the stage: `const sp = speaking(halves[h].dialogue); drawHalf(ctx, halves[h].view, h, halves[h].anim, t, sp?.kind === 'hero' ? sp.hero : null);`.

- [ ] **Step 6: Check, build, commit**

Run `npx tsc --noEmit`, `npm test` and `npm run build`. Then:

```bash
git add src/games/diktator/main.ts
git commit -m "feat(diktator): palace conversations in comic bubbles, voices and hero footsteps"
```

- [ ] **Step 7: Manual check (controller)**

Open `http://localhost:5174/src/games/diktator/index.html` in the dev server, with two keyboards (F/Enter), and check each of these:
1. Zogu's audience appears as a choice bubble above him. Answering "Ano" shows "Ano, svoluji." and then the petitioner's thanks, plus a money caption if the petition costs money. Each waits for F.
2. Kovář walks with his own steps. In the guardroom, "Hlášení!" is followed by the gendarme's report bubble.
3. Zogu takes the seal in the study: his line, then the caption. In Kovář's half a caption "Pečeť nese Zogu." fades after about 4 s.
4. In the envoys' salon each envoy answers above his own head.
5. Both end the quarter: the evening card appears after the lines are read.
6. Esc during a conversation skips it. Esc with no conversation pauses the game.
