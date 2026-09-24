import { describe, expect, it } from 'vitest';
import { createGame } from '../../src/games/spy-vs-spy/logic/generator';
import { LEVELS } from '../../src/games/spy-vs-spy/logic/rules';
import {
  FURNITURE_KINDS, HOSTS, ROOM_THEMES, YEAR_MAX, YEAR_MIN, type GameState,
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
function gameplayFingerprint(s: GameState): string {
  const doors = s.rooms.map((r) => `${+r.doors.N}${+r.doors.S}${+r.doors.E}${+r.doors.W}${r.exit ?? '-'}`).join('|');
  const furn = s.furniture
    .map((f) => `${f.room}:${f.x}:${f.source ?? '-'}:${f.hidden ? JSON.stringify(f.hidden) : '-'}`)
    .join('|');
  const spies = s.spies.map((p) => `${p.room}:${p.x}:${p.z}`).join('|');
  const str = `${doors}#${furn}#${spies}#${JSON.stringify(s.rng)}`;
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 0x01000193) >>> 0;
  return h.toString(16).padStart(8, '0');
}

/** Recorded at b944621, before the host country and year existed. */
const RECORDED: Record<string, string> = {
  'mala:1': '813ba75c', 'mala:7': 'bbc97d2a', 'mala:42': '8970a15b', 'mala:1234': '87ca148a',
  'mala:99999': '71ade0d5', 'mala:3735928559': '00728c28',
  'stredni:1': 'bea2f814', 'stredni:7': 'ced0688e', 'stredni:42': '666f32bf', 'stredni:1234': '598c7a06',
  'stredni:99999': '5782b289', 'stredni:3735928559': '6f4e8491',
  'velka:1': '133806f4', 'velka:7': 'e1e72e94', 'velka:42': 'db3abaa9', 'velka:1234': '3ffb1ee2',
  'velka:99999': '96beed54', 'velka:3735928559': '78aebbca',
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

  it('leaves the gameplay layout of a seed exactly as before', () => {
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
