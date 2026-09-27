# Spy vs Spy — Computer opponent (bot) design

Date: 2026-09-27
Status: approved in conversation (sections 1–4). Base `main` (rounds 1–6 merged). Later specs win.

## 0. Intent
- A computer spy for **one person on the couch** — from a child learning the game (IQ 1, clumsy and forgiving) to an
  adult wanting a real opponent (IQ 5). Like the 1984 original's computer IQ 1–5.
- **Always fair:** at every IQ the bot knows only what a player sitting at the couch could know. IQ 5 is a sharp
  player, never a cheat. If IQ 5 turns out too weak, it gets smarter, not better informed.
- **Bot vs bot** for testing game changes: in the browser as a demo, and headless as a tournament command.
- Not in scope: 2 bots against 1 human, a bot as a human's partner, network play.

## 1. Menu, screen, play
- Each side (Bílý, Černý) has a row **Hráč / Počítač**. For Počítač an **IQ 1–5** select appears, with names:
  1 nemotorný, 2 začátečník, 3 šikovný, 4 mazaný, 5 mistr špión. Shown as e.g. „Počítač · IQ 3 (šikovný)".
- A human joins a „Hráč" slot as now (their Akce, first free Hráč slot). A Počítač slot never waits. The game starts
  when every Hráč slot is taken; with two Počítač slots (bot vs bot) any key/button starts it.
- The choices are saved with the other settings (same storage and `migrateSettings` validation; invalid → Hráč).
- The split screen is unchanged. The bot's half is drawn exactly like a player's half. The strip under it names him:
  „Černý · Počítač IQ 3". His traps are invisible, as all traps are.
- Same rules, same clock, same level and Délka hry, same map cost. Pause: a human's pause pauses the whole game;
  with no human any key/button pauses. A lost gamepad pauses only if it belongs to a Hráč slot.
- Escape scene and victory unchanged whoever wins.
- **Handicap at low IQ:** the bot's spy has less health: **IQ 1 → 5, IQ 2 → 6**, IQ 3–5 → 7 (`RULES.health`).
  Recovery and respawn go up to his own maximum; the health pips show his maximum. Humans always have 7.

## 2. Architecture
- New folder `src/games/spy-vs-spy/bot/`, pure seeded logic like `logic/`: no DOM, no `Math.random`, no time source
  except the `dt` it is given. The bot has its own seeded RNG (derived from the game seed + side), never the game's
  gameplay RNG, so adding or removing a bot never changes the game's own random sequence.
- Interface: `createBot(side, iq, seed)` → `Bot`; each tick `bot.think(view, dt)` → `SpyInput` (the same
  `{ moveX, moveY, action, trap }` a controller yields). `main.ts` feeds the bot's `SpyInput` into `step` in place of a
  device. `step` and the rest of `logic/` do not know bots exist, except `Spy.maxHealth` (§1 handicap).
- Layers (each its own file, each tested on its own):
  1. **Eyes** `bot/view.ts` — `botView(state, side, glance)` builds the only data the brain ever gets.
  2. **Memory** `bot/memory.ts` — the notebook, updated from the view and from the game events the bot's spy
     would notice (his own deaths, pickups, finds).
  3. **Decision** `bot/decide.ts` — utility scores per goal, the best wins.
  4. **Route** `bot/route.ts` — shortest path over known rooms and doors.
  5. **Legs and hands** `bot/motor.ts` — a goal + route → `SpyInput`, with reaction delay and mistakes.
  6. **Fight** `bot/fight.ts` — the fight controller, used while the opponent shares his room.
  7. **IQ table** `bot/iq.ts` — every IQ-dependent number in one place (§6).

## 3. Eyes — what the bot knows
The view contains only:
- his own spy: room, position, facing, health, maximum, what he carries, stock, selected trap, clock, score,
  armoury timer, TAJNÉ slots;
- his current room: its pieces (kind, position, fixture/remedy kind for fixtures — as drawn), its doors and whether
  each is open, the exit if it is visible to him (`exitVisibleTo`);
- the opponent **only while in the same room**: position, facing, health, pose/attack wind-up (as drawn);
- his own map: rooms visited, the doors of visited rooms, the armoury room (marked for both spies);
- the big map when he opens it (paying 5 s and −70 like a player): the item dots of visited rooms;
- **a glance at the other half** (couch-fair: a human sees the bot's half too): with an IQ-dependent chance per
  second he learns the opponent's current room and what the opponent carries (TAJNÉ slots / hand).
- The view never contains: any trap's position or owner (except traps he set himself, from his own memory), what is
  hidden in furniture he has not searched, item dots without the paid map, the opponent's position outside his room
  except via a glance.
- A test walks random game states and asserts the view carries none of the forbidden data.

## 4. Memory
- Searched pieces and the outcome (empty / remedy of kind X / item he could not take / armoury closed until t).
- Items and kufřík seen via the map or a failed take (piece id → kind).
- His own traps (target and kind) — he avoids them.
- Known dangers: a piece or door where he died, with the cause; a door where he disarmed or saw a trap spring.
- Last glance at the opponent: room, time, what he carried.
- **Forgetting:** each entry has an IQ-dependent chance per minute to fade (IQ 5: never). Own traps fade too at IQ 1–2
  (he can walk into his own trap, like a child).

## 5. Decision
About 4 times a second (IQ-dependent interval) every goal gets a score; the best wins. A goal already being pursued
gets a stickiness bonus so he does not dither.

| Goal | Scores high when |
|---|---|
| Search a piece | unsearched pieces nearby, items still missing |
| Fetch a known item / kufřík | he knows where it is and can take it (one of a kind) |
| Escape | kufřík with all four kinds, exit known |
| Explore | no known target, unvisited rooms reachable |
| Set a trap | stock > 0, a good target: on the opponent's likely path (glance), by a known item room, by the exit |
| Fetch a remedy | a known danger on his route and a known source of its remedy |
| Armoury | low stock, cabinet not closed for him |
| Open the map | searched a lot, found little, clock allows (pays like a player) |
| Fight / flee | opponent in the room: fight when stronger, flee when clearly weaker (§7) |

- **Decision noise:** at low IQ a random term is added to the scores, so he sometimes picks a worse goal.
- Traps are only set on valid targets (same rules as a human, the same `refused` if not).

## 6. Route, legs, IQ
- **Route:** shortest path (BFS / Dijkstra) over rooms and doors he knows; a door or piece in his dangers costs extra,
  so he goes round it or fetches the remedy first. Unknown doors of visited rooms are explored.
- **Legs and hands:** walk to a point (x, z), face, press Akce at a piece or door, tap the trap key to cycle to the
  wanted trap, hold it for the map; all via `SpyInput`. A **reaction delay** sits between seeing and pressing.
  Low IQ adds mistakes (a wrong key now and then, overshooting a piece).
- **IQ table** (`bot/iq.ts`; IQ 2 and 4 in between, tuned by the tournament):

| | IQ 1 | IQ 3 | IQ 5 |
|---|---|---|---|
| Reaction | ~0.8 s | ~0.4 s | ~0.2 s |
| Think interval | ~0.5 s | ~0.25 s | ~0.2 s |
| Forgetting | often | a little | never |
| Decision noise | high | some | almost none |
| Traps | rarely, anywhere valid | on the opponent's likely path | near items, the exit, his path |
| Glance chance | never | now and then | often |
| Health | 5 (IQ 2: 6) | 7 | 7 |

## 7. Fighting
Rules unchanged: 7 health (bot handicap §1), recovery; jab (Akce, wind-up 0.15 s, 1 point, beaten by block),
head bash (Akce + up, wind-up 0.3 s, 2 points, beaten by duck = G + down).
- **Distance:** keeps near the edge of fight range, steps in to strike, steps back.
- **Defence:** sees the opponent's wind-up only after his reaction delay. A jab (0.15 s) is faster than any bot's
  reaction, so it is caught only by a block already held; the bash (0.3 s) can be read and ducked. Exactly the limits
  a person has.
- **Attack:** mixes jab and bash; punishes a blocked jab with a bash at higher IQ.
- **Flee:** clearly losing (e.g. his health ≤ 2 while the opponent's ≥ 4) → the nearest door; IQ 1 never flees.

| | IQ 1 | IQ 3 | IQ 5 |
|---|---|---|---|
| Ducks a bash | rarely | about half | almost always |
| Holds block early | no | sometimes | when a jab is likely |
| Punishes | no | sometimes | yes |
| Flees | no | late | in time |

## 8. Bot vs bot
- **In the browser:** both sides Počítač — a demo. Any key/button pauses; the pause menu returns to the menu.
- **Tournament:** `npm run bots -- --games 200 --iq 3v3 --level 2 [--length 1] [--seed N]` runs headless games at full
  speed (fixed `dt` = 1/60, a hard cap per game) and prints: wins White / Black / draws / time-outs, average game
  length, deaths by cause, traps set / disarmed / salvaged, armoury uses, map uses, stuck games (a spy that did not
  move for > 60 s of game time). Same seeds → same numbers.

## 9. Testing
- Eyes: the fairness test (§3); glance frequency per IQ.
- Memory: noting and forgetting per IQ; own traps remembered.
- Route: shortest path, detour round a known danger, unknown doors explored.
- Decision: the right goal in prepared states (has all → escape; no stock → armoury; known item → fetch).
- Motor: reaches a point, searches a piece, cycles to a trap kind, reaction delay honoured.
- Fight: ducks a bash at IQ 5, rarely at IQ 1; cannot react to a jab in time; flees when losing.
- Handicap: IQ 1 spy starts, recovers and respawns at 5, IQ 2 at 6; humans at 7.
- Whole games bot vs bot (a few seeds, levels 1–2): every game ends (win, draw or clock), no stuck spy, deterministic,
  IQ 5 beats IQ 1 in most games.
- Menu/settings: saved choices, invalid saved values fall back to Hráč, start rules for 0/1/2 human slots.
- Controller checks the menu and a bot game in the browser.
