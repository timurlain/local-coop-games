# Spy vs Spy — comparison with the 1984 original

Research of 2026-09-24: original manual + frame-by-frame look at gameplay videos, compared with our v1. Ideas for next rounds, not yet scheduled.

## Sources
- Original manual (C64/Apple/Atari): https://archive.org/stream/Spy_vs_Spy_1984_First_Star_Software/Spy_vs_Spy_1984_First_Star_Software_djvu.txt
- ZX Spectrum instructions: https://rk.nvg.ntnu.no/sinclair/instructions/spyvsspy.html
- C64 longplay: https://www.youtube.com/watch?v=vIIvuPo0-Jw (0:12 options, 0:19 shared-room fight, 1:10 Trapulator, 11:40 search, 15:44 exit, 15:49 ending)
- NES playthrough: https://www.youtube.com/watch?v=llq9FkJIwfY
- https://www.c64-wiki.com/wiki/Spy_vs_Spy, https://en.wikipedia.org/wiki/Spy_vs._Spy_(1984_video_game)

## Already matching
Split screen (White top), per-spy clocks, 4 items → briefcase → single exit with plane sign, one object in hand, the 5 traps with correct targets and remedies, time bomb without remedy, invisible traps that hurt both spies, angel on death, opponent not on the map.

## Gaps (priority for "feels like the real thing on a couch")

**Gameplay rules**
1. **High — fixed remedy fixtures.** Original: water in a red fire box (left wall), wire cutters in a tool box (right wall), umbrella on the coat rack, scissors in a first-aid kit (back wall); several per embassy, always the same remedy → players learn where to look. Ours: one random furniture source per remedy (`logic/generator.ts`). → add wall fixtures, make every fixture of a kind an infinite source.
2. **High — shared start room.** Original starts both spies in the same room, fight immediately. Ours: opposite corners.
3. **High — entering the opponent's room drops everything** (traps/remedies lost, items/briefcase hidden in that room); while sharing a room no search, no Trapulator — only clubs and doors. Ours drops only on death.
4. **Medium — fight:** ~7 blows, strength recovers over time, two attacks (head bash up→down, jab left/right), auto-face. Ours: 4 hits, no recovery, block by holding away (our addition).
5. **Medium — time costs:** setting a trap costs clock time (beeps); trap victim 7 s knocked out + 20 s penalty. Ours: trap free, death 30 s + 3 s.
6. **Medium — time bomb 15 s**, you "listen carefully" (visibility unverified). Ours: 10 s with visible digits.
7. **Medium — doors are closed** and opened with the button (door traps sit on closed doors). Ours: walk-through.
8. **Medium — one "level" setting** scales rooms (6–36), traps (level 8: 72) and clock (level 8: 24 min).

**Presentation**
9. **High — layout:** each room in a rounded brick-red TV-like frame labelled WHITE/BLACK; Trapulator device on the right with red LED clock (M:SS:hundredths), red warning button, 6 buttons (5 traps + map), 4-item inventory bar, coiled cable.
10. **High — merged same-room view:** both spies drawn only in the half of the spy who was there first; the other half goes blank.
11. **Medium — map** behind the 6th Trapulator button, replaces the room view, current room blinks, dots mark rooms with required items.
12. **Medium — room variety:** furniture on side walls too (desk, filing cabinet, white cabinet, coat rack, picture, TV), two-tone floors.
13. **Medium — carried secret without briefcase = white satchel in hand;** inventory always visible, loose items flash; stolen items appear on the thief's Trapulator.
14. **Medium — trap victim → the other spy laughs hysterically.**
15. Low — up to 9 breadcrumb arrows under the room pointing back; airport guard gives "the boot" instead of "Zamčeno".

**Audio**
16. **High — background music** with a toggle. Must be our own composition (original C64 tune is copyrighted).
17. Low — low-time warning sound, beeps on trap set, tone + flash in reach of an object.

**Screens / flow**
18. **Medium — options:** 1/2 players, level 1–8 (with rooms/traps/minutes readout), computer IQ, hide airport till end.
19. **Medium — ending:** winner boards a propeller plane that takes off; score + rank title ("Grand Master Spy"). Scoring: win fight +80, lose −20, place trap +30, trap victim −80, steal item +60, use map −70, use remedy +40.

## Our additions (keep)
Hold-to-hide, block, health pips, always-on mini-map, `?seed=`, F1 debug, "Zamčeno", mob "CHYŤTE HO!" + "HA HA HA!" victory scene, remíza, auto-pause, Czech UI.

## Not in scope yet
Computer opponent (IQ 1–5), two-floor embassies (ladders, holes under rugs).

## Suggested rounds
1. **Rules & feel:** gaps 1, 2, 3, 10 + tuning 4–6.
2. **Original look:** 9, 11, 13, 12.
3. **Music & laughs:** 16, 14, 17.
4. **Levels & ending:** 8, 18, 19.
