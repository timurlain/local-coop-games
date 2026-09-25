# Spy vs Spy — Round 4 design (play-test feedback)

Date: 2026-09-25
Status: approved in conversation (user's play test of round 3 + decisions: map = hold G; carried item moves to the back hand, as in the original where trap setting never touched what you carried)
Base: `feat/round-3`. Where this document differs from earlier specs, it wins.

## 1. Traps in the hand (replaces the Trapulator menu / arming)
- `spy.selected: TrapKind | null` replaces `menuOpen`/`menuCursor`/`armed` (remove them).
- **Tap** the Trapulator button (released < 0.5 s): the hand cycles `null → bomba → pruzina → elektrina → pistole → casovana → null`, **skipping kinds with stock 0**. Cycling does **not** freeze the spy (he keeps walking). If all stock is 0 the hand stays empty.
- **Hold** the button ≥ 0.5 s: the map opens while held (costs 5 s clock and −70 score once per opening, as before); the selection does not change on a hold. The spy stands still while the map is open.
- **Akce with a trap in hand** (and not swinging in a fight):
  - valid target in reach (bomba/pruzina → furniture via `furnitureAt`; elektrina/pistole → door via `doorAt`, not a hidden exit; casovana → the spot where he stands) and target free → **placing**: spy immobile **0.4 s** (pose), then the trap is placed (stock −1, clock −3 s, score +30, event `trapSet`), and the hand becomes **empty**.
  - otherwise (no valid target, target already trapped, shared room) → event `refused` {spy}: the spy **shakes his head** (0.5 s, can move again right after), grumble sound. No text.
- **Akce with empty hands**: everything as before (fight swing in range, doors, search/hide).
- **Shared room**: cycling still allowed; Akce swings if in range, otherwise with a trap in hand → `refused`. Map hold refused (shake) in a shared room.
- Remove all text hints about traps (`trapBlocked` strip text, armed hint, „Tady ji nastražit nejde"); keep the event names only where used by sound/animation. The under-frame strip keeps: name, room name, breadcrumbs, pips, and the item-name toast on pickup.
- **Valid-target highlight**: while a trap is in hand, the valid target in reach gets the red marker (own view only); none when nothing valid is in reach.

## 2. Hands
- Front hand = the selected trap icon when a trap is selected; otherwise the carried thing (kufřík, satchel, or **remedy** — see §3).
- When a trap is selected **and** the spy carries something, the carried thing hangs from the **back hand** (`SPY_BACK_HANDS` per frame, on a drawn pixel, both mirrored when flipped).

## 3. Remedies visible
- A carried remedy is drawn in the hand: umbrella (closed), bucket of water, pliers, scissors — small in-hand icons.
- **Using a remedy** (event `disarmed` {trap, remedy}) plays a 0.8 s animation at the spy, visible to anyone viewing that room, with its own sound:
  - deštník vs elektrický kbelík: the umbrella **opens over his head** while water (blue drops + a yellow spark) pours on it,
  - kbelík vody vs bomba: water splashes onto the lit fuse → **steam puff**, fuse out,
  - kleště vs pružina: a coiled spring pops up and the pliers **snip** it (two halves fall),
  - nůžky vs pistole: a string from the door, the scissors **cut** it, the pistol drops harmlessly.
- The spy holds a `disarm` pose during it (reuse `liftFind` or a new frame).

## 4. Animation fixes
- **Walking in a fight** (shared room): new frames `fightWalk1`, `fightWalk2` (crouched fight stance with the club, legs stepping); used when moving in a shared room instead of sliding in `fightStand`.
- **Placing**: pose `placeTrap` (new frame: bent down, hand forward/down) for the 0.4 s placing time; the trap icon shrinks into the target.
- **Refusal**: frames `refuse1`, `refuse2` (head turned left/right with a small grumble cloud) alternating for 0.5 s.

## 5. Taller doors
- Door openings (N back-wall door, E/W side doors, S threshold visual) about **25 % taller** so a 36-px spy fits comfortably; keep logic reach and widths. Door leaf/frame/fanlight scale accordingly. Exit sign above stays visible.

## 6. Bug check: door trap from the other side
- A door trap placed by one spy on door A–B must trigger for the other spy opening the same door from room B. Add a step-level test (place via the new hand flow, then the opponent opens from the other side → trap triggers, correct death/disarm). If it fails, fix the key/placement logic.

## 7. Device
- The Trapulator panel lights the button of the **selected** trap (no cursor); stock digits as before; the MAPA button lights while the map is held. OCHRANA / TAJNÉ unchanged.

## 8. Testing
- Logic: tap cycling incl. skipping zeros and returning to empty; hold → map (cost once, no selection change); placing flow (timing, stock, clock, score, hand empties), invalid → `refused` (each reason), casovana at feet, shared-room rules, door-trap other-side trigger, no text-hint events left.
- Render pure helpers: hand icons (front/back selection), `pickFrame` with new frames/poses, disarm effect spawn per remedy.
- Controller checks visuals in the browser.
