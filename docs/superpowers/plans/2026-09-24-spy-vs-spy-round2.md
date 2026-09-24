# Spy vs Spy Round 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Each task is TDD: failing test → implement → pass → commit. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Implement `docs/superpowers/specs/2026-09-24-spy-vs-spy-round2-design.md` (fixtures, shared start, meeting rules, tuning, original look with the Trapulator device and map, 1984-style spies with the club, search/hide/swap feedback).

**Architecture:** unchanged boundaries — `logic/` pure and seeded, emits events; `render/` reads state + a render-side effect queue fed from events in `main.ts`; `src/shared/` untouched except audio recipes.

**Tech:** TypeScript 7 strict (+noUnusedLocals), Vite 8, Vitest 5 (node env). Commits end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

**Worktrees:** logic + layout work in `C:\Users\TomášPajonk\source\repos\timurlain\local-coop-games-round2` (branch `feat/round-2`). Sprite work (R5) in its own worktree/branch `feat/round2-sprites`, merged into `feat/round-2` before R6. Never work in the main checkout (a dev server serves it).

Unlike the v1 plan, tasks give exact rules and test expectations instead of full code; the implementer writes the code in the existing style.

---

### R1: Tuning (spec §4)
**Files:** `logic/rules.ts`, `logic/fight.ts`, `logic/traps.ts`, `logic/step.ts`, `logic/state.ts` (spy fields), tests.
- [ ] Tests first: fuse 15 s (time bomb kills at 15 s, not 14.5); placing bomba/pruzina/elektrina/pistole/casovana reduces the placer's clock by 3 s (not when placement fails, not on unarm); health starts at 7; a spy hit at t=0 recovers to +1 at 2.5 s after the last hit and +1 every 2.5 s after, capped at max, and a new hit restarts the delay; recovery does not run while dead/out; `swingAnim` 0.35 s.
- [ ] Implement: `RULES.timeBombFuse=15`, `trapSetCost=3`, `health=7`, `regenDelay=2.5`, `regenInterval=2.5`, `swingAnim=0.35`, `swingWindup=0.15`; new spy field `sinceHit` (seconds since last hit, reset on hit and respawn) driving regen in `step`.
- [ ] Update affected v1 tests that hard-coded 4 health / 10 s (use `RULES`, not literals). All tests, tsc, build green. Commit `feat(spy): round-2 tuning - 15 s fuse, trap cost, 7 health with recovery`.

### R2: Remedy fixtures (spec §1)
**Files:** `logic/state.ts` (FurnitureKind + `FIXTURE_REMEDY` map), `logic/themes.ts` (remove `vesak` from pools), `logic/generator.ts`, `render/room.ts` (draw `hasicak`, `naradi`, `lekarnicka`; `vesak` shows a hanging umbrella), tests.
- [ ] Tests first over 3 sizes × many seeds: fixture count per kind = `max(2, ceil(rooms/5))`; every fixture has `source === FIXTURE_REMEDY[kind]` and every source is a fixture; fixtures of one kind are in distinct rooms (when rooms ≥ count); no secret/kufřík in a fixture at start; 2–4 pieces per room still holds; all v1 generator guarantees still hold; determinism by seed.
- [ ] Implement: after furniture is placed, convert randomly chosen ordinary pieces into fixtures (distinct rooms per kind), then place secrets/kufřík in non-fixtures. Keep theme furniture pools otherwise.
- [ ] Draw fixtures in `drawFurniture` (procedural, same style; hasičská skříňka red with window, bedna na nářadí with handle, lékárnička white + red cross, věšák with a visible umbrella). Commit `feat(spy): remedies live in fixed fixtures`.

### R3: Shared start and meeting rules (spec §2, §3)
**Files:** `logic/generator.ts`, `logic/movement.ts`, `logic/interact.ts`, `logic/step.ts`, `logic/traps.ts` (unarm returns stock), `logic/death.ts` (reuse dropHand), `logic/state.ts` (event `dropped`), tests.
- [ ] Tests first: both spies start in the same room, never the exit room, x 40/160, facing each other; entering a room with an active opponent → armed trap cleared and stock restored, remedy lost, secret/kufřík re-hidden in that room, `dropped` event; entering an empty room or a room with a dead/out opponent → no drop; respawn in the opponent's room → no drop; in a shared room: Akce out of range does nothing (no search/hide/trap place), Trapulator input ignored (menu stays closed), search already running completes; after the opponent leaves, search works again.
- [ ] Implement a helper `sharesRoom(state, spy)` (active opponent in same room) and use it in `updateNormal`/`updateAction`. Commit `feat(spy): shared start and meeting rules`.

### R4: Map cost and outcome events (spec §5 map, §7)
**Files:** `logic/state.ts` (events `swapped`, `stored`, `dropped` if not done, `mapOpened`; spy field `mapOpen`), `logic/hand.ts` (`resolveSearch` returns an outcome kind: `nothing | took | stored | swapped | putBack`), `logic/interact.ts`, `logic/traps.ts` (menu cursor 0–5, index 5 = MAPA), `logic/step.ts`, tests.
- [ ] Tests first: `resolveSearch` outcome for every row of v1 §3.3 table + sources; interact emits `found`/`swapped`/`stored` accordingly; hold onto an occupied piece → `swapped`; Trapulator cursor wraps over 6 entries; Akce on MAPA sets `mapOpen=true`, costs 5 s once, emits `mapOpened`; releasing the Trapulator button closes the map (`mapOpen=false`); map can't open in a shared room (R3 rule).
- [ ] Implement. Update HUD/Trapulator render minimally so it still compiles (full redesign is R6). Commit `feat(spy): map button with time cost; search outcome events`.

### R5: 1984-style spies (spec §6) — in worktree `feat/round2-sprites`
**Files:** `render/sprite-data.ts`, `render/sprites.ts`, `render/spy.ts`, `render/victory.ts`, `tests/spy-vs-spy/render.test.ts`.
- [ ] Study reference frames first (built-in browser, timestamps in spec §6; screenshot the frames).
- [ ] Tests first: every frame rectangular, palette-only, same size; body centre = image centre column; `SPY_HANDS` (+ `SPY_CLUB` where the club is drawn) on drawn pixels; exact frame set of spec §6.
- [ ] Draw the frames; wire `spy.ts`: in a shared room use `fightStand`/`swingWind`/`swingStrike`/`block`; searching uses `searchDig1/2`; keep deaths/angel; victory uses walk + laugh. The effect-driven frames (`hidePut`, `shrug`, `liftFind`) are exported for R7.
- [ ] Controller reviews visually in the browser and iterates before commit. Commit `feat(spy): spies in the style of the 1984 originals`.

### R6: The original look — frame, Trapulator device, map view (spec §5)
**Files:** `render/geometry.ts` (rescaled `VIEW`, layout rects), `render/room.ts`, `render/decor.ts`, `render/hud.ts` → split into `render/trapulator.ts` + `render/hud.ts` (under-frame strip), new `render/map.ts`, `render/view.ts`, `render/sprite-data.ts` (redrawn icons), `shared/audio.ts` (low-time beep), `main.ts` (low-time beep), tests.
- [ ] Tests first (pure helpers): layout rectangles (frame, room view, under-frame strip, Trapulator, its buttons/slots) lie within 320×100 and don't overlap; `formatLed(seconds)` → `M:SS:hh`; map cell layout fits the map area for all 3 sizes; `project()` corners match the new `VIEW`.
- [ ] Implement per spec §5 incl. colour coding, flashing loose secret, remedy→trap hint, toast (1.5 s) under the frame, low-time blink + beep, map view while held (dots only in visited rooms holding a secret/kufřík). Remove the old mini-map.
- [ ] Controller reviews visually; iterate. Commit(s) `feat(spy): original-style frame and Trapulator device`, `feat(spy): map view`.

### R7: Search/hide/swap feedback and club presence (spec §6, §7)
**Files:** new `render/effects.ts` (render-side effect queue: spawn from events, update by time, draw per viewport), `render/view.ts`, `render/spy.ts`, `main.ts` (route events → effects + sounds), `shared/audio.ts` (sounds: found, nothing/womp, hide thud, swap whoosh, drop clatter), tests for the pure effect queue (spawn/expire timing, which effect per event).
- [ ] Implement the table in spec §7; effects are visible in both halves when the viewer is in that room; `dropped` flies to the furniture that received the item (logic event carries the furniture id).
- [ ] Controller reviews visually; iterate. Commit `feat(spy): search, hide and swap feedback`.

### R8: Finish
- [ ] Full `npm test`, `npm run build`; controller smoke test in the browser; final Fable review of `feat/room-themes..feat/round-2`; push and update PR #1 (or a new PR) — ask the user first.
