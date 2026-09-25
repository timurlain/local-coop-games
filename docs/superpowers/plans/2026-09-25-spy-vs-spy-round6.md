# Spy vs Spy Round 6 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. TDD per task: failing test → implement → pass → commit. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Implement `docs/superpowers/specs/2026-09-25-spy-vs-spy-round6-design.md`.

**Architecture:** unchanged boundaries — pure seeded logic in `src/games/spy-vs-spy/logic/` emitting events; render reads state + render-side queues; `main.ts` wires input → logic → render/audio. Spies are drawn from the 2D rig (`render/rig/`, 40×40 frames). **Tech:** TypeScript 7 strict + noUnusedLocals, Vite 8, Vitest 5. Commits end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Every task ends with `npx vitest run`, `npx tsc --noEmit`, `npm run build` clean. No servers left running.

**Worktrees:**
- Logic + HUD: `C:\Users\TomášPajonk\source\repos\timurlain\local-coop-games-round6` (branch `feat/round-6`), tasks L1 → L2 → L3 → R1 in order.
- Art: `C:\Users\TomášPajonk\source\repos\timurlain\local-coop-games-round6-art` (branch `feat/round6-art`, from `feat/round-6` after the docs commit), tasks A1 → A2, merged into `feat/round-6` before Finish.
- Never touch the main checkout or older round worktrees.

### L1: Duck on the defence key (spec §1)
Files: `logic/fight.ts` (`updateDucking`: `input.trap && input.moveY === 1` + shared room + fight range + not swinging; `updateBlocking`: `input.trap && input.moveY !== 1`), `logic/step.ts` (duck/guard immobile as now; down alone walks), `src/shared/i18n/cs.ts` (controls: „G/pravý Ctrl/X + dolů = přikrčit se"), tests in `tests/spy-vs-spy/{fight,step}.test.ts`.
- [ ] Tests: down alone in fight range walks (z changes, not ducking); trap+down ducks and stops a bash; trap alone blocks (not ducking); trap+down is not a block (a jab lands).
- [ ] Implement, run, commit `feat(spy): duck on the defence key`.

### L2: Two money, two passports, one of a kind (spec §3)
Files: `logic/rules.ts` (secret counts: `secretCopies: { klic: 1, pas: 2, penize: 2, plany: 1 }`), `logic/generator.ts` (place 6 secrets + kufřík, one secret item per room, capacity guard for every level), `logic/hand.ts` (`resolveSearch`: new outcome `alreadyHave` when the found secret's kind is already held — kufřík contents or loose in hand; hand holding a loose item taking a kufřík that contains that kind → loose item stays in the piece (swap); holding the kufřík and finding a kind it contains → `alreadyHave`), death-drop pickup path (same rule), `render/` + `main.ts` (`alreadyHave` plays the shrug + its sound), re-record the fingerprint test deliberately (comment why), tests in `tests/spy-vs-spy/{generator,hand,death,setting}.test.ts`.
- [ ] Tests: counts per level; ≤1 secret per room; every level generates (capacity); `alreadyHave` for loose/kufřík cases; kufřík swap rule; death-drop pickup rule; escape still needs all four kinds; stealing +60 unchanged.
- [ ] Implement, run, commit `feat(spy): two money and two passports, one of a kind`.

### L3: Salvage + armoury cabinet (spec §4)
Files: `logic/state.ts` (furniture kind `zbrojnice`; per-spy `armouryClosed: number` seconds; events `salvaged` {spy, trap}, `resupplied` {spy, trap}), `logic/traps.ts` or the disarm site (on `disarmed` by a spy against the opponent's trap: stock +1 of that kind), `logic/generator.ts` (exactly one `zbrojnice` per embassy on the back wall, not in the exit room, counts to ≤3 pieces; never hide anything in it), `logic/hand.ts` (search on `zbrojnice`: closed → shrug; else +1 of the fewest-stock kind, ties in cycle order, timer 60 s, event `resupplied`; hiding into it → shrug), `logic/step.ts` (tick the timers), `logic/rules.ts` (`armouryCooldown: 60`), `render/furniture/*` (period gun cabinet sprite: dark wood, glass door, crest), `render/map.ts` (small mark on its room for both spies), `main.ts` (sounds), `cs.ts` (furniture name „Zbrojní skříň"), fingerprints re-recorded, tests.
- [ ] Tests: salvage for each remedy pair, never časovaná, only for the opponent's trap; one cabinet per embassy every level, not exit room, never holds things; resupply choice + ties; per-spy 60 s timer independent; bomba/pružina on the cabinet trigger on search; determinism.
- [ ] Implement, run, commit `feat(spy): salvaged traps and the armoury cabinet`.

### R1: Missing items as silhouettes (spec §2)
Files: `render/trapulator.ts` (TAJNÉ slots: every kind always drawn; missing = greyscale at ~35 % alpha), pure helper `secretSlots(state, spy): { kind, have }[]` (tested in `tests/spy-vs-spy/render.test.ts` or a new `hud-slots.test.ts`).
- [ ] Tests for the helper (start: none had; after pickup; in kufřík; after loss).
- [ ] Implement, check in browser (controller), commit `feat(spy): missing items as silhouettes`.

### A1: Cartoon trap deaths (spec §6) — art worktree
Files: `render/effects.ts` / death drawing in `render/spy.ts`, `render/rig/*` (skeleton rendering of the rig bones; flattened frame), new sprites for the bucket and hat pieces, tests for pure phase helpers and frame determinism.
- Elektrina: falling bucket from above the door → on the head, splash, sparks, flicker figure ↔ X-ray skeleton ~1 s, buzz, smoking heap. Bomba and časovaná: soot face with blinking eyes, hat crumbles. Pružina: up to the ceiling, flattened, slides down. Pistole: BANG flag, hole in the hat, sway and fall. Lengths unchanged; angel after.
- [ ] Deliver a sheet `round6-deaths.png` (phases of each death, both colours) in the scratchpad for the controller before wiring in; then wire, commit `feat(spy): cartoon trap deaths`.

### A2: The escape scene (spec §5) — art worktree
Files: new `render/escape.ts` (pure `escapePhase(elapsed)` timeline: key/door → counter money+passport → ticket → passport control stamp → walk + board + taxi; skip), `render/airfield.ts` (counter, officer, stamp desk), `main.ts` (play before the victory, any key skips; sounds), tests for the timeline and skip.
- [ ] Deliver `round6-escape.png` (key frames) for the controller, then commit `feat(spy): the escape scene`.

### Finish
Merge `feat/round6-art` into `feat/round-6`; full test/build; controller browser check; final review (fable-advisor) of `main..feat/round-6`; build + persistent local server for the user; push/PR only when the user asks.
