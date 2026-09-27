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
