# Spy vs Spy — Round 6 design (third play test)

Date: 2026-09-25
Status: approved in conversation. Base `main` (rounds 1–5 merged). Later specs win.

## 1. Fight controls: duck on the defence key
- In a shared room the Trapulator button (G / Right Ctrl / gamepad X) is defence (already: held = block with the open umbrella).
- **Duck = Trapulator button held + down** (in a shared room, opponent in fight range, not swinging). Replaces "down alone = duck". Block and duck are exclusive: with down held it is a duck, not a block.
- **Down alone always walks**, like the other directions. Walking away from the opponent is walking (round 5 fix stays).
- Ducking and blocking both keep the spy still. Help text (`cs.ts` controls) updated.

## 2. Missing items as silhouettes
- The TAJNÉ slots on the Trapulator device always show every item kind (klíč, pas, peníze, plány, kufřík): a **faded black-and-white silhouette** (greyscale, ~35 % alpha) while the spy doesn't have it, full colour once he has it (in the kufřík or in hand). Losing it fades it again. Pure helper deciding slot state per kind (tested).

## 3. Two money and two passports
- The generator places **6 secret items**: klíč ×1, pas ×2, peníze ×2, plány ×1, plus the kufřík. Still at most one secret item per room at the start; the capacity guard covers the new count for every level (level 1 3×3: 7 things ≤ 9 rooms).
- **One of a kind:** a spy who already has a kind (in the kufřík contents or as the loose item in hand) cannot take a second of it. Searching such a piece gives the `nothing`-style shrug outcome (new outcome `alreadyHave`, same animation as a shrug); the item stays hidden. Same rule when picking up from a death drop. The kufřík never holds two of one kind: a spy holding a loose item who takes a kufřík that already contains that kind leaves the loose item in the piece where the kufřík was (a swap, like hiding); a spy holding the kufřík who finds a kind it already contains shrugs (`alreadyHave`).
- Escape still needs the kufřík with one of each of the four kinds.
- Stealing (`lastHolder`, +60) unchanged.

## 4. More traps
- **Keep a disarmed trap:** disarming an opponent's trap with the right remedy (event `disarmed`) gives the disarming spy **+1 stock of that kind** (časovaná has no remedy, so never). New event field or event `salvaged` for sound/HUD blink.
- **Armoury cabinet (zbrojní skříň):** a new furniture kind, exactly **one per embassy**, in a random room that is not the exit room, on the back wall, counting towards the ≤3 pieces per room. Shown on the map (both spies) with a small mark.
  - Searching it gives **1 trap of the kind the spy has the fewest of** (ties: cycle order bomba, pružina, elektrina, pistole, časovaná), event `resupplied`. Then it is **closed for that spy for 60 s** (per-spy timer in logic); searching while closed = shrug. The other spy's timer is independent.
  - Nothing can be hidden in it (hiding there = shrug); the generator never hides a secret or remedy in it.
  - It is ordinary furniture for traps: bomba/pružina can be placed on it and trigger on search as usual.
  - Distinct look (period gun cabinet: dark wood, glass door, a crest); its own item in the furniture set.

## 5. The escape scene
- After a successful escape, before the current victory (winner laughing by the plane, loser mobbed), a **~7 s scene** without controls on the airfield strip; any key/button skips to the victory.
  1. **Klíč** flies out of the kufřík, turns in the exit door lock, the door opens.
  2. At the **ticket counter** (pokladna): **peníze** go to the clerk, **pas** is shown, a ticket comes back.
  3. At **passport control**: an officer stamps the **pas** (stamp sound).
  4. The spy walks to the plane with the kufřík (the **plány** glow/peek from it), climbs in, the plane taxis off.
- Each used item flies out of the kufřík with a small arc and its own sound. Czech captions are not needed (pictures only).
- Pure timeline helper (phase by elapsed time, skip) tested; drawn by a new `render/escape.ts`.

## 6. Cartoon trap deaths
All death animations keep their length and the angel afterwards.
- **Elektrina:** a bucket falls from above the door onto his head (stays on the head), water splashes, sparks; the spy **flickers between his figure and an X-ray skeleton** (white bones on a dark silhouette, hat and nose outline kept) for ~1 s with a buzz; then a smoking heap.
- **Bomba:** black sooty face with blinking white eyes, the hat crumbles off in pieces.
- **Pružina:** thrown up to the ceiling, flattened against it, slides down.
- **Pistole:** a "BANG" flag pops out, a hole appears in the hat, he sways and falls.
- **Časovaná:** reuses the bomba soot face.
- Skeleton and flattened frames come from the rig (skeleton = rig bones drawn as bones; flattened = scaled rig frame). Sheet for the controller before wiring in.

## 7. Testing
- Logic: duck/block mapping and down-walks; one-of-a-kind take rule (search, death drop, kufřík merge); generator counts, one-per-room and capacity for every level; salvage +1 (not časovaná); cabinet placement rules, resupply choice, per-spy 60 s timer, no hiding, traps on it; determinism.
- Render helpers: slot state, escape timeline phases and skip, death effect phase helpers.
- Controller checks sheets and in-game views in the browser.

## 8. Play-test change: items stay through a fight
- Old rule (spec §3, 1984 original): a spy entering a room where the opponent was active dropped
  everything on the spot — the selected trap was emptied (no stock refund, none was spent) and any
  secret, kufřík or remedy in hand was lost or re-hidden in furniture (`dropOnEntering`, emitting a
  `dropped` event), the same way death does.
- Play test verdict: this punished simply walking into the wrong room as hard as losing a fight,
  and cost a spy his progress even when no fight happened at all. **Carried things now stay with
  the spy through a fight.** Entering the opponent's room drops nothing: the hand (secret, kufřík,
  remedy) and the selected trap are kept, and `dropOnEntering` is gone — `step` no longer judges
  entering at all.
- While the two spies share a room (a fight), the carried thing and the selected trap are **not
  drawn** — only render, nothing logical changes. `handItems` (`render/spy.ts`) takes a `fighting`
  flag and returns `{ front: null, back: null }` for the whole fight, in both hands; once the
  shared room ends, the normal icons are drawn again immediately.
- Death is now the **only** way a `dropped` event fires: `kill` → `dropHand` (`logic/death.ts`) is
  unchanged, still re-hiding the carried thing in the nearest free furniture (or losing a remedy)
  and emitting `dropped`. The clock running out (`step.ts` `updateClock` → `dropHand`) is likewise
  unchanged.
- The HUD/Trapulator TAJNÉ slots are unaffected: they read game state directly, not the render-only
  hand icons, so they keep showing what the spy actually has, fight or not.
