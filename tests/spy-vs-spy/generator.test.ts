import { describe, expect, it } from 'vitest';
import { createGame, outwardDirs } from '../../src/games/spy-vs-spy/logic/generator';
import { RULES } from '../../src/games/spy-vs-spy/logic/rules';
import { DIRS, OPPOSITE, neighbor, type EmbassySize, type GameState } from '../../src/games/spy-vs-spy/logic/state';

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

  it('has exactly one exit, on an outward wall, not in a start room', () => {
    forAll((s) => {
      const exits = s.rooms.filter((r) => r.exit !== null);
      expect(exits).toHaveLength(1);
      const room = exits[0];
      expect(outwardDirs(s, room.id)).toContain(room.exit);
      expect(room.id).not.toBe(0);
      expect(room.id).not.toBe(s.rooms.length - 1);
    });
  });

  it('places 4 remedy sources, 4 secrets and the kufrik in distinct furniture', () => {
    forAll((s) => {
      const sources = s.furniture.filter((f) => f.source !== null);
      expect(sources.map((f) => f.source).sort()).toEqual(['destnik', 'kleste', 'nuzky', 'voda']);
      const hidden = s.furniture.filter((f) => f.hidden !== null);
      expect(hidden).toHaveLength(5);
      const secrets = hidden.flatMap((f) => (f.hidden!.kind === 'secret' ? [f.hidden!.secret] : []));
      expect(secrets.sort()).toEqual(['klic', 'pas', 'penize', 'plany']);
      expect(hidden.filter((f) => f.hidden!.kind === 'kufrik')).toHaveLength(1);
      for (const f of hidden) expect(f.source).toBeNull();
      expect(s.furniture.every((f) => f.trap === null)).toBe(true);
    });
  });

  it('starts the spies in opposite corners with full stock', () => {
    forAll((s) => {
      expect(s.spies[0].room).toBe(0);
      expect(s.spies[1].room).toBe(s.rooms.length - 1);
      expect(s.spies[0].visited[0]).toBe(true);
      expect(s.spies[1].visited[s.rooms.length - 1]).toBe(true);
      expect(s.spies[0].stock).toEqual(RULES.trapStock);
      expect(s.spies[0].clock).toBe(RULES.defaultClock);
    });
  });

  it('is deterministic per seed', () => {
    expect(JSON.stringify(createGame(123, 'stredni'))).toBe(JSON.stringify(createGame(123, 'stredni')));
    expect(JSON.stringify(createGame(123, 'stredni'))).not.toBe(JSON.stringify(createGame(124, 'stredni')));
  });

  it('uses the given clock', () => {
    expect(createGame(1, 'mala', 300).spies[1].clock).toBe(300);
  });
});
