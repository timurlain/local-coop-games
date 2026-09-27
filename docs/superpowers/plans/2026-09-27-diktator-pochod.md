# Diktátor — Pochod na Tiranu (the march on Tirana) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The game opens with a co-op action scene of about 5 minutes. In December 1924 Zogu and plk. Vlček march from the Yugoslav border to Tirana, on a top-down atlas map with small puppet standees. What the boys win on the way (villages, beys' towers, barracks, captured gendarmes, gold left, the arrival date and four optional benefits) becomes the starting position of the palace game (`StartingRegime`). "Rychlý start" skips the march and keeps today's start.

**Architecture:**
- **Map data** (`scenario/albania/march-map.ts`): a hand-authored 80 × 45 terrain grid, the places, roads, patrol routes and the benefits.
- **Geometry** (`minigames/march/map.ts`) and **tuning** (`minigames/march/rules.ts`).
- **The simulation** (`minigames/march/*.ts`): pure and seeded, one module per concern:
  - `state.ts`: types and shared helpers;
  - `move.ts`: walking and the rope;
  - `logic.ts`: create, step and result;
  - `places.ts`, `foes.ts`, `benefits.ts`, `helper.ts`.
- **The mapping** (`logic/march-regime.ts`): result → `StartingRegime`, with constants in `RULES.march`.
- **Drawing** (`minigames/march/render.ts`) and **the game object** (`minigames/march/game.ts`, a `MiniGame<MarchResult>`).
- **The page** (`main.ts`): a new `march` screen in the existing arena, with a fade from the title. The flow is: start card → march → result card → poster → `newGame(sc, seed, regimeFromMarch(result), { palace: true })`.

**Tech Stack:** TypeScript strict, Vite, Vitest, Canvas 2D, DOM overlays, Web Audio recipes. No runtime dependencies.

**Spec:** `docs/superpowers/specs/2026-09-27-diktator-pochod-design.md` — this is the authority, including §4.5 (optional benefits). Parent: `docs/superpowers/specs/2026-09-26-diktator-design.md` §6, §11, §12. Arena: `docs/superpowers/specs/2026-09-27-diktator-atentat-design.md` §3 (already implemented).

**How this plan was checked:** every code block below was built and run in a scratch copy of the repository, task by task. Each task's state compiled (`npx tsc --noEmit`) and ran the whole suite green; after Task 9, `npm run build` passed, and the start card and the running march were checked in the browser. So copy code blocks **exactly**. If something does not fit the tree you find (another session may have moved code), stop and report rather than improvise.

## Global constraints

- Work only in the worktree `C:/Users/TomášPajonk/source/repos/timurlain/local-coop-games/.claude/worktrees/diktatr-albania-remake-637508`. Never walk the filesystem from a root (`find /`, `find ~` …); use Glob/Grep. Never run a bare `git stash`.
- Pure modules (`logic/`, `minigames/march/*.ts` except `render.ts` and `game.ts`, `scenario/`, `ui/*.ts` except `ui/dom.ts`) touch no DOM, canvas or `window`, and use no `Math.random`. Randomness comes only from `s.rng` (`shared/rng`: `makeRng`, `randInt`, `pick`).
- Czech text lives only in `src/shared/i18n/cs.ts`, in the new block `cs.diktator.pochod` (and one title label, `palace.join.quickStart`). The scenario's existing `GROUP_NAMES` are used for group names.
- Canvas code keeps `save`/`restore` balanced, and every world-angle rotation is negated (the puppet convention: `ctx.rotate(-deg * RAD)`). Drawing code never uses `createLinearGradient`/`measureText` results: the fake test context returns `undefined`.
- Classic text mode (`text.html`) is untouched: it keeps the original start and has no march.
- No save-format change. `StartingRegime` is not saved, so `GameState.version` stays 6.
- Before each commit, `npm test` must be green and `npx tsc --noEmit` clean. After Tasks 8 and 9, `npm run build` must also succeed.
- Commit only the files of your task, with `git add <paths>`. Another session may be committing in the same repository, so never use `git add -A` or `git add .`.
- Each commit body ends with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- The heroes are Zogu (`zogu`) and Vlček (`velitel`). `Hero`, `HEROES` and `other` come from `logic/palace.ts`.
- Units: 1 world unit = 1 px at camera zoom 1. A tile is 60 units, so the map is 4800 × 2700. Angles in the simulation are plain `Math.atan2`/`Math.hypot` math; y grows south.

## File map

| File | Task | Responsibility |
|---|---|---|
| `minigames/march/map.ts`, `minigames/march/rules.ts`, `scenario/albania/march-map.ts` (all new) | 1 | map types, grid geometry, the atlas projection, tuning numbers, the authored map |
| `minigames/march/state.ts`, `minigames/march/move.ts`, `minigames/march/logic.ts` (new) | 2 | state, inputs, events, result; walking, terrain, the rope; clock, trail, the end |
| `minigames/march/places.ts` (new), `logic.ts` | 3 | seeded variants, negotiation, rewards |
| `minigames/march/foes.ts` (new), `logic.ts` | 4 | gate guards, patrols, chases, the catch, Vlček's blow |
| `minigames/march/benefits.ts` (new), `logic.ts` | 5 | caches, the Italian messenger's walk (volunteers and horses are booked in Task 3) |
| `minigames/march/helper.ts` (new), `logic.ts` | 6 | the solo helper |
| `logic/rules.ts`, `logic/state.ts`, `logic/march-regime.ts` (new), `minigames/march/text.ts` (new), `shared/i18n/cs.ts` | 7 | `RULES.march`, `StartingRegime.guard`, result → regime, the result-card lines, the Czech texts |
| `minigames/arena.ts`, `render/puppet/{looks,draw,poses}.ts`, `minigames/march/render.ts` (new), `minigames/march/game.ts` (new), `minigames/march/text.ts` | 8 | `ArenaInput.held`, the `russian` look and `papakha`, `handsUp`; the drawing; the game object; bubbles |
| `ui/sounds.ts`, `ui/controls.ts`, `ui/dom.ts`, `palace.css`, `shared/i18n/cs.ts`, `main.ts` | 9 | sound cues, the fade, the card note, title options, quick start, the march screen, the DEV hook |

All paths are under `src/games/diktator/` unless they start with `src/shared/` or `tests/`. Tests live in `tests/diktator/march/`, plus the two existing files `tests/diktator/sounds.test.ts` and `tests/diktator/controls.test.ts`.

---

### Task 1: The map, its geometry and the tuning numbers

**Files:**
- Create: `src/games/diktator/minigames/march/map.ts`, `src/games/diktator/minigames/march/rules.ts`, `src/games/diktator/scenario/albania/march-map.ts`
- Test: `tests/diktator/march/map.test.ts`

The grid below was drawn with a generator and checked:
- every place, cache and waypoint stands on passable ground;
- Tirana and every place are reachable from the border (BFS);
- the Mat is crossed only at the Burrel bridge (41, 24);
- the Drin is crossed only at the Maqellarë bridge (69, 29) and the ford (69, 37);
- the routes are balanced: Burrel → Krujë takes about 19 s over the snowy pass and about 20 s by the gorge road past Klos (Zogu's speed, shortest path).

Copy it character for character. The column ruler comments are only a help.

- [ ] **Step 1: Write the test.** Create `tests/diktator/march/map.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  mapHeight, mapWidth, passable, reachableTiles, speedAt, terrainAt, tileCentre, TERRAINS, worldToAtlas, type TilePos,
} from '../../../src/games/diktator/minigames/march/map';
import { ALBANIA_MARCH as M } from '../../../src/games/diktator/scenario/albania/march-map';

const key = (at: TilePos) => at[1] * M.cols + at[0];

/** Samples a tile polyline every 2 units and returns the first impassable point, or null. */
function blockedOn(route: readonly TilePos[]): [number, number] | null {
  for (let i = 0; i + 1 < route.length; i++) {
    const [ax, ay] = tileCentre(M, route[i]);
    const [bx, by] = tileCentre(M, route[i + 1]);
    const n = Math.ceil(Math.hypot(bx - ax, by - ay) / 2);
    for (let k = 0; k <= n; k++) {
      const x = ax + ((bx - ax) * k) / n;
      const y = ay + ((by - ay) * k) / n;
      if (!passable(M, x, y)) return [x, y];
    }
  }
  return null;
}

describe('the march map data', () => {
  it('is 45 rows of 80 known characters, 4800 × 2700 units', () => {
    expect(M.terrain).toHaveLength(45);
    for (const row of M.terrain) {
      expect(row).toHaveLength(80);
      for (const ch of row) expect(TERRAINS).toContain(ch);
    }
    expect([mapWidth(M), mapHeight(M)]).toEqual([4800, 2700]);
  });

  it('has 4 villages (Burgajet counts), 4 towers, 4 barracks and one of each benefit place', () => {
    const count = (k: string) => M.places.filter((p) => p.kind === k).length;
    expect(count('village') + count('home')).toBe(4);
    expect(count('tower')).toBe(4);
    expect(count('barracks')).toBe(4);
    expect([count('volunteers'), count('stable'), count('messenger')]).toEqual([1, 1, 1]);
    for (const p of M.places) if (p.kind === 'barracks') expect(p.guards![0]).toBeLessThanOrEqual(p.guards![1]);
    expect(new Set(M.places.map((p) => p.id)).size).toBe(M.places.length);
  });

  it('puts every place, the start, the goal, every cache and every waypoint on a passable tile', () => {
    const spots: TilePos[] = [M.start, M.goal, ...M.places.map((p) => p.at), ...M.caches, ...M.messengerRoad, ...M.patrols.flat()];
    for (const at of spots) expect(passable(M, ...tileCentre(M, at)), `tile ${at.join(',')}`).toBe(true);
  });

  it('keeps the 3 × 3 tiles around every place passable (room for the gate guards and the 70-unit ring)', () => {
    for (const p of M.places) {
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) expect(passable(M, ...tileCentre(M, [p.at[0] + dc, p.at[1] + dr])), p.id).toBe(true);
      }
    }
  });

  it('walks every patrol route, road and the messenger road over passable ground only', () => {
    for (const route of [...M.patrols, ...M.roads, M.messengerRoad]) expect(blockedOn(route)).toBeNull();
  });

  it('has 14 patrol routes of 2–6 waypoints: 3 on the Kukës road, 3 in the Mat gorge, 1 on the pass', () => {
    expect(M.patrols).toHaveLength(14);
    for (const r of M.patrols) expect(r.length).toBeGreaterThanOrEqual(2);
    for (const r of M.patrols) expect(r.length).toBeLessThanOrEqual(6);
  });

  it('reaches Tirana, every place and every cache from the border (BFS)', () => {
    const reach = reachableTiles(M, M.start);
    for (const at of [M.goal, ...M.places.map((p) => p.at), ...M.caches]) expect(reach.has(key(at)), `tile ${at.join(',')}`).toBe(true);
  });

  it('crosses the Mat only at the Burrel bridge and the Drin at the Maqellarë bridge and the ford', () => {
    const bridges: string[] = [];
    const fords: string[] = [];
    M.terrain.forEach((row, r) => [...row].forEach((ch, c) => {
      if (ch === 'b') bridges.push(`${c},${r}`);
      if (ch === 'o') fords.push(`${c},${r}`);
    }));
    expect(bridges.sort()).toEqual(['41,24', '69,29']);
    expect(fords).toEqual(['69,37']);
  });
});

describe('map geometry', () => {
  it('reads terrain and speed at world points; outside the map is rock', () => {
    const [x, y] = tileCentre(M, M.start);
    expect(terrainAt(M, x, y)).toBe('=');
    expect(speedAt(M, x, y)).toBe(1);
    expect(terrainAt(M, -1, 10)).toBe('m');
    expect(terrainAt(M, 10, 2700)).toBe('m');
    expect(passable(M, 4800, 10)).toBe(false);
  });

  it('places the world on the atlas: Tirana near (322, 362), the border near Dibra (404, 342 — the play map is stylised)', () => {
    const [tx, ty] = worldToAtlas(M, ...tileCentre(M, M.goal));
    expect(Math.abs(tx - 322)).toBeLessThan(3);
    expect(Math.abs(ty - 362)).toBeLessThan(3);
    const [bx, by] = worldToAtlas(M, ...tileCentre(M, M.start));
    expect(Math.abs(bx - 404)).toBeLessThan(3);
    expect(by).toBeGreaterThan(330);
    expect(by).toBeLessThan(370);
  });
});
```

- [ ] **Step 2: Run it to see it fail.** `npx vitest run tests/diktator/march/map.test.ts` → FAIL (modules missing).

- [ ] **Step 3: Create `minigames/march/map.ts`:**

```ts
// Pochod na Tiranu — the map's types and grid geometry (spec 2026-09-27-diktator-pochod-design §4.2, §4.4). Pure.
// World units: 1 unit = 1 px at camera zoom 1; a tile is `map.tile` units; x grows east, y grows south.

/** One terrain character of the authored grid (spec §4.2 table). */
export type Terrain = '=' | 'b' | '.' | 'f' | 's' | 'o' | '~' | 'm' | 'w';

/** A tile as [col, row]. */
export type TilePos = readonly [number, number];

export type MarchPlaceKind = 'village' | 'tower' | 'barracks' | 'home' | 'volunteers' | 'stable' | 'messenger';

export type MarchPlaceId =
  | 'maqellare' | 'peshkopi' | 'zerqan' | 'bulqize' | 'kukes' | 'lume' | 'burgajet' | 'burrel' | 'selite' | 'klos'
  | 'kruje' | 'preze' | 'homesh' | 'martanesh' | 'posel';

export interface MarchPlaceDef {
  readonly id: MarchPlaceId;
  readonly kind: MarchPlaceKind;
  /** The place stands at this tile's centre (the messenger starts there and walks `messengerRoad`). */
  readonly at: TilePos;
  /** Barracks only: the gate guards' count, drawn from the seed within [min, max]. */
  readonly guards?: readonly [number, number];
}

export interface MarchMap {
  readonly cols: number;
  readonly rows: number;
  /** Units per tile. */
  readonly tile: number;
  /** `rows` strings of `cols` terrain characters, north first. */
  readonly terrain: readonly string[];
  readonly start: TilePos;
  readonly goal: TilePos;
  readonly places: readonly MarchPlaceDef[];
  /** The roads as tile polylines, for drawing the dashed road (the grid's `=` tiles set the speed). */
  readonly roads: readonly (readonly TilePos[])[];
  /** Gendarme patrol routes: tile polylines along the roads, walked back and forth. */
  readonly patrols: readonly (readonly TilePos[])[];
  /** Optional benefit (spec §4.5): hidden supply caches. */
  readonly caches: readonly TilePos[];
  /** Optional benefit (spec §4.5): the Italian messenger's road, walked back and forth; starts at the `posel` place. */
  readonly messengerRoad: readonly TilePos[];
}

/** Speed factor per terrain; 0 = impassable (spec §4.2). */
export const TERRAIN_SPEED: Readonly<Record<Terrain, number>> = {
  '=': 1, b: 1, '.': 0.75, f: 0.55, s: 0.45, o: 0.35, '~': 0, m: 0, w: 0,
};

export const TERRAINS = Object.keys(TERRAIN_SPEED) as readonly Terrain[];

export function mapWidth(map: MarchMap): number {
  return map.cols * map.tile;
}

export function mapHeight(map: MarchMap): number {
  return map.rows * map.tile;
}

/** The terrain under a world point; outside the map counts as mountain rock (impassable). */
export function terrainAt(map: MarchMap, x: number, y: number): Terrain {
  const c = Math.floor(x / map.tile);
  const r = Math.floor(y / map.tile);
  if (c < 0 || r < 0 || c >= map.cols || r >= map.rows) return 'm';
  return map.terrain[r][c] as Terrain;
}

export function speedAt(map: MarchMap, x: number, y: number): number {
  return TERRAIN_SPEED[terrainAt(map, x, y)];
}

export function passable(map: MarchMap, x: number, y: number): boolean {
  return speedAt(map, x, y) > 0;
}

/** The world point at the centre of a tile. */
export function tileCentre(map: MarchMap, at: TilePos): [number, number] {
  return [(at[0] + 0.5) * map.tile, (at[1] + 0.5) * map.tile];
}

/** Every tile reachable from `from` over passable tiles (4-neighbour BFS); keys are `row * cols + col`. */
export function reachableTiles(map: MarchMap, from: TilePos): Set<number> {
  const seen = new Set<number>();
  const passableTile = (c: number, r: number) =>
    c >= 0 && r >= 0 && c < map.cols && r < map.rows && TERRAIN_SPEED[map.terrain[r][c] as Terrain] > 0;
  if (!passableTile(from[0], from[1])) return seen;
  const queue: [number, number][] = [[from[0], from[1]]];
  seen.add(from[1] * map.cols + from[0]);
  while (queue.length > 0) {
    const [c, r] = queue.pop()!;
    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const nc = c + dc;
      const nr = r + dr;
      const key = nr * map.cols + nc;
      if (!seen.has(key) && passableTile(nc, nr)) {
        seen.add(key);
        queue.push([nc, nr]);
      }
    }
  }
  return seen;
}

/**
 * Where the play map sits on the 1921 atlas image (`assets/maps/albania-1921.jpg`, 647 × 698 px): the whole
 * 4800 × 2700 world maps onto this pixel rectangle (Tirana ≈ (322, 362), Dibra ≈ (404, 342), Kukës ≈ (408, 290)).
 */
export const ATLAS_RECT = { x: 309, y: 277, w: 98, h: 108 } as const;
/** The part of the atlas the start and result cards show, 16:9 around the march area. */
export const ATLAS_VIEW = { sx: 228, sy: 250, sw: 256, sh: 144 } as const;

/** A world point on the atlas image, in image pixels. */
export function worldToAtlas(map: MarchMap, x: number, y: number): [number, number] {
  return [ATLAS_RECT.x + (x / mapWidth(map)) * ATLAS_RECT.w, ATLAS_RECT.y + (y / mapHeight(map)) * ATLAS_RECT.h];
}
```

- [ ] **Step 4: Create `minigames/march/rules.ts`** (every tuning number of the march; the regime mapping's numbers go to `RULES.march` in Task 7):

```ts
// Pochod na Tiranu — every tuning number of the march (spec 2026-09-27-diktator-pochod-design §6, §4.5). Data only.

export const MARCH = {
  /** The fixed simulation step, seconds (the game object accumulates real time). */
  step: 1 / 60,
  /** One day is 22 s; 12 days, 13–24 December (§6.1). */
  day: 22,
  days: 12,
  firstDate: 13,
  /** Gold at the start, in 1 000 gold francs (§6.8). */
  startGold: 200,
  /** Units per second before the terrain factor (§6.2). */
  speed: { zogu: 120, velitel: 150, gendarme: 95 },
  /** The rope (§6.3): the longest gap, and the share of it from which the cord is drawn (taut). */
  rope: 320,
  ropeTaut: 0.85,
  /** Places (§6.4): Zogu is "in" a place within this radius. */
  placeRadius: 70,
  /** Ring seconds by kind; villages draw 4–6 s from the seed (`villageRing`). */
  ring: { village: 5, tower: 5, barracks: 8, home: 4, volunteers: 4, stable: 3, messenger: 2 },
  villageRing: [4, 6],
  bribes: [30, 40, 50],
  barracksGold: 20,
  homeGold: 40,
  /** Zogu's wave (flavour) when Action is pressed outside a place, seconds. */
  wave: 1,
  /** Gendarmes (§6.5). */
  spawnEvery: 8,
  spawnSpread: 5,
  maxAlive: 6,
  spawnMin: 600,
  spawnMax: 1400,
  patrolGap: 24,
  sight: 260,
  sightNegotiating: 520,
  giveUp: 700,
  stuckGiveUp: 1.5,
  /** After giving up a chase, a gendarme ignores Zogu this long (no ping-pong against a wall; our addition). */
  blindAfterGiveUp: 3,
  catchRadius: 28,
  ransom: 20,
  frozen: 2,
  immune: 4,
  leaving: 2,
  /** The blow and its effects (§6.6). */
  blowReach: 56,
  blowAnim: 0.3,
  blowCooldown: 0.45,
  knockback: 30,
  stunned: 0.6,
  down: 1.2,
  surrender: 1.5,
  /** Gate guards stand this far from their barracks (inside the spec's 40–60). */
  gateRadius: 50,
  /** Solo helper (§6.7). */
  followStop: 90,
  interceptRange: 200,
  helperCooldown: 0.8,
  /** The end (§6.8). */
  arriveRadius: 90,
  endingSeconds: 3,
  trailEvery: 0.5,
  /** Optional benefits (§4.5). */
  cacheGold: 15,
  cacheRadius: 40,
  horsesFactor: 1.25,
  horsesDays: 2,
  messengerSpeed: 40,
} as const;
```

- [ ] **Step 5: Create `scenario/albania/march-map.ts`:**

```ts
// Pochod na Tiranu — the hand-authored map (spec 2026-09-27-diktator-pochod-design §4.2, §4.3, §4.5). Data only.
// 80 × 45 tiles of 60 units (4800 × 2700). North is up; the Yugoslav border is the east edge, Tirana the south-west.
// Legend: = road, b bridge, . meadow, f forest, s snow, o ford, ~ river, m mountain rock, w lake.
// The Black Drin (x ≈ col 69) is crossed at the Maqellarë bridge (69, 29) and the ford (69, 37); the Mat is crossed
// only at the Burrel bridge (41, 24). Burrel → Krujë: the snowy pass Qafa e Shtamës (rows 21–24) or the Mat gorge
// road past Klos. Kukës is a dead end up the Drin.

import type { MarchMap } from '../../minigames/march/map';

export const ALBANIA_MARCH: MarchMap = {
  cols: 80,
  rows: 45,
  tile: 60,
  terrain: [
  // 0         1         2         3         4         5         6         7
  // 01234567890123456789012345678901234567890123456789012345678901234567890123456789
  '.................................~...................m.........~.....ssmmmmmmmmm', // 0
  '.................................~......m..........mmmmm.......~~....ssmmmmmmmmm', // 1
  '.................................~~...mmmmm.......mmmmmmm.......~~...ssmmmmmmmmm', // 2
  '..................................~...mmmmm......mmmmmmmmm.......~~..ssmmmmmmmmm', // 3
  '..................................~..mmmmmmm......mmmmmmm.........~~.ssmmmmmmmmm', // 4
  '..............................f...~...mmmmm.f......mmmmm...........~.ssmmmmmmmmm', // 5
  '............................fffff.~~..mmmmmffff......m......=====..~~ssmmmmmmmmm', // 6
  '...........................fffffff.~....mfffffff..........===...=...~ssmmmmmmmmm', // 7
  '..........................fffffffff~....fffffffff...............=...~ssmmmmmmmmm', // 8
  '...........................fffffff.~.....fffffff.....fffff......=...~ssmmmmmmmmm', // 9
  '............................fffff..~~.....fffff.....fffffff.....=...~~smmmmmmmmm', // 10
  '..............................f.....~.......f......fffffffff....=....~smmmmmmmmm', // 11
  '....................................~...............fffffff.....=.f..~smmmmmmmmm', // 12
  '......................mmmmmmmmmmmmm.~~...............fffff......=fff.~smmmmmmmmm', // 13
  '......................mmmmmmmmmmmmm..~.....=..............s.....=fff.~smmmmmmmmm', // 14
  '......................mmmmmmmmmmmmm..~.....==..........sssssss..=fff.~smmmmmmmmm', // 15
  '......................mmmmmmmmmmmmm..~~ww...==........ssmmmmmss.=ffff~smmmmmmmmm', // 16
  '............f.........mmmmmmmmmmmmm.ww~www...==....m.ssmmmmmmmss=fff.~smmmmmmmmm', // 17
  '..........fffff.......mmmmmmmmmmmmm..w~~w.....==..mmmsmmmmmmmmms=fff.~smmmmmmmmm', // 18
  '.........fffffff......mmmmmmmmmmmmm....~.......=.mmmmmmmmmmmmmms=fff.~smmmmmmmmm', // 19
  '........fffffffff.....mmmmmsssssmmm....~~.....==.mmmmmmmmmmmmmmm=.f..~smmmmmmmmm', // 20
  '......f..fffffff..........ssssssss......~.....=..mmmmmmmmmmmmmms=....~smmmmmmmmm', // 21
  '....fffff.fffff...........ssssssss......~....==...mmmsmmmmmmmmms=....~smmmmmmmmm', // 22
  '....fffff...f......==.....ssssssss......~~.===.....m.ssmmmmmmmss=....~ssssssssss', // 23
  '...fffffff.........===....ssssssss....===b==.====.....ssmmmmmss.==...~ssssssssss', // 24
  '....fffff........===.==..mmmmmmmmmmmmm=..~~.....===....sssssss...=...~ssssssssss', // 25
  '....fffff........=....=..mmmmmmmmmmmmm=...~.......===.....s......=...~ssssssssss', // 26
  '......f..........=....==.mmmmmmmmmmmmm=...~~........===........====..~..........', // 27
  '..=====.........==.....==mmmmmmmmmmmmm=....~...f......===...====..===~..........', // 28
  '......========..=.......===..........==....~.fffff......=====.......=b=.........', // 29
  '.............====.........===.......==.....~~fffff...................~====......', // 30
  '...............=............===...===.......~ffffff..................~...====...', // 31
  '.............===..............=====.........~~ffff...........fff.....~......==..', // 32
  '............==.................fffff.........~ffff..........fffff....~..........', // 33
  '...........==.................fffffff........~~f...........fffffff...~..........', // 34
  '..........==.................fffffffff........~...........f.fffff....~..........', // 35
  '...................m..........fffffff.........~~........ffffffff.....~....f.....', // 36
  '.................mmmmmf........fffff...........~.......fffffff.......o..fffff...', // 37
  '.................mmmmmffff.mmmmmmmmmmmmmmmm....~~.....fffffffff......~..fffff...', // 38
  '................mmmmmmmffffmmmmmmmmmmmmmmmm.....~......fffffff.......~.fffffff..', // 39
  '.................mmmmmfffffmmmmmmmmmmmmmmmm.....~.......fffff.m......~..fffff...', // 40
  '.................mmmmmfffffmmmmmmmmmmmmmmmm.....~~........f.mmmmm....~..fffff...', // 41
  '...................mffffff.mmmmmmmmmmmmmmmm......~.........mmmmmmm...~....f.....', // 42
  '......................f....mmmmmmmmmmmmmmmm......~~.........mmmmm....~..........', // 43
  '...........................mmmmmmmmmmmmmmmm.......~...........m......~..........', // 44
  ],
  start: [77, 32],
  goal: [10, 35],
  places: [
    { id: 'maqellare', kind: 'village', at: [72, 30] },
    { id: 'peshkopi', kind: 'barracks', at: [65, 27], guards: [3, 4] },
    { id: 'zerqan', kind: 'village', at: [58, 29] },
    { id: 'bulqize', kind: 'tower', at: [53, 27] },
    { id: 'kukes', kind: 'barracks', at: [64, 6], guards: [4, 5] },
    { id: 'lume', kind: 'tower', at: [58, 7] },
    { id: 'burgajet', kind: 'home', at: [47, 19] },
    { id: 'burrel', kind: 'barracks', at: [44, 23], guards: [2, 3] },
    { id: 'selite', kind: 'tower', at: [43, 14] },
    { id: 'klos', kind: 'village', at: [36, 31] },
    { id: 'kruje', kind: 'barracks', at: [20, 23], guards: [3, 4] },
    { id: 'preze', kind: 'tower', at: [16, 30] },
    // Optional benefits (spec §4.5): detours, never required.
    { id: 'homesh', kind: 'stable', at: [56, 34] },
    { id: 'martanesh', kind: 'volunteers', at: [52, 38] },
    { id: 'posel', kind: 'messenger', at: [10, 29] },
  ],
  roads: [
    [[77, 32], [72, 30], [69, 29], [65, 27], [61, 28], [58, 29], [55, 28], [53, 27], [49, 25], [44, 23]],
    [[44, 23], [41, 24], [38, 24]],
    [[38, 24], [38, 28], [36, 31], [31, 32], [25, 29], [22, 26], [20, 23]],
    [[20, 23], [17, 26], [16, 30], [13, 33], [10, 35]],
    [[16, 30], [10, 29], [2, 28]],
    [[65, 27], [64, 21], [64, 12], [64, 6], [61, 6], [58, 7]],
    [[44, 23], [46, 21], [47, 19], [45, 16], [43, 14]],
  ],
  patrols: [
    [[77, 32], [72, 30], [69, 29]],
    [[65, 27], [61, 28], [58, 29]],
    [[58, 29], [55, 28], [53, 27], [49, 25]],
    [[49, 25], [44, 23], [41, 24]],
    [[65, 27], [64, 21], [64, 12]], // Kukës road ×3
    [[64, 12], [64, 6]],
    [[64, 6], [61, 6], [58, 7]],
    [[44, 23], [46, 21], [47, 19], [45, 16], [43, 14]],
    [[37, 23], [33, 23], [27, 22], [23, 23]], // the pass ×1
    [[38, 24], [38, 28], [36, 31]], // the Mat gorge ×3
    [[36, 31], [31, 32], [25, 29]],
    [[25, 29], [22, 26], [20, 23]],
    [[20, 23], [17, 26], [16, 30]],
    [[16, 30], [13, 33], [10, 35]],
  ],
  caches: [[75, 40], [60, 13], [28, 35]],
  messengerRoad: [[10, 29], [2, 28]],
};
```

- [ ] **Step 6: Run and commit.** `npx vitest run tests/diktator/march/map.test.ts` → PASS (10 tests). `npm test` green, `npx tsc --noEmit` clean.

```bash
git add src/games/diktator/minigames/march/map.ts src/games/diktator/minigames/march/rules.ts src/games/diktator/scenario/albania/march-map.ts tests/diktator/march/map.test.ts
git commit -m "feat(diktator): Pochod — the march map, its geometry and tuning" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: The simulation core — clock, walking, terrain, the rope, the end

**Files:**
- Create: `src/games/diktator/minigames/march/state.ts`, `minigames/march/move.ts`, `minigames/march/logic.ts`
- Test: `tests/diktator/march/helpers.ts`, `tests/diktator/march/logic.test.ts`

Design notes:
- `state.ts` holds **every** field the later tasks use (places, foes, benefits), so the type never changes again. Tasks 3–6 only add behaviour and each inserts a few lines into `logic.ts`.
- Two clocks:
  - `now` counts simulated seconds and never jumps. Every timer (freeze, immunity, cooldowns, stun, spawns, trail, the ending) uses `now`.
  - `t` is the march clock. A catch adds a whole day (22 s) to it. The date, the timeout and the horses use `t`.
- The rope (§6.3) is a projection after both heroes have moved. The hero who moved away takes the correction. If the pull would put someone into rock or water, the other hero takes all of it. If neither can, both return to their positions before the tick. So the gap never exceeds 320, and sideways moves stay free.

- [ ] **Step 1: Write the test helpers.** Create `tests/diktator/march/helpers.ts`:

```ts
// Shared helpers for the march tests (plan 2026-09-27-diktator-pochod).

import type { Hero } from '../../../src/games/diktator/logic/palace';
import { stepMarch } from '../../../src/games/diktator/minigames/march/logic';
import type { MarchMap, MarchPlaceDef, TilePos } from '../../../src/games/diktator/minigames/march/map';
import { MARCH } from '../../../src/games/diktator/minigames/march/rules';
import type { MarchEvent, MarchInput, MarchState } from '../../../src/games/diktator/minigames/march/state';

export const IDLE: MarchInput = { moveX: 0, moveY: 0, action: false, held: false };
export const go = (moveX: number, moveY: number): MarchInput => ({ moveX, moveY, action: false, held: false });
export const HOLD: MarchInput = { moveX: 0, moveY: 0, action: false, held: true };
export const PRESS: MarchInput = { moveX: 0, moveY: 0, action: true, held: true };

/** Steps the march for `seconds` at the fixed step; returns every event. */
export function run(
  s: MarchState, seconds: number, inputs: Partial<Record<Hero, MarchInput>> = {}, active: Hero = 'zogu',
): MarchEvent[] {
  const out: MarchEvent[] = [];
  const n = Math.round(seconds / MARCH.step);
  for (let i = 0; i < n; i++) out.push(...stepMarch(s, MARCH.step, inputs, active));
  return out;
}

/** A small hand-made map for movement and rope tests: no patrols, no caches. */
export function testMap(terrain: readonly string[], places: readonly MarchPlaceDef[] = []): MarchMap {
  const goal: TilePos = [terrain[0].length - 1, terrain.length - 2];
  return {
    cols: terrain[0].length, rows: terrain.length, tile: 60, terrain, start: [1, 0], goal, places,
    roads: [], patrols: [], caches: [], messengerRoad: [[0, 0], [1, 0]],
  };
}

/** 20 × 12: a road, meadow, forest, snow, ford, a rock wall at (5–9, 6), a river along the bottom. */
export const PLAYGROUND = testMap([
  '====================',
  '....................',
  'ffffffffffffffffffff',
  'ssssssssssssssssssss',
  'oooooooooooooooooooo',
  '....................',
  '.....mmmmm..........',
  '....................',
  '....................',
  '....................',
  '....................',
  '~~~~~~~~~~~~~~~~~~~~',
]);

export function place(s: MarchState, hero: Hero, x: number, y: number): void {
  s.heroes[hero].x = x;
  s.heroes[hero].y = y;
}

/** A deterministic pseudo-random input stream (for property and determinism tests). */
export function noise(seed: number): () => MarchInput {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), a | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  let hold: MarchInput = { moveX: 0, moveY: 0, action: false, held: false };
  let left = 0;
  return () => {
    if (left-- <= 0) {
      left = 10 + Math.floor(next() * 50);
      hold = { moveX: Math.round(next() * 2 - 1), moveY: Math.round(next() * 2 - 1), action: false, held: next() < 0.3 };
    }
    return { ...hold, action: next() < 0.05 };
  };
}
```

- [ ] **Step 2: Write the tests.** Create `tests/diktator/march/logic.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { createMarch, marchResult, stepMarch } from '../../../src/games/diktator/minigames/march/logic';
import { tileCentre } from '../../../src/games/diktator/minigames/march/map';
import { applyRope } from '../../../src/games/diktator/minigames/march/move';
import { MARCH } from '../../../src/games/diktator/minigames/march/rules';
import { cameraOf, dateOf, dist, MARCH_END } from '../../../src/games/diktator/minigames/march/state';
import { ALBANIA_MARCH } from '../../../src/games/diktator/scenario/albania/march-map';
import { go, IDLE, noise, place, PLAYGROUND, run } from './helpers';

describe('the clock', () => {
  it('dates 13 December at t = 0, the next day at 22 s, Christmas Eve on the last day', () => {
    expect(dateOf(0)).toBe(13);
    expect(dateOf(21.9)).toBe(13);
    expect(dateOf(22)).toBe(14);
    expect(dateOf(263.9)).toBe(24);
    expect(MARCH_END).toBe(264);
  });

  it('announces a new day', () => {
    const s = createMarch(PLAYGROUND, 1, false);
    s.t = 21.99;
    const events = stepMarch(s, MARCH.step, {});
    expect(events).toContainEqual({ type: 'day', date: 14 });
  });

  it('ends at 264 s as a timeout, with the result 3 s later', () => {
    const s = createMarch(PLAYGROUND, 1, false);
    s.t = MARCH_END - 0.005;
    const events = stepMarch(s, MARCH.step, {});
    expect(events).toContainEqual({ type: 'timeout' });
    expect(s.ending?.kind).toBe('timeout');
    expect(marchResult(s)).toBeNull();
    run(s, 3.1);
    expect(marchResult(s)?.arrivedDay).toBeNull();
  });
});

describe('movement and terrain', () => {
  const speedOn = (row: number) => {
    const s = createMarch(PLAYGROUND, 1, false, { startAt: [2, row] });
    const x0 = s.heroes.zogu.x;
    run(s, 0.5, { zogu: go(1, 0) });
    return s.heroes.zogu.x - x0;
  };

  it('walks 120 units/s on the road, slower on meadow, forest, snow and a ford', () => {
    expect(speedOn(0)).toBeCloseTo(60, 0);
    expect(speedOn(1)).toBeCloseTo(45, 0);
    expect(speedOn(2)).toBeCloseTo(33, 0);
    expect(speedOn(3)).toBeCloseTo(27, 0);
    expect(speedOn(4)).toBeCloseTo(21, 0);
  });

  it('clamps a diagonal to length 1 and faces the last horizontal direction', () => {
    const s = createMarch(PLAYGROUND, 1, false, { startAt: [10, 8] });
    const z = s.heroes.zogu;
    const [x0, y0] = [z.x, z.y];
    run(s, 0.5, { zogu: go(-1, 1) });
    expect(Math.hypot(z.x - x0, z.y - y0)).toBeCloseTo(45, 0);
    expect(z.facing).toBe(-1);
    run(s, 0.1, { zogu: go(0, -1) });
    expect(z.facing).toBe(-1);
    expect(z.moving).toBe(true);
    run(s, 0.1, {});
    expect(z.moving).toBe(false);
  });

  it('stops at rock and slides along it', () => {
    const s = createMarch(PLAYGROUND, 1, false, { startAt: [6, 5] });
    const z = s.heroes.zogu;
    run(s, 2, { zogu: go(0, 1) });
    expect(z.y).toBeLessThan(360);
    const x0 = z.x;
    run(s, 0.5, { zogu: go(1, 1) });
    expect(z.x).toBeGreaterThan(x0 + 30);
    expect(z.y).toBeLessThan(360);
  });

  it('never enters a river', () => {
    const s = createMarch(PLAYGROUND, 1, false, { startAt: [3, 10] });
    run(s, 3, { zogu: go(0, 1), velitel: go(0, 1) });
    expect(s.heroes.zogu.y).toBeLessThan(660);
    expect(s.heroes.velitel.y).toBeLessThan(660);
  });
});

describe('the rope', () => {
  it('stops the pair at 320 units apart', () => {
    const s = createMarch(PLAYGROUND, 1, false, { startAt: [3, 8] });
    run(s, 4, { velitel: go(1, 0) });
    expect(dist(s.heroes.zogu, s.heroes.velitel)).toBeCloseTo(MARCH.rope, 3);
  });

  it('allows sideways moves and moving closer when taut', () => {
    const s = createMarch(PLAYGROUND, 1, false, { startAt: [3, 9] });
    run(s, 4, { velitel: go(1, 0) });
    const v = s.heroes.velitel;
    const y0 = v.y;
    run(s, 0.5, { velitel: go(0, -1) });
    expect(v.y).toBeLessThan(y0 - 50);
    expect(dist(s.heroes.zogu, v)).toBeLessThanOrEqual(MARCH.rope + 1e-6);
    const d0 = dist(s.heroes.zogu, v);
    run(s, 0.5, { velitel: go(-1, 0) });
    expect(dist(s.heroes.zogu, v)).toBeLessThan(d0 - 50);
  });

  it('pulls back only the hero who moved away', () => {
    const map = PLAYGROUND;
    const z = { x: 100, y: 500 };
    const v = { x: 425, y: 500 };
    applyRope(map, z, v, { x: 100, y: 500 }, { x: 420, y: 500 }, 320);
    expect(z).toEqual({ x: 100, y: 500 });
    expect(v.x).toBeCloseTo(420, 6);
  });

  it('never lets the pair drift more than 320 apart (random inputs, many seeds, the real map)', () => {
    for (let seed = 1; seed <= 12; seed++) {
      const s = createMarch(ALBANIA_MARCH, seed, false);
      const zi = noise(seed * 7);
      const vi = noise(seed * 13 + 1);
      for (let i = 0; i < 1800; i++) {
        stepMarch(s, MARCH.step, { zogu: zi(), velitel: vi() });
        expect(dist(s.heroes.zogu, s.heroes.velitel)).toBeLessThanOrEqual(MARCH.rope + 1e-6);
      }
    }
  });
});

describe('camera, trail and the end', () => {
  it('centres the camera on the pair, clamped to the map', () => {
    const s = createMarch(ALBANIA_MARCH, 1, false);
    const c = cameraOf(s);
    expect(c.x).toBe(4800 - 480);
    place(s, 'zogu', 2000, 1500);
    place(s, 'velitel', 2100, 1500);
    expect(cameraOf(s)).toEqual({ x: 2050, y: 1500 });
  });

  it('samples Zogu’s path every half second', () => {
    const s = createMarch(PLAYGROUND, 1, false, { startAt: [2, 0] });
    run(s, 10, { zogu: go(1, 0) });
    expect(s.trail.length).toBeGreaterThanOrEqual(20);
    expect(s.trail.length).toBeLessThanOrEqual(21);
    expect(s.trail[s.trail.length - 1][0]).toBeGreaterThan(s.trail[0][0]);
  });

  it('arrives when Zogu reaches Tirana, with the date, and returns the result after 3 s', () => {
    const s = createMarch(ALBANIA_MARCH, 3, false);
    const [gx, gy] = tileCentre(ALBANIA_MARCH, ALBANIA_MARCH.goal);
    place(s, 'zogu', gx + 80, gy);
    place(s, 'velitel', gx + 120, gy);
    s.t = 5 * 22 + 3;
    const events = stepMarch(s, MARCH.step, {});
    expect(events).toContainEqual({ type: 'arrived', date: 18 });
    expect(marchResult(s)).toBeNull();
    run(s, 2.9);
    expect(marchResult(s)).toBeNull();
    run(s, 0.2);
    const r = marchResult(s)!;
    expect(r.arrivedDay).toBe(18);
    expect(r.gold).toBe(200);
    expect(r.trail.length).toBeGreaterThan(0);
  });

  it('freezes everything after the end', () => {
    const s = createMarch(PLAYGROUND, 1, false);
    s.t = MARCH_END;
    stepMarch(s, MARCH.step, {});
    const z = { ...s.heroes.zogu };
    run(s, 1, { zogu: go(1, 0) });
    expect(s.heroes.zogu.x).toBe(z.x);
  });
});

describe('determinism', () => {
  it('gives the same state for the same seed and inputs', () => {
    const play = () => {
      const s = createMarch(ALBANIA_MARCH, 42, false);
      const zi = noise(5);
      const vi = noise(6);
      for (let i = 0; i < 3000; i++) stepMarch(s, MARCH.step, { zogu: zi(), velitel: vi() });
      return s;
    };
    expect(play()).toEqual(play());
  });

  it('keeps the starting state free of randomness except the seeded variants', () => {
    const a = createMarch(ALBANIA_MARCH, 1, false);
    expect(a.gold).toBe(200);
    expect(a.t).toBe(0);
    expect(dist(a.heroes.zogu, a.heroes.velitel)).toBe(40);
    stepMarch(a, MARCH.step, { zogu: IDLE });
    expect(a.now).toBeCloseTo(MARCH.step, 9);
  });
});
```

- [ ] **Step 3: Run to see it fail.** `npx vitest run tests/diktator/march/logic.test.ts` → FAIL.

- [ ] **Step 4: Create `minigames/march/state.ts`:**

```ts
// Pochod na Tiranu — the simulation's state, inputs, events and result (spec 2026-09-27-diktator-pochod-design §6).
// Types plus a few pure helpers every march module shares.

import type { RngState } from '../../../../shared/rng';
import type { Hero } from '../../logic/palace';
import { ARENA_H, ARENA_W } from '../arena';
import { mapHeight, mapWidth, type MarchMap, type MarchPlaceDef } from './map';
import { MARCH } from './rules';

/** One hero's input for one tick. */
export interface MarchInput {
  readonly moveX: number;
  readonly moveY: number;
  /** Action went down this tick: Vlček strikes, Zogu waves (outside a place). */
  readonly action: boolean;
  /** Action is held this tick: Zogu negotiates. */
  readonly held: boolean;
}

export const IDLE_INPUT: MarchInput = { moveX: 0, moveY: 0, action: false, held: false };

export interface Point {
  x: number;
  y: number;
}

/** Anything that walks on the map; (x, y) are the feet. */
export interface Figure extends Point {
  /** The direction of the last horizontal movement: 1 = east (right), -1 = west. */
  facing: 1 | -1;
  /** Moved this tick (the render plays the walk pose). */
  moving: boolean;
}

export interface HeroFigure extends Figure {
  /** Zogu is held (after a catch) until this `now`. */
  frozenUntil: number;
  /** Zogu cannot be caught until this `now`. */
  immuneUntil: number;
  /** Vlček: the blow animation runs until this `now`; Zogu: he waves until this `now`. */
  actUntil: number;
  /** Vlček: the next blow may start at this `now`. */
  cooldownUntil: number;
}

export interface PlaceState extends Point {
  readonly def: MarchPlaceDef;
  /** Seconds of negotiation needed (villages: seeded 4–6). */
  readonly ring: number;
  /** A tower's bribe in gold (0 elsewhere). */
  readonly bribe: number;
  /** Seconds negotiated so far; kept when Zogu walks away or is caught. */
  progress: number;
  won: boolean;
  /** The messenger only: the index of his next road point and the walking direction. */
  wp: number;
  dir: 1 | -1;
}

export type FoeMode = 'wait' | 'patrol' | 'chase' | 'return' | 'post' | 'stunned' | 'down' | 'surrender' | 'leaving';

export interface Foe extends Figure {
  readonly id: number;
  /** A patrol gendarme of Noli's, or a barracks gate guard (the army). */
  readonly kind: 'gendarme' | 'guard';
  mode: FoeMode;
  /** When a timed mode ends (wait, stunned, down, surrender, leaving) or, in `return`, until when he is blind. */
  until: number;
  /** Blows taken: 1 = stunned, 2 = knocked out. */
  hits: number;
  /** Gendarmes: the route (index into `map.patrols`), the next waypoint, the direction and the patrol they came in. */
  readonly route: number;
  wp: number;
  dir: 1 | -1;
  readonly squad: number;
  /** Seconds the chase or the return has been blocked by terrain. */
  stuck: number;
  /** Gate guards: their barracks (index into `places`) and their post. -1 / the spawn point for gendarmes. */
  readonly place: number;
  readonly homeX: number;
  readonly homeY: number;
}

export type MarchEvent =
  | { readonly type: 'day'; readonly date: number }
  | { readonly type: 'tick' }
  | { readonly type: 'won'; readonly place: number }
  | { readonly type: 'refused'; readonly place: number; readonly reason: 'noGold' | 'locked' }
  /** Gold gained (> 0: a barracks chest, Burgajet, a cache) or paid (< 0: a bribe, the ransom). */
  | { readonly type: 'coins'; readonly amount: number }
  | { readonly type: 'swing' }
  | { readonly type: 'hit'; readonly down: boolean }
  | { readonly type: 'surrendered'; readonly kind: 'gendarme' | 'guard' }
  | { readonly type: 'spawned'; readonly squad: number; readonly size: number }
  | { readonly type: 'caught' }
  | { readonly type: 'cache'; readonly index: number }
  | { readonly type: 'arrived'; readonly date: number }
  | { readonly type: 'timeout' };

export interface MarchState {
  readonly map: MarchMap;
  readonly solo: boolean;
  rng: RngState;
  /** Simulated seconds since the start: monotonic, drives every timer and animation. */
  now: number;
  /** The march clock: `now` plus the days lost to catches. The date is 13 + ⌊t / 22⌋. */
  t: number;
  heroes: Record<Hero, HeroFigure>;
  places: PlaceState[];
  foes: Foe[];
  nextFoeId: number;
  nextSquad: number;
  /** The next spawn try, `now` seconds. */
  nextSpawnAt: number;
  gold: number;
  villages: number;
  towers: number;
  barracks: number;
  /** Noli's gendarmes who surrendered. */
  captured: number;
  /** Times Zogu was caught. */
  caught: number;
  /** Gate guards who joined the column (followers). */
  joined: number;
  /** Optional benefits (spec §4.5): caches taken (by index), the volunteers, the horses and the messenger. */
  caches: boolean[];
  volunteers: boolean;
  messenger: boolean;
  horses: boolean;
  /** The horses carry the pair while `t` is below this (march clock). */
  horsesUntil: number;
  /** The place Zogu negotiates at this tick (doubles the gendarmes' sight), or -1. */
  negotiating: number;
  /** Zogu's path, sampled every `MARCH.trailEvery` s. */
  trail: [number, number][];
  trailNext: number;
  ending: { readonly kind: 'arrived' | 'timeout'; readonly at: number } | null;
  arrivedDay: number | null;
}

export interface MarchResult {
  /** 0..4 (Burgajet counts). */
  readonly villages: number;
  readonly towers: number;
  readonly barracks: number;
  /** Gendarmes who surrendered. */
  readonly captured: number;
  /** Times Zogu was caught (for the card only). */
  readonly caught: number;
  /** Gold left, ≥ 0. */
  readonly gold: number;
  /** 13..24, or null = after Christmas (timeout). */
  readonly arrivedDay: number | null;
  /** Zogu's path, sampled every 0.5 s (the result card). */
  readonly trail: readonly (readonly [number, number])[];
  /** Optional benefits (spec §4.5). */
  readonly caches: number;
  readonly volunteers: boolean;
  readonly messenger: boolean;
  readonly horses: boolean;
}

/** The December date of a march-clock time: 13 at t = 0, 24 on the last day (clamped). */
export function dateOf(t: number): number {
  return MARCH.firstDate + Math.max(0, Math.min(MARCH.days - 1, Math.floor(t / MARCH.day)));
}

/** The march is over at the end of Christmas Eve. */
export const MARCH_END = MARCH.day * MARCH.days;

export function dist(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** The camera centre: the pair's midpoint, clamped so the 960 × 540 view stays on the map. */
export function cameraOf(s: MarchState): Point {
  const z = s.heroes.zogu;
  const v = s.heroes.velitel;
  const clamp = (v0: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v0));
  return {
    x: clamp((z.x + v.x) / 2, ARENA_W / 2, mapWidth(s.map) - ARENA_W / 2),
    y: clamp((z.y + v.y) / 2, ARENA_H / 2, mapHeight(s.map) - ARENA_H / 2),
  };
}
```

- [ ] **Step 5: Create `minigames/march/move.ts`:**

```ts
// Pochod na Tiranu — walking over terrain and the rope (spec 2026-09-27-diktator-pochod-design §6.2, §6.3). Pure.

import { passable, speedAt, type MarchMap } from './map';
import type { Figure, Point } from './state';

/**
 * Moves a figure by (dx, dy), x first, then y. A move into an impassable tile is cancelled on that axis only, so
 * figures slide along walls. Returns the distance actually moved.
 */
export function moveFigure(map: MarchMap, f: Point, dx: number, dy: number): number {
  const x0 = f.x;
  const y0 = f.y;
  if (dx !== 0 && passable(map, f.x + dx, f.y)) f.x += dx;
  if (dy !== 0 && passable(map, f.x, f.y + dy)) f.y += dy;
  return Math.hypot(f.x - x0, f.y - y0);
}

/**
 * Walks a figure for `dt` s along the direction (mx, my) — clamped to length 1 — at `speed` units/s times the terrain
 * factor under its feet. Updates `facing` (last horizontal direction) and `moving`. Returns the distance moved.
 */
export function walk(map: MarchMap, f: Figure, mx: number, my: number, speed: number, dt: number): number {
  const len = Math.hypot(mx, my);
  if (len === 0) {
    f.moving = false;
    return 0;
  }
  const k = (Math.min(1, len) / len) * speed * speedAt(map, f.x, f.y) * dt;
  const moved = moveFigure(map, f, mx * k, my * k);
  if (mx !== 0) f.facing = mx > 0 ? 1 : -1;
  f.moving = moved > 1e-6;
  return moved;
}

/** Walks a figure straight towards (tx, ty), never overshooting. Returns the distance moved. */
export function walkTo(map: MarchMap, f: Figure, tx: number, ty: number, speed: number, dt: number): number {
  const d = Math.hypot(tx - f.x, ty - f.y);
  if (d < 1e-6) {
    f.moving = false;
    return 0;
  }
  const step = speed * speedAt(map, f.x, f.y) * dt;
  const k = Math.min(1, d / Math.max(step, 1e-9));
  return walk(map, f, ((tx - f.x) / d) * k, ((ty - f.y) / d) * k, speed, dt);
}

/**
 * The rope (§6.3): if Zogu and Vlček ended the tick more than `rope` apart, the pair is pulled back to exactly `rope`
 * along the line between them. The hero who moved away takes the correction (split by how far each moved away). If
 * the pull would put a hero into rock or water, the other takes it all; if neither can, both return to where they
 * were before the tick (which was within the rope). So the gap never exceeds `rope`, and sideways moves stay free.
 */
export function applyRope(map: MarchMap, z: Point, v: Point, prevZ: Point, prevV: Point, rope: number): void {
  const dx = v.x - z.x;
  const dy = v.y - z.y;
  const d = Math.hypot(dx, dy);
  if (d <= rope) return;
  const ux = dx / d;
  const uy = dy / d;
  const awayV = Math.max(0, (v.x - prevV.x) * ux + (v.y - prevV.y) * uy);
  const awayZ = Math.max(0, -((z.x - prevZ.x) * ux + (z.y - prevZ.y) * uy));
  const excess = d - rope;
  const tryPull = (shareV: number): boolean => {
    const vx = v.x - ux * excess * shareV;
    const vy = v.y - uy * excess * shareV;
    const zx = z.x + ux * excess * (1 - shareV);
    const zy = z.y + uy * excess * (1 - shareV);
    if (!passable(map, vx, vy) || !passable(map, zx, zy)) return false;
    v.x = vx;
    v.y = vy;
    z.x = zx;
    z.y = zy;
    return true;
  };
  const share = awayV + awayZ > 0 ? awayV / (awayV + awayZ) : 0.5;
  if (tryPull(share) || tryPull(1) || tryPull(0)) return;
  v.x = prevV.x;
  v.y = prevV.y;
  z.x = prevZ.x;
  z.y = prevZ.y;
}
```

- [ ] **Step 6: Create `minigames/march/logic.ts`** (this Task 2 version has no places, foes, benefits or helper yet; Tasks 3–6 add one line each where the comment `// 2. …` sits):

```ts
// Pochod na Tiranu — the march simulation (spec 2026-09-27-diktator-pochod-design §6). Pure and seeded: no DOM,
// canvas, audio or Math.random; the same map, seed and inputs always give the same state. Call `stepMarch` with the
// fixed step `MARCH.step` (the game object accumulates real time).

import { makeRng } from '../../../../shared/rng';
import { HEROES, type Hero } from '../../logic/palace';
import { tileCentre, type MarchMap } from './map';
import { applyRope, walk } from './move';
import { MARCH } from './rules';
import {
  dateOf, dist, IDLE_INPUT, MARCH_END,
  type HeroFigure, type MarchEvent, type MarchInput, type MarchResult, type MarchState,
} from './state';

export interface MarchOptions {
  /** DEV only (`?march=short`): start the pair on this tile and the clock at this march time. */
  readonly startAt?: readonly [number, number];
  readonly startT?: number;
}

function hero(x: number, y: number): HeroFigure {
  return { x, y, facing: -1, moving: false, frozenUntil: 0, immuneUntil: 0, actUntil: 0, cooldownUntil: 0 };
}

export function createMarch(map: MarchMap, seed: number, solo: boolean, opts: MarchOptions = {}): MarchState {
  const rng = makeRng(seed);
  const [x, y] = tileCentre(map, opts.startAt ?? map.start);
  const s: MarchState = {
    map, solo, rng, now: 0, t: opts.startT ?? 0,
    heroes: { zogu: hero(x, y), velitel: hero(x - 40, y) },
    places: [], foes: [], nextFoeId: 1, nextSquad: 1, nextSpawnAt: MARCH.spawnEvery,
    gold: MARCH.startGold, villages: 0, towers: 0, barracks: 0, captured: 0, caught: 0, joined: 0,
    caches: map.caches.map(() => false), volunteers: false, messenger: false, horses: false, horsesUntil: -1,
    negotiating: -1, trail: [[Math.round(x), Math.round(y)]], trailNext: MARCH.trailEvery,
    ending: null, arrivedDay: null,
  };
  return s;
}

/** The hero's walking speed: its base speed, times 1.25 while the bey's horses carry the pair (spec §4.5). */
function heroSpeed(s: MarchState, h: Hero): number {
  return MARCH.speed[h] * (s.t < s.horsesUntil ? MARCH.horsesFactor : 1);
}

/**
 * Advances the march by `dt` seconds. `inputs` holds the seated heroes' inputs; in solo play only `active` is
 * steered and the other hero is the solo helper (§6.7). Returns what happened this tick (for sounds and bubbles).
 */
export function stepMarch(
  s: MarchState, dt: number, inputs: Readonly<Partial<Record<Hero, MarchInput>>>, active: Hero = 'zogu',
): MarchEvent[] {
  const events: MarchEvent[] = [];
  s.now += dt;
  if (s.ending) return events;
  const dayBefore = dateOf(s.t);
  s.t += dt;
  const input = (h: Hero): MarchInput => (s.solo && h !== active ? IDLE_INPUT : inputs[h] ?? IDLE_INPUT);
  const zin = input('zogu');
  const vin = input('velitel');

  // 1. The heroes walk (a held Zogu stands still), then the rope pulls them back together.
  const z = s.heroes.zogu;
  const v = s.heroes.velitel;
  const prevZ = { x: z.x, y: z.y };
  const prevV = { x: v.x, y: v.y };
  if (s.now < z.frozenUntil) z.moving = false;
  else walk(s.map, z, zin.moveX, zin.moveY, heroSpeed(s, 'zogu'), dt);
  walk(s.map, v, vin.moveX, vin.moveY, heroSpeed(s, 'velitel'), dt);
  applyRope(s.map, z, v, prevZ, prevV, MARCH.rope);
  for (const h of HEROES) {
    const f = s.heroes[h];
    const p = h === 'zogu' ? prevZ : prevV;
    f.moving = Math.hypot(f.x - p.x, f.y - p.y) > 1e-6;
  }

  // 2. Negotiation, Vlček's blow, the gendarmes, the optional benefits.

  // 3. The trail, the day banner and the end.
  if (s.now >= s.trailNext) {
    s.trail.push([Math.round(z.x), Math.round(z.y)]);
    s.trailNext += MARCH.trailEvery;
  }
  const [gx, gy] = tileCentre(s.map, s.map.goal);
  if (dist(z, { x: gx, y: gy }) <= MARCH.arriveRadius) {
    s.arrivedDay = dateOf(s.t);
    s.ending = { kind: 'arrived', at: s.now };
    events.push({ type: 'arrived', date: s.arrivedDay });
  } else if (s.t >= MARCH_END) {
    s.arrivedDay = null;
    s.ending = { kind: 'timeout', at: s.now };
    events.push({ type: 'timeout' });
  } else if (dateOf(s.t) !== dayBefore) {
    events.push({ type: 'day', date: dateOf(s.t) });
  }
  return events;
}

/** The result once the ending animation (3 s) has played, else null. */
export function marchResult(s: MarchState): MarchResult | null {
  if (!s.ending || s.now - s.ending.at < MARCH.endingSeconds) return null;
  return {
    villages: s.villages,
    towers: s.towers,
    barracks: s.barracks,
    captured: s.captured,
    caught: s.caught,
    gold: s.gold,
    arrivedDay: s.arrivedDay,
    trail: s.trail.map(([x, y]) => [x, y] as const),
    caches: s.caches.filter(Boolean).length,
    volunteers: s.volunteers,
    messenger: s.messenger,
    horses: s.horses,
  };
}
```

- [ ] **Step 7: Run and commit.** `npx vitest run tests/diktator/march` → PASS. `npm test`, `npx tsc --noEmit`.

```bash
git add src/games/diktator/minigames/march/state.ts src/games/diktator/minigames/march/move.ts src/games/diktator/minigames/march/logic.ts tests/diktator/march/helpers.ts tests/diktator/march/logic.test.ts
git commit -m "feat(diktator): Pochod — clock, walking, terrain and the rope" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Places and negotiation

**Files:**
- Create: `src/games/diktator/minigames/march/places.ts`
- Modify: `src/games/diktator/minigames/march/logic.ts`
- Test: `tests/diktator/march/places.test.ts`

Notes:
- The seeded variants are drawn in `createPlaces`, in map order, from the march RNG: each village's ring is `4 + randInt(3)` s and each tower's bribe is `pick([30, 40, 50])`.
- The reward switch already books the three benefit places (volunteers, stable, messenger), because their flags live in the state. Task 5 tests them.
- `refused` is emitted only on the Action **press** (`action` edge), so holding the button does not spam bubbles.
- The barracks lock reads `s.foes`. Until Task 4 creates the gate guards there are none, so every barracks is open.

- [ ] **Step 1: Write the tests.** Create `tests/diktator/march/places.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { createMarch } from '../../../src/games/diktator/minigames/march/logic';
import type { MarchPlaceId } from '../../../src/games/diktator/minigames/march/map';
import { zoguPlace } from '../../../src/games/diktator/minigames/march/places';
import { MARCH } from '../../../src/games/diktator/minigames/march/rules';
import type { MarchState } from '../../../src/games/diktator/minigames/march/state';
import { ALBANIA_MARCH } from '../../../src/games/diktator/scenario/albania/march-map';
import { go, HOLD, place, PRESS, run } from './helpers';

/** A fresh march with no gendarmes and no gate guards, and the index of place `id`. */
function at(id: MarchPlaceId, seed = 1): { s: MarchState; i: number } {
  const s = createMarch(ALBANIA_MARCH, seed, false);
  s.foes = [];
  s.nextSpawnAt = Infinity;
  const i = s.places.findIndex((p) => p.def.id === id);
  place(s, 'zogu', s.places[i].x, s.places[i].y);
  place(s, 'velitel', s.places[i].x - 40, s.places[i].y);
  return { s, i };
}

describe('seeded variants', () => {
  it('draws village rings of 4–6 s and tower bribes of 30/40/50; the rest is fixed', () => {
    const rings = new Set<number>();
    const bribes = new Set<number>();
    for (let seed = 1; seed <= 60; seed++) {
      const s = createMarch(ALBANIA_MARCH, seed, false);
      for (const p of s.places) {
        if (p.def.kind === 'village') rings.add(p.ring);
        else expect(p.ring).toBe(MARCH.ring[p.def.kind]);
        if (p.def.kind === 'tower') bribes.add(p.bribe);
        else expect(p.bribe).toBe(0);
      }
    }
    expect([...rings].sort()).toEqual([4, 5, 6]);
    expect([...bribes].sort()).toEqual([30, 40, 50]);
  });
});

describe('negotiation', () => {
  it('fills the ring only while Action is held inside the place, and keeps the progress outside', () => {
    const { s, i } = at('maqellare');
    const p = s.places[i];
    run(s, 1, { zogu: HOLD });
    expect(p.progress).toBeCloseTo(1, 1);
    expect(s.negotiating).toBe(i);
    run(s, 1, {});
    expect(p.progress).toBeCloseTo(1, 1);
    expect(s.negotiating).toBe(-1);
    run(s, 1.5, { zogu: go(1, 0) });
    expect(zoguPlace(s)).toBe(-1);
    run(s, 1, { zogu: HOLD });
    expect(p.progress).toBeCloseTo(1, 1);
  });

  it('wins a village once, with a tick every second', () => {
    const { s, i } = at('zerqan');
    const p = s.places[i];
    const events = run(s, p.ring + 0.1, { zogu: HOLD });
    expect(p.won).toBe(true);
    expect(s.villages).toBe(1);
    expect(events.filter((e) => e.type === 'won')).toEqual([{ type: 'won', place: i }]);
    expect(events.filter((e) => e.type === 'tick').length).toBe(p.ring - 1);
    run(s, 10, { zogu: HOLD });
    expect(s.villages).toBe(1);
  });

  it('gives Burgajet a village and 40 gold', () => {
    const { s } = at('burgajet');
    run(s, MARCH.ring.home + 0.1, { zogu: HOLD });
    expect(s.villages).toBe(1);
    expect(s.gold).toBe(240);
  });

  it('charges a tower its bribe when the ring completes', () => {
    const { s, i } = at('bulqize');
    const bribe = s.places[i].bribe;
    run(s, 2, { zogu: HOLD });
    expect(s.gold).toBe(200);
    const events = run(s, 3.1, { zogu: HOLD });
    expect(s.towers).toBe(1);
    expect(s.gold).toBe(200 - bribe);
    expect(events).toContainEqual({ type: 'coins', amount: -bribe });
  });

  it('refuses a tower without enough gold, and says so on the press', () => {
    const { s, i } = at('selite');
    s.gold = s.places[i].bribe - 1;
    const events = run(s, 0.1, { zogu: PRESS });
    expect(events).toContainEqual({ type: 'refused', place: i, reason: 'noGold' });
    run(s, 6, { zogu: HOLD });
    expect(s.places[i].progress).toBe(0);
    expect(s.towers).toBe(0);
    expect(s.negotiating).toBe(-1);
  });

  it('gives a barracks (its gate guards gone) +1 and 20 gold after 8 s', () => {
    const { s } = at('burrel');
    run(s, 7.9, { zogu: HOLD });
    expect(s.barracks).toBe(0);
    run(s, 0.2, { zogu: HOLD });
    expect(s.barracks).toBe(1);
    expect(s.gold).toBe(220);
  });

  it('waves outside a place', () => {
    const { s } = at('klos');
    place(s, 'zogu', s.heroes.zogu.x, s.heroes.zogu.y + 100);
    run(s, 0.1, { zogu: PRESS });
    expect(s.heroes.zogu.actUntil).toBeGreaterThan(s.now);
  });
});
```

- [ ] **Step 2: Run to see it fail.**

- [ ] **Step 3: Create `minigames/march/places.ts`:**

```ts
// Pochod na Tiranu — places and negotiation (spec 2026-09-27-diktator-pochod-design §4.3, §6.4, §4.5). Pure.

import { pick, randInt, type RngState } from '../../../../shared/rng';
import { tileCentre, type MarchMap } from './map';
import { MARCH } from './rules';
import { dist, type MarchEvent, type MarchInput, type MarchState, type PlaceState } from './state';

/** The places with their seeded variants: each village's ring (4–6 s) and each tower's bribe (30/40/50). */
export function createPlaces(map: MarchMap, rng: RngState): PlaceState[] {
  return map.places.map((def): PlaceState => {
    const [x, y] = tileCentre(map, def.at);
    const [lo, hi] = MARCH.villageRing;
    const ring = def.kind === 'village' ? lo + randInt(rng, hi - lo + 1) : MARCH.ring[def.kind];
    const bribe = def.kind === 'tower' ? pick(rng, MARCH.bribes) : 0;
    return { def, x, y, ring, bribe, progress: 0, won: false, wp: 1, dir: 1 };
  });
}

/** The place Zogu stands in (the nearest within 70 units), or -1. */
export function zoguPlace(s: MarchState): number {
  let best = -1;
  let bestD = Infinity;
  s.places.forEach((p, i) => {
    const d = dist(p, s.heroes.zogu);
    if (d <= MARCH.placeRadius && d < bestD) {
      best = i;
      bestD = d;
    }
  });
  return best;
}

/** A barracks is locked while any of its gate guards still stands (not yet knocked down). */
export function barracksLocked(s: MarchState, place: number): boolean {
  return s.foes.some((f) => f.kind === 'guard' && f.place === place && (f.mode === 'post' || f.mode === 'stunned'));
}

function coins(s: MarchState, amount: number, events: MarchEvent[]): void {
  s.gold = Math.max(0, s.gold + amount);
  events.push({ type: 'coins', amount });
}

/** Books what a won place gives (§4.3, §4.5). */
function reward(s: MarchState, p: PlaceState, events: MarchEvent[]): void {
  switch (p.def.kind) {
    case 'village': s.villages += 1; break;
    case 'home': s.villages += 1; coins(s, MARCH.homeGold, events); break;
    case 'tower': s.towers += 1; coins(s, -p.bribe, events); break;
    case 'barracks': s.barracks += 1; coins(s, MARCH.barracksGold, events); break;
    case 'volunteers': s.volunteers = true; break;
    case 'stable': s.horses = true; s.horsesUntil = s.t + MARCH.horsesDays * MARCH.day; break;
    case 'messenger': s.messenger = true; break;
  }
}

/**
 * Zogu's Action (§6.4): held inside an unfinished place, it fills the ring (progress is kept when he lets go or
 * walks away). A tower needs its bribe in the purse; a barracks waits until its gate guards are down. Pressed
 * outside a place (or in a won one), it is a wave. Sets `s.negotiating`.
 */
export function stepPlaces(s: MarchState, zin: MarchInput, dt: number, events: MarchEvent[]): void {
  s.negotiating = -1;
  const z = s.heroes.zogu;
  if (s.now < z.frozenUntil) return;
  const i = zoguPlace(s);
  const p = i >= 0 ? s.places[i] : null;
  if (!p || p.won) {
    if (zin.action) z.actUntil = s.now + MARCH.wave;
    return;
  }
  if (!zin.held) return;
  if (p.def.kind === 'barracks' && barracksLocked(s, i)) {
    if (zin.action) events.push({ type: 'refused', place: i, reason: 'locked' });
    return;
  }
  if (p.def.kind === 'tower' && s.gold < p.bribe) {
    if (zin.action) events.push({ type: 'refused', place: i, reason: 'noGold' });
    return;
  }
  s.negotiating = i;
  const before = p.progress;
  p.progress = Math.min(p.ring, p.progress + dt);
  if (p.progress >= p.ring) {
    p.won = true;
    reward(s, p, events);
    events.push({ type: 'won', place: i });
  } else if (Math.floor(p.progress) > Math.floor(before)) {
    events.push({ type: 'tick' });
  }
}
```

- [ ] **Step 4: Wire it into `logic.ts`.** Three edits:
  - Add the import after `import { applyRope, walk } from './move';`:
    ```ts
    import { createPlaces, stepPlaces } from './places';
    ```
  - In `createMarch`, before `return s;`:
    ```ts
      s.places = createPlaces(map, s.rng);
    ```
  - In `stepMarch`, after the `// 2. Negotiation, Vlček's blow, the gendarmes, the optional benefits.` comment:
    ```ts
      stepPlaces(s, zin, dt, events);
    ```

- [ ] **Step 5: Run and commit.** `npx vitest run tests/diktator/march` → PASS; `npm test`; `npx tsc --noEmit`.

```bash
git add src/games/diktator/minigames/march/places.ts src/games/diktator/minigames/march/logic.ts tests/diktator/march/places.test.ts
git commit -m "feat(diktator): Pochod — places, seeded variants and negotiation" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Gendarmes, the catch, Vlček's blow and the barracks gate

**Files:**
- Create: `src/games/diktator/minigames/march/foes.ts`
- Modify: `src/games/diktator/minigames/march/logic.ts`
- Test: `tests/diktator/march/foes.test.ts`

Notes (spec §6.5, §6.6, with the two clarifications recorded in the spec):
- **Spawns.** A patrol starts at either end of a route and walks towards the other end. It is trimmed so that no more than 6 gendarmes are ever alive. Its members wait `k × 24 / 95` s before setting off (mode `wait`), so they walk in a line 24 units apart without being placed on off-road tiles.
- **Giving up.** After giving up a chase, a gendarme is blind for 3 s (`MARCH.blindAfterGiveUp`, our addition), so he does not ping-pong against a wall. A gendarme wedged on his way back for 1.5 s is removed and not counted.
- **Surrender.** A knocked-out gendarme is counted in `captured` when he raises his hands (the start of `surrender`). A gate guard is counted in `joined` at the same moment.
- **Gate guards** stand on a half ring 50 units south of their barracks. They never chase and never catch.

- [ ] **Step 1: Write the tests.** Create `tests/diktator/march/foes.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { gatePosts, squadSize } from '../../../src/games/diktator/minigames/march/foes';
import { createMarch, stepMarch } from '../../../src/games/diktator/minigames/march/logic';
import { passable } from '../../../src/games/diktator/minigames/march/map';
import { MARCH } from '../../../src/games/diktator/minigames/march/rules';
import { dist, MARCH_END, type Foe, type MarchState } from '../../../src/games/diktator/minigames/march/state';
import { ALBANIA_MARCH } from '../../../src/games/diktator/scenario/albania/march-map';
import { go, HOLD, IDLE, place, PLAYGROUND, PRESS, run } from './helpers';

/** A march with no gendarmes, no gate guards and no spawns; the pair stands at Zerqan (a village on route 1). */
function quiet(seed = 1, map = ALBANIA_MARCH): MarchState {
  const s = createMarch(map, seed, false);
  s.foes = [];
  s.nextSpawnAt = Infinity;
  const zerqan = s.places.find((p) => p.def.id === 'zerqan');
  if (zerqan) {
    place(s, 'zogu', zerqan.x, zerqan.y);
    place(s, 'velitel', zerqan.x - 40, zerqan.y);
  }
  return s;
}

function gendarme(s: MarchState, x: number, y: number, squad = 99, route = 1): Foe {
  const f: Foe = {
    id: s.nextFoeId++, kind: 'gendarme', x, y, facing: -1, moving: false, mode: 'patrol', until: 0, hits: 0,
    route, wp: 1, dir: 1, squad, stuck: 0, place: -1, homeX: x, homeY: y,
  };
  s.foes.push(f);
  return f;
}

const TAP = { ...IDLE, action: true };

describe('gate guards', () => {
  it('stand 40–60 units from every barracks, on passable ground, as many as the seed says', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const s = createMarch(ALBANIA_MARCH, seed, false);
      s.places.forEach((p, i) => {
        const guards = s.foes.filter((f) => f.kind === 'guard' && f.place === i);
        if (p.def.kind !== 'barracks') return expect(guards).toHaveLength(0);
        expect(guards.length).toBeGreaterThanOrEqual(p.def.guards![0]);
        expect(guards.length).toBeLessThanOrEqual(p.def.guards![1]);
        for (const g of guards) {
          expect(dist(g, p)).toBeGreaterThanOrEqual(40);
          expect(dist(g, p)).toBeLessThanOrEqual(60);
          expect(passable(ALBANIA_MARCH, g.x, g.y)).toBe(true);
        }
      });
    }
    expect(gatePosts(0, 0, 1)[0][0]).toBeCloseTo(0, 6);
  });

  it('never chase or catch, and lock the barracks until every one is knocked down', () => {
    const s = createMarch(ALBANIA_MARCH, 2, false);
    s.nextSpawnAt = Infinity;
    const i = s.places.findIndex((p) => p.def.id === 'burrel');
    const p = s.places[i];
    place(s, 'zogu', p.x, p.y);
    place(s, 'velitel', p.x, p.y + 20);
    const guards = s.foes.filter((f) => f.place === i);
    const posts = guards.map((g) => [g.x, g.y]);
    const events = run(s, 3, { zogu: PRESS });
    expect(events).toContainEqual({ type: 'refused', place: i, reason: 'locked' });
    expect(p.progress).toBe(0);
    expect(s.caught).toBe(0);
    expect(guards.map((g) => [g.x, g.y])).toEqual(posts);
    for (const g of guards) {
      place(s, 'velitel', g.x, g.y - 30);
      run(s, 0.5, { velitel: TAP });
      place(s, 'velitel', g.x, g.y - 30);
      run(s, 0.5, { velitel: TAP });
      expect(g.mode === 'down' || g.mode === 'surrender').toBe(true);
    }
    run(s, 8.2, { zogu: HOLD });
    expect(s.barracks).toBe(1);
    expect(s.joined).toBe(guards.length);
    expect(s.captured).toBe(0);
  });
});

describe('spawning', () => {
  it('sends 1 gendarme a patrol on 13–16 Dec, 2 on 17–20, 3 on 21–24', () => {
    expect([13, 16, 17, 20, 21, 24].map(squadSize)).toEqual([1, 1, 2, 2, 3, 3]);
  });

  it('tries the first patrol at 8 s, off screen but near, then every 8–12 s', () => {
    const s = createMarch(ALBANIA_MARCH, 4, false);
    s.heroes.zogu.immuneUntil = Infinity;
    expect(run(s, 7.9).some((e) => e.type === 'spawned')).toBe(false);
    expect(run(s, 0.2)).toContainEqual({ type: 'spawned', squad: 1, size: 1 });
    expect(s.nextSpawnAt - s.now).toBeGreaterThanOrEqual(7.8);
    expect(s.nextSpawnAt - s.now).toBeLessThanOrEqual(12.1);
    const g = s.foes.find((f) => f.kind === 'gendarme')!;
    const cam = { x: (s.heroes.zogu.x + s.heroes.velitel.x) / 2, y: (s.heroes.zogu.y + s.heroes.velitel.y) / 2 };
    expect(dist(g, cam)).toBeGreaterThan(550);
  });

  it('never has more than 6 gendarmes about', () => {
    const s = createMarch(ALBANIA_MARCH, 5, false);
    s.heroes.zogu.immuneUntil = Infinity;
    s.t = 8 * 22;
    let most = 0;
    for (let i = 0; i < 80 * 60; i++) {
      stepMarch(s, MARCH.step, {});
      const n = s.foes.filter((f) => f.kind === 'gendarme').length;
      most = Math.max(most, n);
      expect(n).toBeLessThanOrEqual(MARCH.maxAlive);
    }
    expect(most).toBeGreaterThanOrEqual(3);
  });
});

describe('patrols and chases', () => {
  it('see Zogu within 260 units, and twice as far while he negotiates', () => {
    const s = quiet();
    const z = s.heroes.zogu;
    const g = gendarme(s, z.x + 400, z.y);
    run(s, 0.05);
    expect(g.mode).toBe('patrol');
    g.x = z.x + 400;
    g.y = z.y;
    run(s, 0.05, { zogu: HOLD });
    expect(s.negotiating).toBeGreaterThanOrEqual(0);
    expect(g.mode).toBe('chase');
  });

  it('give up beyond 700 units', () => {
    const s = quiet();
    const g = gendarme(s, s.heroes.zogu.x + 200, s.heroes.zogu.y);
    run(s, 0.05);
    expect(g.mode).toBe('chase');
    g.x = s.heroes.zogu.x + 750;
    run(s, 0.05);
    expect(g.mode).toBe('return');
  });

  it('give up after 1.5 s stuck against rock', () => {
    const map = { ...PLAYGROUND, patrols: [[[12, 8], [16, 8]] as const] };
    const s = createMarch(map, 1, false, { startAt: [7, 5] });
    s.nextSpawnAt = Infinity;
    const g = gendarme(s, 450, 450, 99, 0);
    run(s, 1);
    expect(g.mode).toBe('chase');
    run(s, 1.2); // ~0.4 s to reach the rock, then 1.5 s stuck
    expect(g.mode).toBe('return');
  });
});

describe('the catch', () => {
  it('costs 20 gold and a whole day, sends the patrol away, holds Zogu 2 s and then protects him 4 s', () => {
    const s = quiet();
    const z = s.heroes.zogu;
    const g1 = gendarme(s, z.x + 20, z.y, 7);
    const g2 = gendarme(s, z.x + 250, z.y, 7);
    const other = gendarme(s, z.x - 600, z.y, 8);
    const t0 = s.t;
    const events = run(s, MARCH.step);
    expect(events).toContainEqual({ type: 'caught' });
    expect(events).toContainEqual({ type: 'coins', amount: -20 });
    expect(s.gold).toBe(180);
    expect(s.t).toBeCloseTo(t0 + MARCH.step + 22, 6);
    expect(s.caught).toBe(1);
    expect([g1.mode, g2.mode, other.mode]).toEqual(['leaving', 'leaving', 'patrol']);
    const x0 = z.x;
    run(s, 1.5, { zogu: go(1, 0) });
    expect(z.x).toBe(x0);
    run(s, 0.6, { zogu: go(1, 0) });
    expect(z.x).toBeGreaterThan(x0);
    run(s, 2.5, {});
    expect(s.foes.some((f) => f.squad === 7)).toBe(false);
    gendarme(s, z.x + 10, z.y, 9);
    run(s, 0.5);
    expect(s.caught).toBe(1);
  });

  it('never takes the purse below 0', () => {
    const s = quiet();
    s.gold = 5;
    gendarme(s, s.heroes.zogu.x + 10, s.heroes.zogu.y);
    run(s, MARCH.step);
    expect(s.gold).toBe(0);
  });

  it('ends the march when the lost day runs past Christmas Eve', () => {
    const s = quiet();
    s.t = 250;
    gendarme(s, s.heroes.zogu.x + 10, s.heroes.zogu.y);
    const events = stepMarch(s, MARCH.step, {});
    expect(s.t).toBeGreaterThanOrEqual(MARCH_END);
    expect(events).toContainEqual({ type: 'timeout' });
    expect(s.arrivedDay).toBeNull();
  });
});

describe('Vlček’s blow', () => {
  it('has a 0.45 s cooldown', () => {
    const s = quiet();
    const events = run(s, 0.4, { velitel: TAP });
    expect(events.filter((e) => e.type === 'swing')).toHaveLength(1);
    expect(run(s, 0.1, { velitel: TAP }).filter((e) => e.type === 'swing')).toHaveLength(1);
  });

  it('hits the nearest foe in reach, knocks him back 30 units and stuns him', () => {
    const s = quiet();
    const v = s.heroes.velitel;
    place(s, 'zogu', v.x - 300, v.y);
    const near = gendarme(s, v.x + 30, v.y);
    const far = gendarme(s, v.x + 50, v.y);
    const events = stepMarch(s, MARCH.step, { velitel: TAP });
    expect(events).toContainEqual({ type: 'hit', down: false });
    expect(near.mode).toBe('stunned');
    expect(near.x).toBeCloseTo(v.x + 60, 0);
    expect(far.hits).toBe(0);
  });

  it('knocks out with the second hit; a gendarme surrenders and counts, then leaves', () => {
    const s = quiet();
    const v = s.heroes.velitel;
    place(s, 'zogu', v.x - 300, v.y);
    const g = gendarme(s, v.x + 30, v.y);
    stepMarch(s, MARCH.step, { velitel: TAP });
    run(s, 0.5);
    g.x = v.x + 30;
    g.y = v.y;
    const events = run(s, 0.1, { velitel: TAP });
    expect(events).toContainEqual({ type: 'hit', down: true });
    expect(g.mode).toBe('down');
    run(s, 1.25);
    expect(g.mode).toBe('surrender');
    expect(s.captured).toBe(1);
    run(s, 1.6);
    expect(s.foes).not.toContain(g);
    expect(s.captured).toBe(1);
  });

  it('swings at the air when nobody is in reach', () => {
    const s = quiet();
    const events = stepMarch(s, MARCH.step, { velitel: TAP });
    expect(events).toEqual([{ type: 'swing' }]);
  });
});
```

- [ ] **Step 2: Run to see it fail.**

- [ ] **Step 3: Create `minigames/march/foes.ts`:**

```ts
// Pochod na Tiranu — Noli's gendarmes, the barracks gate guards and Vlček's blow
// (spec 2026-09-27-diktator-pochod-design §6.5, §6.6). Pure; randomness only from `s.rng`.

import { randInt } from '../../../../shared/rng';
import { speedAt, tileCentre } from './map';
import { moveFigure, walkTo } from './move';
import { MARCH } from './rules';
import { cameraOf, dateOf, dist, type Foe, type MarchEvent, type MarchInput, type MarchState } from './state';

/** Gendarmes per patrol by date: 1 on 13–16 Dec, 2 on 17–20 Dec, 3 on 21–24 Dec. */
export function squadSize(date: number): number {
  return date <= 16 ? 1 : date <= 20 ? 2 : 3;
}

/** `n` gate posts on a half ring in front of (south of) a barracks at (x, y), `MARCH.gateRadius` away. */
export function gatePosts(x: number, y: number, n: number): [number, number][] {
  return Array.from({ length: n }, (_, k) => {
    const a = Math.PI * (0.15 + 0.7 * (n === 1 ? 0.5 : k / (n - 1)));
    return [x + Math.cos(a) * MARCH.gateRadius, y + Math.sin(a) * MARCH.gateRadius];
  });
}

function newFoe(s: MarchState, f: Omit<Foe, 'id' | 'facing' | 'moving' | 'hits' | 'stuck'>): Foe {
  return { ...f, id: s.nextFoeId++, facing: -1, moving: false, hits: 0, stuck: 0 };
}

/** Each barracks gets its seeded number of gate guards (Peshkopi 3–4, Kukës 4–5, Burrel 2–3, Krujë 3–4). */
export function createGateGuards(s: MarchState): void {
  s.places.forEach((p, i) => {
    if (p.def.kind !== 'barracks' || !p.def.guards) return;
    const [lo, hi] = p.def.guards;
    const n = lo + randInt(s.rng, hi - lo + 1);
    for (const [x, y] of gatePosts(p.x, p.y, n)) {
      s.foes.push(newFoe(s, {
        kind: 'guard', x, y, mode: 'post', until: 0, route: -1, wp: 0, dir: 1, squad: -1, place: i, homeX: x, homeY: y,
      }));
    }
  });
}

/** Every 8–12 s: a new patrol at a route end 600–1400 units from the camera, if fewer than 6 gendarmes are about. */
function trySpawn(s: MarchState, events: MarchEvent[]): void {
  if (s.now < s.nextSpawnAt) return;
  s.nextSpawnAt = s.now + MARCH.spawnEvery + randInt(s.rng, MARCH.spawnSpread);
  const alive = s.foes.filter((f) => f.kind === 'gendarme').length;
  if (alive >= MARCH.maxAlive) return;
  const cam = cameraOf(s);
  const ends: { route: number; end: number }[] = [];
  s.map.patrols.forEach((route, i) => {
    for (const end of [0, route.length - 1]) {
      const [x, y] = tileCentre(s.map, route[end]);
      const d = Math.hypot(x - cam.x, y - cam.y);
      if (d >= MARCH.spawnMin && d <= MARCH.spawnMax) ends.push({ route: i, end });
    }
  });
  if (ends.length === 0) return;
  const { route, end } = ends[randInt(s.rng, ends.length)];
  const dir: 1 | -1 = end === 0 ? 1 : -1;
  const [x, y] = tileCentre(s.map, s.map.patrols[route][end]);
  const size = Math.min(squadSize(dateOf(s.t)), MARCH.maxAlive - alive);
  const squad = s.nextSquad++;
  for (let k = 0; k < size; k++) {
    // The members walk in a line, 24 units apart: each one sets off a little later.
    s.foes.push(newFoe(s, {
      kind: 'gendarme', x, y, mode: 'wait', until: s.now + (k * MARCH.patrolGap) / MARCH.speed.gendarme,
      route, wp: end + dir, dir, squad, place: -1, homeX: x, homeY: y,
    }));
  }
  events.push({ type: 'spawned', squad, size });
}

/** Walks the patrol route back and forth. */
function patrol(s: MarchState, f: Foe, dt: number): void {
  const route = s.map.patrols[f.route];
  const [tx, ty] = tileCentre(s.map, route[f.wp]);
  walkTo(s.map, f, tx, ty, MARCH.speed.gendarme, dt);
  if (Math.hypot(tx - f.x, ty - f.y) < 1) {
    if (f.wp + f.dir < 0 || f.wp + f.dir >= route.length) f.dir = f.dir === 1 ? -1 : 1;
    f.wp += f.dir;
  }
}

/** The index of the waypoint of the gendarme's route nearest to him. */
function nearestWaypoint(s: MarchState, f: Foe): number {
  const route = s.map.patrols[f.route];
  let best = 0;
  route.forEach((at, i) => {
    const [x, y] = tileCentre(s.map, at);
    const [bx, by] = tileCentre(s.map, route[best]);
    if (Math.hypot(x - f.x, y - f.y) < Math.hypot(bx - f.x, by - f.y)) best = i;
  });
  return best;
}

function giveUp(s: MarchState, f: Foe): void {
  f.mode = 'return';
  f.until = s.now + MARCH.blindAfterGiveUp;
  f.stuck = 0;
  f.wp = nearestWaypoint(s, f);
}

/** Walks towards a target and counts the time the terrain blocks him (moved under a quarter of his stride). */
function pursue(s: MarchState, f: Foe, tx: number, ty: number, dt: number): void {
  const before = Math.hypot(tx - f.x, ty - f.y);
  const stride = MARCH.speed.gendarme * speedAt(s.map, f.x, f.y) * dt;
  const moved = walkTo(s.map, f, tx, ty, MARCH.speed.gendarme, dt);
  f.stuck = moved < 0.25 * Math.min(stride, before) ? f.stuck + dt : 0;
}

/**
 * Zogu is caught (§6.5): 20 gold (never below 0), a whole day, the patrol walks away, Zogu is held 2 s and then
 * immune for 4 s.
 */
function catchZogu(s: MarchState, by: Foe, events: MarchEvent[]): void {
  const z = s.heroes.zogu;
  const ransom = Math.min(s.gold, MARCH.ransom);
  s.gold -= ransom;
  s.t += MARCH.day;
  s.caught += 1;
  z.frozenUntil = s.now + MARCH.frozen;
  z.immuneUntil = s.now + MARCH.frozen + MARCH.immune;
  for (const f of s.foes) {
    if (f.kind === 'gendarme' && f.squad === by.squad && ['wait', 'patrol', 'chase', 'return'].includes(f.mode)) {
      f.mode = 'leaving';
      f.until = s.now + MARCH.leaving;
    }
  }
  events.push({ type: 'caught' });
  if (ransom > 0) events.push({ type: 'coins', amount: -ransom });
}

/** Moves every gendarme and guard one tick, then checks for a catch. */
export function stepFoes(s: MarchState, dt: number, events: MarchEvent[]): void {
  trySpawn(s, events);
  const z = s.heroes.zogu;
  const sight = s.negotiating >= 0 ? MARCH.sightNegotiating : MARCH.sight;
  const gone = new Set<number>();
  for (const f of s.foes) {
    const dz = dist(f, z);
    switch (f.mode) {
      case 'wait':
        if (s.now >= f.until) f.mode = 'patrol';
        break;
      case 'patrol':
        if (dz <= sight) {
          f.mode = 'chase';
          f.stuck = 0;
        } else patrol(s, f, dt);
        break;
      case 'chase':
        if (dz > MARCH.giveUp || f.stuck >= MARCH.stuckGiveUp) giveUp(s, f);
        else pursue(s, f, z.x, z.y, dt);
        break;
      case 'return': {
        if (s.now >= f.until && dz <= sight) {
          f.mode = 'chase';
          f.stuck = 0;
          break;
        }
        const [tx, ty] = tileCentre(s.map, s.map.patrols[f.route][f.wp]);
        pursue(s, f, tx, ty, dt);
        if (Math.hypot(tx - f.x, ty - f.y) < 1) f.mode = 'patrol';
        else if (f.stuck >= MARCH.stuckGiveUp) gone.add(f.id); // wedged against a wall: he goes home, uncounted
        break;
      }
      case 'post':
        if (Math.hypot(f.homeX - f.x, f.homeY - f.y) > 2) walkTo(s.map, f, f.homeX, f.homeY, MARCH.speed.gendarme, dt);
        else f.moving = false;
        break;
      case 'stunned':
        f.moving = false;
        if (s.now >= f.until) {
          if (f.kind === 'guard') f.mode = 'post';
          else giveUp(s, f);
        }
        break;
      case 'down':
        f.moving = false;
        if (s.now >= f.until) {
          f.mode = 'surrender';
          f.until = s.now + MARCH.surrender;
          if (f.kind === 'gendarme') s.captured += 1;
          else s.joined += 1;
          events.push({ type: 'surrendered', kind: f.kind });
        }
        break;
      case 'surrender':
        f.moving = false;
        if (s.now >= f.until) gone.add(f.id);
        break;
      case 'leaving': {
        const d = Math.max(1, dz);
        walkTo(s.map, f, f.x + ((f.x - z.x) / d) * 50, f.y + ((f.y - z.y) / d) * 50, MARCH.speed.gendarme, dt);
        if (s.now >= f.until) gone.add(f.id);
        break;
      }
    }
  }
  if (gone.size > 0) s.foes = s.foes.filter((f) => !gone.has(f.id));
  if (s.now < z.immuneUntil || s.now < z.frozenUntil) return;
  const catcher = s.foes.find(
    (f) => f.kind === 'gendarme' && (f.mode === 'patrol' || f.mode === 'chase' || f.mode === 'return') && dist(f, z) <= MARCH.catchRadius,
  );
  if (catcher) catchZogu(s, catcher, events);
}

/** Anyone Vlček can still hit: not knocked down, not surrendering, not waiting to set off. */
export function targetable(f: Foe): boolean {
  return f.mode !== 'down' && f.mode !== 'surrender' && f.mode !== 'wait';
}

/**
 * Vlček's blow (§6.6): Action starts one if the cooldown is over. It hits the nearest foe within 56 units. The first
 * hit knocks him back 30 units and stuns him; the second puts him down (then he surrenders).
 */
export function strike(s: MarchState, vin: MarchInput, cooldown: number, events: MarchEvent[]): void {
  const v = s.heroes.velitel;
  if (!vin.action || s.now < v.cooldownUntil) return;
  v.cooldownUntil = s.now + cooldown;
  v.actUntil = s.now + MARCH.blowAnim;
  let target: Foe | null = null;
  for (const f of s.foes) {
    if (targetable(f) && dist(f, v) <= MARCH.blowReach && (!target || dist(f, v) < dist(target, v))) target = f;
  }
  events.push({ type: 'swing' });
  if (!target) return;
  v.facing = target.x >= v.x ? 1 : -1;
  target.hits += 1;
  if (target.hits >= 2) {
    target.mode = 'down';
    target.until = s.now + MARCH.down;
    events.push({ type: 'hit', down: true });
    return;
  }
  const d = Math.max(1, dist(target, v));
  moveFigure(s.map, target, ((target.x - v.x) / d) * MARCH.knockback, ((target.y - v.y) / d) * MARCH.knockback);
  target.mode = 'stunned';
  target.until = s.now + MARCH.stunned;
  events.push({ type: 'hit', down: false });
}
```

- [ ] **Step 4: Wire it into `logic.ts`.** Three edits:
  - Add the import among the `./` imports. They stay alphabetical, as in the final listing in Task 6: `./benefits`, `./foes`, `./helper`, `./map`, `./move`, `./places`, `./rules`, `./state`.
    ```ts
    import { createGateGuards, stepFoes, strike } from './foes';
    ```
  - In `createMarch`, after `s.places = createPlaces(map, s.rng);`:
    ```ts
      createGateGuards(s);
    ```
  - In `stepMarch`, after `stepPlaces(s, zin, dt, events);`:
    ```ts
      const helperStrikes = s.solo && active === 'zogu';
      strike(s, vin, helperStrikes ? MARCH.helperCooldown : MARCH.blowCooldown, events);
      stepFoes(s, dt, events);
    ```

- [ ] **Step 5: Run and commit.** `npx vitest run tests/diktator/march` → PASS (the Task 2 and 3 tests stay green: they clear `s.foes` and set `nextSpawnAt = Infinity` where it matters). `npm test`; `npx tsc --noEmit`.

```bash
git add src/games/diktator/minigames/march/foes.ts src/games/diktator/minigames/march/logic.ts tests/diktator/march/foes.test.ts
git commit -m "feat(diktator): Pochod — Noli's gendarmes, the catch, Vlček's blow and the barracks gate" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: The optional benefits (spec §4.5)

**Files:**
- Create: `src/games/diktator/minigames/march/benefits.ts`
- Modify: `src/games/diktator/minigames/march/logic.ts`
- Test: `tests/diktator/march/benefits.test.ts`

The volunteers of Martanesh, the stable at Homesh and the messenger are places. Task 3's reward switch already books them. The horses' speed factor is in `logic.ts` (`heroSpeed`, Task 2). This task adds two things:
- the caches;
- the messenger's walk along his road (he waits while Zogu is within 70 units).

It also tests all four benefits.

- [ ] **Step 1: Write the tests.** Create `tests/diktator/march/benefits.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { createMarch, marchResult } from '../../../src/games/diktator/minigames/march/logic';
import { tileCentre, type MarchPlaceId } from '../../../src/games/diktator/minigames/march/map';
import { MARCH } from '../../../src/games/diktator/minigames/march/rules';
import { dist, MARCH_END, type MarchState } from '../../../src/games/diktator/minigames/march/state';
import { ALBANIA_MARCH } from '../../../src/games/diktator/scenario/albania/march-map';
import { go, HOLD, place, run } from './helpers';

function quiet(): MarchState {
  const s = createMarch(ALBANIA_MARCH, 1, false);
  s.foes = [];
  s.nextSpawnAt = Infinity;
  return s;
}

function standAt(s: MarchState, id: MarchPlaceId): number {
  const i = s.places.findIndex((p) => p.def.id === id);
  place(s, 'zogu', s.places[i].x, s.places[i].y);
  place(s, 'velitel', s.places[i].x - 40, s.places[i].y);
  return i;
}

describe('hidden supply caches', () => {
  it('give 15 gold once, to either hero who steps on them', () => {
    const s = quiet();
    const [x, y] = tileCentre(ALBANIA_MARCH, ALBANIA_MARCH.caches[0]);
    place(s, 'velitel', x + 30, y);
    place(s, 'zogu', x + 200, y);
    const events = run(s, 0.1);
    expect(events).toContainEqual({ type: 'cache', index: 0 });
    expect(s.gold).toBe(215);
    run(s, 1);
    expect(s.gold).toBe(215);
    expect(s.caches).toEqual([true, false, false]);
  });
});

describe('the volunteers of Martanesh', () => {
  it('join after 4 s of negotiation', () => {
    const s = quiet();
    standAt(s, 'martanesh');
    run(s, MARCH.ring.volunteers + 0.1, { zogu: HOLD });
    expect(s.volunteers).toBe(true);
    expect(s.villages).toBe(0);
  });
});

describe('the bey’s stable at Homesh', () => {
  it('lends horses: the pair walks 25 % faster for two days of the march clock', () => {
    const s = quiet();
    standAt(s, 'homesh');
    run(s, MARCH.ring.stable + 0.1, { zogu: HOLD });
    expect(s.horses).toBe(true);
    expect(s.horsesUntil).toBeCloseTo(s.t + 44, 0);
    place(s, 'zogu', 3930, 1650); // Peshkopi, on the road
    place(s, 'velitel', 3890, 1650);
    const x0 = s.heroes.zogu.x;
    run(s, 0.5, { zogu: go(-1, 0), velitel: go(-1, 0) });
    expect(x0 - s.heroes.zogu.x).toBeCloseTo(75, 0);
    s.t = s.horsesUntil + 1;
    const x1 = s.heroes.zogu.x;
    run(s, 0.5, { zogu: go(-1, 0), velitel: go(-1, 0) });
    expect(x1 - s.heroes.zogu.x).toBeCloseTo(60, 0);
  });
});

describe('the Italian messenger', () => {
  it('walks his road, waits while Zogu is with him, and brings Italy’s favour after 2 s', () => {
    const s = quiet();
    const i = s.places.findIndex((p) => p.def.kind === 'messenger');
    const m = s.places[i];
    place(s, 'zogu', 600, 2400);
    place(s, 'velitel', 640, 2400);
    const x0 = m.x;
    run(s, 2);
    expect(m.x).toBeLessThan(x0 - 50);
    place(s, 'zogu', m.x, m.y);
    place(s, 'velitel', m.x + 30, m.y);
    const x1 = m.x;
    run(s, MARCH.ring.messenger + 0.1, { zogu: HOLD });
    expect(m.x).toBe(x1);
    expect(s.messenger).toBe(true);
    expect(dist(m, s.heroes.zogu)).toBeLessThan(1);
  });

  it('turns back at the ends of his road', () => {
    const s = quiet();
    const m = s.places.find((p) => p.def.kind === 'messenger')!;
    place(s, 'zogu', 600, 2400);
    place(s, 'velitel', 640, 2400);
    run(s, 40);
    const [ex] = tileCentre(ALBANIA_MARCH, ALBANIA_MARCH.messengerRoad[1]);
    expect(m.x).toBeGreaterThan(ex + 10);
  });
});

describe('the result carries the benefits', () => {
  it('reports caches, volunteers, messenger and horses', () => {
    const s = quiet();
    s.caches = [true, false, true];
    s.volunteers = true;
    s.messenger = true;
    s.horses = true;
    s.t = MARCH_END;
    run(s, 3.1);
    const r = marchResult(s)!;
    expect([r.caches, r.volunteers, r.messenger, r.horses]).toEqual([2, true, true, true]);
  });
});
```

- [ ] **Step 2: Run to see it fail.**

- [ ] **Step 3: Create `minigames/march/benefits.ts`:**

```ts
// Pochod na Tiranu — the optional benefits (spec 2026-09-27-diktator-pochod-design §4.5): hidden supply caches and
// the Italian messenger walking his road. (The volunteers of Martanesh and the bey's stable at Homesh are places,
// won by negotiating — see places.ts; the horses' speed is in logic.ts.) Pure.

import { HEROES } from '../../logic/palace';
import { tileCentre } from './map';
import { walkTo } from './move';
import { MARCH } from './rules';
import { dist, type MarchEvent, type MarchState, type PlaceState } from './state';

/** Either hero stepping onto a cache takes it: +15 gold. */
function takeCaches(s: MarchState, events: MarchEvent[]): void {
  s.map.caches.forEach((at, i) => {
    if (s.caches[i]) return;
    const [x, y] = tileCentre(s.map, at);
    if (!HEROES.some((h) => dist(s.heroes[h], { x, y }) <= MARCH.cacheRadius)) return;
    s.caches[i] = true;
    s.gold += MARCH.cacheGold;
    events.push({ type: 'cache', index: i });
    events.push({ type: 'coins', amount: MARCH.cacheGold });
  });
}

/** The messenger walks his road back and forth, and waits while Zogu stands with him. */
function walkMessenger(s: MarchState, m: PlaceState, dt: number): void {
  if (dist(m, s.heroes.zogu) <= MARCH.placeRadius) return;
  const road = s.map.messengerRoad;
  const [tx, ty] = tileCentre(s.map, road[m.wp]);
  // A PlaceState has no facing; walk a scratch figure and copy the position back.
  const f = { x: m.x, y: m.y, facing: 1 as 1 | -1, moving: false };
  walkTo(s.map, f, tx, ty, MARCH.messengerSpeed, dt);
  m.x = f.x;
  m.y = f.y;
  if (Math.hypot(tx - m.x, ty - m.y) < 1) {
    if (m.wp + m.dir < 0 || m.wp + m.dir >= road.length) m.dir = m.dir === 1 ? -1 : 1;
    m.wp += m.dir;
  }
}

export function stepBenefits(s: MarchState, dt: number, events: MarchEvent[]): void {
  takeCaches(s, events);
  const m = s.places.find((p) => p.def.kind === 'messenger');
  if (m) walkMessenger(s, m, dt);
}
```

- [ ] **Step 4: Wire it into `logic.ts`.**
  - Add `import { stepBenefits } from './benefits';` as the first `./` import.
  - In `stepMarch`, after `stepFoes(s, dt, events);`:
    ```ts
      stepBenefits(s, dt, events);
    ```

- [ ] **Step 5: Run and commit.** `npx vitest run tests/diktator/march` → PASS; `npm test`; `npx tsc --noEmit`.

```bash
git add src/games/diktator/minigames/march/benefits.ts src/games/diktator/minigames/march/logic.ts tests/diktator/march/benefits.test.ts
git commit -m "feat(diktator): Pochod — optional benefits: caches, volunteers, horses, the Italian messenger" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: The solo helper

**Files:**
- Create: `src/games/diktator/minigames/march/helper.ts`
- Modify: `src/games/diktator/minigames/march/logic.ts`
- Test: `tests/diktator/march/helper.test.ts`

- [ ] **Step 1: Write the tests.** Create `tests/diktator/march/helper.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { createMarch, stepMarch } from '../../../src/games/diktator/minigames/march/logic';
import { MARCH } from '../../../src/games/diktator/minigames/march/rules';
import { dist, type Foe, type MarchState } from '../../../src/games/diktator/minigames/march/state';
import { ALBANIA_MARCH } from '../../../src/games/diktator/scenario/albania/march-map';
import { go, HOLD, place, run } from './helpers';

function solo(): MarchState {
  const s = createMarch(ALBANIA_MARCH, 1, true);
  s.foes = [];
  s.nextSpawnAt = Infinity;
  return s;
}

function chaser(s: MarchState, x: number, y: number): Foe {
  const f: Foe = {
    id: s.nextFoeId++, kind: 'gendarme', x, y, facing: -1, moving: false, mode: 'chase', until: 0, hits: 0,
    route: 1, wp: 1, dir: 1, squad: 50, stuck: 0, place: -1, homeX: x, homeY: y,
  };
  s.foes.push(f);
  return f;
}

describe('the solo helper', () => {
  it('follows the active hero and stops within 90 units', () => {
    const s = solo();
    run(s, 3, { zogu: go(-1, 0) }, 'zogu');
    const d = dist(s.heroes.zogu, s.heroes.velitel);
    expect(d).toBeGreaterThan(60);
    expect(d).toBeLessThanOrEqual(MARCH.followStop + 5);
    run(s, 2, {}, 'zogu');
    expect(dist(s.heroes.zogu, s.heroes.velitel)).toBeLessThanOrEqual(MARCH.followStop + 1);
    expect(s.heroes.velitel.moving).toBe(false);
  });

  it('as Vlček, walks at a gendarme chasing Zogu and strikes him on his own, every 0.8 s at most', () => {
    const s = solo();
    const z = s.heroes.zogu;
    s.heroes.zogu.immuneUntil = Infinity;
    const g = chaser(s, z.x - 150, z.y);
    const v = s.heroes.velitel;
    const vx0 = v.x;
    const events = [];
    for (let i = 0; i < 6; i++) events.push(...stepMarch(s, MARCH.step, {}, 'zogu'));
    expect(v.x).toBeLessThan(vx0); // he heads west, at the gendarme (following alone would keep him still)
    for (let i = 6; i < 90; i++) events.push(...stepMarch(s, MARCH.step, {}, 'zogu'));
    const swings = events.filter((e) => e.type === 'swing').length;
    expect(swings).toBeGreaterThanOrEqual(1);
    expect(swings).toBeLessThanOrEqual(2);
    expect(g.hits).toBeGreaterThanOrEqual(1);
  });

  it('as Zogu, only follows: he never negotiates', () => {
    const s = solo();
    const i = s.places.findIndex((p) => p.def.id === 'maqellare');
    place(s, 'zogu', s.places[i].x, s.places[i].y);
    place(s, 'velitel', s.places[i].x - 40, s.places[i].y);
    run(s, 6, { velitel: HOLD }, 'velitel');
    expect(s.places[i].progress).toBe(0);
    expect(s.villages).toBe(0);
  });

  it('is off in co-op: a hero without input stands still', () => {
    const s = createMarch(ALBANIA_MARCH, 1, false);
    s.nextSpawnAt = Infinity;
    const v0 = { ...s.heroes.velitel };
    run(s, 2, { zogu: go(-1, 0) });
    expect(s.heroes.velitel.x).toBe(v0.x);
  });
});
```

- [ ] **Step 2: Run to see it fail** (the helper hero stands still).

- [ ] **Step 3: Create `minigames/march/helper.ts`:**

```ts
// Pochod na Tiranu — the solo helper (spec 2026-09-27-diktator-pochod-design §6.7): in solo play the hero the
// player is not steering follows the active one; helper Vlček intercepts chasing gendarmes and strikes on his own.
// Helper Zogu never negotiates. Pure, so the march stays deterministic.

import { other, type Hero } from '../../logic/palace';
import { targetable } from './foes';
import { MARCH } from './rules';
import { dist, type Foe, type MarchInput, type MarchState, type Point } from './state';

function towards(from: Point, to: Point): { moveX: number; moveY: number } {
  const d = dist(from, to);
  return d < 4 ? { moveX: 0, moveY: 0 } : { moveX: (to.x - from.x) / d, moveY: (to.y - from.y) / d };
}

export function helperInput(s: MarchState, hero: Hero): MarchInput {
  const me = s.heroes[hero];
  const lead = s.heroes[other(hero)];
  const follow = dist(me, lead) > MARCH.followStop ? towards(me, lead) : { moveX: 0, moveY: 0 };
  if (hero === 'zogu') return { ...follow, action: false, held: false };
  const z = s.heroes.zogu;
  let threat: Foe | null = null;
  for (const f of s.foes) {
    if (f.kind === 'gendarme' && f.mode === 'chase' && dist(f, z) <= MARCH.interceptRange && (!threat || dist(f, z) < dist(threat, z))) {
      threat = f;
    }
  }
  const move = threat ? towards(me, threat) : follow;
  const inReach = s.foes.some((f) => targetable(f) && f.mode !== 'leaving' && dist(f, me) <= MARCH.blowReach);
  return { ...move, action: inReach && s.now >= me.cooldownUntil, held: false };
}
```

- [ ] **Step 4: Wire it into `logic.ts`.**
  - Add `import { helperInput } from './helper';` after the `./foes` import.
  - In `stepMarch`, replace
    ```ts
      const input = (h: Hero): MarchInput => (s.solo && h !== active ? IDLE_INPUT : inputs[h] ?? IDLE_INPUT);
    ```
    with
    ```ts
      const input = (h: Hero): MarchInput => (s.solo && h !== active ? helperInput(s, h) : inputs[h] ?? IDLE_INPUT);
    ```

  `logic.ts` is now final. Check it against this full listing:

```ts
// Pochod na Tiranu — the march simulation (spec 2026-09-27-diktator-pochod-design §6). Pure and seeded: no DOM,
// canvas, audio or Math.random; the same map, seed and inputs always give the same state. Call `stepMarch` with the
// fixed step `MARCH.step` (the game object accumulates real time).

import { makeRng } from '../../../../shared/rng';
import { HEROES, type Hero } from '../../logic/palace';
import { stepBenefits } from './benefits';
import { createGateGuards, stepFoes, strike } from './foes';
import { helperInput } from './helper';
import { tileCentre, type MarchMap } from './map';
import { applyRope, walk } from './move';
import { createPlaces, stepPlaces } from './places';
import { MARCH } from './rules';
import {
  dateOf, dist, IDLE_INPUT, MARCH_END,
  type HeroFigure, type MarchEvent, type MarchInput, type MarchResult, type MarchState,
} from './state';

export interface MarchOptions {
  /** DEV only (`?march=short`): start the pair on this tile and the clock at this march time. */
  readonly startAt?: readonly [number, number];
  readonly startT?: number;
}

function hero(x: number, y: number): HeroFigure {
  return { x, y, facing: -1, moving: false, frozenUntil: 0, immuneUntil: 0, actUntil: 0, cooldownUntil: 0 };
}

export function createMarch(map: MarchMap, seed: number, solo: boolean, opts: MarchOptions = {}): MarchState {
  const rng = makeRng(seed);
  const [x, y] = tileCentre(map, opts.startAt ?? map.start);
  const s: MarchState = {
    map, solo, rng, now: 0, t: opts.startT ?? 0,
    heroes: { zogu: hero(x, y), velitel: hero(x - 40, y) },
    places: [], foes: [], nextFoeId: 1, nextSquad: 1, nextSpawnAt: MARCH.spawnEvery,
    gold: MARCH.startGold, villages: 0, towers: 0, barracks: 0, captured: 0, caught: 0, joined: 0,
    caches: map.caches.map(() => false), volunteers: false, messenger: false, horses: false, horsesUntil: -1,
    negotiating: -1, trail: [[Math.round(x), Math.round(y)]], trailNext: MARCH.trailEvery,
    ending: null, arrivedDay: null,
  };
  s.places = createPlaces(map, s.rng);
  createGateGuards(s);
  return s;
}

/** The hero's walking speed: its base speed, times 1.25 while the bey's horses carry the pair (spec §4.5). */
function heroSpeed(s: MarchState, h: Hero): number {
  return MARCH.speed[h] * (s.t < s.horsesUntil ? MARCH.horsesFactor : 1);
}

/**
 * Advances the march by `dt` seconds. `inputs` holds the seated heroes' inputs; in solo play only `active` is
 * steered and the other hero is the solo helper (§6.7). Returns what happened this tick (for sounds and bubbles).
 */
export function stepMarch(
  s: MarchState, dt: number, inputs: Readonly<Partial<Record<Hero, MarchInput>>>, active: Hero = 'zogu',
): MarchEvent[] {
  const events: MarchEvent[] = [];
  s.now += dt;
  if (s.ending) return events;
  const dayBefore = dateOf(s.t);
  s.t += dt;
  const input = (h: Hero): MarchInput => (s.solo && h !== active ? helperInput(s, h) : inputs[h] ?? IDLE_INPUT);
  const zin = input('zogu');
  const vin = input('velitel');

  // 1. The heroes walk (a held Zogu stands still), then the rope pulls them back together.
  const z = s.heroes.zogu;
  const v = s.heroes.velitel;
  const prevZ = { x: z.x, y: z.y };
  const prevV = { x: v.x, y: v.y };
  if (s.now < z.frozenUntil) z.moving = false;
  else walk(s.map, z, zin.moveX, zin.moveY, heroSpeed(s, 'zogu'), dt);
  walk(s.map, v, vin.moveX, vin.moveY, heroSpeed(s, 'velitel'), dt);
  applyRope(s.map, z, v, prevZ, prevV, MARCH.rope);
  for (const h of HEROES) {
    const f = s.heroes[h];
    const p = h === 'zogu' ? prevZ : prevV;
    f.moving = Math.hypot(f.x - p.x, f.y - p.y) > 1e-6;
  }

  // 2. Negotiation, Vlček's blow, the gendarmes, the optional benefits.
  stepPlaces(s, zin, dt, events);
  const helperStrikes = s.solo && active === 'zogu';
  strike(s, vin, helperStrikes ? MARCH.helperCooldown : MARCH.blowCooldown, events);
  stepFoes(s, dt, events);
  stepBenefits(s, dt, events);

  // 3. The trail, the day banner and the end.
  if (s.now >= s.trailNext) {
    s.trail.push([Math.round(z.x), Math.round(z.y)]);
    s.trailNext += MARCH.trailEvery;
  }
  const [gx, gy] = tileCentre(s.map, s.map.goal);
  if (dist(z, { x: gx, y: gy }) <= MARCH.arriveRadius) {
    s.arrivedDay = dateOf(s.t);
    s.ending = { kind: 'arrived', at: s.now };
    events.push({ type: 'arrived', date: s.arrivedDay });
  } else if (s.t >= MARCH_END) {
    s.arrivedDay = null;
    s.ending = { kind: 'timeout', at: s.now };
    events.push({ type: 'timeout' });
  } else if (dateOf(s.t) !== dayBefore) {
    events.push({ type: 'day', date: dateOf(s.t) });
  }
  return events;
}

/** The result once the ending animation (3 s) has played, else null. */
export function marchResult(s: MarchState): MarchResult | null {
  if (!s.ending || s.now - s.ending.at < MARCH.endingSeconds) return null;
  return {
    villages: s.villages,
    towers: s.towers,
    barracks: s.barracks,
    captured: s.captured,
    caught: s.caught,
    gold: s.gold,
    arrivedDay: s.arrivedDay,
    trail: s.trail.map(([x, y]) => [x, y] as const),
    caches: s.caches.filter(Boolean).length,
    volunteers: s.volunteers,
    messenger: s.messenger,
    horses: s.horses,
  };
}
```

- [ ] **Step 5: Run and commit.** `npx vitest run tests/diktator/march` → PASS; `npm test`; `npx tsc --noEmit`.

```bash
git add src/games/diktator/minigames/march/helper.ts src/games/diktator/minigames/march/logic.ts tests/diktator/march/helper.test.ts
git commit -m "feat(diktator): Pochod — the solo helper" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: The result → `StartingRegime`, the result-card lines and the Czech texts

**Files:**
- Modify: `src/games/diktator/logic/rules.ts`, `src/games/diktator/logic/state.ts`, `src/shared/i18n/cs.ts`
- Create: `src/games/diktator/logic/march-regime.ts`, `src/games/diktator/minigames/march/text.ts`
- Test: `tests/diktator/march/regime.test.ts`

- [ ] **Step 1: Write the tests.** Create `tests/diktator/march/regime.test.ts`. Besides the regime, it holds the two bots of spec §10. The random pair must always end by Christmas Eve with a valid regime. A solo player walking the road must reach Tirana before Christmas in at least 45 of 50 seeds; in the 20 seeds probed during the check run, the road bot arrived on 14–18 December.

```ts
import { describe, expect, it } from 'vitest';
import { GROUPS, STRENGTH_GROUPS } from '../../../src/games/diktator/logic/groups';
import { policeFromArrival, regimeFromMarch } from '../../../src/games/diktator/logic/march-regime';
import { RULES } from '../../../src/games/diktator/logic/rules';
import { initialState } from '../../../src/games/diktator/logic/state';
import { newGame } from '../../../src/games/diktator/logic/turn';
import { createMarch, marchResult, stepMarch } from '../../../src/games/diktator/minigames/march/logic';
import { tileCentre, type TilePos } from '../../../src/games/diktator/minigames/march/map';
import { MARCH } from '../../../src/games/diktator/minigames/march/rules';
import type { MarchInput, MarchResult, MarchState } from '../../../src/games/diktator/minigames/march/state';
import { marchCardLines } from '../../../src/games/diktator/minigames/march/text';
import { albania } from '../../../src/games/diktator/scenario/albania';
import { ALBANIA_MARCH } from '../../../src/games/diktator/scenario/albania/march-map';
import { noise } from './helpers';

/** The historical march (spec §8.2): 2 of each place, 8 gendarmes, 200 gold, Christmas Eve, no benefits. */
const HISTORICAL: MarchResult = {
  villages: 2, towers: 2, barracks: 2, captured: 8, caught: 0, gold: 200, arrivedDay: 24, trail: [],
  caches: 0, volunteers: false, messenger: false, horses: false,
};

describe('regimeFromMarch', () => {
  it('reproduces today’s start exactly for the historical march', () => {
    expect(initialState(7, regimeFromMarch(HISTORICAL))).toEqual(initialState(7));
    expect(initialState(7, regimeFromMarch({ ...HISTORICAL, caught: 3, trail: [[1, 2]] }))).toEqual(initialState(7));
  });

  it('follows the police table', () => {
    expect([13, 20, 21, 22, 23, 24, null].map(policeFromArrival)).toEqual([[8, 8], [8, 8], [8, 7], [8, 7], [7, 6], [7, 6], [5, 4]]);
  });

  it('keeps every value in range for every tally, and no faction starts hostile', () => {
    let popLo = 9, popHi = 0, strLo = 9, strHi = 0, tLo = 1e9, tHi = 0, guardHi = 0;
    for (const villages of [0, 1, 2, 3, 4]) for (const towers of [0, 1, 2, 3, 4]) for (const barracks of [0, 1, 2, 3, 4]) {
      for (let captured = 0; captured <= 30; captured++) for (let gold = 0; gold <= 400; gold += 25) {
        for (const arrivedDay of [13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, null]) {
          const benefits = (villages + captured) % 2 === 0;
          const g = regimeFromMarch({
            villages, towers, barracks, captured, caught: 0, gold, arrivedDay, trail: [],
            caches: 0, volunteers: benefits, messenger: benefits, horses: false,
          });
          for (const v of Object.values(g.pop!)) { popLo = Math.min(popLo, v); popHi = Math.max(popHi, v); }
          for (const v of Object.values(g.str!)) { strLo = Math.min(strLo, v); strHi = Math.max(strHi, v); }
          tLo = Math.min(tLo, g.treasury!);
          tHi = Math.max(tHi, g.treasury!);
          guardHi = Math.max(guardHi, g.guard ?? RULES.start.guard);
        }
      }
    }
    expect([popLo, popHi, strLo, strHi, tLo, tHi, guardHi]).toEqual([5, 8, 4, 8, 200, 400, 5]);
  });

  it('maps each tally as in spec §8.1', () => {
    const g = regimeFromMarch({ ...HISTORICAL, villages: 4, towers: 0, barracks: 3, captured: 13, gold: 170, arrivedDay: 22 });
    expect(g.pop).toEqual({ rolnici: 8, statkari: 5, armada: 8, policie: 8 });
    expect(g.str).toEqual({ statkari: 4, armada: 7, povstalci: 5, policie: 7 });
    expect(g.treasury).toBe(270);
    expect(regimeFromMarch({ ...HISTORICAL, captured: 40 }).str!.povstalci).toBe(4);
    expect(regimeFromMarch({ ...HISTORICAL, gold: 0 }).treasury).toBe(200);
    expect(regimeFromMarch({ ...HISTORICAL, gold: 500 }).treasury).toBe(400);
  });

  it('adds the optional benefits, capped: Itálie 8, the bodyguard 5', () => {
    const g = regimeFromMarch({ ...HISTORICAL, messenger: true, volunteers: true, horses: true, caches: 3, gold: 245 });
    expect(g.pop!.italie).toBe(8);
    expect(g.guard).toBe(5);
    expect(g.treasury).toBe(345);
    const s = initialState(1, g);
    expect([s.pop.italie, s.guard]).toEqual([8, 5]);
    expect(GROUPS.filter((x) => x !== 'italie' && s.pop[x] !== initialState(1).pop[x])).toEqual([]);
    expect(STRENGTH_GROUPS.filter((x) => s.str[x] !== initialState(1).str[x])).toEqual([]);
  });
});

describe('the result card', () => {
  it('lists each tally next to what it gives', () => {
    const lines = marchCardLines({ ...HISTORICAL, villages: 3, captured: 9, gold: 170, arrivedDay: 22 }, albania.groupNames, 3);
    expect(lines).toContain('Vesnice 3/4 → Rolníci: oblíbenost 8');
    expect(lines).toContain('Zajatí četníci 9 → Povstalci: síla 6');
    expect(lines).toContain('Zlato 170 → pokladna 270');
    expect(lines).toContain('Příchod 22. prosince → Tajná policie: oblíbenost 8, síla 7');
    expect(lines).toHaveLength(6);
  });

  it('adds the catches and the benefits when there are any', () => {
    const lines = marchCardLines(
      { ...HISTORICAL, caught: 2, caches: 1, volunteers: true, messenger: true, horses: true, arrivedDay: null },
      albania.groupNames, 3,
    );
    expect(lines).toContain('Příchod po Vánocích → Tajná policie: oblíbenost 5, síla 4');
    expect(lines).toContain('Zogu byl zajat 2× (pokaždé den a 20 zlata)');
    expect(lines).toContain('Skrýše 1/3 (každá +15 zlata)');
    expect(lines).toContain('Dobrovolníci z Martaneshe → tělesná stráž 5');
    expect(lines).toContain('Italský posel → Itálie: oblíbenost 8');
    expect(lines).toContain('Koně z Homeshe → rychlejší pochod');
  });
});

/** Runs a march to its result with per-tick input functions (solo when only Zogu is given). */
function finish(s: MarchState, zogu: () => MarchInput, velitel?: () => MarchInput): MarchResult {
  for (let i = 0; i < 300 * 60 && !marchResult(s); i++) {
    stepMarch(s, MARCH.step, velitel ? { zogu: zogu(), velitel: velitel() } : { zogu: zogu() }, 'zogu');
  }
  return marchResult(s)!;
}

/** Zogu walks the road Dibra → Peshkopi → Burrel → the Mat gorge → Krujë → Tirana, holding Action. */
const ROAD: readonly TilePos[] = [
  [72, 30], [69, 29], [65, 27], [61, 28], [58, 29], [55, 28], [53, 27], [49, 25], [44, 23], [41, 24], [38, 24],
  [38, 28], [36, 31], [31, 32], [25, 29], [22, 26], [20, 23], [17, 26], [16, 30], [13, 33], [10, 35],
];

function roadBot(s: MarchState): () => MarchInput {
  let next = 0;
  return () => {
    const z = s.heroes.zogu;
    let [x, y] = tileCentre(ALBANIA_MARCH, ROAD[next]);
    if (Math.hypot(x - z.x, y - z.y) < 20 && next < ROAD.length - 1) [x, y] = tileCentre(ALBANIA_MARCH, ROAD[++next]);
    const d = Math.max(1, Math.hypot(x - z.x, y - z.y));
    return { moveX: (x - z.x) / d, moveY: (y - z.y) / d, action: false, held: true };
  };
}

describe('bots finish the march', () => {
  it('a random-input pair always ends by Christmas Eve with a valid regime', () => {
    for (let seed = 1; seed <= 50; seed++) {
      const s = createMarch(ALBANIA_MARCH, seed, false);
      const r = finish(s, noise(seed), noise(seed + 1000));
      expect(r).not.toBeNull();
      expect(s.now).toBeLessThanOrEqual(264 + MARCH.endingSeconds + 0.1);
      const g = regimeFromMarch(r);
      expect(() => newGame(albania, seed, g, { palace: true })).not.toThrow();
    }
  }, 30_000);

  it('a solo player walking the road reaches Tirana before Christmas', () => {
    let arrived = 0;
    for (let seed = 1; seed <= 50; seed++) {
      const s = createMarch(ALBANIA_MARCH, seed, true);
      const r = finish(s, roadBot(s));
      if (r.arrivedDay !== null) arrived += 1;
      expect(newGame(albania, seed, regimeFromMarch(r), { palace: true }).state.phase.kind).toBe('audience');
    }
    expect(arrived).toBeGreaterThanOrEqual(45);
  }, 30_000);
});
```

- [ ] **Step 2: Run to see it fail.**

- [ ] **Step 3: `RULES.march`.** In `logic/rules.ts`, inside `RULES`, after the `attempt` block:

```ts
  /** Pochod na Tiranu → the starting regime (spec 2026-09-27-diktator-pochod-design §8; our addition). */
  march: {
    /** Popularity 5 + tally, strength 4 + tally, both at most 8. */
    popBase: 5, strBase: 4, max: 8,
    /** Rebel strength: 8 − ⌊captured / 4⌋, within 4–8. */
    rebelsFrom: 8, rebelsMin: 4, capturedPerRebel: 4,
    /** Treasury: 100 + gold left, within 200–400. */
    treasuryBase: 100, treasuryMin: 200, treasuryMax: 400,
    /** Police [popularity, strength] by the days to spare before Christmas Eve (24 − arrival day). */
    christmasEve: 24, earlyFrom: 4, onTimeFrom: 2,
    policeEarly: [8, 8], policeOnTime: [8, 7], policeLate: [7, 6], policeAfterChristmas: [5, 4],
    /** Optional benefits (§4.5): the Italian messenger +1 Itálie popularity; the Martanesh volunteers +1 bodyguard. */
    messengerItaly: 1, volunteersGuard: 1,
  },
```

- [ ] **Step 4: `StartingRegime.guard`.** In `logic/state.ts`, replace the `StartingRegime` interface with:

```ts
/** Starting values that differ from the original (Pochod na Tiranu produces these: `logic/march-regime.ts`). */
export interface StartingRegime {
  readonly pop?: Readonly<Partial<Record<GroupId, number>>>;
  readonly str?: Readonly<Partial<Record<StrengthGroupId, number>>>;
  readonly treasury?: number;
  /** The bodyguard (the original `st`); the march's Martanesh volunteers add 1 (spec 2026-09-27-diktator-pochod-design §4.5). */
  readonly guard?: number;
}
```

  In `initialState`, change `guard: st.guard,` to `guard: regime.guard ?? st.guard,`.

- [ ] **Step 5: Create `logic/march-regime.ts`:**

```ts
// Pochod na Tiranu → the starting regime of the palace game (spec 2026-09-27-diktator-pochod-design §8). Pure.
// The historical march (2 villages, 2 towers, 2 barracks, 8 gendarmes captured, 200 gold, arrival on 24 December,
// no benefits) gives exactly `RULES.start`.

import type { MarchResult } from '../minigames/march/state';
import { RULES } from './rules';
import type { StartingRegime } from './state';

const clamp = (lo: number, hi: number, x: number) => Math.max(lo, Math.min(hi, x));

/** The police [popularity, strength] by the arrival day (null = after Christmas). */
export function policeFromArrival(arrivedDay: number | null): readonly [number, number] {
  const M = RULES.march;
  if (arrivedDay === null) return M.policeAfterChristmas;
  const spare = M.christmasEve - arrivedDay;
  if (spare >= M.earlyFrom) return M.policeEarly;
  if (spare >= M.onTimeFrom) return M.policeOnTime;
  return M.policeLate;
}

export function regimeFromMarch(r: MarchResult): StartingRegime {
  const M = RULES.march;
  const S = RULES.start;
  const pop = (n: number) => Math.min(M.max, M.popBase + n);
  const str = (n: number) => Math.min(M.max, M.strBase + n);
  const [policePop, policeStr] = policeFromArrival(r.arrivedDay);
  return {
    pop: {
      rolnici: pop(r.villages),
      statkari: pop(r.towers),
      armada: pop(r.barracks),
      policie: policePop,
      ...(r.messenger ? { italie: S.pop + M.messengerItaly } : {}),
    },
    str: {
      statkari: str(r.towers),
      armada: str(r.barracks),
      povstalci: clamp(M.rebelsMin, M.rebelsFrom, M.rebelsFrom - Math.floor(r.captured / M.capturedPerRebel)),
      policie: policeStr,
    },
    treasury: clamp(M.treasuryMin, M.treasuryMax, M.treasuryBase + r.gold),
    ...(r.volunteers ? { guard: S.guard + M.volunteersGuard } : {}),
  };
}
```

- [ ] **Step 6: The Czech texts.** In `src/shared/i18n/cs.ts`, inside `diktator`, directly after the `atentat: { … },` block (before the `/** The library's historical map …` comment), insert the whole block below. It holds every march string, including those Tasks 8 and 9 use.

```ts
    /** Pochod na Tiranu, the opening march (spec 2026-09-27-diktator-pochod-design). */
    pochod: {
      title: 'Pochod na Tiranu',
      intro:
        '13. prosince 1924. Zogu se vrací z Jugoslávie. Jdou s ním muži z Matu, ruští důstojníci a plk. Vlček. ' +
        'Noliho vláda sedí v Tiraně. Do Štědrého dne tam musíte být.',
      howTo: 'Zogu drží Akci v místě a vyjednává. Vlček Akcí omráčí četníka. Provaz je drží u sebe.',
      start: 'Na pochod!',
      historyTitle: 'Jak to bylo doopravdy',
      historyStart:
        'Zogu překročil hranici 13. prosince 1924 s asi tisícovkou mužů z Dibry a Matu a se stovkou ruských dobrovolníků. ' +
        'Na Štědrý den obsadil Tiranu a Noli uprchl do Itálie.',
      historyEnd: 'Doopravdy vstoupil Zogu do Tirany na Štědrý den 1924. Plk. Vlček a jeho provaz jsou vymyšlení.',
      date: (day: number) => `${day}. prosince`,
      places: {
        maqellare: 'Maqellarë', peshkopi: 'Peshkopi', zerqan: 'Zerqan', bulqize: 'Bulqizë', kukes: 'Kukës', lume: 'Lumë',
        burgajet: 'Burgajet', burrel: 'Burrel', selite: 'Selitë', klos: 'Klos', kruje: 'Krujë', preze: 'Prezë',
        homesh: 'Stáje v Homeshi', martanesh: 'Martanesh', posel: 'Italský posel',
      },
      border: 'Hranice u Dibry',
      tirana: 'Tirana',
      holdToNegotiate: (key: string) => `Drž ${key} — vyjednávat`,
      won: {
        maqellare: 'Sedláci z Maqellarë se přidávají!',
        peshkopi: 'Posádka Peshkopi salutuje! +20 zlata z pokladny kasáren.',
        zerqan: 'Zerqan vítá Zogua chlebem a solí!',
        bulqize: 'Beg z Bulqizë bere zlato a slibuje věrnost.',
        kukes: 'Kasárna v Kukësu vztyčila Zoguovu vlajku! +20 zlata.',
        lume: 'Beg z Lumë se klaní.',
        burgajet: 'Doma na Burgajetu! Rodina dává 40 zlata.',
        burrel: 'Burrel je Zoguův! +20 zlata.',
        selite: 'Beg ze Selitë přijal dar.',
        klos: 'Selé z Klosu se přidávají!',
        kruje: 'Hrad Krujë otevřel brány! +20 zlata.',
        preze: 'Beg z Prezë přechází na Zoguovu stranu.',
        homesh: 'Beg půjčil koně! Dva dny pochodujete rychleji.',
        martanesh: 'Dobrovolníci z Martaneshe se přidávají! Tělesná stráž +1.',
        posel: 'Italský posel slibuje přízeň Říma. Itálie +1.',
      },
      noGold: 'Bez zlata ani slovo.',
      locked: 'Brána je zavřená. Vlčku, na ně!',
      caught: 'Zogu strávil noc v zajetí a ráno se vykoupil.',
      cache: 'Skrýš se zlatem! +15',
      arrived: 'Zvony! Zogu vstupuje do Tirany.',
      timeout: 'Noli prchá do Itálie. Zogu vstupuje do Tirany až po Vánocích.',
      resultTitle: 'Zogu je v Tiraně',
      lines: {
        villages: (n: number, group: string, pop: number) => `Vesnice ${n}/4 → ${group}: oblíbenost ${pop}`,
        towers: (n: number, group: string, pop: number, str: number) => `Věže begů ${n}/4 → ${group}: oblíbenost ${pop}, síla ${str}`,
        barracks: (n: number, group: string, pop: number, str: number) => `Kasárna ${n}/4 → ${group}: oblíbenost ${pop}, síla ${str}`,
        captured: (n: number, group: string, str: number) => `Zajatí četníci ${n} → ${group}: síla ${str}`,
        arrival: (when: string, group: string, pop: number, str: number) => `Příchod ${when} → ${group}: oblíbenost ${pop}, síla ${str}`,
        afterChristmas: 'po Vánocích',
        gold: (n: number, treasury: number) => `Zlato ${n} → pokladna ${treasury}`,
        caught: (n: number) => `Zogu byl zajat ${n}× (pokaždé den a 20 zlata)`,
        caches: (n: number, of: number) => `Skrýše ${n}/${of} (každá +15 zlata)`,
        volunteers: (guard: number) => `Dobrovolníci z Martaneshe → tělesná stráž ${guard}`,
        messenger: (group: string, pop: number) => `Italský posel → ${group}: oblíbenost ${pop}`,
        horses: 'Koně z Homeshe → rychlejší pochod',
      },
      posterTitle: 'Zogu vstupuje do Tirany',
      posterCaption: 'Tirana, prosinec 1924',
      toPalace: 'Do paláce',
      next: 'Dál',
    },
```

- [ ] **Step 7: Create `minigames/march/text.ts`** (Task 8 appends `marchToast` to it):

```ts
// Pochod na Tiranu — the result card's lines: every tally next to what it gives (spec 2026-09-27-diktator-pochod-design
// §2.9, §4.5). Pure; Czech text comes from `cs.diktator.pochod`.

import { cs } from '../../../../shared/i18n/cs';
import type { GroupId } from '../../logic/groups';
import { regimeFromMarch } from '../../logic/march-regime';
import { RULES } from '../../logic/rules';
import type { MarchResult } from './state';

export function marchCardLines(r: MarchResult, names: Readonly<Record<GroupId, string>>, cacheCount: number): string[] {
  const L = cs.diktator.pochod.lines;
  const g = regimeFromMarch(r);
  const pop = (id: GroupId) => g.pop?.[id] ?? RULES.start.pop;
  const str = (id: 'statkari' | 'armada' | 'povstalci' | 'policie') => g.str?.[id] ?? RULES.start.str;
  const when = r.arrivedDay === null ? L.afterChristmas : cs.diktator.pochod.date(r.arrivedDay);
  const lines = [
    L.villages(r.villages, names.rolnici, pop('rolnici')),
    L.towers(r.towers, names.statkari, pop('statkari'), str('statkari')),
    L.barracks(r.barracks, names.armada, pop('armada'), str('armada')),
    L.captured(r.captured, names.povstalci, str('povstalci')),
    L.arrival(when, names.policie, pop('policie'), str('policie')),
    L.gold(r.gold, g.treasury ?? RULES.start.treasury),
  ];
  if (r.caught > 0) lines.push(L.caught(r.caught));
  if (r.caches > 0) lines.push(L.caches(r.caches, cacheCount));
  if (r.volunteers) lines.push(L.volunteers(g.guard ?? RULES.start.guard));
  if (r.messenger) lines.push(L.messenger(names.italie, pop('italie')));
  if (r.horses) lines.push(L.horses);
  return lines;
}
```

- [ ] **Step 8: Run and commit.** `npx vitest run tests/diktator/march` → PASS. The bot tests take a few seconds and have a 30 s timeout. `npm test`; `npx tsc --noEmit`.

```bash
git add src/games/diktator/logic/rules.ts src/games/diktator/logic/state.ts src/games/diktator/logic/march-regime.ts src/games/diktator/minigames/march/text.ts src/shared/i18n/cs.ts tests/diktator/march/regime.test.ts
git commit -m "feat(diktator): Pochod — the result sets the starting regime (+ bodyguard from the volunteers)" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: The drawing, the standees and the game object

**Files:**
- Modify: `src/games/diktator/minigames/arena.ts`, `src/games/diktator/render/puppet/looks.ts`, `render/puppet/draw.ts`, `render/puppet/poses.ts`, `src/games/diktator/minigames/march/text.ts`
- Create: `src/games/diktator/minigames/march/render.ts`, `src/games/diktator/minigames/march/game.ts`
- Test: `tests/diktator/march/render.test.ts`

What the drawing does (spec §7). The listing below is a verified baseline: you may refine the look, but keep the exported names and signatures, since the tests and `main.ts` use them.
- **Terrain** is drawn in the 1921 atlas style:
  - sepia paper;
  - hachure strokes on rock;
  - tree marks in forest and a stipple of dots on snow;
  - blue water with a darker bank line, and plank bridges;
  - a dashed brown road along `map.roads`.

  It is cached per map in 960 × 540 chunk canvases, at most 6, with the least recently used dropped first. Without a DOM (tests) it is drawn directly.
- **Places:** an icon per kind, the name in Poiret One, a red flag with the black eagle once won. The golden ring above Zogu fills clockwise. A locked barracks shows a padlock, and a tower Zogu cannot pay shows a struck coin.
- **Figures** are sorted by y and drawn as standees at scale 0.34 (about 31 px) with a small shadow:
  - the column behind Zogu on his trail: 3 Russians, a peasant per village, 2 for the volunteers, a soldier per joined guard, at most 12;
  - the heroes;
  - the gendarmes and gate guards: stars when stunned or down, lying when down (`rotate(-90° × facing)`), `handsUp` when surrendering;
  - the Italian messenger;
  - the bey beside his tower while Zogu negotiates.
- **Overlays:**
  - the gold cord of the rope from 85 % of its length, red at full length;
  - dusk over the last 3 s of each day;
  - falling snow over snow tiles;
  - the „Drž F — vyjednávat" bubble;
  - the solo marker;
  - the day banner and the toasts;
  - the catch caption over a dimmed screen;
  - the arrival or timeout line.
- **HUD:** the date and the sun arc, the purse, the tallies, and the mini-map (160 × 90, top right, the 12 places only, Tirana's star, Zogu's dot).
- **Cards' backdrops:**
  - the start card: the 1921 atlas crop (`ATLAS_VIEW`) with a red route arrow;
  - the result card: the atlas with the walked trail;
  - the poster: a sepia placeholder frame with its id `poster-tirana-1924` and its caption.

`MarchGame`:
- It accumulates real time into fixed 1/60 s steps, at most 0.25 s per frame, so a background tab does not run the march on its own.
- It carries an Action press to the next step, so a press between two steps is never lost.
- It turns events into toasts (at most 3, 2.5 s each), and keeps the events for `drainEvents()` (sounds, Task 9).
- It runs only while `view === 'play'`.

- [ ] **Step 1: Write the tests.** Create `tests/diktator/march/render.test.ts`:

```ts
// Canvas smoke test for the march drawing (plan Pochod, task 8): every view, many moments of a played march, against
// a recording fake context — never throws, never leaks canvas state. Same fake ctx / Path2D pattern as
// tests/diktator/spot-render.test.ts.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { MarchGame } from '../../../src/games/diktator/minigames/march/game';
import { MARCH } from '../../../src/games/diktator/minigames/march/rules';
import { followerLooks, trailPoint, type MarchView } from '../../../src/games/diktator/minigames/march/render';
import { marchToast } from '../../../src/games/diktator/minigames/march/text';
import { POSES } from '../../../src/games/diktator/render/puppet/poses';
import { solvePuppet } from '../../../src/games/diktator/render/puppet/skeleton';
import { ALBANIA_MARCH } from '../../../src/games/diktator/scenario/albania/march-map';
import { noise } from './helpers';

class FakePath2D {
  constructor(...args: unknown[]) {
    for (const a of args) if (typeof a === 'number' && !Number.isFinite(a)) throw new Error('Path2D: non-finite');
  }
  private check(a: unknown[]): void {
    for (const x of a) if (typeof x === 'number' && !Number.isFinite(x)) throw new Error('Path2D: non-finite');
  }
  moveTo(...a: unknown[]): void { this.check(a); }
  lineTo(...a: unknown[]): void { this.check(a); }
  quadraticCurveTo(...a: unknown[]): void { this.check(a); }
  rect(...a: unknown[]): void { this.check(a); }
  ellipse(...a: unknown[]): void { this.check(a); }
  arc(...a: unknown[]): void { this.check(a); }
  closePath(): void {}
}

function createFakeCtx(): CanvasRenderingContext2D & { depth: number } {
  let depth = 0;
  const store: Record<string, unknown> = {};
  return new Proxy(store, {
    get(_t, prop) {
      if (prop === 'depth') return depth;
      return (...args: unknown[]) => {
        for (const a of args) {
          if (typeof a === 'number' && !Number.isFinite(a)) throw new Error(`ctx.${String(prop)}: non-finite argument`);
        }
        if (prop === 'save') depth++;
        if (prop === 'restore' && --depth < 0) throw new Error('ctx.restore(): more restores than saves');
        return undefined;
      };
    },
    set(t, prop, value) {
      t[String(prop)] = value;
      return true;
    },
  }) as unknown as CanvasRenderingContext2D & { depth: number };
}

let originalPath2D: unknown;
beforeAll(() => {
  originalPath2D = globalThis.Path2D;
  (globalThis as { Path2D: unknown }).Path2D = FakePath2D;
});
afterAll(() => {
  (globalThis as { Path2D: unknown }).Path2D = originalPath2D;
});

function draw(game: MarchGame, label: string): void {
  const ctx = createFakeCtx();
  expect(() => game.render(ctx, game.state.now), label).not.toThrow();
  expect(ctx.depth, label).toBe(0);
}

describe('drawMarch (canvas smoke test)', () => {
  it('draws every view', () => {
    const game = new MarchGame(ALBANIA_MARCH, 1, false);
    for (const view of ['intro', 'play', 'result', 'poster'] as MarchView[]) {
      game.view = view;
      draw(game, view);
    }
  });

  it('draws a played march at many moments: walking, negotiating, fights, catches, the end', () => {
    for (const seed of [1, 2, 3]) {
      const game = new MarchGame(ALBANIA_MARCH, seed, seed === 3);
      game.view = 'play';
      const zi = noise(seed);
      const vi = noise(seed + 50);
      for (let k = 0; k < 60 && !game.result(); k++) {
        for (let i = 0; i < 90; i++) game.update(MARCH.step, { zogu: zi(), velitel: vi() });
        draw(game, `seed ${seed}, frame ${k}`);
      }
    }
  });

  it('draws the stunned, down and surrendering gendarmes, the rope at full length and the catch caption', () => {
    const game = new MarchGame(ALBANIA_MARCH, 4, false);
    game.view = 'play';
    const s = game.state;
    const z = s.heroes.zogu;
    for (const mode of ['stunned', 'down', 'surrender', 'leaving', 'chase'] as const) {
      s.foes.push({
        id: 900 + s.foes.length, kind: 'gendarme', x: z.x - 60, y: z.y, facing: 1, moving: false, mode, until: 99, hits: 1,
        route: 0, wp: 1, dir: 1, squad: 77, stuck: 0, place: -1, homeX: z.x, homeY: z.y,
      });
    }
    s.heroes.velitel.x = z.x - MARCH.rope;
    z.frozenUntil = s.now + 1;
    draw(game, 'fight');
  });
});

describe('drawing helpers', () => {
  it('finds points behind Zogu along his trail', () => {
    const game = new MarchGame(ALBANIA_MARCH, 1, false);
    const s = game.state;
    s.trail = [[0, 0], [100, 0]];
    s.heroes.zogu.x = 200;
    s.heroes.zogu.y = 0;
    expect(trailPoint(s, 50)).toEqual({ x: 150, y: 0 });
    expect(trailPoint(s, 150)).toEqual({ x: 50, y: 0 });
    expect(trailPoint(s, 999)).toEqual({ x: 0, y: 0 });
  });

  it('builds the column: 3 Russians, a peasant per village, a soldier per joined guard, at most 12', () => {
    const s = new MarchGame(ALBANIA_MARCH, 1, false).state;
    expect(followerLooks(s)).toHaveLength(3);
    s.villages = 4;
    s.volunteers = true;
    s.joined = 9;
    expect(followerLooks(s)).toHaveLength(12);
  });

  it('raises both hands when a gendarme surrenders', () => {
    const j = solvePuppet(POSES.handsUp(0));
    expect(j.armF.hand[1]).toBeGreaterThan(j.neck[1]);
    expect(j.armB.hand[1]).toBeGreaterThan(j.neck[1]);
  });

  it('turns events into bubbles', () => {
    const s = new MarchGame(ALBANIA_MARCH, 1, false).state;
    const klos = s.places.findIndex((p) => p.def.id === 'klos');
    expect(marchToast({ type: 'won', place: klos }, s)).toBe('Selé z Klosu se přidávají!');
    expect(marchToast({ type: 'refused', place: 0, reason: 'noGold' }, s)).toBe('Bez zlata ani slovo.');
    expect(marchToast({ type: 'caught' }, s)).toBe('Zogu strávil noc v zajetí a ráno se vykoupil.');
    expect(marchToast({ type: 'tick' }, s)).toBeNull();
  });
});

describe('MarchGame', () => {
  it('runs only in the play view, in fixed steps, and never loses an Action press', () => {
    const game = new MarchGame(ALBANIA_MARCH, 1, false);
    game.update(1, {});
    expect(game.state.now).toBe(0);
    game.view = 'play';
    game.update(0.005, { velitel: { moveX: 0, moveY: 0, action: true } });
    expect(game.state.now).toBe(0);
    game.update(0.02, { velitel: { moveX: 0, moveY: 0, action: false } });
    expect(game.drainEvents()).toContainEqual({ type: 'swing' });
    expect(game.drainEvents()).toEqual([]);
    game.update(5, {});
    expect(game.state.now).toBeLessThan(0.3);
  });
});
```

- [ ] **Step 2: Run to see it fail.**

- [ ] **Step 3: `ArenaInput.held`.** In `minigames/arena.ts`, add to `ArenaInput` after `readonly action: boolean;`:

```ts
  /** Action is held down this tick (Pochod na Tiranu: Zogu negotiates while he holds it). */
  readonly held?: boolean;
```

  `SpotGame` ignores it.

- [ ] **Step 4: The puppets.**
  - `render/puppet/looks.ts`:
    - add `'papakha'` to `HatKind` (before `'none'`);
    - after `treasurer` in `LOOKS`, add:
    ```ts
      /** Pochod na Tiranu: a White Russian officer of Zogu's column — grey greatcoat, fur papakha. */
      russian: { coat: '#6f6d63', trim: '#a08a52', legs: '#4b4a42', boots: '#1c1712', hat: 'papakha', hatColor: '#3b332c', moustache: true },
    ```
  - `render/puppet/draw.ts`, in `drawHat`: add the case after `case 'bun': …`:
    ```ts
          case 'papakha': path.moveTo(-r * 0.8, r * 0.5); path.lineTo(-r * 0.72, r * 1.55); path.lineTo(r * 0.72, r * 1.55); path.lineTo(r * 0.8, r * 0.5); path.closePath(); break;
    ```
    and, before `if (L.hat === 'fez') {`:
    ```ts
        if (L.hat === 'papakha') {
          // Fur: short vertical strokes across the cylinder.
          ctx.strokeStyle = LINE;
          ctx.lineWidth = 0.8;
          for (let i = -3; i <= 3; i++) {
            ctx.beginPath(); ctx.moveTo(i * r * 0.2, r * 0.62); ctx.lineTo(i * r * 0.2 + r * 0.06, r * 1.45); ctx.stroke();
          }
        }
    ```
  - `render/puppet/poses.ts`, in `POSE_TABLE` after `handInCoat`:
    ```ts
      /** Pochod na Tiranu: a gendarme gives himself up — both hands raised beside the head. */
      handsUp: () => ({ ...STAND, head: -4, armF: [18, -22], armB: [-18, 22], face: 'shocked' }) satisfies PuppetPose,
    ```
  The existing puppet tests iterate `LOOKS` and `POSES`, so they now cover the new look and pose too.

- [ ] **Step 5: Bubbles.** Append to `minigames/march/text.ts`:

```ts
/** The short bubble an event raises over the map (a won place's line, a refusal, a catch, a cache), or null. */
export function marchToast(e: MarchEvent, s: MarchState): string | null {
  const P = cs.diktator.pochod;
  switch (e.type) {
    case 'won': return P.won[s.places[e.place].def.id];
    case 'refused': return e.reason === 'noGold' ? P.noGold : P.locked;
    case 'caught': return P.caught;
    case 'cache': return P.cache;
    default: return null;
  }
}
```

  and change its state import to `import type { MarchEvent, MarchResult, MarchState } from './state';`.

- [ ] **Step 6: Create `minigames/march/render.ts`:**

```ts
// Draws Pochod na Tiranu (spec 2026-09-27-diktator-pochod-design §7), 960 × 540, y down. Reads the state, never
// changes it. Owns its canvas state (save/restore balanced). The map is drawn in the style of the 1921 atlas; the
// people are the palace puppets as small standees (scale 0.34).

import { cs } from '../../../../shared/i18n/cs';
import type { Hero } from '../../logic/palace';
import { drawPuppet } from '../../render/puppet/draw';
import { LOOKS, type Look } from '../../render/puppet/looks';
import { POSES } from '../../render/puppet/poses';
import { solvePuppet, type Face, type PuppetPose } from '../../render/puppet/skeleton';
import { albaniaMap } from '../../render/rooms/images';
import { ARENA_H, ARENA_W } from '../arena';
import { ATLAS_VIEW, mapHeight, mapWidth, terrainAt, tileCentre, worldToAtlas, type MarchMap, type Terrain } from './map';
import { barracksLocked, zoguPlace } from './places';
import { MARCH } from './rules';
import { cameraOf, dateOf, dist, type Foe, type MarchState, type PlaceState, type Point } from './state';

/** What the canvas shows: the start card's atlas, the march, the result card's atlas, the poster. */
export type MarchView = 'intro' | 'play' | 'result' | 'poster';

/** What the drawing needs besides the state (MarchGame satisfies it). */
export interface MarchScene {
  readonly state: MarchState;
  readonly view: MarchView;
  readonly active: Hero;
  readonly actionKey: string;
  readonly toasts: readonly { readonly text: string; readonly until: number }[];
}

const P = cs.diktator.pochod;
const RAD = Math.PI / 180;
/** Puppet scale on the map: FIGURE_HEIGHT 90 × 0.34 ≈ 31 px (spec §5.1). */
export const STANDEE = 0.34;
const PAPER = '#eadcbf';
const INK = '#3b2a1a';
const GOLD = '#c9a44a';
const RED = '#b0302a';
const MAX_CHUNKS = 6;
const FOLLOWER_GAP = 20;
const MAX_FOLLOWERS = 12;

// ---------- terrain in the atlas style, cached in 960 × 540 chunks ----------

interface Offscreen {
  readonly canvas: CanvasImageSource;
  readonly ctx: CanvasRenderingContext2D;
}

function makeOffscreen(w: number, h: number): Offscreen | null {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  return ctx ? { canvas, ctx } : null;
}

/** A stable pseudo-random 0..1 per tile and salt (hachures, trees, stipple), so chunks redraw identically. */
function hash(c: number, r: number, k: number): number {
  return (((c * 73856093) ^ (r * 19349663) ^ (k * 83492791)) >>> 0) % 1000 / 1000;
}

const WATER = '#86abc9';

function isWater(map: MarchMap, c: number, r: number): boolean {
  if (c < 0 || r < 0 || c >= map.cols || r >= map.rows) return false;
  const ch = map.terrain[r][c];
  return ch === '~' || ch === 'w' || ch === 'o' || ch === 'b';
}

function drawTile(ctx: CanvasRenderingContext2D, map: MarchMap, c: number, r: number): void {
  const T = map.tile;
  const x = c * T;
  const y = r * T;
  const ch = map.terrain[r][c] as Terrain;
  ctx.fillStyle = ch === 's' ? '#f3eee3' : ch === 'm' ? '#d2bf98' : PAPER;
  ctx.fillRect(x, y, T, T);
  switch (ch) {
    case 'f':
      for (let k = 0; k < 3; k++) {
        const tx = x + 10 + hash(c, r, k) * 40;
        const ty = y + 14 + hash(c, r, k + 7) * 36;
        ctx.fillStyle = '#6f7f4a';
        ctx.beginPath(); ctx.arc(tx, ty, 6, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#5a4630';
        ctx.fillRect(tx - 1, ty + 5, 2, 5);
      }
      break;
    case 's':
      ctx.fillStyle = '#9aa3ad';
      for (let k = 0; k < 9; k++) ctx.fillRect(x + hash(c, r, k) * T, y + hash(c, r, k + 20) * T, 1.5, 1.5);
      break;
    case 'm':
      ctx.strokeStyle = '#8a6e4a';
      ctx.lineWidth = 1.2;
      for (let k = 0; k < 6; k++) {
        const hx = x + hash(c, r, k) * (T - 12);
        const hy = y + 8 + hash(c, r, k + 11) * (T - 16);
        ctx.beginPath(); ctx.moveTo(hx, hy + 8); ctx.lineTo(hx + 6, hy); ctx.lineTo(hx + 12, hy + 8); ctx.stroke();
      }
      break;
    case '~': case 'w': case 'o': case 'b':
      ctx.fillStyle = ch === 'o' ? '#a9c4d8' : WATER;
      ctx.fillRect(x, y, T, T);
      ctx.strokeStyle = '#4f7ea6';
      ctx.lineWidth = 2;
      for (const [dc, dr, x0, y0, x1, y1] of [[0, -1, 0, 0, T, 0], [0, 1, 0, T, T, T], [-1, 0, 0, 0, 0, T], [1, 0, T, 0, T, T]] as const) {
        if (!isWater(map, c + dc, r + dr)) { ctx.beginPath(); ctx.moveTo(x + x0, y + y0); ctx.lineTo(x + x1, y + y1); ctx.stroke(); }
      }
      if (ch === 'b') {
        ctx.fillStyle = '#8a5a2b';
        ctx.fillRect(x, y + T * 0.3, T, T * 0.4);
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1;
        for (let k = 1; k < 6; k++) { ctx.beginPath(); ctx.moveTo(x + k * 10, y + T * 0.3); ctx.lineTo(x + k * 10, y + T * 0.7); ctx.stroke(); }
      }
      break;
    default:
      break;
  }
}

function drawRoads(ctx: CanvasRenderingContext2D, map: MarchMap): void {
  ctx.save();
  ctx.strokeStyle = '#8a5a2b';
  ctx.lineWidth = 3;
  ctx.setLineDash([10, 7]);
  for (const road of map.roads) {
    ctx.beginPath();
    road.forEach((at, i) => {
      const [x, y] = tileCentre(map, at);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
  }
  ctx.restore();
}

/** Draws the terrain and roads of a world rectangle into `ctx` (already in world coordinates). */
function drawTerrain(ctx: CanvasRenderingContext2D, map: MarchMap, x0: number, y0: number, w: number, h: number): void {
  const c0 = Math.max(0, Math.floor(x0 / map.tile));
  const r0 = Math.max(0, Math.floor(y0 / map.tile));
  const c1 = Math.min(map.cols - 1, Math.floor((x0 + w) / map.tile));
  const r1 = Math.min(map.rows - 1, Math.floor((y0 + h) / map.tile));
  for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) drawTile(ctx, map, c, r);
  drawRoads(ctx, map);
}

const chunkCaches = new WeakMap<MarchMap, Map<string, Offscreen>>();

/** A 960 × 540 terrain chunk, built lazily; at most 6 kept, least recently used dropped first. Null without a DOM. */
function chunk(map: MarchMap, cx: number, cy: number): Offscreen | null {
  let cache = chunkCaches.get(map);
  if (!cache) chunkCaches.set(map, (cache = new Map()));
  const key = `${cx},${cy}`;
  const hit = cache.get(key);
  if (hit) {
    cache.delete(key);
    cache.set(key, hit);
    return hit;
  }
  const off = makeOffscreen(ARENA_W, ARENA_H);
  if (!off) return null;
  off.ctx.save();
  off.ctx.translate(-cx * ARENA_W, -cy * ARENA_H);
  drawTerrain(off.ctx, map, cx * ARENA_W, cy * ARENA_H, ARENA_W, ARENA_H);
  off.ctx.restore();
  cache.set(key, off);
  if (cache.size > MAX_CHUNKS) cache.delete(cache.keys().next().value!);
  return off;
}

function drawGround(ctx: CanvasRenderingContext2D, map: MarchMap, ox: number, oy: number): void {
  for (let cy = Math.floor(oy / ARENA_H); cy * ARENA_H < oy + ARENA_H; cy++) {
    for (let cx = Math.floor(ox / ARENA_W); cx * ARENA_W < ox + ARENA_W; cx++) {
      const off = chunk(map, cx, cy);
      if (off) ctx.drawImage(off.canvas, cx * ARENA_W, cy * ARENA_H);
      else drawTerrain(ctx, map, Math.max(ox, cx * ARENA_W), Math.max(oy, cy * ARENA_H), ARENA_W, ARENA_H);
    }
  }
}

// ---------- places ----------

function label(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, size = 13): void {
  ctx.font = `${size}px 'Poiret One', Georgia, serif`;
  ctx.textAlign = 'center';
  ctx.lineWidth = 3;
  ctx.strokeStyle = PAPER;
  ctx.strokeText(text, x, y);
  ctx.fillStyle = INK;
  ctx.fillText(text, x, y);
  ctx.textAlign = 'left';
}

function house(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, wall: string): void {
  ctx.fillStyle = wall;
  ctx.fillRect(x - w / 2, y - h, w, h);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.2;
  ctx.strokeRect(x - w / 2, y - h, w, h);
  ctx.fillStyle = '#9a4a2a';
  ctx.beginPath(); ctx.moveTo(x - w / 2 - 3, y - h); ctx.lineTo(x, y - h - w * 0.45); ctx.lineTo(x + w / 2 + 3, y - h); ctx.closePath(); ctx.fill(); ctx.stroke();
}

/** The red flag with the black eagle over a won place. */
function flag(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y - 30); ctx.stroke();
  ctx.fillStyle = '#c8102e';
  ctx.fillRect(x, y - 30, 18, 12);
  ctx.fillStyle = '#111';
  ctx.beginPath(); ctx.ellipse(x + 9, y - 24, 4, 3, 0, 0, Math.PI * 2); ctx.fill();
}

function drawPlace(ctx: CanvasRenderingContext2D, p: PlaceState): void {
  if (p.def.kind === 'messenger') return; // drawn as a standee
  const { x, y } = p;
  switch (p.def.kind) {
    case 'village': case 'volunteers': house(ctx, x - 10, y, 16, 12, '#efe3c8'); house(ctx, x + 10, y + 4, 14, 10, '#e6d6b4'); break;
    case 'home': house(ctx, x, y, 30, 18, '#e0cfa6'); ctx.fillStyle = '#cdb98e'; ctx.fillRect(x + 10, y - 34, 10, 16); break;
    case 'tower': ctx.fillStyle = '#e4d3ae'; ctx.fillRect(x - 9, y - 34, 18, 34); ctx.strokeStyle = INK; ctx.lineWidth = 1.2; ctx.strokeRect(x - 9, y - 34, 18, 34); ctx.fillStyle = INK; ctx.fillRect(x - 3, y - 28, 6, 4); break;
    case 'barracks': house(ctx, x, y, 44, 14, '#d9c9a2'); ctx.strokeStyle = INK; ctx.beginPath(); ctx.moveTo(x + 26, y); ctx.lineTo(x + 26, y - 30); ctx.stroke(); break;
    case 'stable': house(ctx, x, y, 34, 14, '#c9a77a'); break;
  }
  if (p.won) flag(ctx, x + 16, y - 6);
  label(ctx, P.places[p.def.id], x, y + 18);
}

/** The golden ring over Zogu's head; a padlock on a locked barracks, a struck coin on a tower he cannot pay. */
function drawRing(ctx: CanvasRenderingContext2D, s: MarchState): void {
  const i = zoguPlace(s);
  if (i < 0 || s.places[i].won) return;
  const p = s.places[i];
  const z = s.heroes.zogu;
  const cx = z.x;
  const cy = z.y - 48;
  ctx.lineWidth = 4;
  ctx.strokeStyle = 'rgba(40, 30, 20, 0.45)';
  ctx.beginPath(); ctx.arc(cx, cy, 11, 0, Math.PI * 2); ctx.stroke();
  if (p.def.kind === 'barracks' && barracksLocked(s, i)) {
    ctx.fillStyle = INK;
    ctx.fillRect(cx - 5, cy - 2, 10, 8);
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(cx, cy - 2, 4, Math.PI, 0); ctx.stroke();
    return;
  }
  if (p.def.kind === 'tower' && s.gold < p.bribe) {
    ctx.fillStyle = GOLD;
    ctx.beginPath(); ctx.arc(cx, cy, 6, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = RED;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(cx - 7, cy - 7); ctx.lineTo(cx + 7, cy + 7); ctx.stroke();
    return;
  }
  // Clockwise from the top: canvas angles grow clockwise with y down.
  ctx.strokeStyle = GOLD;
  ctx.lineWidth = 4;
  ctx.beginPath(); ctx.arc(cx, cy, 11, -Math.PI / 2, -Math.PI / 2 + (Math.PI * 2 * p.progress) / p.ring); ctx.stroke();
}

// ---------- figures ----------

function shadow(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  ctx.fillStyle = 'rgba(40, 28, 16, 0.25)';
  ctx.beginPath(); ctx.ellipse(x, y, 9, 3, 0, 0, Math.PI * 2); ctx.fill();
}

/** One puppet as a small standee with its feet at (x, y); `lying` turns it on its back (a knocked-out gendarme). */
export function drawStandee(
  ctx: CanvasRenderingContext2D, x: number, y: number, look: Look, pose: PuppetPose, face: Face, facing: 1 | -1, lying = false,
): void {
  shadow(ctx, x, y);
  ctx.save();
  ctx.translate(x, y);
  if (lying) ctx.rotate(-90 * RAD * facing);
  ctx.transform(STANDEE * facing, 0, 0, -STANDEE, 0, 0);
  drawPuppet(ctx, solvePuppet(pose), look, face);
  ctx.restore();
}

function stars(ctx: CanvasRenderingContext2D, x: number, y: number, t: number): void {
  ctx.fillStyle = '#f2c230';
  for (let k = 0; k < 3; k++) {
    const a = t * 4 + (k * Math.PI * 2) / 3;
    ctx.beginPath(); ctx.arc(x + Math.cos(a) * 9, y + Math.sin(a) * 3, 2, 0, Math.PI * 2); ctx.fill();
  }
}

/** The point `back` units behind Zogu along his trail (the followers walk there). Pure. */
export function trailPoint(s: MarchState, back: number): Point {
  let prev: Point = s.heroes.zogu;
  let left = back;
  for (let i = s.trail.length - 1; i >= 0; i--) {
    const q = { x: s.trail[i][0], y: s.trail[i][1] };
    const d = dist(prev, q);
    if (d >= left && d > 0) return { x: prev.x + ((q.x - prev.x) * left) / d, y: prev.y + ((q.y - prev.y) * left) / d };
    left -= d;
    prev = q;
  }
  return prev;
}

/** The column behind Zogu (render only): 3 Russians, a peasant per village won and per volunteer group, a soldier per
 * gate guard who joined; at most 12. */
export function followerLooks(s: MarchState): Look[] {
  const out: Look[] = [LOOKS.russian, LOOKS.russian, LOOKS.russian];
  for (let i = 0; i < s.villages + (s.volunteers ? 2 : 0); i++) out.push(LOOKS.peasant);
  for (let i = 0; i < s.joined; i++) out.push(LOOKS.officer);
  return out.slice(0, MAX_FOLLOWERS);
}

function foePose(f: Foe, t: number): { pose: PuppetPose; face: Face; lying: boolean } {
  switch (f.mode) {
    case 'stunned': return { pose: POSES.shocked(t), face: 'shocked', lying: false };
    case 'down': return { pose: POSES.stand(t), face: 'shocked', lying: true };
    case 'surrender': return { pose: POSES.handsUp(t), face: 'shocked', lying: false };
    case 'post': return { pose: POSES.stand(t), face: 'grumpy', lying: false };
    default: return { pose: f.moving ? POSES.walk(t) : POSES.stand(t), face: f.mode === 'chase' ? 'furious' : 'grumpy', lying: false };
  }
}

function drawFigures(ctx: CanvasRenderingContext2D, scene: MarchScene, t: number): void {
  const s = scene.state;
  const items: { y: number; draw: () => void }[] = [];
  followerLooks(s).forEach((look, k) => {
    const p = trailPoint(s, FOLLOWER_GAP * (k + 2));
    const moving = s.heroes.zogu.moving;
    items.push({ y: p.y, draw: () => drawStandee(ctx, p.x, p.y, look, moving ? POSES.walk(t + k * 0.3) : POSES.stand(t), 'neutral', s.heroes.zogu.facing) });
  });
  for (const h of ['zogu', 'velitel'] as const) {
    const f = s.heroes[h];
    let pose = f.moving ? POSES.walk(t) : POSES.stand(t);
    let face: Face = 'neutral';
    if (h === 'zogu' && s.now < f.frozenUntil) { pose = POSES.shocked(t); face = 'shocked'; }
    else if (h === 'zogu' && (s.now < f.actUntil || s.negotiating >= 0)) { pose = POSES.talk(t); face = 'happy'; }
    else if (h === 'velitel' && s.now < f.actUntil) { pose = POSES.point(t); face = 'furious'; }
    items.push({ y: f.y, draw: () => drawStandee(ctx, f.x, f.y, LOOKS[h], pose, face, f.facing) });
  }
  for (const f of s.foes) {
    const { pose, face, lying } = foePose(f, t);
    const look = f.kind === 'guard' ? LOOKS.officer : LOOKS.gendarme;
    items.push({
      y: f.y,
      draw: () => {
        drawStandee(ctx, f.x, f.y, look, pose, face, f.facing, lying);
        if (f.mode === 'stunned' || f.mode === 'down') stars(ctx, f.x, f.y - (lying ? 12 : 34), t);
      },
    });
  }
  for (const p of s.places) {
    if (p.def.kind === 'messenger') {
      items.push({ y: p.y, draw: () => drawStandee(ctx, p.x, p.y, LOOKS.italy, POSES.walk(t), 'happy', p.dir === 1 ? -1 : 1) });
    }
  }
  if (s.negotiating >= 0 && s.places[s.negotiating].def.kind === 'tower') {
    const p = s.places[s.negotiating];
    items.push({ y: p.y + 1, draw: () => drawStandee(ctx, p.x + 22, p.y + 1, LOOKS.bey, POSES.talk(t), 'grumpy', -1) });
  }
  items.sort((a, b) => a.y - b.y);
  for (const it of items) it.draw();
}

function drawRope(ctx: CanvasRenderingContext2D, s: MarchState): void {
  const z = s.heroes.zogu;
  const v = s.heroes.velitel;
  const d = dist(z, v);
  if (d < MARCH.rope * MARCH.ropeTaut) return;
  ctx.strokeStyle = d >= MARCH.rope - 1 ? RED : GOLD;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(z.x, z.y - 14);
  ctx.quadraticCurveTo((z.x + v.x) / 2, (z.y + v.y) / 2 - 6 + (MARCH.rope - d) * 0.3, v.x, v.y - 14);
  ctx.stroke();
}

function drawCaches(ctx: CanvasRenderingContext2D, s: MarchState): void {
  s.map.caches.forEach((at, i) => {
    if (s.caches[i]) return;
    const [x, y] = tileCentre(s.map, at);
    ctx.fillStyle = '#7a4e26';
    ctx.fillRect(x - 7, y - 6, 14, 9);
    ctx.fillStyle = GOLD;
    ctx.fillRect(x - 1.5, y - 4, 3, 3);
  });
}

// ---------- screen-space overlays ----------

function bubble(ctx: CanvasRenderingContext2D, text: string, x: number, y: number): void {
  ctx.font = '14px Georgia, serif';
  const w = text.length * 7 + 20;
  ctx.fillStyle = 'rgba(250, 244, 228, 0.95)';
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.5;
  ctx.fillRect(x - w / 2, y - 18, w, 26);
  ctx.strokeRect(x - w / 2, y - 18, w, 26);
  ctx.fillStyle = INK;
  ctx.textAlign = 'center';
  ctx.fillText(text, x, y);
  ctx.textAlign = 'left';
}

function drawHud(ctx: CanvasRenderingContext2D, s: MarchState): void {
  ctx.fillStyle = 'rgba(28, 20, 12, 0.72)';
  ctx.fillRect(0, 0, ARENA_W, 34);
  ctx.fillStyle = PAPER;
  ctx.font = '18px Georgia, serif';
  ctx.fillText(P.date(dateOf(s.t)), 14, 23);
  // The sun arc for the day.
  const f = (s.t % MARCH.day) / MARCH.day;
  ctx.strokeStyle = 'rgba(234, 220, 191, 0.5)';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.arc(190, 30, 24, Math.PI, 0); ctx.stroke();
  ctx.fillStyle = '#f2c230';
  ctx.beginPath(); ctx.arc(190 - Math.cos(f * Math.PI) * 24, 30 - Math.sin(f * Math.PI) * 24, 4, 0, Math.PI * 2); ctx.fill();
  // The purse and the tallies.
  ctx.fillStyle = GOLD;
  ctx.beginPath(); ctx.arc(250, 17, 8, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = PAPER;
  ctx.fillText(String(s.gold), 264, 23);
  const tallies: [string, string][] = [
    ['⌂', `${s.villages}/4`], ['♜', `${s.towers}/4`], ['⚑', `${s.barracks}/4`], ['✋', String(s.captured)],
  ];
  tallies.forEach(([icon, n], k) => ctx.fillText(`${icon} ${n}`, 340 + k * 90, 23));
  drawMiniMap(ctx, s);
}

const MINI = { x: 790, y: 40, w: 160, h: 90 } as const;

function drawMiniMap(ctx: CanvasRenderingContext2D, s: MarchState): void {
  const kx = MINI.w / mapWidth(s.map);
  const ky = MINI.h / mapHeight(s.map);
  ctx.fillStyle = 'rgba(234, 220, 191, 0.9)';
  ctx.fillRect(MINI.x, MINI.y, MINI.w, MINI.h);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1;
  ctx.strokeRect(MINI.x, MINI.y, MINI.w, MINI.h);
  for (const p of s.places) {
    // Only the 12 places; the optional benefits are found by exploring (spec §4.5).
    if (p.def.kind === 'messenger' || p.def.kind === 'stable' || p.def.kind === 'volunteers') continue;
    ctx.fillStyle = p.won ? '#2f6a3a' : RED;
    ctx.fillRect(MINI.x + p.x * kx - 2, MINI.y + p.y * ky - 2, 4, 4);
  }
  const [gx, gy] = tileCentre(s.map, s.map.goal);
  ctx.fillStyle = GOLD;
  ctx.font = '12px Georgia, serif';
  ctx.fillText('★', MINI.x + gx * kx - 5, MINI.y + gy * ky + 4);
  const z = s.heroes.zogu;
  ctx.fillStyle = INK;
  ctx.beginPath(); ctx.arc(MINI.x + z.x * kx, MINI.y + z.y * ky, 3, 0, Math.PI * 2); ctx.fill();
}

function drawOverlays(ctx: CanvasRenderingContext2D, scene: MarchScene, ox: number, oy: number): void {
  const s = scene.state;
  // Dusk over the last 3 s of each day.
  const dusk = (s.t % MARCH.day) - (MARCH.day - 3);
  if (dusk > 0 && !s.ending) {
    ctx.fillStyle = `rgba(40, 30, 70, ${(0.28 * dusk) / 3})`;
    ctx.fillRect(0, 0, ARENA_W, ARENA_H);
  }
  // Falling snow while the camera looks at snow.
  const cam = cameraOf(s);
  if (terrainAt(s.map, cam.x, cam.y) === 's' || terrainAt(s.map, s.heroes.zogu.x, s.heroes.zogu.y) === 's') {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    for (let k = 0; k < 40; k++) {
      const x = (hash(k, 1, 3) * ARENA_W + s.now * 12) % ARENA_W;
      const y = (hash(k, 2, 5) * ARENA_H + s.now * (30 + hash(k, 3, 7) * 30)) % ARENA_H;
      ctx.fillRect(x, y, 2, 2);
    }
  }
  // "Drž F — vyjednávat" over Zogu in an unfinished place.
  const i = zoguPlace(s);
  if (i >= 0 && !s.places[i].won && s.negotiating < 0 && s.now >= s.heroes.zogu.frozenUntil) {
    bubble(ctx, P.holdToNegotiate(scene.actionKey), s.heroes.zogu.x - ox, s.heroes.zogu.y - oy - 70);
  }
  // The solo marker over the steered hero.
  if (s.solo) {
    const a = s.heroes[scene.active];
    ctx.fillStyle = GOLD;
    ctx.beginPath(); ctx.moveTo(a.x - ox - 5, a.y - oy - 42); ctx.lineTo(a.x - ox + 5, a.y - oy - 42); ctx.lineTo(a.x - ox, a.y - oy - 35); ctx.closePath(); ctx.fill();
  }
  // The day banner, the toasts, the catch caption and the ending.
  if (s.t >= MARCH.day && s.t % MARCH.day < 2 && !s.ending) bubble(ctx, P.date(dateOf(s.t)), ARENA_W / 2, 80);
  scene.toasts.forEach((tt, k) => bubble(ctx, tt.text, ARENA_W / 2, ARENA_H - 30 - k * 32));
  if (s.now < s.heroes.zogu.frozenUntil) {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(0, 0, ARENA_W, ARENA_H);
    bubble(ctx, P.caught, ARENA_W / 2, ARENA_H / 2);
  }
  if (s.ending) bubble(ctx, s.ending.kind === 'arrived' ? P.arrived : P.timeout, ARENA_W / 2, ARENA_H / 2);
}

function drawPlay(ctx: CanvasRenderingContext2D, scene: MarchScene, t: number): void {
  const s = scene.state;
  const cam = cameraOf(s);
  const ox = Math.round(cam.x - ARENA_W / 2);
  const oy = Math.round(cam.y - ARENA_H / 2);
  ctx.save();
  ctx.translate(-ox, -oy);
  drawGround(ctx, s.map, ox, oy);
  drawCaches(ctx, s);
  for (const p of s.places) drawPlace(ctx, p);
  const [gx, gy] = tileCentre(s.map, s.map.goal);
  house(ctx, gx - 14, gy, 22, 16, '#efe3c8');
  house(ctx, gx + 12, gy + 6, 26, 18, '#e6d6b4');
  label(ctx, P.tirana, gx, gy + 24, 16);
  drawRope(ctx, s);
  drawFigures(ctx, scene, t);
  drawRing(ctx, s);
  ctx.restore();
  drawOverlays(ctx, scene, ox, oy);
  drawHud(ctx, s);
}

// ---------- the cards' backdrops ----------

/** Atlas image pixels → canvas, for the part of the 1921 map the cards show. */
function atlasToCanvas(px: number, py: number): [number, number] {
  return [((px - ATLAS_VIEW.sx) * ARENA_W) / ATLAS_VIEW.sw, ((py - ATLAS_VIEW.sy) * ARENA_H) / ATLAS_VIEW.sh];
}

function drawAtlas(ctx: CanvasRenderingContext2D): void {
  const img = albaniaMap();
  if (img) ctx.drawImage(img, ATLAS_VIEW.sx, ATLAS_VIEW.sy, ATLAS_VIEW.sw, ATLAS_VIEW.sh, 0, 0, ARENA_W, ARENA_H);
  else {
    ctx.fillStyle = '#d8c8a0';
    ctx.fillRect(0, 0, ARENA_W, ARENA_H);
  }
}

function polyline(ctx: CanvasRenderingContext2D, map: MarchMap, pts: readonly (readonly [number, number])[], color: string, width: number): void {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath();
  pts.forEach(([x, y], i) => {
    const [cx, cy] = atlasToCanvas(...worldToAtlas(map, x, y));
    if (i === 0) ctx.moveTo(cx, cy);
    else ctx.lineTo(cx, cy);
  });
  ctx.stroke();
}

function drawIntro(ctx: CanvasRenderingContext2D, s: MarchState): void {
  drawAtlas(ctx);
  const route = [s.map.start, s.map.goal].map((at) => tileCentre(s.map, at));
  polyline(ctx, s.map, route, RED, 6);
  const [ex, ey] = atlasToCanvas(...worldToAtlas(s.map, ...route[1]));
  ctx.fillStyle = RED;
  ctx.beginPath(); ctx.moveTo(ex, ey); ctx.lineTo(ex + 22, ey - 6); ctx.lineTo(ex + 14, ey + 14); ctx.closePath(); ctx.fill();
}

function drawResult(ctx: CanvasRenderingContext2D, s: MarchState): void {
  drawAtlas(ctx);
  polyline(ctx, s.map, s.trail, RED, 4);
}

/** The placeholder poster (parent spec §11: a sepia frame with its id and caption until the art exists). */
function drawPoster(ctx: CanvasRenderingContext2D): void {
  ctx.fillStyle = '#d9c7a0';
  ctx.fillRect(0, 0, ARENA_W, ARENA_H);
  ctx.strokeStyle = '#6b5433';
  ctx.lineWidth = 6;
  ctx.strokeRect(40, 30, ARENA_W - 80, ARENA_H - 60);
  ctx.fillStyle = '#3b2a1a';
  ctx.textAlign = 'center';
  ctx.font = "44px 'Limelight', Georgia, serif";
  ctx.fillText(P.posterTitle, ARENA_W / 2, ARENA_H / 2 - 10);
  ctx.font = '18px Georgia, serif';
  ctx.fillText(P.posterCaption, ARENA_W / 2, ARENA_H / 2 + 30);
  ctx.font = '12px monospace';
  ctx.fillText('poster-tirana-1924', ARENA_W / 2, ARENA_H - 50);
  ctx.textAlign = 'left';
}

export function drawMarch(ctx: CanvasRenderingContext2D, scene: MarchScene, t: number): void {
  ctx.save();
  switch (scene.view) {
    case 'intro': drawIntro(ctx, scene.state); break;
    case 'play': drawPlay(ctx, scene, t); break;
    case 'result': drawResult(ctx, scene.state); break;
    case 'poster': drawPoster(ctx); break;
  }
  ctx.restore();
}
```

- [ ] **Step 7: Create `minigames/march/game.ts`:**

```ts
// Pochod na Tiranu as a MiniGame (spec 2026-09-27-diktator-pochod-design §3): accumulates real time into fixed
// simulation steps, carries Action presses to the next step, collects the events for sounds and bubbles, and hands
// the drawing to render.ts. The page (main.ts) owns the cards around it; `view` tells the drawing which backdrop to use.

import type { Hero } from '../../logic/palace';
import type { ArenaInput, MiniGame } from '../arena';
import { createMarch, marchResult, stepMarch, type MarchOptions } from './logic';
import type { MarchMap } from './map';
import { drawMarch, type MarchView } from './render';
import { MARCH } from './rules';
import type { MarchEvent, MarchInput, MarchResult, MarchState } from './state';
import { marchToast } from './text';

export interface Toast {
  readonly text: string;
  /** Scene time (`state.now`) until which it shows. */
  readonly until: number;
}

const TOAST_SECONDS = 2.5;
/** The longest real time one update may simulate (a background tab must not run the march on its own). */
const MAX_FRAME = 0.25;

export class MarchGame implements MiniGame<MarchResult> {
  readonly state: MarchState;
  view: MarchView = 'intro';
  /** Solo play: the hero the device steers (Tab / Back switches). */
  active: Hero = 'zogu';
  /** The negotiation key's name for the bubble („Drž F — vyjednávat“). */
  actionKey = 'F';
  toasts: Toast[] = [];
  private acc = 0;
  private edges: Partial<Record<Hero, boolean>> = {};
  private events: MarchEvent[] = [];

  constructor(map: MarchMap, seed: number, solo: boolean, opts: MarchOptions = {}) {
    this.state = createMarch(map, seed, solo, opts);
  }

  update(dt: number, inputs: Readonly<Partial<Record<Hero, ArenaInput>>>): void {
    if (this.view !== 'play') return;
    for (const h of ['zogu', 'velitel'] as const) if (inputs[h]?.action) this.edges[h] = true;
    this.acc = Math.min(this.acc + dt, MAX_FRAME);
    while (this.acc >= MARCH.step) {
      this.acc -= MARCH.step;
      const step: Partial<Record<Hero, MarchInput>> = {};
      for (const h of ['zogu', 'velitel'] as const) {
        const i = inputs[h];
        if (!i) continue;
        step[h] = { moveX: i.moveX, moveY: i.moveY, action: this.edges[h] ?? false, held: i.held ?? false };
      }
      this.edges = {};
      const events = stepMarch(this.state, MARCH.step, step, this.active);
      for (const e of events) {
        const text = marchToast(e, this.state);
        if (text) this.toasts = [...this.toasts, { text, until: this.state.now + TOAST_SECONDS }].slice(-3);
      }
      this.events.push(...events);
    }
    this.toasts = this.toasts.filter((t) => t.until > this.state.now);
  }

  /** The events since the last call (sounds). */
  drainEvents(): MarchEvent[] {
    const out = this.events;
    this.events = [];
    return out;
  }

  render(ctx: CanvasRenderingContext2D, t: number): void {
    drawMarch(ctx, this, t);
  }

  result(): MarchResult | null {
    return marchResult(this.state);
  }
}
```

- [ ] **Step 8: Run and commit.** `npx vitest run tests/diktator` → PASS; `npm test`; `npx tsc --noEmit`; `npm run build`.

```bash
git add src/games/diktator/minigames/arena.ts src/games/diktator/render/puppet/looks.ts src/games/diktator/render/puppet/draw.ts src/games/diktator/render/puppet/poses.ts src/games/diktator/minigames/march/text.ts src/games/diktator/minigames/march/render.ts src/games/diktator/minigames/march/game.ts tests/diktator/march/render.test.ts
git commit -m "feat(diktator): Pochod — the atlas map, puppet standees and the game object" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: The page — title options, quick start, the march screen, cards, sounds, the DEV hook

**Files:**
- Modify: `src/games/diktator/ui/sounds.ts`, `ui/controls.ts`, `ui/dom.ts`, `palace.css`, `main.ts`, `src/shared/i18n/cs.ts`
- Test: `tests/diktator/sounds.test.ts`, `tests/diktator/controls.test.ts` (extend both)

The flow (spec §2, §3, §11):
- The title now offers "Nová hra" (→ the march), "Rychlý start" (→ `startNew()`, today's behaviour), "Pokračovat", "Textová verze" and the volume. "Nová hra" on the ending screen also starts the march.
- `startMarch()`:
  - takes the game seed (`?seed=<n>` replays, otherwise random);
  - creates `new MarchGame(ALBANIA_MARCH, seed ^ 0x1924, isSolo(seats), opts)`;
  - switches to the new screen `'march'`;
  - fades the arena in over the title (`showArena(true, 'fade')`), with the ambience at 0.25.
- The stages are `intro` → `playing` → `result` → `poster`. Action or the card's button advances; the arena card shows the start card, the result card and the poster card. On the poster the game calls `startNew(seed, regimeFromMarch(result))`, which calls `begin()`, so the palace starts at 1925-Q1. Sadije's tour is not implemented yet, so there is nothing to insert.
- Esc/Start pauses (the pause menu's "Uložit a do menu" returns to the title: the march is not saved). A lost pad pauses too. Solo: Tab/Back switches the steered hero (`MarchGame.active`).
- **DEV hook:** `?march=short` (only under `import.meta.env.DEV`) starts the pair on the Mat gorge road at (22, 26), a vertex a few tiles before Krujë, with the march clock at 22 December (`startT: 9 × 22`). The whole flow can then be checked in about a minute. Combine it with `?seed=7` for a repeatable run.
- **Sounds** (spec §9, existing sounds only):
  - `marchCues(event)` maps each event to a recorded hit, with the synth as fallback;
  - the footsteps play every 0.45 s per walking hero from his own samples, quieter on snow;
  - the Tirana bells are three `win` flourishes, scheduled in scene time like the Atentát shots.

- [ ] **Step 1: Write the tests.** Append to `tests/diktator/sounds.test.ts`, and add `bellTimes, MARCH_STEP_SECONDS, marchCues, marchStepHits` to its import from `ui/sounds`:

```ts
describe('march sounds (Pochod na Tiranu, spec §9)', () => {
  it('rings the purse, the blows, the catch and the gate', () => {
    expect(marchCues({ type: 'coins', amount: -40 })[0].hits?.[0].sample).toBe('coins');
    expect(marchCues({ type: 'hit', down: true }).map((c) => c.sfx)).toEqual(['hit', 'boing']);
    expect(marchCues({ type: 'hit', down: false }).map((c) => c.sfx)).toEqual(['hit']);
    expect(marchCues({ type: 'caught' }).map((c) => c.sfx)).toEqual(['fail']);
    expect(marchCues({ type: 'surrendered', kind: 'guard' }).map((c) => c.sfx)).toEqual(['join']);
    expect(marchCues({ type: 'day', date: 20 })).toEqual([]);
    expect(marchCues({ type: 'day', date: 24 }).map((c) => c.sfx)).toEqual(['lowtime']);
    expect(marchCues({ type: 'arrived', date: 23 }).map((c) => c.sfx)).toEqual(['door']);
    expect(marchCues({ type: 'spawned', squad: 1, size: 2 })).toEqual([]);
  });

  it('steps each hero with his own samples in turn, quieter on snow', () => {
    expect(marchStepHits('zogu', 0, false)[0].sample).toBe('zogu-step-1');
    expect(marchStepHits('velitel', 4, false)[0].sample).toBe('vlcek-step-2');
    expect(marchStepHits('zogu', 2, true)[0].gain).toBeLessThan(marchStepHits('zogu', 2, false)[0].gain);
    expect(MARCH_STEP_SECONDS).toBe(0.45);
    expect(bellTimes()).toHaveLength(3);
  });
});
```

  Append to `tests/diktator/controls.test.ts`, and add `actionKeyOf` to its import from `ui/controls`:

```ts
describe('actionKeyOf (the march bubble)', () => {
  it('names F, Enter or A', () => {
    expect([actionKeyOf('kb-left'), actionKeyOf('kb-right'), actionKeyOf('pad-0'), actionKeyOf(null)]).toEqual(['F', 'Enter', 'A', 'F']);
  });
});
```

- [ ] **Step 2: Run to see them fail.**

- [ ] **Step 3: `ui/sounds.ts`.**
  - Change the samples import to `import type { SampleHit, SampleName } from '../audio/samples';`.
  - Add `import type { MarchEvent } from '../minigames/march/state';` after the `GameState` import.
  - Append:

```ts
/** One sound of the march: recorded hits when they are decoded, else the synth `sfx`. */
export interface Cue {
  readonly sfx: SfxName;
  readonly hits?: readonly SampleHit[];
}

/** The sounds of a march event (spec 2026-09-27-diktator-pochod-design §9; only existing sounds). */
export function marchCues(e: MarchEvent): Cue[] {
  switch (e.type) {
    case 'tick': return [{ sfx: 'tick' }];
    case 'won': return [{ sfx: 'win' }];
    case 'refused': return [{ sfx: 'nothing' }];
    case 'coins': return [{ sfx: 'coins', hits: [{ sample: 'coins', delay: 0, rate: 1, gain: 0.8 }] }];
    case 'swing': return [{ sfx: 'swing' }];
    case 'hit': return e.down ? [{ sfx: 'hit' }, { sfx: 'boing' }] : [{ sfx: 'hit' }];
    case 'surrendered': return [{ sfx: 'join' }];
    case 'caught': return [{ sfx: 'fail' }];
    case 'day': return e.date === 24 ? [{ sfx: 'lowtime' }] : [];
    case 'arrived': return [{ sfx: 'door', hits: [{ sample: 'zogu-door', delay: 0, rate: 0.8, gain: 0.6 }] }];
    case 'timeout': return [{ sfx: 'fail' }];
    case 'spawned': case 'cache': return [];
  }
}

/** Seconds between a walking hero's footsteps on the march. */
export const MARCH_STEP_SECONDS = 0.45;

/** One footstep of a hero on the march: his own samples in turn, quieter on snow. */
export function marchStepHits(h: Hero, n: number, snow: boolean): SampleHit[] {
  const sample = `${h === 'zogu' ? 'zogu' : 'vlcek'}-step-${(n % 3) + 1}` as SampleName;
  return [{ sample, delay: 0, rate: h === 'zogu' ? 0.85 : 1.12, gain: snow ? 0.15 : 0.3 }];
}

/** Scene-time delays of the Tirana bells (a `win` flourish) after the arrival. */
export function bellTimes(): readonly number[] {
  return [0.3, 0.8, 1.3];
}
```

- [ ] **Step 4: `ui/controls.ts`.** Before `export function keysFor`, add:

```ts
/** The Action key's short name on a device, for the march's „Drž F — vyjednávat“ bubble. */
export function actionKeyOf(d: DeviceId | null): string {
  if (d === 'kb-right') return 'Enter';
  if (d?.startsWith('pad-')) return 'A';
  return 'F';
}
```

- [ ] **Step 5: `ui/dom.ts`: the fade and the card note.**
  - `showArena` gains a mode. Replace its signature and first lines:

```ts
export function showArena(on: boolean, mode: 'merge' | 'fade' = 'merge'): void {
  const app = $('#app');
  const arena = $('#arena');
  if (mode === 'fade') {
    // Pochod na Tiranu (spec 2026-09-27-diktator-pochod-design §3): no halves to merge — the arena fades in over the
    // title and fades out into the palace. `#app` (still empty) is hidden underneath so nothing shows through.
    if (on) {
      app.hidden = true;
      arena.hidden = false;
      arena.classList.remove('shown');
      requestAnimationFrame(() => requestAnimationFrame(() => arena.classList.add('shown')));
    } else {
      app.hidden = false;
      arena.classList.remove('shown');
      window.setTimeout(() => { arena.hidden = true; }, ARENA_MERGE_MS);
    }
    return;
  }
  // … the existing merge code stays unchanged from here (`if (on) { app.classList.add('merging'); …`)
```

  Also add `mode` to the doc comment above it.
  - `ArenaCardModel` gains `readonly note?: { readonly title: string; readonly text: string };` (doc: "A small boxed note under the lines (the march's „Jak to bylo doopravdy“)").
  - In `renderArenaCard`, replace `el.replaceChildren(h, ...model.lines.map(para), btn);` with:

```ts
  const note: HTMLElement[] = [];
  if (model.note) {
    const aside = document.createElement('aside');
    aside.className = 'arena-note';
    const b = document.createElement('strong');
    b.textContent = model.note.title;
    aside.append(b, para(model.note.text));
    note.push(aside);
  }
  el.replaceChildren(h, ...model.lines.map(para), ...note, btn);
```

- [ ] **Step 6: `palace.css`.** After `#arena-card p { margin: 4px 0; }`:

```css
/* Pochod na Tiranu: the „Jak to bylo doopravdy“ box on the start and result cards. */
#arena-card .arena-note { margin-top: 8px; padding: 6px 10px; border-left: 3px solid var(--gold-dark); background: rgba(201, 164, 74, 0.08); font-size: 0.92em; }
#arena-card .arena-note p { margin: 2px 0 0; }
```

- [ ] **Step 7: The title label.** In `cs.ts`, in `diktator.palace.join`, after `newGame: 'Nová hra',`:

```ts
        /** Skip Pochod na Tiranu: the original start values (spec 2026-09-27-diktator-pochod-design §11). */
        quickStart: 'Rychlý start',
```

- [ ] **Step 8: `main.ts`.** Apply these edits in order. Each "find" text occurs exactly once; if one does not, stop and report.

  1. Find:

```ts
import { FACTIONS } from './logic/groups';
```

     Replace with:

```ts
import { FACTIONS } from './logic/groups';
import { regimeFromMarch } from './logic/march-regime';
```

  2. Find:

```ts
import type { Command, GameEvent, GameState, Phase } from './logic/state';
```

     Replace with:

```ts
import type { Command, GameEvent, GameState, Phase, StartingRegime } from './logic/state';
```

  3. Find:

```ts
import { SpotGame, tipText } from './minigames/spot/game';
```

     Replace with:

```ts
import { SpotGame, tipText } from './minigames/spot/game';
import { MarchGame } from './minigames/march/game';
import type { MarchOptions } from './minigames/march/logic';
import { terrainAt } from './minigames/march/map';
import type { MarchResult } from './minigames/march/state';
import { marchCardLines } from './minigames/march/text';
import { ALBANIA_MARCH } from './scenario/albania/march-map';
```

  4. Find:

```ts
import { CLOSED, clampFocus, heroOf, isSolo, join, keysFor, navigate, NO_SEATS, palaceAct, seatedDevices, type Intent, type MenuUi, type Seats } from './ui/controls';
```

     Replace with:

```ts
import { actionKeyOf, CLOSED, clampFocus, heroOf, isSolo, join, keysFor, navigate, NO_SEATS, palaceAct, seatedDevices, type Intent, type MenuUi, type Seats } from './ui/controls';
```

  5. Find:

```ts
import { bumpHits, bumpSound, moveHits, moveSounds, shotsHits, unrestLevel, voiceOf } from './ui/sounds';
```

     Replace with:

```ts
import { bellTimes, bumpHits, bumpSound, MARCH_STEP_SECONDS, marchCues, marchStepHits, moveHits, moveSounds, shotsHits, unrestLevel, voiceOf } from './ui/sounds';
```

  6. Find:

```ts
const A = T.atentat;
```

     Replace with:

```ts
const A = T.atentat;
const M = T.pochod;
```

  7. Find:

```ts
const ARENA_AMBIENT = 0.6;

type Screen = 'title' | 'palace' | 'pause' | 'arena';
```

     Replace with:

```ts
const ARENA_AMBIENT = 0.6;
/** The palace ambience as a low wind bed under the march (spec 2026-09-27-diktator-pochod-design §9). */
const MARCH_AMBIENT = 0.25;

type Screen = 'title' | 'palace' | 'pause' | 'arena' | 'march';
```

  8. Find:

```ts
interface Half {
```

     Replace with:

```ts
/** Pochod na Tiranu on the arena screen (spec 2026-09-27-diktator-pochod-design §3, §11). */
interface MarchSession {
  readonly game: MarchGame;
  /** The game seed: the palace game starts from it; the march runs on `seed ^ 0x1924`. */
  readonly seed: number;
  stage: 'intro' | 'playing' | 'result' | 'poster';
  result: MarchResult | null;
  /** Scene times (`state.now`) still due to ring the Tirana bells, oldest first. */
  bellsDue: number[];
  /** Per hero: the scene time of his next footstep. */
  stepAt: Record<Hero, number>;
  steps: number;
}

interface Half {
```

  9. Find:

```ts
let arena: ArenaSession | null = null;
```

     Replace with:

```ts
let arena: ArenaSession | null = null;
let march: MarchSession | null = null;
```

  10. Find:

```ts
function startNew(): void {
  const { state: s, events } = newGame(sc, randomSeed(), undefined, { palace: true });
```

     Replace with:

```ts
/** A fresh game seed; `?seed=<n>` replays the same game and march (spec 2026-09-27-diktator-pochod-design §3). */
function gameSeed(): number {
  const q = new URLSearchParams(window.location.search).get('seed');
  return q !== null && /^\d+$/.test(q) ? Number(q) >>> 0 : randomSeed();
}

/** Starts the palace game: "Rychlý start" (the original start, no regime), or after the march with its regime. */
function startNew(seed = gameSeed(), regime?: StartingRegime): void {
  const { state: s, events } = newGame(sc, seed, regime, { palace: true });
```

  11. Find:

```ts
function continueSaved(): void {
```

     Replace with:

```ts
// ---------- Pochod na Tiranu ----------

/** "Nová hra": the march in the arena, faded in over the title. DEV `?march=short` starts near Krujë on 22 December. */
function startMarch(): void {
  const seed = gameSeed();
  const dev = import.meta.env.DEV ? new URLSearchParams(window.location.search).get('march') : null;
  const opts: MarchOptions = dev === 'short' ? { startAt: [22, 26], startT: 9 * 22 } : {};
  const game = new MarchGame(ALBANIA_MARCH, (seed ^ 0x1924) >>> 0, isSolo(seats), opts);
  game.actionKey = actionKeyOf(seats.zogu ?? seats.velitel);
  march = { game, seed, stage: 'intro', result: null, bellsDue: [], stepAt: { zogu: 0, velitel: 0 }, steps: 0 };
  active = 'zogu';
  screen = 'march';
  overlayUi = CLOSED;
  showArena(true, 'fade');
  ambient.setLevel(MARCH_AMBIENT);
  holdAll();
  dirty = true;
}

/** The march session's Action (or card click): intro → march, result → poster, poster → the palace. */
function advanceMarch(): void {
  if (!march) return;
  if (march.stage === 'intro') {
    march.stage = 'playing';
    march.game.view = 'play';
  } else if (march.stage === 'result') {
    march.stage = 'poster';
    march.game.view = 'poster';
  } else if (march.stage === 'poster' && march.result) {
    const { seed, result } = march;
    march = null;
    showArena(false, 'fade');
    startNew(seed, regimeFromMarch(result));
    return;
  }
  holdAll();
  dirty = true;
}

function updateMarch(dt: number): void {
  if (!march) return;
  if (seatedDevices(seats).some((d) => !input.isConnected(d))) return pause(P.pause.padLost);
  if (seatedDevices(seats).some((d) => input.pressed(d, 'pause'))) return pause(P.pause.title);
  if (march.stage !== 'playing') {
    if (seatedDevices(seats).some((d) => input.pressed(d, 'action'))) advanceMarch();
    return;
  }
  const switchPressed = input.keyPressed('Tab') || seatedDevices(seats).some((d) => input.pressed(d, 'back'));
  if (switchPressed && isSolo(seats)) {
    active = other(active);
    march.game.active = active;
  }
  march.game.update(dt, arenaInputs(null));
  playMarchSounds(march);
  const result = march.game.result();
  if (result) {
    march.result = result;
    march.stage = 'result';
    march.game.view = 'result';
    holdAll();
  }
  dirty = true;
}

function playMarchSounds(m: MarchSession): void {
  const s = m.game.state;
  for (const e of m.game.drainEvents()) {
    for (const cue of marchCues(e)) if (!(cue.hits && samples.play(cue.hits))) sfx.play(cue.sfx);
    if (e.type === 'arrived') m.bellsDue = bellTimes().map((d) => s.now + d);
  }
  while (m.bellsDue.length > 0 && s.now >= m.bellsDue[0]) {
    m.bellsDue.shift();
    sfx.play('win');
  }
  for (const h of HEROES) {
    const f = s.heroes[h];
    if (!f.moving || s.ending) m.stepAt[h] = s.now;
    else if (s.now >= m.stepAt[h]) {
      m.stepAt[h] = s.now + MARCH_STEP_SECONDS;
      samples.play(marchStepHits(h, m.steps++, terrainAt(s.map, f.x, f.y) === 's'));
    }
  }
}

function marchCardModel(m: MarchSession): ArenaCardModel | null {
  switch (m.stage) {
    case 'intro':
      return {
        title: M.title,
        lines: [
          M.intro,
          M.howTo,
          ...(isSolo(seats)
            ? [keysFor(seats.zogu ?? seats.velitel)]
            : HEROES.map((h) => `${T.heroes[h]}: ${keysFor(seats[h])}`)),
        ],
        note: { title: M.historyTitle, text: M.historyStart },
        button: M.start,
      };
    case 'result':
      return {
        title: M.resultTitle,
        lines: marchCardLines(m.result!, sc.groupNames, ALBANIA_MARCH.caches.length),
        note: { title: M.historyTitle, text: M.historyEnd },
        button: M.next,
      };
    case 'poster':
      return { title: M.posterTitle, lines: [M.posterCaption], button: M.toPalace };
    case 'playing':
      return null;
  }
}

function continueSaved(): void {
```

  12. Find:

```ts
  if (arena) {
    arena = null;
    showArena(false);
  }
  dirty = true;
}
```

     Replace with:

```ts
  if (arena) {
    arena = null;
    showArena(false);
  }
  if (march) {
    // The march is not saved mid-way (spec §3): back to the title; no GameState exists yet.
    march = null;
    showArena(false, 'fade');
  }
  dirty = true;
}
```

  13. Find:

```ts
/** The seated heroes' inputs for this tick (task 5): held movement plus an Action edge. Solo play always steers
 * Vlček's glass, whichever hero is currently active — the scene itself is his alone. */
function arenaInputs(): Partial<Record<Hero, ArenaInput>> {
  const out: Partial<Record<Hero, ArenaInput>> = {};
  for (const d of seatedDevices(seats)) {
    const hero = isSolo(seats) ? 'velitel' : heroOf(seats, d, active);
    if (!hero) continue;
    const axes = input.get(d);
    out[hero] = { moveX: axes.moveX, moveY: axes.moveY, action: input.pressed(d, 'action') };
  }
  return out;
}
```

     Replace with:

```ts
/** The seated heroes' inputs for this tick (task 5): held movement, an Action edge and Action held. `soloHero`: in
 * solo play the device always steers that hero ("Najdi střelce" is Vlček's alone); null = the active hero (the march). */
function arenaInputs(soloHero: Hero | null): Partial<Record<Hero, ArenaInput>> {
  const out: Partial<Record<Hero, ArenaInput>> = {};
  for (const d of seatedDevices(seats)) {
    const hero = isSolo(seats) ? (soloHero ?? active) : heroOf(seats, d, active);
    if (!hero) continue;
    const axes = input.get(d);
    out[hero] = { moveX: axes.moveX, moveY: axes.moveY, action: input.pressed(d, 'action'), held: axes.action };
  }
  return out;
}
```

  14. Find:

```ts
  arena.game.update(dt, arenaInputs());
```

     Replace with:

```ts
  arena.game.update(dt, arenaInputs('velitel'));
```

  15. Find:

```ts
function arenaCardModel(): ArenaCardModel | null {
  if (!arena) return null;
```

     Replace with:

```ts
function arenaCardModel(): ArenaCardModel | null {
  if (march) return marchCardModel(march);
  if (!arena) return null;
```

  16. Find:

```ts
function onArenaCardChoose(): void {
  if (!arena) return;
```

     Replace with:

```ts
function onArenaCardChoose(): void {
  if (march) return advanceMarch();
  if (!arena) return;
```

  17. Find:

```ts
  const opts = [{ label: P.join.newGame, run: startNew }];
```

     Replace with:

```ts
  const opts = [
    { label: P.join.newGame, run: startMarch },
    { label: P.join.quickStart, run: () => startNew() },
  ];
```

  18. Find:

```ts
          if (pausedFrom === 'arena') ambient.setLevel(ARENA_AMBIENT);
```

     Replace with:

```ts
          if (pausedFrom === 'arena') ambient.setLevel(ARENA_AMBIENT);
          else if (pausedFrom === 'march') ambient.setLevel(MARCH_AMBIENT);
```

  19. Find:

```ts
  else if (screen === 'arena') updateArena(dt);
```

     Replace with:

```ts
  else if (screen === 'arena') updateArena(dt);
  else if (screen === 'march') updateMarch(dt);
```

  20. Find:

```ts
  if (screen === 'arena') return null;
  if (someoneTalking()) return null;
```

     Replace with:

```ts
  if (screen === 'arena' || screen === 'march') return null;
  if (someoneTalking()) return null;
```

  21. Find:

```ts
  if (screen === 'arena' && arena) {
    const canvas = arenaCanvas();
```

     Replace with:

```ts
  const mini = screen === 'march' && march ? march.game : screen === 'arena' && arena ? arena.game : null;
  if (mini) {
    const canvas = arenaCanvas();
```

  22. Find:

```ts
      arena.game.render(ctx, t);
```

     Replace with:

```ts
      mini.render(ctx, t);
```

  23. Find:

```ts
    case 'newGame': startNew(); break;
```

     Replace with:

```ts
    case 'newGame': startMarch(); break;
```


- [ ] **Step 9: Check and commit.** `npx tsc --noEmit`, `npm test` and `npm run build`.

```bash
git add src/games/diktator/ui/sounds.ts src/games/diktator/ui/controls.ts src/games/diktator/ui/dom.ts src/games/diktator/palace.css src/games/diktator/main.ts src/shared/i18n/cs.ts tests/diktator/sounds.test.ts tests/diktator/controls.test.ts
git commit -m "feat(diktator): Pochod na Tiranu opens a new game; Rychlý start keeps the original start" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 10: Manual check (controller).** Run the dev server (`npm run dev`) and open `/src/games/diktator/index.html?seed=7&march=short`. Click into the page first; keyboard input needs focus, and a hidden browser pane pauses `requestAnimationFrame`. Check each of these:
  1. The title shows "Nová hra" and "Rychlý start".
  2. "Nová hra" fades the arena in, showing the atlas with the red arrow and the start card with the „Jak to bylo doopravdy" box.
  3. Action starts the march: the pair stands on the gorge road, the date reads 22. prosince, and the HUD and mini-map are drawn.
  4. Walking moves the map; the rope's cord appears and stops the pair.
  5. Holding F at Krujë shows the padlock until Vlček (Enter) has knocked out the gate guards; then the ring fills.
  6. A gendarme's catch shows the caption and the date jumps a day.
  7. Tirana ends the march; the result card lists the tallies, then comes the poster, then the palace at 1925-Q1.
  8. Without `?march=short`, "Rychlý start" goes straight to the palace with today's start.
  9. Solo (only F seated): Tab switches the hero, and the other hero follows.
  10. Esc pauses; "Uložit a do menu" returns to the title.

---

## Self-review

**Spec coverage** (spec section → task):
- §2 the experience, §3 the arena (fade, both heroes, solo switch, no mid-march save, `seed ^ 0x1924`) → Tasks 8, 9.
- §4.1 history lines → Task 7 (`historyStart`, `historyEnd`, shown in the card note in Task 9).
- §4.2 the world, §4.3 places and variants, §4.4 atlas → Task 1 (grid, places, patrols, `ATLAS_*`), Task 3 (variants), Task 8 (atlas cards).
- §4.5 optional benefits → Task 1 (data), Task 3 (booking), Task 5 (caches, messenger, tests), Task 7 (regime, caps, card lines), Task 8 (drawing, column).
- §5 view and controls → Task 8 (standees 0.34), Task 9 (inputs: `action` edge, `held`).
- §6.1 clock, §6.2 movement, §6.3 rope and camera → Task 2. §6.4 → Task 3. §6.5, §6.6 → Task 4. §6.7 → Task 6. §6.8 end and result → Task 2 (result fields incl. benefits).
- §7 drawing → Task 8. §8 mapping, §8.2 reconciliation (historical = `RULES.start`, tested with `initialState` equality) → Task 7.
- §9 sound → Task 9. §10 testing (map, clock, movement, rope property, negotiation, gendarmes, blows, helper, determinism, mapping exhaustive, bots) → Tasks 1–8.
- §11 flow (Nová hra, Rychlý start, text mode untouched) → Task 9.

**Type consistency across tasks:**
- `MarchState`, `MarchResult`, `MarchEvent` and `MarchInput` are defined once in Task 2 and never change shape.
- `PlaceState.wp`/`dir` (messenger) and `Foe` (all modes) exist from Task 2.
- `ArenaInput.held` is optional (Task 8), so `SpotGame` is unaffected. `MarchGame` converts it to `MarchInput.held`.
- `StartingRegime.guard` is optional (Task 7), and `initialState` reads it.
- `MarchView` and `MarchScene` are exported from `render.ts`; `game.ts` imports them, so there is no cycle.
- `text.ts` (Task 7) imports `regimeFromMarch`. `marchToast` (Task 8) only reads `state.places`.

**Placeholders:** none. The poster is a deliberate placeholder frame (parent spec §11: the art comes later).

**Decisions this plan makes on top of the spec (recorded in the spec where they change it):**
1. `MarchInput` has both `action` (the press edge: blow, wave, refusal bubble) and `held` (negotiation). The spec's "= ArenaInput" could not express holding, so `ArenaInput` gains an optional `held`.
2. Place tiles are fixed by the drawn grid: Kukës (64, 6), Burgajet (47, 19), Burrel (44, 23), Selitë (43, 14). The spec's §4.3 table is updated.
3. Spawns use either end of a route, and a patrol is trimmed so no more than 6 gendarmes are ever alive. A gendarme who gives up a chase is blind for 3 s, and one wedged on his way back is removed uncounted.
4. A surrendering gendarme counts in `captured` when he raises his hands, not when he leaves.
5. Gate guards stand 50 units south of their barracks (inside the spec's 40–60). A barracks unlocks when all its guards are down, not only when they have surrendered.
6. The benefits (spec §4.5): 3 caches of +15 gold; Martanesh volunteers (+1 bodyguard, via the new `StartingRegime.guard`); the Homesh horses (×1.25 speed for 44 s of the march clock); the Italian messenger (+1 Itálie popularity).
7. Pacing: on the drawn map the plain road walk takes about 41 s (the spec estimated 65–75 s). A road-only solo bot arrives on 14–18 December. The spec leaves pacing to play-testing (§6.9); the knobs are `MARCH.speed` and `MARCH.day`.
8. Sadije's tour does not exist yet, so after the poster the game goes straight to 1925-Q1.
