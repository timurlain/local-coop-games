import { cs } from '../../shared/i18n/cs';
import { RULES, isLevel, levelRules } from './logic/rules';

/** Menu settings, persisted in localStorage. */
export interface Settings {
  level: number;
  muted: boolean;
}

/** Round-2 embassy sizes → the level with the same grid (mala 3×3, stredni 4×3, velka 5×4). */
const LEVEL_OF_SIZE: Readonly<Record<string, number>> = { mala: 2, stredni: 3, velka: 5 };
/** Level for any other round-2 size/clock setting. */
const LEGACY_LEVEL = 3;

/**
 * Settings from whatever was saved (possibly nothing, junk, or round-2's `{ size, clock }`): a valid saved level
 * wins; otherwise a round-2 size maps to its level (anything else from round 2 → level 3); otherwise the default.
 * Only the current keys are returned, so the old ones disappear on the next save.
 */
export function migrateSettings(raw: unknown): Settings {
  const o = raw !== null && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  let level: number = RULES.defaultLevel;
  if (isLevel(o.level)) level = o.level;
  else if (typeof o.size === 'string' && o.size in LEVEL_OF_SIZE) level = LEVEL_OF_SIZE[o.size];
  else if ('size' in o || 'clock' in o) level = LEGACY_LEVEL;
  return { level, muted: o.muted === true };
}

export interface LevelStats {
  rooms: number;
  /** traps of both spies together */
  traps: number;
  minutes: number;
}

export function levelStats(level: number): LevelStats {
  const { cols, rows, clockSeconds, trapStockPerSpy } = levelRules(level);
  const perSpy = Object.values(trapStockPerSpy).reduce((a, b) => a + b, 0);
  return { rooms: cols * rows, traps: 2 * perSpy, minutes: clockSeconds / 60 };
}

/** Menu readout under the level select, e.g. „36 místností · 70 pastí · 24 min". */
export function levelReadout(level: number): string {
  const { rooms, traps, minutes } = levelStats(level);
  return cs.spy.levelReadout(rooms, traps, minutes);
}
