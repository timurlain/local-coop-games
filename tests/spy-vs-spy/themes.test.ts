import { describe, expect, it } from 'vitest';
import { createGame } from '../../src/games/spy-vs-spy/logic/generator';
import { DIRS, ROOM_THEMES, neighbor, type EmbassySize, type GameState } from '../../src/games/spy-vs-spy/logic/state';
import { THEME_FURNITURE } from '../../src/games/spy-vs-spy/logic/themes';

const SIZES: EmbassySize[] = ['mala', 'stredni', 'velka'];
const SEEDS = Array.from({ length: 200 }, (_, i) => i * 104729 + 3);

function forAll(check: (s: GameState, size: EmbassySize) => void) {
  for (const size of SIZES) for (const seed of SEEDS) check(createGame(seed, size), size);
}

describe('room themes', () => {
  it('gives every room a known theme', () => {
    forAll((s) => {
      for (const r of s.rooms) expect(ROOM_THEMES).toContain(r.theme);
    });
  });

  it('uses all 8 themes when there are at least 8 rooms, and deals them evenly', () => {
    forAll((s) => {
      const counts = new Map<string, number>();
      for (const r of s.rooms) counts.set(r.theme, (counts.get(r.theme) ?? 0) + 1);
      expect(counts.size).toBe(Math.min(8, s.rooms.length));
      const full = Math.floor(s.rooms.length / 8);
      for (const n of counts.values()) {
        expect(n).toBeGreaterThanOrEqual(full);
        expect(n).toBeLessThanOrEqual(full + 1);
      }
    });
  });

  it('picks every furniture piece from its room theme pool', () => {
    forAll((s) => {
      for (const f of s.furniture) expect(THEME_FURNITURE[s.rooms[f.room].theme]).toContain(f.kind);
    });
  });

  it('never gives two neighbouring rooms the same theme', () => {
    forAll((s) => {
      for (const r of s.rooms) {
        for (const d of DIRS) {
          const n = neighbor(s, r.id, d);
          if (n !== null) expect(s.rooms[n].theme, `room ${r.id} ${d} seed ${s.seed}`).not.toBe(r.theme);
        }
      }
    });
  });

  it('is deterministic per seed', () => {
    for (const size of SIZES) {
      const a = createGame(77, size).rooms.map((r) => r.theme);
      expect(createGame(77, size).rooms.map((r) => r.theme)).toEqual(a);
    }
  });
});
