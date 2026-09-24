# Spy vs Spy — Round 2 design ("closer to the original")

Date: 2026-09-24
Status: approved in conversation (items chosen by the user from `docs/research/2026-09-24-original-comparison.md` + play feedback)
Base: branch `feat/room-themes` (v1 + room themes). Extends `2026-09-24-spy-vs-spy-design.md`; where this document says otherwise, it wins.

## 1. Remedy fixtures (research gap 1)

- Four **fixture** furniture kinds, each an infinite source of exactly one remedy:
  | Fixture | Czech | Remedy | Look |
  |---|---|---|---|
  | `vesak` | věšák | deštník | coat rack with a hanging umbrella |
  | `hasicak` | hasičská skříňka | kbelík vody | red wall box with a small window |
  | `naradi` | bedna na nářadí | kleště | grey/green tool box, handle on top |
  | `lekarnicka` | lékárnička | nůžky | white wall box with a red cross |
- Fixtures stand in normal back-wall slots (no side-wall slots). Count per kind = `max(2, ceil(rooms / 5))` (Malá 2, Střední 3, Velká 4), all in distinct rooms where possible.
- A fixture's kind **always** means its remedy: `furniture.source` is set for every fixture and only for fixtures. `vesak` is no longer part of any theme's ordinary furniture pool.
- Secrets and the kufřík are never placed in a fixture at generation. A fixture still has the single hidden-thing slot (players can hide/swap into it, §3.3 of v1 unchanged).
- The number of furniture pieces per room stays 2–4; fixtures replace ordinary pieces.

## 2. Shared start (gap 2)

- Both spies start in the **same room**, chosen from the seed among rooms that are not the exit room. Bílý at x=40, Černý at x=160, both z=20, facing each other.

## 3. Meeting in a room (gap 3)

- **Entering**: when a spy passes a door into a room where the opponent is present and active (`normal` or `searching`), the entering spy **drops everything**:
  - armed trap → cleared (stock already spent stays spent; an armed-but-unplaced trap is returned to stock),
  - remedy in hand → lost (sources are infinite),
  - secret or kufřík → hidden in the room via the existing `dropHand` rules (nearest free furniture, same room first).
  - Event `dropped` { spy, thing | null } for sound/animation.
- Start of the game and respawning next to the opponent are **not** "entering".
- **Shared room** (both spies active in the same room): Akce only swings (if in range) — no search, no hide, no trap placement; the Trapulator cannot be opened; a search already in progress completes. Doors still work.
- In a shared room both spies show the **fight stance with the club drawn** (see §6); outside it the club is put away.

## 4. Tuning (gap 7)

| Rule | v1 | Round 2 |
|---|---|---|
| Time bomb fuse | 10 s | **15 s** (countdown digits stay visible) |
| Placing any trap (incl. time bomb) | free | costs **3 s** of the placer's clock |
| Health | 4 | **7** |
| Strength recovery | none | **+1 every 2.5 s**, starting 2.5 s after the last hit taken, up to max |
| Swing animation | 0.2 s | **0.35 s** (wind-up 0.15 s → strike 0.2 s); cooldown stays 0.4 s |

## 5. The original look (gap 5)

Each half (320×100 logical) becomes:

```
┌───────────────────────── 320 ─────────────────────────┐
│ ╭──── brick-red TV frame ────╮  ┌── Trapulator ─────┐ │
│ │   room view  ~212×80       │  │ LED 7:59:86  (●)  │ │
│ │                            │  │ PASTI [5 buttons] │ │
│ ╰────────────────────────────╯  │ MAPA  [button]    │ │
│   BÍLÝ · Knihovna   ♥♥♥♥♥♥♥     │ OCHRANA [slot]    │ │
│                                 │ TAJNÉ [4 slots] 👜│ │
└─────────────────────────────────┴───────────────────┘
```

- **Room view** is drawn inside a rounded brick-red frame (~216×84 incl. frame) on the left. The room geometry (`VIEW`, `project`) is rescaled to the new width; all room/furniture/decor/spy/effect drawing uses the geometry constants, never literal 320.
- **Under the frame**: player name, room name, health pips (7).
- **Trapulator device** on the right (~100×98): grey calculator-like body with a coiled cable to the frame:
  - red **LED clock** `M:SS:hh` (hundredths); blinks + low-time beep once per second under 60 s,
  - **PASTI** row: 5 trap buttons with icons and stock digits, **red** frames,
  - **MAPA** button (6th),
  - **OCHRANA** slot: **green** frame, shows the carried remedy and, next to it, a small crossed-out icon of the trap it defuses,
  - **TAJNÉ**: 4 **gold** slots for the secrets + a **brown** kufřík slot; a secret carried loose (not in the kufřík) **flashes** in its slot.
- **Hand colour coding** everywhere (Trapulator slots, toast): armed trap red, remedy green, secret gold, kufřík brown.
- **Trapulator use**: holding the Trapulator button shows a cursor over the 6 buttons (left/right); Akce on a trap arms it (on the armed trap = unarm, as v1); the panel is always visible, no pop-up over the room. The spy cannot move while the button is held (v1 rule).
- **Map**: Akce on MAPA shows the map **instead of the room view while the Trapulator button stays held**: grid of rooms, visited rooms filled, current room blinking, doors between visited rooms, **dots in visited rooms that hold a secret or the kufřík**, the exit room marked once visited. The opponent is never shown. Opening the map costs **5 s** of the clock (once per opening).
- The **always-on mini-map stays** (user decision), moved into the Trapulator device, cells a bit larger than v1. It shows **doors**: a short connector between two cells for every door of a visited room (so a door is known once you have been on either side of it), walls without a door stay closed, the current room is highlighted, and the exit wall gets a plane marker once its room was visited. No item dots and never the opponent — those extras (item dots) are the MAPA button's job.
- The **big map** (MAPA button) draws the same door connectors plus the item dots.
- **Toast**: when a remedy/secret/kufřík enters the hand, its Czech name shows under the frame for 1.5 s.
- **Icons redrawn** for clarity (8×8 stays): kbelík vody with handle and water line, kleště, deštník, nůžky, and all trap icons; new fixture looks per §1.

## 6. Spies in the style of the 1984 originals

- New larger sprites, ~28×36 px (final size chosen to fit the new room view; body centre on the image centre column), in the C64 caricature proportions: **huge head** (hat + head ≈ 45 % of height), very long pointed nose, small body, thin legs, tiptoe walk. Reference: frames of https://www.youtube.com/watch?v=vIIvuPo0-Jw (0:19, 0:50, 1:40, 11:40, 15:44).
- Frames: `stand`, `walk1–4`, `fightStand` (club drawn, crouched), `swingWind`, `swingStrike`, `block`, `searchDig1/2` (rummaging, alternating), `hidePut` (placing an item in), `shrug` (nothing found), `liftFind` (holding the find overhead), `laugh1/2`, plus hand points (`SPY_HANDS`) and a **club point** where needed.
- White/black/sooty/soaked/ghost palettes as v1.

## 7. Search, hide and swap feedback

Distinct animations (render-side effects driven by logic events):

| Outcome | Logic event | Animation (~0.6 s, spy stays immobile as v1) | Sound |
|---|---|---|---|
| Search → found something | `found` { thing } | `searchDig` during the 0.5 s search, then `liftFind` with the item icon floating up + sparkle | happy jingle |
| Search → nothing | `found` { null } | `searchDig`, then `shrug` + dust puff from the furniture + „?" over the head | short "womp" |
| Hide (hold) | `hidden` | `hidePut`, item icon sinks into the furniture, hands dusted off | soft thud |
| Swap (search with full hand, or hold onto an occupied piece) | `swapped` { gave, took } | `searchDig`, then the given icon sinks in and the taken icon rises out | swap whoosh |
| Kufřík absorbs a secret | `found` + `stored` | `liftFind`, secret icon flies into the kufřík | jingle |
| Dropped on entering the opponent's room | `dropped` | item icon flies out of the hand into the furniture (or poofs for a remedy) | clatter |

- Hold onto an **occupied** piece = swap (user decision), shown with the swap animation — not a silent search.
- Logic change: `resolveSearch` reports the outcome kind so `interact.ts` can emit `swapped`/`stored` instead of only `found`.

## 8. Unchanged

Everything else from the v1 spec and the room-themes addendum stays (controls, traps and remedies pairing, death & respawn, fight block, victory scene, menus, deploy).

## 9. Testing

- Logic (Vitest): fixture placement and counts per size, fixture kind ⇔ source invariant, no secrets in fixtures, shared start room ≠ exit, entering drops everything (each hand case) and not on start/respawn, shared-room restrictions (no search/hide/trap/menu; in-progress search completes), trap-set clock cost incl. time bomb, 15 s fuse, health 7 + recovery timing, map-open cost, new events (`swapped`, `stored`, `dropped`).
- Render: pure helpers (layout rectangles fit inside 320×100 without overlap, LED clock formatting with hundredths, map layout for all sizes) unit-tested; art verified by the controller in the browser.
