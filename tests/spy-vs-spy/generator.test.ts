import { describe, expect, it } from 'vitest';
import { createGame, outwardDirs } from '../../src/games/spy-vs-spy/logic/generator';
import { RULES } from '../../src/games/spy-vs-spy/logic/rules';
import {
  DIRS, FIXTURE_KINDS, FIXTURE_REMEDY, OPPOSITE, neighbor, type EmbassySize, type GameState,
} from '../../src/games/spy-vs-spy/logic/state';

const SIZES: EmbassySize[] = ['mala', 'stredni', 'velka'];
const SEEDS = Array.from({ length: 40 }, (_, i) => i * 7919 + 1);

function forAll(check: (s: GameState, size: EmbassySize) => void) {
  for (const size of SIZES) for (const seed of SEEDS) check(createGame(seed, size), size);
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
    forAll((s, size) => {
      const { cols, rows } = RULES.sizes[size];
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

  it('puts 2-4 furniture pieces per room on distinct slots', () => {
    forAll((s) => {
      for (const r of s.rooms) {
        expect(r.furniture.length).toBeGreaterThanOrEqual(2);
        expect(r.furniture.length).toBeLessThanOrEqual(4);
        const xs = r.furniture.map((id) => s.furniture[id].x);
        expect(new Set(xs).size).toBe(xs.length);
        for (const x of xs) expect(RULES.slotX).toContain(x);
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

  it('starts both spies together in the same room, facing each other, with full stock', () => {
    forAll((s) => {
      const [white, black] = s.spies;
      expect(white.room).toBe(black.room);
      expect(white.x).toBe(40);
      expect(black.x).toBe(160);
      expect(white.z).toBe(RULES.roomD / 2);
      expect(black.z).toBe(RULES.roomD / 2);
      expect(white.facing).toBe(1);
      expect(black.facing).toBe(-1);
      expect(white.visited[white.room]).toBe(true);
      expect(black.visited[black.room]).toBe(true);
      expect(white.visited.filter(Boolean)).toHaveLength(1);
      expect(black.visited.filter(Boolean)).toHaveLength(1);
      expect(s.spies[0].stock).toEqual(RULES.trapStock);
      expect(s.spies[0].clock).toBe(RULES.defaultClock);
    });
  });

  it('picks the shared start room with the gameplay RNG, deterministically per seed', () => {
    expect(createGame(123, 'stredni').spies[0].room).toBe(createGame(123, 'stredni').spies[0].room);
    const rooms = SEEDS.map((seed) => createGame(seed, 'velka').spies[0].room);
    expect(new Set(rooms).size).toBeGreaterThan(1);
  });

  it('is deterministic per seed', () => {
    expect(JSON.stringify(createGame(123, 'stredni'))).toBe(JSON.stringify(createGame(123, 'stredni')));
    expect(JSON.stringify(createGame(123, 'stredni'))).not.toBe(JSON.stringify(createGame(124, 'stredni')));
  });

  it('uses the given clock', () => {
    expect(createGame(1, 'mala', 300).spies[1].clock).toBe(300);
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

  it('keeps 2-4 furniture pieces per room including fixtures', () => {
    forAll((s) => {
      for (const r of s.rooms) {
        expect(r.furniture.length).toBeGreaterThanOrEqual(2);
        expect(r.furniture.length).toBeLessThanOrEqual(4);
      }
    });
  });

  it('is deterministic per seed', () => {
    const a = createGame(55, 'stredni');
    const b = createGame(55, 'stredni');
    expect(a.furniture.map((f) => [f.kind, f.source])).toEqual(b.furniture.map((f) => [f.kind, f.source]));
  });
});
