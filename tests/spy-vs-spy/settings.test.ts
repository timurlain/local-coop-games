import { describe, expect, it } from 'vitest';
import { LEVELS, RULES } from '../../src/games/spy-vs-spy/logic/rules';
import { levelReadout, levelStats, migrateSettings } from '../../src/games/spy-vs-spy/settings';

describe('level readout (spec §4)', () => {
  it('counts rooms, traps of both spies and minutes per level', () => {
    expect(LEVELS.map((l) => levelStats(l))).toEqual([
      { rooms: 6, traps: 10, minutes: 5 },
      { rooms: 9, traps: 14, minutes: 6 },
      { rooms: 12, traps: 18, minutes: 8 },
      { rooms: 16, traps: 24, minutes: 10 },
      { rooms: 20, traps: 28, minutes: 12 },
      { rooms: 24, traps: 32, minutes: 15 },
      { rooms: 30, traps: 40, minutes: 18 },
      { rooms: 36, traps: 70, minutes: 24 },
    ]);
  });

  it('formats the menu readout', () => {
    expect(levelReadout(8)).toBe('36 místností · 70 pastí · 24 min');
    expect(levelReadout(1)).toBe('6 místností · 10 pastí · 5 min');
  });
});

describe('migrateSettings', () => {
  it('keeps music on unless it was explicitly switched off', () => {
    expect(migrateSettings({ level: 4 }).music).toBe(true);
    expect(migrateSettings({ level: 4, music: 'no' }).music).toBe(true);
    expect(migrateSettings({ level: 4, music: false }).music).toBe(false);
  });

  it('uses the defaults for nothing saved', () => {
    expect(migrateSettings({})).toEqual({ level: RULES.defaultLevel, muted: false, hideAirport: false, music: true });
    expect(migrateSettings(null)).toEqual({ level: RULES.defaultLevel, muted: false, hideAirport: false, music: true });
    expect(migrateSettings('junk')).toEqual({ level: RULES.defaultLevel, muted: false, hideAirport: false, music: true });
  });

  it('keeps a saved level and mute', () => {
    expect(migrateSettings({ level: 7, muted: true, hideAirport: true, music: false })).toEqual({ level: 7, muted: true, hideAirport: true, music: false });
  });

  it('keeps „Skrýt letiště" off unless saved as on', () => {
    expect(migrateSettings({ level: 4 }).hideAirport).toBe(false);
    expect(migrateSettings({ level: 4, hideAirport: 'yes' }).hideAirport).toBe(false);
    expect(migrateSettings({ level: 4, hideAirport: true }).hideAirport).toBe(true);
  });

  it('replaces an invalid level with the default', () => {
    for (const level of [0, 9, 2.5, '4', null]) {
      expect(migrateSettings({ level }).level, String(level)).toBe(RULES.defaultLevel);
    }
  });

  it('maps round-2 sizes to the level with the same grid', () => {
    expect(migrateSettings({ size: 'mala', clock: 300, muted: true })).toEqual({ level: 2, muted: true, hideAirport: false, music: true });
    expect(migrateSettings({ size: 'stredni', clock: 480 })).toEqual({ level: 3, muted: false, hideAirport: false, music: true });
    expect(migrateSettings({ size: 'velka', clock: 720 })).toEqual({ level: 5, muted: false, hideAirport: false, music: true });
  });

  it('falls back to level 3 for any other round-2 setting', () => {
    expect(migrateSettings({ size: 'obri', clock: 480 }).level).toBe(3);
    expect(migrateSettings({ clock: 300 }).level).toBe(3);
  });

  it('prefers a saved level over leftover round-2 keys and drops the old keys', () => {
    const s = migrateSettings({ level: 8, size: 'mala', clock: 300 });
    expect(s).toEqual({ level: 8, muted: false, hideAirport: false, music: true });
    expect(Object.keys(s).sort()).toEqual(['hideAirport', 'level', 'music', 'muted']);
  });
});
