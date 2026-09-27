# Diktátor — Atentát: "Najdi střelce" and the mini-game arena (design)

Date: 2026-09-27. Status: approved in conversation, awaiting written-spec review.
Parent spec: `docs/superpowers/specs/2026-09-26-diktator-design.md` (§9 "Every assassination becomes a mini-game").

## 1. Goal

Every assassination attempt in the palace game becomes a short scene the players play, instead of a hidden coin toss
that can end the game without warning (user decision, 2026-09-27). This spec covers:

- **the mini-game arena** — the shared frame all mini-games use (Atentát now; Vienna 1931, Obrana Tirany, Útěk do Řecka
  and Pochod na Tiranu later);
- **the rules change** — the evening pauses when an attempt happens and resumes with the scene's result;
- **"Najdi střelce"** (find the gunman) — the ordinary attempt, played by Vlček's player.

**Not in scope:** the Vienna 1931 scene (a later, separate spec: the walk from the opera to the car under fire), a job
for Zogu's player during the scene, painted art (placeholders use our puppets), the other mini-games.

## 2. What the players experience

1. The evening comes. A faction plotting an assassination strikes (the original rule decides that it happens).
2. The two palace halves **slide together into one big play screen** covering about 90 % of the page.
3. A card: the place and the police tip, e.g. „Tržiště v Tiraně. Tajná policie hlásí: střelec nosí **červený šátek** a
   **fes**." With no clue: „Tajná policie nic neví. Hledej toho, kdo se chová divně."
4. The scene runs: Zogu on a low platform in the middle, talking with the people (he waves, shakes hands, turns);
   a crowd of 10–20 people walks slowly in both directions; some stand (a vendor, a newspaper boy, gossiping women).
5. **Vlček searches with a magnifying glass.** Over a person, a round close-up window shows him enlarged — only there
   are the telling details clear: the hand hidden in the coat, the nervous face.
6. **Action = „To je on!"**
   - right person → Vlček rushes him, pins him down, the pistol falls out → **Zogu is saved**;
   - wrong person → the innocent protests in a bubble („Já? Já jen prodávám fíky!") and the fuse jumps forward.
7. A burning **fuse** across the top shows the time left. When it burns out, or after **three** wrong accusations, the
   gunman draws: shots, smoke — then the **original odds** decide (see §4).
8. A result card, the halves slide apart, the evening goes on (news, revolution …) or the game ends.

Zogu's player watches and helps by shouting advice; in solo play the one device steers the glass. Esc pauses.

## 3. The mini-game arena (framework)

- The palace page gets a second full-screen stage, `#arena`: one canvas with a 16:9 logical size **960 × 540**,
  fitted into ~90 % of the viewport (letterboxed, same fitting as the stage halves). The two halves and the room strip
  are hidden while the arena runs; a 0.5 s transition slides the halves toward the centre and fades the arena in (and
  the reverse afterwards).
- A mini-game implements one interface (`src/games/diktator/minigames/arena.ts`):
```ts
export interface ArenaInput { readonly moveX: number; readonly moveY: number; readonly action: boolean; }
export interface MiniGame<R> {
  /** Advance by dt seconds; `inputs` are per hero (only the heroes the game uses). */
  update(dt: number, inputs: Readonly<Partial<Record<Hero, ArenaInput>>>): void;
  render(ctx: CanvasRenderingContext2D, t: number): void;
  /** The result once the game is over (after its ending animation), else null. */
  result(): R | null;
}
```
- Each mini-game keeps its rules in a **pure, seeded simulation** module (tested in Node) and its drawing in a separate
  render module. The arena owns the canvas, the transition, pause, and the start/result cards.
- Which device steers which hero follows the palace seats (F/WASD = Zogu, Enter/arrows = Vlček, solo = the one device).

## 4. Rules change — the evening pauses for an attempt

Classic text mode (no palace) keeps the original coin unchanged. In palace mode:

- `logic/assassination.ts` splits into:
  - `attemptStrikes(s, dice): FactionId | null` — the original faction draw (one random faction; it strikes only if it
    plots an assassination);
  - `survivesUnfound(s, dice): boolean` — the original survival test for a missed gunman: fatal if all three factions
    plot an assassination; else saved if the police are friendly (`pop.policie > low`) or strong (`str.policie > low`);
    else the coin (`RULES.assassinationCoin`, or `RULES.guardedCoin` when Vlček guarded).
- In `evening`, when an attempt strikes in palace mode, the phase becomes
  `{ kind: 'attempt'; faction: FactionId; place: PlaceId; difficulty: AttemptDifficulty; seed: number }` and the
  evening stops. The rest of the evening (war, plots, news, revolution, next quarter) moves into a function that runs
  after the attempt is resolved.
- New command `{ type: 'attemptResult'; found: boolean }`, valid only in that phase:
  - `found` → event `{ type: 'assassination', faction, survived: true, foiled: true }`; the faction's plot is broken
    (`plots[faction] = none`, our addition) → the evening continues;
  - not found → `survivesUnfound` decides → event `{ type: 'assassination', faction, survived }` → death ends the game
    (`killed: assassination`), survival continues the evening.
- The phase is saved like any other; loading a save in this phase restarts the scene from its seed.

**Difficulty** (`AttemptDifficulty`, computed once when the attempt strikes, stored in the phase; constants in `rules.ts`):

| Value | Formula | Range |
|---|---|---|
| `seconds` (the fuse) | 40 + 15 if Vlček guarded − 2 × max(0, str[faction] − 5) | 25 … 60 |
| `clues` (police tip) | 0 if the police are hostile (`pop.policie ≤ low`); else 1 + (pop.policie ≥ 7) + (str.policie ≥ 7) | 0 … 3 |
| `crowd` (people) | 10 + str[faction] | 10 … 20 |
| `maxWrong` | 3 | — |

**Place** (`PlaceId`): v1 has two — `trziste` (the Tirana market: rolníci, statkáři) and `dustojnici` (the officers'
mess: armáda). The café, the mosque courtyard and others come with the art.

## 5. "Najdi střelce" — the simulation (pure, seeded)

`src/games/diktator/minigames/spot/logic.ts`, deterministic from the phase's `seed`:

- **People** have visible attributes: `hat` (none, fez, flat cap, plis, felt hat), `scarf` (none, red, blue, green,
  yellow), `coat` (one of five colours), `glasses` (bool), `bag` (bool), and a position, walking direction and speed.
  Place-specific look sets (officers in uniform with cap variants at the mess; peasants, vendors and townsfolk at the
  market).
- **The gunman** is one person. The police tip lists `clues` of his attributes (drawn from hat, scarf, glasses, bag).
  **Generator guarantee:** exactly one person matches every clue; at least two innocents share some (not all) clues as
  red herrings; with 0 clues, only behaviour tells.
- **Tells** (always present, strongest in the close-up): his hand stays in his coat (a pose), he glances around (head
  turns every few seconds), and he works his way toward Zogu (his path bends toward the platform; he arrives about when
  the fuse ends).
- **The crowd** walks between the scene's edges, turns at the ends, some stand still; Zogu moves along the platform
  between greetings.
- **The glass**: a cursor moved continuously by Vlček's input (≈ 320 units/s), clamped to the scene; the person
  "under the glass" is the nearest one whose body contains the cursor.
- **Accusing**: Action with someone under the glass → correct: outcome `found` (after a 1.5 s tackle); wrong: the
  fuse loses 6 s, `wrong += 1`, that person shows a protest bubble for 2 s; `wrong ≥ maxWrong` → outcome `missed`.
- **The fuse**: burns `seconds`; at 0 → outcome `missed` (after a 1.5 s shots animation).
- State and step: `createSpot(difficulty, place, seed)`, `stepSpot(state, dt, input)`, `accuse(state)`; the result is
  `'found' | 'missed'`.

## 6. Drawing

- `src/games/diktator/minigames/spot/render.ts` draws the place (a simple painted-style background per place: market
  stalls and a minaret, or the mess with tables and flags), Zogu on his platform, Vlček at its foot, the crowd with our
  puppets, the fuse (a rope with a spark), the glass (a gold-rimmed lens), the close-up window (top-right: the person
  under the glass at 2.5×), protest bubbles, the tackle and shots animations.
- Puppets gain accessories and a pose: scarves (colours), fez / flat cap / plis / felt hat (some exist already),
  glasses, a shoulder bag, and `handInCoat` (the forearm tucked inside the coat).
- Czech texts in `cs.diktator.atentat` (place names, the tip sentence built from clue words, the protests — several, by
  place, the result cards).

## 7. Sound

Reuse what exists: a tense crowd murmur (the unrest ambience at a fixed level) during the scene, the wooden knock for a
wrong accusation, a scuffle (a heavy knock + page rustle) for the tackle, a shot (the existing `shot` synth) and smoke.

## 8. Testing

Vitest, pure modules:
- difficulty from the game state (guard, police, plotter strength, clamps);
- place choice by faction;
- the generator guarantee over many seeds (exactly one full match; red herrings exist when clues ≥ 1);
- the gunman approaches Zogu over time;
- the fuse and the wrong-accusation limit; accusing correctly / wrongly;
- the rules: palace-mode evening stops in `attempt`; `attemptResult found` breaks the plot and continues; `missed` uses
  the original odds (all-three fatal; police; coin, guarded coin); classic mode unchanged; save/load in the phase;
  determinism from the seed; the palace bot playthrough answers `attemptResult` randomly and still finishes.

By hand in the browser: the halves merging into the arena, readability of the close-up for children, the fuse length.

## 9. Open for later

Vienna 1931 (own scene), a role for Zogu's player, painted backgrounds and part-sheet skins, more places (café, mosque
courtyard, parliament steps, a wedding in the mountains).
