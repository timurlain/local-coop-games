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
