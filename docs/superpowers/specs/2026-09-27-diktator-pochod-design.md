# Diktátor — Pochod na Tiranu (the march on Tirana) (design)

Date: 2026-09-27. Status: written without questions at the owner's request; open product choices are listed in §12.
Parent spec: `docs/superpowers/specs/2026-09-26-diktator-design.md` (§6 "Pochod na Tiranu", §2 fiction, §11 art,
§12 controls, §4.1 budget). Arena: `docs/superpowers/specs/2026-09-27-diktator-atentat-design.md` §3.

This spec replaces parent §6 where they differ. The differences are the treasury range (§8) and the view (§5.1).

## 1. Goal and scope

The game opens with a co-op action scene of about 5 minutes: December 1924, Zogu and plk. Vlček march from the
Yugoslav border to Tirana. The result sets the starting position of the palace game (`StartingRegime`). This means
the first quarter already reflects how the boys played: a strong army if they won over the barracks, a full treasury
if they did not bribe the beys, strong rebels if they let Noli's gendarmes get away.

In scope (one implementation plan, a first playable version):
- the pure, seeded march simulation, `minigames/march/logic.ts`;
- the hand-authored map (`scenario/albania/march-map.ts`): 12 places, patrol routes and terrain;
- the render module, with grey puppets as standees on a procedurally drawn atlas-style map;
- the mapping of the result to a `StartingRegime`, plus the result card and a placeholder poster "Zogu vstupuje do Tirany";
- the game-flow wiring: title → march → (Sadije's tour) → 1925-Q1. "Rychlý start" (quick start) skips the march.

Not in scope: the painted map and props, part-sheet skins, music, followers with real behaviour, and everything in §13.

## 2. What the players experience

1. **New game → start card** (in the arena): the 1921 atlas map of Albania with a red arrow from Dibra to Tirana. The
   card reads: „13. prosince 1924. Zogu se vrací z Jugoslávie. Jdou s ním muži z Matu, ruští důstojníci a plk. Vlček.
   Noliho vláda sedí v Tiraně. Do Štědrého dne tam musíte být." A small box, "Jak to bylo doopravdy" (what really
   happened), gives two sentences of history (§4.1). Action starts the march.
2. **The map scrolls under the pair.** Zogu walks with his little column: three Russian officers in grey greatcoats and
   the Mati men in white felt caps who join him along the way. Vlček walks at his side. The date and a sun arc run
   across the top. Every 22 s the day changes and a banner says „15. prosince".
3. **Places** have an icon and a name: a village, a bey's tower, a barracks. When Zogu steps into one, a bubble says
   „Drž F — vyjednávat" (hold F to negotiate). Holding Action fills a golden ring above his head. When the ring is full,
   the place raises Zogu's flag and a bubble says what it gives („Selé z Klosu se přidávají!").
4. **Noli's gendarmes** patrol the roads in pairs or threes. If they see Zogu, they run at him, and they see a
   negotiating Zogu from twice as far away. Vlček intercepts them: two blows and a gendarme sits down dazed, with
   stars over his head, then raises his hands and walks off. Nobody bleeds and nobody dies.
5. **If a gendarme reaches Zogu**, Zogu is held. The screen dims and a caption reads „Zogu strávil noc v zajetí a ráno
   se vykoupil." The march loses a day and 20 gold, the patrol walks away, and the march goes on.
6. **At a barracks** the gate is held by 2–4 soldiers. The ring shows a padlock until Vlček has knocked out every one of
   them; the soldiers then salute and join the column. Only then can Zogu negotiate with the commander.
7. **The rope.** Vlček may never be more than 320 units from Zogu. When the gap reaches that, a gold cord appears
   between them and neither can step further away; they can only move sideways or towards each other.
8. **Tirana.** When Zogu reaches the city gate, bells ring, the column marches in and the march ends. If Christmas Eve
   ends first, the march ends where they stand: „Noli prchá do Itálie. Zogu vstupuje do Tirany až po Vánocích."
9. **The result card** lists every tally next to what it gives, so the boys see the cause and effect. For example:
   „Vesnice 3/4 → Rolníci: oblíbenost 8", „Zajatí četníci 9 → Povstalci: síla 6", „Zlato 170 → pokladna 270". Then
   comes the poster „Zogu vstupuje do Tirany" and the game continues with Sadije's tour or with 1925-Q1.

There is no game over. Zogu always reaches Tirana, and only the numbers differ.

## 3. The arena

The march is a `MiniGame<MarchResult>` in the arena of the atentát spec §3: one 960 × 540 canvas covering about 90 % of
the page, with pause (Esc/Start) and the start and result cards. If the atentát plan has not landed yet, this plan
builds `minigames/arena.ts` exactly as specified there. Two differences:

- **No halves to merge.** The march runs before the palace exists, so the arena fades in from the title screen (0.5 s)
  instead of sliding the halves together. After the poster it fades into Sadije's tour, or into the first palace day.
- **Both heroes take input.** `update(dt, { zogu, velitel })`. Seats follow the palace: F/WASD (or a gamepad) is Zogu,
  and Enter/arrows (or a second gamepad) is Vlček.
- **Solo:** one device steers the active hero, and Tab/Back switches heroes. The other hero is driven by the solo
  helper (§6.7), which lives in the simulation so it stays deterministic.

The march is not saved mid-way. Closing the page during the march returns to the title screen, because no `GameState`
exists yet. The march is seeded from the game seed (`marchSeed = gameSeed ^ 0x1924`), so `?seed=` replays the same
patrols.

## 4. The map and places

### 4.1 History (checked 2026-09-27) and how the game uses it

- Zogu crossed from Yugoslavia on **13 December 1924** with about 1 000 men from Dibra and Mat and White Russian
  volunteers, paid by Belgrade, plus Yugoslav regulars and weapons. The Russian detachment was led by Colonel Ilya
  Miklashevsky (about a hundred émigrés). [1][2][4]
- The first fighting was at **Peshkopi**, where Noli's reserve army was stationed. After a short rest the column went
  on to Tirana. [2]
- **Christmas Eve, 24 December 1924:** Zogu's forces took Tirana, and Noli and his government fled to Italy. [1][3][5]
- Zogu was born at **Burgajet castle** near Burrel. His family were beys with authority over **Mat**, his power base. [4]
- One historical review describes a three-pronged attack: Zogu's own column from **Dibra** towards Tirana; a column from
  Montenegro that reached Shkodër unopposed; and a column under Ceno Kryeziu on the **Prizren–Lumë (Kukës)** road that
  Bajram Curri's men beat back. The same source dates the start to 19 December. [6, **not verified**: seen only as a
  search excerpt, the source itself could not be opened]. The game keeps 13 December (Wikipedia). It uses the northern
  road only as the flavour of the Kukës detour: the hard road, with the most gendarmes.

For children: soldiers are knocked out and surrender, and nobody is shot. Places carry real names. The start card and
the result card each show one line of "Jak to bylo doopravdy". Vlček and his rope are fiction, and the game says so, as
parent §2 already does.

Sources:
1. Wikipedia, *June Revolution* — https://en.wikipedia.org/wiki/June_Revolution
2. Wikipedia, *Zogist counter-revolution in Albania (1924)* — https://en.wikipedia.org/wiki/Zogist_counter%E2%80%93revolution_in_Albania_(1924)
3. Wikipedia, *Noli Government* — https://en.wikipedia.org/wiki/Noli_Government
4. Wikipedia, *Zog I* — https://en.wikipedia.org/wiki/Zog_I
5. `docs/diktator/research/timeline.md`, entry 1924-12 (fact-checked 2026-09-26)
6. Review article, Hrčak — https://hrcak.srce.hr/file/451536 (search excerpt only)

### 4.2 The world

- **Units and grid.** 1 unit is 1 px at camera zoom 1. The map is **4800 × 2700 units**: a grid of **80 × 45 tiles** of
  60 units, i.e. 5 × 5 screens. North is up. The Yugoslav border is the east edge and Tirana lies in the south-west.
- **Terrain** is authored as 45 strings of 80 characters in `scenario/albania/march-map.ts`, so it is easy to draw,
  diff and test:

| Char | Terrain | Speed factor | Passable |
|---|---|---|---|
| `=` | road | 1.00 | yes |
| `b` | bridge (road over the river) | 1.00 | yes |
| `.` | meadow / valley | 0.75 | yes |
| `f` | forest | 0.55 | yes |
| `s` | snow (passes, Korab slopes) | 0.45 | yes |
| `o` | ford | 0.35 | yes |
| `~` | river (Drin, Mat) | — | no |
| `m` | mountain rock | — | no |
| `w` | lake | — | no |

- **Rivers.** The Black Drin runs north–south near the border (x ≈ 4150), then bends north-west to Kukës. It can be
  crossed at the **Maqellarë bridge** and at one ford south of it. The Mat river runs through the middle of the map and
  has a bridge at Burrel.
- **Routes.** From Burrel to Kruja there are two ways:
  - **Qafa e Shtamës**, the pass: short, but mostly snow;
  - **the Mat gorge road** past Klos: longer, all road, and more patrol routes.

  The **Kukës detour** runs north along the Drin from Peshkopi and back. It is a dead end: a rich barracks and tower,
  but about 45 s there and back, and the densest patrols.

### 4.3 Places (12 + the start and the goal)

Positions are tile centres (col, row) and are approximate. The exact tiles are fixed when the grid is drawn. Every
place has a radius of **70 units**.

| # | Place | Kind | Tile (c, r) | Ring | Gives | Seeded variant |
|---|---|---|---|---|---|---|
| S | Hranice u Dibry (border by Dibra) | start | (77, 32) | — | — | — |
| 1 | Maqellarë | village | (72, 30) | 5 s | +1 village | ring 4–6 s |
| 2 | Peshkopi | barracks | (65, 27) | 8 s | +1 barracks, +20 gold | 3–4 guards |
| 3 | Zerqan | village | (58, 29) | 5 s | +1 village | ring 4–6 s |
| 4 | Bulqizë | bey's tower | (53, 27) | 5 s | +1 tower | bribe 30/40/50 |
| 5 | Kukës | barracks | (64, 6) | 8 s | +1 barracks, +20 gold | 4–5 guards |
| 6 | Lumë | bey's tower | (58, 7) | 5 s | +1 tower | bribe 30/40/50 |
| 7 | Burgajet (Zogu's castle) | home | (47, 19) | 4 s | +1 village, +40 gold | — |
| 8 | Burrel | barracks | (44, 23) | 8 s | +1 barracks, +20 gold | 2–3 guards |
| 9 | Selitë | bey's tower | (43, 14) | 5 s | +1 tower | bribe 30/40/50 |
| 10 | Klos (Mat gorge) | village | (36, 31) | 5 s | +1 village | ring 4–6 s |
| 11 | Krujë (the castle) | barracks | (20, 23) | 8 s | +1 barracks, +20 gold | 3–4 guards |
| 12 | Prezë | bey's tower | (16, 30) | 5 s | +1 tower | bribe 30/40/50 |
| G | Tirana | goal | (10, 35) | — | ends the march | — |

- The tiles are now fixed by the drawn grid (plan `2026-09-27-diktator-pochod.md`, Task 1). Four moved from the
  first sketch: Kukës (65, 5) → (64, 6), off the river bank so its gate guards stand on dry land; Burgajet and Burrel
  by one tile east, onto the drawn roads east of the Burrel bridge; Selitë (38, 17) → (43, 14), because the Mat and
  the lake of Ulza run through the old tile.
- There are 4 "village" places (Burgajet counts as one), 4 towers and 4 barracks. Two of each, with arrival on
  24 December, reproduce the original start values exactly (§8.2).
- **Seeded variants** are drawn once at creation from the seed: each tower's bribe, each barracks' guard count, and
  each village's ring time. Only these vary. The map and the places never change.
- **Patrol routes:** about 14 authored polylines along the roads, each with 3–6 waypoints. The Kukës road has 3 of
  them, the Mat gorge 3 and the pass 1. A patrol walks its route back and forth.

### 4.4 The 1921 atlas map

`assets/maps/albania-1921.jpg` (647 × 698 px, public domain) shows all of Albania. The march area is only about 100 px
of it, far too coarse for the play map. It is used where its look matters:
- as the **start card** backdrop, with the red route arrow drawn over it;
- as the **result card** backdrop, with the path the players really walked drawn over it (the simulation's trail
  scaled down);
- as the **style reference** for the play map: sepia paper, hachured mountains, blue rivers, a dashed road, and place
  names in an atlas lettering (Poiret One).

### 4.5 Optional benefits (owner request, 2026-09-27)

The owner asked: „allowing some optional benefits would be great". Four small side benefits lie off the main road.
Each is a **detour**: it costs time, and time is police strength (§8.1). None is ever required, and each maps onto
exactly one line of the result card.

| Benefit | Where (tile) | How | Gives | Cap |
|---|---|---|---|---|
| **Skryté zásoby** (hidden supply caches) | 3 small chests off the road: by the border south of Maqellarë (75, 40); in the highlands west of the Kukës road (60, 13); in the forest south of the Mat gorge (28, 35) | either hero steps within 40 units of one | +15 gold each (so, through the gold left, the treasury) | +45 gold in all; the treasury stays within 200–400 |
| **Dobrovolníci z Martaneshe** (volunteers from a friendly village) | Martanesh (52, 38), a hidden village south of Bulqizë | Zogu negotiates 4 s | the bodyguard (`guard`) starts at 5 instead of 4; two more peasants walk in the column | +1 |
| **Koně z Homeshe** (a bey's stable lends horses) | Homesh (56, 34), south of Zerqan | Zogu negotiates 3 s | both heroes walk 25 % faster for 2 days (44 s of the march clock) | once; no line in the regime, only an earlier arrival |
| **Italský posel** (an Italian messenger on the road) | walks the Durrës road west of Prezë, (10, 29) ↔ (2, 28), at 40 units/s, and waits while Zogu stands with him | Zogu negotiates 2 s | Itálie popularity 8 instead of 7 | +1 |

- Benefit places use the negotiation rules of §6.4 (radius 70, the ring, the gendarmes' doubled sight while
  negotiating). They are not villages, towers or barracks and never count in the 4/4 tallies.
- They are found by exploring: the stable, Martanesh and the messenger stand on the map with a name, the caches as
  small chests. The mini-map shows only the 12 places.
- **Balance.** A march without benefits maps exactly as before, so the historical march still reproduces
  `RULES.start` (§8.2). The benefits change only `guard` (at most 5), `pop.italie` (at most 8) and the gold (the
  treasury clamp still holds).
- `StartingRegime` gains an optional `guard`, which `initialState` uses in place of `RULES.start.guard`.
- The result card adds one line per benefit won (§2.9), for example „Dobrovolníci z Martaneshe → tělesná stráž 5".

## 5. Roles and controls

### 5.1 The view: top-down map, side-view standees

**Decision.** The map is top-down and the characters are the existing side-view puppets drawn small, like cardboard
standees on a board-game map (the classic overworld look). The puppet scale is **0.34**: `FIGURE_HEIGHT` is 90, so a
figure stands about 31 px tall on the 960 × 540 canvas. A figure faces the direction of its last horizontal movement
and plays `POSES.walk` while it moves, including straight up or down.

Why:
- **The rig is reused.** It follows parent §11 (puppets first) and needs no new art. The heroes look the same as in
  the palace, and big heads keep Zogu (kepi) and Vlček (cap) recognisable even at 31 px.
- **Side-scrolling was rejected.** It would remove route choice (pass or gorge, the Kukës detour), the 2-D rope and
  interception, which are the heart of the co-op.
- **Tiny top-down tokens were rejected.** They need new art for every character, and children lose track of who is who.

### 5.2 Controls

| | Zogu (F/WASD or a gamepad) | Vlček (Enter/arrows or a gamepad) |
|---|---|---|
| Move | WASD / stick / D-pad | arrows / stick / D-pad |
| Action | **hold** in a place = negotiate; elsewhere = wave (flavour) | **tap** = strike (knock-out blow) |
| Solo switch | Tab / Back | Tab / Back |
| Pause | Esc / Start | Esc / Start |

Zogu cannot fight. Vlček cannot negotiate.

## 6. The simulation (pure, seeded)

`src/games/diktator/minigames/march/logic.ts`. It uses no DOM, canvas, audio or `Math.random`; randomness comes only
from `makeRng(marchSeed)` (`shared/rng`). Tuning constants live in `minigames/march/rules.ts` as `MARCH`, and the map
lives in `scenario/albania/march-map.ts`.

```ts
/** `action`: Action went down this tick (Vlček's blow); `held`: Action is held (Zogu negotiates). The arena's
 * ArenaInput gains an optional `held` for this. */
export interface MarchInput { readonly moveX: number; readonly moveY: number; readonly action: boolean; readonly held: boolean }
export function createMarch(map: MarchMap, seed: number, solo: boolean, opts?: MarchOptions): MarchState;
export function stepMarch(s: MarchState, dt: number, inputs: Partial<Record<Hero, MarchInput>>, active: Hero): MarchEvent[];
export function marchResult(s: MarchState): MarchResult | null; // after the ending animation
```

`stepMarch` runs at a fixed **1/60 s** step (the arena accumulates real time). With the same seed and the same inputs,
it always produces the same state.

### 6.1 Clock

- `t` is the elapsed seconds; `DAY = 22`; `DAYS = 12`. The date is 13 + ⌊t / 22⌋ December, so day 0 is 13 December
  and day 11 is 24 December.
- `t ≥ 264` (the end of Christmas Eve) → the march ends with `arrivedDay = null` (timeout).
- The clock does not run during the start card, the pause or the result card. It does run during the catch caption
  (the caption only lasts 2 s; the day is lost by a jump, see §6.5).

### 6.2 Movement and terrain

- **Speeds** (units/s, before the terrain factor): Zogu **120**, Vlček **150**, gendarme **95**. The input vector is
  clamped to length 1, and the speed is multiplied by the factor of the tile under the figure's feet.
- **Collisions:** the axes are resolved separately (x, then y). A move into an impassable tile is cancelled on that
  axis, so figures slide along walls. Figures never collide with each other.

### 6.3 The rope

- `ROPE = 320`. After moving, if |Z − V| > 320, the hero or heroes who moved away have their step's outward component
  removed, then the pair is projected back to exactly 320 (split in proportion to how much each moved).
- The rope is **taut** at a distance ≥ 0.85 × ROPE; the render shows the cord from that point.
- **The camera** centres on the midpoint of the pair, clamped to the map. The half-height of the view (270) is more than
  ROPE / 2 plus a 100-unit margin, so both heroes are always on screen.

### 6.4 Places and negotiation

- **Zogu is "in" a place** when he is within 70 units of it. Holding Action there adds `dt` to the place's `progress`.
  Releasing the button or walking away keeps the progress (kind to children). When `progress` reaches the ring time,
  the place is **won**; each place can be won only once.
- **Bey's tower:** the ring only starts if `gold ≥ bribe`, otherwise the bey says „Bez zlata ani slovo." The bribe is
  paid when the ring completes.
- **Barracks:** the ring is locked while any gate guard still stands.
- **Rewards** are booked when the ring completes: tallies `villages`, `towers`, `barracks`, and gold (barracks +20,
  Burgajet +40).
- **Zogu is "negotiating"** while he holds Action in an unfinished, unlocked place. This doubles the gendarmes' sight
  (§6.5).

### 6.5 Gendarmes (Noli's patrols)

- **Spawning.** A spawn is tried every 8 + `randInt(5)` s (8–12 s). The patrol spawns only if fewer than **6**
  gendarmes are alive, and it is trimmed so that no more than 6 are ever alive. Its start is a random patrol-route
  end (either end; the patrol walks towards the other) that lies **600–1400 units** from the camera centre, so it is
  off screen but near; if no end qualifies, the spawn is skipped.
- **Patrol size:** 1 gendarme on 13–16 Dec, 2 on 17–20 Dec, 3 on 21–24 Dec. The members walk in a line, 24 units apart.
- **States:**
  - `patrol`: walk the route back and forth.
  - `chase`: when Zogu is within **sight** (260 units, or 520 while he negotiates), the gendarme walks straight at him.
    He gives up and returns to the nearest route waypoint when Zogu is farther than 700 units, or after 1.5 s stuck
    against terrain.
  - `stunned` (0.6 s, after a blow), `down` (1.2 s, dazed stars), `surrender` (1.5 s, hands up, then removed and
    counted).
  - `leaving` (after a catch): walks away and is removed after 2 s. It is **not** counted.
- **Catch:** a gendarme in `patrol` or `chase` within **28 units** of Zogu, while Zogu is not immune, catches him:
  - gold −min(gold, 20);
  - `t += 22` (a whole day is lost), and `caught += 1`;
  - that gendarme's whole patrol turns to `leaving`;
  - Zogu is frozen for 2 s (the caption), then immune for 4 s.
  - If the jump pushes `t` to 264 or beyond, the march ends as a timeout.

### 6.6 Vlček's blow and the barracks gate

- **The blow.** Action starts a blow if the cooldown is over. The blow animation lasts 0.3 s and the cooldown is
  **0.45 s**. It hits the **nearest** gendarme or gate guard within **56 units** that is not already down.
- **Two hits** knock anyone out. The first hit knocks him back 30 units (terrain permitting) and stuns him for 0.6 s;
  the second puts him `down` and then into `surrender`.
- **Counting:** a surrendered gendarme adds 1 to `captured`. Gate guards are the army and do not count; after
  surrendering they **join** the column instead (rendered as followers).
- **Gate guards** stand at the gate (within 40–60 units of the barracks) and never chase. They do not catch Zogu; they
  only lock the ring.

### 6.7 Solo helper (only when `solo`)

- The hero that is not active **follows** the active one: he walks towards him while the distance is more than 90
  units and stops within 90.
- **Vlček as the helper** puts interception first: if a gendarme in `chase` is within 200 of Zogu, he walks at that
  gendarme. He strikes automatically at anyone in reach, with a slower **0.8 s** cooldown.
- **Zogu as the helper** only follows. He never negotiates, so negotiating is always the player's own act.

### 6.8 End

- **Arrival:** Zogu comes within **90 units** of the Tirana gate → `arrivedDay = 13 + ⌊t / 22⌋`, and a 3 s entry
  animation plays: the column walks in and bells ring.
- **Timeout:** at `t ≥ 264` → `arrivedDay = null`, followed by a 3 s caption.
- **Then** `marchResult` returns:

```ts
export interface MarchResult {
  readonly villages: number;          // 0..4 (Burgajet counts)
  readonly towers: number;            // 0..4
  readonly barracks: number;          // 0..4
  readonly captured: number;          // gendarmes who surrendered
  readonly caught: number;            // times Zogu was caught (for the card only)
  readonly gold: number;              // gold left, ≥ 0
  readonly arrivedDay: number | null; // 13..24, or null = after Christmas
  readonly trail: readonly (readonly [number, number])[]; // Zogu's path, sampled every 0.5 s (result card)
  // Optional benefits (§4.5):
  readonly caches: number;            // 0..3 caches taken (their gold is already in `gold`)
  readonly volunteers: boolean;       // Martanesh joined → guard 5
  readonly messenger: boolean;        // the Italian messenger → Itálie popularity 8
  readonly horses: boolean;           // the Homesh horses were lent (card line only)
}
```

**Gold** starts at **200** (the Yugoslav money, in the game's units of 1 000 gold francs) and never goes below 0.

### 6.9 Pacing check (target, verified by play-testing)

- **The straight road** Dibra → Peshkopi → Burrel → pass → Kruja → Tirana is about 5 600 units. That is about 55 s on
  roads, plus the snow on the pass, so **about 65–75 s**.
- **Every place** adds about 180 s: villages 19 s, towers 20 s, barracks about 60 s including the gate fights, the Kukës
  detour about 45 s, and the Klos loop plus smaller detours about 35 s. The whole march lasts 264 s.
- So a skilled pair can almost do everything but arrives late. Children typically win about 2 of each kind and arrive
  around 22–24 December. Rushing gets a strong police force but a weak start everywhere else. This trade-off is the
  decision the game is about.

## 7. Drawing

`src/games/diktator/minigames/march/render.ts` draws only; it reads `MarchState` and never changes it.

- **Terrain** in the atlas style of the 1921 map: sepia paper, hachure strokes for the mountains, blue rivers with a
  darker edge, a dashed brown road, a stipple of dots for snow and small tree marks for forest. Only tiles near the
  camera are drawn. They are cached in 960 × 540 chunk canvases, built lazily; at most 6 are kept, least recently used
  dropped first.
- **Places:** a small icon for each kind (a house, a square kulla tower, a barracks with a flag), with the name in
  Poiret One. A won place shows a red flag with the black eagle. A locked barracks shows a padlock over the ring.
- **Figures** are sorted by y, at puppet scale 0.34:
  - Zogu (`zogu`) and Vlček (`velitel`);
  - the gendarmes (`gendarme`), gate guards (`officer`) and beys in their towers (`bey`, shown while negotiating);
  - the followers, which are render only and walk on Zogu's trail, 20 units apart: 3 Russians, plus one peasant
    (`peasant`) per village won and one soldier per gate guard who joined, capped at 12;
  - a new look, **`russian`**: a grey greatcoat and a new small hat kind, `papakha`.
- **Effects:** the golden ring (it fills clockwise), dazed stars, raised hands and the gold cord of the rope (red at
  full length). Falling snow shows while the camera is over snow tiles. A dusk tint covers the last 3 s of each day.
- **HUD** along the top:
  - the date and a sun arc for the day;
  - a gold purse with the number;
  - tally icons (villages, towers, barracks, captured);
  - a **mini-map**, top-right, 160 × 90: the place dots (ticked when won), the pair's dot and Tirana's star.
- **Cards:** the start card (the 1921 map with the route arrow), the catch caption, the result card (the 1921 map with
  the walked trail, then the tally → value lines of §2.9), and the placeholder poster "Zogu vstupuje do Tirany". The
  poster is a sepia frame with its id and caption until the art exists (parent §11).
- **Texts** go in `cs.diktator.pochod`: place names, place lines (one "won" line per place and the refusal lines), the
  cards, and the "Jak to bylo doopravdy" lines.

## 8. Mapping the result to `StartingRegime`

`logic/march-regime.ts`, a pure function: `regimeFromMarch(r: MarchResult): StartingRegime`. The constants live in
`RULES.march` (`logic/rules.ts`), as parent §6 asks.

### 8.1 Formulas

`clamp(lo, hi, x)`; `n` is the tally named in each row.

| Value | Formula | Range | Original / current start |
|---|---|---|---|
| `pop.rolnici` | min(8, 5 + villages) | 5–8 | 7 |
| `pop.statkari` | min(8, 5 + towers) | 5–8 | 7 |
| `str.statkari` | 4 + towers | 4–8 | 6 |
| `pop.armada` | min(8, 5 + barracks) | 5–8 | 7 |
| `str.armada` | 4 + barracks | 4–8 | 6 |
| `str.povstalci` | clamp(4, 8, 8 − ⌊captured / 4⌋) | 4–8 | 6 |
| `pop.policie`, `str.policie` | by arrival, see below | 5–8 / 4–8 | 7 / 6 |
| `treasury` | clamp(200, 400, 100 + gold) — gold includes the caches' +15 each (§4.5) | 200–400 | 300 |
| `pop.italie` | 7 + 1 if the Italian messenger was won (§4.5), else not set | 7–8 (cap 8) | 7 |
| `guard` | 4 + 1 if the Martanesh volunteers joined (§4.5), else not set | 4–5 (cap 5) | 4 |
| everything else | not set (the `RULES.start` default applies) | — | `str.rolnici` 6, `pop.povstalci` 0, `pop.britanie` 7, `pop.jugoslavie` 7, `str.jugoslavie` 6, income 60, costs 60 |

Benefit caps (§4.5): caches at most +45 gold (and the treasury clamp above), the messenger at most +1 Itálie
popularity, the volunteers at most +1 bodyguard; the horses give no regime value at all.

Police, by arrival (spare = 24 − arrivedDay):

| Arrival | `pop.policie` | `str.policie` |
|---|---|---|
| by 20 Dec (spare ≥ 4) | 8 | 8 |
| 21–22 Dec (spare 2–3) | 8 | 7 |
| 23–24 Dec (spare 0–1, as in history) | 7 | 6 |
| after Christmas (timeout) | 5 | 4 |

### 8.2 Reconciliation with the current start values

- **The historical march reproduces the original start exactly.** Two villages, two towers and two barracks, 8 gendarmes
  captured, gold back at 200, arrival on 24 December and no optional benefits give pop 7 and str 6 everywhere, with
  treasury 300. This equals `RULES.start`, which is also the quick start (tested, §10).
  - Example: bribes 2 × 40 = −80, Burgajet +40, two barracks +40 → gold 200 → treasury 300.
- **The treasury range is 200–400, not the old 800–1 200.** The old range was ±20 % around the original 1 000, before
  the play-test budget change. The start is now a 300 reserve with income 60 = costs 60, so the balance only moves by
  the players' own choices, and every tis. at the start is a free choice later. ±100 is a third of the reserve: enough
  that thrift on the march is felt (one more decision of about 100), and not so much that the march can buy off the
  budget game. The floor of 200 keeps even a wasteful march out of early bankruptcy.
- **The rebels:** the strength range is 4–8, centred on the default 6, as the other strength groups are. Rebel
  popularity stays 0: Noli's men are hostile whatever happens.
- **No faction can start hostile.** The lowest popularity is 5, and `low` is at most 4.
- **`rolnici` strength is not set.** Villages give popularity only (parent §6: "Village → Rolníci popularity").

## 9. Sound

Only existing sounds; no new samples in v1.
- **Steps:** each hero's own step samples (`zogu-step-*`, `vlcek-step-*`), one every 0.45 s while moving and quieter
  on snow.
- **The ring:** the synth `tick` once per second while it fills; `win` when a place is won.
- **The purse:** `coins` for a bribe, Burgajet's gold, the barracks chest and the ransom.
- **Fighting:** `swing` for a blow, `hit` when it lands, `boing` for the dazed stars, `join` when a gendarme surrenders
  or a guard joins, `fail` for a catch.
- **Time:** `lowtime` during the last day; `door` plus the bells (a `win` flourish) at the Tirana gate.
- **Ambience:** the palace `Ambient` at a low fixed level as a wind bed.

## 10. Testing

Vitest, pure modules only (`tests/diktator/march/*.test.ts`):
- **Map data:** the grid is 45 × 80 and uses only known characters; every place, the start, the goal and every patrol
  waypoint stands on a passable tile; a path exists from the start to Tirana and to every place (BFS over the tiles).
- **Clock:** the date at t = 0, 21.9, 22 and 263.9; the timeout at 264.
- **Movement:** the terrain factors; blocked tiles; sliding along walls.
- **Rope:** the distance never exceeds 320 after any step (a property check over random inputs and many seeds);
  sideways movement is allowed when taut.
- **Negotiation:** progress only while holding Action inside the place; progress is kept after leaving; each place is
  won once; a tower refuses without enough gold and charges its bribe; a barracks stays locked until its guards are
  down; the rewards and gold.
- **Gendarmes:** the spawn cadence and the live cap; the size by date; sight doubles while Zogu negotiates; the chase
  gives up; a catch costs gold (never below 0), exactly 22 s and sends the patrol away; immunity; a catch that crosses
  264 ends the march.
- **Blows:** the cooldown; the nearest target in reach; two hits knock out; `captured` counts gendarmes but not gate
  guards.
- **Solo helper:** it follows, intercepts and strikes; the helper Zogu never negotiates.
- **Optional benefits (§4.5):** a cache gives 15 gold once, to either hero; Martanesh, Homesh and the messenger are won
  by negotiating; the horses speed both heroes by 25 % for exactly 44 s of the march clock; the messenger walks his
  road and waits while Zogu stands with him; the result carries the benefits; the regime caps (Itálie 8, guard 5).
- **Determinism:** the same seed and the same inputs give the same state and result; seeded variants lie within their
  ranges.
- **Mapping:** every output stays within its range for all tallies (exhaustive over villages, towers and barracks
  0–4, captured 0–30, gold 0–400 and arrivals 13–24 or null); the historical march equals `RULES.start`; the police
  table rows.
- **Bot:** a random-input bot (and a "walk the road" bot) finishes the march for 50 seeds within 264 s of simulated
  time, the result maps to a valid `StartingRegime`, and `newGame(sc, seed, regime, { palace: true })` starts.

By hand in the browser: the readability of the 31 px standees, the rope feel, the pacing (§6.9), whether children
find
the places (the mini-map), the arena fade from the title, and the solo helper.

## 11. Game-flow wiring

- **Title:**
  - "Nová hra" → the march → `newGame(sc, seed, regimeFromMarch(result), { palace: true })`;
  - "Rychlý start" → `newGame(sc, seed, undefined, …)`, the current behaviour.
- **The classic text mode** (`text.html`) keeps the original start and has no march.
- **The first newspaper** (1925-Q1) may reference the march result (arrival date). That is optional in this plan
  (§13).

## 12. Decisions to confirm

**Confirmed by the owner on 2026-09-27** ("ok, let's plan and implement it"): all defaults below stand.

1. **The view:** a top-down atlas map with small side-view puppet standees (scale 0.34, about 31 px), not
   side-scrolling and not new top-down tokens.
2. **The treasury range is 200–400** (100 + gold left, start gold 200), replacing parent §6's 800–1 200.
3. **The historical march reproduces the original start exactly** (2 of each place, 8 captured, arrival on 24 Dec).
4. **Villages give Rolníci popularity only**, not strength (as parent §6). Burgajet counts as a village and gives +40
   gold.
5. **A catch costs a whole day** (22 s) and 20 gold. Parent §6 says "a day"; this could be softened to half a day for
   the boys.
6. **The Kukës detour is a dead end** (a barracks and a tower) with the densest patrols, as the flavour of the northern
   column that historically failed. It is not a separate start.
7. **Gate guards join Zogu** and do not count as captured; only Noli's patrol gendarmes lower the rebels' strength.
8. **The start date is 13 December** (Wikipedia). One review says 19 December; that is not used.
9. **Negotiation progress is kept** when Zogu walks away or is caught.
10. **The solo helper Zogu never negotiates**; the helper Vlček intercepts and strikes on his own.
11. **No mid-march save**; a reload returns to the title screen.
12. **Only existing sounds**; the bells at Tirana are a synth flourish.

## 13. Later

- Painted art: the generated march map (a manifest entry built from the grid layout), place props, the poster "Zogu
  vstupuje do Tirany", and part-sheet skins for the standees, including the Russians' papakhas.
- Followers with real behaviour (for example, they help hold a gate); a Vlček's letter home about the march; the first
  newspaper's article quoting the arrival date.
- Weather that changes by day (snowstorm days slow the pass); footprints in the snow.
- A Shkodër column as a second route or map; a "Jak to bylo doopravdy" gallery in the chronicle.
- Music: a marching tune, and Christmas bells on arrival.
- Difficulty settings (for example a longer rope, or no lost day on a catch) if play-testing shows the boys need them.
