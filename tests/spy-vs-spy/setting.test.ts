import { describe, expect, it } from 'vitest';
import { createGame } from '../../src/games/spy-vs-spy/logic/generator';
import { LEVELS } from '../../src/games/spy-vs-spy/logic/rules';
import {
  FURNITURE_KINDS, HOSTS, ROOM_THEMES, YEAR_MAX, YEAR_MIN, type GameState, type Thing,
} from '../../src/games/spy-vs-spy/logic/state';
import { DECOR_KINDS, THEME_FURNITURE, flagOf } from '../../src/games/spy-vs-spy/logic/themes';
import { TITLE_CARD_TIME, titleCardAlpha, titleCardLines } from '../../src/games/spy-vs-spy/render/title';
import { cs } from '../../src/shared/i18n/cs';

/** Round-2 embassy sizes and the levels with the same grid: mala 3×3, stredni 4×3, velka 5×4. */
const LEVEL_OF_SIZE: Record<string, number> = { mala: 2, stredni: 3, velka: 5 };
const SEEDS = Array.from({ length: 200 }, (_, i) => i * 7919 + 11);

/**
 * Hash of everything the gameplay RNG decides: doors, exit, furniture slots, fixtures (via `source`), hidden
 * things, spawn, and the gameplay RNG state left after generation. Furniture kinds are left out on purpose
 * (renamed ids and a bigger pool change which picture is drawn, never where or what is hidden).
 */
/** `f.hidden` for the fingerprint, with `lastHolder` left out — it isn't decided by the gameplay
 *  RNG this fingerprint guards (spec §7, round 3 L4): it starts `null` for every hidden `Thing`
 *  and is only ever changed by play (picking something up), never by generation. */
function hiddenForFingerprint(hidden: Thing | null): string {
  if (!hidden) return '-';
  if (hidden.kind === 'remedy') return JSON.stringify(hidden);
  const { lastHolder: _lastHolder, ...rest } = hidden;
  return JSON.stringify(rest);
}

function gameplayFingerprint(s: GameState): string {
  const doors = s.rooms.map((r) => `${+r.doors.N}${+r.doors.S}${+r.doors.E}${+r.doors.W}${r.exit ?? '-'}`).join('|');
  const furn = s.furniture
    .map((f) => `${f.room}:${f.x}:${f.z}:${f.source ?? '-'}:${hiddenForFingerprint(f.hidden)}`)
    .join('|');
  const spies = s.spies.map((p) => `${p.room}:${p.x}:${p.z}`).join('|');
  const str = `${doors}#${furn}#${spies}#${JSON.stringify(s.rng)}`;
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 0x01000193) >>> 0;
  return h.toString(16).padStart(8, '0');
}

/**
 * Re-recorded on purpose for round 6 §3 (two money and two passports): `placeThings` hides 6 secret items plus the
 * kufřík (7 distinct rooms instead of 5), and fixtures now skip a room's last non-fixture piece, so the RNG draws of
 * both change and every seed's fixtures and hidden things move.
 * Before that, re-recorded for round 5 review fixes: free-standing pieces moved off the back door (x 62-70 / 130-138).
 * Before that, re-recorded for round 5 (at most one secret item per room): `placeThings` now shuffles rooms with a
 * non-fixture piece and picks 5 distinct ones, instead of shuffling the flat furniture pool, so the RNG draws
 * change and every seed's hidden-thing rooms move. Previously re-recorded for round 5 §5 (2-3 pieces per room,
 * one side of the back door each, and free-standing pieces on the floor).
 */
const RECORDED: Record<string, string> = {
  'mala:1': '8fe55cbc', 'mala:7': '71b5474f', 'mala:42': '78e4ac40', 'mala:1234': '416ff80c',
  'mala:99999': 'f738e92e', 'mala:3735928559': 'fe5ef789',
  'stredni:1': '7d096a6a', 'stredni:7': 'a1d8a594', 'stredni:42': '917a1c46', 'stredni:1234': '74835ff3',
  'stredni:99999': '38049066', 'stredni:3735928559': '1f0781cb',
  'velka:1': '4d6c4bdd', 'velka:7': 'c51e5f0f', 'velka:42': '6d049499', 'velka:1234': '8888796d',
  'velka:99999': 'b467f6a7', 'velka:3735928559': '788f558a',
};

describe('host embassy and year', () => {
  it('picks a known host and a year in 1929-1937', () => {
    for (const level of LEVELS) {
      for (const seed of SEEDS) {
        const s = createGame(seed, level);
        expect(HOSTS).toContain(s.host);
        expect(Number.isInteger(s.year)).toBe(true);
        expect(s.year).toBeGreaterThanOrEqual(1929);
        expect(s.year).toBeLessThanOrEqual(1937);
      }
    }
    expect([YEAR_MIN, YEAR_MAX]).toEqual([1929, 1937]);
  });

  it('keeps a German embassy before 1933, while the Weimar black-red-gold flag was the flag', () => {
    let german = 0;
    for (const seed of SEEDS) {
      for (const level of LEVELS) {
        const s = createGame(seed, level);
        if (s.host !== 'de') continue;
        german++;
        expect(s.year).toBeLessThanOrEqual(1932);
      }
    }
    expect(german).toBeGreaterThan(0);
  });

  it('is deterministic per seed', () => {
    for (const level of LEVELS) {
      for (const seed of SEEDS.slice(0, 20)) {
        const a = createGame(seed, level);
        const b = createGame(seed, level);
        expect([b.host, b.year]).toEqual([a.host, a.year]);
      }
    }
  });

  it('uses every host and many years across seeds', () => {
    const hosts = new Set<string>();
    const years = new Set<number>();
    for (const seed of SEEDS) {
      const s = createGame(seed, 2);
      hosts.add(s.host);
      years.add(s.year);
    }
    expect([...hosts].sort()).toEqual([...HOSTS].sort());
    expect(years.size).toBe(9);
  });

  it('keeps the gameplay layout of a seed as recorded (looks never move it)', () => {
    const now: Record<string, string> = {};
    for (const key of Object.keys(RECORDED)) {
      const [size, seed] = key.split(':');
      now[key] = gameplayFingerprint(createGame(Number(seed), LEVEL_OF_SIZE[size]));
    }
    expect(now).toEqual(RECORDED);
  });
});

describe('period ids', () => {
  it('has the cipher room instead of the radio station', () => {
    expect(ROOM_THEMES).toContain('sifrovna');
    expect(ROOM_THEMES as readonly string[]).not.toContain('radiostanice');
    expect(cs.spy.rooms.sifrovna).toBe('Šifrovací místnost');
  });

  it('has the gramophone, the kitchen dresser and the telephone instead of the TV and the fridge', () => {
    for (const gone of ['televize', 'lednice']) {
      expect(FURNITURE_KINDS as readonly string[]).not.toContain(gone);
      for (const pool of Object.values(THEME_FURNITURE)) expect(pool as readonly string[]).not.toContain(gone);
    }
    for (const kind of ['gramofon', 'kredenc', 'telefon'] as const) {
      expect(FURNITURE_KINDS).toContain(kind);
      expect(Object.values(THEME_FURNITURE).some((pool) => pool.includes(kind))).toBe(true);
    }
  });

  it('has a flag decoration per host and no generic flag', () => {
    expect(DECOR_KINDS as readonly string[]).not.toContain('vlajka');
    for (const h of HOSTS) expect(DECOR_KINDS).toContain(flagOf(h));
    expect(DECOR_KINDS).toContain('telegram');
  });
});

describe('flags on the walls', () => {
  it('hangs the host flag in at least 40 % of rooms and the other flags only occasionally', () => {
    let rooms = 0;
    let host = 0;
    let other = 0;
    for (const level of LEVELS) {
      for (const seed of SEEDS) {
        const s = createGame(seed, level);
        for (const r of s.rooms) {
          rooms++;
          if (r.decor.some((d) => d.kind === flagOf(s.host))) host++;
          if (r.decor.some((d) => d.kind.startsWith('vlajka_') && d.kind !== flagOf(s.host))) other++;
        }
      }
    }
    expect(host / rooms).toBeGreaterThanOrEqual(0.4);
    expect(other / rooms).toBeGreaterThan(0.02);
    expect(other / rooms).toBeLessThan(0.2);
  });

  it('never hangs two flags in one room', () => {
    for (const seed of SEEDS) {
      for (const r of createGame(seed, 5).rooms) {
        expect(r.decor.filter((d) => d.kind.startsWith('vlajka_')).length).toBeLessThanOrEqual(1);
      }
    }
  });
});

describe('Czech texts for the setting', () => {
  it('names every host embassy', () => {
    expect(Object.keys(cs.spy.hosts).sort()).toEqual([...HOSTS].sort());
    expect(cs.spy.hosts).toEqual({
      cs: 'Velvyslanectví Československé republiky',
      pl: 'Velvyslanectví Polské republiky',
      de: 'Velvyslanectví Německé říše (Výmarská republika)',
      hu: 'Velvyslanectví Maďarského království',
      at: 'Velvyslanectví Rakouské republiky',
    });
  });

  it('formats the title card', () => {
    expect(cs.spy.titleCard('pl', 1934)).toBe('Velvyslanectví Polské republiky · Praha 1934');
  });

  it('names Austria by year: the republic through 1933, the Ständestaat from 1934', () => {
    expect(cs.spy.hostName('at', 1932)).toBe('Velvyslanectví Rakouské republiky');
    expect(cs.spy.hostName('at', 1935)).toBe('Velvyslanectví Spolkového státu Rakousko');
    expect(cs.spy.titleCard('at', 1932)).toBe('Velvyslanectví Rakouské republiky · Praha 1932');
    expect(cs.spy.titleCard('at', 1935)).toBe('Velvyslanectví Spolkového státu Rakousko · Praha 1935');
  });

  it('names every furniture kind', () => {
    expect(Object.keys(cs.spy.furniture).sort()).toEqual([...FURNITURE_KINDS].sort());
    for (const name of Object.values(cs.spy.furniture)) expect(name.length).toBeGreaterThan(0);
  });
});

describe('title card', () => {
  it('shows the embassy and „Praha <year>"', () => {
    expect(titleCardLines('pl', 1934)).toEqual(['Velvyslanectví Polské republiky', 'Praha 1934']);
    expect(titleCardLines('de', 1931)[0]).toBe('Velvyslanectví Německé říše (Výmarská republika)');
    expect(titleCardLines('at', 1932)[0]).toBe('Velvyslanectví Rakouské republiky');
    expect(titleCardLines('at', 1935)[0]).toBe('Velvyslanectví Spolkového státu Rakousko');
  });

  it('fades in, holds for about two seconds and fades out', () => {
    expect(TITLE_CARD_TIME).toBeGreaterThanOrEqual(1.8);
    expect(TITLE_CARD_TIME).toBeLessThanOrEqual(2.5);
    expect(titleCardAlpha(0)).toBe(0);
    expect(titleCardAlpha(0.1)).toBeGreaterThan(0);
    expect(titleCardAlpha(1)).toBe(1);
    expect(titleCardAlpha(TITLE_CARD_TIME - 0.1)).toBeLessThan(1);
    expect(titleCardAlpha(TITLE_CARD_TIME)).toBe(0);
  });
});
