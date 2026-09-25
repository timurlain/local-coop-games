import { describe, expect, it } from 'vitest';
import { createGame, minFurniturePerRoom, outwardDirs } from '../../src/games/spy-vs-spy/logic/generator';
import { LEVELS, RULES, levelRules } from '../../src/games/spy-vs-spy/logic/rules';
import {
  DIRS, FIXTURE_KINDS, FIXTURE_REMEDY, OPPOSITE, neighbor, type GameState,
} from '../../src/games/spy-vs-spy/logic/state';

const SEEDS = Array.from({ length: 40 }, (_, i) => i * 7919 + 1);

function forAll(check: (s: GameState, level: number) => void) {
  for (const level of LEVELS) for (const seed of SEEDS) check(createGame(seed, level), level);
}

function reachableCount(s: GameState): number {
  const seen = new Set([0]);
  const queue = [0];
  while (queue.length) {
    const id = queue.shift()!;
    for (const d of DIRS) {
      if (!s.rooms[id].doors[d]) continue;
      const n = neighbor(s, id, d)!;
      if (!seen.has(n)) { seen.add(n); queue.push(n); }
    }
  }
  return seen.size;
}

describe('createGame', () => {
  it('builds the configured grid', () => {
    forAll((s, level) => {
      const { cols, rows } = levelRules(level);
      expect(s.cols).toBe(cols);
      expect(s.rows).toBe(rows);
      expect(s.rooms).toHaveLength(cols * rows);
    });
  });

  it('makes every room reachable', () => {
    forAll((s) => expect(reachableCount(s)).toBe(s.rooms.length));
  });

  it('keeps doors symmetric and never leads off the grid', () => {
    forAll((s) => {
      for (const r of s.rooms) for (const d of DIRS) {
        if (!r.doors[d]) continue;
        const n = neighbor(s, r.id, d);
        expect(n).not.toBeNull();
        expect(s.rooms[n!].doors[OPPOSITE[d]]).toBe(true);
      }
    });
  });

  it('puts 2-3 furniture pieces per room on distinct positions (round 5 §5)', () => {
    forAll((s) => {
      for (const r of s.rooms) {
        expect(r.furniture.length).toBeGreaterThanOrEqual(2);
        expect(r.furniture.length).toBeLessThanOrEqual(3);
        const xs = r.furniture.map((id) => `${s.furniture[id].x},${s.furniture[id].z}`);
        expect(new Set(xs).size).toBe(xs.length);
        for (const id of r.furniture) expect(s.furniture[id].room).toBe(r.id);
      }
    });
  });

  it('has exactly one exit, on an outward wall, not in the shared start room', () => {
    forAll((s) => {
      const exits = s.rooms.filter((r) => r.exit !== null);
      expect(exits).toHaveLength(1);
      const room = exits[0];
      expect(outwardDirs(s, room.id)).toContain(room.exit);
      expect(room.id).not.toBe(s.spies[0].room);
    });
  });

  it('places 4 secrets and the kufrik in distinct furniture, none of them fixtures', () => {
    forAll((s) => {
      const hidden = s.furniture.filter((f) => f.hidden !== null);
      expect(hidden).toHaveLength(5);
      const secrets = hidden.flatMap((f) => (f.hidden!.kind === 'secret' ? [f.hidden!.secret] : []));
      expect(secrets.sort()).toEqual(['klic', 'pas', 'penize', 'plany']);
      expect(hidden.filter((f) => f.hidden!.kind === 'kufrik')).toHaveLength(1);
      for (const f of hidden) expect(f.source).toBeNull();
      expect(s.furniture.every((f) => f.trap === null)).toBe(true);
    });
  });

  it('never puts more than one secret item in the same room (round 5)', () => {
    forAll((s) => {
      const hidden = s.furniture.filter((f) => f.hidden !== null);
      expect(hidden).toHaveLength(5);
      const rooms = hidden.map((f) => f.room);
      expect(new Set(rooms).size).toBe(5);
    });
  });

  it('starts both spies together in the same room, facing each other, with full stock', () => {
    forAll((s, level) => {
      const [white, black] = s.spies;
      expect(white.room).toBe(black.room);
      expect(white.x).toBe(40);
      expect(black.x).toBe(160);
      expect(white.z).toBe(RULES.spawnZ);
      expect(black.z).toBe(RULES.spawnZ);
      expect(white.facing).toBe(1);
      expect(black.facing).toBe(-1);
      expect(white.visited[white.room]).toBe(true);
      expect(black.visited[black.room]).toBe(true);
      expect(white.visited.filter(Boolean)).toHaveLength(1);
      expect(black.visited.filter(Boolean)).toHaveLength(1);
      for (const spy of s.spies) {
        expect(spy.stock).toEqual(levelRules(level).trapStockPerSpy);
        expect(spy.clock).toBe(levelRules(level).clockSeconds);
      }
    });
  });

  it('picks the shared start room with the gameplay RNG, deterministically per seed', () => {
    expect(createGame(123, 3).spies[0].room).toBe(createGame(123, 3).spies[0].room);
    const rooms = SEEDS.map((seed) => createGame(seed, 5).spies[0].room);
    expect(new Set(rooms).size).toBeGreaterThan(1);
  });

  it('is deterministic per seed', () => {
    expect(JSON.stringify(createGame(123, 3))).toBe(JSON.stringify(createGame(123, 3)));
    expect(JSON.stringify(createGame(123, 3))).not.toBe(JSON.stringify(createGame(124, 3)));
  });

  it('gives each spy its own copy of the stock', () => {
    const s = createGame(1, 8);
    s.spies[0].stock.bomba--;
    expect(s.spies[1].stock.bomba).toBe(levelRules(8).trapStockPerSpy.bomba);
    expect(levelRules(8).trapStockPerSpy.bomba).toBe(8);
  });

  it('rejects a level outside 1-8', () => {
    expect(() => createGame(1, 0)).toThrow();
    expect(() => createGame(1, 9)).toThrow();
    expect(() => createGame(1, 2.5)).toThrow();
  });
});

describe('remedy fixtures', () => {
  it('places max(2, ceil(rooms/5)) fixtures per kind', () => {
    forAll((s) => {
      const wanted = Math.max(2, Math.ceil(s.rooms.length / 5));
      for (const kind of FIXTURE_KINDS) {
        const count = s.furniture.filter((f) => f.kind === kind).length;
        expect(count, `kind ${kind} seed ${s.seed} size`).toBe(wanted);
      }
    });
  });

  it('puts fixtures of one kind in distinct rooms when rooms >= count', () => {
    forAll((s) => {
      const wanted = Math.max(2, Math.ceil(s.rooms.length / 5));
      if (s.rooms.length < wanted) return;
      for (const kind of FIXTURE_KINDS) {
        const rooms = s.furniture.filter((f) => f.kind === kind).map((f) => f.room);
        expect(new Set(rooms).size).toBe(rooms.length);
      }
    });
  });

  it('gives every fixture its kind-defined remedy as source, and only fixtures a source', () => {
    forAll((s) => {
      for (const f of s.furniture) {
        if ((FIXTURE_KINDS as readonly string[]).includes(f.kind)) {
          expect(f.source).toBe(FIXTURE_REMEDY[f.kind as keyof typeof FIXTURE_REMEDY]);
        } else {
          expect(f.source).toBeNull();
        }
      }
    });
  });

  it('never places a secret or the kufrik in a fixture', () => {
    forAll((s) => {
      for (const f of s.furniture) {
        if (f.source !== null) expect(f.hidden).toBeNull();
      }
    });
  });

  it('keeps 2-3 furniture pieces per room including fixtures', () => {
    forAll((s) => {
      for (const r of s.rooms) {
        expect(r.furniture.length).toBeGreaterThanOrEqual(2);
        expect(r.furniture.length).toBeLessThanOrEqual(3);
      }
    });
  });

  it('is deterministic per seed', () => {
    const a = createGame(55, 3);
    const b = createGame(55, 3);
    expect(a.furniture.map((f) => [f.kind, f.source])).toEqual(b.furniture.map((f) => [f.kind, f.source]));
  });
});

describe('level table (spec §4)', () => {
  it('has levels 1-8 with the spec grid, clock and stock', () => {
    const rows = LEVELS.map((l) => {
      const r = levelRules(l);
      const st = r.trapStockPerSpy;
      return `${l} ${r.cols}x${r.rows} ${r.clockSeconds / 60}min ${st.bomba}/${st.pruzina}/${st.elektrina}/${st.pistole}/${st.casovana}`;
    });
    expect(rows).toEqual([
      '1 3x3 5min 1/1/1/1/1',
      '2 3x3 6min 2/2/1/1/1',
      '3 4x3 8min 2/2/2/2/1',
      '4 4x4 10min 3/3/2/2/2',
      '5 5x4 12min 3/3/3/3/2',
      '6 6x4 15min 4/4/3/3/2',
      '7 6x5 18min 5/5/4/4/2',
      '8 6x6 24min 8/8/8/8/3',
    ]);
    expect(RULES.levels).toHaveLength(8);
  });

  it('totals the traps of both spies as in the spec', () => {
    const totals = LEVELS.map((l) => 2 * Object.values(levelRules(l).trapStockPerSpy).reduce((a, b) => a + b, 0));
    expect(totals).toEqual([10, 14, 18, 24, 28, 32, 40, 70]);
  });

  it('gives tiny embassies enough furniture for every fixture, secret and the kufrik', () => {
    // round 5 §4: level 1 is 3×3 now, so every level keeps the minimum of 2
    for (const l of LEVELS) {
      const { cols, rows } = levelRules(l);
      expect(minFurniturePerRoom(cols * rows), `level ${l}`).toBe(RULES.furniturePerRoom.min);
    }
    expect(() => minFurniturePerRoom(2)).toThrow();
  });

  it('fails loudly when too few rooms could ever keep a non-fixture piece (round 5: one secret per room)', () => {
    // a 3×2 embassy (level 1 before round 5): fit within furniturePerRoom.max, but worst-case fixture placement
    // (2 fixtures paired up per room) could empty 4 of its 6 rooms, leaving only 2 — short of the 5 needed.
    expect(() => minFurniturePerRoom(6)).toThrow();
    // level 1's actual size (9 rooms, 3×3) sits exactly on the boundary: 8 fixtures could empty at most 4 rooms,
    // leaving exactly 5 — still enough for the 4 secrets and the kufřík.
    expect(minFurniturePerRoom(9)).toBe(RULES.furniturePerRoom.min);
  });

  it('defaults to a valid level', () => {
    expect(LEVELS).toContain(RULES.defaultLevel);
  });
});
