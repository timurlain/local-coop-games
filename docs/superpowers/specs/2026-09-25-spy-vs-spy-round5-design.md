# Spy vs Spy — Round 5 design (second play test)

Date: 2026-09-25
Status: approved in conversation. Base `feat/round-4`. Later specs win.

## 1. Trap targets highlighted
- While a spy has a trap selected (and is not in a shared room), **every valid target in his current room** is highlighted in his own view: free furniture for bomba/pružina, doors (not a hidden exit) without a door trap for elektrina/pistole; for časovaná the floor under the spy. The one in reach gets the stronger marker (existing red marker); the others a softer pulsing outline/glow. Pure helper `placeTargetsInRoom(state, spy)` (tested).

- **Larger placement reach** (user request): a trap can be placed from a bit further away — furniture reach x 14 → 22 (and z reach 8 → 12 for wall pieces; free-standing pieces use a matching radius), door reach 6 → 10. Use the same reach for searching (one consistent "in reach" notion), keeping pieces' reach zones from overlapping each other and the doors (adjust slot spacing if needed).

## 2. Respawn elsewhere
- A defeated spy respawns (after the usual 3 s) in a **different room**: chosen with the gameplay RNG among rooms that are not the room he died in, not the opponent's current room, not the exit room; at the room centre; `enteredAt` stamped; visited set. If no such room exists, any room ≠ opponent's. The death animation/angel still plays in the room of death. Tests.

## 3. Umbrella instead of the club
- The weapon is a **long closed black umbrella** (about twice the old club's drawn length, with a crook handle and a pointed ferrule) in all fight frames (`fightStand`, `fightWalk1/2`, `swingWind`, `swingStrike`, `bashStrike`, `duck`).
- **Block** = the umbrella **snaps open in front** of the spy like a shield (new/redrawn `block` frame; black canopy seen from the side). The block spark (round 4) comes off the canopy.
- Gameplay numbers unchanged (range already doubled in round 4). Mob/victory unaffected.

## 4. Level 1 is 3×3
- Level 1 grid 3×3 (clock 5 min, stock 1/1/1/1/1 unchanged). Level 2 stays 3×3 (more traps, 6 min). Update the menu readout and tests.

## 5. At most 3 searchable pieces per room, some free-standing
- Each room has **2–3** searchable pieces (fixtures count), never more than 3 — except where capacity demands it (the generator guard must still hold; with ≤3 per room the minimum rooms × 2 ≥ fixtures + 5 things; raise the per-room minimum only where needed, like level 1 before).
- Pieces have a floor position `(x, z)`: wall pieces keep `z = 0` (back wall); **free-standing pieces** stand on the floor in the middle area (z ≈ 12–28, x away from doors and the side walls), at most **one** free-standing piece per room, in about half of the rooms. Free-standing kinds: stůl, pohovka (club armchair), glóbus, květina, trezor, kartotéka? (no — tall pieces stay on the wall). Fixtures always on the wall.
- Reach: `furnitureAt` uses distance in x and z to the piece (front edge for free-standing pieces); spies can walk around free-standing pieces (no collision needed, drawn with depth order: a piece in front of a spy covers him, behind him is covered).
- Rendering: free-standing pieces drawn via `project(x, z)`, depth-sorted together with spies and effects.
- This intentionally changes gameplay layouts per seed: re-record the fingerprint test values deliberately (explain in the commit), keep all other generator guarantees.

## 6. Spies closer to the 1984 originals
- Redraw pass comparing side by side with frames of the C64 original (https://www.youtube.com/watch?v=vIIvuPo0-Jw at 0:19, 0:50, 1:40, 11:40, 15:44) and the Mad comic look: the head+hat read as one pointed shape with the long nose, white/black body with a belted trench coat, small feet; keep the 29×36 size and all frame names/hand points.
- Redo the unreadable frames: `placeTrap` (a clear kneel, hand setting something on the floor/furniture) and `refuse1/2` (a clear head shake: same standing body, head/nose turned one way then the other, hands at the sides or raised in protest — no crossed-arm barrel shape).
- Deliver a comparison sheet (original frame crops next to ours) for the controller before committing.

## 7. Unchanged
- Furniture searched state stays unmarked (like the original).
