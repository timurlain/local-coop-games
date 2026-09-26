# Diktátor (local co-op collection, game #2) — Design

Date: 2026-09-26
Status: approved in brainstorming, awaiting spec review

Research references (part of this spec):
- `docs/diktator/research/original-rules.md` — the original BASIC rules, all 49 records, formulas
- `docs/diktator/research/remake-content.md` — extra content and mechanics from other remakes
- `docs/diktator/research/timeline.md` — fact-checked Albanian + world + Czech events 1924–1939

## 1. Context and goals

A remake of **Dictator** (Don Priestley, DK'Tronics 1983; Czech "Diktátor", translated by František Fuka), rebuilt
from scratch in TypeScript and set in **King Zog's Albania, December 1924 – April 1939**. It is for the user's two
young sons, who love interwar history.

Goals:

- **Faithful core.** The numbers, petitions, plots and fight formulas are taken from the original BASIC, not from the buggy C/C# remakes. **Difficulty is not scaled down** for kids.
- **Asymmetric 2-player co-op**, on one screen, with keyboard and/or gamepads:
  - **Zogu** handles politics and money.
  - **the Czech guard commander** handles security.
- **Learning by playing.** Each quarter comes with a newspaper page covering Albanian, world and Czech events. Legends are marked as legends.
- **Action between the decisions.** The game opens with a co-op mini-game, *Pochod na Tiranu*, whose result sets the starting position. Later mini-games plug into a defined slot.
- **Czech UI.** Articles are at most 3 sentences. Illustrations are cartoons in a "DuckTales meets Art Deco" style, with human faces.
- **Playable over 2–3 evenings**, with autosave, Continue, New game, and a yearly retry checkpoint.

Out of scope for v1:
- The mini-games *Vídeň 1931* (dodging bullets), *Obrana Tirany* (tower defence) and *Útěk do Řecka* (car race). Each gets its own spec; v1 ships the slot and a fallback.
- Other countries. The architecture keeps a *scenario* boundary so that, for example, Austria 1927–38 can be added later.
- Online play, touch controls, key remapping.

## 2. The fiction

| Role | Who | Note |
|---|---|---|
| Player 1 | **Ahmet Zogu** | President from 1925, **King Zog I from 1 Sep 1928**. |
| Player 2 | **plk. Jaroslav Kovář** | **Invented.** A Czechoslovak legionnaire who went through Russia and ended up in the Balkans. He marched with Zog in 1924 next to the (historical) White Russian detachment, and now commands the royal guard. The game says openly that he is invented. |
| Advisor (NPC) | **Queen Mother Sadije** | Historical, died 25 Nov 1934. After her death her room passes to Princess Adile, who gives the same advice. |
| NPCs | Zog's sisters, Geraldine (from 1938), little Leka (born 5 Apr 1939), envoys, petitioners, faction members | |

Kovář's letters home and the "Meanwhile at home" (Mezitím doma) newspaper column tie the story to Czechoslovakia.

### 2.1 Groups (KPIs)

The bars show plain Czech names. Albanian terms appear only in flavour text.

| KPI (bar label) | Original | Flavour text |
|---|---|---|
| Armáda | Army | the royal army |
| Rolníci | Peasants | villages of the Myzeqe plain |
| Statkáři | Landowners | "bejové — albánští velkostatkáři" |
| Povstalci | Guerillas | mountain outlaws (kaçakové), Fan Noli's exiles |
| Tajná policie | Secret Police | the gendarmerie of General Percy |
| Jugoslávie | Leftoto (hostile neighbour, invades) | Belgrade, King Alexander |
| Itálie | Russians (patron, loan) | Mussolini, SVEA |
| Británie | Americans (aid) | London, oil concessions |

Money is shown in thousands of gold francs ("tis. zlatých franků"). Internally it uses the original's units,
where 1 unit = 1 000.

## 3. Architecture

Tech is the same as Spy vs Spy: TypeScript, Vite multi-page, Vitest, no runtime dependencies.

The hard rules carry over too:
- `logic/` never touches DOM, canvas, audio or `Math.random`.
- Logic emits events; `main.ts` routes them to audio and effects.
- The same seed and the same inputs always give the same game (`?seed=` works).

```
src/shared/rig/                   extracted from spy-vs-spy/render/rig: skeleton.ts, raster.ts (generic)
src/games/diktator/
├─ index.html, main.ts, style.css
├─ logic/                         PURE
│  ├─ rules.ts                    every tunable number (original constants + our additions)
│  ├─ state.ts                    GameState, GroupId, FactionStatus, Phase, Ending
│  ├─ scenario.ts                 Scenario interface: groups, start date, turn count, records, timeline, fiction
│  ├─ records.ts                  Petition / Decision / News / HistoryEvent types + effect application
│  ├─ plot.ts  audience.ts  decision.ts  assassination.ts  war.ts  revolution.ts  news.ts  score.ts
│  ├─ palace.ts                   hours, royal seal, room mist, actions (logic only, no positions)
│  ├─ turn.ts                     phase machine: advance(state, command) → { state, events }
│  ├─ save.ts                     serialize / migrate / checkpoints
│  └─ march/                      the opening mini-game (pure): state, step, result → StartingRegime
├─ scenario/albania/              ALL country-specific content
│  ├─ groups.ts  fiction.ts       names, flavour, characters
│  ├─ petitions.ts  decisions.ts  news.ts
│  ├─ history.ts                  dated events: newspaper articles, big moments, dated decisions
│  └─ march-map.ts                the hand-authored march map
├─ render/                        canvas: palace rooms (split screen via shared/splitscreen), palace strip, puppets, march, posters
│  └─ puppets/                    character rigs (skeleton + poses as data) and part-sheet skins
├─ ui/                            DOM overlays: newspaper, dialogs, reports, menus, chronicle, endings
└─ assets/manifest.ts             every image with size, alpha flag and generation prompt
tests/diktator/                   logic tests
```

- **Canvas** renders things that move: the palace, the puppets and the march.
- **DOM** renders text: the newspaper, dialogs, the police report, menus, the chronicle and the ending screens. The browser's text layout, Google fonts (Limelight, Poiret One) and focus handling are better than drawing text ourselves.

**Rig extraction.** The generic parts of the spy rig (`skeleton.ts` solve/step, `raster.ts`) move to
`src/shared/rig/`. Spy keeps its own `parts.ts`/`poses.ts` and imports the moved files. The existing spy tests must
stay green, and this refactor is its own commit.

**The phase machine** is the heart of the game. `advance()` accepts one `Command` at a time:
- a palace action
- an audience answer
- a decision
- an ally pick
- fight or flee
- a big-moment choice
- a mini-game result
- ending the day

It returns the new state plus events. The UI only offers commands that are valid in the current phase.

**The mini-game slot:**

```ts
interface CrisisOutcome { kind: 'march' | 'assassination' | 'war' | 'revolution' | 'escape'; modifier: number; payload?: unknown }
```

When a crisis resolves, the logic accepts an optional `CrisisOutcome`. In v1 only the march produces one. Every other
crisis uses the original roll (modifier 0), and the UI shows a poster instead of a mini-game.

## 4. Game flow

1. **Menu**: New game / Continue / Quick start (skips the march and uses the original starting values) / settings (mute, music).
2. **Pochod na Tiranu**, December 1924 (§6), produces a `StartingRegime`.
3. **57 quarters, 1925-Q1 to 1939-Q1.** In each quarter:
   1. **Newspaper**
   2. **Palace day**
   3. **Evening**
   4. **Autosave**
4. **Ending** (§9).

### 4.1 One quarter

- **Morning, the newspaper (§7).** A reading screen with no timer. Big-moment choices are made here.
- **Audience.** The petitioner waits in the throne room.
  - Zog must go there first. The audience costs no hour.
  - Answers:
    - *Ano* (yes).
    - *Ne* (no), with the original penalty.
    - *Odejděte* ("go away"): the petitioner loses 1 popularity and the petition goes back into the deck.
    - *Navrhněte něco jiného* ("suggest something else"): once per audience, the same group presents another petition.
  - The original forced "no" when funds are insufficient still applies.
- **Day.** Zog has 3 hours, the commander 3 (§5).
- **Evening.** The original order of checks after the decision, adapted to one turn = one quarter:
  1. assassination
  2. war
  3. news (1/3 chance)
  4. revolution

  Crises show a poster or run a mini-game. The treasury pays the per-turn costs (`mpy`) at the start of the next quarter, as in the original, including the bankruptcy rules.

"Month" becomes "quarter", and all original per-turn numbers keep their per-turn values.

**Deviation from the original order.** The original checks assassination and war *before* the decision (steps 6–7),
and news and revolution after it. Here all four run in the evening, after the palace day, because the day is one
continuous scene. The consequence is that a decision taken during the day (for example the bodyguard) already
counts in the same quarter's checks. Plots are re-formed at the original re-plot points, which are after the
audience and after the decision.

### 4.2 Plots

Plot formation, `low`, `str`, cooldown, statuses and allies all run exactly as in `original-rules.md` §2, once per quarter
(the "re-plot" points of the original are kept).

## 5. The palace

The royal palace in Tirana is a set of **rooms connected by doors**, played in **split screen** like the embassy in
Spy vs Spy. Each player's half shows **the room his character is in**, as a full scene. Walking through a door moves
you to the next room, and the room transitions and door logic of Spy vs Spy are reused where they fit. A small
**palace strip** at the top centre is a miniature dollhouse map: it shows where both characters are and every
room's crowd, so the players can direct each other ("the landowners' room is full, go and look!").

The newspaper, the evening crises, the posters, the mini-games and the endings use the **shared full screen**. Only
the palace day is split. The rhythm is together → apart → together.

### 5.1 Rooms

About 11 rooms on 2 floors plus a courtyard. Every room is its own full generated background.

| Room | Who is there | Purpose |
|---|---|---|
| Trůnní sál (throne room) | the petitioner | audience |
| Pracovna krále (king's study) | — | "please all" decisions; the seal starts here each quarter |
| Pokoj královny matky (Queen Mother's room; Adile's from 1934-Q4) | Sadije / Adile | advice (the original's advice view) |
| Důstojnický sál (officers' hall) | **Armáda** | talk; army decisions |
| Selská světnice (peasants' room) | **Rolníci** | talk; peasant decisions |
| Salon statkářů (landowners' salon) | **Statkáři** | talk; landowner decisions |
| Strážnice (guardroom) | **Tajná policie** | police report; bodyguard, police and plane decisions; **the mountain map** |
| Salonek vyslanců (envoys' salon) | **envoys of Italy, Britain and Yugoslavia** | receive envoys; loans and foreign decisions |
| Pokladna (treasury) | treasurer | Swiss account; the visible gold pile |
| Knihovna (library) | — | the chronicle (free) |
| Nádvoří (courtyard) | guards, the plane once bought | the connecting hub between the wings |

- **Povstalci (the rebels) are not in the palace.** They appear on **the mountain map** in the guardroom: the number of campfires is their strength, and the smoke and banners show their mood.
- **The foreign powers** are one envoy each in the envoys' salon. Each envoy shows his own country's mood.

### 5.2 Strength and mood you can see

- **Strength (0–9)** is the **number of people in the room**: 0 means an empty room and 9 means a crowded one. For the rebels it is the number of campfires. The palace strip shows every room's crowd at all times.
- **Popularity (0–9)** has **ten mood levels, and each level has its own look**:
  - **A room variant.** The same room, generated with different props and lighting per level. It ranges from garlands, a raised glass and the king's portrait crowned with laurel, down to a turned-away or defaced portrait, a broken chair, weapons on the table and drawn curtains.
  - **A puppet pose.** One of ten mood poses from the rig: from arms raised and cheering down to fists shaking.
  - **A face expression.** One of five expression heads in each part sheet, each shared by two neighbouring levels.

  The room variant, pose and expression together make each level unique.

| Level | Czech label | Look (brief) |
|---|---|---|
| 9 | nadšení (ecstatic) | cheering, garlands, the portrait crowned with laurel |
| 8 | oddaní (devoted) | toasting the king, flags out |
| 7 | spokojení (content) | relaxed, chatting, smiling |
| 6 | klidní (calm) | going about their business |
| 5 | vlažní (lukewarm) | shrugging, bored |
| 4 | nejistí (uneasy) | glancing around, arms crossed |
| 3 | reptají (grumbling) | frowning, complaining in groups |
| 2 | rozzlobení (angry) | pointing, shouting, the portrait turned to the wall |
| 1 | zuřiví (furious) | fists shaking, a chair knocked over |
| 0 | vzbouření (rebellious) | the portrait defaced, weapons on the table, the door barricaded |

- **Entering a room shows its mood.** Walking costs time but no hour. The palace strip remembers the mood you last saw in each room this quarter; rooms nobody has entered this quarter show "?".
- **The visuals update live.** When a decision changes the numbers during the day, the people in the room react on the spot.
- **Plots are never visible just by looking.** They need the commander's check (§5.3). A revealed plot shows as whispering figures in a corner, plus a marker naming the ally.

### 5.3 Hours and actions

Zog has 3 hours and the commander has 3. The audience is free and comes first for Zog. Walking is free.

| Who | Action | Effect |
|---|---|---|
| Zog | Talk to a faction (1 h) | The faction says what it wants: it names one petition or decision it would welcome. |
| Zog | Ask for advice (1 h, Mother's room) | Opens the advice view for the current petition or a candidate decision, showing every effect. |
| Zog | Receive envoys (1 h) | The envoys say how much a loan could bring (the original formula shown as a hint). |
| Commander | Investigate a room (1 h) | Reveals that room's plot and ally. Always possible, costs no money. |
| Commander | Police report (1 h, guardroom) | Reveals **every** plot, ally, `low` and `str`, as the original report. Costs 1 unit of money and has the original preconditions: treasury > 0, police popularity > low, police strength > low. |
| Commander | Guard the king (his last hour) | This quarter, the 50 % survival coin in an assassination becomes 75 %. (Our addition; `rules.ts`.) |
| Either | Seal a decision (free; needs the seal, in the right room) | Carries out one decision. Only one per quarter. |
| Either | Pick up or hand over the seal (free) | Handing over works only in the same room. |

**Dialogs belong to their own half.** An audience in Zog's half and an investigation in Kovář's half can run at the
same time without covering each other.

**Solo play.** Tab / the gamepad's Back button switches which character you control. The screen stays split, and the
character you are not controlling waits where he is.

The evening starts when both players have spent all their hours, or when both press "Konec dne" (end the day).

## 6. Pochod na Tiranu (the opening mini-game)

- **Setting.** December 1924. A top-down, hand-authored mountain map from the Yugoslav border to Tirana (the river Drin, passes, snow). The seed varies only the patrols and what each place offers.
- **Clock.** The days left until Christmas: about 12 days at about 22 s each, roughly 5 minutes.
- **Player 1 is Zogu, the diplomat.** He holds Action inside a place to negotiate (a progress ring fills). He cannot fight. If a patrol catches him, he loses a day and some gold.
- **Player 2 is Kovář, the soldier.** He strikes patrols and guards Zog while Zog negotiates; patrols target a negotiating Zog.
- **Rope.** If the two get too far apart, the column halts, and neither moves further away from the other until they close in again.

**Places:**

| Place | Cost | Result |
|---|---|---|
| Village | time | Rolníci popularity |
| Bey's tower | gold (a bribe) | Statkáři popularity and strength |
| Barracks | time + a gate fight | Armáda popularity and strength |
| Patrol defeated | — | lowers the starting Povstalci strength (Noli's escaped men become the rebels) |
| Gold left over | — | the starting treasury |
| Arrive before 24 Dec | — | Tajná policie bonus; arriving late means weaker police |

- **No game over.** Zog always reaches Tirana. The result maps onto **ranges around the original start values**: popularity 5–8 instead of a fixed 7, strength 4–8 instead of 6, and treasury 800–1200 instead of 1000. The exact mappings live in `rules.ts`.
- **Result.** A `StartingRegime` object, then the poster "Zogu vstupuje do Tirany" (Zog enters Tirana).
- **Controls.** Each player uses their own keyboard half or gamepad. The shared `InputManager` and `PlayerActions` are reused, and the canvas loop is the shared `startLoop`.

## 7. The newspaper

Every quarter the game shows one front page of *Gazeta e Tiranës*. Articles have **at most 3 sentences** and each
has one illustration.

| Column | Source | Game effect |
|---|---|---|
| Albánie (Albania) | the dated events in `timeline.md` §A | yes, and some offer choices |
| Ze světa (from the world) | the dated events in `timeline.md` §B | only where they touched Albania (below); the rest is flavour |
| Mezitím doma (meanwhile at home) | the Czech events in §B | flavour, told through Kovář's letters |
| Krátké zprávy (short news) | the original 6 news items + selected remake news, re-themed | the original 1/3 chance, one-off items |
| Podmíněné zprávy (conditional news) | remake N43–N48, re-themed | repeatable; checked when drawn; returned to the deck if the condition fails |

**World events with mechanical effect (v1 list):**

| Event | Effect |
|---|---|
| Wall Street Crash 1929-Q4 | the Depression begins: +costs, then peasant hardship news through 1930–33 |
| King Alexander assassinated 1934-Q4 | Jugoslávie strength −3 |
| Italy invades Ethiopia 1935-Q4 and the Spanish Civil War 1936-Q3 | "Italy is busy": Italian pressure news paused |
| Italy–Yugoslavia pact 1937-Q1 | Jugoslávie popularity −2 |
| Munich 1938-Q3 | British aid unreliable: Britain's loan is halved from now on |
| Occupation of Bohemia and Moravia 1939-Q1 | foreshadows the finale; no mechanical effect |

**Big moments.** Each gets a poster and sometimes a choice:

| When | Moment | Choice |
|---|---|---|
| 1924-12 | March on Tirana | the mini-game |
| 1926-Q4 | Pact of Tirana | accept: Italy +, Yugoslavia −, treasury +. Refuse: the reverse |
| 1928-Q3 | Coronation | none; the title changes to Král (King) |
| 1931-Q1 | Vienna Opera | a poster in v1; the mini-game comes later. It is a **forced attempt**: no plot status is needed. Zog survives if police popularity > low, or police strength > low, or the coin (75 % if guarded) succeeds. |
| 1934-Q2 | Italian warships at Durrës | stand firm: home groups +, Italy −. Bow: Italy +, Armáda − |
| 1934-Q4 | Queen Mother's death | none; advice passes to Adile |
| 1935-Q3 | Fier revolt | mercy: Rolníci +, Povstalci strength +. Firmness: Tajná policie +, Rolníci − |
| 1938-Q2 | Wedding with Geraldine | lavish: treasury −, home groups +. Modest: smaller effect |
| 1939-Q2 | Invasion | the finale (§9) |

**Dated decisions.** About 12 historical decisions unlock at their dates and go into the decision pool, for example:
- the agrarian reform of 1930
- nationalising the schools in 1933
- an Italian road loan
- Radio Tirana in 1938
- the Durrës port

Their effects use the same record format as the original decisions. This keeps the decision pool alive over 57 turns,
where the original 19 would run out.

**Legends** are shown with the prefix „Říká se, že…" ("They say that…") and a small ribbon icon. Examples: the pistol at the Vienna
Opera, 225 cigarettes a day, and Sadije cooking against poison.

**The chronicle.** Every article that has been read is stored in the chronicle, which the boys can open from the
library. At the end it shows **your reign next to the real history** on one timeline.

## 8. Content (scenario data)

All records are typed TypeScript data. There is no string encoding.

```ts
interface Effects { cost?: number; monthly?: number; pop?: Partial<Record<GroupId, number>>; str?: Partial<Record<GroupId, number>> }
interface Petition { id: string; from: 'armada' | 'rolnici' | 'statkari'; title: string; text: string; effects: Effects; origin: 'original' | 'remake' | 'new' }
```

| Pool | Content | Size |
|---|---|---|
| Petitions | the original 24, re-themed with **the original numbers**, plus about 20 adapted from the remake (A8–A15, P6–P13, M10–M14) plus a few new Albanian ones | about 50 |
| Decisions | the original 19, in the original 5 sections, with the special effects (Swiss account, loans, plane, bodyguard) | 19 + about 12 dated |
| News | the original 6, re-themed, plus about 17 remake items, re-themed, plus the 10 Albanian hooks | about 33 |
| Conditional news | the remake's N43–N48, re-themed | 6 |
| Dated events | about 35 Albanian, about 52 world/Czech | about 87 |

Adjustments to specific items:
- The **Swiss account** decision lets you choose how much to send: all, ½, ⅓ or ¼ of the treasury (borrowed from ritimba). The original fixed ½ is one of the options.
- The **helicopter** becomes a **plane** (letadlo). It keeps the same cost and odds.
- **Foreign aid** keeps the original formula. The lenders are Italy (instead of the Russians) and Britain (instead of the Americans).

A data validator test enforces:
- every effect value is within −9…+9
- every group id is valid
- each record's `origin` is set
- every article has at most 3 sentences
- every dated event falls within 1924-12…1939-Q2
- every asset referenced by a record exists in the manifest

## 9. Crises and endings

The original formulas are used, as in `original-rules.md` §5. Where the palace adds something, the addition is
labelled **our addition** and its constants live in `rules.ts`.

**Assassination.** The original rule applies, with a 75 % coin if the commander guarded the king. The v1 poster is
"Atentát!" (Assassination!).

**War with Jugoslávie** follows the original's threat or invasion.
- The invasion shows the poster "Obrana Tirany" (Defence of Tirana).
- It resolves with the original comparison.
- **Our addition:** the defender is picked without visible numbers. This matters only if rooms are misted: an unrevealed group can still be picked.

**Revolution.** Escape by plane, or into the mountains, or fight.
- The ally is picked by walking to that faction's room. The ally screen lists every group with its revealed or unrevealed mood.
- Picking a hostile group gives the original "Děláte si legraci!" ("You must be joking!"), and Zog goes to the mountains.
- The original bug is fixed: with no eligible ally, the player's own strength is used alone.

**Endings:**

| Ending | Trigger | Screen |
|---|---|---|
| Killed | assassination / war lost / revolution lost / caught fleeing | poster and score (no alive bonus) |
| Escaped early | plane or mountains | poster "Exil" and score (alive bonus + Swiss) |
| **Reached April 1939** | survived 1939-Q1 | the finale: Italy invades; Zog, Geraldine and little Leka flee to Greece; score + alive bonus + Swiss account; a **"Přežil jsi až do konce"** (you survived to the end) medal |

**Score.** The original formula is kept: Σ popularity + 3 per month + (if alive) 10 + ⌊Swiss/10⌋. One quarter
counts as 3 months, so each survived quarter is worth **9 points**. The ranks are in Czech (5 levels, thresholds
in `rules.ts`). The number of retries used is shown next to the score.

**Retry.** A checkpoint is saved at the start of each year (Q1). After a death or an early escape, the options are:
- "Zkusit znovu od ledna 19xx" (try again from January 19xx)
- "Nová hra" (new game)

## 10. Save

- **Autosave** writes the whole `GameState` to localStorage after every quarter, via `shared/storage`.
- It stores a schema version. On an unknown version, "Pokračovat" (Continue) is hidden.
- Yearly checkpoints are kept in the same store.
- If storage is unavailable, the game still runs; only Continue is missing.

## 11. Art and assets

**Everything is generated imagery**, made by the user from the prompt sheet. The code never blocks on missing art.

**Characters are puppets first, look second** (lessons from Spy vs Spy):
1. **Rig first.** Each character is a skeleton rig with human-cartoon proportions (big head, small body). Poses are data: stand, walk cycle, talk, bow, point, shocked, salute, fall, plus **ten mood poses** (§5.2) for faction members and envoys.
2. **Grey puppets.** The palace and the march are fully playable with plain grey puppets. Motion, size and readability are tuned at game scale before any skin exists.
3. **Skin.** One generated **part sheet** per character: head front and side, **five expression heads** (ecstatic, happy, neutral, grumpy, furious), torso, upper and lower arms, legs, hat. Each part is a transparent cut-out from one reference. The parts are mounted on the bones, so the generator never has to draw the same person twice in different poses.
4. **Final look.** Smooth cut-out with a light outline, matching the painted illustrations. It is not pixelated.

**Static art is whole generated images:** newspaper illustrations, room backgrounds, big-moment posters, the march map
and march props.

**Pipeline:**
- **The manifest.** `assets/manifest.ts` lists every image: id, file, pixel size, alpha required, and **the full prompt**. Prompts are built from the style block in `docs/diktator/art-style.md`, which covers:
  - the palette: sepia, gold, Albanian red and black
  - Art Deco frames
  - "DuckTales-like human cartoon faces"
  - character reference sheets
- **Order of generation.** Character reference sheets first (Zog, Kovář, Sadije, Adile, Geraldine, Mussolini, King Alexander, petitioner types), then everything else, using those sheets as references.
- **Missing images.** A missing image renders as a sepia placeholder frame showing its id and caption.
- **`npm run assets:check`** is a Node script with no dependencies. It lists missing files and files with the wrong size or no alpha, reading the PNG IHDR header.
- **Approximate count:**
  - about 95 newspaper illustrations
  - about 14 character part sheets (main characters, one member type per faction, three envoys)
  - about 7 plain rooms (throne, study, Mother's room, library, treasury, courtyard, envoys' salon)
  - **4 mood rooms × 10 mood variants = 40** (officers' hall, peasants' room, landowners' salon, guardroom)
  - the mountain map × 10 mood variants = 10
  - 9 posters
  - the march map and about 8 props

  That is about 190 images, added gradually. Mood variants are generated from their room's base image with an image-edit step, so the room stays recognisably the same.

## 12. Controls

| Context | Keyboard | Gamepad |
|---|---|---|
| Palace / march movement | P1 WASD, P2 arrows | left stick / D-pad |
| Action (interact, confirm) | F / Enter | A |
| Seal: pick up / hand over | G / right Ctrl | X |
| Switch character (solo) | Tab | Back |
| Pause / menu | Esc | Start |
| Dialogs | 1–5, A / N (ano / ne) + mouse | D-pad focus, A confirm |

A dialog belongs to the player who opened it. The other player keeps walking.

## 13. Testing

Vitest, logic only, the same as Spy vs Spy:
- **Original formulas against the BASIC**, with a table-driven test per rule: plot formation, bankruptcy, cash check, refuse penalty, assassination truth table, war threat vs invasion, revolution fight, mountain escape odds, foreign aid, score.
- **The phase machine:** valid commands per phase, one seal per quarter, hours, what each action reveals (entering = mood, investigate = plot and ally, report = everything), audience answers, checkpoints.
- **Mood mapping:** popularity 0–9 maps to exactly one of the ten mood levels, and each level has its room variant, pose and expression in the manifest.
- **Determinism:** the same seed plus the same commands produce the same state.
- **The march:** step, rope, negotiation, patrol capture, and `StartingRegime` staying within ranges.
- **Save:** serialize → deserialize round-trip, version guard.
- **Data validator** (§8).
- **Bot playthrough:** a bot plays random valid commands from the march to the end for 50 seeds without throwing, and every run ends in a valid ending.
- **Rig extraction:** the spy tests stay green.

The UI is checked by hand in the browser.

## 14. Hub and deployment

- `vite.config.ts` gets a new input: `diktator: 'src/games/diktator/index.html'`.
- The hub gets a second card:
  - **Diktátor**
  - subtitle "Tirana, 1925"
  - "Král Zogu a jeho velitel gardy drží Albánii do roku 1939. 2 hráči spolu nebo 1 sám." ("King Zog and his guard commander hold Albania until 1939. 2 players together or 1 alone.")
- The strings go into `cs.diktator` in `src/shared/i18n/cs.ts`.
- The README gets a game entry.

## 15. Follow-up specs (not v1)

1. *Vídeň 1931*: dodge the bullets (Zog + Kovář). It plugs into the assassination crisis.
2. *Obrana Tirany*: tower defence (two builders). It plugs into war and revolution.
3. *Útěk do Řecka*: car race with the gold (driver + the one holding the chests). It plugs into the escape crisis and the finale.
4. A second scenario (e.g. Austria 1927–38) on the same logic.
