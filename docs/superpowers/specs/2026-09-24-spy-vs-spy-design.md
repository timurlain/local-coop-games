# Spy vs Spy (local co-op collection, game #1) — Design

Date: 2026-09-24
Status: approved in brainstorming, awaiting spec review

## 1. Context & goals

`local-coop-games` is a collection of small, browser-launchable games for 2+ players on one computer (couch play). The first game recreates **Spy vs Spy** (First Star Software, 1984, C64/NES): two spies in a split screen race through an embassy, collecting secret items and trapping each other.

Goals for v1:

- Faithful to the original's mechanics and difficulty. **Do not descale difficulty** for kids.
- Audience: family (kids + adults). **Czech UI.**
- 2 players versus, one screen, keyboard and/or gamepads.
- Playable from a single URL (GitHub Pages), launcher page lists the games.
- Shared foundation (input, loop, split screen, audio, i18n) reusable by future games.

Out of scope for v1: computer opponent, more than 2 players, online play, key remapping, touch/mobile controls.

## 2. Architecture

Tech: **TypeScript + plain Canvas 2D + Vite** (multi-page build), **Vitest** for tests, deployed to **GitHub Pages** via GitHub Actions. No game engine, no runtime dependencies.

```
local-coop-games/
├─ index.html                     launcher: game cards → link to game page
├─ src/
│  ├─ shared/
│  │  ├─ input/                   keyboard + Gamepad API → per-player actions
│  │  ├─ loop.ts                  fixed-timestep update (60 Hz) + rAF render
│  │  ├─ splitscreen.ts           viewports on one canvas, integer scaling
│  │  ├─ audio.ts                 WebAudio synthesized SFX, mute toggle
│  │  ├─ rng.ts                   seeded PRNG
│  │  ├─ storage.ts               localStorage wrapper (try/catch, optional)
│  │  └─ i18n/cs.ts               Czech strings
│  └─ games/spy-vs-spy/
│     ├─ index.html
│     ├─ logic/                   PURE TS — no DOM, no canvas, no timers
│     │  ├─ rules.ts              all tunable numbers
│     │  ├─ state.ts              types: GameState, Spy, Room, Furniture, Item…
│     │  ├─ generator.ts          seeded embassy generation
│     │  ├─ step.ts               step(state, actions, dt) → state
│     │  └─ (hand.ts, traps.ts, fight.ts, clock.ts as needed)
│     ├─ render/                  canvas drawing: rooms, sprites, HUD, Trapulator
│     │  └─ sprites/              pixel-string sprite definitions + palette
│     └─ main.ts                  wiring: input → logic → render, screens
├─ tests/                         Vitest, logic only
└─ .github/workflows/pages.yml
```

### Boundaries (hard rules)

- `logic/` never imports DOM, canvas, audio or `Math.random`. Randomness comes from `rng.ts` seeded from the game seed. Same seed + same action sequence ⇒ same result.
- `logic/` emits **events** (e.g. `trapTriggered`, `itemTaken`, `spyDied`) in the step result; `main.ts` routes them to audio and render effects. Logic never calls audio.
- Input produces abstract `PlayerActions` per player slot; nothing downstream knows about keys or pads. Adding player 3 later = new slot binding.
- Render reads state, never mutates it.

### Data flow per tick

`devices → PlayerActions[2] → step(state, actions, dt) → {state, events} → render(state) per viewport; events → audio/effects`

`PlayerActions` = `{ moveX: -1|0|1, moveY: -1|0|1, action: pressed/held/released, trap: held, pause: pressed }`.

## 3. Gameplay rules

All numbers below are defaults in `rules.ts`.

### 3.1 Embassy

- Grid of rooms generated from a seed. Size from menu: **Malá 3×3, Střední 4×3 (default), Velká 5×4**.
- Each room has up to 4 doors: **north** (back wall), **east/west** (side walls), **south** (front floor edge). The grid is fully connected; the generator may remove some internal doors but must keep every room reachable.
- Each room has **2–4 furniture** pieces from: stůl, knihovna, lampa, pohovka, trezor, obraz, skříň, věšák.
- Exactly one room on the grid edge contains the **airport exit door** (plane sign), on an outward-facing wall.
- Spies start in opposite corners of the grid.

### 3.2 Objects

- **Secrets (4):** Klíč, Peníze, Pas, Tajné plány.
- **Kufřík (1):** container for secrets.
- **Remedies (4):** Kbelík vody, Kleště, Deštník, Nůžky. Each has exactly one **source furniture** somewhere in the embassy (distinct pieces). A source is infinite: taking a remedy does not empty it.
- Secrets and kufřík are hidden in random distinct furniture, never in a remedy source.
- A furniture piece holds **at most one** thing (secret, kufřík, or a hidden remedy). A remedy source counts as holding its remedy.

### 3.3 Hand & search (swap rule)

Each spy has **one hand slot**. Akce at furniture:

- **Tap** (released < 0.4 s) = **Hledat** (search). Takes **0.5 s** (animation, spy immobile).
- **Hold** (≥ 0.4 s) = **Schovat** (hide): only if the hand is non-empty and the furniture has no hidden thing; the hand item is hidden there, hand becomes empty. Otherwise hold behaves as a tap.

Search result by case (rows are exclusive, checked top to bottom):

| Hand | Furniture holds | Result |
|---|---|---|
| any | nothing | nothing found |
| empty | Y | take Y; furniture empty |
| kufřík | secret | secret goes into kufřík; furniture empty |
| secret | kufřík | take kufřík, held secret goes into it; furniture empty |
| X | Y (any other combination) | **swap**: take Y, X hidden in that furniture |

**Remedy sources** are special: the remedy is infinite and does not occupy the furniture's single hidden-thing slot. A source can hold its remedy **and** one hidden thing.

- Searching a source: if it has a hidden thing, apply the table to that thing. Otherwise take the remedy, swapping the hand item into the hidden-thing slot if the hand was non-empty.
- Searching a source while holding its own remedy: the remedy is put back, hand empty.

### 3.4 Trapulator & traps

- Holding the Trapulator button opens the menu over that player's half. **The spy cannot move while it is open** (vulnerable). Left/right selects a trap, Akce arms it, releasing the button closes the menu.
- An armed trap is placed by pressing Akce at a furniture piece or door (context decides valid targets). The time bomb is placed immediately where the spy stands.
- Stock per trap type per spy: **3** each, time bomb **2**. Shown in the menu.
- One trap per furniture/door. Setting on an occupied target fails (no stock spent).

| Trap | Target | Remedy | Death sprite |
|---|---|---|---|
| Bomba | furniture | Kbelík vody | sooty |
| Pružina | furniture | Kleště | launched off-screen |
| Kbelík s elektrickou vodou | door | Deštník | soaked + zapped |
| Pistole na provázku | door | Nůžky | shot, "BANG" flag |
| Časovaná bomba | room | none | sooty |

- Furniture traps trigger on **search**; door traps trigger when a spy **walks through** the door.
- Traps affect **both spies, including the owner**. No visual marker of traps on either screen (debug overlay excepted).
- Holding the matching remedy when triggering: trap removed, remedy consumed (hand empty), no death.
- Time bomb: explodes **10 s** after placement, killing every spy in that room at that moment.

### 3.5 Death & respawn

- Death animation plays, angel floats up. The spy **loses 30 s** from their clock.
- Respawn in the same room after **3 s**, at the room's entry point.
- The hand item (and kufřík with contents) is re-hidden in a random furniture of that room that holds nothing; if none is free, in the nearest room with a free furniture piece.

### 3.6 Fight

- When both spies are in the same room, Akce near the opponent (≤ 24 px horizontal, ≤ 8 px depth) swings the club instead of searching.
- Holding the direction away from the opponent = **block** (hit absorbed).
- Hit: 1 damage, short knockback. Health: **4** per life, reset on respawn. 0 health = death (§3.5).
- Swing cooldown **0.4 s**.

### 3.7 Clock & win

- Each spy has their own clock, default **8 min** (menu: 5 / 8 / 12). It runs only while the game is not paused.
- Clock reaches 0 ⇒ that spy is out (removed). If the other spy is still in, they keep playing to escape; if their clock also runs out ⇒ **remíza**.
- **Win:** walk through the airport exit door holding the kufřík with **all 4 secrets**. Walking through without it: the door does not open (shows "Zamčeno" briefly).

## 4. Controls

Bindings use `KeyboardEvent.code` (physical keys), so Czech layout works.

| Action | Bílý (top) | Černý (bottom) | Gamepad (standard mapping) |
|---|---|---|---|
| Move | W A S D | Arrow keys | left stick / D-pad |
| Akce | F | Enter | A (button 0) |
| Trapulator (hold) | G | ShiftRight | X (button 2) |
| Block | hold away from opponent | same | same |
| Pauza | Escape | Escape | Start (button 9) |

- Menu join: each slot is claimed by the first Akce press from a device (keyboard half or gamepad). Any combination works.
- Known limitation: keyboard ghosting with two players on one keyboard; gamepads recommended.

## 5. Presentation

- Logical resolution **320×200**, scaled by the largest integer that fits the window, `imageSmoothingEnabled = false`. Below ×2 ⇒ overlay "Zvětši okno".
- Layout: top half = Bílý's room view + HUD strip, bottom half = Černý's.
- Room view: front perspective — back wall, trapezoid floor, side walls with doors, south door at floor edge, furniture along back and side walls. Spies move in 2D on the floor (x, depth); drawn ordered by depth.
- Both spies are drawn in any view showing the room they share.
- HUD per player: clock (mm:ss), hand item icon, kufřík contents (4 slots), mini-map of visited rooms with current room marked. Opponent is **not** shown on the mini-map.
- Sprites: pixel strings in TS + shared palette. Frames: idle, walk (4), search, swing, block, 4 deaths, angel. Spies are white and black with pointy noses.
- Trapulator: a small panel in the player's half with 5 trap icons and stock counts.
- Screens: Launcher → Menu (size, clock, join, mute) → Game → Pause → Result (winner, time left) → Odveta / Menu.

## 6. Audio

WebAudio synthesized SFX, no audio files: step, search, trap set, bomb, splash/zap, boing, shot, club hit, block, time-bomb tick, win jingle. Audio context starts on the first user input (browser autoplay policy). Mute toggle persisted.

## 7. Robustness

- Gamepad disconnected mid-game ⇒ auto-pause, "Ovladač odpojen".
- Window loses focus ⇒ auto-pause.
- `localStorage` optional: all access in try/catch; defaults used when unavailable.
- `?seed=<n>` URL param fixes the embassy seed; otherwise random seed shown on the result screen.
- **F1** toggles a debug overlay: seed, trap and item positions, FPS.

## 8. Testing

Vitest over `logic/` only, deterministic via seed.

- **Generator:** all rooms reachable; each furniture holds ≤ 1 hidden thing (sources: remedy + ≤ 1); 4 secrets + kufřík + 4 remedy sources placed in distinct furniture; exactly one exit on an edge wall; spies start in opposite corners; same seed ⇒ identical embassy (for all 3 sizes, many seeds).
- **Hand/search:** one test per row of the §3.3 table, plus remedy-source cases.
- **Traps:** each trap × correct remedy (disarm), × wrong/no remedy (death); owner triggers own trap; time bomb kills all spies in room after 10 s and nobody outside; occupied target rejects; stock decrements.
- **Death:** −30 s, respawn after 3 s, hand item re-hidden in that room (and fallback).
- **Fight:** hit range, block, cooldown, 4 hits ⇒ death.
- **Clock & win:** timeout removes spy; both timeouts ⇒ remíza; exit without full kufřík stays shut; with full kufřík ⇒ win.
- Render/input/audio: manual play checklist in the implementation plan.

## 9. Deployment

- `npm run dev` for development, `npm run build` produces static multi-page output with relative base.
- GitHub Actions workflow builds on push to `main` and deploys to GitHub Pages.
- Repo: new GitHub repository (hobby work tracked in GitHub Issues).
