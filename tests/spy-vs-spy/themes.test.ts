import { describe, expect, it } from 'vitest';
import { createGame } from '../../src/games/spy-vs-spy/logic/generator';
import {
  DIRS, FIXTURE_KINDS, FURNITURE_KINDS, ROOM_THEMES, neighbor, type EmbassySize, type GameState,
} from '../../src/games/spy-vs-spy/logic/state';
import { cs } from '../../src/shared/i18n/cs';
import { RULES } from '../../src/games/spy-vs-spy/logic/rules';
import { DECOR_KINDS, DECOR_W, TALL_FURNITURE, THEME_FURNITURE } from '../../src/games/spy-vs-spy/logic/themes';

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

  it('picks every non-fixture furniture piece from its room theme pool', () => {
    forAll((s) => {
      for (const f of s.furniture) {
        if (f.source !== null) continue; // fixtures replace an ordinary piece's kind
        expect(THEME_FURNITURE[s.rooms[f.room].theme]).toContain(f.kind);
      }
    });
  });

  it('covers every furniture kind across the theme pools plus the fixture kinds (a forgotten kind fails loudly)', () => {
    const pooled = new Set([...Object.values(THEME_FURNITURE).flat(), ...FIXTURE_KINDS]);
    expect([...pooled].sort()).toEqual([...FURNITURE_KINDS].sort());
  });

  it('never puts a fixture kind in an ordinary theme pool', () => {
    for (const pool of Object.values(THEME_FURNITURE)) {
      for (const kind of FIXTURE_KINDS) expect(pool).not.toContain(kind);
    }
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

  it('has a Czech name for every theme', () => {
    expect(Object.keys(cs.spy.rooms).sort()).toEqual([...ROOM_THEMES].sort());
  });

  it('is deterministic per seed', () => {
    for (const size of SIZES) {
      const a = createGame(77, size).rooms.map((r) => r.theme);
      expect(createGame(77, size).rooms.map((r) => r.theme)).toEqual(a);
    }
  });
});

describe('wall decorations and rugs', () => {
  it('hangs 1-2 distinct decorations per room, inside the back wall and apart', () => {
    forAll((s) => {
      for (const r of s.rooms) {
        expect(r.decor.length).toBeGreaterThanOrEqual(1);
        expect(r.decor.length).toBeLessThanOrEqual(2);
        for (const d of r.decor) {
          expect(DECOR_KINDS).toContain(d.kind);
          expect(d.x - DECOR_W / 2).toBeGreaterThanOrEqual(0);
          expect(d.x + DECOR_W / 2).toBeLessThanOrEqual(RULES.roomW);
        }
        if (r.decor.length === 2) {
          expect(r.decor[0].kind).not.toBe(r.decor[1].kind);
          expect(Math.abs(r.decor[0].x - r.decor[1].x)).toBeGreaterThanOrEqual(DECOR_W);
        }
      }
    });
  });

  it('keeps decorations clear of tall furniture and of the exit sign above a north exit', () => {
    forAll((s) => {
      for (const r of s.rooms) {
        for (const d of r.decor) {
          for (const id of r.furniture) {
            const f = s.furniture[id];
            if (TALL_FURNITURE.includes(f.kind)) expect(Math.abs(d.x - f.x)).toBeGreaterThanOrEqual(DECOR_W);
          }
          if (r.exit === 'N') expect(Math.abs(d.x - RULES.roomW / 2)).toBeGreaterThanOrEqual(DECOR_W);
        }
      }
    });
  });

  it('lays a rug in roughly a third of the rooms', () => {
    let rugs = 0;
    let rooms = 0;
    forAll((s) => {
      for (const r of s.rooms) {
        expect(typeof r.rug).toBe('boolean');
        if (r.rug) rugs++;
        rooms++;
      }
    });
    expect(rugs / rooms).toBeGreaterThan(0.25);
    expect(rugs / rooms).toBeLessThan(0.42);
  });
});
