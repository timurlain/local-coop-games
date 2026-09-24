# Spy vs Spy — Round 3 design ("the rest of the original")

Date: 2026-09-24
Status: approved in conversation (user: "let's do the things you have in the table"; decisions below confirmed)
Base: branch `feat/round-2`. Extends the v1 and round-2 specs; where this document says otherwise, it wins.

## 1. Music
- Original composition (never the C64 tune), synthesized with WebAudio in a new `src/shared/music.ts`: a ~40 s loop in a 1930s spy-comedy style — minor key, sneaky walking bass (triangle/sine), pizzicato-like melody (short square/pulse notes), light percussion (noise ticks). Deterministic note data in code (arrays of notes/durations).
- API: `new Music(ctxProvider)`, `start()`, `stop()`, `setTempo(multiplier)`, `muted`. Uses the same AudioContext as `Sfx` (share via a small shared helper) and a separate gain node.
- Plays during the match (from the end of the title card until the result screen), pauses with the game, stops on the menu/result. **Speeds up ×1.25 when either player's clock is under 60 s.**
- Menu checkbox „Hudba" (persisted, default on), independent from „Ztlumit zvuk" (which mutes effects only).

## 2. Merged view in a shared room
- Logic records when each spy entered its current room: `spy.enteredAt` (= `state.tick` at entry; start room and respawn set it too).
- When both spies are active in the same room, the view of the spy who entered **later** (higher `enteredAt`; tie → Černý) shows a dark room area with a small centered „SOUBOJ" label; both spies (and effects) are drawn in the other half as usual. The later spy's device and under-frame strip stay visible. When the shared state ends, both halves return to normal.

## 3. Laugh on a trap death
- When a spy dies from a trap (`died` with cause ≠ `fight`), the other spy, if active, plays `laugh1/laugh2` for **1.2 s** in its own view (render-side pose override via the effects queue; movement cancels it like other poses) and the `laugh` sound plays.

## 4. Levels 1–8 and „Skrýt letiště"
- The menu's size and clock selects are replaced by **Úroveň 1–8** (persisted) with a readout („36 místností · 70 pastí · 24 min"):
  | Level | Grid | Rooms | Clock | Trap stock per spy (bomba/pružina/elektrina/pistole/časovaná) | Total traps (both) |
  |---|---|---|---|---|---|
  | 1 | 3×2 | 6 | 5 min | 1/1/1/1/1 | 10 |
  | 2 | 3×3 | 9 | 6 min | 2/2/1/1/1 | 14 |
  | 3 | 4×3 | 12 | 8 min | 2/2/2/2/1 | 18 |
  | 4 | 4×4 | 16 | 10 min | 3/3/2/2/2 | 24 |
  | 5 | 5×4 | 20 | 12 min | 3/3/3/3/2 | 28 |
  | 6 | 6×4 | 24 | 15 min | 4/4/3/3/2 | 32 |
  | 7 | 6×5 | 30 | 18 min | 5/5/4/4/2 | 40 |
  | 8 | 6×6 | 36 | 24 min | 8/8/8/8/3 | 70 |
- Fixture count formula from round 2 stays (`max(2, ceil(rooms/5))`). All generator guarantees must hold for every level (incl. the 9-things capacity guard).
- `?seed=` still works; the level is part of settings.
- **„Skrýt letiště"** checkbox (persisted, default off): when on, the exit door is not drawn, not usable and not shown on the mini-map/big map **for a spy until that spy holds the kufřík with all 4 secrets**; then it appears for that spy only (the other spy still doesn't see it).
- Mini-map/big map/layout must fit up to 6×6.

## 5. Closed doors
- All internal doors and the exit are **closed** by default. A spy standing at a door (existing `doorAt` reach) and pressing Akce **opens** it (unless a door trap is armed — then Akce places the trap as before; unless in a shared room where Akce only swings in range — opening a door is still allowed in a shared room since "doors still work").
- Opening takes **0.3 s** (spy immobile, animation), then the door stays **open for 1.5 s** for both spies (per door key), then closes. A spy can pass only through an open door; pushing into a closed door just bumps (no pass, short bump sound once per push).
- **Door traps trigger on opening** (for the spy who opens), no longer on passing. Passing an open door never triggers anything. Remedy logic unchanged.
- The exit door opens the same way; if the spy lacks the full kufřík, see §9 (guard).
- New events `doorOpened` {spy, key}, `bump` {spy}.

## 6. Satchel in hand
- A secret carried outside the kufřík is drawn as a small **white satchel** at the spy's hand point (like the kufřík). Remedies stay undrawn in hand (HUD shows them).

## 7. Score and rank
- Each spy has `score`, starting at 0, updated in logic from events:
  | Event | Points |
  |---|---|
  | Opponent killed in a fight by you | +80 |
  | Killed in a fight | −20 |
  | Trap placed | +30 |
  | Dying in a trap (any trap, incl. own) | −80 |
  | Stealing: taking a secret or the kufřík that the opponent held last | +60 |
  | Opening the map | −70 |
  | Disarming a trap with a remedy | +40 |
  | Escaping | +1000 + 5 × whole seconds left |
- "Held last": every secret/kufřík carries `lastHolder: PlayerId | null` updated when a spy takes it.
- Rank by final score: < 0 Nováček, 0–299 Agent, 300–799 Tajný agent, 800–1499 Mistr špionáže, ≥ 1500 Velmistr špionáže.
- Result screen shows both spies' score and rank (winner first; draw lists both).

## 8. Two attacks
- **Jab** = Akce (as now): wind-up 0.15 s, 1 damage, blocked by holding away (as now).
- **Head bash** = Akce while holding **up**: wind-up 0.3 s (club overhead, frame `swingWind`), then strike (new frame `bashStrike` — club coming down in front of the head), **2 damage**, **not** stopped by holding away; stopped only if the target is **ducking** (holding **down**, new frame `duck`). Same cooldown rule (0.4 s after the strike).
- A ducking spy cannot move while ducking.
- Logic: `spy.attack: 'jab' | 'bash' | null` during the swing; damage applied at strike time (end of wind-up) against the target's stance at that moment (block/duck) and range. (v1 applied damage immediately; now it's applied at the strike — update tests accordingly.)

## 9. Breadcrumbs and the airport guard
- **Breadcrumbs**: each spy keeps its last up to 9 door moves; the under-frame strip shows up to 9 small arrows pointing **the way back** (reverse direction of each move, most recent first). Hidden on levels 7–8. Reset on respawn? No — keep them (the original shows the path back to where you came from).
- **Guard**: opening the exit without the full kufřík (or while the airport is hidden for that spy) makes an airport **guard** appear in the doorway and **kick the spy back** 30 logic units into the room (0.8 s animation: guard in uniform and cap, a boot; spy tumbles), event `bounced` {spy}, a "boot" sound; replaces the „Zamčeno" message. No time penalty.

## 10. Testing
- Logic (Vitest): level table → generator sizes/clock/stock for every level with all guarantees; hidden airport visibility per spy; door open/timer/close, pass only when open, trap triggers on opening only, bump event; bash vs jab damage/blocking/ducking at strike time; score for every row + rank thresholds + lastHolder steals; breadcrumbs (cap 9, reverse dirs) and hidden on 7–8; guard bounce distance and event; enteredAt on entry/start/respawn.
- Render/pure helpers: merged-view decision (which half goes dark), breadcrumb arrow list, music scheduler note timing (pure note-to-time function), rank helper, level readout text.
- Controller verifies visuals in the browser.
