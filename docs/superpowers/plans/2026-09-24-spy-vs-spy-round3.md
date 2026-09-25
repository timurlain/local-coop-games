# Spy vs Spy Round 3 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. TDD per task: failing test → implement → pass → commit. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Implement `docs/superpowers/specs/2026-09-24-spy-vs-spy-round3-design.md`.

**Architecture:** unchanged boundaries (pure seeded logic emitting events; render reads state + render-side queues; shared layer reusable). **Tech:** TypeScript 7 strict + noUnusedLocals, Vite 8, Vitest 5. Commits end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

**Worktrees:** main work in `C:\Users\TomášPajonk\source\repos\timurlain\local-coop-games-round3` (branch `feat/round-3`). Music (M1) in its own worktree `...-round3-music` (branch `feat/round3-music`), merged before V1. Never touch `...\local-coop-games-round2` (the user's morning test build is served from it) or the main checkout.

### M1: Music (spec §1) — parallel worktree
Files: `src/shared/music.ts` (new), `src/shared/audio.ts` (share the AudioContext), `src/games/spy-vs-spy/main.ts` (start/stop/tempo/pause), game `index.html` (+ „Hudba" checkbox), `src/shared/i18n/cs.ts`, tests for the pure note-to-time scheduler and loop length.

### L1: Levels 1–8 + hidden airport (spec §4)
Files: `logic/rules.ts` (level table replaces sizes/clockOptions for the menu; keep `RULES.sizes` only if still used), `logic/generator.ts` (`createGame(seed, level, opts)`), `logic/state.ts` (`hideAirport`, per-spy exit visibility helper), `logic/movement.ts`/`places.ts` (exit unusable while hidden for that spy), `render/map.ts` + `render/room.ts` (hide exit per viewer), `render/layout.ts` (fit 6×6), `main.ts` + game `index.html` + cs.ts (Úroveň select + readout + „Skrýt letiště"), tests.

### L2: Closed doors (spec §5)
Files: `logic/state.ts` (door open timers per key, events `doorOpened`, `bump`), `logic/interact.ts` (Akce at a door opens unless armed door trap), `logic/movement.ts` (pass only if open; bump), `logic/traps.ts` (door traps trigger on opening), `logic/step.ts` (door timers, opening 0.3 s immobile), `render/room.ts` (open/closed door drawing + opening anim), `main.ts` sounds, tests. Update existing door/exit tests to open doors first (add a test helper `openDoor`).

### L3: Two attacks (spec §8)
Files: `logic/fight.ts` (jab/bash, damage at strike time, duck), `logic/state.ts` (`attack`, `ducking`), `logic/step.ts`, `render/sprite-data.ts` (+`bashStrike`, `duck` frames, 29×36, same palettes/rules; hand points), `render/spy.ts` (`pickFrame`), tests (fight + render sprite tests).

### L4: Score and rank (spec §7)
Files: `logic/state.ts` (`score`, `lastHolder` on secret/kufřík things), `logic/score.ts` (new: pure event → score deltas + rank helper), `logic/step.ts` (apply after events), `logic/hand.ts` (set lastHolder on take), main.ts + result overlay in game `index.html` (both scores + ranks), cs.ts, tests for every table row and rank thresholds.

### L5: Breadcrumbs + airport guard (spec §9)
Files: `logic/state.ts` (`trail: Dir[]` max 9, event `bounced`), `logic/movement.ts` (record moves; exit refusal → bounce 30 units, 0.8 s immobile), `render/hud.ts` (arrow strip; hidden on levels 7–8), `render/effects.ts` or new `render/guard.ts` (guard + boot animation), main.ts sound 'boot', tests.

### V1: Merged view, trap laugh, satchel (spec §2, §3, §6)
Files: `logic/state.ts` + movement/death/generator (`enteredAt` on entry/start/respawn), `render/view.ts` (dark half with „SOUBOJ" for the later arrival — pure helper `darkHalf(state, viewerId)` tested), `render/effects.ts` (laugh pose on trap death for the other spy, 1.2 s) + main.ts sound, `render/sprites.ts`/`spy.ts` (satchel at hand for a loose secret; add a `satchel` icon to sprite-data), tests.

### Finish
Merge M1; full test/build; controller browser check of every feature; final Fable review of `feat/round-2..feat/round-3`; then ask the user before pushing/PR.
